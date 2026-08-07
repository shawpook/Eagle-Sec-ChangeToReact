const FixUtils = {};

FixUtils.openContextMenu = function () {
    var contextMenu = new Menu();
    contextMenu.append(new MenuItem({
        label: i18n.__("context.fixUtils.fixThumbnail"),
        click: function() { 
            FixUtils.fixThumbnail();
        }
    }));
    
    // 修复无效文名
    contextMenu.append(new MenuItem({
        label: i18n.__("context.fixUtils.fixFileName"),
        click: function() { 
            FixUtils.fixFileName($bodyScope.allData);
        }
    }));
    // 清除无效文件夹
    contextMenu.append(new MenuItem({
        label: i18n.__("context.fixUtils.fixEmptyFolder"),
        click: function() { 
            FixUtils.clearEmptyFolder();
        }
    }));
    // 如果路徑沒有 metadata.json 就重新製作
    contextMenu.append(new MenuItem({
        label: "Repair damaged metadata.json files",
        click: function() { 
            FixUtils.fixDamagedMetadata($bodyScope.selected);
        }
    }));
    contextMenu.popup(currentWindow);
};

FixUtils.fixThumbnail = function () {
	electronLog.info(`[app] Fix selected files without thumbnails...`);
    var imageDir = decodeURIComponent($bodyScope.imagesDir);
    var needChangeNames = [];
    var needRegenerates = [];
    $bodyScope.selected.forEach(function (image) {
        try {
            var infoPath = `${imageDir}/${image.id}.info/`;
            var files = fs.readdirSync(infoPath);
            if (files.length < 2) {
                electronLog.info(`[app] The folder has no content: ${infoPath}`);
                return;
            }
            var file = files.filter(function (file) {
                return !file.endsWith("_thumbnail.png") && file.indexOf("metadata") === -1 && file.indexOf("DS_Store") === -1 && file.indexOf(image.ext) > -1
            })[0];
            if (file) {
                var fileName = file.split('.').slice(0, -1).join('.');
                var imageName = image.name;
                // case1: 文件名称与 metadata.json 记录的不同，重新校正名称，以文件名称为主
                if (fileName !== imageName) {
                    if (fileName !== decodeURIComponent(fileName)) {
                        image.name = sanitize(decodeURIComponent(fileName)).replace("://", "");
                        var finalPath = `${infoPath}/${file.replace(fileName, decodeURIComponent(sanitize(fileName)).replace("://", ""))}`;
                        try {
                            fs.renameSync(`${infoPath}/${file}`, finalPath);
                        }
                        catch (err) {

                        }
                    }
                    else {
                        image.name = fileName;
                    }
                    $bodyScope.updateItemView(image);
                    currentWindow.webContents.send("thumbnail-generated", image);
                    needChangeNames.push(image);
                    electronLog.info(`[app] The name differs from the record and is renamed: [${imageName} > ${image.name}]`);
                }
            }
            else {
                electronLog.info(`[app] File does not exist: ${infoPath}`);
            }
            // case2: 需要 Thumbnail 但缩略图已消失，重新制作缩略图
            if (!image.noThumbnail) {
                var thumbnailPath = FileUrlHelper.getThumbnailPath(image);
                if (!fs.existsSync(thumbnailPath)) {
                    needRegenerates.push(image);
                    electronLog.info(`[app] Thumbnail file missed, regenerate new thumbnail: ${infoPath}`);
                }
            }
        }
        catch (err) {
            electronLog && electronLog.error(err.stack || err);
        }
    });

    if (needRegenerates.length > 0) {
        ipcRenderer.send('regenerate-thumbnail', needRegenerates);
    }

    if (needChangeNames.length > 0) {
        $bodyScope.updateSelection();
        ayncsImagesChange(needChangeNames);
    }
};

FixUtils.fixFileName = function (items) {
	electronLog.info(`[app] Scanning files with invalid filenames...`);
    var changed = [];
    for (var i = 0; i < items.length; i++) {
        var image = items[i];
        if (image && image.name && image.name !== " ") {
            var fixName = sanitize(image.name).trim().substr(0, 250).replace(/&amp(?!;)/g, '&');
            // 名稱含有異常符號或太長
            if (fixName !== image.name) {
                image.oldName = image.name;
                image.name = fixName;
                image.newName = fixName;
                $bodyScope.updateItemView(image);
                changed.push(image);
            }
        }
    }
    if (changed.length > 0) {
        electronLog.info(`[app] Scan finished, found ${changed.length} files, Start fixing...`);
        console.log(changed);
        ayncsImagesChange(changed);
    }
    else {
        swal({
            title: i18n.__("dialog.fixUtils.fixName.noResult.title"),
            html: i18n.__("dialog.fixUtils.fixName.noResult.desc"),
            showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            confirmButtonColor: "#1373FB", // 1373FB DA4945
            cancelButtonColor: "#777777",
            confirmButtonText: i18n.__("general.ok")
        }).then(function () {});
        electronLog.info(`[app] No invalid files`);
    }
};

