# Eagle 前端迁移调查报告与剩余改造计划

调查日期：2026-09-14。工作区：`H:/dev/Eagle-Sec-development - 副本`。分支：`react-in-place`。调查时提交基点：`e6345f8d049770051131850905c37d6fe18ded32`，包含当时尚未提交的连续列表改造。

本报告用于继续执行“在原目录 src/app 内原地改造为 React 19 + TypeScript + Vite”。报告中的“已完成”“本次实测”“历史验证”“计划实施”分别标注；初次调查仅生成报告，随后按用户提交要求补做了下述修正。

**提交前更新（同日）：F-02 的 autoscrollChannel 缺失导入已补齐，TypeScript 诊断由调查时的 493 条恢复为 492 条，与连续列表改造前的诊断键逐条一致。** 下文保留调查时的 493 条快照用于追溯；R0 的该项修正已经完成，其余入口/测试门禁整理仍在计划中。

连续列表和自动定位修正已提交为 `195dc3ab1d2f0fd34d35e447dc661450cae38ed3`，后续施工以此为代码基点。提交前重跑了四布局 10,000 条几何测试、600 条隔离库的完整滚动测试和迁移哨兵，均通过；新增 AutoScroll 调用链验证通过。可选截图捕获仍有超时，行为断言独立通过，完整 React 套件未在本次重新执行。

## 1. 调查结论与下一阶段目标

主要业务界面已经由 React 接管，当前页面启动链路未再加载 Angular 运行时。原 Angular 控制器、指令和模板仍有文件留存，但文件存在不等于仍被执行。接下来的工作应在现有 React 实现上推进，不需要重新迁移一遍主界面。

目前尚不足以认定整个前端已经完成迁移并通过工程验收。最直接的缺口是：主应用未纳入正式构建；一部分源码没有接受有效的类型检查；启动层、业务状态访问和独立窗口仍保留移植兼容实现；开发态与生产产物存在入口差异。

**建议下一阶段的完成标准：全部交付界面拥有明确入口，应用自有业务由 React + TypeScript 模块承担，Electron 能加载正式产物，类型检查与关键业务回归通过。** 第三方文件解析、媒体播放、PDF、3D 引擎可以通过明确的适配层继续使用；界面控制、状态管理、快捷键和弹窗等旧业务胶水应继续迁移。

自动定位缺失导入已在提交前修正。接下来先完成 R0 的入口与测试门禁整理，再补齐生产构建。类型治理和兼容层拆分随后按业务模块推进，最后清理旧文件、依赖和过时文档。

### 1.1 范围与保留成果

- 主应用继续在 `src/app` 原地改造，主要实现沿用 `src/app/react`。不另建一个平行主应用。
- 保留现有 React 组件、Zustand store、IPC 写队列、回执差分、预览交付和来源文件夹模式等已经落地的能力。
- 保留本轮连续网格：全列表统一坐标和总高度、仅虚拟化可见 DOM、使用原生滚动条。不得恢复按页替换列表或反复写入滚动位置的方式。
- `frontend/document-viewer` 已是 React 实现，重点是纳入统一类型检查、构建和目录规划；不重写现有文档渲染功能。
- Electron 主进程和后端仅在生产入口、资源路径、配置交付与类型化接口所需范围内配合调整。本计划不要求把后端或 Electron 主进程全部改成 TypeScript，也不以安装包签名、自动更新作为前端迁移的前置条件。
- 旧 CSS 类名、合法的 React Portal、富文本展示、媒体引擎的命令式 API，不单凭形式判定为“迁移失败”。检查重点是状态归属、生命周期、依赖边界和实际行为。

### 1.2 与历史“收官”记录的关系

历史 D/E 阶段主要完成了 Angular 运行时退出、主窗口 scope/digest 退役和旧脚本启动入口摘除。E9 明确把原 shims 的剩余启动契约移入 `shimsLegacy.ts`，因此“shims.js 已删除”和“兼容实现仍在运行”可以同时成立。

[历史退役计划](<H:/dev/Eagle-Sec-development - 副本/docs/e5-5-shims-retirement-plan.md:152>)已将 Angular 死分支清理和浏览器兼容逻辑拆分留作后续工作。[旧总计划](<H:/dev/Eagle-Sec-development - 副本/src/app/react/REWRITE-PLAN.md:11>)还明确提出独立窗口、类型化 service 和旧 UI 依赖替换；本报告把这些目标展开为可验收批次。

历史计划对第三方替换的措辞较宽。本报告建议按角色登记保留范围：旧 UI 胶水继续替换，专用解析/渲染引擎通过适配层保留。该边界是下一阶段的建议验收口径，不能据此把尚未梳理的依赖直接标记为已完成。

## 2. 调查时基线与验证边界

