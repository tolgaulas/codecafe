import { useState, useEffect, useRef, useCallback } from "react";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import {
  TextOperation,
  MonacoAdapter,
  OTSelection,
  Client,
  IClientCallbacks,
  offsetToPosition,
} from "../ot/TextOperationSystem";
import {
  RemoteUser,
  UseCollaborationSessionProps,
  UseCollaborationSessionReturn,
} from "../types/props";

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
  const currentFileIdRef = useRef<string | null>(null);
  const subscribedWebViewOpsRef = useRef<Set<string>>(new Set());

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
      handleConnectionStatusChange(false);
      // Reset OT state on error
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
      subscriptionsRef.current = [];
    },
    [onError, handleConnectionStatusChange]
  );

  useEffect(() => {
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
          clientRef.current = null;
          adapterRef.current?.detach();
          adapterRef.current = null;
          subscriptionsRef.current = []; // Clear subscriptions on disconnect
        }, {});
      } else if (isConnected) {
        handleConnectionStatusChange(false);
      }
      currentFileIdRef.current = null;
      return;
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

    // Unsubscribe from previous file topics if any
    subscriptionsRef.current.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (e) {
        console.warn("Error unsubscribing:", e);
      }
    });
    subscriptionsRef.current = [];

    // Do NOT disconnect if we're connecting for the *first* time in this hook instance
    if (stompClientRef.current?.connected) {
      console.warn(
        "[useCollaborationSession Setup] Stomp client already connected during setup? Disconnecting first."
      );
      stompClientRef.current.disconnect(() => {
        console.log(
          "[useCollaborationSession STOMP] Disconnected before reconnecting for new file/session."
        );
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

    console.log("[useCollaborationSession Setup] Connecting via SockJS...");
    const socket = new SockJS("http://localhost:8080/ws");
    const stompClient = Stomp.over(socket);
    stompClient.debug = () => {}; // Suppress STOMP debug logs in console
    stompClientRef.current = stompClient;

    if (editorInstance && !adapterRef.current) {
      console.log(
        `[useCollaborationSession Setup] Initializing MonacoAdapter for ${activeFileId}`
      );
      adapterRef.current = new MonacoAdapter(editorInstance);
    } else if (editorInstance && adapterRef.current) {
      adapterRef.current.detach();
      adapterRef.current = new MonacoAdapter(editorInstance);
      console.log(
        `[useCollaborationSession Setup] Re-initializing MonacoAdapter for ${activeFileId}`
      );
    }

    stompClient.connect(
      {},
      (frame: any) => {
        console.log(
          `[useCollaborationSession STOMP Connected] Frame: ${frame}, Session: ${sessionId}, File: ${activeFileId}`
        );
        handleConnectionStatusChange(true);

        const joinPayload = {
          sessionId: sessionId,
          documentId: activeFileId,
          userId: userId,
          userName: userInfo.name.trim(),
          userColor: userInfo.color,
        };
        console.log("Sending explicit /app/join message", joinPayload);
        stompClient.send("/app/join", {}, JSON.stringify(joinPayload));

        const clientCallbacks: IClientCallbacks = {
          sendOperation: (revision: number, operation: TextOperation) => {
            if (
              stompClientRef.current?.connected &&
              sessionId &&
              currentFileIdRef.current
            ) {
              const payload = {
                documentId: currentFileIdRef.current,
                clientId: userId,
                revision: revision,
                operation: operation.toJSON(),
                sessionId: sessionId,
              };
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
                documentId: currentFileIdRef.current,
                sessionId: sessionId,
                userInfo: {
                  id: userId,
                  name: userInfo.name.trim(),
                  color: userInfo.color,
                  cursorPosition: cursorPosition,
                  selection: selection?.toJSON() ?? null,
                },
              };
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
            adapterRef.current?.applyOperation(operation);

            if (currentFileIdRef.current) {
              onOperationReceived(currentFileIdRef.current, operation);
            }
          },
          getSelection: () => {
            return adapterRef.current?.getSelection() ?? null;
          },
          setSelection: (selection: OTSelection | null) => {
            adapterRef.current?.setSelection(selection);
          },
        };

        // Subscribe to topics for the *current* active file
        const currentFileId = activeFileId;
        const newSubscriptions: Stomp.Subscription[] = [];
        const currentWebViewSubscriptions = new Set<string>();

        // Document State Handling (Only for Active File)
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
                onRemoteUsersUpdate(state.documentId, []);
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

                // Notify App component of initial state (updates Zustand store)
                onStateReceived(
                  state.documentId,
                  state.document,
                  state.revision,
                  processedParticipants
                );

                // Directly update the Monaco Editor via the Adapter IF it's the active document
                if (
                  state.documentId === currentFileIdRef.current &&
                  adapterRef.current &&
                  editorInstance
                ) {
                  const currentEditorValue = editorInstance
                    .getModel()
                    ?.getValue();
                  if (currentEditorValue !== state.document) {
                    console.log(
                      `   Updating Monaco editor content for ${state.documentId} from initial state.`
                    );
                    adapterRef.current.ignoreNextChange = true; // Prevent loopback
                    try {
                      editorInstance.setValue(state.document);
                    } catch (error) {
                      console.error(
                        "Error setting editor value from initial state:",
                        error
                      );
                      adapterRef.current.ignoreNextChange = false;
                    }
                  } else {
                    console.log(
                      `   Editor content for ${state.documentId} already matches initial state.`
                    );
                  }
                }

                if (adapterRef.current) {
                  console.log(
                    `   Registering Adapter Callbacks for ${state.documentId}`
                  );
                  adapterRef.current.registerCallbacks({
                    change: (op: TextOperation) => {
                      if (!clientRef.current) {
                        console.error(
                          `[Adapter Callback] Error: clientRef is null when change occurred for ${currentFileIdRef.current}`
                        );
                        return;
                      }
                      clientRef.current?.applyClient(op); // Send op to server state machine
                    },
                    selectionChange: () => {
                      clientRef.current?.selectionChanged();
                    },
                    blur: () => {
                      clientRef.current?.blur();
                    },
                  });
                } else {
                  console.error(
                    `[useCollaborationSession State] Cannot register adapter callbacks, adapterRef is null for ${state.documentId}`
                  );
                }
              } else {
                console.warn(
                  `[Server -> Client State] Received state for ${state.documentId} after client init. Rev: ${state.revision}, ClientRev: ${clientRef.current.revision}`
                );
                onRemoteUsersUpdate(state.documentId, processedParticipants);
              }
            } catch (error) {
              handleError(`Error processing document-state message: ${error}`);
            }
          })
        );

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

            if (sessionOfOp !== sessionId) {
              console.warn(
                `Ignoring op for session ${sessionOfOp} (current: ${sessionId})`
              );
              return;
            }

            try {
              const operationForClient = TextOperation.fromJSON(opData);

              // Logic for Local vs Remote Ops
              if (sourceClientId === userId) {
                if (webViewFileIds?.includes(docId)) {
                  onOperationReceived(docId, operationForClient);
                }
              } else {
                if (docId === currentFileIdRef.current) {
                  if (clientRef.current) {
                    clientRef.current.applyServer(operationForClient);
                  } else {
                    console.warn(
                      `[Server -> Client Op] Received op for active file ${docId} before client init.`
                    );
                  }
                } else if (webViewFileIds?.includes(docId)) {
                  onOperationReceived(docId, operationForClient);
                }
              }
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
        subscribedWebViewOpsRef.current.add(currentFileId);

        // Subscribe to WebView File Operations
        webViewFileIds?.forEach((webViewFileId) => {
          if (webViewFileId !== currentFileId) {
            const webViewOpTopic = `/topic/sessions/${sessionId}/operations/document/${webViewFileId}`;
            console.log(
              `[useCollaborationSession STOMP Setup] Subscribing to WebView Operations topic: ${webViewOpTopic}`
            );
            newSubscriptions.push(
              stompClient.subscribe(webViewOpTopic, handleIncomingOperation)
            );
            currentWebViewSubscriptions.add(webViewFileId);
          }
        });
        subscribedWebViewOpsRef.current = currentWebViewSubscriptions;

        // Selections Handling (Only for Active File)
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
              if (remoteUserInfo.id === userId) return;
              if (documentId !== currentFileIdRef.current) return;

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
      }
    );

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
          handleConnectionStatusChange(false);
        }, {});
      }
      // Reset refs specific to this connection attempt
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
      currentFileIdRef.current = null; // Clear tracked file ID
      console.log(`[useCollaborationSession Cleanup] Finished effect cleanup.`);
    };

    // Dependencies: Re-run when session/file changes, or editor becomes available/unavailable
  }, [
    isSessionActive,
    sessionId,
    activeFileId,
    editorInstance,
    userId,
    userInfo.name,
    userInfo.color,
    onStateReceived,
    onOperationReceived,
    onRemoteUsersUpdate,
    handleConnectionStatusChange,
    handleError,
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
      clientRef.current?.selectionChanged();
    }
  }, [
    isConnected,
    sessionId,
    activeFileId,
    userId,
    userInfo.name,
    userInfo.color,
  ]);

  return { isConnected };
};
