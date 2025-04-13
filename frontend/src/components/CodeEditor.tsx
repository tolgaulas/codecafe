import { useRef, useEffect } from "react";
import { Editor, loader } from "@monaco-editor/react";
import { CodeEditorProps } from "../types/props";
import * as monaco from "monaco-editor";
import { THEMES } from "../constants/themes";
import {
  OTSelection,
  positionToOffset,
  offsetToPosition,
} from "../TextOperationSystem";

const CodeEditor = ({
  onCodeChange,
  users = [],
  onCursorPositionChange,
  code,
  sendSelectionData,
  onLoadingChange,
  language,
  theme,
  fontSize,
  wordWrap,
  showLineNumbers,
  onEditorDidMount,
}: CodeEditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
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

  useEffect(() => {
    console.log("[CodeEditor] Received users prop:", users);
  }, [users]);

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

      /* Remove shadows from common widgets */
      .monaco-editor .find-widget,
      .monaco-editor .suggest-widget,
      .monaco-editor .monaco-hover,
      .monaco-editor .parameter-hints-widget {
          box-shadow: none !important;
          border: 1px solid #404040 !important; /* Optional: Add a subtle border instead */
      }

      /* Remove shadow from sticky scroll header */
      .monaco-editor .header-wrapper {
          box-shadow: none !important;
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

    return () => {
      if (styleSheetRef.current) {
        styleSheetRef.current.remove();
        styleSheetRef.current = null;
      }
    };
  }, [users]);

  // Function to apply decorations based on the users prop
  const updateDecorations = () => {
    const editor = editorRef.current;
    if (!editor || !users) return;
    const model = editor.getModel();
    if (!model) return;

    console.log("[CodeEditor updateDecorations] Called with users:", users);

    const decorations = users.flatMap((user) => {
      // @ts-ignore <-- Ignore potential null warning for model in flatMap
      const decorationArray = [];

      // Render Selection
      if (
        user.selection &&
        user.selection.ranges &&
        user.selection.ranges.length > 0
      ) {
        const primaryRange = user.selection.ranges[0];
        if (primaryRange) {
          console.log(
            `[CodeEditor updateDecorations] User ${user.id} - Primary Range Offsets:`,
            primaryRange
          );
          try {
            // @ts-ignore <-- Ignore potential null warning for model
            const anchorPos = offsetToPosition(model, primaryRange.anchor);
            // @ts-ignore <-- Ignore potential null warning for model
            const headPos = offsetToPosition(model, primaryRange.head);
            console.log(
              `[CodeEditor updateDecorations] User ${user.id} - Converted AnchorPos:`,
              anchorPos,
              `HeadPos:`,
              headPos
            );

            const monacoRange = new monaco.Range(
              anchorPos.lineNumber,
              anchorPos.column,
              headPos.lineNumber,
              headPos.column
            );
            console.log(
              `[CodeEditor updateDecorations] User ${user.id} - Created Monaco Range:`,
              monacoRange
            );

            decorationArray.push({
              range: monacoRange,
              options: {
                className: `user-${user.id}-selection`,
                hoverMessage: { value: `Selected by ${user.name}` },
              },
            });
          } catch (error) {
            console.error(
              "[CodeEditor updateDecorations] Error converting selection offsets:",
              error,
              primaryRange
            );
          }
        }
      }

      // Render Cursor
      if (user.cursorPosition) {
        console.log(
          `[CodeEditor updateDecorations] User ${user.id} - Cursor Position:`,
          user.cursorPosition
        );
        const cursorPosRange = new monaco.Range(
          user.cursorPosition.lineNumber,
          user.cursorPosition.column,
          user.cursorPosition.lineNumber,
          user.cursorPosition.column
        );
        console.log(
          `[CodeEditor updateDecorations] User ${user.id} - Created Cursor Range:`,
          cursorPosRange
        );
        decorationArray.push({
          range: cursorPosRange,
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

    console.log(
      "[CodeEditor updateDecorations] Generated Decorations Array:",
      decorations
    );

    // Apply the decorations
    try {
      // @ts-ignore <-- Ignore potential null warning for editor
      const decorationIds = editor.deltaDecorations(
        decorationsRef.current,
        decorations
      );
      decorationsRef.current = decorationIds;
      console.log(
        "[CodeEditor updateDecorations] Applied Decorations, IDs:",
        decorationIds
      );
    } catch (error) {
      console.error(
        "[CodeEditor updateDecorations] Error applying decorations:",
        error
      );
      // @ts-ignore <-- Ignore potential null warning for editor
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        []
      );
    }
  };

  // Handle editor mount and cursor position changes
  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor
  ) => {
    editorRef.current = editor;
    const model = editor.getModel();

    if (model) {
      editor.onDidChangeCursorPosition(
        (e: monaco.editor.ICursorPositionChangedEvent) => {
          const currentEditor = editorRef.current!;
          const currentModel = currentEditor.getModel()!;
          if (isUpdatingRef.current || !currentModel) return;

          const position = e.position;
          const selection = currentEditor.getSelection();

          onCursorPositionChange?.(position.lineNumber);

          let otSelectionToSend: OTSelection | null = null;
          if (selection) {
            try {
              const anchorOffset = positionToOffset(
                currentModel,
                selection.getStartPosition()
              );
              const headOffset = positionToOffset(
                currentModel,
                selection.getEndPosition()
              );
              const range = new OTSelection.SelectionRange(
                anchorOffset,
                headOffset
              );
              otSelectionToSend = new OTSelection([range]);
            } catch (error) {
              console.error(
                "[CodeEditor] Error converting positions to selection offsets:",
                error,
                selection
              );
            }
          }

          sendSelectionData?.({
            cursorPosition: {
              lineNumber: position.lineNumber,
              column: position.column,
            },
            selection: otSelectionToSend,
          });
        }
      );
    } else {
      console.warn(
        "[CodeEditor] Model not available on mount, cannot attach cursor listener."
      );
    }

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
            vertical: "auto",
            useShadows: false,
          },
          find: {
            addExtraSpaceOnTop: false,
          },
        }}
        className="monaco-editor"
      />
    </div>
  );
};

export default CodeEditor;