| 检查面 | 初次调查结果 | 解释 |
| --- | --- | --- |
| 技术栈 | React / React DOM 19.1.0；实际安装 TypeScript 5.9.3、Vite 5.4.21；Node 22.23.0 | package.json 的 TypeScript 范围为 `^5.8.0`，实际版本与声明范围应分别记录 |
| 源码范围 | `src/app/react` 有 164 个 TS/TSX 文件，统计包含声明文件；`frontend/document-viewer` 另有 18 个 | 文件数量用于核对范围，不代表迁移完成比例 |
| Angular 页面启动 | 扫描 src/app 下 78 个 HTML，去掉 HTML 注释后，Angular/app.bundle 脚本标签和 ng-app/ng-controller 启动声明均为 0 | 静态入口结论；本次没有重新运行全部窗口的实机流程 |
| 迁移哨兵 | 本次执行得到 `SENTINEL_OK`，现有计数均为 0 | 哨兵有匹配范围和独立窗口豁免，不能据此断言全部兼容层已消失 |
| 根 TypeScript 检查 | **493 条诊断，编译器退出码 2** | 上轮日志为 492；本次多出 gridService 的一条缺失名称诊断，详见 F-02 |
| 文件级类型豁免 | 17 个文件含 `@ts-nocheck`；TypeScript 实际识别生效的为 16 个 | fileUrlHelper 的注释位于 import 之后，未生效，该文件仍产生诊断 |
| 检查覆盖 | 根 tsconfig 只纳入 src/app/react，并排除 frontend | 文档查看器的 18 个 TS/TSX 文件未纳入这个检查入口 |
| Vite 构建 | 本次以当前配置构建到独立临时目录，退出码 0 | Rollup 输入只有 pages、document-viewer；主应用没有被完整构建 |
| 连续列表 | 工作区中已经实现，尚未提交 | 上轮已验证四布局 10,000 条几何和 600 条真实图片的滚轮/拖动行为；本次引用历史记录，未重跑实机测试 |

初次调查执行的验证只有静态源码/入口盘点、TypeScript 检查、迁移哨兵和临时目录生产构建。既有 66 项 React 套件全绿来自历史记录，不作为本次再次运行的结果；提交前补跑的连续列表测试结果见文首更新。

[连续列表验证记录](<H:/dev/Eagle-Sec-development - 副本/docs/manual-qa-2026-09-13.md:583>)保留为下一阶段必须守住的行为基线。[当前迁移进度](<H:/dev/Eagle-Sec-development - 副本/src/app/react/PROGRESS.md:8270>)中的低频主流程问题和部分宿主/端口问题，应在收尾时重新核验，不能直接沿用“仍失败”或“已经消失”的判断。

## 3. 页面与实现范围盘点

| 页面或模块 | 当前实现及入口 | 剩余工作 |
| --- | --- | --- |
| 主界面 | src/app/index.html → react/main.tsx；React 组件和 store 已接管 | 正式构建、启动层拆分、类型与业务接口收敛；迁移仍加载的旧 JS 服务 |
| 偏好设置 | preferences.html → react/preferences/entry.tsx | controllerScope/手动通知收敛；tippy、ShortcutManager 边界迁移；纳入正式构建 |
| 预览大窗 | preview-window.html → react/preview-window/entry.tsx | 本窗 controllerScope、手写 watcher 和共享 detailHooks 接口迁移；媒体生命周期与跨窗同步验收 |
| 采集窗口 | collect-window/index.html → react/collect-window/entry.tsx | 仍加载 jQuery、jQuery UI、SweetAlert、旧 API 和 CollectItem；逐项替换 UI/业务胶水 |
| 六个 React 查看器 | EXIF、RAW、native、GIF、文本编辑、字体均有 react/viewers 下的 entry.tsx | 六个入口目前靠开发中间件注入；统一构建、资源和父子窗接口；专用引擎不要求重写 |
| 文档查看器 | frontend/document-viewer/index.html，18 个 TS/TSX 文件；已纳入 Vite build | 纳入类型检查；建议将自有实现归入 src/app/react/viewers/document，统一调用路径和资产交付 |
| PDF 查看器 | src/app/pdf-viewer/web/viewer.html，PDF.js + viewer.js | 专用引擎可以保留；明确自有改动边界，交付 worker/字体等资源并验收入口 |
| 3D 查看器 | src/app/model-viewer/website/index.html、embed.html，O3DV 页面 | 登记主入口与嵌入入口；界面适配、资源路径和卸载清理纳入交付范围 |
| thumbnail.html | 当前为空 HTML 壳 | 检查调用方后退役或明确静态用途，不作为待重写的大模块 |
| 注册/设备管理页 | 开发中间件读取 frontend/public/replaced 下的替代页面 | 保留当前替代页面的功能范围，统一路由/构建；若继续作为交付 UI，转为同一工程管理 |
| pages / workbench / media-viewer / 浏览器扩展 | 独立工具页、工作台、媒体页面或扩展 JS | 分别登记发布用途；工作台仍被 Electron 菜单引用，不能直接归为死文件。扩展执行环境单独验收 |
| js/directives 下旧 HTML | 64 个历史指令模板，另有旧控制器/指令 JS 留存 | 逐项核对实际引用后清理或归档；注释中的“规范来源”引用不代表运行时依赖 |

主窗口的旧脚本加载点见 [index.html](<H:/dev/Eagle-Sec-development - 副本/src/app/index.html:195>)；采集窗口的旧依赖见 [collect-window/index.html](<H:/dev/Eagle-Sec-development - 副本/src/app/collect-window/index.html:24>)；六个查看器的入口映射见 [Vite 配置](<H:/dev/Eagle-Sec-development - 副本/frontend/vite.preview.config.mjs:46>)。

## 4. 主要发现与影响

以下 E 编号对应第 8 节证据，R 编号对应第 5 节改造批次。P0 表示应先处理的验收/功能阻碍，P1 表示主体改造，P2 表示依赖前序工作的收尾。

