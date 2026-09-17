# 验收问题整改 · 工作记录（2026-09-17）

> 输入：`docs/audit-verification-2026-09-17.md`（独立验收报告）暴露的问题与 R0–R4 路线
> 工作区：`H:/dev/Eagle-Sec-development - 副本`，分支 `react-in-place`
> 基线 HEAD：见文末「基线」一节（**每批改动后更新**）
> 口径：改一处、跑一处；未跑到的一律记为「未验证」，不写成通过

---

## 0. 本次整改的范围与取舍

验收报告列了 R0（1–2 天）/ R1（一周）/ R2（两周）/ R3（一个月）/ R4（持续）五档。
本次只落地**能在当前工作区闭环验证**的部分，其余转入「未做项」（见 §9）：

| 路线 | 是否做 | 说明 |
|---|---|---|
| R0-1 窗口几何纯函数单测 | ✅ | 需先把逻辑从 `main.cjs` 里抽出来才测得动 |
| R0-2 `electron/**` 静态门禁 | ✅ | 新增依赖面快照 + 几何保护检查 |
| R0-3 验收基线即 HEAD | ✅ | 本文档每批记录 `git rev-parse HEAD` |
| R0-4 窗口可见性实机断言 | ✅ | 新增 `--smoke-window-bounds` 真机门禁 |
| R1-1 `access` 恒 true | ✅ | 改真实可写判定，不可判定即抛错 |
| R1-2 六项替身 / `/mock-user-data` | ⚠️ 部分 | 只做 `app.getPath('userData')` 真值这条根因；其余转未做项 |
| R1-3 D14 取证 | ✅ | 已实机取证，见 §11 |
| R1-4 空 catch 分类 | ✅ | 538 处全量清单 + 11 处改为上报 + 棘轮门禁，见 §12 |
| R2-3 部署根四处耦合点的**运行期**探针 | ✅ | 新增 `tests/deployment-root-runtime-probe.mjs`，见 §13 |
| R2-1/R2-2/R2-4/R2-5 运行证据（插件 / RAW 样本 / flaky 归零 / L3 全量） | ❌ | 需真实样本与真机长跑，转未做项 |
| R3-* 架构债 | ❌ | 体量过大，转未做项 |
| R4-1 probe 脚本归档 | ✅ | 移出 `tests/` |
| R4-2 gitignore | ✅ | |
| R4-3 构建链三件事 | ✅ | 错误掩盖 / 重定位幂等 / 收尾删除 |
| R4-4 webview IPC 白名单 | ❌ | 属安全方案评审，转未做项 |
| R4-5 D27 可执行检查 | ❌ | 转未做项 |

---

## 1. 基线

（每批改动前记录，见 §10 时间线）

改动起始 HEAD：`c367b2aab5e59755f36d5659f7cfa31f56a112c6`（= 验收报告所验收的 HEAD）

---

## 2. R0-1 · 窗口几何从 main.cjs 抽出 + 纯函数门禁

**改动**

| 文件 | 改动 |
|---|---|
| `electron/window-geometry.cjs` | **新增**。`boundsVisibleEnough` / `clampWindowState` / `resolveWindowBounds` 三个纯函数，显示器集合由调用方注入；文件内**不 require('electron')**，故纯 Node 可加载 |
| `electron/main.cjs` | 删除内联实现，改为薄封装（`currentDisplays()` 取屏 → 传给纯函数）；调用点语义逐字不变 |
| `tests/electron-window-geometry.mjs` | **新增**。24 条断言：真实缺陷样本 `{x:302,y:1262}`、只交叠 79px（阈值 -1）、交叠 80px（阈值）、多显示器、只有副屏、x=0/y=0 不得当假值、脏数据、宽高 0 回落；外加负向自证与「main.cjs 不得自带第二份实现」接线自证 |
| `tests/react-suite-manifest.mjs` | 登记进 `REACT_SUITE`（static，排在最前的秒级段）与 `TEST_CLASSES` |

**验证证据**

- `node tests/electron-window-geometry.mjs` → `PASS … 24 项断言通过`
- **变异自证**：把 `createWindow` 里的 `&& boundsVisibleEnough({...})` 删掉后重跑 → 退出码 1，
  `AssertionError: 调用方显式传入的位置也必须过可见性校验`；还原后恢复全绿。
  即：**删掉可见性校验，门禁会红**——这正是原缺陷当年能一路漏到用户手上的缺口。

**顺手修掉的同类问题**：`resolveWindowBounds` 的宽度/高度改用「大于 0 的有限数」判定，
`0` 不再被 `||` 当假值吞掉（`c367b2aa` 只修了 x/y 这一半）。

---

## 3. R1-1 / R1-2 · 静默假成功：权限检查与用户数据目录

### 3.1 `access` 恒 true（P0）

| 文件 | 改动 |
|---|---|
| `src/app/react/core/shim/moduleRegistry.ts` | 新增 `checkPathWritable()`：`/my_modules/access` 三个方法由「恒 true」改为三态——有原生 fs → 真实 `accessSync(path, W_OK)`；无原生 fs 且**非演示态** → 抛错；演示态保留 true（无文件系统可言）但**空路径一律抛错** |
| `tests/module-registry-contract.mjs` | 断言同步更新：演示态传路径返回 true；`checkALCs('')` / `checkACL(undefined)` 必须抛错；截获记录分类 `stub-security → facade-security` |

消费者 `libraryDomain.ts:1117` 用 `ACCESS.checkALCs(libraryPath)` 判断库路径写权限——
**恒真等于这道检查在生产中不存在**。改后 Electron 生产态会给出真实结论。

### 3.2 `/mock-user-data`（P1）

伪造路径有三处来源，全部处理：

| 来源 | 处理 |
|---|---|
| `desktopCapability.ts` `app.getPath` 回落值 | **新增真值通道**：主进程 `ipcMain.on('app:get-path')`（同步，经 `preload.cjs:88` 既有通用 `ipc.sendSync` 直达，无需改 preload）；取不到时返回**空串**并登记能力缺口，不再伪造 |
| `moduleRegistry.ts` `/my_modules/appdata-path` | 转调 `desktopCapability.app.getPath('userData')`，与桌面能力面同源 |
| `browserRuntime.ts` `osModule.tmpdir/homedir` | 有原生 `node:os` 时给真值，否则空串（原为 `/mock-tmp`、`/mock-user-data`） |

`app.getPath` 是同步契约（`bundleGlobals` 直接拼 `userData + '/eagle-temp'`），
所以通道必须同步——`ipcRenderer.sendSync` 与既有 `window:query` 同型，未引入新依赖。

