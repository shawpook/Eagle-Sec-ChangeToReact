const urlParams = new URLSearchParams(window.location.search);

// TODO: 重構所有 remote.BrowserWindow.fromId(plugin.windowID)
global.Item = require('./model/item.js');
global.Folder = require('./model/folder.js');
global.i18next = require('./i18next.min.js');

const pluginIPC = require('./ipc.js');
const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const os = require('os');
const eagleFS = require('fs');
const pluginLogger = require('./logger.js');
const Item = require('./model/item.js');
const Tag = require('./model/tag.js');
const TagGroup = require('./model/tag-group.js');
const Folder = require('./model/folder.js');
const ContextMenu = require('./model/context-menu.js');

global.nativeImage = electron.nativeImage;

function onThemeChanged(theme) {
	if (!theme) return;
	if (process.platform !== 'darwin') {
		const themeColors = {
			"GRAY": "#303134",
			"DARK": "#18191c",
			"BLUE": "#0d1630",
			"PURPLE": "#1C1424",
			"LIGHT": "#f3f4f6",
			"LIGHTGRAY": "#e3e4e6"
		};
		const bgColor = themeColors[theme] || "#303134"
		eagle.window.setBackgroundColor(bgColor);
	}
	eagle.app.theme = theme;
}

pluginIPC.init(ipcRenderer);

pluginIPC.addCallback('plugin-create', async(plugin) => {
	eagle.plugin = plugin;
	global.__dirname = plugin.path;

	if (eagle?.plugin?.manifest?.fallbackLanguage) {
		let dict;
		let fallbackPath = `${eagle.plugin.path}/_locales/${eagle?.plugin?.manifest?.fallbackLanguage}.json`;
		try {
			dict = require(`${eagle.plugin.path}/_locales/${eagle.app.locale}.json`);
		} catch (err) {
			try {
				dict = require(fallbackPath);
			}
			catch (err) {
				alert(`Initialization error, could not find the specified i18n file: ${fallbackPath}.`);
			}
		}
		if (dict) {
			i18next.init({
				resources: {
					'dev': { translation: dict },
				},
				fallbackLng: 'dev',
				ns: ['translation'],
				defaultNS: 'translation',
			});
		}
	}

	try {
		const dependencies = eagle?.plugin?.manifest?.dependencies || []
		if (dependencies.indexOf("ai-sdk") > -1) {
			const aiModulePath = `${eagle.app.userDataPath}/Plugins/ai-sdk/ai-sdk.cjs`;
			const ai = require(aiModulePath).default({
				configPath: aiModulePath + "/config.json"
			});
			eagle.extraModule.ai = {
				open: async () => { return await ipcRenderer.invoke('plugin.extraModule.ai.', { method: 'open', value: undefined }); },
				...ai
			}
		}
	} catch (err) {
		console.error(err);
	}
});
pluginIPC.addCallback('library-changed', (libraryPath) => {
	eagle.library.path = libraryPath;
});
pluginIPC.addCallback('theme-changed', (theme) => {
	if (process.platform !== 'darwin') {
		const themeColors = {
			"GRAY": "#303134",
			"DARK": "#18191c",
			"BLUE": "#0d1630",
			"PURPLE": "#1C1424",
			"LIGHT": "#f3f4f6",
			"LIGHTGRAY": "#e3e4e6"
		};
		const bgColor = themeColors[theme] || "#303134"
		eagle.window.setBackgroundColor(bgColor);
	}
	eagle.app.theme = theme;
});

