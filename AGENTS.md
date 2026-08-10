# AGENTS.md

## 项目概览

Tauri v2 桌面应用：通过「配置文件 (profiles)」编辑 Xray 配置。每个 profile 指向一个 Xray 配置文件或目录（单文件/多文件两种模式），支持 Monaco JSON 编辑、schema 提示、测试/应用（API 热更新）/刷新。

## 技术栈

- 前端：React 19 + TypeScript + Vite（dev 端口 1420，strictPort），UI 为 **antd v6**，状态用 zustand，编辑器用 **monaco-editor 0.56**
- 后端：Rust + Tauri v2（`src-tauri/`），`tauri-plugin-opener`、`tauri-plugin-dialog`
- 包管理：pnpm（前端）/ cargo（后端）
- 语言：代码注释、UI 文案一律使用**中文**

## 常用命令

```bash
pnpm install            # 安装前端依赖
pnpm tauri dev          # 开发运行（Tauri 窗口，HMR）
pnpm exec tsc --noEmit  # 前端类型检查
pnpm build              # 前端构建（含 tsc）
cargo check             # 后端检查（在 src-tauri/ 下执行）
cargo test              # 后端测试（在 src-tauri/ 下执行）
```

注意：

- 没有配置 linter；前端验证 = `tsc --noEmit` + `pnpm build`，后端验证 = `cargo check` + `cargo test`。
- 集成测试（`src-tauri/tests/pipeline_test.rs`）需要**真实的 `xray` 可执行文件在 PATH 上**，否则 `find_xray(None, None)` 失败。开发机位于 `D:\Scoop\shims\xray.exe`。
- Vite 忽略 `**/src-tauri/**` 的 watch；改动 Rust 代码后需重启 `tauri dev`（Rust 改动不会热更新）。
- Monaco 主 chunk ~4.93MB（gzip 1.33MB），build 时 >500KB 的 chunk 大小警告为预期，忽略。

## 架构与数据流

### 后端（`src-tauri/src/`）

- `lib.rs`：注册 8 个命令（全部经 `#[tauri::command]`）：
  `list_profiles`、`save_profiles`、`load_settings`、`save_settings`、`resolve_xray`、`read_config`、`test_config`、`apply_config`
- `models.rs`：`Profile{id,name,path,api_address?,xray_path?}`、`Settings{default_xray_path?,default_multi_file_template,theme?}`、`TemplateEntry{file,keys}`、`TabContents{inbounds,outbounds,rules,balancers,other}`、`ReadConfigResult{mode,content,files,warning?}`、`TestResult{ok,code,message,stdout,stderr}`、`ApplyResult{ok,message,test?,written_files,api_update?}`、`ApiUpdateResult{ok,message,steps}`、`ApiStep{command,ok,message}`。
  - `default_template()`：15 条硬编码多文件模板（`00_log`…`99_version` + `98_other` 兜底 `*`）。**前端 `src/types.ts` 的 `DEFAULT_TEMPLATE` 必须与之保持同步**。
  - `settings.json` 中模板为空时 `effective_template()` 回退到 `default_template()`。
- `storage.rs`：`profiles.json` / `settings.json` 持久化到 app_config_dir。
- `xray.rs`：`find_xray`（优先级：profile.xray_path → settings.default_xray_path → 应用启动目录 → PATH）、`run_with_timeout`、`run_test`、`dump_folder`、`api_list`、`api_add`、`api_remove`、`api_adrules`。
- `pipeline.rs`：`read_config` / `test_config` / `apply_config` / `run_api_update`。
  - `serialize_section` 写 .jsonc 文件时带 `// 拆分文件：<name>` 头注释。

### 前端（`src/`）

