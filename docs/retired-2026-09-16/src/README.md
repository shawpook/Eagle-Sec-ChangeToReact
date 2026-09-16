# `src/` 归档子树 —— 非支持入口（NOT A SUPPORTED ENTRY POINT）

本目录保存 **退役前位于仓库 `src/` 下**的对象。归档路径 = 退役前的源路径，
即：`docs/retired-2026-09-16/src/<...>` ↔ 退役前 `src/<...>`。

> **本目录下的任何文件都不是支持入口。**
> 它们**不在**应用构建链、产物闭包与发布路径中；**不会**被任何 npm 脚本、suite
> 或验收流程执行。重新启用它们不是「恢复配置」，而是一次需要重新取证 + 补替代
> + 补测试的改造。

## 内容与批次

| 归档路径 | 退役批次 | 原路径 | 替代落点 |
|---|---|---|---|
| `src/main.jsc` | **M7-2** | `src/main.jsc` | `electron/main.cjs`（由 `scripts/start-production.mjs:123` 真实启动） |
| `src/run.jsc` | **M7-2** | `src/run.jsc` | 同上。**字节码内容不可读**，按任务书 §4「字节码不执行、不反推内部零依赖」只隔离、不删 |
| `src/run.js` | **M7-2** | `src/run.js` | 同上。原为旧宿主启动入口：`bytenode` 加载上面两个 `.jsc` |
| `src/app/js/services/url-state-service.js` | M7-1 | `src/app/js/services/url-state-service.js` | `src/app/react/core/bundleGlobals.ts` 安装现役 `window.UrlStateService` |
| `src/app/main.js` | M7-1 | `src/app/main.js` | `src/app/react/main.tsx`（`src/app/index.html:254` 唯一主窗入口） |
| `src/build/config.gypi` | M7-1 | `src/build/config.gypi` | 无（node-gyp 生成物，构建链已改 Vite） |
| `src/test/api-v2/test-snippets.js` | M7-1 | `src/test/api-v2/test-snippets.js` | `tests/**` 与 `backend/src/server.js` 的真实 API V2 路由 |

## M7-2：旧宿主隔离的边界声明

M7-2 把 `run.js` / `run.jsc` / `main.jsc` **移出**日常操作与发布路径，但**不删除**：

- **移出日常操作**：根 `package.json` 的全部脚本、`scripts/*.mjs`、`electron/main.cjs`
  对三者 **0 引用**（`bytenode` / `.jsc` / `src/run` 检索 0 命中；`electron/main.cjs:1627`
  只有一条注释提到「原 run.jsc 承载」）。故移动不改变任何现役行为。
- **保留可恢复**：用 `git mv` 移动，历史连续，内容零改动。

### 已知遗留缺口（未处理，如实登记）

- `src/package.json:12` 的 `"main": "run.js"` 在 `run.js` 移走后**已悬空**。
  M7-2 **未**处理 `src/package.json`——它的处置依赖 `src/app/js/plugin/index.js:2989`
  的 `require(appRoot + '/package.json')` 耦合（该 require 已被 M2-4 截获切断，
  但正式退役属后续批次）。
- 三者退出发布路径**不等于**「已从 git 删除」：它们仍在本归档中，且可一键回滚。

## 回滚

```sh
git mv docs/retired-2026-09-16/src/run.js  src/run.js
git mv docs/retired-2026-09-16/src/run.jsc src/run.jsc
git mv docs/retired-2026-09-16/src/main.jsc src/main.jsc
# 或整批：git revert <M7-2 commit>
```

回滚后 `src/package.json` 的 `"main": "run.js"` 重新指向真实文件，其余无需改动——
M7-2 **没有**触碰 `src/package.json`、`src/my_modules/**`，也没有触碰任何根启动链。

> 提示：**不要**为了「验证归档是否可用」而执行 `node src` 或 `electron .`。
> `.jsc` 是编译字节码，任务书 §4 明确「不冒险运行」。
