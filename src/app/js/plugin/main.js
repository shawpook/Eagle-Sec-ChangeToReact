const appRoot = require('app-root-path');
const electron = require('electron');
const { dialog, shell, ipcMain, app, BrowserWindow, nativeImage, Notification, Menu, MenuItem } = electron;
const path = require('path');
const URL_MODULE = require(appRoot + '/my_modules/url');
const ignoreMenuShortcuts = require(appRoot.path + '/app/js/utils/ignoreMenuShortcuts.js');

module.exports = {
	init: init,
};

function init ( { mainWindow, pjson } ) {
	ipcMain.handle('plugin.window.setReferer', async (event, referer) => {
		const bw = BrowserWindow.fromWebContents(event.sender);
		if (referer && bw) {
			require('electron-referer')(referer, bw);
		}
		return undefined;
	});
	ipcMain.handle('plugin.window.', async (event, params) => {
		let bw = BrowserWindow.fromWebContents(event.sender);
		let { method, value, value2 } = params;
		if (bw && bw[method]) { return bw[method](value, value2); }
		return undefined;
	});
	ipcMain.handle('plugin.window.webContents.', async (event, params) => {
		let bw = BrowserWindow.fromWebContents(event.sender);
		let { method, value, value2 } = params;
		let webContents = (method === 'capturePage') ? event.sender : bw?.webContents;
		if (webContents && webContents[method]) { return webContents[method](value, value2); }
		return undefined;
	});
	ipcMain.handle('shell.', async (event, params) => {
		let { method, value, value2 } = params;
		if (shell[method]) { return shell[method](value, value2); }
		return undefined;
	});
	ipcMain.handle('screen.', async (event, params) => {
		let { method, value, value2 } = params;
		if (electron.screen[method]) { return electron.screen[method](value, value2); }
		return undefined;
	});
	ipcMain.handle('dialog.', async (event, params) => {
		let bw = BrowserWindow.fromWebContents(event.sender);
		let { method, value, value2 } = params;
		if (bw && dialog[method]) { 
			if (method === 'showErrorBox') {
				return await dialog[method](value, value2); 
			}
			else {
				return dialog[method](bw, value, value2); 
			}
		}
		return undefined;
	});

	const extraModule = require(appRoot + '/app/js/plugin/extra-module.js');
	ipcMain.handle('plugin.extraModule.ffmpeg.', async (event, params) => {
		const ffmpeg = extraModule.ffmpeg;
		let { method, value, value2 } = params;
		if (ffmpeg) {
			return ffmpeg[method]({
				currentWindow: mainWindow
			});
		}
		return undefined;
	});

	ipcMain.handle('plugin.extraModule.ai.', async (event, params) => {
		const ai = extraModule.ai;
		let { method, value, value2 } = params;
		if (ai) {
			return ai[method]({
				currentWindow: mainWindow
			});
		}
		return undefined;
	});

	ipcMain.handle('plugin.startDrag', async (event, { paths }) => {
		console.log(paths)
		const icon = nativeImage.createFromPath(appRoot + "/drag-dummy.png");
		console.log(event.sender.startDrag)
        event.sender.startDrag({
            files: paths,
            icon: icon,
        });
        return;
	});

	ipcMain.handle('create-plugin-window', async (event, { plugin, args = {} }) => {

		function getVibrancy () {
			if (process.platform != 'darwin') return undefined;
			const vibrancyMap = {
				"LIGHT": 'light',
				"LIGHTGRAY": 'light',
				"DARK": 'dark',
				"GRAY": 'dark',
				"PURPLE": 'dark',
				"BLUE": 'dark',
			};
			const vibrancy = vibrancyMap[preferences?.theme?.name] || "dark";
			return vibrancy;
		}

	    let manifest = plugin.manifest;
	    let parent = (manifest?.main?.childWindow === true) ? mainWindow : undefined;
		let { show, opacity, width, height, minWidth, minHeight, maxWidth, maxHeight, resizable, minimizable, maximizable, fullscreenable, alwaysOnTop, frame, titleBarStyle, backgroundColor, vibrancy } = manifest.main;
		const isFollowCursor = manifest?.main?.followCursor === true;
	    let url = manifest.main.url;
		let protocolUrl = `eagleplugin://${plugin.manifest.id}/`
		let showDevTools = plugin.manifest?.devTools === true;
		const isServiceMode = manifest?.main?.serviceMode;
		const themeColors = {
			"GRAY": "#303134",
			"DARK": "#1F2023",
			"BLUE": "#262937",
			"PURPLE": "#343141",
			"LIGHT": "#f3f4f6",
			"LIGHTGRAY": "#e3e4e6"
		};
		const bgColor = themeColors[preferences?.theme?.name] || "#303134"

		const windowStateKeeper = require(appRoot + '/my_modules/electron-window-state');
		const windowState = windowStateKeeper({
			defaultWidth: width ?? minWidth ?? 640,
			defaultHeight: height ?? minHeight ?? 480,
			fullScreen: false,
			maximize: false,
			file: 'window-state.json',
    		path: `${app.getPath('userData')}/Plugins/${plugin.manifest.id}`,
		});
		
		// followCursor：在游標附近彈出視窗
		let windowX = windowState.x;
		let windowY = windowState.y;

		if (isFollowCursor) {
			const EDGE_PADDING = 20;
			const CURSOR_OFFSET = 8;
			const cursorPoint = electron.screen.getCursorScreenPoint();
			const display = electron.screen.getDisplayNearestPoint(cursorPoint);
			const { workArea } = display;

			const winWidth = windowState?.width ?? width ?? 640;
			const winHeight = windowState?.height ?? height ?? 480;

			const safeRight = workArea.x + workArea.width - EDGE_PADDING;
			const safeBottom = workArea.y + workArea.height - EDGE_PADDING;

			// 水平：優先右側，空間不足才翻到左側
			windowX = cursorPoint.x + CURSOR_OFFSET;
			if (windowX + winWidth > safeRight) {
				windowX = cursorPoint.x - winWidth - CURSOR_OFFSET;
			}

			// 垂直：與游標平行，超出時微調上移
			windowY = cursorPoint.y;
			if (windowY + winHeight > safeBottom) {
				windowY = safeBottom - winHeight;
			}

			// 確保不超出左/上邊界
			windowX = Math.max(windowX, workArea.x + EDGE_PADDING);
			windowY = Math.max(windowY, workArea.y + EDGE_PADDING);
		}

		let windowOptions = {
	        // titleBarStyle: titleBarStyle,
			'x': windowX,
            'y': windowY,
            'width': windowState?.width ?? width ?? 640,
            'height': windowState?.height ?? height ?? 480,
	        title: manifest.name,
	        icon: path.normalize(`${plugin.path}/${manifest.logo}`),
	        center: true,
	        show: isFollowCursor ? false : (show ?? true),
			opacity: opacity ?? 1,
			minWidth: minWidth ?? undefined,
	        minHeight: minHeight?? undefined,
			maxWidth: maxWidth ?? undefined,
	        maxHeight: maxHeight?? undefined,
	        resizable: resizable ?? true,
	        minimizable: minimizable ?? true,
	        maximizable: maximizable ?? true,
	        fullscreenable: fullscreenable ?? true,
			alwaysOnTop: alwaysOnTop ?? false,
	        autoHideMenuBar: false,
	        frame: frame ?? true,
	        backgroundColor: backgroundColor ?? bgColor,
	        useContentSize: true,
	        menuBarVisible: false,
            skipTaskbar: false,
			hasShadow: true,
	        webPreferences: {
				backgroundThrottling: false,
				webviewTag: true,
				devTools: true,
				webSecurity: false,
	            preload: path.join(appRoot.path, '/app/js/plugin/api.js'),
	            nodeIntegration: true,
	            contextIsolation: false,
	        }
		};

		if (parent) {
			// NOTE: 如果主視窗是全螢幕，則插件視窗也會是全螢幕，會導致插件視窗關閉後主視窗一片黑
			if (mainWindow.isFullScreen()) {
				windowOptions.fullscreenable = false;
			}
			else {
				windowOptions.parent = parent; 
			}
		}

		if (isServiceMode) {
			windowOptions.show = false;
		}

		// 毛玻璃效果
		if (vibrancy && process.platform === 'darwin') {
			windowOptions.vibrancy = getVibrancy();
			windowOptions.transparent = true;
			windowOptions.backgroundColor = undefined
		}

	    let bw = new BrowserWindow(windowOptions);

		bw.setMenuBarVisibility(false);

		// 攔截 http/https 連結，在外部瀏覽器打開而非開啟子窗口
		bw.webContents.setWindowOpenHandler(({ url }) => {
			if (url.startsWith('http://') || url.startsWith('https://')) {
				shell.openExternal(url);
				return { action: 'deny' };
			}
			return { action: 'allow' };
		});

		// 開發模式不需要記錄
		if (plugin.path.includes('Plugins')) {
			windowState.manage(bw);
		}

		const search = `?theme=${preferences?.theme?.name}&locale=${preferences?.general?.language}`;
		if (process.platform === 'win32') {
			bw.loadURL(URL_MODULE.pathToFileURL(`${plugin.path}/${plugin.manifest.main.url}`).href.replace('file://', protocolUrl) + search);
		}
		else {
			bw.loadURL(URL_MODULE.pathToFileURL(`${plugin.path}/${plugin.manifest.main.url}`).href + search);
		}

	    bw.on('closed', () => {
	    	bw = null;
	    });

		bw.on('ready-to-show', () => {
			
			if (isServiceMode) return;

			if (windowState?.isMaximized) {
				bw.webContents.once('did-finish-load', () => {
					bw.maximize();
				});
			}
		});

        ignoreMenuShortcuts(bw.webContents);

		bw.webContents.on('before-input-event', (event, input) => {
			if (input.type === 'keyDown') {
				const isCommandOrControl = process.platform === 'darwin' ? input.meta : input.control;
				const key = input.key.toLowerCase();
				const actions = {
					'c': () => bw.webContents.copy(),
					'v': () => bw.webContents.paste(),
					'x': () => bw.webContents.cut(),
					'a': () => bw.webContents.selectAll()
				};

				if (isCommandOrControl && actions[key]) {
					event.preventDefault();
					actions[key]();
				}
			}
		});

		bw.webContents.on('crashed', () => {
			electronLog.error(`[plugin] ${plugin?.manifest?.name} has crashed.`);
			if (manifest?.main?.keepAlive) {
				mainWindow?.webContents?.send('plugin-keepalive-crashed', {
					pluginId: plugin.manifest.id
				});
			}
		});

        bw.webContents.on('did-finish-load', () => {
	        bw.webContents.executeJavaScript(`
				window.parentID = ${mainWindow?.webContents?.id};
				window.windowID = ${bw?.webContents?.id};
            `);
        });
		
		let isFirstDomReady = true;
	    bw.webContents.on('dom-ready', () => {
			// followCursor：首次載入 DOM 準備好再顯示，確保內容已渲染
			// 後續 reload（如 keepAlive 重置）不應自動顯示
			if (isFollowCursor && isFirstDomReady && !bw.isVisible()) {
				bw.show();
			}
			isFirstDomReady = false;
			try {
				const script = `
					window.parentID = ${mainWindow?.webContents?.id};
					window.windowID = ${bw?.webContents?.id};
					window.eagle.app.theme = '${preferences?.theme?.name}';
					window.eagle.app.version = '${pjson?.version}';
					window.eagle.app.build = ${pjson?.buildNumber};
					window.eagle.app.locale = '${preferences?.general?.language}';
					window.eagle.app.runningUnderARM64Translation = ${app?.runningUnderARM64Translation};
					window.eagle.app.userDataPath = '${app.getPath('userData').replace(/\\/gm, "/").replace(/'/g, "\\'")}';
					window.eagle.plugin = {};

					window.eagle.plugin.path = '${plugin.path.replace(/\\/gm, "/").replace(/'/g, "\\'")}';
					window.eagle.plugin.path = require('path').normalize(window.eagle.plugin.path);

					window.eagle.library.path = '${rootDir.replace(/\\/gm, "/").replace(/'/g, "\\'")}';
					window.eagle.library.path = require('path').normalize(window.eagle.library.path);

					try {
						global.__dirname = eagle.plugin.path;
						eagle.isDev = !eagle.plugin.path.includes('Eagle/Plugins') && !eagle.plugin.path.includes('Eagle\\Plugins');
					} catch (err) {
						console.log(err);
					}
				`;
				bw.webContents.executeJavaScript(script);
			}
			catch (err) {
				electronLog.error(`[plugin] executeJavaScript error: ${err}, script: ${script}`);
			}
			setTimeout(() => {
				if (args) {
					plugin.args = args;
				}
				bw.webContents.send('plugin-create', plugin);
				bw.webContents.send('plugin-run', plugin);
			}, 100);
	    });

		bw.webContents.on("before-input-event", (e, input) => {
			if (input.type === "keyDown" && input.key === "F12") {
			  bw.webContents.toggleDevTools();
			}
		});

		if (showDevTools) {
			bw.once('ready-to-show', () => {
				bw.webContents.openDevTools();
			});
		}

	    bw.on('show', function(e) {
	    	bw.webContents.send('plugin-show');
        });

        bw.on('hide', function(e) {
	    	bw.webContents.send('plugin-hide');
        });

	    bw.on('close', function(e) {
	    	// serviceMode / keepAlive：攔截關閉，僅隱藏窗口
		    if (manifest?.main?.serviceMode || manifest?.main?.keepAlive) {
		    	e.preventDefault();
	            bw.blur();
	            bw.hide();
		    }
           	else {
           		bw.webContents.send('plugin-exit', {
                    rootDir: rootDir,
                });
           	}
        });

	    return {
			windowID: bw.id,
			webContentsID: bw.webContents.id
		};
	});

	// 插件右鍵選單
	ipcMain.on('create-context-menu', (event, items) => {
		try {
			const menu = Menu.buildFromTemplate(items);

			// 遞歸函數來為每個菜單項（包括子菜單的菜單項）添加click回調
			function addClickEventToMenuItems(menuItems) {
				menuItems.forEach(item => {
					if (item.submenu) {
						// 如果有子菜單，遞歸調用此函數
						addClickEventToMenuItems(item.submenu.items);
					}
					// 為菜單項添加click事件，假設每個item都有id
					item.click = () => {
						event.sender.send('context-menu-command', item.id);
					};
				});
			}

			// 使用遞歸函數來處理所有層級的菜單項
			addClickEventToMenuItems(menu.items);

			// 显示菜单
			menu.popup(BrowserWindow.fromWebContents(event.sender));
		} catch (error) {
			console.error(error);
		}
	});
}