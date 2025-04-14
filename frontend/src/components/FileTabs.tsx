import React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";

import { OpenFile } from "../types/editor"; // Adjust path if needed
import { SortableTab } from "./SortableTab"; // Adjust path if needed
import {
  languageIconMap,
  languageColorMap,
  defaultIconColor,
} from "../constants/mappings"; // Adjust path if needed
import { VscFile } from "react-icons/vsc";
import { useFileStore } from "../store/useFileStore"; // <-- Import store

interface FileTabsProps {
  // Refs
  tabContainerRef: React.RefObject<HTMLDivElement>;

  // Tab State & Handlers (Get state/setters from store instead of props)
  // openFiles: OpenFile[];
  // setOpenFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>;
  // activeFileId: string | null;
  // setActiveFileId: (id: string | null) => void;
  handleSwitchTab: (fileId: string) => void; // Still passed from App via MainEditorArea
  handleCloseTab: (fileIdToClose: string) => void; // <-- Update signature (no event)

  // Drag & Drop State & Handlers (Get state/setters from store instead of props)
  // draggingId: string | null;
  // setDraggingId: (id: string | null) => void;
  // dropIndicator: { tabId: string | null; side: "left" | "right" | null };
  // setDropIndicator: (indicator: { tabId: string | null; side: "left" | "right" | null }) => void;
}

