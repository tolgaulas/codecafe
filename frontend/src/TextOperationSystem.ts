import { editor, IRange, Selection } from "monaco-editor";
import { v4 as uuidv4 } from "uuid";

export enum OperationType {
  INSERT = "INSERT",
  DELETE = "DELETE",
  REPLACE = "REPLACE",
}

export interface VersionVector {
  [userId: string]: number;
}

export interface TextOperation {
  id?: string;
  type: OperationType;
  position: number;
  text?: string;
  length?: number;
  baseVersionVector: VersionVector;
  userId: string;
  clone?: () => TextOperation;
}

export interface OperationAck {
  operationId: string;
  baseVersionVector: VersionVector;
  userId: string;
}

export class TextOperationManager {
  private editor: editor.IStandaloneCodeEditor;
  private model: editor.ITextModel;
  private localVersionVector: VersionVector = {};
  private pendingOperations: Map<string, TextOperation> = new Map();
  private operationHistory: TextOperation[] = [];
  private userId: string;
  private operationCallback: (op: TextOperation) => void;
  private isApplyingExternalOperation: boolean = false;
  private lastCursorState: editor.ICursorState[] | null = null;

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

    if (!this.localVersionVector[userId]) {
      this.localVersionVector[userId] = 0;
    }

    this.model.onDidChangeContent((e) => {
      if (!this.isApplyingExternalOperation) {
        this.handleModelContentChange(e);
      }
    });

    // Save cursor state when user moves the cursor
    this.editor.onDidChangeCursorPosition(() => {
      if (!this.isApplyingExternalOperation) {
        this.lastCursorState = this.editor.saveViewState()?.cursorState || null;
      }
    });

