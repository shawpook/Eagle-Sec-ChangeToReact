# 前端迁移分批执行计划（R0–R7）

日期：2026-09-14 ｜ 分支：`react-in-place` ｜ 基点提交：`195dc3ab`

本文件把 `docs/2026-09-14_frontend-migration-remaining-report.md` §5.1–§5.8 的批次内容固化为可直接执行的清单：每个批次给出目标、主要文件（含已核实文件/行锚点）、编号工作项、完成判据与验证命令。批次以可验证的业务边界切分，每批独立提交、独立回退，回退锚点为 `195dc3ab`。本文不引入报告之外的新结论，锚点均取自上述报告并在本仓库核对。

## 状态说明

| 批次 | 名称 | 状态 | 前置 |
| --- | --- | --- | --- |
| R0 | 基线与首个遗漏修正 | 已完成（本次） | 当前工作区 |
| R1 | 正式构建与运行入口 | 待实施 | R0 |
| R2 | 启动层与环境边界 | 待实施 | R1 的入口清单 |
| R3 | 完整类型检查 | 待实施 | R0；结合 R2 接口推进 |
| R4 | 主应用业务与状态收敛 | 待实施 | R2 / R3 的共享边界 |
| R5 | 独立窗口与查看器 | 待实施 | R1 / R2 / R3；共享服务沿用 R4 |
| R6 | 旧代码、资产与文档收尾 | 待实施 | 对应消费者已迁出 |
| R7 | 统一交付验收 | 待实施 | R1–R6 |

## R0：锁定当前成果，完成入口与测试门禁整理（已完成）

### 目标

以连续列表提交 `195dc3ab` 为稳定基点，固化页面入口台账、类型诊断基线与网格回归门禁，确保自动定位与连续滚动持续受回归保护。

### 主要文件

- `docs/frontend-entry-ledger-2026-09-14.md`：页面入口台账。
- `tests/run-react-suite.mjs`、`tests/continuous-grid-layout.mjs`、`tests/continuous-grid-scroll.mjs`。
- `tests/react-stage11b0-smoke.mjs`（陈旧断言纠正）。
- `tests/typecheck-baseline.mjs`、`tests/tsc-baseline.json`。
- `package.json`（脚本）。
- `frontend/public/pages.html:64`（死链 progress.html）。

### 工作项

1. 建立页面台账 `docs/frontend-entry-ledger-2026-09-14.md`，登记各页面的 URL、HTML 来源、React 入口、父子窗口关系、专用引擎及开发/生产加载方式。
2. 将两个 continuous-grid 测试接入 `tests/run-react-suite.mjs`（此前为独立脚本）。
3. 新增 `tests/typecheck-baseline.mjs` 与 `tests/tsc-baseline.json`：诊断键归一化为 `路径::TSxxxx::消息`，去除行列号；基线为 492 条。
4. `package.json` 新增脚本 `typecheck`、`test:continuous-grid`、`test:react-suite`。
5. 移除 `frontend/public/pages.html:64` 中指向缺失 progress.html 的死链。
6. 纠正基点提交 `195dc3ab` 遗留的陈旧断言：`react-stage11b0-smoke.mjs` 的 `b0-scrollbar-thumb-style` 与 `b0-sentinel-init` 仍按旧自定义滚轴/Angular 内联样式断言。按原生滚动条新契约改写为 `b0-scrollbar-native-overlay`（浮层 `hidden` + 容器无 `hide-scrollbar`）与 sentinel 属性接线/顶部不显示——**修断言为新契约，不是放宽断言**。

### 完成判据

- 台账覆盖全部交付入口及其加载方式。
- 两个网格测试进入套件，`test:react-suite` 可一次性运行。
- `typecheck` 以基线 diff 防倒退；492 条诊断键逐条一致（`tsc` 真实退出码仍为 2，类型验收在 R3）。
- pages.html 死链已清除，连续网格与自动定位有回归保护。
- `react-stage11b0-smoke` 不再因 `195dc3ab` 的连续列表改造而失败（单跑 8/8 PASS）。

