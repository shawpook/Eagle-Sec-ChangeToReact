# Retired legacy files (2026-09-16)

本目录保存 **M7 各批退役对象**在移出可发布源码树之前的内容。归档是**纯文档**，
不属于应用构建链，也不属于交付闭包——它**只**承担两件事：

1. 留下「为什么退役」与「替代落点在哪」的台账；
2. 保留**可恢复**的回滚基线。

归档路径一律等于**退役前的源路径**（`docs/retired-2026-09-16/<原路径>`），
移动一律用 `git mv` 完成，故历史连续、可 `git revert`。

---

## M7-1（2026-09-16）—— 四项低风险退役

| Archived path | Retired source path | Replacement / rationale |
|---|---|---|
| `src/app/js/services/url-state-service.js` | `src/app/js/services/url-state-service.js` | `src/app/react/core/bundleGlobals.ts` installs the active `window.UrlStateService` implementation. |
| `src/build/config.gypi` | `src/build/config.gypi` | Generated node-gyp configuration; the current build uses Vite and has no consumer. |
| `src/test/api-v2/test-snippets.js` | `src/test/api-v2/test-snippets.js` | Manual DevTools console script; API coverage now lives in `tests/**` and the real server routes. Kept here for its endpoint inventory. |
| `src/app/main.js` | `src/app/main.js` | Empty legacy Webpack shell; the active entry is `src/app/react/main.tsx`. |

---

## M7-2（2026-09-16，F02 / F20 · 用户决策 D24）—— tab-bar 退出发布清单 + 旧宿主隔离归档

### 1. `frontend/public/tab-bar.{js,css}` —— **退役（删除发布路径，保留归档）**

| Archived path | Retired source path | Replacement / rationale |
|---|---|---|
| `frontend/public/tab-bar.js` | `frontend/public/tab-bar.js` | **无替代实现，也不需要**——该功能在生产中当前就是空的（旧实现无加载入口，React 侧从未实现）。全仓逐项复核 0 命中加载入口，详见下节「退役取证」。 |
| `frontend/public/tab-bar.css` | `frontend/public/tab-bar.css` | 同上；无任何 `<link>` / `@import` 加载点。 |

**退役取证（M7-2 当场复核，不是照抄审计结论）**。检索模式与结果（全部 0 命中于**加载点**）：

| 检索面 | 模式 | 结果 |
|---|---|---|
| 全仓文本 | `tab-bar` / `tab_bar` / `tabbar` / `tabBar` / `TabBar` / `eagle-tab-bar` | 仅命中**文档、归档、门禁文件自身**；无一是加载点 |
| 页面 | `src/app/index.html` 的 `<script>` | 仅 `:254` 一条 `<script type="module" src="/src/app/react/main.tsx">` |
| 页面 | 全仓 `<script src=…>` / `<link href=…>` | 0 命中 tab-bar |
| 模块 | ESM `import` / `require(` / `importScripts` / `new Worker` / `import.meta.glob` | 0 命中 |
| 构建 | `frontend/vite.preview.config.mjs` 全文、`rollupOptions.input` | 0 命中（该文件里**没有**任何 tab-bar 注入逻辑） |
| 运行期 | `src/app/react/core/bundleGlobals.ts` 的「fetch 文本 → createElement('script')」通道 | 只有 3 个目标：`/vendor/eagle-match-rules.js`、`/vendor/eagle-zoom-helpers.js`、`/vendor/eagle-ga4mp.js`，**不含 tab-bar** |
| 宿主/后端 | `electron/**`、`backend/**`、`scripts/**`、根 `package.json` | 0 命中 |
| 动态拼接 | `'tab' + '-bar'` 之类 | 0 命中；另用可执行扩展名全仓裸扫（排除 `docs/`、`tests/`）复核，0 命中 |

**失真注释已订正**：两文件原第 3 行都写「注入路径: …（由 `vite.preview.config.mjs` 注入）」，
而该注入逻辑早已不存在。订正写进了**归档副本**本身（并因此改变了归档指纹，见下），
台账与门禁同步登记。

