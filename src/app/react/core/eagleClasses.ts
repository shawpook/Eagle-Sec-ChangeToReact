/**
 * c2：eagle 对象族九类逐字移植（bundle region 1-2050 提取：Inspector / ItemFilter /
 * DuplicateChecker / Phash / ReverseImageSearch / AISearch / CustomExport / CombineImages /
 * AIAction + eagle.* 挂载语句）。
 * 机械替换：$bodyScope → getBodyScope()；require('async'|'crypto'|'read-chunk') →
 * _req() 安全包装（mock 环境无 npm 模块时返回 undefined，真实 Electron 走 node require）；
 * electronLog/swal/i18n/ipcRenderer → window 全局兜底 shim；FileUrlHelper → c1 移植版。
 * 本模块实例暂不覆写 window.eagle（bundle 实例仍为权威态，随 c 域切片逐步切换）。
 */
// @ts-nocheck
import { FileUrlHelper } from './fileUrlHelper';
import { eagle } from './eagleApi';
import { syncListFromScope } from '../store/listState';
import { syncPanelFromScope } from '../store/panelState';
import { syncBodyFromScope } from '../store/bodyState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { getBodyScope } from './appCore';

const _req: any = (name: string) => {
  try { return (window as any).require(name); } catch (err) { return undefined; }
};
const electronLog: any = (window as any).electronLog || console;
const i18n: any = (window as any).i18n;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const swal: any = (...args: any[]) => (window as any).swal(...args);

class Inspector {
    
    #isHideInspector;
    #width;

	constructor() {
        this.#isHideInspector = localStorage["eagle.inspector.isHideInspector"] === 'true';
        this.#width = (localStorage["eagle.containerSize.inspector"])? parseInt(localStorage["eagle.containerSize.inspector"]) : 240;
        this.newName = "";
        this.newUrl = "";
        this.newTags = [];
        this.newNamePlaceholder = "title";
        this.newUrlPlaceholder = "http://";
        this.folders = [];
        this.activeTab = 'ITEM';
        this.inspectorFolder = undefined;
        this.category = {
            newName: "",
            newDescription: "",
            createDate: "",
            imageCount: 0,
            fileSize: 0,
            exportable: false,
            editable: false
        };
        this.sortableOptions = {
            distance: 10,
            disabled: false,
			helper : 'clone',
            update: (e, ui) => {
                setTimeout(() => {
                    if (this.inspectorItems && this.inspectorItems.length > 0) {
                        let inspectorItemsOrder = {};
                        this.inspectorItems.forEach((item, index) => {
                            inspectorItemsOrder[item.id] = index;
                        });
                        localStorage.setItem("eagle.inspector.itemsOrder", JSON.stringify(inspectorItemsOrder));
                    }
                }, 1);
            },
        };
        this.inspectorItems = [];
        this.inspectorItemsOrder = localStorage["eagle.inspector.itemsOrder"] ? JSON.parse(localStorage["eagle.inspector.itemsOrder"]) : { tags: 0, folders: 1, annotations: 2, information: 100 };
	}

    initPlugins() {
        const inspectorPlugins = pluginModule.previewExtension.inspectorPlugins;
        const pluginItems = inspectorPlugins.map((plugin) => {
            return {
                type: "plugin",
                id: plugin?.manifest?.id,
                name: plugin?.manifest?.name,
                plugin: plugin,
            }
        });

        this.inspectorItems = [
            { id: "tags" ,name: i18n.__("inspector.includesTagsLabel"), type: "tags" },
            { id: "folders", name: i18n.__("inspector.includesFoldersLabel"), type: "folders" },
            { id: "annotations", name: i18n.__("inspector.annotationLabel"), type: "annotations" },
            ...pluginItems,
            { id: "information", name: i18n.__("inspector.infoLabel"), type: "information" },
        ];

        this.inspectorItems.sort((a, b) => {
            const aOrder = this.inspectorItemsOrder[a.id] ?? 3;
            const bOrder = this.inspectorItemsOrder[b.id] ?? 3;
            return aOrder - bOrder;
        });
    }

    reset() {
        this.inspectorFolder = undefined;
    }

    toggle() {
        this.isHideInspector = !this.isHideInspector;
        setTimeout(() => {
            getBodyScope().whenLayoutChange();
            getBodyScope().$evalAsync();
        }, 100);
        if (eagle.inspector.isHideInspector) { electronLog && electronLog.info("[app] Inspector: OFF"); }
        else { electronLog && electronLog.info("[app] Inspector: ON"); }
    }

    copyTags(tags) {
        tags = tags ?? this.newTags;
        if (tags?.length > 0) {
            this.copiedTags = tags;
            clipboard.writeText(this.copiedTags.join("\n"));
        }
    }

    calculateTags(images) {

        if (images.length == 1) return images[0].tags;

        var board = {}; // Ó‹·Ö±í
        var tags = [];
        images.forEach(function(image) {
            if (image && image.tags) {
                image.tags.forEach(function(tag) {
                    if (!board[tag]) {
                        board[tag] = 1;
                    } else {
                        board[tag] = board[tag] + 1;
                    }
                });
            }
        });
        Object.keys(board).forEach(function(key) {
            if (board[key] == images.length) {
                tags.push(key);
            }
        });
        return tags;
    }

