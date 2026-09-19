const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } = require('electron');

// R2-5（2026-09-17 验收整改）：本机 GPU 进程在自动化会话下会反复崩溃
// （`gpu_process_host.cc(991) GPU process exited unexpectedly` →
// `gpu_data_manager_impl_private.cc(440) GPU process isn't usable. Goodbye.`），
// Chromium 随即 FATAL 杀掉整个浏览器进程，表现为「Electron 类测试无故超时」。
// `--in-process-gpu` 可绕过（把 GPU 放进浏览器进程）；**这里只在显式设置
// EAGLE_ELECTRON_IN_PROCESS_GPU=1 时生效，生产默认完全不变**。
// 逃生口仅用于本机跑自动化门禁；它改变的是渲染后端，故结论归档时必须注明（见工作记录 §15）。
if (process.env.EAGLE_ELECTRON_IN_PROCESS_GPU === '1') app.commandLine.appendSwitch('in-process-gpu');

const previewUrl = process.env.EAGLE_PREVIEW_URL || 'http://localhost:5176/src/app/index.html';
const apiBase = process.env.EAGLE_API_URL || 'http://localhost:41695';
// R1：工作台等 URL 从预览 URL 推导，生产态不再硬编码开发端口 5176。
const frontendOrigin = (() => {
  try { return new URL(previewUrl).origin; } catch { return 'http://localhost:5176'; }
})();
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
// R0-4（2026-09-17 验收整改 §3.1）：窗口可见性的**实机**断言模式。
// 与 --smoke 的区别：--smoke 只证明「进程起得来」，本模式把主窗 bounds 与当前全部显示器
// 工作区一并打印，由 tests/electron-window-bounds.mjs 断言「窗口真的在可视区内」。
const windowBoundsSmokeMode = process.argv.includes('--smoke-window-bounds');
const dragSmokeMode = process.argv.includes('--smoke-drag') || process.env.EAGLE_DRAG_SMOKE === '1';
// b1-9ae：后台窗通道族闭环 smoke——真实渲染层 ipcRenderer.send → main handler → backend
// 数据面全链验证（duplicate-file/export-as-folder/export-images/regenerate-thumbnail/
// set-custom-thumbnail/copy-thumbnails；open-with-dialog 仅静态接线审计，避免真弹窗）
const channelsSmokeMode = process.argv.includes('--smoke-channels') || process.env.EAGLE_CHANNELS_SMOKE === '1';
// b1-9ak：Menu.popup 冒烟捕获——@electron/remote 的方法调用不经 main 侧 Menu 原型
// （原型补丁实测无效），改由渲染层 smoke 分支序列化菜单模板后经 IPC 通报（原生 popup
// 无法被 CDP 观察且会阻塞会话）；捕获经 smoke:menu-popups 供闭环测试断言
const menuPopupSmokeMode = process.argv.includes('--smoke-menu') || process.env.EAGLE_MENU_SMOKE === '1';
// P1-c-2 验证（2026-09-14）：写路径替身烟测 —— 真实 renderer/channelBridge/preload/IPC 回程，
// 仅在 main→backend 边界（/api/item/updateMany）注入可控替身（EAGLE_WRITE_STUB_DIR），
// 驱动脚本见 electron/smoke/write-path-driver.js（断言在测试侧对照 stub 请求日志进行）。
const writePathSmokeMode = process.argv.includes('--smoke-write-path');
// 同批验证②：真实后端 + 临时库的编辑→重启读回（electron/smoke/persistence-driver.js，
// EAGLE_PERSISTENCE_PHASE=edit|check 两阶段）。
const persistenceSmokeMode = process.argv.includes('--smoke-persistence');
const writePathStubDir = process.env.EAGLE_WRITE_STUB_DIR || '';
let writePathStubSeq = 0;
function writePathStubReadControl() {
  try { return JSON.parse(fs.readFileSync(path.join(writePathStubDir, 'control.json'), 'utf8')) || {}; } catch (err) { return {}; }
}
function writePathStubWriteControl(control) {
  try { fs.writeFileSync(path.join(writePathStubDir, 'control.json'), JSON.stringify(control)); } catch (err) { /* ignore */ }
}
function writePathStubAppend(entry) {
  try { fs.appendFileSync(path.join(writePathStubDir, 'requests.jsonl'), JSON.stringify(entry) + '\n'); } catch (err) { /* ignore */ }
}
const menuPopupCaptures = [];
const menuPopupOutFile = process.env.EAGLE_MENU_SMOKE_OUT || '';
const dragStartCalls = [];
// b1-9am：OS 剪贴板健康自检——机器级剪贴板楔死（OpenClipboard 全调用方 ACCESS_DENIED、
// 无可见持有者）时跳过剪贴板类断言并在结果 JSON 中响亮标记 clipboardSkipped，不静默放水
let __clipboardHealth = null;
function clipboardHealthy() {
  if (__clipboardHealth === null) {
    try {
      clipboard.writeText('__eagle_cb_probe__');
      __clipboardHealth = clipboard.readText() === '__eagle_cb_probe__';
    } catch (err) {
      __clipboardHealth = false;
    }
  }
  return __clipboardHealth;
}
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

// b1-9bw：窗口几何落盘前必须先与**当前**显示器集合对账。
// 症状：electron 进程活着、`Loaded service plugin` 之后不再有日志、终端上看不到任何报错，
// 但屏幕上就是不出现窗口——实测 userData/window-state.json 里存着 {"x":302,"y":1262,...}，
// 而本机虚拟屏只有 1920x1080（副屏被拔掉/分辨率改小/上一个窗口被拖到屏幕下缘都会留下这种
// 陈旧几何），createWindow 原样沿用就把主窗整个建在可视区之外。
// 判定：与任一显示器工作区的交叠在横纵两个方向都小于阈值即视为不可见，丢弃 x/y 交给系统居中。
//
// R0-1（2026-09-17，验收整改 §3.1）：判定逻辑已抽到 `electron/window-geometry.cjs` 的纯函数，
// 由 `tests/electron-window-geometry.mjs` 穷举覆盖；此处只保留「取当前显示器」的薄封装。
// 抽离前它住在 main.cjs 里，而 main.cjs 既不进 tsconfig 也不被任何静态门禁扫描，
// 等于「删掉可见性校验」不会让任何门禁变红——这正是原缺陷能一路漏到用户手上的原因。
const {
  boundsVisibleEnough: boundsVisibleEnoughPure,
  clampWindowState: clampWindowStatePure,
} = require('./window-geometry.cjs');

function currentDisplays() {
  try {
    return screen.getAllDisplays();
  } catch (err) {
    // app 尚未 ready 时拿不到 screen，此时不拦（真正的窗口创建都发生在 ready 之后）。
    return [];
  }
}

function boundsVisibleEnough(bounds) {
  return boundsVisibleEnoughPure(bounds, currentDisplays());
}

