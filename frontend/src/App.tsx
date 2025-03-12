import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import { Card, Theme } from "@radix-ui/themes";
import "react-resizable/css/styles.css";
import { ResizableBox, ResizeHandle } from "react-resizable";
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
import { Editor } from "@monaco-editor/react";

interface CodeExecutionRequest {
  language: string;
  version: string;
  files: { content: string }[];
}

interface CursorData {
  cursorPosition: {
    lineNumber: number;
    column: number;
  };
  selection: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
}

interface CodeExecutionResponse {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
}

interface User {
  id: string;
  name: string;
  color: string;
  cursorPosition: {
    lineNumber: number;
    column: number;
  };
  selection: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

interface TextOperation {
  baseVersion: number; // The doc version the operation is based on
  newText: string; // The entire updated text or just the diff, depending on your strategy
  userId: string;
}

const transformOperation = (
  _localOp: TextOperation,
  incomingOp: TextOperation
): TextOperation => {
  // localOp is replaced with incomingOp’s text. More advanced logic
  return {
    baseVersion: incomingOp.baseVersion + 1,
    newText: incomingOp.newText,
    userId: incomingOp.userId,
  };
};

const languageVersions = {
  typescript: { version: "1.32.3", name: "TypeScript" },
  javascript: { version: "1.32.3", name: "JavaScript" },
  python: { version: "3.10.0", name: "Python" },
  java: { version: "15.0.2", name: "Java" },
  c: { version: "10.2.0", name: "C" },
  cplusplus: { version: "10.2.0", name: "C++" },
  go: { version: "1.16.2", name: "Go" },
  rust: { version: "1.68.2", name: "Rust" },
  ruby: { version: "3.0.1", name: "Ruby" },
};

const App: React.FC = () => {
  const [code, setCode] = useState<string>("// Hello there");
  const [editorHeight, setEditorHeight] = useState(window.innerHeight);
  const [height, setHeight] = useState(window.innerHeight * 0.25);
  const [width, setWidth] = useState(window.innerWidth * 0.75);
  const [users, setUsers] = useState<User[]>([]);
  const [localVersion, setLocalVersion] = useState<number>(0); // track our local doc version
  const [pendingOps, setPendingOps] = useState<TextOperation[]>([]); // store ops that have not been Acked
  const [isEditorLoading, setIsEditorLoading] = useState(true);
  const codeCafeRef = useRef<HTMLDivElement | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [editorLanguage, setEditorLanguage] =
    useState<keyof typeof languageVersions>("python");

  const [id] = useState<string>(
    () => Date.now().toString() + Math.random().toString(36).substring(2)
  );
  const [name, setName] = useState<string>(Date.now().toString());
  const [displayName, setDisplayName] = useState(""); // For UI updates
  const [color, setColor] = useState<string>(getRandomColor());
  const [starredEnabled, setStarredEnabled] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const nameRef = useRef(name);
  const colorRef = useRef(color);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    console.log(name);
  }, [name]);

  function getRandomColor() {
    let letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // const id = Date.now().toString();
  // const name = Date.now().toString();

  const stompClientRef = useRef<Stomp.Client | null>(null);

  const screenSixteenth = {
    width: window.innerWidth * (1 / 16),
    height: window.innerHeight * (1 / 16),
  };

  // const socket = new SockJS("http://localhost:8080/ws");
  // const stompClient = Stomp.over(socket);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const terminalRef = useRef<{ writeToTerminal: (text: string) => void }>(null);
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // useEffect(() => console.log("User state: ", users), [users]);
  const debouncedSendUpdate = useCallback(
    debounce((op: TextOperation) => {
      if (isSessionActive && stompClientRef.current?.connected) {
        stompClientRef.current.send("/app/ot", {}, JSON.stringify(op));
      }
    }, 50),
    [isSessionActive] // Add isSessionActive as a dependency
  );

  const handleCodeChange = (newCode: string) => {
    if (code === newCode) return;

    const op: TextOperation = {
      baseVersion: localVersion,
      newText: newCode,
      userId: id,
    };

    setCode(newCode);
    setPendingOps((prevOps) => [...prevOps, op]);
    setLocalVersion((prev) => prev + 1);

    // Use debounced update for server communication
    debouncedSendUpdate(op);
  };

  // Update debouncedSendCursor to maintain previous selection
  // Add this state to track the local selection
  const [currentSelection, setCurrentSelection] =
    useState<CursorData["selection"]>(null);

  // Then modify the debouncedSendCursor function
  const debouncedSendCursor = useCallback(
    debounce((cursorData: CursorData) => {
      const message = {
        user: {
          id: id,
          name: nameRef.current,
          color: colorRef.current,
          cursorPosition: cursorData.cursorPosition,
          // Use local state instead of depending on users array
          selection: cursorData.selection,
        },
      };

      if (stompClientRef.current?.connected) {
        console.log("NAMES: ", name, displayName);
        console.log("Sending cursor data", message);
        stompClientRef.current.send("/app/cursor", {}, JSON.stringify(message));
      }
    }, 50),
    [isSessionActive, name, displayName, color]
  );

  const sendCursorData = (cursorData: CursorData) => {
    debouncedSendCursor(cursorData); // Use debounced update for server communication
  };

  useEffect(() => {
    const handleResize = () => {
      if (editorHeight < window.innerHeight) {
        setEditorHeight(window.innerHeight);
      }
      setHeight(window.innerHeight * 0.25);
      setWidth(window.innerWidth * 0.75);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Replace the entire WebSocket useEffect
  useEffect(() => {
    // Only establish connection if session is active
    if (isSessionActive) {
      const socket = new SockJS("http://localhost:8080/ws");
      const stompClient = Stomp.over(socket);

      stompClient.connect({}, function (frame: any) {
        console.log("Connected: " + frame);
        stompClientRef.current = stompClient;

        // Subscribe to topics
        stompClient.subscribe("/topic/ot", function (message: any) {
          const incomingOp = JSON.parse(message.body) as TextOperation;

          // Only apply changes if they're not from the current user
          if (incomingOp.userId !== id) {
            // Rest of your code handling OT operations...
            if (incomingOp.baseVersion >= localVersion) {
              if (codeRef.current !== incomingOp.newText) {
                setCode((prevCode) => {
                  if (prevCode === incomingOp.newText) return prevCode;
                  return incomingOp.newText;
                });
              }
              setLocalVersion(incomingOp.baseVersion);
            } else {
              setPendingOps((prevPending) => {
                return prevPending.map((op) =>
                  transformOperation(op, incomingOp)
                );
              });
              // Don't trigger a re-render if the text is the same
              if (codeRef.current !== incomingOp.newText) {
                setCode((prevCode) => {
                  if (prevCode === incomingOp.newText) return prevCode;
                  return incomingOp.newText;
                });
              }
              setLocalVersion(incomingOp.baseVersion);
            }
          }
        });

        stompClient.subscribe("/topic/cursors", function (message: any) {
          const cursorsData = JSON.parse(message.body);
          console.log(cursorsData, "CURSOR DATA");
          setUsers(cursorsData);
        });

        // IMPORTANT: Send an initial cursor message immediately after connection
        // const initialCursorMessage = {
        //   user: {
        //     id: id,
        //     name: name || displayName,
        //     color: color,
        //     cursorPosition: { lineNumber: 1, column: 1 },
        //     selection: null,
        //   },
        // };

        // stompClient.send(
        //   "/app/cursor",
        //   {},
        //   JSON.stringify(initialCursorMessage)
        // );
        // console.log("Sent initial cursor message after connection");
      });

      return () => {
        if (stompClient.connected) {
          stompClient.disconnect(() => console.log("Disconnected"));
        }
        if (socket.readyState === SockJS.OPEN) {
          socket.close();
        }
      };
    }

    // Clean up any existing connection when session becomes inactive
    return () => {
      if (stompClientRef.current?.connected) {
        stompClientRef.current.disconnect(() => console.log("Disconnected"));
        stompClientRef.current = null;
      }
    };
  }, [isSessionActive, id, name, displayName, color]);

  const handleRunCode = async () => {
    setIsLoading(true);
    try {
      const requestBody: CodeExecutionRequest = {
        language: editorLanguage,
        version: languageVersions[editorLanguage].version,
        files: [{ content: code }],
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
        ? `${response.data.run.stdout}\nError: ${response.data.run.stderr}`
        : response.data.run.stdout;
      // Write directly to terminal
      console.log(executionOutput);
      terminalRef.current?.writeToTerminal(executionOutput);
    } catch (error) {
      const errorOutput = `Error: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`;
      // Write errors directly to terminal
      terminalRef.current?.writeToTerminal(errorOutput);
    } finally {
      setIsLoading(false);
    }
  };

  let isScrolling = false; // Flag to track if a scroll action is in progress

  const handleCursorPositionChange = (lineNumber: number) => {
    const editorElement = document.querySelector(".monaco-editor");
    if (!editorElement) return;

    const lineHeight = 20; // Assume each line is 20px in height
    const cursorPositionFromTop = lineNumber * lineHeight;

    // Calculate the dynamic threshold: current scroll position + 50% of the viewport height
    const dynamicThreshold = window.scrollY + window.innerHeight * 0.52;

    // Only trigger height adjustment if the scroll action is not in progress
    if (isScrolling) return;

    // Scroll Down: If the cursor is below the threshold
    if (cursorPositionFromTop > dynamicThreshold) {
      // Mark the scroll action as in progress
      isScrolling = true;

      setEditorHeight((prevHeight) => {
        const newHeight = prevHeight + 5 * lineHeight;
        return newHeight;
      });

      window.scrollBy({
        top: 5 * lineHeight,
        behavior: "smooth",
      });

      // Reset the flag after a delay to prevent rapid triggering
      setTimeout(() => {
        isScrolling = false;
      }, 200); // Adjust delay (200ms) as needed
    }

    // Scroll Up: If the cursor is in the top 10% of the screen
    else if (
      cursorPositionFromTop <
      window.scrollY - window.innerHeight * 0.15
    ) {
      // Mark the scroll action as in progress
      isScrolling = true;

      window.scrollBy({
        top: -5 * lineHeight,
        behavior: "smooth",
      });

      // Reset the flag after a delay to prevent rapid triggering
      setTimeout(() => {
        isScrolling = false;
      }, 200); // Adjust delay (200ms) as needed
    }
  };

  const scrollToTop = () => {
    if (codeCafeRef.current) {
      window.scrollTo({
        top: 0,
        behavior: "smooth", // smooth scrolling
      });
    }
  };

  useEffect(() => {
    console.log("starredEnabled changed to:", starredEnabled);
  }, [starredEnabled]);

  // Add this function to start a session
  const startSession = () => {
    setIsSessionActive(true);

    // Force a cursor update after a short delay to ensure WebSocket is connected
    setTimeout(() => {
      debouncedSendCursor({
        cursorPosition: { lineNumber: 1, column: 1 },
        selection: null,
      });
    }, 500);
  };

  return (
    <Theme appearance="dark" accentColor="bronze" radius="large">
      <div className="bg-gradient-to-b from-stone-800 to-stone-600 fixed top-0 left-0 right-0 h-screen z-0" />
      {isEditorLoading && (
        <div className="absolute inset-0 flex justify-center items-center z-50">
          <ReactLoading
            type="spin"
            color="#57534e"
            height={100}
            width={80}
            delay={0}
          />
        </div>
      )}
      <SettingsWindow
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentLanguage={editorLanguage}
        onLanguageChange={(editorLanguage) => {
          // Cast is needed since TypeScript doesn't know that newLanguage is a valid key
          setEditorLanguage(editorLanguage as keyof typeof languageVersions);
        }}
        availableLanguages={Object.entries(languageVersions).map(
          ([key, value]) => ({
            value: key,
            label: value.name, // Using the name property from languageVersions
          })
        )}
      />
      <div className={`${isEditorLoading ? "hidden" : ""}`}>
        <SlideMenu />
        <div
          className="items-center justify-center p-4 relative flex flex-col h-max"
          ref={codeCafeRef}
        >
          <div className="fixed top-0 left-0 w-full h-12 bg-gradient-to-b from-stone-800 via-stone-800 to-transparent py-2 px-4 z-40 outline-none flex flex-row" />
          <div className="fixed top-0 left-0 w-full py-2 px-4 z-50 outline-none flex flex-row">
            <div
              className="relative h-8 w-auto cursor-pointer -ml-2"
              onClick={scrollToTop}
            >
              <img
                src="image-1.png"
                className="top-0 left-0 p-1 h-[33px] transition-opacity duration-300 ease-in-out opacity-100 hover:opacity-0"
              />
              <img
                src="image-light.png"
                className="absolute top-0 left-0 p-1 h-[33px] transition-opacity duration-300 ease-in-out opacity-0 hover:opacity-100"
              />
            </div>

            <button
              className="flex items-center justify-center p-2 rounded-md transition-all duration-200 bg-transparent hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400"
              onClick={() => {
                handleRunCode();
              }}
            >
              <VscRunAll className="text-lg" />
            </button>
            {/* <button className="flex ml-auto flex-row gap-1 items-center p-2 rounded-md transition-all duration-200 bg-transparent hover:bg-neutral-900 active:bg-neutral-950 active:scale-95 cursor-pointer text-lg text-stone-500 hover:text-stone-400">
              <GoPersonAdd />
              <span className="text-xs">Share</span>
            </button> */}
            <ShareProfile
              onNameChange={(newName: string) => setName(newName)}
              onColorChange={(color: string) => setColor(color)}
              users={users}
              onStartSession={startSession}
              isSessionActive={isSessionActive}
            />
            <button
              onClick={() => {
                setStarredEnabled(!starredEnabled);
                console.log(users);
              }}
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
          <div className="relative flex flex-col items-center w-full max-w-4xl">
            {/* Code Area - Added z-index to ensure hints are visible */}
            <div
              className=" absolute bg-neutral-900/70 rounded-t-xl border border-neutral-800/50 mt-32 w-[120%]"
              style={{
                height: `${editorHeight}px`,
                willChange: "transform",
              }}
            >
              <div className="p-6 h-full text-neutral-300">
                <CodeEditor
                  onCodeChange={handleCodeChange}
                  users={users}
                  onCursorPositionChange={handleCursorPositionChange}
                  code={code}
                  sendCursorData={sendCursorData}
                  onLoadingChange={setIsEditorLoading}
                  language={editorLanguage}
                />
              </div>
            </div>

            <div
              style={{
                position: "fixed",
                top: `${editorHeight}px`, // aligns right after the editor
                left: 0,
                right: 0,
                height: "200px",
                background: "rgba(55, 65, 81, 0.7)", // same background
                pointerEvents: "none",
                userSelect: "none",
                zIndex: -1, // behind the scroll container
              }}
            />

            {/* <div
              className="absolute bg-neutral-900/70 border-l border-r border-b border-neutral-800/50 w-[120%]"
              style={{
                left: "50%",
                transform: "translateX(-50%)",
                bottom: "0", // Attach to bottom instead of using top
                height: "200px", // Give it some height beyond the screen
                zIndex: 50,
              }}
            /> */}

            {/* Terminal */}
            {/* <Card className="bg-neutral-900/90 backdrop-blur-md rounded-t-xl border border-neutral-800/50 shadow-xl fixed bottom-0 left-0 ml-[25%] w-[300%]">
        <div className="p-4 h-64 font-mono text-green-400/80 overflow-auto">
          <Terminal />
        </div>
      </Card> */}

            <ResizableBox
              className="overflow-hidden overscroll-none"
              width={width}
              height={height}
              minConstraints={[
                Math.max(300, window.innerWidth * 0.7 - screenSixteenth.width),
                Math.max(
                  100,
                  window.innerHeight * 0.1 - screenSixteenth.height
                ),
              ]}
              maxConstraints={[
                Math.min(
                  window.innerWidth,
                  window.innerWidth * 0.75 + screenSixteenth.width
                ),
                Math.min(
                  window.innerHeight,
                  window.innerHeight * 0.35 + screenSixteenth.height
                ),
              ]}
              onResize={(e, { size }) => {
                setWidth(size.width);
                setHeight(size.height);
              }}
              resizeHandles={["w", "nw", "n"]}
              handle={(handleAxis, ref) => {
                const baseStyle = {
                  // position: "absolute",
                  background: "transparent",
                  // border: "2px solid rgba(200, 200, 200, 0.3)",
                  transform: "translate(-50%, -50%)",
                };

                // Custom styles for each handle
                const styles: Record<
                  ResizeHandle,
                  React.CSSProperties | undefined
                > = {
                  nw: {
                    ...baseStyle,
                    width: "5px",
                    height: "5px",
                    padding: "5px",
                  },
                  n: {
                    ...baseStyle,
                    width: `${width}px`,
                    height: "5px",
                    padding: "5px",
                    transform: "translate(-50%, -50%) translateX(15px)",
                  },
                  w: {
                    ...baseStyle,
                    width: "5px",
                    height: `${height}px`,
                    padding: "5px",
                    transform: "translate(-50%, -50%) translateY(15px)",
                  },
                  s: undefined,
                  e: undefined,
                  sw: undefined,
                  se: undefined,
                  ne: undefined,
                };

                return (
                  <div
                    ref={ref}
                    className={`react-resizable-handle react-resizable-handle-${handleAxis}`}
                    style={styles[handleAxis]}
                  />
                );
              }}
              style={{
                position: "fixed",
                bottom: 0,
                left: `calc(100vw - ${width}px)`,
                zIndex: 10,
              }}
            >
              <Card className="bg-neutral-900/70 backdrop-blur-md rounded-tl-2xl border border-neutral-800/50 shadow-xl overflow-auto overscroll-none">
                <div
                  className="p-4 font-mono text-green-400/80"
                  style={{ height, width }}
                >
                  <Terminal ref={terminalRef} />
                </div>
              </Card>
            </ResizableBox>
          </div>
        </div>
      </div>
    </Theme>
  );
};

export default App;
