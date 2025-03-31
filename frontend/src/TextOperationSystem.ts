import { editor, IRange } from "monaco-editor";
import { v4 as uuidv4 } from "uuid";

// Define operation types
export enum OperationType {
  INSERT = "INSERT",
  DELETE = "DELETE",
  REPLACE = "REPLACE",
}

// A version vector tracks operations from each client
export interface VersionVector {
  [userId: string]: number; // Maps each user ID to their operation count
}

// Define the structure of an operation
export interface TextOperation {
  id?: string;
  type: OperationType;
  position: number; // Position in the document
  text?: string; // Text to insert or replacement text
  length?: number; // Length of text to delete or replace
  baseVersionVector: VersionVector; // Vector when operation was created
  userId: string; // User who created this operation

  clone?: () => TextOperation;
}

// Define the structure of an operation acknowledgment from server
export interface OperationAck {
  operationId: string;
  baseVersionVector: VersionVector; // Updated version vector after applying the operation
  userId: string;
}

export class TextOperationManager {
  private editor: editor.IStandaloneCodeEditor;
  private model: editor.ITextModel;
  private localVersionVector: VersionVector = {}; // Track versions from all clients
  private pendingOperations: Map<string, TextOperation> = new Map();
  private operationHistory: TextOperation[] = [];
  private userId: string;
  private operationCallback: (op: TextOperation) => void;
  private isApplyingExternalOperation: boolean = false;

  constructor(
    editor: editor.IStandaloneCodeEditor,
    userId: string,
    initialVersionVector: VersionVector = {},
    operationCallback: (op: TextOperation) => void
  ) {
    this.editor = editor;
    this.model = editor.getModel()!;
    this.userId = userId;
    this.localVersionVector = { ...initialVersionVector };
    this.operationCallback = operationCallback;

    // Initialize user's version count if not already present
    if (!this.localVersionVector[userId]) {
      this.localVersionVector[userId] = 0;
    }

    // Listen for model content changes
    this.model.onDidChangeContent((e) => {
      if (!this.isApplyingExternalOperation) {
        this.handleModelContentChange(e);
      }
    });

    console.log(
      "TextOperationManager initialized with version vector:",
      initialVersionVector
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

        // Set the operation's base version vector (copy current state)
        operation.baseVersionVector = { ...this.localVersionVector };

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
      baseVersionVector: {}, // Will be filled in handleModelContentChange
      userId: this.userId,
      clone: function () {
        const clone = { ...this };
        clone.baseVersionVector = { ...this.baseVersionVector };
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

      // Update our version vector with the server's updated vector
      this.updateVersionVector(operation.baseVersionVector);

      console.log("Updated local version vector:", this.localVersionVector);
      return;
    }

    // Update our local version vector to include this operation
    this.updateVersionVector(operation.baseVersionVector);

    // Find concurrent operations - those not caused by or causing the incoming operation
    const concurrentOps = this.findConcurrentOperations(operation);

    // Sort for consistent transformation order
    concurrentOps.sort((a, b) => {
      const versionA = a.baseVersionVector?.version || 0; // Access version from vector
      const versionB = b.baseVersionVector?.version || 0;
      return versionB - versionA;
    });

    // Transform operation against concurrent operations
    let transformedOperation = operation.clone
      ? operation.clone()
      : { ...operation };

    for (const concurrentOp of concurrentOps) {
      transformedOperation = this.transformOperation(
        transformedOperation,
        concurrentOp
      );
    }

    // Apply the transformed operation
    this.isApplyingExternalOperation = true;
    try {
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

      // Add to operation history
      this.operationHistory.push(transformedOperation);

      // Trim history if it gets too large
      if (this.operationHistory.length > 100) {
        this.operationHistory.shift();
      }

      console.log(
        "Editor updated, new version vector:",
        this.localVersionVector
      );
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

    // Update local version vector with the server's version vector
    this.updateVersionVector(ack.baseVersionVector);
    console.log("Updated local version vector:", this.localVersionVector);
  }

  /**
   * Gets the current document version vector
   */
  public getVersionVector(): VersionVector {
    return { ...this.localVersionVector };
  }

  /**
   * Sets the document version vector
   */
  public setVersionVector(vector: VersionVector): void {
    this.localVersionVector = { ...vector };
    console.log("Version vector set to:", this.localVersionVector);
  }

  /**
   * Find operations that happened concurrently with the given operation
   */
  private findConcurrentOperations(operation: TextOperation): TextOperation[] {
    // Operations that happened concurrently with the incoming operation
    const concurrent: TextOperation[] = [];

    // From pending operations (our operations not yet acknowledged)
    for (const [_, pendingOp] of this.pendingOperations) {
      if (this.isConcurrent(operation, pendingOp)) {
        concurrent.push(pendingOp);
      }
    }

    return concurrent;
  }

  /**
   * Determine if two operations are concurrent
   */
  private isConcurrent(a: TextOperation, b: TextOperation): boolean {
    // a and b are concurrent if neither happened before the other
    return !this.happenedBefore(a, b) && !this.happenedBefore(b, a);
  }

  /**
   * Determine if operation a happened before operation b
   */
  private happenedBefore(a: TextOperation, b: TextOperation): boolean {
    // a happened before b if all a's operations are included in b's history
    for (const userId in a.baseVersionVector) {
      const aVersion = a.baseVersionVector[userId] || 0;
      const bVersion = b.baseVersionVector[userId] || 0;

      if (aVersion > bVersion) {
        return false; // a includes operations that b doesn't know about
      }
    }

    // Check that at least one of a's operations is strictly before b's
    // (otherwise they're the same version vector)
    for (const userId in a.baseVersionVector) {
      const aVersion = a.baseVersionVector[userId] || 0;
      const bVersion = b.baseVersionVector[userId] || 0;

      if (aVersion < bVersion) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update local version vector with new information
   */
  private updateVersionVector(newVector: VersionVector): void {
    // Update local version vector with new information
    for (const userId in newVector) {
      const newVersion = newVector[userId];
      const currentVersion = this.localVersionVector[userId] || 0;

      // Take the max value for each user
      this.localVersionVector[userId] = Math.max(currentVersion, newVersion);
    }
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
        clone.baseVersionVector = { ...this.baseVersionVector };
        clone.clone = this.clone;
        return clone;
      };
    }

    // If operations are identical, no transform needed
    if (a.id === b.id) {
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
          baseVersionVector: { ...b.baseVersionVector },
          userId: b.userId,
          clone: function () {
            const clone = { ...this };
            clone.baseVersionVector = { ...this.baseVersionVector };
            clone.clone = this.clone;
            return clone;
          },
        };

        const insertPartOfB: TextOperation = {
          type: OperationType.INSERT,
          position: b.position,
          text: b.text,
          baseVersionVector: { ...b.baseVersionVector },
          userId: b.userId,
          clone: function () {
            const clone = { ...this };
            clone.baseVersionVector = { ...this.baseVersionVector };
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
