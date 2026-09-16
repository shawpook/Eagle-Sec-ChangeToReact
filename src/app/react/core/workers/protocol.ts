/**
 * M3-3：经典 Worker「自有协议」的**唯一类型事实源**。
 *
 * ## 为什么协议类型住在 React 侧而不是 `src/app/js/workers/`
 * 三个 worker（`bitmapWorker.js` / `tifWorker.js` / `calHammingDistance.js`）必须保持
 * **经典 script worker**（`new Worker(url)`，不带 `type: 'module'`）：
 *  - `bitmapWorker.js:393-397`、`:457-462` 与 `tifWorker.js:2-6` 用 `importScripts()` 装载
 *    第三方 UMD 引擎（libheif.js / UTIF.js / UDOC.js）。改成 ESM `import` 会改变 UMD 的
 *    全局安装行为，并且 `tests/dist-entry-check.mjs` 靠 AST 识别 `importScripts` 才能把
 *    这两个引擎文件拉进产物闭包——改完之后闭包会**静默**少掉引擎（门禁不报错）。
 *  - 经典 worker 里没有模块加载器，**无法 import 本模块**。
 *
 * ## 两端一致性怎么保证（本批选的路）
 * 「worker 侧直接引用 TS」这条路走不通，本批改为
 * **共享类型/常量 + 双向字面量契约测试**：
 *  - 主线程侧（`bitmapViewer.ts` / `commentHooks.ts` / `eagleClasses.ts`）**直接 import 本模块**
 *    的类型与常量，不再散落字符串字面量；
 *  - worker 侧保留字面量（这是硬边界，不能动），由 `tests/worker-protocol-contract.mjs`
 *    用 TypeScript AST 从 worker 源码里**提取**这些字面量，与本模块的常量逐一比对——
 *    任一端改了信封/字段/通道名而另一端没跟上，该测试立刻变红。
 *
 * 选这条路而不是「worker 顶部运行时断言」的代价，明写在测试文件头：
 * 契约是**构建期/CI 期**而非运行期发现的；换来的是 worker 本体零运行期开销、
 * 且不向第三方引擎宿主文件里注入任何我方代码。
 *
 * ## 边界
 * 本模块只放**类型与字符串/数值常量**，不得包含任何运行期逻辑、DOM 访问或第三方引擎引用。
 */

/**
 * 自有协议版本号。
 *
 * 任一端对**信封语义**（不是新增可选字段）做不兼容变更时递增；
 * `tests/worker-protocol-contract.mjs` 会校验 worker 侧声明的版本与这里一致。
 *
 * 历史：
 *  - 1：M3-3 首次登记（bitmapWorker tile 协议 / 原生 HEIC 反向请求 / tifWorker / hamming）。
 */
export const WORKER_PROTOCOL_VERSION = 1;

/* ================================================================== */
/* P1：bitmapWorker tile 协议（bitmapViewer.ts ↔ bitmapWorker.js）      */
/* ================================================================== */

/** worker 只依赖 item 的这几个面；不整体引用 Item 类型，避免协议模块反向依赖 store。 */
export interface BitmapWorkerItemRef {
  /** 扩展名（小写、不带点），worker 据此分派 TIF / HEIF / 常规解码路径。 */
  ext: string;
  /** 动图判定：`needsImgTag()` 只看 `item.animated === true`（APNG / 动图 WebP / AVIF）。 */
  animated?: boolean;
  /** 预加载路径传入的是 `{...item, url}`，worker 侧不读，但保留以维持信封形状。 */
  url?: string;
}

/** 主 → W（`bitmapViewer.ts` 的 preload/create 两处，形状相同）。 */
export interface BitmapWorkerRequest {
  url: string;
  item: BitmapWorkerItemRef;
  tileSize: number;
}

/** tile 协议的单块：坐标 + 已 transfer 的 ImageBitmap。 */
export interface BitmapWorkerTile {
  x: number;
  y: number;
  w: number;
  h: number;
  tile: ImageBitmap;
}

