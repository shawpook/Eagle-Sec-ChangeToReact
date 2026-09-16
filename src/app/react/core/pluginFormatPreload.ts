/**
 * M6-3：格式插件 webview 的 preload —— **唯一**解析点。
 *
 * ── 被修的缺陷（F19 后续 / 审计报告第 7 条）──
 * 三处调用点原先各自内联同一惯用式：
 * ```
 * req('url').pathToFileURL(req('path').join((window as any).appRoot.path, '/app/js/plugin/api-format-extension.js')).href
 * ```
 * 该式在**任何**运行态下都产出 HTTP URL，而 `webview.preload` 只接受文件系统路径：
 *  - `window.appRoot` 是 shim 常量 `{ path: '/src' }`（`shim/moduleRegistry.ts:121-124`），
 *    **恒为 URL 空间路径**，不是磁盘路径；
 *  - `bareModules['url']` 无条件指向 `browserRuntime.urlModule`（`moduleRegistry.ts:570`），
 *    其 `pathToFileURL` 走 `localAssetUrl`（`browserRuntime.ts:614-626`）→
 *    `new URL(p, window.location.origin)`；
 *  - Electron 渲染层**以 HTTP 加载**（`electron/main.cjs:8` `previewUrl = http://localhost:5176/…`，
 *    `:852 win.loadURL(url)`），故 origin 是 `http://localhost:5176`。
 *
 * ── 实测取证（2026-09-16，Electron 22.3.7，本 worktree）──
 * 探针以 `main.cjs:832-838` 的 webPreferences **逐字同配置**起窗、加载与 5176 同构的 http 页面：
 * ```
 * window.location.origin      = http://127.0.0.1:13481
 * 惯用式 join 结果             = \src\app\js\plugin\api-format-extension.js   ← 反斜杠，非磁盘绝对路径
 * 惯用式 .href                = http://127.0.0.1:13481/src/app/js/plugin/api-format-extension.js
 * process.cwd()               = <worktree 根>（随启动目录变化 → 不可用作锚点）
 * process.resourcesPath       = <node_modules>/electron/dist/resources（Electron 二进制旁，与应用无关）
 * preload 模块内 __dirname    = <repo>/electron（稳定 → 采纳为锚点）
 * require('path')/require('node:path') 在 preload 内可用：true / true
 * ```
 * 结论：**HTTP URL 不是「浏览器态才有的假路径」，而是 Electron 生产态下的真实产物**，
 * 该 preload 因而从未被加载；同时 `api-format-extension.js` 顶层即
 * `require('./model/item.js')` / `require('electron')` / `require('fs')`，确需原生 Node 上下文。
 *
 * ── 本模块的契约 ──
 *  - **纯函数**：环境全注入（{@link FormatPreloadEnvironment}），可脱离 DOM/Electron 单测。
 *  - Electron 态 → 真实磁盘上的 `file://` URL（形态依据见 `electron/preload.cjs` 的
 *    `formatExtensionPreload` 注释）。
 *  - 非 Electron 态 / 桥未暴露 / 文件缺失 → **明确不可用**（{@link FormatPreloadUnavailable}），
 *    绝不再伪造 `http(s)://…/src/…`。
 *  - 硬闸门：返回前一律校验 `file://` 前缀——即便桌面桥被污染也拦得住 HTTP 值。
 *  - **禁止** `process.cwd()`；**禁止**把 `/src` 当磁盘根（两者都由本模块的唯一供给面取代）。
 */

import { markUnavailable } from './shim/environment';

/** 能力缺口登记名（与 `environment.unavailableCapabilities` 台账同键）。 */
export const FORMAT_EXTENSION_PRELOAD_CAPABILITY = 'plugin.format-extension-preload';

