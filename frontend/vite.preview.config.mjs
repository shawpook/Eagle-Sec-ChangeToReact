import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, '../../');
const frontendPublic = path.resolve(here, 'public');
const thumbnailTarget = process.env.EAGLE_THUMBNAIL_URL || 'http://localhost:41692';
const apiTarget = process.env.EAGLE_API_URL || 'http://localhost:41695';
const extensionTarget = process.env.EAGLE_EXTENSION_URL || 'http://localhost:41693';

function injectPreviewScripts(html) {
  return html.replace(
    '<head>',
    `<head>\n    <script>window.__EAGLE_API_BASE_URL=${JSON.stringify(apiTarget)};window.__EAGLE_EXTENSION_BASE_URL=${JSON.stringify(extensionTarget)};</script>\n    <script src="/mock-data.js"></script>\n    <script src="/shims.js"></script>`
  );
}

function sanitizeCollectTemplates(html) {
  return html.replace(
    /ng-mouseup="\s*ng-mouseup="([^"]*)"/g,
    'ng-mouseup="$1"'
  );
}

function readPreviewIndex() {
  const file = path.join(workspaceRoot, 'src/app/index.html');
  return injectPreviewScripts(fs.readFileSync(file, 'utf8'));
}

function readReplacement(name) {
  return fs.readFileSync(path.join(frontendPublic, 'replaced', name), 'utf8');
}

export default defineConfig({
  root: workspaceRoot,
  base: '/',
  publicDir: frontendPublic,
  plugins: [
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
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(injectPreviewScripts(html));
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
    open: '/src/app/index.html',
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
      input: path.join(frontendPublic, 'pages.html'),
    },
  },
});
