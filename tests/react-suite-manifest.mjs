/**
 * R7：前端验证面的**单一事实来源**。
 *
 * 背景：R7 要求「开发态探针与产物行为测试分开维护」，且验收结论不得用套件数量替代。
 * 若套件清单散落在 runner 内联数组里，则「删掉一项测试」与「修好一项测试」在 CI 输出上
 * 无法区分。故把清单与**分类**集中在此，由
 *   - `tests/run-react-suite.mjs`（执行）
 *   - `tests/frontend-acceptance.mjs`（统一验收入口，校验分类覆盖与必需项齐备）
 * 共同 import，任何一方单独改动都会让另一方报错。
 *
 * 分类口径（互斥，按测试实际**验证手段**判定，不按文件名）：
 *   - `static`    ：不起浏览器/Electron，只做类型检查、源码扫描或内存转译。
 *   - `dev-probe`  ：起 Vite dev（URL 为 `/src/app/...` 源码路径），驱动真实浏览器行为。
 *   - `artifact`   ：针对 `dist/frontend` 正式产物（不依赖 Vite dev 与源码路径）。
 *
 * `browser-capture-ui-closed-loop.mjs` 的 Inspector 单色面板守卫是**源码文本探针**
 * （fetch 转译后的 TSX 并比对字面量），单独登记在 SOURCE_TEXT_PROBE_SEGMENTS 中——
 * 它守护的是一个没有稳定行为夹具可触发的既有修复，不得把它当成行为验证，故显式标注。
 */

