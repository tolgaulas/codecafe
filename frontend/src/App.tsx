import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import { Theme } from "@radix-ui/themes";
import "react-resizable/css/styles.css";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import { VscRunAll } from "react-icons/vsc";
import { VscSettings } from "react-icons/vsc";
import { IoStarOutline } from "react-icons/io5";
import { IoStar } from "react-icons/io5";
import SlideMenu from "./components/SlideMenu";
import { debounce } from "lodash";
import ReactLoading from "react-loading";
import ShareProfile from "./components/ShareProfile";
import SettingsWindow from "./components/SettingsWindow";
import {
  TextOperation,
  MonacoAdapter,
  OTSelection,
  Client,
} from "./TextOperationSystem";
import { User } from "./types/user";
import { CodeExecutionRequest, CodeExecutionResponse } from "./types/code";
import { CursorData } from "./types/cursorData";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";
import { THEMES } from "./constants/themes";
import { simulateRapidTyping } from "./simulateRapidTyping";
import { v4 as uuidv4 } from "uuid";
import { editor, IRange, Selection, Position } from "monaco-editor";

const App = () => {
  const [code, setCode] = useState<string>("// Loading document...");
  const [editorHeight, setEditorHeight] = useState(window.innerHeight);
  const [users, setUsers] = useState<User[]>([]);
  const [isEditorLoading, setIsEditorLoading] = useState(true);
  const codeCafeRef = useRef<HTMLDivElement | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSessionCreator, setIsSessionCreator] = useState(false);
  const [editorLanguage, setEditorLanguage] =
    useState<keyof typeof LANGUAGE_VERSIONS>("javascript");

  const [id] = useState<string>(() => "user-" + uuidv4());
  const [name, setName] = useState<string>("User " + id.substring(5, 9));
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState<string>(getRandomColor());
  const [starredEnabled, setStarredEnabled] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<keyof typeof THEMES>("codeCafeTheme");

  const [fontSize, setFontSize] = useState<string>("16");
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isJoiningSession, setIsJoiningSession] = useState<boolean>(false);
  const [sessionCreatorName, setSessionCreatorName] = useState<string>("");

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const adapterRef = useRef<MonacoAdapter | null>(null);
  const clientRef = useRef<Client | null>(null);

  const nameRef = useRef(name);
  const colorRef = useRef(color);

  useEffect(() => {
    nameRef.current = name;
    setDisplayName(name);
  }, [name]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  function getRandomColor() {
    let letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  const stompClientRef = useRef<Stomp.Client | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const terminalRef = useRef<{ writeToTerminal: (text: string) => void }>(null);
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const handleEditorDidMount = (
    editorInstance: editor.IStandaloneCodeEditor
  ) => {
    editorRef.current = editorInstance;
    console.log("Monaco Editor Mounted");
    setIsEditorLoading(false);
  };

  const handleCodeChange = (newCode: string) => {};

  const debouncedSendSelection = useCallback(
    debounce((selection: OTSelection | null) => {
      if (clientRef.current) {
        clientRef.current.sendSelection(selection);
      }
    }, 100),
    []
  );

  const handleEditorSelectionChange = () => {
    if (!adapterRef.current) return;
    const currentSelection = adapterRef.current.getSelection();
    debouncedSendSelection(currentSelection);
  };

  useEffect(() => {
    if (!isSessionActive || !editorRef.current) {
      if (stompClientRef.current?.connected) {
        stompClientRef.current.disconnect(() =>
          console.log("Disconnected due to inactive session or missing editor")
        );
        stompClientRef.current = null;
        clientRef.current = null;
        adapterRef.current?.detach();
        adapterRef.current = null;
        setCode("// Session ended or editor not ready.");
      }
      return;
    }

    console.log(`Session active (ID: ${sessionId}), connecting WebSocket...`);
    setCode("// Connecting to session...");

    const socket = new SockJS("http://157.230.83.211:8080/ws");
    const stompClient = Stomp.over(socket);
    stompClientRef.current = stompClient;

    if (!adapterRef.current && editorRef.current) {
      console.log("Initializing MonacoAdapter");
      adapterRef.current = new MonacoAdapter(editorRef.current);
    }

    let subscriptions: Stomp.Subscription[] = [];

    stompClient.connect(
      {},
      (frame: any) => {
        console.log("STOMP Connected: " + frame);

        const clientCallbacks = {
          sendOperation: (revision: number, operation: TextOperation) => {
            if (stompClientRef.current?.connected) {
              console.log(
                `Client -> Server: Sending op @ rev ${revision}`,
                operation.toJSON()
              );
              const payload = {
                clientId: id,
                revision: revision,
                operation: operation.toJSON(),
              };
              stompClientRef.current.send(
                "/app/operation",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.error("Cannot send operation - STOMP not connected");
            }
          },
          sendSelection: (selection: OTSelection | null) => {
            if (stompClientRef.current?.connected) {
              console.log(
                `Client -> Server: Sending selection`,
                selection?.toJSON()
              );
              const payload = {
                clientId: id,
                selection: selection?.toJSON() ?? null,
              };
              stompClientRef.current.send(
                "/app/selection",
                {},
                JSON.stringify(payload)
              );
            } else {
              console.warn("Cannot send selection - STOMP not connected");
            }
          },
          applyOperation: (operation: TextOperation) => {
            console.log(
              "Client -> Editor: Applying operation:",
              operation.toString()
            );
            adapterRef.current?.applyOperation(operation);
          },
          getSelection: () => {
            return adapterRef.current?.getSelection() ?? null;
          },
          setSelection: (selection: OTSelection | null) => {
            adapterRef.current?.setSelection(selection);
          },
        };

        subscriptions.push(
          stompClient.subscribe("/topic/document-state", (message: any) => {
            const state = JSON.parse(message.body);
            console.log("Server -> Client: Received document state:", state);

            if (!clientRef.current) {
              console.log(
                `Initializing Client with revision ${state.revision}`
              );
              clientRef.current = new Client(
                state.revision,
                id,
                clientCallbacks
              );

              if (editorRef.current) {
                const model = editorRef.current.getModel();
                if (model && model.getValue() !== state.document) {
                  console.log("Setting initial document content.");
                  if (adapterRef.current)
                    adapterRef.current["ignoreNextChange"] = true;
                  model.setValue(state.document);
                }
              }

              adapterRef.current?.registerCallbacks({
                change: (op: TextOperation, inverse: TextOperation) => {
                  console.log("Editor -> Client: applyClient called");
                  clientRef.current?.applyClient(op);
                },
                selectionChange: () => {
                  console.log("Editor -> Client: selectionChanged called");
                  clientRef.current?.selectionChanged();
                },
                blur: () => {
                  console.log("Editor -> Client: blur called");
                  clientRef.current?.blur();
                },
              });
            } else {
              console.warn(
                "Received document state after client initialization - potential desync? Check revision:",
                state.revision,
                "Client rev:",
                clientRef.current.revision
              );
              if (clientRef.current.revision !== state.revision) {
                console.warn(
                  `Revision mismatch. Resetting client to revision ${state.revision}`
                );
                clientRef.current.revision = state.revision;
                if (editorRef.current) {
                  const model = editorRef.current.getModel();
                  if (model && model.getValue() !== state.document) {
                    if (adapterRef.current)
                      adapterRef.current["ignoreNextChange"] = true;
                    model.setValue(state.document);
                  }
                }
              }
            }
            setCode(state.document);
          })
        );

        subscriptions.push(
          stompClient.subscribe("/topic/operations", (message: any) => {
            const payload = JSON.parse(message.body);
            if (!payload || !payload.clientId || !payload.operation) {
              console.error(
                "Received invalid operation message:",
                message.body
              );
              return;
            }
            console.log(
              `Server -> Client: Received operation from ${payload.clientId}:`,
              payload.operation
            );

            if (payload.clientId === id) {
              console.log("Ignoring own operation broadcast.");
              return;
            }

            if (clientRef.current) {
              try {
                const operation = TextOperation.fromJSON(payload.operation);
                clientRef.current.applyServer(operation);
              } catch (e) {
                console.error(
                  "Error applying server operation:",
                  e,
                  payload.operation
                );
              }
            } else {
              console.warn("Received operation before client initialization.");
            }
          })
        );

        subscriptions.push(
          stompClient.subscribe("/topic/selections", (message: any) => {
            const payload = JSON.parse(message.body);
            if (!payload || !payload.clientId) {
              console.error(
                "Received invalid selection message:",
                message.body
              );
              return;
            }
            console.log(
              `Server -> Client: Received selection from ${payload.clientId}:`,
              payload.selection
            );

            if (payload.clientId === id) {
              return;
            }

            if (clientRef.current && adapterRef.current) {
              const selection = payload.selection
                ? OTSelection.fromJSON(payload.selection)
                : null;
              if (selection) {
                try {
                  const transformedSelection =
                    clientRef.current.transformSelection(selection);
                  console.log(
                    `Transformed selection for ${payload.clientId}:`,
                    transformedSelection.toJSON()
                  );
                } catch (e) {
                  console.error(
                    "Error transforming remote selection:",
                    e,
                    payload.selection
                  );
                }
              } else {
              }
            } else {
              console.warn(
                "Received selection before client/adapter initialization."
              );
            }
          })
        );

        const ackTopic = `/topic/ack/${id}`;
        console.log("Subscribing to ACK topic:", ackTopic);
        subscriptions.push(
          stompClient.subscribe(ackTopic, (message: any) => {
            console.log("Server -> Client: Received ACK");
            if (message.body === "ack") {
              clientRef.current?.serverAck();
            } else {
              console.warn("Received unexpected ACK message:", message.body);
            }
          })
        );

        console.log("Requesting initial document state...");
        stompClient.send("/app/get-document-state", {}, "");
      },
      (error: any) => {
        console.error("STOMP Connection Error: ", error);
        setCode("// Connection failed. Please refresh or try again.");
        setIsSessionActive(false);
      }
    );

    return () => {
      console.log("Cleaning up WebSocket connection...");
      subscriptions.forEach((sub) => sub.unsubscribe());
      subscriptions = [];
      if (stompClientRef.current?.connected) {
        stompClientRef.current.disconnect(() =>
          console.log("STOMP Disconnected")
        );
      }
      stompClientRef.current = null;
      clientRef.current = null;
      adapterRef.current?.detach();
      adapterRef.current = null;
    };
  }, [isSessionActive, id, sessionId]);

  const handleRunCode = async () => {
    setIsLoading(true);
    try {
      const currentCode = editorRef.current?.getValue() || codeRef.current;
      const requestBody: CodeExecutionRequest = {
        language: editorLanguage,
        version: LANGUAGE_VERSIONS[editorLanguage].version,
        files: [{ content: currentCode }],
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
        ? `${response.data.run.stdout}\nError: ${response.data.run.stderr}`
        : response.data.run.stdout;
      if (executionOutput !== "") {
        terminalRef.current?.writeToTerminal(executionOutput);
      }
    } catch (error) {
      const errorOutput = `Error: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`;
      terminalRef.current?.writeToTerminal(errorOutput);
    } finally {
      setIsLoading(false);
    }
  };

  let isScrolling = false;
  const handleCursorPositionChange = (lineNumber: number) => {
    const editorElement = document.querySelector(".monaco-editor");
    if (!editorElement) return;

    const lineHeight =
      editorRef.current?.getOption(editor.EditorOption.lineHeight) || 19;
    const cursorPositionFromTop = lineNumber * lineHeight;
    const dynamicThreshold = window.scrollY + window.innerHeight * 0.52;

    if (isScrolling) return;

    if (cursorPositionFromTop > dynamicThreshold) {
      isScrolling = true;
      window.scrollBy({ top: 5 * lineHeight, behavior: "smooth" });
      setTimeout(() => {
        isScrolling = false;
      }, 200);
    } else if (
      cursorPositionFromTop <
      window.scrollY - window.innerHeight * 0.15
    ) {
      isScrolling = true;
      window.scrollBy({ top: -5 * lineHeight, behavior: "smooth" });
      setTimeout(() => {
        isScrolling = false;
      }, 200);
    }
  };

  const scrollToTop = () => {
    if (codeCafeRef.current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionIdFromUrl = url.searchParams.get("session");
    if (sessionIdFromUrl) {
      setSessionId(sessionIdFromUrl);
      setIsJoiningSession(true);
      axios
        .get(`http://157.230.83.211:8080/api/sessions/${sessionIdFromUrl}`)
        .then((response) => {
          setSessionCreatorName(response.data.creatorName);
        })
        .catch((error) => {
          console.error("Error fetching session info:", error);
          alert("Invalid or expired session link");
          setSessionId(null);
          setIsJoiningSession(false);
          window.history.replaceState({}, "", window.location.pathname);
        });
    }
  }, []);

  const startSession = async () => {
    try {
      const response = await axios.post(
        "http://157.230.83.211:8080/api/sessions/create",
        {
          creatorName: name || "Anonymous",
        }
      );
      const newSessionId = response.data.sessionId;
      setSessionId(newSessionId);
      setIsSessionCreator(true);
      setIsJoiningSession(false);
      const url = new URL(window.location.href);
      url.searchParams.set("session", newSessionId);
      window.history.pushState({}, "", url.toString());
      setIsSessionActive(true);
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Failed to create session. Please try again.");
    }
  };

  const joinSession = () => {
    if (!sessionId) return;
    setIsSessionActive(true);
    setIsJoiningSession(false);
  };

  const handleSimulateTyping = () => {
    if (editorRef.current && adapterRef.current && clientRef.current) {
      const textToSimulate =
        "Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello ";
      const simulationDelay = 5;
      simulateRapidTyping(
        editorRef.current,
        adapterRef.current,
        textToSimulate,
        simulationDelay
      );
    } else {
      console.warn(
        "Cannot simulate typing: Editor, Adapter, or Client not ready."
      );
    }
  };

  return (
    <Theme appearance="dark" accentColor="bronze" radius="large">
      <div className="bg-gradient-to-b from-stone-800 to-stone-600 fixed top-0 left-0 right-0 h-screen z-0" />
      {isEditorLoading && (
        <div className="absolute inset-0 flex justify-center items-center z-50 bg-stone-800 bg-opacity-80">
          <ReactLoading type="spin" color="#a8a29e" height={80} width={80} />
        </div>
      )}
      <SettingsWindow
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentLanguage={editorLanguage}
        onLanguageChange={(lang) =>
          setEditorLanguage(lang as keyof typeof LANGUAGE_VERSIONS)
        }
        availableLanguages={Object.entries(LANGUAGE_VERSIONS).map(
          ([key, value]) => ({ value: key, label: value.name })
        )}
        currentTheme={theme}
        onThemeChange={setTheme}
        currentFontSize={fontSize}
        onFontSizeChange={setFontSize}
        currentWordWrap={wordWrap}
        onWordWrapChange={setWordWrap}
        currentShowLineNumbers={showLineNumbers}
        onShowLineNumbersChange={setShowLineNumbers}
      />
      <div
        className={`${
          isEditorLoading ? "opacity-0 pointer-events-none" : "opacity-100"
        } transition-opacity duration-500`}
      >
        <SlideMenu />
        <div
          className="items-center justify-center p-4 relative flex flex-col min-h-screen"
          ref={codeCafeRef}
        >
          <div className="fixed top-0 left-0 w-full h-12 bg-gradient-to-b from-stone-800 via-stone-800 to-transparent py-2 px-4 z-40 outline-none flex flex-row" />
          <div className="fixed top-0 left-0 w-full py-2 px-4 z-50 outline-none flex flex-row items-center mt-[1px]">
            <div
              className="relative h-8 w-auto cursor-pointer -ml-2"
              onClick={scrollToTop}
            >
              <img
                src="image-1.png"
                alt="CodeCafe Logo"
                className="absolute top-0 left-0 p-1 h-[35px] transition-opacity duration-300 ease-in-out opacity-100 hover:opacity-0 -mt-[1px] ml-[1px]"
              />
              <img
                src="image-light.png"
                alt="CodeCafe Logo Hover"
                className="absolute top-0 left-0 p-1 h-[35px] transition-opacity duration-300 ease-in-out opacity-0 hover:opacity-100 -mt-[1px] ml-[1px]"
              />
            </div>
            <button
              className="flex items-center justify-center p-2 rounded-md transition-all duration-200 bg-transparent hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRunCode}
              disabled={isLoading || !isSessionActive}
              title={
                !isSessionActive
                  ? "Start or join a session to run code"
                  : "Run Code"
              }
            >
              {isLoading ? (
                <ReactLoading
                  type="spin"
                  color="#a8a29e"
                  height={18}
                  width={18}
                />
              ) : (
                <VscRunAll className="text-lg" />
              )}
            </button>
            <button
              className="flex items-center justify-center p-2 rounded-md transition-all duration-200 bg-transparent hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400 disabled:!isSessionActive || !editorRef.current"
              onClick={() => setTimeout(handleSimulateTyping, 2000)}
              disabled={!isSessionActive || !editorRef.current}
              title={
                !isSessionActive || !editorRef.current
                  ? "Start session and wait for editor"
                  : "Simulate Typing"
              }
            >
              Simulate
            </button>
            <div className="flex-grow"></div>
            <ShareProfile
              onNameChange={(newName) => setName(newName)}
              onColorChange={setColor}
              users={users}
              onStartSession={startSession}
              isSessionActive={isSessionActive}
              sessionId={sessionId}
              isJoiningSession={isJoiningSession}
              sessionCreatorName={sessionCreatorName}
              onJoinSession={joinSession}
              isSessionCreator={isSessionCreator}
              currentUserName={displayName || name}
              currentUserColor={color}
            />
            <button
              onClick={() => setStarredEnabled(!starredEnabled)}
              className="flex items-center justify-center p-2 rounded-md transition-all duration-200 bg-transparent hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400 ml-1"
            >
              {starredEnabled ? <IoStar /> : <IoStarOutline />}
            </button>
            <button
              className="flex items-center justify-center p-2 rounded-md transition-all duration-200 bg-transparent hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400 ml-1 -mr-2"
              onClick={() => setIsSettingsOpen(true)}
            >
              <VscSettings />
            </button>
          </div>
          <div className="relative flex flex-col items-center w-full md:w-[950px] sm:w-[85%] mt-16">
            <div
              className="relative bg-neutral-900/70 rounded-t-lg border border-neutral-800/50 w-full shadow-lg"
              style={{ height: `${editorHeight}px` }}
            >
              <CodeEditor
                code={code}
                onCodeChange={handleCodeChange}
                users={users}
                onCursorPositionChange={handleCursorPositionChange}
                onLoadingChange={setIsEditorLoading}
                language={editorLanguage}
                theme={theme}
                fontSize={fontSize}
                wordWrap={wordWrap}
                showLineNumbers={showLineNumbers}
                onEditorDidMount={handleEditorDidMount}
              />
            </div>
            <div className="w-full mt-[-1px]">
              <Terminal ref={terminalRef} />
            </div>
          </div>
        </div>
      </div>
    </Theme>
  );
};

export default App;
