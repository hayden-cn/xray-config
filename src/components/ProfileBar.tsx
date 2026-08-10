import { useState } from "react";
import { App, Button, Select, Space } from "antd";
import { FolderOpenOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { useAppStore } from "../store";
import { truncateMiddle } from "../utils";
import ProfileManagerModal from "./ProfileManagerModal";
import ProfileModal from "./ProfileModal";
import SettingsModal from "./SettingsModal";
import type { Profile } from "../types";

export default function ProfileBar() {
  const { modal } = App.useApp();
  const { profiles, currentProfileId } = useAppStore();
  const [managerOpen, setManagerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formProfile, setFormProfile] = useState<Profile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const current = profiles.find((p) => p.id === currentProfileId);

  const openCreate = () => {
    setFormProfile(null);
    setFormOpen(true);
  };

  const openEdit = (p: Profile) => {
    setFormProfile(p);
    setFormOpen(true);
  };

  return (
    <Space style={{ display: "flex", justifyContent: "flex-end" }} wrap>
      <Select
        size="middle"
        style={{ minWidth: 220, maxWidth: 380 }}
        placeholder="选择 Profile"
        value={currentProfileId ?? undefined}
        options={profiles.map((p) => ({
          value: p.id,
          label: (
            <span className="profile-option">
              <span className="profile-option-name">{p.name}</span>
              {p.path && (
                <span className="profile-option-path" title={p.path}>
                  {truncateMiddle(p.path, 44)}
                </span>
              )}
            </span>
          ),
        }))}
        onChange={(id) => {
          const store = useAppStore.getState();
          if (store.dirtySections.length > 0 && current?.id !== id) {
            modal.confirm({
              title: "数据已更改",
              content: "切换 Profile 将丢失未保存的编辑，是否继续？",
              onOk: () => store.selectProfile(id),
            });
          } else {
            store.selectProfile(id);
          }
        }}
        popupMatchSelectWidth={false}
        notFoundContent={
          <Button type="link" size="small" onClick={openCreate}>
            <PlusOutlined /> 新建 Profile
          </Button>
        }
      />
      <Button icon={<FolderOpenOutlined />} onClick={() => setManagerOpen(true)}>
        管理
      </Button>
      <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
        设置
      </Button>
      <ProfileManagerModal
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onCreate={openCreate}
        onEdit={openEdit}
      />
      <ProfileModal open={formOpen} onClose={() => setFormOpen(false)} profile={formProfile} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Space>
  );
}
