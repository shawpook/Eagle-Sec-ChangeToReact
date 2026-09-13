/**
 * P2：详情原图交付门控（自 `frontend/public/shims.js:56-232` 迁入）。
 *
 * 背景：shims 版以 25ms 轮询包装 scope 面/驱动面的 `enterDetailMode`；但 React UI 的所有入口
 * （网格双击 `selectionService.ts:200`、`inspectorActions`、`detailService`、`miscDomain`）都直接
 * 调用 import 的 `machineryEnterDetailMode`，二者非同一函数对象 —— 实测门控在 UI 路径下不生效
 * （`tests/probe-detail-gate-reachability.mjs`，详见 `docs/e5-5-shims-retirement-plan.md` §0.1）。
 *
 * 本模块改为**直接挂钩**：`machineryEnterDetailMode` / `machineryLeaveDetailMode` 内部调用
 * `onDetailEnter` / `onDetailLeave`，于是 UI、`main.cjs` 驱动脚本（经 driver 面 → 同一挂载函数）
 * 三条入口一致生效，且不再需要轮询。
 *
 * 机制：位图类条目进入详情时给 body 加 `eagle-detail-awaiting-original`
 * （CSS 把 `#detail-container` 压为 `opacity:0`），等 bitmapWorker 报瓦片、或 `#detail-image`
 * 已加载到与原图 URL 一致、且画布连续 3 帧签名稳定后移除；15s 超时兜底。
 *
 * 注：原 shims 版在 `enterDetailMode` 里另有一条「document workspace」分支（`openDocumentViewer`），
 * 本批**不接**——React 侧文档/图片各有自己的 viewer 路由，接了会重复（见 §0.1 末段）。
 */

import { getDriverApi } from './driverApi';

const detailBitmapExtensions = new Set([
  'avif', 'bmp', 'heic', 'heif', 'hif', 'insp', 'jfif', 'jpe', 'jpeg', 'jpg', 'jxl',
  'png', 'svg', 'tif', 'tiff', 'webp',
]);

const detailRenderState = {
  itemId: '',
  lockedAt: 0,
  releasedAt: 0,
  tileCount: 0,
  mode: '',
  previousItemId: '',
  initialCanvasSignature: '',
  tilesPrepared: false,
  canvasCandidate: '',
  canvasStableFrames: 0,
  timeout: 0 as any,
};
const detailPreparedTiles = new Map<string, number>();

/** 读面 = 驱动面（与 shims `bodyScope()` 原解析一致：window.__eagleDriver）。 */
function scope(): any {
  return getDriverApi();
}

/** 对画布分区取样，连续多帧签名一致时才视为原图渲染稳定。 */
function detailCanvasSignature(): string {
  const canvas = document.querySelector('#bitmap-viewer canvas') as HTMLCanvasElement | null;
  if (!canvas || canvas.width < 2 || canvas.height < 2) return '';
  try {
    const context = canvas.getContext('2d');
    if (!context) return '';
    let signature = `${canvas.width}x${canvas.height}:`;
    let hasPixels = false;
    for (let y = 1; y < 6; y += 1) {
      for (let x = 1; x < 6; x += 1) {
        const pixel = context.getImageData(
          Math.min(canvas.width - 1, Math.floor((canvas.width * x) / 6)),
          Math.min(canvas.height - 1, Math.floor((canvas.height * y) / 6)),
          1,
          1
        ).data;
        if (pixel[3] > 0) hasPixels = true;
        signature += `${pixel[0].toString(16)}${pixel[1].toString(16)}${pixel[2].toString(16)}${pixel[3].toString(16)};`;
      }
    }
    return hasPixels ? signature : '';
  } catch (err) {
    return '';
  }
}

function releaseDetailImage(itemId: string, mode: string): boolean {
  const s = scope();
  if (!s || !s.isDetailMode || !s.current || s.current.id !== itemId) return false;
  detailRenderState.mode = mode;
  detailRenderState.releasedAt = performance.now();
  document.body.classList.remove('eagle-detail-awaiting-original');
  return true;
}

