/* ==========================================================================
   tab-bar 退役负向门禁（M7-2 / F02 · D24，2026-09-16）
   ---------------------------------------------------------------------------
   文件名保留为 `tab-bar-closed-loop.mjs` 属历史沿革——本文件原先是一份标签栏
   闭环 UI e2e，断言「主窗渲染出 #eagle-tab-bar」。但全仓从来没有加载入口，
   该 `waitFor` 注定 30s 超时（`waitFor` 默认 30000ms），是一份与实现脱钩的
   孤儿用例（未登记任何套件）。

   M7-2 依 D24 把 `frontend/public/tab-bar.{js,css}` 移出发布清单后，本文件按
   任务书要求**改造为负向门禁**——不是删除，也不是留下恒红用例：
   让「已退役」这件事有测试守着，防止日后被无意加回。

   检查面（**全部为负向断言**：命中即 FAIL）：
     S1  `frontend/public/` 下不得出现任何 tab-bar 命名文件
     S3  归档副本必须存在（回滚路径完好）
     S4  归档副本指纹必须与 RETIRED_SOURCE 登记值逐字一致
         （归档是冻结基线；改动归档必须同步改本文件的指纹，不允许悄悄漂移）
     S5  除 `docs/` 与 `tests/` 外的全部可执行/页面文件不得出现 tab-bar
     S6  门禁清单（FIRST_PARTY_SCRIPTS / ENGINE_SCRIPTS）不得重新登记 tab-bar
     A1  产物中不得出现任何 tab-bar 命名资源
     A2  产物中任何页面/脚本/样式不得引用 tab-bar

   扫描面口径（写清边界，不做静默跳过）：
     - S5 覆盖的扩展名 = 可被加载或引用的类型（html/js/mjs/cjs/ts/tsx/json/css）；
       纯文档（`.md`）不在其中，因为注释不构成加载点。
     - S5 **排除 `docs/`**：归档与台账是文档，其内容本身必须能提到 tab-bar。
     - S5 **排除 `tests/`**：测试不随产物交付，不是交付向量；本文件自身也在其中。
     - A1/A2 只在给定产物根（`--root=` 或默认 `dist/frontend`）存在时执行，
       不执行时输出「范围说明」而不是 FAIL。

   负向自证：`负向：…` 用例在临时目录里伪造「被加回」的若干形态（产物里出现
   tab-bar.js、页面引用它、源位置复活、归档被改写），断言 audit **必须**报错，
   同时用一棵干净隔离根断言 audit 不会恒红。故本门禁不是橡皮图章。
   ========================================================================== */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ENGINE_SCRIPTS, FIRST_PARTY_SCRIPTS } from './frontend-gate-manifest.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 退役对象的源路径 → 归档副本的 md5 指纹。改归档 = 必须同步改这里。 */
export const RETIRED_SOURCE = {
  'frontend/public/tab-bar.js': 'e36afeae6a484c7d0dd0273e26a16184',
  'frontend/public/tab-bar.css': 'da01f6cd42e55e3ad06292e02c6e9036',
};

/** 与 M7-1 共用归档根；归档路径 = `${ARCHIVE_ROOT}/${退役源路径}`。 */
export const ARCHIVE_ROOT = 'docs/retired-2026-09-16';

/** tab-bar / tab_bar / tabbar / tabBar / TabBar / TAB-BAR 一并命中。 */
const TAB_BAR_NAME = /tab[-_]?bar/i;

const SCAN_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.css']);
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'outputs', 'docs', 'tests', 'coverage',
  // .gitignore 里**非点开头**的顶层目录（点开头的由 shouldSkipDir 统一处理）：
  // 它们同样不是交付面，但原先没被跳过，于是本机的历史抓痕会让 S5 报假红。
  'test-run', 'screenshots', 'tests-tmp', '图片参考定位组件位置',
]);

