/**
 * F06：图片旋转/翻转的**唯一写回实现**（主窗 `services/imageOpsService.ts` 与
 * 预览窗 `preview-window/controller.ts` 共用同一函数）。
 *
 * 背景（`outputs/research-f06-image-ops-2026-09-15.md` §1.2/§1.3/§1.6/§6）：
 *  - `core/shim/moduleRegistry.ts:106-107` 对 `rotateImage.js` / `flipImage.js` **无条件**
 *    返回 `() => {}` 空桩（本批次不解桩，真实能力由并行批次接线）；
 *  - 主窗此前 `await rotateImage(...)` 对空函数不抛错，照常执行成功收尾 →
 *    **静默假成功**（界面显示成功、磁盘文件一字节未变）；flip 侧 `undefined.then(...)`
 *    抛 TypeError，却被 `catch (requireErr)` 记成「加载模块失败」→ **误导日志**；
 *  - 主窗与预览窗各自复制了一份写回逻辑，宽高交换时机分叉（主窗仅 write 模式交换、
 *    预览窗**无条件**交换），却共用同一条 `regenerate-thumbnail` 频道。
 *
 * 本模块把两条路径收敛为单一实现，并确立四条不变量：
 *
 *  1. **能力不可用即明确失败**：写文件模式下若 util 不是真实实现，立即以
 *     `IMAGE_TRANSFORM_UNAVAILABLE` 拒绝——不交换宽高、不更新视图、不发成功事件、
 *     不派发 `regenerate-thumbnail`、不写元数据，且不留 `isRotating` 悬挂态。
 *     为此确立**调用顺序**：调用方必须先 `commitImageTransform` 取得受理结果，
 *     `accepted === false` 时直接返回、**不得**再施加视觉变换；受理后才做视觉变换。
 *     这样界面永远不会出现「看着转了、文件一字节未动」的静默假成功。
 *  2. **成功才算成功**：成功收尾（`delete orientation` / 更新条目视图 / 宽高持久化 /
 *     重新生成缩略图）只在真实写入 resolve 之后执行；失败只回滚并给出**真实原因**。
 *  3. **宽高交换与实际落盘同门控**：仅在 `imageRotateMode === 'write'` 时交换（对齐主窗
 *     原语义）。write 模式落盘后磁盘文件的宽高确实互换，此时交换才与磁盘一致；preview
 *     模式不落盘，交换会让内存模型与磁盘文件不符（列表/封面按 `width/height` 算
 *     `aspect-ratio`，见 `imageOpsService.calculateImageBinding`）。预览窗此前的**无条件**
 *     交换是分叉的那一侧，本模块收敛到主窗语义。
 *  4. **元数据只走一条写路径**：宽高经渲染层唯一元数据通道 `images-change`
 *     （→ `channelBridge` → `item.updateMany`）写入，并等待 `item:operation-result` 回执
 *     校验宽高是否真的落库；未确认且该 item 的缩略图任务也未派发时，显式报
 *     `IMAGE_META_NOT_PERSISTED`，绝不静默当作成功。不新增第二条写入调用。
 *
 * 第三批（本批次）追加第 5 条不变量：
 *
 *  5. **落点按格式分流，且只有一个判定点**：`.jpg`/`.jpeg` 走渲染层原版实现（EXIF 无损改写），
 *     其余格式走后端 `POST /api/item/imageTransform`（sharp 原子事务）。判定由
 *     `./imageTransformRoute` 的 `resolveImageTransformDispatch` **唯一**给出——本文件只是它的
 *     两个调用分支，不得再出现第二处按扩展名的判断（主窗/预览窗同此）。
 */
import { getIpcBus } from '../core/channelBridge';
import {
  type ImageTransformBackendCapability,
  type ImageTransformRoute,
  type ImageTransformRuntime,
  IMAGE_TRANSFORM_BACKEND_FAILED,
  IMAGE_TRANSFORM_BACKEND_UNAVAILABLE,
  invokeImageTransformBackend,
  resolveImageTransformBackendCapability,
  resolveImageTransformDispatch,
} from './imageTransformRoute';

export type ImageTransformKind = 'rotate' | 'flip';
export type ImageFlipType = 'horizontal' | 'vertical' | 'both';

/** 旋转/翻转 util 的模块路径（与 `core/shim/moduleRegistry.ts:106-107` 的桩名单同源）。 */
export const IMAGE_TRANSFORM_MODULE_PATH: Record<ImageTransformKind, string> = {
  rotate: '/app/js/utils/rotateImage.js',
  flip: '/app/js/utils/flipImage.js',
};

