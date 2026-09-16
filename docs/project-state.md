# 项目状态文件（Orca 编排工作台）

> 用途：上下文压缩后靠本文件快速恢复工作，不依赖被压缩的对话历史。
> 维护者：Coordinator（主会话）。**每完成一个阶段性任务后必须更新本文件。**
> 最后更新：2026-09-16（**M1 / M2 / M3 / M4 / M5 / M6 / M7 已全部完成并集成**；下一步 M8 最终验收）
> 当前套件 **98 项** + ARTIFACT **5 项**；最近提交 `66a1e73b`。
> 验证口径为分层（D22）——**最近一次全量 L3 是 85 项跑出 FAILED:1 的那次；此后各批只做 L1/L2 定向核验，
> **M8 已开始并跑过一轮 L3（95 项）**：static / build / artifact 三段全 PASS；regression 段 **FAILED 2**
> （`image-transform-dispatch` 与 `m4-preview-dispose`，**均为 M6-3 打断的沙箱加载器**，已修并加严）。
> 修完补登记 3 个孤儿测试后套件为 **98 项**，**待重跑一轮完整 acceptance 出最终证据**。

---

## 1. 总体任务与依据

- **任务书**：`docs/plan-2026-09-15-full-workspace-legacy-audit.md`
  （原文件亦在 `outputs/Eagle_全工作区旧框架残留审计与改造计划_2026-09-15.md`，未跟踪）
- **范围**：M0–M8 全批次，最终通过完整验收。
- **工作区**：`H:/dev/Eagle-Sec-development - 副本`，分支 `react-in-place`。
- **执行方式**：Orca orchestration，Coordinator 不亲自写业务代码（合并/集成除外）。
  - **Worker 模型分档（D16，用户 2026-09-16 指示）**：同一波**第 1、2 个**用
    `--agent claude --model deepseek-flash`；**第 3 个起**用 `--agent codex`（**默认配置**，
    不传 `--model`/`--effort`）。
  - 编码 Worker：独立 worktree（`new-child`）；只读 Worker：`current` 亦可
  - 任何两个并行编码 Worker 不共享 worktree
  - **派单前必须把 `outputs/research-*.md` 复制进目标 worktree 的 `outputs/`**（D17）

### 硬约束（来自用户，不得违反）

1. 不得通过删除测试、扩大 `@ts-nocheck`、增加 `any`、放宽门禁来换"绿色"。
2. 不得删除没有确认消费者和替代方案的旧代码。
3. 保持现有业务行为、URL 与第三方引擎边界。
4. Worker 完成后必须核验 diff / 测试 / 实际结果，不采信汇报。
5. Worker 卡住不阻塞其他独立任务；能修则优先让原 Worker 修。
6. 不中途要求用户介入（产品语义、外部凭据、破坏性变更除外）。

---

## 2. 当前进度总览

| 批次 | 状态 | 说明 |
|---|---|---|
| **M0** 范围台账与可失败门禁 | ✅ **已完成并集成** | 见 §4 |
| **M1** 优先修功能闭环 | ✅ **全部集成完毕** | F15 ✅ / F13-preview ✅ / F06 后端 ✅ / F10 ✅ / F08·F09 ✅ / F06 前端 ✅ / **F06 能力接线 ✅** / **F04 ✅** |
| **M2** 替代万能 shim | ✅ **全部完成并集成** | M2-1…M2-5 均已集成（`90cc3501`/`82d5b1f8`/`b01e6843`/`d4f611a2`/`6d51ac5a`）；**M2-6**（`desktopCapability.ts` 类型化，`f761c440`）已集成。**M2-8**（`demoSeed.ts` + `ipcBus.ts`，`0aedf7a2`）已集成，`NOCHECK_LEDGER` **清空**——`tests/typecheck.mjs` 现报「整文件 @ts-nocheck **0**，待撤销 **0**」。shim 层 8 个文件全部撤销完毕。**记录在案的允许写法**：`desktopApi!.duplicates!.status(...)` 等 4 处非空断言（修前此处即 `null.status`，断言只抹类型、不改求值）、守卫后定格为 const、`waitPreferencesEntry.attempts` 改等价闭包计数器（该属性只写不读、且是块级局部不可达）、`new Set()`/`Array.isArray` 的隐式 any 收敛为显式标注。同时抓到一个**历史缺陷**（未修、只如实标注）：`demoSeed.ts` 的 `capturePollTimer` 声明并在 `disposeDemoTimers` 里清理，但**从未被赋值** |
| M3 经典业务脚本进模块图 | ✅ **三批全部集成** | M3-R 审计已交付（§5）；**M3-1**（`core/rules/*`）、**M3-2**（调用点切换 + 冷启动空快照不自愈）、**M3-3**（Worker 协议类型化 + 「取消任务不回写已关闭窗口」缺陷修复）均已集成（`4c1fc124` / `35675429` / `55dc91ff`） |
| M4 窗口与 scope 收口 | ✅ **四批 + 收尾全部集成** | M4-R 审计已交付（§5）；**M4-C**（预览窗 dispose）、**M4-A**（URL/历史守卫）、**M4-B**（采集/偏好窗 dispose + store 订阅守卫）、**M4-D**（ng-* 成对替换 + jQuery 哑雷 + 引擎生命周期 adapter + domLite 收口，`b5f9ab71`）均已集成。**M4-E 已集成（`242e5618`）**：F11 晚注册缺陷（**运行期探针坐实真实存在**，M4-R 原判「潜伏不触发」只对了一半）+ `detailHooks.ts:38` 的 jQuery 同族哑雷 + 死声明。M4 至此无已知遗留 |
| M5 外围工具 UI 与生产配置 | ✅ **全部集成** | **M5-1**（工具页/媒体页进模块图 + 运行期地址单一来源，`69b489d6`）+ **M5-2**（生产启动等就绪再开窗 + 非默认端口生产验收，`c987dfef`）。验收项 1 已由**真实 Electron/CDP 实测**覆盖：四类页面请求全部命中覆盖后的端口，且 `artifactDigest` 不变 |
| M6 扩展与插件专项 | ✅ **全部完成并集成** | **M6-1**（扩展，`242a8663`）+ **M6-2**（插件根统一到仓库内 `plugins/` + SDK 顺序 + 回调真实派发，`c220af64`，依据 D24①）+ **M6-3**（格式插件 preload 收敛为唯一解析点、Electron 态返回真实磁盘路径，`b6c9a79f`）已集成。**M6-3 顺带坐实一个更大的缺陷（D26）**：`electron/main.cjs` 的 `createWindow` 未启用 `webviewTag` ⇒ 三处 `<webview>` 从不 guest 化，格式插件视图在 React 构建里实际是死的；用户已裁决「恢复」，**M6-4 已集成（`6b1e11b6` + 登记 `e84f1618`）**——`createWindow` 补回 `webviewTag: true`，三处 `<webview>` 首次真正 guest 化。**M6 至此无遗留** |
| M7 最小产物与遗留隔离 | ✅ **三批全部集成** | **M7-1**（`d59071d8`）：四项低风险退役；**M7-2**（`b923215c` 含我方修）：tab-bar 退出发布清单（脱钩测试改造为 **11 项负向门禁**）+ `src/run.js`/`run.jsc`/`main.jsc` 隔离归档（R100 零改动）。全部先归档到 `docs/retired-2026-09-16/`。**M7-3**（`9036e4c8`）已集成：任务书点名的两条落地——**发布资产从整树 copy 改为登记驱动**（`frontend/publish-asset-manifest.mjs` 为单一事实源，构建与门禁共同 import）、**必要资源复制失败即失败**（源缺失抛错、复制抛错向上抛，`skip (absent)` 与 `catch { console.error }` 两条静默通道消除）；`src/my_modules` **48 项零消费者条目归档**到 `docs/retired-2026-09-16/src/my_modules/`（保留 8 项有行号依据的真实磁盘加载依赖），`src/package.json` 清 `main`/`scripts`/`devDependencies`/`build`/`extend-info`（**保留 `version`/`buildVersion`/`buildNumber`**，审计 §3.2 有 5 处现役消费者）。新增门禁 `tests/publish-asset-manifest.mjs`（登记进 `REACT_SUITE`，**套件 94 → 95**）。**M8 仍需做**：最小隔离部署副本的完整启动验收（任务书 M7 第 3 条） |
| M8 最终收官 | 🔄 **进行中** | 触发条件见 D22 的 L3（这里才跑全量；当前套件 **95 项** + ARTIFACT **5 项**）。**M7 收官后 M8 的前置已齐**：M2 待撤销 0、M6 无遗留、M7 三批集成。M8 还需补任务书点名的「最小隔离部署副本能完整启动，不读取源工作区、tests 或未登记的 `src/node_modules`」 |

### 各批次最新集成提交（2026-09-16 晚，本轮收口）

| 批次 | 提交 | 要点 |
|---|---|---|
| M2-8 | `0aedf7a2` | `demoSeed.ts` + `ipcBus.ts` 去 `@ts-nocheck`；`NOCHECK_LEDGER` **清空**（整文件免检 0 / 待撤销 0）——**M2 收官** |
| M6-3 | `b6c9a79f` | 格式插件 preload 收敛为唯一解析点 `core/pluginFormatPreload.ts`；Electron 态经 `preload.cjs` 新增供给面返回真实磁盘 `file://`；非 Electron 态明确不可用 |
| M6-4 | `6b1e11b6` | `createWindow` 补回 `webviewTag: true`（**D26**）；新真机门禁把 M6-3 的解析结果喂进真实 `<webview>`，断言 guest 侧真的跑起 `api-format-extension.js` |
| M7-3 | `9036e4c8` | 发布资产**登记驱动** + **复制失败即失败**；`src/my_modules` 48 项归档、保留 8 项；`src/package.json` 清旧宿主字段、留元数据 |
| 登记 | `2b837329` / `e84f1618` / 本轮 | REACT_SUITE 92 → **95**（+ `plugin-format-preload` / `webview-tag-enabled` / `publish-asset-manifest`） |

> **M4-D 对审计报告的两条勘误**（由其交付时提出，我核对采纳）：
> ① 审计说删 JSX 上的 `ng-click` 会静默改变无边框窗口拖拽区与 toast 间距——
> 实测这些属性选择器的**命中集替换前后都是空集**（25 个载体在 toolbar 宿主内，不匹配祖先链），
> 故本次零运行时外观变化；② 审计点名的 `ng-shadow`/`ng-color`/`ng-glow`/`ng-primary`
> **在 tailwind 产物中根本不存在**，213/104/26/22 是**子串误命中**。

