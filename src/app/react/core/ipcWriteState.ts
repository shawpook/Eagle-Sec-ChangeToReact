/**
 * P1-c-2：写路径共享状态（渲染层**唯一实例**）。
 *
 * 迁移自 `frontend/public/shims.js` 的写路径簇（原 805-1195 区间）：
 * `customThumbnailItemIds` / `itemUpdateQueue`（串行写队列）/ 本地导入在飞计数
 * （`pendingLocalImports`/`settledLocalImports` + `trackLocalImport`）/ `mergeCachedItems` /
 * `emitImportedItems` / 导入缩略图回填（`refreshImportedThumbnails`）/ 调色板分析
 * （`analyzeItemPalette`/`scheduleMissingPaletteAnalysis`）。
 *
 * 铁律（用户决策 #2）：**shims 与 channelBridge 连接同一实例** —— React 启动期安装为
 * `window.__eagleIpcWriteState`；shims 的消费方（capture 轮询、导入分支、缩略图回填、重扫等）
 * 经该全局引用同一队列/计数器/事件发布器，禁止各留一套。缩略图刷新 await 同一写队列、
 * 导入与 capture 轮询共享同一导入计数 —— 本模块是这些共享面的唯一真身。
 *
 * 语义与 shims 原实现逐字对齐（含 `.catch(() => undefined)` 链、file-uploaded 去重、错误吞放）。
 */

const textThumbnailExtensions = new Set([
  'txt', 'md', 'markdown', 'log', 'rst', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv',
]);

export const customThumbnailItemIds = new Set<string>();

let writeChain: Promise<any> = Promise.resolve();

