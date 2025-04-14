import React from "react";
import {
  VscFiles,
  VscSearch,
  VscAccount,
  VscSettingsGear,
  VscFile,
} from "react-icons/vsc";
import { GrChatOption, GrShareOption } from "react-icons/gr";
import JoinSessionPanel from "./JoinSessionPanel"; // Assuming JoinSessionPanel is in the same dir
import { OpenFile, JoinStateType, EditorLanguageKey } from "../types/editor"; // Adjust path as needed
// import { RemoteUser } from '../types/props'; // Not needed directly in Sidebar
import { MOCK_FILES } from "../constants/mockFiles"; // Adjust path as needed - or pass as prop
import {
  languageIconMap,
  languageColorMap,
  defaultIconColor,
} from "../constants/mappings"; // Adjust path as needed
import { ICON_BAR_WIDTH, EXPLORER_HANDLE_WIDTH } from "../constants/layout"; // Adjust path as needed
import { COLORS } from "../constants/colors"; // Import COLORS here

interface SidebarProps {
  // Refs for resizable panel hook (passed from App.tsx)
  sidebarContainerRef: React.RefObject<HTMLDivElement>;
  explorerPanelRef: React.RefObject<HTMLDivElement>; // Pass the ref for the panel itself

  // Resizable Panel State & Handlers (from useResizablePanel in App.tsx)
  isExplorerCollapsed: boolean;
  explorerPanelSize: number; // The calculated width (size - ICON_BAR_WIDTH)
  handleExplorerPanelMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  toggleExplorerPanel: () => void; // Needed for file icon click

  // Sidebar State & Handlers (managed in App.tsx)
  activeIcon: string | null;
  setActiveIcon: React.Dispatch<React.SetStateAction<string | null>>;

  // Join State & Panel Props (managed in App.tsx)
  joinState: JoinStateType;
  userName: string;
  userColor: string;
  isColorPickerOpen: boolean;
  // colors: string[]; // Defined locally now
  handleNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleColorSelect: (color: string) => void;
  handleToggleColorPicker: () => void;
  handleConfirmJoin: () => void;

  // File Explorer Props (managed in App.tsx)
  activeFileId: string | null;
  handleOpenFile: (fileId: string) => void;
  mockFiles: typeof MOCK_FILES; // Pass MOCK_FILES constant
}