---

## 3. 分支与提交状态

工作区：`H:/dev/Eagle-Sec-development - 副本`（主工作区，分支 `react-in-place`）

已集成的提交（自下而上）：

```
9036e4c8 feat(m7): 发布资产改为登记驱动 + 复制失败即失败；归档 48 项零消费者 my_modules 条目  [W48]
d047abd1 docs(state): M6 全部完成（M6-4 已核验集成，webviewTag 恢复）  [Coordinator]
e84f1618 test(suite): 登记 M6-4 的 webview-tag-enabled，REACT_SUITE 93 → 94  [Coordinator]
6b1e11b6 fix(m6): 恢复 webviewTag（D26）—— 格式插件 webview 首次真正 guest 化  [W47]
2389f064 docs(state): M2 收官（待撤销 0）——W44 已核验集成  [Coordinator]
e2cdf202 test(typecheck): 订正头部过期注释（"保留现有 8 项整文件免检" → 以台账为准）  [Coordinator]
0aedf7a2 refactor(m2): 撤销 demoSeed.ts 与 ipcBus.ts 的 @ts-nocheck（待撤销 2 → 0，M2 收官）  [W44]
47af1683 docs(state): 核验 W46 审计、派 W48（M7-3 发布资产登记驱动 + my_modules 退役）  [Coordinator]
2b837329 test(suite): 登记 M6-3 的 plugin-format-preload，REACT_SUITE 92 → 93  [Coordinator]
b6c9a79f fix(m6): 格式插件 preload 的原生根 —— 收敛为唯一解析点，Electron 态返回真实磁盘路径  [W45]
c5511f53 docs(state): 派 W44-W46（M2 收官 / M6-3 preload 原生根 / M7-R2 只读审计）  [Coordinator]
d59071d8 chore(m7): retire first low-risk legacy batch  [W35]
6d4ee848 test(suite): 登记 M3-3 的两个新测试，REACT_SUITE 85 → 87  [Coordinator]
55dc91ff fix(m3): 修「取消任务不回写已关闭窗口」+ Worker 自有协议类型化  [W33]
6d51ac5a refactor(m2): install.ts 撤销 @ts-nocheck + 建立具名全局声明面（待撤销 5 → 4）  [W32]
1c4214b9 fix(m4): 修 M4-A 引入的回归——自写回显被误判为外部导航，把旧视图滚动位置带进新视图  [W31]
b608b851 docs(state): 新增 D22 分层验证口径（非必要不跑全量回归）
ab465ecd docs(state): 记录 M4-A 引入的 continuous-grid-scroll 回归与二分定位（D21）
5f2d5518 test(suite): 登记 M3-2 的 m3-filter-cold-start 与 M4-B 的 m4-window-subscriptions，REACT_SUITE 83 → 85  [Coordinator]
ebf90c6d fix(m4): 采集/偏好窗 dispose 收口 + 主窗 store 订阅整形  [W28]
35675429 fix(m3): 调用点切到 core/rules/* + 治冷启动空快照不自愈 + 等价性测试事实源迁移  [W26+W30]
325e8d0d test(suite): 登记 M4-A 的 m4-url-history，REACT_SUITE 82 → 83  [Coordinator]
2502357f fix(m4): goBack/goForward 守卫修正 + 补回 URL→状态 触发面  [W27]
d4f611a2 refactor(m2/m7): moduleRegistry 强类型化 + 隐式截获契约化为声明式截获表  [W29]
9551ea6c test(suite): 登记 M3-1 / M4-C / M6-1 新增的四个测试，REACT_SUITE 79 → 81  [Coordinator]
242a8663 fix(m6): 扩展端口单一来源 + 权限面收敛 + MV3 交付契约（治生产态必然连不上的缺陷）  [W25]
553804f3 fix(m4): 预览窗 dispose 收口 —— 治好两处持续性开销（跨进程 500ms 轮询 / 主进程监听累积）  [W24]
4c1fc124 feat(m3): vendor 里的第一方规则函数迁成 core/rules/* 具名模块（批次 1，不改调用点）  [W23]
b01e6843 refactor(m2): 撤销 shim 环境层/设置层整文件 @ts-nocheck（待撤销 8 → 6）  [W19]
100f6c3b docs(state): 登记 W19-W25 台账、D14/D15，刷新批次总览
0d31dbc3 fix(tests): 登记两个孤儿测试并修复 F04 打断的预览窗订阅测试  [Coordinator]
82d5b1f8 fix(m2): 补真实裸模块登记 + 模块内相对 require 解析 + JsonRestServer 失败通道改同步抛  [W18]
f25876fb docs(state): 记录全量回归 FAILED 4 的根因（M2-1 未登记真实模块被抛错）与修复中状态
1fc34443 test(m1): 修复 F06 分流测试的 flaky 时序依赖（改为确定性等待真实落盘）  [W17]
69b489d6 feat(m5): 外围工具页/媒体页迁入 React 模块图 + 运行期地址单一来源（F17/F22）  [W16]
257ebd1c fix(m1): F04 预览窗 boot 迁入模块图（显式依赖、先安装后挂载）  [W15]
90cc3501 feat(m2): 有限 RuntimeServices + 三态运行模式 + 能力缺失即明确失败  [W13]
fd378cf5 feat(m1): F06 第三批 —— 解桩 + 格式分流唯一判定点 + 非 JPEG 后端通路  [W14]
25f84998 fix(m1): F06 前端失败语义与写回收敛（单一写回实现 + 回执校验落库）  [W11]
9b96d346 fix(m1): F08/F09 跨窗动作供给闭环 + 主窗内部字符串派发消除    [W12]
7b4e4a5f docs(state): W8(F10) 已集成、W12(F08/F09) 已派发，刷新台账
27e5053a fix(m1): F10 跨窗供给启动就绪收敛为单一 Promise（真正 await）  [W8]
4e39d389 docs(state): W10 后端图像变换端点已集成，刷新进度与下一步
c3987c6f feat(m1): F06 后端图像变换端点，旋转/翻转写回闭环            [W10]
df02b8df docs(state): 建立项目状态文件制度
284f4535 docs(m0): 建立入口台账矩阵并就地订正 F26 六处失真          [W4]
9abf8008 fix(m0): 替代展示页按真实 URL 交付，静态页缺口 A–G 闭合（FAIL 12→5）  [W3-B]
6184c0c5 fix(m0): worker 路径改为站点根绝对路径 + 已知缺失精确登记（FAIL 12→7） [W3-A]
4993933f fix(m1): F15 preload 具名频道统一返回 disposer（43/43）      [W2]
c99e0ad9 test(m0): 修复门禁单测 CLI 用例的路径还原（40/40）           [W1]
e6f6383e docs(m0): 纳入总体任务书
00352c1f chore(m0/m1): 基线提交（既有在途工作固化）
```

**主工作区当前工作区状态**：干净（仅 `?? outputs/`、`?? .workbuddy-ai/`、`?? .zcode/` 未跟踪）。

### M0 验收证据（主分支实测）

| 门禁 | 结果 |
|---|---|
| `node tests/dist-entry-check.mjs` | **FAIL 0**，已检查文件 299（原 206）※ **必须先在主工作区跑 `npm run build`**，见 D12 |
| `node tests/frontend-gates-unit.mjs` | 40/40 |
| `node tests/preload-subscriptions.mjs` | 43/43 |
| `node tests/preview-entry-subscriptions.mjs` | 12/12 |
| `node tests/typecheck.mjs` | TYPECHECK_OK，0 诊断 |

### 主分支验收证据（M2-2 合并后，`82d5b1f8`）

| 门禁 | 结果 |
|---|---|
| `npm run build`（`vite build --config frontend/vite.preview.config.mjs`） | BUILD_EXIT=0；4/4 page relocated |
| `node tests/dist-entry-check.mjs` | **FAIL 0**，已检查文件 303 |
| `node tests/typecheck.mjs` | TYPECHECK_OK，0 诊断 |
| `node tests/shim-module-boundaries.mjs` | SHIM_BOUNDARY_OK |
| `node tests/continuous-grid-scroll.mjs` | PASS（EXIT=0） |
| `react-stage7a/7c/8e2-smoke` | STAGE7A_SMOKE_OK / STAGE7C_SMOKE_OK / STAGE8E2 SMOKE OK |
| `node tests/run-react-suite.mjs` | **REACT SUITE ALL GREEN（77 项：OK 76 + retry-OK 1）**，SUITE_EXIT=0 |

> 唯一 retry 项 `react-s2-sidebar-dnd-closed-loop`（首败 `dragend cleanup timeout`）是 `run-react-suite.mjs`
> 头部注释里已记载的既有低频抖动，本次改动不涉及 DnD；首败尾部已留证。

### 主分支验收证据（M2-3/M3-1/M4-C/M6-1 合并后，`9551ea6c`）

| 门禁 | 结果 |
|---|---|
| `node tests/run-react-suite.mjs` | **REACT SUITE ALL GREEN（81 项：OK 79 + retry-OK 2）**，SUITE_EXIT=0 |
| `node tests/typecheck.mjs` | TYPECHECK_OK，0 诊断；**整文件 `@ts-nocheck` 6，待撤销 6**（原 8/8） |
| `node tests/frontend-gates-unit.mjs` | 40/40 |
| `node tests/match-rules-equivalence.mjs` | 21/21 |
| `node tests/m4-preview-dispose.mjs` | 9/9 |
| `node tests/browser-extension-delivery.mjs` | passed（产物逐字比对 7 文件；**须先 `npm run build`**） |
| `node tests/browser-extension-mv3-e2e.mjs` | **BROWSER_EXTENSION_MV3_E2E_OK**（真实 Edge 153 + 构建出的 MV3 产物，count=3） |
| `npm run build` + `node tests/dist-entry-check.mjs` | BUILD_EXIT=0；**FAIL 0**，已检查文件 303 |
| `node tests/browser-extension.mjs` | passed（**需后端 41693 与前端 4173 同时在跑**，与改动前同一前提） |
| `node tests/frontend-public-policy.mjs` | 9/9 |