| 发现 | 优先级 | 证据 → 结论 → 处理路径 |
| --- | --- | --- |
| F-01：主应用没有正式产物 | P0 | E-02/E-03 → 开发中间件注入与 Rollup 输入不同，Electron 默认依赖开发地址 → R1 |
| F-02：自动定位缺失导入（提交前已修复） | P0，已修复 | E-04 → 调查时 gridService 缺少 autoscrollChannel 导入 → R0 已补齐，诊断回到 492 |
| F-03：类型检查未通过且覆盖不全 | P1 | E-04/E-05 → 493 条诊断、16 个有效文件豁免、文档查看器未覆盖 → R3，并贯穿各批 |
| F-04：启动兼容实现仍集中于旧式全局供给 | P1 | E-06 → 原样移入模块图只解决加载归属，未完成职责和类型拆分 → R2 |
| F-05：业务仍经过通用字段/函数门面 | P1 | E-07 → store 已成为主要状态源，但字符串读写、any 接口及普通对象回退仍存在 → R4 |
| F-06：独立窗口仍保留移植控制器和旧 UI 依赖 | P1 | E-08 → 有 React 入口不等于状态和交互实现均已收敛 → R5 |
| F-07：现有门禁不足以代表完整交付验收 | P1 | E-09 → 哨兵、类型检查、构建、实机测试覆盖范围不一致 → R0/R7 |
| F-08：旧入口、依赖和文档有误导性残留 | P2；冲突入口优先 | E-03/E-10 → 存在 public 旧编辑页、未用依赖候选和过时“当前状态”描述 → R1/R6 |

### 4.1 F-01：开发可用与生产可交付尚未接通

[Vite 的 configureServer](<H:/dev/Eagle-Sec-development - 副本/frontend/vite.preview.config.mjs:131>)负责主窗口、偏好、预览、采集和六个查看器的 React 脚本注入。正式 build 的 [rollupOptions.input](<H:/dev/Eagle-Sec-development - 副本/frontend/vite.preview.config.mjs:224>)只有 pages 和 document-viewer。这些开发路由没有自动变成生产多页入口。

本次构建产物核对如下：

| 产物中的路径 | 结果 |
| --- | --- |
| src/app/index.html | 不存在 |
| src/app/preferences.html | 不存在 |
| src/app/preview-window.html | 不存在 |
| src/app/collect-window/index.html | 不存在 |
| src/app/raw-viewer/index.html | 不存在 |
| src/app/pdf-viewer/web/viewer.html | 不存在 |
| src/app/model-viewer/website/index.html | 不存在 |
| frontend/document-viewer/index.html | 存在，由 Vite 构建 |
| src/app/text-editor/text-editor.html | 存在，但来自 public 中的旧页面，仍引用 text-editor.js |

最后一项尤其需要优先处理：[public 中的旧文本页](<H:/dev/Eagle-Sec-development - 副本/frontend/public/src/app/text-editor/text-editor.html:28>)与开发态的 React 文本编辑页使用相同路径。直接交付当前产物会形成两套实现。public 下的 mock-library、mock-assets 也被原样复制到本次产物，应在生产资源规划中明确排除或转为独立演示构建。

[Electron 主入口](<H:/dev/Eagle-Sec-development - 副本/electron/main.cjs:8>)默认加载 localhost:5176 的开发页面，子窗口 URL 又从该地址推导。因此只扩充 Rollup 输入还不够，还要接通正式资源服务、窗口地址、API/缩略图地址和 worker 等静态资源。

### 4.2 F-02/F-03：类型债务已经能指出具体遗漏

调查时命令为 `node node_modules/typescript/bin/tsc --noEmit --pretty false`，退出码为 2。与上轮日志去除行列号后比较，当时新增项只有：

```text
src/app/react/services/gridService.ts(536,5): error TS2304:
Cannot find name 'autoscrollChannel'.
```

[machineryAutoScroll](<H:/dev/Eagle-Sec-development - 副本/src/app/react/services/gridService.ts:534>)调用该频道，定义在 [bus.ts](<H:/dev/Eagle-Sec-development - 副本/src/app/react/global/bus.ts:140>)，调查时 gridService 缺少导入。Inspector 定位、选择导航和部分库流程仍会调用 machineryAutoScroll。初次调查只静态确认了缺失标识符；提交前已补齐导入，后续状态以文首更新为准。

诊断按类别分布：

| 类别 | 数量 | 应采用的修正方式 |
| --- | --- | --- |
| TS2554：参数数量不匹配 | 171 | 区分无载荷频道、可选参数和真实遗漏，修正签名与调用契约 |
| TS7006：参数隐式 any | 130 | 从模型和服务边界补类型，避免逐处机械补 any |
| TS2345：参数类型不匹配 | 87 | 处理空数组推断、领域模型和回调类型 |
| TS2304：名称不存在 | 45 | 核实导入、全局实际供给和已经退役的调用，优先排除可达运行时错误 |
| 其他诊断 | 60 | 包括重复声明/实现、导入冲突、const 赋值、DOM/空值检查和索引类型 |
| 合计 | **493** | 最终验收要求归零；“不新增”只用于过渡批次 |

集中度较高的文件为 itemDomain 67、filterDomain 64、miscDomain 52、keymap 47、sidebarService 44、selectionService 31 条。修复应从共享类型和签名入手，再按业务域收敛，不以全局关闭 strict、扩大排除目录或移动豁免注释消除报错。

[根 tsconfig](<H:/dev/Eagle-Sec-development - 副本/tsconfig.json:21>)未包含文档查看器。调查时的 493 条及修正后的 492 条都不是“整个前端的错误总数”，16 个被有效豁免的文件也尚未完整暴露其诊断。扩大覆盖和撤销豁免时要单独记录新暴露的存量问题，不能把它们混同于本批引入的回归。

