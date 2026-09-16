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
  copyPublishAssets,
} from '../frontend/publish-asset-manifest.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesRoot = path.join(projectRoot, 'src/my_modules');
const retiredModulesRoot = path.join(projectRoot, 'docs/retired-2026-09-16/src/my_modules');
const modulePrefix = 'src/my_modules/';

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

test('构建配置不存在 skip(absent) 或仅打印复制错误的旧路径', () => {
  const config = fs.readFileSync(path.join(projectRoot, 'frontend/vite.preview.config.mjs'), 'utf8');
  assert.doesNotMatch(config, /skip\s*\(absent\)/i);
  assert.doesNotMatch(config, /FAILED copying/i);
  assert.match(config, /copyPublishAssets\(/);
});
