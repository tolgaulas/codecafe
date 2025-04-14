import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableTabProps } from "../types/editor"; // Assuming SortableTabProps is in types/editor
import clsx from "clsx"; // <-- Import clsx

// Extend props for indicator
interface SortableTabPropsWithIndicator extends SortableTabProps {
  dropIndicatorSide: "left" | "right" | null;
  draggingId: string | null; // Ensure draggingId is defined here
}

// --- Sortable Tab Component ---
export function SortableTab({
  file,
  activeFileId,
  draggingId, // <-- Ensure prop is destructured
  IconComponent,
  iconColor,
  onSwitchTab,
  onCloseTab,
  dropIndicatorSide, // <-- Add new prop
}: SortableTabPropsWithIndicator) {
  // <-- Use extended props type
  const {
    attributes,
    listeners,
    setNodeRef,
    // transform, // Stays commented out
    transition: _transition, // Get transition but ignore it by renaming
    isDragging, // Still useful for potentially other styling
  } = useSortable({ id: file.id });

  // Update style object to include CSS variables for indicator opacity
  const style: React.CSSProperties = {
    zIndex: activeFileId === file.id ? 10 : "auto",
    // @ts-ignore // Ignore TS error for CSS custom properties
    "--before-opacity": dropIndicatorSide === "left" ? 1 : 0,
    // @ts-ignore // Ignore TS error for CSS custom properties
    "--after-opacity": dropIndicatorSide === "right" ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSwitchTab(file.id)}
      {...listeners}
      className={clsx(
        // Base classes (including base indicator styles)
        "pl-2 pr-4 py-1 border-r border-stone-600 flex items-center flex-shrink-0 cursor-grab relative",
        'before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-white before:transition-opacity before:duration-150 before:z-10 before:opacity-[var(--before-opacity,0)]',
        'after:content-[""] after:absolute after:inset-y-0 after:right-0 after:w-[2px] after:bg-white after:transition-opacity after:duration-150 after:z-10 after:opacity-[var(--after-opacity,0)]',
        // Conditional background color
        {
          "bg-neutral-900": activeFileId === file.id,
          "bg-stone-700 hover:bg-stone-600": activeFileId !== file.id,
        },
        // Conditional opacity for dragging
        {
          "opacity-50": isDragging,
          "opacity-100": !isDragging,
        }
        // Indicator visibility handled separately below
      )}
    >
      {/* Drop Indicator Lines - Removed explicit divs */}
      {/* {dropIndicatorSide === "left" && (
        <div className="absolute inset-y-0 left-0 w-1 bg-sky-400 z-10 pointer-events-none"></div> // Use inset-y-0 and w-1
      )}
      {dropIndicatorSide === "right" && (
        <div className="absolute inset-y-0 right-0 w-1 bg-sky-400 z-10 pointer-events-none"></div> // Use inset-y-0 and w-1
      )} */}

      <IconComponent
        size={16}
        className={`mr-1.5 flex-shrink-0 ${iconColor}`}
      />
      <span
        {...attributes}
        className={`text-sm -mt-0.5 select-none ${
          activeFileId === file.id ? "text-stone-200" : "text-stone-400"
        }`}
      >
        {file.name}
      </span>
      <button
        className={`ml-2 text-stone-500 hover:text-stone-300 rounded-sm p-0.5 -mt-0.5 z-20`}
        onClick={(e) => {
          e.stopPropagation();
          onCloseTab(file.id, e);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        aria-label={`Close ${file.name}`}
      >
        ×
      </button>
    </div>
  );
}