    console.log(
      "TextOperationManager initialized with version vector:",
      initialVersionVector
    );
  }

  private handleModelContentChange(e: editor.IModelContentChangedEvent): void {
    const changes = e.changes;
    // Sort changes in reverse order to handle multiple changes correctly
    changes.sort((a, b) => b.rangeOffset - a.rangeOffset);

    for (const change of changes) {
      const operation = this.createOperationFromChange(change);
      if (operation) {
        operation.id = uuidv4();
        operation.baseVersionVector = { ...this.localVersionVector };
        this.pendingOperations.set(operation.id, operation);

        // Increment local version for our own operation
        this.incrementLocalVersion();

        console.log("Created operation:", operation);
        this.operationCallback(operation);
      }
    }
  }

  private incrementLocalVersion(): void {
    this.localVersionVector[this.userId] =
      (this.localVersionVector[this.userId] || 0) + 1;
  }

  private createOperationFromChange(
    change: editor.IModelContentChange
  ): TextOperation | null {
    const position = change.rangeOffset;
    const length = change.rangeLength;
    const text = change.text;

    // Special handling for newlines to ensure they're preserved
    const normalizedText = text.replace(/\r\n/g, "\n");

    let type: OperationType;
    if (length === 0 && normalizedText.length > 0) {
      type = OperationType.INSERT;
    } else if (length > 0 && normalizedText.length === 0) {
      type = OperationType.DELETE;
    } else if (length > 0 && normalizedText.length > 0) {
      type = OperationType.REPLACE;
    } else {
      return null;
    }

    const operation: TextOperation = {
      type,
      position,
      text: normalizedText.length > 0 ? normalizedText : undefined,
      length: length > 0 ? length : undefined,
      baseVersionVector: {},
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

  public applyOperation(operation: TextOperation): void {
    console.log("Applying operation:", operation);

    // Handle local operations (acknowledged by server)
    if (operation.userId === this.userId) {
      if (operation.id && this.pendingOperations.has(operation.id)) {
        this.pendingOperations.delete(operation.id);
      }
      this.updateVersionVector(operation.baseVersionVector);
      console.log("Updated local version vector:", this.localVersionVector);
      return;
    }

    // Save cursor position before applying remote operation
    const previousSelections = this.editor.getSelections() || [];

    // For remote operations
    this.updateVersionVector(operation.baseVersionVector);
    const concurrentOps = this.findConcurrentOperations(operation);

    // Sort concurrent operations for consistent transformation
    concurrentOps.sort((a, b) => {
      // First by user ID for consistency
      const userCompare = a.userId.localeCompare(b.userId);
      if (userCompare !== 0) return userCompare;

      // Then by version number
      const versionA = a.baseVersionVector[a.userId] || 0;
      const versionB = b.baseVersionVector[b.userId] || 0;
      return versionA - versionB;
    });

    // Transform the operation against all concurrent operations
    let transformedOperation = operation.clone
      ? operation.clone()
      : { ...operation };
    for (const concurrentOp of concurrentOps) {
      transformedOperation = this.transformOperation(
        transformedOperation,
        concurrentOp
      );
    }

    this.validateOperation(transformedOperation);

    // Apply the transformed operation to the editor
    this.isApplyingExternalOperation = true;
    try {
      // Prepare the edit operation
      const edits: editor.IIdentifiedSingleEditOperation[] = [];
      const range = this.getOperationRange(transformedOperation);

      if (transformedOperation.type === OperationType.INSERT) {
        edits.push({
          range,
          text: transformedOperation.text || "",
          forceMoveMarkers: false, // This is important for cursor handling
        });
      } else if (transformedOperation.type === OperationType.DELETE) {
        edits.push({
          range,
          text: "",
          forceMoveMarkers: false,
        });
      } else if (transformedOperation.type === OperationType.REPLACE) {
        edits.push({
          range,
          text: transformedOperation.text || "",
          forceMoveMarkers: false,
        });
      }

      // Calculate how this operation affects our existing selections
      const transformedSelections = this.transformSelections(
        previousSelections,
        transformedOperation
      );

      // Apply the edit while preserving selections
      this.model.pushEditOperations(
        previousSelections,
        edits,
        () => transformedSelections
      );

      // Add the operation to history
      this.operationHistory.push(transformedOperation);
      if (this.operationHistory.length > 100) {
        this.operationHistory.shift();
      }

      console.log(
        "Editor updated, new version vector:",
        this.localVersionVector
      );
    } finally {
      this.isApplyingExternalOperation = false;
    }
  }

  private transformSelections(
    selections: Selection[],
    operation: TextOperation
  ): Selection[] {
    if (!selections || selections.length === 0) {
      return [];
    }

    return selections.map((selection) => {
      const startOffset = this.model.getOffsetAt({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      });
      const endOffset = this.model.getOffsetAt({
        lineNumber: selection.endLineNumber,
        column: selection.endColumn,
      });

      // Transform start and end positions
      let newStartOffset = this.transformCursorPosition(startOffset, operation);
      let newEndOffset = this.transformCursorPosition(endOffset, operation);

      // Convert back to line/column positions
      const newStartPos = this.model.getPositionAt(newStartOffset);
      const newEndPos = this.model.getPositionAt(newEndOffset);

      return new Selection(
        newStartPos.lineNumber,
        newStartPos.column,
        newEndPos.lineNumber,
        newEndPos.column
      );
    });
  }

  private transformCursorPosition(
    cursorOffset: number,
    operation: TextOperation
  ): number {
    if (operation.type === OperationType.INSERT) {
      if (cursorOffset < operation.position) {
        return cursorOffset;
      } else {
        return cursorOffset + (operation.text?.length || 0);
      }
    } else if (operation.type === OperationType.DELETE && operation.length) {
      if (cursorOffset <= operation.position) {
        return cursorOffset;
      } else if (cursorOffset <= operation.position + operation.length) {
        return operation.position;
      } else {
        return cursorOffset - operation.length;
      }
    } else if (operation.type === OperationType.REPLACE && operation.length) {
      if (cursorOffset <= operation.position) {
        return cursorOffset;
      } else if (cursorOffset <= operation.position + operation.length) {
        // If cursor is in the replaced region, move it to the end of the new text
        return operation.position + (operation.text?.length || 0);
      } else {
        // If cursor is after the replaced region, adjust it by the difference in length
        const lengthDiff = (operation.text?.length || 0) - operation.length;
        return cursorOffset + lengthDiff;
      }
    }
    return cursorOffset;
  }

  private getOperationRange(operation: TextOperation): IRange {
    const startPosition = this.model.getPositionAt(operation.position);
    let endPosition =
      operation.length && operation.length > 0
        ? this.model.getPositionAt(operation.position + operation.length)
        : startPosition;

    return {
      startLineNumber: startPosition.lineNumber,
      startColumn: startPosition.column,
      endLineNumber: endPosition.lineNumber,
      endColumn: endPosition.column,
    };
  }

  public acknowledgeOperation(ack: OperationAck): void {
    console.log("Operation acknowledged:", ack);
    if (this.pendingOperations.has(ack.operationId)) {
      this.pendingOperations.delete(ack.operationId);
    }
    this.updateVersionVector(ack.baseVersionVector);
    console.log("Updated local version vector:", this.localVersionVector);
  }

  public getVersionVector(): VersionVector {
    return { ...this.localVersionVector };
  }

  public setVersionVector(vector: VersionVector): void {
    this.localVersionVector = { ...vector };
    console.log("Version vector set to:", this.localVersionVector);
  }

  private findConcurrentOperations(operation: TextOperation): TextOperation[] {
    const concurrent: TextOperation[] = [];
    for (const [_, pendingOp] of this.pendingOperations) {
      if (this.isConcurrent(operation, pendingOp)) {
        concurrent.push(pendingOp);
      }
    }
    return concurrent;
  }

  private isConcurrent(a: TextOperation, b: TextOperation): boolean {
    return !this.happenedBefore(a, b) && !this.happenedBefore(b, a);
  }

  private happenedBefore(a: TextOperation, b: TextOperation): boolean {
    // Check if a happened before b
    for (const userId in b.baseVersionVector) {
      const aVersion = a.baseVersionVector[userId] || 0;
      const bVersion = b.baseVersionVector[userId] || 0;

      if (aVersion > bVersion) {
        return false;
      }
    }

    // Check if a made changes that b doesn't know about
    let madeChanges = false;
    for (const userId in a.baseVersionVector) {
      const aVersion = a.baseVersionVector[userId] || 0;
      const bVersion = b.baseVersionVector[userId] || 0;

      if (aVersion > bVersion) {
        madeChanges = true;
        break;
      }
    }

    return madeChanges;
  }

  private updateVersionVector(newVector: VersionVector): void {
    for (const userId in newVector) {
      const newVersion = newVector[userId];
      const currentVersion = this.localVersionVector[userId] || 0;
      this.localVersionVector[userId] = Math.max(currentVersion, newVersion);
    }
  }

  private transformOperation(
    a: TextOperation,
    b: TextOperation
  ): TextOperation {
    let transformedA = a.clone ? a.clone() : { ...a };
    const originalA = a;

    if (!transformedA.clone) {
      transformedA.clone = function () {
        const clone = { ...this };
        clone.baseVersionVector = { ...this.baseVersionVector };
        clone.clone = this.clone;
        return clone;
      };
    }

    if (a.id === b.id) return transformedA;

    switch (b.type) {
      case OperationType.INSERT:
        transformedA.position = this.transformPosition(
          transformedA.position,
          b.position,
          b.text?.length || 0,
          true,
          originalA.userId,
          b.userId
        );

        // If we're deleting/replacing text and the insert happened within our range
        if (
          (transformedA.type === OperationType.DELETE ||
            transformedA.type === OperationType.REPLACE) &&
          transformedA.length !== undefined
        ) {
          const aEnd = transformedA.position + transformedA.length;
          if (b.position >= transformedA.position && b.position <= aEnd) {
            transformedA.length += b.text?.length || 0;
          }
        }
        break;

      case OperationType.DELETE:
        if (b.length === undefined) break;

        transformedA.position = this.transformPositionAgainstDelete(
          transformedA.position,
          b.position,
          b.length
        );

        if (
          (transformedA.type === OperationType.DELETE ||
            transformedA.type === OperationType.REPLACE) &&
          transformedA.length !== undefined
        ) {
          transformedA.length = this.transformLengthAgainstDelete(
            transformedA.position,
            transformedA.length,
            b.position,
            b.length
          );
        }
        break;

      case OperationType.REPLACE:
        // Handle replace as delete followed by insert
        if (b.length === undefined || b.text === undefined) break;

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

        const tempTransformedA = this.transformOperation(
          transformedA,
          deletePartOfB
        );
        transformedA = this.transformOperation(tempTransformedA, insertPartOfB);
        break;
    }

    return transformedA;
  }

  private transformPosition(
    position: number,
    otherPosition: number,
    otherLength: number,
    isInsert: boolean,
    clientUserId: string,
    serverUserId: string
  ): number {
    if (position < otherPosition) {
      return position;
    } else if (position === otherPosition && isInsert) {
      // Add more robust tie-breaking logic here, but still using existing parameters
      const userCompare = clientUserId.localeCompare(serverUserId);

      // If the user IDs are the same, deterministically choose based on operation type
      // This is a simple but consistent approach using what's available
      if (userCompare === 0) {
        // Use a property that's already available to break the tie
        // For example, whether it came from the client or server
        return isInsert ? position : position + otherLength;
      }

      return userCompare < 0 ? position : position + otherLength;
    } else {
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
      return position;
    } else if (position >= deletePos + deleteLen) {
      return position - deleteLen;
    } else {
      return deletePos;
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

    // Delete entirely contains operation
    if (pos >= deletePos && endPos <= deleteEndPos) {
      return 0;
    }

    // Operation entirely contains delete
    if (pos <= deletePos && endPos >= deleteEndPos) {
      return len - deleteLen;
    }

    // Delete overlaps with start of operation
    if (pos < deletePos && endPos > deletePos && endPos <= deleteEndPos) {
      return deletePos - pos;
    }

    // Delete overlaps with end of operation
    if (pos >= deletePos && pos < deleteEndPos && endPos > deleteEndPos) {
      return endPos - deleteEndPos;
    }

    // Shouldn't get here
    return 0;
  }

  private validateOperation(operation: TextOperation): void {
    const maxPos = this.model.getValueLength();
    if (operation.position < 0) {
      operation.position = 0;
    }
    if (operation.length !== undefined && operation.length < 0) {
      operation.length = 0;
    }
    if (operation.position > maxPos) {
      operation.position = maxPos;
    }
    if (
      operation.length !== undefined &&
      operation.position + operation.length > maxPos
    ) {
      operation.length = maxPos - operation.position;
    }
  }
}
