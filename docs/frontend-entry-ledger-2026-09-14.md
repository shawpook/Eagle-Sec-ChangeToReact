# Eagle 前端交付入口台账（R0）

台账日期：2026-09-14。工作区：`H:/dev/Eagle-Sec-development - 副本`。分支：`react-in-place`。代码基点：`195dc3ab`（连续列表改造提交）。

本台账是 R0 的交付物，供 R1（正式构建与运行入口）直接取用。来源为静态入口盘点（`frontend/vite.preview.config.mjs`、各 HTML、`electron/main.cjs`）与类型检查基线。**“有 React 入口”不等于“该窗口的状态/交互已收敛”**——本表只登记入口与加载方式，迁移深度见报告 §4 与批次计划 R5。

## 1. 加载机制总览

- 开发态：`frontend/vite.preview.config.mjs` 的 `configureServer`（129–197 行）按 URL 分发，向 HTML 注入 React 入口脚本；`REACT_VIEWER_ENTRIES`（46–53 行）负责六个查看器。
- 正式构建：`rollupOptions.input`（221–230 行）目前**只有** `pages.html` 与 `frontend/document-viewer/index.html`。
- 静态资产：`publicDir = frontend/public`（126 行），构建时**整目录复制**到 `dist/frontend/`。
- Electron：`electron/main.cjs:8` 默认加载 `http://localhost:5176/src/app/index.html`（Vite 开发地址）；子窗口 URL 由该地址推导，未接通 `dist/frontend`。

## 2. 交付入口登记

| # | 页面 | URL | HTML 来源 | React 入口 | 父子窗口 | 专用引擎 | 开发加载 | 生产加载 | 当前缺口 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 主界面 | `/src/app/index.html` | `src/app/index.html` | `react/main.tsx` | 顶层窗口 | — | 注入（配置 140–144） | **无产物** | 仍载旧脚本，见 §3 |
| 2 | 偏好设置 | `/src/app/preferences.html` | `src/app/preferences.html` | `react/preferences/entry.tsx` | 主窗子窗 | tippy、ShortcutManager | 注入（145–149） | **无产物** | 胶水未拆（R5） |
| 3 | 预览大窗 | `/src/app/preview-window.html` | `src/app/preview-window.html` | `react/preview-window/entry.tsx` | 主窗子窗（`originalPreviewUrl` main.cjs:699 派生，`?id=`）| 媒体播放 | 注入（150–154） | **无产物** | watcher 门面（R5） |
| 4 | 采集窗口 | `/src/app/collect-window/index.html` | `src/app/collect-window/index.html` | `react/collect-window/entry.tsx` | 主窗子窗（+拖动） | jQuery / jQuery UI / SweetAlert / CollectItem | 注入（155–159） | **无产物** | 旧 UI/API 胶水（R5） |
| 5 | EXIF 查看器 | `/src/app/exif-viewer/index.html` | 同路径 | `react/viewers/exif/entry.tsx` | 查看器子窗 | —（原生 `<img>`） | 注入（46–53 映射） | **无产物** | 入口未入构建 |
| 6 | RAW 查看器 | `/src/app/raw-viewer/index.html` | 同路径 | `react/viewers/raw/entry.tsx` | 查看器子窗 | dcraw（`../../my_modules/raw-parser/dcraw.js`，HTML:8） | 注入 | **无产物** | 解码器资源交付 |
| 7 | native 查看器 | `/src/app/native-viewer/index.html` | 同路径 | `react/viewers/native/entry.tsx` | 查看器子窗 | 后端 `/api/item/nativePreview` + pdf.js worker / soffice worker | 注入 | **无产物** | worker 资源交付 |
| 8 | GIF 查看器 | `/src/app/gif-viewer/index.html` | 同路径 | `react/viewers/gif/entry.tsx` | 查看器子窗 | `window.SuperGif`（`./gif-player.js`，HTML:8） | 注入 | **无产物** | 脚本资源交付 |
| 9 | 文本编辑 | `/src/app/text-editor/text-editor.html` | `src/app/text-editor/text-editor.html` | `react/viewers/text-editor/entry.tsx` | 查看器子窗 | 原生 contenteditable + Mousetrap 复刻 | 注入 | **同路径两套实现** | 见 §4 |
| 10 | 字体查看器 | `/src/app/font-viewer/font-viewer.html` | 同路径 | `react/viewers/font/entry.tsx` | 查看器子窗 | MediumEditor（HTML:20）、tippy（HTML:21） | 注入 | **无产物** | 引擎 + 脚本资源交付 |
| 11 | 文档查看器 | `/frontend/document-viewer/index.html` | `frontend/document-viewer/index.html` | 18 个 TS/TSX（该目录） | iframe 子窗（`core/documentViewer.ts:58`） | 自研渲染 | 构建产物 + `transformIndexHtml` | **已构建** | 未纳入类型检查（R3） |
| 12 | PDF 查看器 | `/src/app/pdf-viewer/web/viewer.html` | 同路径 | 无（PDF.js + viewer.js） | 查看器子窗 | PDF.js | 手工服务 `*.js`（187–194） | **无产物** | worker/字体 + 自有改动边界（R1/R5） |
| 13 | 3D 查看器 | `/src/app/model-viewer/website/index.html`、`embed.html` | 同路径 | 无（O3DV 页面） | 主入口 + 嵌入入口 | O3DV（`../libs/o3dv.website.min.js`，index.html:21；`embed.html:26`） | 通用分支 | **无产物** | 资源路径 + 卸载清理（R1/R5） |
| 14 | 注册 / 设备管理 | `/src/app/registration.html`、`/src/app/manage-device.html` | `frontend/public/replaced/*.html` | 无 | 顶层窗口 | — | 专用分支（160–169） | 随 public 复制 | 归口与路由统一（R1/R6） |
| 15 | thumbnail.html | `/src/app/thumbnail.html` | 同路径 | 无（空 `<body>`） | — | — | 通用分支 | 随 public 复制？ | **全仓零引用 → R6 退役候选** |
| 16 | 工具/静态页 | `/pages.html`、`/workbench.html`、`/roadmap.html`、`/media-viewer/*`、`/browser-extension/*`、`/vendor/*` | `frontend/public/*` | 无 | — | — | public 直出 | 随 public 复制 | workbench 被 Electron 菜单引用（main.cjs:1701）|
| 17 | 旧指令模板 | — | `src/app/js/directives/*.html`（64 个） | 无 | — | — | 不加载 | 不加载 | 非页面；R6 核对引用后清理 |

