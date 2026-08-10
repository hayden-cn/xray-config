import { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Alert, Button, Layout, Space, Spin, Tag, Tooltip, Typography } from "antd";
import {
  CheckCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useAppStore } from "./store";
import { api } from "./api";
import { initSchema } from "./schema";
import { sectionsToTabs } from "./json";
import ProfileBar from "./components/ProfileBar";
import ConfigTabs from "./components/ConfigTabs";
import ResultChip from "./components/ResultChip";
import ResultModal from "./components/ResultModal";

initSchema();

export default function App() {
  const { modal, message } = AntdApp.useApp();
  const store = useAppStore();
  const [busy, setBusy] = useState(false);
  const [resolvedXray, setResolvedXray] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  useEffect(() => {
    useAppStore.getState().init().catch((e) => {
      message.error(String(e));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProfile = useMemo(
    () => store.profiles.find((p) => p.id === store.currentProfileId) ?? null,
    [store.profiles, store.currentProfileId],
  );

  useEffect(() => {
    if (!currentProfile || store.dirtySections.length > 0) {
      setResolvedXray(null);
      return;
    }
    api.resolveXray(currentProfile, store.settings).then((p) => setResolvedXray(p));
  }, [currentProfile, store.settings, store.dirtySections.length]);

  const isDirty = store.dirtySections.length > 0;

  const run = async (kind: "test" | "apply") => {
    if (!currentProfile || busy) return;
    setBusy(true);
    try {
      const tabs = sectionsToTabs(store.sections);
      if (kind === "test") {
        const r = await api.testConfig(currentProfile, store.settings, tabs);
        store.setResult("test", r);
        if (r.ok) message.success("配置测试通过");
      } else {
        const r = await api.applyConfig(currentProfile, store.settings, tabs);
        store.setResult("apply", r);
        if (r.ok) {
          store.markClean();
          message.success("配置已应用");
        } else {
          message.error(r.message || "应用失败");
        }
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = () => {
    if (!currentProfile) return;
    if (isDirty) {
      modal.confirm({
        title: "数据已更改，刷新将丢失数据",
        content: "当前编辑未保存，刷新将丢弃这些更改。是否继续？",
        okText: "继续刷新",
        cancelText: "取消",
        onOk: () => store.refresh(),
      });
    } else {
      store.refresh();
    }
  };

  return (
    <Layout style={{ height: "100vh" }}>
      <Layout.Header className="app-header">
        <Typography.Title level={4} style={{ color: "var(--header-text)", margin: 0 }}>
          Xray 配置管理器
        </Typography.Title>
        <ProfileBar />
      </Layout.Header>
      <Layout.Content className="app-content">
        <div className="toolbar">
          <Space size={8}>
            <Tooltip title="将当前配置写入临时目录后用 xray 校验">
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => run("test")}
                loading={busy}
                disabled={!currentProfile}
              >
                测试
              </Button>
            </Tooltip>
            <Tooltip title="先校验，再写入配置文件；配置了 API 时同步热更新">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => run("apply")}
                loading={busy}
                disabled={!currentProfile}
              >
                应用
              </Button>
            </Tooltip>
            <Tooltip title="重新读取磁盘上的配置">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={busy}
                disabled={!currentProfile}
              >
                刷新
              </Button>
            </Tooltip>
            <ResultChip onClick={() => setResultOpen(true)} />
          </Space>
          <Space size={8} wrap>
            {store.mode && (
              <Tag color={store.mode === "folder" ? "purple" : "green"}>
                {store.mode === "folder" ? "多文件" : "单文件"}
              </Tag>
            )}
            {isDirty && (
              <Tag color="orange">
                <CheckCircleOutlined /> 未保存
              </Tag>
            )}
            {resolvedXray && <Tag color="cyan">{resolvedXray}</Tag>}
          </Space>
        </div>

        {store.error && (
          <Alert
            type="error"
            showIcon
            message="读取配置失败"
            description={store.error}
            style={{ marginBottom: 8 }}
            closable
            onClose={() => useAppStore.setState({ error: null })}
          />
        )}

        {store.warning && (
          <Alert
            type="warning"
            showIcon
            message="API 状态提示"
            description={store.warning}
            style={{ marginBottom: 8 }}
            closable
            onClose={() => useAppStore.setState({ warning: null })}
          />
        )}

        <div className="tab-area">
          <Spin spinning={store.loading || busy}>
            {currentProfile ? <ConfigTabs /> : (
              <div className="empty-state">
                <Typography.Text type="secondary">
                  还没有 Profile，点击右上角「管理」创建。
                </Typography.Text>
              </div>
            )}
          </Spin>
        </div>
      </Layout.Content>
      <ResultModal open={resultOpen} onClose={() => setResultOpen(false)} />
    </Layout>
  );
}
