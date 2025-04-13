import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import TerminalComponent from "./components/TerminalComponent";
import { FaRegFolder, FaGlobe } from "react-icons/fa";
import {
  VscAccount,
  VscLiveShare,
  VscSearch,
  VscPreview,
} from "react-icons/vsc";
import { VscFiles } from "react-icons/vsc";
import { VscSettingsGear } from "react-icons/vsc";
import { GrChatOption, GrShareOption } from "react-icons/gr";
import { HiOutlineShare } from "react-icons/hi2";
import { DiJavascript1, DiCss3Full, DiHtml5 } from "react-icons/di";
import { VscJson } from "react-icons/vsc";
import { VscFile } from "react-icons/vsc";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import WebViewPanel from "./components/WebViewPanel";

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
  fit: () => void;
}

// Define type for language keys
type ExecutableLanguageKey = keyof typeof LANGUAGE_VERSIONS; // Languages the backend can run
type EditorLanguageKey = ExecutableLanguageKey | "css" | "html" | "plaintext"; // Languages the editor supports

// Map Monaco language identifiers if they differ (optional, but good practice)
const editorLanguageMap: { [key in EditorLanguageKey]: string } = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  c: "c",
  cplusplus: "cpp", // Monaco uses 'cpp'
  go: "go",
  rust: "rust",
  ruby: "ruby",
  css: "css",
  html: "html",
  plaintext: "plaintext",
};

interface OpenFile {
  id: string; // Unique ID, e.g., file path or generated UUID
  name: string;
  language: EditorLanguageKey; // Use the broader editor language type
}

// --- Constants ---
// Explorer
const ICON_BAR_WIDTH = 48; // Corresponds to w-12
const DEFAULT_EXPLORER_WIDTH = 192; // w-48
const MIN_EXPLORER_WIDTH = 100;
const MAX_EXPLORER_WIDTH = 500;
const EXPLORER_HANDLE_WIDTH = 8; // w-2

// Web View Panel (Right)
const DEFAULT_WEBVIEW_WIDTH = 600; // Example default width
const MIN_WEBVIEW_WIDTH = 300; // Increased minimum width
const MAX_WEBVIEW_WIDTH = 850;
const WEBVIEW_HANDLE_WIDTH = 12;

// Terminal
const DEFAULT_TERMINAL_HEIGHT_FRACTION = 0.33; // Corresponds to h-1/3
const MIN_TERMINAL_HEIGHT_PX = 50;
const MAX_TERMINAL_HEIGHT_PX = window.innerHeight * 0.8; // Example max
const TERMINAL_COLLAPSE_THRESHOLD_PX = 25;
const TERMINAL_HANDLE_HEIGHT = 4; // h-1 (was 6)

// --- Mock File Data (Replace with actual data fetching/structure later) ---
const MOCK_FILES: {
  [id: string]: { name: string; language: EditorLanguageKey; content: string };
} = {
  "script.js": {
    name: "script.js",
    language: "javascript",
    content:
      '// Start coding in script.js\nfunction helloWorld() {\n  console.log("Hello from script.js!");\n}\nhelloWorld();\n',
  },
  "style.css": {
    name: "style.css",
    language: "css",
    content:
      "/* Start coding in style.css */\nbody {\n  background-color: #2d2d2d;\n}\n",
  },
  "index.html": {
    name: "index.html",
    language: "html",
    content:
      '<!DOCTYPE html>\n<html>\n<head>\n  <title>Code Editor</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello from index.html!</h1>\n  <script src="script.js"></script>\n</body>\n</html>\n',
  },
};

// Helper function to check if a language is executable
const isExecutableLanguage = (
  lang: EditorLanguageKey
): lang is ExecutableLanguageKey => {
  return lang in LANGUAGE_VERSIONS;
};

// --- Icon Mapping ---
const languageIconMap: {
  [key in EditorLanguageKey]?: React.ComponentType<{
    size?: number;
    className?: string;
  }>;
} = {
  javascript: DiJavascript1,
  css: DiCss3Full,
  html: DiHtml5,
  // Add more mappings as needed
  // json: VscJson,
  // typescript: DiTypescript // Example REMOVED
};

// --- Language Color Mapping ---
const languageColorMap: { [key in EditorLanguageKey]?: string } = {
  javascript: "text-yellow-400", // Yellow for JS
  css: "text-blue-500", // Blue for CSS
  html: "text-orange-600", // Orange for HTML
  // Add more colors as needed
};

