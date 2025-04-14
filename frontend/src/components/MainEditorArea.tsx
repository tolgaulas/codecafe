import React from "react";
import { editor } from "monaco-editor";

import {
  OpenFile,
  EditorLanguageKey,
  TerminalRef,
  JoinStateType,
} from "../types/editor";
import { RemoteUser } from "../types/props";
import CodeEditor from "./CodeEditor";
import TerminalComponent from "./TerminalComponent";
import WebViewPanel from "./WebViewPanel";
import FileTabs from "./FileTabs";
import {
  languageIconMap,
  languageColorMap,
  defaultIconColor,
  editorLanguageMap,
} from "../constants/mappings"; // Adjust path
import { VscFile } from "react-icons/vsc";
import {
  TERMINAL_HANDLE_HEIGHT,
  WEBVIEW_HANDLE_GRAB_WIDTH,
} from "../constants/layout"; // Adjust path
import { useFileStore } from "../store/useFileStore"; // <-- Import Zustand store

interface MainEditorAreaProps {
  // Refs (passed down)
  editorTerminalAreaRef: React.RefObject<HTMLDivElement>;
  tabContainerRef: React.RefObject<HTMLDivElement>;
  terminalRef: React.MutableRefObject<TerminalRef | undefined>;
  editorInstanceRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;

  // Tab Management (These are now handled by FileTabs directly using the store)
  // openFiles: OpenFile[];
  // setOpenFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>;
  // activeFileId: string | null;
  // setActiveFileId: (id: string | null) => void;
  handleSwitchTab: (fileId: string) => void; // Still passed from App
  handleCloseTab: (fileIdToClose: string) => void; // <-- Update signature
  // draggingId: string | null;
  // setDraggingId: (id: string | null) => void;
  // dropIndicator: { tabId: string | null; side: "left" | "right" | null };
  // setDropIndicator: (indicator: { tabId: string | null; side: "left" | "right" | null }) => void;

  // Editor
  fileContents: { [id: string]: string };
  handleCodeChange: (newCode: string) => void;
  handleEditorDidMount: (editorInstance: editor.IStandaloneCodeEditor) => void;
  currentRemoteUsers: RemoteUser[];
  localUserId: string;

  // Terminal Resizing
  terminalPanelHeight: number;
  isTerminalCollapsed: boolean;
  handleTerminalPanelMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;

  // WebView Resizing & Content
  webViewPanelWidth: number;
  handleWebViewPanelMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  htmlFileContent: string;
  cssFileContent: string;
  jsFileContent: string;
  toggleWebView: () => void; // Pass toggle function for WebViewPanel close button
  isSessionActive: boolean; // <-- Add prop
  joinState: JoinStateType; // <-- Add joinState prop
}

const MainEditorArea: React.FC<MainEditorAreaProps> = ({
  editorTerminalAreaRef,
  tabContainerRef,
  terminalRef,
  editorInstanceRef,
  handleSwitchTab,
  handleCloseTab,
  fileContents,
  handleCodeChange,
  handleEditorDidMount,
  currentRemoteUsers,
  localUserId,
  terminalPanelHeight,
  isTerminalCollapsed,
  handleTerminalPanelMouseDown,
  webViewPanelWidth,
  handleWebViewPanelMouseDown,
  htmlFileContent,
  cssFileContent,
  jsFileContent,
  toggleWebView,
  isSessionActive, // <-- Destructure prop
  joinState, // <-- Destructure joinState
}) => {
  // --- Get state from Zustand Store ---
  const {
    openFiles,
    activeFileId,
    // We don't need the setters here, FileTabs uses them
  } = useFileStore();
  // --- End Zustand Store ---

  return (
    <div className="flex flex-1 min-w-0 relative">
      {/* Code and Terminal Area */}
      <div
        ref={editorTerminalAreaRef}
        className="flex-1 flex flex-col relative overflow-x-hidden min-w-0"
      >
        {/* Tabs - Use extracted component */}
        <FileTabs
          tabContainerRef={tabContainerRef}
          handleSwitchTab={handleSwitchTab}
          handleCloseTab={handleCloseTab}
        />

        {/* Code Editor Area - Conditional Rendering */}
        <div className="flex-1 overflow-auto font-mono text-sm relative bg-neutral-900 min-h-0 pt-4">
          {joinState === "prompting" ? (
            <div className="flex items-center justify-center h-full text-stone-500">
              Enter your details in the sidebar to join the session...
            </div>
          ) : activeFileId && openFiles.find((f) => f.id === activeFileId) ? (
            <CodeEditor
              theme="codeCafeTheme"
              language={
                editorLanguageMap[
                  openFiles.find((f) => f.id === activeFileId)?.language ||
                    "plaintext"
                ]
              }
              showLineNumbers={true}
              code={fileContents[activeFileId] ?? "// Loading..."}
              onCodeChange={handleCodeChange}
              onEditorDidMount={handleEditorDidMount}
              users={currentRemoteUsers}
              localUserId={localUserId}
              isSessionActive={isSessionActive}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-stone-500">
              Select a file to start editing.
            </div>
          )}
        </div>

        {/* Terminal Resizer */}
        <div
          className={`w-full bg-stone-700 flex-shrink-0 ${
            isTerminalCollapsed
              ? "cursor-pointer hover:bg-stone-500"
              : "cursor-row-resize hover:bg-stone-600 active:bg-stone-500"
          }`}
          style={{ height: `${TERMINAL_HANDLE_HEIGHT}px` }}
          onMouseDown={handleTerminalPanelMouseDown}
        />

        {/* Terminal Panel */}
        <div
          className={`bg-neutral-900 bg-opacity-90 flex flex-col border-t border-stone-600 flex-shrink-0 ${
            isTerminalCollapsed ? "hidden" : "flex"
          }`}
          style={{ height: `${terminalPanelHeight}px` }}
        >
          <div className="flex bg-stone-800 py-1 text-sm flex-shrink-0">
            <div className="px-4 py-1 text-stone-400 text-xs">TERMINAL</div>
          </div>
          <div className="flex-1 px-4 pt-2 font-mono text-sm overflow-hidden min-h-0">
            <TerminalComponent ref={terminalRef} height={terminalPanelHeight} />
          </div>
        </div>
      </div>

      {/* Invisible WebView Resizer Handle */}
      {webViewPanelWidth > 0 && (
        <div
          className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
          style={{
            width: `${WEBVIEW_HANDLE_GRAB_WIDTH}px`,
            left: `calc(100% - ${webViewPanelWidth}px - ${
              WEBVIEW_HANDLE_GRAB_WIDTH / 2
            }px)`,
          }}
          onMouseDown={handleWebViewPanelMouseDown}
        />
      )}

      {/* WebView Panel */}
      {webViewPanelWidth > 0 && (
        <div
          className="flex-shrink-0 border-l border-stone-600 overflow-hidden"
          style={{ width: `${webViewPanelWidth}px` }}
        >
          <WebViewPanel
            htmlContent={htmlFileContent}
            cssContent={cssFileContent}
            jsContent={jsFileContent}
            onClose={toggleWebView}
          />
        </div>
      )}
    </div>
  );
};

export default MainEditorArea;
