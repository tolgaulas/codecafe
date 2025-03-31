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
  private pendingOperations: TextOperation[] = [];
  private userId: string;
  private operationCallback: (op: TextOperation) => void;
  private isApplyingExternalOperation: boolean = false;
  private operationIdCounter: number = 0;

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
        const operationId = `${this.userId}-${++this.operationIdCounter}`;
        operation.id = operationId;

        // Add to pending operations
        this.pendingOperations.push(operation);

        console.log("Local operation created:", operation);

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
   * Applies a received operation from the server
   */
  public applyOperation(operation: TextOperation): void {
    console.log("Received operation from server:", operation);

    // If this is our own operation coming back from the server, update version and remove from pending
    if (operation.userId === this.userId) {
      this.handleOwnOperation(operation);
      return;
    }

    // For other users' operations, apply them to the document
    this.applyExternalOperation(operation);
  }

  /**
   * Handle our own operation coming back from the server
   */
  private handleOwnOperation(operation: TextOperation): void {
    if (!operation.id) {
      console.warn("Received own operation without ID:", operation);
      return;
    }

    // Find and remove the operation from pending operations
    const index = this.pendingOperations.findIndex(
      (op) => op.id === operation.id
    );
    if (index !== -1) {
      this.pendingOperations.splice(index, 1);
      console.log("Removed acknowledged operation from pending:", operation.id);
    }

    // Update local version
    if (operation.version > this.localVersion) {
      this.localVersion = operation.version;
      console.log("Updated local version to:", this.localVersion);
    }
  }

  /**
   * Apply an operation from another user
   */
  private applyExternalOperation(operation: TextOperation): void {
    console.log("Applying external operation:", operation);

    // Set flag to prevent triggering our own change handler
    this.isApplyingExternalOperation = true;

    try {
      // Convert operation to Monaco editor edit
      const edits: editor.IIdentifiedSingleEditOperation[] = [];
      const range = this.getOperationRange(operation);

      switch (operation.type) {
        case OperationType.INSERT:
          edits.push({
            range,
            text: operation.text || "",
            forceMoveMarkers: true,
          });
          break;
        case OperationType.DELETE:
          edits.push({
            range,
            text: "",
            forceMoveMarkers: true,
          });
          break;
        case OperationType.REPLACE:
          edits.push({
            range,
            text: operation.text || "",
            forceMoveMarkers: true,
          });
          break;
      }

      // Apply the edits
      this.model.pushEditOperations(
        this.editor.getSelections(),
        edits,
        () => null
      );

      // Update local version if needed
      if (operation.version > this.localVersion) {
        this.localVersion = operation.version;
        console.log(
          "Updated local version after external operation:",
          this.localVersion
        );
      }
    } catch (error) {
      console.error("Failed to apply operation:", error, operation);
    } finally {
      // Reset the flag
      this.isApplyingExternalOperation = false;
    }
  }

  /**
   * Gets the range for an operation based on its position and length
   */
  private getOperationRange(operation: TextOperation): IRange {
    try {
      // Safety check for position
      const position = Math.min(
        operation.position,
        this.model.getValueLength()
      );
      const startPosition = this.model.getPositionAt(position);

      let endPosition;
      if (operation.length && operation.length > 0) {
        // Safety check for end position
        const endPos = Math.min(
          position + operation.length,
          this.model.getValueLength()
        );
        endPosition = this.model.getPositionAt(endPos);
      } else {
        endPosition = startPosition;
      }

      return {
        startLineNumber: startPosition.lineNumber,
        startColumn: startPosition.column,
        endLineNumber: endPosition.lineNumber,
        endColumn: endPosition.column,
      };
    } catch (error) {
      console.error("Error calculating operation range:", error, operation);

      // Fallback to first position in document
      return {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      };
    }
  }

  /**
   * Acknowledge an operation from the server
   */
  public acknowledgeOperation(ack: OperationAck): void {
    console.log("Operation acknowledged:", ack);

    // Find and remove the operation from pending operations
    const index = this.pendingOperations.findIndex(
      (op) => op.id === ack.operationId
    );
    if (index !== -1) {
      this.pendingOperations.splice(index, 1);
      console.log(
        "Removed acknowledged operation from pending:",
        ack.operationId
      );
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
    // Set flags to prevent event handlers from triggering
    this.isApplyingExternalOperation = true;

    try {
      // Reset all state variables
      this.localVersion = initialVersion;
      this.baseContent = initialContent;
      this.pendingOperations = [];
      this.operationIdCounter = 0;

      // Set model content
      this.model.setValue(initialContent);

      console.log("TextOperationManager reset to version:", initialVersion);
    } finally {
      this.isApplyingExternalOperation = false;
    }
  }
}