const defaultIconColor = "text-stone-400"; // Default color for other files/icons

// --- Sortable Tab Component ---
interface SortableTabProps {
  file: OpenFile;
  activeFileId: string | null;
  draggingId: string | null;
  IconComponent: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
}

function SortableTab({
  file,
  activeFileId,
  draggingId,
  IconComponent,
  iconColor,
  onSwitchTab,
  onCloseTab,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : activeFileId === file.id ? 10 : "auto",
    visibility: (isDragging
      ? "hidden"
      : "visible") as React.CSSProperties["visibility"],
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={() => {
        onSwitchTab(file.id);
      }}
      className={`pl-2 pr-4 py-1 border-r border-stone-600 flex items-center flex-shrink-0 relative ${
        activeFileId === file.id
          ? "bg-neutral-900"
          : "bg-stone-700 hover:bg-stone-600"
      }`}
    >
      <IconComponent
        size={16}
        className={`mr-1.5 flex-shrink-0 ${iconColor}`}
      />
      <span
        {...attributes}
        {...listeners}
        className={`text-sm -mt-0.5 select-none cursor-default ${
          activeFileId === file.id ? "text-stone-200" : "text-stone-400"
        }`}
      >
        {file.name}
      </span>
      <button
        className={`ml-2 text-stone-500 hover:text-stone-300 rounded-sm p-0.5 -mt-0.5 z-20`}
        onClick={(e) => onCloseTab(file.id, e)}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      >
        ×
      </button>
    </div>
  );
}

