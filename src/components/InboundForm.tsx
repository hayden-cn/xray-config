import { Space, Tag, Typography } from "antd";
import { formatInbounds, inboundSummary, parseInbounds } from "../inbounds";
import type { InboundObject } from "../inbounds";
import InboundEditModal from "./InboundEditModal";
import SectionListForm from "./SectionListForm";

/** 入站列表表单（容器逻辑见 SectionListForm） */
export default function InboundForm() {
  return (
    <SectionListForm<InboundObject>
      path="inbounds"
      title="入站"
      unit="个"
      parse={parseInbounds}
      format={formatInbounds}
      emptyText="暂无入站，点击右上角「新增」创建"
      deleteConfirmTitle="删除这个入站？"
      renderItem={(b) => {
        const s = inboundSummary(b);
        return (
          <div className="rule-card-main">
            <Space size={6} wrap>
              {s.protocol && (
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  {s.protocol}
                </Tag>
              )}
              {(s.listen || s.port) && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {s.listen || "0.0.0.0"}
                  {s.port ? `:${s.port}` : ""}
                </Typography.Text>
              )}
              {s.sniffing && (
                <Tag color="green" style={{ marginInlineEnd: 0 }}>
                  嗅探
                </Tag>
              )}
              {s.tag && (
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {s.tag}
                </Typography.Text>
              )}
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {s.protocol === "vless" ||
              s.protocol === "socks" ||
              s.protocol === "http" ||
              s.protocol === "wireguard"
                ? "支持结构化表单编辑"
                : "协议设置走 JSON 编辑"}
            </Typography.Text>
          </div>
        );
      }}
      EditModal={InboundEditModal}
    />
  );
}
