/**
 * M7-3 publish asset manifest gate.
 *
 * This test intentionally scans only fixed project paths. It does not walk the
 * workspace, so untracked scratch directories cannot change its result.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PUBLISH_ASSET_MANIFEST,
  PUBLISH_OUT_DIR,
  SRC_NODE_MODULE_PACKAGES,
  copyPublishAssets,
} from '../frontend/publish-asset-manifest.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesRoot = path.join(projectRoot, 'src/my_modules');
const retiredModulesRoot = path.join(projectRoot, 'docs/retired-2026-09-16/src/my_modules');
const modulePrefix = 'src/my_modules/';
const registryFile = 'src/app/react/core/shim/moduleRegistry.ts';
const nodeModulesPrefix = 'src/node_modules/';

function listTopLevel(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

export function auditMyModulesManifest({
  workspaceRoot = projectRoot,
  manifest = PUBLISH_ASSET_MANIFEST,
  archiveRoot = retiredModulesRoot,
} = {}) {
  const currentRoot = path.join(workspaceRoot, 'src/my_modules');
  const actual = listTopLevel(currentRoot);
  const registered = manifest
    .filter((entry) => entry.from.startsWith(modulePrefix))
    .map((entry) => entry.from.slice(modulePrefix.length).split('/')[0])
    .sort();
  const retired = listTopLevel(archiveRoot);
  const actualSet = new Set(actual);
  const registeredSet = new Set(registered);
  const retiredSet = new Set(retired);

  const duplicateRegistrations = registered.filter((name, index) => registered.indexOf(name) !== index);
  const unregistered = actual.filter((name) => !registeredSet.has(name) && !retiredSet.has(name));
  const sourceMissing = registered.filter((name) => !actualSet.has(name));
  const archiveCollisions = actual.filter((name) => retiredSet.has(name));

  const failures = [];
  if (duplicateRegistrations.length) failures.push(`重复登记: ${[...new Set(duplicateRegistrations)].join(', ')}`);
  if (unregistered.length) failures.push(`未登记的 src/my_modules 条目: ${unregistered.join(', ')}`);
  if (sourceMissing.length) failures.push(`清单已登记但源不存在: ${sourceMissing.join(', ')}`);
  if (archiveCollisions.length) failures.push(`源树与退役归档同时存在: ${archiveCollisions.join(', ')}`);
  if (failures.length) throw new Error(failures.join('；'));

  return { actual, registered, retired };
}

/**
 * M8-3：实扫 `moduleRegistry.ts` 里**登记为真实裸模块**的 `src/node_modules` 包及其入口。
 *
 * 期望值由源码实扫得出，不是在本测试里写死一份名单：登记表的增删必须自动带动清单门禁
 * （与 src/my_modules 的审计同一口径）。扫描口径是 `requireModule()` 中
 * `realBareModule(req, '/src/node_modules/<包>/<入口>')` 这一形态的调用。
 */
export function scanRegistryBareModules({ workspaceRoot = projectRoot } = {}) {
  const source = fs.readFileSync(path.join(workspaceRoot, registryFile), 'utf8');
  const pattern = /realBareModule\(\s*req\s*,\s*'(\/src\/node_modules\/[^']+)'\s*\)/g;
  return [...source.matchAll(pattern)].map((match) => {
    // entry 是运行期 syncText 真正去取的 URL 路径（带前导 `/`）；relative 与清单 from 同口径。
    const entry = match[1];
    const relative = entry.replace(/^\//, '');
    return { entry, relative, pkg: relative.slice(nodeModulesPrefix.length).split('/')[0] };
  });
}

