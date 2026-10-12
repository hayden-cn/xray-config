import { useEffect, useMemo, useState } from "react";
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
  AppstoreOutlined,
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
import type { KnifeConfig, KnifeHttpResult, KnifeSubscription } from "../types";
import type { OutboundObject } from "../outbounds";
import ScrollArea from "./ScrollArea";

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
}

type SubView = "list" | "nodes" | "all";

export default function SubscriptionModal({ open, onClose }: SubscriptionModalProps) {
  const { message } = App.useApp();
  const settings = useAppStore((s) => s.settings);
  const knifeNodesCache = useAppStore((s) => s.knifeNodesCache);

  const [view, setView] = useState<SubView>("list");
  const [knifePath, setKnifePath] = useState<string | null>(null);
  const [subs, setSubs] = useState<KnifeSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [fetchingId, setFetchingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  // 节点视图状态
  const [activeSub, setActiveSub] = useState<KnifeSubscription | null>(null);
  const [nodes, setNodes] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [replaceProxy, setReplaceProxy] = useState(true);

  // 聚合视图状态（全部订阅去重节点，来自 subs list-configs）
  const [allConfigs, setAllConfigs] = useState<KnifeConfig[]>([]);
  const [allResults, setAllResults] = useState<KnifeHttpResult[] | null>(null);
  const [delaySort, setDelaySort] = useState<"ascend" | "descend" | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [testingAll, setTestingAll] = useState(false);

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
    setAllConfigs([]);
    setAllResults(null);
    setDelaySort(null);
    void init();
  }, [open]);

  // 编辑弹窗为 destroyOnHidden，打开后 Form 才挂载，此时才能回填字段
  useEffect(() => {
    if (editOpen && editTarget) {
      editForm.setFieldsValue({ url: editTarget.url, remark: editTarget.remark });
    }
  }, [editOpen, editTarget, editForm]);

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
    if (fetchingId !== null) return;
    setFetchingId(id);
    try {
      await api.knifeFetchSubscription(settings, id);
      message.success("已更新订阅");
      invalidateCache(id);
      await loadSubs();
    } catch (e) {
      message.error(String(e));
    } finally {
      setFetchingId(null);
    }
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
    if (testingId !== null) return;
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
    setTestingId(sub.id);
    try {
      await api.knifeFetchSubscription(settings, sub.id);
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
    if (!activeSub || testingId !== null) return;
    invalidateCache(activeSub.id);
    await runTest(activeSub, true);
  };

  // 聚合视图：即时列出全库去重节点（不测速、不写缓存）
  const openAllConfigs = async () => {
    setChecked([]);
    setAllResults(null);
    setDelaySort(null);
    setView("all");
    setAllLoading(true);
    try {
      setAllConfigs(await api.knifeListConfigs(settings));
    } catch (e) {
      message.error(String(e));
      setView("list");
    } finally {
      setAllLoading(false);
    }
  };

  // 全量测速：单个 http --from-db 进程测全库，完成后显示状态/延迟并默认按延迟升序
  const handleTestAll = async () => {
    if (testingAll) return;
    setTestingAll(true);
    try {
      const results = await api.knifeTestAll(settings);
      setAllResults(results);
      setDelaySort("ascend");
      const passed = new Set(results.filter((r) => r.status === "passed").map((r) => r.link));
      setChecked((prev) => prev.filter((l) => passed.has(l)));
      message.success(`测试通过 ${passed.size} / ${results.length} 个节点`);
    } catch (e) {
      message.error(String(e));
    } finally {
      setTestingAll(false);
    }
  };

  const resultMap = useMemo(() => {
    const m = new Map<string, KnifeHttpResult>();
    for (const r of allResults ?? []) m.set(r.link, r);
    return m;
  }, [allResults]);

  // 排序时失败节点恒排最后；未测速保持库内顺序
  const sortedConfigs = useMemo(() => {
    if (!allResults || delaySort === null) return allConfigs;
    const rank = (c: KnifeConfig) => {
      const r = resultMap.get(c.link);
      return r && r.status === "passed" ? r.delay : Number.POSITIVE_INFINITY;
    };
    return [...allConfigs].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      const aBad = ra === Number.POSITIVE_INFINITY;
      const bBad = rb === Number.POSITIVE_INFINITY;
      if (aBad || bBad) {
        if (aBad && bBad) return 0;
        return aBad ? 1 : -1;
      }
      const d = ra - rb;
      return delaySort === "ascend" ? d : -d;
    });
  }, [allConfigs, allResults, delaySort, resultMap]);

  const passedCount = useMemo(
    () => (allResults ? allResults.filter((r) => r.status === "passed").length : 0),
    [allResults],
  );

  // 选至此：替换为第 1 行到当前行范围内所有通过节点（未测速则范围内全选）
  const selectUpTo = (index: number) => {
    const range = sortedConfigs.slice(0, index + 1);
    const links = range
      .filter((c) => !allResults || resultMap.get(c.link)?.status === "passed")
      .map((c) => c.link);
    setChecked(links);
  };

  const subLabel = (id: number | null) => {
    if (id === null) return "一次性链接";
    const s = subs.find((x) => x.id === id);
    return s ? s.remark || s.url : `订阅 #${id}`;
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
      const results = await api.knifeParseLinks(settings, selected);
      for (const r of results) {
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
            <Button size="small" type="text" icon={<AppstoreOutlined />} onClick={openAllConfigs}>
              全部节点
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
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={fetchingId === s.id}
                        onClick={() => handleFetch(s.id)}
                      >
                        更新
                      </Button>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setEditTarget(s);
                          setEditOpen(true);
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
      ) : view === "all" ? (
        <Spin spinning={allLoading}>
          <Space style={{ marginBottom: 8 }} wrap>
            <Button
              size="small"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setView("list")}
            >
              返回订阅列表
            </Button>
            <Typography.Text strong>全部订阅</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {allResults === null
                ? `共 ${allConfigs.length} 个节点（跨订阅去重）`
                : `测试通过 ${passedCount} / ${allConfigs.length} 个节点`}
            </Typography.Text>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={testingAll}
              onClick={handleTestAll}
            >
              全量测速
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
          <Table<KnifeConfig>
            virtual
            rowKey={(c) => c.link}
            dataSource={sortedConfigs}
            pagination={false}
            size="small"
            scroll={{ y: Math.round(window.innerHeight * 0.5), x: 940 }}
            style={{ width: "100%" }}
            locale={{ emptyText: "库中暂无节点，请先对各订阅点击更新" }}
            rowSelection={{
              selectedRowKeys: checked,
              onChange: (keys) => setChecked(keys.map(String)),
            }}
            onChange={(_p, _f, sorter) => {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              setDelaySort(s.order ?? null);
            }}
            columns={[
              {
                title: "协议",
                width: 80,
                render: (_: unknown, c) => <Tag>{c.protocol || "?"}</Tag>,
              },
              {
                title: "延迟",
                width: 110,
                sorter: true,
                sortOrder: allResults ? delaySort : undefined,
                render: (_: unknown, c) => {
                  const r = resultMap.get(c.link);
                  if (!r) return allResults ? <Typography.Text type="danger">失败</Typography.Text> : "-";
                  return r.status === "passed" ? (
                    <Typography.Text style={{ fontSize: 12 }}>{r.delay} ms</Typography.Text>
                  ) : (
                    <Typography.Text type="danger">失败</Typography.Text>
                  );
                },
              },
              {
                title: "备注",
                width: 160,
                render: (_: unknown, c) => (
                  <Typography.Text ellipsis style={{ fontSize: 12 }}>
                    {c.remark || "-"}
                  </Typography.Text>
                ),
              },
              {
                title: "来源订阅",
                width: 140,
                render: (_: unknown, c) => (
                  <Typography.Text ellipsis type="secondary" style={{ fontSize: 12 }}>
                    {subLabel(c.subscriptionId)}
                  </Typography.Text>
                ),
              },
              {
                title: "节点链接",
                width: 300,
                render: (_: unknown, c) => (
                  <Typography.Text ellipsis style={{ fontSize: 12, fontFamily: "monospace" }}>
                    {c.link}
                  </Typography.Text>
                ),
              },
              {
                title: "操作",
                width: 88,
                fixed: "right",
                render: (_: unknown, _c: KnifeConfig, index: number) => (
                  <Button size="small" type="link" onClick={() => selectUpTo(index)}>
                    选至此
                  </Button>
                ),
              },
            ]}
          />
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
