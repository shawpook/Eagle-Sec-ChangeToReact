"use strict";
const ipcRenderer = require('electron').ipcRenderer;
const remote = require('@electron/remote');

let isMouseMoving;
let windowMouseX = 0;
let windowMouseY = 0;
let mousemoveTimeout;
document.addEventListener("mousemove",
	(e) => {
		windowMouseX = e.pageX;
		windowMouseY = e.pageY;
		if (isMouseMoving) return;
		isMouseMoving = true;
		clearTimeout(mousemoveTimeout);
		mousemoveTimeout = setTimeout(() => {
			isMouseMoving = false;
		}, 500);
	},
	false);

document.addEventListener("keydown", function(e) {
	if (e.ctrlKey || e.metaKey) { // 檢查是否按下 Ctrl 或 Cmd 鍵
		switch (e.key) {
			case 'a': // 全選
				document.execCommand('selectAll');
				break;
			case 'c': // 複製
				document.execCommand('copy');
				break;
			case 'x': // 剪下
				document.execCommand('cut');
				break;
			case 'v': // 貼上
				document.execCommand('paste');
				break;
			case 'z': // 撤銷與重做
				if (e.shiftKey) {
					document.execCommand('redo'); // 重做
				} else {
					document.execCommand('undo'); // 撤銷
				}
				break;
			case 'y': // 重做
				document.execCommand('redo');
				break;
		}
	}
}, false);

const EagleApp = angular.module("CollectApp", ["i18n",
	"contenteditable",
	"stopWheel",
	"vs-repeat",
	"contextMenu",
	"vsAutoScroll",
	"vsGridRepeat"
]);

EagleApp.config([
	"$sceProvider", "$httpProvider", ($sceProvider, $httpProvider) => {
		$sceProvider.enabled(false);
	},
]);

EagleApp.filter("fuzzyMatch", () => {
	function fuzzy_match(text, search) {
		search = search.replace(/ /g, "").toLowerCase();
		var tokens = [];
		var search_position = 0;

		for (var n = 0; n < text.length; n++) {
			var text_char = text[n];
			if (search_position < search.length && text_char.toLowerCase() == search[search_position]) {
				text_char = "<b>" + text_char + "</b>";
				search_position += 1;
			}
			tokens.push(text_char);
		}

		if (search_position != search.length) {
			return "";
		}
		return tokens.join("");
	}

	return function (keyword, string) {
		if (!string) {
			return keyword;
		}
		var result = fuzzy_match(keyword, string);
		if (!result) return keyword;
		return result;
	};
});

EagleApp.filter('themePath', function () {
    return function (theme) {
        if (theme === 'light' || theme === 'lightgray') {
            return 'light';
        }
        else {
            return 'dark';
        }
    };
});

EagleApp.directive('ngRightClick', function ($parse) {
    return function (scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        scope.$on('$destroy', function () {
            element.off();
        });
        element.bind('contextmenu', function (event) {
            scope.$apply(function () {
                event && event.preventDefault();
                fn(scope, { $event: event });
            });
        });
    };
});