- `layout.ts`：**页签/子 section 结构的唯一定义点**（单点修改）。`layouts` 数组硬编码：inbounds/outbounds/rules→routing.rules/balancers→routing.balancers/other；other 的 children 顺序 = log/routing/api/dns/fakedns/policy/stats/metrics/observatory/burstObservatory/geodata/env/version/reverse/transport。child.key 即 xray 配置点号路径；`descendantSections(path)` 供 `json.ts` 把已独立拆出的子 section 从父级剥离（routing → routing.rules/routing.balancers）。
  - **新增/调整页签只需改 `layout.ts`（+`schema.ts` 注册 schema），后端零改动**（`json.ts` 按 `allChildPaths` 自动遍历）。已有表单 UI 的 section：`routing.rules`/`routing.balancers`（SectionListForm）、`log`/`routing`（LogForm/RoutingForm）；其余走 SectionCard/SectionEditor。
- `json.ts`：`parseJsonc` / `splitSections` / `buildFull` / `sectionsToTabs`（前后端边界适配层）。`stripDescendants` 将已独立拆出的子 section 从父级剔除（routing 只留 domainStrategy/domainMatcher 等，rules/balancers 归独立 section）；空数组/空对象→空串→从配置省略。
- `rules.ts` / `balancers.ts`：数组类 section 的域类型与工具。`parseList<T>`/`formatList`（rules.ts 导出泛型，空数组→空串）、`extractTags(text)`（解析数组 section 收集对象元素的 tag，做下拉建议）、`ruleSummary`/`balancerSummary`（卡片摘要）。
- `schema.ts`：`sectionUri(path)=file:///xray/<path>.json`；`ARRAY_DEFS`（inbounds/outbounds/`routing.rules`→RuleObject/`routing.balancers`→BalancerObject）+ `SINGLE_DEFS`（含 `routing`→RoutingObject）映射 xray-schema.json definitions；transport 不注册 schema。**捆绑 schema 的 RoutingObject 缺 `domainMatcher`**，但真实 xray 支持（additionalProperties 默认 true，Monaco 与 `-test` 均接受）。
- `store.ts`：zustand 全局状态：`profiles`/`currentProfileId`/`settings`/`mode`/`files`/`sections`/`savedSections`/`dirtySections`/`loading`/`error`/`warning`/`result`/`resultKind` 等；`setSection`、`refresh`、`selectProfile`、`markClean`、`saveProfiles`、`saveSettings`、`setTheme`、`setResult`、`clearResult`。
- `api.ts`：`invoke` 封装，camelCase 字段 → Rust snake_case。
- `monaco.ts`：Monaco 初始化（`MonacoEnvironment.getWorker` + `loader.config({ monaco })`）。
- `components/`：
  - `ConfigTabs.tsx`：配置编辑区分派。单 child：`routing.rules`→`RoutingRulesForm`、`routing.balancers`→`BalancerForm`、其余→`SectionEditor`；多 child：`log`→`LogForm`、`routing`→`RoutingForm`、其余→`SectionCard`（ScrollArea 垂直卡片）。
  - `SectionListForm.tsx`：**对象数组类 section 的通用列表容器**（`routing.rules`/`routing.balancers` 共用）。props：`{path,title,parse,format,renderItem,EditModal,emptyText?,deleteConfirmTitle?}`；内置 form/json 双模式、invalid 强制 JSON + Alert、上移/下移/编辑/删除（新增按钮在切换按钮左侧）。新增数组类表单 = 写 parse/format（`parseList<T>`/`formatList`）+ renderItem + 编辑弹窗 + ConfigTabs 分支。
  - `RuleEditModal.tsx` / `BalancerEditModal.tsx`：数组元素编辑弹窗范式——Form + `Form.useWatch`；tag 建议用 `extractTags(sections.outbounds/…)`（AutoComplete / Select mode="tags"）；保存时 clone initial **保留未知顶层字段**、已知字段重建、空值 delete；attrs/webhook/costs 等 JSON 片段字段用 `JsonEditor` + JSON validator；Modal 内 `ScrollArea maxHeight="50vh"` + `destroyOnHidden`。
  - `LogForm.tsx` / `RoutingForm.tsx`：对象类 section 表单（**单 section 表单 UI 范式**）。头部图标按钮（`CodeOutlined`/`FormOutlined`）切换「表单/JSON」，本地 `useState`，共用 `store.sections.<path>`，切换不丢数据；写回经 `setSection`：合并已解析对象**保留未知字段**、空值剔除、空对象写空串（LogForm 另有 `dnsLog:false` 剔除）。RoutingForm 仅 domainStrategy/domainMatcher（rules/balancers 在独立页签编辑）。JSON 模式复用 `SectionEditor`。
  - `JsonEditor.tsx`：嵌入表单的 JSON 片段 Monaco 编辑器（无 schema、数值高度、空值占位提示），`value`/`onChange` 由 antd `Form.Item` 注入（直接子元素）。
  - `SectionCard.tsx` / `SectionEditor.tsx`：JSON 编辑卡片。`SectionEditor` 高度必须传数值（ResizeObserver 测外层容器）。
  - `ProfileBar.tsx`：工具栏（测试/应用/刷新 + 配置文件选择 + 管理配置文件）。**刷新会清空测试结果**；切换 profile 或刷新时存在脏数据需 confirm。
  - `ProfileManagerModal.tsx` / `ProfileModal.tsx` / `SettingsModal.tsx`：配置文件管理/编辑/设置弹窗。
  - `ResultChip.tsx` / `ResultModal.tsx` / `ResultPanel.tsx`：测试/应用结果展示（弹窗只展示 stdout/stderr）。
  - `ScrollArea.tsx`：自定义滚动条组件（所有弹窗内部滚动共用）。
  - `useMarkers.ts`：Monaco marker 相关 hook。
