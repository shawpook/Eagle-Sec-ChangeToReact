# Eagle 旧框架改造 · 独立验收报告（2026-09-17）

> 验收对象：`outputs/Eagle_全工作区旧框架残留审计与改造计划_2026-09-15.md`（任务书）所定义的 M0–M8 全部改造
> 过程记录：`docs/project-state.md`（Orca 编排台账）
> 自我验收：`docs/m8-acceptance-report-2026-09-16.md`（**本报告是对它的独立复核，不是它的续写**）
> 工作区：`H:/dev/Eagle-Sec-development - 副本`，分支 `react-in-place`
> 验收基线：任务书基线 `d82ab6d7`；自我验收冻结点 `f82a05f2`；**本次实际验收 HEAD = `c367b2aa`**

---

## 0. 结论摘要

**整体判定：改造目标基本达成，可以收官，但"收官"不等于"收口"。**

我在 HEAD 上独立复跑了可复跑的部分，结论与自我验收报告一致的占绝大多数：

| 维度 | 判定 | 依据 |
|---|---|---|
| 类型门禁 | ✅ 维持 | typecheck 235 根文件、0 诊断、整文件免检 0、待撤销 0 |
| 静态哨兵 | ✅ 维持 | sentinel / shim 边界 / scope 收敛 / 发布清单 全过 |
| 产物门禁 | ✅ 维持 | `dist-entry-check` FAIL 0 / 304 文件；`publish-asset-manifest` 8/8 |
| 定向回归 | ✅ 维持 | 13 个定向测试共 208 条断言全过 |
| 后端链路 | ✅ 维持 | `backend-import-integrity` 48 文件 2834 调用点 0 悬空；两个后端闭环单独跑通过 |
| 遗留清理 | ✅ 达成 | tab-bar、url-state-service 已退出发布；产物中无 `.jsc`；Angular 可执行分支在 React 子树内已清零 |
| **验收完备性** | ⚠️ **存在缺口** | 自我验收后 31 分钟内就发现并修了一个**用户可见的启动缺陷**（窗口落到屏幕外），说明验收矩阵对 `electron/**` 是盲的 |
| **静默假成功** | ⚠️ **未清零** | `access`/`is-hidden-file`/`appdata-path`/`file-icon` 等替身在生产态仍返回"看起来正常"的值 |
| **验证证据** | ⚠️ **部分为静态推断** | M6-4 插件端到端、RAW/TIFF/UDOC 样本、部署根运行期探针仍是空白；隔离部署测试本次未能复跑（见 §2.3） |

一句话：**代码层面的迁移是扎实的（类型债从 460 条清零、8 个免检文件全部撤销、门禁从"会放水"改成"会失败"），但验收矩阵本身仍有一块没被照亮的区域——正是这块区域在验收结束当晚就吐出了一个真缺陷。**

---

## 1. 验收方法与诚实边界

### 1.1 我实际做了什么

1. **核对基线**：`git diff f82a05f2..HEAD` — 只有 3 个文件变了（验收报告、`project-state.md`、`electron/main.cjs`）。
2. **复跑静态门禁**：typecheck / shim 边界 / rewrite 哨兵 / scope 收敛 / 门禁单测 / 发布清单 / 产物入口。
3. **复跑定向回归**：13 个非 Electron 依赖的定向测试。
4. **重跑后端闭环**：`image-transform-closed-loop`、`item-thumbnail-endpoint`。
5. **重建产物并验收**：在 HEAD 重新 `npm run build` 后跑 `dist-entry-check`。
6. **独立扫描**：全仓旧框架引用、孤儿测试、静默替身、入库的临时脚本。
7. **审查验收后提交**：`c367b2aa` 的完整 diff 与其"无门禁覆盖"的事实。

### 1.2 我没做什么（不得被读成"通过"）

- **没有跑 102 项全量回归套件**（Electron 实机、耗时数十分钟）。本报告给出的是 L1+L2 分层验证（口径见 `project-state.md` D22），**不是 L3 全量**。
- **Electron 实机只补跑了 2 项**（`--smoke` 与 `stage9a2`），`continuous-grid-scroll` 因单次 >18 分钟中止（§2.4）。
- **没有实机跑**：M6-4 三处插件 webview 端到端、RAW/TIFF/HEIF/UDOC 样本、截图回归。
- **没有验证**：非默认端口之外的多显示器场景、`window-state.json` 在多显示器拔插下的真实行为。

