import { editor } from "monaco-editor";
import { TextOperationManager } from "./TextOperationSystem"; // Adjust path

export function simulateRapidTyping(
  editorInstance: editor.IStandaloneCodeEditor,
  operationManager: TextOperationManager,
  text: string,
  typingSpeed: number // Milliseconds per character
) {
  const model = editorInstance.getModel();
  if (!model) return;

  let currentPosition = editorInstance.getPosition() || model.getPositionAt(0);
  let charIndex = 0;

  const typingInterval = setInterval(() => {
    if (charIndex >= text.length) {
      clearInterval(typingInterval);
      return;
    }

    const char = text[charIndex];

    // Use the editor's setValue method which will trigger the content change event
    editorInstance.executeEdits("typing-simulation", [
      {
        range: {
          startLineNumber: currentPosition.lineNumber,
          startColumn: currentPosition.column,
          endLineNumber: currentPosition.lineNumber,
          endColumn: currentPosition.column,
        },
        text: char,
        forceMoveMarkers: true,
      },
    ]);

    // Get the new cursor position after the edit
    currentPosition = editorInstance.getPosition() || currentPosition;
    charIndex++;
  }, typingSpeed);
}
