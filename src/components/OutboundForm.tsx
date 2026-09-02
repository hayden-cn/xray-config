import { useState } from "react";
import { Button, Modal, Space, Tag, Tooltip, Typography } from "antd";
import { ImportOutlined, CloudSyncOutlined } from "@ant-design/icons";
import { formatOutbounds, outboundSummary, parseOutbounds } from "../outbounds";
import type { OutboundObject } from "../outbounds";
import OutboundEditModal from "./OutboundEditModal";
import OutboundImportModal from "./OutboundImportModal";
import SectionListForm from "./SectionListForm";
import SubscriptionModal from "./SubscriptionModal";

/** 出站列表表单（容器逻辑见 SectionListForm） */
export default function OutboundForm() {
  const [importOpen, setImportOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);

  return (
    <>
      <SectionListForm<OutboundObject>
        path="outbounds"
        title="出站"
        unit="个"
        parse={parseOutbounds}
        format={formatOutbounds}
        emptyText="暂无出站，点击右上角「新增」创建"
        deleteConfirmTitle="删除这个出站？"
        headerExtra={
          <>
            <Tooltip title="通过订阅导入节点">
              <Button
                size="small"
                type="text"
                icon={<CloudSyncOutlined />}
                onClick={() => setSubOpen(true)}
              >
                订阅
              </Button>
            </Tooltip>
            <Tooltip title="从分享链接导入">
              <Button
                size="small"
                type="text"
                icon={<ImportOutlined />}
                onClick={() => setImportOpen(true)}
              >
                导入
              </Button>
            </Tooltip>
          </>
        }
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
      <Modal
        open={importOpen}
        title="导入分享链接"
        onCancel={() => setImportOpen(false)}
        footer={null}
        destroyOnHidden
        width={600}
      >
        <OutboundImportModal onClose={() => setImportOpen(false)} />
      </Modal>
      <SubscriptionModal open={subOpen} onClose={() => setSubOpen(false)} />
    </>
  );
}
