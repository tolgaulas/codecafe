import React from "react"; // Add this import
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";
import { COLORS } from "./constants/colors";
import { v4 as uuidv4 } from "uuid";
import { editor } from "monaco-editor";
import { RemoteUser } from "./types/props"; // Ensure RemoteUser is imported
import StatusBar from "./components/StatusBar"; // Add this import
import {
  CodeExecutionRequest,
  CodeExecutionResponse,
  TerminalRef,
  JoinStateType,
} from "./types/editor"; // Import new types

import {
  ICON_BAR_WIDTH,
  DEFAULT_EXPLORER_WIDTH,
  MIN_EXPLORER_WIDTH,
  MAX_EXPLORER_WIDTH,
  MIN_JOIN_PANEL_WIDTH,
  DEFAULT_TERMINAL_HEIGHT_FRACTION,
  MIN_TERMINAL_HEIGHT_PX,
  TERMINAL_COLLAPSE_THRESHOLD_PX,
  DEFAULT_WEBVIEW_WIDTH_FRACTION,
  MIN_WEBVIEW_WIDTH,
} from "./constants/layout";
import { MOCK_FILES } from "./constants/mockFiles";
import { isExecutableLanguage } from "./utils/languageUtils";
import { useResizablePanel } from "./hooks/useResizablePanel"; // Import the hook
import { useCollaborationSession } from "./hooks/useCollaborationSession"; // <-- Import the new hook
import Header from "./components/Header"; // <-- Add import for Header
import Sidebar from "./components/Sidebar"; // <-- Add import for Sidebar
import MainEditorArea from "./components/MainEditorArea"; // <-- Add import for MainEditorArea
import { useFileStore } from "./store/useFileStore"; // <-- Import Zustand store