**验证证据**：typecheck OK（235 文件 0 诊断）；`shim-module-boundaries` OK；
`module-registry-contract` 6/6；`runtime-services-contract` 20/20；
`scope-field-convergence` OK。
**未验证（写作当时）**：真实 Electron 下 `app.getPath('userData')` 是否落到真值。
**已于 §11 实机取证闭合**：主进程返回真实路径，渲染层经 `app:get-path` 同步通道取到的值与主进程一致。

---

## 4. R0-4 · 窗口可见性的实机门禁

**改动**

| 文件 | 改动 |
|---|---|
| `electron/main.cjs` | 新增 `--smoke-window-bounds` 模式：按测试注入的落盘几何创建主窗，然后打印 `WINDOW_BOUNDS_SMOKE {saved, bounds, displays}`，随即退出 |
| `tests/electron-window-bounds.mjs` | **新增**。起真实 Electron 两次：注入屏外几何（真实缺陷样本形态 `{x:302,y:1262}`）与合法几何 `{x:40,y:40}` |
| `tests/react-suite-manifest.mjs` | 登记（dev-probe） |

**实测结果（本机 1920×1050 工作区）**

- 注入 `{x:302,y:1262}` → 实际 bounds `{x:320,y:125}`：**屏外几何被丢弃、系统居中**，7 项断言通过；
- 注入 `{x:40,y:40}` → 实际 bounds `{x:40,y:40}`：合法几何被沿用（证明不是「一律丢坐标」）；
- 判据复用 `electron/window-geometry.cjs`，测试里不抄第二份阈值。

**变异自证**：把 `createWindow` 里的 `boundsVisibleEnough` 守卫删掉后重跑 →
进程未能产出 `WINDOW_BOUNDS_SMOKE`（退出码 2147483651 / 0xC0000005）→ 门禁红。
另外单独移除 `clampWindowState(loadWindowState())` 时**不红**——因为第二道守卫兜住了，
这属于 c367b2aa 的纵深防御，记录在此以免被误读成「clamp 无用」。

---

## 5. R0-2 · `electron/**` 静态门禁

**改动**：新增 `tests/electron-main-gates.mjs`（10 项断言，纯 Node、秒级），登记为 static。

四组闸：

1. **落盘几何必须经对账**：`window-state.json` 只有 `loadWindowState` 一处读取；
   `createWindow` 必须 `clampWindowState(loadWindowState())`；不得出现 `x: saved.x`；
   判定实现不得在 main.cjs 里抄第二份（允许薄封装，但禁止交叠运算/阈值常量/重复定义）。
2. **依赖面快照**：`electron/**` 六个脚本的 `require`/`import` 清单与基线逐项比对，
   增删改即红——`electron/**` 不在 tsconfig 内，删掉一个 require 不会有任何类型报错，
   而 M6-3 正是改了 preload 依赖面打断 3 个沙箱加载器（验收 §3.4 第 3 起）。
   同时钉住 `window-geometry.cjs` 不得 `require('electron')`（否则纯 Node 门禁失效）。
3. **伪造路径回归闸**：`electron/**` + `core/shim/**` 的代码（剥注释后）不得再出现
   `/mock-user-data`、`/mock-tmp`——R1-2 的防退化闸。
4. **webPreferences 安全面快照**：`nodeIntegration/contextIsolation/sandbox/webviewTag`
   当前为 `true/false/false/true`，任一变更必须显式登记理由（R4-4 的收敛路线）。

---

## 6. R4-1 / R4-2 · 一次性诊断脚本归档与 gitignore

### 6.1 R4-1 · 18 个 probe 脚本移出 `tests/`

验收原文：「删除或移出 `tests/probe-*.mjs` 18 个已入库的一次性诊断脚本」。

选**移出**（而非删除）：这些脚本记录了真实取证过程（b19d 系列、delivery、boot 等），删掉不可恢复；
但它们与门禁同处 `tests/`，容易被误当成门禁去跑——跑不通，也无人维护。

| 项 | 处理 |
|---|---|
| 18 个脚本 | `git mv` 到 `outputs/probe-archive/`（15 个 `probe-*.mjs` + `react-probe` / `react-electron-probe` / `sidebar-probe`）。用 `git mv` 而非 `mv`：git 记录为 `R` 重命名，来源历史不丢 |
| `outputs/probe-archive/README.md` | **新增**。写明三件事：不跑、不保证能跑、与门禁零关系；今后不要往 `tests/` 里放一次性脚本 |

### 6.2 R4-2 · `.gitignore` 补 4 条

```
.zcode/
.workbuddy-ai/
frontend/vite.preview.config.mjs.timestamp-*.mjs     # vite 异常退出残留的临时文件
frontend/public/mock-library/**/mode.json            # 被跟踪的演示库，运行期回写
frontend/public/mock-library/**/virtual-cache.json
frontend/public/mock-library/**/backup/
```

最后三条是同一类问题：`mock-library` 是**入库的**演示库，跑一次应用就被写回运行期产物，
工作区永远脏——这正是验收里「工作区脏、无法判断哪些是真改动」的来源之一。

---

## 7. R4-3 · 构建链三件事

### 7.1 先说根因：一次「看起来像我改坏了」的构建失败

改完 `frontend/vite.preview.config.mjs` 后 `npm run build` 退出码 1，报：

```
[eagle] 必需构建页不存在，无法重定位：src/app/react/tools/workbench/index.html
```

排查（证据落在 `outputs/_rebuild-*.log`）：

1. **用 HEAD 原版配置重跑** → 同样失败（`_rebuild-orig.log`）。排除「我的改动引入」。
2. **`--emptyOutDir false`** → 成功。定位到 vite 的 `emptyOutDir`。
3. 机理：vite 清空产物目录时 `emptyDir()` 抛的错，发生在 rollup `finally { bundle.close() }`
   **之后**，被 `closeBundle` 里抛出的错顶掉；同时 `emptyOutDir` 抛错会判死整轮构建。
   这与验收 §3.5 第 1 条「`closeBundle` 掩盖 rollup 真实错误」是同一个病根的第二种表现。

修复：**不再用 vite 的 `emptyOutDir`**，改由本配置 `buildStart` 里的 `emptyPublishDir()` 接管清空。

### 7.2 三件事的落地

