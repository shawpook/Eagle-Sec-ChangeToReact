var ig;
var $bodyScope;
var resetNgGridLayoutData;
var NgGridStrings = {};

EagleApp.directive('ngGridLayout', ['$rootScope', '$filter', function($rootScope, $filter){
	return {
		scope: {
			options: "=options",
		},
		restrict: 'A',
		link: function($scope, element, attrs) {
			var startCursor = 0;
			var startGroupKey = 1000000 + startCursor;
			var $container = $("#box-container");
			var fixedImageMapinngs = {};
			var checkedImageMapinngs = {};
			if (!$bodyScope) {
				$bodyScope = angular.element("body").scope();
			}

			ipcRenderer.on('app-status-library-loaded', function () {
				fixedImageMapinngs = {};
				checkedImageMapinngs = {};
			});

			// 重樣版建立 HTML 元件
			function getItem(data) {
				var resolutionStr = "";
				if (data.width) {
					resolutionStr = `${i18n.__("inspector.props.resolution")}: ${data.resolution}&#10;`;
				}
				// 💩
				var title = `${i18n.__("inspector.props.fileType")}: ${data.ext}&#10;${resolutionStr}${i18n.__("inspector.props.fileSize")}: ${data.sizeFormated}&#10;${i18n.__("inspector.props.mtime")}: ${data.mtimeFormated}&#10;${i18n.__("inspector.props.btime")}: ${$filter("date")(data.btime || data.modificationTime, "yyyy/MM/dd HH:mm")}`;
				var annotationTitle = "";

				if (data.annotationCount > 0) {
					try {
						data.comments.forEach(function (comment, index) {
							if (index !== data.comments.length - 1) {
								annotationTitle += `${comment.annotation.replaceAll("\\<[^>]*>","")}&#10;`
							}
							else {
								annotationTitle += `${comment.annotation.replaceAll("\\<[^>]*>","")}`;
							}
						});
					}
					catch (err) {
						annotationTitle = "";
					}
				}

				var imgStr = `<img class="${data.imgCss}" style="${data.imgStyle}" raw="${data.rawPath || ''}" lsrc="${data.src}" lazysrc="${data.thumbnailPath}" draggable="true" ondragend="onDragEndContainer(event)" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)" onerror="listImageError(event)">`;
				if (data.noPreview) {
					imgStr = `<div class="ext-icon-name" style="display: none;">${data.name}</div><img ext-icon draggable="true" ondragend="onDragEndContainer(event)" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)">`;
					data.hoverZoom = "";
					data.thumbnailClass = "ext-icon";
					// data.css += " animate show";
				}
				if (data.ext === 'txt') {
					data.typeLabel = "";
					data.hoverZoom = "";
					imgStr = "";
					// LazyLoadManager 會處理顯示
					// data.css += " animate show";
					data.width = 200;
					data.height = 200;
				}

				if (AUDIO_TYPES[data.ext]) {
					imgStr = `<div class="ext-icon-name">${data.name}</div>${imgStr}`;
				}

				if (data.customThumbnail) {
					data.css += " custom-thumbnail ";
				}

				var templateWithAnnotation = 
					`<div id="box-${data.id}" data-box-id="${data.id}" class="box ext-${data.ext} ${data.ext} ${data.medium} ${data.css} bg-${data.background}" box-item data-width="${data.width}" data-height="${data.height}">
					<div class="box-drag-helper" draggable="true" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)" style="display: none;"></div>
					<div class="thumbnail ${data.thumbnailClass}" draggable="true" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)" style="background-color: ${data.backgroundColor}; aspect-ratio:${data.aspectRatio};">
						${data.typeLabel}
						${data.fontActivateBtn}
						${data.txtContent}
						<div class="annotation-count" title="${annotationTitle}"><span>${data.annotationCount}</span></div>
						${data.hoverZoom}
						${imgStr}
					</div>
					<div class="list-name-tools">
						<div class="pin"></div>
						${data.fontActivateBtn}
					</div>
					<div class="name" title="${title}" data-ext=".${data.ext}"><span>${data.name}</span></div>
					<div class="prop tags">${data.tagsFormated}</div>
					<div class="prop resolution">${data.resolution}</div>
					<div class="prop rating"><span class="small star">${ratingStrings[data.star]}</span></div>
					<div class="prop ext">${data.ext}</div>
					<div class="prop size">${data.sizeFormated}</div>
					<div class="prop mtime">${data.mtimeFormated}</div>
					<div class="metas">${data.metas}</div>
					${data.sortableHelper}
				</div>
				`;
				return templateWithAnnotation;
			}

			var domparser = new DOMParser();
			var getItems = function (start, length) {
				var items = $scope.items;
				var arr = [];
				let getNodes = str => domparser.parseFromString(str, 'text/html').body.childNodes;
				var nodesString = "";
				for (var i = start; i < start + length; ++i) {
					if (items[i]) {
						var item = generateItem(items[i], i);
						nodesString += item;
						NgGridStrings[items[i].id] = item;
					}
				}
				var nodes = getNodes(nodesString);
				for (var k = 0; k < nodes.length; k++) {
					if (nodes[k].nodeName === 'DIV') {
						arr.push(nodes[k]);
					}
				}
				// console.timeEnd("getNodes");

				// console.time("innerHTML");
				// for (var i = start; i < start + length; ++i) {
				// 	if (items[i]) {
				// 		var item = generateItem(items[i], i);
				// 		if (item) {
				// 			var dummy = document.createElement("div");
				// 			dummy.innerHTML = item;
				// 			arr.push(dummy.childNodes[0]);
				// 		}
				// 	}
				// }
				// console.timeEnd("innerHTML");
				return arr;
			}

			var ratingStrings = {
				"undefined": "★★★★★",
				"0": "★★★★★",
				"1": "<y>★</y>★★★★",
				"2": "<y>★★</y>★★★",
				"3": "<y>★★★</y>★★",
				"4": "<y>★★★★</y>★",
				"5": "<y>★★★★★</y>",
			};

			var generateItem = function (item, index) {

				if (!item.id) return;

				try {
					var isGridLayout = $bodyScope.layout === "GridLayout";
					var templateData = {
						id: item.id,
						ext: item.ext,
						star: item.star || "0",
						medium: item.medium || "",
						name: item.name,
						size: item.size,
						sizeFormated: fileSize(item.size, 1), 
						btime: item.btime,
						mtime: item.mtime,
						modificationTime: item.modificationTime,
						mtimeFormated: $filter("date")(item.modificationTime, "yyyy/MM/dd HH:mm"),
						metas: `${item.width} × ${item.height}`,
						resolution: `${item.width} × ${item.height}`,
						comments: item.comments,
						annotationCount: item.comments && item.comments.length || 0,
						css: "",
						background: item.background,
						imgCss: "",
						imgStyle: "",
						width: item.width,
						height: item.height,
						backgroundColor: "rgba(128, 128, 128, 0.1)",
						preloadSrc: "",
						videoEmbed: "",
						fontActivateBtn: "",
						hoverZoom: "",
						typeLabel: "",
						sortableHelper: "",
						txtContent: "",
						customThumbnail: item.customThumbnail ?? false
					};


					templateData.tagsFormated = ""

					// 💩
					if (item.tags && item.tags.length) {
						for (let i = 0; i < item.tags.length; i++) {
							try {
								templateData.tagsFormated += `<div class="tag color-${$bodyScope.TagManager.tagMappings[item.tags[i]].color}">${item.tags[i].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
	                        } catch (err) {}
						}
					}
					else {
						templateData.tagsFormated = "-";
					}

					if ($bodyScope.currentFolder) {
						templateData.sortableHelper = `
						<div class="box-sortable-helper left" ondragenter="onDragOverBoxItem(event)" ondragleave="onDragLeaveBoxItem(event)" ondrop="onDropBoxItem(event)"></div>
						<div class="box-sortable-helper right" ondragenter="onDragOverBoxItem(event)" ondragleave="onDragLeaveBoxItem(event)" ondrop="onDropBoxItem(event)"></div>
						`;
					}

					let lastThumbnailPath = FileUrlHelper.getLastestThumbnailUrl(item);

					if (item.noPreview) {
						templateData.src = "";
						templateData.thumbnailPath = "";
						templateData.backgroundColor = "transparent";
						templateData.resolution = "-";
						templateData.noPreview = item.noPreview;
					}
					else if (item && item.noThumbnail && item.ext === "svg" && item.size >= 10000000) {
						templateData.src = "";
						templateData.thumbnailPath = "";
					}
					else if (item && item.noThumbnail && item.size >= 10000000) {
						templateData.src = "";
						templateData.thumbnailPath = lastThumbnailPath;
					}
					else {
						templateData.src = lastThumbnailPath;
						var supportLargeThumb = { jpg: true, png: true, webp: true, bmp: true, jfif: true };
						if (supportLargeThumb[item.ext] && (!item.orientation || item.orientation === 1) ) {
							// templateData.rawPath = templateData.src.replace("_thumbnail.png", `.${item.ext}`);
							templateData.rawPath = $bodyScope.getRawUrl(item);
						}
						if (
							(item?.animated || item.ext === "gif") && 
							$bodyScope.preferences.habits.alwaysPlayGIF === "on"
						) {
							let rawPath = $bodyScope.getRawUrl(item);
							templateData.rawPath = rawPath;
							templateData.thumbnailPath = rawPath;
							templateData.src = rawPath;
						}
						templateData.thumbnailPath = "";
						// LazyLoadManager 會處理動畫
						// templateData.css += " animate ";
					}

					templateData.typeCSS = templateData.ext;
					templateData.typeValue = templateData.typeCSS.toUpperCase();

					if ("png jpg".indexOf(templateData.ext) === -1) {
						if (item.bpm) {
							templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label ${templateData.typeCSS}">${templateData.typeValue} / BPM: ${parseInt(item.bpm)}</div></div>`;
						}
						else if (item.medium) {
							templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label ${templateData.typeCSS} ${item.medium}">${item.medium.capitalize()}</div></div>`;
						}
						else {
							templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label ${templateData.typeCSS}">${templateData.typeValue}</div></div>`;
						}
					}
					else {
						templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label"></div></div>`;
					}

					if (templateData.ext === "txt") {
						const escapeHtml = (string) => {
							var charMap = {
								'&': '&amp;',
								'<': '&lt;',
								'>': '&gt;',
								'"': '&quot;',
								"'": '&#39;',
								'/': '&#x2F;',
								'`': '&#x60;',
								'=': '&#x3D;'
							};
							return String(string).replace(/[&<>"'`=\/]/g, function (s) {
								return charMap[s];
							});
						};
						templateData.resolution = "-";
						templateData.src = "";
						templateData.thumbnailPath = "";
						var paragraphs = item.text.split("\n");
						paragraphs = paragraphs.map((paragraph) => {
							return escapeHtml(paragraph);
						});
						var paragraphsHTML = "";
						paragraphsHTML += `<h4>${item.name.trim()}</h4>`;
						paragraphs.length = 50;
						paragraphs.forEach(function (paragraph) {
							paragraphsHTML += `<p>${paragraph.trim()}</p>`;
						});
						templateData.txtContent = `<div class="txt-content" draggable="true" ondragend="onDragEndContainer(event)" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)"><div>${paragraphsHTML || ""}</div></div>`;
					}

					// if (index <= 80) {
					// 	templateData.preloadSrc = templateData.thumbnailPath;
						// templateData.css += " animate ";
					// }

					// 💩
					if (item.palettes && item.palettes[0]) {
						templateData.backgroundColor = "rgba(" + item.palettes[0].color[0] + ", " + item.palettes[0].color[1] + ", " + item.palettes[0].color[2] + ", 0.2)";
					}

					if (item.tags && item.tags.length > 0) {
						templateData.css += " tagged ";
					}

					if (item.fontMetas && item.fontMetas.postScriptName) {
						try {
							var key = Object.keys(item.fontMetas.postScriptName)[0];
	                    	var postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
							var fontPath = `${fontFolder}/${postScriptName}.${item.ext}`;
							var activatedLabel = i18n.__("Context.Image.Font.Activate");
							var deactivatedLabel = i18n.__("Context.Image.Font.Deactivate");
							if (fs.existsSync(fontPath)) {
								templateData.css += " activated ";
								templateData.fontActivateBtn = `<div class="activate-btn"></div>`;
							}
							else {
								templateData.fontActivateBtn = `<div class="activate-btn"></div>`;
							}
							templateData.backgroundColor = "rgba(255, 255, 255, 1)";
						}
						catch (err) {}
					}

					if ($bodyScope.preferences.habits.hoverZoom === "on") {
						templateData.hoverZoom = `<div class="zoom-btn"></div>`;
					}

					templateData.aspectRatio = `${templateData.width || 200}/${templateData.height || 200}`;

					if (item.height / item.width >= 2.5) {
						templateData.imgCss += " long";
						templateData.css += " long ";
						templateData.aspectRatio = '';
					}

					if (item.height === item.width) {
						templateData.imgCss += " square";
					}

					if (item.height <= 180 && item.width <= 240) {
						templateData.css += " pixelated ";
					}
					else if (item.height <= 320 || item.width <= 320) {
						templateData.css += " optimize-contrast ";
					}

					if (item.width / item.height >= 2) {
						templateData.imgCss += " panoramic-landscape";
					}

					if (item.orientation && !item.noThumbnail) {
						
						if (item.orientation === 8) {
							templateData.imgCss += " r8 ";
						}
						else if (item.orientation === 7) {
							templateData.imgCss += " r7 ";
						}
						else if (item.orientation === 6) {
							templateData.imgCss += " r6 ";
						}
						else if (item.orientation === 5) {
							templateData.imgCss += " r5 ";
						}
						else if (item.orientation === 4) {
							templateData.imgCss += " r4 ";
						}
						else if (item.orientation === 3) {
							templateData.imgCss += " r3 ";
						}
						else if (item.orientation === 2) {
							templateData.imgCss += " r2 ";
						}

						if (item.orientation > 4) {
							if (item.width < item.height) {
								templateData.imgStyle += ` min-width: ${item.height / item.width * 100}%; `;
							}
							else {
								templateData.imgStyle += ` width: ${item.height / item.width * 100}%; `;
							}
						}
					}
					
					if (item.comments && item.comments.length > 0) {
						templateData.css += " has-annotation ";
					}

					switch ($bodyScope.listMetaType) {
						case 'RESOLUTION':
							if (item.duration && VIDEO_TYPES[item.ext]) {
								templateData.metas = $filter('duration')(item.duration);
							}
							else if (item.duration && AUDIO_TYPES[item.ext]) {				
								templateData.metas = $filter('duration')(item.duration);
							}
							else if (item.fontMetas && FONT_TYPES[item.ext]) {
								templateData.metas = item.fontMetas.weight;
							}
							else if (SPECIAL_TYPES[item.ext]) {
								templateData.metas = `${fileSize(item.size, 1)}`;
							}
							else if (item.noPreview) {
								templateData.metas = `${fileSize(item.size, 1)}`;

							}
							else if (item.ext === "url") {
								if (item.duration) {
									templateData.metas = $filter('duration')(item.duration);
								}
								else {
									templateData.metas = $filter('domainName')(item.url);
								}
							}
							else {
								templateData.metas = `${item.width} × ${item.height}`;
							}
							break;
						case 'FILESIZE':
							templateData.metas = `${fileSize(item.size, 1)}`;
							break;
						case 'TYPE':
							templateData.metas = item.ext.toUpperCase();
							break;
						case 'MTIME':
							var mtime = item.mtime || item.modificationTime;
							templateData.metas = $filter("date")(item.mtime || item.modificationTime, "yyyy/MM/dd HH:mm");
							break;
						case 'BTIME':
							var btime = item.btime || item.modificationTime;
							templateData.metas = $filter("date")(item.btime || item.modificationTime, "yyyy/MM/dd HH:mm");
							break;
						case 'TAGS':
							templateData.metas = "";
							if (item.tags && item.tags.length) {
								var tags = item.tags.map(function (tag) {
									return `<div class="tag color-${$bodyScope.TagManager.tagMappings[tag].color}">${tag.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
								});
								templateData.metas = tags.join("");
								templateData.metas = templateData.metas;
							}
							else {
								templateData.metas = "-";
							}
							break;
						case 'RATING':
							templateData.metas = `<span class="small star">${ratingStrings[item.star]}</span>`
							break;
					}
				}
				catch (err) {
					console.log(err);
					return undefined;
				}
				return getItem(templateData);
			}

			var generateItems = function (items) {
				var arr = [];
				for (var i = 0; i < items.length; ++i) {
					var item = generateItem(items[i], i);
					if (item) {
						arr.push(item);
					}
				}
				return arr;
			}

			resetNgGridLayoutData = (items, cursor, scrollPercentage) => {
				$scope.items = items;
				startCursor = cursor || 0;
				startGroupKey = 1000000 + startCursor;
				resetData(scrollPercentage);
			};

			function resetData (scrollPercentage) {
				if ($("#box-container .box-list").width() === 0) {
					setTimeout(() => resetData(scrollPercentage), 100);
					return;
				}
				
				// 取消正在進行的滾動動畫
				if (scrollAnimationFrame) {
					cancelAnimationFrame(scrollAnimationFrame);
					scrollAnimationFrame = null;
				}
				
				// 清理 LazyLoadManager 的觀察器但保留緩存
				const lazyLoadManager = $bodyScope.lazyLoadManager;
				if (lazyLoadManager) {
					// 軟重置 - 保留緩存
					lazyLoadManager.softReset();
					// 重新初始化觀察器
					lazyLoadManager.initObserver();
				}
				
				if (ig) {
					ig.clear();
					ig.destroy();
					ig = new eg.InfiniteGrid("#box-container .box-list", {
						isOverflowScroll: false,
						threshold: 2000
					});
				}
				NgGridStrings = {};
				// 傳遞 scrollPercentage 到 initData
				initData(scrollPercentage);
			};

			var initDataTimeout;
			var pendingScrollPercentage = null;
			var scrollAnimationFrame = null; // 移到這裡，讓 resetData 也能訪問
			
			function initData (scrollPercentage) {
				if (!$scope.items || $scope.items.length === 0) {
					$("#box-list").css("height", "");
					return;
				}
				// 儲存百分比，在 layoutComplete 後使用
				if (scrollPercentage !== undefined && scrollPercentage !== null) {
					pendingScrollPercentage = scrollPercentage;
				}
				// console.time("initData");
				if (!$bodyScope) $bodyScope = angular.element("body").scope();
				var currentImageSize = $bodyScope.imageSize.height;
				var allLayout = "grid-layout justified-layout list-layout";

				// 瀑布流
				if ($bodyScope.layout === "GridLayout" || $bodyScope.layout === "SquareLayout") {
					$container.removeClass(allLayout).addClass("grid-layout");
					ig.setLayout(eg.InfiniteGrid.GridLayout, {
						margin: 8,
						align: $scope.options.align,
					});
				}
				// 列表模式
				else if ($bodyScope.layout === "ListLayout") {
					$container.removeClass(allLayout).addClass("list-layout");
					ig.setLayout(eg.InfiniteGrid.GridLayout, {
						margin: 0,
						align: $scope.options.align,
					});
				}
				// 谷歌流
				else {
					var cw = $container.width();
					$container.removeClass(allLayout).addClass("justified-layout");
					ig.setLayout(eg.InfiniteGrid.JustifiedLayout, {
						minSize: currentImageSize * 1 - 10,
                    	maxSize: currentImageSize * 1 + 10,
						margin: 8,
						// column: [1, maxColumn]
					});
					// ig._layout.setSize($container.width() - 40);
				}

				var $subFolderContainer = $("#sub-folder-container");
				
				ig.on({
					"prepend": throttle(function(e) {
						var groupKeys = ig.getGroupKeys(true);
						var groupKey = (groupKeys[0] || 0) - 1;

						var items = getItems( ( groupKey + $scope.options.preload - 1 - startGroupKey + startCursor ) * $scope.options.page, $scope.options.page);
						if (items.length > 0) {
							ig.prepend(items, groupKey);
						}

						// Note: 置頂需要重新 relayout 避免第一頁上方參差不齊
						if ($bodyScope.layout === "GridLayout" && groupKey === 999999) {
							ig.layout();
						}

						if (groupKey === 999999) {
							if (!$subFolderContainer.is(":visible")) {
								$subFolderContainer.show();
							}
						}
						return;
					}, 100),
					"append": function(e) {
						var groupKeys = ig.getGroupKeys(true);
						var groupKey = (groupKeys[groupKeys.length - 1] || 0) + 1;
						var items = getItems( ( groupKey + $scope.options.preload - 1 - startGroupKey + startCursor ) * $scope.options.page, $scope.options.page);
						// requestAnimationFrame(() => {
							ig.append(items, groupKey);
						// });
					},
					"layoutComplete": function (e) {
						setTimeout(function () {
							onLayoutComplete(e);
							// 註冊到 LazyLoadManager
							registerToLazyLoadManager(e);
							// 如果有待處理的滾動百分比，立即應用
							if (pendingScrollPercentage !== null) {
								applyScrollPercentage(pendingScrollPercentage);
								pendingScrollPercentage = null;
							}
						}, 100);
					}
				});
				
				// 應用滾動百分比
				function applyScrollPercentage(decimalPart) {
					if (!ig || !ig._items || !ig._items._data) return;
					
					var groups = ig._items._data;
					if (groups.length === 0) return;
					
					// 獲取當前頁面的 group
					var currentGroup = groups[0];
					if (!currentGroup || !currentGroup.outlines) return;
					
					var pageStart = currentGroup.outlines.start[0] || 0;
					var pageEnd = currentGroup.outlines.end[currentGroup.outlines.end.length - 1] || 0;
					var pageHeight = pageEnd - pageStart;
					
					if (pageHeight > 0) {
						// 計算目標滾動位置
						var targetScrollTop = pageStart + (pageHeight * decimalPart);
						var $boxContainer = $("#box-container");
						
						// 使用平滑滾動
						smoothScrollTo($boxContainer[0], targetScrollTop, 200);
					}
				}
				
				// 平滑滾動函數
				function smoothScrollTo(element, targetPosition, duration) {
					// 取消之前的動畫
					if (scrollAnimationFrame) {
						cancelAnimationFrame(scrollAnimationFrame);
						scrollAnimationFrame = null;
					}
					
					const startPosition = element.scrollTop;
					const distance = targetPosition - startPosition;
					
					// 如果距離太小，直接跳轉
					if (Math.abs(distance) < 5) {
						element.scrollTop = targetPosition;
						return;
					}
					
					const startTime = performance.now();
					
					function easeOutCubic(t) {
						return 1 - Math.pow(1 - t, 3);
					}
					
					function animate(currentTime) {
						const elapsed = currentTime - startTime;
						const progress = Math.min(elapsed / duration, 1);
						const easeProgress = easeOutCubic(progress);
						
						element.scrollTop = startPosition + distance * easeProgress;
						
						if (progress < 1) {
							scrollAnimationFrame = requestAnimationFrame(animate);
						} else {
							// 確保最後精確到達目標位置
							element.scrollTop = targetPosition;
							scrollAnimationFrame = null;
						}
					}
					
					scrollAnimationFrame = requestAnimationFrame(animate);
				}
				
				// 註冊元素到 LazyLoadManager
				function registerToLazyLoadManager(e) {
					const lazyLoadManager = $bodyScope.lazyLoadManager;
					if (!lazyLoadManager) return;
					
					e.target.forEach(function(item) {
						if (!item.el || !item.el.parentNode) return;
						
						// 確保元素還沒有被載入
						if (!item.el.classList.contains('show')) {
							lazyLoadManager.observe(item.el);
						}
					});
				}

				function onLayoutComplete (e) {

					var scope = $bodyScope || angular.element("body").scope();
					var selectedMappings = scope.selectedMappings;

					e.target.forEach(function(item) {

						if (!item.el || !item.el.parentNode) {
							// console.log("return")
							return;
						}

						var id = item.el.getAttribute("data-box-id")
						var image = scope.itemMappings[id];

						if (!image) return;

						var $item = $(item.el);
						var classNames = "";

						if (scope.selectedMappings[id]) {
							classNames += "selected ";
						}

						if (image && image.tags && image.tags.length > 0) {
							classNames += "tagged ";
						}

						// 置頂文件圖標
						if (scope.currentFolder && scope.currentFolder.orderBy !== "RANDOM") {
			            	if (image.pinned && image.pinned[scope.currentFolder.id]) {
			            		classNames += "pinned ";
			            	}
						}

						var $img = $item.find("img");
						
						if (classNames !== '') {
							$item.addClass(classNames);
						}

						// let lastThumbnailPath = FileUrlHelper.getLastestThumbnailUrl(image);
						// $img.attr("lsrc", lastThumbnailPath);
						let supportLargeThumb = { jpg: true, png: true, webp: true, bmp: true };
						if (supportLargeThumb[image.ext] && (!image.orientation || image.orientation === 1) ) {
                			$img.attr("raw", $bodyScope.getRawUrl(image));
                		}
                		
						// LazyLoadManager 會處理圖片載入
						// 這裡只設置必要的屬性
						var lazysrc = $img.attr("lazysrc");
						if (lazysrc && lazysrc !== "undefined") {
							$img.attr("lsrc", lazysrc);
						}
					});
				}

				let items;
				// Note: 这里可以决定用户第一眼看到的内容
				if (startCursor === 0 || !$scope.items[startCursor * $scope.options.page]) {
					items = getItems(0 * $scope.options.page, $scope.options.page * ($scope.options.preload) );
					ig.append(items, startGroupKey);
				}
				// Note: 如果使用记忆位置，一次载入两个页面，可以避免画面抖动
				else {
					items = getItems(startCursor * $scope.options.page, $scope.options.page * $scope.options.preload );
					ig.append(items, startGroupKey);
					if (items.length < $scope.options.page) return;
					clearTimeout(initDataTimeout);
					initDataTimeout = setTimeout(() => {
						let nextItems = getItems((startCursor + 1) * $scope.options.page, $scope.options.page * ($scope.options.preload) );
						if (nextItems.length > 0) {
							ig.append(nextItems, startGroupKey + 1);
						}
						else {
							let nextItems2 = getItems((startCursor + 1) * $scope.options.page, $scope.options.page * ($scope.options.preload) );
							if (nextItems2.length > 0) {
								ig.prepend(nextItems2, startGroupKey - 1);
							}
						}
					}, 100);
				}
				
			};

			$scope.$on("gl:reset", function (event, items, cursor) {
				$scope.items = items;
				startCursor = cursor || 0;
				startGroupKey = 1000000 + startCursor;
				resetData();
			});

			$scope.$on("gl:scrollToTop", function () {
				resetData();
			});

			$scope.$on("gl:removeItems", function (event, items) {
				const lazyLoadManager = $bodyScope.lazyLoadManager;
				items.forEach(function (item) {
					// 從 LazyLoadManager 中取消觀察
					if (lazyLoadManager && item.el) {
						lazyLoadManager.unobserve(item.el);
						lazyLoadManager.cancelLoad(item.el);
					}
					ig.remove(item);
				});
				// NOTE: false 就不会造成最上方排版歪
				// ig.layout(false);
				ig.layout(true);
				setTimeout(() => {
					ig._updateContainerHeight();
				}, 100);
			});

			// initData();
		}
	};
}]);
