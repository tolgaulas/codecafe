import React from "react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";
import { COLORS } from "./constants/colors";
import { v4 as uuidv4 } from "uuid";
import { editor } from "monaco-editor";
import { RemoteUser } from "./types/props";
import StatusBar from "./components/StatusBar";
import {
  CodeExecutionRequest,
  CodeExecutionResponse,
  JoinStateType,
  TerminalHandle,
} from "./types/editor";

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
import { useResizablePanel } from "./hooks/useResizablePanel";
import { useCollaborationSession } from "./hooks/useCollaborationSession";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MainEditorArea from "./components/MainEditorArea";
import { useFileStore } from "./store/useFileStore";
import { IDisposable } from "monaco-editor";

const App = () => {
  // REFS
  const terminalRef = useRef<TerminalHandle>();
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const editorTerminalAreaRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // STATE
  const [activeIcon, setActiveIcon] = useState<string | null>("files");

  const { openFiles, activeFileId } = useFileStore();

  const fileContents = useFileStore((state) => state.fileContents);

  const openFile = useFileStore((state) => state.openFile);
  const closeFile = useFileStore((state) => state.closeFile);
  const switchTab = useFileStore((state) => state.switchTab);
  const setFileContent = useFileStore((state) => state.setFileContent);

  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

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

  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [joinState, setJoinState] = useState<JoinStateType>("idle");

  const [userId] = useState<string>(() => "user-" + uuidv4());

  const [remoteUsers, setRemoteUsers] = useState<{
    [docId: string]: RemoteUser[];
  }>({});

  // Instantiate Resizable Panels
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

  const {
    /* isConnected */
  } = useCollaborationSession({
    sessionId,
    userId,
    userInfo: { name: userName, color: userColor },
    activeFileId,
    editorInstance: editorInstanceRef.current,
    isSessionActive,
    webViewFileIds: ["index.html", "style.css", "script.js"],
    onStateReceived: useCallback(
      (fileId, content, _revision, participants) => {
        // console.log(`[App onStateReceived] File: ${fileId}, Rev: ${revision}`);
        setFileContent(fileId, content);
        const filteredParticipants = participants.filter(
          (p) => p.id !== userId
        );
        setRemoteUsers((prev) => ({
          ...prev,
          [fileId]: filteredParticipants,
        }));
      },
      [activeFileId, userId, setFileContent]
    ),
    onOperationReceived: useCallback(
      (fileId, operation) => {
        try {
          const currentContent =
            useFileStore.getState().fileContents[fileId] ?? "";
          const newContent = operation.apply(currentContent);
          // console.log(
          // `[App onOperationReceived] Applied Op for ${fileId}. Prev Length: ${
          // currentContent.length
          // }, New Length: ${newContent.length}, Content Changed: ${
          // currentContent !== newContent
          // }`
          // );
          if (newContent !== currentContent) {
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
    ),
    onRemoteUsersUpdate: useCallback(
      (fileId, updatedUsersInfo) => {
        // console.log(
        // `[App onRemoteUsersUpdate] Received for ${fileId}:`,
        // updatedUsersInfo
        // );
        setRemoteUsers((prevRemoteUsers) => {
          const nextRemoteUsers = JSON.parse(
            JSON.stringify(prevRemoteUsers)
          ) as typeof prevRemoteUsers;
          if (!nextRemoteUsers[fileId]) {
            nextRemoteUsers[fileId] = [];
          }
          const usersForDoc = nextRemoteUsers[fileId];
          updatedUsersInfo.forEach((updatedUser) => {
            if (updatedUser.id === userId) return;
            const existingUserIndex = usersForDoc.findIndex(
              (u) => u.id === updatedUser.id
            );
            if (existingUserIndex > -1) {
              usersForDoc[existingUserIndex] = updatedUser;
            } else {
              usersForDoc.push(updatedUser);
            }
          });
          if (
            JSON.stringify(prevRemoteUsers) === JSON.stringify(nextRemoteUsers)
          ) {
            return prevRemoteUsers;
          }
          return nextRemoteUsers;
        });
      },
      [userId]
    ),
    onConnectionStatusChange: useCallback((_connected: boolean) => {
      // console.log(`[App onConnectionStatusChange] Connected: ${connected}`);
    }, []),
    onError: useCallback((error: Error | string) => {
      console.error("[App onError] Collaboration Hook Error:", error);
      alert(
        `Collaboration Error: ${error instanceof Error ? error.message : error}`
      );
      setIsSessionActive(false);
    }, []),
  });

  // HANDLERS

  const handleEditorDidMount = (
    editorInstance: editor.IStandaloneCodeEditor
  ) => {
    // console.log("Monaco Editor Instance Mounted:", editorInstance);
    editorInstanceRef.current = editorInstance;
  };

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
        `${import.meta.env.VITE_BACKEND_URL}/api/execute`,
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
        // console.log(executionOutput);
        terminalRef.current?.writeToTerminal(executionOutput);
      }
    } catch (error) {
      const errorOutput = `Error: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`;
      terminalRef.current?.writeToTerminal(errorOutput);
    }
  };

  const handleGlobalPointerUp = useCallback(
    (_: PointerEvent) => {},
    [isWebViewPanelResizing, isTerminalPanelResizing, isExplorerPanelResizing]
  );

  const handleCodeChange = (newCode: string) => {
    if (!isSessionActive && activeFileId) {
      // console.log("[handleCodeChange] Updating local state (not in session)");
      setFileContent(activeFileId, newCode);
    } else if (isSessionActive && activeFileId) {
      // console.log(
      // "[handleCodeChange] Change detected in session, OT hook will handle state update."
      // );
    }
  };

  // View Menu
  const toggleWebView = () => {
    toggleWebViewPanel();
    setIsViewMenuOpen(false);
  };
  const toggleTerminalVisibility = () => {
    toggleTerminalPanel();
    setIsViewMenuOpen(false);
  };

  // Share Menu Handlers
  const toggleShareMenu = () => {
    setIsShareMenuOpen((prev: boolean) => {
      const nextOpen = !prev;
      if (nextOpen) {
        if (isSessionActive && generatedShareLink) setShareMenuView("link");
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

  const handleStartSession = async () => {
    if (!userName.trim()) return;

    setIsColorPickerOpen(false);

    try {
      // Create the session
      // console.log(
      //   `[handleStartSession] Creating session for user: ${userName.trim()}`
      // );
      const createResponse = await axios.post<{ sessionId: string }>(
        `${import.meta.env.VITE_BACKEND_URL}/api/sessions/create`,
        {
          creatorName: userName.trim(),
        }
      );

      const newSessionId = createResponse.data.sessionId;
      // console.log(
      //   "[handleStartSession] Session created successfully:",
      //   newSessionId
      // );

      const currentFileContents = useFileStore.getState().fileContents;

      const keyFiles = ["index.html", "style.css", "script.js"];
      const initialContentPromises = keyFiles.map((fileId) => {
        const currentContent = currentFileContents[fileId];
        if (currentContent !== undefined) {
          // Only send if content exists locally
          // console.log(
          //   `[handleStartSession] Sending initial content for ${fileId} to session ${newSessionId}`
          // );
          return axios
            .post(
              `${
                import.meta.env.VITE_BACKEND_URL
              }/api/sessions/${newSessionId}/set-document`,
              {
                documentId: fileId,
                content: currentContent,
              }
            )
            .catch((err) => {
              console.error(
                `[handleStartSession] Failed to set initial content for ${fileId}:`,
                err
              );
              return null;
            });
        } else {
          // console.warn(
          // `[handleStartSession] No local content found for key file ${fileId}, skipping initial set.`
          // );
          return Promise.resolve(null);
        }
      });

      await Promise.all(initialContentPromises);
      // console.log(
      // "[handleStartSession] Finished attempting to set initial document content."
      // );

      const shareLink = `${window.location.origin}${window.location.pathname}?session=${newSessionId}`;
      // console.log("[handleStartSession] Share link:", shareLink);

      setSessionId(newSessionId);
      setGeneratedShareLink(shareLink);
      setShareMenuView("link");

      // IMPORTANT: Activate session state AFTER setting session ID
      setIsSessionActive(true);
    } catch (error) {
      console.error(
        "[handleStartSession] Error creating session or setting initial content:",
        error
      );
      alert("Failed to create session. Please try again.");
      setIsSessionActive(false);
    }
  };

  const handleCopyShareLink = () => {
    if (generatedShareLink) {
      navigator.clipboard
        .writeText(generatedShareLink)
        .then(() => {
          // console.log("Link copied to clipboard!");
        })
        .catch((err) => {
          console.error("Failed to copy link: ", err);
        });
    }
  };

  const handleConfirmJoin = () => {
    if (!userName.trim()) {
      alert("Please enter a display name to join.");
      return;
    }
    // console.log(`User ${userName} confirmed join for session ${sessionId}`);
    setJoinState("joined"); // Mark as joined
    setActiveIcon("files");

    setIsSessionActive(true);
  };

  // Memos
  const htmlFileContent = useMemo(() => {
    return (
      fileContents["index.html"] ||
      "<!DOCTYPE html><html><head></head><body><!-- index.html not loaded --></body></html>"
    );
  }, [fileContents]);

  const cssFileContent = useMemo(() => {
    return fileContents["style.css"] || "/* style.css not loaded */";
  }, [fileContents]);

  const jsFileContent = useMemo(() => {
    return fileContents["script.js"] || "// script.js not loaded";
  }, [fileContents]);

  // Get remote users
  const currentRemoteUsers = useMemo(() => {
    return activeFileId ? remoteUsers[activeFileId] || [] : [];
  }, [remoteUsers, activeFileId]);

  const activeLanguage = useMemo(() => {
    if (!activeFileId) return "plaintext";
    const activeFile = openFiles.find((f) => f.id === activeFileId);
    return activeFile?.language || "plaintext";
  }, [activeFileId, openFiles]);

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

  // EFFECTS

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

    if (sessionIdFromUrl && !isSessionActive && joinState === "idle") {
      // console.log(
      // `[Join Effect] Conditions met. sessionId: ${sessionIdFromUrl}, isSessionActive: ${isSessionActive}, joinState: ${joinState}, explorerWidth: ${explorerPanelSize}`
      // );
      setSessionId(sessionIdFromUrl);
      setJoinState("prompting");

      let targetWidth = DEFAULT_EXPLORER_WIDTH;
      if (explorerPanelSize > 0) {
        targetWidth = Math.max(targetWidth, explorerPanelSize);
      } else if (explorerPanelSize > MIN_EXPLORER_WIDTH / 2) {
        targetWidth = Math.max(targetWidth, explorerPanelSize);
      }
      targetWidth = Math.max(targetWidth, MIN_JOIN_PANEL_WIDTH);

      // Apply the calculated target width
      setExplorerPanelSize(targetWidth);

      // Clean the URL
      const updatedUrl = new URL(window.location.href);
      updatedUrl.searchParams.delete("session");
      window.history.replaceState({}, "", updatedUrl.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, joinState, setExplorerPanelSize]);

  useEffect(() => {
    let positionListener: IDisposable | null = null;
    const editor = editorInstanceRef.current;

    if (editor) {
      const currentPosition = editor.getPosition();
      if (currentPosition) {
        setCursorLine(currentPosition.lineNumber);
        setCursorColumn(currentPosition.column);
      }

      positionListener = editor.onDidChangeCursorPosition((e) => {
        setCursorLine(e.position.lineNumber);
        setCursorColumn(e.position.column);
      });
    } else {
      setCursorLine(1);
      setCursorColumn(1);
    }

    return () => {
      positionListener?.dispose();
    };
  }, [activeFileId]);

  // JSX
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300 overflow-hidden">
      {/* Header */}
      <Header
        isViewMenuOpen={isViewMenuOpen}
        setIsViewMenuOpen={setIsViewMenuOpen}
        toggleWebView={toggleWebView}
        toggleTerminalVisibility={toggleTerminalVisibility}
        isWebViewVisible={!isWebViewCollapsed}
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
        setIsColorPickerOpen={setIsColorPickerOpen}
      />
      {/* Main Content */}
      <div ref={mainContentRef} className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          sidebarContainerRef={sidebarContainerRef}
          explorerPanelRef={explorerPanelRef}
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
          handleOpenFile={(fileId) => openFile(fileId, isSessionActive)}
          mockFiles={MOCK_FILES}
        />
        {/* Code and Terminal Area + Optional WebView  */}
        <MainEditorArea
          editorTerminalAreaRef={editorTerminalAreaRef}
          tabContainerRef={tabContainerRef}
          terminalRef={terminalRef}
          editorInstanceRef={editorInstanceRef}
          handleSwitchTab={switchTab}
          handleCloseTab={closeFile}
          fileContents={fileContents}
          handleCodeChange={handleCodeChange}
          handleEditorDidMount={handleEditorDidMount}
          currentRemoteUsers={currentRemoteUsers}
          localUserId={userId}
          isSessionActive={isSessionActive}
          terminalPanelHeight={terminalPanelHeight}
          isTerminalCollapsed={isTerminalCollapsed}
          handleTerminalPanelMouseDown={handleTerminalPanelMouseDown}
          webViewPanelWidth={webViewPanelWidth}
          handleWebViewPanelMouseDown={handleWebViewPanelMouseDown}
          htmlFileContent={htmlFileContent}
          cssFileContent={cssFileContent}
          jsFileContent={jsFileContent}
          toggleWebView={toggleWebView}
          joinState={joinState} //
        />
      </div>
      {/* Status Bar */}
      <StatusBar
        connectionStatus={isSessionActive ? "connected" : undefined}
        language={activeLanguage}
        line={cursorLine}
        column={cursorColumn}
      />{" "}
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
            zIndex: 9999,
            cursor: document.body.style.cursor,
          }}
        />
      )}
    </div>
  );
};

export default App;
