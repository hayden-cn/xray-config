import { useEffect, useState } from "react";
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useAppStore } from "../store";
import { api } from "../api";
import { parseOutbounds, formatOutbounds } from "../outbounds";
import type { KnifeSubscription } from "../types";
import type { OutboundObject } from "../outbounds";
import ScrollArea from "./ScrollArea";

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
}

type SubView = "list" | "nodes";

export default function SubscriptionModal({ open, onClose }: SubscriptionModalProps) {
  const { message } = App.useApp();
  const settings = useAppStore((s) => s.settings);
  const knifeNodesCache = useAppStore((s) => s.knifeNodesCache);

  const [view, setView] = useState<SubView>("list");
  const [knifePath, setKnifePath] = useState<string | null>(null);
  const [subs, setSubs] = useState<KnifeSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  // 节点视图状态
  const [activeSub, setActiveSub] = useState<KnifeSubscription | null>(null);
  const [nodes, setNodes] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [replaceProxy, setReplaceProxy] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KnifeSubscription | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    setView("list");
    setSubs([]);
    setNodes([]);
    setChecked([]);
    setReplaceProxy(true);
    setActiveSub(null);
    void init();
  }, [open]);

  const init = async () => {
    try {
      const p = await api.knifeResolve(settings);
      setKnifePath(p);
      if (p) {
        await loadSubs();
      }
    } catch (e) {
      message.error(String(e));
    }
  };

  const loadSubs = async () => {
    setLoading(true);
    try {
      const list = await api.knifeListSubscriptions(settings);
      setSubs(list);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const values = await addForm.validateFields();
    try {
      await api.knifeAddSubscription(settings, values.url.trim(), (values.remark ?? "").trim());
      message.success("已添加订阅");
      setAddOpen(false);
      addForm.resetFields();
      await loadSubs();
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await api.knifeRemoveSubscription(settings, id);
      message.success("已删除订阅");
      invalidateCache(id);
      await loadSubs();
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleFetch = async (id: number) => {
    try {
      await api.knifeFetchSubscription(settings, id);
      message.success("已更新订阅");
      invalidateCache(id);
      await loadSubs();
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleEdit = () => {
    if (!editTarget) return;
    setEditOpen(true);
    editForm.setFieldsValue({ url: editTarget.url, remark: editTarget.remark });
  };

  const handleEditSave = async () => {
    const values = await editForm.validateFields();
    if (!editTarget) return;
    try {
      await api.knifeUpdateSubscription(
        settings,
        editTarget.id,
        values.url?.trim() || null,
        values.remark ?? null,
      );
      message.success("已保存修改");
      setEditOpen(false);
      await loadSubs();
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleTest = async (sub: KnifeSubscription) => {
    // 命中缓存则直接进入节点视图，无需重新测试
    const cached = knifeNodesCache[sub.id];
    if (cached) {
      setActiveSub({ ...sub });
      setNodes(cached);
      setChecked([]);
      setView("nodes");
      return;
    }
    await runTest(sub, true);
  };

  const invalidateCache = (id: number) => {
    const store = useAppStore.getState();
    if (store.knifeNodesCache[id] !== undefined) {
      const next = { ...store.knifeNodesCache };
      delete next[id];
      store.setKnifeNodesCache(next);
    }
  };

  const runTest = async (sub: KnifeSubscription, saveCache: boolean) => {
    try {
      await api.knifeFetchSubscription(settings, sub.id);
      setTestingId(sub.id);
      const links = await api.knifeTestSubscription(settings, sub.id);
      setActiveSub({ ...sub });
      setNodes(links);
      setChecked([]);
      if (saveCache) {
        const store = useAppStore.getState();
        const next = { ...store.knifeNodesCache, [sub.id]: links };
        store.setKnifeNodesCache(next);
      }
      setView("nodes");
    } catch (e) {
      message.error(String(e));
    } finally {
      setTestingId(null);
    }
  };

  // 重新测试当前订阅：跳过缓存，更新节点
  const handleRetest = async () => {
    if (!activeSub) return;
    invalidateCache(activeSub.id);
    await runTest(activeSub, true);
  };

  const handleImport = async () => {
    const selected = checked;
    if (selected.length === 0) return;
    setImporting(true);
    try {
      const store = useAppStore.getState();
      let existing = parseOutbounds(store.sections["outbounds"]) ?? [];
      if (replaceProxy) {
        existing = existing.filter((o) => o.tag == null || !/^proxy-\d+$/.test(o.tag ?? ""));
      }
      const existingTags = new Set(existing.map((o) => o.tag).filter((t): t is string => !!t));
      const imported: OutboundObject[] = [];
      let failed = 0;
      for (const link of selected) {
        const r = await api.knifeParseLink(settings, link);
        if (!r.ok || !r.outbound) {
          failed++;
          continue;
        }
        const ob = r.outbound as OutboundObject;
        const base = "proxy";
        let tag = `${base}-0`;
        let n = 1;
        while (existingTags.has(tag) || imported.some((o) => o.tag === tag)) {
          tag = `${base}-${n++}`;
        }
        ob.tag = tag;
        existingTags.add(tag);
        imported.push(ob);
      }
      store.setSection("outbounds", formatOutbounds([...existing, ...imported]));
      message.success(
        `已导入 ${imported.length} 条出站` + (failed > 0 ? `，${failed} 条解析失败` : ""),
      );
      onClose();
    } catch (e) {
      message.error(String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="订阅管理"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={720}
    >
      {!knifePath ? (
        <Typography.Text type="danger">
          未找到 xray-knife 可执行文件。请在「默认设置」中配置 xray-knife 路径，或确认其已加入系统 PATH。
        </Typography.Text>
      ) : view === "list" ? (
        <Spin spinning={loading}>
          <Space style={{ marginBottom: 8 }} wrap>
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              onClick={() => {
                addForm.resetFields();
                setAddOpen(true);
              }}
            >
              添加订阅
            </Button>
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={loadSubs}>
              刷新
            </Button>
          </Space>
          <ScrollArea maxHeight="60vh">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {subs.length === 0 && (
                <Typography.Text type="secondary">暂无订阅，点击「添加订阅」创建</Typography.Text>
              )}
              {subs.map((s) => (
                <div
                  key={s.id}
                  className="knife-sub-row"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--section-head-bg, #1d1d1d)",
                    border: "1px solid var(--border-color, #303030)",
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Space size={6} style={{ width: "100%" }}>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {s.remark || "(无备注)"}
                      </Typography.Text>
                      <Tag color={s.enabled ? "green" : "default"}>
                        {s.enabled ? "启用" : "停用"}
                      </Tag>
                      <Tag>{s.configs} 节点</Tag>
                    </Space>
                    <Typography.Text
                      type="secondary"
                      ellipsis
                      style={{ fontSize: 11, width: "100%" }}
                    >
                      {s.url}
                    </Typography.Text>
                    <Space size={4} wrap>
                      <Button
                        size="small"
                        icon={<ThunderboltOutlined />}
                        loading={testingId === s.id}
                        onClick={() => handleTest(s)}
                      >
                        查看节点
                      </Button>
                      <Button size="small" icon={<ReloadOutlined />} onClick={() => handleFetch(s.id)}>
                        更新
                      </Button>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setEditTarget(s);
                          handleEdit();
                        }}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除该订阅及其全部节点？"
                        okText="删除"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleRemove(s.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </div>
              ))}
            </Space>
          </ScrollArea>
        </Spin>
      ) : (
        <>
          <Space style={{ marginBottom: 8 }} wrap>
            <Button
              size="small"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setView("list")}
            >
              返回订阅列表
            </Button>
            <Typography.Text strong>{activeSub?.remark}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              测试通过 {nodes.length} 个节点
            </Typography.Text>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={testingId === activeSub?.id}
              onClick={handleRetest}
            >
              重新测试
            </Button>
            <Checkbox checked={replaceProxy} onChange={(e) => setReplaceProxy(e.target.checked)}>
              替换现有 proxy
            </Checkbox>
            <Button
              size="small"
              type="primary"
              icon={<ExportOutlined />}
              disabled={checked.length === 0}
              loading={importing}
              onClick={handleImport}
            >
              解析导入 {checked.length} 个到出站
            </Button>
          </Space>
          <Table<string>
            rowKey={(link) => link}
            dataSource={nodes}
            pagination={false}
            size="small"
            scroll={{ y: "50vh", x: true }}
            style={{ width: "100%" }}
            locale={{ emptyText: "没有测试通过的节点" }}
            rowSelection={{
              selectedRowKeys: checked,
              onChange: (keys) => setChecked(keys.map(String)),
            }}
            columns={[
              {
                title: "节点链接",
                render: (_: unknown, link: string) => (
                  <Typography.Text
                    ellipsis
                    style={{ fontSize: 12, fontFamily: "monospace" }}
                  >
                    {link}
                  </Typography.Text>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal
        open={addOpen}
        title="添加订阅"
        onCancel={() => setAddOpen(false)}
        onOk={handleAdd}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
        width={480}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item name="url" label="订阅 URL" rules={[{ required: true, message: "请输入订阅 URL" }]}>
            <Input placeholder="https://example.com/sub" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={editOpen}
        title="编辑订阅"
        onCancel={() => setEditOpen(false)}
        onOk={handleEditSave}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={480}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="url" label="订阅 URL">
            <Input placeholder="留空则不修改" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input placeholder="留空则清空备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}