// Define editor type for clarity
type MonacoEditorInstance = editor.IStandaloneCodeEditor;

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

  // Tab / File Management State (Moved to Zustand)
  // const initialOpenFileIds = ["index.html", "style.css", "script.js"];
  // const initialOpenFilesData = initialOpenFileIds.map((id) => {
  //   if (!MOCK_FILES[id]) {
  //     console.error(`Initial file ${id} not found in MOCK_FILES!`);
  //     return { id, name: "Error", language: "plaintext" as EditorLanguageKey };
  //   }
  //   return {
  //     id: id,
  //     name: MOCK_FILES[id].name,
  //     language: MOCK_FILES[id].language as EditorLanguageKey,
  //   };
  // });
  // const [openFiles, setOpenFiles] = useState<OpenFile[]>(initialOpenFilesData);
  // const [activeFileId, setActiveFileId] = useState<string | null>("index.html");

  // --- Use Zustand Store ---
  const {
    openFiles,
    activeFileId,
    draggingId,
    dropIndicator,
    setOpenFiles,
    setActiveFileId,
    setDraggingId,
    setDropIndicator,
  } = useFileStore();

  // Select specific state slices needed by App.tsx itself
  const fileContents = useFileStore((state) => state.fileContents);

  // Get actions (these have stable references, don't need selectors usually)
  const openFile = useFileStore((state) => state.openFile);
  const closeFile = useFileStore((state) => state.closeFile);
  const switchTab = useFileStore((state) => state.switchTab);
  const setFileContent = useFileStore((state) => state.setFileContent);

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

  // Editor Status State
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);

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
        // Update fileContents in the store
        setFileContent(fileId, content);

        // Update remote users (still local state for now)
        const filteredParticipants = participants.filter(
          (p) => p.id !== userId
        );
        setRemoteUsers((prev) => ({
          ...prev,
          [fileId]: filteredParticipants,
        }));
      },
      [activeFileId, userId, setFileContent]
    ), // Add userId dependency
    onOperationReceived: useCallback(
      (fileId, operation) => {
        // Apply the operation received from the server to the store's fileContents state
        try {
          // Get current content from the store
          const currentContent =
            useFileStore.getState().fileContents[fileId] ?? "";
          const newContent = operation.apply(currentContent);
          console.log(
            `[App onOperationReceived] Applied Op for ${fileId}. Prev Length: ${
              currentContent.length
            }, New Length: ${newContent.length}, Content Changed: ${
              currentContent !== newContent
            }`
          );
          if (newContent !== currentContent) {
            // Update the store
            setFileContent(fileId, newContent);
          }
        } catch (applyError) {
          console.error(
            `[App onOperationReceived] Error applying server op to fileContents for ${fileId}:`,
            applyError,
            "Op:",
            operation.toString(),
            "Content:",
            useFileStore.getState().fileContents[fileId] ?? ""
          );
        }
      },
      [setFileContent]
    ), // No dependencies needed for setFileContents based on prev state
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

  // Code Execution Handler (Use store state)
  const handleRunCode = async () => {
    try {
      if (!activeFileId) {
        terminalRef.current?.writeToTerminal("No active file to run.\n");
        return;
      }

      const activeFile = openFiles.find((f) => f.id === activeFileId);
      // Get content from the store
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
  // REMOVED handleIconClick - Moved to Sidebar component
  // const handleIconClick = (iconName: string | null) => {
  //   if (joinState === "prompting") return;
  //   if (iconName === "files") {
  //     toggleExplorerPanel();
  //   } else {
  //     if (!isExplorerCollapsed) toggleExplorerPanel();
  //     setActiveIcon(iconName);
  //   }
  // };

  // File Handling (REMOVED - Logic moved to useFileStore)
  // const handleOpenFile = (fileId: string) => { ... };
  // const handleSwitchTab = (fileId: string) => { ... };
  // const handleCloseTab = (fileIdToClose: string, e: React.MouseEvent) => { ... };

  // Modified Code Change Handler (Update to use store action)
  const handleCodeChange = (newCode: string) => {
    if (!isSessionActive && activeFileId) {
      console.log("[handleCodeChange] Updating local state (not in session)");
      // Update the store directly
      setFileContent(activeFileId, newCode);
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

  // Start Session Handler (Use store state)
  const handleStartSession = async () => {
    if (!userName.trim()) return;

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

      // Get current file contents from the store
      const currentFileContents = useFileStore.getState().fileContents;

      // 2. Set initial content for key files on the backend
      const keyFiles = ["index.html", "style.css", "script.js"];
      const initialContentPromises = keyFiles.map((fileId) => {
        const currentContent = currentFileContents[fileId]; // Use content from store
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

  // Derived State (Memos) - Use store state
  const htmlFileContent = useMemo(() => {
    return (
      fileContents["index.html"] ||
      "<!DOCTYPE html><html><head></head><body><!-- index.html not loaded --></body></html>"
    );
  }, [fileContents]); // Depend on fileContents from store

  const cssFileContent = useMemo(() => {
    return fileContents["style.css"] || "/* style.css not loaded */";
  }, [fileContents]); // Depend on fileContents from store

  const jsFileContent = useMemo(() => {
    return fileContents["script.js"] || "// script.js not loaded";
  }, [fileContents]); // Depend on fileContents from store

  // Get remote users for the currently active file (Updated to use remoteUsers state)
  const currentRemoteUsers = useMemo(() => {
    return activeFileId ? remoteUsers[activeFileId] || [] : [];
  }, [remoteUsers, activeFileId]);

  // Derive active file language
  const activeLanguage = useMemo(() => {
    if (!activeFileId) return "plaintext";
    const activeFile = openFiles.find((f) => f.id === activeFileId);
    return activeFile?.language || "plaintext";
  }, [activeFileId, openFiles]);

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

  // Effect to track cursor position
  useEffect(() => {
    let positionListener: IDisposable | null = null;
    const editor = editorInstanceRef.current;

    if (editor) {
      // Update position immediately on mount/editor change
      const currentPosition = editor.getPosition();
      if (currentPosition) {
        setCursorLine(currentPosition.lineNumber);
        setCursorColumn(currentPosition.column);
      }

      // Listen for future changes
      positionListener = editor.onDidChangeCursorPosition((e) => {
        setCursorLine(e.position.lineNumber);
        setCursorColumn(e.position.column);
      });
    } else {
      // Reset if editor is not available (e.g., no active file)
      setCursorLine(1);
      setCursorColumn(1);
    }

    // Cleanup listener on unmount or editor change
    return () => {
      positionListener?.dispose();
    };
    // Depend on the editor instance existence derived from activeFileId
    // Having editorInstanceRef.current directly can cause issues if the ref
    // object itself doesn't change but its .current property does.
    // activeFileId changing implies the editor instance might have changed or become null.
  }, [activeFileId]);

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
        {/* Sidebar - Use the extracted component */}
        <Sidebar
          sidebarContainerRef={sidebarContainerRef} // Pass ref
          explorerPanelRef={explorerPanelRef} // Pass ref
          isExplorerCollapsed={isExplorerCollapsed}
          explorerPanelSize={explorerPanelSize}
          handleExplorerPanelMouseDown={handleExplorerPanelMouseDown}
          toggleExplorerPanel={toggleExplorerPanel}
          activeIcon={activeIcon}
          setActiveIcon={setActiveIcon}
          joinState={joinState}
          userName={userName}
          userColor={userColor}
          isColorPickerOpen={isColorPickerOpen}
          handleNameChange={handleNameChange}
          handleColorSelect={handleColorSelect}
          handleToggleColorPicker={handleToggleColorPicker}
          handleConfirmJoin={handleConfirmJoin}
          activeFileId={activeFileId}
          isSessionActive={isSessionActive}
          // Pass store action directly, ensure Sidebar expects correct signature
          handleOpenFile={(fileId) => openFile(fileId, isSessionActive)}
          mockFiles={MOCK_FILES}
        />
        {/* Code and Terminal Area + Optional WebView - Use new component */}
        <MainEditorArea
          editorTerminalAreaRef={editorTerminalAreaRef}
          tabContainerRef={tabContainerRef}
          terminalRef={terminalRef}
          editorInstanceRef={editorInstanceRef}
          // Pass store actions
          handleSwitchTab={switchTab}
          handleCloseTab={closeFile}
          // Keep remaining props
          fileContents={fileContents} // Pass content from store
          handleCodeChange={handleCodeChange}
          handleEditorDidMount={handleEditorDidMount}
          currentRemoteUsers={currentRemoteUsers}
          localUserId={userId}
          isSessionActive={isSessionActive}
          terminalPanelHeight={terminalPanelHeight}
          isTerminalCollapsed={isTerminalCollapsed}
          handleTerminalPanelMouseDown={handleTerminalPanelMouseDown}
          webViewPanelWidth={webViewPanelWidth}
          isWebViewVisible={isWebViewVisible}
          handleWebViewPanelMouseDown={handleWebViewPanelMouseDown}
          htmlFileContent={htmlFileContent}
          cssFileContent={cssFileContent}
          jsFileContent={jsFileContent}
          toggleWebView={toggleWebView}
        />
      </div>
      {/* Status Bar */}
      <StatusBar
        connectionStatus={
          isSessionActive
            ? isConnected
              ? "connected"
              : "disconnected"
            : undefined
        }
        language={activeLanguage}
        line={cursorLine}
        column={cursorColumn}
      />{" "}
      {/* Pass connection status only if session is active */}
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

// Helper type for Monaco Editor Disposable
import { IDisposable } from "monaco-editor";
