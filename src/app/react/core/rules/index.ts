/**
 * M3-1（批次 1）：`core/rules/` 统一出口。
 *
 * 本目录承接 `frontend/public/vendor/` 里两段**第一方**代码：
 *   · `eagle-match-rules.js` L33-1067 —— 26 个 `isMatch*Rule` + 工具函数
 *     （同文件 L1068-1084 是三个第三方小库，**不在迁移范围**，vendor 文件一字不改）；
 *   · `eagle-zoom-helpers.js` L1-135 —— 整份第一方。
 *
 * 本批只建模块 + 建等价性测试（`tests/match-rules-equivalence.mjs`），
 * **不改任何调用点**：`core/filterDomain.ts` 与 `services/detailService.ts`
 * 仍在读 `window.*` 的 vendor 供给。调用点切换属下一批。
 */
export * from './matchStringMethod';
export * from './matchRules';
export * from './matchRuleTable';
export * from './zoomHelpers';
