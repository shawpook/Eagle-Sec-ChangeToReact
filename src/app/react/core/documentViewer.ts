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
 *  - F-DOC-1：入口由**唯一钩子函数** `maybeOpenDocumentViewer()` 承担，由
 *    `miscDomain.machineryEnterDetailMode` 在任何分流之前同步调用——UI/检查器/驱动面三条
 *    入口从此对齐。
 *
 * F-DOC-1 背景（原设计缺陷）：迁入时曾仅保留 scope.enterDetailMode 包装，注释断言「UI 面
 * 点击文档仍走各自 viewer 路由」。但 React 侧所有入口（selectionService / inspectorActions /
 * detailService / miscDomain）都直接 import 调用 `machineryEnterDetailMode`，与
 * `scope.enterDetailMode` 非同一函数对象 —— 包装从未生效；而所承诺的「React 侧 viewer 路由」
 * 在 DetailViewer 分支链中并不存在（无 document 分支），导致 md/json/csv 等点开完全空白、
 * office 类只剩缩略图占位。现改为与 P2 交付门控同构的直挂方式（见 detailDeliveryGate.ts）。
 */
import { getWindowScope } from './scopeFace';
import {
  emptyDocumentViewerHeader,
  writeDocumentViewerClosed,
  writeDocumentViewerHeader,
  writeDocumentViewerOpened,
  type DocumentViewerCommand,
} from '../store/documentViewerState';

const documentViewerExtensions = new Set([
  'txt', 'md', 'markdown', 'log', 'rst', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv',
  'docx', 'xlsx', 'pptx',
  'pdf',
  'doc', 'docm', 'dot', 'dotm', 'dotx', 'dps', 'et', 'epub', 'odp', 'ods', 'odt',
  'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'rtf', 'wps',
  'xls', 'xlsb', 'xlsm', 'xlt', 'xltm', 'xltx',
]);

/**
 * F-DOC-1：兜底重入抑制。查看器握手失败回落到原详情流时置位，避免 `machineryEnterDetailMode`
 * 内再次命中文档分支 → 又开查看器 → 又握手失败，形成无限循环。
 */
let inDocumentFallback = false;

/**
 * F-DOC-2：header 状态累加器。stage 层（标题/序号/上下篇）与 surface 层（字体/配色/
 * 编辑模式）分批上报，各自只带自己那几个字段；此处合并成完整快照后再交给 store，
 * 避免任一层的上报把另一层的字段冲成默认值。
 */
let viewerHeaderAccumulator: Record<string, any> | null = null;
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
  return `${origin}/src/app/react/viewers/document/index.html`;
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

/**
 * F-DOC-2：把原框架顶栏的用户操作下发到查看器 iframe。
 * 查看器在 `DocumentViewerApp` 侧监听 `source === 'eagle-document-host'` 的 command 消息。
 */
export function sendDocumentViewerCommand(command: DocumentViewerCommand): void {
  const frame = documentViewerState.iframe as HTMLIFrameElement | null;
  if (!frame || !frame.contentWindow) return;
  try {
    frame.contentWindow.postMessage(
      { source: 'eagle-document-host', type: 'command', command },
      '*'
    );
  } catch (err) {
    console.warn('[documentViewer] command postMessage failed', err);
  }
}

/**
 * F-DOC-1：文档类条目入口钩子（唯一）。由 `machineryEnterDetailMode` 在**任何分流之前**同步调用。
 *
 * 判据与 shims 原包装体逐字一致：目标可解析 && 总开关开 && ext 命中白名单。
 * 返回 true 表示已接管（调用方须立即 return，不得再走图片详情流程）。
 */
export function maybeOpenDocumentViewer(item: any): boolean {
  if (inDocumentFallback) return false;
  if (!item || !item.id || !documentViewerEnabled()) return false;
  const extension = String(item.ext || '').toLowerCase();
  if (!documentViewerExtensions.has(extension)) return false;
  // 已在查看器内：不重开（避免同一文档重复挂载 iframe）。
  if (documentViewerState.itemId && documentViewerState.itemId === item.id) return true;
  return openDocumentViewer(item, 'workspace');
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
  viewerHeaderAccumulator = null;
  writeDocumentViewerOpened();
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
    if (!item) return;
    // F-DOC-1：原先回落到 `scope.enterDetailMode`（被包装前的原函数），但 React 侧入口并不经
    // scope 面，该引用在直挂改造后恒为 null → 兜底静默失效。改为直接调用同一挂载函数，
    // 并用 inFallback 抑制再次进入文档分支（否则握手失败会无限重开查看器）。
    const machinery: any = (window as any).__eagleMachinery;
    const enterDetailMode = machinery && machinery.enterDetailMode;
    if (typeof enterDetailMode !== 'function') return;
    inDocumentFallback = true;
    try {
      enterDetailMode(null, item);
    } finally {
      inDocumentFallback = false;
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
  viewerHeaderAccumulator = null;
  writeDocumentViewerClosed();
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
  // F-DOC-2：查看器 header 状态上报 —— 原生 Toolbar 据此改渲染文档控件组。
  if (message.type === 'state') {
    const payload = message.state;
    if (!payload || typeof payload !== 'object') return;
    // stage 层与 surface 层分别上报，按字段合并（空值沿用已有值）。
    const merged: any = { ...emptyDocumentViewerHeader, ...(viewerHeaderAccumulator || {}), ...payload };
    for (const key of Object.keys(payload)) {
      const value = (payload as any)[key];
      if (value === '' || value === undefined || value === null) {
        if (viewerHeaderAccumulator && viewerHeaderAccumulator[key] !== undefined) {
          merged[key] = viewerHeaderAccumulator[key];
        }
      }
    }
    viewerHeaderAccumulator = merged;
    writeDocumentViewerHeader(merged);
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

/** 安装文档工作区编排（主窗调用一次；幂等）。入口钩子见 `maybeOpenDocumentViewer`。 */
export function installDocumentViewer(): void {
  if (installed) return;
  installed = true;

  // shims 的 ipcRenderer.emit 覆写（library:changed/preload-library/app-status-library-loaded）
  // 经此全局桥卸载 viewer——接缝两态（React 已装/未装）行为一致。
  (window as any).__eagleCloseDocumentViewer = closeDocumentViewer;

  window.addEventListener('message', handleDocumentViewerMessage as any);
  // Close the viewer when the shell reloads.
  window.addEventListener('beforeunload', () => closeDocumentViewer());

  // ── 文档工作区入口 ──
  // F-DOC-1：不再包装 `scope.enterDetailMode`（React 侧入口直调 machineryEnterDetailMode，
  // 与 scope 面非同一函数对象，包装恒不生效）；改由 miscDomain.machineryEnterDetailMode
  // 在任何分流之前同步调用 `maybeOpenDocumentViewer`，与 P2 交付门控同构。
  // `scope.leaveDetailMode` 仍包装：退出详情需顺带关闭工作区容器。
  const hookTimer = setInterval(() => {
    const scope: any = getWindowScope();
    if (!scope || typeof scope.leaveDetailMode !== 'function' || scope.leaveDetailMode.__eagleDocumentEntry) {
      if (scope && scope.leaveDetailMode && scope.leaveDetailMode.__eagleDocumentEntry) clearInterval(hookTimer);
      return;
    }
    const leaveDetailMode = scope.leaveDetailMode;
    scope.leaveDetailMode = function () {
      closeDocumentViewer();
      return leaveDetailMode.apply(this, arguments as any);
    };
    scope.leaveDetailMode.__eagleDocumentEntry = true;
    clearInterval(hookTimer);
  }, 25);
}
