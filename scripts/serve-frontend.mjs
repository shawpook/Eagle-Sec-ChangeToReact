/**
 * R1：生产态前端静态服务——提供 dist/frontend，保持与开发态一致的页面 URL 形状，
 * 并把 `/file` 代理到缩略图服务（等价 Vite dev 的 proxy，避免应用侧为无 proxy 场景分叉）。
 *
 * M5-1（F22）：本服务同时是 `/eagle-runtime-config.js` 的生产端供给方——按**本进程**的启动
 * 环境生成 API/缩略图/扩展基址，与 dev 中间件共用 `frontend/runtime-config.mjs`。因此产物里
 * 不带任何端口常量，同一份 dist 换端口启动即生效；产物内同名静态文件只是无该端点的兜底。
 *
 * 环境变量：
 *   EAGLE_FRONTEND_PORT     监听端口（默认 4173）
 *   EAGLE_FRONTEND_ROOT     产物根目录（默认 <repo>/dist/frontend）
 *   EAGLE_THUMBNAIL_URL     /file 代理目标（默认 http://localhost:41692）
 *   EAGLE_API_URL / EAGLE_API_PORT              页面侧 API 基址（默认 http://localhost:41695）
 *   EAGLE_THUMBNAIL_PORT                        页面侧缩略图基址（默认 http://localhost:41692）
 *   EAGLE_EXTENSION_URL / EAGLE_EXTENSION_PORT  页面侧扩展基址（默认 http://localhost:41693）
 *
 * 用法：node scripts/serve-frontend.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_CONFIG_PATH, injectRuntimeConfigTag, renderRuntimeConfigScript, resolveRuntimeConfig } from '../frontend/runtime-config.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.EAGLE_FRONTEND_ROOT || path.join(projectRoot, 'dist', 'frontend'));
const port = Number(process.env.EAGLE_FRONTEND_PORT || 4173);
const runtimeConfig = resolveRuntimeConfig(process.env);
const fileProxyTarget = runtimeConfig.thumbnailBaseUrl;

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
  const ext = path.extname(filePath).toLowerCase();
  // M5-1（F22）：与 dev 中间件保持**同一注入面**。dev 对所有 HTML 响应（含 publicDir 原样
  // 直出的页面）都补配置脚本标签，生产此前不补——那正是「同一产物换端口即失效」的另一半。
  // 这里复用同一个 injectRuntimeConfigTag（幂等：已含该标签的页面原样返回），
  // 因此 browser-extension/popup.html、replaced/*.html 等非 Vite 产出的页面两侧行为一致。
  const body = ext === '.html'
    ? Buffer.from(injectRuntimeConfigTag(fs.readFileSync(filePath, 'utf8')), 'utf8')
    : fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  // M5-1（F22）：原始请求目标**必须**保留一份。缩略图 URL 由
  // `${thumbnailBase}/file/${encodeURIComponent(绝对路径)}` 生成，其中的分隔符是 `%2F`/`%5C`；
  // 一旦先 decodeURIComponent 再用 `new URL()` 重建，`%2F` 会变成真斜杠、`%5C` 会被 WHATWG
  // 归一成 `/`，请求就从单段 `/file/:encoded` 变成多段路径，缩略图服务的 Express 路由不再匹配
  // （实测响应体为 `Cannot GET /file/C:/Users/...` 的 404）。dev 侧 Vite 的 proxy 原样透传编码，
  // 不做这层解码——这正是 F22 要消除的 dev/生产分歧，故这里也用原样透传。
  const rawTarget = req.url || '/';
  const rawPath = rawTarget.split('?')[0];
  const url = decodeURIComponent(rawPath);

  // M5-1（F22）：运行时地址端点。产物内不含任何端口常量，值由本进程的启动环境决定，
  // 与 dev 中间件共用 renderRuntimeConfigScript——同一份 dist 换端口启动即生效。
  if (url === RUNTIME_CONFIG_PATH) {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(renderRuntimeConfigScript(process.env));
    return;
  }

  // 与开发态一致：/file 交给缩略图服务（生产无 Vite proxy）。path 用**未解码**的原始请求目标
  // （含 query），仅替换 origin；解码后的 url 只用于判定是否需要代理。
  if (url.startsWith('/file/')) {
    const target = new URL(fileProxyTarget);
    const proxyReq = http.request(
      { hostname: target.hostname, port: target.port, path: rawTarget, method: req.method, headers: { ...req.headers, host: target.host } },
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
