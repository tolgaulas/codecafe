import { editor, IRange } from "monaco-editor";

// Define operation types
export enum OperationType {
  INSERT = "INSERT",
  DELETE = "DELETE",
  REPLACE = "REPLACE",
}

// Define the structure of an operation
export interface TextOperation {
  id?: string;
  type: OperationType;
  position: number; // Position in the document
  text?: string; // Text to insert or replacement text
  length?: number; // Length of text to delete or replace
  version: number; // Document version this operation is based on
  userId: string; // User who created this operation
}

// Define the structure of an operation acknowledgment from server
export interface OperationAck {
  operationId: string;
  version: number; // New document version after applying the operation
  userId: string;
}

export class TextOperationManager {
  private editor: editor.IStandaloneCodeEditor;
  private model: editor.ITextModel;
  private localVersion: number = 0;
  private baseContent: string = "";
  private pendingOperations: Map<string, TextOperation> = new Map();
  private operationHistory: TextOperation[] = [];
  private userId: string;
  private operationCallback: (op: TextOperation) => void;
  private isApplyingExternalOperation: boolean = false;
  private nextOperationId: number = 0;

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
    this.baseContent = this.model.getValue();
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
        const operationId = `${this.userId}-${this.nextOperationId++}`;
        operation.id = operationId;

        // Store the operation in pending operations
        this.pendingOperations.set(operationId, operation);

        // Send the operation to the server
        this.operationCallback(operation);

        console.log("Created and sent operation:", operation);
      }
    }
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
    console.log("Received operation:", operation);

    // If this is our own operation coming back from the server, just update version
    if (operation.userId === this.userId) {
      if (operation.id && this.pendingOperations.has(operation.id)) {
        this.pendingOperations.delete(operation.id);
      }
      this.localVersion = operation.version;

      // Add to operation history
      this.operationHistory.push(operation);

      // Trim history if it gets too large
      if (this.operationHistory.length > 100) {
        this.operationHistory.shift();
      }

      console.log("Updated local version to:", this.localVersion);
      return;
    }

    // Transform the operation against our pending operations
    const transformedOperation =
      this.transformAgainstPendingOperations(operation);

    // Add to operation history
    this.operationHistory.push(operation);

    // Trim history if it gets too large
    if (this.operationHistory.length > 100) {
      this.operationHistory.shift();
    }

    // Flag that we're applying an external operation
    this.isApplyingExternalOperation = true;

    try {
      // Apply the operation to the model
      const edits: editor.IIdentifiedSingleEditOperation[] = [];
      const range = this.getOperationRange(transformedOperation);

      if (transformedOperation.type === OperationType.INSERT) {
        edits.push({
          range,
          text: transformedOperation.text || "",
          forceMoveMarkers: true,
        });
      } else if (transformedOperation.type === OperationType.DELETE) {
        edits.push({
          range,
          text: "",
          forceMoveMarkers: true,
        });
      } else if (transformedOperation.type === OperationType.REPLACE) {
        edits.push({
          range,
          text: transformedOperation.text || "",
          forceMoveMarkers: true,
        });
      }

      // Apply the edits
      this.model.pushEditOperations(
        this.editor.getSelections(),
        edits,
        () => null
      );

      // Update local version if the operation version is higher
      if (operation.version > this.localVersion) {
        this.localVersion = operation.version;
        console.log("Editor updated, new version:", this.localVersion);
      }
    } finally {
      // Reset the flag
      this.isApplyingExternalOperation = false;
    }
  }

  /**
   * Transform an operation against all pending operations
   */
  private transformAgainstPendingOperations(
    operation: TextOperation
  ): TextOperation {
    // Clone the operation to avoid modifying the original
    let transformed: TextOperation = { ...operation };

    // Transform against each pending operation
    for (const pendingOp of this.pendingOperations.values()) {
      transformed = this.transformOperation(transformed, pendingOp);
    }

    return transformed;
  }

  /**
   * Transform operation A against operation B
   */
  private transformOperation(
    a: TextOperation,
    b: TextOperation
  ): TextOperation {
    // Clone operation A to avoid modifying the original
    const transformed: TextOperation = { ...a };

    // If operations are from the same user or B happens after A, no transform needed
    if (a.userId === b.userId || b.version > a.version) {
      return transformed;
    }

    // Transform based on operation types
    switch (b.type) {
      case OperationType.INSERT:
        // If B inserts before A's position, shift A's position
        if (b.position <= transformed.position) {
          transformed.position = transformed.position + (b.text?.length || 0);
        }
        break;

      case OperationType.DELETE:
        if (b.length) {
          const bEnd = b.position + b.length;

          // B deletes entirely before A's position
          if (bEnd <= transformed.position) {
            transformed.position = transformed.position - b.length;
          }
          // B deletes a range that includes A's position
          else if (
            b.position <= transformed.position &&
            transformed.position < bEnd
          ) {
            transformed.position = b.position;

            // If A is also a delete/replace, adjust its length if it overlaps with B
            if (
              (transformed.type === OperationType.DELETE ||
                transformed.type === OperationType.REPLACE) &&
              transformed.length
            ) {
              const aEnd = transformed.position + transformed.length;
              if (aEnd > bEnd) {
                transformed.length = aEnd - bEnd;
              } else {
                // A is completely within B's deletion range
                transformed.length = 0;
              }
            }
          }
          // B deletes a range that overlaps with A's range (for DELETE/REPLACE operations)
          else if (
            (transformed.type === OperationType.DELETE ||
              transformed.type === OperationType.REPLACE) &&
            transformed.length
          ) {
            const aEnd = transformed.position + transformed.length;
            if (transformed.position < b.position && b.position < aEnd) {
              // B deletes part of A's range
              transformed.length = Math.min(
                b.position - transformed.position,
                transformed.length
              );
            }
          }
        }
        break;

      case OperationType.REPLACE:
        // For simplicity, treat REPLACE as DELETE followed by INSERT
        // First transform against the delete part
        const deleteOp: TextOperation = {
          type: OperationType.DELETE,
          position: b.position,
          length: b.length,
          version: b.version,
          userId: b.userId,
        };

        const afterDelete = this.transformOperation(transformed, deleteOp);

        // Then transform against the insert part
        const insertOp: TextOperation = {
          type: OperationType.INSERT,
          position: b.position,
          text: b.text,
          version: b.version,
          userId: b.userId,
        };

        return this.transformOperation(afterDelete, insertOp);
    }

    return transformed;
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
    if (ack.operationId && this.pendingOperations.has(ack.operationId)) {
      this.pendingOperations.delete(ack.operationId);
    }

    // Update local version if this is our operation
    if (ack.userId === this.userId && ack.version > this.localVersion) {
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

  /**
   * Reset the manager state
   */
  public reset(initialContent: string, initialVersion: number): void {
    this.localVersion = initialVersion;
    this.baseContent = initialContent;
    this.pendingOperations.clear();
    this.operationHistory = [];
    this.nextOperationId = 0;

    // Set the model content without triggering our change handler
    this.isApplyingExternalOperation = true;
    try {
      this.model.setValue(initialContent);
    } finally {
      this.isApplyingExternalOperation = false;
    }

    console.log("TextOperationManager reset to version:", initialVersion);
  }
}
