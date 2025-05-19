import {
  editor,
  IDisposable,
  Position,
  Range as MonacoRangeImport,
  Selection as MonacoSelection,
} from "monaco-editor";
import * as monaco from "monaco-editor"; // Keep this for other types if needed

export class Selection {
  constructor(
    public startLineNumber: number,
    public startColumn: number,
    public endLineNumber: number,
    public endColumn: number
  ) {}

  public getPosition(): Position {
    return new Position(this.startLineNumber, this.startColumn);
  }

  public getStartPosition(): Position {
    return new Position(this.startLineNumber, this.startColumn);
  }

  public getEndPosition(): Position {
    return new Position(this.endLineNumber, this.endColumn);
  }

  public equals(other: Selection | MonacoSelection): boolean {
    const otherStart =
      other instanceof Selection
        ? other.getStartPosition()
        : monaco.Position.lift(other.getStartPosition());
    const otherEnd =
      other instanceof Selection
        ? other.getEndPosition()
        : monaco.Position.lift(other.getEndPosition());
    return (
      this.getStartPosition().equals(otherStart) &&
      this.getEndPosition().equals(otherEnd)
    );
  }

  public isEmpty(): boolean {
    return (
      this.startLineNumber === this.endLineNumber &&
      this.startColumn === this.endColumn
    );
  }

  public getDirection(): monaco.SelectionDirection {
    return monaco.SelectionDirection.LTR;
  }

  public setDirection(_direction: monaco.SelectionDirection): void {}

  public setEndPosition(_endLineNumber: number, _endColumn: number): Selection {
    return this;
  }

  public setPosition(_position: monaco.IPosition): Selection {
    return this;
  }

  public setSelectionStart(
    _startLineNumber: number,
    _startColumn: number
  ): Selection {
    return this;
  }
}

export interface IRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export class MockTextModel {
  private value: string;
  private listeners: ((e: editor.IModelContentChangedEvent) => void)[] = [];

  constructor(initialValue: string = "") {
    this.value = initialValue;
  }

