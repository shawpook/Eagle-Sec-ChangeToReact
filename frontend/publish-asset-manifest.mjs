import fs from 'node:fs';
import path from 'node:path';

/**
 * M7-3: the single source of truth for runtime assets copied after the Vite build.
 *
 * `from` and `to` are workspace-relative paths. Every entry is required: a missing
 * source or a failed copy aborts the build. Do not replace the explicit
 * `src/my_modules` entries with the parent directory again.
 */
export const PUBLISH_OUT_DIR = 'dist/frontend';

const MY_MODULE_ENTRIES = [
  'cartesian-product',
  'chinese_convert',
  'is-network-drive',
  'junk',
  'pinyinlite',
  'raw-parser',
  'tiny-pinyin',
  'utif',
];

/**
 * M8-3：`src/node_modules` 下被 `core/shim/moduleRegistry.ts` 登记为**真实裸模块**的包
 * （`requireModule()` 里 `realBareModule(req, '/src/node_modules/<包>/<入口>')` 那几条）。
 *
 * 为什么必须整包（kind=tree）而不是只挑入口文件：这些模块在运行期由 shim 逐个 XHR 取源码
 * 再 `new Function` 求值，相对 require 走 `resolveLocalRequest()` 从**同一 origin**再取一次
 * ——只拷入口会得到「文件在、加载失败」的假绿。实测：`stopword/lib/stopword.js` 首行就
 * `require('./stopwords_en.js')`，并逐个 require 同包的 19 个 `stopwords_*.js` 数据文件。
 *
 * 期望集合由 `tests/publish-asset-manifest.mjs` 对 `moduleRegistry.ts` **实扫对账**得出，
 * 不是在这里写死一份与源码脱钩的名单（同 MY_MODULE_ENTRIES 的既有口径）。
 */
export const SRC_NODE_MODULE_PACKAGES = [
  'compare-versions',
  'stopword',
  'electron-referer',
];

export const PUBLISH_ASSET_MANIFEST = Object.freeze([
  { from: 'src/app', to: 'src/app', kind: 'app-runtime-tree' },
  ...MY_MODULE_ENTRIES.map((name) => ({
    from: `src/my_modules/${name}`,
    to: `src/my_modules/${name}`,
    kind: name.includes('.') ? 'file' : 'tree',
  })),
  ...SRC_NODE_MODULE_PACKAGES.map((name) => ({
    from: `src/node_modules/${name}`,
    to: `src/node_modules/${name}`,
    kind: 'tree',
  })),
  // M8-3：运行期 8+ 处用 `req(appRoot.path + '/package.json')`（appRoot.path 恒为 `/src`）
  // 读版本元数据，读法是 syncText（同步 XHR、按页面 origin 解析、无文件系统回退）⇒ 产物里
  // 没有它就是 404，version/buildVersion 全空。M7-3 已把它精简到只剩
  // version/buildVersion/buildNumber（本批不再改动该文件的内容）。
  { from: 'src/package.json', to: 'src/package.json', kind: 'file' },
  { from: 'src/i18n', to: 'src/i18n', kind: 'tree' },
  { from: 'src/config.js', to: 'src/config.js', kind: 'file' },
  {
    from: 'frontend/public/replaced/registration.html',
    to: 'src/app/registration.html',
    kind: 'file',
  },
  {
    from: 'frontend/public/replaced/manage-device.html',
    to: 'src/app/manage-device.html',
    kind: 'file',
  },
]);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function copyTree(source, destination, filter) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (filter && !filter(sourcePath, entry)) continue;
    if (entry.isDirectory()) copyTree(sourcePath, destinationPath, filter);
    else fs.copyFileSync(sourcePath, destinationPath);
  }
}

export function assertPublishAssetManifest(manifest = PUBLISH_ASSET_MANIFEST, workspaceRoot) {
  const seenSources = new Set();
  const seenDestinations = new Set();
  for (const [index, entry] of manifest.entries()) {
    const label = `发布资产清单[${index}]`;
    if (!entry || typeof entry.from !== 'string' || !entry.from.trim()) {
      throw new Error(`${label}: from 必须是非空路径`);
    }
    if (typeof entry.to !== 'string' || !entry.to.trim()) {
      throw new Error(`${label}: to 必须是非空路径`);
    }
    if (!['file', 'tree', 'app-runtime-tree'].includes(entry.kind)) {
      throw new Error(`${label}: 未知 kind ${JSON.stringify(entry.kind)}`);
    }
    if (seenSources.has(entry.from)) throw new Error(`${label}: 重复源路径 ${entry.from}`);
    if (seenDestinations.has(entry.to)) throw new Error(`${label}: 重复目标路径 ${entry.to}`);
    seenSources.add(entry.from);
    seenDestinations.add(entry.to);

    const sourcePath = path.resolve(workspaceRoot, entry.from);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`${label}: 必需源资源不存在 ${entry.from}`);
    }
    const sourceStat = fs.statSync(sourcePath);
    if (entry.kind === 'file' && !sourceStat.isFile()) {
      throw new Error(`${label}: 登记为 file 但源不是文件 ${entry.from}`);
    }
    if (entry.kind === 'tree' && !sourceStat.isDirectory()) {
      throw new Error(`${label}: 登记为 tree 但源不是目录 ${entry.from}`);
    }
  }
}

export function copyPublishAssets({
  workspaceRoot,
  outDir,
  manifest = PUBLISH_ASSET_MANIFEST,
  appRuntimeHtmlExcludes = new Set(),
} = {}) {
  if (!workspaceRoot) throw new Error('复制发布资产需要 workspaceRoot');
  if (!outDir) throw new Error('复制发布资产需要 outDir');
  assertPublishAssetManifest(manifest, workspaceRoot);

  let copied = 0;
  const excludedHtml = new Set([...appRuntimeHtmlExcludes].map((value) => value.replace(/\\/g, '/')));
  for (const entry of manifest) {
    const sourcePath = path.resolve(workspaceRoot, entry.from);
    const destinationPath = path.resolve(outDir, entry.to);
    if (entry.kind === 'file') {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);
    } else {
      copyTree(sourcePath, destinationPath, (candidatePath) => {
        if (entry.kind !== 'app-runtime-tree') return true;
        const relativePath = toPosix(path.relative(workspaceRoot, candidatePath));
        if (relativePath === 'src/app/react' || relativePath.startsWith('src/app/react/')) return false;
        if (candidatePath.endsWith('.html') && excludedHtml.has(relativePath)) return false;
        return true;
      });
    }
    copied += 1;
  }
  return { copied };
}
