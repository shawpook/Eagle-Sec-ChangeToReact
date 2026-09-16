/**
 * M3-1（批次 1）：`frontend/public/vendor/**` 两段第一方代码
 * → `src/app/react/core/rules/**` 具名 ESM 模块的**逐项等价性**测试。
 *
 * ── 为什么是「与 vendor 对跑」，而不是「自己算一遍再断言自己」──
 * 本测试唯一的 oracle 是 **vendor 文件本身**：同一组输入分别喂给
 *   (a) 在 `vm` 里按**经典脚本**装载的 `eagle-match-rules.js` / `eagle-zoom-helpers.js`；与
 *   (b) 在**同一上下文**里按 CJS 装载的**真实 TS 模块** `src/app/react/core/rules/*.ts`，
 * 再逐项比对返回值（`Object.is` 语义，区分 `false` / `0` / `''`）以及异常的名字与消息。
 * 任何一侧的转写错误都会让两侧分叉；测试作者写错的期望值不会影响判定 —— 因为没有期望值。
 *
 * ── 覆盖 ──
 *  1. `getMatchFunctionTable()`（`core/filterDomain.ts:1140-1171`）的**键集合与顺序**
 *     及其 `key → w.isMatchXxxRule` 映射：先对源码文本取证，再对 `getMatchRuleTable()` 断言；
 *  2. 26 个 `isMatch*Rule` 的**逐条具名真/假样例**；
 *  3. 26 个规则 ×（method × value × image）的**确定性伪随机扫描**（每条数百组），
 *     覆盖未知 method、缺字段、类型错位、`__proto__` 键名等 vendor 未加防护的路径；
 *  4. `matchStringMethod` 8 个原语的全方法扫描；
 *  5. 工具函数 `intersect` / `hexToRGB` / `rgbToHex` / `colorSimilarityDistance`；
 *  6. `zoomHelpers` 的 4 个导出全枚举（`devicesMetrics` 94 项深比对、`isMobileWidth` 0..1200 全扫）；
 *  7. 驱动面 `__eagleDriver` / `$bodyScope` 三分支；
 *  8. 全局缺席时两侧**同为 ReferenceError，且消息一致**。
 *
 * ── 载荷注入（不是替身，是真实依赖）──
 * `window.require` 只放行 `color-convert` / `delta-e`（真实 npm 包）；`VIDEO_TYPES` /
 * `AUDIO_TYPES` / `FONT_TYPES` 按 `core/bundleGlobals.ts:1444-1454` 的构建方式（EagleConfig
 * 格式表 → `{ext: true}`）造，`installedFonts` 按 `:2299-2302` 的形态造。
 *
 * 未登记依赖会被 vm 的 require 闸门直接断言失败，避免「测到替身而不是被测代码」。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const VENDOR_MATCH = 'frontend/public/vendor/eagle-match-rules.js';
const VENDOR_ZOOM = 'frontend/public/vendor/eagle-zoom-helpers.js';
const FILTER_DOMAIN = 'src/app/react/core/filterDomain.ts';
const RULES_DIR = 'src/app/react/core/rules';

const repoRequire = createRequire(new URL('../package.json', import.meta.url));
const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const quietConsole = { log() {}, warn() {}, error() {}, info() {} };

/** vendor 只允许 require 这两个包；其它一律断言失败（防「测到替身」）。 */
const ALLOWED_VENDOR_REQUIRES = new Set(['color-convert', 'delta-e']);

// ───────────────────────── 沙箱 ─────────────────────────

/**
 * 建一个 vm 上下文，并把 `window` 指到全局自身 —— 于是 vendor 的顶层
 * `function isMatchXxx` 声明与 `var matchStringMethod` 都落在 `window` 上，
 * 恰好复刻浏览器里「经典脚本 + 全局对象」的供给关系，也让新模块的
 * `window[...]` 调用期读取落到同一处。
 */
