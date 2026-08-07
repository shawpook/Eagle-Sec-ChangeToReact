EagleApp.directive('libraryIcon', function($timeout, $rootScope) {
    return {
        restrict: 'A',
        link: function ($scope, element, attrs, controllersArr) {
            let libraryPath = attrs.libraryPath;
            $scope.$on("UPDATE_LIBRARY_ICON", function (event, path) {
                if (libraryPath === path) {
                    init();
                }
            });
            // watch attrs libraryPath change
            attrs.$observe('libraryPath', function (value) {
                libraryPath = value;
                init();
            });
            
            function init () {
                let iconPath = path.normalize(`${libraryPath}/icon.png`);
                let iconUrl = URL_MODULE.pathToFileURL(iconPath).href;
                $scope.iconUrl = iconUrl;
                fs.exists(libraryPath, function (isExists) {
                    let $item = $(`.check-item`).has(element);
                    if (!isExists) {
                        $item.addClass("missing");
                        element.html(`<img src="assets/images/base/icons/ic-library-missing-warning.svg" style="position: absolute; right: -2px; bottom: -2px;">`);
                        element.css("background-image", `url(assets/images/base/icons/ic-library-missing.svg)`);
                        return;
                    }
                    else {
                        $item.removeClass("missing");
                        element.html(``);
                    }
                    fs.exists(iconPath, function (isExists) {
                        if (isExists) {
                            element.css("background-image", `url('${iconUrl}?v=${Date.now()}')`);
                        }
                        else {
                            if (attrs.libraryIcon === "small") {
                                element.css("background-image", `url(assets/images/base/icons/ic-library-small.png)`);
                            }
                            else {
                                element.css("background-image", `url(assets/images/base/icons/ic-library-default.png)`);
                            }
                        }
                    });
                });
            }
            init();
        }
    }
});