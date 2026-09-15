# Eagle 前端入口台账（M0 建立，矩阵口径）

建立日期：2026-09-15。建立批次：M0（对应 `docs/plan-2026-09-15-full-workspace-legacy-audit.md` §5 M0「范围台账与可失败的门禁」）。
分支：`shawpook/m0-entry-ledger`，HEAD `e6f6383e`。
本台账是本工作区副本内的**重建**：`docs/frontend-entry-ledger-2026-09-14.md`（R0/R1 建立）保留历史时间语境，其失真条目已在原文件内就地订正，对照见本文 §7。

## 0. 证据口径与已验证边界（先读）

本台账对每条断言给出**证据定位**（`文件:行` 或 `文件:符号`）。证据分三档，行内以标签区分：

- **[码]** 静态证据：源码/配置/清单的直接读取结果。本轮已完成。
- **[推]** 代码链推导：由静态调用链推出、**未运行验证**。
- **[待]** 待运行验证：需要构造运行环境才能确认的项。

**本轮基线事实（必须先声明，否则下述「产物」类结论会被误读）：**

1. 本工作区副本**不存在 `dist/` 目录**（`ls dist` → No such file or directory）。因此所有「产物路径 / 产物内容」结论均为**构建规则推导 [推]**，不是对已存在产物的观测。
2. 本轮**未执行** `npm run build`、`npm run test:acceptance`、`npm run test:production`，**未启动** Electron 或浏览器 UI。
3. 本台账的路径口径为**工作区根相对路径**。历史文档中的工作区根为 `H:/dev/Eagle-Sec-development - 副本`；本副本的根为 `C:/Users/Administrator/orca/workspaces/Eagle-Sec-development - 副本/m0-entry-ledger`。**两者路径不同但相对结构一致**，凡涉及「工作区外目录」的结论（§4.6、§5.6）按相对表达式给出，不按绝对盘符。
4. 审计计划书的基线是 `d82ab6d7`，其 §6 实测数据（如 `dist-entry-check` 的 `FAIL 0 / WARN 2`）**早于**本 HEAD 的 `00352c1f`（M0 门禁闭包批次）。凡计划书结论已被 `00352c1f` 覆盖的，本台账按**当前代码**登记并显式标注（见 §6）。

### 判定标签（取自计划书 §1.2，逐字沿用）

| 标签 | 含义 |
|---|---|
| **活跃** | 当前入口/消费者可追踪到该代码；不等于所有分支已在本轮动态执行。 |
| **条件活跃** | 只有某功能、运行模式或插件类型才进入。 |
| **图外执行** | 有运行消费者，但不走现有 Vite 静态依赖和 TypeScript 检查。 |
| **被截获** | 源码中有 require，实际解析为 shim 替身，磁盘原模块并未由该链执行。 |
| **闲置但交付** | 没有发现现役加载入口，构建却仍复制。 |
| **保留引擎** | 独立第三方算法/渲染器，不应为追求「全部 React」重写。 |

单一入口可同时命中多个标签（例如「被截获」+「闲置但交付」），此时全部列出并标注主次。

---

## 1. 入口矩阵

列名与该行断言的证据，按计划书 M0「为每个实际入口登记 owner、运行环境、源码、对外 URL、加载方式、构建/复制规则、必需能力、类型配置、测试」逐项对齐。**证据**列给出该行可核对的符号/行号；行号是**建立时定位**，后续改动会漂移，复核请以符号名二次定位。

运行环境取值：`browser-dev` / `browser-prod` / `electron-dev` / `electron-prod` / `extension` / `plugin-host` / `worker`。

### 1.1 React 多页构建入口（11 个）

