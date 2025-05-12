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
import { JoinStateType, EditorLanguageKey } from "../types/editor";
import { MOCK_FILES } from "../constants/mockFiles";
import {
  languageIconMap,
  languageColorMap,
  defaultIconColor,
} from "../constants/mappings";
import { ICON_BAR_WIDTH, EXPLORER_HANDLE_WIDTH } from "../constants/layout";
import { COLORS } from "../constants/colors";

// Define types for search options and match info
interface SearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
  isRegex: boolean;
  preserveCase: boolean;
}

interface MatchInfo {
  currentIndex: number | null; // e.g., 1 for the first match
  totalMatches: number;
}

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

  onSearchChange: (term: string, options: SearchOptions) => void;
  onReplaceChange: (term: string) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onToggleSearchOption: (option: keyof SearchOptions) => void;
  replaceValue: string;
  searchOptions: SearchOptions;
  matchInfo: MatchInfo | null;
  onReplaceAll: () => void;
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
  onFindNext,
  onFindPrevious,
  onToggleSearchOption,
  replaceValue,
  searchOptions,
  matchInfo,
  onReplaceAll,
}: SidebarProps) => {
  const [isProjectExpanded, setIsProjectExpanded] = useState(true);
  const [searchValue, setSearchValue] = useState("");

  const handleIconClick = (iconName: string | null) => {
    if (joinState === "prompting" || !iconName) return;

    // Case 1: Panel is closed - Set the icon. Effect in App.tsx will open panel.
    if (isExplorerCollapsed) {
      openPanelWithIcon(iconName);
    }
    // Case 2: Panel is open.
    else {
      // Case 2a: Clicking the *same* icon that is already active - Set icon to null. Effect in App.tsx will close panel.
      if (iconName === activeIcon) {
        setActiveIcon(null);
      }
      // Case 2b: Clicking a *different* icon while the panel is open - Just switch the active icon.
      else {
        setActiveIcon(iconName);
      }
    }
  };

  const toggleProjectFolder = () => {
    setIsProjectExpanded(!isProjectExpanded);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchValue(term);
    onSearchChange(term, searchOptions);
  };

  const handleReplaceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onReplaceChange(e.target.value);
  };

  // Helper to format match count string
  const formatMatchCount = (): string => {
    if (!matchInfo || matchInfo.totalMatches === 0) {
      return "No results";
    }
    if (matchInfo.totalMatches === 1) {
      return "1 result";
    }
    return `${matchInfo.totalMatches} results`;
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

      {/* File Tree / Join Panel / Chat Panel Area */}
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
              // Set the icon to files. Effect in App.tsx will handle opening if needed.
              setActiveIcon("files");
            }}
          />
        ) : (
          <>
            {/* Always render all panels but only show the active one */}
            <div
              className={`flex-1 ${
                activeIcon === "files" || activeIcon === null ? "" : "hidden"
              }`}
            >
              <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-60 z-10">
                EXPLORER
              </div>
              <div className="w-full h-full overflow-y-auto">
                {/* Project Folder Header */}
                <button
                  className="flex items-center text-xs py-1 cursor-pointer w-full hover:bg-stone-700"
                  onClick={toggleProjectFolder}
                >
                  {/* Container for arrow + indent space */}
                  <div
                    className="flex items-center justify-center pl-1 mr-1"
                    style={{ width: "1rem" }}
                  >
                    {" "}
                    {/* Fixed width container for alignment */}
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
                    {/* Vertical Tree Line Element */}
                    <div className="absolute top-0 bottom-0 left-[12px] w-px bg-stone-600/50 z-0"></div>

                    {/* File List */}
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

            {/* Chat Panel */}
            <div className={`flex-1 ${activeIcon === "chat" ? "" : "hidden"}`}>
              <ChatPanel userName={userName} userColor={userColor} />
            </div>

            {/* Search Panel */}
            <div
              className={`flex flex-col ${
                activeIcon === "search" ? "" : "hidden"
              }`}
            >
              {/* Sticky Header */}
              <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-95 z-10">
                SEARCH
              </div>
              {/* Input Container - Reverted padding */}
              <div className="p-2 flex flex-col space-y-1">
                {/* Search Input Row */}
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchValue}
                    onChange={handleSearchInputChange}
                    className="w-full bg-stone-900/80 border border-stone-600 text-stone-200 placeholder-stone-500 pl-3 pr-24 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors h-7"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-0.5">
                    <button
                      title="Match Case"
                      onClick={() => onToggleSearchOption("matchCase")}
                      className={`p-0.5 rounded ${
                        searchOptions.matchCase
                          ? "bg-blue-500/40 text-stone-100"
                          : "text-stone-400 hover:bg-stone-700/50"
                      }`}
                    >
                      <VscCaseSensitive size={14} />
                    </button>
                    <button
                      title="Match Whole Word"
                      onClick={() => onToggleSearchOption("wholeWord")}
                      className={`p-0.5 rounded ${
                        searchOptions.wholeWord
                          ? "bg-blue-500/40 text-stone-100"
                          : "text-stone-400 hover:bg-stone-700/50"
                      }`}
                    >
                      <VscWholeWord size={14} />
                    </button>
                    <button
                      title="Use Regular Expression"
                      onClick={() => onToggleSearchOption("isRegex")}
                      className={`p-0.5 rounded ${
                        searchOptions.isRegex
                          ? "bg-blue-500/40 text-stone-100"
                          : "text-stone-400 hover:bg-stone-700/50"
                      }`}
                    >
                      <VscRegex size={14} />
                    </button>
                  </div>
                </div>

                {/* Replace Input Row with Preserve Case & Replace All */}
                <div className="flex items-center space-x-1">
                  <div className="relative flex-grow flex items-center">
                    <input
                      type="text"
                      placeholder="Replace"
                      value={replaceValue}
                      onChange={handleReplaceInputChange}
                      className="w-full bg-stone-900/80 border border-stone-600 text-stone-200 placeholder-stone-500 pl-3 pr-8 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors h-7"
                    />
                    {/* Preserve Case Button (Embedded) */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                      <button
                        title="Preserve Case (Ab)"
                        onClick={() => onToggleSearchOption("preserveCase")}
                        className={`p-0.5 rounded ${
                          searchOptions.preserveCase
                            ? "bg-blue-500/40 text-stone-100"
                            : "text-stone-400 hover:bg-stone-700/50"
                        }`}
                      >
                        <VscCaseSensitive size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Replace All Button (Outside, to the right) */}
                  <button
                    title="Replace All"
                    onClick={onReplaceAll}
                    disabled={
                      !matchInfo || matchInfo.totalMatches === 0 || !searchValue
                    }
                    className="p-1 rounded text-stone-400 hover:bg-stone-700/50 disabled:text-stone-600 disabled:cursor-not-allowed flex-shrink-0 h-7 w-7 flex items-center justify-center"
                  >
                    <VscReplaceAll size={16} />
                  </button>
                </div>

                {/* Match Count Display */}
                <div className="text-xs text-stone-400 text-left pl-1 h-4 pt-1">
                  {formatMatchCount()}
                </div>
              </div>
            </div>

            {/* Share Panel */}
            <div
              className={`p-4 text-stone-400 ${
                activeIcon === "share" ? "" : "hidden"
              }`}
            >
              Share Panel (Not Implemented)
            </div>

            {/* Account Panel */}
            <div
              className={`p-4 text-stone-400 ${
                activeIcon === "account" ? "" : "hidden"
              }`}
            >
              Account Panel (Not Implemented)
            </div>

            {/* Settings Panel */}
            <div
              className={`p-4 text-stone-400 ${
                activeIcon === "settings" ? "" : "hidden"
              }`}
            >
              Settings Panel (Not Implemented)
            </div>
          </>
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