/** 全量 React 回归套件（顺序隔离执行；清单顺序即执行顺序）。 */
export const REACT_SUITE = [
  'tests/react-rewrite-sentinel.mjs',
  'tests/react-utils-native.mjs',
  // P1-b：IPC 接缝（core/channelBridge）单路由不变量 —— 纯原生直通频道走 preload 通用 ipc、
  // 其余走 shims 总线，事件面前转。无 Electron、秒级。
  'tests/react-ipc-bridge-routing.mjs',
  // R0：连续网格几何单元测试（纯 Node + typescript 内存转译，无 Electron、秒级）。
  // 覆盖四布局 10,000 条的总高度/坐标/可见窗口与锚点还原。
  'tests/continuous-grid-layout.mjs',
  // F10：跨窗供给的启动就绪序列（纯 Node + typescript 内存转译，无 Electron、秒级）。
  // 覆盖未就绪期跨窗调用的可观测失败、装配顺序与「挂载/接管同处同步前缀」不变量、
  // 重复 startBoot/重复装载的幂等，以及 main.tsx 的静态接线（动态 import 保留但真正 await）。
  'tests/boot-ready-sequence.mjs',
  // R0-1（2026-09-17 验收整改 §3.1）：窗口几何的**纯函数门禁**（纯 Node、秒级、无 Electron）。
  // 守护「启动后窗口不见」那个缺陷：陈旧 window-state.json 把主窗建到屏幕外时，落盘几何必须被丢弃。
  // 逻辑已抽到 electron/window-geometry.cjs（不依赖 electron 才能被穷举），main.cjs 只剩薄封装；
  // 含负向自证（修复前实现必被判死）与接线自证（main.cjs 不得自带第二份实现）。
  'tests/electron-window-geometry.mjs',
  // R0-2（2026-09-17 验收整改 §3.1）：`electron/**` 的静态门禁（纯 Node、秒级、无 Electron）。
  // 主进程此前不在任何门禁视野内（tsconfig 只收 React 子树、哨兵只扫 TS/TSX、全仓扫描不收 .cjs），
  // 本项补三道闸：落盘窗口几何必须经可见性对账、主进程依赖面快照（增删改 require 必须更新基线）、
  // 生产可达代码不得残留 /mock- 伪造路径常量；另附 webPreferences 安全面快照。
  'tests/electron-main-gates.mjs',
  // R1-4（2026-09-17 验收整改 §12）：`swallowReport` 集中上报通道的契约测试
  // （纯 Node + typescript 内存转译，无 Electron、秒级）。
  // 守护「被吞掉的错误重新变得不可观测」——这个模块一旦坏是**静默地**坏，故必须有门禁。
  // 覆盖零依赖装载、限流（同 key 前 3 次上报后只计数，防逐帧 catch 打爆日志）、
  // 自身绝不抛错（含注入敌意 Map 的负向自证）、跨 realm 取 message、环形缓冲上限。
  'tests/swallow-report.mjs',
  // R1-4（2026-09-17 验收整改 §12）：空 catch **棘轮门禁**（纯 Node + AST，无 Electron、秒级）。
  // 一次性清理数百处不现实，可持久的是「不再新增」：存量登记在基线里，
  // 任何未带 /* @swallow: 理由 */ 的新增空 catch 一律判红；允许减少不允许增加。
  // 含三条自保断言：扫描器失效（数量异常偏少）时门禁必须红而不是空洞变绿、
  // 基线文件可用、上报通道零依赖。
  'tests/empty-catch-gate.mjs',
  // R2：shim 模块跨模块标识符完整性（纯 Node + typescript CompilerHost，无 Electron、秒级）。
  // 拆分 core/shim/* 后，「标识符留在别的模块、此处未 import」是运行期 ReferenceError 的主因，
  // 且 @ts-nocheck 与打包器都不报——本项以剥离 nocheck 的类型检查精确拦截。
  'tests/shim-module-boundaries.mjs',
  // R3：类型门禁（零容忍）——`src/app/react` + `frontend/document-viewer` 全范围 0 诊断。
  'tests/typecheck.mjs',
  // R4：scope 字段「零字符串键」收敛台账（纯 Node、秒级；已收敛域不得回退为字符串键）。
  'tests/scope-field-convergence.mjs',
  // F06：旋转/翻转写回（纯 Node + typescript 内存转译，无 Electron、秒级）。
  // 覆盖能力未接线时明确失败（旧行为是静默假成功 + 把 TypeError 记成「加载模块失败」）、
  // 宽高经唯一元数据通道写入一次并以回执校验落库、预览窗与主窗共用同一写回实现。
  'tests/image-ops-writeback.mjs',
  // F06 第三批：格式分流的**唯一判定点** + 非 JPEG 的后端通路 + 解桩后的真实受理。
  // 覆盖同一入口按扩展名分流（.jpg/.jpeg → 渲染层，其余 → 后端）、后端结构化错误码
  // （415/403/404）原样到达渲染层、真实 rotateImage.js 驱动下不再拒绝且真实改写 EXIF、
  // 非 electron 态与通道缺失必须明确失败、preload 具名方法行为与 main 信封契约。
  'tests/image-transform-dispatch.mjs',
  // M5-1（F17/F22）：`frontend/public` 页面归属分账（纯 Node、秒级）。
  // 把「public 页面 = 交付路径」「源码在 public、URL 在别处」「显式豁免」三类写成可执行
  // 不变量，堵住"往 public 里丢一个没人取舍的页面"这条静默债务通道。
  'tests/frontend-public-policy.mjs',
  'tests/react-stage-smoke.mjs',
  'tests/react-stage5-smoke.mjs',
  'tests/react-stage6-smoke.mjs',
  'tests/react-stage7a-smoke.mjs',
  'tests/react-stage7b-smoke.mjs',
  'tests/react-stage7c-smoke.mjs',
  'tests/react-stage7c2-smoke.mjs',
  'tests/react-stage7d1a-smoke.mjs',
  'tests/react-stage7d1b-smoke.mjs',
  'tests/react-stage7d1c1-smoke.mjs',
  'tests/react-stage7d1c2-smoke.mjs',
  'tests/react-stage7d2-smoke.mjs',
  'tests/react-stage7d3a-smoke.mjs',
  'tests/react-stage7d3b-smoke.mjs',
  'tests/react-stage7d4-smoke.mjs',
  'tests/react-stage7d5a-smoke.mjs',
  'tests/react-stage7d5b-smoke.mjs',
  'tests/react-stage7d6a-smoke.mjs',
  'tests/react-stage7d6b-smoke.mjs',
  'tests/react-stage7d6c-smoke.mjs',
  'tests/react-stage8a-smoke.mjs',
  'tests/react-stage8b-smoke.mjs',
  'tests/react-stage8c-smoke.mjs',
  'tests/react-stage8d-smoke.mjs',
  'tests/react-stage8e-smoke.mjs',
  'tests/react-stage8e2-smoke.mjs',
  'tests/react-stage9a2-smoke.mjs',
  'tests/react-stage9a3-smoke.mjs',
  'tests/react-stage9b1-smoke.mjs',
  'tests/react-stage11a1-smoke.mjs',
  'tests/react-stage11a2-smoke.mjs',
  'tests/react-stage11a3-smoke.mjs',
  'tests/react-stage11a49-smoke.mjs',
  'tests/react-stage11b0-smoke.mjs',
  'tests/react-stage1c2-smoke.mjs',
  'tests/react-stage1c3-smoke.mjs',
  'tests/react-stage1cz1-smoke.mjs',
  'tests/react-stage1cz2-smoke.mjs',
  'tests/react-stage1cz3-smoke.mjs',
  'tests/react-stage1m1-unified-smoke.mjs',
  'tests/main-ui-workflow-closed-loop.mjs',
  'tests/source-mode-ui-closed-loop.mjs',
  'tests/library-switch-ui-closed-loop.mjs',
  'tests/drag-start-closed-loop.mjs',
  'tests/react-s2-sidebar-dnd-closed-loop.mjs',
  'tests/preview-delivery-closed-loop.mjs',
  'tests/channel-wiring-closed-loop.mjs',
  'tests/menu-popup-closed-loop.mjs',
  'tests/txt-update-closed-loop.mjs',
  'tests/empty-trash-closed-loop.mjs',
  'tests/native-preview-closed-loop.mjs',
  'tests/ui-interactions-closed-loop.mjs',
  'tests/residue-closed-loop.mjs',
  // R0：连续网格滚动/自动定位闭环（600 条隔离库 + 全栈）。守护“全列表单一高度、
  // 滚轮与滑块方向一致、停住不回跳、图片加载不改变坐标、AutoScroll 频道到离屏选中项”。
  'tests/continuous-grid-scroll.mjs',
  // ── b1-9bz-D-3：10 项 React 状态→渲染闭环（store/scope 驱动 + 实测 DOM 断言）──
  'tests/d3-boot-render-closed-loop.mjs',
  'tests/d3-viewmode-closed-loop.mjs',
  'tests/d3-search-empty-closed-loop.mjs',
  'tests/d3-alltags-view-closed-loop.mjs',
  'tests/d3-detail-mode-closed-loop.mjs',
  'tests/d3-theme-closed-loop.mjs',
  'tests/d3-loading-closed-loop.mjs',
  'tests/d3-selection-closed-loop.mjs',
  'tests/d3-focus-closed-loop.mjs',
  'tests/d3-store-roundtrip-closed-loop.mjs',
  // ── M2-1：有限 RuntimeServices 契约 + 三态运行模式 + 「能力缺失即明确失败」──
  // 纯 Node（typescript 内存转译 + node:vm 隔离加载真实模块，无 Electron、秒级）。
  // 覆盖：electron/browser-connected/demo 三态判定（浏览器连真后端不再被当作 demo）、
  // 未登记模块/未登记 invoke 频道/无实现 shell·dialog·clipboard 不再「返回成功」、
  // demo 不写用户资源、8 服务单一装配点与依赖表、能力位 false 必带可查原因。
  'tests/runtime-services-contract.mjs',
  // F04：预览窗 boot 契约（静态接线 + typescript 内存转译 + node:vm 跑真实 boot.ts，无 Electron、秒级）。
  // 覆盖内联 boot 摘除、entry.tsx 先安装后求值的顺序不变式、只补缺不覆盖、必需面缺失即抛错。
  'tests/preview-boot-contract.mjs',
  // F15：preload 具名频道的退订契约（纯 Node + typescript 内存转译 + node:vm，无 Electron、秒级）。
  // 覆盖 43 个具名频道一律返回 disposer、退订精确、重复退订幂等。
  // M4-R 审计发现：本项与下一项**此前从未登记进任何套件**，只有 docs 里的手工运行记录——
  // 等于长期未跑。经核实当前通过（43/43、12/12）后登记；两处断言一字未改。
  'tests/preload-subscriptions.mjs',
  // F13-preview：预览窗 entry 的订阅生命周期（100 次挂卸、精确清理、迟到 callback 防护）。
  // 同时钉住 F04 的顺序不变式「boot 校验先于 createRoot」——
  // 该断言是本次登记时补的：F04 给 entry.tsx 加了 `./boot` 依赖，打断了本文件
  // 「禁止加载未隔离的依赖」的实测路径，而本文件不在套件里，全量回归从未暴露它。
  'tests/preview-entry-subscriptions.mjs',
  // M3-1：vendor 里第一方规则函数的具名模块化——逐项对照 vendor 运行期导出（纯 Node、秒级）。
  // 覆盖 26 个 isMatch*Rule / matchStringMethod 各分支 / zoomHelpers 全部导出，
  // 并钉住新模块不得引入裸 require / @ts-nocheck / any。
  'tests/match-rules-equivalence.mjs',
  // M4-C：预览窗 dispose 收口——两处「关掉后仍在真实消耗」的开销（500ms 跨进程轮询、
  // 主进程 leave-full-screen 监听随切项累积）。纯 Node（node:vm + EventEmitter 代表
  // remote 代理面），无 Electron、秒级；含突变测试（逐个移除修复点必现 FAIL）。
  'tests/m4-preview-dispose.mjs',
  // M2-4 / M7-1：moduleRegistry 撤销 @ts-nocheck + 隐式截获表驱动契约化。
  // 覆盖 34 项条目穷尽对照、逐项行为等价性、可观测性结构化记录与 /index.js 封堵。
  'tests/module-registry-contract.mjs',
  // M4-A：URL 双向同步与 goBack/goForward 守卫。纯 Node（node:vm 装载真实源码 + 确定性假浏览器，
  // location.hash setter 排队投递 hashchange），无 Electron、秒级。覆盖守卫真值、
  // popstate/hashchange 触发面与三重防回环、URL→状态四类语义映射、结构守卫。
  'tests/m4-url-history.mjs',
  // M3-2：调用点切换后的冷启动正确性——规则表缺席时**不得写空快照**（`[]` 在 JS 里是真值，
  // 写进 contentFilterCache 后永不复算、不自愈）。纯 Node（node:vm + 桩化宿主），秒级。
  // 含负向自证：把 `if (trustworthy)` 改成 `if (true)` 即 5 条红，红的恰是预期三条。
  'tests/m3-filter-cold-start.mjs',
  // M4-B：采集/偏好窗 dispose 收口 + 主窗 24 个 store 的 bind*Sync 幂等守卫与退订句柄。
  // 纯 Node（node:vm + 真实 listener 计数桩驱动真实 bind/unbind 各 100 次），秒级。
  'tests/m4-window-subscriptions.mjs',
  // M3-3：修「取消任务不回写已关闭窗口」——闸门放在 await 之后、任何 DOM 写入之前。
  // 纯 Node（node:vm 桩化宿主），秒级；负向自证：移除闸门即变红。
  'tests/worker-cancel-writeback.mjs',
  // M3-3：四个自有 Worker 的协议契约（信封/通道/字段/错误文案的唯一事实源在
  // core/workers/protocol.ts；worker 侧因经典 script 边界改用文件头注释 +
  // 本测试的双向 AST 字面量校验）。纯 Node、秒级；7 处单方面改动会全部变红。
  'tests/worker-protocol-contract.mjs',
  // M4-D：ng-* 成对替换（JSX 属性 ↔ CSS 属性选择器必须同改，只删一侧会静默改变
  // 无边框窗口拖拽区与 toast 链接间距）。纯 Node、秒级。
  'tests/m4-ng-click-pairing.mjs',
  // M4-D：第三方引擎 React glue 的生命周期 adapter（挂载→就绪→卸载不变量：
  // 反复挂卸后监听/定时器/DOM/播放器实例不增长）。纯 Node（node:vm + 桩化引擎），秒级。
  'tests/m4-engine-lifecycle.mjs',
  // M4-D：domLite 只限受控引擎岛——普通 UI 必须走 domQuery 原生助手。纯 Node、秒级。
  'tests/m4-domlite-containment.mjs',
  // M4-E：F11 晚注册缺陷——面创建之后才注册的字段在面上没有描述符（直读恒 undefined、
  // 直写落 plain 不落 store）。纯 Node（node:vm 跑真实 scopeFace/scopeFieldBridge），秒级；
  // 含「当前为什么不触发」的 AST 断言与撤钩子负向自证。
  'tests/f11-scope-face-late-registration.mjs',
  // M7-2：tab-bar 退役的**负向门禁**（原先是与实现脱钩、且不属任何套件的恒红用例，
  // 已改造为 11 项断言：源位置不得复活 / 归档完整性与指纹 / 源码树零加载引用 /
  // 清单不得重新登记 / 产物不得交付）。纯 Node、秒级；含 8 项负向自证。
  'tests/tab-bar-closed-loop.mjs',
  // M6-3：格式插件 preload 的**唯一解析点**（纯 Node，秒级，无 Electron）。
  // 原先三处调用点各自内联同一惯用式，在**包括 Electron 生产态在内**的任何运行态下都产出
  // http://<origin>/src/... —— 而 <webview preload> 只接受文件系统路径，故该 preload 从未被加载。
  // 本项钉住：三处调用点收敛到同一具名解析函数、解析入口全仓只有一处定义、
  // Electron 态返回真实磁盘 file:// 路径、非 Electron 态明确不可用、
  // 以及「解析函数在全输入域上绝不产出 http(s) 值」的硬闸门。含 3 项负向自证。
  'tests/plugin-format-preload.mjs',
  // M6-4：webviewTag 恢复的**真机门禁**（起真实 Electron + Vite dev，约 13s）。
  // 背景：Electron 22 的 webviewTag 默认 false，main.cjs 的 createWindow 此前未启用，
  // 三处 <webview> 从不 guest 化、preload 属性根本不生效（格式插件视图实为死的）。
  // 本项经 Vite import 真实的 pluginFormatPreload.ts，把其解析出的 file:// URL 喂进真实
  // <webview>，再断言 guest 侧真的跑起了 api-format-extension.js —— 把 M6-3 与 M6-4 接上。
  // 负向自证（Coordinator 独立实跑）：移除 webviewTag 后 constructorName=HTMLElement、
  // 无 guest、零 attach 事件、guestProbe=null → 0/4 通过、4 红。
  'tests/webview-tag-enabled.mjs',
  // R0-4（2026-09-17 验收整改 §3.1）：窗口可见性的**实机**门禁（起真实 Electron，约 15s）。
  // 与 --smoke 类冒烟的区别：它断言「主窗 bounds 与某个显示器工作区交叠 ≥ 阈值」，
  // 而不只是「进程起得来」。测试向临时 userData 注入屏外几何（y=1262 的真实缺陷样本形态），
  // 起真实主进程后读回最终 bounds；另有一组合法几何证明坐标不是被一律丢弃。
  // 判据复用 electron/window-geometry.cjs，不在测试里抄第二份阈值。
  'tests/electron-window-bounds.mjs',
  // M7-3：发布资产登记的**单一事实源**对账（纯 Node，秒级，无 Electron、不依赖 dist）。
  // 任务书 M7 点名两条：发布资产从整树 copy 改为登记驱动；必要资源复制失败即失败。
  // 本项钉住：清单必须显式登记 src/my_modules 且不得退回父目录整树条目、现存条目/
  // 清单登记项/退役归档三方逐一一致（**与源码实扫对账，不写死数字**）、
  // 以及「调用真实复制函数时源不存在必须拒绝」——含 1 项负向自证。
  'tests/publish-asset-manifest.mjs',
  // ── M8 覆盖面补齐：三个**长期不在任何套件里**的 M1 交付测试。 ──
  // 依 D15「套件之外的测试等于长期未跑」，我用「改动的源文件 ∩ 带沙箱 require 守卫的测试」
  // 做过一次全仓扫描，并逐个单独实跑确认当前通过后才登记；三者的断言一字未改。
  //   F08/F09 动作供给对照契约（W12 交付，13 项 + 34 条未迁移动作台账，删条即失败）；
  'tests/f08f09-action-supply-contract.mjs',
  //   F06 后端图像变换端点闭环（W10 交付，自起 backend 于临时端口，读回像素验证旋转方向）；
  'tests/image-transform-closed-loop.mjs',
  //   P3-b 来源文件夹模式真实点击 UI 闭环（自起 backend + Vite + Electron，全部临时端口）。
  'tests/source-mode-browse-closed-loop.mjs',
  // M8-2：视频夹具的 EBML Duration 注入器（纯 Node，秒级）。夹具被 4 个测试共用，
  // 而 MediaRecorder 写出的 WebM 不含 Duration ⇒ Chromium 恒报 duration === Infinity ⇒
  // detailHooks 的原生→MPV 判据把可播放的夹具误判为不可播放。本项钉住注入器的字节级正确性、
  // TimecodeScale 换算、幂等与「解析失败必须抛错」，含恒等注入下的负向自证。
  'tests/video-fixture-duration.mjs',
  // M8-4：工作台列表的缩略图缺图占位（依据 D33：保后端 404 契约、前端补占位）。
  // 用 CDP 拦截 /api/item/thumbnail 造阳性对照，并对三组卡片做 DOM 快照：
  // 正常图 / 取不到图（onError 兜底）/ 元数据 noThumbnail —— 两组占位盒与被替换的图片盒
  // 必须同为 171x128（证明几何不塌）。含两条负向自证（onError 置空 / 占位逻辑整体摘除）。
  'tests/workbench-thumbnail-placeholder.mjs',
  // ── M8-5：后端侧的两道门禁（纯 Node/临时端口，无 Electron；放这里是为了让统一验收入口真跑到它们，
  //    与既有 image-transform-closed-loop / source-mode-browse-closed-loop 同例）。 ──
  // 行为门禁：/api/item/thumbnail 必须 200 + 真图片字节（该端点自 2026-08-04 起对任何条目恒 404，
  // 真因是 server.js:2056 调用了从未导入的 ensureThumbnail）；未知/缺 id 仍须 404（空态契约不变）。
  'tests/item-thumbnail-endpoint.mjs',
  // 类别门禁：用 TS 编译器建作用域链，报出「被调用却既无本地定义也无导入」的标识符——
  // 这一类（改 import 时漏改调用点）此前**没有任何门禁覆盖**，8cf92c55 的回归正是从这漏过去。
  // 47 文件 / 2828 调用点 0 假阳性（含 25+ 易误伤构造），另有 500 调用点空转护栏。
  'tests/backend-import-integrity.mjs',
];

