import { Space, Tag, Typography } from "antd";
import { formatOutbounds, outboundSummary, parseOutbounds } from "../outbounds";
import type { OutboundObject } from "../outbounds";
import OutboundEditModal from "./OutboundEditModal";
import SectionListForm from "./SectionListForm";

/** 出站列表表单（容器逻辑见 SectionListForm） */
export default function OutboundForm() {
  return (
    <SectionListForm<OutboundObject>
      path="outbounds"
      title="出站"
      unit="个"
      parse={parseOutbounds}
      format={formatOutbounds}
      emptyText="暂无出站，点击右上角「新增」创建"
      deleteConfirmTitle="删除这个出站？"
      renderItem={(b) => {
        const s = outboundSummary(b);
        return (
          <div className="rule-card-main">
            <Space size={6} wrap>
              {s.protocol && (
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  {s.protocol}
                </Tag>
              )}
              {(s.address || s.port) && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {s.address || ""}
                  {s.port ? `:${s.port}` : ""}
                </Typography.Text>
              )}
              {s.tag && (
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {s.tag}
                </Typography.Text>
              )}
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              支持结构化表单编辑
            </Typography.Text>
          </div>
        );
      }}
      EditModal={OutboundEditModal}
    />
  );
}