pluginLogger.init(ipcRenderer);
pluginLogger.insert(eagleFS, 'fs', ['rm', 'rmSync', 'rename', 'renameSync', 'rmdir', 'rmdirSync', 'unlink', 'unlinkSync']);
pluginLogger.insert(eagleFS.promises, 'fs.promises', ['rm', 'rename', 'rmdir', 'unlink']);
global.eagle = {

	manifest: {},
	onPluginCreate: (callback) => { pluginIPC.addCallback('plugin-create', callback); },
	onPluginBeforeExit: (callback) => { pluginIPC.addCallback('plugin-exit', callback); },
	onPluginShow: (callback) => { pluginIPC.addCallback('plugin-show', callback); },
	onPluginHide: (callback) => { pluginIPC.addCallback('plugin-hide', callback); },
	onPluginRun: (callback) => { pluginIPC.addCallback('plugin-run', callback); },
	onThemeChanged: (callback) => { pluginIPC.addCallback('theme-changed', callback); },	// TODO
	onLibraryChanged: (callback) => { pluginIPC.addCallback('library-changed', callback); },
	app: {
		theme: urlParams.get('theme'),
		locale: urlParams.get('locale'),
		isDarkColors: () => {
			return window.matchMedia('(prefers-color-scheme: dark)').matches;
		},
		version: "",								// 當前應用版本
		build: "",									// 當前應用 build 版號
		runningUnderARM64Translation: false,		// 是否跑在 ARM 模擬器上
		locale: "",									// 當前語系
		arch: process.arch,							// 軟件架構（x64, arm64）
		platform: process.platform,					// 當前作業系土（darwin, win32）
		env: process.env,							// 環境變數
		execPath: process.execPath,					// 軟件位置
		pid: process.pid,							// 當前程序 id
		resourcesPath: process.resourcesPath,		// 
		isWindows: process.platform === 'win32',	// 當前操作系統是否為 Windows
		isMac: process.platform === 'darwin',		// 當前操作系統是否為 macOS
		// TODO，應該要重構才對
		// https://www.electronjs.org/docs/latest/api/app#appgetpathname
		getPath: async (name) => {
			return await ipcRenderer.r2r(global?.parentID, 'app.getPath', name);
		},
		getFileIcon: async (path, options) => {	// https://www.electronjs.org/docs/latest/api/app#appgetfileiconpath-options
			return await ipcRenderer.r2r(global?.parentID, 'app.getFileIcon', {
				path: path,
				options
			});
		},
		createThumbnailFromPath: async (path, maxSize) => {	// https://www.electronjs.org/docs/latest/api/app#appgetfileiconpath-options
			return await ipcRenderer.r2r(global?.parentID, 'app.createThumbnailFromPath', {
				path: path,
				maxSize
			});
		},
	},
	os: {
		tmpdir: os.tmpdir,
		version: os.version,
		type: os.type,
		release: os.release,
		hostname: os.hostname,
		homedir: os.homedir,
		arch: os.arch,
	},
	screen: {
		getCursorScreenPoint: async () => { return await ipcRenderer.invoke('screen.', { method: 'getCursorScreenPoint' }); },
		getPrimaryDisplay: async () => { return await ipcRenderer.invoke('screen.', { method: 'getPrimaryDisplay' }); },
		getAllDisplays: async () => { return await ipcRenderer.invoke('screen.', { method: 'getAllDisplays' }); },
		getDisplayNearestPoint: async (point) => { return await ipcRenderer.invoke('screen.', { method: 'getDisplayNearestPoint', value: point }); },
	},
	// TODO: 
	toast: {

	},
	notification: {
		show: async (params) => {
			return await ipcRenderer.send('notification', {
				progress: false,
				mute: !!params.mute,
				duration: params.duration || 1000,
				title: params.title,
				description: params.body,
				webUrl: params.icon
			});
		},
	},
	window: {
		show: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'show', value: undefined }); },
		showInactive: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'showInactive', value: undefined }); },
		hide: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'hide', value: undefined }); },
		focus: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'focus', value: undefined }); },
		minimize: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'minimize', value: undefined }); },
		maximize: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'maximize', value: undefined }); },
		unmaximize: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'unmaximize', value: undefined }); },
		restore: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'restore', value: undefined }); },
		isMaximized: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'isMaximized', value: undefined }); },
		isMinimized: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'isMinimized', value: undefined }); },
		setFullScreen: async (value) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setFullScreen', value: value }); },
		isFullScreen: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'isFullScreen', value: undefined }); },
		setAspectRatio: async (aspectRatio) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setAspectRatio', value: aspectRatio }); },
		setBackgroundColor: async (backgroundColor) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setBackgroundColor', value: backgroundColor }); },
		center: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'center', value: undefined }); },
		setSize: async (width, height) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setSize', value: width, value2: height }); },
        getSize: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'getSize', value: undefined }); },
        setBounds: async (bounds, animate) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setBounds', value: bounds, value2: animate }); },
        getBounds: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'getBounds', value: undefined }); },
		setResizable: async (resizable) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setResizable', value: resizable }); },
		isResizable: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'isResizable', value: undefined }); },
		setAlwaysOnTop: async (flag) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setAlwaysOnTop', value: flag }); },
		isAlwaysOnTop: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'isAlwaysOnTop', value: undefined }); },
		setPosition: async (x, y) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setPosition', value: x, value2: y }); },
		getPosition: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'getPosition', value: undefined }); },
		setOpacity: async (opacity) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setOpacity', value: opacity }); },
		center: async (opacity) => { return await ipcRenderer.invoke('plugin.window.', { method: 'center', value: opacity }); },
		getOpacity: async () => { return await ipcRenderer.invoke('plugin.window.', { method: 'getOpacity', value: undefined }); },
		flashFrame: async (flag) => { return await ipcRenderer.invoke('plugin.window.', { method: 'flashFrame', value: flag }); },
		setIgnoreMouseEvents: async (ignore) => { return await ipcRenderer.invoke('plugin.window.', { method: 'setIgnoreMouseEvents', value: ignore }); },
		openDevTools: async (ignore) => { return await ipcRenderer.invoke('plugin.window.webContents.', { method: 'openDevTools', value: undefined }); },
		capturePage: async (rect=undefined) => { return await ipcRenderer.invoke('plugin.window.webContents.', { method: 'capturePage', value: rect }); },
		setReferer: async (referer) => { return await ipcRenderer.invoke('plugin.window.setReferer', referer ); },
	},
	// 產生一個 uuid
	guid: () => {
		return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
	},
	item: Item,
	tag: Tag,
	tagGroup: TagGroup,
	folder: Folder,
	contextMenu: ContextMenu,
	extraModule: {
		ffmpeg: {
			install: async () => { return await ipcRenderer.invoke('plugin.extraModule.ffmpeg.', { method: 'install', value: undefined }); },
			isInstalled: async () => { return await ipcRenderer.invoke('plugin.extraModule.ffmpeg.', { method: 'isInstalled', value: undefined }); },
			getPaths: async () => { return await ipcRenderer.invoke('plugin.extraModule.ffmpeg.', { method: 'getPaths', value: undefined }); },
		},
		aiSearch: {
			// 狀態查詢
			isInstalled: async () => { return await ipcRenderer.r2r(global?.parentID, 'aiSearch.isInstalled'); },
			isReady: async () => { return await ipcRenderer.r2r(global?.parentID, 'aiSearch.isReady'); },
			isStarting: async () => { return await ipcRenderer.r2r(global?.parentID, 'aiSearch.isStarting'); },
			isSyncing: async () => { return await ipcRenderer.r2r(global?.parentID, 'aiSearch.isSyncing'); },
			// 服務控制
			open: async () => { return await ipcRenderer.r2r(global?.parentID, 'aiSearch.open'); },
			checkServiceHealth: async () => { return await ipcRenderer.r2r(global?.parentID, 'aiSearch.checkServiceHealth'); },
			getSyncStatus: async () => { return await ipcRenderer.r2r(global?.parentID, 'aiSearch.getSyncStatus'); },
			// 搜尋方法
			searchByText: async (query, options) => {
				const result = await ipcRenderer.r2r(global?.parentID, 'aiSearch.searchByText', { query, options });
				if (result?.results) {
					result.results = result.results.map(r => ({ item: new Item(r.item), score: r.score }));
				}
				return result;
			},
			searchByBase64: async (base64, options) => {
				const result = await ipcRenderer.r2r(global?.parentID, 'aiSearch.searchByBase64', { base64, options });
				if (result?.results) {
					result.results = result.results.map(r => ({ item: new Item(r.item), score: r.score }));
				}
				return result;
			},
			searchByItemId: async (itemId, options) => {
				const result = await ipcRenderer.r2r(global?.parentID, 'aiSearch.searchByItemId', { itemId, options });
				if (result?.results) {
					result.results = result.results.map(r => ({ item: new Item(r.item), score: r.score }));
				}
				return result;
			},
		},
	},
	library: {
		info: async () => {
			return new Promise(async (resolve, reject) => {
				let result = await ipcRenderer.r2r(global?.parentID, 'library.info');
				return resolve(result);
			});
		},
		history: async () => {
			return await ipcRenderer.r2r(global?.parentID, 'library.history');
		},
		switch: async (libraryPath) => {
			return await ipcRenderer.r2r(global?.parentID, 'library.switch', { libraryPath });
		},
		icon: async (libraryPath) => {
			return await ipcRenderer.r2r(global?.parentID, 'library.icon', { libraryPath });
		},
	},
	dialog: {
		showOpenDialog: async (options) => { return await ipcRenderer.invoke('dialog.', { method: 'showOpenDialog', value: options }); },
		showSaveDialog: async (options) => { return await ipcRenderer.invoke('dialog.', { method: 'showSaveDialog', value: options }); },
		showMessageBox: async (options) => { return await ipcRenderer.invoke('dialog.', { method: 'showMessageBox', value: options }); },
		showErrorBox: async (title, content) => { return await ipcRenderer.invoke('dialog.', { method: 'showErrorBox', value: title, value2: content }); },
	},
	clipboard: {
		clear: electron.clipboard.clear,
		has: electron.clipboard.has,
		readBuffer: electron.clipboard.readBuffer,
		readHTML: electron.clipboard.readHTML,
		readImage: electron.clipboard.readImage,
		readText: electron.clipboard.readText,
		writeBuffer: electron.clipboard.writeBuffer,
		writeHTML: electron.clipboard.writeHTML,
		writeImage: electron.clipboard.writeImage,
		writeText: electron.clipboard.writeText,
		availableFormats: electron.clipboard.availableFormats,
		copyFiles: (paths) => { ipcRenderer.send('copy-paths-to-clipboard', paths); },
	},
	drag: {
		startDrag: async (paths) => {
			if (!Array.isArray(paths)) return;
			return await ipcRenderer.invoke('plugin.startDrag', { paths: paths });
		},
	},
	shell: {
		beep: async () => { return await ipcRenderer.invoke('shell.', { method: 'beep' }); },
		openExternal: async (url) => { return await ipcRenderer.invoke('shell.', { method: 'openExternal', value: url }); },
		openPath: async (path) => { return await ipcRenderer.invoke('shell.', { method: 'openPath', value: path }); },
		showItemInFolder: async (fullPath) => { return await ipcRenderer.invoke('shell.', { method: 'showItemInFolder', value: fullPath }); },
	},
	log: {
		debug: (object) => { pluginLogger.debug(eagle.plugin, object); },
		info: (object) => { pluginLogger.info(eagle.plugin, object); },
		warn: (object) => { pluginLogger.warn(eagle.plugin, object); },
		error: (object) => { pluginLogger.error(eagle.plugin, object); },
	}
};

onThemeChanged(eagle.app.theme);

try {
	if (process.platform === 'win32') {
		eagle.plugin = {
			path: require('path').parse(require('url').fileURLToPath(`file:/${location.pathname}`)).dir
		};
	}
	else {
		eagle.plugin = {
			path: decodeURIComponent(location.pathname.replace("/index.html", ""))
		};
	}
	eagle.isDev = !eagle.plugin.path.includes('Eagle/Plugins') && !eagle.plugin.path.includes('Eagle\\Plugins');
	global.__dirname = eagle.plugin.path;
} catch (err) {
	console.log(err);
}