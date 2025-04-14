import { useState, useEffect, useRef, useCallback } from "react";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import { editor } from "monaco-editor";
import {
  TextOperation,
  MonacoAdapter,
  OTSelection,
  Client,
  IClientCallbacks,
  offsetToPosition,
} from "../TextOperationSystem";
import { UserInfo, RemoteUser } from "../types/props";
import { v4 as uuidv4 } from "uuid"; // Needed for unique client ID if not passed

interface UseCollaborationSessionProps {
  sessionId: string | null;
  userId: string;
  userInfo: Pick<UserInfo, "name" | "color">; // Use Pick for specific properties
  activeFileId: string | null;
  editorInstance: editor.IStandaloneCodeEditor | null;
  isSessionActive: boolean; // Control when the hook should attempt connection
  onStateReceived: (
    fileId: string,
    content: string,
    revision: number,
    participants: RemoteUser[]
  ) => void;
  onOperationReceived: (fileId: string, operation: TextOperation) => void; // Pass OT op for App state
  onRemoteUsersUpdate: (fileId: string, users: RemoteUser[]) => void;
  onConnectionStatusChange?: (isConnected: boolean) => void; // Optional callback for connection status
  onError?: (error: Error | string) => void; // Optional callback for errors
  webViewFileIds?: string[]; // Optional webViewFileIds
}

interface UseCollaborationSessionReturn {
  isConnected: boolean;
  // Potentially add functions to manually connect/disconnect if needed later
}

