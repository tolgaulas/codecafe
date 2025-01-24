import { useRef, useState } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import { Card, Theme } from "@radix-ui/themes";

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
  // const [isLoading, setIsLoading] = useState<boolean>(false);
  // const terminalRef = useRef<{ writeToTerminal: (text: string) => void }>(null);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  // const handleRunCode = async () => {
  //   setIsLoading(true);
  //   try {
  //     const requestBody: CodeExecutionRequest = {
  //       language: "javascript",
  //       version: "18.15.0",
  //       files: [{ content: code }],
  //     };

  //     const response = await axios.post<CodeExecutionResponse>(
  //       "http://localhost:8080/api/execute",
  //       requestBody,
  //       {
  //         headers: {
  //           "Content-Type": "application/json",
  //           Accept: "application/json",
  //         },
  //       }
  //     );

  //     const executionOutput = response.data.run.stderr
  //       ? `${response.data.run.stdout}\nError: ${response.data.run.stderr}`
  //       : response.data.run.stdout;
  //     // Write directly to terminal
  //     terminalRef.current?.writeToTerminal(executionOutput);
  //   } catch (error) {
  //     const errorOutput = `Error: ${
  //       error instanceof Error ? error.message : "Unknown error occurred"
  //     }`;
  //     // Write errors directly to terminal
  //     terminalRef.current?.writeToTerminal(errorOutput);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

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
  return (
    <Theme appearance="dark" accentColor="bronze" radius="large">
      <div className="bg-neutral-950 h-screen flex items-center justify-center p-4 relative">
        <div className="relative flex flex-col items-center h-screen w-full max-w-4xl">
          {/* Code Area - Added z-index to ensure hints are visible */}
          <Card className="bg-neutral-900/70 backdrop-blur-md rounded-t-xl border border-neutral-800/50 shadow-2xl mt-32 w-[120%] h-full max-h-screen relative">
            <div className="p-6 h-full text-neutral-300 overflow-visible">
              <CodeEditor onCodeChange={handleCodeChange} users={users} />
            </div>
          </Card>

          {/* Terminal */}
          <Card className="bg-neutral-900/90 backdrop-blur-md rounded-t-xl border border-neutral-800/50 shadow-xl absolute bottom-0 left-0 ml-10 w-[300%]">
            <div className="p-4 h-64 font-mono text-green-400/80 overflow-auto">
              <Terminal />
            </div>
          </Card>
        </div>
      </div>
    </Theme>
  );
};

export default App;