| 入口名 | owner | 运行环境 | 源码位置 | 对外 URL | 加载方式 | 构建或复制规则 | 必需能力 | 类型配置 | 现有测试 | 判定标签 | 证据 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **主窗** | `react/main.tsx` | browser-dev / browser-prod / electron-dev / electron-prod | `src/app/index.html` | `/src/app/index.html`（dev `http://localhost:5176/…`；prod `http://127.0.0.1:4173/…`） | ESM 单入口 + **模块内文本 script 执行** | `rollupOptions.input.index` → `dist/frontend/src/app/index.html`；`transformIndexHtml` 补 API/扩展基址 | `__EAGLE_API_BASE_URL`、`__EAGLE_EXTENSION_BASE_URL`；`/src/config.js`、`/src/i18n`（运行时 require）；`/vendor/eagle-match-rules.js`、`/vendor/eagle-zoom-helpers.js` | `tsconfig.json:21-26` include `src/app/react/**`，受检 | `REQUIRED_TESTS` 24 项主体 + `tests/dist-entry-check.mjs` + `tests/production-smoke.mjs` + `screenshot-regression` 的 `main` 项 | **活跃**；其中 vendor 两条为 **活跃 + 图外执行** | `src/app/index.html:254`；`vite.preview.config.mjs:289`；`core/bundleGlobals.ts:1669-1674、1700-1705、2270`；`scripts/start-production.mjs:52` |
| **偏好窗** | `react/preferences/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/preferences.html` | `/src/app/preferences.html` | ESM | `rollupOptions.input.preferences` → 同相对路径 | `window.__EAGLE_API_BASE_URL`；`tippyLite`；`ShortcutManager` | include 覆盖，受检 | `screenshot-regression` 的 `preferences` 项 | **活跃** | `src/app/preferences.html:23`；`vite.preview.config.mjs:290`；`electron/main.cjs:712-714`；`core/tippyLite.ts` |
| **预览窗** | `react/preview-window/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/preview-window.html` | `/src/app/preview-window.html`（`originalPreviewUrl()` 由主窗 URL 派生） | **三段加载**：内联经典 script（`require` boot）→ 经典 script（`js/global.js`、`js/devices.js`、video.js×5）→ ESM 入口 | `rollupOptions.input['preview-window']` → 同相对路径 | `appRoot='/src'` 与 `/src/config.js` 须在经典段之前可用；`js/vendors/videojs/**`；`js/plugins/eagle-note-plugin.js` | include 覆盖入口；**前置经典段不在类型边界内** | `tests/preview-entry-subscriptions.mjs`；`tests/native-preview-closed-loop.mjs`；`screenshot-regression` 经主窗间接覆盖 | **活跃**；启动顺序风险为 **[推]** 未运行验证 | `src/app/preview-window.html:12、20、46-58、83`；`electron/main.cjs:703-705`；`vite.preview.config.mjs:291` |
| **采集窗** | `react/collect-window/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/collect-window/index.html` | `/src/app/collect-window/index.html` | ESM + 3 个经典 script（`chinese_convert.js`、`pinyinlite.js`、`tiny-pinyin.js`） | `rollupOptions.input['collect-window']` → 同相对路径 | 自研 `makeDraggable`/`makeResizable`；自研 dialog；`swal2-*` **CSS 类名契约**（非 SweetAlert JS）；简繁/拼音三库 | include 覆盖入口；三个经典库按引擎登记 | `screenshot-regression` 的 `collect` 项；`tests/browser-capture-ui-closed-loop.mjs`（Inspector 侧） | **活跃**；jQuery / jQuery UI / SweetAlert JS 已退役，仅 CSS 契约保留 | `src/app/collect-window/index.html:8-13、23、27-29`；`react/collect-window/tagPanel.tsx:15、28`；`react/collect-window/contextMenu.tsx:393`；`react/collect-window/entry.tsx:13-14`；`react/components/interactions/draggable.ts:1-12` |
| **EXIF 查看器** | `react/viewers/exif/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/exif-viewer/index.html` | `/src/app/exif-viewer/index.html?path=…&width=…` | ESM | `rollupOptions.input['exif-viewer']` → 同相对路径 | 后端 EXIF 供给 | include 覆盖，受检 | `screenshot-regression` 的 `exif` 项 | **活跃** | `src/app/exif-viewer/index.html:78`；`vite.preview.config.mjs:293` |
| **RAW 查看器** | `react/viewers/raw/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/raw-viewer/index.html` | `/src/app/raw-viewer/index.html?path=…` | 经典 script（`dcraw.js`）→ ESM | 同相对路径；`dcraw.js` 由 `src/my_modules` 整树复制交付 | `src/my_modules/raw-parser/dcraw.js` | include 覆盖入口；dcraw 为引擎，不在类型边界内 | `screenshot-regression` 的 `raw` 项 | **活跃 + 保留引擎** | `src/app/raw-viewer/index.html:8、76`；`vite.preview.config.mjs:294、225` |
| **Native 查看器** | `react/viewers/native/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/native-viewer/index.html` | `/src/app/native-viewer/index.html?path=…` | ESM | `rollupOptions.input['native-viewer']` → 同相对路径 | 后端 `nativePreview`；PDF.js worker | include 覆盖，受检 | `tests/native-preview-closed-loop.mjs`；`screenshot-regression` 的 `native` 项（断言 `body.classList.contains('ready')`） | **活跃** | `src/app/native-viewer/index.html:128` |
| **GIF 查看器** | `react/viewers/gif/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/gif-viewer/index.html` | `/src/app/gif-viewer/index.html?path=…&render=…` | 经典 script（`./gif-player.js`）→ ESM | `rollupOptions.input['gif-viewer']` → 同相对路径 | `window.SuperGif`（`gif-player.js`） | include 覆盖入口；`gif-player.js` 为引擎 | `screenshot-regression` 的 `gif` 项 | **活跃 + 保留引擎**；React glue 生命周期缺口见计划书 F14 **[推]** | `src/app/gif-viewer/index.html:8、165`；`core/itemDomain.ts:863` |
| **文本编辑** | `react/viewers/text-editor/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/text-editor/text-editor.html` | `/src/app/text-editor/text-editor.html?id=…&theme=…` | ESM | `rollupOptions.input['text-editor']` → 同相对路径 | 原生 `contenteditable`；`fs-extra` 写回（经 shim 桥） | include 覆盖，受检 | `tests/txt-update-closed-loop.mjs`；`screenshot-regression` 的 `text-editor` 项 | **活跃** | `src/app/text-editor/text-editor.html:15`；`core/itemDomain.ts:945` |
| **字体查看器** | `react/viewers/font/entry.tsx` | browser-dev / electron-dev / electron-prod | `src/app/font-viewer/font-viewer.html` | `/src/app/font-viewer/font-viewer.html` | 经典 script（`medium-editor.min.js`）→ ESM | `rollupOptions.input['font-viewer']` → 同相对路径 | `MediumEditor`；父窗动作 `imagesChange` / `removeStar` / `changeTo*Star`（供给缺口见计划书 F08）**[推]** | include 覆盖入口；MediumEditor 为引擎 | `screenshot-regression` 的 `font` 项 | **活跃 + 保留引擎**；动作契约不闭合为 **[推]** 静态缺项 | `src/app/font-viewer/font-viewer.html:23-24`；`viewers/font/entry.tsx:301-302、353-358`；`core/driverApi.ts:39-45` |
| **文档查看器** | `react/viewers/document/src/main.tsx` | browser-dev / electron-dev / electron-prod | `src/app/react/viewers/document/index.html` | `/src/app/react/viewers/document/index.html` | ESM | `rollupOptions.input['document-viewer']`；HTML 因属 `REACT_PAGE_ENTRIES` **被排除**于 `src/app` 复制 | `__EAGLE_API_BASE_URL` + `__EAGLE_THUMBNAIL_URL`（`injectViewerConfig` 注入面） | include 覆盖，受检 | `tests/document-viewer-ui-closed-loop.mjs`、`tests/document-viewer-api-smoke.mjs`；`electron/main.cjs:2398-2400` 的 URL 断言 | **活跃** | `vite.preview.config.mjs:13、53-58、160-166、287`；`core/documentViewer.ts:60`；`electron/main.cjs:2398-2400` |

> 11 个入口的 `rollupOptions.input` 见 `vite.preview.config.mjs:284-300`；`REACT_PAGE_ENTRIES` 清单见 `tests/frontend-gate-manifest.mjs:2-14`。
> 「受检」指 `tsconfig.json:21-26` 的 include 覆盖该文件；`.html` 本身从不进入 tsc 语义检查，只能进入图外脚本/内联脚本的**登记与指令扫描**（`tests/typecheck.mjs:98-114`）。

### 1.2 专用引擎页（无 React 入口，随 `src/app` 复制交付）