/** 清单与源码实扫逐项对账：登记了却没进清单、或进了清单却没有真实消费者，都判红。 */
export function auditSrcNodeModulesManifest({
  workspaceRoot = projectRoot,
  manifest = PUBLISH_ASSET_MANIFEST,
} = {}) {
  const scanned = scanRegistryBareModules({ workspaceRoot });
  const registered = manifest
    .filter((entry) => entry.from.startsWith(nodeModulesPrefix))
    .map((entry) => entry.from.slice(nodeModulesPrefix.length).split('/')[0])
    .sort();
  const expected = scanned.map((record) => record.pkg).sort();
  const expectedSet = new Set(expected);

  const failures = [];
  const missing = expected.filter((name) => !registered.includes(name));
  const extra = registered.filter((name) => !expectedSet.has(name));
  const notTree = manifest
    .filter((entry) => entry.from.startsWith(nodeModulesPrefix) && entry.kind !== 'tree')
    .map((entry) => entry.from);
  const entryMissing = scanned
    .filter((record) => !fs.existsSync(path.join(workspaceRoot, record.relative)))
    .map((record) => record.relative);

  if (!scanned.length) failures.push(`未从 ${registryFile} 实扫到任何 src/node_modules 真实裸模块登记（扫描口径可能已失效）`);
  if (missing.length) failures.push(`moduleRegistry.ts 已登记但清单未交付: ${missing.join(', ')}`);
  if (extra.length) failures.push(`清单交付但 moduleRegistry.ts 无真实裸模块登记: ${extra.join(', ')}`);
  if (notTree.length) failures.push(`src/node_modules 条目必须整包交付（kind=tree）: ${notTree.join(', ')}`);
  if (entryMissing.length) failures.push(`登记的入口文件在源工作区不存在: ${entryMissing.join(', ')}`);
  if (failures.length) throw new Error(failures.join('；'));

  return { scanned, registered, expected };
}

// ---------------------------------------------------------------------------
// 产物侧的真实装载（不是「文件存在」断言）
// ---------------------------------------------------------------------------
/**
 * 复刻 shim 的装载口径：`core/shim/moduleRegistry.ts` 的 `loadJsModule()` + `resolveLocalRequest()`
 * （路径工具同 `browserRuntime.ts` 的 `normalizeUrlPath()` / `dirname()`）。
 *
 * 逐字同构的三步：取源码 → `new Function(module, exports, require, process, global, Buffer,
 * __filename, __dirname, source)` 求值 → 相对 require 按同一候选顺序（原样 / `.js` / `.json` /
 * `/index.js`）从同一个根再解析。唯一差别是取源码的传输层：运行期是 `syncText()` 的同步 XHR
 * 按页面 origin 解析、**无文件系统回退**；这里是同一路径的读文件。二者对「同包内某个文件不在
 * 产物里」这一失败面完全一致——而那正是本批两处漏拷的真实形态。
 *
 * 为什么不是「只断言文件存在」：`stopword/lib/stopword.js` 首行即
 * `require('./stopwords_en.js')`，随后逐个 require 同包 19 个 `stopwords_*.js` 数据文件；
 * 只拷入口得到的恰恰是「文件在、加载失败」的假绿。
 */
function createShimLoader(rootDir) {
  const root = path.resolve(rootDir);
  const cache = new Map();
  // 运行态自带、**永远不可能**出现在产物里的裸模块（shim 的 bareModules 里也是宿主对象）。
  // electron-referer/index.js 首行就 require('electron')；按 shim 口径给一个宿主替身。
  // 出现其他非相对 require 一律判红——那意味着该包还有未交付的依赖。
  const hostProvided = new Set(['electron', '@electron/remote']);
  const bareRequests = new Set();

  const readText = (urlPath) => {
    const filePath = path.resolve(root, String(urlPath).replace(/^\//, ''));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;
    try {
      return fs.statSync(filePath).isFile() ? fs.readFileSync(filePath, 'utf8') : null;
    } catch (err) {
      return null;
    }
  };

  const normalizeUrlPath = (input) => {
    const out = [];
    for (const part of String(input || '').split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') { out.pop(); continue; }
      out.push(part);
    }
    return '/' + out.join('/');
  };

  const dirname = (value) => {
    const clean = String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const idx = clean.lastIndexOf('/');
    return idx <= 0 ? '/' : clean.slice(0, idx) || '/';
  };

  const resolveLocalRequest = (request, fromUrl) => {
    const joined = normalizeUrlPath(`${dirname(fromUrl)}/${request}`);
    for (const candidate of [joined, `${joined}.js`, `${joined}.json`, `${joined}/index.js`]) {
      if (readText(candidate) !== null) return candidate;
    }
    return joined;
  };

  const load = (urlPath) => {
    const key = normalizeUrlPath(urlPath);
    if (cache.has(key)) return cache.get(key);
    const source = readText(key);
    if (source === null) throw new Error(`shim 装载失败：产物内取不到源码 ${key}`);
    const module = { exports: {} };
    cache.set(key, module.exports);
    const localRequire = (request) => {
      const spec = String(request == null ? '' : request);
      if (spec.startsWith('./') || spec.startsWith('../')) return load(resolveLocalRequest(spec, key));
      if (hostProvided.has(spec)) { bareRequests.add(spec); return {}; }
      throw new Error(`shim 装载失败：${key} 出现产物外的裸 require(${spec})`);
    };
    let fn;
    try {
      fn = new Function('module', 'exports', 'require', 'process', 'global', 'Buffer', '__filename', '__dirname', source);
    } catch (err) {
      throw new Error(`shim 装载失败：${key} 源码无法求值：${err.message}`);
    }
    fn(
      module,
      module.exports,
      localRequire,
      { platform: process.platform, env: {} },
      globalThis,
      Buffer,
      key,
      dirname(key),
    );
    cache.set(key, module.exports);
    return module.exports;
  };

  return { load, bareRequests };
}

/** 递归列出目录下的相对文件路径（升序）——用于「源树 ↔ 复制结果」逐项对账。 */
function listFilesRecursive(directory, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFilesRecursive(path.join(directory, entry.name), relative));
    else out.push(relative);
  }
  return out.sort();
}

