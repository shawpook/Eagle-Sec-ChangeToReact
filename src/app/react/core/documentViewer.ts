/**
 * P4（b1-9bz-E8）：Unified in-app document viewer（OrcaBox workspace）编排自 shims 迁入 React。
 *
 * 语义逐字对齐 shims 原块（`frontend/public/shims.js` 的 documentViewer 段，约 354 行）：
 *  - `bodyScope()` → `getWindowScope()`（scopeFace 与 driver 面同字段契约：enterDetailMode/
 *    leaveDetailMode/raw/selected/inspector）；
 *  - `documentViewerExtensions` 白名单逐字（.pages/.xla/.xlam 有意缺席——后端无法转换，
 *    路由进 viewer 只会劣化预览）；
 *  - 侧栏/检查器测量、MutationObserver/ResizeObserver/轮询兜底、postMessage 握手
 *    （source === 'eagle-document-viewer'）全部保持不变；
 *  - F-DOC-1：入口由 `machineryEnterDetailMode` 同步调用（UI/检查器/驱动面三条入口对齐）。
 *
 * F-DOC-1 背景（原设计缺陷）：迁入时曾仅保留 scope.enterDetailMode 包装，注释断言「UI 面
 * 点击文档仍走各自 viewer 路由」。但 React 侧所有入口（selectionService / inspectorActions /
 * detailService / miscDomain）都直接 import 调用 `machineryEnterDetailMode`，与
 * `scope.enterDetailMode` 非同一函数对象 —— 包装从未生效；而所承诺的「React 侧 viewer 路由」
 * 在 DetailViewer 分支链中并不存在（无 document 分支），导致 md/json/csv 等点开完全空白、
 * office 类只剩缩略图占位。现改为与 P2 交付门控同构的直挂方式（见 detailDeliveryGate.ts）。
 *
 * F-DOC-4（2026-09-19）：从「详情模式之外的平行模式」并入详情模式框架 —— 查看器成为
 * **文档类条目的详情渲染分支**，原生详情机制（选区/current/上下篇/检查器/计数器）是唯一权威：
 *  - `machineryEnterDetailMode` 对文档类条目不再 early-return，而是挂上 overlay 后继续走
 *    原生详情初始化（isDetailMode 置位、selection/current/检查器同步）——查看器只是盖在
 *    原生详情之上的文档渲染层；
 *  - `machinerySelectNext/Prev` 更新 current 后调用 `syncDocumentViewerWithDetailItem`：
 *    目标仍是文档 → 原地切页（navigate 指令）；目标不是文档 → 关闭 overlay，原生详情
 *    （图片/视频/音频…分支）自然露出 —— 这正是「下一个素材是图片就直接换图片详情」的闭环；
 *  - 反向同样成立：原生详情里左右切到文档类条目时，sync 层自动挂上 overlay；
 *  - iframe 侧在 external chrome 模式下不再自行导航（键盘/内部列表已废弃），左右键
 *    postMessage `navRequest` 上交宿主，由原生 machinery 推进 —— 两侧行为永远一致；
 *  - 顶栏（DocumentToolbarBranch）的计数器/上下篇禁用态改由宿主 detail 快照计算，
 *    与 DetailToolbar 同源（iframe 上报的 header 只保留表面状态：字体/配色/编辑/收藏）。
 */