function clampWindowState(saved) {
  return clampWindowStatePure(saved, currentDisplays());
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

/**
 * 传输层单点（结构化版）：**不抛异常**，把 HTTP 状态码与后端的
 * `{ status:'error', message, code }` 原样交给调用方。
 *
 * F06 引入：旋转/翻转的写回需要把后端的结构化错误码（UNSUPPORTED_FORMAT 415 /
 * PERMISSION_DENIED 403 / NOT_FOUND 404 …）**原样**送到渲染层。旧的 `apiRequest` 把
 * 非 2xx 一律压成 `new Error(payload.message)`，`code` 在 main→renderer 边界上被丢掉。
 * `apiRequest` 保持既有抛错语义，改为在本函数之上薄封装——两者共用同一份传输实现，
 * 不复制粘贴出第二个 HTTP 客户端。
 */
async function apiRequestDetailed(route, options = {}) {
  // P1-c-2 验证①：write-path 替身 —— 仅拦截 /api/item/updateMany（main→backend 边界），
  // 其余请求全部真实转发。替身按 control.json 施加延迟/失败并回显请求快照（等价真实后端 data）。
  if (writePathSmokeMode && route === '/api/item/updateMany') {
    const control = writePathStubReadControl();
    const seq = ++writePathStubSeq;
    writePathStubAppend({ seq, ts: Date.now(), body: options.body || null });
    if (control.failNext > 0) {
      writePathStubWriteControl({ ...control, failNext: Number(control.failNext) - 1 });
      return { ok: false, code: null, statusCode: 0, message: 'stub-failure seq=' + seq };
    }
    if (Number(control.delayMs) > 0) await new Promise((r) => setTimeout(r, Number(control.delayMs)));
    return {
      ok: true,
      data: Array.isArray(options.body && options.body.items) ? options.body.items : [],
    };
  }
  const target = new URL(`${apiBase}${route}`);
  const body = options.body ? JSON.stringify(options.body) : '';
  let response;
  try {
    response = await new Promise((resolve, reject) => {
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
  } catch (err) {
    // 传输层失败没有后端码；用不与后端码集合碰撞的本层码，避免渲染层误当成后端判据。
    return { ok: false, code: 'TRANSPORT_ERROR', statusCode: 0, message: (err && err.message) ? err.message : String(err) };
  }
  let payload;
  try {
    payload = JSON.parse(response.text);
  } catch (err) {
    payload = { status: 'error', message: response.text || `HTTP ${response.statusCode}` };
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || payload.status !== 'success') {
    return {
      ok: false,
      statusCode: response.statusCode,
      // 后端未给码时置 null（而非填空串/泛化文案），渲染层据此走自己的兜底码。
      code: (typeof payload.code === 'string' && payload.code) ? payload.code : null,
      message: payload.message || `API request failed: HTTP ${response.statusCode}`,
    };
  }
  return { ok: true, data: payload.data };
}

async function apiRequest(route, options = {}) {
  const result = await apiRequestDetailed(route, options);
  if (!result.ok) throw new Error(result.message || `API request failed: HTTP ${result.statusCode || 0}`);
  return result.data;
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
  const saved = clampWindowState(loadWindowState());
  const url = options.url || previewUrl;
  const width = options.width || saved.width || 1280;
  const height = options.height || saved.height || 800;
  // b1-9bw：位置先由调用方/历史状态解析，再统一过一遍可见性校验——两条来源都可能是陈旧值，
  // 任一不可见就整体丢弃 x/y，让系统居中，杜绝「进程在跑、窗口在屏幕外」的假死启动。
  const requestedX = typeof options.x === 'number' ? options.x : saved.x;
  const requestedY = typeof options.y === 'number' ? options.y : saved.y;
  const windowOptions = {
    width,
    height,
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
      webviewTag: true,
    },
  };
  if (typeof requestedX === 'number' && typeof requestedY === 'number'
    && boundsVisibleEnough({ x: requestedX, y: requestedY, width, height })) {
    windowOptions.x = requestedX;
    windowOptions.y = requestedY;
  }
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
  // b1-9bw：只有主窗口写回 window-state.json。此前 viewer:open / plugin:open / 原始预览等
  // 辅助窗共用同一份状态，任何一个被拖到屏幕下缘都会在关闭时把主窗的下次启动位置一起带偏
  // （实测落盘的 y=1262 即此类污染），所以辅助窗一律只读不写。
  if (options.persistState === true) {
    win.on('resize', () => saveWindowState(win));
    win.on('move', () => saveWindowState(win));
    win.on('close', () => saveWindowState(win));
  }
  return win;
}

function registerIpc() {
  if (writePathSmokeMode) {
    // 渲染层驱动经 preload 通用 ipc 桥控制 updateMany 替身（EAGLE_WRITE_STUB_DIR/control.json）。
    ipcMain.on('write-stub:control', (_event, control) => {
      writePathStubWriteControl({ failNext: 0, delayMs: 0, ...(control || {}) });
    });
    ipcMain.on('write-stub:reset', () => {
      try { fs.writeFileSync(path.join(writePathStubDir, 'requests.jsonl'), ''); } catch (err) { /* ignore */ }
    });
  }
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

  // R1-2（2026-09-17 验收整改 §3.2）：渲染层取 app 路径真值的**同步**频道。
  // 背景：渲染层的 `app.getPath('userData')` 此前恒返回 '/mock-user-data'（app 属主进程模块、
  // 且本仓无 @electron/remote），于是「缩略图临时目录」等派生路径一律落在不存在的目录里，
  // 且**看起来完全正常**。取不到时返回空串（而不是伪造路径），由 shim 侧显式登记能力缺口。
  ipcMain.on('app:get-path', (event, name) => {
    try {
      const value = typeof name === 'string' ? app.getPath(name) : '';
      event.returnValue = typeof value === 'string' ? value : '';
    } catch (err) {
      event.returnValue = '';
    }
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


  // F15c：原版 refresh（bundle 26275）/ refreshList（26282）的渲染层通道——此前无 handler 静默死。
  ipcMain.on('reload-app', () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.on('refresh-library', async () => {
    const library = await refreshCachedCurrentLibrary();
    if (library) await notifyLibraryLoaded(library);
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
  if (documentViewerSmokeMode) {
    // F-DOC-4：文档查看器冒烟的视觉留档 —— 页面侧经 ipc 触发，主进程截当前页落盘
    // （页面脚本不得直接 require fs；测试通过 EAGLE_DOCVIEWER_SHOTS=1 开启）。
    let shotSeq = 0;
    ipcMain.on('smoke:viewer-shot', (event, label = 'shot') => {
      try {
        const safe = String(label).replace(/[^a-z0-9-]/gi, '') || 'shot';
        void event.sender.capturePage().then((image) => {
          const dir = path.join(projectRoot, 'tests-tmp');
          fs.mkdirSync(dir, { recursive: true });
          shotSeq += 1;
          fs.writeFileSync(path.join(dir, `docviewer-visual-${shotSeq}-${safe}.png`), image.toPNG());
        }).catch(() => { /* 截图失败不影响断言 */ });
      } catch (err) { /* 截图失败不影响断言 */ }
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

  // item:image-transform：{id, op:'rotate'|'flip', degree?|flipType?} → /api/item/imageTransform
  // （后端单请求原子事务：渲染到临时文件 → 原子换入源文件 → 重生成缩略图 → 落 metadata 宽高）。
  // F06 第三批：非 JPEG 的旋转/翻转由此落盘（JPEG 走渲染层 EXIF 无损路径，不经此处）。
  //
  // **返回信封而不是 throw**：`ipcRenderer.invoke` 的 reject 跨 contextBridge 只保留 message，
  // 结构化 `code`/`statusCode` 会在 main→renderer 边界丢失；而本批次要求后端错误码**原样**
  // 到达渲染层（415 UNSUPPORTED_FORMAT / 403 PERMISSION_DENIED / 404 NOT_FOUND …）。
  // 因此统一回 `{ ok:true, data }` 或 `{ ok:false, code, message, statusCode }`，由渲染层
  // `services/imageTransformRoute.ts` 解码——不吞码、不改写成泛化文案。
  ipcMain.handle('item:image-transform', async (event, params = {}) => {
    const result = await apiRequestDetailed('/api/item/imageTransform', { method: 'POST', body: params || {} });
    if (result.ok) return { ok: true, data: result.data };
    console.error('[f06] item:image-transform failed:'
      + ` code=${result.code || '(none)'} http=${result.statusCode || 0} message=${result.message}`);
    return {
      ok: false,
      code: result.code || null,
      statusCode: result.statusCode || 0,
      message: result.message,
    };
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

  // b1-9as：update-txt-item 主侧监听（原 run.jsc 承载，随源码封存不可读；接收契约 =
  // app.bundle.js:31141 渲染侧监听 {id, text}）。text-editor 保存后经渲染层发送，此处
  // 回发各渲染窗——itemDomain 既有监听更新 itemMappings[id].text（本地 iframe 同进程
  // 无法直投，必须经 main 往返）。
  ipcMain.on('update-txt-item', (_event, params = {}) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      try {
        win.webContents.send('update-txt-item', params);
      } catch (err) {
        // 窗口销毁竞态：跳过该窗
      }
    }
  });

  // b1-9ar：empty-trash 主侧监听（原 background 窗 trashQueue 承载，background.js:616——
  // 随 b1-9t 删除）。逐 id 物理删除走 backend /api/item/emptyTrash（force 越过回收站
  // 校验），每项完成回发 remove-trash-item 保持原 trashQueueCallback 的事件节奏
  // （删除失败也回发——miscDomain 进度监听依赖「每项恰好一次」递进收口）；
  // cancel-empty-trash = 原 trashQueue.pause()+remove(pending)：在飞项完成并回发后断点。
  let emptyTrashCancelled = false;
  ipcMain.on('empty-trash', async (event, imageIdString) => {
    if (!imageIdString || !imageIdString.split) return;
    const imageIds = String(imageIdString).split(',');
    if (!imageIds || imageIds.length === 0) return;
    emptyTrashCancelled = false;
    for (const imageId of imageIds) {
      if (!imageId) continue;
      if (emptyTrashCancelled) break;
      try {
        await apiRequest('/api/item/emptyTrash', { method: 'POST', body: { ids: [imageId], force: true } });
      } catch (err) {
        // 原 trashQueueCallback：fse.remove 失败仅 electron-log，仍回发继续
      }
      for (const win of BrowserWindow.getAllWindows()) {
        if (win.isDestroyed()) continue;
        try {
          win.webContents.send('remove-trash-item');
        } catch (err) {
          // 窗口销毁竞态：跳过该窗
        }
      }
    }
  });
  ipcMain.on('cancel-empty-trash', () => {
    emptyTrashCancelled = true;
  });

  // b1-9at：native-viewer 主侧引擎（残余台账⑦；原 EdgeJS COM 管线随 7ba4c85 删除不可
  // 重建——backend nativePreview 等价替换：ai→pdf.js worker / ppt 族→soffice→worker /
  // psd 族无引擎 NATIVE_PREVIEW_UNSUPPORTED）。成功落 finalFile（viewer 轮询自取），
  // 失败回发 native-preview-failed 优雅降级（viewer 停轮询 + ready）。
  ipcMain.on('generate-hight-resolution-thumbnail', (event, params = {}) => {
    apiRequest('/api/item/nativePreview', {
      method: 'POST',
      body: {
        filePath: params.filePath,
        output: params.finalFile,
        size: params.size,
        ext: params.ext,
      },
    }).catch(() => {
      try {
        if (!event.sender.isDestroyed()) event.sender.send('native-preview-failed', { ext: params.ext });
      } catch (err) {
        // 发送方销毁竞态：忽略
      }
      return null;
    });
  });

  // b1-9at：darwin QL 无关路径（原 background 承载随 b1-9t 删除）——Electron 原生
  // nativeImage.createThumbnailFromPath 落 tempFilePath，darwin viewer rename 后轮询。
  ipcMain.handle('nativeImage.createThumbnailFromPath', async (_event, params = {}) => {
    const thumbnail = nativeImage.createThumbnailFromPath(params.filePath, {
      width: params.maxHeight || params.size || 1024,
      height: params.maxHeight || params.size || 1024,
    });
    if (params.tempFilePath && !thumbnail.isEmpty()) {
      fs.writeFileSync(params.tempFilePath, thumbnail.toPNG());
    }
    return { ok: !thumbnail.isEmpty() };
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
        { label: 'Eagle Reverse Workbench', click: () => shell.openExternal(`${frontendOrigin}/workbench.html`) },
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
      { label: 'Open Workbench', click: () => createWindow({ url: `${frontendOrigin}/workbench.html` }) },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
  return tray;
}

// D24①：service 插件根与 backend 共用**仓库内单一根** `plugins/`。
// 原实现走 path.resolve(__dirname,'..','..','plugins',...) —— 落在仓库外（本机不存在），
// 且解析结果随检出目录深度变化，是 M6 验收项 3 点名的「隐式开发机依赖」。
async function loadServicePlugins() {
  const pluginsRoot = path.resolve(process.env.EAGLE_PLUGINS_ROOT || path.join(__dirname, '..', 'plugins'));
  const pluginRoot = path.join(pluginsRoot, 'example-service-plugin');
  const manifestFile = path.join(pluginRoot, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    const err = new Error(`PLUGIN_RESOURCE_MISSING: service plugin manifest not found -> ${manifestFile}`);
    err.code = 'PLUGIN_RESOURCE_MISSING';
    throw err;
  }
  const { loadServicePlugin } = await import('../backend/src/plugin-runtime.js');
  const plugin = loadServicePlugin(pluginRoot);
  plugin.runLifecycle();
  console.log(`Loaded service plugin: ${plugin.manifest.name} (${plugin.manifest.id})`);
}

if (smokeMode || pluginSmokeMode || desktopSmokeMode || librarySmokeMode || mainWorkflowSmokeMode || documentViewerSmokeMode || browserCaptureUiSmokeMode || previewDeliverySmokeMode || exportProgressSmokeMode || videoDetailSmokeMode || regressionHostMode || dragSmokeMode || channelsSmokeMode || writePathSmokeMode || persistenceSmokeMode || windowBoundsSmokeMode) {
  app.setPath('userData', process.env.EAGLE_ELECTRON_USER_DATA_DIR || path.join(os.tmpdir(), `eagle-reverse-smoke-${process.pid}`));
}

app.whenReady().then(async () => {
  registerIpc();
  setupMenu();
  // D24①：插件资源缺失必须**明确失败**。原先 loadServicePlugins 内部 catch 后只打一行
  // console.warn 就继续启动，桌面端会在「插件静默不存在」的状态下照常运行、退出码为 0。
  try {
    await loadServicePlugins();
  } catch (err) {
    console.error(`SERVICE_PLUGIN_LOAD_FAILED: ${err.message}`);
    app.exit(1);
    return;
  }
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
                // b1-9bz-E5-2：就绪探针改读显式驱动面 window.__eagleDriver（主窗 main.tsx 启动期安装，
                // 见 core/driverApi.ts）；raw/listDone 均在该面白名单内（store 后端），语义与原 scope 面一致。
                const bodyScope = window.__eagleDriver || null;
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
    // b1-9am 修正：探针必须先于 writeImage 执行——探针 writeText 会覆盖剪贴板，
    // 若晚于预写图片则 read-win-files 拿到空图（重启后健康路径首跑即暴露）
    const __m1CbHealthy = clipboardHealthy();
    if (clipboardImageSource && fs.existsSync(clipboardImageSource)) {
      clipboard.writeImage(nativeImage.createFromPath(clipboardImageSource));
    }
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const result = await win.webContents.executeJavaScript(
            `(async () => {
              const __cbHealthy = ${__m1CbHealthy ? 'true' : 'false'};
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
                // b1-9bz-E5-2：就绪探针改读显式驱动面 window.__eagleDriver（主窗 main.tsx 启动期安装，
                // 见 core/driverApi.ts）；raw/listDone 均在该面白名单内（store 后端），语义与原 scope 面一致。
                const bodyScope = window.__eagleDriver || null;
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
              // b1-9bz-E7（main-ui-workflow 定位）：imagesChange 只把改名写进克隆与后端，live 对象
              // 保留旧名（回声同步时机抖动）——后续步的 updateMany 载荷会携带旧名，被后端当补丁打回
              // （name 回退断言超时）。等价 bundle 回声语义：每个持久化等待点后把后端条目原地并入 live。
              const syncLiveFromBackend = async (id) => {
                const current = await window.eagleDesktop.library.current();
                const it = current.items.find((entry) => entry && entry.id === id);
                const live = currentItem(id);
                if (it && live) Object.assign(live, it);
                return it;
              };
              // b1-9bz-E7（同因）：machineryUpdateSelection 的 30ms 防抖会在驱动写入 inspector.new*
              // 之后把字段覆盖回 selected 当前值——imagesChange 读到空名会早退不发（no-event）。
              // 写入后跨过防抖窗口校验，被覆盖则重写，稳定后调用方再触发动作。
              const setInspectorField = (key, value) => new Promise((resolve) => {
                const attempt = () => {
                  scope.inspector[key] = value;
                  setTimeout(() => {
                    if (scope.inspector[key] !== value) attempt();
                    else resolve();
                  }, 40);
                };
                attempt();
              });
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

              // b1-9am：OS 剪贴板楔死时 paste-paths 经 shim 读真剪贴板为空 → handler 抛错——
              // 探针为否则整段跳过（result.clipboardPath/clipboardImage 落空，断言面已放行）
              let clipboardItem = null;
              let clipboardImageItem = null;
              if (__cbHealthy) {
                const clipboardResult = await sendAndWait('paste-paths', { files: [clipboardSource], folder: null }, 'clipboard path import');
                clipboardItem = await waitFor(() => scope.raw.find((item) => clipboardResult.items.some((entry) => entry.id === item.id)), 'clipboard item refresh');
                assertUniqueItems('clipboard path import');
                const clipboardImageResult = await sendAndWait('read-win-files', { folder: null, params: {} }, 'clipboard image import');
                clipboardImageItem = await waitFor(() => scope.raw.find((item) => clipboardImageResult.items.some((entry) => entry.id === item.id)), 'clipboard image refresh');
                assertUniqueItems('clipboard image import');
              }

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
              await setInspectorField('newName', 'Inspector Renamed');
              await setInspectorField('newUrl', 'https://example.test/original-main');
              // b1-9bz-D-4：原实现只等一次结果，CI/并发压力下偶发「事件丢失/操作失败」假失败。
              // 改为触发+等待最多 5 轮（每轮 8s），超时轮次重新触发 imagesChange
              // （shim 的 updateMany 走后端 HTTP，负载下可能整体失败——ok:false 也会本轮等满后重试）。
              let firstInspectorOperation = null;
              // 诊断：记录上一轮「结果到达但不含目标 id」或 ok:false 的值，超时时一并抛出。
              let lastBad = null;
              for (let attempt = 0; attempt < 5 && !firstInspectorOperation; attempt++) {
                let sawResult = false;
                const firstInspectorResult = new Promise((resolve) => {
                  const ipc = require('electron').ipcRenderer;
                  const timer = setTimeout(() => {
                    ipc.off('item:operation-result', onResult);
                    resolve(null);
                  }, 8000);
                  const onResult = (_event, value) => {
                    sawResult = true;
                    const items = value && Array.isArray(value.items) ? value.items : [];
                    if (!items.some((item) => item.id === droppedId)) {
                      lastBad = { reason: 'no-target-id', value };
                      return;
                    }
                    clearTimeout(timer);
                    ipc.off('item:operation-result', onResult);
                    resolve(value);
                  };
                  ipc.on('item:operation-result', onResult);
                });
                await setInspectorField('newName', 'Inspector Renamed');
                await setInspectorField('newUrl', 'https://example.test/original-main');
                inspectorActions.imagesChange();
                firstInspectorOperation = await firstInspectorResult;
                if (!firstInspectorOperation) {
                  if (!sawResult) lastBad = { reason: 'no-event' };
                  await new Promise((resolve) => setTimeout(resolve, 500));
                }
              }
              if (!firstInspectorOperation) throw new Error('inspector operation result timeout for ' + droppedId + ' last=' + JSON.stringify(lastBad));
              if (!firstInspectorOperation.ok) throw new Error('inspector update failed: ' + JSON.stringify(firstInspectorOperation));
              const firstUpdatedItem = Array.isArray(firstInspectorOperation.items) ? firstInspectorOperation.items.find((item) => item.id === droppedId) : null;
              if (!firstUpdatedItem || firstUpdatedItem.name !== 'Inspector Renamed' || firstUpdatedItem.url !== 'https://example.test/original-main') {
                throw new Error('inspector operation returned unexpected item: ' + JSON.stringify(firstInspectorOperation));
              }
              await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                const item = current.items.find((entry) => entry.id === droppedId);
                return item && item.name === 'Inspector Renamed' && item.url === 'https://example.test/original-main';
              }, 'inspector name and URL persistence');
              await syncLiveFromBackend(droppedId);

              await setInspectorField('newAnnotation', '原版检查器真实持久化');
              inspectorActions.annotationChange();
              await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                const item = current.items.find((entry) => entry.id === droppedId);
                return item && item.annotation === '原版检查器真实持久化';
              }, 'inspector annotation persistence');
              await syncLiveFromBackend(droppedId);

              scope.TagManager.addTags(['main-ui', 'persisted']);
              const workflowFolder = await waitFor(() => scope.folders.find((folder) => folder.id === workflowFolderId), 'workflow folder');
              scope.addImagesToFolder([dropped], workflowFolder);
              scope.changeStar(4, false, true);

              const renamed = await waitFor(async () => {
                const current = await window.eagleDesktop.library.current();
                const item = current.items.find((entry) => entry.id === droppedId);
                return item && item.name === 'Inspector Renamed' && item.url === 'https://example.test/original-main' && item.annotation === '原版检查器真实持久化' && item.star === 4 && item.tags.includes('main-ui') && item.folders.includes(workflowFolder.id) ? item : null;
              }, 'inspector tags folder and star persistence');
              await syncLiveFromBackend(droppedId);

              await selectInspectorItems(clipboardItem ? [droppedId, clipboardItem.id] : [droppedId]);
              // b1-9f 取证探针贴回（PROGRESS b1-9f 节配方）：multi inspector persistence 复发
              // 取证——早照（操作前）+ reject 载荷 identity，判定 itemMappings/raw/selected 身份分裂
              const earlyIdentity = (() => {
                const rawEntry = scope.raw && scope.raw.find((i) => i.id === droppedId);
                const mapEntry = scope.itemMappings && scope.itemMappings[droppedId];
                return {
                  mapIsRaw: mapEntry === rawEntry,
                  selIsMap: Array.isArray(scope.selected) && scope.selected.some((it) => it === mapEntry),
                  rawVals: rawEntry && [rawEntry.star, rawEntry.annotation, (rawEntry.tags || []).join('/')],
                  mapVals: mapEntry && [mapEntry.star, mapEntry.annotation, (mapEntry.tags || []).join('/')],
                  selVals: scope.selected && scope.selected.map((it) => it && [String(it.id).slice(-4), it.star, it.annotation]),
                };
              })();
              await setInspectorField('newAnnotation', '多选备注持久化');
              inspectorActions.annotationChange();
              scope.TagManager.addTag('batch-ui');
              scope.changeStar(3, false, true);
              const midIdentity = (() => {
                const rawEntry = scope.raw && scope.raw.find((i) => i.id === droppedId);
                const mapEntry = scope.itemMappings && scope.itemMappings[droppedId];
                return {
                  mapIsRaw: mapEntry === rawEntry,
                  rawVals: rawEntry && [rawEntry.star, rawEntry.annotation, (rawEntry.tags || []).join('/')],
                  mapVals: mapEntry && [mapEntry.star, mapEntry.annotation, (mapEntry.tags || []).join('/')],
                };
              })();
              await new Promise((resolve, reject) => {
                const deadline = Date.now() + 15000;
                const poll = async () => {
                  try {
                    const current = await window.eagleDesktop.library.current();
                    const targets = current.items.filter((entry) => entry.id === droppedId || (clipboardItem && entry.id === clipboardItem.id));
                    if (targets.length === (clipboardItem ? 2 : 1) && targets.every((item) => item.annotation === '多选备注持久化' && item.star === 3 && item.tags.includes('batch-ui'))) {
                      resolve(targets);
                      return;
                    }
                    if (Date.now() >= deadline) {
                      reject(new Error('multi inspector persistence timeout ' + JSON.stringify({
                        droppedId,
                        clipboardId: clipboardItem && clipboardItem.id,
                        targets,
                        selectedIds: scope.selected && scope.selected.map((item) => item && item.id),
                        earlyIdentity,
                        identity: midIdentity,
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
              // b1-9bz-E7：P1-c-2 后 images-change 唯一落点 = 接缝 routeDesktop（单路由不变量）。原直发
              // shims 总线（require('electron') 是 shims mock），分支已删 → 落 console.debug 黑洞。
              {
                const restoreBridge = window.__eagleIpcBridge && typeof window.__eagleIpcBridge.send === 'function'
                  ? window.__eagleIpcBridge
                  : (window.$electronIpc || window.__eagleIpc);
                restoreBridge.send('images-change', [trashedItem]);
              }
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
          const ok = result.originalPage && result.originalScope && result.originalInspector && result.textDrop && result.textDropExt === 'txt' && result.textThumbnailGenerated && result.fileDrop && result.folderDrop >= 1 && (clipboardHealthy() ? (result.clipboardPath && result.clipboardImage) : true) && result.after >= result.before + (clipboardHealthy() ? 4 : 2) && result.detailMode && result.detailLockedBeforeOriginal && result.detailDelivery && result.detailDelivery.visible && result.detailDelivery.tileCount > 0 && result.previewOpened && renamed && !renamed.isDeleted && renamed.annotation === '多选备注持久化' && renamed.star === 3 && renamed.tags.includes('batch-ui') && diskOk;
          console.log(ok ? `MAIN_WORKFLOW_SMOKE_OK ${JSON.stringify({ ...result, diskOk, clipboardSkipped: !clipboardHealthy() })}` : `MAIN_WORKFLOW_SMOKE_FAIL ${JSON.stringify({ ...result, diskOk, clipboardSkipped: !clipboardHealthy(), renamed })}`);
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
      show: process.env.EAGLE_DOCVIEWER_SHOW === '1',
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
              const siblingId = ${JSON.stringify(process.env.EAGLE_DOCVIEWER_SIBLING_ID || '')};
              const siblingText = ${JSON.stringify(process.env.EAGLE_DOCVIEWER_SIBLING_TEXT || '')};

              window.__bbNotify = 0;
              if (window.__eagleBodyState) window.__eagleBodyState.subscribe(() => { window.__bbNotify += 1; });

              const scope = await waitFor(() => {
                // b1-9bz-E5-2：就绪探针改读显式驱动面 window.__eagleDriver（主窗 main.tsx 启动期安装，
                // 见 core/driverApi.ts）；raw/listDone 均在该面白名单内（store 后端），语义与原 scope 面一致。
                const bodyScope = window.__eagleDriver || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'original main scope', 25000);
              const item = await waitFor(() => scope.raw.find((entry) => entry && entry.id === itemId), 'document item', 10000);
              const imageItem = ${JSON.stringify(process.env.EAGLE_DOCVIEWER_IMAGE_ID || '')}
                ? await waitFor(() => scope.raw.find((entry) => entry && entry.id === ${JSON.stringify(process.env.EAGLE_DOCVIEWER_IMAGE_ID || '')}), 'image item', 10000)
                : null;

              const gridClickItem = async (target) => {
                const box = await waitFor(
                  () => document.querySelector('.box[data-box-id="' + target.id + '"]'),
                  'grid box for selection', 10000
                );
                box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                box.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                return box;
              };

              // Activate the document through the **real grid double-click path**
              // (mousedown 选区 → dblclick → selectionService → machineryEnterDetailMode)。
              // F-DOC-1 的教训是 UI 与 machinery 面可能是不同函数对象；F-DOC-4 后二者重新
              // 汇聚，但仍以真实 UI 事件为第一验收路径。
              const itemBox = await gridClickItem(item);
              itemBox.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
              await new Promise((resolve) => setTimeout(resolve, 300));
              const uiPathOpened = Boolean(document.querySelector('#eagle-document-viewer-container'));
              if (!uiPathOpened) throw new Error('UI grid dblclick did not open document viewer');
              // F-DOC-4：文档分支建立时原生详情机制必须同步激活（选区/current/isDetailMode）——
              // 这是「文档详情 = 详情模式内的文档分支」的直接证据。
              const uiDetailActive = Boolean(document.body.classList.contains('is-detail-mode'));
              if (!uiDetailActive) throw new Error('native detail mode not active under document viewer');
              // UI 路径下同时确认内容已握手渲染（不只是容器挂上），再关闭。
              const uiContainer = document.querySelector('#eagle-document-viewer-container');
              await waitFor(() => uiContainer.hasAttribute('data-viewer-ready'), 'ui path viewer ready handshake', 20000);
              // 注：退出按钮 title 随阅读/编辑态不同——阅读态为「退出预览 (ESC)」，编辑态为「退出 (ESC)」。
              const uiExitButton = await waitFor(() => {
                const frame = uiContainer.querySelector('iframe');
                const doc = frame && frame.contentDocument;
                return doc && doc.querySelector('button[title^="退出"]');
              }, 'ui path exit button', 20000);
              uiExitButton.click();
              await waitFor(() => !document.querySelector('#eagle-document-viewer-container'), 'ui path viewer close', 8000);
              // F-DOC-4：详情退出断言读 store（body class 的 React 落盘存在滞后窗口）。
              await waitFor(() => window.__eagleBodyState && !window.__eagleBodyState.getState().isDetailMode, 'ui path back to grid (store)', 8000);

              // F-DOC-4：选区在退出详情后仍保留（machineryLeaveDetailMode 不清 selected），
              // 直接经驱动面重进详情；无需再走网格点击（虚拟化网格在详情态会卸载盒子）。
              scope.enterDetailMode(null, item);
              await new Promise((resolve) => setTimeout(resolve, 300));

              const container = await waitFor(() => document.querySelector('#eagle-document-viewer-container'), 'viewer container', 10000);
              await waitFor(() => container.hasAttribute('data-viewer-ready'), 'viewer ready handshake', 20000);
              const iframe = container.querySelector('iframe');
              if (!iframe) throw new Error('viewer iframe missing');
              const viewerUrl = String(iframe.src);
              if (!viewerUrl.includes('/src/app/react/viewers/document/index.html')) {
                throw new Error('unexpected viewer url: ' + viewerUrl);
              }

              // The migrated document surface must render inside the viewer.
              const viewerDoc = await waitFor(() => {
                const doc = iframe.contentDocument;
                if (!doc) return null;
                return doc.querySelector('.w-md-editor, .text-document-surface, .office-document-surface, .document-preview, .office-docx-html') ? doc : null;
              }, 'viewer rendered surface', 30000);

              const bodyText = viewerDoc.body.textContent || '';
              const contentOk = Boolean(expectedText && bodyText.includes(expectedText));
              // External-chrome mode: the generic stage actions (navigation,
              // favorite, reveal…) are hidden; the exit (×) action lives in
              // the viewer's editor toolbar right of the preview button.
              // 注：退出按钮 title 随阅读/编辑态不同（「退出预览 (ESC)」/「退出 (ESC)」），
              // 且 F-DOC-1 后 office 类素材也会走到这里，故用前缀匹配。
              const inIframeStageActions = Boolean(viewerDoc.querySelector('[data-preview-stage-actions]'));
              const exitButton = viewerDoc.querySelector('button[title^="退出"]');
              const exitOk = Boolean(exitButton);

              // The document workspace auto-collapses the left rail on entry.
              // F-DOC-4：侧栏状态断言改用 **store + 容器内边距**（applyViewerMode 的 250ms 轮询
              // 会跟随 store 重排 overlay），不依赖 body class 的 React 落盘时序。
              const bodyStore = window.__eagleBodyState;
              const sidebarHiddenInStore = () => (bodyStore ? Boolean(bodyStore.getState().isHideSidebar) : document.body.classList.contains('hide-sidebar'));
              try {
                await waitFor(() => sidebarHiddenInStore(), 'sidebar auto-collapsed', 6000);
              } catch (err) {
                scope.toggleAll();
                await waitFor(() => sidebarHiddenInStore(), 'sidebar auto-collapsed (manual toggle)', 6000);
              }
              await waitFor(() => container.style.left === '0px', 'container left 0 on entry', 8000);
              const autoCollapsed = true;

              // Eagle's rail buttons can still reopen it; the container then
              // reflows inward to make room for the rail.
              scope.toggleAll();
              await waitFor(() => !sidebarHiddenInStore(), 'sidebar expanded', 6000);
              try {
                await waitFor(() => container.style.left !== '0px', 'container left offset when sidebar shown', 8000);
              } catch (err) {
                const sb = window.__eagleBodyState ? window.__eagleBodyState.getState().isHideSidebar : 'no-store';
                const sbEl = document.getElementById('sidebar');
                throw new Error('container left fail; storeHidden=' + sb + '; sidebarW=' + (sbEl ? sbEl.offsetWidth : -1) + '; cls=' + JSON.stringify(document.body.className) + '; reactErr=' + String(window.__reactErr || 'none').slice(0, 300) + '; notify=' + window.__bbNotify);
              }
              const sidebarExpandedLeft = container.style.left;
              scope.toggleAll();
              await waitFor(() => sidebarHiddenInStore(), 'sidebar collapsed again', 6000);
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

              // ── F-DOC-2：原生顶栏改造断言（必须在关闭之前断言）──
              // 文档查看器打开且握手完成后，**原生 DetailToolbar 组件本身**改渲染文档控件组
              // （F-DOC-4：文档详情是详情模式内的分支，顶栏挂在详情工具栏宿主上，与图像
              // 详情同一位置）：
              //   - 原生内容（缩放条/插件按钮）根本不渲染；
              //   - 顶栏左上角是「返回键 + 计数器」，与图像详情同构。
              // 注意这里断言的是「原生内容不存在」，而不是「被 CSS 藏起来」——后者是
              // 套层皮的做法，已被明确否决。
              const findDocToolbarHost = () => {
                const el = document.querySelector('#eagle-detail-host .toolbar');
                return el && el.querySelector('.doc-chrome') ? el : null;
              };
              let toolbarHost = null;
              try {
                toolbarHost = await waitFor(findDocToolbarHost, 'detail toolbar host with document chrome', 20000);
              } catch (err) {
                // iframe 冷启动偶发未握手：关闭后重开一次再试。
                scope.leaveDetailMode();
                await waitFor(() => !document.querySelector('#eagle-document-viewer-container'), 'retry close', 8000);
                await new Promise((r) => setTimeout(r, 400));
                scope.enterDetailMode(null, item);
                await waitFor(() => {
                  const c = document.querySelector('#eagle-document-viewer-container');
                  return c && c.hasAttribute('data-viewer-ready') ? c : null;
                }, 'retry viewer ready', 20000);
                const dbgFrame = document.querySelector('#eagle-document-viewer-container iframe');
                const dbgDoc = dbgFrame && dbgFrame.contentDocument;
                const dbgInfo = {
                  frame: Boolean(dbgFrame),
                  stage: Boolean(dbgDoc && dbgDoc.querySelector('[data-preview-stage]')),
                  surface: Boolean(dbgDoc && dbgDoc.querySelector('.text-document-surface, .office-document-surface, .document-preview, .w-md-editor')),
                  bodyHead: dbgDoc ? String(dbgDoc.body.innerText || '').slice(0, 60) : 'no-doc',
                  src: dbgFrame ? String(dbgFrame.src).slice(0, 90) : ''
                };
                toolbarHost = await waitFor(findDocToolbarHost, 'detail toolbar host with document chrome (retry)', 20000)
                  .catch((e2) => { throw new Error('docChrome retry fail; iframe=' + JSON.stringify(dbgInfo)); });
              }
              const docChrome = await waitFor(
                () => toolbarHost.querySelector('.doc-chrome'),
                'document chrome group', 12000
              );

              const visualShots = [];
              // 视觉留档：经 ipc 交主进程截屏落盘（页面脚本不直接 require fs，见 smoke:viewer-shot）。
              const captureShot = async (label) => {
                try {
                  require('electron').ipcRenderer.send('smoke:viewer-shot', label);
                  visualShots.push(label);
                } catch (err) { visualShots.push('FAILED:' + label); }
                await new Promise((r) => setTimeout(r, 200));
              };
              await captureShot('doc-open');

              const docBack = toolbarHost.querySelector('.breadcrumbs .ic-btn.prev');
              const docCounter = toolbarHost.querySelector('.breadcrumbs .counter');
              const docCounterText = docCounter ? (docCounter.textContent || '').trim() : '';
              const docBackOk = Boolean(docBack && docBack.querySelector('img'));
              // 左上角必须与图像详情同构：侧栏开关（原生 #toggle-all-btn）在返回键**之前**。
              const docToggle = toolbarHost.querySelector('.breadcrumbs #toggle-all-btn');
              const docToggleOk = Boolean(docToggle && docToggle.querySelector('img'));
              if (!docToggleOk) {
                throw new Error('document chrome sidebar toggle button missing');
              }
              // 应用菜单按钮（hamburger）：文档态也应当是**可见**的入口。
              const docAppMenu = toolbarHost.querySelector('.breadcrumbs .application-menu-btn');
              const docAppMenuVisible = (() => {
                if (!docAppMenu) return false;
                const style = getComputedStyle(docAppMenu);
                const rect = docAppMenu.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
              })();
              // 端到端：点真实的 hamburger 按钮，确认它真的打开应用菜单（File/View/Help）。
              // 原生 popup 无法被 CDP 观察且会阻塞会话，故由 main 侧在 __EAGLE_MENU_SMOKE 下
              // 序列化菜单模板落盘（见 ipc 'smoke:menu-popup' 的 application-menu 分支），
              // 断言由外层测试读取该文件完成。
              const docAppMenuClicked = (() => {
                if (!docAppMenuVisible || !docAppMenu) return false;
                docAppMenu.click();
                return true;
              })();
              // 给 ipc 往返留出时间（菜单模板由主进程写文件）。
              if (docAppMenuClicked) {
                await new Promise((resolve) => setTimeout(resolve, 600));
              }
              // DOM 顺序断言：toggle-all-btn 必须出现在 doc-chrome-back 之前。
              if (docToggle && docBack) {
                const order = docToggle.compareDocumentPosition(docBack);
                const toggleFirst = Boolean(order & Node.DOCUMENT_POSITION_FOLLOWING);
                if (!toggleFirst) {
                  throw new Error('sidebar toggle must precede the back arrow in .breadcrumbs');
                }
              }
              // 返回键图标（ic-toolbar-exit.svg）也必须走同一套墨迹归一：
              // viewBox 23×23 但墨迹仅 11px（填充率 48%），盒子需 ~27px 才能与其他图标等重。
              const docBackImg = docBack ? docBack.querySelector('img') : null;
              const docBackBox = docBackImg ? Number(docBackImg.getAttribute('width') || 0) : 0;
              const docBackRendered = docBackImg ? Math.round(docBackImg.getBoundingClientRect().height) : 0;
              if (!(docBackBox >= 24)) {
                throw new Error('back button icon not normalized (expected box >= 24): ' + docBackBox);
              }
              const docCounterOk = /^[0-9]+\\s*\\/\\s*[0-9]+$/.test(docCounterText);
              if (!docBackOk) throw new Error('document chrome back button missing');
              if (!docCounterOk) throw new Error('document chrome counter missing/invalid: ' + JSON.stringify(docCounterText));
              // 原生工具栏内容必须**不在 DOM 中**（真正的分支渲染，而非视觉遮盖）。
              // 注意：#toggle-all-btn（侧栏开关）**不在**此列 —— 它是图像详情顶栏也有的
              // 公共控件，文档态同样需要保留（用户要求左上角与图像详情一致）。
              const nativeLeftovers = toolbarHost.querySelectorAll(
                '.sliders-bar, .pinned-plugins, input[type="search"]'
              ).length;
              if (nativeLeftovers > 0) {
                throw new Error('native toolbar content still rendered during document chrome: ' + nativeLeftovers);
              }
              // 圆形图标按钮计数（不含原生 .ic-btn 形状的 prev/next）。
              // 当前构成：主题 + 编辑 + 分栏 + 预览 + 收藏 + 打开原文件 + 全屏 + 关闭 = 8。
              const docRoundBtnCount = toolbarHost.querySelectorAll('.doc-chrome .doc-chrome-btn').length;
              if (docRoundBtnCount < 6) {
                throw new Error('expected document chrome buttons, got ' + docRoundBtnCount);
              }
              // 图标光学尺寸一致性：各按钮内 icon 的**可见墨迹**必须落在同一区间。
              // 原生图标 SVG 的 viewBox 差异极大（exit 23 / prev 24 / close 10 / zoom-fit 14），
              // 且墨迹填充率从 48% 到 101% 不等；若按统一 width/height 强制缩放，
              // prev/next 的可见箭头会只有 close 的一半高——这正是「icon 大小不一」的缺陷。
              // 注意：prev/next 是原生 .ic-btn（在 .doc-chrome 直接子级），不在 .doc-chrome-btn 内。
              const docIconMetrics = (() => {
                const nodes = toolbarHost.querySelectorAll(
                  '.doc-chrome .doc-chrome-btn, .doc-chrome > .ic-btn.prev, .doc-chrome > .ic-btn.next'
                );
                const out = [];
                nodes.forEach((btn) => {
                  const el = btn.querySelector('img, svg');
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  const isImg = el.tagName.toLowerCase() === 'img';
                  const name = isImg
                    ? (el.getAttribute('src') || '').split('/').pop()
                    : 'lucide';
                  out.push({
                    name,
                    w: Math.round(rect.width * 10) / 10,
                    h: Math.round(rect.height * 10) / 10,
                    box: isImg ? Number(el.getAttribute('width') || 0) : null,
                  });
                });
                return out;
              })();
              // 归一表生效的直接证据：prev/next 的盒子必须显著大于 close（填充率补偿），
              // 否则说明又退回了「统一尺寸」的写法。
              const boxOf = (n) => {
                const hit = docIconMetrics.find((m) => m.name === n);
                return hit ? hit.box : null;
              };
              const prevBox = boxOf('ic-toolbar-prev.svg');
              const closeBox = boxOf('ic-toolbar-close.svg');
              if (!(prevBox > closeBox)) {
                throw new Error(
                  'icon box normalization not applied: prev=' + prevBox + ' close=' + closeBox
                );
              }
              const docIconSizes = docIconMetrics.map((entry) => entry.h);
              const docIconMin = docIconSizes.length ? Math.min.apply(null, docIconSizes) : 0;
              const docIconMax = docIconSizes.length ? Math.max.apply(null, docIconSizes) : 0;
              // 宿主必须可见：详情工具栏根（含文档控件分支）在接管期间不能被隐藏。
              if (getComputedStyle(toolbarHost).display === 'none') {
                throw new Error('toolbar host hidden during document viewer takeover');
              }

              // ── F-DOC-3：顶栏「下一个素材」必须真的把 iframe 切走 ──
              // 缺陷背景：查看器的素材列表与当前项来自 iframe URL 参数（id/ids），
              // 宿主点 prev/next 只改了宿主 React 状态，iframe 内 store 毫不知情，
              // 画面始终停在最初那篇（用户反馈「切换失败、卡在文本框里」）。
              // F-DOC-4 后：顶栏按钮直调原生 machinerySelectNext/Prev，宿主同步层再把
              // iframe 原地切页。这里点真实按钮，断言 iframe **内容标题**真的换成了兄弟文档。
              // 两个方向都判：当前项是最后一篇就点「上一篇」，否则点「下一篇」。
              const docNextBtn = toolbarHost.querySelector('#doc-chrome-next');
              const docPrevBtn = toolbarHost.querySelector('#doc-chrome-prev');
              if (!docNextBtn || !docPrevBtn) {
                throw new Error('document chrome nav buttons missing');
              }
              // F-DOC-4：方向按兄弟文档在列表中的位置动态判定（列表排序不保证导入序）。
              const rawIndexOf = (id) => scope.raw.findIndex((entry) => entry && entry.id === id);
              const curIdx = rawIndexOf(scope.selected[0] && scope.selected[0].id);
              const sibIdx = siblingId ? rawIndexOf(siblingId) : -1;
              const navUseNext = sibIdx > curIdx;
              const navBtn = navUseNext ? docNextBtn : docPrevBtn;
              const navDirection = navUseNext ? 'next' : 'prev';
              let navOk = null;
              let navContentText = '';
              if (siblingId && navBtn) {
                navBtn.click();
                navOk = await waitFor(() => {
                  const frame = document.querySelector('#eagle-document-viewer-container iframe');
                  if (!frame) return null;
                  try {
                    const doc = frame.contentDocument;
                    if (!doc) return null;
                    const text = (doc.body ? doc.body.innerText : '') || '';
                    return text.includes(siblingText) ? true : null;
                  } catch (err) {
                    return null;
                  }
                }, 'viewer navigated to sibling document', 12000).catch((e2) => {
                  const dbgF = document.querySelector('#eagle-document-viewer-container iframe');
                  const dbgT = dbgF && dbgF.contentDocument ? String(dbgF.contentDocument.body.innerText || '').slice(0, 100) : 'no-frame';
                  throw new Error('nav fail; selected=' + (scope.selected[0] && scope.selected[0].id) + '; item=' + item.id + '; sibling=' + siblingId + '; dir=' + navDirection + '; iframeText=' + JSON.stringify(dbgT));
                });
                const frame = document.querySelector('#eagle-document-viewer-container iframe');
                try {
                  navContentText = frame && frame.contentDocument ? (frame.contentDocument.body.innerText || '').slice(0, 160) : '';
                } catch (err) { navContentText = ''; }
              }
              // 切走后计数器应随之变化（F-DOC-4：计数器由宿主 detail 快照供给）。
              const navCounterText = (() => {
                const el = toolbarHost.querySelector('.breadcrumbs .counter');
                return el ? (el.textContent || '').trim() : '';
              })();
              const navCounterMoved = Boolean(
                navCounterText && docCounterText && navCounterText !== docCounterText
              );

              // ── F-DOC-4：跨类型切换闭环（用户报告的主缺陷）──
              // 文档查看器里点「下一个素材」，若目标是图片/视频等非文档类，必须**关闭文档
              // overlay 并直接显示对应的原生详情**；反向（原生详情切到文档）必须重新挂上
              // overlay。此前 iframe 只会渲染 FileX 占位图，右栏检查器也停在旧素材上。
              let crossOk = null;
              let crossNativeDetail = null;
              let reverseOk = null;
              if (imageItem) {
                const rawIndexOf = (id) => scope.raw.findIndex((entry) => entry && entry.id === id);
                // 从当前选中项出发，向 imageItem 方向逐篇点击（每次 = 原生 machinery 推进一步）。
                const stepOnce = async () => {
                  const currentIndex = rawIndexOf(scope.selected[0] && scope.selected[0].id);
                  const imageIndex = rawIndexOf(imageItem.id);
                  const useNext = imageIndex > currentIndex;
                  const button = useNext
                    ? document.querySelector('#doc-chrome-next')
                    : document.querySelector('#doc-chrome-prev');
                  if (!button || button.classList.contains('disabled')) return false;
                  button.click();
                  return true;
                };
                let steps = 0;
                while (document.querySelector('#eagle-document-viewer-container') && steps < scope.raw.length + 2) {
                  const stepped = await stepOnce();
                  if (!stepped) break;
                  steps += 1;
                  await waitFor(
                    () => {
                      const idx = rawIndexOf(scope.selected[0] && scope.selected[0].id);
                      return idx === rawIndexOf(imageItem.id) || idx === -1 ? true : null;
                    },
                    'selection advanced', 8000
                  ).catch(() => {});
                  await new Promise((resolve) => setTimeout(resolve, 120));
                }
                await waitFor(
                  () => !document.querySelector('#eagle-document-viewer-container') ? true : null,
                  'document overlay closed on non-document target', 8000
                );
                crossOk = true;
                // 原生详情必须真的在显示：is-detail-mode 保持、doc-chrome 已摘除、
                // 原生详情工具列（#eagle-detail-host 下的缩放条）回归、#detail-container 可见。
                crossNativeDetail = await waitFor(() => {
                  const host = document.getElementById('eagle-toolbar-host');
                  if (!host || host.querySelector('.doc-chrome')) return null;
                  const detailMode = document.body.classList.contains('is-detail-mode');
                  const container = document.getElementById('detail-container');
                  const opacity = container ? getComputedStyle(container).opacity : '';
                  const sliders = document.querySelector('#eagle-detail-host .sliders-bar');
                  const selectedId = scope.selected[0] && scope.selected[0].id;
                  return detailMode && sliders && opacity === '1' && selectedId === imageItem.id
                    ? { detailMode, opacity, sliders: true, selectedId }
                    : null;
                }, 'native detail visible for image', 10000);
                await captureShot('cross-image-detail');

                // 反向：从原生详情切回文档 → overlay 重新挂上并握手。
                const reverseStep = () => {
                  const currentIndex = rawIndexOf(scope.selected[0] && scope.selected[0].id);
                  const docIndex = rawIndexOf(item.id);
                  const docSiblingIndex = siblingId ? rawIndexOf(siblingId) : -1;
                  const targetIndex = [docIndex, docSiblingIndex].filter((v) => v >= 0)
                    .sort((a, b) => Math.abs(a - currentIndex) - Math.abs(b - currentIndex))[0];
                  const useNext = targetIndex > currentIndex;
                  if (useNext && typeof scope.selectNext === 'function') scope.selectNext();
                  else if (typeof scope.selectPrev === 'function') scope.selectPrev();
                };
                let rsteps = 0;
                while (!document.querySelector('#eagle-document-viewer-container') && rsteps < scope.raw.length + 2) {
                  reverseStep();
                  rsteps += 1;
                  await new Promise((resolve) => setTimeout(resolve, 250));
                }
                const revivedContainer = await waitFor(
                  () => {
                    const el = document.querySelector('#eagle-document-viewer-container');
                    return el && el.hasAttribute('data-viewer-ready') ? el : null;
                  },
                  'document overlay revived on document target', 12000
                );
                const revivedChrome = await waitFor(
                  () => document.querySelector('#eagle-detail-host .doc-chrome') ? true : null,
                  'document chrome restored on document target', 10000
                );
                reverseOk = Boolean(revivedContainer && revivedChrome);
                await captureShot('reverse-doc-reopened');
              }

              // ── 关闭：点顶栏返回键（F-DOC-4 起 = 原生退出详情，machineryLeaveDetailMode
              // 会同步卸载 overlay 回到网格）──
              const liveBackButton = toolbarHost.querySelector('#doc-chrome-back');
              if (!liveBackButton) {
                throw new Error('doc chrome back button missing at close step');
              }
              liveBackButton.click();
              await waitFor(() => !document.querySelector('#eagle-document-viewer-container'), 'viewer close', 8000);
              await waitFor(() => !document.body.classList.contains('is-detail-mode'), 'back to grid after close', 8000);
              // 关闭后原生网格工具栏必须回来（分支切回，而非残留文档控件）。
              const nativeRestored = await waitFor(() => {
                const host = document.getElementById('eagle-toolbar-host');
                if (!host) return null;
                if (host.querySelector('.doc-chrome')) return null;
                if (host.querySelector('input[type="search"]')) return true;
                return null;
              }, 'native toolbar restored', 8000);
              await captureShot('grid-restored');

              return {
                itemId: item.id,
                itemExt: item.ext,
                uiPathOpened,
                uiDetailActive,
                containerMounted: true,
                viewerUrl,
                contentOk,
                inIframeStageActions,
                exitOk,
                autoCollapsed,
                sidebarExpandedLeft,
                docAppMenuVisible,
                sidebarCollapsedLeft,
                iframeAppRegionCount,
                viewerClosed: !document.querySelector('#eagle-document-viewer-container'),
                docBackOk,
                docToggleOk,
                docAppMenuVisible,
                docBackBox,
                docBackRendered,
                docCounterText,
                docRoundBtnCount,
                docIconMetrics,
                docIconMin,
                docIconMax,
                prevBox,
                closeBox,
                navOk,
                navDirection,
                navCounterText,
                navCounterMoved,
                crossOk,
                crossNativeDetail,
                reverseOk,
                nativeLeftovers,
                nativeRestored,
              };
            })()`
          );
          const ok = result.uiPathOpened && result.uiDetailActive && result.containerMounted && result.contentOk && !result.inIframeStageActions && result.exitOk && result.autoCollapsed && result.sidebarExpandedLeft !== '0px' && result.sidebarCollapsedLeft === '0px' && result.iframeAppRegionCount === 0 && result.viewerClosed && result.docBackOk === true && /^\d+\s*\/\s*\d+$/.test(result.docCounterText || '') && result.docRoundBtnCount >= 6 && result.prevBox > result.closeBox && result.docBackBox >= 24 && result.docToggleOk === true && result.navOk === true && result.navCounterMoved === true && (result.crossOk === true || result.crossOk === null) && (result.crossNativeDetail === null || Boolean(result.crossNativeDetail)) && (result.reverseOk === true || result.reverseOk === null) && result.nativeLeftovers === 0 && result.nativeRestored === true;
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
              // b1-9bz-E5 收尾：此处原为 angular.element(document.body).scope() 取 scope 后调
              // openApplicationContextMenu()，并断言 DOM .context-menu.open。Angular 退役后该式恒
              // ReferenceError（冒烟整体中止）；且应用菜单是 Electron 原生 Menu.popup——不可被 CDP
              // 观察、触发会阻塞会话（menu-popup-closed-loop 用 __EAGLE_MENU_SMOKE + smoke:menu-popup
              // 捕获模板，已覆盖其打开与内容）。本冒烟的菜单面断言收敛为主侧 menuOk
              // （Menu.getApplicationMenu() 非空），不再做 DOM 菜单断言。
              await new Promise((resolve) => setTimeout(resolve, 150));
              return {
                thumbOk: typeof thumb === 'string' && thumb.startsWith('data:image/png'),
                listOk: list.length > 0,
                clipboardOk: typeof clip === 'string' && clip.startsWith('data:image/png'),
                windowApiOk: typeof win.minimize === 'function' && typeof win.maximize === 'function' && typeof win.close === 'function' && typeof win.isMaximized() === 'boolean',
                windowActionsOk,
              };
            })()`
          );
          console.log(result.thumbOk && result.listOk && result.clipboardOk && result.windowApiOk && result.windowActionsOk && menuOk && frameOk ? 'DESKTOP_SMOKE_OK' : `DESKTOP_SMOKE_FAIL ${JSON.stringify({ ...result, menuOk, frameOk })}`);
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
                // b1-9bz-E5-2：就绪探针改读显式驱动面 window.__eagleDriver（主窗 main.tsx 启动期安装，
                // 见 core/driverApi.ts）；raw/listDone 均在该面白名单内（store 后端），语义与原 scope 面一致。
                const bodyScope = window.__eagleDriver || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'main scope', 25000);
              // b1-9bz-E5-4：原以 Angular 指令元素 + isolateScope() 观测；指令退役后 React 组件
              // （ProgressDialogs.FileExportProgress/EaglepackExportProgress）经
              // window.__eagleExportScopes 暴露同名活引用（isExporting/curr/total、isArchiving/percent/progress/total
              // 语义与 isolateScope 一致——读写同一对象）。
              const exportScopes = window.__eagleExportScopes;
              if (!exportScopes || !exportScopes.file || !exportScopes.archive) throw new Error('Export progress scopes are missing');
              const fileScope = exportScopes.file;
              const archiveScope = exportScopes.archive;
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
                // b1-9bz-E5-2：就绪探针改读显式驱动面 window.__eagleDriver（主窗 main.tsx 启动期安装，
                // 见 core/driverApi.ts）；raw/listDone 均在该面白名单内（store 后端），语义与原 scope 面一致。
                const bodyScope = window.__eagleDriver || null;
                return bodyScope && Array.isArray(bodyScope.raw) && bodyScope.listDone ? bodyScope : null;
              }, 'main scope');
              const videoItem = scope.raw.find((item) => item && !item.isDeleted && (item.ext === 'mp4' || item.ext === 'webm'));
              if (!videoItem) throw new Error('No video item in current library');
              // F-VP-1（2026-09-17）：先证明 video.js 引擎已在主窗接线。迁移后主窗只剩
              // video-js.css，window.videojs 恒为 undefined，而 useMediaElement 首次
              // loadedmetadata 即执行 videojs()(video, {...}).ready(...) —— 引擎缺席时该表达式
              // 抛 TypeError，中断同函数内的自动播放/控件条/字幕/批注/快捷手势/缩略图预览，
              // 表现为「视频素材点开无法播放」。仅断言 videoWidth>0 无法发现该缺陷（原生
              // <video> 无 videojs 也能解码），故在此显式取引擎真值。
              const videojsEngine = {
                type: typeof window.videojs,
                version: (window.videojs && window.videojs.VERSION) || null,
                hasGetComponent: Boolean(window.videojs && typeof window.videojs.getComponent === 'function'),
                scriptTags: Array.from(document.querySelectorAll('script[src]'))
                  .map((s) => s.getAttribute('src'))
                  .filter((src) => /videojs/i.test(String(src))),
              };
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
                      // F-VP-1：播放器 UI 真值 —— videojs 就绪后会把 <video> 包进
                      // .video-js 容器并渲染 .vjs-control-bar；引擎缺席时两者均为 0，
                      // 且 .video-js 会停留在 NativeVideoBranch 里那个静态类名上
                      // （未被 videojs 接管，无 vjs-tech / 无控件条）。
                      vjsControlBar: document.querySelectorAll('.detail-wrap .vjs-control-bar').length,
                      vjsTech: document.querySelectorAll('.detail-wrap video.vjs-tech').length,
                      playerElClass: (element.closest('.video-js') || element).className,
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
                  vjsControlBar: document.querySelectorAll('.detail-wrap .vjs-control-bar').length,
                  vjsTech: document.querySelectorAll('.detail-wrap video.vjs-tech').length,
                };
              });
              // F-VP-1：控件条是「videojs 成功接管播放器」的可观察结果。它与 player 的
              // 就绪状态解耦（videojs 的 ready 回调晚于 loadedmetadata），故独立等待。
              const controlBar = await waitFor(() => {
                const bars = document.querySelectorAll('.detail-wrap .vjs-control-bar').length;
                const tech = document.querySelectorAll('.detail-wrap video.vjs-tech').length;
                return bars > 0 && tech > 0 ? { controlBars: bars, techEls: tech } : null;
              }, 'videojs control bar', 15000).catch(() => ({
                controlBars: document.querySelectorAll('.detail-wrap .vjs-control-bar').length,
                techEls: document.querySelectorAll('.detail-wrap video.vjs-tech').length,
                missing: true,
              }));
              // F-VP-1b：控件条「挂上」不等于「可用」。取证按钮数量/可见性与 player 内部状态，
              // 以便区分「控制条 DOM 缺席」与「控制条在场但被隐藏/按钮未装配」两类症状。
              const controlBarDetail = (() => {
                const host = document.querySelector('.detail-wrap') || document;
                const bar = host.querySelector('.vjs-control-bar');
                const videoJsEl = host.querySelector('.video-js');
                const player = videoJsEl && videoJsEl.player;
                const buttons = bar ? bar.querySelectorAll('.vjs-button') : [];
                const rect = bar ? bar.getBoundingClientRect() : null;
                const cs = bar ? getComputedStyle(bar) : null;
                return {
                  hasBar: Boolean(bar),
                  buttonCount: buttons.length,
                  buttonClasses: Array.from(buttons).map((b) => b.className).slice(0, 24),
                  rect: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
                  display: cs ? cs.display : null,
                  visibility: cs ? cs.visibility : null,
                  // F-VP-1c：容器类名与宽度 —— is-video 缺席时 #detail-container 会停在
                  // width: 20000px（图片缩放虚拟画布），控件条随之溢出视口而不可见。
                  // 这两项是「控件条可见性」缺陷的直接指标，故升为常驻取证面。
                  detailContainerClass: (() => {
                    const el = document.getElementById('detail-container');
                    return el ? el.className : null;
                  })(),
                  detailContainerWidth: (() => {
                    const el = document.getElementById('detail-container');
                    return el ? Math.round(el.getBoundingClientRect().width) : null;
                  })(),
                  hasPlayerInstance: Boolean(player),
                  playerControls: player ? player.controls_ : null,
                  playerControlBarChildren: player && player.controlBar && player.controlBar.children_
                    ? player.controlBar.children_.length : null,
                  loopBtn: bar ? bar.querySelectorAll('.vjs-icon-loop').length : 0,
                  forwardBtn: bar ? bar.querySelectorAll('.vjs-icon-forward').length : 0,
                  backwardBtn: bar ? bar.querySelectorAll('.vjs-icon-backward').length : 0,
                  noteBtn: bar ? bar.querySelectorAll('.vjs-icon-note').length : 0,
                  contextMenuHost: String((document.querySelector('#eagle-context-menu-host') || {}).innerHTML || '').slice(0, 160),
                };
              })();
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
              // F-CTX-1（2026-09-17）：详情页右键菜单可达性取证。
              // useMouseGesture 的 effect 原先只依赖常量 selector，effect 只在挂载时跑一次，
              // 而那时 ref（{smoothZoomDone && <div ref/>} 条件渲染）尚为 null 便提前退出；
              // 进入详情后 effect 不再重跑，mousedown 处理器从未绑定 —— 右键链路整体不通，
              // 且绑定位于详情容器层、与素材类型无关（图像与视频表现一致）。
              // 探针必须等 gestureRef 宿主 div 与 .noSel 都就绪后再测，否则会把「尚未就绪」
              // 误判成「处理器未绑定」。
              const gestureRefReady = await waitFor(() => {
                const container = document.getElementById('detail-container');
                if (!container) return null;
                const noSelEl = document.querySelector('.noSel');
                return noSelEl ? { hasContainer: true, noSelIsContainer: noSelEl === container } : null;
              }, 'detail container and noSel', 15000).catch(() => ({ hasContainer: false, noSelIsContainer: false, missing: true }));
              let contextMenuProbe = null;
              try {
                const container = document.getElementById('detail-container');
                const host = document.querySelector('#eagle-context-menu-host');
                const snapshot = (tag) => ({
                  tag,
                  itemCount: host ? host.querySelectorAll('.context-menu-item').length : -1,
                  htmlLen: host ? host.innerHTML.length : -1,
                  rootClass: (() => {
                    const r = host && host.querySelector('.context-menu');
                    return r ? r.className : null;
                  })(),
                  // 与 rootClass 同一节点同一时刻取类名数组，避免正则/空白差异导致误判。
                  rootClassList: (() => {
                    const r = host && host.querySelector('.context-menu');
                    return r ? Array.from(r.classList) : null;
                  })(),
                });
                const before = snapshot('before');
                if (!container) {
                  contextMenuProbe = { missing: true, containerPresent: false, before };
                } else {
                  // F-CTX-1：右键真实落点在 #detail-container 的内层子树（.detail-wrap / video 等）。
                  // .noSel 就是 #detail-container 自己（smoothZoom setContainer 施加的类），
                  // 在其上派发无法验证冒泡链路，故改用内层元素作为命中点。
                  const inner = container.querySelector('.detail-wrap')
                    || container.querySelector('.image-wrap')
                    || container.querySelector('video')
                    || container;
                  const rect = inner.getBoundingClientRect();
                  const cx = Math.round(rect.x + rect.width / 2);
                  const cy = Math.round(rect.y + rect.height / 2);
                  const mk = (type) => new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 2,
                    buttons: type === 'mousedown' ? 2 : 0,
                    clientX: cx,
                    clientY: cy,
                    pageX: cx,
                    pageY: cy,
                  });
                  const down = mk('mousedown');
                  inner.dispatchEvent(down);
                  const mousedownDefaultPrevented = down.defaultPrevented;
                  await new Promise((resolve) => setTimeout(resolve, 120));
                  window.dispatchEvent(mk('mouseup'));
                  await new Promise((resolve) => setTimeout(resolve, 700));
                  const after = snapshot('after');
                  // menuOpen 取同一快照内同一节点的 classList，避免正则/空白/时序漂移。
                  const opened = Array.isArray(after.rootClassList)
                    ? after.rootClassList.indexOf('open') >= 0
                    : /\bopen\b/.test(String(after.rootClass || ''));
                  contextMenuProbe = {
                    containerPresent: true,
                    containerClass: String(container.className || ''),
                    hitTargetClass: String(inner.className || '') || inner.tagName.toLowerCase(),
                    mousedownDefaultPrevented,
                    handlerBound: mousedownDefaultPrevented,
                    menuOpen: opened,
                    before,
                    after,
                    itemCount: after.itemCount,
                  };
                }
              } catch (err) {
                contextMenuProbe = { error: String((err && err.message) || err) };
              }
              return {
                videoItemId: videoItem.id,
                videoExt: videoItem.ext,
                detailMode: Boolean(scope.isDetailMode),
                videojsEngine,
                controlBar,
                controlBarDetail,
                gestureRefReady,
                contextMenuProbe,
                player,
                interaction,
              };
            })()`
          );
          const engineOk = result.videojsEngine
            && result.videojsEngine.type === 'function'
            && result.videojsEngine.hasGetComponent === true
            && Array.isArray(result.videojsEngine.scriptTags)
            && result.videojsEngine.scriptTags.some((src) => /vendors\/videojs\/video\.js/.test(String(src)));
          const controlBarOk = result.controlBar
            && !result.controlBar.missing
            && result.controlBar.controlBars > 0
            && result.controlBar.techEls > 0;
          // F-CTX-1：右键处理器必须真的绑上（mousedownDefaultPrevented），且菜单必须展开并渲染出条目。
          const contextMenuOk = result.contextMenuProbe
            && result.contextMenuProbe.containerPresent === true
            && result.contextMenuProbe.handlerBound === true
            && result.contextMenuProbe.menuOpen === true
            && result.contextMenuProbe.itemCount > 0;
          const ok = result.detailMode
            && engineOk
            && controlBarOk
            && contextMenuOk
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
    // b1-9am 修正：探针在产生任何剪贴板内容前执行（探针 writeText 具破坏性，结果缓存）
    const __pdCbHealthy = clipboardHealthy();
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
        const clipboardPathOk = __pdCbHealthy && result.clipboardTextAfterCopyPath === firstInfo.originalReal;
        const clipboardImageOk = __pdCbHealthy && !clipboard.readImage().isEmpty();
        const clipboardSkipped = !__pdCbHealthy;
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
          && (clipboardSkipped || clipboardPathOk)
          && (clipboardSkipped || clipboardImageOk)
          && shellOk
          && viewerOk
          && negativeOk
          && renamedResult.name === 'Preview Renamed PNG'
          && decodeURIComponent(renamedResult.rawPath).endsWith('Preview Renamed PNG.png')
          && renamedResult.imageLoaded
          && trashRejected
          && missingRejected;
        console.log(ok ? `PREVIEW_DELIVERY_SMOKE_OK ${JSON.stringify({ ...result, clipboardPathOk, clipboardImageOk, clipboardSkipped, viewerOk, negativeOk, trashRejected, missingRejected, renamedResult, shellCalls })}` : `PREVIEW_DELIVERY_SMOKE_FAIL ${JSON.stringify({ ...result, clipboardPathOk, clipboardImageOk, shellOk, viewerOk, negativeOk, trashRejected, missingRejected, renamedResult, shellCalls })}`);
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
    // b1-9am 修正：探针先于任何剪贴板内容产生（结果缓存）
    clipboardHealthy();
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

          // 6) copy-thumbnails：CF_HDROP 剪贴板回读非空（OS 剪贴板楔死时跳过并标记）
          if (clipboardHealthy()) {
            await sendFromRenderer('copy-thumbnails', [item]);
            let clipOk = false;
            for (let i = 0; i < 60 && !clipOk; i++) {
              await sleep(150);
              clipOk = (clipboard.read('CF_HDROP') || Buffer.alloc(0)).length > 0;
            }
            results.copyThumbnails = clipOk;
          } else {
            results.copyThumbnails = 'skipped-clipboard-wedged';
          }

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
  // P1-c-2 验证①/②：写路径替身烟测（--smoke-write-path）与真实持久化烟测（--smoke-persistence）。
  // 驱动脚本 electron/smoke/*-driver.js 在真实页面上下文执行；断言在测试侧进行。
  if (writePathSmokeMode || persistenceSmokeMode) {
    const isWrite = writePathSmokeMode;
    const timeout = setTimeout(() => {
      console.error(isWrite ? 'WRITE_PATH_SMOKE_TIMEOUT' : 'PERSIST_SMOKE_TIMEOUT');
      app.quit();
    }, 180000);
    createWindow({
      show: false,
      onDidFinishLoad: async (win) => {
        try {
          const driverFile = isWrite ? 'write-path-driver.js' : 'persistence-driver.js';
          let driverSource = fs.readFileSync(path.join(__dirname, 'smoke', driverFile), 'utf8');
          if (!isWrite) {
            // 渲染层 process 是 shims mock（无 env）——由主进程把实参注入页面。
            const persistEnv = {
              phase: process.env.EAGLE_PERSISTENCE_PHASE || 'edit',
              folderId: process.env.EAGLE_PERSISTENCE_FOLDER_ID || '',
              expectedIds: (process.env.EAGLE_PERSISTENCE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
            };
            driverSource = `window.__persistEnv = ${JSON.stringify(persistEnv)};\n` + driverSource;
          }
          const report = await win.webContents.executeJavaScript(driverSource);
          if (isWrite) {
            const requests = fs.existsSync(path.join(writePathStubDir, 'requests.jsonl'))
              ? fs.readFileSync(path.join(writePathStubDir, 'requests.jsonl'), 'utf8')
                .split('\n').filter(Boolean)
                .map((line) => { try { return JSON.parse(line); } catch (err) { return { bad: line }; } })
              : [];
            console.log(`WRITE_PATH_SMOKE_DONE ${JSON.stringify({ report, requests })}`);
          } else {
            console.log(`PERSIST_SMOKE_DONE ${JSON.stringify(report)}`);
          }
        } catch (err) {
          console.error(isWrite ? `WRITE_PATH_SMOKE_ERROR ${err.stack || err.message}` : `PERSIST_SMOKE_ERROR ${err.stack || err.message}`);
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
      // R7：与 apiBase（第 9 行，EAGLE_API_URL 可覆盖）保持一致——此前硬编码 41695，
      // 一旦 EAGLE_API_PORT/EAGLE_API_URL 换端口，插件窗会指向死地址
      // （screenshot-regression 的 plugin 断言在隔离栈恒红即此因）。
      url: `${apiBase}/plugins/eagle-reverse-example-service/index.html`,
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
  if (windowBoundsSmokeMode) {
    // R0-4：把真实落盘几何喂给 createWindow（此时 userData 已被测试指向临时目录），
    // 再把「最终 bounds + 全部显示器工作区」原样吐出，由测试侧判定可见性。
    const savedBefore = loadWindowState();
    const win = createWindow({ show: false });
    const payload = {
      saved: savedBefore,
      bounds: win.getBounds(),
      displays: screen.getAllDisplays().map((display) => display.workArea),
      minVisiblePx: 80,
    };
    console.log(`WINDOW_BOUNDS_SMOKE ${JSON.stringify(payload)}`);
    app.quit();
    return;
  }
  createWindow({ show: !smokeMode, persistState: true });
  setupTray();
  if (smokeMode) {
    setTimeout(() => app.quit(), 1500);
    return;
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow({ persistState: true });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