### 1.3 一个环境干扰项（避免误读）

本机 WorkBuddy 沙箱对 `fs.rmSync` 做了批量删除拦截（阈值 50），会把**构建收尾的清理步骤**和**测试的临时目录清理**变成抛错/超时。
**我观察到的几次"构建失败"和"两个闭环测试失败"全部是这个沙箱护栏造成的，不是项目缺陷**：

- `npm run build` 退出码 1 → 真实原因是 vite `emptyDir`/`rmSync(mock-library)` 被拦截；构建主体（3129 模块、17 条登记资产、4/4 页面重定位）**全部成功**。
- `image-transform-closed-loop`、`item-thumbnail-endpoint` 退出码 1 → 四个会起后端的测试串行跑时互相争端口；**单独跑均为 OK**。

> 建议：**任何在本机看到构建 exit=1 的情况，先确认工作目录不在沙箱 shell 内**（或在 CI/普通终端复现）。

**第二个、也是更容易误判的干扰项：Electron / CDP 类测试在沙箱内必然失败。**

凡是通过 `tests/react-cdp-harness.mjs` 拉起 dev 栈的测试（后端 + Vite + Electron 三件套），在沙箱内一律以
`Error: backend startup timeout` 失败。我做了对照验证：

| 运行方式 | `react-stage9a2-smoke.mjs` | 结论 |
|---|---|---|
| 沙箱内（含 `dangerouslyDisableSandbox` 未生效的那次） | `backend startup timeout` 失败 | — |
| **普通终端（沙箱外）** | **`STAGE9A2 SMOKE OK`**（webview 宿主 / notify / gif iframe / 无未捕获异常 全 PASS） | ✅ |
| 我把 harness 的 spawn 逻辑单独抽出来在沙箱外复现 | 后端 3 秒内正常打印监听地址 | ✅ |

**这说明失败发生在后端子进程被拉起这一步、且发生在 Electron 启动之前**，因此它与 `c367b2aa` 的窗口几何改动**没有任何因果关系**。
排查时不要把它当成回归。

---

## 2. 复核结果明细（本次实跑）

### 2.1 静态与产物门禁

| 门禁 | 结果 | 说明 |
|---|---|---|
| `tests/typecheck.mjs` | **TYPECHECK_OK** | 235 根文件均属 React 子树，0 诊断；整文件 `@ts-nocheck` **0**、待撤销 **0**；另有 42 个自有图外 JS、18 个第三方、4 个外围 HTML **仅登记不受语义检查** |
| `tests/shim-module-boundaries.mjs` | SHIM_BOUNDARY_OK | 8 个 shim 模块跨模块标识符完整 |
| `tests/react-rewrite-sentinel.mjs` | SENTINEL_OK | Angular/jQuery 等 12 项指标全部 0 |
| `tests/scope-field-convergence.mjs` | SCOPE_CONVERGENCE_OK | 已收敛 199 字段 / 10 域，挂载槽 57，无未分类字符串键写入 |
| `tests/frontend-gates-unit.mjs` | **59/59** | 含 F23 加固的 19 条负向用例 |
| `tests/publish-asset-manifest.mjs` | **8/8** | 登记驱动发布资产 |
| `tests/dist-entry-check.mjs` | **FAIL 0 / 304 文件** | 与自我验收一致 |
| `tests/backend-import-integrity.mjs` | **0 悬空 / 48 文件 / 2834 调用点** | 该类缺陷此前零覆盖 |

### 2.2 定向回归（13 项 / 208 断言，全部通过）

| 测试 | 结果 |
|---|---|
| `runtime-services-contract` | 20/20 |
| `module-registry-contract` | 6/6 |
| `match-rules-equivalence` | 22/22 |
| `image-ops-writeback` | 13/13 |
| `f08f09-action-supply-contract` | 13/13 |
| `preload-subscriptions` | 43/43 |
| `m4-window-subscriptions` | 23/23 |
| `m4-url-history` | 26/26 |
| `m4-preview-dispose` | 9/9 |
| `tab-bar-closed-loop` | 11/11 |
| `frontend-public-policy` | 9/9 |
| `worker-protocol-contract` | 13/13 |
| `scope-field-convergence` | OK |

