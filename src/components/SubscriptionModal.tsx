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
import type { ColumnsType } from "antd/es/table";
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

type SubView = "list" | "nodes";

// 节点视图数据范围：{ sub } = 单订阅节点，null = 全部订阅（跨订阅去重）
type NodeScope = { sub: KnifeSubscription } | null;

export default function SubscriptionModal({ open, onClose }: SubscriptionModalProps) {
  const { message } = App.useApp();
  const settings = useAppStore((s) => s.settings);

  const [view, setView] = useState<SubView>("list");
  const [knifePath, setKnifePath] = useState<string | null>(null);
  const [subs, setSubs] = useState<KnifeSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingId, setFetchingId] = useState<number | null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [importing, setImporting] = useState(false);

  // 节点视图状态（单订阅与全部订阅共用同一套表格/测速/导入逻辑）
  const [nodeScope, setNodeScope] = useState<NodeScope>(null);
  const [configs, setConfigs] = useState<KnifeConfig[]>([]);
  const [results, setResults] = useState<KnifeHttpResult[] | null>(null);
  const [delaySort, setDelaySort] = useState<"ascend" | "descend" | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [testing, setTesting] = useState(false);
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
    setChecked([]);
    setReplaceProxy(true);
    setNodeScope(null);
    setConfigs([]);
    setResults(null);
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
      await loadSubs();
    } catch (e) {
      message.error(String(e));
    } finally {
      setFetchingId(null);
    }
  };

  // 全部更新：subs fetch --all（knife 内部并发，仅启用订阅）
  const handleFetchAll = async () => {
    if (fetchingId !== null || fetchingAll) return;
    setFetchingAll(true);
    try {
      await api.knifeFetchAllSubscriptions(settings);
      message.success("已更新全部订阅");
      await loadSubs();
    } catch (e) {
      message.error(String(e));
    } finally {
      setFetchingAll(false);
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

  // 进入节点视图：即时列出库内节点（不测速），测速在视图内进行
  const openNodes = async (scope: NodeScope) => {
    setNodeScope(scope);
    setChecked([]);
    setResults(null);
    setDelaySort(null);
    setConfigs([]);
    setView("nodes");
    setListLoading(true);
    try {
      setConfigs(await api.knifeListConfigs(settings, scope ? scope.sub.id : null));
    } catch (e) {
      message.error(String(e));
      setView("list");
    } finally {
      setListLoading(false);
    }
  };

  // 测速：单订阅用 --sub-id，全库不带；完成后显示状态/延迟并默认按延迟升序
  const handleTestSpeed = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const rs = nodeScope
        ? await api.knifeTestSubscription(settings, nodeScope.sub.id)
        : await api.knifeTestAll(settings);
      setResults(rs);
      setDelaySort("ascend");
      const passed = new Set(rs.filter((r) => r.status === "passed").map((r) => r.link));
      setChecked((prev) => prev.filter((l) => passed.has(l)));
      message.success(`测试通过 ${passed.size} / ${rs.length} 个节点`);
    } catch (e) {
      message.error(String(e));
    } finally {
      setTesting(false);
    }
  };

  const resultMap = useMemo(() => {
    const m = new Map<string, KnifeHttpResult>();
    for (const r of results ?? []) m.set(r.link, r);
    return m;
  }, [results]);

  // 排序时失败节点恒排最后；未测速保持库内顺序
  const sortedConfigs = useMemo(() => {
    if (!results || delaySort === null) return configs;
    const rank = (c: KnifeConfig) => {
      const r = resultMap.get(c.link);
      return r && r.status === "passed" ? r.delay : Number.POSITIVE_INFINITY;
    };
    return [...configs].sort((a, b) => {
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
  }, [configs, results, delaySort, resultMap]);

  const passedCount = useMemo(
    () => (results ? results.filter((r) => r.status === "passed").length : 0),
    [results],
  );

  // 选至此：替换为第 1 行到当前行范围内所有通过节点（未测速则范围内全选）
  const selectUpTo = (index: number) => {
    const range = sortedConfigs.slice(0, index + 1);
    const links = range
      .filter((c) => !results || resultMap.get(c.link)?.status === "passed")
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
      const parseResults = await api.knifeParseLinks(settings, selected);
      for (const r of parseResults) {
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

  const nodeColumns: ColumnsType<KnifeConfig> = [
    {
      title: "协议",
      width: 80,
      render: (_, c) => <Tag>{c.protocol || "?"}</Tag>,
    },
    {
      title: "延迟",
      width: 110,
      sorter: true,
      sortOrder: results ? delaySort : undefined,
      render: (_, c) => {
        const r = resultMap.get(c.link);
        if (!r) return results ? <Typography.Text type="danger">失败</Typography.Text> : "-";
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
      render: (_, c) => (
        <Typography.Text ellipsis style={{ fontSize: 12 }}>
          {c.remark || "-"}
        </Typography.Text>
      ),
    },
    // 单订阅视图隐藏「来源订阅」列
    ...(nodeScope
      ? []
      : [
          {
            title: "来源订阅",
            width: 140,
            render: (_: unknown, c: KnifeConfig) => (
              <Typography.Text ellipsis type="secondary" style={{ fontSize: 12 }}>
                {subLabel(c.subscriptionId)}
              </Typography.Text>
            ),
          },
        ]),
    {
      title: "节点链接",
      width: 300,
      render: (_, c) => (
        <Typography.Text ellipsis style={{ fontSize: 12, fontFamily: "monospace" }}>
          {c.link}
        </Typography.Text>
      ),
    },
    {
      title: "操作",
      width: 88,
      fixed: "right",
      render: (_, _c: KnifeConfig, index: number) => (
        <Button size="small" type="link" onClick={() => selectUpTo(index)}>
          选至此
        </Button>
      ),
    },
  ];

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
            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined />}
              loading={fetchingAll}
              disabled={fetchingId !== null}
              onClick={handleFetchAll}
            >
              全部更新
            </Button>
            <Button size="small" type="text" icon={<AppstoreOutlined />} onClick={() => openNodes(null)}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Typography.Text
                        strong
                        style={{
                          fontSize: 13,
                          flex: "0 1 auto",
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.remark || "(无备注)"}
                      </Typography.Text>
                      <Tag color={s.enabled ? "green" : "default"} style={{ flexShrink: 0, marginInlineEnd: 0 }}>
                        {s.enabled ? "启用" : "停用"}
                      </Tag>
                      <Tag style={{ flexShrink: 0, marginInlineEnd: 0 }}>{s.configs} 节点</Tag>
                    </div>
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
                        onClick={() => openNodes({ sub: s })}
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
      ) : (
        <Spin spinning={listLoading}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                size="small"
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => setView("list")}
                style={{ flexShrink: 0 }}
              >
                返回订阅列表
              </Button>
              <Typography.Text
                strong
                style={{
                  flex: "0 1 auto",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {nodeScope ? nodeScope.sub.remark || nodeScope.sub.url : "全部订阅"}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0, whiteSpace: "nowrap" }}>
                {results === null
                  ? nodeScope
                    ? `共 ${configs.length} 个节点`
                    : `共 ${configs.length} 个节点（跨订阅去重）`
                  : `测试通过 ${passedCount} / ${configs.length} 个节点`}
              </Typography.Text>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <Space size={8} wrap>
                <Button
                  size="small"
                  icon={<ThunderboltOutlined />}
                  loading={testing}
                  onClick={handleTestSpeed}
                >
                  测速
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
            </div>
          </div>
          <Table<KnifeConfig>
            virtual
            rowKey={(c) => c.link}
            dataSource={sortedConfigs}
            pagination={false}
            size="small"
            scroll={{ y: Math.round(window.innerHeight * 0.5), x: nodeScope ? 800 : 940 }}
            style={{ width: "100%" }}
            locale={{
              emptyText: nodeScope
                ? "该订阅暂无节点，请先在订阅列表点击「更新」"
                : "库中暂无节点，请先对各订阅点击更新",
            }}
            rowSelection={{
              selectedRowKeys: checked,
              onChange: (keys) => setChecked(keys.map(String)),
            }}
            onChange={(_p, _f, sorter) => {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              setDelaySort(s.order ?? null);
            }}
            columns={nodeColumns}
          />
        </Spin>
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