FixUtils.clearEmptyFolder = function () {
	function withoutCacheCheck(callback) {
        // 此功能禁止使用缓存状态进行，需要先强制重新载入
        if ($bodyScope.usingCache) {
            swal({
                title: i18n.__("dialog.fixUtils.removeEmptyFolder.reload.title"),
                html: i18n.__("dialog.fixUtils.removeEmptyFolder.reload.desc"),
                showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                width: 400,
                confirmButtonColor: "#1373FB", // 1373FB DA4945
                cancelButtonColor: "#777777",
                confirmButtonText: i18n.__("dialog.fixUtils.removeEmptyFolder.reload.button"),
                cancelButtonText:
                i18n.__("general.cancel"),
            }).then(function () {
                IPCHelper.send('reload-without-cache');
            });
        }
        else {
            if (callback) callback();
        }
    };

    // 此功能禁止使用缓存状态进行，需要先强制重新载入
    withoutCacheCheck(function () {

        electronLog.info(`[app] Check invalid content...`);

        var removeItems = [];
        var moveToTrashItems = [];
        var imageDir = decodeURIComponent($bodyScope.imagesDir);
        fs.readdir(imageDir, function(err, files) {

            $bodyScope.fixUtils.currentEmptyfolderRemoved = 0;
            $bodyScope.fixUtils.fixingCurr = 0;
            $bodyScope.fixUtils.fixingTotal = files.length;
            $bodyScope.fixUtils.isFixing = true;
            $bodyScope.$evalAsync();

            let cbs = files.map(function (file) {
                return function (callback) {
                    let infoPath = path.normalize($bodyScope.libraryPath + "/images/" + file);
                    var itemId = file.replace(".info", "");
                    let item = $bodyScope.itemMappings[itemId];
                    if (!item) {
                        if (file !== ".DS_Store" && !fs.existsSync(path.normalize(`${infoPath}/metadata.json`))) {
                            removeItems.push(itemId);
                            electronLog.info(`[app] ${infoPath} is not exists`);
                        }
                        callback();
                        $bodyScope.fixUtils.fixingCurr++;
                        // $bodyScope.$evalAsync();
                    }
                    else {
                        let rawPath = FileUrlHelper.getRawPath(item);
                        fs.exists(rawPath, function (isExists) {
                            if (!isExists) {
                                // case1: 資料夾根本不存在
                                if (!fs.existsSync(infoPath)) {
                                    removeItems.push(itemId);
                                    electronLog.info(`[app] ${infoPath} is not exists`);
                                }
                                else {
                                    let containsFiles = fs.readdirSync(infoPath);
                                    containsFiles = containsFiles.filter(function (p) {
                                    	return p !== ".DS_Store";
                                    });
                                    let correctNumber = 3;
                                    if (item.noThumbnail) { correctNumber = 2; }
                                    // case 2: 缺少檔案
                                    if (containsFiles.length <= 1) {
                                        if (!$bodyScope.itemMappings[itemId]) {
                                            removeItems.push(itemId);
                                            electronLog.info(`[app] ${infoPath} is empty`);
                                        }
                                        
                                        else {
                                            if (!item.isDeleted) {
                                                moveToTrashItems.push(item);
                                                electronLog.info(`[app] ${rawPath} is not exists`);
                                            }
                                        }
                                    }
                                    // case 3: 原檔案消失
                                    else if (!fs.existsSync(rawPath)) {
                                    // else if (containsFiles.length < correctNumber) {
                                        if (!item.isDeleted) {
                                            moveToTrashItems.push(item);
                                            electronLog.info(`[app] ${rawPath} is not exists`);
                                        }
                                    }
                                }
                            }
                            callback();
                            $bodyScope.fixUtils.fixingCurr++;
                            $bodyScope.$evalAsync();
                        });
                    }
                }
            });

            const async = require('async');
            async.parallelLimit(cbs, 10, function(err, result) {
                $bodyScope.fixUtils.fixingCurr = 0;
                $bodyScope.fixUtils.fixingTotal = 0;
                $bodyScope.fixUtils.isFixing = false;

                let total = removeItems.length + moveToTrashItems.length;

                if (total === 0) {
                    swal({
                        title: i18n.__("dialog.fixUtils.removeEmptyFolder.noResult.title"),
                        html: `${i18n.__("dialog.fixUtils.removeEmptyFolder.noResult.desc1")} ${total} ${i18n.__("dialog.fixUtils.removeEmptyFolder.noResult.desc2")}`,
                        showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                        width: 400,
                        confirmButtonColor: "#1373FB", // 1373FB DA4945
                        cancelButtonColor: "#777777",
                        confirmButtonText: i18n.__("general.ok")
                    }).then(function () {});
                }
                else {
                    swal({
                        title: i18n.__("dialog.fixUtils.removeEmptyFolder.hasResult.title"),
                        html: `${i18n.__("dialog.fixUtils.removeEmptyFolder.hasResult.desc1")} ${total} ${i18n.__("dialog.fixUtils.removeEmptyFolder.hasResult.desc2")}`,
                        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                        width: 400,
                        confirmButtonColor: "#F23459", // 1373FB DA4945
                        cancelButtonColor: "#777777",
                        confirmButtonText: i18n.__("dialog.fixUtils.removeEmptyFolder.hasResult.button"),
                        cancelButtonText: i18n.__("general.cancel"),
                    }).then(function () {

                        if (moveToTrashItems.length > 0) {
                            let now = Date.now();
                            moveToTrashItems.forEach(function (item) {
                                item.deletedTime = now;
                                item.isDeleted = true;
                                $bodyScope.updateFilterCounts(item, -1, now);
                            });
                            ayncsImagesChange(moveToTrashItems);
                            hiddenByCurrentFilter(moveToTrashItems);

                            $bodyScope.calculateImageBinding({ ignoreSort: true }, function() {
                                $bodyScope.updateSelection();
                            });
                        }

                        if (removeItems.length > 0) {
                            var imageIdString = removeItems.join(",");
                            IPCHelper.send('remove-empty-folders', imageIdString);
                            $bodyScope.fixUtils.removeEmptyFolderProgress = 0;
                            $bodyScope.fixUtils.currentEmptyfolderRemoved = 0;
                            $bodyScope.fixUtils.emptyFolderRemoved = removeItems.length;
                            $bodyScope.fixUtils.isCleaningEmptyFolders = true;
                        }

                        $bodyScope.$evalAsync();
                    });
                }
            });
        });
    });
};

