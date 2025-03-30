import { useRef, useEffect } from "react";
import { Editor, loader } from "@monaco-editor/react";
import { CodeEditorProps } from "../types/props";
import * as monaco from "monaco-editor";
import { THEMES } from "../constants/themes";

const CodeEditor = ({
  onCodeChange,
  users = [],
  onCursorPositionChange,
  code,
  sendCursorData,
  onLoadingChange,
  language,
  theme,
  fontSize,
  wordWrap,
  showLineNumbers,
  onEditorDidMount,
}: CodeEditorProps) => {
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const isUpdatingRef = useRef(false);
  const styleSheetRef = useRef<HTMLStyleElement | null>(null);
  const cursorStateRef = useRef<{
    position: monaco.Position | null;
    selection: monaco.Selection | null;
  }>({
    position: null,
    selection: null,
  });
  const prevCodeRef = useRef<string>("");

  // Initialize Monaco theme
  useEffect(() => {
    // Ensure loader.init runs only once or handle potential race conditions if needed
    loader.init().then((monaco) => {
      // Register themes
      Object.entries(THEMES).forEach(([themeName, themeConfig]) => {
        // Pass the actual config object, not the object containing {label, config}
        monaco.editor.defineTheme(themeName, themeConfig.config);
      });

      // Apply the currently selected theme using the theme prop's value (string name)
      monaco.editor.setTheme(theme || "");
    });
  }, [theme]); // Re-run when the theme prop changes

  // Store cursor state before any updates
  const saveCursorState = () => {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      const selection = editorRef.current.getSelection();

      cursorStateRef.current = {
        position: position
          ? new monaco.Position(position.lineNumber, position.column)
          : null,
        selection: selection
          ? new monaco.Selection(
              selection.startLineNumber,
              selection.startColumn,
              selection.endLineNumber,
              selection.endColumn
            )
          : null,
      };
    }
  };

  // Restore cursor state after updates
  const restoreCursorState = () => {
    if (!editorRef.current || !cursorStateRef.current.position) return;

    const { position, selection } = cursorStateRef.current;

    // Use requestAnimationFrame to ensure the editor has processed content changes
    requestAnimationFrame(() => {
      if (position) {
        editorRef.current.setPosition(position);
      }
      if (selection) {
        editorRef.current.setSelection(selection);
      }
      editorRef.current.focus();
    });
  };

  // Handle code updates with improved cursor preservation
  useEffect(() => {
    if (!editorRef.current || code === undefined || isUpdatingRef.current)
      return;

    const currentValue = editorRef.current.getValue();
    if (currentValue === code || prevCodeRef.current === code) return;

    isUpdatingRef.current = true;
    prevCodeRef.current = code;

    try {
      saveCursorState();

      const editor = editorRef.current;
      const model = editor.getModel();

      // Create and apply the edit operation
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: code,
            forceMoveMarkers: true,
          },
        ],
        () => null
      );

      restoreCursorState();
    } finally {
      isUpdatingRef.current = false;
    }
  }, [code]);

  // Update styles for user cursors
  useEffect(() => {
    if (styleSheetRef.current) {
      styleSheetRef.current.remove();
    }

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      .monaco-editor {
        border: none !important;
      }
      ${users
        .map(
          (user) => `
        @keyframes blink-${user.id} {
          0%, 49% { opacity: 1; }
          50%, 99% { opacity: 0; }
          100% { opacity: 1; }
        }

        .user-${user.id}-selection {
          background-color: ${user.color}33 !important;
          border: 1px solid ${user.color}66 !important;
        }
        .user-${user.id}-cursor {
          border-left: 2px solid ${user.color} !important;
          height: 20px !important;
          margin-left: -1px !important;
          animation: blink-${user.id} 1000ms step-end infinite;
        }
        .user-${user.id}-label {
          background-color: ${user.color} !important;
          color: white !important;
          padding: 2px 6px !important;
          border-radius: 3px !important;
          font-size: 12px !important;
          font-family: system-ui !important;
          position: absolute !important;
          top: -20px !important;
          white-space: nowrap !important;
          z-index: 1 !important;
        }
      `
        )
        .join("\n")}
    `;
    document.head.appendChild(styleSheet);
    styleSheetRef.current = styleSheet;

    if (editorRef.current) {
      updateDecorations();
    }
  }, [users]);

  const updateDecorations = () => {
    if (!editorRef.current) return;

    const decorations = users.flatMap((user) => {
      const decorationArray = [];

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

      if (user.cursorPosition) {
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
      }

      return decorationArray;
    });

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition(
      (e: monaco.editor.ICursorPositionChangedEvent) => {
        if (isUpdatingRef.current) return;

        const position = e.position;
        const selection = editor.getSelection();

        onCursorPositionChange?.(position.lineNumber);

        sendCursorData?.({
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
        });
      }
    );

    updateDecorations();
    if (onEditorDidMount) {
      onEditorDidMount(editor);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value == undefined || isUpdatingRef.current) return;
    onCodeChange(value);
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        width="100%"
        theme={theme}
        language={language}
        // value={code}
        onChange={handleEditorChange}
        beforeMount={() => onLoadingChange?.(true)} // Add loading state
        onMount={(editor) => {
          handleEditorDidMount(editor);
          setTimeout(() => {
            onLoadingChange?.(false);
          }, 550);
        }}
        options={{
          fontSize: parseInt(fontSize || "14", 10),
          lineHeight: 20,
          minimap: { enabled: false },
          lineNumbers: showLineNumbers ? "on" : "off",
          wordWrap: wordWrap ? "on" : "off",
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