| 入口名 | owner | 运行环境 | 源码位置 | 对外 URL | 加载方式 | 构建或复制规则 | 必需能力 | 类型配置 | 现有测试 | 判定标签 | 证据 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **PDF.js 页** | PDF.js（第三方） | browser-dev / browser-prod / electron-dev / electron-prod | `src/app/pdf-viewer/web/viewer.html` | `/src/app/pdf-viewer/web/viewer.html?path=…` | 引擎自持（经典 + ESM worker） | **不在 `rollupOptions.input`**；由 `copyTree` 按「非 React 页 HTML 原样复制」交付到 `dist/frontend/src/app/pdf-viewer/web/viewer.html` | `src/app/pdf-viewer/**` 整子树（含 locale/资源）；`/file` 缩略图代理 | **不在类型边界内**（登记于 `STATIC_PAGES`，仅资源存在性） | `screenshot-regression` 的 `pdf` 项（`.pdfViewer .page`） | **保留引擎** | `tests/frontend-gate-manifest.mjs:20-22`；`vite.preview.config.mjs:232-239`；`screenshot-regression.mjs:80` |
| **O3DV 页（标准）** | O3DV（第三方） | browser-dev / electron-dev / electron-prod | `src/app/model-viewer/website/index.html` | `/src/app/model-viewer/website/index.html#model=…` | 引擎自持（经典） | 同 PDF：非 React HTML，原样复制 | `model-viewer/website/**`（含 `build/o3dv.website.min-dev.js`）、`info/index.html` | **不在类型边界内** | `screenshot-regression` 的 `model` 项（`#main_file_name`） | **保留引擎**；**条件活跃**（仅 3D 模型条目进入） | `tests/frontend-gate-manifest.mjs:22`；`screenshot-regression.mjs:79`；`src/app/model-viewer/website/index.html:103`（R7 已加 `frameElement` 判空） |
| **O3DV 页（嵌入）** | O3DV（第三方） | browser-dev / electron-dev / electron-prod | `src/app/model-viewer/website/embed.html` | `/src/app/model-viewer/website/embed.html` | 引擎自持 | 同上 | 同上 | **不在类型边界内** | **无独立行为测试**（仅在 `STATIC_PAGES` 登记） | **保留引擎 + 闲置但交付**（本轮未找到现役 iframe 加载点）**[推]** | `tests/frontend-gate-manifest.mjs:22` |

### 1.3 `frontend/public` 外围页与扩展（publicDir 整目录复制）

| 入口名 | owner | 运行环境 | 源码位置 | 对外 URL | 加载方式 | 构建或复制规则 | 必需能力 | 类型配置 | 现有测试 | 判定标签 | 证据 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **pages.html（导航页）** | 无专属 owner（静态导航） | browser-dev / browser-prod | `frontend/public/pages.html` | `/pages.html` | 无脚本（纯导航） | **例外**：在 `rollupOptions.input.pages` 中，由 Vite 产出；同时也在 `frontend/public` 内 | 无 | HTML 级登记（`tests/typecheck.mjs:103-105` 要求外围 HTML 全部登记） | 无独立行为测试 | **活跃**（导航入口）；其中 2 条链接指向生产无映射的 URL，见 §4.2 | `vite.preview.config.mjs:286`；`frontend/public/pages.html:56-72`；`tests/frontend-gate-manifest.mjs:17` |
| **workbench.html（工作台）** | 内联脚本（无模块化 owner） | browser-dev / browser-prod / electron-dev / electron-prod | `frontend/public/workbench.html` | `/workbench.html` | 内联经典 script | publicDir 整目录复制 → `dist/frontend/workbench.html` | `window.__EAGLE_API_BASE_URL`（R7 起，兜底 `127.0.0.1:41695`）；后端 `/api/**` | **第一方图外脚本，无 tsc 语义**（登记于 `FIRST_PARTY_SCRIPTS` 之外的 HTML 内联面） | `tests/workbench-interactions.mjs`、`tests/workbench-upload.mjs`（经 `test:workbench` / 附着式 runner）；`screenshot-regression` 的 `workbench` 项 | **活跃**（Electron 菜单可达）；媒体路径拼接 `mock-library` 为 **[推]** 静态缺陷 | `frontend/public/workbench.html:397`；`electron/main.cjs:1690、1705`；`workbench.html:442-445、435-458` |
| **roadmap.html（路线图面板）** | 内联脚本（无模块化 owner） | browser-dev / browser-prod | `frontend/public/roadmap.html` | `/roadmap.html` | 内联经典 script | publicDir 整目录复制 | **只读 `?api=` 查询参数**，不读 `window.__EAGLE_API_BASE_URL` | 第一方图外脚本，无 tsc 语义 | `tests/roadmap-panels.mjs`（经 `test:isolated`/附着式）；`screenshot-regression` 的 `roadmap` 项 | **活跃 + 图外执行**；配置口径与其余页不一致 | `frontend/public/roadmap.html:464-489`、`:191-192` |
| **media-viewer/audio.html** | 内联脚本 | browser-dev / browser-prod | `frontend/public/media-viewer/audio.html` | `/media-viewer/audio.html?path=…` | 内联经典 script | publicDir 整目录复制 | 后端 `/file/…` 媒体代理 | 第一方图外脚本，无 tsc 语义 | `screenshot-regression` 的 `audio` 项；`tests/search-media.mjs` | **活跃**（由 workbench 打开） | `frontend/public/workbench.html:445`；`screenshot-regression.mjs:83` |
| **media-viewer/video.html** | 内联脚本 | browser-dev / browser-prod | `frontend/public/media-viewer/video.html` | `/media-viewer/video.html?path=…` | 内联经典 script | publicDir 整目录复制 | 后端 `/file/…` 媒体代理 | 第一方图外脚本，无 tsc 语义 | `screenshot-regression` 的 `video` 项 | **活跃**（由 workbench 打开） | `frontend/public/workbench.html:442`；`screenshot-regression.mjs:82` |
| **replaced/registration.html（注册/许可）** | 无（静态展示页） | browser-dev | `frontend/public/replaced/registration.html` | 产物 URL：`/replaced/registration.html`；**导航指向**：`/src/app/registration.html` | 无脚本 | publicDir 整目录复制 → `dist/frontend/replaced/registration.html` | 无 | HTML 级登记 | 无行为测试；仅 `STATIC_PAGES` 资源存在性 | **闲置但交付**；旧 URL 在 dev 有映射、在 prod 无映射（§4.2） | `vite.preview.config.mjs:87-89、145-149`；`tests/frontend-gate-manifest.mjs:20`；`frontend/public/pages.html:62` |
| **replaced/manage-device.html（设备管理）** | 无（静态展示页） | browser-dev | `frontend/public/replaced/manage-device.html` | 产物 URL：`/replaced/manage-device.html`；**导航指向**：`/src/app/manage-device.html` | 无脚本 | 同 registration | 无 | HTML 级登记 | 无行为测试 | **闲置但交付**；同上 | `vite.preview.config.mjs:150-154`；`frontend/public/pages.html:63` |
| **扩展 popup** | `browser-extension/popup.js` | extension | `frontend/public/browser-extension/popup.html` | `chrome-extension://<id>/popup.html`（manifest `action.default_popup`） | 经典 script（`popup.js`） | publicDir 复制；`manifest.json` 由 `extensionManifests` 在产物检查中校验 **MV3** | `chrome.tabs`/`chrome.scripting`；`host_permissions` 仅 `localhost:41593`、`41595` | JS 在 `FIRST_PARTY_SCRIPTS` 登记，**无 tsc 语义** | `tests/browser-extension.mjs`、`tests/screenshot-regression.mjs:90`（**普通 HTTP 打开，非扩展环境**）、`tests/browser-capture-electron-extension-e2e.mjs`（**MV2 fixture，非交付对象**） | **活跃 + 图外执行**；真实 MV3 端到端未做 | `frontend/public/browser-extension/manifest.json:16-34`；`popup.js:14`（硬编码 5176 工作台）；`tests/dist-entry-check.mjs:181` |
| **扩展 background** | `browser-extension/background.js` | extension（MV3 service worker） | `frontend/public/browser-extension/background.js` | 由 manifest `background.service_worker` 注册 | 经典 script（service worker） | 同上 | 固定端口 `http://localhost:41593`（`background.js:1`） | `FIRST_PARTY_SCRIPTS` 登记，无 tsc 语义 | 同上（无真实 MV3 装载） | **活跃 + 图外执行**；端口硬编码与 `EAGLE_EXTENSION_PORT` 可配性冲突 **[码]** | `background.js:1`；`backend/src/server.js:3421-3424`（41593 仅在未设环境端口时启动） |
| **扩展 content** | `browser-extension/content.js` | extension（content script） | `frontend/public/browser-extension/content.js` | `<all_urls>`，`document_idle` 注入 | 经典 script | 同上 | `chrome.runtime.onMessage` 双向消息 | `FIRST_PARTY_SCRIPTS` 登记，无 tsc 语义 | 同上 | **活跃 + 图外执行** | `manifest.json:26-34`；`content.js:1-20` |

