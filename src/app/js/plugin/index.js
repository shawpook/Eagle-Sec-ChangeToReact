const appRoot = require('app-root-path');
const electron = require('electron');
const remote = require('@electron/remote');
const BrowserWindow = remote.BrowserWindow;
const app = remote.app;
const MenuItem = remote.MenuItem;
const path = require('path');
const { ipcRenderer } = require('electron');
const isAccelerator = require(appRoot.path + '/app/js/utils/is-accelerator.js');
const PLUGINS_PATH = path.normalize(`${app.getPath('userData')}/Plugins`);
const getBestURL = require(appRoot.path + '/app/js/utils/getBestURL.js');
const { registerHandler, bridgeIPC } = require('./handlers');
const { initSmartFolderHandlers } = require('./handlers/smart-folder-handlers');
const fileSaveItemMap = {};
const fileUploadItemMap = {};
const thumbnailGenerateItemMap = {};

let pluginModule = {
	plugins: [],
	pinnedPlugins: [],
    pluginWindowIds: [],
    pluginShortcuts: {},
	installedPluginMaps: {},
	installingPluginMaps: {},
	needUpdatePluginMaps: {},
	pinnedPluginMaps: {},
	servicePlugins: {},				// 記錄服務插件的狀態
	keepAliveTimers: {},			// keepAlive 模式的銷毀計時器 { pluginId: timeoutHandle }
	disabledPluginMaps: {},			// 記錄停用的插件 { pluginId: true }
	isPluginDisabled: (pluginId) => {
		return !!pluginModule.disabledPluginMaps[pluginId];
	},
	loadDisabledPlugins: () => {
		try {
			pluginModule.disabledPluginMaps = localStorage['eagle.plugin.disabled']
				? JSON.parse(localStorage['eagle.plugin.disabled'])
				: {};
		} catch (err) {
			pluginModule.disabledPluginMaps = {};
		}
	},
	saveDisabledPlugins: () => {
		localStorage['eagle.plugin.disabled'] = JSON.stringify(pluginModule.disabledPluginMaps);
	},
	init: init,						// ✔️ 初始化插件列表，如果插件是背景模式，會自動建立在背景，不顯示畫面
	initIPC: initIPC,
	initServicePlugins: initServicePlugins,	// 初始化服務插件
    initShortcuts: () => {
        pluginModule.pluginShortcuts = {};
        pluginModule.plugins.forEach((plugin) => {
            if (plugin) {
                if (pluginModule.isPluginDisabled(plugin?.manifest?.id)) return;
                // 綁定快速鍵（優先使用偏好設置的設定）
                let pluginID = plugin.manifest.id;
                let shortcut = plugin?.manifest?.shortcut || preferences.shortcuts.keybinds[pluginID];
                if (pluginID && shortcut) {
                    if (isAccelerator(shortcut)) {
                        pluginModule.pluginShortcuts[pluginID] = shortcut?.replaceAll(' ', '');
                    }
                }
                else {
                    delete pluginModule.pluginShortcuts[pluginID];   
                }
            }
        });
    },
	initMenu: () => {
        pluginModule.pluginMenu = new MenuItem({
            label: i18n.__('general.plugin'),
            submenu: []
        })
        pluginModule.pluginMenu.submenu.append(new MenuItem({ 
            label: i18n.__('modal.pluginPanel.function.install'),
            click: () => {
                $bodyScope.$broadcast("OPEN_PLUGIN_CENTER");
                $bodyScope.$evalAsync();
            }
        }));

		pluginModule.pluginMenu.submenu.append(new MenuItem({
			label: i18n.__('modal.pluginPanel.function.developer'),
			submenu: [
				new MenuItem({
					label: i18n.__('modal.pluginPanel.contextMenu.createPlugin'),
					click: () => {
						$bodyScope.$broadcast('OPEN_PLUGIN_CREATOR');
						$bodyScope.$evalAsync();
					}
				}),
				new MenuItem({
					label: i18n.__('modal.pluginPanel.contextMenu.importPlugin'),
					click: async () => {
						let result = await dialog.showOpenDialog(currentWindow, {
							properties: ['openDirectory']
						});
						if (result?.filePaths) {
							console.log(`Load local project: ${result?.filePaths[0]}`);
							pluginModule.localPlugin.load(result?.filePaths[0]);
						}
					}
				}),
				new MenuItem({
					type: 'separator'
				}),
				new MenuItem({
					label: i18n.__('modal.pluginPanel.contextMenu.docs'),
					click: () => {
						shell.openExternal('https://developer.eagle.cool/plugin-api/v/eagle-plugin-api/get-started/introduction');
					}
				}),
			]
		}));


		if (pluginModule.plugins.length > 0) {
			pluginModule.pluginMenu.submenu.append(new MenuItem({ 
				type: 'separator'
			}));
			pluginModule.plugins.forEach(function (plugin) {
                let manifest = plugin.manifest;
				if (manifest?.main && !pluginModule.isPluginDisabled(manifest.id)) {
                    let accelerator = (pluginModule.pluginShortcuts[manifest.id])? pluginModule.pluginShortcuts[manifest.id] : '';
					pluginModule.pluginMenu.submenu.append(new MenuItem({
						label: manifest.name,
                        accelerator: accelerator,
						click: function () {
							pluginModule.open(plugin);
						}
					}));
				}
			});
		}
		
		currentWindow.webContents.send('update-menu');
	},
	refresh: async () => {
		ipcRenderer.send('electron-info', `[plugin] Refresh plugins...`);
		pluginModule.plugins.forEach((plugin) => {
			pluginModule.destoryPlugin(plugin);
		});
		await init();
	},
	refreshInstalledPlugins: () => {
		pluginModule.installedPluginMaps = {};
		pluginModule.plugins.forEach((plugin) => {
			try {
				pluginModule.installedPluginMaps[plugin?.manifest?.id] = plugin;
			}
			catch (err) {}
		});
		$bodyScope.$broadcast('REFRESH_PLUGIN_CENTER');
		$bodyScope.$evalAsync();

		ipcRenderer.send('plugin.loaded', {
			plugins: pluginModule.plugins,
			previewExtension: {
				thumbnailPluginMap: pluginModule.previewExtension.thumbnailPluginMap,
				thumbnailPath: pluginModule.previewExtension.thumbnailPath, 
				thumbnailOptions: pluginModule.previewExtension.thumbnailOptions, 
				viewerPluginMap: pluginModule.previewExtension.viewerPluginMap, 
				viewerURL: pluginModule.previewExtension.viewerURL,
				inspectorPlugins: pluginModule.previewExtension.inspectorPlugins,
				inspectorPluginsMap: pluginModule.previewExtension.inspectorPluginsMap,
				inspectorPluginPathMap: pluginModule.previewExtension.inspectorPluginPathMap,
			}
		});
		pluginModule.initMenu();
	},
	getLastOpenedPlugins: (length) => {
		let lastOpenedPlugins = [];
		if (localStorage['eagle.plugin.lastOpenedPlugins']) {
			try {
				lastOpenedPlugins = JSON.parse(localStorage['eagle.plugin.lastOpenedPlugins']);
			}
			catch (err) {}
		}

		lastOpenedPlugins = lastOpenedPlugins.filter((id) => {
			return pluginModule.installedPluginMaps[id];
		});
		
		if (length) {
			lastOpenedPlugins = lastOpenedPlugins.slice(0, length);
		}
		return lastOpenedPlugins;
	},
	addToLastOpenedPlugins: (plugin) => {
		if (!plugin?.manifest?.id) return;
		let lastOpenedPlugins = [];
		if (localStorage['eagle.plugin.lastOpenedPlugins']) {
			try {
				lastOpenedPlugins = JSON.parse(localStorage['eagle.plugin.lastOpenedPlugins']);
			}
			catch (err) {}
		}
		if (lastOpenedPlugins.includes(plugin.manifest.id)) {
			lastOpenedPlugins = lastOpenedPlugins.filter((id) => {
				return id !== plugin.manifest.id;
			});
		}
		lastOpenedPlugins.unshift(plugin.manifest.id);
		lastOpenedPlugins = lastOpenedPlugins.slice(0, 5);
		localStorage['eagle.plugin.lastOpenedPlugins'] = JSON.stringify(lastOpenedPlugins);
	},
	create: create,					// ✔️ 建立插件
	open: open,						// ✔️ 開啟插件，若插件當前尚未建立，則會自動建立再開啟
	openPluginById: (pluginId, params) => {
		const plugin = pluginModule.installedPluginMaps[pluginId];
		if (plugin) {
			pluginModule.open(plugin, params);
		}
	},
	showPluginById: (pluginId) => {
		const plugin = pluginModule.installedPluginMaps[pluginId];
		if (plugin) {
			let browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
			browserWindow?.show();
		}
	},
	openPreview: (plugin, item) => {
		let rawPath = FileUrlHelper.getRawPath(item);
		let url = `file://${pluginModule?.previewExtension.viewerURL[item?.ext]}?id=${item.id}&path=${encodeURIComponent(rawPath)}&width=${item.width}&height=${item.height}&theme=${$bodyScope.theme}`
		let win = new BrowserWindow({
			show: true,
			width: 800,
			height: 600,
			frame: true,
			enableLargerThanScreen: true,
			autoHideMenuBar: true,
			skipTaskbar: true,
			backgroundColor: "#ffffff",
			webPreferences: {
				backgroundThrottling: false,
				preload: path.join(appRoot.path, '/app/js/plugin/api-format-extension.js'),
				zoomFactor: 1,
				webSecurity: false,
				nodeIntegration: true,
				contextIsolation: false,
				devTools: true
			}
		});
		win.webContents.on("before-input-event", (e, input) => {
			if (input.type === "keyDown" && input.key === "F12") {
			  win.webContents.toggleDevTools();
			}
		});
		win.webContents.on('dom-ready', () => {
			try {
				const script = `
					window.parentID = ${currentWindow?.webContents?.id};
					window.windowID = ${win?.webContents?.id};
					window.eagle.app.theme = '${preferences?.theme?.name}';
					window.eagle.app.version = '${pjson?.version}';
					window.eagle.app.build = ${pjson?.buildNumber};
					window.eagle.app.locale = '${preferences?.general?.language}';
					window.eagle.app.runningUnderARM64Translation = ${app?.runningUnderARM64Translation};
					window.eagle.plugin = {};
					window.eagle.plugin.path = '${plugin.path.replace(/\\/gm, "/").replace(/'/g, "\\'")}';
					window.eagle.plugin.path = require('path').normalize(window.eagle.plugin.path);

					window.eagle.library.path = '${$bodyScope?.libraryPath?.replace(/\\/gm, "/").replace(/'/g, "\\'")}';
					window.eagle.library.path = require('path').normalize(window.eagle.library.path);
					window.eagle.app.userDataPath = '${app.getPath('userData').replace(/\\/gm, "/").replace(/'/g, "\\'")}';
					
					try {
						global.__dirname = eagle.plugin.path;
						eagle.isDev = !eagle.plugin.path.includes('Eagle/Plugins') && !eagle.plugin.path.includes('Eagle\\Plugins');
					} catch (err) {
						console.log(err);
					}
				`;
				win.webContents.executeJavaScript(script);
			}
			catch (err) {
				ipcRenderer.send('electron-log', `[plugin] executeJavaScript error: ${err}, script: ${script}`);
			}
			setTimeout(() => {
				win.webContents.send('plugin-create', plugin);
				win.webContents.send('plugin-run');
			}, 100);
		});
		win.loadURL(url);
	},
	close: close,					// ✔️ 關閉插件
	openDevTools, openDevTools,		// ✔️ 開啟開發工具
	loadManifest: loadManifest,		// ✔️ 載入插件 manifest.json
	checkPluginInstalled: (pluginId) => {
		return pluginModule.installedPluginMaps[pluginId] ? true : false;
	},
	isOpen: (pluginId) => {
		const plugin = pluginModule.installedPluginMaps[pluginId];
		if (!plugin) return false;
		if (!plugin.windowID) return false;
		try {
			const browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
			return browserWindow && !browserWindow.isDestroyed();
		}
		catch (err) {
			return false;
		}
	},
	isVisible: (pluginId) => {
		const plugin = pluginModule.installedPluginMaps[pluginId];
		if (!plugin) return false;
		if (!plugin.windowID) return false;
		try {
			const browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
			return browserWindow && !browserWindow.isDestroyed() && browserWindow.isVisible();
		}
		catch (err) {
			return false;
		}
	},
	showInstallPluginDialog: (pluginId) => {
		swal({
			html: `
				<div class="alert">
					<div class="alert-icon info"></div>
					<h4 class="alert-title">${i18n.__('dialog.plugin.installDependency.title')}</h4>
					<p class="alert-desc">${i18n.__('dialog.plugin.installDependency.desc')}</p>
				</div>
			`,	
			showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
			width: 400,
			customClass: "alert-box",
			cancelButtonColor: "#777777",
			confirmButtonText: i18n.__('dialog.plugin.installDependency.btn'),
			cancelButtonText: i18n.__("general.cancel"),
		}).then(function () {
			currentWindow.webContents.send('install-plugin', pluginId);
		});
	},
	checkAllDependencies: () => {
		try {
			const hasDependencies = pluginModule.plugins.filter((plugin) => {
				const dependencies = plugin?.manifest?.dependencies ?? [];
				return dependencies.length > 0;
			});
			hasDependencies.forEach((plugin) => {
				pluginModule.checkDependencies(plugin.manifest);
			});
		}
		catch (err) {}
	},
	checkDependencies: (manifest) => {
		const dependencies = manifest?.dependencies || [];
		if (dependencies.length === 0) return [];

		let requireDependencies = [];
		const extraModule = require(appRoot + '/app/js/plugin/extra-module.js');
		dependencies.forEach((dependency) => {
			if (dependency === "ffmpeg") {
				if (!extraModule.ffmpeg.isInstalled()) {
					requireDependencies.push({
						id: extraModule.ffmpeg.moduleName,
						name: extraModule.ffmpeg.name,
					});
				}
			}
			else if (dependency === "ai-sdk") {
				if (!extraModule.ai.isInstalled()) {
					requireDependencies.push({
						id: extraModule.ai.moduleName,
						name: extraModule.ai.name,
					});
				}
			}
			return false;
		});

		if (requireDependencies.length > 0) {
			const dep = requireDependencies[0];
			const $filter = angular.element(document.body).injector().get('$filter');
			const desc = $filter('i18n')("dialog.plugin.missingDependencies.desc", [
				{ "property": "plugin", "value": manifest.name },
				{ "property": "dependency", "value": dep.name },
			]);
			swal({
				html: `
					<div class="alert">
						<div class="alert-icon info"></div>
						<h4 class="alert-title">${i18n.__('dialog.plugin.missingDependencies.title')}</h4>
						<p class="alert-desc">${desc}</p>
					</div>
				`,	
				showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
				width: 400,
				customClass: "alert-box",
				cancelButtonColor: "#777777",
				confirmButtonText: i18n.__("general.ok"),
				cancelButtonText: i18n.__("general.cancel"),
			}).then(function () {
				currentWindow.webContents.send('install-plugin', dep.id);
			});
		}

		return requireDependencies;
	},
	remotePlugin: {
		/**
		 * 下載插件到指定位置
		 * @param {string} pluginURL 插件下載路徑
		 * @param {string} dest 保存路徑
		 * @returns {string} .eagleplugin 下載完成之路徑
		 */
		download: async (pluginURL, dest, onProgress) => {
			return new Promise(async (resolve, reject) => {
				try {
					ipcRenderer.send('electron-info', `[plugin] Download plugin from: ${pluginURL}`);
					const downloadFile = require(appRoot.path + '/app/js/utils/downloadFile.js');
					await downloadFile({
						src: pluginURL,
						dest: dest,
						onProgress: onProgress
					});
                    ipcRenderer.send('electron-info', `[plugin] Download plugin finished.`);
					if (!fs.existsSync(dest)) {
						return reject(new Error(`Downlaod fail: ${dest}`));
					}
					return resolve();
				}
				catch (err) {
					return reject(err);
				}
			});
		},
		/**
		 * 从指定网址下载并安装插件
		 * @param {Plugin} 欲安裝插件
		 */
		install: async (plugin) => {

			// 檢查該插件是否有依賴其他插件 plugin.dependencies
			const requireDependencies = pluginModule.checkDependencies(plugin);
			if (requireDependencies.length > 0) return;

			const zipDownloadPath = path.normalize(`${EAGLE_THUMBNAIL_TEMP_PATH}/${plugin.name}.eagleplugin`);
			plugin.percentage = 0;
			pluginModule.installingPluginMaps[plugin.id] = plugin;
			$bodyScope.$evalAsync();

			// 自動選擇 oss 或 r2 下載連結
			const downloadURL = await getBestURL([
				{ url: `${plugin.lasteVersion.downloadLink['r2']}?v=${Date.now()}`, delay: 0 },
				{ url: `${plugin.lasteVersion.downloadLink['oss']}?v=${Date.now()}`, delay: 2000 },
			]);
			
			if (!downloadURL) {
				ipcRenderer.send('electron-log', "[plugin] both oss and r2 download link are not available.");
				ipcRenderer.send('electron-log', `[plugin] oss: ${ossURL}, r2: ${r2URL}`);
				return;
			}

			pluginModule.remotePlugin.download(downloadURL, zipDownloadPath, (percentage) => {
				console.log(percentage);
				pluginModule.installingPluginMaps[plugin.id].percentage = percentage;
				$bodyScope.$evalAsync();
			}).then(async () => {
				ipcRenderer.send('electron-info', `[plugin] Download plugin success.`);
				await pluginModule.installPluginFromZip(zipDownloadPath);
				delete pluginModule.installingPluginMaps[plugin.id].percentage;
				delete pluginModule.installingPluginMaps[plugin.id];
                fetch(`https://community-en.eagle.cool/api/plugin/${plugin?.id}/install`, { method: 'POST' });
				$bodyScope.$evalAsync();
			}).catch((err) => {
				ipcRenderer.send('electron-log', `[plugin] Download plugin fail, beacause:`);
				ipcRenderer.send('electron-log', "[plugin] " + err.stack || err);
				ipcRenderer.send('electron-info', `[plugin] file url: ${downloadURL}.`);
				delete pluginModule.installingPluginMaps[plugin.id].percentage;
				delete pluginModule.installingPluginMaps[plugin.id];
				$bodyScope.$evalAsync();
			});
		},

		/**
		 * 刪除安裝在 %appdata%/Plugins/ 底下的插件
		 * @param {Plugin} plugin 欲刪除之插件物件
		 */
		uninstall: (plugin) => {
			ipcRenderer.send('electron-info', `[plugin] Uninstall plugin: ${plugin.path}`);
			let pluginPath = plugin.path;
			let moduleIdx = -1;
			pluginModule.plugins.forEach((p, index) => {
				if (p.path === pluginPath) {
					moduleIdx = index;
					pluginModule.destoryPlugin(p);
				}
			});
			if (moduleIdx !== -1) {
				pluginModule.plugins.splice(moduleIdx, 1);
				console.log(`remove from plugins: ${moduleIdx}`);
				$bodyScope.$broadcast('UPDATE_PLUGIN_PANEL');
                fetch(`https://community-en.eagle.cool/api/plugin/${plugin?.manifest?.id}/uninstall`, { method: 'POST' });
			}

			unregisterPluginExtensions(plugin);

			// 清理停用狀態
			delete pluginModule.disabledPluginMaps[plugin?.manifest?.id];
			pluginModule.saveDisabledPlugins();

			if (pluginPath.includes(PLUGINS_PATH)) {
				fse.remove(pluginPath, (err) => {
					if (err) {
						ipcRenderer.send('electron-log', "[plugin] " + err.stack || err);
					}
				});
			}
			delete pluginModule.installedPluginMaps[plugin?.manifest?.id];
			pluginModule.unpinPlugin(plugin);
			pluginModule.refreshInstalledPlugins();
			$bodyScope.$broadcast("PLUGIN_UNINSTALL", plugin?.manifest?.id);
			currentWindow.webContents.send('plugin-uninstalled', plugin?.manifest?.id);
			ipcRenderer.send('plugin-uninstalled', plugin?.manifest?.id);
		},
	},
	localPlugin: {
		getPaths: () => {
			let localPlugins = [];
			try {
				if (localStorage['PLUGIN_LOCAL_PLUGINS']) {
					let paths = JSON.parse(localStorage['PLUGIN_LOCAL_PLUGINS']);
					if (Array.isArray(paths)) {
						localPlugins = paths;
					}
				}
			}
			catch (err) {}

			const originalCount = localPlugins.length;

			// 正規化所有路徑並去除重複
			localPlugins = [...new Set(localPlugins.map((p) => path.normalize(p)))];

			// 過濾並記錄被移除的路徑
			let validPlugins = localPlugins.filter((pluginPath) => {
				let exists = fs.existsSync(pluginPath);
				if (!exists) {
					ipcRenderer.send('electron-info', `[plugin] Local plugin path no longer exists, removing from memory: ${pluginPath}`);
				}
				return exists;
			});

			// 如果有路徑被過濾或去重，更新 localStorage
			if (validPlugins.length !== originalCount) {
				pluginModule.localPlugin.savePaths(validPlugins);
				ipcRenderer.send('electron-info', `[plugin] Updated local plugin paths, cleaned up invalid/duplicate path(s)`);
			}

			return validPlugins;
		},
		savePaths: (localPluginPaths) => {
			localStorage['PLUGIN_LOCAL_PLUGINS'] = JSON.stringify(localPluginPaths);
		},
		load: (filePath) => {
			return new Promise((resolve, reject) => {
				try {
					filePath = path.normalize(filePath);
					if (!fs.existsSync(filePath)) {
						alert(`File does not exist: ${filePath}`);
						return;
					}
					let localPluginPaths = pluginModule.localPlugin.getPaths();
					// 避免重複加入相同路徑
					if (!localPluginPaths.includes(filePath)) {
						localPluginPaths.push(filePath);
						pluginModule.localPlugin.savePaths(localPluginPaths);
					}
					const plugin = pluginModule.reloadPlugin(filePath);
					currentWindow.webContents.send('plugin-installed', plugin.manifest.id);
					ipcRenderer.send('plugin-installed', plugin.manifest.id);
					resolve();
				}
				catch (err) {
					console.error(err);
					reject(err);
				}
			});
		},
		// * 純粹從清單移除（適用於本地開發）
		uninstall: (plugin) => {
			ipcRenderer.send('electron-info', `[plugin] Uninstall local plugin: ${plugin.path}`);
			let pluginPath = path.normalize(plugin.path);
			let localPluginPaths = pluginModule.localPlugin.getPaths();
			let localIdx = localPluginPaths.indexOf(pluginPath);

			if (localIdx !== -1) {
				localPluginPaths.splice(localIdx, 1);
				pluginModule.localPlugin.savePaths(localPluginPaths);
				console.log(`remove from localStorage: ${localIdx}`);
				ipcRenderer.send('electron-info', `[plugin] Removed local plugin path from localStorage: ${pluginPath}`);
			}
			else {
				ipcRenderer.send('electron-log', `[plugin] WARNING: Could not find local plugin path in localStorage: ${pluginPath}`);
			}

			let moduleIdx = pluginModule.plugins.findIndex((p) => path.normalize(p.path) === pluginPath);
			if (moduleIdx !== -1) {
				pluginModule.destoryPlugin(pluginModule.plugins[moduleIdx]);
				pluginModule.plugins.splice(moduleIdx, 1);
				console.log(`remove from plugins: ${moduleIdx}`);
				$bodyScope.$broadcast('UPDATE_PLUGIN_PANEL');
			}

			unregisterPluginExtensions(plugin);

			// 清理停用狀態
			delete pluginModule.disabledPluginMaps[plugin?.manifest?.id];
			pluginModule.saveDisabledPlugins();

			delete pluginModule.installedPluginMaps[plugin?.manifest?.id];
			pluginModule.unpinPlugin(plugin);
			pluginModule.refreshInstalledPlugins();
			$bodyScope.$broadcast("PLUGIN_UNINSTALL", plugin?.manifest?.id);
			currentWindow.webContents.send('plugin-uninstalled', plugin?.manifest?.id);
			ipcRenderer.send('plugin-uninstalled', plugin?.manifest?.id);
		},
	},
	orders: {
		save: (pluginPaths, startIndex) => {
			if (!pluginPaths) return;
			let pluginSortMap = {};
			if (localStorage['PLUGIN_ORDER']) {
				try {
					pluginSortMap = JSON.parse(localStorage['PLUGIN_ORDER']);
				}
				catch (err) {}
			}
			pluginPaths.forEach((pluginPath, index) => {
				pluginSortMap[pluginPath] = index + startIndex;
			});
			localStorage['PLUGIN_ORDER'] = JSON.stringify(pluginSortMap);
		},
		get: () => {
			let pluginSortMap = {};
			try {
				if (localStorage['PLUGIN_ORDER']) {
					let map = JSON.parse(localStorage['PLUGIN_ORDER']);
					pluginSortMap = map;
				}
			}
			catch (err) {}
			return pluginSortMap;
		}
	},
	pinPluginSortableOptions: {
		distance: 10,
		disabled: false,
		tolerance: "pointer",
		update: (e, ui) => {
			pluginModule.pinnedPlugins.forEach((plugin, index) => {
				pluginModule.pinnedPluginMaps[plugin.manifest.id] = index + 1;
			});
			try {
				localStorage['eagle.plugin.pinned'] = JSON.stringify(pluginModule.pinnedPluginMaps);
			}
			catch (err) {}
		},
	},
	pinPlugin: (plugin) => {
		const index = pluginModule.pinnedPlugins.length + 1;
		pluginModule.pinnedPluginMaps[plugin.manifest.id] = index;
		pluginModule.pinnedPlugins.push(plugin);
		try {
			localStorage['eagle.plugin.pinned'] = JSON.stringify(pluginModule.pinnedPluginMaps);
		}
		catch (err) {}
	},
	unpinPlugin: (plugin) => {
		delete pluginModule.pinnedPluginMaps[plugin.manifest.id];
		delete pluginModule.previewExtension.viewerPluginMap[plugin.manifest.id];
		delete pluginModule.previewExtension.thumbnailPluginMap[plugin.manifest.id];

		Object.keys(pluginModule.previewExtension.viewerPluginMap).forEach((ext) => {
			if (pluginModule.previewExtension.viewerPluginMap[ext].manifest.id === plugin.manifest.id) {
				delete pluginModule.previewExtension.viewerPluginMap[ext];
				delete pluginModule.previewExtension.viewerURL[ext];
				delete pluginModule.previewExtension.thumbnailPluginMap[ext];
				delete pluginModule.previewExtension.thumbnailPath[ext];
			}
		});

		// loop through all the plugins and remove the plugin from the pinnedPlugins array
		pluginModule.previewExtension.inspectorPluginsMap = Object.keys(pluginModule.previewExtension.inspectorPluginsMap).reduce((acc, ext) => {
			acc[ext] = pluginModule.previewExtension.inspectorPluginsMap[ext].filter((p) => {
				return p.manifest.id !== plugin.manifest.id;
			});
			return acc;
		}, {});

		pluginModule.pinnedPlugins = pluginModule.pinnedPlugins.filter((p) => {
			return p.manifest.id !== plugin.manifest.id;
		});

		try {
			localStorage['eagle.plugin.pinned'] = JSON.stringify(pluginModule.pinnedPluginMaps);
		}
		catch (err) {}
	},
	disablePlugin: (plugin) => {
		const pluginId = plugin?.manifest?.id;
		ipcRenderer.send('electron-info', `[plugin] Disable plugin: ${plugin?.manifest?.name}`);

		// 1. 關閉開啟中的視窗（含 service plugin）
		pluginModule.destoryPlugin(plugin);

		// 2. 移除 preview extension 註冊
		unregisterPluginExtensions(plugin);

		// 3. 取消釘選
		pluginModule.unpinPlugin(plugin);

		// 4. 移除快捷鍵
		delete pluginModule.pluginShortcuts[pluginId];

		// 5. 標記為停用並持久化
		pluginModule.disabledPluginMaps[pluginId] = true;
		pluginModule.saveDisabledPlugins();

		// 6. 刷新 UI
		$bodyScope.$broadcast('UPDATE_PLUGIN_PANEL');
		pluginModule.refreshInstalledPlugins();
		pluginModule.initMenu();
	},
	enablePlugin: (plugin) => {
		const pluginId = plugin?.manifest?.id;
		ipcRenderer.send('electron-info', `[plugin] Enable plugin: ${plugin?.manifest?.name}`);

		// 1. 移除停用標記
		delete pluginModule.disabledPluginMaps[pluginId];
		pluginModule.saveDisabledPlugins();

		// 2. 重新註冊 preview extensions
		registerPluginExtensions(plugin);

		// 3. 重新註冊快捷鍵
		pluginModule.initShortcuts();

		// 4. 若為 service plugin，重新啟動
		if (plugin.manifest?.main?.serviceMode) {
			create(plugin).then(() => {
				pluginModule.servicePlugins[pluginId] = true;
			});
		}

		// 5. 刷新 UI
		$bodyScope.$broadcast('UPDATE_PLUGIN_PANEL');
		pluginModule.refreshInstalledPlugins();
		pluginModule.initMenu();
	},
	reloadPlugin: (pluginPath) => {
		let idx = -1;
		let isServicePlugin = false;
		let oldPlugin = null;
		pluginModule.plugins.forEach((p, index) => {
			if (p.path === pluginPath) {
				idx = index;
				oldPlugin = p;
				// 記錄是否為服務插件
				isServicePlugin = p?.manifest?.main?.serviceMode;
				pluginModule.destoryPlugin(p);
			}
		});
		if (idx !== -1) {
			pluginModule.plugins.splice(idx, 1);
		}
		
		// 清理舊插件的相關資料
		if (oldPlugin) {
			delete oldPlugin.windowID;
			delete oldPlugin.webContentsID;
		}
		
		let newPlugin = loadPlugin(pluginPath);
		if (newPlugin) {
			pluginModule.plugins.push(newPlugin);
			delete pluginModule.needUpdatePluginMaps[newPlugin.manifest.id];
			$bodyScope.$broadcast('UPDATE_PLUGIN_PANEL');
			currentWindow.webContents.send('plugin-reloaded', newPlugin.manifest.id);
			
			// 如果是服務插件，自動重新初始化（包含首次安裝的情況）
			if (newPlugin?.manifest?.main?.serviceMode && !pluginModule.servicePlugins[newPlugin.manifest.id]) {
				ipcRenderer.send('electron-info', `[plugin] Reinitializing service plugin: ${newPlugin?.manifest?.name}`);
				create(newPlugin).then(() => {
					pluginModule.servicePlugins[newPlugin.manifest.id] = true;
					ipcRenderer.send('electron-info', `[plugin] Service plugin ${newPlugin?.manifest?.name} reinitialized successfully`);
				}).catch((err) => {
					ipcRenderer.send('electron-log', `[plugin] Failed to reinitialize service plugin: ${err}`);
				});
			}
		}
		pluginModule.needUpdatePluginCount = Object.keys(pluginModule.needUpdatePluginMaps).length;
		pluginModule.refreshInstalledPlugins();

		return newPlugin;
	},
	// * 從 .eagleplugin 安裝插件
	installPluginFromZip: (pluginZipPath) => {
		return new Promise(async (resolve, reject) => {
			try {
				ipcRenderer.send('electron-info', `[plugin] Install plugin from ${pluginZipPath}`);
				const extract = require('extract-zip');
				const extractPath = path.normalize(`${EAGLE_THUMBNAIL_TEMP_PATH}/${guid()}`);

				extract(pluginZipPath, {dir: extractPath, onEntry: function (entry, zipfile) {
					// console.log(entry.fileName);
				}}, async (err) => {
					if (err) { return reject(err); }
					try {
						const manifestPath = path.normalize(`${extractPath}/manifest.json`);
						const metadata = loadManifest(manifestPath);
						const pluginId = metadata.id;
						const dest = path.normalize(`${PLUGINS_PATH}/${pluginId}`);

						await copyDirectory(extractPath, dest);

						pluginModule.reloadPlugin(dest);
						currentWindow.webContents.send('plugin-installed', pluginId);
						ipcRenderer.send('plugin-installed', pluginId);
						ipcRenderer.send('electron-info', `[plugin] Install plugin success: ${extractPath}`);

						// 是否自動開啟 runAfterInstall
						// 服務插件已在 reloadPlugin 中透過 create() 初始化，不需要再 open
						const plugin = pluginModule.installedPluginMaps[metadata.id];
						if (plugin?.manifest?.main && plugin?.manifest?.main?.runAfterInstall && !plugin?.manifest?.main?.serviceMode) {
							pluginModule.open(plugin);
						}

						return resolve();
					}
					catch (err) {
						return reject(err);
					}
				});
			}
			catch (err) {
				return reject(err);
			}
		});
	},
	destoryPlugin: (plugin) => {
		try {
			clearKeepAliveTimer(plugin);

			if (plugin.windowID && remote.BrowserWindow.fromId(plugin.windowID)) {
				const bw = remote.BrowserWindow.fromId(plugin.windowID);

				// serviceMode / keepAlive 的 close 事件被攔截了，需移除監聽器才能銷毀
				if (plugin?.manifest?.main?.serviceMode || getKeepAliveTimeout(plugin.manifest) > 0) {
					bw.removeAllListeners('close');
				}
				bw.destroy();

				if (plugin?.manifest?.main?.serviceMode) {
					delete pluginModule.servicePlugins[plugin.manifest.id];
					ipcRenderer.send('electron-info', `[plugin] Service plugin ${plugin?.manifest?.name} forcefully destroyed and removed from service registry`);
				}
			}
			
			// 從 pluginWindowIds 中移除
			if (plugin.webContentsID) {
				const index = pluginModule.pluginWindowIds.indexOf(plugin.webContentsID);
				if (index > -1) {
					pluginModule.pluginWindowIds.splice(index, 1);
				}
			}
		}
		catch (err) {
			ipcRenderer.send('electron-log', `[plugin] Error destroying plugin: ${err.stack || err}`);
		}
	},
	packPlugin: async (src, dest) => {
		return new Promise((resolve, reject) => {
			try {
				const archiver = require('archiver');
				const archive = archiver('zip', {
					zlib: { level: 9, chunkSize: 16 * 1024 * 4 }
				});

				const output = fs.createWriteStream(dest);
				archive.pipe(output);
				archive.glob('**/*', {
					cwd: src,
					ignore: ['.git/**'] // Exclude .git folder
				});

				archive.on('error', (err) => {
					archive.abort();
					reject(err);
				});

				output.on('close', () => {
					resolve();
				});

				archive.finalize();
			}
			catch (err) {
				reject(err);
			}
		});
	},
	broadcast: broadcast,
	previewExtension: {
		viewerPluginMap: {},
		viewerURL: {},
		allowZoom: (ext) => {
			const plugin = pluginModule.previewExtension.viewerPluginMap[ext];
			if (!plugin?.manifest?.preview) return false;

			const keys = Object.keys(plugin?.manifest?.preview);
			for (const key of keys) {
				if (key.includes(ext)) {
					return plugin?.manifest?.preview[key]?.viewer?.allowZoom === true;
				}
			}
		},
		getViewerPlugin: (item) => {
			if (!item) return;
			if (pluginModule.previewExtension.viewerPluginMap[item?.ext]) {
				return pluginModule.previewExtension.viewerPluginMap[item?.ext];
			}
			return undefined;
		},
		getViewerPluginExt: (item) => {
			if (!item) return;
			if (pluginModule.previewExtension.viewerPluginMap[item?.ext]) {
				return 'plugin';
			}
            const IMAGE_TYPES = {
                'jpg': true,
                'jpeg': true,
                'png': true,
                'webp': true,
                'avif': true,
                'insp': true,
                'jfif': true,
                'jpe': true,
                'jxl': true,
                'bmp': true,
                'tif': true,
                'tiff': true,
				'hif': true,
				'heif': true,
				'heic': true,
            };
            if (IMAGE_TYPES[item?.ext]) {
                return 'image';
            }
			// if not support and has custom thumbnail
			if (item.customThumbnail && !EagleConfig.SUPPORT_FORMATS[item.ext]) {
				return 'custom';
			}
			return item?.ext;
		},
		getViewerPluginURL: (item) => {
			if (!item) return;
			let path = FileUrlHelper.getRawPath(item);
			let locale = preferences.general.language.replace("_", "-");
			let theme = $bodyScope.theme;
			return `${pluginModule?.previewExtension.viewerURL[item?.ext]}?id=${item.id}&path=${encodeURIComponent(path)}&width=${item.width}&height=${item.height}&lang=${locale}&theme=${theme}`;
		},
		thumbnailPluginMap: {},
		thumbnailPath: {},
		thumbnailOptions: {},
		hasInspectorPlugin: (item) => {
			let result = pluginModule.previewExtension.inspectorPluginsMap[item?.ext] ?? []
			result = result.filter((plugin) => {
				return pluginModule.installedPluginMaps[plugin.manifest.id];
			});
			return result.length > 0;
		},
		getInspectorPluginURL: (plugin, item) => {
			let path = FileUrlHelper.getRawPath(item);
			let locale = preferences.general.language.replace("_", "-");
			let theme = $bodyScope.theme;
			let inspectorViewerPath = URL_MODULE.pathToFileURL(pluginModule.previewExtension.inspectorPluginPathMap[plugin.manifest.id]).href;
			return `${inspectorViewerPath}?id=${item.id}&path=${encodeURIComponent(path)}&width=${item.width}&height=${item.height}&lang=${locale}&theme=${theme}`
		},
		getMultiSelectInspectorPlugin: (ext) => {
			const plugins = pluginModule.previewExtension.inspectorPluginsMap[ext];
			if (plugins) {
				return plugins.filter((plugin) => {
					const keys = Object.keys(plugin?.manifest?.preview);
					for (const key of keys) {
						if (key.includes(ext)) {
							return plugin?.manifest?.preview[key]?.inspector?.multiSelect === true;
						}
					}
				});
			}
			return [];
		},
		inspectorPluginsMap: {},
	},
	pluginMenu: new MenuItem({
		label: i18n.__('general.plugin'),
		submenu: []
	}),
};

