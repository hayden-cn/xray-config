import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface SortableRowContentProps {
  /** 渲染到拖拽手柄的 attributes/listeners/ref */
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  isDragging: boolean;
}

interface SortableListProps<T> {
  items: T[];
  /** 拖拽结束时：activeIndex 与 overIndex（0-based） */
  onReorder: (activeIndex: number, overIndex: number) => void;
  /** 渲染每行**内容**（handle + index + 自定义内容 + 操作按钮），SortableList 会自动包裹行容器与拖拽效果 */
  renderRow: (item: T, index: number, props: SortableRowContentProps) => ReactNode;
  /** 每行根节点额外 class */
  containerClassName?: string;
  /** 容器样式（纵向 flex 布局） */
  containerStyle?: CSSProperties;
}

function SortableRow<T>({
  item,
  index,
  isLast,
  renderRow,
}: {
  item: T;
  index: number;
  isLast: boolean;
  renderRow: SortableListProps<T>["renderRow"];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(index) });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-row${isDragging ? " dragging" : ""}${isLast ? " sortable-row-last" : ""}`}
    >
      {renderRow(item, index, {
        attributes,
        listeners,
        setActivatorNodeRef,
        isDragging,
      })}
    </div>
  );
}

export default function SortableList<T>({
  items,
  onReorder,
  renderRow,
  containerClassName,
  containerStyle,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => items.map((_, i) => String(i)), [items.length]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIndex = items.findIndex((_, i) => String(i) === active.id);
    const overIndex = items.findIndex((_, i) => String(i) === over.id);
    if (activeIndex < 0 || overIndex < 0) return;
    onReorder(activeIndex, overIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={containerClassName} style={containerStyle}>
          {items.map((item, index) => (
            <SortableRow
              key={index}
              item={item}
              index={index}
              isLast={index === items.length - 1}
              renderRow={renderRow}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