> `frontend/public/tab-bar.{js,css}` **不在此表**，因为它没有加载点；单列于 §1.5。
> `mock-library` / `mock-assets` 在 `closeBundle` 从产物删除（`vite.preview.config.mjs:261-263`），故依赖它们的外围页测试全部是 **dev-stack** 测试。

### 1.4 后端 / 主进程供给的入口

| 入口名 | owner | 运行环境 | 源码位置 | 对外 URL | 加载方式 | 构建或复制规则 | 必需能力 | 类型配置 | 现有测试 | 判定标签 | 证据 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **插件示例页（service 插件 UI）** | `backend/src/server.js`（供给方） | plugin-host（Electron 插件窗） | `tests/fixtures/plugins/example-service-plugin/index.html` + `js/plugin.js` | `/plugins/eagle-reverse-example-service/index.html` | 经典 script（`js/plugin.js`）+ **后端注入的 `/plugin-shim.js`** | **不进 `dist/frontend`**；由后端从 `tests/fixtures/plugins` 读取。`DIST_POLICY.pluginManifests` 为空数组，检查器不伪装它已进产物 | `window.eagle` 生命周期面（`onPluginCreate/Run/Show/Hide/BeforeExit`）；插件侧 `require` | **不在任何类型配置内** | `tests/plugin-smoke.mjs`、`tests/plugin-package.mjs`；`electron/main.cjs:3531-3542` 的 `typeof window.eagle !== 'undefined'` 断言 | **条件活跃**；**加载顺序缺陷 [推] 未运行验证**（见下） | `backend/src/server.js:114-135`；`server.js:97-111`（shim 定义）；`tests/fixtures/plugins/example-service-plugin/index.html:6-7`；`tests/frontend-gate-manifest.mjs:41-43` |
| **插件模板页** | `backend/src/server.js` | plugin-host / browser | 工作区外：`<programRoot>/resources/plugin_templates`（`programRoot = workspaceRoot/../..`，`server.js:78`） | `/plugin-templates/**` | 经典 script + 同一 `plugin-shim.js` 注入 | 不进产物；从工作区外目录读取 | 同插件示例页 | 不在类型配置内 | 无（目录在本副本中不存在，见 §6） | **闲置但交付**（本轮该目录缺失）**[码]** | `backend/src/server.js:78、128-132`；`electron/main.cjs:1712-1720`（service 插件根为 `__dirname/../../plugins`，同样落在工作区外） |
| **后台 PDF/video 缩略图 Worker** | `backend/src/thumbnail-task-service.js` | worker（Node `child_process.fork`） | `electron/pdf-thumbnail-worker.cjs`、`electron/video-thumbnail-worker.cjs` | 无对外 URL（进程间） | `fork()` 子进程，非浏览器 Worker | 不属于前端产物；由后端任务服务拉起 | Electron 可执行文件；`EAGLE_THUMBNAIL_PORT` 服务面 | **不在前端类型配置内**（`tsconfig.json:26` exclude `backend`、`tests`） | `tests/thumbnail-task-closed-loop.mjs`、`tests/video-thumbnail-closed-loop.mjs`、`tests/office-thumbnail-closed-loop.mjs` | **活跃**；属明确保留对象（计划书 §4） | `backend/src/thumbnail-task-service.js:4、18-19、185-255`；`tests/frontend-gate-manifest.mjs:94-99` |

**插件示例页加载顺序（[推]，未运行验证）：** `server.js:120` 把 `<script src="/plugin-shim.js">` 插在 `</head>` **之前**，而 `index.html:6` 的 `js/plugin.js` 本身就在 `</head>` 之前 ⇒ shim 在该页**后于**业务脚本执行。且 `plugin.js:1-3` 以 `require('fs'/'path'/'os')` 起步、`plugin.js:14` 顶层调用 `eagle.onPluginCreate(…)`。两者叠加说明：该 fixture 在普通浏览器中不成立，在 Electron 插件窗中是否成立取决于渲染进程的 `require` 与注入时序。**`electron/main.cjs:3531` 仅断言 `typeof window.eagle`，不能证明前面的业务脚本成功执行**（计划书 F19 同判断）。

### 1.5 图外 Worker 与无加载点的自有脚本

