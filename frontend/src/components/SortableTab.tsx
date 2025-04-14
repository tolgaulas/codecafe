import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableTabProps } from "../types/editor"; // Assuming SortableTabProps is in types/editor

// --- Sortable Tab Component ---
export function SortableTab({
  file,
  activeFileId,
  // draggingId, // This prop might not be needed if visibility is handled by dnd-kit state directly
  IconComponent,
  iconColor,
  onSwitchTab,
  onCloseTab,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : activeFileId === file.id ? 10 : "auto",
    visibility: isDragging ? "hidden" : "visible",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={(e) => {
        // Only trigger switch tab on the main div click, not the close button
        if (
          e.target === e.currentTarget ||
          !(e.target instanceof HTMLElement) ||
          !e.currentTarget.querySelector("button")?.contains(e.target)
        ) {
          onSwitchTab(file.id);
        }
      }}
      className={`pl-2 pr-4 py-1 border-r border-stone-600 flex items-center flex-shrink-0 relative cursor-pointer ${
        // Added cursor-pointer
        activeFileId === file.id
          ? "bg-neutral-900"
          : "bg-stone-700 hover:bg-stone-600"
      }`}
    >
      <IconComponent
        size={16}
        className={`mr-1.5 flex-shrink-0 ${iconColor}`}
      />
      {/* Apply drag listeners only to the text span for better control */}
      <span
        {...attributes}
        {...listeners}
        className={`text-sm -mt-0.5 select-none cursor-grab ${
          // Changed cursor to grab
          activeFileId === file.id ? "text-stone-200" : "text-stone-400"
        }`}
        // Prevent span click from triggering onSwitchTab if drag starts
        onPointerDown={(e) => e.stopPropagation()}
      >
        {file.name}
      </span>
      <button
        className={`ml-2 text-stone-500 hover:text-stone-300 rounded-sm p-0.5 -mt-0.5 z-20`}
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggering onSwitchTab
          onCloseTab(file.id, e);
        }}
        // Stop propagation for pointer down as well
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
