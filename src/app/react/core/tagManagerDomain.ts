/**
 * b1-9d：TagManager 域（bundle 47050-49176 逐字机械移植——$scope→s / $rootScope→s.$root /
 *   $timeout→getTimeout() / 原生 DOM（b1-9bz-D-2c 起，utils/domQuery） / path,fs,
 *   writeFileAtomic,electronLog,languageBCP,
 *   ayncsImagesChange,hiddenByCurrentFilter,swal,guid,analytics,i18n→w.* /
 *   calcuteContainTags→s.calcuteContainTags（scope 面）。
 *   @ts-nocheck 与 controllerFns.ts 同先例：bundle 原码宽松类型逐字保留。
 *   供给语义：bundle 在世时 s.TagManager 沿用其绑定；shim 世界由 applyDataMachineryScope
 *   调 machineryBuildTagManager(s) 挂 w.TagManager + s.TagManager。
 */
// @ts-nocheck
// b1-9k：bundle link 体内 $filter/$timeout 为 Angular 注入服务——本文件 1307/1319/1379/
// 1654/1670 的裸引用此前是死标识符（@ts-nocheck 掩盖；createTagGroup 首行即抛
// ReferenceError → group.editable 永不置真、群组命名输入框不渲染）。
// 与 controllerFns 的同名 shim 同款语义；ESM 循环引用双侧均为函数声明提升，运行时安全。
import { getTimeout as machineryGetTimeout } from './machineryInfra';
import { debounce } from '../utils/func';
import { getWindowScope } from './scopeFace';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { syncFilterFromScope } from '../store/filterState';
import { syncDetailFromScope } from '../store/detailState';

import { toggleGifPlay } from '../services/mediaService';
import { getLibraryHistory } from '../services/folderCoreService';
import { getResizable, makeResizable } from '../components/interactions/resizable';
import { addToLibraryChannel } from '../global/bus';
import { q, qa, widthOf, cssGet, cssSet, hide, show, setText, textOf, isVisible, offsetLeftOf, addClass, removeClass, delegateTarget } from '../utils/domQuery';

import { machinerySaveFolder } from './libraryDomain';
import { machineryCheckOperationSafety2 } from '../services/viewOpsService';
import { machineryCalculateImageBinding, machineryUpdateItemsView } from './itemDomain';
import { getFilter as machineryGetFilter, machineryFilterContent } from './filterDomain';
import { machineryUpdateListHeight } from '../services/gridService';
import { syncBodyFromScope } from '../store/bodyState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncListFromScope } from '../store/listState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { blurEl, focusEl, hasClass, offEl, onEl, qaVisible, selectEl, selectText, setHtmlEl, setScrollTop, textEl, triggerEl } from '../utils/domQuery';
import { unescape } from '../utils/lang';
import { emojiRegex, escapeRegex, getRemainingFilenameLength, getSanitize } from '../utils/normalize';
import { getFilter } from './filterDomain';
import { machineryRebindRefresh } from './itemDomain';
import { machineryGetAllChildFolder, machinerySetLastFolder } from './libraryDomain';

import { machinerySelectFolder, machineryUpdateSelection } from './selectionViewDomain';
import { machineryOpenAll } from '../services/folderCoreService';
import { machineryLeaveDetailMode } from './miscDomain';
import { machineryResetPage } from '../services/gridService';
import { applyDataMachineryScope } from './machineryInfra';
import { useMiscRawState } from '../store/miscRawState';
import { useLayoutState } from '../store/layoutState';
import { writeScopeField } from './scopeFieldBridge';
import { useFolderState } from '../store/folderState';
import { useListState } from '../store/listState';
import { usePreferencesState } from '../store/preferencesState';
import { useItemState } from '../store/itemState';
import { useBodyState } from '../store/bodyState';
import { useSelectionState } from '../store/selectionState';
const $filter: any = machineryGetFilter;
const getTimeout: any = machineryGetTimeout;