/** 分类：未登记项按 `dev-probe` 计（默认口径），但必需项必须显式登记。 */
export const TEST_CLASSES = {
  'tests/typecheck.mjs': 'static',
  'tests/react-rewrite-sentinel.mjs': 'static',
  'tests/shim-module-boundaries.mjs': 'static',
  'tests/scope-field-convergence.mjs': 'static',
  'tests/react-utils-native.mjs': 'static',
  'tests/react-ipc-bridge-routing.mjs': 'static',
  'tests/continuous-grid-layout.mjs': 'static',
  'tests/boot-ready-sequence.mjs': 'static',
  'tests/electron-window-geometry.mjs': 'static',
  'tests/electron-main-gates.mjs': 'static',
  'tests/swallow-report.mjs': 'static',
  'tests/empty-catch-gate.mjs': 'static',
  'tests/image-ops-writeback.mjs': 'static',
  'tests/image-transform-dispatch.mjs': 'static',
  'tests/runtime-services-contract.mjs': 'static',
  'tests/preview-boot-contract.mjs': 'static',
  'tests/preload-subscriptions.mjs': 'static',
  'tests/preview-entry-subscriptions.mjs': 'static',
  'tests/match-rules-equivalence.mjs': 'static',
  'tests/m4-preview-dispose.mjs': 'static',
  'tests/m4-url-history.mjs': 'static',
  'tests/m3-filter-cold-start.mjs': 'static',
  'tests/m4-window-subscriptions.mjs': 'static',
  'tests/worker-cancel-writeback.mjs': 'static',
  'tests/worker-protocol-contract.mjs': 'static',
  'tests/m4-ng-click-pairing.mjs': 'static',
  'tests/m4-engine-lifecycle.mjs': 'static',
  'tests/m4-domlite-containment.mjs': 'static',
  'tests/f11-scope-face-late-registration.mjs': 'static',
  'tests/tab-bar-closed-loop.mjs': 'static',
  'tests/plugin-format-preload.mjs': 'static',
  // 起 Vite dev（URL 为 /src/app/... 源码路径）并驱动真实 Electron 行为 → dev-probe。
  'tests/webview-tag-enabled.mjs': 'dev-probe',
  // 起真实 Electron 主进程（不依赖 Vite dev 与源码路径），只校验窗口几何 → dev-probe。
  'tests/electron-window-bounds.mjs': 'dev-probe',
  'tests/publish-asset-manifest.mjs': 'static',
  'tests/f08f09-action-supply-contract.mjs': 'static',
  'tests/image-transform-closed-loop.mjs': 'static',
  // 起 Vite dev + 真实 Electron，但后端与端口都由本测试自己拉起 → dev-probe。
  'tests/source-mode-browse-closed-loop.mjs': 'dev-probe',
  'tests/video-fixture-duration.mjs': 'static',
  // 起 Vite dev + 真实 Electron（CDP 驱动）→ dev-probe。
  'tests/workbench-thumbnail-placeholder.mjs': 'dev-probe',
  'tests/item-thumbnail-endpoint.mjs': 'static',
  'tests/backend-import-integrity.mjs': 'static',
  'tests/module-registry-contract.mjs': 'static',
  'tests/frontend-public-policy.mjs': 'static',
};

