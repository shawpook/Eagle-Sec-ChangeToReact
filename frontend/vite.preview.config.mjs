import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, '../');
const frontendPublic = path.resolve(here, 'public');
// R5：文档查看器已从 frontend/document-viewer 迁入 src/app/react/viewers/document
// （与其余六个查看器同址；其源码本就在 typecheck 的 src/app/react 范围内，迁移后不再需要
// tsconfig 的独立 include 条目）。
const documentViewerEntry = path.resolve(workspaceRoot, 'src/app/react/viewers/document/index.html');
const thumbnailTarget = process.env.EAGLE_THUMBNAIL_URL || 'http://localhost:41692';
const apiTarget = process.env.EAGLE_API_URL || 'http://localhost:41695';
const extensionTarget = process.env.EAGLE_EXTENSION_URL || 'http://localhost:41693';

// @vitejs/plugin-react 的 refresh preamble 通常经 transformIndexHtml 注入；本仓的
// /src/app/*.html 走自定义中间件直出、绕过该钩子，因此这里手动补同一段内联脚本，
// 否则被转换的 .tsx 会在运行时抛 "can't detect preamble"，导致整条 React import 链失败。
const REACT_REFRESH_PREAMBLE = `<script type="module">
      import RefreshRuntime from "/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>`;

// b1-9bz-E9（P5）：mock-data.js / shims.js 注入摘除——启动契约（require/process/i18n/
// electronSettings/总线/种子）已全量迁 src/app/react/core/shimsLegacy.ts，由各 React 入口
// 第一 import 供给。仅保留后端地址内联配置。
function injectPreviewScripts(html) {
  return html.replace(
    '<head>',
    `<head>\n    <script>window.__EAGLE_API_BASE_URL=${JSON.stringify(apiTarget)};window.__EAGLE_EXTENSION_BASE_URL=${JSON.stringify(extensionTarget)};</script>`
  );
}

// R1：React 入口已写入各页源 HTML（`<script type="module" src="/src/app/react/...">`），
// 因此开发态不再注入入口脚本，只补 react-refresh 前置脚本（该钩子在 dev 由 plugin-react
// 注入，但这些页面走自定义中间件直出、绕过它）。生产构建由 Vite 正常处理源 HTML 的入口。
function injectDevPreamble(html) {
  return html.replace('</head>', `    ${REACT_REFRESH_PREAMBLE}\n</head>`);
}

function readEntryPage(file) {
  return injectDevPreamble(injectPreviewScripts(fs.readFileSync(file, 'utf8')));
}

// b1-9af：viewer 窗接管通用路由——iframe 查看器页逐个切 React 后在此登记
// （壳 HTML 保留，旧控制脚本摘除，入口由本表注入；generic route 统一处理）。
const REACT_VIEWER_ENTRIES = {
  '/src/app/exif-viewer/index.html': '/src/app/react/viewers/exif/entry.tsx',
  '/src/app/raw-viewer/index.html': '/src/app/react/viewers/raw/entry.tsx',
  '/src/app/native-viewer/index.html': '/src/app/react/viewers/native/entry.tsx',
  '/src/app/gif-viewer/index.html': '/src/app/react/viewers/gif/entry.tsx',
  '/src/app/text-editor/text-editor.html': '/src/app/react/viewers/text-editor/entry.tsx',
  '/src/app/font-viewer/font-viewer.html': '/src/app/react/viewers/font/entry.tsx',
};