const FileTabs: React.FC<FileTabsProps> = ({
  tabContainerRef,
  // Remove props from destructuring
  // openFiles,
  // setOpenFiles,
  // activeFileId,
  // setActiveFileId,
  handleSwitchTab,
  handleCloseTab,
  // draggingId,
  // setDraggingId,
  // dropIndicator,
  // setDropIndicator,
}) => {
  // --- Get state and setters from store ---
  const {
    openFiles,
    activeFileId,
    draggingId,
    dropIndicator,
    setOpenFiles,
    setActiveFileId,
    setDraggingId,
    setDropIndicator,
  } = useFileStore();
  // --- End store hook ---

  // dnd-kit Sensors (Moved from MainEditorArea)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Drag Handlers (Moved from MainEditorArea)
  const handleDragStart = (event: DragStartEvent) => {
    // console.log("Drag Start:", event); // Keep or remove logging as desired
    setDraggingId(event.active.id as string);
    setDropIndicator({ tabId: null, side: null });
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId = over?.id as string | undefined;
    const isValidTabTarget = overId && openFiles.some((f) => f.id === overId);

    if (!("clientX" in event.activatorEvent)) {
      setDropIndicator({ tabId: null, side: null });
      return;
    }
    const pointerX = (event.activatorEvent as PointerEvent).clientX;

    const firstTabEl = tabContainerRef.current?.querySelector(
      "[data-sortable-id]"
    ) as HTMLElement | null;
    const lastTabEl = tabContainerRef.current?.querySelector(
      "[data-sortable-id]:last-child"
    ) as HTMLElement | null;
    let edgeIndicatorSet = false;

    if (firstTabEl && lastTabEl && openFiles.length > 0) {
      const firstTabRect = firstTabEl.getBoundingClientRect();
      const lastTabRect = lastTabEl.getBoundingClientRect();
      const firstTabId = openFiles[0].id;
      const lastTabId = openFiles[openFiles.length - 1].id;

      if (pointerX < firstTabRect.left + firstTabRect.width * 0.5) {
        setDropIndicator({ tabId: firstTabId, side: "left" });
        edgeIndicatorSet = true;
      } else if (pointerX > lastTabRect.right - lastTabRect.width * 0.5) {
        setDropIndicator({ tabId: lastTabId, side: "right" });
        edgeIndicatorSet = true;
      }
    }

    if (!edgeIndicatorSet) {
      if (isValidTabTarget && overId) {
        if (activeId === overId) {
          setDropIndicator({ tabId: null, side: null });
          return;
        }
        const overNode = tabContainerRef.current?.querySelector(
          `[data-sortable-id="${overId}"]`
        );
        if (!overNode) {
          console.warn("Could not find overNode for id:", overId);
          setDropIndicator({ tabId: null, side: null });
          return;
        }
        const overRect = overNode.getBoundingClientRect();
        const overMiddleX = overRect.left + overRect.width / 2;
        const side = pointerX < overMiddleX ? "left" : "right";
        setDropIndicator({ tabId: overId, side });
      } else {
        setDropIndicator({ tabId: null, side: null });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const finalDropIndicator = { ...dropIndicator }; // Grab the state before resetting
    const activeId = active.id as string;

    // Reset dragging state immediately
    setDraggingId(null);
    setDropIndicator({ tabId: null, side: null });

    const oldIndex = openFiles.findIndex((file) => file.id === activeId);
    if (oldIndex === -1) {
      console.warn("Dragged item not found in openFiles");
      return;
    }

    let newIndex = -1;

    // --- Calculate target index ---
    // Priority 1: Use drop indicator if it exists
    if (finalDropIndicator.tabId) {
      const indicatorTargetIndex = openFiles.findIndex(
        (f) => f.id === finalDropIndicator.tabId
      );
      if (indicatorTargetIndex !== -1) {
        if (finalDropIndicator.side === "left") {
          newIndex = indicatorTargetIndex;
        } else if (finalDropIndicator.side === "right") {
          newIndex = indicatorTargetIndex + 1;
        }
        console.log(`Calculated newIndex=${newIndex} based on drop indicator`);
      }
    }

    // Priority 2: If no indicator, use the 'over' element if dropping directly on a different tab
    if (newIndex === -1 && over && over.id !== active.id) {
      const overIndex = openFiles.findIndex((file) => file.id === over.id);
      if (overIndex !== -1) {
        // When dropping directly *on* an item without a side indicator,
        // the most intuitive result is often to place it *before* that item.
        newIndex = overIndex;
        console.log(`Calculated newIndex=${newIndex} based on 'over' element`);
      }
    }

    // --- Validate and execute move ---
    // If no valid drop target index was determined, do nothing
    if (newIndex === -1) {
      console.log("DragEnd: No valid newIndex determined.");
      return;
    }

    // Clamp the index to be within the valid bounds for arrayMove [0, length]
    // arrayMove can handle inserting at index `length` (which appends)
    const clampedNewIndex = Math.max(0, Math.min(newIndex, openFiles.length));

    // Only update state if the logical position actually changes
    if (oldIndex !== clampedNewIndex) {
      // A special case: moving the last item just slightly to the right might result in
      // clampedNewIndex being `openFiles.length`, which is effectively the same position.
      // We only need to check this if oldIndex was the last item.
      if (
        oldIndex === openFiles.length - 1 &&
        clampedNewIndex === openFiles.length
      ) {
        console.log(`DragEnd: No move needed (last item to end slot)`);
        return;
      }

      console.log(
        `Requesting move: ID ${activeId} from ${oldIndex} to ${clampedNewIndex}`
      );
      setOpenFiles((currentOpenFiles) => {
        // Re-find old index within setter for safety
        const currentOldIndex = currentOpenFiles.findIndex(
          (f) => f.id === activeId
        );
        if (currentOldIndex === -1) return currentOpenFiles; // Should not happen

        // Re-clamp new index based on current array length
        const currentClampedNewIndex = Math.max(
          0,
          Math.min(clampedNewIndex, currentOpenFiles.length)
        );

        // Final check for no-op
        if (currentOldIndex === currentClampedNewIndex) return currentOpenFiles;
        if (
          currentOldIndex === currentOpenFiles.length - 1 &&
          currentClampedNewIndex === currentOpenFiles.length
        )
          return currentOpenFiles;

        console.log(
          `   Executing arrayMove: from ${currentOldIndex} to ${currentClampedNewIndex}`
        );
        const movedFiles = arrayMove(
          currentOpenFiles,
          currentOldIndex,
          currentClampedNewIndex
        );
        // --- Activate the moved tab ---
        setActiveFileId(activeId);
        // --- End activation ---
        return movedFiles;
      });
    } else {
      console.log(
        `DragEnd: No move needed (oldIndex: ${oldIndex}, clampedNewIndex: ${clampedNewIndex})`
      );
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={tabContainerRef}
        className="flex bg-stone-800 flex-shrink-0 overflow-x-auto relative"
      >
        <SortableContext
          items={openFiles.map((f) => f.id)}
          strategy={horizontalListSortingStrategy}
        >
          {openFiles.map((file) => {
            const IconComponent = languageIconMap[file.language] || VscFile;
            const iconColor =
              languageColorMap[file.language] || defaultIconColor;
            const indicatorSide =
              dropIndicator.tabId === file.id ? dropIndicator.side : null;
            return (
              <SortableTab
                key={file.id}
                file={file}
                activeFileId={activeFileId}
                draggingId={draggingId}
                IconComponent={IconComponent}
                iconColor={iconColor}
                onSwitchTab={handleSwitchTab}
                onCloseTab={handleCloseTab}
                dropIndicatorSide={indicatorSide}
              />
            );
          })}
        </SortableContext>
        <DragOverlay>
          {draggingId
            ? (() => {
                const draggedFile = openFiles.find((f) => f.id === draggingId);
                if (!draggedFile) return null;
                const IconComponent =
                  languageIconMap[draggedFile.language] || VscFile;
                const iconColor =
                  languageColorMap[draggedFile.language] || defaultIconColor;
                return (
                  <div
                    className={`pl-2 pr-4 py-1 border border-stone-500 flex items-center flex-shrink-0 relative shadow-lg bg-neutral-900`}
                  >
                    <IconComponent
                      size={16}
                      className={`mr-1.5 flex-shrink-0 ${iconColor}`}
                    />
                    <span
                      className={`text-sm -mt-0.5 select-none cursor-default text-stone-200`}
                    >
                      {draggedFile.name}
                    </span>
                    <span className="ml-2 text-stone-400 p-0.5 -mt-0.5 opacity-50">
                      ×
                    </span>
                  </div>
                );
              })()
            : null}
        </DragOverlay>
        {/* Border below tabs */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-600 z-0"></div>
      </div>
    </DndContext>
  );
};

export default FileTabs;
