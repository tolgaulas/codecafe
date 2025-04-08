import { useState } from "react";
import CodeEditor from "./components/CodeEditor";

const CodeEditorUI = () => {
  const [code, setCode] = useState(
    '// Start coding here\nfunction helloWorld() {\n  console.log("Hello, world!");\n}\n'
  );

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-800 to-stone-600 text-stone-300">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-800 bg-opacity-80 p-2 border-b border-stone-600">
        <div className="flex items-center">
          <div className="flex space-x-2">
            <button className="px-2 py-1 text-sm rounded hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400">
              File
            </button>
            <button className="px-2 py-1 text-sm rounded hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400">
              Edit
            </button>
            <button className="px-2 py-1 text-sm rounded hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400">
              View
            </button>
            <button className="px-2 py-1 text-sm rounded hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400">
              Run
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-neutral-900 active:bg-stone-950 text-stone-500 hover:text-stone-400">
            <span className="text-sm">?</span>
          </button>
          <div className="w-8 h-8 bg-red-400 rounded-full flex items-center justify-center mr-10">
            <span className="text-stone-200">M</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        <div className="w-16 bg-stone-800 bg-opacity-60 flex flex-col items-center py-2 border-r border-stone-600">
          <button className="p-2 mb-2 rounded hover:bg-neutral-900 active:bg-stone-950 active:scale-95">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-500 hover:text-stone-400"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </button>
          <button className="p-2 mb-2 rounded hover:bg-neutral-900 active:bg-stone-950 active:scale-95">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-500 hover:text-stone-400"
            >
              <path d="M3 3v18h18"></path>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
            </svg>
          </button>
          <button className="p-2 mb-2 rounded hover:bg-neutral-900 active:bg-stone-950 active:scale-95">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-500 hover:text-stone-400"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12" y2="16"></line>
            </svg>
          </button>
        </div>

        {/* File Tree */}
        <div className="w-48 bg-stone-800 bg-opacity-60 overflow-y-auto border-r border-stone-600">
          <div className="font-bold p-2 text-sm text-stone-400">EXPLORER</div>
          <div className="w-full">
            <div className="flex items-center text-sm py-1 hover:bg-neutral-900 cursor-pointer w-full pl-0">
              <span className="text-stone-300 w-full pl-2">index.html</span>
            </div>
            <div className="flex items-center text-sm py-1 bg-neutral-900 cursor-pointer w-full pl-0">
              <span className="text-stone-200 w-full pl-2">script.js</span>
            </div>
            <div className="flex items-center text-sm py-1 hover:bg-neutral-900 cursor-pointer w-full pl-0">
              <span className="text-stone-300 w-full pl-2">style.css</span>
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
            {/* <div className="flex-1 overflow-auto p-4 font-mono text-sm relative bg-neutral-900 bg-opacity-80">
              <div className="absolute left-0 top-0 p-4 text-stone-600 select-none w-8 text-right pr-2">
                {code.split("\n").map((_, i) => (
                  <div key={i} className="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>

              <div className="pl-8">
                <textarea
                  className="w-full h-full bg-transparent resize-none outline-none leading-6 text-stone-300"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck="false"
                ></textarea>
              </div>
            </div> */}
            <div className="flex-1 overflow-auto py-6 font-mono text-sm relative bg-neutral-900">
              <CodeEditor
                theme="codeCafeTheme"
                language="javascript"
                showLineNumbers={true}
              />
            </div>

            {/* Resizer */}
            <div className="h-1 bg-stone-700 cursor-row-resize"></div>

            {/* Terminal */}
            <div className="h-1/3 bg-neutral-900 bg-opacity-90 flex flex-col border-t border-stone-600">
              <div className="flex bg-stone-800 py-1 text-sm">
                <div className="px-4 py-1 text-stone-400">TERMINAL</div>
              </div>
              <div className="flex-1 px-4 py-2 font-mono text-sm overflow-auto">
                <div className="text-stone-400">$ node script.js</div>
                <div className="text-stone-300">Hello, world!</div>
                <div className="flex items-center">
                  <span className="text-stone-400">$</span>
                  {/* <span className="ml-2 animate-pulse text-stone-300">|</span> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-stone-800 bg-opacity-80 text-stone-500 flex justify-between items-center px-4 py-1 text-xs border-t border-stone-600">
        <div className="flex items-center space-x-4">
          <span>JavaScript</span>
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
