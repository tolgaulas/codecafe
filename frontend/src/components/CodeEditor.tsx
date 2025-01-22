import { useState } from "react";
import { Editor } from "@monaco-editor/react";

interface CodeEditorProps {
  onCodeChange: (code: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ onCodeChange }) => {
  const [code, setCode] = useState<string>("// some comment");

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setCode(value);
      onCodeChange(value); // Pass the code up to the parent component
    }
  };

  return (
    <Editor
      height="100%"
      width="100%"
      theme="vs-dark"
      defaultLanguage="javascript"
      value={code} // To bind the editor value to the state
      onChange={handleEditorChange} // Capture code changes
      options={{
        fontSize: 16,
        lineHeight: 20,
        minimap: { enabled: false },
        wordWrap: "on",
      }}
    />
  );
};

export default CodeEditor;