/**
 * 是否跳过该目录。
 *
 * **点开头目录一律跳过**（`.git` / `.tmp` / `.workbuddy-ai` / `.zcode` / `.agents` …）：
 * 它们全是工具与抓痕目录，不是交付面。这一条是 M7-2 合并时补的——原实现只跳过上面那几个
 * 具名目录，于是本机 `.tmp/`、`tests-tmp/` 里的历史构建快照会让 S5 报假红：
 * **同一个提交在主工作区红、在全新 worktree 绿**，而那种门禁不可信。
 * 真实交付目录（`src` / `backend` / `electron` / `frontend` / `scripts` / `plugins`）
 * 都不是点开头，扫描面不受影响。
 */
function shouldSkipDir(name) {
  return name.startsWith('.') || SKIP_DIRS.has(name);
}

function walkFiles(root, predicate, skipDirs = null) {
  const found = [];
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const skip = skipDirs === null ? shouldSkipDir(entry.name) : skipDirs.has(entry.name);
        if (!skip) visit(full);
      } else if (entry.isFile() && predicate(full)) {
        found.push(full);
      }
    }
  };
  visit(root);
  return found;
}

function allFiles(root) {
  return walkFiles(root, () => true, new Set(['.git']));
}

function readTextIfAny(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function md5Of(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function statIsFile(full) {
  try {
    return fs.statSync(full).isFile();
  } catch {
    return false;
  }
}

/**
 * 只读审计：命中任何一条即产出 failures。不写仓库、不构建、不起浏览器。
 * `registry` 可注入，用于负向自证「清单被重新登记」这一条。
 */
export function auditTabBarRetirement({
  repoRoot = projectRoot,
  distRoot = null,
  registry = null,
} = {}) {
  const failures = [];
  const notes = [];
  const rel = (full) => path.relative(repoRoot, full).split(path.sep).join('/');

  /* ---- S1：源位置不得复活 ---- */
  for (const source of Object.keys(RETIRED_SOURCE)) {
    if (statIsFile(path.join(repoRoot, source))) {
      failures.push(`S1 已退役文件重新出现在源位置：${source}（tab-bar 已退出发布清单，不得回到 frontend/public）`);
    }
  }
  const publicDir = path.join(repoRoot, 'frontend/public');
  for (const file of walkFiles(publicDir, () => true, new Set())) {
    if (TAB_BAR_NAME.test(path.basename(file))) {
      failures.push(`S1 产物源目录出现 tab-bar 命名文件：${rel(file)}`);
    }
  }

  /* ---- S3 / S4：归档完整性（回滚路径） ---- */
  for (const [source, digest] of Object.entries(RETIRED_SOURCE)) {
    const archived = path.join(repoRoot, ARCHIVE_ROOT, source);
    if (!statIsFile(archived)) {
      failures.push(`S3 归档副本缺失，回滚路径断裂：${ARCHIVE_ROOT}/${source}`);
      continue;
    }
    const actual = md5Of(archived);
    if (actual !== digest) {
      failures.push(
        `S4 归档副本指纹漂移：${ARCHIVE_ROOT}/${source} 期望 ${digest}，实得 ${actual}；`
        + '归档是冻结的回滚基线，若确实要改归档，必须同步更新本文件的 RETIRED_SOURCE 指纹',
      );
    }
  }

  /* ---- S5：源码树零加载引用 ---- */
  for (const file of walkFiles(repoRoot, (full) => SCAN_EXTENSIONS.has(path.extname(full).toLowerCase()))) {
    const text = readTextIfAny(file);
    if (text === null) continue;
    const line = text.split(/\r?\n/).find((candidate) => TAB_BAR_NAME.test(candidate));
    if (line !== undefined) {
      failures.push(`S5 退役对象仍被可执行/页面文件提到：${rel(file)} → ${line.trim().slice(0, 120)}`);
    }
  }

  /* ---- S6：门禁清单不得重新登记 ---- */
  const registered = registry
    ?? [...FIRST_PARTY_SCRIPTS, ...ENGINE_SCRIPTS.map(([file]) => file)];
  for (const entry of registered) {
    if (TAB_BAR_NAME.test(entry)) {
      failures.push(`S6 门禁清单仍登记 tab-bar 条目：${entry}（退役后该条目必须一并删除）`);
    }
  }
  for (const source of Object.keys(RETIRED_SOURCE)) {
    if (registered.includes(source)) {
      failures.push(`S6 门禁清单登记了已退役源路径：${source}`);
    }
  }

  /* ---- A1 / A2：产物负向断言 ---- */
  if (distRoot === null) {
    notes.push('A1/A2 未执行：未提供产物根（用 --root=<dist> 指定，或先 npm run build 生成 dist/frontend）');
  } else if (!fs.existsSync(distRoot)) {
    failures.push(`A0 产物根不存在：${distRoot}`);
  } else {
    for (const file of allFiles(distRoot)) {
      if (TAB_BAR_NAME.test(path.basename(file))) {
        failures.push(`A1 产物中仍交付 tab-bar 资源：${path.relative(distRoot, file).split(path.sep).join('/')}`);
      }
    }
    for (const file of allFiles(distRoot)) {
      if (!SCAN_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      const text = readTextIfAny(file);
      if (text === null) continue;
      const line = text.split(/\r?\n/).find((candidate) => TAB_BAR_NAME.test(candidate));
      if (line !== undefined) {
        failures.push(`A2 产物中有文件引用 tab-bar：${path.relative(distRoot, file).split(path.sep).join('/')} → ${line.trim().slice(0, 120)}`);
      }
    }
  }

  return { ok: failures.length === 0, failures, notes };
}

/* =========================== 真实仓库断言 =========================== */

test('真实仓库：tab-bar 源码侧已完成退役（无源文件、无加载引用、无清单登记）', () => {
  const result = auditTabBarRetirement();
  assert.deepEqual(result.failures, [], result.failures.join('\n'));
});

test('真实仓库：归档副本存在且指纹逐字一致（回滚路径完好）', () => {
  for (const [source, digest] of Object.entries(RETIRED_SOURCE)) {
    const archived = path.join(projectRoot, ARCHIVE_ROOT, source);
    assert.ok(statIsFile(archived), `归档副本缺失：${ARCHIVE_ROOT}/${source}`);
    assert.equal(md5Of(archived), digest, `归档副本指纹漂移：${ARCHIVE_ROOT}/${source}`);
  }
});

test('真实产物：dist/frontend 不存在或已构建，均不得交付 tab-bar', () => {
  const defaultDist = path.join(projectRoot, 'dist/frontend');
  if (!fs.existsSync(defaultDist)) {
    // 未构建时不伪装成通过：显式登记为范围说明，由 --dist 子命令或构建后复跑补齐。
    const result = auditTabBarRetirement();
    assert.deepEqual(result.failures, [], result.failures.join('\n'));
    assert.ok(result.notes.some((note) => /A1\/A2 未执行/.test(note)), '未构建时必须显式声明产物断言未执行');
    return;
  }
  const result = auditTabBarRetirement({ distRoot: defaultDist });
  assert.deepEqual(result.failures, [], result.failures.join('\n'));
});

/* =========================== 负向自证 =========================== */

function makeFixture(t, { files = {}, dist = null, registry = null } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-tabbar-gate-repo-'));
  const distDir = dist === null ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-tabbar-gate-dist-'));
  const plant = (root, relative, contents) => {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };
  for (const [relative, contents] of Object.entries(files)) plant(repo, relative, contents);
  for (const [relative, contents] of Object.entries(dist || {})) plant(distDir, relative, contents);
  // 归档基线：默认把真实归档副本复制进隔离根，保证「干净根不恒红」这条前提成立。
  for (const source of Object.keys(RETIRED_SOURCE)) {
    const archived = path.join(repo, ARCHIVE_ROOT, source);
    fs.mkdirSync(path.dirname(archived), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, ARCHIVE_ROOT, source), archived);
  }
  t.after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    if (distDir !== null) fs.rmSync(distDir, { recursive: true, force: true });
  });
  return { repoRoot: repo, distRoot: distDir, registry };
}

