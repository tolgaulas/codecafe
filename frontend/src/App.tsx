import React from "react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";
import { COLORS } from "./constants/colors";
import { v4 as uuidv4 } from "uuid";
import { editor, IDisposable } from "monaco-editor";
import { RemoteUser } from "./types/props";
import StatusBar from "./components/StatusBar";
import {
  CodeExecutionRequest,
  CodeExecutionResponse,
  JoinStateType,
  TerminalHandle,
  SearchOptions,
  MatchInfo,
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
import { Analytics } from "@vercel/analytics/react";

const App = () => {
  // REFS
  const terminalRef = useRef<TerminalHandle>();
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const editorTerminalAreaRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // STATE
  const [activeIcon, setActiveIcon] = useState<string | null>(null);

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

  const [tabsHaveOverflow, setTabsHaveOverflow] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    matchCase: false,
    wholeWord: false,
    isRegex: false,
    preserveCase: false,
  });
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const findResultsDecorationIds = useRef<string[]>([]);
  const [isWidgetForcedHidden, setIsWidgetForcedHidden] = useState(false);

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
    defaultOpenSize: DEFAULT_EXPLORER_WIDTH,
  });
  const explorerPanelSize = Math.max(0, rawExplorerPanelSize - ICON_BAR_WIDTH);
  const setExplorerPanelSize = (newSize: number) => {
    setRawExplorerPanelSize(newSize + ICON_BAR_WIDTH);
  };

  // Generic function to set active icon for simple panels (files, search, chat etc.)
  const openPanelWithIcon = (iconName: string) => {
    // If the share panel is currently active and prompting the user to join,
    // prevent switching to other panels. The user must interact with the share panel
    // (e.g., confirm join, or click the share icon again to close/cancel).
    if (
      activeIcon === "share" &&
      joinState === "prompting" &&
      iconName !== "share"
    ) {
      return; // Do nothing, keep the join panel open
    }

    // If the clicked icon is "share", delegate to its specific handler.
    if (iconName === "share") {
      handleShareIconClick();
    } else {
      // For any other icon (files, search, etc.):
      // If joinState was "prompting" (e.g., from a URL-triggered join or an open share panel)
      // and we are now definitively moving to a non-share panel, reset joinState to "idle".
      // This allows the UI to stop showing the join prompt.
      if (joinState === "prompting") {
        setJoinState("idle");
      }
      setActiveIcon(iconName);
    }
  };

  const handleShareIconClick = () => {
    if (activeIcon === "share") {
      // If the share panel is already open
      if (joinState === "prompting") {
        // And we are in the prompting state (user is being asked to enter details),
        // clicking the share icon again should NOT close the panel.
        return; // Do nothing, keep the join panel open and in prompting state.
      } else {
        // If share panel is open but not prompting (e.g., showing participants),
        // then clicking the share icon again closes it.
        setActiveIcon(null); // Close panel
        setJoinState("idle"); // Reset join state
      }
    } else {
      // Opening share panel (or switching to it)
      setActiveIcon("share");
      if (!isSessionActive) {
        setJoinState("prompting"); // Only set to prompting if not already in an active session
      }
      // If isSessionActive is true, joinState remains as is (e.g., "joined" or "idle").
      // This allows Sidebar to show SessionParticipantsPanel based on isSessionActive.
    }
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
      (fileId, content, _revision, participantsFromHook) => {
        // console.log(`[App onStateReceived] File: ${fileId}, Rev: ${revision}`);
        setFileContent(fileId, content);
        // participantsFromHook is already filtered (for self) and has defaults from useCollaborationSession
        setRemoteUsers((prev) => ({
          ...prev,
          [fileId]: participantsFromHook, // Use directly
        }));
      },
      [setFileContent] // userId and activeFileId no longer needed for filtering here
    ),
    onOperationReceived: useCallback(
      (fileId, operationData) => {
        const currentActiveFileId = useFileStore.getState().activeFileId;

        if (fileId === currentActiveFileId) {
          const editor = editorInstanceRef.current;
          if (editor) {
            const currentEditorContent = editor.getModel()?.getValue();
            if (currentEditorContent !== undefined) {
              const currentZustandContent =
                useFileStore.getState().fileContents[fileId];
              // Update Zustand only if editor content is different
              if (currentEditorContent !== currentZustandContent) {
                setFileContent(fileId, currentEditorContent);
              }
            } else {
              console.warn(
                `[App onOperationReceived] Could not get editor content for active file ${fileId}.`
              );
            }
          } else {
            console.warn(
              `[App onOperationReceived] Editor instance not available for active file ${fileId}.`
            );
          }
        } else {
          const currentZustandContent =
            useFileStore.getState().fileContents[fileId];
          if (currentZustandContent !== undefined) {
            try {
              const operation = operationData;
              const newContent = operation.apply(currentZustandContent);
              // Check if content actually changed before updating state
              if (newContent !== currentZustandContent) {
                setFileContent(fileId, newContent);
              }
            } catch (error) {
              console.error(
                `[App onOperationReceived] Error applying operation to background file ${fileId}:`,
                error,
                operationData
              );
            }
          } else {
            console.warn(
              `[App onOperationReceived] No content found in Zustand for background file ${fileId}. Cannot apply operation.`
            );
            // Potentially fetch state here
          }
        }
      },
      [setFileContent]
    ),
    onRemoteUsersUpdate: useCallback(
      (fileId, updatedUsersInfo: Partial<RemoteUser>[]) => {
        // console.log(
        // `[App onRemoteUsersUpdate] Received for ${fileId}:`,
        // updatedUsersInfo
        // );
        setRemoteUsers((prevRemoteUsers) => {
          // Avoid deep cloning if no changes are made for performance
          let changed = false;
          const nextRemoteUsers = { ...prevRemoteUsers };

          if (!nextRemoteUsers[fileId]) {
            // Initialize if fileId is new, but this shouldn't happen often
            // for updates originating from operations (users should exist from state sync)
            nextRemoteUsers[fileId] = [];
            // console.warn(`[App onRemoteUsersUpdate] Initialized users for new fileId: ${fileId}`);
          }

          // Make a shallow copy of the specific document's user array to modify it
          const usersForDoc = [...(nextRemoteUsers[fileId] || [])];

          updatedUsersInfo.forEach((partialUserUpdate) => {
            if (!partialUserUpdate || partialUserUpdate.id === userId) return; // Ignore self or invalid updates

            const existingUserIndex = usersForDoc.findIndex(
              (u) => u.id === partialUserUpdate.id
            );

            if (existingUserIndex > -1) {
              // User exists, merge the partial update
              const existingUser = usersForDoc[existingUserIndex];
              // Merge properties from partialUserUpdate into existingUser
              const mergedUser = { ...existingUser, ...partialUserUpdate };

              // Check if the user object actually changed after merging
              if (JSON.stringify(existingUser) !== JSON.stringify(mergedUser)) {
                usersForDoc[existingUserIndex] = mergedUser;
                changed = true;
              }
            } else {
              // User doesn't exist. This case is less likely for operation-based updates
              // but handle it defensively. We only have partial info.
              // A full update should ideally come from onStateReceived.
              // We could push the partial user, but it might lack name/color.
              // Let's log a warning for now.
              console.warn(
                `[App onRemoteUsersUpdate] Received update for non-existent user ${partialUserUpdate.id} in file ${fileId}. Update:`,
                partialUserUpdate
              );
              // Optionally push the partial user if needed:
              usersForDoc.push(partialUserUpdate as RemoteUser);
              changed = true;
            }
          });

          // If changes occurred, update the state for this fileId
          if (changed) {
            nextRemoteUsers[fileId] = usersForDoc;
            return nextRemoteUsers; // Return the updated state object
          }

          // If no changes, return the previous state object to prevent re-renders
          return prevRemoteUsers;
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
      alert("Please enter your name.");
      return;
    }
    setJoinState("joined");
    // setIsSessionActive(true) will be the main trigger for the new useEffect.
    // Other UI side-effects (like opening panel, setting activeIcon)
    // will be handled by that useEffect.
    setIsSessionActive(true);
  };

  // Utility to get the find controller
  const getFindController = () => {
    return editorInstanceRef.current?.getContribution(
      "editor.contrib.findController"
    ) as any;
  };

  // Function to update match info from editor state
  const updateMatchInfoFromController = () => {
    const controller = getFindController();
    if (controller) {
      const state = controller.getState();
      // Use matchesCount and currentIndex directly from the controller state
      const newMatchInfo = {
        // Monaco findController state currentIndex is 0-based
        currentIndex: state.matchesCount > 0 ? state.currentIndex + 1 : null,
        totalMatches: state.matchesCount || 0,
      };
      setMatchInfo(newMatchInfo);
    }
  };

  // HANDLERS for Search Panel
  const handleSearchChange = (term: string, currentOpts: SearchOptions) => {
    setSearchTerm(term);
    // Options are already in searchOptions state, useEffect will handle search with new term & existing options
  };

  const handleReplaceChange = (value: string) => {
    setReplaceValue(value);
    const controller = getFindController();
    if (controller) {
      // controller.setReplaceString(value); // REMOVED: This method doesn't exist
      // The useEffect hook handles setting the replace string via controller.start()
    }
  };

  const handleToggleSearchOption = (optionKey: keyof SearchOptions) => {
    setSearchOptions((prev) => ({ ...prev, [optionKey]: !prev[optionKey] }));
  };

  const handleFindNext = () => {
    const controller = getFindController();
    if (controller) {
      controller.findNext();
      updateMatchInfoFromController();
    }
  };

  const handleFindPrevious = () => {
    const controller = getFindController();
    if (controller) {
      controller.findPrevious();
      updateMatchInfoFromController();
    }
  };

  const handleReplaceAll = () => {
    const controller = getFindController(); // Still useful for options state
    const editor = editorInstanceRef.current;
    const model = editor?.getModel();

    if (editor && model && activeFileId && searchTerm) {
      const currentSearchOptions = searchOptions; // Capture current options

      // 1. Find all matches
      const matches = model.findMatches(
        searchTerm,
        true, // findNextMatch
        currentSearchOptions.isRegex,
        currentSearchOptions.matchCase,
        currentSearchOptions.wholeWord ? searchTerm : null,
        false // captureMatches - we only need ranges
      );

      if (matches.length > 0) {
        // 2. Create edit operations
        const operations = matches.map((match) => ({
          range: match.range,
          text: replaceValue, // Replace with the current replaceValue
          forceMoveMarkers: true,
        }));

        // 3. Apply edits atomically
        editor.executeEdits("sidebar-replace-all", operations);

        // 4. Get updated content (Optional but good practice)
        // const newContent = model.getValue(); // executeEdits updates the model

        // 5. Update application state (Zustand store) - Triggered by editor change event anyway
        // setFileContent(activeFileId, newContent); // Usually handled by onDidChangeContent listener

        // 6. Clear the search state
        // controller?.setSearchString(""); // Let useEffect handle this based on setSearchTerm
        setSearchTerm(""); // Clear our search term state, triggering useEffect
        setMatchInfo(null); // Clear match info
      } else {
        // No matches found, maybe just clear search term if needed
        console.log(
          "[Search Debug] handleReplaceAll: No matches found to replace."
        );
        setSearchTerm(""); // Clear search term even if no matches were replaced
        setMatchInfo(null);
      }
    } else {
      console.warn("[Search Debug] handleReplaceAll conditions not met.");
    }
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
      setActiveIcon("share"); // Ensure the share panel (join prompt) is active

      // Also generate the share link for the joining user
      const shareLink = `${window.location.origin}${window.location.pathname}?session=${sessionIdFromUrl}`;
      setGeneratedShareLink(shareLink);

      let targetWidth = DEFAULT_EXPLORER_WIDTH;
      if (explorerPanelSize > 0) {
        targetWidth = Math.max(targetWidth, explorerPanelSize);
      } else if (explorerPanelSize > MIN_EXPLORER_WIDTH / 2) {
        targetWidth = Math.max(targetWidth, explorerPanelSize);
      }
      targetWidth = Math.max(targetWidth, MIN_JOIN_PANEL_WIDTH);

      setExplorerPanelSize(targetWidth);

      // Clean the URL
      const updatedUrl = new URL(window.location.href);
      updatedUrl.searchParams.delete("session");
      window.history.replaceState({}, "", updatedUrl.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, joinState, setExplorerPanelSize]);

  // Effect to handle UI changes after a session is joined
  useEffect(() => {
    if (isSessionActive && joinState === "joined") {
      // Ensure the explorer panel is open if it was collapsed
      if (isExplorerCollapsed) {
        toggleExplorerPanel();
      }

      const showParticipantsPanel = () => {
        // Delay showing participants to give collaboration hook time
        // after potential switchTab or initial join operations.
        setTimeout(() => {
          setActiveIcon("share");
        }, 150); // This delay can be tuned
      };

      if (activeFileId) {
        const currentActiveId = activeFileId;
        // Short delay for switchTab, then trigger showing participants
        setTimeout(() => {
          switchTab(currentActiveId);
          showParticipantsPanel();
        }, 50); // Delay for switchTab
      } else {
        // If no active file, just proceed to show participants after a delay
        showParticipantsPanel();
      }
    }
  }, [
    isSessionActive,
    joinState,
    isExplorerCollapsed,
    toggleExplorerPanel,
    activeFileId,
    switchTab,
    setActiveIcon, // Ensure setActiveIcon is in dependencies
  ]);

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
  }, [activeFileId, editorInstanceRef.current]);

  // Effect to control explorer panel visibility based on activeIcon
  useEffect(() => {
    // Open panel if an icon is active and panel is closed
    if (activeIcon && isExplorerCollapsed) {
      toggleExplorerPanel();
    }
    // Close panel if no icon is active and panel is open
    else if (!activeIcon && !isExplorerCollapsed) {
      toggleExplorerPanel();
    }
    // Note: We intentionally don't list toggleExplorerPanel in dependencies
    // to avoid loops if the hook's internal state causes re-renders.
    // We only want this effect to run when activeIcon or isExplorerCollapsed changes.
  }, [activeIcon, isExplorerCollapsed]);

  // Effect to handle editor search AND find widget visibility control
  useEffect(() => {
    const controller = getFindController();
    if (!controller) {
      setMatchInfo(null);
      setIsWidgetForcedHidden(false); // Ensure hidden state is reset if no controller
      return;
    }

    if (activeIcon === "search") {
      // Panel is active: force hide the native widget via CSS
      setIsWidgetForcedHidden(true);

      // Proceed with search logic based on term/options
      if (searchTerm) {
        controller.setSearchString(searchTerm);
        controller.start({
          searchString: searchTerm,
          replaceString: replaceValue,
          isRegex: searchOptions.isRegex,
          matchCase: searchOptions.matchCase,
          wholeWord: searchOptions.wholeWord,
          autoFindInSelection: "never",
          seedSearchStringFromSelection: "never",
        });
        updateMatchInfoFromController();
      } else {
        // Clear search if term is empty
        if (controller.getState().searchString !== "") {
          controller.setSearchString("");
        }
        if (editorInstanceRef.current) {
          findResultsDecorationIds.current =
            editorInstanceRef.current.deltaDecorations(
              findResultsDecorationIds.current,
              []
            );
        }
        setMatchInfo(null);
      }
    } else {
      // Panel is NOT active: close widget and unhide *after* a delay
      controller.closeFindWidget(); // Close immediately
      setTimeout(() => {
        setIsWidgetForcedHidden(false); // Remove CSS hiding after delay
      }, 100); // 100ms delay
    }
  }, [searchTerm, searchOptions, replaceValue, activeIcon]); // Dependencies

  // JSX
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300 overflow-hidden">
      {/* CSS rule now conditional based on parent class */}
      <style>
        {`
          .force-hide-find-widget .monaco-editor .find-widget {
            display: none !important;
          }
        `}
      </style>
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
      <div
        ref={mainContentRef}
        className={`flex flex-1 min-h-0 ${
          isWidgetForcedHidden ? "force-hide-find-widget" : ""
        }`}
      >
        {/* Sidebar */}
        <Sidebar
          sidebarContainerRef={sidebarContainerRef}
          explorerPanelRef={explorerPanelRef}
          isExplorerCollapsed={isExplorerCollapsed}
          explorerPanelSize={explorerPanelSize}
          handleExplorerPanelMouseDown={handleExplorerPanelMouseDown}
          toggleExplorerPanel={toggleExplorerPanel}
          openPanelWithIcon={openPanelWithIcon}
          activeIcon={activeIcon}
          setActiveIcon={setActiveIcon}
          handleShareIconClick={handleShareIconClick}
          joinState={joinState}
          sessionId={sessionId}
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
          onSearchChange={handleSearchChange}
          onReplaceChange={handleReplaceChange}
          onToggleSearchOption={handleToggleSearchOption}
          replaceValue={replaceValue}
          searchOptions={searchOptions}
          matchInfo={matchInfo}
          onReplaceAll={handleReplaceAll}
          // Props for SessionParticipantsPanel (passed through Sidebar)
          uniqueRemoteParticipants={uniqueRemoteParticipants}
          localUserName={userName} // Pass userName as localUserName
          localUserColor={userColor} // Pass userColor as localUserColor
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
          joinState={joinState}
          tabsHaveOverflow={tabsHaveOverflow}
          onTabsOverflowChange={setTabsHaveOverflow}
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
      <Analytics />
    </div>
  );
};

export default App;
