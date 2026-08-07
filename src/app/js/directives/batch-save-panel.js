EagleApp.directive('batchSavePanel', function($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/batch-save-panel.html',
        scope: {
            theme: '=theme',
            folders: "=folders",
            folderMappings: "=folderMappings",
            uploadQueue: "=uploadQueue",
            uploadUrls: "=uploadUrls",
            addToRecentFolders: "=addToRecentFolders",
            TagManager: "=tagManager",
        },
        link: ($scope, element) => {

            const ipcRenderer = require('electron').ipcRenderer;
            const batchSaver = new BatchSaver(() => {
                calculateResult();
                $scope.$evalAsync();
            });

            $scope.isOpen = false;

            // 事件處理
            $scope.$on("IMPORT_IMAGES", (e, params) => {
                $scope.isOpen = true;
                init(params);
            });

            ipcRenderer.on("open-batch-save-panel", (event, params) => {
                $scope.isOpen = true;
                init(params);
                $scope.$evalAsync();
            });


            function init(params) {

                // Note: 取消全域选取的图片
                $bodyScope.selected = [];
                $scope.params = params;
                $scope.items = [];
                $scope.displayed = [];
                $scope.selected = [];
                $scope.importFolders = params.importFolders || [];
                $scope.tags = [];
                $scope.url = params.url || "";
                $scope.batchSaver = batchSaver;
                $scope.filter = {
                    ext: undefined,
                    size: undefined,
                    keyword: undefined,
                    domain: undefined,
                };

                $scope.counts = {
                    ext: {},
                    size: {},
                    domain: {},
                    selected: {
                        ext: {},
                        size: {},
                        domain: {},
                    },
                    total: 0
                };

                $scope.listSize = 150;


                // 修改 refer 避免图片呈现不出来
                try {
                    const refer = $scope.url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) && $scope.url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i)[0];
                    remote.require('electron-referer')(refer, remote.getCurrentWindow());
                }
                catch (err) {
                    console.error(err);
                }

                let uniqueUrls = {};
                let tasks = [];
                params.images.forEach((image) => {
                    if (!uniqueUrls[image.src]) {
                        uniqueUrls[image.src] = true;
                        tasks.push({
                            src: image.src,
                            url: image.url,
                            title: image.title,
                            width: image.width,
                            height: image.height,
                        });
                    }
                });

                $scope.items = batchSaver.loadTasks(tasks);

                calculateResult();
                $scope.updateSelectedCount();
                $scope.focusInput();
                setTimeout(() => {
                    $scope.focusInput();
                }, 200);
                analytics.event('BatchCollect', 'Open');
            };

            function calculateResult(ignoreCalculateExtensionCount) {

                $scope.counts = {
                    ext: {},
                    size: {},
                    domain: {},
                    selected: {
                        ext: {},
                        size: {},
                        domain: {},
                    },
                    has: {
                        ext: {},
                        size: {},
                        domain: {},
                    },
                    total: 0,
                };

                $scope.counts.total = $scope.items.length;

                // 計算域名及對應數量
                $scope.domainMappings = {};
                $scope.domains = [];
                $scope.items.forEach((item) => {
                    if (item.url) {
                        let url = new URL(item.url);
                        let domain = url.hostname;
                        if (!$scope.domainMappings[domain]) {
                            $scope.domainMappings[domain] = true;
                            $scope.domains.push(domain);
                            $scope.counts.has.domain[domain] = true;
                        }
                        // update ext size has map
                        const image = item.large ?? item.original;
                        $scope.counts.has.ext[image.ext] = true;
                        $scope.counts.has.size[image.size] = true;
                    }
                });

                // 排序 domains，依據數量多寡
                $scope.domains = $scope.domains.sort((a, b) => {
                    return $scope.counts.domain[b] - $scope.counts.domain[a];
                });


                $scope.displayed = [...$scope.items];

                // 類型篩選
                if ($scope.filter.ext) {
                    $scope.displayed = $scope.displayed.filter((item) => {
                        const image = item.large ?? item.original;
                        if (image?.ext === undefined) return false;
                        if ($scope.filter.ext === undefined) return true;
                        return image.ext === $scope.filter.ext;
                    });
                }

                // 大小篩選
                if ($scope.filter.size) {
                    if ($scope.filter.size === "advanced") {
                        if (batchSaver.filterMinW || batchSaver.filterMinH || batchSaver.filterMaxW || batchSaver.filterMaxH) {
                            $scope.displayed = $scope.displayed.filter((item) => {
                                const image = item.large ?? item.original;
                                if (image?.width === undefined || image?.height === undefined) return false;
                                if (batchSaver.filterMinW && image.width < batchSaver.filterMinW) return false;
                                if (batchSaver.filterMinH && image.height < batchSaver.filterMinH) return false;
                                if (batchSaver.filterMaxW && image.width > batchSaver.filterMaxW) return false;
                                if (batchSaver.filterMaxH && image.height > batchSaver.filterMaxH) return false;
                                return true;
                            });
                        }
                    }
                    else {
                        $scope.displayed = $scope.displayed.filter((item) => {
                            const image = item.large ?? item.original;
                            if (image?.size === undefined) return false;
                            if ($scope.filter.size === undefined) return true;
                            return image.size === $scope.filter.size;
                        });
                    }
                }

                // 網域篩選
                if ($scope.filter.domain) {
                    $scope.displayed = $scope.displayed.filter((item) => {
                        if (item?.url === undefined) return false;
                        let url = new URL(item.url);
                        return url.hostname === $scope.filter.domain;
                    });
                }

                // 關鍵字篩選
                if ($scope.filter.keyword) {
                    $scope.displayed = $scope.displayed.filter((item) => {
                        if (item?.title === undefined) return false;
                        let title = item.title;
                        let ext = item.large?.ext ?? item.original?.ext;
                        let fileName = `${title}.${ext}`.toLowerCase();
                        let keywords = $scope.filter.keyword.split(" ");
                        let isMatch = true;
                        for (let i = 0; i < keywords.length; i++) {
                            let keyword = keywords[i].toLowerCase();
                            let idx = fileName.indexOf(keyword);
                            if (idx === -1) isMatch = false;
                        }
                        return isMatch;
                    });
                }

                // 將寬、高少於 200px 的放在最尾端，並針對這些圖片進行寬度大小排序
                const smalls = $scope.displayed.filter((item) => {
                    const image = item.large ?? item.original;
                    return image.width < 200 || image.height < 200;
                }).sort((a, b) => {
                    const imageA = a.large ?? a.original;
                    const imageB = b.large ?? b.original;
                    if (imageA.width < imageB.width) {
                        return 1;
                    }
                    else if (imageA.width > imageB.width) {
                        return -1;
                    }
                    else {
                        return 0;
                    }
                });

                const bigs = $scope.displayed.filter((item) => {
                    return smalls.indexOf(item) === -1;
                });

                $scope.displayed = [...bigs, ...smalls];

                console.log($scope.items.length, $scope.displayed.length);
                console.log($scope.counts);

                $scope.displayed.forEach((item) => {
                    const image = item.large ?? item.original;
                    $scope.counts.ext[image.ext] = ($scope.counts.ext[image.ext]) ? $scope.counts.ext[image.ext] + 1 : 1;
                    $scope.counts.size[image.size] = ($scope.counts.size[image.size]) ? $scope.counts.size[image.size] + 1 : 1;
                    if (item.url) {
                        let url = new URL(item.url);
                        let domain = url.hostname;
                        $scope.counts.domain[domain] = ($scope.counts.domain[domain]) ? $scope.counts.domain[domain] + 1 : 1;
                    }
                });

                $scope.updateSelectedCount();
            }

            function initMouseWheelEvent(element) {
                element.find(".gallery").on("mousewheel.zoomming", (e) => {
                    if (e.altKey || e.ctrlKey) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });

                element.find(".gallery").on("mousewheel.zoomming", throttle((e) => {
                    if (e.altKey || e.ctrlKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        var speedControl = 2;
                        if (process.platform == 'darwin') {
                            speedControl = 1;
                        }
                        var delta = Math.abs(e.originalEvent.wheelDelta / 20);
                        var ne = e.originalEvent.wheelDelta / Math.abs(e.originalEvent.wheelDelta) || 1;
                        if (delta < 10) delta = 10;
                        if (delta > 80) delta = 80;
                        delta = ne * delta * speedControl;
                        $scope.listSize += (delta * 1.2);
                        $scope.listSize = Math.floor($scope.listSize / 5) * 5;
                        if ($scope.listSize > 600) $scope.listSize = 600;
                        if ($scope.listSize < 50) $scope.listSize = 50;
                        $("#batch-save-panel-slider").val($scope.listSize);
                        $scope.$evalAsync();
                        return false;
                    }
                }, 50, true));
            }

            $scope.selectFolders = ($event) => {

                const folders = $scope.folders;
                let originalSelectedIds = $scope.importFolders.reduce((map, folder) => {
                    map[folder.id] = true;
                    return map;
                }, {});

                FolderSelectPanel.open({
                    folders: folders,
                    selectedIds: originalSelectedIds,
                    onChanged: (result) => {
                        if (!result?.isDirty) return;

                        const { selectedFolderIds, deselectedFolderIds } = result;

                        $scope.importFolders = [];
                        Object.keys(selectedFolderIds).forEach((id) => {
                            let folder = $scope.folderMappings[id];
                            if (folder) {
                                $scope.importFolders.push(folder);
                            }
                        });
                        $scope.$evalAsync();
                    },
                    onClosed: () => {
                        $scope.focusInput();
                    }
                });
            };

            $scope.removeImportFolder = (event, folder) => {
                event.stopPropagation();
                $scope.importFolders = $scope.importFolders.filter((fd) => {
                    return fd.id !== folder.id;
                });
            };

            $scope.selectTags = ($event) => {
                const originSelected = $scope.tags.reduce((acc, cur) => {
                    acc[cur] = true;
                    return acc;
                }, {});

                GeneralTagSelectPanel.open({
                    tagManager: $scope.TagManager,
                    selectedTags: originSelected,
                    onChanged: (result) => {

                        if (!result?.isDirty) return;
                        const { selectedTags, deselectedTags } = result;

                        if (Object.keys(selectedTags).length > 0) {
                            let tags = [];
                            Object.keys(selectedTags).forEach((tag) => {
                                if (originSelected[tag]) return;
                                tags.push(tag);
                            });
                            $scope.tags = [...$scope.tags, ...tags];
                        }

                        if (Object.keys(deselectedTags).length > 0) {
                            $scope.tags = $scope.tags.filter((tag) => {
                                return !deselectedTags[tag];
                            });
                        }

                        $scope.$evalAsync();
                    },
                    onClosed: () => {
                        $scope.focusInput();
                    }
                });
            };

            $scope.removeImportTag = (event, t) => {
                event.stopPropagation();
                $scope.tags = $scope.tags.filter((tag) => {
                    return tag !== t;
                });
            };

            $scope.onFilterChange = () => {
                calculateResult(true);
            };

            $scope.focusMinWInput = () => {
                setTimeout(() => {
                    $("#batch-saver-min-w").focus();
                }, 100);
            };

            $scope.focusInput = () => {
                setTimeout(() => {
                    $("#batch-save-panel-input").focus();
                }, 24);
            };

            $scope.onKeyup = (event) => {
                event.stopPropagation();
                event.preventDefault();
                var keyCode = event.keyCode;
                if (keyCode === 65) {
                    if (event.metaKey || event.ctrlKey) {
                        $scope.selectAll();
                    }
                }
                else if (keyCode === 27) {
                    if ($scope.selected.length > 0) {
                        $scope.selected = [];
                        $scope.updateSelectedCount();
                    }
                    else {
                        $scope.close();
                    }
                }
                else if (keyCode === 46 || keyCode === 8) {
                    $scope.removeSelected(event);
                }
                else if (keyCode === 70) {
                    if (event.metaKey || event.ctrlKey) {
                        $("#batch-save-panel-search").focus();
                    }
                    else {
                        $scope.selectFolders(event);
                    }
                }
                else if (keyCode === 84) {
                    $scope.selectTags(event);
                }
                else if (keyCode === 13) {
                    if (event.metaKey || event.ctrlKey) {
                        $scope.import();
                    }
                }
                else if (keyCode === 107 || keyCode === 61 || keyCode === 187) {
                    $scope.zoomIn();
                }
                else if (keyCode === 109 || keyCode === 189) {
                    $scope.zoomOut();
                }
            };

            // 全选
            $scope.selectAll = () => {
                $scope.selected = [...$scope.selected, ...$scope.displayed];
                $scope.selected = [...new Set($scope.selected)];
                $scope.updateSelectedCount();
            };

            // 反选
            $scope.invertSelected = () => {
                $scope.selected = $scope.items.filter((item) => {
                    return $scope.selected.indexOf(item) === -1;
                });
                $scope.updateSelectedCount();
            };

            $scope.isSelected = (item) => $scope.selected.indexOf(item) !== -1;

            $scope.select = (event, item) => {

                event && event.stopPropagation();
                $scope.focusInput();

                var idx = $scope.selected.indexOf(item);
                var selectIdx = $scope.displayed.indexOf(item);

                if (idx !== -1) {
                    $scope.selected.splice(idx, 1);
                    $scope.updateSelectedCount();
                    return;
                }

                if (event.shiftKey) {
                    if ($scope.lastIdx !== undefined) {
                        if ($scope.lastIdx > selectIdx) {
                            for (var i = selectIdx; i <= $scope.lastIdx; i++) {
                                $scope.selected.push($scope.displayed[i]);
                            }
                        }
                        else {
                            for (var i = $scope.lastIdx; i <= selectIdx; i++) {
                                $scope.selected.push($scope.displayed[i]);
                            }
                        }
                    }
                    else {
                        $scope.selected.push(item);
                    }
                }
                else if (idx === -1) {
                    $scope.selected.push(item);
                    $scope.lastIdx = $scope.displayed.indexOf(item);
                }
                $scope.selected = [...new Set($scope.selected)];
                $scope.updateSelectedCount();
            };

            $scope.removeSelected = (event) => {
                event.stopPropagation();
                $scope.items = $scope.items.filter((item) => {
                    return $scope.selected.indexOf(item) === -1;
                });
                $scope.selected = [];
                calculateResult();
                $scope.updateSelectedCount();
            };

            $scope.updateSelectedCount = () => {
                $scope.counts.selected = {
                    ext: {},
                    size: {},
                    domain: {},
                };
                $scope.selected.forEach((item) => {
                    const image = item.large ?? item.original;
                    $scope.counts.selected.ext[image.ext] = ($scope.counts.selected.ext[image.ext]) ? $scope.counts.selected.ext[image.ext] + 1 : 1;
                    $scope.counts.selected.size[image.size] = ($scope.counts.selected.size[image.size]) ? $scope.counts.selected.size[image.size] + 1 : 1;
                    if (item.url) {
                        let url = new URL(item.url);
                        let domain = url.hostname;
                        $scope.counts.selected.domain[domain] = ($scope.counts.selected.domain[domain]) ? $scope.counts.selected.domain[domain] + 1 : 1;
                    }
                });
            };

            $scope.zoomIn = (event) => {
                $scope.listSize += 50;
                if ($scope.listSize > 600) $scope.listSize = 600;
                if ($scope.listSize < 50) $scope.listSize = 50;
            };

            $scope.zoomOut = (event) => {
                $scope.listSize -= 50;
                if ($scope.listSize > 600) $scope.listSize = 600;
                if ($scope.listSize < 50) $scope.listSize = 50;
            };

            $scope.import = () => {

                if ($scope.selected.length === 0) return;

                var names = [];
                var websiteUrls = [];
                var imageUrls = [];
                var duplicateNameMappings = {};

                // 避免图片名称一模一样，如果一样就加上序号
                $scope.selected.forEach((item) => {
                    if (duplicateNameMappings[item.title] === undefined) {
                        duplicateNameMappings[item.title] = 1;
                    }
                    else {
                        duplicateNameMappings[item.title]++;
                        item.title += " (" + duplicateNameMappings[item.title] + ")";
                    }
                });

                $scope.selected.reverse();
                $scope.selected.forEach((item) => {
                    const large = item.large;
                    const original = item.original;

                    if (item) {
                        names.push(item.title);
                        websiteUrls.push(item.url ?? $scope.url ?? "");
                        if (item.hasLarge) {
                            imageUrls.push(large?.base64 ?? large?.src ?? original?.src ?? item.src);
                        }
                        else {
                            imageUrls.push(original.base64 ?? original.src ?? item.src);
                        }
                        $scope.uploadQueue.push({});
                    }
                });

                const folderIds = $scope.importFolders.map((fd) => fd.id);
                const tags = $scope.tags;

                $scope.uploadUrls(imageUrls, folderIds, {
                    names: names,
                    urls: websiteUrls,
                    tags: tags,
                });

                $scope.addToRecentFolders(folderIds);
                $scope.close();
                $scope.$evalAsync();
            };

            $scope.cancel = () => {
                $scope.close();
            };

            $scope.close = () => {
                $scope.isOpen = false;
                $scope.items = [];
                $scope.selected = [];
            };

            initMouseWheelEvent(element);
        }
    }
});