    calculateFolders(images) {
        var board = {}; // Ó‹·Ö±í
        var folders = [];
        images.forEach(function(image) {
            if (!image || !image.folders) return;
            image.folders.forEach(function(folder) {
                if (!board[folder]) {
                    board[folder] = 1;
                } else {
                    board[folder] = board[folder] + 1;
                }
            });
        });
        Object.keys(board).forEach(function(key) {
            if (board[key] == images.length) {
                folders.push(key);
            }
        });
        return folders;
    }

    calculateName(images) {
        var name = images[0].name;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (name !== image.name) {
                return "";
            }
        }
        return name;
    }
    
    calculateUrl(images) {
        var url = images[0].url;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (url !== image.url) {
                return "";
            }
        }
        return url;
    }

    calculateAnnotation(images) {
        var annotation = images[0].annotation;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (annotation !== image.annotation) {
                return "";
            }
        }
        return annotation;
    }

    calculateStar(images) {
        var star = images[0].star;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (star !== image.star) {
                return 0;
            }
        }
        return star;
    }

    calculateFileSize(images) {
        var total = 0;
        try {
            for (var i = 0; i < images.length; i++) {
                var image = images[i];
                if (image && image.size) {
                    total += parseInt(image.size);
                }
            }
        }
        catch (err) {
            return 0;
        }
        return total;
    }

    get isHideInspector() {
        return this.#isHideInspector;
    }

    set isHideInspector(value) {
        this.#isHideInspector = value;
        localStorage.setItem("eagle.inspector.isHideInspector", value);
        // b1-9by-C：类内 setter 收敛——inspector 显隐变化直推消费快照（原 200ms 轮询退役）
        syncBodyFromScope();
        syncToolbarFromScope();
        syncDetailFromScope();
        syncInspectorFromScope();
        syncPanelFromScope();
    }

    get width() {
        return this.#width;
    }

    set width(value) {
        if (isNaN(value)) return;
        this.#width = value;
        localStorage.setItem("eagle.containerSize.inspector", value);
        // b1-9by-C：宽度变化直推 body/inspector 快照
        syncBodyFromScope();
        syncInspectorFromScope();
    }

    get showProperties() {
        return localStorage['eagle.inspector.showProperties'] !== 'false';
    }
    set showProperties(value) {
        localStorage['eagle.inspector.showProperties'] = value;
    }

    get showComments() {
        return localStorage['eagle.inspector.showComments'] !== 'false';
    }
    set showComments(value) {
        localStorage['eagle.inspector.showComments'] = value;
    }

    get showFolders() {
        return localStorage['eagle.inspector.showFolders'] !== 'false';
    }
    set showFolders(value) {
        localStorage['eagle.inspector.showFolders'] = value;
    }

    get showTags() {
        return localStorage['eagle.inspector.showTags'] !== 'false';
    }
    set showTags(value) {
        localStorage['eagle.inspector.showTags'] = value;
    }

}

