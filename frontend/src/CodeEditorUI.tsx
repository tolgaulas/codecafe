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
import { FiCopy, FiX } from "react-icons/fi";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";
import { COLORS } from "./constants/colors";
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
import { motion, AnimatePresence } from "framer-motion";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import { v4 as uuidv4 } from "uuid";
import { editor } from "monaco-editor";
import {
  TextOperation,
  MonacoAdapter,
  OTSelection,
  Client,
  IClientCallbacks,
} from "./TextOperationSystem";
import JoinSessionPanel from "./components/JoinSessionPanel"; // Import the new component

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

// Add new state type for join process
type JoinStateType = "idle" | "prompting" | "joined";

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

// Minimum width specifically for the Join Session panel
const MIN_JOIN_PANEL_WIDTH = 256; // New constant

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
  const shareButtonRef = useRef<HTMLButtonElement>(null); // <-- Ref for Share button
  const shareMenuRef = useRef<HTMLDivElement>(null); // <-- Ref for Share menu

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
    () => {
      // Use a function initializer to avoid recomputing on every render
      return {
        "index.html": MOCK_FILES["index.html"].content,
        "style.css": MOCK_FILES["style.css"].content,
        "script.js": MOCK_FILES["script.js"].content,
      };
    }
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // View Menu State
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isWebViewVisible, setIsWebViewVisible] = useState(false);

  // Share Menu State <-- Add Share Menu State
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [userName, setUserName] = useState(""); // Store user's name
  const [userColor, setUserColor] = useState(COLORS[0]); // Default color
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // Share Menu View State
  const [shareMenuView, setShareMenuView] = useState<"initial" | "link">(
    "initial"
  );
  const [generatedShareLink, setGeneratedShareLink] = useState<string | null>(
    null
  );

  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isSessionCreator, setIsSessionCreator] = useState<boolean>(false);

  // OT State
  const [userId] = useState<string>(() => "user-" + uuidv4());
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const adapterRef = useRef<MonacoAdapter | null>(null);
  const clientRef = useRef<Client | null>(null);
  const stompClientRef = useRef<Stomp.Client | null>(null);

  // Flag to control editor readiness for OT
  const [isEditorReadyForOT, setIsEditorReadyForOT] = useState(false);

  // Add new state for join process
  const [joinState, setJoinState] = useState<JoinStateType>("idle");

  // 3. HANDLERS / FUNCTIONS THIRD

  // Editor Mount Handler
  const handleEditorDidMount = (
    editorInstance: editor.IStandaloneCodeEditor
  ) => {
    console.log("Monaco Editor Instance Mounted:", editorInstance);
    editorInstanceRef.current = editorInstance;
    setIsEditorReadyForOT(true); // Mark editor as ready
  };

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
        "http://localhost:8080/api/execute",
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
    // --- Add this check ---
    // If we are prompting the user to join, don't allow changing sidebar state via icons.
    if (joinState === "prompting") {
      console.log("Ignoring icon click while prompting for join details.");
      return; // Prevent icon clicks from changing state during prompt
    }
    // --- End check ---

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

    // Determine content to load based on session state
    const contentToLoad = isSessionActive
      ? "// Loading session content..." // Show loading if session active
      : fileData.content; // Otherwise, load mock content

    if (!openFiles.some((f) => f.id === fileId)) {
      const newOpenFile: OpenFile = {
        id: fileId,
        name: fileData.name,
        language: fileData.language,
      };
      setOpenFiles((prev) => [...prev, newOpenFile]);
      // Use contentToLoad when adding the file content initially
      setFileContents((prev) => ({ ...prev, [fileId]: contentToLoad }));
    }
    // If the file is already open, we don't modify its content here.

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

  // Share Menu Handlers <-- Add Share Menu Handlers
  const toggleShareMenu = () => {
    setIsShareMenuOpen((prev) => {
      const closing = prev;
      if (closing) {
        // Reset view state when closing
        setShareMenuView("initial");
        setGeneratedShareLink(null);
      }
      setIsColorPickerOpen(false); // Close color picker when toggling menu
      return !prev;
    });
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(event.target.value);
    setIsColorPickerOpen(false); // Close picker on name change in either context
  };

  const handleColorSelect = (color: string) => {
    setUserColor(color);
    setIsColorPickerOpen(false); // Close picker on color select in either context
  };

  // Add handler to specifically toggle the color picker state
  const handleToggleColorPicker = () => {
    setIsColorPickerOpen((prev) => !prev);
  };

  const handleStartSession = async () => {
    if (!userName.trim()) return; // Prevent starting with empty name

    setIsColorPickerOpen(false); // Ensure color picker is closed

    try {
      // 1. Create the session
      console.log(
        `[handleStartSession] Creating session for user: ${userName.trim()}`
      );
      const createResponse = await axios.post<{ sessionId: string }>(
        "http://localhost:8080/api/sessions/create",
        {
          creatorName: userName.trim(), // Send trimmed name
        }
      );

      const newSessionId = createResponse.data.sessionId;
      console.log(
        "[handleStartSession] Session created successfully:",
        newSessionId
      );

      // 2. Set initial content for key files on the backend
      const keyFiles = ["index.html", "style.css", "script.js"];
      const initialContentPromises = keyFiles.map((fileId) => {
        const currentContent = fileContents[fileId];
        if (currentContent !== undefined) {
          // Only send if content exists locally
          console.log(
            `[handleStartSession] Sending initial content for ${fileId} to session ${newSessionId}`
          );
          return axios
            .post(
              `http://localhost:8080/api/sessions/${newSessionId}/set-document`,
              {
                documentId: fileId,
                content: currentContent,
              }
            )
            .catch((err) => {
              // Log error for specific file but don't block session start entirely
              console.error(
                `[handleStartSession] Failed to set initial content for ${fileId}:`,
                err
              );
              return null; // Allow Promise.all to complete
            });
        } else {
          console.warn(
            `[handleStartSession] No local content found for key file ${fileId}, skipping initial set.`
          );
          return Promise.resolve(null); // Resolve promise for skipped files
        }
      });

      // Wait for all initial content requests to finish (or fail individually)
      await Promise.all(initialContentPromises);
      console.log(
        "[handleStartSession] Finished attempting to set initial document content."
      );

      // Ensure local state reflects the content just sent (for creator)
      setFileContents((prevContents) => {
        const newContents = { ...prevContents };
        keyFiles.forEach((fileId) => {
          const sentContent = fileContents[fileId]; // Get the content that was sent
          if (sentContent !== undefined) {
            newContents[fileId] = sentContent;
          }
        });
        return newContents;
      });
      console.log(
        "[handleStartSession] Updated local fileContents state post-init."
      );

      // 3. Update frontend state and URL
      const shareLink = `${window.location.origin}${window.location.pathname}?session=${newSessionId}`;
      console.log("[handleStartSession] Share link:", shareLink);

      setSessionId(newSessionId);
      setIsSessionCreator(true);
      setIsSessionActive(true); // Mark session as active locally
      setGeneratedShareLink(shareLink);
      setShareMenuView("link"); // Switch to link view

      // Update URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.set("session", newSessionId);
      window.history.pushState({}, "", url.toString());
    } catch (error) {
      console.error(
        "[handleStartSession] Error creating session or setting initial content:",
        error
      );
      alert("Failed to create session. Please try again.");
    }
  };

  // Copy Share Link Handler
  const handleCopyShareLink = () => {
    if (generatedShareLink) {
      navigator.clipboard
        .writeText(generatedShareLink)
        .then(() => {
          // Optional: Add feedback to the user (e.g., change button text to "Copied!")
          console.log("Link copied to clipboard!");
        })
        .catch((err) => {
          console.error("Failed to copy link: ", err);
          // Optional: Show an error message to the user
        });
    }
  };

  // NEW Handler for confirming join from the Join Panel
  const handleConfirmJoin = () => {
    if (!userName.trim()) {
      alert("Please enter a display name to join."); // Simple validation
      return;
    }
    console.log(`User ${userName} confirmed join for session ${sessionId}`);
    setJoinState("joined"); // Mark as joined
    setIsSessionActive(true); // Activate the session (triggers WS connection)
    setActiveIcon("files"); // Switch back to file explorer view
    // Sidebar width should already be open from the prompt state
  };

  // WebSocket Connection Effect
  useEffect(() => {
    // Conditions to establish connection: session active, file open, editor ready
    if (
      !isSessionActive ||
      !activeFileId ||
      !editorInstanceRef.current ||
      !isEditorReadyForOT
    ) {
      // Cleanup existing connection if conditions are not met
      if (stompClientRef.current?.connected) {
        console.log(
          `[WS Cleanup] Disconnecting STOMP (Reason: sessionActive=${isSessionActive}, activeFileId=${activeFileId}, editorReady=${isEditorReadyForOT})`
        );
        stompClientRef.current.disconnect(() =>
          console.log("[STOMP] Disconnected due to unmet conditions.")
        );
        stompClientRef.current = null;
        clientRef.current = null; // Reset client
        adapterRef.current?.detach(); // Detach adapter
        adapterRef.current = null; // Reset adapter
      }
      return; // Exit effect if conditions not met
    }

    console.log(
      `[WS Setup] Conditions met for file ${activeFileId}. Setting up STOMP...`
    );

    // Ensure previous connection is cleaned up before starting new one
    if (stompClientRef.current?.connected) {
      console.warn(
        "[WS Setup] Stomp client already connected during setup? Disconnecting first."
      );
      stompClientRef.current.disconnect(() => {}); // Provide empty callback
      stompClientRef.current = null;
    }
    // Reset OT state before connecting for the new file
    clientRef.current = null;
    adapterRef.current?.detach();
    adapterRef.current = null;

    const currentEditorInstance = editorInstanceRef.current;
    const currentActiveFileId = activeFileId; // Capture activeFileId for this effect closure

    // Set initial code state for the new file (e.g., loading indicator)
    // The actual content will be set by the document-state message
    const model = currentEditorInstance.getModel();
    if (model && model.getValue() !== "// Loading document...") {
      // model.setValue("// Loading document...");
      // Temporarily disable setting loading text to avoid flashing
      // Maybe set a loading state elsewhere in the UI
    }

    console.log("[WS Setup] Connecting via SockJS...");
    const socket = new SockJS("http://localhost:8080/ws"); // Use localhost
    const stompClient = Stomp.over(socket);
    stompClientRef.current = stompClient;

    if (!adapterRef.current && currentEditorInstance) {
      console.log(
        `[WS Setup] Initializing MonacoAdapter for ${currentActiveFileId}`
      );
      adapterRef.current = new MonacoAdapter(currentEditorInstance);
    }

    let subscriptions: Stomp.Subscription[] = [];

    stompClient.connect(
      {},
      (frame: any) => {
        console.log(
          `[STOMP Connected] Frame: ${frame}, File: ${currentActiveFileId}`
        );

        // Define callbacks WITH documentId included
        const clientCallbacks: IClientCallbacks = {
          sendOperation: (revision: number, operation: TextOperation) => {
            if (stompClientRef.current?.connected && currentActiveFileId) {
              console.log(
                `[sendOperation Callback] Preparing to send Op for ${currentActiveFileId} @ rev ${revision}`
              );
              const payload = {
                documentId: currentActiveFileId,
                clientId: userId,
                revision: revision,
                operation: operation.toJSON(),
              };
              console.log(`[Client -> Server Op] /app/operation`, payload);
              stompClientRef.current.send(
                "/app/operation",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.error(
                "Cannot send operation - STOMP not connected or no active file"
              );
            }
          },
          sendSelection: (selection: OTSelection | null) => {
            if (stompClientRef.current?.connected && currentActiveFileId) {
              const payload = {
                documentId: currentActiveFileId,
                clientId: userId,
                selection: selection?.toJSON() ?? null,
              };
              console.log(`[Client -> Server Sel] /app/selection`, payload);
              stompClientRef.current.send(
                "/app/selection",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.warn(
                "Cannot send selection - STOMP not connected or no active file"
              );
            }
          },
          applyOperation: (operation: TextOperation) => {
            console.log(`[Client -> Editor Apply] Op: ${operation.toString()}`);
            adapterRef.current?.applyOperation(operation);
          },
          getSelection: () => {
            return adapterRef.current?.getSelection() ?? null;
          },
          setSelection: (selection: OTSelection | null) => {
            adapterRef.current?.setSelection(selection);
          },
        };

        // Subscribe to topics (handle documentId filtering)

        // Document State Handling
        subscriptions.push(
          stompClient.subscribe("/topic/document-state", (message: any) => {
            try {
              const state = JSON.parse(message.body);
              console.log(`[Server -> Client State] Received:`, state);

              // *** Check if state is for the currently active file ***
              if (state.documentId !== currentActiveFileId) {
                console.log(
                  `   Ignoring state for inactive file: ${state.documentId} (current: ${currentActiveFileId})`
                );
                return;
              }

              if (!clientRef.current) {
                console.log(
                  `   Initializing Client for ${state.documentId} @ rev ${state.revision}`
                );
                clientRef.current = new Client(
                  state.revision,
                  userId,
                  clientCallbacks
                );

                if (currentEditorInstance) {
                  const model = currentEditorInstance.getModel();
                  const currentEditorValue = model?.getValue();
                  if (model && currentEditorValue !== state.document) {
                    console.log(
                      `   Setting initial document content for ${state.documentId}.`
                    );
                    if (adapterRef.current)
                      adapterRef.current.ignoreNextChange = true;
                    // Use pushEditOperations for setting initial content to avoid breaking undo stack
                    model.pushEditOperations(
                      [],
                      [
                        {
                          range: model.getFullModelRange(),
                          text: state.document,
                        },
                      ],
                      () => null // No undo stop needed here usually
                    );
                    // model.setValue(state.document); // Old method
                  } else {
                    console.log(
                      `   Editor content already matches for ${state.documentId}.`
                    );
                  }
                }
                // Register adapter ONLY after client is initialized and doc is set
                adapterRef.current?.registerCallbacks({
                  change: (op: TextOperation, inverse: TextOperation) => {
                    console.log(
                      `[Adapter Callback] Change triggered for ${currentActiveFileId}. Op: ${op.toString()}`
                    );
                    if (!clientRef.current) {
                      console.error(
                        `[Adapter Callback] Error: clientRef is null when change occurred for ${currentActiveFileId}`
                      );
                      return;
                    }
                    console.log(
                      `[Adapter Callback] Calling applyClient. Client State: ${clientRef.current.state.constructor.name}, Revision: ${clientRef.current.revision}`
                    );
                    clientRef.current?.applyClient(op);
                  },
                  selectionChange: () => {
                    // console.log(`[Editor -> Client SelChange] File: ${currentActiveFileId}`);
                    clientRef.current?.selectionChanged();
                  },
                  blur: () => {
                    console.log(
                      `[Editor -> Client Blur] File: ${currentActiveFileId}`
                    );
                    clientRef.current?.blur();
                  },
                });
              } else {
                console.warn(
                  `[Server -> Client State] Received state for ${state.documentId} after client init. Rev: ${state.revision}, ClientRev: ${clientRef.current.revision}`
                );
                // Optional: Handle revision mismatch/resync logic here if needed
              }
            } catch (error) {
              console.error(
                "Error processing document-state message:",
                error,
                message.body
              );
            }
          })
        );

        // Operations Handling
        subscriptions.push(
          stompClient.subscribe("/topic/operations", (message: any) => {
            try {
              const payload = JSON.parse(message.body);
              if (
                !payload ||
                !payload.clientId ||
                !payload.operation ||
                !payload.documentId
              ) {
                console.error(
                  "[Server -> Client Op] Invalid payload:",
                  message.body
                );
                return;
              }
              // Don't log every single op, maybe just errors or state changes
              // console.log(`[Server -> Client Op] Received from ${payload.clientId} for ${payload.documentId}:`, payload.operation);

              // *** Ignore own messages ***
              if (payload.clientId === userId) {
                // console.log("   Ignoring own operation broadcast.");
                return;
              }

              // *** Apply to ACTIVE file via OT Client ***
              if (payload.documentId === currentActiveFileId) {
                if (clientRef.current) {
                  try {
                    const operation = TextOperation.fromJSON(payload.operation);
                    clientRef.current.applyServer(operation);
                  } catch (e) {
                    console.error(
                      `[Server -> Client Op] Error applying server op to ACTIVE file ${currentActiveFileId}:`,
                      e,
                      payload.operation
                    );
                  }
                } else {
                  console.warn(
                    `[Server -> Client Op] Received op for ACTIVE file ${payload.documentId} before client init.`
                  );
                }
              }
              // *** Apply directly to ANY OTHER file state (inactive or not currently open) ***
              else {
                console.log(
                  `Applying server op directly to background file state: ${payload.documentId}`
                );
                try {
                  const operation = TextOperation.fromJSON(payload.operation);
                  // Apply the operation directly to the state string for the file
                  setFileContents((prevContents) => {
                    const currentContent =
                      prevContents[payload.documentId] ?? ""; // Get current content or default to empty
                    if (currentContent === "// Loading session content...") {
                      // If the file is still in the initial loading state, maybe wait for full state?
                      // Or apply tentatively. Let's apply for now.
                      console.warn(
                        `Applying op to background file ${payload.documentId} that might still be loading.`
                      );
                    }
                    const newContent = operation.apply(currentContent); // Apply the text operation
                    return {
                      ...prevContents,
                      [payload.documentId]: newContent,
                    };
                  });
                } catch (e) {
                  console.error(
                    `Error applying server op to background file ${payload.documentId}:`,
                    e,
                    payload.operation
                  );
                }
              }
              // File not open check removed - we store all updates now
            } catch (error) {
              console.error(
                "Error processing operations message:",
                error,
                message.body
              );
            }
          })
        );

        // Selections Handling
        subscriptions.push(
          stompClient.subscribe("/topic/selections", (message: any) => {
            try {
              const payload = JSON.parse(message.body);
              if (!payload || !payload.clientId || !payload.documentId) {
                // Check documentId
                console.error(
                  "[Server -> Client Sel] Invalid payload:",
                  message.body
                );
                return;
              }
              // console.log(`[Server -> Client Sel] Received from ${payload.clientId} for ${payload.documentId}:`, payload.selection);

              // *** Ignore if for different file or own message ***
              if (payload.documentId !== currentActiveFileId) {
                // console.log(`   Ignoring selection for inactive file: ${payload.documentId}`);
                return;
              }
              if (payload.clientId === userId) {
                return; // Don't process own selection echoes
              }

              if (clientRef.current && adapterRef.current) {
                const selection = payload.selection
                  ? OTSelection.fromJSON(payload.selection)
                  : null;
                if (selection) {
                  try {
                    // TODO: Implement visual display of remote selections
                    // For now, just log the transformed selection
                    const transformedSelection =
                      clientRef.current.transformSelection(selection);
                    // console.log(`   Transformed selection for ${payload.clientId} on ${payload.documentId}:`, transformedSelection.toJSON());
                    // adapterRef.current.setOtherSelection(transformedSelection, remoteUserColor, payload.clientId);
                  } catch (e) {
                    console.error(
                      "[Server -> Client Sel] Error transforming remote selection:",
                      e,
                      payload.selection
                    );
                  }
                } else {
                  // Handle cursor blur / selection removal for the remote user
                  // adapterRef.current.removeOtherSelection(payload.clientId);
                }
              } else {
                // console.warn(`[Server -> Client Sel] Received selection for ${payload.documentId} before client/adapter init.`);
              }
            } catch (error) {
              console.error(
                "Error processing selections message:",
                error,
                message.body
              );
            }
          })
        );

        // ACK Handling (remains user-specific, not document-specific)
        const ackTopic = `/topic/ack/${userId}`;
        console.log(`[STOMP Setup] Subscribing to ACK topic: ${ackTopic}`);
        subscriptions.push(
          stompClient.subscribe(ackTopic, (message: any) => {
            console.log(`[Server -> Client ACK] Received`);
            if (message.body === "ack") {
              clientRef.current?.serverAck();
            } else {
              console.warn(
                "[Server -> Client ACK] Received unexpected ACK message:",
                message.body
              );
            }
          })
        );

        // Request initial state FOR THE CURRENT ACTIVE FILE
        console.log(
          `[Client -> Server ReqState] Requesting state for ${currentActiveFileId}...`
        );
        stompClient.send(
          "/app/get-document-state",
          {},
          JSON.stringify({ documentId: currentActiveFileId })
        );
      },
      (error: any) => {
        console.error(
          `[STOMP Error] Connection Failed for ${currentActiveFileId}:`,
          error
        );
        // Optionally set code state to show error
        // setFileContents(prev => ({...prev, [currentActiveFileId]: "// Connection failed."})) ;
        setIsSessionActive(false); // Consider if this should affect the whole session
        // Reset OT state on connection error
        clientRef.current = null;
        adapterRef.current?.detach();
        adapterRef.current = null;
      }
    );

    // Cleanup function for the effect
    return () => {
      console.log(
        `[WS Cleanup] Running cleanup for file ${currentActiveFileId} effect...`
      );
      subscriptions.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.warn("Error unsubscribing:", e);
        }
      });
      subscriptions = [];
      if (stompClientRef.current?.connected) {
        console.log("[WS Cleanup] Disconnecting STOMP client in cleanup.");
        stompClientRef.current.disconnect(() =>
          console.log("[STOMP] Disconnected via effect cleanup.")
        );
      }
      // Don't nullify stompClientRef here, the outer check handles it
      // Reset client and adapter refs specific to this file connection attempt
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
      console.log(`[WS Cleanup] Finished cleanup for ${currentActiveFileId}.`);
    };
    // Depend on session, active file, and editor readiness
  }, [isSessionActive, sessionId, activeFileId, userId, isEditorReadyForOT]);

  // Derived State (Memos)
  const htmlFileContent = useMemo(() => {
    // Directly access the content from the state, provide default if not found
    return (
      fileContents["index.html"] ||
      "<!DOCTYPE html><html><head></head><body><!-- index.html not loaded --></body></html>"
    );
  }, [fileContents]); // Depend only on fileContents

  const cssFileContent = useMemo(() => {
    // Directly access the content from the state, provide default if not found
    return fileContents["style.css"] || "/* style.css not loaded */";
  }, [fileContents]); // Depend only on fileContents

  const jsFileContent = useMemo(() => {
    // Directly access the content from the state, provide default if not found
    return fileContents["script.js"] || "// script.js not loaded";
  }, [fileContents]); // Depend only on fileContents

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

  // Close Share Menu on Outside Click Effect <-- Add effect for Share Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isShareMenuOpen &&
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target as Node) &&
        shareButtonRef.current &&
        !shareButtonRef.current.contains(event.target as Node)
      ) {
        // Reset view state when closing via outside click
        setShareMenuView("initial");
        setGeneratedShareLink(null);
        setIsShareMenuOpen(false);
        setIsColorPickerOpen(false); // Also close color picker
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isShareMenuOpen]);

  // Effect to handle joining via URL parameter
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionIdFromUrl = url.searchParams.get("session");

    // Check if joining via URL AND session isn't already active/joined
    if (sessionIdFromUrl && !isSessionActive && joinState === "idle") {
      console.log(
        `[Join Effect] Conditions met. sessionId: ${sessionIdFromUrl}, isSessionActive: ${isSessionActive}, joinState: ${joinState}, explorerWidth: ${explorerWidth}`
      );
      setSessionId(sessionIdFromUrl);
      setIsSessionCreator(false); // Joining user is not the creator
      setJoinState("prompting"); // Set state to show prompt panel

      // Ensure sidebar is visible for the prompt and meets minimum width
      let targetWidth = DEFAULT_EXPLORER_WIDTH; // Start with default
      if (explorerWidth > 0) {
        // If already open, consider its current width
        targetWidth = Math.max(targetWidth, explorerWidth);
      } else if (previousExplorerWidth > MIN_EXPLORER_WIDTH / 2) {
        // If closed, consider the last known width (if valid)
        targetWidth = Math.max(targetWidth, previousExplorerWidth);
      }
      // Ensure it's at least the minimum required for the join panel
      targetWidth = Math.max(targetWidth, MIN_JOIN_PANEL_WIDTH);

      // Apply the calculated target width
      setExplorerWidth(targetWidth);

      // Clean the URL
      const updatedUrl = new URL(window.location.href); // Renamed from cleanUrl
      updatedUrl.searchParams.delete("session");
      window.history.replaceState({}, "", updatedUrl.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, joinState]); // explorerWidth was removed from deps

  // 5. RETURN JSX LAST
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300 overflow-hidden">
      {/* Header - Removed p-2, added items-stretch */}
      <div
        ref={headerRef}
        className="flex items-stretch justify-between bg-stone-800 bg-opacity-80 border-b border-stone-600 flex-shrink-0 relative h-11"
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
        {/* Right side - Change px-2 to p-2 for all-around padding */}
        <div className="flex items-stretch">
          {" "}
          {/* Use items-stretch */}
          {/* Share Button */}
          <div className="relative flex h-full">
            {" "}
            {/* Wrap button to allow relative dropdown positioning */}
            <button
              ref={shareButtonRef}
              onClick={toggleShareMenu}
              className={`h-full flex items-center px-4 text-sm ${
                isShareMenuOpen
                  ? "bg-stone-600 text-stone-200"
                  : "text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600"
              }`}
            >
              {/* <HiOutlineShare className="mr-1.5 -ml-0.5" size={16} /> */}
              Share
            </button>
            {/* Share Dropdown Menu */}
            <AnimatePresence>
              {isShareMenuOpen && (
                <motion.div
                  ref={shareMenuRef}
                  className="absolute right-0 w-64 bg-stone-800 border border-stone-700 shadow-xl z-50 p-4" // Removed mt-1
                  style={{
                    top: `${headerRef.current?.offsetHeight ?? 0}px`, // Position based on header height
                  }}
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                >
                  {/* Conditional Rendering based on view state */}
                  {shareMenuView === "initial" && (
                    <>
                      {/* Avatar/Name Row */}
                      <div className="flex items-end gap-3 mb-4">
                        {/* Avatar and Color Picker Container */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium cursor-pointer shadow-md ring-1 ring-stone-500/50"
                            style={{ backgroundColor: userColor }}
                            onClick={() =>
                              setIsColorPickerOpen(!isColorPickerOpen)
                            }
                          >
                            <span className="text-white/90">
                              {userName ? userName[0].toUpperCase() : ""}
                            </span>
                          </div>

                          {/* Color Picker Popover */}
                          <AnimatePresence>
                            {isColorPickerOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                                transition={{ duration: 0.1 }}
                                // Positioned relative to the parent div, below the avatar
                                className="absolute left-0 top-full mt-2 bg-neutral-900/90 backdrop-blur-sm p-2.5 border border-stone-700 shadow-lg z-10 w-[120px]"
                              >
                                <div className="flex flex-wrap gap-1.5">
                                  {COLORS.map((color) => (
                                    <div
                                      key={color}
                                      className={`w-5 h-5 rounded-full cursor-pointer ${
                                        userColor === color
                                          ? "ring-2 ring-white/60"
                                          : ""
                                      }`}
                                      style={{ backgroundColor: color }}
                                      onClick={() => handleColorSelect(color)}
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Name Input Container */}
                        <div className="flex-1">
                          <label className="block text-xs text-stone-400 mb-1">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={userName}
                            onChange={handleNameChange}
                            placeholder="Enter your name"
                            className="w-full bg-neutral-800 border border-stone-600 text-stone-200 placeholder-stone-500 px-2 py-1 text-sm focus:outline-none focus:border-stone-500 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Start Session Button */}
                      <button
                        onClick={handleStartSession}
                        disabled={!userName.trim()}
                        className="w-full px-3 py-1.5 text-sm font-medium bg-stone-600 hover:bg-stone-500 text-stone-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" // Removed rounded-md
                      >
                        Start Session
                      </button>
                    </>
                  )}

                  {shareMenuView === "link" && generatedShareLink && (
                    <div className="flex flex-col">
                      {/* <h2 className="text-lg font-medium text-center">Share Your Session</h2> */}
                      <p className="text-sm text-stone-400 text-left mb-1">
                        Share this link:
                      </p>
                      <div className="flex items-stretch gap-2 bg-neutral-900 border border-stone-700">
                        <input
                          type="text"
                          readOnly
                          value={generatedShareLink}
                          className="flex-1 bg-transparent text-stone-300 text-sm outline-none select-all px-2 py-1.5"
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          onClick={handleCopyShareLink}
                          className="px-2 flex items-center justify-center text-stone-400 hover:text-stone-100 bg-stone-700 hover:bg-stone-600 transition-colors flex-shrink-0"
                          aria-label="Copy link"
                        >
                          <FiCopy size={16} />
                        </button>
                      </div>
                      <button
                        onClick={toggleShareMenu}
                        className="mt-4 w-full px-3 py-1.5 text-sm font-medium bg-stone-600 hover:bg-stone-500 text-stone-100 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Original User Avatar - REMOVED */}
          {/* <div className="w-8 h-8 bg-red-400 rounded-full flex items-center justify-center">
            <span className="text-stone-200">M</span>
          </div> */}
          {/* Help Button */}
          <button className="h-full flex items-center justify-center w-10 rounded-none hover:bg-neutral-900 active:bg-stone-950 text-stone-500 hover:text-stone-400">
            {" "}
            {/* Adjusted padding/width */}
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

          {/* File Tree / Join Panel Area */}
          <div
            className={`bg-stone-800 bg-opacity-60 overflow-hidden flex flex-col h-full border-r border-stone-600 flex-shrink-0 ${
              // Show if explorer *should* be visible (width > 0)
              explorerWidth > 0 ? "visible" : "invisible w-0" // Ensure it truly collapses if width is 0
            }`}
            style={{ width: `${explorerWidth}px` }}
          >
            {/* --- Add Log --- */}
            {(() => {
              console.log(
                `[Sidebar Render] joinState: ${joinState}, explorerWidth: ${explorerWidth}, activeIcon: ${activeIcon}`
              );
              return null; // Return null to satisfy React
            })()}
            {/* --- End Log --- */}
            {joinState === "prompting" ? (
              // Render Join Panel if prompting
              <JoinSessionPanel
                userName={userName}
                userColor={userColor}
                isColorPickerOpen={isColorPickerOpen}
                colors={COLORS}
                onNameChange={handleNameChange}
                onColorSelect={handleColorSelect}
                onToggleColorPicker={handleToggleColorPicker} // Pass the toggle handler
                onConfirmJoin={handleConfirmJoin}
              />
            ) : (
              // Otherwise, render the normal File Tree (only if files icon active)
              activeIcon === "files" && (
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
              )
              // TODO: Add rendering for other activeIcon states (Search, Share, Chat) here if needed
            )}
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
                  // Pass the specific file content OR a loading state if OT is initializing
                  code={fileContents[activeFileId] ?? "// Loading..."}
                  // Let OT manage changes, don't pass handleCodeChange directly if OT active
                  onCodeChange={() => {}} // Add dummy function to satisfy prop type
                  // Pass the mount handler
                  onEditorDidMount={handleEditorDidMount}
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