function waitForDetailOriginal(itemId: string, tiles: boolean): void {
  const deadline = performance.now() + 5000;
  const check = () => {
    const s = scope();
    if (!s || !s.isDetailMode || !s.current || s.current.id !== itemId) {
      document.body.classList.remove('eagle-detail-awaiting-original');
      return;
    }
    const canvasSignature = detailCanvasSignature();
    const canvasUpdated = canvasSignature && (
      tiles ||
      detailRenderState.previousItemId === itemId ||
      (detailRenderState.tilesPrepared && canvasSignature !== detailRenderState.initialCanvasSignature)
    );
    if (canvasUpdated) {
      if (detailRenderState.canvasCandidate === canvasSignature) detailRenderState.canvasStableFrames += 1;
      else {
        detailRenderState.canvasCandidate = canvasSignature;
        detailRenderState.canvasStableFrames = 1;
      }
      if (detailRenderState.canvasStableFrames >= 3) {
        releaseDetailImage(itemId, 'canvas');
        return;
      }
    }
    const image = document.querySelector('#detail-image') as HTMLImageElement | null;
    const rawUrl = typeof s.getRawUrl === 'function' ? String(s.getRawUrl(s.current) || '') : '';
    const source = image ? String(image.currentSrc || image.src || '') : '';
    if (image && image.complete && image.naturalWidth > 1 && rawUrl && source === rawUrl) {
      requestAnimationFrame(() => requestAnimationFrame(() => releaseDetailImage(itemId, 'image')));
      return;
    }
    if (performance.now() < deadline) requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

let installed = false;

/** 幂等安装：暴露诊断口、注入门控样式、挂 bitmapWorker 瓦片探针。启动期调用一次。 */
export function installDetailDeliveryGate(): void {
  if (installed) return;
  installed = true;
  (window as any).__eagleDetailDeliveryState = detailRenderState;

  const style = document.createElement('style');
  style.textContent = 'body.eagle-detail-awaiting-original #detail-container { opacity: 0 !important; }';
  document.head.appendChild(style);

  // 记录原图瓦片完成状态，同时覆盖预加载后打开和同一图片重复打开的场景。
  if (typeof (window as any).Worker === 'function' && !(window as any).__eagleDetailWorkerProbeInstalled) {
    const NativeWorker = (window as any).Worker;
    class DetailWorker extends NativeWorker {
      __eagleBitmapWorker: boolean;
      __eagleBitmapItemId: string;

      constructor(url: any, options: any) {
        super(url, options);
        this.__eagleBitmapWorker = /(?:^|\/)bitmapWorker\.js(?:[?#]|$)/i.test(String(url || ''));
        this.__eagleBitmapItemId = '';
        if (this.__eagleBitmapWorker) {
          this.addEventListener('message', (event: any) => {
            const itemId = this.__eagleBitmapItemId;
            if (!itemId || !event.data) return;
            if (Array.isArray(event.data.tiles)) {
              detailPreparedTiles.set(itemId, event.data.tiles.length);
              if (detailRenderState.itemId === itemId) {
                detailRenderState.tileCount = event.data.tiles.length;
                setTimeout(() => waitForDetailOriginal(itemId, true), 0);
              }
            } else if (event.data.usingImgTag && detailRenderState.itemId === itemId) {
              setTimeout(() => waitForDetailOriginal(itemId, false), 0);
            }
          });
        }
      }

      postMessage(message: any, transfer?: any): void {
        if (this.__eagleBitmapWorker && message && message.item && message.item.id) {
          this.__eagleBitmapItemId = message.item.id;
        }
        if (arguments.length > 1) return super.postMessage(message, transfer);
        return super.postMessage(message);
      }
    }
    (window as any).Worker = DetailWorker;
    (window as any).__eagleDetailWorkerProbeInstalled = true;
  }
}

/** 详情进入前置：位图类条目加门控（原 shims 包装体的 bitmap 分支）。 */
export function onDetailEnter(target: any): void {
  if (!target || !target.id) return;
  const extension = String(target.ext || '').toLowerCase();
  if (!detailBitmapExtensions.has(extension)) return;
  detailRenderState.previousItemId = detailRenderState.itemId;
  detailRenderState.itemId = target.id;
  detailRenderState.lockedAt = performance.now();
  detailRenderState.releasedAt = 0;
  detailRenderState.tileCount = detailPreparedTiles.get(target.id) || 0;
  detailRenderState.initialCanvasSignature = detailCanvasSignature();
  detailRenderState.tilesPrepared = detailPreparedTiles.has(target.id);
  detailRenderState.canvasCandidate = '';
  detailRenderState.canvasStableFrames = 0;
  detailRenderState.mode = 'waiting';
  document.body.classList.add('eagle-detail-awaiting-original');
  clearTimeout(detailRenderState.timeout);
  detailRenderState.timeout = setTimeout(() => {
    if (detailRenderState.itemId !== target.id || detailRenderState.releasedAt) return;
    detailRenderState.mode = 'timeout';
    document.body.classList.remove('eagle-detail-awaiting-original');
  }, 15000);
  setTimeout(() => waitForDetailOriginal(target.id, false), 0);
}

/** 详情退出：立即解除门控（原 shims 包装体的 leaveDetailMode 分支）。 */
export function onDetailLeave(): void {
  document.body.classList.remove('eagle-detail-awaiting-original');
}
