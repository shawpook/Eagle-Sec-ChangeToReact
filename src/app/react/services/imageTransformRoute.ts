/**
 * F06 第三批：图像变换的**格式分流唯一判定点**，以及「非渲染层那一路上怎么落盘」的后端客户端。
 *
 * 背景（`outputs/research-f06-image-ops-2026-09-15.md` §1.2 / §1.6、方案 C）：
 * 渲染层的 `rotateImage.js` / `flipImage.js` 内部按扩展名分成两条路——
 *  - `.jpg` / `.jpeg` → `piexif` 改写 EXIF Orientation（**无损**，不动像素）；
 *  - 其余 → Canvas 破坏性重绘。
 * 但可行性实测确认后半条在渲染层**不可用**：`requireModule` 只把 `fs` / `path` 透传原生
 * （`core/shim/moduleRegistry.ts:73-75`），`rotateImage.js:160` 的 `require('url').pathToFileURL`
 * 拿到的是 mock（非函数），`global.CanvasToBMP` / `global.APNG` 亦未安装——即 `.png` 走
 * Canvas 路径必然抛错，`.bmp` 明确 reject。故本批次确立方案 C：
 *
 *  - `.jpg` / `.jpeg`：仍走渲染层原版实现（EXIF 无损改写，实测可真实落盘）；
 *  - 其余格式：交给后端 `POST /api/item/imageTransform`（sharp 原子「写源文件 → 重生成缩略图
 *    → 落 metadata」事务）。
 *
 * **分流的唯一判定点就是本文件的 `resolveImageTransformDispatch`**：全前端只有这一个函数
 * 按扩展名决定落点，主窗与预览窗都只能经 `commitImageTransform` 间接触达它，不得各自再判一次。
 *
 * 关于「支持格式清单」：本文件**只**声明渲染层能无损处理的那一组（`RENDERER_IMAGE_FORMATS`）。
 * 其余格式**不在前端列白名单**——是否支持、以什么错误拒绝（avif/bmp → 415）由后端
 * `backend/src/image-transform-service.js` 单点回答。前端若再抄一份，就又多了一个会漂移的判定点。
 * 因此 `.avif` 仍被**明确拒绝**（由后端给出 `UNSUPPORTED_FORMAT`），不会被静默改成别的行为。
 *
 * 关于「运行环境维度」：判定点签名已容纳 `runtime`（electron / browser），但本批次**只实现
 * electron 态**；非 electron 态返回**明确的 not-implemented 失败**（`IMAGE_TRANSFORM_RUNTIME_UNSUPPORTED`），
 * 既不放行也不静默成功——该维度的真实能力面由并行批次（M2 的 RuntimeServices 能力声明）承接。
 */
import type { ImageTransformItem, ImageTransformKind } from './imageTransformWriteback';

/** 图像变换的落点维度：渲染层原版实现 / 后端端点。 */
export type ImageTransformRuntime = 'electron' | 'browser';
export type ImageTransformRoute = 'renderer' | 'backend';

/**
 * 渲染层原版实现能**无损**处理的格式：仅 JPEG。
 *
 * 这是前端唯一的一份格式知识（见文件头注释：其余格式的判据归后端）。扩展名一律小写、不带点。
 */
export const RENDERER_IMAGE_FORMATS: ReadonlySet<string> = new Set(['jpg', 'jpeg']);

/** 非 electron 运行环境的图像变换写回尚未接线（本批次不替 M2 决定）。 */
export const IMAGE_TRANSFORM_RUNTIME_UNSUPPORTED = 'IMAGE_TRANSFORM_RUNTIME_UNSUPPORTED';
/** 后端图像变换的预加载通道不可用（非 JPEG 结果无处落盘）。 */
export const IMAGE_TRANSFORM_BACKEND_UNAVAILABLE = 'IMAGE_TRANSFORM_BACKEND_UNAVAILABLE';
/** 后端通道可用但本次调用未得到成功信封（跨进程/传输失败，非后端错误码时使用）。 */
export const IMAGE_TRANSFORM_BACKEND_FAILED = 'IMAGE_TRANSFORM_BACKEND_FAILED';
/** 预加载暴露的具名通道（`electron/preload.cjs` 的 `api.item.imageTransform`）。 */
export const IMAGE_TRANSFORM_BACKEND_CHANNEL = 'item:image-transform';

