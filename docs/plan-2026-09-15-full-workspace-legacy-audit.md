# Eagle 全工作区旧框架残留审计与改造计划

> 审计日期：2026-09-15  
> 工作区：`H:/dev/Eagle-Sec-development - 副本`  
> 基线：分支 `react-in-place`，HEAD `d82ab6d7`，以审计时磁盘工作区为准，而非只审提交内容。  
> 目标：在原目录 `src/app` 内完成 React 19 + TypeScript + Vite 迁移，并把原先漏掉的外围前端及交付链纳入治理。  
> 本轮性质：只读排查、有限静态验证、制定计划；**未实施下述业务代码改造，未重新构建或覆盖 dist，未恢复用户已删除的文档。**

## 0. 核心判断

**主界面换成 React 的工作已经成立，但“整个项目完成前端迁移”尚不成立。**

问题不只是几个残留文件，而是五种性质不同的未收口项：

1. **真的还引用 Angular API 的代码**：现役 shim/业务模块中仍有受条件保护的 `angular.element` 分支；旧 URL factory、旧插件实现、tab-bar 也存在真实 Angular 调用。后面三者不能简单认定为主应用正在执行：有的没有入口，有的被替身截获，但仍进入产物。
2. **业务执行还在 Vite/TypeScript 模块图之外**：`frontend/public/vendor/eagle-match-rules.js`、`eagle-zoom-helpers.js`、预览窗 `global.js/devices.js`、同步源码加载器、经典 Worker 等。
3. **换成 TS 文件但仍保留旧运行模型**：全局 require、模拟 Node 环境、scope 服务定位器、可变 controller、字符串动作派发，以及与这些兼容层相关的缺失动作、空实现和销毁不完整。
4. **`src/app` 外存在实际交付的另一批前端**：工作台、路线图、音视频页、浏览器扩展、后端供给的插件页面；它们不是“看上去旧”，而是可以由菜单、页面链接或 manifest 到达的运行入口。
5. **现有验收范围不足**：类型检查限定 React 子树、8 个 shim 文件整体免检；产物门禁甚至会把“主入口 JS 缺失”降为警告。全绿不等于遗漏已消失。

### 最先处理的三件事

- **写文件能力不能是假实现**：旋转/翻转工具被 `requireModule` 返回空函数；在写回分支可能出现界面按成功继续、文件未改，或 `undefined.then`。应先补真实能力和持久化闭环，不能仅改文件后缀。
- **先修门禁，再继续收尾**：主入口资产缺失必须失败；增加外围入口、动态资源和真实 MV3 扩展的验收。
- **补齐动作契约与预览启动顺序**：字体改名/星标、部分菜单动作、跨窗供给就绪、预览页经典脚本先于模块 shim 执行等问题，应优先于大规模目录清理。

这里的 P0/P1 是本项目整改顺序，不是安全漏洞评级。对未做 UI 实测的项，下文明确标为“代码链推导/待运行验证”，不把推导写成已发生的数据损坏。

---

## 1. 范围、方法与证据口径

### 1.1 已核查范围

| 范围 | 核查重点 | 结论边界 |
|---|---|---|
| 根 `package.json`、`tsconfig.json`、启动脚本 | 根构建链、类型边界、生产启动 | 根包已使用 React 19.1.0 / TS / Vite，不是仍用旧 Webpack 启动 |
| `src/app/react/**` | 入口、shim、store、driver、controller、DOM 适配、查看器 | 不以 `.tsx` 后缀代替迁移完成判据 |
| `src/app` 的 HTML、`js/**`、各查看器 | 经典脚本、Angular 调用、Worker、引擎资产 | 对加载点、路径截获、产物复制分别判断 |
| `frontend/public/**` | 全部 8 个 HTML、7 个 JS，以及扩展 manifest | 区分第一方业务 JS、第三方库、静态展示页 |
| `electron/**`、`backend/src/server.js` 等 | 窗口 URL、preload、插件供给、缩略图 Worker | 主进程/后台 Worker 不要求 React 化 |
| `src/my_modules`、`src/package.json`、旧宿主文件 | 动态加载表、旧依赖树、旧启动脚本 | 未执行 `.jsc` 字节码；不能证明其内部零引用 |
| `tests/**`、`scripts/**` | 静态门禁、测试兼容层、产物及生产启动 | 没有运行全量业务回归或修改真实资源库 |
| `dist/frontend` | 当前磁盘产物、残留资源、入口门禁 | 未重新构建，不能保证它与 HEAD 一致 |
| 现存 `docs/**`、README、迁移记录 | 对照已完成口径与真实源码 | 文档不是结论的唯一依据 |

根及 `src` 下的 `node_modules` 作为依赖资产处理，未把每个第三方包中的 Angular/jQuery/webpack 字样统计为项目迁移遗漏。截图、历史测试输出、日志和旧报告中的关键字同样不计作活跃运行引用。

### 1.2 判定标签

- **活跃**：当前入口/消费者可追踪到该代码；不等于所有分支已在本轮动态执行。
- **条件活跃**：只有某功能、运行模式或插件类型才进入。
- **图外执行**：有运行消费者，但不走现有 Vite 静态依赖和 TypeScript 检查。
- **被截获**：源码中有 require，实际解析为 shim 替身，磁盘原模块并未由该链执行。
- **闲置但交付**：没有发现现役加载入口，构建却仍复制。
- **保留引擎**：独立第三方算法/渲染器，不应为追求“全部 React”重写。

下文路径均相对工作区根；`文件:起止行` 是审计基线定位，后续修改后可能漂移。推荐实施时以符号名再次定位。

---

## 2. 当前真实运行与交付链

```text
根 package.json
  ├─ dev/build → frontend/vite.preview.config.mjs
  │   ├─ src/app 的 React 窗口 HTML → src/app/react/**
  │   │   ├─ 10 个传统窗口入口 → core/shimsLegacy → core/shim/install
  │   │   ├─ main → bundleGlobals → fetch + 经典 script 执行业务 vendor
  │   │   └─ requireModule → 真模块 / 路径替身 / genericStub
  │   ├─ document viewer → src/app/react/viewers/document/**
  │   ├─ public 整目录复制 → 工具页 / 扩展 / vendor / tab-bar
  │   └─ closeBundle 复制 → app 非 React 资产 / my_modules / i18n / config
  ├─ start:prod → dist 静态服务 + backend + electron/main.cjs
  │   ├─ 主/子窗口 + 菜单中的 workbench
  │   └─ preload 原生能力 ↔ renderer shim/channelBridge
  └─ backend
      ├─ /plugins → 测试夹具示例 + 用户插件
      ├─ /plugin-templates → 工作区外 resources/plugin_templates
      └─ 独立 Electron PDF/video 缩略图 Worker

旁路旧宿主：src/package.json → run.js → run.jsc/main.jsc
  根启动链不指向此路径；旧脚本、依赖和字节码仍留在工作区。
```

