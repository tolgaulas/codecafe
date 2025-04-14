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
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
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
import { v4 as uuidv4 } from "uuid";
import { editor } from "monaco-editor";
import { TextOperation, OTSelection } from "./TextOperationSystem";
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
import { useCollaborationSession } from "./hooks/useCollaborationSession"; // <-- Import the new hook
import Header from "./components/Header"; // <-- Add import for Header

const App = () => {
  // 1. REFS FIRST
  const terminalRef = useRef<TerminalRef>();
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const editorTerminalAreaRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null); // <-- Add Ref for tab container
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null); // Keep ref for editor instance

  // 2. STATE SECOND
  const [activeIcon, setActiveIcon] = useState<string | null>("files");

  // Tab / File Management State
  const initialOpenFileIds = ["index.html", "style.css", "script.js"];
  const initialOpenFilesData = initialOpenFileIds.map((id) => {
    if (!MOCK_FILES[id]) {
      console.error(`Initial file ${id} not found in MOCK_FILES!`);
      return { id, name: "Error", language: "plaintext" as EditorLanguageKey };
    }
    return {
      id: id,
      name: MOCK_FILES[id].name,
      language: MOCK_FILES[id].language as EditorLanguageKey,
    };
  });
  const [openFiles, setOpenFiles] = useState<OpenFile[]>(initialOpenFilesData);
  const [activeFileId, setActiveFileId] = useState<string | null>("index.html");

  const [fileContents, setFileContents] = useState<{ [id: string]: string }>(
    () => {
      const initialContents: { [id: string]: string } = {};
      initialOpenFileIds.forEach((id) => {
        if (MOCK_FILES[id]) {
          initialContents[id] = MOCK_FILES[id].content;
        } else {
          initialContents[id] = `// Error: Content for ${id} not found`;
        }
      });
      return initialContents;
    }
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Add state for drop indicator
  const [dropIndicator, setDropIndicator] = useState<{
    tabId: string | null;
    side: "left" | "right" | null;
  }>({ tabId: null, side: null });

  // View Menu State
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isWebViewVisible, setIsWebViewVisible] = useState(false);

  // Share Menu State
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userColor, setUserColor] = useState(COLORS[0]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
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
  const [joinState, setJoinState] = useState<JoinStateType>("idle");

  // OT State / Collaboration State
  const [userId] = useState<string>(() => "user-" + uuidv4());

  // Remote Users State (Now managed per-file, updated by hook)
  const [remoteUsers, setRemoteUsers] = useState<{
    [docId: string]: RemoteUser[];
  }>({});

  // --- Instantiate Resizable Panels ---
  const explorerPanelRef = useRef<HTMLDivElement>(null);
  const {
    size: rawExplorerPanelSize,
    isResizing: isExplorerPanelResizing,
    handleMouseDown: handleExplorerPanelMouseDown,
    togglePanel: toggleExplorerPanel,
    isCollapsed: isExplorerCollapsed,
    setSize: setRawExplorerPanelSize,
  } = useResizablePanel({
    initialSize: DEFAULT_EXPLORER_WIDTH,
    minSize: MIN_EXPLORER_WIDTH,
    maxSize: MAX_EXPLORER_WIDTH,
    direction: "horizontal-left",
    containerRef: sidebarContainerRef,
    panelRef: explorerPanelRef,
    storageKey: "explorerWidth",
    onToggle: (isOpen) => {
      setActiveIcon(isOpen ? "files" : null);
    },
    defaultOpenSize: DEFAULT_EXPLORER_WIDTH,
  });
  const explorerPanelSize = Math.max(0, rawExplorerPanelSize - ICON_BAR_WIDTH);
  const setExplorerPanelSize = (newSize: number) => {
    setRawExplorerPanelSize(newSize + ICON_BAR_WIDTH);
  };

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
      window.innerHeight * DEFAULT_TERMINAL_HEIGHT_FRACTION,
    onResizeEnd: () => {
      terminalRef.current?.fit();
    },
    onToggle: () => {
      requestAnimationFrame(() => terminalRef.current?.fit());
    },
  });

  const initialMaxWebViewWidth = window.innerWidth * 0.8;
  const webViewPanelRef = useRef<HTMLDivElement>(null);
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
    direction: "horizontal-right",
    containerRef: mainContentRef,
    panelRef: webViewPanelRef,
    storageKey: "webViewWidth",
    defaultOpenSize: () =>
      (mainContentRef.current?.offsetWidth ?? window.innerWidth * 0.85) *
      DEFAULT_WEBVIEW_WIDTH_FRACTION,
  });

  // --- Instantiate Collaboration Hook ---
  const { isConnected } = useCollaborationSession({
    sessionId,
    userId,
    userInfo: { name: userName, color: userColor }, // Pass relevant user info
    activeFileId,
    editorInstance: editorInstanceRef.current, // Pass the current editor instance
    isSessionActive, // Control connection attempt
    webViewFileIds: ["index.html", "style.css", "script.js"], // <-- Pass webview files
    onStateReceived: useCallback(
      (fileId, content, revision, participants) => {
        console.log(`[App onStateReceived] File: ${fileId}, Rev: ${revision}`);
        // Update local content ONLY if it differs significantly (avoid minor formatting changes)
        // Or simply trust the server state entirely on initial load for the file.
        setFileContents((prev) => ({
          ...prev,
          [fileId]: content, // Overwrite with server state
        }));
        // Update remote users for this specific file
        // Ensure we filter out the current user if the server sends them back
        const filteredParticipants = participants.filter(
          (p) => p.id !== userId
        );
        setRemoteUsers((prev) => ({
          ...prev,
          [fileId]: filteredParticipants,
        }));
      },
      [activeFileId, userId]
    ), // Add userId dependency
    onOperationReceived: useCallback((fileId, operation) => {
      // Apply the operation received from the server (via the hook) to the local fileContents state
      // This keeps fileContents in sync for things like the WebView
      // console.log(`[App onOperationReceived] Op for ${fileId}: ${operation.toString()}`);
      setFileContents((prev) => {
        const currentContent = prev[fileId] ?? "";
        try {
          const newContent = operation.apply(currentContent);
          console.log(
            `[App onOperationReceived] Applied Op for ${fileId}. Prev Length: ${
              currentContent.length
            }, New Length: ${newContent.length}, Content Changed: ${
              currentContent !== newContent
            }`
          );
          if (newContent === currentContent) return prev; // No change
          return { ...prev, [fileId]: newContent };
        } catch (applyError) {
          console.error(
            `[App onOperationReceived] Error applying server op to fileContents for ${fileId}:`,
            applyError,
            "Op:",
            operation.toString(),
            "Content:",
            currentContent
          );
          return prev; // Return previous state on error
        }
      });
    }, []), // No dependencies needed for setFileContents based on prev state
    onRemoteUsersUpdate: useCallback(
      (fileId, updatedUsersInfo) => {
        // This callback now receives potentially partial updates (single user) from the hook.
        // The hook needs to be updated to manage the full list internally for consistency.
        // For now, implement the merging logic here as planned (suboptimally).
        console.log(
          `[App onRemoteUsersUpdate] Received for ${fileId}:`,
          updatedUsersInfo
        );
        setRemoteUsers((prevRemoteUsers) => {
          const nextRemoteUsers = JSON.parse(
            JSON.stringify(prevRemoteUsers)
          ) as typeof prevRemoteUsers;
          if (!nextRemoteUsers[fileId]) {
            nextRemoteUsers[fileId] = [];
          }
          const usersForDoc = nextRemoteUsers[fileId];

          // Assuming updatedUsersInfo is an array, potentially with one user from selection update
          updatedUsersInfo.forEach((updatedUser) => {
            // Skip self
            if (updatedUser.id === userId) return;

            const existingUserIndex = usersForDoc.findIndex(
              (u) => u.id === updatedUser.id
            );
            if (existingUserIndex > -1) {
              // Update existing user
              usersForDoc[existingUserIndex] = updatedUser;
            } else {
              // Add new user
              usersForDoc.push(updatedUser);
            }
          });

          // **Important**: Clear selection/cursor for users in OTHER documents
          // This logic should ideally live where the single user update originates (the hook)
          // or be handled more robustly. Doing it here based on partial updates is tricky.
          // Let's assume for now the hook sends updates only for the *active* file
          // and the CodeEditor component only renders users passed for its *current* file.
          // We won't clear selections in other files here for now.

          // Avoid re-render if no actual change occurred (shallow compare might suffice if careful)
          if (
            JSON.stringify(prevRemoteUsers) === JSON.stringify(nextRemoteUsers)
          ) {
            return prevRemoteUsers;
          }
          return nextRemoteUsers;
        });
      },
      [userId]
    ), // Add userId dependency
    onConnectionStatusChange: useCallback((connected: boolean) => {
      console.log(`[App onConnectionStatusChange] Connected: ${connected}`);
      // Can update UI based on connection status if needed
    }, []),
    onError: useCallback((error: Error | string) => {
      console.error("[App onError] Collaboration Hook Error:", error);
      // Show error to user? Reset session state?
      alert(
        `Collaboration Error: ${error instanceof Error ? error.message : error}`
      );
      // Maybe reset session state partially
      setIsSessionActive(false);
      // setSessionId(null); // Keep session ID for potential reconnect?
    }, []),
  });

  // 3. HANDLERS / FUNCTIONS THIRD

  // Editor Mount Handler
  const handleEditorDidMount = (
    editorInstance: editor.IStandaloneCodeEditor
  ) => {
    console.log("Monaco Editor Instance Mounted:", editorInstance);
    editorInstanceRef.current = editorInstance;
    // setIsEditorReadyForOT(true); // Removed - hook uses editorInstance directly
  };

  // dnd-kit Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Drag Handlers
  const handleDragStart = (event: DragStartEvent) => {
    console.log("Drag Start:", event);
    setDraggingId(event.active.id as string);
    setDropIndicator({ tabId: null, side: null }); // Clear indicator on start
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId = over?.id as string | undefined;
    const isValidTabTarget = overId && openFiles.some((f) => f.id === overId);

    if (!("clientX" in event.activatorEvent)) {
      setDropIndicator({ tabId: null, side: null });
      return;
    }
    const pointerX = (event.activatorEvent as PointerEvent).clientX;

    const firstTabEl = tabContainerRef.current?.querySelector(
      "[data-sortable-id]"
    ) as HTMLElement | null;
    const lastTabEl = tabContainerRef.current?.querySelector(
      "[data-sortable-id]:last-child"
    ) as HTMLElement | null;
    let edgeIndicatorSet = false;

    if (firstTabEl && lastTabEl && openFiles.length > 0) {
      const firstTabRect = firstTabEl.getBoundingClientRect();
      const lastTabRect = lastTabEl.getBoundingClientRect();
      const firstTabId = openFiles[0].id;
      const lastTabId = openFiles[openFiles.length - 1].id;

      if (pointerX < firstTabRect.left + firstTabRect.width * 0.5) {
        setDropIndicator({ tabId: firstTabId, side: "left" });
        edgeIndicatorSet = true;
      } else if (pointerX > lastTabRect.right - lastTabRect.width * 0.5) {
        setDropIndicator({ tabId: lastTabId, side: "right" });
        edgeIndicatorSet = true;
      }
    }

    if (!edgeIndicatorSet) {
      if (isValidTabTarget && overId) {
        if (activeId === overId) {
          setDropIndicator({ tabId: null, side: null });
          return;
        }

        // Linter Error Fix: Access DOM element via data attribute query
        const overNode = tabContainerRef.current?.querySelector(
          `[data-sortable-id="${overId}"]`
        );
        // const overNode = over?.node?.current; // Original line causing error

        if (!overNode) {
          console.warn(
            "Could not find overNode using querySelector for id:",
            overId
          );
          setDropIndicator({ tabId: null, side: null });
          return;
        }
        const overRect = overNode.getBoundingClientRect();
        const overMiddleX = overRect.left + overRect.width / 2;
        const side = pointerX < overMiddleX ? "left" : "right";
        setDropIndicator({ tabId: overId, side });
      } else {
        setDropIndicator({ tabId: null, side: null });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const finalDropIndicator = { ...dropIndicator };
    const activeId = active.id as string;
    setDraggingId(null);
    setDropIndicator({ tabId: null, side: null });

    const oldIndex = openFiles.findIndex((file) => file.id === activeId);
    if (oldIndex === -1) return;

    let newIndex = -1;
    const firstFileId = openFiles[0]?.id;
    const lastFileId = openFiles[openFiles.length - 1]?.id;

    if (
      finalDropIndicator.side === "left" &&
      finalDropIndicator.tabId === firstFileId
    ) {
      newIndex = 0;
    } else if (
      finalDropIndicator.side === "right" &&
      finalDropIndicator.tabId === lastFileId
    ) {
      newIndex = openFiles.length - 1;
    } else if (over && over.id !== active.id) {
      const overId = over.id as string;
      const overIndex = openFiles.findIndex((file) => file.id === overId);
      if (overIndex !== -1) newIndex = overIndex;
    } else {
      return; // No move needed
    }

    if (newIndex !== -1 && oldIndex !== newIndex) {
      setOpenFiles((prevFiles) => arrayMove(prevFiles, oldIndex, newIndex));
    }
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
        version: LANGUAGE_VERSIONS[activeFile.language].version,
        files: [{ content: contentToRun }],
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

  // Global Pointer Up Handler (No changes needed)
  const handleGlobalPointerUp = useCallback(
    (e: PointerEvent) => {
      // Existing logic using isResizing from hooks
    },
    [isWebViewPanelResizing, isTerminalPanelResizing, isExplorerPanelResizing]
  ); // Added explorer hook state

  // UI Interaction Handlers
  const handleIconClick = (iconName: string | null) => {
    if (joinState === "prompting") return;
    if (iconName === "files") {
      toggleExplorerPanel();
    } else {
      if (!isExplorerCollapsed) toggleExplorerPanel();
      setActiveIcon(iconName);
    }
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

      // If NOT in a session, set initial content.
      // If in a session, the collaboration hook's onStateReceived will handle content.
      if (!isSessionActive) {
        setFileContents((prev) => ({
          ...prev,
          [fileId]: prev[fileId] ?? fileData.content,
        }));
      } else {
        // If in a session, ensure the file key exists but content will come from WS.
        // Avoid setting mock content which might overwrite the real state briefly.
        setFileContents((prev) => ({
          ...prev,
          [fileId]: prev[fileId], // Keep existing (potentially undefined), wait for WS
        }));
        // The collaboration hook will request the state for this file when it becomes active.
      }
    }
    // Switch to the tab (triggers collaboration hook to connect if needed)
    setActiveFileId(fileId);
  };

  const handleSwitchTab = (fileId: string) => {
    setActiveFileId(fileId); // This will trigger the collaboration hook effect
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

    // Update open files FIRST
    setOpenFiles((prev) => prev.filter((f) => f.id !== fileIdToClose));
    // THEN set the next active ID
    setActiveFileId(nextActiveId);
    // Remove associated remote users for the closed file
    setRemoteUsers((prev) => {
      const newState = { ...prev };
      delete newState[fileIdToClose];
      return newState;
    });
    // Note: fileContents state can keep the content even if tab is closed
  };

  // Modified Code Change Handler
  const handleCodeChange = (newCode: string) => {
    // If NOT in an active session, update local state directly.
    // If in a session, the MonacoAdapter within the collaboration hook
    // will detect the change and trigger the OT client (`applyClient`).
    // The server will broadcast the operation, and the hook's `onOperationReceived`
    // callback will update the `fileContents` state.
    // So, we only update `fileContents` here if NOT in a session.
    if (!isSessionActive && activeFileId) {
      console.log("[handleCodeChange] Updating local state (not in session)");
      setFileContents((prev) => ({ ...prev, [activeFileId]: newCode }));
    } else if (isSessionActive && activeFileId) {
      console.log(
        "[handleCodeChange] Change detected in session, OT hook will handle state update."
      );
      // No direct state update here needed.
    }
  };

  // View Menu / WebView Handlers
  const toggleWebView = () => {
    toggleWebViewPanel();
    setIsViewMenuOpen(false);
    setIsWebViewVisible(isWebViewCollapsed);
  };
  const toggleTerminalVisibility = () => {
    toggleTerminalPanel();
    setIsViewMenuOpen(false);
  };

  // Share Menu Handlers
  const toggleShareMenu = () => {
    setIsShareMenuOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen) {
        if (isSessionActive && generatedShareLink) setShareMenuView("link");
        else setShareMenuView("initial");
        setIsColorPickerOpen(false);
      } else {
        setIsColorPickerOpen(false);
      }
      return nextOpen;
    });
  };
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(event.target.value);
    setIsColorPickerOpen(false);
  };
  const handleColorSelect = (color: string) => {
    setUserColor(color);
    setIsColorPickerOpen(false);
  };
  const handleToggleColorPicker = () => {
    setIsColorPickerOpen((prev) => !prev);
  };

  // Start Session Handler (Modified to set isSessionActive AFTER backend confirms)
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

      // 3. Update frontend state and URL *after* backend setup
      const shareLink = `${window.location.origin}${window.location.pathname}?session=${newSessionId}`;
      console.log("[handleStartSession] Share link:", shareLink);

      setSessionId(newSessionId);
      setIsSessionCreator(true);
      // setIsSessionActive(true); // Mark session as active locally - MOVED
      setGeneratedShareLink(shareLink);
      setShareMenuView("link"); // Switch to link view

      // CRITICAL: Activate session state AFTER setting session ID
      // This triggers the collaboration hook to connect
      setIsSessionActive(true);

      // Update URL without reloading (Optional - maybe keep it for bookmarking/sharing)
      // const url = new URL(window.location.href);
      // url.searchParams.set("session", newSessionId);
      // window.history.pushState({}, "", url.toString());
    } catch (error) {
      console.error(
        "[handleStartSession] Error creating session or setting initial content:",
        error
      );
      alert("Failed to create session. Please try again.");
      setIsSessionActive(false); // Ensure session is not active on error
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

  // Join Panel Confirm Handler (Modified to set isSessionActive AFTER setting state)
  const handleConfirmJoin = () => {
    if (!userName.trim()) {
      alert("Please enter a display name to join."); // Simple validation
      return;
    }
    console.log(`User ${userName} confirmed join for session ${sessionId}`);
    // Set state first
    setJoinState("joined"); // Mark as joined
    // setIsSessionActive(true); // Activate the session (triggers WS connection) - MOVED
    setActiveIcon("files"); // Switch back to file explorer view
    // Sidebar width should already be open from the prompt state

    // THEN activate the session to trigger hook connection
    setIsSessionActive(true);
  };

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

  // Get remote users for the currently active file (Updated to use remoteUsers state)
  const currentRemoteUsers = useMemo(() => {
    return activeFileId ? remoteUsers[activeFileId] || [] : [];
  }, [remoteUsers, activeFileId]);

  // Derive unique participants (Updated to use remoteUsers state)
  const uniqueRemoteParticipants = useMemo(() => {
    const allUsers = Object.values(remoteUsers).flat();
    const uniqueUsersMap = new Map<string, RemoteUser>();
    allUsers.forEach((user) => {
      // Filter out self if present in the state (hook should ideally filter)
      if (user.id !== userId) {
        uniqueUsersMap.set(user.id, user);
      }
    });
    return Array.from(uniqueUsersMap.values());
  }, [remoteUsers, userId]);

  // 4. EFFECTS FOURTH

  // Global Pointer Up Effect (No change needed here, uses handleGlobalPointerUp)
  useEffect(() => {
    document.addEventListener("pointerup", handleGlobalPointerUp);
    document.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      document.removeEventListener("pointerup", handleGlobalPointerUp);
      document.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [handleGlobalPointerUp]);

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

  // 5. RETURN JSX LAST
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300 overflow-hidden">
      {/* Header - Use the extracted component */}
      <Header
        isViewMenuOpen={isViewMenuOpen}
        setIsViewMenuOpen={setIsViewMenuOpen}
        toggleWebView={toggleWebView}
        toggleTerminalVisibility={toggleTerminalVisibility}
        isWebViewVisible={isWebViewVisible}
        isTerminalCollapsed={isTerminalCollapsed}
        handleRunCode={handleRunCode}
        isShareMenuOpen={isShareMenuOpen}
        toggleShareMenu={toggleShareMenu}
        shareMenuView={shareMenuView}
        userName={userName}
        userColor={userColor}
        handleNameChange={handleNameChange}
        handleColorSelect={handleColorSelect}
        isColorPickerOpen={isColorPickerOpen}
        handleToggleColorPicker={handleToggleColorPicker}
        handleStartSession={handleStartSession}
        generatedShareLink={generatedShareLink}
        handleCopyShareLink={handleCopyShareLink}
        isSessionActive={isSessionActive}
        uniqueRemoteParticipants={uniqueRemoteParticipants}
        setIsColorPickerOpen={setIsColorPickerOpen} // Pass the setter
      />
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
                            activeFileId === id
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
            ref={editorTerminalAreaRef}
            className="flex-1 flex flex-col relative overflow-x-hidden min-w-0"
          >
            {/* Define Placeholder Component */}
            {(() => {
              // IIFE to define Placeholder locally if needed, or define outside component
              const Placeholder = () => (
                <div
                  className="flex-shrink-0 h-[33px] w-24 border border-dashed border-stone-500 bg-stone-700/50 mx-px"
                  aria-hidden="true"
                />
              );

              return (
                <>
                  {/* Tabs */}
                  <DndContext
                    sensors={sensors}
                    // CHANGE BACK: Use pointerWithin collision detection
                    collisionDetection={pointerWithin}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove} // Keep handleDragMove for visual indicator
                    onDragEnd={handleDragEnd}
                  >
                    <div
                      ref={tabContainerRef}
                      className="flex bg-stone-800 flex-shrink-0 overflow-x-auto relative"
                    >
                      {" "}
                      {/* <-- Add ref here */}
                      <SortableContext
                        items={openFiles.map((f) => f.id)}
                        strategy={horizontalListSortingStrategy}
                      >
                        {/* Map SortableTab and pass indicator state */}
                        {openFiles.map((file) => {
                          const IconComponent =
                            languageIconMap[file.language] || VscFile;
                          const iconColor =
                            languageColorMap[file.language] || defaultIconColor;
                          // Determine side indicator for this specific tab
                          const indicatorSide =
                            dropIndicator.tabId === file.id
                              ? dropIndicator.side
                              : null;
                          return (
                            <SortableTab
                              key={file.id}
                              file={file}
                              activeFileId={activeFileId}
                              // Pass draggingId if you need styling on the original tab during drag
                              draggingId={draggingId} // <-- Pass draggingId prop
                              IconComponent={IconComponent}
                              iconColor={iconColor}
                              onSwitchTab={handleSwitchTab}
                              onCloseTab={handleCloseTab}
                              dropIndicatorSide={indicatorSide} // <-- Pass calculated side
                            />
                          );
                        })}
                      </SortableContext>
                      {/* DragOverlay */}
                      <DragOverlay>
                        {draggingId
                          ? (() => {
                              const draggedFile = openFiles.find(
                                (f) => f.id === draggingId
                              );
                              if (!draggedFile) return null;
                              const IconComponent =
                                languageIconMap[draggedFile.language] ||
                                VscFile;
                              const iconColor =
                                languageColorMap[draggedFile.language] ||
                                defaultIconColor;
                              return (
                                <div
                                  // --- Use active tab background color ---
                                  className={`pl-2 pr-4 py-1 border border-stone-500 flex items-center flex-shrink-0 relative shadow-lg bg-neutral-900`} // Use bg-neutral-900 (active tab color)
                                  // --- END CHANGE ---
                                >
                                  <IconComponent
                                    size={16}
                                    className={`mr-1.5 flex-shrink-0 ${iconColor}`}
                                  />
                                  <span
                                    // --- Use active tab text color ---
                                    className={`text-sm -mt-0.5 select-none cursor-default text-stone-200`} // Use text-stone-200 (active tab text color)
                                    // --- END CHANGE ---
                                  >
                                    {draggedFile.name}
                                  </span>
                                  <span className="ml-2 text-stone-400 p-0.5 -mt-0.5 opacity-50">
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
                </>
              );
            })()}{" "}
            {/* End of IIFE */}
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
      <StatusBar
        connectionStatus={isConnected ? "connected" : "disconnected"}
      />{" "}
      {/* Pass connection status */}
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
