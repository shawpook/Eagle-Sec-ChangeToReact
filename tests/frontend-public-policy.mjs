/**
 * M5-1（F17/F22）：`frontend/public` 页面归属策略门禁。
 *
 * 背景：`frontend/public` 既被 Vite `publicDir` 整目录复制，又是「页面源码」的落点，
 * 于是长期存在一类隐性债务——某个页面到底属于
 *   1) 交付路径 = public 路径的普通静态页，
 *   2) 源码在 public、但真实 URL 在别处（`replaced/*`），
 *   3) 显式豁免（纯静态、不进模块图），
 * 还是 4) 干脆没人管过。四者在目录列表上长得一模一样，删测试/删登记都不会有人发现。
 *
 * 本测试把这张分账写成**可执行的不变量**：
 *   - `frontend/public/**\/*.html` 每一个都必须恰好落进上面 1/2/3 之一，否则报错（堵住第 4 类）；
 *   - `SUPPORTED_PAGES` 的 `url` 必须真的在 `DIST_POLICY.pages` 里（否则闭包门禁根本不会检查它）；
 *   - `SUPPORTED_PAGES` 的 `consumer` 必须真的引用该 url（反向校验，防止台账退化成垃圾）；
 *   - `PUBLIC_PAGE_EXEMPTIONS` 的文件必须真实存在，且不得同时被登记为 REACT_PAGES（不能两头占）；
 *   - 两张表的 reason/consumer/exit 一律非空。
 *
 * 本测试只读源码与清单，不构建、不起浏览器。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DIST_POLICY, PUBLIC_PAGE_EXEMPTIONS, REACT_PAGES, STATIC_PAGES, SUPPORTED_PAGES,
} from './frontend-gate-manifest.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, predicate));
    else if (predicate(full)) found.push(full);
  }
  return found;
}

/** 台账里的 consumer 一律写成 `路径:行号（说明）`；取第一个 `:数字` 之前的片段作为文件路径。 */
export function consumerFileOf(consumer) {
  const match = typeof consumer === 'string' ? consumer.match(/^([^\s（(]+?):(\d+)/) : null;
  return match ? match[1] : null;
}

export function auditPublicPolicy({
  root = projectRoot,
  policy = {
    staticPages: STATIC_PAGES,
    reactPages: REACT_PAGES,
    distPages: DIST_POLICY.pages,
    supportedPages: SUPPORTED_PAGES,
    exemptions: PUBLIC_PAGE_EXEMPTIONS,
  },
} = {}) {
  const errors = [];
  const rel = (full) => path.relative(root, full).split(path.sep).join('/');
  const read = (file) => { try { return fs.readFileSync(path.join(root, file), 'utf8'); } catch { return null; } };

  const supportedBySource = new Map();
  for (const [index, entry] of policy.supportedPages.entries()) {
    const label = `SUPPORTED_PAGES[${index}]`;
    const blank = ['url', 'source', 'reason', 'consumer', 'exit']
      .filter((field) => typeof entry?.[field] !== 'string' || !entry[field].trim());
    if (blank.length) { errors.push(`${label}：url/source/reason/consumer/exit 必须非空，缺 ${blank.join('/')}`); continue; }
    if (!policy.distPages.includes(entry.url)) {
      errors.push(`${label}（${entry.url}）：未并入 DIST_POLICY.pages，产物闭包门禁不会检查它`);
    }
    if (read(entry.source) === null) errors.push(`${label}（${entry.url}）：源码 ${entry.source} 不存在`);
    const consumerFile = consumerFileOf(entry.consumer);
    const consumerText = consumerFile ? read(consumerFile) : null;
    if (consumerText === null) {
      errors.push(`${label}（${entry.url}）：consumer 未按「路径:行号」书写或指向的文件不存在（${entry.consumer}）`);
    } else if (!consumerText.includes(entry.url)) {
      errors.push(`${label}（${entry.url}）：consumer ${consumerFile} 中已不存在对该 URL 的引用，台账失效`);
    }
    if (supportedBySource.has(entry.source)) errors.push(`${label}：源码 ${entry.source} 被重复登记`);
    supportedBySource.set(entry.source, entry);
  }

  const exemptFiles = new Set();
  for (const [index, entry] of policy.exemptions.entries()) {
    const label = `PUBLIC_PAGE_EXEMPTIONS[${index}]`;
    const blank = ['file', 'reason', 'consumer', 'exit']
      .filter((field) => typeof entry?.[field] !== 'string' || !entry[field].trim());
    if (blank.length) { errors.push(`${label}：file/reason/consumer/exit 必须非空，缺 ${blank.join('/')}`); continue; }
    if (!entry.file.startsWith('frontend/public/')) {
      errors.push(`${label}（${entry.file}）：豁免只适用于 frontend/public 下的页面`);
      continue;
    }
    if (read(entry.file) === null) errors.push(`${label}：豁免页面 ${entry.file} 已不存在，必须删除本条`);
    const publicRel = entry.file.slice('frontend/public/'.length);
    if (policy.reactPages.includes(publicRel)) {
      errors.push(`${label}（${entry.file}）：同时登记为 REACT_PAGES——不能既声明"不进模块图"又声明"已进模块图"`);
    }
    if (exemptFiles.has(entry.file)) errors.push(`${label}：重复豁免 ${entry.file}`);
    exemptFiles.add(entry.file);
  }

  const publicHtml = walk(path.join(root, 'frontend/public'), (file) => /\.html?$/i.test(file)).map(rel).sort();
  const owners = new Map();
  for (const file of publicHtml) {
    const publicRel = file.slice('frontend/public/'.length);
    const owner = supportedBySource.has(file) ? 'supported'
      : exemptFiles.has(file) ? 'exempt'
        : policy.distPages.includes(publicRel) ? 'public-delivered' : null;
    if (owner === null) {
      errors.push(`外围页面未分账：${file} 既不在 DIST_POLICY.pages（按 public 路径交付），`
        + '也不在 SUPPORTED_PAGES / PUBLIC_PAGE_EXEMPTIONS——请显式取舍后登记');
      continue;
    }
    owners.set(file, owner);
  }
  return { errors, publicHtml, owners };
}

function fixture(t, { files = {}, policy }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-m51-policy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, contents] of Object.entries(files)) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return { root, defaultPolicy: policy };
}