关键依据：根 `package.json:8–28`；Vite 配置 `:111、145–152、219–263、284–299`；`backend/src/server.js:74–135`；`scripts/start-production.mjs:20–50`。

**“原地迁移”的建议边界**：第一方应用 UI 与共享业务继续归入 `src/app/react`；必要的窗口 HTML、第三方引擎、Worker 壳可保留稳定 URL。浏览器扩展应保持独立产物和 manifest，不把后台 service worker 强行变成 React 组件。后端和 Electron 主进程不属于 React UI 改写对象，但其接口和静态资源交付必须覆盖。

---

## 3. 发现清单：26 项

### 3.1 真正的旧框架引用与图外执行

#### F01｜现役模块还保留真实 Angular 分支，而不只是注释【P2；受保护分支】

- `src/app/react/core/shim/ipcBus.ts:100–113`：`file-uploaded` 分支先尝试 `angular.element(document.body).scope()`，再回退 React registry。
- `src/app/react/core/shim/demoSeed.ts:657–687、782–786`：非媒体元信息补丁及捕获轮询仍尝试 Angular scope；后者已有 `bodyScope()` 回退，前者主要回退 mock cache。
- `src/app/react/core/libraryDomain.ts:158–174`：旧 digest 性能诊断仍通过 injector 调 `$rootScope`，无 Angular 时清除计时器。
- `src/app/react/core/shim/environment.ts:14–16`：继续保留 `$bodyScope` 后备；这是旧契约残留，不是 Angular 引擎本身。

**判定**：源码仍引用老框架 API，但没发现主入口重新装载 Angular runtime 的证据。不能写成“全仓只剩注释”，也不能写成“主界面仍由 Angular 渲染”。

**改造**：移除不再支持的 Angular 分支；直接读类型化 store/端口。元信息修复归位卡片渲染，替代 MutationObserver + 300ms 重扫；诊断改为 React/业务性能测量。保留对子窗真实 controller 的兼容前必须列明调用方。

#### F02｜闲置 Angular 实现还在源码和产物中【P2；闲置/被截获但交付】

| 文件 | 真实旧引用 | 当前判定 |
|---|---|---|
| `frontend/public/tab-bar.js:67–75` | `angular.element(...).scope()/injector()` | 未发现当前加载入口；随 public 复制，不能称“未进入构建链” |
| `src/app/js/services/url-state-service.js:4–5、21–34、50–55` | `EagleApp.factory`、`angular.extend/forEach`、`$rootScope` | 当前主窗已有替代 URL 服务；未发现旧 factory 加载入口，仍被复制 |
| `src/app/js/plugin/index.js:373、2597、3131` | Angular injector/scope | `require('/src/app/js/plugin')` 被 registry 截获；不能据 require 文本认定此文件现役 |
| `src/app/js/plugin/handlers/smart-folder-handlers.js` | 旧 scope 契约 | 需随插件支路逐个登记，不宜整目录豁免 |

Vite `:223–240` 对 `src/app` 的复制规则不会排除这些 JS；public 同样整目录交付。

**改造**：tab-bar 若是要保留的功能，做 React 版并接入真实入口及行为测试；否则退出发布清单。旧 URL factory 与确定退役的插件模块按文件隔离；先核对插件 preload 支路，再清理。**本计划不默认授权删除这些功能。**

#### F03｜vendor 目录中仍有第一方业务代码动态执行【P1；活跃、图外执行】

- `src/app/react/core/bundleGlobals.ts:1663–1683` 获取 `/vendor/eagle-match-rules.js`，创建经典 script，将文本放入 `script.textContent` 执行。
- 同文件 `:1693–1714` 对 `/vendor/eagle-zoom-helpers.js` 做同类处理。
- 消费者：`core/filterDomain.ts:1131–1159` 的规则族；`services/detailService.ts:144–173` 的缩放判断。
- `frontend/public/vendor/eagle-match-rules.js:57` 仍有 `window.__eagleDriver || window.$bodyScope`；文件混有第三方 is.js/BigNumber 内容，不能整块视为自研或整块当 vendor 豁免。

**问题**：不经静态模块依赖、类型检查；装配异步，无统一就绪保证。目录名 vendor 掩盖了迁移未完成。

**改造**：拆出 `core/rules/*`、缩放纯函数与设备数据，具名 ESM 导出；第三方小库单独列许可与版本；入口等待必需模块就绪，删除经典文本执行通道。`eagle-ga4mp.js` 是第三方统计库，另作保留/替换决策，不混算第一方业务。

#### F04｜预览窗还保留经典 boot，存在先执行后安装 shim 的顺序问题【P1；活跃、代码链推导】

- `src/app/preview-window.html:20–39` 内联执行 `require('path')`、`require(appRoot + '/config.js')` 等。
- 同页 `:46–47` 加载 `js/global.js`、`js/devices.js`，到 `:83` 才引用 React 模块入口。
- `src/app/react/preview-window/entry.tsx:1` 才 import shim；模块脚本的执行时机晚于前面的经典脚本。
- `src/app/js/global.js:1–13` 依赖 appRoot/config，并包含写临时 marker 文件的历史副作用；其工具函数在预览 controller 中仍有消费者。

**问题**：干净浏览器没有先置 require 时，前面的内联代码无法靠后面的模块 import 补救；Electron 有原生 require 也不能据此保证 `/src` 和 appRoot 已装配。模块入口出现并不代表 boot 全部进入模块图。

**改造**：把 boot、配置与实际所需 helper 迁入 TS 安装函数；显式依赖、先安装再挂载；删 marker 副作用。保留 video.js 等引擎但声明依赖。须做无测试预注入的浏览器和 Electron 预览窗口控制台验证；本轮未启动窗口，不将每个环境都判为已复现白屏。