class BatchSaver {

    constructor(onChange) {
        this.onChange = throttle(onChange, 100, true);
    }

    // 轉換格式
    loadTasks(tasks) {
        let result = [];
    
        for (let task of tasks) {
    
            let item = { 
                src: task.src, 
                url: task.url, 
                title: task.title,
                original: {
                    title: task.title,
                    url: task.url,
                    src: task.src,
                    width: task.width,
                    height: task.height,
                    type: "image",
                    ext: "Other"
                },
            };
    
            this.loadOriginal(item).then(() => {
                this.onChange();
            });
    
            this.loadLarge(item).then(() => {
                this.onChange();
            });
    
            result.push(item);
        }
    
        return result;
    }
    
    // 載入原始圖片資訊
    async loadOriginal(item) {
        return new Promise(async (resolve, reject) => {
            await this.loadImage(item, item.src, 'original');
            return resolve(item);
        });
    }
    
    // 載入大圖資訊
    async loadLarge(item) {
        return new Promise(async (resolve, reject) => {
            if (eagle.urlEnlarger.isEnlargable(item.src)) {
                const { url: src, largeUrl: largeSrc } = await eagle.urlEnlarger.enlarge(item.src);
                if (largeSrc && src !== largeSrc) {
                    item.hasLarge = true;
                    await this.loadImage(item, largeSrc, 'large');
                    return resolve(item);
                }
                else {
                    item.hasLarge = false;
                    return resolve(item);
                }
            }
            else {
                item.hasLarge = false;
                return resolve(item);
            }
        });
    }
    
