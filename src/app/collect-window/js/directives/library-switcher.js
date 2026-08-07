EagleApp.directive("librarySwitcher", [
	"$timeout", ($timeout) => {
		return {
			restrict: "E",
			templateUrl: "js/directives/library-switcher.html",
			replace: true,
			scope: {
				theme: "=theme",
				onLibrarySwitching: "=",
				onLibrarySwitched: "=",
				onLibrarySwitchClosed: "=",
			},
			link: ($scope, $element, $attrs) => {
				const extractLibraryName = (path) => {
					const match = path.match(/([^\/]+)\.library$/);
					return match ? match[1] : path.split("/").pop();
				};

				$scope.updateLibrary = async () => {
					const currentLibrary = await eagle.library.info();
					$scope.currentLibrary = currentLibrary.library || {
						name: "",
						path: "",
					};
					$scope.$evalAsync();
				};

				$scope.updateLibrary();

				$element.on("click", async (event) => {
					const currentLibrary = await eagle.library.info();
					const currentPath = currentLibrary.library.path;
					const LibraryPatches = await eagle.library.history();

					ContextMenu.open({
						showSearch: true,
						items: [
							...LibraryPatches.map((libraryPath) => {
								const libraryName = extractLibraryName(libraryPath);
								const parentFolderPath = libraryPath.replace(/[^/]+\.library$/, "");
								const libraryImage = "http://localhost:41595/api/library/icon?libraryPath=" + encodeURIComponent(libraryPath);
								const fallbackImage = "assets/images/base/icons/default-library-icon.png";

								return {
									label: libraryName,
									disabled: libraryPath === currentPath,
									checked: libraryPath === currentPath,
									image: libraryImage,
									fallbackImage: fallbackImage,
									click: async () => {
										// 通知其他元件，Library 即將切換
										$scope.onLibrarySwitching();

										let targetLibraryPath = libraryPath;

										// 切換 Library
										await eagle.library
											.switchPromise(libraryPath)
											.catch(() => {
												// 切換失敗，保持原本的 Library
												targetLibraryPath = currentPath;
											})
											.finally(() => {
												// 更新 Library 資訊
												$scope.updateLibrary();

												// 通知其他元件，Library 已經切換
												$scope.onLibrarySwitched({ libraryPath: targetLibraryPath });
											});
									},
								};
							}),
						],
						onClosed: () => {
							$scope.onLibrarySwitchClosed();
							$scope.$evalAsync();
						},
					});
				});
			},
		};
	},
]);
