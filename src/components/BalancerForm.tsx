import { Space, Tag, Typography } from "antd";
import { balancerSummary, formatBalancers, parseBalancers } from "../balancers";
import type { BalancerObject } from "../balancers";
import BalancerEditModal from "./BalancerEditModal";
import SectionListForm from "./SectionListForm";

/** 负载均衡列表表单（容器逻辑见 SectionListForm） */
export default function BalancerForm() {
  return (
    <SectionListForm<BalancerObject>
      path="routing.balancers"
      title="负载均衡"
      unit="个"
      parse={parseBalancers}
      format={formatBalancers}
      emptyText="暂无负载均衡，点击右上角「新增」创建"
      deleteConfirmTitle="删除这个负载均衡？"
      renderItem={(b) => {
        const s = balancerSummary(b);
        return (
          <div className="rule-card-main">
            <Space size={6} wrap>
              {s.tag && (
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {s.tag}
                </Typography.Text>
              )}
              {s.strategy && (
                <Tag style={{ marginInlineEnd: 0 }}>策略: {s.strategy}</Tag>
              )}
              {s.fallback && (
                <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                  备用: {s.fallback}
                </Tag>
              )}
            </Space>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12 }}
              ellipsis={{ tooltip: s.selectors.join(", ") }}
            >
              {s.selectors.length > 0 ? `选择器: ${s.selectors.join(", ")}` : "未配置选择器"}
            </Typography.Text>
          </div>
        );
      }}
      EditModal={BalancerEditModal}
    />
  );
}
