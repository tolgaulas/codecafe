import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";

function App() {
  return (
    <div className="bg-gray-100 h-screen w-full flex flex-col p-6">
      {/* Header with run button */}
      <div className="flex justify-center mb-6">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors duration-200 font-medium">
          Run Code
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
              <CodeEditor />
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
              <Terminal />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