EagleApp.controller("CollectController", [
	"$rootScope",
	"$scope",
	"$timeout",
	"i18nService",
	(
		$rootScope, $scope, $timeout, i18nService
	) => {
		(() => {
			let recentFolderOrders = {};
			let tagAll = [];

			// 取得當前主題
			$rootScope.getTheme = () => {
				return $scope.getThemeName(preferences.theme).toLowerCase();
			};

			$scope.getThemeName = function (theme) {
				if (theme.name === "Auto") {
					if (remote.nativeTheme.shouldUseDarkColors) {
						return "DARK";
					}
					else {
						return "LIGHT";
					}
				}
				else {
					return theme.name;
				}
			};

			$scope.changeStar = (star) => {
				if (!star || star === $scope.collectItem.star) {
					delete $scope.collectItem.star;
					return;
				}

				$scope.collectItem.star = star;
			};

			$scope.removeTag = (tag) => {
				const index = $scope.collectItem.tags.indexOf(tag);
				if (index === -1) return;
				$scope.collectItem.tags.splice(index, 1);
			};

			$scope.openTagSelect = () => {
				TagSelectPanel.open({
					preventCollisionWithElement: document.querySelector("div.fake-thumbnail"),
					tagManager: {
						allTags: $scope.tags,
						groups: tagAll?.groups || [],
						recentTags: tagAll?.recent?.map((tag) => tag.name) || [],
						suggestions: [],
						starredTags: tagAll?.starred?.map((tag) => tag.name) || [],
					},
					selectedTags: $scope.collectItem.tags.reduce((result, tag) => {
						result[tag] = true;
						return result;
					}, {}),
					onChanged: (result) => {
						const { selectedTags, deselectedTags } = result;
						const tags = Object.keys(selectedTags);
						tags.forEach((tag) => {
							$scope.tagsMap[tag] = $scope.tagsMap[tag] || {
								name: tag,
								color: "",
								groups: [],
							};
						});
						$scope.collectItem.tags = tags;

						$scope.$evalAsync();
					},
					onClosed: () => {
						$scope.focusFolderInput();
					},
				});
			};

			$scope.focusFolderInput = () => {
				$timeout(() => {
					const input = document.querySelector("#folder-select-panel-search-input");
					if (!input) return;
					input.focus();
				}, 100);
			};

			$scope.initFolderSelect = () => {
				FolderSelectPanel.open({
					recentFolderOrders: recentFolderOrders,
					folders: $scope.folders,
					selectedIds: [],
					onOpenItem: async (selectedFolderItem) => {
						// 如果正在載入資料，就不要做任何事
						if ($scope.isLoadingData) return;

						let collectItem = filterCollectItem($scope.collectItem);
						// 如果是多選資料會長這樣
						// selectedFolderItem = ["LGAFJJ3YSGS03", "LGAFJJ3YSGS04"]
						if (selectedFolderItem instanceof Array) {
							collectItem.folderIDs = selectedFolderItem;

							// 取得每個資料夾的 tags
							selectedFolderItem.forEach((folderId) => {
								const folder = $scope.foldersMap[folderId];
								if (folder && folder.extendTags instanceof Array) collectItem.tags = [...new Set([...collectItem.tags, ...folder.extendTags])];
							});
						} else {
							// 單選會直接是資料夾物件
							if (selectedFolderItem.id) collectItem.folderIDs = [selectedFolderItem.id];
							if (selectedFolderItem.extendTags instanceof Array) collectItem.tags = [...new Set([...collectItem.tags, ...selectedFolderItem.extendTags])];
						}

						$scope.save(collectItem);
					},
					onCreateItem: async (item) => {
						const folderName = item.name;
						const folder = await eagle.folder.create(folderName);
						let collectItem = filterCollectItem($scope.collectItem);
						collectItem.folderIDs = [folder.id];
						$scope.save(collectItem);
						$rootScope.$evalAsync();
					},
					onLibrarySwitching: () => {
						$scope.isLoadingData = true;
					},
					onLibrarySwitched: () => {
						loadData();
					},
					onLibrarySwitchClosed: () => {
						$scope.focusFolderInput();
					},
				});
			};

			$scope.save = async (collectItem) => {
				const base64 = await eagle.utils.urlToBase64($scope.collectItem.src, 1000);
				await eagle.item.addFile({ src: base64, ...collectItem });
				window.close();
			};

			$scope.close = () => {
				window.close();
			};
			
			function filterCollectItem(collectItem) {
				// only allow those keys output: title, annotation, tags, folderIDs, star
				const allowedKeys = ["title",
					"annotation",
					"tags",
					"folderIDs",
					"star"];

				const collectItemCleaned = Object.keys(collectItem).reduce((result, key) => {
					if (allowedKeys.includes(key)) {
						result[key] = collectItem[key];
					}
					return result;
				}, {});

				return collectItemCleaned;
			}

			async function loadData() {
				$scope.folders = [];
				$scope.foldersMap = {};
				$scope.recentFolders = [];
				$scope.tags = [];
				$scope.tagsMap = {};

				let [folders, recentFolders, tags] = await Promise.all([eagle.folder.all(), eagle.folder.recent(), eagle.tag.all()]);

				$scope.folders = folders;
				$scope.foldersMap = {};
				$scope.recentFolders = recentFolders;
				$scope.tags = tags?.tags || [];

				tagAll = tags || {};
				recentFolderOrders = {};
				$scope.recentFolders.forEach((folder, index) => {
					recentFolderOrders[folder.id] = index;
				});

				$scope.tagsMap = $scope.tags.reduce((result, tag) => {
					result[tag.name] = tag;
					return result;
				}, {});

				treeUtil.walk($scope.folders, "children", (folder, parent) => {
					$scope.foldersMap[folder.id] = folder;
				});

				$scope.isLoadingData = false;

				$scope.initFolderSelect();
				$scope.$evalAsync();
			}

			(async () => {
				$rootScope.preference = eagle.preference;
				$rootScope.i18nService = i18nService;
				$rootScope.i18nService.initLocale(preferences.general.language);
				$rootScope.$evalAsync();

				$scope.browserName = eagle.env.browser.name;
				$scope.theme = $rootScope.getTheme();
				$scope.platform = process.platform;
				$scope.isOpen = true;
				$scope.collectItem = new CollectItem();

				await loadData();

				$rootScope.isReady = true;
				remote.getCurrentWindow().setOpacity(1);
				$rootScope.$evalAsync();

				const item = await ipcRenderer.invoke("get-collect-window-data");
				$scope.collectItem.src = require("url").pathToFileURL(item.path).href;
				$scope.collectItem.url = item.url ?? "";
				$scope.collectItem.title = item.name ?? "";
				$scope.collectItem.type = item.type ?? "image";
				$scope.collectItem.tags = item.tags ?? [];
				$scope.collectItem.folders = item.folders ?? [];
				$scope.$evalAsync();

				eagle.utils.getURLDimensions($scope.collectItem.src).then((dimensions) => {
					$scope.collectItem.width = dimensions.width;
					$scope.collectItem.height = dimensions.height;
					$scope.$evalAsync();
				});

			})();
		})();
	},
]);