/** 能力不可用（util 未接线 / 非函数 / 仍是空桩）。 */
export const IMAGE_TRANSFORM_UNAVAILABLE = 'IMAGE_TRANSFORM_UNAVAILABLE';
/** 宽高经唯一元数据通道写入后仍未在回执中确认落库。 */
export const IMAGE_META_NOT_PERSISTED = 'IMAGE_META_NOT_PERSISTED';
/** 拿不到条目磁盘路径（`FileUrlHelper.getRawPath` 空），无从落盘。 */
export const IMAGE_TRANSFORM_NO_RAW_PATH = 'IMAGE_TRANSFORM_NO_RAW_PATH';
/** 目标文件不可写（`fs.W_OK` 预检失败）。 */
export const IMAGE_TRANSFORM_WRITE_DENIED = 'IMAGE_TRANSFORM_WRITE_DENIED';
/** util 真实执行时抛错（真实原因原样透出，不再改写措辞）。 */
export const IMAGE_TRANSFORM_WRITE_FAILED = 'IMAGE_TRANSFORM_WRITE_FAILED';
/** 渲染层唯一的元数据写入通道（`channelBridge` 的 `images-change` 分支）。 */
export const IMAGE_META_CHANNEL = 'images-change';
/** 元数据写入回执事件（`channelBridge` 在 updateMany 收敛后发出）。 */
export const IMAGE_META_RECEIPT_EVENT = 'item:operation-result';
/** 缩略图重生成通道：后端 `commitThumbnail` 亦会写 width/height/resolution*。 */
export const REGENERATE_THUMBNAIL_CHANNEL = 'regenerate-thumbnail';

/** 落盘去抖（对齐主窗原 200ms）。 */
const WRITE_DEBOUNCE_MS = 200;
/** 元数据回执等待上限。 */
const META_RECEIPT_TIMEOUT_MS = 4000;

/** 条目最小面（legacy item 为宽松对象；此处只声明本模块读写到的字段）。 */
export interface ImageTransformItem {
  id?: string;
  name?: string;
  ext?: string;
  width?: number;
  height?: number;
  orientation?: unknown;
  lastModified?: number;
  [key: string]: unknown;
}

/** util 契约：`(src, degree|flipType, options?) => Promise<...>`。 */
export type ImageTransformUtil = (
  src: string,
  operation: number | ImageFlipType,
  options?: { onSuccess?: (newWidth: number, newHeight: number) => void },
) => Promise<unknown> | unknown;

/** 宿主副作用注入点。缺省回落到 window 全局（Electron 渲染层既有供给）。 */
export interface ImageTransformHooks {
  /** 更新条目视图（主窗 = `machineryUpdateItemView`；预览窗 = 其自身的刷新）。 */
  updateItemView?: (item: ImageTransformItem) => void;
  /** 网格重排（主窗 `machineryRelayout`）。 */
  relayout?: () => void;
  /** `writeIsRotating`（预览窗无此状态，缺省 no-op）。 */
  setIsRotating?: (value: boolean) => void;
  /** 派发 `regenerate-thumbnail`（缺省经 IPC 总线发送）。 */
  regenerateThumbnail?: (item: ImageTransformItem) => void;
  /** 元数据写入（缺省 `window.ayncsImagesChange`）。 */
  imagesChange?: (items: ImageTransformItem[]) => void;
  /** 订阅元数据回执（缺省经 `getIpcBus()`）。 */
  onMetaReceipt?: (handler: (result: unknown) => void) => (() => void) | void;
  /** 错误 UI（缺省 `window.swal` 弹窗）。 */
  showError?: (code: string, reason: string) => void;
  /** 落盘失败时回撤视觉变换（主窗 `setCssEl(#detail-image, transform:none)`）。 */
  resetView?: () => void;
  /** 落盘前可写性预检；返回拒绝原因字符串，null/undefined 表示可写。
   *  缺省用 `fs.accessSync(rawPath, fs.W_OK)`——与主窗原实现同判据，
   *  预览窗此前无此预检，收敛后两侧一致。 */
  checkWritable?: (rawPath: string) => string | null;
  /** 日志面（缺省 `window.electronLog || console`）。 */
  log?: ImageTransformLog;
  /** 落盘去抖计时器注入（测试用；缺省全局 setTimeout/clearTimeout）。 */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (timer: unknown) => void;
  /** 回执等待计时器注入（测试用）。与 `schedule` 分开：去抖是一次的、回执等待是兜底上限。 */
  setTimer?: (fn: () => void, ms: number) => unknown;
}

export interface ImageTransformLog {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, detail?: unknown) => void;
}

export interface ImageTransformCapability {
  ok: boolean;
  modulePath: string;
  util?: ImageTransformUtil;
  code?: string;
  reason?: string;
}

export interface ImageMetaReceipt {
  width: unknown;
  height: unknown;
}