/**
 * W → 主。**不是判别式联合**：worker 按 msg1（bitmap）/ msg2（tiles）/ msg3（viewportBitmap）
 * 分三条投递**同族的部分信封**，主线程逐条按字段存在与否分派。因此这里如实建模为
 * 「字段全可选」的单一接口，而不是硬凑一个 tag。
 *
 * 三处 catch 走 `error` 分支（文案见 {@link BITMAP_WORKER_ERROR_MESSAGES}）。
 */
export interface BitmapWorkerResponse {
  /** true 表示 worker 放弃解码、请主线程退回 `<img>`；与 `bitmap` 分支互斥。 */
  usingImgTag?: boolean;
  /** msg1 的解码结果（带 transfer）。 */
  bitmap?: ImageBitmap;
  orientation?: string | null;
  /** msg1 里恒为 null；msg3 里才是真位图。 */
  viewportBitmap?: ImageBitmap | null;
  totalTiles?: number;
  imageWidth?: number;
  imageHeight?: number;
  /** msg2 的 tile 数组（带 transfer list）。 */
  tiles?: BitmapWorkerTile[];
  /** 失败分支。 */
  error?: string;
}

/** worker 侧三处 catch 实际使用的错误文案（契约测试逐条比对）。 */
export const BITMAP_WORKER_ERROR_MESSAGES = {
  generic: 'Failed to load or process image',
  heif: 'Failed to load or process HEIF image',
  tif: 'Failed to load or process TIF image',
} as const;

/* ================================================================== */
/* P2：原生 HEIC——主线程 ↔ worker 的**反向**请求（worker 主动问主线程） */
/* ================================================================== */

/** 信封上的 `type` 判别式字面量。两端必须逐字一致（契约测试逐一比对 worker 源码）。 */
export const NATIVE_HEIC_CHANNEL = {
  /** 主 → W：声明主线程侧原生解析器是否可用。bitmapWorker.js:6-7 消费。 */
  INIT: 'INIT_NATIVE_PARSER',
  /** W → 主：请求解析。bitmapWorker.js:334-337 投递。 */
  REQUEST: 'NATIVE_HEIC_PARSE_REQUEST',
  /** 主 → W：解析结果。bitmapViewer.ts:85-102 投递，bitmapWorker.js 按 requestId 配对。 */
  RESPONSE: 'NATIVE_HEIC_PARSE_RESPONSE',
} as const;

export type NativeHeicChannel = (typeof NATIVE_HEIC_CHANNEL)[keyof typeof NATIVE_HEIC_CHANNEL];

/** worker 侧等待原生解析回复的超时（`bitmapWorker.js` 的 setTimeout）。 */
export const NATIVE_HEIC_PARSE_TIMEOUT_MS = 10000;

export interface NativeHeicInitMessage {
  type: typeof NATIVE_HEIC_CHANNEL.INIT;
  available: boolean;
}

export interface NativeHeicParseRequestMessage {
  type: typeof NATIVE_HEIC_CHANNEL.REQUEST;
  data: {
    filePath: string;
    /** worker 侧生成（`heic_<ts>_<rand>`），主线程原样回填。 */
    requestId: string;
  };
}

export interface NativeHeicParseResponseMessage {
  type: typeof NATIVE_HEIC_CHANNEL.RESPONSE;
  data: {
    requestId: string;
    success: boolean;
    tempFilePath?: string;
    error?: string;
  };
}

/** worker 侧原生解析器的可用性标志名（`bitmapWorker.js:2` 初值 false）。 */
export const NATIVE_HEIC_AVAILABLE_FLAG = 'nativeHeicParserAvailable';

/* ================================================================== */
/* P3：tifWorker（commentHooks.ts ↔ tifWorker.js）                     */
/* ================================================================== */