/** 产物行为测试（针对 dist/frontend，不依赖 Vite dev / 源码路径）。 */
export const ARTIFACT_TESTS = [
  'tests/dist-entry-check.mjs',
  'tests/production-smoke.mjs',
  // M6-1：扩展交付契约——端口单一来源与生产默认的漂移、权限面闭合性、popup 两加载环境、
  // MV2 对照物仍在且确实不同、产物与源码逐字一致。读 dist/frontend，故先 npm run build。
  'tests/browser-extension-delivery.mjs',
  // M5-2：生产启动**等三个监听口就绪再开窗**，且任一子进程提前退出即 fail-fast。
  // 起完整生产栈 + Electron，属产物层验收（依赖先 npm run build）。
  'tests/start-production-readiness.mjs',
  // M5-2：非默认端口生产验收——四类页面（主窗/文档窗/工作台/路线图）的请求必须全部命中
  // **覆盖后**的端口，且 artifactDigest 不变（证明是「同一份产物换端口」而非重新构建）。
  'tests/production-runtime-ports.mjs',
  // M8-1：**最小隔离部署副本**的启动验收（任务书 M7 验收第 3 条）。
  // 仓库外隔离根 + 三层文件访问探针 + 四页非默认端口启动；核心判据是「实际发生了哪些读」，
  // 不是「代码里 grep 不到路径」——正因如此才查出"没读源工作区、但发布内容本身漏拷"这两件事。
  // 两条负向自证用普通调用跑红（EAGLE_ISOLATION_PROBE_DISABLE=1 / EAGLE_ISOLATION_NEGATIVE=missing-asset）。
  // 依赖先 npm run build（故属产物层，与 M5-2 两项同段）。
  'tests/isolated-deployment.mjs',
];

