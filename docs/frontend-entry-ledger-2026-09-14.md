# Eagle 前端交付入口台账（R0 建立，R1 更新）

台账建立：2026-09-14（R0）。R1 更新：同日。工作区：`H:/dev/Eagle-Sec-development - 副本`。分支：`react-in-place`。基线：R0 = `195dc3ab` 之上 `14ff61a2`；R1 见提交记录。

本台账供后续批次取用。**“有 React 入口”不等于“该窗口状态/交互已收敛”**——本表只登记入口与加载方式，迁移深度见报告 §4 与批次计划 R5。

## 1. 加载机制（R1 后）

- **React 入口写在源 HTML 中**：10 个窗口页各有 `<script type="module" src="/src/app/react/...">`（R1 起）。开发与构建共用同一份 HTML。
- 开发态：`frontend/vite.preview.config.mjs` 的 `configureServer`（105–170 行）按 URL 直出页面，只补 `window.__EAGLE_API_BASE_URL/__EAGLE_EXTENSION_BASE_URL` 与 react-refresh 前置脚本；`/` 重定向、`replaced/` 页与 `pdf-viewer/*.js` 仍由该中间件处理。
- 正式构建：`rollupOptions.input`（约 230 行）含 11 个页面 + `pages.html`；`transformIndexHtml` 按文件路径补 API 地址与 collect 模板清洗。产物路径与 URL 形状一致（`dist/frontend/src/app/index.html` …）。
- 静态资产：`publicDir = frontend/public` 整目录复制；`eagle-production-assets` 插件在 `closeBundle` 交付 `src/app`（排除 `.html`/`react`）、`src/my_modules`、`src/i18n`、`src/config.js`，并从产物删除 `mock-library`/`mock-assets`（开发数据）。
- Electron：`electron/main.cjs:8` 读 `EAGLE_PREVIEW_URL`（默认仍是开发地址 5176）；子窗与工作台 URL 从该 URL 的 origin 推导（R1 起，不再硬编码 5176）。
- 生产运行：`npm run build` → `npm run start:prod`（本地静态服务 + 后端 + Electron），或 `npm run serve:frontend` 单起静态服务。
- 门禁：`npm run test:production` = `tests/dist-entry-check.mjs`（产物入口/资源检查）+ `tests/production-smoke.mjs`（Electron 正式启动冒烟，不依赖 Vite dev）。

## 2. 交付入口登记

| # | 页面 | URL | HTML 来源 | React 入口 | 父子窗口 | 专用引擎 | 生产状态（R1 后）|
|---|---|---|---|---|---|---|---|
| 1 | 主界面 | `/src/app/index.html` | `src/app/index.html` | `react/main.tsx` | 顶层窗口 | — | 已构建，冒烟通过 |
| 2 | 偏好设置 | `/src/app/preferences.html` | 同路径 | `react/preferences/entry.tsx` | 主窗子窗 | tippy、ShortcutManager | 已构建 |
| 3 | 预览大窗 | `/src/app/preview-window.html` | 同路径 | `react/preview-window/entry.tsx` | 主窗子窗（`originalPreviewUrl` main.cjs:699 派生）| 媒体播放 | 已构建 |
| 4 | 采集窗口 | `/src/app/collect-window/index.html` | 同路径 | `react/collect-window/entry.tsx` | 主窗子窗 | jQuery / jQuery UI / SweetAlert / CollectItem | 已构建 |
| 5 | EXIF 查看器 | `/src/app/exif-viewer/index.html` | 同路径 | `react/viewers/exif/entry.tsx` | 查看器子窗 | — | 已构建 |
| 6 | RAW 查看器 | `/src/app/raw-viewer/index.html` | 同路径 | `react/viewers/raw/entry.tsx` | 查看器子窗 | dcraw（`src/my_modules/raw-parser/dcraw.js`）| 已构建（my_modules 已交付）|
| 7 | native 查看器 | `/src/app/native-viewer/index.html` | 同路径 | `react/viewers/native/entry.tsx` | 查看器子窗 | 后端 nativePreview + pdf.js worker | 已构建 |
| 8 | GIF 查看器 | `/src/app/gif-viewer/index.html` | 同路径 | `react/viewers/gif/entry.tsx` | 查看器子窗 | `window.SuperGif`（`./gif-player.js`）| 已构建 |
| 9 | 文本编辑 | `/src/app/text-editor/text-editor.html` | 同路径 | `react/viewers/text-editor/entry.tsx` | 查看器子窗 | 原生 contenteditable | 已构建（同路径冲突已消除）|
| 10 | 字体查看器 | `/src/app/font-viewer/font-viewer.html` | 同路径 | `react/viewers/font/entry.tsx` | 查看器子窗 | MediumEditor | 已构建 |
| 11 | 文档查看器 | `/frontend/document-viewer/index.html` | 同路径（18 个 TS/TSX）| — | iframe 子窗（`core/documentViewer.ts:58`）| 自研渲染 | 已构建 |
| 12 | PDF 查看器 | `/src/app/pdf-viewer/web/viewer.html` | 同路径 | 无（PDF.js）| 查看器子窗 | PDF.js | 已交付（引擎页原样复制）|
| 13 | 3D 查看器 | `/src/app/model-viewer/website/{index,embed}.html` | 同路径 | 无（O3DV）| 主+嵌入入口 | O3DV | 已交付（引擎页原样复制）|
| 14 | 注册 / 设备管理 | `/src/app/{registration,manage-device}.html` | `frontend/public/replaced/*.html` | 无 | 顶层窗口 | — | 中间件直出，未进产物（有意）|
| 15 | thumbnail.html | `/src/app/thumbnail.html` | 同路径 | 无（空壳）| — | — | 全仓零引用 → R6 退役候选 |
| 16 | 工具/静态页 | `/pages.html`、`/workbench.html`、`/roadmap.html`、`/media-viewer/*`、`/browser-extension/*`、`/vendor/*` | `frontend/public/*` | 无 | — | 随 public 复制；workbench 被 Electron 菜单引用（main.cjs:1705）|
| 17 | 旧指令模板 | — | `src/app/js/directives/*.html`（64 个）| 无 | — | — | 非页面；未交付（R6 核对引用后清理）|