FixUtils.fixDamagedMetadata = function () {

    let metadataPaths = [];
    let changed = [];
    let infoPaths = fs.readdirSync($bodyScope.libraryPath + "/images/");
    infoPaths.map(function (pathname) {
        if (!pathname || pathname === ".DS_Store") return;
        metadataPaths.push(path.normalize($bodyScope.libraryPath + "/images/" + pathname + "/metadata.json"));
    });
    electronLog.info(`[app] Scanning ${ metadataPaths.length} files metadata.json...`);
    let cbs =  metadataPaths.map(function (metadataPath) {
        return function (callback) {
            try {
                // let metadataPath = FileUrlHelper.getMetadataPath(item);
                fs.exists(metadataPath, function (isExists) {
                	// 狀況一、metadata.json 消失
                    if (!isExists) {
                        try {
                            electronLog.info(`[app] ${metadataPath} is missing, rebuild again...`);
                            let infoPath = metadataPath.replace("metadata.json", "");
                            let infoFiles = fs.readdirSync(infoPath);
                            infoFiles = infoFiles.filter(function (name) {
                                if (name === ".DS_Store") return false;
                                if (name.indexOf("_thumbnail.png") > -1) return false;
                                if (name.indexOf(".json") > -1) return false;
                                let ext = path.extname(name).replace(".", "");
                                if (EagleConfig.SUPPORT_FORMATS[ext.toLowerCase()]) {
                                    return true;
                                }
                                return false;
                            });
                            if (infoFiles.length > 0) {
                                let rawPath = infoPath + infoFiles[0];
                                let itemId = infoPath.split(".info")[0].split(path.normalize("images/"))[1];
                                let item;
                                if ($bodyScope.itemMappings[itemId]) {
                                    item = $bodyScope.itemMappings[itemId];
                                    ayncsImagesChange([item]);
                                }
                                else {
                                    item = {
                                        id: itemId,
                                        name: path.parse(rawPath).name,
                                        ext: getExt({ path: rawPath }),
                                        modificationTime: Date.now()
                                    }
                                    ayncsImagesGenerateThumbnail([item]);
                                }
                                changed.push(metadataPath);
                            }
                        }
                        catch (err) {
                            electronLog && electronLog.error(err.stack || err);
                        }
                    }
                    else {
                    	// 狀況二、metadata.json 無法解析，有些东西没显示在画面上
                    	let itemId = metadataPath.split(".info")[0].split(path.normalize("images/"))[1];
                    	let item = $bodyScope.itemMappings[itemId];
                    	let jsonStr;
                    	if (!item) {
                    		try {
                    			jsonStr = fs.readFileSync(metadataPath, 'utf8');
            					let itemObject = JSON.parse(jsonStr);
                    		}
                    		catch (err) {
                    			try {
                                    if (err.message.indexOf("in JSON at position ") > -1) {
                                        electronLog.info(`[app] ${metadataPath} is damaged, try to fix...`);
                        				let position = err.message.split("in JSON at position ")[1];
                        				if (position) {
                        					position = parseInt(position);
                        					if (position > 0) {
                        						let newJSONStr = jsonStr.substr(0, position);
                                                try {
                                                    let newObject = JSON.parse(newJSONStr);
                                                    ayncsImagesChange([newObject]);
                                                    ayncsImagesGenerateThumbnail([newObject]);
                                                    electronLog.info(`[app] ${metadataPath} has been fixed.`);
                                                }
                                                catch (err) {
                                                    electronLog.info(`[app] ${metadataPath} can not fixed.`);
                                                    electronLog.info(`[app] ${jsonStr}`);
                                                    electronLog.error(err.stack || err);
                                                }
                        					}
                        				}
                                    }
                    			}
                    			catch (err) {}
                    		}
                    	}
                    }
                    
                    callback();
                    $bodyScope.fixUtils.fixingCurr++;
                    $bodyScope.$evalAsync();
                });
            }
            catch (err) {
                callback();
            }
        }
    });
    console.time("Scan missing metadata.json");

    $bodyScope.fixUtils.fixingCurr = 0;
    $bodyScope.fixUtils.fixingTotal = cbs.length;
    $bodyScope.fixUtils.isFixing = true;
    $bodyScope.$evalAsync();

    const async = require('async');
    async.parallelLimit(cbs, 2, function(err, result) {
        console.timeEnd("Scan missing metadata.json");
        electronLog.info(`[app] Scan finished, found ${changed.length} files`);
        $bodyScope.fixUtils.fixingCurr = 0;
        $bodyScope.fixUtils.fixingTotal = 0;
        $bodyScope.fixUtils.isFixing = false;
        $bodyScope.$evalAsync();
        if (changed.length > 0) {
            swal({
                title: "Finished",
                html: `${changed.length} hidden files found and repaired.`,
                showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                width: 400,
                confirmButtonColor: "#1373FB", // 1373FB DA4945
                cancelButtonColor: "#777777",
                confirmButtonText: "OK",
            }).then(function () {});
        }
        else {
            swal({
                title: "Finished",
                html: "Did not find any files that need to be repaired.",
                showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                width: 400,
                confirmButtonColor: "#1373FB", // 1373FB DA4945
                cancelButtonColor: "#777777",
                confirmButtonText: "OK",
            }).then(function () {});
        }
    });
};

