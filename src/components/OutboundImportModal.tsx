import { useState } from "react";
import { App, Button, Input, Space, Typography } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import type { OutboundObject } from "../outbounds";
import { parseOutbounds, formatOutbounds } from "../outbounds";
import { parseShareLinks } from "../share";
import { useAppStore } from "../store";
import ScrollArea from "./ScrollArea";

const { TextArea } = Input;

interface OutboundImportModalProps {
  onClose: () => void;
}

export default function OutboundImportModal({ onClose }: OutboundImportModalProps) {
  const { message } = App.useApp();
  const [text, setText] = useState("");
  const [results, setResults] = useState<ReturnType<typeof parseShareLinks>>([]);

  const handleParse = () => {
    if (!text.trim()) return;
    const r = parseShareLinks(text);
    setResults(r);
  };

  const handleImport = () => {
    const outbounds = results
      .filter((r) => r.ok && r.outbound)
      .map((r) => r.outbound as OutboundObject);
    if (outbounds.length === 0) return;

    const store = useAppStore.getState();
    const raw = store.sections["outbounds"];
    const existing = parseOutbounds(raw) ?? [];
    store.setSection("outbounds", formatOutbounds([...existing, ...outbounds]));

    const failCount = results.filter((r) => !r.ok).length;
    message.success(
      `已导入 ${outbounds.length} 条出站` + (failCount > 0 ? `，${failCount} 条解析失败` : ""),
    );
    setText("");
    setResults([]);
    onClose();
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <TextArea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"每行一个分享链接，支持 vless/vmess/trojan/ss\n\n示例：\nvless://uuid@host:443?security=reality&sni=host#tag\nvmess://base64json\ntrojan://password@host:443#tag\nss://base64(method:password)@host:8388#tag"}
        style={{ fontFamily: "monospace", fontSize: 12 }}
      />
      <Space>
        <Button onClick={handleParse} disabled={!text.trim()}>
          解析
        </Button>
        {results.length > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {results.filter((r) => r.ok).length} 条可导入
            {results.filter((r) => !r.ok).length > 0 &&
              `，${results.filter((r) => !r.ok).length} 条失败`}
          </Typography.Text>
        )}
      </Space>
      {results.length > 0 && (
        <ScrollArea maxHeight="40vh">
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "var(--section-head-bg, #1d1d1d)",
                  border: `1px solid ${r.ok ? "var(--border-color, #303030)" : "var(--ant-error-color, #ff4d4f)"}`,
                }}
              >
                <Space size={6} style={{ width: "100%" }}>
                  {r.ok ? (
                    <CheckCircleOutlined style={{ color: "var(--ant-success-color, #52c41a)" }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: "var(--ant-error-color, #ff4d4f)" }} />
                  )}
                  <Typography.Text ellipsis style={{ fontSize: 12, flex: 1 }}>
                    {r.raw}
                  </Typography.Text>
                  {r.ok && r.outbound && (
                    <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                      {r.outbound.protocol} → {r.outbound.tag || "(无 tag)"}
                    </Typography.Text>
                  )}
                </Space>
                {!r.ok && r.error && (
                  <Typography.Text type="danger" style={{ fontSize: 11, marginLeft: 18 }}>
                    {r.error}
                  </Typography.Text>
                )}
              </div>
            ))}
          </Space>
        </ScrollArea>
      )}
      <Button
        type="primary"
        block
        disabled={results.filter((r) => r.ok).length === 0}
        onClick={handleImport}
      >
        导入 {results.filter((r) => r.ok).length} 条出站
      </Button>
    </Space>
  );
}
