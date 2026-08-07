EagleApp.factory('PluginCenterFactory', function () {

	const getBestURL = require(appRoot.path + '/app/js/utils/getBestURL.js');
	const pjson = require(appRoot + '/package.json');
	const JSON_URL_CATEGORY = `https://community-en.eagle.cool/api/plugin/categories?locale=${preferences.general.language}&build=${pjson.buildVersion}`;
	const JSON_URL_PLUGINS = `https://community-en.eagle.cool/api/plugin/list?locale=${preferences.general.language}&build=${pjson.buildVersion}`;

	let data = {
		categories: [],
		plugins: []
	};

	async function init() {
		const options = {
			cache: 'no-store'
		};
		try {
			data.categories = (await fetch(await getBestURL([{ url: JSON_URL_CATEGORY, delay: 0 }]) ?? JSON_URL_CATEGORY, options).then((response) => { return response.json(); })).data;
			data.plugins = (await fetch(await getBestURL([{ url: JSON_URL_PLUGINS, delay: 0 }]) ?? JSON_URL_PLUGINS, options).then((response) => { return response.json(); })).data;
		} catch (error) {
			electronLog.error(`[plugin] Can't load plugin list or category list.`);
		}
	}

	(async () => {
		await init();
	})();

	// 公開 data 對象和 init 函數
	return {
		getData: function () {
			return data;
		},
		reloadData: init
	};
});


