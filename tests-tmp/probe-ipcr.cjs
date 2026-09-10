const { app, BrowserWindow } = require('electron');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  await w.loadURL('data:text/html,<html><body>hi</body></html>');
  const r = await w.webContents.executeJavaScript(
    'JSON.stringify([typeof window.ipcRenderer, typeof window.require, typeof window.global, typeof window.process])'
  );
  console.log('IPCR_PROBE ' + r);
  app.quit();
});
