const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, shell, Tray } = require('electron');

const previewUrl = process.env.EAGLE_PREVIEW_URL || 'http://localhost:5176/src/app/index.html';
const apiBase = process.env.EAGLE_API_URL || 'http://localhost:41695';
const mockLibraryRoot = path.resolve(__dirname, '../frontend/public/mock-library/Eagle Reverse Demo.library');
const smokeMode = process.argv.includes('--smoke');
const pluginSmokeMode = process.argv.includes('--smoke-plugin');
const desktopSmokeMode = process.argv.includes('--smoke-desktop');
const librarySmokeMode = process.argv.includes('--smoke-library');
const mainWorkflowSmokeMode = process.argv.includes('--smoke-main-workflow');
const documentViewerSmokeMode = process.argv.includes('--smoke-document-viewer');
const browserCaptureUiSmokeMode = process.argv.includes('--smoke-browser-capture-ui');
const previewDeliverySmokeMode = process.argv.includes('--smoke-preview-delivery');
const exportProgressSmokeMode = process.argv.includes('--smoke-export-progress');
const videoDetailSmokeMode = process.argv.includes('--smoke-video-detail');
const regressionHostMode = process.argv.includes('--regression-host');
const dragSmokeMode = process.argv.includes('--smoke-drag') || process.env.EAGLE_DRAG_SMOKE === '1';
// b1-9ae：后台窗通道族闭环 smoke——真实渲染层 ipcRenderer.send → main handler → backend
// 数据面全链验证（duplicate-file/export-as-folder/export-images/regenerate-thumbnail/
// set-custom-thumbnail/copy-thumbnails；open-with-dialog 仅静态接线审计，避免真弹窗）
const channelsSmokeMode = process.argv.includes('--smoke-channels') || process.env.EAGLE_CHANNELS_SMOKE === '1';
// b1-9ak：Menu.popup 冒烟捕获——@electron/remote 的方法调用不经 main 侧 Menu 原型
// （原型补丁实测无效），改由渲染层 smoke 分支序列化菜单模板后经 IPC 通报（原生 popup
// 无法被 CDP 观察且会阻塞会话）；捕获经 smoke:menu-popups 供闭环测试断言
const menuPopupSmokeMode = process.argv.includes('--smoke-menu') || process.env.EAGLE_MENU_SMOKE === '1';
const menuPopupCaptures = [];
const menuPopupOutFile = process.env.EAGLE_MENU_SMOKE_OUT || '';
const dragStartCalls = [];
let cachedCurrentLibrary = null;
if (process.env.EAGLE_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.EAGLE_DEBUG_PORT);
const windowStateFile = () => path.join(app.getPath('userData'), 'window-state.json');
const preferencesStateFile = () => path.join(app.getPath('userData'), 'eagle-reverse-preferences.json');
const allowedRoots = new Set([mockLibraryRoot, path.resolve(__dirname, '..', '..')]);
const exportJobs = new Map();
const activeExportSenders = new Set();
const shellCalls = [];
const defaultPreferencesState = {
  general: { enableVibrancy: 'true', zoom: '100', language: 'zh_CN' },
  theme: { name: 'DARK', css: 'dark' },
};
let preferencesState = null;

function readPreferencesState() {
  try {
    return JSON.parse(fs.readFileSync(preferencesStateFile(), 'utf8'));
  } catch (err) {
    return {};
  }
}

function currentPreferencesState() {
  if (!preferencesState) {
    const saved = readPreferencesState();
    preferencesState = {
      ...defaultPreferencesState,
      general: { ...defaultPreferencesState.general, ...(saved.general || {}) },
      theme: { ...defaultPreferencesState.theme, ...(saved.theme || {}) },
    };
  }
  return preferencesState;
}

function writePreferencesState(next) {
  const merged = {
    ...defaultPreferencesState,
    general: { ...defaultPreferencesState.general, ...((next && next.general) || {}) },
    theme: { ...defaultPreferencesState.theme, ...((next && next.theme) || {}) },
  };
  preferencesState = merged;
  try {
    fs.mkdirSync(path.dirname(preferencesStateFile()), { recursive: true });
    fs.writeFileSync(preferencesStateFile(), JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    // Persistence is best-effort; in-memory state still applies for this session.
  }
  return merged;
}

function vibrancyTypeForTheme(name) {
  const map = {
    LIGHT: 'light',
    LIGHTGRAY: 'light',
    GRAY: 'dark',
    DARK: 'dark',
    BLUE: 'dark',
    PURPLE: 'dark',
  };
  return map[name] || 'dark';
}

function applyWindowTransparencyEffect(win) {
  if (!win || win.isDestroyed()) return;
  const preferences = currentPreferencesState();
  const enabled = preferences.general.enableVibrancy !== 'false';
  if (process.platform === 'darwin') {
    try {
      win.setVibrancy(enabled ? vibrancyTypeForTheme(preferences.theme.name) : null);
    } catch (err) {
      // Vibrancy is optional on unsupported macOS builds.
    }
    return;
  }
  if (process.platform === 'win32') {
    try {
      win.setOpacity(enabled ? 0.95 : 1);
    } catch (err) {
      // Window opacity is best-effort.
    }
  }
}

function allowRoot(target) {
  if (target) allowedRoots.add(path.resolve(target));
}

function safeResolve(target) {
  const resolved = path.resolve(target);
  const inside = [...allowedRoots].some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!inside) throw new Error(`Unsafe path: ${target}`);
  return resolved;
}

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
  } catch (err) {
    return {};
  }
}

function normalizeClipboardPath(value) {
  return String(value || '').replace(/^"|"$/g, '').replace(/^file:\/\//i, '').trim();
}

function clipboardFilePaths() {
  const candidates = [];
  const text = clipboard.readText() || '';
  candidates.push(...text.split(/\r?\n/));
  for (const format of ['FileNameW', 'FileName']) {
    try {
      const buffer = clipboard.readBuffer(format);
      if (!buffer || buffer.length === 0) continue;
      const decoded = format === 'FileNameW' ? buffer.toString('utf16le') : buffer.toString('utf8');
      candidates.push(...decoded.split(/\0|\r?\n/));
    } catch (err) {
      // The format is optional and platform-dependent.
    }
  }
  return [...new Set(candidates.map(normalizeClipboardPath).filter((target) => {
    try {
      return target && fs.existsSync(target) && fs.statSync(target).isFile();
    } catch (err) {
      return false;
    }
  }))];
}

// b1-9aa：win32 剪贴板文件拷贝（原 background 经 copy-win-files 请求旧 main.js 实现，
// 本仓从未落地——CF_HDROP = DROPFILES 头(20B, fWide=1) + 双 NUL 结尾宽字符路径；
// 单文件写失败时回落位图，保证粘贴出图）
function copyWinFilesToClipboard(paths) {
  const targets = (Array.isArray(paths) ? paths : []).filter((entry) => entry && fs.existsSync(entry));
  if (process.platform !== 'win32' || targets.length === 0) return;
  try {
    const fileList = Buffer.from(targets.map((entry) => `${entry}\0\0`).join(''), 'ucs2');
    const header = Buffer.alloc(20);
    header.writeUInt32LE(20, 0); // pFiles
    header.writeUInt32LE(1, 16); // fWide
    clipboard.writeBuffer('CF_HDROP', Buffer.concat([header, fileList, Buffer.from([0, 0])]));
  } catch (err) {
    if (targets.length === 1) {
      const ext = path.extname(targets[0]).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
        const image = nativeImage.createFromPath(targets[0]);
        if (!image.isEmpty()) clipboard.writeImage(image);
      }
    }
  }
}

async function apiRequest(route, options = {}) {
  const target = new URL(`${apiBase}${route}`);
  const body = options.body ? JSON.stringify(options.body) : '';
  const response = await new Promise((resolve, reject) => {
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(target, {
      method: options.method || 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, text }));
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
  let payload;
  try {
    payload = JSON.parse(response.text);
  } catch (err) {
    payload = { status: 'error', message: response.text || `HTTP ${response.statusCode}` };
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || payload.status !== 'success') {
    throw new Error(payload.message || `API request failed: HTTP ${response.statusCode}`);
  }
  return payload.data;
}

async function currentLibrary() {
  const current = await apiRequest('/api/library/current');
  allowRoot(current.rootDir || current.path);
  const { loadLibrary } = await import('../backend/src/library-store.js');
  return loadLibrary(current.path || current.rootDir);
}

function assertSafeExportDestination(current, target) {
  const destination = path.resolve(String(target || ''));
  if (!destination) throw new Error('Export destination is required');
  const imagesDir = path.resolve(current.imagesDir || path.join(current.rootDir || current.path, 'images'));
  if (destination === imagesDir || destination.startsWith(imagesDir + path.sep)) {
    throw new Error('Export destination cannot be inside the current library images directory');
  }
  return destination;
}

async function resolveItemFiles(itemId) {
  const library = await currentLibrary();
  const item = library.itemMap.get(String(itemId || ''));
  if (!item) throw new Error(`Item not found: ${itemId}`);
  if (item.isDeleted) throw new Error(`Item is in trash: ${itemId}`);
  const imagesDir = path.join(library.rootDir, 'images');
  const infoDir = path.join(imagesDir, `${item.id}.info`);
  const originalName = `${item.name}.${item.ext}`;
  if (path.basename(originalName) !== originalName) throw new Error(`Unsafe item file name: ${item.name}`);
  const originalPath = path.join(infoDir, originalName);
  const thumbnailPath = path.join(infoDir, `${item.name}_thumbnail.png`);
  if (!fs.existsSync(infoDir) || !fs.statSync(infoDir).isDirectory()) {
    throw new Error(`Item directory missing: ${item.id}`);
  }
  if (!fs.existsSync(originalPath) || !fs.statSync(originalPath).isFile()) {
    throw new Error(`Item original file missing: ${item.id}`);
  }
  const imagesReal = fs.realpathSync(imagesDir);
  const infoReal = fs.realpathSync(infoDir);
  const originalReal = fs.realpathSync(originalPath);
  if (!(infoReal === imagesReal || infoReal.startsWith(imagesReal + path.sep))) {
    throw new Error(`Unsafe item directory: ${item.id}`);
  }
  if (!originalReal.startsWith(infoReal + path.sep)) {
    throw new Error(`Unsafe item original file: ${item.id}`);
  }
  return { item, library, imagesDir, infoDir, originalPath, thumbnailPath, originalReal };
}

function resolveItemFilesSync(itemId) {
  if (!cachedCurrentLibrary || cachedCurrentLibrary.itemMap.size === 0) return null;
  try {
    const id = String(itemId || '');
    const item = cachedCurrentLibrary.itemMap.get(id);
    if (!item) return null;
    if (item.isDeleted) return null;
    const imagesDir = cachedCurrentLibrary.imagesDir;
    const infoDir = path.join(imagesDir, `${item.id}.info`);
    const originalName = `${item.name}.${item.ext}`;
    if (path.basename(originalName) !== originalName) return null;
    const originalPath = path.join(infoDir, originalName);
    const thumbnailPath = path.join(infoDir, `${item.name}_thumbnail.png`);
    if (!fs.existsSync(infoDir) || !fs.statSync(infoDir).isDirectory()) return null;
    if (!fs.existsSync(originalPath) || !fs.statSync(originalPath).isFile()) return null;
    const imagesReal = fs.realpathSync(imagesDir);
    const infoReal = fs.realpathSync(infoDir);
    const originalReal = fs.realpathSync(originalPath);
    if (!(infoReal === imagesReal || infoReal.startsWith(imagesReal + path.sep))) return null;
    if (!originalReal.startsWith(infoReal + path.sep)) return null;
    return { item, library: cachedCurrentLibrary, imagesDir, infoDir, originalPath, thumbnailPath, originalReal };
  } catch (err) {
    return null;
  }
}

async function itemIdFromPath(rawPath) {
  const library = await currentLibrary();
  const requested = path.resolve(String(rawPath || ''));
  for (const item of library.items || []) {
    const candidate = path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
    if (path.resolve(candidate) === requested) return item.id;
  }
  throw new Error(`Path does not resolve to a current library item: ${rawPath}`);
}

async function resolveRevealTarget(target) {
  const requested = path.resolve(String(target || ''));
  try {
    const id = await itemIdFromPath(requested);
    return { kind: 'item', id, target: requested };
  } catch (err) {
    for (const job of exportJobs.values()) {
      const destination = job.destination ? path.resolve(job.destination) : '';
      if (destination && (requested === destination || requested.startsWith(destination + path.sep))) {
        return { kind: 'export', jobId: job.jobId, target: requested };
      }
    }
  }
  throw new Error(`Unsafe reveal target: ${target}`);
}

function recordShell(action, target) {
  if (previewDeliverySmokeMode || exportProgressSmokeMode) shellCalls.push({ action, target, at: Date.now() });
}

async function openItemDefault(itemId) {
  const { originalReal } = await resolveItemFiles(itemId);
  recordShell('openPath', originalReal);
  if (!previewDeliverySmokeMode) {
    const error = await shell.openPath(originalReal);
    if (error) throw new Error(error);
  }
  return { ok: true, path: originalReal };
}

async function revealItem(itemId) {
  const { originalReal } = await resolveItemFiles(itemId);
  recordShell('showItemInFolder', originalReal);
  if (!previewDeliverySmokeMode) shell.showItemInFolder(originalReal);
  return { ok: true, path: originalReal };
}

async function revealExportResult(jobId) {
  const job = exportJobs.get(String(jobId || ''));
  if (!job || !job.destination) throw new Error(`Export job not found: ${jobId}`);
  const target = path.resolve(job.destination);
  recordShell('showItemInFolder', target);
  if (!previewDeliverySmokeMode) shell.showItemInFolder(target);
  return { ok: true, path: target };
}

async function copyItemPath(itemId) {
  const { originalReal } = await resolveItemFiles(itemId);
  clipboard.writeText(originalReal);
  return { ok: true, path: originalReal };
}

async function copyItemImage(itemId) {
  const { originalReal } = await resolveItemFiles(itemId);
  const image = nativeImage.createFromPath(originalReal);
  if (image.isEmpty()) throw new Error(`Item is not a decodable image: ${itemId}`);
  clipboard.writeImage(image);
  return { ok: true, path: originalReal, width: image.getSize().width, height: image.getSize().height };
}

function normalizeDragIds(input) {
  const collect = () => {
    if (Array.isArray(input)) return input.map((id) => String(id || '')).filter(Boolean);
    if (input && typeof input === 'object' && Array.isArray(input.ids)) {
      return input.ids.map((id) => String(id || '')).filter(Boolean);
    }
    if (input && typeof input === 'object' && input.id) return [String(input.id)];
    if (typeof input === 'string' && input) return [input];
    return [];
  };
  return [...new Set(collect())];
}

function resolveItemFilesSyncList(ids) {
  if (!cachedCurrentLibrary) return null;
  const resolved = ids.map((id) => resolveItemFilesSync(id));
  if (resolved.some((entry) => !entry)) return null;
  return resolved;
}

async function resolveItemFilesList(ids) {
  return Promise.all(ids.map((id) => resolveItemFiles(id)));
}

function dragIconFor(thumbnailPath) {
  const maxSize = 80;
  if (!fs.existsSync(thumbnailPath)) return nativeImage.createEmpty();
  const image = nativeImage.createFromPath(thumbnailPath);
  if (image.isEmpty()) return image;
  const size = image.getSize();
  if (!size || (!size.width && !size.height)) return image;
  if (size.width <= maxSize && size.height <= maxSize) return image;
  const scale = maxSize / Math.max(size.width || 1, size.height || 1);
  return image.resize({
    width: Math.max(1, Math.round((size.width || 1) * scale)),
    height: Math.max(1, Math.round((size.height || 1) * scale)),
  });
}

async function startItemDrag(event, input) {
  const ids = normalizeDragIds(input);
  if (ids.length === 0) throw new Error('Drag start requires at least one item ID');
  const resolvedList = cachedCurrentLibrary ? resolveItemFilesSyncList(ids) : null;
  const list = resolvedList || await resolveItemFilesList(ids);
  const paths = list.map((entry) => entry.originalReal);
  const icon = dragIconFor(list[0].thumbnailPath);
  recordShell('startDrag', paths.join('|'));
  if (dragSmokeMode) {
    dragStartCalls.push({ ids, paths, at: Date.now() });
    return { ok: true, path: paths[0], paths, fileCount: paths.length, sync: Boolean(resolvedList), recorded: true };
  }
  if (!previewDeliverySmokeMode) {
    if (paths.length === 1) {
      event.sender.startDrag({ file: paths[0], icon });
    } else {
      event.sender.startDrag({ files: paths, icon });
    }
  }
  return { ok: true, path: paths[0], paths, fileCount: paths.length, sync: Boolean(resolvedList) };
}

function mockLibraryDescription() {
  return {
    path: mockLibraryRoot,
    rootDir: mockLibraryRoot,
    libraryPath: mockLibraryRoot,
    name: 'Eagle Reverse Demo',
    libraryName: 'Eagle Reverse Demo',
    imagesDir: path.join(mockLibraryRoot, 'images') + path.sep,
    cachePath: path.join(mockLibraryRoot, 'cache.json'),
    imagesStringPath: path.join(mockLibraryRoot, 'cache.json'),
    folders: [],
    smartFolders: [],
    quickAccess: [],
    tagsGroups: [],
    items: [],
    itemCount: 0,
  };
}

function libraryLoadedPayload(library) {
  return {
    machineID: 'eagle-reverse',
    backgroundWindowID: 0,
    usingCache: true,
    usingPreloadCache: false,
    loadedTime: 0,
    rootDir: library.rootDir || library.path,
    imagesDir: library.imagesDir,
    imagesStringPath: library.imagesStringPath || library.cachePath,
    cachePath: library.cachePath,
    folders: library.folders || [],
    smartFolders: library.smartFolders || [],
    quickAccess: library.quickAccess || [],
    tagsGroups: library.tagsGroups || [],
    modificationTime: library.modificationTime || Date.now(),
  };
}

function updateCachedCurrentLibrary(library) {
  if (!library) return;
  const rootDir = path.resolve(library.rootDir || library.path);
  const imagesDir = path.resolve(library.imagesDir || path.join(rootDir, 'images'));
  const items = Array.isArray(library.items) ? library.items : [];
  cachedCurrentLibrary = {
    rootDir,
    imagesDir,
    itemMap: new Map(items.map((item) => [String(item.id), item])),
  };
}

async function refreshCachedCurrentLibrary() {
  try {
    const library = await apiRequest('/api/library/current?includeItems=true');
    updateCachedCurrentLibrary(library);
    return library;
  } catch (err) {
    return null;
  }
}

async function notifyLibraryLoaded(library) {
  allowRoot(library.rootDir || library.path);
  updateCachedCurrentLibrary(library);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('app-status-loading');
      win.webContents.send('library:changed', library);
      win.webContents.send('preload-library', { cachePath: library.cachePath });
      win.webContents.send('app-status-library-loaded', libraryLoadedPayload(library));
    }
  }
}

