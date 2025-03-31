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
  timestamp?: number; // Timestamp when the operation was created
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
  private pendingLocalOperations: Map<string, TextOperation> = new Map();
  private pendingRemoteOperations: Map<number, TextOperation[]> = new Map();
  private userId: string;
  private operationCallback: (op: TextOperation) => void;
  private isApplyingExternalOperation: boolean = false;
  private isProcessingQueue: boolean = false;

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
        // Generate a unique ID for this operation
        const operationId = `${this.userId}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        operation.id = operationId;
        operation.timestamp = Date.now();

        // Add to pending local operations
        this.pendingLocalOperations.set(operationId, operation);

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
   * Processes an incoming operation from the server
   */
  public applyOperation(operation: TextOperation): void {
    console.log(
      `Received operation: ${operation.type} at version ${operation.version}, current version is ${this.localVersion}`
    );

    // If this is our own operation coming back from the server, just update tracking
    if (operation.userId === this.userId) {
      // Make sure we're not reprocessing something we've already seen
      if (this.pendingLocalOperations.has(operation.id!)) {
        this.pendingLocalOperations.delete(operation.id!);
        console.log(`Acknowledged our operation: ${operation.id}`);
      }
      return;
    }

    // If the operation is for exactly the next version we expect, apply it immediately
    if (operation.version === this.localVersion + 1) {
      this.applyOperationDirectly(operation);
      this.localVersion = operation.version;

      // See if we can process any queued operations now
      this.processRemoteOperationQueue();
    }
    // If the operation is for a future version, queue it
    else if (operation.version > this.localVersion + 1) {
      console.log(`Queueing operation for future version ${operation.version}`);
      const pendingList =
        this.pendingRemoteOperations.get(operation.version) || [];
      pendingList.push(operation);
      this.pendingRemoteOperations.set(operation.version, pendingList);
    }
    // If the operation is for a past version, it's already outdated
    else {
      console.warn(
        `Ignoring outdated operation for version ${operation.version}, current version is ${this.localVersion}`
      );
    }
  }

  /**
   * Apply a remote operation directly to the editor
   */
  private applyOperationDirectly(operation: TextOperation): void {
    console.log(
      `Applying operation directly: ${operation.type} at position ${operation.position}`
    );

    // Flag that we're applying an external operation to prevent feedback loops
    this.isApplyingExternalOperation = true;

    try {
      // Apply the operation to the model
      const edits: editor.IIdentifiedSingleEditOperation[] = [];
      const range = this.getOperationRange(operation);

      if (operation.type === OperationType.INSERT) {
        edits.push({
          range,
          text: operation.text || "",
          forceMoveMarkers: true,
        });
      } else if (operation.type === OperationType.DELETE) {
        edits.push({
          range,
          text: "",
          forceMoveMarkers: true,
        });
      } else if (operation.type === OperationType.REPLACE) {
        edits.push({
          range,
          text: operation.text || "",
          forceMoveMarkers: true,
        });
      }

      // Apply the edits
      this.model.pushEditOperations(
        this.editor.getSelections(),
        edits,
        () => null
      );

      console.log(`Editor updated for operation ${operation.id}`);
    } catch (error) {
      console.error("Error applying operation:", error);
    } finally {
      // Reset the flag
      this.isApplyingExternalOperation = false;
    }
  }

  /**
   * Process any pending operations that are now ready
   */
  private processRemoteOperationQueue(): void {
    // Guard against recursive calls
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    try {
      let nextVersion = this.localVersion + 1;
      let processed = false;

      do {
        processed = false;

        // Check if we have any operations for the next expected version
        if (this.pendingRemoteOperations.has(nextVersion)) {
          const operations = this.pendingRemoteOperations.get(nextVersion)!;

          // Sort operations by timestamp if available to ensure consistent ordering
          operations.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

          // Apply each operation
          for (const op of operations) {
            this.applyOperationDirectly(op);
          }

          // Clean up and advance version
          this.pendingRemoteOperations.delete(nextVersion);
          this.localVersion = nextVersion;
          nextVersion++;
          processed = true;
        }
      } while (processed);
    } finally {
      this.isProcessingQueue = false;
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
    console.log(
      `Operation acknowledged: ${ack.operationId} at version ${ack.version}`
    );

    // If this is our operation, remove it from pending and update version
    if (ack.userId === this.userId) {
      // Our local version is now the acknowledged version
      this.localVersion = ack.version;
      console.log(`Updated local version to: ${this.localVersion}`);

      // Process any pending operations that might now be ready
      this.processRemoteOperationQueue();
    }
  }

  /**
   * Gets the current document version
   */
  public getVersion(): number {
    return this.localVersion;
  }

  /**
   * Sets the document version (used for initial sync)
   */
  public setVersion(version: number): void {
    this.localVersion = version;
    console.log(`Version set to: ${version}`);

    // Check if there are any queued operations we can now process
    this.processRemoteOperationQueue();
  }

  /**
   * Gets the number of pending local operations
   * (Useful for debugging or UI feedback)
   */
  public getPendingLocalOperationsCount(): number {
    return this.pendingLocalOperations.size;
  }

  /**
   * Gets the number of pending remote operations
   * (Useful for debugging or UI feedback)
   */
  public getPendingRemoteOperationsCount(): number {
    let count = 0;
    this.pendingRemoteOperations.forEach((ops) => {
      count += ops.length;
    });
    return count;
  }

  /**
   * For debugging: dump the state of pending operations
   */
  public dumpOperationState(): {
    localVersion: number;
    pendingLocalOps: number;
    pendingRemoteOps: { [version: number]: number };
  } {
    const remoteOps: { [version: number]: number } = {};
    this.pendingRemoteOperations.forEach((ops, version) => {
      remoteOps[version] = ops.length;
    });

    return {
      localVersion: this.localVersion,
      pendingLocalOps: this.pendingLocalOperations.size,
      pendingRemoteOps: remoteOps,
    };
  }
}