test('负向自证：干净的隔离根必须零失败（门禁不是恒红橡皮章）', (t) => {
  const { repoRoot, distRoot, registry } = makeFixture(t, { dist: { 'index.html': '<html></html>' }, registry: [] });
  const result = auditTabBarRetirement({ repoRoot, distRoot, registry });
  assert.deepEqual(result.failures, [], result.failures.join('\n'));
});

test('负向自证：源位置复活 frontend/public/tab-bar.js 必须变红', (t) => {
  const { repoRoot, distRoot, registry } = makeFixture(t, {
    files: { 'frontend/public/tab-bar.js': '(function(){})();' },
    registry: [],
  });
  const result = auditTabBarRetirement({ repoRoot, distRoot, registry });
  assert.ok(result.failures.some((failure) => failure.startsWith('S1')), result.failures.join('\n'));
});

test('负向自证：把 tab-bar.js 放回产物必须变红', (t) => {
  const { repoRoot, distRoot, registry } = makeFixture(t, {
    dist: { 'tab-bar.js': '(function(){})();', 'index.html': '<html></html>' },
    registry: [],
  });
  const result = auditTabBarRetirement({ repoRoot, distRoot, registry });
  assert.ok(result.failures.some((failure) => failure.startsWith('A1')), result.failures.join('\n'));
});

