import { useEffect, useMemo } from "react";
import {
  AutoComplete,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
} from "antd";
import { useAppStore } from "../store";
import { extractTags } from "../rules";
import type { BalancerObject, BalancerStrategy, BalancerStrategySettings } from "../balancers";
import JsonEditor from "./JsonEditor";
import ScrollArea from "./ScrollArea";

const STRATEGY_OPTIONS = [
  { value: "random", label: "random（默认，随机选择）" },
  { value: "roundRobin", label: "roundRobin（按固定顺序选择）" },
  { value: "leastPing", label: "leastPing（延迟最低，需配置观测站）" },
  { value: "leastLoad", label: "leastLoad（最稳定，需配置观测站）" },
];

const COSTS_PLACEHOLDER = '[{"regexp": true, "match": "^香港", "value": 0.05}]';

interface BalancerEditModalProps {
  open: boolean;
  initial?: BalancerObject | null;
  onClose: () => void;
  onSave: (balancer: BalancerObject) => void;
}

interface BalancerFormValues {
  tag?: string;
  selector?: string[];
  fallbackTag?: string;
  strategyType?: string;
  expected?: number | null;
  maxRTT?: string;
  tolerance?: number | null;
  baselines?: string[];
  costsJson?: string;
}

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s !== "") : [];
}

function jsonValidator(_: unknown, v: string) {
  const s = (v ?? "").trim();
  if (!s) return Promise.resolve();
  try {
    JSON.parse(s);
    return Promise.resolve();
  } catch {
    return Promise.reject(new Error("JSON 格式错误"));
  }
}

function selectorValidator(_: unknown, v?: string[]) {
  if (Array.isArray(v) && v.length > 0) return Promise.resolve();
  return Promise.reject(new Error("至少选择一个出站（支持前缀匹配）"));
}