    // 載入圖片資訊
    async loadImage(item, src, objectKey) {
        return new Promise(async (resolve, reject) => {
    
            // 將 Blob 轉換成 Base64
            const blobToBase64 = async (blob) => {
                return new Promise((resolve, reject) => {
                    let reader = new FileReader();
                    reader.onload = () => {
                        let dataUrl = reader.result;
                        resolve(dataUrl);
                    };
                    reader.readAsDataURL(blob);
                });
            }

            const getBlobMimeType = async (blob) => {
                return new Promise((resolve, reject) => {
                    const fileReader = new FileReader();

                    fileReader.onloadend = function (e) {
                        const arr = (new Uint8Array(e.target.result)).subarray(0, 4);
                        let header = '';
                        for (let i = 0; i < arr.length; i++) {
                            header += arr[i].toString(16).padStart(2, '0');
                        }

                        let mimeType = 'unknown';

                        // Check the file signature against known types
                        switch (header) {
                            case '89504e47':
                                mimeType = 'image/png';
                                break;
                            case '47494638':
                                mimeType = 'image/gif';
                                break;
                            case 'ffd8ffe0':
                            case 'ffd8ffe1':
                            case 'ffd8ffe2':
                            case 'ffd8ffe3':
                                mimeType = 'image/jpeg';
                                break;
                            // webp
                            case '52494646':
                                mimeType = 'image/webp';
                                break;
                            // avif
                            case '41564946':
                                mimeType = 'image/avif';
                                break;
                            // mp4
                            case '66747970':
                                mimeType = 'video/mp4';
                                break;
                            // webm
                            case '1a45dfa3':
                                mimeType = 'video/webm';
                                break;
                            // Add more cases for different file types here
                            default:
                                mimeType = 'application/octet-stream'; // default binary type
                        }
                        resolve(mimeType);
                    };

                    fileReader.onerror = function (e) {
                        reject(e);
                    };

                    fileReader.readAsArrayBuffer(blob.slice(0, 4));
                });
            }

            let result = {};
            if (src.startsWith('data:image')) {
                // 如果URL是base64編碼的圖片數據，則不需要進行fetch下載
                result.blobUrl = src;
                result.base64 = src;
                result.width = item.width;
                result.height = item.height;
                result.ext = this.getExtension(src);
                result.type = "image";
                result.size = this.getSize(item.width, item.height);
                result.resolution = this.getResolution(item.width, item.height);
            } else {
                try {
                    let response = await fetch(src);
                    let contentType = response.headers.get('content-type') || '';
                    let contentDisposition = response.headers.get('content-disposition') || '';

                    if (!response.ok) {
                        result.ext = this.getExtension(src);
                        result.type = (result.ext === "mp4" || result.ext === "webm") ? "video" : "image";
                        result.width = item?.original?.width || 0;
                        result.height = item?.original?.height || 0;
                        result.size = this.getSize(result.width, result.height);
                        result.resolution = `${item?.original?.width || 0} x ${item?.original?.height || 0}`;
                    }
                    else {
                        result.contentType = contentType;
                        result.type = contentType.split('/')[0];

                        if (contentType === "application/octet-stream") {
                            let blob = await response.blob();
                            const cdResult = this.getContentDispositionType(contentDisposition);
                            
                            if (cdResult.type) {
                                result.type = cdResult.type;
                                result.ext = cdResult.ext;
                            }
                            else {
                                let mimeType = await getBlobMimeType(blob);
                                result.contentType = mimeType;
                                result.type = mimeType.split('/')[0];     
                                result.ext = this.getExtension(mimeType);                   
                            }

                            result.blobUrl = src;
                        }
                        else if (contentType.includes('image/')) {
                            // let blob = await response.blob();
                            // let blobUrl = URL.createObjectURL(blob);
                            // let base64 = await blobToBase64(blob);
                            
                            result.ext = this.getExtension(contentType);
                            // result.blob = blob;
                            // result.blobUrl = blobUrl;
                            // result.base64 = base64;
                            // release blob 
                            // URL.revokeObjectURL(blobUrl);

                            result.blobUrl = src;
                        }
                        else if (contentType.includes('video/')) {
                            result.src = src;
                            result.ext = this.getExtension(contentType);
                        }
                    }
                }
                catch (err) {
                    // debugger
                }
            }
            
            if (result.type === "image") {
                // 這裡可以獲取圖片的寬高
                let image = new Image();
                const releaseImage = () => {
                    image.onload = null;
                    image.onerror = null;
                    image.scr = "";
                    image = null;
                };
                image.onload = () => {
                    result.width = image.width;
                    result.height = image.height;
                    result.size = this.getSize(result.width, result.height);
                    result.resolution = this.getResolution(result.width, result.height);
                    releaseImage();
                    return resolve(item);
                }
                image.onerror = () => {
                    result.width = 0;
                    result.height = 0;
                    result.size = this.getSize(result.width, result.height);
                    result.resolution = this.getResolution(result.width, result.height);
                    releaseImage();
                    return resolve(item);
                }
                image.src = result.blobUrl || result.src;
            }
            else if (result.type === "video") {
                let video = document.createElement('video');
                video.onloadedmetadata = () => {
                    result.width = video.videoWidth || item?.original?.width || 0;
                    result.height = video.videoHeight || item?.original?.height || 0;
                    result.video = video;
                    result.duration = video.duration;
                    result.size = this.getSize(result.width, result.height);
                    result.resolution = this.getResolution(result.width, result.height);
                    return resolve(item);
                }
                video.onerror = () => {
                    result.width = result.width || item?.original?.width || 0;
                    result.height = result.height || item?.original?.height || 0;
                    result.duration = 0;
                    result.size = this.getSize(result.width, result.height);
                    result.resolution = this.getResolution(result.width, result.height);
                    return resolve(item);
                }
                video.src = result.blobUrl || result.src;
            }
            item[objectKey] = result;
        });
    }