> retry 两项 `main-ui-workflow-closed-loop`（`inspector operation result timeout`）与
> `empty-trash-closed-loop`（`backend items removed timeout`）均为加载下的 IPC 超时，
> 重跑即过；与 M3-1（规则模块）/ M4-C（预览窗 dispose）/ M6-1（扩展）改动无交集。

已知缺失登记（非豁免，带退出条件，`tests/frontend-gate-manifest.mjs` 的 `KNOWN_MISSING_ASSETS`）：
- `src/my_modules/utif/UDOC.js`（worker 侧 try/catch 包裹的刻意可选依赖）
- `font/2.0.0/VideoJS.eot`（video.js vendor 的 IE 遗留分支，同字体已内联 WOFF）

---

## 4. Worker 台账

| ID | Task ID | Dispatch ID | 任务 | 状态 |
|---|---|---|---|---|
| W1 | task_82384445e6a2 | ctx_3474f61d16e1 | M0-1 门禁单测路径还原 | ✅ 已集成，已释放 |
| W2 | task_37a31881f2f3 | ctx_6f77306ad415 | M1-2 F15 preload 退订 | ✅ 已集成，已释放 |
| W4 | task_d3c78df6f450 | ctx_bafd4207a976 | M0-3 入口台账 + F26 订正 | ✅ 已集成，已释放 |
| W3-A | task_6946c2d7edc5 | ctx_663d7828b230 | M0-4 worker 路径/动态资产 | ✅ 已集成，已释放 |
| W3-B | task_96d991d2c516 | ctx_8fdffc3d83a3 | M0-5 静态页交付缺口 | ✅ 已集成，终端 retained(user_takeover) |
| W5 | task_898a8302f9d2 | ctx_4a03c4c9b535 | M7-R 遗留退役审计（只读） | ✅ 已交付，已释放 |
| W6 | task_aaaa17f75750 | ctx_1dbf074c572c | M1-R F06 图像写回调研（只读） | ✅ 已交付，已释放 |
| W7 | task_d91dec5e7223 | ctx_0c2ec444d9ea | M1-R F08/F09 动作供给调研（只读） | ✅ 已交付，已释放 |
| W9 | task_d524cfa5b4bf | ctx_3b6728a4588d | M2-R F07 能力矩阵调研（只读） | ✅ 已交付，已释放 |
| **W8** | task_b29062f1f261 | ctx_9f589180c733 | **M1-3 F10 启动就绪 Promise** | ✅ **已集成(`27e5053a`)**，终端 retained |
| **W10** | task_1ec4ff82fdf1 | ctx_0fb8e0d33d86 | **M1-4 F06 后端图像变换端点** | ✅ **已集成(`c3987c6f`)，已释放** |
| **W11** | task_18b97e0f8847 | ctx_c4300aea974c | **M1-5 F06 前端失败语义与写回收敛** | ✅ **已集成(`25f84998`)**，release_unknown（终端待清） |
| **W12** | task_114936ac524e | ctx_5cb9a69fa7fc | **M1-6 F08/F09 动作供给与派发收口** | ✅ **已集成(`9b96d346`)**，终端 retained |
| **W13** | task_18aeb93aa2fc | ctx_88eeaf5f4776 | **M2-1 有限 RuntimeServices 与显式能力失败** | ✅ **已集成(`90cc3501`)** |
| **W14** | task_6988e84a7be3 | ctx_9ca58917eee7 | **M1-7 F06 前端真实能力接线（格式分流）** | ✅ **已集成(`fd378cf5`)**（首次派单因 ask 通道受阻重派） |
| **W15** | task_1e1194c99c58 | ctx_abc83ddf074b | **M1-F04 预览窗 boot 迁入模块图** | ✅ **已集成(`257ebd1c`)** |
| **W16** | task_1ef187d72462 | ctx_445c33347b34 | **M5-1 工具页/媒体页进模块图 + 运行期地址** | ✅ **已集成(`69b489d6`)** |
| **W17** | task_2f6fabf7dd28 | ctx_54b60df66dc7 | **F06 分流测试 flaky 修复** | ✅ **已集成(`1fc34443`)** |
| **W18** | task_6f79bc8608a8 | ctx_1978100e92dd | **M2-2 回归修复（补真实模块登记 + 能力取舍取证）** | ✅ **已交付核验并集成(`82d5b1f8`)**，终端已释放 |
| **W19** | task_d4c71c975ace | ctx_932025c58101 | **M2-3 撤销 shim 环境层/设置层 `@ts-nocheck`** | 🔄 进行中（worktree `m2-shim-env`）。代码侧已完工全绿，等门禁台账裁决 → 已裁决 **A**（授权删 2 行台账 + 更新 `frontend-gates-unit` 的写死 8） |
| **W20** | task_96e61753ab96 | ctx_29094d93aabd | **M3-R 只读审计（F03 / F16）** | ✅ 已交付 `outputs/research-m3-scripts-workers-2026-09-16.md` |
| **W21** | task_cb07c2b92eb5 | ctx_e3db3e7b5f55 | **M4-R 只读审计（F11–F14）** | ✅ 已交付 `outputs/research-m4-windows-scope-2026-09-16.md`（1167 行） |
| **W22** | task_ce1be135c8b1 | ctx_821ced9fb23f | **M6-R 只读审计（F18 / F19）** | ✅ 已交付 `outputs/research-m6-extension-plugin-2026-09-16.md` |
| **W23** | task_d185576cff1e | ctx_c2d358c25c93 | **M3-1 `core/rules/*` 具名模块化（不改调用点）** | ✅ **已交付核验并集成(`4c1fc124`)** |
| **W24** | task_631ea410089d | ctx_c5af03659909 | **M4-C 预览窗 dispose 与两处持续性开销** | ✅ **已交付核验并集成(`553804f3`)** |
| **W25** | task_cc246d9917e9 | ctx_e9d3a9ff65d5 | **M6-1 扩展端口单一来源 + MV3 交付契约** | ✅ **已交付核验并集成(`242a8663`)**；本机 Edge 153 实机 MV3 e2e 通过 |
| **W26** | task_f4d7a4bbb60e | ctx_1516197a7789 | **M3-2 调用点切换与冷启动空快照修复** | ✅ **已交付核验并集成(`35675429`)**（与 W30 同批） |
| **W27** | task_e362ada5c4cf | ctx_e3dc3e79b6ee | **M4-A URL 双向同步与历史守卫** | ✅ **已交付核验并集成(`2502357f`)**；`m4-url-history` 25/25 |
| **W28** | task_7ed261ef6422 | ctx_b1de96b5d57e | **M4-B 采集/偏好窗 dispose 与 store 订阅守卫** | ✅ **已交付核验并集成(`ebf90c6d`)**；`m4-window-subscriptions` 23/23。**存一处已登记偏差**（净增 3 处 `(window as any)`，见 D20） |
| **W29** | task_6ddbc52ec73b | ctx_010830f11495 | **M2-4 moduleRegistry 类型化与截获契约化** | ✅ **已交付核验并集成(`d4f611a2`)**；`待撤销 6 → 5`，截获表契约 6/6 |
| **W30** | task_da247f585fd6 | ctx_4c6460644027 | **M3-2fix 等价性测试事实源迁移（按裁决加严）** | ✅ **已交付核验并集成(`35675429`)**；`match-rules-equivalence` 22/22（原 21 条全保留 +1b） |
| **W31** | task_a7644295ccf7 | ctx_c892cf9860cf | **M4-Afix 修 `continuous-grid-scroll` 回归** | ✅ **已交付核验并集成(`1c4214b9`)**，终端已释放 |
| **W32** | task_446c1cccd6cc | ctx_f3379bc2f123 | **M2-5 `install.ts` 类型化 + 具名全局声明面（含 D20 的 3 处 cast 收口）** | ✅ **已交付核验并集成(`6d51ac5a`)**；`待撤销 5 → 4` |
| **W33** | task_77b37af7755a | ctx_25153d2bed77 | **M3-3 Worker 协议类型化 + 取消写回守卫** | ✅ **已交付核验并集成(`55dc91ff`)**；两个新测试 5/5 与 13/13 |
| **W34** | task_21486b3c4d89 | ctx_0ee6165705f7 | **M4-D 引擎 adapter + domLite + ng-* 成对替换** | ❌ **codex 派单失败**：~90 分钟零产出（shell 通道全废，见 D23）。已停，**回退 claude 重派为 W36** |
| **W35** | task_bc9de10cc760 | ctx_c9c8c7ce142e | **M7-1 低风险退役批次 1** | ✅ **已交付核验并集成(`d59071d8`)**。codex 完成但**检索不可信**——其「无消费者」前提由 W5 审计提供，我另行复核了四个文件名的可执行引用才合并 |
| **W36** | task_21486b3c4d89 | ctx_0999764de948 | **M4-D（claude/deepseek-flash 重派）** | ✅ **已交付核验并集成(`b5f9ab71`)**；3 个新测试 28 用例 |
| **W37** | task_30c0a7fb77c4 | ctx_fe6d73d44011 | **M2-6 `desktopCapability.ts` 类型化 + 清 `ng-click` 死声明** | ✅ **已交付核验并集成(`f761c440`)**；`待撤销 4 → 3` |
| **W38** | task_79c25c10868d | ctx_e53afa53c372 | **M4-E `detailHooks` jQuery 哑雷 + F11 晚注册 + 死声明** | ✅ **已交付核验并集成(`242e5618`)**；F11 探针坐实缺陷真实存在 |
| **W39** | task_3af87fd55102 | ctx_a8c14395e5cd | **M5-2 非默认端口生产验收 + 等就绪再开窗** | ✅ **已交付核验并集成(`c987dfef`)**；`PRODUCTION_RUNTIME_PORTS_OK`（真实 Electron） |
| **W40** | task_5d997ffff22d | ctx_e13631998354 | **M6-2 插件根统一到仓库内 `plugins/` + SDK 顺序与回调派发（F19）** | ✅ **已交付核验并集成(`c220af64`)**；两个新测试登记进 `npm test`（`3b3861c4`） |
| **W41** | task_8d1331bb9419 | ctx_6653e3718049 | **M7-2 tab-bar 退役 + 旧宿主入口隔离归档（F02/F20）** | ✅ **已交付核验并集成**；其负向门禁的**扫描口径有缺陷（我方修）**见 D25 |
| **W42** | task_984014a701ea | ctx_16e2a6cd099e | **F23 产物门禁加固（入口/生成资源缺失无条件失败）** | ✅ **已交付核验并集成(`a436d3f1`)**；`frontend-gates-unit` **40 → 59**（+19 条负向用例） |
| **W43** | task_95ba134f76fc | ctx_a64d3c602b93 | **M2-7 `browserRuntime.ts` 类型化** | ✅ **已交付核验并集成(`5d6c4311`)**；`待撤销 3 → 2`。其上报的写死台账断言由我方改造（`9febfb15`） |
| **W44** | task_adcdfbccc219 | ctx_a511943eb8ae | **M2-8 `demoSeed.ts` + `ipcBus.ts` 类型化（M2 收官，待撤销 2 → 0）** | ✅ **已交付核验并集成（`0aedf7a2`）**；我方独立复核：typecheck 0 诊断/免检 0、shim-module-boundaries OK、runtime-services-contract 20/20、module-registry-contract 6/6、frontend-gates-unit 59/59、preload-subscriptions 43/43、m4-window-subscriptions 23/23；偏差清单逐条复核通过（`.attempts` 全仓只写不读、`clearInterval(null)` 本是 no-op） |
| **W45** | task_c5922c0e3ca7 | ctx_e9636c5b0a65 | **M6-3 格式插件 preload 的原生根修正** | ✅ **已交付核验并集成（`b6c9a79f` + 登记 `2b837329`）**；新测试 13/13、typecheck 0 诊断。**顺带坐实 webviewTag 缺陷 → D26** |
| **W46** | task_ebfed344f1dc | ctx_a3dd400c873c | **M7-R2 只读审计：`nativeRequire` 目标集 / `src/my_modules/**` / `src/package.json`** | ✅ **已交付并核验**（`outputs/research-m7r2-my-modules-2026-09-16.md`，705 行）。核验见 §5 备注 |
| **W47** | task_0224e87e62c4 | ctx_98debf473286 | **M6-4 恢复 `webviewTag`（D26）+ 实机门禁** | ✅ **已交付核验并集成（`6b1e11b6` + 登记 `e84f1618`）**。`main.cjs` 只加一行、`stage9a2` 只改一处断言（已验证是加严非放宽）。**我方独立做了负向自证**：移除 `webviewTag` 后门禁 0/4、红 4（`constructorName=HTMLElement`、无 guest、零 attach 事件、`guestProbe=null`），恢复后 4/4。L2 复核：stage9a2 / main-ui-workflow / preview-delivery / typecheck 全绿 |
| **W48** | task_4504588e768c | ctx_94ff0bd35249 | **M7-3 发布资产登记驱动 + 复制失败即失败 + 退役零消费者 `my_modules` 条目** | ✅ **已交付核验并集成（`9036e4c8`）**。我方独立核验：① 写了独立扫描器把 live code 里所有 `my_modules/<首段>` 引用与「现存目录 / 截获表」两侧对账，结论**无悬挂引用**（唯二命中是 `QuickSearchModal.tsx:36` 注释里的 `...` 与死文件 `src/app/js/plugin/main.js:125`）；② `moduleRegistry.ts` 全部磁盘路径逐一 `test -e` 均存在；③ 主工作区实跑 `npm run build`（13 条登记资源、无 `skip(absent)`）+ `dist-entry-check` FAIL 0/304 + 新门禁 5/5 + `frontend-gates-unit` 59/59；④ **真实 Electron 闭环**：`main-ui-workflow`（3 连跑均 OK）、`library-switch-ui`、`d3-boot-render`、`continuous-grid-scroll`（哨兵）全绿 |

