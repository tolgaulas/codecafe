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
  | "plaintext"
  | "json"
  | "markdown"; // Languages the editor supports

// Add new state type for join process
export type JoinStateType = "idle" | "prompting" | "joined";

export interface OpenFile {
  id: string;
  name: string;
  language: EditorLanguageKey;
}

// Interface for methods exposed by TerminalComponent ref
export interface TerminalHandle {
  writeToTerminal: (output: string) => void;
  clear: () => void;
  fit: () => void;
}

// Search related types
export interface SearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
  isRegex: boolean;
  preserveCase: boolean;
}

export interface MatchInfo {
  currentIndex: number | null; // e.g., 1 for the first match
  totalMatches: number;
}

export interface SearchPanelProps {
  activeIcon: string | null;
  onSearchChange: (term: string, options: SearchOptions) => void;
  onReplaceChange: (term: string) => void;
  onToggleSearchOption: (option: keyof SearchOptions) => void;
  replaceValue: string;
  searchOptions: SearchOptions;
  matchInfo: MatchInfo | null;
  onReplaceAll: () => void;
}