    getSize(width, height) {
        if (width >= 600 || height >= 600) {
            return "large";
        }
        else if (width >= 160 || height >= 160) {
            return "medium";
        }
        return "small";
    }

    getResolution(width, height) {
        return `${width} x ${height}`;
    }

    getContentDispositionType (str) {
        str = str.toLowerCase();
        if (str.indexOf(".mp4") > -1) {
            return {
                type: "video",
                ext: "mp4"
            }
        }
        if (str.indexOf(".webm") > -1) {
            return {
                type: "video",
                ext: "webm"
            }
        }
        else if (str.indexOf(".png") > -1) {
            return {
                type: "image",
                ext: "png"
            }
        }
        else if (str.indexOf(".avif") > -1) {
            return {
                type: "image",
                ext: "avif"
            }
        }
        else if (str.indexOf(".jpg") > -1) {
            return {
                type: "image",
                ext: "jpg"
            }
        }
        else if (str.indexOf(".jpeg") > -1) {
            return {
                type: "image",
                ext: "jpeg"
            }
        }
        else if (str.indexOf(".svg") > -1) {
            return {
                type: "image",
                ext: "svg"
            }
        }
        else if (str.indexOf(".webp") > -1) {
            return {
                type: "image",
                ext: "webp"
            }
        }
        else if (str.indexOf(".gif") > -1) {
            return {
                type: "image",
                ext: "gif"
            }
        }
        return {};
    }