async function switchLibrary(libraryPath) {
  const library = await apiRequest('/api/library/switch', {
    method: 'POST',
    body: { libraryPath },
  });
  await notifyLibraryLoaded(library);
  return library;
}

async function runExport(event, mode, params = {}) {
  const jobId = params.jobId || `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const senderKey = String(event.sender.id);
  if (activeExportSenders.has(senderKey)) {
    const error = 'Another export task is already running';
    event.sender.send('close-export-task');
    event.sender.send('export:error', { jobId, error, cancelled: false });
    throw new Error(error);
  }
  activeExportSenders.add(senderKey);
  const images = Array.isArray(params.images) ? params.images : [];
  const total = images.length || (params.folder && Array.isArray(params.folder.images) ? params.folder.images.length : 0);
  const job = { cancelled: false, jobId, destination: params.savePath || params.destDir || '' };
  exportJobs.set(jobId, job);
  event.sender.send('show-export-task', total);
  try {
    const current = await apiRequest('/api/library/current');
    assertSafeExportDestination(current, params.savePath || params.destDir);
    const [{ loadLibrary }, exportModule] = await Promise.all([
      import('../backend/src/library-store.js'),
      import('../backend/src/export-service.js'),
    ]);
    const library = loadLibrary(current.path);
    const exportFunction = mode === 'as-folder' ? exportModule.exportAsFolder : exportModule.exportImages;
    const totalItems = Array.isArray(params.images) ? params.images.length : total;
    const result = await exportFunction(library, params, {
      isCancelled: () => job.cancelled,
      onProgress(progress) {
        event.sender.send('finish-export-task', progress.current === (progress.total || totalItems) ? params.savePath : undefined);
        event.sender.send('export:progress', { jobId, ...progress });
      },
    });
    event.sender.send('export:complete', { jobId, ...result });
    job.destination = result.destination || job.destination;
    job.result = result;
    return { jobId, ...result };
  } catch (err) {
    event.sender.send('close-export-task');
    event.sender.send('export:error', { jobId, error: err.message, cancelled: err.name === 'ExportCancelledError' });
    throw err;
  } finally {
    activeExportSenders.delete(senderKey);
    if (job.destination) {
      // Keep completed job metadata for controlled reveal while the window is open.
      job.completed = !job.cancelled;
    } else {
      exportJobs.delete(jobId);
    }
  }
}

async function runArchiveExport(event, params = {}) {
  const jobId = params.jobId || `archive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    cancelled: false,
    jobId,
    destination: params.savePath || params.destFile || '',
    backendJobId: '',
  };
  exportJobs.set(jobId, job);
  event.sender.send('show-archive-task');
  try {
    const current = await apiRequest('/api/library/current');
    assertSafeExportDestination(current, params.savePath || params.destFile);
    const start = await apiRequest('/api/export/eaglepack/start', {
      method: 'POST',
      body: {
        libraryPath: params.libraryPath,
        destFile: params.savePath || params.destFile,
        items: params.images || params.items || [],
        folder: params.folder,
        includeLibraryState: params.includeLibraryState,
      },
    });
    job.backendJobId = start.job && start.job.id;
    if (!job.backendJobId) throw new Error('Eaglepack job was not created');
    let sentAdd = 0;
    let lastPercent = -1;
    while (true) {
      if (job.cancelled || event.sender.isDestroyed()) {
        if (job.backendJobId) {
          await apiRequest(`/api/jobs/${encodeURIComponent(job.backendJobId)}/cancel`, {
            method: 'POST',
            body: {},
          }).catch(() => {});
        }
        event.sender.send('abort-archive-task');
        event.sender.send('export:error', { jobId, error: 'Export cancelled', cancelled: true });
        return { jobId, cancelled: true };
      }
      const state = await apiRequest(`/api/jobs/${encodeURIComponent(job.backendJobId)}`);
      const result = state.result || {};
      const current = Number(result.count || result.current || 0);
      const total = Number(result.total || 0);
      while (sentAdd < current) {
        event.sender.send('add-archive-task');
        sentAdd += 1;
      }
      const percent = Math.max(0, Math.min(100, Math.round(Number(state.progress || 0))));
      if (percent !== lastPercent) {
        event.sender.send('update-archive-percent', percent);
        lastPercent = percent;
      }
      event.sender.send('export:progress', { jobId, ...result, progress: percent, status: state.status });
      if (state.status === 'complete') {
        event.sender.send('update-archive-percent', 100);
        event.sender.send('finish-archive-task');
        job.destination = result.path || job.destination;
        job.result = result;
        event.sender.send('export:complete', { jobId, ...result });
        event.sender.send('show-item-in-folder', job.destination);
        return { jobId, ...result };
      }
      if (state.status === 'error' || state.status === 'cancelled') {
        event.sender.send('abort-archive-task');
        const cancelled = state.status === 'cancelled';
        event.sender.send('export:error', {
          jobId,
          error: state.message || state.error || 'Eaglepack export failed',
          cancelled,
        });
        return { jobId, error: state.message || state.error, cancelled };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (err) {
    event.sender.send('abort-archive-task');
    event.sender.send('export:error', { jobId, error: err.message, cancelled: false });
    throw err;
  } finally {
    if (job.destination) {
      job.completed = !job.cancelled;
      exportJobs.set(jobId, job);
    } else {
      exportJobs.delete(jobId);
    }
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    fs.mkdirSync(path.dirname(windowStateFile()), { recursive: true });
    fs.writeFileSync(windowStateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }), 'utf8');
  } catch (err) {
    // Ignore window state persistence errors.
  }
}

function originalPreviewUrl(itemId) {
  const target = new URL(previewUrl);
  target.pathname = target.pathname.replace(/\/src\/app\/index\.html$/i, '/src/app/preview-window.html');
  target.search = itemId ? `?id=${encodeURIComponent(itemId)}` : '';
  return target.toString();
}

let preferencesWindow = null;

function preferencesUrl(params = {}) {
  const target = new URL(previewUrl);
  target.pathname = '/src/app/preferences.html';
  const query = new URLSearchParams();
  if (params.panel) query.set('panel', String(params.panel));
  if (params.keyword) query.set('keyword', String(params.keyword));
  const search = query.toString();
  target.search = search ? `?${search}` : '';
  return target.toString();
}

function openPreferencesWindow(params = {}) {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    const nextUrl = preferencesUrl(params);
    if (preferencesWindow.webContents.getURL() !== nextUrl) {
      preferencesWindow.loadURL(nextUrl);
    }
    preferencesWindow.focus();
    return { opened: true, windowId: preferencesWindow.id, focused: true };
  }

  const win = createWindow({
    url: preferencesUrl(params),
    width: Number(params.width) || 980,
    height: Number(params.height) || 720,
    frame: false,
  });
  preferencesWindow = win;
  win.on('closed', () => {
    if (preferencesWindow === win) preferencesWindow = null;
  });
  return { opened: true, windowId: win.id, focused: false };
}

async function openOriginalPreview(payload = {}) {
  const items = Array.isArray(payload.images) ? payload.images.filter((item) => item && item.id) : [];
  if (items.length === 0) throw new Error('Preview requires at least one item');
  const library = await apiRequest('/api/library/current?includeItems=true');
  allowRoot(library.rootDir || library.path);
  const selectedIds = new Set(items.map((item) => item.id));
  const itemsById = new Map((library.items || []).filter((item) => !item.isDeleted).map((item) => [item.id, item]));
  const latestItems = items.map((entry) => itemsById.get(entry.id)).filter(Boolean);
  if (latestItems.length !== selectedIds.size) {
    throw new Error('Preview items were not found in the current library or are in the trash');
  }
  for (const item of latestItems) await resolveItemFiles(item.id);
  const initPayload = {
    images: latestItems,
    imagesDir: library.imagesDir,
    rootDir: library.rootDir || library.path,
    machineID: 'eagle-reverse',
    Registration: { activated: true, machineID: 'eagle-reverse' },
    pluginModule: payload.pluginModule || {
      plugins: [],
      previewExtension: {
        thumbnailPluginMap: {},
        thumbnailPath: {},
        thumbnailOptions: {},
        viewerPluginMap: {},
        viewerURL: {},
      },
    },
  };
  const win = createWindow({
    url: originalPreviewUrl(latestItems[0].id),
    width: payload.width || 1100,
    height: payload.height || 760,
    frame: false,
    show: payload.show !== false,
    onDidFinishLoad(previewWindow) {
      previewWindow.webContents.send('preview:init', initPayload);
    },
  });
  return { opened: true, windowId: win.id, itemIds: latestItems.map((item) => item.id) };
}

function createWindow(options = {}) {
  const saved = loadWindowState();
  const url = options.url || previewUrl;
  const windowOptions = {
    width: options.width || saved.width || 1280,
    height: options.height || saved.height || 800,
    x: options.x || saved.x,
    y: options.y || saved.y,
    minWidth: options.minWidth || 960,
    minHeight: options.minHeight || 600,
    autoHideMenuBar: true,
    frame: options.frame !== undefined ? options.frame : url !== previewUrl,
    show: options.show !== false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  };
  if (process.platform === 'darwin' && currentPreferencesState().general.enableVibrancy !== 'false') {
    windowOptions.vibrancy = vibrancyTypeForTheme(currentPreferencesState().theme.name);
    windowOptions.transparent = true;
    windowOptions.backgroundColor = '#00000000';
  }

  const win = new BrowserWindow(windowOptions);
  applyWindowTransparencyEffect(win);

  if (typeof options.onDidFinishLoad === 'function') {
    win.webContents.once('did-finish-load', () => options.onDidFinishLoad(win));
  }
  win.loadURL(url);
  if (saved.maximized) win.maximize();
  const notifyWindowState = () => {
    if (win.isDestroyed()) return;
    win.webContents.send('window:state-changed', {
      maximized: win.isMaximized(),
      fullScreen: win.isFullScreen(),
    });
  };
  win.on('maximize', notifyWindowState);
  win.on('unmaximize', notifyWindowState);
  win.on('enter-full-screen', notifyWindowState);
  win.on('leave-full-screen', notifyWindowState);
  win.on('resize', () => saveWindowState(win));
  win.on('move', () => saveWindowState(win));
  win.on('close', () => saveWindowState(win));
  return win;
}