| # | 问题 | 做法 |
|---|---|---|
| ① | `closeBundle` 掩盖 rollup 真实错误 | 新增 `renderError` 钩子，把**第一个**真实错误存进 `capturedBuildError`；`closeBundle` 失败时先打印本次错误、再打印早先那个真实错误，然后才 throw |
| ② | 4 页重定位非幂等 | `buildStart` 先 `emptyPublishDir()` 摘掉四个旧 URL 落点；此后 `to` 存在即意味着本次刚搬过去。重定位时若 `from` 与 `to` 同时存在 → **显式抛错**「产物处于半新半旧状态」（原先静默覆盖，产物里会出现「旧 URL 指向上一次构建的页面」且看起来构建成功） |
| ③ | 收尾删除判死构建 | `build.emptyOutDir: false`；`removeTree` 三级降级：`rmSync` → **整体 rename 到 `dist/.eagle-stale/<name>-<ts>-<pid>`** → 逐项 unlink/rmdir（1000 项 / 20 秒预算）。清理失败只 `console.warn`，不推翻构建 |

为什么必须加 rename 这一级：本机实测 `fs.rmSync` 会走 safe-delete / genie-trash，
`src`、`assets`、`mock-library` 整树删除直接超时（`ETIMEDOUT` / `Some operations were aborted`，
见 `_rebuild-t1.log`）。rename 是 O(1)，把整树移出产物目录即可，比逐项删除快几个数量级。

### 7.3 验证证据

- 连续两次构建成功：`✓ built in 26.91s` / `✓ built in 38.28s`（`_rebuild-t3.log` / `_rebuild-t4.log`），
  4/4 页重定位、runtime assets 17 项、`mock-library` 走 rename 降级并打印去向；
- `node tests/dist-entry-check.mjs` → `汇总：FAIL 0；已检查文件 304` → `DIST_ENTRY_CHECK_OK`。

---

## 8. 复跑证据

### 8.1 本次新增 / 改动的门禁

| 命令 | 结果 |
|---|---|
| `node tests/electron-window-geometry.mjs` | PASS，24 项断言 |
| `node tests/electron-main-gates.mjs` | PASS，10 项断言 |
| `node tests/electron-window-bounds.mjs`（实机） | PASS，7 项断言 |
| `node tests/module-registry-contract.mjs` | PASS 6 / fail 0 |
| `node tests/frontend-acceptance.mjs --stages=static` | PASS：`frontend-gates-unit` / `typecheck` / `react-rewrite-sentinel` / `shim-module-boundaries` / `scope-field-convergence` 全绿 |
| `node tests/frontend-acceptance.mjs --list` | `COVERAGE_OK`：React 套件 **105 项**（static 37 / dev-probe 68），必需项齐备且已登记执行入口 |

套件从 102 → 105：新增的 `electron-window-geometry`（static）、`electron-main-gates`（static）、
`electron-window-bounds`（dev-probe）均已登记，覆盖面守卫未报 missingOnDisk / unexecuted。

定向回归（14 项，复跑全绿）：`runtime-services-contract`、`match-rules-equivalence`、
`image-ops-writeback`、`f08f09-action-supply-contract`、`m4-window-subscriptions`、`m4-url-history`、
`m4-preview-dispose`、`tab-bar-closed-loop`、`frontend-public-policy`、`worker-protocol-contract`、
`image-transform-dispatch`、`m3-filter-cold-start`、`plugin-format-preload`、`boot-ready-sequence`；
另有 `backend-import-integrity` / `item-thumbnail-endpoint` / `image-transform-closed-loop`。

### 8.2 本会话的一次 git 事故与恢复（必须留档）

**现象**：会话中途 `git` 开始报 `fatal: not a git repository`，而 `.git` 目录存在。

**根因**：`.git` 里有三样东西没了——

- `.git/refs/` 整个目录（git 校验仓库要求 HEAD + objects + refs 三者齐备，缺 refs 就直接判定「不是仓库」）；
- `.git/objects/pack/*.pack` 两个 pack 数据文件（只剩 `.idx`、`multi-pack-index`、`commit-graph`）→
  `git count-objects -v` 显示 **in-pack: 0**，对象库实际是空的；
- `.git/logs/**` 全部 reflog。

**恢复步骤**（按顺序，全部留痕）：

1. `mkdir -p .git/refs/{heads,tags,remotes}` → git 重新认仓库（此时仍 `bad object HEAD`，因为对象空）。
2. `git fetch origin` → 从远端重新拉取 **18805 个对象 / 43 MB**，对象库恢复，`c367b2aa`（本会话产出的
   R0-1 提交）与 `918f54ff`（其父）均可解析。
   fetch 收尾报 `bad object refs/heads/shawpook/m1-f04-boot` —— 本地独有分支不在远端，
   **不影响已下载对象落盘**（`in-pack: 18805`）。
3. 删掉两个无对应 `.pack` 的孤儿 `.idx`（否则每条 git 命令都刷 warning）。
4. **分支指针复位**：本会话产出的 `c367b2aa` 仍在，但 `refs/heads/react-in-place` 回退到了它的父
   `918f54ff`。核对后确认——索引里的 `main.cjs` 与 `c367b2aa` **完全一致**、工作区在其之上多了后续
   改动（+50/−27），即「指针回退、内容没丢」。用 `git reset --soft c367b2aa` 复位（只动指针，
   不动索引与工作区）。

**不可恢复的损失**：

- 5 个从未推送到远端的本地分支 tip（**已按用户指示删除引用**，SHA 存档如下以备查证）：

  | 分支 | 原 tip SHA |
  |---|---|
  | `shawpook/m1-f04-boot` | `e8a654a46da7511d4dfe9994dff76d0db5485e28` |
  | `shawpook/m1-f06-frontend` | `bbea9c6b5c7a338f98b5b1ba00ce33ec7127abf9` |
  | `shawpook/m2-runtime-services` | `e8b3d2b18b91fd41a06823a2cbc71f933fa1e8bc` |
  | `shawpook/m5-tools-address` | `61e8fe1256ba01a6a1dadd2ede91de56a3ac2977` |
  | `ui-change-attempt-glm` | `2778f99c462c11ab96db5a78a92e0f1e7bf25011` |

  删除理由：这些 tip 的对象已丢失且 `git ls-remote` 确认远端没有，**引用本身已不可读**；
  留着会让**每次 `git fetch` 都失败**（`fatal: bad object ...` → `did not send all necessary objects`），
  导致远端跟踪引用永远无法自动更新。
  这些分支的内容若已合入 `react-in-place` 则不受影响（分支历史本身在远端/当前分支里），
  仅这 5 个 tip 提交对象及其独占内容丢失。
- 1 个旧 stash（`2d705f0c`，本次会话**之前**产生的）：对象已不在，
  `git stash list` 现在报 `bad object refs/stash`。该悬空引用要不要
  `git update-ref -d refs/stash` 清掉，交给用户决定（清掉不影响任何现有代码）。

