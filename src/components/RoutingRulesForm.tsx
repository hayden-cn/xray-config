import { Typography } from "antd";
import { formatRules, parseRules, ruleSummary } from "../rules";
import type { RuleObject } from "../rules";
import RuleEditModal from "./RuleEditModal";
import SectionListForm from "./SectionListForm";

/** 路由规则列表表单（容器逻辑见 SectionListForm） */
export default function RoutingRulesForm() {
  return (
    <SectionListForm<RuleObject>
      path="routing.rules"
      title="路由规则"
      parse={parseRules}
      format={formatRules}
      emptyText="暂无规则，点击右上角「新增」创建"
      deleteConfirmTitle="删除这条规则？"
      renderItem={(rule) => {
        const summary = ruleSummary(rule);
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
            <span className={`rule-target ${summary.kind}`}>{summary.target}</span>
          </>
        );
      }}
      EditModal={RuleEditModal}
    />
  );
}
