import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
  CollisionDetection,
  pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { editor } from "monaco-editor";

import { OpenFile, EditorLanguageKey, TerminalRef } from "../types/editor";
import { RemoteUser } from "../types/props";
import CodeEditor from "./CodeEditor";
import TerminalComponent from "./TerminalComponent";
import WebViewPanel from "./WebViewPanel";
import { SortableTab } from "./SortableTab";
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
  // dnd-kit Sensors (Instantiated here as DndContext is now here)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Drag Handlers (Moved from App.tsx)
  const handleDragStart = (event: DragStartEvent) => {
    console.log("Drag Start:", event);
    setDraggingId(event.active.id as string);
    setDropIndicator({ tabId: null, side: null }); // Clear indicator on start
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId = over?.id as string | undefined;
    const isValidTabTarget = overId && openFiles.some((f) => f.id === overId);

    if (!("clientX" in event.activatorEvent)) {
      setDropIndicator({ tabId: null, side: null });
      return;
    }
    const pointerX = (event.activatorEvent as PointerEvent).clientX;

    const firstTabEl = tabContainerRef.current?.querySelector(
      "[data-sortable-id]"
    ) as HTMLElement | null;
    const lastTabEl = tabContainerRef.current?.querySelector(
      "[data-sortable-id]:last-child"
    ) as HTMLElement | null;
    let edgeIndicatorSet = false;

    if (firstTabEl && lastTabEl && openFiles.length > 0) {
      const firstTabRect = firstTabEl.getBoundingClientRect();
      const lastTabRect = lastTabEl.getBoundingClientRect();
      const firstTabId = openFiles[0].id;
      const lastTabId = openFiles[openFiles.length - 1].id;

      if (pointerX < firstTabRect.left + firstTabRect.width * 0.5) {
        setDropIndicator({ tabId: firstTabId, side: "left" });
        edgeIndicatorSet = true;
      } else if (pointerX > lastTabRect.right - lastTabRect.width * 0.5) {
        setDropIndicator({ tabId: lastTabId, side: "right" });
        edgeIndicatorSet = true;
      }
    }

    if (!edgeIndicatorSet) {
      if (isValidTabTarget && overId) {
        if (activeId === overId) {
          setDropIndicator({ tabId: null, side: null });
          return;
        }

        const overNode = tabContainerRef.current?.querySelector(
          `[data-sortable-id="${overId}"]`
        );

        if (!overNode) {
          console.warn(
            "Could not find overNode using querySelector for id:",
            overId
          );
          setDropIndicator({ tabId: null, side: null });
          return;
        }
        const overRect = overNode.getBoundingClientRect();
        const overMiddleX = overRect.left + overRect.width / 2;
        const side = pointerX < overMiddleX ? "left" : "right";
        setDropIndicator({ tabId: overId, side });
      } else {
        setDropIndicator({ tabId: null, side: null });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const finalDropIndicator = { ...dropIndicator };
    const activeId = active.id as string;
    setDraggingId(null);
    setDropIndicator({ tabId: null, side: null });

    const oldIndex = openFiles.findIndex((file) => file.id === activeId);
    if (oldIndex === -1) return;

    let newIndex = -1;
    const firstFileId = openFiles[0]?.id;
    const lastFileId = openFiles[openFiles.length - 1]?.id;

    if (
      finalDropIndicator.side === "left" &&
      finalDropIndicator.tabId === firstFileId
    ) {
      newIndex = 0;
    } else if (
      finalDropIndicator.side === "right" &&
      finalDropIndicator.tabId === lastFileId
    ) {
      newIndex = openFiles.length - 1;
    } else if (over && over.id !== active.id) {
      const overId = over.id as string;
      const overIndex = openFiles.findIndex((file) => file.id === overId);
      if (overIndex !== -1) newIndex = overIndex;
    } else {
      // If dropped outside a valid target or onto itself without specific indicator, don't move.
      // Check if it was dropped back onto itself without an indicator being set
      if (active.id === over?.id && !finalDropIndicator.tabId) {
        return; // No move needed
      }
      // If no valid drop zone was determined (e.g., dropped in empty space)
      if (newIndex === -1) {
        return; // No move needed
      }
    }

    if (newIndex !== -1 && oldIndex !== newIndex) {
      setOpenFiles((prevFiles) => arrayMove(prevFiles, oldIndex, newIndex));
    }
  };

  return (
    <div className="flex flex-1 min-w-0 relative">
      {/* Code and Terminal Area */}
      <div
        ref={editorTerminalAreaRef}
        className="flex-1 flex flex-col relative overflow-x-hidden min-w-0"
      >
        {/* Tabs */}
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={tabContainerRef}
            className="flex bg-stone-800 flex-shrink-0 overflow-x-auto relative"
          >
            <SortableContext
              items={openFiles.map((f) => f.id)}
              strategy={horizontalListSortingStrategy}
            >
              {openFiles.map((file) => {
                const IconComponent = languageIconMap[file.language] || VscFile;
                const iconColor =
                  languageColorMap[file.language] || defaultIconColor;
                const indicatorSide =
                  dropIndicator.tabId === file.id ? dropIndicator.side : null;
                return (
                  <SortableTab
                    key={file.id}
                    file={file}
                    activeFileId={activeFileId}
                    draggingId={draggingId}
                    IconComponent={IconComponent}
                    iconColor={iconColor}
                    onSwitchTab={handleSwitchTab}
                    onCloseTab={handleCloseTab}
                    dropIndicatorSide={indicatorSide}
                  />
                );
              })}
            </SortableContext>
            <DragOverlay>
              {draggingId
                ? (() => {
                    const draggedFile = openFiles.find(
                      (f) => f.id === draggingId
                    );
                    if (!draggedFile) return null;
                    const IconComponent =
                      languageIconMap[draggedFile.language] || VscFile;
                    const iconColor =
                      languageColorMap[draggedFile.language] ||
                      defaultIconColor;
                    return (
                      <div
                        className={`pl-2 pr-4 py-1 border border-stone-500 flex items-center flex-shrink-0 relative shadow-lg bg-neutral-900`}
                      >
                        <IconComponent
                          size={16}
                          className={`mr-1.5 flex-shrink-0 ${iconColor}`}
                        />
                        <span
                          className={`text-sm -mt-0.5 select-none cursor-default text-stone-200`}
                        >
                          {draggedFile.name}
                        </span>
                        <span className="ml-2 text-stone-400 p-0.5 -mt-0.5 opacity-50">
                          ×
                        </span>
                      </div>
                    );
                  })()
                : null}
            </DragOverlay>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-600 z-0"></div>
          </div>
        </DndContext>

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