### 验证命令

```powershell
node tests/continuous-grid-layout.mjs
node tests/continuous-grid-scroll.mjs
node tests/typecheck-baseline.mjs
node tests/react-rewrite-sentinel.mjs
node tests/run-react-suite.mjs
```

## R1：建立完整生产构建与资源交付

### 目标

将主窗口、业务子窗口、六个 React 查看器与文档查看器纳入统一多页 build；由本地 HTTP 服务提供 `dist/frontend`，Electron 加载正式产物，Vite dev 关闭后仍可启动。

### 主要文件

| 文件 | 锚点与现状 |
| --- | --- |
| `frontend/vite.preview.config.mjs` | `configureServer` 注入 129–197 行；`REACT_VIEWER_ENTRIES` 46–53 行；`rollupOptions.input` 221–230 行目前只有 pages 与 document-viewer；`publicDir` 为 `frontend/public`（126 行）会整目录复制 |
| 各 `src/app` HTML | 主窗口、偏好、预览、采集及六个查看器入口 |
| `electron/main.cjs` | 默认开发 URL 第 8 行；`originalPreviewUrl` 699；`preferencesUrl` 708；tray workbench 1701 |
| `src/app/react/core/documentViewer.ts:58` | `${origin}/frontend/document-viewer/index.html` |
| `frontend/public/src/app/text-editor/*` | 待删除；旧页 `text-editor.html:28` 引用 `text-editor.js`，与 React 文本编辑页同路径冲突 |

### 工作项

1. 为主窗口、三类业务窗口、六个 React 查看器和文档查看器建立统一多页入口：HTML 中声明真实模块入口，或使用开发/构建共同执行的 HTML 转换，停止仅靠 `configureServer` 注入业务入口。
2. 删除 `frontend/public/src/app/text-editor/*`，消除开发/生产同路径两套实现的冲突，只保留一份权威实现。
3. 拆分开发专用资产：`frontend/public/mock-library`、`mock-assets` 不应进入生产产物（`publicDir` 整目录复制所致），明确排除或转为独立演示构建。
4. Electron 不使用 `loadFile`（绝对路径、iframe、worker 会断）；保持现有页面 URL 形状，由本地 HTTP 服务提供 `dist/frontend`，集中生成窗口 URL。
5. 统一运行时 API、缩略图与扩展服务地址，落实 `/file` 在无 Vite proxy 时的访问方式。交付资源至少包含：CSS、图标、字体、dcraw（`src/app/raw-viewer` 引用 `../../my_modules/raw-parser/dcraw.js`）、PDF worker/字体、o3dv（`src/app/model-viewer/website/*`）、播放器资源。
6. 新增产物入口/资源检查与 Electron 正式启动冒烟。新测试不得依赖 `/src/app/react/*.ts` 源码导入或 React Refresh。

### 完成判据

- 仅启动所需本地服务与 Electron 即可使用主应用，Vite dev 关闭。
- 主界面与每个交付子窗口加载正确模块，资源无缺失。
- 开发态与生产产物同一路径不再展示不同实现。

### 验证命令

```powershell
npm run build
# 产物入口/资源检查（主窗口、偏好、预览、采集、六个查看器、文档查看器、PDF、3D）
node tests/electron-smoke.cjs
```

## R2：拆分启动兼容层，明确窗口运行环境

### 目标

按职责拆分 `shimsLegacy.ts`，为十个窗口建立显式且幂等的初始化流程，使开发模拟环境与 Electron 正式运行环境的边界可审计。

### 主要文件