#### F05｜同步源码 require 加载器仍然承担正式运行【P1；活跃、图外执行】

- `core/shim/moduleRegistry.ts:32–59`：同步取源码，`new Function` 执行 CommonJS；失败返回 `genericStub`。
- `:71–128`：按字符串路径选择真实模块或替身。
- `core/shim/settingsI18n.ts:58` 加载默认偏好；`moduleRegistry.ts:282–312` 装配拼音/简繁/笛卡尔积。
- `components/detail/detailHooks.ts:1507–1517` 条件 require WaveSurfer。

**改造**：自有默认配置、业务工具先迁 ESM/JSON；保留算法引擎用显式 loader/URL manifest；未知模块失败必须可观测，不返回万能成功对象。禁止一次性删除所有 require：先区分原生能力、第三方引擎、旧业务、已截获模块。

### 3.2 兼容层引出的实际功能缺口

#### F06｜旋转/翻转写文件被空实现截获【P0；高置信代码缺陷，需隔离样本验证】

- `core/shim/moduleRegistry.ts:106–107` 对 `flipImage.js`、`rotateImage.js` 直接返回 `() => {}`，没有 demo-only 限制。
- `services/imageOpsService.ts:217–234`：`await rotateImage(...)` 后执行成功收尾、更新条目、重新生成缩略图。
- 同文件 `:292–324`：用户启用写文件模式后，`flipImageUtil(...).then(...)`；空函数返回 undefined，链调用会报错并进入 catch。
- `preview-window/controller.ts:872–891` 有同类写回调用。

**影响**：预览变换不等于原文件写回；旋转可能走成功 UI 但没有真实写入，翻转可能报错。未在用户素材上执行，不声称已经造成损坏。

**改造**：接后端/受控桌面图像处理端口，结果采用明确成功/失败对象；不支持时禁用或拒绝。验收必须读回像素/尺寸和 metadata、重启后复查，不能只看 toast 或缩略图更新事件。

#### F07｜正常装配仍混入大量 demo/no-op 能力【P1；活跃映射，影响按消费者分级】

- `core/shim/install.ts:40–78`：只有 seed 受 mode 控制；媒体 patch、模块表、process/Buffer/require 覆盖均继续执行。
- `moduleRegistry.ts:82–85、101–121、145–154`：旧 API server、plugin、note、访问检查、下载、裁剪、子进程等包含替身或空实现。
- `core/shim/browserRuntime.ts:42–49` 对媒体 duration 做全局补丁。

**判定**：部分能力已经由后端或 preload 接管，不能把所有 stub 都算故障；但“未知能力返回成功”是剩余架构缺陷。`src/app/js/api-server-v2.js` 的 require 被空初始化替代，不代表后端 API 整体不存在。

**改造**：列能力矩阵 `electron / browser-connected / demo`；只在 demo 注入模拟实现，业务态缺能力必须明确失败。不擅自扩大浏览器产品承诺：若普通浏览器只支持演示，页面应明确标识。

#### F08｜查看器消费的父窗动作与实际供给不闭合【P1；活跃消费者、静态缺项】

- `viewers/font/entry.tsx:301–302` 改名调用 `parentCall('imagesChange')`。
- `:353–358` 星标快捷键调用 `removeStar/changeTo1Star…changeTo5Star`。
- `core/driverApi.ts:39–45` 白名单没有这些动作，守卫式调用会静默不执行。
- `externalSupplyRegistrar.ts:16–28` 注册 `isFontActivate/startDrag`，但主窗 `machineryInfra.ts:238–251` 未见两者对应挂载；driver 的白名单不等于有真实函数。
- 预览窗 controller 有自己的部分实现，不能把主窗供给缺项外推到每个窗口。

**改造**：提供 `renameItem(id, name)`、`setRating(ids, value)` 等类型化跨窗端口；生成消费/供给对照测试。复用 `inspectorActions.ts` 等既有业务，不复制第二套持久化逻辑。

#### F09｜内部字符串派发还有悬空菜单动作【P1；静态缺项，需交互验证】

- `components/toolbar/Toolbar.tsx:47–54、293、324` 通过 `scope[fn]` 派发 `openSidebarMenu/openAllTags`。
- 未找到主窗同名完整供给；`Sidebar.tsx:637` 的局部 `openAllTags` 映射并不等于注册到公共 face。
- `Sidebar.tsx:711`、`components/stage7/ControllerModals.tsx:480–482` 仍有同类 scope 取用。

**改造**：应用内部直 import 具名 action；需要跨边界的才走受检 registry。缺必需动作时断言或显式错误，不能安静返回。逐入口验证菜单打开和动作结果，避免只检查某组件渲染成功。

#### F10｜跨窗供给的启动就绪没有真正 await【P1；静态竞态】

- `main.tsx:248–250` 用 `void import('./core/externalSupplyRegistrar')` 异步注册。
- `:224–240、267` 直接 bridge/接管域，ready 只看 mousetrap；注释写“再 await”，实际没有 await。
- `core/externalSupply.ts` 缺供给会返回 undefined。

**改造**：单一启动 Promise，按依赖完成 registry、能力、store、事件桥，再开放窗口与动作。保留用于解 ESM 循环的延迟加载，但必须等待；冷启动/人为延迟模块加载时测试跨窗动作。

#### F11｜scopeFace 已不是 Angular，但仍是广域可变服务定位器【P2；架构债】

- `core/scopeFace.ts:25–64`：字段访问器 + 普通对象 + `$root/$parent/$eval/$destroy` 兼容面。
- `core/scopeFieldBridge.ts:12–25、42–50`：按名字注册读写。
- `core/driverApi.ts:59–74`：动作和数据一起以动态属性读写。
- 本轮门禁输出：315 个注册字段、57 个挂载槽、24 处函数值站点。

**额外边界**：face 创建时只枚举已有字段；getter 动态查表只能照顾已建 descriptor 的名字，不能保证全新晚注册字段自动出现。未证实当前已有晚注册故障，但现有注释承诺偏大。

**改造**：分开 readonly 数据快照、类型化命令、引擎实例；注册冲突报错，确定冻结时点。内部逐域去 face，外部保留小型 adapter。不要一次性删除闭包缓存、节流实例或稳定引擎对象。

#### F12｜jQuery 包退役后仍有自研 DOM 兼容岛【P2；活跃】

