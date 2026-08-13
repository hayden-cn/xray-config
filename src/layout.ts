export interface LayoutChild {
  /** xray 配置项路径（点号子路径），如 "routing.rules" */
  key: string;
  /** 可选标题；不设置则不显示 section 标题 */
  label?: string;
}

export interface LayoutTab {
  /** 外层 key 仅作 tabs 唯一标识，无配置意义 */
  key: string;
  label: string;
  children: LayoutChild[];
}

export const layouts: LayoutTab[] = [
  { key: "inbounds", label: "入站", children: [{ key: "inbounds" }] },
  { key: "outbounds", label: "出站", children: [{ key: "outbounds" }] },
  { key: "rules", label: "路由规则", children: [{ key: "routing.rules" }] },
  { key: "balancers", label: "负载均衡", children: [{ key: "routing.balancers" }] },
  {
    key: "observatory",
    label: "观测",
    children: [
      { key: "observatory", label: "常规观测" },
      { key: "burstObservatory", label: "突发观测" },
    ],
  },
  {
    key: "other",
    label: "其他",
    children: [
      { key: "log", label: "日志" },
      { key: "routing", label: "路由" },
      { key: "api", label: "API" },
      { key: "dns", label: "DNS" },
      { key: "fakedns", label: "FakeDNS" },
      { key: "policy", label: "策略" },
      { key: "stats", label: "统计" },
      { key: "metrics", label: "指标" },
      { key: "geodata", label: "GeoData" },
      { key: "env", label: "环境" },
      { key: "version", label: "版本" },
      { key: "reverse", label: "反向代理" },
      { key: "transport", label: "传输" },
    ],
  },
];

/** 布局内全部 child 路径（拆/合两侧的键集合） */
export function allChildPaths(): string[] {
  return layouts.flatMap((t) => t.children.map((c) => c.key));
}

/** 给定路径的已独立拆出的子 section 路径（如 routing → routing.rules / routing.balancers） */
export function descendantSections(path: string): string[] {
  const prefix = `${path}.`;
  return allChildPaths().filter((p) => p.startsWith(prefix));
}
