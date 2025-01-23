import { useRef, useState } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";

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

const App: React.FC = () => {
  const [code, setCode] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const terminalRef = useRef<{ writeToTerminal: (text: string) => void }>(null);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

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

      setOutput(executionOutput);
      // Write directly to terminal
      terminalRef.current?.writeToTerminal(executionOutput);
    } catch (error) {
      const errorOutput = `Error: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`;
      setOutput(errorOutput);
      // Write errors directly to terminal
      terminalRef.current?.writeToTerminal(errorOutput);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 h-screen w-full flex flex-col p-6">
      {/* Header with run button */}
      <div className="flex justify-center mb-6">
        <button
          className={`px-6 py-2 rounded-lg shadow-md transition-colors duration-200 font-medium
            ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          onClick={handleRunCode}
          disabled={isLoading}
        >
          {isLoading ? "Running..." : "Run Code"}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-grow flex justify-between gap-6">
        {/* Code editor panel */}
        <div className="w-1/2 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 flex flex-col">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">Editor</h2>
          </div>
          <div className="flex-grow p-4">
            <div className="h-full">
              <CodeEditor onCodeChange={handleCodeChange} />
            </div>
          </div>
        </div>

        {/* Terminal panel */}
        <div className="w-1/2 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 flex flex-col">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">Terminal</h2>
          </div>
          <div className="flex-grow p-4">
            <div className="h-full">
              <Terminal ref={terminalRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