  onDidChangeContent(
    listener: (e: editor.IModelContentChangedEvent) => void
  ): IDisposable {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  getValueLength(): number {
    return this.value.length;
  }

  getValue(): string {
    return this.value;
  }

  setValue(newValue: string): void {
    this.value = newValue;
    this.triggerContentChange({
      changes: [
        {
          range: this.createFullModelRange(),
          rangeLength: this.value.length,
          text: newValue,
          rangeOffset: 0,
        },
      ],
      eol: "\n",
      versionId: 1,
      isUndoing: false,
      isRedoing: false,
      isFlush: false,
      isEolChange: false,
    });
  }

  getPositionAt(offset: number): { lineNumber: number; column: number } {
    if (offset <= 0) {
      return { lineNumber: 1, column: 1 };
    }
    if (offset >= this.value.length) {
      return this.getLastPosition();
    }

    let lineNumber = 1;
    let column = 1;
    for (let i = 0; i < offset; i++) {
      if (this.value[i] === "\n") {
        lineNumber++;
        column = 1;
      } else {
        column++;
      }
    }
    return { lineNumber, column };
  }

  getOffsetAt(position: { lineNumber: number; column: number }): number {
    if (position.lineNumber <= 0) {
      return 0;
    }

    let offset = 0;
    let currentLine = 1;
    let currentColumn = 1;

    for (let i = 0; i < this.value.length; i++) {
      if (
        currentLine === position.lineNumber &&
        currentColumn === position.column
      ) {
        return offset;
      }

      if (this.value[i] === "\n") {
        currentLine++;
        currentColumn = 1;
      } else {
        currentColumn++;
      }

      offset++;
    }

    return offset;
  }

  getLastPosition(): { lineNumber: number; column: number } {
    let lineNumber = 1;
    let lastLineStart = 0;
    for (let i = 0; i < this.value.length; i++) {
      if (this.value[i] === "\n") {
        lineNumber++;
        lastLineStart = i + 1;
      }
    }
    return {
      lineNumber,
      column: this.value.length - lastLineStart + 1,
    };
  }

  createFullModelRange(): IRange {
    return {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: this.getLastPosition().lineNumber,
      endColumn: this.getLastPosition().column,
    };
  }

  applyEdits(edits: editor.IIdentifiedSingleEditOperation[]): void {
    let newText = this.value;
    // Apply edits in reverse order to avoid offset issues
    const sortedEdits = [...edits].sort((a, b) => {
      const rangeA = a.range;
      const rangeB = b.range;
      if (rangeA.startLineNumber !== rangeB.startLineNumber) {
        return rangeB.startLineNumber - rangeA.startLineNumber;
      }
      return rangeB.startColumn - rangeA.startColumn;
    });

    for (const edit of sortedEdits) {
      const startOffset = this.getOffsetAt({
        lineNumber: edit.range.startLineNumber,
        column: edit.range.startColumn,
      });
      const endOffset = this.getOffsetAt({
        lineNumber: edit.range.endLineNumber,
        column: edit.range.endColumn,
      });

      newText =
        newText.substring(0, startOffset) +
        edit.text +
        newText.substring(endOffset);
    }

    if (newText !== this.value) {
      this.value = newText;
      const mockChangeEvent: editor.IModelContentChangedEvent = {
        changes: edits.map((edit) => ({
          range: new MonacoRangeImport(
            edit.range.startLineNumber,
            edit.range.startColumn,
            edit.range.endLineNumber,
            edit.range.endColumn
          ),
          rangeLength:
            this.getOffsetAt({
              lineNumber: edit.range.endLineNumber,
              column: edit.range.endColumn,
            }) -
            this.getOffsetAt({
              lineNumber: edit.range.startLineNumber,
              column: edit.range.startColumn,
            }),
          text: edit.text || "",
          rangeOffset: this.getOffsetAt({
            lineNumber: edit.range.startLineNumber,
            column: edit.range.startColumn,
          }),
        })),
        eol: "\n",
        versionId: (this.getVersionId ? this.getVersionId() : 0) + 1,
        isUndoing: false,
        isRedoing: false,
        isFlush: true,
        isEolChange: false,
      };
      this.triggerContentChange(mockChangeEvent);
    }
  }

  private triggerContentChange(event: editor.IModelContentChangedEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  // Simplified methods for testing
  getLineCount(): number {
    return this.value.split("\n").length;
  }

  getLineContent(lineNumber: number): string {
    return this.value.split("\n")[lineNumber - 1] || "";
  }

  // Other methods as needed for tests
  getLinesContent(): string[] {
    return this.value.split("\n");
  }
  getVersionId(): number {
    return 1;
  }
  getAlternativeVersionId(): number {
    return 1;
  }
  dispose(): void {}
}

export class MockEditor {
  private decorations: string[] = [];
  private selections: Selection[] = [new Selection(1, 1, 1, 1)];
  private model: MockTextModel = new MockTextModel("");
  private cursorStateListeners: ((
    e: editor.ICursorPositionChangedEvent
  ) => void)[] = [];
  private listeners: { [key: string]: ((...args: unknown[]) => void)[] } = {
    onDidChangeCursorPosition: [],
  };

  constructor(initialContent: string = "") {
    this.model = new MockTextModel(initialContent);
  }

  getModel(): MockTextModel {
    return this.model;
  }

  setModel(model: MockTextModel | null): void {
    if (model) {
      this.model = model;
    }
  }

  getSelections(): Selection[] {
    return this.selections;
  }

  setSelections(selections: Selection[]): void {
    this.selections = selections;
    this.notifyCursorPositionChanged();
  }

  saveViewState(): unknown {
    return null;
  }

  restoreViewState(_state: unknown): void {
    // Mock implementation
  }

  onDidChangeCursorPosition(
    listener: (e: editor.ICursorPositionChangedEvent) => void
  ): {
    dispose: () => void;
  } {
    this.cursorStateListeners.push(listener);
    return {
      dispose: () => {
        const index = this.cursorStateListeners.indexOf(listener);
        if (index !== -1) {
          this.cursorStateListeners.splice(index, 1);
        }
      },
    };
  }

  private notifyCursorPositionChanged(): void {
    const position = this.getPosition();
    if (position) {
      const mockEvent: editor.ICursorPositionChangedEvent = {
        position: position,
        secondaryPositions: [],
        reason: monaco.editor.CursorChangeReason.NotSet,
        source: "mock",
      };
      this.cursorStateListeners.forEach((listener) => listener(mockEvent));
    }
  }

  pushEditOperations(
    _selection: Selection | null,
    editOperations: editor.IIdentifiedSingleEditOperation[],
    _beforeCursorState: Selection[] | null
  ): null {
    this.model.applyEdits(editOperations);
    return null;
  }

  getValue(): string {
    return this.model.getValue();
  }

  setValue(content: string): void {
    this.model.setValue(content);
  }

  // Add more methods as needed...
  // These are placeholders for the IStandaloneCodeEditor interface
  layout(): void {}
  focus(): void {}
  getEditorType(): string {
    return "standalone";
  }
  dispose(): void {}
  onDidChangeModelContent(
    listener: (e: editor.IModelContentChangedEvent) => void
  ): { dispose: () => void } {
    return this.model.onDidChangeContent(listener);
  }
  updateOptions(): void {}
  getOptions(): editor.IEditorOptions {
    return {} as editor.IEditorOptions;
  }
  getConfiguration(): editor.IEditorOptions {
    return {} as editor.IEditorOptions;
  }
  getContentHeight(): number {
    return 0;
  }
  getScrollHeight(): number {
    return 0;
  }
  getScrollWidth(): number {
    return 0;
  }
  getScrollLeft(): number {
    return 0;
  }
  getScrollTop(): number {
    return 0;
  }
  setScrollLeft(): void {}
  setScrollTop(): void {}
  setScrollPosition(): void {}
  getAction(_id: string): editor.IEditorAction | null {
    return null;
  }
  executeCommand(): void {}
  executeEdits(): boolean {
    return true;
  }
  trigger(): void {}
  getContainerDomNode(): HTMLElement {
    return document.createElement("div");
  }
  getDomNode(): HTMLElement | null {
    return document.createElement("div");
  }
  addAction(_action: editor.IActionDescriptor): IDisposable | undefined {
    return undefined;
  }
  createContextKey<
    T extends monaco.editor.ContextKeyValue = monaco.editor.ContextKeyValue
  >(_key: string, defaultValue: T | undefined): editor.IContextKey<T> {
    let _value = defaultValue;
    return {
      set: (value: T) => {
        _value = value;
      },
      reset: () => {
        _value = defaultValue;
      },
      get: () => _value,
    } as editor.IContextKey<T>;
  }
  addCommand(
    _command: string,
    _handler: (...args: unknown[]) => void,
    _keybinding?: string
  ): string | null {
    return null;
  }
  addEditorAction(_action: editor.IActionDescriptor): IDisposable {
    return { dispose: () => {} };
  }
  hasTextFocus(): boolean {
    return false;
  }
  hasWidgetFocus(): boolean {
    return false;
  }
  getId(): string {
    return "mock-editor";
  }
  getPosition(): Position | null {
    if (this.selections.length > 0 && this.selections[0]) {
      return this.selections[0].getPosition();
    }
    return null;
  }
  revealLine(): void {}
  revealLineInCenter(): void {}
  revealLineInCenterIfOutsideViewport(): void {}
  revealLineNearTop(): void {}
  revealPosition(): void {}
  revealPositionInCenter(): void {}
  revealPositionInCenterIfOutsideViewport(): void {}
  revealPositionNearTop(): void {}
  getVisibleRanges(): MonacoRangeImport[] {
    return [];
  }
  hasPendingActions(): boolean {
    return false;
  }
  getScrolledVisiblePosition(
    _position: monaco.IPosition
  ): { top: number; left: number; height: number } | null {
    return null;
  }
  applyFontInfo(): void {}
}

// Mock the editor export structure
export const editorMock = {
  IModelContentChangedEvent: {},
  ITextModel: {},
  IStandaloneCodeEditor: {},
  ICursorState: {},
  IIdentifiedSingleEditOperation: {},
};

// Make default export match structure expected by imports
export default {
  editor: editorMock,
  Selection,
  IRange: {},
};