    getExtension(str) {
        str = str.toLowerCase();
        if (str.indexOf("png") > -1) {
            return "png";
        }
        else if (str.indexOf("avif") > -1) {
            return "avif";
        }
        else if (str.indexOf("jpg") > -1) {
            return "jpg";
        }
        else if (str.indexOf("jpeg") > -1) {
            return "jpg";
        }
        else if (str.indexOf("svg") > -1) {
            return "svg";
        }
        else if (str.indexOf("webp") > -1) {
            return "webp";
        }
        else if (str.indexOf("gif") > -1) {
            return "gif";
        }
        else if (str.indexOf("mp4") > -1) {
            return "mp4";
        }
        else if (str.indexOf("webm") > -1) {
            return "webm";
        }
        return "other";
    }

    get showTags() {
        return localStorage['eagle.batchSaver.showTags'] !== 'false';
    }
    set showTags(value) {
        localStorage['eagle.batchSaver.showTags'] = value;
    }

    get showFolders() {
        return localStorage['eagle.batchSaver.showFolders'] !== 'false';
    }
    set showFolders(value) {
        localStorage['eagle.batchSaver.showFolders'] = value;
    }

    get showSize() {
        return localStorage['eagle.batchSaver.showSize'] !== 'false';
    }
    set showSize(value) {
        localStorage['eagle.batchSaver.showSize'] = value;
    }

