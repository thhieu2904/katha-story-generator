'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { StoryTextPage } from '@/features/stories/types';
import { StoryPageCard } from './StoryPageCard';

export function SortablePageList({
  pages,
  disabled,
  canDelete,
  onReorder,
  onDelete,
  onRetranslate,
}: {
  pages: StoryTextPage[];
  disabled: boolean;
  canDelete: boolean;
  onReorder: (ids: number[]) => void;
  onDelete: (page: StoryTextPage) => void;
  onRetranslate: (pageId: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = (from: number, to: number) => {
    if (disabled || from === to) return;
    onReorder(arrayMove(pages, from, to).map((page) => page.id));
  };

  const dragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const from = pages.findIndex((page) => page.id === event.active.id);
    const to = pages.findIndex((page) => page.id === event.over?.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-5">
          {pages.map((page, index) => (
            <StoryPageCard
              key={page.id}
              page={page}
              index={index}
              count={pages.length}
              disabled={disabled}
              canDelete={canDelete}
              onMove={move}
              onDelete={() => onDelete(page)}
              onRetranslate={() => onRetranslate(page.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}