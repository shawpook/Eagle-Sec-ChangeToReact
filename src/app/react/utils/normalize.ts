/**
 * D-1 / Track B / B-1：rename 域纯工具（自 `core/dataMachinery.ts` 归位）。
 *
 * - `emojiRegex`：bundle 19014 顶层 const 同字面移植；**g 标志 lastIndex 状态跨调用共享**
 *   与 bundle 顶层单例同语义。
 * - `getRemainingFilenameLength` / `getSanitize`：惰性 require 缓存（bundle 为顶层即时，
 *   首次使用注册 —— 调用面语义相同）。
 * - `escapeRegex`：关键词/正则转义（bundle 内联 helper）。
 * - `pinyinCache`：tags 拼音缓存（原 controller 顶层 var）。
 *
 * 迁移批次：B-1（低耦合纯工具先行）。消费面仅 dataMachinery 内部（rename 域）。
 */

export const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([\*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu;

let remainingFilenameLengthCache: any = null;
export function getRemainingFilenameLength(): any {
  const w = window as any;
  if (!remainingFilenameLengthCache) {
    remainingFilenameLengthCache = w.require(w.appRoot.path + '/app/js/utils/remainingFilenameLength.js');
  }
  return remainingFilenameLengthCache;
}

let sanitizeCache: any = null;
export function getSanitize(): any {
  const w = window as any;
  if (!sanitizeCache) {
    sanitizeCache = w.require(w.appRoot + '/my_modules/sanitize-filename');
  }
  return sanitizeCache;
}

export function escapeRegex(str: any): any {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const pinyinCache: Record<string, string> = {};
