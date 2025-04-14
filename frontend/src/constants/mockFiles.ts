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
  "app.py": {
    name: "app.py",
    language: "python",
    content:
      '# Start coding in app.py\n\ndef main():\n    print("Hello from app.py!")\n\nif __name__ == "__main__":\n    main()\n',
  },
  "config.json": {
    name: "config.json",
    language: "json",
    content:
      '{\n  "appName": "CodeCafe",\n  "version": "1.0.0",\n  "settings": {\n    "theme": "dark",\n    "fontSize": 14\n  }\n}',
  },
  "types.ts": {
    name: "types.ts",
    language: "typescript",
    content:
      '// Start coding in types.ts\n\nexport interface User {\n  id: string;\n  name: string;\n  isActive: boolean;\n}\n\nexport type Status = "idle" | "loading" | "success" | "error";\n',
  },
  "README.md": {
    name: "README.md",
    language: "markdown",
    content:
      "# CodeCafe Project\n\nThis is a collaborative code editor.\n\n## Features\n\n*   Real-time collaboration\n*   Code execution\n*   Integrated terminal\n*   Syntax highlighting\n\n## Setup\n\nRun `npm install` and `npm start`.\n",
  },
};
