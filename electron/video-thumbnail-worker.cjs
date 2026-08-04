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

function fileUrl(filePath) {
  return new URL(`file:///${filePath.replace(/\\/g, '/')}`).href;
}

async function render(options) {
  const source = assertPath(options.source, 'source');
  const output = assertPath(options.output, 'output');
  const maxSize = Math.max(1, Math.min(Number(options.maxSize) || 480, 4096));
  const maxImagePixels = Math.max(1, Math.min(Number(options.maxImagePixels) || 30_000_000, 100_000_000));
  const startAt = options.startAt === undefined || options.startAt === null || options.startAt === ''
    ? null
    : Number(options.startAt);
  if (startAt !== null && (!Number.isFinite(startAt) || startAt < 0)) {
    const error = new Error('Video thumbnail startAt must be a non-negative number');
    error.code = 'VIDEO_START_AT_INVALID';
    throw error;
  }
  const sourceStat = fs.statSync(source);
  if (!sourceStat.isFile()) throw new Error('Video source must be a regular file');

  const workerFile = path.join(__dirname, 'video-thumbnail-worker.html');
  const window = new BrowserWindow({
    show: false,
    width: maxSize,
    height: maxSize,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== fileUrl(workerFile)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    let allowed = details.url === 'about:blank';
    try {
      if (!allowed && new URL(details.url).protocol === 'file:') {
        const requestPath = decodeURIComponent(new URL(details.url).pathname).replace(/^\/(?:[A-Za-z]:)/, (drive) => drive.slice(1));
        const resolved = path.resolve(requestPath);
        allowed = resolved === workerFile || resolved === source;
      }
    } catch (err) {
      allowed = false;
    }
    callback({ cancel: !allowed });
  });

  try {
    await window.loadFile(workerFile);
    const execution = await window.webContents.executeJavaScript(
      `window.renderVideoThumbnail(${JSON.stringify(fileUrl(source))}, ${maxSize}, ${maxImagePixels}, ${JSON.stringify(startAt)})`
        + `.then((result) => ({ ok: true, result }))`
        + `.catch((error) => ({ ok: false, error: error.message, code: error.code }))`,
      true
    );
    if (!execution?.ok) {
      const error = new Error(execution?.error || 'Video renderer failed');
      error.code = execution?.code || 'VIDEO_RENDER_FAILED';
      throw error;
    }
    const result = execution.result;
    const match = /^data:image\/png;base64,(.+)$/s.exec(String(result.dataUrl || ''));
    if (!match) {
      const error = new Error('Video renderer returned an invalid image');
      error.code = 'VIDEO_FRAME_CAPTURE_FAILED';
      throw error;
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, Buffer.from(match[1], 'base64'));
    return {
      width: result.width,
      height: result.height,
      duration: result.duration,
      startAt: result.startAt,
      thumbnailWidth: result.thumbnailWidth,
      thumbnailHeight: result.thumbnailHeight,
    };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

app.whenReady().then(async () => {
  try {
    const result = await render(JSON.parse(process.env.EAGLE_VIDEO_THUMBNAIL_OPTIONS || '{}'));
    send({ ok: true, result });
    console.log(JSON.stringify({ ok: true, result }));
    app.exit(0);
  } catch (err) {
    const error = { ok: false, error: err.message, code: err.code || 'VIDEO_RENDER_FAILED', stack: err.stack };
    send(error);
    console.error(JSON.stringify(error));
    app.exit(1);
  }
});

app.on('window-all-closed', () => {});
