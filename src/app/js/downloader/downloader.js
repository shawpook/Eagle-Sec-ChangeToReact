const async = require('async');
const path = require('path');
const fs = require('fs');
const ipcRenderer = require('electron').ipcRenderer;

class Downloader {

    constructor() {
        const downloadQueueLength = (preferences.download && preferences.download.queueLength) || 5;
        this.queue = async.queue(async.timeout((task, callback) => {
            this.downloadQueueCallback(task, callback);
        }, 300000), downloadQueueLength);
    }

    downloadQueueCallback(task, callback) {
        (async () => {
            try {
                // TODO: 實做轉大圖功能
                let item;
                
                // 嘗試轉大圖下載
                task.item.large = true;

                const isBase64 = task.item.url && task.item.url.indexOf("data:") !== -1;
                if (!isBase64) {
                    item = await this.downloadLargeImage(task);
                    if (item) {
                        console.log("转大图成功", item);
                    }
                    else {
                        delete task.item.large;
                        console.log("转大图失败");
                    }
                }
                
                // 若無大圖或失敗，就下載原圖
                if (!item) {
                    item = await this.startDownload(task.item, task.cancellationToken);
                }

                // 通知下載完成
                if (task.needNotify) {
                    const mute = preferences.notification.soundEffect.enable != 'true' || preferences.notification.soundEffect.when.extension != 'true';
                    if (preferences.notification.notification.enable !== 'false' && preferences.notification.notification.when.extension != 'false') {
                        ipcRenderer.send('notification', {
                            progress: false,
                            title: i18n.__('Notification.SaveImage.Done.Title'),
                            description: i18n.__('Notification.SaveImage.Done.Descript'),
                            webUrl: item && item.src,
                            mute: mute
                        });
                    }
                }
                callback(item);
            }
            catch (err) {

                console.error(err);

                if (err?.code === "TASK_CANCEL") {
                    return callback({});
                }

                if (err.src) {
                    const detailTag = err.code && err.detail ? ` [${err.code}: ${err.detail}]` : (err.code ? ` [${err.code}]` : '');
                    ipcRenderer.send('electron-log', `[bg] Can not download file${detailTag}, url: ${err.src}`);
                    console.error("【下載中斷】原因是：", err.msg + detailTag, "，網址為：", err.src);
                }

                // 如果上传发生失败，将失败记录下来
                if (err.code && (err.code === "BASE64_ERROR" || err.code === "NETWORK_TIMEOUT" || err.code === "NO_FILE" || err.code === "UNRECOGNIZED" || err.code === "HTTP_ERROR" || err.code === "CONTENT_TYPE_BLOCKED")) {
                    var errorItem = {
                        type: "DOWNLOAD_ERROR",
                        reason: err.code,
                        detail: err.detail || "",
                        object: task.item
                    };
                    ipcRenderer.send('image-processing-error', errorItem);
                }
                callback();
            }
        })();
    }

    async downloadLargeImage(task) {
        return new Promise(async (resolve) => {
            try {
                if (!eagle.urlEnlarger.isEnlargable(task.item.url)) return resolve(null);
                const { url, largeUrl } = await eagle.urlEnlarger.enlarge(task.item.url);

                // 如果符合轉大圖規則，就下載大圖
                if (largeUrl && url !== largeUrl ) {
                    const item = await this.startDownload({ ...task.item, url: largeUrl }, task.cancellationToken);
                    resolve(item);
                }
                resolve(null);
            } 
            catch (err) {
                resolve(null);
            }
        });
    }

