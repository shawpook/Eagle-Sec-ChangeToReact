const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, shell, Tray } = require('electron');

const previewUrl = process.env.EAGLE_PREVIEW_URL || 'http://localhost:5176/src/app/index.html';
const mockLibraryRoot = path.resolve(__dirname, '../frontend/public/mock-library/Eagle Reverse Demo.library');
const smokeMode = process.argv.includes('--smoke');
const pluginSmokeMode = process.argv.includes('--smoke-plugin');
const desktopSmokeMode = process.argv.includes('--smoke-desktop');
const windowStateFile = () => path.join(app.getPath('userData'), 'window-state.json');
const allowedRoots = [mockLibraryRoot, path.resolve(__dirname, '..', '..')];

function safeResolve(target) {
  const resolved = path.resolve(target);
  const inside = allowedRoots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
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
  const win = new BrowserWindow({
    width: options.width || saved.width || 1280,
    height: options.height || saved.height || 800,
    x: options.x || saved.x,
    y: options.y || saved.y,
    minWidth: options.minWidth || 960,
    minHeight: options.minHeight || 600,
    autoHideMenuBar: true,
    show: options.show !== false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  win.loadURL(options.url || previewUrl);
  if (saved.maximized) win.maximize();
  win.on('resize', () => saveWindowState(win));
  win.on('move', () => saveWindowState(win));
  win.on('close', () => saveWindowState(win));
  return win;
}

function registerIpc() {
  ipcMain.handle('app:get-info', () => ({
    name: 'Eagle Reverse',
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
  }));

  ipcMain.handle('library:get-current', () => ({
    path: mockLibraryRoot,
    name: 'Eagle Reverse Demo',
    imagesDir: path.join(mockLibraryRoot, 'images/'),
  }));

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
    createWindow({ url, width: payload.width || 1100, height: payload.height || 760 });
    return true;
  });

  ipcMain.handle('plugin:open', (event, payload = {}) => {
    const url = payload.url;
    if (!url) return false;
    createWindow({ url, width: payload.width || 640, height: payload.height || 480 });
    return true;
  });

  ipcMain.handle('dialog:openFile', async (event, options = {}) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], ...options });
    return result;
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

  ipcMain.handle('clipboard:readImage', () => clipboard.readImage().toDataURL());

  ipcMain.handle('item:importPaths', async (event, paths = []) => {
    const list = Array.isArray(paths) ? paths : [paths];
    const res = await fetch('http://localhost:41695/api/item/addFromPaths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: list }),
    });
    return res.json();
  });
}

function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Library', click: () => dialog.showOpenDialog({ properties: ['openDirectory'] }) },
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
  if (smokeMode || pluginSmokeMode || desktopSmokeMode) return null;
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

app.whenReady().then(async () => {
  registerIpc();
  setupMenu();
  await loadServicePlugins();
  if (desktopSmokeMode) {
    const menuOk = Menu.getApplicationMenu() !== null;
    const desktopWin = createWindow({ show: false });
    const sourceFile = path.join(mockLibraryRoot, 'images', 'MOCK0001.info', 'Welcome Library.png');
    const timeout = setTimeout(() => {
      console.error('DESKTOP_SMOKE_TIMEOUT');
      app.quit();
    }, 6000);
    desktopWin.webContents.on('did-finish-load', async () => {
      try {
        const result = await desktopWin.webContents.executeJavaScript(
          `(async () => {
            const thumb = await window.eagleDesktop.nativeThumbnail(${JSON.stringify(sourceFile)});
            const list = await window.eagleDesktop.listDirectory(${JSON.stringify(mockLibraryRoot)});
            const clip = await window.eagleDesktop.clipboardImage();
            return { thumbOk: typeof thumb === 'string' && thumb.startsWith('data:image/png'), listOk: list.length > 0, clipboardOk: typeof clip === 'string' && clip.startsWith('data:image/png') };
          })()`
        );
        console.log(result.thumbOk && result.listOk && result.clipboardOk && menuOk ? 'DESKTOP_SMOKE_OK' : `DESKTOP_SMOKE_FAIL ${JSON.stringify({ ...result, menuOk })}`);
      } catch (err) {
        console.error(`DESKTOP_SMOKE_ERROR ${err.message}`);
      }
      clearTimeout(timeout);
      app.quit();
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