test('负向自证：产物页面引用 tab-bar 必须变红', (t) => {
  const { repoRoot, distRoot, registry } = makeFixture(t, {
    dist: { 'index.html': '<html><script src="/tab-bar.js"></script></html>' },
    registry: [],
  });
  const result = auditTabBarRetirement({ repoRoot, distRoot, registry });
  assert.ok(result.failures.some((failure) => failure.startsWith('A2')), result.failures.join('\n'));
});

test('负向自证：源码里重新引入加载语句必须变红', (t) => {
  const cases = {
    'script 标签': { 'src/app/loader.html': '<script src="/tab-bar.js"></script>' },
    'link 标签': { 'src/app/loader.html': '<link rel="stylesheet" href="/tab-bar.css">' },
    'ESM import': { 'src/app/loader.mjs': "import './tab-bar.js';" },
    'require': { 'src/app/loader.cjs': "require('./tab-bar.js');" },
    'importScripts': { 'src/app/js/loader.js': "importScripts('/tab-bar.js');" },
    'new Worker': { 'src/app/js/loader.js': "new Worker('/tab-bar.js');" },
    'import.meta.glob': { 'src/app/loader.ts': "import.meta.glob('./tab-bar.css');" },
  };
  for (const [label, files] of Object.entries(cases)) {
    const { repoRoot, distRoot, registry } = makeFixture(t, { files, registry: [] });
    const result = auditTabBarRetirement({ repoRoot, distRoot, registry });
    assert.ok(result.failures.some((failure) => failure.startsWith('S5')), `${label} 形态应被 S5 捕获：${result.failures.join('\n')}`);
  }
});

test('负向自证：清单被重新登记必须变红', (t) => {
  const { repoRoot, distRoot } = makeFixture(t, { registry: [] });
  const result = auditTabBarRetirement({
    repoRoot,
    distRoot,
    registry: ['frontend/public/tab-bar.js'],
  });
  assert.ok(result.failures.some((failure) => failure.startsWith('S6')), result.failures.join('\n'));
});

test('负向自证：归档被改写（指纹漂移）必须变红', (t) => {
  const { repoRoot, distRoot, registry } = makeFixture(t, { registry: [] });
  fs.writeFileSync(path.join(repoRoot, ARCHIVE_ROOT, 'frontend/public/tab-bar.js'), '/* 被改写 */');
  const result = auditTabBarRetirement({ repoRoot, distRoot, registry });
  assert.ok(result.failures.some((failure) => failure.startsWith('S4')), result.failures.join('\n'));
});

test('负向自证：归档副本缺失（回滚路径断裂）必须变红', (t) => {
  const { repoRoot, distRoot, registry } = makeFixture(t, { registry: [] });
  fs.rmSync(path.join(repoRoot, ARCHIVE_ROOT, 'frontend/public/tab-bar.css'));
  const result = auditTabBarRetirement({ repoRoot, distRoot, registry });
  assert.ok(result.failures.some((failure) => failure.startsWith('S3')), result.failures.join('\n'));
});

/* =========================== 运行方式 ===========================
   与 `tests/frontend-public-policy.mjs` 同一约定：纯 node:test，无 CLI 参数，
   `node tests/tab-bar-closed-loop.mjs` 即全部用例（真实仓库 + 真实产物 + 负向自证）。
   */
