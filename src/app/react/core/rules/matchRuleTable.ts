/**
 * M3-1（批次 1）：智能筛选的 `property → 规则函数` 表。
 *
 * 来源：`src/app/react/core/filterDomain.ts:1140-1171` 的 `getMatchFunctionTable()`
 * （该表原本逐项读 `window.isMatch*Rule`，即 vendor 注入的全局）。
 *
 * 本批**不切换调用点**——`filterDomain.ts` 一个字符都不动。本模块先与 vendor 并存，
 * 由 `tests/match-rules-equivalence.mjs` 锁死「表键集合与函数映射逐项等价」。
 *
 * 与 `getMatchFunctionTable()` 的差异（**批次 2 才生效**）：原实现每次调用重建、
 * 且每项都是一次 `window` 属性读，于是存在 b1-9m 记载的「vendor 注入晚于首次取表时，
 * 表内 `isMatch*Rule` 为 `undefined` 且永不自愈」；本模块的每个值都是**模块求值期
 * 就已绑定的 ESM 导入**，结构上不存在该中间态。
 * 保留「每次调用返回新对象」的外形，让批次 2 的替换保持逐项同构。
 */
import * as R from './matchRules';
import type { MatchRuleFn } from './matchRules';

export function getMatchRuleTable(): Record<string, MatchRuleFn> {
  return {
    name: R.isMatchNameRule,
    folderName: R.isMatchFolderNameRule,
    url: R.isMatchUrlRule,
    annotation: R.isMatchAnnotationRule,
    comments: R.isMatchCommentsRule,
    width: R.isMatchWidthRule,
    height: R.isMatchHeightRule,
    fileSize: R.isMatchFileSizeRule,
    createTime: R.isMatchTimeRule,
    mtime: R.isMatchMTimeRule,
    btime: R.isMatchBTimeRule,
    tags: R.isMatchTagsRule,
    rating: R.isMatchRatingRule,
    folders: R.isMatchFoldersRule,
    type: R.isMatchTypeRule,
    shape: R.isMatchShapeRule,
    color: R.isMatchColorRule,
    duration: R.isMatchDurationRule,
    bpm: R.isMatchBPMRule,
    camera: R.isMatchCameraRule,
    iso: R.isMatchISORule,
    aperture: R.isMatchApertureRule,
    focalLength: R.isMatchFocalLengthRule,
    shutter: R.isMatchShutterRule,
    timestamp: R.isMatchTimestampRule,
    fontActivated: R.isMatchFontActivatedRule,
  };
}
