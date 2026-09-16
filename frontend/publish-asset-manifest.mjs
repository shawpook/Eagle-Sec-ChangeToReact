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

export const PUBLISH_ASSET_MANIFEST = Object.freeze([
  { from: 'src/app', to: 'src/app', kind: 'app-runtime-tree' },
  ...MY_MODULE_ENTRIES.map((name) => ({
    from: `src/my_modules/${name}`,
    to: `src/my_modules/${name}`,
    kind: name.includes('.') ? 'file' : 'tree',
  })),
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