**收尾校验**：`git fsck --connectivity-only` 报的错，已从「大量 `failed to load pack`」
（陈旧 `multi-pack-index` 仍指向被删的 pack，删掉这个纯缓存即消失）降到只剩 6 条：
5 个悬空分支引用 + 1 个 `refs/stash`，全部是上面那批「不可恢复」的对象。
index 的 cache-tree 失效指针（tree `0ce60ba9`）已用 `git write-tree` 重建修好。
**仍未做**：reflog 无法重建（`.git/logs/**` 已随对象一起丢失）。
**教训**：本次所有改动在事故时刻都还只存在于工作区，未提交。若当时已提交且未推送，
损失会大得多——后续同类整改建议「小步提交 + 尽早推送」。

### 8.3 追查「到底是谁删的」：一个可复现的环境层缺陷（必须留档）

用户质疑：*「.git 只有你动过啊，真不是你操作误删？」* —— 这个质疑是合理的，
本轮**没有继续归因给环境，而是设计了对照实验去证伪/证实**。

**待解释的现象**：推送明明成功（远端 `9adca7b8..f086ca56`），本地却一直显示 `ahead 1`；
且 `.git/refs/remotes/origin/` 这个目录会**反复消失**。

**实验设计**：先手工放哨兵文件，再用 `git update-ref` 写不同深度的 ref，观察哨兵与目录的存活。

| # | 写入的 ref | `.git/refs` 下的路径深度 | 结果 |
|---|---|---|---|
| 0 | 只放哨兵文件、不跑 git | — | 哨兵存活 ≥7 秒（排除「有进程随机扫荡」） |
| 1 | `refs/heads/__probeA2` | 2 段（`heads/x`） | ✅ 写入成功，同目录哨兵存活 |
| 2 | `refs/remotes/__y` | 2 段（`remotes/x`） | ✅ 写入成功 |
| 3 | `refs/remotes/origin/__w` | 3 段 | ❌ **整个 `origin/` 目录连哨兵一起消失** |
| 4 | `refs/remotes/other/__z` | 3 段（换个 remote 名） | ❌ 同样消失 → **与 `origin` 这个名字无关** |
| 5 | `refs/aaa/bbb/ccc` | 3 段（全新子树，与 remote 毫无关系） | ❌ 同样消失 → **与语义无关，只与深度有关** |

**结论**：本环境下 `git update-ref` 写入**路径深度 ≥3 的松散 ref 时，会把该 ref 所在的末级目录整个删掉**，
且 `git` 自身仍返回退出码 0（**静默失败**）。100% 可复现。

**这条结论能解释什么、不能解释什么（边界要写清楚）**：

- ✅ 能解释：`.git/refs/remotes/origin/` 为何**反复**消失——只要 fetch/push 试图更新
  `refs/remotes/origin/<分支>`（天然是 3 段），目录就被删。
- ✅ 能解释：「推送成功却 ahead 1」的假象——见下方故障复现。
- ❌ **不能解释**：§8.2 那次**一次性**的灾难——`.git/refs/` 整个目录、
  `.git/objects/pack/*.pack`、`.git/logs/**` 同时消失。深度缺陷只动 `refs/` 下的末级目录，
  不会去删 `objects/pack`。**那一起事故的根因仍未定位**，本轮不假装已查清。

**故障复现（可逆，已还原）**：把 `packed-refs` 里 `refs/remotes/origin/react-in-place`
人为退一格到 `9adca7b8`，再跑 `git fetch origin`：

```
From https://github.com/shawpook/Eagle-Sec-ChangeToReact
   9adca7b8..f086ca56  react-in-place -> origin/react-in-place
FETCH_EXIT=0
fetch 后解析: 9adca7b8d13f440f585fb3e66f008512e0ae38a3   ← 没变
refs/remotes 目录: （空）
```

即：**fetch 打印成功、退出码 0，但跟踪引用纹丝不动**。这就是「ahead N」假象的完整成因。

**处置与规避手段**（已落地）：

1. 既然松散 ref 在本环境存不住，改用**可靠介质 `packed-refs`** 承载跟踪引用
   （实测：普通文件写存活、git 能正确读取，且 git 不会去删它）。
   已把 `refs/remotes/origin/react-in-place` 直接写入 `packed-refs` = `f086ca56`。
2. **最终对账（三方一致）**：

   | 来源 | 值 |
   |---|---|
   | 本地 `HEAD` | `f086ca56` |
   | 本地 `origin/react-in-place` | `f086ca56` |
   | 远端 `git ls-remote origin react-in-place` | `f086ca56` |
   | `ahead/behind` | `0 / 0` |

3. **给后续的操作约定**（重要，否则会重复踩坑）：
   - **不要相信本地 `origin/*` 的解析值**，以 `git ls-remote` 为事实源；
   - 每次 push/fetch 之后，若 `git rev-list --left-right --count origin/<分支>...HEAD` 不是 `0/0`，
     先 `git ls-remote` 核对远端真值，再按第 1 条手工刷新 `packed-refs`；
   - 本机 `.git` 不宜当持久存储，任何重要状态以 GitHub 为准。

**关于「是不是我误删的」——如实说明**：本轮我对 `.git` 的删除类操作仍只有此前那 3 个
（删孤儿 `.idx`、删陈旧 `multi-pack-index`、`update-ref -d refs/stash`），
均不指向本次被删目标。而上面实验 5 用的是**我几秒钟前刚 `mkdir` 出来的全新路径 `refs/aaa/bbb`**，
在此之前它没有任何历史、也不可能被我「误删过」——它照样被删。
所以「反复删 `refs/remotes/origin`」这一现象**可以排除人为误删**。
但 §8.2 那次`objects/pack` 与整个 `refs/` 的丢失，我**依然无法自证清白**，保持存疑。

---

## 9. 未做项（按验收报告原文口径，不伪装成已完成）

> R1-3（D14 取证）**已于 §11 完成实机取证**，已从下表移除。
> R1-4（空 catch 分类）**已于 §12 完成**：全量清单见 `docs/r1-4-empty-catch-inventory.md`，
> 已从下表移除；但其中「遗留层待接线 / 待逐项裁决」的部分如实保留在清单里，不伪装成已完成。
> R2-3（部署根运行期探针）**已于 §13 完成**，已从下表移除；
> 但 `isolated-deployment.mjs` 本身（起完整生产栈 + Electron）在本环境仍未实跑，见 §13.6。

