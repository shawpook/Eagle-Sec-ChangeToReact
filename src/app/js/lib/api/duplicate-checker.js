class DuplicateChecker {

    async initFingerprintMap(items, fingerprintMap, onProgress, cancelToken) {
        return new Promise((resolve) => {
            let current = 0;
            let total = items.length;

            // 如果 fingerprintMap 是空的，才進行計算
            if (Object.keys(fingerprintMap).length === 0) {
                const startTime = Date.now();
                const async = require('async');
                let queue = async.queue((item, callback) => {
                    (async () => {
                        try {
                            if (cancelToken.isCancelled()) {
                                return callback();
                            }

                            let fileURL;
                            if (item.noThumbnail) {
                                fileURL = FileUrlHelper.getRawUrl(item);
                            }
                            else {
                                fileURL = FileUrlHelper.getThumbnailUrl(item);
                            }
                            const fingerprint = await Phash.getFingerprint(fileURL);
                            if (fingerprint) {
                                fingerprintMap[item.id] = fingerprint;
                            }
                            current++;
                            onProgress && onProgress(current, total);
                        }
                        catch (err) {
                            console.log(err);
                        }
                        callback();
                    })();
                }, 8);

                queue.drain = () => {
                    console.log(`avg time each item: ${(Date.now() - startTime) / total} items/s`);
                    resolve();
                };

                queue.push(items);
            }
            else {
                resolve();
            }
        });
    }

    async findSimilarFiles(items, cancelToken, options = { fingerprintWeighted: 0.8, fingerprintMap: undefined, onProgress: undefined }) {
        return new Promise(async (resolve) => {
            let onProgress = options.onProgress;

            // 篩選掉不支援的格式，目前僅支援 jpg png jpeg webp avif bmp heic heif jfif jxl
            // 篩選掉檔案大小 > 128MB 的檔案
            const MB_128 = 1024 * 1024 * 128;
            const cloneItems = items.filter((item) => {
                const SUPPORT_FORMATS = {
                    "jpg": true,
                    "png": true,
                    "jpeg": true,
                    "webp": true,
                    "avif": true,
                    "bmp": true,
                    "heic": true,
                    "heif": true,
                    "jfif": true,
                    "jxl": true,
                };
                return SUPPORT_FORMATS[item.ext];
            }).filter((item) => {
                return item.size < MB_128;
            });

            // 計算所有圖片的 phash
            const fingerprintMap = options.fingerprintMap || {};

            if (cloneItems.length === 0) {
                return resolve({
                    groups: [],
                    fingerprintMap: {},
                });
            }
            
            await this.initFingerprintMap(cloneItems, fingerprintMap, onProgress, cancelToken);

            if (cancelToken.isCancelled()) {
                console.log("cancel");
                return {
                    cancel: true,
                    groups: [],
                    fingerprintMap: {},
                }
            };

            const numWorkers = Math.min(4, Math.ceil(cloneItems.length / 3000));
            const workers = [];
            const workerResults = [];
            const addedItemMap = {};

            for (let i = 0; i < numWorkers; i++) {
                workers[i] = new Worker('js/workers/calHammingDistance.js');

                const partItems = cloneItems.slice(i * cloneItems.length / numWorkers, (i + 1) * cloneItems.length / numWorkers);
                workers[i].postMessage({all: cloneItems, part: partItems, fingerprintMap, fingerprintWeighted: options.fingerprintWeighted});

                workers[i].onmessage = function(event) {

                    workers[i].terminate();

                    workerResults[i] = {
                        groups: event.data
                    };

                    if (workerResults.filter(Boolean).length === numWorkers) {

                        let result = {
                            groups: [],
                            fingerprintMap: fingerprintMap,
                        };

                        workerResults.forEach((workerResult) => {
                            workerResult.groups.forEach((group) => {
                                if (addedItemMap[group.id]) return;
                                group.items = [...new Set(group.items)];
                                addedItemMap[group.id] = true;
                                result.groups.push({
                                    id: crypto.randomUUID(),
                                    items: group.items,
                                });
                            });
                        });

                        result.groups = result.groups.filter((group) => {
                            return group.items.length > 1;
                        });
                        
                        console.log(result);
                        return resolve(result);
                    }
                };

                workers[i].onerror = function(error) {
                    console.error('Worker error: ', error);
                };
            }
        });
    }

    //   找到相同的文件
    async findDuplicateFiles(items, cancelToken, options) {
        const crypto = require("crypto");
        const readChunk = require('read-chunk');
        const chunkSize = 1024 * 4;
        let result = [];
        let sizeMap = {};
        let total = items.length;
        let current = 0;
        let onProgress = options.onProgress;

        try {
            for (let item of items) {
                if (item.size === 0) continue;
                const size = item.size;
                if (sizeMap[size]) {
                    sizeMap[size].push(item);
                } else {
                    sizeMap[size] = [item];
                }
            }

            for (let [size, items] of Object.entries(sizeMap)) {
                if (cancelToken.isCancelled()) break;
                if (items.length < 2) {
                    current += items.length;
                    onProgress && onProgress(current, total);
                    continue;
                }
                const md5Map = {};
                for await (const item of items) {
                    if (cancelToken.isCancelled()) break;
                    // for (let item of items) {
                    try {
                        const filePath = FileUrlHelper.getRawPath(item);
                        const itemSize = parseInt(item.size);
                        let md5 = "";
                        if (chunkSize > itemSize) {
                            const buffer = await readChunk(filePath, 0, itemSize);
                            md5 = crypto.createHash("md5").update(buffer).digest("hex");
                        }
                        else {
                            const headBuffer = await readChunk(filePath, 0, chunkSize);
                            const bodyBuffer = await readChunk(filePath, Math.floor((size - chunkSize) / 2), chunkSize);
                            const tailBuffer = await readChunk(filePath, size - chunkSize, chunkSize);
                            const mergeBuffer = Buffer.concat([headBuffer, bodyBuffer, tailBuffer]);
                            md5 = crypto.createHash("md5").update(mergeBuffer).digest("hex");
                        }
                            

                        if (md5Map[md5]) {
                            md5Map[md5].push(item);
                        } else {
                            md5Map[md5] = [item];
                        }
                        current += 1;
                        onProgress && onProgress(current, total);
                    }
                    catch (err) {
                        console.log(err);
                    }
                }

                for (let items of Object.values(md5Map)) {
                    if (items.length < 2) continue;
                    result.push({
                        id: crypto.randomUUID(),
                        items: items
                    });
                }
            }
        }
        catch (err) {
            electronLog.error(err);
        }

        if (cancelToken.isCancelled()) {
            console.log("cancel");
            return {
                cancel: true,
                groups: [],
            }
        };

        return {
            groups: result
        };
    }
}