> 十个窗口入口（1–4 与 5–10）均把 `core/shimsLegacy.ts` 作为第一条 import——这是 R2 的拆分对象。

## 3. 主界面仍加载的旧脚本（R6 迁移对象）

`src/app/index.html` 去注释后仍有旧经典脚本；无 `<script type="module">`，React 入口仅靠开发中间件注入：

| 行 | 脚本 | 说明 |
|---|---|---|
| 195 | `js/lib/eagle-api.js` | 旧 API 门面，须迁移为具名 TS 模块 |
| 196 | `js/lib/api/url-enlarger.js` | 旧 URL 增强 |
| 241 | `js/services/lazy-load-manager.js` | 图片加载生命周期，迁移时须保护连续网格几何 |
| 245 | `js/services/shortcut-manager.js` | 快捷键 |
| 247–249 | 内联 `eagle.urlEnlargerRemote.load()` | 启动副作用 |

## 4. 同路径两套实现冲突（R1 优先处理）

- React 侧：`src/app/text-editor/text-editor.html` + `react/viewers/text-editor/entry.tsx`（开发态实际渲染）。
- 旧页：`frontend/public/src/app/text-editor/text-editor.html:28` 引用 `text-editor.js`（另有 `css/text-editor.css`）。因 `publicDir` 整目录复制，该旧页在产物中**遮蔽** React 页，形成同路径不同实现。
- 处置：R1 删除 `frontend/public/src/app/text-editor/*`，保留 React 一份权威实现。

## 5. 开发专用资产（R1 从生产排除）

`frontend/public/` 会被整目录复制进产物，其中以下为开发/演示用途，应在生产资源规划中排除或转为独立演示构建：

- `mock-library/`（含 `Eagle Reverse Demo.library`）
- `mock-assets/`（box.glb、sample.pdf、sample.gif 等）
- `.tmp` 与 `tests-tmp/` 临时证据目录已由 `.gitignore` 忽略，不属交付面。

`replaced/`、`pages.html`、`workbench.html`、`roadmap.html`、`tab-bar.css/js`、`browser-extension/`、`media-viewer/`、`vendor/` 为待归口的静态交付页，见 §2 第 14/16 行。

## 6. 入口处置清单

| 项 | 处置 | 归属批次 |
|---|---|---|
| `pages.html:64` 指向缺失的 `/src/app/progress.html` | 已移除死链 | R0（本次） |
| `frontend/public/src/app/text-editor/*` 与 React 页同路径 | 删除旧页，保留 React | R1 |
| `mock-library/`、`mock-assets/` 进产物 | 从生产排除/转演示构建 | R1 |
| 六查看器、PDF、3D、主窗、三业务窗无产物 | 补齐多页入口与资源 | R1 |
| `thumbnail.html` 零引用 | 退役或明确静态用途 | R6 |
| `src/app/js/directives/*.html`（64 个） | 核对引用后清理或归档 | R6 |
| 主界面旧脚本（§3） | 迁移为具名 TS 模块 | R6 |
| 六个查看器与三个窗口的路径隔离 | 登记各窗口入口，逐窗迁移 | R5 |

## 7. 可复核方法

```powershell
Set-Location -LiteralPath 'H:/dev/Eagle-Sec-development - 副本'
# 开发态入口映射
#   frontend/vite.preview.config.mjs:129-197（分发）、46-53（查看器映射）
# 正式构建输入
#   frontend/vite.preview.config.mjs:221-230
git log -1 --oneline 195dc3ab
node tests/typecheck-baseline.mjs   # 类型基线门禁
```