/**
 * 验收矩阵要求、但不在 React 套件内的关键业务回归（统一验收入口逐个执行）。
 *
 * R7 覆盖面核查发现：`item-persistence-closed-loop`（真实落盘 + 重启读回）与
 * `electron-write-path-closed-loop`（写路径单路由/入队快照/失败隔离）**此前不被任何
 * 脚本引用**——报告 §6「编辑与持久化」把它们列为验证手段，但它们既不进套件也不进
 * `npm test`，等于长期未跑。R7 核实可跑通过后接入本入口与 `npm run test:persistence`，
 * 不改动其任何断言。
 */
export const EXTRA_REGRESSION = [
  'tests/item-persistence-closed-loop.mjs',
  'tests/electron-write-path-closed-loop.mjs',
  'tests/document-viewer-ui-closed-loop.mjs',
  'tests/video-detail-mode-closed-loop.mjs',
  'tests/browser-capture-ui-closed-loop.mjs',
  // 导入导出面的进度/取消闭环：此前只在 `npm run test:full` 的 test:export-progress 里，
  // 不在 `npm test`，故验收入口显式执行（矩阵「导入导出与库切换」必需项）。
  'tests/export-progress-closed-loop.mjs',
  // M6-1：真实浏览器宿主里的 MV3 扩展端到端（自起后端 + fixture HTTP 服务，用**构建出的**
  // MV3 产物，不以 MV2 fixture 替代交付对象）。宿主不可用时打印 `..._BLOCKED <原因>`
  // 并 0 退出——环境缺失不得伪装成产品缺陷。本机实测（Edge 153）已通过。
  'tests/browser-extension-mv3-e2e.mjs',
];

