import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";

function App() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="w-full flex-grow">
        <CodeEditor />
      </div>

      <div className="w-full flex-grow">
        <Terminal />
      </div>
    </div>
  );
}

export default App;
