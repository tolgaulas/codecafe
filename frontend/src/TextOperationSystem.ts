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

    console.log(
      "TextOperationManager initialized with version vector:",
      initialVersionVector
    );
  }

  private handleModelContentChange(e: editor.IModelContentChangedEvent): void {
    const changes = e.changes;
    changes.sort((a, b) => b.rangeOffset - a.rangeOffset);

    for (const change of changes) {
      const operation = this.createOperationFromChange(change);
      if (operation) {
        operation.id = uuidv4();
        operation.baseVersionVector = { ...this.localVersionVector };
        this.pendingOperations.set(operation.id, operation);
        console.log("Created operation:", operation);
        this.operationCallback(operation);
      }
    }
  }

  private createOperationFromChange(
    change: editor.IModelContentChange
  ): TextOperation | null {
    const position = change.rangeOffset;
    const length = change.rangeLength;
    const text = change.text;

    let type: OperationType;
    if (length === 0 && text.length > 0) {
      type = OperationType.INSERT;
    } else if (length > 0 && text.length === 0) {
      type = OperationType.DELETE;
    } else if (length > 0 && text.length > 0) {
      type = OperationType.REPLACE;
    } else {
      return null;
    }

    const operation: TextOperation = {
      type,
      position,
      text: text.length > 0 ? text : undefined,
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

    if (operation.userId === this.userId) {
      if (operation.id && this.pendingOperations.has(operation.id)) {
        this.pendingOperations.delete(operation.id);
      }
      this.updateVersionVector(operation.baseVersionVector);
      console.log("Updated local version vector:", this.localVersionVector);
      return;
    }

    this.updateVersionVector(operation.baseVersionVector);
    const concurrentOps = this.findConcurrentOperations(operation);

    concurrentOps.sort((a, b) => {
      const versionA = a.baseVersionVector[a.userId] || 0;
      const versionB = b.baseVersionVector[b.userId] || 0;
      return versionA - versionB; // Ascending order
    });

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

    this.isApplyingExternalOperation = true;
    try {
      const currentPosition = this.editor.getPosition();
      const edits: editor.IIdentifiedSingleEditOperation[] = [];
      const range = this.getOperationRange(transformedOperation);

      if (transformedOperation.type === OperationType.INSERT) {
        edits.push({
          range,
          text: transformedOperation.text || "",
          forceMoveMarkers: false,
        });
      } else if (transformedOperation.type === OperationType.DELETE) {
        edits.push({ range, text: "", forceMoveMarkers: false });
      } else if (transformedOperation.type === OperationType.REPLACE) {
        edits.push({
          range,
          text: transformedOperation.text || "",
          forceMoveMarkers: false,
        });
      }

      this.model.pushEditOperations([], edits, (_inverseEdits) => {
        if (currentPosition) {
          let newOffset = this.model.getOffsetAt(currentPosition);
          if (transformedOperation.position <= newOffset) {
            if (transformedOperation.type === OperationType.INSERT) {
              newOffset += transformedOperation.text?.length || 0;
            } else if (transformedOperation.type === OperationType.DELETE) {
              newOffset -= Math.min(
                transformedOperation.length || 0,
                newOffset - transformedOperation.position
              );
            } else if (transformedOperation.type === OperationType.REPLACE) {
              newOffset +=
                (transformedOperation.text?.length || 0) -
                (transformedOperation.length || 0);
            }
          }
          const newPosition = this.model.getPositionAt(Math.max(0, newOffset));
          return [
            new Selection(
              newPosition.lineNumber,
              newPosition.column,
              newPosition.lineNumber,
              newPosition.column
            ),
          ];
        }
        return null;
      });

      if (currentPosition) {
        const newOffset = this.model.getOffsetAt(currentPosition);
        let adjustedOffset = newOffset;
        if (transformedOperation.position <= newOffset) {
          if (transformedOperation.type === OperationType.INSERT) {
            adjustedOffset += transformedOperation.text?.length || 0;
          } else if (transformedOperation.type === OperationType.DELETE) {
            adjustedOffset -= Math.min(
              transformedOperation.length || 0,
              newOffset - transformedOperation.position
            );
          } else if (transformedOperation.type === OperationType.REPLACE) {
            adjustedOffset +=
              (transformedOperation.text?.length || 0) -
              (transformedOperation.length || 0);
          }
        }
        const newPosition = this.model.getPositionAt(
          Math.max(0, adjustedOffset)
        );
        this.editor.setPosition(newPosition);
      }

      this.operationHistory.push(transformedOperation);
      if (this.operationHistory.length > 100) {
        this.operationHistory.shift(); // Consider a TreeMap for large histories
      }

      console.log(
        "Editor updated, new version vector:",
        this.localVersionVector
      );
    } finally {
      this.isApplyingExternalOperation = false;
    }
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
    for (const userId in a.baseVersionVector) {
      const aVersion = a.baseVersionVector[userId] || 0;
      const bVersion = b.baseVersionVector[userId] || 0;
      if (aVersion > bVersion) return false;
    }
    for (const userId in a.baseVersionVector) {
      const aVersion = a.baseVersionVector[userId] || 0;
      const bVersion = b.baseVersionVector[userId] || 0;
      if (aVersion < bVersion) return true;
    }
    return false;
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
        if (
          (transformedA.type === OperationType.DELETE ||
            transformedA.type === OperationType.REPLACE) &&
          transformedA.length !== undefined
        ) {
          const aEnd = transformedA.position + transformedA.length;
          if (b.position > transformedA.position && b.position < aEnd) {
            transformedA.length += b.text?.length || 0;
          }
        }
        break;

      case OperationType.DELETE:
        transformedA.position = this.transformPositionAgainstDelete(
          transformedA.position,
          b.position,
          b.length || 0
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
            b.length || 0
          );
        }
        break;

      case OperationType.REPLACE:
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
      if (clientUserId.localeCompare(serverUserId) > 0) {
        return position + otherLength;
      } else {
        return position;
      }
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

    if (endPos <= deletePos || pos >= deleteEndPos) {
      return len;
    }
    if (pos < deletePos) {
      return deletePos - pos + Math.max(0, endPos - deleteEndPos);
    }
    if (endPos > deleteEndPos) {
      return endPos - deleteEndPos;
    }
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
