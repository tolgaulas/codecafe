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
   * Applies a received operation from the server
   */
  public applyOperation(operation: TextOperation): void {
    console.log("Applying operation:", operation);
    // If this is our own operation coming back from the server, just update version
    if (operation.userId === this.userId) {
      this.localVersion = operation.version;
      return;
    }

    // Ignore operations if they're for an older version than our current version
    if (operation.version < this.localVersion) {
      console.warn("Ignoring outdated operation:", operation);
      return;
    }

    // Flag that we're applying an external operation
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

      // Update local version
      this.localVersion = operation.version;

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
}
