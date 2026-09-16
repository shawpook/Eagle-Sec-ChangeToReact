# Eagle 前端交付入口台账（R0 建立，R1 更新）

台账建立：2026-09-14（R0）。R1 更新：同日。工作区：`H:/dev/Eagle-Sec-development - 副本`。分支：`react-in-place`。基线：R0 = `195dc3ab` 之上 `14ff61a2`；R1 见提交记录。

> ## ⚠ M0 订正说明（2026-09-15 追加）
>
> 本文件是 **2026-09-14 的 R0/R1 记录**，保留原日期、原结构与原表述以供追溯。
> 2026-09-15 的 M0 审计（`docs/plan-2026-09-15-full-workspace-legacy-audit.md` §3.4 F26）判定其中 **6 处口径失真**。
> 下列订正**就地插入**在对应条目内，一律采用「**原表述 → 现口径**」形式，**不删除历史记录、不把本文改写成像是当天写的**。
> 矩阵口径的完整重建见 **`docs/frontend-entry-ledger-m0-2026-09-15.md`**；六条对照的汇总见该文 §4。
>
> 需一并声明的时点边界：本文的产物类结论基于 **2026-09-14 时点的已存在产物**；
> 本轮 M0 核查所在的工作区副本**不存在 `dist/`**，故下文凡标 **[M0推]** 的产物路径均为**构建规则推导**，非观测结果。
> 另：`tests/dist-entry-check.mjs` 已在 `00352c1f`（M0 闭包门禁批次）改为**缺资源无条件 FAIL**，
> 本文 §5/§6 中「仅剩 2 条 WARN」的表述属**当时代码**的历史记录，不再代表当前门禁行为。

本台账供后续批次取用。**“有 React 入口”不等于“该窗口状态/交互已收敛”**——本表只登记入口与加载方式，迁移深度见报告 §4 与批次计划 R5。

## 1. 加载机制（R1 后）

- **React 入口写在源 HTML 中**：10 个窗口页各有 `<script type="module" src="/src/app/react/...">`（R1 起）。开发与构建共用同一份 HTML。
- 开发态：`frontend/vite.preview.config.mjs` 的 `configureServer`（105–170 行）按 URL 直出页面，只补 `window.__EAGLE_API_BASE_URL/__EAGLE_EXTENSION_BASE_URL` 与 react-refresh 前置脚本；`/` 重定向、`replaced/` 页与 `pdf-viewer/*.js` 仍由该中间件处理。
- 正式构建：`rollupOptions.input`（约 230 行）含 11 个页面 + `pages.html`；`transformIndexHtml` 按文件路径补 API 地址与 collect 模板清洗。产物路径与 URL 形状一致（`dist/frontend/src/app/index.html` …）。
- 静态资产：`publicDir = frontend/public` 整目录复制；`eagle-production-assets` 插件在 `closeBundle` 交付 `src/app`（排除 `.html`/`react`）、`src/my_modules`、`src/i18n`、`src/config.js`，并从产物删除 `mock-library`/`mock-assets`（开发数据）。
  - **[M0 订正 F26-5｜原表述 → 现口径]** 原表述「交付 `src/app`（**排除 `.html`/`react`**）」不精确。
    **现口径**：过滤谓词实际为「排除 `react/` 子树」+「排除 `src.endsWith('.html') && REACT_PAGE_ENTRIES[rel]` 命中的**已登记 React 页 HTML**」，**其余 `.html` 一律复制**。
    即 `pdf-viewer/web/viewer.html`、`model-viewer/website/{index,embed}.html` 等引擎页按原样交付；源码注释同此（`frontend/vite.preview.config.mjs:232-239`）。
    证据：`frontend/vite.preview.config.mjs:232-239`；`REACT_PAGE_ENTRIES` 定义 `frontend/vite.preview.config.mjs:53-58、64-67` 与 `tests/frontend-gate-manifest.mjs:2-14`。
    完整口径见 `docs/frontend-entry-ledger-m0-2026-09-15.md` §1.2、§4.5。
