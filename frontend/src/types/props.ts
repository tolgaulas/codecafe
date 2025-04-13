import { User } from "./user";
import { CursorData } from "./cursorData";
import * as monaco from "monaco-editor";
import { editor } from "monaco-editor";
import { OTSelection } from "../TextOperationSystem"; // Assuming OTSelection is defined here

export interface ShareProfileProps {
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  users: User[];
  onStartSession: () => void;
  isSessionActive: boolean;
  sessionId: string | null;
  isJoiningSession: boolean;
  sessionCreatorName: string;
  onJoinSession: () => void;
  isSessionCreator: boolean;
  currentUserName: string;
  currentUserColor: string;
}

export interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
  availableLanguages: Array<{ value: string; label: string }>;
  currentTheme: "codeCafeTheme" | "transparentTheme";
  onThemeChange: (theme: "codeCafeTheme" | "transparentTheme") => void;
  currentFontSize: string;
  onFontSizeChange: (fontSize: string) => void;
  currentWordWrap: boolean;
  onWordWrapChange: (wordWrap: boolean) => void;
  currentShowLineNumbers: boolean;
  onShowLineNumbersChange: (showLineNumbers: boolean) => void;
}

// Define the structure for user information used in collaborative features
export interface UserInfo {
  id: string; // Unique identifier for the user
  name: string; // Display name of the user
  color: string; // Color associated with the user's cursor/selection
  cursorPosition?: { lineNumber: number; column: number } | null; // Optional: current cursor position
  selection?: {
    // Optional: current selection range
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
}

// Define the structure for remote user data extending UserInfo
// Includes Monaco-specific selection object expected by the CodeEditor
export interface RemoteUser extends Omit<UserInfo, "selection"> {
  // Omit the basic selection structure
  selection: OTSelection | null; // Use the specific OTSelection type
}

// Define the props for the CodeEditor component
export interface CodeEditorProps {
  code?: string; // Current code content
  language?: string; // Language for syntax highlighting
  theme?: string; // Editor theme name (e.g., 'vs-dark', 'codeCafeTheme')
  fontSize?: string; // Font size (e.g., '14px')
  wordWrap?: boolean; // Enable/disable word wrapping
  showLineNumbers?: boolean; // Show/hide line numbers
  onCodeChange: (newCode: string) => void; // Callback when code changes
  onCursorPositionChange?: (lineNumber: number) => void; // Optional: Callback for cursor position change
  sendSelectionData?: (data: {
    // Renamed from sendCursorData
    cursorPosition: { lineNumber: number; column: number } | null;
    selection: OTSelection | null;
  }) => void; // Optional: Callback to send cursor/selection data
  users?: RemoteUser[]; // Optional: Array of remote users for displaying cursors/selections
  onEditorDidMount?: (editor: editor.IStandaloneCodeEditor) => void; // Optional: Callback when editor instance is mounted
  onLoadingChange?: (isLoading: boolean) => void; // Optional: Callback for loading state
}
