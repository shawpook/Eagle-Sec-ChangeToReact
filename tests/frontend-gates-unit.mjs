import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDist, parseHtml } from './dist-entry-check.mjs';
import { auditNoCheck, NOCHECK_LEDGER, scanTypeDirectives } from './typecheck.mjs';
import { runAcceptanceStages, summarizeAcceptance } from './frontend-acceptance.mjs';

// 所有资源均在新建的临时目录；不构建、不启动宿主、不读取真实库。
const policy = {
  reactPages: ['src/app/index.html'], pages: ['pages.html'], dynamicAssets: [],
  extensionManifests: [], pluginManifests: [], forbidden: ['mock-library', 'mock-assets'],
};
const assets = {
  'src/app/index.html': `<link href='/assets/main.css?theme=1&amp;v=2' rel="stylesheet">
    <script src="/assets/entry.js?v=1#entry" type='module'></script>`,
  'pages.html': '<a href="./src/app/index.html">入口</a>',
  'assets/entry.js': `import './shared.js'; export { value } from './reexport.js';
    import('./lazy.js');
    new Worker(new URL('./workers/start.js', import.meta.url));
    new SharedWorker('/assets/workers/shared.js');`,
  'assets/shared.js': 'export const shared = 1;',
  'assets/reexport.js': 'export const value = 1;',
  'assets/lazy.js': 'export default 1;',
  'assets/workers/start.js': `importScripts('./runtime.js'); new Worker('./nested/child.js');`,
  'assets/workers/runtime.js': 'self.ready = true;',
  'assets/workers/nested/child.js': `importScripts('../runtime.js');`,
  'assets/workers/shared.js': '',
  'assets/main.css': `@import './theme/second.css'; .icon { background: url("./images/icon.svg?x=1#icon") }`,
  'assets/theme/second.css': `@import url('../main.css'); @import "./third.css";`,
  'assets/theme/third.css': `@font-face { src: url('../fonts/App%20Font.woff2?v=1') format('woff2') }`,
  'assets/fonts/App Font.woff2': '隔离字体占位',
  'assets/images/icon.svg': '<svg/>',
};
function fixture(t, overrides = {}, omitted = []) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-m0-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'dist');
  fs.mkdirSync(root);
  for (const [file, contents] of Object.entries({ ...assets, ...overrides })) {
    if (omitted.includes(file)) continue;
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}
function assertMissing(result, file) {
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.endsWith(`产物缺失 ${file}`)), result.failures.join('\n'));
}

test('完整隔离产物：单双引号、递归 CSS、共享 chunk、worker 上下文与循环引用通过', (t) => {
  const root = fixture(t);
  const result = checkDist({ root, policy });
  assert.equal(result.ok, true, result.failures.join('\n'));
  assert.deepEqual(result.checkedFiles, Object.keys(assets).sort());
});

for (const [kind, file] of [
  ['HTML 入口', 'src/app/index.html'], ['JS 入口', 'assets/entry.js'],
  ['共享 chunk', 'assets/shared.js'], ['重导出 chunk', 'assets/reexport.js'],
  ['动态 chunk', 'assets/lazy.js'], ['直接 CSS', 'assets/main.css'],
  ['递归 CSS 第二层', 'assets/theme/second.css'], ['递归 CSS 第三层', 'assets/theme/third.css'],
  ['worker', 'assets/workers/start.js'], ['shared worker', 'assets/workers/shared.js'],
  ['worker importScripts', 'assets/workers/runtime.js'], ['嵌套 worker', 'assets/workers/nested/child.js'],
  ['font', 'assets/fonts/App Font.woff2'], ['CSS 图片', 'assets/images/icon.svg'],
]) {
  test(`负向：缺失${kind}必须 FAIL`, (t) => {
    const root = fixture(t, {}, [file]);
    assertMissing(checkDist({ root, policy }), file);
  });
}

for (const quote of ["'", '"']) {
  test(`HTML ${quote} 引号及属性顺序均能发现缺失 JS/CSS`, (t) => {
    const root = fixture(t, {
      'src/app/index.html': `<script src=${quote}/assets/missing.js${quote} type=${quote}module${quote}></script>
        <link rel=${quote}stylesheet${quote} href=${quote}/assets/missing.css${quote}>`,
    });
    const result = checkDist({ root, policy });
    assertMissing(result, 'assets/missing.js');
    assertMissing(result, 'assets/missing.css');
  });
}

test('缺失 module 声明不能靠存在普通 JS 标签通过', (t) => {
  const root = fixture(t, { 'src/app/index.html': '<script src="/assets/shared.js"></script>' });
  const result = checkDist({ root, policy });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('没有 module 入口脚本')));
});