- Electron：`electron/main.cjs:8` 读 `EAGLE_PREVIEW_URL`（默认仍是开发地址 5176）；子窗与工作台 URL 从该 URL 的 origin 推导（R1 起，不再硬编码 5176）。
- 生产运行：`npm run build` → `npm run start:prod`（本地静态服务 + 后端 + Electron），或 `npm run serve:frontend` 单起静态服务。
- 门禁：`npm run test:production` = `tests/dist-entry-check.mjs`（产物入口/资源检查）+ `tests/production-smoke.mjs`（Electron 正式启动冒烟，不依赖 Vite dev）。

## 2. 交付入口登记

| # | 页面 | URL | HTML 来源 | React 入口 | 父子窗口 | 专用引擎 | 生产状态（R1 后）|
|---|---|---|---|---|---|---|---|
| 1 | 主界面 | `/src/app/index.html` | `src/app/index.html` | `react/main.tsx` | 顶层窗口 | — | 已构建，冒烟通过 |
| 2 | 偏好设置 | `/src/app/preferences.html` | 同路径 | `react/preferences/entry.tsx` | 主窗子窗 | tippy、ShortcutManager | 已构建 |
| 3 | 预览大窗 | `/src/app/preview-window.html` | 同路径 | `react/preview-window/entry.tsx` | 主窗子窗（`originalPreviewUrl` main.cjs:699 派生）| 媒体播放 | 已构建 |
| 4 | 采集窗口 | `/src/app/collect-window/index.html` | 同路径 | `react/collect-window/entry.tsx` | 主窗子窗 | jQuery / jQuery UI / SweetAlert / CollectItem `⚠M0 订正 F26-1，见下` | 已构建 |
| 5 | EXIF 查看器 | `/src/app/exif-viewer/index.html` | 同路径 | `react/viewers/exif/entry.tsx` | 查看器子窗 | — | 已构建 |
| 6 | RAW 查看器 | `/src/app/raw-viewer/index.html` | 同路径 | `react/viewers/raw/entry.tsx` | 查看器子窗 | dcraw（`src/my_modules/raw-parser/dcraw.js`）| 已构建（my_modules 已交付）|
| 7 | native 查看器 | `/src/app/native-viewer/index.html` | 同路径 | `react/viewers/native/entry.tsx` | 查看器子窗 | 后端 nativePreview + pdf.js worker | 已构建 |
| 8 | GIF 查看器 | `/src/app/gif-viewer/index.html` | 同路径 | `react/viewers/gif/entry.tsx` | 查看器子窗 | `window.SuperGif`（`./gif-player.js`）| 已构建 |
| 9 | 文本编辑 | `/src/app/text-editor/text-editor.html` | 同路径 | `react/viewers/text-editor/entry.tsx` | 查看器子窗 | 原生 contenteditable | 已构建（同路径冲突已消除）|
| 10 | 字体查看器 | `/src/app/font-viewer/font-viewer.html` | 同路径 | `react/viewers/font/entry.tsx` | 查看器子窗 | MediumEditor | 已构建 |
| 11 | 文档查看器 | `/src/app/react/viewers/document/index.html` | 同路径（18 个 TS/TSX）| — | iframe 子窗（`core/documentViewer.ts:60`）| 自研渲染 | 已构建 |
| 12 | PDF 查看器 | `/src/app/pdf-viewer/web/viewer.html` | 同路径 | 无（PDF.js）| 查看器子窗 | PDF.js | 已交付（引擎页原样复制）|
| 13 | 3D 查看器 | `/src/app/model-viewer/website/{index,embed}.html` | 同路径 | 无（O3DV）| 主+嵌入入口 | O3DV | 已交付（引擎页原样复制）|
| 14 | 注册 / 设备管理 | `/src/app/{registration,manage-device}.html` | `frontend/public/replaced/*.html` | 无 | 顶层窗口 | — | 中间件直出，未进产物（有意）`⚠M0 订正 F26-2，见下` |
| 15 | thumbnail.html | `/src/app/thumbnail.html` | 同路径 | 无（空壳）| — | — | **R6 已退役**（全仓零引用；产物本就排除 `src/app/*.html`）`⚠M0 订正 F26-5：此处「排除 src/app/*.html」同属旧表述，实为仅排除已登记 React 页 HTML —— 退役结论不变，理由的措辞已订正` |
| 16 | 工具/静态页 | `/pages.html`、`/workbench.html`、`/roadmap.html`、`/media-viewer/*`、`/browser-extension/*`、`/vendor/*` | `frontend/public/*` | 无 | — | 随 public 复制；workbench 被 Electron 菜单引用（main.cjs:1705）|
| 17 | 旧指令模板 | — | `src/app/js/directives/*.html`（64 个）| 无 | — | — | **R6 已退役**（连同 controllers/modules 共 186 个文件，见 §8）|