    get showExt() {
        return localStorage['eagle.batchSaver.showExt'] !== 'false';
    }
    set showExt(value) {
        localStorage['eagle.batchSaver.showExt'] = value;
    }

    get showDomains() {
        return localStorage['eagle.batchSaver.showDomains'] !== 'false';
    }
    set showDomains(value) {
        localStorage['eagle.batchSaver.showDomains'] = value;
    }

    get filterMinW() {
        return (localStorage['eagle.batchSaver.filterMinW'])? parseInt(localStorage['eagle.batchSaver.filterMinW']) : undefined;
    }
    set filterMinW(value) {
        if (value !== undefined) localStorage['eagle.batchSaver.filterMinW'] = parseInt(value) || "";
    }

    get filterMinH() {
        return (localStorage['eagle.batchSaver.filterMinH'])? parseInt(localStorage['eagle.batchSaver.filterMinH']) : undefined;
    }
    set filterMinH(value) {
        if (value !== undefined) localStorage['eagle.batchSaver.filterMinH'] = parseInt(value) || "";
    }

    get filterMaxW() {
        return (localStorage['eagle.batchSaver.filterMaxW'])? parseInt(localStorage['eagle.batchSaver.filterMaxW']) : undefined;
    }
    set filterMaxW(value) {
        if (value !== undefined) localStorage['eagle.batchSaver.filterMaxW'] = parseInt(value) || "";
    }