export function machineryBuildTagManager(): any {
  const w: any = window as any;
        var TagManager: any = {
            rawdata: [],            // 純粹的標籤內容
            tagMappings: {},       //  使用標籤獲得物件
            historyTags: [],       // 历史标签
            starredTags: [],       // 常用标签
            jsonPath: "",
            suggestions: [],
            allTags: [],
            unfiledTags: [],
            filedTags: [],
            azGroups: [],
            groups: [],             // 群组列表
            groupMappings: {},      // 群组列表 Mappings
            sortBy: localStorage['TAGS_SORT_BY'] || "name",
            groupBy: localStorage['TAGS_GROUP_BY'] || "alphabet",
            sortIncrease: localStorage['TAGS_SORT_INCREASE'] || 'true' 
        };

        // 初始化
        TagManager.init = function (rootDir: any) {
            try {
                var jsonPath = w.path.normalize(rootDir + "/tags.json");

                // 从 jsonPath 取出资料
                if (!w.fs.existsSync(jsonPath)) {

                    w.writeFileAtomic(jsonPath, JSON.stringify({
                        historyTags: [],
                        starredTags: []
                    }), function () {
                        var json = w.fs.readFileSync(jsonPath, 'utf8');
                        var data = JSON.parse(json);

                        TagManager.jsonPath = jsonPath;
                        TagManager.historyTags = data.historyTags || [];
                        TagManager.starredTags = data.starredTags || [];
                    });
                }
                else {

                    var json = w.fs.readFileSync(jsonPath, 'utf8');
                    var data = JSON.parse(json);

                    TagManager.jsonPath = jsonPath;
                    TagManager.historyTags = data.historyTags || [];
                    TagManager.starredTags = data.starredTags || [];
                }
            }
            catch (err: any) {
                TagManager.jsonPath = jsonPath;
                TagManager.historyTags = [];
                TagManager.starredTags = [];
                w.electronLog && w.electronLog.error(err.stack || err);
            }
        };

        // 储存（五秒最多更新一次）
        var TagManagerSaveTimeout: any;
        TagManager.save = function () {

            clearTimeout(TagManagerSaveTimeout);

            TagManagerSaveTimeout = setTimeout(function () {

                var json = {
                    historyTags: TagManager.historyTags,
                    starredTags: TagManager.starredTags
                };

                w.writeFileAtomic(TagManager.jsonPath, JSON.stringify(json), function (err: any) {});

            }, 5000);

        };

        TagManager.changeGroupBy = function (groupBy: any) {
            TagManager.groupBy = groupBy;
            if (TagManager.groupBy === "alphabet") {
                TagManager.currentGroups = TagManager.azGroups;    
            }
            else {
                TagManager.currentGroups = TagManager.allGroups;
            }
            TagManager.renderTagsResult();
            localStorage['TAGS_GROUP_BY'] = groupBy;
        };

        // 搜尋、resize、切換 sidebar 時重新計算列表、調整佈局
        TagManager.renderTagsResult = () => {

            const sortTags = ( tags: any) => {

                function sortByAZ(arr) {
                    var collator = new Intl.Collator(w.languageBCP || "en", { numeric: true, sensitivity: 'base' });
                    return arr.sort(function (a: any, b: any) {
                        return collator.compare(a.name, b.name);
                    });
                }
            
                function sortByCount(arr) {
                    var collator = new Intl.Collator(w.languageBCP || "en", { numeric: true, sensitivity: 'base' });
                    return arr.sort(function (a: any, b: any) {
                        // 先按數量排序
                        if (a.imageCount < b.imageCount) {
                            return 1;
                        }
                        if (a.imageCount > b.imageCount) {
                            return -1;
                        }
            
                        // 如果數量相同，再按名字排序
                        return collator.compare(a.name, b.name);
                    });
                }

                try {
                    let tagObjects = tags.map(function (tag: any) {
                        return TagManager.tagMappings[tag];
                    });
                    if (TagManager.sortBy === "name") {
                        tagObjects = sortByAZ(tagObjects);
                    }
                    else {
                        tagObjects = sortByCount(tagObjects);
                    }
                    if (TagManager.sortIncrease === "false") {
                        tagObjects = tagObjects.reverse();
                    }
                    return tagObjects.map(function (tagObject: any) {
                        return tagObject.name;
                    });
                } catch (err: any) {
                    return tags;
                }
            };

            const getTagData = () => {

                let groups = (useMiscRawState.getState().currentTagGroup)? [useMiscRawState.getState().currentTagGroup] : useMiscRawState.getState().TagManager.currentGroups || [];
                let tags = [];
                const tagsMap = {};

                switch (useMiscRawState.getState().tagViewMode) {
                    case "ALL":
                        tags = useMiscRawState.getState().TagManager.tagNames || [];
                        break;
                    case "UNFILED":
                        tags = useMiscRawState.getState().TagManager.unfiledTags || [];
                        break;
                    case "STARRED":
                        tags = useMiscRawState.getState().TagManager.starredTags;
                        groups = [{
                            id: "starred",
                            name: w.i18n.__("pages.allTags.sidebar.starred"),
                            tags: useMiscRawState.getState().TagManager.starredTags
                        }];
                        break;
                    case "GROUP":
                        tags = useMiscRawState.getState().currentTagGroup.tags || [];
                        break;
                }

                const keyword = useListState.getState().keyword?.toLowerCase();
                tags = tags.filter(( tagName: any) => {
                    if (!keyword) return true;
                    if (typeof tagName !== "string") return false;

                    const tag = TagManager.tagMappings[tagName];
                    const name = tagName.toLowerCase();
                    const pinyin = tag.pinyin.toLowerCase();

                    return name.indexOf(keyword) > -1 || pinyin.indexOf(keyword) > -1;
                });

                tags.forEach(( tag: any) => {
                    tagsMap[tag] = true;
                });

                return {
                    tags: tags,
                    tagsMap: tagsMap,
                    groups: groups
                }
            };

            const generateDisplayData = ({ tags, tagsMap, groups }) => {
                const listItems = [];
                let displayGroups = [];

                let filteredGroups;
                
                // 如果是群組列表，無論有無標籤都應顯示
                if (useMiscRawState.getState().tagViewMode === "GROUP" || useMiscRawState.getState().tagViewMode === "STARRED") {
                    filteredGroups = groups;
                }
                else {
                    filteredGroups = groups.filter(( group: any) => {
                        const tags = group.tags.filter(( tag: any) => {
                            return tagsMap[tag];
                        });
                        return (tags.length > 0);
                    });
                }
                const containerWidth = widthOf(q(".tag-manager-container"));
                const n = (useMiscRawState.getState().tagViewLayoutMode === "LIST")? 0 : Math.max(0, parseInt(((containerWidth - 32) / 200) as any) - 1);
                const columnCount = parseInt((containerWidth / 200) as any);
                const columnWidth = parseInt((containerWidth / columnCount) as any);

                let currentY = 0;
                filteredGroups.forEach((group, index: any) => {

                    let tags = group.tags.filter(( tag: any) => {
                        return tagsMap[tag];
                    });

                    tags = sortTags(tags);

                    let groupType = (group.id === 'starred')? "starred" : "group";  
                    listItems.push({
                        type: groupType,
                        name: group.name,
                        size: 32,
                        count: tags.length,
                        y: currentY,
                    });
                    currentY += 32;

                    let row = [];

                    tags.forEach((tag, index: any) => {
                        row.push(tag);
                        if ((index + 1) % (n + 1) === 0) {
                            listItems.push({
                                size: 27,
                                type: "row",
                                tags: [...row],
                                y: currentY
                            });
                            row = [];
                            currentY += 27;
                        }
                    });

                    if (row.length > 0) {
                        listItems.push({
                            size: 27,
                            type: "row",
                            tags: [...row],
                            y: currentY
                        });
                        currentY += 27;
                        row = [];
                    }

                    if (index !== filteredGroups.length - 1 && filteredGroups.length > 1) {
                        listItems.push({
                            size: 25,
                            type: "separator",
                            y: currentY
                        });
                        currentY += 25;
                    }
                });

                return {
                    columnWidth: columnWidth,
                    listItems: listItems
                }
            };

            const { tags, tagsMap, groups } = getTagData();
            const { columnWidth, listItems } = generateDisplayData({ tags, tagsMap, groups });
            TagManager.tagsResult = {
                tags,
                display: listItems,
                columnWidth: columnWidth
            };
        };

        TagManager.changeSort = function (sortBy: any, sortIncrease: any) {
            TagManager.sortBy = sortBy;
            TagManager.sortIncrease = sortIncrease;
            localStorage['TAGS_SORT_BY'] = sortBy;
            localStorage['TAGS_SORT_INCREASE'] = sortIncrease;
            TagManager.calculateTags();
            TagManager.renderTagsResult();
        };

        TagManager.saveGroup = function () {
            machinerySaveFolder();
        };

        TagManager.isSelected = function (tag: any) {
            if (w.eagle.inspector.newTags) {
                var selectedTags = w.eagle.inspector.newTags;
                var idx = selectedTags.indexOf(tag);
                return idx > -1;
            }
            return false;
        };

        TagManager.createTag = function createTag (tagString) {
            const tags = tagString.split(/[，,;、\n]+/);
            tags.forEach(function (t: any) {
                if (t && t.trim().length > 0) {
                    TagManager.addTag(t);
                }
            });
            TagManager.tagSearchKeyword = "";
            TagManager.focusTag(100);
        };

        TagManager.toggleTag = function toggleTag (event, tag) {

			var selectedTags = w.eagle.inspector.calculateTags(useSelectionState.getState().selected);
			var idx = selectedTags.indexOf(tag);
			if (idx === -1) {
				var tags = tag.split(/[，,;、]+/);
				tags.forEach(function (t: any) {
					if (t && t.trim().length > 0) {
						TagManager.addTag(t);
					}
				});
				// TagManager.addTag(tag);
				if (event.metaKey || event.ctrlKey) {}
				else {
					TagManager.tagSearchKeyword = "";
				}
				TagManager.focusTag(100);
			}
			else {
				TagManager.removeTag(tag);
			}

            if (!TagManager.historyTags) TagManager.historyTags = [];
            if (useMiscRawState.getState().availableHistoryTags.indexOf(tag) === -1) {
                useMiscRawState.getState().availableHistoryTags.unshift(tag);
            }
        };

        TagManager.addTags = function addTags (tags) {
            if (!tags || tags.length === 0) return;
            if (useSelectionState.getState().selected.length === 0) return;

            let changedItems: any[] = [];

            tags.forEach(( tag: any) => {
                tag = tag.trim();
                tag = tag.substr(0, 1024);
                useSelectionState.getState().selected.forEach(function (item: any) {
                    const idx = item.tags.indexOf(tag);
                    if (idx === -1) {
                        item.tags.push(tag);
                        item.tags = [...new Set(item.tags)];
                        changedItems.push(item);
                    }
                });

                if (!TagManager.tagMappings[tag] || !TagManager.tagMappings[tag].imageCount) {
                    var newTag = {
                        name: tag,
                        pinyin: tinyPinyin.convertToPinyin(tag),
                        imageCount: 1
                    };
                    TagManager.tagMappings[tag] = newTag;
                }
                else {
                    TagManager.tagMappings[tag].imageCount++;
                }
                TagManager.addHistoryTag(tag);
                w.analytics.event('Tag', 'Create', tag);
            });

            changedItems = [...new Set(changedItems)];
            
            useMiscRawState.getState().TagManager.isDirty = true;
            syncFilterFromScope();
            syncTagManagerFromScope();
            machineryCalcuteContainTags(useMiscRawState.getState().filtereds);
            machineryUpdateSelection();
            machineryUpdateItemsView(useSelectionState.getState().selected);

            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            w.electronLog.info(`[app] Add ${tags.length} tags to ${changedItems.length} files`);
        };

        TagManager.addTag = function addTag (tag) {
            if (tag === undefined || tag === "" ) return;

            let changedItems: any[] = [];
            if (useSelectionState.getState().selected.length > 0) {
                var tag = tag.trim();
                tag = tag.substr(0, 1024);
                useSelectionState.getState().selected.forEach(function (image: any) {
                    var idx = image.tags.indexOf(tag);
                    if (idx === -1) {
                        image.tags.push(tag);
                        image.tags = [...new Set(image.tags)];
                        changedItems.push(image);
                    }
                });
            }
            useMiscRawState.getState().tagsSuggestion.push({
                value: tag,
                text: tag
            });
            
            if (!TagManager.tagMappings[tag] || !TagManager.tagMappings[tag].imageCount) {
                var newTag = {
                    name: tag,
                    pinyin: tinyPinyin.convertToPinyin(tag),
                    imageCount: 1
                };
                TagManager.tagMappings[tag] = newTag;
                // s.TagManager.isDirty = true;
            }
            else {
                TagManager.tagMappings[tag].imageCount++;
            }
            useMiscRawState.getState().TagManager.isDirty = true;
            syncFilterFromScope();
            syncTagManagerFromScope();

            machineryCalcuteContainTags(useMiscRawState.getState().filtereds);
            TagManager.addHistoryTag(tag);
            machineryUpdateSelection();

            machineryUpdateItemsView(useSelectionState.getState().selected);

            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            w.electronLog.info(`[app] Add tag [${tag}] to ${changedItems.length} files`);
            w.analytics.event('Tag', 'Create', tag);
        };

        TagManager.removeTag = function (tag: any) {

            let changedItems: any[] = [];
            if (useSelectionState.getState().selected.length > 0) {
                useSelectionState.getState().selected.forEach(function (image: any) {
                    var idx = image.tags.indexOf(tag);
                    if (idx > -1) {
                        image.tags.splice(idx, 1);
                        changedItems.push(image);
                        if (TagManager.tagMappings[tag] && TagManager.tagMappings[tag].imageCount) {
                            TagManager.tagMappings[tag].imageCount--;
                            if (TagManager.tagMappings[tag].imageCount === 0) {
                            	useMiscRawState.getState().TagManager.isDirty = true;
                            	syncFilterFromScope();
                            	syncTagManagerFromScope();
                                delete TagManager.tagMappings[tag];
                                let historyIdx = TagManager.historyTags.indexOf(tag);
					           	if (historyIdx > -1) {
					           		TagManager.historyTags.splice(historyIdx, 1);
					           	}
                                if (useMiscRawState.getState().tagsSuggestionResult) {
    					           	let suggestionIdx = useMiscRawState.getState().tagsSuggestionResult.indexOf(tag);
    					           	if (suggestionIdx > -1) {
    					           		useMiscRawState.getState().tagsSuggestionResult.splice(suggestionIdx, 1);
    					           	}
                                }
                            }
                        }
                    }
                    // NOTE: beta 4.0 產生的 bug，導致 tags 裡面會出現 [] 的問題，因此在這裡做清理
                    // "" or is array
                    if (tag === "" || Array.isArray(tag)) {
                        // 檢查所有選中的圖片，如果有非 string 的 tag，就清除
                        image.tags = image.tags.filter(( t: any) => {
                            return typeof t === "string";
                        });
                        changedItems.push(image);
                    }
                });
            }

			machineryCalcuteContainTags(useMiscRawState.getState().filtereds);
			machineryUpdateSelection();
			machineryUpdateItemsView(useSelectionState.getState().selected);

            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            q("#tag-search-input")?.focus();
            machineryCalculateImageBinding({ignoreSort : true}, () => {});
            w.electronLog.info(`[app] Remove tag [${tag}] from ${changedItems.length} files`);
        };

        // 取得历史标签
        TagManager.getHistoryTags = function () {
            return TagManager.historyTags;
        };

        TagManager.clearHistoryTags = function () {
            w.swal({
                html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${w.i18n.__("Dialog.Clear.TagsHistory.Title")}</h4>
                        <p class="alert-desc">${w.i18n.__("Dialog.Clear.TagsHistory.Description")}</p>
                    </div>
                `,
                showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                width: 400,
                customClass: "alert-box",
                cancelButtonColor: "#777777",
                confirmButtonText: w.i18n.__("Dialog.Clear.TagsHistory.Clear"),
                cancelButtonText: w.i18n.__("general.cancel"),
            }).then(function () {
                w.electronLog.info(`[app] Empty history tags: ${JSON.stringify(TagManager.historyTags)}`);
                TagManager.historyTags = [];
                writeScopeField('availableHistoryTags', []);
                TagManager.save();
            });
        };

        // 添加历史标签
        TagManager.addHistoryTag = function (tag: any) {
            if (!tag) return;
            // if (!TagManager.tagMappings[tag]) return;
            var idx = TagManager.historyTags.indexOf(tag);
            if (idx > -1) {
                TagManager.historyTags.splice(idx, 1);
            }
            TagManager.historyTags.unshift(tag);
            if (TagManager.historyTags.length > 120) {
                TagManager.historyTags.length = 120;
            }
            TagManager.save();
        };

        TagManager.addHistoryTags = function (tags: any) {
            if (tags?.length === 0) return;
            tags = tags.reverse();
            tags.forEach(function (tag: any) {
                if (!tag) return;
                TagManager.addHistoryTag(tag);
            });
        };

        TagManager.isInHistory = function (tag: any) {
            if (TagManager.historyTags) {
                var sub = TagManager.historyTags.slice(0, 15);
                return sub.indexOf(tag) > -1;
            }
            else {
                return false;
            }
        };

        // 取得常用标签
        TagManager.getStarredTags = function () {
            return TagManager.starredTags;
        };

        // 添加常用标签
        TagManager.addStarredTag = function (tag: any) {
            var idx = TagManager.starredTags.indexOf(tag);
            if (idx > -1) {
                TagManager.starredTags.splice(idx, 1);
            }
            TagManager.starredTags.unshift(tag);
            TagManager.calculateTags();
            TagManager.renderTagsResult();
            TagManager.save();
            try {
                w.electronLog.info(`[app] Add tag [${tag}] to favorite tags`);
            } catch (err: any) {};
        };

        // 添加常用标签
        TagManager.addStarredTags = function (tags: any) {
            if (tags?.length === 0) return;
            tags = tags.reverse();
            tags.forEach(function (tag: any) {
                var name = tag.name || tag;
                if (!name) return;
                var idx = TagManager.starredTags.indexOf(name);
                if (idx > -1) {
                    TagManager.starredTags.splice(idx, 1);
                }
                TagManager.starredTags.unshift(name);
            });
            TagManager.calculateTags();
            TagManager.renderTagsResult();
            TagManager.save();
            try {
                w.electronLog.info(`[app] Add tag ${JSON.stringify(tags)} to favorite tags`);
            } catch (err: any) {};
        };

        // 移除常用标签
        TagManager.removeStarredTag = function (tag: any) {
            var idx = TagManager.starredTags.indexOf(tag);
            if (idx > -1) {
                TagManager.starredTags.splice(idx, 1);
                TagManager.save();
                try {
                    w.electronLog.info(`[app] Remove tag [${tag}] from favorite tags`);
                } catch (err: any) {};
            }
            TagManager.renderTagsResult();
        };

        // 移除常用标签
        TagManager.removeStarredTags = function (tags: any) {
            if (tags?.length === 0) return;
            tags.forEach(function (tag: any) {
                var idx = TagManager.starredTags.indexOf(tag);
                if (idx > -1) {
                    TagManager.starredTags.splice(idx, 1);
                }
            });
            TagManager.save();
            TagManager.renderTagsResult();
            try {
                w.electronLog.info(`[app] Remove tag ${JSON.stringify(tags)} from favorite tags`);
            } catch (err: any) {};
        };

        TagManager.isInStarred = function (tag: any) {
            return TagManager.starredTags.indexOf(tag) > -1;
        };

        TagManager.isAllInStarred = function (tags: any) {
            for (var i = 0; i < tags.length; i++) {
                if (!TagManager.isInStarred(tags[i].name)) {
                    return false;
                }
            }
            return true;
        };

        // 取得所有标签
        TagManager.getTags = function () {
            return useFolderState.getState().tags;
        };

        // 取得文件夹包含标签
        TagManager.getFolderTags = function (folderIds: any) {

            var result = [];

            folderIds.forEach(function (folderId: any) {
                var images = useItemState.getState().raw.filter(function (image: any) {
                    try {
                        if (image && image.folders) {
                            return image.folders && image.folders.indexOf(folderId) > -1;
                        }
                    }
                    catch (err: any) {}
                    return false;
                });
                var total = images.length;
                var folderTags = machineryCalcuteContainTags(images).containTags || [];
                folderTags.forEach(function (tag: any) {
                    tag.ratio = tag.imageCount / total;
                    result.push(tag);
                });
            })

            return TagManager.sortTagsByRatio(result);
        };

        // 用 tags 算相似 tags
        TagManager.getSimilarTags = function (tags: any) {

            if (tags.indexOf("Screenshot") > -1) {
                tags.splice(tags.indexOf("Screenshot"), 1);
            }

            var images = useItemState.getState().raw.filter(function (image: any) {
                var match = 0;
                for (var i = 0; i < tags.length; i++) {
                    if (image && image.tags) {
                        if (image.tags.indexOf(tags[i]) > -1) {
                            match++;
                        }
                    }
                }
                return match == tags.length;
            });
            var total = images.length - 1;
            var result = machineryCalcuteContainTags(images).containTags;
            result = result.filter(function (tag: any) {
                for (var i = 0; i < tags.length; i++) {
                    if (tags[i] === tag.name) {
                        return false;
                    }
                }
                tag.ratio = tag.imageCount / total;
                return true;
            });
            return TagManager.sortTagsByRatio(result);
        };

        // 使用標籤占比排序
        TagManager.sortTagsByRatio = function (tags: any) {
            return tags.sort(function (tag: any) {
                return -tag.ratio;
            });
        };

        // 排除
        TagManager.excludeExistTags = function (exists: any, tags: any) {
            if (!exists || exists.length == 0) return tags;
            var result = tags.filter(function (tag: any) {
                if (exists.indexOf(tag.name || tag) > -1) return false;
                return true;
            });
            return result;
        };

        TagManager.print = function (tags: any) {
            var result = [];
            tags.forEach(function (tag: any) {
                if (tag.ratio > 0.2) {
                    result.push({
                        "建議標籤": tag.name,
                        "比例": parseFloat((Math.round(tag.ratio * 100 * 100) / 100) as any).toFixed(2) + "%"
                    });
                }
            });
            if (result.length > 0) {
                // console.table(result);
            }
        };

        TagManager.focusTag = function (delay: any) {
            setTimeout(function () {
                var $active = qa("#tags-popup .tag.active");
                if ($active.length == 0) {
                    q("#tags-popup .tag")?.classList.add("active");
                }
            }, delay || 500);
        };

        // 使用断词方式计算标签 （最后再处理）
        TagManager.getJiebaTags = function (string: any) {

        };

        // 永久移除标签
        TagManager.removeTagsPermanently = function (tags: any) {

            var changed = [];
            var selectedTags: any = {};

            tags.forEach(function (tag: any) {
                selectedTags[tag] = true;
            })

            for (var rindex = useItemState.getState().raw.length - 1; rindex >= 0; rindex--) {
                var image = useItemState.getState().raw[rindex];
                var originTagCount = image.tags.length;
                image.tags = image.tags.filter(function (tag: any) {
                    return !selectedTags[tag];
                });
                if (image.tags && image.tags.length != originTagCount) {
                    changed.push(image);
                }
            }

            if (changed.length > 0) {
                w.ayncsImagesChange(changed);
                w.hiddenByCurrentFilter(changed);
            }
        };

        // 取得推荐标签
        TagManager.getSuggestTags = function (images: any) {

            if (!images) return [];

            // 大批辆图片不进行推荐
            if (images.length > 500) return;
            // console.time("======== 取得推荐标签 ========");
            var result = [];
            var folderIdsMap = {};
            var tagsMap: any = {};
            var nameString = "";

            if (images[0] && images.length == 1) {
                nameString = images[0].name;
            }

            images.forEach(function (image: any) {
                if (!image) return;
                if (image.folders) {
                    image.folders.forEach(function (folderId: any) {
                        folderIdsMap[folderId] = true;
                        var folder = useItemState.getState().folderMappings[folderId];
                        if (folder && folder.name) {
                            var ancestors = getAncestorFolders(folder, []);
                            if (ancestors && ancestors.length > 0) {
                                ancestors.forEach(function (ancestor: any) {
                                    nameString += " " + ancestor.name.split(/[ ，）（(),;、\n]+/).join(" ");
                                });
                            }
                            nameString += " " + folder.name;
                        }
                    });
                }
                if (image.tags) {
                    image.tags.forEach(function (tag: any) {
                        tagsMap[tag] = true;
                    });
                }
                // nameString += image.name + " ";
            });

            // var folderIds = Object.keys(folderIdsMap).map(function(key) {
            //     return key;
            // });

            var tags = Object.keys(tagsMap).map(function(key) {
                return key;
            });

            // var selectedTags = calculateTags(s.selected);

            // console.log("包含文件夹：", folderIds);
            // console.log("包含标签：", tags);

            // var folderContainTags = [];
            // if (folderIds.length > 0) {
            //     folderContainTags = TagManager.getFolderTags(folderIds);
            // }
            // // console.log("文件夾推薦算法：");
            // // TagManager.print(folderContainTags);
            // folderContainTags.forEach(function (tag: any) {
            //     if (TagManager.isInHistory(tag.name)) {
            //         tag.ratio += 0.15;
            //     }
            //     if (tag.ratio > 0.2) {
            //         result.push(tag.name);
            //     }
            // });

            // var imageSimilarTags = [];
            // if (tags.length > 0) {
            //     imageSimilarTags = TagManager.getSimilarTags(tags);
            // }
            // console.log("相關圖片推薦算法：");
            // TagManager.print(imageSimilarTags);
            // imageSimilarTags.forEach(function (tag: any) {
            //     if (TagManager.isInHistory(tag.name)) {
            //         tag.ratio += 0.15;
            //     }
            //     if (tag.ratio > 0.2) {
            //         result.push(tag.name);
            //     }
            // });

            TagManager.suggestions = result;
            TagManager.nameString = nameString;

            // console.log("歷史記錄：");
            // console.log(TagManager.historyTags);

            ipcRenderer.send('jieba-extract', nameString);
        };

        TagManager.coverToAZList = function (list: any) {
            var azGroups = {};
            azGroups["others"] = {
                name: "＃",
                tags: []
            };

            list.forEach(function (tag: any) {
                if (!tag) return;
                if (tag.name && tag.pinyin) {
                    var t = tag.name[0].toUpperCase(),
                        pint = tag.pinyin[0].toUpperCase(),
                        addToAZGroup = false;

                    // 依据首字母分类
                    if ((w.preferences.general.language === "ru_RU" || w.preferences.general.language === "en") && (/[а-яА-ЯЁё]/.test(t) || /[а-яА-ЯЁё]/.test(pint)) ) {
                        addToAZGroup = true;
                    }
                    else if (w.preferences.general.language === "ja_JP" && /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/.test(t) ) {
                        pint = JAPANESE_CHAR_MAP[t];
                        if (!pint) {
                            addToAZGroup = false;
                        }
                        else {
                            addToAZGroup = true;
                        }
                    }
                    else if (/^([a-zA-Z _-]+)$/.test(t) || /^([a-zA-Z _-]+)$/.test(pint)) {
                        addToAZGroup = true;
                    }

                    if (addToAZGroup) {
                        if (!azGroups[pint]) {
                            azGroups[pint] = {
                                name: pint,
                                tags: []
                            };
                        }
                        azGroups[pint].tags.push(tag);
                    }
                    else {
                        azGroups["others"].tags.push(tag);
                    }
                }
            })

            var azList = Object.keys(azGroups).map(function(key) { return azGroups[key]; }).sort(function(a, b) {
                if (a.name < b.name)
                    return -1;
                if (a.name > b.name)
                    return 1;
                return 0;
            });

            return azList;

        };

        // 以下與標籤群組功能相关
        // Step 1: 建立 rawdata
        // Step 2: 建立 a-z 列表
        // Step 3: 建立 unfield 与 field 列表
        // Step 4: 建立 Group Mappings
        TagManager.calculateTags = function () {

            // console.time("TagManager.calculateTags");
            TagManager.tagMappings = {};
            TagManager.groupMappings = {};

            for (var i = 0; i < TagManager.rawdata.length; i++) {
                let tag = TagManager.rawdata[i];
                TagManager.tagMappings[tag.name] = tag;
                tag.groups = [];
                delete tag.color;

                useMiscRawState.getState().tagsSuggestion.push({
                    value: tag.name,
                    text: tag.name
                });
            }

            TagManager.starredTags.forEach(function (tag: any) {
                // 没有任何图片包含的标签
                var tagObject = TagManager.tagMappings[tag];
                if (!tagObject) {
                    var newTag = {
                        name: tag,
                        pinyin: tinyPinyin.convertToPinyin(tag),
                        imageCount: 0
                    };
                    TagManager.tagMappings[tag] = newTag;
                }
            });

            // 創建 rawdata
            // 創建 groups
            // 創建 groupMappings
            TagManager.groups.forEach(function (group: any) {
                try {
                    var groupID = group.id;
                    delete group.editable;

                    TagManager.groupMappings[groupID] = group;

                    group.tags.forEach(function (tag: any) {

                        // 没有任何图片包含的标签
                        var tagObject = TagManager.tagMappings[tag];
                        if (!tagObject) {
                            var newTag = {
                                name: tag,
                                pinyin: tinyPinyin.convertToPinyin(tag),
                                imageCount: 0,
                                groups: [groupID]
                            };
                            if (group.color) {
                                newTag.color = group.color;
                            }
                            TagManager.tagMappings[tag] = newTag;
                            TagManager.rawdata.push(newTag);
                        }
                        // 将群组 id 添加到标签物件
                        else {
                            if (group.color) {
                                if (!tagObject.color) {
                                    tagObject.color = group.color;
                                }
                            }
                            else {
                                delete tagObject.color;
                            }
                            if (tagObject.groups) {
                                var idx = tagObject.groups.indexOf(groupID);
                                if (idx === -1) {
                                    tagObject.groups.push(groupID);
                                }
                            }
                        }

                    });
                }
                catch (err: any) {
                    console.error(err);
                }
            });

            // 创建 allTags
            TagManager.allTags = TagManager.rawdata.sort(function (tag1: any, tag2: any) {
                return tag2.imageCount - tag1.imageCount;
            });

            TagManager.tagNames = TagManager.allTags.map(function (tag: any) {
                return tag.name;
            });

            // 创建 unfiledTags 与 filedTags
            TagManager.filedTags = [];
            TagManager.unfiledTags = [];
            TagManager.unfiledTagsMap = {};

            for (var i = 0; i < TagManager.allTags.length; i++) {
                var tagObject = TagManager.allTags[i];
                // 已分类
                if (tagObject.groups.length > 0) {
                    TagManager.filedTags.push(tagObject);
                }
                // 未分类
                else {
                    TagManager.unfiledTags.push(tagObject.name);
                    TagManager.unfiledTagsMap[tagObject.name] = true;
                }
            }

            // 建立 AZ Group
                        // 创建 a-z 列表
            var azGroups = {};
            azGroups["others"] = {
                name: "＃",
                tags: []
            };

            TagManager.rawdata.forEach(function(tag) {

                if (!tag) return;

                useMiscRawState.getState().tagsSuggestion.push({
                    value: tag.name,
                    text: tag.name
                });

                var tagName = tag.name;
                var tagPinyin = tag.pinyin;

                if (tagName && tagPinyin) {

                    var t = tagName[0].toUpperCase(),
                        pint = tagPinyin[0].toUpperCase(),
                        addToAZGroup = false;

                    // 依据首字母分类
                    if ((w.preferences.general.language === "ru_RU" || w.preferences.general.language === "en") && (/[а-яА-ЯЁё]/.test(t) || /[а-яА-ЯЁё]/.test(pint)) ) {
                        addToAZGroup = true;
                    }
                    else if (w.preferences.general.language === "ja_JP" && /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/.test(t) ) {
                        pint = JAPANESE_CHAR_MAP[t];
                        if (!pint) {
                            addToAZGroup = false;
                        }
                        else {
                            addToAZGroup = true;
                        }
                    }
                    else if (/^([a-zA-Z _-]+)$/.test(t) || /^([a-zA-Z _-]+)$/.test(pint)) {
                        addToAZGroup = true;
                    }

                    if (addToAZGroup) {
                        if (!azGroups[pint]) {
                            azGroups[pint] = {
                                name: pint,
                                tags: []
                            };
                        }
                        azGroups[pint].tags.push(tag.name);
                    }
                    else {
                        azGroups["others"].tags.push(tag.name);
                    }
                }
            });

            TagManager.azGroups = Object.keys(azGroups).map(function(key) { return azGroups[key]; }).sort(function(a, b) {
                if (a.name < b.name)
                    return -1;
                if (a.name > b.name)
                    return 1;
                return 0;
            });

            TagManager.allGroups = [];
            TagManager.groups.forEach(function (group: any) {
                TagManager.allGroups.push(group);
            });
            TagManager.allGroups.push({
                name: w.i18n.__('general.pages.unfiled'),
                tags: TagManager.unfiledTags
            });

            if (!TagManager.historyTags) TagManager.historyTags = [];
            writeScopeField('availableHistoryTags', TagManager.historyTags.filter(function (tag: any) {
                if (!TagManager.tagMappings[tag] || TagManager.tagMappings[tag].imageCount === 0) {
                    return false;
                }
                return true;
            }));

            TagManager.changeGroupBy(TagManager.groupBy);
        };

        TagManager.calculateTagsDebounce = debounce(TagManager.calculateTags, 500);

        TagManager.createGroup = function (groupName: any) {
            var newGroup = {
                id: w.guid(),
                name: groupName || "",
                tags: []
            };
            TagManager.groups.push(newGroup);
            TagManager.calculateTags();
            TagManager.saveGroup();
            try {
                w.electronLog.info(`[app] New tag group: ${newGroup.id}`);
                w.electronLog.info(`${JSON.stringify(newGroup)}`);
                w.analytics.event('TagGroup', 'Create');
            } catch (err: any) {};
            return newGroup;
        };

        TagManager.createGroupWithTags = function (groupName: any, tags: any, color: any, description: any) {
            if (!is.array(tags)) {
                tags = [];
            }
            var newGroup = {
                id: w.guid(),
                name: groupName || "",
                tags: tags,
            };
            if (color) {
                newGroup.color = color;
            }
            if (description !== undefined) {
                newGroup.description = description;
            }
            TagManager.groups.push(newGroup);
            TagManager.calculateTags();
            TagManager.saveGroup();
            try {
                w.electronLog.info(`[app] New tag group: ${newGroup.id}`);
                w.electronLog.info(`${JSON.stringify(newGroup)}`);
                w.analytics.event('TagGroup', 'Create');
            } catch (err: any) {};
            return newGroup;
        };

        TagManager.renameGroup = function (groupID: any, newName: any) {
            var group = TagManager.groupMappings[groupID];
            newName = newName.substr(0, 1024);
            if (group && group.name != newName) {
                try {
                    w.electronLog.info(`[app] Rename tag group: ${group.id} ${group.name} > ${newName}`);
                    w.analytics.event('TagGroup', 'Rename', newName);
                } catch (err: any) {};
                group.name = newName;
                TagManager.saveGroup();
            }
        };

        TagManager.removeGroup = function (groupID: any, isRemoveTags: any) {

            var group = TagManager.groupMappings[groupID];
            if (!group) return;

            var idx = TagManager.groups.indexOf(group);
            if (idx > -1) {
                TagManager.groups.splice(idx, 1);

                // 是否要一併移除所有包含該標籤圖片的標籤
                // 如果移除图片标签，那就需要重新计算整体关系
                if (isRemoveTags) {
                    TagManager.removeTagsPermanently(group.tags);
                    machineryCalculateImageBinding({ ignoreSort: true });
                    try {
                        w.electronLog.info(`[app] Remove tag group(${group.id}) also remove includes tags`);
                    } catch (err: any) {};
                }
                else {
                    TagManager.calculateTags();
                    try {
                        w.electronLog.info(`[app] Remove tag group(${group.id}) exclude contains tags`);
                    } catch (err: any) {};
                }
                TagManager.saveGroup();
            }
            return idx;
        };

        TagManager.addTagsToGroup = function (groupID: any, tags: any, duplicateMode: any) {
            if (tags?.length === 0) return;
            var group = TagManager.groupMappings[groupID];
            if (!group) return;
            tags = [...new Set(tags)];
            tags.forEach(function (tag: any) {
                tag = tag.replace(/\r?\n?/g, '');
                if (group.tags.indexOf(tag) === -1) {
                    group.tags.push(tag);
                    if (!duplicateMode && TagManager.tagMappings[tag] && TagManager.tagMappings[tag].groups) {
                        TagManager.tagMappings[tag].color = group.color;
                        TagManager.tagMappings[tag].groups.forEach(function (oriGroup: any) {
                            var g = TagManager.groupMappings[oriGroup];
                            if (!g) return;
                            var idx = g.tags.indexOf(tag);
                            if (idx !== -1) {
                                g.tags.splice(idx, 1);
                            }
                        })
                    }
                }
            });

            TagManager.calculateTags();
            TagManager.saveGroup();
            try {
                w.electronLog.info(`[app] Add tag: ${JSON.stringify(tags)} to tag group: ${group.name}(${group.id})`);
            } catch (err: any) {};
        };

        TagManager.moveTagsToGroup = function (groupID: any, tags: any) {
            if (tags?.length === 0) return;
            var group = TagManager.groupMappings[groupID];
            if (!group) return;
            tags = [...new Set(tags)];
            tags.forEach(function (tag: any) {
                tag = tag.replace(/\r?\n?/g, '');
                group.tags.push(tag);
                if (TagManager.tagMappings[tag] && TagManager.tagMappings[tag].groups) {
                    TagManager.tagMappings[tag].color = group.color;
                    TagManager.tagMappings[tag].groups.forEach(function (oriGroup: any) {
                        var g = TagManager.groupMappings[oriGroup];
                        if (!g) return;
                        var idx = g.tags.indexOf(tag);
                        if (idx !== -1) {
                            g.tags.splice(idx, 1);
                        }
                    })
                }
                group.tags = [...new Set(group.tags)];
            });

            TagManager.calculateTags();
            TagManager.saveGroup();
            try {
                w.electronLog.info(`[app] Add tag: ${JSON.stringify(tags)} to tag group: ${group.name}(${group.id})`);
            } catch (err: any) {};
        };

        TagManager.removeTagsFromGroup = function (groupID: any, tags: any) {
            if (tags?.length === 0) return;
            var group = TagManager.groupMappings[groupID];
            if (!group) return;
            machineryCheckOperationSafety2(tags.length, function () {
                tags.forEach(function (tag: any) {
                    var idx = group.tags.indexOf(tag);
                    if (idx !== -1) {
                        group.tags.splice(idx, 1);
                        if (TagManager.tagMappings[tag] && TagManager.tagMappings[tag].color) {
                            delete TagManager.tagMappings[tag].color;
                        }
                    }
                });
                TagManager.calculateTags();
                TagManager.saveGroup();
                try {
                    w.electronLog.info(`[app] Remove tag: ${JSON.stringify(tags)} from tag group: ${group.name}(${group.id})`);
                } catch (err: any) {};
                if (usePreferencesState.getState().preferences.notification.soundEffect.enable != 'false' && usePreferencesState.getState().preferences.notification.soundEffect.when.deleteFolder == 'true') {
                    useMiscRawState.getState().removeSound.play();
                }
            }, 1);
        };

        TagManager.filterWithTags = function (tags: any, ignoreHistory: any) {
            writeScopeField('viewMode', '');
            machineryOpenAll(false, function () {
                getTimeout()(function () {
                    w.eagle.filter.isOpen = true;
                    syncFilterFromScope();
                    w.eagle.filter.tagFilterLogic = "OR";
                    syncFilterFromScope();
                    useMiscRawState.getState().filterWithTags(tags);
                    // b1-9ba：Update_Tags_Filter 廣播全樹無接收者（原接收者隨 bundle 摘除
                    // 退役）——廣播體移除，filterWithTags 直呼語義不變。
                }, 200);
            });
        };

        writeScopeField('TagManager', TagManager);
        syncFilterFromScope();
        syncTagManagerFromScope();

        // filterWithTags（bundle 27136 逐字补端口）——原 controller 初始化即挂载；
        // store 字段此前恒 null，TagManager.filterWithTags 回调里 `filterWithTags(tags)`
        // 抛 TypeError 被 $timeout 吞掉 → 标签管理双击浏览/按标签过滤整条死（F14）。
        writeScopeField('filterWithTags', function (tags: any) {
            const wc = window as any;
            wc.eagle.filter.filterRules.tag.includes = [];
            (useMiscRawState.getState().containTags || []).forEach(function (tagObject: any) {
                tags.forEach(function (tagName: any) {
                    if (tagObject.name === tagName) {
                        wc.eagle.filter.filterRules.tag.includes.push(tagName);
                        tagObject.isSelected = true;
                    }
                    else {
                        tagObject.isSelected = false;
                    }
                });
            });
            writeScopeField('tagKeyword', "");
            machineryFilterContent();
        });

        // selectTag（bundle 38870-38926 逐字；b1-9k 补端口——TagManager.tsx 标签点击
        // onClick=call('selectTag')，缺席时静默 no-op → 标签选中/多选整条死）
        writeScopeField('selectTag', function (event, tag) {
            event.stopPropagation();

            if (event.button !== 0 && useMiscRawState.getState().selectedTags[tag.name]) return;

            writeScopeField('currentFocus', 'content');

            // Shift 多選
            if (event.shiftKey) {

                let selectedTags = [];
                let found = 0;

                TagManager.tagsResult.display.forEach((item, index) => {
                    if (item.type === "row") {
                        const tags = item.tags;
                        tags.forEach((tagName) => {
                            if (tagName === useMiscRawState.getState().lastSelectedTag || tagName === tag.name) {
                                found++;
                                selectedTags.push(tagName);
                                return;
                            }
                            if (found === 2) {
                                return;
                            }
                            if (found === 1) {
                                selectedTags.push(tagName);
                            }
                        });
                    }
                });

                selectedTags.forEach((tagName) => {
                    if (useMiscRawState.getState().selectedTags[tagName]) return;
                    useMiscRawState.getState().selectedTags[tagName] = true;
                    syncTagManagerFromScope();
                });

                writeScopeField('lastSelectedTag', tag.name);
                return;
            }

            if (event.metaKey || event.ctrlKey) {
                if (useMiscRawState.getState().selectedTags[tag.name]) {
                    delete useMiscRawState.getState().selectedTags[tag.name];
                }
                else {
                    useMiscRawState.getState().selectedTags[tag.name] = true;
                    syncTagManagerFromScope();
                }
                writeScopeField('lastSelectedTag', tag.name);
            }
            else {
                writeScopeField('selectedTags', {});
                syncTagManagerFromScope();
                useMiscRawState.getState().selectedTags[tag.name] = true;
                syncTagManagerFromScope();
                writeScopeField('lastSelectedTag', tag.name);
            }
        });

        writeScopeField('createTagGroup', function () {
            var newGroup = TagManager.createGroup($filter('i18n')('general.untitled.tagGroup'));
            writeScopeField('tagViewMode', "GROUP");
            syncTagManagerFromScope();
            writeScopeField('tagViewModeName', `GROUP-${newGroup.id}`);
            syncTagManagerFromScope();
            writeScopeField('currentTagGroup', newGroup);
            syncTagManagerFromScope();
            machineryRenameTagGroup(newGroup);
            writeScopeField('selectedTags', {});
            syncTagManagerFromScope();
            TagManager.renderTagsResult();
        });

        writeScopeField('openTagAllGroup', function () {
            if (useMiscRawState.getState().tagViewMode === "ALL") return;
            (window as any).tagRectSelecting = false;
            writeScopeField('keyword', "");
            writeScopeField('tagViewMode', "ALL");
            syncTagManagerFromScope();
            writeScopeField('tagViewModeName', "ALL");
            syncTagManagerFromScope();
            writeScopeField('currentFocus', 'tags');
            writeScopeField('currentTagGroup', undefined);
            syncTagManagerFromScope();
            writeScopeField('selectedTags', {});
            syncTagManagerFromScope();
            TagManager.renderTagsResult();
        });

        writeScopeField('openUnfiledGroup', function () {
            if (useMiscRawState.getState().tagViewMode === "UNFILED") return;
            (window as any).tagRectSelecting = false;
            writeScopeField('keyword', "");
            writeScopeField('tagViewMode', "UNFILED");
            syncTagManagerFromScope();
            writeScopeField('tagViewModeName', "UNFILED");
            syncTagManagerFromScope();
            writeScopeField('currentFocus', 'tags');
            writeScopeField('currentTagGroup', undefined);
            syncTagManagerFromScope();
            writeScopeField('selectedTags', {});
            syncTagManagerFromScope();
            TagManager.renderTagsResult();
        });

        writeScopeField('openStarredGroup', function () {
            if (useMiscRawState.getState().tagViewMode === "STARRED") return;
            (window as any).tagRectSelecting = false;
            writeScopeField('keyword', "");
            writeScopeField('tagViewMode', "STARRED");
            syncTagManagerFromScope();
            writeScopeField('tagViewModeName', "STARRED");
            syncTagManagerFromScope();
            writeScopeField('currentFocus', 'tags');
            writeScopeField('currentTagGroup', undefined);
            syncTagManagerFromScope();
            writeScopeField('selectedTags', {});
            syncTagManagerFromScope();
            TagManager.renderTagsResult();
        });

        writeScopeField('openTagGroup', function (group: any) {
            (window as any).tagRectSelecting = false;
            writeScopeField('keyword', "");
            writeScopeField('tagViewMode', "GROUP");
            syncTagManagerFromScope();
            writeScopeField('tagViewModeName', `GROUP-${group.id}`);
            syncTagManagerFromScope();
            writeScopeField('currentFocus', 'tags');
            writeScopeField('currentTagGroup', group);
            syncTagManagerFromScope();
            TagManager.renderTagsResult();
            q("input:focus")?.blur();
            if (useMiscRawState.getState().currentTagGroup === group) return;
            writeScopeField('selectedTags', {});
            syncTagManagerFromScope();
        });

        
        writeScopeField('addStarredTags', () => {
            getTimeout()(() => {
                const originSelected = useMiscRawState.getState().TagManager.starredTags.reduce((acc, cur: any) => {
                    acc[cur] = true;
                    return acc;
                }, {});

                GeneralTagSelectPanel.open({
                    tagManager: useMiscRawState.getState().TagManager,
                    selectedTags: originSelected,
                    pinSelected: false,
                    onChanged: ( result: any) => {
                        if (!result?.isDirty) return;
                        const { selectedTags, deselectedTags } = result;

                        // 即將新增的標籤 
                        let add = [];
                        if (Object.keys(selectedTags).length > 0) {
                            Object.keys(selectedTags).forEach(( tag: any) => {
                                if (originSelected[tag]) return;
                                add.push(tag);
                            });
                        }
                        useMiscRawState.getState().TagManager.addStarredTags(add);

                        let remove = [];
                        if (Object.keys(deselectedTags).length > 0) {
                            Object.keys(deselectedTags).forEach(( tag: any) => {
                                remove.push(tag);
                            });
                        }
                        useMiscRawState.getState().TagManager.removeStarredTags(remove);
                        machineryCalculateImageBinding({ ignoreSort: true }, () => {});
                    }
                });
            }, 50);
        });

        writeScopeField('addGroupTags', ( group: any) => {
            getTimeout()(() => {
                const originSelected = group.tags.reduce((acc, cur: any) => {
                    acc[cur] = true;
                    return acc;
                }, {});

                GeneralTagSelectPanel.open({
                    tagManager: useMiscRawState.getState().TagManager,
                    selectedTags: originSelected,
                    pinSelected: false,
                    onChanged: ( result: any) => {
                        if (!result?.isDirty) return;
                        const { selectedTags, deselectedTags } = result;

                        // 即將新增的標籤 
                        let add = [];
                        if (Object.keys(selectedTags).length > 0) {
                            Object.keys(selectedTags).forEach(( tag: any) => {
                                if (originSelected[tag]) return;
                                add.push(tag);
                            });
                        }
                        useMiscRawState.getState().TagManager.addTagsToGroup(group.id, add, true);

                        let remove = [];
                        if (Object.keys(deselectedTags).length > 0) {
                            Object.keys(deselectedTags).forEach(( tag: any) => {
                                remove.push(tag);
                            });
                        }
                        useMiscRawState.getState().TagManager.removeTagsFromGroup(group.id, remove);
                        machineryCalculateImageBinding({ ignoreSort: true }, () => {});
                    }
                });
            }, 50);
        });

        writeScopeField('openTagGroupContextMenu', (event, tagGroup: any) => {

            let historyLibraryMenu = {};
            historyLibraryMenu.items = getLibraryHistory().filter(( history: any) => {
                var isCurrent = false;
                const _ws: any = getWindowScope();
                if (_ws.libraryPath) {
                    isCurrent = w.path.normalize(history.path) == w.path.normalize(_ws.libraryPath);
                }
                return !isCurrent;
            }).map(( history: any) => {
                return {
                    label: history.name,
                    keywords: `${w.i18n.__('context.image.addToLibrary')} library 資源庫`,
                    accelerator: history.dir,
                    icon: 'ic-library-logo.svg',
                    click: () => {
                        if (!tagGroup || !history) return;
                        if (w.fs.existsSync(history.path)) {
                            addToLibraryChannel.emit({
                                tagGroup, tagGroup,
                                items: [],
                                library: history
                            });

                        }
                    }
                }
            });
            const $target = qa(".tag-manager-sidebar .sidebar-item").filter((el) => el.contains(event.target));
            ContextMenu.open({
                items: [
                    // 搜尋
                    {
                        label: w.i18n.__('context.tagGroup.filterWithTags'),
                        keywords: '搜尋 篩選 標籤 Search Filter Tag 検索フィルタータグ',
                        icon: 'ic-tag-filter.svg',
                        click: () => {
                            TagManager.filterWithTags(tagGroup.tags, false);
                        }
                    },
                    { role: 'separator' },
                    // 重命名
                    {
                        label: w.i18n.__('context.tagGroup.rename'),
                        keywords: '重命名 rename 名前を変更する tag group',
                        icon: 'ic-rename.svg',
                        accelerator: usePreferencesState.getState().preferences.shortcuts.keybinds[`edit.rename.${process.platform}`],
                        click: () => {
                            machineryRenameTagGroup(tagGroup);
                        }
                    },
                    // 刪除群組
                    {
                        label: w.i18n.__('context.tagGroup.remove'),
                        keywords: '刪除 移除 delete remove tag group',
                        icon: 'ic-tag-remove.svg',
                        accelerator: (process.platform === 'win32')? 'Del' : '⌘+⌫',
                        click: () => {
                            machineryRemoveTagGroup(tagGroup);
                        }
                    },
                    // 添加至其它資源庫
                    { role: 'separator' },
                    {
                        label: w.i18n.__('context.image.addToLibrary'),
                        keywords: '',
                        icon: 'ic-library-add-to.svg',
                        submenu: historyLibraryMenu
                    },
                    { role: 'separator' },
                    // 顏色
                    {
                        role: 'color',
                        click: ( color: any) => {
                            useMiscRawState.getState().changeTagGroupColor(event, tagGroup, color);
                        }
                    }
                ],
                onOpened: () => {
                    $target.forEach((el) => el.classList.add("context-activate"));
                },
                onClosed: () => {
                    $target.forEach((el) => el.classList.remove("context-activate"));
                },
                showSearch: true
            });
        });        

        writeScopeField('renameTagGroup', function (group: any) {
            writeScopeField('currentTagGroup', group);
            syncTagManagerFromScope();
            writeScopeField('newGroupName', group.name);
            syncTagManagerFromScope();
            group.editable = true;
            setTimeout(function() {
                q("#group-input-" + group.id)?.focus();
                (q("#group-input-" + group.id) as HTMLInputElement)?.select();
            }, 100);
            setTimeout(function() {
                q("#group-input-" + group.id)?.focus();
                (q("#group-input-" + group.id) as HTMLInputElement)?.select();
            }, 200);
        });

        writeScopeField('changeTagGroupColor', function (event: any, tagGroup: any, color: any) {
            if (!color) {
                delete tagGroup.color;
            }
            else {
                tagGroup.color = color;
            }

            for (var i = 0; i < tagGroup.tags.length; i++) {
                var name = tagGroup.tags[i];
                if (TagManager.tagMappings[name]) {
                    if (!color) {
                        TagManager.tagMappings[name].color = color;
                    }
                    else {
                        delete TagManager.tagMappings[name].color;
                    }
                }
            }

            TagManager.calculateTags();
            TagManager.saveGroup();
            try { w.electronLog && w.electronLog.info(`[app] Change tag group: ${tagGroup.name}(${tagGroup.id}) color to: ${color}`); } catch (err: any) {};
            w.analytics.event('ChangeColor', 'TagGroup', color);
        });

        writeScopeField('removeTagGroup', function (group: any) {

            const remove = function (group: any) {
                var idx = TagManager.removeGroup(group.id);
                if (TagManager.groups[idx]) {
                    writeScopeField('currentTagGroup', TagManager.groups[idx]);
                    syncTagManagerFromScope();
                }
                else if (TagManager.groups[idx - 1]) {
                    writeScopeField('currentTagGroup', TagManager.groups[idx - 1]);
                    syncTagManagerFromScope();
                }
                else {
                    machineryOpenTagAllGroup();
                }
            };

            if (group.tags.length > 0) {
                w.swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${w.i18n.__("dialog.removeTagGroup.title")}</h4>
                            <p class="alert-desc">${w.i18n.__("dialog.removeTagGroup.desc")}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: w.i18n.__('dialog.removeTagGroup.button'),
                    cancelButtonText: w.i18n.__("general.cancel"),
                }).then(function () {
                    remove(group);
                });
            }
            else {
                remove(group);
            }
        });

        writeScopeField('renameTagGroupBlur', function (group: any, newName: any) {
            if (newName) {
                TagManager.renameGroup(group.id, newName);
                delete group.editable;
            }
        });

        writeScopeField('renameTagGroupKeyup', function (event: any, group: any, newName: any) {
            event.stopPropagation();
            // event.preventDefault();
            if (event.keyCode === 13) {
                TagManager.renameGroup(group.id, newName);
                group.editable = false;
            }
            else if (event.keyCode === 27) {
                //
                group.editable = false;
            }
            return false;
        });

        // 標籤群組描述變更（使用防抖保存）
        var tagGroupDescriptionChangeTimeout;
        var tagGroupDescriptionOriginal; // 記錄 focus 時的原始值

        writeScopeField('tagGroupDescriptionChange', function () {
            if (!useMiscRawState.getState().currentTagGroup) return;

            getTimeout().cancel(tagGroupDescriptionChangeTimeout);
            tagGroupDescriptionChangeTimeout = getTimeout()(function () {
                TagManager.saveGroup();
            }, 1000);
        });

        // 標籤群組描述聚焦事件 - 記錄原始值
        writeScopeField('tagGroupDescriptionFocus', function () {
            if (!useMiscRawState.getState().currentTagGroup) return;
            tagGroupDescriptionOriginal = useMiscRawState.getState().currentTagGroup.description || '';
        });

        // 標籤群組描述失焦事件 - 只在值改變時才保存
        writeScopeField('tagGroupDescriptionBlur', function () {
            if (!useMiscRawState.getState().currentTagGroup) return;

            getTimeout().cancel(tagGroupDescriptionChangeTimeout);

            // 使用 getTimeout() 確保在 contenteditable directive 更新 model 之後再比較
            getTimeout()(function () {
                if (!useMiscRawState.getState().currentTagGroup) return;

                var currentValue = useMiscRawState.getState().currentTagGroup.description || '';
                if (currentValue === tagGroupDescriptionOriginal) {
                    // 值沒有改變，不需要保存
                    return;
                }

                TagManager.saveGroup();

                try {
                    w.electronLog && w.electronLog.info(`[app] Change tag group description: ${useMiscRawState.getState().currentTagGroup.name}(${useMiscRawState.getState().currentTagGroup.id})`);
                } catch (err: any) {};
            }, 0);
        });

        ipcRenderer.on('jieba-extract-done', function (e: any, result: any) {

            // console.timeEnd("======== 取得推荐标签 ========");

            var selectedTags = w.eagle.inspector.calculateTags(useSelectionState.getState().selected);

            result.forEach(function (term: any) {
                var idx = TagManager.suggestions.indexOf(term.word);
                // var existIdx = selectedTags.indexOf(term.word);

                if (idx == -1 && term.word.split(/\d/).length < 3 && term.word.localeLength() >= 2) {
                    TagManager.suggestions.push(term.word.capitalize());
                }
            });

            TagManager.suggestions = TagManager.excludeExistTags(selectedTags, TagManager.suggestions);
            // TagManager.suggestions = TagManager.suggestions.unique();
            TagManager.suggestions = [...new Set(TagManager.suggestions)];

            // 移除 Stopword
            var sw = require('stopword');
            TagManager.suggestions = sw.removeStopwords(TagManager.suggestions)
            TagManager.suggestions = sw.removeStopwords(TagManager.suggestions, sw.zh);
            TagManager.suggestions = sw.removeStopwords(TagManager.suggestions, sw.ja);

            // Note: 优先将已经有标签放在最前方，剩下的标签使用标题排序放在后面
            // console.log(TagManager.suggestions);
            TagManager.suggestions = TagManager.suggestions.sort(function(a, b) {
                if (TagManager.tagMappings[a])
                    return -1;
                if (TagManager.tagMappings[b])
                    return 1;
                try {
                    var na = a.toLowerCase();
                    var nb = b.toLowerCase();
                    if (na && na) {
                        return na.localeCompare(nb, w.languageBCP, {numeric: true});
                    }
                }
                catch (err: any) {}
                return 0;
            });
        });

        // GIF Viewer
        useMiscRawState.getState().gifPlayer;
        useMiscRawState.getState().gifUpadteInterval;

        writeScopeField('gifViewer', {
            frames: [],
            mousedownTime: 0,
            mousedownX: 0,
            mousedownY: 0,
            range: undefined,
            speed: 1,
            setThumbnail: function () {
                if (!useMiscRawState.getState().isGifReady) return;
                var curr = useMiscRawState.getState().gifPlayer.get_current_frame();
                var f = useMiscRawState.getState().gifPlayer.get_frame(curr);
                if (!f) return;
                var b64 = f.base64;
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var image = new Image();
                image.onload = function() {
                    canvas.width = image.width;
                    canvas.height = image.height;
                    ctx.drawImage(image, 0, 0);

                    var ratio = 1;
                    if (canvas.height > canvas.width) {
                        if (canvas.width > 480) {
                            ratio = 480 / canvas.width;
                        }
                        else {
                            ratio = 1;
                        }
                    }
                    else {
                        if (canvas.height > 480) {
                            ratio = 480 / canvas.height;
                        }
                        else {
                            ratio = 1;
                        }
                    }
                    if (ratio !== 1) { canvasResizeTo(canvas, ratio); }

                    var base64string = canvas.toDataURL();
                    IPCHelper.send('regenerate-gif-thumbnail', {
                        gif: useSelectionState.getState().current,
                        base64string: base64string
                    });
                };
                image.src = f.base64;
            },
            setSpeed: function (speed: any = 1) {
                if (!useMiscRawState.getState().gifPlayer) return;
                useMiscRawState.getState().gifViewer.speed = speed;
                syncDetailFromScope();
                useMiscRawState.getState().gifPlayer.set_speed(speed);
                setText(".gif-toolbar-btn.speed span", `${speed}x`);
            },
            mousedown: function (event: any) {
                if (event.button !== 0) return;
                useMiscRawState.getState().gifViewer.mousedownX = event.clientX;
                syncDetailFromScope();
                useMiscRawState.getState().gifViewer.mousedownY = event.clientY;
                syncDetailFromScope();
                useMiscRawState.getState().gifViewer.mousedownTime = Date.now();
                syncDetailFromScope();
            },
            mouseup: function (event: any) {
                if (event.button !== 0) return;
                // 判断是点击或是拖拽
                if (Date.now() - useMiscRawState.getState().gifViewer.mousedownTime < 333 && Math.abs(useMiscRawState.getState().gifViewer.mousedownX - event.clientX) < 5 && Math.abs(useMiscRawState.getState().gifViewer.mousedownY - event.clientY) < 5)  {
                    toggleGifPlay();
                }
            },
            cancelRange: function () {
                if (useMiscRawState.getState().gifViewer.range !== undefined) {
                    useMiscRawState.getState().gifViewer.range = undefined;
                    syncDetailFromScope();
                    cssSet(".gif-toolbar .resize-bar", {
                        left: "0%",
                        width: "100%"
                    });
                    if (useMiscRawState.getState().gifPlayer) {
                        useMiscRawState.getState().gifPlayer.move_to(0);
                    }
                }
            },
            nextFrame: function () {
                var curr = useMiscRawState.getState().gifPlayer.get_current_frame();
                var index = curr + 1;
                if (index + 1 > useMiscRawState.getState().gifViewer.frames.length - 1) index = useMiscRawState.getState().gifViewer.frames.length - 1;
                useMiscRawState.getState().gifViewer.setFrame(index);
                useMiscRawState.getState().gifPlayer.pause();
            },
            prevFrame: function () {
                var curr = useMiscRawState.getState().gifPlayer.get_current_frame();
                var index = curr - 1;
                if (index - 1 < 0) index = 0;
                useMiscRawState.getState().gifViewer.setFrame(index);
                useMiscRawState.getState().gifPlayer.pause();
            },
            setFrame: function (index: any) {
                useMiscRawState.getState().gifPlayer.move_to(index);
            },
            onProgress: function (progress: any, length: any) {
                clearInterval(useMiscRawState.getState().gifUpadteInterval);
                if (useMiscRawState.getState().isGifReady === true) {
                    writeScopeField('isGifReady', false);
                    syncDetailFromScope();
                    delete useMiscRawState.getState().gifViewer.frames;
                    useMiscRawState.getState().gifViewer.frames = [];
                    syncDetailFromScope();
                    useMiscRawState.getState().gifViewer.mousedownTime = 0;
                    syncDetailFromScope();
                    useMiscRawState.getState().gifViewer.mousedownX = 0;
                    syncDetailFromScope();
                    useMiscRawState.getState().gifViewer.mousedownY = 0;
                    syncDetailFromScope();
                    useMiscRawState.getState().gifViewer.range = undefined;
                    syncDetailFromScope();
                    writeScopeField('gifPlayer', undefined);
                    syncDetailFromScope();
                }
                updateGifProgressbar(progress);
                setText(".gif-toolbar .message span", `${parseInt((progress * 100) as any)}%`)
            },
            onFinished: function (result: any) {
                useMiscRawState.getState().gifViewer.range = undefined;
                syncDetailFromScope();
                writeScopeField('gifPlayer', result.gifPlayer);
                syncDetailFromScope();
                writeScopeField('isGifReady', true);
                syncDetailFromScope();
                useMiscRawState.getState().gifViewer.frames = result.frames;
                syncDetailFromScope();
                useMiscRawState.getState().gifViewer.playing = result.playing;
                syncDetailFromScope();
                useMiscRawState.getState().gifViewer.setSpeed(1);
                const resizableBarEl = q(".gif-toolbar .resize-bar");
                setText(".gif-toolbar .total-frame", `/ ${useMiscRawState.getState().gifViewer.frames.length}`);

                const prevBar = resizableBarEl ? getResizable(resizableBarEl) : undefined;
                if (prevBar) prevBar.destroy();

                cssSet(".gif-toolbar .resize-bar", {
                    left: 0,
                    width: 'auto'
                });

                removeClass(".gif-toolbar.in", "in");
                setTimeout(function () {
                    addClass(".gif-toolbar", "in");
                }, 100);

                var gifPlayerResizeOriginalState = false;
                var gifPlayerResizing = false;
                var gifPlayerLastResizeLeft;
                var gifPlayerLastResizeWidth;
                var gifPlayerToolbarOffset;
                // D-2f：jQuery-UI resizable → 自研
                makeResizable(resizableBarEl as HTMLElement, {
                	minWidth: 2,
                    handles: "e, w",
                    containment: ".gif-toolbar .progress-bar",
                    start: function (event: any, ui: any) {
                        gifPlayerLastResizeLeft = parseInt((ui.element.css("left")) as any);
                        gifPlayerLastResizeWidth = ui.element.width();
                        gifPlayerResizeOriginalState = useMiscRawState.getState().gifPlayer.get_playing();
                        useMiscRawState.getState().gifPlayer.pause();
                        gifPlayerToolbarOffset = offsetLeftOf(q(".gif-toolbar .progress-bar"));
                    },
                    resize: function (event: any, ui: any) {
                        hide("#gif-progress-indicator");
                        gifPlayerResizing = true;

                        var currentPosX = event.pageX - gifPlayerToolbarOffset;
                        var width = widthOf(q(".gif-toolbar .progress-bar"));
                        var index = Math.round(currentPosX / width * useMiscRawState.getState().gifViewer.frames.length) + 1;
                        // if (!index) return;
                        if (index -1  >= useMiscRawState.getState().gifViewer.frames.length) index = useMiscRawState.getState().gifViewer.frames.length;
                        if (!gifPlayerProgressDown) {
                            var img = q("#thumbnail-preview img") as HTMLImageElement;
                            var f = useMiscRawState.getState().gifPlayer.get_frame(index - 1);
                            if (!f) return;
                            img.src = f.base64;

                            var imgWidth = widthOf(q("#thumbnail-preview img"));
                            var left = currentPosX - imgWidth / 2;
                            if (left < 0) left = 0;
                            if (left > width - imgWidth) left = width - imgWidth;

                            cssSet("#thumbnail-preview", {
                                transform: `translateX(${left}px)`
                            });

                            setText("#thumbnail-preview .current-index", `${index}`);
                            show("#thumbnail-preview");
                        }
                        else {
                            cssSet(".gif-toolbar .progress-bar .ui-resizable-handle", { "pointer-events": "none" });
                            cssSet("#gif-progress-indicator", { left: `${ (index - 1) / (useMiscRawState.getState().gifViewer.frames.length - 1) * 100 }%` });
                            useMiscRawState.getState().gifPlayer.move_to(index - 1);
                            useMiscRawState.getState().gifPlayer.pause();
                        }

                    },
                    stop: function (event: any, ui: any) {
                        gifPlayerResizing = false;
                        var frames = useMiscRawState.getState().gifViewer.frames;
                        var parentWidth = widthOf(q(".gif-toolbar .progress-bar"));
                        var left = parseInt((ui.element.css("left")) as any);
                        var width = ui.element.width();
                        var leftP = left / parentWidth * 100;
                        var widthP = width / parentWidth * 100;;
                        cssSet(".gif-toolbar .resize-bar", {
                            left: `${leftP}%`,
                            width: `${widthP}%`
                        });

                        // 移動 start
                        var index = useMiscRawState.getState().gifPlayer.get_current_frame();
                        if (index < 0) index = 0;
                        if (gifPlayerLastResizeLeft !== left) {
                            if (useMiscRawState.getState().gifViewer.range === undefined) {
                                useMiscRawState.getState().gifViewer.range = [index, useMiscRawState.getState().gifViewer.frames.length];
                                syncDetailFromScope();
                            }
                            else {
                                useMiscRawState.getState().gifViewer.range = [index, useMiscRawState.getState().gifViewer.range[1]];
                                syncDetailFromScope();
                            }
                        }
                        // 移動 end
                        else if (gifPlayerLastResizeWidth !== width) {
                            if (useMiscRawState.getState().gifViewer.range === undefined) {
                                useMiscRawState.getState().gifViewer.range = [0, index + 1];
                                syncDetailFromScope();
                            }
                            else {
                                useMiscRawState.getState().gifViewer.range = [useMiscRawState.getState().gifViewer.range[0], index + 1];
                                syncDetailFromScope();
                            }
                        }

                        if (useMiscRawState.getState().gifViewer.range && useMiscRawState.getState().gifViewer.range[0] > useMiscRawState.getState().gifViewer.range[1]) {
                            useMiscRawState.getState().gifViewer.range = [useMiscRawState.getState().gifViewer.range[1], useMiscRawState.getState().gifViewer.range[0]];
                            syncDetailFromScope();
                        }
                        console.log(useMiscRawState.getState().gifViewer.range);

                        show("#gif-progress-indicator");
                        if (!isVisible(q(".gif-toolbar-btn.play-btn"))) {
                            useMiscRawState.getState().gifPlayer.play();
                        }

                        gifPlayerProgressDown = false;
                        cssSet(".gif-toolbar .progress-bar .ui-resizable-handle", { "pointer-events": "" });
                        // jQuery: $(".gif-toolbar").trigger("mouseup");
                    }
                });


                writeScopeField('gifUpadteInterval', setInterval(function () {
                    try {
                        var c = useMiscRawState.getState().gifPlayer.get_current_frame();
                        var length = useMiscRawState.getState().gifPlayer.get_length();

                        if (useMiscRawState.getState().gifViewer.range && !gifPlayerResizing && !gifPlayerProgressDown) {
                            var start = useMiscRawState.getState().gifViewer.range[0];
                            var end = useMiscRawState.getState().gifViewer.range[1];
                            if (c <= start) { 
                                c = start; 
                                useMiscRawState.getState().gifPlayer.move_to(c);
                            }
                            if (c >= end) { 
                                c = start; 
                                useMiscRawState.getState().gifPlayer.move_to(c);
                            }
                        }

                        var text = paddingNumber(c + 1, `${length}`.length);
                        if (textOf(".gif-toolbar .current-frame") !== text) {
                            setText(".gif-toolbar .current-frame", text);
                        }
                        updateGifIndicator(c + 1);
                    }
                    catch (err: any) {}
                }, 50));
            }
        });
        syncDetailFromScope();
        var updateGifIndicator = function (index: any) {
            var percent = (index - 1) / (useMiscRawState.getState().gifViewer.frames.length - 1) * 100;
            if (percent < 0) percent = 0;
            var value = `${ percent }%`;
            if (cssGet(q("#gif-progress-indicator"), 'left') !== value) {
                cssSet("#gif-progress-indicator", { left: value });
            }
        };
        
        var updateGifProgressbar = function (progress: any) {
            cssSet(".gif-toolbar .progress-bar .current", { width: `${ progress * 100 }%` });
        };

        var gifPlayerProgressDown = false;
        var gifPlayerOriginalState = false;
        var gifDragMove: any = null;
        var gifDragEnd: any = null;
        document.body.addEventListener('mousedown', function (event: any) {
        	var self = delegateTarget(event, ".gif-toolbar .progress-bar");
        	if (!self) return;
            if (event.button === 0 && useMiscRawState.getState().gifPlayer) {
                gifPlayerProgressDown = true;
                gifPlayerOriginalState = useMiscRawState.getState().gifPlayer.get_playing();
                hide("#thumbnail-preview");

                if (useMiscRawState.getState().isGifReady) {
                    var width = widthOf(self);
                    var currentPosX = event.offsetX;
                    var index = Math.round(currentPosX / width * useMiscRawState.getState().gifViewer.frames.length) + 1;
                    if (!index) return;
                    if (index -1  >= useMiscRawState.getState().gifViewer.frames.length) index = useMiscRawState.getState().gifViewer.frames.length;
                    if (useMiscRawState.getState().gifViewer.range !== undefined) {
                        if (index -1 > useMiscRawState.getState().gifViewer.range[1] || index -1 < useMiscRawState.getState().gifViewer.range[0]) {
                            return;
                        }
                    }
                    cssSet("#gif-progress-indicator", { left: `${ (index - 1) / (useMiscRawState.getState().gifViewer.frames.length - 1) * 100 }%` });
                    useMiscRawState.getState().gifPlayer.move_to(index - 1);
                    useMiscRawState.getState().gifPlayer.pause();

                    var startX = event.pageX;
		            	if (gifDragMove) document.body.removeEventListener("mousemove", gifDragMove);
		            	if (gifDragEnd) document.body.removeEventListener("mouseup", gifDragEnd);
		            	gifDragMove = function (event: any) {
		            		var offsetX = event.pageX - startX;
		            		var x = currentPosX + offsetX;
		            		var width2 = widthOf(self);
		                    var index = Math.round(x / width2 * useMiscRawState.getState().gifViewer.frames.length) + 1;
		                    if (index -1  >= useMiscRawState.getState().gifViewer.frames.length) index = useMiscRawState.getState().gifViewer.frames.length;
		                    if (index < 1) index = 1;
		            		cssSet(".gif-toolbar .progress-bar .ui-resizable-handle", { "pointer-events": "none" });
			                cssSet("#gif-progress-indicator", { left: `${ (index - 1) / (useMiscRawState.getState().gifViewer.frames.length - 1) * 100 }%` });
			                useMiscRawState.getState().gifPlayer.move_to(index - 1);
			                useMiscRawState.getState().gifPlayer.pause();
		            	};

		            	gifDragEnd = function (event: any) {
            			if (event.button === 0) {
            				event.stopPropagation();
			                gifPlayerProgressDown = false;
			                if (gifPlayerOriginalState && useMiscRawState.getState().gifPlayer) {
			                    useMiscRawState.getState().gifPlayer.play();
			                }
			            }
			            cssSet(".gif-toolbar .progress-bar .ui-resizable-handle", { "pointer-events": "" });
            			document.body.removeEventListener("mousemove", gifDragMove);
            			document.body.removeEventListener("mouseup", gifDragEnd);
            		};
            		document.body.addEventListener("mousemove", gifDragMove);
            		document.body.addEventListener("mouseup", gifDragEnd);
                }
            }
        });

        document.body.addEventListener('mouseup', function (event: any) {
        	if (!delegateTarget(event, ".gif-toolbar")) return;
            if (event.button === 0) {
            }
            else if (event.button === 2) {
            	useMiscRawState.getState().gifPlayer.pause();
                useMiscRawState.getState().openGifContextMenu(event);
            }
        });

        document.body.addEventListener('mouseleave', function (event: any) {
        	if (!delegateTarget(event, ".gif-toolbar .progress-bar")) return;
            if (!gifPlayerProgressDown) {
                hide("#thumbnail-preview");
            }
        }, true);

        document.body.addEventListener('mousemove', function (event: any) {
        	if (!delegateTarget(event, ".gif-toolbar .progress-bar .ui-resizable-handle")) return;
            event.stopPropagation();
        });

        document.body.addEventListener('wheel', function (e: any) {
        	if (!delegateTarget(e, ".gif-toolbar .progress-bar")) return;
        	useMiscRawState.getState().gifPlayer.pause();
        	var delta = e.deltaY;
        	var ne = delta < 0 ? 1 : (delta > 0 ? -1 : 1);
        	if (ne > 0) {
        		useMiscRawState.getState().gifViewer.nextFrame();
        	}
        	else {
        		useMiscRawState.getState().gifViewer.prevFrame();
        	}
        }, { passive: true });

        document.body.addEventListener('mousemove', function (event: any) {
        	var self = delegateTarget(event, ".gif-toolbar .progress-bar");
        	if (!self) return;
            if (event.button === 0) {
                var currentPosX = event.offsetX;

                // 显示缩略图
                if (useMiscRawState.getState().isGifReady) {
                    var width = widthOf(self);
                    var index = Math.round(currentPosX / width * useMiscRawState.getState().gifViewer.frames.length) + 1;
                    // if (!index) return;
                    if (index -1  >= useMiscRawState.getState().gifViewer.frames.length) index = useMiscRawState.getState().gifViewer.frames.length;
                    if (!gifPlayerProgressDown) {
                        var img = q("#thumbnail-preview img") as HTMLImageElement;
                        var f = useMiscRawState.getState().gifPlayer.get_frame(index - 1);
                        if (!f) return;
                        img.src = f.base64;

                        var imgWidth = widthOf(q("#thumbnail-preview img"));
                        var left = currentPosX - imgWidth / 2;
                        if (left < 0) left = 0;
                        if (left > width - imgWidth) left = width - imgWidth;

                        cssSet("#thumbnail-preview", {
                            transform: `translateX(${left}px)`
                        });

                        setText("#thumbnail-preview .current-index", `${index}`);
                        show("#thumbnail-preview");
                    }
                }
            }
        });
    
        // 動態建立 mousetrap 綁定
  return TagManager;
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
/* autoResizeTagFilter（bundle 43119-43128 逐字；controller 闭包函数 → 域内移植） */
export function machineryAutoResizeTagFilter(): void {
  const w = window as any;
  var tagsLength = useMiscRawState.getState().containTags.length;
  var height = tagsLength * 24 + 54;
  if (useLayoutState.getState().containerSize && useLayoutState.getState().containerSize.tagFilter) {
    if (useLayoutState.getState().containerSize.tagFilter > height) {
      cssSet(".tags-filter", { height: height });
    }
    else {
      cssSet(".tags-filter", { height: useLayoutState.getState().containerSize.tagFilter });
    }
  }
}

/* $scope.calcuteContainTags（bundle 27155-27194 逐字） */
export function machineryCalcuteContainTags(data: any[]): void {
  const w = window as any;
  var result = machineryCalcuteContainTagsInner(data);

  // 建立群组列表
  var tagsMappings = result.containTagsMappings;
  useMiscRawState.getState().TagManager.groups.forEach(function (group: any) {
    var groupObject = [];
    group.tags.forEach(function (tag: any) {
      if (tagsMappings[tag]) {
        groupObject.push(tagsMappings[tag]);
        tagsMappings[tag].type = "group-item";
        tagsMappings[tag].group = group;
      }
    });
  });

  writeScopeField('containTags', []);
  syncFilterFromScope();

  var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  result.containTags = result.containTags.sort(function (a: any, b: any) {
    return collator.compare(a.name, b.name);
  });

  result.containTags.forEach(function (tag: any) {
    useMiscRawState.getState().containTags.push(tag);
    syncFilterFromScope();
  });

  // 显示未标签功能
  if (result.noTagsCount > 0) {
    useMiscRawState.getState().containTags.unshift({
      isSelected: w.eagle.filter.filterRules.tag.no,
      name: w.i18n.__("Filter.NoTags"),
      imageCount: result.noTagsCount,
      index: 100000000,
      isNoTags: true
    });
    syncFilterFromScope();
  }
}

/* calcuteContainTags 闭包版（bundle 27196-27292 逐字） */
function machineryCalcuteContainTagsInner(data: any[]): any {
  const w = window as any;
  var tagsCount: any = {};
  var tagsMappings: any = {};
  var noTagsCount = 0;

  w.eagle.filter.filterRules.tag.excludes.forEach(function (tag: any) {
    tagsCount[tag] = 0;
  });

  for (var i = data.length - 1; i >= 0; i--) {
    var image = data[i];
    if (image.tags && image.tags.length > 0) {
      image.tags.forEach(function (tag: any) {
        if (tag && tag.length > 200) return;
        if (!tagsCount[tag]) { tagsCount[tag] = 0; }
        tagsCount[tag]++;
      });
    }
    else {
      noTagsCount++;
    }
  }

  var tags = Object.keys(tagsCount).map(function (key: any) {
    var idx = w.eagle.filter.filterRules.tag.includes.indexOf(key);
    var eidx = w.eagle.filter.filterRules.tag.excludes.indexOf(key);
    var index;
    if (idx > -1 && (w.eagle.filter.tagFilterLogic === "AND")) {
      index = tagsCount[key] - idx;
    }
    else if (eidx > -1 && (w.eagle.filter.tagFilterLogic === "AND")) {
      index = tagsCount[key] - 100;
    }
    else {
      index = tagsCount[key] - 100;
    }
    tagsMappings[key] = {
      isSelected: idx > -1,
      isExcluded: eidx > -1,
      name: key,
      pinyin: useMiscRawState.getState().TagManager.tagMappings[key] && useMiscRawState.getState().TagManager.tagMappings[key].pinyin,
      imageCount: tagsCount[key],
      index: index
    };
    return tagsMappings[key];
  });

  tags.sort(function (tag1: any, tag2: any) {
    return tag2.imageCount - tag1.imageCount;
  });

  if (noTagsCount === 0 && !w.eagle.filter.isLock) {
    w.eagle.filter.filterRules.tag.no = false;
  }

  return {
    containTagsMappings: tagsMappings,
    containTags: tags,
    noTagsCount: noTagsCount
  };
}

export function machineryConvertToRegexGroup(keywords: any, keywords_cn: any, keywords_tw: any): any {
    const regexGroup: any = {
        mustMatch: [] as any[],      // AND 邏輯
        mustNotMatch: [] as any[],   // NOT 邏輯
        anyMatch: [] as any[],       // OR 邏輯
        exactMatch: [] as any[]      // 精確匹配（雙引號）
    };

    keywords.forEach((keyword: any, index: any) => {
        if (Array.isArray(keyword)) {
            // OR 群組
            const positives: any[] = [];
            const negatives: any[] = [];

            keyword.forEach((k: any, orIndex: any) => {
                if (k.startsWith('-')) {
                    // 處理負向條件
                    let word = k.substring(1).replace(/"/g, '');
                    negatives.push(word);

                    // 加入繁簡體版本
                    if (keywords_cn && keywords_cn[index] && keywords_cn[index][orIndex]) {
                        let word_cn = keywords_cn[index][orIndex].substring(1).replace(/"/g, '');
                        if (word_cn !== word) negatives.push(word_cn);
                    }
                    if (keywords_tw && keywords_tw[index] && keywords_tw[index][orIndex]) {
                        let word_tw = keywords_tw[index][orIndex].substring(1).replace(/"/g, '');
                        if (word_tw !== word) negatives.push(word_tw);
                    }
                } else if (k.startsWith('"') && k.endsWith('"')) {
                    // OR 群組中的精確匹配暫時當作一般匹配處理
                    let word = k.replace(/"/g, '');
                    positives.push(word);

                    // 加入繁簡體版本
                    if (keywords_cn && keywords_cn[index] && keywords_cn[index][orIndex]) {
                        let word_cn = keywords_cn[index][orIndex].replace(/"/g, '');
                        if (word_cn !== word) positives.push(word_cn);
                    }
                    if (keywords_tw && keywords_tw[index] && keywords_tw[index][orIndex]) {
                        let word_tw = keywords_tw[index][orIndex].replace(/"/g, '');
                        if (word_tw !== word) positives.push(word_tw);
                    }
                } else {
                    // 處理正向條件
                    let word = k;
                    positives.push(word);

                    // 加入繁簡體版本
                    if (keywords_cn && keywords_cn[index] && keywords_cn[index][orIndex]) {
                        let word_cn = keywords_cn[index][orIndex];
                        if (word_cn !== word) positives.push(word_cn);
                    }
                    if (keywords_tw && keywords_tw[index] && keywords_tw[index][orIndex]) {
                        let word_tw = keywords_tw[index][orIndex];
                        if (word_tw !== word) positives.push(word_tw);
                    }
                }
            });

            // 建立正向 OR 的 RegEx
            if (positives.length > 0) {
                const pattern = positives.map(escapeRegex).join('|');
                regexGroup.anyMatch.push(new RegExp(`(${pattern})`, 'i'));
            }

            // 負向條件單獨處理
            negatives.forEach((neg: any) => {
                regexGroup.mustNotMatch.push(new RegExp(escapeRegex(neg), 'i'));
            });

        } else if (keyword.startsWith('-')) {
            // 單純 NOT
            let word = keyword.substring(1).replace(/"/g, '');
            let patterns = [word];

            // 加入繁簡體版本
            if (keywords_cn && keywords_cn[index]) {
                let word_cn = keywords_cn[index].substring(1).replace(/"/g, '');
                if (word_cn !== word) patterns.push(word_cn);
            }
            if (keywords_tw && keywords_tw[index]) {
                let word_tw = keywords_tw[index].substring(1).replace(/"/g, '');
                if (word_tw !== word) patterns.push(word_tw);
            }

            const pattern = patterns.map(escapeRegex).join('|');
            regexGroup.mustNotMatch.push(new RegExp(`(${pattern})`, 'i'));

        } else {
            // 單純 AND
            let word = keyword.replace(/"/g, '');
            let patterns = [word];

            // 加入繁簡體版本
            if (keywords_cn && keywords_cn[index]) {
                let word_cn = keywords_cn[index].replace(/"/g, '');
                if (word_cn !== word) patterns.push(word_cn);
            }
            if (keywords_tw && keywords_tw[index]) {
                let word_tw = keywords_tw[index].replace(/"/g, '');
                if (word_tw !== word) patterns.push(word_tw);
            }

            const pattern = patterns.map(escapeRegex).join('|');
            regexGroup.mustMatch.push(new RegExp(`(${pattern})`, 'i'));
        }
    });

    return regexGroup;
}

export function machineryEditTag(tag: any): void {
  const w = window as any;
  const TagManager = useMiscRawState.getState().TagManager;
  w.swal({
    title: w.i18n.__("Context.Tag.Edit.Title"),
    html: w.i18n.__("Context.Tag.Edit.Descript"),
    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
    onOpen: function () {
      setTimeout(function () {
        var input = w.swal.getInput();
        if (input) {
          (input as HTMLInputElement).select();
          (input as HTMLInputElement).focus();
        }
      }, 100);
    },
    width: 400,
    input: 'text',
    inputPlaceholder: w.i18n.__('Context.Tag.Edit.Placeholder'),
    inputValue: tag.name,
    inputValidator: function (value: any) {
      return new Promise(function (resolve: any, reject: any) {
        // if (value && !/[$%^*<>'"\\|?*]+/.test(value)) {
        resolve()
        // } else {
        // reject(i18n.__('Dialog.CreateLibrary.Error'))
        // }
      })
    },
    cancelButtonColor: "#777777",
    confirmButtonText: w.i18n.__("Context.Tag.Edit.Title"),
    cancelButtonText: w.i18n.__("general.cancel"),
  }).then(function (newName: any) {

    if (newName === tag.name) return;

    w.electronLog && w.electronLog.info(`[app] Rename tag: [${tag.name}] > [${newName}]`);
    w.analytics.event('Tag', 'Rename', newName);

    var originTag = structuredClone(tag);

    // 更新所有出现该标签的图片
    var originImages: any[] = [];
    var originImagesTags: any[] = [];
    var changed: any[] = [];

    // $scope.raw.forEach(function(image) {
    for (var rindex = useItemState.getState().raw.length - 1; rindex >= 0; rindex--) {
      var image = useItemState.getState().raw[rindex];
      if (image && image.tags) {
        var idx = image.tags.indexOf(tag.name);
        if (idx !== -1 && newName) {
          originImages.push(image);
          originImagesTags.push(structuredClone(image.tags));
          image.tags[idx] = newName;
          image.tags = [...new Set(image.tags)];
          changed.push(image);
        }
      }
    }
    w.ayncsImagesChange(changed);
    w.hiddenByCurrentFilter(changed);

    // 修改标签群组包含的标签
    var originGroups: any[] = [];
    var originGroupsTags: any[] = [];
    if (TagManager.groups.length > 0) {
      TagManager.groups.forEach(function (group: any) {
        originGroups.push(group);
        originGroupsTags.push(structuredClone(group.tags));
        if (group.tags) {
          var idx = group.tags.indexOf(tag.name);
          if (idx !== -1 && newName) {
            var nidx = group.tags.indexOf(newName);
            if (nidx === -1) {
              group.tags[idx] = newName;
              group.tags = [...new Set(group.tags)];
            }
            else {
              group.tags.splice(idx, 1);
            }
          }
        }
      });
    }

    var originHistoryTags: any = structuredClone(originHistoryTags);
    try {
      if (TagManager.historyTags && TagManager.historyTags.length > 0) {
        var idx = TagManager.historyTags.indexOf(tag.name);
        if (idx !== -1 && newName) {
          var nidx = TagManager.historyTags.indexOf(newName);
          if (nidx === -1) {
            TagManager.historyTags[idx] = newName;
            TagManager.historyTags = [...new Set(TagManager.historyTags)];
          }
          else {
            TagManager.historyTags.splice(idx, 1);
          }
          TagManager.save();
        }
      }
    } catch (err: any) {
      w.electronLog && w.electronLog.error(err.stack || err);
    }

    // 更新所有文件夹智能标签
    var originFolders: any[] = [];
    var originFoldersTags: any[] = [];
    w.eagle.utils.tree.walk(useFolderState.getState().folders, 'children', function (folder: any, parent: any) {
      if (folder && folder.tags) {
        var idx = folder.tags.indexOf(tag.name);
        if (idx !== -1 && newName) {
          originFolders.push(folder);
          originFoldersTags.push(structuredClone(folder.tags));
          folder.tags[idx] = newName;
          folder.tags = [...new Set(folder.tags)];
        }
      }
    });

    // 更新智能文件夹的标签属性
    var originConditions: any[] = [];
    var originSmartFolders: any[] = [];
    w.eagle.utils.tree.walk(useFolderState.getState().smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
      if (!smartFolder.conditions) return;
      originSmartFolders.push(smartFolder);
      originConditions.push(structuredClone(smartFolder.conditions));

      smartFolder.conditions.forEach(function (condition: any) {
        if (!condition.rules) return;
        condition.rules.forEach(function (rule: any) {
          if (rule && rule.property === 'tags') {
            var ruleTags = rule.value;
            if (ruleTags && ruleTags.length > 0) {
              var idx = ruleTags.indexOf(tag.name);
              if (idx !== -1 && newName) {
                rule.value[idx] = newName;
                rule.value = [...new Set(rule.value)];
              }
            }
          }
        });
      });
    });

    useMiscRawState.getState().tagsSuggestion.push({
      value: newName,
      text: newName
    });

    machinerySaveFolder();

    tag.name = newName;
    tag.pinyin = w.tinyPinyin.convertToPinyin(tag.name);
    machineryCalculateImageBinding({ ignoreSort: true }, function () {
      machineryRebindRefresh();
      machineryUpdateSelection();
    });

    var message = getFilter()('i18n')("notify.tag.nameChange", [
      { "property": "origin", "value": originTag.name },
      { "property": "new", "value": tag.name }
    ]);
    // 復原
    useMiscRawState.getState().notify({
      message: message,
      duration: 2000,
    });

  }, function () { });
}

export function machineryEnableSubFolderNameEditable(event: any, folder: any): void {
  const w = window as any;
  const el = ((event && event.target) || null) as HTMLElement;
  if (!folder) return;
  if (hasClass(el, "editable")) return;
  if (!el) return;

  machinerySelectFolder(event, folder);

  var originalName = textEl(el).trim();
  el.setAttribute("contenteditable", "true");
  el.classList.add("editable");
  el.focus();
  setTimeout(function () {
    selectText(el);
    document.execCommand('selectAll', false, null as any);
  }, 50);

  onEl(el, "mousedown", function (event: any) {
    event.stopPropagation();
  });

  onEl(el, "keydown", function (event: any) {
    var keyCode = event.keyCode;
    switch (keyCode) {
      case 13:
        event.preventDefault();
        event.stopPropagation();
        triggerEl(el, "blur");
        break;
      case 27:
        event.preventDefault();
        event.stopPropagation();
        setHtmlEl(el, `${originalName}`);
        exitEditable();
        break;
      case 65:
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          document.execCommand('selectAll', false, null as any);
        }
        break;
    }
  });

  onEl(el, "paste", function (e: any) {
    e.preventDefault();
    var text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    document.execCommand("insertHTML", false, text);
  });

  onEl(el, "click", function (event: any) {
    event.stopPropagation();
  });

  onEl(el, "blur", w.debounce(function () {
    exitEditable();
    var newName = textEl(el);
    if (!newName || !newName.trim()) {
      setHtmlEl(el, `${originalName}`);
      return;
    }
    if (newName !== originalName && folder) {

      var name = newName;
      name = name.substr(0, getRemainingFilenameLength()(useMiscRawState.getState().libraryPath));
      name = getSanitize()(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();
      name = unescape(name);

      if (emojiRegex.test(name)) {
        name = name.replace(emojiRegex, '');
      }

      setHtmlEl(el, `${name}`);
      folder.name = name;
      useMiscRawState.getState().saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change sub-folder name: ${originalName}(${folder.id}) > ${newName}`); } catch (err) { }
    }
  }, 500, true));

  function exitEditable() {
    el.style.whiteSpace = "normal";
    el.setAttribute("contenteditable", "false");
    el.classList.remove("editable");
    offEl(el, "click");
    offEl(el, "keyup");
    offEl(el, "keydown");
    offEl(el, "mousedown");
    setTimeout(function () {
      el.style.whiteSpace = "";
    }, 33);
  }
}