module.exports = pluginModule;

// 初始化所有插件
// 載入 %appdata%/Eagle/Plugins 所有插件
async function init () {
	return new Promise((resolve, reject) => {
		pluginModule.previewExtension.thumbnailPluginMap = {};
		pluginModule.previewExtension.thumbnailPath = {};
		pluginModule.previewExtension.thumbnailOptions = {};
		pluginModule.previewExtension.viewerPluginMap = {};
		pluginModule.previewExtension.viewerURL = {};
		pluginModule.previewExtension.inspectorPlugins = [];
		pluginModule.previewExtension.inspectorPluginsMap = {};
		pluginModule.previewExtension.inspectorPluginPathMap = {};
		pluginModule.loadDisabledPlugins();
		pluginModule.initMenu();
		fs.readdir(PLUGINS_PATH, (err, directories) => {
			if (err) {
				// ipcRenderer.send('electron-log', "[plugin] " + err.stack || err);
				return resolve([]);
			}
			pluginModule.plugins = [];
            pluginModule.pluginWindowIds = [];
            pluginModule.pluginShortcuts = {};

			let allPlugins = [];
			let localPlugins = pluginModule.localPlugin.getPaths();
			
			directories.forEach((directory) => {
				allPlugins.push(path.normalize(`${PLUGINS_PATH}/${directory}`));
			});

			allPlugins = [...allPlugins, ...localPlugins];
			allPlugins = [...new Set(allPlugins)];

			let pluginSortMap = pluginModule.orders.get();
			allPlugins = allPlugins.sort((a, b) => {
				return pluginSortMap[a] - pluginSortMap[b];
			});

            allPlugins.forEach((pluginPath) => {
				const plugin = loadPlugin(pluginPath);
				if (plugin) {
					pluginModule.plugins.push(plugin);
				}
			});

			// 置顶插件
			try {
				pluginModule.pinnedPluginMaps = localStorage['eagle.plugin.pinned'] ? JSON.parse(localStorage['eagle.plugin.pinned']) : {};
				Object.keys(pluginModule.pinnedPluginMaps).forEach((pluginID) => {
					let plugin = pluginModule.plugins.find((plugin) => {
						return plugin?.manifest?.id === pluginID;
					});
					if (plugin && !pluginModule.isPluginDisabled(pluginID)) {
						pluginModule.pinnedPlugins.push(plugin);
					}
				});

				// sort by pluginModule.pinnedPluginMaps index
				pluginModule.pinnedPlugins = pluginModule.pinnedPlugins.sort((a, b) => {
					return pluginModule.pinnedPluginMaps[a.manifest.id] - pluginModule.pinnedPluginMaps[b.manifest.id];
				});
			}
			catch (err) {}

            pluginModule.initShortcuts();
			pluginModule.initMenu();

			ipcRenderer.send('plugin.loaded', {
				plugins: pluginModule.plugins,
				previewExtension: {
					thumbnailPluginMap: pluginModule.previewExtension.thumbnailPluginMap,
					thumbnailPath: pluginModule.previewExtension.thumbnailPath, 
					thumbnailOptions: pluginModule.previewExtension.thumbnailOptions, 
					viewerPluginMap: pluginModule.previewExtension.viewerPluginMap, 
					viewerURL: pluginModule.previewExtension.viewerURL,
					inspectorPlugins: pluginModule.previewExtension.inspectorPlugins,
					inspectorPluginsMap: pluginModule.previewExtension.inspectorPluginsMap,
					inspectorPluginPathMap: pluginModule.previewExtension.inspectorPluginPathMap,
				}
			});
			pluginModule.refreshInstalledPlugins();

			return resolve(pluginModule.plugins);
		});

	});
}