import { getWindowScope } from './scopeFace';
import { useBodyState } from '../store/bodyState';
import { cssSet } from '../utils/domQuery';
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
  // F-DOC-4：优先读 store（bodyState.isHideSidebar），body class 仅作回落——class 由
  // BodyBindings 的 React effect 落盘，存在滞后/丢失窗口；overlay 的重排（250ms 轮询）
  // 必须跟随唯一权威（store），否则侧栏开关后 overlay 不回流。
  let hidden = false;
  try {
    hidden = !!useBodyState.getState().isHideSidebar;
  } catch (err) {
    hidden = document.body.classList.contains('hide-sidebar');
  }
  if (!sidebar) return { hidden: true, width: 0 };
  let width = sidebar.offsetWidth || 0;
  try {
    const rect = sidebar.getBoundingClientRect();
    if (rect.width > 0) hidden = rect.right <= 0;
  } catch (err) {
    // Keep the store/class-based value.
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
 * F-DOC-4：文档类条目判据（详情分支归属）。
 * 目标可解析 && 总开关开 && ext 命中白名单。machineryEnterDetailMode / sync 层 /
 * DetailViewer 分支链共用这一个判据，保证「谁能渲染这个条目」全仓只有一个答案。
 */
export function isDocumentViewerItem(item: any): boolean {
  if (!item || !item.id || !documentViewerEnabled()) return false;
  const extension = String(item.ext || '').toLowerCase();
  return documentViewerExtensions.has(extension);
}

/**
 * F-DOC-4：详情模式入口挂载（由 `machineryEnterDetailMode` 调用）。
 *
 * 与 F-DOC-1 时代的 early-return 门不同：这里**不再截断**原生详情流 —— 文档类条目照常走
 * machineryEnterDetailMode 的选区/current/isDetailMode 初始化，查看器 overlay 只是随后
 * 盖上来的文档渲染分支。这样：
 *  - 检查器/计数器/选区高亮由原生机制持有（修掉「查看器内切篇后检查器停在上一个素材」）；
 *  - 上下篇可以直接复用 machinerySelectNext/Prev（与图像详情同一条代码路径）；
 *  - 握手失败回落时原生详情已在底下，无需再模拟一次进入。
 */
export function openDocumentViewerForDetailItem(item: any): void {
  if (!isDocumentViewerItem(item)) return;
  // 已在查看器内且就是同一篇：不重开（避免同一文档重复挂载 iframe）。
  if (documentViewerState.itemId && documentViewerState.itemId === item.id && documentViewerState.container) return;
  openDocumentViewer(item, 'workspace');
}

/**
 * F-DOC-4：详情 current 与查看器 overlay 的同步层（唯一权威在原生 selection machinery）。
 *
 * 由 `machinerySelectNext/Prev` 在更新 current 后调用（isDetailMode 下）；enterDetailMode
 * 的入口挂载走 `openDocumentViewerForDetailItem`。语义：
 *  - current 是文档 → overlay 已开且同篇：no-op；已开异篇：原地切页（navigate 指令，不重建
 *    iframe，顶栏控件组不闪）；未开：挂 overlay（原生详情 → 文档分支的切换）。
 *  - current 不是文档 → overlay 开着就关掉，原生详情分支（图片/视频/音频…）自然露出。
 */
export function syncDocumentViewerWithDetailItem(item: any): void {
  if (!useBodyState.getState().isDetailMode) return;
  if (isDocumentViewerItem(item)) {
    if (documentViewerState.container && documentViewerState.itemId === item.id) return;
    if (documentViewerState.container) {
      switchDocumentViewerAsset(item);
    } else {
      openDocumentViewer(item, 'workspace');
    }
    return;
  }
  if (documentViewerState.container) {
    closeDocumentViewer();
    // F-DOC-4 防御：首个详情条目是文档时，zoom 引擎的图片绑定不会触发 on_IMAGE_LOAD，
    // `#detail-container` 可能停在 enterDetailMode 置的 opacity:0（overlay 期间不可见，
    // 此刻关掉 overlay 就露馅了）。原生机制在图片载入后同样会置 1，这里只是提前补齐，
    // 保证「文档 → 视频/字体等非位图条目」首跳也能看见原生详情。
    cssSet('#detail-container', { opacity: 1 });
  }
}

/** F-DOC-4：查看器开着时把 iframe 原地切到另一篇文档（不重建容器、不重握手）。 */
function switchDocumentViewerAsset(item: any): void {
  const state = documentViewerState;
  if (!state.iframe || !state.container) return;
  state.itemId = item.id;
  viewerHeaderAccumulator = null;
  applyViewerMode(state.mode);
  sendDocumentViewerCommand({ type: 'navigate', value: item.id });
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
    // F-DOC-4：详情模式已由 machineryEnterDetailMode 正常激活（overlay 只是文档分支），
    // 握手失败时关掉 overlay 即可露出原生详情，不再需要模拟一次 enterDetailMode。
    closeDocumentViewer();
  }, 4000);
  return true;
}

/**
 * F-DOC-4：卸载查看器 overlay。由 machineryLeaveDetailMode（退出详情）、sync 层（切到
 * 非文档条目）、iframe close 消息、握手超时兜底与 shims 卸载桥（__eagleCloseDocumentViewer）
 * 共用；幂等。
 */
export function closeDocumentViewer(): void {
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
  // F-DOC-4：external chrome 模式下 iframe 不再自行导航（它那份 URL 烘干的列表已废弃），
  // 键盘 ←/→ 上交宿主，由原生 machinerySelectPrev/Next 推进——与顶栏按钮同一条路径。
  // 经 window.__eagleMachinery 解析（machineryInfra 挂载面），避免 core 模块间静态环。
  if (message.type === 'navRequest') {
    const machinery: any = (window as any).__eagleMachinery;
    const direction = message.direction === 'prev' ? 'selectPrev' : 'selectNext';
    if (machinery && typeof machinery[direction] === 'function') machinery[direction]();
    return;
  }
  if (message.type === 'close') {
    closeDocumentViewer();
    // Restore any non-detail grid state left behind by the original app.
    // F-DOC-4：查看器只存在于详情模式内，close 意味着退出详情回网格
    // （machineryLeaveDetailMode 自身也会关查看器，这里先关一次只为立刻卸 iframe）。
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

/** 安装文档工作区编排（主窗调用一次；幂等）。入口与同步见 F-DOC-4 注释块。 */
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
  // F-DOC-4：入口与同步全部收口到原生详情机制 —— machineryEnterDetailMode 调
  // openDocumentViewerForDetailItem（挂 overlay、详情流继续），machinerySelectNext/Prev 调
  // syncDocumentViewerWithDetailItem（current 变化驱动开/关/切页），machineryLeaveDetailMode
  // 直接 closeDocumentViewer。scope.leaveDetailMode 的包装轮询随之退役——三处 machinery
  // 函数是所有路径（UI/驱动面/scope 面）的共同落点。
}