> **M0 订正 F26-1（第 4 行｜采集窗口）｜原表述 → 现口径**
> 原表述：专用引擎列写 `jQuery / jQuery UI / SweetAlert / CollectItem`。
> **现口径**：该窗 **jQuery / jQuery UI / SweetAlert 的 JS 框架已退役**，现状为自研交互层——自研 `makeDraggable`（`src/app/react/components/interactions/draggable.ts` 头注释「D-2f：自研 draggable（替代 jQuery UI `.draggable()`）」，消费点 `react/collect-window/tagPanel.tsx:15、28、43`）、自研 sortable（`react/collect-window/contextMenu.tsx:393`）、自研弹窗（`react/collect-window/entry.tsx:13-14` 记 `sweetalert2.all.min.js` 退役）、`$(document).ready` 改原生（`react/collect-window/api/env.ts:302`）。
> **保留的是 CSS 类名契约而非 JS 框架**：`src/app/collect-window/index.html:10-13` 显式说明 `sweetalert2.min.css` 仅为 `.swal2-*` 类名契约；`:8-9` 记 jQuery UI CSS 链接退役。
> **仍需登记的真实经典脚本**：该页仍有 3 个非 React 经典 script（`chinese_convert.js`、`pinyinlite.js`、`tiny-pinyin.js`，`index.html:27-29`）——引擎，不是框架。
> 口径纪律：**CSS 保留不等于 JS 框架活跃**；CollectItem 系旧 controller 概念，R5 后由 React 域承接。

> **M0 订正 F26-2（第 14 行｜注册 / 设备管理）｜原表述 → 现口径**
> 原表述：「中间件直出，**未进产物**（有意）」——把**两个不同概念**压成了一句。
> **现口径（拆为两条）**：
> ① **原文件确实进产物**：`frontend/public/replaced/{registration,manage-device}.html` 随 `publicDir` 整目录复制，落到 `dist/frontend/replaced/*.html`（**[M0推]**，本副本无 `dist/`；依据 `frontend/vite.preview.config.mjs:111` 与 `:261-263` 只删 `mock-library`/`mock-assets`）。`tests/frontend-gate-manifest.mjs:20` 亦把二者列入 `STATIC_PAGES`，即**产物检查期望它们存在**。
> ② **旧 URL 在生产态缺映射**：产品导航 `frontend/public/pages.html:62-63` 指向 `/src/app/{registration,manage-device}.html`，而这两个 URL 只有 **dev 中间件**直出（`frontend/vite.preview.config.mjs:145-154` 的 `readReplacement()`）；生产静态服务 `scripts/serve-frontend.mjs` 只做 `path.join(root, url)` 文件查找，**不产生该映射**。
> 口径纪律：**「文件没交付」与「URL 没映射」是两回事**，不可再合并叙述。

> 十个窗口入口（1–4、5–10）第一条 import 均为 `core/shimsLegacy.ts`。
> **R2 已完成**：该文件由 3401 行单 IIFE 拆为 `core/shim/` 下 8 个模块
> （`environment`/`browserRuntime`/`moduleRegistry`/`settingsI18n`/`ipcBus`/`desktopCapability`/`demoSeed`/`install`），
> `shimsLegacy.ts` 退化为 5 行兼容入口（入口 import 未变）。装配顺序、全局契约面与测试门禁见
> `docs/frontend-batch-plan-R0-R7-2026-09-14.md` 的 R2「实施结果」。
> 十窗当前仍安装同一份全量契约；**按窗收窄安装面留待 R5**（判据 `resolveWindowClass()` 已就位）。

## 3. 主界面旧脚本（R6 已全部迁移）

`src/app/index.html` 现只剩一个脚本标签：`<script type="module" src="/src/app/react/main.tsx">`。
原经典脚本与内联 boot 的落点：

