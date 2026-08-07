const electron = require('electron');
let remote;
// 表示在 main
if (electron.app) {
    remote = require("@electron/remote/main");
}
else {
    remote = require('@electron/remote');
}
const app = electron.app || remote.app;
const fs = require('fs');
const PLUGINS_PATH = require("path").normalize(`${app.getPath('userData')}/Plugins`);
const os = (process.platform === 'win32')? 'win' : 'mac';
const arch = (process.arch === 'x64')? 'x64' : 'arm64';
let extraModule = {
    ffmpeg: {},
    ai: {},
    aiSearch: {}
};

(() => {
    const moduleName = `ffmpeg-${os}-${arch}`;
    const modulePath = require("path").normalize(`${PLUGINS_PATH}/${moduleName}`)
    const ipcRenderer = electron.ipcRenderer;
    const FFmpegModule = {
        name: "FFmpeg",
        moduleName: moduleName,
        modulePath: modulePath,
        isInstalled: function () {
            return fs.existsSync(this.modulePath);
        },
        getPaths: function () {

            if (!FFmpegModule.isInstalled()) {
                return {
                    ffmpeg: "",
                    ffprobe: ""
                };
            }

            if (process.platform === 'win32') {
                return {
                    ffmpeg: require("path").normalize(`${modulePath}/ffmpeg.exe`),
                    ffprobe: require("path").normalize(`${modulePath}/ffprobe.exe`)
                };
            }
            else {
                return {
                    ffmpeg: require("path").normalize(`${modulePath}/ffmpeg`),
                    ffprobe: require("path").normalize(`${modulePath}/ffprobe`)
                };
            }
        },
        install: function ({currentWindow}) {
            const pluginId = moduleName;
            const sender = currentWindow?.webContents || ipcRenderer;
            sender.send('install-plugin', pluginId);
        }
    }
    extraModule.ffmpeg = FFmpegModule;
})();

(() => {
    const moduleName = `ai-sdk`;
    const modulePath = require("path").normalize(`${PLUGINS_PATH}/${moduleName}`)
    const ipcRenderer = electron.ipcRenderer;
    const AIModule = {
        name: "AI SDK",
        moduleName: moduleName,
        modulePath: modulePath,
        isInstalled: function () {
            return fs.existsSync(this.modulePath);
        },
        install: function ({currentWindow}) {
            const pluginId = moduleName;
            const sender = currentWindow?.webContents || ipcRenderer;
            sender.send('install-plugin', pluginId);
        },
        open: function ({ currentWindow }) {
            const pluginId = moduleName;
            const sender = currentWindow?.webContents || ipcRenderer;
            sender.send('open-plugin', pluginId);
        },
    }
    extraModule.ai = AIModule;
})();

(() => {
    const moduleName = `ai-search`;
    const modulePath = require("path").normalize(`${PLUGINS_PATH}/${moduleName}`)
    const ipcRenderer = electron.ipcRenderer;
    const AISearchModule = {
        name: "AI Search",
        moduleName: moduleName,
        modulePath: modulePath,
        isInstalled: function () {
            return fs.existsSync(this.modulePath);
        },
        install: function ({currentWindow}) {
            const pluginId = moduleName;
            const sender = currentWindow?.webContents || ipcRenderer;
            sender.send('install-plugin', pluginId);
        },
        open: function ({ currentWindow }) {
            const pluginId = moduleName;
            const sender = currentWindow?.webContents || ipcRenderer;
            sender.send('open-plugin', pluginId);
        },
    }
    extraModule.aiSearch = AISearchModule;
})();

module.exports = extraModule;