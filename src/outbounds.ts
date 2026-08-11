import { formatList, parseList } from "./rules";

/** 出站对象（OutboundObject），保留未知字段 */
export interface OutboundObject {
  [key: string]: unknown;
  tag?: string;
  protocol?: string;
  settings?: Record<string, unknown>;
  streamSettings?: Record<string, unknown>;
  proxySettings?: Record<string, unknown>;
  mux?: Record<string, unknown>;
  sendThrough?: string;
  targetStrategy?: string;
  comment?: string;
}

/** WireGuard 出站对端（WireguardOutboundPeers），保留未知字段 */
export interface WireguardOutboundPeer {
  [key: string]: unknown;
  endpoint?: string;
  publicKey?: string;
  preSharedKey?: string;
  keepAlive?: number;
  allowedIPs?: string[];
}

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 解析 outbounds 文本为出站数组；非法（非数组或含非对象元素）返回 null */
export function parseOutbounds(text: string): OutboundObject[] | null {
  return parseList<OutboundObject>(text);
}

/** 出站数组序列化为 sections 文本；空数组写空串（与 splitSections/buildFull 空值语义一致） */
export function formatOutbounds(list: OutboundObject[]): string {
  return formatList(list);
}

export interface OutboundSummary {
  tag: string;
  protocol: string;
  address: string;
  port: string;
}

/** 生成出站卡片摘要 */
export function outboundSummary(b: OutboundObject): OutboundSummary {
  const settings = isPlainObj(b.settings) ? b.settings : {};
  const address = typeof settings.address === "string" ? settings.address : "";
  const port =
    typeof settings.port === "number" || typeof settings.port === "string" ? String(settings.port) : "";
  return {
    tag: typeof b.tag === "string" ? b.tag : "",
    protocol: typeof b.protocol === "string" ? b.protocol : "",
    address,
    port,
  };
}