// R1：正式构建的多页入口表——以「工作区相对路径」为键；入口脚本同时写在源 HTML 中，
// build 经 rollupOptions.input + transformIndexHtml（仅补 API 地址/collect 清洗）产出。
const REACT_PAGE_ENTRIES = {
  'src/app/index.html': '/src/app/react/main.tsx',
  'src/app/preferences.html': '/src/app/react/preferences/entry.tsx',
  'src/app/preview-window.html': '/src/app/react/preview-window/entry.tsx',
  'src/app/collect-window/index.html': '/src/app/react/collect-window/entry.tsx',
  ...Object.fromEntries(
    Object.entries(REACT_VIEWER_ENTRIES).map(([url, entry]) => [url.replace(/^\//, ''), entry]),
  ),
};

function injectViewerConfig(html) {
  return html.replace(
    '<head>',
    `<head>\n    <script>window.__EAGLE_API_BASE_URL=${JSON.stringify(apiTarget)};window.__EAGLE_THUMBNAIL_URL=${JSON.stringify(thumbnailTarget)};</script>`
  );
}

// R6：sanitizeCollectTemplates / allowSingleColorPalette 一并删除——两个中间件改写的都是
// 已退役的 Angular 模板：前者修 `ng-mouseup="ng-mouseup="`（旧采集模板产物，全仓 0 命中），
// 后者把 `selected[0].palettes.length <= 1` 改成 `=== 0`（唯一命中在
// src/app/js/directives/inspector.html，该文件已随本批 git rm）。二者现状均为 no-op，
// 且只作用于 collect 分支。「单色面板」修复语义已归位 React 侧
// （components/inspector/Inspector.tsx 的 paletteShow）。

function readReplacement(name) {
  return fs.readFileSync(path.join(frontendPublic, 'replaced', name), 'utf8');
}

// R1：把页面在运行时仍按相对路径/`/src/...` 路径引用的资源交付到产物（页面 HTML 由 Vite 产出，
// 故 src/app 下排除 .html；src/app/react 已打包，排除）。appRoot 为 `/src`，运行时 require 会取
// `/src/config.js`、`/src/i18n`、`/src/my_modules/*`、`/src/app/js/*`（见 shimsLegacy 的 require 链）。
//
// 注：不用 fs.cpSync——在本机（Windows/Node 22）复制含 `.node` 原生二进制的 src/my_modules 时
// 会令进程硬崩（exit 127，无异常）；手工遍历复制稳定。
function copyTree(from, to, filter) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (filter && !filter(src)) continue;
    if (entry.isDirectory()) copyTree(src, dst, filter);
    else fs.copyFileSync(src, dst);
  }
}

export default defineConfig({
  root: workspaceRoot,
  base: '/',
  publicDir: frontendPublic,
  plugins: [
    react(),
    {
      name: 'eagle-preview-shims',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url || '').split('?')[0]);
          if (url === '/') {
            res.statusCode = 302;
            res.setHeader('Location', '/src/app/index.html');
            res.end();
            return;
          }
          if (url === '/src/app/index.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/index.html')));
            return;
          }
          if (url === '/src/app/preferences.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/preferences.html')));
            return;
          }
          if (url === '/src/app/preview-window.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/preview-window.html')));
            return;
          }
          if (url === '/src/app/collect-window/index.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/collect-window/index.html')));
            return;
          }
          if (url === '/src/app/registration.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readReplacement('registration.html'));
            return;
          }
          if (url === '/src/app/manage-device.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readReplacement('manage-device.html'));
            return;
          }
          // R5：文档查看器迁入 /src/app/react/viewers/document 后，其 HTML 落在 /src/app/ 前缀下，
          // 会被下面的通用「其余页」分支截走——而那分支补的是 API+EXTENSION 与 collect 清洗，
          // 与它迁移前经 Vite 原生 HTML 管线拿到的注入面不同（transformIndexHtml 的
          // injectViewerConfig 注入 API+THUMBNAIL）。此处显式复刻原注入面，再手工补 refresh
          // 前置（中间件直出会绕过 plugin-react 的 index.html 钩子）。
          if (url === '/src/app/react/viewers/document/index.html') {
            const file = path.join(workspaceRoot, url);
            if (fs.existsSync(file)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(injectDevPreamble(injectViewerConfig(fs.readFileSync(file, 'utf8'))));
              return;
            }
          }
          if (url.startsWith('/src/app/') && url.endsWith('.html')) {
            // R1：viewer/其余页的 React 入口已写入源 HTML，这里只补 API 地址与 refresh 前置脚本。
            const file = path.join(workspaceRoot, url);
            if (fs.existsSync(file)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(readEntryPage(file));
              return;
            }
          }
          if (url.startsWith('/src/app/pdf-viewer/') && url.endsWith('.js')) {
            const file = path.join(workspaceRoot, url);
            if (fs.existsSync(file)) {
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              res.end(fs.readFileSync(file, 'utf8'));
              return;
            }
          }
          next();
        });
      },
      transformIndexHtml(html, ctx) {
        if (html.includes('<title>Eagle Document Viewer</title>')) {
          return injectViewerConfig(html);
        }
        // R1：正式构建按文件路径补 API 地址（React 入口已在源 HTML 中，由 Vite 正常打包；
        // 开发态由上面的中间件直出，不走到这里）。
        const filename = ctx?.filename || (ctx?.path ? path.join(workspaceRoot, ctx.path) : '');
        const rel = filename ? path.relative(workspaceRoot, filename).split(path.sep).join('/') : '';
        if (!REACT_PAGE_ENTRIES[rel]) {
          // b1-9bz-E9（P5）：`<title>Eagle</title>` 分支的 mock-data/shims 注入摘除
          // （启动契约在 React 入口 shimsLegacy）。
          return html;
        }
        return injectPreviewScripts(html);
      },
    },
    {
      name: 'eagle-production-assets',
      apply: 'build',
      closeBundle() {
        const outDir = path.resolve(here, '../dist/frontend');
        console.log('[eagle] copying runtime assets ->', outDir);
        let copied = 0;
        for (const dir of [
          { from: 'src/app', to: 'src/app', filterPages: true },
          { from: 'src/my_modules', to: 'src/my_modules', filterPages: false },
          { from: 'src/i18n', to: 'src/i18n', filterPages: false },
        ]) {
          const from = path.join(workspaceRoot, dir.from);
          if (!fs.existsSync(from)) { console.log(`[eagle] skip (absent) ${dir.from}`); continue; }
          try {
            copyTree(from, path.join(outDir, dir.to), dir.filterPages
              ? (src) => {
                  if (src.split(path.sep).includes('react')) return false;
                  // 只排除由 Vite 产出的 React 页 HTML；pdf-viewer/model-viewer 等引擎页
                  // 无 React 入口，按原样交付（R1）。
                  const rel = path.relative(workspaceRoot, src).split(path.sep).join('/');
                  if (src.endsWith('.html') && REACT_PAGE_ENTRIES[rel]) return false;
                  return true;
                }
              : null);
            copied += 1;
            console.log(`[eagle] copied ${dir.from} -> ${dir.to}`);
          } catch (err) {
            console.error(`[eagle] FAILED copying ${dir.from}:`, err && err.message);
          }
        }
        for (const rel of ['src/config.js']) {
          const abs = path.join(workspaceRoot, rel);
          if (!fs.existsSync(abs)) { console.log(`[eagle] skip (absent) ${rel}`); continue; }
          try {
            fs.mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true });
            fs.copyFileSync(abs, path.join(outDir, rel));
            copied += 1;
            console.log(`[eagle] copied ${rel}`);
          } catch (err) {
            console.error(`[eagle] FAILED copying ${rel}:`, err && err.message);
          }
        }
        // R1：publicDir（frontend/public）会整目录复制，其中 mock-library / mock-assets 是
        // 开发/演示数据，不进生产产物（开发态仍由 public 提供）。
        for (const devOnly of ['mock-library', 'mock-assets']) {
          fs.rmSync(path.join(outDir, devOnly), { recursive: true, force: true });
        }
        console.log(`[eagle] runtime assets copied (${copied} item(s)); dev-only public data pruned`);
      },
    },
  ],
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      '/file': {
        target: thumbnailTarget,
        changeOrigin: true,
      },
    },
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    outDir: path.resolve(here, '../dist/frontend'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        pages: path.join(frontendPublic, 'pages.html'),
        'document-viewer': documentViewerEntry,
        // R1：交付页面多页入口（路径与开发态一致，产物落 dist/frontend/<相对路径>）。
        index: path.join(workspaceRoot, 'src/app/index.html'),
        preferences: path.join(workspaceRoot, 'src/app/preferences.html'),
        'preview-window': path.join(workspaceRoot, 'src/app/preview-window.html'),
        'collect-window': path.join(workspaceRoot, 'src/app/collect-window/index.html'),
        'exif-viewer': path.join(workspaceRoot, 'src/app/exif-viewer/index.html'),
        'raw-viewer': path.join(workspaceRoot, 'src/app/raw-viewer/index.html'),
        'native-viewer': path.join(workspaceRoot, 'src/app/native-viewer/index.html'),
        'gif-viewer': path.join(workspaceRoot, 'src/app/gif-viewer/index.html'),
        'text-editor': path.join(workspaceRoot, 'src/app/text-editor/text-editor.html'),
        'font-viewer': path.join(workspaceRoot, 'src/app/font-viewer/font-viewer.html'),
      },
    },
  },
});