export interface ImageMetaPersistResult {
  ok: boolean;
  /** 宽高由哪条通道确认落库。 */
  via: 'images-change' | 'regenerate-thumbnail' | 'backend-transform' | 'none';
  expected: { width: number | undefined; height: number | undefined };
  observed: { width: unknown; height: unknown } | null;
  code?: string;
  reason?: string;
}

export interface ImageTransformAcceptance {
  /** 写回是否被接手。false = 明确失败（能力不可用），调用方不得再走视觉/成功路径。 */
  accepted: boolean;
  /** 是否真的会落盘（preview 模式为其唯一的假值来源）。 */
  willWrite: boolean;
  kind: ImageTransformKind;
  modulePath: string;
  /** 本次落点（由唯一判定点给出）；`accepted === false` 时可能缺席（preview 模式不分流）。 */
  route?: ImageTransformRoute;
  code?: string;
  reason?: string;
}

export interface ImageTransformWritebackOptions {
  kind: ImageTransformKind;
  item: ImageTransformItem;
  rawPath: string;
  /** rotate：本次累计角度（可为负）。 */
  degree?: number;
  /** flip：翻转类型。 */
  flipType?: ImageFlipType;
  /** 调用方原始开关（flip 入口传 true；主窗 rotate 入口不传）。 */
  writeToFile?: boolean;
  /** `preferences.habits.imageRotateMode`。 */
  mode?: string;
  request?: (name: string) => unknown;
  appRootPath?: string;
  hooks?: ImageTransformHooks;
  /** 运行环境维度（判定点签名的一部分）。缺省按 `core/shim/environment.ts` 同源判据推断；
   *  显式传入用于测试与 M2 能力声明接入。 */
  runtime?: ImageTransformRuntime;
}

/** 写文件模式判定（**唯一实现**；主窗与预览窗共用，消除分叉）。
 *
 * rotate 与 flip 的门控形态不同，此处逐字保留既有语义：
 *  - flip：`writeToFile && mode === 'write'`（`DetailToolbar` 与两侧 handler 均传 true）；
 *  - rotate：仅看 `mode === 'write'`——主窗 `DetailToolbar.tsx:480` 不传 `writeToFile`
 *    （缺省 false），但原实现按 mode 落盘；预览窗全部入口都传 true，故收敛后两侧一致。 */
export function shouldWriteImageTransform(
  kind: ImageTransformKind,
  writeToFile?: boolean,
  mode?: string,
): boolean {
  if (String(mode === undefined || mode === null ? '' : mode) !== 'write') return false;
  return kind === 'flip' ? !!writeToFile : true;
}

/** 探测真实能力。
 *
 * 判据：util 必须是**接受 (src, op[, options]) 的函数**。`moduleRegistry.ts:106-107` 当前
 * 返回的 `() => {}` 元数为 0，据此判为未接线——不猜、不静默：拿不到真实实现就报不可用。
 * 真实实现（解桩后）`rotateImage.js` / `flipImage.js` 的导出元数均为 2，条件自动满足。 */
export function resolveImageTransformCapability(
  kind: ImageTransformKind,
  request: ((name: string) => unknown) | undefined,
  appRootPath: string | undefined,
): ImageTransformCapability {
  const modulePath = IMAGE_TRANSFORM_MODULE_PATH[kind];
  const fullPath = String(appRootPath === undefined || appRootPath === null ? '' : appRootPath) + modulePath;
  if (typeof request !== 'function') {
    return {
      ok: false, modulePath, code: IMAGE_TRANSFORM_UNAVAILABLE,
      reason: `require 能力缺失，无法加载 ${modulePath}`,
    };
  }
  let loaded: unknown;
  try {
    loaded = request(fullPath);
  } catch (err) {
    return {
      ok: false, modulePath, code: IMAGE_TRANSFORM_UNAVAILABLE,
      reason: `${modulePath} 加载抛错：${errorMessage(err)}`,
    };
  }
  if (typeof loaded !== 'function') {
    return {
      ok: false, modulePath, code: IMAGE_TRANSFORM_UNAVAILABLE,
      reason: `${modulePath} 未提供可调用实现（require 返回 ${loaded === undefined ? 'undefined' : typeof loaded}）`,
    };
  }
  const util = loaded as ImageTransformUtil;
  if (util.length < 2) {
    return {
      ok: false, modulePath, code: IMAGE_TRANSFORM_UNAVAILABLE,
      reason: `${modulePath} 是空桩（函数元数 ${util.length}，契约要求 ≥2），图像变换能力尚未接线`,
    };
  }
  return { ok: true, modulePath, util };
}