| 文件 | 锚点与现状 |
| --- | --- |
| `src/app/react/core/shimsLegacy.ts` | 共 3401 行；10–463 为 `!window.eagleDesktop` 演示库种子 IIFE；466–3401 为主 shim：472 `bodyScope()`、521–554 fetch 重写、1308–1689 `ipcRenderer.send` 频道路由、2466–2562 settings、2628–2680 MockI18n、2894–2951 `require()`、2954–2991 process/Buffer 全局、3344 `startLifecycle` |
| 十个窗口入口 | 第一条 import 均为 `shimsLegacy` |
| 复用模块 | `core/channelBridge.ts`、`core/returnBridge.ts`、`core/ipcWriteState.ts`、`core/settings.ts`、`core/documentViewer.ts` |

### 工作项

1. 按桌面能力接口、i18n/设置、事件与 IPC、浏览器开发适配、演示种子五类拆分 `shimsLegacy`，为每项依赖定义具体输入输出。
2. 复用既有 `channelBridge`、`returnBridge`、`ipcWriteState`、`settings`，不重建第二套通道或写队列。
3. 为每类窗口建立显式初始化流程：环境能力就绪 → 设置与语言就绪 → 窗口状态/服务注册 → React 挂载；初始化可重复调用时保持幂等，窗口退出时释放订阅与定时器。
4. 浏览器预览能力保留，但改为显式的 dev/demo 模式启用；正式构建不再以 `!window.eagleDesktop` 作为自动装入模拟库的唯一判据。
5. 先减少调用者，再移除无供给方的 Angular 分支与过时全局；将跨窗口必需的驱动接口与测试诊断接口分开，避免清理全局时破坏媒体查看器或 Electron 驱动。

### 完成判据

- 十个入口启动无隐式先后依赖遗漏。
- 同一 IPC 只注册/发送预期次数。
- 浏览器开发态与 Electron 正式态都可运行。
- 快速切库、关闭重开窗口不复用旧库状态。

### 验证命令

```powershell
node tests/channel-wiring-closed-loop.mjs
node tests/react-rewrite-sentinel.mjs
node tests/run-react-suite.mjs
```

## R3：从模型与共享契约开始解决类型问题

### 目标

建立共享模型与接口契约，将全部自有前端纳入类型检查，逐域消除诊断与豁免，最终 0 诊断。

### 主要文件

- `tsconfig.json:21-22`：只含 `src/app/react/**`，排除 `frontend`；需纳入 `frontend/document-viewer`（18 个 TS/TSX）。
- `core/driverApi.ts`、`core/scopeFieldBridge.ts`（`writeScopeField`）、事件总线载荷。
- 17 个含 `@ts-nocheck` 的文件（实际生效 16 个）；`src/app/react/core/fileUrlHelper.ts` 注释在第 9 行、import 在第 1 行，未生效，现产生 12 条诊断。修正方式是把注释放到文件首行前以真正生效，而不是保留原位置。
- 豁免文件归属清单：`docs/2026-09-14_frontend-migration-remaining-report.md` §8.3。

诊断分类（492 条基线）：

| 类别 | 数量 |
| --- | --- |
| TS2554 参数数量不匹配 | 171 |
| TS7006 参数隐式 any | 130 |
| TS2345 参数类型不匹配 | 87 |
| TS2304 名称不存在 | 44 |
| TS7053 索引类型 | 12 |
| 其他 | 48 |

热区文件：itemDomain 67、filterDomain 64、miscDomain 52、keymap 47、sidebarService 44、selectionService 31。

### 工作项

1. 先建立 Item、Folder、Library、Selection、Preferences、ViewerContext、DesktopApi、IPC 载荷/回执等共享类型；外部 JSON 从 unknown 校验后进入模型。
2. 优先修正缺失名称、重复声明/实现、导入冲突、const 赋值等可能影响执行的项目，再修正公共函数参数、无载荷事件签名、回调与数组推断。
3. 为文档查看器建立检查入口并保留真实浏览器/库类型；归入 `src/app` 后统一配置。不要将 Electron/Node 与浏览器全局混成一个宽泛声明文件。
4. 按业务域撤销有效 `nocheck`：先给边界补类型与行为验证，再逐文件开启；记录因此新暴露的存量诊断（不与本批回归混同）。
5. 逐步收窄 `core/driverApi.ts`、`core/scopeFieldBridge.ts`（`writeScopeField`）与事件总线载荷；临时第三方适配须局部、具名并注明移除条件。
6. 将 `typecheck` 脚本由“基线 diff”切换为“0 诊断”，最终验收必须调用它。

