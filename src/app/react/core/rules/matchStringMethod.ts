/**
 * M3-1（批次 1）：`matchStringMethod` 字符串比较原语表。
 *
 * 来源：`frontend/public/vendor/eagle-match-rules.js` L4-31（原 bundle 8340-8368）。
 * vendor 文件头 L1-3 自述「本文件是 bundle 8369-9418 的提取副本，提取时把定义
 * matchStringMethod 的前导块切在了外面」——本模块就是把这被切出去的前导块补回模块图。
 *
 * 本批**不改调用点、不改 vendor 文件**：`frontend/public/vendor/**` 保持原样
 * （`tests/frontend-gate-manifest.mjs:152-153` 仍把它登记为第一方脚本，`:93-94`
 * 登记为产物必需资产）。新模块与 vendor 并存，并由
 * `tests/match-rules-equivalence.mjs` 对同一组输入逐项比对两者输出。
 */

/**
 * 比较原语签名。
 *
 * ⚠️ `value` **必须**允许 `undefined`，不能收窄成 `string`：调用侧（vendor L40/62/79/94/857）
 * 的提前返回条件是 `value == ''`，而 `undefined == ''` 为 **false** —— 也就是说
 * `undefined` 会真的传进原语里。例如 `isMatchNameRule({method:'uncontain'}, {name:'abc'})`
 * 走的是「value 为 undefined → 不提前返回 → `'abc'.indexOf(undefined) === -1` → true」，
 * 收窄成 string 会让这里变成 false，是实打实的行为漂移。
 */
export type MatchStringMethodFn = (name: string, value: string | undefined) => boolean;

/**
 * 表的值类型刻意带 `| undefined`：调用侧写的是 `if (matchStringMethod[method])`，
 * 用非空函数类型会触发 TS2774（「该条件恒为真，是否想调用它」），
 * 而 `| undefined` 既消掉该诊断、又如实描述了「未命中的 method 取到 undefined」这一事实。
 */
export const matchStringMethod: Record<string, MatchStringMethodFn | undefined> = {
  equal: function (name, value) {
    return name === value;
  },
  startWith: function (name, value) {
    var isStartWith = new RegExp(`^${value}`, 'i').test(name);
    return isStartWith;
  },
  endWith: function (name, value) {
    var isEndWith = new RegExp(`${value}$`, 'i').test(name);
    return isEndWith;
  },
  uncontain: function (name, value) {
    return name.indexOf(value as string) === -1;
  },
  contain: function (name, value) {
    return name.indexOf(value as string) !== -1;
  },
  empty: function (name, value) {
    return name === "";
  },
  'not-empty': function (name, value) {
    return name !== "";
  },
  regex: function (name, value) {
    try { return new RegExp(value as string, "g").test(name); }
    catch (err) { return false; }
  },
};
