const path = require('path');
const { BrowserWindow } = remote;
const { ipcRenderer } = require('electron');

module.exports = async (url) => {
	return new Promise((resolve, reject) => {
        let win;
        let isCallback = false;
        let finish = function (data) {
            if (isCallback) return;
            resolve(data || {});
            isCallback = true;
            if (win && !win.isDestroyed()) {
                win.close();
            }
        };
        try {
            win = new BrowserWindow({
                show: false,
                // opacity: 0,
                focusable: false,
                width: 1440,
                height: 900,
                frame: false,
                // useContentSize: false,
                enableLargerThanScreen: true,
                autoHideMenuBar: true,
                skipTaskbar: true,
                backgroundColor: "#ffffff",
                webPreferences: {
                    backgroundThrottling: false,
                    zoomFactor: 1,
                    preload: path.join(appPath, 'web-capture-preload.js'),
                    webSecurity: false,
                    nodeIntegration: true,
                    contextIsolation: false,
                }
            });
            // win.webContents.openDevTools({mode: 'detach'});
            win.loadURL(url);
            win.webContents.setAudioMuted(true);
            win.webContents.on('dom-ready', function() {
				setTimeout(() => {
					win.webContents.insertCSS('html, body { overflow: hidden; }');
					try {
						win.webContents.capturePage().then(function (image) {
							try {
								let base64 = image.toDataURL();
								finish({
									base64: base64,
									title: win.webContents.getTitle()
								});
							}
							catch (err) {
								finish();
							}
						}, function (err) {
							finish();
						})
					}
					catch (err) {
						finish();
					}
				}, 1000);
            });
        }
        catch (err) {
            ipcRenderer.send('electron-log', err.stack || err);
        }
    });
}