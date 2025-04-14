import { useRef, useEffect } from "react";
import { Editor, loader } from "@monaco-editor/react";
import { CodeEditorProps } from "../types/props";
import * as monaco from "monaco-editor";
import { THEMES } from "../constants/themes";
import {
  OTSelection,
  positionToOffset,
  offsetToPosition,
} from "../ot/TextOperationSystem";

// Extend props to include isSessionActive
interface ExtendedCodeEditorProps extends CodeEditorProps {
  isSessionActive?: boolean; // Optional for now
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
  fontSize,
  wordWrap,
  showLineNumbers,
  onEditorDidMount,
  localUserId,
  isSessionActive = false, // Default to false if not provided
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

  // Handle code updates with improved cursor preservation
  useEffect(() => {
    // *** ONLY RUN IF NOT IN A SESSION ***
    if (isSessionActive) {
      console.log(
        "[CodeEditor code update Effect] Skipping due to active session."
      );
      return;
    }
    // *** END CONDITION ***

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

      if (!model) {
        console.error("[CodeEditor code update] Cannot get model from editor.");
        isUpdatingRef.current = false; // Reset flag if model is null
        return;
      }

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
  }, [code, isSessionActive]);

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

  // Handle editor mount
  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor
  ) => {
    editorRef.current = editor;
    // *** DO NOT attach listeners here anymore ***
    updateDecorations(); // Initial decoration update
    if (onEditorDidMount) {
      onEditorDidMount(editor);
    }
  };

  // Effect to manage cursor/selection listener
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !sendSelectionData) return; // Need editor and the callback prop

    console.log(
      "[CodeEditor useEffect] Attaching onDidChangeCursorPosition listener."
    );
    const listener = editor.onDidChangeCursorPosition(
      (e: monaco.editor.ICursorPositionChangedEvent) => {
        const currentEditor = editorRef.current; // Re-check ref inside callback

        // --- Add Reason Check ---
        // Only send data if the change was likely user-initiated
        const userInitiatedReasons = [
          monaco.editor.CursorChangeReason.Explicit, // e.g., mouse click
          monaco.editor.CursorChangeReason.Paste,
          // Consider adding Undo/Redo if desired
          // monaco.editor.CursorChangeReason.Undo,
          // monaco.editor.CursorChangeReason.Redo,
        ];
        if (!userInitiatedReasons.includes(e.reason)) {
          // console.log(`[CodeEditor] Ignoring cursor change due to reason: ${monaco.editor.CursorChangeReason[e.reason] || e.reason}`);
          return; // Don't send selection data for programmatic changes
        }
        // --- End Reason Check ---

        if (isUpdatingRef.current || !currentEditor) return;
        const currentModel = currentEditor.getModel();
        if (!currentModel) return;

        const position = e.position;
        const selection = currentEditor.getSelection();

        // Call the prop directly
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

        // Call the function passed via props
        sendSelectionData({
          cursorPosition: {
            lineNumber: position.lineNumber,
            column: position.column,
          },
          selection: otSelectionToSend,
        });
      }
    );

    // Cleanup function to remove the listener when component unmounts or sendSelectionData changes
    return () => {
      console.log(
        "[CodeEditor useEffect] Disposing onDidChangeCursorPosition listener."
      );
      listener.dispose();
    };
  }, [sendSelectionData]); // Dependency: re-run if sendSelectionData function identity changes

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
          handleEditorDidMount(editor); // Does not attach listener anymore
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