- `theme.tsx`：`ThemePref`（system/light/dark）/`useResolvedTheme(pref)`/`ThemeProvider`/`useApplyDocumentTheme`/`useTheme`。

### 关键交互流程

- 读取：`read_config` 返回 `ReadConfigResult{mode,content,files,warning?}`，mode 为 `"folder"`/`"file"`（**不是** single/multi），前端映射 folder→多文件、file→单文件。
- 测试：`test_config(profile, settings, tabs)` + `effective_template` → 后端写临时 confdir（files 为空时兜底写 `00-config.json` 的 `{}`，保证至少 1 个文件）→ `xray run -confdir=<dir> -test`。
- 应用：`apply_config` 先临时目录 `-test`（失败即中止）→ 目录模式清空 `*.json|*.jsonc` 后按模板写文件 / 文件模式覆盖写 `{}` 格式化 JSON → 差量 API 热更新（`rmo`→`rmi`→`ado`→`adi`→`adrules`）；balancers 变化仅推入一步 `ApiStep{ok:true,command:"balancers"}` 提示「需重启生效」。
- 读取/测试/应用前若 profile 配置了 `apiAddress`，会经 `lsi`/`lso` 校验运行实例的入站/出站 tag 差异，差异写入 `warning`。
- 测试结果弹窗只展示 stdout/stderr。

## 环境与平台注意

- Windows (win32)；Tauri 窗口默认 900×600（=minWidth/minHeight），之前曾 1120×780。
- `csp: null`。
- 弹窗内部滚动用 `ScrollArea`，maxHeight **50vh**；应用外层（html/body/#root）不滚动。
- Vite dev server 端口 1420 固定；HMR 走 ws 1421。

## antd v6 关键坑（重要，均为踩坑经验）