/* 取得继承炼的标签（bundle 32028 逐字；tags.unique() 为 bundle Array 原型扩展，保留原调用） */
export function machineryGetExtendTags(folder: any, tags: any[]): any[] {
  const uniqueTags: any = tags as any;
  try {
    if (folder.tags) {
      folder.tags.forEach(function (tag: any) {
        tags.push(tag);
      });
    }
    const parent = useItemState.getState().folderMappings[folder.parent];
    if (parent && parent.tags && folder.parent) {
      return machineryGetExtendTags(parent, tags);
    }
    else {
      return uniqueTags.unique().reverse();
    }
  } catch (err) {
    return uniqueTags.unique().reverse();
  }
}

export function machineryMatchWithRegexGroup(text: any, regexGroup: any): any {
    // 1. 所有 mustMatch 都必須匹配
    for (let regex of regexGroup.mustMatch) {
        if (!regex.test(text)) return false;
    }

    // 2. 所有 mustNotMatch 都不能匹配
    for (let regex of regexGroup.mustNotMatch) {
        if (regex.test(text)) return false;
    }

    // 3. 每個 anyMatch（OR群組）至少要有一個匹配
    for (let regex of regexGroup.anyMatch) {
        if (!regex.test(text)) return false;
    }

    // 如果沒有任何條件，或所有條件都通過
    return regexGroup.mustMatch.length > 0 ||
           regexGroup.mustNotMatch.length > 0 ||
           regexGroup.anyMatch.length > 0;
}

