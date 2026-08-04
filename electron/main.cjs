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
const windowStateFile = () => path.join(app.getPath('userData'), 'window-state.json');
const allowedRoots = new Set([mockLibraryRoot, path.resolve(__dirname, '..', '..')]);
const exportJobs = new Map();

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

async function notifyLibraryLoaded(library) {
  allowRoot(library.rootDir || library.path);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
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
  const images = Array.isArray(params.images) ? params.images : [];
  const total = images.length || (params.folder && Array.isArray(params.folder.images) ? params.folder.images.length : 0);
  const job = { cancelled: false };
  exportJobs.set(jobId, job);
  event.sender.send('show-export-task', total);
  try {
    const current = await apiRequest('/api/library/current');
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
    return { jobId, ...result };
  } catch (err) {
    event.sender.send('close-export-task');
    event.sender.send('export:error', { jobId, error: err.message, cancelled: err.name === 'ExportCancelledError' });
    throw err;
  } finally {
    exportJobs.delete(jobId);
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

function createWindow(options = {}) {
  const saved = loadWindowState();
  const url = options.url || previewUrl;
  const win = new BrowserWindow({
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
    },
  });

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

  ipcMain.handle('item:importPaths', async (event, paths = []) => {
    const list = Array.isArray(paths) ? paths : [paths];
    return apiRequest('/api/item/addFromPaths', {
      method: 'POST',
      body: { images: list.map((sourcePath) => ({ path: sourcePath })) },
    });
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
        break;
      }
        if (job.status === 'error') throw new Error(job.error || job.message);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }
    return results;
  });

  ipcMain.handle('item:import-url', (event, params = {}) => apiRequest('/api/item/addFromURL', {
    method: 'POST',
    body: params,
  }));

  ipcMain.handle('item:import-urls', (event, params = {}) => apiRequest('/api/item/addFromURLs', {
    method: 'POST',
    body: { images: Array.isArray(params) ? params : params.images || params.urls || [] },
  }));

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
  ipcMain.on('show-item-in-folder', (event, target) => {
    if (target) shell.showItemInFolder(path.resolve(target));
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

if (smokeMode || pluginSmokeMode || desktopSmokeMode || librarySmokeMode) {
  app.setPath('userData', path.join(os.tmpdir(), `eagle-reverse-smoke-${process.pid}`));
}

app.whenReady().then(async () => {
  registerIpc();
  setupMenu();
  await loadServicePlugins();
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