eagle.inspector = new Inspector();
class ItemFilter {
    #isOpen;
	constructor() {
        this.#isOpen = localStorage['isOpenFilter']  === 'true';
        this.isLockFilter = false;

        // 預設計數
        this.defaultCounts = {
            type: {},
            rating: {
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                '5': 0,
                '0': 0,
            },
            shape: {
                'panoramic-landscape': 0,
                'landscape': 0,
                'panoramic-portrait': 0,
                'portrait': 0,
                'square': 0,
                '4:3': 0,
                '3:4': 0,
                '16:9': 0,
                '9:16': 0,
            },
            import: {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            },
            mtime: {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            },
            camera: {},
            fontActivated: {
                'activated': 0,
                'deactivated': 0,
            },
            image: {
                itemId: undefined,
                base64: undefined
            },
            semantic: {
                value: undefined,
            }
        };
        this.filterCounts = {};
        this.resetFilterCounts();

        // 預設條件
        this.defaultRules = {
            type: {
                includes: {},
                excludes: {},
            },
            tag: {
                no: false,
                includes: [],
                excludes: [],
            },
            folder: {
                includes: {},
                excludes: {},
            },
            font: {
                activated: false,
                deactivated: false,
            },
            camera: {},
            import: {
                today: false,
                yesterday: false,
                last7day: false,
                last30day: false,
                last90day: false,
                last365day: false,
                usingRange: false,
                range: undefined,
                type: "undefined",
                model: undefined,
                selectedMonths: {},
            },
            mtime: {
                today: false,
                yesterday: false,
                last7day: false,
                last30day: false,
                last90day: false,
                last365day: false,
                usingRange: false,
                type: "undefined",
                model: undefined,
                selectedMonths: {},
            },
            rating: {
                '1': false,
                '2': false,
                '3': false,
                '4': false,
                '5': false,
                '0': false,
            },
            color: {
                gray: false,
                value: undefined,
                accuracy: 20
            },
            shape: {
                portrait: false,
                landscape: false,
                square: false,
                panoramicPortrait: false,
                panoramicLandscape: false,
                '43': false,
                '34': false,
                '169': false,
                '916': false,
                custom: false,
                width: 4,
                height: 3,
            },
            resolution: {
                minW: undefined,
                maxW: undefined,
                minH: undefined,
                maxH: undefined
            },
            file: {
                min: undefined,
                max: undefined,
                unit: 'kb',
            },
            duration: {
                min: undefined,
                max: undefined,
                unit: 's',
            },
            bpm: {
                min: undefined,
                max: undefined
            },
            annotation: {
                has: false,
                no: false,
                keywords: undefined
            },
            note: {
                has: false,
                no: false,
                keywords: undefined
            },
            url: {
                has: false,
                no: false,
                keywords: undefined
            },
            image: {
                itemId: undefined,
                base64: undefined
            },
            semantic: {
                value: undefined,
            }
        };
        this.filterRules = {};
        this.resetFilterRules();

        this.initPinned();

        // 工具列
        this.toolbar = [
            { type: 'image' }, // Eagle 5.0
            { type: 'semantic' }, // Eagle 5.0
            { type: 'color' },
            { type: 'tags' },
            { type: 'folders' },
            { type: 'shape' },
            { type: 'rating' },
            { type: 'types' },
            { type: 'import' },
            { type: 'mtime' },
            { type: 'resolution' },
            { type: 'duration' },
            { type: 'size' },
            { type: 'annotation' },
            { type: 'note' },
            { type: 'url' },
            { type: 'fontActivated' },
            { type: 'bpm' },
            { type: 'camera' },
        ];
        this.toolbarMap = {};
        this.toolbarSortableOptions = {
            distance: 10,
            disabled: false,
			helper : 'clone',
            update: (e, ui) => {
                setTimeout(() => {
                    console.log(this.toolbar);
                    if (this.toolbar && this.toolbar.length > 0) {
                        let toolbarOrders = [];
                        this.toolbar.forEach((item) => {
                            toolbarOrders.push(item.type);
                        });
                        localStorage.setItem("eagle.filter.toolbar.orders", JSON.stringify(toolbarOrders));
                    }
                }, 1);
            },
        };
        this.tagFilterLogic = "OR";
        this.folderFilterLogic = "OR";

        // 記錄支援的篩選格式
        this.filterExtensions = {};

        // 資料夾篩選關鍵字
        this.filterFolderKeyword = "";

        // 相機篩選條件
        this.filterCameras = [];
        this.filterCamerasMapping = {};
        this.initOrders();

        // 格式篩選條件
        this.buildInTypes = ['font','video','audio', 'youtube','vimeo','bilibili'];
        this.filterTypes = [];

        // 篩選器計數
        this.filterBadge = 0;
        syncListFromScope();
	}

    resetFilterRules() {
        this.filterRules = JSON.parse(JSON.stringify(this.defaultRules));
    }

    resetFilterCounts() {
        this.filterCounts = JSON.parse(JSON.stringify(this.defaultCounts));
    }

    initPinned() {
        const defaultPinned = {
            image: false,
            semantic: false,
            color: true,
            tags: true,
            folders: true,
            shape: true,
            rating: true,
            types: true,
            import: false,
            mtime: false,
            resolution: false,
            duration: false,
            size: false,
            annotation: false,
            note: false,
            url: false,
            fontActivated: false,
            bpm: false,
            camera: false,
        };
        let pinned = localStorage.getItem('eagle.filter.toolbar.pinned');
        if (pinned) {
            try {
                pinned = JSON.parse(pinned);
            }
            catch (err) {
                pinned = defaultPinned;
            }
        }
        else {
            pinned = defaultPinned;
        }
        this.pinned = pinned;
    }       

    savePinned() {
        localStorage.setItem('eagle.filter.toolbar.pinned', JSON.stringify(this.pinned));
    }

    initOrders() {
        const defaultOrders = [
            'color',
            'image',
            'semantic',
            'tags',
            'folders',
            'shape',
            'rating',
            'types',
            'resolution',
            'duration',
            'size',
            'annotation',
            'note',
            'url',
            'import',
            'mtime',
            'fontActivated',
            'bpm',
            'camera'
        ];
        var filterToolbarOrders = localStorage.getItem("eagle.filter.toolbar.orders");
        if (filterToolbarOrders) {
            try {
                filterToolbarOrders = JSON.parse(filterToolbarOrders);
            }
            catch (err) {
                filterToolbarOrders = defaultOrders;
            }
        }
        else {
            filterToolbarOrders = defaultOrders;
        }

        if (filterToolbarOrders.length > 0) {
            var filterToolbarOrdersIndexMap = {};
            
            filterToolbarOrders.forEach((item, index) => {
                filterToolbarOrdersIndexMap[item] = index;
            });

            this.toolbar = this.toolbar.sort((a, b) => filterToolbarOrdersIndexMap[a.type] - filterToolbarOrdersIndexMap[b.type]);

            // set toolbar map
            this.toolbar.forEach((item) => {
                this.toolbarMap[item.type] = item;
            });
        }


        this.filterToolbarOrders = filterToolbarOrders;
    }

    get isOpen() {
        return this.#isOpen;
    }
    set isOpen(value) {
        this.#isOpen = value;
        localStorage["isOpenFilter"] = value;
    }
}

eagle.filter = new ItemFilter();
class DuplicateChecker {