/** 主 → W。无任务 ID、无取消消息——取消靠 `terminate()` + 调用侧版本判定。 */
export interface TifWorkerRequest {
  url: string;
}

/**
 * W → 主（成功）。`url` 是 worker 原样回显的入参——**不要**拿它做陈旧判定：
 * `onmessage` 注册在本次新建的 worker 上，回显值恒等于本次入参，
 * 该比较对任何陈旧响应都为假（这正是 M3-3 修掉的缺陷点之一）。
 */
export interface TifWorkerSuccessResponse {
  rgba: Uint8Array;
  width: number;
  height: number;
  url: string;
}

/** W → 主（失败）。 */
export interface TifWorkerErrorResponse {
  error: string;
}

export type TifWorkerResponse = TifWorkerSuccessResponse | TifWorkerErrorResponse;

/** `tifWorker.js` 唯一的失败文案。 */
export const TIF_WORKER_ERROR_MESSAGE = 'Failed to load or process image';

/* ================================================================== */
/* P4：calHammingDistance（eagleClasses.ts ↔ calHammingDistance.js）    */
/* ================================================================== */

/** 参与相似度分组的条目——worker 只读 `id` / `width` / `height`。 */
export interface HammingWorkerItemRef {
  id: string;
  width: number;
  height: number;
}

/** 主 → W。`part` 是本 worker 负责的切片，`all` 是全集（内层循环扫的就是它）。 */
export interface HammingWorkerRequest {
  all: HammingWorkerItemRef[];
  part: HammingWorkerItemRef[];
  /** id → 二进制指纹串（`BigInt('0b' + fp)` 参与异或）。 */
  fingerprintMap: Record<string, string | undefined>;
  /** 相似度阈值，`1 - hamming/length >= fingerprintWeighted` 才归组。 */
  fingerprintWeighted: number;
}

/** 分组结果的一条（id 是组内最后一项的 id，`items` 含组内全部条目）。 */
export interface HammingWorkerGroup<TItem = HammingWorkerItemRef> {
  id: string;
  items: TItem[];
}

/** W → 主：**裸数组**，不是信封对象（`calHammingDistance.js` 直接 `postMessage(result)`）。 */
export type HammingWorkerResponse<TItem = HammingWorkerItemRef> = HammingWorkerGroup<TItem>[];

/** `eagleClasses.ts` 的 worker 池上限。 */
export const HAMMING_WORKER_POOL_MAX = 4;

/** worker 逐个分片的下限规模：`ceil(items / HAMMING_ITEMS_PER_WORKER)`。 */
export const HAMMING_ITEMS_PER_WORKER = 3000;

/* ================================================================== */
/* P5：heic2bitmap —— 同 Realm 函数调用（不是消息协议）                  */
/* ================================================================== */

/** `heic2bitmap-worker.js` 通过 `self.heic2bitmap = ...` 安装，`bitmapWorker.js` 同 Realm 调用。 */
export const HEIC2BITMAP_GLOBAL = 'heic2bitmap';

/** 缺省 WASM 路径（相对 worker 目录；`libheif.wasm` 全靠显式登记进产物闭包）。 */
export const HEIC2BITMAP_DEFAULT_WASM_PATH = './libheif.wasm';

export interface Heic2BitmapResult {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** `self.heic2bitmap` 的签名（worker 侧实现，主线程不直接调用）。 */
export type Heic2BitmapFn = (arrayBuffer: ArrayBuffer, wasmPath?: string) => Promise<Heic2BitmapResult>;

/* ================================================================== */
/* 有意**不**放进本模块的东西                                          */
/* ================================================================== */

/*
 * 三个 `new Worker('...')` 的入口 URL：`tests/dist-entry-check.mjs` 的产物闭包走查
 * 只认 `new Worker('<字面量>')`。抽成常量后 minifier 会把它提升为变量，门禁将看不到
 * 引用点，worker 会**静默**掉出产物闭包（不报错）。故 URL 字面量必须留在各自的创建点。
 */
