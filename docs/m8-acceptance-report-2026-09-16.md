# M8 最终验收报告（2026-09-16）

> 依据：`docs/plan-2026-09-15-full-workspace-legacy-audit.md` 的 M8「全工作区验收与重新发布收官口径」。
> 过程与决策台账在 `docs/project-state.md`（本文只记**结论、证据与已知缺口**）。
> 工作区：`H:/dev/Eagle-Sec-development - 副本`，分支 `react-in-place`。

---

## 1. 结论

**M0–M8 全部落地并通过验收。** 统一验收入口 `npm run test:acceptance` 的四段矩阵
（static / build / artifact / regression）在 `f82a05f2` 前的冻结提交上**全 PASS**：

```text
FRONTEND_ACCEPTANCE_ALL_GREEN
  PASS  static      5/5   frontend-gates-unit / typecheck / react-rewrite-sentinel / shim-module-boundaries / scope-field-convergence
  PASS  build       1/1   npm run build（17 条登记资源，无 skip(absent)，4/4 页面重定位）
  PASS  artifact    6/6   dist-entry-check / production-smoke / browser-extension-delivery
                          / start-production-readiness / production-runtime-ports / isolated-deployment
  PASS  regression  109   套件 102 项 ALL GREEN（OK 101 + retry-OK 1）+ 套件外 7 项全 PASS
```

第五段（`backend`，任务书明列的「选做」段）在本轮**已补跑**：
`tests/full-regression-isolated.mjs` 通过；后端业务链 `npm test` **47/47 全部 exit=0**。

**重要说明**：`.tmp/r7/acceptance-latest.json` 是**每次运行都会被覆盖**的单一文件；
本轮先跑四段（全绿）后又单独跑了 `--stages=backend`，故该 JSON 现只含 backend 段。
四段全绿那次的分段结果原文保留在运行日志里（见 §6 复现方式）。

---

## 2. 本轮修掉的既有缺陷（都是"既有红 → 绿"，不是本轮引入的回归）

| # | 缺陷 | 真因 | 影响面 | 提交 |
|---|---|---|---|---|
| 1 | `video-detail-mode-closed-loop` 确定性失败 | 夹具用 `MediaRecorder` 产 WebM，而它不写 `Info.Duration` ⇒ Chromium 恒报 `duration === Infinity`，被 `detailHooks.ts:357`（bundle 64843-65684 的**逐字移植**）判为不可播放而回退 MPV | 该闭环测试 | `2b475e81`（改夹具不改产品） |
| 2 | `/api/item/thumbnail` **自 2026-08-04 起对任何条目恒 404** | `server.js:2056` 调用了从未导入的 `ensureThumbnail`（`8cf92c55` 收窄 import 时漏改该调用点），`ReferenceError` 被该路由自己的 `catch` 吞成 404 | 工作台卡片图 | `35a874fb`（加回一个标识符） |
| 3 | 后端三个端点在含中文路径下**打死进程** | `fs.cpSync(recursive)` 在 **src 路径含任意非 ASCII 字符**时以 `0xC0000409` 无栈死亡（两格对照实测：仅 src 一侧触发） | `migrate` / `exportLibrary` / 备份恢复；并导致 `npm test` 在第 36/47 步断链、**后面 11 个测试从未执行** | `11820046` → `f82a05f2` |

第 2、3 两条都是**产品级缺陷**，不是夹具问题——第 2 条对所有用户生效，第 3 条对路径含中文的用户生效。

---

## 3. 验收矩阵对应关系（任务书 §M8）

| 矩阵项 | 覆盖手段 | 结果 |
|---|---|---|
| 类型（React UI / Worker / 扩展 / 跨进程协议） | `typecheck`（React 子树 0 诊断，整文件免检 **0**）+ `shim-module-boundaries` + `worker-protocol-contract` | ✅ |
| 静态（无 Angular 可执行分支 / 无未登记经典脚本 / 无未知能力静默成功） | `react-rewrite-sentinel` / `scope-field-convergence` / `module-registry-contract` / `runtime-services-contract` | ✅ |
| 构建（构建身份 / 入口资源闭包 / 复制失败负向测试） | `npm run build`（**登记驱动，复制失败即失败**）+ `dist-entry-check` + F23 的 19 条负向用例 | ✅ |
| 运行（浏览器演示/连接模式、Electron dev/prod、非默认端口） | `production-smoke` / `start-production-readiness` / `production-runtime-ports` / `isolated-deployment` | ✅ |
| 业务（导入 / 重命名 / 星标 / 旋转翻转落盘 / 跨窗 / 偏好 / 插件 / 扩展 / 各格式查看 / 连续网格） | 套件 102 项 + 套件外 7 项 + 后端链 47 项 | ✅ |
| 生命周期（重复开关 / 切库 / 卸载 / 取消任务 / 服务断线重连） | `m4-preview-dispose` / `m4-window-subscriptions` / `worker-cancel-writeback` / `library-switch-ui` / `library-crash-recovery` | ✅ |
| **最小隔离部署副本能完整启动，不读取源工作区** | `tests/isolated-deployment.mjs`（文件访问探针 + 四页非默认端口 + 布局断言） | ✅ 探针 violations 为空；部署根布局见 `docs/deployment-layout.md` |

---

## 4. 本轮新增/加固的门禁