> W37/W38 都允许改 `global/globals.d.ts` 的 `'ng-click'` 那一行——**冲突由 Coordinator 合并时处理**
> （两边都只删同一行，cherry-pick 冲突是平凡解）。
> W39 是 codex 派单，已按 D23 的规则先探针确认其 shell 与检索可用后再派。

> **W46 报告的我方核验（不采信汇报）**：Coordinator 用独立写的扫描器（限定 live code 根：
> `src/app/react`、`src/app/js`、`src/app`、`backend`、`frontend`、`electron`、`scripts`、`plugins`、`tests`，
> 排除 `node_modules`/`dist`/`outputs`/点目录/`my_modules`）对 48 个候选逐项反查，结论一致：
> 26 项在 live code 里**零命中**；另 18 项的全部命中都是 `req(appRoot + '/my_modules/x')` 且**都在
> `moduleRegistry.ts` 的 `INTERCEPT_TABLE` 里有对应截获项**（`access`/`appdata-path`/`bplist-parse`/
> `curl-request`/`electron-settings`/`file-icon`/`get-associated-application`/`get-drive-type`/`heif`/
> `image-cropper`/`image-size`/`is-directory`/`is-hidden-file`/`json-rest-light`/`n-readlines`/
> `sanitize-filename`/`url`/`vtt2srt`）。另核：`importScripts` 全仓仅 `utif`（保留对象）；HTML 的
> `<script src>` 仅 `raw-viewer/index.html:8` 的 `raw-parser`（保留对象）；`pngjs` 的 24 处命中全是
> **裸说明符** `import { PNG } from 'pngjs'`（解析到 `node_modules`），与 `src/my_modules/pngjs` 无关；
> `ms`/`exif`/`heif` 的多处命中是子串/文件扩展名误命中。**唯一需注意的差异**：`electron-window-state`
> 有 1 处引用 `src/app/js/plugin/main.js:125`，但该文件**无任何加载点**（只有 `frontend-gate-manifest.mjs:164`
> 的登记名列表提到它），属死宿主，故退役结论成立。
>
> **D23 实测记录**：本机 codex worker 的 shell 通道**整体不可用**（所有命令经 WSL，
> `/bin/bash` 缺失，输出恒为空却像正常执行）。所以它给的「无消费者/搜不到」类结论**必须自己复核**；
> 删文件这类批次不能只信它。详见项目记忆 `env-codex-rg-wsl-broken.md`。

> W32–W35 的 spec 均在 `outputs/`（未跟踪）：`_spec-m2-5.txt`、`_spec-m3-3.txt`、`_spec-m4-d.txt`、`_spec-m7-1.txt`。
> 本波按 D16 分档：前两个 claude/deepseek-flash、后两个 **codex 默认配置**（实测 `--agent codex`
> 可不带 `--model` 直接派起，`turnStart: observed`）。
> **四个 Worker 的文件所有权互斥**（spec 的禁止清单已交叉写明）：
> W32=shim/install.ts + globals.d.ts + 3 行 cast；W33=workers/ + commentHooks.ts；
> W34=viewers/ + smoothZoomEngine(3020-3050) + css/sass；W35=四个待退役文件 + gate-manifest。

> W23–W25 **首次派单全部卡在 Bypass 确认框**（`skipDangerousModePermissionPrompt` 又被抹掉，
> 见 §7.1），进程实际已退出、`worker-stop` 后带 `--retry-of` 重派成功。
> **本波起的新约定**：Worker **不得**改 `tests/react-suite-manifest.mjs` / `tests/run-react-suite.mjs`，
> 新测试的登记由 Coordinator 在合并后统一做——彻底消除 D11 那类「多 Worker 同改清单」的必然冲突。

> W19–W22 的 spec 均在 `outputs/`（未跟踪）：`_spec-m2-3.txt`、`_spec-m3r.txt`、`_spec-m4r.txt`、`_spec-m6r.txt`。
> 只读审计的交付物按约定写入 `outputs/research-*-2026-09-16.md`。
> **观察**：4 个 Worker 并发时出现 provider **429 限流重试**，各自 backoff 后仍在推进；
> 后续波次的并发度建议控制在 3 以内，或错峰派遣。

> W18 报告：`test-run/m2-2-regression-report.md`（worktree `m2-runtime-services` 内，`test-run/` 为 gitignore）。
> **注意基线口径**：该 worktree 基于 `930f189c`（M2-1 合入前的分叉点），其 `REACT_SUITE` 为 **73 项**、
> 不含 F04/M5-1/F06 第三批/flaky 修复的登记项。故它的 "ALL GREEN 73 项" 只能证明"在其基线上回归被修复"，
> **不能替代主分支 77 项验收**——后者由 Coordinator 在合并后独立跑，见 §3 验收证据。

已停止/废弃的 dispatch（均因 Claude Code Bypass 确认框吞掉 prompt，见 §7）：
`ctx_5663f9e12c59`、`ctx_a7448bed8767`、`ctx_a2cc223b93bb`、`ctx_bfea030a61fb`（全部 stopped）

**Run**：`run_c4e23f54b49a`

---

## 5. 调研交付物（只读报告，位于 `outputs/`，未跟踪）