    async startDownload(params, cancellationToken) {
        return new Promise(async (resolve, reject) => {

            let url = params.url;
            
            // 如果任務已經取消，就完成任務並關閉
            cancellationToken = cancellationToken || tokenSource.empty;
            if (cancellationToken.isCancelled() || forceQuit) {
                return reject({ code: "TASK_CANCEL", err: true, msg: "Task has been canceld.", src: url })
            }

            // 如果沒有轉大圖且有 base64，就直接下載
            if (!params.large && params.base64) {
                url = params.base64;
            }

            const isBase64 = url && url.indexOf("data:") !== -1;
            const isLocalFile = url && url.indexOf("file://") !== -1;

            if (!params.id) params.id = guid();

            // 轉換 base64 格式成對應的檔案（存放於 temp）
            if (isBase64) {
                ipcRenderer.send('electron-info', `[bg] >> download with base64 [${url.length}]`);
                const decodeImage = decodeBase64Image(url);
                if (!decodeImage || !decodeImage.data) {
                    return reject({
                        err: { code: "BASE64_ERROR", msg: "Cann't decode base64 data", src: url }
                    });
                }

                const buffer = decodeImage.data;
                const item = await this.downloadWithBuffer(params, buffer);
                return resolve(item);
            }
            else if (isLocalFile) {
                ipcRenderer.send('electron-info', `[bg] >> download with local file [${url}]`);
                const localPath = URL_MODULE.fileURLToPath(url);
                if (fs.existsSync(localPath)) {
                    const buffer = await fs.promises.readFile(localPath);
                    const item = await this.downloadWithBuffer(params, buffer);
                    return resolve(item);
                }
                else {
                    return reject({ code: "NO_FILE", msg: "Download failed", src: url });
                }
            }

            // 一般圖片格式，進行下載並儲存至 temp
            else {

                if (!url) {
                    return reject({code: "NETWORK_TIMEOUT", err: true, msg: "File downloading timeout", src: url });
                }

                try {
                    const item = await this.downloadWithNet(params);
                    if (cancellationToken.isCancelled()) {
                        return reject({ code: "TASK_CANCEL", err: true, msg: "Task has been canceld.", src: url })
                    }
                    return resolve(item);
                }
                catch (err) {
                    // 如果无法下载，改用 fetch 下载
                    ipcRenderer.send('electron-log', `[bg] Can not download with electron net, retry with fetch`);
                    try {
                        const buffer = await this.downloadWithFetch(url);
                        const item = await this.downloadWithBuffer(params, buffer);
                        if (cancellationToken.isCancelled()) {
                            return reject({ code: "TASK_CANCEL", err: true, msg: "Task has been canceld.", src: url })
                        }
                        return resolve(item);
                    }
                    catch (err) {
                        const msg = (err && err.message) || '';

                        // HTTP 4xx/5xx — 解析狀態碼，組合 "HTTP 404 Not Found" 格式
                        const statusMatch = msg.match(/Fetch failed with status:\s*(\d+)/);
                        if (statusMatch) {
                            const statusCode = statusMatch[1];
                            const statusText = this._getHttpStatusText(parseInt(statusCode));
                            const detail = statusText ? `HTTP ${statusCode} ${statusText}` : `HTTP ${statusCode}`;
                            return reject({ code: "HTTP_ERROR", err: true, msg: msg, detail: detail, src: url });
                        }

                        // Content-Type 被擋（Cloudflare、登入牆等）
                        const ctMatch = msg.match(/Unexpected content-type:\s*(.+)/i);
                        if (ctMatch) {
                            return reject({ code: "CONTENT_TYPE_BLOCKED", err: true, msg: msg, detail: ctMatch[1].trim(), src: url });
                        }

                        // 其餘：真正超時或未知網路錯誤
                        return reject({ code: "NETWORK_TIMEOUT", err: true, msg: msg || "File downloading timeout", src: url });
                    }
                }
            }
        });
    }

    async downloadWithNet(params) {
        return new Promise((resolve, reject) => {
            (async () => {
                const url = params.url;
                const directory = EAGLE_THUMBNAIL_TEMP_PATH;
                const filename = params.id;
                const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
                let referer;

                // Note: 如果有帶 website 參數，預設就嘗試調整 referer
                if (
                    params.website ||
                    params.headers ||
                    (params.url && (params.url.indexOf("pixiv") !== -1 || params.url.indexOf("pximg") !== -1)) ||
                    (params.url && (params.url.indexOf("doubanio.com") !== -1)) ||
                    (params.url && (params.url.indexOf("bigurl") !== -1)) ||
                    (params.url && (params.url.indexOf("sinaimg.cn") !== -1))
                ) {
                    referer = params.website || params.url;
                    ipcRenderer.send('electron-info', `[bg] >> download with electron net [${url}], referer: ${referer}`);
                }
                else {
                    ipcRenderer.send('electron-info', `[bg] >> download with electron net [${url}]`);
                }
                let outputPath = await ipcRenderer.invoke('downloadWithNet', {
                    url: url,
                    referer: referer,
                    userAgent: userAgent,
                    directory: directory,
                    filename: filename,
                });

                if (!outputPath) {
                    ipcRenderer.send('electron-info', `[bg] >> download with electron request [${url}]`);

                    // 如果無法下載 downloadWithRequest
                    outputPath = await ipcRenderer.invoke('downloadWithRequest', {
                        url: url,
                        referer: referer,
                        userAgent: userAgent,
                        directory: directory,
                        filename: filename,
                    });
                }

                if (!outputPath) {
                    return reject({ code: "NO_FILE", msg: "Download failed", src: url });
                }

                // 如果檔案不存在
                if (!fs.existsSync(outputPath)) {
                    return reject({ code: "NO_FILE", msg: "Download failed", src: url });
                }

                // 文件异常或者来源网址不支持外部下载
                const ext = getExt({ path: outputPath });
                if (!ext) {
                    reject({ code: "UNRECOGNIZED", msg: "Download failed", src: url });
                    fse.remove(outputPath);
                    return;
                }

                const item = {
                    id: params.id,
                    name: params.name,
                    src: params.url,
                    url: params.website,
                    folders: params.folders || [],
                    tags: params.tags || [],
                    type: params.type,
                    annotation: params.annotation || "",
                    modificationTime: params.modificationTime || Date.now(),
                    path: outputPath
                };

                if (params.star) {
                    item.star = params.star;
                }

                // 完成下載，回傳結果
                return resolve(item);
            })();
        });
    }