| # | 验收原文要点 | 未做原因 |
|---|---|---|
| R2-1 | 造一个真实可用的格式查看插件条目，把 M6-4 三处 `<webview>` 端到端跑通（含 guest 内 preload 真实执行、加载失败、退出清理） | **结构性阻塞**：格式插件内核在 React 侧被显式截获成 stub（三处宿主永不会创建插件 webview），需先有 React 侧插件装载实现（产品决策）。详见 §14 |
| R2-2 | 准备 RAW / TIFF / HEIF / UDOC 真实样本，跑通解码矩阵 | 缺样本 |
| R2-4 | 处理 `screenshot-regression` 3/16 既有红、`main-ui-workflow` 的 IPC 超时抖动、`thumbnail-task` 的端口黑名单 flaky | 既有的三项不稳定，需复现条件 |
| R2-5 | 跑一次真正的 L3 全量（102 + 6 + 7）并归档结果；**必须在普通终端跑**（沙箱内 CDP 类测试必失败） | 需普通终端长跑 |
| R3-1 | 拆 `tsconfig`：为 Electron 主进程、Node 脚本、扩展、Worker 各建独立配置并分批纳入门禁 | 体量大 |
| R3-2 | D20 的 3 处 `(window as any)` 与同仓既有 85 处，通过在 `global/globals.d.ts` 加 `declare global` 一并消除 | 体量大 |
| R3-3 | 清 `demoSeed.ts` 的 `capturePollTimer` 死变量；复核其他「声明了却从未赋值/消费」的残留 | 属清理，未做 |
| R3-4 | `scopeFace` 按 readonly 快照 / 类型化命令 / 引擎实例三分；`domLite` 收口到引擎 adapter | 架构改造 |
| R3-5 | 7174 处 `any` 分层收敛：先做「新增即失败」的增量门禁，再按域消化存量 | 架构改造 |
| R4-4 | 为 `<webview>` guest 侧定义显式 IPC 白名单，评估 `nodeIntegration + contextIsolation:false + webviewTag` 组合的收敛路线 | 属安全方案评审。本次只做了**防退化**的一半：`electron-main-gates` 已把 webPreferences 钉成快照，改动必须显式登记理由 |
| R4-5 | 把「改共享面必须按『谁加载了它』选回归面」（D27）写成可执行检查 | 需建立「谁加载了它」的索引 |

另外，§3.2 有一项**未验证**：真实 Electron 下 `app.getPath('userData')` 是否确实拿到真值。
本次只证明了「不再返回伪造的 `/mock-user-data`」与「主进程同步通道已接线」，
真值落地的实机取证仍需一次 Electron 实机断言（建议并入 R1-3 的取证批次）。

---

## 10. 时间线与基线

| 时点 | 事件 | HEAD |
|---|---|---|
| 整改起始 | 以验收报告所验收的提交为基线 | `c367b2aa` |
| 批 1 | R0-1 窗口几何纯函数化 + 单测 + 变异自证 | `c367b2aa` |
| 批 2 | R1-1 `access` 真实判定；R1-2 伪造路径根因（同步通道 + appdata-path 门面 + os 真值） | `c367b2aa` |
| 批 3 | R0-4 实机窗口可见性门禁；R0-2 `electron/**` 静态门禁 | `c367b2aa` |
| 批 4 | R4-1 probe 归档；R4-2 gitignore；R4-3 构建链三件事 | `c367b2aa` |
| 收尾 | 复跑门禁；**git 对象库事故与恢复**；`git reset --soft c367b2aa` 复位指针 | `c367b2aa` |
| 提交 | `d48c7576` 代码门禁（R0-1/R0-2/R0-4/R1-1/R1-2）；`c676747d` 仓库与构建链（R4-1/2/3 + docs） | `c676747d` |
| 推送 | `git push origin react-in-place` → `c367b2aa..c676747d` | `c676747d` |
| 补 | `9adca7b8` D14 取证（R1-3 闭合） | `9adca7b8` |
| 补 | `f086ca56` 删除 5 个已不可恢复的分支引用，修复 `git fetch` 恒失败 | `f086ca56` |

**当前 HEAD：`f086ca5696a93934215bf85f9c58a68817f969a6`（已推送到 origin）**

四个提交：

| 提交 | 内容 | 规模 |
|---|---|---|
| `d48c7576` | `fix(electron+shim)`：窗口几何纯函数化与单测、`electron-main-gates` 静态闸、实机窗口可见性门禁、`access` 真实判定、三处伪造路径根因 | 10 文件，+867/−47 |
| `c676747d` | `chore(repo)`：构建链三件事、18 个 probe 脚本归档、gitignore 补齐、落盘本工作记录与验收报告 | 23 文件（含 18 个重命名） |
| `9adca7b8` | `docs(d14)`：Electron 下 `require('http')` 实机取证，闭合 R1-3 与 §3.2 | — |
| `f086ca56` | `chore(repo)`：删除 5 个对象已丢失的分支引用，使 `git fetch` 恢复正常 | — |
| `9cf213e8` | （上一批收尾） | — |
| `7a847a39` | R1-4：空 catch 全量清单 + 上报通道 + 棘轮门禁（见 §12） | — |
| `a2c17953` | R2-3：部署根四处耦合点的运行期探针 + 共享 `tests/deployment-root.mjs`（见 §13） | 5 文件 |

**仓库健康度（最终复核）**：

- `git fetch origin` 退出码 **0**（此前恒为 1）；`git fsck --connectivity-only` **0 错误**
  （仅剩 2 条无害的 dangling blob/tree）。
- 三方一致：本地 `HEAD` = 本地 `origin/react-in-place` = 远端 `git ls-remote` = **`a2c17953`**（R2-3 推送后复核）；
  `ahead/behind = 0/0`。
- 5 个不可恢复的分支引用已按用户指示删除（SHA 存档见 §8.2）。
- 遗留：`refs/stash` 悬空引用仍在（`2d705f0c` 对象已丢失），清不清由用户决定。

> ⚠️ **跟踪引用的值目前是靠手工写 `packed-refs` 维持的**，因为本环境写不进深度 ≥3 的松散 ref
> （见 §8.3）。后续每次 push/fetch 后如发现 `ahead/behind` 不是 `0/0`，先 `git ls-remote` 核对真值，
> 再按 §8.3 的方法刷新 `packed-refs`——不要相信本地 `origin/*` 的解析值。

---

## 11. R1-3 · D14 取证：Electron 下 `nativeRequire('http')` 到底能不能用

验收原文要求：「实测 Electron 下 `nativeRequire('http')` 可用性，据此决定
`http`/`https`/`JsonRestServer` 是『显式失败』还是『可接线』；结论写回 `project-state.md`，不再标记为待证」。

**取证脚本**：`outputs/d14-capability-probe.cjs`（**一次性取证，不是门禁**，放在 `outputs/` 而非
`tests/`，遵 §6 定下的规矩）。关键点是窗口 `webPreferences` 必须与生产一致，否则结论没有意义：
`nodeIntegration:true` + `contextIsolation:false` + `sandbox:false` + `webviewTag:true`。

