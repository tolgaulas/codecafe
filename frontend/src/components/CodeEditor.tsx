import { useRef, useEffect, useState } from "react";
import { Editor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import codeEditorTheme from "../codeEditorTheme";

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
  onCursorPositionChange?: (lineNumber: number) => void;
  code?: string;
  sendCursorData?: (cursorData: CursorData) => void;
  onLoadingChange?: (loading: boolean) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  onCodeChange,
  users = [],
  onCursorPositionChange,
  code,
  sendCursorData,
  onLoadingChange,
}) => {
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
    loader.init().then((monaco) => {
      monaco.editor.defineTheme("darkTransparentTheme", {
        base: "vs-dark",
        inherit: true,
        rules: [
          {
            background: "1e1e1e",
            token: "",
          },
          {
            foreground: "d4d4d4",
            token: "text",
          },
          {
            foreground: "d4d4d4",
            background: "1e1e1e",
            token: "source",
          },
          {
            foreground: "6a9955",
            fontStyle: "italic",
            token: "comment",
          },
          {
            foreground: "569cd6",
            token: "meta.tag",
          },
          {
            foreground: "569cd6",
            token: "declaration.tag",
          },
          {
            foreground: "569cd6",
            token: "meta.doctype",
          },
          {
            foreground: "dcdcaa",
            token: "entity.name",
          },
          {
            foreground: "dcdcaa",
            token: "source.ruby entity.name",
          },
          {
            foreground: "9cdcfe",
            token: "variable.other",
          },
          {
            foreground: "4ec9b0",
            token: "support.class.ruby",
          },
          {
            foreground: "4fc1ff",
            token: "constant",
          },
          {
            foreground: "4fc1ff",
            token: "support.constant",
          },
          {
            foreground: "c586c0",
            token: "keyword",
          },
          {
            foreground: "9cdcfe",
            token: "other.preprocessor.c",
          },
          {
            fontStyle: "italic",
            token: "variable.parameter",
          },
          {
            foreground: "d4d4d4",
            background: "2d2d2d",
            token: "source comment.block",
          },
          {
            foreground: "ce9178",
            token: "string",
          },
          {
            foreground: "d7ba7d",
            token: "string constant.character.escape",
          },
          {
            foreground: "1e1e1e",
            background: "4ec9b0",
            token: "string.interpolated",
          },
          {
            foreground: "d16969",
            token: "string.regexp",
          },
          {
            foreground: "d16969",
            token: "string.literal",
          },
          {
            foreground: "5a5a5a",
            token: "string.interpolated constant.character.escape",
          },
          {
            fontStyle: "underline",
            token: "entity.name.class",
          },
          {
            fontStyle: "italic underline",
            token: "entity.other.inherited-class",
          },
          {
            foreground: "dcdcaa",
            token: "support.function",
          },
          {
            foreground: "608b4e",
            token: "markup.list.unnumbered.textile",
          },
          {
            foreground: "608b4e",
            token: "markup.list.numbered.textile",
          },
          {
            foreground: "d4d4d4",
            fontStyle: "bold",
            token: "markup.bold.textile",
          },
          {
            foreground: "ffffff",
            background: "ff0000",
            token: "invalid",
          },
          {
            foreground: "1e1e1e",
            background: "4fc1ff",
            token: "collab.user1",
          },
        ],
        colors: {
          "editor.background": "#00000000",
          "editor.foreground": "#d4d4d4",
          "editorLineNumber.foreground": "#6b6b6b",
          "editorGutter.background": "#00000000",
          "minimap.background": "#00000000",
          "editor.selectionBackground": "#264f78",
          "editor.inactiveSelectionBackground": "#3a3d41",
          "editorIndentGuide.background": "#404040",
          "editor.lineHighlightBackground": "#00000000",
          "editor.lineHighlightBorder": "#454545",
        },
      });

      // Don't forget to set the theme after defining it
      monaco.editor.setTheme("darkTransparentTheme");
    });
  }, []);

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
        theme="darkTransparentTheme"
        defaultLanguage="javascript"
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