/** 宽高持久化：单一元数据通道 + 回执校验。 */
export async function persistImageItemMeta(
  item: ImageTransformItem,
  expected: { width: number | undefined; height: number | undefined },
  options: {
    hooks?: ImageTransformHooks;
    /** 本次成功收尾是否已派发缩略图任务（其后端 commitThumbnail 亦写宽高）。 */
    thumbnailDispatched?: boolean;
    /** 本次是否由**后端图像变换端点**完成：该请求在同一事务内已重生成缩略图并把宽高
     *  写进 metadata.json（`backend/src/image-transform-service.js` `#run` 第 5 步）。
     *  与 `thumbnailDispatched` 分开记：那是「本窗前端派发了缩略图任务」，这是「后端事务已落库」。 */
    backendPersisted?: boolean;
  } = {},
): Promise<ImageMetaPersistResult> {
  const hooks = options.hooks || {};
  const imagesChange = hooks.imagesChange || defaultImagesChange();
  // 元数据通道不可用 / 未回执时的共同出口：宽高若已由另一条**既有**通道落库，则判定通过，
  // 不额外新增第二条写入调用——
  //  - `thumbnailDispatched`：后端 `thumbnail-task-service.js` 的 commitThumbnail 写
  //    width/height 与 resolutionWidth/resolutionHeight；
  //  - `backendPersisted`：后端图像变换端点在同一请求内已跑完缩略图任务（同上写宽高）。
  const viaFallback = (): 'regenerate-thumbnail' | 'backend-transform' | 'none' => {
    if (options.thumbnailDispatched) return 'regenerate-thumbnail';
    if (options.backendPersisted) return 'backend-transform';
    return 'none';
  };
  const fallbackToPersisted = (persistedReason: string, noChannelReason: string): ImageMetaPersistResult => {
    const via = viaFallback();
    return via === 'none'
      ? { ok: false, via, expected, observed: null, code: IMAGE_META_NOT_PERSISTED, reason: noChannelReason }
      : { ok: true, via, expected, observed: null, reason: persistedReason };
  };
  if (typeof imagesChange !== 'function') {
    return fallbackToPersisted(
      `元数据通道 ${IMAGE_META_CHANNEL} 不可用（ayncsImagesChange 缺失），宽高落库交由既有通道完成`,
      `元数据通道 ${IMAGE_META_CHANNEL} 不可用（ayncsImagesChange 缺失），且无既有通道落库，宽高未落库`,
    );
  }

  // holder 而非裸 let：退订函数在 Promise 执行器（闭包）内赋值，
  // 裸 let 会被控制流分析定格在 undefined 上（赋值不可见 → 调用点收窄成 never）。
  const subscription: { stop?: (() => void) | void } = {};
  let settled = false;
  const receipt = new Promise<ImageMetaReceipt | null>((resolve) => {
    const handler = (result: unknown): void => {
      if (settled) return;
      const target = receiptItem(result, item.id);
      if (!target) return;
      settled = true;
      resolve(target);
    };
    try {
      subscription.stop = hooks.onMetaReceipt
        ? hooks.onMetaReceipt(handler)
        : defaultSubscribeReceipt(handler);
    } catch (err) {
      resolve(null);
      return;
    }
    // 唯一元数据写路径：本函数内**只此一次**写入，绝不重复写。
    try {
      imagesChange([item]);
    } catch (err) {
      resolve(null);
      return;
    }
    const setTimer = hooks.setTimer
      || ((fn: () => void, ms: number) => setTimeout(fn, ms) as unknown);
    setTimer(() => { if (!settled) { settled = true; resolve(null); } }, META_RECEIPT_TIMEOUT_MS);
  });

  const observed = await receipt;
  if (typeof subscription.stop === 'function') {
    try { subscription.stop(); } catch (err) { /* 退订失败不影响判定 */ }
  }

  if (observed) {
    const widthOk = observed.width === expected.width;
    const heightOk = observed.height === expected.height;
    if (widthOk && heightOk) {
      return { ok: true, via: 'images-change', expected, observed };
    }
    if (options.thumbnailDispatched || options.backendPersisted) {
      return {
        ok: true, via: viaFallback(), expected, observed,
        reason: `元数据通道回执未携带新宽高（回执 ${String(observed.width)}×${String(observed.height)}，`
          + `期望 ${String(expected.width)}×${String(expected.height)}），落库交由既有通道完成`,
      };
    }
    return {
      ok: false, via: 'none', expected, observed, code: IMAGE_META_NOT_PERSISTED,
      reason: `元数据通道回执未携带新宽高（回执 ${String(observed.width)}×${String(observed.height)}，`
        + `期望 ${String(expected.width)}×${String(expected.height)}），且未派发缩略图任务`,
    };
  }

  return fallbackToPersisted(
    `元数据通道 ${IMAGE_META_CHANNEL} 未回执，宽高落库交由既有通道完成`,
    `元数据通道 ${IMAGE_META_CHANNEL} 未回执，宽高未确认落库`,
  );
}

