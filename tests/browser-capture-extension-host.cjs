const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');

const extensionPath = process.env.EAGLE_EXTENSION_PATH || path.join(__dirname, '..', 'frontend', 'public', 'browser-extension');
const fixtureUrl = process.env.EAGLE_FIXTURE_URL || 'about:blank';
if (process.env.EAGLE_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.EAGLE_DEBUG_PORT);
}
if (process.env.EAGLE_ELECTRON_USER_DATA_DIR) {
  app.setPath('userData', process.env.EAGLE_ELECTRON_USER_DATA_DIR);
}

app.whenReady().then(async () => {
  try {
    const extension = await session.defaultSession.loadExtension(extensionPath);
    console.log(`EXTENSION_LOADED ${extension.id}`);
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    win.webContents.on('did-finish-load', () => {
      console.log('FIXTURE_READY');
    });
    await win.loadURL(fixtureUrl);
  } catch (err) {
    console.error(`EXTENSION_HOST_ERROR ${err.stack || err.message}`);
    app.exit(1);
  }
});
