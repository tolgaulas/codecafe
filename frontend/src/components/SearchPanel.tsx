import React, { useState } from "react";
import {
  VscCaseSensitive,
  VscWholeWord,
  VscRegex,
  VscReplaceAll,
  VscPreserveCase,
} from "react-icons/vsc";
import { SearchOptions, MatchInfo } from "../types/editor"; // Import from shared types

// Define types for search options and match info (consider moving to a shared types file later)
// export interface SearchOptions {
//   matchCase: boolean;
//   wholeWord: boolean;
//   isRegex: boolean;
//   preserveCase: boolean;
// }
//
// export interface MatchInfo {
//   currentIndex: number | null; // e.g., 1 for the first match
//   totalMatches: number;
// }

interface SearchPanelProps {
  activeIcon: string | null; // To control visibility based on the active icon in Sidebar
  onSearchChange: (term: string, options: SearchOptions) => void;
  onReplaceChange: (term: string) => void;
  // onFindNext: () => void; // These might be handled internally or passed if Monaco instance is not directly accessible
  // onFindPrevious: () => void; // Same as above
  onToggleSearchOption: (option: keyof SearchOptions) => void;
  replaceValue: string;
  searchOptions: SearchOptions;
  matchInfo: MatchInfo | null;
  onReplaceAll: () => void;
  // Add any other props that were passed from App.tsx to Sidebar.tsx for search
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  activeIcon,
  onSearchChange,
  onReplaceChange,
  onToggleSearchOption,
  replaceValue,
  searchOptions,
  matchInfo,
  onReplaceAll,
}) => {
  const [searchValue, setSearchValue] = useState("");

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchValue(term);
    onSearchChange(term, searchOptions); // Pass current searchOptions
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

  if (activeIcon !== "search") {
    return null; // Or render with 'hidden' class, depending on desired behavior
  }

  return (
    <div
      className={`flex flex-col flex-1 ${
        activeIcon === "search" ? "" : "hidden"
      }`} // flex-1 to take available space if needed
    >
      {/* Sticky Header */}
      <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-95 z-10">
        SEARCH
      </div>
      {/* Input Container */}
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
              value={replaceValue} // This prop comes from App.tsx via Sidebar
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
                <VscPreserveCase size={14} />
              </button>
            </div>
          </div>
          {/* Replace All Button (Outside, to the right) */}
          <button
            title="Replace All"
            onClick={onReplaceAll} // This prop comes from App.tsx via Sidebar
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
  );
};

export default SearchPanel;
