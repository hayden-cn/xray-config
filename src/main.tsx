import React from "react";
import ReactDOM from "react-dom/client";
import { App as AntdApp, ConfigProvider, theme as antdTheme } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import App from "./App";
import "./App.css";
import { useAppStore } from "./store";
import { ThemeProvider, useApplyDocumentTheme, useResolvedTheme } from "./theme";
import type { ThemePref } from "./theme";

dayjs.locale("zh-cn");

function Root() {
  const theme = useAppStore((s) => (s.settings.theme ?? "system") as ThemePref);
  const resolved = useResolvedTheme(theme);
  useApplyDocumentTheme(resolved);
  return (
    <ThemeProvider value={resolved}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: resolved === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        <AntdApp style={{ height: "100%" }}>
          <App />
        </AntdApp>
      </ConfigProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
