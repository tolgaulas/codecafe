import { useRef, useEffect } from "react";
import { Editor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface User {
  id: string;
  name: string;
  color: string;
  cursorPosition: {
    lineNumber: number;
    column: number;
  };
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

interface CursorData {
  cursorPosition: {
    lineNumber: number;
    column: number;
  };
  selection: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
}

interface CodeEditorProps {
  onCodeChange: (code: string) => void;
  users?: User[];
  onCursorPositionChange?: (lineNumber: number) => void; // New prop
  code?: string;
  sendCursorData?: (cursorData: CursorData) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  onCodeChange,
  users = [],
  onCursorPositionChange,
  code,
  sendCursorData,
}) => {
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  // const [internalCode, setInternalCode] = useState(code);

  useEffect(() => {
    if (editorRef.current) {
      updateDecorations();
    }
  }, [users]);

  useEffect(() => {
    // setInternalCode(code);
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== code) {
        editorRef.current.setValue(code);
      }
    }
  }, [code]);

  // useEffect(() => {
  //   if (editorRef.current) {
  //     updateDecorations();
  //   }
  // }, [users]);

  useEffect(() => {
    loader.init().then((monaco) => {
      monaco.editor.defineTheme("transparentTheme", {
        base: "vs-dark", // Use "vs-dark" as the base theme
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#00000000",
          "editorGutter.background": "#00000000",
          "minimap.background": "#00000000",
        },
      });
    });
  }, []);

  const updateDecorations = () => {
    if (!editorRef.current) return;

    const decorations = users.flatMap((user) => {
      const decorationArray = [];

      // Add selection if it exists
      if (user.selection) {
        decorationArray.push({
          range: new monaco.Range(
            user.selection.startLineNumber,
            user.selection.startColumn,
            user.selection.endLineNumber,
            user.selection.endColumn
          ),
          options: {
            className: `user-${user.id}-selection`,
            hoverMessage: { value: `Selected by ${user.name}` },
          },
        });
      }

      // Add cursor
      decorationArray.push({
        range: new monaco.Range(
          user.cursorPosition.lineNumber,
          user.cursorPosition.column,
          user.cursorPosition.lineNumber,
          user.cursorPosition.column
        ),
        options: {
          className: `user-${user.id}-cursor`,
          beforeContentClassName: "cursor-label",
          before: {
            content: user.name,
            inlineClassName: `user-${user.id}-label`,
          },
        },
      });

      return decorationArray;
    });

    // Update decorations
    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition(
      (e: monaco.editor.ICursorPositionChangedEvent) => {
        const lineNumber = e.position.lineNumber;
        onCursorPositionChange?.(lineNumber); // Call the prop function

        const position = e.position;
        const selection = editor.getSelection();

        const cursorData = {
          cursorPosition: {
            lineNumber: position.lineNumber,
            column: position.column,
          },
          selection: selection
            ? {
                startLineNumber: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLineNumber: selection.endLineNumber,
                endColumn: selection.endColumn,
              }
            : null,
        };
        sendCursorData?.(cursorData);
      }
    );

    const styleSheet = document.createElement("style");

    styleSheet.textContent = users
      .map(
        (user) => `
    .monaco-editor {
      border: none !important;
    }
      @keyframes blink-${user.id} {
        0% { opacity: 1; }
        49% { opacity: 1; }
        50% { opacity: 0; }
        99% { opacity: 0; }
        100% { opacity: 1; }
      }

      .user-${user.id}-selection {
        background-color: ${user.color}33;
      }
      .user-${user.id}-cursor {
        border-left: 2px solid ${user.color};
        height: 20px !important;
        margin-left: -1px;
        animation: blink-${user.id} 1000ms step-end infinite;
      }
      .user-${user.id}-label {
        background-color: ${user.color};
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        font-family: system-ui;
        position: absolute;
        top: -20px;
        white-space: nowrap;
      }
    `
      )
      .join("\n");
    document.head.appendChild(styleSheet);

    updateDecorations();
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      onCodeChange(value);
      // setInternalCode(code);
    }
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        width="100%"
        theme="transparentTheme"
        defaultLanguage="javascript"
        value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 16,
          lineHeight: 20,
          minimap: { enabled: false },
          wordWrap: "on",
          cursorBlinking: "blink",
          cursorStyle: "line",
          scrollBeyondLastLine: false,
          scrollbar: {
            handleMouseWheel: false,
            verticalScrollbarSize: 0,
            verticalSliderSize: 0,
          },
        }}
        className="monaco-editor"
      />
    </div>
  );
};

export default CodeEditor;
