import { Editor } from "@monaco-editor/react";

const CodeEditor = () => {
  return (
    <Editor
      height="70vh"
      width="100%"
      theme="vs-dark"
      defaultLanguage="python"
      defaultValue="# some comment"
      options={{
        fontSize: 18,
        lineHeight: 25,
        minimap: { enabled: false },
        wordWrap: "on",
      }}
    />
  );
};

export default CodeEditor;