| 报告 | 行数 | 关键结论 |
|---|---|---|
| `research-legacy-retirement-2026-09-15.md` (W5) | 945 | tab-bar.js / url-state-service.js → 可退役；plugin/index.js → 需先补替代；browser-extension 判"必须保留"但有生产阻塞（硬编码端口 41593/5176 与 start-production 的 41693/4173 冲突） |
| `research-f06-image-ops-2026-09-15.md` (W6) | 379 | **原版实现存在且完整**（`src/app/js/utils/{rotateImage.js:405,flipImage.js:352}`），被 `moduleRegistry.ts:106-107` 无条件截获为空函数；推荐方案 C（JPEG 走渲染层 EXIF 无损、其余走后端 sharp） |
| `research-f08f09-actions-2026-09-15.md` (W7) | 464 | 动作契约对照表 108 行；**供给点为「无」的动作 60 个**；`imagesChange/removeStar/changeToNStar` 连 driverApi 白名单都不在（7 项全缺） |
| `research-f07-capability-matrix-2026-09-15.md` (W9) | 358 | 能力矩阵 62 行（41 行为替身/空实现）；危险清单 37 条（29 条在 electron 生产态同样生效）；**`resolveRuntimeMode()` 全仓只有 install.ts:40 一个消费者**；**browser-connected 不构成独立态**（`!hasDesktopApi` 即判 demo → 浏览器连真后端仍灌 demo seed） |
| `research-m3-scripts-workers-2026-09-16.md` (W20) | — | F03：`eagle-match-rules.js` 第三方边界字节级定位（L1068-1084 三个 MIT 小库**不得删**），第一方 L33-1067 消费者仅 `filterDomain.ts:1140-1171`（唯一调用点 `:2136`）；**「冷启动空函数窗口」结构上确凿**——`[]` 在 JS 里是真值，空快照写进 `contentFilterCache` 后**永不复算**；F16：4 个 Worker 中 3 个可转 TS，`importScripts` 是硬边界；**另确认「取消任务不回写已关闭窗口」缺陷存在**（`commentHooks.ts:1105-1201`），`bitmapViewer.ts:321-328` 已有正确防护 |
| `research-m4-windows-scope-2026-09-16.md` (W21) | 1167 | **主窗其实已迁完**（20 个 zustand store + `bind*Sync` 快照桥，无可变 controller）；真正剩下的是三个子窗。**`canGoBack/canGoForward` 的缺陷是属性读取不加括号 → guard 恒真**；URL→状态**只有启动期一次性读**、React 侧零 `popstate/hashchange` 监听。**只有两处「持续性开销」**：`preview-window/controller.ts:2152` 的 500ms 跨进程轮询、`shell.tsx:699-703` 每次切项向主进程注册且无 off。**两个孤儿测试**（`preload-subscriptions` / `preview-entry-subscriptions`）不属任何套件，应最先登记 |
| `research-m7r2-my-modules-2026-09-16.md` (W46) | 705 | **穷尽 `nativeRequire` 目标集**（结论：本仓**没有**任何 `nativeRequire('...my_modules...')` 调用点，故不存在「nativeRequire 与 shim 同时可达」的条目）；`src/my_modules` 56 项三分法：**① 仅经 `intercept table`/`bareModules` 供给、磁盘不执行 18 项**；② 真正经源码加载器/经典 script/Worker 从磁盘加载 7 项（`junk`/`pinyinlite`/`chinese_convert`/`tiny-pinyin`/`cartesian-product`/`raw-parser`/`utif`）；③ 两条路都可能 0 项。**退役分档：可立即退役 48 / 需先补替代 2（`junk`、`is-network-drive`）/ 必须保留 6**。`src/package.json`：`main` 无解析者，但 `version`/`buildVersion`/`buildNumber` 有 5 处现役消费者（删了会改变对外行为）。未确认项 5 条（U-01…U-05）逐条写清「没验到什么/为什么」 |
| `research-m6-extension-plugin-2026-09-16.md` (W22) | — | 扩展侧**无任何构建目标**（6 个手写文件由 publicDir 逐字复制），故「popup React / background·content TS」是从零新建而非改造；**41593 在生产必然不可达**（`start-production.mjs:26-34` 恒设 `EAGLE_EXTENSION_PORT`，使 `server.js:3437` 的兼容监听门控为假）；MV2 fixture 不是 MV3 的 drop-in（等待的属性名不同）；插件侧**四个根互不相同、三个不可达**；`/plugin-shim.js` 只注册回调**从不派发**，现状被 `main.cjs:3595` 的 `typeof window.eagle` 断言掩盖 |

---

## 6. 关键决策记录

