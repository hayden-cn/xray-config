import { useEffect, useState } from "react";
import { App, Button, Form, Input, Modal, Space } from "antd";
import { DeleteOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../store";
import type { Profile } from "../types";
import ScrollArea from "./ScrollArea";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile?: Profile | null;
  onSaved?: () => void;
}

interface FormValues {
  name: string;
  path: string;
  apiAddress?: string;
  xrayPath?: string;
}

export default function ProfileModal({ open, onClose, profile, onSaved }: ProfileModalProps) {
  const { modal, message } = App.useApp();
  const { profiles, currentProfileId } = useAppStore();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: profile?.name ?? "",
      path: profile?.path ?? "",
      apiAddress: profile?.apiAddress ?? "",
      xrayPath: profile?.xrayPath ?? "",
    });
  }, [open, profile, form]);

  const pickFile = async (key: keyof FormValues) => {
    const res = await openDialog({ multiple: false, directory: false });
    if (typeof res === "string") form.setFieldValue(key, res);
  };

  const pickFolder = async () => {
    const res = await openDialog({ multiple: false, directory: true });
    if (typeof res === "string") form.setFieldValue("path", res);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const saved: Profile = {
        id: profile?.id ?? crypto.randomUUID(),
        name: values.name.trim(),
        path: values.path.trim(),
        apiAddress: values.apiAddress?.trim() || null,
        xrayPath: values.xrayPath?.trim() || null,
      };
      const store = useAppStore.getState();
      const next = profile
        ? profiles.map((p) => (p.id === saved.id ? saved : p))
        : [...profiles, saved];
      await store.saveProfiles(next);
      if (!profile) {
        await store.selectProfile(saved.id);
      } else if (store.currentProfileId === saved.id) {
        await store.refresh();
      }
      message.success(profile ? "Profile 已更新" : "Profile 已创建");
      onClose();
      onSaved?.();
    } catch (e) {
      message.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!profile) return;
    modal.confirm({
      title: `删除 Profile「${profile.name}」？`,
      content: "此操作不会删除磁盘上的配置文件，仅移除本应用的记录。",
      onOk: async () => {
        const store = useAppStore.getState();
        const next = profiles.filter((p) => p.id !== profile.id);
        await store.saveProfiles(next);
        if (currentProfileId === profile.id) {
          await store.selectProfile(next[0]?.id ?? "");
        }
        message.success("已删除");
        onClose();
        onSaved?.();
      },
    });
  };

  return (
    <Modal
      open={open}
      title={profile ? "编辑 Profile" : "新建 Profile"}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={560}
      footer={
        <Space>
          {profile && (
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除
            </Button>
          )}
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: "请输入名称" }]}
        >
          <Input placeholder="例如：主代理" />
        </Form.Item>
        <Form.Item label="配置文件路径" required>
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item
              name="path"
              noStyle
              rules={[{ required: true, message: "请选择配置文件或文件夹" }]}
            >
              <Input placeholder="选择 config.json 或配置文件夹" />
            </Form.Item>
            <Button icon={<FolderOpenOutlined />} onClick={pickFolder}>
              文件夹
            </Button>
            <Button onClick={() => pickFile("path")}>文件</Button>
          </Space.Compact>
        </Form.Item>
        <Form.Item
          name="apiAddress"
          label="API 地址（可选）"
          tooltip="填写后读取时校验、应用时热更新。例如 127.0.0.1:8080"
        >
          <Input placeholder="127.0.0.1:8080" />
        </Form.Item>
        <Form.Item
          label="xray 可执行文件（可选）"
          tooltip="留空时按 启动目录 → 系统 PATH 查找"
        >
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item name="xrayPath" noStyle>
              <Input placeholder="xray / xray.exe" />
            </Form.Item>
            <Button icon={<FolderOpenOutlined />} onClick={() => pickFile("xrayPath")}>
              选择
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>
      </ScrollArea>
    </Modal>
  );
}
