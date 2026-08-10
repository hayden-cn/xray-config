import { useEffect, useState } from "react";
import { App, Button, Form, Input, Modal, Segmented, Space, Typography } from "antd";
import { DeleteOutlined, FolderOpenOutlined, PlusOutlined, UndoOutlined } from "@ant-design/icons";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../store";
import { DEFAULT_TEMPLATE } from "../types";
import ScrollArea from "./ScrollArea";
import type { TemplateEntry } from "../types";
import type { ThemePref } from "../theme";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface TemplateRow {
  key: string;
  file: string;
  keys: string[];
}

interface FormValues {
  defaultXrayPath?: string;
  theme: ThemePref;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { message } = App.useApp();
  const { settings, saveSettings, setTheme } = useAppStore();
  const [form] = Form.useForm<FormValues>();
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      defaultXrayPath: settings.defaultXrayPath ?? "",
      theme: settings.theme ?? "system",
    });
    const tpl =
      settings.defaultMultiFileTemplate.length > 0
        ? settings.defaultMultiFileTemplate
        : DEFAULT_TEMPLATE;
    setRows(tpl.map((t, i) => ({ key: String(i), file: t.file, keys: t.keys })));
  }, [open, form]);

  const updateRow = (key: string, patch: Partial<TemplateRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const keysText = (row: TemplateRow) => row.keys.join(", ");

  const handleSave = async () => {
    const values = await form.validateFields();
    const template: TemplateEntry[] = rows.map((r) => ({
      file: r.file.trim(),
      keys: keysText(r)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }));
    setSaving(true);
    try {
      await saveSettings({
        defaultXrayPath: values.defaultXrayPath?.trim() || null,
        defaultMultiFileTemplate: template,
        theme: values.theme ?? "system",
      });
      message.success("设置已保存");
      onClose();
    } catch (e) {
      message.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="默认设置"
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={620}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical">
        <Form.Item name="theme" label="主题" style={{ marginTop: 4 }}>
          <Segmented
            block
            options={[
              { label: "跟随系统", value: "system" },
              { label: "亮色", value: "light" },
              { label: "暗色", value: "dark" },
            ]}
            onChange={(v) => setTheme(v as ThemePref)}
          />
        </Form.Item>
        <Form.Item
          label="默认 xray 可执行文件"
          tooltip="Profile 未单独指定时的回退项"
        >
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item name="defaultXrayPath" noStyle>
              <Input placeholder="xray / xray.exe" />
            </Form.Item>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={async () => {
                const res = await openDialog({ multiple: false, directory: false });
                if (typeof res === "string") form.setFieldValue("defaultXrayPath", res);
              }}
            >
              选择
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>

      <Typography.Title level={5} style={{ marginTop: 8 }}>
        多文件拆分模板
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        应用到多文件 Profile 时的拆分方案：文件名 → 归属的顶层配置键（"*" 收集剩余键）。
      </Typography.Paragraph>

      {rows.map((row) => (
        <Space.Compact key={row.key} style={{ width: "100%", marginBottom: 8 }}>
          <Input
            style={{ width: 200 }}
            value={row.file}
            placeholder="文件名，如 00_log.jsonc"
            onChange={(e) => updateRow(row.key, { file: e.target.value })}
          />
          <Input
            value={keysText(row)}
            placeholder="键，逗号分隔；* 表示其余键"
            onChange={(e) =>
              updateRow(row.key, { keys: e.target.value.split(",").map((s) => s.trim()) })
            }
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
          />
        </Space.Compact>
      ))}

      <Space style={{ marginTop: 8 }}>
        <Button
          icon={<PlusOutlined />}
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { key: crypto.randomUUID(), file: "", keys: [] },
            ])
          }
        >
          添加文件
        </Button>
        <Button
          icon={<UndoOutlined />}
          onClick={() =>
            setRows(DEFAULT_TEMPLATE.map((t, i) => ({ key: String(i), file: t.file, keys: t.keys })))
          }
        >
          恢复默认模板
        </Button>
      </Space>
      </ScrollArea>
    </Modal>
  );
}
