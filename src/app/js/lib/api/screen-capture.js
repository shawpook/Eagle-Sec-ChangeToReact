class ScreenCapture {
    
    #isScreenCapturing;
    
	constructor() {
        this.#isScreenCapturing = false;
    }

    async capture({ mode, item }) {

        if (this.#isScreenCapturing) {
            ipcRenderer.send('electron-info', `[bg] ignore screencapture, because the last operation not finsihed.`);
            return;
        }

        const id = guid();
        const format = preferences.screencapture.format || "png"
        const quality = preferences?.screencapture?.quality ? (preferences.screencapture.quality / 100) : 0.9;
        const tempPath = `${EAGLE_THUMBNAIL_TEMP_PATH}/${id}.png`;
        const currentDisplay = await ipcRenderer.invoke('screen.getCursorDisplay');
        const isRetina = (currentDisplay.scaleFactor == 2);

        ipcRenderer.send('electron-info', `[bg] Start screencapture, mode: ${mode}, path: ${tempPath}`);
        analytics.event("Screenshot", "Create", mode);

        try {
            switch (mode) {
                // 全螢幕模式
                case 3:
                    await this.#captureFullScreen({ format, tempPath });
                    break;
                // 區域截圖或選定範圍
                default:
                    await this.#captureSpecific({ mode, format, tempPath, quality });
                    break;
            }
            return await this.createItem({ tempPath, mode, item, isRetina, format, quality });
        }
        catch (err) {
            ipcRenderer.send('electron-log', "[bg] Screenshot fail, path: " + tempPath);
            ipcRenderer.send('electron-log', err.stack || err);
        }
    }

    async createItem({ tempPath, mode, item, isRetina, format, quality }) {

        if (!tempPath) return;
        if (!item) item = {};

        const usingRetina = preferences.screencapture.useRetina === 'true';
        const needResize = !usingRetina && isRetina;
        const needFormatConvert = format !== 'png';

        // 統一在這裡處理格式轉換和 Retina 縮放，只調用一次 compressWithCanvas
        if (needResize || needFormatConvert) {
            const img = nativeImage.createFromPath(tempPath);
            if (img && !img.isEmpty()) {
                const w = img.getSize().width;
                const h = img.getSize().height;
                // 如果需要縮放，使用較短邊的一半作為 maxSize；否則不縮放
                const maxSize = needResize ? Math.floor(Math.min(w, h) / 2) : undefined;
                const outputFormat = format === 'png' ? 'image/png' : (format === 'webp' ? 'image/webp' : 'image/jpeg');
                const outputQuality = quality || 0.9;
                const tmp = `${tempPath}.tmp`;

                await new Promise((resolve) => {
                    compressWithCanvas(tempPath, tmp, outputFormat, outputQuality, maxSize, (err) => {
                        try {
                            if (fs.existsSync(tmp)) {
                                fse.removeSync(tempPath);
                                fse.moveSync(tmp, tempPath, { overwrite: true });
                            }
                        }
                        catch (err) {}
                        resolve();
                    });
                });
            }
        }
    
        const name = item.name ?? "Screenshot - " + require('moment')().format("YYYY-MM-DD HH.mm.ss");
        const url = item.website ?? "";
        let tags = item.tags ?? [];
        const annotation = item.annotation ?? "";
        const folders = item.folders ?? [];
        const star = item.star ?? false;
    
        if (preferences.screencapture.autoTagging.enable != 'false') {
            if (tags.length === 0) {
                tags = ['Screenshot'];
            }
        }
    
        if (preferences.screencapture.autoWriteClipboard != 'false') {
            clipboard.writeImage(nativeImage.createFromPath(tempPath));
        }
    
        const result = {
            id: guid(),
            name: name || id,
            url: url,
            tags: tags,
            folders: folders || [],
            annotation: annotation || "",
            path: tempPath,
            modificationTime: Date.now()
        };

        if (star) {
            result.star = star;
        }

        return result;
    }

    async #captureFullScreen({ format, tempPath }) {
        return new Promise(async (resolve, reject) => {
            try {
                const desktopCapturer = {
                    getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
                };

                const thumbSize = await determineScreenShotSize();
                const currentDisplay = await ipcRenderer.invoke('screen.getCursorDisplay');

                let options = { types: ['screen'], thumbnailSize: thumbSize };
                
                desktopCapturer.getSources(options).then((sources) => {
                    this.#isScreenCapturing = false;
                    sources.forEach(async (dataSource) => {
                        const name = dataSource.name.toLowerCase();
                        if (sources.length === 1 || name === 'entire screen' || name === '整个屏幕' || name === 'screen 1' || `${currentDisplay?.id}` === dataSource?.display_id) {

                            // 統一輸出 PNG，格式轉換在 createItem 中處理
                            const buffer = dataSource.thumbnail.toPNG();
                            try {
                                await fs.promises.writeFile(tempPath, buffer);
                                resolve();
                            }
                            catch (err) {
                                ipcRenderer.send('electron-log', err.stack || err);
                            }
                        }
                    })
                })

                async function determineScreenShotSize() {
                    try {
                        var currentDisplay = await ipcRenderer.invoke('screen.getCursorDisplay');
                        const screenSize = currentDisplay.workAreaSize;
                        const maxDimension = Math.max(screenSize.width, screenSize.height);
                        return {
                            width: parseInt(maxDimension * window.devicePixelRatio),
                            height: parseInt(maxDimension * window.devicePixelRatio)
                        }
                    }
                    catch (err) {
                        ipcRenderer.send('electron-log', `function determineScreenShotSize error...`);
                        ipcRenderer.send('electron-log', err.stack || err);
                    }
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', err.stack || err);
                this.#isScreenCapturing = false;
            }
        });
    }

    async #captureSpecific({ format, quality, mode, tempPath }) {
        if (process.platform === 'darwin') {
            await this.#captureSpecificMac({ format, quality, mode, tempPath });
        }
        else {
            await this.#captureSpecificWindows({ format, quality, mode, tempPath });
        }
    }

    async #captureSpecificMac({ format, mode, quality, tempPath }) {
        return new Promise(async (resolve, reject) => {
            // 統一輸出 PNG，格式轉換在 createItem 中處理
            const screenCaptureWithCommand = async ({ filePath, mode }) => {
                return new Promise((resolve, reject) => {
                    const command = (mode === 1) ? `screencapture -x -i -o -t png '${filePath}'` : `screencapture -x -w -o -t png '${filePath}'`;
                    const exec = require('child_process').exec;
                    exec(command, (err) => {
                        if (err) {
                            ipcRenderer.send('electron-log', `[bg] screencapture error: ${err}`);
                            reject(err);
                        }

                        resolve(filePath);
                    });
                });
            };

            try {
                const filePath = await screenCaptureWithCommand({
                    filePath: tempPath,
                    mode: mode
                });

                if (!fs.existsSync(filePath)) return reject(new Error(`ENOENT: no such file or directory, open '${tempPath}'`));
                
                resolve(filePath);
            }
            catch (err) {
                ipcRenderer.send('electron-log', err.stack || err);
                reject(err);
            }
        });
    }

    async #captureSpecificWindows({ format, quality, tempPath }) {
        return new Promise((resolve, reject) => {

            const md5 = require('md5');
            const now = new Date();
            const year = now.getFullYear();
            const mouth = now.getMonth() + 1;
            const date = now.getDate();
            const key = `niuniu_app_eagle_${year}${mouth}${date}`;
            const md5Key = md5(key);

            let iniPath;
            switch(preferences.general.language) {
                case "zh_CN":
                    iniPath = path.normalize(dllRoot + "/capture-zh_CN.ini");
                    break;
                case "zh_TW":
                    iniPath = path.normalize(dllRoot + "/capture-zh_TW.ini");
                    break;
                default:
                    iniPath = path.normalize(dllRoot + "/capture-en.ini");
            }

            const screenShotExePath = path.normalize(`${dllRoot}/NiuniuCapture.exe`);
            const screenShotParams = [md5Key + ',' + path.normalize(tempPath) + `,0,0,0,0,0,0,` + iniPath];

            this.#isScreenCapturing = true;

            // 如果 NiuniuCapture.exe 不存在，則不進行截圖
            if (!fs.existsSync(screenShotExePath)) {
                this.#isScreenCapturing = false;
                ipcRenderer.send('electron-log', `[bg] NiuniuCapture.exe does not exist: ${screenShotExePath}`);
                ipcRenderer.send('show-swal', {
                    title: i18n.__('Dialog.NiunNiuMissing.title'),
                    button: i18n.__("general.ok"),
                    description: i18n.__('Dialog.NiunNiuMissing.desc').replace("{screenShotExePath}", screenShotExePath)
                });
                return reject(new Error(`ENOENT: no such file or directory, open '${screenShotExePath}'`));
            }

            execFile(screenShotExePath, screenShotParams, (err, result) => {
                ipcRenderer.send('electron-info', `[bg] NiuniuCapture.exe callback`);
                
                this.#isScreenCapturing = false;

                if (!fs.existsSync(tempPath)) return reject(new Error(`ENOENT: no such file or directory, open '${tempPath}'`));

                // 格式轉換在 createItem 中統一處理
                resolve(tempPath);
            })
        });
    }

}

eagle.screenCapture = new ScreenCapture();