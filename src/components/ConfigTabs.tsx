import { useState } from "react";
import { Space, Tabs, Tag } from "antd";
import { layouts } from "../layout";
import type { LayoutTab } from "../layout";
import { sectionUri } from "../schema";
import { useAppStore } from "../store";
import BalancerForm from "./BalancerForm";
import InboundForm from "./InboundForm";
import LogForm from "./LogForm";
import RoutingForm from "./RoutingForm";
import RoutingRulesForm from "./RoutingRulesForm";
import ScrollArea from "./ScrollArea";
import SectionCard from "./SectionCard";
import SectionEditor from "./SectionEditor";
import { useMarkers } from "./useMarkers";

function PathErrorTag({ path }: { path: string }) {
  const markers = useMarkers(sectionUri(path));
  const count = markers.filter((m) => m.severity === 8).length;
  if (count === 0) return null;
  return <Tag color="error">{count}</Tag>;
}

function TabLabel({ tab, dirty }: { tab: LayoutTab; dirty: boolean }) {
  return (
    <Space size={6}>
      {dirty && <span className="dot" />}
      {tab.label}
      {tab.children.map((c) => (
        <PathErrorTag key={c.key} path={c.key} />
      ))}
    </Space>
  );
}

export default function ConfigTabs() {
  const store = useAppStore();
  const [activeKey, setActiveKey] = useState(layouts[0].key);

  const items = layouts.map((tab) => {
    const paths = tab.children.map((c) => c.key);
    const dirty = paths.some((p) => store.dirtySections.includes(p));
    const single = tab.children.length === 1 && !tab.children[0].label;
    const children = single ? (
      tab.children[0].key === "inbounds" ? (
        <InboundForm />
      ) : tab.children[0].key === "routing.rules" ? (
        <RoutingRulesForm />
      ) : tab.children[0].key === "routing.balancers" ? (
        <BalancerForm />
      ) : (
        <SectionEditor
          path={tab.children[0].key}
          value={store.sections[tab.children[0].key]}
          onChange={(v) => store.setSection(tab.children[0].key, v)}
        />
      )
    ) : (
      <ScrollArea className="tab-scroll-area" style={{ flex: 1, minHeight: 0 }}>
        <Space direction="vertical" size={10} style={{ width: "100%", paddingBottom: 8 }}>
          {tab.children.map((c) =>
            c.key === "log" ? (
              <LogForm key={c.key} label={c.label} />
            ) : c.key === "routing" ? (
              <RoutingForm key={c.key} label={c.label} />
            ) : (
              <SectionCard
                key={c.key}
                path={c.key}
                label={c.label}
                value={store.sections[c.key]}
                onChange={(v) => store.setSection(c.key, v)}
              />
            ),
          )}
        </Space>
      </ScrollArea>
    );
    return { key: tab.key, label: <TabLabel tab={tab} dirty={dirty} />, children };
  });

  return <Tabs className="config-tabs" activeKey={activeKey} onChange={setActiveKey} items={items} />;
}
