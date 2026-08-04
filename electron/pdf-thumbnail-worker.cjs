const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

function send(message) {
  if (process.send) process.send(message);
}

function assertPath(value, label) {
  if (!value || typeof value !== 'string' || value.includes('\0') || !path.isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`);
  }
  return path.resolve(value);
}

async function render(options) {
  const source = assertPath(options.source, 'source');
  const output = assertPath(options.output, 'output');
  const maxSize = Math.max(1, Math.min(Number(options.maxSize) || 480, 4096));
  const maxImagePixels = Math.max(1, Math.min(Number(options.maxImagePixels) || 30_000_000, 100_000_000));
  const sourceStat = fs.statSync(source);
  if (!sourceStat.isFile()) throw new Error('PDF source must be a regular file');

  const workerFile = path.join(__dirname, 'pdf-thumbnail-worker.html');
  const reverseRoot = path.resolve(__dirname, '../..');
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== new URL(`file:///${workerFile.replace(/\\/g, '/')}`).href) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      if (details.url === 'about:blank') allowed = true;
      else {
        const requestPath = decodeURIComponent(new URL(details.url).pathname).replace(/^\/(?:[A-Za-z]:)/, (drive) => drive.slice(1));
        const resolved = path.resolve(requestPath);
        allowed = resolved === workerFile || resolved === source || resolved.startsWith(reverseRoot + path.sep);
      }
    } catch (err) {
      allowed = false;
    }
    callback({ cancel: !allowed });
  });

  try {
    await window.loadFile(workerFile);
    const result = await window.webContents.executeJavaScript(
      `window.renderPdfThumbnail(${JSON.stringify(new URL(`file:///${source.replace(/\\/g, '/')}`).href)}, ${maxSize}, ${maxImagePixels})`,
      true
    );
    const match = /^data:image\/png;base64,(.+)$/s.exec(String(result.dataUrl || ''));
    if (!match) throw new Error('PDF renderer returned an invalid image');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, Buffer.from(match[1], 'base64'));
    return { width: result.width, height: result.height, pages: result.pages };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

app.whenReady().then(async () => {
  try {
    const result = await render(JSON.parse(process.env.EAGLE_PDF_THUMBNAIL_OPTIONS || '{}'));
    send({ ok: true, result });
    console.log(JSON.stringify({ ok: true, result }));
    app.exit(0);
  } catch (err) {
    const error = { ok: false, error: err.message, stack: err.stack };
    send(error);
    console.error(JSON.stringify(error));
    app.exit(1);
  }
});

app.on('window-all-closed', () => {});
