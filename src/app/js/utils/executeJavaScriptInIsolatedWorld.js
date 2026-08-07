const path = require('path');
const { BrowserWindow } = remote;
const { ipcRenderer } = require('electron');
const appRoot = require('app-root-path');

module.exports = async ({
	src, dest, startAt, filePath, item, showDevTools, plugin, extraModule
}) => {
	return new Promise((resolve, reject) => {
        let win;
        let isCallback = false;
        let finish = function (err, data) {
            if (isCallback) return;
			if (!err && data) {
				resolve(data);
			}
			else {
            	reject(err);
			}
            isCallback = true;
            if (win && !win.isDestroyed()) {
                win.close();
            }
        };
        try {
            win = new BrowserWindow({
				title: plugin?.manifest?.name ?? 'Debugger Window',
                show: !!showDevTools,
                focusable: !!showDevTools,
                width: 1440,
                height: 900,
                frame: true,
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
					devTools: !!showDevTools
                }
            });
			if (showDevTools) {
				win.on('ready-to-show', () => {
					win.webContents.openDevTools({mode: 'detach'});
				});
			}

			const ready = async () => {
				return new Promise((resolve, reject) => {
					win.webContents.on('dom-ready', () => {
						if (!showDevTools) return resolve();
						win.webContents.once('devtools-opened', () => {
							return resolve();
						});
					});
				});
			}

			ready().then(() => {
				let loadEvent = `event-${Date.now()}`;
				ipcRenderer.once(loadEvent, (e, data) => {
					finish(data.err, data.item);
				});

				let passOptions = `start-${Date.now()}`;
				
				win.webContents.setAudioMuted(true);
				win.webContents.executeJavaScript(`

					const fun = require('${filePath.replaceAll("\\","\\\\").replaceAll(/'/g, "\\'")}');

					$$electronIpc.on('${passOptions}', (e, options) => {
						console.log(options);
						fun({
							src: options.src, 
							dest: options.dest,
							item: options.item,
							plugin: options.plugin,
							startAt: options.startAt,
							extraModule: options.extraModule

						}).then((item) => {
							$$electronIpc.sendTo(${currentWindow.webContents.id}, '${loadEvent}', {
								err: false,
								item: item
							});
						})
						.catch((err) => {
							$$electronIpc.sendTo(${currentWindow.webContents.id}, '${loadEvent}', {
								err: err
							});
						});
					});
				`);

				win.webContents.send(passOptions, {
					src: src,
					dest: dest,
					item: item,
					startAt: startAt,
					plugin: plugin,
					extraModule: extraModule
				});				
			});
			win.loadURL(URL_MODULE.pathToFileURL(`${appRoot}/app/thumbnail.html`).href);
        }
        catch (err) {
            ipcRenderer.send('electron-log', err.stack || err);
        }
    });
}