function getPluginTypes (plugin) {
	const USER_DATA_PATH = app.getPath('userData');
	const manifest = plugin.manifest;
	// 修正：indexOf 返回 -1 表示找不到，>= 0 表示找到
	// 開發插件是不在 USER_DATA_PATH 中的插件
	const isDevelopment = plugin.path.indexOf(USER_DATA_PATH) === -1;
	let types = [];
	
	// Check for service mode plugins
	const isServiceMode = manifest?.main?.serviceMode;
	if (isServiceMode) {
		types.push('service');
	}
	
	// 只有非服務插件才添加 window 類型
	if (manifest?.main && !isServiceMode) {
		types.push('window');
	}
	
	if (manifest?.preview) {
		const keys = Object.keys(manifest.preview);
		for (const key of keys) {
			if (key.includes(',')) {
				const exts = key.split(',').map((ext) => {
					return ext.trim();
				});
				exts.forEach((ext) => {
					if (manifest.preview[key].viewer || manifest.preview[key].thumbnail) {
						types.push('format');
					}
					if (manifest.preview[key].inspector) {
						types.push('inspector');
					}
				});
			}
			else {
				if (manifest.preview[key].viewer || manifest.preview[key].thumbnail) {
					types.push('format');
				}
				if (manifest.preview[key].inspector) {
					types.push('inspector');
				}
			}
		}
	}
	// like ffmpeg
	if (types.length === 0) {
		types.push('format');
	}

	// 是否為調試中的插件
	if (isDevelopment) {
		// 不要覆蓋原有的類型，而是添加 'development' 類型
		types.push('development');
	}

	// 去除重複
	return [...new Set(types)];
}