export interface ImageTransformDispatch {
  /** 本环境 + 本格式是否有落点。false = 明确失败（不得当作成功，也不得静默跳过）。 */
  supported: boolean;
  runtime: ImageTransformRuntime;
  /** 条目扩展名（小写、无点）；取不到时为空串。 */
  ext: string;
  /** `supported === true` 时的落点。 */
  route?: ImageTransformRoute;
  code?: string;
  reason?: string;
}

/** 条目的扩展名：优先 `item.ext`，回落从 `item.name` 末段取；一律小写去点。 */
export function imageTransformExtension(item: ImageTransformItem | undefined): string {
  const raw = item && typeof item.ext === 'string' ? item.ext : '';
  if (raw) return raw.replace(/^\.+/, '').toLowerCase();
  const name = item && typeof item.name === 'string' ? item.name : '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * 缺省运行环境判定。
 *
 * 判据与 `core/shim/environment.ts:18-20` 的 `isElectronRuntime` **同源**（读全局 `process` 的
 * `versions.electron`）。**不得**改用 `window.process.versions.electron`：`core/shim/install.ts:51-68`
 * 在任何模式下都无条件装上带 `electron` 的 `window.process`，那样浏览器/演示态会被误判为 Electron。
 */
function defaultImageTransformRuntime(): ImageTransformRuntime {
  const proc = (globalThis as unknown as { process?: { versions?: { electron?: unknown } } }).process;
  const electron = proc && proc.versions ? proc.versions.electron : undefined;
  return typeof electron === 'string' ? 'electron' : 'browser';
}

/**
 * **唯一判定点**：格式 + 运行环境 → 这一次旋转/翻转的落点。
 *
 * 调用者契约：
 *  - `supported === true` → 按 `route` 走既定分支（`renderer` / `backend`），调用方不得再判格式；
 *  - `supported === false` → 明确失败：调用方不得执行视觉变换、不得当作成功（本函数给出 `code`/`reason`）。
 */
export function resolveImageTransformDispatch(
  item: ImageTransformItem | undefined,
  runtime?: ImageTransformRuntime,
): ImageTransformDispatch {
  const resolved: ImageTransformRuntime = runtime === 'electron' || runtime === 'browser'
    ? runtime
    : defaultImageTransformRuntime();
  const ext = imageTransformExtension(item);

  if (resolved !== 'electron') {
    return {
      supported: false,
      runtime: resolved,
      ext,
      code: IMAGE_TRANSFORM_RUNTIME_UNSUPPORTED,
      reason: `当前运行环境（${resolved}）的旋转/翻转能力尚未接线：`
        + '渲染层 util 仅在 Electron 渲染层具备真实实现，后端通道亦由该运行环境的能力声明供给（M2 RuntimeServices）',
    };
  }

  return {
    supported: true,
    runtime: resolved,
    ext,
    route: RENDERER_IMAGE_FORMATS.has(ext) ? 'renderer' : 'backend',
  };
}

// ─────────────────────── 后端客户端（route === 'backend' 的那一路） ───────────────────────

export interface ImageTransformBackendParams {
  id: string;
  op: ImageTransformKind;
  /** rotate：归一化后的 90/180/270。 */
  degree?: number;
  /** flip：`horizontal` / `vertical` / `both`。 */
  flipType?: string;
}

/** 主进程返回给渲染层的**信封**：成败与结构化字段一并跨边界，不做异常搬运。 */
export interface ImageTransformBackendResult {
  ok: boolean;
  data?: Record<string, unknown>;
  /** 后端错误码**原样**（`UNSUPPORTED_FORMAT` / `PERMISSION_DENIED` / `NOT_FOUND` …），不吞成泛化文案。 */
  code?: string;
  /** 后端消息**原样**。 */
  message?: string;
  statusCode?: number;
}

export interface ImageTransformBackendCapability {
  ok: boolean;
  invoke?: (params: ImageTransformBackendParams) => unknown;
  code?: string;
  reason?: string;
}

/**
 * 探测后端通道能力。
 *
 * 只认 preload 的具名方法 `window.eagleDesktop.item.imageTransform`——**不**回落
 * `getIpcBus().invoke(...)`：shims 的 `ipcBus.invoke` 对未知频道一律
 * `Promise.resolve({ canceled: true, ok: true })`（`core/shim/ipcBus.ts`），
 * 那会把「根本没接上」伪装成成功信封，正是本批次要消灭的静默假成功。
 */
export function resolveImageTransformBackendCapability(): ImageTransformBackendCapability {
  const desktop = (window as unknown as {
    eagleDesktop?: { item?: { imageTransform?: unknown } };
  }).eagleDesktop;
  const group = desktop ? desktop.item : undefined;
  const invoke = group ? group.imageTransform : undefined;
  if (!desktop || !group || typeof invoke !== 'function') {
    return {
      ok: false,
      code: IMAGE_TRANSFORM_BACKEND_UNAVAILABLE,
      reason: `预加载通道 ${IMAGE_TRANSFORM_BACKEND_CHANNEL} 不可用`
        + '（window.eagleDesktop.item.imageTransform 缺失），非 JPEG 格式的旋转/翻转无处落盘',
    };
  }
  return { ok: true, invoke: (params) => (invoke as (p: ImageTransformBackendParams) => unknown).call(group, params) };
}

/** 调用后端图像变换端点，把信封翻译成结构化结果（错误码/消息/statusCode 均原样）。 */
export async function invokeImageTransformBackend(
  capability: ImageTransformBackendCapability,
  params: ImageTransformBackendParams,
): Promise<ImageTransformBackendResult> {
  if (!capability || capability.ok !== true || typeof capability.invoke !== 'function') {
    return {
      ok: false,
      code: (capability && capability.code) || IMAGE_TRANSFORM_BACKEND_UNAVAILABLE,
      message: (capability && capability.reason) || `预加载通道 ${IMAGE_TRANSFORM_BACKEND_CHANNEL} 不可用`,
    };
  }
  let raw: unknown;
  try {
    raw = await capability.invoke(params);
  } catch (err) {
    return { ok: false, code: IMAGE_TRANSFORM_BACKEND_FAILED, message: backendErrorMessage(err) };
  }
  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      code: IMAGE_TRANSFORM_BACKEND_FAILED,
      message: `预加载通道 ${IMAGE_TRANSFORM_BACKEND_CHANNEL} 返回了非信封结果：${String(raw)}`,
    };
  }
  const envelope = raw as {
    ok?: unknown; data?: unknown; code?: unknown; message?: unknown; statusCode?: unknown;
  };
  if (envelope.ok === true) {
    return {
      ok: true,
      data: (envelope.data && typeof envelope.data === 'object'
        ? envelope.data
        : {}) as Record<string, unknown>,
    };
  }
  return {
    ok: false,
    // 后端错误码/消息原样透出；仅当主进程未给出码时才用本层的兜底码。
    code: typeof envelope.code === 'string' && envelope.code ? envelope.code : IMAGE_TRANSFORM_BACKEND_FAILED,
    message: typeof envelope.message === 'string' && envelope.message ? envelope.message : '后端图像变换失败',
    statusCode: typeof envelope.statusCode === 'number' ? envelope.statusCode : undefined,
  };
}

function backendErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