### 2.3 后端与产物闭环（单独跑）

- `image-transform-closed-loop` → **OK**，且在**中文路径**临时库（`图像变换闭环.library`）下通过 → 佐证 D40 的 `fs.cpSync` 绕行确实生效。
- `item-thumbnail-endpoint` → **OK**（`/api/item/thumbnail` 不再恒 404）。
- `isolated-deployment` → **未能取得结论**：在本机跑满 22 分钟仍未结束（该测试会创建并清理一份最小部署副本，清理步骤被 §1.3 的删除护栏拖住）。**该项以自我验收报告的证据为准，本次既不能证实也不能证伪。**

### 2.4 补跑：验收后 `c367b2aa` 的改动面（Electron 实机）

自我验收是在 `f82a05f2` 上做的，而 HEAD 多了一个改动 `createWindow` 的 `c367b2aa`。
**这个改动此前从未在 Electron 实机测试上跑过**，因此我专门补跑了会走到该路径的测试：

| 测试 | 是否经过 `createWindow` | 结果 |
|---|---|---|
| `electron electron/main.cjs --smoke` | 是（主窗） | ✅ 通过，加载 service plugin 后正常退出 |
| `react-stage9a2-smoke.mjs` | 是（`openOriginalPreview` → 预览窗） | ✅ `STAGE9A2 SMOKE OK`，webview 宿主 / notify 自动消失 / gif iframe / 无未捕获异常全 PASS |
| `continuous-grid-scroll.mjs` | 是（主窗 + 600 图网格） | ⏱ **未取得结论**：需先生成 600 张 fixture 再起 Electron，单次超过 18 分钟，本次中止。**建议在夜间/专用机器上复跑**（记得在普通终端，见 §1.3） |

**目前可确认**：`c367b2aa` 没有破坏主窗启动与预览窗创建这两条最敏感的路径。
但它**仍然没有门禁**——上述测试通过只是"没把它跑坏"，不等于"窗口几何错误会被发现"（见 §3.1 与 R0）。

### 2.5 遗留清理核实

| 任务书点名 | 现状 | 判定 |
|---|---|---|
| `frontend/public/tab-bar.js`（真实 Angular 调用、无加载入口） | 已移出 public，归档至 `docs/retired-2026-09-16/` | ✅ |
| `src/app/js/services/url-state-service.js`（旧 Angular factory） | 文件已不存在 | ✅ |
| `src/run.js` / `run.jsc` / `main.jsc`（旧宿主） | 已归档，产物中无 `.jsc` | ✅ |
| `src/my_modules` 48 项零消费者条目 | 已归档（210 个归档文件）；`src/package.json` 清旧宿主字段、留版本元数据 | ✅ |
| React 子树内的 Angular 可执行分支 | 全仓扫描后**仅剩注释与字符串**（如 `console.time('$scope.xxx')`、`原版 $scope.…` 说明），无可执行调用 | ✅ |
| `src/app/js/plugin/index.js`（3 处真实 `angular.element`) | 仍在源码树并随 `src/app` 整树交付，但已被 `INTERCEPT_TABLE` 的 `/app/js/plugin` 截获（含 `/index.js` 后缀归一化，封堵绕过） | ⚠️ 见 §3.3 |

---

## 3. 发现的问题

按"会不会再次咬人"排序。

### 3.1 【P0】验收矩阵对 `electron/**` 是盲区 —— 已被现实证明

**事实**：自我验收四段全绿在 `22:37` 归档；`23:08` 就提交了 `c367b2aa fix(electron): 修「启动后窗口不见」——陈旧窗口几何落到屏幕外`。

该缺陷的症状是**进程活着、日志正常、屏幕上就是没有窗口**，用户无法自救，且：

- 触发条件极其常见（拔副屏 / 改分辨率 / 辅助窗被拖到屏幕下缘）；
- 真因是 `userData/window-state.json` 里的陈旧 `{x:302,y:1262}` 被 `createWindow` 原样沿用；
- 顺带暴露第二个缺陷：**所有辅助窗共用同一份 `window-state.json` 并写回**，任一辅助窗都能污染主窗下次启动位置。