async function copyDirectory(src, dest) {
	// 檢查目標目錄是否存在，如果不存在則創建
	await fs.promises.mkdir(dest, { recursive: true });

	// 讀取源目錄中的所有文件和子目錄
	const entries = await fs.promises.readdir(src, { withFileTypes: true });

	// 遍歷每個條目（文件或子目錄）
	for (let entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			// 如果條目是目錄，遞迴地複製子目錄
			await copyDirectory(srcPath, destPath);
		} else {
			// 如果條目是文件，檢查文件是否需要覆蓋
			const [srcStat, destStat] = await Promise.all([
				fs.promises.stat(srcPath),
				fs.promises.stat(destPath).catch(() => null) // 如果目標文件不存在，返回 null
			]);

			// 只有當目標文件不存在或者源文件較新時才複製
			if (!destStat || srcStat.mtime > destStat.mtime) {
				await fs.promises.copyFile(srcPath, destPath);
			}
		}
	}
}

function unregisterPluginExtensions(plugin) {
	// 移除 inspector
	pluginModule.previewExtension.inspectorPlugins = pluginModule.previewExtension.inspectorPlugins.filter((p) => {
		return p.manifest.id !== plugin.manifest.id;
	});
	Object.keys(pluginModule.previewExtension.inspectorPluginsMap).forEach((ext) => {
		pluginModule.previewExtension.inspectorPluginsMap[ext] =
			pluginModule.previewExtension.inspectorPluginsMap[ext].filter((p) => p.manifest.id !== plugin.manifest.id);
	});
	delete pluginModule.previewExtension.inspectorPluginPathMap[plugin.manifest.id];

	// 移除 thumbnail/viewer
	Object.keys(pluginModule.previewExtension.thumbnailPluginMap).forEach((ext) => {
		if (pluginModule.previewExtension.thumbnailPluginMap[ext]?.manifest?.id === plugin.manifest.id) {
			delete pluginModule.previewExtension.thumbnailPluginMap[ext];
			delete pluginModule.previewExtension.thumbnailPath[ext];
			delete pluginModule.previewExtension.thumbnailOptions[ext];
			delete pluginModule.previewExtension.viewerPluginMap[ext];
			delete pluginModule.previewExtension.viewerURL[ext];
		}
	});
}

function registerPluginExtensions(plugin) {
	const manifest = plugin.manifest;
	const pluginPath = plugin.path;
	if (!manifest.preview) return;

	for (const extString in manifest.preview) {
		const previewPlugin = manifest.preview[extString];
		const exts = extString.split(',').map((ext) => ext.trim());

		exts.forEach((ext) => {
			if (previewPlugin?.thumbnail?.path) {
				pluginModule.previewExtension.thumbnailPluginMap[ext] = plugin;
				pluginModule.previewExtension.thumbnailPath[ext] = path.normalize(`${pluginPath}/${previewPlugin?.thumbnail?.path}`);
				pluginModule.previewExtension.thumbnailOptions[ext] = previewPlugin?.thumbnail;
			}
			else if (typeof previewPlugin?.thumbnail === 'string') {
				alert(`Can't init Plugin: "${manifest?.name}". Due to changes in the manifest.json, please refer to the following link to reset the setting parameters for the preview plugin: https://developer.eagle.cool/plugin-api/v/eagle-plugin-api/get-started/plugin-types/preview`);
			}

			if (previewPlugin?.viewer?.path) {
				pluginModule.previewExtension.viewerPluginMap[ext] = plugin;
				pluginModule.previewExtension.viewerURL[ext] = path.normalize(`${pluginPath}/${previewPlugin?.viewer?.path}`);
			}
			else if (typeof previewPlugin?.viewer === 'string') {
				alert(`Can't init Plugin: "${manifest?.name}". Due to changes in the manifest.json, please refer to the following link to reset the setting parameters for the preview plugin: https://developer.eagle.cool/plugin-api/v/eagle-plugin-api/get-started/plugin-types/preview`);
			}

			if (previewPlugin?.inspector?.path) {
				if (!pluginModule.previewExtension.inspectorPluginsMap[ext]) {
					pluginModule.previewExtension.inspectorPluginsMap[ext] = [];
				}
				if (pluginModule.previewExtension.inspectorPluginPathMap[plugin.manifest.id]) {
					pluginModule.previewExtension.inspectorPluginsMap[ext] = pluginModule.previewExtension.inspectorPluginsMap[ext].filter((p) => {
						return p.manifest.id !== plugin.manifest.id;
					});
				}
				pluginModule.previewExtension.inspectorPluginsMap[ext].push(plugin);
				pluginModule.previewExtension.inspectorPluginPathMap[plugin.manifest.id] = path.normalize(`${pluginPath}/${previewPlugin?.inspector?.path}`);
			}
		});

		pluginModule.previewExtension.inspectorPlugins = Object.keys(pluginModule.previewExtension.inspectorPluginsMap).map((ext) => {
			return pluginModule.previewExtension.inspectorPluginsMap[ext];
		});
		pluginModule.previewExtension.inspectorPlugins = [...new Set(pluginModule.previewExtension.inspectorPlugins.flat())];
	}
}

function loadPlugin (pluginPath) {
	const manifestPath = path.normalize(`${pluginPath}/manifest.json`);
	const localePath = path.normalize(`${pluginPath}/_locales`);

	ipcRenderer.send('electron-info', `[plugin] Init plugin: ${pluginPath}`);

	let manifest = loadManifest(manifestPath, localePath);
	if (manifest) {

		let plugin = {
			manifest: manifest,
			path: pluginPath,
			icon: URL_MODULE.pathToFileURL(`${pluginPath}/${manifest.logo}`).href,
		};

		plugin.types = getPluginTypes(plugin);

		// 背景模式
		// 移除此處的自動創建，改為在應用啟動時統一處理
		if (manifest.preview && !pluginModule.isPluginDisabled(manifest.id)) {
			registerPluginExtensions(plugin);
		}
		return plugin;
	}
	return undefined;
}

