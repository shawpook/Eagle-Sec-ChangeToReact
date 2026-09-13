/**
 * P1-c-4：主进程回程扇出迁入 React（端口逐字搬 `shims.js` 的 `desktopApi.onIpc` 块）。
 *
 * 职责：main → renderer 的回程事件统一「并 cache（部分）→ 过总线」，React 监听与 shims 的
 * mockEmit 同一总线实体。安装后置 `window.__eagleReturnBridgeInstalled`，shims 的同块注册
 * （0ms 延迟）检测该标记后跳过，保证单注册（无双发）。
 *
 * 时序论证（为何无丢失窗口）：shims 为解析期同步脚本，其 0ms timer 属宏任务；deferred module
 * （React 入口）在 DCL 链内先执行 → React 先注册。preload 队列的主进程事件在 DCL 完成后才可
 * 派发。`preview.onInit` 保留缓冲轮询兜底（原语义）。
 */
import { getIpcBus } from './channelBridge';
import { getIpcWriteState } from './ipcWriteState';
import { getWindowScope } from './scopeFace';

function emit(channel: string, payload?: any): void {
  const bus = getIpcBus();
  if (bus && typeof bus.emit === 'function') bus.emit(channel, payload);
}

/** 安装主进程回程桥（每窗至多一次；无 desktopApi/onIpc 的浏览器态为 no-op）。 */
export function installReturnBridge(): void {
  const w = window as any;
  const d = w.eagleDesktop;
  if (!d || typeof d.onIpc !== 'function') return;
  if (w.__eagleReturnBridgeInstalled) return;
  w.__eagleReturnBridgeInstalled = true;

  // show-item-in-folder（导出后定位；带 __lastExportJobId 语义）
  d.onIpc('show-item-in-folder', (value: any) => {
    if (d.export && d.export.reveal && w.__lastExportJobId) {
      Promise.resolve(d.export.reveal(w.__lastExportJobId))
        .catch(() => {});
    }
    void value;
  });

  // close-export-task（angular 面板复位在 React 世界恒缺席——window.angular 不存在，
  // 保留总线事件扇出即可）
  d.onIpc('close-export-task', (value: any) => {
    emit('close-export-task', value);
  });

  const passthrough = [
    'show-export-task',
    'finish-export-task',
    'show-archive-task',
    'add-archive-task',
    'update-archive-percent',
    'finish-archive-task',
    'abort-archive-task',
    // b1-9as：main 回发 → 总线（itemDomain 两参监听签名兼容：shim emit 前置 {} 事件参）
    'update-txt-item',
    // b1-9ar：empty-trash 逐项删除进度回程
    'remove-trash-item',
    // b1-9at：native-viewer 优雅降级回程
    'native-preview-failed',
  ];
  for (const channel of passthrough) {
    d.onIpc(channel, (value: any) => emit(channel, value));
  }

  // 实机 QA（2026-09-13）：main 逐文件导入回程 → file-uploaded 先并 cache 再过总线
  d.onIpc('file-uploaded', (item: any) => {
    if (item && item.id) getIpcWriteState().mergeCachedItems(item);
    emit('file-uploaded', item);
  });

  d.onIpc('thumbnail-generated', (value: any) => emit('thumbnail-generated', value));
  d.onIpc('rebind-refresh', (value: any) => emit('rebind-refresh', value));

  if (d.export) {
    if (typeof d.export.onProgress === 'function') {
      d.export.onProgress((progress: any) => {
        if (progress && progress.jobId) w.__lastExportJobId = progress.jobId;
      });
    }
    if (typeof d.export.onComplete === 'function') {
      d.export.onComplete((result: any) => {
        if (result && result.jobId) w.__lastExportJobId = result.jobId;
      });
    }
  }

  if (d.import) {
    if (typeof d.import.onFileProgress === 'function') {
      d.import.onFileProgress((job: any) => emit('import-file-progress', job));
    }
    if (typeof d.import.onFolderProgress === 'function') {
      d.import.onFolderProgress((job: any) => emit('import-folder-progress', job));
    }
  }

  if (d.library) {
    if (typeof d.library.onChanged === 'function') {
      d.library.onChanged((library: any) => emit('library:changed', library));
    }
    if (typeof d.library.onOperationResult === 'function') {
      d.library.onOperationResult((result: any) => emit('library:operation-result', result));
    }
  }

  if (d.item && typeof d.item.onOperationResult === 'function') {
    d.item.onOperationResult((result: any) => emit('item:operation-result', result));
  }

  // b1-9aa：后台窗通道族完成通知——rebind-refresh 刷新面（miscDomain:522 监听 + 主动刷新）
  if (typeof d.onRebindRefresh === 'function') {
    d.onRebindRefresh(() => {
      const scope = getWindowScope();
      const M = w.__eagleMachinery;
      if (scope && M && typeof M.rebindRefresh === 'function') {
        try {
          // E5-2：machineryRebindRefresh 已去 scope 化（E4，签名 (muteMode, cache, startCursor)）
          M.rebindRefresh();
          if (typeof scope.scrollToSelectedItem === 'function') scope.scrollToSelectedItem();
        } catch (err) {
          // 重载失败不阻塞通知链
        }
      }
    });
  }

  if (d.preview && typeof d.preview.onInit === 'function') {
    // 阶段9a：init 桥缓冲——React 入口冷启动 vite transform 可能慢于本桥（8e-2 同款竞态）。
    d.preview.onInit((payload: any) => {
      w.__eaglePendingPreviewInit = payload;
      if (w.__eaglePreviewEntryReady) {
        emit('init', payload);
        return;
      }
      const retry = setInterval(() => {
        if (!w.__eaglePreviewEntryReady) return;
        clearInterval(retry);
        emit('init', payload);
      }, 25);
      setTimeout(() => clearInterval(retry), 10000);
    });
  }
}