| # | 决策 | 依据 |
|---|---|---|
| D1 | 提交既有未提交工作作为基线 `00352c1f` | worktree 隔离需干净的 base；否则并行 Worker 会丢失这批成果 |
| D2 | 任务书入库一份到 `docs/plan-2026-09-15-full-workspace-legacy-audit.md` | 使各 worktree 可访问；原文件保留在 `outputs/` |
| D3 | Worker 的 worktree 用 `--setup skip` + Coordinator 建 `node_modules` 目录联接（Node `fs.symlinkSync(...,'junction')`，**不用 `mklink`——中文路径下 cmd 编码会失败**） | 仓库含 `src/node_modules`，`npm install` 成本过高；联接后测试/构建均可跑 |
| D4 | 已知缺失采用「逐条精确登记 + 反向校验」而非普遍豁免 | 任务书 M0 口径；登记项若已存在会 FAIL，防僵化 |
| D5 | F06 按格式分流（方案 C），分前后端两个 Worker 并行 | JPEG 无损 EXIF 是原版产品语义，不可用 sharp 重编码替代 |
| D6 | **F06 宽高持久化落点裁定：不新建 v2 通道**（W11 提问） | 仓库中 `/api/v2/item/updateMany` **路由不存在**，只有 `/api/item/updateMany`；`V2_ALLOWED_FIELDS` 只是 `item-workflow-service.js:185` 的 contract 分支字段集。且 `thumbnail-task-service.js:451-462` 的 `commitThumbnail` 本就写 width/height。宽高权威落点由后端变换端点在**同一请求内**原子完成；前端只做「等待回执 + 校验落库 + 未落库则显式报错」 |
| D7 | **F06 存在一个有意为之的中间态**：W11 合并后、F06 能力接线（第三批）合并前，写文件模式的旋转/翻转会**明确报错拒绝** | 桩未解（`moduleRegistry.ts:106-107`），能力探测按函数元数判为不可用。这正是 W11 的目的——把「静默假成功」换成「诚实失败」；闭合依赖第三批解桩 + 接后端端点。**该窗口期内写文件不可用是已知且接受的**，不是回归 |
| D8 | **并行 Worker 的文件所有权切分**：`core/shim/moduleRegistry.ts` 归 F06 第三批，shim 其余 7 个文件归 M2-1 | 两者都要碰 shim 层但落点不同；不切分则并行编码必然冲突。M2 的能力声明（`imageOps`）与 F06 的格式分流是**正交维度**（环境 × 格式），整合留给 Coordinator |
| D9 | **Worker 不跑全量回归**（用户 2026-09-15 指示）；全量由 Coordinator 在**无并行 Worker** 时统一跑 | 各 worktree 的 `node_modules` 是共享 junction，`node_modules/.vite/deps` 也共享——任一 Vite 实例 hash 不匹配就**先删该缓存再重建**，被 teardown 打断即永久缺失，导致其他 Worker 的 Vite/smoke 测试成片假失败（M2-1 实测 `SUITE_EXIT=127`、F06 第三批实测 stage7d4/7d5a/7d5b 连续 FAIL）。M2-1 用 HEAD 对照（stash 前后报错文本与行号完全一致）证明非其改动所致 |
| D10 | **测试里的"等异步完成"必须是有上限的条件轮询，不得用固定轮数推进假计时器** | F06 第三批的 `drainIo(timers, 60)` 实测整段仅约 0.3ms 墙钟、与真实 fs 写盘无关；注入 +10ms 即需约 228 轮，12 并发可稳定复现断言失败。已改为「推进假计时器 + 有上限轮询真实条件（10s）+ 超时打印现场」 |
| D11 | **`tests/react-suite-manifest.mjs` 的 `REACT_SUITE` 长度必须每次合并后重新数** | 历史上注释与实际长度多次不同步（写过 71/72/73），本批合并后实际为 **77**。已在 `run-react-suite.mjs` 头部写明"必须重新数" |
| D12 | **跑 `dist-entry-check` 前必须先在主工作区 `npm run build`** | 该门禁读的是 **gitignored 的构建产物 `dist/frontend`**（`checkDist` 默认 `root = projectRoot/dist/frontend`），不是源码。M5-1 改的是源 shell（`src/app/react/tools/workbench/index.html` 等），主分支 `dist` 未重建，于是 4 项报「没有 module 入口脚本」（workbench/roadmap/media-viewer audio+video，产物 mtime 分别停在 Aug 3 / Aug 28 / Sep 15 12:27）。**重建后 FAIL 0（303 文件）**，源 shell 确有 `<script type="module">`——属假失败，非回归 |
| D13 | **`JsonRestServerStub.start()` 的失败通道由 rejected Promise 改为同步抛出** | 两个真实调用点（`bundleGlobals._startAPIServer` 的 try/catch + noop、`miscDomain` power-resume 的 try/catch + `electronLog.error`）**都只接得住同步抛错**；`Promise.reject` 两者都接不住 → unhandled rejection 被 CDP 记为 `Runtime.exceptionThrown`，把「能力缺口」淹没成未捕获异常。失败语义**未放宽**：`capabilityGap` 照旧登记缺口、成功回调照旧不触发、不退回修前那个「无条件 `Promise.resolve` 调 callback」的假成功。契约测试相应**加严**（1 → 3 条断言） |
| D14 | **M2-2 的能力取舍裁决：`http`/`https` 与 `JsonRestServer` 保持显式失败；`archiver`/`fast-glob` 维持 no-op** | 三者均经消费者取证：`http`/`https` 唯一消费者 `urlEnlarger.#checkURLByEagle` 被 `isRunningInEagleApp` 门控且**无 try/catch**（贸然给真实实现会重新引入「抛点落在无保护表达式上」）；`JsonRestServer` 真实实现 `src/my_modules/json-rest-light` 首行即 `require('http')`，browser-connected 态确无该能力（41595 的 API 面由后端承担，见 `installBrowserFetchRewrite`）；`archiver` 仅见于**从不被加载**的 `src/app/js/plugin/index.js` 与渲染层 0 消费者的 `src/my_modules/zip-folder`，`fast-glob` 唯一消费者在独立后端进程。两者已登记进 `capabilities.gaps`，不是静默成功。**待证项：Electron 下 `nativeRequire('http')` 可能可用（`nodeIntegration: true`），两条接线均未做，是推测不是结论** |
| D15 | **套件之外的测试等于长期未跑——两个孤儿测试已登记，且登记时立刻抓到一个真回归** | M4-R 审计发现 `preload-subscriptions.mjs`(F15) 与 `preview-entry-subscriptions.mjs`(F13-preview) **从未登记进任何套件**（只有本文件的手工运行记录）。登记前实测：前者 43/43 通过，**后者在主分支 12/12 全红**——`F04`(`257ebd1c`) 给 `preview-window/entry.tsx` 加了 `import { assertPreviewBootInstalled } from './boot'`，而该测试的隔离加载器只接受白名单依赖，报「禁止加载未隔离的依赖：./boot」。**因为文件不在套件里，此前每次全量回归都没覆盖到它**。修法（只加严）：imports 表补 `./boot` 受控替身 + **新增**断言 `order === ['boot','createRoot']`（把 F04 的顺序不变式变成可执行断言，负向自证过：移除该调用即 12 红）。两项并入 `REACT_SUITE`、`TEST_CLASSES(static)`、`REQUIRED_TESTS`；`REACT_SUITE` **77 → 79**。**教训：验收前必须先核对"仓库里的测试是否都进了套件"** |
| D16 | **Worker 模型分档：同一波第 3 个起改用 `codex`（默认配置）** | 用户 2026-09-16 指示（**当前有效版本**）：第 1、2 个 `--agent claude --model deepseek-flash`；第 3 个起 `--agent codex`（**不传 `--model`/`--effort`**）。本机 `codex-cli 0.154.0`，Orca `account list` 报 `codex.systemDefault.hasAuth = true`（api-key）。**历史**：同日较早一版曾定为 antigravity 的 Gemini 3.8 Flash high——实测可用（不传 `--model`，默认即 `Gemini 3.8 Flash (High)`），但已被本次指示取代；其「工作区信任」坑见 D18。已记入项目记忆 `feedback-worker-model-tiering.md` |
| D17 | **只读审计报告必须复制进编码 Worker 的 worktree** | `outputs/` 是**未跟踪**目录，`git worktree add` 不会带过去。M4-C 与 M4-B 都报告过「任务所述的 `outputs/research-m4-windows-scope-2026-09-16.md` 在工作树与 git 历史中均不存在」。**派单前必须 `cp outputs/research-*.md <worktree>/outputs/`**，否则 Worker 只能凭 spec 里的摘要干活。根治办法（待做）：把报告纳入 git 或改为随任务投递 |
| D18 | **antigravity Worker 首次在某个 worktree 启动会卡在「工作区信任」提示** | 症状：`worker-start` 返回 `state: failed`、`lastError: "Agent startup blocked: agent-trust-workspace"`，**spec 尚未投递**。处置：读终端 → `orca terminal send --terminal <handle> --text "" --enter`（`Yes, I trust this folder` 默认选中）→ 再 `worker-start … --agent antigravity --retry-of <旧 dispatchId>`。未找到可预置的信任列表文件（`~/.gemini/antigravity*` 下只有 brain/logs） |
| D19 | **Worker 上报「规范冲突」时的裁决口径：授权改测试，但要求加严、不得只删断言** | W26（M3-2）的实例：批次 1 的 `match-rules-equivalence.mjs` 用**源码文本正则**抓 `filterDomain.ts` 里的 26 对 `w.isMatchXxxRule` 作为「表结构」判据；批次 2 的硬性要求正是把该函数体切走，于是探针必然抓到 0 对（`not ok 1` 及其下游 `not ok 3`/`not ok 8` 全属同一条多米诺）。**这类冲突要区分「测试在守护什么」**：它守护的是「规则表 = filterDomain 实际使用的那张表」，迁移后这个命题的**事实源变了**，应当随之重指向，而不是保留一个已失真的探针或直接删掉。裁决要求：① 把事实源重指向 `core/rules/matchRuleTable.ts`；② 把 26 键与顺序**冻结成测试内的字面清单**（防止「解析自己」自证）；③ **新增**「`filterDomain.ts` 里 `w.isMatch*Rule` 命中数为 0 且确实引用了 `getMatchRuleTable`」的迁移完成断言；④ 其余 17 条运行时等价性断言一字不改；⑤ 必须做负向自证 |
| D20 | **M4-B 存一处已登记偏差：净增 3 处 `(window as any)`——不掩饰、留后续项** | W28 在 `collect-window/controller.ts`（14→15）与 `preferences/entry.tsx`（3→4）净增 3 行 `(window as any)`（`preferences?.theme`、`CollectItem`、`__eaglePreferencesEntryReady`）。核查结论：三者都是这两个文件**既有的**「读 window 动态全局」惯用式（同文件原本已有 14 处 / 3 处），**不是用来掩盖类型错误**——同批里它们反而**加强**了守卫（`?.`、`typeof` 判函数、失败回落）。但它确实踩了硬约束 1「不得新增 `any`」。**根治方式**：在 `global/globals.d.ts` 为这些 window 全局加 `declare global` 声明，届时这三处与同仓既有 85 处可一并消除。**已登记为 M2 类型化批次的后续项**，不在本批回退（回退会让那三处的空值防护一并丢失） |
| D21 | **合并后必须跑全量回归；红了要用 git worktree 二分定位到具体提交，再派原 Worker 修** | 实例：85 项全量回归 `FAILED: 1: continuous-grid-scroll`（`first folder visit starts at the top`，`4500 !== 0`，首跑与重跑均红 → 确定性，非抖动）。定位手法：`git worktree add --detach <commit> <路径>` + 建 `node_modules` junction + 单独跑该测试 —— `d4f611a2`（M4-A 之前）**PASS**、`2502357f`（含 M4-A）**FAIL**，一次二分即锁定。**教训：单个 Worker 的定向测试全绿不等于合并后安全**——M4-A 自己的 `m4-url-history` 25/25 全绿，却在它没覆盖的既有闭环测试上打红了主分支。**另注**：`continuous-grid-scroll` 正是 M2-2 那次回归的同一项，它是本项目对「主窗启动/网格几何」最灵敏的哨兵 |
| D22 | **分层验证口径：非必要不跑全量回归**（用户 2026-09-16 指示「非必要不跑全套了太慢了」） | 替代「每批合并后跑 85 项」的默认动作：**L1**（每次合并后必跑，秒级～分钟级）= `typecheck` + 改动覆盖到的定向 `tests/<域>-*.mjs`（改了 `core/shim/**` 再加 `shim-module-boundaries` 与 `runtime-services-contract`）；**L2**（改动共享面时）= L1 + 该域既有全部闭环测试（选测试的办法：`grep -l "<改动的源文件路径>" tests/*.mjs`，再补该域已知闭环）；**L3**（全量 85 项）= 只在 ① M8 最终验收 ② 出现无法归因的红 ③ 大范围重构（shim 装载链 / 启动序列 / 构建产物）时跑。**状态文件里必须写明本轮跑的是哪一层**，未跑 L3 不得让人误以为已全量验收。**注意**：L1/L2 必须真的选到受影响面——M4-A 的教训（D21）正是「定向测试全绿但横向打红」 |
| **D28** | **套件之外的测试还有 3 个——M8 覆盖面补齐（D15 同类问题）** | 按「改动的源文件 ∩ 带沙箱 require 守卫的测试」做全仓扫描时，顺带用脚本求了差集，发现 **3 个真实的孤儿测试**（不属任何套件、不被任何 runner 或其它测试引用）：`tests/f08f09-action-supply-contract.mjs`（W12 交付，13 项 + 34 条未迁移动作台账）、`tests/image-transform-closed-loop.mjs`（W10 交付，自起 backend 于临时端口 + 读回像素验证旋转方向）、`tests/source-mode-browse-closed-loop.mjs`（P3-b，自起 backend + Vite + Electron）。**三者逐个单独实跑确认当前通过后才登记，断言一字未改**；套件 95 → **98**（static 32 / dev-probe 66）。另有一个 `tests/run-api-smoke-isolated.mjs` 是**手动工具**（固定端口 41801），不是测试，未登记、已在状态文件注明 |
| **D27** | **L2 的选面口径要补一条：改的若是被沙箱加载器读入的文件，必须按「谁加载了它」选测试** | 实例：M6-3 改 `electron/preload.cjs`（模块作用域新增三个 `require` + 读 `__dirname`），我按 D22 选的是 typecheck + 新测试 + plugin 两项 + 两个窗闭环，**漏了两个既有 preload 沙箱测试**——它们的 require 存根写死 `assert.equal(name, 'electron')`，于是 `image-transform-dispatch` 与 `preload-subscriptions` 双双变红（前者在 M8 的 L3 全量里首跑+重跑两连红才暴露）。**规则**：选 L2 面时先跑 `grep -rl "<改动的文件>" tests/*.mjs`——凡是在 vm/沙箱里加载该文件的测试全都要进 L2。已修（`cc215068`）：两个存根改为穷尽白名单 + 「依赖面逐项一致」断言（**加严**：此前多一个依赖是静默通过的），并补 `__dirname`；负向自证实跑（注入 `node:os` → 双红，撤回 → 恢复） |
| **D26** | **恢复 `webviewTag`（用户 2026-09-16 拍板，二选一取推荐项）** | M6-3 修完 preload 路径后暴露：`electron/main.cjs:819` 的 `createWindow()` 是**全仓唯一窗口工厂**（约 20 处调用），其 webPreferences（`:832-838`）**没有 `webviewTag`**，Electron 22 默认 false ⇒ 三处 `<webview>`（`DetailViewer.tsx` / `Inspector.tsx` / `preview-window/shell.tsx`）从不 guest 化，`preload` 属性根本不生效，**格式插件视图在 React 构建里实际是死的**。探针实测（`outputs/probe/probe-result.json`）：关闭时构造函数名是 `HTMLElement`、无 `getWebContentsId`、attach 零事件。**判定「原版有、移植时丢了」的三条证据**：① 原版主进程 `docs/retired-2026-09-16/src/run.jsc` 的 `webPreferences` 常量池里**确实有 `webviewTag` 键**（与 zoomFactor/enableRemoteModule/devTools/webSecurity/nodeIntegration/contextIsolation 同列）；② 原版渲染侧 `src/app/js/plugin/index.js:3324-3326` 的 `broadcast()` 对 `plugin-view webview` **无保护地调 `.send()`**（非 guest 上必抛）；③ React 移植自己的 `PROGRESS.md:4963-4966` 记录了移植期撞 `canGoBack is not a function` 崩树、为此在 `DetailToolbar.tsx:79` 加守卫。**用户裁决：在 `createWindow` 补回 `webviewTag: true`，并加 Electron 实机门禁断言三处 webview 真的 guest 化、preload 真的被加载**（M6-4 / W47）。风险已写明：React 版此前从未 guest 化过，这条链路在 React 构建里**零运行期覆盖**，首次打开可能暴露未验证行为 |
| D25 | **新写的门禁必须在「主工作区」与「全新 worktree」给出同样结论——否则它不可信** | 实例：W41 交付的 `tests/tab-bar-closed-loop.mjs` 的 S5「源码树零加载引用」用**文件系统遍历**，只跳过了 `.git/node_modules/dist/outputs/docs/tests/coverage`，没跳过本机存在的 `.tmp/`、`tests-tmp/` 等**抓痕目录**。后果是**同一个提交在主工作区红、在全新 worktree 绿**（worktree 里没有这些未跟踪目录）——Worker 自测全绿、我合并后立刻红。修法（只修扫描面、不放宽判据）：遍历时**跳过所有点开头目录**，并把 `.gitignore` 里非点开头的顶层目录（`test-run`/`screenshots`/`tests-tmp`/`图片参考定位组件位置`）补进 `SKIP_DIRS`。**规则**：新门禁一律在**有抓痕的主工作区**验收一次，不要只在干净的 worktree 里验 |
| D24 | **用户 2026-09-16 拍板的四项产品/边界决策**（均由 Coordinator 提供选项，用户选推荐项） | ① **插件根统一到仓库内 `plugins/`**——把示例插件与模板迁入仓库，backend 与 electron 都从它读，缺资源时**明确失败而非静默 warn**（现状：backend 从 `tests/fixtures/plugins` 读，是任务书 M7 点名禁止的「从测试目录读取」；`electron/main.cjs:1768` 从仓库外 `H:/dev/plugins/example-service-plugin` 读，本机不存在、失败被 try/catch 吞成一行 warn；模板根指向同样不存在的 `H:/resources/plugin_templates`）。② **`frontend/public/tab-bar.js` + `.css` 退出发布清单**（全仓无加载入口、产物中 0 命中，唯一消费者 `tests/tab-bar-closed-loop.mjs` 未登记任何套件且自己不注入）。③ **`src/run.js` / `run.jsc` / `main.jsc` 按 W5 建议隔离归档**（移出日常操作与发布路径、标明非支持入口、保留可恢复；不删除——`.jsc` 内容不可读、任务书 §4 不反推其内部依赖）。④ **`popup.html` 维持双载**（扩展本体磁盘加载 + HTTP 演示副本注入；M6-1 已把差异写成断言） |
| D23 | **codex worker 的 shell 通道：曾整段不可用，同日复测已恢复——派前先探针，否定性结论仍须自己复核** | **曾（2026-09-16 早）**：所有命令（`rg` 与 PowerShell `Select-String` **都**含）经 WSL 转发，恒报 `execvpe(/bin/bash) failed`，**输出为空却像正常执行**；当时 `wsl -l -v` 只有 `docker-desktop` 且已停止（**无默认 Linux 发行版**，很可能即根因）。后果：M4-D 90 分钟零产出 → 停掉回退 claude 重派为 W36。**复测（同日 07:10）**：派最小探针（`_spec-codex-probe.txt`）实测 `git rev-parse` → `0ccd046f`、`node -e` → `SHIM_FILES 8`、`rg --version` → `ripgrep 15.2.0`、`rg -n "machineryOpenAll" src/app/react/core` → 真实命中 `filterDomain.ts:43/:2234`、`keymap.ts:3/:19/:475`，**shell 与检索均已恢复**。**规则**：① 派依赖检索/跑测试的 codex 任务前先花 30 秒探针；② 判卡住 = worktree 长时间零改动 + 终端反复 execvpe；③ **无论何时，codex 给的「无消费者/搜不到」类否定结论都要自己复核**（M7-1 就是靠这条才安全合入）。已记入记忆 `env-codex-shell-status.md` |