- `utils/domLite.ts:63–167、418–531` 实现集合 DOM、命名空间事件、动画等兼容方法。
- 实际消费者：`core/hoverPreview.ts:15`、`core/smoothZoomEngine.ts:22`、`components/sidebar/Sidebar.tsx:23`、`preview-window/controller.ts:5`。
- `smoothZoomEngine.ts:3027、3041` 仍有裸 `instanceof jQuery`；目前未找到 landmark 分支的现役调用，不报必现错误。

**改造**：把 domLite 限制在引擎 adapter；先迁菜单/侧栏普通 DOM，再迁预览壳。缩放、指针坐标、连续网格不因“React 化”随意改算法。删除死分支或改为 DOM 类型判断，并添加对应路径测试。

#### F13｜多窗口仍使用可变 controller + 手动刷新，且清理不完整【P1/P2；活跃】

- `collect-window/controller.ts:20–59`、`preferences/controller.ts:70–103`：手工订阅/notify。
- `preview-window/shell.tsx:987–1000`：订阅后强制 bump。
- `collect-window/tagPanel.tsx:44–100`：创建拖拽/缩放及 opener 闭包，effect 清理只清诊断变量，未释放相应实例/回调/计时器。
- `preview-window/entry.tsx:36–48` 注册 `init` 监听没有退订。

**改造**：先加 dispose 和重复挂载测试；再转不可变快照 + `useSyncExternalStore` 或现有 zustand 域。迁移按窗口分批，不能在样式不变的要求下整页推倒重写。

#### F14｜第三方查看器保留合理，React glue 生命周期尚未闭合【P2；活跃】

- `viewers/font/entry.tsx:240–289` 延时初始化 MediumEditor，实例未持有以便销毁。
- `viewers/gif/entry.tsx:47–90` 创建 SuperGif 并交给父窗，无完整 effect 释放路径。

**改造**：引擎暂保留，补 ref、销毁/停止、取消加载、卸载失效回调；父子窗只交换受限接口。验收多次打开关闭，播放器/编辑器事件数量不持续增长，不操作旧文档节点。

#### F15｜`src/app` 外的 preload 退订契约也有缺口【P1；明确函数身份不匹配】

- `electron/preload.cjs:11–13、20–23`：`on` 注册的是包装函数 `(_event, value) => callback(value)`，`off/removeListener` 却尝试删除原 callback，函数身份不同。
- `:38–39、58、70` 多个具名 on 接口不提供退订句柄。
- 这不是 Angular 依赖，而是为迁移增加的桥在 React 生命周期中不完整。

**改造**：`onX` 返回 disposer，或保存 `channel + callback → wrapper` 映射；`once` 也清映射；禁止业务层用 removeAllListeners 代替精确清理。验证重复订阅/退订后只回调一次，并覆盖跨窗口回程。

#### F16｜经典 Worker 不应删除，但自有协议与资源仍在图外【P2；条件活跃】

- `core/bitmapViewer.ts:220、311`、`core/eagleClasses.ts:763`、`components/detail/commentHooks.ts:1112` 创建 `js/workers/*`。
- `src/app/js/workers/{bitmapWorker,calHammingDistance,tifWorker}.js` 及其 `importScripts`、HEIF JS/WASM 是真实依赖。
- `src/my_modules/raw-parser/dcraw.js` 由 RAW HTML 直接加载；TIFF Worker 使用 UTIF。

**改造**：自有 Worker 编排和消息类型纳入 TS；用明确 URL/资产清单交付，具备任务 ID、取消、错误协议。第三方编解码实现不重写。核对重复 HEIF 副本的消费者后再做去重。

### 3.3 原来范围之外的页面、扩展与宿主

#### F17｜工具页、媒体页是实际产品入口，不是自动豁免的演示文件【P1；活跃、图外 UI】

- `frontend/public/workbench.html:396–408` 仍是内联 JS 和手动 DOM；`electron/main.cjs:1690、1705` 菜单/托盘可打开工作台。
- `workbench.html:435–458` 媒体路径固定拼接 mock-library；构建 `:259–263` 却删除产物 mock 数据。
- `frontend/public/roadmap.html:464–489` 只读 `?api=`，不读页面注入的 API 基址。
- `frontend/public/media-viewer/audio.html:22–35`、`video.html:20–25` 是自有播放胶水；`pages.html:56–72` 提供导航和样例入口。
- `replaced/{registration,manage-device}.html` 是无脚本替代展示页，但只在 dev 映射旧 URL；其实际 public 路径下相对 CSS/图片解析不同。

**改造**：继续交付的工作台/路线图/媒体 UI 迁入 `src/app/react/tools`、`viewers/media` 等目录，稳定外部 URL；统一 API client 与媒体资源地址。pages 保持纯导航可明确豁免 React；注册/设备页选择正式支持或开发专用，前者修生产路径，后者移除生产链接。

注：工具页里的 `$ = getElementById` 不是 jQuery，不能作为加载旧框架的证据。

#### F18｜浏览器扩展没有纳入迁移与真实生产回归【P1；独立现役入口】

- `frontend/public/browser-extension/manifest.json:16–34` 指向 background、popup、content。
- `background.js:1–13` 固定端口 41593；`popup.js:6、14` 依赖 Chrome API并打开固定 5176 工作台。
- `scripts/start-production.mjs:26–34` 显式设置端口；`backend/src/server.js:3421–3424` 只有未设置环境端口时才启动 41593 兼容监听。因此不能靠开发态兼容端口证明生产可用。
- `tests/browser-capture-electron-extension-e2e.mjs:12` 使用 MV2 fixture，并非实际交付的 MV3 扩展；普通 HTTP 打开 popup 也不是扩展环境。

**改造**：独立 extension 构建目标：popup 可 React，background/content 用 TS；统一可配置服务地址及 manifest 权限，不依赖 inline script/eval。真实安装构建后的 MV3 产物，验证采集→入库→主窗刷新、服务离线/重连和非默认端口。

#### F19｜插件页面由后端单独供给，且根目录/生命周期不一致【P1；条件活跃】

