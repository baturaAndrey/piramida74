"use client";

import { useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { runActionCallback, type ActionCallback } from "./action-outcome";

export type SortableItemContext = {
  /** Ручка-захват (мышь, касание, клавиатура: Пробел → стрелки → Пробел) */
  dragHandle: ReactNode;
  moveUp: () => void;
  moveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  index: number;
};

export type SortableListProps<T extends { id: string }> = {
  items: T[];
  /**
   * Вызывается после перестановки. Неуспех — исключение или результат `{ ok: false, error }`
   * (как у `adminAction`): порядок откатывается, показывается toast с текстом ошибки.
   */
  onReorder: ActionCallback<[orderedIds: string[]]>;
  renderItem: (item: T, ctx: SortableItemContext) => ReactNode;
  disabled?: boolean;
  className?: string;
};

const DEFAULT_REORDER_ERROR = "Не удалось сохранить порядок";

/** Минимальный сдвиг указателя до начала перетаскивания — клики по кнопкам внутри не стартуют drag */
const DRAG_ACTIVATION_DISTANCE = 6;

function idsKey(items: { id: string }[]): string {
  return items.map((item) => item.id).join("|");
}

function SortableRow<T extends { id: string }>({
  item,
  index,
  count,
  disabled,
  onMove,
  renderItem,
}: {
  item: T;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  renderItem: SortableListProps<T>["renderItem"];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const dragHandle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label="Перетащить"
      disabled={disabled}
      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-60")}
    >
      {renderItem(item, {
        dragHandle,
        moveUp: () => onMove(index, index - 1),
        moveDown: () => onMove(index, index + 1),
        canMoveUp: !disabled && index > 0,
        canMoveDown: !disabled && index < count - 1,
        index,
      })}
    </li>
  );
}

/** Сортируемый список: dnd-kit (мышь, касание, клавиатура) + кнопки ↑/↓ из `renderItem`. */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className,
}: SortableListProps<T>) {
  // Оптимистичный порядок храним как список id, а содержимое элементов всегда берём из пропсов
  const [orderIds, setOrderIds] = useState(() => items.map((item) => item.id));
  const [syncedKey, setSyncedKey] = useState(() => idsKey(items));
  const [saving, setSaving] = useState(false);

  const incomingKey = idsKey(items);
  if (incomingKey !== syncedKey) {
    // Состав или порядок в пропсах изменился (например, после revalidate) — принимаем его.
    // Обновление state во время рендера — рекомендуемый React способ синхронизации с пропсами.
    setSyncedKey(incomingKey);
    setOrderIds(items.map((item) => item.id));
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = orderIds
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isLocked = disabled || saving;

  async function commit(next: T[]) {
    const previous = orderIds;
    const nextIds = next.map((item) => item.id);
    setOrderIds(nextIds);
    setSaving(true);
    const error = await runActionCallback(onReorder, [nextIds], DEFAULT_REORDER_ERROR);
    setSaving(false);
    if (error) {
      setOrderIds(previous);
      toast.error(error);
    }
  }

  function move(from: number, to: number) {
    if (isLocked || to < 0 || to >= ordered.length || from === to) return;
    void commit(arrayMove(ordered, from, to));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex((item) => item.id === active.id);
    const to = ordered.findIndex((item) => item.id === over.id);
    if (from === -1 || to === -1) return;
    move(from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={ordered.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={cn("space-y-2", className)} aria-busy={saving}>
          {ordered.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              index={index}
              count={ordered.length}
              disabled={isLocked}
              onMove={move}
              renderItem={renderItem}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