**唯一消费者**：`tests/tab-bar-closed-loop.mjs`。它原先是一份**与实现脱钩的孤儿 e2e**
（未登记任何套件；自己不注入 tab-bar.js，断言必然 30s 超时）。M7-2 未删除它，而是
**改造为负向门禁**（文件名保留为历史沿革，文件头已注明）：

```sh
node tests/tab-bar-closed-loop.mjs   # 真实仓库 + 真实产物 + 负向自证，11 项
```

**归档指纹（冻结基线）**：

| 归档路径 | md5 |
|---|---|
| `docs/retired-2026-09-16/frontend/public/tab-bar.js` | `e36afeae6a484c7d0dd0273e26a16184` |
| `docs/retired-2026-09-16/frontend/public/tab-bar.css` | `da01f6cd42e55e3ad06292e02c6e9036` |

指纹由 `tests/tab-bar-closed-loop.mjs` 的 `RETIRED_SOURCE` 常量守着：改动归档而不更新
常量 = 门禁变红。这是有意的摩擦——归档是回滚基线，必须冻结。

### 2. `src/run.js` / `src/run.jsc` / `src/main.jsc` —— **隔离归档（不删除）**

| Archived path | Retired source path | Replacement / rationale |
|---|---|---|
| `src/run.js` | `src/run.js` | 旧宿主启动入口（`bytenode` 加载两个 `.jsc`）。替代 = `electron/main.cjs`，由 `scripts/start-production.mjs:123` 真实启动。 |
| `src/run.jsc` | `src/run.jsc` | `src/run.js:4` 加载的主进程字节码。**内容不可读**，按任务书 §4「字节码不执行、不反推内部零依赖」，只隔离、不删。 |
| `src/main.jsc` | `src/main.jsc` | `src/run.js:5` 加载的字节码，同上。 |

**隔离取证（M7-2 当场复核）**：根 `package.json` 全部脚本、`scripts/*.mjs`、
`electron/main.cjs`、`electron/preload.cjs` 中 `bytenode` / `.jsc` / `src/run` **0 命中**
（`electron/main.cjs:1627` 只有一条**注释**提到「原 run.jsc 承载」）。三者**不进产物**
（`src/` 根级文件不在 `frontend/vite.preview.config.mjs` 的任何复制清单内）。

**已知遗留缺口（M7-2 未处理，如实登记）**：`src/package.json:12` 的 `"main": "run.js"`
在本次移动后**已悬空**。M7-2 按任务书要求**不动** `src/package.json`（它的处置依赖
`plugin/index.js:2989` 的耦合，属后续批次）。

### 3. 归档处标记：**非支持入口**

`docs/retired-2026-09-16/` 下的**任何文件都不是支持入口**：

- 它们**不在**应用构建链、产物闭包、发布路径中；
- 它们**不会被**任何 npm 脚本、suite 或验收流程执行；
- 重新启用它们**不是**「恢复配置」，而是一次需要重新取证 + 补替代 + 补测试的改造。

---

## 回滚方式

任一项均可单独回滚，互不影响：

```sh
# ① 按路径回滚（推荐，可精确到单个对象）
git mv docs/retired-2026-09-16/src/run.js src/run.js
git mv docs/retired-2026-09-16/src/run.jsc src/run.jsc
git mv docs/retired-2026-09-16/src/main.jsc src/main.jsc

# tab-bar 两项同理；回滚后必须同步：
#   - 恢复 tests/frontend-gate-manifest.mjs 的 FIRST_PARTY_SCRIPTS 登记
#     （否则 tests/typecheck.mjs 会报「图外运行脚本未登记」）
#   - 更新 tests/tab-bar-closed-loop.mjs 的 RETIRED_SOURCE / 负向断言
#   - 复跑 npm run build && node tests/dist-entry-check.mjs

# ② 整批回滚
git revert <M7-2 commit>
```

> 注意：tab-bar 归档副本的**注释已被订正**（原文为失真注释），故其内容与退役前的
> `frontend/public/tab-bar.{js,css}` **不完全逐字相同**——差异仅在文件头注释。
> 这正是 M7-2 的有意动作（任务书要求订正失真注释），diff 可在 M7-2 提交中逐字核对。
