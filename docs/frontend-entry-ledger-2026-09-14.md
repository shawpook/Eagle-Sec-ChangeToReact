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
| 11 | 文档查看器 | `/src/app/react/viewers/document/index.html` | 同路径（18 个 TS/TSX）| — | iframe 子窗（`core/documentViewer.ts:60`）| 自研渲染 | 已构建 |
| 12 | PDF 查看器 | `/src/app/pdf-viewer/web/viewer.html` | 同路径 | 无（PDF.js）| 查看器子窗 | PDF.js | 已交付（引擎页原样复制）|
| 13 | 3D 查看器 | `/src/app/model-viewer/website/{index,embed}.html` | 同路径 | 无（O3DV）| 主+嵌入入口 | O3DV | 已交付（引擎页原样复制）|
| 14 | 注册 / 设备管理 | `/src/app/{registration,manage-device}.html` | `frontend/public/replaced/*.html` | 无 | 顶层窗口 | — | 中间件直出，未进产物（有意）|
| 15 | thumbnail.html | `/src/app/thumbnail.html` | 同路径 | 无（空壳）| — | — | **R6 已退役**（全仓零引用；产物本就排除 `src/app/*.html`）|
| 16 | 工具/静态页 | `/pages.html`、`/workbench.html`、`/roadmap.html`、`/media-viewer/*`、`/browser-extension/*`、`/vendor/*` | `frontend/public/*` | 无 | — | 随 public 复制；workbench 被 Electron 菜单引用（main.cjs:1705）|
| 17 | 旧指令模板 | — | `src/app/js/directives/*.html`（64 个）| 无 | — | — | **R6 已退役**（连同 controllers/modules 共 186 个文件，见 §8）|

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
  - `src/config.js` 与 `src/i18n` 是关键补充：`appRoot` 为 `/src`，运行时 `require(appRoot + '/config.js')` 取 `EagleConfig`（含 `VIDEO_FORMATS`）。缺这两项时生产态在 `hoverPreview` 初始化处 `EagleConfig.VIDEO_FORMATS.map` 崩溃（R1 冒烟实测定位）。
- 排除：`frontend/public/mock-library`、`mock-assets`（开发/演示数据）在 `closeBundle` 从产物删除。
- 引擎页：`src/app` 内除 10 个 React 页 HTML 外的 `.html`（pdf-viewer、model-viewer、旧指令模板）按原样复制；PDF 与 3D 查看器无 React 入口，作为专用引擎页交付。
- 已知既有源缺陷（源码与产物均缺，dev 同样 404；非 R1 引入）：`icon.svg`、`js/vendors/tippy.js`（preferences / font-viewer）、collect-window 的 `../css/jquery-ui.min.css`（实际在 `collect-window/css/`）与 `js/lib/api/url-enlarger.js`、model-viewer 的 `info/index.html` 与 `../build/o3dv.website.min-dev.js`、pdf-viewer 的 `locale/locale.properties`。**R5/R6 已全部消除**——`tests/dist-entry-check.mjs` 现仅剩 2 条 WARN，均为 `pages.html` 指向有意排除的演示路由（registration / manage-device）。

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
| `js/plugin/**` | 保留 | `require(appRoot+'/app/js/plugin')`（`core/bundleGlobals.ts:1737`、`pluginModule` 供给）|
| `js/plugins/eagle-note-plugin.js` | 保留 | `preview-window/controller.ts:58` 现役 require |
| `js/api-server-v2.js` + `api-v2-playground{,-config}.js` | 保留 | `apiServerDomain.ts:1342` require；playground 经 `api-server-v2.js:117` require |
| `js/utils/{unorm,remainingFilenameLength,getBestURL,is-accelerator,flipImage,rotateImage,downloadFile,ignoreMenuShortcuts,piexif}.js` | 保留 | 各 domain / `plugin/index.js` 现役 require（moduleRegistry 亦登记前六项）|
| `js/utils/{captureHTML,icns2png,magick,qs}.js` | **已删除** | 全仓零 require |
| `js/vendors/{tga,libtga,wavesurfer.min,videojs/**,sweetalert2/sweetalert2.min.css,bignumber}.js` | 保留 | `commentHooks.ts`/`detailHooks.ts`/`preview-window.html` 现役 require、标签或 CSS；bignumber 被生产 vendor `eagle-match-rules.js` 使用 |
| `js/vendors/lodash.js`、`html2canvas.min.js`、`Typr.js`、`colorpicker/**` | **已删除** | 均已退役或零引用（lodash b1-9bc 摘标签、colorpicker b1-9bj 自研化）|
| `js/debug-reporter.js`、`thumbnail.html`、`js/scroll to top button 效能優化.md` | **已删除** | 零引用 |
| `frontend/public/tab-bar.{js,css}` + `tests/tab-bar-closed-loop.mjs` | 保留待定 | 未接入构建链的候选功能（PROGRESS b1-9al 登记为「仅注释残留」）；删除属产品取舍，未在本批处理 |
| `@egjs/react-infinitegrid`（package.json + lockfile）| **已移除** | 全仓零 import；`window.ig` 是主窗自建 v4 facade（`boxGridEngine`），与该包无关（由 `m1-A8-eg-infinitegrid` 断言 `typeof w.ig.getItems === 'function' && !w.eg` 守护）|

另：R6 一并删除 `frontend/vite.preview.config.mjs` 的 `allowSingleColorPalette` /
`sanitizeCollectTemplates`（两者目标串已不存在、且只作用于 collect 分支，实为 no-op），
并把「单色面板」修复归位到现役 `components/inspector/Inspector.tsx`（此前只存在于 dev 中间件
对 Angular 模板的改写里）；`tests/browser-capture-ui-closed-loop.mjs` 的对应守卫由已退役模板
改为 fetch 现役 Inspector.tsx，判据语义不变。

