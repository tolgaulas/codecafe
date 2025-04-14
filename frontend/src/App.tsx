import React from "react"; // Add this import
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import TerminalComponent from "./components/TerminalComponent";
import { FaRegFolder, FaGlobe } from "react-icons/fa";
import { VscAccount, VscLiveShare, VscSearch } from "react-icons/vsc";
import { VscFiles } from "react-icons/vsc";
import { VscSettingsGear } from "react-icons/vsc";
import { GrChatOption, GrShareOption } from "react-icons/gr";
import { VscFile } from "react-icons/vsc";
import { FiCopy } from "react-icons/fi";
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
  offsetToPosition,
} from "./TextOperationSystem";
import JoinSessionPanel from "./components/JoinSessionPanel"; // Import the new component
import { UserInfo, RemoteUser } from "./types/props"; // Ensure RemoteUser is imported
import StatusBar from "./components/StatusBar"; // Add this import
import {
  CodeExecutionRequest,
  CodeExecutionResponse,
  TerminalRef,
  ExecutableLanguageKey,
  EditorLanguageKey,
  JoinStateType,
  OpenFile,
} from "./types/editor"; // Import new types

// --- New Imports ---
import {
  editorLanguageMap, // Kept for editor component
  languageIconMap,
  languageColorMap,
  defaultIconColor,
} from "./constants/mappings";
import {
  ICON_BAR_WIDTH,
  DEFAULT_EXPLORER_WIDTH,
  MIN_EXPLORER_WIDTH,
  MAX_EXPLORER_WIDTH,
  EXPLORER_HANDLE_WIDTH,
  MIN_JOIN_PANEL_WIDTH,
  DEFAULT_TERMINAL_HEIGHT_FRACTION,
  MIN_TERMINAL_HEIGHT_PX,
  MAX_TERMINAL_HEIGHT_PX,
  TERMINAL_COLLAPSE_THRESHOLD_PX,
  TERMINAL_HANDLE_HEIGHT,
  DEFAULT_WEBVIEW_WIDTH_FRACTION,
  MIN_WEBVIEW_WIDTH,
  MAX_WEBVIEW_WIDTH,
  WEBVIEW_HANDLE_GRAB_WIDTH,
} from "./constants/layout";
import { MOCK_FILES } from "./constants/mockFiles";
import { isExecutableLanguage } from "./utils/languageUtils";
import { SortableTab } from "./components/SortableTab"; // Import the moved component
import { useResizablePanel } from "./hooks/useResizablePanel"; // Import the hook