/** 写回入口（**唯一实现**）。返回同步受理结果；异步落盘与收尾在内部完成。
 *
 * 调用方契约：
 *  - `accepted === false` → 能力不可用，调用方**不得**执行视觉变换、不得置 `isRotating`、
 *    不得走成功路径（本函数已给出真实原因的 UI 提示）。
 *  - `accepted === true && willWrite === false` → preview 模式，纯视觉，无写回。
 *  - `accepted === true && willWrite === true` → 已接手：宽高交换与去抖落盘均在本函数内。 */
export function commitImageTransform(options: ImageTransformWritebackOptions): ImageTransformAcceptance {
  const kind = options.kind;
  const modulePath = IMAGE_TRANSFORM_MODULE_PATH[kind];
  const hooks = options.hooks || {};
  const log = hooks.log || defaultLog();
  const willWrite = shouldWriteImageTransform(kind, options.writeToFile, options.mode);

  // preview 模式：不落盘 → 不分流、不探测能力、不交换宽高、不派发缩略图（既有语义不变）。
  if (!willWrite) {
    return { accepted: true, willWrite: false, kind, modulePath };
  }

  // ── 唯一判定点（`./imageTransformRoute`）：格式 + 运行环境 → 落点。 ──
  // 本函数此后只按 dispatch.route 走两条既定分支，**不再出现第二处按扩展名的判断**。
  const dispatch = resolveImageTransformDispatch(options.item, options.runtime);
  if (!dispatch.supported || !dispatch.route) {
    const code = dispatch.code || IMAGE_TRANSFORM_UNAVAILABLE;
    const reason = dispatch.reason || `${modulePath} 在当前环境无落点`;
    log.error(`[app] 图像变换写回被拒绝（${code}）：${reason}`);
    reportError(hooks, code, reason);
    return { accepted: false, willWrite: true, kind, modulePath, code, reason };
  }

  const route: ImageTransformRoute = dispatch.route;
  const capability: ImageTransformCapability | undefined = route === 'renderer'
    ? resolveImageTransformCapability(kind, options.request, options.appRootPath)
    : undefined;
  const backend: ImageTransformBackendCapability | undefined = route === 'backend'
    ? resolveImageTransformBackendCapability()
    : undefined;

  if (capability && !capability.ok) {
    // 明确失败：不改成功状态、不交换宽高、不更新视图、不发成功事件、不重生成缩略图。
    // 拒绝发生在调用方施加视觉变换**之前**，因此界面不会出现「看着转了、文件没动」。
    const reason = capability.reason || `${modulePath} 能力不可用`;
    log.error(`[app] 图像变换写回被拒绝（${IMAGE_TRANSFORM_UNAVAILABLE}）：${reason}`);
    reportError(hooks, IMAGE_TRANSFORM_UNAVAILABLE, reason);
    return {
      accepted: false, willWrite: true, kind, modulePath, route,
      code: IMAGE_TRANSFORM_UNAVAILABLE, reason,
    };
  }

  if (backend && !backend.ok) {
    // 非 JPEG 一路同样「能力不可用即明确失败」：宁可什么都不做，也不静默假成功。
    const code = backend.code || IMAGE_TRANSFORM_BACKEND_UNAVAILABLE;
    const reason = backend.reason || `预加载通道不可用，${kindLabel(kind)} 结果无处落盘`;
    log.error(`[app] 图像变换写回被拒绝（${code}）：${reason}`);
    reportError(hooks, code, reason);
    return { accepted: false, willWrite: true, kind, modulePath, route, code, reason };
  }

  if (route === 'renderer') {
    // 落盘前置条件只对渲染层一路成立：原版 util 按**磁盘路径**直接改写文件，路径拿不到就无从落盘。
    // 后端一路按 item id 自行定位源文件，其存在性/可写性以**后端**的 NOT_FOUND(404) /
    // PERMISSION_DENIED(403) 为权威判据——前端不再做代理判定，免得给出与后端不一致的诊断。
    if (!options.rawPath) {
      const reason = `无法取得条目磁盘路径，${kindLabel(kind)} 结果无处落盘`;
      log.error(`[app] 图像变换写回被拒绝（${IMAGE_TRANSFORM_NO_RAW_PATH}）：${reason}`);
      reportError(hooks, IMAGE_TRANSFORM_NO_RAW_PATH, reason);
      return {
        accepted: false, willWrite: true, kind, modulePath, route,
        code: IMAGE_TRANSFORM_NO_RAW_PATH, reason,
      };
    }
    const denied = (hooks.checkWritable || defaultCheckWritable)(options.rawPath);
    if (denied) {
      log.error(`[app] 图像变换写回被拒绝（${IMAGE_TRANSFORM_WRITE_DENIED}）：${denied}`);
      reportError(hooks, IMAGE_TRANSFORM_WRITE_DENIED, denied);
      return {
        accepted: false, willWrite: true, kind, modulePath, route,
        code: IMAGE_TRANSFORM_WRITE_DENIED, reason: denied,
      };
    }
  }

  // write 模式下的宽高交换（唯一实现）。rotate 交换宽高；flip 不改变尺寸。
  // 每次调用（= 每次点击）交换一次，与累计角度保持奇偶一致（90/270 → 换、180 → 换两次复原）。
  let rollbackWidth: number | undefined;
  let rollbackHeight: number | undefined;
  if (kind === 'rotate') {
    rollbackWidth = options.item.width;
    rollbackHeight = options.item.height;
    options.item.width = rollbackHeight;
    options.item.height = rollbackWidth;
  }

  hooks.setIsRotating?.(true);
  scheduleWrite(options, { route, modulePath, capability, backend }, hooks, log, {
    rollbackWidth, rollbackHeight, modulePath,
  });
  return { accepted: true, willWrite: true, kind, modulePath, route };
}

