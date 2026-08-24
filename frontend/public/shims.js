(function () {
  'use strict';

  if (window.__eagleBrowserShimLoaded) return;
  window.__eagleBrowserShimLoaded = true;

  const nativeRequire = typeof window.require === 'function' ? window.require : null;
  const isElectronRuntime =
    typeof process !== 'undefined' && process.versions && typeof process.versions.electron === 'string';
  let nativeFs = null;
  let nativePath = null;
  if (isElectronRuntime && nativeRequire) {
    try {
      nativeFs = nativeRequire('node:fs');
      nativePath = nativeRequire('node:path');
    } catch (err) {
      console.warn('[eagle-shim] native filesystem bridge unavailable', err);
    }
  }
  const desktopApi = window.eagleDesktop || null;
  const detailBitmapExtensions = new Set([
    'avif', 'bmp', 'heic', 'heif', 'hif', 'insp', 'jfif', 'jpe', 'jpeg', 'jpg', 'jxl',
    'png', 'svg', 'tif', 'tiff', 'webp',
  ]);
  const textThumbnailExtensions = new Set([
    'txt', 'md', 'markdown', 'log', 'rst', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv',
  ]);
  // Unified document workspace activation set: text/structured text, Office
  // Open XML, direct PDF, and legacy/OpenDocument formats the backend can
  // either read structurally or convert to a derived PDF. `.key/.numbers/
  // .pages/.xla/.xlam` are intentionally absent — the backend cannot convert
  // them, so routing them into the viewer would only degrade their preview.
  const documentViewerExtensions = new Set([
    'txt', 'md', 'markdown', 'log', 'rst', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv',
    'docx', 'xlsx', 'pptx',
    'pdf',
    'doc', 'docm', 'dot', 'dotm', 'dotx', 'dps', 'et', 'epub', 'odp', 'ods', 'odt',
    'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'rtf', 'wps',
    'xls', 'xlsb', 'xlsm', 'xlt', 'xltm', 'xltx',
  ]);
  const resolutionMediaExtensions = new Set([
    'png', 'jpg', 'jpeg', 'jfif', 'jpe', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic',
    'heif', 'hif', 'avif', 'svg', 'psd', 'psdt', 'psb', 'ai', 'ait', 'raw', 'cr2',
    'cr3', 'crw', 'dng', 'raf', 'rw2', 'orf', 'nef', 'nrw', 'arw', '3fr', 'erf',
    'srw', 'sr2', 'pef', 'x3f', 'mrw', 'jxl', 'hdr', 'exr', 'ico', 'icns',
    'mp4', 'm4v', 'webm', 'mkv', 'avi', 'mov', 'mpg', 'mts', 'wmv', 'flv', 'ts',
    'f4v', '3gp', '360', 'afx', 'eva', 'vap',
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
    timeout: 0,
  };
  const detailPreparedTiles = new Map();
  window.__eagleDetailDeliveryState = detailRenderState;

  // 详情页先隐藏缩略图，等原图画布稳定后再显示，避免出现模糊到清晰的跳变。
  const detailStyle = document.createElement('style');
  detailStyle.textContent = 'body.eagle-detail-awaiting-original #detail-container { opacity: 0 !important; }';
  document.head.appendChild(detailStyle);

  // 对画布分区取样，连续多帧签名一致时才视为原图渲染稳定。
  function detailCanvasSignature() {
    const canvas = document.querySelector('#bitmap-viewer canvas');
    if (!canvas || canvas.width < 2 || canvas.height < 2) return '';
    try {
      const context = canvas.getContext('2d');
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

  function releaseDetailImage(itemId, mode) {
    const scope = window.$bodyScope;
    if (!scope || !scope.isDetailMode || !scope.current || scope.current.id !== itemId) return false;
    detailRenderState.mode = mode;
    detailRenderState.releasedAt = performance.now();
    document.body.classList.remove('eagle-detail-awaiting-original');
    return true;
  }

  function waitForDetailOriginal(itemId, tiles) {
    const deadline = performance.now() + 5000;
    const check = () => {
      const scope = window.$bodyScope;
      if (!scope || !scope.isDetailMode || !scope.current || scope.current.id !== itemId) {
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
      const image = document.querySelector('#detail-image');
      const rawUrl = typeof scope.getRawUrl === 'function' ? String(scope.getRawUrl(scope.current) || '') : '';
      const source = image ? String(image.currentSrc || image.src || '') : '';
      if (image && image.complete && image.naturalWidth > 1 && rawUrl && source === rawUrl) {
        requestAnimationFrame(() => requestAnimationFrame(() => releaseDetailImage(itemId, 'image')));
        return;
      }
      if (performance.now() < deadline) requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  // 记录原图瓦片完成状态，同时覆盖预加载后打开和同一图片重复打开的场景。
  if (typeof window.Worker === 'function' && !window.__eagleDetailWorkerProbeInstalled) {
    const NativeWorker = window.Worker;
    class DetailWorker extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.__eagleBitmapWorker = /(?:^|\/)bitmapWorker\.js(?:[?#]|$)/i.test(String(url || ''));
        this.__eagleBitmapItemId = '';
        if (this.__eagleBitmapWorker) {
          this.addEventListener('message', (event) => {
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

      postMessage(message, transfer) {
        if (this.__eagleBitmapWorker && message && message.item && message.item.id) {
          this.__eagleBitmapItemId = message.item.id;
        }
        if (arguments.length > 1) return super.postMessage(message, transfer);
        return super.postMessage(message);
      }
    }
    window.Worker = DetailWorker;
    window.__eagleDetailWorkerProbeInstalled = true;
  }

  const detailHookTimer = setInterval(() => {
    const scope = window.$bodyScope;
    if (!scope || typeof scope.enterDetailMode !== 'function' || scope.enterDetailMode.__eagleOriginalGate) return;
    const enterDetailMode = scope.enterDetailMode;
    originalDetailModeEntry = enterDetailMode;
    scope.enterDetailMode = function (event, item) {
      const target = item || (Array.isArray(this.selected) ? this.selected[this.selected.length - 1] : null);
      const extension = String(target && target.ext || '').toLowerCase();
      if (target && documentViewerEnabled() && documentViewerExtensions.has(extension)) {
        // Unified in-app document workspace: open the isolated viewer overlay
        // instead of the original detail flow or the system default app.
        openDocumentViewer(target, 'workspace');
        return;
      }
      if (target && detailBitmapExtensions.has(extension)) {
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
      return enterDetailMode.apply(this, arguments);
    };
    scope.enterDetailMode.__eagleOriginalGate = true;
    if (typeof scope.leaveDetailMode === 'function') {
      const leaveDetailMode = scope.leaveDetailMode;
      scope.leaveDetailMode = function () {
        closeDocumentViewer();
        document.body.classList.remove('eagle-detail-awaiting-original');
        return leaveDetailMode.apply(this, arguments);
      };
    }
    clearInterval(detailHookTimer);
  }, 25);

  // ── Unified in-app document viewer (OrcaBox workspace) ───────────────────
  let originalDetailModeEntry = null;
  const documentViewerState = {
    itemId: '',
    mode: 'workspace',
    container: null,
    iframe: null,
    pendingFallbackTimer: 0,
    sidebarObserver: null,
    sidebarResizeObserver: null,
    sidebarPollTimer: 0,
    windowResizeHandler: null,
    windowResizeBound: false,
  };

  function documentViewerEnabled() {
    return window.__EAGLE_ORCABOX_DOCUMENT_VIEWER_ENABLED !== false;
  }

  function collectVisibleAssetIds() {
    const boxes = document.querySelectorAll('#box-container .box');
    const ids = [];
    boxes.forEach((box) => {
      const id = box && box.getAttribute('data-box-id');
      if (id) ids.push(id);
    });
    if (ids.length > 0) return ids;
    const scope = window.$bodyScope;
    const items = (scope && Array.isArray(scope.raw))
      ? scope.raw
      : (Array.isArray(window.__mockLibraryCache) ? window.__mockLibraryCache : []);
    return items.filter((item) => item && item.id && !item.isDeleted).map((item) => item.id);
  }

  function viewerBaseUrl() {
    const origin = window.location.origin;
    return `${origin}/frontend/document-viewer/index.html`;
  }

  // Measure Eagle's own top toolbar so the viewer container leaves exactly the
  // right amount of room at the top: too little would cover its draggable
  // strip (window can't be dragged), too much wastes space.
  function topToolbarHeight() {
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
  function suppressSidebarHoverStrip() {
    try {
      const strip = document.querySelector('.hover-show-sidebar');
      if (strip) strip.style.pointerEvents = 'none';
    } catch (err) {
      // Ignore.
    }
  }

  // The viewer leaves room for Eagle's own top toolbar at the top so its
  // buttons stay clickable and the window can still be dragged; the exit (×)
  // action lives inside the viewer's editor toolbar (preview → ×).
  function sidebarVisibilityState() {
    const sidebar = document.querySelector('#sidebar');
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
  function inspectorVisibilityState() {
    try {
      const scope = window.$bodyScope;
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

  function viewerInsetsState() {
    return JSON.stringify({
      sidebar: sidebarVisibilityState(),
      inspector: inspectorVisibilityState(),
    });
  }

  function installSidebarWatchers() {
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

  function ensureViewerContainer() {
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

  function applyViewerMode(mode) {
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
  function autoCollapseSidebar() {
    try {
      if (document.body.classList.contains('hide-sidebar')) return;
      const scope = window.$bodyScope;
      if (scope && typeof scope.toggleAll === 'function') {
        scope.toggleAll();
      }
    } catch (err) {
      console.warn('[eagle-shim] document auto-collapse sidebar failed', err);
    }
  }

  function openDocumentViewer(item, mode) {
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

  function fallbackToOriginalDetail(itemId) {
    try {
      const scope = window.$bodyScope;
      const item = (scope && Array.isArray(scope.raw))
        ? scope.raw.find((entry) => entry && entry.id === itemId)
        : null;
      if (item && typeof originalDetailModeEntry === 'function') {
        originalDetailModeEntry.call(scope, null, item);
      }
    } catch (err) {
      console.warn('[eagle-shim] document viewer fallback failed', err);
    }
  }

  function closeDocumentViewer() {
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

  function handleDocumentViewerMessage(event) {
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
        const scope = window.$bodyScope;
        if (scope && typeof scope.leaveDetailMode === 'function' && scope.isDetailMode) {
          scope.leaveDetailMode();
        }
      } catch (err) {
        console.warn('[eagle-shim] document viewer close scope restore failed', err);
      }
    }
  }
  window.addEventListener('message', handleDocumentViewerMessage);

  // Close the viewer when the shell reloads.
  window.addEventListener('beforeunload', () => closeDocumentViewer());

  const browserFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  if (browserFetch) {
    window.fetch = function (input, init) {
      let target = typeof input === 'string' ? input : input && input.url;
      if (typeof target === 'string') {
        const apiBase = window.__EAGLE_API_BASE_URL || 'http://localhost:41695';
        const extensionBase = window.__EAGLE_EXTENSION_BASE_URL || 'http://localhost:41693';
        target = target
          .replace(/^http:\/\/localhost:41595(?=\/|$)/i, apiBase.replace(/\/$/, ''))
          .replace(/^http:\/\/localhost:41593(?=\/|$)/i, extensionBase.replace(/\/$/, ''));
        if (typeof input === 'string') input = target;
        else input = new Request(target, input);
      }
      return browserFetch(input, init);
    };
  }

  if (typeof HTMLMediaElement !== 'undefined') {
    const durationDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration');
    if (durationDescriptor && typeof durationDescriptor.get === 'function') {
      const nativeDurationGet = durationDescriptor.get;
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        enumerable: durationDescriptor.enumerable,
        get() {
          const native = nativeDurationGet.call(this);
          if (Number.isFinite(native) && native > 0) return native;
          if (this.readyState >= 1) return 1;
          return NaN;
        },
        set(value) {
          if (typeof durationDescriptor.set === 'function') durationDescriptor.set.call(this, value);
        },
      });
    }
  }

  function syncText(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText;
      return null;
    } catch (err) {
      return null;
    }
  }

  function syncArrayBuffer(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return xhr.response;
      return null;
    } catch (err) {
      return null;
    }
  }

  function toFileUrl(p) {
    const s = String(p || '').replace(/\\/g, '/');
    if (/^[a-z]+:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return window.location.origin + s;
    return window.location.origin + '/' + s;
  }

  function dirname(p) {
    const clean = String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const idx = clean.lastIndexOf('/');
    return idx <= 0 ? '/' : clean.slice(0, idx) || '/';
  }

  const pathModule = {
    sep: '/',
    delimiter: ';',
    normalize(p) {
      const s = String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/');
      return s.replace(/\/$/, '') || '/';
    },
    join(...parts) {
      const out = [];
      for (const part of parts) {
        const s = String(part || '').replace(/\\/g, '/');
        if (!s) continue;
        if (s.startsWith('/') && out.length === 0) out.push(s.replace(/^\//, ''));
        else if (s.startsWith('/')) continue;
        else out.push(s.replace(/^\/+/, ''));
      }
      const joined = '/' + out.join('/');
      return pathModule.normalize(joined);
    },
    resolve(...parts) {
      return pathModule.join('/', ...parts);
    },
    basename(p, ext) {
      const clean = String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
      const base = clean.slice(clean.lastIndexOf('/') + 1);
      if (ext && base.endsWith(ext)) return base.slice(0, -ext.length);
      return base;
    },
    dirname(p) {
      return dirname(p);
    },
    extname(p) {
      const base = pathModule.basename(p);
      const idx = base.lastIndexOf('.');
      return idx > 0 ? base.slice(idx) : '';
    },
    isAbsolute(p) {
      return String(p || '').startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p);
    },
    relative() {
      return '';
    },
  };

  class BrowserBuffer extends Uint8Array {
    static from(value, encoding) {
      if (value instanceof Uint8Array) return new BrowserBuffer(value);
      if (Array.isArray(value)) return new BrowserBuffer(value);
      const str = String(value == null ? '' : value);
      return new BrowserBuffer([...str].map((ch) => ch.charCodeAt(0) & 0xff));
    }

    static alloc(size) {
      return new BrowserBuffer(size);
    }

    static isBuffer(value) {
      return value instanceof BrowserBuffer || value instanceof Uint8Array;
    }

    toString(encoding) {
      return Array.from(this).map((code) => String.fromCharCode(code)).join('');
    }
  }

  const osModule = {
    platform: 'win32',
    arch: 'x64',
    type: () => 'Windows_NT',
    hostname: () => 'EAGLE-REVERSE',
    release: () => '10.0.22631',
    tmpdir: () => '/mock-tmp',
    homedir: () => '/mock-user-data',
    EOL: '\n',
    cpus: () => [],
    totalmem: () => 0,
    freemem: () => 0,
  };

  const fsModule = {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    existsSync(p) {
      const s = String(p || '').replace(/\\/g, '/');
      if (s.includes('/mock-library/')) return true;
      if (s.includes('Settings')) return true;
      if (s.includes('/src/i18n/') && s.endsWith('.js')) return syncText(s) !== null;
      return false;
    },
    access(p, callback) {
      if (typeof callback === 'function') setTimeout(() => callback(null), 0);
    },
    accessSync() {},
    readFileSync(p, encoding) {
      const s = String(p || '').replace(/\\/g, '/');
      if (s.includes('Settings')) {
        return JSON.stringify({ preferences: { general: { language: 'zh_CN' } } });
      }
      if (s.endsWith('tags.json')) {
        return JSON.stringify({ historyTags: ['UI', '空状态'], starredTags: ['UI', '收藏'] });
      }
      if (s.endsWith('saved-filters.json')) {
        // 浏览器 fallback 读取当前库真实保存筛选，不再固定返回空数组。
        const savedFilters = window.__mockLibrary && window.__mockLibrary.savedFilters;
        return Array.isArray(savedFilters) ? JSON.stringify(savedFilters) : '[]';
      }
      if (s.endsWith('.js') && s.includes('/src/i18n/')) return syncText(s) || '{}';
      const url = toFileUrl(s);
      if (encoding === 'utf8' || encoding === 'utf-8') {
        return syncText(url) || '';
      }
      const binary = syncArrayBuffer(url);
      if (binary) return BrowserBuffer.from(new Uint8Array(binary));
      return '';
    },
    exists(p, callback) {
      if (typeof callback === 'function') setTimeout(() => callback(fsModule.existsSync(p)), 0);
    },
    writeFileSync() {},
    writeFile() {
      const cb = arguments[arguments.length - 1];
      if (typeof cb === 'function') setTimeout(cb, 0);
    },
    readFile(p, encoding, callback) {
      if (typeof encoding === 'function') {
        callback = encoding;
        encoding = undefined;
      }
      if (typeof callback !== 'function') return;
      const s = String(p || '').replace(/\\/g, '/');
      if (s.includes('Settings')) {
        setTimeout(() => callback(null, JSON.stringify({ preferences: { general: { language: 'zh_CN' } } })), 0);
        return;
      }
      if (s.endsWith('tags.json')) {
        setTimeout(() => callback(null, JSON.stringify({ historyTags: ['UI', 'empty'], starredTags: ['UI', 'favorite'] })), 0);
        return;
      }
      if (s.endsWith('saved-filters.json')) {
        const savedFilters = window.__mockLibrary && window.__mockLibrary.savedFilters;
        setTimeout(() => callback(null, Array.isArray(savedFilters) ? JSON.stringify(savedFilters) : '[]'), 0);
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('GET', toFileUrl(s), true);
      xhr.responseType = encoding === 'utf8' || encoding === 'utf-8' ? 'text' : 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) callback(null, xhr.response);
        else callback(new Error(`ENOENT: no such file or directory, open '${s}'`));
      };
      xhr.onerror = () => callback(new Error(`ENOENT: no such file or directory, open '${s}'`));
      xhr.send(null);
    },
    readdirSync() {
      return [];
    },
    readdir() {
      const cb = arguments[arguments.length - 1];
      if (typeof cb === 'function') setTimeout(() => cb(null, []), 0);
      return [];
    },
    statSync() {
      return {
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
        size: 1,
        mtimeMs: Date.now(),
      };
    },
    lstatSync() {
      return fsModule.statSync();
    },
    renameSync() {},
    unlinkSync() {},
    mkdirSync() {},
    rmSync() {},
    removeSync() {},
    copyFileSync() {},
    createReadStream() {
      return { on() { return this; }, pipe() { return this; } };
    },
    createWriteStream() {
      return { on() { return this; }, end() {}, write() {} };
    },
  };

  const electronLog = {
    info() {},
    warn() {},
    error() {},
    debug() {},
    verbose() {},
    transports: {
      file: {
        appName: '',
        level: 'info',
        maxSize: 20 * 1024 * 1024,
      },
    },
  };

  class EventEmitter {
    constructor() {
      this.listeners = new Map();
    }

    on(channel, callback) {
      if (!this.listeners.has(channel)) this.listeners.set(channel, []);
      this.listeners.get(channel).push(callback);
      return this;
    }

    once(channel, callback) {
      const wrap = (...args) => {
        this.off(channel, wrap);
        callback(...args);
      };
      return this.on(channel, wrap);
    }

    off(channel, callback) {
      const list = this.listeners.get(channel) || [];
      this.listeners.set(channel, list.filter((fn) => fn !== callback));
      return this;
    }

    removeAllListeners(channel) {
      if (channel) this.listeners.delete(channel);
      else this.listeners.clear();
      return this;
    }

    emit(channel, ...args) {
      const list = (this.listeners.get(channel) || []).slice();
      list.forEach((callback) => {
        try {
          callback({}, ...args);
        } catch (err) {
          console.warn(`[eagle-shim] ipc listener error on ${channel}`, err);
        }
      });
      return true;
    }

    send(channel, params) {
      if (channel === 'update-main-window-id' || channel === 'check-for-update') return;
      console.debug('[eagle-shim] ipc send', channel, params);
    }

    sendTo(id, channel, params) {
      this.send(channel, params);
    }

    invoke(channel, params) {
      console.debug('[eagle-shim] ipc invoke', channel, params);
      if (channel === 'get-collect-window-data') {
        const items = window.__mockLibraryCache || [];
        const item = items.find((entry) => entry.id === 'MOCK0001') || items[0] || {};
        const lib = window.__mockLibrary || {};
        const imagesDir = lib.imagesDir || '/mock-library/Eagle Reverse Demo.library/images/';
        const name = item.name || 'Welcome Library';
        const ext = item.ext || 'png';
        return Promise.resolve({
          ok: true,
          canceled: false,
          filePath: '',
          filePaths: [],
          path: `${imagesDir}${item.id || 'MOCK0001'}.info/${encodeURIComponent(name)}.${ext}`,
          url: item.url || '',
          name,
          type: 'image',
          tags: item.tags || [],
          folders: item.folders || [],
          annotation: item.annotation || '',
          width: item.width || 0,
          height: item.height || 0,
          star: item.star || 0,
        });
      }
      return Promise.resolve({ canceled: true, filePaths: [], filePath: '', ok: true });
    }
  }

  const ipcRenderer = new EventEmitter();
  const mockEmit = ipcRenderer.emit.bind(ipcRenderer);
  const emitIpc = ipcRenderer.emit.bind(ipcRenderer);
  ipcRenderer.emit = function (channel, ...args) {
    if (channel === 'file-uploaded' && args[0] && args[0].id) {
      try {
        const scope = window.angular ? angular.element(document.body).scope() : null;
        if (scope && Array.isArray(scope.raw) && scope.raw.some((item) => item && item.id === args[0].id)) return true;
      } catch (err) {
        // Fall through to the normal event dispatch.
      }
    }
    if (channel === 'library:changed' || channel === 'preload-library' || channel === 'app-status-library-loaded') {
      // The library (or its items) changed under the document viewer — unmount it.
      closeDocumentViewer();
    }
    return emitIpc(channel, ...args);
  };
  const customThumbnailItemIds = new Set();
  const desktopSendChannels = new Set(['create-library', 'open-library', 'add-to-history-and-open']);
  const paletteAnalysisRequests = new Map();
  let itemUpdateQueue = Promise.resolve();

  function mergeCachedItems(updatedItems) {
    const cached = window.__mockLibraryCache || [];
    const updates = Array.isArray(updatedItems) ? updatedItems : [updatedItems];
    updates.forEach((updated) => {
      if (!updated || !updated.id) return;
      const index = cached.findIndex((entry) => entry.id === updated.id);
      if (index >= 0) Object.assign(cached[index], updated);
      else cached.unshift(updated);
    });
    window.__mockLibraryCache = cached;
    try {
      if (window.angular) {
        const scope = angular.element(document.body).scope();
        updates.forEach((updated) => {
          if (!updated || !updated.id) return;
          const targets = [
            scope && scope.itemMappings && scope.itemMappings[updated.id],
            ...(scope && Array.isArray(scope.raw) ? scope.raw.filter((item) => item.id === updated.id) : []),
            ...(scope && Array.isArray(scope.allData) ? scope.allData.filter((item) => item.id === updated.id) : []),
          ].filter(Boolean);
          [...new Set(targets)].forEach((target) => Object.assign(target, updated));
        });
        if (scope && typeof scope.$evalAsync === 'function') scope.$evalAsync();
      }
    } catch (err) {
      console.warn('[eagle-shim] failed to synchronize updated items', err);
    }
    return cached;
  }

  function emitImportedItems(items, channel) {
    const imported = (Array.isArray(items) ? items : [items])
      .filter((item) => item && item.id)
      .map((item) => {
        if (!item.width && !item.height && textThumbnailExtensions.has(String(item.ext || '').toLowerCase())) {
          item.width = 480;
          item.height = 480;
        }
        return item;
      });
    mergeCachedItems(imported);
    imported.forEach((item) => ipcRenderer.emit('file-uploaded', item));
    if (imported.length > 0) mockEmit('file-uploaded-end', {});
    mockEmit('import:operation-result', { ok: true, channel, items: imported });
    scheduleMissingPaletteAnalysis(imported);
    refreshImportedThumbnails(imported);
    return imported;
  }

  async function browserUploadLocalFiles(files) {
    const list = Array.isArray(files) ? files : [];
    if (list.length === 0) return [];
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const blobFiles = list.filter((file) => file && typeof Blob !== 'undefined' && file instanceof Blob);
    const pathFiles = list.filter((file) => file && !(typeof Blob !== 'undefined' && file instanceof Blob) && typeof file.path === 'string' && file.path);
    const imported = [];

    for (const file of blobFiles) {
      const form = new FormData();
      form.append('file', file);
      const tags = Array.isArray(file.tags) ? file.tags.join(',') : file.tags;
      if (tags) form.append('tags', tags);
      if (file.annotation) form.append('annotation', file.annotation);
      if (Array.isArray(file.folders) && file.folders.length > 0) form.append('folderIDs', file.folders.join(','));
      const response = await fetch(`${apiBase}/api/item/upload`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok || !payload || payload.status !== 'success') {
        throw new Error(payload && payload.message ? payload.message : `Upload failed: HTTP ${response.status}`);
      }
      imported.push(payload.data);
    }

    if (pathFiles.length > 0) {
      const response = await fetch(`${apiBase}/api/item/addFromPaths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: pathFiles.map((file) => ({
            path: file.path,
            name: file.name,
            type: file.type,
            tags: Array.isArray(file.tags) ? file.tags : [],
            folders: Array.isArray(file.folders) ? file.folders : [],
            annotation: file.annotation || '',
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload || payload.status !== 'success') {
        throw new Error(payload && payload.message ? payload.message : `Path import failed: HTTP ${response.status}`);
      }
      imported.push(...(Array.isArray(payload.data) ? payload.data : []));
    }
    return imported;
  }

  function browserImportLocalFiles(files, channel = 'upload-local-files') {
    return browserUploadLocalFiles(files)
      .then((items) => {
        emitImportedItems(items, channel);
        return items;
      })
      .catch((err) => {
        mockEmit('import:operation-result', { ok: false, channel, error: err.message });
        mockEmit('file-uploaded-end', { error: err.message });
        throw err;
      });
  }

  async function browserImportUrl(params, channel = 'upload-url') {
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/item/addFromURL`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    const payload = await response.json();
    if (!response.ok || !payload || payload.status !== 'success') {
      throw new Error(payload && payload.message ? payload.message : `URL import failed: HTTP ${response.status}`);
    }
    emitImportedItems([payload.data], channel);
    return payload.data;
  }

  async function browserImportUrls(params, channel = 'upload-urls') {
    const list = Array.isArray(params)
      ? params
      : (params && (params.images || params.urls)) || [];
    if (list.length === 0) return [];
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/item/addFromURLs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: list.map((source) => typeof source === 'string' ? { url: source } : source),
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload || payload.status !== 'success') {
      throw new Error(payload && payload.message ? payload.message : `URL batch import failed: HTTP ${response.status}`);
    }
    emitImportedItems(payload.data, channel);
    return payload.data;
  }

  async function thumbnailTaskSnapshot(taskId) {
    if (desktopApi && desktopApi.thumbnail && typeof desktopApi.thumbnail.status === 'function') {
      return desktopApi.thumbnail.status(taskId);
    }
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/item/thumbnailTask/status?taskId=${encodeURIComponent(String(taskId || ''))}`);
    const payload = await response.json();
    if (!response.ok || !payload || payload.status !== 'success') {
      throw new Error(payload && payload.message ? payload.message : `Thumbnail status failed: HTTP ${response.status}`);
    }
    return payload.data;
  }

  async function libraryItemsSnapshot() {
    if (desktopApi && desktopApi.library && typeof desktopApi.library.current === 'function') {
      const library = await desktopApi.library.current();
      return Array.isArray(library.items) ? library.items : [];
    }
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/library/current?includeItems=true`);
    const payload = await response.json();
    if (!response.ok || !payload || payload.status !== 'success') {
      throw new Error(payload && payload.message ? payload.message : `Library refresh failed: HTTP ${response.status}`);
    }
    return Array.isArray(payload.data.items) ? payload.data.items : [];
  }

  async function refreshImportedThumbnails(items) {
    const list = (Array.isArray(items) ? items : [items]).filter((item) => item && item.thumbnailTask);
    for (const item of list) {
      try {
        let complete = false;
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          const task = await thumbnailTaskSnapshot(item.thumbnailTask);
          if (task && task.status === 'complete') {
            complete = true;
            break;
          }
          if (task && (task.status === 'failed' || task.status === 'cancelled' || task.error)) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (!complete) continue;
        const libraryItems = await libraryItemsSnapshot();
        const updated = libraryItems.find((entry) => entry && entry.id === item.id);
        if (updated && !updated.processingThumbnail) {
          if (!Number(updated.width) || !Number(updated.height)) {
            updated.width = Number(item.width) || 480;
            updated.height = Number(item.height) || 480;
          }
          mergeCachedItems(updated);
          mockEmit('thumbnail-generated', updated);
        }
      } catch (err) {
        console.warn('[eagle-shim] imported thumbnail refresh failed', err);
      }
    }
  }

  function installBrowserDropImport() {
    if (desktopApi || isElectronRuntime) return;
    if (!window.location.pathname.endsWith('/src/app/index.html')) return;
    document.addEventListener('drop', (event) => {
      const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
      if (files.length === 0) return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function' || !target.closest('#box-container')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      browserImportLocalFiles(files).catch(() => {});
    }, true);
  }

  function installImportTransitionStyle() {
    if (!window.location.pathname.endsWith('/src/app/index.html')) return;
    const style = document.createElement('style');
    style.textContent = `
      .box-list .box .thumbnail,
      .box-list .box .thumbnail img,
      .box-list .box .thumbnail video {
        transition: opacity 220ms ease !important;
      }
      .box-list .box.show .thumbnail img,
      .box-list .box.show .thumbnail video {
        animation: boxImgfadeIn 220ms ease forwards !important;
      }
    `;
    document.head.appendChild(style);
  }

  function formatFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = -1;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size >= 100 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
  }

  function patchNonMediaMeta() {
    document.querySelectorAll('#box-container .box').forEach((box) => {
      const extClass = Array.from(box.classList).find((name) => name.startsWith('ext-'));
      const ext = extClass ? extClass.slice(4).toLowerCase() : '';
      if (!ext || resolutionMediaExtensions.has(ext)) return;
      const meta = box.querySelector('.metas');
      if (!meta || !/^\d+\s*×\s*\d+$/.test(meta.textContent.trim())) return;
      const sizeElement = box.querySelector('.prop.size');
      const sizeText = sizeElement && sizeElement.textContent.trim();
      const scope = window.angular ? angular.element(document.body).scope() : null;
      const item = scope && scope.itemMappings && scope.itemMappings[box.getAttribute('data-box-id')];
      meta.textContent = sizeText || formatFileSize(item && item.size);
    });
  }

  function installNonMediaMetaPatcher() {
    if (!window.location.pathname.endsWith('/src/app/index.html')) return;
    const target = document.querySelector('#box-container .box-list') || document;
    const observer = new MutationObserver(patchNonMediaMeta);
    observer.observe(target, { childList: true, subtree: true });
    patchNonMediaMeta();
  }

  function canAnalyzePalette(item) {
    return Boolean(
      item &&
      item.id &&
      !item.isDeleted &&
      !item.noPreview &&
      Number(item.width) > 0 &&
      Number(item.height) > 0
    );
  }

  function analyzeItemPalette(item, options) {
    const force = Boolean(options && options.force);
    if (!canAnalyzePalette(item) || (!force && Array.isArray(item.palettes))) return Promise.resolve(item);
    if (paletteAnalysisRequests.has(item.id)) return paletteAnalysisRequests.get(item.id);

    item.processingPalette = true;
    mergeCachedItems(item);
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
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
          const belongsToCurrentLibrary = (window.__mockLibraryCache || []).some((entry) => entry && entry.id === updated.id);
          if (belongsToCurrentLibrary) {
            mergeCachedItems(updated);
            mockEmit('image.palette.updated', updated);
          }
          return updated;
        }
        return item;
      })
      .catch((err) => {
        delete item.processingPalette;
        const belongsToCurrentLibrary = (window.__mockLibraryCache || []).some((entry) => entry && entry.id === item.id);
        if (belongsToCurrentLibrary) mergeCachedItems(item);
        console.warn(`[eagle-shim] palette analysis failed for ${item.id}`, err);
        return item;
      })
      .finally(() => paletteAnalysisRequests.delete(item.id));
    paletteAnalysisRequests.set(item.id, request);
    return request;
  }

  function scheduleMissingPaletteAnalysis(items) {
    const list = Array.isArray(items) ? items : [items];
    list.forEach((item) => {
      if (canAnalyzePalette(item) && !Array.isArray(item.palettes)) analyzeItemPalette(item);
    });
  }

  function previewCurrentItemId() {
    const scope = window.$bodyScope;
    return scope && scope.current && scope.current.id ? scope.current.id : '';
  }

  function dragStartItemId(params) {
    const value = params && typeof params === 'object' ? params : {};
    let target = value.target || null;
    if (!target && typeof value.images === 'string') {
      try {
        const images = JSON.parse(value.images);
        target = Array.isArray(images) ? images[0] : images;
      } catch (err) {
        target = null;
      }
    }
    if (!target && Array.isArray(value.images)) target = value.images[0] || null;
    if (target && typeof target === 'object' && target.id) return target.id;
    if (typeof target === 'string' && target) return target;
    return '';
  }

  function runPreviewAction(action, promise) {
    Promise.resolve(promise)
      .then((result) => mockEmit('preview:action-result', { ok: true, action, ...(result || {}) }))
      .catch((err) => mockEmit('preview:action-result', { ok: false, action, error: err.message }));
  }

  function isCurrentPreviewRawPath(rawPath) {
    const scope = window.$bodyScope;
    if (!scope || !scope.current || !scope.current.id || !scope.current.name || !scope.current.ext) return false;
    const expected = `${scope.libraryImagesPath || ''}/${scope.current.id}.info/${scope.current.name}.${scope.current.ext}`
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/');
    const actual = String(rawPath || '').replace(/\\/g, '/').replace(/\/+/g, '/');
    return expected === actual;
  }

  ipcRenderer.send = function (channel, params) {
    if (channel === 'regenerate-palette') {
      const items = Array.isArray(params) ? params : [];
      items.forEach((item) => analyzeItemPalette(item, { force: true }));
      return;
    }
    if (channel === 'chnage-preferences' && params && typeof params === 'object') {
      savePreferences(params);
      applyPreferencesToCurrentDocument();
      return;
    }
    if (channel === 'change-theme' && params && typeof params === 'object') {
      savePreferences({ theme: params });
      applyPreferencesToCurrentDocument();
      return;
    }
    if (channel === 'change-zoom' && params) {
      savePreferences({ general: { zoom: String(params) } });
      applyPreferencesToCurrentDocument();
      return;
    }
    if (channel === 'chnage-shortcut' && params && typeof params === 'object') {
      savePreferences({
        shortcuts: {
          keybinds: {
            'global.capture.area': params.screenCaptureShortcut || '',
            'global.capture.window': params.windowCaptureShortcut || '',
          },
        },
      });
      applyPreferencesToCurrentDocument();
      return;
    }
    if (channel === 'chnage-scrollBehavior' && params) {
      savePreferences({ habits: { scrollBehavior: String(params) } });
      applyPreferencesToCurrentDocument();
      return;
    }
    if (channel === 'lock-now') {
      broadcastIpc('lock-now');
      return;
    }
    if (channel === 'update-preferences') {
      applyPreferencesToCurrentDocument();
      return;
    }
    if (channel === 'open.preferences') {
      if (nativeRequire) {
        try {
          nativeRequire('electron').ipcRenderer.send('open.preferences', params || {});
          return;
        } catch (err) {
          console.warn('[eagle-shim] native preferences IPC unavailable, opening directly', err);
        }
      }
      const query = new URLSearchParams();
      if (params && params.panel) query.set('panel', String(params.panel));
      if (params && params.keyword) query.set('keyword', String(params.keyword));
      const search = query.toString();
      window.open(`/src/app/preferences.html${search ? `?${search}` : ''}`, '_blank');
      return;
    }
    if (desktopApi && desktopApi.library && desktopSendChannels.has(channel)) {
      const action = channel === 'create-library'
        ? desktopApi.library.create(params || {})
        : desktopApi.library.switch(params);
      const actionName = channel === 'create-library' ? 'create' : 'open';
      Promise.resolve(action)
        .then((library) => {
          if (library) {
            window.__mockLibrary = { ...(window.__mockLibrary || {}), ...library };
            if (Array.isArray(library.items)) window.__mockLibraryCache = library.items.slice();
            scheduleMissingPaletteAnalysis(library.items || []);
          }
          mockEmit('library:changed', library);
          mockEmit('library:operation-result', { ok: true, action: actionName, library });
        })
        .catch((err) => mockEmit('library:operation-result', { ok: false, action: actionName, error: err.message }));
      return;
    }
    if (!desktopApi && desktopSendChannels.has(channel)) {
      const libraryPath = typeof params === 'string'
        ? params
        : params && (params.libraryPath || params.path || params.libraryDir);
      const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
      const actionName = channel === 'create-library' ? 'create' : 'open';
      const route = channel === 'create-library' ? '/api/library/create' : '/api/library/switch';
      const body = channel === 'create-library'
        ? (params || {})
        : { libraryPath };
      Promise.resolve()
        .then(() => fetch(`${apiBase}${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }))
        .then((response) => response.json())
        .then((result) => {
          if (!result || result.status !== 'success') {
            throw new Error(result && result.message ? result.message : 'Library switch failed');
          }
          const library = result.data;
          window.__mockLibrary = { ...(window.__mockLibrary || {}), ...library };
          if (Array.isArray(library.items)) window.__mockLibraryCache = library.items.slice();
          scheduleMissingPaletteAnalysis(library.items || []);
          mockEmit('library:changed', library);
          mockEmit('library:operation-result', { ok: true, action: actionName, library });
        })
        .catch((err) => mockEmit('library:operation-result', { ok: false, action: actionName, error: err.message }));
      return;
    }
    if (desktopApi && desktopApi.library && channel === 'folders-change') {
      desktopApi.library.updateStructure(params || {}).then((library) => {
        if (library) {
          window.__mockLibrary = { ...(window.__mockLibrary || {}), ...library };
          if (Array.isArray(library.items)) window.__mockLibraryCache = library.items.slice();
        }
      }).catch((err) => {
        mockEmit('library:operation-result', { ok: false, action: channel, error: err.message });
      });
      return;
    }
    if (desktopApi && desktopApi.duplicates && channel === 'empty-trash') {
      const ids = String(params || '').split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        desktopApi.duplicates.emptyTrash(ids, { force: true }).catch((err) => {
          mockEmit('item:operation-result', { ok: false, action: channel, error: err.message });
        });
      }
      return;
    }
    if (desktopApi && desktopApi.item && (channel === 'images-change' || channel === 'image-change')) {
      const items = channel === 'images-change' ? params : [params];
      const snapshots = (Array.isArray(items) ? items : []).filter((item) => item && item.id).map((item) => structuredClone(item));
      itemUpdateQueue = itemUpdateQueue
        .catch(() => undefined)
        .then(() => desktopApi.item.updateMany(snapshots))
        .then((updated) => {
          mergeCachedItems(updated);
          const keep = snapshots.find((item) => !item.isDeleted);
          const trash = snapshots.filter((item) => item.isDeleted);
          if (keep && trash.length > 0 && desktopApi.duplicates) {
            desktopApi.duplicates.merge({
              keepId: keep.id,
              removeIds: trash.map((item) => item.id),
              keep,
            }).catch((err) => {
              mockEmit('duplicate-merge-error', { error: err.message });
            });
          }
          mockEmit('item:operation-result', { ok: true, action: channel, items: updated });
          return updated;
        })
        .catch((err) => {
          mockEmit('item:operation-result', { ok: false, action: channel, error: err.message });
          return [];
        });
      return;
    }
    if (desktopApi && desktopApi.clipboard && (channel === 'read-win-files' || channel === 'paste-image' || channel === 'paste-paths')) {
      const payload = params && params.params ? { ...params.params, folder: params.folder || params.params.folder } : (params || {});
      if (channel === 'paste-paths') payload.files = Array.isArray(params && params.files) ? params.files : [];
      desktopApi.clipboard.import(payload).then((items) => emitImportedItems(items, channel)).catch((err) => {
        mockEmit('import:operation-result', { ok: false, channel, error: err.message });
        mockEmit('file-uploaded-end', { error: err.message });
      });
      return;
    }
    if (desktopApi && desktopApi.preview && channel === 'open-preview-window') {
      const images = Array.isArray(params && params.images)
        ? params.images.filter((item) => item && item.id).map((item) => structuredClone(item))
        : [];
      desktopApi.preview.open({ images }).then((result) => {
        mockEmit('preview:operation-result', { ok: true, result });
      }).catch((err) => mockEmit('preview:operation-result', { ok: false, error: err.message }));
      return;
    }
    if (desktopApi && desktopApi.item) {
      const itemId = previewCurrentItemId();
      if (channel === 'open-with-default' && itemId) {
        runPreviewAction('open-with-default', desktopApi.item.openDefault(itemId));
        return;
      }
      if (channel === 'show-item-in-folder' && itemId && !(params && typeof params === 'string' && !isCurrentPreviewRawPath(params))) {
        runPreviewAction('show-item-in-folder', desktopApi.item.reveal(itemId));
        return;
      }
      if (channel === 'copy-images' && itemId) {
        runPreviewAction('copy-images', desktopApi.item.copyImage(itemId));
        return;
      }
      if (channel === 'ondragstart') {
        const itemId = dragStartItemId(params) || previewCurrentItemId();
        if (itemId) {
          runPreviewAction('ondragstart', desktopApi.item.dragStart(itemId));
          return;
        }
      }
    }
    if (desktopApi && desktopApi.thumbnail) {
      if (channel === 'set-custom-thumbnail') {
        const item = params && params.item;
        desktopApi.thumbnail.setCustom({
          itemId: item && item.id,
          filePath: params && params.thumbnailPath,
          width: params && params.width,
          height: params && params.height,
        }).then((result) => {
          const updated = result && result.item ? result.item : result;
          if (updated && updated.id) {
            customThumbnailItemIds.add(updated.id);
            const items = window.__mockLibraryCache || [];
            const index = items.findIndex((entry) => entry.id === updated.id);
            if (index >= 0) items[index] = updated;
            mockEmit('thumbnail-generated', updated);
          }
        }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
        return;
      }
      if (channel === 'regenerate-video-thumbnail') {
        const video = params && params.video;
        const itemId = video && video.id;
        if (itemId) {
          const refresh = () => desktopApi.thumbnail.refresh({
            itemId,
            startAt: params.startAt ?? video.thumbnailAt,
          });
          const automaticTaskId = video.thumbnailTask;
          const waitForAutomatic = automaticTaskId
            ? new Promise((resolve, reject) => {
                const poll = () => desktopApi.thumbnail.status(automaticTaskId).then((status) => {
                  if (status.status === 'complete') resolve();
                  else if (status.status === 'failed' || status.status === 'cancelled') reject(new Error(status.error || status.code || 'Automatic thumbnail failed'));
                  else setTimeout(poll, 50);
                }).catch(reject);
                poll();
              })
            : Promise.resolve();
          waitForAutomatic.then(refresh).then((result) => {
            const updated = result && result.item ? result.item : result;
            if (updated && updated.id) {
              const cached = window.__mockLibraryCache || [];
              const index = cached.findIndex((entry) => entry.id === updated.id);
              if (index >= 0) cached[index] = updated;
              mockEmit('thumbnail-generated', updated);
            }
          }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
        }
        return;
      }
      if (channel === 'regenerate-thumbnail') {
        const items = Array.isArray(params) ? params : [];
        items.forEach((item) => {
          const itemId = item && item.id;
          const shouldReset = Boolean(itemId && (item.customThumbnail || customThumbnailItemIds.has(itemId)));
          const action = shouldReset
            ? desktopApi.thumbnail.resetCustom({ itemId })
            : desktopApi.thumbnail.refresh({ itemId });
          Promise.resolve(action).then((result) => {
            const updated = result && result.item ? result.item : result;
            if (updated && updated.id) {
              if (!updated.customThumbnail) customThumbnailItemIds.delete(updated.id);
              const cached = window.__mockLibraryCache || [];
              const index = cached.findIndex((entry) => entry.id === updated.id);
              if (index >= 0) cached[index] = updated;
              mockEmit('thumbnail-generated', updated);
            }
          }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
        });
        return;
      }
    }
    if (!desktopApi && channel === 'upload-local-files') {
      browserImportLocalFiles(params && params.files ? params.files : []).catch(() => {});
      return;
    }
    if (!desktopApi && channel === 'upload-url') {
      browserImportUrl(params).catch(() => {});
      return;
    }
    if (!desktopApi && channel === 'upload-urls') {
      browserImportUrls(params).catch(() => {});
      return;
    }
    if (desktopApi && desktopApi.import) {
      let action = null;
      if (channel === 'upload-local-files') action = desktopApi.import.files(params || {});
      if (channel === 'upload-url') action = desktopApi.import.url(params || {});
      if (channel === 'upload-urls') action = desktopApi.import.urls(params || []);
      if (channel === 'import-folders') action = desktopApi.import.folders(params || {});
      if (action) {
        Promise.resolve(action)
          .then((result) => {
            const batches = channel === 'import-folders' && Array.isArray(result) ? result : [result];
            const items = batches.flatMap((batch) => Array.isArray(batch) ? batch : Array.isArray(batch && batch.items) ? batch.items : batch && batch.id ? [batch] : []);
            emitImportedItems(items, channel);
            if (channel === 'import-folders') {
              desktopApi.library.current().then((library) => {
                window.__mockLibrary = { ...window.__mockLibrary, ...library };
                window.__mockLibraryCache = Array.isArray(library.items) ? library.items.slice() : window.__mockLibraryCache;
                mockEmit('library:changed', library);
              }).catch(() => {});
            }
          })
          .catch((err) => mockEmit('import:operation-result', { ok: false, channel, error: err.message }));
        return;
      }
    }
    if (desktopApi && desktopApi.export) {
      if (channel === 'export-images') {
        const exportParams = params || {};
        if (String(exportParams.savePath || '').toLowerCase().endsWith('.eaglepack')) {
          desktopApi.export.eaglepack(exportParams).catch(() => {});
        } else {
          desktopApi.export.images(exportParams).catch(() => {});
        }
        return;
      }
      if (channel === 'export-as-folder') {
        desktopApi.export.asFolder(params || {}).catch(() => {});
        return;
      }
      if (channel === 'show-item-in-folder') {
        if (desktopApi.export.reveal && window.__lastExportJobId) {
          runPreviewAction('show-item-in-folder', desktopApi.export.reveal(window.__lastExportJobId));
        } else {
          const itemId = previewCurrentItemId();
          if (itemId) runPreviewAction('show-item-in-folder', desktopApi.item.reveal(itemId));
        }
        return;
      }
      if (channel === 'cancel.all') {
        desktopApi.export.cancel().catch(() => {});
        return;
      }
    }
    if (channel === 'update-main-window-id' || channel === 'check-for-update') return;
    console.debug('[eagle-shim] ipc send', channel, params);
  };
  ipcRenderer.invoke = function (channel, params) {
    if (desktopApi) {
      if (channel === 'get-collect-window-data') return desktopApi.getCollectWindowData();
      if (channel === 'library:get-current' && desktopApi.library) return desktopApi.library.current();
      if (channel === 'item:set-custom-thumbnail' && desktopApi.thumbnail) return desktopApi.thumbnail.setCustom(params || {});
      if (channel === 'item:reset-custom-thumbnail' && desktopApi.thumbnail) return desktopApi.thumbnail.resetCustom(params || {});
      if (channel === 'item:refresh-thumbnail' && desktopApi.thumbnail) return desktopApi.thumbnail.refresh(params || {});
      if (channel === 'thumbnail-task:start' && desktopApi.thumbnail) return desktopApi.thumbnail.start(params || {});
      if (channel === 'thumbnail-task:status' && desktopApi.thumbnail) return desktopApi.thumbnail.status(params && (params.taskId || params.id) || params);
      if (channel === 'thumbnail-task:cancel' && desktopApi.thumbnail) return desktopApi.thumbnail.cancel(params && (params.taskId || params.id) || params);
      if ((channel === 'downloadWithNet' || channel === 'downloadWithRequest') && desktopApi.download) {
        return desktopApi.download.direct(params || {}).then((result) => result.path);
      }
      if (channel === 'download:direct' && desktopApi.download) return desktopApi.download.direct(params || {});
      if (channel === 'download:start' && desktopApi.download) return desktopApi.download.start(params || {});
      if (channel === 'download:status' && desktopApi.download) return desktopApi.download.status(params);
      if (channel === 'download:cancel' && desktopApi.download) return desktopApi.download.cancel(params);
      if (channel === 'download:release' && desktopApi.download) return desktopApi.download.release(params);
    }
    return EventEmitter.prototype.invoke.call(this, channel, params);
  };
  ipcRenderer.r2r = function (targetId, channel, params) {
    if (desktopApi && desktopApi.thumbnail) {
      if (channel === 'item.setCustomThumbnail') return desktopApi.thumbnail.setCustom(params || {});
      if (channel === 'item.refreshThumbnail') return desktopApi.thumbnail.refresh({ itemId: params && (params.itemId || params.id) });
    }
    return Promise.resolve(false);
  };
  if (desktopApi && typeof desktopApi.onIpc === 'function') {
    desktopApi.onIpc('show-item-in-folder', (value) => {
      if (desktopApi.export && desktopApi.export.reveal && window.__lastExportJobId) {
        runPreviewAction('show-item-in-folder', desktopApi.export.reveal(window.__lastExportJobId));
      }
    });
    desktopApi.onIpc('close-export-task', (value) => {
      const element = document.querySelector('file-export-progress');
      if (element && window.angular) {
        const fileScope = angular.element(element).isolateScope();
        if (fileScope) {
          fileScope.isExporting = false;
          fileScope.total = 0;
          fileScope.curr = 0;
          fileScope.timeLeftInSeconds = 0;
          fileScope.$evalAsync();
        }
      }
      mockEmit('close-export-task', value);
    });
    for (const channel of [
      'show-export-task',
      'finish-export-task',
      'show-archive-task',
      'add-archive-task',
      'update-archive-percent',
      'finish-archive-task',
      'abort-archive-task',
    ]) {
      desktopApi.onIpc(channel, (value) => mockEmit(channel, value));
    }
  }
  if (desktopApi && desktopApi.export) {
    if (typeof desktopApi.export.onProgress === 'function') {
      desktopApi.export.onProgress((progress) => {
        if (progress && progress.jobId) window.__lastExportJobId = progress.jobId;
      });
    }
    if (typeof desktopApi.export.onComplete === 'function') {
      desktopApi.export.onComplete((result) => {
        if (result && result.jobId) window.__lastExportJobId = result.jobId;
      });
    }
  }
  if (desktopApi && desktopApi.import) {
    if (typeof desktopApi.import.onFileProgress === 'function') {
      desktopApi.import.onFileProgress((job) => mockEmit('import-file-progress', job));
    }
    if (typeof desktopApi.import.onFolderProgress === 'function') {
      desktopApi.import.onFolderProgress((job) => mockEmit('import-folder-progress', job));
    }
  }
  if (desktopApi && desktopApi.library) {
    if (typeof desktopApi.library.onChanged === 'function') {
      desktopApi.library.onChanged((library) => mockEmit('library:changed', library));
    }
    if (typeof desktopApi.library.onOperationResult === 'function') {
      desktopApi.library.onOperationResult((result) => mockEmit('library:operation-result', result));
    }
  }
  if (desktopApi && desktopApi.item && typeof desktopApi.item.onOperationResult === 'function') {
    desktopApi.item.onOperationResult((result) => mockEmit('item:operation-result', result));
  }
  if (desktopApi && desktopApi.preview && typeof desktopApi.preview.onInit === 'function') {
    desktopApi.preview.onInit((payload) => mockEmit('init', payload));
  }

  const windowApi = () => (window.eagleDesktop && window.eagleDesktop.window) || null;
  const windowListeners = new Map();
  const windowState = (() => {
    const api = windowApi();
    return {
      maximized: api ? Boolean(api.isMaximized()) : false,
      fullScreen: api ? Boolean(api.isFullScreen()) : false,
    };
  })();

  function addWindowListener(channel, callback) {
    if (!windowListeners.has(channel)) windowListeners.set(channel, []);
    windowListeners.get(channel).push(callback);
  }

  function emitWindowEvent(channel, ...args) {
    (windowListeners.get(channel) || []).slice().forEach((callback) => {
      try {
        callback({}, ...args);
      } catch (err) {
        console.warn(`[eagle-shim] window listener error on ${channel}`, err);
      }
    });
  }

  (function wireWindowStateEvents() {
    const api = windowApi();
    if (!api || typeof api.onStateChanged !== 'function') return;
    api.onStateChanged((state) => {
      const previous = { ...windowState };
      if (typeof state.maximized === 'boolean') windowState.maximized = state.maximized;
      if (typeof state.fullScreen === 'boolean') windowState.fullScreen = state.fullScreen;
      if (windowState.maximized && !previous.maximized) emitWindowEvent('maximize');
      if (!windowState.maximized && previous.maximized) emitWindowEvent('unmaximize');
      if (windowState.fullScreen && !previous.fullScreen) emitWindowEvent('enter-full-screen');
      if (!windowState.fullScreen && previous.fullScreen) emitWindowEvent('leave-full-screen');
    });
  })();

  const currentWindow = {
    id: 1,
    getTitle: () => 'Eagle',
    isDestroyed: () => false,
    isMaximized: () => windowState.maximized,
    isFullScreen: () => windowState.fullScreen,
    hide() {
      const api = windowApi();
      if (api && typeof api.hide === 'function') api.hide();
    },
    show() {
      const api = windowApi();
      if (api && typeof api.show === 'function') api.show();
    },
    close() {
      const api = windowApi();
      if (api && typeof api.close === 'function') api.close();
    },
    minimize() {
      const api = windowApi();
      if (api && typeof api.minimize === 'function') api.minimize();
    },
    maximize() {
      const api = windowApi();
      if (api && typeof api.maximize === 'function') {
        api.maximize();
        windowState.maximized = true;
      }
    },
    unmaximize() {
      const api = windowApi();
      if (api && typeof api.unmaximize === 'function') {
        api.unmaximize();
        windowState.maximized = false;
      }
    },
    restore() {
      const api = windowApi();
      if (api && typeof api.unmaximize === 'function') {
        api.unmaximize();
        windowState.maximized = false;
      }
    },
    flashFrame() {},
    setFullScreen(value) {
      const api = windowApi();
      if (api && typeof api.setFullScreen === 'function') {
        api.setFullScreen(value);
        windowState.fullScreen = Boolean(value);
      }
    },
    setAlwaysOnTop(value) {
      const api = windowApi();
      if (api && typeof api.setAlwaysOnTop === 'function') api.setAlwaysOnTop(value);
    },
    getOpacity: () => 1,
    setOpacity() {},
    focus() {},
    blur() {},
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    setBounds() {},
    setMinimumSize() {},
    setSize() {},
    getSize: () => [1280, 720],
    on(channel, callback) {
      addWindowListener(channel, callback);
      return this;
    },
    once(channel, callback) {
      const wrap = (...args) => {
        this.removeListener(channel, wrap);
        callback(...args);
      };
      return this.on(channel, wrap);
    },
    addListener(channel, callback) {
      return this.on(channel, callback);
    },
    removeListener(channel, callback) {
      const list = windowListeners.get(channel) || [];
      windowListeners.set(channel, list.filter((entry) => entry !== callback));
      return this;
    },
    emit(channel, ...args) {
      emitWindowEvent(channel, ...args);
      return true;
    },
    webContents: {
      id: 1,
      send() {},
      canGoBack: () => false,
      canGoForward: () => false,
      goBack() {},
      goForward() {},
      loadURL() {},
      getURL: () => '',
      reload() {},
      stop() {},
      executeJavaScript() { return Promise.resolve(''); },
      on() {},
      once() {},
      setWindowOpenHandler() {},
    },
  };

  const app = {
    isPackaged: false,
    getPath: (name) => (name === 'home' ? '/mock-user-data' : '/mock-user-data'),
    getLocale: () => 'zh-CN',
    getName: () => 'Eagle',
    getVersion: () => '4.0.0',
    getAppPath: () => '/src',
    runningUnderARM64Translation: false,
    dock: { bounce() {}, show() {}, hide() {} },
    on() {},
    once() {},
    whenReady: () => Promise.resolve(),
    quit() {},
    exit() {},
  };

  const nativeTheme = { shouldUseDarkColors: false, on() {}, off() {} };
  function dialogOptions(first, second) {
    return second && typeof second === 'object' ? second : (first && typeof first === 'object' && !first.webContents ? first : {});
  }

  const dialog = {
    showOpenDialog(first, second) {
      const options = dialogOptions(first, second);
      if (desktopApi && desktopApi.dialog) return desktopApi.dialog.open(options);
      return Promise.resolve({ canceled: true, filePaths: [] });
    },
    showSaveDialog(first, second) {
      const options = dialogOptions(first, second);
      if (desktopApi && desktopApi.dialog) return desktopApi.dialog.save(options);
      return Promise.resolve({ canceled: true, filePath: '' });
    },
    showMessageBox: () => Promise.resolve({ response: 0 }),
  };

  class MenuItem {
    constructor(options = {}) {
      Object.assign(this, options);
      this.submenu = options.submenu || [];
    }

    append(item) {
      this.submenu.push(item);
    }
  }

  let applicationMenu = null;

  function getRoleClick(role) {
    const winApi = () => (window.eagleDesktop && window.eagleDesktop.window) || null;
    switch (role) {
      case 'reload':
        return () => {
          const api = winApi();
          if (api && typeof api.reload === 'function') api.reload();
          else window.location.reload();
        };
      case 'forceReload':
        return () => {
          const api = winApi();
          if (api && typeof api.forceReload === 'function') api.forceReload();
          else window.location.reload();
        };
      case 'toggleDevTools':
        return () => {
          const api = winApi();
          if (api && typeof api.toggleDevTools === 'function') api.toggleDevTools();
        };
      case 'resetZoom':
        return () => {
          const api = winApi();
          if (api && typeof api.resetZoom === 'function') api.resetZoom();
        };
      case 'zoomIn':
        return () => {
          const api = winApi();
          if (api && typeof api.zoomIn === 'function') api.zoomIn();
        };
      case 'zoomOut':
        return () => {
          const api = winApi();
          if (api && typeof api.zoomOut === 'function') api.zoomOut();
        };
      case 'minimize':
        return () => currentWindow.minimize();
      case 'close':
        return () => currentWindow.close();
      case 'quit':
        return () => {
          const api = winApi();
          if (api && typeof api.quit === 'function') api.quit();
          else currentWindow.close();
        };
      case 'undo':
        return () => document.execCommand('undo');
      case 'redo':
        return () => document.execCommand('redo');
      case 'cut':
        return () => document.execCommand('cut');
      case 'copy':
        return () => document.execCommand('copy');
      case 'paste':
        return () => document.execCommand('paste');
      case 'selectAll':
        return () => document.execCommand('selectAll');
      default:
        return null;
    }
  }

  function normalizeMenuItems(items) {
    return (Array.isArray(items) ? items : []).map((item) => {
      if (!item) return { role: 'separator' };
      if (item.type === 'separator' || item.role === 'separator') return { role: 'separator' };

      const normalized = { ...item };
      delete normalized.type;

      if (Array.isArray(normalized.submenu)) {
        normalized.submenu = { items: normalizeMenuItems(normalized.submenu), showSearch: false };
      } else if (normalized.submenu && Array.isArray(normalized.submenu.items)) {
        normalized.submenu = { ...normalized.submenu, items: normalizeMenuItems(normalized.submenu.items) };
      }

      if (normalized.enabled === false) normalized.disabled = true;
      if (typeof normalized.role === 'string') {
        const roleClick = getRoleClick(normalized.role);
        if (roleClick) normalized.click = roleClick;
        else if (!normalized.submenu) normalized.disabled = true;
        delete normalized.role;
      }

      return normalized;
    });
  }

  function createShimMenu(template) {
    const menu = { items: normalizeMenuItems(template || []), showSearch: false };
    menu.popup = () => {
      if (typeof ContextMenu !== 'undefined' && typeof ContextMenu.open === 'function') {
        ContextMenu.open({ items: menu.items, showSearch: false });
      }
    };
    menu.append = () => {};
    return menu;
  }

  const Menu = {
    buildFromTemplate: (template) => createShimMenu(template),
    setApplicationMenu(menu) {
      applicationMenu = menu;
    },
    getApplicationMenu: () => applicationMenu || createShimMenu([]),
  };

  class BrowserWindow {
    constructor() {
      this.webContents = {
        id: 2,
        on() {},
        send() {},
        executeJavaScript: () => Promise.resolve(''),
      };
      this.on = () => this;
      this.hide = () => this;
      this.show = () => this;
      this.destroy = () => this;
      this.close = () => this;
    }

    static fromId() {
      return null;
    }
  }

  const remote = {
    app,
    nativeTheme,
    systemPreferences: {},
    screen: {
      getCursorScreenPoint: () => ({ x: 0, y: 0 }),
      getPrimaryDisplay: () => ({
        bounds: { x: 0, y: 0, width: 1280, height: 720 },
        workArea: { x: 0, y: 0, width: 1280, height: 720 },
        scaleFactor: 1,
      }),
      getAllDisplays: () => [],
    },
    dialog,
    Menu,
    MenuItem,
    BrowserWindow,
    getCurrentWindow: () => currentWindow,
    getCurrentWebContents: () => currentWindow.webContents,
    require: (id) => (String(id || '').includes('electron-log') ? electronLog : {}),
  };

  function readDesktopClipboardSync() {
    if (!desktopApi || !desktopApi.clipboard || typeof desktopApi.clipboard.readSync !== 'function') {
      return { text: '', imageDataUrl: '', filePaths: [], formats: [] };
    }
    try {
      return desktopApi.clipboard.readSync() || { text: '', imageDataUrl: '', filePaths: [], formats: [] };
    } catch (err) {
      return { text: '', imageDataUrl: '', filePaths: [], formats: [] };
    }
  }

  function clipboardImageFromDataUrl(dataUrl) {
    const match = /^data:image\/[^;,]+;base64,(.*)$/s.exec(String(dataUrl || ''));
    const bytes = match ? BrowserBuffer.from(atob(match[1])) : BrowserBuffer.alloc(0);
    return {
      isEmpty: () => bytes.length === 0,
      toPNG: () => bytes,
      toJPEG: () => bytes,
      toDataURL: () => dataUrl || '',
      getSize: () => ({ width: bytes.length > 0 ? 1 : 0, height: bytes.length > 0 ? 1 : 0 }),
    };
  }

  const electron = {
    ipcRenderer,
    webFrame: {
      setZoomFactor(factor) {
        if (nativeRequire) {
          try {
            const nativeWebFrame = nativeRequire('electron').webFrame;
            if (nativeWebFrame && typeof nativeWebFrame.setZoomFactor === 'function') {
              nativeWebFrame.setZoomFactor(Number(factor) || 1);
              return;
            }
          } catch (err) {
            // Fall back to the browser shim below.
          }
        }
        const zoom = String(Number(factor) || 1);
        if (document.body) document.body.style.zoom = zoom;
        else if (document.documentElement) document.documentElement.style.zoom = zoom;
      },
      getZoomFactor() {
        if (nativeRequire) {
          try {
            const nativeWebFrame = nativeRequire('electron').webFrame;
            if (nativeWebFrame && typeof nativeWebFrame.getZoomFactor === 'function') {
              return nativeWebFrame.getZoomFactor();
            }
          } catch (err) {
            // Fall through to the browser shim.
          }
        }
        return Number((document.body && document.body.style.zoom) || (document.documentElement && document.documentElement.style.zoom)) || 1;
      },
      getResourceUsage: () => ({ images: { count: 0, liveSize: 0 } }),
    },
    clipboard: {
      writeText(text) {
        if (desktopApi && desktopApi.item && isCurrentPreviewRawPath(text)) {
          runPreviewAction('copy-path', desktopApi.item.copyPath(previewCurrentItemId()));
        }
      },
      readText: () => readDesktopClipboardSync().text || '',
      writeImage() {},
      readImage: () => clipboardImageFromDataUrl(readDesktopClipboardSync().imageDataUrl),
      clear() {},
      availableFormats: () => readDesktopClipboardSync().formats || [],
    },
    shell: {
      openExternal: () => Promise.resolve(),
      openPath: () => Promise.resolve(''),
      showItemInFolder() {},
      beep() {},
    },
  };

  function writeFileAtomic(file, data, cb) {
    const target = String(file || '').replace(/\\/g, '/');
    if (desktopApi && desktopApi.library && target.endsWith('/saved-filters.json')) {
      // Electron 下把原版 writeFileAtomic 的 saved-filters 写入转接到受控结构接口。
      let savedFilters;
      try {
        savedFilters = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (err) {
        if (typeof cb === 'function') setTimeout(() => cb(err), 0);
        return;
      }
      if (!Array.isArray(savedFilters)) {
        const err = new Error('Saved filters must be an array');
        if (typeof cb === 'function') setTimeout(() => cb(err), 0);
        return;
      }
      desktopApi.library.updateStructure({
        libraryPath: window.__mockLibrary && (window.__mockLibrary.rootDir || window.__mockLibrary.path),
        savedFilters,
      }).then(() => {
        if (window.__mockLibrary) window.__mockLibrary.savedFilters = savedFilters;
        if (typeof cb === 'function') cb(null);
      }).catch((err) => {
        if (typeof cb === 'function') cb(err);
      });
      return;
    }
    if (desktopApi && desktopApi.library && target.endsWith('/tags.json')) {
      let tags;
      try {
        tags = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (err) {
        if (typeof cb === 'function') setTimeout(() => cb(err), 0);
        return;
      }
      desktopApi.library.updateStructure({
        libraryPath: window.__mockLibrary && (window.__mockLibrary.rootDir || window.__mockLibrary.path),
        tags,
      }).then(() => {
        if (window.__mockLibrary) window.__mockLibrary.tags = tags;
        if (typeof cb === 'function') cb(null);
      }).catch((err) => {
        if (typeof cb === 'function') cb(err);
      });
      return;
    }
    if (typeof cb === 'function') setTimeout(cb, 0);
  }

  function genericStub(name) {
    const stub = function () { return stub; };
    stub.__mockName = String(name || 'module');
    ['forEach', 'map', 'filter', 'reduce', 'then', 'catch', 'finally', 'on', 'once', 'off'].forEach((key) => {
      if (!stub[key]) stub[key] = function () { return stub; };
    });
    return stub;
  }

  const lineByLineMock = class LineByLineMock {
    constructor(filePath, options) {
      let lines = [];
      if (nativeFs) {
        try {
          lines = nativeFs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
        } catch (err) {
          lines = [];
        }
      }
      if (lines.length === 0) {
        const items = (window.__mockLibraryCache || []).slice();
        lines = items.map((item) => JSON.stringify(item));
      }
      this.lines = lines;
      this.index = 0;
    }

    next() {
      if (this.index >= this.lines.length) return false;
      return this.lines[this.index++];
    }

    close() {}
  };

  function localAssetUrl(value) {
    const target = String(value || '');
    if (/^https?:\/\//i.test(target)) return target;
    if (/^(?:[a-zA-Z]:[\\/]|\\\\)/.test(target)) {
      if (window.location && /^https?:$/.test(window.location.protocol)) {
        return `${window.location.origin}/file/${encodeURIComponent(target)}`;
      }
      if (desktopApi && typeof desktopApi.thumbnailUrl === 'function') {
        return desktopApi.thumbnailUrl(target);
      }
      return `${window.location.origin}/file/${encodeURIComponent(target)}`;
    }
    return new URL(target.replace(/^file:\/\//, ''), window.location.origin).href;
  }

  const urlModule = {
    pathToFileURL(p) {
      return new URL(localAssetUrl(p));
    },
    fileURLToPath(u) {
      const value = String(u || '');
      try {
        const parsed = new URL(value);
        if (/^https?:$/i.test(parsed.protocol) && parsed.searchParams.has('filePath')) {
          return parsed.searchParams.get('filePath');
        }
        if (/^https?:$/i.test(parsed.protocol) && parsed.pathname.startsWith('/file/')) {
          return decodeURIComponent(parsed.pathname.slice('/file/'.length));
        }
      } catch (err) {}
      return value.replace(/^file:\/\//, '');
    },
    format(u) {
      return String(u || '');
    },
  };

  class JsonRestServerStub {
    constructor(options) {
      this.options = options || {};
    }

    addAPI() {}
    addHandler() {}
    start(callback) {
      if (typeof callback === 'function') setTimeout(callback, 0);
      return Promise.resolve(this);
    }
    stop() {}
  }

  const pluginModule = {
    plugins: [],
    pinnedPlugins: [],
    pluginWindowIds: [],
    pluginShortcuts: {},
    installedPluginMaps: {},
    needUpdatePluginMaps: {},
    servicePlugins: {},
    disabledPluginMaps: {},
    pluginMenu: { submenu: [] },
    previewExtension: {
      inspectorPlugins: [],
      inspectorPluginsMap: {},
      inspectorPluginPathMap: {},
      thumbnailPluginMap: {},
      thumbnailPath: {},
      thumbnailOptions: {},
      viewerPluginMap: {},
      viewerURL: {},
      getViewerPlugin: () => undefined,
      getViewerPluginExt(item) {
        if (!item) return undefined;
        if (this.viewerPluginMap && this.viewerPluginMap[item.ext]) return 'plugin';
        const imageTypes = {
          jpg: true, jpeg: true, png: true, webp: true, avif: true, insp: true,
          jfif: true, jpe: true, jxl: true, bmp: true, tif: true, tiff: true,
          hif: true, heif: true, heic: true,
        };
        if (imageTypes[item.ext]) return 'image';
        if (item.customThumbnail && window.EagleConfig && !window.EagleConfig.SUPPORT_FORMATS[item.ext]) return 'custom';
        return item.ext;
      },
      allowZoom: () => false,
      getInspectorPluginURL: () => '',
      hasInspectorPlugin: () => false,
      getMultiSelectInspectorPlugin: () => [],
    },
    isPluginDisabled: () => false,
    loadDisabledPlugins() {},
    saveDisabledPlugins() {},
    init: () => Promise.resolve(),
    initIPC() {},
    initServicePlugins() {},
    initShortcuts() {},
    initMenu() {},
    checkAllDependencies() {},
    refresh: () => Promise.resolve(),
    refreshInstalledPlugins() {},
    checkPluginInstalled: () => false,
    showInstallPluginDialog() {},
    openPluginById() {},
    showPluginById() {},
    isOpen: () => false,
    isVisible: () => false,
    getLastOpenedPlugins: () => [],
    addToLastOpenedPlugins() {},
    create: () => Promise.resolve(),
    open() {},
    openPreview() {},
    pinPlugin() {},
    unpinPlugin() {},
    reloadPlugin: () => Promise.resolve(),
    packPlugin: () => Promise.resolve(),
    enablePlugin() {},
    disablePlugin() {},
    destroyPlugin() {},
    destoryPlugin() {},
    localPlugin: { load: () => Promise.resolve(), uninstall: () => Promise.resolve() },
    remotePlugin: { install: () => Promise.resolve(), uninstall: () => Promise.resolve() },
  };

  const settingsMemory = {};
  const settingsPrefix = 'eagle.reverse.settings.';
  const preferencesSettingKey = 'preferences';
  const broadcastSettingKey = 'broadcast';
  function readSetting(key) {
    if (Object.prototype.hasOwnProperty.call(settingsMemory, key)) return settingsMemory[key];
    try {
      const raw = localStorage.getItem(settingsPrefix + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (err) {
      return undefined;
    }
  }
  function writeSetting(key, value) {
    settingsMemory[key] = value;
    try {
      localStorage.setItem(settingsPrefix + key, JSON.stringify(value));
    } catch (err) {
      // Keep the in-memory value when storage is unavailable.
    }
    if (desktopApi && desktopApi.library && key === 'libraryHistory') {
      desktopApi.library.setHistory(value).catch(() => {});
    }
  }

  function cloneValue(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function mergePreferenceValue(target, source) {
    if (source === undefined || source === null) return cloneValue(target);
    if (Array.isArray(target) || Array.isArray(source)) return cloneValue(source);
    if (typeof target !== 'object' || typeof source !== 'object') return cloneValue(source);
    const result = cloneValue(target) || {};
    for (const key of Object.keys(source)) {
      result[key] = mergePreferenceValue(result[key], source[key]);
    }
    return result;
  }

  function defaultPreferences() {
    const defaults = cloneValue(loadJsModule('/src/app/js/default-preferences.js')) || {};
    defaults.general = { ...(defaults.general || {}), language: 'zh_CN' };
    defaults.theme = { ...(defaults.theme || {}), name: 'DARK', css: 'dark' };
    return defaults;
  }

  let activePreferences = null;

  function replaceActivePreferences(next) {
    if (!activePreferences) {
      activePreferences = next;
      return activePreferences;
    }
    Object.keys(activePreferences).forEach((key) => delete activePreferences[key]);
    Object.assign(activePreferences, next);
    return activePreferences;
  }

  function currentPreferences(forceReload) {
    if (activePreferences && !forceReload) return activePreferences;
    if (forceReload) delete settingsMemory[preferencesSettingKey];
    const defaults = defaultPreferences();
    const saved = readSetting(preferencesSettingKey);
    return replaceActivePreferences(
      saved && typeof saved === 'object' ? mergePreferenceValue(defaults, saved) : defaults
    );
  }

  function savePreferences(value) {
    const merged = mergePreferenceValue(currentPreferences(), value || {});
    const next = replaceActivePreferences(merged);
    writeSetting(preferencesSettingKey, next);
    syncNativePreferences(next);
    return next;
  }

  function syncNativePreferences(preferences) {
    if (!nativeRequire) return;
    try {
      nativeRequire('electron').ipcRenderer.send('preferences:update', preferences);
    } catch (err) {
      // The native preferences bridge is optional in browser preview mode.
    }
  }

  function applyPreferencesToCurrentDocument() {
    delete settingsMemory[preferencesSettingKey];
    const preferences = currentPreferences(true);
    if (window.__eagleMockI18n) window.__eagleMockI18n.reload();
    mockEmit('update-preferences');
    if (preferences.theme && preferences.theme.name) mockEmit('change.current.theme', preferences.theme);
    if (preferences.general && preferences.general.zoom) mockEmit('change.zoom', preferences.general.zoom);
    if (preferences.general && typeof window.languageBCP !== 'undefined') {
      window.languageBCP = String(preferences.general.language || 'en').replace('_', '-');
    }
    try {
      if (window.angular && angular.element(document.body).scope) {
        const scope = angular.element(document.body).scope();
        if (scope) {
          scope.preferences = preferences;
          if (preferences.theme && scope.theme !== undefined) scope.theme = preferences.theme.css || 'gray';
          if (preferences.general && scope.language !== undefined) scope.language = preferences.general.language || 'en';
          if (typeof scope.$evalAsync === 'function') scope.$evalAsync();
        }
      }
    } catch (err) {
      // Angular may not be ready on pages that only use the shim.
    }
  }

  function broadcastIpc(channel, params) {
    mockEmit(channel, params);
    try {
      localStorage.setItem(settingsPrefix + broadcastSettingKey, JSON.stringify({ channel, params, at: Date.now() }));
    } catch (err) {
      // Cross-window sync is best-effort; the current window already received the event.
    }
  }

  function handleSettingsStorage(event) {
    if (!event || !event.key) return;
    if (event.key === settingsPrefix + preferencesSettingKey) {
      applyPreferencesToCurrentDocument();
      return;
    }
    if (event.key === settingsPrefix + broadcastSettingKey) {
      try {
        const payload = JSON.parse(event.newValue || 'null');
        if (payload && payload.channel && Date.now() - payload.at < 5000) {
          mockEmit(payload.channel, payload.params);
        }
      } catch (err) {
        // Ignore malformed broadcast payloads.
      }
    }
  }

  const electronSettings = {
    getPreferences: currentPreferences,
    getSync(key) {
      const value = readSetting(key);
      if (value !== undefined) return value;
      if (key === 'colorSpace') return 'Unmanaged';
      if (key === 'libraryHistory') {
        const current = window.__mockLibrary && window.__mockLibrary.rootDir;
        return current ? [current] : [];
      }
      return undefined;
    },
    setSync(key, value) {
      writeSetting(key, value);
      if (key === preferencesSettingKey) {
        applyPreferencesToCurrentDocument();
        syncNativePreferences(currentPreferences());
      }
    },
    get(key) { return Promise.resolve(this.getSync(key)); },
    set(key, value) {
      this.setSync(key, value);
      return Promise.resolve(value);
    },
    has: (key) => readSetting(key) !== undefined,
    delete(key) {
      delete settingsMemory[key];
      try { localStorage.removeItem(settingsPrefix + key); } catch (err) {}
      if (key === preferencesSettingKey) activePreferences = null;
    },
    clear() {
      Object.keys(settingsMemory).forEach((key) => delete settingsMemory[key]);
      activePreferences = null;
    },
  };

  window.addEventListener('storage', handleSettingsStorage);

  class MockI18n {
    constructor() {
      this.locale = 'zh_CN';
      this.translations = this.load(this.locale);
      window.__eagleMockI18n = this;
      if (Object.keys(this.translations).length === 0) {
        const retry = setInterval(() => {
          const loaded = this.load(this.locale);
          if (Object.keys(loaded).length > 0) {
            this.translations = loaded;
            clearInterval(retry);
          }
        }, 50);
        setTimeout(() => clearInterval(retry), 3000);
      }
    }

    load(locale) {
      const raw = syncText(`/src/i18n/${locale}.js`);
      const text = raw ? raw.split(/\r?\n\/\/# sourceMappingURL=/)[0] : null;
      if (text === null) return {};
      try {
        return JSON.parse(text);
      } catch (err) {
        console.warn('[eagle-shim] failed to parse i18n', locale, err);
        return {};
      }
    }

    __(phrase) {
      return this.translations[phrase] !== undefined ? this.translations[phrase] : phrase;
    }

    reload() {
      const preferences = electronSettings.getPreferences() || {};
      const locale = (preferences.general && preferences.general.language) || 'zh_CN';
      this.locale = locale;
      this.translations = this.load(locale);
    }
  }

  const bareModules = {
    'electron': electron,
    '@electron/remote': remote,
    'path': nativePath || pathModule,
    'node:path': nativePath || pathModule,
    'url': urlModule,
    'node:url': urlModule,
    'fs': nativeFs || fsModule,
    'os': osModule,
    'console': console,
    'crypto': {
      randomUUID: () => 'mock-uuid-' + Math.random().toString(36).slice(2),
      randomBytes: (size) => BrowserBuffer.alloc(size || 16),
      createHash: () => ({ update() { return this; }, digest: () => BrowserBuffer.alloc(32) }),
    },
    'child_process': {
      execSync: () => BrowserBuffer.from(''),
      exec() {},
      spawnSync: () => ({ stdout: BrowserBuffer.from(''), status: 0 }),
      spawn: () => ({ on() {}, stdout: { on() {} }, stderr: { on() {} } }),
    },
    'fs-extra': nativeFs || fsModule,
    'async': {
      each() {},
      eachOf() {},
      eachLimit() {},
      eachOfLimit() {},
      map() {},
      series() {},
      parallel() {},
      waterfall() {},
      queue: () => ({ push() {}, drain() {} }),
    },
    'request': Object.assign(function request() {}, { get() {}, post() {}, put() {}, del() {} }),
    'mpv-video-player': {
      MpvVideoElement: { use() {} },
      defaultPlugins: [],
      ABLoopPlugin: {},
    },
    'auto-launch': class AutoLaunchMock {
      constructor() {
        this._enabled = readSetting('autoLaunch') === true;
      }
      enable() {
        this._enabled = true;
        writeSetting('autoLaunch', true);
        return Promise.resolve();
      }
      disable() {
        this._enabled = false;
        writeSetting('autoLaunch', false);
        return Promise.resolve();
      }
      isEnabled() {
        return Promise.resolve(this._enabled);
      }
    },
    'color-convert': {},
    'delta-e': { getDeltaE76: () => 0, getDeltaE00: () => 0 },
    'tiny-pinyin': { convertToPinyin: (text) => String(text || '').split('').join('') },
    'pinyinlite': { searchAll: () => [] },
    'read-chunk': () => BrowserBuffer.alloc(0),
    'write-file-atomic': writeFileAtomic,
    'cartesian-product': () => [],
    'sanitize-filename': (name) => String(name || '').replace(/[\\/:*?"<>|]/g, '-'),
    'normalize-strings': (text) => String(text || ''),
    'chinese_convert': { t2s: (s) => s, s2t: (s) => s, convert: (s) => s },
    'isnumber': () => false,
    'moment': (value) => new Date(value || Date.now()),
    'cancellation': () => ({ token: {} }),
    'fast-glob': () => Promise.resolve([]),
    'archiver': () => ({
      on() { return this; },
      pipe() { return this; },
      append() { return this; },
      directory() { return this; },
      finalize() { return this; },
    }),
    'electron-log': electronLog,
  };

  const moduleCache = new Map();
  const appRootModule = {
    path: '/src',
    toString: () => '/src',
  };

  function loadJsModule(urlPath) {
    if (moduleCache.has(urlPath)) return moduleCache.get(urlPath).exports;
    const source = syncText(urlPath);
    if (source === null) {
      const stub = genericStub(urlPath);
      moduleCache.set(urlPath, { exports: stub });
      return stub;
    }
    const module = { exports: {} };
    const fn = new Function(
      'module',
      'exports',
      'require',
      'process',
      'global',
      'Buffer',
      '__filename',
      '__dirname',
      source
    );
    try {
      fn(module, module.exports, require, window.process, window, window.Buffer, urlPath, dirname(urlPath));
    } catch (err) {
      console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
      module.exports = genericStub(urlPath);
    }
    moduleCache.set(urlPath, module);
    return module.exports;
  }

  function loadOriginalModule(urlPath) {
    try {
      return loadJsModule(urlPath);
    } catch (err) {
      console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
      return undefined;
    }
  }

  // 加载反编译目录中的真实拼音/简繁模块，保证原版快捷搜索的拼音与简繁路径可工作。
  const pinyinliteDict = loadOriginalModule('/src/my_modules/pinyinlite/src/dict_full.js');
  const pinyinliteFactory = loadOriginalModule('/src/my_modules/pinyinlite/src/pinyin.js');
  const pinyinlite = typeof pinyinliteFactory === 'function' && pinyinliteDict
    ? pinyinliteFactory(pinyinliteDict)
    : function pinyinliteFallback() { return []; };
  pinyinlite.searchAll = function searchAllFallback() { return []; };

  const tw2cnMap = loadOriginalModule('/src/my_modules/chinese_convert/tw2cn.js');
  const cn2twMap = loadOriginalModule('/src/my_modules/chinese_convert/cn2tw.js');
  function convertByMap(text, map) {
    if (typeof text !== 'string' || !map) return text || '';
    let result = '';
    for (const ch of text) result += map[ch] === undefined ? ch : map[ch];
    return result;
  }
  const chineseConvert = {
    charMap(ch, map) { return map && map[ch] !== undefined ? map[ch] : ch; },
    textMap(text, map) { return convertByMap(text, map); },
    cn2tw(text) { return convertByMap(text, cn2twMap); },
    tw2cn(text) { return convertByMap(text, tw2cnMap); },
    t2s(text) { return convertByMap(text, tw2cnMap); },
    s2t(text) { return convertByMap(text, cn2twMap); },
    convert(text, mode) {
      return mode === 's2t' || mode === 'cn2tw' ? convertByMap(text, cn2twMap) : convertByMap(text, tw2cnMap);
    },
  };

  const tinyPinyin = loadOriginalModule('/src/my_modules/tiny-pinyin/index.js') || {
    convertToPinyin: (text) => String(text || '').split('').join(''),
  };
  const cartesianProduct = loadOriginalModule('/src/my_modules/cartesian-product/index.js') || (() => []);

  bareModules['tiny-pinyin'] = tinyPinyin;
  bareModules['pinyinlite'] = pinyinlite;
  bareModules['chinese_convert'] = chineseConvert;
  bareModules['cartesian-product'] = cartesianProduct;
  window.tinyPinyin = window.tinyPinyin || tinyPinyin;
  window.pinyinlite = window.pinyinlite || pinyinlite;
  window.chineseConvert = window.chineseConvert || chineseConvert;

  function require(request) {
    const req = String(request || '').replace(/\\/g, '/');
    if (isElectronRuntime && nativeRequire && (req === 'fs' || req === 'node:fs' || req === 'path' || req === 'node:path')) {
      return nativeRequire(req);
    }
    if (req === 'app-root-path') return appRootModule;
    if (bareModules[req] !== undefined) return bareModules[req];
    if (req === '/src/i18n' || req === '/src/i18n/index.js') return MockI18n;
    if (req.startsWith('/src/')) {
      if (req.endsWith('/my_modules/electron-settings')) return electronSettings;
      if (req.endsWith('/my_modules/url')) return urlModule;
      if (req.endsWith('/my_modules/json-rest-light')) return { JsonRestServer: JsonRestServerStub };
      if (req.endsWith('/app/js/api-server-v2')) return { initAPIServerV2() {} };
      if (req.endsWith('/app/js/plugin')) return pluginModule;
      if (req.endsWith('/app/js/plugins/eagle-note-plugin')) return {};
      if (req.endsWith('/my_modules/n-readlines')) return lineByLineMock;
      if (req.endsWith('/my_modules/appdata-path')) return () => '/mock-user-data';
      if (req.endsWith('/my_modules/junk')) return { not: () => true, is: () => false };
      if (req.endsWith('/my_modules/is-hidden-file')) return { check: () => false };
      if (req.endsWith('/my_modules/file-icon')) return { getFileIcon: () => Promise.resolve({}), getFileIconSync: () => null };
      if (req.endsWith('/my_modules/is-directory')) return {
        check: (target) => {
          if (!nativeFs) return false;
          try { return nativeFs.statSync(target).isDirectory(); } catch (err) { return false; }
        },
        checkSync: (target) => {
          if (!nativeFs) return false;
          try { return nativeFs.statSync(target).isDirectory(); } catch (err) { return false; }
        },
      };
      if (req.endsWith('/my_modules/access')) return { checkALCs: () => true, checkAccess: () => true, checkACL: () => true };
      if (req.endsWith('/app/js/utils/remainingFilenameLength.js')) return () => 240;
      if (req.endsWith('/app/js/utils/getBestURL.js')) return () => '';
      if (req.endsWith('/app/js/utils/is-accelerator.js')) return () => true;
      if (req.endsWith('/app/js/utils/unorm.js')) return { nfc: (s) => s, nfd: (s) => s };
      if (req.endsWith('/app/js/utils/flipImage.js')) return () => {};
      if (req.endsWith('/app/js/utils/rotateImage.js')) return () => {};
      if (req.endsWith('/my_modules/tiny-pinyin')) return bareModules['tiny-pinyin'];
      if (req.endsWith('/my_modules/pinyinlite')) return bareModules['pinyinlite'];
      if (req.endsWith('/my_modules/cartesian-product')) return bareModules['cartesian-product'];
      if (req.endsWith('/my_modules/sanitize-filename')) return bareModules['sanitize-filename'];
      if (req.endsWith('/my_modules/chinese_convert')) return bareModules['chinese_convert'];
      if (req.endsWith('/my_modules/get-drive-type')) return () => 'local';
      if (req.endsWith('/my_modules/curl-request')) return { get: () => Promise.resolve(''), post: () => Promise.resolve('') };
      if (req.endsWith('/my_modules/downloadFile')) return { download: () => Promise.resolve() };
      if (req.endsWith('/my_modules/vtt2srt')) return () => {};
      if (req.endsWith('/my_modules/bplist-parse')) return () => '';
      if (req.endsWith('/my_modules/heif/native')) return {};
      if (req.endsWith('/my_modules/image-cropper')) return () => {};
      if (req.endsWith('/my_modules/get-associated-application')) return () => Promise.resolve([]);
      if (req.endsWith('/my_modules/image-size')) return () => null;
      if (req.endsWith('.json')) {
        const text = syncText(req);
        return text === null ? {} : JSON.parse(text);
      }
      return loadJsModule(req);
    }
    return genericStub(req);
  }

  window.process = {
    platform: 'win32',
    arch: 'x64',
    env: { SYSTEMROOT: 'C:\\Windows' },
    resourcesPath: '/mock-resources',
    versions: { electron: '22.3.7', node: '22.0.0' },
    release: '10.0.22631',
    getProcessMemoryInfo: () => Promise.resolve({ workingSetSize: 0 }),
    getSystemMemoryInfo: () => ({ total: 0 }),
    getCPUUsage: () => ({ percentCPUUsage: 0 }),
    cwd: () => '/src',
    pid: 1,
    ppid: 0,
    on() {},
    once() {},
    removeListener() {},
    nextTick: (callback, ...args) => setTimeout(() => callback(...args), 0),
  };

  window.Buffer = BrowserBuffer;
  window.global = window;
  window.global.EAGLE_THUMBNAIL_TEMP_PATH = '/mock-thumbnails';
  window.require = require;
  window.__eagleRequire = require;
  window.electron = electron;
  window.$$electronIpc = ipcRenderer;
  window.__eagleIpc = ipcRenderer;
  window.__eagleSyncText = syncText;
  window.electronSettings = electronSettings;
  if (nativeRequire) {
    setTimeout(() => syncNativePreferences(currentPreferences()), 250);
  }
  window.pluginModule = pluginModule;
  window.tinyPinyin = bareModules['tiny-pinyin'];
  window.pinyinlite = bareModules['pinyinlite'];

  const tinyPinyinGuard = setInterval(() => {
    if (!window.tinyPinyin || typeof window.tinyPinyin.convertToPinyin !== 'function') {
      window.tinyPinyin = bareModules['tiny-pinyin'];
    }
    if (typeof window.pinyinlite !== 'function') {
      window.pinyinlite = bareModules['pinyinlite'];
    }
  }, 50);
  setTimeout(() => clearInterval(tinyPinyinGuard), 6000);

  async function pollDuplicateJob(jobId, cancelToken, onProgress, total) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (cancelToken && typeof cancelToken.isCancelled === 'function' && cancelToken.isCancelled()) {
        if (desktopApi && desktopApi.duplicates) desktopApi.duplicates.cancel(jobId).catch(() => {});
        return { cancelled: true, groups: [] };
      }
      const job = await desktopApi.duplicates.status(jobId);
      if (job.status === 'complete') {
        if (typeof onProgress === 'function' && total > 0) onProgress(total, total);
        return job.result || { groups: [] };
      }
      if (job.status === 'error') throw new Error(job.message || 'Duplicate scan failed');
      if (job.status === 'cancelled') return { cancelled: true, groups: [] };
      if (typeof onProgress === 'function' && total > 0) {
        onProgress(Math.round((total * Number(job.progress || 0)) / 100), total);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error('Duplicate scan timeout');
  }

  function enrichDuplicateGroups(groups, sourceItems) {
    const mapping = new Map((sourceItems || []).map((item) => [item.id, item]));
    return (groups || []).map((group) => ({
      ...group,
      items: (group.items || []).map((entry) => mapping.get(entry.id) || entry),
    }));
  }

  function patchDuplicateChecker() {
    if (!window.eagle) return;
    if (window.eagle.duplicateChecker && window.eagle.duplicateChecker.__shimmed) return;
    if (!desktopApi || !desktopApi.duplicates) return;
    window.eagle.duplicateChecker = {
      __shimmed: true,
      async findDuplicateFiles(items, cancelToken, options = {}) {
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
        const list = Array.isArray(items) ? items : [];
        const job = await desktopApi.duplicates.scan({
          method: 'same',
          ids: list.map((item) => item.id),
          async: true,
        });
        const result = await pollDuplicateJob(job.id, cancelToken, onProgress, list.length);
        if (result.cancelled) return { cancel: true, groups: [] };
        return { groups: enrichDuplicateGroups(result.groups, list) };
      },
      async findSimilarFiles(items, cancelToken, options = {}) {
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
        const list = Array.isArray(items) ? items : [];
        // 本轮只承诺 exact；similar 不返回伪造结果。
        if (typeof onProgress === 'function' && list.length > 0) onProgress(list.length, list.length);
        return { groups: [], fingerprintMap: {} };
      },
    };
  }

  const duplicateCheckerGuard = setInterval(() => {
    if (window.eagle && window.eagle.duplicateChecker && desktopApi && desktopApi.duplicates) patchDuplicateChecker();
  }, 100);
  setTimeout(() => clearInterval(duplicateCheckerGuard), 8000);

  let capturePollStarted = false;
  let capturePollLibraryPath = '';
  function startCapturePolling() {
    if (capturePollStarted || !desktopApi || !desktopApi.library || typeof desktopApi.library.current !== 'function') return;
    const pagePath = window.location.pathname || '';
    if (!pagePath.endsWith('/src/app/index.html')) return;
    capturePollStarted = true;
    const known = new Set();
    (window.__mockLibraryCache || []).forEach((item) => {
      if (item && item.id) known.add(item.id);
    });
    const tick = async () => {
      try {
        const library = await desktopApi.library.current();
        const items = Array.isArray(library.items) ? library.items : [];
        const nextPath = library.path || library.rootDir || '';
        if (capturePollLibraryPath && capturePollLibraryPath !== nextPath) known.clear();
        capturePollLibraryPath = nextPath;
        const cachedIds = new Set((window.__mockLibraryCache || []).map((item) => item && item.id).filter(Boolean));
        let rawIds = new Set();
        try {
          const scope = window.angular ? angular.element(document.body).scope() : null;
          rawIds = new Set((scope && Array.isArray(scope.raw) ? scope.raw : []).map((item) => item && item.id).filter(Boolean));
        } catch (err) {
          // Ignore scope access failures; the cache check still protects against local imports.
        }
        const fresh = items.filter((item) => item && item.id && !known.has(item.id) && !cachedIds.has(item.id) && !rawIds.has(item.id));
        if (fresh.length > 0) {
          fresh.forEach((item) => known.add(item.id));
          emitImportedItems(fresh, 'browser-capture');
          mockEmit('library:changed', library);
        }
      } catch (err) {
        // Polling is best effort; the next lifecycle or user action will reload the library.
      }
    };
    setInterval(tick, 700);
  }

  function emitMockLifecycle() {
    const lib = window.__mockLibrary || {
      rootDir: '/mock-library/Eagle Reverse Demo.library',
      imagesDir: '/mock-library/Eagle Reverse Demo.library/images/',
      folders: [],
      smartFolders: [],
      quickAccess: [],
      tagsGroups: [],
    };
    const items = window.__mockLibraryCache || [];
    const registration = {
      activated: true,
      machineID: 'preview',
      license: { email: 'preview@eagle.local' },
    };
    const pagePath = window.location.pathname || '';

    if (pagePath.includes('font-viewer') || pagePath.includes('text-editor') || pagePath.includes('gif-viewer')) {
      const noop = () => {};
      const viewerMethods = {
        removeStar: noop,
        changeTo1Star: noop,
        changeTo2Star: noop,
        changeTo3Star: noop,
        changeTo4Star: noop,
        changeTo5Star: noop,
        selectPrev: noop,
        selectNext: noop,
        escHandler: noop,
        activateFont: noop,
        deactivateFont: noop,
        isFontActivate: () => false,
        imagesChange: noop,
        $evalAsync: noop,
        $eavlAsync: noop,
      };
      window.$bodyScope = {
        ...viewerMethods,
        preferences: { general: { language: 'zh_CN' } },
        imagesDir: '/mock-library/Eagle Reverse Demo.library/images/',
        inspector: { newName: '' },
        gifViewer: {
          onFinished: (data) => console.debug('[eagle-shim] gif viewer finished', data && data.frames ? data.frames.length : 0),
          onProgress: (progress, length) => console.debug('[eagle-shim] gif viewer progress', progress, length),
        },
        current: {
          id: pagePath.includes('font-viewer') ? 'MOCK-FONT' : 'MOCK0001',
          name: pagePath.includes('font-viewer') ? 'LiberationSans-Regular' : 'Sample Notes',
          ext: pagePath.includes('font-viewer') ? 'ttf' : 'txt',
          star: 5,
          tags: ['UI'],
          fontMetas: {
            support: {},
            fontFamily: { en: 'Liberation Sans', zh_CN: 'Liberation Sans' },
            postScriptName: { en: 'LiberationSans-Regular' },
            fullName: { en: 'Liberation Sans' },
            version: { en: '2.00.1' },
            designer: { en: 'Red Hat, Inc.' },
            manufacturer: { en: 'Red Hat, Inc.' },
            license: { en: 'SIL Open Font License' },
            numGlyphs: 3257,
          },
        },
      };
    }

    if (pagePath.includes('model-viewer')) {
      window.hasCallback = true;
      try {
        Object.defineProperty(window, 'frameElement', {
          configurable: true,
          value: {
            getAttribute: () => null,
          },
        });
      } catch (err) {
        console.warn('[eagle-shim] failed to mock frameElement', err);
      }
    }

    if (pagePath.includes('preferences.html')) {
      const query = new URLSearchParams(window.location.search);
      setTimeout(() => {
        ipcRenderer.emit('init', {
          Registration: registration,
          panel: query.get('panel') || '',
          keyword: query.get('keyword') || '',
        });
      }, 500);
      return;
    }

    if (pagePath.includes('preview-window.html')) {
      if (desktopApi && desktopApi.preview) return;
      const query = new URLSearchParams(window.location.search);
      const id = query.get('id');
      const image = items.find((item) => item.id === id) || items[0];
      setTimeout(() => {
        ipcRenderer.emit('init', {
          images: image ? [image] : [],
          imagesDir: lib.imagesDir,
          rootDir: lib.rootDir,
          machineID: 'preview',
          Registration: registration,
          pluginModule,
        });
      }, 500);
      return;
    }

    if (pagePath.includes('collect-window')) {
      setTimeout(() => {
        const retry = setInterval(() => {
          try {
            if (!window.angular) return;
            const panel = document.querySelector('folder-select-panel');
            if (!panel) return;
            const iso = angular.element(panel).isolateScope();
            const root = angular.element(document.querySelector('[ng-controller]')).scope();
            if (!iso || !root) return;
            if (iso.listData && Array.isArray(iso.listData.items) && iso.listData.items.length > 0) {
              clearInterval(retry);
              return;
            }
            if (Array.isArray(root.folders) && root.folders.length > 0 && typeof root.initFolderSelect === 'function') {
              root.initFolderSelect();
            }
          } catch (err) {
            console.warn('[eagle-shim] collect panel retry failed', err);
          }
        }, 100);
        setTimeout(() => clearInterval(retry), 6000);
      }, 250);
    }

    if (!pagePath.endsWith('/index.html') && !pagePath.endsWith('/src/app/index.html')) {
      return;
    }

    setTimeout(() => {
      ipcRenderer.emit('initial', {
        trialRemain: 0,
        machineID: 'preview',
        Registration: registration,
        errorMsg: '',
      });
    }, 250);

    setTimeout(() => {
      ipcRenderer.emit('app-status-loading');
    }, 300);

    setTimeout(() => {
      ipcRenderer.emit('preload-library', {
        cachePath: `${lib.rootDir}/cache.json`,
      });
    }, 350);

    setTimeout(() => {
      ipcRenderer.emit('app-status-library-loaded', {
        machineID: 'preview',
        backgroundWindowID: 1,
        usingCache: false,
        usingPreloadCache: true,
        loadedTime: 0.01,
        rootDir: lib.rootDir,
        imagesDir: lib.imagesDir,
        imagesStringPath: `${lib.rootDir}/cache.json`,
        cachePath: `${lib.rootDir}/cache.json`,
        folders: lib.folders || [],
        smartFolders: lib.smartFolders || [],
        quickAccess: lib.quickAccess || [],
        tagsGroups: lib.tagsGroups || [],
        modificationTime: Date.now(),
      });
    }, 550);
  }

  const sourceModeState = {
    active: false,
    savedLibrary: null,
    savedCache: [],
    savedLibraryPath: '',
    currentRootId: '',
    currentRelativePath: '.',
    panel: null,
    roots: [],
    view: 'tree',
    expanded: {},
    originalContainerDisplay: '',
  };

  function sourceModeApiBase() {
    return (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  }

  async function sourceModeApi(route, options = {}) {
    const apiBase = sourceModeApiBase();
    const response = await fetch(`${apiBase}${route}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = { status: 'error', message: text || `HTTP ${response.status}` };
    }
    if (!response.ok || !payload || payload.status !== 'success') {
      throw new Error(payload && payload.message ? payload.message : `API request failed: HTTP ${response.status}`);
    }
    return payload.data;
  }

  function findSourceFolder(nodes, relativePath) {
    const list = Array.isArray(nodes) ? nodes : [];
    for (const node of list) {
      if (node.relativePath === relativePath) return node;
      const found = findSourceFolder(node.children || [], relativePath);
      if (found) return found;
    }
    return null;
  }

  function applyVirtualLibrary(virtual) {
    const lib = window.__mockLibrary || {};
    window.__mockLibrary = {
      ...lib,
      mode: 'source',
      rootDir: virtual.rootDir,
      imagesDir: virtual.imagesDir,
      libraryName: lib.libraryName || virtual.libraryName || '来源文件夹模式',
      folders: Array.isArray(virtual.folders) ? virtual.folders : [],
      smartFolders: Array.isArray(virtual.smartFolders) ? virtual.smartFolders : [],
      quickAccess: Array.isArray(virtual.quickAccess) ? virtual.quickAccess : [],
      tagsGroups: Array.isArray(virtual.tagsGroups) ? virtual.tagsGroups : [],
      cachePath: virtual.cachePath,
      imagesStringPath: virtual.imagesStringPath || virtual.cachePath,
    };
    window.__mockLibraryCache = Array.isArray(virtual.items) ? virtual.items.slice() : [];
    sourceModeState.currentRootId = virtual.sourceRootId || '';
    sourceModeState.currentRelativePath = virtual.relativePath || '.';
  }

  function ensureSourceModeStyles() {
    if (document.getElementById('eagle-source-mode-style')) return;
    const style = document.createElement('style');
    style.id = 'eagle-source-mode-style';
    style.textContent = `
      #eagle-source-mode-sidebar {
        position: absolute;
        top: 86px;
        left: 0;
        right: 0;
        bottom: 44px;
        display: flex;
        flex-direction: column;
        background: var(--sidebar-background-color, #1b1d22);
        color: var(--sidebar-text, #e8e9ed);
        z-index: 10000;
        font-size: 12px;
        overflow: hidden;
      }
      #eagle-source-mode-sidebar .source-mode-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
        font-weight: 600;
      }
      #eagle-source-mode-sidebar .source-mode-tabs {
        display: flex;
        gap: 4px;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }
      #eagle-source-mode-sidebar .source-mode-tab {
        flex: 1;
        border: 1px solid transparent;
        background: transparent;
        color: #9aa0ab;
        padding: 6px 0;
        border-radius: 8px;
        cursor: pointer;
      }
      #eagle-source-mode-sidebar .source-mode-tab.active {
        background: rgba(255,255,255,0.07);
        border-color: rgba(255,255,255,0.1);
        color: #fff;
      }
      #eagle-source-mode-sidebar .source-mode-body {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      #eagle-source-mode-sidebar .source-mode-footer {
        border-top: 1px solid rgba(255,255,255,0.08);
        padding: 10px;
        flex-shrink: 0;
      }
      #eagle-source-mode-sidebar .source-root-card {
        margin-bottom: 8px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        background: rgba(255,255,255,0.04);
        overflow: hidden;
      }
      #eagle-source-mode-sidebar .source-root-header {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        border: none;
        background: transparent;
        color: inherit;
        padding: 8px 10px;
        cursor: pointer;
        text-align: left;
      }
      #eagle-source-mode-sidebar .source-root-header:hover {
        background: rgba(255,255,255,0.06);
      }
      #eagle-source-mode-sidebar .source-root-name {
        min-width: 0;
        flex: 1;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #eagle-source-mode-sidebar .source-root-path {
        display: block;
        color: #9aa0ab;
        font-size: 11px;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #eagle-source-mode-sidebar .source-directory-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        border: none;
        background: transparent;
        color: inherit;
        padding: 5px 8px 5px 22px;
        cursor: pointer;
        text-align: left;
      }
      #eagle-source-mode-sidebar .source-directory-row:hover {
        background: rgba(255,255,255,0.06);
      }
      #eagle-source-mode-sidebar .source-directory-row.selected {
        background: rgba(91,140,255,0.18);
        color: #fff;
      }
      #eagle-source-mode-sidebar .source-mode-count {
        color: #9aa0ab;
        font-size: 11px;
        flex-shrink: 0;
      }
      #eagle-source-mode-sidebar .source-mode-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 1px solid rgba(255,255,255,0.1);
        background: transparent;
        color: inherit;
        border-radius: 8px;
        padding: 5px 9px;
        font-size: 12px;
        cursor: pointer;
      }
      #eagle-source-mode-sidebar .source-mode-button:hover {
        background: rgba(255,255,255,0.06);
      }
      #eagle-source-mode-sidebar .source-mode-button.primary {
        background: #5b8cff;
        border-color: transparent;
        color: #fff;
      }
      #eagle-source-mode-sidebar .source-mode-button.danger {
        color: #ff6b6b;
        border-color: rgba(255,107,107,0.35);
      }
      #eagle-source-mode-sidebar .source-mode-add-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        padding: 8px 0;
        border-radius: 10px;
        border: 1px solid rgba(91,140,255,0.35);
        background: rgba(91,140,255,0.12);
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      #eagle-source-mode-sidebar .source-mode-empty {
        padding: 24px 12px;
        text-align: center;
        color: #9aa0ab;
      }
      #eagle-source-mode-sidebar .source-manage-card {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        background: rgba(255,255,255,0.04);
        padding: 10px;
        margin-bottom: 8px;
      }
      #eagle-source-mode-sidebar .source-manage-card-title {
        font-weight: 600;
        margin-bottom: 2px;
      }
      #eagle-source-mode-sidebar .source-manage-card-path {
        color: #9aa0ab;
        font-size: 11px;
        word-break: break-all;
        margin-bottom: 6px;
      }
      #eagle-source-mode-sidebar .source-manage-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
    `;
    document.head.appendChild(style);
  }

  function createSourceModeSidebar() {
    if (sourceModeState.panel) return sourceModeState.panel;
    ensureSourceModeStyles();
    const sidebar = document.querySelector('#sidebar');
    if (!sidebar) return null;
    // #sidebar 本身是 position: fixed；不要改写它的 position，否则会破坏原布局。
    // 保留原 .sidebar-header（新增/切换文件夹/显示隐藏栏那一行）不变，只替换下方列表区。
    const container = document.querySelector('.sidebar-container');
    if (container) {
      sourceModeState.originalContainerDisplay = container.style.display;
      container.style.display = 'none';
    }
    const panel = document.createElement('div');
    panel.id = 'eagle-source-mode-sidebar';
    panel.innerHTML = `
      <div class="source-mode-tabs">
        <button type="button" class="source-mode-tab active" data-source-view="tree">来源目录</button>
        <button type="button" class="source-mode-tab" data-source-view="manage">管理来源</button>
      </div>
      <div class="source-mode-body" data-source-body></div>
      <div class="source-mode-footer">
        <button type="button" id="source-mode-add-folder" class="source-mode-add-button">＋ 添加来源文件夹</button>
      </div>
    `;
    panel.addEventListener('click', (event) => {
      const target = event.target.closest('button, [data-source-action], [data-source-view], [data-source-folder], [data-source-root], [data-source-rescan], [data-source-remove]');
      if (!target) return;
      const action = target.getAttribute('data-source-action');
      if (action === 'close') {
        closeSourceMode();
        return;
      }
      if (target.id === 'source-mode-add-folder') {
        void handleSourceAdd();
        return;
      }
      const view = target.getAttribute('data-source-view');
      if (view) {
        sourceModeState.view = view;
        renderSourceModeSidebar();
        return;
      }
      const rootId = target.getAttribute('data-source-root') || '';
      const relativePath = target.getAttribute('data-source-relative-path') || '.';
      if (target.hasAttribute('data-source-folder')) {
        void handleSourceSelectFolder(rootId, relativePath);
        return;
      }
      if (target.hasAttribute('data-source-root')) {
        const actionName = target.getAttribute('data-source-action');
        if (actionName === 'toggle-root') {
          sourceModeState.expanded[rootId] = !sourceModeState.expanded[rootId];
          renderSourceModeSidebar();
        } else if (actionName === 'rescan') {
          void handleRescanRoot(rootId);
        } else if (actionName === 'remove') {
          void handleRemoveRoot(rootId);
        }
        return;
      }
      if (target.hasAttribute('data-source-rescan')) {
        void handleRescanRoot(target.getAttribute('data-source-rescan'));
        return;
      }
      if (target.hasAttribute('data-source-remove')) {
        void handleRemoveRoot(target.getAttribute('data-source-remove'));
      }
    });
    sidebar.appendChild(panel);
    sourceModeState.panel = panel;
    return panel;
  }

  function destroySourceModeSidebar() {
    if (sourceModeState.panel) {
      sourceModeState.panel.remove();
      sourceModeState.panel = null;
    }
    const container = document.querySelector('.sidebar-container');
    if (container) container.style.display = sourceModeState.originalContainerDisplay;
    sourceModeState.originalContainerDisplay = '';
  }

  function renderDirectoryNode(node, rootId, selectedRootId, selectedRelativePath) {
    const selected = selectedRootId === rootId && selectedRelativePath === node.relativePath;
    let html = `<button type="button" class="source-directory-row${selected ? ' selected' : ''}" data-source-folder="${rootId}" data-source-root="${rootId}" data-source-relative-path="${node.relativePath}">📁 ${node.name}<span class="source-mode-count">${node.assetCount}</span></button>`;
    for (const child of node.children || []) {
      html += renderDirectoryNode(child, rootId, selectedRootId, selectedRelativePath);
    }
    return html;
  }

  function renderSourceModeSidebar() {
    if (!sourceModeState.panel) return;
    const body = sourceModeState.panel.querySelector('[data-source-body]');
    if (!body) return;
    const tabs = sourceModeState.panel.querySelectorAll('.source-mode-tab');
    tabs.forEach((tab) => tab.classList.toggle('active', tab.getAttribute('data-source-view') === sourceModeState.view));
    const roots = sourceModeState.roots || [];
    if (sourceModeState.view === 'tree') {
      if (roots.length === 0) {
        body.innerHTML = '<div class="source-mode-empty">还没有连接任何来源文件夹</div>';
        return;
      }
      body.innerHTML = roots.map((root) => {
        const expanded = sourceModeState.expanded[root.id] || roots.length === 1;
        const selected = sourceModeState.currentRootId === root.id && sourceModeState.currentRelativePath === '.';
        let html = `<div class="source-root-card">
          <button type="button" class="source-root-header" data-source-root="${root.id}" data-source-action="toggle-root">
            <span>${expanded ? '▾' : '▸'}</span>
            <span class="source-root-name">${root.name}<span class="source-root-path">${root.path}</span></span>
            <span class="source-mode-count">${root.assetCount}</span>
          </button>`;
        if (expanded) {
          html += `<button type="button" class="source-directory-row${selected ? ' selected' : ''}" data-source-folder="${root.id}" data-source-root="${root.id}" data-source-relative-path=".">全部素材<span class="source-mode-count">${root.assetCount}</span></button>`;
          for (const directory of root.directories || []) {
            html += renderDirectoryNode(directory, root.id, sourceModeState.currentRootId, sourceModeState.currentRelativePath);
          }
        }
        html += '</div>';
        return html;
      }).join('');
    } else {
      if (roots.length === 0) {
        body.innerHTML = '<div class="source-mode-empty">还没有来源目录</div>';
        return;
      }
      body.innerHTML = roots.map((root) => `
        <div class="source-manage-card">
          <div class="source-manage-card-title">${root.name}</div>
          <div class="source-manage-card-path">${root.path}</div>
          <div>${root.assetCount} 个素材 · ${root.missingCount} 个丢失 · ${root.watch ? '正在监控' : '未监控'}</div>
          <div class="source-manage-actions">
            <button type="button" class="source-mode-button" data-source-folder="${root.id}" data-source-root="${root.id}" data-source-relative-path=".">查看素材</button>
            <button type="button" class="source-mode-button" data-source-rescan="${root.id}">重新扫描</button>
            <button type="button" class="source-mode-button danger" data-source-remove="${root.id}">移除此来源</button>
          </div>
        </div>
      `).join('');
    }
  }

  async function refreshSourceModeVirtualLibrary(rootId) {
    const roots = await sourceModeApi('/api/source-roots');
    sourceModeState.roots = roots;
    const nextRootId = rootId || sourceModeState.currentRootId || (roots.length ? roots[0].id : '');
    const virtual = await sourceModeApi(`/api/source-mode/virtual-library?sourceRootId=${encodeURIComponent(nextRootId)}`);
    applyVirtualLibrary(virtual);
    emitMockLifecycle();
    return virtual;
  }

  function openSourceFolderInAngular(folder) {
    const tryOpen = () => {
      try {
        if (!window.angular) return;
        const scope = angular.element(document.body).scope();
        if (scope && typeof scope.openFolder === 'function') {
          scope.openFolder(folder, true);
          if (typeof scope.$evalAsync === 'function') scope.$evalAsync();
        }
      } catch (err) {
        console.warn('[eagle-shim] source folder open failed', err);
      }
    };
    setTimeout(tryOpen, 650);
  }

  async function openSourceMode() {
    if (sourceModeState.active) return;
    try {
      sourceModeState.savedLibrary = window.__mockLibrary ? JSON.parse(JSON.stringify(window.__mockLibrary)) : null;
      sourceModeState.savedCache = Array.isArray(window.__mockLibraryCache) ? JSON.parse(JSON.stringify(window.__mockLibraryCache)) : [];
      sourceModeState.savedLibraryPath = (window.__mockLibrary && (window.__mockLibrary.rootDir || window.__mockLibrary.path)) || '';

      await sourceModeApi('/api/source-mode/state', {
        method: 'POST',
        body: JSON.stringify({ mode: 'source' }),
      });
      const state = await sourceModeApi('/api/source-mode/state');
      let rootId = state.selectedSourceRootId || '';
      const roots = await sourceModeApi('/api/source-roots');
      if (!rootId && roots.length > 0) rootId = roots[0].id;

      const virtual = await sourceModeApi(`/api/source-mode/virtual-library?sourceRootId=${encodeURIComponent(rootId)}`);
      applyVirtualLibrary(virtual);
      sourceModeState.roots = roots;
      createSourceModeSidebar();
      renderSourceModeSidebar();
      sourceModeState.active = true;
      emitMockLifecycle();
    } catch (err) {
      console.warn('[eagle-shim] open source mode failed', err);
    }
  }

  async function handleSourceSelectFolder(sourceRootId, relativePath) {
    sourceRootId = String(sourceRootId || '');
    relativePath = String(relativePath || '.');
    const previousRootId = sourceModeState.currentRootId;
    sourceModeState.currentRootId = sourceRootId;
    sourceModeState.currentRelativePath = relativePath;
    try {
      await sourceModeApi('/api/source-mode/state', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'source',
          selectedSourceRootId: sourceRootId,
          selectedRelativePath: relativePath,
        }),
      });
      if (sourceRootId && previousRootId !== sourceRootId) {
        await refreshSourceModeVirtualLibrary(sourceRootId);
      }
      const folders = (window.__mockLibrary && window.__mockLibrary.folders) || [];
      const folder = findSourceFolder(folders, relativePath);
      if (folder) openSourceFolderInAngular(folder);
      renderSourceModeSidebar();
    } catch (err) {
      console.warn('[eagle-shim] source select folder failed', err);
    }
  }

  async function handleRescanRoot(rootId) {
    try {
      const d = desktopApi && desktopApi.sourceMode;
      if (d && typeof d.rescan === 'function') {
        await d.rescan(rootId, null);
      } else {
        await sourceModeApi('/api/source-roots/rescan', {
          method: 'POST',
          body: JSON.stringify({ id: rootId, relativePath: null }),
        });
      }
      sourceModeState.roots = await sourceModeApi('/api/source-roots');
      renderSourceModeSidebar();
    } catch (err) {
      console.warn('[eagle-shim] source rescan failed', err);
    }
  }

  async function handleRemoveRoot(rootId) {
    try {
      const d = desktopApi && desktopApi.sourceMode;
      if (d && typeof d.remove === 'function') {
        await d.remove(rootId);
      } else {
        await sourceModeApi('/api/source-roots/remove', {
          method: 'POST',
          body: JSON.stringify({ id: rootId }),
        });
      }
      const roots = await sourceModeApi('/api/source-roots');
      sourceModeState.roots = roots;
      if (sourceModeState.currentRootId === rootId) {
        const nextRoot = roots[0] || null;
        sourceModeState.currentRootId = nextRoot ? nextRoot.id : '';
        sourceModeState.currentRelativePath = '.';
        if (nextRoot) await refreshSourceModeVirtualLibrary(nextRoot.id);
      }
      renderSourceModeSidebar();
    } catch (err) {
      console.warn('[eagle-shim] source remove failed', err);
    }
  }

  async function handleSourceAdd() {
    try {
      if (desktopApi && desktopApi.sourceMode && typeof desktopApi.sourceMode.pickAndAdd === 'function') {
        await desktopApi.sourceMode.pickAndAdd();
      } else if (window.__EAGLE_SOURCE_FOLDER_FIXTURE) {
        await sourceModeApi('/api/source-roots/addPath', {
          method: 'POST',
          body: JSON.stringify({ path: window.__EAGLE_SOURCE_FOLDER_FIXTURE }),
        });
      } else {
        window.alert('浏览器预览中请设置 EAGLE_SOURCE_FOLDER_FIXTURE 后使用来源模式。');
        return;
      }
      const roots = await sourceModeApi('/api/source-roots');
      sourceModeState.roots = roots;
      if (!sourceModeState.currentRootId || !roots.some((root) => root.id === sourceModeState.currentRootId)) {
        if (roots.length > 0) await refreshSourceModeVirtualLibrary(roots[0].id);
      }
      renderSourceModeSidebar();
    } catch (err) {
      console.warn('[eagle-shim] source add failed', err);
    }
  }

  function closeSourceMode() {
    if (!sourceModeState.active) return;
    sourceModeState.active = false;
    destroySourceModeSidebar();
    if (sourceModeState.savedLibrary) window.__mockLibrary = sourceModeState.savedLibrary;
    if (Array.isArray(sourceModeState.savedCache)) window.__mockLibraryCache = sourceModeState.savedCache;
    sourceModeApi('/api/source-mode/state', {
      method: 'POST',
      body: JSON.stringify({ mode: 'library' }),
    }).catch((err) => {
      console.warn('[eagle-shim] close source mode state save failed', err);
    });
    sourceModeState.savedLibrary = null;
    sourceModeState.savedCache = [];
    sourceModeState.currentRootId = '';
    sourceModeState.currentRelativePath = '.';
    sourceModeState.roots = [];
    sourceModeState.view = 'tree';
    sourceModeState.expanded = {};
    emitMockLifecycle();
  }

  function installModeSwitch() {
    if (!window.location.pathname.endsWith('/src/app/index.html')) return;
    const findSwitchButton = () => Array.from(document.querySelectorAll('.sidebar-toolbar .icon-btn'))
      .find((btn) => {
        const img = btn.querySelector('img[src*="ic_switch.svg"]');
        return img && btn.getAttribute('ng-click') && btn.getAttribute('ng-click').includes('openQuickSearch');
      });
    document.addEventListener('click', (event) => {
      const btn = findSwitchButton();
      if (!btn || !btn.contains(event.target)) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (sourceModeState.active) {
        closeSourceMode();
      } else {
        void openSourceMode();
      }
    }, true);
  }

  function startLifecycle() {
    if (desktopApi && desktopApi.library && typeof desktopApi.library.current === 'function') {
      desktopApi.library.current().then((library) => {
        window.__mockLibrary = {
          ...library,
          rootDir: library.rootDir || library.path,
          imagesDir: library.imagesDir,
          libraryName: library.libraryName || library.name,
        };
        window.__mockLibraryCache = Array.isArray(library.items) ? library.items.slice() : [];
        window.__mockLibraryCache.forEach((item) => {
          if (item && item.customThumbnail) customThumbnailItemIds.add(item.id);
        });
        scheduleMissingPaletteAnalysis(window.__mockLibraryCache);
        const storedHistory = readSetting('libraryHistory');
        settingsMemory.libraryHistory = [library.path, ...(Array.isArray(storedHistory) ? storedHistory : [])].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);
        startCapturePolling();
        emitMockLifecycle();
      }).catch((err) => {
        console.warn('[eagle-shim] current library bootstrap failed', err);
        emitMockLifecycle();
      });
      return;
    }
    emitMockLifecycle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installImportTransitionStyle();
      installBrowserDropImport();
      installNonMediaMetaPatcher();
      installModeSwitch();
      startLifecycle();
    }, { once: true });
  } else {
    installImportTransitionStyle();
    installBrowserDropImport();
    installNonMediaMetaPatcher();
    installModeSwitch();
    startLifecycle();
  }
})();
