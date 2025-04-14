import { create } from "zustand";
import { OpenFile, EditorLanguageKey } from "../types/editor"; // Adjust path if needed
import { MOCK_FILES } from "../constants/mockFiles"; // Adjust path if needed

// --- Initial State ---
// We need to compute the initial state outside the store definition
// as it depends on MOCK_FILES.
const initialOpenFileIds = ["index.html", "style.css", "script.js"];
const initialOpenFilesData = initialOpenFileIds.map((id): OpenFile => {
  const fileData = MOCK_FILES[id];
  if (!fileData) {
    console.error(`Initial file ${id} not found in MOCK_FILES!`);
    // Provide a default OpenFile structure for error cases
    return { id, name: "Error", language: "plaintext" as EditorLanguageKey };
  }
  return {
    id: id,
    name: fileData.name,
    language: fileData.language as EditorLanguageKey, // Assume language is correct in MOCK_FILES
  };
});
const initialActiveFileId = initialOpenFileIds[0] || null;

// --- State Interface ---
interface FileState {
  openFiles: OpenFile[];
  activeFileId: string | null;
  draggingId: string | null;
  dropIndicator: { tabId: string | null; side: "left" | "right" | null };
}

// --- Actions Interface ---
interface FileActions {
  setOpenFiles: (
    files: OpenFile[] | ((prev: OpenFile[]) => OpenFile[])
  ) => void;
  setActiveFileId: (id: string | null) => void;
  setDraggingId: (id: string | null) => void;
  setDropIndicator: (indicator: FileState["dropIndicator"]) => void;
  // More complex actions like openFile, closeFile will be added later
  // or remain in App.tsx initially calling these basic setters.
}

// --- Store Implementation ---
export const useFileStore = create<FileState & FileActions>((set) => ({
  // --- Initial State ---
  openFiles: initialOpenFilesData,
  activeFileId: initialActiveFileId,
  draggingId: null,
  dropIndicator: { tabId: null, side: null },

  // --- Actions ---
  setOpenFiles: (files) =>
    set((state) => ({
      openFiles: typeof files === "function" ? files(state.openFiles) : files,
    })),
  setActiveFileId: (id) => set({ activeFileId: id }),
  setDraggingId: (id) => set({ draggingId: id }),
  setDropIndicator: (indicator) => set({ dropIndicator: indicator }),
}));
