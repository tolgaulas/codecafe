import React, { useState } from "react";
import {
  VscFiles,
  VscSearch,
  VscAccount,
  VscSettingsGear,
  VscFile,
  VscChevronDown,
  VscChevronRight,
  VscCaseSensitive,
  VscWholeWord,
  VscRegex,
  VscReplaceAll,
} from "react-icons/vsc";
import { GrChatOption, GrShareOption } from "react-icons/gr";
import JoinSessionPanel from "./JoinSessionPanel";
import ChatPanel from "./ChatPanel";
import SearchPanel from "./SearchPanel";
import SessionParticipantsPanel from "./SessionParticipantsPanel";
import { RemoteUser } from "../types/props";
import {
  JoinStateType,
  EditorLanguageKey,
  SearchOptions,
  MatchInfo,
} from "../types/editor";
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
  openPanelWithIcon: (iconName: string) => void;

  activeIcon: string | null;
  setActiveIcon: React.Dispatch<React.SetStateAction<string | null>>;

  joinState: JoinStateType;
  sessionId: string | null;
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

  // Props for SearchPanel (will be passed through)
  onSearchChange: (term: string, options: SearchOptions) => void;
  onReplaceChange: (term: string) => void;
  onToggleSearchOption: (option: keyof SearchOptions) => void;
  replaceValue: string;
  searchOptions: SearchOptions;
  matchInfo: MatchInfo | null;
  onReplaceAll: () => void;

  handleShareIconClick: () => void;

  // Props for SessionParticipantsPanel
  uniqueRemoteParticipants: RemoteUser[];
  localUserName: string;
  localUserColor: string;
}