### 4.3 F-04/F-05：需要继续拆分的是兼容职责与业务接口

[shimsLegacy.ts](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/shimsLegacy.ts:1>)约 3,400 行，十个窗口入口都把它放在第一条 import。它同时承担浏览器种子、require/process 等环境适配、设置/i18n/总线初始化以及历史兼容行为。当前 `!window.eagleDesktop` 是运行时环境判断，不是生产构建排除 mock 代码的机制。

已经迁出的 channelBridge、ipcWriteState、returnBridge、settings 和 documentViewer 应直接复用。新工作是梳理剩余职责、显式初始化顺序、减少全局写入，并让开发模拟环境与正式运行环境拥有可审计的边界。

[scopeFace](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/scopeFace.ts:25>)是 store 访问视图与普通对象回退，已经不是 Angular scope 引擎。[writeScopeField](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/scopeFieldBridge.ts:42>)仍接受任意字段名和值；[driverApi](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/driverApi.ts:50>)虽然有显式白名单，返回类型及后端访问仍较宽泛。

下一步应让组件和业务服务直接消费具体 store/action 或类型化接口，并缩小兼容门面的调用者集合。共享模块目前依赖 getWindowScope 区分主窗口与子窗口，不能在子窗口迁移前直接全局替换为主窗口 store。

### 4.4 F-06/F-07：独立窗口和哨兵的范围要对齐

预览窗口保留了 [手写 watcher 与 apply/evalAsync 门面](<H:/dev/Eagle-Sec-development - 副本/src/app/react/preview-window/controller.ts:255>)，采集和偏好窗口依靠 controllerScope + 手动 notify 驱动 React。它们已经无 Angular 运行时，但仍有原控制器的组织方式。

现有哨兵主要匹配调用形态；对象上的方法定义和 src/app/react 之外的旧 JS 不在同一度量中，其永久禁项也对 [独立窗口作了 scopedOut 豁免](<H:/dev/Eagle-Sec-development - 副本/tests/react-rewrite-sentinel.mjs:137>)。因此本次哨兵全零与上述兼容面存在并不矛盾。

现有实机测试主要通过 Vite 开发栈运行，部分直接 import 源码 URL。正式产物测试需另设入口，不能把开发栈通过等同于生产产物通过。

## 5. 剩余改造计划

建议以 R0—R7 作为下一阶段批次编号，避免与历史 P/D/E 批次混淆。每批都交付代码、对应验证和状态记录；历史大模块按功能拆成小批，不以文件改名或搬目录作为完成标志。

| 批次 | 主要交付 | 前置条件 | 完成判据 |
| --- | --- | --- | --- |
| R0：基线与首个遗漏修正 | 当前入口台账、诊断基线、自动定位修正、网格测试接入 | 当前工作区 | 缺失导入已修正；仍需完成入口台账与套件接入 |
| R1：正式构建与运行入口 | src/app 多页 build、静态资源清单、Electron 正式加载路径 | R0 | 关闭 Vite dev 后，主窗口和交付子页面仍可启动 |
| R2：启动层与环境边界 | 显式 runtime 初始化、桌面接口、开发模拟环境拆分 | R1 的入口清单 | 无隐式重复初始化；正式产物不依赖浏览器 mock 种子 |
| R3：完整类型检查 | 统一模型/接口、全前端检查配置、逐域消除诊断和豁免 | R0；结合 R2 接口推进 | 全部自有前端纳入检查；最终 0 诊断、业务文件无 nocheck |
| R4：主应用业务与状态收敛 | 类型化 action/service；减少字段门面与动态函数供给 | R2/R3 的共享边界 | 每个迁移域不再依赖通用 scope 字段/函数表 |
| R5：独立窗口与查看器 | 本窗 store、窗口上下文、React 交互与查看器适配 | R1/R2/R3；共享服务沿用 R4 | 窗口独立启动、反复开关、切库和跨窗同步均通过 |
| R6：旧代码和文档收尾 | 活跃 JS 迁移、死文件退役、依赖与历史说明整理 | 对应消费者已迁出 | 交付路径无旧业务脚本回退，保留依赖有明确用途 |
| R7：统一交付验收 | 开发态与正式产物双路径回归、统一门禁、交接记录 | R1—R6 | 第 6 节验收项全部有证据，不用“零新增”代替通过 |

R3 的类型修正随各批持续推进；R4/R5 可以按窗口或业务域交错实施。每次只改变一个可验证的业务边界，避免同时改动状态、持久化、窗口通信和滚动布局。

### 5.1 R0：锁定当前成果，完成入口与测试门禁整理

工作内容：

1. 以连续列表提交 `195dc3ab` 为基点记录后续改动，保留单独回退边界；不覆盖用户的其他未跟踪内容。
2. autoscrollChannel 导入已在提交前补齐，并补充了 machineryAutoScroll 到事件频道再到离屏选中项的验证。继续按业务回归矩阵检查 Inspector、键盘/范围选择和库流程，保持现有频道契约和滚动几何。
3. 将两个 continuous-grid 测试纳入明确的运行脚本/套件；它们目前是独立脚本，尚未列入 run-react-suite。
4. 建立页面台账，登记 URL、HTML 来源、React 入口、父子窗口、专用引擎、开发/生产加载方式。对 pages.html 中仍指向缺失 progress.html 的链接登记处置。
5. 保存类型检查的诊断键基线，并区分当前检查范围和待纳入范围。