| 入口名 | owner | 运行环境 | 源码位置 | 对外 URL | 加载方式 | 构建或复制规则 | 必需能力 | 类型配置 | 现有测试 | 判定标签 | 证据 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **bitmapWorker** | `core/bitmapViewer.ts` | browser / electron（Worker 上下文） | `src/app/js/workers/bitmapWorker.js` | 相对页面 `js/workers/bitmapWorker.js` | `new Worker(...)` 经典 Worker + `importScripts` | `src/app` 复制不排除 `.js` ⇒ 随产物交付；在 `DYNAMIC_ASSETS` 显式登记 | `./libheif.js`、`./heic2bitmap-worker.js`、`../../../my_modules/utif/UTIF.js`、`UDOC.js` | **不在 tsc 边界内**（登记于 `FIRST_PARTY_SCRIPTS`） | 经 HEIF/TIFF 业务用例间接覆盖；`tests/frontend-gate-manifest.mjs:29-34` 资源登记 | **活跃 + 图外执行** | `core/bitmapViewer.ts:220、311`；`js/workers/bitmapWorker.js:394、397、457、459` |
| **heic2bitmap-worker** | `bitmapWorker.js` | worker | `src/app/js/workers/heic2bitmap-worker.js` | `./heic2bitmap-worker.js` | 由 `bitmapWorker` `importScripts` | 同上 | `libheif.js` + `libheif.wasm` | 不在 tsc 边界内 | 资源登记 | **活跃 + 图外执行** | `js/workers/bitmapWorker.js:397`；`tests/frontend-gate-manifest.mjs:32-33` |
| **calHammingDistance** | `core/eagleClasses.ts` | worker | `src/app/js/workers/calHammingDistance.js` | `js/workers/calHammingDistance.js` | `new Worker(...)` | 同上 | 无外部依赖 | 不在 tsc 边界内 | 经相似图搜索用例间接覆盖 | **活跃 + 图外执行** | `core/eagleClasses.ts:763`；`tests/frontend-gate-manifest.mjs:30` |
| **tifWorker** | `components/detail/commentHooks.ts` | worker | `src/app/js/workers/tifWorker.js` | `js/workers/tifWorker.js` | `new Worker(...)` | 同上 | UTIF | 不在 tsc 边界内 | 经注释/详情用例间接覆盖 | **活跃 + 图外执行** | `components/detail/commentHooks.ts:1112`；`tests/frontend-gate-manifest.mjs:29` |
| **tab-bar.js** | 无（候选功能，PROGRESS b1-9al） | **无运行环境** | `frontend/public/tab-bar.js`（+ `tab-bar.css`） | 产物 URL `/tab-bar.js`、`/tab-bar.css` 可直达，但无页面引用 | 若被加载则为经典 script | publicDir 整目录复制；**不在任何 `rollupOptions.input`** | `window.angular`（`tab-bar.js:68、73` 真实 Angular 调用） | 登记于 `FIRST_PARTY_SCRIPTS`（`frontend-gate-manifest.mjs:58`），**无 tsc 语义** | `tests/tab-bar-closed-loop.mjs` 存在，但**未在 `package.json`、`run-react-suite`、`run-attached-nonsuite` 或验收套件中登记**，是孤儿测试；且其断言要求主窗出现 `#eagle-tab-bar`，而现树无加载点 **[推] 当前可否通过未运行验证** | **闲置但交付**（主标签）；JS 内确有真实 Angular 调用 ⇒ **不能记为「仅注释残留」** | `frontend/public/tab-bar.js:68、73`；`tests/frontend-gate-manifest.mjs:58`；`tests/tab-bar-closed-loop.mjs:217-226`；全仓 HTML 无 `tab-bar` 引用 |
| **`src/app/js/**` 旧业务模块**（plugin/、api-server-v2.js、utils/*、services/url-state-service.js 等） | 见 §1.6 | 无（require 被截获） | `src/app/js/**` | 产物 URL 可直达 | **require 截获**（`moduleRegistry.requireModule`） | `src/app` 复制不排除 `.js` ⇒ **随产物交付** | — | 不在 tsc 边界内；登记于 `FIRST_PARTY_SCRIPTS` | 名称边界 `tests/shim-module-boundaries.mjs` | **被截获 + 闲置但交付**（详见 §4.3） | `core/shim/moduleRegistry.ts:71-128`；`tests/frontend-gate-manifest.mjs:60-79` |

---

## 2. 加载方式与截获面（机制说明）

| 机制 | 含义 | 现役位置 | 证据 |
|---|---|---|---|
| **ESM 模块入口** | `<script type="module" src="/src/app/react/…">`，Vite 负责解析与打包 | 11 个 React 页 | 各页 HTML 的 module 脚本标签；`vite.preview.config.mjs:284-300` |
| **经典 script（页面级）** | `<script src="…">`，先于模块入口执行 | 预览窗 `global.js`/`devices.js`/video.js；采集窗三个拼音/简繁库；RAW 的 dcraw；GIF 的 gif-player；字体查看器的 MediumEditor | 各页 HTML 的 script 标签（见 §1.1 各行） |
| **文本 script 执行（fetch + `textContent`）** | 取回 JS 文本后用 `document.createElement('script')` + `textContent` 执行 | `bundleGlobals.ts` 三条：match-rules、zoom-helpers、另一处（`:2270`） | `core/bundleGlobals.ts:1669-1674、1700-1705、2270` |
| **require 截获** | 渲染层 `require()` 由 `moduleRegistry.requireModule` 按字符串路径返回**替身/空实现**，磁盘原模块不被该链执行 | `/app/js/plugin` → `pluginModule`；`/app/js/api-server-v2` → `{ initAPIServerV2() {} }`；`eagle-note-plugin` → `{}`；`utils/{flipImage,rotateImage}` → `() => {}`；`remainingFilenameLength` → `() => 240`；`getBestURL` → `() => ''`；`is-accelerator` → `() => true`；`unorm` → `{nfc:identity,nfd:identity}`；未命中路径回落 `genericStub` | `core/shim/moduleRegistry.ts:71-128`（具体分支 `:83、:84、:85、:102-107`；`genericStub` 回落 `:128`） |
| **worker importScripts** | Worker 内部同步加载脚本 | `bitmapWorker.js` 加载 libheif/heic2bitmap/UTIF | `js/workers/bitmapWorker.js:394、397、457、459` |

> **插桩说明**：`tests/frontend-gate-manifest.mjs` 的 `SCRIPT_INVENTORY_ROOTS`/`FIRST_PARTY_SCRIPTS`/`ENGINE_SCRIPTS` 是本台账 §1.5 与外围行的分类依据；三者已在 `00352c1f` 入库。`tests/typecheck.mjs:98-114` 对这两类脚本做**登记与注释指令扫描**，不做 tsc 语义检查。

---

## 3. 类型配置边界（逐入口）

| 类型边界 | 覆盖入口 | 不覆盖入口 | 证据 |
|---|---|---|---|
| `tsconfig.json` include（React 子树） | §1.1 全部 11 个入口的业务 TS/TSX | `.html` 本身；§1.2 引擎页；§1.3 全部外围内联脚本与扩展 JS；§1.5 全部 Worker 与 tab-bar | `tsconfig.json:21-26`（include `src/app/react`，exclude `node_modules/dist/backend/tests`） |
| 整文件 `@ts-nocheck` 免检（8 个 shim） | — | `core/shim/{browserRuntime,demoSeed,desktopCapability,environment,install,ipcBus,moduleRegistry,settingsI18n}.ts` 共 8 个文件**不被语义检查**；计划书实测撤销后为 **460 条诊断** | `tests/typecheck.mjs:15-23`；计划书 §3.4 F21 表 |
| 图外脚本登记（无 tsc 语义） | `SCRIPT_INVENTORY_ROOTS = ['frontend/public', 'src/app/js']` 下全部自有 JS | 语义正确性 | `tests/frontend-gate-manifest.mjs:53-54、54-77`；`tests/typecheck.mjs:139` |
| 外围 HTML 登记 | `frontend/public/**/*.html` 必须登记，含内联运行脚本 | 语义正确性 | `tests/typecheck.mjs:103-105、113-114` |

**结论（[码]）**：M0 台账要求的「类型配置」列，对 11 个 React 入口答案是「tsconfig 受检」；对其余全部入口答案是「**仅登记/扫描，无 tsc 语义**」。这两者不可混记为「有类型配置」。

---

## 4. F26 六处失真：原表述 → 现口径

本节逐条落实计划书 §3.4 F26。每条的「订正后表述」与 `docs/frontend-entry-ledger-2026-09-14.md` 内部已就地写入的订正一致（该文件保留原日期与原始表述的可追溯性）。

### 4.1 采集窗仍列 jQuery / jQuery UI / SweetAlert

- **原表述（`frontend-entry-ledger-2026-09-14.md:24`）**：采集窗口「专用引擎」列写 `jQuery / jQuery UI / SweetAlert / CollectItem`。
- **订正后表述（[码]）**：采集窗的 **JS 框架已退役**，现状为自研交互层：
  - 拖拽/缩放：自研 `makeDraggable`（`react/components/interactions/draggable.ts` 头注释「D-2f：自研 draggable（替代 jQuery UI `.draggable()`）」，向回调合成 `ui.helper` 以兼容既有回调解构），消费点 `react/collect-window/tagPanel.tsx:15、28、43`。
  - 排序：`react/collect-window/contextMenu.tsx:393`「D-2f：jQuery-UI sortable → 自研」。
  - 弹窗：`react/collect-window/entry.tsx:13-14` 记 `js/vendors/sweetalert2.all.min.js` 退役，唯一消费点改为自研。
  - `$(document).ready` → 原生实现：`react/collect-window/api/env.ts:302`。
  - **保留的是 CSS 类名契约而非 JS 框架**：`src/app/collect-window/index.html:10-13` 显式说明 `sweetalert2.min.css` 保留只为 `.swal2-*` 类名契约样式；`:8-9` 记 jQuery UI CSS 链接退役。
  - **仍需登记的真实经典脚本**：该页仍有 3 个非 React 经典 script（`chinese_convert.js`、`pinyinlite.js`、`tiny-pinyin.js`，`index.html:27-29`），它们是引擎而非框架，不能与「jQuery 退役」合并叙述。
- **订正要点**：**CSS 保留不等于 JS 框架活跃。** 采集窗的「专用引擎」列应写「自研 draggable/resizable、自研 dialog、简繁/拼音三引擎」；jQuery/jQuery UI/SweetAlert 三者只作为**已退役**出现在历史语境里。

### 4.2 「注册/设备页未进产物」

- **原表述（`:34`）**：注册 / 设备管理「中间件直出，**未进产物**（有意）」。
- **订正后表述（[码] + [推]）**：这是**两个被合并的概念**，须拆开：
  1. **原文件确实进产物**：`frontend/public/replaced/{registration,manage-device}.html` 随 `publicDir` 整目录复制，落到 `dist/frontend/replaced/*.html`（[推]，因为本副本无 `dist/`；依据 `vite.preview.config.mjs:111 publicDir = frontendPublic` 与 `:261-263` 只删 `mock-library`/`mock-assets`）。`tests/frontend-gate-manifest.mjs:20` 也把 `replaced/registration.html`、`replaced/manage-device.html` 列入 `STATIC_PAGES`，即**产物检查期望它们存在**。
  2. **旧 URL 在生产态缺映射**：产品导航 `frontend/public/pages.html:62-63` 指向 `/src/app/registration.html` 与 `/src/app/manage-device.html`。这两个 URL 只有 **dev 中间件**直出（`vite.preview.config.mjs:145-154` 的 `readReplacement()`），生产静态服务 `scripts/serve-frontend.mjs` 只做 `path.join(root, url)` 文件查找，**不会**把 `/src/app/registration.html` 映射到 `/replaced/registration.html`。
- **订正要点**：应表述为「**replacement 原文件存在于产物（`/replaced/*.html`），但旧 URL `/src/app/{registration,manage-device}.html` 仅 dev 有映射、生产无映射**」。原句把「产物缺失」与「URL 映射缺失」压成一句，会误导读者以为文件没交付。

### 4.3 把「有 require 文本」当作旧插件/API/utils 实际执行

- **原表述（`:129-132`）**：
  - `js/plugin/**` 保留 —— 理由写 `require(appRoot+'/app/js/plugin')`（`core/bundleGlobals.ts:1737`、`pluginModule` 供给）；
  - `js/plugins/eagle-note-plugin.js` —— 「`preview-window/controller.ts:58` 现役 require」；
  - `js/api-server-v2.js` + playground —— 「`apiServerDomain.ts:1342` require」；
  - `js/utils/{unorm,remainingFilenameLength,getBestURL,is-accelerator,flipImage,rotateImage,downloadFile,ignoreMenuShortcuts,piexif}.js` —— 「各 domain / `plugin/index.js` **现役 require**」。
- **订正后表述（[码]）**：这些 require 的**解析结果**是 `moduleRegistry` 的替身，不是磁盘原模块。逐条：

  | 路径 | require 的实际解析结果 | 证据 |
  |---|---|---|
  | `/app/js/plugin` | `pluginModule`（shim 内构造的替身对象） | `core/shim/moduleRegistry.ts:84`；`pluginModule` 定义于 `core/shim/browserRuntime.ts:387` |
  | `/app/js/plugins/eagle-note-plugin` | `{}`（空对象） | `moduleRegistry.ts:85` |
  | `/app/js/api-server-v2` | `{ initAPIServerV2() {} }`（空实现） | `moduleRegistry.ts:83` |
  | `utils/flipImage.js`、`utils/rotateImage.js` | `() => {}`（空函数，无 demo-only 限制） | `moduleRegistry.ts:106-107` |
  | `utils/remainingFilenameLength.js` | `() => 240` | `moduleRegistry.ts:102` |
  | `utils/getBestURL.js` | `() => ''` | `moduleRegistry.ts:103` |
  | `utils/is-accelerator.js` | `() => true` | `moduleRegistry.ts:104` |
  | `utils/unorm.js` | `{ nfc: identity, nfd: identity }` | `moduleRegistry.ts:105` |
  | 未命中上述任一路径 | `genericStub(req)` 万能对象 | `moduleRegistry.ts:128` |

  **且这些 `.js` 仍随产物交付**：`src/app` 的复制 filter（`vite.preview.config.mjs:232-239`）只排除 `react/` 与命中的 React 页 `.html`，不排除 `.js`。
- **订正要点**：处置列应从「现役 require」改为 **「被截获（require 解析为替身）+ 闲置但交付（磁盘原模块仍随产物复制）」**。`flipImage`/`rotateImage` 返回空函数是计划书 **F06 的 P0 写回缺陷**来源，与「保留」是相反性质的记录，不能并列在同一张「保留清单」里。

### 4.4 tab-bar「未接入构建链 / 仅注释残留」

- **原表述（`:137`）**：`frontend/public/tab-bar.{js,css}` + `tests/tab-bar-closed-loop.mjs`「保留待定」，理由「**未接入构建链的候选功能**（PROGRESS b1-9al 登记为『**仅注释残留**』）」。
- **订正后表述（[码] + [推]）**：
  1. **JS 内有真实 Angular 调用**，不是注释：`frontend/public/tab-bar.js:68` `window.angular && document.body ? angular.element(document.body).scope() : null`；`:73` `window.angular ? angular.element(document.body).injector() : null`。
  2. **随 public 交付**：`publicDir` 整目录复制 ⇒ `dist/frontend/tab-bar.js` / `.css`（[推]，本副本无 `dist/`）。它同时被登记为第一方图外脚本 `tests/frontend-gate-manifest.mjs:58`。
  3. **无现役加载点**：全仓 `src/**`、`frontend/**` 的 HTML 中检索 `tab-bar` **零命中**；也不在 `rollupOptions.input`。
  4. **存在闭环测试但未登记执行**：`tests/tab-bar-closed-loop.mjs` 在 `package.json`、`run-react-suite.mjs`、`run-attached-nonsuite.mjs`、`frontend-acceptance` 的任一清单中**均无引用**（仅被本文档与 `src/app/react/PROGRESS.md` 的历史记录提到）。其断言依赖主窗渲染出 `#eagle-tab-bar`（`:217-226`），而现树无加载点 ⇒ **该测试当前能否通过属 [推]，未运行验证**。
- **订正要点**：应写作 **「JS 内含真实 Angular 调用、随 public 交付、无现役加载点」**，标签 **闲置但交付**。「未接入构建链」不准确（它确实经 publicDir 进入产物），「仅注释残留」与代码事实相反。

### 4.5 「排除 `app` 下 `.html`」的旧表述

- **原表述（`:12`）**：「`eagle-production-assets` 插件在 `closeBundle` 交付 `src/app`（**排除 `.html`/`react`**）…」；**（`:66`）**：「交付：`src/app`（**排除 `.html`/`react`**）…」。
- **订正后表述（[码]）**：实际过滤谓词为

  ```
  src.split(sep).includes('react')                       → 排除
  src.endsWith('.html') && REACT_PAGE_ENTRIES[rel]       → 排除
  其余                                                    → 复制
  ```

  即**只排除登记的 React 页 HTML**（`REACT_PAGE_ENTRIES` 的 11 条，见 `vite.preview.config.mjs:53-58、64-67` 与 `tests/frontend-gate-manifest.mjs:2-14`）。源码内注释也正是这么写的：`:234-235`「只排除由 Vite 产出的 React 页 HTML；pdf-viewer/model-viewer 等引擎页无 React 入口，按原样交付（R1）」。
- **订正要点**：应写作 **「`src/app` 交付时排除 `react/` 子树，以及 `REACT_PAGE_ENTRIES` 登记的 11 个 React 页 HTML；其余 `.html`（pdf-viewer、model-viewer、embed 等）按原样复制」**。原句的「排除 `.html`」会让读者以为引擎页也没进产物，与「引擎页原样复制交付」的相邻结论自相矛盾。

### 4.6 源码注释引用已删除的 `frontend/public/shims.js`，或声称有 `await`/完整晚注册支持

- **原表述（`:39-44` 与全表隐含）**：台账当时以「`shimsLegacy.ts` 退化为 5 行兼容入口」收尾，未提示**源码注释层**仍在引用更早的 `frontend/public/shims.js`，也未提示注释里的 `await` 承诺与代码不一致。
- **订正后表述（[码]）**：
  1. **`frontend/public/shims.js` 已删除**，删除提交为 `e00abd21`（`feat(shims): 收尾批 E9（P4-b/P5）—— 删 shims.js + mock-data.js…`）；该路径当前不存在。
  2. **仍有 20+ 处源码注释以它作为行为依据**（示例，非全量）：
     - `src/app/react/core/channelBridge.ts:9、11、25、85、405`（「语义逐字对齐 `shims.js` 的对应分支」）
     - `src/app/react/core/detailDeliveryGate.ts:2`（「自 `frontend/public/shims.js:56-232` 迁入」）
     - `src/app/react/core/documentViewer.ts:4`、`core/driverApi.ts:7`、`core/ipcWriteState.ts:4`、`core/returnBridge.ts:2`、`core/sourceMode.ts:4`、`core/scopeFace.ts:16`、`core/machineryInfra.ts:141-143`、`global/eagleGlobals.ts:2`、`main.tsx:82、219`
     - 测试侧：`tests/txt-update-closed-loop.mjs:10、63`、`tests/empty-trash-closed-loop.mjs:118`、`tests/native-preview-closed-loop.mjs:136`、`frontend/vite.preview.config.mjs:29`
  3. **注释不是行为证明**：例如 `main.tsx:224-240、267` 附近声称「再 await」，而计划书 F10 指出现场并无 await（`void import('./core/externalSupplyRegistrar')`）；计划书 F11 亦指出 `scopeFace` 的晚注册承诺「现有注释承诺偏大」。同类还有 `channelBridge.ts:25` 的「再删 `shims.js`」——该文件已删，注释未同步。
- **订正要点**：**不得把这些注释当作行为证据**。每条引用已删文件的注释都应在对应实现补真实依据（或删除注释）；本台账在 §1 各行的「证据」列只引**当前存在**的文件与符号，凡引用注释的描述一律标 **[推]**。

---

## 5. 覆盖缺口与未验证项（显式清单）

**A. 无任何行为测试的入口（本轮 [码] 确认）**

| 入口 | 现状 |
|---|---|
| `replaced/{registration,manage-device}.html` | 仅 `STATIC_PAGES` 资源存在性；无行为测试 |
| `src/app/model-viewer/website/embed.html` | 仅 `STATIC_PAGES` 登记；无独立测试，且未找到现役 iframe 加载点 |
| `frontend/public/tab-bar.js` | 存在 `tests/tab-bar-closed-loop.mjs`，但未登记于任何 runner |
| `/plugin-templates/**` | 目录在本副本不存在（详见 B） |

**B. 本轮未能验证的环境依赖（[码] 确认缺失，未做运行）**

| 依赖 | 表达式 | 结果 |
|---|---|---|
| 插件模板根 | `path.join(programRoot, 'resources/plugin_templates')`，其中 `programRoot = path.resolve(projectRoot, '../..')`（`backend/src/server.js:78`）、`projectRoot` 为该文件推导的工作区根 | 解析到工作区根**之外**，在本副本中不存在 |
| service 插件根 | `path.resolve(__dirname, '..', '..', 'plugins', 'example-service-plugin')`（`electron/main.cjs:1715`） | 解析到工作区根**之外**，在本副本中不存在 ⇒ `loadServicePlugins()` 走 catch 分支（`main.cjs:1718-1720`） |

> 计划书 F19 记述为 `H:/dev/plugins/example-service-plugin`；那是**同一相对表达式在计划书工作区根下**的取值。二者是同一缺陷（插件根落在工作区外），但**不可**把 `H:/dev/...` 当成代码中的字面量——全仓已无 `H:/dev`、`H:/resources` 硬编码（`grep` 零命中）。

**C. 计划书结论已被后续提交覆盖，本台账按当前代码登记**

| 计划书结论 | 计划书基线 | 当前 HEAD 状态 | 证据 |
|---|---|---|---|
| F23：`dist-entry-check` 把缺入口资源降为 WARN，误放行 | `d82ab6d7`，实测 `FAIL 0 / WARN 2` | **已被 `00352c1f` 覆盖**：`warnings`/`warn()`/`EXCLUDED_ROUTES` 全部移除，改为 `fail()` 无条件失败；仅保留 `notes`（范围说明，不影响退出码） | `git show 00352c1f -- tests/dist-entry-check.mjs`；当前 `tests/dist-entry-check.mjs:160、226、239-241` |
| F25：`typecheck.mjs` 把 shim 排除后显示「待撤销 0」 | 同上 | **已改**：当前按「全部计入类型债，不因属于 shim 而减去」输出，并显式打印 8 个文件 | `tests/typecheck.mjs:15-23、130-132` |
| F26：本台账 F26 六条 | 同上 | 已在 `docs/frontend-entry-ledger-2026-09-14.md` 内**就地订正**（保留时间语境），对照见本文 §4 | §4 |

> 记账纪律：计划书 §6 的实测数字是其**基线时点**的输出，不得当作本 HEAD 的测量值；反之，`00352c1f` 已修的门禁也不得再被当作现存缺陷。

**D. 本轮完全未执行的动作**

未构建（无 `dist/`）、未启动 Electron、未启动浏览器、未运行任何 `tests/**`。故本文所有 `dist/frontend/**` 路径均为 **[推]**。

---

## 6. 可复核命令（只读优先）

```bash
# 只读：环境与入口枚举
ls frontend/public/*.html frontend/public/*/*.html
grep -rn "rollupOptions" -A 20 frontend/vite.preview.config.mjs

