import { editor, IRange } from "monaco-editor";
import { v4 as uuidv4 } from "uuid"; // You'll need to add this package

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

  // Add a clone method for operational transformation
  clone?: () => TextOperation;
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
        // Generate a unique ID for the operation
        operation.id = uuidv4();

        // Add the operation to pending operations
        this.pendingOperations.set(operation.id, operation);

        console.log("Created operation:", operation);
        // Send the operation to the server
        this.operationCallback(operation);
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

    const operation: TextOperation = {
      type,
      position,
      text: text.length > 0 ? text : undefined,
      length: length > 0 ? length : undefined,
      version: this.localVersion,
      userId: this.userId,
      clone: function () {
        const clone = { ...this };
        clone.clone = this.clone;
        return clone;
      },
    };

    return operation;
  }

  /**
   * Applies a received operation from the server
   */
  public applyOperation(operation: TextOperation): void {
    console.log("Applying operation:", operation);

    // If this is our own operation coming back from the server
    if (operation.userId === this.userId) {
      if (operation.id && this.pendingOperations.has(operation.id)) {
        // Remove the operation from pending operations
        this.pendingOperations.delete(operation.id);
      }

      // Update local version
      this.localVersion = operation.version;

      // Add to operation history
      this.operationHistory.push(operation);

      // Trim history if it gets too large
      if (this.operationHistory.length > 100) {
        this.operationHistory.shift();
      }

      return;
    }

    // Transform the operation against any pending operations
    const transformedOperation =
      this.transformAgainstPendingOperations(operation);

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

      // Update local version
      this.localVersion = transformedOperation.version;

      // Add to operation history
      this.operationHistory.push(transformedOperation);

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

  /**
   * Transform an incoming operation against all pending operations
   */
  private transformAgainstPendingOperations(
    operation: TextOperation
  ): TextOperation {
    let transformedOperation = operation.clone
      ? operation.clone()
      : { ...operation };

    // Add clone method if it doesn't exist
    if (!transformedOperation.clone) {
      transformedOperation.clone = function () {
        const clone = { ...this };
        clone.clone = this.clone;
        return clone;
      };
    }

    // Transform against all pending operations in order
    for (const pendingOp of this.pendingOperations.values()) {
      transformedOperation = this.transformOperation(
        transformedOperation,
        pendingOp
      );
    }

    return transformedOperation;
  }

  /**
   * Transforms operation 'a' against operation 'b'.
   * This function assumes 'b' has already been applied to the document state
   * that 'a' was based on. It modifies 'a' so it can be applied to the document
   * state *after* 'b' has been applied.
   */
  private transformOperation(
    a: TextOperation,
    b: TextOperation
  ): TextOperation {
    // Clone operation 'a' to avoid modifying the original
    const transformedA = a.clone ? a.clone() : { ...a };

    // Add clone method if it doesn't exist
    if (!transformedA.clone) {
      transformedA.clone = function () {
        const clone = { ...this };
        clone.clone = this.clone;
        return clone;
      };
    }

    // If operations are identical, no transform needed
    if (a.id === b.id) {
      return transformedA;
    }

    // No transformation needed if operations are from same user or if 'b' is effectively in the past
    if (b.version < transformedA.version || transformedA.userId === b.userId) {
      return transformedA;
    }

    // Core transformation logic based on operation types
    switch (b.type) {
      case OperationType.INSERT:
        this.transformAgainstInsert(transformedA, b);
        break;

      case OperationType.DELETE:
        this.transformAgainstDelete(transformedA, b);
        break;

      case OperationType.REPLACE:
        // Treat REPLACE as DELETE followed by INSERT
        const deletePartOfB: TextOperation = {
          type: OperationType.DELETE,
          position: b.position,
          length: b.length,
          version: b.version,
          userId: b.userId,
          clone: function () {
            const clone = { ...this };
            clone.clone = this.clone;
            return clone;
          },
        };

        const insertPartOfB: TextOperation = {
          type: OperationType.INSERT,
          position: b.position,
          text: b.text,
          version: b.version,
          userId: b.userId,
          clone: function () {
            const clone = { ...this };
            clone.clone = this.clone;
            return clone;
          },
        };

        // Transform against DELETE then INSERT
        const tempTransformedA = this.transformOperation(
          transformedA,
          deletePartOfB
        );
        return this.transformOperation(tempTransformedA, insertPartOfB);
    }

    return transformedA;
  }

  /**
   * Helper method to transform an operation against an INSERT operation
   */
  private transformAgainstInsert(
    transformedA: TextOperation,
    opB_Insert: TextOperation
  ): void {
    const aPos = transformedA.position;
    const bPos = opB_Insert.position;
    const bLen = opB_Insert.text ? opB_Insert.text.length : 0;

    if (bLen === 0) return; // Nothing to transform against

    // If 'b' inserts at or before 'a's position, shift 'a' forward
    if (bPos < aPos) {
      transformedA.position = aPos + bLen;
    }
    // If 'b' inserts exactly at 'a's position, apply tie-breaking
    else if (bPos === aPos) {
      // Tie-breaking rule: operation from user with lexicographically smaller ID comes first
      if (transformedA.type === OperationType.INSERT) {
        const aUserId = transformedA.userId || "";
        const bUserId = opB_Insert.userId || "";
        if (aUserId.localeCompare(bUserId) > 0) {
          // If 'a's user ID is "greater", assume 'a' comes after 'b's insert
          transformedA.position = aPos + bLen;
        }
        // else 'a' comes first, position unchanged
      } else {
        // If 'a' is DELETE/REPLACE starting at bPos, b's insert happens before it
        transformedA.position = aPos + bLen;
      }
    }
    // If 'b' inserts after 'a's position, 'a' is unaffected
  }

  /**
   * Helper method to transform an operation against a DELETE operation
   */
  private transformAgainstDelete(
    transformedA: TextOperation,
    opB_Delete: TextOperation
  ): void {
    const aPos = transformedA.position;
    const aLen = transformedA.length || 0;
    const aEnd = aPos + aLen;

    const bPos = opB_Delete.position;
    const bLen = opB_Delete.length || 0;
    const bEnd = bPos + bLen;

    if (bLen === 0) return; // Nothing to transform against

    // Case 1: 'b' deletes entirely before 'a' starts
    if (bEnd <= aPos) {
      transformedA.position = aPos - bLen;
    }
    // Case 2: 'b' deletes entirely after 'a' ends
    else if (bPos >= aEnd) {
      // Position and length of 'a' remain unchanged
    }
    // Case 3: 'b' deletes a range that completely contains 'a'
    else if (bPos <= aPos && bEnd >= aEnd) {
      transformedA.position = bPos;
      if (transformedA.type === OperationType.INSERT) {
        // Insert is contained within deletion, nothing changes about the insert text
      } else {
        transformedA.length = 0; // Delete/Replace becomes zero length
      }
    }
    // Case 4: 'b' deletes a range that starts before 'a' and overlaps with the beginning of 'a'
    else if (bPos < aPos && bEnd > aPos && bEnd < aEnd) {
      const deletedLength = bEnd - aPos;
      transformedA.position = bPos; // 'a' now starts where 'b' started deleting
      if (transformedA.type !== OperationType.INSERT) {
        transformedA.length = aLen - deletedLength; // Reduce length of 'a'
      }
    }
    // Case 5: 'b' deletes a range that starts within 'a' and ends after 'a'
    else if (bPos >= aPos && bPos < aEnd && bEnd >= aEnd) {
      // 'a's position is unchanged
      if (transformedA.type !== OperationType.INSERT) {
        transformedA.length = bPos - aPos; // 'a' is truncated
      }
    }
    // Case 6: 'b' deletes a range that is completely within 'a'
    else if (bPos > aPos && bEnd < aEnd) {
      // 'a's position is unchanged
      if (transformedA.type !== OperationType.INSERT) {
        transformedA.length = aLen - bLen; // 'a' becomes shorter
      }
    }
  }
}