    async downloadWithFetch(url) {
        return new Promise(async (resolve, reject) => {

            ipcRenderer.send('electron-info', `[bg] >> download with fetch [${url}]`);

            // Note: 30 秒超時機制，避免 fetch 無限等待
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            fetch(url, {
                method: 'GET',
                signal: controller.signal
            })
                .then((response) => {
                    clearTimeout(timeoutId);

                    if (!response.ok || response.status !== 200) {
                        ipcRenderer.send('electron-info', `[bg] ${url}, response.status: ${response.status}`);
                        return reject(new Error(`Fetch failed with status: ${response.status}`));
                    }

                    // Note: 檢查 Content-Type，拒絕 HTML 回應（Cloudflare 擋頁、登入牆等）
                    const contentType = (response.headers.get('content-type') || '').toLowerCase();
                    if (contentType.includes('text/html')) {
                        ipcRenderer.send('electron-info', `[bg] ${url}, unexpected content-type: ${contentType}`);
                        return reject(new Error(`Unexpected content-type: ${contentType}`));
                    }

                    return response.blob();
                })
                .then(blob => {
                    if (!blob) {
                        return reject(new Error('Blob is empty.'));
                    }

                    function toBuffer(ab) {
                        var buf = Buffer.alloc(ab.byteLength);
                        var view = new Uint8Array(ab);
                        for (var i = 0; i < buf.length; ++i) {
                            buf[i] = view[i];
                        }
                        return buf;
                    }

                    blob.arrayBuffer().then(buffer => {
                        resolve(toBuffer(buffer));
                    });
                })
                .catch((err) => {
                    clearTimeout(timeoutId);
                    return reject(err);
                });
        });
    }

    async downloadWithBuffer(params, buffer) {

        return new Promise(async (resolve, reject) => {

            const filePath = path.normalize(EAGLE_THUMBNAIL_TEMP_PATH + "/" + params.id);

            if (!buffer || buffer.length === 0) {
                return reject({code: "BASE64_ERROR", msg: "Cann't decode buffer data", src: params.url });
            }

            // Note: 檢查 buffer 內容是否為 HTML 錯誤頁面（Cloudflare 擋頁、404 頁面、登入牆等）
            // 讀取前 1024 bytes 進行快速偵測
            try {
                const head = buffer.slice(0, 1024).toString('utf8').toLowerCase();
                if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
                    ipcRenderer.send('electron-log', `[bg] Downloaded content appears to be HTML, rejecting: ${params.url}`);
                    return reject({ code: "UNRECOGNIZED", msg: "Downloaded content is HTML, not a valid file", src: params.url });
                }
            }
            catch (err) {
                // 忽略偵測錯誤，繼續正常流程
            }

            await fs.promises.writeFile(filePath, buffer);

            const item = {
                id: params.id,
                name: params.name,
                src: params.url,
                url: params.website,
                type: params.type,
                folders: params.folders || [],
                tags: params.tags || [],
                annotation: params.annotation || "",
                modificationTime: params.modificationTime || Date.now(),
                path: filePath
            };

            if (params.star) {
                item.star = params.star;
            }

            // 完成下載，回傳結果
            return resolve(item);
        });
    }

    download(items, needNotify) {
        const source = tokenSource();
        taskTokens.push(source);
        items.forEach((item) => {

            // 避免图片没有名称
            if (!item.name) {
                item.name = guid();
            }

            item.name = item.name.trim();

            if (item.url) {
                if (item.url.indexOf("data:") === -1 && !item.url.match(/^[a-zA-Z]+:\/\//)) {
                    console.log(`网址异常：${item.url}`)
                    item.url = `http://${item.url}`;
                }
            }
            // 將圖片添加至下載任務對列
            this.queue.push({
                needNotify: needNotify,
                item: item,
                cancellationToken: source.token
            }, (downloadedItem) => {
                if (downloadedItem && downloadedItem.path) {
                    addToProcessQueue(downloadedItem);
                }
                else {
                    ipcRenderer.send('file-uploaded-end', {});
                }
            });
        })
    }

    _getHttpStatusText(status) {
        const STATUS_TEXT = {
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            405: 'Method Not Allowed',
            408: 'Request Timeout',
            429: 'Too Many Requests',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable',
            504: 'Gateway Timeout',
        };
        return STATUS_TEXT[status] || '';
    }

    kill() {
        this.queue.kill();
    }
}

module.exports = new Downloader();