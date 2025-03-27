import { User } from "./user";
import { CursorData } from "./cursorData";
import * as monaco from "monaco-editor";

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

export interface CodeEditorProps {
  onCodeChange: (code: string) => void;
  users?: User[];
  onCursorPositionChange?: (lineNumber: number) => void;
  code?: string;
  sendCursorData?: (cursorData: CursorData) => void;
  onLoadingChange?: (loading: boolean) => void;
  language?: string;
  theme?: "codeCafeTheme" | "transparentTheme";
  fontSize?: string;
  wordWrap?: boolean;
  showLineNumbers?: boolean;
  onEditorDidMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}
