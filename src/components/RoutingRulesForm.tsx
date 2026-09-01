import { useMemo } from "react";
import { Select, Typography } from "antd";
import { formatRules, parseRules, ruleSummary, extractTags } from "../rules";
import type { RuleObject } from "../rules";
import { useAppStore } from "../store";
import RuleEditModal from "./RuleEditModal";
import SectionListForm from "./SectionListForm";

const OUT_PREFIX = "out:";
const BAL_PREFIX = "bal:";

/** 路由规则列表表单（容器逻辑见 SectionListForm） */
export default function RoutingRulesForm() {
  const sections = useAppStore((s) => s.sections);

  const baseOptions = useMemo(() => {
    const outbound = extractTags(sections.outbounds).map((tag) => ({
      value: `${OUT_PREFIX}${tag}`,
      label: `→ 出站 ${tag}`,
    }));
    const balancer = extractTags(sections["routing.balancers"]).map((tag) => ({
      value: `${BAL_PREFIX}${tag}`,
      label: `→ 均衡 ${tag}`,
    }));
    return [...outbound, ...balancer];
  }, [sections.outbounds, sections["routing.balancers"]]);

  const applyTarget = (
    updateItem: (next: RuleObject) => void,
    rule: RuleObject,
    value?: string,
  ) => {
    const next: RuleObject = { ...rule };
    delete next.outboundTag;
    delete next.balancerTag;
    if (value) {
      if (value.startsWith(BAL_PREFIX)) next.balancerTag = value.slice(BAL_PREFIX.length);
      else next.outboundTag = value.slice(OUT_PREFIX.length);
    }
    updateItem(next);
  };

  return (
    <SectionListForm<RuleObject>
      path="routing.rules"
      title="路由规则"
      parse={parseRules}
      format={formatRules}
      emptyText="暂无规则，点击右上角「新增」创建"
      deleteConfirmTitle="删除这条规则？"
      renderItem={(rule, _index, updateItem) => {
        const summary = ruleSummary(rule);
        const kind = summary.kind;
        const current =
          kind === "outbound"
            ? `${OUT_PREFIX}${rule.outboundTag}`
            : kind === "balancer"
              ? `${BAL_PREFIX}${rule.balancerTag}`
              : undefined;
        const options = current && !baseOptions.some((o) => o.value === current)
          ? [{ value: current, label: current }, ...baseOptions]
          : baseOptions;
        return (
          <>
            <div className="rule-card-main">
              {summary.title && (
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {summary.title}
                </Typography.Text>
              )}
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12 }}
                ellipsis={{ tooltip: summary.conds.join(" · ") }}
              >
                {summary.conds.length > 0 ? summary.conds.join(" · ") : "匹配全部流量"}
              </Typography.Text>
            </div>
            <Select
              className={`rule-target-select ${kind}`}
              value={current}
              options={options}
              onChange={(v) => applyTarget(updateItem, rule, v)}
              placeholder="未指定目标"
              variant="borderless"
              popupMatchSelectWidth={false}
              showSearch
              style={{ minWidth: 8 }}
            />
          </>
        );
      }}
      EditModal={RuleEditModal}
    />
  );
}
