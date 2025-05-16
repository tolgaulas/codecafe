import React, { useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import clsx from "clsx";
import { OpenFile } from "../types/editor";
import { useFileStore } from "../store/useFileStore";

export interface SortableTabProps {
  file: OpenFile;
  activeFileId: string | null;
  draggingId: string | null;
  dropIndicatorSide: "left" | "right" | null;
  IconComponent: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
}

export function SortableTab({
  file,
  activeFileId,
  IconComponent,
  iconColor,
  dropIndicatorSide,
}: SortableTabProps) {
  const {
    listeners,
    setNodeRef,
    transition: _transition,
    isDragging,
  } = useSortable({ id: file.id });

  // Get actions from store
  const switchTab = useFileStore((state) => state.switchTab);
  const closeFile = useFileStore((state) => state.closeFile);

  // Restore the style object for the indicator lines
  const style: React.CSSProperties = {
    zIndex: activeFileId === file.id ? 10 : isDragging ? 20 : "auto", // Ensure dragging tab is above others
    // @ts-ignore // Ignore TS error for CSS custom properties
    "--before-opacity": dropIndicatorSide === "left" ? 1 : 0,
    // @ts-ignore // Ignore TS error for CSS custom properties
    "--after-opacity": dropIndicatorSide === "right" ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style} // Apply the style object
      onClick={() => switchTab(file.id)}
      {...listeners}
      className={clsx(
        "group pl-2 pr-4 py-1 border-r border-stone-600 flex items-center flex-shrink-0 relative transition-colors duration-150 ease-out",
        // Restore the ::before/::after classes for the indicator lines
        'before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-white before:transition-opacity before:duration-150 before:z-10 before:opacity-[var(--before-opacity,0)]',
        'after:content-[""] after:absolute after:inset-y-0 after:right-0 after:w-[2px] after:bg-white after:transition-opacity after:duration-150 after:z-10 after:opacity-[var(--after-opacity,0)]',
        {
          "bg-neutral-900 z-10": activeFileId === file.id,
          "bg-stone-700 hover:bg-stone-600 z-0": activeFileId !== file.id,
          "opacity-50": isDragging, // Keep dimming the original tab
        }
      )}
    >
      <IconComponent
        size={16}
        className={`mr-1.5 flex-shrink-0 ${iconColor}`}
      />
      <div className="flex items-center overflow-hidden">
        <span
          title={file.name}
          className={`text-sm -mt-0.5 select-none truncate ${
            activeFileId === file.id ? "text-stone-200" : "text-stone-400"
          }`}
        >
          {file.name}
        </span>
        <button
          className={`ml-1.5 text-stone-500 hover:text-stone-300 rounded-sm p-0.5 -mt-0.5 flex-shrink-0 z-20 opacity-60 hover:opacity-100 focus:opacity-100 ${
            activeFileId === file.id
              ? "opacity-60"
              : "opacity-0 group-hover:opacity-60 focus-within:opacity-60"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            closeFile(file.id);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          aria-label={`Close ${file.name}`}
          title={`Close ${file.name}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