- `backend/src/server.js:128–135` 从 `tests/fixtures/plugins` 供给示例页面，模板目录解析到工作区外 `H:/resources/plugin_templates`；本轮只读核查未找到该外部目录。
- `electron/main.cjs:1715、1731` 尝试加载 `H:/dev/plugins/example-service-plugin`，与后端 fixture 不是同一位置，本轮未找到该路径。
- `server.js:118–121` 把 shim 插在 `</head>` 前，但 fixture 的 plugin.js 在前面加载；`tests/fixtures/plugins/example-service-plugin/js/plugin.js:1–22` 使用 CommonJS/service 生命周期，普通浏览器不天然具备 require/eagle。
- `electron/main.cjs:3531–3542` 仅检测 `window.eagle` 不能证明前面的业务脚本成功运行。
- `components/detail/DetailViewer.tsx:159–167` 条件 webview preload 指向 `js/plugin/api-format-extension.js`，不经 renderer 的 require 截获；其 `/src` URL 到真实文件路径还需专项验证。

**改造**：显式分离 service 插件、窗口插件、格式查看插件；统一插件根和部署根，先装 SDK 再执行业务；SDK 具备真实生命周期而不是只有对象存在。第三方插件不能被要求统一重写为 React；自有示例/模板可以现代化。保留 preload 所需文件直到对应闭环通过。

#### F20｜`src` 下仍有完整旧宿主配置，但不是当前根构建入口【P2；旧宿主/依赖边界待隔离】

- `src/package.json:12、19–38` 保留 Webpack 4、旧打包工具、旧 `build/dev/jsc` 命令。
- `src/run.js:1–5` 加载 bytenode 与 `.jsc`；引用的 eagle.config.js、build_script 实际缺失。
- `src/app/main.js:84–96` 是入口体为空的 Webpack 壳；未见现役 app 加载点。
- `src/build/config.gypi` 属于旧 node-gyp 产物；`src/test/api-v2/test-snippets.js:4–11` 是旧端口手工测试。
- `src/eagle.babel` 实为 BabelEdit 翻译工程 XML，**不是 Babel 编译配置**。
- `moduleRegistry.ts:156–166` 还尝试 nativeRequire `fs-extra`；旧依赖树中的模块不能仅凭“旧宿主不用了”整体删除。

**改造**：建立旧宿主隔离台账，明确唯一根启动入口；先识别真正被原生解析的依赖并纳入当前包，再把无消费者的旧构建入口退出日常操作/发布。字节码不执行、不反推内部零依赖。i18n/配置资源与旧宿主分开处理。

### 3.4 类型、生产、门禁和文档

#### F21｜TypeScript 零诊断存在明确免检边界【P1；实测】

- `tsconfig.json:21–26` 仅 include `src/app/react`，无 allowJs/checkJs；209 个根文件均在 React 子树。
- `tests/typecheck.mjs:45–54` 豁免 8 个 shim 文件；`:108–110` 把 shim 排除后显示“待撤销 0”，容易误导。
- **内存撤掉 8 个 @ts-nocheck 后，原严格配置得到 460 条诊断**，未改磁盘。
- `tests/shim-module-boundaries.mjs` 只守护有限名称边界，不是完整语义类型检查。
- `typecheck.mjs:65–67` 仅检查前 40 行、精确单行形式的指令，不能当成完整 TS 指令解析器。

| shim 文件 | 内存撤销免检后的诊断数 |
|---|---:|
| browserRuntime.ts | 58 |
| demoSeed.ts | 61 |
| desktopCapability.ts | 59 |
| environment.ts | 3 |
| install.ts | 31 |
| ipcBus.ts | 98 |
| moduleRegistry.ts | 97 |
| settingsI18n.ts | 53 |
| **合计** | **460** |

**改造**：按浏览器/Worker/扩展/Node 划分类型配置；每批撤销一个边界的 nocheck，先设计真实接口再清诊断。第一方运行代码纳入门禁，第三方显式豁免。460 是类型债指标，不是460个确认功能故障；也不以 any 的总数直接判断迁移失败。

#### F22｜生产配置仍被构建期地址和开发中间件分割【P1；静态链确认】

- Vite `:14–16、32–36、73–76` 在构建时写入 API/扩展/缩略图地址。
- public HTML 注入只在 dev 中间件 `:185–194`；生产静态服务 `scripts/serve-frontend.mjs:50–80` 不补配置。
- `start-production.mjs:20–50` 改的是进程环境和端口，不会重写已有 HTML。
- `react/viewers/document/src/lib/api.ts:30–38、55–56` 直接消费 HTML 全局配置；主窗 IPC 正常不能代替子窗地址验证。

**改造**：推荐统一运行时配置端点/受控配置脚本，dev/prod/窗口共享；同一产物可换端口。若选择构建时不可变配置，必须撤回“启动时可覆盖”的承诺。生产启动还应等待服务就绪再开窗。

#### F23｜产物门禁会放过真正缺失的主入口 JS【P1；内存负向探针已复现】

- `tests/dist-entry-check.mjs:84–86`：缺资源时，只在源码同路径存在才 FAIL，否则 WARN。
- `:95–98`：module 入口只查 `/assets/` 前缀；打包生成 JS 本来就没有源码同路径。
- **只在进程内让主入口资产 existsSync 返回 false，未删除文件，检查仍退出 0 并打印 DIST_ENTRY_CHECK_OK。**
- `:34` 静态页只查 pages；不覆盖工作台、路线图、扩展及后端插件入口。
- 正则仅覆盖双引号 HTML src/href，不递归验证 chunk/CSS/Worker/动态资源。

**改造**：入口/生成资源缺失无条件失败；历史已知缺失需逐条精确豁免和退出日期，不能以“源码也缺”普遍放行。所有资源类别做负向测试，产物关联源码与构建身份。

#### F24｜构建仍大范围复制旧树，失败不会自动失败；后端交付依赖源码【P1/P2；配置确认】

- Vite `:223–257` 复制 app/my_modules/i18n/config；失败只 console.error，不抛错。
- `closeBundle` 把输出目录写死为 `dist/frontend`，仅 CLI 改 outDir 不是可靠隔离构建。
- `backend/src/server.js:76、95、128–135、1385–1388、3150–3169` 等仍从源码 public、fixture、工作区外模板、源码图标供给。

**改造**：允许清单 + 必需资源校验 + 复制失败即失败；输出根唯一配置。后端静态资产有正式部署目录，不依赖 tests 或隐式父目录。独立部署验收使用隔离项目副本/最小包，不移动真实工作区。

#### F25｜测试兼容层与覆盖登记可能掩盖迁移遗漏【P1/P2；实测门禁与源码确认】

