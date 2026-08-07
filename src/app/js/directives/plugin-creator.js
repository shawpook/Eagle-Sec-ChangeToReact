EagleApp.directive('pluginCreator', function($filter, $timeout, $rootScope) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/plugin-creator.html',
        // scope: {},
        link: function ($scope, element, attrs, controllersArr) {

			$scope.isOpen = false;
			$scope.type = 'window';
			$scope.pluginName = '';

			$scope.chooseType = (type) => {
				$scope.type = type;
			};
			
            $scope.$on("OPEN_PLUGIN_CREATOR", function (event, params) {
				$scope.isOpen = true;
            });

            $scope.close = function () {
				$scope.isOpen = false;
            };

			$scope.create = () => {
				if ($scope.pluginName === '') return;

				dialog.showOpenDialog(currentWindow, {
					filters: [],
                	properties: ['openDirectory', 'createDirectory'],
					multiSelections: false
				}).then(result => {
					try {
						if (result.canceled) return;
						let filePaths = result.filePaths;
						const savedPath = path.normalize(`${filePaths[0]}/${sanitize($scope.pluginName).trim()}`);
						const templateRootPath = path.normalize(`${resourcesPath}/plugin_templates`);
						const templatePath = path.normalize(`${templateRootPath}/${$scope.type}`);
						electronLog.info(`[app] Create Plugin to ${savedPath}, name: ${$scope.pluginName}, type: ${$scope.type}.`);
						if (fs.existsSync(savedPath)) {
							swal({
								html: `
									<div class="alert">
										<div class="alert-icon warning"></div>
										<h4 class="alert-title">${i18n.__('modal.createPlugin.dialog.exists.title')}</h4>
										<p class="alert-desc">${i18n.__('modal.createPlugin.dialog.exists.desc')}</p>
									</div>
								`,
								showCloseButton: false, showConfirmButton: true, showCancelButton: false, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
								width: 400,
								customClass: "alert-box",
								cancelButtonColor: "#777777",
								confirmButtonText: i18n.__("general.ok"),
							}).then(function () {});
							return;
						}
						if (fs.existsSync(templatePath)) {
							fse.copySync(templatePath, savedPath);
							if (fs.existsSync(savedPath)) {
								const manifestPath = path.normalize(`${savedPath}/manifest.json`);
								let json = fs.readFileSync(manifestPath, 'utf8');
								let manifest = JSON.parse(json);
								manifest.id = crypto.randomUUID();
								manifest.name = $scope.pluginName;
								fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4), 'utf8');
								let theme  = $filter('themePath')($bodyScope.theme);
								swal({
									html: `
										<div class="alert">
											<div class="alert-icon" style="background-image: url('assets/images/base/icons/ic-plugin-modal-created.png')">
												<img class="status" style="width: 20px; height: 20px;" src="assets/images/${theme}/icons/ic-plugin-install-modal-created.svg">
											</div>
											<h4 class="alert-title">${i18n.__('dialog.pluginCreated.title')}</h4>
											<p class="alert-desc">${i18n.__('dialog.pluginCreated.desc')}</p>
										</div>
									`,
									showCloseButton: false, showConfirmButton: true, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
									width: 400,
									customClass: "alert-box large",
									cancelButtonColor: "#777777",
									confirmButtonText: i18n.__("dialog.pluginCreated.btn"),
									cancelButtonText: i18n.__("general.close"),
								}).then(function () {
									ipcRenderer.send('show-item-in-folder', savedPath);
								});
								pluginModule.localPlugin.load(savedPath);
								$scope.close();
								$scope.pluginName = '';
								electronLog.info(`[app] New Plugin created.`);
								return;
							}
						}
					}
					catch (err) {
						alert(err);
						electronLog.error(`[app] Create Plugin fail.`);
						electronLog.error(err.stack || err);
					}
				});
			};
        }
    };
});