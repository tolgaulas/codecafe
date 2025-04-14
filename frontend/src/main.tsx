import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import App from "./App.tsx"; // Remove this line
import App from "./App.tsx"; // Change 'CodeEditorUI' to 'App' and path to './App.tsx'

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App /> // Change 'CodeEditorUI' to 'App'
  </StrictMode>
);
