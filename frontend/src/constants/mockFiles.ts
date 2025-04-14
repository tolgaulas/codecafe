import { EditorLanguageKey } from "../types/editor";

// --- Mock File Data (Replace with actual data fetching/structure later) ---
export const MOCK_FILES: {
  [id: string]: { name: string; language: EditorLanguageKey; content: string };
} = {
  "script.js": {
    name: "script.js",
    language: "javascript",
    content:
      '// Start coding in script.js\nfunction helloWorld() {\n  console.log("Hello from script.js!");\n}\nhelloWorld();\n',
  },
  "style.css": {
    name: "style.css",
    language: "css",
    content:
      "/* Start coding in style.css */\nbody {\n  background-color: #2d2d2d;\n}\n",
  },
  "index.html": {
    name: "index.html",
    language: "html",
    content:
      '<!DOCTYPE html>\n<html>\n<head>\n  <title>Code Editor</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello from index.html!</h1>\n  <script src="script.js"></script>\n</body>\n</html>\n',
  },
};
