import { useEffect, useState } from "react";
import {
  App,
  Button,
  Collapse,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { InboundObject, VlessInboundSettings, VlessInboundUser } from "../inbounds";
import { useAppStore } from "../store";
import JsonEditor from "./JsonEditor";
import ScrollArea from "./ScrollArea";

const PROTOCOL_OPTIONS = [
  { value: "vless", label: "VLESS（无加密，需配合 XTLS/TLS 传输）" },
  { value: "vmess", label: "VMess（老牌加密协议）" },
  { value: "trojan", label: "Trojan（TLS 伪装）" },
  { value: "shadowsocks", label: "Shadowsocks" },
  { value: "socks", label: "SOCKS（代理客户端）" },
  { value: "http", label: "HTTP（代理客户端）" },
  { value: "wireguard", label: "WireGuard" },
  { value: "hysteria", label: "Hysteria（QUIC）" },
  { value: "tun", label: "TUN（虚拟网卡）" },
  { value: "tunnel", label: "Tunnel（隧道）" },
];

const DEST_OVERRIDE_OPTIONS = ["http", "tls", "quic", "fakedns"].map((v) => ({ value: v, label: v }));

const VLESS_FLOW_OPTIONS = [
  { value: "xtls-rprx-vision", label: "xtls-rprx-vision" },
];

const SOCKS_AUTH_OPTIONS = [
  { value: "noauth", label: "noauth（匿名访问，默认）" },
  { value: "password", label: "password（账号密码认证）" },
];

const METHOD_OPTIONS = [
  { value: "raw", label: "raw（默认，普通 TCP）" },
  { value: "xhttp", label: "xhttp（HTTP 传输）" },
  { value: "mkcp", label: "mkcp（mKCP）" },
  { value: "grpc", label: "grpc（gRPC）" },
  { value: "websocket", label: "websocket（WebSocket）" },
  { value: "httpupgrade", label: "httpupgrade（HTTPUpgrade）" },
  { value: "hysteria", label: "hysteria（Hysteria2 QUIC）" },
];

const METHOD_LABELS: Record<string, string> = {
  xhttp: "XHTTP",
  mkcp: "mKCP",
  grpc: "gRPC",
  websocket: "WebSocket",
  httpupgrade: "HTTPUpgrade",
  hysteria: "Hysteria",
};

/** method → 对应 settings 字段名 */
const METHOD_SETTINGS_KEYS: Record<string, string> = {
  xhttp: "xhttpSettings",
  mkcp: "kcpSettings",
  grpc: "grpcSettings",
  websocket: "wsSettings",
  httpupgrade: "httpupgradeSettings",
  hysteria: "hysteriaSettings",
};

const RAW_HEADER_OPTIONS = [
  { value: "none", label: "none（不伪装）" },
  { value: "http", label: "http（HTTP 伪装）" },
];

const SECURITY_OPTIONS = [
  { value: "none", label: "none（不启用，默认）" },
  { value: "reality", label: "reality（REALITY 协议）" },
  { value: "tls", label: "tls（TLS）" },
];

const REALITY_FINGERPRINT_OPTIONS = [
  "chrome",
  "firefox",
  "safari",
  "ios",
  "android",
  "edge",
  "360",
  "qq",
  "random",
  "randomized",
].map((v) => ({ value: v, label: v }));

interface InboundEditModalProps {
  open: boolean;
  initial?: InboundObject | null;
  onClose: () => void;
  onSave: (inbound: InboundObject) => void;
}

interface VlessUserFormValues {
  id?: string;
  email?: string;
  level?: number | null;
  flow?: string;
}

interface VlessFallbackFormValues {
  name?: string;
  alpn?: string;
  path?: string;
  dest?: string;
  xver?: number | null;
}

interface AccountUserFormValues {
  user?: string;
  pass?: string;
}

interface WireguardPeerFormValues {
  publicKey?: string;
  presharedKey?: string;
  allowedIPs?: string[];
  endpoint?: string;
  keepAlive?: number | null;
}

interface InboundFormValues {
  tag?: string;
  listen?: string;
  port?: string;
  protocol?: string;
  sniffingEnabled?: boolean;
  destOverride?: string[];
  metadataOnly?: boolean;
  domainsExcluded?: string[];
  ipsExcluded?: string[];
  routeOnly?: boolean;
  settingsJson?: string;
  vlessFlow?: string;
  vlessDecryption?: string;
  socksAuth?: string;
  socksUdp?: boolean;
  socksIp?: string;
  socksUserLevel?: number | null;
  httpTimeout?: number | null;
  httpAllowTransparent?: boolean;
  httpUserLevel?: number | null;
  wireguardSecretKey?: string;
  wireguardAddress?: string[];
  method?: string;
  rawAcceptProxyProtocol?: boolean;
  rawHeaderType?: string;
  rawHeaderRequestJson?: string;
  rawHeaderResponseJson?: string;
  methodSettingsJson?: string;
  security?: string;
  realityShow?: boolean;
  realityTarget?: string;
  realityXver?: number | null;
  realityServerNames?: string[];
  realityPrivateKey?: string;
  realityMinClientVer?: string;
  realityMaxClientVer?: string;
  realityMaxTimeDiff?: number | null;
  realityShortIds?: string[];
  realityMldsa65Seed?: string;
  realityServerName?: string;
  realityFingerprint?: string;
  realityPassword?: string;
  realityShortId?: string;
  realityMldsa65Verify?: string;
  realitySpiderX?: string;
  tlsSettingsJson?: string;
  sockoptJson?: string;
  finalmaskJson?: string;
  otherStreamJson?: string;
}

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numToStr(v: unknown): string | undefined {
  return typeof v === "number" || typeof v === "string" ? String(v) : undefined;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s !== "") : [];
}