- **Tabs DOM 类名已变**：v6 为 `.ant-tabs` → `.ant-tabs-nav` → `.ant-tabs-body-holder` → `.ant-tabs-body` → 各面板 `.ant-tabs-content`（激活面板 `-active`，非激活 `-hidden{display:none}`）。**已不存在** `.ant-tabs-content-holder` 和 `.ant-tabs-tabpane`。编辑区高度自适应依赖这组类名做 flex 链。
- **Spin 结构**：`.ant-spin > .ant-spin-container`（无 `.ant-spin-nested-loading`）。编辑器加载时高度链依赖此结构。
- **Form.Item 只向直接子元素注入 value/onChange**：`<Form.Item><Space.Compact>…</Space.Compact></Form.Item>` 会静默丢失回写。正确写法：外层 `Form.Item`（仅 label，无 name）+ 内层 `<Form.Item name="…" noStyle>` 包裹 Input，加号/减号按钮作为兄弟元素放 Compact 内。ProfileModal 与 SettingsModal 均需此模式。
- antd v6：`destroyOnHidden`（不是 `destroyOnClose`）；`message`/`modal` 必须经 `App.useApp()` 获取（AppProvider 已包裹）。
- **Divider 分组标题用 `titlePlacement="start"`**：antd v6.5.4 的 `orientation` prop 类型被误声明为 `Orientation='horizontal'|'vertical'`（与 deprecated `type` prop 同类型），运行时却按 `titlePlacement` 校验生效；`orientation="left"` 会类型报错且不生效。
- Modal 内容超高时用 ScrollArea + maxHeight 50vh 内部滚动，Modal 本身不滚。

## Monaco 0.56 关键坑

- **子路径导入需去掉 `esm/vs/` 前缀**，例如：
  - `monaco-editor/language/json/json.worker?worker`、`monaco-editor/editor/editor.worker?worker`
  - `monaco-editor/language/json/monaco.contribution`（导出的 `jsonDefaults` 用于配 schema/markers）
- `monaco.languages.json`（旧 API）在 0.56 **已弃用**，必须用上面 contribution 的 `jsonDefaults`。`vite-env.d.ts` 里有对应的 `declare module` 声明。
- Monaco 高度必须传数值（配合 ResizeObserver 测外层容器），不能用 `height:"100%"`。
- `alwaysConsumeMouseWheel: false`，否则滚轮事件不冒泡到外层 ScrollArea。
- 主题切换：根据 `useResolvedTheme()` 在 `vs-dark`/`vs` 间切，由 `ThemeProvider`/`useApplyDocumentTheme` 统一驱动。
- Monaco 滚动条固定 6px。

## 主题系统

- `SettingsModal` 顶部 Segmented：跟随系统/亮色/暗色，**默认跟随系统**，实时应用到 antd `algorithm` + Monaco theme + CSS 变量，不落盘（保存设置时才持久化 `settings.theme`）。
- CSS 变量：`:root`（暗色默认，如 `--app-bg:#141414`、`--border-color:#303030`、`--section-head-bg:#1d1d1d`、`--header-bg:#001529`）+ `html[data-theme="light"]` 覆盖；body 用 `background:var(--app-bg)`。`data-theme` 由 `useApplyDocumentTheme` 设置。

## Xray 后端事实（实测于 26.3.27）

- `xray run -confdir=<dir> -dump`：输出**配置文件形式** JSON（4 空格缩进，**无 `_TypedMessage_`**），可用于读取/重建配置。
- `xray run -confdir=<dir> -test`：exit 0 = 配置合法；**exit 23 = 配置错误**。stdout/stderr 必须分开捕获（`run_with_timeout` 防死锁）。
- confdir 会加载 `*.json|*.jsonc|*.toml|*.yaml|*.yml`，按文件名排序（数字前缀决定加载顺序）。**必须保证临时 confdir 至少有 1 个文件**，否则 xray 会回退到 cwd 的 config.json。
- API 热更新：`xray api lsi/lso/adi/ado/rmi/rmo/adrules --server=<addr>`；`lsi/lso` 默认 server 为 `127.0.0.1:8080`；失败时 exit 1（`base.Fatalf`）。

## 测试

- 后端集成测试：`src-tauri/tests/pipeline_test.rs`（3 项），真实调用 xray，需 PATH 上有 xray。
- 前端无测试框架。

## 仓库状态

- 无 linter/CI 配置。git 工作树应保持干净（改动后未要求提交则不提交）。