test('HTML base 同时作用于入口验证和资源解析', (t) => {
  const root = fixture(t, { 'src/app/index.html': `<base href='/assets/'><script type='module' src='entry.js'></script>` });
  const result = checkDist({ root, policy });
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('源码也不存在的外围 JS 和旧路由不得降为 WARN 或豁免', (t) => {
  const root = fixture(t, {
    'pages.html': `<script src='/src/app/js/m0-never-existed.js'></script><a href='/src/app/registration.html'>旧路由</a>`,
  });
  const result = checkDist({ root, policy });
  assertMissing(result, 'src/app/js/m0-never-existed.js');
  assertMissing(result, 'src/app/registration.html');
  assert.equal(result.failures.length, 2);
});

test('只访问注入的 dist 根，不回退源码，也不写产物', (t) => {
  const root = fixture(t);
  const io = Object.fromEntries(['statSync', 'readFileSync'].map((name) => [name, (full, ...args) => {
    const rel = path.relative(root, full);
    assert.ok(!rel.startsWith('..') && !path.isAbsolute(rel), `不应访问隔离根外：${full}`);
    return fs[name](full, ...args);
  }]));
  const before = Object.fromEntries(Object.keys(assets).map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  assert.equal(checkDist({ root, policy, io }).ok, true);
  for (const [file, contents] of Object.entries(before)) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), contents);
});

test('忽略 HTML/CSS/JS 注释、字符串伪引用和外部协议，不豁免真实本地引用', (t) => {
  const root = fixture(t, {
    'pages.html': `<!-- <script src='/comment-missing.js'></script> -->
      <a href='#local'>片段</a><img src='data:image/png;base64,AA=='>`,
    'assets/lazy.js': `// import './comment-missing.js';\nconst text = "import('./string-missing.js')";`,
    'assets/theme/third.css': `/* @import './comment-missing.css'; */
      p::after { content: "url(string-missing.png)"; background: url(data:image/png;base64,AA==); }`,
  });
  const result = checkDist({ root, policy });
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('HTML 解析忽略脚本正文里的伪标签，保留内联脚本', () => {
  const html = parseHtml(`<script>const text = "<img src='fake.png'>";</script><!-- <img src='comment.png'> -->`);
  assert.equal(html.tags.length, 1);
  assert.equal(html.scripts.length, 1);
});

test('内联 CSS 和 JS 引用缺失资源仍失败', (t) => {
  const root = fixture(t, { 'pages.html': `<style>@import '/inline.css';</style><script>import('/inline.js');</script>` });
  const result = checkDist({ root, policy });
  assertMissing(result, 'inline.css');
  assertMissing(result, 'inline.js');
});

test('Vite 预加载依赖数组中的共享资源必须存在', (t) => {
  const root = fixture(t, { 'assets/lazy.js': `const deps = ['assets/preload.js', 'assets/preload.css'];` });
  const result = checkDist({ root, policy });
  assertMissing(result, 'assets/preload.js');
  assertMissing(result, 'assets/preload.css');
});

test('显式动态 worker 清单也不能缺失', (t) => {
  const root = fixture(t);
  const result = checkDist({ root, policy: { ...policy, dynamicAssets: [{ file: 'workers/dynamic.js', owner: '隔离消费者' }] } });
  assertMissing(result, 'workers/dynamic.js');
});

test('递归 CSS 语法破损不可静默通过', (t) => {
  const root = fixture(t, { 'assets/theme/third.css': 'body {' });
  const result = checkDist({ root, policy });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('assets/theme/third.css：资源解析失败')));
});

test('CLI --root 指向隔离目录，缺失必需入口退出 1', (t) => {
  const root = fixture(t, {}, ['src/app/index.html']);
  // 脚本路径必须经 fileURLToPath 还原：.pathname 会把空格与非 ASCII 目录名百分号编码，
  // 子进程将因 MODULE_NOT_FOUND 退出而与门禁判定无关。
  const cli = fileURLToPath(new URL('./dist-entry-check.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, `--root=${root}`], {
    encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.error, undefined);
  assert.doesNotMatch(result.stderr, /MODULE_NOT_FOUND/, `CLI 未真正执行：${result.stderr}`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAIL .*产物缺失 src\/app\/index\.html/);
  assert.match(result.stdout, /DIST_ENTRY_CHECK_FAILED/);
  assert.doesNotMatch(result.stdout + result.stderr, /WARN/);
});

const records = (text, file = 'scope.ts') => scanTypeDirectives(text, file).map((record) => ({ ...record, file }));

/**
 * 实扫 `src/` 下全部自有脚本，返回「文件头带**有效**整文件 @ts-nocheck」的真实记录。
 * **不读台账**——期望值必须由源码本身得出，否则台账与源码可以一起漂移而无人察觉。
 * 路径经 fileURLToPath 还原（`.pathname` 会把空格与非 ASCII 目录名百分号编码）。
 */
function scanSrcNoCheckRecords() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(?:[cm]?js|tsx?)$/.test(entry.name)) continue;
      const file = path.relative(root, full).split(path.sep).join('/');
      found.push(...records(fs.readFileSync(full, 'utf8'), file));
    }
  })(path.join(root, 'src'));
  return found;
}

