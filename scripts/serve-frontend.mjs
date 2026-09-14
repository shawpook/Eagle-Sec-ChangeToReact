/**
 * R1：生产态前端静态服务——提供 dist/frontend，保持与开发态一致的页面 URL 形状，
 * 并把 `/file` 代理到缩略图服务（等价 Vite dev 的 proxy，避免应用侧为无 proxy 场景分叉）。
 *
 * 环境变量：
 *   EAGLE_FRONTEND_PORT     监听端口（默认 4173）
 *   EAGLE_FRONTEND_ROOT     产物根目录（默认 <repo>/dist/frontend）
 *   EAGLE_THUMBNAIL_URL     /file 代理目标（默认 http://localhost:41692）
 *
 * 用法：node scripts/serve-frontend.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.EAGLE_FRONTEND_ROOT || path.join(projectRoot, 'dist', 'frontend'));
const port = Number(process.env.EAGLE_FRONTEND_PORT || 4173);
const fileProxyTarget = process.env.EAGLE_THUMBNAIL_URL || 'http://localhost:41692';

if (!fs.existsSync(root)) {
  console.error(`FAIL dist 不存在：${root}（先运行 npm run build）`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

function serveFile(res, filePath) {
  const body = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  // 与开发态一致：/file 交给缩略图服务（生产无 Vite proxy）。
  if (url.startsWith('/file/')) {
    const target = new URL(url, fileProxyTarget);
    const proxyReq = http.request(
      { hostname: target.hostname, port: target.port, path: target.pathname + target.search, method: req.method, headers: { ...req.headers, host: target.host } },
      (proxyRes) => { res.writeHead(proxyRes.statusCode || 502, proxyRes.headers); proxyRes.pipe(res); },
    );
    proxyReq.on('error', () => { res.writeHead(502); res.end('thumbnail proxy error'); });
    req.pipe(proxyReq);
    return;
  }

  if (url === '/') {
    res.writeHead(302, { Location: '/src/app/index.html' });
    res.end();
    return;
  }

  const filePath = path.join(root, url);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(res, filePath);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`404 ${url}`);
});

server.listen(port, () => {
  console.log(`[serve-frontend] ${root} on http://127.0.0.1:${port} (/file -> ${fileProxyTarget})`);
});
