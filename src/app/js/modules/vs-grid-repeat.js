angular.module("vsGridRepeat", []).directive("vsGridRepeat", [
	"$window", "$compile", function ($window, $compile) {
		return {
			restrict: "A",
			transclude: true,
			scope: {
				vsGridRepeatOptions: "=",
				vsGridItems: "=",
				vsGridState: "=",
			},
			link: function (
				scope, element, attrs, ctrl, transclude
			) {
				const parentScope = scope.$parent;
				let options = scope.vsGridRepeatOptions || {
					columnWidth: 100,
					columnHeight: 100,
					columnGap: 8,
					rowGap: 12,
					extraRange: 200,
					groupLabelHeight: 40,
					squareMode: false,
					listMode: false,
					padding: 4,
					paddingTop: 4,
					paddingBottom: 4,
					paddingLeft: 4,
					paddingRight: 4,
				};

				if (!scope.vsGridItems) {
					scope.vsGridItems = [];
				}

				if (!scope.vsGridState) {
					scope.vsGridState = {};
				}

				let { columnWidth, columnHeight, columnGap, rowGap, extraRange, groupLabelHeight, squareMode, listMode, padding } = options;
				let paddingTop = options.paddingTop ?? options.padding ?? 0;
				let paddingBottom = options.paddingBottom ?? options.padding ?? 0;
				let paddingLeft = options.paddingLeft ?? options.padding ?? 0;
				let paddingRight = options.paddingRight ?? options.padding ?? 0;
				let container = element[0];
				let columns = 0;
				let totalHeight = 0;
				let lastTotalHeight = 0;
				let lastVisibleItems = [];
				let lastItemState = {};
				// let scope.vsGridItems = []; // Store item positions
				let itemMaps = {}; // Store item maps
				let groupMaps = {}; // Store group maps
				let isCompiled = {}; // Store compiled items
				let expression = attrs.vsGridRepeat;
				let match = expression.match(/^\s*(\S+)\s+in\s+(\S+)\s*$/);
				if (!match) {
					throw new Error("Expected vsGridRepeat in form of '_item_ in _collection_' but got '" + expression + "'.");
				}
				let collectionName = match[2];

				scope.$watch("vsGridRepeatOptions",
					(newOptions) => {
						if (newOptions) {
							options = newOptions;
							({ columnWidth, columnHeight, columnGap, rowGap, extraRange, groupLabelHeight, squareMode, listMode, padding } = options);
							paddingTop = options.paddingTop ?? options.padding ?? 0;
							paddingBottom = options.paddingBottom ?? options.padding ?? 0;
							paddingLeft = options.paddingLeft ?? options.padding ?? 0;
							paddingRight = options.paddingRight ?? options.padding ?? 0;

							render({
								needReCalculate: true,
							});
						}
					},
					true);

				parentScope.$watchCollection(collectionName, async (newGroups) => {
					parentScope.groups = newGroups;
					render({
						needReCalculate: true,
					});
				});

				function calculateColumns() {
					let containerWidth = container.clientWidth - paddingLeft - paddingRight;

					totalHeight = 0;

					if (listMode) {
						columns = 1;
					} else {
						columns = Math.floor(containerWidth / (columnWidth + columnGap));
					}

					columns = columns < 1 ? 1 : columns;

					// Calculate total height based on groups and items
					const hideGroup = parentScope.groups.length === 1;

					parentScope.groups.forEach((group, index) => {
						let groupHeight = index === 0 ? groupLabelHeight - paddingTop : groupLabelHeight;
						if (!hideGroup) {
							totalHeight += groupHeight; // Group label height
						}
						if (group.isCollapsed) {
							return;
						}
						totalHeight += Math.ceil(group.items.length / columns) * (columnHeight + rowGap); // Item heights
					});

					totalHeight += paddingTop; // Padding
					totalHeight += paddingBottom; // Padding
					totalHeight += paddingTop; // Padding

					if (scope.vsGridState) {
						scope.vsGridState.totalHeight = totalHeight;
						scope.vsGridState.columns = columns;
					}
				}

				function calculatePositions() {
					let containerWidth = container.clientWidth - paddingLeft - paddingRight;
					scope.vsGridItems = []; // Reset positions
					itemMaps = {}; // Reset item maps
					groupMaps = {}; // Reset group maps
					let currentGroupTop = paddingTop ?? 0;

					const hideGroup = parentScope.groups.length === 1;
					parentScope.groups.forEach((group, index) => {
						let groupHeight = index === 0 ? groupLabelHeight - paddingTop : groupLabelHeight;

						if (!hideGroup) {
							scope.vsGridItems.push({
								id: group.id,
								type: "group",
								name: group.name,
								x: paddingLeft ?? 0,
								y: currentGroupTop,
								width: containerWidth,
								height: groupHeight,
								group: group,
								index: index,
							});
							groupMaps[group.id] = group;

							currentGroupTop += groupHeight; // Move down for the group label

							if (index !== 0) {
								currentGroupTop += 8;
							}

							// Store positions for items in the group
							if (group.isCollapsed) {
								return;
							}
						}

						let itemRow = 0; // Reset item row for each group
						group.items.forEach((item) => {
							let row = Math.floor(itemRow / columns);
							let col = itemRow % columns;
							let top = currentGroupTop + row * (columnHeight + rowGap); // Calculate top position based on group
							let adaptedWidth = containerWidth / columns - columnGap + columnGap / columns;
							let left = col === 0 ? paddingLeft : col * (adaptedWidth + columnGap) + paddingLeft;

							if (squareMode) {
								columnHeight = adaptedWidth;
							}

							if (listMode) {
								adaptedWidth = containerWidth;
								left = paddingLeft;
							}

							scope.vsGridItems.push({
								type: "item",
								id: item.id,
								name: item.name,
								x: left,
								y: top,
								width: adaptedWidth,
								height: columnHeight,
								item: item,
							});
							itemMaps[item.id] = item;

							itemRow++; // Increment item row for the next item
						});

						currentGroupTop += Math.ceil(group.items.length / columns) * (columnHeight + rowGap); // Move down for items
					});
				}

				function binarySearch(
					items, target, start, end
				) {
					while (start <= end) {
						const mid = Math.floor((start + end) / 2);
						if (items[mid].y < target) {
							start = mid + 1;
						} else {
							end = mid - 1;
						}
					}
					return start; // 返回第一个大于或等于 target 的索引
				}

				function calculateVisibleItems() {
					let scrollTop = container.scrollTop;
					let containerHeight = container.clientHeight;
					let startRow = Math.floor(scrollTop / columnHeight);
					let visibleRows = Math.ceil(containerHeight / columnHeight);
					let visibleItems = [];

					// 使用二分查找找到可见项的起始和结束索引
					const startIndex = binarySearch(
						scope.vsGridItems, Math.max(0, scrollTop - extraRange), 0, scope.vsGridItems.length - 1
					);
					const endIndex = binarySearch(
						scope.vsGridItems, scrollTop + containerHeight + extraRange, 0, scope.vsGridItems.length - 1
					);

					// 仅遍历可见项的范围
					for (let i = startIndex; i <= endIndex; i++) {
						const pos = scope.vsGridItems[i];
						if (!pos) continue;
						if (pos.y < scrollTop + containerHeight + extraRange && pos.y + pos.height > scrollTop - extraRange) {
							visibleItems.push(pos);
						}
					}

					return visibleItems;
				}

				function initEvents() {
					const resizeObserver = new ResizeObserver(() => {
						let resizeTimeout;
						clearTimeout(resizeTimeout);
						resizeTimeout = setTimeout(() => {
							parentScope.$apply(() => {
								render({ needReCalculate: true });
							});
						}, 100);
					});

					resizeObserver.observe(container);

					const setupScrollHandlers = (element, options) => {
						let isScrolling;
						let scrollStarted = false;

						element.on("scroll", () => {
							if (!scrollStarted && options.onScrollStart) {
								options.onScrollStart();
								scrollStarted = true;
							}

							// Clear our timeout throughout the scroll
							clearTimeout(isScrolling);

							// Set a timeout to run after scrolling ends
							isScrolling = setTimeout(() => {
								if (options.onScrollEnd) {
									options.onScrollEnd();
								}
								scrollStarted = false;
							}, 100); // 150ms after the last scroll event
						});
					};

					scope.$on("$destroy", () => {
						resizeObserver.disconnect();
					});

					setupScrollHandlers(element, {
						onScrollStart: () => {
							if (options.onScrollStart) {
								options.onScrollStart();
							}
						},
						onScrollEnd: () => {
							if (options.onScrollEnd) {
								options.onScrollEnd();
							}
						},
					});

					let scrollTimeout;
					element.on("scroll", (event) => {
						scrollTimeout = setTimeout(() => {
							parentScope.$apply(() => {
								render();
							});
						}, 32);
					});

					element.on("render", () => {
						parentScope.$evalAsync(render);
					});
				}

				function render({ needReCalculate = false } = {}) {
					if (!parentScope.groups) {
						return;
					}

					calculateColumns();
					calculatePositions(); // Update positions before rendering

					let visibleItems = calculateVisibleItems();
					let addedItems = visibleItems.filter((item) => !lastVisibleItems.some((lastItem) => lastItem.id === item.id));
					let removeItems = lastVisibleItems.filter((item) => !visibleItems.some((visibleItem) => visibleItem.id === item.id));
					let updateItems = visibleItems.filter((item) => {
						const isRemoved = removeItems.some((removeItem) => removeItem.id === item.id);
						const isAdded = addedItems.some((addedItem) => addedItem.id === item.id);
						return !isRemoved && !isAdded;
					});

					// Remove items that are no longer visible
					removeItems.forEach((item) => {
						const selector = '[data-id]';
						const elements = element[0].querySelectorAll(selector);
						let elementToRemove = Array.from(elements).find(el => el.getAttribute('data-id') === encodeURIComponent(item.id));
						
						if (elementToRemove) {
							elementToRemove.childNodes.forEach((child) => {
								angular.element(child).scope().$destroy();
							});
							elementToRemove.remove();
						}
					});

					// update existing items width height and position 
					updateItems.forEach((item) => {
						const selector = '[data-id]';
						const elements = element[0].querySelectorAll(selector);
						let elementToUpdate = Array.from(elements).find(el => el.getAttribute('data-id') === encodeURIComponent(item.id));
						
						if (elementToUpdate) {

							// NOTE: 這段程式碼不該存在，但不知道該怎麼修正，首次渲染出現的 GROUP 無法正常控制 isCollapsed
							const isGroup = elementToUpdate.classList.contains("grid-group-label");
							if (isGroup) {
								const group = groupMaps[item.id];
								const groupScope = angular.element(elementToUpdate).children("group").scope();
								groupScope.group = group;
							}

							if (lastItemState[item.id]) {
								if (lastItemState[item.id].top === item.y && lastItemState[item.id].left === item.x && lastItemState[item.id].width === item.width && lastItemState[item.id].height === item.height) {
									return;
								}
							}

							elementToUpdate.style.width = item.width + "px";
							elementToUpdate.style.height = item.height + "px";
							elementToUpdate.style.top = item.y + "px";
							elementToUpdate.style.left = item.x + "px";

							if (item.index !== undefined) {
								elementToUpdate.setAttribute("index", item.index);
							}
						}
					});

					// Render new visible items
					addedItems.forEach((item) => {
						let childScope = parentScope.$new();

						if (item.type === "group") {
							transclude(childScope, (clone) => {
								childScope.group = groupMaps[item.id];
								let groupElement = angular.element(`<div class="grid-group-label" data-id="${encodeURIComponent(item.id)}" style="transform: translateZ(0); top:${item.y}px; left: ${item.x}px; height: ${item.height}px; width: ${item.width}px;" index="${item.index}"></div>`);
								groupElement.append(clone[1]);
								element.append(groupElement);
							});
						} else if (item.type === "item") {
							transclude(childScope, (clone) => {
								childScope.item = itemMaps[item.id];
								let itemElement = angular.element(`<div class="grid-item" data-id="${encodeURIComponent(item.id)}" style="transform: translateZ(0); width:${item.width}px; height:${item.height}px; top:${item.y}px; left:${item.x}px;"></div>`);
								itemElement.append(clone[3]);
								element.append(itemElement);
							});
						}
					});

					// Update the placeholder height
					let placeholder = element[0].querySelector(".grid-placeholder");
					if (placeholder) {
						if (totalHeight === Infinity) {
							totalHeight = 100;
						}
						if (lastTotalHeight !== totalHeight) {
							placeholder.style.height = totalHeight + "px";
						}
					} else {
						placeholder = angular.element(`<div class="grid-placeholder" style="height:${totalHeight}px; pointer-events: none;"></div>`);
						element.append(placeholder);
					}
					lastTotalHeight = totalHeight;
					lastVisibleItems = visibleItems;

					// Store last state for each item
					lastItemState = {};
					visibleItems.forEach((item) => {
						lastItemState[item.id] = {
							top: item.y,
							left: item.x,
							width: item.width,
							height: item.height,
						};
					});
				}

				initEvents();
				render();
			},
		};
	},
]);