| 原位置 | 原内容 | R6 落点 |
|---|---|---|
| :197 | `js/lib/eagle-api.js`（eagle 基座 + `utils.tree` + `urlEnlargerRemote`）| `core/eagleApi.ts::installEagleBase()`，装配点 `core/eagleBase.ts`（main.tsx 首个 import）|
| :198 | `js/lib/api/url-enlarger.js`（1038 行，`globalThis.URLEnlarger` + `eagle.urlEnlarger`）| `core/urlEnlarger.ts`（逐字移植，类体校验一致）+ `installUrlEnlarger()` |
| :243 | `js/services/lazy-load-manager.js`（738 行，图片懒加载）| `core/lazyLoadManager.ts`（逐字移植）；`libraryDomain` 直接 import 该类 |
| :245 | `js/services/shortcut-manager.js` | `core/shortcutManager.ts`（R5 完成）|
| :247–249 | 内联 `eagle.urlEnlargerRemote.load()` | `core/eagleBase.ts` 内同名调用 |
| 内联 | `module` 兼容脚本（webpack UMD 时代产物）| R6 删除：`window.module` 全仓零消费方，两条语句本就是 no-op |

## 4. 已消除的冲突

`frontend/public/src/app/text-editor/*`（旧页 `text-editor.html:28` → `text-editor.js`，与 React 文本编辑页同路径）已删除；React 页的 `css/text-editor.css` 由权威源 `src/app/text-editor/css/text-editor.css` 提供。生产产物不再出现同路径两套实现。

## 5. 生产资源交付与排除（R1）

- 交付：`src/app`（排除 `.html`/`react`）、`src/my_modules`、`src/i18n`、`src/config.js`。
  - **[M0 订正 F26-5｜原表述 → 现口径]** 原表述「交付 `src/app`（**排除 `.html`/`react`**）」不精确。
    **现口径**：过滤谓词为「排除 `react/` 子树」+「排除 `src.endsWith('.html') && REACT_PAGE_ENTRIES[rel]` 命中的**已登记 React 页 HTML（11 条）**」，**其余 `.html` 全部复制**。
    证据：`frontend/vite.preview.config.mjs:232-239`（含源码注释「只排除由 Vite 产出的 React 页 HTML；pdf-viewer/model-viewer 等引擎页无 React 入口，按原样交付（R1）」）；`REACT_PAGE_ENTRIES` 见 `frontend/vite.preview.config.mjs:53-58、64-67` 与 `tests/frontend-gate-manifest.mjs:2-14`。
    本条与下方第 4 条「引擎页按原样复制」是**同一规则的两面**，原表述会让读者以为二者矛盾。
  - `src/config.js` 与 `src/i18n` 是关键补充：`appRoot` 为 `/src`，运行时 `require(appRoot + '/config.js')` 取 `EagleConfig`（含 `VIDEO_FORMATS`）。缺这两项时生产态在 `hoverPreview` 初始化处 `EagleConfig.VIDEO_FORMATS.map` 崩溃（R1 冒烟实测定位）。
- 排除：`frontend/public/mock-library`、`mock-assets`（开发/演示数据）在 `closeBundle` 从产物删除。
- 引擎页：`src/app` 内除 10 个 React 页 HTML 外的 `.html`（pdf-viewer、model-viewer、旧指令模板）按原样复制；PDF 与 3D 查看器无 React 入口，作为专用引擎页交付。
  - **[M0 订正｜计数]** 该处「10 个 React 页 HTML」应作 **11 条**（10 个传统窗口页 + 文档查看器页）。见 `tests/frontend-gate-manifest.mjs:2-14` 的 `REACT_PAGES` 清单。
- 已知既有源缺陷（源码与产物均缺，dev 同样 404；非 R1 引入）：`icon.svg`、`js/vendors/tippy.js`（preferences / font-viewer）、collect-window 的 `../css/jquery-ui.min.css`（实际在 `collect-window/css/`）与 `js/lib/api/url-enlarger.js`、model-viewer 的 `info/index.html` 与 `../build/o3dv.website.min-dev.js`、pdf-viewer 的 `locale/locale.properties`。**R5/R6 已全部消除**——`tests/dist-entry-check.mjs` 现仅剩 2 条 WARN，均为 `pages.html` 指向有意排除的演示路由（registration / manage-device）。
  - **[M0 订正｜时点边界]** 「仅剩 2 条 WARN」是 **2026-09-14 当时的门禁行为**。`tests/dist-entry-check.mjs` 已在 `00352c1f` 重构：`warnings`/`warn()`/`EXCLUDED_ROUTES` 全部移除，缺资源改为**无条件 `fail()`**；当前只剩不影响退出码的 `notes`（范围说明），不再输出 `WARN`。复核见 `tests/dist-entry-check.mjs:160、226、239-241` 与 `git show 00352c1f -- tests/dist-entry-check.mjs`。