/**
 * 源码文本探针片段：以「读转译后源码并比对字面量」方式守护既有修复。
 * 值 = 该探针的语义与不可行为化理由。
 */
export const SOURCE_TEXT_PROBE_SEGMENTS = {
  'tests/browser-capture-ui-closed-loop.mjs':
    'Inspector 单色面板 palettes.length 判据——需要「恰好一个调色板」的素材才能行为化，'
    + '现有夹具无法稳定产出，故保留源码文本探针并在此显式登记（其行为部分仍为真实 Electron 冒烟）。',
};

/**
 * 验收必需项：统一验收入口会断言这些测试**存在且已登记分类**，
 * 防止「通过删除测试」制造绿色。
 */
export const REQUIRED_TESTS = [
  'tests/typecheck.mjs',
  'tests/react-rewrite-sentinel.mjs',
  'tests/shim-module-boundaries.mjs',
  'tests/scope-field-convergence.mjs',
  'tests/continuous-grid-layout.mjs',
  'tests/boot-ready-sequence.mjs',
  'tests/continuous-grid-scroll.mjs',
  'tests/runtime-services-contract.mjs',
  'tests/d3-selection-closed-loop.mjs',
  'tests/d3-focus-closed-loop.mjs',
  'tests/d3-alltags-view-closed-loop.mjs',
  'tests/main-ui-workflow-closed-loop.mjs',
  'tests/preview-delivery-closed-loop.mjs',
  'tests/native-preview-closed-loop.mjs',
  'tests/document-viewer-ui-closed-loop.mjs',
  'tests/video-detail-mode-closed-loop.mjs',
  'tests/menu-popup-closed-loop.mjs',
  'tests/ui-interactions-closed-loop.mjs',
  'tests/item-persistence-closed-loop.mjs',
  'tests/electron-write-path-closed-loop.mjs',
  'tests/image-import-closed-loop.mjs',
  'tests/folder-import-closed-loop.mjs',
  'tests/export-progress-closed-loop.mjs',
  'tests/library-switch-ui-closed-loop.mjs',
  'tests/source-mode-ui-closed-loop.mjs',
  'tests/txt-update-closed-loop.mjs',
  // F15 / F13-preview：原先不属任何套件（M4-R 审计发现），登记后一并列为验收必需项，
  // 防止「通过删除测试」制造绿色。
  'tests/preload-subscriptions.mjs',
  'tests/preview-entry-subscriptions.mjs',
];

export function classOf(test) {
  return TEST_CLASSES[test] || 'dev-probe';
}
