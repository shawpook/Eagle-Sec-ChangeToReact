/**
 * b1-9bc：自研基础工具——替代 lodash 的 get/unescape/max/uniq/isString
 * （vendor lodash.js 退役路径）。语义逐一对齐 vendored lodash 4.x。
 */

/** 点路径安全取值；**中途断链与末端 undefined 均回落 defaultValue，仅末端 null 原样
 *  透传**（lodash baseGet 语义——断链归一为 undefined 后统一走 default 判断）。 */
export function get(obj: any, path: string, defaultValue?: any): any {
  let result = obj;
  for (const key of path.split('.')) {
    if (result == null) {
      result = undefined;
      break;
    }
    result = result[key];
  }
  return result === undefined ? defaultValue : result;
}

const UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** HTML 实体反转义（lodash unescape 同款实体集）。 */
export function unescape(str: any): string {
  return String(str ?? '').replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => UNESCAPE_MAP[m]);
}

/** 数组最大值；空数组/全 NaN/null 返回 undefined（lodash max 语义——勿用 Math.max，空集为 -Infinity 且 NaN 会毒化）。 */
export function max<T>(arr: ArrayLike<T> | null | undefined): T | undefined {
  let result: T | undefined;
  if (!arr) return result;
  for (const value of Array.from(arr as ArrayLike<T>)) {
    if (value != null && value === value && (result === undefined || (value as any) > (result as any))) {
      result = value;
    }
  }
  return result;
}

/** 去重（首次出现序；SameValueZero 与 lodash/幂等 Set 一致）。 */
export function uniq<T>(arr: ArrayLike<T> | null | undefined): T[] {
  if (!arr) return [];
  return Array.from(new Set(Array.from(arr)));
}

export function isString(value: any): value is string {
  return typeof value === 'string';
}

/** jQuery `$.isNumeric`（1.8 实现：`!isNaN(parseFloat(obj)) && isFinite(obj)`）——
 *  数值与数字字符串为真，`''`/null/undefined/布尔/Infinity/NaN 为假。 */
export function isNumeric(obj: any): boolean {
  return !isNaN(parseFloat(obj)) && isFinite(obj);
}