验收：新增的 TS2304 已消失，提交前检查为原有 492 条且诊断键逐条一致；仍不算类型验收完成。R0 余下工作需完成入口台账和测试脚本接入，确保自动定位与连续滚动持续受到回归保护。

### 5.2 R1：建立完整生产构建与资源交付

主要文件：[Vite 配置](<H:/dev/Eagle-Sec-development - 副本/frontend/vite.preview.config.mjs>)、各 src/app HTML、[Electron 主入口](<H:/dev/Eagle-Sec-development - 副本/electron/main.cjs>)、[文档查看器地址构造](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/documentViewer.ts:60>)及对应资源配置。

工作内容：

1. 为主窗口、三类业务窗口、六个 React 查看器和文档查看器建立统一多页入口。HTML 中声明真实模块入口，或使用开发/构建共同执行的 HTML 转换，停止仅靠 configureServer 注入业务入口。
2. 将开发专用 React Refresh、演示种子、测试资产与生产资源分开。先消除 public 文本编辑器的同路径冲突，再保留一份权威实现。
3. 推荐生产态通过本地 HTTP 服务提供 dist/frontend，继续保持现有页面 URL 形状；复用现有本地服务体系接入静态资源，集中生成窗口 URL。不要仅将 loadURL 改为 loadFile 而忽略绝对路径、iframe 和 worker。
4. 统一运行时 API、缩略图和扩展服务地址，落实 `/file` 在无 Vite proxy 时的访问方式。正式运行仍可使用现有后端，不要求重写后端。
5. 登记并交付 CSS、图标、字体、RAW 解码、PDF worker、3D 资源和播放器资源；清理因 public 整目录复制而进入产物的开发数据。
6. 增加产物入口/资源检查及 Electron 正式启动冒烟。新测试不得依赖 `/src/app/react/*.ts` 源码导入或 React Refresh。

验收：仅启动所需本地服务和 Electron 即可使用主应用，Vite dev 关闭；主界面和每个交付子窗口加载正确模块，资源无缺失；开发/生产同一路径不再展示不同实现。

### 5.3 R2：拆分启动兼容层，明确窗口运行环境

工作内容：

1. 按桌面能力接口、i18n/设置、事件/IPC、浏览器开发适配和演示种子拆分 shimsLegacy，给每项依赖定义具体输入输出。
2. 复用现有 channelBridge、returnBridge、ipcWriteState、settings，不重建第二套通道或写队列。
3. 为每类窗口建立显式初始化流程：环境能力就绪、设置和语言就绪、窗口状态/服务注册、React 挂载；初始化可重复调用时保持幂等，窗口退出时能释放订阅和定时器。
4. 浏览器预览能力继续保留，但通过明确开发/演示模式启用；正式构建不以 eagleDesktop 缺席作为自动装入模拟库的唯一依据。
5. 先减少调用者，再移除无供给方的 Angular 分支和过时全局。将跨窗口必需的驱动接口与测试诊断接口分开，不因清理全局破坏媒体查看器或 Electron 驱动。

验收：十个入口启动无隐式先后依赖遗漏；同一 IPC 只注册/发送预期次数；浏览器开发态和 Electron 正式态都可运行；快速切库、关闭重开窗口不复用旧库状态。

### 5.4 R3：从模型与共享契约开始解决类型问题

工作内容：

1. 先建立 Item、Folder、Library、Selection、Preferences、ViewerContext、DesktopApi、IPC 载荷/回执等共享类型；外部 JSON 从 unknown 校验进入模型。
2. 优先修正缺失名称、重复声明/实现、导入冲突、const 赋值等可能影响执行的项目，再修正公共函数参数、无载荷事件签名、回调和数组推断。
3. 为文档查看器建立检查入口，保留真实浏览器/库类型；在其归入 src/app 后统一配置。不要将 Electron/Node 与浏览器的全局混成一个宽泛声明文件。
4. 按业务域撤销有效的 nocheck。先给边界补类型和行为验证，再逐文件开启检查；记录因此新暴露的存量诊断。
5. 逐步收窄 driverApi、writeScopeField、事件总线载荷以及大量 any 服务边界。临时外部库适配应局部、具名，注明移除条件。
6. 在 package.json 增加统一 typecheck 命令，最终构建/验收流程必须调用它。Vite 转译成功不能替代 TypeScript 检查。

验收：全部交付前端源码纳入检查，strict 保持启用，诊断数为 0；应用自有业务文件不再整文件豁免。第三方引擎原始代码通过明确声明和适配层接入，不要求重写其内部实现。

### 5.5 R4：主应用状态与业务服务逐域收敛

建议次序：列表/选择 → 文件夹与筛选 → Inspector 与标签 → 详情与媒体 → 导入导出及其他业务。该顺序先稳定被大量调用的状态和命令，再处理共享依赖较多的外围能力。

每个业务域都执行同一套收敛步骤：

1. 列出状态的唯一拥有者，区分原始数据、派生数据、临时交互状态和运行时资源。组件通过具体 selector 读取状态，通过 action/service 改变状态。
2. 将 scopeFace/driverApi 的内部业务调用改为显式参数或具体模块导入；删除对应普通对象回退和字符串函数挂载。窗口外部消费者暂由具名兼容适配承接。
3. 处理散落的手动快照同步和动态 DOM 操作；保留必需的媒体/原生控件适配，但明确元素由谁创建、谁更新和谁销毁。
4. 保持 ID、对象引用及持久化回执的现有正确语义，尤其是选中项、在飞编辑、差分回执和导入去重；不能因不可变更新改造重新覆盖用户编辑。
5. 该域调用者归零后，再删除对应兼容入口。未迁完的窗口继续通过自己的 WindowContext 工作，不强制共享主窗 store。

