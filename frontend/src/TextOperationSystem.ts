import { editor, IRange, Selection } from "monaco-editor";
import { v4 as uuidv4 } from "uuid";

export enum OperationType {
  INSERT = "INSERT",
  DELETE = "DELETE",
  REPLACE = "REPLACE",
}

export class VersionVector {
  private versions: { [userId: string]: number };

  constructor(initialVersions?: { [userId: string]: number } | null) {
    this.versions = initialVersions ? { ...initialVersions } : {};
  }

  // Get the versions map
  getVersions(): { [userId: string]: number } {
    return { ...this.versions };
  }

  // Set the versions map
  setVersions(versions: { [userId: string]: number } | null): void {
    this.versions = versions ? { ...versions } : {};
  }

  // Update a user's version - matches Java implementation
  update(userId: string, version: number): void {
    const safeVersion = Math.max(0, version);
    const current = this.versions[userId] || 0;
    this.versions[userId] = Math.max(current, safeVersion);
  }

  // Check if this vector is concurrent with another - matches Java implementation
  concurrent(other: VersionVector): boolean {
    if (!other || !other.getVersions()) {
      return true;
    }

    return !this.happenedBefore(other) && !other.happenedBefore(this);
  }

  private happenedBefore(other: VersionVector): boolean {
    if (!other || !other.getVersions()) {
      return false;
    }
    const thisVersions = this.versions;
    const otherVersions = other.getVersions();

    let allLeq = true;
    let existsLess = false;
    const allUserIds = new Set([
      ...Object.keys(thisVersions),
      ...Object.keys(otherVersions),
    ]);

    for (const userId of allUserIds) {
      const thisV = thisVersions[userId] || 0;
      const otherV = otherVersions[userId] || 0;
      if (thisV > otherV) {
        allLeq = false;
        break;
      }
      if (thisV < otherV) {
        existsLess = true;
      }
    }

    return allLeq && existsLess;
  }

  // Merge this vector with another, taking the maximum version for each user
  merge(other: VersionVector): VersionVector {
    if (!other || !other.getVersions()) {
      return new VersionVector(this.versions);
    }

    const result = new VersionVector(this.versions);
    const otherVersions = other.getVersions();

    for (const userId in otherVersions) {
      const otherVersion = otherVersions[userId] || 0;
      const thisVersion = this.versions[userId] || 0;
      result.versions[userId] = Math.max(
        0,
        Math.max(thisVersion, otherVersion)
      );
    }

    for (const userId in result.versions) {
      result.versions[userId] = Math.max(0, result.versions[userId]);
    }

    return result;
  }

  // For debugging
  toString(): string {
    return JSON.stringify(this.versions);
  }
}

export interface TextOperation {
  id?: string;
  type: OperationType;
  position: number;
  text?: string;
  length?: number;
  baseVersionVector: { [userId: string]: number }; // Keep as raw object for serialization
  userId: string;
}

export interface OperationAck {
  operationId: string;
  versionVector: { versions: { [userId: string]: number } };
  userId: string;
}

export class TextOperationManager {
  private editor: editor.IStandaloneCodeEditor;
  private model: editor.ITextModel;
  private localVersionVector: VersionVector;
  private pendingOperations: Map<string, TextOperation> = new Map();
  private operationHistory: TextOperation[] = [];
  private userId: string;
  private operationCallback: (op: TextOperation) => void;
  private isApplyingExternalOperation: boolean = false;
  private lastCursorState: editor.ICursorState[] | null = null;