export default function BalancerEditModal({ open, initial, onClose, onSave }: BalancerEditModalProps) {
  const [form] = Form.useForm<BalancerFormValues>();
  const sections = useAppStore((s) => s.sections);

  const outboundOptions = useMemo(
    () => extractTags(sections.outbounds).map((v) => ({ value: v })),
    [sections.outbounds],
  );

  useEffect(() => {
    if (!open) return;
    const b = initial;
    const settings = isPlainObj(b?.strategy?.settings) ? b.strategy?.settings : undefined;
    form.setFieldsValue({
      tag: typeof b?.tag === "string" ? b.tag : "",
      selector: strArr(b?.selector),
      fallbackTag: typeof b?.fallbackTag === "string" ? b.fallbackTag : "",
      strategyType: typeof b?.strategy?.type === "string" ? b.strategy.type : undefined,
      expected: typeof settings?.expected === "number" ? settings.expected : undefined,
      maxRTT: typeof settings?.maxRTT === "string" ? settings.maxRTT : "",
      tolerance: typeof settings?.tolerance === "number" ? settings.tolerance : undefined,
      baselines: strArr(settings?.baselines),
      costsJson:
        Array.isArray(settings?.costs) && settings.costs.length > 0
          ? JSON.stringify(settings.costs, null, 2)
          : "",
    });
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const base: BalancerObject = initial ? JSON.parse(JSON.stringify(initial)) : {};

    const tag = String(values.tag ?? "").trim();
    if (tag) {
      base.tag = tag;
    } else {
      delete base.tag;
    }

    const selector = (values.selector ?? [])
      .map((s) => String(s).trim())
      .filter((s) => s !== "");
    if (selector.length > 0) {
      base.selector = selector;
    } else {
      delete base.selector;
    }

    const fallback = String(values.fallbackTag ?? "").trim();
    if (fallback) {
      base.fallbackTag = fallback;
    } else {
      delete base.fallbackTag;
    }

    const strategy: BalancerStrategy = {};
    const type = String(values.strategyType ?? "").trim();
    if (type) strategy.type = type;

    const settings: BalancerStrategySettings = {};
    if (values.expected !== undefined && values.expected !== null) {
      settings.expected = values.expected;
    }
    const maxRTT = String(values.maxRTT ?? "").trim();
    if (maxRTT) settings.maxRTT = maxRTT;
    if (values.tolerance !== undefined && values.tolerance !== null) {
      settings.tolerance = values.tolerance;
    }
    const baselines = (values.baselines ?? []).map((s) => String(s).trim()).filter((s) => s !== "");
    if (baselines.length > 0) settings.baselines = baselines;
    const costs = String(values.costsJson ?? "").trim();
    if (costs) settings.costs = JSON.parse(costs);

    if (Object.keys(settings).length > 0) strategy.settings = settings;
    if (Object.keys(strategy).length > 0) {
      base.strategy = strategy;
    } else {
      delete base.strategy;
    }

    onSave(base);
  };

  return (
    <Modal
      open={open}
      title={initial ? "编辑负载均衡" : "新增负载均衡"}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={620}
    >
      <ScrollArea maxHeight="50vh">
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="tag"
            label="标识 (tag)"
            tooltip="负载均衡的唯一标识，路由规则的 balancerTag 据此引用"
            rules={[{ required: true, message: "请输入标识 tag" }]}
          >
            <Input placeholder="例如：负载均衡 1" />
          </Form.Item>

          <Form.Item
            name="selector"
            label="出站选择器 (selector)"
            tooltip="与出站标识前缀匹配的字符串数组，任意一项命中即纳入负载均衡"
            rules={[{ validator: selectorValidator }]}
          >
            <Select
              mode="tags"
              options={outboundOptions}
              placeholder="选择或输入出站前缀，如 节点 或 HK-"
            />
          </Form.Item>

          <Form.Item
            name="fallbackTag"
            label="备用出站 (fallbackTag)"
            tooltip="所有候选出站均不可用时使用的出站标识（可选）"
          >
            <AutoComplete options={outboundOptions} placeholder="选择或输入出站 tag" />
          </Form.Item>

          <Form.Item
            name="strategyType"
            label="策略类型 (strategy.type)"
            tooltip="leastPing / leastLoad 需要配置观测站（observatory）才能生效"
          >
            <Select
              options={STRATEGY_OPTIONS}
              allowClear
              placeholder="random（默认）/ roundRobin / leastPing / leastLoad"
            />
          </Form.Item>

          <Collapse
            size="small"
            items={[
              {
                key: "settings",
                label: "策略设置（全部可选）",
                children: (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Form.Item
                      name="expected"
                      label="期望节点数 (expected)"
                      tooltip="优先在延迟最优的前 N 个节点中挑选（仅 leastPing / leastLoad）"
                    >
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="例如 2" />
                    </Form.Item>
                    <Form.Item
                      name="maxRTT"
                      label="最大 RTT (maxRTT)"
                      tooltip="节点延迟超过该值的将被剔除，形式为时长字符串，如 2000ms、2s"
                    >
                      <Input placeholder="例如 2000ms、2s" />
                    </Form.Item>
                    <Form.Item
                      name="tolerance"
                      label="容忍度 (tolerance)"
                      tooltip="节点之间延迟允许的最大差异比例，float，如 0.01 表示 1%"
                    >
                      <InputNumber min={0} step={0.01} style={{ width: "100%" }} placeholder="例如 0.01" />
                    </Form.Item>
                    <Form.Item
                      name="baselines"
                      label="基准 RTT (baselines)"
                      tooltip="以 RTT 从低到高的标准差数组划分分组，各组间用逗号分隔（仅 leastPing）"
                    >
                      <Select
                        mode="tags"
                        open={false}
                        suffixIcon={null}
                        placeholder="例如 100ms、200ms、400ms"
                      />
                    </Form.Item>
                    <Form.Item
                      name="costsJson"
                      label="成本 (costs)"
                      tooltip="JSON 数组，按正则匹配出站并附加成本，值越大优先级越低"
                      rules={[{ validator: jsonValidator }]}
                    >
                      <JsonEditor placeholder={COSTS_PLACEHOLDER} />
                    </Form.Item>
                  </Space>
                ),
              },
            ]}
          />
        </Form>
      </ScrollArea>
    </Modal>
  );
}