修复本身质量很好（可见性对账 + 只让主窗持久化，还顺手修了 `options.x || saved.x` 把 `0` 当假值的老问题）。**问题不在修复，在于：这么严重的缺陷是被"人肉发现"的，不是被任何门禁发现的。**

**为什么门禁没抓到**：
- `tsconfig` 只 include `src/app/react`，`electron/main.cjs` 完全不在类型视野内；
- `react-rewrite-sentinel` 只扫 React TS/TSX；
- 102 项套件的 Electron 用例是"进程能起来、能跑通业务流程"，**不校验窗口真的在可视区内**；
- 全工作区静态扫描（`scope-field-convergence` 等）不覆盖 `.cjs`。

**这是本次验收最重要的发现**：一个"全绿"的验收，和"用户打开软件能看到窗口"之间，还隔着一层。

补充：我在 §2.4 补跑了会经过 `createWindow` 的实机测试，确认该修复**没有把主窗/预览窗跑坏**。
但"没跑坏"和"会被发现"是两件事——把坏几何喂给当前代码，现有门禁**依然不会变红**。

### 3.2 【P0】能力替身仍在生产态"静默假成功"

任务书 M2 的要求是"未知能力改为明确失败"。现状是**已知**替身仍在返回"看起来正常"的值：

| 截获项 | 返回值 | 风险 |
|---|---|---|
| `/my_modules/access` | `checkALCs/checkAccess/checkACL` **恒 true** | 真实消费者 `libraryDomain.ts:1117` 用它判断库路径权限；恒真等于该检查**在生产中不存在** |
| `/my_modules/is-hidden-file` | `check` 恒 false | 隐藏文件判定失效 |
| `/my_modules/appdata-path` | 恒 `'/mock-user-data'` | **演示值泄漏进生产路径** |
| `/my_modules/file-icon` | `{}` / `null` | 图标静默为空 |
| `/app/js/utils/remainingFilenameLength.js` | 恒 240 | 与真实磁盘/文件系统约束脱钩 |
| `/app/js/utils/is-accelerator.js` | 恒 true | 快捷键冲突检测失效 |
| `/app/js/utils/getBestURL.js` | 恒 `''` | 靠调用侧回退兜底 |

它们都在 `INTERCEPT_TABLE` 里有明确的 `reason`，**不是偷偷写的**，这是值得肯定的。但"登记了"不等于"安全"——`access` 恒真这一条尤其应当优先处理，它是**安全检查**。

### 3.3 【P1】`src/app` 整树交付：插件内核仍在发布物里

`publish-asset-manifest.mjs` 有一条 `{ from: 'src/app', to: 'src/app', kind: 'app-runtime-tree' }`，只排除了 `src/app/react`。因此 `src/app/js/plugin/index.js`（3 处真实 `angular.element(...).injector()`）仍随产物发布，产物 `src/` 目录共 38 MB。

目前靠 `INTERCEPT_TABLE` 保证它不会被执行，且截获模式做了 `/index.js`、`/index` 后缀归一化以封堵绕过。**这是"截获正确"而非"消失"**——一旦有人新增一条 `require` 路径不在归一化规则内，或改用 `fetch + eval` 加载，这段 Angular 代码就会在运行时抛错。

### 3.4 【P1】改造过程引入了 5 起回归（全部已修，但值得记账）

| # | 引入者 | 症状 | 修复 |
|---|---|---|---|
| 1 | M2-1 | `genericStub` 改调用期抛错，但未登记 `compare-versions` 等真实裸模块 → 主窗就绪被打断、套件 FAILED 4 | `82d5b1f8` |
| 2 | M4-A | `location.hash` 在 Electron 渲染进程同步派发 `popstate`，自写回显被误判为外部导航 → `continuous-grid-scroll` 把旧视图滚动位置带进新视图 | `1c4214b9` |
| 3 | M6-3 | 改 `preload.cjs` 依赖面，打断 3 个沙箱加载器（`preload-subscriptions`、`image-transform-dispatch`、`m4-preview-dispose`） | `cc215068`、`66a1e73b` |
| 4 | F04 | 给 `preview-window/entry.tsx` 加 import，打断 `preview-entry-subscriptions`（该测试当时**不在任何套件里**，所以此前从没被发现） | `0d31dbc3` |
| 5 | — | 窗口几何落到屏幕外（§3.1） | `c367b2aa`（**验收后**） |