export function machineryOpenAllTags(ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (useBodyState.getState().viewMode === 'alltags' && useItemState.getState().allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) return;

  w.ScrollbarSaver.saveScrollPosition();

  writeScopeField('viewMode', 'alltags');
  writeScopeField('currentFocus', "sidebar");
  machineryResetPage();
  writeScopeField('images', []);
  writeScopeField('isDetailMode', false);
  writeScopeField('selected', []);
  syncInspectorFromScope();
  if (!ignoreHistory) {
    w.UrlStateService.setState({ view: 'alltags', folder: null, smartfolder: null, tag: null, color: null });
  }

  machineryRebindRefresh();
  w.analytics.screenView('AllTags');
  $timeout(() => {
    useMiscRawState.getState().TagManager.renderTagsResult();
  }, 50);
}

export function machineryOpenNextGroup(): void {
  if (useMiscRawState.getState().tagViewMode === "ALL") {
    machineryOpenUnfiledGroup();
  }
  else if (useMiscRawState.getState().tagViewMode === "UNFILED") {
    machineryOpenStarredGroup();
  }
  else if (useMiscRawState.getState().tagViewMode === "STARRED") {
    if (useMiscRawState.getState().TagManager.groups[0]) {
      machineryOpenTagGroup(useMiscRawState.getState().TagManager.groups[0]);
    }
  }
  else if (useMiscRawState.getState().TagManager.groups.length > 0) {
    var $visibleGroups = qaVisible(".tag-manager-sidebar .group-item");
    var $currentGroup = q(".tag-manager-sidebar .group-item.active");
    var currentIndex = $currentGroup ? $visibleGroups.indexOf($currentGroup) : -1;
    var next = useMiscRawState.getState().TagManager.groups[currentIndex + 1];
    if (next) {
      machineryOpenTagGroup(next);
    }
  }
}

