import { editor, IRange } from "monaco-editor";

// Define operation types to match backend
export enum OperationType {
  INSERT = "INSERT",
  DELETE = "DELETE",
  REPLACE = "REPLACE",
}

// Define the structure of an operation to match backend
export interface TextOperation {
  id?: string;
  type: OperationType;
  position: number;
  text?: string;
  length?: number;
  version: number;
  userId: string;
}

// Define the structure of an operation acknowledgment from server
export interface OperationAck {
  operationId: string;
  version: number;
  userId: string;
}

export class TextOperationManager {
  private editor: editor.IStandaloneCodeEditor;
  private model: editor.ITextModel;
  private localVersion: number = 0;
  private pendingOperations: Map<string, TextOperation> = new Map();
  private operationHistory: TextOperation[] = [];
  private userId: string;
  private operationCallback: (op: TextOperation) => void;
  private isApplyingExternalOperation: boolean = false;

  constructor(
    editor: editor.IStandaloneCodeEditor,
    userId: string,
    initialVersion: number = 0,
    operationCallback: (op: TextOperation) => void
  ) {
    this.editor = editor;
    this.model = editor.getModel()!;
    this.userId = userId;
    this.localVersion = initialVersion;
    this.operationCallback = operationCallback;

    // Listen for model content changes
    this.model.onDidChangeContent((e) => {
      if (!this.isApplyingExternalOperation) {
        this.handleModelContentChange(e);
      }
    });

    console.log(
      "TextOperationManager initialized with version:",
      initialVersion
    );
  }

  /**
   * Handles model content changes and creates operations
   */
  private handleModelContentChange(e: editor.IModelContentChangedEvent): void {
    const changes = e.changes;

    // Sort changes to process them in the right order
    // (from the end of the document to the beginning)
    changes.sort((a, b) => b.rangeOffset - a.rangeOffset);

    for (const change of changes) {
      const operation = this.createOperationFromChange(change);
      if (operation) {
        const opWithId = { ...operation, id: this.generateOperationId() };

        // Store in pending operations
        this.pendingOperations.set(opWithId.id!, opWithId);

        console.log("Created operation:", opWithId);
        // Send the operation to the server
        this.operationCallback(opWithId);
      }
    }
  }

