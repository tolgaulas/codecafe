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
        stompClientRef.current.disconnect(() => {
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
      return;
    }

    currentFileIdRef.current = activeFileId; // Track the file we are connecting for

    // Unsubscribe from previous file topics if any
    subscriptionsRef.current.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (e) {}
    });
    subscriptionsRef.current = [];

    // Do NOT disconnect if we're connecting for the *first* time in this hook instance
    if (stompClientRef.current?.connected) {
      stompClientRef.current.disconnect(() => {
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

    const socketUrl = import.meta.env.VITE_BACKEND_URL + "/ws";
    const socket = new SockJS(socketUrl);
    const stompClient = Stomp.over(socket);
    stompClient.debug = () => {}; // Suppress STOMP debug logs in console
    stompClientRef.current = stompClient;

    // Ensure the editor model is ready before creating the adapter
    const editorModel = editorInstance?.getModel();
    if (editorInstance && editorModel && !adapterRef.current) {
      adapterRef.current = new MonacoAdapter(editorInstance);
    } else if (editorInstance && editorModel && adapterRef.current) {
      adapterRef.current.detach();
      adapterRef.current = new MonacoAdapter(editorInstance);
    } else if (!editorModel) {
      // Log a warning or handle the case where the model isn't ready yet
      console.warn(
        "[useCollaborationSession] Editor model not ready when trying to initialize adapter for file:",
        activeFileId
      );
      // Potentially retry after a short delay or wait for an event indicating model readiness
    }

    stompClient.connect(
      {},
      (_frame: any) => {
        handleConnectionStatusChange(true);

        const joinPayload = {
          sessionId: sessionId,
          documentId: activeFileId,
          userId: userId,
          userName: userInfo.name.trim(),
          userColor: userInfo.color,
        };
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

        // Subscribe to topics for the *current* active file AND webview files
        const currentFileId = activeFileId;
        const newSubscriptions: Stomp.Subscription[] = [];
        const filesToSubscribeState = new Set<string>([
          currentFileId,
          ...(webViewFileIds || []),
        ]);

        const handleIncomingState = (message: any) => {
          try {
            const state = JSON.parse(message.body);
            const docId = state.documentId;

            if (!docId) {
              console.error(
                "[State Handler] Invalid state message, missing documentId:",
                message.body
              );
              return;
            }

            // Process participants for this document
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
            }
            // Always update participants state via callback
            onRemoteUsersUpdate(docId, processedParticipants);

            // Always notify App component of the received state to update Zustand
            onStateReceived(
              docId,
              state.document,
              state.revision,
              processedParticipants
            );

            // --- OT Client Initialization & Editor Update (ONLY for the ACTIVE file) ---
            if (docId === currentFileIdRef.current) {
              // Initialize OT Client only if it doesn't exist for this specific file connection instance
              if (!clientRef.current) {
                clientRef.current = new Client(
                  state.revision,
                  userId,
                  clientCallbacks
                );

                // Directly update the Monaco Editor via the Adapter
                if (adapterRef.current && editorInstance) {
                  const currentEditorValue = editorInstance
                    .getModel()
                    ?.getValue();
                  if (currentEditorValue !== state.document) {
                    adapterRef.current.ignoreNextChange = true; // Prevent loopback
                    try {
                      // Use setValue to ensure entire content is replaced correctly
                      editorInstance.getModel()?.setValue(state.document);
                    } catch (error) {
                      console.error(
                        `[State Handler] Error setting editor value for ${docId}:`,
                        error
                      );
                      adapterRef.current.ignoreNextChange = false; // Ensure flag is reset on error
                    } finally {
                      // It's generally safer to reset the flag shortly after the operation
                      // Monaco might trigger changes asynchronously
                      setTimeout(() => {
                        if (adapterRef.current)
                          adapterRef.current.ignoreNextChange = false;
                      }, 0);
                    }
                  }
                }

                // Register OT callbacks *after* client is initialized and editor potentially updated
                if (adapterRef.current) {
                  adapterRef.current.registerCallbacks({
                    change: (op: TextOperation) => {
                      clientRef.current?.applyClient(op);
                    },
                    selectionChange: () => {
                      clientRef.current?.selectionChanged();
                    },
                    blur: () => {
                      clientRef.current?.blur();
                    },
                  });
                }
              } else {
                // If OT client *already* exists for this active file connection,
                // we might still need to handle edge cases or reconciliation,
                // but the primary state update happened via onStateReceived.
                // For now, we only initialized the client once per connection instance.
              }
            }
            // --- End OT Client & Editor Handling ---
          } catch (error) {
            handleError(
              `Error processing document-state message: ${
                error instanceof Error ? error.message : String(error)
              } Message: ${message.body}`
            );
          }
        };

        // Subscribe to state topics for all relevant files
        filesToSubscribeState.forEach((fileId) => {
          const stateTopic = `/topic/sessions/${sessionId}/state/document/${fileId}`;
          newSubscriptions.push(
            stompClient.subscribe(stateTopic, handleIncomingState)
          );
        });

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
        newSubscriptions.push(
          stompClient.subscribe(activeOpTopic, handleIncomingOperation)
        );
        subscribedWebViewOpsRef.current.add(currentFileId);

        // Subscribe to WebView File Operations
        webViewFileIds?.forEach((webViewFileId) => {
          if (webViewFileId !== currentFileId) {
            const webViewOpTopic = `/topic/sessions/${sessionId}/operations/document/${webViewFileId}`;
            newSubscriptions.push(
              stompClient.subscribe(webViewOpTopic, handleIncomingOperation)
            );
            subscribedWebViewOpsRef.current.add(webViewFileId);
          }
        });

        // Selections Handling (Only for Active File)
        const selectionTopic = `/topic/sessions/${sessionId}/selections/document/${currentFileId}`;
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
        newSubscriptions.push(
          stompClient.subscribe(ackTopic, (message: any) => {
            if (message.body === "ack") {
              clientRef.current?.serverAck();
            } else {
            }
          })
        );

        // Store subscriptions
        subscriptionsRef.current = newSubscriptions;

        // Request initial state FOR THE CURRENT ACTIVE FILE and WEBVIEW FILES
        const filesToRequest = new Set<string>([currentFileId]);
        webViewFileIds?.forEach((id) => filesToRequest.add(id));

        filesToRequest.forEach((fileId) => {
          stompClient.send(
            "/app/get-document-state",
            {},
            JSON.stringify({ documentId: fileId, sessionId: sessionId })
          );
        });
      }, // End onConnect
      (error: any) => {
        handleError(
          `[STOMP Error] Connection Failed for ${sessionId}/${activeFileId}: ${error}`
        );
      }
    );

    // Cleanup function for the effect
    return () => {
      subscriptionsRef.current.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch (e) {}
      });
      subscriptionsRef.current = [];

      if (stompClientRef.current?.connected) {
        stompClientRef.current.disconnect(() => {
          handleConnectionStatusChange(false);
        }, {});
      }
      // Reset refs specific to this connection attempt
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
      currentFileIdRef.current = null; // Clear tracked file ID
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