**模式很清晰**：4/5 起是"改共享面（shim/preload/启动序列）却没按'谁加载了它'选回归面"，第 4 起是"测试没进套件"。`project-state.md` 的 D21/D27/D15 已经把这些教训写成了规则——**规则有了，但它们是靠事后复盘得来的，不是门禁强制的**。

### 3.5 【P1】构建链的脆弱点

1. **错误掩盖**：`closeBundle` 抛错时，vite 会把 rollup 写入阶段的真实错误**替换掉**（本次实测：先打印 `x Build failed`，再打印 closeBundle 的错误，原始错误完全消失）。排查成本极高。
2. **重定位非幂等**：4 个外围页依赖 `closeBundle` 的 `renameSync` 从源码壳路径搬到旧 URL；一旦上一步失败，产物里就会同时存在"旧 URL 指向上一次构建的页面"这种半新半旧状态。
3. **收尾依赖批量删除**：`fs.rmSync(mock-library, {recursive:true})` 是构建必经路径，在带删除护栏/回收站超时的环境里会把整次构建判死（本次实测）。

### 3.6 【P1】安全配置提示（非本轮引入，但本轮扩大了暴露面）

`createWindow` 的 `webPreferences` 为：`nodeIntegration: true` + `contextIsolation: false` + `sandbox: false` + **`webviewTag: true`（M6-4 新恢复）**。

M6-4 是正确的决定（否则格式插件视图在 React 构建里就是死的），但它让 `<webview>` guest 首次真正生效，而这条链路**在 React 构建下零运行期覆盖**。三者叠加意味着：**guest 内容的隔离强度完全取决于 preload 与被加载内容本身**。

建议：把 guest 侧能力面收敛成显式的 IPC 白名单，并给三处 `<webview>` 补"加载非预期内容"的实机用例。

### 3.7 【P2】验证证据仍是空白的四块

直接沿用自我验收 §5，我在本次复核中**没有找到任何新的证据来关闭它们**：

1. M6-4 三处 React 插件组件（`DetailViewer`/`Inspector`/`preview shell`）端到端未跑；
2. 归档 48 项 `my_modules` 后的 RAW/TIFF/UDOC 运行期样本未跑；
3. 部署根四处耦合点只有静态布局断言，**运行期探针覆盖为零**；
4. D14 待证项：Electron 下 `nativeRequire('http')` 是否可用（当前 `http`/`https`/`JsonRestServer` 保持显式失败是有意为之）。

### 3.8 【P2】仓库卫生

- **`tests/probe-*.mjs` 共 18 个已入库**：一次性诊断脚本，不属任何套件、不被任何 runner 引用，也不会再跑。它们会持续污染"测试目录里有什么"的判断（本次孤儿扫描必须先手动排除它们）。
- **`frontend/vite.preview.config.mjs.timestamp-*.mjs` 2 个残留**：vite 加载配置产生的临时文件，异常退出时会留在工作区。
- **`frontend/public/mock-library/**` 出现 3 项未跟踪文件**（`mode.json`、`virtual-cache.json`、`backup/`）：运行应用会污染被跟踪的演示库，且它们不在 `.gitignore` 里。

### 3.9 【P2】类型债的真实边界

typecheck 报 0 诊断，但要清楚它的边界：

- 受检范围 = tsconfig 的 **React 子树 235 文件**；Electron 主进程、`.cjs`、Node 脚本、42 个自有图外 JS、18 个第三方、4 个外围 HTML **都不在语义检查内**；
- React 子树内仍有约 **7174 处 `any` 类用法**（历史移植产物，非本轮新增）；
- D20 登记的 3 处 `(window as any)` 与 `demoSeed.ts` 里"声明了却从未被赋值"的 `capturePollTimer` 仍未处理。

**不要把这个 0 读成"全工作区类型通过"**——自我验收报告的措辞是准确的，这里只是再强调一次。

---

## 4. 任务书 M0–M8 逐条对照

