import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import TerminalComponent from "./components/TerminalComponent";
import { FaRegFolder, FaGlobe } from "react-icons/fa";
import { VscAccount, VscLiveShare, VscSearch } from "react-icons/vsc";
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

// Terminal
const DEFAULT_TERMINAL_HEIGHT_FRACTION = 0.33; // Corresponds to h-1/3
const MIN_TERMINAL_HEIGHT_PX = 50;
const MAX_TERMINAL_HEIGHT_PX = window.innerHeight * 0.8; // Example max
const TERMINAL_COLLAPSE_THRESHOLD_PX = 25;
const TERMINAL_HANDLE_HEIGHT = 4; // h-1 (was 6)

// --- WebView Resizing Constants ---
const DEFAULT_WEBVIEW_WIDTH_FRACTION = 0.4; // Start at 40% of the main area
const MIN_WEBVIEW_WIDTH = 150; // Minimum pixel width
const MAX_WEBVIEW_WIDTH = window.innerWidth * 0.8; // Example max
const WEBVIEW_HANDLE_GRAB_WIDTH = 8; // Width of the invisible grab area (like explorer)

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
  // 1. REFS FIRST
  const terminalRef = useRef<TerminalRef>();
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const editorTerminalAreaRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const viewMenuButtonRef = useRef<HTMLButtonElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null); // Added ref for header

  // 2. STATE SECOND
  const [activeIcon, setActiveIcon] = useState<string | null>("files");

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
    window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION
  );
  const [isTerminalResizing, setIsTerminalResizing] = useState<boolean>(false);
  const [previousTerminalHeight, setPreviousTerminalHeight] = useState<number>(
    window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION
  );

  // WebView Resizing State (Initialize using ref safely AFTER ref definition)
  const [webViewWidth, setWebViewWidth] = useState<number>(0);
  const [isWebViewResizing, setIsWebViewResizing] = useState<boolean>(false);
  const [previousWebViewWidth, setPreviousWebViewWidth] = useState<number>(
    DEFAULT_WEBVIEW_WIDTH_FRACTION // Initialize simply, update in effect if needed or handle null ref
  );
  // Effect to set initial previousWebViewWidth more accurately once ref is available
  useEffect(() => {
    if (mainContentRef.current) {
      setPreviousWebViewWidth(
        (mainContentRef.current.offsetWidth ?? window.innerWidth * (1 - 0.15)) *
          DEFAULT_WEBVIEW_WIDTH_FRACTION
      );
    }
  }, []); // Run only once on mount

  // Tab / File Management State
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<{ [id: string]: string }>(
    {}
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // View Menu State
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isWebViewVisible, setIsWebViewVisible] = useState(false);

  // 3. HANDLERS / FUNCTIONS THIRD

  // dnd-kit Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Drag Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    setDraggingId(draggedId);
  };

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

  // Code Execution Handler
  const handleRunCode = async () => {
    try {
      if (!activeFileId) {
        terminalRef.current?.writeToTerminal("No active file to run.\\n");
        return;
      }

      const activeFile = openFiles.find((f) => f.id === activeFileId);
      const contentToRun = fileContents[activeFileId];

      if (!activeFile || contentToRun === undefined) {
        terminalRef.current?.writeToTerminal(
          "Error: Active file data not found.\\n"
        );
        return;
      }

      // Check if the language is executable
      if (!isExecutableLanguage(activeFile.language)) {
        terminalRef.current?.writeToTerminal(
          `Cannot execute files of type '${activeFile.language}'.\\n`
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
        ? `${response.data.run.stdout}\\nError: ${response.data.run.stderr}`
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

  // Explorer Resizing Handlers
  const handleExplorerResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExplorerResizing(true);
  };

  const handleExplorerResizeMouseUp = useCallback(() => {
    if (isExplorerResizing) {
      setIsExplorerResizing(false);
      // Cursor/select reset handled by effect
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

  // Terminal Resizing Handlers
  const handleTerminalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsTerminalResizing(true);
    if (terminalHeight === 0) {
      // Let mouse move handle initial height
    }
  };

  const handleTerminalResizeMouseUp = useCallback(() => {
    if (isTerminalResizing) {
      setIsTerminalResizing(false);
      if (terminalHeight > 0) {
        terminalRef.current?.fit();
        setPreviousTerminalHeight(terminalHeight);
      }
      // Cursor/select reset handled by effect
    }
  }, [isTerminalResizing, terminalHeight]); // Add terminalHeight as dep

  const handleTerminalResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isTerminalResizing || !editorTerminalAreaRef.current) return;
      const containerRect =
        editorTerminalAreaRef.current.getBoundingClientRect();
      let newHeight = containerRect.bottom - e.clientY;
      newHeight = Math.max(0, newHeight);

      if (newHeight < TERMINAL_COLLAPSE_THRESHOLD_PX) {
        if (terminalHeight > 0) {
          setPreviousTerminalHeight(terminalHeight);
        }
        setTerminalHeight(0);
      } else {
        let constrainedHeight = Math.max(MIN_TERMINAL_HEIGHT_PX, newHeight);
        constrainedHeight = Math.min(MAX_TERMINAL_HEIGHT_PX, constrainedHeight);
        constrainedHeight = Math.min(
          constrainedHeight,
          containerRect.height - MIN_TERMINAL_HEIGHT_PX // Prevent pushing editor too small
        );
        setTerminalHeight(constrainedHeight);
      }
    },
    [isTerminalResizing, terminalHeight, previousTerminalHeight]
  );

  // WebView Resizing Handlers
  const handleWebViewResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsWebViewResizing(true);
  };

  const handleWebViewResizeMouseUp = useCallback(() => {
    if (isWebViewResizing) {
      setIsWebViewResizing(false);
      // Cursor/select reset handled by effect
    }
  }, [isWebViewResizing]);

  const handleWebViewResizeMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isWebViewResizing || !mainContentRef.current) return;
      const mainRect = mainContentRef.current.getBoundingClientRect();
      let newWidth = mainRect.right - e.clientX;
      newWidth = Math.max(MIN_WEBVIEW_WIDTH, newWidth);
      newWidth = Math.min(MAX_WEBVIEW_WIDTH, newWidth);
      // Optional: Prevent editor area from becoming too small
      // const editorAreaMinWidth = 200; // Example minimum width for editor+terminal
      // newWidth = Math.min(newWidth, mainRect.width - (sidebarContainerRef.current?.offsetWidth ?? 0) - editorAreaMinWidth);
      setWebViewWidth(newWidth);
    },
    [isWebViewResizing] // Keep minimal dependency
  );

  // Global Pointer Up Handler (MUST be defined AFTER individual MouseUp handlers)
  const handleGlobalPointerUp = useCallback(
    (e: PointerEvent) => {
      if (isWebViewResizing) handleWebViewResizeMouseUp();
      if (isExplorerResizing) handleExplorerResizeMouseUp();
      if (isTerminalResizing) handleTerminalResizeMouseUp();
    },
    [
      isExplorerResizing,
      handleExplorerResizeMouseUp,
      isTerminalResizing,
      handleTerminalResizeMouseUp,
      isWebViewResizing,
      handleWebViewResizeMouseUp, // Now these are defined above
    ]
  );

  // UI Interaction Handlers
  const toggleExplorer = () => {
    setActiveIcon((prevActiveIcon) => {
      const isExplorerOpen = explorerWidth > 0;
      if (isExplorerOpen) {
        if (explorerWidth > MIN_EXPLORER_WIDTH / 2) {
          setPreviousExplorerWidth(explorerWidth);
        }
        setExplorerWidth(0);
        return null;
      } else {
        setExplorerWidth(previousExplorerWidth || DEFAULT_EXPLORER_WIDTH);
        return "files";
      }
    });
  };

  const handleIconClick = (iconName: string | null) => {
    setActiveIcon((prevActiveIcon) => {
      let nextActiveIcon = iconName;
      const currentExplorerWidth = explorerWidth;

      if (iconName === "files" && prevActiveIcon === "files") {
        toggleExplorer();
        nextActiveIcon = currentExplorerWidth === 0 ? "files" : null;
      } else if (iconName === "files") {
        setExplorerWidth(previousExplorerWidth || DEFAULT_EXPLORER_WIDTH);
      } else {
        // Switching to other icons or null
        if (currentExplorerWidth > MIN_EXPLORER_WIDTH / 2) {
          setPreviousExplorerWidth(currentExplorerWidth);
        }
        setExplorerWidth(0);
      }
      return nextActiveIcon;
    });
  };

  // File Handling
  const handleOpenFile = (fileId: string) => {
    if (!MOCK_FILES[fileId]) return;
    const fileData = MOCK_FILES[fileId];
    if (!openFiles.some((f) => f.id === fileId)) {
      const newOpenFile: OpenFile = {
        id: fileId,
        name: fileData.name,
        language: fileData.language,
      };
      setOpenFiles((prev) => [...prev, newOpenFile]);
      setFileContents((prev) => ({ ...prev, [fileId]: fileData.content }));
    }
    setActiveFileId(fileId);
  };

  const handleSwitchTab = (fileId: string) => {
    setActiveFileId(fileId);
  };

  const handleCloseTab = (fileIdToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const indexToRemove = openFiles.findIndex((f) => f.id === fileIdToClose);
    if (indexToRemove === -1) return;
    let nextActiveId: string | null = null;
    if (activeFileId === fileIdToClose) {
      if (openFiles.length > 1) {
        const remainingFiles = openFiles.filter((f) => f.id !== fileIdToClose);
        nextActiveId =
          remainingFiles[Math.max(0, indexToRemove - 1)]?.id ??
          remainingFiles[0]?.id;
      }
    } else {
      nextActiveId = activeFileId;
    }
    setActiveFileId(nextActiveId);
    setOpenFiles((prev) => prev.filter((f) => f.id !== fileIdToClose));
    setFileContents((prev) => {
      const newContents = { ...prev };
      delete newContents[fileIdToClose];
      return newContents;
    });
  };

  const handleCodeChange = (newCode: string) => {
    if (activeFileId) {
      setFileContents((prev) => ({ ...prev, [activeFileId]: newCode }));
    }
  };

  // View Menu / WebView Handlers
  const toggleWebView = () => {
    setIsWebViewVisible((prevVisible) => {
      const nextVisible = !prevVisible;
      if (nextVisible) {
        const widthToSet =
          previousWebViewWidth > MIN_WEBVIEW_WIDTH
            ? previousWebViewWidth
            : (mainContentRef.current?.offsetWidth ??
                window.innerWidth * (1 - 0.15)) *
              DEFAULT_WEBVIEW_WIDTH_FRACTION;
        setWebViewWidth(widthToSet);
      } else {
        if (webViewWidth > MIN_WEBVIEW_WIDTH / 2) {
          // Save width before hiding
          setPreviousWebViewWidth(webViewWidth);
        }
        setWebViewWidth(0); // Set width to 0 when hiding
      }
      return nextVisible;
    });
    setIsViewMenuOpen(false);
  };

  // Toggle Terminal Visibility
  const toggleTerminalVisibility = () => {
    if (terminalHeight > 0) {
      // Closing: Save current height (if substantial) and set to 0
      if (terminalHeight > TERMINAL_COLLAPSE_THRESHOLD_PX) {
        // Avoid saving tiny heights
        setPreviousTerminalHeight(terminalHeight);
      }
      setTerminalHeight(0);
    } else {
      // Opening: Restore previous height or use default
      const heightToRestore =
        previousTerminalHeight > MIN_TERMINAL_HEIGHT_PX
          ? previousTerminalHeight
          : window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION;
      setTerminalHeight(heightToRestore);
      // Fit terminal after restoring height
      requestAnimationFrame(() => terminalRef.current?.fit());
    }
    setIsViewMenuOpen(false); // Close menu
  };

  // Derived State (Memos)
  const htmlFileContent = useMemo(() => {
    const htmlFile = openFiles.find((f) => f.language === "html");
    return htmlFile
      ? fileContents[htmlFile.id] || ""
      : "<!-- No HTML file open -->";
  }, [openFiles, fileContents]);

  const cssFileContent = useMemo(() => {
    const cssFile = openFiles.find((f) => f.language === "css");
    return cssFile ? fileContents[cssFile.id] || "" : "/* No CSS file open */";
  }, [openFiles, fileContents]);

  const jsFileContent = useMemo(() => {
    const jsFile = openFiles.find((f) => f.language === "javascript");
    return jsFile ? fileContents[jsFile.id] || "" : "// No JS file open";
  }, [openFiles, fileContents]);

  // 4. EFFECTS FOURTH

  // Explorer Resizing Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleExplorerResizeMouseMove(e);
    if (isExplorerResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      if (!isTerminalResizing && !isWebViewResizing) {
        // Check other states
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      // Ensure cursor/select reset if this was the *last* active resize
      if (!isTerminalResizing && !isWebViewResizing) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, [
    isExplorerResizing,
    handleExplorerResizeMouseMove,
    isTerminalResizing,
    isWebViewResizing,
  ]); // Add other resize states

  // Terminal Resizing Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleTerminalResizeMouseMove(e);
    if (isTerminalResizing) {
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      if (!isExplorerResizing && !isWebViewResizing) {
        // Check other states
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
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
  ]); // Add other resize states

  // WebView Resizing Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleWebViewResizeMouseMove(e);
    if (isWebViewResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      if (!isExplorerResizing && !isTerminalResizing) {
        // Check other states
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (!isExplorerResizing && !isTerminalResizing) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, [
    isWebViewResizing,
    handleWebViewResizeMouseMove,
    isExplorerResizing,
    isTerminalResizing,
  ]); // Add other resize states

  // Global Pointer Up Effect
  useEffect(() => {
    document.addEventListener("pointerup", handleGlobalPointerUp);
    document.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      document.removeEventListener("pointerup", handleGlobalPointerUp);
      document.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [handleGlobalPointerUp]);

  // Close View Menu on Outside Click Effect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isViewMenuOpen &&
        viewMenuRef.current &&
        !viewMenuRef.current.contains(event.target as Node) &&
        viewMenuButtonRef.current &&
        !viewMenuButtonRef.current.contains(event.target as Node)
      ) {
        setIsViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewMenuOpen]); // Keep minimal dependency

  // 5. RETURN JSX LAST
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300 overflow-hidden">
      {/* Header - Removed p-2, added items-stretch */}
      <div
        ref={headerRef}
        className="flex items-stretch justify-between bg-stone-800 bg-opacity-80 border-b border-stone-600 flex-shrink-0 relative h-10"
      >
        {" "}
        {/* Added fixed height h-10 */}
        {/* Left Buttons Container - Ensure it stretches height */}
        <div className="flex items-stretch">
          {/* Removed space-x-2, buttons will manage their padding */}
          <div className="flex h-full">
            {/* File Button - Updated classes */}
            <button className="h-full flex items-center px-3 text-sm text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600">
              File
            </button>
            {/* Edit Button - Updated classes */}
            <button className="h-full flex items-center px-3 text-sm text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600">
              Edit
            </button>
            {/* View Button - Updated classes */}
            <button
              className={`h-full flex items-center px-3 text-sm ${
                isViewMenuOpen
                  ? "bg-stone-600 text-stone-200"
                  : "text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600"
              } relative`} // Added conditional background and text color
              onClick={() => setIsViewMenuOpen((prev) => !prev)}
              ref={viewMenuButtonRef}
            >
              View
            </button>
            {/* Run Button - Updated classes */}
            <button
              className="h-full flex items-center px-3 text-sm text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600"
              onClick={handleRunCode}
            >
              Run
            </button>
          </div>
          {/* View Dropdown Menu - Positioning might need slight adjustment if header height changed */}
          {isViewMenuOpen && (
            <div
              ref={viewMenuRef}
              className="absolute bg-stone-700 border border-stone-600 shadow-lg z-50 whitespace-nowrap" // Removed rounded
              style={{
                left: `${viewMenuButtonRef.current?.offsetLeft ?? 0}px`,
                top: `${headerRef.current?.offsetHeight ?? 0}px`, // Position based on header height
              }}
            >
              {/* ... dropdown buttons ... */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWebView();
                }}
                className="block w-full text-left px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-600"
              >
                {isWebViewVisible ? "Close Web View" : "Open Web View"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTerminalVisibility();
                }}
                className="block w-full text-left px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-600"
              >
                {terminalHeight > 0 ? "Close Terminal" : "Open Terminal"}
              </button>
            </div>
          )}
        </div>
        {/* Right side - Add padding here if needed */}
        <div className="flex items-center space-x-2 px-2">
          {" "}
          {/* Added padding here */}
          {/* ... User Avatar / Help buttons ... */}
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
          {activeIcon === "files" && explorerWidth > 0 && (
            <div
              className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
              style={{
                width: `${EXPLORER_HANDLE_WIDTH}px`,
                left: `${
                  ICON_BAR_WIDTH + explorerWidth - EXPLORER_HANDLE_WIDTH / 2
                }px`,
                pointerEvents: "auto",
              }}
              onMouseDown={handleExplorerResizeMouseDown}
            />
          )}
        </div>

        {/* Code and Terminal Area + Optional WebView */}
        <div className="flex flex-1 min-w-0 relative">
          {/* Code and Terminal Area */}
          <div
            ref={editorTerminalAreaRef}
            className="flex-1 flex flex-col relative overflow-x-hidden min-w-0"
          >
            {/* Tabs */}
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

          {/* Invisible WebView Resizer Handle (Positioned Absolutely) */}
          {isWebViewVisible && webViewWidth > 0 && (
            <div
              className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
              style={{
                width: `${WEBVIEW_HANDLE_GRAB_WIDTH}px`,
                // Position it centered over the boundary
                left: `calc(100% - ${webViewWidth}px - ${
                  WEBVIEW_HANDLE_GRAB_WIDTH / 2
                }px)`,
              }}
              onMouseDown={handleWebViewResizeMouseDown}
            />
          )}

          {/* WebView Panel (border provides the 1px visual line) */}
          {isWebViewVisible && webViewWidth > 0 && (
            <div
              className="flex-shrink-0 border-l border-stone-600 overflow-hidden" // Keep the border-l for visual
              style={{ width: `${webViewWidth}px` }}
            >
              <WebViewPanel
                htmlContent={htmlFileContent}
                cssContent={cssFileContent}
                jsContent={jsFileContent}
              />
            </div>
          )}
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

      {/* Resizing Overlay */}
      {(isExplorerResizing || isTerminalResizing || isWebViewResizing) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999, // Ensure it's on top
            cursor: document.body.style.cursor, // Inherit cursor from body style set by effects
            // background: 'rgba(0, 255, 0, 0.1)', // Uncomment for debugging visibility
          }}
        />
      )}
    </div>
  );
};

export default CodeEditorUI;
