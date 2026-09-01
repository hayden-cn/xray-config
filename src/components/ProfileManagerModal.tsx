import { App, Button, Modal, Space, Tag } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useAppStore } from "../store";
import { truncateMiddle } from "../utils";
import { arrayMove } from "@dnd-kit/sortable";
import ScrollArea from "./ScrollArea";
import SortableList from "./SortableList";
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

  const handleReorder = async (activeIndex: number, overIndex: number) => {
    if (activeIndex === overIndex) return;
    const latestProfiles = useAppStore.getState().profiles;
    const next = arrayMove(latestProfiles, activeIndex, overIndex);
    await useAppStore.getState().saveProfiles(next);
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
        {profiles.length === 0 ? null : (
          <SortableList
            items={profiles}
            onReorder={handleReorder}
            containerClassName="profile-manager-list"
            containerStyle={{ display: "flex", flexDirection: "column" }}
            renderRow={(p, _i, props) => (
              <>
                <div className="profile-sort-meta">
                  <Space size={8} wrap>
                    <span>{p.name}</span>
                    {p.id === currentProfileId && <Tag color="blue">当前</Tag>}
                    {p.apiAddress && <Tag color="green">API</Tag>}
                  </Space>
                  <div className="profile-path" title={p.path}>
                    {truncateMiddle(p.path, 56)}
                  </div>
                  {p.xrayPath && (
                    <div className="profile-path-secondary">xray: {p.xrayPath}</div>
                  )}
                </div>
                <div className="profile-sort-actions">
                  <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(p)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(p)}
                  >
                    删除
                  </Button>
                </div>
                <span
                  className="drag-handle"
                  title="拖拽排序"
                  {...props.attributes}
                  {...props.listeners}
                  ref={props.setActivatorNodeRef}
                >
                  <HolderOutlined />
                </span>
              </>
            )}
          />
        )}
      </ScrollArea>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate} block>
        新建 Profile
      </Button>
    </Modal>
  );
}