### 完成判据

- 全部交付前端源码纳入检查，strict 保持启用，诊断数为 0。
- 应用自有业务文件不再整文件豁免；第三方引擎原始代码通过明确声明与适配层接入。
- 覆盖范围、诊断数量、豁免数量同时记录。

### 验证命令

```powershell
node node_modules/typescript/bin/tsc --noEmit --pretty false
npm run typecheck
```

## R4：主应用状态与业务服务逐域收敛

### 目标

组件与业务服务直接消费具体 store/action 或类型化接口，消除通用字段/函数门面依赖，同时守住既有业务与连续网格语义。

### 主要文件

- 主战场：`core/scopeFieldBridge.ts`（55 个导入方）、`core/scopeFace.ts`（16 个）、`core/driverApi.ts`（3 个）。
- `services/` 下 18 个服务文件（豁免清单见报告 §8.3）。

建议次序：列表/选择 → 文件夹与筛选 → Inspector 与标签 → 详情与媒体 → 导入导出及其他业务。

### 工作项

1. 列出该域状态的唯一拥有者，区分原始数据、派生数据、临时交互状态与运行时资源；组件通过具体 selector 读取，通过 action/service 改变。
2. 将 `scopeFace`/`driverApi` 的内部业务调用改为显式参数或具体模块导入；删除对应普通对象回退与字符串函数挂载。窗口外部消费者暂由具名兼容适配承接。
3. 处理散落的手动快照同步与动态 DOM 操作；保留必需的媒体/原生控件适配，明确元素由谁创建、谁更新、谁销毁。
4. 守住 ID、对象引用与持久化回执语义：选中项、在飞编辑、差分回执、导入去重不得因不可变更新改造而重新覆盖用户编辑。
5. 该域调用者归零后再删除对应兼容入口；未迁完的窗口继续通过自己的 WindowContext 工作，不强制共享主窗 store。
6. 守住连续网格几何：全列表单一高度、锚点、离屏更新（不得恢复按页替换列表或反复写滚动位置）。

### 完成判据

- 该域无通用 scope 字段/函数表依赖。
- 行为在新旧测试中一致，连续网格总高度、锚点、选择定位与离屏更新不回退。
- Portal 可保留，不以减少 Portal 数量为目标。

### 验证命令

```powershell
node tests/d3-selection-closed-loop.mjs
node tests/d3-alltags-view-closed-loop.mjs
node tests/continuous-grid-layout.mjs
node tests/continuous-grid-scroll.mjs
node tests/main-ui-workflow-closed-loop.mjs
node tests/item-persistence-closed-loop.mjs
```

## R5：独立窗口和查看器完成同等深度的迁移

### 目标

每个独立窗口拥有本窗 store 与明确上下文，共享纯业务服务而不共享任意可写 controllerScope；六个查看器与文档/专用引擎完成具名接口与资源生命周期管理。

建议次序：偏好设置 → 采集窗口 → 预览窗口 → 六个查看器及文档/专用引擎适配。

### 主要文件与锚点

