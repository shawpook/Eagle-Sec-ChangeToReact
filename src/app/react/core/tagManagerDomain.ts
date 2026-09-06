/**
 * b1-9d：TagManager 域（bundle 47050-49176 逐字机械移植——$scope→s / $rootScope→s.$root /
 *   $timeout→getTimeout() / $→w.$ / path,fs,writeFileAtomic,electronLog,languageBCP,
 *   ayncsImagesChange,hiddenByCurrentFilter,swal,guid,analytics,i18n→w.* /
 *   calcuteContainTags→s.calcuteContainTags（scope 面）。
 *   @ts-nocheck 与 controllerFns.ts 同先例：bundle 原码宽松类型逐字保留。
 *   供给语义：bundle 在世时 s.TagManager 沿用其绑定；shim 世界由 applyDataMachineryScope
 *   调 machineryBuildTagManager(s) 挂 w.TagManager + s.TagManager。
 */
// @ts-nocheck
import { getBodyScope } from '../global/scopeBridge';
// b1-9k：bundle link 体内 $filter/$timeout 为 Angular 注入服务——本文件 1307/1319/1379/
// 1654/1670 的裸引用此前是死标识符（@ts-nocheck 掩盖；createTagGroup 首行即抛
// ReferenceError → group.editable 永不置真、群组命名输入框不渲染）。
// 与 controllerFns 的同名 shim 同款语义；ESM 循环引用双侧均为函数声明提升，运行时安全。
import { getFilter as machineryGetFilter, getTimeout as machineryGetTimeout } from './dataMachinery';
import { debounce } from '../utils/func';

const $filter: any = machineryGetFilter;
const getTimeout: any = machineryGetTimeout;