/**
 * webview tag 未启用的登记名。
 *
 * 实测（同批探针②）：`main.cjs` 的 webPreferences **不含 `webviewTag`**，Electron 22 默认
 * `false` ⇒ `document.createElement('webview')` 返回 `HTMLElement`（非 guest），
 * `preload` 属性不生效。此为**宿主配置缺口**，与 preload 路径解析是两回事：
 * 本模块照实解析路径，另把该缺口登记出来，避免「preload 已解析」被读成「插件已可用」。
 */
export const WEBVIEW_TAG_CAPABILITY = 'webview.tag-disabled';

/** 不可用结果（字段口径与 `shim/environment.UnavailableResult` 一致，便于调用方统一判据）。 */
export interface FormatPreloadUnavailable {
  ok: false;
  unavailable: true;
  capability: string;
  reason: string;
}

/** 解析成功结果。 */
export interface FormatPreloadResolved {
  ok: true;
  /** 可直接写入 `webview.preload` 的值——`file://` URL。 */
  preloadUrl: string;
  /** 同一资源的原生磁盘绝对路径（诊断与断言用，不写入 DOM）。 */
  diskPath: string;
}

export type FormatPreloadResolution = FormatPreloadResolved | FormatPreloadUnavailable;

/**
 * 解析所需环境（**完全注入**）。
 *
 * `desktopBridge` 即宿主 `window.eagleDesktop`；其契约来源为 `electron/preload.cjs` 新增的
 * `formatExtensionPreload()`。缺省（`undefined`/`null`）即「非 Electron 态」。
 */
export interface FormatPreloadEnvironment {
  readonly desktopBridge?: unknown;
}

/** 具名成员读取（运行期形状未知时的唯一读口，返回值留在 `unknown` 上；不引入 `any`）。 */
function readMember(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return undefined;
  return (value as Record<string, unknown>)[key];
}

function unavailable(reason: string): FormatPreloadUnavailable {
  return {
    ok: false,
    unavailable: true,
    capability: FORMAT_EXTENSION_PRELOAD_CAPABILITY,
    reason,
  };
}

/**
 * 已告警的缺口名（同一文档内只提示一次，避免三处调用点各刷一遍）。
 * 登记本身走 {@link markUnavailable}（无条件、幂等），与告警去重无关。
 */
const warnedGaps = new Set<string>();

/** 释放告警去重集合（仅测试夹具使用）。 */
export function resetFormatPreloadWarnings(): void {
  warnedGaps.clear();
}

/** 登记 + 单次告警（`markUnavailable` 是无条件登记；这里只加一条可观察的告警）。 */
function reportGap(capability: string, reason: string): void {
  markUnavailable(capability, reason);
  if (!warnedGaps.has(capability)) {
    warnedGaps.add(capability);
    console.warn(`[eagle-runtime] 能力不可用：${capability} —— ${reason}`);
  }
}

/**
 * 解析格式插件 preload（**纯函数**）。
 *
 * 逐级判据（任一不成立即返回明确不可用，不回落任何猜测路径）：
 *  1. 无桌面桥 ⇒ 非 Electron 态；
 *  2. 桥上无 `formatExtensionPreload` 成员/非函数 ⇒ 供给面不存在（缺省即失败）；
 *  3. 取值抛错 / 返回非对象 / `ok !== true` ⇒ 透传其 reason；
 *  4. `url`、`diskPath` 非非空字符串 ⇒ 形态不合契约；
 *  5. `url` 非 `file://` 前缀 ⇒ **硬闸门**（HTTP(S) 值一律拒收）。
 */
