import { EditorLanguageKey } from "../types/editor";
import { DiJavascript1, DiCss3Full, DiHtml5 } from "react-icons/di";
import React from "react";

// Map Monaco language identifiers if they differ (optional, but good practice)
export const editorLanguageMap: { [key in EditorLanguageKey]: string } = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  c: "c",
  cplusplus: "cpp", // Monaco uses 'cpp'
  go: "go",
  rust: "rust",
  ruby: "ruby",
  css: "css",
  html: "html",
  plaintext: "plaintext",
};

// --- Icon Mapping ---
export const languageIconMap: {
  [key in EditorLanguageKey]?: React.ComponentType<{
    size?: number;
    className?: string;
  }>;
} = {
  javascript: DiJavascript1,
  css: DiCss3Full,
  html: DiHtml5,
  // Add more mappings as needed
  // json: VscJson,
};

// --- Language Color Mapping ---
export const languageColorMap: { [key in EditorLanguageKey]?: string } = {
  javascript: "text-yellow-400", // Yellow for JS
  css: "text-blue-500", // Blue for CSS
  html: "text-orange-600", // Orange for HTML
  // Add more colors as needed
};

export const defaultIconColor = "text-stone-400"; // Default color for other files/icons