| 门禁 | 守护什么 | 负向自证 |
|---|---|---|
| `plugin-format-preload` | 格式插件 preload 的唯一解析点，全输入域绝不产出 `http(s)` 值 | 3 项 |
| `webview-tag-enabled` | **真机**：三处 `<webview>` 真的 guest 化、preload 真的在 guest 内执行 | 移除 `webviewTag` → 0/4 |
| `publish-asset-manifest` | 发布资产登记驱动：清单与源码实扫对账；复制源缺失必须拒绝 | 删清单项 → 红 |
| `isolated-deployment` | 隔离部署：探针判「实际读了什么」；部署根布局；豁免表**反向校验**（登记了却没命中 ⇒ 红） | 探针禁用 / 删已登记产物 / 三次布局变异 |
| `video-fixture-duration` | WebM 夹具的 EBML Duration 注入器（字节级） | 恒等注入 → 6/6 红 |
| `workbench-thumbnail-placeholder` | 工作台缺图占位（不塌几何） | 摘 onError / 摘占位逻辑 |
| `item-thumbnail-endpoint` | 该端点必须 200 + 真图片字节 | 去掉 import → 红 |
| `backend-import-integrity` | **类别门禁**：调用了既无本地定义也无导入的标识符（后端此前**零覆盖**） | 精确报出 `server.js:2056:19` |
| `tab-bar-closed-loop` | M7-2 退役的负向门禁 | 8 项 |

套件从 91 项增至 **102 项**（`ARTIFACT_TESTS` 3 → 6），期间按 **D15/D28** 补登记了
**5 个长期不属任何套件的孤儿测试**（`preload-subscriptions` 之外新增
`f08f09-action-supply-contract` / `image-transform-closed-loop` / `source-mode-browse-closed-loop`
+ 本轮新建的三个）。

---

## 5. 如实登记的未验证项与已知缺口

> 按任务书「所有已知缺项归零或明确标为未支持」的要求逐条列出。**这些不是"待办清单"，是当前状态的诚实边界。**

### 5.1 未做实机/运行期验证

1. **M6-4 的三处 React 插件组件端到端未跑**（`DetailViewer` / `Inspector` / `preview-window/shell`）：
   本机没有已安装且可用的格式查看器插件条目。真机门禁 `webview-tag-enabled` 证明的是
   **webview 会 guest 化、M6-3 解析的 preload 会在 guest 内执行**，不等于"格式插件 UI 端到端可用"。
2. **M7-3 归档 48 项 `src/my_modules` 条目的 RAW/TIFF/UDOC 运行期样本未跑**：
   静态证据是"无消费者 + 保留清单有行号依据"，未做图像解码矩阵。
3. **部署根的四处耦合点只有静态布局断言，运行期探针覆盖为零**：
   preload 的磁盘判断只在格式插件 webview 建立时执行，`/api/library/icon` 与缩略图解析根
   不在四页导航路径上。依据是布局断言与 2054 文件逐一同构，**不是探针实测**。
4. **D14 的待证项**：Electron 下 `nativeRequire('http')` 是否可用，仍未取证；
   `http`/`https` 与 `JsonRestServer` 在 browser-connected 态保持**显式失败**是有意为之。

### 5.2 已登记但未修

5. **`screenshot-regression` 3/16 既有红**（`main` / `font` / `text-editor`）：
   W52 用 `git stash` 摘掉本批改动做过基线对照，逐条一致 ⇒ 与本轮无关。
6. **`thumbnail-task-closed-loop.mjs` 的 `freePort()` 撞 undici 端口黑名单**：
   既有 flaky（非本批引入），测试本体不在授权范围内故未修 ⇒
   "`npm test` 47/47"在别的机器/时刻仍可能抖动。
7. **`tests/run-attached-nonsuite.mjs:9` 的注释已过时**（它说该测试在本宿主崩于 cpSync，
   而 cpSync 已由 M8-7 替换），未改。
8. **`main-ui-workflow-closed-loop` 加载下的 IPC 超时**是已知低频抖动
   （首跑红、重跑绿，`inspector operation result timeout` / `reason: no-event`），未根治。
9. **D20 的 3 处 `(window as any)`**（`collect-window/controller.ts` 与 `preferences/entry.tsx`）
   与 **`demoSeed.ts` 的 `capturePollTimer` 声明了却从未赋值**：均已登记，未回退/未修。

### 5.3 环境前提

10. 本轮全部证据在**本机**取得（Windows 11 / Node v22.23.0 / Electron 22.3.7 / Edge 153）。
    MV3 扩展 e2e 依赖真实浏览器宿主（本机为 Edge），宿主不可用时该测试会打印
    `..._BLOCKED <原因>` 并以 0 退出——**环境缺失不得伪装成产品缺陷**，反之亦然。

---

## 6. 复现方式

```bash
# 四段矩阵（含构建与产物验收）
npm run test:acceptance          # 结果 JSON：.tmp/r7/acceptance-latest.json（每次覆盖，单文件）

# 选做段：后端隔离端口全量回归
node tests/frontend-acceptance.mjs --stages=backend

# 后端业务链
npm test                         # 47 步 && 链

# 覆盖面自查（不改任何东西）
node tests/frontend-acceptance.mjs --list
```

本轮四段全绿的**分段汇总原文**与各步原始输出：
`m8-final2.log`（四段）、`m8-backend.log`（backend 段）、`fri2.log`（隔离全量回归）。
这些日志在运行机的工作目录下，未入库。

---

## 7. 一句话收官口径

每个入口都有 owner、来源、构建方式与**通过的行为证据**；第三方引擎按行号保留必要边界；
旧框架代码要么有替代要么已隔离归档（`docs/retired-2026-09-16/`，含逐项回滚方式）；
未知能力一律**显式失败**而非静默成功；上述 10 条边界已逐条写明，**不以"页面能打开"代替闭环**。
