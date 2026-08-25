import { useState } from "react";
import { App, Button, Modal, Space, Tag, Tooltip, Typography } from "antd";
import { ShareAltOutlined } from "@ant-design/icons";
import { formatInbounds, inboundSummary, parseInbounds } from "../inbounds";
import type { InboundObject } from "../inbounds";
import { useAppStore } from "../store";
import InboundEditModal from "./InboundEditModal";
import InboundShareModal from "./InboundShareModal";
import SectionListForm from "./SectionListForm";

/** 入站列表表单（容器逻辑见 SectionListForm） */
export default function InboundForm() {
  const { message } = App.useApp();
  const [shareInbound, setShareInbound] = useState<InboundObject | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const currentProfile = useAppStore((s) => {
    return s.profiles.find((p) => p.id === s.currentProfileId) ?? null;
  });

  const handleShare = (item: InboundObject) => {
    const protocol = typeof item.protocol === "string" ? item.protocol : "";
    if (!["vless", "vmess", "trojan", "shadowsocks"].includes(protocol)) {
      message.warning(`暂不支持 ${protocol || "未知协议"} 的分享链接`);
      return;
    }
    setShareInbound(item);
    setShareOpen(true);
  };

  return (
    <>
      <SectionListForm<InboundObject>
        path="inbounds"
        title="入站"
        unit="个"
        parse={parseInbounds}
        format={formatInbounds}
        emptyText="暂无入站，点击右上角「新增」创建"
        deleteConfirmTitle="删除这个入站？"
        extraActions={(item, _i) => (
          <Tooltip title="分享">
            <Button
              size="small"
              type="text"
              icon={<ShareAltOutlined />}
              onClick={() => handleShare(item)}
            />
          </Tooltip>
        )}
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
      <Modal
        open={shareOpen}
        title={`分享入站 — ${shareInbound?.tag ?? ""}`}
        onCancel={() => setShareOpen(false)}
        footer={null}
        destroyOnHidden
        width={600}
      >
        <InboundShareModal
          open={shareOpen}
          inbound={shareInbound}
          defaultServerAddress={currentProfile?.serverAddress}
        />
      </Modal>
    </>
  );
}