验收：该域没有通用 scope 字段/函数表依赖；行为在新旧测试中一致；连续网格的总高度、锚点、选择定位和离屏更新不回退。Portal 本身可保留，不以减少 Portal 数量作为目标。

### 5.6 R5：独立窗口和查看器完成同等深度的迁移

建议次序为偏好设置 → 采集窗口 → 预览窗口 → 六个查看器及文档/专用引擎适配。每个窗口有本窗 store 和明确上下文，共享纯业务服务，不共享任意可写 controllerScope。

- 偏好设置：字段、快捷键编辑、主题和语言更新通过 typed action；替换剩余 tippy/ShortcutManager 胶水并验证焦点行为。
- 采集窗口：把旧 CollectItem/API 全局模型转为 TS 模块，复用现有 React 弹窗、拖动和选择组件，移除 jQuery/jQuery UI/SweetAlert 的应用侧依赖；保留拼音/格式处理能力的功能契约。
- 预览窗口：以 store selector、effect 或显式订阅代替手写 watcher/notify 门面；同步改造 detailHooks 的窗口参数，覆盖播放、切图、字体、GIF 和快速关闭场景。
- 六个查看器：父子窗口的状态/命令使用具名接口；专用引擎由 ref/effect 管理，退出时释放资源和监听，失败/空文件状态有明确 UI。
- 文档查看器：复用现有实现，建议归入 src/app/react/viewers/document；同步改造入口、worker/样式资产和 core/documentViewer 地址构造，旧路径如需过渡须只有转发入口，没有第二份业务代码。
- PDF/3D：登记保留的引擎与自有界面改动；统一入口和资源路径，分别做文件打开、主题/尺寸变化和反复卸载验证。

验收：各窗口可以从主流程打开，也能在上下文合法时独立启动；关闭再开无重复监听，主/子窗状态不串库；该窗口迁移完成后移除对应哨兵豁免。

### 5.7 R6：按真实依赖清理旧代码、资产和文档

工作内容：

1. 将主界面仍使用的 lazy-load-manager、shortcut-manager、eagle-api/url-enlarger 等应用侧服务改为具名 TS 模块；迁移过程中保护连续列表的图片加载生命周期和固定几何。
2. 联合静态引用、动态路径/require、插件接口、测试和运行时资源请求建立保留清单，再删除旧 controllers/directives/templates。不能仅搜索不到 import 就整目录删除。
3. 删除已经替代的 public 旧页面和无调用者兼容分支。旧 CSS 名称或注释中的 Angular 字样按用途处理，不作为自动删除条件。
4. 核查依赖使用：当前 TS/TSX 中未发现 @egjs/react-infinitegrid 的使用，package.json/锁文件仍保留它，可在全仓调用核对后移除。window.ig 现为命令兼容面，不能与该包一起未经迁移直接删除。
5. 更新 README 的“当前状态”、运行命令和文档索引；现 README 仍描述 Angular、shims.js 和旧端口。历史 PROGRESS/收官文档保留时间语境，追加指向新验收记录的说明。

验收：正式产物和源入口不存在旧业务实现回退；保留的 JS/引擎都有明确消费者和理由；新开发者按 README 能启动并理解当前架构。

### 5.8 R7：建立一个能代表完整迁移的验收入口

工作内容：

1. 建立统一前端验收命令，包含全范围类型检查、架构/入口检查、正式构建、关键业务回归和正式产物冒烟。
2. 常规批次运行受影响的定向测试；修改启动、IPC、全局状态或跨窗契约时扩大回归；最终运行完整 React 套件及相关持久化、查看器、导入导出和网格测试。
3. 修正测试覆盖不足，而非通过放宽断言或仅保留脚本文本匹配取得通过。开发专用源码探针与产物行为测试分别维护。
4. 核验历史低频失败，记录触发条件、复现证据与实际处理结果。端口/宿主环境问题单列，不把无法执行写成通过。
5. 更新入口/依赖清单、类型基线、保留项和实机结果；到此才对完整迁移给出完成判断。

验收：第 6 节每项均有可复核结果；未通过项明确标注，不能由套件数量、源码后缀或一次 build 成功替代。

## 6. 验收矩阵与回归重点