ipcRenderer.on("remove-empty-folder-item", function () {
    $bodyScope.fixUtils.currentEmptyfolderRemoved++;
    if ($bodyScope.fixUtils.currentEmptyfolderRemoved > $scope.fixUtils.emptyFolderRemoved) {
        $bodyScope.fixUtils.currentEmptyfolderRemoved = $scope.fixUtils.emptyFolderRemoved;
    }
    $bodyScope.$evalAsync();
});

ipcRenderer.on("remove-empty-folder-item-done", function (event, params) {
    swal({
        title: `Cleanup Completed`,
        html: `${params.count} invalid content has been deleted.`,
        showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 360,
        confirmButtonColor: "#1373FB", // 1373FB DA4945
        cancelButtonColor: "#777777",
        confirmButtonText: i18n.__("general.ok")
    }).then(function () {});
    $bodyScope.fixUtils.isCleaningEmptyFolders = false;
    $timeout(function () {
        $scope.fixUtils.removeEmptyFolderProgress = 0;
        $scope.fixUtils.currentEmptyfolderRemoved = 0;
        $scope.fixUtils.emptyFolderRemoved = 0;
        $scope.fixUtils.isCleaningEmptyFolders = false;
        IPCHelper.send('reload-without-cache');
    }, 500);
    $bodyScope.$evalAsync();
});