**实测结果**（Electron 22.3.7 / Node 16.17.1 / win32，完整输出见 `outputs/_d14-probe.txt`）：

| 模块 | 结果 |
|---|---|
| `http` | ✅ 可用（取到 `METHODS` / `STATUS_CODES` / `Agent`） |
| `https` | ✅ 可用 |
| `net` | ✅ 可用 |
| `node:os` / `node:fs` / `path` / `child_process` / `electron` | ✅ 均可用 |
| `node:fs` 含 `accessSync` | ✅ —— §3.1 那道真实权限判定在 Electron 下确实落得地 |

**⇒ D14 的「可能可用」从推测变成结论。**

### 但裁决不变，且理由变强了

维持 `http` / `https` / `JsonRestServer` **显式失败**。理由从「能力可能不存在」换成一条**更硬的**：

能力确实存在，而唯一消费者 `urlEnlarger.#checkURLByEagle` **没有 try/catch**，且被
`isRunningInEagleApp` 门控——直接接线会把「抛点落在无保护表达式上」重新引回来。
换句话说：这是**消费者侧不设防**，不是**能力侧不可得**。

**若将来要接线，前置条件**是先给该消费者加 try/catch，或把调用点整体纳入能力门控；
不是把 `nativeRequire('http')` 直接接上去就完事。这条已写进 `project-state.md` 的 D41。

### 顺带闭合 §3.2 的「未验证」

同一次取证把 R1-2 的真值通道也验了：

- 主进程 `app.getPath('userData')` → `C:\Users\Administrator\AppData\Roaming\Electron`（**真实路径**）。
  名为 `Electron` 是因为直接 `npx electron` 跑、没设 app name；真实运行按 app name 走，
  这里要看的是「是不是真值」而不是具体值。
- 渲染层 `ipcRenderer.sendSync('app:get-path', 'userData')` → 与主进程**完全一致**；`temp` 同理。
- 空名 / 非法名 → 返回 `''`，**不伪造**（符合设计：取不到就返回空串并登记能力缺口）。

⇒ `/mock-user-data` 那条路的替代通道已证实可用，§3.2 的「未验证」就此闭合。

**未做的部分**：没有验证真实应用打包后（设了 app name、走了 `preload.cjs` 的通用 `ipc.sendSync`）
的取值。本次是「同型通道」取证，不是端到端打包验证；若要完全闭合，需在打包产物上再跑一次。

---

---

## 12. R1-4 · 空 catch 的分类、观测与棘轮门禁

验收原文：「对 680 处 `catch (err) { /* 注释 */ }` 做分类（顶层兜底 / 真实吞错），把
『吞错且影响业务结果』的挑出来加观测」，验收标准：**形成清单，逐条要么上报要么注明理由**。

**产物**：`docs/r1-4-empty-catch-inventory.md`（951 行，脚本生成可复现）。

### 12.1 先纠口径：不是 680，是第一方 538

验收报告的 680 没有区分第一方与 vendored。本仓**把依赖直接提交了**——
`src/node_modules` 有 8000+ 文件入库，另有 `src/app/js/vendors`（bignumber/libheif/libtga/
sweetalert2/tiny-pinyin/videojs/wavesurfer）、`pdf-viewer`、`model-viewer/libs`、
Emscripten 产物 `dcraw.js` 与 `libheif.js`。排除后**第一方生产代码 538 处**（另有 `tests/` 124 处未纳入）。
量级与 680 一致，但口径更严。

### 12.2 方法：AST，不是正则；判据落在 try 块，不落在 catch 的注释上

- 用 TypeScript parser 找 `CatchClause` 且 `block.statements.length === 0`。
  正则在嵌套花括号 / 字符串 / 模板串里必然误判，而本仓存在逐帧渲染路径上的 catch，误判代价高。
- **分类看 try 块在保护什么，不看 catch 里写了什么理由**——注释可能写错，try 块内容不会。

规则修了两轮，都是抽样复核后发现的误判：

| 误判 | 真相 |
|---|---|
| `pause()` / `removeListener()` / `trap.reset()` 被判高风险 | 是资源释放 |
| 日志文案里含 "rename" 三个字母被判写操作 | 只是在打日志 |
| `throw BreakException` 被判吞错 | 是故意抛异常跳出循环的控制流惯用法 |
| try 块只有注释被判可疑 | 等于空 try，零风险 |

### 12.3 结果

| 项 | 值 |
|---|---|
| 生产代码空 catch | **538** |
| 高风险（会改变业务结果） | 145 |
| 低风险（清理/日志/UI/可选读取/纯解析） | 393 |
| 本次已改为上报 | 11 处（4 个文件） |

**挑出来加观测的（本次已改代码）**：

| 文件 | 处数 | 为什么是它 |
|---|---|---|
| `core/fileUrlHelper.ts` | 6 | **注释里就记着一起真实事故**：URL_MODULE 绑定消失被吞 → URL 静默变空串 → 详情原图无 URL → 交付闸门永不释放 |
| `core/ipcHelper.ts` | 2 | IPC 发送失败完全吞掉 → 「点了没反应」且无线索 |
| `stage7/PluginCenter.tsx` | 2 | `openPluginById` 失败被吞 → 用户点安装/打开插件毫无反应 |
| `inspector/Inspector.tsx` | 1 | 格式插件 webview 的 create/run 发送失败 → 插件面板永远空白 |

### 12.4 上报通道本身是个有风险的组件，所以先给它上门禁

新增 `src/app/react/core/swallowReport.ts`，三条硬约束：

1. **零 import** —— 要能在 renderer / worker / vm 任一上下文独立装载；
2. **自身永不抛错** —— 上报失败绝不能反过来影响业务；
3. **必须限流** —— 同 key 前 3 次真上报后只累加计数。
   理由：仓内有逐帧渲染路径上的 catch（GIF 逐帧绘制），无脑上报等于制造日志洪水。

配套 `tests/swallow-report.mjs`（11 断言）。**这里踩到一个值得记的坑**：

> 最初写的「日志通道抛错也不得外溢」用例是**假牙**——变异测试（把外层 try 删掉）后
> 10 个断言仍全绿。原因是 `emit` 与 `describe` 各自有内部 try，异常根本传不到外层。
> 补了一个在**外层保护之外**注入故障的用例（塞进一个会抛错的 `Map`，让 `counts.get()` 炸掉）才真正测到。
> 教训：**测「绝不抛错」这类性质时，故障点必须注入在被测的那层保护之外，否则测的是别人的保护。**

### 12.5 一次性清不完，所以做棘轮