const Sidebar: React.FC<SidebarProps> = ({
  sidebarContainerRef,
  explorerPanelRef, // Receive the ref
  isExplorerCollapsed,
  explorerPanelSize,
  handleExplorerPanelMouseDown,
  toggleExplorerPanel,
  activeIcon,
  setActiveIcon,
  joinState,
  userName,
  userColor,
  isColorPickerOpen,
  // colors, // Removed from props
  handleNameChange,
  handleColorSelect,
  handleToggleColorPicker,
  handleConfirmJoin,
  activeFileId,
  handleOpenFile,
  mockFiles,
}) => {
  // Moved from App.tsx
  const handleIconClick = (iconName: string | null) => {
    if (joinState === "prompting") return; // Prevent changing view during join prompt
    if (iconName === "files") {
      toggleExplorerPanel(); // Use the passed toggle function
      // setActiveIcon logic is handled by the onToggle callback in App.tsx's useResizablePanel
    } else {
      // If clicking a different icon, collapse the explorer if it's open
      if (!isExplorerCollapsed) {
        toggleExplorerPanel();
      }
      // Set the new icon as active
      setActiveIcon(iconName);
    }
  };

  return (
    // Container Ref passed from App.tsx for useResizablePanel hook
    <div
      ref={sidebarContainerRef}
      className="flex flex-shrink-0 h-full relative"
    >
      {/* Icon Bar JSX */}
      <div
        className="bg-stone-800 bg-opacity-60 flex flex-col justify-between py-2 border-r border-stone-600 flex-shrink-0 z-10"
        style={{ width: `${ICON_BAR_WIDTH}px` }}
      >
        {/* Top Icons */}
        <div className="flex flex-col items-center space-y-3">
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "files"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleIconClick("files")}
          >
            <VscFiles size={24} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "search"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleIconClick("search")}
          >
            <VscSearch size={24} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "share"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleIconClick("share")}
          >
            <GrShareOption size={26} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "chat"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleIconClick("chat")}
          >
            <GrChatOption size={24} />
          </button>
        </div>
        {/* Bottom Icons */}
        <div className="flex flex-col items-center space-y-3">
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "account"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleIconClick("account")}
          >
            <VscAccount size={24} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "settings"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleIconClick("settings")}
          >
            <VscSettingsGear size={24} />
          </button>
        </div>
      </div>

      {/* File Tree / Join Panel Area */}
      {/* This div needs the explorerPanelRef from App.tsx */}
      {/* We also need the calculated width `explorerPanelSize` */}
      <div
        ref={explorerPanelRef} // <-- Attach the passed ref here
        className={`bg-stone-800 bg-opacity-60 overflow-hidden flex flex-col h-full border-r border-stone-600 flex-shrink-0 ${
          !isExplorerCollapsed ? "visible" : "invisible w-0"
        }`}
        style={{ width: `${explorerPanelSize}px` }}
      >
        {/* --- Add Log --- */}
        {/* Removed log from here, can add back if needed */}
        {/* --- End Log --- */}

        {joinState === "prompting" ? (
          // Render Join Panel if prompting
          <JoinSessionPanel
            userName={userName}
            userColor={userColor}
            isColorPickerOpen={isColorPickerOpen}
            colors={COLORS} // Use imported constant
            onNameChange={handleNameChange} // Use passed prop
            onColorSelect={handleColorSelect} // Use passed prop
            onToggleColorPicker={handleToggleColorPicker} // Use passed prop
            onConfirmJoin={() => {
              handleConfirmJoin(); // Use passed prop
              // Ensure explorer is open after confirming join
              if (isExplorerCollapsed) {
                toggleExplorerPanel(); // Use passed prop
              }
            }}
          />
        ) : (
          // Otherwise, render the normal File Tree (only if files icon active)
          activeIcon === "files" && (
            <div className="flex-1 overflow-y-auto h-full">
              <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-60 z-10">
                EXPLORER
              </div>
              <div className="w-full">
                {Object.entries(mockFiles).map(([id, file]) => {
                  // Use passed prop
                  const IconComponent =
                    languageIconMap[file.language as EditorLanguageKey] ||
                    VscFile; // Cast needed?
                  const iconColor =
                    languageColorMap[file.language as EditorLanguageKey] ||
                    defaultIconColor;
                  return (
                    <div
                      key={id}
                      className={`flex items-center text-sm py-1 cursor-pointer w-full pl-0 ${
                        activeFileId === id
                          ? "bg-stone-600 shadow-[inset_0_1px_0_#78716c,inset_0_-1px_0_#78716c]"
                          : "hover:bg-stone-700"
                      }`}
                      onClick={() => handleOpenFile(id)} // Use passed prop
                    >
                      <IconComponent
                        size={18}
                        className={`ml-2 mr-1 flex-shrink-0 ${iconColor}`}
                      />
                      <span
                        className={`w-full pl-1 truncate ${
                          activeFileId === id
                            ? "text-stone-100"
                            : "text-stone-300"
                        }`}
                      >
                        {file.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
          // TODO: Add rendering for other activeIcon states (Search, Share, Chat) here if needed
        )}
      </div>

      {/* Explorer Resizer Handle */}
      {/* Show only when files icon is active and panel is not collapsed */}
      {activeIcon === "files" && !isExplorerCollapsed && (
        <div
          className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
          style={{
            width: `${EXPLORER_HANDLE_WIDTH}px`,
            // Position based on hook size and ICON_BAR_WIDTH
            left: `${
              ICON_BAR_WIDTH + explorerPanelSize - EXPLORER_HANDLE_WIDTH / 2
            }px`,
            pointerEvents: "auto", // Ensure it's interactive
          }}
          onMouseDown={handleExplorerPanelMouseDown} // Use passed prop
        />
      )}
    </div>
  );
};

export default Sidebar;
