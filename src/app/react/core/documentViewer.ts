/**
 * P4（b1-9bz-E8）：Unified in-app document viewer（OrcaBox workspace）编排自 shims 迁入 React。
 *
 * 语义逐字对齐 shims 原块（`frontend/public/shims.js` 的 documentViewer 段，约 354 行）：
 *  - `bodyScope()` → `getWindowScope()`（scopeFace 与 driver 面同字段契约：enterDetailMode/
 *    leaveDetailMode/raw/selected/inspector）；
 *  - `documentViewerExtensions` 白名单逐字（.pages/.xla/.xlam 有意缺席——后端无法转换，
 *    路由进 viewer 只会劣化预览）；
 *  - 侧栏/检查器测量、MutationObserver/ResizeObserver/轮询兜底、fallback 回原详情流、
 *    postMessage 握手（source === 'eagle-document-viewer'）全部保持不变；
 *  - 仅保留**驱动面**挂钩（scope.enterDetailMode 包装：文档扩展名 → 开工作区）。UI 面点击
 *    文档仍走各自 viewer 路由，与迁移前一致（见 shims 原注释与 P2 门控迁移记录）。
 */
import { getWindowScope } from './scopeFace';

const documentViewerExtensions = new Set([
  'txt', 'md', 'markdown', 'log', 'rst', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv',
  'docx', 'xlsx', 'pptx',
  'pdf',
  'doc', 'docm', 'dot', 'dotm', 'dotx', 'dps', 'et', 'epub', 'odp', 'ods', 'odt',
  'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'rtf', 'wps',
  'xls', 'xlsb', 'xlsm', 'xlt', 'xltm', 'xltx',
]);

let originalDetailModeEntry: any = null;
const documentViewerState: any = {
  itemId: '',
  mode: 'workspace',
  container: null as any,
  iframe: null as any,
  pendingFallbackTimer: 0,
  sidebarObserver: null as any,
  sidebarResizeObserver: null as any,
  sidebarPollTimer: 0,
  windowResizeHandler: null as any,
  windowResizeBound: false,
};

function documentViewerEnabled(): boolean {
  return (window as any).__EAGLE_ORCABOX_DOCUMENT_VIEWER_ENABLED !== false;
}

function collectVisibleAssetIds(): string[] {
  const boxes = document.querySelectorAll('#box-container .box');
  const ids: string[] = [];
  boxes.forEach((box) => {
    const id = box && box.getAttribute('data-box-id');
    if (id) ids.push(id);
  });
  if (ids.length > 0) return ids;
  const scope: any = getWindowScope();
  const items = (scope && Array.isArray(scope.raw))
    ? scope.raw
    : (Array.isArray((window as any).__mockLibraryCache) ? (window as any).__mockLibraryCache : []);
  return items.filter((item: any) => item && item.id && !item.isDeleted).map((item: any) => item.id);
}

function viewerBaseUrl(): string {
  const origin = window.location.origin;
  return `${origin}/frontend/document-viewer/index.html`;
}

// Measure Eagle's own top toolbar so the viewer container leaves exactly the
// right amount of room at the top: too little would cover its draggable
// strip (window can't be dragged), too much wastes space.
function topToolbarHeight(): number {
  try {
    const toolbar = document.querySelector('#list-content-panel .toolbar')
      || document.querySelector('.content-panel .toolbar');
    if (toolbar) {
      const rect = toolbar.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom > 0) return rect.bottom;
    }
  } catch (err) {
    // Fall through to the default.
  }
  return 48;
}

// When the sidebar is auto-collapsed Eagle shows a hover strip on the left
// edge (`.hover-show-sidebar`) to reopen it. That strip sits over the top
// toolbar's left drag area, so while the document workspace is open we keep
// it from intercepting pointer events (the left/right rail buttons still
// control the sidebar).
function suppressSidebarHoverStrip(): void {
  try {
    const strip = document.querySelector('.hover-show-sidebar');
    if (strip) (strip as HTMLElement).style.pointerEvents = 'none';
  } catch (err) {
    // Ignore.
  }
}

