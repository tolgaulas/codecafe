import { Editor } from "@monaco-editor/react";

const CodeEditor = () => {
  return (
    <Editor
      height="100%"
      width="100%"
      theme="vs-dark"
      defaultLanguage="python"
      defaultValue="# some comment"
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
