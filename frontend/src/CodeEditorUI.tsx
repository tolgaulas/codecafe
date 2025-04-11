import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import TerminalComponent from "./components/TerminalComponent";
import { FaRegFolder } from "react-icons/fa";
import { VscAccount, VscLiveShare, VscSearch } from "react-icons/vsc";
import { VscFiles } from "react-icons/vsc";
import { VscSettingsGear } from "react-icons/vsc";
import { GrChatOption, GrShareOption } from "react-icons/gr";
import { HiOutlineShare } from "react-icons/hi2";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";

// Define types for code execution
interface CodeFile {
  content: string;
}

interface CodeExecutionRequest {
  language: string;
  version: string;
  files: CodeFile[];
}

interface CodeExecutionResponse {
  run: {
    stdout: string;
    stderr: string;
  };
}

// Define the Terminal ref interface
interface TerminalRef {
  writeToTerminal: (text: string) => void;
}

// Define type for language keys
type LanguageKey = keyof typeof LANGUAGE_VERSIONS;

// --- Constants ---
// Explorer
const ICON_BAR_WIDTH = 48; // Corresponds to w-12
const DEFAULT_EXPLORER_WIDTH = 192; // w-48
const MIN_EXPLORER_WIDTH = 100;
const MAX_EXPLORER_WIDTH = 500;
const EXPLORER_HANDLE_WIDTH = 8; // w-2

// Terminal
const DEFAULT_TERMINAL_HEIGHT_FRACTION = 0.33; // Corresponds to h-1/3
const MIN_TERMINAL_HEIGHT_PX = 50;
const MAX_TERMINAL_HEIGHT_PX = window.innerHeight * 0.8; // Example max
const TERMINAL_COLLAPSE_THRESHOLD_PX = 25;
const TERMINAL_HANDLE_HEIGHT = 4; // h-1 (was 6)

