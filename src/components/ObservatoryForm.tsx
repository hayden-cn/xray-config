import { useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Switch,
  Typography,
} from "antd";
import { CodeOutlined, FormOutlined } from "@ant-design/icons";
import { parseJsonc } from "../json";
import { extractTags } from "../rules";
import { useAppStore } from "../store";
import SectionEditor from "./SectionEditor";

interface ObservatoryFormProps {
  label?: string;
}

/** 常规/突发观测二选一，对应 xray 配置项 observatory / burstObservatory */
type ObservatoryKind = "observatory" | "burstObservatory";

const KIND_OPTIONS: { label: string; value: ObservatoryKind }[] = [
  { label: "常规观测", value: "observatory" },
  { label: "突发观测", value: "burstObservatory" },
];

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

function isEmpty(value: unknown): boolean {
  return (
    value === "" ||
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0) ||
    (isObject(value) && Object.keys(value).length === 0)
  );
}

/** 默认选中已配置的那一种；两者都配置时常规观测优先 */
function inferKind(observatory: string, burstObservatory: string): ObservatoryKind {
  if (!observatory?.trim() && burstObservatory?.trim()) return "burstObservatory";
  return "observatory";
}

export default function ObservatoryForm({ label = "观测" }: ObservatoryFormProps) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const [manualKind, setManualKind] = useState<ObservatoryKind | null>(null);

  const rawObservatory = useAppStore((s) => s.sections.observatory);
  const rawBurst = useAppStore((s) => s.sections.burstObservatory);
  const outbounds = useAppStore((s) => s.sections.outbounds);
  const setSection = useAppStore((s) => s.setSection);
  const savedSections = useAppStore((s) => s.savedSections);

  // 初次读取/刷新/应用后重置手动选择，按当前已有配置重新默认选中
  useEffect(() => {
    setManualKind(null);
  }, [savedSections]);

  const kind = manualKind ?? inferKind(rawObservatory, rawBurst);
  const raw = kind === "observatory" ? rawObservatory : rawBurst;
  const parsed = parseObject(raw);
  const outboundTags = extractTags(outbounds).map((value) => ({ value }));
  const pingConfig = isObject(parsed.pingConfig) ? parsed.pingConfig : {};

  const otherKind = kind === "observatory" ? "burstObservatory" : "observatory";

  const write = (patch: Record<string, unknown>) => {
    const merged = { ...parsed, ...patch };
    if (kind === "observatory") {
      for (const key of ["subjectSelector", "probeUrl", "probeInterval"]) {
        if (isEmpty(merged[key])) delete merged[key];
      }
      if (merged.enableConcurrency === false) delete merged.enableConcurrency;
      setSection("observatory", Object.keys(merged).length === 0 ? "" : JSON.stringify(merged, null, 2));
    } else {
      for (const key of ["subjectSelector"]) {
        if (isEmpty(merged[key])) delete merged[key];
      }
      // burstObservatory 的 pingConfig 为必填项，至少保留空对象
      merged.pingConfig = isObject(merged.pingConfig) ? merged.pingConfig : {};
      setSection("burstObservatory", JSON.stringify(merged, null, 2));
    }
    // 常规/突发观测互斥，只保留当前选中的一种
    if (useAppStore.getState().sections[otherKind]) setSection(otherKind, "");
  };

  const writePingConfig = (patch: Record<string, unknown>) => {
    const next = { ...pingConfig, ...patch };
    for (const key of ["destination", "connectivity", "interval", "timeout", "httpMethod", "sampling"]) {
      if (isEmpty(next[key])) delete next[key];
    }
    write({ pingConfig: next });
  };

  const selectKind = (next: ObservatoryKind) => {
    if (next === kind) return;
    const from = kind;
    const { sections } = useAppStore.getState();
    // subjectSelector 为两种观测共有字段，切换时若当前已设置则同步到目标
    const selector = strArray(parseObject(sections[from]).subjectSelector);
    setManualKind(next);
    const p = parseObject(sections[next]);
    if (selector.length > 0) p.subjectSelector = selector;
    if (next === "burstObservatory" && !isObject(p.pingConfig)) p.pingConfig = {};
    setSection(next, Object.keys(p).length === 0 ? "" : JSON.stringify(p, null, 2));
    setSection(from, "");
  };

  const writeJson = (v: string) => {
    setSection(kind, v);
    // JSON 模式下同样保证互斥，只保留当前选中的一种
    if (useAppStore.getState().sections[otherKind]) setSection(otherKind, "");
  };

  return (
    <div className="section-card">
      <div className="section-card-head">
        <Typography.Text strong>{label}</Typography.Text>
        <div className="observatory-head-actions">
          <Segmented
            size="small"
            value={kind}
            options={KIND_OPTIONS}
            onChange={(v) => selectKind(v as ObservatoryKind)}
          />
          <Button
            size="small"
            type="text"
            icon={mode === "form" ? <CodeOutlined /> : <FormOutlined />}
            title={mode === "form" ? "切换到 JSON 编辑" : "切换到表单编辑"}
            onClick={() => setMode(mode === "form" ? "json" : "form")}
          />
        </div>
      </div>
      {mode === "json" ? (
        <div className="section-card-editor">
          <SectionEditor path={kind} value={raw} onChange={writeJson} />
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
            {kind === "observatory" ? (
              <>
                <Form.Item
                  label="探测地址 (probeUrl)"
                  tooltip="用于探测出站代理连接状态的网址"
                >
                  <Input
                    value={str(parsed.probeUrl)}
                    onChange={(e) => write({ probeUrl: e.target.value })}
                    placeholder="例如 https://www.gstatic.com/generate_204"
                  />
                </Form.Item>
                <Form.Item
                  label="探测间隔 (probeInterval)"
                  tooltip="数字加单位，如 10s、1m、2h45m"
                >
                  <Input
                    value={str(parsed.probeInterval)}
                    onChange={(e) => write({ probeInterval: e.target.value })}
                    placeholder="默认由 Xray 决定"
                  />
                </Form.Item>
                <Form.Item
                  label="并发探测 (enableConcurrency)"
                  tooltip="开启后并发探测全部匹配的出站，全部完成后再等待间隔"
                >
                  <Switch
                    checked={parsed.enableConcurrency === true}
                    onChange={(checked) => write({ enableConcurrency: checked })}
                  />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  label="探测地址 (destination)"
                  tooltip="应返回 HTTP 204；留空使用 Xray 默认值"
                >
                  <Input
                    value={str(pingConfig.destination)}
                    onChange={(e) => writePingConfig({ destination: e.target.value })}
                    placeholder="https://connectivitycheck.gstatic.com/generate_204"
                  />
                </Form.Item>
                <Form.Item
                  label="连通性检测 (connectivity)"
                  tooltip="本地网络连通性检测地址；空字符串表示不检测"
                >
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
              </>
            )}
          </Form>
        </div>
      )}
    </div>
  );
}
