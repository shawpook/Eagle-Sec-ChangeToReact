const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

function send(message) {
  if (process.send) process.send(message);
}

app.whenReady().then(async () => {
  let window;
  try {
    const output = path.resolve(process.env.EAGLE_VIDEO_FIXTURE_OUTPUT || '');
    const workerFile = path.join(__dirname, 'video-fixture-worker.html');
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    await window.loadFile(workerFile);
    const dataUrl = await window.webContents.executeJavaScript('window.createVideoFixture()', true);
    const match = /^data:video\/webm(?:;[^,]*)?;base64,(.+)$/s.exec(String(dataUrl || ''));
    if (!match) throw new Error('Fixture renderer returned invalid WebM data');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, Buffer.from(match[1], 'base64'));
    send({ ok: true, output });
    app.exit(0);
  } catch (err) {
    send({ ok: false, error: err.message });
    app.exit(1);
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
  }
});

app.on('window-all-closed', () => {});