function boolVal(v: unknown): boolean {
  return typeof v === "boolean" ? v : false;
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

function mapAccounts(v: unknown): AccountUserFormValues[] {
  if (!Array.isArray(v)) return [];
  return v.map((a) => ({
    user: isPlainObj(a) && typeof a.user === "string" ? a.user : "",
    pass: isPlainObj(a) && typeof a.pass === "string" ? a.pass : "",
  }));
}

function mapPeers(v: unknown): WireguardPeerFormValues[] {
  if (!Array.isArray(v)) return [];
  return v.map((p) => {
    if (!isPlainObj(p)) {
      return { publicKey: "", presharedKey: "", allowedIPs: [], endpoint: "", keepAlive: undefined };
    }
    return {
      publicKey: typeof p.publicKey === "string" ? p.publicKey : "",
      presharedKey: typeof p.presharedKey === "string" ? p.presharedKey : "",
      allowedIPs: strArr(p.allowedIPs),
      endpoint: typeof p.endpoint === "string" ? p.endpoint : "",
      keepAlive: typeof p.keepAlive === "number" ? p.keepAlive : undefined,
    };
  });
}

function mergeAccountValues(
  originals: Array<Record<string, unknown>>,
  values: AccountUserFormValues[],
): Array<Record<string, unknown>> {
  return values.map((a) => {
    const user = String(a.user ?? "").trim();
    const orig = originals.find((o) => typeof o.user === "string" && o.user === user);
    const merged: Record<string, unknown> = orig ? JSON.parse(JSON.stringify(orig)) : {};
    if (user) {
      merged.user = user;
    } else {
      delete merged.user;
    }
    const pass = String(a.pass ?? "").trim();
    if (pass) {
      merged.pass = pass;
    } else {
      delete merged.pass;
    }
    return merged;
  });
}

function mergePeerValues(
  originals: Array<Record<string, unknown>>,
  values: WireguardPeerFormValues[],
): Array<Record<string, unknown>> {
  return values.map((p) => {
    const publicKey = String(p.publicKey ?? "").trim();
    const orig = originals.find((o) => typeof o.publicKey === "string" && o.publicKey === publicKey);
    const merged: Record<string, unknown> = orig ? JSON.parse(JSON.stringify(orig)) : {};
    if (publicKey) {
      merged.publicKey = publicKey;
    } else {
      delete merged.publicKey;
    }
    const presharedKey = String(p.presharedKey ?? "").trim();
    if (presharedKey) {
      merged.presharedKey = presharedKey;
    } else {
      delete merged.presharedKey;
    }
    const allowedIPs = (p.allowedIPs ?? []).map((s) => String(s)).filter((s) => s.trim() !== "");
    if (allowedIPs.length > 0) {
      merged.allowedIPs = allowedIPs;
    } else {
      delete merged.allowedIPs;
    }
    const endpoint = String(p.endpoint ?? "").trim();
    if (endpoint) {
      merged.endpoint = endpoint;
    } else {
      delete merged.endpoint;
    }
    if (typeof p.keepAlive === "number") {
      merged.keepAlive = p.keepAlive;
    } else {
      delete merged.keepAlive;
    }
    return merged;
  });
}

function mapFallbacks(v: unknown): VlessFallbackFormValues[] {
  if (!Array.isArray(v)) return [];
  return v.map((f) => {
    if (!isPlainObj(f)) {
      return { name: "", alpn: "", path: "", dest: "", xver: undefined };
    }
    return {
      name: typeof f.name === "string" ? f.name : "",
      alpn: typeof f.alpn === "string" ? f.alpn : "",
      path: typeof f.path === "string" ? f.path : "",
      dest: typeof f.dest === "string" ? f.dest : "",
      xver: typeof f.xver === "number" ? f.xver : undefined,
    };
  });
}

function mergeFallbackValues(
  originals: Array<Record<string, unknown>>,
  values: VlessFallbackFormValues[],
): Array<Record<string, unknown>> {
  return values.map((f) => {
    const dest = String(f.dest ?? "").trim();
    const orig = originals.find((o) => typeof o.dest === "string" && o.dest === dest);
    const merged: Record<string, unknown> = orig ? JSON.parse(JSON.stringify(orig)) : {};
    const name = String(f.name ?? "").trim();
    if (name) {
      merged.name = name;
    } else {
      delete merged.name;
    }
    const alpn = String(f.alpn ?? "").trim();
    if (alpn) {
      merged.alpn = alpn;
    } else {
      delete merged.alpn;
    }
    const path = String(f.path ?? "").trim();
    if (path) {
      merged.path = path;
    } else {
      delete merged.path;
    }
    if (dest) {
      merged.dest = dest;
    } else {
      delete merged.dest;
    }
    if (typeof f.xver === "number") {
      merged.xver = f.xver;
    } else {
      delete merged.xver;
    }
    return merged;
  });
}

const STREAM_KNOWN_KEYS = new Set([
  "method",
  "security",
  "rawSettings",
  "realitySettings",
  "tlsSettings",
  "xhttpSettings",
  "kcpSettings",
  "grpcSettings",
  "wsSettings",
  "httpupgradeSettings",
  "hysteriaSettings",
  "sockopt",
  "finalmask",
]);

interface VlessUserModalProps {
  open: boolean;
  initial: VlessUserFormValues | null;
  onClose: () => void;
  onSave: (user: VlessUserFormValues) => void;
}

function VlessUserModal({ open, initial, onClose, onSave }: VlessUserModalProps) {
  const [form] = Form.useForm<VlessUserFormValues>();
  const { message } = App.useApp();
  const [uuidLoading, setUuidLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      id: initial?.id ?? "",
      email: initial?.email ?? "",
      level: typeof initial?.level === "number" ? initial.level : undefined,
      flow: initial?.flow || undefined,
    });
  }, [open, initial, form]);

  const handleGenerate = async () => {
    const store = useAppStore.getState();
    const profile = store.profiles.find((p) => p.id === store.currentProfileId) ?? null;
    if (!profile) return;
    setUuidLoading(true);
    try {
      const uuid = await api.generateUuid(profile, store.settings);
      form.setFieldValue("id", uuid);
    } catch (e) {
      message.error(String(e));
    } finally {
      setUuidLoading(false);
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    onSave({
      id: String(values.id ?? "").trim(),
      email: String(values.email ?? "").trim(),
      level: typeof values.level === "number" ? values.level : undefined,
      flow: typeof values.flow === "string" && values.flow.trim() ? values.flow.trim() : undefined,
    });
  };

  return (
    <Modal
      open={open}
      title={initial ? "编辑用户" : "新增用户"}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={520}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="id"
            label="用户 ID (id)"
            tooltip="任意小于 30 字节的字符串或合法 UUID"
            rules={[{ required: true, message: "请输入用户 ID" }]}
          >
            <Input
              placeholder="UUID 或任意小于 30 字节的字符串"
              addonAfter={
                <Tooltip title="调用 xray uuid 随机生成">
                  <Button
                    type="text"
                    size="small"
                    loading={uuidLoading}
                    icon={<ThunderboltOutlined />}
                    onClick={handleGenerate}
                    style={{ margin: "-4px -7px", height: 22 }}
                  />
                </Tooltip>
              }
            />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱 (email)"
            tooltip="用于区分不同用户的流量（日志、统计）"
          >
            <Input placeholder="例如 user@example.com" />
          </Form.Item>
          <Form.Item
            name="level"
            label="用户等级 (level)"
            tooltip="对应 policy 中 level 的值，默认 0"
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
          </Form.Item>
          <Form.Item
            name="flow"
            label="流控 (flow)"
            tooltip="空字符为普通 TLS 代理，xtls-rprx-vision 为新 XTLS 模式"
          >
            <Select options={VLESS_FLOW_OPTIONS} allowClear placeholder="空（普通 TLS 代理）" />
          </Form.Item>
        </Form>
      </ScrollArea>
    </Modal>
  );
}

interface VlessFallbackModalProps {
  open: boolean;
  initial: VlessFallbackFormValues | null;
  onClose: () => void;
  onSave: (f: VlessFallbackFormValues) => void;
}

function VlessFallbackModal({ open, initial, onClose, onSave }: VlessFallbackModalProps) {
  const [form] = Form.useForm<VlessFallbackFormValues>();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: initial?.name ?? "",
      alpn: initial?.alpn ?? "",
      path: initial?.path ?? "",
      dest: initial?.dest ?? "",
      xver: typeof initial?.xver === "number" ? initial.xver : undefined,
    });
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    onSave({
      name: String(values.name ?? "").trim(),
      alpn: String(values.alpn ?? "").trim(),
      path: String(values.path ?? "").trim(),
      dest: String(values.dest ?? "").trim(),
      xver: typeof values.xver === "number" ? values.xver : undefined,
    });
  };

  return (
    <Modal
      open={open}
      title={initial ? "编辑回落" : "新增回落"}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={520}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="dest"
            label="回落地址 (dest)"
            tooltip="必填。可填端口号，如 8080；或地址+端口，如 127.0.0.1:8080"
            rules={[{ required: true, message: "请输入回落地址" }]}
          >
            <Input placeholder="例如 8080 或 127.0.0.1:8080" />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称 (name)"
            tooltip="选填。用于区分多个回落，仅用于调试展示"
          >
            <Input placeholder="例如 v2ray（可选）" />
          </Form.Item>
          <Form.Item
            name="alpn"
            label="ALPN (alpn)"
            tooltip="选填。TLS ALPN 协商结果，如 h2、http/1.1"
          >
            <Input placeholder="例如 h2（可选）" />
          </Form.Item>
          <Form.Item
            name="path"
            label="路径 (path)"
            tooltip="选填。HTTP 路径，用于 CDN 或 WebSocket 类回落"
          >
            <Input placeholder="例如 /path（可选）" />
          </Form.Item>
          <Form.Item
            name="xver"
            label="代理协议版本 (xver)"
            tooltip="选填。回落的真实连接是否携带 PROXY 协议信息，填 1 或 2，其余值等同于 0"
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
          </Form.Item>
        </Form>
      </ScrollArea>
    </Modal>
  );
}

interface ItemListEntry {
  key: number;
  title: string;
  subtitle?: string;
  editTitle: string;
  deleteTitle: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** 数组类字段的通用列表展示（条目 + 编辑/删除 + 新增按钮） */
function ItemList({
  items,
  emptyText,
  addText,
  onAdd,
}: {
  items: ItemListEntry[];
  emptyText: string;
  addText: string;
  onAdd: () => void;
}) {
  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      ) : (
        items.map((item) => (
          <Space key={item.key} align="center" style={{ width: "100%", padding: "4px 0" }}>
            <Typography.Text
              strong
              style={{
                fontSize: 12,
                width: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              ellipsis
            >
              {item.title}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {item.subtitle || "无附加信息"}
            </Typography.Text>
            <Tooltip title={item.editTitle}>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={item.onEdit} />
            </Tooltip>
            <Popconfirm title={item.deleteTitle} okText="删除" cancelText="取消" onConfirm={item.onDelete}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ))
      )}
      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAdd}>
        {addText}
      </Button>
    </Space>
  );
}

interface AccountUserModalProps {
  open: boolean;
  initial: AccountUserFormValues | null;
  onClose: () => void;
  onSave: (a: AccountUserFormValues) => void;
}

function AccountUserModal({ open, initial, onClose, onSave }: AccountUserModalProps) {
  const [form] = Form.useForm<AccountUserFormValues>();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      user: initial?.user ?? "",
      pass: initial?.pass ?? "",
    });
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    onSave({
      user: String(values.user ?? "").trim(),
      pass: String(values.pass ?? "").trim(),
    });
  };

  return (
    <Modal
      open={open}
      title={initial ? "编辑账号" : "新增账号"}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={460}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="user"
            label="用户名 (user)"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="账号用户名" />
          </Form.Item>
          <Form.Item name="pass" label="密码 (pass)">
            <Input placeholder="账号密码" />
          </Form.Item>
        </Form>
      </ScrollArea>
    </Modal>
  );
}

