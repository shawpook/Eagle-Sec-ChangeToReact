const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadURL('about:blank');
  setTimeout(() => {
    console.log('ELECTRON_SMOKE_OK');
    app.quit();
  }, 1200);
});

app.on('window-all-closed', () => {
  app.quit();
});