---

## 7. 环境注意事项（会重复踩的坑）

1. **Orca 启动 claude worker 会卡在 Bypass Permissions 确认框**
   - 症状：`worker-start` 返回 `state: outcome_unknown`，`lastError` 说 turn start 无法验证；
     终端标题停在 `pwsh.exe` 而非任务名；`terminal read --screen` 结尾是 shell 提示符。
   - 根因：Claude Code 的 `Zee()` 要求 `userSettings/localSettings/flagSettings/policySettings`
     任一含 `skipDangerousModePermissionPrompt`。`~/.claude.json` 的 `bypassPermissionsModeAccepted`
     是另一条并行判据，单独设置**无效**。
   - 处置：恢复 `~/.claude/settings.json` 顶层 `skipDangerousModePermissionPrompt: true`
     （`settings.json.bak_20260820_013452_pre_runtime` 与 `settings.json.bak` 中都有此值）；
     然后 `worker-stop` 卡住的 dispatch，用 `--retry-of` 重派。
   - **该字段会被静默抹掉、反复复发**（2026-09-15 当日至少三次）。**每次启动 worker 前先复查**；
     用 node 读改写回（**不要用 Python**，会把 CRLF 写坏），保留其余字段。
   - **重派时 worktree selector 必须用 `path:<绝对路径>`**；`name:<名>` 会报 `selector_not_found`。
   - 已记入项目记忆：`env-orca-worker-bypass-prompt.md`

2. **工作区路径含空格与中文**（`Eagle-Sec-development - 副本`）
   - `new URL(...).pathname` 不做百分号解码 → 子进程 `MODULE_NOT_FOUND`（已由 W1 修复，
     用 `fileURLToPath`）。
   - `cmd /c mklink` 在中文路径下编码失败 → 用 Node 的 junction。

3. **Worker 发送 `worker_done` 必须带 `--dispatch-capability`**
   - 缺失时 Orca 记录一条 "Rejected worker_done"，worker 会重发；
     处理邮箱时**只认 payload 中没有 `_orcaLifecycleRejection` 的那一条**。

4. **沙箱工具调用偶发 `[Tool result missing due to internal error]`** —— 重跑即可。

5. **`worker-start` 返回 `outcome_unknown / turn_start_unobserved` 多为投递慢，不是失败**
   - 症状：`worker-show` 长期停在 `start_unknown`，邮箱无该 dispatch 的 heartbeat，
     `terminal read --screen` 只看到欢迎界面的空 `❯` 提示符。
   - **实测投递延迟可超过 60 秒**；再等一会读终端就能看到 Worker 已在读文件/调工具。
   - **处置：先不要 `worker-stop`**。先 `worker-read --limit 20` 看**内容**（出现 Reading/工具调用
     即正常）；只有欢迎界面就**再等 60–120 秒重读**；持续数分钟完全无变化才考虑重派，
     且重派要换新的 worktree 名。**本轮曾两次误杀正在正常启动的 Worker**，教训记入
     `env-orca-start-unknown-not-failure.md`。
   - **不要**用 `orca terminal send` 对启动中的 Worker 试探（`--input` 非有效 flag，应
     用 `--text ... --enter`），那段文本会作为用户输入进入它的会话并干扰任务。

6. **并行 Worker 的测试口径（用户 2026-09-15 指示）**：Worker **只跑自己负责区域的针对性测试**，
   不跑 `tests/run-react-suite.mjs` 全量回归——全量套件含 Electron smoke，多个 Worker 同跑会
   互相杀进程（实测 M2-1 的 `taskkill electron.exe` 直接导致 F06 第三批的 stage smoke 连续 FAIL）。
   **全量回归由 Coordinator 在合并前统一跑。** 各 Worker 的 spec 均已写入此约定。

---

## 8. 下一步计划（恢复时从这里继续）

### 进行中（等结果）
**W44 / W45 / W46 在跑**（2026-09-16 晚，见 §4 台账）。在此之前 W40–W43 四批已全部核验集成，主分支干净。

### 已完成（本轮新增）
- ✅ **W11 F06 前端失败语义与写回收敛**（`25f84998`）：新增 `services/imageTransformWriteback.ts`
  的 `commitImageTransform` 为**唯一**写回实现，两窗各只留调用点。修掉「静默假成功」（await 空桩
  解析出 undefined 后照跑成功尾巴）与「把 TypeError 记成加载模块失败」；宽高交换收敛为仅 write 模式
  （预览窗此前的**无条件**交换是分叉的那一侧）；宽高经既有 `images-change` 通道写入**一次**并以
  `item:operation-result` 回执校验，未确认且缩略图任务未派发时显式报 `IMAGE_META_NOT_PERSISTED`。
  合并时与主分支仅在 `tests/react-suite-manifest.mjs` 有新项同区插入冲突，已保留双方登记项
  （断言严格性未改）。验收 `tests/image-ops-writeback.mjs` 12/12（90 断言）、全量套件 72 项全绿。
  **未解桩**（见 D7）。