    async initFingerprintMap(items, fingerprintMap, onProgress, cancelToken) {
        return new Promise((resolve) => {
            let current = 0;
            let total = items.length;

            // 如果 fingerprintMap 是空的，才進行計算
            if (Object.keys(fingerprintMap).length === 0) {
                const startTime = Date.now();
                const async = _req('async');
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
        const crypto = _req('crypto');
        const readChunk = _req('read-chunk');
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
eagle.urlEnlargerRemote = {
    load: () =>{
        const scripts = [
            `https://oss-app.eagle.cool/js/url-enlarger.js?v=${Date.now()}`,
            'https://eagleapp.oss-cn-hongkong.aliyuncs.com/js/url-enlarger.js'
        ];

        function loadScript(index) {
            if (index >= scripts.length) return;

            const script = document.createElement('script');
            const src = scripts[index];
            script.src = src;
            script.onload = function() {
                console.log("remote rule loaded.");
            };
            script.onerror = function() {
                // Error occurred loading script. Load next one.
                console.log(`remote rule fail, ${src}`);
                loadScript(index + 1);
            };
            document.head.appendChild(script);
        }

        loadScript(0);
    }
}
class ReverseImageSearch {

    #pluginId = 'eagle-plugin-search-by-image';
    
    static ENGINES = {
        GOOGLE: 'google',
        YANDEX: 'yandex',
        BING: 'bing',
        TINEYE: 'tineye',
        BAIDU: 'baidu',
        SOGOU: 'sogou',
        SAUCENAO: 'saucenao'
    };

    search(item, searchEngine = 'google') {

        if (!item) return;

        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }

        pluginModule.openPluginById(this.#pluginId, { searchEngine: searchEngine });
    }
}

eagle.reverseImageSearch = new ReverseImageSearch();
/**
 * AI Search API Client
 * 提供與 AI Search 插件互動的功能，包括文字搜尋、圖片搜尋和狀態監控
 * @class
 */
class AISearch {
    // 配置常數
    static #CONFIG = {
        PLUGIN_ID: 'ai-search',
        API_SERVER_URL: 'http://localhost:38766',
        DEFAULT_SEARCH_LIMIT: 20,
        INTERVALS: {
            READY: 5000,      // 服務就緒時的檢查間隔
            NOT_READY: 1000   // 服務未就緒時的檢查間隔
        },
        TIMEOUTS: {
            DEFAULT: 5000,
            SEARCH: 30000,
            HEALTH: 1000
        },
        ENDPOINTS: {
            STATUS: '/api/status',
            HEALTH: '/api/health',
            SEARCH: {
                TEXT: '/api/search/text',
                IMAGE: '/api/search/image',
                ID: '/api/search/id'
            },
            SYNC: {
                FULL: '/api/sync/full'
            }
        },
        ERRORS: {
            TIMEOUT: 'TIMEOUT',
            NETWORK_ERROR: 'NETWORK_ERROR',
            SEARCH_FAILED: 'SEARCH_FAILED',
            PLUGIN_NOT_INSTALLED: 'PLUGIN_NOT_INSTALLED',
            SERVICE_NOT_READY: 'SERVICE_NOT_READY'
        }
    };

    // 私有屬性
    #pluginId = AISearch.#CONFIG.PLUGIN_ID;
    #apiServerUrl = AISearch.#CONFIG.API_SERVER_URL;
    #statusWatcher = null;
    #listeners = new Map(); // 事件監聽器

    // 公開屬性
    isInstalled = false;
    isInitialized = false;
    status = {};
    isSearching = false;
    isReady = false;
    isStarting = false;

    /**
     * 檢查是否正在同步中
     * @returns {boolean} 是否正在同步
     * @public
     */
    get isSyncing() {
        return eagle?.aiSearch?.status?.sync?.status === 'syncing';
    }

    /**
     * 初始化 AI Search 服務
     * @public
     */
    init() {
        this.isInstalled = pluginModule.checkPluginInstalled(this.#pluginId);
        this.isInitialized = true;

        if (this.isInstalled) {
            this.#startStatusWatcher();
        }

        ipcRenderer.on('plugin-installed', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = true;
                this.isReady = false;
                this.isStarting = true;
                this.#startStatusWatcher();
                this.open();
                ipcRenderer.send('open.preferences', {
                    panel: "ai-search"
                });
                getBodyScope().$evalAsync();
            }
        });

        ipcRenderer.on('plugin-uninstalled', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = false;
                this.isReady = false;
                this.stopWatching();
                getBodyScope().$evalAsync();
            }
        });
    }

    /**
     * 開啟 AI Search 插件
     * @public
     */
    open() {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        pluginModule.openPluginById(this.#pluginId, {});
    }

    /**
     * 停止狀態監控
     * @public
     */
    stopWatching() {
        if (this.#statusWatcher) {
            clearInterval(this.#statusWatcher);
            this.#statusWatcher = null;
        }
    }

    /**
     * 註冊事件監聽器
     * @param {string} event - 事件名稱 ('statusChange', 'error')
     * @param {Function} callback - 回調函數
     * @public
     */
    on(event, callback) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);
    }

    /**
     * 移除事件監聽器
     * @param {string} event - 事件名稱
     * @param {Function} callback - 回調函數
     * @public
     */
    off(event, callback) {
        if (this.#listeners.has(event)) {
            this.#listeners.get(event).delete(callback);
        }
    }

    /**
     * 文字搜尋
     * @param {string} query - 搜尋關鍵字
     * @param {Object} options - 搜尋選項
     * @param {number} [options.limit=20] - 結果數量限制
     * @returns {Promise<Object>} 搜尋結果
     * @throws {Error} 搜尋失敗時拋出錯誤
     * @public
     */
    async searchByText(query, options = {}) {
        this.#validateServiceReady();
        this.#validateTextQuery(query);

        const { signal, ...restOptions } = options;
        const searchParams = {
            ...this.#getDefaultSearchOptions(),
            ...restOptions,
            query
        };

        return this.#executeSearch(
            AISearch.#CONFIG.ENDPOINTS.SEARCH.TEXT,
            searchParams,
            'POST',
            { 'Content-Type': 'application/json' },
            signal
        );
    }

