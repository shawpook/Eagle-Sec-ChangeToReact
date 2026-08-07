const appRoot = require('app-root-path');
const path = require('path');
const ipcRenderer = require('electron').ipcRenderer;

ipcRenderer.on('update-preferences', function () {
    var oldPreferences = preferences;
    preferences = settings.getPreferences();

    if (
        preferences.autoImport.enable != oldPreferences.autoImport.enable || 
        preferences.autoImport.path != oldPreferences.autoImport.path
    ) {
        if (preferences.autoImport.enable === 'true') {
            AutoImport.watch(library);
        }
        else {
            AutoImport.stop();
        }
    }
});

var AutoImport = {
    watchPath: "",
    lock: {},
    watcher: undefined,
    build: function () {
        var watchPath = this.watchPath;
        if (!watchPath) return;
        // 判断监测路径是否存在
        if (!fs.existsSync(watchPath)) {
            fs.mkdirSync(watchPath);
            ipcRenderer.send('electron-info', `[bg] Build Auto-import folder: ${watchPath}`);
        }
    },
    isFileCopied: function (path, prev, threshold, callback) {
        var that = this;
        setTimeout(function () {
            fs.stat(path, function (err, stat) {
                if (err) { return callback(err); }
                console.log(`now: ${stat.mtimeMs}`);
                console.log(`prev: ${prev.mtimeMs}`);
                if (threshold >= 6) {
                    return callback();
                }
                if (stat.mtimeMs && stat.mtimeMs === prev.mtimeMs) {
                    threshold++;
                }
                else {
                    threshold = 0;
                }
                console.log(threshold)
                that.isFileCopied(path, stat, threshold, callback);
            });
        }, 500);
    },
    drain: function () {
        var that = this;
        const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([\*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu;
        var watchPath = this.watchPath;
        var count = 0;
        var filenames = fs.readdirSync(watchPath);

        filenames = filenames.filter(function (filename) {
            if (filename.indexOf(".tmp") > -1) {
                return false;
            }
            return !that.lock[filename];
        });

        filenames.forEach(function (filename) {
            try {
                if (that.lock[filename]) return;
                var filePath = path.normalize(`${watchPath}/${filename}`);
                if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { return; }
                var excludeExt = { url: true }
                var ext = getExt({ path: filePath });
                if (!ext || excludeExt[ext]) return;
                if (!EagleConfig.SUPPORT_FORMATS[ext] && !pluginModule?.previewExtension.thumbnailPluginMap[ext]) return;

                let minSize = 1000;
                if (ext === 'svg') minSize = 1;
                if (fs.statSync(filePath).size <= minSize) {
                    return;
                }
                that.lock[filename] = true;
                count++;
                AutoImport.isFileCopied(filePath, fs.statSync(filePath), 0, function (err) {
                    if (err) return;
                    let fileName = filename.replace(/%/g, "").replace(emojiRegex, '');
                    fileName = path.parse(fileName).name;
                    let file = {
                        id: guid(),
                        name: fileName,
                        path: filePath,
                        type: ext,
                        tags: [],
                        url: "",
                        modificationTime: Date.now(),
                        folders: []
                    };
                    var source = tokenSource();
                    var token = source.token;
                    taskTokens.push(source);
                    uploadFileQueue([file], 0, token);
                    ipcRenderer.send("add-download-task-end");
                    ipcRenderer.send('electron-info', `[bg] Auto-import ${filePath}`);
                });
            }
            catch (err) {}
        });
        if (count > 0) {
            setTimeout(() => {
                if (preferences.notification.notification.enable !== 'false' && preferences.notification.notification.when.autoImport === 'true') {
                    const mute = preferences.notification.soundEffect.enable !== 'true';
                    ipcRenderer.send('notification', {
                        mute: mute,
                        progress: false,
                        title: i18n.__("progress.autoImport.title"),
                        description: count + i18n.__("progress.autoImport.desc"),
                    });
                }
                ipcRenderer.send('electron-info', `[bg] Auto-import ${count} file(s) to library.`);
            }, 1500);
        }
    },
    initWatcher: function () {
        var that = this;
        var watchPath = this.watchPath;

        that.lock = {};
        that.watcher = fs.watch(watchPath, debounce((event, filename) => {
            that.drain();
        }, 500));

        ipcRenderer.send('electron-info', `[bg] Start watching auto-import path: ${watchPath}`);
    },
	watch: (library) => {
		console.log("watchAutoImport");
	
		if (!library || !library.rootDir) return;
		if (preferences.autoImport.enable !== 'true') return;
	
		let autoImportPath = preferences.autoImport.path;
		let libraryName = path.basename(library.rootDir).replace('.library', '');
		let watchPath = path.normalize(`${autoImportPath}/${libraryName}`);
	
		// 如果 watchPath 消失，应提示用户
		if (!fs.existsSync(autoImportPath)) {
			ipcRenderer.send('show-swal', {
				title: i18n.__("dialog.autoImport.title"),
				description: i18n.__("dialog.autoImport.desc") + autoImportPath + i18n.__("dialog.autoImport.desc2"),
				button: i18n.__("general.ok")
			});
			return;
		}
	
		AutoImport.stop();
		AutoImport.watchPath = watchPath;
		AutoImport.build();
		AutoImport.initWatcher();
		setTimeout(function () {
			AutoImport.drain();
		}, 2500);
	},
    stop: function () {
        if (!this.watcher) return;
        this.watcher && this.watcher.close();
        ipcRenderer.send('electron-info', `[bg] Stop watching auto-import`);
    },
    resumeWatcher: function () {
        this.initWatcher();
    }
}


module.exports = AutoImport;