test('台账与源码里真实的整文件 nocheck 集合逐一对应（双向，均不得漂移）', () => {
  // 期望值由真实扫描得出而非写死数字：台账多一行、少一行，或源码多一个、少一个整文件
  // @ts-nocheck，都会让 unlisted / stale 至少一侧非空而变红。撤销免检时须同步删除台账条目。
  const audit = auditNoCheck(scanSrcNoCheckRecords());
  assert.deepEqual(audit.unlisted, []);
  assert.deepEqual(audit.stale, []);
  assert.deepEqual(audit.files, NOCHECK_LEDGER.map(({ file }) => file).sort());
});

test('超过 40 行的有效文件头 nocheck 仍被检测', () => {
  const found = records(`${'// 说明\n'.repeat(50)}// @ts-nocheck\nexport {};`);
  assert.equal(found[0].line, 51);
  assert.deepEqual(auditNoCheck(found, []).unlisted, ['scope.ts']);
});

test('块注释说明、代码后的 nocheck 和字符串不冒充整文件免检', () => {
  const found = records(`/**\n * @ts-nocheck 历史说明\n */\nconst text = '// @ts-nocheck';\n// @ts-nocheck`);
  assert.equal(found.length, 2);
  assert.deepEqual(auditNoCheck(found, []).files, []);
});

test('文件头最后一个 check/nocheck 开关遵从 TypeScript 解析结果', () => {
  assert.deepEqual(auditNoCheck(records('// @ts-nocheck\n// @ts-check\nexport {};'), []).files, []);
  assert.deepEqual(auditNoCheck(records('// @ts-check\n// @ts-nocheck\nexport {};'), []).files, ['scope.ts']);
});

test('新增免检和撤销后残留台账分别失败', () => {
  const audit = auditNoCheck(records('// @ts-nocheck\nexport {};', 'new.ts'), [{ file: 'old.ts' }]);
  assert.deepEqual(audit.unlisted, ['new.ts']);
  assert.deepEqual(audit.stale, ['old.ts']);
});

test('ignore/expect-error 计数保留，字符串与模板正文不算指令', () => {
  const found = records("// @ts-ignore\nconst x = 1;\n// @ts-expect-error\nx();\nconst s = `// @ts-nocheck`; ");
  assert.deepEqual(found.map((record) => record.kind), ['ignore', 'expect-error']);
});

const definitions = Object.fromEntries(['static', 'build', 'artifact', 'regression', 'backend'].map((stage) => [stage, {
  title: `隔离模拟 ${stage}`, steps: [{ label: stage }], dependsOn: stage === 'artifact' ? ['build'] : [],
}]));
const passStep = ({ label }) => ({ label, status: 'PASS', exit: 0, ms: 0 });

test('standalone artifact 必须 BLOCKED，绝不调用任何步骤执行器', () => {
  const results = runAcceptanceStages(['artifact'], definitions, () => assert.fail('不允许执行产物或 GUI 步骤'));
  assert.match(results[0].status, /^BLOCKED/);
  assert.deepEqual(results[0].steps, []);
  const summary = summarizeAcceptance(['artifact'], results);
  assert.equal(summary.complete, false);
  assert.equal(summary.exitCode, 1);
  assert.equal(summary.conclusion, 'FRONTEND_ACCEPTANCE_FAILED');
});

test('build 失败时 artifact 保持阻断', () => {
  const calls = [];
  const results = runAcceptanceStages(['build', 'artifact'], definitions, ({ label }) => {
    calls.push(label);
    return { label, status: 'FAIL', exit: 1 };
  });
  assert.deepEqual(calls, ['build']);
  assert.match(results[1].status, /^BLOCKED/);
});

test('先请求 artifact 后请求 build 不得补认前置通过', () => {
  const results = runAcceptanceStages(['artifact', 'build'], definitions, passStep);
  assert.match(results[0].status, /^BLOCKED/);
  assert.equal(summarizeAcceptance(['artifact', 'build'], results).exitCode, 1);
});

test('即使 standalone artifact 模拟 PASS，也只能是部分结论', () => {
  const summary = summarizeAcceptance(['artifact'], [{ stage: 'artifact', status: 'PASS', steps: [] }]);
  assert.equal(summary.complete, false);
  assert.equal(summary.conclusion, 'FRONTEND_ACCEPTANCE_PARTIAL_OK');
  assert.deepEqual(summary.notRun, ['static', 'build', 'regression']);
});

test('仅默认四段全部通过才有完整前端结论，backend 未跑不算通过', () => {
  const stages = ['static', 'build', 'artifact', 'regression'];
  const results = runAcceptanceStages(stages, definitions, passStep);
  const summary = summarizeAcceptance(stages, results);
  assert.equal(summary.complete, true);
  assert.equal(summary.conclusion, 'FRONTEND_ACCEPTANCE_ALL_GREEN');
  assert.equal(results.some((result) => result.stage === 'backend'), false);
});

test('已请求但缺失执行结果不能被汇总成绿色', () => {
  const summary = summarizeAcceptance(['static', 'build', 'artifact', 'regression'], []);
  assert.equal(summary.complete, false);
  assert.equal(summary.exitCode, 1);
});
