/**
 * M5-1（F17/F22）：外围工具页读取后端地址与媒体取址的**唯一**客户端入口。
 *
 * 地址来源只有一处：同源脚本 `/eagle-runtime-config.js` 写入的 `window.__EAGLE_*`。
 * 该脚本的内容由**当前正在服务的前端进程**按自己的启动环境生成（dev 走 Vite 中间件，
 * 生产走 `scripts/serve-frontend.mjs`，两侧共用 `frontend/runtime-config.mjs`），
 * 因此本模块只做「读取同一份契约 + 各自的缺省值」，不构成第二套地址来源，
 * 也不在构建期固化任何端口。
 *
 * 三个全局名沿用既有契约（`react/global/globals.d.ts` 已声明，主窗、查看器与
 * 旧 public 页的既有消费者都按 `window.__EAGLE_* || 默认` 读取）。
 * 缺省值必须与 `frontend/runtime-config.mjs` 的 DEFAULT_PORTS 保持一致。
 */

const DEFAULT_API_BASE_URL = 'http://localhost:41695'
const DEFAULT_THUMBNAIL_BASE_URL = 'http://localhost:41692'
const DEFAULT_EXTENSION_BASE_URL = 'http://localhost:41693'

/** loopback 主机名白名单：`?api=` 覆盖只允许指向本机后端。 */
const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]']

function normalize(value: string | undefined, fallback: string): string {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '')
  return trimmed || fallback
}

export function apiBaseUrl(): string {
  return normalize(window.__EAGLE_API_BASE_URL, DEFAULT_API_BASE_URL)
}

export function thumbnailBaseUrl(): string {
  return normalize(window.__EAGLE_THUMBNAIL_URL, DEFAULT_THUMBNAIL_BASE_URL)
}

export function extensionBaseUrl(): string {
  return normalize(window.__EAGLE_EXTENSION_BASE_URL, DEFAULT_EXTENSION_BASE_URL)
}

/**
 * roadmap 页的 `?api=` 覆盖（历史契约，`tests/roadmap-panels.mjs` 逐字断言顶层标识符 `API`
 * 等于 `new URL(apiBase).origin`）。仅接受 loopback + http(s)，并归一到 origin；
 * 无参数或参数不合法时回落到与其他页完全相同的运行时地址。
 */
export function resolveApiBaseOverride(search: string = window.location.search): string {
  const configured = new URLSearchParams(search).get('api')
  if (!configured) return apiBaseUrl()
  try {
    const url = new URL(configured)
    if (!LOOPBACK_HOSTS.includes(url.hostname)) return apiBaseUrl()
    if (!['http:', 'https:'].includes(url.protocol)) return apiBaseUrl()
    return url.origin
  } catch {
    return apiBaseUrl()
  }
}

declare global {
  interface Window {
    /**
     * roadmap 页对外暴露的地址契约：`tests/roadmap-panels.mjs` 在页面主世界用**裸标识符**
     * `API` 读取它（module 作用域的 const 不进入全局对象，故必须挂到 window）。
     * 由 `tools/roadmap/entry.tsx` 写入，值为 `resolveApiBaseOverride()` 的结果。
     */
    API?: string
  }
}

export interface ApiEnvelope<T> {
  status: string
  message?: string
  code?: string
  data: T
}

/**
 * 与旧 public 页逐字一致的响应约定：非 2xx 或 `status !== 'success'` 抛
 * `body.message || HTTP <status>`，成功返回 `body.data`。
 */
export async function requestApi<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, init)
  const body = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>
  if (!res.ok || body.status !== 'success') {
    throw new Error(body.message || `HTTP ${res.status}`)
  }
  return body.data as T
}

/** `GET /api/library/current` 中被本模块消费的字段（其余字段按需扩展）。 */
export interface CurrentLibrary {
  name: string
  path: string
  rootDir: string
  imagesDir: string
}

/**
 * M5-1（F17-3）：媒体取址改走后端受控接口，不再拼接 `mock-library/...` 常量。
 *
 * 地址由「当前真实图库」的 `imagesDir`（`GET /api/library/current`，随图库切换而变）
 * 与后端缩略图服务的通用文件路由 `/file/<绝对路径>` 组成；该路由只接受位于
 * `currentLibrary.rootDir` 之下的绝对路径（`backend/src/server.js`）。
 *
 * 取址走**同源** `/file/...`，与 `core/shim/browserRuntime.ts` 的 `localAssetUrl`
 * 逐字同一约定：dev 的 Vite proxy 与生产的 `scripts/serve-frontend.mjs` 都把 `/file/*`
 * 代理到缩略图服务，因此两侧 URL 形状相同、同一份产物换端口即生效。这里不能用
 * `thumbnailBaseUrl()` 直连缩略图服务——该服务不带 CORS 头，`<img src>` 尚可，
 * 而音频页的 `fetch(src)`（波形解码）会因跨源被浏览器拦下。非 http(s) 来源
 * （如 Electron 的 file:// 场景）才回落到绝对缩略图基址。
 */
export function libraryFileUrl(imagesDir: string, item: { id: string; name: string; ext: string }): string {
  const absolute = `${imagesDir}${item.id}.info/${item.name}.${item.ext}`
  const encoded = encodeURIComponent(absolute)
  const location = typeof window === 'undefined' ? undefined : window.location
  if (location && /^https?:$/.test(location.protocol)) return `${location.origin}/file/${encoded}`
  return `${thumbnailBaseUrl()}/file/${encoded}`
}