  /**
   * Generates a unique operation ID
   */
  private generateOperationId(): string {
    return `${this.userId}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  /**
   * Creates a TextOperation from a Monaco content change
   */
  private createOperationFromChange(
    change: editor.IModelContentChange
  ): TextOperation | null {
    const position = change.rangeOffset;
    const length = change.rangeLength;
    const text = change.text;

    // Determine operation type
    let type: OperationType;
    if (length === 0 && text.length > 0) {
      type = OperationType.INSERT;
    } else if (length > 0 && text.length === 0) {
      type = OperationType.DELETE;
    } else if (length > 0 && text.length > 0) {
      type = OperationType.REPLACE;
    } else {
      // No actual change
      return null;
    }

    return {
      type,
      position,
      text: text.length > 0 ? text : undefined,
      length: length > 0 ? length : undefined,
      version: this.localVersion,
      userId: this.userId,
    };
  }

  /**
   * Applies a received operation from the server
   */
  public applyOperation(operation: TextOperation): void {
    console.log("Applying operation:", operation);

    // If this is our own operation coming back from the server, just update version
    if (operation.userId === this.userId) {
      this.localVersion = operation.version;

      // Add to operation history
      this.operationHistory.push(operation);

      // Trim history if it gets too large (similar to backend)
      if (this.operationHistory.length > 100) {
        this.operationHistory.shift();
      }

      return;
    }

    // Transform the operation if needed
    const transformedOp = this.transformOperationIfNeeded(operation);

    // Flag that we're applying an external operation
    this.isApplyingExternalOperation = true;

    try {
      // Apply the operation to the model
      const edits: editor.IIdentifiedSingleEditOperation[] = [];
      const range = this.getOperationRange(transformedOp);

      if (transformedOp.type === OperationType.INSERT) {
        edits.push({
          range,
          text: transformedOp.text || "",
          forceMoveMarkers: true,
        });
      } else if (transformedOp.type === OperationType.DELETE) {
        edits.push({
          range,
          text: "",
          forceMoveMarkers: true,
        });
      } else if (transformedOp.type === OperationType.REPLACE) {
        edits.push({
          range,
          text: transformedOp.text || "",
          forceMoveMarkers: true,
        });
      }

      // Apply the edits
      this.model.pushEditOperations(
        this.editor.getSelections(),
        edits,
        () => null
      );

      // Update local version
      this.localVersion = operation.version;

      // Add to operation history
      this.operationHistory.push(operation);

      // Trim history if it gets too large
      if (this.operationHistory.length > 100) {
        this.operationHistory.shift();
      }

      console.log("Editor updated, new version:", this.localVersion);
    } finally {
      // Reset the flag
      this.isApplyingExternalOperation = false;
    }
  }

  /**
   * Transform an operation against the history if needed
   */
  private transformOperationIfNeeded(operation: TextOperation): TextOperation {
    // If operation is already at current version, no need to transform
    if (operation.version === this.localVersion) {
      return operation;
    }

    // If operation is for a future version, log warning but still apply
    if (operation.version > this.localVersion) {
      console.warn(
        `Received operation for future version: ${operation.version}, current: ${this.localVersion}`
      );
      return operation;
    }

    // Clone the operation to avoid modifying the original
    let transformedOp = this.cloneOperation(operation);

    // Find operations to transform against
    const operationsToTransformAgainst = this.operationHistory.filter(
      (historyOp) =>
        historyOp.version >= operation.version &&
        historyOp.userId !== operation.userId
    );

    // Sort operations by version to transform in the correct order
    operationsToTransformAgainst.sort((a, b) => a.version - b.version);

    // Transform against each operation
    for (const historyOp of operationsToTransformAgainst) {
      transformedOp = this.transformOperation(transformedOp, historyOp);
    }

    return transformedOp;
  }

  /**
   * Transform operation A against operation B
   */
  private transformOperation(
    clientOp: TextOperation,
    serverOp: TextOperation
  ): TextOperation {
    // Clone the client operation to avoid modifying the original
    const transformed = this.cloneOperation(clientOp);

    // If operations are from the same user, no transform needed
    if (clientOp.userId === serverOp.userId) {
      return transformed;
    }

    // Transform position based on operation types
    switch (serverOp.type) {
      case OperationType.INSERT:
        transformed.position = this.transformPosition(
          transformed.position,
          serverOp.position,
          serverOp.text?.length || 0,
          true
        );

        // If client op is DELETE or REPLACE, we may need to adjust length too
        if (
          (transformed.type === OperationType.DELETE ||
            transformed.type === OperationType.REPLACE) &&
          transformed.length != null
        ) {
          // Check if server insert is inside client's deletion range
          const clientOpEnd = transformed.position + transformed.length;
          if (
            serverOp.position > transformed.position &&
            serverOp.position < clientOpEnd
          ) {
            transformed.length =
              transformed.length + (serverOp.text?.length || 0);
          }
        }
        break;

      case OperationType.DELETE:
        const serverOpEnd = serverOp.position + (serverOp.length || 0);

        // Transform the position
        transformed.position = this.transformPositionAgainstDelete(
          transformed.position,
          serverOp.position,
          serverOp.length || 0
        );

        // If client op is DELETE or REPLACE, handle length adjustment
        if (
          (transformed.type === OperationType.DELETE ||
            transformed.type === OperationType.REPLACE) &&
          transformed.length != null
        ) {
          // Calculate deletion overlap and adjust length accordingly
          transformed.length = this.transformLengthAgainstDelete(
            transformed.position,
            transformed.length,
            serverOp.position,
            serverOp.length || 0
          );
        }
        break;

      case OperationType.REPLACE:
        // Handle REPLACE as DELETE followed by INSERT
        const deleteOp: TextOperation = {
          type: OperationType.DELETE,
          position: serverOp.position,
          length: serverOp.length,
          version: serverOp.version,
          userId: serverOp.userId,
        };

        const insertOp: TextOperation = {
          type: OperationType.INSERT,
          position: serverOp.position,
          text: serverOp.text,
          version: serverOp.version,
          userId: serverOp.userId,
        };

        // Transform against delete and then insert
        const afterDelete = this.transformOperation(transformed, deleteOp);
        return this.transformOperation(afterDelete, insertOp);
    }

    return transformed;
  }

  // Helper methods for transformations
  private transformPosition(
    position: number,
    otherPosition: number,
    otherLength: number,
    isInsert: boolean
  ): number {
    if (position <= otherPosition) {
      return position; // Position before the other operation is unchanged
    } else {
      // Position after the other operation is shifted
      return isInsert
        ? position + otherLength
        : Math.max(otherPosition, position - otherLength);
    }
  }

  private transformPositionAgainstDelete(
    position: number,
    deletePos: number,
    deleteLen: number
  ): number {
    if (position <= deletePos) {
      return position; // Before deletion point - unaffected
    } else if (position >= deletePos + deleteLen) {
      return position - deleteLen; // After deletion - shift left
    } else {
      return deletePos; // Inside deletion range - move to deletion start
    }
  }

  private transformLengthAgainstDelete(
    pos: number,
    len: number,
    deletePos: number,
    deleteLen: number
  ): number {
    const endPos = pos + len;
    const deleteEndPos = deletePos + deleteLen;

    // No overlap
    if (endPos <= deletePos || pos >= deleteEndPos) {
      return len;
    }

    // Client deletion is completely inside server deletion
    if (pos >= deletePos && endPos <= deleteEndPos) {
      return 0;
    }

    // Server deletion is completely inside client deletion
    if (deletePos >= pos && deleteEndPos <= endPos) {
      return len - deleteLen;
    }

    // Partial overlap, server deletion overlaps start of client deletion
    if (deletePos <= pos && deleteEndPos > pos) {
      return endPos - deleteEndPos;
    }

    // Partial overlap, server deletion overlaps end of client deletion
    if (deletePos < endPos && deleteEndPos >= endPos) {
      return deletePos - pos;
    }

    // Should never reach here
    return len;
  }

  /**
   * Clone a TextOperation
   */
  private cloneOperation(operation: TextOperation): TextOperation {
    return {
      id: operation.id,
      type: operation.type,
      position: operation.position,
      text: operation.text,
      length: operation.length,
      version: operation.version,
      userId: operation.userId,
    };
  }

  /**
   * Gets the range for an operation based on its position and length
   */
  private getOperationRange(operation: TextOperation): IRange {
    const startPosition = this.model.getPositionAt(operation.position);

    let endPosition;
    if (operation.length && operation.length > 0) {
      endPosition = this.model.getPositionAt(
        operation.position + operation.length
      );
    } else {
      endPosition = startPosition;
    }

    return {
      startLineNumber: startPosition.lineNumber,
      startColumn: startPosition.column,
      endLineNumber: endPosition.lineNumber,
      endColumn: endPosition.column,
    };
  }

  /**
   * Acknowledge an operation from the server
   */
  public acknowledgeOperation(ack: OperationAck): void {
    console.log("Operation acknowledged:", ack);
    // Remove the operation from pending operations if it exists
    if (this.pendingOperations.has(ack.operationId)) {
      this.pendingOperations.delete(ack.operationId);
    }

    // Update local version
    if (ack.userId === this.userId) {
      this.localVersion = ack.version;
      console.log("Updated local version to:", this.localVersion);
    }
  }

  /**
   * Gets the current document version
   */
  public getVersion(): number {
    return this.localVersion;
  }

  /**
   * Sets the document version
   */
  public setVersion(version: number): void {
    this.localVersion = version;
    console.log("Version set to:", version);
  }
}
