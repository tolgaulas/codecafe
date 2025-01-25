import { useEffect, useRef, useState } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import { Card, Theme } from "@radix-ui/themes";
import "react-resizable/css/styles.css";
import { ResizableBox } from "react-resizable";
import SockJS from "sockjs-client";
import Stomp from "stompjs";

interface CodeExecutionRequest {
  language: string;
  version: string;
  files: { content: string }[];
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

const users: User[] = [
  {
    id: "user1",
    name: "John",
    color: "#ff7800", // Orange
    cursorPosition: { lineNumber: 2, column: 10 },
    selection: {
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 3,
      endColumn: 15,
    },
  },
  {
    id: "user2",
    name: "Alice",
    color: "#00a2ff", // Blue
    cursorPosition: { lineNumber: 3, column: 10 },
    selection: {
      startLineNumber: 3,
      startColumn: 5,
      endLineNumber: 4,
      endColumn: 10,
    },
  },
];

const App: React.FC = () => {
  const [code, setCode] = useState<string>("");
  const [editorHeight, setEditorHeight] = useState(700);
  const [height, setHeight] = useState(window.innerHeight * 0.25);
  const [width, setWidth] = useState(window.innerWidth * 0.75);
  const screenSixteenth = {
    width: window.innerWidth * (1 / 16),
    height: window.innerHeight * (1 / 16),
  };

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const terminalRef = useRef<{ writeToTerminal: (text: string) => void }>(null);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  useEffect(() => {
    const handleResize = () => {
      setHeight(window.innerHeight * 0.25);
      setWidth(window.innerWidth * 0.75);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    const stompClient = Stomp.over(socket);

    stompClient.connect({}, function (frame: any) {
      console.log("Connected: " + frame);
      stompClient.subscribe("/topic/greetings", function (message: any) {
        console.log("Received: " + message.body);
      });
      stompClient.send("/app/hello", {}, JSON.stringify({ name: "John" }));
    });
  }, []);

  const handleRunCode = async () => {
    setIsLoading(true);
    try {
      const requestBody: CodeExecutionRequest = {
        language: "javascript",
        version: "18.15.0",
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

  // return (
  //   <div className="bg-gray-100 h-screen w-full flex flex-col p-6">
  //     {/* Header with run button */}
  //     <div className="flex justify-center mb-6">
  //       <button
  //         className={`px-6 py-2 rounded-lg shadow-md transition-colors duration-200 font-medium
  //           ${
  //             isLoading
  //               ? "bg-gray-400 cursor-not-allowed"
  //               : "bg-blue-600 hover:bg-blue-700 text-white"
  //           }`}
  //         onClick={handleRunCode}
  //         disabled={isLoading}
  //       >
  //         {isLoading ? "Running..." : "Run Code"}
  //       </button>
  //     </div>

  //     {/* Main content area */}
  //     <div className="flex-grow flex justify-between gap-6">
  //       {/* Code editor panel */}
  //       <div className="w-1/2 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 flex flex-col">
  //         <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
  //           <h2 className="text-sm font-medium text-gray-700">Editor</h2>
  //         </div>
  //         <div className="flex-grow p-4">
  //           <div className="h-full">
  //             <CodeEditor onCodeChange={handleCodeChange} users={users} />
  //           </div>
  //         </div>
  //       </div>

  //       {/* Terminal panel */}
  //       <div className="w-1/2 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 flex flex-col">
  //         <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
  //           <h2 className="text-sm font-medium text-gray-700">Terminal</h2>
  //         </div>
  //         <div className="flex-grow p-4">
  //           <div className="h-full">
  //             <Terminal ref={terminalRef} />
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  // );

  const handleCursorPositionChange = (lineNumber: number) => {
    const editorElement = document.querySelector(".monaco-editor");
    if (!editorElement) return;

    const cursorPositionFromTop = lineNumber * 20;

    console.log("Current Height:", editorHeight); // Debug log

    // Calculate the dynamic threshold: current scroll position + 75% of the viewport height
    const dynamicThreshold = window.scrollY + window.innerHeight * 0.5;

    if (cursorPositionFromTop > dynamicThreshold) {
      setEditorHeight((prevHeight) => {
        const newHeight = prevHeight + 5 * 20;
        console.log("New Height:", newHeight); // Debug log
        return newHeight;
      });

      window.scrollBy({
        top: 5 * 20,
        behavior: "smooth",
      });
    }
  };

  return (
    <Theme appearance="dark" accentColor="bronze" radius="large">
      <div className="bg-gradient-to-b from-stone-950 to bg-stone-900 h-max flex items-center justify-center p-4 relative">
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={handleRunCode}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 shadow-md"
          >
            Test
          </button>
        </div>
        <div className="relative flex flex-col items-center w-full max-w-4xl">
          {/* Code Area - Added z-index to ensure hints are visible */}
          <Card
            className="bg-neutral-900/70 backdrop-blur-md rounded-t-xl border border-neutral-800/50 shadow-2xl mt-32 w-[120%] relative"
            style={{ height: `${editorHeight}px` }}
          >
            <div className="p-6 h-full text-neutral-300">
              <CodeEditor
                onCodeChange={handleCodeChange}
                users={users}
                onCursorPositionChange={handleCursorPositionChange}
              />
            </div>
          </Card>

          {/* Terminal */}
          {/* <Card className="bg-neutral-900/90 backdrop-blur-md rounded-t-xl border border-neutral-800/50 shadow-xl fixed bottom-0 left-0 ml-[25%] w-[300%]">
            <div className="p-4 h-64 font-mono text-green-400/80 overflow-auto">
              <Terminal />
            </div>
          </Card> */}

          <ResizableBox
            width={width}
            height={height}
            minConstraints={[
              Math.max(300, window.innerWidth * 0.75 - screenSixteenth.width),
              Math.max(100, window.innerHeight * 0.25 - screenSixteenth.height),
            ]}
            maxConstraints={[
              Math.min(
                window.innerWidth,
                window.innerWidth * 0.75 + screenSixteenth.width
              ),
              Math.min(
                window.innerHeight,
                window.innerHeight * 0.25 + screenSixteenth.height
              ),
            ]}
            onResize={(e, { size }) => {
              setWidth(size.width);
              setHeight(size.height);
            }}
            resizeHandles={["w", "nw", "n", "ne", "e", "se", "s", "sw"]}
            style={{
              position: "fixed",
              bottom: 0,
              left: `calc(100vw - ${width}px)`,
              zIndex: 10,
            }}
          >
            <Card className="bg-neutral-900/70 backdrop-blur-md rounded-t-xl border border-neutral-800/50 shadow-xl">
              <div
                className="p-4 font-mono text-green-400/80 overflow-auto"
                style={{ height, width }}
              >
                <Terminal ref={terminalRef} />
              </div>
            </Card>
          </ResizableBox>
        </div>
      </div>
    </Theme>
  );
};

export default App;