const CodeEditorUI = () => {
  const [code, setCode] = useState(
    '// Start coding here\nfunction helloWorld() {\n  console.log("Hello, world!");\n}\n'
  );
  const [activeIcon, setActiveIcon] = useState<string | null>("files");
  const [editorLanguage] = useState<LanguageKey>("javascript");

  // Explorer State
  const [explorerWidth, setExplorerWidth] = useState<number>(
    DEFAULT_EXPLORER_WIDTH
  );
  const [isExplorerResizing, setIsExplorerResizing] = useState<boolean>(false);
  const [previousExplorerWidth, setPreviousExplorerWidth] = useState<number>(
    DEFAULT_EXPLORER_WIDTH
  );

  // Terminal State
  const [terminalHeight, setTerminalHeight] = useState<number>(
    window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION // Initial height based on fraction
  );
  const [isTerminalResizing, setIsTerminalResizing] = useState<boolean>(false);
  const [previousTerminalHeight, setPreviousTerminalHeight] = useState<number>(
    window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION
  );
  const [isTerminalCollapsed, setIsTerminalCollapsed] =
    useState<boolean>(false);

  // Create a ref for the terminal
  const terminalRef = useRef<TerminalRef>();
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const editorTerminalAreaRef = useRef<HTMLDivElement>(null); // Ref for the main editor+terminal vertical area

  // Handle code execution
  const handleRunCode = async () => {
    try {
      const requestBody: CodeExecutionRequest = {
        language: editorLanguage,
        version: LANGUAGE_VERSIONS[editorLanguage].version,
        files: [{ content: code }],
      };

      const response = await axios.post<CodeExecutionResponse>(
        "http://157.230.83.211:8080/api/execute",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      const executionOutput = response.data.run.stderr
        ? `${response.data.run.stdout}\nError: ${response.data.run.stderr}`
        : response.data.run.stdout;
      // Write directly to terminal
      if (executionOutput !== "") {
        console.log(executionOutput);
        terminalRef.current?.writeToTerminal(executionOutput);
      }
    } catch (error) {
      const errorOutput = `Error: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`;
      // Write errors directly to terminal
      terminalRef.current?.writeToTerminal(errorOutput);
    }
  };

  // --- Explorer Resizing Logic ---
  const handleExplorerResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExplorerResizing(true);
  };

  const handleExplorerResizeMouseUp = useCallback(() => {
    if (isExplorerResizing) {
      setIsExplorerResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, [isExplorerResizing]);

  const handleExplorerResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      requestAnimationFrame(() => {
        if (!isExplorerResizing || !sidebarContainerRef.current) return;
        const sidebarRect = sidebarContainerRef.current.getBoundingClientRect();
        let newExplorerWidth = e.clientX - sidebarRect.left - ICON_BAR_WIDTH;
        newExplorerWidth = Math.max(MIN_EXPLORER_WIDTH, newExplorerWidth);
        newExplorerWidth = Math.min(MAX_EXPLORER_WIDTH, newExplorerWidth);
        setExplorerWidth(newExplorerWidth);
      });
    },
    [isExplorerResizing]
  );

  useEffect(() => {
    if (isExplorerResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleExplorerResizeMouseMove);
      window.addEventListener("mouseup", handleExplorerResizeMouseUp);
    } else {
      window.removeEventListener("mousemove", handleExplorerResizeMouseMove);
      window.removeEventListener("mouseup", handleExplorerResizeMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleExplorerResizeMouseMove);
      window.removeEventListener("mouseup", handleExplorerResizeMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [
    isExplorerResizing,
    handleExplorerResizeMouseMove,
    handleExplorerResizeMouseUp,
  ]);

  // --- Terminal Resizing Logic ---
  const handleTerminalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    // If currently collapsed, expand it on click/drag start
    if (isTerminalCollapsed) {
      // Reset height to previous or default, start resizing
      setTerminalHeight(
        previousTerminalHeight ||
          window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION
      );
      setIsTerminalCollapsed(false);
      setIsTerminalResizing(true); // Immediately start resizing after expanding
    } else {
      // Otherwise, just start resizing
      setIsTerminalResizing(true);
    }
  };

  const handleTerminalResizeMouseUp = useCallback(() => {
    if (isTerminalResizing) {
      setIsTerminalResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // If height ended up at 0, ensure it's marked as collapsed
      if (
        terminalHeight <= TERMINAL_COLLAPSE_THRESHOLD_PX &&
        terminalHeight > 0
      ) {
        setTerminalHeight(0);
        setIsTerminalCollapsed(true);
      } else if (terminalHeight === 0) {
        setIsTerminalCollapsed(true);
      }
    }
  }, [isTerminalResizing, terminalHeight]); // Add terminalHeight dependency

  const handleTerminalResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      requestAnimationFrame(() => {
        if (!isTerminalResizing || !editorTerminalAreaRef.current) return;

        const containerRect =
          editorTerminalAreaRef.current.getBoundingClientRect();
        let newHeight = containerRect.bottom - e.clientY;

        // Check for collapse threshold during drag
        if (newHeight < TERMINAL_COLLAPSE_THRESHOLD_PX) {
          // If dragging below threshold, visually snap to 0 height
          // but don't finalize collapse state until mouse up
          setTerminalHeight(0);
        } else {
          // Apply constraints only if above threshold
          newHeight = Math.max(MIN_TERMINAL_HEIGHT_PX, newHeight);
          newHeight = Math.min(MAX_TERMINAL_HEIGHT_PX, newHeight);
          // Prevent terminal from overlapping editor too much (leave min height for editor)
          newHeight = Math.min(
            newHeight,
            containerRect.height - MIN_TERMINAL_HEIGHT_PX
          );
          setTerminalHeight(newHeight);
        }
      });
    },
    [isTerminalResizing] // Keep dependencies minimal for move handler
  );

  // Effect for Terminal Resizing Listeners
  useEffect(() => {
    if (isTerminalResizing) {
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleTerminalResizeMouseMove);
      window.addEventListener("mouseup", handleTerminalResizeMouseUp);
    } else {
      window.removeEventListener("mousemove", handleTerminalResizeMouseMove);
      window.removeEventListener("mouseup", handleTerminalResizeMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleTerminalResizeMouseMove);
      window.removeEventListener("mouseup", handleTerminalResizeMouseUp);
      // Ensure styles are reset on unmount or if resizing stops unexpectedly
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [
    isTerminalResizing,
    handleTerminalResizeMouseMove,
    handleTerminalResizeMouseUp,
  ]);

  // --- Explorer Toggle Logic ---
  const toggleExplorer = () => {
    setActiveIcon((prevActiveIcon) => {
      const isExplorerOpen = prevActiveIcon === "files";
      if (isExplorerOpen) {
        if (explorerWidth > MIN_EXPLORER_WIDTH / 2) {
          // Only save substantial width
          setPreviousExplorerWidth(explorerWidth);
        }
        setExplorerWidth(0); // Set width to 0 to hide
        return null; // Set activeIcon to null
      } else {
        // Opening: Restore previous width or default, set activeIcon
        setExplorerWidth(previousExplorerWidth || DEFAULT_EXPLORER_WIDTH);
        return "files";
      }
    });
  };

  // --- Icon Click Logic (Generalized) ---
  const handleIconClick = (iconName: string | null) => {
    setActiveIcon((prevActiveIcon) => {
      // If clicking the already active 'files' icon, toggle it
      if (iconName === "files" && prevActiveIcon === "files") {
        toggleExplorer();
        // toggleExplorer handles the state change, so return the current state temporarily
        return prevActiveIcon;
      }

      // If switching away from 'files', collapse the explorer
      if (prevActiveIcon === "files" && iconName !== "files") {
        if (explorerWidth > MIN_EXPLORER_WIDTH / 2) {
          // Save width before collapsing
          setPreviousExplorerWidth(explorerWidth);
        }
        setExplorerWidth(0); // Collapse
      }
      // If switching *to* 'files' from another icon
      else if (iconName === "files" && prevActiveIcon !== "files") {
        setExplorerWidth(previousExplorerWidth || DEFAULT_EXPLORER_WIDTH); // Restore width
      }
      // If switching between other non-file icons, explorer remains collapsed
      else if (iconName !== "files" && prevActiveIcon !== "files") {
        setExplorerWidth(0); // Ensure collapsed
      }

      return iconName; // Set the new active icon
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-800 bg-opacity-80 p-2 border-b border-stone-600 flex-shrink-0">
        <div className="flex items-center">
          <div className="flex space-x-2">
            <button className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent">
              File
            </button>
            <button className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent">
              Edit
            </button>
            <button className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent">
              View
            </button>
            <button
              className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent"
              onClick={handleRunCode}
            >
              Run
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-400 rounded-full flex items-center justify-center">
            <span className="text-stone-200">M</span>
          </div>
          <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-neutral-900 active:bg-stone-950 text-stone-500 hover:text-stone-400">
            <span className="text-sm">?</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Combined Sidebar Area */}
        <div
          ref={sidebarContainerRef}
          className="flex flex-shrink-0 h-full relative"
        >
          {/* Icon Bar */}
          <div
            className="bg-stone-800 bg-opacity-60 flex flex-col justify-between py-2 border-r border-stone-600 flex-shrink-0 z-10"
            style={{ width: `${ICON_BAR_WIDTH}px` }}
          >
            {/* Top icons */}
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
            {/* Bottom icons */}
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

          {/* File Tree */}
          <div
            className={`bg-stone-800 bg-opacity-60 overflow-hidden flex flex-col h-full border-r border-stone-600 flex-shrink-0 ${
              activeIcon === "files" && explorerWidth > 0
                ? "visible"
                : "invisible"
            }`}
            style={{ width: `${explorerWidth}px` }}
          >
            <div className="flex-1 overflow-y-auto h-full">
              <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-60 z-10">
                EXPLORER
              </div>
              <div className="w-full">
                {/* File items */}
                <div className="flex items-center text-sm py-1 hover:bg-stone-700 cursor-pointer w-full pl-0">
                  <span className="text-stone-300 w-full pl-4 truncate">
                    index.html very long file name test test test test test test
                  </span>
                </div>
                <div className="flex items-center text-sm py-1 bg-stone-700 cursor-pointer w-full pl-0 border-y border-stone-500">
                  <span className="text-stone-200 w-full pl-4 truncate">
                    script.js
                  </span>
                </div>
                <div className="flex items-center text-sm py-1 hover:bg-stone-700 cursor-pointer w-full pl-0">
                  <span className="text-stone-300 w-full pl-4 truncate">
                    style.css
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Explorer Resizer Handle */}
          {activeIcon === "files" && (
            <div
              className={`absolute top-0 h-full cursor-col-resize bg-transparent z-20 ${
                explorerWidth > 0 ? "block" : "hidden"
              }`}
              style={{
                width: `${EXPLORER_HANDLE_WIDTH}px`,
                left: `${
                  ICON_BAR_WIDTH + explorerWidth - EXPLORER_HANDLE_WIDTH / 2
                }px`,
                pointerEvents:
                  activeIcon === "files" && explorerWidth > 0 ? "auto" : "none",
              }}
              onMouseDown={handleExplorerResizeMouseDown} // Correct handler
            ></div>
          )}
        </div>

        {/* Code and Terminal Area */}
        <div
          ref={editorTerminalAreaRef}
          className="flex-1 flex flex-col relative"
        >
          {/* Tabs - Restored */}
          <div className="flex bg-stone-800 bg-opacity-60 border-b border-stone-600 flex-shrink-0">
            {/* Example Tab - replace with dynamic tabs later */}
            <div className="px-4 py-2 bg-neutral-900 border-r border-stone-600 flex items-center -mb-[1px]">
              <span className="text-sm text-stone-300 -mt-1">script.js</span>
              <button className="ml-2 text-stone-500 hover:text-stone-400 -mt-1">
                ×
              </button>
            </div>
            {/* Add more tabs here as needed */}
          </div>

          {/* Code Editor - takes remaining space */}
          <div className="flex-1 overflow-auto pt-6 font-mono text-sm relative bg-neutral-900 min-h-0">
            <CodeEditor
              theme="codeCafeTheme"
              language="javascript"
              showLineNumbers={true}
              code={code}
              onCodeChange={setCode}
            />
          </div>

          {/* Terminal Resizer */}
          <div
            className={`w-full bg-stone-700 flex-shrink-0 ${
              isTerminalCollapsed
                ? "cursor-pointer hover:bg-stone-500"
                : "cursor-row-resize hover:bg-stone-600 active:bg-stone-500" // Change cursor/style when collapsed
            }`}
            style={{ height: `${TERMINAL_HANDLE_HEIGHT}px` }}
            onMouseDown={handleTerminalResizeMouseDown} // Attach handler
          />

          {/* Terminal */}
          <div
            className={`bg-neutral-900 bg-opacity-90 flex flex-col border-t border-stone-600 flex-shrink-0 ${
              isTerminalCollapsed ? "hidden" : "flex"
            }`}
            style={{ height: `${terminalHeight}px` }} // Apply dynamic height
          >
            <div className="flex bg-stone-800 py-1 text-sm flex-shrink-0">
              <div className="px-4 py-1 text-stone-400 text-xs">TERMINAL</div>
            </div>
            {/* Terminal Content Area */}
            <div className="flex-1 px-4 pt-2 font-mono text-sm overflow-hidden min-h-0">
              {!isTerminalCollapsed && (
                <TerminalComponent ref={terminalRef} height={terminalHeight} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-stone-800 bg-opacity-80 text-stone-500 flex justify-between items-center px-4 py-1 text-xs border-t border-stone-600 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <span>{editorLanguage}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Ln 3, Col 12</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorUI;
