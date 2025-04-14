import { useRef, useEffect } from "react";
import { Editor, loader, OnChange, OnMount } from "@monaco-editor/react";
import { CodeEditorProps, RemoteUser } from "../types/props";
import * as monaco from "monaco-editor";
import { THEMES } from "../constants/themes";
import {
  OTSelection,
  positionToOffset,
  offsetToPosition,
} from "../ot/TextOperationSystem";
import { editor, IDisposable } from "monaco-editor";

// Define the expected signature for onCodeChange more clearly
// No need to extend CodeEditorProps if only adding isSessionActive
interface ExtendedCodeEditorProps extends CodeEditorProps {
  isSessionActive?: boolean; // Optional for now
  // fontSize type is inherited from CodeEditorProps (now number | undefined)
  // onCodeChange signature is inherited from CodeEditorProps
}

const CodeEditor = ({
  onCodeChange,
  users = [],
  onCursorPositionChange,
  code,
  sendSelectionData,
  onLoadingChange,
  language,
  theme,
  fontSize = 14, // Default number
  wordWrap,
  showLineNumbers,
  onEditorDidMount,
  localUserId,
  isSessionActive = false,
}: ExtendedCodeEditorProps) => {
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
      if (!editorRef.current) return;
      if (position) {
        editorRef.current.setPosition(position);
      }
      if (selection) {
        editorRef.current.setSelection(selection);
      }
      editorRef.current.focus();
    });
  };

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
        // Filter out the local user before generating styles
        .filter((user) => user.id !== localUserId)
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
  }, [users, localUserId]);

  // Function to apply decorations based on the users prop
  const updateDecorations = () => {
    if (!editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) {
      console.warn(
        "[CodeEditor updateDecorations] Cannot get model from editor."
      );
      return;
    }

    const modelUri = model.uri.toString();
    console.log(
      `[CodeEditor updateDecorations] Applying decorations for model URI: ${modelUri}, Raw Users Prop:`,
      JSON.stringify(users) // Log raw prop
    );
    console.log(`[CodeEditor updateDecorations] Local User ID: ${localUserId}`); // Log local ID

    // Filter out the local user before generating decorations
    const remoteUsersToDecorate = users.filter(
      (user) => user.id !== localUserId
    );
    console.log(
      `[CodeEditor updateDecorations] Filtered Remote Users to Decorate (${remoteUsersToDecorate.length}):`,
      JSON.stringify(remoteUsersToDecorate) // Log filtered users
    );

    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    // Use the filtered list here
    remoteUsersToDecorate.forEach((user) => {
      // +++ Add detailed log for each user +++
      console.log(
        `[CodeEditor updateDecorations] Processing User: ${user.id} (${user.name})`,
        `CursorPos: ${JSON.stringify(user.cursorPosition)}`,
        `Selection: ${JSON.stringify(user.selection)}`
      );

      // First handle cursor position (independent of selection)
      if (user.cursorPosition) {
        console.log(
          `[CodeEditor updateDecorations] User ${user.id} - Rendering cursor decoration for position:`,
          user.cursorPosition // Keep original log
        );

        const cursorPosRange = new monaco.Range(
          user.cursorPosition.lineNumber,
          user.cursorPosition.column,
          user.cursorPosition.lineNumber,
          user.cursorPosition.column
        );

        // Add the cursor decoration (always show when cursor position exists)
        decorations.push({
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
      } else {
        // +++ Add log for missing cursor pos +++
        console.log(
          `[CodeEditor updateDecorations] User ${user.id} - No cursorPosition found. Attempting to infer from selection.`
        );
        // Try to infer cursor position from selection if available
        // This ensures cursors appear even when only selection data is transmitted
        if (
          user.selection &&
          user.selection.ranges &&
          user.selection.ranges.length > 0
        ) {
          const primaryRange = user.selection.ranges[0];
          if (primaryRange) {
            try {
              // Use head position for cursor (usually where the cursor would be in a selection)
              const headPos = offsetToPosition(model, primaryRange.head);

              const cursorPosRange = new monaco.Range(
                headPos.lineNumber,
                headPos.column,
                headPos.lineNumber,
                headPos.column
              );

              // Add inferred cursor decoration
              decorations.push({
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
            } catch (error) {
              console.error(
                "[CodeEditor updateDecorations] Error inferring cursor from selection:",
                error
              );
            }
          }
        }
      }

      // Then handle selection (only if non-empty)
      if (
        user.selection &&
        user.selection.ranges &&
        user.selection.ranges.length > 0
      ) {
        const primaryRange = user.selection.ranges[0];
        if (primaryRange) {
          console.log(
            `[CodeEditor updateDecorations] User ${user.id} - Checking selection:`,
            primaryRange
          );

          try {
            // Convert offsets to positions
            const anchorPos = offsetToPosition(model, primaryRange.anchor);
            const headPos = offsetToPosition(model, primaryRange.head);

            // Only create a selection decoration if it's non-empty
            if (
              anchorPos.lineNumber !== headPos.lineNumber ||
              anchorPos.column !== headPos.column
            ) {
              console.log(
                `[CodeEditor updateDecorations] User ${user.id} - Creating selection decoration for non-empty range`
              );

              const monacoRange = new monaco.Range(
                anchorPos.lineNumber,
                anchorPos.column,
                headPos.lineNumber,
                headPos.column
              );

              // Add the selection decoration
              decorations.push({
                range: monacoRange,
                options: {
                  className: `user-${user.id}-selection`,
                  hoverMessage: { value: `Selected by ${user.name}` },
                },
              });
            }
          } catch (error) {
            console.error(
              "[CodeEditor updateDecorations] Error converting selection offsets:",
              error,
              primaryRange
            );
          }
        }
      }
    });

    console.log(
      `[CodeEditor updateDecorations] Generated Decorations array before applying (${decorations.length}):`,
      JSON.stringify(decorations) // Log the final array
    );

    // Apply the decorations
    try {
      const decorationIds = editorRef.current.deltaDecorations(
        decorationsRef.current,
        decorations
      );
      decorationsRef.current = decorationIds;
      console.log(
        `[CodeEditor updateDecorations] Applied Decorations to ${modelUri}, IDs:`,
        decorationIds
      );
    } catch (error) {
      console.error(
        "[CodeEditor updateDecorations] Error applying decorations:",
        error
      );
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        []
      );
    }
  };

  // Editor Mount Handler (type corrected by OnMount)
  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    onEditorDidMount?.(editor);

    // Setup listener for local changes (only if OT is NOT active initially?)
    // OR let the hook handle sending changes regardless
    // editor.onDidChangeModelContent((event) => {
    //   if (isUpdatingRef.current) return; // Avoid feedback loop
    //   onCodeChange(editor.getValue(), event.changes);
    // });

    // Cursor/Selection Changes
    let cursorListener: IDisposable | null = null;
    let selectionListener: IDisposable | null = null;
    cursorListener = editor.onDidChangeCursorPosition((e) => {
      // ... (cursor change logic)
    });
    selectionListener = editor.onDidChangeCursorSelection((e) => {
      // ... (selection change logic)
    });

    // Initial decoration update
    updateDecorations();

    // Set focus after mount
    editor.focus();

    // Cleanup listeners on unmount
    return () => {
      cursorListener?.dispose();
      selectionListener?.dispose();
    };
  };

  // Editor Change Handler (type corrected by OnChange)
  const handleEditorChange: OnChange = (value, event) => {
    // Only call the prop for non-OT updates
    if (!isSessionActive && value !== undefined) {
      onCodeChange(value, event.changes); // Correct signature used
    }
  };

  // Editor Options (Corrected types based on prop changes)
  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    fontSize: fontSize, // Pass number directly
    wordWrap: wordWrap ? "on" : "off",
    lineNumbers: showLineNumbers ? "on" : "off",
    glyphMargin: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    readOnly: false,
    automaticLayout: true,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
    renderLineHighlight: "none",
    quickSuggestions: { other: false, comments: false, strings: false },
    parameterHints: { enabled: false },
    codeLens: false,
    hover: { enabled: true, delay: 300 },
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        width="100%"
        language={language}
        theme={theme}
        value={code}
        options={editorOptions}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        loading={<div>Loading Editor...</div>}
      />
    </div>
  );
};

export default CodeEditor;
