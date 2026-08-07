EagleApp.directive('inspectorInformation', ($rootScope) => {
    const fs = require('fs');
    const path = require('path');
    
    return {
        restrict: 'E',
        templateUrl: 'js/directives/inspector-information.html',
        replace: true,
        link: ($scope, element, attrs, controllersArr) => {
            
            // 新增修改擴展名功能
            $scope.changeExtension = function() {
                // 檢查是否只選擇了一個檔案
                if (!$scope.selected || $scope.selected.length !== 1) return;
                
                const item = $scope.selected[0];
                const currentExt = item.ext;
                
                // 使用 swal 彈出對話框
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__("Dialog.ChangeExtension.Title")}</h4>
                            <p class="alert-desc">${i18n.__("Dialog.ChangeExtension.Description")}</p>
                        </div>
                    `,
                    showCloseButton: false,
                    showCancelButton: true,
                    allowOutsideClick: false,
                    focusConfirm: true,
                    focusCancel: false,
                    padding: 24,
                    width: 400,
                    input: 'text',
                    inputPlaceholder: i18n.__('Dialog.ChangeExtension.Placeholder'),
                    inputValue: currentExt,
                    inputValidator: function (value) {
                        return new Promise(function (resolve, reject) {
                            // 驗證輸入：只允許英文字母和數字
                            if (!value || value.trim() === '') {
                                reject(i18n.__('Dialog.ChangeExtension.EmptyError'));
                            } else if (!/^[a-zA-Z0-9]+$/.test(value)) {
                                reject(i18n.__('Dialog.ChangeExtension.InvalidCharError'));
                            } else if (value.length > 10) {
                                reject(i18n.__('Dialog.ChangeExtension.TooLongError'));
                            } else {
                                resolve();
                            }
                        });
                    },
                    onOpen: function () {
                        setTimeout(function () {
                            let input = swal.getInput();
                            if (input) {
                                $(input).select().focus();
                            }
                        }, 100);
                    },
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__("Dialog.ChangeExtension.Confirm"),
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(function (newExt) {
                    const newExtLower = newExt.toLowerCase();

                    if (!newExtLower || newExtLower === currentExt) return;
                    
                    const libraryPath = $bodyScope.libraryPath;
                    const oldFilePath = path.join(libraryPath, 'images', item.id + '.info', item.name + '.' + currentExt);
                    
                    const dir = path.dirname(oldFilePath);
                    const nameWithoutExt = path.basename(oldFilePath, '.' + currentExt);
                    const newFilePath = path.join(dir, nameWithoutExt + '.' + newExtLower);


                    electronLog.info('[App] User change file %s to %s', oldFilePath, newFilePath);
                    
                    // Step 1: 修改實際檔案名稱
                    fs.rename(oldFilePath, newFilePath, function(err) {
                        if (err) {
                            electronLog.error('[App] Failed to rename file:', err);
                            swal({
                                type: 'error',
                                title: i18n.__('Dialog.ChangeExtension.ErrorTitle'),
                                text: i18n.__('Dialog.ChangeExtension.ErrorMessage'),
                                confirmButtonText: i18n.__('general.ok')
                            });
                            return;
                        }
                        electronLog.info('[App] File extension change successfully');


                        
                        // Step 2: 更新 item 屬性
                        item.ext = newExtLower;
                        
                        // Step 3: 同步變更到背景進程
                        // ayncsImagesChange 函數定義在 app.js 中，需要從全域存取
                        if (typeof ayncsImagesChange === 'function') {
                            ayncsImagesChange([item]);
                        }
                        $bodyScope.updateItemListView(item);
                        
                        // Step 4: 更新 UI
                        $bodyScope.$evalAsync();
                    });
                }, function () {
                    // 使用者取消
                });
            };
        }
    }
});