- ✅ **W12 F08/F09 动作供给与字符串派发收口**（`9b96d346`）：契约 10→17 项，
  新增 `core/crossWindowActions.ts`（类型化端口，指向既有业务实现，未建第二套持久化）、
  `core/viewOpenActions.ts`、`core/internalDispatch.ts`；13 处 `scope[fn]` 改具名直调。
  验收 `tests/f08f09-action-supply-contract.mjs` 13/13（台账 34 条未迁移动作，删条即失败）。
  **诚实遗留**：`openWithDefault/openWithFinder/copyImage` 唯一实现在 preview-window 子窗，
  主窗要用须新增 IPC 而 electron/** 本轮禁改，故记入缺失清单；
  `renameItem(name)/setRating(stars)` 签名与派单文字的偏差理由已写入代码头部
  （既有实现作用于主窗当前选中集，加 ids 等于引入第二条持久化路径）；
  字体重命名与 0–5 星仅为 node:vm 隔离单测，**未做 Electron 实机验证**。
- ✅ **W10 F06 后端变换端点**（`c3987c6f`）：`POST /api/item/imageTransform` + v2 镜像，
  单请求原子完成「写源文件 → 重生成缩略图 → 更新 metadata 宽高」，结构化错误码，
  JPEG 按方案 C 以 415 拒绝。验收 `tests/image-transform-closed-loop.mjs` 逐像素验证 + 失败不写盘。
- ✅ **W8 F10 启动就绪 Promise**（`27e5053a`）：`core/bootSequence.ts` 单一就绪序列，
  真正 await 供给注册才置 ready；未就绪窗口跨窗调用改抛 `ExternalSupplyNotReadyError`。
  **记录在案的顺序偏离**：实测「先 await 供给再域接管」不可实现——挂载+六域接管处注册主进程
  **一次性** IPC `app-status-library-loaded`，任一侧推迟即永久丢事件（三组 A/B 实测）。
  Coordinator 已批准。

### 本轮已集成（6 个 Worker，均已核验后才合并）
> ✅ **合并后全量回归已通过**：`REACT SUITE ALL GREEN（77 项：OK 76 + retry-OK 1）`（证据见 §3）。
> 此前的 `FAILED 4` 已由 W18 修复（`82d5b1f8`）：根因是 **M2-1 把 `genericStub` 从"静默返回替身"
> 改为"调用期抛错"（方向正确），但没把真实存在却未登记的模块补进登记表**——`compare-versions`
> （实际在 `src/node_modules/compare-versions`）落入抛错分支，`PluginCenter.calculateNeedUpdate`
> 的 `w().require('compare-versions')` 无 try/catch，直接打断主窗就绪；另一条独立成因是
> `JsonRestServerStub.start` 的 rejected Promise 逃逸（见 D13）。
> 另 3 项 react-smoke（7a/7c/8e2）**单独跑本来就通过**，其全量失败属套件内主窗启动抖动，
> 与上述不是同一根因（W18 已逐项单独复现举证）。
1. **F06 第三批**（W14 / `fd378cf5`）：`moduleRegistry.ts` 仅改 106-107 两行解桩
   （`() => {}` → `loadJsModule(req)`）；新增 `services/imageTransformRoute.ts` 作**格式分流唯一判定点**；
   `electron/{main,preload}.cjs` 新增具名通道 `item:image-transform`（信封而非 reject，保住后端错误码）；
   宽高仍走 W11 既有通道 + 回执校验，未新增第二条写入路径。
   **实测改正调研推断**：渲染层 Canvas 路径**不可用**（`url.pathToFileURL` 拿到 mock、`CanvasToBMP`/`APNG`
   未安装），故 PNG 等改由后端权威处理；**主窗快捷键不可达**（入口实为 DetailToolbar 工具栏按钮）。
2. **M2-1**（W13 / `90cc3501`）：`core/runtimeServices.ts`（739 行，无 `@ts-nocheck`/`any`）+ 八服务单点装配 +
   三态运行模式（electron / browser-connected / demo）+ 未知能力改为明确失败 + 契约测试 20/20。
   **发现**：`genericStub` 必须在 require **调用期**抛错（"取值即抛"会让 `installBundleGlobals()` 整体中断、
   主窗不渲染）；`archiver`/`fast-glob` 在 node_modules 中真实存在却被 `moduleRegistry.ts` 的 bareModules
   映射为 no-op（**记入残留项**，所有权外）。
3. **F04**（W15 / `257ebd1c`）：**重大发现——内联 boot 本来就是死代码**（`appRoot is not defined` 在解析期整体中止，
   `EagleConfig` 之后的全局从未安装成功），迁移的实质是"把从未生效的供给改成真正生效"。
   新增 `preview-window/boot.ts` + `entry.tsx` 的顺序不变量（import 在 controller 之前 +
   `assertPreviewBootInstalled()` 在 createRoot 之前）；`global.js` 只删 marker 块。
   **未做实机验证**（共享 Vite 预打包 URL 在本机负载下全部 5s 超时挂起）。
4. **M5-1**（W16 / `69b489d6`）：`frontend/runtime-config.mjs` 统一运行期地址（dev 中间件与
   `serve-frontend.mjs` 共用、产物内不含端口常量）；workbench/roadmap/media-viewer 四页迁入模块图且
   **URL 一个未变**；媒体改走后端受控取址；新增 `tests/frontend-public-policy.mjs` 9/9。
   **顺带修掉生产缺陷**：`serve-frontend` 的 `/file` 代理先 decode 再重建 URL 导致 `%2F`→`/`、
   缩略图服务路由不匹配返回 404——改为原样透传后 200。
5. **F06 flaky 修复**（W17 / `1fc34443`）：见 D10。

### 下一步：M8 最终验收（前置于本轮已全部收齐）

**M0–M7 全部完成并集成。W44/W45/W46/W47/W48 均已核验集成，当前无 Worker 在跑。**

M8 的两件事（依据任务书 §M8 与 D22）：

1. **跑 L3 全量**：`node tests/run-react-suite.mjs`（**95 项**）+ `ARTIFACT_TESTS` 5 项
   +`EXTRA_REGRESSION` 7 项；外加统一入口 `npm run test:acceptance`。
   注意 D12：跑 `dist-entry-check` 前必须先 `npm run build`（主工作区 dist 可能过期）。
2. **补一条任务书点名、至今未做的验收**：**「最小隔离部署副本能完整启动，不读取源工作区、
   tests 或未登记的 `src/node_modules`」**。做法建议：把 `dist/frontend` 拷到临时目录，
   只带后端/Electron 所需的最小集启动，并用文件访问探针证明没有回读源工作区。
   这是 M7 唯一未闭合的验收项，M7-3 的登记驱动机制正好为它提供了前提。

**已知需要带入 M8 的诚实遗留**（不得当成通过）：
- M6-4 的三处 React 插件组件（DetailViewer / Inspector / preview shell）**实机端到端未跑**——
  本机没有可用的、已安装的格式查看器插件条目；
- M7-3 的 RAW / TIFF / UDOC 运行期样本未跑；
- 执行中的观察：`main-ui-workflow-closed-loop` 在 M7-3 合并后有一次**未捕获异常**（`tail`
  截断未留全文），随后 3 次连跑均 exit 0 且 OK。全量 L3 时必须盯这一项，若复现要当场留证并归因；
- D14 的待证项（Electron 下 `nativeRequire('http')` 是否可用）仍未取证；
- 之前几处登记在案的偏差（D20 的 3 处 `(window as any)`、`demoSeed.ts` 的 `capturePollTimer`
  从未赋值）已在状态文件与代码注释中登记，M8 报告里要如实带上。

### 尚未清理的中间产物
- worktree `m2-runtime-services`（`shawpook/m2-runtime-services`，HEAD `e8b3d2b1`）已交付完毕，可回收。
- 未跟踪临时文件：主工作区 `tests/` 下若残留 `tmp-bare-diff.mjs` 等，**一律不得提交**。

---

## 9. 阻塞项

| 阻塞 | 影响 | 处置 |
|---|---|---|
| ~~`continuous-grid-scroll` 被 M4-A 打红~~ | — | ✅ **已修并集成（`1c4214b9`，W31）**。根因：**Electron 渲染进程里 `location.hash = next` 会在该赋值语句内同步派发 `popstate`**，而 `usSelfWritten.add` 写在赋值**之后** → 自写回显被当成外部导航 → 消费端二次派发 `openFolder`（ignoreReload 为假）→ `restoreScrollPosition()+reload()` 把进入前的 4500 带进新视图。改法：登记先于赋值（三处）+ `onChange` 分发加来源标记、消费端只对**外部导航**派发。**核验（L1/L2，未跑 L3）**：`continuous-grid-scroll` EXIT=0、`m4-url-history` 26/26、typecheck 0 诊断、`continuous-grid-layout` PASS，另跑 9 项受影响面既有测试（boot-ready-sequence / f08f09 / stage1c2 / runtime-services-contract / shim-module-boundaries / d3-viewmode / d3-boot-render / menu-popup / residue）全 OK |
| ~~M2-1 引入的回归~~ | — | ✅ 已由 W18 修复并集成（`82d5b1f8`） |
| **沙箱加载器的依赖面漂移**（D27） | 改被沙箱读入的文件的依赖面时，旧存根会整片挂掉 | 选 L2 面先 `grep -rl "<改动文件>" tests/*.mjs`。已在 `cc215068` 把两个 preload 存根改成显式白名单 + 逐项断言 |
| **`dist-entry-check` 依赖本地构建产物** | 未重建时会出现「4 页没有 module 入口脚本」的**假失败** | 按 D12：跑该门禁前先 `npm run build`。**后续 Worker 的 spec 必须写明这一条**，否则会误报回归 |
| ~~W10/W11/W8 未合并前不能派 F06 第三批与 F08~~ | — | ✅ 均已合并 |
| ~~F06 中间态（解桩前写文件明确拒绝）~~ | — | ✅ 已由 F06 第三批解桩闭合 |
| **多个 Worker 并行跑 Vite/Electron 类测试会互相破坏共享依赖缓存** | 成片假失败、`SUITE_EXIT=127` | 已定为口径（D9）：Worker 只跑自家定向测试，全量由 Coordinator 串行跑。**后续派单沿用此约定** |
| **`~/.claude/settings.json` 的 `skipDangerousModePermissionPrompt` 会被静默抹掉** | Worker 卡在 Bypass 确认框 | 每次派遣前复查（§7.1）。当日已复发 4 次 |
| **Worker 的 dispatch prompt 常停在输入框未提交** | 表现为"停在空提示符"，实际在等 Enter | 读终端查 `draft:` 字段，`orca terminal send --terminal <handle> --enter` 提交（§7.5） |
| **邮箱取件口径易错**（本轮新记） | 误以为"worker 没回话" | `--ack` 收的是 **`result.deliveryId`**（不是 `msg_*`，传错得 `stale_delivery`）；`check --wait` 遇到未 ack 批次会**立刻返回**而非等待；`check --ack <id>` 的返回值是**下一批**。已记入记忆 `env-orca-mailbox-mechanics.md` |
| **`main-ui-workflow-closed-loop` 出现一次未捕获异常**（2026-09-16 晚，M7-3 合并后首次运行） | 若复现则可能是真回归 | 当时 `tail` 截断未留全文；随后**连跑 3 次均 exit 0 且 OK**。**M8 的 L3 必须盯住这一项**：若在 95 项全量里复现，当场留全文并归因 |
| ~~实机验证受限（共享 Vite 预打包 URL 超时挂起）~~ | — | ✅ **已不再成立**：2026-09-16 晚的各批实机 Electron 检验均正常通过（`react-stage9a2-smoke`、`production-smoke`、`preview-delivery`、`document-viewer-ui`、`main-ui-workflow`、`continuous-grid-scroll`、M6-4 的新真机门禁等）。**仍属未验证的具体项**是：M6-4 的三处 React 插件组件端到端（本机无已安装的格式查看器插件条目）、M7-3 的 RAW/TIFF/UDOC 样本 |
| ~~`H:/resources/plugin_templates` 与 `H:/dev/plugins/example-service-plugin` 在工作区外~~ | — | ✅ **已由 M6-2 处置（依据 D24①，用户已拍板）**：插件根统一到仓库内 `plugins/`（`EAGLE_PLUGINS_ROOT` 可覆盖），示例插件 `git mv` 至 `plugins/example-service-plugin/`、模板至 `plugins/_templates/`；缺资源时给出结构化错误码而非静默 warn。**对外 URL 一个未变** |
