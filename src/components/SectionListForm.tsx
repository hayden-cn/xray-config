import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Alert,
  Button,
  Empty,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  FormOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useAppStore } from "../store";
import { sectionUri } from "../schema";
import ScrollArea from "./ScrollArea";
import SectionEditor from "./SectionEditor";
import { useMarkers } from "./useMarkers";

/** 编辑弹窗的通用 props 约定 */
export interface SectionListEditModalProps<T> {
  open: boolean;
  initial: T | null;
  onClose: () => void;
  onSave: (item: T) => void;
}

interface SectionListFormProps<T> {
  path: string;
  title: string;
  unit?: string;
  parse: (text: string) => T[] | null;
  format: (list: T[]) => string;
  renderItem: (item: T) => ReactNode;
  EditModal: ComponentType<SectionListEditModalProps<T>>;
  emptyText?: string;
  deleteConfirmTitle?: string;
  extraActions?: (item: T, index: number) => ReactNode;
  headerExtra?: ReactNode;
}

/** 对象数组类 section 的通用列表表单容器（form/json 双模式 + 增删改排序） */
export default function SectionListForm<T>({
  path,
  title,
  unit = "条",
  parse,
  format,
  renderItem,
  EditModal,
  emptyText = "暂无数据，点击右上角「新增」创建",
  deleteConfirmTitle = "删除这条记录？",
  extraActions,
  headerExtra,
}: SectionListFormProps<T>) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const itemsRef = useRef<T[]>([]);
  const draggingIndexRef = useRef<number | null>(null);

  const raw = useAppStore((s) => s.sections[path]);
  const setSection = useAppStore((s) => s.setSection);

  const parsed = parse(raw);
  const invalid = parsed === null;
  const items: T[] = parsed ?? [];
  const effectiveMode = invalid ? "json" : mode;

  const markers = useMarkers(sectionUri(path));
  const errorCount = markers.filter((m) => m.severity === 8).length;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const write = (next: T[]) => setSection(path, format(next));

  const clearDragState = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
    draggingIndexRef.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    draggingIndexRef.current = index;
    setDraggingIndex(index);
    setDragOverIndex(index);

    const update = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY)?.closest("[data-sort-index]");
      const targetIndex = target ? Number((target as HTMLElement).dataset.sortIndex) : NaN;
      const sourceIndex = draggingIndexRef.current;
      if (!Number.isInteger(targetIndex) || sourceIndex === null || targetIndex === sourceIndex) return;
      if (targetIndex < 0 || targetIndex >= itemsRef.current.length) return;
      const next = [...itemsRef.current];
      [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
      itemsRef.current = next;
      draggingIndexRef.current = targetIndex;
      setDraggingIndex(targetIndex);
      write(next);
      setDragOverIndex(targetIndex);
    };

    const onMove = (moveEvent: PointerEvent) => {
      update(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      clearDragState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const remove = (index: number) => write(items.filter((_, i) => i !== index));

  const openAdd = () => {
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleSave = (item: T) => {
    if (editingIndex === null) {
      write([...items, item]);
    } else {
      const next = [...items];
      next[editingIndex] = item;
      write(next);
    }
    setDialogOpen(false);
  };

  return (
    <div className="section-card routing-rules-form">
      <div className="section-card-head">
        <Space size={8}>
          <Typography.Text strong>{title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {invalid ? "无法解析" : `${items.length} ${unit}`}
          </Typography.Text>
          {mode === "json" && errorCount > 0 && <Tag color="error">{errorCount}</Tag>}
        </Space>
        <Space size={4}>
          {headerExtra}
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            新增
          </Button>
          <Button
            size="small"
            type="text"
            icon={mode === "form" ? <CodeOutlined /> : <FormOutlined />}
            title={mode === "form" ? "切换到 JSON 编辑" : "切换到表单编辑"}
            onClick={() => setMode(mode === "form" ? "json" : "form")}
          />
        </Space>
      </div>

      {invalid && (
        <Alert
          type="error"
          showIcon
          message={`${title}无法解析为对象数组`}
          description="当前内容不是合法的对象数组，已强制切换到 JSON 模式修正。"
          style={{ margin: 8 }}
        />
      )}

      {effectiveMode === "json" ? (
        <div className="routing-rules-json">
          <SectionEditor
            path={path}
            value={raw}
            onChange={(v) => setSection(path, v)}
          />
        </div>
      ) : (
        <ScrollArea
          className="tab-scroll-area routing-rules-list"
          style={{ flex: 1, minHeight: 0 }}
        >
          {items.length === 0 ? (
            <Empty description={emptyText} style={{ marginTop: 56 }} />
          ) : (
            <Space direction="vertical" size={6} style={{ width: "100%", padding: "8px 8px 12px" }}>
              {items.map((item, i) => (
                <div
                  data-sort-index={i}
                  className={`rule-card${draggingIndex === i ? " dragging" : ""}${dragOverIndex === i ? " drag-over" : ""}`}
                  key={i}
                >
                  <span
                    className="drag-handle"
                    role="button"
                    aria-label="拖拽排序"
                    title="拖拽排序"
                    onPointerDown={(event) => handlePointerDown(event, i)}
                  >
                    <HolderOutlined />
                  </span>
                  <span className="rule-index">{i + 1}</span>
                  {renderItem(item)}
                  <div className="rule-card-actions">
                    {extraActions?.(item, i)}
                    <Tooltip title="编辑">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(i)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={deleteConfirmTitle}
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => remove(i)}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </Space>
          )}
        </ScrollArea>
      )}

      <EditModal
        open={dialogOpen}
        initial={editingIndex === null ? null : (items[editingIndex] ?? null)}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
