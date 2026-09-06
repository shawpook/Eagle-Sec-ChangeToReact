/**
 * b1-9bc：自研 utils（utils/func.ts + utils/lang.ts）单元测试——lodash 原生化的语义锁。
 * 纯 Node 运行（无 Electron）。语义对照 vendored lodash 4.x（src/app/js/vendors/lodash.js）。
 */
import { debounce, throttle } from '../src/app/react/utils/func.ts';
import { get, unescape, max, uniq, isString } from '../src/app/react/utils/lang.ts';

const failures = [];
const assert = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' — ' + JSON.stringify(detail)}`);
  if (!cond) failures.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── debounce：trailing edge，等待窗内最后一次调用胜出 ──
{
  let calls = [];
  const d = debounce((...a) => calls.push(a), 40);
  d(1); d(2); d(3);
  assert('debounce no sync fire', calls.length === 0, calls);
  await sleep(70);
  assert('debounce trailing once with last args', calls.length === 1 && calls[0][0] === 3, calls);
  // legacy 第三参（bundle 老签名）接受且不改变 trailing 语义
  calls = [];
  const d2 = debounce((...a) => calls.push(a), 30, true);
  d2('x');
  await sleep(60);
  assert('debounce legacy-third-arg trailing', calls.length === 1 && calls[0][0] === 'x', calls);
  // cancel
  calls = [];
  const d3 = debounce((...a) => calls.push(a), 20);
  d3('y'); d3.cancel();
  await sleep(50);
  assert('debounce cancel', calls.length === 0, calls);
}

// ── throttle：leading 立即 + 窗尾补发 + 窗外回到 leading ──
{
  let calls = [];
  const t = throttle((v) => calls.push(v), 60);
  t('first');
  assert('throttle leading immediate', calls.length === 1 && calls[0] === 'first', calls);
  t('a'); t('b');
  assert('throttle window suppressed', calls.length === 1, calls);
  await sleep(90);
  assert('throttle trailing once with last args', calls.length === 2 && calls[1] === 'b', calls);
  await sleep(80);
  t('after');
  assert('throttle leading after window', calls.length === 3 && calls[2] === 'after', calls);
}

// ── get：lodash 语义（末端 undefined → default；null 透传；中途断链 → default）──
{
  assert('get nested', get({ a: { b: { c: 7 } } }, 'a.b.c') === 7);
  assert('get default on missing', get({ a: {} }, 'a.b.c', 'D') === 'D');
  assert('get null passthrough (no default)', get({ a: { b: null } }, 'a.b', 'D') === null);
  assert('get broken chain -> default', get({ a: null }, 'a.b', 'D') === 'D');
  assert('get null root -> default', get(null, 'a', 'D') === 'D');
  assert('get falsy value passthrough', get({ a: 0 }, 'a', 'D') === 0);
}

// ── unescape：lodash 同款五实体 ──
{
  assert('unescape all entities', unescape('&amp;&lt;&gt;&quot;&#39;') === '&<>"\'');
  assert('unescape passthrough', unescape('a&b&#x1F600;') === 'a&b&#x1F600;');
}

// ── max / uniq / isString ──
{
  assert('max normal', max([3, 9, 2]) === 9);
  assert('max empty -> undefined', max([]) === undefined);
  assert('max skips NaN', Object.is(max([5, NaN, 3]), 5));
  assert('uniq keep order', JSON.stringify(uniq([3, 1, 3, 2, 1])) === '[3,1,2]');
  const refA = { x: 1 }, refB = { x: 2 };
  assert('uniq by reference', uniq([refA, refB, refA]).length === 2);
  assert('isString', isString('a') === true && isString(5) === false);
}

if (failures.length > 0) {
  console.log(`UTILS_NATIVE_FAIL ${failures.join(', ')}`);
  process.exit(1);
}
console.log('UTILS_NATIVE_OK');