const Sidebar = ({
  sidebarContainerRef,
  explorerPanelRef,
  isExplorerCollapsed,
  explorerPanelSize,
  handleExplorerPanelMouseDown,
  toggleExplorerPanel,
  openPanelWithIcon,
  activeIcon,
  setActiveIcon,
  joinState,
  sessionId,
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
  onSearchChange,
  onReplaceChange,
  onToggleSearchOption,
  replaceValue,
  searchOptions,
  matchInfo,
  onReplaceAll,
  handleShareIconClick,
  uniqueRemoteParticipants,
  localUserName,
  localUserColor,
}: SidebarProps) => {
  const [isProjectExpanded, setIsProjectExpanded] = useState(true);

  const handleGenericIconClick = (iconName: string) => {
    if (joinState === "prompting" && activeIcon === "share") {
      openPanelWithIcon(iconName);
      return;
    }

    if (isExplorerCollapsed) {
      openPanelWithIcon(iconName);
    } else {
      if (iconName === activeIcon) {
        setActiveIcon(null);
      } else {
        openPanelWithIcon(iconName);
      }
    }
  };

  const toggleProjectFolder = () => {
    setIsProjectExpanded(!isProjectExpanded);
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
            onClick={() => handleGenericIconClick("files")}
          >
            <VscFiles size={24} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "search"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleGenericIconClick("search")}
          >
            <VscSearch size={24} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "share"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={handleShareIconClick}
          >
            <GrShareOption size={26} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "chat"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleGenericIconClick("chat")}
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
            onClick={() => handleGenericIconClick("account")}
          >
            <VscAccount size={24} />
          </button>
          <button
            className={`w-full flex justify-center py-1 ${
              activeIcon === "settings"
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-200"
            }`}
            onClick={() => handleGenericIconClick("settings")}
          >
            <VscSettingsGear size={24} />
          </button>
        </div>
      </div>

      {/* File Tree / Join Panel / Chat Panel Area */}
      <div
        ref={explorerPanelRef}
        className={`bg-stone-800 bg-opacity-60 overflow-hidden flex flex-col h-full border-r border-stone-600 flex-shrink-0 ${
          !isExplorerCollapsed ? "visible" : "invisible w-0"
        }`}
        style={{ width: `${explorerPanelSize}px` }}
      >
        <>
          <div
            className={`flex-1 ${
              (activeIcon === "files" || activeIcon === null) &&
              joinState !== "prompting"
                ? ""
                : "hidden"
            }`}
          >
            <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-60 z-10">
              EXPLORER
            </div>
            <div className="w-full h-full overflow-y-auto">
              <button
                className="flex items-center text-xs py-1 cursor-pointer w-full hover:bg-stone-700"
                onClick={toggleProjectFolder}
              >
                <div
                  className="flex items-center justify-center pl-1 mr-1"
                  style={{ width: "1rem" }}
                >
                  {" "}
                  {isProjectExpanded ? (
                    <VscChevronDown
                      size={16}
                      className="flex-shrink-0 text-stone-500"
                    />
                  ) : (
                    <VscChevronRight
                      size={16}
                      className="flex-shrink-0 text-stone-500"
                    />
                  )}
                </div>
                <span className="font-medium text-stone-500 truncate">
                  MY CODECAFE PROJECT
                </span>
              </button>

              {isProjectExpanded && (
                <div className="relative">
                  <div className="absolute top-0 bottom-0 left-[12px] w-px bg-stone-600/50 z-0"></div>

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
                        className={`relative flex items-center text-sm py-1 cursor-pointer w-full pl-4 z-10 ${
                          activeFileId === id
                            ? "bg-stone-600/50 shadow-[inset_0_1px_0_#78716c,inset_0_-1px_0_#78716c] hover:bg-stone-600/50"
                            : "hover:bg-stone-700/50"
                        }`}
                        onClick={() => handleOpenFile(id, isSessionActive)}
                      >
                        <IconComponent
                          size={18}
                          className={`mr-1 flex-shrink-0 ${iconColor}`}
                        />
                        <span
                          className={`w-full truncate ${
                            activeFileId === id
                              ? "text-stone-100"
                              : "text-stone-400"
                          }`}
                        >
                          {file.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={`flex-1 ${activeIcon === "chat" ? "" : "hidden"}`}>
            <ChatPanel userName={userName} userColor={userColor} />
          </div>

          <SearchPanel
            activeIcon={activeIcon}
            onSearchChange={onSearchChange}
            onReplaceChange={onReplaceChange}
            onToggleSearchOption={onToggleSearchOption}
            replaceValue={replaceValue}
            searchOptions={searchOptions}
            matchInfo={matchInfo}
            onReplaceAll={onReplaceAll}
          />

          {/* Share Panel: Shows JoinSessionPanel or SessionParticipantsPanel */}
          {activeIcon === "share" && (
            <>
              {!isSessionActive && joinState === "prompting" && (
                <JoinSessionPanel
                  userName={userName}
                  userColor={userColor}
                  isColorPickerOpen={isColorPickerOpen}
                  colors={COLORS}
                  onNameChange={handleNameChange}
                  onColorSelect={handleColorSelect}
                  onToggleColorPicker={handleToggleColorPicker}
                  onConfirmJoin={handleConfirmJoin}
                />
              )}
              {isSessionActive && (
                <SessionParticipantsPanel
                  key={`${sessionId || "no-session"}-${
                    uniqueRemoteParticipants.length
                  }`}
                  activeIcon={activeIcon}
                  participants={uniqueRemoteParticipants}
                  localUser={{ name: localUserName, color: localUserColor }}
                />
              )}
            </>
          )}

          <div
            className={`p-4 text-stone-400 ${
              activeIcon === "account" ? "" : "hidden"
            }`}
          >
            Account Panel (Not Implemented)
          </div>

          <div
            className={`p-4 text-stone-400 ${
              activeIcon === "settings" ? "" : "hidden"
            }`}
          >
            Settings Panel (Not Implemented)
          </div>
        </>
      </div>

      {!isExplorerCollapsed && (
        <div
          className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
          style={{
            width: `${EXPLORER_HANDLE_WIDTH}px`,
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
