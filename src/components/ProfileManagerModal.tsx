import { App, Button, List, Modal, Space, Tag, Tooltip } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
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

  const moveProfile = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= profiles.length) return;
    const next = [...profiles];
    [next[index], next[j]] = [next[j], next[index]];
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
        <List
          dataSource={profiles}
          locale={{ emptyText: "暂无 Profile，点击下方「新建 Profile」创建" }}
          renderItem={(p, index) => (
            <List.Item
              actions={[
                <Tooltip title="上移" key="up">
                  <Button
                    size="small"
                    type="text"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => moveProfile(index, -1)}
                  />
                </Tooltip>,
                <Tooltip title="下移" key="down">
                  <Button
                    size="small"
                    type="text"
                    icon={<ArrowDownOutlined />}
                    disabled={index === profiles.length - 1}
                    onClick={() => moveProfile(index, 1)}
                  />
                </Tooltip>,
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
