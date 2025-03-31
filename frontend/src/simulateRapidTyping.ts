import { editor, Range } from "monaco-editor";
import { TextOperationManager } from "./TextOperationSystem"; // Adjust path

export function simulateRapidTyping(
  editorInstance: editor.IStandaloneCodeEditor,
  operationManager: TextOperationManager,
  text: string,
  typingSpeed: number // Milliseconds per character
) {
  const model = editorInstance.getModel();
  if (!model) return;

  let currentPosition = 0;
  let charIndex = 0;

  const typingInterval = setInterval(() => {
    if (charIndex >= text.length) {
      clearInterval(typingInterval);
      return;
    }

    const char = text[charIndex];
    const position = model.getPositionAt(currentPosition);

    const editOperation = {
      range: new Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: char,
      forceMoveMarkers: true,
    };

    model.pushEditOperations(
      editorInstance.getSelections(),
      [editOperation],
      () => null
    );

    currentPosition++;
    charIndex++;
  }, typingSpeed);
}