const CodeEditorUI = () => {
  const [activeIcon, setActiveIcon] = useState<string | null>("files");

  // Explorer State
  const [explorerWidth, setExplorerWidth] = useState<number>(
    DEFAULT_EXPLORER_WIDTH
  );
  const [isExplorerResizing, setIsExplorerResizing] = useState<boolean>(false);
  const [previousExplorerWidth, setPreviousExplorerWidth] = useState<number>(
    DEFAULT_EXPLORER_WIDTH
  );

  // Web View State (Right Panel)
  const [webViewWidth, setWebViewWidth] = useState<number>(0); // Start collapsed
  const [isWebViewResizing, setIsWebViewResizing] = useState<boolean>(false);
  const [previousWebViewWidth, setPreviousWebViewWidth] = useState<number>(
    DEFAULT_WEBVIEW_WIDTH
  );

  // Terminal State
  const [terminalHeight, setTerminalHeight] = useState<number>(
    window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION // Initial height based on fraction
  );
  const [isTerminalResizing, setIsTerminalResizing] = useState<boolean>(false);
  const [previousTerminalHeight, setPreviousTerminalHeight] = useState<number>(
    window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION
  );

  // Tab / File Management State
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<{ [id: string]: string }>(
    {}
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Create a ref for the terminal
  const terminalRef = useRef<TerminalRef>();
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const editorTerminalAreaRef = useRef<HTMLDivElement>(null); // Ref for the main editor+terminal vertical area
  const mainContentRef = useRef<HTMLDivElement>(null); // Ref for the overall main content flex row

  // --- dnd-kit Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Drag Start Handler ---
  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    setDraggingId(draggedId);
  };

  // --- Drag End Handler ---
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOpenFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setDraggingId(null);
  };

  // Handle code execution
  const handleRunCode = async () => {
    try {
      if (!activeFileId) {
        terminalRef.current?.writeToTerminal("No active file to run.\n");
        return;
      }

      const activeFile = openFiles.find((f) => f.id === activeFileId);
      const contentToRun = fileContents[activeFileId];

      if (!activeFile || contentToRun === undefined) {
        terminalRef.current?.writeToTerminal(
          "Error: Active file data not found.\n"
        );
        return;
      }

      // Check if the language is executable
      if (!isExecutableLanguage(activeFile.language)) {
        terminalRef.current?.writeToTerminal(
          `Cannot execute files of type '${activeFile.language}'.\n`
        );
        return;
      }

      const requestBody: CodeExecutionRequest = {
        language: activeFile.language,
        version: LANGUAGE_VERSIONS[activeFile.language].version, // Safe access
        files: [{ content: contentToRun }], // Send content of the active file
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
      if (!isExplorerResizing || !sidebarContainerRef.current) return;
      const sidebarRect = sidebarContainerRef.current.getBoundingClientRect();
      let newExplorerWidth = e.clientX - sidebarRect.left - ICON_BAR_WIDTH;
      newExplorerWidth = Math.max(MIN_EXPLORER_WIDTH, newExplorerWidth);
      newExplorerWidth = Math.min(MAX_EXPLORER_WIDTH, newExplorerWidth);
      setExplorerWidth(newExplorerWidth);
    },
    [isExplorerResizing]
  );

  useEffect(() => {
    if (isExplorerResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleExplorerResizeMouseMove);
    } else {
      window.removeEventListener("mousemove", handleExplorerResizeMouseMove);
      if (!isWebViewResizing && !isTerminalResizing) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    return () => {
      window.removeEventListener("mousemove", handleExplorerResizeMouseMove);
      if (!isWebViewResizing && !isTerminalResizing) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, [
    isExplorerResizing,
    handleExplorerResizeMouseMove,
    isWebViewResizing,
    isTerminalResizing,
  ]);

  // --- Web View Resizing Logic ---
  const handleWebViewResizePointerDown = (e: React.PointerEvent) => {
    // Check if it's the primary button (usually left mouse button)
    if (e.button !== 0) return;
    e.preventDefault();
    // Capture the pointer
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsWebViewResizing(true);
  };

  const handleWebViewResizePointerMove = useCallback(
    (e: PointerEvent) => {
      // Use PointerEvent type
      // No need to check isWebViewResizing here, listener is only active when true
      if (!mainContentRef.current) return;

      // Existing logic remains the same...
      const mainRect = mainContentRef.current.getBoundingClientRect();

      const mouseX = Math.min(
        Math.max(e.clientX, mainRect.left),
        mainRect.right
      );

      const newWidth = mainRect.right - mouseX;

      const clampedWidth = Math.max(
        MIN_WEBVIEW_WIDTH,
        Math.min(newWidth, MAX_WEBVIEW_WIDTH)
      );

      setWebViewWidth(clampedWidth);
    },
    // Remove isWebViewResizing from dependencies, it's implicitly handled by the listener's existence
    [MIN_WEBVIEW_WIDTH, MAX_WEBVIEW_WIDTH] // Dependencies are constants now
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isWebViewResizing) {
        handleWebViewResizePointerMove(e); // Call the memoized handler
      }
    };

    if (isWebViewResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      // Add pointermove to the window
      window.addEventListener("pointermove", handlePointerMove);
    } else {
      // Removal is handled implicitly by the effect cleanup
    }

    // Cleanup function: ALWAYS removes the listener
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      // Reset cursor/select ONLY if no OTHER panel is resizing
      if (!isExplorerResizing && !isTerminalResizing) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, [
    isWebViewResizing, // Primary dependency
    handleWebViewResizePointerMove, // Add the actual handler function
    // Keep these to correctly manage cursor/style resets
    isExplorerResizing,
    isTerminalResizing,
  ]);

  // --- Terminal Resizing Logic ---
  const handleTerminalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsTerminalResizing(true); // Always start resizing on mouse down

    // If it WAS collapsed when clicked (height is 0), restore previous height
    if (terminalHeight === 0) {
      // No need to set height here. Just flag resizing as active.
      // The first mousemove event will calculate the initial height based on cursor position.
    }
    // If not collapsed, just start resizing with the current height
  };

  const handleTerminalResizeMouseUp = useCallback(() => {
    if (isTerminalResizing) {
      setIsTerminalResizing(false);
      if (terminalHeight > 0) {
        terminalRef.current?.fit();
        setPreviousTerminalHeight(terminalHeight);
      }
    }
  }, [isTerminalResizing, terminalHeight]);

  const handleTerminalResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isTerminalResizing || !editorTerminalAreaRef.current) return;

      const containerRect =
        editorTerminalAreaRef.current.getBoundingClientRect();
      let newHeight = containerRect.bottom - e.clientY;
      newHeight = Math.max(0, newHeight); // Ensure non-negative

      // Check for collapse threshold during drag
      if (newHeight < TERMINAL_COLLAPSE_THRESHOLD_PX) {
        // If dragging below threshold, visually snap to 0 height
        // Store the current height *before* setting it to 0, if it wasn't already 0
        if (terminalHeight > 0) {
          setPreviousTerminalHeight(terminalHeight);
        }
        setTerminalHeight(0);
      } else {
        // Apply constraints only if above threshold
        let constrainedHeight = Math.max(MIN_TERMINAL_HEIGHT_PX, newHeight);
        constrainedHeight = Math.min(MAX_TERMINAL_HEIGHT_PX, constrainedHeight);
        constrainedHeight = Math.min(
          constrainedHeight,
          containerRect.height - MIN_TERMINAL_HEIGHT_PX
        );
        setTerminalHeight(constrainedHeight);
      }
    },
    [isTerminalResizing, terminalHeight, previousTerminalHeight]
  );

  // Effect for Terminal Resizing Listeners
  useEffect(() => {
    if (isTerminalResizing) {
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleTerminalResizeMouseMove);
    } else {
      window.removeEventListener("mousemove", handleTerminalResizeMouseMove);
      if (!isExplorerResizing && !isWebViewResizing) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    return () => {
      window.removeEventListener("mousemove", handleTerminalResizeMouseMove);
      if (!isExplorerResizing && !isWebViewResizing) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, [
    isTerminalResizing,
    handleTerminalResizeMouseMove,
    isExplorerResizing,
    isWebViewResizing,
  ]);

  // --- Global Pointer Up Handler (Replaces Global MouseUp) ---
  const handleGlobalPointerUp = useCallback(
    (e: PointerEvent) => {
      // Check if we were resizing the WebView and release capture
      if (isWebViewResizing) {
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (err) {
          // Keep this warning for potential future issues
          console.warn(
            "Global PointerUp: Failed to release pointer capture",
            err
          );
        }
        setIsWebViewResizing(false); // Set state AFTER releasing capture
      }

      // --- Handle other resizes (Can be refactored later) ---
      if (isExplorerResizing) {
        handleExplorerResizeMouseUp();
      }
      if (isTerminalResizing) {
        handleTerminalResizeMouseUp();
      }

      // Reset cursor/select AFTER checking all states
      if (isExplorerResizing || isWebViewResizing || isTerminalResizing) {
      }
    },
    [
      isExplorerResizing,
      handleExplorerResizeMouseUp,
      isWebViewResizing,
      isTerminalResizing,
      handleTerminalResizeMouseUp,
    ]
  );

  // Effect to add/remove the global PointerUp listener
  useEffect(() => {
    document.addEventListener("pointerup", handleGlobalPointerUp);
    document.addEventListener("pointercancel", handleGlobalPointerUp);

    return () => {
      document.removeEventListener("pointerup", handleGlobalPointerUp);
      document.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [handleGlobalPointerUp]); // Add handleGlobalPointerUp as dependency

  // --- Explorer Toggle Logic ---
  const toggleExplorer = () => {
    setActiveIcon((prevActiveIcon) => {
      const isExplorerOpen = explorerWidth > 0;
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

  // --- Web View Toggle Logic ---
  const toggleWebView = () => {
    setActiveIcon((prevActiveIcon) => {
      const isWebViewOpen = webViewWidth > 0;
      if (isWebViewOpen) {
        if (webViewWidth > MIN_WEBVIEW_WIDTH / 2) {
          setPreviousWebViewWidth(webViewWidth);
        }
        setWebViewWidth(0);
        return null;
      } else {
        setWebViewWidth(previousWebViewWidth || DEFAULT_WEBVIEW_WIDTH);
        return "webView"; // Set activeIcon to webView
      }
    });
  };

  // --- Icon Click Logic (Generalized) ---
  const handleIconClick = (iconName: string | null) => {
    setActiveIcon((prevActiveIcon) => {
      let nextActiveIcon = iconName;

      // If clicking the already active 'files' icon, toggle it
      if (iconName === "files" && prevActiveIcon === "files") {
        toggleExplorer();
        nextActiveIcon = explorerWidth > 0 ? "files" : null; // Update based on toggle result
      }
      // If clicking the already active 'webView' icon, toggle it
      else if (iconName === "webView" && prevActiveIcon === "webView") {
        toggleWebView();
        nextActiveIcon = webViewWidth > 0 ? "webView" : null;
      }
      // If switching *to* files
      else if (iconName === "files") {
        setExplorerWidth(previousExplorerWidth || DEFAULT_EXPLORER_WIDTH);
        setWebViewWidth(0); // Collapse web view
      }
      // If switching *to* webView
      else if (iconName === "webView") {
        setWebViewWidth(previousWebViewWidth || DEFAULT_WEBVIEW_WIDTH);
        setExplorerWidth(0); // Collapse explorer
      }
      // If switching to other icons (search, chat, etc.) or null
      else {
        setExplorerWidth(0); // Collapse both
        setWebViewWidth(0);
      }

      // Save previous widths if collapsing
      if (
        iconName !== "files" &&
        explorerWidth > 0 &&
        explorerWidth > MIN_EXPLORER_WIDTH / 2
      ) {
        setPreviousExplorerWidth(explorerWidth);
      }
      if (
        iconName !== "webView" &&
        webViewWidth > 0 &&
        webViewWidth > MIN_WEBVIEW_WIDTH / 2
      ) {
        setPreviousWebViewWidth(webViewWidth);
      }

      return nextActiveIcon; // Set the new active icon
    });
  };

  // --- File Handling Logic ---
  const handleOpenFile = (fileId: string) => {
    if (!MOCK_FILES[fileId]) return; // Ignore if file doesn't exist in mock data

    const fileData = MOCK_FILES[fileId];

    // Check if already open
    if (!openFiles.some((f) => f.id === fileId)) {
      // Add to open files
      const newOpenFile: OpenFile = {
        id: fileId,
        name: fileData.name,
        language: fileData.language,
      };
      setOpenFiles((prev) => [...prev, newOpenFile]);

      // Add content to fileContents map
      setFileContents((prev) => ({ ...prev, [fileId]: fileData.content }));
    }
    // Set as active
    setActiveFileId(fileId);
  };

  const handleSwitchTab = (fileId: string) => {
    setActiveFileId(fileId);
  };

  const handleCloseTab = (fileIdToClose: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from switching to the tab being closed

    const indexToRemove = openFiles.findIndex((f) => f.id === fileIdToClose);
    if (indexToRemove === -1) return;

    // Determine the next active tab
    let nextActiveId: string | null = null;
    if (activeFileId === fileIdToClose) {
      if (openFiles.length > 1) {
        const remainingFiles = openFiles.filter((f) => f.id !== fileIdToClose);
        if (remainingFiles.length > 0) {
          // If closing the active tab, try to activate the one to the left
          // If closing the first tab, activate the new first tab (which was the second)
          nextActiveId =
            remainingFiles[Math.max(0, indexToRemove - 1)]?.id ??
            remainingFiles[0]?.id;
        } else {
          nextActiveId = null; // No tabs left
        }
      }
    } else {
      // If closing a background tab, keep the current active tab active
      nextActiveId = activeFileId;
    }

    setActiveFileId(nextActiveId);

    // Remove from openFiles
    setOpenFiles((prev) => prev.filter((f) => f.id !== fileIdToClose));

    // Remove content (optional, could keep for session restore later)
    setFileContents((prev) => {
      const newContents = { ...prev };
      delete newContents[fileIdToClose];
      return newContents;
    });
  };

  const handleCodeChange = (newCode: string) => {
    if (activeFileId) {
      setFileContents((prev) => ({
        ...prev,
        [activeFileId]: newCode,
      }));
    }
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
      <div ref={mainContentRef} className="flex flex-1 min-h-0">
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
                  activeIcon === "webView"
                    ? "text-stone-100"
                    : "text-stone-500 hover:text-stone-200"
                }`}
                onClick={() => handleIconClick("webView")}
              >
                <VscPreview size={24} />
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
                {Object.entries(MOCK_FILES).map(([id, file]) => {
                  const IconComponent =
                    languageIconMap[file.language] || VscFile;
                  const iconColor =
                    languageColorMap[file.language] || defaultIconColor;
                  return (
                    <div
                      key={id}
                      className={`flex items-center text-sm py-1 cursor-pointer w-full pl-0 ${
                        activeFileId === id &&
                        openFiles.some((f) => f.id === id)
                          ? "bg-stone-600 shadow-[inset_0_1px_0_#78716c,inset_0_-1px_0_#78716c]"
                          : "hover:bg-stone-700"
                      }`}
                      onClick={() => handleOpenFile(id)}
                    >
                      <IconComponent
                        size={18}
                        className={`ml-2 mr-1 flex-shrink-0 ${iconColor}`}
                      />
                      <span
                        className={`w-full pl-1 truncate ${
                          activeFileId === id &&
                          openFiles.some((f) => f.id === id)
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
          className="flex-1 flex flex-col relative overflow-x-hidden min-w-0"
        >
          {/* Tabs - Dynamic & Sortable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            modifiers={[restrictToHorizontalAxis]}
          >
            <div className="flex bg-stone-800 flex-shrink-0 overflow-x-auto relative">
              <SortableContext
                items={openFiles.map((f) => f.id)}
                strategy={horizontalListSortingStrategy}
              >
                {openFiles.map((file) => {
                  const IconComponent =
                    languageIconMap[file.language] || VscFile;
                  const iconColor =
                    languageColorMap[file.language] || defaultIconColor;
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
                    />
                  );
                })}
              </SortableContext>
              <DragOverlay modifiers={[restrictToParentElement]}>
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
                          className={`pl-2 pr-4 py-1 border-r border-stone-600 flex items-center flex-shrink-0 relative shadow-lg ${
                            activeFileId === draggedFile.id
                              ? "bg-neutral-900 z-10"
                              : "bg-stone-700 z-10"
                          }`}
                        >
                          <IconComponent
                            size={16}
                            className={`mr-1.5 flex-shrink-0 ${iconColor}`}
                          />
                          <span
                            className={`text-sm -mt-0.5 select-none cursor-default ${
                              activeFileId === draggedFile.id
                                ? "text-stone-200"
                                : "text-stone-400"
                            }`}
                          >
                            {draggedFile.name}
                          </span>
                          <span className="ml-2 text-stone-500 p-0.5 -mt-0.5 opacity-50">
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

          {/* Code Editor - takes remaining space */}
          <div className="flex-1 overflow-auto font-mono text-sm relative bg-neutral-900 min-h-0 pt-4">
            {/* Render editor only if a file is active */}
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
                code={fileContents[activeFileId] || ""}
                onCodeChange={handleCodeChange}
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
              terminalHeight === 0
                ? "cursor-pointer hover:bg-stone-500"
                : "cursor-row-resize hover:bg-stone-600 active:bg-stone-500"
            }`}
            style={{ height: `${TERMINAL_HANDLE_HEIGHT}px` }}
            onMouseDown={handleTerminalResizeMouseDown}
          />

          {/* Terminal */}
          <div
            className={`bg-neutral-900 bg-opacity-90 flex flex-col border-t border-stone-600 flex-shrink-0 ${
              terminalHeight === 0 ? "hidden" : "flex"
            }`}
            style={{ height: `${terminalHeight}px` }}
          >
            <div className="flex bg-stone-800 py-1 text-sm flex-shrink-0">
              <div className="px-4 py-1 text-stone-400 text-xs">TERMINAL</div>
            </div>
            <div className="flex-1 px-4 pt-2 font-mono text-sm overflow-hidden min-h-0">
              <TerminalComponent ref={terminalRef} height={terminalHeight} />
            </div>
          </div>
        </div>

        {/* Right Panel Area */}
        <div className="flex flex-shrink-0 h-full relative">
          {/* Web View Resizer Handle */}
          {activeIcon === "webView" && (
            <div
              className={`absolute top-0 h-full cursor-col-resize bg-transparent z-30 ${
                webViewWidth > 0 ? "block" : "hidden"
              }`}
              style={{
                width: `${WEBVIEW_HANDLE_WIDTH}px`,
                left: `-${WEBVIEW_HANDLE_WIDTH / 2}px`,
                touchAction: "none", // Prevent scrolling on touch devices
                pointerEvents:
                  activeIcon === "webView" && webViewWidth > 0
                    ? "auto"
                    : "none",
              }}
              onPointerDown={handleWebViewResizePointerDown} // Use onPointerDown
              // No need for onMouseDown anymore
            ></div>
          )}

          {/* Web View Panel */}
          <div
            className={`overflow-hidden h-full ${
              activeIcon === "webView" && webViewWidth > 0
                ? "visible border-l border-stone-600"
                : "invisible"
            }`}
            style={{ width: `${webViewWidth}px` }}
          >
            <WebViewPanel />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-stone-800 bg-opacity-80 text-stone-500 flex justify-between items-center px-4 py-1 text-xs border-t border-stone-600 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <span>
            {activeFileId && openFiles.find((f) => f.id === activeFileId)
              ? openFiles.find((f) => f.id === activeFileId)?.language
              : "plaintext"}
          </span>
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
