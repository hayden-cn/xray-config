import { useState } from "react";
import { Button, Form, Input, Select, Switch, Typography } from "antd";
import { CodeOutlined, FormOutlined } from "@ant-design/icons";
import { parseJsonc } from "../json";
import { extractTags } from "../rules";
import { useAppStore } from "../store";
import SectionEditor from "./SectionEditor";

interface ObservatoryFormProps {
  label?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseObject(text: string): Record<string, unknown> {
  if (!text || !text.trim()) return {};
  const v = parseJsonc(text);
  return isObject(v) ? v : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

export default function ObservatoryForm({ label }: ObservatoryFormProps) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const raw = useAppStore((s) => s.sections.observatory);
  const outbounds = useAppStore((s) => s.sections.outbounds);
  const setSection = useAppStore((s) => s.setSection);
  const parsed = parseObject(raw);
  const outboundTags = extractTags(outbounds).map((value) => ({ value }));

  const write = (patch: Record<string, unknown>) => {
    const merged = { ...parsed, ...patch };
    for (const key of ["subjectSelector", "probeUrl", "probeInterval"]) {
      const value = merged[key];
      if (
        value === "" ||
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (isObject(value) && Object.keys(value).length === 0)
      ) {
        delete merged[key];
      }
    }
    if (merged.enableConcurrency === false) delete merged.enableConcurrency;
    setSection("observatory", Object.keys(merged).length === 0 ? "" : JSON.stringify(merged, null, 2));
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
          <SectionEditor path="observatory" value={raw} onChange={(v) => setSection("observatory", v)} />
        </div>
      ) : (
        <div className="observatory-form">
          <Form layout="horizontal" style={{ marginTop: 8 }}>
            <Form.Item
              label="观测对象 (subjectSelector)"
              tooltip="选择或输入出站 tag 前缀；匹配到的出站会被观测"
            >
              <Select
                mode="tags"
                value={strArray(parsed.subjectSelector)}
                onChange={(v) => write({ subjectSelector: v })}
                options={outboundTags}
                tokenSeparators={[",", "\n"]}
                placeholder="选择出站 tag 或输入前缀"
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item label="探测地址 (probeUrl)" tooltip="用于探测出站代理连接状态的网址">
              <Input
                value={str(parsed.probeUrl)}
                onChange={(e) => write({ probeUrl: e.target.value })}
                placeholder="例如 https://www.gstatic.com/generate_204"
              />
            </Form.Item>
            <Form.Item label="探测间隔 (probeInterval)" tooltip="数字加单位，如 10s、1m、2h45m">
              <Input
                value={str(parsed.probeInterval)}
                onChange={(e) => write({ probeInterval: e.target.value })}
                placeholder="默认由 Xray 决定"
              />
            </Form.Item>
            <Form.Item label="并发探测 (enableConcurrency)" tooltip="开启后并发探测全部匹配的出站，全部完成后再等待间隔">
              <Switch
                checked={parsed.enableConcurrency === true}
                onChange={(checked) => write({ enableConcurrency: checked })}
              />
            </Form.Item>
          </Form>
        </div>
      )}
    </div>
  );
}