| 验收面 | 最终要求 | 当前可复用验证 / 需要补充的验证 |
| --- | --- | --- |
| 构建与启动 | 所有交付入口有产物；关闭 Vite dev 后可启动；无源码 URL/开发刷新依赖 | 新增产物清单检查、Electron 正式加载冒烟 |
| 类型 | 全部自有前端覆盖，strict 检查 0 诊断，无业务文件 nocheck | 根 tsc；补文档查看器覆盖和统一脚本 |
| 框架与依赖 | 无 Angular 启动；已迁域无 scope/digest 兼容业务；旧 UI 胶水无生产消费者 | react-rewrite-sentinel；补入口/依赖检查和逐窗移除豁免 |
| 连续列表 | 全列表单一高度；滚轮/滑块方向一致；停住不回跳；图片加载不改变坐标 | continuous-grid-layout、continuous-grid-scroll；补 AutoScroll 调用链 |
| 大列表与布局 | 四种布局、缩放/变宽、名称/信息显隐、首末项、稀疏/空目录均正确 | 已有 10,000 条几何与 600 条实图库基线；后续增加 10,000 条实际库压力验证，记录耗时/内存 |
| 选择与列表更新 | 离屏定位、范围选择、筛选/排序、批量移除、目录恢复不重建分页 | d3-selection、d3-alltags、相关 stage 测试及连续列表测试 |
| 编辑与持久化 | 在飞编辑不被旧回执覆盖；重启读回一致；错误可见且不重复写入 | main-ui-workflow、electron-write-path、item-persistence、txt-update |
| 导入导出与库切换 | 进度/取消/失败路径正确；无重复导入或串库 | image/folder-import、export-progress、library-switch、source-mode 系列 |
| 独立窗口与媒体 | 本窗状态、焦点、主题、播放/切图、关闭释放和跨窗同步正确 | stage8/stage9、preview-delivery、native-preview、document-viewer、video-detail |
| UI 生命周期 | 弹窗、菜单、拖动、编辑器在反复挂载后仍只有预期监听；React 与引擎不争写同一节点 | menu-popup、ui-interactions、drag-start、相关场景实机验证 |
| 文档与交接 | README、入口表、保留依赖和测试记录与当前代码一致 | 本报告、后续逐批记录和最终验收文档 |

连续列表要验证的是完整结果集的一套稳定坐标，不是把全部缩略图一次性挂进 DOM。高性能目标继续采用全列表元数据布局 + 可见 DOM 虚拟化。大库性能阈值应根据明确机器和数据集实测确定，本报告不虚构帧率或内存保证。

## 7. 实施约束与首批交接

下一位实施者可从 R0 的剩余工作开始，不必重新做 Angular→React 主入口迁移或重复修复已补齐的导入。首批输入是当前工作区、两份 continuous-grid 测试、提交前复核的 492 条诊断基线以及各窗口入口表；首批输出应为测试脚本接入和可供 R1 使用的完整入口清单。

执行中需要保持以下边界：

1. 连续网格改造已独立提交为 `195dc3ab`，先辨认后续改动再开始新批次；不得把用户其他未跟踪目录纳入清理。
2. 一批只承担明确的行为或结构变化，记录回退点；跨窗共享模块迁移时同步确认主窗和子窗上下文。
3. 保持库文件格式和现有持久化协议，使用隔离测试库；生产构建改造不顺带改库数据结构。
4. 删除模块前先迁出消费者并覆盖行为；不能先砍全局供给，再用宽泛兜底掩盖错误。
5. 每个“完成”都注明验证范围。阶段性的“旧错误不增加”可以支持继续施工，不能支持最终验收。

尚需下一阶段验证的内容包括：正式产物下全部媒体引擎资源、所有独立窗口反复开关、历史低频主流程问题，以及 10,000 条以上实际素材库的性能。本次没有对这些场景声称通过。

## 8. 证据索引与复核方法

证据采集日期均为 2026-09-14；初次调查证据对应本报告开头的提交基点和当时未提交工作区，提交前修正对应 `195dc3ab`。E → F → R 的关联见第 4 节表格，R0—R7 是从当前状态通向最终验收的实施路径。

| 证据 | 来源与可观察事实 | 关联发现 |
| --- | --- | --- |
| E-01 | [main.tsx](<H:/dev/Eagle-Sec-development - 副本/src/app/react/main.tsx:107>)使用 createRoot；去注释扫描 78 个 HTML 未发现 Angular 启动标签 | 已迁移范围基线 |
| E-02 | [Vite 配置](<H:/dev/Eagle-Sec-development - 副本/frontend/vite.preview.config.mjs:131>)的开发注入与第 224 行正式输入不同；[Electron](<H:/dev/Eagle-Sec-development - 副本/electron/main.cjs:8>)默认开发 URL | F-01 |
| E-03 | 当前配置临时构建退出 0，但主窗口/业务子窗口 HTML 缺失；public 旧编辑页和 mock 资产被复制 | F-01/F-08 |
| E-04 | tsc 退出 2、493 条；与上轮 492 条日志相比，仅新增 gridService/autoscrollChannel | F-02/F-03 |
| E-05 | [tsconfig.json](<H:/dev/Eagle-Sec-development - 副本/tsconfig.json:21>)排除 frontend；扫描 17 个 nocheck 文件，其中 16 个被编译器识别生效 | F-03 |
| E-06 | [shimsLegacy.ts](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/shimsLegacy.ts:1>)仍为启动首个 import；[bundleGlobals.ts](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/bundleGlobals.ts:1>)继续供给历史全局 | F-04 |
| E-07 | [scopeFace.ts](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/scopeFace.ts:25>)、[scopeFieldBridge.ts](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/scopeFieldBridge.ts:42>)、[driverApi.ts](<H:/dev/Eagle-Sec-development - 副本/src/app/react/core/driverApi.ts:50>)保留通用访问面 | F-05 |
| E-08 | [预览控制器](<H:/dev/Eagle-Sec-development - 副本/src/app/react/preview-window/controller.ts:255>)的 watcher 门面；[采集页](<H:/dev/Eagle-Sec-development - 副本/src/app/collect-window/index.html:37>)与[偏好页](<H:/dev/Eagle-Sec-development - 副本/src/app/preferences.html:9>)的旧依赖 | F-06 |
| E-09 | 哨兵实测 SENTINEL_OK，但[永久禁项豁免](<H:/dev/Eagle-Sec-development - 副本/tests/react-rewrite-sentinel.mjs:137>)仍在；[运行套件](<H:/dev/Eagle-Sec-development - 副本/tests/run-react-suite.mjs>)与当前新增网格测试尚未统一 | F-07 |
| E-10 | [README](<H:/dev/Eagle-Sec-development - 副本/README.md:5>)仍描述初期 Angular；package.json 仍有未在 React 源码使用的 InfiniteGrid 依赖；旧文本页仍在 public | F-08 |