function initIPC () {

	ipcRenderer.on('enable-plugin', (e, pluginId) => {
		var plugin = pluginModule.plugins.find(function(p) { return p.manifest.id === pluginId; });
		if (plugin) {
			pluginModule.enablePlugin(plugin);
			currentWindow.webContents.send('plugin-enabled', pluginId);
			ipcRenderer.send('plugin-enabled', pluginId);
		}
	});

	ipcRenderer.on('open-plugin', (e, pluginId) => {
		if (pluginModule.installedPluginMaps[pluginId] && !pluginModule.isPluginDisabled(pluginId)) {
			pluginModule.openPluginById(pluginId, {});
		}
	});

	ipcRenderer.on('open-plugin-devtools', (e, pluginId) => {
		var plugin = pluginModule.installedPluginMaps[pluginId];
		if (plugin) {
			openDevTools(plugin);
		}
	});

	ipcRenderer.on('open-eagleplugin-file', (e, params) => {
		const pluginPath = params.path;
		const pluginName = path.parse(pluginPath).name;
		if (!fs.existsSync(pluginPath)) return;
		swal({
			html: `
				<div class="alert">
					<div class="alert-icon create"></div>
					<h4 class="alert-title">Install ${pluginName}?</h4>
				</div>
			`,
			showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
			width: 400,
			customClass: "alert-box",
			cancelButtonColor: "#777777",
			confirmButtonText: 'Install',
			cancelButtonText: i18n.__("general.cancel"),
		}).then(function () {
			$bodyScope.openPluginPanel();
			$bodyScope.$evalAsync();
			pluginModule.installPluginFromZip(pluginPath);
		});
	});

	ipcRenderer.on('file-save-success', function (e, item) {
		if (item && fileSaveItemMap[item.id]) {
			pluginModule.broadcast(`file-save-success-${item.id}`);
			delete fileSaveItemMap[item.id];
		}
	});

	ipcRenderer.on('file-save-fail', function (e, item) {
		if (item && fileSaveItemMap[item.id]) {
			pluginModule.broadcast(`file-save-fail-${item.id}`);
			delete fileSaveItemMap[item.id];
		}
	});

	ipcRenderer.on('file-uploaded', function (e, item) {
		if (item && fileUploadItemMap[item.id]) {
			pluginModule.broadcast(`file-add-success-${item.id}`);
			delete fileUploadItemMap[item.id];
		}
	});

	ipcRenderer.on('image-processing-error', function (e, item) {
		if (item && fileUploadItemMap[item.id]) {
			pluginModule.broadcast(`file-add-fail-${item?.object?.id}`);
			delete fileUploadItemMap[item.id];
		}
	});

	ipcRenderer.on('thumbnail-generated', function (e, item) {
		if (item && thumbnailGenerateItemMap[item.id]) {
			pluginModule.broadcast(`file-thumbnail-success-${item.id}`);
			delete thumbnailGenerateItemMap[item.id];
		}
	});

	ipcRenderer.on('custom-thumbnail-done', function (e, item) {
		pluginModule.broadcast(`file-add-success-${item.id}`);
	});

	ipcRenderer.on('change.current.theme', function (e, theme) {
		let themeName = theme.name;
		if (themeName === "Auto") {
			if (remote.nativeTheme.shouldUseDarkColors) {
                themeName = "GRAY";
            }
            else {
                themeName = "LIGHT";
            }
		}
		pluginModule.broadcast('theme-changed', themeName);
	});

	ipcRenderer.on('app-status-library-loaded', function (e, params) {
		pluginModule.broadcast('library-changed', path.normalize(params.rootDir));
	});

	ipcRenderer.on('app.getPath', (event, params) => {
		try {
			let name = params.data;
			let result = remote.app.getPath(name);
			ipcRenderer.sendTo(params.windowID, params.channel, result);
		}
		catch (err) {
			ipcRenderer.sendTo(params.windowID, params.channel, "");
		}
	});

	ipcRenderer.on('app.show', (event, params) => {
		try {
			currentWindow.show();
			ipcRenderer.sendTo(params.windowID, params.channel, true);
		}
		catch (err) {
			ipcRenderer.sendTo(params.windowID, params.channel, false);
		}
	});

	ipcRenderer.on('app.getFileIcon', async (event, params) => {
		try {
			let data = params.data;
			let path = data.path;
			let options = data.options;
			let nativeImg = await remote.app.getFileIcon(path, options);
			ipcRenderer.sendTo(params.windowID, params.channel, nativeImg);
		}
		catch (err) {
			ipcRenderer.sendTo(params.windowID, params.channel, err);
		}
	});

	ipcRenderer.on('app.createThumbnailFromPath', async (event, params) => {
		try {
			let data = params.data;
			let path = data.path;
			let maxSize = data.maxSize;
			let nativeImg = await remote.nativeImage.createThumbnailFromPath(path, maxSize);
			ipcRenderer.sendTo(params.windowID, params.channel, nativeImg);
		}
		catch (err) {
			ipcRenderer.sendTo(params.windowID, params.channel, err);
		}
	});

	const MAX_ARRAY_LENGTH = 1000;
	const MAX_STRING_LENGTH = 10000;

	registerHandler('item.add', async (options) => {
		const addPath = (filePath, id, name, websiteUrl, tags, annotation, star, modificationTime, folderIds) => {
			var fds = [];
			if (fs.statSync(filePath).isDirectory()) {
				throw Error('not support for directory');
			}
			else {
				fds = [{
					id: id,
					name: name || path.basename(filePath),
					url: websiteUrl || "",
					tags: tags || [],
					folders: folderIds || [],
					annotation: annotation || "",
					modificationTime: modificationTime || Date.now(),
					star: star || undefined,
					path: filePath,
				}];
			}
			$bodyScope.uploadFiles(fds, undefined);
		}

		const addURLs = (ids, imageUrls, names, websiteUrls, tags, annotations, modificationTimes, headers, folderIds) => {
			$bodyScope.uploadUrls(imageUrls, folderIds, {
				ids: ids,
				names: names,
				urls: websiteUrls,
				tags: tags,
				headers: headers,
				modificationTimes: modificationTimes,
				annotations: annotations
			});
			imageUrls.forEach(function () {
				$bodyScope.uploadQueue.push({});
			});
		}

		const addBookmark = (options) => {
			let url = options.bookmarkURL;
			let base64 = options.base64;
			let name = options.name || guid();
			let tags = options.tags || [];
			let annotation = options.annotation || '';
			let modificationTime = options.modificationTime;
			let folders = options.folders || [];

			name = name.substr(0, 255);
			name = sanitize(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();

			$bodyScope.showUploadQueue();
			$bodyScope.uploadQueue.push({});

			var data = {
				id: options.id,
				name: name,
				url: url,
				tags: tags || [],
				annotation: annotation || '',
				modificationTime: modificationTime || Date.now(),
				base64: base64,
				folders: folders || []
			};

			ipcRenderer.sendTo(backgroundWindowID, 'url-from-extension', data);
		};

		// ========== 批量模式 ==========
		if (Array.isArray(options.items)) {
			if (options.items.length > MAX_ARRAY_LENGTH) {
				throw new Error(`Batch limit exceeded: max ${MAX_ARRAY_LENGTH} items per request, got ${options.items.length}`);
			}
			let ids = [];
			options.items.forEach(item => {
				let id = item.id || guid();
				ids.push(id);

				let folderIds = item.folders || [];
				if (Array.isArray(folderIds)) {
					folderIds = folderIds.filter(fid => $bodyScope.folderMappings[fid]);
				}

				if (item.bookmarkURL !== undefined) {
					addBookmark({ ...item, id, folders: folderIds });
				} else if (item.base64 !== undefined) {
					addURLs([id], [item.base64], [item.name], [item.website], item.tags, [item.annotation], [item.modificationTime || Date.now()], [undefined], folderIds);
				} else if (item.url !== undefined) {
					let name = item.name || guid();
					name = name.substr(0, 128);
					name = sanitize(name).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
					addURLs([id], [item.url], [name], [item.website], item.tags, [item.annotation], [item.modificationTime || Date.now()], [item.headers], folderIds);
				} else if (item.path !== undefined) {
					addPath(item.path, id, item.name, item.website, item.tags, item.annotation, item.star, item.modificationTime || Date.now(), folderIds);
				}

				fileUploadItemMap[id] = true;
			});

			$bodyScope.showUploadQueue();
			return ids;
		}

		// ========== 單一模式（現有行為） ==========
		if (options.url === undefined && options.path === undefined &&
			options.base64 === undefined && options.bookmarkURL === undefined) {
			throw new Error('item.add requires at least one of: url, path, base64, bookmarkURL');
		}

		let { id, name, website, url, base64, path, tags, annotation, folders } = options;

		if (options.bookmarkURL !== undefined) {
			addBookmark(options);
		}
		else if (options.base64 !== undefined) {
			addURLs([id], [base64], [name], [website], tags, [annotation], [Date.now()], [undefined], folders);
		}
		else if (options.url !== undefined) {
			addURLs([id], [url], [name], [website], tags, [annotation], [Date.now()], [undefined], folders);
		}
		else if (options.path !== undefined) {
			addPath(path, id, name, website, tags, annotation, undefined, Date.now(), folders);
		}

		fileUploadItemMap[id] = true;

		return true;
	});

	bridgeIPC('item.add', false);

	registerHandler('item.open', async (data) => {
		let itemId = data.itemId;
		let window = data?.options?.window;
		let item = $bodyScope.itemMappings[itemId];
		if (item) {
			if (!window) {
				$bodyScope.openItemLocation(item, null);
			}
			else {
				openInNewWindow([item]);
			}
			return true;
		}
		return false;
	});

	bridgeIPC('item.open', false);

	registerHandler('item.select', async (data) => {
		let itemIds = data.itemIds ?? [];

		if (itemIds.length === 0) {
			return true;
		}

		let items = itemIds.reduce((acc, itemId) => {
			let item = $bodyScope.itemMappings[itemId];
			if (item) {
				acc.push(item);
			}
			return acc;
		}, []);

		$bodyScope.selected = items;
		$bodyScope.$evalAsync();
		return true;
	});

	bridgeIPC('item.select', false);

	registerHandler('item.setCustomThumbnail', async (data) => {
		let itemId = data.itemId;
		let item = $bodyScope.itemMappings[itemId];
		let filePath = data.filePath;

		ipcRenderer.sendTo(backgroundWindowID, 'set-custom-thumbnail', {
			item: item,
			thumbnailPath: filePath,
			width: data.width,
			height: data.height
		});

		return new Promise((resolve) => {
			let itemReceived = false;
			const responseCallback = (event, item) => {
				if (item && item.id === itemId) {
					itemReceived = true;
					ipcRenderer.off('thumbnail-generated', responseCallback);
					setTimeout(() => resolve(true), 300);
				}
			};
			ipcRenderer.on('thumbnail-generated', responseCallback);

			setTimeout(() => {
				if (!itemReceived) {
					ipcRenderer.off('thumbnail-generated', responseCallback);
					resolve(false);
				}
			}, 10000);
		});
	});

	bridgeIPC('item.setCustomThumbnail', false);

	registerHandler('item.refreshThumbnail', async (data) => {
		let itemId = data.itemId;
		let item = $bodyScope.itemMappings[itemId];
		if (item) {
			thumbnailGenerateItemMap[item.id] = true;
			ipcRenderer.send('regenerate-thumbnail', [item]);
			return true;
		}
		return false;
	});

	bridgeIPC('item.refreshThumbnail', false);

	registerHandler('item.save', async (data) => {
		if (typeof data?.name === 'string' && data.name.length > MAX_STRING_LENGTH) {
			throw new Error('name too long (max 10000)');
		}
		if (typeof data?.annotation === 'string' && data.annotation.length > MAX_STRING_LENGTH) {
			throw new Error('annotation too long (max 10000)');
		}

		let needReload = false;
		let needReloadTagManager = false;
		let item = $bodyScope.itemMappings[data?.id];
		if (!item) return false;
		fileSaveItemMap[item.id] = true;

		if (item.name !== data.name) {
			if (typeof data.name === 'string' && data.name.length > 0) {
				let originName = item.name;
				item.name = data.name;
				item.oldName = originName;
				item.newName = data.name;
			}
		}
		if (typeof data?.annotation === 'string') {
			item.annotation = data?.annotation;
		}
		if (typeof data?.url === 'string') {
			item.url = data?.url;
		}
		if (typeof data?.ext === 'string') {
			item.ext = data?.ext;
		}
		if (typeof data?.height === 'number') {
			item.height = data?.height;
		}
		if (typeof data?.width === 'number') {
			item.width = data?.width;
		}
		if (Array.isArray(data?.tags)) {
			item.tags = data?.tags;
			needReloadTagManager = true;
		}
		if (Array.isArray(data?.folders)) {
			const oldFolders = item.folders || [];
			const newFolders = data?.folders;
			if (oldFolders.length !== newFolders.length) {
				needReload = true;
			} else {
				const oldSet = new Set(oldFolders);
				if (!newFolders.every(id => oldSet.has(id))) {
					needReload = true;
				}
			}
			item.folders = newFolders;
		}
		if (typeof data?.star === 'number' && data?.star >= 0 && data?.star <= 5) {
			item.star = data?.star;
		}
		if (Number.isInteger(data?.modificationTime) && data?.modificationTime > 0) {
			item.modificationTime = data?.modificationTime;
		}
		if (typeof data?.noThumbnail === 'boolean') {
			item.noThumbnail = data?.noThumbnail;
		}
		if (typeof data?.noPreview === 'boolean') {
			item.noPreview = data?.noPreview;
		}

		if (typeof data?.isDeleted === 'boolean') {
			if (item.isDeleted !== data?.isDeleted) {
				needReload = true;
				item.isDeleted = data?.isDeleted;
				if (item.isDeleted) {
					const box = $("#box-" + item.id)?.[0];
					if (box) $bodyScope.$broadcast("gl:removeItems", [box])
				}
			}
		}

		setTimeout(() => {
			$bodyScope.updateItemListView(item);
			$bodyScope.updateSelection();
			}, 100);
		ayncsImagesChange([item]);

		if (needReload) {
			$bodyScope.calculateImageBinding({ ignoreSort: true }, function() {});
		}
		if (needReloadTagManager) {
			$bodyScope.TagManager.calculateTagsDebounce();
		}

		return item;
	});

	bridgeIPC('item.save', null);

	// ---- Comment CRUD ----

	registerHandler('item.getComments', async (data) => {
		if (!data || !data.id) throw Error('id is required');
		var item = $bodyScope.itemMappings[data.id];
		if (!item) throw Error('item not found: ' + data.id);
		return item.comments || [];
	});

	bridgeIPC('item.getComments', null);

	registerHandler('item.addComment', async (data) => {
		if (!data || !data.id) throw Error('id is required');
		var item = $bodyScope.itemMappings[data.id];
		if (!item) throw Error('item not found: ' + data.id);

		var hasDuration = typeof data.duration === 'number';
		var hasRect = typeof data.x === 'number' || typeof data.y === 'number' ||
			typeof data.width === 'number' || typeof data.height === 'number';

		if (hasDuration && hasRect) {
			throw Error('cannot have both duration and x/y/width/height');
		}
		if (!hasDuration && !hasRect) {
			throw Error('must provide either duration (video) or x/y/width/height (image)');
		}

		var comment = {
			id: guid(),
			annotation: '',
			lastModified: Date.now(),
		};

		if (hasDuration) {
			if (data.duration < 0) throw Error('duration must be >= 0');
			comment.duration = data.duration;
		} else {
			if (typeof data.x !== 'number' || typeof data.y !== 'number' ||
				typeof data.width !== 'number' || typeof data.height !== 'number') {
				throw Error('x, y, width, height must all be numbers');
			}
			if (data.width <= 0 || data.height <= 0) {
				throw Error('width and height must be > 0');
			}
			comment.x = Math.round(data.x);
			comment.y = Math.round(data.y);
			comment.width = Math.round(data.width);
			comment.height = Math.round(data.height);
		}

		if (typeof data.annotation === 'string') {
			if (data.annotation.length > MAX_STRING_LENGTH) {
				throw Error('annotation exceeds max length (' + MAX_STRING_LENGTH + ')');
			}
			comment.annotation = data.annotation;
		}

		if (!item.comments) item.comments = [];
		item.comments.push(comment);

		// 影片 comment 按 duration 排序
		if (hasDuration) {
			item.comments.sort(function (a, b) {
				var da = a.duration;
				var db = b.duration;
				if (da === undefined || db === undefined) return 0;
				if (da > db) return 1;
				if (da < db) return -1;
				return 0;
			});
		}

		ayncsImagesChange([item]);
		$bodyScope.$broadcast("REBIND_REFRESH", true);
		if (hasDuration) {
			$bodyScope.$broadcast("REFRESH_VIDEO_COMMENTS");
		}

		return comment;
	});

	bridgeIPC('item.addComment', null);

	registerHandler('item.updateComment', async (data) => {
		if (!data || !data.id) throw Error('id is required');
		if (!data.commentId) throw Error('commentId is required');
		var item = $bodyScope.itemMappings[data.id];
		if (!item) throw Error('item not found: ' + data.id);
		if (!item.comments || !item.comments.length) throw Error('no comments found');

		var comment = null;
		for (var i = 0; i < item.comments.length; i++) {
			if (item.comments[i].id === data.commentId) {
				comment = item.comments[i];
				break;
			}
		}
		if (!comment) throw Error('comment not found: ' + data.commentId);

		var isVideo = typeof comment.duration === 'number';

		if (typeof data.annotation === 'string') {
			if (data.annotation.length > MAX_STRING_LENGTH) {
				throw Error('annotation exceeds max length (' + MAX_STRING_LENGTH + ')');
			}
			comment.annotation = data.annotation;
		}

		if (isVideo) {
			if (typeof data.duration === 'number') {
				if (data.duration < 0) throw Error('duration must be >= 0');
				comment.duration = data.duration;
			}
			if (typeof data.x === 'number' || typeof data.y === 'number' ||
				typeof data.width === 'number' || typeof data.height === 'number') {
				throw Error('cannot set x/y/width/height on a video comment');
			}
		} else {
			if (typeof data.duration === 'number') {
				throw Error('cannot set duration on an image comment');
			}
			if (typeof data.x === 'number') comment.x = Math.round(data.x);
			if (typeof data.y === 'number') comment.y = Math.round(data.y);
			if (typeof data.width === 'number') {
				if (data.width <= 0) throw Error('width must be > 0');
				comment.width = Math.round(data.width);
			}
			if (typeof data.height === 'number') {
				if (data.height <= 0) throw Error('height must be > 0');
				comment.height = Math.round(data.height);
			}
		}

		comment.lastModified = Date.now();

		// 影片 comment 更新 duration 後重新排序
		if (isVideo && typeof data.duration === 'number') {
			item.comments.sort(function (a, b) {
				var da = a.duration;
				var db = b.duration;
				if (da === undefined || db === undefined) return 0;
				if (da > db) return 1;
				if (da < db) return -1;
				return 0;
			});
		}

		ayncsImagesChange([item]);
		$bodyScope.$broadcast("REBIND_REFRESH", true);
		if (isVideo) {
			$bodyScope.$broadcast("REFRESH_VIDEO_COMMENTS");
		}

		return comment;
	});

	bridgeIPC('item.updateComment', null);

	registerHandler('item.removeComment', async (data) => {
		if (!data || !data.id) throw Error('id is required');
		if (!data.commentId) throw Error('commentId is required');
		var item = $bodyScope.itemMappings[data.id];
		if (!item) throw Error('item not found: ' + data.id);
		if (!item.comments || !item.comments.length) throw Error('no comments found');

		var index = -1;
		for (var i = 0; i < item.comments.length; i++) {
			if (item.comments[i].id === data.commentId) {
				index = i;
				break;
			}
		}
		if (index === -1) throw Error('comment not found: ' + data.commentId);

		var isVideo = typeof item.comments[index].duration === 'number';
		item.comments.splice(index, 1);

		ayncsImagesChange([item]);
		$bodyScope.$broadcast("REBIND_REFRESH", true);
		if (isVideo) {
			$bodyScope.$broadcast("REFRESH_VIDEO_COMMENTS");
		}

		return true;
	});

	bridgeIPC('item.removeComment', null);

	registerHandler('item.countAll', async (data) => {
		return $bodyScope.raw.length;
	});

	bridgeIPC('item.countAll', 0);

	// 搜尋相關的核心函數
	// 轉義 RegEx 特殊字符
	function escapeRegex(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	// 解析包含 OR 語法和括號的關鍵字字串
	function parseKeywordsWithOR(keywordStr) {
		// 先處理括號表達式
		function parseWithParentheses(str) {
			// 標記化：將字串分解成 tokens
			function tokenize(input) {
				let tokens = [];
				let current = '';
				let inQuotes = false;
				let quoteChar = '';
				
				for (let i = 0; i < input.length; i++) {
					let char = input[i];
					let nextChar = input[i + 1];
					
					if (!inQuotes && (char === '"' || char === "'")) {
						inQuotes = true;
						quoteChar = char;
						current += char;
					} else if (inQuotes && char === quoteChar) {
						inQuotes = false;
						current += char;
						tokens.push(current);
						current = '';
					} else if (!inQuotes) {
						if (char === '(' || char === ')') {
							if (current.trim()) {
								tokens.push(current.trim());
								current = '';
							}
							tokens.push(char);
						} else if (char === '|' && nextChar === '|') {
							if (current.trim()) {
								tokens.push(current.trim());
								current = '';
							}
							tokens.push('OR');
							i++; // 跳過第二個 |
						} else if (char === ' ') {
							if (current.trim()) {
								// 檢查是否是 OR 或 or
								if (current.toUpperCase() === 'OR') {
									tokens.push('OR');
								} else {
									tokens.push(current.trim());
								}
								current = '';
							}
						} else {
							current += char;
						}
					} else {
						current += char;
					}
				}
				
				if (current.trim()) {
					if (current.toUpperCase() === 'OR') {
						tokens.push('OR');
					} else {
						tokens.push(current.trim());
					}
				}
				
				return tokens;
			}
			
			// 解析 tokens 成表達式樹
			function parseExpression(tokens) {
				let index = 0;
				
				function parseOr() {
					let left = parseAnd();
					
					while (index < tokens.length && tokens[index] === 'OR') {
						index++; // 消耗 OR
						let right = parseAnd();
						left = { type: 'OR', children: [left, right] };
					}
					
					return left;
				}
				
				function parseAnd() {
					let terms = [];
					
					while (index < tokens.length && tokens[index] !== 'OR' && tokens[index] !== ')') {
						if (tokens[index] === '(') {
							index++; // 消耗 (
							let expr = parseOr();
							if (index < tokens.length && tokens[index] === ')') {
								index++; // 消耗 )
							}
							terms.push(expr);
						} else {
							terms.push({ type: 'TERM', value: tokens[index] });
							index++;
						}
					}
					
					if (terms.length === 0) return null;
					if (terms.length === 1) return terms[0];
					return { type: 'AND', children: terms };
				}
				
				return parseOr();
			}
			
			let tokens = tokenize(str);
			return parseExpression(tokens);
		}
		
		// 將表達式樹轉換為扁平化的關鍵字陣列
		function flattenExpression(expr) {
			if (!expr) return [];
			
			if (expr.type === 'TERM') {
				return [expr.value];
			} else if (expr.type === 'OR') {
				// 收集所有 OR 的子項
				let orTerms = [];
				function collectOrTerms(node) {
					if (node.type === 'OR') {
						node.children.forEach(collectOrTerms);
					} else if (node.type === 'TERM') {
						orTerms.push(node.value);
					} else if (node.type === 'AND') {
						// OR 中包含 AND，整個 AND 群組作為一個單位
						// 例如: dog || (cat black) 中的 (cat black)
						let andTerms = [];
						node.children.forEach(child => {
							if (child.type === 'TERM') {
								andTerms.push(child.value);
							}
						});
						orTerms.push(andTerms.join(' ')); // 合併成一個字串
					}
				}
				collectOrTerms(expr);
				return [orTerms];
			} else if (expr.type === 'AND') {
				let result = [];
				expr.children.forEach(child => {
					let flattened = flattenExpression(child);
					result = result.concat(flattened);
				});
				return result;
			}
			
			return [];
		}
		
		// 使用新的解析器
		let expr = parseWithParentheses(keywordStr);
		let keywords = flattenExpression(expr);
		
		return keywords;
	}

	// 將關鍵字陣列轉換成多個 RegEx (簡化版本，去除繁簡體功能)
	function convertToRegexGroup(keywords) {
		const regexGroup = {
			mustMatch: [],      // AND 邏輯
			mustNotMatch: [],   // NOT 邏輯
			anyMatch: [],       // OR 邏輯
		};
		
		keywords.forEach((keyword) => {
			if (Array.isArray(keyword)) {
				// OR 群組
				const positives = [];
				const negatives = [];
				
				keyword.forEach((k) => {
					if (k.startsWith('-')) {
						// 處理負向條件
						let word = k.substring(1).replace(/"/g, '');
						negatives.push(word);
					} else if (k.startsWith('"') && k.endsWith('"')) {
						// OR 群組中的精確匹配暫時當作一般匹配處理
						let word = k.replace(/"/g, '');
						positives.push(word);
					} else {
						// 處理正向條件
						let word = k;
						positives.push(word);
					}
				});
				
				// 建立正向 OR 的 RegEx
				if (positives.length > 0) {
					const pattern = positives.map(escapeRegex).join('|');
					regexGroup.anyMatch.push(new RegExp(`(${pattern})`, 'i'));
				}
				
				// 負向條件單獨處理
				negatives.forEach(neg => {
					regexGroup.mustNotMatch.push(new RegExp(escapeRegex(neg), 'i'));
				});
				
			} else if (keyword.startsWith('-')) {
				// 單純 NOT
				let word = keyword.substring(1).replace(/"/g, '');
				regexGroup.mustNotMatch.push(new RegExp(escapeRegex(word), 'i'));
			} else {
				// 單純 AND
				let word = keyword.replace(/"/g, '');
				regexGroup.mustMatch.push(new RegExp(escapeRegex(word), 'i'));
			}
		});
		
		return regexGroup;
	}

	// 使用多個 RegEx 進行匹配
	function matchWithRegexGroup(text, regexGroup) {
		// 1. 所有 mustMatch 都必須匹配
		for (let regex of regexGroup.mustMatch) {
			if (!regex.test(text)) return false;
		}
		
		// 2. 所有 mustNotMatch 都不能匹配
		for (let regex of regexGroup.mustNotMatch) {
			if (regex.test(text)) return false;
		}
		
		// 3. 每個 anyMatch（OR群組）至少要有一個匹配
		for (let regex of regexGroup.anyMatch) {
			if (!regex.test(text)) return false;
		}
		
		// 如果沒有任何條件，或所有條件都通過
		return regexGroup.mustMatch.length > 0 || 
			   regexGroup.mustNotMatch.length > 0 || 
			   regexGroup.anyMatch.length > 0;
	}

	// 創建搜尋篩選器
	function createSearchFilter(query) {
		if (!query || query.trim() === '') {
			return () => true; // 沒有關鍵字時返回所有項目
		}
		
		// 解析關鍵字
		const keywords = parseKeywordsWithOR(query);
		const regexGroup = convertToRegexGroup(keywords);
		
		return function(item) {
			// 建構搜尋文字內容
			let allText = '';
			
			if (item.name) allText += `${item.name} `;
			if (item.annotation) allText += `${item.annotation} `;
			if (item.ext) allText += `.${item.ext} `;
			if (item.url) allText += `${item.url} `;
			if (item.text) allText += `${item.text} `;
			
			// 標籤搜尋
			if (item.tags && item.tags.length > 0) {
				item.tags.forEach(tag => {
					if (tag) allText += `${tag} `;
				});
			}
			
			// 資料夾搜尋
			if (item.folders && item.folders.length > 0) {
				item.folders.forEach(folderId => {
					const folder = $bodyScope.folderMappings[folderId];
					if (folder) {
						if (folder.name) allText += `${folder.name} `;
						if (folder.description) allText += `${folder.description} `;
					}
				});
			}
			
			// 標註
			if (item.comments) {
				item.comments.forEach(comment => {
					allText += `${comment.annotation} `;
				});
			}
			
			// 相機資訊
			if (item.rawMetas && item.rawMetas.camera) {
				allText += `${item.rawMetas.camera} `;
			}
			
			// 字體特殊處理
			if (item.ext && FONT_TYPES[item.ext] && item.fontMetas) {
				const fullName = item.fontMetas.fullName?.zh || item.fontMetas.fullName?.en || '';
				allText += `${fullName} `;
				
				if (item.fontMetas.postScriptName) {
					allText += `${JSON.stringify(item.fontMetas)} `;
				}
			}
			
			// 使用 RegEx 群組進行匹配
			const regexMatch = matchWithRegexGroup(allText.toLowerCase(), regexGroup);
			if (regexMatch) return true;
			
			// 否則使用 indexOf 進行簡單字串匹配
			return allText.toLowerCase().indexOf(query.toLowerCase()) > -1;
		};
	}

	registerHandler('item.query', async (data) => {
		data = data || {};
		let query = data.query;
		let items = [...$bodyScope.raw];

		if (query && query.trim() !== '') {
			const searchFilter = createSearchFilter(query);
			items = items.filter(searchFilter);
		}

		items = items.filter(item => !item?.isDeleted);
		return items;
	});

	bridgeIPC('item.query', []);

	registerHandler('item.get', async (data) => {
		for (const key of ['ids', 'keywords', 'tags', 'folders', 'fields', 'smartFolders']) {
			if (Array.isArray(data?.[key]) && data[key].length > MAX_ARRAY_LENGTH) {
				throw new Error(`${key} array too large (max ${MAX_ARRAY_LENGTH})`);
			}
		}

		let items = [...$bodyScope.raw];
		let keepSort = false;
		let fields = data.fields;

		if (typeof data?.isSelected === 'boolean') {
			items = $bodyScope.selected.slice(0);
			keepSort = true;
		}

		if (typeof data?.id === 'string') {
			const item = $bodyScope.itemMappings[data?.id];
			if (!item || item.isDeleted) return [];
			return [item];
		}

		if (Array.isArray(data?.ids)) {
			let idsMap = {};
			data?.ids.forEach((id) => { idsMap[id] = true; });
			items = items.filter((f) => {
				return idsMap[f?.id];
			});
		}

		if (typeof data?.isUnfiled === 'boolean') {
			items = items.filter((item) => {
				return item?.folders?.length === 0;
			});
		}

		if (typeof data?.isUntagged === 'boolean') {
			items = items.filter((item) => {
				return !item.tags || item.tags.length === 0;
			});
		}

		let smartFolder = {
			"name": "api search",
			conditions: [{
				rules: [],
				"match": "AND",
			}]
		};

		if (Array.isArray(data?.keywords)) {
			data?.keywords.forEach((keyword) => {
				smartFolder.conditions[0].rules.push({
					property: "name",
					method: "contain",
					value: keyword
				});
			});
		}

		if (Array.isArray(data?.tags)) {
			smartFolder.conditions[0].rules.push({
				property: "tags",
				method: "intersection",
				value: data?.tags
			});
		}

		if (Array.isArray(data?.folders)) {
			smartFolder.conditions[0].rules.push({
				property: "folders",
				method: "intersection",
				value: data?.folders
			});
		}

		if (typeof data?.ext === 'string') {
			smartFolder.conditions[0].rules.push({
				property: "type",
				method: "equal",
				value: data?.ext.toLowerCase(),
			});
		}

		if (typeof data?.annotation === 'string') {
			smartFolder.conditions[0].rules.push({
				property: "annotation",
				method: "contain",
				value: data?.annotation,
			});
		}

		if (typeof data?.url === 'string') {
			smartFolder.conditions[0].rules.push({
				property: "url",
				method: "contain",
				value: data?.url,
			});
		}

		if (typeof data?.shape === 'string') {
			smartFolder.conditions[0].rules.push({
				property: "shape",
				method: "equal",
				value: data?.shape,
			});
		}

		if (typeof data?.rating === 'number') {
			smartFolder.conditions[0].rules.push({
				property: "rating",
				method: "equal",
				value: `${data?.rating}`,
			});
		}

		items = items.filter((item) => {
			return !item?.isDeleted;
		});

		if (data?.smartFolders) {
			let raw = data.smartFolders;
			if (typeof raw === 'string') {
				try { raw = JSON.parse(raw); } catch {}
			}
			let sfIds = Array.isArray(raw) ? raw : [raw];
			let sfList = [];
			for (let sfId of sfIds) {
				let sf = $bodyScope.smartFolderMappings[sfId];
				if (!sf) throw new Error('smart folder not found: ' + sfId);
				sfList.push(sf);
			}
			items = items.filter(item => sfList.some(sf => $bodyScope.existInSmartFilter(sf, item)));
		}

		items = items.filter(function (item) {
			return $bodyScope.existInSmartFilter(smartFolder, item);
		});

		if (!keepSort) {
			items = $bodyScope.sortData(items, 'CREATEDATE');
		}

		let result = items;
		if (fields) {
			result = items.map((item) => {
				let newItem = {};
				fields.forEach((field) => {
					newItem[field] = item[field];
				});
				return newItem;
			});
		}

		return result;
	});

	bridgeIPC('item.get', []);

	registerHandler('folder.create', async (data) => {
		let folderName = data.name;
		let description = data.description;
		let parent = data.parent;
		if (!folderName) {
			return false;
		}
		if (folderName.length > MAX_STRING_LENGTH) {
			throw new Error('name too long (max 10000)');
		}
		var folder = {
			id: data.id || guid(),
			name: folderName,
			description: description || "",
			images: [],
			folders: [],
			modificationTime: Date.now(),
			imagesMappings: {},
			tags: [],
			children: [],
			isExpand: true,
		};
		if (data.iconColor) {
			folder.iconColor = data.iconColor;
		}
		if (parent && $bodyScope.folderMappings[parent]) {
			$bodyScope.folderMappings[parent].children.push(folder);
		}
		else {
			$bodyScope.folders.splice($bodyScope.folders.length, 0, folder);
		}
		$bodyScope.folderMappings[folder.id] = folder;
		$bodyScope.updateSidebarList();
		$bodyScope.addToRecentFolders([folder.id]);
		$bodyScope.calculateImageBinding({ ignoreSort: true });
		$bodyScope.saveFolder();
		return folder;
	});

	bridgeIPC('folder.create', false);

	registerHandler('folder.open', async (data) => {
		let folder = $bodyScope.folderMappings[data?.folderId];
		if (folder) {
			$bodyScope.openFolder(folder);
			$bodyScope.$evalAsync();
			return true;
		}
		return false;
	});

	bridgeIPC('folder.open', false);

	registerHandler('folder.save', async (data) => {
		if (typeof data?.name === 'string' && data.name.length > MAX_STRING_LENGTH) {
			throw new Error('name too long (max 10000)');
		}
		if (typeof data?.description === 'string' && data.description.length > MAX_STRING_LENGTH) {
			throw new Error('description too long (max 10000)');
		}

		let folder = $bodyScope.folderMappings[data?.id];
		if (!folder) return undefined;

		folder.name = data?.name || folder.name;
		folder.description = data?.description ?? folder.description;
		folder.tags = data?.tags || folder.tags;

		if (data?.iconColor !== folder.iconColor) {
			folder.iconColor = data?.iconColor;
		}

		if (data?.parent !== folder.parent) {
			const newParentId = (data?.parent ?? null);
			let ok = true;

			if (newParentId === folder.id) {
				ok = false;
			}

			let newParent = null;
			if (ok && newParentId != null) {
				newParent = $bodyScope.folderMappings[newParentId];
				if (!newParent) ok = false;
			}

			if (ok && newParentId != null) {
				const newParentAncestors = $bodyScope.getAncestorFolders(newParent, []);
				if (newParentAncestors.some(f => f.id === folder.id)) {
					ok = false;
				}
			}

			if (ok && folder.parent === newParentId) {
				ok = false;
			}

			if (ok) {
				if (folder.parent != null) {
					const oldParent = $bodyScope.folderMappings[folder.parent];
					if (oldParent && Array.isArray(oldParent.children)) {
						oldParent.children = oldParent.children.filter(c => c.id !== folder.id);
					}
				} else if (Array.isArray($bodyScope.folders)) {
					$bodyScope.folders = $bodyScope.folders.filter(c => c.id !== folder.id);
				}

				if (newParentId) {
					folder.parent = newParentId;
				}
				else {
					delete folder.parent;
				}

				if (newParentId != null) {
					if (newParent && Array.isArray(newParent.children)) {
						if (!newParent.children.some(c => c.id === folder.id)) {
							newParent.children.push(folder);
						}
					}
				} else if (Array.isArray($bodyScope.folders)) {
					if (!$bodyScope.folders.some(c => c.id === folder.id)) {
						$bodyScope.folders.push(folder);
					}
				}
			}
		}
		$bodyScope.updateSidebarList();
		$bodyScope.calculateImageBinding({ ignoreSort: true });
		$bodyScope.saveFolder();

		return folder;
	});

	bridgeIPC('folder.save', null);

	registerHandler('folder.get', async (data) => {
		let folders = [];
		if (
			data?.isRecent ||
			typeof data?.id === 'string' ||
			Array.isArray(data?.ids) ||
			typeof data?.isSelected === 'boolean'
		) {
			eagle.utils.tree.walk($bodyScope.folders, 'children', function (folder, parent, depth) {
				folders.push(folder);
			});
		}
		else {
			folders = $bodyScope.folders;
		}

		let result = folders.slice(0);
		if (data?.isRecent) {
			let recentFolders = $bodyScope.getRecentFolders();
			result = recentFolders.slice(0);
		}
		if (typeof data?.id === 'string') {
			result = result.filter((f) => {
				return f?.id === data?.id
			});
		}
		if (Array.isArray(data?.ids)) {
			let idsMap = {};
			data?.ids.forEach((id) => { idsMap[id] = true; });
			result = result.filter((f) => {
				return idsMap[f?.id];
			});
		}
		if (typeof data?.isSelected === 'boolean') {
			let selectedFolders = angular.element("html").scope().selectedFolders;
			if (selectedFolders.length === 0 && $bodyScope.currentFolder) {
				selectedFolders = [$bodyScope.currentFolder];
			}
			let idsMap = {};
			selectedFolders.forEach((f) => { idsMap[f.id] = true; });
			result = result.filter((f) => {
				return idsMap[f?.id];
			});
		}
		return result;
	});

	bridgeIPC('folder.get', []);

	registerHandler('tag.get', async (data) => {
		let result = [...$bodyScope.tags];
		if (data?.name) {
			result = result.filter((tag) => {
				const lowerName = tag.name.toLowerCase();
				const lowerSearch = data.name.toLowerCase();
				return lowerName.indexOf(lowerSearch) !== -1;
			});
		}
		return result;
	});

	bridgeIPC('tag.get', []);

	registerHandler('tag.save', async (data) => {
		if (!data?.originalName) return undefined;
		const originalName = data.originalName;
		const name = data.name;
		if (typeof name === 'string' && name.length > MAX_STRING_LENGTH) {
			throw new Error('name too long (max 10000)');
		}

		// 找出需要修改的標籤
		const tag = $bodyScope.TagManager.tagMappings[originalName];

		// 異常或找不到
		if (!tag) {
			return undefined;
		}

		// 更改標簽名稱
		if (name && originalName && originalName !== name) {
			const changed = [];
			for (let rindex = $bodyScope.raw.length - 1; rindex >= 0; rindex--) {
				try {
					let item = $bodyScope.raw[rindex];
					let needUpadate = false;
					if (item?.tags) {
						item.tags.forEach((tag, index) => {
							if (tag === originalName) {
								item.tags[index] = name;
								needUpadate = true;
							}
						});
						if (needUpadate) {
							item.tags = [...new Set(item.tags)];
							changed.push(item);
						}
					}
				}
				catch (err) {}
			}

			// 修改标签群组包含的标签
			if ($bodyScope.TagManager.groups.length > 0) {
				$bodyScope.TagManager.groups.forEach(function (group) {
					if (group.tags) {
						if (group?.tags) {
							let needUpadate = false;
							group.tags.forEach((tag, index) => {
								if (tag === originalName) {
									group.tags[index] = name;
									needUpadate = true;
								}
							});
							if (needUpadate) {
								group.tags = [...new Set(group.tags)];
								$bodyScope.TagManager.save();
							}
						}
					}
				});
			}

			$bodyScope.updateSelection();
			ayncsImagesChange(changed);

			tag.name = name;
		}

		$bodyScope.TagManager.calculateTags();
		$bodyScope.TagManager.renderTagsResult();
		return tag;
	});

	bridgeIPC('tag.save', undefined);

	registerHandler('tag.getRecentTags', async (data) => {
		const tags = $bodyScope.TagManager.historyTags.map((tag) => {
			return $bodyScope.TagManager.tagMappings[tag];
		}).filter((tag) => {
			return !!tag;
		});
		return tags || [];
	});

	bridgeIPC('tag.getRecentTags', []);

	registerHandler('tag.getStarredTags', async (data) => {
		const tags = $bodyScope.TagManager.starredTags.map((tag) => {
			return $bodyScope.TagManager.tagMappings[tag];
		}).filter((tag) => {
			return !!tag;
		});
		return tags || [];
	});

	bridgeIPC('tag.getStarredTags', []);

	registerHandler('tagGroup.get', async (data) => {
		return $bodyScope.TagManager.groups;
	});

	bridgeIPC('tagGroup.get', []);

	registerHandler('tagGroup.save', async (data) => {
		if (!data?.id) return undefined;
		if (typeof data?.name === 'string' && data.name.length > MAX_STRING_LENGTH) {
			throw new Error('name too long (max 10000)');
		}
		if (typeof data?.description === 'string' && data.description.length > MAX_STRING_LENGTH) {
			throw new Error('description too long (max 10000)');
		}
		const tagGroup = $bodyScope.TagManager.groups.find((group) => {
			return group.id === data.id;
		});

		if (tagGroup) {
			tagGroup.name = data.name ?? tagGroup.name;
			tagGroup.tags = data.tags ?? tagGroup.tags;
			tagGroup.color = data.color ?? tagGroup.color;
			tagGroup.description = data.description ?? tagGroup.description;
			$bodyScope.TagManager.calculateTags();
			$bodyScope.TagManager.saveGroup();
			$bodyScope.$evalAsync();
		}

		return tagGroup;
	});

	bridgeIPC('tagGroup.save', null);

	registerHandler('tagGroup.remove', async (data) => {
		const tagGroup = $bodyScope.TagManager.groups.find((group) => {
			return group.id === data.id;
		});

		if (!tagGroup) return false;

		$bodyScope.TagManager.removeGroup(tagGroup.id);
		$bodyScope.$evalAsync();

		return true;
	});

	bridgeIPC('tagGroup.remove', false);

	registerHandler('tagGroup.create', async (data) => {
		if (!data?.name) return false;
		if (data.name.length > MAX_STRING_LENGTH) throw new Error('name too long (max 10000)');
		const tagGroup = $bodyScope.TagManager.createGroupWithTags(data.name, data.tags, data.color, data.description);
		$bodyScope.$evalAsync();
		return tagGroup;
	});

	bridgeIPC('tagGroup.create', null);

	// tagGroup.addTags - 增量添加標籤到群組
	registerHandler('tagGroup.addTags', async (data) => {
		const { groupId, tags, removeFromSource } = data;
		if (!Array.isArray(tags)) throw new Error('tagGroup.addTags requires "tags" array');
		if (tags.length > MAX_ARRAY_LENGTH) throw new Error('tags array too large (max 1000)');

		const tagGroup = $bodyScope.TagManager.groups.find((group) => {
			return group.id === groupId;
		});

		if (!tagGroup) {
			return undefined;
		}

		$bodyScope.TagManager.addTagsToGroup(groupId, tags, !removeFromSource);
		$bodyScope.TagManager.calculateTags();
		$bodyScope.$evalAsync();

		const updatedGroup = $bodyScope.TagManager.groups.find((group) => {
			return group.id === groupId;
		});
		return updatedGroup;
	});

	bridgeIPC('tagGroup.addTags', undefined);

	// tagGroup.removeTags - 從群組移除標籤
	registerHandler('tagGroup.removeTags', async (data) => {
		const { groupId, tags } = data;
		if (!Array.isArray(tags)) throw new Error('tagGroup.removeTags requires "tags" array');
		if (tags.length > MAX_ARRAY_LENGTH) throw new Error('tags array too large (max 1000)');

		const tagGroup = $bodyScope.TagManager.groups.find((group) => {
			return group.id === groupId;
		});

		if (!tagGroup) {
			return undefined;
		}

		tags.forEach((tag) => {
			const idx = tagGroup.tags.indexOf(tag);
			if (idx !== -1) {
				tagGroup.tags.splice(idx, 1);
				if ($bodyScope.TagManager.tagMappings[tag]?.color) {
					delete $bodyScope.TagManager.tagMappings[tag].color;
				}
			}
		});

		$bodyScope.TagManager.calculateTags();
		$bodyScope.TagManager.saveGroup();
		$bodyScope.$evalAsync();

		return tagGroup;
	});

	bridgeIPC('tagGroup.removeTags', undefined);

	// tag.merge - 合併標籤
	registerHandler('tag.merge', async (data) => {
		const { source, target } = data;
		if (!source || !target) throw new Error('tag.merge requires "source" and "target"');
		if (source === target) throw new Error('tag.merge: source and target must be different');

		const sourceTag = $bodyScope.TagManager.tagMappings[source];
		if (!sourceTag) {
			return undefined;
		}

		const targetTag = $bodyScope.TagManager.tagMappings[target];
		if (!targetTag) {
			return undefined;
		}

		let affectedItems = 0;
		const changed = [];

		for (let i = $bodyScope.raw.length - 1; i >= 0; i--) {
			try {
				const item = $bodyScope.raw[i];
				if (item?.tags) {
					const sourceIdx = item.tags.indexOf(source);
					if (sourceIdx !== -1) {
						const targetIdx = item.tags.indexOf(target);
						if (targetIdx === -1) {
							item.tags[sourceIdx] = target;
						} else {
							item.tags.splice(sourceIdx, 1);
						}
						item.tags = [...new Set(item.tags)];
						changed.push(item);
						affectedItems++;
					}
				}
			} catch (err) {
				console.error(err);
			}
		}

		$bodyScope.TagManager.groups.forEach((group) => {
			if (group.tags) {
				const sourceIdx = group.tags.indexOf(source);
				if (sourceIdx !== -1) {
					const targetIdx = group.tags.indexOf(target);
					if (targetIdx === -1) {
						group.tags[sourceIdx] = target;
					} else {
						group.tags.splice(sourceIdx, 1);
					}
					group.tags = [...new Set(group.tags)];
				}
			}
		});

		const starredIdx = $bodyScope.TagManager.starredTags?.indexOf(source) ?? -1;
		if (starredIdx !== -1) {
			const targetIdx = $bodyScope.TagManager.starredTags.indexOf(target);
			if (targetIdx === -1) {
				$bodyScope.TagManager.starredTags[starredIdx] = target;
			} else {
				$bodyScope.TagManager.starredTags.splice(starredIdx, 1);
			}
		}

		const historyIdx = $bodyScope.TagManager.historyTags?.indexOf(source) ?? -1;
		if (historyIdx !== -1) {
			const targetIdx = $bodyScope.TagManager.historyTags.indexOf(target);
			if (targetIdx === -1) {
				$bodyScope.TagManager.historyTags[historyIdx] = target;
			} else {
				$bodyScope.TagManager.historyTags.splice(historyIdx, 1);
			}
		}

		if (changed.length > 0) {
			ayncsImagesChange(changed);
		}

		$bodyScope.TagManager.calculateTags();
		$bodyScope.TagManager.saveGroup();
		$bodyScope.TagManager.save();
		$bodyScope.updateSelection();
		$bodyScope.$evalAsync();

		return {
			affectedItems: affectedItems,
			sourceRemoved: true
		};
	});

	bridgeIPC('tag.merge', undefined);

	registerHandler('library.info', async (data) => {
		let library = {};
		if (decodeURI($bodyScope.rootDir)) {
			try {
				let metadataPath = `${decodeURI($bodyScope.rootDir)}/metadata.json`;
				let libraryJSON = fs.readFileSync(metadataPath, 'utf8');
				library = JSON.parse(libraryJSON);
				library.path = $bodyScope.libraryPath;
				library.name = $bodyScope.libraryName;
			}
			catch (err) {}
		}
		return library;
	});

	bridgeIPC('library.info', null);

	registerHandler('library.history', async (data) => {
		let libraryHistory = electronSettings.getSync('libraryHistory');
		if (!libraryHistory || !Array.isArray(libraryHistory)) return [];
		libraryHistory = libraryHistory.map((history) => {
			try { return path.normalize(history); }
			catch (err) { return history; }
		});
		return [...new Set(libraryHistory)];
	});

	bridgeIPC('library.history', []);

	registerHandler('library.switch', async (data) => {
		let libraryPath = data.libraryPath;
		if (!libraryPath || !fs.existsSync(libraryPath)) {
			throw new Error('Library does not exist.');
		}
		$bodyScope.openLibrary(path.normalize(libraryPath));
		return true;
	});

	bridgeIPC('library.switch', false);

	registerHandler('library.icon', async (data) => {
		let libraryPath = data.libraryPath;
		if (!libraryPath || !fs.existsSync(libraryPath)) {
			throw new Error('Library does not exist.');
		}
		let iconPath = path.join(libraryPath, 'icon.png');
		if (!fs.existsSync(iconPath)) {
			throw new Error('Library icon does not exist.');
		}
		return fs.readFileSync(iconPath);
	});

	bridgeIPC('library.icon', null);

	// ========== App Info Handler (V2 API) ==========

	registerHandler('app.info', async (data) => {
		const pjson = require(appRoot + '/package.json');
		return {
			version: pjson.version,
			prereleaseVersion: pjson.prerelease ?? null,
			buildVersion: pjson.buildVersion ?? null,
			platform: process.platform,
		};
	});

	// ========== AI Search Plugin API ==========

	registerHandler('aiSearch.isInstalled', async (data) => {
		return eagle?.aiSearch?.isInstalled ?? false;
	});

	bridgeIPC('aiSearch.isInstalled', false);

	registerHandler('aiSearch.isReady', async (data) => {
		return eagle?.aiSearch?.isReady ?? false;
	});

	bridgeIPC('aiSearch.isReady', false);

	registerHandler('aiSearch.isStarting', async (data) => {
		return eagle?.aiSearch?.isStarting ?? false;
	});

	bridgeIPC('aiSearch.isStarting', false);

	registerHandler('aiSearch.isSyncing', async (data) => {
		return eagle?.aiSearch?.isSyncing ?? false;
	});

	bridgeIPC('aiSearch.isSyncing', false);

	registerHandler('aiSearch.open', async (data) => {
		eagle?.aiSearch?.open();
		return true;
	});

	bridgeIPC('aiSearch.open', false);

	registerHandler('aiSearch.checkServiceHealth', async (data) => {
		return await eagle?.aiSearch?.checkServiceHealth();
	});

	bridgeIPC('aiSearch.checkServiceHealth', false);

	registerHandler('aiSearch.getSyncStatus', async (data) => {
		return await eagle?.aiSearch?.getSyncStatus();
	});

	bridgeIPC('aiSearch.getSyncStatus', null);

	// 將 AI Search 結果轉換成包含完整 Item 物件的格式
	function convertAISearchResults(result, limit) {
		if (!result || !result.results) return result;

		let convertedResults = result.results.map(searchItem => {
			const fullItem = $bodyScope.itemMappings[searchItem.id];
			if (fullItem) {
				return {
					item: fullItem,
					score: searchItem.score
				};
			}
			return null;
		}).filter(item => item !== null); // 過濾掉找不到的項目

		// 根據 limit 參數限制結果數量
		if (limit && limit > 0) {
			convertedResults = convertedResults.slice(0, limit);
		}

		return {
			...result,
			results: convertedResults
		};
	}

	registerHandler('aiSearch.searchByText', async (data) => {
		const { query, options } = data || {};
		const result = await eagle?.aiSearch?.searchByText(query, options);
		return convertAISearchResults(result, options?.limit);
	});

	bridgeIPC('aiSearch.searchByText', (err) => ({ error: err.message, code: err.code }));

	registerHandler('aiSearch.searchByBase64', async (data) => {
		const { base64, options } = data || {};
		const result = await eagle?.aiSearch?.searchByBase64(base64, options);
		return convertAISearchResults(result, options?.limit);
	});

	bridgeIPC('aiSearch.searchByBase64', (err) => ({ error: err.message, code: err.code }));

	registerHandler('aiSearch.searchByItemId', async (data) => {
		const { itemId, options } = data || {};
		const result = await eagle?.aiSearch?.searchByItemId(itemId, options);
		return convertAISearchResults(result, options?.limit);
	});

	bridgeIPC('aiSearch.searchByItemId', (err) => ({ error: err.message, code: err.code }));

	// Smart Folder handlers (extracted module)
	initSmartFolderHandlers();
}

function loadManifest (manifestPath, localePath) {
	try {
		if (fs.existsSync(manifestPath)) {
			let manifestJSON = fs.readFileSync(manifestPath, "utf8");
			let manifest = JSON.parse(manifestJSON);
			if (localePath && manifest.languages && fs.existsSync(localePath)) {
				const appLang = preferences.general.language;
				let lang;
				if (manifest.languages.includes(appLang)) {
					lang = appLang;
				}
				else {
					lang = manifest.fallbackLanguage;
				}
				let string = JSON.stringify(manifest);
				let i18nJSON = fs.readFileSync(path.normalize(`${localePath}/${lang}.json`), "utf8");
				let i18n = JSON.parse(i18nJSON);
				try {
					let matches = string.match(/{{(.*?)}}/gm);
					matches.forEach(function (match) {
						let key = match.replaceAll("{{", "").replaceAll("}}", "");
						string = string.replaceAll(match, _.get(i18n, key));
					});
					manifest = JSON.parse(string);
				}
				catch (err) {
					ipcRenderer.send('electron-log', "[plugin] " + err.stack || err);
				}
			}
			return manifest;
		}
	}
	catch (err) {
		ipcRenderer.send('electron-info', "[plugin] " + err.stack || err);
        let $filter = angular.element(document.body).injector().get('$filter');
        let desc = $filter('i18n')('dialog.loadPluginError.desc', [
            { "property": "manifestPath", "value": manifestPath },
            { "property": "err", "value": err.stack || err },
        ]);
		return;
	}
}

// ── keepAlive 工具函式 ──────────────────────────────────────

function getKeepAliveTimeout(manifest) {
	const val = manifest?.main?.keepAlive;
	if (val === true) return 5 * 60 * 1000; // 預設 5 分鐘
	if (typeof val === 'number' && val > 0) return val;
	return 0;
}

function startKeepAliveTimer(plugin) {
	const timeout = getKeepAliveTimeout(plugin.manifest);
	if (timeout <= 0) return;

	clearKeepAliveTimer(plugin);

	pluginModule.keepAliveTimers[plugin.manifest.id] = setTimeout(() => {
		ipcRenderer.send('electron-info',
			`[plugin] KeepAlive timeout for ${plugin?.manifest?.name}, destroying window`);
		pluginModule.destoryPlugin(plugin);
	}, timeout);
}

function clearKeepAliveTimer(plugin) {
	const id = plugin?.manifest?.id;
	if (pluginModule.keepAliveTimers[id]) {
		clearTimeout(pluginModule.keepAliveTimers[id]);
		delete pluginModule.keepAliveTimers[id];
	}
}

function repositionToCursor(browserWindow) {
	const EDGE_PADDING = 20;
	const CURSOR_OFFSET = 8;
	const cursorPoint = remote.screen.getCursorScreenPoint();
	const display = remote.screen.getDisplayNearestPoint(cursorPoint);
	const { workArea } = display;

	const [winWidth, winHeight] = browserWindow.getSize();

	let x = cursorPoint.x + CURSOR_OFFSET;
	if (x + winWidth > workArea.x + workArea.width - EDGE_PADDING) {
		x = cursorPoint.x - winWidth - CURSOR_OFFSET;
	}

	let y = cursorPoint.y;
	if (y + winHeight > workArea.y + workArea.height - EDGE_PADDING) {
		y = (workArea.y + workArea.height - EDGE_PADDING) - winHeight;
	}

	x = Math.max(x, workArea.x + EDGE_PADDING);
	y = Math.max(y, workArea.y + EDGE_PADDING);

	browserWindow.setPosition(x, y);
}

// keepAlive 外掛 crash 清理
ipcRenderer.on('plugin-keepalive-crashed', (event, { pluginId }) => {
	const plugin = pluginModule.installedPluginMaps[pluginId];
	if (plugin) {
		clearKeepAliveTimer(plugin);
		plugin.windowID = null;
		plugin.webContentsID = null;
	}
});

// ── 外掛窗口建立與管理 ──────────────────────────────────────

async function create (plugin, args = {}) {
	return new Promise(async (resolve, reject) => {
		ipcRenderer.send('electron-info', `[plugin] Create plugin: ${plugin?.manifest?.name}`);
		let result = await ipcRenderer.invoke('create-plugin-window', { plugin, args });
		plugin.windowID = result.windowID;
		plugin.webContentsID = result.webContentsID;
        pluginModule.pluginWindowIds.push(plugin.webContentsID);
		return resolve(plugin.windowID);
	});
}

function open (plugin, args = {}) {
	if (pluginModule.isPluginDisabled(plugin?.manifest?.id)) {
		let icon = URL_MODULE.pathToFileURL(`${plugin.path}/${plugin.manifest.logo}`).href;
		let theme = ($bodyScope.theme === 'light' || $bodyScope.theme === 'lightgray') ? 'light' : 'dark';
		swal({
			html: `
				<div class="alert">
					<div class="alert-icon" style="background-image: url('${icon}')">
						<img class="status" style="width: 20px; height: 20px;" src="assets/images/${theme}/icons/ic-plugin-install-modal-uninstall.svg">
					</div>
					<h4 class="alert-title">${i18n.__('dialog.plugin.enablePlugin.title')}</h4>
					<p class="alert-desc">${i18n.__('dialog.plugin.enablePlugin.desc')}</p>
				</div>
			`,
			showCloseButton: false, showConfirmButton: true, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
			width: 400,
			customClass: "alert-box large",
			cancelButtonColor: "#777777",
			confirmButtonText: i18n.__('dialog.plugin.enablePlugin.btn'),
			cancelButtonText: i18n.__("general.cancel"),
		}).then(function () {
			pluginModule.enablePlugin(plugin);
			pluginModule.open(plugin, args);
		});
		return;
	}
	try {
		ipcRenderer.send('electron-info', `[plugin] Open plugin: ${plugin?.manifest?.name}[${plugin?.manifest?.version}]`);

		const lostDependenies = pluginModule.checkDependencies(plugin.manifest);
		if (lostDependenies.length > 0) return;

		// 記錄在 lastOpenedPlugins 中
		pluginModule.addToLastOpenedPlugins(plugin);

        if (plugin?.manifest?.main?.multiple) {
            console.log("create plugin")
			create(plugin, args).then(() => {
				let browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
				if (plugin?.manifest?.main?.show !== false) {
					browserWindow.show();
				}
				browserWindow.webContents.send('plugin-run', { args, ...plugin });
			});
        }
		else if (!plugin.windowID || !remote.BrowserWindow.fromId(plugin.windowID)) {
			console.log("create plugin")
			clearKeepAliveTimer(plugin);
			create(plugin, args).then(() => {
				let browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
				// keepAlive：註冊 hide/show 監聽器來控制銷毀計時器
				if (getKeepAliveTimeout(plugin.manifest) > 0) {
					browserWindow.on('hide', () => startKeepAliveTimer(plugin));
					browserWindow.on('show', () => clearKeepAliveTimer(plugin));
				}
				if (plugin?.manifest?.main?.show !== false) {
					browserWindow.show();
				}
				browserWindow.webContents.send('plugin-run', { args, ...plugin });
			});
		}
		else {
			// 窗口已存在（keepAlive 快取或普通重複開啟）
			clearKeepAliveTimer(plugin);
			let browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
			// followCursor：重新定位到游標附近
			if (plugin?.manifest?.main?.followCursor) {
				repositionToCursor(browserWindow);
			}
			if (plugin?.manifest?.main?.show !== false) {
				browserWindow.show();
			}
			browserWindow.webContents.send('plugin-run', { args, ...plugin });
		}
	}
	catch (err) {
		ipcRenderer.send('electron-log', "[plugin] " + err.stack || err);
	}
}

function close (plugin) {
	try {
		// ipcRenderer.send('electron-info', `[plugin] Close plugin: ${plugin?.manifest?.name}`);
		let browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
		if (!browserWindow && browserWindow.isDestroyed()) return;
		browserWindow.close();
	}
	catch (err) {
		ipcRenderer.send('electron-log', "[plugin] " + err.stack || err);
	}
}

function openDevTools (plugin) {
	let browserWindow = remote.BrowserWindow.fromId(plugin.windowID);
	if (!browserWindow && browserWindow.isDestroyed()) return;
	browserWindow.webContents.openDevTools();
}

function broadcast (event, params) {
	const windows = BrowserWindow.getAllWindows();
	windows.forEach((window) => {
		if (window.id !== currentWindow.id) {
			window.webContents.send(event, params);
		}
	});

	$("plugin-view webview, inspector-plugin-view webview").each(function () {
		let webview = $(this)[0];
		webview.send(event, params);
	});
}

// 初始化服務插件（只在應用啟動時調用）
function initServicePlugins() {
	pluginModule.plugins.forEach((plugin) => {
		if (plugin?.manifest?.main?.serviceMode && !pluginModule.isPluginDisabled(plugin.manifest.id)) {
			// 檢查是否已經初始化過
			if (!pluginModule.servicePlugins[plugin.manifest.id]) {
				ipcRenderer.send('electron-info', `[plugin] Init service plugin: ${plugin?.manifest?.name}`);
				create(plugin).then(() => {
					pluginModule.servicePlugins[plugin.manifest.id] = true;
				}).catch((err) => {
					ipcRenderer.send('electron-log', `[plugin] Failed to init service plugin: ${err}`);
				});
			}
		}
	});
}