function makeContext() {
  const sandbox = {
    console: quietConsole,
    require(name) {
      assert.ok(ALLOWED_VENDOR_REQUIRES.has(name), `禁止加载未登记的依赖：${name}`);
      return repoRequire(name);
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext('globalThis.window = globalThis; globalThis.self = globalThis;', context);
  return { context, sandbox };
}

/** 按 `bundleGlobals.ts:1444-1454` 的方式（格式表 → `{ext: true}`）造类型表。 */
function typeTable(exts) {
  const table = {};
  for (const ext of exts) table[ext] = true;
  return table;
}

const VIDEO_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv'];
const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
const FONT_FORMATS = ['ttf', 'otf', 'woff', 'woff2', 'ttc'];
const INSTALLED_FONTS = { 'HelveticaNeue_.otf': true, 'Roboto-Regular_.ttf': true };

/** 注入「bundle 全局」供给。`omit` 里的名字刻意不注入，用于验证缺席路径。 */
function installBundleGlobals(sandbox, omit = []) {
  const supply = {
    VIDEO_TYPES: typeTable(VIDEO_FORMATS),
    AUDIO_TYPES: typeTable(AUDIO_FORMATS),
    FONT_TYPES: typeTable(FONT_FORMATS),
    installedFonts: Object.assign({}, INSTALLED_FONTS),
  };
  for (const [name, value] of Object.entries(supply)) {
    if (omit.includes(name)) delete sandbox[name];
    else sandbox[name] = value;
  }
}

/** 真实 TS 模块 → CJS → 在给定上下文里装载（相对 import 递归解析，缓存按路径去重）。 */
function loadTsModules(context, entryRels) {
  const cache = new Map();
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const { outputText, diagnostics } = ts.transpileModule(read(rel), {
      fileName: rel,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    assert.equal(diagnostics.length, 0, `${rel} 转译应无诊断`);
    const exports = {};
    cache.set(rel, exports);
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    const run = vm.compileFunction(outputText, ['exports', 'module', 'require'], {
      parsingContext: context,
      filename: rel,
    });
    run(exports, { exports }, (name) => {
      assert.ok(name.startsWith('./'), `${rel} 不得引入非相对依赖：${name}`);
      return load(`${dir}/${name.slice(2)}.ts`);
    });
    return exports;
  }
  return entryRels.map((rel) => load(rel));
}

// ───────────────────── 跨 realm 的可比化 ─────────────────────

/**
 * 把返回值折成**同 realm 内可字符串比对**的规范形。跨 realm 的数组/对象原型不同，
 * `assert.deepEqual` 会误判，故手工展开；`Object.is` 语义在这里被显式保住
 * （`NaN` / `-0` / `undefined` / `false` 各有独立记号，不会与 `0` / `''` 混淆）。
 */
function norm(value, depth = 0) {
  if (depth > 6) return 'deep';
  if (value === undefined) return 'undef';
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number') {
    if (Number.isNaN(value)) return 'num:nan';
    if (Object.is(value, -0)) return 'num:-0';
    return `num:${value}`;
  }
  if (t === 'boolean') return `bool:${value}`;
  if (t === 'string') return `str:${value}`;
  if (t === 'function') return 'fn';
  if (Array.isArray(value)) return `arr:[${value.map((v) => norm(v, depth + 1)).join(',')}]`;
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    return `obj:{${keys.map((k) => `${k}:${norm(value[k], depth + 1)}`).join(',')}}`;
  }
  return `${t}:${String(value)}`;
}

/** 跑一次调用，把「返回值」与「抛出的异常」折成同一个可比空间。 */
function outcome(fn, args) {
  try {
    return `ret ${norm(fn(...args))}`;
  } catch (err) {
    const name = err && err.name ? err.name : 'Error';
    const message = err && err.message ? err.message : String(err);
    return `throw ${name}: ${message}`;
  }
}

// ───────────────────── 装载被测双方 ─────────────────────

/**
 * 一次性把「vendor 经典脚本 + 新 ESM 模块 + 同一份 bundle 全局供给」装进同一上下文。
 * 两侧共享 `window`，因此驱动面（`__eagleDriver` / `$bodyScope`）的改动对双方同时可见。
 */
function loadMatchRules() {
  const { context, sandbox } = makeContext();
  installBundleGlobals(sandbox);
  vm.runInContext(read(VENDOR_MATCH), context, { filename: VENDOR_MATCH });
  const [matchStringMethodMod, matchRulesMod, matchRuleTableMod, indexMod] = loadTsModules(context, [
    `${RULES_DIR}/matchStringMethod.ts`,
    `${RULES_DIR}/matchRules.ts`,
    `${RULES_DIR}/matchRuleTable.ts`,
    `${RULES_DIR}/index.ts`,
  ]);
  return { context, sandbox, matchStringMethodMod, matchRulesMod, matchRuleTableMod, indexMod };
}

function loadZoomHelpers() {
  const { context, sandbox } = makeContext();
  vm.runInContext(read(VENDOR_ZOOM), context, { filename: VENDOR_ZOOM });
  const [zoomMod] = loadTsModules(context, [`${RULES_DIR}/zoomHelpers.ts`]);
  return { context, sandbox, zoomMod };
}

// ───────────────────── 表结构：以 filterDomain 源码为凭 ─────────────────────

/**
 * 从 `getMatchFunctionTable()` 的**源码文本**里抽出 `key → vendor 全局名`。
 * 这是本批的契约面：表键集合、顺序、以及每个键指向哪个 vendor 全局。
 */
function parseFilterDomainTable() {
  const src = read(FILTER_DOMAIN);
  const start = src.indexOf('function getMatchFunctionTable(');
  assert.ok(start >= 0, `未在 ${FILTER_DOMAIN} 找到 getMatchFunctionTable`);
  const end = src.indexOf('\n}', start);
  assert.ok(end > start, 'getMatchFunctionTable 未闭合');
  const body = src.slice(start, end);
  const pairs = [];
  const re = /^\s*["']?([A-Za-z]\w*)["']?\s*:\s*w\.(isMatch\w+)\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) pairs.push([m[1], m[2]]);
  return pairs;
}

// ───────────────────── 输入样本 ─────────────────────

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;
/** 固定时刻：2023-11-14T22:13:20Z。避免 `toDateString()` 随运行日漂移。 */
const T0 = 1700000000000;
const T1 = T0 + 3 * DAY;

const IMAGES = {
  empty: {},
  undef: undefined,
  photo: {
    name: 'Beach Sunset.JPG',
    url: 'file:///library/Beach%20Sunset.JPG',
    ext: 'jpg',
    width: 1920,
    height: 1080,
    size: 2411724,
    modificationTime: T0,
    mtime: T1,
    btime: T0 - DAY,
  },
  rich: {
    name: 'portrait.png',
    url: 'file:///library/portrait.png',
    ext: 'png',
    annotation: 'Sunset over the bay',
    width: 800,
    height: 1200,
    size: 512000,
    tags: ['travel', 'sunset'],
    folders: ['f-root', 'f-travel'],
    comments: [{ annotation: 'first note' }, { annotation: 'second note' }],
    star: 3,
    modificationTime: T0,
    medium: 'youtube',
  },
  video: { name: 'clip@2x.mp4', ext: 'mp4', width: 640, height: 640, duration: 125.5, bpm: 128, size: 10485760 },
  font: { name: 'HelveticaNeue.otf', ext: 'otf', fontMetas: { postScriptName: { 0: 'HelveticaNeue' } } },
  raw: {
    name: 'raw.dng',
    ext: 'dng',
    rawMetas: {
      camera: 'Canon EOS R5',
      isoSpeed: 'ISO 400',
      aperture: 'f/1.8',
      focalLength: '50mm',
      shutter: '1/250 sec',
      timestamp: '2023-11-14T22:13:20Z',
    },
  },
  palette: { name: 'red.jpg', ext: 'jpg', palettes: [{ ratio: 45, color: [255, 0, 0] }, { ratio: 40, color: [0, 0, 0] }] },
  gray: { name: 'gray.jpg', ext: 'jpg', palettes: [{ ratio: 0.5, color: [100, 100, 100] }] },
  empties: { name: '', url: '', annotation: '', tags: [], folders: [], comments: [], palettes: [], ext: '' },
  zeros: { name: 'z', width: 0, height: 0, size: 0, duration: 0, bpm: 0, star: 0, modificationTime: 0 },
  square: { name: 'sq.jpg', ext: 'jpg', width: 500, height: 500 },
  pano: { name: 'pano.jpg', ext: 'jpg', width: 3000, height: 600 },
};

const SWEEP_IMAGES = Object.values(IMAGES);

const SWEEP_METHODS = [
  '=', '>=', '<=', '>', '<', 'between',
  'equal', 'unequal', 'contain', 'uncontain', 'startWith', 'endWith', 'empty', 'not-empty', 'regex',
  'intersection', 'union', 'identity',
  'on', 'before', 'after', 'within',
  'activate', 'deactivate',
  'accuracy', 'grayscale', 'custom', 'videos', 'video', 'audio', 'font', 'url', 'youtube',
  undefined, '', 'nope',
];

const SWEEP_VALUES = [
  undefined, null, '', 'abc', 'ABC', 'a.c', '[', '12', '__proto__',
  0, 5, -1, 3.5, NaN,
  ['travel', 'sunset'], ['x'], [0, 5], [1, '2023-11-14'],
  '#FF0000', '#000000', 'custom',
];

const SWEEP_RULES_EXTRA = [
  { method: 'custom', value: 'custom', width: 500, height: 500 },
  { method: 'custom', value: 'custom', width: 1, height: 2 },
  { method: 'equal', value: 'custom' },
];

/** 确定性 PRNG（mulberry32）——扫描必须可复现，不能用 Math.random。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 从笛卡尔积里确定性抽取至多 `count` 组（跨三轴散开，不做顺序截断）。 */
function sampleProduct(methods, values, images, rules, count) {
  const total = methods.length * values.length * images.length + rules.length * images.length;
  const out = [];
  if (total <= count) {
    for (const m of methods) for (const v of values) for (const im of images) out.push([{ method: m, value: v }, im]);
    for (const r of rules) for (const im of images) out.push([r, im]);
    return out;
  }
  const rand = mulberry32(0x5eed_1234);
  const seen = new Set();
  for (let guard = 0; out.length < count && guard < count * 40; guard++) {
    const [rule, image] =
      rand() < 0.85
        ? [{ method: methods[(rand() * methods.length) | 0], value: values[(rand() * values.length) | 0] }, images[(rand() * images.length) | 0]]
        : [rules[(rand() * rules.length) | 0], images[(rand() * images.length) | 0]];
    const key = `${JSON.stringify(rule)}|${JSON.stringify(image)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([rule, image]);
  }
  return out;
}

// ───────────────────── 比对器 ─────────────────────

/**
 * 比对器：把每一处分叉累积下来而不是首错即停 —— 一次运行就能看到**全部**差异，
 * 便于定位是整体性转写错误还是个别分支。最后一次性断言。
 */
function makeComparator(label) {
  const mismatches = [];
  let compared = 0;
  return {
    /** 两侧调用同一签名、同一参数，逐项比对（含异常）。返回两侧的规范化结果。 */
    compare(callLabel, vendorFn, newFn, args) {
      compared++;
      const vendorOut = outcome(vendorFn, args);
      const newOut = outcome(newFn, args);
      if (vendorOut !== newOut) {
        mismatches.push(
          `${label} ${callLabel}\n    rule  = ${JSON.stringify(args[0])}\n    image = ${safeJson(args[1])}\n    vendor= ${vendorOut}\n    new   = ${newOut}`,
        );
      }
      return { vendorOut, newOut };
    },
    /** 两侧调用并直接比对返回值（非函数场景，如 `devicesMetrics`）。 */
    compareValue(callLabel, vendorValue, newValue) {
      compared++;
      const a = norm(vendorValue);
      const b = norm(newValue);
      if (a !== b) mismatches.push(`${label} ${callLabel}\n    vendor= ${a}\n    new   = ${b}`);
    },
    finish() {
      assert.equal(
        mismatches.length,
        0,
        `${label}：${compared} 组比对中 ${mismatches.length} 组分叉\n\n${mismatches.slice(0, 40).join('\n\n')}${
          mismatches.length > 40 ? `\n\n…（另有 ${mismatches.length - 40} 处未列出）` : ''
        }`,
      );
      return compared;
    },
  };
}

function safeJson(value) {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '<unserializable>';
  }
}

/** 驱动面：`__eagleDriver` 优先于 `$bodyScope`，两者都缺时为 null（vendor L56-58）。 */
const DRIVER_STATES = [
  ['no-driver', () => ({})],
  [
    '__eagleDriver',
    () => ({
      __eagleDriver: {
        folderMappings: {
          'f-root': { name: 'Library Root' },
          'f-travel': { name: 'Travel 2024' },
          'f-null': null,
          'f-noname': {},
        },
      },
    }),
  ],
  [
    '$bodyScope',
    () => ({
      $bodyScope: {
        folderMappings: {
          'f-root': { name: 'SCOPE ROOT' },
          'f-travel': { name: 'SCOPE TRAVEL' },
        },
      },
    }),
  ],
  [
    '__eagleDriver wins over $bodyScope',
    () => ({
      __eagleDriver: { folderMappings: { 'f-root': { name: 'DRIVER ROOT' } } },
      $bodyScope: { folderMappings: { 'f-root': { name: 'SCOPE ROOT' } } },
    }),
  ],
  ['empty scope', () => ({ $bodyScope: {} })],
];

function applyDriver(sandbox, driver) {
  delete sandbox.__eagleDriver;
  delete sandbox.$bodyScope;
  Object.assign(sandbox, driver);
}

// ═══════════════════════════ 测试 ═══════════════════════════

test('M3-1 等价性：vendor 与 core/rules/* 在同组输入下逐项一致', async (t) => {
  const { sandbox, matchStringMethodMod, matchRulesMod, matchRuleTableMod, indexMod } = loadMatchRules();
  const win = sandbox;
  const table = matchRuleTableMod.getMatchRuleTable();

  // ───────────────── 1. 表结构 ─────────────────

  await t.test('表结构：filterDomain 源码的键集合/顺序/映射 == getMatchRuleTable()', () => {
    const pairs = parseFilterDomainTable();
    assert.equal(pairs.length, 26, `筛选表应恰有 26 项，实得 ${pairs.length}`);

    const keys = pairs.map(([k]) => k);
    assert.equal(new Set(keys).size, 26, '表键应互不重复');
    assert.deepEqual(Object.keys(table), keys, 'getMatchRuleTable() 的键与顺序应与 getMatchFunctionTable() 一致');

    for (const [key, vendorName] of pairs) {
      assert.equal(typeof win[vendorName], 'function', `vendor 应供给 ${vendorName}`);
      assert.equal(typeof table[key], 'function', `getMatchRuleTable().${key} 应是函数`);
      assert.equal(
        table[key],
        matchRulesMod[vendorName],
        `表项 ${key} 应直接引用新模块的 ${vendorName}（而非再次包装）`,
      );
    }
    // 反向：新模块导出的每个 isMatch*Rule 都必须在表里有归宿（防漏搬/多搬）
    const exportedRuleNames = Object.keys(matchRulesMod).filter((n) => /^isMatch\w+Rule$/.test(n));
    assert.deepEqual(
      exportedRuleNames.map((n) => n).sort(),
      pairs.map(([, v]) => v).sort(),
      'matchRules.ts 导出的 isMatch*Rule 集合应与筛选表引用的 vendor 全局集合完全一致',
    );
  });

  await t.test('barrel（index.ts）与各模块的具名导出一致', () => {
    for (const name of Object.keys(matchRulesMod)) {
      assert.equal(indexMod[name], matchRulesMod[name], `index.ts 应再导出 matchRules.${name}`);
    }
    for (const name of Object.keys(matchStringMethodMod)) {
      assert.equal(indexMod[name], matchStringMethodMod[name], `index.ts 应再导出 matchStringMethod.${name}`);
    }
    assert.equal(typeof indexMod.getMatchRuleTable, 'function', 'index.ts 应再导出 getMatchRuleTable');
  });

  // ───────────────── 2. 26 个规则的具名真/假样例 ─────────────────

  await t.test('26 个规则的具名真/假样例', () => {
    // ⚠️ 「锚点判别样例」：`startWith` / `endWith` 的锚点（`^` / `$`）只有在
    // **待匹配子串出现在中间** 时才可观测。只给「出现在开头/结尾」的样例，
    // 一个丢掉锚点的实现照样全过 —— 下面每条字符串规则都配了中间态样例。
    const cases = [
      // name
      ['name', { method: 'equal', value: 'beach sunset.jpg' }, IMAGES.photo],
      ['name', { method: 'equal', value: 'Beach Sunset.JPG' }, IMAGES.photo],
      ['name', { method: 'startWith', value: 'beach' }, IMAGES.photo],
      ['name', { method: 'startWith', value: 'sunset' }, IMAGES.photo],
      ['name', { method: 'endWith', value: '.jpg' }, IMAGES.photo],
      ['name', { method: 'endWith', value: 'sunset' }, IMAGES.photo],
      ['name', { method: 'contain', value: 'sunset' }, IMAGES.photo],
      ['name', { method: 'uncontain', value: 'sunset' }, IMAGES.photo],
      ['name', { method: 'uncontain', value: 'mountain' }, IMAGES.photo],
      ['name', { method: 'empty' }, IMAGES.empties],
      ['name', { method: 'not-empty' }, IMAGES.empties],
      ['name', { method: 'not-empty' }, IMAGES.photo],
      ['name', { method: 'regex', value: '^beach.*\\.jpg$' }, IMAGES.photo],
      ['name', { method: 'regex', value: '[' }, IMAGES.photo],
      ['name', { method: 'equal', value: '' }, IMAGES.photo],
      ['name', { method: 'equal' }, IMAGES.photo],
      // folderName（依赖驱动面，见第 7 节的三分支；这里只跑无驱动面的默认态）
      ['folderName', { method: 'equal', value: 'library root' }, IMAGES.rich],
      ['folderName', { method: 'not-empty' }, IMAGES.rich],
      ['folderName', { method: 'empty' }, IMAGES.empties],
      ['folderName', { method: 'equal', value: 'x' }, IMAGES.empty],
      // url
      ['url', { method: 'contain', value: 'library' }, IMAGES.photo],
      ['url', { method: 'endWith', value: '.jpg' }, IMAGES.photo],
      ['url', { method: 'endWith', value: 'library' }, IMAGES.photo],
      ['url', { method: 'startWith', value: 'library' }, IMAGES.photo],
      ['url', { method: 'equal', value: 'file:///library/beach%20sunset.jpg' }, IMAGES.photo],
      ['url', { method: 'not-empty' }, IMAGES.empties],
      // annotation
      ['annotation', { method: 'contain', value: 'bay' }, IMAGES.rich],
      ['annotation', { method: 'equal', value: 'sunset over the bay' }, IMAGES.rich],
      ['annotation', { method: 'contain', value: 'zzz' }, IMAGES.rich],
      ['annotation', { method: 'startWith', value: 'sunset' }, IMAGES.rich],
      ['annotation', { method: 'startWith', value: 'over' }, IMAGES.rich],
      ['annotation', { method: 'endWith', value: 'bay' }, IMAGES.rich],
      ['annotation', { method: 'endWith', value: 'over' }, IMAGES.rich],
      ['annotation', { method: 'empty' }, IMAGES.rich],
      ['annotation', { method: 'empty' }, IMAGES.empties],
      // width
      ['width', { method: '=', value: [1920, 0] }, IMAGES.photo],
      ['width', { method: '=', value: [1921, 0] }, IMAGES.photo],
      ['width', { method: 'between', value: [1000, 2000] }, IMAGES.photo],
      ['width', { method: 'between', value: [2000, 3000] }, IMAGES.photo],
      ['width', { method: '>=', value: [1920, 0] }, IMAGES.photo],
      ['width', { method: '<', value: [1920, 0] }, IMAGES.photo],
      // height
      ['height', { method: '=', value: [1080, 0] }, IMAGES.photo],
      ['height', { method: '<=', value: [1080, 0] }, IMAGES.photo],
      ['height', { method: 'between', value: [1000, 1100] }, IMAGES.photo],
      ['height', { method: 'between', value: [2000, 3000] }, IMAGES.photo],
      // fileSize（unit 'kb' 走 /1024，其余走 /1024/1024）
      ['fileSize', { method: 'between', value: [2, 3], unit: 'mb' }, IMAGES.photo],
      ['fileSize', { method: 'between', value: [2000, 3000], unit: 'kb' }, IMAGES.photo],
      ['fileSize', { method: 'between', value: [2000, 3000] }, IMAGES.photo],
      ['fileSize', { method: '>', value: [0, 0], unit: 'kb' }, IMAGES.photo],
      // duration（unit 'h' / 'm' / 其它）
      ['duration', { method: 'between', value: [120, 130] }, IMAGES.video],
      ['duration', { method: 'between', value: [2, 3], unit: 'm' }, IMAGES.video],
      ['duration', { method: 'between', value: [0, 1], unit: 'h' }, IMAGES.video],
      ['duration', { method: '>', value: [200, 0] }, IMAGES.video],
      ['duration', { method: '>', value: [0, 0] }, IMAGES.zeros],
      // bpm
      ['bpm', { method: '=', value: [128, 0] }, IMAGES.video],
      ['bpm', { method: '=', value: [127, 0] }, IMAGES.video],
      ['bpm', { method: 'between', value: [100, 140] }, IMAGES.video],
      // createTime / mtime / btime（on / before / after / between / within）
      ['createTime', { method: 'on', value: [T0, 0] }, IMAGES.photo],
      ['createTime', { method: 'on', value: [T0 + DAY, 0] }, IMAGES.photo],
      ['createTime', { method: 'after', value: [T0 - DAY, 0] }, IMAGES.photo],
      ['createTime', { method: 'before', value: [T0, 0] }, IMAGES.photo],
      ['createTime', { method: 'between', value: [T0 - DAY, T0 + DAY] }, IMAGES.photo],
      ['createTime', { method: 'within', value: [100000, 0] }, IMAGES.photo],
      ['createTime', { method: 'within', value: [0, 0] }, IMAGES.photo],
      ['mtime', { method: 'after', value: [T0, 0] }, IMAGES.photo],
      ['mtime', { method: 'before', value: [T0 + DAY, 0] }, IMAGES.photo],
      ['mtime', { method: 'on', value: [T1, 0] }, IMAGES.photo],
      ['btime', { method: 'before', value: [T0, 0] }, IMAGES.photo],
      ['btime', { method: 'after', value: [T0, 0] }, IMAGES.photo],
      ['btime', { method: 'within', value: [100000, 0] }, IMAGES.photo],
      // comments
      ['comments', { method: 'equal', value: 'first notesecond note' }, IMAGES.rich],
      ['comments', { method: 'contain', value: 'second' }, IMAGES.rich],
      ['comments', { method: 'startWith', value: 'first' }, IMAGES.rich],
      ['comments', { method: 'startWith', value: 'note' }, IMAGES.rich],
      ['comments', { method: 'endWith', value: 'note' }, IMAGES.rich],
      ['comments', { method: 'endWith', value: 'first' }, IMAGES.rich],
      ['comments', { method: 'uncontain', value: 'zzz' }, IMAGES.rich],
      ['comments', { method: 'regex', value: 'first.*second' }, IMAGES.rich],
      ['comments', { method: 'empty' }, IMAGES.empties],
      ['comments', { method: 'not-empty' }, IMAGES.rich],
      ['comments', { method: 'not-empty' }, IMAGES.empty],
      // tags
      ['tags', { method: 'intersection', value: ['travel', 'sunset'] }, IMAGES.rich],
      ['tags', { method: 'intersection', value: ['travel'] }, IMAGES.rich],
      ['tags', { method: 'equal', value: ['travel', 'sunset'] }, IMAGES.rich],
      ['tags', { method: 'equal', value: ['travel'] }, IMAGES.rich],
      ['tags', { method: 'union', value: ['travel'] }, IMAGES.rich],
      ['tags', { method: 'union', value: ['nope'] }, IMAGES.rich],
      ['tags', { method: 'identity', value: ['nope'] }, IMAGES.rich],
      ['tags', { method: 'identity', value: ['travel'] }, IMAGES.rich],
      ['tags', { method: 'empty' }, IMAGES.empties],
      ['tags', { method: 'not-empty' }, IMAGES.rich],
      ['tags', { method: 'intersection', value: [] }, IMAGES.rich],
      // folders
      ['folders', { method: 'intersection', value: ['f-root', 'f-travel'] }, IMAGES.rich],
      ['folders', { method: 'intersection', value: ['f-root'] }, IMAGES.rich],
      ['folders', { method: 'equal', value: ['f-root', 'f-travel'] }, IMAGES.rich],
      ['folders', { method: 'union', value: ['f-root'] }, IMAGES.rich],
      ['folders', { method: 'identity', value: ['nope'] }, IMAGES.rich],
      ['folders', { method: 'empty' }, IMAGES.empties],
      ['folders', { method: 'not-empty' }, IMAGES.rich],
      ['folders', { method: 'not-empty' }, IMAGES.empty],
      // type
      ['type', { method: 'equal', value: 'jpg' }, IMAGES.photo],
      ['type', { method: 'unequal', value: 'jpg' }, IMAGES.photo],
      ['type', { method: 'equal', value: 'video' }, { ext: 'mp4' }],
      ['type', { method: 'equal', value: 'videos' }, { ext: 'mp4' }],
      ['type', { method: 'equal', value: 'audio' }, { ext: 'mp3' }],
      ['type', { method: 'equal', value: 'font' }, { ext: 'otf' }],
      ['type', { method: 'equal', value: 'powerpoint' }, { ext: 'pptx' }],
      ['type', { method: 'equal', value: 'presentation' }, { ext: 'key' }],
      ['type', { method: 'equal', value: 'excel' }, { ext: 'xlsx' }],
      ['type', { method: 'equal', value: 'word' }, { ext: 'docx' }],
      ['type', { method: 'equal', value: 'url' }, { ext: 'url' }],
      ['type', { method: 'equal', value: 'youtube' }, { ext: 'url', medium: 'youtube' }],
      ['type', { method: 'equal', value: 'vimeo' }, { ext: 'url', medium: 'youtube' }],
      ['type', { method: 'equal', value: 'bilibili' }, { ext: 'url', medium: 'bilibili' }],
      ['type', { method: 'equal', value: 'zip' }, { ext: 'zip' }],
      // rating（vendor 把 parseInt 结果与字符串 'none' 比较 —— 该分支恒真，见 matchRules.ts 注释）
      ['rating', { method: 'equal', value: '3' }, IMAGES.rich],
      ['rating', { method: 'equal', value: '4' }, IMAGES.rich],
      ['rating', { method: 'unequal', value: '3' }, IMAGES.rich],
      ['rating', { method: 'contain', value: '3' }, IMAGES.rich],
      ['rating', { method: 'contain', value: 'none' }, IMAGES.rich],
      ['rating', { method: 'contain', value: 'none' }, IMAGES.zeros],
      ['rating', { method: 'equal', value: 'none' }, IMAGES.rich],
      // shape
      ['shape', { method: 'equal', value: 'landscape' }, IMAGES.photo],
      ['shape', { method: 'equal', value: 'panoramic-landscape' }, IMAGES.pano],
      ['shape', { method: 'equal', value: 'square' }, IMAGES.square],
      ['shape', { method: 'equal', value: 'portrait' }, IMAGES.rich],
      ['shape', { method: 'equal', value: 'panoramic-portrait' }, { width: 600, height: 3000 }],
      ['shape', { method: 'unequal', value: 'landscape' }, IMAGES.photo],
      ['shape', { method: 'equal', value: 'custom', width: 500, height: 500 }, IMAGES.square],
      ['shape', { method: 'equal', value: 'custom', width: 1, height: 2 }, IMAGES.square],
      ['shape', { method: 'equal', value: 'custom' }, IMAGES.square],
      // color
      ['color', { method: 'equal', value: '#FF0000' }, IMAGES.palette],
      ['color', { method: 'equal', value: '#00FF00' }, IMAGES.palette],
      ['color', { method: 'grayscale' }, IMAGES.gray],
      ['color', { method: 'grayscale' }, IMAGES.palette],
      ['color', { method: 'accuracy', value: '#FF0000' }, IMAGES.palette],
      ['color', { method: 'equal', value: '#FF0000' }, IMAGES.photo],
      ['color', { method: 'equal', value: '#FF0000' }, { palettes: [{ ratio: 20, color: [255, 0, 0] }] }],
      // camera
      ['camera', { method: 'equal', value: 'canon eos r5' }, IMAGES.raw],
      ['camera', { method: 'startWith', value: 'canon' }, IMAGES.raw],
      ['camera', { method: 'startWith', value: 'eos' }, IMAGES.raw],
      ['camera', { method: 'endWith', value: 'r5' }, IMAGES.raw],
      ['camera', { method: 'endWith', value: 'eos' }, IMAGES.raw],
      ['camera', { method: 'equal', value: 'nikon' }, IMAGES.raw],
      ['camera', { method: 'not-empty' }, IMAGES.raw],
      ['camera', { method: 'equal', value: 'x' }, IMAGES.photo],
      // iso / aperture / focalLength / shutter（同一批比较算子）
      // ⚠️ vendor 对 iso 用的是 `parseInt(rawMetas.isoSpeed)`，而 Eagle 真实存的是 "ISO 400"
      //    这种带前缀的串 —— `parseInt('ISO 400')` 是 NaN，于是数值比较恒为 false。
      //    这是 vendor 既有行为，搬迁必须原样保留；下面同时给出「可解析」与「带前缀」两组样例。
      ['iso', { method: '=', value: [400, 0] }, IMAGES.raw],
      ['iso', { method: '>=', value: [800, 0] }, IMAGES.raw],
      ['iso', { method: 'between', value: [100, 500] }, IMAGES.raw],
      ['iso', { method: '=', value: [400, 0] }, { rawMetas: { isoSpeed: '400' } }],
      ['iso', { method: '>=', value: [800, 0] }, { rawMetas: { isoSpeed: '400' } }],
      ['iso', { method: 'between', value: [100, 500] }, { rawMetas: { isoSpeed: '400' } }],
      ['aperture', { method: '=', value: [1.8, 0] }, IMAGES.raw],
      ['aperture', { method: '<', value: [2, 0] }, IMAGES.raw],
      ['aperture', { method: 'between', value: [1, 2] }, IMAGES.raw],
      ['aperture', { method: '=', value: [1.8, 0] }, { rawMetas: { aperture: 'no digits' } }],
      ['focalLength', { method: '=', value: [50, 0] }, IMAGES.raw],
      ['focalLength', { method: '>', value: [24, 0] }, IMAGES.raw],
      ['focalLength', { method: '>', value: [100, 0] }, IMAGES.raw],
      ['shutter', { method: '=', value: [250, 0] }, IMAGES.raw],
      ['shutter', { method: '<=', value: [250, 0] }, IMAGES.raw],
      ['shutter', { method: '>', value: [1000, 0] }, IMAGES.raw],
      ['iso', { method: '=', value: [400, 0] }, IMAGES.photo],
      // timestamp（rawMetas.timestamp，不是 modificationTime）
      ['timestamp', { method: 'on', value: [T0, 0] }, IMAGES.raw],
      ['timestamp', { method: 'after', value: [T0 - DAY, 0] }, IMAGES.raw],
      ['timestamp', { method: 'before', value: [T0 + DAY, 0] }, IMAGES.raw],
      ['timestamp', { method: 'between', value: [T0 - DAY, T0 + DAY] }, IMAGES.raw],
      ['timestamp', { method: 'within', value: [100000, 0] }, IMAGES.raw],
      ['timestamp', { method: 'on', value: [T0, 0] }, IMAGES.photo],
      // fontActivated
      ['fontActivated', { method: 'activate' }, IMAGES.font],
      ['fontActivated', { method: 'deactivate' }, IMAGES.font],
      ['fontActivated', { method: 'activate' }, { ext: 'otf', fontMetas: { postScriptName: { 0: 'NotInstalled' } } }],
      ['fontActivated', { method: 'deactivate' }, { ext: 'otf', fontMetas: { postScriptName: { 0: 'NotInstalled' } } }],
      ['fontActivated', { method: 'activate' }, IMAGES.photo],
      ['fontActivated', { method: 'activate' }, { fontMetas: {} }],
      ['fontActivated', { method: 'other' }, IMAGES.font],
    ];

    // 本组样例在「有驱动面」的默认态下跑：`folderName` 需要 folderMappings 才可能命中
    applyDriver(sandbox, {
      __eagleDriver: { folderMappings: { 'f-root': { name: 'Library Root' }, 'f-travel': { name: 'Travel 2024' } } },
    });

    const cmp = makeComparator('具名样例');
    /** 每条规则各自命中的真假结果 —— 用来证明「这些样例真的是真假样例」，而不是一味的 false。 */
    const seen = new Map();
    for (const [key, rule, image] of cases) {
      const { vendorOut } = cmp.compare(`[${key}]`, win[VENDOR_NAME_OF[key]], table[key], [rule, image]);
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key).add(vendorOut);
    }
    const n = cmp.finish();
    assert.equal(n, cases.length, '每条具名样例都应实际跑到');

    const lacking = [];
    for (const [key] of parseFilterDomainTable()) {
      const outs = seen.get(key);
      if (!outs) { lacking.push(`${key}（无样例）`); continue; }
      if (!outs.has('ret bool:true')) lacking.push(`${key}（无真样例）`);
      if (!outs.has('ret bool:false')) lacking.push(`${key}（无假样例）`);
    }
    assert.deepEqual(lacking, [], `以下规则缺真/假样例，样例集不合格：${lacking.join('、')}`);

    applyDriver(sandbox, {});
  });

  // ───────────────── 3. 确定性伪随机扫描 ─────────────────

  await t.test('26 个规则 × 数百组确定性扫描（未加防护路径）', () => {
    const samples = sampleProduct(SWEEP_METHODS, SWEEP_VALUES, SWEEP_IMAGES, SWEEP_RULES_EXTRA, 500);
    assert.ok(samples.length >= 400, `扫描样本应有数百组，实得 ${samples.length}`);
    const cmp = makeComparator('随机扫描');
    for (const [key, vendorName] of parseFilterDomainTable()) {
      for (const [rule, image] of samples) {
        cmp.compare(`[${key}]`, win[vendorName], table[key], [rule, image]);
      }
    }
    cmp.finish();
  });

  // ───────────────── 4. matchStringMethod 8 个原语 ─────────────────

  await t.test('matchStringMethod：8 个原语 × 名字/取值扫描', () => {
    const vendorTable = win.matchStringMethod;
    const newTable = matchStringMethodMod.matchStringMethod;
    assert.deepEqual(Object.keys(newTable).sort(), Object.keys(vendorTable).sort(), '原语名集合应一致');
    assert.deepEqual(
      Object.keys(vendorTable).sort(),
      ['contain', 'empty', 'endWith', 'equal', 'not-empty', 'regex', 'startWith', 'uncontain'],
      '原语集合应恰为 vendor L4-31 的 8 项',
    );

    const names = ['', 'abc', 'ABC', 'Beach Sunset.jpg', 'a.c', 'x[', '日本語'];
    const values = [undefined, '', 'abc', 'ABC', 'a', '.', '.*', '[', '^a', 'a$', 'none'];
    const cmp = makeComparator('matchStringMethod');
    for (const method of Object.keys(vendorTable)) {
      for (const name of names) {
        for (const value of values) {
          cmp.compare(`[${method}] ${JSON.stringify(name)}`, vendorTable[method], newTable[method], [name, value]);
        }
      }
    }
    cmp.finish();
  });

  // ───────────────── 5. 工具函数 ─────────────────

  await t.test('工具函数：intersect / hexToRGB / rgbToHex / colorSimilarityDistance', () => {
    const cmp = makeComparator('工具函数');

    const arrays = [[], ['a'], ['a', 'b'], ['b', 'a'], [1, 2], [2, 1], ['1', 1], [0, false], ['__proto__']];
    for (const a1 of arrays) {
      for (const a2 of arrays) {
        cmp.compare(`intersect(${safeJson(a1)}, ${safeJson(a2)})`, win.intersect, matchRulesMod.intersect, [a1, a2]);
      }
    }

    const hexes = ['#FF0000', '#00ff00', '#000000', '#FFFFFF', '#123456', '#1', '', '#', 'red', '#GGGGGG', '__proto__'];
    for (const hex of hexes) {
      cmp.compare(`hexToRGB(${safeJson(hex)})`, win.hexToRGB, matchRulesMod.hexToRGB, [hex]);
    }

    const rgbTriples = [[0, 0, 0], [255, 255, 255], [1, 2, 3], [256, 256, 256], [1.5, 2.5, 3.5], [NaN, 0, 0]];
    for (const [r, g, b] of rgbTriples) {
      cmp.compare(`rgbToHex(${r},${g},${b})`, win.rgbToHex, matchRulesMod.rgbToHex, [r, g, b]);
    }

    const colors = [[255, 0, 0], [0, 0, 0], [100, 100, 100], [0, 128, 255], [255, 255, 255]];
    for (const c1 of colors) {
      for (const c2 of colors) {
        cmp.compare(
          `colorSimilarityDistance(${safeJson(c1)}, ${safeJson(c2)})`,
          win.colorSimilarityDistance,
          matchRulesMod.colorSimilarityDistance,
          [c1, c2],
        );
      }
    }
    cmp.finish();
  });

  // ───────────────── 6. 驱动面三分支 ─────────────────

  await t.test('驱动面 __eagleDriver / $bodyScope 的每个分支（folderName 规则）', () => {
    const cmp = makeComparator('驱动面');
    const folderIds = ['f-root', 'f-travel', 'f-null', 'f-noname', 'f-missing'];
    const methods = ['equal', 'startWith', 'endWith', 'contain', 'uncontain', 'not-empty', 'empty'];
    for (const [label, makeDriver] of DRIVER_STATES) {
      applyDriver(sandbox, makeDriver());
      for (const method of methods) {
        for (const folderId of folderIds) {
          const item = { folders: [folderId] };
          cmp.compare(
            `[${label}] ${method} ${folderId}`,
            win.isMatchFolderNameRule,
            table.folderName,
            [{ method, value: method === 'not-empty' || method === 'empty' ? undefined : 'root' }, item],
          );
          cmp.compare(
            `[${label}] multi ${method}`,
            win.isMatchFolderNameRule,
            table.folderName,
            [{ method, value: 'travel' }, { folders: [folderId, 'f-travel', 'f-root'] }],
          );
        }
      }
      // 同一驱动态下，取值来自真实文件夹名的样例
      cmp.compare(
        `[${label}] value=library root`,
        win.isMatchFolderNameRule,
        table.folderName,
        [{ method: 'equal', value: 'library root' }, { folders: ['f-root'] }],
      );
    }
    applyDriver(sandbox, {});
    cmp.finish();
  });

  // ───────────────── 7. 全局缺席的同类别失败 ─────────────────

  await t.test('bundle 全局缺席：两侧以同一方式失败（失败类别与消息逐字一致）', () => {
    // expected 是**两侧共同**应有的结果，按 vendor 的实际结构定：
    //   · `isMatchTypeRule` 没有 try/catch → 裸标识符缺席时 ReferenceError 直接冒出；
    //   · `isMatchFontActivatedRule` 整段包在 try/catch 里 → 同样缺席，但被吞成 false。
    // 两条路径都必须两侧一致；「失败更晚、更窄、不更糟」正是这里被钉住的东西。
    const probes = {
      VIDEO_TYPES: { key: 'type', rule: { method: 'equal', value: 'video' }, image: { ext: 'mp4' }, expected: 'throw ReferenceError: VIDEO_TYPES is not defined' },
      AUDIO_TYPES: { key: 'type', rule: { method: 'equal', value: 'audio' }, image: { ext: 'mp3' }, expected: 'throw ReferenceError: AUDIO_TYPES is not defined' },
      FONT_TYPES: { key: 'type', rule: { method: 'equal', value: 'font' }, image: { ext: 'otf' }, expected: 'throw ReferenceError: FONT_TYPES is not defined' },
      installedFonts: { key: 'fontActivated', rule: { method: 'activate' }, image: IMAGES.font, expected: 'ret bool:false' },
    };

    for (const [missing, probe] of Object.entries(probes)) {
      installBundleGlobals(sandbox, [missing]);
      const args = [probe.rule, probe.image];
      const vendorOut = outcome(win[VENDOR_NAME_OF[probe.key]], args);
      const newOut = outcome(table[probe.key], args);
      assert.equal(
        vendorOut,
        probe.expected,
        `${missing} 缺席时 vendor 的行为应恰为 ${probe.expected}，实得 ${vendorOut}`,
      );
      assert.equal(
        newOut,
        vendorOut,
        `${missing} 缺席时两侧的失败类别/消息应一致：vendor=${vendorOut} new=${newOut}`,
      );
    }
    installBundleGlobals(sandbox);
  });

  // ───────────────── 8. color-convert / delta-e 的调用期读取 ─────────────────

  await t.test('color-convert / delta-e 经 window 全局供给（不在模块顶层解构）', () => {
    assert.equal(typeof win.colorConvert, 'object', 'vendor 装载期应已挂上 colorConvert');
    assert.equal(typeof win.DeltaE, 'object', 'vendor 装载期应已挂上 DeltaE');
    const d = matchRulesMod.colorSimilarityDistance([255, 0, 0], [255, 0, 0]);
    assert.equal(norm(d), 'obj:{d2000:num:0,d76:num:0}', '同色距离应为 0（证明真的用到了 delta-e）');
    // 顶层解构会拿到 undefined：此刻把 window 上的绑定换掉，调用期读取必须跟着变
    const originalConvert = win.colorConvert;
    try {
      win.colorConvert = { rgb: { lab: () => [0, 1, 2] } };
      win.DeltaE = { getDeltaE76: () => 11, getDeltaE00: () => 22 };
      assert.equal(
        norm(matchRulesMod.colorSimilarityDistance([1, 2, 3], [4, 5, 6])),
        'obj:{d2000:num:22,d76:num:11}',
        '换掉 window 上的绑定后调用期应读到新值 —— 顶层解构会读到旧值',
      );
    } finally {
      win.colorConvert = originalConvert;
      win.DeltaE = repoRequire('delta-e');
    }
  });

  // ───────────────── 9. 缓存不改变结果 ─────────────────

  await t.test('cacheColorMappings：冷热两遍结果一致，且与 vendor 缓存互不干扰', () => {
    const rule = { method: 'accuracy', value: '#3366CC' };
    const image = { palettes: [{ ratio: 45, color: [51, 102, 204] }] };
    const first = outcome(win.isMatchColorRule, [rule, image]);
    const second = outcome(win.isMatchColorRule, [rule, image]);
    assert.equal(first, second, 'vendor 侧热缓存不应改变结果');
    assert.equal(outcome(table.color, [rule, image]), first, '新模块侧（同样先热过缓存）应与 vendor 一致');
    assert.ok(Object.keys(matchRulesMod.cacheColorMappings).length > 0, '新模块应真的写了自己的缓存');

    // 清空任一侧的缓存，结果必须不变（缓存只是加速，不是事实来源）
    for (const key of Object.keys(matchRulesMod.cacheColorMappings)) delete matchRulesMod.cacheColorMappings[key];
    assert.equal(outcome(table.color, [rule, image]), first, '清空新模块缓存后结果应不变');
  });

  applyDriver(sandbox, {});
});

// ═══════════════════════════ zoomHelpers ═══════════════════════════

test('M3-1 等价性：zoomHelpers 与 vendor 逐项一致', async (t) => {
  const { sandbox, zoomMod } = loadZoomHelpers();
  const win = sandbox;

  await t.test('devicesMetrics：逐项深比对', () => {
    assert.equal(norm(zoomMod.devicesMetrics), norm(win.devicesMetrics), 'devicesMetrics 应与 vendor 逐项一致');
    // 实测 85 项（竖屏 43 + 横屏 42）。审计报告 §A 记的「94 项」把被注释掉的行也数了进去，
    // 这里以 vendor 运行期 length 为准 —— 注释行不是元素。
    assert.equal(win.devicesMetrics.length, 85, `vendor 的 devicesMetrics 应为 85 项，实得 ${win.devicesMetrics.length}`);
    assert.equal(zoomMod.devicesMetrics.length, 85, '新模块的 devicesMetrics 也应为 85 项');
  });

  await t.test('isMobileResolution：全表命中 + 边界 + 非命中', () => {
    const cmp = makeComparator('isMobileResolution');
    const pairs = [];
    // 全表 × 1x/2x/3x（3.0001x 越上限）
    for (const { w, h } of Array.from(win.devicesMetrics)) {
      for (const k of [1, 2, 3]) pairs.push([w * k, h * k]);
    }
    pairs.push([270 * 3.0001, 480 * 3.0001]);
    pairs.push([0, 0], [1, 1], [500, 500], [375, 375], [1125, 2001], [1920, 1080], [-375, -667], [NaN, 667], [Infinity, 667]);
    for (const [w, h] of pairs) {
      cmp.compare(`isMobileResolution(${w}, ${h})`, win.isMobileResolution, zoomMod.isMobileResolution, [w, h]);
    }
    cmp.finish();
  });

  await t.test('isMobileWidth：0..1200 全扫', () => {
    const cmp = makeComparator('isMobileWidth');
    for (let w = 0; w <= 1200; w++) {
      cmp.compare(`isMobileWidth(${w})`, win.isMobileWidth, zoomMod.isMobileWidth, [w]);
    }
    for (const w of [-375, 1.5, NaN, Infinity, 1125.5]) {
      cmp.compare(`isMobileWidth(${w})`, win.isMobileWidth, zoomMod.isMobileWidth, [w]);
    }
    cmp.finish();
  });

  await t.test('getImagePixelDensity：后缀全枚举 + 缺字段', () => {
    const cmp = makeComparator('getImagePixelDensity');
    const images = [
      { name: 'a@2x' }, { name: 'a@3x' }, { name: 'a@1.5x' }, { name: 'a@0.5x' },
      { name: 'a@2x.jpg' }, { name: 'a@3x.jpg' }, { name: 'a@1.5x.jpg' }, { name: 'a@0.5x.jpg' },
      { name: 'a@4x' }, { name: 'a' }, { name: '@2x' }, { name: '' }, {}, { name: null },
      null, undefined, 'a@2x',
    ];
    for (const image of images) {
      cmp.compare(`getImagePixelDensity(${safeJson(image)})`, win.getImagePixelDensity, zoomMod.getImagePixelDensity, [image]);
    }
    cmp.finish();
  });

  await t.test('返回值形状按 vendor 照抄（命中返回数值、未命中返回 false）', () => {
    assert.equal(zoomMod.isMobileResolution(375, 667), 667, '命中应返回 size.h（数值），不是 true');
    assert.equal(zoomMod.isMobileWidth(375), 375, '命中应返回 375，不是 true');
    assert.equal(zoomMod.isMobileWidth(376), false);
    assert.equal(zoomMod.getImagePixelDensity({ name: 'a@3x' }), 33.33);
  });
});

// ═══════════════════════════ 静态边界 ═══════════════════════════

test('M3-1：新模块不得引入裸 require / @ts-nocheck / any', async (t) => {
  const files = fs.readdirSync(new URL(`../${RULES_DIR}`, import.meta.url)).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length >= 5, `core/rules/ 应至少有 5 个模块，实得 ${files.length}`);

  await t.test('无裸 require 与顶层 window 解构', () => {
    for (const file of files) {
      const src = read(`${RULES_DIR}/${file}`);
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      assert.ok(!/\brequire\s*\(/.test(code), `${file} 出现裸 require`);
      assert.ok(!/\bimport\s*\{[^}]*\}\s*from\s*['"][^./]/.test(code), `${file} 出现非相对 import`);
    }
  });

  await t.test('无 @ts-nocheck / any / @ts-ignore / @ts-expect-error', () => {
    for (const file of files) {
      const src = read(`${RULES_DIR}/${file}`);
      for (const banned of ['@ts-nocheck', '@ts-ignore', '@ts-expect-error']) {
        assert.ok(!src.includes(banned), `${file} 出现 ${banned}`);
      }
      assert.ok(!/:\s*any\b/.test(src), `${file} 出现 any 类型注解`);
      assert.ok(!/\bas\s+any\b/.test(src), `${file} 出现 as any`);
    }
  });

  await t.test('vendor 两文件未被改动（本批是并存，不是替换）', () => {
    for (const rel of [VENDOR_MATCH, VENDOR_ZOOM]) {
      const src = read(rel);
      assert.ok(src.length > 0, `${rel} 不应为空`);
      assert.ok(
        /window\.__eagleDriver \|\| window\.\$bodyScope/.test(src) || /devicesMetrics/.test(src),
        `${rel} 应仍是被测 vendor 原文`,
      );
    }
    assert.ok(/window\.require\('color-convert'\)/.test(read(VENDOR_MATCH)), 'vendor 的 color-convert 装载行应仍在');
  });
});

// ── 键 → vendor 全局名：由 filterDomain 源码解析后固化，供具名样例引用 ──
// （在模块求值期解析一次；若 filterDomain 的表被改动，上面第 1 节的断言会先失败）
const VENDOR_NAME_OF = Object.fromEntries(parseFilterDomainTable());
for (const key of ['name', 'folderName', 'url', 'annotation', 'width', 'height', 'fileSize', 'createTime',
  'mtime', 'btime', 'tags', 'rating', 'folders', 'type', 'shape', 'color', 'duration', 'bpm', 'camera',
  'iso', 'aperture', 'focalLength', 'shutter', 'timestamp', 'fontActivated', 'comments']) {
  assert.ok(VENDOR_NAME_OF[key], `filterDomain 的筛选表应含 ${key}`);
}
