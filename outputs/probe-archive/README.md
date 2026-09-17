# 一次性诊断脚本归档（R4-1，2026-09-17）

本目录收录原先散落在 `tests/` 下的 **18 个一次性诊断脚本**（`probe-*.mjs` 15 个
+ `react-probe.mjs` / `react-electron-probe.mjs` / `sidebar-probe.mjs`）。

## 为什么移出 `tests/`

验收报告 §3.8：这些脚本**不属任何套件、不被任何 runner 引用、也不会再跑**，
却持续污染「测试目录里有什么」的判断——每次做孤儿测试扫描都得先手动排除它们，
而且名字像测试、身份不是测试，容易被误当成覆盖率的一部分。

**注意：它们是 `git mv` 过来的，没有删除，历史保留。**

## 状态

| 项 | 说明 |
|---|---|
| 是否还跑 | 不跑。它们是为特定缺陷的一次性取证写的（如 `probe-b19d-*` 系列用于 b1-9bd 批次） |
| 是否还能跑 | **不保证**。脚本内的路径/端口/夹具多与当时的临时环境绑定，重跑大概率报错 |
| 与门禁的关系 | 零关系。它们从不被 `run-react-suite` / `frontend-acceptance` / `npm test` 引用 |

## 仍被文档提到的两个

- `probe-detail-gate-reachability.mjs`：`docs/e5-5-shims-retirement-plan.md:67`、
  `src/app/react/PROGRESS.md` 记录了它当时的实跑结论——那是历史记录，路径保持原文，
  实际文件已移至本目录。
- `probe-filter-toggle.mjs`：`src/app/react/PROGRESS.md` 同上。

## 想再写一次性探针时

请直接写到本目录（或 `outputs/`），**不要**再放进 `tests/`；
真要成为回归，就按 `tests/react-suite-manifest.mjs` 的口径登记进套件
——否则就会重演「测试目录里的孤儿脚本」这条债务（验收 §3.4 第 4 起回归即源于此）。