- `tests/react-cdp-harness.mjs:197–245` 注入 `$bodyScope`，补 `$evalAsync/$eval/$destroy` 等测试兼容面；真实主窗未必有相同接口。
- `tests/react-rewrite-sentinel.mjs`、`scope-field-convergence.mjs` 的主要扫描面仅 React TS/TSX；后者字符串写点门禁通过不等于所有动态属性都已收敛。
- `tests/frontend-acceptance.mjs` 区分了未执行阶段，这是正确的；但覆盖登记含未执行命令，不能把 COVERAGE_OK 当本轮执行覆盖。
- 同文件 `:188` 只阻断已执行且失败的前置阶段，单跑 artifact 可验旧产物。
- 根 `package.json:11` build 仅运行 Vite，不自动包含 typecheck/static。

**改造**：保留现有迁移回归，同时增加不注入旧 API 的生产行为测试；报告分别列已登记、已执行、跳过、阻塞。发布检查强制类型→静态→新构建→产物→业务，不把 build 成功当收官。

#### F26｜已有台账包含失真或过宽保留口径【P2；文档对照确认】

需修正 `docs/frontend-entry-ledger-2026-09-14.md`：

- `:24` 采集窗仍列 jQuery/jQuery UI/SweetAlert，现状已用自研拖拽/弹窗；CSS 保留不等于 JS 框架活跃。
- `:34` “注册/设备页未进产物”不精确：public replacement 原文件存在于产物，但旧 URL 缺映射，两个概念不同。
- `:129–132` 把有 require 文本当旧插件/API/utils 实际执行，忽略 moduleRegistry 的截获。
- `:137` tab-bar “未接入构建链/仅注释残留”不精确：JS 内有真实 Angular 调用，随 public 交付，但无现役加载点。
- `:12、66` 仍有“排除 app 下 .html”的旧表述；实际只排除登记的 React HTML，其他 HTML会复制。
- 多处源码注释仍引用已删除 `frontend/public/shims.js` 或声称有 await/完整晚注册支持；不得把这些注释当行为证明。

**改造**：文档采用“入口 × 环境 × 加载/截获 × 类型 × 交付 × 行为测试”矩阵；历史记录保留时间语境，最新结论必须对应当前代码。

---

## 4. 明确保留与禁止误判清单

| 对象 | 为什么暂时保留 | 需要做什么，而不是什么 |
|---|---|---|
| PDF.js、O3DV 页面 | 专用第三方渲染器，有真实入口 | 资源清单、版本/许可、父子页契约；不是重写引擎 |
| Electron PDF/video 缩略图 worker | `backend/src/thumbnail-task-service.js:185–255` 启动独立后台渲染 | 类型化任务和路径校验；不是改成 React UI |
| dcraw、UTIF、libheif/WASM、SuperGif、MediumEditor、video.js、WaveSurfer | 算法/播放器/编辑器依赖 | adapter、生命周期、显式加载；不按扩展名清理 |
| i18n、字体、图标、CSS | 资产与视觉契约 | 去除无消费者副本前先验证；不是“旧目录即垃圾” |
| `ng-*` 属性/类与旧 CSS | 如 base.css 的 `[ng-click]` 参与 Electron no-drag | 与选择器成对迁为 data-*；不要先全量删属性 |
| scope/driver 命名 | 很多已是 store-backed 兼容面 | 按真实读写/动作收口；不把名字等同 Angular runtime |
| 第三方插件 | 外部契约和开发者代码 | 隔离宿主/SDK及权限；不要求用户插件都变 React |
| `src/node_modules` | 可能存在原生模块解析借用 | 查依赖解析闭包后迁入根依赖；禁止整树直接删除 |
| 历史字节码/旧宿主 | 本轮未执行、不知内部依赖 | 标明非支持入口、隔离归档；不冒险运行 |

特别注意：本轮未请求增加任何 3D/视频生成能力。此处仅核查仓库已存在的查看器和媒体播放/缩略图代码。

---

## 5. 可执行改造计划

### 5.1 总体原则

1. **保持原地和 URL 稳定**：应用 UI/自有业务仍收敛到 `src/app/react`，不再另建一套平行主前端。
2. **先修闭环，后拆架构**：持久化假成功、缺失动作、启动顺序优先。
3. **先让门禁识别失败，再追求绿色**：每个门禁至少有一个应失败的负向用例。
4. **保留视觉和数据语义**：网格布局、缩放、快捷键、选中、跨窗、导入导出、源目录模式均是回归约束。
5. **类型化接口优先于机械翻译**：不把 `.js→.ts` 加 any、继续无约束全局执行当完成。
6. **删除最后做**：必须有消费者清单、替代落点、生产请求证据、回退方案；不恢复或覆盖用户已删文档。

### 5.2 批次总览

| 批次 | 目标 | 对应发现 | 前置 | 产出 |
|---|---|---|---|---|
| M0 | 统一范围与修验收盲区 | F21/F23/F25/F26 | 无 | 全入口/资源/能力台账、负向门禁 |
| M1 | 修写回、动作、启动、退订 | F04/F06/F08/F09/F10/F15 | M0；紧急缺陷可同步先修 | 可验证真实行为，不再静默假成功 |
| M2 | 正式能力与模拟能力分离 | F01/F05/F07/F21 | M1 | 类型化 RuntimeServices、demo 边界、逐项撤 nocheck |
| M3 | 第一方经典业务脚本进模块图 | F03/F04/F05/F16 | M2 的边界契约 | ESM 规则/缩放/helper、自有 Worker 协议 |
| M4 | 原目录内收口窗口/状态/生命周期 | F11/F12/F13/F14 | M1；依赖 M2/M3 对应端口 | 每窗可独立安装/释放、可追踪动作 |
| M5 | 外围工具 UI 与统一生产配置 | F17/F22 | M0、M2 的 API 契约 | 工具页 MPA、稳定 URL、运行时配置 |
| M6 | 独立扩展与插件交付闭环 | F18/F19 | M2、M5 配置协议 | MV3 真实产物、插件类型化 SDK/示例 |
| M7 | 隔离遗留宿主并最小化交付 | F02/F20/F24 | 相关替代模块及插件闭环完成 | 无闲置 Angular 代码的正式资产清单 |
| M8 | 全工作区验收与重新发布收官口径 | 全部 | M0–M7 | 新构建证据、完整验收矩阵、剩余例外台账 |

