import React from "react";
import { editor } from "monaco-editor";

import { OpenFile, EditorLanguageKey, TerminalRef } from "../types/editor";
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

interface MainEditorAreaProps {
  // Refs (passed down)
  editorTerminalAreaRef: React.RefObject<HTMLDivElement>;
  tabContainerRef: React.RefObject<HTMLDivElement>;
  terminalRef: React.MutableRefObject<TerminalRef | undefined>;
  editorInstanceRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>; // Pass the mutable ref object

  // Tab Management
  openFiles: OpenFile[];
  setOpenFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>; // Needed for drag end
  activeFileId: string | null;
  setActiveFileId: React.Dispatch<React.SetStateAction<string | null>>; // Needed if closing last tab? or maybe handleSwitchTab is enough
  handleSwitchTab: (fileId: string) => void;
  handleCloseTab: (fileIdToClose: string, e: React.MouseEvent) => void;
  draggingId: string | null; // State for drag overlay
  setDraggingId: React.Dispatch<React.SetStateAction<string | null>>; // To set on drag start/end
  dropIndicator: { tabId: string | null; side: "left" | "right" | null }; // State for drop indicator
  setDropIndicator: React.Dispatch<
    React.SetStateAction<{
      tabId: string | null;
      side: "left" | "right" | null;
    }>
  >; // To set on drag move/end

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
  isWebViewVisible: boolean; // To conditionally render WebViewPanel & Resizer
  handleWebViewPanelMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  htmlFileContent: string;
  cssFileContent: string;
  jsFileContent: string;
  toggleWebView: () => void; // Pass toggle function for WebViewPanel close button
}

const MainEditorArea: React.FC<MainEditorAreaProps> = ({
  editorTerminalAreaRef,
  tabContainerRef,
  terminalRef,
  editorInstanceRef,
  openFiles,
  setOpenFiles,
  activeFileId,
  setActiveFileId,
  handleSwitchTab,
  handleCloseTab,
  draggingId,
  setDraggingId,
  dropIndicator,
  setDropIndicator,
  fileContents,
  handleCodeChange,
  handleEditorDidMount,
  currentRemoteUsers,
  localUserId,
  terminalPanelHeight,
  isTerminalCollapsed,
  handleTerminalPanelMouseDown,
  webViewPanelWidth,
  isWebViewVisible,
  handleWebViewPanelMouseDown,
  htmlFileContent,
  cssFileContent,
  jsFileContent,
  toggleWebView,
}) => {
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
          openFiles={openFiles}
          setOpenFiles={setOpenFiles}
          activeFileId={activeFileId}
          setActiveFileId={setActiveFileId}
          handleSwitchTab={handleSwitchTab}
          handleCloseTab={handleCloseTab}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          dropIndicator={dropIndicator}
          setDropIndicator={setDropIndicator}
        />

        {/* Code Editor */}
        <div className="flex-1 overflow-auto font-mono text-sm relative bg-neutral-900 min-h-0 pt-4">
          {activeFileId && openFiles.find((f) => f.id === activeFileId) ? (
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
      {isWebViewVisible && webViewPanelWidth > 0 && (
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
      {isWebViewVisible && webViewPanelWidth > 0 && (
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