export function machineryOpenPrevGroup(): void {
  if (useMiscRawState.getState().tagViewMode === "ALL") {
    return;
  }
  else if (useMiscRawState.getState().tagViewMode === "UNFILED") {
    machineryOpenTagAllGroup();
  }
  else if (useMiscRawState.getState().tagViewMode === "STARRED") {
    machineryOpenUnfiledGroup();
  }
  else {
    var $visibleGroups = qaVisible(".tag-manager-sidebar .group-item");
    var $currentGroup = q(".tag-manager-sidebar .group-item.active");
    var currentIndex = $currentGroup ? $visibleGroups.indexOf($currentGroup) : -1;
    if (currentIndex === 0) {
      machineryOpenStarredGroup();
    }
    else if (currentIndex > 0) {
      var prev = useMiscRawState.getState().TagManager.groups[currentIndex - 1];
      if (prev) {
        machineryOpenTagGroup(prev);
      }
    }
  }
}

export function machineryOpenStarredGroup(): void {
  if (useMiscRawState.getState().tagViewMode === "STARRED") return;
  tagRectSelecting = false;
  writeScopeField('keyword', "");
  writeScopeField('tagViewMode', "STARRED");
  syncTagManagerFromScope();
  writeScopeField('tagViewModeName', "STARRED");
  syncTagManagerFromScope();
  writeScopeField('currentFocus', 'tags');
  writeScopeField('currentTagGroup', undefined);
  syncTagManagerFromScope();
  writeScopeField('selectedTags', {});
  syncTagManagerFromScope();
  useMiscRawState.getState().TagManager.renderTagsResult();
}