const baseFiles = {
  'frontend/public/pages.html': '<a href="/src/app/registration.html">注册</a>',
  'frontend/public/replaced/registration.html': '<base href="/src/app/">',
};
const basePolicy = {
  staticPages: ['pages.html', 'replaced/registration.html'],
  reactPages: [],
  distPages: ['pages.html', 'replaced/registration.html', 'src/app/registration.html'],
  supportedPages: [{
    url: 'src/app/registration.html',
    source: 'frontend/public/replaced/registration.html',
    reason: '正式支持',
    consumer: 'frontend/public/pages.html:1（链接）',
    exit: '迁入模块图时删除',
  }],
  exemptions: [{
    file: 'frontend/public/pages.html',
    reason: '纯静态导航',
    consumer: '人工入口页',
    exit: '携带脚本时迁入模块图',
  }],
};

test('真实仓库：public 页面分账自洽，无未取舍页面', () => {
  const result = auditPublicPolicy();
  assert.deepEqual(result.errors, []);
  assert.ok(result.publicHtml.length > 0, '应当至少有一个 public 页面受本门禁覆盖');
});

test('隔离根：三类归属各自识别正确', (t) => {
  const { root, defaultPolicy } = fixture(t, { files: baseFiles, policy: basePolicy });
  const result = auditPublicPolicy({ root, policy: defaultPolicy });
  assert.deepEqual(result.errors, []);
  assert.equal(result.owners.get('frontend/public/pages.html'), 'exempt');
  assert.equal(result.owners.get('frontend/public/replaced/registration.html'), 'supported');
});

test('隔离根：public 下新增未取舍页面必须报错', (t) => {
  const { root, defaultPolicy } = fixture(t, {
    files: { ...baseFiles, 'frontend/public/orphan.html': '<p>没人管</p>' },
    policy: basePolicy,
  });
  const result = auditPublicPolicy({ root, policy: defaultPolicy });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /外围页面未分账：frontend\/public\/orphan\.html/);
});

test('隔离根：豁免页面已删除必须报错（台账不得残留）', (t) => {
  const files = { ...baseFiles };
  delete files['frontend/public/pages.html'];
  const { root, defaultPolicy } = fixture(t, { files, policy: basePolicy });
  const result = auditPublicPolicy({ root, policy: defaultPolicy });
  assert.ok(result.errors.some((error) => /豁免页面 frontend\/public\/pages\.html 已不存在/.test(error)), result.errors.join('\n'));
});

test('隔离根：不能既豁免又声明已进模块图', (t) => {
  const policy = { ...basePolicy, reactPages: ['pages.html'] };
  const { root } = fixture(t, { files: baseFiles, policy });
  const result = auditPublicPolicy({ root, policy });
  assert.ok(result.errors.some((error) => /同时登记为 REACT_PAGES/.test(error)), result.errors.join('\n'));
});

test('隔离根：SUPPORTED_PAGES 的 url 未并入产物清单必须报错', (t) => {
  const policy = { ...basePolicy, distPages: ['pages.html', 'replaced/registration.html'] };
  const { root } = fixture(t, { files: baseFiles, policy });
  const result = auditPublicPolicy({ root, policy });
  assert.ok(result.errors.some((error) => /未并入 DIST_POLICY\.pages/.test(error)), result.errors.join('\n'));
});

test('隔离根：consumer 不再引用该 URL 时台账失效必须报错', (t) => {
  const files = { ...baseFiles, 'frontend/public/pages.html': '<p>链接已被删掉</p>' };
  const { root, defaultPolicy } = fixture(t, { files, policy: basePolicy });
  const result = auditPublicPolicy({ root, policy: defaultPolicy });
  assert.ok(result.errors.some((error) => /已不存在对该 URL 的引用/.test(error)), result.errors.join('\n'));
});

test('隔离根：reason/consumer/exit 缺失必须报错', (t) => {
  const policy = {
    ...basePolicy,
    exemptions: [{ file: 'frontend/public/pages.html', reason: '  ', consumer: 'x', exit: 'y' }],
  };
  const { root } = fixture(t, { files: baseFiles, policy });
  const result = auditPublicPolicy({ root, policy });
  assert.ok(result.errors.some((error) => /必须非空，缺 reason/.test(error)), result.errors.join('\n'));
});

test('consumerFileOf：按「路径:行号」取文件，取不到返回 null', () => {
  assert.equal(consumerFileOf('frontend/public/pages.html:62（链接）'), 'frontend/public/pages.html');
  assert.equal(consumerFileOf('没有行号的自由文本'), null);
});