依赖不要求所有工作串行：M5 可与 M3/M4 并行，但需要先统一 API/配置接口；M6 的扩展与插件可分两个子批。不要把 M7 的大清理提前到 M1。

### M0：范围台账与可失败的门禁

**动作**
- 为每个实际入口登记 owner、运行环境、源码、对外 URL、加载方式、构建/复制规则、必需能力、类型配置、测试。
- 补工作台、路线图、媒体、扩展 popup/background/content、插件三类入口、后台 Worker。
- 修 `dist-entry-check` 的缺入口误放行；遍历构建 manifest 和显式动态资源清单。
- 类型日志真实展示 8 个免检文件，不把“待撤销0”当全面完成；静态扫描覆盖所有自有运行文件。
- 测试聚合区分执行状态，并关联构建来源。

**验收**
- [ ] 内存模拟缺主入口/共享 chunk/CSS/Worker/字体/插件必要资产，每一类都失败。
- [ ] 新增第一方运行脚本但没登记时失败；注释和第三方包不误报。
- [ ] 单跑 artifact 必须验证匹配构建身份，或明确标记不具备完整验收资格。
- [ ] 旧环境和真实环境测试名单可区分。

### M1：优先修功能闭环

**动作**
- 旋转/翻转由受控后端或桌面端执行；明确写文件与仅预览两种模式。
- 补字体改名/星标/激活状态/拖拽及菜单动作的真实供给；消除内部不必要的字符串派发。
- 修 `main.tsx` 的就绪 Promise；预览 boot 移出前置内联脚本。
- 修 preload 包装回调的退订协议，并让窗口 effect 使用 disposer。

**验收**
- [ ] 在隔离测试资源库，对非对称图片旋转/翻转后读回像素方向、宽高、metadata；重新打开仍正确。
- [ ] 权限拒绝、格式不支持、能力不可用时明确失败，不发成功事件、不改成功状态。
- [ ] 字体查看器改名和0–5星，主窗和预览父窗分别验证，重启读回一致。
- [ ] 慢速/延迟模块装配下立即执行跨窗动作，不丢失、不重复。
- [ ] 同 callback 订阅/退订100次后无残留；窗口开关不累计 init 回调。
- [ ] 无测试预注入的浏览器和 Electron 预览页无 require/appRoot 初始化错误。

### M2：替代正式运行中的万能 shim

**动作**
- 定义有限 `RuntimeServices`：环境、设置、库查询、写操作、窗口、IPC、插件、媒体任务。
- 以现有 backend/preload 为真实实现，demo 实现显式选择；不要第二次复制业务。
- 把未知模块/能力改为明确 unavailable/error；迁移调用方后再撤旧路径分支。
- 按环境/设置→模块加载→IPC/桌面→demo 的依赖顺序，逐模块撤销 nocheck。
- 清理 guarded Angular 分支与失效 digest 诊断；窗口类别用于实际选装，而不只是诊断标记。

**验收**
- [ ] 正式模式调用任何已登记写能力都是真实现或明确拒绝。
- [ ] demo 不写用户资源，真实模式不读取 demo seed 冒充业务数据。
- [ ] 不全局伪造 process/Buffer/媒体原型来隐藏能力缺失；确需兼容处列有限适配。
- [ ] shim 完整类型检查通过，不以补一圈 any 或扩大豁免为完成方式。
- [ ] IPC 单路由和唯一写状态实例保持，导入/保存不双发。

### M3：业务脚本与自有 Worker 模块化

**动作**
- 规则族、缩放 helper、设备数据、默认配置及预览实际 helper 转具名模块。
- 拆出 vendor 内混入的第三方部分，保留许可；删除相应 fetch-text-script 路径。
- Worker 自有编排与消息定义转 TS；经典第三方 importScripts 若保留，登记显式资源依赖。
- 删除已无消费者的原入口前，执行新旧规则结果对照。

**验收**
- [ ] 智能文件夹规则、颜色/名称匹配、缩放设备判断对照样本结果一致。
- [ ] 首次冷启动立即搜索/缩放，没有“稍后才加载好”的空函数窗口。
- [ ] 应用自有业务不再通过 new Function/文本 script 执行。
- [ ] RAW/TIFF/HEIF/GIF/音视频路径均能解析全部必需资产；取消任务不回写已关闭窗口。

### M4：窗口和 scope 收口

**动作**
- 推荐顺序：采集→偏好→预览→主窗剩余菜单/侧栏，按窗口拆可变 controller。
- 优先完善 dispose，再转 `useSyncExternalStore`/zustand；保留既有状态语义。
- 内部读写走具名 store/action；外部 driver 只暴露小型只读快照与命令。
- domLite 只限受控引擎岛，逐个迁出普通 UI；MediumEditor/GIF 等加生命周期 adapter。
- 修 URL 服务双向同步与 `canGoBack/canGoForward` 方法调用；测试历史回程恢复视图。

**验收**
- [ ] 不依赖 harness 补 `$bodyScope` 也能完成用户操作。
- [ ] 多窗同条目编辑/切库/关闭重开一致；退订准确。
- [ ] 反复挂载/卸载后监听、定时器、DOM/播放器实例不增长。
- [ ] 连续网格、缩放、滚动、选中和快捷键回归通过；ng-* 与 CSS 契约成对替换。
- [ ] 浏览历史前进/后退恢复文件夹、筛选、页码/滚动语义，无无条件 goBack/goForward。

### M5：外围工具 UI 与生产运行配置

**动作**
- 将继续支持的工作台/路线图/媒体 UI 移入 `src/app/react`，用 MPA 构建入口保留原 URL。
- `frontend/public` 只存纯静态资源/明确豁免页，不继续承载隐藏业务脚本。
- 统一运行时配置，所有页面使用同一 API/缩略图/扩展基址策略。
- 媒体资源根据当前真实库和后端受控接口取址，不拼 mock-library。
- 注册/设备展示页与 pages 导航明确支持策略；dev/prod 一致。

**验收**
- [ ] 同一份产物在非默认端口启动，主窗、文档窗、工作台、路线图实际请求全部命中新服务。
- [ ] 生产不含 mock 数据仍能从真实测试库打开音视频。
- [ ] 所有菜单和导航目标存在；如果开发专用则生产不显示链接。
- [ ] 新 UI 纳入类型检查与行为测试，外观/操作流程无未经确认的改版。

