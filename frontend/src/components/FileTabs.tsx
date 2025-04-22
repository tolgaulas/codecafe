import React, { useEffect, useState, useRef } from "react";
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

import { SortableTab } from "./SortableTab";
import {
  languageIconMap,
  languageColorMap,
  defaultIconColor,
} from "../constants/mappings";
import { VscFile } from "react-icons/vsc";
import { useFileStore } from "../store/useFileStore";

interface FileTabsProps {
  // Refs
  tabContainerRef: React.RefObject<HTMLDivElement>;

  handleSwitchTab: (fileId: string) => void; // Still passed from App via MainEditorArea, TODO: inlude this in the store
  handleCloseTab: (fileIdToClose: string) => void;
  onOverflowChange: (hasOverflow: boolean) => void; // New prop
}

const FileTabs: React.FC<FileTabsProps> = ({
  tabContainerRef,
  handleSwitchTab,
  handleCloseTab,
  onOverflowChange, // Destructure new prop
}) => {
  // State & Setters from Store
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

  // Local state for overflow
  const [hasOverflow, setHasOverflow] = useState(false);
  // Ref to track previous overflow state to avoid unnecessary calls
  const prevHasOverflowRef = useRef(hasOverflow);

  // Effect for overflow detection
  useEffect(() => {
    const container = tabContainerRef.current;
    if (!container) return;

    const checkOverflow = () => {
      const currentOverflow = container.scrollWidth > container.clientWidth;
      if (currentOverflow !== prevHasOverflowRef.current) {
        setHasOverflow(currentOverflow);
        onOverflowChange(currentOverflow);
        prevHasOverflowRef.current = currentOverflow;
        // console.log("Overflow changed:", currentOverflow); // For debugging
      }
    };

    // Check initially and on resize
    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(container);

    // Also observe changes to children (like adding/removing tabs)
    const mutationObserver = new MutationObserver(checkOverflow);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [tabContainerRef, onOverflowChange, openFiles]); // Depend on openFiles to re-check when tabs change

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Drag Handlers
  const handleDragStart = (event: DragStartEvent) => {
    // console.log("Drag Start:", event);
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
    const finalDropIndicator = { ...dropIndicator };
    const activeId = active.id as string;

    setDraggingId(null);
    setDropIndicator({ tabId: null, side: null });

    const oldIndex = openFiles.findIndex((file) => file.id === activeId);
    if (oldIndex === -1) {
      console.warn("Dragged item not found in openFiles");
      return;
    }

    let newIndex = -1;

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

    if (newIndex === -1 && over && over.id !== active.id) {
      const overIndex = openFiles.findIndex((file) => file.id === over.id);
      if (overIndex !== -1) {
        newIndex = overIndex;
        console.log(`Calculated newIndex=${newIndex} based on 'over' element`);
      }
    }

    if (newIndex === -1) {
      console.log("DragEnd: No valid newIndex determined.");
      return;
    }

    const clampedNewIndex = Math.max(0, Math.min(newIndex, openFiles.length));

    if (oldIndex !== clampedNewIndex) {
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
        const currentOldIndex = currentOpenFiles.findIndex(
          (f) => f.id === activeId
        );
        if (currentOldIndex === -1) return currentOpenFiles;

        const currentClampedNewIndex = Math.max(
          0,
          Math.min(clampedNewIndex, currentOpenFiles.length)
        );

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
        setActiveFileId(activeId);
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
        <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-600 z-0"></div>
      </div>
    </DndContext>
  );
};

export default FileTabs;
