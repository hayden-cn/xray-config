import { useEffect, useState } from "react";
import {
  App,
  AutoComplete,
  Button,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { OutboundObject } from "../outbounds";
import { extractTags } from "../rules";
import { useAppStore } from "../store";
import { ItemList } from "./InboundEditModal";
import JsonEditor from "./JsonEditor";
import ScrollArea from "./ScrollArea";

const PROTOCOL_OPTIONS = [
  { value: "vless", label: "VLESS（无加密，需配合 XTLS/TLS 传输）" },
  { value: "vmess", label: "VMess（老牌加密协议）" },
  { value: "trojan", label: "Trojan（TLS 伪装）" },
  { value: "shadowsocks", label: "Shadowsocks" },
  { value: "socks", label: "SOCKS（代理服务器）" },
  { value: "http", label: "HTTP（代理服务器）" },
  { value: "wireguard", label: "WireGuard" },
  { value: "hysteria", label: "Hysteria（QUIC）" },
  { value: "freedom", label: "Freedom（直连）" },
  { value: "blackhole", label: "Blackhole（黑洞）" },
  { value: "loopback", label: "Loopback（回环）" },
  { value: "dns", label: "DNS（内置 DNS 模块）" },
];

const TARGET_STRATEGY_OPTIONS = [
  "AsIs",
  "UseIP",
  "UseIPv6v4",
  "UseIPv6",
  "UseIPv4v6",
  "UseIPv4",
  "ForceIP",
  "ForceIPv6v4",
  "ForceIPv6",
  "ForceIPv4v6",
  "ForceIPv4",
].map((v) => ({ value: v, label: v }));

const VMESS_SECURITY_OPTIONS = [
  { value: "auto", label: "auto（自动选择，默认）" },
  { value: "aes-128-gcm", label: "aes-128-gcm" },
  { value: "chacha20-poly1305", label: "chacha20-poly1305" },
];

const VLESS_FLOW_OPTIONS = [
  { value: "xtls-rprx-vision", label: "xtls-rprx-vision" },
  { value: "xtls-rprx-vision-udp443", label: "xtls-rprx-vision-udp443" },
];

const WG_DOMAIN_STRATEGY_OPTIONS = [
  "ForceIPv6v4",
  "ForceIPv6",
  "ForceIPv4v6",
  "ForceIPv4",
  "ForceIP",
].map((v) => ({ value: v, label: v }));

const XUDP_PROXY_OPTIONS = [
  { value: "reject", label: "reject（拒绝，默认）" },
  { value: "allow", label: "allow（允许走 Mux）" },
  { value: "skip", label: "skip（不使用 Mux 承载）" },
];

const BLACKHOLE_RESPONSE_OPTIONS = [
  { value: "none", label: "none（直接关闭连接，默认）" },
  { value: "http", label: "http（发回 HTTP 403 后关闭）" },
];

const DNS_NETWORK_OPTIONS = [
  { value: "tcp", label: "tcp" },
  { value: "udp", label: "udp" },
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

interface OutboundEditModalProps {
  open: boolean;
  initial?: OutboundObject | null;
  onClose: () => void;
  onSave: (outbound: OutboundObject) => void;
}

interface WireguardOutboundPeerFormValues {
  endpoint?: string;
  publicKey?: string;
  preSharedKey?: string;
  allowedIPs?: string[];
  keepAlive?: number | null;
}

interface OutboundFormValues {
  tag?: string;
  sendThrough?: string;
  targetStrategy?: string;
  comment?: string;
  protocol?: string;
  vlessAddress?: string;
  vlessPort?: string;
  vlessId?: string;
  vlessEncryption?: string;
  vlessFlow?: string;
  vlessLevel?: number | null;
  vlessReverseJson?: string;
  vmessAddress?: string;
  vmessPort?: string;
  vmessId?: string;
  vmessSecurity?: string;
  vmessLevel?: number | null;
  vmessExperiments?: string;
  trojanAddress?: string;
  trojanPort?: string;
  trojanPassword?: string;
  trojanEmail?: string;
  trojanLevel?: number | null;
  ssAddress?: string;
  ssPort?: string;
  ssMethod?: string;
  ssPassword?: string;
  ssEmail?: string;
  ssLevel?: number | null;
  socksAddress?: string;
  socksPort?: string;
  socksUser?: string;
  socksPass?: string;
  socksLevel?: number | null;
  socksEmail?: string;
  httpAddress?: string;
  httpPort?: string;
  httpUser?: string;
  httpPass?: string;
  httpLevel?: number | null;
  httpEmail?: string;
  httpHeadersJson?: string;
  wgSecretKey?: string;
  wgAddress?: string[];
  wgNoKernelTun?: boolean;
  wgMtu?: number | null;
  wgReserved?: string[];
  wgDomainStrategy?: string;
  hyVersion?: number | null;
  hyAddress?: string;
  hyPort?: string;
  fdDomainStrategy?: string;
  fdRedirect?: string;
  fdUserLevel?: number | null;
  fdProxyProtocol?: number | null;
  fdFragmentJson?: string;
  fdNoisesJson?: string;
  bhResponseType?: string;
  lbInboundTag?: string;
  lbSniffingJson?: string;
  dnsRewriteNetwork?: string;
  dnsRewriteAddress?: string;
  dnsRewritePort?: number | null;
  dnsUserLevel?: number | null;
  dnsRulesJson?: string;
  method?: string;
  rawHeaderType?: string;
  rawHeaderRequestJson?: string;
  rawHeaderResponseJson?: string;
  methodSettingsJson?: string;
  security?: string;
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
  proxyTag?: string;
  proxyTransportLayer?: boolean;
  muxEnabled?: boolean;
  muxConcurrency?: number | null;
  muxXudpConcurrency?: number | null;
  muxXudpProxyUDP443?: string;
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

/** 写入字符串字段；空值删除 */
function setStr(settings: Record<string, unknown>, key: string, v: unknown) {
  const s = String(v ?? "").trim();
  if (s) {
    settings[key] = s;
  } else {
    delete settings[key];
  }
}

/** 写入端口字段；纯数字转 number，其余保留字符串 */
function setPort(settings: Record<string, unknown>, key: string, v: unknown) {
  const s = String(v ?? "").trim();
  if (s) {
    settings[key] = /^\d+$/.test(s) ? Number(s) : s;
  } else {
    delete settings[key];
  }
}

/** 写入数字字段；非 number 删除 */
function setNum(settings: Record<string, unknown>, key: string, v: unknown) {
  if (typeof v === "number") {
    settings[key] = v;
  } else {
    delete settings[key];
  }
}

/** 写入布尔字段；false 删除 */
function setBool(settings: Record<string, unknown>, key: string, v: unknown) {
  if (v) {
    settings[key] = true;
  } else {
    delete settings[key];
  }
}

/** 写入 JSON 字段（保存前已验证合法） */
function setJson(settings: Record<string, unknown>, key: string, v: unknown) {
  const s = String(v ?? "").trim();
  if (s) {
    settings[key] = JSON.parse(s);
  } else {
    delete settings[key];
  }
}

/** 写入字符串数组字段；空数组删除 */
function setStrArr(settings: Record<string, unknown>, key: string, v: string[] | undefined) {
  const arr = (v ?? []).map((s) => String(s)).filter((s) => s.trim() !== "");
  if (arr.length > 0) {
    settings[key] = arr;
  } else {
    delete settings[key];
  }
}

interface ParsedWireguardConf {
  secretKey?: string;
  address?: string[];
  mtu?: number;
  peers: WireguardOutboundPeerFormValues[];
}

/** 解析 WireGuard 客户端配置文件 (.conf) 的 [Interface] / [Peer] 节 */
function parseWireguardConf(text: string): ParsedWireguardConf {
  let section = "";
  let peerIndex = -1;
  const peers: WireguardOutboundPeerFormValues[] = [];
  let secretKey: string | undefined;
  let address: string[] | undefined;
  let mtu: number | undefined;

  const setVal = (key: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    if (section === "interface") {
      if (key === "privatekey") secretKey = v;
      else if (key === "address") address = v.split(",").map((s) => s.trim()).filter(Boolean);
      else if (key === "mtu") {
        const n = Number(v);
        if (!Number.isNaN(n)) mtu = n;
      }
    } else if (section === "peer") {
      const peer = peers[peerIndex];
      if (!peer) return;
      if (key === "publickey") peer.publicKey = v;
      else if (key === "endpoint") peer.endpoint = v;
      else if (key === "presharedkey") peer.preSharedKey = v;
      else if (key === "allowedips") peer.allowedIPs = v.split(",").map((s) => s.trim()).filter(Boolean);
      else if (key === "persistentkeepalive") {
        const n = Number(v);
        if (!Number.isNaN(n)) peer.keepAlive = n;
      }
    }
  };

  const text0 = text.replace(/^\uFEFF/, "");
  for (const rawLine of text0.split(/\r\n|\r|\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      if (section === "peer") {
        peerIndex++;
        peers.push({ endpoint: "", publicKey: "", preSharedKey: "", allowedIPs: [], keepAlive: undefined });
      }
      continue;
    }
    const eq = line.indexOf("=");
    const colon = line.indexOf(":");
    const sep = eq < 0 ? colon : colon < 0 ? eq : Math.min(eq, colon);
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1);
    setVal(key, value);
  }

  return {
    secretKey,
    address,
    mtu,
    peers: peers
      .map((p) => ({
        endpoint: p.endpoint ?? "",
        publicKey: p.publicKey ?? "",
        preSharedKey: p.preSharedKey ?? "",
        allowedIPs: p.allowedIPs ?? [],
        keepAlive: p.keepAlive,
      }))
      .filter((p) => p.publicKey || p.endpoint || (p.allowedIPs ?? []).length > 0),
  };
}

function mapOutboundPeers(v: unknown): WireguardOutboundPeerFormValues[] {
  if (!Array.isArray(v)) return [];
  return v.map((p) => {
    if (!isPlainObj(p)) {
      return { endpoint: "", publicKey: "", preSharedKey: "", allowedIPs: [], keepAlive: undefined };
    }
    return {
      endpoint: typeof p.endpoint === "string" ? p.endpoint : "",
      publicKey: typeof p.publicKey === "string" ? p.publicKey : "",
      preSharedKey: typeof p.preSharedKey === "string" ? p.preSharedKey : "",
      allowedIPs: strArr(p.allowedIPs),
      keepAlive: typeof p.keepAlive === "number" ? p.keepAlive : undefined,
    };
  });
}

function mergeOutboundPeerValues(
  originals: Array<Record<string, unknown>>,
  values: WireguardOutboundPeerFormValues[],
): Array<Record<string, unknown>> {
  return values.map((p) => {
    const publicKey = String(p.publicKey ?? "").trim();
    const orig = originals.find((o) => typeof o.publicKey === "string" && o.publicKey === publicKey);
    const merged: Record<string, unknown> = orig ? JSON.parse(JSON.stringify(orig)) : {};
    const endpoint = String(p.endpoint ?? "").trim();
    if (endpoint) {
      merged.endpoint = endpoint;
    } else {
      delete merged.endpoint;
    }
    if (publicKey) {
      merged.publicKey = publicKey;
    } else {
      delete merged.publicKey;
    }
    const preSharedKey = String(p.preSharedKey ?? "").trim();
    if (preSharedKey) {
      merged.preSharedKey = preSharedKey;
    } else {
      delete merged.preSharedKey;
    }
    const allowedIPs = (p.allowedIPs ?? []).map((s) => String(s)).filter((s) => s.trim() !== "");
    if (allowedIPs.length > 0) {
      merged.allowedIPs = allowedIPs;
    } else {
      delete merged.allowedIPs;
    }
    if (typeof p.keepAlive === "number") {
      merged.keepAlive = p.keepAlive;
    } else {
      delete merged.keepAlive;
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

interface WireguardOutboundPeerModalProps {
  open: boolean;
  initial: WireguardOutboundPeerFormValues | null;
  onClose: () => void;
  onSave: (p: WireguardOutboundPeerFormValues) => void;
}

function WireguardOutboundPeerModal({ open, initial, onClose, onSave }: WireguardOutboundPeerModalProps) {
  const [form] = Form.useForm<WireguardOutboundPeerFormValues>();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      endpoint: initial?.endpoint ?? "",
      publicKey: initial?.publicKey ?? "",
      preSharedKey: initial?.preSharedKey ?? "",
      allowedIPs: initial?.allowedIPs ?? [],
      keepAlive: typeof initial?.keepAlive === "number" ? initial.keepAlive : undefined,
    });
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    onSave({
      endpoint: String(values.endpoint ?? "").trim(),
      publicKey: String(values.publicKey ?? "").trim(),
      preSharedKey: String(values.preSharedKey ?? "").trim(),
      allowedIPs: (values.allowedIPs ?? []).map((s) => String(s)).filter((s) => s.trim() !== ""),
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
            name="endpoint"
            label="服务器地址 (endpoint)"
            tooltip="必填。URL:端口 或 IP:端口 格式，如 engage.cloudflareclient.com:2408"
            rules={[{ required: true, message: "请输入服务器地址" }]}
          >
            <Input placeholder="例如 engage.cloudflareclient.com:2408" />
          </Form.Item>
          <Form.Item
            name="publicKey"
            label="服务器公钥 (publicKey)"
            required
            tooltip="必填，用于验证"
            rules={[{ required: true, message: "请输入公钥" }]}
          >
            <Input placeholder="WireGuard 公钥" />
          </Form.Item>
          <Form.Item name="preSharedKey" label="预共享密钥 (preSharedKey)" tooltip="额外的对称加密密钥，默认全 0">
            <Input placeholder="预共享密钥（可选）" />
          </Form.Item>
          <Form.Item name="keepAlive" label="心跳间隔 (keepAlive)" tooltip="单位为秒，0 表示无心跳">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
          </Form.Item>
          <Form.Item name="allowedIPs" label="允许的 IP (allowedIPs)" tooltip={'仅允许特定源 IP 的流量，默认 ["0.0.0.0/0", "::/0"]，回车或逗号分隔'}>
            <Select mode="tags" placeholder="例如 0.0.0.0/0" tokenSeparators={[",", "，"]} />
          </Form.Item>
        </Form>
      </ScrollArea>
    </Modal>
  );
}

export default function OutboundEditModal({ open, initial, onClose, onSave }: OutboundEditModalProps) {
  const [form] = Form.useForm<OutboundFormValues>();
  const protocol = Form.useWatch("protocol", form) as string | undefined;
  const method = Form.useWatch("method", form) as string | undefined;
  const rawHeaderType = Form.useWatch("rawHeaderType", form) as string | undefined;
  const security = Form.useWatch("security", form) as string | undefined;

  const [wgPeers, setWgPeers] = useState<WireguardOutboundPeerFormValues[]>([]);
  const [peerModalOpen, setPeerModalOpen] = useState(false);
  const [editingPeerIndex, setEditingPeerIndex] = useState<number | null>(null);
  const [wgImportLoading, setWgImportLoading] = useState(false);
  const { message } = App.useApp();

  const store = useAppStore();
  const inboundTags = extractTags(store.sections["inbounds"] ?? "");
  const outboundTags = extractTags(store.sections["outbounds"] ?? "");

  const handleImportWgConf = async () => {
    const res = await openDialog({ multiple: false, directory: false });
    if (typeof res !== "string" || !res) return;
    setWgImportLoading(true);
    try {
      const content = await api.readTextFile(res);
      const parsed = parseWireguardConf(content);
      if (!parsed.secretKey && (!parsed.peers || parsed.peers.length === 0)) {
        message.error("未识别到有效的 WireGuard 配置");
        return;
      }
      const patch: OutboundFormValues = {};
      if (parsed.secretKey) patch.wgSecretKey = parsed.secretKey;
      if (parsed.address && parsed.address.length > 0) patch.wgAddress = parsed.address;
      if (typeof parsed.mtu === "number") patch.wgMtu = parsed.mtu;
      form.setFieldsValue(patch);
      if (parsed.peers.length > 0) {
        setWgPeers(parsed.peers);
        setEditingPeerIndex(null);
      }
      message.success("已从 WireGuard 配置文件导入");
    } catch (e) {
      message.error(String(e));
    } finally {
      setWgImportLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const i = initial;
    const proto = typeof i?.protocol === "string" ? i.protocol : "";
    const settings = isPlainObj(i?.settings) ? i.settings : undefined;

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

    const proxy = isPlainObj(i?.proxySettings) ? i.proxySettings : undefined;
    const mux = isPlainObj(i?.mux) ? i.mux : undefined;
    const bhResponse = isPlainObj(settings?.response) ? settings.response : undefined;

    form.setFieldsValue({
      tag: typeof i?.tag === "string" ? i.tag : "",
      sendThrough: typeof i?.sendThrough === "string" ? i.sendThrough : "",
      targetStrategy: typeof i?.targetStrategy === "string" ? i.targetStrategy : undefined,
      comment: typeof i?.comment === "string" ? i.comment : "",
      protocol: proto || undefined,
      vlessAddress: proto === "vless" && typeof settings?.address === "string" ? settings.address : "",
      vlessPort: proto === "vless" ? numToStr(settings?.port) : undefined,
      vlessId: proto === "vless" && typeof settings?.id === "string" ? settings.id : "",
      vlessEncryption:
        proto === "vless" && typeof settings?.encryption === "string" && settings.encryption
          ? settings.encryption
          : "none",
      vlessFlow: proto === "vless" && typeof settings?.flow === "string" ? settings.flow : "",
      vlessLevel: proto === "vless" && typeof settings?.level === "number" ? settings.level : undefined,
      vlessReverseJson: proto === "vless" && isPlainObj(settings?.reverse) ? JSON.stringify(settings.reverse, null, 2) : "",
      vmessAddress: proto === "vmess" && typeof settings?.address === "string" ? settings.address : "",
      vmessPort: proto === "vmess" ? numToStr(settings?.port) : undefined,
      vmessId: proto === "vmess" && typeof settings?.id === "string" ? settings.id : "",
      vmessSecurity: proto === "vmess" && typeof settings?.security === "string" ? settings.security : undefined,
      vmessLevel: proto === "vmess" && typeof settings?.level === "number" ? settings.level : undefined,
      vmessExperiments: proto === "vmess" && typeof settings?.experiments === "string" ? settings.experiments : "",
      trojanAddress: proto === "trojan" && typeof settings?.address === "string" ? settings.address : "",
      trojanPort: proto === "trojan" ? numToStr(settings?.port) : undefined,
      trojanPassword: proto === "trojan" && typeof settings?.password === "string" ? settings.password : "",
      trojanEmail: proto === "trojan" && typeof settings?.email === "string" ? settings.email : "",
      trojanLevel: proto === "trojan" && typeof settings?.level === "number" ? settings.level : undefined,
      ssAddress: proto === "shadowsocks" && typeof settings?.address === "string" ? settings.address : "",
      ssPort: proto === "shadowsocks" ? numToStr(settings?.port) : undefined,
      ssMethod: proto === "shadowsocks" && typeof settings?.method === "string" ? settings.method : "",
      ssPassword: proto === "shadowsocks" && typeof settings?.password === "string" ? settings.password : "",
      ssEmail: proto === "shadowsocks" && typeof settings?.email === "string" ? settings.email : "",
      ssLevel: proto === "shadowsocks" && typeof settings?.level === "number" ? settings.level : undefined,
      socksAddress: proto === "socks" && typeof settings?.address === "string" ? settings.address : "",
      socksPort: proto === "socks" ? numToStr(settings?.port) : undefined,
      socksUser: proto === "socks" && typeof settings?.user === "string" ? settings.user : "",
      socksPass: proto === "socks" && typeof settings?.pass === "string" ? settings.pass : "",
      socksLevel: proto === "socks" && typeof settings?.level === "number" ? settings.level : undefined,
      socksEmail: proto === "socks" && typeof settings?.email === "string" ? settings.email : "",
      httpAddress: proto === "http" && typeof settings?.address === "string" ? settings.address : "",
      httpPort: proto === "http" ? numToStr(settings?.port) : undefined,
      httpUser: proto === "http" && typeof settings?.user === "string" ? settings.user : "",
      httpPass: proto === "http" && typeof settings?.pass === "string" ? settings.pass : "",
      httpLevel: proto === "http" && typeof settings?.level === "number" ? settings.level : undefined,
      httpEmail: proto === "http" && typeof settings?.email === "string" ? settings.email : "",
      httpHeadersJson: proto === "http" && isPlainObj(settings?.headers) ? JSON.stringify(settings.headers, null, 2) : "",
      wgSecretKey: proto === "wireguard" && typeof settings?.secretKey === "string" ? settings.secretKey : "",
      wgAddress: proto === "wireguard" ? strArr(settings?.address) : [],
      wgNoKernelTun: proto === "wireguard" ? boolVal(settings?.noKernelTun) : false,
      wgMtu: proto === "wireguard" && typeof settings?.mtu === "number" ? settings.mtu : undefined,
      wgReserved: proto === "wireguard" ? strArr(settings?.reserved) : [],
      wgDomainStrategy:
        proto === "wireguard" && typeof settings?.domainStrategy === "string" ? settings.domainStrategy : undefined,
      hyVersion: proto === "hysteria" && typeof settings?.version === "number" ? settings.version : 2,
      hyAddress: proto === "hysteria" && typeof settings?.address === "string" ? settings.address : "",
      hyPort: proto === "hysteria" ? numToStr(settings?.port) : undefined,
      fdDomainStrategy:
        proto === "freedom" && typeof settings?.domainStrategy === "string" ? settings.domainStrategy : undefined,
      fdRedirect: proto === "freedom" && typeof settings?.redirect === "string" ? settings.redirect : "",
      fdUserLevel: proto === "freedom" && typeof settings?.userLevel === "number" ? settings.userLevel : undefined,
      fdProxyProtocol:
        proto === "freedom" && typeof settings?.proxyProtocol === "number" ? settings.proxyProtocol : undefined,
      fdFragmentJson: proto === "freedom" && isPlainObj(settings?.fragment) ? JSON.stringify(settings.fragment, null, 2) : "",
      fdNoisesJson: proto === "freedom" && Array.isArray(settings?.noises) ? JSON.stringify(settings.noises, null, 2) : "",
      bhResponseType: proto === "blackhole" && typeof bhResponse?.type === "string" ? bhResponse.type : undefined,
      lbInboundTag: proto === "loopback" && typeof settings?.inboundTag === "string" ? settings.inboundTag : "",
      lbSniffingJson: proto === "loopback" && isPlainObj(settings?.sniffing) ? JSON.stringify(settings.sniffing, null, 2) : "",
      dnsRewriteNetwork: proto === "dns" && typeof settings?.rewriteNetwork === "string" ? settings.rewriteNetwork : undefined,
      dnsRewriteAddress: proto === "dns" && typeof settings?.rewriteAddress === "string" ? settings.rewriteAddress : "",
      dnsRewritePort: proto === "dns" && typeof settings?.rewritePort === "number" ? settings.rewritePort : undefined,
      dnsUserLevel: proto === "dns" && typeof settings?.userLevel === "number" ? settings.userLevel : undefined,
      dnsRulesJson: proto === "dns" && Array.isArray(settings?.rules) ? JSON.stringify(settings.rules, null, 2) : "",
      method: streamMethod,
      rawHeaderType: typeof header?.type === "string" ? header.type : undefined,
      rawHeaderRequestJson: isPlainObj(header?.request) ? JSON.stringify(header.request, null, 2) : "",
      rawHeaderResponseJson: isPlainObj(header?.response) ? JSON.stringify(header.response, null, 2) : "",
      methodSettingsJson: methodSettings ? JSON.stringify(methodSettings, null, 2) : "",
      security: streamSecurity,
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
      proxyTag: typeof proxy?.tag === "string" ? proxy.tag : "",
      proxyTransportLayer: boolVal(proxy?.transportLayer),
      muxEnabled: boolVal(mux?.enabled),
      muxConcurrency: typeof mux?.concurrency === "number" ? mux.concurrency : undefined,
      muxXudpConcurrency: typeof mux?.xudpConcurrency === "number" ? mux.xudpConcurrency : undefined,
      muxXudpProxyUDP443: typeof mux?.xudpProxyUDP443 === "string" ? mux.xudpProxyUDP443 : undefined,
    });
    setWgPeers(proto === "wireguard" ? mapOutboundPeers(settings?.peers) : []);
    setEditingPeerIndex(null);
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const base: OutboundObject = initial ? JSON.parse(JSON.stringify(initial)) : {};

    setStr(base, "tag", values.tag);
    setStr(base, "sendThrough", values.sendThrough);
    setStr(base, "targetStrategy", values.targetStrategy);
    setStr(base, "comment", values.comment);

    const protocolVal = String(values.protocol ?? "").trim();
    if (protocolVal) {
      base.protocol = protocolVal;
    } else {
      delete base.protocol;
    }

    const settings: Record<string, unknown> = isPlainObj(base.settings)
      ? JSON.parse(JSON.stringify(base.settings))
      : {};

    if (protocolVal === "vless") {
      setStr(settings, "address", values.vlessAddress);
      setPort(settings, "port", values.vlessPort);
      setStr(settings, "id", values.vlessId);
      const encryption = String(values.vlessEncryption ?? "").trim();
      settings.encryption = encryption || "none";
      setStr(settings, "flow", values.vlessFlow);
      setNum(settings, "level", values.vlessLevel);
      setJson(settings, "reverse", values.vlessReverseJson);
    } else if (protocolVal === "vmess") {
      setStr(settings, "address", values.vmessAddress);
      setPort(settings, "port", values.vmessPort);
      setStr(settings, "id", values.vmessId);
      setStr(settings, "security", values.vmessSecurity);
      setNum(settings, "level", values.vmessLevel);
      setStr(settings, "experiments", values.vmessExperiments);
    } else if (protocolVal === "trojan") {
      setStr(settings, "address", values.trojanAddress);
      setPort(settings, "port", values.trojanPort);
      setStr(settings, "password", values.trojanPassword);
      setStr(settings, "email", values.trojanEmail);
      setNum(settings, "level", values.trojanLevel);
    } else if (protocolVal === "shadowsocks") {
      setStr(settings, "address", values.ssAddress);
      setPort(settings, "port", values.ssPort);
      setStr(settings, "method", values.ssMethod);
      setStr(settings, "password", values.ssPassword);
      setStr(settings, "email", values.ssEmail);
      setNum(settings, "level", values.ssLevel);
    } else if (protocolVal === "socks") {
      setStr(settings, "address", values.socksAddress);
      setPort(settings, "port", values.socksPort);
      setStr(settings, "user", values.socksUser);
      setStr(settings, "pass", values.socksPass);
      setNum(settings, "level", values.socksLevel);
      setStr(settings, "email", values.socksEmail);
    } else if (protocolVal === "http") {
      setStr(settings, "address", values.httpAddress);
      setPort(settings, "port", values.httpPort);
      setStr(settings, "user", values.httpUser);
      setStr(settings, "pass", values.httpPass);
      setNum(settings, "level", values.httpLevel);
      setStr(settings, "email", values.httpEmail);
      setJson(settings, "headers", values.httpHeadersJson);
    } else if (protocolVal === "wireguard") {
      setStr(settings, "secretKey", values.wgSecretKey);
      setStrArr(settings, "address", values.wgAddress);
      setBool(settings, "noKernelTun", values.wgNoKernelTun);
      setNum(settings, "mtu", values.wgMtu);
      const reserved = (values.wgReserved ?? [])
        .map((s) => Number(s))
        .filter((n) => !Number.isNaN(n));
      if (reserved.length > 0) {
        settings.reserved = reserved;
      } else {
        delete settings.reserved;
      }
      setStr(settings, "domainStrategy", values.wgDomainStrategy);
      const originals = Array.isArray(settings.peers) ? settings.peers : [];
      const peers = mergeOutboundPeerValues(originals, wgPeers);
      if (peers.length > 0) {
        settings.peers = peers;
      } else {
        delete settings.peers;
      }
    } else if (protocolVal === "hysteria") {
      setNum(settings, "version", values.hyVersion);
      setStr(settings, "address", values.hyAddress);
      setPort(settings, "port", values.hyPort);
    } else if (protocolVal === "freedom") {
      setStr(settings, "domainStrategy", values.fdDomainStrategy);
      setStr(settings, "redirect", values.fdRedirect);
      setNum(settings, "userLevel", values.fdUserLevel);
      setNum(settings, "proxyProtocol", values.fdProxyProtocol);
      setJson(settings, "fragment", values.fdFragmentJson);
      setJson(settings, "noises", values.fdNoisesJson);
    } else if (protocolVal === "blackhole") {
      const response: Record<string, unknown> = isPlainObj(settings.response)
        ? { ...settings.response }
        : {};
      setStr(response, "type", values.bhResponseType);
      if (Object.keys(response).length > 0) {
        settings.response = response;
      } else {
        delete settings.response;
      }
    } else if (protocolVal === "loopback") {
      setStr(settings, "inboundTag", values.lbInboundTag);
      setJson(settings, "sniffing", values.lbSniffingJson);
    } else if (protocolVal === "dns") {
      setStr(settings, "rewriteNetwork", values.dnsRewriteNetwork);
      setStr(settings, "rewriteAddress", values.dnsRewriteAddress);
      setNum(settings, "rewritePort", values.dnsRewritePort);
      setNum(settings, "userLevel", values.dnsUserLevel);
      setJson(settings, "rules", values.dnsRulesJson);
    }

    if (Object.keys(settings).length > 0) {
      base.settings = settings;
    } else {
      delete base.settings;
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
      setStr(realityBase, "serverName", values.realityServerName);
      setStr(realityBase, "fingerprint", values.realityFingerprint);
      setStr(realityBase, "password", values.realityPassword);
      setStr(realityBase, "shortId", values.realityShortId);
      setStr(realityBase, "mldsa65Verify", values.realityMldsa65Verify);
      setStr(realityBase, "spiderX", values.realitySpiderX);
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

    // ---- proxySettings ----
    const proxyBase: Record<string, unknown> = isPlainObj(base.proxySettings)
      ? JSON.parse(JSON.stringify(base.proxySettings))
      : {};
    setStr(proxyBase, "tag", values.proxyTag);
    setBool(proxyBase, "transportLayer", values.proxyTransportLayer);
    if (Object.keys(proxyBase).length > 0) {
      base.proxySettings = proxyBase;
    } else {
      delete base.proxySettings;
    }

    // ---- mux ----
    const muxBase: Record<string, unknown> = isPlainObj(base.mux)
      ? JSON.parse(JSON.stringify(base.mux))
      : {};
    setBool(muxBase, "enabled", values.muxEnabled);
    setNum(muxBase, "concurrency", values.muxConcurrency);
    setNum(muxBase, "xudpConcurrency", values.muxXudpConcurrency);
    setStr(muxBase, "xudpProxyUDP443", values.muxXudpProxyUDP443);
    if (Object.keys(muxBase).length > 0) {
      base.mux = muxBase;
    } else {
      delete base.mux;
    }

    onSave(base);
  };

  const isVless = protocol === "vless";
  const isVmess = protocol === "vmess";
  const isTrojan = protocol === "trojan";
  const isSs = protocol === "shadowsocks";
  const isSocks = protocol === "socks";
  const isHttp = protocol === "http";
  const isWg = protocol === "wireguard";
  const isHy = protocol === "hysteria";
  const isFreedom = protocol === "freedom";
  const isBlackhole = protocol === "blackhole";
  const isLoopback = protocol === "loopback";
  const isDns = protocol === "dns";

  return (
    <Modal
      open={open}
      title={initial ? "编辑出站" : "新增出站"}
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
            tooltip="出站唯一标识，路由规则 outboundTag 与 API 热更新据此引用；非空时须在所有 tag 中唯一，可为空"
            style={{ marginTop: 10 }}
          >
            <Input placeholder="例如：代理 1（可选）" />
          </Form.Item>
          <Form.Item
            name="sendThrough"
            label="发送地址 (sendThrough)"
            tooltip="用于发送数据的 IP 地址，默认 0.0.0.0；特殊值 origin 使用本机被连接的 IP，srcip 使用入站时的源 IP"
          >
            <Input placeholder="0.0.0.0（默认）" />
          </Form.Item>
          <Form.Item
            name="targetStrategy"
            label="目标解析策略 (targetStrategy)"
            tooltip="控制域名请求是否/如何解析为 IP 并发送，默认 AsIs 即保持原样发送到远端"
          >
            <Select options={TARGET_STRATEGY_OPTIONS} allowClear placeholder="AsIs（默认）" />
          </Form.Item>
          <Form.Item name="comment" label="备注 (comment)" tooltip="选填，仅用于展示说明">
            <Input placeholder="备注说明（可选）" />
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
                      name="vlessAddress"
                      label="服务端地址 (address)"
                      tooltip="支持域名、IPv4、IPv6"
                      rules={[{ required: true, message: "请输入服务端地址" }]}
                    >
                      <Input placeholder="例如 example.com" />
                    </Form.Item>
                    <Form.Item
                      name="vlessPort"
                      label="服务端端口 (port)"
                      tooltip="通常与服务端监听的端口相同"
                      rules={[{ required: true, message: "请输入服务端端口" }]}
                    >
                      <Input placeholder="例如 443" />
                    </Form.Item>
                    <Form.Item
                      name="vlessId"
                      label="用户 ID (id)"
                      tooltip="可以是任意小于 30 字节的字符串，也可以是一个合法的 UUID"
                      rules={[{ required: true, message: "请输入用户 ID" }]}
                    >
                      <Input placeholder="UUID 或任意小于 30 字节的字符串" />
                    </Form.Item>
                    <Form.Item
                      name="vlessEncryption"
                      label="加密方式 (encryption)"
                      tooltip="不能留空，不使用加密需显式设置为 none"
                      rules={[{ required: true, message: "encryption 不能为空，不使用请填 none" }]}
                    >
                      <Input placeholder="none（默认，禁用加密）" />
                    </Form.Item>
                    <Form.Item
                      name="vlessFlow"
                      label="流控 (flow)"
                      tooltip="空字符为普通 TLS 代理，xtls-rprx-vision 为新 XTLS 模式"
                    >
                      <Select options={VLESS_FLOW_OPTIONS} allowClear placeholder="空（普通 TLS 代理）" />
                    </Form.Item>
                    <Form.Item
                      name="vlessLevel"
                      label="用户等级 (level)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="vlessReverseJson"
                      label="反向代理 (reverse)"
                      tooltip="选填，存在此项代表该出站可用作 VLESS 反向代理出站，JSON 对象"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='{"tag": "inbound-tag"}' />
                    </Form.Item>
                  </>
                ) : isVmess ? (
                  <>
                    <Form.Item
                      name="vmessAddress"
                      label="服务端地址 (address)"
                      tooltip="支持 IP 地址或者域名"
                      rules={[{ required: true, message: "请输入服务端地址" }]}
                    >
                      <Input placeholder="例如 example.com" />
                    </Form.Item>
                    <Form.Item
                      name="vmessPort"
                      label="服务端端口 (port)"
                      tooltip="服务端监听的端口号，必填"
                      rules={[{ required: true, message: "请输入服务端端口" }]}
                    >
                      <Input placeholder="例如 443" />
                    </Form.Item>
                    <Form.Item
                      name="vmessId"
                      label="用户 ID (id)"
                      tooltip="可以是任意小于 30 字节的字符串，也可以是一个合法的 UUID"
                      rules={[{ required: true, message: "请输入用户 ID" }]}
                    >
                      <Input placeholder="UUID 或任意小于 30 字节的字符串" />
                    </Form.Item>
                    <Form.Item
                      name="vmessSecurity"
                      label="加密方式 (security)"
                      tooltip="客户端将使用配置的加密方式发送数据，服务端自动识别，auto 为默认值"
                    >
                      <Select options={VMESS_SECURITY_OPTIONS} allowClear placeholder="auto（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="vmessLevel"
                      label="用户等级 (level)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="vmessExperiments"
                      label="实验性功能 (experiments)"
                      tooltip="启用的 VMess 协议实验性功能，多个用 | 分割，如 AuthenticatedLength|NoTerminationSignal"
                    >
                      <Input placeholder="例如 AuthenticatedLength（可选）" />
                    </Form.Item>
                  </>
                ) : isTrojan ? (
                  <>
                    <Form.Item
                      name="trojanAddress"
                      label="服务端地址 (address)"
                      tooltip="支持 IPv4、IPv6 和域名"
                      rules={[{ required: true, message: "请输入服务端地址" }]}
                    >
                      <Input placeholder="例如 example.com" />
                    </Form.Item>
                    <Form.Item
                      name="trojanPort"
                      label="服务端端口 (port)"
                      tooltip="通常与服务端监听的端口相同"
                      rules={[{ required: true, message: "请输入服务端端口" }]}
                    >
                      <Input placeholder="例如 443" />
                    </Form.Item>
                    <Form.Item
                      name="trojanPassword"
                      label="密码 (password)"
                      tooltip="必填，任意字符串"
                      rules={[{ required: true, message: "请输入密码" }]}
                    >
                      <Input placeholder="服务端密码" />
                    </Form.Item>
                    <Form.Item name="trojanEmail" label="邮箱 (email)" tooltip="选填，用于标识用户">
                      <Input placeholder="例如 user@example.com（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="trojanLevel"
                      label="用户等级 (level)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                  </>
                ) : isSs ? (
                  <>
                    <Form.Item
                      name="ssAddress"
                      label="服务端地址 (address)"
                      tooltip="支持 IPv4、IPv6 和域名，必填"
                      rules={[{ required: true, message: "请输入服务端地址" }]}
                    >
                      <Input placeholder="例如 example.com" />
                    </Form.Item>
                    <Form.Item
                      name="ssPort"
                      label="服务端端口 (port)"
                      tooltip="必填"
                      rules={[{ required: true, message: "请输入服务端端口" }]}
                    >
                      <Input placeholder="例如 8388" />
                    </Form.Item>
                    <Form.Item
                      name="ssMethod"
                      label="加密方式 (method)"
                      tooltip="必填，推荐 2022-blake3 系列"
                      rules={[{ required: true, message: "请输入加密方式" }]}
                    >
                      <Input placeholder="例如 2022-blake3-aes-128-gcm" />
                    </Form.Item>
                    <Form.Item
                      name="ssPassword"
                      label="密码 (password)"
                      tooltip="必填。2022 加密使用预共享密钥，其他加密建议 16 字符以上"
                      rules={[{ required: true, message: "请输入密码" }]}
                    >
                      <Input placeholder="认证密码或预共享密钥" />
                    </Form.Item>
                    <Form.Item name="ssEmail" label="邮箱 (email)" tooltip="选填，用于标识用户">
                      <Input placeholder="例如 user@example.com（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="ssLevel"
                      label="用户等级 (level)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                  </>
                ) : isSocks ? (
                  <>
                    <Form.Item
                      name="socksAddress"
                      label="服务器地址 (address)"
                      tooltip="必填，仅支持连接到 Socks 5 服务器"
                      rules={[{ required: true, message: "请输入服务器地址" }]}
                    >
                      <Input placeholder="例如 127.0.0.1" />
                    </Form.Item>
                    <Form.Item
                      name="socksPort"
                      label="服务器端口 (port)"
                      tooltip="必填"
                      rules={[{ required: true, message: "请输入服务器端口" }]}
                    >
                      <Input placeholder="例如 1080" />
                    </Form.Item>
                    <Form.Item name="socksUser" label="用户名 (user)" tooltip="对接服务端需要认证时必填，否则不要包含此项">
                      <Input placeholder="账号用户名（可选）" />
                    </Form.Item>
                    <Form.Item name="socksPass" label="密码 (pass)" tooltip="对接服务端需要认证时必填，否则不要包含此项">
                      <Input placeholder="账号密码（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="socksLevel"
                      label="用户等级 (level)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item name="socksEmail" label="邮箱 (email)" tooltip="选填，用于标识用户">
                      <Input placeholder="例如 user@example.com（可选）" />
                    </Form.Item>
                  </>
                ) : isHttp ? (
                  <>
                    <Form.Item
                      name="httpAddress"
                      label="代理服务器地址 (address)"
                      tooltip="必填"
                      rules={[{ required: true, message: "请输入代理服务器地址" }]}
                    >
                      <Input placeholder="例如 127.0.0.1" />
                    </Form.Item>
                    <Form.Item
                      name="httpPort"
                      label="代理服务器端口 (port)"
                      tooltip="必填"
                      rules={[{ required: true, message: "请输入代理服务器端口" }]}
                    >
                      <Input placeholder="例如 8080" />
                    </Form.Item>
                    <Form.Item name="httpUser" label="用户名 (user)" tooltip="对接服务端需要认证时必填，否则不要包含此项">
                      <Input placeholder="账号用户名（可选）" />
                    </Form.Item>
                    <Form.Item name="httpPass" label="密码 (pass)" tooltip="对接服务端需要认证时必填，否则不要包含此项">
                      <Input placeholder="账号密码（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="httpLevel"
                      label="用户等级 (level)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item name="httpEmail" label="邮箱 (email)" tooltip="选填，用于标识用户">
                      <Input placeholder="例如 user@example.com（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="httpHeadersJson"
                      label="HTTP 头 (headers)"
                      tooltip="键值对，每个键表示一个 HTTP 头的名称，每次请求附上所有键值对，JSON 对象"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='{"X-Forwarded-For": "1.2.3.4"}' />
                    </Form.Item>
                  </>
                ) : isWg ? (
                  <>
                    <Form.Item
                      style={{ marginBottom: 8 }}
                      label="从文件导入"
                      tooltip="选择 WireGuard 客户端配置文件 (.conf)，自动填入私钥、本机地址、MTU 与对端信息"
                    >
                      <Button
                        icon={<FileTextOutlined />}
                        loading={wgImportLoading}
                        onClick={handleImportWgConf}
                        block
                      >
                        从文件导入
                      </Button>
                    </Form.Item>
                    <Form.Item
                      name="wgSecretKey"
                      label="私钥 (secretKey)"
                      required
                      tooltip="本机 WireGuard 私钥，必填"
                      rules={[{ required: true, message: "请输入私钥" }]}
                    >
                      <Input placeholder="WireGuard 私钥" />
                    </Form.Item>
                    <Form.Item
                      name="wgAddress"
                      label="本机地址 (address)"
                      tooltip="本机虚拟网卡 IP 地址列表，支持 IPv6，回车或逗号分隔"
                    >
                      <Select mode="tags" placeholder="例如 172.16.0.2/32" tokenSeparators={[",", "，"]} />
                    </Form.Item>
                    <Form.Item
                      name="wgNoKernelTun"
                      label="禁用系统虚拟网卡 (noKernelTun)"
                      tooltip="手动禁用系统虚拟网卡，使用 gvisor 实现"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item name="wgMtu" label="MTU (mtu)" tooltip="底层 tun 的 MTU 大小，默认 1420">
                      <InputNumber min={1} style={{ width: "100%" }} placeholder="1420（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="wgReserved"
                      label="保留字节 (reserved)"
                      tooltip="保留字节数组，按需填写，回车或逗号分隔"
                    >
                      <Select mode="tags" placeholder="例如 0 1 2" tokenSeparators={[",", "，"]} />
                    </Form.Item>
                    <Form.Item
                      name="wgDomainStrategy"
                      label="域名解析策略 (domainStrategy)"
                      tooltip="服务器地址为域名或目标地址为域名时的解析策略，默认 ForceIP"
                    >
                      <Select options={WG_DOMAIN_STRATEGY_OPTIONS} allowClear placeholder="ForceIP（默认）" />
                    </Form.Item>
                    <Form.Item label="对端 (peers)" tooltip="WireGuard 服务器列表，点击条目或按钮新增/编辑">
                      <ItemList
                        items={wgPeers.map((p, idx) => ({
                          key: idx,
                          title: p.publicKey || "（无公钥）",
                          subtitle: [
                            p.endpoint ? `端点：${p.endpoint}` : "",
                            p.allowedIPs && p.allowedIPs.length > 0 ? `允许 IP：${p.allowedIPs.join(", ")}` : "",
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
                            setWgPeers((prev) => prev.filter((_, i) => i !== idx));
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
                    <WireguardOutboundPeerModal
                      open={peerModalOpen}
                      initial={editingPeerIndex !== null ? wgPeers[editingPeerIndex] ?? null : null}
                      onClose={() => setPeerModalOpen(false)}
                      onSave={(p) => {
                        if (editingPeerIndex !== null) {
                          setWgPeers((prev) =>
                            prev.map((item, idx) => (idx === editingPeerIndex ? p : item)),
                          );
                        } else {
                          setWgPeers((prev) => [...prev, p]);
                        }
                        setPeerModalOpen(false);
                      }}
                    />
                  </>
                ) : isHy ? (
                  <>
                    <Form.Item
                      name="hyVersion"
                      label="版本 (version)"
                      tooltip="必须为 2"
                      rules={[{ required: true, message: "请输入版本" }]}
                    >
                      <InputNumber min={1} style={{ width: "100%" }} placeholder="2（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="hyAddress"
                      label="服务器地址 (address)"
                      tooltip="必填"
                      rules={[{ required: true, message: "请输入服务器地址" }]}
                    >
                      <Input placeholder="例如 example.com" />
                    </Form.Item>
                    <Form.Item
                      name="hyPort"
                      label="服务器端口 (port)"
                      tooltip="必填"
                      rules={[{ required: true, message: "请输入服务器端口" }]}
                    >
                      <Input placeholder="例如 443" />
                    </Form.Item>
                  </>
                ) : isFreedom ? (
                  <>
                    <Form.Item
                      name="fdDomainStrategy"
                      label="域名解析策略 (domainStrategy)"
                      tooltip="域名解析策略，参数含义约等于 sockopt 中的 domainStrategy，默认 AsIs"
                    >
                      <Select options={TARGET_STRATEGY_OPTIONS} allowClear placeholder="AsIs（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="fdRedirect"
                      label="重定向 (redirect)"
                      tooltip="将所有数据发送到指定地址，如 127.0.0.1:80、:1234；端口为 0 时不修改原端口"
                    >
                      <Input placeholder="例如 127.0.0.1:80（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="fdUserLevel"
                      label="用户等级 (userLevel)"
                      tooltip="对应 policy 中 level 的值，默认 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="fdProxyProtocol"
                      label="PROXY 协议 (proxyProtocol)"
                      tooltip="PROXY protocol 版本号，配合 redirect 使用，可选 1 或 2，默认 0 不启用"
                    >
                      <InputNumber min={0} max={2} style={{ width: "100%" }} placeholder="0（不启用）" />
                    </Form.Item>
                    <Form.Item
                      name="fdFragmentJson"
                      label="TCP 分片 (fragment)"
                      tooltip="控制发出的 TCP 分片，可用于绕过 SNI 黑名单，JSON 对象"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='{"packets": "tlshello", "length": "100-200", "interval": "10-20"}' />
                    </Form.Item>
                    <Form.Item
                      name="fdNoisesJson"
                      label="UDP 噪声 (noises)"
                      tooltip="发出 UDP 连接前发送随机数据作为噪声，JSON 数组"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='[{"type": "rand", "packet": "100", "delay": "10-20"}]' />
                    </Form.Item>
                  </>
                ) : isBlackhole ? (
                  <Form.Item
                    name="bhResponseType"
                    label="响应类型 (response.type)"
                    tooltip="none 直接关闭连接（默认），http 发回一个简单的 HTTP 403 数据包后关闭"
                  >
                    <Select options={BLACKHOLE_RESPONSE_OPTIONS} allowClear placeholder="none（默认）" />
                  </Form.Item>
                ) : isLoopback ? (
                  <>
                    <Form.Item
                      name="lbInboundTag"
                      label="入站标识 (inboundTag)"
                      tooltip="用于重新进入路由时的入站标识，可在路由中用于 inboundTag"
                    >
                      <AutoComplete
                        options={inboundTags.map((t) => ({ value: t }))}
                        placeholder="选择或输入入站标识"
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item
                      name="lbSniffingJson"
                      label="流量探测 (sniffing)"
                      tooltip="对重新进入的请求执行流量探测，配置与入站相同，JSON 对象"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='{"enabled": true, "destOverride": ["http", "tls"]}' />
                    </Form.Item>
                  </>
                ) : isDns ? (
                  <>
                    <Form.Item
                      name="dnsRewriteNetwork"
                      label="改写传输层协议 (rewriteNetwork)"
                      tooltip="修改 DNS 流量的传输层协议，不指定时保持来源传输方式不变"
                    >
                      <Select options={DNS_NETWORK_OPTIONS} allowClear placeholder="不指定（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="dnsRewriteAddress"
                      label="改写服务器地址 (rewriteAddress)"
                      tooltip="修改 DNS 服务器地址，不指定时保持来源中指定的地址不变"
                    >
                      <Input placeholder="例如 1.1.1.1（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="dnsRewritePort"
                      label="改写服务器端口 (rewritePort)"
                      tooltip="修改 DNS 服务器端口，不指定时保持来源中指定的端口不变"
                    >
                      <InputNumber min={1} max={65535} style={{ width: "100%" }} placeholder="例如 53（可选）" />
                    </Form.Item>
                    <Form.Item
                      name="dnsUserLevel"
                      label="用户等级 (userLevel)"
                      tooltip="连接会使用这个用户等级对应的本地策略，默认为 0"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="0（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="dnsRulesJson"
                      label="规则 (rules)"
                      tooltip="按顺序匹配 DNS 查询规则，未命中任何规则时使用内置兜底规则，JSON 数组"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder='[{"action": "direct", "domain": ["example.com"]}]' />
                    </Form.Item>
                  </>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    请先在上方选择协议，再配置对应的协议设置
                  </Typography.Text>
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
                                <Typography.Text strong style={{ fontSize: 12, marginBottom: 4 }}>
                                  客户端
                                </Typography.Text>
                                <Form.Item
                                  name="realityServerName"
                                  label="serverName (serverName)"
                                  tooltip="必填（客户端），服务端 serverNames 之一"
                                  rules={[{ required: true, message: "请输入 serverName" }]}
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
                key: "proxy",
                label: "出站代理 (proxySettings)",
                children: (
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Form.Item
                      name="proxyTag"
                      label="转发出站 (tag)"
                      tooltip="指定另一个 outbound 的标识时，此出站发出的数据将被转发至所指定的 outbound 发出"
                    >
                      <AutoComplete
                        options={outboundTags.map((t) => ({ value: t }))}
                        placeholder="选择或输入出站标识"
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item
                      name="proxyTransportLayer"
                      label="传输层代理 (transportLayer)"
                      tooltip="true 时将此设置转化为 Sockopt.dialerProxy 以支持此出站的 streamSettings，默认 false"
                      valuePropName="checked"
                    >
                      <Switch />
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
                key: "mux",
                label: "多路复用 (mux)",
                children: (
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Form.Item
                      name="muxEnabled"
                      label="启用 Mux (enabled)"
                      tooltip="是否启用 Mux 转发请求，默认 false"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="muxConcurrency"
                      label="最大并发连接数 (concurrency)"
                      tooltip="最小值 1，最大值 128；省略或填 0 时等于 8，填负数时 TCP 流量不走 Mux"
                    >
                      <InputNumber min={1} max={128} style={{ width: "100%" }} placeholder="8（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="muxXudpConcurrency"
                      label="XUDP 最大并发数 (xudpConcurrency)"
                      tooltip="使用新 XUDP 聚合隧道代理 UDP 流量的最大并发子 UoT 数量，1-1024"
                    >
                      <InputNumber min={1} max={1024} style={{ width: "100%" }} placeholder="不指定（默认）" />
                    </Form.Item>
                    <Form.Item
                      name="muxXudpProxyUDP443"
                      label="UDP/443 处理方式 (xudpProxyUDP443)"
                      tooltip="控制 Mux 对被代理的 UDP/443（QUIC）流量的处理方式，默认 reject 拒绝"
                    >
                      <Select options={XUDP_PROXY_OPTIONS} allowClear placeholder="reject（默认）" />
                    </Form.Item>
                  </Space>
                ),
              },
            ]}
          />
        </Form>
      </ScrollArea>
    </Modal>
  );
}
