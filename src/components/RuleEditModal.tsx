import { useEffect, useMemo } from "react";
import {
  AutoComplete,
  Divider,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Typography,
} from "antd";
import { useAppStore } from "../store";
import { extractTags } from "../rules";
import type { RuleObject, TargetKind } from "../rules";
import JsonEditor from "./JsonEditor";
import ScrollArea from "./ScrollArea";

const NETWORK_OPTIONS = ["tcp", "udp", "tcp,udp"].map((v) => ({ value: v, label: v }));
const PROTOCOL_OPTIONS = ["http", "tls", "quic", "bittorrent"].map((v) => ({ value: v, label: v }));
const TARGET_OPTIONS = [
  { label: "出站 (outboundTag)", value: "outboundTag" },
  { label: "负载均衡器 (balancerTag)", value: "balancerTag" },
];

interface RuleEditModalProps {
  open: boolean;
  initial?: RuleObject | null;
  onClose: () => void;
  onSave: (rule: RuleObject) => void;
}

interface RuleFormValues {
  targetKind?: TargetKind;
  targetTag?: string;
  domain?: string[];
  ip?: string[];
  port?: string;
  sourcePort?: string;
  localPort?: string;
  network?: string;
  sourceIP?: string[];
  localIP?: string[];
  user?: string[];
  vlessRoute?: string;
  inboundTag?: string[];
  protocol?: string[];
  process?: string[];
  ruleTag?: string;
  attrsJson?: string;
  webhookJson?: string;
}

const NUM_KEYS = ["port", "sourcePort", "localPort", "vlessRoute"] as const;
const FREE_TAG_KEYS = ["domain", "ip", "localIP", "user", "process"] as const;

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numToStr(v: unknown): string | undefined {
  return typeof v === "number" || typeof v === "string" ? String(v) : undefined;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s !== "") : [];
}

function jsonValidator(_: unknown, v: string) {
  const s = (v ?? "").trim();
  if (!s) return Promise.resolve();
  try {
    JSON.parse(s);
    return Promise.resolve();
  } catch {
    return Promise.reject(new Error("JSON 格式错误"));
  }
}

const JSON_PLACEHOLDER: Record<string, string> = {
  attrsJson: '{"host": "example.com", ":path": "^/api/"}',
  webhookJson: '{"url": "http://127.0.0.1:9000/hook", "deduplication": 60}',
};