/** 串行写入：`fn` 按入队顺序执行；任一失败不打断后续（与 shims `itemUpdateQueue` 同语义）。 */
export function enqueueWrite(fn: () => Promise<any>): Promise<any> {
  const run = writeChain.catch(() => undefined).then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

/** 等写队列排空（缩略图回填/快照前用；与 shims `await itemUpdateQueue.catch(()=>undefined)` 同语义）。 */
export function whenWriteQueueIdle(): Promise<void> {
  return writeChain.catch(() => undefined);
}

let pendingLocalImports = 0;
let settledLocalImports = 0;

/** 本地导入在飞计数（capture 轮询据此整轮跳过，避免同 id 双发 file-uploaded）。 */
export function trackLocalImport<T>(promise: Promise<T>): Promise<T> {
  pendingLocalImports += 1;
  const settle = () => { pendingLocalImports -= 1; settledLocalImports += 1; };
  return promise.then(
    (value) => { settle(); return value; },
    (err) => { settle(); throw err; },
  );
}

export function importCounters(): { pending: number; settled: number } {
  return { pending: pendingLocalImports, settled: settledLocalImports };
}

/** 在 shims 总线上发布事件（与 shims `mockEmit` 同实体的当前 emit；file-uploaded 去重在包装内）。 */
export function emitEvent(channel: string, payload?: any): void {
  const bus = (window as any).__eagleIpc;
  if (bus && typeof bus.emit === 'function') bus.emit(channel, payload);
}

/** 合并更新条目到 `__mockLibraryCache`（原 shims 版的 Angular scope 镜像依赖已死的 window.angular，
 *  React 下恒不执行，故不迁入；哨兵亦禁 `$evalAsync` 形态）。
 *
 *  b1-9bz-E7 修复（main-ui-workflow 定位）：cache 条目一律存**副本**，绝不与 live store 对象同引用。
 *  旧实现 unshift 原对象 → cache 与 live 同引用 → 后续任何 `mergeCachedItems(陈旧条目)`（例如导入期
 *  调度的调色板分析携带导入初值）经 `Object.assign` 直接改到 live 对象上，把在飞编辑打回初值
 *  （实测栈：mergeCachedItems → Object.assign → annotation setter）。cache 语义本就是「后端库镜像」，
 *  与 live 解引用后，live 侧更新由 image.changed / image.palette.updated / thumbnail-generated
 *  等事件承担。 */
export function mergeCachedItems(updatedItems: any): any[] {
  const cached = (window as any).__mockLibraryCache || [];
  const updates = Array.isArray(updatedItems) ? updatedItems : [updatedItems];
  updates.forEach((updated: any) => {
    if (!updated || !updated.id) return;
    const index = cached.findIndex((entry: any) => entry.id === updated.id);
    if (index >= 0 && cached[index] !== updated) Object.assign(cached[index], updated);
    else if (index < 0) cached.unshift({ ...updated });
  });
  (window as any).__mockLibraryCache = cached;
  return cached;
}

function desktopApi(): any {
  return (window as any).eagleDesktop || null;
}

async function thumbnailTaskSnapshot(taskId: string): Promise<any> {
  const d = desktopApi();
  if (d && d.thumbnail && typeof d.thumbnail.status === 'function') {
    return d.thumbnail.status(taskId);
  }
  const apiBase = ((window as any).__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api/item/thumbnailTask/status?taskId=${encodeURIComponent(String(taskId || ''))}`);
  const payload = await response.json();
  if (!response.ok || !payload || payload.status !== 'success') {
    throw new Error(payload && payload.message ? payload.message : `Thumbnail status failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function libraryItemsSnapshot(): Promise<any[]> {
  const d = desktopApi();
  if (d && d.library && typeof d.library.current === 'function') {
    const library = await d.library.current();
    return Array.isArray(library.items) ? library.items : [];
  }
  const apiBase = ((window as any).__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api/library/current?includeItems=true`);
  const payload = await response.json();
  if (!response.ok || !payload || payload.status !== 'success') {
    throw new Error(payload && payload.message ? payload.message : `Library refresh failed: HTTP ${response.status}`);
  }
  return Array.isArray(payload.data.items) ? payload.data.items : [];
}

/**
 * 导入缩略图回填。语义与 shims 原实现逐字一致：先在飞任务轮询、无任务则以库快照判定；
 * 快照前**排空写队列**（否则 emit 的整条快照会把用户在轮询窗口内的编辑覆盖回旧值，
 * 并让 in-flight 的 images-change 克隆到旧值持久化 —— m1 multi inspector persistence 的源头）。
 * 只发缩略图相关字段的 `thumbnail-generated`（itemDomain 处理器 Object.assign 回 scope）。
 */
export async function refreshImportedThumbnails(items: any): Promise<void> {
  const list = (Array.isArray(items) ? items : [items]).filter((item: any) => item && item.id);
  for (const item of list) {
    try {
      let complete = false;
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if (item.thumbnailTask) {
          const task = await thumbnailTaskSnapshot(item.thumbnailTask).catch(() => null);
          if (task && task.status === 'complete') { complete = true; break; }
          if (task && (task.status === 'failed' || task.status === 'cancelled' || task.error)) break;
        } else {
          const probeItems = await libraryItemsSnapshot();
          const probe = probeItems.find((entry: any) => entry && entry.id === item.id);
          if (probe && !probe.processingThumbnail && !probe.noThumbnail) { complete = true; break; }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!complete) continue;
      await whenWriteQueueIdle();
      const libraryItems = await libraryItemsSnapshot();
      const updated = libraryItems.find((entry: any) => entry && entry.id === item.id);
      if (updated && !updated.processingThumbnail) {
        if (!Number(updated.width) || !Number(updated.height)) {
          updated.width = Number(item.width) || 480;
          updated.height = Number(item.height) || 480;
        }
        mergeCachedItems(updated);
        emitEvent('thumbnail-generated', {
          id: updated.id,
          name: updated.name,
          ext: updated.ext,
          width: updated.width,
          height: updated.height,
          noThumbnail: updated.noThumbnail,
          processingThumbnail: false,
          modificationTime: updated.modificationTime,
        });
      }
    } catch (err) {
      console.warn('[ipcWriteState] imported thumbnail refresh failed', err);
    }
  }
}

export function emitImportedItems(items: any, channel: string): any[] {
  const imported = (Array.isArray(items) ? items : [items])
    .filter((item: any) => item && item.id)
    .map((item: any) => {
      if (!item.width && !item.height && textThumbnailExtensions.has(String(item.ext || '').toLowerCase())) {
        item.width = 480;
        item.height = 480;
      }
      return item;
    });
  mergeCachedItems(imported);
  imported.forEach((item: any) => emitEvent('file-uploaded', item));
  if (imported.length > 0) emitEvent('file-uploaded-end', {});
  emitEvent('import:operation-result', { ok: true, channel, items: imported });
  scheduleMissingPaletteAnalysis(imported);
  void refreshImportedThumbnails(imported);
  return imported;
}

function canAnalyzePalette(item: any): boolean {
  return Boolean(
    item &&
    item.id &&
    !item.isDeleted &&
    !item.noPreview &&
    Number(item.width) > 0 &&
    Number(item.height) > 0
  );
}

const paletteAnalysisRequests = new Map<string, Promise<any>>();

export function analyzeItemPalette(item: any, options?: any): Promise<any> {
  const force = Boolean(options && options.force);
  if (!canAnalyzePalette(item) || (!force && Array.isArray(item.palettes))) return Promise.resolve(item);
  if (paletteAnalysisRequests.has(item.id)) return paletteAnalysisRequests.get(item.id)!;

  item.processingPalette = true;
  // b1-9bz-E7：调色板分析只拥有 palettes/processingPalette/modificationTime 字段域——
  // 不用整条 item 合并（item 是调度时的快照，整条合并会覆盖更晚的本地编辑）。
  mergeCachedItems({ id: item.id, processingPalette: true, palettes: item.palettes });
  const apiBase = ((window as any).__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  const request = fetch(`${apiBase}/api/item/refreshPalette`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id }),
  })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result || result.status !== 'success') {
        throw new Error(result && result.message ? result.message : `Palette analysis failed: HTTP ${response.status}`);
      }
      const updated = result.data && result.data.item ? result.data.item : result.data;
      if (updated && updated.id) {
        const belongsToCurrentLibrary = ((window as any).__mockLibraryCache || []).some((entry: any) => entry && entry.id === updated.id);
        if (belongsToCurrentLibrary) {
          mergeCachedItems({ id: updated.id, palettes: updated.palettes, modificationTime: updated.modificationTime });
          emitEvent('image.palette.updated', updated);
        }
        return updated;
      }
      return item;
    })
    .catch((err) => {
      delete item.processingPalette;
      const belongsToCurrentLibrary = ((window as any).__mockLibraryCache || []).some((entry: any) => entry && entry.id === item.id);
      if (belongsToCurrentLibrary) mergeCachedItems({ id: item.id, processingPalette: undefined });
      console.warn(`[ipcWriteState] palette analysis failed for ${item.id}`, err);
      return item;
    })
    .finally(() => paletteAnalysisRequests.delete(item.id));
  paletteAnalysisRequests.set(item.id, request);
  return request;
}

export function scheduleMissingPaletteAnalysis(items: any): void {
  const list = Array.isArray(items) ? items : [items];
  list.forEach((item: any) => {
    if (canAnalyzePalette(item) && !Array.isArray(item.palettes)) analyzeItemPalette(item);
  });
}

/** 安装为 `window.__eagleIpcWriteState`（React 启动期调用一次；shims 消费方经此取共享实例）。 */
export function installIpcWriteState(): void {
  const state = {
    customThumbnailItemIds,
    enqueueWrite,
    whenWriteQueueIdle,
    trackLocalImport,
    importCounters: () => importCounters(),
    mergeCachedItems,
    emitImportedItems,
    emitEvent,
    analyzeItemPalette,
    scheduleMissingPaletteAnalysis,
    refreshImportedThumbnails,
  };
  (window as any).__eagleIpcWriteState = state;
}

/** 供 bridge 的 images-change 分支取共享实例（未安装时回退到惰性自建，防止导入期调用崩）。 */
export function getIpcWriteState(): any {
  const installed = (window as any).__eagleIpcWriteState;
  if (installed) return installed;
  const fallback = {
    customThumbnailItemIds,
    enqueueWrite,
    whenWriteQueueIdle,
    trackLocalImport,
    importCounters: () => importCounters(),
    mergeCachedItems,
    emitImportedItems,
    emitEvent,
    analyzeItemPalette,
    scheduleMissingPaletteAnalysis,
    refreshImportedThumbnails,
  };
  (window as any).__eagleIpcWriteState = fallback;
  return fallback;
}