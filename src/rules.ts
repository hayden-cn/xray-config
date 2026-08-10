import { parseJsonc } from "./json";

/** 路由规则对象（RuleObject），保留未知字段 */
export interface RuleObject {
  [key: string]: unknown;
  domain?: string[];
  ip?: string[];
  port?: number | string;
  sourcePort?: number | string;
  localPort?: number | string;
  network?: string;
  sourceIP?: string[];
  source?: string[];
  localIP?: string[];
  user?: string[];
  vlessRoute?: number | string;
  inboundTag?: string[];
  protocol?: string[];
  attrs?: Record<string, unknown>;
  process?: string[];
  outboundTag?: string;
  balancerTag?: string;
  ruleTag?: string;
  webhook?: Record<string, unknown>;
}

/** 转发目标类型：出站 或 负载均衡器，二选一 */
export type TargetKind = "outboundTag" | "balancerTag";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 解析对象数组类 section 文本；非法（非数组或含非对象元素）返回 null */
export function parseList<T extends Record<string, unknown>>(text: string): T[] | null {
  if (!text || !text.trim()) return [];
  const v = parseJsonc(text);
  if (!Array.isArray(v)) return null;
  if (v.some((el) => !isObject(el))) return null;
  return v as T[];
}

/** 解析 routing.rules 文本为规则数组；非法（非数组或含非对象元素）返回 null */
export function parseRules(text: string): RuleObject[] | null {
  return parseList<RuleObject>(text);
}

/** 对象数组序列化为 sections 文本；空数组写空串（与 splitSections/buildFull 空值语义一致） */
export function formatList<T>(list: T[]): string {
  return list.length === 0 ? "" : JSON.stringify(list, null, 2);
}

/** 规则数组序列化为 sections 文本；空数组写空串（与 splitSections/buildFull 空值语义一致） */
export function formatRules(rules: RuleObject[]): string {
  return formatList(rules);
}

/** 从数组类 section 文本提取对象元素 {tag} 标签列表（outbounds/balancers/inbounds 通用） */
export function extractTags(text: string): string[] {
  if (!text || !text.trim()) return [];
  const v = parseJsonc(text);
  if (!Array.isArray(v)) return [];
  const tags: string[] = [];
  for (const el of v) {
    if (isObject(el) && typeof el.tag === "string" && el.tag) tags.push(el.tag);
  }
  return tags;
}

function clamp(v: unknown, max = 3): string {
  const parts = (Array.isArray(v) ? v : [v]).map((x) => String(x));
  return parts.length <= max
    ? parts.join(", ")
    : `${parts.slice(0, max).join(", ")}…共${parts.length}项`;
}

export interface RuleSummary {
  title: string;
  conds: string[];
  target: string;
  kind: "outbound" | "balancer" | "none";
}

/** 生成规则卡片摘要 */
export function ruleSummary(rule: RuleObject): RuleSummary {
  const conds: string[] = [];
  if (Array.isArray(rule.domain) && rule.domain.length) conds.push(`域名: ${clamp(rule.domain)}`);
  if (Array.isArray(rule.ip) && rule.ip.length) conds.push(`IP: ${clamp(rule.ip)}`);
  if (rule.port !== undefined) conds.push(`端口: ${rule.port}`);
  if (rule.sourcePort !== undefined) conds.push(`源端口: ${rule.sourcePort}`);
  if (rule.localPort !== undefined) conds.push(`本地端口: ${rule.localPort}`);
  if (typeof rule.network === "string" && rule.network) conds.push(`网络: ${rule.network}`);
  const src = Array.isArray(rule.sourceIP) && rule.sourceIP.length ? rule.sourceIP : rule.source;
  if (Array.isArray(src) && src.length) conds.push(`来源IP: ${clamp(src)}`);
  if (Array.isArray(rule.localIP) && rule.localIP.length) conds.push(`本地IP: ${clamp(rule.localIP)}`);
  if (Array.isArray(rule.user) && rule.user.length) conds.push(`用户: ${clamp(rule.user)}`);
  if (rule.vlessRoute !== undefined) conds.push(`VLESS: ${rule.vlessRoute}`);
  if (Array.isArray(rule.inboundTag) && rule.inboundTag.length) conds.push(`入站: ${clamp(rule.inboundTag)}`);
  if (Array.isArray(rule.protocol) && rule.protocol.length) conds.push(`协议: ${clamp(rule.protocol, 2)}`);
  if (Array.isArray(rule.process) && rule.process.length) conds.push(`进程: ${clamp(rule.process)}`);
  if (isObject(rule.attrs) && Object.keys(rule.attrs).length) conds.push("HTTP 属性");

  const kind: RuleSummary["kind"] = rule.outboundTag
    ? "outbound"
    : rule.balancerTag
      ? "balancer"
      : "none";
  const target =
    kind === "outbound"
      ? `→ 出站 ${rule.outboundTag}`
      : kind === "balancer"
        ? `→ 均衡 ${rule.balancerTag}`
        : "未指定目标";

  return {
    title: typeof rule.ruleTag === "string" ? rule.ruleTag.trim() : "",
    conds,
    target,
    kind,
  };
}