## 6. 入口处置清单

| 项 | 处置 | 状态 |
|---|---|---|
| `pages.html` 指向缺失 `progress.html` | 移除死链 | R0 完成 |
| `frontend/public/src/app/text-editor/*` 同路径冲突 | 删除旧页 | R1 完成 |
| `mock-library` / `mock-assets` 进产物 | 产物中删除 | R1 完成 |
| 十一个交付页面无产物 | 多页入口 + 资源交付 | R1 完成 |
| `/src/config.js`、`/src/i18n` 未交付 | 纳入交付 | R1 完成 |
| PDF / 3D 查看器入口与资源 | 引擎页原样交付 | R1 完成 |
| `thumbnail.html` 零引用 | 退役 | R6 完成 |
| `src/app/js/directives/*.html`（64）| 核对引用后清理 | R6 完成（连同 controllers/modules 共 186 个） |
| 主界面旧脚本（§3）| 迁移为具名 TS 模块 | R6 完成 |
| 各窗口 controllerScope / watcher / 旧 UI 胶水 | 逐窗迁移 | R5 完成 |
| 既有源缺陷（§5）| 修引用或随迁移清理 | R5/R6 完成（dist-entry-check 现仅剩 2 条「有意排除」WARN）|

## 7. 可复核命令

```powershell
Set-Location -LiteralPath 'H:/dev/Eagle-Sec-development - 副本'
npm run test:acceptance     # R7 统一前端验收入口（静态门禁 → 正式构建 → 产物检查/冒烟 → 关键业务回归）
node tests/frontend-acceptance.mjs --list   # 覆盖面 + 分类 + 分段（不执行）
npm run build
npm run test:production     # 产物入口/资源检查 + Electron 正式启动冒烟
npm run start:prod          # 本地静态服务 + 后端 + Electron（真实使用）
node tests/typecheck.mjs
```

> **R7 验收结论**：报告 §6 验收矩阵逐项结论、未通过/未覆盖项、历史低频失败复现证据与宿主环境单列
> 见 `docs/frontend-acceptance-2026-09-14.md`。

## 7.1 R7 对交付页面的改动（端口硬编码与内嵌页判空）

| 位置 | 原状 | 处置 |
|---|---|---|
| `frontend/public/workbench.html:397` | `const API = 'http://127.0.0.1:41695'` 硬编码 | 改读 `window.__EAGLE_API_BASE_URL`（保留 41695 兜底） |
| `frontend/vite.preview.config.mjs` 开发中间件 | public 目录 HTML 直出、无注入 | 为 `frontend/public/**/*.html` 补同一注入面（路径限定在 publicDir 内） |
| `tests/screenshot-regression.mjs`（plugin 页 URL） | 硬编码 `http://127.0.0.1:41695/plugins/...` | 改用 `EAGLE_API_URL`（兜底 41695） |
| `electron/main.cjs:3528`（插件烟测窗 URL） | 硬编码 41695 | 改用同文件第 9 行的 `apiBase`（随 `EAGLE_API_URL` 变化） |
| `src/app/model-viewer/website/index.html:103` | 无条件读 `window.frameElement.getAttribute(...)`，顶层打开即抛异常、整页空白 | 判空（iframe 内行为不变） |

> **R5 迁移记录（文档查看器）**：原 `frontend/document-viewer/` 已迁入 `src/app/react/viewers/document/`
> （与其余六个查看器同址），源 HTML/TS/样式随迁；同步改造四处引用：`core/documentViewer.ts:60` 的 URL 构造、
> `frontend/vite.preview.config.mjs`（rollupOptions 入口 + 开发中间件为该路径复刻 `injectViewerConfig` 注入面）、
> `electron/main.cjs` 的 iframe URL 断言、`tests/dist-entry-check.mjs` 的入口页清单；
> `tsconfig.json` 的独立 include 条目随之下线（新址已在 `src/app/react/**` 覆盖内）。

