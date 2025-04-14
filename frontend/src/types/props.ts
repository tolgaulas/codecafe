import { User } from "./user";
import { CursorData } from "./cursorData";
import * as monaco from "monaco-editor";
import { editor } from "monaco-editor";
import { OTSelection } from "../ot/TextOperationSystem"; // Assuming OTSelection is defined here

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
  cursorPosition: { lineNumber: number; column: number } | null; // Optional: current cursor position
  selection: OTSelection | null; // Optional: current selection range
}

// Define the structure for remote user data extending UserInfo
// Includes Monaco-specific selection object expected by the CodeEditor
export interface RemoteUser extends UserInfo {}

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
    cursorPosition: { lineNumber: number; column: number } | null;
    selection: OTSelection | null;
  }) => void; // Optional: Callback to send cursor/selection data
  users?: RemoteUser[]; // Optional: Array of remote users for displaying cursors/selections
  onEditorDidMount?: (editor: editor.IStandaloneCodeEditor) => void; // Optional: Callback when editor instance is mounted
  onLoadingChange?: (isLoading: boolean) => void; // Optional: Callback for loading state
  localUserId?: string; // Optional: The ID of the local user, to prevent self-rendering of cursors
}

// Props for WebViewPanel component
export interface WebViewPanelProps {
  htmlContent: string;
  cssContent: string;
  jsContent: string;
  onClose?: () => void; // Add the onClose prop
}

// Props for TerminalComponent component
export interface TerminalComponentProps {
  height: number; // Pass height for layout adjustments
}

// Props for JoinSessionPanel component
export interface JoinSessionPanelProps {
  userName: string;
  userColor: string;
  isColorPickerOpen: boolean;
  colors: string[];
  onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onColorSelect: (color: string) => void;
  onToggleColorPicker: () => void;
  onConfirmJoin: () => void;
}