function registerIpc() {
  ipcMain.handle('window:action', (event, action, value) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    switch (action) {
      case 'minimize':
        win.minimize();
        break;
      case 'maximize':
        win.maximize();
        break;
      case 'unmaximize':
        win.unmaximize();
        break;
      case 'close':
        win.close();
        break;
      case 'set-full-screen':
        win.setFullScreen(Boolean(value));
        break;
      case 'set-always-on-top':
        win.setAlwaysOnTop(Boolean(value));
        break;
      case 'reload':
        win.webContents.reload();
        break;
      case 'force-reload':
        win.webContents.reloadIgnoringCache();
        break;
      case 'toggle-devtools':
        win.webContents.toggleDevTools();
        break;
      case 'reset-zoom':
        win.webContents.setZoomLevel(0);
        break;
      case 'zoom-in':
        win.webContents.setZoomLevel((win.webContents.getZoomLevel() || 0) + 0.5);
        break;
      case 'zoom-out':
        win.webContents.setZoomLevel((win.webContents.getZoomLevel() || 0) - 0.5);
        break;
      case 'quit':
        app.quit();
        break;
      default:
        return false;
    }
    return true;
  });

  ipcMain.on('window:query', (event, key) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      event.returnValue = false;
      return;
    }
    if (key === 'isMaximized') {
      event.returnValue = win.isMaximized();
    } else if (key === 'isFullScreen') {
      event.returnValue = win.isFullScreen();
    } else {
      event.returnValue = false;
    }
  });

  ipcMain.handle('app:get-info', () => ({
    name: 'Eagle Reverse',
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
  }));

  ipcMain.handle('library:get-current', async () => {
    try {
      const library = await apiRequest('/api/library/current?includeItems=true');
      allowRoot(library.rootDir || library.path);
      updateCachedCurrentLibrary(library);
      return library;
    } catch (err) {
      if (smokeMode || pluginSmokeMode || desktopSmokeMode) return mockLibraryDescription();
      throw err;
    }
  });

  ipcMain.handle('library:get-history', () => apiRequest('/api/library/history'));

  ipcMain.handle('library:set-history', (event, history = []) => apiRequest('/api/library/history', {
    method: 'POST',
    body: { history },
  }));

  ipcMain.handle('library:update-structure', (event, params = {}) => apiRequest('/api/library/structure', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('library:create', async (event, params = {}) => {
    const library = await apiRequest('/api/library/create', { method: 'POST', body: params });
    await notifyLibraryLoaded(library);
    return library;
  });

  ipcMain.handle('library:open', async (event, libraryPath) => switchLibrary(libraryPath));
  ipcMain.handle('library:switch', async (event, libraryPath) => switchLibrary(libraryPath));

  ipcMain.on('create-library', async (event, params = {}) => {
    try {
      const library = await apiRequest('/api/library/create', { method: 'POST', body: params });
      await notifyLibraryLoaded(library);
      event.sender.send('library:operation-result', { ok: true, action: 'create', library });
    } catch (err) {
      event.sender.send('library:operation-result', { ok: false, action: 'create', error: err.message });
    }
  });

  for (const channel of ['open-library', 'add-to-history-and-open']) {
    ipcMain.on(channel, async (event, libraryPath) => {
      try {
        const library = await switchLibrary(libraryPath);
        event.sender.send('library:operation-result', { ok: true, action: 'open', library });
      } catch (err) {
        event.sender.send('library:operation-result', { ok: false, action: 'open', error: err.message });
      }
    });
  }

  ipcMain.handle('get-collect-window-data', () => {
    const name = 'Welcome Library';
    const ext = 'png';
    return {
      ok: true,
      canceled: false,
      filePath: '',
      filePaths: [],
      path: path.join(mockLibraryRoot, 'images', 'MOCK0001.info', `${name}.${ext}`),
      url: 'https://eagle.cool',
      name,
      type: 'image',
      tags: ['UI', '欢迎', 'Eagle'],
      folders: ['FOLDER-ROOT', 'FOLDER-WELCOME'],
      annotation: '原版欢迎页素材，用于主界面快速预览。',
      width: 1536,
      height: 960,
      star: 5,
    };
  });

  ipcMain.handle('viewer:open', (event, payload = {}) => {
    const url = payload.url || previewUrl;
    createWindow({ url, width: payload.width || 1100, height: payload.height || 760, frame: false });
    return true;
  });
  ipcMain.on('open.preferences', (event, params = {}) => openPreferencesWindow(params));
  ipcMain.on('preferences:update', (event, next) => {
    const merged = writePreferencesState(next || {});
    for (const win of BrowserWindow.getAllWindows()) {
      applyWindowTransparencyEffect(win);
    }
    return merged;
  });
  ipcMain.handle('preview:open-original', (event, payload = {}) => openOriginalPreview(payload));

  ipcMain.handle('item:open-default', (event, payload = {}) => openItemDefault(payload.id));
  ipcMain.handle('item:reveal', (event, payload = {}) => revealItem(payload.id));
  ipcMain.handle('item:copy-path', (event, payload = {}) => copyItemPath(payload.id));
  ipcMain.handle('item:copy-image', (event, payload = {}) => copyItemImage(payload.id));
  ipcMain.handle('item:drag-start', (event, payload = {}) => startItemDrag(event, payload));
  ipcMain.handle('export:reveal', (event, payload = {}) => revealExportResult(payload.jobId));

  ipcMain.handle('plugin:open', (event, payload = {}) => {
    const url = payload.url;
    if (!url) return false;
    createWindow({ url, width: payload.width || 640, height: payload.height || 480 });
    return true;
  });

  ipcMain.handle('dialog:show-open', async (event, options = {}) => {
    const normalized = { ...options };
    delete normalized.browserWindow;
    return dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), normalized);
  });

  ipcMain.handle('dialog:show-save', async (event, options = {}) => {
    const normalized = { ...options };
    delete normalized.browserWindow;
    return dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), normalized);
  });

  ipcMain.handle('dialog:openFile', async (event, options = {}) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { properties: ['openFile'], ...options });
    return result;
  });

  ipcMain.handle('dialog:openDirectory', async (event, options = {}) => {
    return dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { properties: ['openDirectory'], ...options });
  });

  ipcMain.handle('source-mode:open-folder-picker', async (event, options = {}) => {
    const fixture = process.env.EAGLE_SOURCE_FOLDER_FIXTURE;
    if (fixture) {
      return { canceled: false, filePaths: [path.resolve(fixture)] };
    }
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      properties: ['openDirectory', 'multiSelections'],
      ...options,
    });
    return { canceled: result.canceled, filePaths: result.filePaths || [] };
  });

  ipcMain.handle('source-mode:add-path', async (event, filePath) => {
    const root = await apiRequest('/api/source-roots/addPath', {
      method: 'POST',
      body: { path: String(filePath || '') },
    });
    allowRoot(root.path || filePath);
    return root;
  });

  ipcMain.handle('source-mode:pick-and-add', async (event, options = {}) => {
    const fixture = process.env.EAGLE_SOURCE_FOLDER_FIXTURE;
    let result;
    if (fixture) {
      result = { canceled: false, filePaths: [path.resolve(fixture)] };
    } else {
      result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
        properties: ['openDirectory', 'multiSelections'],
        ...options,
      });
    }
    if (result.canceled) return [];
    const roots = [];
    for (const filePath of result.filePaths || []) {
      const root = await apiRequest('/api/source-roots/addPath', {
        method: 'POST',
        body: { path: filePath },
      });
      allowRoot(root.path || filePath);
      roots.push(root);
    }
    return roots;
  });

  ipcMain.handle('source-mode:list', async () => {
    const roots = await apiRequest('/api/source-roots');
    for (const root of roots || []) {
      if (root && root.path) allowRoot(root.path);
    }
    return roots || [];
  });

  ipcMain.handle('source-mode:remove', async (event, id) => {
    return apiRequest('/api/source-roots/remove', {
      method: 'POST',
      body: { id: String(id || '') },
    });
  });

  ipcMain.handle('source-mode:rescan', async (event, id, relativePath) => {
    return apiRequest('/api/source-roots/rescan', {
      method: 'POST',
      body: { id: String(id || ''), relativePath: relativePath || null },
    });
  });

  ipcMain.handle('fs:list', (event, target = mockLibraryRoot) => {
    const resolved = safeResolve(target);
    if (!fs.existsSync(resolved)) return [];
    return fs.readdirSync(resolved, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(resolved, entry.name),
    }));
  });

  ipcMain.handle('fs:read', (event, target) => {
    const resolved = safeResolve(target);
    if (!fs.existsSync(resolved)) return null;
    return fs.readFileSync(resolved).toString('base64');
  });

  ipcMain.handle('library:resolve', (event, target = mockLibraryRoot) => safeResolve(target));

  ipcMain.handle('thumbnail:native', (event, target, options = {}) => {
    const resolved = safeResolve(target);
    if (!fs.existsSync(resolved)) return '';
    const size = Math.min(Number(options.size) || 320, 4096);
    const image = nativeImage.createFromPath(resolved).resize({ width: size, height: size });
    return image.toDataURL();
  });

  ipcMain.handle('item:update-many', (event, items = []) => apiRequest('/api/item/updateMany', {
    method: 'POST',
    body: { items: Array.isArray(items) ? items : [items] },
  }));
  ipcMain.handle('item:batch-save', (event, params = {}) => apiRequest('/api/item/batchSave', {
    method: 'POST',
    body: params,
  }));
  ipcMain.handle('item:move-to-trash', (event, ids = []) => apiRequest('/api/item/moveToTrash', {
    method: 'POST',
    body: { ids: Array.isArray(ids) ? ids : [ids] },
  }));
  ipcMain.handle('item:restore', (event, ids = []) => apiRequest('/api/item/restore', {
    method: 'POST',
    body: { ids: Array.isArray(ids) ? ids : [ids] },
  }));

  ipcMain.handle('duplicates:scan', (event, params = {}) => apiRequest('/api/item/duplicates/scan', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('duplicates:merge', (event, params = {}) => apiRequest('/api/item/mergeDuplicates', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('smoke:menu-popups', () => menuPopupCaptures);
  if (menuPopupSmokeMode) {
    const serializeNativeMenu = (menu) => (menu && menu.items ? menu.items : []).map((it) => ({
      label: it.label,
      type: it.type,
      visible: it.visible,
      submenu: it.submenu ? (it.submenu.items || []).length : undefined,
    }));
    ipcMain.on('smoke:menu-popup', (event, tpl = {}) => {
      try {
        // application-menu 站点：模板 main 侧原生序列化（remote 读 items 经代理，实测为空）
        if (tpl.site === 'application-menu') {
          menuPopupCaptures.push({ site: tpl.site, items: serializeNativeMenu(Menu.getApplicationMenu()) });
        } else {
          menuPopupCaptures.push(tpl);
        }
        if (menuPopupOutFile) fs.writeFileSync(menuPopupOutFile, JSON.stringify(menuPopupCaptures));
      } catch (err) { /* 忽略非法模板 */ }
    });
  }
  ipcMain.handle('duplicates:empty-trash', (event, params = {}) => apiRequest('/api/item/emptyTrash', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('duplicates:status', (event, jobId) => apiRequest(`/api/jobs/${encodeURIComponent(jobId)}`));
  ipcMain.handle('duplicates:cancel', (event, jobId) => apiRequest(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    body: {},
  }));

  ipcMain.handle('item:set-custom-thumbnail', (event, params = {}) => apiRequest('/api/item/setCustomThumbnail', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('item:reset-custom-thumbnail', (event, params = {}) => apiRequest('/api/item/resetCustomThumbnail', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('item:refresh-thumbnail', (event, params = {}) => apiRequest('/api/item/refreshThumbnail', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('thumbnail-task:start', (event, params = {}) => apiRequest('/api/item/thumbnailTask/start', {
    method: 'POST',
    body: params,
  }));
  ipcMain.handle('thumbnail-task:status', (event, taskId) => apiRequest(`/api/item/thumbnailTask/status?taskId=${encodeURIComponent(String(taskId || ''))}`));
  ipcMain.handle('thumbnail-task:cancel', (event, taskId) => apiRequest('/api/item/thumbnailTask/cancel', {
    method: 'POST',
    body: { taskId },
  }));

  ipcMain.handle('clipboard:readImage', () => clipboard.readImage().toDataURL());
  ipcMain.on('clipboard:read-sync', (event) => {
    const image = clipboard.readImage();
    event.returnValue = {
      text: clipboard.readText() || '',
      imageDataUrl: image && !image.isEmpty() ? image.toDataURL() : '',
      filePaths: clipboardFilePaths(),
      formats: clipboard.availableFormats(),
    };
  });
  ipcMain.handle('clipboard:read', () => {
    const image = clipboard.readImage();
    return {
      text: clipboard.readText() || '',
      imageDataUrl: image && !image.isEmpty() ? image.toDataURL() : '',
      filePaths: clipboardFilePaths(),
      formats: clipboard.availableFormats(),
    };
  });
  ipcMain.handle('clipboard:import', async (event, params = {}) => {
    const folder = params.folder && params.folder.id ? params.folder : null;
    const folderIDs = folder ? [folder.id] : [];
    const tags = folder && Array.isArray(folder.extendTags) ? folder.extendTags : [];
    const explicitPaths = Array.isArray(params.files)
      ? params.files.filter((value) => typeof value === 'string' && value.trim())
      : clipboardFilePaths();
    if (explicitPaths.length > 0) {
      return apiRequest('/api/item/addFromPaths', {
        method: 'POST',
        body: { images: explicitPaths.map((sourcePath) => ({ path: sourcePath, folderIDs, tags })) },
      });
    }
    const image = clipboard.readImage();
    if (!image || image.isEmpty()) throw new Error('Clipboard does not contain an image or file paths');
    return [await apiRequest('/api/item/importBase64', {
      method: 'POST',
      body: {
        data: image.toDataURL(),
        name: params.name || `Clipboard - ${new Date().toISOString().replace(/[:T]/g, '-').replace(/\.\d{3}Z$/, '')}`,
        ext: 'png',
        tags: tags.join(','),
        folderIDs,
        annotation: params.annotation || '',
      },
    })];
  });

  ipcMain.handle('item:importPaths', async (event, paths = []) => {
    const list = Array.isArray(paths) ? paths : [paths];
    const result = await apiRequest('/api/item/addFromPaths', {
      method: 'POST',
      body: { images: list.map((sourcePath) => ({ path: sourcePath })) },
    });
    await refreshCachedCurrentLibrary();
    return result;
  });

  ipcMain.handle('item:import-files', async (event, params = {}) => {
    const files = Array.isArray(params.files) ? params.files : [];
    const started = await apiRequest('/api/item/importPaths/start', {
      method: 'POST',
      body: { ...params, files },
    });
    const jobId = started.job.id;
    while (true) {
      const job = await apiRequest(`/api/jobs/${jobId}`);
      event.sender.send('import-file-progress', job);
      const previousCount = Number(event.sender.__eagleImportFileCount || 0);
      const currentItems = job.result && Array.isArray(job.result.items) ? job.result.items : [];
      for (const item of currentItems.slice(previousCount)) event.sender.send('file-uploaded', item);
      event.sender.__eagleImportFileCount = currentItems.length;
      if (job.status === 'complete' || job.status === 'cancelled') {
        event.sender.__eagleImportFileCount = 0;
        await refreshCachedCurrentLibrary();
        return currentItems;
      }
      if (job.status === 'error') throw new Error(job.error || job.message);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  });

  ipcMain.handle('item:import-folders', async (event, params = {}) => {
    const folderPaths = Array.isArray(params.paths) ? params.paths : [params.path || params.folderPath].filter(Boolean);
    const results = [];
    for (const folderPath of folderPaths) {
      const started = await apiRequest('/api/item/importFolder/start', {
        method: 'POST',
        body: { ...params, folderPath },
      });
      const jobId = started.job.id;
      while (true) {
      const job = await apiRequest(`/api/jobs/${jobId}`);
      event.sender.send('import-folder-progress', job);
      const previousCount = Number(event.sender.__eagleImportFolderCount || 0);
      const currentItems = job.result && Array.isArray(job.result.items) ? job.result.items : [];
      for (const item of currentItems.slice(previousCount)) event.sender.send('file-uploaded', item);
      event.sender.__eagleImportFolderCount = currentItems.length;
      if (job.status === 'complete' || job.status === 'cancelled') {
        event.sender.__eagleImportFolderCount = 0;
        results.push(job.result);
        await refreshCachedCurrentLibrary();
        break;
      }
        if (job.status === 'error') throw new Error(job.error || job.message);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }
    return results;
  });

  ipcMain.handle('item:import-url', async (event, params = {}) => {
    const result = await apiRequest('/api/item/addFromURL', {
      method: 'POST',
      body: params,
    });
    await refreshCachedCurrentLibrary();
    return result;
  });

  ipcMain.handle('item:import-urls', async (event, params = {}) => {
    const result = await apiRequest('/api/item/addFromURLs', {
      method: 'POST',
      body: { images: Array.isArray(params) ? params : params.images || params.urls || [] },
    });
    await refreshCachedCurrentLibrary();
    return result;
  });

  const downloadDirect = (params = {}) => apiRequest('/api/download/direct', {
    method: 'POST',
    body: {
      url: params.url,
      headers: params.headers,
      referer: params.referer,
      userAgent: params.userAgent,
      validateImage: params.validateImage,
    },
  });
  ipcMain.handle('download:direct', (event, params = {}) => downloadDirect(params));
  ipcMain.handle('download:start', (event, params = {}) => apiRequest('/api/download/start', { method: 'POST', body: params }));
  ipcMain.handle('download:status', (event, taskId) => apiRequest(taskId ? `/api/download/${encodeURIComponent(taskId)}` : '/api/download/status'));
  ipcMain.handle('download:cancel', (event, taskId) => apiRequest(`/api/download/${encodeURIComponent(taskId)}/cancel`, { method: 'POST', body: {} }));
  ipcMain.handle('download:release', (event, taskIdOrPath) => apiRequest('/api/download/release', { method: 'POST', body: { taskId: taskIdOrPath, path: taskIdOrPath } }));

  // 原版下载器只需要临时文件路径；目标目录和文件名由后端统一管理，避免 renderer 获得任意写权限。
  ipcMain.handle('downloadWithNet', async (event, params = {}) => (await downloadDirect(params)).path);
  ipcMain.handle('downloadWithRequest', async (event, params = {}) => (await downloadDirect(params)).path);

  ipcMain.handle('export:images', (event, params = {}) => runExport(event, 'images', params));
  ipcMain.handle('export:as-folder', (event, params = {}) => runExport(event, 'as-folder', params));
  ipcMain.handle('export:eaglepack', (event, params = {}) => runArchiveExport(event, params));
  ipcMain.handle('export:cancel', (event, jobId) => {
    if (!jobId) {
      for (const job of exportJobs.values()) job.cancelled = true;
      return exportJobs.size > 0;
    }
    const job = exportJobs.get(jobId);
    if (!job) return false;
    job.cancelled = true;
    return true;
  });

  ipcMain.on('export-images', (event, params = {}) => {
    runExport(event, 'images', params).catch(() => {});
  });
  ipcMain.on('export-as-folder', (event, params = {}) => {
    runExport(event, 'as-folder', params).catch(() => {});
  });
  ipcMain.on('cancel.all', () => {
    for (const job of exportJobs.values()) job.cancelled = true;
    apiRequest('/api/jobs/cancel-active', { method: 'POST', body: {} }).catch(() => {});
  });
  ipcMain.on('show-item-in-folder', async (event, target) => {
    try {
      const resolved = await resolveRevealTarget(target);
      if (resolved.kind === 'item') await revealItem(resolved.id);
      else await revealExportResult(resolved.jobId);
    } catch (err) {
      event.sender.send('preview:action-result', { ok: false, action: 'show-item-in-folder', error: err.message });
    }
  });
  ipcMain.on('open-with-default', async (event, rawPath) => {
    try {
      const id = await itemIdFromPath(rawPath);
      await openItemDefault(id);
    } catch (err) {
      event.sender.send('preview:action-result', { ok: false, action: 'open-with-default', error: err.message });
    }
  });
  ipcMain.on('copy-images', async (event, items = []) => {
    try {
      const first = Array.isArray(items) ? items[0] : items;
      const id = first && (first.id || (typeof first === 'string' ? first : ''));
      if (!id) throw new Error('Copy images requires an item ID');
      await copyItemImage(id);
    } catch (err) {
      event.sender.send('preview:action-result', { ok: false, action: 'copy-images', error: err.message });
    }
  });
  // ── b1-9aa：后台窗通道族接管（原 background.js 承接；后台窗链路早期已断，b1-9w
  // 逐字移植的菜单点击路径此前为空放——本块把通道接进 backend 数据面 / main 直连）──

  // export-as-folder：{folder?, images, savePath, needSpace} → /api/export/as-folder
  // （renderer 恒发 folder:undefined → backend exportImages 分支，形状一致）
  ipcMain.on('export-as-folder', async (event, params = {}) => {
    try {
      const images = (Array.isArray(params.images) ? params.images : [])
        .map((entry) => (entry && entry.id) || entry).filter(Boolean);
      if (!params.savePath || images.length === 0) return;
      const result = await apiRequest('/api/export/as-folder', { method: 'POST', body: { savePath: params.savePath, images } });
      console.log(`[b1-9aa] export-as-folder done: ${JSON.stringify(result).slice(0, 200)}`);
    } catch (err) {
      console.error(`[b1-9aa] export-as-folder failed: ${err.message}`);
    }
  });

  // export-images（选中项打包 .eaglepack）→ /api/export/eaglepack/start
  // （job 型；packLibrary resolveSelectedItems 吃 items id 数组）
  ipcMain.on('export-images', async (event, params = {}) => {
    try {
      const items = (Array.isArray(params.images) ? params.images : [])
        .map((entry) => (entry && entry.id) || entry).filter(Boolean);
      if (!params.savePath || items.length === 0) return;
      const result = await apiRequest('/api/export/eaglepack/start', { method: 'POST', body: { destFile: params.savePath, items } });
      console.log(`[b1-9aa] export-images job: ${JSON.stringify(result).slice(0, 200)}`);
    } catch (err) {
      console.error(`[b1-9aa] export-images failed: ${err.message}`);
    }
  });

  // regenerate-thumbnail（批次）→ 逐文件 /api/item/thumbnailTask/start（backend 队列）
  ipcMain.on('regenerate-thumbnail', async (event, files = []) => {
    try {
      const list = Array.isArray(files) ? files : [];
      for (const file of list) {
        if (!file || !file.id) continue;
        await apiRequest('/api/item/thumbnailTask/start', { method: 'POST', body: { id: file.id } });
      }
      if (list.length > 0) console.log(`[b1-9aa] regenerate-thumbnail enqueued: ${list.length}`);
    } catch (err) {
      console.error(`[b1-9aa] regenerate-thumbnail failed: ${err.message}`);
    }
  });

  // regenerate-video-thumbnail：{video, startAt} → thumbnailTask/start {id, startAt}
  ipcMain.on('regenerate-video-thumbnail', async (event, params = {}) => {
    try {
      const video = params && params.video;
      if (!video || !video.id) return;
      await apiRequest('/api/item/thumbnailTask/start', { method: 'POST', body: { id: video.id, startAt: params.startAt } });
      console.log(`[b1-9aa] regenerate-video-thumbnail enqueued: ${video.id} @${params.startAt}`);
    } catch (err) {
      console.error(`[b1-9aa] regenerate-video-thumbnail failed: ${err.message}`);
    }
  });

  // set-custom-thumbnail：{item, thumbnailPath, width?, height?} → /api/item/setCustomThumbnail
  // （customThumbnailService.set 拷贝入 .info + 色板分析 + metadata 更新），完成后
  // rebind-refresh 通知渲染层（bundle 时代 background 发 thumbnail-generated 的等价刷新面）；
  // b1-9ae：另回发 thumbnail-generated(item)——apiServerDomain machinerySetCustomThumbnail
  // 的承诺链等这个回程事件 resolve（bundle 时代 background 完成缩图后的回程事件同型）
  ipcMain.on('set-custom-thumbnail', async (event, params = {}) => {
    try {
      const item = params.item || {};
      if (!params.thumbnailPath || !item.id) return;
      await apiRequest('/api/item/setCustomThumbnail', {
        method: 'POST',
        body: { id: item.id, thumbnailPath: params.thumbnailPath, width: params.width, height: params.height },
      });
      event.sender.send('thumbnail-generated', item);
      event.sender.send('rebind-refresh');
    } catch (err) {
      console.error(`[b1-9aa] set-custom-thumbnail failed: ${err.message}`);
    }
  });

  // duplicate-file → /api/item/duplicate（backend 拷贝 .info + metadata 换 id + 内存注册）
  ipcMain.on('duplicate-file', async (event, id) => {
    try {
      if (!id) return;
      await apiRequest('/api/item/duplicate', { method: 'POST', body: { id } });
      event.sender.send('rebind-refresh');
    } catch (err) {
      console.error(`[b1-9aa] duplicate-file failed: ${err.message}`);
    }
  });

  // copy-thumbnails：缩略图文件入剪贴板（原 background win 分支转发 copy-win-files，
  // 本仓 main 从未实现——补 CF_HDROP 写入；单图失败回落位图）
  ipcMain.on('copy-thumbnails', async (event, images = []) => {
    try {
      const library = await currentLibrary();
      const imagesDir = path.join(library.rootDir, 'images');
      const paths = (Array.isArray(images) ? images : []).map((image) => {
        if (!image || !image.id) return '';
        const infoDir = path.join(imagesDir, `${image.id}.info`);
        const target = image.noThumbnail
          ? path.join(infoDir, `${image.name}.${image.ext}`)
          : path.join(infoDir, `${image.name}_thumbnail.png`);
        return fs.existsSync(target) ? target : '';
      }).filter(Boolean);
      if (!paths.length) return;
      copyWinFilesToClipboard(paths);
    } catch (err) {
      console.error(`[b1-9aa] copy-thumbnails failed: ${err.message}`);
    }
  });

  // open-with-dialog：原 EdgeJS.openAppDialog 等价（win32 rundll32 打开方式对话框）
  ipcMain.on('open-with-dialog', (event, rawPath) => {
    try {
      const target = String(rawPath || '');
      if (!target || process.platform !== 'win32') return;
      require('node:child_process').spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLLW', target], { detached: true, stdio: 'ignore' }).unref();
    } catch (err) {
      console.error(`[b1-9aa] open-with-dialog failed: ${err.message}`);
    }
  });

  ipcMain.on('ondragstart', async (event, params = {}) => {
    try {
      let images = params.images;
      if (typeof images === 'string') {
        try {
          images = JSON.parse(images);
        } catch (err) {
          images = [];
        }
      }
      const rawIds = Array.isArray(images)
        ? images.map((entry) => (entry && entry.id) || (typeof entry === 'string' ? entry : ''))
        : [];
      const target = params.target;
      if (target) rawIds.unshift((target && target.id) || (typeof target === 'string' ? target : ''));
      const ids = [...new Set(rawIds.map((id) => String(id || '')).filter(Boolean))];
      if (ids.length === 0) throw new Error('Drag start requires an item ID');
      await startItemDrag(event, ids);
    } catch (err) {
      event.sender.send('preview:action-result', { ok: false, action: 'ondragstart', error: err.message });
    }
  });
}

function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Library',
          click: async () => {
            const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
            if (!result.canceled && result.filePaths[0]) await switchLibrary(result.filePaths[0]);
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Eagle Reverse Workbench', click: () => shell.openExternal('http://localhost:5176/workbench.html') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupTray() {
  if (smokeMode || pluginSmokeMode || desktopSmokeMode || librarySmokeMode) return null;
  const iconPath = path.join(__dirname, '../frontend/public/browser-extension/icons/icon128.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  const tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Eagle Reverse');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Workbench', click: () => createWindow({ url: 'http://localhost:5176/workbench.html' }) },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
  return tray;
}

async function loadServicePlugins() {
  try {
    const { loadServicePlugin } = await import('../backend/src/plugin-runtime.js');
    const pluginRoot = path.resolve(__dirname, '..', '..', 'plugins', 'example-service-plugin');
    const plugin = loadServicePlugin(pluginRoot);
    plugin.runLifecycle();
    console.log(`Loaded service plugin: ${plugin.manifest.name} (${plugin.manifest.id})`);
  } catch (err) {
    console.warn(`Service plugin load failed: ${err.message}`);
  }
}

if (smokeMode || pluginSmokeMode || desktopSmokeMode || librarySmokeMode || mainWorkflowSmokeMode || documentViewerSmokeMode || browserCaptureUiSmokeMode || previewDeliverySmokeMode || exportProgressSmokeMode || videoDetailSmokeMode || regressionHostMode || dragSmokeMode || channelsSmokeMode) {
  app.setPath('userData', process.env.EAGLE_ELECTRON_USER_DATA_DIR || path.join(os.tmpdir(), `eagle-reverse-smoke-${process.pid}`));
}

app.whenReady().then(async () => {
  registerIpc();
  setupMenu();
  await loadServicePlugins();
  if (browserCaptureUiSmokeMode) {
    const timeout = setTimeout(() => {
      console.error('BROWSER_CAPTURE_UI_SMOKE_TIMEOUT');
      app.quit();
    }, 60000);
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const waitFor = (check, label, timeout = 15000) => new Promise((resolve, reject) => {
                const deadline = Date.now() + timeout;
                const poll = async () => {
                  try {
                    const value = await check();
                    if (value) { resolve(value); return; }
                  } catch (err) {}
                  if (Date.now() >= deadline) { reject(new Error(label + ' timeout')); return; }
                  setTimeout(poll, 75);
                };
                poll();
              });
              const scope = await waitFor(() => {
                // b1-9d：双轨 scope 等待——bundle 在世时 window.$bodyScope 已由 main.tsx 归一为
                // 真实 scope；去 Angular 后为 shim 代理（machinery 填充 raw/listDone）。
                const bodyScope = window.$bodyScope || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'original main scope', 25000);
              const extensionBase = ${JSON.stringify(process.env.EAGLE_EXTENSION_URL || 'http://localhost:41593')};
              const imageUrl = ${JSON.stringify(process.env.EAGLE_CAPTURE_IMAGE_URL || '')};
              const folderId = ${JSON.stringify(process.env.EAGLE_CAPTURE_FOLDER_ID || '')};
              const ipc = require('electron').ipcRenderer;
              const counts = { fileUploaded: 0, fileUploadedEnd: 0, operationResult: 0 };
              const countListener = (_event, value) => {
                if (value && value.items) counts.operationResult += 1;
              };
              ipc.on('file-uploaded', () => { counts.fileUploaded += 1; });
              ipc.on('file-uploaded-end', () => { counts.fileUploadedEnd += 1; });
              ipc.on('import:operation-result', countListener);
              const before = scope.raw.length;
              const body = new URLSearchParams({
                type: 'image',
                src: imageUrl,
                title: 'Browser Capture UI',
                url: imageUrl,
                website: 'http://127.0.0.1:1',
                'tags[0]': 'capture-ui',
              });
              if (folderId) body.set('folderIDs[0]', folderId);
              const response = await fetch(extensionBase + '/api/item/addURL', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
              });
              const payload = await response.json();
              if (payload.status !== 'success') throw new Error('capture API failed: ' + JSON.stringify(payload));
              const item = await waitFor(() => scope.raw.find((entry) => entry && entry.name === 'Browser Capture UI'), 'capture item refresh', 15000);
              await waitFor(() => counts.fileUploaded >= 1 && counts.fileUploadedEnd >= 1 && counts.operationResult >= 1, 'capture UI events', 10000);
              return {
                before,
                after: scope.raw.length,
                itemId: item.id,
                fileUploaded: counts.fileUploaded,
                fileUploadedEnd: counts.fileUploadedEnd,
                operationResult: counts.operationResult,
                apiName: payload.data.name,
              };
            })()`
          );
          const current = await apiRequest('/api/library/current?includeItems=true');
          const item = current.items.find((entry) => entry.id === result.itemId);
          const infoDir = item ? path.join(current.imagesDir, `${item.id}.info`) : '';
          const diskOk = Boolean(
            item &&
            fs.existsSync(path.join(infoDir, `${item.name}.${item.ext}`)) &&
            fs.existsSync(path.join(infoDir, `${item.name}_thumbnail.png`)) &&
            fs.existsSync(path.join(infoDir, 'metadata.json'))
          );
          const ok = result.after >= result.before + 1 &&
            result.fileUploaded === 1 &&
            result.fileUploadedEnd === 1 &&
            result.operationResult === 1 &&
            result.apiName === 'Browser Capture UI' &&
            diskOk;
          console.log(ok ? `BROWSER_CAPTURE_UI_OK ${JSON.stringify({ ...result, diskOk })}` : `BROWSER_CAPTURE_UI_FAIL ${JSON.stringify({ ...result, diskOk, item })}`);
        } catch (err) {
          console.error(`BROWSER_CAPTURE_UI_ERROR ${err.stack || err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (mainWorkflowSmokeMode) {
    const timeout = setTimeout(() => {
      console.error('MAIN_WORKFLOW_SMOKE_TIMEOUT');
      app.quit();
    }, 70000);
    const clipboardImageSource = process.env.EAGLE_WORKFLOW_CLIPBOARD_IMAGE_SOURCE || '';
    if (clipboardImageSource && fs.existsSync(clipboardImageSource)) {
      clipboard.writeImage(nativeImage.createFromPath(clipboardImageSource));
    }
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const waitFor = (check, label, timeout = 15000) => new Promise((resolve, reject) => {
                const deadline = Date.now() + timeout;
                const poll = async () => {
                  try {
                    const value = await check();
                    if (value) { resolve(value); return; }
                  } catch (err) {}
                  if (Date.now() >= deadline) { reject(new Error(label + ' timeout')); return; }
                  setTimeout(poll, 50);
                };
                poll();
              });
              const scope = await waitFor(() => {
                // b1-9d：双轨 scope 等待——bundle 在世时 window.$bodyScope 已由 main.tsx 归一为
                // 真实 scope；去 Angular 后为 shim 代理（machinery 填充 raw/listDone）。
                const bodyScope = window.$bodyScope || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'original main scope', 25000);
              const source = ${JSON.stringify(process.env.EAGLE_WORKFLOW_FILE_SOURCE || '')};
              const textSource = ${JSON.stringify(process.env.EAGLE_WORKFLOW_TEXT_SOURCE || '')};
              // 【项目决策·IGNORED】markdown 组件不属于原框架（bundle 原版无 md 特殊处理），
              // 整体隔离排除：markdownSource 恒置空，下方 markdown 分支恒跳过。
              // 测试面同步排除（tests/main-ui-workflow-closed-loop.mjs 不再传该 env）。
              const markdownSource = '';
              const folderSource = ${JSON.stringify(process.env.EAGLE_WORKFLOW_FOLDER_SOURCE || '')};
              const clipboardSource = ${JSON.stringify(process.env.EAGLE_WORKFLOW_CLIPBOARD_SOURCE || '')};
              const workflowFolderId = ${JSON.stringify(process.env.EAGLE_WORKFLOW_FOLDER_ID || '')};
              const sendAndWait = (channel, params, label) => new Promise((resolve, reject) => {
                const ipc = require('electron').ipcRenderer;
                const onResult = (_event, result) => {
                  if (!result || result.channel !== channel) return;
                  ipc.off('import:operation-result', onResult);
                  if (result.ok) resolve(result);
                  else reject(new Error(result.error || label + ' failed'));
                };
                ipc.on('import:operation-result', onResult);
                ipc.send(channel, params);
              });

              const assertUniqueItems = (label) => {
                const ids = scope.raw.map((item) => item && item.id).filter(Boolean);
                if (new Set(ids).size !== ids.length) {
                  const counts = ids.reduce((result, id) => {
                    result[id] = (result[id] || 0) + 1;
                    return result;
                  }, {});
                  throw new Error(label + ' inserted duplicate item IDs: ' + JSON.stringify(Object.entries(counts).filter(([, count]) => count > 1)));
                }
              };
              const currentItem = (id) => (scope.itemMappings && scope.itemMappings[id]) || scope.raw.find((item) => item.id === id);
              const selectItems = async (ids) => {
                scope.selected = [];
                scope.selectedMappings = {};
                ids.forEach((id, index) => {
                  const item = currentItem(id);
                  if (!item) throw new Error('selection item not found: ' + id);
                  scope.select({
                    button: 0,
                    ctrlKey: index > 0,
                    metaKey: false,
                    shiftKey: false,
                    stopPropagation() {},
                    preventDefault() {},
                  }, item);
                });
                scope.current = currentItem(ids[0]);
                scope.updateSelection();
                scope.$evalAsync();
                await new Promise((resolve) => setTimeout(resolve, 100));
              };
              const importResultCounts = {};
              const importResultErrors = [];
              const thumbnailGeneratedCounts = {};
              const importResultListener = (_event, result) => {
                if (result && result.ok && result.channel) {
                  importResultCounts[result.channel] = (importResultCounts[result.channel] || 0) + 1;
                } else if (result && result.channel && result.error) {
                  importResultErrors.push(result);
                }
              };
              const thumbnailGeneratedListener = (_event, item) => {
                if (item && item.id) thumbnailGeneratedCounts[item.id] = true;
              };
              require('electron').ipcRenderer.on('import:operation-result', importResultListener);
              require('electron').ipcRenderer.on('thumbnail-generated', thumbnailGeneratedListener);
              const textDrop = textSource ? await waitFor(async () => {
                onDropContainer({
                  preventDefault() {},
                  stopPropagation() {},
                  dataTransfer: {
                    files: [{ path: textSource, name: 'Dropped Text.txt', type: 'text/plain', size: 1, lastModified: Date.now() }],
                    getData: () => '',
                  },
                });
                const item = await waitFor(() => scope.raw.find((entry) => entry.name === 'Dropped Text'), 'text file drop import');
                if (item.ext !== 'txt') throw new Error('text drop imported unexpected extension: ' + item.ext);
                return item;
              }, 'text file drop import') : null;
              let markdownDrop = null;
              if (markdownSource) {
                onDropContainer({
                  preventDefault() {},
                  stopPropagation() {},
                  dataTransfer: {
                    files: [{ path: markdownSource, name: 'Dropped Markdown.md', type: 'text/markdown', size: 1, lastModified: Date.now() }],
                    getData: () => '',
                  },
                });
                const item = await new Promise((resolve, reject) => {
                  const deadline = Date.now() + 15000;
                  const poll = () => {
                    const found = scope.raw.find((entry) => entry.name === 'Dropped Markdown');
                    if (found) { resolve(found); return; }
                    const error = importResultErrors.find((entry) => entry.channel === 'upload-local-files');
                    if (error) { reject(new Error(error.error || 'markdown file drop import failed')); return; }
                    if (Date.now() >= deadline) {
                      reject(new Error('markdown file drop import timeout queue=' + (scope.uploadQueue || []).length + ' finish=' + (scope.finishQueue || []).length + ' raw=' + (scope.raw || []).map((entry) => entry && entry.name).join(',')));
                      return;
                    }
                    setTimeout(poll, 50);
                  };
                  poll();
                });
                if (item.ext !== 'md') throw new Error('markdown drop imported unexpected extension: ' + item.ext);
                markdownDrop = item;
              }
              await new Promise((resolve) => setTimeout(resolve, 100));
              if (textDrop) await waitFor(() => thumbnailGeneratedCounts[textDrop.id], 'text thumbnail generated');
              if (markdownDrop) {
                await new Promise((resolve, reject) => {
                  const deadline = Date.now() + 15000;
                  const poll = async () => {
                    if (thumbnailGeneratedCounts[markdownDrop.id]) {
                      resolve(true);
                      return;
                    }
                    let taskStatus = null;
                    try {
                      taskStatus = await window.eagleDesktop.thumbnail.status(markdownDrop.thumbnailTask);
                    } catch (err) {
                      taskStatus = { error: err.message };
                    }
                    if (Date.now() >= deadline) {
                      reject(new Error('markdown thumbnail generated timeout ' + JSON.stringify({
                        taskStatus,
                        thumbnailGeneratedCounts,
                        taskId: markdownDrop.thumbnailTask,
                      })));
                      return;
                    }
                    setTimeout(poll, 50);
                  };
                  poll();
                });
              }
              if (markdownDrop) {
                const latest = currentItem(markdownDrop.id);
                if (!latest || !Number(latest.width) || !Number(latest.height)) {
                  throw new Error('markdown placeholder dimensions lost after thumbnail refresh');
                }
                await waitFor(() => {
                  const meta = document.querySelector('#box-' + markdownDrop.id + ' .metas');
                  const text = meta && meta.textContent.trim();
                  return text && !/×/.test(text);
                }, 'markdown meta shows file size');
              }
              const before = scope.raw.length;
              onDropContainer({
                preventDefault() {},
                stopPropagation() {},
                dataTransfer: {
                  files: [{ path: source, name: 'Dropped Main.png', type: 'image/png', size: 1, lastModified: Date.now() }],
                  getData: () => '',
                },
              });
              const dropped = await waitFor(() => scope.raw.find((item) => item.name === 'Dropped Main'), 'file drop import');
              const droppedId = dropped.id;
              const uploadResultCount = 1 + (textDrop ? 1 : 0) + (markdownDrop ? 1 : 0);
              await waitFor(() => importResultCounts['upload-local-files'] === uploadResultCount, 'single file import result');
              await new Promise((resolve) => setTimeout(resolve, 100));
              if (importResultCounts['upload-local-files'] !== uploadResultCount) throw new Error('file drop emitted duplicate import results');
              assertUniqueItems('file drop import');

              onDropContainer({
                preventDefault() {},
                stopPropagation() {},
                dataTransfer: {
                  files: [{ path: folderSource, name: 'Dropped Folder' }],
                  getData: () => '',
                },
              });
              const folderItems = await waitFor(() => {
                const matches = scope.raw.filter((item) => item.id !== droppedId && item.name.startsWith('Folder Item'));
                return matches.length > 0 ? matches : null;
              }, 'folder drop import');
              assertUniqueItems('folder drop import');

              const clipboardResult = await sendAndWait('paste-paths', { files: [clipboardSource], folder: null }, 'clipboard path import');
              const clipboardItem = await waitFor(() => scope.raw.find((item) => clipboardResult.items.some((entry) => entry.id === item.id)), 'clipboard item refresh');
              assertUniqueItems('clipboard path import');
              const clipboardImageResult = await sendAndWait('read-win-files', { folder: null, params: {} }, 'clipboard image import');
              const clipboardImageItem = await waitFor(() => scope.raw.find((item) => clipboardImageResult.items.some((entry) => entry.id === item.id)), 'clipboard image refresh');
              assertUniqueItems('clipboard image import');

              const inspector = await waitFor(() => {
                const element = document.querySelector('#eagle-inspector-host .inspector');
                return element ? element : null;
              }, 'original inspector');
              const inspectorActions = window.__eagleInspectorActions;
              const selectInspectorItems = async (ids) => {
                await selectItems(ids);
                scope.selected = ids.map((id) => currentItem(id));
                scope.current = scope.selected[0] || null;
                inspectorActions.updateSelection();
                scope.$evalAsync();
                await waitFor(() => scope.selected.length === ids.length && scope.selected.every((item, index) => item && item.id === ids[index]), 'inspector selection');
                await new Promise((resolve) => setTimeout(resolve, 100));
              };
              await selectInspectorItems([droppedId]);
              scope.inspector.newName = 'Inspector Renamed';
              scope.inspector.newUrl = 'https://example.test/original-main';
              const firstInspectorResult = new Promise((resolve, reject) => {
                const ipc = require('electron').ipcRenderer;
                const timer = setTimeout(() => {
                  ipc.off('item:operation-result', onResult);
                  reject(new Error('inspector operation result timeout for ' + droppedId));
                }, 10000);
                const onResult = (_event, value) => {
                  const items = value && Array.isArray(value.items) ? value.items : [];
                  if (!items.some((item) => item.id === droppedId)) return;
                  clearTimeout(timer);
                  ipc.off('item:operation-result', onResult);
                  resolve(value);
                };
                ipc.on('item:operation-result', onResult);
              });
              inspectorActions.imagesChange();
              const firstInspectorOperation = await firstInspectorResult;
              if (!firstInspectorOperation || !firstInspectorOperation.ok) throw new Error('inspector update failed: ' + JSON.stringify(firstInspectorOperation));
              const firstUpdatedItem = Array.isArray(firstInspectorOperation.items) ? firstInspectorOperation.items.find((item) => item.id === droppedId) : null;
              if (!firstUpdatedItem || firstUpdatedItem.name !== 'Inspector Renamed' || firstUpdatedItem.url !== 'https://example.test/original-main') {
                throw new Error('inspector operation returned unexpected item: ' + JSON.stringify(firstInspectorOperation));
              }
              await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                const item = current.items.find((entry) => entry.id === droppedId);
                return item && item.name === 'Inspector Renamed' && item.url === 'https://example.test/original-main';
              }, 'inspector name and URL persistence');

              scope.inspector.newAnnotation = '原版检查器真实持久化';
              inspectorActions.annotationChange();
              await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                const item = current.items.find((entry) => entry.id === droppedId);
                return item && item.annotation === '原版检查器真实持久化';
              }, 'inspector annotation persistence');

              scope.TagManager.addTags(['main-ui', 'persisted']);
              const workflowFolder = await waitFor(() => scope.folders.find((folder) => folder.id === workflowFolderId), 'workflow folder');
              scope.addImagesToFolder([dropped], workflowFolder);
              scope.changeStar(4, false, true);

              const renamed = await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                const item = current.items.find((entry) => entry.id === droppedId);
                return item && item.name === 'Inspector Renamed' && item.url === 'https://example.test/original-main' && item.annotation === '原版检查器真实持久化' && item.star === 4 && item.tags.includes('main-ui') && item.folders.includes(workflowFolder.id) ? item : null;
              }, 'inspector tags folder and star persistence');

              await selectInspectorItems([droppedId, clipboardItem.id]);
              scope.inspector.newAnnotation = '多选备注持久化';
              inspectorActions.annotationChange();
              scope.TagManager.addTag('batch-ui');
              scope.changeStar(3, false, true);
              await new Promise((resolve, reject) => {
                const deadline = Date.now() + 15000;
                const poll = async () => {
                  try {
                    const current = await window.eagleDesktop.library.current();
                    const targets = current.items.filter((entry) => entry.id === droppedId || entry.id === clipboardItem.id);
                    if (targets.length === 2 && targets.every((item) => item.annotation === '多选备注持久化' && item.star === 3 && item.tags.includes('batch-ui'))) {
                      resolve(targets);
                      return;
                    }
                    if (Date.now() >= deadline) {
                      reject(new Error('multi inspector persistence timeout ' + JSON.stringify({
                        droppedId,
                        clipboardId: clipboardItem && clipboardItem.id,
                        targets,
                        selectedIds: scope.selected && scope.selected.map((item) => item && item.id),
                      })));
                      return;
                    }
                  } catch (err) {
                    if (Date.now() >= deadline) reject(err);
                  }
                  setTimeout(poll, 50);
                };
                poll();
              });
              await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                const historyTags = current.tags && Array.isArray(current.tags.historyTags) ? current.tags.historyTags : [];
                return historyTags.includes('main-ui') && historyTags.includes('batch-ui');
              }, 'tag history persistence', 10000);

              await selectItems([droppedId]);
              scope.enterDetailMode(null, currentItem(droppedId));
              const detailContainer = document.querySelector('#detail-container');
              const detailLockedBeforeOriginal = document.body.classList.contains('eagle-detail-awaiting-original')
                && detailContainer
                && Number(getComputedStyle(detailContainer).opacity) === 0
                && window.__eagleDetailDeliveryState
                && window.__eagleDetailDeliveryState.itemId === droppedId
                && window.__eagleDetailDeliveryState.mode === 'waiting';
              const detailMode = await waitFor(() => scope.isDetailMode === true && scope.current && scope.current.id === droppedId, 'detail mode');
              const detailDelivery = await waitFor(() => {
                const state = window.__eagleDetailDeliveryState;
                if (!state || state.itemId !== droppedId || !state.releasedAt || state.mode !== 'canvas') return null;
                const canvas = document.querySelector('#bitmap-viewer canvas');
                return canvas && canvas.width > 1 && canvas.height > 1
                  ? {
                      itemId: state.itemId,
                      mode: state.mode,
                      tileCount: state.tileCount,
                      lockedDuration: state.releasedAt - state.lockedAt,
                      canvasWidth: canvas.width,
                      canvasHeight: canvas.height,
                      visible: !document.body.classList.contains('eagle-detail-awaiting-original')
                        && Number(getComputedStyle(document.querySelector('#detail-container')).opacity) > 0,
                    }
                  : null;
              }, 'detail original delivery', 20000).catch(async (err) => {
                // 超时诊断（同 markdown 缩略图门的富错误约定）：闸门状态 + 画布/容器实况
                const state = window.__eagleDetailDeliveryState || null;
                const canvas = document.querySelector('#bitmap-viewer canvas');
                const viewer = document.querySelector('#bitmap-viewer');
                const rect = (sel) => {
                  const el = document.querySelector(sel);
                  if (!el) return 'NONE';
                  const box = el.getBoundingClientRect();
                  return Math.round(box.width) + 'x' + Math.round(box.height);
                };
                const rawUrl = typeof scope.getRawUrl === 'function' ? String(scope.getRawUrl(scope.current) || '') : '';
                let rawStatus = 'SKIP';
                try {
                  const probe = await fetch(rawUrl, { method: 'GET' });
                  rawStatus = probe.status + '/' + (probe.headers.get('content-length') || '?');
                } catch (fetchErr) { rawStatus = 'THROW ' + fetchErr.message; }
                throw new Error(err.message + ' ' + JSON.stringify({
                  state,
                  canvas: canvas ? canvas.width + 'x' + canvas.height : 'NO-CANVAS',
                  rects: { detailContainer: rect('#detail-container'), bitmapViewer: rect('#bitmap-viewer'), preloader: rect('.smooth_zoom_preloader'), detailImage: rect('#detail-image') },
                  viewerParent: viewer && viewer.parentElement ? (viewer.parentElement.id || '') + '.' + viewer.parentElement.className : 'NONE',
                  viewerStyle: viewer ? getComputedStyle(viewer).height + '/' + getComputedStyle(viewer).display + '/' + getComputedStyle(viewer).position : 'NONE',
                  currentName: scope.current && scope.current.name + '.' + scope.current.ext,
                  currentSize: scope.current && scope.current.width + 'x' + scope.current.height,
                  rawUrl: rawUrl.slice(-80),
                  rawStatus,
                }));
              });
              const previewResultPromise = new Promise((resolve, reject) => {
                const ipc = require('electron').ipcRenderer;
                const timer = setTimeout(() => reject(new Error('preview open timeout')), 10000);
                ipc.once('preview:operation-result', (_event, value) => { clearTimeout(timer); resolve(value); });
              });
              require('electron').ipcRenderer.send('open-preview-window', { images: [currentItem(droppedId)], pluginModule: window.pluginModule });
              const previewResult = await previewResultPromise;

              scope.leaveDetailMode();
              await selectItems([droppedId]);
              scope.removeSelected();
              await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                return current.items.find((item) => item.id === droppedId && item.isDeleted);
              }, 'trash persistence');

              scope.viewMode = 'trash';
              const trashedItem = currentItem(droppedId);
              trashedItem.isDeleted = false;
              delete trashedItem.deletedTime;
              require('electron').ipcRenderer.send('images-change', [trashedItem]);
              await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                return current.items.find((item) => item.id === droppedId && !item.isDeleted);
              }, 'restore persistence');
              require('electron').ipcRenderer.off('import:operation-result', importResultListener);

              return {
                originalPage: location.pathname.endsWith('/src/app/index.html'),
                originalScope: typeof scope.enterDetailMode === 'function' && typeof scope.removeSelected === 'function',
                originalInspector: Boolean(inspector) && typeof inspectorActions.imagesChange === 'function' && typeof inspectorActions.annotationChange === 'function',
                before,
                after: scope.raw.length,
                fileDrop: Boolean(dropped),
                textDrop: Boolean(textDrop),
                textDropExt: textDrop && textDrop.ext,
                textThumbnailGenerated: Boolean(textDrop && thumbnailGeneratedCounts[textDrop.id]),
                markdownDrop: Boolean(markdownDrop),
                markdownDropExt: markdownDrop && markdownDrop.ext,
                markdownThumbnailGenerated: Boolean(markdownDrop && thumbnailGeneratedCounts[markdownDrop.id]),
                folderDrop: folderItems.length,
                clipboardPath: Boolean(clipboardItem),
                clipboardImage: Boolean(clipboardImageItem),
                renamedId: renamed.id,
                detailMode,
                detailLockedBeforeOriginal,
                detailDelivery,
                previewOpened: Boolean(previewResult && previewResult.ok),
              };
            })()`
          );
          const current = await apiRequest('/api/library/current?includeItems=true');
          const renamed = current.items.find((item) => item.id === result.renamedId);
          const infoDir = renamed ? path.join(current.imagesDir, `${renamed.id}.info`) : '';
          const diskOk = Boolean(renamed && fs.existsSync(path.join(infoDir, `${renamed.name}.${renamed.ext}`)) && fs.existsSync(path.join(infoDir, `${renamed.name}_thumbnail.png`)));
          // 【项目决策·IGNORED】markdown 组件整体隔离排除：markdownSource 恒空 → markdownDrop
          // 恒 false，三项 markdown 断言留在 ok 合取里会让全部门通过也只打印 SMOKE_FAIL，故摘除。
          const ok = result.originalPage && result.originalScope && result.originalInspector && result.textDrop && result.textDropExt === 'txt' && result.textThumbnailGenerated && result.fileDrop && result.folderDrop >= 1 && result.clipboardPath && result.clipboardImage && result.after >= result.before + 4 && result.detailMode && result.detailLockedBeforeOriginal && result.detailDelivery && result.detailDelivery.visible && result.detailDelivery.tileCount > 0 && result.previewOpened && renamed && !renamed.isDeleted && renamed.annotation === '多选备注持久化' && renamed.star === 3 && renamed.tags.includes('batch-ui') && diskOk;
          console.log(ok ? `MAIN_WORKFLOW_SMOKE_OK ${JSON.stringify({ ...result, diskOk })}` : `MAIN_WORKFLOW_SMOKE_FAIL ${JSON.stringify({ ...result, diskOk, renamed })}`);
        } catch (err) {
          console.error(`MAIN_WORKFLOW_SMOKE_ERROR ${err.stack || err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (documentViewerSmokeMode) {
    const timeout = setTimeout(() => {
      console.error('DOCUMENT_VIEWER_SMOKE_TIMEOUT');
      app.quit();
    }, 70000);
    const smokeWin = createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const waitFor = (check, label, timeout = 15000) => new Promise((resolve, reject) => {
                const deadline = Date.now() + timeout;
                const poll = async () => {
                  try {
                    const value = await check();
                    if (value) { resolve(value); return; }
                  } catch (err) {}
                  if (Date.now() >= deadline) { reject(new Error(label + ' timeout')); return; }
                  setTimeout(poll, 75);
                };
                poll();
              });
              const itemId = ${JSON.stringify(process.env.EAGLE_DOCVIEWER_ITEM_ID || '')};
              const expectedText = ${JSON.stringify(process.env.EAGLE_DOCVIEWER_EXPECTED_TEXT || '')};
              const scope = await waitFor(() => {
                // b1-9d：双轨 scope 等待——bundle 在世时 window.$bodyScope 已由 main.tsx 归一为
                // 真实 scope；去 Angular 后为 shim 代理（machinery 填充 raw/listDone）。
                const bodyScope = window.$bodyScope || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'original main scope', 25000);
              const item = await waitFor(() => scope.raw.find((entry) => entry && entry.id === itemId), 'document item', 10000);

              // Activate the document through the shim-patched double-click path.
              scope.enterDetailMode(null, item);
              await new Promise((resolve) => setTimeout(resolve, 300));

              const container = await waitFor(() => document.querySelector('#eagle-document-viewer-container'), 'viewer container', 10000);
              await waitFor(() => container.hasAttribute('data-viewer-ready'), 'viewer ready handshake', 10000);
              const iframe = container.querySelector('iframe');
              if (!iframe) throw new Error('viewer iframe missing');
              const viewerUrl = String(iframe.src);
              if (!viewerUrl.includes('/frontend/document-viewer/index.html')) {
                throw new Error('unexpected viewer url: ' + viewerUrl);
              }

              // The migrated document surface must render inside the viewer.
              const viewerDoc = await waitFor(() => {
                const doc = iframe.contentDocument;
                if (!doc) return null;
                return doc.querySelector('.w-md-editor, .text-document-surface, .office-document-surface, .document-preview') ? doc : null;
              }, 'viewer rendered surface', 20000);

              const bodyText = viewerDoc.body.textContent || '';
              const contentOk = Boolean(expectedText && bodyText.includes(expectedText));
              // External-chrome mode: the generic stage actions (navigation,
              // favorite, reveal…) are hidden; the exit (×) action lives in
              // the viewer's editor toolbar right of the preview button.
              const inIframeStageActions = Boolean(viewerDoc.querySelector('[data-preview-stage-actions]'));
              const exitButton = viewerDoc.querySelector('button[title="退出 (ESC)"]');
              const exitOk = Boolean(exitButton);

              // The document workspace auto-collapses the left rail on entry.
              await waitFor(() => document.body.classList.contains('hide-sidebar'), 'sidebar auto-collapsed', 8000);
              await waitFor(() => container.style.left === '0px', 'container left 0 on entry', 8000);
              const autoCollapsed = true;

              // Eagle's rail buttons can still reopen it; the container then
              // reflows inward to make room for the rail.
              scope.toggleAll();
              await waitFor(() => !document.body.classList.contains('hide-sidebar'), 'sidebar expanded', 8000);
              await waitFor(() => container.style.left !== '0px', 'container left offset when sidebar shown', 8000);
              const sidebarExpandedLeft = container.style.left;

              // Collapse it again for the close step.
              scope.toggleAll();
              await waitFor(() => document.body.classList.contains('hide-sidebar'), 'sidebar collapsed again', 8000);
              await waitFor(() => container.style.left === '0px', 'container left 0 when sidebar hidden', 8000);
              const sidebarCollapsedLeft = container.style.left;

              // Electron's draggable-region hit testing is unreliable when the
              // document viewer iframe also declares app-region styles, so the
              // iframe must stay neutral and let Eagle's own toolbar drag.
              const iframeAppRegionCount = (() => {
                try {
                  const doc = iframe.contentDocument;
                  if (!doc) return -1;
                  return Array.from(doc.querySelectorAll('*')).filter((element) => {
                    const style = getComputedStyle(element);
                    const value = style.webkitAppRegion || style.appRegion;
                    return value && value !== 'auto' && value !== 'none';
                  }).length;
                } catch (err) {
                  return -1;
                }
              })();

              // Close via the viewer's exit (×) button in the editor toolbar.
              exitButton.click();
              await waitFor(() => !document.querySelector('#eagle-document-viewer-container'), 'viewer close', 8000);

              return {
                itemId: item.id,
                itemExt: item.ext,
                containerMounted: true,
                viewerUrl,
                contentOk,
                inIframeStageActions,
                exitOk,
                autoCollapsed,
                sidebarExpandedLeft,
                sidebarCollapsedLeft,
                iframeAppRegionCount,
                viewerClosed: !document.querySelector('#eagle-document-viewer-container'),
              };
            })()`
          );
          const ok = result.containerMounted && result.contentOk && !result.inIframeStageActions && result.exitOk && result.autoCollapsed && result.sidebarExpandedLeft !== '0px' && result.sidebarCollapsedLeft === '0px' && result.iframeAppRegionCount === 0 && result.viewerClosed;
          console.log(ok ? `DOCUMENT_VIEWER_SMOKE_OK ${JSON.stringify(result)}` : `DOCUMENT_VIEWER_SMOKE_FAIL ${JSON.stringify(result)}`);
        } catch (err) {
          console.error(`DOCUMENT_VIEWER_SMOKE_ERROR ${err.stack || err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    smokeWin.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[doc-viewer:renderer] ${String(message || '').slice(0, 2000)}`);
    });
    return;
  }
  if (librarySmokeMode) {
    const timeout = setTimeout(() => {
      console.error('LIBRARY_SMOKE_TIMEOUT');
      app.quit();
    }, 40000);
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const smokeSource = process.env.EAGLE_SMOKE_IMPORT_SOURCE || '';
          const smokeVideoSource = process.env.EAGLE_SMOKE_VIDEO_SOURCE || '';
          const smokeExport = process.env.EAGLE_SMOKE_EXPORT_DIR || '';
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const current = await window.eagleDesktop.library.current();
              const history = await window.eagleDesktop.library.history();
              const imported = ${JSON.stringify(smokeSource)}
                ? await window.eagleDesktop.import.files({ files: [{ path: ${JSON.stringify(smokeSource)}, name: 'Electron Imported' }] })
                : [];
              const exported = imported.length > 0 && ${JSON.stringify(smokeExport)}
                ? await window.eagleDesktop.export.images({ images: imported, savePath: ${JSON.stringify(smokeExport)} })
                : { count: 0, paths: [] };
              const custom = imported.length > 0 && ${JSON.stringify(smokeSource)}
                ? await window.eagleDesktop.thumbnail.setCustom({ itemId: imported[0].id, filePath: ${JSON.stringify(smokeSource)} })
                : null;
              const importedVideo = ${JSON.stringify(smokeVideoSource)}
                ? await window.eagleDesktop.import.files({ files: [{ path: ${JSON.stringify(smokeVideoSource)}, name: 'Electron Video' }] })
                : [];
              const videoRefresh = importedVideo.length > 0
                ? await new Promise((resolve, reject) => {
                    require('electron').ipcRenderer.send('regenerate-video-thumbnail', { video: importedVideo[0], startAt: 0.9 });
                    const deadline = Date.now() + 15000;
                    const poll = async () => {
                      const latest = await window.eagleDesktop.library.current();
                      const updated = Array.isArray(latest.items) ? latest.items.find((item) => item.id === importedVideo[0].id) : null;
                      if (updated && Math.abs(Number(updated.thumbnailAt) - 0.9) < 0.05 && !updated.processingThumbnail) {
                        resolve({ item: updated });
                        return;
                      }
                      if (Date.now() >= deadline) {
                        reject(new Error('regenerate-video-thumbnail persistence timeout'));
                        return;
                      }
                      setTimeout(poll, 50);
                    };
                    poll().catch(reject);
                  })
                : null;
              const infoPath = imported.length > 0
                ? current.imagesDir + imported[0].id + '.info/'
                : '';
              const thumbnailPath = infoPath ? infoPath + imported[0].name + '_thumbnail.png' : '';
              const rawPath = infoPath ? infoPath + imported[0].name + '.' + imported[0].ext : '';
              const toUrl = (target) => target ? window.require('/src/my_modules/url').pathToFileURL(target).href : '';
              const loadImage = (url) => url
                ? new Promise((resolve) => {
                    const image = new Image();
                    const timer = setTimeout(() => resolve(false), 5000);
                    image.onload = () => { clearTimeout(timer); resolve(image.naturalWidth > 0 && image.naturalHeight > 0); };
                    image.onerror = () => { clearTimeout(timer); resolve(false); };
                    image.src = url;
                  })
                : Promise.resolve(false);
              const thumbnailUrl = toUrl(thumbnailPath);
              const rawUrl = toUrl(rawPath);
              const [thumbnailLoaded, rawLoaded] = await Promise.all([loadImage(thumbnailUrl), loadImage(rawUrl)]);
              const smokeDownloadUrl = ${JSON.stringify(process.env.EAGLE_SMOKE_DOWNLOAD_URL || '')};
              const directDownload = smokeDownloadUrl
                ? await window.eagleDesktop.download.direct({ url: smokeDownloadUrl, validateImage: true })
                : null;
              const compatibilityDownloadPath = smokeDownloadUrl
                ? await require('electron').ipcRenderer.invoke('downloadWithNet', { url: smokeDownloadUrl, directory: 'ignored', filename: 'ignored', validateImage: true })
                : '';
              const directDownloadExists = directDownload ? require('node:fs').existsSync(directDownload.path) : true;
              const compatibilityDownloadExists = compatibilityDownloadPath ? require('node:fs').existsSync(compatibilityDownloadPath) : true;
              if (directDownload) await window.eagleDesktop.download.release(directDownload.taskId);
              if (compatibilityDownloadPath) await window.eagleDesktop.download.release(compatibilityDownloadPath);
              return {
                currentPath: current.path,
                itemCount: Array.isArray(current.items) ? current.items.length : -1,
                historyHasCurrent: history.includes(current.path),
                imported: imported.length,
                importedExt: imported[0] && imported[0].ext,
                exported: exported.count,
                exportedPaths: exported.paths,
                customThumbnail: Boolean(custom && custom.item && custom.item.customThumbnail),
                customPaletteCount: custom && custom.item && Array.isArray(custom.item.palettes) ? custom.item.palettes.length : 0,
                videoImported: importedVideo.length,
                videoExt: importedVideo[0] && importedVideo[0].ext,
                videoDuration: videoRefresh && videoRefresh.item && videoRefresh.item.duration,
                videoThumbnailAt: videoRefresh && videoRefresh.item && videoRefresh.item.thumbnailAt,
                videoResolutionWidth: videoRefresh && videoRefresh.item && videoRefresh.item.resolutionWidth,
                videoResolutionHeight: videoRefresh && videoRefresh.item && videoRefresh.item.resolutionHeight,
                videoPaletteCount: videoRefresh && videoRefresh.item && Array.isArray(videoRefresh.item.palettes) ? videoRefresh.item.palettes.length : 0,
                thumbnailUrl,
                thumbnailLoaded,
                rawUrl,
                rawLoaded,
                directDownloadExists,
                compatibilityDownloadExists,
                compatibilityDownloadPath,
                api: [
                  typeof window.eagleDesktop.library.create,
                  typeof window.eagleDesktop.library.open,
                  typeof window.eagleDesktop.library.switch,
                  typeof window.eagleDesktop.dialog.openDirectory,
                  typeof window.eagleDesktop.dialog.save,
                  typeof window.eagleDesktop.import.files,
                  typeof window.eagleDesktop.export.images,
                  typeof window.eagleDesktop.thumbnailUrl,
                  typeof window.eagleDesktop.thumbnail.setCustom,
                  typeof window.eagleDesktop.thumbnail.resetCustom,
                  typeof window.eagleDesktop.thumbnail.start,
                  typeof window.eagleDesktop.thumbnail.status,
                  typeof window.eagleDesktop.thumbnail.cancel,
                  typeof window.eagleDesktop.download.direct,
                  typeof window.eagleDesktop.download.start,
                  typeof require('electron').ipcRenderer.invoke,
                ],
              };
            })()`
          );
          const exportedExists = result.exportedPaths.every((file) => fs.existsSync(file));
          const ok = result.currentPath && result.itemCount >= 0 && result.historyHasCurrent && result.imported === 1 && result.importedExt === 'png' && result.exported === 1 && exportedExists && result.customThumbnail && result.customPaletteCount > 0 && result.videoImported === 1 && result.videoExt === 'webm' && result.videoDuration > 0 && Math.abs(result.videoThumbnailAt - 0.9) < 0.05 && result.videoResolutionWidth === 160 && result.videoResolutionHeight === 90 && result.videoPaletteCount > 0 && result.thumbnailLoaded && result.rawLoaded && result.directDownloadExists && result.compatibilityDownloadExists && /^http:\/\/localhost:\d+\/file\//.test(result.thumbnailUrl) && /^http:\/\/localhost:\d+\/file\//.test(result.rawUrl) && result.api.every((type) => type === 'function');
          console.log(ok ? `LIBRARY_SMOKE_OK ${JSON.stringify(result)}` : `LIBRARY_SMOKE_FAIL ${JSON.stringify(result)}`);
        } catch (err) {
          console.error(`LIBRARY_SMOKE_ERROR ${err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (desktopSmokeMode) {
    const menuOk = Menu.getApplicationMenu() !== null;
    const timeout = setTimeout(() => {
      console.error('DESKTOP_SMOKE_TIMEOUT');
      app.quit();
    }, 6000);
    const sourceFile = path.join(mockLibraryRoot, 'images', 'MOCK0001.info', 'Welcome Library.png');
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          if (win.isMaximized()) {
            win.unmaximize();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const frameOk = Math.abs(win.getBounds().height - win.getContentBounds().height) <= 2;
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const thumb = await window.eagleDesktop.nativeThumbnail(${JSON.stringify(sourceFile)});
              const list = await window.eagleDesktop.listDirectory(${JSON.stringify(mockLibraryRoot)});
              const clip = await window.eagleDesktop.clipboardImage();
              const win = window.eagleDesktop.window;
              const initialMaximized = win.isMaximized();
              if (initialMaximized) {
                await win.unmaximize();
              } else {
                await win.maximize();
              }
              await new Promise((resolve) => setTimeout(resolve, 150));
              const windowActionsOk = win.isMaximized() !== initialMaximized;
              const bodyScope = angular.element(document.body).scope();
              if (bodyScope && typeof bodyScope.openApplicationContextMenu === 'function') {
                bodyScope.openApplicationContextMenu();
              }
              await new Promise((resolve) => setTimeout(resolve, 150));
              const menuOpened = !!document.querySelector('.context-menu.open') && document.querySelectorAll('.context-menu.open .context-menu-item').length > 0;
              return {
                thumbOk: typeof thumb === 'string' && thumb.startsWith('data:image/png'),
                listOk: list.length > 0,
                clipboardOk: typeof clip === 'string' && clip.startsWith('data:image/png'),
                windowApiOk: typeof win.minimize === 'function' && typeof win.maximize === 'function' && typeof win.close === 'function' && typeof win.isMaximized() === 'boolean',
                windowActionsOk,
                menuOpened,
              };
            })()`
          );
          console.log(result.thumbOk && result.listOk && result.clipboardOk && result.windowApiOk && result.windowActionsOk && result.menuOpened && menuOk && frameOk ? 'DESKTOP_SMOKE_OK' : `DESKTOP_SMOKE_FAIL ${JSON.stringify({ ...result, menuOk, frameOk })}`);
        } catch (err) {
          console.error(`DESKTOP_SMOKE_ERROR ${err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (exportProgressSmokeMode) {
    const timeout = setTimeout(() => {
      console.error('EXPORT_PROGRESS_SMOKE_TIMEOUT');
      app.quit();
    }, 50000);
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const exportDir = process.env.EAGLE_EXPORT_PROGRESS_DIR || '';
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const waitFor = (check, label, timeout = 30000) => new Promise((resolve, reject) => {
                const deadline = Date.now() + timeout;
                const poll = async () => {
                  try {
                    const value = await check();
                    if (value) { resolve(value); return; }
                  } catch (err) {}
                  if (Date.now() >= deadline) { reject(new Error(label + ' timeout')); return; }
                  setTimeout(poll, 60);
                };
                poll();
              });
              const scope = await waitFor(() => {
                // b1-9d：双轨 scope 等待——bundle 在世时 window.$bodyScope 已由 main.tsx 归一为
                // 真实 scope；去 Angular 后为 shim 代理（machinery 填充 raw/listDone）。
                const bodyScope = window.$bodyScope || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'main scope', 25000);
              const fileElement = document.querySelector('file-export-progress');
              const archiveElement = document.querySelector('eaglepack-export-progress');
              if (!fileElement || !archiveElement) throw new Error('Original export progress directives are missing');
              const fileScope = angular.element(fileElement).isolateScope();
              const archiveScope = angular.element(archiveElement).isolateScope();
              const items = scope.raw.filter((item) => item && !item.isDeleted && (item.name === 'Progress Export A' || item.name === 'Progress Export B'));
              if (items.length < 2) throw new Error('Export progress smoke requires the two named items');
              const ipc = require('electron').ipcRenderer;
              const flatSave = ${JSON.stringify(path.join(exportDir, 'flat-export'))};
              const packSave = ${JSON.stringify(path.join(exportDir, 'pack.eaglepack'))};
              const waitEvent = (channel) => new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(channel + ' event timeout')), 10000);
                ipc.once(channel, () => { clearTimeout(timer); resolve(true); });
              });
              const fileShow = waitEvent('show-export-task');
              ipc.send('export-images', { images: items, savePath: flatSave });
              await fileShow;
              await waitFor(() => fileScope && fileScope.isExporting === false && fileScope.total === 0, 'file export directive complete');
              const archiveShow = waitEvent('show-archive-task');
              ipc.send('export-images', { images: items, savePath: packSave });
              await archiveShow;
              await waitFor(() => archiveScope && archiveScope.percent >= 100 && archiveScope.isArchiving === false, 'archive directive complete');
              const library = await window.eagleDesktop.library.current();
              const withTimeout = (promise, label) => Promise.race([
                promise,
                new Promise((resolve, reject) => setTimeout(() => reject(new Error(label + ' timeout')), 15000)),
              ]);
              const insideErrorPromise = new Promise((resolve) => window.eagleDesktop.export.onError(resolve));
              ipc.send('export-images', { images: items, savePath: library.imagesDir });
              const insideError = await withTimeout(insideErrorPromise, 'inside library export error');
              await waitFor(() => fileScope && fileScope.isExporting === false && fileScope.total === 0, 'inside library directive close');
              const cancelSave = ${JSON.stringify(path.join(exportDir, 'cancel-export'))};
              const cancelItems = scope.raw.filter((item) => item && !item.isDeleted).slice(0, 20);
              const cancelProgressPromise = new Promise((resolve) => window.eagleDesktop.export.onProgress((progress) => {
                if (progress && progress.jobId && Number(progress.current || 0) >= 1) resolve(progress.jobId);
              }));
              const cancelErrorPromise = new Promise((resolve) => window.eagleDesktop.export.onError(resolve));
              ipc.send('export-images', { images: cancelItems, savePath: cancelSave });
              const cancelJobId = await withTimeout(cancelProgressPromise, 'cancel export progress');
              await window.eagleDesktop.export.cancel(cancelJobId);
              const cancelResult = await withTimeout(cancelErrorPromise, 'cancel export error');
              await waitFor(() => fileScope && fileScope.isExporting === false && fileScope.total === 0, 'cancel directive close');
              const folderSave = ${JSON.stringify(path.join(exportDir, 'folder-export'))};
              const folderShow = waitEvent('show-export-task');
              ipc.send('export-as-folder', {
                folder: { id: 'FOLDER-ROOT', name: 'Root Folder', images: items.map((item) => item.id), children: [] },
                images: items,
                savePath: folderSave,
              });
              await folderShow;
              await waitFor(() => fileScope && fileScope.isExporting === false && fileScope.total === 0, 'folder export directive complete');
              const concurrentA = ${JSON.stringify(path.join(exportDir, 'concurrent-a'))};
              const concurrentB = ${JSON.stringify(path.join(exportDir, 'concurrent-b'))};
              const firstExportPromise = window.eagleDesktop.export.images({ images: cancelItems, savePath: concurrentA });
              const secondRejected = await window.eagleDesktop.export.images({ images: cancelItems, savePath: concurrentB })
                .then(() => ({ ok: true }))
                .catch((err) => ({ ok: false, error: err.message }));
              const firstConcurrentComplete = await withTimeout(
                firstExportPromise,
                'first concurrent export complete'
              );
              await waitFor(() => fileScope && fileScope.isExporting === false && fileScope.total === 0, 'concurrent directive close');
              return {
                itemIds: items.map((item) => item.id),
                flatSave,
                packSave,
                cancelSave,
                folderSave,
                concurrentA,
                cancelItemsLength: cancelItems.length,
                insideError,
                cancelResult,
                secondRejected,
                firstConcurrentComplete,
                fileScope: { isExporting: fileScope.isExporting, total: fileScope.total, curr: fileScope.curr },
                archiveScope: { isArchiving: archiveScope.isArchiving, percent: archiveScope.percent, progress: archiveScope.progress, total: archiveScope.total },
              };
            })()`
          );
          const flatExists = result.flatSave && fs.existsSync(result.flatSave);
          const packExists = result.packSave && fs.existsSync(result.packSave);
          const cancelExists = result.cancelSave && fs.existsSync(result.cancelSave);
          const cancelFiles = cancelExists
            ? fs.readdirSync(result.cancelSave).filter((name) => name.endsWith('.png')).length
            : 0;
          const cancelPartial = cancelFiles > 0 && cancelFiles < Number(result.cancelItemsLength || 0);
          const folderExists = result.folderSave && fs.existsSync(result.folderSave);
          const concurrentFiles = result.concurrentA && fs.existsSync(result.concurrentA)
            ? fs.readdirSync(result.concurrentA).filter((name) => name.endsWith('.png')).length
            : 0;
          const concurrentOk = result.secondRejected && !result.secondRejected.ok
            && concurrentFiles > 0
            && Number(result.firstConcurrentComplete && result.firstConcurrentComplete.count || 0) > 0;
          const errorOk = result.insideError
            && String(result.insideError.error || '').includes('inside the current library images')
            && result.cancelResult
            && result.cancelResult.cancelled === true;
          const revealOk = shellCalls.some((call) => call.action === 'showItemInFolder' && call.target === result.flatSave)
            && shellCalls.some((call) => call.action === 'showItemInFolder' && call.target === result.packSave);
          const ok = flatExists && packExists && folderExists && result.fileScope.isExporting === false && result.fileScope.total === 0 && result.archiveScope.percent >= 100 && result.archiveScope.isArchiving === false && revealOk && cancelPartial && errorOk && concurrentOk;
          console.log(ok ? `EXPORT_PROGRESS_SMOKE_OK ${JSON.stringify({ ...result, flatExists, packExists, folderExists, cancelFiles, cancelPartial, concurrentFiles, concurrentOk, errorOk, revealOk, shellCalls })}` : `EXPORT_PROGRESS_SMOKE_FAIL ${JSON.stringify({ ...result, flatExists, packExists, folderExists, cancelFiles, cancelPartial, concurrentFiles, concurrentOk, errorOk, revealOk, shellCalls })}`);
        } catch (err) {
          console.error(`EXPORT_PROGRESS_SMOKE_ERROR ${err.stack || err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (videoDetailSmokeMode) {
    const timeout = setTimeout(() => {
      console.error('VIDEO_DETAIL_SMOKE_TIMEOUT');
      app.quit();
    }, 60000);
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const waitFor = (check, label, timeout = 25000) => new Promise((resolve, reject) => {
                const deadline = Date.now() + timeout;
                const poll = async () => {
                  try {
                    const value = await check();
                    if (value) { resolve(value); return; }
                  } catch (err) {}
                  if (Date.now() >= deadline) { reject(new Error(label + ' timeout')); return; }
                  setTimeout(poll, 60);
                };
                poll();
              });
              const scope = await waitFor(() => {
                // b1-9d：双轨 scope 等待——bundle 在世时 window.$bodyScope 已由 main.tsx 归一为
                // 真实 scope；去 Angular 后为 shim 代理（machinery 填充 raw/listDone）。
                const bodyScope = window.$bodyScope || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'main scope');
              const videoItem = scope.raw.find((item) => item && !item.isDeleted && (item.ext === 'mp4' || item.ext === 'webm'));
              if (!videoItem) throw new Error('No video item in current library');
              scope.selected = [videoItem];
              scope.selectedMappings = {};
              scope.current = videoItem;
              if (typeof scope.updateSelection === 'function') scope.updateSelection();
              scope.enterDetailMode(null, videoItem);
              scope.$evalAsync();
              await waitFor(() => scope.isDetailMode && scope.current && scope.current.id === videoItem.id, 'detail mode');
              const player = await waitFor(() => {
                const element = document.querySelector('.detail-wrap video');
                return element && !element.error && element.readyState >= 1 && element.videoWidth > 0 && element.videoHeight > 0
                  ? {
                      src: element.currentSrc || element.src || '',
                      readyState: element.readyState,
                      videoWidth: element.videoWidth,
                      videoHeight: element.videoHeight,
                      duration: Number(element.duration) || 0,
                    }
                  : null;
              }, 'native detail video', 25000).catch((err) => {
                const element = document.querySelector('.detail-wrap video');
                return {
                  error: err.message,
                  hasVideo: Boolean(element),
                  hasMpv: Boolean(document.querySelector('.detail-wrap mpv-video')),
                  readyState: element ? element.readyState : -1,
                  src: element ? (element.currentSrc || element.src || '') : '',
                  videoCount: document.querySelectorAll('video').length,
                  initDetailMode: Boolean(scope.initDetailMode),
                  useMpvPlayer: Boolean(scope.useMpvPlayer),
                  detailWrapCount: document.querySelectorAll('.detail-wrap').length,
                  detailHtml: String(document.querySelector('.detail-wrap')?.innerHTML || '').slice(0, 500),
                  detailContainerHtml: String(document.querySelector('#detail-container')?.innerHTML || '').slice(0, 500),
                  contentPanelClass: document.querySelector('.content-panel.detail-mode')?.className || '',
                  currentExt: scope.current && scope.current.ext,
                };
              });
              let interaction = null;
              const videoElement = document.querySelector('.detail-wrap video');
              if (videoElement && !videoElement.error && videoElement.readyState >= 1) {
                videoElement.volume = 0.5;
                videoElement.currentTime = 0.1;
                await new Promise((resolve) => setTimeout(resolve, 300));
                interaction = {
                  volume: videoElement.volume,
                  currentTime: videoElement.currentTime,
                  duration: Number(videoElement.duration) || 0,
                };
              }
              return {
                videoItemId: videoItem.id,
                videoExt: videoItem.ext,
                detailMode: Boolean(scope.isDetailMode),
                player,
                interaction,
              };
            })()`
          );
          const ok = result.detailMode
            && result.player && !result.player.error
            && result.player.videoWidth > 0
            && result.player.videoHeight > 0
            && result.interaction
            && Math.abs(result.interaction.volume - 0.5) < 0.01
            && Number(result.interaction.currentTime) > 0.05;
          console.log(ok ? `VIDEO_DETAIL_SMOKE_OK ${JSON.stringify(result)}` : `VIDEO_DETAIL_SMOKE_FAIL ${JSON.stringify(result)}`);
        } catch (err) {
          console.error(`VIDEO_DETAIL_SMOKE_ERROR ${err.stack || err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (previewDeliverySmokeMode) {
    const timeout = setTimeout(() => {
      console.error('PREVIEW_DELIVERY_SMOKE_TIMEOUT');
      app.quit();
    }, 60000);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    (async () => {
      try {
        const current = await apiRequest('/api/library/current?includeItems=true');
        const items = (current.items || []).filter((item) => item && !item.isDeleted);
        let selected = items.slice(0, Math.max(3, Number(process.env.EAGLE_PREVIEW_COUNT || 3)));
        const previewIds = String(process.env.EAGLE_PREVIEW_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
        if (previewIds.length > 0) {
          const idSet = new Set(previewIds);
          selected = previewIds.map((id) => items.find((item) => item.id === id)).filter(Boolean);
          if (selected.length !== idSet.size) throw new Error('EAGLE_PREVIEW_IDS contains missing items');
        }
        if (selected.length < 2) throw new Error(`Preview smoke requires at least 2 items, got ${selected.length}`);
        const opened = await openOriginalPreview({
          images: selected,
          show: false,
          width: 1000,
          height: 720,
        });
        const previewWindow = BrowserWindow.fromId(opened.windowId);
        if (!previewWindow) throw new Error('Preview window was not created');
        const waitForPreview = async (check, label, timeoutMs = 30000) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            try {
              const value = await previewWindow.webContents.executeJavaScript(check);
              if (value) return value;
            } catch (err) {
              // The page can still be loading.
            }
            await sleep(80);
          }
          throw new Error(`${label} timeout`);
        };
        await waitForPreview(
          `(async () => {
            const scope = window.__eaglePreviewController;
            return scope && scope.current ? { id: scope.current.id, count: (scope.images || []).length } : null;
          })()`,
          'preview scope'
        );
        const result = await previewWindow.webContents.executeJavaScript(
          `(async () => {
            const waitFor = (check, label, timeout = 20000) => new Promise((resolve, reject) => {
              const deadline = Date.now() + timeout;
              const poll = async () => {
                try {
                  const value = await check();
                  if (value) { resolve(value); return; }
                } catch (err) {}
                if (Date.now() >= deadline) { reject(new Error(label + ' timeout')); return; }
                setTimeout(poll, 60);
              };
              poll();
            });
            const scope = await waitFor(() => window.__eaglePreviewController && window.__eaglePreviewController.current ? window.__eaglePreviewController : null, 'preview scope');
            const initialId = scope.current.id;
            const firstItem = scope.images[0];
            const imageLoaded = await waitFor(() => {
              const image = document.querySelector('#detail-image');
              return image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
                ? { width: image.naturalWidth, height: image.naturalHeight }
                : null;
            }, 'detail image', 15000).catch(() => null);
            try {
              scope.selectNext();
              scope.$evalAsync();
            } catch (err) {
              throw new Error('selectNext error: ' + (err && err.message || err));
            }
            const nextId = await waitFor(() => scope.current && scope.current.id !== initialId ? scope.current.id : null, 'next navigation');
            try {
              scope.selectPrev();
              scope.$evalAsync();
            } catch (err) {
              throw new Error('selectPrev error: ' + (err && err.message || err));
            }
            const prevId = await waitFor(() => scope.current && scope.current.id === initialId ? scope.current.id : null, 'previous navigation');
            scope.current = firstItem;
            scope.$evalAsync();
            await waitFor(() => scope.current && scope.current.id === firstItem.id, 'back to first item');
            const actionResult = (action, trigger) => new Promise((resolve, reject) => {
              const ipc = require('electron').ipcRenderer;
              const timer = setTimeout(() => {
                ipc.off('preview:action-result', onResult);
                reject(new Error(action + ' action timeout'));
              }, 10000);
              const onResult = (_event, value) => {
                if (!value || value.action !== action) return;
                clearTimeout(timer);
                ipc.off('preview:action-result', onResult);
                if (value.ok) resolve(value);
                else reject(new Error(value.error || action + ' failed'));
              };
              ipc.on('preview:action-result', onResult);
              trigger();
            });
            const openDefault = await actionResult('open-with-default', () => scope.openWithDefault());
            const reveal = await actionResult('show-item-in-folder', () => scope.openWithFinder());
            const copyPath = await actionResult('copy-path', () => scope.copyAsPath());
            const clipboardTextAfterCopyPath = require('electron').clipboard.readText();
            const copyImage = await actionResult('copy-images', () => scope.copyImage());
            const drag = await actionResult('ondragstart', () => scope.startDrag({}));
            const viewItem = async (item, label, predicate) => {
              if (!item) return null;
              scope.current = item;
              scope.$evalAsync();
              await new Promise((resolve) => setTimeout(resolve, 300));
              try {
                scope.zoom();
                scope.$evalAsync();
              } catch (err) {}
              return waitFor(predicate, label, 20000).catch((err) => ({
                error: err.message,
                currentExt: scope.current && scope.current.ext,
                iframeSrc: document.querySelector('#pdf-viewer') ? document.querySelector('#pdf-viewer').src : '',
                bodySnippet: document.querySelector('#pdf-viewer') && document.querySelector('#pdf-viewer').contentDocument
                  ? String(document.querySelector('#pdf-viewer').contentDocument.body.textContent || '').slice(0, 400)
                  : '',
              }));
            };
            const svgItem = scope.images.find((item) => item && item.ext === 'svg');
            const svg = await viewItem(svgItem, 'svg viewer', () => {
              const image = document.querySelector('#detail-image');
              return image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
                ? { width: image.naturalWidth, height: image.naturalHeight }
                : null;
            });
            const jpgItem = scope.images.find((item) => item && (item.ext === 'jpg' || item.ext === 'jpeg'));
            const jpg = await viewItem(jpgItem, 'jpeg viewer', () => {
              const image = document.querySelector('#detail-image');
              return image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
                ? { width: image.naturalWidth, height: image.naturalHeight }
                : null;
            });
            const gifItem = scope.images.find((item) => item && item.ext === 'gif');
            const gif = await viewItem(gifItem, 'gif viewer', () => {
              const image = document.querySelector('#detail-image');
              if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
                return { mode: 'image', width: image.naturalWidth, height: image.naturalHeight };
              }
              const frame = document.querySelector('#gif-viewer');
              if (frame && frame.contentDocument && frame.contentDocument.querySelector('canvas')) {
                return { mode: 'gif-viewer' };
              }
              return null;
            });
            const pdfItem = scope.images.find((item) => item && item.ext === 'pdf');
            const pdf = await viewItem(pdfItem, 'pdf viewer', () => {
              const frame = document.querySelector('#pdf-viewer');
              if (!frame || !frame.contentDocument) return null;
              const doc = frame.contentDocument;
              const page = doc.querySelector('.pdfViewer .page, #viewerContainer .page, #viewer .page, .page, canvas');
              const bodyText = doc.body ? (doc.body.textContent || '').trim() : '';
              return page ? { page: true, viewer: Boolean(doc.querySelector('.pdfViewer')), textLength: bodyText.length } : null;
            });
            const videoItem = scope.images.find((item) => item && (item.ext === 'mp4' || item.ext === 'webm'));
            let video = null;
            let videoInteraction = null;
            let videoFetch = null;
            const videoProbe = [];
            if (videoItem) {
              const probeTimer = setInterval(() => {
                const element = document.querySelector('video');
                if (element) {
                  videoProbe.push({
                    readyState: element.readyState,
                    error: element.error ? element.error.message : '',
                    src: element.currentSrc || element.src || '',
                    videoWidth: element.videoWidth,
                    videoHeight: element.videoHeight,
                    duration: element.duration,
                  });
                }
              }, 25);
              try {
                const videoUrl = scope.getRawUrl(videoItem);
                const response = await fetch(videoUrl);
                const buffer = await response.arrayBuffer();
                videoFetch = {
                  status: response.status,
                  type: response.headers.get('content-type') || '',
                  bytes: buffer.byteLength,
                  url: videoUrl,
                };
              } catch (err) {
                videoFetch = { error: err.message };
              }
              scope.current = videoItem;
              scope.$evalAsync();
              await new Promise((resolve) => setTimeout(resolve, 300));
              try {
                scope.zoom();
                scope.$evalAsync();
              } catch (err) {}
              video = await waitFor(() => {
                const element = document.querySelector('video');
                return element && !element.error && element.readyState >= 1
                  ? { readyState: element.readyState, duration: Number(element.duration) || 0 }
                  : null;
              }, 'video ready', 15000).catch((err) => {
                const element = document.querySelector('video');
                clearInterval(probeTimer);
                return {
                  error: element && element.error ? element.error.message : err.message,
                  readyState: element ? element.readyState : -1,
                  src: element ? (element.currentSrc || element.src || '') : '',
                  currentExt: scope.current && scope.current.ext,
                  useMpvPlayer: Boolean(scope.useMpvPlayer),
                  hasVideoElement: Boolean(element),
                  videoFetch,
                  videoProbe,
                  detailChildren: Array.from(document.querySelector('#detail-container')?.children || []).map((el) => el.className || el.tagName),
                  waitError: err.message,
                };
              });
              clearInterval(probeTimer);
              const videoElement = document.querySelector('video');
              if (videoElement) {
                videoElement.volume = 0.5;
                videoElement.currentTime = 0.1;
                await new Promise((resolve) => setTimeout(resolve, 300));
                videoInteraction = {
                  volume: videoElement.volume,
                  currentTime: videoElement.currentTime,
                  duration: videoElement.duration,
                  readyState: videoElement.readyState,
                };
              }
            }
            const fakeOpen = await window.eagleDesktop.item.openDefault('FAKE-ITEM-ID')
              .then(() => ({ ok: true }))
              .catch((err) => ({ ok: false, error: err.message }));
            const fakeCopy = await window.eagleDesktop.item.copyPath('FAKE-ITEM-ID')
              .then(() => ({ ok: true }))
              .catch((err) => ({ ok: false, error: err.message }));
            const fakeReveal = await window.eagleDesktop.item.reveal('FAKE-ITEM-ID')
              .then(() => ({ ok: true }))
              .catch((err) => ({ ok: false, error: err.message }));
            const fakeDrag = await window.eagleDesktop.item.dragStart('FAKE-ITEM-ID')
              .then(() => ({ ok: true }))
              .catch((err) => ({ ok: false, error: err.message }));
            const badVideoItem = scope.images.find((item) => item && item.ext === 'mp4');
            let badVideo = null;
            if (badVideoItem) {
              scope.current = badVideoItem;
              scope.$evalAsync();
              await new Promise((resolve) => setTimeout(resolve, 1200));
              const element = document.querySelector('video');
              badVideo = {
                unsupported: !element || element.readyState === 0 || Boolean(element.error),
                readyState: element ? element.readyState : -1,
                error: element && element.error ? element.error.message : '',
                useMpvPlayer: Boolean(scope.useMpvPlayer),
              };
            }
            return {
              initialId,
              imageLoaded,
              nextId,
              prevId,
              openDefault,
              reveal,
              copyPath,
              clipboardTextAfterCopyPath,
              copyImage,
              drag,
              jpg,
              svg,
              gif,
              pdf,
              video,
              videoInteraction,
              fakeOpen,
              fakeCopy,
              fakeReveal,
              fakeDrag,
              badVideo,
            };
          })()`
        );
        const firstInfo = await resolveItemFiles(result.initialId);
        const clipboardPathOk = result.clipboardTextAfterCopyPath === firstInfo.originalReal;
        const clipboardImageOk = !clipboard.readImage().isEmpty();
        const shellOk = shellCalls.some((call) => call.action === 'openPath' && call.target === firstInfo.originalReal)
          && shellCalls.some((call) => call.action === 'showItemInFolder' && call.target === firstInfo.originalReal)
          && shellCalls.some((call) => call.action === 'startDrag' && call.target === firstInfo.originalReal);
        const viewerOk = result.jpg && !result.jpg.error
          && result.svg && !result.svg.error
          && result.gif && !result.gif.error
          && result.pdf && !result.pdf.error
          && result.badVideo && result.badVideo.unsupported
          && result.videoInteraction
          && Math.abs(Number(result.videoInteraction.volume) - 0.5) < 0.01
          && Number(result.videoInteraction.currentTime) > 0.05;
        const negativeOk = result.fakeOpen && !result.fakeOpen.ok
          && result.fakeCopy && !result.fakeCopy.ok
          && result.fakeReveal && !result.fakeReveal.ok
          && result.fakeDrag && !result.fakeDrag.ok;
        await apiRequest('/api/item/updateMany', {
          method: 'POST',
          body: { items: [{ id: result.initialId, name: 'Preview Renamed PNG' }] },
        });
        const reopened = await openOriginalPreview({
          images: selected,
          show: false,
          width: 1000,
          height: 720,
        });
        const reopenedWindow = BrowserWindow.fromId(reopened.windowId);
        if (!reopenedWindow) throw new Error('Reopened preview window was not created');
        const waitForReopened = async (check, label) => {
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            try {
              const value = await reopenedWindow.webContents.executeJavaScript(check);
              if (value) return value;
            } catch (err) {}
            await sleep(80);
          }
          throw new Error(`${label} timeout`);
        };
        await waitForReopened(
          `(async () => {
            const scope = window.__eaglePreviewController;
            return scope && scope.current ? { id: scope.current.id, count: (scope.images || []).length } : null;
          })()`,
          'reopened preview scope'
        );
        const renamedResult = await reopenedWindow.webContents.executeJavaScript(
          `(async () => {
            const waitFor = (check, label, timeout = 20000) => new Promise((resolve, reject) => {
              const deadline = Date.now() + timeout;
              const poll = async () => {
                try {
                  const value = await check();
                  if (value) { resolve(value); return; }
                } catch (err) {}
                if (Date.now() >= deadline) { reject(new Error(label + ' timeout')); return; }
                setTimeout(poll, 60);
              };
              poll();
            });
            const scope = await waitFor(() => window.__eaglePreviewController && window.__eaglePreviewController.current ? window.__eaglePreviewController : null, 'renamed scope');
            const first = scope.images[0];
            const image = await waitFor(() => {
              const element = document.querySelector('#detail-image');
              return element && element.complete && element.naturalWidth > 0 && element.naturalHeight > 0
                ? { width: element.naturalWidth, height: element.naturalHeight }
                : null;
            }, 'renamed image', 15000);
            return {
              id: first.id,
              name: first.name,
              ext: first.ext,
              rawPath: scope.getRawPath(first),
              imageLoaded: image,
            };
          })()`
        );
        let trashRejected = true;
        let missingRejected = true;
        if (process.env.EAGLE_PREVIEW_RUN_NEGATIVES === '1') {
          await apiRequest('/api/item/moveToTrash', {
            method: 'POST',
            body: { ids: [selected[0].id] },
          });
          trashRejected = await openOriginalPreview({ images: [selected[0]], show: false })
            .then(() => false)
            .catch((err) => /trash/i.test(err.message));
          await apiRequest('/api/item/restore', {
            method: 'POST',
            body: { ids: [selected[0].id] },
          });
          const afterRestore = await apiRequest('/api/library/current?includeItems=true');
          const restoredItem = (afterRestore.items || []).find((item) => item.id === selected[0].id);
          if (restoredItem) {
            const originalPath = path.join(afterRestore.imagesDir, `${restoredItem.id}.info`, `${restoredItem.name}.${restoredItem.ext}`);
            fs.rmSync(originalPath, { force: true });
          }
          missingRejected = await openOriginalPreview({ images: [selected[0]], show: false })
            .then(() => false)
            .catch((err) => /missing/i.test(err.message));
        }
        const ok = result.imageLoaded
          && result.nextId && result.nextId !== result.initialId
          && result.prevId === result.initialId
          && result.openDefault.ok
          && result.reveal.ok
          && result.copyPath.ok
          && result.copyImage.ok
          && result.drag.ok
          && clipboardPathOk
          && clipboardImageOk
          && shellOk
          && viewerOk
          && negativeOk
          && renamedResult.name === 'Preview Renamed PNG'
          && decodeURIComponent(renamedResult.rawPath).endsWith('Preview Renamed PNG.png')
          && renamedResult.imageLoaded
          && trashRejected
          && missingRejected;
        console.log(ok ? `PREVIEW_DELIVERY_SMOKE_OK ${JSON.stringify({ ...result, clipboardPathOk, clipboardImageOk, viewerOk, negativeOk, trashRejected, missingRejected, renamedResult, shellCalls })}` : `PREVIEW_DELIVERY_SMOKE_FAIL ${JSON.stringify({ ...result, clipboardPathOk, clipboardImageOk, shellOk, viewerOk, negativeOk, trashRejected, missingRejected, renamedResult, shellCalls })}`);
      } catch (err) {
        console.error(`PREVIEW_DELIVERY_SMOKE_ERROR ${err.stack || err.message}`);
      }
      clearTimeout(timeout);
      app.quit();
    })();
    return;
  }
  if (dragSmokeMode) {
    const timeout = setTimeout(() => {
      console.error('DRAG_SMOKE_TIMEOUT');
      app.quit();
    }, 30000);
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const library = await apiRequest('/api/library/current?includeItems=true');
          updateCachedCurrentLibrary(library);
          const draggable = (library.items || []).filter((item) => item && !item.isDeleted).slice(0, 2);
          if (draggable.length === 0) throw new Error('No draggable item in current library');
          const ids = draggable.map((item) => item.id);
          const result = await startItemDrag({ sender: win.webContents }, ids);
          console.log(`DRAG_SMOKE_OK ${JSON.stringify({ ...result, callCount: dragStartCalls.length })}`);
        } catch (err) {
          console.error(`DRAG_SMOKE_ERROR ${err.stack || err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (channelsSmokeMode) {
    const smokeOut = process.env.EAGLE_CHANNELS_SMOKE_OUT || path.join(os.tmpdir(), 'eagle-channels-smoke');
    const thumbSource = process.env.EAGLE_CHANNELS_SMOKE_THUMB;
    const timeout = setTimeout(() => {
      console.error('CHANNELS_SMOKE_TIMEOUT');
      app.quit();
    }, 90000);
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        const results = {};
        try {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const sendFromRenderer = (channel, payload) => win.webContents.executeJavaScript(
            `require('electron').ipcRenderer.send(${JSON.stringify(channel)}, ${payload === undefined ? 'undefined' : JSON.stringify(JSON.parse(JSON.stringify(payload)))}); true`
          );
          const lib = await apiRequest('/api/library/current?includeItems=true');
          updateCachedCurrentLibrary(lib);
          const items = (lib.items || []).filter((it) => it && !it.isDeleted);
          if (!items.length) throw new Error('no items in library');
          const item = items[0];

          // 1) duplicate-file：items +1
          const beforeCount = items.length;
          await sendFromRenderer('duplicate-file', item.id);
          let dupOk = false;
          for (let i = 0; i < 80 && !dupOk; i++) {
            await sleep(150);
            const now = await apiRequest('/api/library/current?includeItems=true');
            dupOk = (now.items || []).length === beforeCount + 1;
          }
          results.duplicateFile = dupOk;

          // 2) export-as-folder：savePath 出现导出产物
          const asFolderDir = path.join(smokeOut, 'as-folder');
          fs.mkdirSync(asFolderDir, { recursive: true });
          await sendFromRenderer('export-as-folder', { folder: undefined, images: [item], savePath: asFolderDir, needSpace: false });
          let asFolderOk = false;
          for (let i = 0; i < 80 && !asFolderOk; i++) {
            await sleep(150);
            asFolderOk = fs.existsSync(asFolderDir) && fs.readdirSync(asFolderDir).length > 0;
          }
          results.exportAsFolder = asFolderOk;

          // 3) export-images：.eaglepack 落盘
          const packPath = path.join(smokeOut, 'Export.eaglepack');
          await sendFromRenderer('export-images', { images: [item], savePath: packPath });
          let packOk = false;
          for (let i = 0; i < 150 && !packOk; i++) {
            await sleep(200);
            packOk = fs.existsSync(packPath);
          }
          results.exportImages = packOk;

          // 4) regenerate-thumbnail：缩略图文件 mtime 前移（backend 队列同步重生成）
          let thumbOk = false;
          const thumbFile = path.join(lib.rootDir, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
          if (fs.existsSync(thumbFile)) {
            const t0 = fs.statSync(thumbFile).mtimeMs;
            await sendFromRenderer('regenerate-thumbnail', [item]);
            for (let i = 0; i < 100 && !thumbOk; i++) {
              await sleep(150);
              thumbOk = fs.existsSync(thumbFile) && fs.statSync(thumbFile).mtimeMs > t0;
            }
          }
          results.regenerateThumbnail = thumbOk;

          // 5) set-custom-thumbnail：customThumbnail 标志 + thumbnail-generated 回程事件
          await win.webContents.executeJavaScript(
            `window.__b1_9ae_gen = false; require('electron').ipcRenderer.on('thumbnail-generated', (_ev, it) => { window.__b1_9ae_gen = !!(it && it.id); }); true`
          );
          await sendFromRenderer('set-custom-thumbnail', { item, thumbnailPath: thumbSource, width: 320, height: 240 });
          let customOk = false;
          for (let i = 0; i < 80 && !customOk; i++) {
            await sleep(150);
            const now = await apiRequest('/api/library/current?includeItems=true');
            const fresh = (now.items || []).find((it) => it.id === item.id) || {};
            customOk = fresh.customThumbnail === true;
          }
          results.setCustomThumbnail = customOk;
          results.thumbnailGeneratedEcho = await win.webContents.executeJavaScript('window.__b1_9ae_gen === true');

          // 6) copy-thumbnails：CF_HDROP 剪贴板回读非空
          await sendFromRenderer('copy-thumbnails', [item]);
          let clipOk = false;
          for (let i = 0; i < 60 && !clipOk; i++) {
            await sleep(150);
            clipOk = (clipboard.read('CF_HDROP') || Buffer.alloc(0)).length > 0;
          }
          results.copyThumbnails = clipOk;

          console.log(`CHANNELS_SMOKE_OK ${JSON.stringify(results)}`);
        } catch (err) {
          console.error(`CHANNELS_SMOKE_ERROR ${err.stack || err.message}`);
        }
        clearTimeout(timeout);
        app.quit();
      },
    });
    return;
  }
  if (regressionHostMode) {
    createWindow({ show: false });
    console.log('REGRESSION_HOST_READY');
    return;
  }
  if (pluginSmokeMode) {
    const pluginWin = createWindow({
      show: false,
      url: 'http://localhost:41695/plugins/eagle-reverse-example-service/index.html',
      width: 640,
      height: 480,
    });
    const timeout = setTimeout(() => {
      console.error('PLUGIN_WINDOW_TIMEOUT');
      app.quit();
    }, 6000);
    pluginWin.webContents.on('did-finish-load', async () => {
      try {
        const ok = await pluginWin.webContents.executeJavaScript('typeof window.eagle !== "undefined"');
        console.log(ok ? 'PLUGIN_WINDOW_OK' : 'PLUGIN_WINDOW_MISSING_EAGLE');
      } catch (err) {
        console.error(`PLUGIN_WINDOW_ERROR ${err.message}`);
      }
      clearTimeout(timeout);
      app.quit();
    });
    return;
  }
  createWindow({ show: !smokeMode });
  setupTray();
  if (smokeMode) {
    setTimeout(() => app.quit(), 1500);
    return;
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