  constructor(
    editor: editor.IStandaloneCodeEditor,
    userId: string,
    initialVersionVector: { [userId: string]: number } = {},
    operationCallback: (op: TextOperation) => void
  ) {
    this.editor = editor;
    this.model = editor.getModel()!;
    this.userId = userId;
    this.localVersionVector = new VersionVector(
      typeof initialVersionVector === "object" && initialVersionVector !== null
        ? initialVersionVector
        : {}
    );
    this.operationCallback = operationCallback;

    // Initialize user's version if not present
    if (!this.localVersionVector.getVersions()[userId]) {
      this.localVersionVector.update(userId, 0);
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
      this.localVersionVector.toString()
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
        operation.baseVersionVector = this.localVersionVector.getVersions();
        this.pendingOperations.set(operation.id, operation);

        // Increment local version for our own operation
        this.incrementLocalVersion();

        console.log("Created operation:", operation);
        this.operationCallback(operation);
      }
    }
  }

  private incrementLocalVersion(): void {
    const versions = this.localVersionVector.getVersions();
    const currentVersion = versions[this.userId] || 0;
    this.localVersionVector.update(this.userId, currentVersion + 1);
  }

  private createOperationFromChange(
    change: editor.IModelContentChange
  ): TextOperation | null {
    const position = change.rangeOffset;
    let length = change.rangeLength; // Get length from event first
    const text = change.text;
    const normalizedText = text.replace(/\r\n/g, "\n");

    let type: OperationType;
    if (length === 0 && normalizedText.length > 0) {
      type = OperationType.INSERT;
    } else if (length > 0 && normalizedText.length === 0) {
      type = OperationType.DELETE;
      // Potential Workaround: Re-check length for full document deletes?
      // if (position === 0) {
      //   const currentModelLength = this.model.getValueLength();
      //   if (length !== currentModelLength) {
      //      console.warn(`DELETE rangeLength (${length}) from event differs from current model length (${currentModelLength}). Using current length.`);
      //      length = currentModelLength; // Use potentially more up-to-date length
      //   }
      // }
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
    };
    return operation;
  }

  public applyOperation(operation: TextOperation): void {
    console.log("Applying operation:", operation);

    // For remote operations
    if (operation.userId !== this.userId) {
      // Save cursor position before applying remote operation
      const previousSelections = this.editor.getSelections() || [];

      // Find concurrent operations and sort them
      const concurrentOps = this.findConcurrentOperations(operation);
      this.sortOperations(concurrentOps);

      // Transform the operation against all concurrent operations
      let transformedOperation = this.cloneOperation(operation);
      for (const concurrentOp of concurrentOps) {
        transformedOperation = this.transformOperation(
          this.cloneOperation(transformedOperation),
          this.cloneOperation(concurrentOp)
        );
      }

      this.validateOperation(transformedOperation);

      // Apply the transformed operation
      this.isApplyingExternalOperation = true;
      try {
        const edits: editor.IIdentifiedSingleEditOperation[] = [];
        const range = this.getOperationRange(transformedOperation);

        if (transformedOperation.type === OperationType.INSERT) {
          edits.push({
            range,
            text: transformedOperation.text || "",
            forceMoveMarkers: true, // Changed to true to ensure consistent marker behavior
          });
        } else if (transformedOperation.type === OperationType.DELETE) {
          edits.push({
            range,
            text: "",
            forceMoveMarkers: true, // Changed to true to ensure consistent marker behavior
          });
        } else if (transformedOperation.type === OperationType.REPLACE) {
          edits.push({
            range,
            text: transformedOperation.text || "",
            forceMoveMarkers: true, // Changed to true to ensure consistent marker behavior
          });
        }

        // Transform selections against the operation
        const transformedSelections = this.transformSelections(
          previousSelections,
          transformedOperation
        );

        this.model.pushEditOperations(
          previousSelections,
          edits,
          () => transformedSelections
        );

        this.operationHistory.push(transformedOperation);
        if (this.operationHistory.length > 100) {
          this.operationHistory.shift();
        }
      } finally {
        this.isApplyingExternalOperation = false;
      }
    }

    // Update version vector for both local and remote operations
    if (operation.id && this.pendingOperations.has(operation.id)) {
      // This handles the case where a local operation is echoed back
      // We remove it from pending, but the main vector update happens in acknowledgeOperation
      this.pendingOperations.delete(operation.id);
    }
    console.log(
      "Local version vector after applyOperation (no merge for remote):",
      this.localVersionVector.toString()
    );
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
    switch (operation.type) {
      case OperationType.INSERT:
        if (cursorOffset < operation.position) {
          // Cursor is before the insert point - no change
          return cursorOffset;
        } else if (cursorOffset === operation.position) {
          // Cursor is exactly at the insert point - use the same tie-breaking logic
          // as operation transformation for consistency
          if (this.userId === operation.userId) {
            // Same user, place after insert
            return cursorOffset + (operation.text?.length || 0);
          } else {
            const comparison = this.userId.localeCompare(operation.userId);
            if (comparison <= 0) {
              // Our ID is smaller, place before
              return cursorOffset;
            } else {
              // Our ID is larger, place after
              return cursorOffset + (operation.text?.length || 0);
            }
          }
        } else {
          // Cursor is after the insert point - shift it
          return cursorOffset + (operation.text?.length || 0);
        }

      case OperationType.DELETE:
        if (!operation.length) return cursorOffset;

        if (cursorOffset <= operation.position) {
          // Cursor is before or at the delete start - no change
          return cursorOffset;
        } else if (cursorOffset <= operation.position + operation.length) {
          // Cursor is within the deleted range - move to the start of deletion
          return operation.position;
        } else {
          // Cursor is after the deletion - shift it left
          return cursorOffset - operation.length;
        }

      case OperationType.REPLACE:
        if (!operation.length) return cursorOffset;

        if (cursorOffset <= operation.position) {
          // Cursor is before the replace - no change
          return cursorOffset;
        } else if (cursorOffset <= operation.position + operation.length) {
          // Cursor is within the replaced region - move to the end of the new text
          // This is a common strategy for replace operations
          return operation.position + (operation.text?.length || 0);
        } else {
          // Cursor is after the replaced region - adjust by the difference in length
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
    this.updateVersionVector(ack.versionVector.versions);
    console.log(
      "Updated local version vector:",
      this.localVersionVector.toString()
    );
  }

  public getVersionVector(): { [userId: string]: number } {
    return this.localVersionVector.getVersions();
  }

  public setVersionVector(vector: { [userId: string]: number }): void {
    this.localVersionVector = new VersionVector(vector);
    console.log("Version vector set to:", this.localVersionVector.toString());
  }

  private findConcurrentOperations(incomingOp: TextOperation): TextOperation[] {
    const concurrent: TextOperation[] = [];
    // Use the versions map directly from the incoming operation's base vector
    const incomingVectorMap = incomingOp.baseVersionVector || {}; // Note: Assuming structure { userId: version }

    console.log(
      `Finding concurrent ops for incoming ${incomingOp.id} (User ${
        incomingOp.userId
      }) with VV ${JSON.stringify(incomingVectorMap)}`
    );

    for (const [_, pendingOp] of this.pendingOperations) {
      // Skip transforming an incoming op against its own echo
      if (
        incomingOp.id &&
        pendingOp.id === incomingOp.id &&
        incomingOp.userId === pendingOp.userId
      ) {
        console.log(
          ` - Skipping pending op ${pendingOp.id} (matches incoming op)`
        );
        continue;
      }

      // Get the base vector map of the local pending operation
      const pendingVectorMap = pendingOp.baseVersionVector || {}; // Note: Assuming structure { userId: version }
      const pendingUserId = pendingOp.userId;

      // Get the version of the pending op's user *when the pending op was created*
      const pendingOpUserVersionAtCreation =
        pendingVectorMap[pendingUserId] || 0;

      // Get the version of the pending op's user as known by the *incoming operation's base state*
      const pendingOpUserVersionInIncoming =
        incomingVectorMap[pendingUserId] || 0;

      // If the incoming operation's state knows a version for the pending op's user
      // that is strictly less than the version *after* the pending op would have been applied (creation version + 1),
      // it means the server processed the incoming operation without having processed our pending operation.
      // Thus, the client needs to transform the incoming op against the pending op.
      if (pendingOpUserVersionInIncoming < pendingOpUserVersionAtCreation + 1) {
        console.log(
          ` -> Found concurrent pending op ${pendingOp.id} (User ${pendingUserId}, created after ver ${pendingOpUserVersionAtCreation})`
        );
        console.log(
          `    Incoming op VV knows User ${pendingUserId} state: ${pendingOpUserVersionInIncoming}`
        );
        concurrent.push(this.cloneOperation(pendingOp));
      } else {
        console.log(
          ` - Skipping pending op ${pendingOp.id} (User ${pendingUserId}, created after ver ${pendingOpUserVersionAtCreation}). Incoming op VV knows state ${pendingOpUserVersionInIncoming}`
        );
      }
    }

    // Sort the identified concurrent pending operations for deterministic transformation order.
    // Sort by user ID, then by the operation's effective sequence number (base version + 1) for that user.
    concurrent.sort((a, b) => {
      const userCompare = a.userId.localeCompare(b.userId);
      if (userCompare !== 0) return userCompare;

      // Use baseVersionVector for sorting
      const aVersion = a.baseVersionVector?.[a.userId] || 0;
      const bVersion = b.baseVersionVector?.[b.userId] || 0;
      // Sort based on the version *after* the operation: base version + 1
      return aVersion + 1 - (bVersion + 1);
    });

    if (concurrent.length > 0) {
      console.log(
        ` -> Incoming op ${incomingOp.id} (User ${
          incomingOp.userId
        }) will be transformed against ${
          concurrent.length
        } pending operations: [${concurrent.map((op) => op.id).join(", ")}]`
      );
    }

    return concurrent;
  }

  private updateVersionVector(
    newVersions: { [userId: string]: number } | null
  ): void {
    if (!newVersions) {
      console.warn(
        "Received null or undefined version vector map to merge.",
        new Error().stack
      );
      return;
    }
    const cleanVectorData =
      typeof newVersions.versions === "object" && newVersions.versions !== null
        ? newVersions.versions
        : newVersions;

    const vectorToMerge = new VersionVector(cleanVectorData);
    this.localVersionVector = this.localVersionVector.merge(vectorToMerge);
    console.log(
      "Merged vector, new local vector:",
      this.localVersionVector.toString()
    );
  }

  private sortOperations(operations: TextOperation[]): void {
    operations.sort((a, b) => {
      // First compare by user ID for consistency
      const userCompare = a.userId.localeCompare(b.userId);
      if (userCompare !== 0) return userCompare;

      // Then by version number if from same user
      const aVersion = a.baseVersionVector[a.userId] || 0;
      const bVersion = b.baseVersionVector[b.userId] || 0;
      return aVersion - bVersion;
    });
  }

  private transformOperation(
    a: TextOperation,
    b: TextOperation
  ): TextOperation {
    let transformedA = this.cloneOperation(a);

    // No need to transform if same op ID (already handled by concurrency check generally)
    // Although IDs might differ if backend reconstructs ops, rely on VV check mostly
    if (a.id === b.id && a.userId === b.userId) {
      console.warn("Attempting to transform operation against itself:", a.id);
      return transformedA;
    }

    switch (
      transformedA.type // Use transformedA here to modify the clone
    ) {
      case OperationType.INSERT:
        if (b.type === OperationType.INSERT) {
          transformedA.position = this.transformPosition(
            transformedA.position,
            b.position,
            b.text?.length || 0,
            true, // isInsert flag (for b)
            a.userId, // client user id (a's user)
            b.userId // server user id (b's user)
          );
        } else if (b.type === OperationType.DELETE && b.length !== undefined) {
          transformedA.position = this.transformPositionAgainstDelete(
            transformedA.position,
            b.position,
            b.length
          );
        } else if (b.type === OperationType.REPLACE && b.length !== undefined) {
          // Decompose concurrent REPLACE (b) into Delete then Insert
          const deletePartOfB: TextOperation = {
            type: OperationType.DELETE,
            position: b.position,
            length: b.length,
            baseVersionVector: { ...b.baseVersionVector },
            userId: b.userId,
            id: b.id ? `${b.id}-delete` : undefined,
          };
          const insertPartOfB: TextOperation = {
            type: OperationType.INSERT,
            position: b.position,
            text: b.text || "",
            baseVersionVector: { ...b.baseVersionVector },
            userId: b.userId,
            id: b.id ? `${b.id}-insert` : undefined,
          };
          // Transform against delete part first
          let tempTransformedA = this.transformOperation(
            this.cloneOperation(transformedA),
            deletePartOfB
          );
          // Then transform the result against the insert part
          transformedA = this.transformOperation(
            tempTransformedA,
            insertPartOfB
          );
        }
        break;

      case OperationType.DELETE:
        if (transformedA.length === undefined) {
          console.warn("DELETE operation has undefined length:", transformedA);
          transformedA.length = 0; // Avoid break, try to recover
        }

        if (b.type === OperationType.INSERT) {
          // Store original position before transforming position
          const originalPosForLengthCalc = transformedA.position;
          // Adjust delete position based on the concurrent insert
          transformedA.position = this.transformPosition(
            transformedA.position,
            b.position,
            b.text?.length || 0,
            true, // isInsert flag (for b)
            a.userId, // client user id (a's user)
            b.userId // server user id (b's user)
          );
          // Adjust delete length if the insert happened inside the delete range
          // Use the original position to determine overlap correctly before position was shifted
          transformedA.length = this.transformLengthForInsert(
            originalPosForLengthCalc,
            transformedA.length || 0, // Use current length
            b.position,
            b.text?.length || 0
          );
        } else if (b.type === OperationType.DELETE && b.length !== undefined) {
          // Store original position before transforming position
          const originalPosForLengthCalc = transformedA.position;
          // Adjust delete position based on concurrent delete
          transformedA.position = this.transformPositionAgainstDelete(
            transformedA.position,
            b.position,
            b.length
          );
          // Adjust length based on overlap with concurrent delete
          // Use the original position to determine overlap correctly
          transformedA.length = this.transformLengthAgainstDelete(
            originalPosForLengthCalc,
            transformedA.length || 0, // Use current length
            b.position,
            b.length
          );
        } else if (b.type === OperationType.REPLACE && b.length !== undefined) {
          // Decompose concurrent REPLACE (b) into Delete then Insert
          const deletePartOfB: TextOperation = {
            type: OperationType.DELETE,
            position: b.position,
            length: b.length,
            baseVersionVector: { ...b.baseVersionVector },
            userId: b.userId,
            id: b.id ? `${b.id}-delete` : undefined,
          };
          const insertPartOfB: TextOperation = {
            type: OperationType.INSERT,
            position: b.position,
            text: b.text || "",
            baseVersionVector: { ...b.baseVersionVector },
            userId: b.userId,
            id: b.id ? `${b.id}-insert` : undefined,
          };
          // Transform against delete part first
          let tempTransformedA = this.transformOperation(
            this.cloneOperation(transformedA),
            deletePartOfB
          );
          // Then transform the result against the insert part
          transformedA = this.transformOperation(
            tempTransformedA,
            insertPartOfB
          );
        }

        // If length becomes 0, it might become a no-op
        if (transformedA.length !== undefined && transformedA.length <= 0) {
          transformedA.length = 0;
          // Note: An operation with length 0 might still be relevant if its position changed
        }
        break;

      case OperationType.REPLACE:
        // Decompose the operation being transformed (a) into Delete and Insert parts
        // Ensure original parts have length/text defined if they exist
        const deletePartOfA: TextOperation = {
          id: a.id ? `${a.id}-del` : undefined,
          type: OperationType.DELETE,
          position: a.position,
          length: a.length || 0, // Ensure length is defined
          baseVersionVector: { ...a.baseVersionVector },
          userId: a.userId,
        };
        const insertPartOfA: TextOperation = {
          id: a.id ? `${a.id}-ins` : undefined,
          type: OperationType.INSERT,
          position: a.position,
          text: a.text || "", // Ensure text is defined
          baseVersionVector: { ...a.baseVersionVector },
          userId: a.userId,
        };

        // Transform the delete part of A against B
        const transformedDeletePart = this.transformOperation(
          this.cloneOperation(deletePartOfA),
          this.cloneOperation(b)
        );

        // Transform the insert part of A against B
        const transformedInsertPart = this.transformOperation(
          this.cloneOperation(insertPartOfA),
          this.cloneOperation(b)
        );

        // Reconstruct the transformed Replace operation
        transformedA.position = transformedDeletePart.position; // Use position from transformed delete part
        transformedA.length = transformedDeletePart.length; // Use length from transformed delete part
        transformedA.text = transformedInsertPart.text; // Use text from transformed insert part

        // --- Determine final type based on transformed parts ---

        // If the delete part's length became 0 AND insert text exists: operation is now an Insert
        if (
          transformedA.length !== undefined &&
          transformedA.length <= 0 &&
          transformedA.text &&
          transformedA.text.length > 0
        ) {
          transformedA.type = OperationType.INSERT;
          transformedA.length = undefined; // No length for insert
          transformedA.position = transformedInsertPart.position; // Use insert's transformed position for clarity
        }
        // If the insert part's text became empty AND delete length > 0: operation is now a Delete
        else if (
          (!transformedA.text || transformedA.text.length === 0) &&
          transformedA.length !== undefined &&
          transformedA.length > 0
        ) {
          transformedA.type = OperationType.DELETE;
          transformedA.text = undefined; // No text for delete
        }
        // If BOTH delete length is 0 AND insert text is empty: it's a NO-OP in content.
        // We might still need to apply it if the position changed relative to other ops,
        // but often can be discarded. For now, keep it as REPLACE with 0 length/empty text.
        // Application logic should ideally handle this gracefully.
        else if (
          transformedA.length !== undefined &&
          transformedA.length <= 0 &&
          (!transformedA.text || transformedA.text.length === 0)
        ) {
          // Mark as effectively NO-OP? Or let apply handle it.
          transformedA.length = 0;
          transformedA.text = "";
        }
        // Otherwise, it remains a REPLACE

        break;
    }

    return transformedA;
  }

  // Helper function added to match backend logic for transforming DELETE/REPLACE length against INSERT
  private transformLengthForInsert(
    opPos: number,
    opLen: number,
    insertPos: number,
    insertLen: number
  ): number {
    if (opLen === undefined) return 0; // Safety check

    if (insertPos <= opPos) {
      // Insert before op starts: length unchanged
      return opLen;
    } else if (insertPos >= opPos && insertPos < opPos + opLen) {
      // Insert strictly within op's range (inclusive start, exclusive end): length increases
      return opLen + insertLen;
    } else {
      // Insert at or after op ends: length unchanged
      return opLen;
    }
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
    } else if (position === otherPosition) {
      // Use exact same comparison as backend for consistency
      const comparison = clientUserId.localeCompare(serverUserId, "en"); // Force 'en' locale for consistent behavior
      return comparison <= 0 ? position : position + otherLength;
    } else {
      return position + otherLength;
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

    // Ensure operation has valid ID
    if (!operation.id) {
      operation.id = uuidv4();
      console.warn(`Generated missing operation ID: ${operation.id}`);
    }

    // Ensure user ID is valid
    if (!operation.userId) {
      operation.userId = "anonymous";
      console.warn("Set missing user ID to anonymous");
    }

    // Position validation
    if (operation.position < 0) {
      operation.position = 0;
      console.warn("Adjusted negative position to 0");
    }

    if (operation.position > maxPos) {
      operation.position = maxPos;
      console.warn(
        `Adjusted out-of-bounds position to document length: ${maxPos}`
      );
    }

    // Length validation for DELETE and REPLACE
    if (
      operation.type === OperationType.DELETE ||
      operation.type === OperationType.REPLACE
    ) {
      if (operation.length === undefined) {
        operation.length = 0;
        console.warn("Set undefined length to 0");
      }

      if (operation.length < 0) {
        operation.length = 0;
        console.warn("Adjusted negative length to 0");
      }

      const endPos = operation.position + operation.length;
      if (endPos > maxPos) {
        operation.length = maxPos - operation.position;
        console.warn(`Adjusted out-of-bounds length to: ${operation.length}`);
      }
    }

    // Text validation for INSERT and REPLACE
    if (
      operation.type === OperationType.INSERT ||
      operation.type === OperationType.REPLACE
    ) {
      if (operation.text === undefined) {
        operation.text = "";
        console.warn("Set undefined text to empty string");
      }
    }

    // Make sure base version vector exists
    if (!operation.baseVersionVector) {
      operation.baseVersionVector = {};
      console.warn("Created missing base version vector");
    }
  }

  private cloneOperation(op: TextOperation): TextOperation {
    const clone = { ...op };
    clone.baseVersionVector = op.baseVersionVector
      ? { ...op.baseVersionVector }
      : {};
    return clone;
  }
}