EagleApp.directive('pluginCenter', ($timeout, $rootScope, $filter, PluginCenterFactory) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/plugin-center.html',
        scope: {},
        link: ($scope, element, attrs, controllersArr) => {
			const getBestURL = require(appRoot.path + '/app/js/utils/getBestURL.js');
			const shell = require('electron').shell;
			$scope.parent = angular.element("body").scope();
			$scope.isOpen = false;
			$scope.searchKeyword = "";
			$scope.categories = [];
			$scope.plugins = [];
			$scope.resultList = [];
			$scope.needUpdatePlugins = [];
            $scope.currentPluginId;
			$scope.pluginDetails = {};
			$scope.currentTab = 'detail';
			$scope.pluginModule = $scope.$parent.pluginModule;
			$scope.officialPluginMap = {}; // 官方插件快取 Map，實現 O(1) 查詢

			// 排序相關
			$scope.sortBy = 'default';
			$scope.isSortDropdownOpen = false;
			$scope.sortOptions = [
				{ value: 'default', label: i18n.__('modal.pluginCenter.sort.default') },
				{ value: 'downloads', label: i18n.__('modal.pluginCenter.sort.downloads') },
				{ value: 'developer', label: i18n.__('modal.pluginCenter.sort.developer') },
				{ value: 'updatedAt', label: i18n.__('modal.pluginCenter.sort.updatedAt') },
			];
			$scope.currentSortOption = $scope.sortOptions[0];
			
			$scope.toggleSortDropdown = ($event) => {
				$event.stopPropagation();
				$scope.isSortDropdownOpen = !$scope.isSortDropdownOpen;
			};

			$scope.setSortBy = (option, $event) => {
				$event.stopPropagation();
				$scope.sortBy = option.value;
				$scope.currentSortOption = option;
				$scope.isSortDropdownOpen = false;
				$scope.calculateList();
			};

			// 點擊外部關閉排序下拉選單
			$(document).on('click.pluginCenterSort', () => {
				if ($scope.isSortDropdownOpen) {
					$scope.isSortDropdownOpen = false;
					$scope.$evalAsync();
				}
			});

			$scope.$on('$destroy', () => {
				$(document).off('click.pluginCenterSort');
			});

			// 攔截 detail 區塊內所有連結點擊，使用外部瀏覽器開啟
			element.on('click', '.page.detail a', function(event) {
				event.preventDefault();
				event.stopPropagation();
				const href = $(this).attr('href');
				if (href && href !== '#') {
					shell.openExternal(href);
				}
			});
			
			// 建立官方插件快取，提升查詢效能
			$scope.buildOfficialPluginCache = function(plugins) {
				$scope.officialPluginMap = {};
				
				// 一次性遍歷所有插件，建立快取
				plugins.forEach(plugin => {
					if (!plugin || !plugin.id) return;
					
					// 檢查多個可能的欄位
					const email = plugin?.author?.email || '';
					const contact = plugin?.contact || '';
					
					// 判斷是否為官方插件並快取結果
					if (email.includes('eagle.cool') || contact.includes('eagle.cool')) {
						$scope.officialPluginMap[plugin.id] = true;
					}
				});
			};
			
			$scope.init = () => {
				return new Promise(async (resolve, reject) => {
					$scope.isLoading = true;
					loadRemoteData().then((result) => {
						$scope.plugins = result.plugins;
						
						// 預先計算所有插件的相容性
						$scope.plugins.forEach(plugin => {
							plugin.isCompatible = $scope.isPluginCompatible(plugin);
						});
						
						// 建立官方插件快取
						$scope.buildOfficialPluginCache($scope.plugins);
						
						$scope.categories = [
                            {
                                id: "all",
                                slug: "all",
                                name: i18n.__('modal.pluginCenter.sidebar.all')
                            },
							...result.categories,
							{
								id: "update",
                                slug: "update",
								name: i18n.__('modal.pluginCenter.sidebar.updates')
							}
						];
						$scope.calculateNeedUpdate();
						$scope.selectedCategory = $scope.categories[0];
						$scope.calculateList();
						$scope.isLoading = false;
						$scope.$evalAsync();
						return resolve();
					});
				});
			};

            setTimeout(() => {
				$scope.init();
			}, 2000);

			$scope.openPlugin = async (plugin) => {
                $scope.currentPluginId = plugin.id;
                if (!$scope.pluginDetails[plugin.id]) {
                    $scope.pluginDetails[plugin.id] = plugin;
                }
                $scope.pluginDetails[plugin.id] = await loadDetailData(plugin.id);
                
                // 預先計算相容性
                $scope.pluginDetails[plugin.id].isCompatible = $scope.isPluginCompatible($scope.pluginDetails[plugin.id]);
                
                $scope.$evalAsync();
			};

            $scope.openPluginById = async (pluginId) => {
                $scope.currentPluginId = pluginId;
                $scope.pluginDetails[pluginId] = await loadDetailData(pluginId);
                
                // 預先計算相容性
                $scope.pluginDetails[pluginId].isCompatible = $scope.isPluginCompatible($scope.pluginDetails[pluginId]);
                
                $scope.$evalAsync();
			};

			$scope.closeDetailPage = () => {
				$scope.currentPluginId = undefined;
			};

			// 分段式 tabs 滑動指示器
			$scope.tabIndicatorStyle = {};
			$scope.switchTab = (tab) => {
				$scope.currentTab = tab;
				$timeout(() => {
					const container = element[0].querySelector('.segmented-tabs');
					if (!container) return;
					const tabs = container.querySelectorAll('.tab');
					const activeIndex = tab === 'logs' ? 1 : 0;
					const activeTab = tabs[activeIndex];
					if (!activeTab) return;
					$scope.tabIndicatorStyle = {
						width: activeTab.offsetWidth + 'px',
						transform: 'translateX(' + activeTab.offsetLeft + 'px)'
					};
					$scope.$evalAsync();
				}, 0);
			};

			// 初始化指示器位置
			$scope.$watch('currentPluginId', (newVal) => {
				if (newVal) {
					$scope.currentTab = 'detail';
					$timeout(() => $scope.switchTab('detail'), 100);
				}
			});

			$scope.changeCategory = (category) => {
				$scope.selectedCategory = category;
				$scope.calculateList();
			};

			$scope.onKeywordChanged = (event) => {
				$scope.calculateList();
			};

			$scope.calculateList = () => {
				$scope.resultList = $scope.plugins.unique();
				if ($scope.searchKeyword !== "") {
					let keywords = $scope.searchKeyword.split(" ");
					$scope.resultList = $scope.resultList.filter((item) => {
						let allKeywords = "";
						allKeywords += item.name;
						if (item?.author?.name) {
							allKeywords += " " + item.author.name;
						}
						if (item?.tags?.length > 0) {
							allKeywords += item.tags.join(" ");
						}
						if (item?.exts?.length > 0) {
							allKeywords += item.exts.join(" ");
						}
						for (let i = 0; i < keywords.length; i++) {
							const keyword = keywords[i];
							if (allKeywords.toLowerCase().includes(keyword.toLowerCase())) return true;
						}
						return false;
					});
                }
				if ($scope.selectedCategory) {
					if ($scope.selectedCategory.slug === 'update') {
						$scope.resultList = $scope.resultList.filter((item) => {
							return $scope.pluginModule.needUpdatePluginMaps[item.id];
						});
						$scope.applySorting();
						return;
					}
					if ($scope.selectedCategory.slug !== "all") {
						$scope.resultList = $scope.resultList.filter((item) => {
							return item.categories.includes($scope.selectedCategory.slug);
						});
					}
				}
				$scope.applySorting();
			};

			$scope.applySorting = () => {
				if ($scope.sortBy === 'default') return;

				$scope.resultList.sort((a, b) => {
					switch ($scope.sortBy) {
						case 'downloads':
							return (b.downloads || 0) - (a.downloads || 0);
						case 'developer': {
							const aIsOfficial = $scope.officialPluginMap[a.id] ? 1 : 0;
							const bIsOfficial = $scope.officialPluginMap[b.id] ? 1 : 0;
							if (aIsOfficial !== bIsOfficial) return bIsOfficial - aIsOfficial;
							const aName = (a.author?.name || '').toLowerCase();
							const bName = (b.author?.name || '').toLowerCase();
							const nameCompare = aName.localeCompare(bName);
							if (nameCompare !== 0) return nameCompare;
							return (b.downloads || 0) - (a.downloads || 0);
						}
						case 'updatedAt': {
							const aTime = a.lasteVersion?.createdAt || 0;
							const bTime = b.lasteVersion?.createdAt || 0;
							return bTime - aTime;
						}
						default:
							return 0;
					}
				});
			};
            
            ipcRenderer.on('install-plugin', async (event, pluginId) => {
				currentWindow.show();
				await $scope.open();
				try { await $scope.openPluginById(pluginId); } catch (e) {}
				$scope.$evalAsync();

				if (!$scope.pluginDetails[pluginId]) {
					await new Promise(resolve => setTimeout(resolve, 100));
					swal({
						html: `
							<div class="alert">
								<div class="alert-icon info"></div>
								<h4 class="alert-title">${i18n.__('dialog.plugin.notAvailable.title')}</h4>
								<p class="alert-desc">${i18n.__('dialog.plugin.notAvailable.desc')}</p>
							</div>
						`,
						showCloseButton: false,
						showCancelButton: false,
						allowOutsideClick: false,
						focusConfirm: true,
						padding: 24,
						width: 400,
						customClass: "alert-box",
						confirmButtonText: i18n.__("general.ok"),
					});
				}
            });

			ipcRenderer.on('open-plugin-center-and-search', (event, keyword) => {
				currentWindow.show();
                $scope.open();
				$scope.closeDetailPage();
                $scope.searchKeyword = keyword;
                $scope.$evalAsync();
            });

            $scope.$on("OPEN_PLUGIN_CENTER", async (event, categoryId) => {
				await $scope.open(categoryId);
				$scope.$evalAsync();
            });

			$scope.$on("OPEN_PLUGIN_CENTER_DETAIL", async (event, pluginId) => {
				await $scope.open();
				try { await $scope.openPluginById(pluginId); } catch (e) {}
				$scope.$evalAsync();
            });

			$scope.$on("REFRESH_PLUGIN_CENTER", async (event, categoryId) => {
				$scope.calculateList();
				$scope.calculateNeedUpdate();
				$scope.$evalAsync();
            });

            $scope.open = async (categoryId) => {
                $scope.isOpen = true;
				if ($scope.plugins.length === 0) {
					$scope.isLoading = true;
					await $scope.init();
				}
				else {
					$scope.calculateList();
					$scope.calculateNeedUpdate();
				}
				$timeout(() => {
					$(`.category-${categoryId || 'all'}`).click();
				}, 30);
            };

            $scope.close = () => {
				$scope.isOpen = false;
            };

			$scope.installPlugin = async (plugin) => {

                let desc = $filter('i18n')('dialog.installPlugin.desc', [
                    { "property": "name", "value": plugin.name },
                    { "property": "version", "value": `v${plugin.lasteVersion.version}` },
                ]);
				let theme  = $filter('themePath')($bodyScope.theme);
                let size = fileSize(plugin.lasteVersion.fileSize);

				swal({
					html: `
						<div class="alert">
							<div class="alert-icon" style="background-image: url('${plugin.lasteVersion.logo}')">
								<img class="status" style="width: 20px; height: 20px;" src="assets/images/${theme}/icons/ic-plugin-install-modal-download.svg">
							</div>
							<h4 class="alert-title">${i18n.__('dialog.installPlugin.title')}</h4>
							<p class="alert-desc">${desc}</p>
						</div>
					`,
					showCloseButton: false, showConfirmButton: true, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
					width: 400,
					customClass: "alert-box large",
					cancelButtonColor: "#777777",
					confirmButtonText: `${i18n.__('dialog.installPlugin.install')}<span class="small font-mono">(${size})</span>`,
					cancelButtonText: i18n.__("general.cancel"),
				}).then(async () => {
					await pluginModule.remotePlugin.install(plugin);
					$scope.calculateNeedUpdate();
				});
			};

			$scope.updatePlugin = async (plugin) => {

                let desc = $filter('i18n')('dialog.updatePlugin.desc', [
                    { "property": "name", "value": plugin.name },
                    { "property": "version", "value": `v${plugin.lasteVersion.version}` },
                ]);
				let theme  = $filter('themePath')($bodyScope.theme);
                let size = fileSize(plugin.lasteVersion.fileSize);
                    
				swal({
					html: `
						<div class="alert">
							<div class="alert-icon" style="background-image: url('${plugin.lasteVersion.logo}')">
								<img class="status" style="width: 20px; height: 20px;" src="assets/images/${theme}/icons/ic-plugin-install-modal-update.svg">
							</div>
							<h4 class="alert-title">${i18n.__('dialog.updatePlugin.title')}</h4>
							<p class="alert-desc">${desc}</p>
						</div>
					`,
					showCloseButton: false, showConfirmButton: true, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
					width: 400,
					customClass: "alert-box large",
					cancelButtonColor: "#777777",
					confirmButtonText: `${i18n.__('dialog.updatePlugin.update')}<span class="small font-mono">(${size})</span>`,
					cancelButtonText: i18n.__("general.cancel"),
				}).then(async () => {
					await pluginModule.remotePlugin.install(plugin);
					$scope.calculateNeedUpdate();
				});
			};

			$scope.onInstalledClick = ($event, plugin) => {
				$event.stopPropagation();
				const installed = pluginModule.installedPluginMaps[plugin.id];
				if (!installed) return;
				const isDisabled = pluginModule.isPluginDisabled(plugin.id);
				const isNonLaunchable = plugin.categories && (plugin.categories.includes('inspector') || plugin.categories.includes('format'));

				ContextMenu.open({
					items: [
						{
							visible: !isDisabled,
							label: i18n.__('modal.pluginCenter.contextMenu.launch'),
							disabled: isNonLaunchable,
							click: () => {
								pluginModule.open(installed);
								$scope.$evalAsync();
							}
						},
						{
							label: isDisabled
								? i18n.__('modal.pluginPanel.contextMenu.enablePlugin')
								: i18n.__('modal.pluginPanel.contextMenu.disablePlugin'),
							click: () => {
								if (isDisabled) { pluginModule.enablePlugin(installed); }
								else { pluginModule.disablePlugin(installed); }
								$scope.$evalAsync();
							}
						},
						{ role: 'separator' },
						{
							label: i18n.__('modal.pluginCenter.contextMenu.remove'),
							click: () => {
								$scope.uninstall(plugin);
								$scope.$evalAsync();
							}
						}
					],
				});
			};

			$scope.uninstall = async (plugin) => {
				let installed = pluginModule.installedPluginMaps[plugin.id];
                let desc = $filter('i18n')('dialog.removePlugin.desc', [
                    { "property": "name", "value": installed.manifest.name },
                ]);
				let theme  = $filter('themePath')($bodyScope.theme);
				swal({
					html: `
						<div class="alert">
							<div class="alert-icon" style="background-image: url('${plugin.lasteVersion.logo}')">
								<img class="status" style="width: 20px; height: 20px;" src="assets/images/${theme}/icons/ic-plugin-install-modal-uninstall.svg">
							</div>
							<h4 class="alert-title">${i18n.__('dialog.removePlugin.title')}</h4>
							<p class="alert-desc">${desc}</p>
						</div>
					`,
					showCloseButton: false, showConfirmButton: true, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
					width: 400,
					customClass: "alert-box large",
					cancelButtonColor: "#777777",
					confirmButtonText: `${i18n.__('dialog.removePlugin.remove')}`,
					cancelButtonText: i18n.__("general.cancel"),
				}).then(async () => {
					pluginModule.remotePlugin.uninstall(installed);
				});

			};

			$scope.calculateNeedUpdate = () => {
				const versionCompare = require('compare-versions');
				$scope.needUpdatePlugins = [];
				$scope.pluginModule.needUpdatePluginMaps = {};
				$scope.plugins.forEach((plugin) => {
					// 檢查是否需要更新
					if (pluginModule.installedPluginMaps[plugin.id]) {
						let existsPlugin = pluginModule.installedPluginMaps[plugin.id].manifest;
						if (versionCompare(existsPlugin.version, plugin.lasteVersion.version) === -1) {
							$scope.needUpdatePlugins.push(plugin);
							$scope.pluginModule.needUpdatePluginMaps[plugin.id] = plugin;
						}
					}
				});
				$scope.pluginModule.needUpdatePluginCount = Object.keys($scope.pluginModule.needUpdatePluginMaps).length;
			};

			$scope.isPluginCompatible = (plugin) => {
				if (!plugin) return false;
				
				const currentPlatform = (process.platform === 'win32') ? 'win' : 'mac';
				const currentArch = process.arch;
				
				const pluginPlatform = plugin.platform || 'all';
				const pluginArch = plugin.arch || 'all';
				
				const platformMatch = (pluginPlatform === 'all') || (pluginPlatform === currentPlatform);
				const archMatch = (pluginArch === 'all') || (pluginArch === currentArch);
				
				return platformMatch && archMatch;
			};

			$scope.reload = async () => {
				$scope.init();
			};

			async function loadRemoteData () {
				return new Promise(async (resolve, reject) => {
					try {
						if (PluginCenterFactory.getData().plugins.length === 0) {
							await PluginCenterFactory.reloadData();
						}

						let categories = PluginCenterFactory.getData().categories;
						let plugins = PluginCenterFactory.getData().plugins;

						const platform = (process.platform === 'win32')? 'win' : 'mac';
						const arch = process.arch;

						plugins = plugins.filter((plugin) => {
							const samePlatform = (plugin.platform === platform) || (plugin.platform === 'all');
							const sameArch = (plugin.arch === arch) || (plugin.arch === 'all');
							if (samePlatform && sameArch) return true;
							return (plugin.arch === arch && plugin.platform === platform);
						});

						return resolve({
							categories: categories,
							plugins: plugins
						});
					} catch (error) {
						electronLog.error(`[plugin] Can't load plugin list or category list.`);
						electronLog.error(error);
						return reject(error);
					}
				});
			}

            async function loadDetailData (pluginId) {
				return new Promise(async (resolve, reject) => {
					const options = {
						cache: 'no-store'
					};
                    const JSON_URL = `https://community-en.eagle.cool/api/plugin/${pluginId}?locale=${preferences.general.language}`;
					let result = await fetch(await getBestURL([{ url: JSON_URL, delay: 0 }]) ?? JSON_URL, options).then((response) => { return response.json(); });

                    fetch(`https://community-en.eagle.cool/api/plugin/${pluginId}/view`, { method: 'POST' });
					return resolve(result.data);
				});
			}

        }
    };
});