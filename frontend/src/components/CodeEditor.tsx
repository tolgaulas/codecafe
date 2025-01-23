import { useState, useRef, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface CodeEditorProps {
  onCodeChange: (code: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ onCodeChange }) => {
  const [code, setCode] = useState<string>(
    "// some comment\nfunction hello() {\n  console.log('Hello world');\n}\n\n// More code here\nconst x = 42;\nconsole.log(x);"
  );
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    onCodeChange(code);
  });
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    const blinkInterval = 500;

    const otherUserPosition = new monaco.Position(3, 15);
    const selectionStart = new monaco.Position(2, 1);

    const decorations = [
      {
        range: new monaco.Range(
          selectionStart.lineNumber,
          selectionStart.column,
          otherUserPosition.lineNumber,
          otherUserPosition.column
        ),
        options: {
          className: "other-user-selection",
          glyphMarginClassName: "other-user-glyph",
          isWholeLine: false,
          hoverMessage: { value: "Selected by John" },
          inlineClassName: "other-user-inline",
          beforeContentClassName: "other-user-before",
        },
      },
      {
        range: new monaco.Range(
          otherUserPosition.lineNumber,
          otherUserPosition.column,
          otherUserPosition.lineNumber,
          otherUserPosition.column
        ),
        options: {
          className: "other-user-cursor",
          glyphMarginClassName: "other-user-cursor-glyph",
          beforeContentClassName: "cursor-label",
          before: {
            content: "John",
            inlineClassName: "user-label",
          },
        },
      },
    ];

    // Apply the decorations
    decorationsRef.current = editor.deltaDecorations([], decorations);

    // Add custom CSS for decorations with dynamic blink rate
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes blink {
        0% { opacity: 1; }
        49% { opacity: 1; }
        50% { opacity: 0; }
        99% { opacity: 0; }
        100% { opacity: 1; }
      }

      .other-user-selection {
        background-color: rgba(255, 120, 0, 0.2);
      }
      .other-user-cursor {
        border-left: 2px solid #ff7800;
        height: 20px !important;
        margin-left: -1px;
        animation: blink ${blinkInterval * 2}ms step-end infinite;
      }
      .user-label {
        background-color: #ff7800;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        font-family: system-ui;
        position: absolute;
        top: -20px;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(styleSheet);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setCode(value);
      onCodeChange(value);
    }
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        width="100%"
        theme="vs-dark"
        defaultLanguage="javascript"
        value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 16,
          lineHeight: 20,
          minimap: { enabled: false },
          wordWrap: "on",
          cursorBlinking: "blink", // This ensures cursor blinking is enabled
          cursorStyle: "line", // Use a line cursor
        }}
      />
    </div>
  );
};

export default CodeEditor;
