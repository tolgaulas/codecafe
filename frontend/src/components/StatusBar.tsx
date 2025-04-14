import React from "react";

interface StatusBarProps {
  // Props will be added later, e.g., language, line/col, encoding etc.
}

const StatusBar: React.FC<StatusBarProps> = () => {
  return (
    <div className="bg-stone-800 bg-opacity-80 text-stone-500 flex justify-between items-center px-4 py-1 text-xs border-t border-stone-600 flex-shrink-0">
      <div className="flex items-center space-x-4">
        {/* TODO: Replace with dynamic data */}
        <span>
          {/* {activeFileId && openFiles.find((f) => f.id === activeFileId)
            ? openFiles.find((f) => f.id === activeFileId)?.language
            : "plaintext"} */}
          plaintext
        </span>
        <span>UTF-8</span>
      </div>
      <div className="flex items-center space-x-4">
        {/* TODO: Replace with dynamic data */}
        <span>Ln 1, Col 1</span>
        <span>Spaces: 2</span>
      </div>
    </div>
  );
};

export default StatusBar;