export default function RuleEditModal({ open, initial, onClose, onSave }: RuleEditModalProps) {
  const [form] = Form.useForm<RuleFormValues>();
  const targetKind = Form.useWatch("targetKind", form) as TargetKind | undefined;
  const sections = useAppStore((s) => s.sections);

  const outboundOptions = useMemo(
    () => extractTags(sections.outbounds).map((v) => ({ value: v })),
    [sections.outbounds],
  );
  const balancerOptions = useMemo(
    () => extractTags(sections["routing.balancers"]).map((v) => ({ value: v })),
    [sections["routing.balancers"]],
  );
  const inboundOptions = useMemo(
    () => extractTags(sections.inbounds).map((v) => ({ value: v })),
    [sections.inbounds],
  );
  const targetOptions = targetKind === "balancerTag" ? balancerOptions : outboundOptions;

  useEffect(() => {
    if (!open) return;
    const r = initial;
    const kind: TargetKind | undefined = r?.outboundTag
      ? "outboundTag"
      : r?.balancerTag
        ? "balancerTag"
        : undefined;
    form.setFieldsValue({
      targetKind: kind,
      targetTag: kind && r ? String(r[kind]) : "",
      domain: strArr(r?.domain),
      ip: strArr(r?.ip),
      port: numToStr(r?.port),
      sourcePort: numToStr(r?.sourcePort),
      localPort: numToStr(r?.localPort),
      network: typeof r?.network === "string" ? r.network : undefined,
      sourceIP: strArr(r?.sourceIP ?? r?.source),
      localIP: strArr(r?.localIP),
      user: strArr(r?.user),
      vlessRoute: numToStr(r?.vlessRoute),
      inboundTag: strArr(r?.inboundTag),
      protocol: strArr(r?.protocol),
      process: strArr(r?.process),
      ruleTag: typeof r?.ruleTag === "string" ? r.ruleTag : "",
      attrsJson: isPlainObj(r?.attrs) ? JSON.stringify(r.attrs, null, 2) : "",
      webhookJson: isPlainObj(r?.webhook) ? JSON.stringify(r.webhook, null, 2) : "",
    });
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const base: RuleObject = initial ? JSON.parse(JSON.stringify(initial)) : {};

    delete base.outboundTag;
    delete base.balancerTag;
    if (values.targetKind && values.targetTag?.trim()) {
      base[values.targetKind] = values.targetTag.trim();
    }

    for (const key of [...FREE_TAG_KEYS, "protocol"] as const) {
      const list = values[key];
      if (Array.isArray(list) && list.length > 0) {
        base[key] = list.map((s) => String(s)).filter((s) => s.trim() !== "");
      } else {
        delete base[key];
      }
    }

    const sourceArr = values.sourceIP ?? [];
    if (Array.isArray(sourceArr) && sourceArr.length > 0) {
      const clean = sourceArr.map((s) => String(s)).filter((s) => s.trim() !== "");
      const preferSource = Array.isArray(initial?.source) && !Array.isArray(initial?.sourceIP);
      base[preferSource ? "source" : "sourceIP"] = clean;
    } else {
      delete base.sourceIP;
      delete base.source;
    }

    const inboundArr = values.inboundTag ?? [];
    if (Array.isArray(inboundArr) && inboundArr.length > 0) {
      base.inboundTag = inboundArr.map((s) => String(s)).filter((s) => s.trim() !== "");
    } else {
      delete base.inboundTag;
    }

    for (const key of NUM_KEYS) {
      const s = String(values[key] ?? "").trim();
      if (!s) {
        delete base[key];
      } else {
        base[key] = /^\d+$/.test(s) ? Number(s) : s;
      }
    }

    if (values.network) {
      base.network = values.network;
    } else {
      delete base.network;
    }

    const ruleTag = String(values.ruleTag ?? "").trim();
    if (ruleTag) {
      base.ruleTag = ruleTag;
    } else {
      delete base.ruleTag;
    }

    for (const key of ["attrs", "webhook"] as const) {
      const s = String(values[`${key}Json`] ?? "").trim();
      if (!s) {
        delete base[key];
      } else {
        base[key] = JSON.parse(s);
      }
    }

    onSave(base);
  };

  return (
    <Modal
      open={open}
      title={initial ? "编辑规则" : "新增规则"}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={620}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <div className="target-block">
            <Typography.Text strong style={{ fontSize: 13 }}>
              转发目标（必填，出站 / 负载均衡器二选一）
            </Typography.Text>
            <Form.Item
              name="targetKind"
              rules={[{ required: true, message: "请选择转发目标类型" }]}
              style={{ marginTop: 10, marginBottom: 12 }}
            >
              <Radio.Group options={TARGET_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="targetTag"
              rules={[{ required: true, message: "请选择或输入目标标签" }]}
              style={{ marginBottom: 0 }}
            >
              <AutoComplete
                options={targetOptions}
                placeholder={
                  targetKind === "balancerTag"
                    ? "选择或输入负载均衡器 tag"
                    : "选择或输入出站 tag"
                }
              />
            </Form.Item>
          </div>

          <Divider titlePlacement="start" plain style={{ fontSize: 12, margin: "16px 0 12px" }}>
            匹配条件
          </Divider>

          {FREE_TAG_KEYS.map((key) => (
            <Form.Item
              key={key}
              name={key}
              label={KEY_LABELS[key]}
              tooltip={KEY_TOOLTIPS[key]}
            >
              <Select
                mode="tags"
                open={false}
                suffixIcon={null}
                placeholder={KEY_PLACEHOLDERS[key]}
              />
            </Form.Item>
          ))}

          <Form.Item name="port" label="目标端口 (port)" tooltip="形式 a、a-b 或逗号分隔混合，如 53,443,1000-2000">
            <Input placeholder="例如 53、80-90、443,1000-2000" />
          </Form.Item>
          <Form.Item name="sourcePort" label="来源端口 (sourcePort)" tooltip="格式同 port">
            <Input placeholder="例如 53、80-90、443,1000-2000" />
          </Form.Item>
          <Form.Item name="localPort" label="本地端口 (localPort)" tooltip="本地入站的端口范围，格式同 port">
            <Input placeholder="例如 1024-65535" />
          </Form.Item>
          <Form.Item name="network" label="网络 (network)" tooltip="tcp,udp 可匹配任意流量">
            <Select options={NETWORK_OPTIONS} allowClear placeholder="tcp / udp / tcp,udp" />
          </Form.Item>
          <Form.Item name="sourceIP" label="来源 IP (sourceIP)" tooltip="别名 source；支持 IP、CIDR、geoip:、ext:，回车添加多项">
            <Select
              mode="tags"
              open={false}
              suffixIcon={null}
              placeholder="例如 geoip:private、192.168.1.0/24"
            />
          </Form.Item>
          <Form.Item name="localIP" label="本地 IP (localIP)" tooltip="本地入站使用的 IP 范围数组，对 UDP 无效">
            <Select mode="tags" open={false} suffixIcon={null} placeholder="回车添加多项" />
          </Form.Item>
          <Form.Item name="user" label="用户邮箱 (user)" tooltip="来源用户邮箱地址数组，支持 regexp: 开头">
            <Select mode="tags" open={false} suffixIcon={null} placeholder="例如 user@example.com" />
          </Form.Item>
          <Form.Item name="vlessRoute" label="VLESS 路由 (vlessRoute)" tooltip="VLESS 入站 UUID 第七和第八字节按大端序编码的 uint16 值，写法同 port">
            <Input placeholder="例如 10-11、1234" />
          </Form.Item>
          <Form.Item name="inboundTag" label="入站标识 (inboundTag)" tooltip="匹配任意一项即生效；可从现有入站选择">
            <Select mode="tags" options={inboundOptions} placeholder="选择或输入入站 tag" />
          </Form.Item>
          <Form.Item name="protocol" label="协议 (protocol)" tooltip="需开启入站 sniffing 才能嗅探">
            <Select mode="multiple" options={PROTOCOL_OPTIONS} placeholder="http / tls / quic / bittorrent" />
          </Form.Item>
          <Form.Item name="process" label="进程 (process)" tooltip="匹配本机连接进程（仅 Windows/Linux），支持进程名/绝对路径/文件夹，self/ 与 xray/ 前缀">
            <Select mode="tags" open={false} suffixIcon={null} placeholder="例如 xray/、C:\\App\\browser.exe" />
          </Form.Item>

          <Divider titlePlacement="start" plain style={{ fontSize: 12, margin: "16px 0 12px" }}>
            高级（规则名 / HTTP 属性 / Webhook）
          </Divider>

          <Space direction="vertical" style={{ width: "100%" }}>
            <Form.Item name="ruleTag" label="规则名 (ruleTag)" tooltip="无实际作用，命中时在 Info 日志输出调试信息">
              <Input placeholder="例如：直连域名" />
            </Form.Item>
            <Form.Item
              name="attrsJson"
              label="HTTP 属性 (attrs)"
              tooltip="JSON 对象，键为头部名或 :method/:path 伪头部，值为正则"
              rules={[{ validator: jsonValidator }]}
            >
              <JsonEditor placeholder={JSON_PLACEHOLDER.attrsJson} />
            </Form.Item>
            <Form.Item
              name="webhookJson"
              label="Webhook"
              tooltip="命中规则时向指定 URL 发送 POST 通知的 JSON 配置 {url, deduplication, headers}"
              rules={[{ validator: jsonValidator }]}
            >
              <JsonEditor placeholder={JSON_PLACEHOLDER.webhookJson} />
            </Form.Item>
          </Space>
        </Form>
      </ScrollArea>
    </Modal>
  );
}

const KEY_LABELS: Record<string, string> = {
  domain: "域名 (domain)",
  ip: "IP (ip)",
  localIP: "本地 IP (localIP)",
  user: "用户邮箱 (user)",
  process: "进程 (process)",
};

const KEY_TOOLTIPS: Record<string, string> = {
  domain: "支持 keyword: / domain: / regexp: / full: / geosite: / ext: 等格式，回车添加多项",
  ip: "支持 IP、CIDR、geoip:、ext: 及 ! 反选，回车添加多项",
  localIP: "本地入站使用的 IP 范围数组，对 UDP 无效",
  user: "来源用户邮箱地址数组，支持 regexp: 开头",
  process: "匹配本机连接进程（仅 Windows/Linux），支持进程名/绝对路径/文件夹",
};

const KEY_PLACEHOLDERS: Record<string, string> = {
  domain: "例如 geosite:cn、keyword:google、regexp:^.*\\.com$",
  ip: "例如 geoip:cn、8.8.8.8、geoip:private",
  localIP: "例如 192.168.1.1、0.0.0.0",
  user: "例如 user@example.com",
  process: "例如 xray/、C:\\App\\browser.exe",
};
