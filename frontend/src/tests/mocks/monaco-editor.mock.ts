import { editor, IRange, Selection } from "monaco-editor";

export class Selection {
  constructor(
    public startLineNumber: number,
    public startColumn: number,
    public endLineNumber: number,
    public endColumn: number
  ) {}

  public getPosition() {
    return {
      lineNumber: this.startLineNumber,
      column: this.startColumn,
    };
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
  private listeners: ((e: any) => void)[] = [];

  constructor(initialValue: string = "") {
    this.value = initialValue;
  }

  onDidChangeContent(listener: (e: any) => void): { dispose: () => void } {
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
    const oldValue = this.value;
    this.value = newValue;
    this.triggerContentChange({
      changes: [
        {
          range: this.createFullModelRange(),
          rangeLength: oldValue.length,
          text: newValue,
          rangeOffset: 0,
        },
      ],
      eol: "\n",
      versionId: 1,
      isUndoing: false,
      isRedoing: false,
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

  applyEdits(edits: any[]): void {
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
      const oldValue = this.value;
      this.value = newText;
      this.triggerContentChange({
        changes: edits.map((edit) => ({
          range: edit.range,
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
        versionId: 1,
        isUndoing: false,
        isRedoing: false,
      });
    }
  }

  private triggerContentChange(event: any): void {
    for (const listener of this.listeners) {
      listener(event);
    }
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
  private model: MockTextModel;
  private selections: Selection[] = [new Selection(1, 1, 1, 1)];
  private cursorStateListeners: ((e: any) => void)[] = [];
  private viewState: any = { cursorState: [] };

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

  saveViewState(): any {
    return { cursorState: this.selections };
  }

  restoreViewState(state: any): void {
    if (state && state.cursorState) {
      this.selections = state.cursorState;
    }
  }

  onDidChangeCursorPosition(listener: (e: any) => void): {
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
    for (const listener of this.cursorStateListeners) {
      listener({ position: this.selections[0].getPosition() });
    }
  }

  pushEditOperations(
    beforeCursorState: Selection[] | null,
    editOperations: any[],
    cursorStateComputer: ((edits: any[]) => Selection[] | null) | null
  ): Selection[] | null {
    this.model.applyEdits(editOperations);

    if (cursorStateComputer) {
      const newSelections = cursorStateComputer(editOperations) || null;
      if (newSelections) {
        this.setSelections(newSelections);
        return newSelections;
      }
    }

    return this.selections;
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
  getOptions(): any {
    return {};
  }
  getConfiguration(): any {
    return {};
  }
  getValue(): string {
    return this.model.getValue();
  }
  setValue(content: string): void {
    this.model.setValue(content);
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
  getAction(): any {
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
  addAction(): any {
    return { dispose: () => {} };
  }
  createContextKey(): any {
    return { set: () => {} };
  }
  addCommand(): any {
    return { dispose: () => {} };
  }
  addEditorAction(): any {
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
  getPosition(): any {
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
  getVisibleRanges(): any[] {
    return [];
  }
  hasPendingActions(): boolean {
    return false;
  }
  getScrolledVisiblePosition(): any {
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