538 处逐个改不现实，可持久的是**不再新增**：

- 门禁 `tests/empty-catch-gate.mjs`（`static`，已登记进套件）；
- 基线 `tests/fixtures/empty-catch-baseline.json`，按文件记录**未标注**空 catch 的数量上限；
- 新增空 catch 未写 `/* @swallow: 具体理由 */` 即判红；存量被修掉后基线只会更宽松。
- **自保断言**：扫描器若失效导致数量异常偏少（< 300），门禁判红而不是「空洞地绿」——
  否则哪天扫描器坏了，这个门禁会变成永远通过的摆设。

变异自证：注入未标注空 catch → 红；加 `@swallow` 标记 → 绿。

### 12.6 如实交代：没做完的部分

清单里仍标着「**待接线（遗留层）**」与「**待逐项裁决**」的，是**没有**满足「上报」要求的，
已逐条列出并写明理由，不伪装成已完成：

- `src/app/js/**`（`global.js` 路径/URL 族、`plugin/` 的 pinned 持久化与 metadata 读取）
  与 `src/my_modules/raw-parser/`：属**遗留非 ESM 全局脚本层**，无法 import React 侧模块。
  上报通道已挂 `globalThis.__eagleReportSwallowed`，但调用点尚未改造。
- `imageOpsService` / `itemMenuService` / `libraryDomain` / `preferences` / `store/*`：
  散落着若干「用户操作后无反应」的吞错，也混着可选读取，需逐处确认是否有后备路径后再定。

---

---

## 13. R2-3 · 部署根四处耦合点的**运行期**探针

### 13.1 验收报告点的是什么

`docs/audit-verification-2026-09-17.md` §R2-3：四处「解析根不一致」耦合点
（`preload-format-extension` / `library-default-icon` / `thumbnail-resolve-roots` /
`library-store-src-mapping`）**只有静态存在性断言，运行期探针覆盖为零**。

核对属实：`tests/isolated-deployment.mjs` 对这四条的判据是
`assertDeploymentLayout()` 里的 `path.join(部署根, …)` + `existsSync` —— 它证明的是
「**把路径拼出来时存在**」，不是「**运行期真的解析到了部署根里那一份**」。
`projectRoot = path.resolve(<backend/src>, '../..')`，若哪天被指回源工作区，静态断言照样绿。

### 13.2 怎么做

新增 `tests/deployment-root-runtime-probe.mjs`（只起后端、不起 Electron，约 30～60 秒）：

1. 按**同一份** `DEPLOYMENT_TREE` 构造部署根。为此把 `DEPLOYMENT_TREE` / `RUNTIME_ROOT_GAPS` / `copyTree`
   从 `isolated-deployment.mjs` 抽到 **`tests/deployment-root.mjs`**（单一事实源）——
   两份清单一旦漂移，「隔离门禁绿的布局」与「运行期探针绿的布局」就不是同一个东西。
2. 往部署根写**哨兵**：把默认库图标换成一张只有部署根才有的 1×1 PNG、在 `src/__probe__/`
   放哨兵缩略图与哨兵 `.library`。源工作区没有它们 ⇒ 解析根一漂移就是 404 或字节不符。
3. 在部署根里起真实后端进程，发真实 HTTP 请求；断言「吐回来的东西 == 部署根哨兵」。

四条各自的运行期入口与判据：

| # | 入口 | 判据 |
| --- | --- | --- |
| ① | `vm` 真实装载 `<部署根>/electron/preload.cjs`（桩 electron 桥、注入真实 `__dirname`），真实调用 `formatExtensionPreload()` | `ok:true` 且 `diskPath` == `<部署根>/src/app/js/plugin/api-format-extension.js` |
| ② | `GET /api/library/icon`、`GET /api/v2/library/icon` | 200 + `image/png` + 字节 == 哨兵 |
| ③ | 缩略图服务 `/file/<encoded>`：`/mock-library/...`（`roots[0]` 虚拟前缀）、部署根内绝对路径（白名单）、**部署根外绝对路径（必须拒收）** | 前两条 200 且字节 == 哨兵；越界那条必须 404 |
| ④ | `POST /api/library/switch { libraryPath: '/src/__probe__/DeployRootProbe.library' }` | 200 且 `data.path` == `<部署根>/src/__probe__/DeployRootProbe.library` |

实测结果：`4/4` 通过（`DEPLOY_ROOT_RUNTIME_PROBE_OK {"covered":"4/4",…}`）。

### 13.3 两条负向自证（都必须把脚本跑红）

| 模式 | 破坏 | 预期 |
| --- | --- | --- |
| `EAGLE_DEPLOY_PROBE_NEGATIVE=missing-src` | 把部署根 `src/` 段挪走 | 四条**全部**判红（任何一条还绿 ⇒ 它没真锚在部署根上） |
| `EAGLE_DEPLOY_PROBE_NEGATIVE=anchor-source` | 后端改在**源工作区**启动 | ②③④ 判红；**① 仍通过** |

`missing-src` 实测四条全红 ✅。`anchor-source` 实测：②③④ 红、① 绿 ✅——
这条自证同时说明 **① 与 ②③④ 的锚点性质不同**（`__dirname` vs `projectRoot`），不是同一类断言。

覆盖完整性另有一道断言：探针覆盖集合必须与 `RUNTIME_ROOT_GAPS` 登记集合**相等**，
多一条少一条都判红 ⇒ 将来新增第五处耦合点而探针没跟上，门禁立刻红。

### 13.4 顺带挖出一个休眠缺陷（未修，已按现状钉住）

③ 的 `/src/...` **虚拟前缀实际是死的**：`server.js:3269-3270` 对 `/src/X` 取 `slice(1)` 得 `src/X`，
再与 `roots[1] = <root>/src` 拼接 ⇒ 找的是 `<root>/src/src/X`，恒不命中（`roots[0]` 侧同理）。
推演（可复算）：

```
/src/app/x.png        -> <root>/frontend/public/src/app/x.png | <root>/src/src/app/x.png
/mock-library/a/b.png -> <root>/frontend/public/mock-library/a/b.png | <root>/src/mock-library/a/b.png
```

现网无调用方：缩略图 URL 由 `FileUrlHelper.getThumbnailUrl` 产成**库内绝对路径**
（`preload.cjs` 的 `thumbnailUrl` → `<thumbnailBase>/file/<encodeURIComponent(绝对路径)>`），
走的是 `server.js:3280` 的**白名单分支**（`roots` 在那里是 allowlist，不是前缀基）——所以缺陷休眠。

