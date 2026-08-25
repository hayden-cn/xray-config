import { useEffect, useState } from "react";
import { App, Button, Empty, Input, Space, Typography } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import type { InboundObject } from "../inbounds";
import { generateShareLinks, type ShareLink } from "../share";
import ScrollArea from "./ScrollArea";

interface InboundShareModalProps {
  open: boolean;
  inbound: InboundObject | null;
  defaultServerAddress?: string | null;
}

export default function InboundShareModal({
  open,
  inbound,
  defaultServerAddress,
}: InboundShareModalProps) {
  const { message } = App.useApp();
  const [serverAddr, setServerAddr] = useState(defaultServerAddress ?? "");
  const [portOverride, setPortOverride] = useState<string>("");
  const [links, setLinks] = useState<ShareLink[]>([]);

  useEffect(() => {
    if (open) {
      setServerAddr(defaultServerAddress ?? "");
      setPortOverride("");
    }
  }, [open, defaultServerAddress]);

  useEffect(() => {
    if (!open || !inbound) {
      setLinks([]);
      return;
    }
    const port = portOverride.trim() || undefined;
    const result = generateShareLinks(
      inbound,
      serverAddr,
      port,
    );
    setLinks(result);
  }, [open, inbound, serverAddr, portOverride]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("已复制到剪贴板");
    } catch {
      message.error("复制失败");
    }
  };

  const copyAll = async () => {
    if (links.length === 0) return;
    const text = links.map((l) => l.url).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      message.success(`已复制 ${links.length} 条链接`);
    } catch {
      message.error("复制失败");
    }
  };

  const protocol = typeof inbound?.protocol === "string" ? inbound.protocol : "";
  const tag = typeof inbound?.tag === "string" ? inbound.tag : "";
  const supported = ["vless", "vmess", "trojan", "shadowsocks"].includes(protocol);

  return (
    <div>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={serverAddr}
            onChange={(e) => setServerAddr(e.target.value)}
            placeholder="服务器地址（域名或 IP）"
            addonBefore="地址"
          />
        </Space.Compact>
        <Input
          value={portOverride}
          onChange={(e) => setPortOverride(e.target.value)}
          placeholder={typeof inbound?.port === "number" || typeof inbound?.port === "string" ? String(inbound.port) : "端口"}
          addonBefore="端口"
        />
        {!supported ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`暂不支持 ${protocol || "（未知协议）"} 的分享链接`}
          />
        ) : links.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={serverAddr.trim() ? "无法生成链接，请检查入站配置" : "请填写服务器地址"}
          />
        ) : (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              共生成 {links.length} 条链接（{tag}）
            </Typography.Text>
            <ScrollArea maxHeight="50vh">
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {links.map((link, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: "var(--section-head-bg, #1d1d1d)",
                      border: "1px solid var(--border-color, #303030)",
                    }}
                  >
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      {links.length > 1 && (
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {link.label}
                        </Typography.Text>
                      )}
                      <Space.Compact style={{ width: "100%" }}>
                        <Typography.Text
                          ellipsis
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            flex: 1,
                            lineHeight: "32px",
                            padding: "0 11px",
                          }}
                        >
                          {link.url}
                        </Typography.Text>
                        <Button
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(link.url)}
                        >
                          复制
                        </Button>
                      </Space.Compact>
                    </Space>
                  </div>
                ))}
              </Space>
            </ScrollArea>
            {links.length > 1 && (
              <Button block onClick={copyAll}>
                复制全部 {links.length} 条链接
              </Button>
            )}
          </>
        )}
      </Space>
    </div>
  );
}
