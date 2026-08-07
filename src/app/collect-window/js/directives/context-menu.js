const treeUtil = eagle.utils.tree;

class ContextMenu {
	static open(options) {
		const $rootScope = angular.element("html").scope();
		$rootScope.$broadcast("CONTEXTMENU.OPEN", options);
	}
	static close() {
		const $rootScope = angular.element("html").scope();
		$rootScope.$broadcast("CONTEXTMENU.CLOSE");
	}
}

angular
	.module("contextMenu", ["i18n"])
	.directive("contextMenuItems", () => {
		return {
			restrict: "E",
			templateUrl: "js/directives/context-menu-items.html",
			scope: {
				menu: "=",
				activeMenu: "=",
				searchKeyword: "=",
				theme: "=theme",
			},
			replace: false,
			link: (scope, element, attrs) => {
				scope.toggleItem = scope.$parent.toggleItem;
				scope.openItem = scope.$parent.openItem;
				scope.openMore = scope.$parent.openMore;
				scope.hoverItem = scope.$parent.hoverItem;
				scope.sortableOptions = scope.$parent.sortableOptions;
			},
		};
	})

	// 設計邏輯
	// 1. 按下右鍵時，會觸發 contextmenu 事件，並且傳入 options 物件
	// 2. options 物件裡面包含了 menu 物件，menu 物件裡面包含了 items 屬性，items 屬性是一個陣列，裡面包含了每個選單項目的資料
	// 3. 每個選單項目的資料裡面，包含了 label, click, role, submenu, disabled, keepOpen, checked, visible, keywords 等屬性
	// 4. 每個選單項目的資料裡面，如果有 submenu 屬性，則 submenu 屬性裡面也包含了 items 屬性，items 屬性是一個陣列，裡面包含了每個選單項目的資料
	// 5. input 會監聽 keydown 事件，並且傳入 event 物件，而事件控制的選單，是 scope.activeMenu
	.directive("contextMenu", [
		"$timeout", ($timeout) => {
			return {
				restrict: "E",
				templateUrl: "js/directives/context-menu.html",
				replace: false,
				scope: {
					theme: "=theme",
				},
				link: (scope, element, attrs) => {
					let onOpened;
					let onClosed;
					let onSorted;
					let originalMenu;
					let keyBuffer = "";
					let keyBufferTimeout = null;

					scope.sortableOptions = {
						distance: 10,
						animation: 200,
						disabled: false,
						helper: "clone",
						update: (e, ui) => {
							setTimeout(() => {
								onSorted && onSorted(originalMenu.items);
							}, 1);
						},
					};

					const $contextMenuElement = element.find("> .context-menu");
					const $searchInputElement = element.find("input[type='search']");

					// 如果 context menu 沒有開啟，不應該被 focus
					$searchInputElement.on("focus", () => {
						if (!$contextMenuElement.hasClass("open")) {
							blurSearchInput();
						}
					});

					const selectUp = () => {
						if (scope.activeMenu.currentIndex > 0) {
							let prevIdx = scope.activeMenu.currentIndex - 1;
							let prevItem = scope.activeMenu.items[prevIdx];
							if (!prevItem) return;
							scope.activeMenu.currentIndex = prevIdx;
							if (!isItemSelectable(prevItem)) {
								selectUp();
							}
						}
					};

					const selectDown = () => {
						if (scope.activeMenu.currentIndex < scope.activeMenu.items.length - 1) {
							let nextIdx = scope.activeMenu.currentIndex + 1;
							let nextItem = scope.activeMenu.items[nextIdx];
							if (!nextItem) return;
							scope.activeMenu.currentIndex = nextIdx;
							if (!isItemSelectable(nextItem)) {
								selectDown();
							}
						}
					};

					const openSubmenu = (item) => {
						if (!item?.submenu) return;
						scope.activeMenu = item.submenu;
						scope.activeMenu.currentIndex = 0;
					};

					const closeSubmenu = () => {
						scope.activeMenu = originalMenu;
					};

					const isItemSelectable = (item) => {
						if (item.role === "toggle") return true;
						return !item.role && !item.disabled;
					};

					const hoverItem = (index, menu) => {
						menu.currentIndex = index;
						scope.activeMenu = menu;
						let item = menu.items[index];
						openSubmenu(item);
					};

					const openItem = (item) => {
						if (!item || item?.submenu) return;
						item?.click && item.click(item);
						if (item?.keepOpen) {
							// check item has checked property
							if (item.checked !== undefined) {
								item.checked = !item.checked;
							}
						} else {
							scope.close();
						}
					};

					const toggleItem = (item) => {
						item.pinned = !item.pinned;
						item?.toggle && item.toggle(item.pinned);
					};

					const openMore = (item) => {
						item?.more && item.more(item);
					};

					const moveToCursorPosition = (callback, retry) => {
						const windowWidth = $(window).width();
						const windowHeight = $(window).height();
						const containerWidth = $contextMenuElement.width();
						const containerHeight = $contextMenuElement.height();
						let searchInputHeight = scope.displayMenu.showSearch ? 36 : 0;

						// NOTE: 避免尚未完成渲染的時候，取得的 containerHeight 為 0
						if (retry < 5 && (containerWidth < 20 || containerHeight < 34 + searchInputHeight || containerWidth < 90)) {
							setTimeout(() => {
								moveToCursorPosition(callback, retry + 1);
							}, 20);
							return;
						}

						let x = windowMouseX + 10;
						let y = windowMouseY - 10;

						if (windowMouseX + containerWidth > windowWidth) {
							x = windowMouseX - containerWidth - 5;
						}

						if (windowMouseY + containerHeight > windowHeight - 20) {
							y = windowHeight - containerHeight - 20;
							y = y < 20 ? 20 : y;
						} else if (windowMouseY - 56 < 0) {
							y = 36;
						}

						$contextMenuElement.css({
							left: `${x}px`,
							top: `${y}px`,
						});

						let maxHeight = windowHeight - searchInputHeight - y - 20;

						$contextMenuElement.find(".context-menu-items").css({
							maxHeight: `${maxHeight}px`,
						});

						callback();
					};

					const openContextMenu = (options) => {
						$timeout(() => {
							moveToCursorPosition(() => {
								$contextMenuElement.addClass("open");
								onOpened();
								setTimeout(focusSearchInput, 50);
							}, 0);
						}, 50);
					};

					const closeContextMenu = () => {
						destroy();
						$contextMenuElement.removeClass("open");
						blurSearchInput();
						onClosed();
					};

					const focusSearchInput = () => {
						setTimeout(() => {
							$searchInputElement.focus();
						}, 24);
					};

					const blurSearchInput = () => {
						$searchInputElement.blur();
					};

					let enterKeydown = false;
					const onSearchKeydown = (event) => {
						const idx = scope?.activeMenu?.currentIndex;
						const item = scope?.activeMenu?.items ? scope.activeMenu.items[idx] : null;
						switch (event.keyCode) {
						case 13: // enter
							event.preventDefault();
							enterKeydown = true;
							break;
						case 38: // up
							event.preventDefault();
							selectUp();
							break;
						case 40: // down
							event.preventDefault();
							selectDown();
							break;
						case 37: // left
							closeSubmenu(item);
							break;
						case 39: // right
							openSubmenu(item);
							break;
						case 27: // esc
							event.preventDefault();
							break;
						default:
							if (!scope.displayMenu.showSearch) {
								event.stopPropagation();
								event.preventDefault();
								// 自動搜尋字母開頭等於 item.label 的項目
								keyBuffer += String.fromCharCode(event.keyCode).toLowerCase();
								clearTimeout(keyBufferTimeout);
								keyBufferTimeout = setTimeout(() => {
									keyBuffer = "";
								}, 500);
								let idx = scope.activeMenu.items.findIndex((item) => item?.label?.toLowerCase().startsWith(keyBuffer));
								if (idx >= 0) {
									scope.activeMenu.currentIndex = idx;
								}
							}
							break;
						}
					};

					const onSearchKeyup = (event) => {
						const item = scope?.activeMenu?.items[scope.activeMenu.currentIndex];
						switch (event.keyCode) {
						// 沒有搜尋功能的右鍵選單，按下空白鍵時，會直接開啟選單項目
						case 32:
							if (!scope.displayMenu.showSearch) {
								event.preventDefault();
								openItem(item);
							}
							break;
						case 13: // enter
							if (enterKeydown) {
								openItem(item);
								enterKeydown = false;
							}
							break;
						case 27: // esc
							event.preventDefault();
							closeContextMenu();
							break;
						}
					};

					const init = (menu) => {
						// 清理 menu.items 裡面不需要的 item
						menu.items = menu.items.filter((item) => {
							return item.visible !== false;
						});
						treeUtil.walk(menu, "items", function (item, parent) {
							if (item.submenu) {
								item.submenu.items = item.submenu.items.filter((item) => {
									return item.visible !== false;
								});
							}
						});
						originalMenu = menu;
						scope.sortableOptions = {
							distance: 10,
							animation: 200,
							handle: menu.sortableHelper ? ".drag-helper" : undefined,
							disabled: false,
							helper: "clone",
							update: (e, ui) => {
								setTimeout(() => {
									onSorted && onSorted(originalMenu.items);
								}, 1);
							},
						};
						scope.width = menu.width || "auto";
						scope.displayMenu = menu;
						scope.displayMenu.currentIndex = -1;
						scope.activeMenu = menu;
						onOpened = menu.onOpened || (() => {});
						onClosed = menu.onClosed || (() => {});
						onSorted = menu.onSorted || (() => {});
					};

					const destroy = () => {
						$contextMenuElement.find(".context-menu-items").css("max-height", "");
						scope.searchKeyword = "";
						scope.displayMenu = {};
						scope.activeMenu = null;
					};

					const onSearchChange = () => {
						if (!scope.displayMenu.showSearch) return;
						if (scope.searchKeyword !== "") {
							// 建立一個新的 menu 物件，及進入搜尋狀態
							scope.displayMenu = getSearchResultMenu();
							scope.sortableOptions.disabled = true;
						} else {
							scope.displayMenu = originalMenu;
							scope.displayMenu.currentIndex = -1;
							scope.sortableOptions.disabled = false;
						}
						scope.activeMenu = scope.displayMenu;
					};

					const getSearchResultMenu = () => {
						const filterItems = (items, keyword) => {
							if (!items) return;
							if (!keyword) return items;

							// filter by lower case keyword indexOf
							let result = items.filter((item) => {
								const itemName = `${item.label ?? ""} ${item.keywords ?? ""}`;
								return itemName.toLowerCase().indexOf(keyword.toLowerCase()) >= 0;
							});

							result = result.filter((item) => !item.role || item.role === "toggle");
							result = result.filter((item) => !item.submenu);
							result = result.filter((item) => !item.disabled);

							return result;
						};

						let result = {
							items: [],
							showSearch: true,
							currentIndex: 0,
						};

						// 先搜尋第一層
						let level1Result = filterItems(originalMenu.items, scope.searchKeyword);
						result.items = [...level1Result];

						// 再搜尋第二層
						originalMenu.items.forEach((item) => {
							if (item?.submenu?.items) {
								let level2Result = filterItems(item.submenu.items, scope.searchKeyword);
								if (level2Result.length > 0) {
									if (result.items.length > 0) {
										level2Result = [{ role: "separator" }, { role: "label", label: item.label }, ...level2Result];
									} else {
										level2Result = [{ role: "label", label: item.label }, ...level2Result];
									}
									result.items = [...result.items, ...level2Result];
								}
							}
						});

						result.currentIndex = result.items.findIndex((item) => isItemSelectable(item)) || 0;
						return result;
					};

					scope.$on("CONTEXTMENU.OPEN", (event, options) => {
						init(options);
						openContextMenu();
					});

					scope.$on("CONTEXTMENU.CLOSE", (event) => {
						closeContextMenu();
					});

					Object.assign(scope, {
						searchKeyword: "",
						menu: null,
						activeMenu: null,
						focusSearchInput: focusSearchInput,
						onSearchKeydown: onSearchKeydown,
						onSearchKeyup: onSearchKeyup,
						onSearchChange: onSearchChange,
						openItem: openItem,
						openMore: openMore,
						toggleItem: toggleItem,
						hoverItem: hoverItem,
						close: closeContextMenu,
					});
				},
			};
		},
	])
	// 自動定位 context menu 的位置
	.directive("autoPositionContextMenu", [
		"$timeout", ($timeout) => {
			return {
				restrict: "A",
				link: (scope, element) => {
					const autoPositionContextMenu = () => {
						const $menuItem = $("#submenu-placeholder").parent();
						if (!$menuItem.length) return;

						const { top: menuItemTop, left: menuItemLeft } = $menuItem.position();
						const { top: menuItemOffsetTop, left: menuItemOffsetLeft } = $menuItem.offset();

						const elementTop = menuItemOffsetTop;
						const elementBottom = elementTop + element.height();
						const elementRight = menuItemOffsetLeft + $menuItem.outerWidth() + element.outerWidth();
						const maxBottom = $(window).height() - 20;
						const maxRight = $(window).width() - 20;

						let offsetY = 0;
						let offsetX = 0;

						if (elementBottom > maxBottom) offsetY = elementBottom - maxBottom;
						if (elementRight > maxRight) offsetX = $menuItem.outerWidth() + element.outerWidth();

						offsetY = Math.min(offsetY, elementTop);

						const top = menuItemTop - offsetY;
						const left = Math.max(-menuItemOffsetLeft + 20, menuItemLeft + $menuItem.outerWidth() - offsetX - 4);

						element.css({
							opacity: 1,
							top: `${top}px`,
							left: `${left}px`,
						});

						element.find(".context-menu-items").css({
							maxHeight: `${maxBottom - offsetY}px`,
						});
					};
					$timeout(autoPositionContextMenu, 50);
					$(window).off("resize.submenu").on("resize.submenu", autoPositionContextMenu);
				},
			};
		},
	]);
