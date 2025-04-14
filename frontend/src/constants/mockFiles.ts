import { EditorLanguageKey } from "../types/editor";

// Interface for the structure of each mock file
interface MockFile {
  name: string;
  language: EditorLanguageKey;
  content: string;
}

// Define the mock files object with explicit typing
export const MOCK_FILES: { [key: string]: MockFile } = {
  "index.html": {
    name: "index.html",
    language: "html",
    content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>CodeCafe Live Preview</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n    <h1>Welcome to CodeCafe!</h1>\n    <p>Edit index.html, style.css, and script.js to see changes live.</p>\n    <button id="myButton">Click Me!</button>\n\n    <script src="script.js"></script>\n</body>\n</html>`,
  },
  "style.css": {
    name: "style.css",
    language: "css",
    content: `body {\n    font-family: sans-serif;\n    background-color: #f0f0f0;\n    color: #333;\n    padding: 20px;\n    transition: background-color 0.3s ease;\n}\n\nh1 {\n    color: #5a67d8; /* Indigo */\n    text-align: center;\n}\n\np {\n    line-height: 1.6;\n}\n\nbutton {\n    padding: 10px 15px;\n    font-size: 1rem;\n    background-color: #5a67d8;\n    color: white;\n    border: none;\n    border-radius: 4px;\n    cursor: pointer;\n    transition: background-color 0.2s ease;\n}\n\nbutton:hover {\n    background-color: #434190;\n}\n\n/* Add a class for dark mode */\nbody.dark-mode {\n    background-color: #2d3748; /* Gray 800 */\n    color: #e2e8f0; /* Gray 200 */\n}\n\nbody.dark-mode h1 {\n    color: #9f7aea; /* Purple 400 */\n}\n\nbody.dark-mode button {\n    background-color: #9f7aea;\n}\n\nbody.dark-mode button:hover {\n    background-color: #805ad5; /* Purple 500 */\n}`,
  },
  "script.js": {
    name: "script.js",
    language: "javascript",
    content: `console.log("CodeCafe script loaded!");\n\ndocument.addEventListener('DOMContentLoaded', () => {\n    const button = document.getElementById('myButton');\n    const body = document.body;\n\n    if (button) {\n        button.addEventListener('click', () => {\n            alert('Button clicked!');\n            // Toggle dark mode\n            body.classList.toggle('dark-mode');\n            console.log('Dark mode toggled');\n        });\n    } else {\n        console.error('Button element not found!');\n    }\n\n    // Example: Log the current time every 5 seconds\n    // setInterval(() => {\n    //     console.log(\`Current time: ${new Date().toLocaleTimeString()}\`);\n    // }, 5000);\n});\n`,
  },
};