## 8. R6 保留清单（`src/app/js` 逐目录）

判据：**静态字符串 + 动态 `require` + 插件接口（`core/shim/moduleRegistry.ts` 路径表）+
测试 + 运行时资源请求（`new Worker(...)`）** 五路联合核对；不能仅凭「搜索不到 import」删目录。

| 路径 | 处置 | 消费者 / 理由 |
|---|---|---|
| `js/directives/**`、`js/controllers/**`、`js/modules/**` | **已删除**（186） | Angular 指令模板/控制器与 flatpickr·angular-notify 副本；无加载点 |
| `js/lib/**` | **已删除**（8） | 主窗旧 API 全局（eagle-api 尾件 + `lib/api/{ai-*,combine-images,custom-export,filter,inspector}` + `utils/tree.js`），已由 `core/eagleClasses.ts`/`core/eagleApi.ts` 承接 |
| `js/workers/**` | 保留 | `new Worker('js/workers/{bitmapWorker,calHammingDistance,tifWorker}.js')`（`core/bitmapViewer.ts`、`core/eagleClasses.ts`、`components/detail/commentHooks.ts`）；libheif.js/.wasm 由 bitmapWorker 加载 |
| `js/plugin/**` | 保留 `⚠M0 订正 F26-3` | `require(appRoot+'/app/js/plugin')`（`core/bundleGlobals.ts:1737`、`pluginModule` 供给）|
| `js/plugins/eagle-note-plugin.js` | 保留 `⚠M0 订正 F26-3` | `preview-window/controller.ts:58` 现役 require |
| `js/api-server-v2.js` + `api-v2-playground{,-config}.js` | 保留 `⚠M0 订正 F26-3` | `apiServerDomain.ts:1342` require；playground 经 `api-server-v2.js:117` require |
| `js/utils/{unorm,remainingFilenameLength,getBestURL,is-accelerator,flipImage,rotateImage,downloadFile,ignoreMenuShortcuts,piexif}.js` | 保留 `⚠M0 订正 F26-3` | 各 domain / `plugin/index.js` 现役 require（moduleRegistry 亦登记前六项）|
| `js/utils/{captureHTML,icns2png,magick,qs}.js` | **已删除** | 全仓零 require |
| `js/vendors/{tga,libtga,wavesurfer.min,videojs/**,sweetalert2/sweetalert2.min.css,bignumber}.js` | 保留 | `commentHooks.ts`/`detailHooks.ts`/`preview-window.html` 现役 require、标签或 CSS；bignumber 被生产 vendor `eagle-match-rules.js` 使用 |
| `js/vendors/lodash.js`、`html2canvas.min.js`、`Typr.js`、`colorpicker/**` | **已删除** | 均已退役或零引用（lodash b1-9bc 摘标签、colorpicker b1-9bj 自研化）|
| `js/debug-reporter.js`、`thumbnail.html`、`js/scroll to top button 效能優化.md` | **已删除** | 零引用 |
| `frontend/public/tab-bar.{js,css}` + `tests/tab-bar-closed-loop.mjs` | **已退役** `⚠M7-2（D24）` | 原判「保留待定」，措辞另经 M0 订正 F26-4；**2026-09-16 由用户决策 D24 拍板退出发布清单**。两文件以 `git mv` 归档至 `docs/retired-2026-09-16/frontend/public/`；脱钩的 `tests/tab-bar-closed-loop.mjs` **改造为负向门禁**（不是删除，也不是留下恒红用例）。措辞订正见下方 M7-2 条目 |
| `@egjs/react-infinitegrid`（package.json + lockfile）| **已移除** | 全仓零 import；`window.ig` 是主窗自建 v4 facade（`boxGridEngine`），与该包无关（由 `m1-A8-eg-infinitegrid` 断言 `typeof w.ig.getItems === 'function' && !w.eg` 守护）|

> **M0 订正 F26-3（§8 第 4–7 行｜`js/plugin/**`、`eagle-note-plugin`、`api-server-v2`、`js/utils/*`）｜原表述 → 现口径**
> 原表述：以「**现役 require**」为由保留，等于把「源码里有 `require(...)` 文本」当作「磁盘模块被实际执行」。
> **现口径**：这些 require 的**解析结果是 `moduleRegistry` 的替身**，磁盘原模块并未由该链执行：

