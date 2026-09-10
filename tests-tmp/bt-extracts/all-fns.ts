  fns["deactivateFont"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (font, {showNotify, updateView}) {
            if (!font) return;
            if (font.activating || font.deactivating) return;
            var key = Object.keys(font.fontMetas.postScriptName)[0];
            var name = font.name + "." + font.ext;
            var postScriptName = font.fontMetas.postScriptName?.[key];
            var fullName = font?.fontMetas?.fullName?.en || font?.fontMetas?.compatibleFullName?.en;
            var outPath = `${fontFolder}/${postScriptName}.${font.ext}`;
            var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + font.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + name);
            if (process.platform === 'darwin') {
                if (fs.existsSync(outPath)) {
                    fse.removeSync(`${fontFolder}/${postScriptName}.${font.ext}`);
                    installedFonts[`${postScriptName}_.${font.ext}`] = false;
                    eagle.filter.filterCounts['fontActivated']['activated']--;
                    eagle.filter.filterCounts['fontActivated']['deactivated']++;
                }
                if (updateView) {
                    s.updateItemsView([font]);
                }
            }
            else {
                ipcRenderer.send("deactivate-windows-font", {
                    fontId: font.id,
                    fontName: font.name,
                    fontPath: rawPath,
                    postScriptName: postScriptName,
                    fullName: fullName,
                    fontExt: font.ext
                });
                font.deactivating = true;
                s.updateItemsView([font]);
            }

            ipcRenderer.send('electron-info', `[app] Unstall font: ${rawPath}`);
            analytics.event("Font", "Uninstall");

            if (showNotify) {
                s.notify({
                    message: $filter('i18n')("notify.font.deactivate", [
                            { "property": "name", "value": font.name }
                        ]),
                    duration: 1000
                });
            }
        }).apply(null, args);
  };

  fns["activateFont"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (font, {showNotify, updateView}) {
            if (!font) return;
            if (font.activating || font.deactivating) return;
            var name = font.name + "." + font.ext;
            var key = Object.keys(font.fontMetas.postScriptName)[0];
            var postScriptName = font.fontMetas.postScriptName?.[key];
            var fullName = font?.fontMetas?.fullName?.en || font?.fontMetas?.compatibleFullName?.en;
            var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + font.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + name);
            var outPath = `${fontFolder}/${postScriptName}.${font.ext}`;
            if (process.platform === 'darwin') {
                if (!fs.existsSync(outPath)) {
                    fse.copySync(rawPath, outPath);
                    installedFonts[`${postScriptName}_.${font.ext}`] = true;
                    eagle.filter.filterCounts['fontActivated']['activated']++;
                    eagle.filter.filterCounts['fontActivated']['deactivated']--;
                }
                if (updateView) {
                    s.updateItemsView([font]);
                }
            }
            else {
                ipcRenderer.send("activate-windows-font", {
                    fontId: font.id,
                    fontName: font.name,
                    postScriptName: sanitize(postScriptName),
                    fullName: fullName ?? sanitize(postScriptName),
                    fontExt: font.ext,
                    fontPath: rawPath
                });
                font.activating = true;
                s.updateItemsView([font]);
            }

            ipcRenderer.send('electron-info', `[app] Install font: ${rawPath}`);
            analytics.event("Font", "Install");

            if (showNotify) {
                s.notify({
                    message: $filter('i18n')("notify.font.activate", [
                            { "property": "name", "value": font.name }
                        ]),
                    duration: 1000
                });
            }
        }).apply(null, args);
  };

  // renameFontsWithFullName（bundle 32885-32927）
  fns["renameFontsWithFullName"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items) {
        if (items && items.length > 0) {
            s.checkOperationSafety(function () {
                var updates = [];
                var lng = s.$root.preferences.general.language;
                var preferLng = 'en';
                switch (lng) {
                    case 'zh_TW':
                    case 'zh_CN':
                        preferLng = "zh";
                        break;
                    default:
                        preferLng = "en";
                }
                items.forEach(function (item) {
                    if (item && FONT_TYPES[item.ext]) {
                        if (item.fontMetas) {
                            try {
                                var fontFamily = get(item.fontMetas, `fontFamily.${preferLng}`, undefined) || get(item.fontMetas, `fontFamily.en`, "");
                                if (fontFamily && fontFamily.length > 0) {
                                    var originName = item.name;
                                    var newName = fontFamily;
                                    item.name = newName;
                                    item.oldName = originName;
                                    item.newName = newName;
                                    updates.push(item);
                                }
                                console.log(fontFamily);
                            }
                            catch (err) {}
                        }
                    }
                });
                ayncsImagesChange(updates);
                hiddenByCurrentFilter(updates);
                s.updateItemsView(items);
                s.calculateImageBinding({}, function () {
                    s.rebindRefresh(true);
                    s.updateSelection();
                });
            }, 10);
        }
    }).apply(null, args);
  };

  // activateFonts（bundle 32929-32947；activateFont 单数版已在 fns 表 346）
  fns["activateFonts"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items) {
        if (!items || items.length === 0) return;
        if (!fs.existsSync(fontFolder)) {
            fs.mkdirSync(fontFolder);
        }
        items.forEach(function (font) {
            s.activateFont(font, {showNotify: false, updateView: false});
        });
        if (process.platform === 'darwin') {
            s.updateItemsView(items);
        }
        s.notify({
            message: $filter('i18n')("notify.fonts.activate", [
                        { "property": "count", "value": items.length }
                    ]),
            duration: 1000
        });
        analytics.event("Font", "Install");
    }).apply(null, args);
  };

  // deactivateFonts（bundle 32996-33012；deactivateFont 单数版已在 fns 表 2755）
  fns["deactivateFonts"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items) {
        if (!fs.existsSync(fontFolder)) { return; }
        items.forEach(function (font) {
            s.deactivateFont(font, {showNotify: false, updateView: false});
        });
        if (process.platform === 'darwin') {
            s.updateItemsView(items);
        }

        s.notify({
            message: $filter('i18n')("notify.fonts.deactivate", [
                        { "property": "count", "value": items.length }
                    ]),
            duration: 1000
        });
        analytics.event("Font", "Uninstall");
    }).apply(null, args);
  };

  // changeFontDefaultLang（bundle 32874-32883）
  fns["changeFontDefaultLang"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items, lang) {
        if (items && items.length > 0) {
            s.checkOperationSafety(function () {
                items.forEach(function (item) {
                    item.fontMetas.preferLng = lang;
                });
                ipcRenderer.send('regenerate-thumbnail', items);
            }, 10);
        }
    }).apply(null, args);
  };

  fns["isFontActivate"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (item) {
            try {
                var key = Object.keys(item.fontMetas.postScriptName)[0];
                var postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
                return installedFonts[`${postScriptName}_.${item.ext}`];
            }
            catch (err) {
                return false;
            }
        }).apply(null, args);
  };

  fns["getFontPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                return `./font-viewer/font-viewer.html?id=${s.current.id}&theme=${s.theme}&language=${s.language}`;
            }
        }).apply(null, args);
  };

  fns["filterWithTag"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (tag) {

            if (tag.isExcluded) {
                s.excludeWithTag(tag);
                return;
            }

            // 已存在
            if (tag.isNoTags) {
                eagle.filter.filterRules.tag.no = !eagle.filter.filterRules.tag.no;
                tag.isSelected = eagle.filter.filterRules.tag.no;
            }
            else {
                var tagName = tag.name;

                var eidx = eagle.filter.filterRules.tag.excludes.indexOf(tagName);
                if (eidx > -1) {
                    eagle.filter.filterRules.tag.excludes.splice(__lv_idx, 1);
                    tag.isExcluded = false;
                }
                else {
                    var __lv_idx = eagle.filter.filterRules.tag.includes.indexOf(tagName);
                    if (__lv_idx > -1) {
                        eagle.filter.filterRules.tag.includes.splice(__lv_idx, 1);
                        tag.isSelected = false;
                    }
                    else {
                        eagle.filter.filterRules.tag.includes.push(tagName);
                        tag.isSelected = true;
                        tag.isExcluded = false;
                    }
                }
            }

            if (eagle.filter.tagFilterLogic === "AND") {
                // s.tagKeyword = "";
                $("#filter-panel .tags-container").scrollTop(0);
            }

            s.filterContent();
            s.calculateFilterCounts();
        }).apply(null, args);
  };

  fns["renameTagGroupKeyup"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, __lv_group, newName) {
            event.stopPropagation();
            // event.preventDefault();
            if (event.keyCode === 13) {
                __lv_TagManager.renameGroup(__lv_group.id, newName);
                __lv_group.editable = false;
            }
            else if (event.keyCode === 27) {
                //
                __lv_group.editable = false;
            }
            return false;
        }).apply(null, args);
  };

  fns["renameTagGroupBlur"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_group, newName) {
            if (newName) {
                __lv_TagManager.renameGroup(__lv_group.id, newName);
                delete __lv_group.editable;
            }
        }).apply(null, args);
  };

  fns["onTagSidebarResize"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(e, ui) {
            if (ui && ui.size.width >= 200) {
                s.containerSize.tagSidebar = ui.size.width;
                s.$root.$broadcast('$$rebind::refreshContainSize');
                // s.updateSliderPosition();
                clearTimeout(__lv_onTagSidebarResizeTimeout);
                __lv_onTagSidebarResizeTimeout = setTimeout(function () {
                    // s.relayout();
                    // s.offsetScrollbar(30);
                    localStorage.setItem("eagle.containerSize.tagSidebar", ui.size.width);
                }, 500);
            }
        }).apply(null, args);
  };
