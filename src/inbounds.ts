import { formatList, parseList } from "./rules";

/** 流量探测配置（sniffing），保留未知字段 */
export interface SniffingObject {
  [key: string]: unknown;
  enabled?: boolean;
  destOverride?: string[];
  metadataOnly?: boolean;
  domainsExcluded?: string[];
  ipsExcluded?: string[];
  routeOnly?: boolean;
}

/** VLESS 入站用户（VlessInboundUserObject），保留未知字段 */
export interface VlessInboundUser {
  [key: string]: unknown;
  id?: string;
  level?: number;
  email?: string;
  flow?: string;
  reverse?: { tag?: string };
}

/** VLESS 入站配置（VlessInboundConfigurationObject），保留未知字段 */
export interface VlessInboundSettings {
  [key: string]: unknown;
  users?: VlessInboundUser[];
  flow?: string;
  decryption?: string;
  fallbacks?: Array<Record<string, unknown>>;
}

/** 入站对象（InboundObject），保留未知字段 */
export interface InboundObject {
  [key: string]: unknown;
  tag?: string;
  listen?: string;
  port?: number | string;
  protocol?: string;
  settings?: Record<string, unknown>;
  streamSettings?: Record<string, unknown>;
  sniffing?: SniffingObject;
}

/** 解析 inbounds 文本为入站数组；非法（非数组或含非对象元素）返回 null */
export function parseInbounds(text: string): InboundObject[] | null {
  return parseList<InboundObject>(text);
}

/** 入站数组序列化为 sections 文本；空数组写空串（与 splitSections/buildFull 空值语义一致） */
export function formatInbounds(list: InboundObject[]): string {
  return formatList(list);
}

export interface InboundSummary {
  tag: string;
  protocol: string;
  listen: string;
  port: string;
  sniffing: boolean;
}

/** 生成入站卡片摘要 */
export function inboundSummary(b: InboundObject): InboundSummary {
  const port = typeof b.port === "number" || typeof b.port === "string" ? String(b.port) : "";
  const listen = typeof b.listen === "string" ? b.listen : "";
  return {
    tag: typeof b.tag === "string" ? b.tag : "",
    protocol: typeof b.protocol === "string" ? b.protocol : "",
    listen,
    port,
    sniffing: typeof b.sniffing?.enabled === "boolean" ? b.sniffing.enabled : false,
  };
}
