import { useState } from "react";
import { Button, Form, Select, Typography } from "antd";
import { CodeOutlined, FormOutlined } from "@ant-design/icons";
import { parseJsonc } from "../json";
import { useAppStore } from "../store";
import SectionEditor from "./SectionEditor";

const STRATEGY_OPTIONS = [
  { value: "AsIs", label: "AsIs（默认，不做额外操作）" },
  { value: "IPIfNonMatch", label: "IPIfNonMatch（无规则命中时解析域名为 IP 再次匹配）" },
  { value: "IPOnDemand", label: "IPOnDemand（匹配前直接将域名解析为 IP）" },
];

const MATCHER_OPTIONS = [
  { value: "hybrid", label: "hybrid（默认，同时支持新旧域名匹配规则）" },
  { value: "linear", label: "linear（旧式线性匹配，仅匹配完整字符串）" },
];

interface RoutingFormProps {
  label?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export default function RoutingForm({ label }: RoutingFormProps) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const raw = useAppStore((s) => s.sections.routing);
  const setSection = useAppStore((s) => s.setSection);

  const parsed = (() => {
    if (!raw || !raw.trim()) return {};
    const v = parseJsonc(raw);
    return isObject(v) ? v : {};
  })();

  const str = (key: string) => (typeof parsed[key] === "string" ? (parsed[key] as string) : "");

  const write = (patch: Record<string, unknown>) => {
    const merged = { ...parsed, ...patch };
    for (const key of ["domainStrategy", "domainMatcher"]) {
      if (merged[key] === "" || merged[key] === undefined || merged[key] === null) {
        delete merged[key];
      }
    }
    setSection("routing", Object.keys(merged).length === 0 ? "" : JSON.stringify(merged, null, 2));
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
          <SectionEditor path="routing" value={raw} onChange={(v) => setSection("routing", v)} />
        </div>
      ) : (
        <div className="routing-form">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            路由规则与负载均衡器已在独立页签中编辑，此处仅配置全局选项。
          </Typography.Text>
          <Form layout="horizontal" style={{ marginTop: 8 }}>
            <Form.Item
              label="域名解析策略 (domainStrategy)"
              tooltip="无规则命中或规则要求域名时如何解析域名。AsIs 不做额外操作；IPIfNonMatch 在无规则命中时解析域名为 IP 再匹配一次；IPOnDemand 匹配前直接解析"
            >
              <Select
                value={str("domainStrategy") || undefined}
                onChange={(v) => write({ domainStrategy: v ?? "" })}
                options={STRATEGY_OPTIONS}
                allowClear
                placeholder="默认 AsIs"
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              label="域名匹配方式 (domainMatcher)"
              tooltip="hybrid 同时支持新旧匹配规则（推荐）；linear 为旧式线性匹配，仅匹配完整字符串"
            >
              <Select
                value={str("domainMatcher") || undefined}
                onChange={(v) => write({ domainMatcher: v ?? "" })}
                options={MATCHER_OPTIONS}
                allowClear
                placeholder="默认 hybrid"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Form>
        </div>
      )}
    </div>
  );
}
