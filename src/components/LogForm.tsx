import { useState } from "react";
import { AutoComplete, Button, Form, Input, Select, Space, Switch, Typography } from "antd";
import { CodeOutlined, FolderOpenOutlined, FormOutlined } from "@ant-design/icons";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { parseJsonc } from "../json";
import { useAppStore } from "../store";
import SectionEditor from "./SectionEditor";

const LOGLEVEL_OPTIONS = ["debug", "info", "warning", "error", "none"].map((v) => ({
  value: v,
  label: v,
}));

const MASK_SUGGESTIONS = ["quarter", "half", "full"];

interface LogFormProps {
  label?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export default function LogForm({ label }: LogFormProps) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const raw = useAppStore((s) => s.sections.log);
  const setSection = useAppStore((s) => s.setSection);

  const parsed = (() => {
    if (!raw || !raw.trim()) return {};
    const v = parseJsonc(raw);
    return isObject(v) ? v : {};
  })();

  const str = (key: string) => (typeof parsed[key] === "string" ? (parsed[key] as string) : "");
  const dnsLog = typeof parsed.dnsLog === "boolean" ? parsed.dnsLog : false;

  const write = (patch: Record<string, unknown>) => {
    const merged = { ...parsed, ...patch };
    for (const key of ["access", "error", "loglevel", "maskAddress"]) {
      if (merged[key] === "" || merged[key] === undefined || merged[key] === null) {
        delete merged[key];
      }
    }
    if (merged.dnsLog === false) delete merged.dnsLog;
    setSection("log", Object.keys(merged).length === 0 ? "" : JSON.stringify(merged, null, 2));
  };

  const pickFile = async (key: "access" | "error") => {
    const res = await openDialog({ multiple: false, directory: false });
    if (typeof res === "string") write({ [key]: res });
  };

  return (
    <div className="section-card">
      <div className="section-card-head">
        <Typography.Text strong>{label}</Typography.Text>
        <Button
          size="small"
          type="text"
          icon={mode === "form" ? <CodeOutlined /> : <FormOutlined />}
          title={mode === "form" ? "切换到 JSON 编辑" : "切换到表单编辑"}
          onClick={() => setMode(mode === "form" ? "json" : "form")}
        />
      </div>
      {mode === "json" ? (
        <div className="section-card-editor">
          <SectionEditor path="log" value={raw} onChange={(v) => setSection("log", v)} />
        </div>
      ) : (
        <div className="log-form">
        <Form layout="horizontal" style={{ marginTop: 8 }}>
          <Form.Item label="访问日志 (access)" tooltip="留空时输出至 stdout；填写 none 关闭访问日志">
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={str("access")}
                onChange={(e) => write({ access: e.target.value })}
                placeholder="留空=stdout，none=关闭"
              />
              <Button icon={<FolderOpenOutlined />} onClick={() => pickFile("access")}>
                选择
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="错误日志 (error)" tooltip="留空时输出至 stdout；填写 none 关闭错误日志">
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={str("error")}
                onChange={(e) => write({ error: e.target.value })}
                placeholder="留空=stdout，none=关闭"
              />
              <Button icon={<FolderOpenOutlined />} onClick={() => pickFile("error")}>
                选择
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="日志级别 (loglevel)" tooltip="默认 warning。debug 包含全部 info；info 包含全部 warning；warning 包含全部 error；none 不记录任何内容">
            <Select
              value={str("loglevel") || undefined}
              onChange={(v) => write({ loglevel: v ?? "" })}
              options={LOGLEVEL_OPTIONS}
              allowClear
              placeholder="默认 warning"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="DNS 日志 (dnsLog)" tooltip="是否启用 DNS 查询日志">
            <Switch checked={dnsLog} onChange={(c) => write({ dnsLog: c })} />
          </Form.Item>
          <Form.Item label="IP 地址遮罩 (maskAddress)" tooltip="自动替换日志中出现的 IP 以保护隐私，默认为空即不启用">
            <AutoComplete
              value={str("maskAddress")}
              onChange={(v) => write({ maskAddress: v ?? "" })}
              options={MASK_SUGGESTIONS.map((v) => ({ value: v }))}
              allowClear
              placeholder="quarter / half / full 或自定义，如 /16+/32"
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
        </div>
      )}
    </div>
  );
}
