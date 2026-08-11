# Xray Config

Xray 配置管理桌面应用（Tauri v2）。通过「配置文件 (profiles)」编辑 Xray 配置，每个 profile 指向一个 Xray 配置文件或目录（单文件/多文件两种模式），支持 Monaco JSON 编辑、schema 提示、测试 / 应用（API 热更新）/ 刷新。

## 功能特性

- **单文件 / 多文件两种配置模式**：单文件模式直接编辑一个配置文件；多文件模式按模板将配置拆分到多个文件（`00_log`…`99_version`，含 `98_other` 兜底）。
- **分页签编辑**：inbounds / outbounds / routing.rules / routing.balancers / log / routing 等 section 提供表单化编辑，其余 section 走 JSON 编辑器；每个 section 均可切换「表单 / JSON」模式。
- **Monaco JSON 编辑器**：带 xray-schema 校验、marker 提示。
- **测试**：调用真实 `xray run -confdir=<dir> -test` 校验配置合法性。
- **应用**：先测试后写盘，并按差量调用 Xray API 热更新（`rmo`/`rmi`/`ado`/`adi`/`adrules`）。
- **常用工具**：`xray uuid` 生成 UUID、`xray x25519` 生成密钥对（Reality 一键生成并自动填入客户端公钥）。

## 开发环境要求

- Node.js + pnpm
- Rust 工具链（`cargo`）
- Xray 可执行文件在 PATH 上（测试 / 应用 / UUID 生成等依赖真实 xray）

## 使用

```bash
pnpm install        # 安装前端依赖
pnpm tauri dev      # 开发运行（Tauri 窗口，HMR，dev 端口 1420）
```

前端验证：

```bash
pnpm exec tsc --noEmit   # 前端类型检查
pnpm build               # 前端构建（含 tsc）
```

后端验证（在 `src-tauri/` 下执行）：

```bash
cargo check
cargo test
```

> 注意：后端集成测试（`src-tauri/tests/pipeline_test.rs`）需要 PATH 上有真实 `xray` 可执行文件。

## 基本操作流程

1. 新建 / 选择配置文件（profile），指向你的 Xray 配置文件或配置目录。
2. 编辑各 section 配置（表单或 JSON 模式）。
3. 点击「测试」验证配置合法性；通过后再点击「应用」写盘并热更新到运行中的 Xray 实例（需 profile 配置了 API 地址）。
4. 配置变化可通过「刷新」重新从磁盘加载。

## 技术栈

- 前端：React 19 + TypeScript + Vite + antd v6 + zustand + monaco-editor 0.56
- 后端：Rust + Tauri v2（`tauri-plugin-opener`、`tauri-plugin-dialog`）
- 包管理：pnpm（前端）/ cargo（后端）

## 目录结构

- `src/`：前端（React 组件、store、编辑器、schema、表单）。
- `src-tauri/`：后端（Rust 命令、存储、xray 调用、pipeline 处理）。

## 免责声明

> 本项目为**个人项目**，代码由 **AI 生成**，可能存在未发现的缺陷或安全问题，**不建议用于生产环境**。请仅用于学习与研究目的，使用前自行评估风险。

## License

见仓库内配置（本项目为个人项目，未明确 License 前请勿直接分发）。
