import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, '../');
const frontendPublic = path.resolve(here, 'public');
const documentViewerEntry = path.resolve(here, 'document-viewer/index.html');
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

function injectPreviewScripts(html) {
  return html.replace(
    '<head>',
    `<head>\n    <script>window.__EAGLE_API_BASE_URL=${JSON.stringify(apiTarget)};window.__EAGLE_EXTENSION_BASE_URL=${JSON.stringify(extensionTarget)};</script>\n    <script src="/mock-data.js"></script>\n    <script src="/shims.js"></script>`
  );
}

// React 化入口：仅注入主界面 index.html（随各子系统迁移逐步扩展到其它窗口）。
function injectReactMount(html) {
  return html.replace(
    '</body>',
    `    ${REACT_REFRESH_PREAMBLE}\n    <script type="module" src="/src/app/react/main.tsx"></script>\n</body>`
  );
}

// b1-9af：viewer 窗接管通用路由——iframe 查看器页逐个切 React 后在此登记
// （壳 HTML 保留，旧控制脚本摘除，入口由本表注入；generic route 统一处理）。
const REACT_VIEWER_ENTRIES = {
  '/src/app/exif-viewer/index.html': '/src/app/react/viewers/exif/entry.tsx',
  '/src/app/raw-viewer/index.html': '/src/app/react/viewers/raw/entry.tsx',
  '/src/app/native-viewer/index.html': '/src/app/react/viewers/native/entry.tsx',
  '/src/app/gif-viewer/index.html': '/src/app/react/viewers/gif/entry.tsx',
  '/src/app/text-editor/text-editor.html': '/src/app/react/viewers/text-editor/entry.tsx',
};

function injectReactViewer(html, entry) {
  return html.replace(
    '</body>',
    `    ${REACT_REFRESH_PREAMBLE}\n    <script type="module" src="${entry}"></script>\n</body>`
  );
}

// 阶段8：偏好窗口（独立页面）React 化入口——保留 shims 注入，另挂 preferences entry。
function readPreviewPreferences() {
  const file = path.join(workspaceRoot, 'src/app/preferences.html');
  const html = injectPreviewScripts(fs.readFileSync(file, 'utf8'));
  return html.replace(
    '</body>',
    `    ${REACT_REFRESH_PREAMBLE}\n    <script type="module" src="/src/app/react/preferences/entry.tsx"></script>\n</body>`
  );
}

// 阶段9a-1：预览大窗（独立页面）React 化入口——保留 shims 注入，另挂 preview-window entry。
function readPreviewWindow() {
  const file = path.join(workspaceRoot, 'src/app/preview-window.html');
  const html = injectPreviewScripts(fs.readFileSync(file, 'utf8'));
  return html.replace(
    '</body>',
    `    ${REACT_REFRESH_PREAMBLE}\n    <script type="module" src="/src/app/react/preview-window/entry.tsx"></script>\n</body>`
  );
}

// 阶段9b-1：采集窗（独立页面）React 化入口——保留 shims 注入与 collect 模板清洗，另挂 collect entry。
function readCollectWindow() {
  const file = path.join(workspaceRoot, 'src/app/collect-window/index.html');
  let html = injectPreviewScripts(fs.readFileSync(file, 'utf8'));
  html = sanitizeCollectTemplates(allowSingleColorPalette(html));
  return html.replace(
    '</body>',
    `    ${REACT_REFRESH_PREAMBLE}\n    <script type="module" src="/src/app/react/collect-window/entry.tsx"></script>\n</body>`
  );
}

function injectViewerConfig(html) {
  return html.replace(
    '<head>',
    `<head>\n    <script>window.__EAGLE_API_BASE_URL=${JSON.stringify(apiTarget)};window.__EAGLE_THUMBNAIL_URL=${JSON.stringify(thumbnailTarget)};</script>`
  );
}

function sanitizeCollectTemplates(html) {
  return html.replace(
    /ng-mouseup="\s*ng-mouseup="([^"]*)"/g,
    'ng-mouseup="$1"'
  );
}

function allowSingleColorPalette(html) {
  return html.replace(
    'selected[0].palettes.length <= 1',
    '!selected[0].palettes || selected[0].palettes.length === 0'
  );
}

function readPreviewIndex() {
  const file = path.join(workspaceRoot, 'src/app/index.html');
  return injectReactMount(injectPreviewScripts(fs.readFileSync(file, 'utf8')));
}

function readReplacement(name) {
  return fs.readFileSync(path.join(frontendPublic, 'replaced', name), 'utf8');
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
            res.end(readPreviewIndex());
            return;
          }
          if (url === '/src/app/preferences.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readPreviewPreferences());
            return;
          }
          if (url === '/src/app/preview-window.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readPreviewWindow());
            return;
          }
          if (url === '/src/app/collect-window/index.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readCollectWindow());
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
          if (url.startsWith('/src/app/') && url.endsWith('.html')) {
            const file = path.join(workspaceRoot, url);
            if (fs.existsSync(file)) {
              let html = fs.readFileSync(file, 'utf8');
              if (url.startsWith('/src/app/collect-window/')) {
                html = sanitizeCollectTemplates(html);
              }
              html = injectPreviewScripts(allowSingleColorPalette(html));
              const viewerEntry = REACT_VIEWER_ENTRIES[url];
              if (viewerEntry) {
                html = injectReactViewer(html, viewerEntry);
              }
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
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
      transformIndexHtml(html) {
        if (html.includes('<title>Eagle Document Viewer</title>')) {
          return injectViewerConfig(html);
        }
        if (!html.includes('<title>Eagle</title>')) {
          return html;
        }
        return html.replace(
          '<head>',
          '<head>\n    <script src="/mock-data.js"></script>\n    <script src="/shims.js"></script>'
        );
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
      },
    },
  },
});