### 8.1 本次日志与统计文件

以下为本地临时证据；关键结果已摘录进报告，后续可按命令重新生成，不依赖临时文件长期存在：

- [类型检查日志](<H:/dev/Eagle-Sec-development - 副本/.tmp/react-migration-audit-tsc-2026-09-14.log>)。
- [提交前类型检查日志](<H:/dev/Eagle-Sec-development - 副本/.tmp/continuous-grid-tsc-precommit.log>)：补齐导入后 492 条，与改造前诊断键一致。
- [提交前完整滚动测试日志](<H:/dev/Eagle-Sec-development - 副本/.tmp/continuous-grid-scroll-precommit.log>)：包含新增的自动定位频道闭环，最终退出码 0。
- [类型分布与源码统计](<H:/dev/Eagle-Sec-development - 副本/.tmp/react-migration-audit-types-2026-09-14.json>)。
- [HTML 脚本入口清单](<H:/dev/Eagle-Sec-development - 副本/.tmp/react-migration-audit-html-2026-09-14.json>)。
- [临时构建日志](<H:/dev/Eagle-Sec-development - 副本/.tmp/react-migration-audit-build-2026-09-14.log>)；产物位于 `.tmp/react-migration-audit-build-2026-09-14`，未覆盖 dist/frontend。
- 对照日志为 `.tmp/continuous-grid-tsc-before.log` 和 `.tmp/continuous-grid-tsc-final.log`，两者各 492 条。

### 8.2 可复核命令

以下命令在本工作区根目录运行，使用已安装的本地依赖。初次调查执行静态检查和构建，提交前另补跑两项网格测试和迁移哨兵；完整运行套件属于后续实施验收。

```powershell
Set-Location -LiteralPath 'H:/dev/Eagle-Sec-development - 副本'
git status --short
git log -10 --oneline
node node_modules/typescript/bin/tsc --noEmit --pretty false
node tests/react-rewrite-sentinel.mjs
```

类型检查当前预期退出码为 2。复核正式构建时使用新的临时目录，避免旧产物干扰：

```powershell
$auditBuild = Join-Path '.tmp' ('migration-audit-build-' + [guid]::NewGuid().ToString('N'))
node node_modules/vite/bin/vite.js build --config frontend/vite.preview.config.mjs --outDir $auditBuild --emptyOutDir false
@(
  'src/app/index.html',
  'src/app/preferences.html',
  'src/app/preview-window.html',
  'src/app/collect-window/index.html',
  'src/app/text-editor/text-editor.html',
  'frontend/document-viewer/index.html'
) | ForEach-Object {
  [pscustomobject]@{
    Path = $_
    Exists = Test-Path -LiteralPath (Join-Path $auditBuild $_)
  }
}
```

类型豁免的文本盘点与实际生效情况须分开检查，下面的脚本使用本地 TypeScript 解析器：

```powershell
@'
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const files = execFileSync('rg', ['--files', 'src/app/react', '-g', '*.ts', '-g', '*.tsx'], { encoding: 'utf8' }).trim().split(/\r?\n/);
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('@ts-nocheck')) continue;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  console.log(JSON.stringify({ file, effective: source.checkJsDirective?.enabled === false }));
}
'@ | node --input-type=module
```

后续改造可复用的已有测试命令如下，涉及实际窗口的测试应使用其隔离测试库并按批次选择执行：

```powershell
node tests/continuous-grid-layout.mjs
node tests/continuous-grid-scroll.mjs
node tests/main-ui-workflow-closed-loop.mjs
node tests/preview-delivery-closed-loop.mjs
node tests/run-react-suite.mjs
```

### 8.3 类型豁免文件清单

均位于 src/app/react；“有效”以本次 TypeScript 解析器识别结果为准。

| 文件 | nocheck 有效 | 建议归属批次 |
| --- | --- | --- |
| core/shimsLegacy.ts | 是 | R2/R3 |
| core/eagleApi.ts | 是 | R2/R3 |
| core/eagleClasses.ts | 是 | R3/R4 |
| core/ipcHelper.ts | 是 | R2/R3 |
| core/contextMenuDomain.ts | 是 | R3/R4 |
| core/tagManagerDomain.ts | 是 | R3/R4 |
| core/bitmapViewer.ts | 是 | R3/R4/R5 |
| core/hoverPreview.ts | 是 | R3/R4/R5 |
| core/smoothZoomEngine.ts | 是 | R3/R4/R5 |
| core/fileUrlHelper.ts | 否，注释在 import 之后 | R3/R5；该文件目前有 12 条诊断 |
| services/batchOpsService.ts | 是 | R3/R4 |
| services/folderCoreService.ts | 是 | R3/R4 |
| services/folderMenuService.ts | 是 | R3/R4 |
| services/fontTagService.ts | 是 | R3/R5 |
| services/imageOpsService.ts | 是 | R3/R4 |
| services/itemMenuService.ts | 是 | R3/R4 |
| services/miscMenuService.ts | 是 | R3/R4 |

这份清单的目标是逐文件恢复检查，不是将未生效的注释移到文件顶部。最终验收应同时记录覆盖范围、诊断数量和豁免数量。