/** 待装载核查的清单子集：src/node_modules 全部条目 + src/package.json（从真实清单里取，不另写名单）。 */
function bareModuleManifestEntries(manifest = PUBLISH_ASSET_MANIFEST) {
  return manifest.filter(
    (entry) => entry.from.startsWith(nodeModulesPrefix) || entry.from === 'src/package.json',
  );
}

function copyBareModuleEntries(outDir, { workspaceRoot = projectRoot, manifest = PUBLISH_ASSET_MANIFEST } = {}) {
  return copyPublishAssets({ workspaceRoot, outDir, manifest: bareModuleManifestEntries(manifest) });
}

/** 在**已复制的产物**上按 shim 口径装载：入口取自 moduleRegistry.ts 实扫，装载失败即抛。 */
function loadBareModulesFrom(outDir, { workspaceRoot = projectRoot } = {}) {
  const loader = createShimLoader(outDir);
  const records = scanRegistryBareModules({ workspaceRoot });
  const loaded = records.map((record) => ({ ...record, exports: loader.load(record.entry) }));
  return { loader, records, loaded };
}

function temporaryRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function runNegativeProbe(kind) {
  if (kind === 'copy-missing-source') {
    const root = temporaryRoot('eagle-publish-missing-');
    try {
      fs.writeFileSync(path.join(root, 'present.txt'), 'present');
      await copyPublishAssets({
        workspaceRoot: root,
        outDir: path.join(root, 'out'),
        manifest: [{ from: 'missing.txt', to: 'missing.txt', kind: 'file' }],
      });
      throw new Error('负向探针意外成功：不存在的清单项没有抛错');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  if (kind === 'unregistered-manifest-entry') {
    const withoutJunk = PUBLISH_ASSET_MANIFEST.filter((entry) => entry.from !== 'src/my_modules/junk');
    auditMyModulesManifest({ manifest: withoutJunk });
    throw new Error('负向探针意外成功：仍被引用的 junk 从清单删除后没有报错');
  }
  if (kind === 'unregistered-bare-module') {
    const withoutStopword = PUBLISH_ASSET_MANIFEST.filter(
      (entry) => entry.from !== 'src/node_modules/stopword',
    );
    auditSrcNodeModulesManifest({ manifest: withoutStopword });
    throw new Error('负向探针意外成功：仍被 moduleRegistry.ts 登记的 stopword 从清单删除后没有报错');
  }
  if (kind === 'trimmed-bare-module') {
    const root = temporaryRoot('eagle-publish-trimmed-');
    try {
      const outDir = path.join(root, 'out');
      copyBareModuleEntries(outDir);
      // 只删一个**同包内的数据文件**（入口本身还在）：这正是「只挑 index.js 拷」的形态。
      const victim = path.join(outDir, 'src/node_modules/stopword/lib/stopwords_en.js');
      assert.ok(fs.existsSync(victim), `负向探针前置失败：产物里没有 ${victim}`);
      fs.rmSync(victim);
      loadBareModulesFrom(outDir).load('/src/node_modules/stopword/lib/stopword.js');
      throw new Error('负向探针意外成功：stopword 缺一个同包数据文件后装载仍然成功（假绿）');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  throw new Error(`未知负向探针: ${kind}`);
}

const negativeProbe = process.argv.find((argument) => argument.startsWith('--negative-probe='));
if (negativeProbe) {
  await runNegativeProbe(negativeProbe.slice('--negative-probe='.length));
}

test('清单显式登记 src/my_modules，且不再使用父目录整树条目', () => {
  assert.equal(PUBLISH_OUT_DIR, 'dist/frontend');
  assert.equal(
    PUBLISH_ASSET_MANIFEST.some((entry) => entry.from === 'src/my_modules'),
    false,
    '不得出现 from=src/my_modules 的整树复制条目',
  );
  const moduleEntries = PUBLISH_ASSET_MANIFEST.filter((entry) => entry.from.startsWith(modulePrefix));
  assert.ok(moduleEntries.length > 0, '必须显式登记 src/my_modules 条目');
  for (const entry of moduleEntries) {
    assert.equal(entry.to, entry.from, `my_modules 交付路径必须保持原 URL: ${entry.from}`);
    assert.ok(['file', 'tree'].includes(entry.kind), `my_modules 条目 kind 无效: ${entry.from}`);
  }
});

test('真实源码实扫：当前条目、登记项与退役归档三方一致', () => {
  const audit = auditMyModulesManifest();
  assert.ok(audit.actual.length > 0, 'src/my_modules 不应为空');
  assert.deepEqual(audit.actual, audit.registered, '当前 src/my_modules 条目必须与清单逐项一致');
  assert.deepEqual(
    audit.actual.filter((name) => audit.retired.includes(name)),
    [],
    '当前条目不得与退役归档重名',
  );
});

test('真实复制函数：清单源不存在时拒绝，不做静默跳过', (t) => {
  const root = temporaryRoot('eagle-publish-copy-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'present.txt'), 'present');
  assert.throws(
    () => copyPublishAssets({
      workspaceRoot: root,
      outDir: path.join(root, 'out'),
      manifest: [{ from: 'missing.txt', to: 'missing.txt', kind: 'file' }],
    }),
    /必需源资源不存在 missing\.txt/,
  );
});

test('负向自证：从清单删除仍存在的 junk 时对账必须变红', () => {
  const withoutJunk = PUBLISH_ASSET_MANIFEST.filter((entry) => entry.from !== 'src/my_modules/junk');
  assert.throws(
    () => auditMyModulesManifest({ manifest: withoutJunk }),
    /未登记的 src\/my_modules 条目: junk/,
  );
});

// ---------------------------------------------------------------------------
// M8-3：src/node_modules 真实裸模块的发布闭环
// ---------------------------------------------------------------------------

test('src/node_modules 登记与 moduleRegistry.ts 实扫逐项对账（期望由源码实扫得出）', () => {
  const audit = auditSrcNodeModulesManifest();
  assert.ok(audit.scanned.length > 0, '必须从 moduleRegistry.ts 实扫到真实裸模块登记');
  assert.deepEqual(
    audit.registered,
    audit.expected,
    '清单交付的 src/node_modules 包必须与 moduleRegistry.ts 实扫集合逐一相等',
  );
  // 登记清单是显式导出的（构建期不解析 TypeScript），实扫结果必须与之同集；
  // 三处都引用了同一个常量，此处只是把「导出常量 ↔ 源码实扫」这条链也钉住。
  assert.deepEqual(
    [...SRC_NODE_MODULE_PACKAGES].sort(),
    audit.expected,
    'SRC_NODE_MODULE_PACKAGES 必须与 moduleRegistry.ts 实扫结果同集',
  );
  for (const record of audit.scanned) {
    // 入口必须落在本包目录内——否则整包 tree 交付覆盖不到它，装载时仍是 404。
    assert.ok(
      record.relative.startsWith(`${nodeModulesPrefix}${record.pkg}/`),
      `入口必须落在本包内: ${record.entry}`,
    );
  }
  const entries = PUBLISH_ASSET_MANIFEST.filter((entry) => entry.from.startsWith(nodeModulesPrefix));
  for (const entry of entries) {
    assert.equal(entry.to, entry.from, `src/node_modules 交付路径必须保持原 URL: ${entry.from}`);
    assert.equal(entry.kind, 'tree', `src/node_modules 必须整包交付: ${entry.from}`);
  }
});

test('src/package.json 已登记进发布清单（运行期 syncText 读版本元数据的唯一来源）', () => {
  const entry = PUBLISH_ASSET_MANIFEST.find((candidate) => candidate.from === 'src/package.json');
  assert.ok(entry, 'src/package.json 必须登记进发布清单');
  assert.equal(entry.kind, 'file', 'src/package.json 应登记为单项文件');
  assert.equal(entry.to, 'src/package.json', '交付路径必须与运行期 appRoot.path + "/package.json" 一致');
  // 内容由 M7-3 精简为 version/buildVersion/buildNumber；本批不动它，但门禁要确认这三个字段还在
  // （运行期 8+ 处消费者读的正是它们，字段没了等于「文件在、元数据空」）。
  const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/package.json'), 'utf8'));
  for (const field of ['version', 'buildVersion', 'buildNumber']) {
    assert.ok(payload[field], `src/package.json 必须保留 ${field}`);
  }
});

test('产物侧真实装载：整包交付后三个裸模块可从复制结果加载，只拷入口则装载失败', (t) => {
  const root = temporaryRoot('eagle-publish-bare-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outDir = path.join(root, 'out');
  copyBareModuleEntries(outDir);

  const { loader, loaded } = loadBareModulesFrom(outDir);
  const byPkg = Object.fromEntries(loaded.map((record) => [record.pkg, record.exports]));

  // 逐项断言**真实导出形态**——装载“成功”但拿到空替身不算过。
  assert.equal(typeof byPkg['compare-versions'], 'function', 'compare-versions 应导出比较函数');
  assert.equal(byPkg['compare-versions']('1.0.0', '2.0.0'), -1, 'compare-versions 必须真实可比版本');
  assert.equal(byPkg['compare-versions']('2.1.0', '2.0.0'), 1);
  assert.equal(typeof byPkg['stopword'].removeStopwords, 'function', 'stopword 应导出 removeStopwords');
  assert.ok(Array.isArray(byPkg['stopword'].en) && byPkg['stopword'].en.length > 0, 'stopword 英文表必须为真实数据');
  assert.deepEqual(byPkg['stopword'].removeStopwords(['the', 'cat'], byPkg['stopword'].en), ['cat']);
  assert.equal(typeof byPkg['electron-referer'], 'function', 'electron-referer 应导出函数');
  assert.deepEqual([...loader.bareRequests], ['electron'], '除宿主提供的 electron 外不得有产物外的裸 require');

  // 「整包」不是顺手多拷了文件：逐包与源工作区实扫对账（期望值来自源码，不写死文件名/数量）。
  for (const record of loaded) {
    const from = path.join(projectRoot, nodeModulesPrefix, record.pkg);
    const to = path.join(outDir, nodeModulesPrefix, record.pkg);
    const sourceFiles = listFilesRecursive(from);
    assert.ok(sourceFiles.length > 0, `${record.pkg} 源目录不应为空`);
    assert.deepEqual(listFilesRecursive(to), sourceFiles, `${record.pkg} 必须整包交付（与源树逐项一致）`);
  }
  const stopwordData = fs.readdirSync(path.join(outDir, 'src/node_modules/stopword/lib'))
    .filter((name) => /^stopwords_[a-z]{2}\.js$/.test(name));
  assert.ok(stopwordData.length > 0, 'stopword 同包数据文件必须真的进产物（否则上面的对账是空转）');

  // 负向：删掉**一个同包数据文件**（入口本身还在）——这正是「只挑 index.js 拷」的形态，
  // 同一个装载口径必须响亮失败，而不是静默拿到空表。
  fs.rmSync(path.join(outDir, 'src/node_modules/stopword/lib/stopwords_en.js'));
  assert.throws(
    () => createShimLoader(outDir).load('/src/node_modules/stopword/lib/stopword.js'),
    /取不到源码 .*stopwords_en\.js/,
    '缺同包数据文件后装载必须失败（否则本门禁只是「文件存在」的橡皮章）',
  );
});

test('构建配置不存在 skip(absent) 或仅打印复制错误的旧路径', () => {
  const config = fs.readFileSync(path.join(projectRoot, 'frontend/vite.preview.config.mjs'), 'utf8');
  assert.doesNotMatch(config, /skip\s*\(absent\)/i);
  assert.doesNotMatch(config, /FAILED copying/i);
  assert.match(config, /copyPublishAssets\(/);
});