export function machineryOpenTagAllGroup(): void {
  if (useMiscRawState.getState().tagViewMode === "ALL") return;
  tagRectSelecting = false;
  writeScopeField('keyword', "");
  writeScopeField('tagViewMode', "ALL");
  syncTagManagerFromScope();
  writeScopeField('tagViewModeName', "ALL");
  syncTagManagerFromScope();
  writeScopeField('currentFocus', 'tags');
  writeScopeField('currentTagGroup', undefined);
  syncTagManagerFromScope();
  writeScopeField('selectedTags', {});
  syncTagManagerFromScope();
  useMiscRawState.getState().TagManager.renderTagsResult();
}

export function machineryOpenTagGroup(group: any): void {
  const w = window as any;
  tagRectSelecting = false;
  writeScopeField('keyword', "");
  writeScopeField('tagViewMode', "GROUP");
  syncTagManagerFromScope();
  writeScopeField('tagViewModeName', `GROUP-${group.id}`);
  syncTagManagerFromScope();
  writeScopeField('currentFocus', 'tags');
  writeScopeField('currentTagGroup', group);
  syncTagManagerFromScope();
  useMiscRawState.getState().TagManager.renderTagsResult();
  blurEl("input:focus");
  if (useMiscRawState.getState().currentTagGroup === group) return;
  writeScopeField('selectedTags', {});
  syncTagManagerFromScope();
}

