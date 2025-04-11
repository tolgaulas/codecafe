import { useState, useRef } from "react";
import axios from "axios";
import CodeEditor from "./components/CodeEditor";
import TerminalComponent from "./components/TerminalComponent";
import { FaRegFolder } from "react-icons/fa";
import { VscAccount, VscLiveShare, VscSearch } from "react-icons/vsc";
import { VscFiles } from "react-icons/vsc";
import { VscSettingsGear } from "react-icons/vsc";
import { GrChatOption, GrShareOption } from "react-icons/gr";
import { HiOutlineShare } from "react-icons/hi2";
import { LANGUAGE_VERSIONS } from "./constants/languageVersions";

// Define types for code execution
interface CodeFile {
  content: string;
}

interface CodeExecutionRequest {
  language: string;
  version: string;
  files: CodeFile[];
}

interface CodeExecutionResponse {
  run: {
    stdout: string;
    stderr: string;
  };
}

// Define the Terminal ref interface
interface TerminalRef {
  writeToTerminal: (text: string) => void;
}

// Define type for language keys
type LanguageKey = keyof typeof LANGUAGE_VERSIONS;

const CodeEditorUI = () => {
  const [code, setCode] = useState(
    '// Start coding here\nfunction helloWorld() {\n  console.log("Hello, world!");\n}\n'
  );
  const [activeIcon, setActiveIcon] = useState("files");
  const [editorLanguage] = useState<LanguageKey>("javascript");

  // Create a ref for the terminal
  const terminalRef = useRef<TerminalRef>();

  // Handle code execution
  const handleRunCode = async () => {
    try {
      const requestBody: CodeExecutionRequest = {
        language: editorLanguage,
        version: LANGUAGE_VERSIONS[editorLanguage].version,
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
      if (executionOutput !== "") {
        console.log(executionOutput);
        terminalRef.current?.writeToTerminal(executionOutput);
      }
    } catch (error) {
      const errorOutput = `Error: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`;
      // Write errors directly to terminal
      terminalRef.current?.writeToTerminal(errorOutput);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-800 bg-opacity-80 p-2 border-b border-stone-600">
        <div className="flex items-center">
          <div className="flex space-x-2">
            <button className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent">
              File
            </button>
            <button className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent">
              Edit
            </button>
            <button className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent">
              View
            </button>
            <button
              className="px-2 py-1 text-sm rounded active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-200 hover:bg-transparent"
              onClick={handleRunCode}
            >
              Run
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-400 rounded-full flex items-center justify-center">
            <span className="text-stone-200">M</span>
          </div>
          <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-neutral-900 active:bg-stone-950 text-stone-500 hover:text-stone-400">
            <span className="text-sm">?</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer - Thinner with larger icons */}
        <div className="w-12 bg-stone-800 bg-opacity-60 flex flex-col justify-between py-2 border-r border-stone-600">
          {/* Top icons */}
          <div className="flex flex-col items-center space-y-3">
            <button
              className={`w-full flex justify-center py-1 ${
                activeIcon === "files"
                  ? "text-stone-100"
                  : "text-stone-500 hover:text-stone-200"
              }`}
              onClick={() => setActiveIcon("files")}
            >
              <VscFiles size={24} />
            </button>
            <button
              className={`w-full flex justify-center py-1 ${
                activeIcon === "search"
                  ? "text-stone-100"
                  : "text-stone-500 hover:text-stone-200"
              }`}
              onClick={() => setActiveIcon("search")}
            >
              <VscSearch size={24} />
            </button>
            <button
              className={`w-full flex justify-center py-1 ${
                activeIcon === "share"
                  ? "text-stone-100"
                  : "text-stone-500 hover:text-stone-200"
              }`}
              onClick={() => setActiveIcon("share")}
            >
              <GrShareOption size={26} />
            </button>
            <button
              className={`w-full flex justify-center py-1 ${
                activeIcon === "chat"
                  ? "text-stone-100"
                  : "text-stone-500 hover:text-stone-200"
              }`}
              onClick={() => setActiveIcon("chat")}
            >
              <GrChatOption size={24} />
            </button>
          </div>

          {/* Bottom icons - Account and Settings */}
          <div className="flex flex-col items-center space-y-3">
            <button
              className={`w-full flex justify-center py-1 ${
                activeIcon === "account"
                  ? "text-stone-100"
                  : "text-stone-500 hover:text-stone-200"
              }`}
              onClick={() => setActiveIcon("account")}
            >
              <VscAccount size={24} />
            </button>
            <button
              className={`w-full flex justify-center py-1 ${
                activeIcon === "settings"
                  ? "text-stone-100"
                  : "text-stone-500 hover:text-stone-200"
              }`}
              onClick={() => setActiveIcon("settings")}
            >
              <VscSettingsGear size={24} />
            </button>
          </div>
        </div>

        {/* File Tree */}
        <div className="w-48 bg-stone-800 bg-opacity-60 overflow-y-auto border-r border-stone-600">
          <div className="pl-4 py-2 text-xs text-stone-400">EXPLORER</div>
          <div className="w-full">
            <div className="flex items-center text-sm py-1 hover:bg-stone-700 cursor-pointer w-full pl-0">
              <span className="text-stone-300 w-full pl-4">index.html</span>
            </div>
            <div className="flex items-center text-sm py-1 bg-stone-700 cursor-pointer w-full pl-0 border border-stone-500">
              <span className="text-stone-200 w-full pl-4">script.js</span>
            </div>
            <div className="flex items-center text-sm py-1 hover:bg-stone-700 cursor-pointer w-full pl-0">
              <span className="text-stone-300 w-full pl-4">style.css</span>
            </div>
          </div>
        </div>

        {/* Code and Terminal Area */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="flex bg-stone-800 bg-opacity-60 border-b border-stone-600 ">
            <div className="px-4 py-2 bg-neutral-900 border-r border-stone-600 flex items-center -mb-1">
              <span className="text-sm text-stone-300 -mt-1">script.js</span>
              <button className="ml-2 text-stone-500 hover:text-stone-400 -mt-1">
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto py-6 font-mono text-sm relative bg-neutral-900">
              <CodeEditor
                theme="codeCafeTheme"
                language="javascript"
                showLineNumbers={true}
                code={code}
                onCodeChange={(code) => {
                  setCode(code);
                  console.log(code);
                }}
              />
            </div>

            {/* Resizer */}
            <div className="h-1 bg-stone-700 cursor-row-resize"></div>

            {/* Terminal */}
            <div className="h-1/3 bg-neutral-900 bg-opacity-90 flex flex-col border-t border-stone-600">
              <div className="flex bg-stone-800 py-1 text-sm">
                <div className="px-4 py-1 text-stone-400 text-xs">TERMINAL</div>
              </div>
              <div className="flex-1 px-4 py-2 font-mono text-sm overflow-auto">
                <TerminalComponent ref={terminalRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-stone-800 bg-opacity-80 text-stone-500 flex justify-between items-center px-4 py-1 text-xs border-t border-stone-600">
        <div className="flex items-center space-x-4">
          <span>{editorLanguage}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Ln 3, Col 12</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorUI;