// The viewer leaves room for Eagle's own top toolbar at the top so its
// buttons stay clickable and the window can still be dragged; the exit (×)
// action lives inside the viewer's editor toolbar (preview → ×).
function sidebarVisibilityState(): { hidden: boolean; width: number } {
  const sidebar = document.querySelector('#sidebar') as HTMLElement | null;
  if (!sidebar) return { hidden: true, width: 0 };
  let hidden = document.body.classList.contains('hide-sidebar');
  let width = sidebar.offsetWidth || 0;
  try {
    const rect = sidebar.getBoundingClientRect();
    if (rect.width > 0) hidden = rect.right <= 0;
  } catch (err) {
    // Keep the class-based value.
  }
  return { hidden, width };
}

// The right rail (inspector) width lives on the Angular scope; when the
// component is actually rendered we prefer its measured width.
function inspectorVisibilityState(): { hidden: boolean; width: number } {
  try {
    const scope: any = getWindowScope();
    const inspector = scope && scope.inspector;
    let width = (inspector && Number(inspector.width)) || 0;
    let hidden = Boolean(inspector && inspector.isHideInspector);
    const element = document.querySelector('inspector');
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0) {
        width = rect.width;
        hidden = false;
      }
    }
    return { hidden, width: hidden ? 0 : width };
  } catch (err) {
    return { hidden: true, width: 0 };
  }
}

function viewerInsetsState(): string {
  return JSON.stringify({
    sidebar: sidebarVisibilityState(),
    inspector: inspectorVisibilityState(),
  });
}

