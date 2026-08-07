EagleApp.directive('webpConvertProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/webp-convert-progress.html',
        scope: {},
        link: ($scope, element, attrs, controllersArr) => {

            $scope.webpConvertQueue = [];
            $scope.webpConvertFinishQueue = [];

            $scope.cancelWebpConvert = () => {
                IPCHelper.send('cancel.webp.convert');
                $scope.webpConvertQueue = [];
                $scope.webpConvertFinishQueue = [];
            };

            $scope.$on('WEBP_CONVERT_START', (e, { images, format }) => {
                if (!images || images.length === 0 || !format) return;
                var webpConvertTasks = [];
                images.forEach((image) => {
                    if (image && image.ext === "webp") {
                        webpConvertTasks.push({
                            image: image,
                            format: format
                        });
                    }
                });
                var message = $filter('i18n')("dialog.webpConvert.desc", [
                    { "property": "count", "value": webpConvertTasks.length },
                    { "property": "format", "value": format.toUpperCase() }
                ]);
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__("dialog.webpConvert.title")}</h4>
                            <p class="alert-desc">${message}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__("dialog.webpConvert.button"),
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(() => {
                    webpConvertTasks.forEach((task) => {
                        $scope.webpConvertQueue.push(task.image);
                    });
                    if (webpConvertTasks.length > 0) {
                        ayncsWebpConvert(webpConvertTasks);
                    }
                    $scope.$evalAsync();
                });
            });

            ipcRenderer.on('webp.converted', (e, converted) => {

                $scope.webpConvertFinishQueue.push(converted);

                if ($scope.webpConvertFinishQueue.length === $scope.webpConvertQueue.length) {
                    $scope.webpConvertFinishQueue = [];
                    $scope.webpConvertQueue = [];
                }

                $scope.$evalAsync();
            });

            function ayncsWebpConvert (tasks) {
                if (!tasks || tasks.length === 0) return; 
                setTimeout(() => {
                    let total = tasks.length;
                    let once = 20;
                    let loopCount = total / once;
                    let countOfSend = 0;
            
                    function send () {
                        var start = countOfSend * once;
                        var willSendImages = tasks.slice(start, start + once);
                        countOfSend += 1;
                        console.log("第 %d 批傳送，目前進度 %d / %d", countOfSend, willSendImages.length + (countOfSend - 1) * once, total);
                        if (backgroundWindowID === undefined) {
                            ipcRenderer.send('webp-convert', willSendImages);
                        }
                        else {
                            ipcRenderer.sendTo(backgroundWindowID, 'webp-convert', willSendImages);
                        }
                        loop();
                    }
            
                    function loop() {
                        if (countOfSend < loopCount) {
                            window.requestAnimationFrame(send);
                        }
                    }
                    loop();
                }, 0);
            }
        }
    }
});