| 窗口 | 锚点与现状 |
| --- | --- |
| 偏好设置 | tippy：`preferences/panels.tsx:1491`、`preferences/panels8e.tsx:563`；`ShortcutManager`：`preferences/controller.ts:984` |
| 采集窗口 | CollectItem：`collect-window/controller.ts:368`；旧 API；jQuery：`selectPanelEngine.ts:4`、`tagPanelEngine.ts:5`、`contextMenu.tsx:8`；jQuery UI；SweetAlert：`folderPanel.tsx:447` |
| 预览窗口 | watcher 门面：`preview-window/controller.ts:255-307`，仅支持 `'theme'` / `'current.id'` 两个 getter；`components/detail/detailHooks.ts:1024,1034` 注释表明已迁到 store 订阅，无实时调用方 |
| 六个查看器 | `react/viewers/{exif,raw,native,gif,text-editor,font}/entry.tsx`，各自使用 `window.parent.__eagleDriver \|\| parent.$bodyScope` |
| 文档查看器 | 归入 `src/app/react/viewers/document`；同步 `core/documentViewer.ts:58`（`${origin}/frontend/document-viewer/index.html`） |
| PDF / 3D | `src/app/pdf-viewer/web/viewer.html`（PDF.js）；`src/app/model-viewer/website/{index,embed}.html`（O3DV） |

### 工作项

1. 偏好设置：字段、快捷键编辑、主题与语言更新通过 typed action；替换剩余 tippy / ShortcutManager 胶水并验证焦点行为。
2. 采集窗口：把旧 CollectItem/API 全局模型转为 TS 模块，复用现有 React 弹窗、拖动与选择组件；移除 jQuery / jQuery UI / SweetAlert 的应用侧依赖，保留拼音与格式处理的功能契约。
3. 预览窗口：以 store selector、effect 或显式订阅代替手写 watcher/notify 门面；同步改造 detailHooks 的窗口参数，覆盖播放、切图、字体、GIF 与快速关闭场景。
4. 六个查看器：父子窗口状态/命令改用具名接口；专用引擎由 ref/effect 管理，退出时释放资源与监听；失败/空文件状态有明确 UI。
5. 文档查看器：复用现有实现并归入 `src/app/react/viewers/document`，同步入口、worker/样式资产与 `core/documentViewer` 地址构造；旧路径如过渡只能保留转发入口，不得有第二份业务代码。
6. PDF/3D：登记保留引擎与自有界面改动，统一入口与资源路径，分别做文件打开、主题/尺寸变化与反复卸载验证。
7. 逐窗移除 `tests/react-rewrite-sentinel.mjs:137` 的 `scopedOut` 豁免（该豁免覆盖 viewers、scopeShim、preview-window、collect-window、preferences）。

### 完成判据

- 各窗口可从主流程打开，也能在上下文合法时独立启动。
- 关闭再开无重复监听，主/子窗状态不串库。
- 该窗口迁移完成后移除对应哨兵豁免。
- 播放、切图、跨窗同步、主题与焦点行为通过验证。

### 验证命令

```powershell
node tests/preview-delivery-closed-loop.mjs
node tests/native-preview-closed-loop.mjs
node tests/document-viewer-ui-closed-loop.mjs
node tests/video-detail-mode-closed-loop.mjs
node tests/menu-popup-closed-loop.mjs
node tests/ui-interactions-closed-loop.mjs
node tests/react-rewrite-sentinel.mjs
```

## R6：按真实依赖清理旧代码、资产和文档

### 目标

在消费者已迁出的前提下，把主界面残余旧脚本迁移为具名 TS 模块，退役死文件，核对依赖与文档。

### 主要文件

- `src/app/index.html:195,196,241,245,247-249`：主界面仍加载旧脚本 eagle-api.js、url-enlarger.js、lazy-load-manager.js、shortcut-manager.js。
- `src/app/js/directives/*.html`（64 个）及旧 controllers/templates。
- `package.json:38`：`@egjs/react-infinitegrid`（TS/TSX 中无使用，但 `window.ig` 是命令兼容面，需单独保留）。
- `README.md` 与文档索引。

### 工作项