处置：**不改产品代码**（仍守 D34 口径），改两处文档——
`docs/deployment-layout.md` §4 的表格不再把 `/src/...` 写作 ③ 的解析目标；
`tests/deployment-root-runtime-probe.mjs` 的 `DORMANT_BRANCHES` 把**现状（404）钉住**，
行为一变就红（既防改坏没人知道，也防修好没人知道）。
若将来要修（把 `rel` 改成 `decoded.replace(/^\/src\//, '')`，或把 `roots[1]` 改成 `projectRoot`），
需**先确认调用方**，因为白名单分支同时依赖 `roots` 的现有取值。

### 13.5 这一批动过的文件

- 新增：`tests/deployment-root.mjs`（共享：部署清单 / 四处耦合点 / 构造过程）
- 新增：`tests/deployment-root-runtime-probe.mjs`（运行期探针，含两条负向自证）
- 改：`tests/isolated-deployment.mjs`——删掉本地 `DEPLOYMENT_TREE` / `RUNTIME_ROOT_GAPS` / `copyTree`，
  改为 import 共享模块。**已逐字比对**：三块内容与 `git show HEAD:` 的原文 `diff` 结果为空（`IDENTICAL`），
  仅去掉/加上 `export` 关键字。
- 改：`docs/deployment-layout.md`——门禁由一层变两层，新增 §7；§4 表格校正 ③。

### 13.6 仍未覆盖的

- `isolated-deployment.mjs` 本身（起完整生产栈 + Electron）在本环境跑不完（历史记录：15～22 分钟无结论），
  本次**未实跑**；本批对它的改动只做了「逐字等价」校验 + `node --check`。要确证需在有头终端跑一次。
- ① 仍不是「Electron 真的把 preload 装进 webview」——那是 R2-1（造真实插件 + M6-4 三处 webview 端到端）的活。
  本探针证明的是「preload 自己算出来的磁盘路径就是部署根里那一份」。


---

## 14. R2-1 探查结论：**结构性阻塞**，未做（待裁决）

验收原文：造一个真实可用的格式查看插件条目，把 M6-4 三处 `<webview>` 端到端跑通
（含 guest 内 preload 真实执行、加载失败、退出清理）。

本次把前置链路摸了一遍，得到三条结论，其中**两条改变了后续做法**。

### 14.1 环境结论（可复用）：Electron 整栈在本机是能跑的，真因是 GPU 进程，不是沙箱

此前记录（§8 附近的环境坑）写的是「凡走 CDP / 起 Vite+Electron 的测试，在沙箱内必报
`backend startup timeout`，必须在普通终端跑」。**这个结论不准确**。本次实测：

- 直接 `npx electron electron/main.cjs --smoke` 能起来（exit 0），但会打印
  `ERROR:gpu_process_host.cc(991) GPU process exited unexpectedly`，N 次之后
  `FATAL:gpu_data_manager_impl_private.cc(440) GPU process isn't usable. Goodbye.` 直接杀进程。
- 逐个试开关（`--disable-gpu` / `--use-gl=swiftshader` / `--in-process-gpu` /
  `--disable-gpu-sandbox --disable-gpu`）：**`--in-process-gpu` 有效**，GPU 报错归零。
- 复跑既有 `tests/document-viewer-ui-closed-loop.mjs`（照抄其启动方式，仅给 electron 多传一个
  `--in-process-gpu`）⇒ **`DOCUMENT_VIEWER_UI_CLOSED_LOOP_OK`**，全栈（backend + vite + Electron
  真实主窗 + `executeJavaScript` 驱动）跑通。

也就是说：卡住的是 **GPU 进程 FATAL**，不是沙箱。**结论要更新**——加 `--in-process-gpu`
（或 `--disable-gpu-sandbox --disable-gpu`）后，R2-5（L3 全量）这类「原本认为只能普通终端跑」的
批次，本机也能跑。单一 `--disable-gpu` **无效**，别再试它。

### 14.2 结构性阻塞：格式插件内核在 React 侧被**显式截获成 stub**

`src/app/react/core/shim/moduleRegistry.ts:322-324` 把 `/app/js/plugin` 登记进 `INTERCEPT_TABLE`，
`category: 'stub-plugin'`，理由写在文件头注释里：**原版 `src/app/js/plugin/index.js` 依赖 Angular
运行时，真实执行会抛错导致静默降级**，故一律返回 `browserRuntime.ts` 的假门面
（`__unavailable: true`、三个 map 全空、`getInspectorPluginURL: () => ''`、`hasInspectorPlugin: () => false`）。

后果（这是 R2-1 的真实阻塞）：

- 格式插件的扫描发生在**遗留层**（`src/app/js/plugin/index.js:1018` 扫 `<electron userData>/Plugins`，
  `registerPluginExtensions()` 填 `previewExtension` 各 map），这条路径在 React 应用里**根本不会执行**；
- 于是 `Inspector.tsx:935` 的 `hasInspectorPlugin(item)` 恒 false ⇒ 检查器那处 webview 永远不会创建；
  `DetailViewer` / `preview-window` 的插件分支同理取不到 `pluginViewerUrl`。

**所以「造一个真实插件」并不能让三处宿主跑起来**——缺的不是插件，是 **React 侧的插件装载实现**。
那是产品/架构决策（R3 级），不是测试任务，也不该由整改批次替用户决定。

### 14.3 底层链路（真实 webview + 真实 preload）本次未取得结论

退一步看「guest 内 preload 真实执行」这条最底下的机制能不能独立跑通：写了一次性探针
`outputs/_r21-webview-spike.cjs`（真实 Electron 窗口 + `<webview preload="file://…/api-format-extension.js">`，
等 guest `dom-ready` 后读 `window.eagle`）⇒ **40 秒内没等到 `dom-ready`**，未取得结论。
可能方向（未定位）：guest 未 attach / preload 在 guest 里抛错 / `file://` 宿主页限制。

### 14.4 建议的拆分（等用户裁决）

1. **要不要做 React 侧插件装载**（让 `/app/js/plugin` 从 stub 变成真实或受控替身）——这是 R2-1 的
   前置，属产品决策，不在整改批次内擅自决定。
2. 在此之前，R2-1 可交付的只有**「webview + preload 机制」的实机门禁**（不依赖插件内核）：
   先把 §14.3 那个探针的 timeout 定位掉，再把它做成 `--smoke-format-webview` + 测试，
   覆盖「preload 真实执行 / 加载失败 / 退出清理」三项。
3. R2-5（L3 全量）因 §14.1 的发现，可行性上升，可优先于 R2-1 推进。

**本次未做 R2-1，如实登记。**

按验收 R0-3 的口径：本报告结论只针对 §10 记录的 HEAD 这一状态；此后再有新增提交，需重新验收。