export function machineryBuildTagManager(s: any): any {
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

                let groups = (s.currentTagGroup)? [s.currentTagGroup] : s.TagManager.currentGroups || [];
                let tags = [];
                const tagsMap = {};

                switch (s.tagViewMode) {
                    case "ALL":
                        tags = s.TagManager.tagNames || [];
                        break;
                    case "UNFILED":
                        tags = s.TagManager.unfiledTags || [];
                        break;
                    case "STARRED":
                        tags = s.TagManager.starredTags;
                        groups = [{
                            id: "starred",
                            name: w.i18n.__("pages.allTags.sidebar.starred"),
                            tags: s.TagManager.starredTags
                        }];
                        break;
                    case "GROUP":
                        tags = s.currentTagGroup.tags || [];
                        break;
                }

                const keyword = s?.keyword?.toLowerCase();
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
                if (s.tagViewMode === "GROUP" || s.tagViewMode === "STARRED") {
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
                const containerWidth = w.$(".tag-manager-container").width();
                const n = (s.tagViewLayoutMode === "LIST")? 0 : Math.max(0, parseInt(((containerWidth - 32) / 200) as any) - 1);
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
            s.saveFolder();
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

			var selectedTags = w.eagle.inspector.calculateTags(s.selected);
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
				s.$evalAsync();
			}

            if (!TagManager.historyTags) TagManager.historyTags = [];
            if (s.availableHistoryTags.indexOf(tag) === -1) {
                s.availableHistoryTags.unshift(tag);
            }
        };

        TagManager.addTags = function addTags (tags) {
            if (!tags || tags.length === 0) return;
            if (s.selected.length === 0) return;

            let changedItems: any[] = [];

            tags.forEach(( tag: any) => {
                tag = tag.trim();
                tag = tag.substr(0, 1024);
                s.selected.forEach(function (item: any) {
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
            
            s.TagManager.isDirty = true;
            s.calcuteContainTags(s.filtereds);
            s.updateSelection();
            s.updateItemsView(s.selected);

            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            w.electronLog.info(`[app] Add ${tags.length} tags to ${changedItems.length} files`);
        };

        TagManager.addTag = function addTag (tag) {
            if (tag === undefined || tag === "" ) return;

            let changedItems: any[] = [];
            if (s.selected.length > 0) {
                var tag = tag.trim();
                tag = tag.substr(0, 1024);
                s.selected.forEach(function (image: any) {
                    var idx = image.tags.indexOf(tag);
                    if (idx === -1) {
                        image.tags.push(tag);
                        image.tags = [...new Set(image.tags)];
                        changedItems.push(image);
                    }
                });
            }
            s.tagsSuggestion.push({
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
            s.TagManager.isDirty = true;

            s.calcuteContainTags(s.filtereds);
            TagManager.addHistoryTag(tag);
            s.updateSelection();

            s.updateItemsView(s.selected);

            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            w.electronLog.info(`[app] Add tag [${tag}] to ${changedItems.length} files`);
            w.analytics.event('Tag', 'Create', tag);
        };

        TagManager.removeTag = function (tag: any) {

            let changedItems: any[] = [];
            if (s.selected.length > 0) {
                s.selected.forEach(function (image: any) {
                    var idx = image.tags.indexOf(tag);
                    if (idx > -1) {
                        image.tags.splice(idx, 1);
                        changedItems.push(image);
                        if (TagManager.tagMappings[tag] && TagManager.tagMappings[tag].imageCount) {
                            TagManager.tagMappings[tag].imageCount--;
                            if (TagManager.tagMappings[tag].imageCount === 0) {
                            	s.TagManager.isDirty = true;
                                delete TagManager.tagMappings[tag];
                                let historyIdx = TagManager.historyTags.indexOf(tag);
					           	if (historyIdx > -1) {
					           		TagManager.historyTags.splice(historyIdx, 1);
					           	}
                                if (s.tagsSuggestionResult) {
    					           	let suggestionIdx = s.tagsSuggestionResult.indexOf(tag);
    					           	if (suggestionIdx > -1) {
    					           		s.tagsSuggestionResult.splice(suggestionIdx, 1);
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

			s.calcuteContainTags(s.filtereds);
			s.updateSelection();
			s.updateItemsView(s.selected);

            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            w.$("#tag-search-input").focus();
            s.calculateImageBinding({ignoreSort : true}, () => {});
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
                s.availableHistoryTags = [];
                s.$evalAsync();
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
            return s.tags;
        };

        // 取得文件夹包含标签
        TagManager.getFolderTags = function (folderIds: any) {

            var result = [];

            folderIds.forEach(function (folderId: any) {
                var images = s.raw.filter(function (image: any) {
                    try {
                        if (image && image.folders) {
                            return image.folders && image.folders.indexOf(folderId) > -1;
                        }
                    }
                    catch (err: any) {}
                    return false;
                });
                var total = images.length;
                var folderTags = s.calcuteContainTags(images).containTags || [];
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

            var images = s.raw.filter(function (image: any) {
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
            var result = s.calcuteContainTags(images).containTags;
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
                var $active = w.$("#tags-popup .tag.active");
                if ($active.length == 0) {
                    w.$("#tags-popup .tag").first().addClass("active");
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

            for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
                var image = s.raw[rindex];
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
                        var folder = s.folderMappings[folderId];
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

                s.tagsSuggestion.push({
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

                s.tagsSuggestion.push({
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
            s.availableHistoryTags = TagManager.historyTags.filter(function (tag: any) {
                if (!TagManager.tagMappings[tag] || TagManager.tagMappings[tag].imageCount === 0) {
                    return false;
                }
                return true;
            });

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
                    s.calculateImageBinding({ ignoreSort: true });
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
            s.checkOperationSafety2(tags.length, function () {
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
                if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
                    s.removeSound.play();
                }
            }, 1);
        };

        TagManager.filterWithTags = function (tags: any, ignoreHistory: any) {
            s.viewMode = '';
            s.openAll(false, function () {
                getTimeout()(function () {
                    w.eagle.filter.isOpen = true;
                    w.eagle.filter.tagFilterLogic = "OR";
                    s.filterWithTags(tags);
                    // b1-9ba：Update_Tags_Filter 廣播全樹無接收者（原接收者隨 bundle 摘除
                    // 退役）——廣播體移除，filterWithTags 直呼語義不變。
                }, 200);
            });
        };

        s.TagManager = TagManager;

        // selectTag（bundle 38870-38926 逐字；b1-9k 补端口——TagManager.tsx 标签点击
        // onClick=call('selectTag')，缺席时静默 no-op → 标签选中/多选整条死）
        s.selectTag = function (event, tag) {
            event.stopPropagation();

            if (event.button !== 0 && s.selectedTags[tag.name]) return;

            s.$root.currentFocus = 'content';

            // Shift 多選
            if (event.shiftKey) {

                let selectedTags = [];
                let found = 0;

                TagManager.tagsResult.display.forEach((item, index) => {
                    if (item.type === "row") {
                        const tags = item.tags;
                        tags.forEach((tagName) => {
                            if (tagName === s.lastSelectedTag || tagName === tag.name) {
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
                    if (s.selectedTags[tagName]) return;
                    s.selectedTags[tagName] = true;
                });

                s.lastSelectedTag = tag.name;
                return;
            }

            if (event.metaKey || event.ctrlKey) {
                if (s.selectedTags[tag.name]) {
                    delete s.selectedTags[tag.name];
                }
                else {
                    s.selectedTags[tag.name] = true;
                }
                s.lastSelectedTag = tag.name;
            }
            else {
                s.selectedTags = {};
                s.selectedTags[tag.name] = true;
                s.lastSelectedTag = tag.name;
            }
        };

        s.createTagGroup = function () {
            var newGroup = TagManager.createGroup($filter('i18n')('general.untitled.tagGroup'));
            s.tagViewMode = "GROUP";
            s.tagViewModeName = `GROUP-${newGroup.id}`;
            s.currentTagGroup = newGroup;
            s.renameTagGroup(newGroup);
            s.selectedTags = {};
            TagManager.renderTagsResult();
        };

        s.openTagAllGroup = function () {
            if (s.tagViewMode === "ALL") return;
            tagRectSelecting = false;
            s.keyword = "";
            s.tagViewMode = "ALL";
            s.tagViewModeName = "ALL";
            s.$root.currentFocus = 'tags';
            s.currentTagGroup = undefined;
            s.selectedTags = {};
            TagManager.renderTagsResult();
        };

        s.openUnfiledGroup = function () {
            if (s.tagViewMode === "UNFILED") return;
            tagRectSelecting = false;
            s.keyword = "";
            s.tagViewMode = "UNFILED";
            s.tagViewModeName = "UNFILED";
            s.$root.currentFocus = 'tags';
            s.currentTagGroup = undefined;
            s.selectedTags = {};
            TagManager.renderTagsResult();
        };

        s.openStarredGroup = function () {
            if (s.tagViewMode === "STARRED") return;
            tagRectSelecting = false;
            s.keyword = "";
            s.tagViewMode = "STARRED";
            s.tagViewModeName = "STARRED";
            s.$root.currentFocus = 'tags';
            s.currentTagGroup = undefined;
            s.selectedTags = {};
            TagManager.renderTagsResult();
        };

        s.openTagGroup = function (group: any) {
            tagRectSelecting = false;
            s.keyword = "";
            s.tagViewMode = "GROUP";
            s.tagViewModeName = `GROUP-${group.id}`;
            s.$root.currentFocus = 'tags';
            s.currentTagGroup = group;
            TagManager.renderTagsResult();
            w.$("input:focus").blur();
            if (s.currentTagGroup === group) return;
            s.selectedTags = {};
        };

        
        s.addStarredTags = () => {
            getTimeout()(() => {
                const originSelected = s.TagManager.starredTags.reduce((acc, cur: any) => {
                    acc[cur] = true;
                    return acc;
                }, {});

                GeneralTagSelectPanel.open({
                    tagManager: s.TagManager,
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
                        s.TagManager.addStarredTags(add);

                        let remove = [];
                        if (Object.keys(deselectedTags).length > 0) {
                            Object.keys(deselectedTags).forEach(( tag: any) => {
                                remove.push(tag);
                            });
                        }
                        s.TagManager.removeStarredTags(remove);
                        s.calculateImageBinding({ ignoreSort: true }, () => {});
                    }
                });
            }, 50);
        };

        s.addGroupTags = ( group: any) => {
            getTimeout()(() => {
                const originSelected = group.tags.reduce((acc, cur: any) => {
                    acc[cur] = true;
                    return acc;
                }, {});

                GeneralTagSelectPanel.open({
                    tagManager: s.TagManager,
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
                        s.TagManager.addTagsToGroup(group.id, add, true);

                        let remove = [];
                        if (Object.keys(deselectedTags).length > 0) {
                            Object.keys(deselectedTags).forEach(( tag: any) => {
                                remove.push(tag);
                            });
                        }
                        s.TagManager.removeTagsFromGroup(group.id, remove);
                        s.calculateImageBinding({ ignoreSort: true }, () => {});
                    }
                });
            }, 50);
        };

        s.openTagGroupContextMenu = (event, tagGroup: any) => {

            let historyLibraryMenu = {};
            historyLibraryMenu.items = $bodyScope.getLibraryHistory().filter(( history: any) => {
                var isCurrent = false;
                if ($bodyScope.libraryPath) {
                    isCurrent = w.path.normalize(history.path) == w.path.normalize($bodyScope.libraryPath);
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
                            s.$root.$broadcast("ADD_TO_LIBRARY", {
                                tagGroup, tagGroup,
                                items: [],
                                library: history
                            });

                            s.$evalAsync();
                        }
                    }
                }
            });
            const $target = w.$(".tag-manager-sidebar .sidebar-item").has(event.target);
            ContextMenu.open({
                items: [
                    // 搜尋
                    {
                        label: w.i18n.__('context.tagGroup.filterWithTags'),
                        keywords: '搜尋 篩選 標籤 Search Filter Tag 検索フィルタータグ',
                        icon: 'ic-tag-filter.svg',
                        click: () => {
                            TagManager.filterWithTags(tagGroup.tags, false);
                            s.$evalAsync();
                        }
                    },
                    { role: 'separator' },
                    // 重命名
                    {
                        label: w.i18n.__('context.tagGroup.rename'),
                        keywords: '重命名 rename 名前を変更する tag group',
                        icon: 'ic-rename.svg',
                        accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${process.platform}`],
                        click: () => {
                            s.renameTagGroup(tagGroup);
                            s.$evalAsync();
                        }
                    },
                    // 刪除群組
                    {
                        label: w.i18n.__('context.tagGroup.remove'),
                        keywords: '刪除 移除 delete remove tag group',
                        icon: 'ic-tag-remove.svg',
                        accelerator: (process.platform === 'win32')? 'Del' : '⌘+⌫',
                        click: () => {
                            s.removeTagGroup(tagGroup);
                            s.$evalAsync();
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
                            s.changeTagGroupColor(event, tagGroup, color);
                            s.$evalAsync();
                        }
                    }
                ],
                onOpened: () => {
                    $target.addClass("context-activate");
                },
                onClosed: () => {
                    $target.removeClass("context-activate");
                },
                showSearch: true
            });
        };        

        s.renameTagGroup = function (group: any) {
            s.currentTagGroup = group;
            s.newGroupName = group.name;
            group.editable = true;
            setTimeout(function() {
                w.$("#group-input-" + group.id).focus().select();
            }, 100);
            setTimeout(function() {
                w.$("#group-input-" + group.id).focus().select();
            }, 200);
        };

        s.changeTagGroupColor = function (event: any, tagGroup: any, color: any) {
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
        };

        s.removeTagGroup = function (group: any) {

            const remove = function (group: any) {
                var idx = TagManager.removeGroup(group.id);
                if (TagManager.groups[idx]) {
                    s.currentTagGroup = TagManager.groups[idx];
                }
                else if (TagManager.groups[idx - 1]) {
                    s.currentTagGroup = TagManager.groups[idx - 1];
                }
                else {
                    s.openTagAllGroup();
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
                    s.$evalAsync();
                });
            }
            else {
                remove(group);
                s.$evalAsync();
            }
        };

        s.renameTagGroupBlur = function (group: any, newName: any) {
            if (newName) {
                TagManager.renameGroup(group.id, newName);
                delete group.editable;
            }
        };

        s.renameTagGroupKeyup = function (event: any, group: any, newName: any) {
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
        };

        // 標籤群組描述變更（使用防抖保存）
        var tagGroupDescriptionChangeTimeout;
        var tagGroupDescriptionOriginal; // 記錄 focus 時的原始值

        s.tagGroupDescriptionChange = function () {
            if (!s.currentTagGroup) return;

            getTimeout().cancel(tagGroupDescriptionChangeTimeout);
            tagGroupDescriptionChangeTimeout = getTimeout()(function () {
                TagManager.saveGroup();
            }, 1000);
        };

        // 標籤群組描述聚焦事件 - 記錄原始值
        s.tagGroupDescriptionFocus = function () {
            if (!s.currentTagGroup) return;
            tagGroupDescriptionOriginal = s.currentTagGroup.description || '';
        };

        // 標籤群組描述失焦事件 - 只在值改變時才保存
        s.tagGroupDescriptionBlur = function () {
            if (!s.currentTagGroup) return;

            getTimeout().cancel(tagGroupDescriptionChangeTimeout);

            // 使用 getTimeout() 確保在 contenteditable directive 更新 model 之後再比較
            getTimeout()(function () {
                if (!s.currentTagGroup) return;

                var currentValue = s.currentTagGroup.description || '';
                if (currentValue === tagGroupDescriptionOriginal) {
                    // 值沒有改變，不需要保存
                    return;
                }

                TagManager.saveGroup();

                try {
                    w.electronLog && w.electronLog.info(`[app] Change tag group description: ${s.currentTagGroup.name}(${s.currentTagGroup.id})`);
                } catch (err: any) {};
            }, 0);
        };

        ipcRenderer.on('jieba-extract-done', function (e: any, result: any) {

            // console.timeEnd("======== 取得推荐标签 ========");

            var selectedTags = w.eagle.inspector.calculateTags(s.selected);

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
            s.$evalAsync();
        });

        // GIF Viewer
        s.gifPlayer;
        s.gifUpadteInterval;

        s.gifViewer = {
            frames: [],
            mousedownTime: 0,
            mousedownX: 0,
            mousedownY: 0,
            range: undefined,
            speed: 1,
            setThumbnail: function () {
                if (!s.isGifReady) return;
                var curr = s.gifPlayer.get_current_frame();
                var f = s.gifPlayer.get_frame(curr);
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
                        gif: s.current,
                        base64string: base64string
                    });
                };
                image.src = f.base64;
            },
            setSpeed: function (speed: any = 1) {
                if (!s.gifPlayer) return;
                s.gifViewer.speed = speed;
                s.$evalAsync();
                s.gifPlayer.set_speed(speed);
                w.$(".gif-toolbar-btn.speed span").text(`${speed}x`);
            },
            mousedown: function (event: any) {
                if (event.button !== 0) return;
                s.gifViewer.mousedownX = event.clientX;
                s.gifViewer.mousedownY = event.clientY;
                s.gifViewer.mousedownTime = Date.now();
            },
            mouseup: function (event: any) {
                if (event.button !== 0) return;
                // 判断是点击或是拖拽
                if (Date.now() - s.gifViewer.mousedownTime < 333 && Math.abs(s.gifViewer.mousedownX - event.clientX) < 5 && Math.abs(s.gifViewer.mousedownY - event.clientY) < 5)  {
                    s.toggleGifPlay();
                    s.$evalAsync();
                }
            },
            cancelRange: function () {
                if (s.gifViewer.range !== undefined) {
                    s.gifViewer.range = undefined;
                    var $resizableBar = w.$(".gif-toolbar .resize-bar");
                    $resizableBar.css({
                        left: "0%",
                        width: "100%"
                    });
                    if (s.gifPlayer) {
                        s.gifPlayer.move_to(0);
                    }
                }
            },
            nextFrame: function () {
                var curr = s.gifPlayer.get_current_frame();
                var index = curr + 1;
                if (index + 1 > s.gifViewer.frames.length - 1) index = s.gifViewer.frames.length - 1;
                s.gifViewer.setFrame(index);
                s.gifPlayer.pause();
            },
            prevFrame: function () {
                var curr = s.gifPlayer.get_current_frame();
                var index = curr - 1;
                if (index - 1 < 0) index = 0;
                s.gifViewer.setFrame(index);
                s.gifPlayer.pause();
            },
            setFrame: function (index: any) {
                s.gifPlayer.move_to(index);
            },
            onProgress: function (progress: any, length: any) {
                clearInterval(s.gifUpadteInterval);
                if (s.isGifReady === true) {
                    s.isGifReady = false;
                    delete s.gifViewer.frames;
                    s.gifViewer.frames = [];
                    s.gifViewer.mousedownTime = 0;
                    s.gifViewer.mousedownX = 0;
                    s.gifViewer.mousedownY = 0;
                    s.gifViewer.range = undefined;
                    s.gifPlayer = undefined;
                    s.$evalAsync();
                }
                updateGifProgressbar(progress);
                w.$(".gif-toolbar .message span").text(`${parseInt((progress * 100) as any)}%`)
            },
            onFinished: function (result: any) {
                s.gifViewer.range = undefined;
                s.gifPlayer = result.gifPlayer;
                s.isGifReady = true;
                s.gifViewer.frames = result.frames;
                s.gifViewer.playing = result.playing;
                s.gifViewer.setSpeed(1);
                s.$evalAsync();
                var $resizableBar = w.$(".gif-toolbar .resize-bar");
                w.$(".gif-toolbar .total-frame").text(`/ ${s.gifViewer.frames.length}`);

                if ($resizableBar.is('.ui-resizable')) {
                    $resizableBar.resizable( "destroy" );
                }

                $resizableBar.css({
                    left: 0,
                    width: 'auto'
                });

                w.$(".gif-toolbar.in").removeClass("in");
                setTimeout(function () {
                    w.$(".gif-toolbar").addClass("in");
                }, 100);

                var gifPlayerResizeOriginalState = false;
                var gifPlayerResizing = false;
                var gifPlayerLastResizeLeft;
                var gifPlayerLastResizeWidth;
                var gifPlayerToolbarOffset;
                $resizableBar.resizable({
                	minWidth: 2,
                    handles: "e, w",
                    containment: ".gif-toolbar .progress-bar",
                    start: function (event: any, ui: any) {
                        gifPlayerLastResizeLeft = parseInt((ui.element.css("left")) as any);
                        gifPlayerLastResizeWidth = ui.element.width();
                        gifPlayerResizeOriginalState = s.gifPlayer.get_playing();
                        s.gifPlayer.pause();
                        gifPlayerToolbarOffset = w.$(".gif-toolbar .progress-bar").offset().left;
                    },
                    resize: function (event: any, ui: any) {
                        w.$("#gif-progress-indicator").hide();
                        gifPlayerResizing = true;

                        var currentPosX = event.pageX - gifPlayerToolbarOffset;
                        var width = w.$(".gif-toolbar .progress-bar").width();
                        var index = Math.round(currentPosX / width * s.gifViewer.frames.length) + 1;
                        // if (!index) return;
                        if (index -1  >= s.gifViewer.frames.length) index = s.gifViewer.frames.length;
                        if (!gifPlayerProgressDown) {
                            var img = w.$("#thumbnail-preview img")[0];
                            var f = s.gifPlayer.get_frame(index - 1);
                            if (!f) return;
                            img.src = f.base64;

                            var w = w.$("#thumbnail-preview img").width();
                            var left = currentPosX - w / 2;
                            if (left < 0) left = 0;
                            if (left > width - w) left = width - w;

                            w.$("#thumbnail-preview").css({
                                transform: `translateX(${left}px)`
                            });

                            w.$("#thumbnail-preview .current-index").text(`${index}`);
                            w.$("#thumbnail-preview").show();
                        }
                        else {
                            w.$(".gif-toolbar .progress-bar .ui-resizable-handle").css("pointer-events", "none");
                            w.$("#gif-progress-indicator").css('left', `${ (index - 1) / (s.gifViewer.frames.length - 1) * 100 }%`);
                            s.gifPlayer.move_to(index - 1);
                            s.gifPlayer.pause();
                        }

                    },
                    stop: function (event: any, ui: any) {
                        gifPlayerResizing = false;
                        var frames = s.gifViewer.frames;
                        var parentWidth = w.$(".gif-toolbar .progress-bar").width();
                        var left = parseInt((ui.element.css("left")) as any);
                        var width = ui.element.width();
                        var leftP = left / parentWidth * 100;
                        var widthP = width / parentWidth * 100;;
                        $resizableBar.css({
                            left: `${leftP}%`,
                            width: `${widthP}%`
                        });

                        // 移動 start
                        // var index = parseInt((w.$(".gif-toolbar .current-frame").text()) as any) - 1;
                        var index = s.gifPlayer.get_current_frame();
                        if (index < 0) index = 0;
                        if (gifPlayerLastResizeLeft !== left) {
                            if (s.gifViewer.range === undefined) {
                                s.gifViewer.range = [index, s.gifViewer.frames.length];
                            }
                            else {
                                s.gifViewer.range = [index, s.gifViewer.range[1]];
                            }
                        }
                        // 移動 end
                        else if (gifPlayerLastResizeWidth !== width) {
                            if (s.gifViewer.range === undefined) {
                                s.gifViewer.range = [0, index + 1];
                            }
                            else {
                                s.gifViewer.range = [s.gifViewer.range[0], index + 1];
                            }
                        }

                        if (s.gifViewer.range && s.gifViewer.range[0] > s.gifViewer.range[1]) {
                            s.gifViewer.range = [s.gifViewer.range[1], s.gifViewer.range[0]];
                        }
                        console.log(s.gifViewer.range);

                        w.$("#gif-progress-indicator").show();
                        if (!w.$(".gif-toolbar-btn.play-btn").is(":visible")) {
                            s.gifPlayer.play();
                        }

                        gifPlayerProgressDown = false;
                        w.$(".gif-toolbar .progress-bar .ui-resizable-handle").css("pointer-events", "");
                        // w.$(".gif-toolbar").trigger("mouseup");
                    }
                });


                s.gifUpadteInterval = setInterval(function () {
                    try {
                        var c = s.gifPlayer.get_current_frame();
                        var length = s.gifPlayer.get_length();

                        if (s.gifViewer.range && !gifPlayerResizing && !gifPlayerProgressDown) {
                            var start = s.gifViewer.range[0];
                            var end = s.gifViewer.range[1];
                            if (c <= start) { 
                                c = start; 
                                s.gifPlayer.move_to(c);
                            }
                            if (c >= end) { 
                                c = start; 
                                s.gifPlayer.move_to(c);
                            }
                        }

                        var text = paddingNumber(c + 1, `${length}`.length);
                        if (w.$(".gif-toolbar .current-frame").text() !== text) {
                            w.$(".gif-toolbar .current-frame").text(text);
                        }
                        updateGifIndicator(c + 1);
                    }
                    catch (err: any) {}
                }, 50);
            }
        };

        var updateGifIndicator = function (index: any) {
            var percent = (index - 1) / (s.gifViewer.frames.length - 1) * 100;
            if (percent < 0) percent = 0;
            var value = `${ percent }%`;
            if (w.$("#gif-progress-indicator").css('left') !== value) {
                w.$("#gif-progress-indicator").css('left', value);
            }
        };
        
        var updateGifProgressbar = function (progress: any) {
            w.$(".gif-toolbar .progress-bar .current").css('width', `${ progress * 100 }%`);
        };

        var gifPlayerProgressDown = false;
        var gifPlayerOriginalState = false;
        w.$("body").on('mousedown', ".gif-toolbar .progress-bar", function (event: any) {
        	var self = this;
            if (event.button === 0 && s.gifPlayer) {
                gifPlayerProgressDown = true;
                gifPlayerOriginalState = s.gifPlayer.get_playing();
                w.$("#thumbnail-preview").hide();

                if (s.isGifReady) {
                    var width = w.$(this).width();
                    var currentPosX = event.offsetX;
                    var index = Math.round(currentPosX / width * s.gifViewer.frames.length) + 1;
                    if (!index) return;
                    if (index -1  >= s.gifViewer.frames.length) index = s.gifViewer.frames.length;
                    if (s.gifViewer.range !== undefined) {
                        if (index -1 > s.gifViewer.range[1] || index -1 < s.gifViewer.range[0]) {
                            return;
                        }
                    }
                    w.$("#gif-progress-indicator").css('left', `${ (index - 1) / (s.gifViewer.frames.length - 1) * 100 }%`);
                    s.gifPlayer.move_to(index - 1);
                    s.gifPlayer.pause();

                    var startX = event.pageX;
	            	w.$("body").off("mousemove.gif").on("mousemove.gif", function (event: any) {
	            		var offsetX = event.pageX - startX;
	            		var x = currentPosX + offsetX;
	            		var width = w.$(self).width();
	                    var index = Math.round(x / width * s.gifViewer.frames.length) + 1;
	                    if (index -1  >= s.gifViewer.frames.length) index = s.gifViewer.frames.length;
	                    if (index < 1) index = 1;
	            		w.$(".gif-toolbar .progress-bar .ui-resizable-handle").css("pointer-events", "none");
		                w.$("#gif-progress-indicator").css('left', `${ (index - 1) / (s.gifViewer.frames.length - 1) * 100 }%`);
		                s.gifPlayer.move_to(index - 1);
		                s.gifPlayer.pause();
	            	});

	            	w.$("body").off("mouseup.gif").on("mouseup.gif", function (event: any) {
            			if (event.button === 0) {
            				event.stopPropagation();
			                gifPlayerProgressDown = false;
			                if (gifPlayerOriginalState && s.gifPlayer) {
			                    s.gifPlayer.play();
			                }
			            }
			            w.$(".gif-toolbar .progress-bar .ui-resizable-handle").css("pointer-events", "");
            			w.$("body").off("mousemove.gif");
            			w.$("body").off("mouseup.gif");
            		});
                }
            }
        });

        w.$("body").on('mouseup', ".gif-toolbar", function (event: any) {
            if (event.button === 0) {
            }
            else if (event.button === 2) {
            	s.gifPlayer.pause();
                s.openGifContextMenu(event);
            }
        });

        w.$("body").on('mouseleave', ".gif-toolbar .progress-bar", function (event: any) {
            if (!gifPlayerProgressDown) {
                w.$("#thumbnail-preview").hide();
            }
        });

        w.$("body").on('mousemove', ".gif-toolbar .progress-bar .ui-resizable-handle", function (event: any) {
            event.stopPropagation();
        });

        w.$("body").on('mousewheel', ".gif-toolbar .progress-bar", function (e: any) {
        	s.gifPlayer.pause();
        	var ne = e.originalEvent.wheelDelta / Math.abs(e.originalEvent.wheelDelta) || 1;
        	console.log(ne);
        	if (ne > 0) {
        		s.gifViewer.nextFrame();
        	}
        	else {
        		s.gifViewer.prevFrame();
        	}
        });

        w.$("body").on('mousemove', ".gif-toolbar .progress-bar", function (event: any) {
            if (event.button === 0) {
                var currentPosX = event.offsetX;

                // 显示缩略图
                if (s.isGifReady) {
                    var width = w.$(this).width();
                    var index = Math.round(currentPosX / width * s.gifViewer.frames.length) + 1;
                    // if (!index) return;
                    if (index -1  >= s.gifViewer.frames.length) index = s.gifViewer.frames.length;
                    if (!gifPlayerProgressDown) {
                        var img = w.$("#thumbnail-preview img")[0];
                        var f = s.gifPlayer.get_frame(index - 1);
                        if (!f) return;
                        img.src = f.base64;

                        var w = w.$("#thumbnail-preview img").width();
                        var left = currentPosX - w / 2;
                        if (left < 0) left = 0;
                        if (left > width - w) left = width - w;

                        w.$("#thumbnail-preview").css({
                            transform: `translateX(${left}px)`
                        });

                        w.$("#thumbnail-preview .current-index").text(`${index}`);
                        w.$("#thumbnail-preview").show();
                    }
                }
            }
        });
    
        // 動態建立 mousetrap 綁定
  return TagManager;
}