| 批次 | 目标 | 判定 | 备注 |
|---|---|---|---|
| M0 | 范围台账 + 可失败门禁 | ✅ | F23 加固后 19 条负向用例；仍有 §3.1 的电子侧盲区 |
| M1 | 修写回/动作/启动/退订 | ✅ | P0 旋转翻转已解桩 + 格式分流 + 显式错误码；13 项动作台账在案 |
| M2 | 替代万能 shim | ✅ | 免检 8→0，460 条类型债清零；但 §3.2 的替身未清零 |
| M3 | 经典脚本进模块图 | ✅ | 规则族具名模块化 + 等价性 22/22 + Worker 协议类型化 |
| M4 | 窗口与 scope 收口 | ✅ | 四批 + 收尾；M4-A 引入回归已修；晚注册缺陷经探针坐实后修复 |
| M5 | 外围工具 UI 与生产配置 | ✅ | 4 页 URL 未变、运行期地址单一来源、非默认端口实机通过 |
| M6 | 扩展与插件交付闭环 | ✅ | MV3 真实产物 + 插件根入仓 + webviewTag 恢复；端到端仍空白 |
| M7 | 最小产物与遗留隔离 | ✅ | 登记驱动 + 复制失败即失败 + 48 项归档 + 隔离部署探针 |
| M8 | 全工作区验收与收官 | ⚠️ | 报告完整，但**基线在收官后即被新提交超越** |

---

## 5. 后续调整路线

### R0 · 立刻做（1–2 天）：把"验收后才发现"变成"门禁先发现"

| # | 动作 | 验收标准 |
|---|---|---|
| R0-1 | 给 `boundsVisibleEnough` / `clampWindowState` 补纯函数单测并**登记进套件**，含负向用例（窗口完全在屏外、只交叠 79px、多显示器、只有副屏） | 移除可见性校验 → 门禁红 |
| R0-2 | 把 `electron/**` 纳入静态门禁视野：至少加一条"主进程禁止无保护地读取并使用落盘窗口几何"的检查，与一条"`.cjs` 主进程文件的依赖面快照"检查 | 人为注入坏几何 → 红 |
| R0-3 | 规定**验收基线必须是 HEAD**，且验收报告里写明"报告生成后新增提交需重新验收" | 报告含 `git rev-parse HEAD` 与生成时间 |
| R0-4 | 给"窗口真的在可视区内"补一条 Electron 实机断言（`win.getBounds()` 与 `screen.getAllDisplays()` 交叠 ≥ 阈值） | 注入屏外几何 → 红 |

### R1 · 一周内：静默假成功清零

| # | 动作 | 验收标准 |
|---|---|---|
| R1-1 | **优先处理 `access` 恒 true**：在 Electron 态改接真实权限检查；不可得则让调用点**显式报错**而不是放行 | 生产态调用 `checkALCs` 要么真结果要么抛错，绝不静默 true |
| R1-2 | 复核 `is-hidden-file` / `appdata-path` / `file-icon` / `remainingFilenameLength` / `is-accelerator` / `getBestURL` 六项：有真实能力的接真实能力，没有的改为显式失败；`appdata-path` 的 `'/mock-user-data'` **必须从 Electron 生产态消失** | 全仓搜索不到 `/mock-user-data` 的生产可达路径 |
| R1-3 | 落地 D14 取证：实测 Electron 下 `nativeRequire('http')` 可用性，据此决定 `http`/`https`/`JsonRestServer` 是"显式失败"还是"可接线" | 结论写回 `project-state.md`，不再标记为待证 |
| R1-4 | 对 680 处 `catch (err) { /* 注释 */ }` 做分类（顶层兜底 / 真实吞错），把"吞错且影响业务结果"的挑出来加观测 | 形成清单，逐条要么上报要么注明理由 |

### R2 · 两周内：把静态推断换成运行证据

| # | 动作 | 验收标准 |
|---|---|---|
| R2-1 | **造一个真实可用的格式查看插件条目**，把 M6-4 三处 `<webview>` 的端到端跑通（含 guest 内 preload 真实执行、加载失败、退出清理） | 三处各有实机断言，移除 `webviewTag` 即红 |
| R2-2 | 准备 RAW / TIFF / HEIF / UDOC 真实样本，跑通解码矩阵 | 各格式有通过的行为证据 |
| R2-3 | 部署根四处耦合点补**运行期探针**（当前只有静态布局断言），覆盖 `/api/library/icon` 与缩略图解析根 | 探针报告覆盖这四条路径 |
| R2-4 | 处理 `screenshot-regression` 3/16 既有红、`main-ui-workflow` 的 IPC 超时抖动、`thumbnail-task` 的端口黑名单 flaky | 三项要么归零要么写明不可复现条件 |
| R2-5 | 跑一次真正的 L3 全量（102 + 6 + 7）并把结果归档。**必须在普通终端跑**（沙箱内 CDP 类测试必失败，见 §1.3） | 有完整日志与结果 JSON |