# 只读：门禁与清单（不写产物）
node tests/frontend-acceptance.mjs --list        # 覆盖面 + 分类 + 分段，不执行
node tests/typecheck.mjs                         # 打印类型边界与图外脚本登记
node tests/shim-module-boundaries.mjs
node tests/scope-field-convergence.mjs

# 需构建/运行（本轮未执行，执行前须知其会写产物或起进程）
node tests/frontend-gates-unit.mjs               # M0 门禁单测
npm run test:artifact                            # build + dist-entry-check + production-smoke
npm run test:acceptance                          # 全段（会写验收 JSON、清空并重建 dist）
```

> `frontend-acceptance.mjs` 的 `COVERAGE_OK` 只表示**必需项已登记执行入口**，不代表本轮已执行（`tests/frontend-acceptance.mjs:122-123` 原文）。

---

## 7. 与历史台账的关系

| 文档 | 角色 |
|---|---|
| `docs/frontend-entry-ledger-2026-09-14.md` | R0/R1 建立的历史台账。**保留原日期、原结构、原表述**；本文 §4 的六条订正在该文件内以「原表述 → 现口径」就地标注，不删除历史记录、不重写为当天文档。 |
| `docs/frontend-entry-ledger-m0-2026-09-15.md`（本文） | M0 矩阵口径台账。补外围入口、引擎页、扩展、插件、后台 Worker、自有 Worker；类型配置与测试覆盖**逐入口**给结论；未验证项显式分离。 |
| `docs/plan-2026-09-15-full-workspace-legacy-audit.md` | 审计依据。其 §6 实测值为 `d82ab6d7` 时点数据，与本文 §5.C 的差异已显式对齐。 |

**本台账不恢复 `docs/` 下已被删除的历史文档**（删除清单见 `git show --stat 00352c1f`）。