| 路径 | require 的实际解析结果 | 证据 |
|---|---|---|
| `/app/js/plugin` | `pluginModule`（shim 内构造的替身对象，定义于 `core/shim/browserRuntime.ts:387`） | `src/app/react/core/shim/moduleRegistry.ts:84` |
| `/app/js/plugins/eagle-note-plugin` | `{}`（空对象） | `moduleRegistry.ts:85` |
| `/app/js/api-server-v2` | `{ initAPIServerV2() {} }`（空实现） | `moduleRegistry.ts:83` |
| `utils/flipImage.js`、`utils/rotateImage.js` | `() => {}`（空函数，**无 demo-only 限制**） | `moduleRegistry.ts:106-107` |
| `utils/remainingFilenameLength.js` | `() => 240` | `moduleRegistry.ts:102` |
| `utils/getBestURL.js` | `() => ''` | `moduleRegistry.ts:103` |
| `utils/is-accelerator.js` | `() => true` | `moduleRegistry.ts:104` |
| `utils/unorm.js` | `{ nfc: 恒等, nfd: 恒等 }` | `moduleRegistry.ts:105` |
| 未命中以上任一路径 | `genericStub(req)` 万能对象 | `moduleRegistry.ts:128` |

> **且这些 `.js` 仍随产物交付**：`src/app` 的复制 filter 不排除 `.js`（`frontend/vite.preview.config.mjs:232-239`）。
> 因此正确标签是 **「被截获」+「闲置但交付」**，不是「现役」。
> **特别提示**：`flipImage`/`rotateImage` 返回空函数是 `docs/plan-2026-09-15-full-workspace-legacy-audit.md` **F06 的 P0 写回缺陷**来源——把它们与其余项并列在同一张「保留清单」里，会掩盖该缺陷。
> 复核方法：读 `moduleRegistry.ts:71-128` 的 `requireModule` 分支表，逐条比对上表；不要以调用点的 require 文本为判据。

> **M0 订正 F26-4（§8 末第 2 行｜tab-bar）｜原表述 → 现口径**
> 原表述：「**未接入构建链**的候选功能（PROGRESS b1-9al 登记为「**仅注释残留**」）」。
> **现口径（四点）**：
> ① **JS 内有真实 Angular 调用，不是注释**：`frontend/public/tab-bar.js:68` `window.angular && document.body ? angular.element(document.body).scope() : null`；`:73` `window.angular ? angular.element(document.body).injector() : null`。
> ② **随 public 交付**：`publicDir` 整目录复制 ⇒ `dist/frontend/tab-bar.js` / `.css`（**[M0推]**，本副本无 `dist/`）。它同时被登记为第一方图外脚本 `tests/frontend-gate-manifest.mjs:58`。故「未接入构建链」不准确。
> ③ **无现役加载点**：`src/**`、`frontend/**` 的全部 HTML 中检索 `tab-bar` **零命中**；亦不在 `rollupOptions.input`。
> ④ **闭环测试存在但未登记执行**：`tests/tab-bar-closed-loop.mjs` 在 `package.json`、`run-react-suite.mjs`、`run-attached-nonsuite.mjs`、`frontend-acceptance` 的任一清单中**均无引用**（仅本文档与 `src/app/react/PROGRESS.md` 的历史记录提到它）；其断言依赖主窗渲染出 `#eagle-tab-bar`（`:217-226`）。**该测试当前能否通过属代码链推导，未运行验证。**
> 正确标签：**闲置但交付**（主标签）。「仅注释残留」与代码事实相反。
> **本行行号订正**：F26-4 与 M0 台账把本条目写作 `:137`；文件随后增补，**现实际位于 §8 表格的 `:174`**。引用行号一律以本行导语所标的 §8 表格条目为准。