/** 已定妥的落点与其能力句柄（由唯一判定点分出的两条分支各自的执行面）。 */
interface ResolvedTransformTarget {
  route: ImageTransformRoute;
  modulePath: string;
  capability?: ImageTransformCapability;
  backend?: ImageTransformBackendCapability;
}

interface PendingWrite {
  timer: unknown;
}

const pendingWrites = new Map<ImageTransformItem, PendingWrite>();

/** 去抖落盘：同一 item 的连续调用只保留最后一次（角度/翻转类型取最新值）。 */
function scheduleWrite(
  options: ImageTransformWritebackOptions,
  target: ResolvedTransformTarget,
  hooks: ImageTransformHooks,
  log: ImageTransformLog,
  rollback: { rollbackWidth?: number; rollbackHeight?: number; modulePath: string },
): void {
  const item = options.item;
  const schedule = hooks.schedule || ((fn: () => void, ms: number) => setTimeout(fn, ms) as unknown);
  const cancel = hooks.cancel || ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));

  const previous = pendingWrites.get(item);
  if (previous) cancel(previous.timer);

  const entry: PendingWrite = {
    timer: schedule(() => {
      pendingWrites.delete(item);
      runWrite(options, target, hooks, log, rollback).catch((err) => {
        log.error(`[app] 图像变换写回未处理异常：${errorMessage(err)}`, err);
      });
    }, WRITE_DEBOUNCE_MS),
  };
  pendingWrites.set(item, entry);
}

/** 前端累计角度 → 后端可接受的 90/180/270（整圈回转已在调用前提前返回）。 */
function normalizeRotateDegree(degree: number | undefined): number {
  const value = Number(degree) || 0;
  return ((value % 360) + 360) % 360;
}

/** 后端信封里的结构化失败（承载 code/message/statusCode，供失败收尾**原样**透出）。 */
class BackendTransformError extends Error {
  readonly code: string;

  readonly statusCode: number | undefined;

