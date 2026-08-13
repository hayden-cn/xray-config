import { useState } from "react";
import { Button, Form, Input, InputNumber, Select, Typography } from "antd";
import { CodeOutlined, FormOutlined } from "@ant-design/icons";
import { parseJsonc } from "../json";
import { extractTags } from "../rules";
import { useAppStore } from "../store";
import SectionEditor from "./SectionEditor";

interface BurstObservatoryFormProps {
  label?: string;
}

const HTTP_METHOD_OPTIONS = ["HEAD", "GET"].map((v) => ({ value: v, label: v }));

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

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

export default function BurstObservatoryForm({ label }: BurstObservatoryFormProps) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const raw = useAppStore((s) => s.sections.burstObservatory);
  const outbounds = useAppStore((s) => s.sections.outbounds);
  const setSection = useAppStore((s) => s.setSection);
  const parsed = parseObject(raw);
  const outboundTags = extractTags(outbounds).map((value) => ({ value }));
  const pingConfig = isObject(parsed.pingConfig) ? parsed.pingConfig : {};

  const write = (patch: Record<string, unknown>) => {
    const merged = { ...parsed, ...patch };
    for (const key of ["subjectSelector", "pingConfig"]) {
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
    setSection("burstObservatory", Object.keys(merged).length === 0 ? "" : JSON.stringify(merged, null, 2));
  };

  const writePingConfig = (patch: Record<string, unknown>) => {
    const next = { ...pingConfig, ...patch };
    for (const key of ["destination", "connectivity", "interval", "timeout", "httpMethod", "sampling"]) {
      const value = next[key];
      if (value === "" || value === undefined || value === null) delete next[key];
    }
    write({ pingConfig: next });
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
          <SectionEditor
            path="burstObservatory"
            value={raw}
            onChange={(v) => setSection("burstObservatory", v)}
          />
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
            <Form.Item label="探测地址 (destination)" tooltip="应返回 HTTP 204；留空使用 Xray 默认值">
              <Input
                value={str(pingConfig.destination)}
                onChange={(e) => writePingConfig({ destination: e.target.value })}
                placeholder="https://connectivitycheck.gstatic.com/generate_204"
              />
            </Form.Item>
            <Form.Item label="连通性检测 (connectivity)" tooltip="本地网络连通性检测地址；空字符串表示不检测">
              <Input
                value={str(pingConfig.connectivity)}
                onChange={(e) => writePingConfig({ connectivity: e.target.value })}
                placeholder="留空不检测"
              />
            </Form.Item>
            <Form.Item label="平均间隔 (interval)">
              <Input
                value={str(pingConfig.interval)}
                onChange={(e) => writePingConfig({ interval: e.target.value })}
                placeholder="默认 1m，最小 10s"
              />
            </Form.Item>
            <Form.Item label="超时 (timeout)">
              <Input
                value={str(pingConfig.timeout)}
                onChange={(e) => writePingConfig({ timeout: e.target.value })}
                placeholder="默认 5s"
              />
            </Form.Item>
            <Form.Item label="采样数量 (sampling)">
              <InputNumber
                value={num(pingConfig.sampling)}
                min={1}
                precision={0}
                onChange={(v) => writePingConfig({ sampling: v ?? undefined })}
                placeholder="默认 10"
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item label="HTTP 方法 (httpMethod)">
              <Select
                value={str(pingConfig.httpMethod) || undefined}
                onChange={(v) => writePingConfig({ httpMethod: v ?? "" })}
                options={HTTP_METHOD_OPTIONS}
                allowClear
                placeholder="默认 HEAD"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Form>
        </div>
      )}
    </div>
  );
}