const App = () => {
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

  // Tab / File Management State
  // Set initial open files based on MOCK_FILES keys
  const initialOpenFileIds = Object.keys(MOCK_FILES);
  const initialOpenFilesData = initialOpenFileIds.map((id) => ({
    id: id,
    name: MOCK_FILES[id].name,
    language: MOCK_FILES[id].language,
  }));
  const [openFiles, setOpenFiles] = useState<OpenFile[]>(initialOpenFilesData); // Start with mock files open
  const [activeFileId, setActiveFileId] = useState<string | null>(
    initialOpenFileIds.length > 0 ? initialOpenFileIds[0] : null
  ); // Start with the first mock file active

  const [fileContents, setFileContents] = useState<{ [id: string]: string }>(
    () => {
      // Initialize with all mock file contents
      const initialContents: { [id: string]: string } = {};
      Object.keys(MOCK_FILES).forEach((id) => {
        initialContents[id] = MOCK_FILES[id].content;
      });
      return initialContents;
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

  // Add state for WebSocket connection status
  const [isConnected, setIsConnected] = useState(false);

  // Add new state for join process
  const [joinState, setJoinState] = useState<JoinStateType>("idle");

  // Remote Users State
  const [remoteUsers, setRemoteUsers] = useState<{
    [docId: string]: RemoteUser[]; // Use imported RemoteUser type
  }>({});

  // --- Instantiate useResizablePanel for Explorer --- START ---
  const explorerPanelRef = useRef<HTMLDivElement>(null); // Add ref for the panel itself
  const {
    size: rawExplorerPanelSize, // Get the raw size from hook
    isResizing: isExplorerPanelResizing,
    handleMouseDown: handleExplorerPanelMouseDown,
    togglePanel: toggleExplorerPanel,
    isCollapsed: isExplorerCollapsed,
    setSize: setRawExplorerPanelSize, // Setter for raw size
  } = useResizablePanel({
    initialSize: DEFAULT_EXPLORER_WIDTH,
    minSize: MIN_EXPLORER_WIDTH,
    maxSize: MAX_EXPLORER_WIDTH,
    direction: "horizontal-left", // Use specific direction
    containerRef: sidebarContainerRef,
    panelRef: explorerPanelRef, // Pass the panel ref
    storageKey: "explorerWidth",
    onToggle: (isOpen) => {
      setActiveIcon(isOpen ? "files" : null);
    },
    defaultOpenSize: DEFAULT_EXPLORER_WIDTH, // Add default open size
  });
  // Adjust size for ICON_BAR_WIDTH offset
  const explorerPanelSize = Math.max(0, rawExplorerPanelSize - ICON_BAR_WIDTH);
  // Setter function that accounts for the offset
  const setExplorerPanelSize = (newSize: number) => {
    setRawExplorerPanelSize(newSize + ICON_BAR_WIDTH);
  };
  // --- Instantiate useResizablePanel for Explorer --- END ---

  // --- Instantiate useResizablePanel for Terminal --- START ---
  const initialMaxTerminalHeight = window.innerHeight * 0.8;
  const {
    size: terminalPanelHeight,
    isResizing: isTerminalPanelResizing,
    handleMouseDown: handleTerminalPanelMouseDown,
    togglePanel: toggleTerminalPanel,
    isCollapsed: isTerminalCollapsed,
    setSize: setTerminalPanelHeight,
  } = useResizablePanel({
    initialSize: () => window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION,
    minSize: MIN_TERMINAL_HEIGHT_PX,
    maxSize: initialMaxTerminalHeight,
    direction: "vertical",
    containerRef: editorTerminalAreaRef,
    storageKey: "terminalHeight",
    collapseThreshold: TERMINAL_COLLAPSE_THRESHOLD_PX,
    defaultOpenSize: () =>
      window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION, // Correctly placed prop
    onResizeEnd: () => {
      terminalRef.current?.fit();
    },
    onToggle: () => {
      requestAnimationFrame(() => terminalRef.current?.fit());
    },
  });
  // --- Instantiate useResizablePanel for Terminal --- END ---

  // --- Instantiate useResizablePanel for WebView --- START ---
  // Calculate initial max width outside hook call
  const initialMaxWebViewWidth = window.innerWidth * 0.8;
  const webViewPanelRef = useRef<HTMLDivElement>(null); // Add ref for webview panel
  const {
    size: webViewPanelWidth,
    isResizing: isWebViewPanelResizing,
    handleMouseDown: handleWebViewPanelMouseDown,
    togglePanel: toggleWebViewPanel,
    isCollapsed: isWebViewCollapsed,
    setSize: setWebViewPanelWidth,
  } = useResizablePanel({
    initialSize: 0,
    minSize: MIN_WEBVIEW_WIDTH,
    maxSize: initialMaxWebViewWidth,
    direction: "horizontal-right", // Use specific direction
    containerRef: mainContentRef,
    panelRef: webViewPanelRef, // Pass ref
    storageKey: "webViewWidth",
    // Provide a default size for when toggled open from collapsed state
    defaultOpenSize: () =>
      (mainContentRef.current?.offsetWidth ?? window.innerWidth * 0.85) *
      DEFAULT_WEBVIEW_WIDTH_FRACTION,
  });
  // --- Instantiate useResizablePanel for WebView --- END ---

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

  // Global Pointer Up Handler (Update)
  const handleGlobalPointerUp = useCallback(
    (e: PointerEvent) => {
      // Check WebView hook state
      if (isWebViewPanelResizing) {
        // Hook's effect handles mouseup
      }
      if (isTerminalPanelResizing) {
        // Hook's effect handles mouseup
      }
    },
    [
      isTerminalPanelResizing,
      isWebViewPanelResizing, // Add webview hook state
      // REMOVE handleWebViewResizeMouseUp,
    ]
  );

  // UI Interaction Handlers
  const handleIconClick = (iconName: string | null) => {
    if (joinState === "prompting") {
      console.log("Ignoring icon click while prompting for join details.");
      return;
    }

    if (iconName === "files") {
      // Use the hook's toggle function
      toggleExplorerPanel();
    } else {
      // If switching to another icon, ensure explorer is closed
      if (!isExplorerCollapsed) {
        toggleExplorerPanel(); // Close it if open
      }
      // Set the new active icon
      setActiveIcon(iconName);
    }
  };

  // File Handling
  const handleOpenFile = (fileId: string) => {
    if (!MOCK_FILES[fileId]) return;
    const fileData = MOCK_FILES[fileId];

    // If the file isn't already open, add it to the list and potentially set initial content.
    if (!openFiles.some((f) => f.id === fileId)) {
      const newOpenFile: OpenFile = {
        id: fileId,
        name: fileData.name,
        language: fileData.language,
      };
      setOpenFiles((prev) => [...prev, newOpenFile]);

      // Set initial content ONLY if NOT in an active session.
      // If in a session, let the WebSocket fetch the current state.
      if (!isSessionActive) {
        setFileContents((prev) => ({
          ...prev,
          // Only add content if it doesn't already exist (e.g., from a previous non-session state)
          [fileId]: prev[fileId] ?? fileData.content,
        }));
      } else {
        // Optional: You could set it to undefined or keep the existing value if any.
        // Setting it ensures the key exists, but content will come from WS.
        setFileContents((prev) => ({
          ...prev,
          [fileId]: prev[fileId], // Keep existing content or undefined
        }));
      }
    }
    // If the file is already open, just switch to it.
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
  };

  const handleCodeChange = (newCode: string) => {
    if (activeFileId) {
      setFileContents((prev) => ({ ...prev, [activeFileId]: newCode }));
    }
  };

  // View Menu / WebView Handlers
  const toggleWebView = () => {
    // Option 1: Keep separate visibility state (current implementation)
    // setIsWebViewVisible(prev => !prev);
    // toggleWebViewPanel();
    // setIsViewMenuOpen(false);

    // Option 2: Rely solely on hook's collapsed state
    toggleWebViewPanel(); // Hook now handles opening to default size
    setIsViewMenuOpen(false);
    // Also toggle the separate visibility state if we keep it
    setIsWebViewVisible(isWebViewCollapsed); // Becomes visible if currently collapsed
  };

  // --- Update toggleTerminalVisibility --- START ---
  const toggleTerminalVisibility = () => {
    toggleTerminalPanel(); // Use the hook's toggle function
    setIsViewMenuOpen(false); // Close menu remains
  };
  // --- Update toggleTerminalVisibility --- END ---

  // Share Menu Handlers <-- Add Share Menu Handlers
  const toggleShareMenu = () => {
    setIsShareMenuOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen) {
        // If opening, decide view based on session state
        if (isSessionActive && generatedShareLink) {
          setShareMenuView("link");
        } else {
          setShareMenuView("initial");
        }
        setIsColorPickerOpen(false); // Always close picker when opening menu
      } else {
        // If closing, just close the color picker
        setIsColorPickerOpen(false);
      }
      // Removed logic that reset shareMenuView and generatedShareLink on close
      return nextOpen;
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
          // CORRECTED: Read from prevContents
          const contentThatWasSent = prevContents[fileId];
          if (contentThatWasSent !== undefined) {
            // CORRECTED: Assign the value read from prevContents
            newContents[fileId] = contentThatWasSent;
          } else {
            // Optional: Handle case where key file content wasn't in prevContents?
            console.warn(
              `[handleStartSession] Content for key file ${fileId} missing in previous state during update.`
            );
          }
        });
        console.log(
          "[handleStartSession] Correctly updating local fileContents state post-init:",
          newContents
        );
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
      // const url = new URL(window.location.href); // <-- Removed
      // url.searchParams.set("session", newSessionId); // <-- Removed
      // window.history.pushState({}, "", url.toString()); // <-- Removed
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
        setIsConnected(false); // Set connected state to false
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
        setIsConnected(true); // Set connected state to true

        // <<< Send explicit join message >>>
        const joinPayload = {
          sessionId: sessionId, // Assuming sessionId is available here
          documentId: currentActiveFileId, // Send initial document focus
          userId: userId,
          userName: userName.trim(),
          userColor: userColor,
        };
        console.log("Sending explicit /app/join message", joinPayload); // Use console.log
        stompClient.send("/app/join", {}, JSON.stringify(joinPayload));
        // <<< End send join message >>>

        // Define callbacks WITH documentId included
        const clientCallbacks: IClientCallbacks = {
          sendOperation: (revision: number, operation: TextOperation) => {
            if (
              stompClientRef.current?.connected &&
              currentActiveFileId &&
              sessionId
            ) {
              // Check sessionId existence
              console.log(
                `[sendOperation Callback] Preparing to send Op for ${currentActiveFileId} (Session: ${sessionId}) @ rev ${revision}` // Include sessionId in log
              );
              const payload = {
                documentId: currentActiveFileId,
                clientId: userId,
                revision: revision,
                operation: operation.toJSON(),
                sessionId: sessionId, // Add sessionId to payload
              };
              console.log(`[Client -> Server Op] /app/operation`, payload);
              stompClientRef.current.send(
                "/app/operation",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.error(
                "Cannot send operation - STOMP not connected, no active file, or no session ID"
              );
            }
          },
          sendSelection: (selection: OTSelection | null) => {
            // Ensure user info (name, color) is included here too
            if (
              stompClientRef.current?.connected &&
              currentActiveFileId &&
              sessionId &&
              userName.trim()
            ) {
              // --- Add Log ---
              console.log(
                "[DEBUG] Attempting to send selection via clientCallbacks.sendSelection"
              );

              // Extract cursor position from selection if available
              let cursorPosition = null;
              if (
                selection &&
                selection.ranges &&
                selection.ranges.length > 0
              ) {
                const primaryRange = selection.ranges[0];
                // Get the editor model to convert selection offset to position
                if (currentEditorInstance) {
                  const model = currentEditorInstance.getModel();
                  if (model) {
                    try {
                      // Use the head position of the selection as the cursor position
                      // (where the cursor would be visually located in a selection)
                      const headPos = offsetToPosition(
                        model,
                        primaryRange.head
                      );
                      cursorPosition = {
                        lineNumber: headPos.lineNumber,
                        column: headPos.column,
                      };
                      console.log(
                        "[DEBUG] Inferred cursor position from selection:",
                        cursorPosition
                      );
                    } catch (error) {
                      console.error(
                        "[DEBUG] Failed to infer cursor position from selection:",
                        error
                      );
                    }
                  }
                }
              }

              const payload = {
                documentId: currentActiveFileId,
                sessionId: sessionId, // Include sessionId
                userInfo: {
                  id: userId,
                  name: userName.trim(), // <<< Include name >>>
                  color: userColor, // <<< Include color >>>
                  cursorPosition: cursorPosition, // Use inferred cursor position instead of null
                  selection: selection?.toJSON() ?? null,
                },
              };
              console.log(
                `[OT Client -> Server Sel] /app/selection (via clientCallbacks)`,
                payload
              );
              stompClientRef.current.send(
                "/app/selection",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.warn(
                "Cannot send selection via OT Client - STOMP not connected, no active file, no session ID, or no user name"
              );
            }
          },
          applyOperation: (operation: TextOperation) => {
            console.log(`[Client -> Editor Apply] Op: ${operation.toString()}`);
            adapterRef.current?.applyOperation(operation); // Apply op to the Monaco editor instance
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
        const stateTopic = `/topic/sessions/${sessionId}/state/document/${currentActiveFileId}`;
        console.log(
          `[STOMP Setup] Subscribing to Document State topic: ${stateTopic}`
        );
        subscriptions.push(
          stompClient.subscribe(stateTopic, (message: any) => {
            // Use the dynamic topic
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

              // <<< Process participants every time state is received for the active file >>>
              if (state.participants && Array.isArray(state.participants)) {
                const initialRemoteUsers = state.participants
                  .map((p: any) => {
                    // Sanity check participant structure
                    if (!p || typeof p.id !== "string") {
                      console.warn(
                        "Received invalid participant structure in state message:",
                        p
                      );
                      return null; // Skip invalid participant
                    }
                    const frontendSelection = p.selection
                      ? OTSelection.fromJSON(p.selection)
                      : null;
                    return {
                      id: p.id,
                      name: p.name || `User ${p.id.substring(0, 4)}`,
                      color: p.color || "#CCCCCC",
                      cursorPosition: p.cursorPosition || null,
                      selection: frontendSelection,
                    };
                  })
                  .filter(
                    (user: RemoteUser | null): user is RemoteUser =>
                      user !== null
                  );

                setRemoteUsers((prev) => ({
                  ...prev,
                  [state.documentId]: initialRemoteUsers, // Update state for the specific document ID from the message
                }));
                console.log(
                  `   Processed participants for ${state.documentId}. Count: ${initialRemoteUsers.length}`
                );
              } else {
                // Ensure empty list if participants are null/undefined in state message
                setRemoteUsers((prev) => ({
                  ...prev,
                  [state.documentId]: [],
                }));
                console.log(
                  `   No participants found in state message for ${state.documentId}.`
                );
              }
              // <<< End processing participants >>>

              // Initialize OT Client only if it doesn't exist
              if (!clientRef.current) {
                console.log(
                  `   Initializing Client for ${state.documentId} @ rev ${state.revision}`
                );
                clientRef.current = new Client(
                  state.revision,
                  userId,
                  clientCallbacks
                );

                // <<< Remove initial participant processing from here >>>

                // Set initial document content (only needed during client init)
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
                // <<< End initial participant processing >>>

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
                    clientRef.current?.applyClient(op); // Send op to server state machine

                    // *** ADDED: Apply local op directly to fileContents for WebView updates ***
                    setFileContents((prevContents) => {
                      const currentContent =
                        prevContents[currentActiveFileId] ?? "";
                      try {
                        const newContent = op.apply(currentContent);
                        // Avoid unnecessary state updates if content didn't change (e.g., empty op)
                        if (newContent === currentContent) {
                          return prevContents;
                        }
                        console.log(
                          `[Adapter Callback] Updating fileContents for ${currentActiveFileId} due to local change.`
                        );
                        return {
                          ...prevContents,
                          [currentActiveFileId]: newContent,
                        };
                      } catch (applyError) {
                        console.error(
                          `[Adapter Callback] Error applying local op to fileContents for ${currentActiveFileId}:`,
                          applyError,
                          "Op:",
                          op.toString(),
                          "Content:",
                          currentContent
                        );
                        return prevContents; // Return previous state on error
                      }
                    });
                    // **************************************************************************
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

        // Operations Handling (Subscribe to SESSION and DOCUMENT specific topic)
        const operationsTopic = `/topic/sessions/${sessionId}/operations/document/${currentActiveFileId}`;
        console.log(
          `[STOMP Setup] Subscribing to Operations topic: ${operationsTopic}`
        );
        subscriptions.push(
          stompClient.subscribe(operationsTopic, (message: any) => {
            // Use the dynamic topic
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

              // *** No need to check documentId again here, as we subscribed specifically ***
              // *** Apply to ACTIVE file EDITOR via OT Client ***
              if (clientRef.current) {
                try {
                  const operationForClient = TextOperation.fromJSON(
                    payload.operation
                  );
                  clientRef.current.applyServer(operationForClient);
                } catch (e) {
                  console.error(
                    `[Server -> Client Op] Error applying server op to ACTIVE file EDITOR ${currentActiveFileId}:`,
                    e,
                    payload.operation
                  );
                }
              } else {
                console.warn(
                  `[Server -> Client Op] Received op for ACTIVE file ${payload.documentId} before client init.`
                );
              }

              // *** Apply to fileContents state for WebView update ***
              // We still need the documentId from the payload here to update the correct key in the state
              // try {
              //   const operationForState = TextOperation.fromJSON(
              //     payload.operation
              //   );
              //   setFileContents((prevContents) => {
              //     const docIdToUpdate = payload.documentId;
              //     // Double-check if docIdToUpdate actually matches currentActiveFileId?
              //     // Might be overly cautious, but ensures state update aligns with subscription.
              //     if (docIdToUpdate !== currentActiveFileId) {
              //       console.warn(
              //         `[Server -> Client Op] Received op for doc ${docIdToUpdate} on topic for ${currentActiveFileId}. Ignoring for fileContents update.`
              //       );
              //       return prevContents;
              //     }
              //     const currentContent = prevContents[docIdToUpdate] ?? ""; // Get content for the specific doc
              //     const newContent = operationForState.apply(currentContent);

              //     // Avoid unnecessary state updates if content didn't change
              //     if (newContent === currentContent) {
              //       return prevContents;
              //     }

              //     console.log(
              //       `[Server -> Client Op] Updating fileContents for ${docIdToUpdate} (WebView).`
              //     );
              //     return {
              //       ...prevContents,
              //       [docIdToUpdate]: newContent, // Update the specific document's content
              //     };
              //   });
              // } catch (e) {
              //   console.error(
              //     `[Server -> Client Op] Error applying server op to fileContents STATE for ${payload.documentId}:`,
              //     e,
              //     payload.operation
              //   );
              // }
              // ************************************************************

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

        // Selections Handling (Subscribe to SESSION and DOCUMENT specific topic)
        const selectionTopic = `/topic/sessions/${sessionId}/selections/document/${currentActiveFileId}`; // Use the dynamic topic
        console.log(
          `[CodeEditorUI WS Setup] Subscribing to Selections topic: ${selectionTopic}...`
        );
        subscriptions.push(
          stompClient.subscribe(selectionTopic, (message: any) => {
            // Use the dynamic topic
            try {
              const payload = JSON.parse(message.body);
              // Expecting payload: { documentId: string, userInfo: UserInfo }
              if (
                !payload ||
                !payload.userInfo ||
                !payload.userInfo.id ||
                !payload.documentId
              ) {
                console.error(
                  "[Server -> Client Sel] Invalid payload structure:",
                  payload
                );
                return;
              }

              const { documentId, userInfo } = payload;
              const remoteUserId = userInfo.id;

              // Enhanced debugging for cursor positions and selections
              console.log(
                `[DEBUG] Received selection message. Comparing remoteUserId (${remoteUserId}) with local userId (${userId})`
              );
              console.log(
                `[DEBUG] Full userInfo received:`,
                JSON.stringify(userInfo, null, 2)
              );
              console.log(
                `[DEBUG] User ${remoteUserId} cursorPosition:`,
                userInfo.cursorPosition
              );
              console.log(
                `[DEBUG] User ${remoteUserId} selection:`,
                userInfo.selection
              );

              // Ignore own selection broadcasts
              if (remoteUserId === userId) {
                console.log(
                  `[DEBUG] IDs match. Ignoring own selection broadcast.`
                ); // Log ignore
                return; // Ignore own selection broadcasts
              }
              // Log if the filter passes
              console.log(
                `[DEBUG] IDs do NOT match. Proceeding to update remoteUsers state.`
              );

              // Update the remoteUsers state
              setRemoteUsers((prevRemoteUsers) => {
                // Use variables from the outer scope (documentId, userInfo, remoteUserId)
                // instead of trying to access payload directly here.

                // Create a deep copy to modify safely
                const nextRemoteUsers = JSON.parse(
                  JSON.stringify(prevRemoteUsers)
                ) as typeof prevRemoteUsers;

                // Ensure the array for the current document exists
                if (!nextRemoteUsers[documentId]) {
                  // Use documentId from outer scope
                  nextRemoteUsers[documentId] = [];
                }
                const usersForDoc = nextRemoteUsers[documentId]; // Get the array reference

                const existingUserIndex = usersForDoc.findIndex(
                  (u: RemoteUser) => u.id === remoteUserId // Use remoteUserId from outer scope
                );

                // Use OTSelection.fromJSON here as backend sends the JSON representation
                // Use userInfo from the outer scope
                const selectionFromPayload = userInfo.selection
                  ? OTSelection.fromJSON(userInfo.selection)
                  : null;

                const updatedUserInfo: RemoteUser = {
                  id: remoteUserId, // Use remoteUserId from outer scope
                  name: userInfo.name || `User ${remoteUserId.substring(0, 4)}`, // Use userInfo & remoteUserId
                  color: userInfo.color || "#CCCCCC", // Use userInfo
                  cursorPosition: userInfo.cursorPosition, // Use userInfo
                  selection: selectionFromPayload, // Store the OTSelection object
                };

                // Update or add the user in the current document's list
                if (existingUserIndex > -1) {
                  usersForDoc[existingUserIndex] = updatedUserInfo;
                } else {
                  usersForDoc.push(updatedUserInfo);
                }
                // No need to reassign nextRemoteUsers[documentId] = usersForDoc; as usersForDoc is a reference

                // --- Clear selection for this user in OTHER documents ---
                Object.keys(nextRemoteUsers).forEach((otherDocId) => {
                  if (otherDocId !== documentId) {
                    const usersInOtherDoc = nextRemoteUsers[otherDocId];
                    if (usersInOtherDoc) {
                      // Check if the document exists in state
                      const userIndexInOtherDoc = usersInOtherDoc.findIndex(
                        (u: RemoteUser) => u.id === remoteUserId // Use remoteUserId from outer scope
                      );
                      if (userIndexInOtherDoc > -1) {
                        // Clear selection and cursor, keep other info
                        usersInOtherDoc[userIndexInOtherDoc] = {
                          ...usersInOtherDoc[userIndexInOtherDoc],
                          selection: null,
                          cursorPosition: null,
                        };
                      }
                    }
                  }
                });
                // ------------------------------------------------------

                console.log(
                  `[CodeEditorUI] Updated remoteUsers state:`,
                  nextRemoteUsers
                );

                // Avoid unnecessary re-renders if state didn't actually change
                if (
                  JSON.stringify(prevRemoteUsers) ===
                  JSON.stringify(nextRemoteUsers)
                ) {
                  return prevRemoteUsers;
                }

                return nextRemoteUsers; // Ensure the modified state is returned
              });
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
          `[Client -> Server ReqState] Requesting state for session ${sessionId}, doc ${currentActiveFileId}...` // Update log
        );
        stompClient.send(
          // Corrected back to send
          "/app/get-document-state",
          {},
          JSON.stringify({
            documentId: currentActiveFileId,
            sessionId: sessionId, // Add sessionId
          })
        );
      },
      (error: any) => {
        console.error(
          `[STOMP Error] Connection Failed for ${currentActiveFileId}:`,
          error
        );
        setIsConnected(false); // Set connected state to false on error
        // Optionally set code state to show error
        // setFileContents(prev => ({...prev, [currentActiveFileId]: "// Connection failed."})) ;
        setIsSessionActive(false); // Consider if this should affect the whole session
        // Reset OT state on connection error
        clientRef.current = null;
        adapterRef.current?.detach();
        adapterRef.current = null;
        setIsConnected(false); // Ensure connected is false on cleanup
        console.log(
          `[WS Cleanup] Finished cleanup for ${currentActiveFileId}.`
        );
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
        // Use stompClientRef here
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
      setIsConnected(false); // Ensure connected is false on cleanup
      console.log(`[WS Cleanup] Finished cleanup for ${currentActiveFileId}.`);
    };
    // Depend only on session, active file, and editor readiness
  }, [isSessionActive, sessionId, activeFileId, userId, isEditorReadyForOT]);

  // Effect to send initial presence when connection is ready and user info is available
  useEffect(() => {
    if (
      isConnected &&
      userName.trim() &&
      activeFileId &&
      stompClientRef.current?.connected
    ) {
      // Introduce a small delay to allow state propagation
      const timer = setTimeout(() => {
        if (stompClientRef.current?.connected) {
          // Re-check connection inside timeout
          // --- Add Log ---
          console.log(
            "[DEBUG] Attempting to send selection via Presence Effect useEffect"
          );
          console.log(
            `[Presence Effect] Sending initial presence for ${userId} in ${activeFileId}. Connected: ${isConnected}`
          );
          const initialPresencePayload = {
            documentId: activeFileId,
            userInfo: {
              id: userId,
              name: userName.trim(),
              color: userColor,
              cursorPosition: null,
              selection: null,
            },
          };
          stompClientRef.current.send(
            "/app/selection",
            {},
            JSON.stringify(initialPresencePayload)
          );
        } else {
          console.log(
            "[Presence Effect] Connection lost before sending presence message in timeout."
          );
        }
      }, 100); // 100ms delay

      // Cleanup the timer if dependencies change before it fires
      return () => clearTimeout(timer);
    } else {
      // Optional: Log why it didn't send
      // console.log(`[Presence Effect] Conditions not met. isConnected: ${isConnected}, UserName: ${!!userName.trim()}, ActiveFileId: ${!!activeFileId}, StompConnected: ${!!stompClientRef.current?.connected}`);
    }
    // This effect should run whenever connection status or user details change.
  }, [isConnected, userName, userColor, activeFileId, userId]);

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

  // Get remote users for the currently active file (Moved inside component)
  const currentRemoteUsers = useMemo(() => {
    return activeFileId ? remoteUsers[activeFileId] || [] : [];
  }, [remoteUsers, activeFileId]);

  // Derive a unique list of all remote participants in the session (excluding self)
  const uniqueRemoteParticipants = useMemo(() => {
    const allUsers = Object.values(remoteUsers).flat();
    const uniqueUsersMap = new Map<string, RemoteUser>();
    allUsers.forEach((user) => {
      if (user.id !== userId) {
        // Exclude the current user
        // Only add if the user has a valid name and color (implicitly handled by update logic)
        uniqueUsersMap.set(user.id, user);
      }
    });
    return Array.from(uniqueUsersMap.values());
  }, [remoteUsers, userId]);

  // 4. EFFECTS FOURTH

  // --- Update Explorer Resizing Effect Dependencies --- START ---
  // useEffect(() => {
  // ... (Explorer effect code, now removed, but update deps in other effects)
  // }, [isExplorerPanelResizing, isTerminalPanelResizing, isWebViewResizing]); // Add TERMINAL hook state
  // --- Update Explorer Resizing Effect Dependencies --- END ---

  // Global Pointer Up Effect (No change needed here, uses handleGlobalPointerUp)
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
        // Only close the menu and color picker, don't reset the view state
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
        `[Join Effect] Conditions met. sessionId: ${sessionIdFromUrl}, isSessionActive: ${isSessionActive}, joinState: ${joinState}, explorerWidth: ${explorerPanelSize}`
      );
      setSessionId(sessionIdFromUrl);
      setIsSessionCreator(false); // Joining user is not the creator
      setJoinState("prompting"); // Set state to show prompt panel

      // Ensure sidebar is visible for the prompt and meets minimum width
      let targetWidth = DEFAULT_EXPLORER_WIDTH; // Start with default
      if (explorerPanelSize > 0) {
        // If already open, consider its current width
        targetWidth = Math.max(targetWidth, explorerPanelSize);
      } else if (explorerPanelSize > MIN_EXPLORER_WIDTH / 2) {
        // If closed, consider the last known width (if valid)
        targetWidth = Math.max(targetWidth, explorerPanelSize);
      }
      // Ensure it's at least the minimum required for the join panel
      targetWidth = Math.max(targetWidth, MIN_JOIN_PANEL_WIDTH);

      // Apply the calculated target width
      setExplorerPanelSize(targetWidth);

      // Clean the URL
      const updatedUrl = new URL(window.location.href); // Renamed from cleanUrl
      updatedUrl.searchParams.delete("session");
      window.history.replaceState({}, "", updatedUrl.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, joinState, setExplorerPanelSize]); // Add setExplorerPanelSize to dependencies

  // NEW Handler for sending selection data via STOMP
  const handleSendSelectionData = useCallback(
    (data: {
      cursorPosition: { lineNumber: number; column: number } | null;
      // Fix: Expect OTSelection, matching the prop type
      selection: OTSelection | null;
    }) => {
      console.log(
        "[CodeEditorUI handleSendSelectionData] Received data from CodeEditor:",
        data
      );

      if (
        stompClientRef.current?.connected &&
        activeFileId &&
        sessionId &&
        userName.trim()
      ) {
        const payload = {
          documentId: activeFileId,
          sessionId: sessionId, // Add sessionId
          userInfo: {
            id: userId,
            name: userName.trim(),
            color: userColor,
            cursorPosition: data.cursorPosition,
            // Fix: Convert received OTSelection to JSON for the backend DTO
            selection: data.selection ? data.selection.toJSON() : null,
          },
        };

        console.log(
          "[CodeEditorUI handleSendSelectionData] Sending payload object:",
          payload
        );
        stompClientRef.current.send(
          "/app/selection",
          {},
          JSON.stringify(payload)
        );
      } else {
        // console.warn(...);
      }
    },
    // @ts-ignore <-- Suppress potentially incorrect linter errors about implicit 'any' for dependencies
    [activeFileId, sessionId, userId, userName, userColor] // Include dependencies
  );

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
                  toggleTerminalVisibility(); // Uses updated handler
                }}
                className="block w-full text-left px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-600"
              >
                {!isTerminalCollapsed ? "Close Terminal" : "Open Terminal"}
              </button>
            </div>
          )}
        </div>
        {/* Right side - Change px-2 to p-2 for all-around padding */}
        <div className="flex items-stretch mr-2">
          {" "}
          {/* Use items-stretch, added mr-2 for spacing */}
          {/* Participant Circles - NEW */}
          {isSessionActive && uniqueRemoteParticipants.length > 0 && (
            <div className="flex items-center px-2 -space-x-2">
              {uniqueRemoteParticipants.map((user) => (
                <div
                  key={user.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ring-1 ring-stone-900/50 cursor-default shadow-sm"
                  style={{ backgroundColor: user.color }}
                  title={user.name} // Tooltip with full name
                >
                  <span className="text-white/90 select-none">
                    {user.name ? user.name[0].toUpperCase() : "?"}
                  </span>
                </div>
              ))}
            </div>
          )}
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
          ref={sidebarContainerRef} // This ref is now used by the hook
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
              // Use hook state for visibility
              !isExplorerCollapsed ? "visible" : "invisible w-0"
            }`}
            style={{ width: `${explorerPanelSize}px` }} // Use hook size
          >
            {/* --- Add Log --- */}
            {(() => {
              console.log(
                `[Sidebar Render] joinState: ${joinState}, explorerWidth: ${explorerPanelSize}, activeIcon: ${activeIcon}` // Use hook size in log
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
                onConfirmJoin={() => {
                  handleConfirmJoin(); // Existing handler
                  // Ensure explorer is open after confirming join
                  if (isExplorerCollapsed) {
                    toggleExplorerPanel();
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
          {activeIcon === "files" && !isExplorerCollapsed && (
            <div
              className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
              style={{
                width: `${EXPLORER_HANDLE_WIDTH}px`,
                // Adjust position based on hook size and ICON_BAR_WIDTH
                left: `${
                  ICON_BAR_WIDTH + explorerPanelSize - EXPLORER_HANDLE_WIDTH / 2
                }px`,
                pointerEvents: "auto",
              }}
              onMouseDown={handleExplorerPanelMouseDown} // Use hook mouse down handler
            />
          )}
        </div>

        {/* Code and Terminal Area + Optional WebView */}
        <div className="flex flex-1 min-w-0 relative">
          {/* Code and Terminal Area */}
          <div
            ref={editorTerminalAreaRef} // This ref is used by the Terminal hook
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
                  code={fileContents[activeFileId] ?? "// Loading..."}
                  onCodeChange={handleCodeChange} // <<< USE handleCodeChange HERE
                  onEditorDidMount={handleEditorDidMount}
                  users={currentRemoteUsers} // Pass remote user data
                  // *** Add the missing prop here ***
                  sendSelectionData={handleSendSelectionData}
                  // *** Add the new prop here ***
                  localUserId={userId} // Pass the local userId
                />
              ) : (
                <div className="flex items-center justify-center h-full text-stone-500">
                  Select a file to start editing.
                </div>
              )}
            </div>

            {/* --- Update Terminal Resizer --- START --- */}
            <div
              className={`w-full bg-stone-700 flex-shrink-0 ${
                // Use hook state for cursor style
                isTerminalCollapsed
                  ? "cursor-pointer hover:bg-stone-500"
                  : "cursor-row-resize hover:bg-stone-600 active:bg-stone-500"
              }`}
              style={{ height: `${TERMINAL_HANDLE_HEIGHT}px` }}
              onMouseDown={handleTerminalPanelMouseDown} // Use hook mouse down handler
            />
            {/* --- Update Terminal Resizer --- END --- */}

            {/* --- Update Terminal Panel --- START --- */}
            <div
              className={`bg-neutral-900 bg-opacity-90 flex flex-col border-t border-stone-600 flex-shrink-0 ${
                // Use hook state for visibility
                isTerminalCollapsed ? "hidden" : "flex"
              }`}
              style={{ height: `${terminalPanelHeight}px` }} // Use hook height
            >
              <div className="flex bg-stone-800 py-1 text-sm flex-shrink-0">
                <div className="px-4 py-1 text-stone-400 text-xs">TERMINAL</div>
              </div>
              <div className="flex-1 px-4 pt-2 font-mono text-sm overflow-hidden min-h-0">
                {/* Pass hook height to TerminalComponent */}
                <TerminalComponent
                  ref={terminalRef}
                  height={terminalPanelHeight}
                />
              </div>
            </div>
            {/* --- Update Terminal Panel --- END --- */}
          </div>

          {/* Invisible WebView Resizer Handle (Positioned Absolutely) */}
          {isWebViewVisible && webViewPanelWidth > 0 && (
            <div
              className="absolute top-0 h-full cursor-col-resize bg-transparent z-20"
              style={{
                width: `${WEBVIEW_HANDLE_GRAB_WIDTH}px`,
                // Position it centered over the boundary
                left: `calc(100% - ${webViewPanelWidth}px - ${
                  WEBVIEW_HANDLE_GRAB_WIDTH / 2
                }px)`,
              }}
              onMouseDown={handleWebViewPanelMouseDown} // Use hook handler
            />
          )}

          {/* WebView Panel (border provides the 1px visual line) */}
          {isWebViewVisible && webViewPanelWidth > 0 && (
            <div
              className="flex-shrink-0 border-l border-stone-600 overflow-hidden" // Keep the border-l for visual
              style={{ width: `${webViewPanelWidth}px` }}
            >
              <WebViewPanel
                htmlContent={htmlFileContent}
                cssContent={cssFileContent}
                jsContent={jsFileContent}
                onClose={toggleWebView} // Pass the updated toggle function
              />
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* --- Update Resizing Overlay Check --- START --- */}
      {(isExplorerPanelResizing ||
        isTerminalPanelResizing ||
        isWebViewPanelResizing) && (
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
      {/* --- Update Resizing Overlay Check --- END --- */}
    </div>
  );
};

export default App;