class Phash {
    static ExpectImgSize = 40;
    static SamplingRadio = 4;
    static DCTScale = 2;

    static async getImageUrl(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async function (e) {
                resolve(e.target.result);
            };
        });
    }

    static async getImageData(src) {
        return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = Phash.ExpectImgSize;
            canvas.height = Phash.ExpectImgSize;

            const img = new Image();
            img.onload = function () {
                const _this = this;
                context.drawImage(_this, 0, 0, _this.width, _this.height, 0, 0, Phash.ExpectImgSize, Phash.ExpectImgSize);
                resolve(context.getImageData(0, 0, Phash.ExpectImgSize, Phash.ExpectImgSize));
            };
            img.onerror = function () {
                resolve(null);
            };
            img.src = src;
        });
    }

    static getGrayscale(origin) {
        const result = [];
        for (let n = 0; n < origin.data.length; n++) {
            if ((n + 1) % 4 === 0) {
                const R = origin.data[n - 3];
                const G = origin.data[n - 2];
                const B = origin.data[n - 1];
                const gray = R * 0.299 + G * 0.587 + B * 0.114;
                result.push(gray);
            }
        }
        return result;
    }

    static getDCT(colors) {
        const PI_N = Math.PI / colors.length;
        return colors.map((_, n) => {
            const num = Phash.DCTScale * colors.reduce((total, current, m) => total + current * Math.cos(PI_N * (m + 0.5) * n), 0);
            return Math.min(255, Math.max(0, num));
        });
    }

    static getLTCornerColors(colors) {
        const MatrixSize = Math.sqrt(colors.length);
        const SamplingSize = MatrixSize / Phash.SamplingRadio;
        const result = [];

        for (let i = 0; i < SamplingSize; i++) {
            result.push(...colors.slice(i * MatrixSize, i * MatrixSize + SamplingSize));
        }
        return result;
    }

    static getCosineSimilarity(origin, target) {
        let product = 0,
            vecA = 0,
            vecB = 0;
        for (let i = 0; i < origin.length; i++) {
            vecA += Math.pow(origin[i], 2);
            vecB += Math.pow(target[i], 2);
            product += origin[i] * target[i];
        }

        if (vecA === vecB) {
            return product / vecA;
        }

        return product / (Math.sqrt(vecA) * Math.sqrt(vecB));
    };

    static hammingDistance(string1, string2) {
        var xorResult = BigInt("0b" + string1) ^ BigInt("0b" + string2);
        var binary = xorResult.toString(2);
        var count = 0;
        for (var i = 0; i < binary.length; i++) {
            if (binary[i] === '1') {
                count++;
            }
        }
        return count;
    }

    static getFingerprint = async (filePath) => {
        const imgData = await Phash.getImageData(filePath);
        // 離散餘弦轉換
        const colors = Phash.getLTCornerColors(Phash.getDCT(Phash.getGrayscale(imgData)));
        // 均值化
        const average = colors.reduce((pre, cur) => pre + cur) / colors.length;
        // 二值化
        return colors.map((color) => (color >= average ? 1 : 0)).join("");
    };
}

eagle.duplicateChecker = new DuplicateChecker();