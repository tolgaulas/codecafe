import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableTabProps } from "../types/editor";
import clsx from "clsx";

export function SortableTab({
  file,
  activeFileId,
  IconComponent,
  iconColor,
  onSwitchTab,
  onCloseTab,
  dropIndicatorSide,
}: SortableTabProps) {
  const {
    listeners,
    setNodeRef,
    transition: _transition, // Get transition but ignore it by renaming
    isDragging,
  } = useSortable({ id: file.id });

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
        "pl-2 pr-4 py-1 border-r border-stone-600 flex items-center flex-shrink-0 relative",
        'before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-white before:transition-opacity before:duration-150 before:z-10 before:opacity-[var(--before-opacity,0)]',
        'after:content-[""] after:absolute after:inset-y-0 after:right-0 after:w-[2px] after:bg-white after:transition-opacity after:duration-150 after:z-10 after:opacity-[var(--after-opacity,0)]',
        {
          "bg-neutral-900": activeFileId === file.id,
          "bg-stone-700 hover:bg-stone-600": activeFileId !== file.id,
        },
        {
          "opacity-50": isDragging,
          "opacity-100": !isDragging,
        }
      )}
    >
      <IconComponent
        size={16}
        className={`mr-1.5 flex-shrink-0 ${iconColor}`}
      />
      <span
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
