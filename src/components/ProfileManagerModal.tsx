import { App, Button, List, Modal, Space, Tag } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useRef, useState } from "react";
import { useAppStore } from "../store";
import { truncateMiddle } from "../utils";
import ScrollArea from "./ScrollArea";
import type { Profile } from "../types";

interface ProfileManagerModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (p: Profile) => void;
}

export default function ProfileManagerModal({
  open,
  onClose,
  onCreate,
  onEdit,
}: ProfileManagerModalProps) {
  const { modal, message } = App.useApp();
  const { profiles, currentProfileId } = useAppStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);

  const handleDelete = (p: Profile) => {
    modal.confirm({
      title: `删除 Profile「${p.name}」？`,
      content: "此操作不会删除磁盘上的配置文件，仅移除本应用的记录。",
      onOk: async () => {
        const store = useAppStore.getState();
        const next = profiles.filter((x) => x.id !== p.id);
        await store.saveProfiles(next);
        if (currentProfileId === p.id) {
          await store.selectProfile(next[0]?.id ?? "");
        }
        message.success("已删除");
      },
    });
  };

  const handleDrop = async (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const sourceIndex = profiles.findIndex((p) => p.id === sourceId);
    const targetIndex = profiles.findIndex((p) => p.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...profiles];
    [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
    await useAppStore.getState().saveProfiles(next);
  };

  const clearDragState = () => {
    setDraggingId(null);
    setDragOverId(null);
    draggingIdRef.current = null;
    dragOverIdRef.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    draggingIdRef.current = id;
    dragOverIdRef.current = id;
    setDraggingId(id);
    setDragOverId(id);

    const update = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY)?.closest("[data-profile-id]");
      const targetId = (target as HTMLElement | null)?.dataset.profileId ?? null;
      if (!targetId || targetId === dragOverIdRef.current) return;
      dragOverIdRef.current = targetId;
      setDragOverId(targetId);
    };

    const onMove = (moveEvent: PointerEvent) => {
      update(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const sourceId = draggingIdRef.current;
      const targetId = dragOverIdRef.current;
      if (sourceId && targetId && sourceId !== targetId) void handleDrop(sourceId, targetId);
      clearDragState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <Modal
      open={open}
      title="管理 Profile"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={640}
    >
      <ScrollArea maxHeight="50vh" className="profile-manager-body">
        <List
          dataSource={profiles}
          locale={{ emptyText: "暂无 Profile，点击下方「新建 Profile」创建" }}
          renderItem={(p) => (
            <List.Item
              data-profile-id={p.id}
              className={`${draggingId === p.id ? "dragging" : ""}${dragOverId === p.id ? " drag-over" : ""}`}
              actions={[
                <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => onEdit(p)}>
                  编辑
                </Button>,
                <Button
                  key="del"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(p)}
                >
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={8} wrap>
                    <span>{p.name}</span>
                    {p.id === currentProfileId && <Tag color="blue">当前</Tag>}
                    {p.apiAddress && <Tag color="green">API</Tag>}
                  </Space>
                }
                description={
                  <>
                    <div className="profile-path" title={p.path}>
                      {truncateMiddle(p.path, 56)}
                    </div>
                    {p.xrayPath && (
                      <div className="profile-path-secondary">xray: {p.xrayPath}</div>
                    )}
                  </>
                }
              />
              <span
                className="drag-handle"
                role="button"
                aria-label="拖拽排序"
                title="拖拽排序"
                onPointerDown={(event) => handlePointerDown(event, p.id)}
              >
                <HolderOutlined />
              </span>
            </List.Item>
          )}
        />
      </ScrollArea>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate} block>
        新建 Profile
      </Button>
    </Modal>
  );
}