### R3 · 一个月内：架构债与类型边界

| # | 动作 |
|---|---|
| R3-1 | 拆 `tsconfig`：为 Electron 主进程、Node 脚本、扩展、Worker 各建独立配置并分批纳入门禁（不要一次性全开） |
| R3-2 | D20 的 3 处 `(window as any)` 与同仓既有 85 处，通过在 `global/globals.d.ts` 加 `declare global` 一并消除 |
| R3-3 | 清 `demoSeed.ts` 的 `capturePollTimer` 死变量；复核其他"声明了却从未赋值/消费"的残留 |
| R3-4 | `scopeFace` 按 readonly 快照 / 类型化命令 / 引擎实例三分；`domLite` 收口到引擎 adapter |
| R3-5 | 7174 处 `any` 分层收敛：先做"新增即失败"的增量门禁，再按域消化存量 |

### R4 · 持续：卫生与防退化

| # | 动作 |
|---|---|
| R4-1 | 删除或移出 `tests/probe-*.mjs` 18 个已入库的一次性诊断脚本（建议移到 `outputs/probe/` 或加gitignore） |
| R4-2 | `.gitignore` 补 `frontend/vite.preview.config.mjs.timestamp-*.mjs`；把 mock-library 的运行产物（`mode.json`/`virtual-cache.json`/`backup/`）纳入忽略或移出源码树 |
| R4-3 | 构建链三件事：① `closeBundle` 不再掩盖 rollup 真实错误（先记录再抛）；② 4 页重定位改为幂等（先校验后搬，失败即失败）；③ 收尾的批量删除换成不易被环境拦截的实现 |
| R4-4 | 安全：为 `<webview>` guest 侧定义显式 IPC 白名单，评估 `nodeIntegration + contextIsolation:false + webviewTag` 组合的收敛路线（长期目标：guest 侧 contextIsolation 打开） |
| R4-5 | 把"改共享面必须按『谁加载了它』选回归面"（D27）写成可执行检查：改 `preload.cjs`/shim/启动序列时，自动列出所有在沙箱里加载该文件的测试并要求它们进 L2 |

---

## 6. 复现方式

```bash
# 静态门禁
node tests/typecheck.mjs
node tests/shim-module-boundaries.mjs
node tests/react-rewrite-sentinel.mjs
node tests/scope-field-convergence.mjs
node tests/frontend-gates-unit.mjs
node tests/publish-asset-manifest.mjs

# 产物门禁（D12：必须先 npm run build）
npm run build && node tests/dist-entry-check.mjs

# 定向回归（本次复跑的 13 项）
for t in runtime-services-contract module-registry-contract match-rules-equivalence \
         image-ops-writeback f08f09-action-supply-contract preload-subscriptions \
         m4-window-subscriptions m4-url-history m4-preview-dispose tab-bar-closed-loop \
         frontend-public-policy worker-protocol-contract; do node tests/$t.mjs || echo "FAIL $t"; done

# 后端闭环（**必须单独跑**，串行会争端口）
node tests/image-transform-closed-loop.mjs
node tests/item-thumbnail-endpoint.mjs
node tests/backend-import-integrity.mjs

# 全量（本次未跑）
node tests/run-react-suite.mjs
npm run test:acceptance
```

---

## 7. 给后续接手人的三句话

1. **这份改造的真正成果不是"删了旧文件"，而是把一批"静默假成功"改成了"要么真做要么报错"，并把门禁从会放水改成会失败。** 这个方向要保持。
2. **别把"四段全绿"当成护身符。** 收官当晚就有一个用户可见的启动缺陷从门禁缝里漏出去——验收矩阵对 `electron/**` 与"窗口真的可见"是盲的，先补这里。
3. **剩下最难的部分是证据不是代码**：插件 webview 端到端、RAW/TIFF/UDOC 样本、部署根运行期探针，这四块目前都是"静态上应该没问题"。在它们被真机跑通之前，收官口径里请一直保留这一句。