function installSidebarWatchers(): void {
  if (typeof MutationObserver === 'function' && !documentViewerState.sidebarObserver) {
    const observer = new MutationObserver(() => {
      if (!documentViewerState.container) return;
      applyViewerMode(documentViewerState.mode);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    documentViewerState.sidebarObserver = observer;
  }
  if (typeof ResizeObserver === 'function' && !documentViewerState.sidebarResizeObserver) {
    const sidebar = document.querySelector('#sidebar');
    if (sidebar) {
      const resizeObserver = new ResizeObserver(() => {
        if (!documentViewerState.container) return;
        applyViewerMode(documentViewerState.mode);
      });
      resizeObserver.observe(sidebar);
      documentViewerState.sidebarResizeObserver = resizeObserver;
    }
  }
  if (!documentViewerState.windowResizeBound) {
    const handler = () => {
      if (!documentViewerState.container) return;
      applyViewerMode(documentViewerState.mode);
    };
    window.addEventListener('resize', handler);
    documentViewerState.windowResizeBound = true;
    documentViewerState.windowResizeHandler = handler;
  }
  // Poll as a fallback: the left/right rail visibility can change via
  // transform without a body-class mutation or an offsetWidth change, which
  // would otherwise leave the viewer container stuck at the wrong offset.
  if (!documentViewerState.sidebarPollTimer) {
    let last = viewerInsetsState();
    documentViewerState.sidebarPollTimer = window.setInterval(() => {
      if (!documentViewerState.container) return;
      suppressSidebarHoverStrip();
      const current = viewerInsetsState();
      if (current !== last) {
        last = current;
        applyViewerMode(documentViewerState.mode);
      }
    }, 250);
  }
}

function ensureViewerContainer(): any {
  if (documentViewerState.container && documentViewerState.iframe) {
    return documentViewerState;
  }
  const container = document.createElement('div');
  container.id = 'eagle-document-viewer-container';
  container.style.cssText = `position:fixed; top:${topToolbarHeight()}px; bottom:0; left:0; right:0; z-index:2147483000;`;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals');
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  iframe.style.cssText = 'width:100%; height:100%; border:0; background:#17181b;';
  container.appendChild(iframe);
  document.body.appendChild(container);
  documentViewerState.container = container;
  documentViewerState.iframe = iframe;
  installSidebarWatchers();
  return documentViewerState;
}

function applyViewerMode(mode: string): void {
  const state = documentViewerState;
  const container = state.container;
  if (!container) return;
  state.mode = mode === 'fullscreen' ? 'fullscreen' : 'workspace';
  container.setAttribute('data-viewer-mode', state.mode);
  if (state.mode === 'fullscreen') {
    container.style.cssText = 'position:fixed; inset:0; z-index:2147483000;';
  } else {
    // Keep Eagle's top toolbar visible so its buttons stay clickable and
    // the window can still be dragged; let both rails breathe too.
    const { hidden: sidebarHidden, width: sidebarWidth } = sidebarVisibilityState();
    const { hidden: inspectorHidden, width: inspectorWidth } = inspectorVisibilityState();
    const left = sidebarHidden ? 0 : sidebarWidth;
    const right = inspectorHidden ? 0 : inspectorWidth;
    container.style.cssText = `position:fixed; top:${topToolbarHeight()}px; bottom:0; left:${left}px; right:${right}px; z-index:2147483000;`;
  }
}

// Entering the document workspace auto-collapses the left rail so the
// viewer fills the window; Eagle's own left/right rail buttons can still
// reopen it and the viewer container reflows accordingly.
function autoCollapseSidebar(): void {
  try {
    if (document.body.classList.contains('hide-sidebar')) return;
    const scope: any = getWindowScope();
    const M = (window as any).__eagleMachinery;
    if (scope && M && typeof M.toggleAll === 'function') {
      // E5-2：machineryToggleAll 已去 scope 化（E4-2，签名 ($event)）——原以 scope 当 $event 传入
      // 会触发 `$event.preventDefault is not a function`（document-viewer 自动收侧栏失效）。
      M.toggleAll();
    }
  } catch (err) {
    console.warn('[documentViewer] auto-collapse sidebar failed', err);
  }
}

function openDocumentViewer(item: any, mode: string): boolean {
  if (!item || !item.id || !documentViewerEnabled()) return false;
  autoCollapseSidebar();
  suppressSidebarHoverStrip();
  const state = ensureViewerContainer();
  const ids = collectVisibleAssetIds();
  const query = new URLSearchParams({
    id: item.id,
    mode: mode === 'fullscreen' ? 'fullscreen' : 'workspace',
    ids: ids.join(','),
    chrome: 'external',
  });
  const eagleTheme = document.body.getAttribute('theme') || 'dark';
  query.set('theme', eagleTheme);
  state.itemId = item.id;
  state.iframe.src = `${viewerBaseUrl()}?${query.toString()}`;
  applyViewerMode(mode);
  // If the viewer page never handshakes, fall back to the original detail flow.
  window.clearTimeout(state.pendingFallbackTimer);
  state.pendingFallbackTimer = window.setTimeout(() => {
    if (documentViewerState.itemId !== item.id) return;
    if (documentViewerState.container && documentViewerState.container.hasAttribute('data-viewer-ready')) return;
    closeDocumentViewer();
    fallbackToOriginalDetail(item.id);
  }, 4000);
  return true;
}

function fallbackToOriginalDetail(itemId: string): void {
  try {
    const scope: any = getWindowScope();
    const item = (scope && Array.isArray(scope.raw))
      ? scope.raw.find((entry: any) => entry && entry.id === itemId)
      : null;
    if (item && typeof originalDetailModeEntry === 'function') {
      originalDetailModeEntry.call(scope, null, item);
    }
  } catch (err) {
    console.warn('[documentViewer] fallback failed', err);
  }
}

function closeDocumentViewer(): void {
  window.clearTimeout(documentViewerState.pendingFallbackTimer);
  if (documentViewerState.sidebarPollTimer) {
    window.clearInterval(documentViewerState.sidebarPollTimer);
    documentViewerState.sidebarPollTimer = 0;
  }
  if (documentViewerState.sidebarObserver) {
    documentViewerState.sidebarObserver.disconnect();
    documentViewerState.sidebarObserver = null;
  }
  if (documentViewerState.sidebarResizeObserver) {
    documentViewerState.sidebarResizeObserver.disconnect();
    documentViewerState.sidebarResizeObserver = null;
  }
  if (documentViewerState.windowResizeHandler) {
    window.removeEventListener('resize', documentViewerState.windowResizeHandler);
    documentViewerState.windowResizeHandler = null;
    documentViewerState.windowResizeBound = false;
  }
  if (documentViewerState.iframe) {
    documentViewerState.iframe.src = 'about:blank';
  }
  if (documentViewerState.container) {
    documentViewerState.container.remove();
  }
  documentViewerState.container = null;
  documentViewerState.iframe = null;
  documentViewerState.itemId = '';
  documentViewerState.mode = 'workspace';
}

function handleDocumentViewerMessage(event: MessageEvent): void {
  const message = event && event.data;
  if (!message || message.source !== 'eagle-document-viewer') return;
  const state = documentViewerState;
  if (message.type === 'ready') {
    window.clearTimeout(state.pendingFallbackTimer);
    if (state.container) state.container.setAttribute('data-viewer-ready', '1');
    return;
  }
  if (message.type === 'mode') {
    applyViewerMode(message.mode);
    return;
  }
  if (message.type === 'close') {
    closeDocumentViewer();
    // Restore any non-detail grid state left behind by the original app.
    try {
      const scope: any = getWindowScope();
      if (scope && typeof scope.leaveDetailMode === 'function' && scope.isDetailMode) {
        scope.leaveDetailMode();
      }
    } catch (err) {
      console.warn('[documentViewer] close scope restore failed', err);
    }
  }
}

let installed = false;

/** 安装文档工作区编排（主窗调用一次；幂等）。含驱动面 enterDetailMode/leaveDetailMode 挂钩。 */
export function installDocumentViewer(): void {
  if (installed) return;
  installed = true;

  // shims 的 ipcRenderer.emit 覆写（library:changed/preload-library/app-status-library-loaded）
  // 经此全局桥卸载 viewer——接缝两态（React 已装/未装）行为一致。
  (window as any).__eagleCloseDocumentViewer = closeDocumentViewer;

  window.addEventListener('message', handleDocumentViewerMessage as any);
  // Close the viewer when the shell reloads.
  window.addEventListener('beforeunload', () => closeDocumentViewer());

  // ── 文档工作区入口（仅驱动面）──
  // P2：位图原图交付门控在 core/detailDeliveryGate.ts（React 直接挂钩，UI 路径生效）。
  // 此处保留原包装体的「文档扩展名 → 开 document workspace」分支——只对**驱动面**有意义。
  const hookTimer = setInterval(() => {
    const scope: any = getWindowScope();
    if (!scope || typeof scope.enterDetailMode !== 'function' || scope.enterDetailMode.__eagleDocumentEntry) return;
    const enterDetailMode = scope.enterDetailMode;
    originalDetailModeEntry = enterDetailMode;
    scope.enterDetailMode = function (this: any, event: any, item: any) {
      const target = item || (Array.isArray(this.selected) ? this.selected[this.selected.length - 1] : null);
      const extension = String((target && target.ext) || '').toLowerCase();
      if (target && documentViewerEnabled() && documentViewerExtensions.has(extension)) {
        // Unified in-app document workspace: open the isolated viewer overlay
        // instead of the original detail flow or the system default app.
        openDocumentViewer(target, 'workspace');
        return;
      }
      return enterDetailMode.apply(this, arguments as any);
    };
    scope.enterDetailMode.__eagleDocumentEntry = true;
    if (typeof scope.leaveDetailMode === 'function' && !scope.leaveDetailMode.__eagleDocumentEntry) {
      const leaveDetailMode = scope.leaveDetailMode;
      scope.leaveDetailMode = function () {
        closeDocumentViewer();
        return leaveDetailMode.apply(this, arguments as any);
      };
      scope.leaveDetailMode.__eagleDocumentEntry = true;
    }
    clearInterval(hookTimer);
  }, 25);
}