export function machineryOpenUnfiledGroup(): void {
  if (useMiscRawState.getState().tagViewMode === "UNFILED") return;
  tagRectSelecting = false;
  writeScopeField('keyword', "");
  writeScopeField('tagViewMode', "UNFILED");
  syncTagManagerFromScope();
  writeScopeField('tagViewModeName', "UNFILED");
  syncTagManagerFromScope();
  writeScopeField('currentFocus', 'tags');
  writeScopeField('currentTagGroup', undefined);
  syncTagManagerFromScope();
  writeScopeField('selectedTags', {});
  syncTagManagerFromScope();
  useMiscRawState.getState().TagManager.renderTagsResult();
}

/* openUntagged（bundle 36805-36833 逐字：同 openUnfiled 模板，untagged 键） */
export function machineryOpenUntagged(ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (useBodyState.getState().viewMode === 'untagged' && useItemState.getState().allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (useBodyState.getState().isDetailMode) {
      machineryLeaveDetailMode();
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();
  writeScopeField('viewMode', 'untagged');
  writeScopeField('currentFocus', "sidebar");
  machineryResetPage();

  $timeout.cancel(openUntaggedTimeout);
  openUntaggedTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'untagged', folder: null, smartfolder: null, tag: null, color: null });
    }
    useLayoutState.getState().imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.untagged") || 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    useLayoutState.getState().imageSize.height = parseInt(useLayoutState.getState().imageSize.height);
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machinerySetLastFolder(undefined);
    machineryUpdateListHeight(useLayoutState.getState().imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    setScrollTop("#sidebar-item-container", 0);
    useMiscRawState.getState().reload();
    w.analytics.screenView('Untagged');
  }, 50);
}

