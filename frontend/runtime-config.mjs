/**
 * M5-1（F17/F22）：统一运行时地址策略——**唯一**的 API / 缩略图 / 扩展基址来源。
 *
 * 背景：此前地址有两个互不一致的注入面（`injectPreviewScripts` 给 API+EXTENSION，
 * `injectViewerConfig` 给 API+THUMBNAIL），且都在**构建期**把值写死进产物；
 * public 侧 HTML 的配置只在 dev 中间件补齐，生产静态服务不补——同一份产物换端口即失效。
 *
 * 现行策略（单一机制，无第二套）：
 *   1. 每个页面只引用一个同源脚本 `<script src="/eagle-runtime-config.js"></script>`；
 *   2. 该 URL 的内容**在请求时**由当前正在服务的前端进程按自己的启动环境生成：
 *      dev 走 Vite 中间件，生产走 `scripts/serve-frontend.mjs`，两者共用本模块的
 *      `resolveRuntimeConfig` / `renderRuntimeConfigScript`——因此 dev / 生产 / 各窗口
 *      地址来源一致，同一份 dist 产物可在任意端口启动；
 *   3. 产物里另有一份同名静态文件（`frontend/public/eagle-runtime-config.js`）作为兜底：
 *      只有当产物被一个不识别该路径的静态服务器托管时才会原样送达，它只补默认端口、
 *      不覆盖进程已给出的值。
 *
 * 三个全局名沿用既有契约（`src/app/react/global/globals.d.ts` 已声明，主窗、查看器、
 * 子窗、public 工具页的既有消费者都按 `window.__EAGLE_* || 默认` 读取），本模块只是把
 * 它们的**取值时机**从构建期搬到服务期，不新增全局名、不改变读取方式。
 */

/** 页面引用的同源路径；dev 中间件与生产静态服务都在此路径上作答。 */
export const RUNTIME_CONFIG_PATH = '/eagle-runtime-config.js';

/** 与后端 `backend/src/server.js` 的默认端口、以及各消费者自身的兜底默认值保持一致。 */
const DEFAULT_PORTS = { api: 41695, thumbnail: 41692, extension: 41693 };

function normalizeBase(value, port) {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '');
  if (trimmed) return trimmed;
  return `http://localhost:${port}`;
}

/**
 * 从进程环境解析三处基址。`*_URL`（完整地址）优先，其次 `*_PORT`（端口），
 * 最后落到默认端口——与 `scripts/start-production.mjs`、`backend/src/server.js`
 * 的既有变量语义一致，不引入新变量名。
 */
export function resolveRuntimeConfig(env = process.env) {
  return {
    apiBaseUrl: normalizeBase(env.EAGLE_API_URL, env.EAGLE_API_PORT || DEFAULT_PORTS.api),
    thumbnailBaseUrl: normalizeBase(env.EAGLE_THUMBNAIL_URL, env.EAGLE_THUMBNAIL_PORT || DEFAULT_PORTS.thumbnail),
    extensionBaseUrl: normalizeBase(env.EAGLE_EXTENSION_URL, env.EAGLE_EXTENSION_PORT || DEFAULT_PORTS.extension),
  };
}

/** 渲染 `/eagle-runtime-config.js` 的响应体（经典脚本，须早于任何 module 入口求值）。 */
export function renderRuntimeConfigScript(env = process.env) {
  const { apiBaseUrl, thumbnailBaseUrl, extensionBaseUrl } = resolveRuntimeConfig(env);
  return [
    '/* M5-1（F22）：由当前前端服务进程按启动环境生成；同一产物可在任意端口启动。 */',
    `window.__EAGLE_API_BASE_URL=${JSON.stringify(apiBaseUrl)};`,
    `window.__EAGLE_THUMBNAIL_URL=${JSON.stringify(thumbnailBaseUrl)};`,
    `window.__EAGLE_EXTENSION_BASE_URL=${JSON.stringify(extensionBaseUrl)};`,
    '',
  ].join('\n');
}

/**
 * 给页面补上配置脚本标签。幂等：源码里已写死标签的页面（本批新增的 React 工具页/媒体页）
 * 不会被注入第二次；`src/app/*.html` 等本批无所有权改动的源页由 dev 中间件与构建期
 * `transformIndexHtml` 补齐，两条路径走的是同一个函数。
 */
export function injectRuntimeConfigTag(html) {
  if (html.includes(RUNTIME_CONFIG_PATH)) return html;
  const tag = `<script src="${RUNTIME_CONFIG_PATH}"></script>`;
  if (html.includes('<head>')) return html.replace('<head>', `<head>\n    ${tag}`);
  if (html.includes('</head>')) return html.replace('</head>', `    ${tag}\n</head>`);
  return `${tag}\n${html}`;
}