    /**
     * 圖片搜尋
     * @param {File} imageFile - 圖片檔案
     * @param {Object} options - 搜尋選項
     * @param {number} [options.limit=20] - 結果數量限制
     * @returns {Promise<Object>} 搜尋結果
     * @throws {Error} 搜尋失敗時拋出錯誤
     * @public
     */
    async searchByImage(imageFile, options = {}) {
        this.#validateServiceReady();
        this.#validateImageFile(imageFile);

        const { signal, ...restOptions } = options;
        const formData = this.#createImageSearchFormData(imageFile, restOptions);

        return this.#executeSearch(
            AISearch.#CONFIG.ENDPOINTS.SEARCH.IMAGE,
            formData,
            'POST',
            {},
            signal
        );
    }

    /**
     * 以 Base64 圖片搜尋
     * @param {string} base64String - Base64 編碼的圖片字符串
     * @param {Object} options - 搜尋選項
     * @returns {Promise<Object>} 搜尋結果
     * @public
     */
    async searchByBase64(base64String, options = {}) {
        this.#validateServiceReady();
        if (!base64String) {
            throw new Error('Base64 string is required');
        }

        const file = this.#convertBase64ToFile(base64String);
        return this.searchByImage(file, options);
    }

    /**
     * 以 Item ID 搜尋相似圖片
     * @param {string} itemId - Eagle 項目 ID
     * @param {Object} options - 搜尋選項
     * @returns {Promise<Object>} 搜尋結果
     * @public
     */
    async searchByItemId(itemId, options = {}) {
        this.#validateServiceReady();
        if (!itemId) {
            throw new Error('Item ID is required');
        }

        const { signal, ...restOptions } = options;
        const searchParams = {
            ...this.#getDefaultSearchOptions(),
            ...restOptions,
            eagleId: itemId
        };

        return this.#executeSearch(
            AISearch.#CONFIG.ENDPOINTS.SEARCH.ID,
            searchParams,
            'POST',
            { 'Content-Type': 'application/json' },
            signal
        );
    }

    /**
     * 檢查 API 服務是否可用
     * @returns {Promise<boolean>} 服務是否可用
     * @public
     */
    async checkServiceHealth() {
        this.#validateInstalled();
        try {
            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.HEALTH}`,
                {},
                AISearch.#CONFIG.TIMEOUTS.HEALTH
            );
            
            if (response.ok) {
                const health = await response.json();
                return health.success === true;
            }
            return false;
        } catch (error) {
            console.warn('API health check failed:', error);
            return false;
        }
    }

    /**
     * 獲取同步狀態
     * @returns {Promise<Object>} 同步狀態
     * @public
     */
    async getSyncStatus() {
        this.#validateInstalled();
        try {
            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.STATUS}`
            );

            if (!response.ok) {
                throw new Error(`Failed to get status: ${response.status}`);
            }

            const result = await response.json();
            return result.status;
        } catch (error) {
            console.error('Failed to get sync status:', error);
            throw error;
        }
    }

    /**
     * 觸發全量同步
     * 用於刪除素材後（如清空垃圾桶）調用，確保索引與資料庫同步
     * @returns {Promise<Object|null>} 同步觸發結果，若插件未安裝或服務未就緒則返回 null
     * @public
     */
    async fullSync() {
        // 檢查插件是否已安裝且服務就緒
        if (!this.isInstalled || !this.isReady) {
            return null;
        }

        try {
            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.SYNC.FULL}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to trigger full sync: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to trigger full sync:', error);
            return null;
        }
    }

    // ========== 私有方法 ==========

    /**
     * 啟動狀態監控器
     * @private
     */
    #startStatusWatcher() {
        const checkStatus = async () => {
            try {
                const response = await fetch(
                    `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.STATUS}`
                );
                const data = await response.json();
                
                this.#updateStatus(data.status);
            } catch (error) {
                console.error('Error checking status:', error);
                this.#handleStatusError();
            }
        };

        // 立即執行第一次檢查
        checkStatus();

        // 設置初始間隔（假設初始狀態為 not ready）
        this.#statusWatcher = setInterval(
            checkStatus,
            AISearch.#CONFIG.INTERVALS.NOT_READY
        );
    }

    /**
     * 更新服務狀態
     * @param {Object} newStatus - 新的狀態對象
     * @private
     */
    #updateStatus(newStatus) {
        const wasReady = this.isReady;
        const wasStarting = this.isStarting;
        const wasError = this.isError;
        this.status = newStatus;
        
        // 檢查服務是否就緒
        this.isReady = this.#checkIfReady(newStatus);
        // 檢查服務是否正在啟動中
        this.isStarting = this.#checkIfStarting(newStatus);
        // 檢查是否有錯誤
        this.isError = this.#checkIfError(newStatus);
        
        // 如果狀態改變，調整檢查頻率和觸發更新
        if (wasReady !== this.isReady || wasStarting !== this.isStarting || wasError !== this.isError) {
            this.#adjustCheckInterval();
            this.#emit('statusChange', {
                isReady: this.isReady,
                isStarting: this.isStarting,
                isError: this.isError,
                status: this.status
            });
            getBodyScope().$evalAsync();
        }
    }

    /**
     * 處理狀態檢查錯誤
     * @private
     */
    #handleStatusError() {
        const wasReady = this.isReady;
        const wasStarting = this.isStarting;
        this.isReady = false;
        this.isStarting = false;
        
        if (wasReady !== this.isReady || wasStarting !== this.isStarting) {
            this.#adjustCheckInterval();
            this.#emit('error', {
                type: 'STATUS_CHECK_ERROR',
                isReady: this.isReady,
                isStarting: this.isStarting
            });
        }
    }

    /**
     * 檢查服務是否就緒
     * @param {Object} status - 狀態對象
     * @returns {boolean} 是否就緒
     * @private
     */
    #checkIfReady(status) {
        return status?.pythonServer?.healthy && status?.apiServer?.healthy;
    }

    /**
     * 檢查服務是否正在啟動中
     * @param {Object} status - 狀態對象
     * @returns {boolean} 是否正在啟動中
     * @private
     */
    #checkIfStarting(status) {
        return !status?.pythonServer?.healthy && status?.apiServer?.healthy;
    }

    /**
     * 檢查是否有錯誤
     * @param {Object} status - 狀態對象
     * @returns {boolean} 是否有錯誤
     * @private
     */
    #checkIfError(status) {
        // 檢查是否有任何錯誤
        const hasErrors = status?.errors || status?.apiServer?.hasErrors;
        
        if (hasErrors) {
            let errorMessage = '';
            let stopWatch = false;
            
            // 從新格式中提取錯誤訊息
            if (status?.errors?.pythonServer) {
                errorMessage = status.errors.pythonServer?.message?.message || 'Unknown Python server error';
                stopWatch = true;
            } 
            // 初始化錯誤
            else if (status?.errors?.initialization) {
                errorMessage = status.errors.initialization?.message?.message || 'Unknown initialization error';
                stopWatch = true;
            }
            // 超過允許同步的上限
            else if (status?.errors?.tooManyItems) {
                errorMessage = status.errors.tooManyItems?.message?.message || 'Unknown too many items error';
            } else {
                errorMessage = 'AI Search service error';
            }
            
            // 只在首次檢測到錯誤時顯示提示（避免重複提示）
            if (!this.isError) {
                
                // 停止狀態監控
                if (stopWatch) {
                    this.stopWatching();
                }

                this.isStarting = false;
                this.isReady = false;
                getBodyScope().$evalAsync();
                
                // 顯示錯誤訊息
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__("dialog.aiSearchServerError.title")}</h4>
                            <p class="alert-desc">${i18n.__("dialog.aiSearchServerError.desc")}: ${errorMessage}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__("dialog.aiSearchServerError.button"),
                }).then(() => {
                    this.open();
                });
            }
            
            // 觸發錯誤事件
            this.#emit('error', {
                type: 'AI_SEARCH_ERROR',
                message: errorMessage,
                details: status.errors
            });
            
            return true;
        }
        
        // 如果之前有錯誤但現在沒有了，觸發錯誤清除事件
        if (this.isError && !hasErrors) {
            this.#emit('errorCleared', {
                type: 'AI_SEARCH_ERROR',
                status: status
            });
            
            // 如果錯誤已清除且 watcher 未運行，重新啟動監控
            if (!this.#statusWatcher && this.isInstalled) {
                this.#startStatusWatcher();
            }
        }
        
        return false;
    }

    /**
     * 調整檢查間隔
     * @private
     */
    #adjustCheckInterval() {
        if (this.#statusWatcher) {
            clearInterval(this.#statusWatcher);
            
            const interval = this.isReady 
                ? AISearch.#CONFIG.INTERVALS.READY 
                : AISearch.#CONFIG.INTERVALS.NOT_READY;
            
            const checkStatus = async () => {
                try {
                    const response = await fetch(
                        `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.STATUS}`
                    );
                    const data = await response.json();
                    
                    this.#updateStatus(data.status);
                } catch (error) {
                    console.error('Error checking status:', error);
                    this.#handleStatusError();
                }
            };
            
            this.#statusWatcher = setInterval(checkStatus, interval);
        }
    }

    /**
     * 觸發事件
     * @param {string} event - 事件名稱
     * @param {*} data - 事件數據
     * @private
     */
    #emit(event, data) {
        if (this.#listeners.has(event)) {
            this.#listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * 執行搜尋請求
     * @param {string} endpoint - API 端點
     * @param {*} data - 請求數據
     * @param {string} method - HTTP 方法
     * @param {Object} headers - 請求頭
     * @returns {Promise<Object>} 搜尋結果
     * @private
     */
    async #executeSearch(endpoint, data, method = 'POST', headers = {}, signal) {
        try {
            this.isSearching = true;

            const requestOptions = {
                method,
                headers
            };

            // 根據數據類型設置請求體
            if (data instanceof FormData) {
                requestOptions.body = data;
            } else {
                requestOptions.body = JSON.stringify(data);
            }

            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${endpoint}`,
                requestOptions,
                AISearch.#CONFIG.TIMEOUTS.SEARCH,
                signal
            );

            return await this.#handleSearchResponse(response);
        } finally {
            this.isSearching = false;
        }
    }

    /**
     * 處理搜尋響應
     * @param {Response} response - fetch 響應
     * @returns {Promise<Object>} 搜尋結果
     * @private
     */
    async #handleSearchResponse(response) {
        if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(
                errorData.message || 
                `Search failed: ${response.status} ${response.statusText}`
            );
            error.status = response.status;
            error.data = errorData;
            error.code = AISearch.#CONFIG.ERRORS.SEARCH_FAILED;
            throw error;
        }

        return await response.json();
    }

    /**
     * 具有超時功能的 fetch 包裝器
     * @param {string} url - 請求 URL
     * @param {Object} options - fetch 選項
     * @param {number} timeoutMs - 超時時間（毫秒）
     * @returns {Promise<Response>} fetch 響應
     * @private
     */
    async #fetchWithTimeout(
        url,
        options = {},
        timeoutMs = AISearch.#CONFIG.TIMEOUTS.DEFAULT,
        externalSignal
    ) {
        const controller = new AbortController();

        // 設置超時自動 abort
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // 若有外部 signal，監聽其 abort 事件來連動
        if (externalSignal) {
            if (externalSignal.aborted) {
                clearTimeout(timeoutId);
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                throw err;
            }
            externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } catch (error) {
            // 外部 abort 時直接拋出，不做 enhanceError 轉換
            if (externalSignal?.aborted) {
                throw error;
            }
            throw this.#enhanceError(error, timeoutMs);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * 增強錯誤信息
     * @param {Error} error - 原始錯誤
     * @param {number} timeoutMs - 超時時間
     * @returns {Error} 增強後的錯誤
     * @private
     */
    #enhanceError(error, timeoutMs) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            const timeoutError = new Error(
                `Request timeout (${timeoutMs / 1000} seconds)`
            );
            timeoutError.code = AISearch.#CONFIG.ERRORS.TIMEOUT;
            return timeoutError;
        }
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            const networkError = new Error('Cannot connect to API server');
            networkError.code = AISearch.#CONFIG.ERRORS.NETWORK_ERROR;
            return networkError;
        }
        
        return error;
    }

    /**
     * 獲取默認搜尋選項
     * @returns {Object} 默認選項
     * @private
     */
    #getDefaultSearchOptions() {
        return {
            limit: AISearch.#CONFIG.DEFAULT_SEARCH_LIMIT
        };
    }

    /**
     * 驗證插件是否已安裝
     * @throws {Error} 插件未安裝時拋出錯誤
     * @private
     */
    #validateInstalled() {
        if (!this.isInstalled) {
            const error = new Error('AI Search plugin is not installed');
            error.code = AISearch.#CONFIG.ERRORS.PLUGIN_NOT_INSTALLED;
            throw error;
        }
    }

    /**
     * 驗證服務是否就緒
     * @throws {Error} 服務未就緒時拋出錯誤
     * @private
     */
    #validateServiceReady() {
        this.#validateInstalled();
        if (!this.isReady) {
            const error = new Error('AI Search service is not ready');
            error.code = AISearch.#CONFIG.ERRORS.SERVICE_NOT_READY;
            throw error;
        }
    }

    /**
     * 驗證文字查詢
     * @param {string} query - 查詢字串
     * @throws {Error} 查詢無效時拋出錯誤
     * @private
     */
    #validateTextQuery(query) {
        if (!query || query.trim() === '') {
            throw new Error('Search query cannot be empty');
        }
    }

    /**
     * 驗證圖片檔案
     * @param {File} imageFile - 圖片檔案
     * @throws {Error} 檔案無效時拋出錯誤
     * @private
     */
    #validateImageFile(imageFile) {
        if (!imageFile) {
            throw new Error('Please select an image file');
        }

        if (!imageFile.type.startsWith('image/')) {
            throw new Error('Please select a valid image file');
        }
    }

    /**
     * 創建圖片搜尋表單數據
     * @param {File} imageFile - 圖片檔案
     * @param {Object} options - 搜尋選項
     * @returns {FormData} 表單數據
     * @private
     */
    #createImageSearchFormData(imageFile, options) {
        const searchOptions = {
            ...this.#getDefaultSearchOptions(),
            ...options
        };

        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('limit', searchOptions.limit.toString());

        return formData;
    }

    /**
     * 將 Base64 字串轉換為 File 對象
     * @param {string} base64String - Base64 編碼的圖片
     * @returns {File} 文件對象
     * @private
     */
    #convertBase64ToFile(base64String) {
        // 移除 data URL 前綴
        const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
        
        // 檢測圖片格式
        let mimeType = 'image/png';
        if (base64String.startsWith('data:image/')) {
            const matches = base64String.match(/^data:image\/([a-z]+);base64,/);
            if (matches && matches[1]) {
                mimeType = `image/${matches[1]}`;
            }
        }

        try {
            // 將 base64 轉換為 blob
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            
            // 創建 File 對象
            const fileName = `image_${Date.now()}.${mimeType.split('/')[1]}`;
            return new File([blob], fileName, { type: mimeType });
        } catch (error) {
            if (error.message.includes('atob')) {
                throw new Error('Invalid base64 string');
            }
            throw error;
        }
    }
}

// 創建全局實例
eagle.aiSearch = new AISearch();
class CustomExport {
    // 私有屬性
    #pluginId = 'custom-export';
    #listeners = new Map(); // 事件監聽器

    // 公開屬性
    isInstalled = false;
    
    init() {
        this.isInstalled = pluginModule.checkPluginInstalled(this.#pluginId);

        ipcRenderer.on('plugin-installed', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = true;
                getBodyScope().$evalAsync();
            }
        });

        ipcRenderer.on('plugin-uninstalled', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = false;
                getBodyScope().$evalAsync();
            }
        });
    }

    open(items) {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        const ids = items.map(item => item.id);
        pluginModule.openPluginById(this.#pluginId, { ids });
    }
}

// 創建全局實例
eagle.customExport = new CustomExport();
class CombineImages {
    #pluginId = 'combine-images';
    isInstalled = false;

    init() {
        this.isInstalled = pluginModule.checkPluginInstalled(this.#pluginId);

        ipcRenderer.on('plugin-installed', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = true;
                getBodyScope().$evalAsync();
            }
        });

        ipcRenderer.on('plugin-uninstalled', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = false;
                getBodyScope().$evalAsync();
            }
        });
    }

    open(items) {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        const ids = items.map(item => item.id);
        pluginModule.openPluginById(this.#pluginId, { ids });
    }
}

eagle.combineImages = new CombineImages();

class AIAction {
    // 私有屬性
    #pluginId = 'ai-action';
    #listeners = new Map(); // 事件監聽器
    #configPath = '';
    #actions = [];

    // 公開屬性
    isInstalled = false;

    init() {
        this.isInstalled = pluginModule.checkPluginInstalled(this.#pluginId);

        ipcRenderer.on('plugin-installed', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = true;
                getBodyScope().$evalAsync();
            }
        });

        ipcRenderer.on('plugin-uninstalled', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = false;
                getBodyScope().$evalAsync();
            }
        });
    }

    // Library 開啟時初始化 actions config
    initActions(rootDir) {
        this.destroy();
        this.#configPath = path.join(rootDir, 'actions.config.json');
        this.#loadActions();
        this.#watchConfig();
    }

    #loadActions() {
        try {
            if (fs.existsSync(this.#configPath)) {
                const data = fs.readFileSync(this.#configPath, 'utf8');
                this.#actions = JSON.parse(data);
            } else {
                this.#actions = [];
            }
        } catch (err) {
            this.#actions = [];
        }
    }

    #watchConfig() {
        this.#unwatchConfig();
        try {
            if (fs.existsSync(this.#configPath)) {
                fs.watchFile(this.#configPath, { persistent: true, interval: 4000 }, (curr, prev) => {
                    if (curr.mtimeMs === prev.mtimeMs) return;
                    if (!fs.existsSync(this.#configPath)) return;
                    this.#loadActions();
                    getBodyScope().$root.initMenu();
                    getBodyScope().$evalAsync();
                });
            }
        } catch (err) {}
    }

    #unwatchConfig() {
        try {
            if (this.#configPath && fs.existsSync(this.#configPath)) {
                fs.unwatchFile(this.#configPath);
            }
        } catch (err) {}
    }

    get actions() {
        return this.#actions;
    }

    formatShortcut(shortcut) {
        if (!shortcut) return '';
        if (process.platform === 'win32') {
            return shortcut.replace("Command", "CmdOrCtrl");
        }
        return shortcut;
    }

    runByShortcut(actionId) {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        pluginModule.openPluginById(this.#pluginId, {
            triggerType: 'shortcut',
            actionId: actionId,
        });
    }

    open(items) {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        const ids = items.map(item => item.id);
        pluginModule.openPluginById(this.#pluginId, { ids });
    }

    show() {
        pluginModule.showPluginById(this.#pluginId);
    }

    isOpen() {
        // 檢查插件是否已安裝且服務就緒
        if (!this.isInstalled) {
            return false;
        }
        return pluginModule.isOpen(this.#pluginId);
    }

    isVisible() {
        if (!this.isInstalled) {
            return false;
        }
        return pluginModule.isVisible(this.#pluginId);
    }

    destroy() {
        this.#unwatchConfig();
        this.#actions = [];
        this.#configPath = '';
    }
}

// 創建全局實例
eagle.action = new AIAction();