export function machineryRefreshSubfolderList(): void {
  // 过滤子文件夹
  if (useFolderState.getState().currentFolder) {
    if (useListState.getState().showSubfolderContent) {
      writeScopeField('subFolders', machineryGetAllChildFolder(useFolderState.getState().currentFolder));
      syncListFromScope();
      if (useMiscRawState.getState().subFolderSortableOptions) useMiscRawState.getState().subFolderSortableOptions.disabled = true;
    }
    else {
      writeScopeField('subFolders', useFolderState.getState().currentFolder.children);
      syncListFromScope();
      if (useMiscRawState.getState().subFolderSortableOptions) useMiscRawState.getState().subFolderSortableOptions.disabled = false;
    }
    if (useListState.getState().keyword) {
      writeScopeField('subFolders', useMiscRawState.getState().subFolders.filter(function (folder: any) {
        if (folder.name.toLowerCase().indexOf(useListState.getState().keyword.toLowerCase()) > -1) {
          return true;
        }
        if (folder && folder.tags) {
          var folderTags = folder.tags.join("");
          if (folderTags.toLowerCase().indexOf(useListState.getState().keyword.toLowerCase()) > -1) {
            return true;
          }
        }
      }));
      syncListFromScope();
      if (useMiscRawState.getState().subFolderSortableOptions) useMiscRawState.getState().subFolderSortableOptions.disabled = true;
    }
  }
  else {
    writeScopeField('subFolders', []);
    syncListFromScope();
  }
}

export function machineryRemoveTagGroup(group: any): void {
  const w = window as any;

  const remove = function (group: any) {
    var idx = useMiscRawState.getState().TagManager.removeGroup(group.id);
    if (useMiscRawState.getState().TagManager.groups[idx]) {
      writeScopeField('currentTagGroup', useMiscRawState.getState().TagManager.groups[idx]);
      syncTagManagerFromScope();
    }
    else if (useMiscRawState.getState().TagManager.groups[idx - 1]) {
      writeScopeField('currentTagGroup', useMiscRawState.getState().TagManager.groups[idx - 1]);
      syncTagManagerFromScope();
    }
    else {
      machineryOpenTagAllGroup();
    }
  };

  if (group.tags.length > 0) {
    w.swal({
      html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${w.i18n.__("dialog.removeTagGroup.title")}</h4>
                            <p class="alert-desc">${w.i18n.__("dialog.removeTagGroup.desc")}</p>
                        </div>
                    `,
      showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
      width: 400,
      customClass: "alert-box",
      cancelButtonColor: "#777777",
      confirmButtonText: w.i18n.__('dialog.removeTagGroup.button'),
      cancelButtonText: w.i18n.__("general.cancel"),
    }).then(function () {
      remove(group);
    });
  }
  else {
    remove(group);
  }
}

/* renameTagGroup（bundle 48582-48592 逐字：双 100/200ms focus 双写原样） */
export function machineryRenameTagGroup(group: any): void {
  const w = window as any;
  writeScopeField('currentTagGroup', group);
  syncTagManagerFromScope();
  writeScopeField('newGroupName', group.name);
  syncTagManagerFromScope();
  group.editable = true;
  setTimeout(function () {
    focusEl("#group-input-" + group.id);
    selectEl("#group-input-" + group.id);
  }, 100);
  setTimeout(function () {
    focusEl("#group-input-" + group.id);
    selectEl("#group-input-" + group.id);
  }, 200);
}

export function machineryUpdateSubFolderWidth(): void {
  const w = window as any;
  const boxContainer = q("#box-container");
  if (!boxContainer) return;
  var containerWidth = boxContainer.clientWidth;
  var column = parseInt(containerWidth / useLayoutState.getState().imageSize.height as any);
  if (!column) column = 1;
  var result = parseInt((containerWidth - 38 - (column * 10)) / column as any);
  result = parseInt(result / 5 as any) * 5;
  if (result < 90) result = 90;
  if (result >= useMiscRawState.getState().MAX_LIST_WIDTH) {
    result = useMiscRawState.getState().MAX_LIST_WIDTH;
  }
  useLayoutState.getState().imageSize.subfolderWidth = result;
}

export let openUntaggedTimeout: any = null;

// ── b1-7a 域内自管（原 controller 闭包 var：tagRectSelecting，标签框选态）──
export let tagRectSelecting: any = false;
