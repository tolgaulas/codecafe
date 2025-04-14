import { LANGUAGE_VERSIONS } from "../constants/languageVersions";

// Define types for code execution
export interface CodeFile {
  content: string;
}

export interface CodeExecutionRequest {
  language: string;
  version: string;
  files: CodeFile[];
}

export interface CodeExecutionResponse {
  run: {
    stdout: string;
    stderr: string;
  };
}

// Define the Terminal ref interface
export interface TerminalRef {
  writeToTerminal: (text: string) => void;
  fit: () => void;
}

// Define type for language keys
export type ExecutableLanguageKey = keyof typeof LANGUAGE_VERSIONS; // Languages the backend can run
export type EditorLanguageKey =
  | ExecutableLanguageKey
  | "css"
  | "html"
  | "plaintext"; // Languages the editor supports

// Add new state type for join process
export type JoinStateType = "idle" | "prompting" | "joined";

export interface OpenFile {
  id: string; // Unique ID, e.g., file path or generated UUID
  name: string;
  language: EditorLanguageKey; // Use the broader editor language type
}

// --- Sortable Tab Component Props ---
// Consider moving this to a Tabs component file later
export interface SortableTabProps {
  file: OpenFile;
  activeFileId: string | null;
  draggingId: string | null;
  IconComponent: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
}