export function resolveFormatExtensionPreload(env: FormatPreloadEnvironment): FormatPreloadResolution {
  const bridge = env ? env.desktopBridge : undefined;
  if (bridge === undefined || bridge === null) {
    return unavailable('非 Electron 态：无桌面桥（window.eagleDesktop），格式插件 preload 无真实磁盘来源');
  }

  const provider = readMember(bridge, 'formatExtensionPreload');
  if (typeof provider !== 'function') {
    return unavailable('桌面桥未暴露 formatExtensionPreload（preload 供给面缺失或版本过旧）');
  }

  let raw: unknown;
  try {
    raw = (provider as (this: unknown) => unknown).call(bridge);
  } catch (err) {
    return unavailable(`桌面桥 formatExtensionPreload 取值抛错：${err instanceof Error ? err.message : String(err)}`);
  }

  if (raw === null || typeof raw !== 'object') {
    return unavailable('桌面桥 formatExtensionPreload 返回非对象（契约要求 { ok, url, diskPath }）');
  }

  if (readMember(raw, 'ok') !== true) {
    const detail = readMember(raw, 'reason');
    return unavailable(typeof detail === 'string' && detail ? detail : '桌面桥判定 preload 不可用');
  }

  const url = readMember(raw, 'url');
  const diskPath = readMember(raw, 'diskPath');
  if (typeof url !== 'string' || url === '') return unavailable('桌面桥返回的 url 非非空字符串');
  if (typeof diskPath !== 'string' || diskPath === '') return unavailable('桌面桥返回的 diskPath 非非空字符串');

  // 硬闸门：`webview.preload` 只接受 file: 协议。此处拒收 http(s) 正是**被修的那个缺陷形态**——
  // 即便上游误把 URL 空间路径回填进来，也到此为止，不会流进 DOM。
  if (!/^file:\/\//i.test(url)) {
    return unavailable(`preload 形态非法：须 file:// 前缀，实得 ${url.slice(0, 48)}`);
  }

  return { ok: true, preloadUrl: url, diskPath };
}

/** 宿主 `window` 的**运行期扩展面**（纯类型窄化，本模块只读 `eagleDesktop`）。 */
interface FormatPreloadHostWindow {
  eagleDesktop?: unknown;
}

function hostWindow(): FormatPreloadHostWindow {
  return window as FormatPreloadHostWindow;
}

/** webview tag 启用判据缓存（启动期固定配置；`resetFormatPreloadProbe()` 可清）。 */
let webviewTagEnabledCache: boolean | null = null;

/**
 * webview tag 是否**真正启用**（纯函数，document 注入）。
 *
 * 判据与探针②实测一致：guest 化后的 `<webview>` 才具备 `getWebContentsId`；
 * 未启用时 `document.createElement('webview')` 返回 `HTMLElement`，该方法不存在。
 * 依赖「创建元素」而非「插入 DOM」，无副作用（不触发任何加载）。
 */
export function isWebviewTagEnabled(doc: Document): boolean {
  if (webviewTagEnabledCache === null) {
    const probe = doc.createElement('webview');
    webviewTagEnabledCache = typeof readMember(probe, 'getWebContentsId') === 'function';
  }
  return webviewTagEnabledCache;
}

/** 清空 webview tag 探测缓存（仅测试夹具使用）。 */
export function resetFormatPreloadProbe(): void {
  webviewTagEnabledCache = null;
}

/**
 * 真实宿主环境下的解析入口（三处调用点的**唯一**入口）。
 *
 * 除解析外，顺带把两类缺口按既有口径登记进 `environment.unavailableCapabilities`：
 *  - preload 本身不可用；
 *  - preload 可用但**宿主未启用 webview tag**（实测缺口，见 {@link WEBVIEW_TAG_CAPABILITY}）——
 *    此情形仍返回 `ok:true`（路径是真的），登记用于阻止「preload 已解析」被误读为「插件已可用」。
 */
export function resolveFormatExtensionPreloadFromHost(): FormatPreloadResolution {
  const resolution = resolveFormatExtensionPreload({ desktopBridge: hostWindow().eagleDesktop });
  if (!resolution.ok) {
    reportGap(resolution.capability, resolution.reason);
    return resolution;
  }
  if (typeof document !== 'undefined' && !isWebviewTagEnabled(document)) {
    reportGap(
      WEBVIEW_TAG_CAPABILITY,
      '宿主 BrowserWindow 未启用 webviewTag：<webview> 不会 guest 化，preload 属性不生效'
        + '（electron/main.cjs 的 createWindow webPreferences）',
    );
  }
  return resolution;
}
