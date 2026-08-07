EagleApp.directive('folderPasswordModal', function ($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/folder-password-modal.html',
        scope: {
            theme: '=theme'
        },
        link: function ($scope, element, attrs, controllersArr) {

            const $bodyScope = angular.element("body").scope();

            $scope.folderPwdScope = $scope;
            $scope.isOpen = false;
            $scope.mode = "change";    // new change reset
            $scope.folder;

            $scope.oldPassword = "";
            $scope.newPassword = "";
            $scope.newRePassword = "";
            $scope.passwordTips = "";

            $scope.$on("SET-FOLDER-PASSWORD", (e, params) => {

                $scope.folder = params.folder;
                $scope.mode = params.mode;
                $scope.isOpen = true;

                $timeout(() => {
                    $(".folder-password-modal input:visible").eq(0).focus();
                }, 300);
            });

            function setNewPassword() {
                var newPassword = $scope.newPassword;
                var newRePassword = $scope.newRePassword;
                var passwordTips = $scope.passwordTips;
                if (newPassword && newRePassword && newPassword === newRePassword) {
                    var endcodePassword = window.btoa(newPassword);
                    $scope.folder.password = endcodePassword;
                    $scope.folder.isUnlock = false;
                    $scope.folder.passwordTips = passwordTips;
                    console.log(endcodePassword);
                    $bodyScope.updateSidebarList();
                    $bodyScope.calculateImageBinding({ ignoreSort: true }, () => {
                        $bodyScope.rebindRefresh();
                    });
                    $bodyScope.saveFolder();
                    close();
                    electronLog && electronLog.info(`[app] 设置文件夹密码：${$scope.folder.name}(${$scope.folder.id})`);
                }
                else {
                    // 界面提示缺少
                    $("#new-folder-password-input").focus();
                    $("#new-folder-password-input").addClass("animation--shake-horizontal constant");
                    setTimeout(() => {
                        $("#new-folder-password-input").removeClass("animation--shake-horizontal constant");
                    }, 350);
                }
            };

            function chnagePassword() {
                var oldPassword = $scope.oldPassword;
                var newPassword = $scope.newPassword;
                var newRePassword = $scope.newRePassword;
                var passwordTips = $scope.passwordTips;
                // 判断是否有填写
                if (oldPassword && newPassword && newRePassword && newPassword === newRePassword) {
                    // 新旧密码验证
                    if (
                        oldPassword === window.atob($scope.folder.password) ||
                        oldPassword && oldPassword === Registration?.license?.code
                    ) {
                    // if (window.atob($scope.folder.password) === oldPassword) {
                        var endcodePassword = window.btoa(newPassword);
                        $scope.folder.password = endcodePassword;
                        $scope.folder.isUnlock = false;
                        $scope.folder.passwordTips = passwordTips;
                        $bodyScope.calculateImageBinding({ ignoreSort: true }, () => {
                            $bodyScope.rebindRefresh();
                        });
                        $bodyScope.saveFolder();
                        close();
                        electronLog && electronLog.info(`修改文件夹密码：${$scope.folder.name}(${$scope.folder.id})`);
                    }
                    // 界面提示密码错误
                    else {
                        $("#change-folder-password-input").focus();
                        $("#change-folder-password-input").addClass("animation--shake-horizontal constant");
                        setTimeout(() => {
                            $("#change-folder-password-input").removeClass("animation--shake-horizontal constant");
                        }, 350);
                    }
                }
                else {
                    // 界面提示缺少
                }
            };

            function resetPassword() {
                var oldPassword = $scope.oldPassword;
                try {
                    if (Registration?.license?.email) {
                        email = Registration.license.email;
                    }
                } catch (err) { }

                // 判断是否有填写
                if (
                    oldPassword && oldPassword === window.atob($scope.folder.password) ||
                    oldPassword && oldPassword === Registration?.license?.code
                ) {
                    delete $scope.folder.password;
                    delete $scope.folder.isUnlock;
                    delete $scope.folder.passwordTips;
                    $bodyScope.updateSidebarList();
                    $bodyScope.calculateImageBinding({ ignoreSort: true }, () => {
                        $bodyScope.rebindRefresh();
                    });
                    $bodyScope.saveFolder();
                    close();
                    electronLog && electronLog.info(`移除文件夹密码：${$scope.folder.name}(${$scope.folder.id})`);
                }
                else {
                    $("#reset-folder-password-input").focus();
                    $("#reset-folder-password-input").addClass("animation--shake-horizontal constant");
                    setTimeout(() => {
                        $("#reset-folder-password-input").removeClass("animation--shake-horizontal constant");
                    }, 350);
                }
            };

            $scope.save = () => {
                switch ($scope.mode) {
                    case 'new':
                        setNewPassword();
                        break;
                    case 'change':
                        chnagePassword();
                        break;
                    case 'reset':
                        resetPassword();
                        break;
                }
            };

            $scope.cancel = () => {
                close();
            };

            function close() {
                $scope.isOpen = false;
                $timeout(() => {
                    $scope.oldPassword = "";
                    $scope.newPassword = "";
                    $scope.newRePassword = "";
                    $scope.passwordTips = "";
                }, 200);
            };
        }
    }
});