### M6：扩展和插件专项

**动作**
- 扩展保持独立 manifest/产物；popup React，background/content TS，禁止依赖页面 shim。
- 统一端口发现/配置，按实际连接目标声明 host permissions；普通网页示例与真实 popup 分离。
- 插件统一根目录，区分 service 与 UI；SDK 在入口之前加载，回调真实派发。
- 格式插件 preload 使用可验证的磁盘路径/桌面桥，不把 HTTP `/src` 当原生文件根。

**验收**
- [ ] 用构建出的 MV3 扩展做真实端到端，不以 MV2 fixture 替代交付对象。
- [ ] 插件 create/run/show/hide/exit 有真实行为断言，不只看 `window.eagle`。
- [ ] 没有 `H:/dev/plugins`、`H:/resources` 等隐式开发机依赖。
- [ ] 插件受控打开、调用失败、退出清理和资源缺失都有测试；第三方插件兼容承诺单列。

### M7：最小产物与遗留隔离

**动作**
- 收集被 nativeRequire 使用的依赖，纳入当前根包；仅隔离已证明无生产消费者的旧宿主。
- 发布资产从整树 copy 改为登记驱动，必要资源复制失败即失败，输出目录统一配置。
- 后端示例/模板/图标从部署资源根读取，不从测试目录和父级目录读取。
- tab-bar 做产品选择；URL factory 等退役代码退出生产；原始对照资料可以保留于非发布区。

**验收**
- [ ] 正式产物不再携带闲置 Angular factory/tab-bar/旧宿主构建脚本。
- [ ] 专用引擎、格式插件 preload、动态资产无漏拷。
- [ ] 最小隔离部署副本能完整启动，不读取源工作区、tests 或未登记的 src/node_modules。
- [ ] 不为得到绿色而删除测试或广泛豁免资源；每项退役有替代及回滚记录。

### M8：最终收官

**执行矩阵**
- 类型：React UI、Worker、扩展、跨进程协议；Node 端按独立配置逐步受检。
- 静态：第一方无 Angular 可执行分支、无未登记业务经典脚本、无未知能力静默成功。
- 构建：当前源码构建身份、入口资源闭包、复制失败/缺资源负向测试。
- 运行：浏览器演示/连接模式（按产品支持范围）、Electron dev、Electron prod、非默认端口。
- 业务：导入、重命名、星标、旋转翻转落盘、跨窗、偏好、插件、扩展、各格式查看、连续网格。
- 生命周期：重复开关、切库、卸载、取消任务、服务断线重连。

**收官标准**：每个入口都有明确 owner、来源、构建方式、类型边界、能力依赖和通过的行为证据；保留第三方引擎有说明；所有已知缺项归零或明确标为未支持，不能用“页面能打开”代替闭环。

---

## 6. 本轮实际验证记录

使用受管 Node 22.22.2 运行只读脚本；下面表格不是未来验收计划，而是本轮已得到的输出。

| 检查 | 实际结果 | 正确解释 |
|---|---|---|
| `tests/typecheck.mjs` | 退出0；0诊断；nocheck台账8个，“待撤销0” | 现有范围/豁免下通过，不等于全前端受检 |
| `tests/shim-module-boundaries.mjs` | 退出0；8个 shim 名称边界通过 | 不代表完整类型语义通过 |
| `tests/scope-field-convergence.mjs` | 退出0；199已收敛字段/10域，315注册字段，57挂载槽、24函数站点 | 当前字面量登记规则通过，动作供给仍可能缺项 |
| `tests/dist-entry-check.mjs` | 退出0；FAIL 0 / WARN 2 | 当前旧规则通过；两条警告为注册/设备旧 URL |
| 内存模拟主入口 JS 不存在 | 仍退出0；FAIL 0 / WARN 3 | **确认入口缺失门禁存在误放行**，文件未删 |
| 内存去掉8个 shim 的 nocheck | 209根文件；460条诊断 | 量化被免检的类型债，磁盘未改 |

### 6.1 可以直接重跑的只读检查

在工作区根执行，使用项目支持的 Node 版本：

```bash
node tests/typecheck.mjs
node tests/shim-module-boundaries.mjs
node tests/scope-field-convergence.mjs
node tests/dist-entry-check.mjs
node tests/frontend-acceptance.mjs --list
```

注意：`frontend-acceptance.mjs --stages=static` 会写验收 JSON，不等同纯只读枚举；`npm run build` 会清空并重建既定 dist 输出。本轮均没有用这两者改变产物。

### 6.2 负向探针的复核方式

1. **缺入口探针**：读取当前主窗产物的 module src；只在当前 Node 进程包装 `fs.existsSync`，对那一个资产返回 false；再导入原 `dist-entry-check.mjs`。原文件与产物完全不变。得到 `DIST_ENTRY_CHECK_OK`，表明失败判据不足。
2. **类型豁免探针**：读取原 tsconfig；创建 TypeScript CompilerHost；只在 `readFile` 返回值中移除 `core/shim` 八个文件的 `@ts-nocheck`；调用 `getPreEmitDiagnostics`，按文件汇总。本轮8项合计460，未将修改写回磁盘。

### 6.3 尚未执行的验证

- 未新构建、未启动 Electron/浏览器 UI、未运行完整 acceptance 或后端测试。
- 未对用户素材进行旋转/翻转、改名、导入导出或插件安装。
- 对字体动作、菜单、预览启动、非默认端口、MV3扩展等结论，证据为可核对的源码调用链；实施时必须补真实交互复现和回归。
- 对旧宿主 `.jsc` 内部、未安装用户插件和工作区外缺失目录的功能，不作超出静态证据的推断。

---

## 7. 最终建议

不要把下一轮命名为“再清理一点旧文件”，建议按 **M0 门禁范围 → M1 功能闭环 → M2/M3 运行契约和模块图 → M4/M5 内外 UI → M6 扩展插件 → M7 最小交付 → M8 验收** 推进。

本项目真正需要补齐的是：**第一方业务都有真实、可类型检查、可构建追踪、可验收的执行路径；旧框架代码要么有明确替代，要么明确隔离；第三方引擎只保留必要边界。**

这样才能避免“React 文件很多、入口也能打开、门禁都是绿色，但某个窗口按钮不工作或生产分支仍走旧逻辑”的再次出现。