interface WireguardPeerModalProps {
  open: boolean;
  initial: WireguardPeerFormValues | null;
  onClose: () => void;
  onSave: (p: WireguardPeerFormValues) => void;
}

function WireguardPeerModal({ open, initial, onClose, onSave }: WireguardPeerModalProps) {
  const [form] = Form.useForm<WireguardPeerFormValues>();
  const { message } = App.useApp();
  const [keyFileLoading, setKeyFileLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      publicKey: initial?.publicKey ?? "",
      presharedKey: initial?.presharedKey ?? "",
      allowedIPs: initial?.allowedIPs ?? [],
      endpoint: initial?.endpoint ?? "",
      keepAlive: typeof initial?.keepAlive === "number" ? initial.keepAlive : undefined,
    });
  }, [open, initial, form]);

  const handleSelectKeyFile = async () => {
    const res = await openDialog({ multiple: false, directory: false });
    if (typeof res !== "string" || !res) return;
    setKeyFileLoading(true);
    try {
      const content = await api.readTextFile(res);
      form.setFieldValue("publicKey", content.trim());
    } catch (e) {
      message.error(String(e));
    } finally {
      setKeyFileLoading(false);
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    onSave({
      publicKey: String(values.publicKey ?? "").trim(),
      presharedKey: String(values.presharedKey ?? "").trim(),
      allowedIPs: (values.allowedIPs ?? []).map((s) => String(s)).filter((s) => s.trim() !== ""),
      endpoint: String(values.endpoint ?? "").trim(),
      keepAlive: typeof values.keepAlive === "number" ? values.keepAlive : undefined,
    });
  };

  return (
    <Modal
      open={open}
      title={initial ? "编辑对端" : "新增对端"}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={520}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            label="公钥 (publicKey)"
            required
            tooltip="对端 WireGuard 公钥，必填；可点击右侧按钮从公钥文件读取"
          >
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item
                name="publicKey"
                noStyle
                rules={[{ required: true, message: "请输入公钥" }]}
              >
                <Input placeholder="WireGuard 公钥" />
              </Form.Item>
              <Button
                icon={<FileTextOutlined />}
                loading={keyFileLoading}
                onClick={handleSelectKeyFile}
              >
                选择文件
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="presharedKey" label="预共享密钥 (presharedKey)" tooltip="可选，两端一致才生效">
            <Input placeholder="预共享密钥（可选）" />
          </Form.Item>
          <Form.Item name="allowedIPs" label="允许的 IP (allowedIPs)" tooltip="该对端允许的 IP/CIDR 列表，回车或逗号分隔">
            <Select mode="tags" placeholder="例如 0.0.0.0/0" tokenSeparators={[",", "，"]} />
          </Form.Item>
          <Form.Item name="endpoint" label="端点 (endpoint)" tooltip="UDP 地址，格式 host:port">
            <Input placeholder="例如 127.0.0.1:1234" />
          </Form.Item>
          <Form.Item name="keepAlive" label="保活间隔 (keepAlive)" tooltip="单位为秒，0 表示禁用">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
          </Form.Item>
        </Form>
      </ScrollArea>
    </Modal>
  );
}