export const useCollaborationSession = ({
  sessionId,
  userId,
  userInfo,
  activeFileId,
  editorInstance,
  isSessionActive,
  onStateReceived,
  onOperationReceived,
  onRemoteUsersUpdate,
  onConnectionStatusChange,
  onError,
  webViewFileIds,
}: UseCollaborationSessionProps): UseCollaborationSessionReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const stompClientRef = useRef<Stomp.Client | null>(null);
  const adapterRef = useRef<MonacoAdapter | null>(null);
  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<Stomp.Subscription[]>([]);
  const currentFileIdRef = useRef<string | null>(null); // Track the file the hook is currently handling
  const subscribedWebViewOpsRef = useRef<Set<string>>(new Set()); // Track webview op subs

  const handleConnectionStatusChange = useCallback(
    (connected: boolean) => {
      setIsConnected(connected);
      onConnectionStatusChange?.(connected);
    },
    [onConnectionStatusChange]
  );

  const handleError = useCallback(
    (error: Error | string) => {
      console.error("[useCollaborationSession] Error:", error);
      onError?.(error);
      handleConnectionStatusChange(false); // Assume disconnection on error
      // Reset OT state on error
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
      subscriptionsRef.current = []; // Clear subscriptions
    },
    [onError, handleConnectionStatusChange]
  );

  // Effect to manage WebSocket connection and subscriptions based on session state and active file
  useEffect(() => {
    // Conditions to establish connection: session active, file open, editor ready
    if (!isSessionActive || !sessionId || !activeFileId || !editorInstance) {
      // Cleanup existing connection if conditions are not met
      if (stompClientRef.current?.connected) {
        console.log(
          `[useCollaborationSession Cleanup] Disconnecting STOMP (Reason: sessionActive=${isSessionActive}, sessionId=${sessionId}, activeFileId=${activeFileId}, editorReady=${!!editorInstance})`
        );
        stompClientRef.current.disconnect(() => {
          console.log(
            "[useCollaborationSession STOMP] Disconnected due to unmet conditions."
          );
          handleConnectionStatusChange(false);
          // Reset OT state on disconnect
          clientRef.current = null;
          adapterRef.current?.detach();
          adapterRef.current = null;
          subscriptionsRef.current = []; // Clear subscriptions on disconnect
        }, {}); // Added empty headers object
      } else if (isConnected) {
        // Ensure isConnected state is false if stomp client wasn't connected but state thought it was
        handleConnectionStatusChange(false);
      }
      currentFileIdRef.current = null; // Reset current file tracking
      return; // Exit effect if conditions not met
    }

    // If already connected and handling the same file, do nothing
    if (isConnected && currentFileIdRef.current === activeFileId) {
      console.log(
        `[useCollaborationSession] Already connected and handling file: ${activeFileId}`
      );
      return;
    }

    console.log(
      `[useCollaborationSession Setup] Conditions met for session ${sessionId}, file ${activeFileId}. Setting up STOMP...`
    );
    currentFileIdRef.current = activeFileId; // Track the file we are connecting for

    // --- Cleanup existing connection/subscriptions before starting new ones ---
    // Unsubscribe from previous file topics if any
    subscriptionsRef.current.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (e) {
        console.warn("Error unsubscribing:", e);
      }
    });
    subscriptionsRef.current = [];

    // Disconnect stomp client only if it exists and we are changing files or reconnecting
    // Do NOT disconnect if we're connecting for the *first* time in this hook instance
    if (stompClientRef.current?.connected) {
      console.warn(
        "[useCollaborationSession Setup] Stomp client already connected during setup? Disconnecting first."
      );
      stompClientRef.current.disconnect(() => {
        console.log(
          "[useCollaborationSession STOMP] Disconnected before reconnecting for new file/session."
        );
        // Resetting OT state here ensures clean slate for the new file connection
        clientRef.current = null;
        adapterRef.current?.detach();
        adapterRef.current = null;
      }, {});
    } else {
      // If not connected, still ensure OT state is reset
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
    }
    // --- End Cleanup ---

    console.log("[useCollaborationSession Setup] Connecting via SockJS...");
    const socket = new SockJS("http://localhost:8080/ws");
    const stompClient = Stomp.over(socket);
    stompClient.debug = () => {}; // Suppress STOMP debug logs in console
    stompClientRef.current = stompClient;

    // Ensure adapter is created or re-created if editor instance exists
    if (editorInstance && !adapterRef.current) {
      console.log(
        `[useCollaborationSession Setup] Initializing MonacoAdapter for ${activeFileId}`
      );
      adapterRef.current = new MonacoAdapter(editorInstance);
    } else if (editorInstance && adapterRef.current) {
      // If adapter exists, ensure it's re-attached or re-registered later
      // For now, we assume a new connection needs potentially new callbacks
      adapterRef.current.detach(); // Detach previous callbacks if any
      adapterRef.current = new MonacoAdapter(editorInstance); // Or re-initialize if safer
      console.log(
        `[useCollaborationSession Setup] Re-initializing MonacoAdapter for ${activeFileId}`
      );
    }

    stompClient.connect(
      {}, // Empty headers
      (frame: any) => {
        console.log(
          `[useCollaborationSession STOMP Connected] Frame: ${frame}, Session: ${sessionId}, File: ${activeFileId}`
        );
        handleConnectionStatusChange(true);

        // <<< Send explicit join message >>>
        const joinPayload = {
          sessionId: sessionId,
          documentId: activeFileId,
          userId: userId,
          userName: userInfo.name.trim(),
          userColor: userInfo.color,
        };
        console.log("Sending explicit /app/join message", joinPayload);
        stompClient.send("/app/join", {}, JSON.stringify(joinPayload));

        // Define callbacks WITH documentId included
        const clientCallbacks: IClientCallbacks = {
          sendOperation: (revision: number, operation: TextOperation) => {
            if (
              stompClientRef.current?.connected &&
              sessionId &&
              currentFileIdRef.current
            ) {
              const payload = {
                documentId: currentFileIdRef.current, // Use ref for current file
                clientId: userId,
                revision: revision,
                operation: operation.toJSON(),
                sessionId: sessionId,
              };
              // console.log(`[Client -> Server Op] /app/operation`, payload); // Less verbose logging
              stompClientRef.current.send(
                "/app/operation",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.error(
                "Cannot send operation - STOMP not connected, no current file, or no session ID"
              );
            }
          },
          sendSelection: (selection: OTSelection | null) => {
            if (
              stompClientRef.current?.connected &&
              sessionId &&
              currentFileIdRef.current &&
              userInfo.name.trim()
            ) {
              let cursorPosition = null;
              if (
                selection &&
                selection.ranges &&
                selection.ranges.length > 0 &&
                editorInstance
              ) {
                const model = editorInstance.getModel();
                if (model) {
                  try {
                    const headPos = offsetToPosition(
                      model,
                      selection.ranges[0].head
                    );
                    cursorPosition = {
                      lineNumber: headPos.lineNumber,
                      column: headPos.column,
                    };
                  } catch (error) {
                    console.error(
                      "Failed to infer cursor position from selection:",
                      error
                    );
                  }
                }
              }
              const payload = {
                documentId: currentFileIdRef.current, // Use ref for current file
                sessionId: sessionId,
                userInfo: {
                  id: userId,
                  name: userInfo.name.trim(),
                  color: userInfo.color,
                  cursorPosition: cursorPosition,
                  selection: selection?.toJSON() ?? null,
                },
              };
              // console.log(`[OT Client -> Server Sel] /app/selection (via clientCallbacks)`, payload); // Less verbose
              stompClientRef.current.send(
                "/app/selection",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.warn(
                "Cannot send selection via OT Client - STOMP not connected, no current file, no session ID, or no user name"
              );
            }
          },
          applyOperation: (operation: TextOperation) => {
            // console.log(`[Client -> Editor Apply] Op: ${operation.toString()}`); // Less verbose
            adapterRef.current?.applyOperation(operation); // Apply op to the Monaco editor instance
            // --- Notify App component about the applied operation ---
            if (currentFileIdRef.current) {
              onOperationReceived(currentFileIdRef.current, operation);
            }
            // --- End notification ---
          },
          getSelection: () => {
            return adapterRef.current?.getSelection() ?? null;
          },
          setSelection: (selection: OTSelection | null) => {
            adapterRef.current?.setSelection(selection);
          },
        };

        // Subscribe to topics for the *current* active file
        const currentFileId = activeFileId; // Capture for subscriptions
        const newSubscriptions: Stomp.Subscription[] = [];
        const currentWebViewSubscriptions = new Set<string>(); // Track for this connection attempt

        // 1. Document State Handling (Only for Active File)
        const stateTopic = `/topic/sessions/${sessionId}/state/document/${currentFileId}`;
        console.log(
          `[useCollaborationSession STOMP Setup] Subscribing to Document State topic: ${stateTopic}`
        );
        newSubscriptions.push(
          stompClient.subscribe(stateTopic, (message: any) => {
            try {
              const state = JSON.parse(message.body);
              console.log(
                `[Server -> Client State] Received for ${state.documentId}:`,
                state
              );

              // Ignore state for files other than the one this hook instance is currently handling
              if (state.documentId !== currentFileIdRef.current) {
                console.log(
                  `   Ignoring state for inactive file: ${state.documentId} (current: ${currentFileIdRef.current})`
                );
                return;
              }

              // Process participants first
              let processedParticipants: RemoteUser[] = [];
              if (state.participants && Array.isArray(state.participants)) {
                processedParticipants = state.participants
                  .map((p: any): RemoteUser | null => {
                    if (!p || typeof p.id !== "string") return null;
                    return {
                      id: p.id,
                      name: p.name || `User ${p.id.substring(0, 4)}`,
                      color: p.color || "#CCCCCC",
                      cursorPosition: p.cursorPosition || null,
                      selection: p.selection
                        ? OTSelection.fromJSON(p.selection)
                        : null,
                    };
                  })
                  .filter(
                    (user: RemoteUser | null): user is RemoteUser =>
                      user !== null && user.id !== userId
                  );
                onRemoteUsersUpdate(state.documentId, processedParticipants);
                console.log(
                  `   Processed participants for ${state.documentId}. Count: ${processedParticipants.length}`
                );
              } else {
                onRemoteUsersUpdate(state.documentId, []); // Send empty list if none
                console.log(
                  `   No participants found in state message for ${state.documentId}.`
                );
              }

              // Initialize OT Client only if it doesn't exist for this file connection
              if (!clientRef.current) {
                console.log(
                  `   Initializing Client for ${state.documentId} @ rev ${state.revision}`
                );
                clientRef.current = new Client(
                  state.revision,
                  userId,
                  clientCallbacks
                );

                // Notify App component of initial state
                onStateReceived(
                  state.documentId,
                  state.document,
                  state.revision,
                  processedParticipants
                );

                // Register adapter callbacks AFTER client is initialized and initial state is handled
                if (adapterRef.current) {
                  console.log(
                    `   Registering Adapter Callbacks for ${state.documentId}`
                  );
                  adapterRef.current.registerCallbacks({
                    change: (op: TextOperation, inverse: TextOperation) => {
                      // console.log(`[Adapter Callback] Change triggered for ${currentFileIdRef.current}. Op: ${op.toString()}`); // Less verbose
                      if (!clientRef.current) {
                        console.error(
                          `[Adapter Callback] Error: clientRef is null when change occurred for ${currentFileIdRef.current}`
                        );
                        return;
                      }
                      // console.log(`[Adapter Callback] Calling applyClient. Client State: ${clientRef.current.state.constructor.name}, Revision: ${clientRef.current.revision}`); // Less verbose
                      clientRef.current?.applyClient(op); // Send op to server state machine

                      // *** NO LONGER NEEDED: App.tsx updates its state via onOperationReceived ***
                      // setFileContents((prevContents) => { ... });
                    },
                    selectionChange: () => {
                      // console.log(`[Editor -> Client SelChange] File: ${currentFileIdRef.current}`); // Less verbose
                      clientRef.current?.selectionChanged();
                    },
                    blur: () => {
                      // console.log(`[Editor -> Client Blur] File: ${currentFileIdRef.current}`); // Less verbose
                      clientRef.current?.blur();
                    },
                  });
                } else {
                  console.error(
                    `[useCollaborationSession State] Cannot register adapter callbacks, adapterRef is null for ${state.documentId}`
                  );
                }
              } else {
                // If client exists, might be a state update (e.g., participant join/leave without content change)
                // Or a resync if revisions mismatch significantly (advanced)
                console.warn(
                  `[Server -> Client State] Received state for ${state.documentId} after client init. Rev: ${state.revision}, ClientRev: ${clientRef.current.revision}`
                );
                // Potentially update participants even if client exists
                onRemoteUsersUpdate(state.documentId, processedParticipants);
                // Maybe force-set content if needed, though ideally ops handle this
                // onStateReceived(state.documentId, state.document, state.revision, processedParticipants); // Be careful with this
              }
            } catch (error) {
              handleError(`Error processing document-state message: ${error}`);
            }
          })
        );

        // 2. Operations Handling (Active File + WebView Files)
        const handleIncomingOperation = (message: any) => {
          try {
            const payload = JSON.parse(message.body);
            if (
              !payload ||
              !payload.clientId ||
              !payload.operation ||
              !payload.documentId ||
              !payload.sessionId
            ) {
              console.error(
                "[Server -> Client Op] Invalid payload:",
                message.body
              );
              return;
            }

            const docId = payload.documentId;
            const opData = payload.operation;
            const sessionOfOp = payload.sessionId;
            const sourceClientId = payload.clientId;

            // Ignore if session doesn't match current hook session
            if (sessionOfOp !== sessionId) {
              console.warn(
                `Ignoring op for session ${sessionOfOp} (current: ${sessionId})`
              );
              return;
            }

            try {
              const operationForClient = TextOperation.fromJSON(opData);

              // --- Logic for Local vs Remote Ops ---
              if (sourceClientId === userId) {
                // Operation originated from the local client (echoed back from server)

                // Update WebView content state if applicable
                if (webViewFileIds?.includes(docId)) {
                  // console.log(`[Server -> Client Op Apply(Local Echo - WebView)] Op for ${docId} via direct callback`);
                  onOperationReceived(docId, operationForClient);
                }
                // Do NOT call applyServer for local ops, OT Client handles this via ACK
                // The clientRef.current?.serverAck() handles the state transition implicitly
              } else {
                // Operation originated from a remote client

                // If it's for the currently active file, process through OT Client
                if (docId === currentFileIdRef.current) {
                  if (clientRef.current) {
                    // console.log(`[Server -> Client Op Apply(Remote - Active)] Op for ${docId} via OT Client`);
                    clientRef.current.applyServer(operationForClient);
                    // Callback `applyOperation` inside clientCallbacks handles applying to editor AND notifying App
                  } else {
                    console.warn(
                      `[Server -> Client Op] Received op for active file ${docId} before client init.`
                    );
                  }
                }
                // If it's for a watched WebView file (and not the active file), directly notify App
                else if (webViewFileIds?.includes(docId)) {
                  // console.log(`[Server -> Client Op Apply(Remote - WebView)] Op for ${docId} via direct callback`);
                  onOperationReceived(docId, operationForClient);
                }
                // Else: Ignore remote op (not active, not webview)
                // else { console.log(`[Server -> Client Op Ignore(Remote)] Op for ${docId}`); }
              }
              // --- End Logic ---
            } catch (e) {
              handleError(
                `Error processing/applying server op for ${docId}: ${e}`
              );
            }
          } catch (error) {
            handleError(`Error parsing operations message: ${error}`);
          }
        };

        // Subscribe to Active File Operations
        const activeOpTopic = `/topic/sessions/${sessionId}/operations/document/${currentFileId}`;
        console.log(
          `[useCollaborationSession STOMP Setup] Subscribing to Active Operations topic: ${activeOpTopic}`
        );
        newSubscriptions.push(
          stompClient.subscribe(activeOpTopic, handleIncomingOperation)
        );
        subscribedWebViewOpsRef.current.add(currentFileId); // Mark active file as handled

        // Subscribe to WebView File Operations (if not already the active file)
        webViewFileIds?.forEach((webViewFileId) => {
          if (webViewFileId !== currentFileId) {
            const webViewOpTopic = `/topic/sessions/${sessionId}/operations/document/${webViewFileId}`;
            console.log(
              `[useCollaborationSession STOMP Setup] Subscribing to WebView Operations topic: ${webViewOpTopic}`
            );
            newSubscriptions.push(
              stompClient.subscribe(webViewOpTopic, handleIncomingOperation)
            );
            currentWebViewSubscriptions.add(webViewFileId); // Add to current set
          }
        });
        subscribedWebViewOpsRef.current = currentWebViewSubscriptions; // Update ref

        // 3. Selections Handling (Only for Active File)
        const selectionTopic = `/topic/sessions/${sessionId}/selections/document/${currentFileId}`;
        console.log(
          `[useCollaborationSession STOMP Setup] Subscribing to Selections topic: ${selectionTopic}`
        );
        newSubscriptions.push(
          stompClient.subscribe(selectionTopic, (message: any) => {
            try {
              const payload = JSON.parse(message.body);
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
              const { documentId, userInfo: remoteUserInfo } = payload;
              // Ignore own messages based on userInfo.id
              if (remoteUserInfo.id === userId) return;
              // Ignore selections for files other than the one this hook instance is handling
              if (documentId !== currentFileIdRef.current) return;

              // console.log(`[DEBUG] Received selection for ${remoteUserInfo.id} in ${documentId}`); // Less verbose

              // Update remote users via callback - App.tsx will manage the state logic
              // We just need to format the incoming user info correctly
              const formattedUser: RemoteUser = {
                id: remoteUserInfo.id,
                name:
                  remoteUserInfo.name ||
                  `User ${remoteUserInfo.id.substring(0, 4)}`,
                color: remoteUserInfo.color || "#CCCCCC",
                cursorPosition: remoteUserInfo.cursorPosition || null,
                selection: remoteUserInfo.selection
                  ? OTSelection.fromJSON(remoteUserInfo.selection)
                  : null,
              };
              // The callback in App.tsx needs to handle merging this single user update
              // into the list for the correct documentId.
              // Maybe the hook *should* manage the remoteUsers state internally?
              // For now, let App handle the merging logic via onRemoteUsersUpdate.
              // It might be simpler to pass the single user update:
              // onSingleRemoteUserUpdate(documentId, formattedUser);
              // Let's stick to passing the full list for now, App needs to know how to merge.
              // This requires App to fetch the current list, update/add, and set state.
              // Re-evaluating: It's likely better for the *hook* to manage remoteUsers state internally
              // and just provide the final list for the active file. Let's refactor later if needed.
              // For now, App receives raw user info and needs to handle updates.
              // --> Problem: onRemoteUsersUpdate expects the *full* list. How to provide it?
              // The hook doesn't store the full list.
              // Change plan: Hook needs to manage remoteUsers state internally.

              // Let's stick to the original plan for now and let App manage it,
              // but acknowledge this might be complex. We'll refine if it proves too difficult.
              // We will pass the single user update through `onRemoteUsersUpdate` and require
              // App.tsx to handle the merging logic. This is suboptimal but keeps the initial refactor focused.
              const formattedUserForApp: RemoteUser = {
                id: remoteUserInfo.id,
                name:
                  remoteUserInfo.name ||
                  `User ${remoteUserInfo.id.substring(0, 4)}`,
                color: remoteUserInfo.color || "#CCCCCC",
                cursorPosition: remoteUserInfo.cursorPosition || null,
                selection: remoteUserInfo.selection
                  ? OTSelection.fromJSON(remoteUserInfo.selection)
                  : null,
              };
              // Kludge: Pass single user in an array for now. App needs to know how to merge.
              onRemoteUsersUpdate(documentId, [formattedUserForApp]);
            } catch (error) {
              handleError(`Error processing selections message: ${error}`);
            }
          })
        );

        // ACK Handling
        const ackTopic = `/topic/ack/${userId}`;
        console.log(
          `[useCollaborationSession STOMP Setup] Subscribing to ACK topic: ${ackTopic}`
        );
        newSubscriptions.push(
          stompClient.subscribe(ackTopic, (message: any) => {
            // console.log(`[Server -> Client ACK] Received`); // Less verbose
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

        // Store subscriptions
        subscriptionsRef.current = newSubscriptions;

        // Request initial state FOR THE CURRENT ACTIVE FILE
        console.log(
          `[Client -> Server ReqState] Requesting state for session ${sessionId}, doc ${currentFileId}...`
        );
        stompClient.send(
          "/app/get-document-state",
          {},
          JSON.stringify({ documentId: currentFileId, sessionId: sessionId })
        );
      }, // End onConnect
      (error: any) => {
        handleError(
          `[STOMP Error] Connection Failed for ${sessionId}/${activeFileId}: ${error}`
        );
        // Cleanup will run via effect dependency change or component unmount
      } // End onError
    ); // End stompClient.connect

    // Cleanup function for the effect
    return () => {
      console.log(
        `[useCollaborationSession Cleanup] Running cleanup for file ${currentFileIdRef.current} effect...`
      );
      subscriptionsRef.current.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.warn("Error unsubscribing:", e);
        }
      });
      subscriptionsRef.current = [];

      if (stompClientRef.current?.connected) {
        console.log(
          "[useCollaborationSession Cleanup] Disconnecting STOMP client in effect cleanup."
        );
        stompClientRef.current.disconnect(() => {
          console.log(
            "[useCollaborationSession STOMP] Disconnected via effect cleanup."
          );
          handleConnectionStatusChange(false); // Ensure state reflects disconnection
        }, {});
      }
      // Reset refs specific to this connection attempt
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
      currentFileIdRef.current = null; // Clear tracked file ID
      // Do not nullify stompClientRef here, it's handled at the start of the effect if needed
      console.log(`[useCollaborationSession Cleanup] Finished effect cleanup.`);
    };

    // Dependencies: Re-run when session/file changes, or editor becomes available/unavailable
  }, [
    isSessionActive,
    sessionId,
    activeFileId, // Rerun when file changes
    editorInstance, // Rerun if editor mounts/unmounts
    userId,
    userInfo.name, // Re-run if user info changes (for join message)
    userInfo.color,
    // Callbacks should be stable via useCallback in parent, but include just in case
    onStateReceived,
    onOperationReceived,
    onRemoteUsersUpdate,
    handleConnectionStatusChange, // Include internal callbacks derived from props
    handleError,
    // Include webViewFileIds - NOTE: If this list changes often, could cause churn. Assume stable.
    // Convert array to string for stable dependency check if needed, but likely fine.
    JSON.stringify(webViewFileIds),
  ]);

  // Effect to send initial presence when connection is established
  useEffect(() => {
    if (
      isConnected &&
      sessionId &&
      activeFileId &&
      userInfo.name.trim() &&
      stompClientRef.current?.connected
    ) {
      // console.log(`[useCollaborationSession Presence] Sending initial presence for ${userId} in ${activeFileId}`);
      // Use clientCallbacks.sendSelection which is already set up
      clientRef.current?.selectionChanged(); // Trigger a selection send (which includes user info)
      // Or send explicitly if needed, but selectionChanged should cover it
      // const initialPresencePayload = { ... };
      // stompClientRef.current.send("/app/selection", {}, JSON.stringify(initialPresencePayload));
    }
  }, [
    isConnected,
    sessionId,
    activeFileId,
    userId,
    userInfo.name,
    userInfo.color,
  ]); // Depend on connection and user info

  return { isConnected };
};
