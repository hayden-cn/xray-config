import { formatList, parseList } from "./rules";

/** 负载均衡策略设置（strategy.settings），保留未知字段 */
export interface BalancerStrategySettings {
  [key: string]: unknown;
  expected?: number;
  maxRTT?: string;
  tolerance?: number;
  baselines?: string[];
  costs?: Array<{ regexp?: boolean; match?: string; value?: number }>;
}

/** 负载均衡策略（strategy），保留未知字段 */
export interface BalancerStrategy {
  [key: string]: unknown;
  type?: string;
  settings?: BalancerStrategySettings;
}

/** 负载均衡对象（BalancerObject），保留未知字段 */
export interface BalancerObject {
  [key: string]: unknown;
  tag?: string;
  selector?: string[];
  fallbackTag?: string;
  strategy?: BalancerStrategy;
}

/** 解析 routing.balancers 文本为负载均衡数组；非法（非数组或含非对象元素）返回 null */
export function parseBalancers(text: string): BalancerObject[] | null {
  return parseList<BalancerObject>(text);
}

/** 负载均衡数组序列化为 sections 文本；空数组写空串（与 splitSections/buildFull 空值语义一致） */
export function formatBalancers(list: BalancerObject[]): string {
  return formatList(list);
}

export interface BalancerSummary {
  tag: string;
  selectors: string[];
  strategy: string;
  fallback: string;
}

/** 生成负载均衡卡片摘要 */
export function balancerSummary(b: BalancerObject): BalancerSummary {
  return {
    tag: typeof b.tag === "string" ? b.tag : "",
    selectors: Array.isArray(b.selector) ? b.selector.map((s) => String(s)) : [],
    strategy: typeof b.strategy?.type === "string" ? b.strategy.type : "",
    fallback: typeof b.fallbackTag === "string" ? b.fallbackTag : "",
  };
}