> 十个窗口入口（1–4、5–10）第一条 import 均为 `core/shimsLegacy.ts`。
> **R2 已完成**：该文件由 3401 行单 IIFE 拆为 `core/shim/` 下 8 个模块
> （`environment`/`browserRuntime`/`moduleRegistry`/`settingsI18n`/`ipcBus`/`desktopCapability`/`demoSeed`/`install`），
> `shimsLegacy.ts` 退化为 5 行兼容入口（入口 import 未变）。装配顺序、全局契约面与测试门禁见
> `docs/frontend-batch-plan-R0-R7-2026-09-14.md` 的 R2「实施结果」。
> 十窗当前仍安装同一份全量契约；**按窗收窄安装面留待 R5**（判据 `resolveWindowClass()` 已就位）。

## 3. 主界面仍加载的旧脚本（R6 迁移对象）

`src/app/index.html` 去注释后仍有旧经典脚本（R1 已随 `src/app/js` 交付到产物，保证生产可运行）：

| 行 | 脚本 |
|---|---|
| 195 | `js/lib/eagle-api.js` |
| 196 | `js/lib/api/url-enlarger.js` |
| 241 | `js/services/lazy-load-manager.js`（图片加载生命周期，迁移须保护连续网格几何）|
| 245 | `js/services/shortcut-manager.js` |
| 247–249 | 内联 `eagle.urlEnlargerRemote.load()` |

## 4. 已消除的冲突

`frontend/public/src/app/text-editor/*`（旧页 `text-editor.html:28` → `text-editor.js`，与 React 文本编辑页同路径）已删除；React 页的 `css/text-editor.css` 由权威源 `src/app/text-editor/css/text-editor.css` 提供。生产产物不再出现同路径两套实现。

## 5. 生产资源交付与排除（R1）

- 交付：`src/app`（排除 `.html`/`react`）、`src/my_modules`、`src/i18n`、`src/config.js`。
  - `src/config.js` 与 `src/i18n` 是关键补充：`appRoot` 为 `/src`，运行时 `require(appRoot + '/config.js')` 取 `EagleConfig`（含 `VIDEO_FORMATS`）。缺这两项时生产态在 `hoverPreview` 初始化处 `EagleConfig.VIDEO_FORMATS.map` 崩溃（R1 冒烟实测定位）。
- 排除：`frontend/public/mock-library`、`mock-assets`（开发/演示数据）在 `closeBundle` 从产物删除。
- 引擎页：`src/app` 内除 10 个 React 页 HTML 外的 `.html`（pdf-viewer、model-viewer、旧指令模板）按原样复制；PDF 与 3D 查看器无 React 入口，作为专用引擎页交付。
- 已知既有源缺陷（源码与产物均缺，dev 同样 404；非 R1 引入，归 R5/R6）：`icon.svg`、`js/vendors/tippy.js`（preferences / font-viewer）、collect-window 的 `../css/jquery-ui.min.css`（实际在 `collect-window/css/`）与 `js/lib/api/url-enlarger.js`、model-viewer 的 `info/index.html` 与 `../build/o3dv.website.min-dev.js`、pdf-viewer 的 `locale/locale.properties`。由 `tests/dist-entry-check.mjs` 以 WARN 记录。

## 6. 入口处置清单

| 项 | 处置 | 状态 |
|---|---|---|
| `pages.html` 指向缺失 `progress.html` | 移除死链 | R0 完成 |
| `frontend/public/src/app/text-editor/*` 同路径冲突 | 删除旧页 | R1 完成 |
| `mock-library` / `mock-assets` 进产物 | 产物中删除 | R1 完成 |
| 十一个交付页面无产物 | 多页入口 + 资源交付 | R1 完成 |
| `/src/config.js`、`/src/i18n` 未交付 | 纳入交付 | R1 完成 |
| PDF / 3D 查看器入口与资源 | 引擎页原样交付 | R1 完成 |
| `thumbnail.html` 零引用 | 退役或明确静态用途 | R6 |
| `src/app/js/directives/*.html`（64）| 核对引用后清理/归档 | R6 |
| 主界面旧脚本（§3）| 迁移为具名 TS 模块 | R6 |
| 各窗口 controllerScope / watcher / 旧 UI 胶水 | 逐窗迁移 | R5 |
| 既有源缺陷（§5）| 修引用或随迁移清理 | R5/R6 |

## 7. 可复核命令

```powershell
Set-Location -LiteralPath 'H:/dev/Eagle-Sec-development - 副本'
npm run build
npm run test:production     # 产物入口/资源检查 + Electron 正式启动冒烟
npm run start:prod          # 本地静态服务 + 后端 + Electron（真实使用）
node tests/typecheck-baseline.mjs
```