1. 将主界面仍使用的 lazy-load-manager、shortcut-manager、eagle-api/url-enlarger 等应用侧服务改为具名 TS 模块；迁移过程保护图片加载生命周期与固定几何。
2. 联合静态引用、动态 require、插件接口、测试与运行时资源请求建立保留清单，之后再删 `src/app/js/directives/*.html`（64 个）与旧 controllers/templates。不能仅凭搜索不到 import 就整目录删除。
3. 删除已被替代的 public 旧页面与无调用者兼容分支；旧 CSS 名称或注释中的 Angular 字样按用途处理，不作为自动删除条件。
4. 核查 `@egjs/react-infinitegrid`（`package.json:38`）在全仓的调用后移除；`window.ig` 现为命令兼容面，不得随该包一起未经迁移直接删除。
5. 更新 README 的“当前状态”、运行命令与文档索引（现 README 仍描述 Angular、shims.js 与旧端口）；历史 PROGRESS/收官文档保留时间语境，追加指向新验收记录的说明。

### 完成判据

- 正式产物与源入口不存在旧业务实现回退。
- 保留的 JS/引擎都有明确消费者与理由。
- 新开发者按 README 能启动并理解当前架构。

### 验证命令

```powershell
node tests/react-rewrite-sentinel.mjs
node tests/run-react-suite.mjs
npm run build
```

## R7：建立一个能代表完整迁移的验收入口

### 目标

建立统一前端验收命令，覆盖类型、入口/架构、正式构建、关键业务回归与正式产物冒烟，并对完整迁移给出可复核的完成判断。

### 主要文件

- `package.json`（统一验收脚本）。
- `tests/`（套件与产物行为测试）。
- `docs/frontend-entry-ledger-2026-09-14.md`、`tests/tsc-baseline.json`、保留清单与实机结果记录。

### 工作项

1. 建立统一前端验收命令，包含全范围类型检查、架构/入口检查、正式构建、关键业务回归和正式产物冒烟。
2. 常规批次运行受影响的定向测试；修改启动、IPC、全局状态或跨窗契约时扩大回归；最终运行完整 React 套件及持久化、查看器、导入导出与网格测试。
3. 修正测试覆盖不足，而非放宽断言或仅保留脚本文本匹配；开发态源码探针与产物行为测试分开维护。
4. 核验历史低频失败，记录触发条件、复现证据与实际处理结果；端口/宿主环境问题单列，不把无法执行写成通过。
5. 更新入口/依赖清单、类型基线、保留项与实机结果，到此才对完整迁移给出完成判断。

### 完成判据

- 报告第 6 节验收矩阵各项均有可复核结果。
- 未通过项明确标注，不以套件数量、源码后缀或一次 build 成功替代。
- 类型检查 0 诊断、正式产物冒烟与关键业务回归均有证据。

### 验证命令

```powershell
npm run typecheck
node tests/react-rewrite-sentinel.mjs
npm run build
node tests/run-react-suite.mjs
node tests/full-regression-isolated.mjs
```

## 依赖顺序

`R0 → R1 → R2 → R3（R4/R5 交错）→ R6 → R7`

- R0 是唯一已完成的批次，为后续提供入口台账、诊断基线与网格回归门禁；所有后续批次回退锚点均为 `195dc3ab`。
- R1 是 R2 的前置：R2 需要 R1 产出的入口清单来确定各窗口的显式初始化位置。
- R3 依赖 R0 的检查范围与基线；其接口收敛结合 R2 的桌面能力边界推进。
- R4 与 R5 可交错实施：均依赖 R2/R3 确立的共享边界；R5 的共享业务服务沿用 R4 的收敛结果。
- R6 在对应消费者迁出后进行，不得先删全局供给再用宽泛兜底掩盖错误。
- R7 最后执行，统一验收 R1–R6 的全部交付。
- 每个批次只承担一个可验证边界，独立提交并记录回退点；跨窗共享模块迁移时同步确认主窗与子窗上下文。