> **M7-2 订正（§8 表格 tab-bar 行｜退役落账）｜原表述 → 现口径**
> 原表述（经 F26-4 订正后仍为「保留待定」）：「未接入构建链的候选功能……删除属产品取舍，未在本批处理」。
> **现口径（2026-09-16，用户决策 D24 拍板）**：本条**已结案为「已退役」**，不再是「保留待定」：
> ① **退役动作**：`frontend/public/tab-bar.js`、`frontend/public/tab-bar.css` 以 `git mv` 移入 `docs/retired-2026-09-16/frontend/public/`，退出发布清单与交付路径。回滚基线指纹由门禁守着（见 ④）。
> ② **失真注释已订正**：两文件原第 3 行「注入路径: …（由 `vite.preview.config.mjs` 注入）」与事实不符（该注入逻辑早已不存在）；订正写进归档副本，指纹随之更新，一并在 M7-2 提交中逐字可核。
> ③ **零加载入口的当场复核**（M7-2 重做，未照抄本文）：全仓 `tab-bar`/`tab_bar`/`tabbar`/`tabBar`/`TabBar`/`eagle-tab-bar` 检索；`<script src>`/`<link>`/ESM import/`require(`/`importScripts`/`new Worker`/`import.meta.glob`/字符串拼接/后端供给/`electron/`/`vite rollupOptions.input` 逐项 0 命中。`bundleGlobals.ts` 的 fetch→`createElement('script')` 动态通道只有 3 个 vendor 目标，不含 tab-bar。**未发现 F26-4/W5 漏掉的入口。**
> ④ **测试不是被删掉，而是被加严**：`tests/tab-bar-closed-loop.mjs` 改造为**负向门禁**（真实仓库 + 真实产物 + 8 项负向自证），断言「tab-bar 不再被交付」。文件名为历史沿革，文件头已注明。
> ⑤ **余留**：`tests/tab-bar-closed-loop.mjs` 仍**未登记任何套件**（登记由 Coordinator 按 D11 执行）；文件名与职能已不匹配（建议后续重命名为 `tab-bar-retired-gate.mjs`），本批未改以免越出文件所有权。

> **M0 订正 F26-6（全文｜源码注释不得当作行为证明）｜原表述 → 现口径**
> 原表述：本文多处直接引用源码注释作为行为依据（如 §1「`shimsLegacy.ts` 退化为 5 行兼容入口」、§7.1 各行的「原状」）。
> **现口径**：`frontend/public/shims.js` **已删除**（删除提交 `e00abd21`：`feat(shims): 收尾批 E9（P4-b/P5）—— 删 shims.js + mock-data.js…`），但**仍有 20+ 处源码注释以它为行为依据**，例如：
> - `src/app/react/core/channelBridge.ts:9、11、25、85、405`（「语义逐字对齐 `shims.js` 的对应分支」）
> - `src/app/react/core/detailDeliveryGate.ts:2`（「自 `frontend/public/shims.js:56-232` 迁入」）
> - `src/app/react/core/documentViewer.ts:4`、`core/driverApi.ts:7`、`core/ipcWriteState.ts:4`、`core/returnBridge.ts:2`、`core/sourceMode.ts:4`、`core/scopeFace.ts:16`、`core/machineryInfra.ts:141-143`、`global/eagleGlobals.ts:2`、`main.tsx:82、219`
> - 测试与构建侧：`tests/txt-update-closed-loop.mjs:10、63`、`tests/empty-trash-closed-loop.mjs:118`、`tests/native-preview-closed-loop.mjs:136`、`frontend/vite.preview.config.mjs:29`
>
> 同类「注释承诺超出代码事实」还有：`main.tsx:224-240、267` 附近声称「再 await」而现场为 `void import('./core/externalSupplyRegistrar')`（计划书 F10）；`core/scopeFace.ts` 对晚注册字段的承诺（计划书 F11，原文即「现有注释承诺偏大」）。
> **口径纪律：本文及后续文档不得把源码注释当作行为证明。**凡依据来自注释的断言，必须标注为**代码链推导 / 待运行验证**，并以**当前存在**的文件与符号为证据。

另：R6 一并删除 `frontend/vite.preview.config.mjs` 的 `allowSingleColorPalette` /
`sanitizeCollectTemplates`（两者目标串已不存在、且只作用于 collect 分支，实为 no-op），
并把「单色面板」修复归位到现役 `components/inspector/Inspector.tsx`（此前只存在于 dev 中间件
对 Angular 模板的改写里）；`tests/browser-capture-ui-closed-loop.mjs` 的对应守卫由已退役模板
改为 fetch 现役 Inspector.tsx，判据语义不变。