export default function InboundEditModal({ open, initial, onClose, onSave }: InboundEditModalProps) {
  const [form] = Form.useForm<InboundFormValues>();
  const protocol = Form.useWatch("protocol", form) as string | undefined;
  const method = Form.useWatch("method", form) as string | undefined;
  const rawHeaderType = Form.useWatch("rawHeaderType", form) as string | undefined;
  const security = Form.useWatch("security", form) as string | undefined;

  const [vlessUsers, setVlessUsers] = useState<VlessUserFormValues[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserIndex, setEditingUserIndex] = useState<number | null>(null);
  const [vlessFallbacks, setVlessFallbacks] = useState<VlessFallbackFormValues[]>([]);
  const [fallbackModalOpen, setFallbackModalOpen] = useState(false);
  const [editingFallbackIndex, setEditingFallbackIndex] = useState<number | null>(null);
  const [socksAccounts, setSocksAccounts] = useState<AccountUserFormValues[]>([]);
  const [httpAccounts, setHttpAccounts] = useState<AccountUserFormValues[]>([]);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccountIndex, setEditingAccountIndex] = useState<number | null>(null);
  const [wireguardPeers, setWireguardPeers] = useState<WireguardPeerFormValues[]>([]);
  const [peerModalOpen, setPeerModalOpen] = useState(false);
  const [editingPeerIndex, setEditingPeerIndex] = useState<number | null>(null);
  const [keyFileLoading, setKeyFileLoading] = useState(false);
  const [x25519Loading, setX25519Loading] = useState(false);
  const { message } = App.useApp();

  const handleGenerateX25519 = async () => {
    const store = useAppStore.getState();
    const profile = store.profiles.find((p) => p.id === store.currentProfileId) ?? null;
    if (!profile) return;
    setX25519Loading(true);
    try {
      const res = await api.generateX25519(profile, store.settings);
      form.setFieldsValue({
        realityPrivateKey: res.privateKey,
        realityPassword: res.publicKey,
      });
    } catch (e) {
      message.error(String(e));
    } finally {
      setX25519Loading(false);
    }
  };

  const handleSelectKeyFile = async () => {
    const res = await openDialog({ multiple: false, directory: false });
    if (typeof res !== "string" || !res) return;
    setKeyFileLoading(true);
    try {
      const content = await api.readTextFile(res);
      form.setFieldValue("wireguardSecretKey", content.trim());
    } catch (e) {
      message.error(String(e));
    } finally {
      setKeyFileLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const i = initial;
    const proto = typeof i?.protocol === "string" ? i.protocol : "";
    const settings = isPlainObj(i?.settings) ? i.settings : undefined;
    const vlessSettings = proto === "vless" && isPlainObj(settings) ? (settings as VlessInboundSettings) : undefined;

    const stream = isPlainObj(i?.streamSettings) ? i.streamSettings : undefined;
    const streamMethod = typeof stream?.method === "string" ? stream.method : undefined;
    const raw = isPlainObj(stream?.rawSettings) ? stream.rawSettings : undefined;
    const header = isPlainObj(raw?.header) ? raw.header : undefined;
    const reality = isPlainObj(stream?.realitySettings) ? stream.realitySettings : undefined;
    const streamSecurity = typeof stream?.security === "string" ? stream.security : undefined;
    const methodSettingsKey = streamMethod ? METHOD_SETTINGS_KEYS[streamMethod] : undefined;
    const methodSettings =
      methodSettingsKey && isPlainObj(stream?.[methodSettingsKey]) ? stream[methodSettingsKey] : undefined;
    const tlsSettings = isPlainObj(stream?.tlsSettings) ? stream.tlsSettings : undefined;
    const other: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(stream ?? {})) {
      if (!STREAM_KNOWN_KEYS.has(k)) other[k] = v;
    }

    form.setFieldsValue({
      tag: typeof i?.tag === "string" ? i.tag : "",
      listen: typeof i?.listen === "string" ? i.listen : "",
      port: numToStr(i?.port),
      protocol: proto || undefined,
      sniffingEnabled: boolVal(i?.sniffing?.enabled),
      destOverride: strArr(i?.sniffing?.destOverride),
      metadataOnly: boolVal(i?.sniffing?.metadataOnly),
      domainsExcluded: strArr(i?.sniffing?.domainsExcluded),
      ipsExcluded: strArr(i?.sniffing?.ipsExcluded),
      routeOnly: boolVal(i?.sniffing?.routeOnly),
      settingsJson:
        proto === "vless" || proto === "socks" || proto === "http" || proto === "wireguard"
          ? ""
          : settings
            ? JSON.stringify(settings, null, 2)
            : "",
      vlessFlow: typeof vlessSettings?.flow === "string" ? vlessSettings.flow : "",
      vlessDecryption:
        typeof vlessSettings?.decryption === "string" && vlessSettings.decryption
          ? vlessSettings.decryption
          : "none",
      socksAuth: proto === "socks" && typeof settings?.auth === "string" ? settings.auth : undefined,
      socksUdp: proto === "socks" ? boolVal(settings?.udp) : false,
      socksIp: proto === "socks" && typeof settings?.ip === "string" ? settings.ip : "",
      socksUserLevel:
        proto === "socks" && typeof settings?.userLevel === "number" ? settings.userLevel : undefined,
      httpTimeout:
        proto === "http" && typeof settings?.timeout === "number" ? settings.timeout : undefined,
      httpAllowTransparent: proto === "http" ? boolVal(settings?.allowTransparent) : false,
      httpUserLevel:
        proto === "http" && typeof settings?.userLevel === "number" ? settings.userLevel : undefined,
      wireguardSecretKey:
        proto === "wireguard" && typeof settings?.secretKey === "string" ? settings.secretKey : "",
      wireguardAddress: proto === "wireguard" ? strArr(settings?.address) : [],
      method: streamMethod,
      rawAcceptProxyProtocol: boolVal(raw?.acceptProxyProtocol),
      rawHeaderType: typeof header?.type === "string" ? header.type : undefined,
      rawHeaderRequestJson: isPlainObj(header?.request) ? JSON.stringify(header.request, null, 2) : "",
      rawHeaderResponseJson: isPlainObj(header?.response) ? JSON.stringify(header.response, null, 2) : "",
      methodSettingsJson: methodSettings ? JSON.stringify(methodSettings, null, 2) : "",
      security: streamSecurity,
      realityShow: boolVal(reality?.show),
      realityTarget: typeof reality?.target === "string" ? reality.target : "",
      realityXver: typeof reality?.xver === "number" ? reality.xver : undefined,
      realityServerNames: strArr(reality?.serverNames),
      realityPrivateKey: typeof reality?.privateKey === "string" ? reality.privateKey : "",
      realityMinClientVer: typeof reality?.minClientVer === "string" ? reality.minClientVer : "",
      realityMaxClientVer: typeof reality?.maxClientVer === "string" ? reality.maxClientVer : "",
      realityMaxTimeDiff: typeof reality?.maxTimeDiff === "number" ? reality.maxTimeDiff : undefined,
      realityShortIds: strArr(reality?.shortIds),
      realityMldsa65Seed: typeof reality?.mldsa65Seed === "string" ? reality.mldsa65Seed : "",
      realityServerName: typeof reality?.serverName === "string" ? reality.serverName : "",
      realityFingerprint: typeof reality?.fingerprint === "string" ? reality.fingerprint : undefined,
      realityPassword: typeof reality?.password === "string" ? reality.password : "",
      realityShortId: typeof reality?.shortId === "string" ? reality.shortId : "",
      realityMldsa65Verify: typeof reality?.mldsa65Verify === "string" ? reality.mldsa65Verify : "",
      realitySpiderX: typeof reality?.spiderX === "string" ? reality.spiderX : "",
      tlsSettingsJson: tlsSettings ? JSON.stringify(tlsSettings, null, 2) : "",
      sockoptJson: isPlainObj(stream?.sockopt) ? JSON.stringify(stream.sockopt, null, 2) : "",
      finalmaskJson: isPlainObj(stream?.finalmask) ? JSON.stringify(stream.finalmask, null, 2) : "",
      otherStreamJson: Object.keys(other).length > 0 ? JSON.stringify(other, null, 2) : "",
    });
    setVlessUsers(
      (vlessSettings?.users ?? []).map((u) => ({
        id: typeof u.id === "string" ? u.id : "",
        email: typeof u.email === "string" ? u.email : "",
        level: typeof u.level === "number" ? u.level : undefined,
        flow: typeof u.flow === "string" && u.flow ? u.flow : undefined,
      })),
    );
    setVlessFallbacks(proto === "vless" ? mapFallbacks(vlessSettings?.fallbacks) : []);
    setSocksAccounts(proto === "socks" ? mapAccounts(settings?.accounts) : []);
    setHttpAccounts(proto === "http" ? mapAccounts(settings?.accounts) : []);
    setWireguardPeers(proto === "wireguard" ? mapPeers(settings?.peers) : []);
    setEditingUserIndex(null);
    setEditingFallbackIndex(null);
    setEditingAccountIndex(null);
    setEditingPeerIndex(null);
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const base: InboundObject = initial ? JSON.parse(JSON.stringify(initial)) : {};

    const tag = String(values.tag ?? "").trim();
    if (tag) {
      base.tag = tag;
    } else {
      delete base.tag;
    }

    const listen = String(values.listen ?? "").trim();
    if (listen) {
      base.listen = listen;
    } else {
      delete base.listen;
    }

    const port = String(values.port ?? "").trim();
    if (port) {
      base.port = /^\d+$/.test(port) ? Number(port) : port;
    } else {
      delete base.port;
    }

    const protocolVal = String(values.protocol ?? "").trim();
    if (protocolVal) {
      base.protocol = protocolVal;
    } else {
      delete base.protocol;
    }

    const sniff = isPlainObj(base.sniffing) ? { ...base.sniffing } : {};
    if (values.sniffingEnabled) {
      sniff.enabled = true;
    } else {
      delete sniff.enabled;
    }
    const destOverride = (values.destOverride ?? []).map((s) => String(s)).filter((s) => s.trim() !== "");
    if (destOverride.length > 0) {
      sniff.destOverride = destOverride;
    } else {
      delete sniff.destOverride;
    }
    if (values.metadataOnly) {
      sniff.metadataOnly = true;
    } else {
      delete sniff.metadataOnly;
    }
    const domainsExcluded = (values.domainsExcluded ?? [])
      .map((s) => String(s))
      .filter((s) => s.trim() !== "");
    if (domainsExcluded.length > 0) {
      sniff.domainsExcluded = domainsExcluded;
    } else {
      delete sniff.domainsExcluded;
    }
    const ipsExcluded = (values.ipsExcluded ?? [])
      .map((s) => String(s))
      .filter((s) => s.trim() !== "");
    if (ipsExcluded.length > 0) {
      sniff.ipsExcluded = ipsExcluded;
    } else {
      delete sniff.ipsExcluded;
    }
    if (values.routeOnly) {
      sniff.routeOnly = true;
    } else {
      delete sniff.routeOnly;
    }
    if (Object.keys(sniff).length > 0) {
      base.sniffing = sniff;
    } else {
      delete base.sniffing;
    }

    if (protocolVal === "vless") {
      const settings: VlessInboundSettings = isPlainObj(base.settings)
        ? JSON.parse(JSON.stringify(base.settings))
        : {};
      const originals = Array.isArray(settings.users) ? settings.users : [];
      const users: VlessInboundUser[] = vlessUsers.map((u) => {
        const uid = String(u.id ?? "").trim();
        const orig = originals.find((o) => typeof o.id === "string" && o.id === uid);
        const merged: VlessInboundUser = orig ? JSON.parse(JSON.stringify(orig)) : {};
        if (uid) {
          merged.id = uid;
        } else {
          delete merged.id;
        }
        const email = String(u.email ?? "").trim();
        if (email) {
          merged.email = email;
        } else {
          delete merged.email;
        }
        if (typeof u.level === "number") {
          merged.level = u.level;
        } else {
          delete merged.level;
        }
        const flow = String(u.flow ?? "").trim();
        if (flow) {
          merged.flow = flow;
        } else {
          delete merged.flow;
        }
        return merged;
      });
      if (users.length > 0) {
        settings.users = users;
      } else {
        delete settings.users;
      }
      const vflow = String(values.vlessFlow ?? "").trim();
      if (vflow) {
        settings.flow = vflow;
      } else {
        delete settings.flow;
      }
      const decryption = String(values.vlessDecryption ?? "").trim();
      settings.decryption = decryption || "none";
      const originalsFallbacks = Array.isArray(settings.fallbacks) ? settings.fallbacks : [];
      const fallbacks = mergeFallbackValues(originalsFallbacks, vlessFallbacks);
      if (fallbacks.length > 0) {
        settings.fallbacks = fallbacks;
      } else {
        delete settings.fallbacks;
      }
      if (Object.keys(settings).length > 0) {
        base.settings = settings;
      } else {
        delete base.settings;
      }
    } else if (protocolVal === "socks") {
      const settings: Record<string, unknown> = isPlainObj(base.settings)
        ? JSON.parse(JSON.stringify(base.settings))
        : {};
      const auth = String(values.socksAuth ?? "").trim();
      if (auth) {
        settings.auth = auth;
      } else {
        delete settings.auth;
      }
      const originals = Array.isArray(settings.accounts) ? settings.accounts : [];
      const accounts = mergeAccountValues(originals, socksAccounts);
      if (accounts.length > 0) {
        settings.accounts = accounts;
      } else {
        delete settings.accounts;
      }
      if (values.socksUdp) {
        settings.udp = true;
      } else {
        delete settings.udp;
      }
      const ip = String(values.socksIp ?? "").trim();
      if (ip) {
        settings.ip = ip;
      } else {
        delete settings.ip;
      }
      if (typeof values.socksUserLevel === "number") {
        settings.userLevel = values.socksUserLevel;
      } else {
        delete settings.userLevel;
      }
      if (Object.keys(settings).length > 0) {
        base.settings = settings;
      } else {
        delete base.settings;
      }
    } else if (protocolVal === "http") {
      const settings: Record<string, unknown> = isPlainObj(base.settings)
        ? JSON.parse(JSON.stringify(base.settings))
        : {};
      if (typeof values.httpTimeout === "number") {
        settings.timeout = values.httpTimeout;
      } else {
        delete settings.timeout;
      }
      const originals = Array.isArray(settings.accounts) ? settings.accounts : [];
      const accounts = mergeAccountValues(originals, httpAccounts);
      if (accounts.length > 0) {
        settings.accounts = accounts;
      } else {
        delete settings.accounts;
      }
      if (values.httpAllowTransparent) {
        settings.allowTransparent = true;
      } else {
        delete settings.allowTransparent;
      }
      if (typeof values.httpUserLevel === "number") {
        settings.userLevel = values.httpUserLevel;
      } else {
        delete settings.userLevel;
      }
      if (Object.keys(settings).length > 0) {
        base.settings = settings;
      } else {
        delete base.settings;
      }
    } else if (protocolVal === "wireguard") {
      const settings: Record<string, unknown> = isPlainObj(base.settings)
        ? JSON.parse(JSON.stringify(base.settings))
        : {};
      const secretKey = String(values.wireguardSecretKey ?? "").trim();
      if (secretKey) {
        settings.secretKey = secretKey;
      } else {
        delete settings.secretKey;
      }
      const address = (values.wireguardAddress ?? []).map((s) => String(s)).filter((s) => s.trim() !== "");
      if (address.length > 0) {
        settings.address = address;
      } else {
        delete settings.address;
      }
      const originals = Array.isArray(settings.peers) ? settings.peers : [];
      const peers = mergePeerValues(originals, wireguardPeers);
      if (peers.length > 0) {
        settings.peers = peers;
      } else {
        delete settings.peers;
      }
      if (Object.keys(settings).length > 0) {
        base.settings = settings;
      } else {
        delete base.settings;
      }
    } else {
      const s = String(values.settingsJson ?? "").trim();
      if (s) {
        base.settings = JSON.parse(s);
      } else {
        delete base.settings;
      }
    }

    // ---- streamSettings ----
    const origStream: Record<string, unknown> = isPlainObj(initial?.streamSettings)
      ? JSON.parse(JSON.stringify(initial.streamSettings))
      : {};
    const streamBase: Record<string, unknown> = { ...origStream };

    const methodVal = String(values.method ?? "").trim();
    if (methodVal) {
      streamBase.method = methodVal;
    } else {
      delete streamBase.method;
    }

    for (const k of [
      "rawSettings",
      "xhttpSettings",
      "kcpSettings",
      "grpcSettings",
      "wsSettings",
      "httpupgradeSettings",
      "hysteriaSettings",
    ]) {
      delete streamBase[k];
    }
    if (!methodVal || methodVal === "raw") {
      const rawBase: Record<string, unknown> = isPlainObj(origStream.rawSettings)
        ? JSON.parse(JSON.stringify(origStream.rawSettings))
        : {};
      if (values.rawAcceptProxyProtocol) {
        rawBase.acceptProxyProtocol = true;
      } else {
        delete rawBase.acceptProxyProtocol;
      }
      const headerBase: Record<string, unknown> = isPlainObj(rawBase.header) ? { ...rawBase.header } : {};
      const headerType = String(values.rawHeaderType ?? "").trim();
      if (headerType) {
        headerBase.type = headerType;
      } else {
        delete headerBase.type;
      }
      if (headerType === "http") {
        const req = String(values.rawHeaderRequestJson ?? "").trim();
        if (req) {
          headerBase.request = JSON.parse(req);
        } else {
          delete headerBase.request;
        }
        const res = String(values.rawHeaderResponseJson ?? "").trim();
        if (res) {
          headerBase.response = JSON.parse(res);
        } else {
          delete headerBase.response;
        }
      } else {
        delete headerBase.request;
        delete headerBase.response;
      }
      if (Object.keys(headerBase).length > 0) {
        rawBase.header = headerBase;
      } else {
        delete rawBase.header;
      }
      if (Object.keys(rawBase).length > 0) {
        streamBase.rawSettings = rawBase;
      }
    } else if (methodVal && METHOD_SETTINGS_KEYS[methodVal]) {
      const key = METHOD_SETTINGS_KEYS[methodVal];
      const s = String(values.methodSettingsJson ?? "").trim();
      if (s) {
        streamBase[key] = JSON.parse(s);
      }
    }

    const securityVal = String(values.security ?? "").trim();
    if (securityVal) {
      streamBase.security = securityVal;
    } else {
      delete streamBase.security;
    }
    delete streamBase.realitySettings;
    delete streamBase.tlsSettings;
    if (securityVal === "reality") {
      const realityBase: Record<string, unknown> = isPlainObj(origStream.realitySettings)
        ? JSON.parse(JSON.stringify(origStream.realitySettings))
        : {};
      if (values.realityShow) {
        realityBase.show = true;
      } else {
        delete realityBase.show;
      }
      const realityTarget = String(values.realityTarget ?? "").trim();
      if (realityTarget) {
        realityBase.target = realityTarget;
      } else {
        delete realityBase.target;
      }
      if (typeof values.realityXver === "number") {
        realityBase.xver = values.realityXver;
      } else {
        delete realityBase.xver;
      }
      const serverNames = (values.realityServerNames ?? [])
        .map((s) => String(s))
        .filter((s) => s.trim() !== "");
      if (serverNames.length > 0) {
        realityBase.serverNames = serverNames;
      } else {
        delete realityBase.serverNames;
      }
      const privateKey = String(values.realityPrivateKey ?? "").trim();
      if (privateKey) {
        realityBase.privateKey = privateKey;
      } else {
        delete realityBase.privateKey;
      }
      const minClientVer = String(values.realityMinClientVer ?? "").trim();
      if (minClientVer) {
        realityBase.minClientVer = minClientVer;
      } else {
        delete realityBase.minClientVer;
      }
      const maxClientVer = String(values.realityMaxClientVer ?? "").trim();
      if (maxClientVer) {
        realityBase.maxClientVer = maxClientVer;
      } else {
        delete realityBase.maxClientVer;
      }
      if (typeof values.realityMaxTimeDiff === "number") {
        realityBase.maxTimeDiff = values.realityMaxTimeDiff;
      } else {
        delete realityBase.maxTimeDiff;
      }
      const shortIds = (values.realityShortIds ?? [])
        .map((s) => String(s))
        .filter((s) => s.trim() !== "");
      if (shortIds.length > 0) {
        realityBase.shortIds = shortIds;
      } else {
        delete realityBase.shortIds;
      }
      const mldsa65Seed = String(values.realityMldsa65Seed ?? "").trim();
      if (mldsa65Seed) {
        realityBase.mldsa65Seed = mldsa65Seed;
      } else {
        delete realityBase.mldsa65Seed;
      }
      const serverName = String(values.realityServerName ?? "").trim();
      if (serverName) {
        realityBase.serverName = serverName;
      } else {
        delete realityBase.serverName;
      }
      const fingerprint = String(values.realityFingerprint ?? "").trim();
      if (fingerprint) {
        realityBase.fingerprint = fingerprint;
      } else {
        delete realityBase.fingerprint;
      }
      const password = String(values.realityPassword ?? "").trim();
      if (password) {
        realityBase.password = password;
      } else {
        delete realityBase.password;
      }
      const shortId = String(values.realityShortId ?? "").trim();
      if (shortId) {
        realityBase.shortId = shortId;
      } else {
        delete realityBase.shortId;
      }
      const mldsa65Verify = String(values.realityMldsa65Verify ?? "").trim();
      if (mldsa65Verify) {
        realityBase.mldsa65Verify = mldsa65Verify;
      } else {
        delete realityBase.mldsa65Verify;
      }
      const spiderX = String(values.realitySpiderX ?? "").trim();
      if (spiderX) {
        realityBase.spiderX = spiderX;
      } else {
        delete realityBase.spiderX;
      }
      if (Object.keys(realityBase).length > 0) {
        streamBase.realitySettings = realityBase;
      }
    } else if (securityVal === "tls") {
      const s = String(values.tlsSettingsJson ?? "").trim();
      if (s) {
        streamBase.tlsSettings = JSON.parse(s);
      }
    }

    const sockopt = String(values.sockoptJson ?? "").trim();
    if (sockopt) {
      streamBase.sockopt = JSON.parse(sockopt);
    } else {
      delete streamBase.sockopt;
    }
    const finalmask = String(values.finalmaskJson ?? "").trim();
    if (finalmask) {
      streamBase.finalmask = JSON.parse(finalmask);
    } else {
      delete streamBase.finalmask;
    }
    const other = String(values.otherStreamJson ?? "").trim();
    if (other) {
      const parsed = JSON.parse(other) as Record<string, unknown>;
      if (isPlainObj(parsed)) {
        Object.assign(streamBase, parsed);
      }
    }

    if (Object.keys(streamBase).length > 0) {
      base.streamSettings = streamBase;
    } else {
      delete base.streamSettings;
    }

    onSave(base);
  };

  const isVless = protocol === "vless";
  const isSocks = protocol === "socks";
  const isHttp = protocol === "http";
  const isWireguard = protocol === "wireguard";

  return (
    <Modal
      open={open}
      title={initial ? "编辑入站" : "新增入站"}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={640}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            基础配置
          </Typography.Text>
          <Form.Item
            name="tag"
            label="标识 (tag)"
            tooltip="入站唯一标识，路由规则 inboundTag 与 API 热更新据此引用；非空时须在所有 tag 中唯一，可为空"
            style={{ marginTop: 10 }}
          >
            <Input placeholder="例如：入站 1（可选）" />
          </Form.Item>
          <Form.Item
            name="listen"
            label="监听地址 (listen)"
            tooltip="IP 地址或 Unix domain socket，默认 0.0.0.0 接收所有网卡连接"
          >
            <Input placeholder="0.0.0.0（默认）" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口 (port)"
            tooltip="整型数值；或 env: 开头的环境变量名；或数值字符串/范围，如 1234、5-10、11,13,15-17"
            rules={[{ required: true, message: "请输入端口" }]}
          >
            <Input placeholder="例如 1080、5-10、env:PORT" />
          </Form.Item>
          <Form.Item
            name="protocol"
            label="协议 (protocol)"
            tooltip="连接协议名称，不同协议 settings 结构不同"
            rules={[{ required: true, message: "请选择协议" }]}
          >
            <Select options={PROTOCOL_OPTIONS} placeholder="选择协议" />
          </Form.Item>

          <Collapse
            size="small"
            style={{ marginTop: 8 }}
            items={[
              {
                key: "settings",
                label: "协议设置 (settings)",
                children: !protocol ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    请先在上方选择协议，再配置对应的协议设置
                  </Typography.Text>
                ) : isVless ? (
                  <>
                    <Form.Item
                      name="vlessDecryption"
                      label="加密方式 (decryption)"
                      tooltip="VLESS 加密设置，不能留空，不使用加密需显式设置为 none"
                      rules={[{ required: true, message: "decryption 不能为空，不使用请填 none" }]}
                    >
                      <Input placeholder="none（默认，禁用加密）" />
                    </Form.Item>
                    <Form.Item
                      name="vlessFlow"
                      label="默认流控 (flow)"
                      tooltip="当用户未单独设置 flow 时作为默认值"
                    >
                      <Select options={VLESS_FLOW_OPTIONS} allowClear placeholder="空（普通 TLS 代理）" />
                    </Form.Item>
                    <Form.Item label="用户 (users)" tooltip="服务端认可的用户数组，点击条目或按钮新增/编辑">
                      <ItemList
                        items={vlessUsers.map((u, idx) => ({
                          key: idx,
                          title: u.id || "（无 ID）",
                          subtitle: [
                            u.email ? `邮箱：${u.email}` : "",
                            typeof u.level === "number" ? `level：${u.level}` : "",
                            u.flow ? `flow：${u.flow}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          editTitle: "编辑用户",
                          deleteTitle: "删除这个用户？",
                          onEdit: () => {
                            setEditingUserIndex(idx);
                            setUserModalOpen(true);
                          },
                          onDelete: () => {
                            setVlessUsers((prev) => prev.filter((_, i) => i !== idx));
                            if (editingUserIndex === idx) {
                              setEditingUserIndex(null);
                            }
                          },
                        }))}
                        emptyText="暂无用户，点击下方按钮新增"
                        addText="新增用户"
                        onAdd={() => {
                          setEditingUserIndex(null);
                          setUserModalOpen(true);
                        }}
                      />
                    </Form.Item>
                    <VlessUserModal
                      open={userModalOpen}
                      initial={editingUserIndex !== null ? vlessUsers[editingUserIndex] ?? null : null}
                      onClose={() => setUserModalOpen(false)}
                      onSave={(user) => {
                        if (editingUserIndex !== null) {
                          setVlessUsers((prev) =>
                            prev.map((item, idx) => (idx === editingUserIndex ? user : item)),
                          );
                        } else {
                          setVlessUsers((prev) => [...prev, user]);
                        }
                        setUserModalOpen(false);
                      }}
                    />
                    <Form.Item
                      label="回落分流 (fallbacks)"
                      tooltip="仅可用于 TCP+TLS 传输组合的 VLESS 入站，dest 必填，点击条目或按钮新增/编辑"
                      style={{ marginTop: 8 }}
                    >
                      <ItemList
                        items={vlessFallbacks.map((f, idx) => ({
                          key: idx,
                          title: f.dest || "（无回落地址）",
                          subtitle: [
                            f.name ? `名称：${f.name}` : "",
                            f.alpn ? `alpn：${f.alpn}` : "",
                            f.path ? `路径：${f.path}` : "",
                            typeof f.xver === "number" ? `xver：${f.xver}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          editTitle: "编辑回落",
                          deleteTitle: "删除这个回落？",
                          onEdit: () => {
                            setEditingFallbackIndex(idx);
                            setFallbackModalOpen(true);
                          },
                          onDelete: () => {
                            setVlessFallbacks((prev) => prev.filter((_, i) => i !== idx));
                            if (editingFallbackIndex === idx) {
                              setEditingFallbackIndex(null);
                            }
                          },
                        }))}
                        emptyText="暂无回落，点击下方按钮新增"
                        addText="新增回落"
                        onAdd={() => {
                          setEditingFallbackIndex(null);
                          setFallbackModalOpen(true);
                        }}
                      />
                    </Form.Item>
                    <VlessFallbackModal
                      open={fallbackModalOpen}
                      initial={editingFallbackIndex !== null ? vlessFallbacks[editingFallbackIndex] ?? null : null}
                      onClose={() => setFallbackModalOpen(false)}
                      onSave={(f) => {
                        if (editingFallbackIndex !== null) {
                          setVlessFallbacks((prev) =>
                            prev.map((item, idx) => (idx === editingFallbackIndex ? f : item)),
                          );
                        } else {
                          setVlessFallbacks((prev) => [...prev, f]);
                        }
                        setFallbackModalOpen(false);
                      }}
                    />
                  </>
                ) : isSocks ? (
                  <>
                    <Form.Item
                      name="socksAuth"
                      label="认证方式 (auth)"
                      tooltip="noauth 为匿名访问，password 需在 accounts 中配置账号密码"
                    >
                      <Select options={SOCKS_AUTH_OPTIONS} placeholder="noauth（默认，匿名）" />
                    </Form.Item>
                    <Form.Item
                      name="socksUdp"
                      label="支持 UDP (udp)"
                      tooltip="是否开启 UDP 协议支持"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="socksIp"
                      label="出站 IP (ip)"
                      tooltip="当连接被透明代理使用时，出站连接的源地址（默认 127.0.0.1）"
                    >
                      <Input placeholder="127.0.0.1（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="socksUserLevel"
                      label="用户等级 (userLevel)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item
                      label="账号 (accounts)"
                      tooltip="当 auth 为 password 时生效的账号数组，点击条目或按钮新增/编辑"
                    >
                      <ItemList
                        items={socksAccounts.map((a, idx) => ({
                          key: idx,
                          title: a.user || "（无用户名）",
                          subtitle: a.pass ? `密码：${a.pass}` : "",
                          editTitle: "编辑账号",
                          deleteTitle: "删除这个账号？",
                          onEdit: () => {
                            setEditingAccountIndex(idx);
                            setAccountModalOpen(true);
                          },
                          onDelete: () => {
                            setSocksAccounts((prev) => prev.filter((_, i) => i !== idx));
                            if (editingAccountIndex === idx) {
                              setEditingAccountIndex(null);
                            }
                          },
                        }))}
                        emptyText="暂无账号，点击下方按钮新增"
                        addText="新增账号"
                        onAdd={() => {
                          setEditingAccountIndex(null);
                          setAccountModalOpen(true);
                        }}
                      />
                    </Form.Item>
                    <AccountUserModal
                      open={accountModalOpen}
                      initial={editingAccountIndex !== null ? socksAccounts[editingAccountIndex] ?? null : null}
                      onClose={() => setAccountModalOpen(false)}
                      onSave={(a) => {
                        if (editingAccountIndex !== null) {
                          setSocksAccounts((prev) =>
                            prev.map((item, idx) => (idx === editingAccountIndex ? a : item)),
                          );
                        } else {
                          setSocksAccounts((prev) => [...prev, a]);
                        }
                        setAccountModalOpen(false);
                      }}
                    />
                  </>
                ) : isHttp ? (
                  <>
                    <Form.Item
                      name="httpTimeout"
                      label="超时 (timeout)"
                      tooltip="入站数据多久后未被读取则超时断开，单位秒，默认 300"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="300（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="httpAllowTransparent"
                      label="允许透明代理 (allowTransparent)"
                      tooltip="允许来自透明代理的 HTTP 请求"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="httpUserLevel"
                      label="用户等级 (userLevel)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item
                      label="账号 (accounts)"
                      tooltip="HTTP 代理认证账号数组，为空则匿名访问，点击条目或按钮新增/编辑"
                    >
                      <ItemList
                        items={httpAccounts.map((a, idx) => ({
                          key: idx,
                          title: a.user || "（无用户名）",
                          subtitle: a.pass ? `密码：${a.pass}` : "",
                          editTitle: "编辑账号",
                          deleteTitle: "删除这个账号？",
                          onEdit: () => {
                            setEditingAccountIndex(idx);
                            setAccountModalOpen(true);
                          },
                          onDelete: () => {
                            setHttpAccounts((prev) => prev.filter((_, i) => i !== idx));
                            if (editingAccountIndex === idx) {
                              setEditingAccountIndex(null);
                            }
                          },
                        }))}
                        emptyText="暂无账号，点击下方按钮新增"
                        addText="新增账号"
                        onAdd={() => {
                          setEditingAccountIndex(null);
                          setAccountModalOpen(true);
                        }}
                      />
                    </Form.Item>
                    <AccountUserModal
                      open={accountModalOpen}
                      initial={editingAccountIndex !== null ? httpAccounts[editingAccountIndex] ?? null : null}
                      onClose={() => setAccountModalOpen(false)}
                      onSave={(a) => {
                        if (editingAccountIndex !== null) {
                          setHttpAccounts((prev) =>
                            prev.map((item, idx) => (idx === editingAccountIndex ? a : item)),
                          );
                        } else {
                          setHttpAccounts((prev) => [...prev, a]);
                        }
                        setAccountModalOpen(false);
                      }}
                    />
                  </>
                ) : isWireguard ? (
                  <>
                    <Form.Item
                      label="私钥 (secretKey)"
                      required
                      tooltip="本机 WireGuard 私钥，必填；可点击右侧按钮从私钥文件读取"
                    >
                      <Space.Compact style={{ width: "100%" }}>
                        <Form.Item
                          name="wireguardSecretKey"
                          noStyle
                          rules={[{ required: true, message: "请输入私钥" }]}
                        >
                          <Input placeholder="WireGuard 私钥" />
                        </Form.Item>
                        <Button
                          icon={<FileTextOutlined />}
                          loading={keyFileLoading}
                          onClick={handleSelectKeyFile}
                        >
                          选择文件
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                    <Form.Item
                      name="wireguardAddress"
                      label="本机地址 (address)"
                      tooltip="本机地址列表，IPv4 必须为 /32、IPv6 必须为 /128，回车或逗号分隔"
                    >
                      <Select mode="tags" placeholder="例如 10.0.0.1/32" tokenSeparators={[",", "，"]} />
                    </Form.Item>
                    <Form.Item
                      label="对端 (peers)"
                      tooltip="WireGuard 对端配置数组，点击条目或按钮新增/编辑"
                    >
                      <ItemList
                        items={wireguardPeers.map((p, idx) => ({
                          key: idx,
                          title: p.publicKey || "（无公钥）",
                          subtitle: [
                            p.allowedIPs && p.allowedIPs.length > 0 ? `允许 IP：${p.allowedIPs.join(", ")}` : "",
                            p.endpoint ? `端点：${p.endpoint}` : "",
                            typeof p.keepAlive === "number" ? `保活：${p.keepAlive}s` : "",
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          editTitle: "编辑对端",
                          deleteTitle: "删除这个对端？",
                          onEdit: () => {
                            setEditingPeerIndex(idx);
                            setPeerModalOpen(true);
                          },
                          onDelete: () => {
                            setWireguardPeers((prev) => prev.filter((_, i) => i !== idx));
                            if (editingPeerIndex === idx) {
                              setEditingPeerIndex(null);
                            }
                          },
                        }))}
                        emptyText="暂无对端，点击下方按钮新增"
                        addText="新增对端"
                        onAdd={() => {
                          setEditingPeerIndex(null);
                          setPeerModalOpen(true);
                        }}
                      />
                    </Form.Item>
                    <WireguardPeerModal
                      open={peerModalOpen}
                      initial={editingPeerIndex !== null ? wireguardPeers[editingPeerIndex] ?? null : null}
                      onClose={() => setPeerModalOpen(false)}
                      onSave={(p) => {
                        if (editingPeerIndex !== null) {
                          setWireguardPeers((prev) =>
                            prev.map((item, idx) => (idx === editingPeerIndex ? p : item)),
                          );
                        } else {
                          setWireguardPeers((prev) => [...prev, p]);
                        }
                        setPeerModalOpen(false);
                      }}
                    />
                  </>
                ) : (
                  <Form.Item
                    name="settingsJson"
                    label={`协议配置 (settings) — ${protocol}`}
                    tooltip="各协议 settings 结构不同，此处直接编辑 JSON；vless/socks/http/wireguard 协议已有结构化表单"
                    rules={[{ validator: jsonValidator }]}
                  >
                    <JsonEditor placeholder="{}" />
                  </Form.Item>
                ),
              },
            ]}
          />

          <Collapse
            size="small"
            style={{ marginTop: 8 }}
            items={[
              {
                key: "stream",
                label: "传输配置 (streamSettings)",
                children: (
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Form.Item
                      name="method"
                      label="传输方式 (method)"
                      tooltip="数据流所使用的传输方式类型，默认 raw"
                    >
                      <Select options={METHOD_OPTIONS} allowClear placeholder="raw（默认）" />
                    </Form.Item>
                    {!method || method === "raw" ? (
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: "rawSettings",
                            label: "rawSettings",
                            children: (
                              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                                <Form.Item
                                  name="rawAcceptProxyProtocol"
                                  label="接受 PROXY 协议 (acceptProxyProtocol)"
                                  valuePropName="checked"
                                  tooltip="仅用于 inbound，指示是否接收 PROXY protocol，默认 false"
                                >
                                  <Switch />
                                </Form.Item>
                                <Form.Item
                                  name="rawHeaderType"
                                  label="伪装类型 (header.type)"
                                  tooltip="none 不进行伪装；http 进行 HTTP 伪装（含 request/response 伪造）"
                                >
                                  <Select options={RAW_HEADER_OPTIONS} allowClear placeholder="none（不伪装）" />
                                </Form.Item>
                                {rawHeaderType === "http" && (
                                  <Space direction="vertical" style={{ width: "100%" }}>
                                    <Form.Item
                                      name="rawHeaderRequestJson"
                                      label="伪装请求 (header.request)"
                                      tooltip="JSON 对象，version/method/path/headers，headers 值为字符串数组每次随机选一"
                                      rules={[{ validator: jsonValidator }]}
                                    >
                                      <JsonEditor
                                        placeholder={'{"version": "1.1", "method": "GET", "path": ["/"], "headers": {}}'}
                                      />
                                    </Form.Item>
                                    <Form.Item
                                      name="rawHeaderResponseJson"
                                      label="伪装响应 (header.response)"
                                      tooltip="JSON 对象，version/status/reason/headers"
                                      rules={[{ validator: jsonValidator }]}
                                    >
                                      <JsonEditor
                                        placeholder={'{"version": "1.1", "status": "200", "reason": "OK", "headers": {}}'}
                                      />
                                    </Form.Item>
                                  </Space>
                                )}
                              </Space>
                            ),
                          },
                        ]}
                      />
                    ) : METHOD_SETTINGS_KEYS[method] ? (
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: METHOD_SETTINGS_KEYS[method],
                            label: METHOD_SETTINGS_KEYS[method],
                            children: (
                              <Form.Item
                                name="methodSettingsJson"
                                label={`${METHOD_LABELS[method]} 配置`}
                                tooltip="该传输方式的设置对象，直接编辑 JSON；rawSettings 已有结构化表单"
                                rules={[{ validator: jsonValidator }]}
                              >
                                <JsonEditor placeholder="{}" />
                              </Form.Item>
                            ),
                          },
                        ]}
                      />
                    ) : null}
                    <Form.Item
                      name="security"
                      label="传输安全 (security)"
                      tooltip="none 不启用（默认）、reality 使用 REALITY、tls 使用 TLS"
                    >
                      <Select options={SECURITY_OPTIONS} allowClear placeholder="none（默认）" />
                    </Form.Item>
                    {security === "reality" ? (
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: "realitySettings",
                            label: "realitySettings",
                            children: (
                              <>
                                <Form.Item
                                  name="realityShow"
                                  label="输出调试信息 (show)"
                                  valuePropName="checked"
                                  tooltip="为 true 时输出调试信息"
                                >
                                  <Switch />
                                </Form.Item>
                                <Typography.Text strong style={{ fontSize: 12, marginBottom: 4 }}>
                                  服务端
                                </Typography.Text>
                                <Form.Item
                                  name="realityTarget"
                                  label="回落目标 (target)"
                                  tooltip="必填（服务端），格式同 VLESS fallbacks 的 dest，旧称 dest"
                                >
                                  <Input placeholder="例如 127.0.0.1:80、tls.baidu.com:443" />
                                </Form.Item>
                                <Form.Item
                                  name="realityXver"
                                  label="PROXY 协议版本 (xver)"
                                  tooltip="选填（服务端），格式同 VLESS fallbacks 的 xver，填 1 或 2"
                                >
                                  <InputNumber min={0} max={2} style={{ width: "100%" }} placeholder="0（不发送）" />
                                </Form.Item>
                                <Form.Item
                                  name="realityServerNames"
                                  label="可用 serverName (serverNames)"
                                  tooltip="必填（服务端），客户端可用的 serverName 列表，不支持 * 通配符，回车添加多项"
                                >
                                  <Select mode="tags" open={false} suffixIcon={null} placeholder="例如 example.com" />
                                </Form.Item>
                                <Form.Item
                                  label="私钥 (privateKey)"
                                  tooltip="必填（服务端）；可点击右侧按钮调用 xray x25519 快速生成密钥对，并自动填入客户端公钥"
                                >
                                  <Space.Compact style={{ width: "100%" }}>
                                    <Form.Item name="realityPrivateKey" noStyle>
                                      <Input.Password placeholder="执行 xray x25519 生成的私钥" />
                                    </Form.Item>
                                    <Button
                                      icon={<ThunderboltOutlined />}
                                      loading={x25519Loading}
                                      onClick={handleGenerateX25519}
                                    >
                                      xray x25519
                                    </Button>
                                  </Space.Compact>
                                </Form.Item>
                                <Form.Item
                                  name="realityShortIds"
                                  label="可用 shortId (shortIds)"
                                  tooltip="必填（服务端），客户端可用的 shortId 列表，回车添加多项"
                                >
                                  <Select mode="tags" open={false} suffixIcon={null} placeholder="例如 aabbccdd" />
                                </Form.Item>
                                <Form.Item
                                  name="realityMinClientVer"
                                  label="最低客户端版本 (minClientVer)"
                                  tooltip="选填（服务端），格式 x.y.z"
                                >
                                  <Input placeholder="例如 1.8.0" />
                                </Form.Item>
                                <Form.Item
                                  name="realityMaxClientVer"
                                  label="最高客户端版本 (maxClientVer)"
                                  tooltip="选填（服务端），格式 x.y.z"
                                >
                                  <Input placeholder="例如 1.8.0" />
                                </Form.Item>
                                <Form.Item
                                  name="realityMaxTimeDiff"
                                  label="最大时间差 (maxTimeDiff)"
                                  tooltip="选填（服务端），允许的最大时间差，单位毫秒"
                                >
                                  <InputNumber min={0} style={{ width: "100%" }} placeholder="例如 5000" />
                                </Form.Item>
                                <Form.Item
                                  name="realityMldsa65Seed"
                                  label="后量子签名私钥 (mldsa65Seed)"
                                  tooltip="仅服务端，使用 xray mldsa65 生成（可选）"
                                >
                                  <Input placeholder="xray mldsa65 生成的私钥" />
                                </Form.Item>
                                <Typography.Text strong style={{ fontSize: 12, margin: "8px 0 4px" }}>
                                  客户端
                                </Typography.Text>
                                <Form.Item
                                  name="realityServerName"
                                  label="serverName (serverName)"
                                  tooltip="客户端，服务端 serverNames 之一"
                                >
                                  <Input placeholder="例如 example.com" />
                                </Form.Item>
                                <Form.Item
                                  name="realityFingerprint"
                                  label="指纹 (fingerprint)"
                                  tooltip="必填（客户端），同 TLSObject，此处不支持 unsafe，默认 chrome"
                                >
                                  <Select options={REALITY_FINGERPRINT_OPTIONS} allowClear placeholder="chrome（默认）" />
                                </Form.Item>
                                <Form.Item
                                  name="realityPassword"
                                  label="公钥 (password)"
                                  tooltip="必填（客户端），服务端私钥对应的公钥，旧称 publicKey"
                                >
                                  <Input.Password placeholder="服务端私钥对应的公钥" />
                                </Form.Item>
                                <Form.Item
                                  name="realityShortId"
                                  label="shortId (shortId)"
                                  tooltip="客户端，服务端 shortIds 之一，长度为偶数个十六进制字符"
                                >
                                  <Input placeholder="例如 aabbccdd" />
                                </Form.Item>
                                <Form.Item
                                  name="realityMldsa65Verify"
                                  label="后量子验证公钥 (mldsa65Verify)"
                                  tooltip="可选（客户端），mldsa65 签名验证使用的公钥"
                                >
                                  <Input placeholder="mldsa65 签名验证公钥" />
                                </Form.Item>
                                <Form.Item
                                  name="realitySpiderX"
                                  label="爬虫路径 (spiderX)"
                                  tooltip="客户端，爬虫初始路径与参数，建议每个客户端不同"
                                >
                                  <Input placeholder="例如 /aid, 0" />
                                </Form.Item>
                              </>
                            ),
                          },
                        ]}
                      />
                    ) : security === "tls" ? (
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: "tlsSettings",
                            label: "tlsSettings",
                            children: (
                              <Form.Item
                                name="tlsSettingsJson"
                                label="TLS 配置 (tlsSettings)"
                                tooltip="TLS 配置对象，直接编辑 JSON（serverName/alpn/certificates 等）"
                                rules={[{ validator: jsonValidator }]}
                              >
                                <JsonEditor placeholder='{"serverName": "example.com", "alpn": ["h2", "http/1.1"]}' />
                              </Form.Item>
                            ),
                          },
                        ]}
                      />
                    ) : null}
                    <Form.Item
                      name="sockoptJson"
                      label="Socket 选项 (sockopt)"
                      tooltip="底层网络行为配置，直接编辑 JSON（tcpFastOpen 等）"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='{"tcpFastOpen": true}' />
                    </Form.Item>
                    <Form.Item
                      name="finalmaskJson"
                      label="最终伪装 (finalmask)"
                      tooltip="对流量进行最终伪装，直接编辑 JSON（tcp/udp 伪装层数组）"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='{"tcp": [{"type": "header-custom", "settings": {}}]}' />
                    </Form.Item>
                    <Form.Item
                      name="otherStreamJson"
                      label="其他配置"
                      tooltip="sockopt/finalmask 已单独配置，这里为传输配置中其余未结构化字段，直接编辑 JSON"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder="{}" />
                    </Form.Item>
                  </Space>
                ),
              },
            ]}
          />

          <Collapse
            size="small"
            style={{ marginTop: 8 }}
            items={[
              {
                key: "sniffing",
                label: "流量探测 (sniffing)",
                children: (
                  <>
                    <Form.Item
                      name="sniffingEnabled"
                      label="开启流量探测 (enabled)"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="destOverride"
                      label="目标地址覆写 (destOverride)"
                      tooltip="当流量为指定类型时，按其中包括的目标地址重置当前连接的目标"
                    >
                      <Select
                        mode="multiple"
                        options={DEST_OVERRIDE_OPTIONS}
                        placeholder="http / tls / quic / fakedns"
                      />
                    </Form.Item>
                    <Form.Item
                      name="metadataOnly"
                      label="仅元数据嗅探 (metadataOnly)"
                      valuePropName="checked"
                      tooltip="true 时仅使用连接元数据嗅探目标地址，此时除 fakedns 以外的 sniffer 不能激活"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="domainsExcluded"
                      label="排除域名 (domainsExcluded)"
                      tooltip="流量探测结果在此列表中时不会重置目标地址，格式与路由配置相同"
                    >
                      <Select mode="tags" open={false} suffixIcon={null} placeholder="例如 geosite:cn" />
                    </Form.Item>
                    <Form.Item
                      name="ipsExcluded"
                      label="排除 IP (ipsExcluded)"
                      tooltip="目标地址在此列表中时不会重置目标地址，格式与路由配置相同"
                    >
                      <Select mode="tags" open={false} suffixIcon={null} placeholder="例如 geoip:private" />
                    </Form.Item>
                    <Form.Item
                      name="routeOnly"
                      label="仅用于路由 (routeOnly)"
                      valuePropName="checked"
                      tooltip="嗅探得到的域名仅用于路由，代理目标地址仍为 IP，需开启 destOverride"
                    >
                      <Switch />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </ScrollArea>
    </Modal>
  );
}