    get filterMaxH() {
        return (localStorage['eagle.batchSaver.filterMaxH'])? parseInt(localStorage['eagle.batchSaver.filterMaxH']) : undefined;
    }
    set filterMaxH(value) {
        if (value !== undefined) localStorage['eagle.batchSaver.filterMaxH'] = parseInt(value) || "";
    }
}

EagleApp.directive('batchRectSelect', ($rootScope) => ({
    link: ($scope, element, attrs) => {

        let rectSelection = {};
        let rectSelecting = false;
        let startX, startY;
        let offset = $(element).offset();
        let $rect = $('<div class="rect"></div>').hide();
        let $boxs;
        let originSelected = [];

        $("#batch-save-panel .gallery").prepend($rect);

        element.on("mousedown", (e) => {

            e.stopPropagation();

            if (e.which != 1) return;
            if (e.metaKey || e.shiftKey || event.ctrlKey) {
                originSelected = $scope.selected.map(function (i) {
                    return i;
                });
            } else {
                originSelected = [];
            }

            offset = $(element).offset();
            $boxs = element.find(".item");
            rectSelection.startX = startX = e.pageX - offset.left;
            rectSelection.startY = startY = e.pageY - offset.top + $(element).scrollTop();
            rectSelecting = true;

            $rect.css({
                top: rectSelection.startY,
                left: rectSelection.startX,
            });
            $rect.show();
        });

        $(window).on("mouseup", (e) => {
            if (!$scope.isOpen) return;
            e.stopPropagation();

            rectSelection = {};
            rectSelecting = false;

            $rect.css({
                top: 0,
                left: 0,
                width: 0,
                height: 0,
            });
            $rect.hide();
        });

        element.on("mousemove", (e) => {
            e.stopPropagation();

            if (rectSelecting) {
                const scrollTop = $(element).scrollTop(), flipX = startX > e.pageX - offset.left, flipY = startY > e.pageY - offset.top + scrollTop;

                rectSelection.w = Math.abs((e.pageX - offset.left) - startX);
                rectSelection.h = Math.abs((e.pageY - offset.top) - startY + scrollTop);

                if (flipX) {
                    rectSelection.startX = startX - rectSelection.w;
                }
                if (flipY) {
                    rectSelection.startY = startY - rectSelection.h;
                }
                $rect.css({
                    top: rectSelection.startY,
                    left: rectSelection.startX,
                    width: rectSelection.w,
                    height: rectSelection.h,
                });

                caculate();
            }
        });

        function contain(element) {
            const a = {
                width: element.width(),
                height: element.height(),
                x: element[0].offsetLeft,
                y: element[0].offsetTop
            }, b = {
                width: rectSelection.w,
                height: rectSelection.h,
                x: rectSelection.startX,
                y: rectSelection.startY
            };
            return !(
                ((a.y + a.height) < (b.y)) ||
                (a.y > (b.y + b.height)) ||
                ((a.x + a.width) < b.x) ||
                (a.x > (b.x + b.width))
            );
        };

        const caculate = throttle(() => {
            let rectSelected = [];
            let miss = 0;
            let hit = 0;
            let BreakException = {};

            try {
                $boxs.each(function () {
                    if (miss > 20) {
                        throw BreakException;
                    };
                    if (contain($(this))) {
                        hit++;
                        const item = angular.element(this).scope().image;
                        if (originSelected.indexOf(item) == -1) {
                            rectSelected.push(item);
                        }
                    }
                    else if (hit > 1) {
                        miss++;
                    }
                });
            }
            catch (e) {
            }

            if (rectSelected.length > 0) {
                $scope.selected = originSelected.concat(rectSelected);
                $scope.$evalAsync();
            }

        }, 100);
    }
}))