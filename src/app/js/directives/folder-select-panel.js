class FolderSelectPanel extends SelectPanel {
    
    originalParams
    searchKeyword
    rawData
    onChanged
    collapsedFolderIds = {}

    static open(params) {
        const $rootScope = angular.element("html").scope();
        $rootScope.$broadcast('FOLDER.SELECT.PANEL.OPEN', params);
    }

    constructor(params) {
        super(params);
        this.collapsedFolderIds = {};
    }

    init (params) {
        this.originalParams = params;
        super.init(params);
        this.reset();
        this.initRawData(params);
        this.updateItemList();
        this.onChanged = params.onChanged || (() => {});
    }

    reset () {
        super.reset();
        if (localStorage['eagle.folderSelectPanel.collapsedFolderIds']) {
            try {
                this.collapsedFolderIds = JSON.parse(localStorage['eagle.folderSelectPanel.collapsedFolderIds']);
            }
            catch (e) {
                this.collapsedFolderIds = {};
            }
        }
        this.listData.selectedIds = {};
        this.listData.currentTab = 'ALL';  // 'ALL' or 'RECENT' or 'SELECTED'
        this.rawData = {
            folders: [],
            selectedIds: {},
            recentFolderIds: {},
            folderList: [],
            foldersMap: {},
            foldersDepthMap: {},
        };
    }
    
    // 初始化資料
    initRawData(params) {

        let guidelinesMap = {};

        // 計算資料夾的深度、建立資料夾的 Map、List、DepthMap
        this.rawData = {
            folders: params.folders || [],
            selectedIds: params.selectedIds || {},
            recentFolderIds: {},
            folderList: [],
            foldersMap: {},
            folderItemsMap: {},
            foldersDepthMap: {}
        };

        let recentFolderIdx = 0;
        const recentFolderIds = $bodyScope.getRecentFolders().reduce((acc, cur) => {
            acc[cur.id] = recentFolderIdx++;
            return acc;
        }, {});
        this.rawData.recentFolderIds = recentFolderIds;


        this.listData.maxDepth = 0;
        eagle.utils.tree.walk(this.rawData.folders, 'children', (folder, parent, depth) => {

            const { id, name, icon, iconColor, pinyin } = folder;

            this.rawData.folderList.push(folder);
            this.rawData.foldersMap[id] = folder;
            this.rawData.foldersDepthMap[id] = depth;

            // 計算 guidelines 顏色及數量
            let guidelines = [];
            if (parent && guidelinesMap[parent.id]) {
                const parentGuidelines = guidelinesMap[parent.id];
                guidelines = [...parentGuidelines, folder.iconColor || 'normal'];
            }
            else {
                guidelines = [folder.iconColor || 'normal'];
            }

            guidelinesMap[folder.id] = guidelines;

            const hasChildren = folder.children && folder.children.length > 0;

            const item = {
                type: 'folder',
                id: id,
                name: name,
                pinyin: pinyin,
                path: this.getFolderParentPath(folder),
                icon: icon,
                iconColor: iconColor,
                depth: this.rawData.foldersDepthMap[id],
                size: 26,
                parent: parent?.id,
                parentItem: this.rawData.folderItemsMap[parent?.id],
                guidelines: guidelines,
                hasChildren: hasChildren
            };

            this.rawData.folderItemsMap[id] = item;

            if (this.listData.maxDepth < depth) {
                this.listData.maxDepth = depth;
            }
        });

        // 設定預設已選擇的資料夾
        this.listData.selectedIds = { ...this.rawData.selectedIds };
    }

    // 建立 View Model 使用的資料，並更新畫面 
    updateItemList (keepIndex = false) {
        if (!keepIndex) {
            this.listData.currentIndex = -1;
        }
        this.listData.items = [];
        
        const searchKeyword = this.listData.searchKeyword;
        const folderList = this.rawData.folderList;
        let showCreateFolderBtn = (searchKeyword !== "");
        let folders = [];           // 全部資料夾
        let recentFolders = [];     // 最近使用的資料夾
        let recentFoldersCount = 5;

        folderList.forEach((folder) => {
            const { id, name } = folder;
            const item = this.rawData.folderItemsMap[id];
            const newItem = { ...item };
            const isSelected = this.listData.selectedIds[id];

            if (isSelected) {
                recentFoldersCount++;
            }
            
            if (this.rawData.recentFolderIds[id] >= 0 || isSelected) {
                const recentItem = { ...item };
                recentItem.depth = 0;
                recentItem.isRecent = true;
                recentFolders.push(recentItem);
            }

            if (searchKeyword) {
                folders.push(newItem);
            }
            else if (this.isVisible(newItem)) {
                folders.push(newItem);
            }

            if (name === searchKeyword) {
                showCreateFolderBtn = false;
            }
        });

        // 排序最近使用的資料夾
        recentFolders = recentFolders.sort((a, b) => {
            const aIdx = this.rawData.recentFolderIds[a.id];
            const bIdx = this.rawData.recentFolderIds[b.id];
            if (aIdx < bIdx) return -1;
            if (aIdx > bIdx) return 1;
            return 0;
        });

        recentFolders = recentFolders.sort((a, b) => {
            if (this.rawData.selectedIds[a.id] && !this.rawData.selectedIds[b.id]) return -1;
            if (!this.rawData.selectedIds[a.id] && this.rawData.selectedIds[b.id]) return 1;
            return 0;
        });

        // 已選的資料夾排在前面
        recentFolders = recentFolders.sort((a, b) => {
            if (this.listData.selectedIds[a.id] && !this.listData.selectedIds[b.id]) return -1;
            if (!this.listData.selectedIds[a.id] && this.listData.selectedIds[b.id]) return 1;
            return 0;
        });

        // 全部
        if (this.listData.currentTab === 'ALL') {
            let filteredRecentFolders = this.filterByKeyword(recentFolders);
			filteredRecentFolders = filteredRecentFolders.slice(0, recentFoldersCount);
			folders = this.filterByKeyword(folders);

			// 如果是搜尋狀態，將資料夾中有出現在最近使用的資料夾隱藏不顯示
			if (searchKeyword !== "") {
				folders = folders.filter((folder) => {
					return !filteredRecentFolders.find((recentFolder) => recentFolder.id === folder.id);
				});
			}

			// 顯示最近使用的資料夾
			if (filteredRecentFolders.length > 0) {
				if (folders.length > 0) {
					this.listData.items = [...filteredRecentFolders, { type: "separator", size: 5 }, ...folders];
				} else {
					this.listData.items = [...filteredRecentFolders];
				}
			}
			// 沒有最近使用資料夾，只顯示全部資料夾
			// 如果總資料夾數量小於 10，就不顯示最近使用資料夾
			else {
				this.listData.items = [...folders];
			}
        }
        // 最近使用
        else if (this.listData.currentTab === 'RECENT') {
            recentFolders = this.filterByKeyword(recentFolders);
            this.listData.items = [...recentFolders.slice(0, 20)];
        }
        // 已選擇
        else if (this.listData.currentTab === 'SELECTED') {
            folders = folders.filter((folder) => {
                return this.listData.selectedIds[folder.id];
            });
            this.listData.items = [...folders];
        }

        // 顯示建立資料夾按鈕
        if (showCreateFolderBtn) {
            if (this.listData.items.length > 0) {
                this.listData.items = [...this.listData.items, { type: 'separator', size: 5 }, { type: 'create', size: 26, 'name': searchKeyword }];
            }
            else {
                this.listData.items = [{ type: 'create', size: 26, 'name': searchKeyword }];
            }
        }

        // 更新 index
        this.listData.items.forEach((item, index) => {
            item.index = index;
        });
        
        if (!keepIndex) {
            // 搜尋結果有內容時，自動選擇第一個項目
            if (searchKeyword !== "" && this.listData.items.length > 0) {
                this.listData.currentIndex = 0;
            }
            // 如果不是搜尋狀態，就不自動選擇第一個項目
            else {
                this.listData.currentIndex = -1;
            }
        }
    }

    isVisible (item) {
        // 判斷是否所有父層都是展開的
        const parentId = item.parent;
        if (parentId) {
            const parentItem = this.rawData.folderItemsMap[parentId];
            if (!parentItem) return false;
            if (this.collapsedFolderIds[parentId]) return false;
            return this.isVisible(parentItem);
        }
        return true;
    }

    filterByKeyword (list) {
        if (this.listData.searchKeyword.length === 0) return list;

        const keyword_cn = chineseConvert.tw2cn(this.listData.searchKeyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();
        const temp = list.map(item => {
            const nameCN = chineseConvert.tw2cn(item.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (item.name.length >= 30) {
                return {
                    item: item,
                    name: nameCN,
                    search: [nameCN]
                }
            }
            return {
                item: item,
                name: nameCN,
                search: [nameCN, ..._.uniq(
                    cartesianProduct(pinyinlite(nameCN, { keepUnrecognized : true }).filter(p => p.length > 0))
                    .map(item => item.join(' '))
                )],
            };
        });

        let scores = temp.map(item => {
            const itemName = `${item.name ?? ''} ${item.keywords ?? ''}`;
            return {
                item: item,
                name: itemName,
                score: _.max(item.search.map(pinyin => pinyin.score(keyword_cn))),
            };
        });

        list = scores.filter(i => i.score > 0).sort((a, b) => b.score - a.score).map(function (i) {
            return i.item.item;
        });

        // sort start with keyword first
        const result = list.reduce((acc, cur) => {
            if (cur.name.toLowerCase().startsWith(this.listData.searchKeyword.toLowerCase())) {
                acc.startWithKeyword.push(cur);
            }
            else {
                acc.notStartWithKeyword.push(cur);
            }
            return acc;
        }, {
            startWithKeyword: [],
            notStartWithKeyword: [],
        });
        
        list = [...result.startWithKeyword, ...result.notStartWithKeyword];
       
        return list;
    }

    // 取得回傳結果
    getCallbackResult () {
        const isEqual = (a, b) => {
            const aEntries = Object.entries(a);
            const bEntries = Object.entries(b);
            return aEntries.length === bEntries.length && aEntries.every(([key, value]) => b[key] === value);
        };

        const isDirty = !isEqual(this.rawData.selectedIds, this.listData.selectedIds);
        const selectedFolderIds = { ...this.listData.selectedIds };
        const deselectedFolderIds = Object.entries(this.rawData.selectedIds).reduce((result, [folderId, isSelected]) => {
            if (!this.listData.selectedIds[folderId]) {
                result[folderId] = true;
            }
            return result;
        }, {});

        return { isDirty, selectedFolderIds, deselectedFolderIds };
    }

    getFolderParentPath (folder) {
        const parentFolder = this.rawData.foldersMap[folder.parent];
        const grandParentFolder = this.rawData.foldersMap[parentFolder?.parent];
        const greatGrandParentFolder = this.rawData.foldersMap[grandParentFolder?.parent];
        const parentFolderName = parentFolder?.name;
        const grandParentFolderName = grandParentFolder?.name;
        const greatGrandParentFolderName = greatGrandParentFolder?.name;
        let result = "";
        if (greatGrandParentFolderName && grandParentFolderName && parentFolderName) {
            result = `../<span>${grandParentFolderName}</span>/<span>${parentFolderName}</span>`;
        }
        else if (!greatGrandParentFolderName && grandParentFolderName && parentFolderName) {
            result = `<span>${grandParentFolderName}</span>/<span>${parentFolderName}</span>`;
        }
        else if (!greatGrandParentFolderName && !grandParentFolderName && parentFolderName) {
            result = `${parentFolderName}`;
        }
        return result;
    }

    close () {
        const result = this.getCallbackResult();
        if (result.isDirty) this.onChanged(result);
        super.close();
        this.reset();
    }

    onTabKey () {
        if (this.listData.currentTab === 'ALL') {
            this.listData.currentTab = 'RECENT';
        }
        else if (this.listData.currentTab === 'RECENT') {
            this.listData.currentTab = 'SELECTED';
        }
        else if (this.listData.currentTab === 'SELECTED') {
            this.listData.currentTab = 'ALL';
        }
        this.updateItemList();
    }

    openItem (event, item) {
        if (item.type === 'create') {
            this.createFolder(this.listData.searchKeyword.trim(), (folderName) => {
                $bodyScope.createFolder({
                    name: folderName.trim(),
                    position: "top",
                    callback: (folder) => {
                        this.onCreatedFolder(folder);
                    }
                })
            });
        }
        else {
            const pressCtrlOrCmd = event?.ctrlKey || event?.metaKey;
            const itemId = item.id;
            const selectedIds = this.listData.selectedIds;
            (!selectedIds[itemId])? selectedIds[itemId] = true : delete selectedIds[itemId];
            if (this.listData.searchKeyword !== "" && !pressCtrlOrCmd) {
                this.listData.searchKeyword = "";
                this.clearSearchInput();
                this.updateItemList();
            }
        }
    }

    openItemSubmenu (item) {
        if (item.isRecent) {
            ContextMenu.open({
                items: [
                    {
                        label: i18n.__('selectFolderPanel.context.removeHistory'),
                        click: () => {
                            $bodyScope.removeRecentFolder(item.id, () => {
                                const selectedIds = { ...this.listData.selectedIds };
                                this.reset();
                                this.init(this.originalParams);
                                this.listData.selectedIds = selectedIds;
                                this.updateItemList();
                            });
                        }
                    }
                ],
                onClosed: () => {
                    this.focusSearchInput();
                }
            });
        }
        else {
            ContextMenu.open({
                items: [
                    {
                        label: i18n.__('selectFolderPanel.context.addChilderFolder'),
                        icon: 'ic-folder-new-sub-folder.svg',
                        click: () => {
                            this.createFolder("", (folderName) => {
                                $bodyScope.createFolder({
                                    name: folderName,
                                    parentID: item.id,
                                    callback: (folder) => {
                                        this.onCreatedFolder(folder);
                                    }
                                })
                            });
                        }
                    },
                    {
                        label: i18n.__('selectFolderPanel.context.addSiblingFolder'),
                        icon: 'ic-expand-same.svg',
                        click: () => {
                            this.createFolder("", (folderName) => {
                                $bodyScope.createFolder({
                                    name: folderName,
                                    sibling: item,
                                    callback: (folder) => {
                                        this.onCreatedFolder(folder);
                                    }
                                })
                            });
                        }
                    }
                ],
                onClosed: () => {
                    this.focusSearchInput();
                }
            });
        }
    }

    changeTab (tab) {
        this.listData.currentTab = tab;
        this.updateItemList();
    }

    keywordChanged () {
        this.updateItemList();
    }

    isItemSelectable (item) {
        const selectableTypes = { 'folder': true, 'create': true };
        return selectableTypes[item.type];
    }

    createFolder (defaultName = "", callback) {
        swal({
			html: `
				<div class="alert">
					<div class="alert-icon create"></div>
					<h4 class="alert-title">${i18n.__("selectFolderPanel.createFolder.title")}</h4>
				</div>
			`,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
			customClass: "alert-box",
            input: 'text',
            inputPlaceholder: i18n.__("selectFolderPanel.createFolder.placeholder"),
            inputValue: defaultName,
            cancelButtonColor: "#777777",
            confirmButtonText: i18n.__("selectFolderPanel.createFolder.button"),
            cancelButtonText: i18n.__("general.cancel"),
        }).then((result) => {
            var name = result;
            callback(name);
            this.focusSearchInput();
        }, () => {
            this.focusSearchInput();
        });
    }

    onCreatedFolder (folder) {
        const selectedIds = { ...this.listData.selectedIds };
        selectedIds[folder.id] = true;
        this.reset();
        this.init(this.originalParams);
        this.listData.selectedIds = selectedIds;
        this.updateItemList();
    }

    toggleExpand (item) {
        if (this.collapsedFolderIds[item.id]) {
            this.expand(item);
        }
        else {
            this.collapse(item);
        }
    }

    expand (item) {
        delete this.collapsedFolderIds[item.id];
        this.updateItemList(true);
        try { localStorage['eagle.folderSelectPanel.collapsedFolderIds'] = JSON.stringify(this.collapsedFolderIds); } catch (e) { console.error(e); }
    }

    collapse (item) {
        this.collapsedFolderIds[item.id] = true;
        this.updateItemList(true);
        try { localStorage['eagle.folderSelectPanel.collapsedFolderIds'] = JSON.stringify(this.collapsedFolderIds); } catch (e) { console.error(e); }
    }

    onLeftKey() {
        const currentItem = this.listData.items[this.listData.currentIndex];
        if (currentItem && currentItem.type === 'folder') {
            this.collapse(currentItem);
        }
    }

    onRightKey() {
        const currentItem = this.listData.items[this.listData.currentIndex];
        if (currentItem && currentItem.type === 'folder') {
            this.expand(currentItem);
        }
    }
}

EagleApp.directive('folderSelectPanel', ($timeout) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/folder-select-panel.html',
        replace: false,
        scope: {
            theme: '=theme'
        },
        link: (scope, element) => {

            // 如果面板的位置壓住了標籤選擇按鈕，則將面板移動到檢查器左側 + 10px 處
            const preventOverlayInspector = () => {
                try {
                    const $selectPanel = $(element).find('.select-panel');
                    const inspectorLeft = $(".inspector").offset().left;
                    const panelWidth = $selectPanel.width();
                    const panelLeft = $selectPanel.offset().left;
                    const newLeft = inspectorLeft - panelWidth + 5;
                    if (panelLeft + panelWidth > inspectorLeft && newLeft > 0) {
                        $selectPanel.css("left", newLeft);
                    }
                } catch (e) {}
            };

            const panel = new FolderSelectPanel({
                scope: scope,
                panelSelector: "#folder-select-panel",
                searchInputSelector: "#folder-select-panel-search-input",
            });

            scope.$on('FOLDER.SELECT.PANEL.OPEN', (event, params) => {

                panel.init(params);

                $timeout(() => {
                    panel.open();
                    preventOverlayInspector();
                }, 20);

                Object.assign(scope, {
                    collapsedFolderIds: panel.collapsedFolderIds,
                    listData: panel.listData,
                    toggleExpand: (item) => {
                        panel.toggleExpand(item);
                    },
                    expand: (item) => {
                        panel.expand(item);
                    },
                    collapse: (item) => {
                        panel.collapse(item);
                    },
                    openItem: (event, item) => {
                        panel.openItem(event, item);
                    },
                    openItemSubmenu: (item) => {
                        panel.openItemSubmenu(item);
                    },
                    hoverItem: (event, item) => {
                        const currentMouseX = event.clientX;
                        const currentMouseY = event.clientY;
                        const lastMouseX = windowMouseX;
                        const lastMouseY = windowMouseY;
                        const distance = Math.sqrt(Math.pow(currentMouseX - lastMouseX, 2) + Math.pow(currentMouseY - lastMouseY, 2));
                        if (distance !== 0) {
                            panel.hoverItem(item.index);
                        }
                    },
                    close: () => {
                        panel.close();
                    },
                    focusSearchInput: () => {
                        panel.focusSearchInput();
                    },
                    changeTab: (tab) => {
                        panel.changeTab(tab);
                    }
                });

            });
        }
    }
})