  constructor(code: string, message: string, statusCode: number | undefined) {
    super(message);
    this.name = 'BackendTransformError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

async function runWrite(
  options: ImageTransformWritebackOptions,
  target: ResolvedTransformTarget,
  hooks: ImageTransformHooks,
  log: ImageTransformLog,
  rollback: { rollbackWidth?: number; rollbackHeight?: number; modulePath: string },
): Promise<void> {
  const kind = options.kind;
  const item = options.item;

  // rotate：整圈回转（degree % 360 === 0）无需落盘（既有语义：不写、不重生成缩略图）。
  if (kind === 'rotate' && (Number(options.degree) || 0) % 360 === 0) {
    safe(log, () => hooks.setIsRotating?.(false));
    return;
  }

  // util / 后端真实返回的尺寸。
  let reportedWidth: number | undefined;
  let reportedHeight: number | undefined;
  const onSuccess = (newWidth: number, newHeight: number): void => {
    if (!newWidth || !newHeight) return;
    reportedWidth = newWidth;
    reportedHeight = newHeight;
  };

  try {
    if (target.route === 'renderer') {
      const util = target.capability?.util as ImageTransformUtil;
      const result = kind === 'rotate'
        ? await util(options.rawPath, Number(options.degree) || 0, { onSuccess })
        : await util(options.rawPath, options.flipType as ImageFlipType);
      if (kind === 'rotate' && result && typeof result === 'object') {
        const resolved = result as { width?: number; height?: number };
        if (resolved.width && resolved.height) onSuccess(resolved.width, resolved.height);
      }
    } else {
      // 非 JPEG：后端在同一请求内完成「写源文件 → 重生成缩略图 → 落 metadata」。
      const result = await invokeImageTransformBackend(
        target.backend as ImageTransformBackendCapability,
        {
          id: String(item.id),
          op: kind,
          ...(kind === 'rotate'
            ? { degree: normalizeRotateDegree(options.degree) }
            : { flipType: options.flipType }),
        },
      );
      if (!result.ok) {
        throw new BackendTransformError(
          result.code || IMAGE_TRANSFORM_BACKEND_FAILED,
          result.message || `后端图像${kindLabel(kind)}失败`,
          result.statusCode,
        );
      }
      // 后端回传的宽高是事务落库后的权威值（rotate 交换后 / flip 不变）。
      if (kind === 'rotate') {
        const width = Number(result.data?.width);
        const height = Number(result.data?.height);
        if (width > 0 && height > 0) onSuccess(width, height);
      }
    }
  } catch (err) {
    // 真实写入失败：回撤视觉变换 + 回滚宽高，并给出真实原因
    // （不再把 util 抛错记成「加载模块失败」这类与原因无关的措辞）。
    safe(log, () => hooks.setIsRotating?.(false));
    if (kind === 'rotate') {
      item.width = rollback.rollbackWidth;
      item.height = rollback.rollbackHeight;
      safe(log, () => hooks.resetView?.());
    }
    // 后端结构化错误码/消息**原样**透出（415 UNSUPPORTED_FORMAT / 403 PERMISSION_DENIED /
    // 404 NOT_FOUND …），只有非结构化的抛错才回落 IMAGE_TRANSFORM_WRITE_FAILED。
    const code = err instanceof BackendTransformError ? err.code : IMAGE_TRANSFORM_WRITE_FAILED;
    const reason = errorMessage(err);
    log.error(`[app] 图像${kindLabel(kind)}写入失败（${code}`
      + `${err instanceof BackendTransformError && err.statusCode ? `，HTTP ${err.statusCode}` : ''}）：${reason}`, err);
    reportError(hooks, code, reason);
    return;
  }

  // ── 成功收尾（只有真实写入 resolve 之后才执行）──
  if (kind === 'rotate' && reportedWidth && reportedHeight) {
    item.width = reportedWidth;
    item.height = reportedHeight;
  }
  safe(log, () => hooks.setIsRotating?.(false));
  delete item.orientation;
  // 单个视图副作用失败不得中断后续的宽高落库判定（判定才是「是否真的成功」的依据）。
  safe(log, () => hooks.updateItemView?.(item));
  safe(log, () => hooks.relayout?.());
  log.info(`[app] ${kindLabel(kind)} image: ${String(item.name)}(${String(item.id)})`);

  // 缩略图任务：**仅渲染层一路需要本窗派发**。后端一路已在其请求内跑完缩略图任务
  // （该任务的 commitThumbnail 同时把 width/height 写进 metadata.json），再派发一次就是对
  // 同一 item 的第二次缩略图任务——既重复劳动，又与库事务竞争，故不派发。
  const regenerate = hooks.regenerateThumbnail || defaultRegenerateThumbnail();
  const thumbnailDispatched = target.route === 'renderer' && typeof regenerate === 'function';
  safe(log, () => { if (thumbnailDispatched) regenerate(item); });

  const meta = await persistImageItemMeta(item, { width: item.width, height: item.height }, {
    hooks,
    thumbnailDispatched,
    backendPersisted: target.route === 'backend',
  });
  if (meta.ok) {
    log.info(`[app] ${kindLabel(kind)} image 宽高落库通道：${meta.via}`
      + (meta.reason ? `（${meta.reason}）` : ''));
    return;
  }
  log.error(`[app] ${kindLabel(kind)} image 宽高未落库（${IMAGE_META_NOT_PERSISTED}）：${meta.reason || ''}`);
  reportError(hooks, IMAGE_META_NOT_PERSISTED, meta.reason || '宽高未确认落库');
}

// ─────────────────────────── 缺省宿主供给（window 全局） ───────────────────────────

/** 执行宿主副作用：失败只记日志，不中断写回主流程的后续步骤。 */
function safe(log: ImageTransformLog, run: () => void): void {
  try {
    run();
  } catch (err) {
    log.error(`[app] 图像变换副作用失败：${errorMessage(err)}`, err);
  }
}

function kindLabel(kind: ImageTransformKind): string {
  return kind === 'rotate' ? 'Rotate' : 'Flip';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

function defaultLog(): ImageTransformLog {
  const w = window as unknown as { electronLog?: ImageTransformLog };
  if (w.electronLog && typeof w.electronLog.error === 'function') return w.electronLog;
  return {
    info: (message: string) => console.log(message),
    warn: (message: string) => console.warn(message),
    error: (message: string, detail?: unknown) => console.error(message, detail === undefined ? '' : detail),
  };
}

function defaultImagesChange(): ((items: ImageTransformItem[]) => void) | undefined {
  const candidate = (window as unknown as { ayncsImagesChange?: (items: ImageTransformItem[]) => void }).ayncsImagesChange;
  return typeof candidate === 'function' ? candidate.bind(window) : undefined;
}

/** 缺省可写性预检：与主窗原实现同判据（`fs.accessSync(rawPath, W_OK)`）。 */
function defaultCheckWritable(rawPath: string): string | null {
  const w = window as unknown as { require?: (name: string) => unknown };
  if (typeof w.require !== 'function') return null; // 拿不到 fs 时不额外拦阻，交由真实写入报错
  let fs: { accessSync?: (target: string, mode?: number) => void; W_OK?: number } | undefined;
  try {
    fs = w.require('fs') as typeof fs;
  } catch (err) {
    return null;
  }
  if (!fs || typeof fs.accessSync !== 'function') return null;
  try {
    fs.accessSync(rawPath, fs.W_OK);
    return null;
  } catch (err) {
    return errorMessage(err);
  }
}

function defaultRegenerateThumbnail(): ((item: ImageTransformItem) => void) | undefined {  let bus: { send?: (channel: string, params?: unknown) => void } | null = null;
  try {
    bus = getIpcBus();
  } catch (err) {
    return undefined;
  }
  if (!bus || typeof bus.send !== 'function') return undefined;
  return (item: ImageTransformItem) => bus?.send?.(REGENERATE_THUMBNAIL_CHANNEL, [item]);
}

function defaultSubscribeReceipt(
  handler: (result: unknown) => void,
): (() => void) | void {
  let bus: (Record<string, unknown>) | null = null;
  try {
    bus = getIpcBus();
  } catch (err) {
    return undefined;
  }
  if (!bus) return undefined;
  const on = bus.on;
  if (typeof on !== 'function') return undefined;
  (on as (channel: string, cb: (result: unknown) => void) => void).call(bus, IMAGE_META_RECEIPT_EVENT, handler);
  const off = bus.off;
  if (typeof off === 'function') {
    return () => (off as (channel: string, cb: (result: unknown) => void) => void)
      .call(bus, IMAGE_META_RECEIPT_EVENT, handler);
  }
  return undefined;
}

/** 回执中取本 item：`item:operation-result` 的载荷形如 `{ ok, action, items, error }`。 */
function receiptItem(result: unknown, id: string | undefined): { width: unknown; height: unknown } | null {
  if (!result || typeof result !== 'object') return null;
  const payload = result as { action?: unknown; items?: unknown };
  if (payload.action !== undefined && payload.action !== null
    && payload.action !== IMAGE_META_CHANNEL && payload.action !== 'image-change') {
    return null;
  }
  const list = Array.isArray(payload.items) ? payload.items : [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as { id?: unknown; width?: unknown; height?: unknown };
    if (id !== undefined && item.id !== id) continue;
    return { width: item.width, height: item.height };
  }
  return null;
}

function reportError(hooks: ImageTransformHooks, code: string, reason: string): void {
  if (hooks.showError) {
    try { hooks.showError(code, reason); } catch (err) { /* UI 失败不掩盖真实原因 */ }
    return;
  }
  defaultShowError(code, reason);
}

function defaultShowError(code: string, reason: string): void {
  const w = window as unknown as {
    swal?: (options: Record<string, unknown>) => Promise<unknown>;
    i18n?: { __?: (key: string) => string };
  };
  if (typeof w.swal !== 'function') return;
  const okText = w.i18n && typeof w.i18n.__ === 'function' ? w.i18n.__('general.ok') : 'OK';
  try {
    void w.swal({
      html: `
        <div class="alert">
          <div class="alert-icon error"></div>
          <h4 class="alert-title">Error</h4>
          <p class="alert-desc">${reason}</p>
        </div>
      `,
      showCloseButton: false, showCancelButton: true, allowOutsideClick: false,
      focusConfirm: false, focusCancel: false, padding: 24,
      width: 400,
      customClass: 'alert-box',
      confirmButtonColor: '#1373FB',
      cancelButtonColor: '#777777',
      confirmButtonText: okText,
      cancelButtonText: okText,
    }).catch(() => undefined);
  } catch (err) { /* 弹窗不可用时日志已记录真实原因 */ }
}

/** 诊断口：当前在飞的落盘去抖条目数（测试与排障读取；业务不依赖）。 */
export function pendingImageTransformWrites(): number {
  return pendingWrites.size;
}
