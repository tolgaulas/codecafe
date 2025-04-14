import React from "react";
import {
  VscFiles,
  VscSearch,
  VscAccount,
  VscSettingsGear,
  VscFile,
} from "react-icons/vsc";
import { GrChatOption, GrShareOption } from "react-icons/gr";
import JoinSessionPanel from "./JoinSessionPanel";
import { JoinStateType, EditorLanguageKey } from "../types/editor";
import { MOCK_FILES } from "../constants/mockFiles";
import {
  languageIconMap,
  languageColorMap,
  defaultIconColor,
} from "../constants/mappings";
import { ICON_BAR_WIDTH, EXPLORER_HANDLE_WIDTH } from "../constants/layout";
import { COLORS } from "../constants/colors";

interface SidebarProps {
  // Refs for resizable panel hook
  sidebarContainerRef: React.RefObject<HTMLDivElement>;
  explorerPanelRef: React.RefObject<HTMLDivElement>;

  isExplorerCollapsed: boolean;
  explorerPanelSize: number;
  handleExplorerPanelMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  toggleExplorerPanel: () => void;

  activeIcon: string | null;
  setActiveIcon: React.Dispatch<React.SetStateAction<string | null>>;

  joinState: JoinStateType;
  userName: string;
  userColor: string;
  isColorPickerOpen: boolean;
  handleNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleColorSelect: (color: string) => void;
  handleToggleColorPicker: () => void;
  handleConfirmJoin: () => void;

  // File Explorer Props
  activeFileId: string | null;
  handleOpenFile: (fileId: string, isSessionActive: boolean) => void;
  mockFiles: typeof MOCK_FILES;
  isSessionActive: boolean;
}

const Sidebar = ({
  sidebarContainerRef,
  explorerPanelRef,
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
  handleNameChange,
  handleColorSelect,
  handleToggleColorPicker,
  handleConfirmJoin,
  activeFileId,
  handleOpenFile,
  mockFiles,
  isSessionActive,
}: SidebarProps) => {
  const handleIconClick = (iconName: string | null) => {
    if (joinState === "prompting") return;
    if (iconName === "files") {
      toggleExplorerPanel();
    } else {
      if (!isExplorerCollapsed) {
        toggleExplorerPanel();
      }
      setActiveIcon(iconName);
    }
  };

  return (
    <div
      ref={sidebarContainerRef}
      className="flex flex-shrink-0 h-full relative"
    >
      {/* Icon Bar */}
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
      <div
        ref={explorerPanelRef}
        className={`bg-stone-800 bg-opacity-60 overflow-hidden flex flex-col h-full border-r border-stone-600 flex-shrink-0 ${
          !isExplorerCollapsed ? "visible" : "invisible w-0"
        }`}
        style={{ width: `${explorerPanelSize}px` }}
      >
        {joinState === "prompting" ? (
          <JoinSessionPanel
            userName={userName}
            userColor={userColor}
            isColorPickerOpen={isColorPickerOpen}
            colors={COLORS}
            onNameChange={handleNameChange}
            onColorSelect={handleColorSelect}
            onToggleColorPicker={handleToggleColorPicker}
            onConfirmJoin={() => {
              handleConfirmJoin();
              if (isExplorerCollapsed) {
                toggleExplorerPanel();
              }
            }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto h-full">
            <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-60 z-10">
              EXPLORER
            </div>
            <div className="w-full">
              {Object.entries(mockFiles).map(([id, file]) => {
                const IconComponent =
                  languageIconMap[file.language as EditorLanguageKey] ||
                  VscFile;
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
                    onClick={() => handleOpenFile(id, isSessionActive)}
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
        )}
      </div>

      {!isExplorerCollapsed && (
        <div
          className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
          style={{
            width: `${EXPLORER_HANDLE_WIDTH}px`,
            // Position based on hook size and ICON_BAR_WIDTH
            left: `${
              ICON_BAR_WIDTH + explorerPanelSize - EXPLORER_HANDLE_WIDTH / 2
            }px`,
            pointerEvents: "auto", 
          }}
          onMouseDown={handleExplorerPanelMouseDown} 
        />
      )}
    </div>
  );
};

export default Sidebar;
