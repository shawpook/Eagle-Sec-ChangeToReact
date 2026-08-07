class GeneralTagSelectPanel {
    static open(params) {
        const $rootScope = angular.element("html").scope();
        $rootScope.$broadcast('GENERAL.TAG.SELECT.PANEL.OPEN', params);
    }
}

EagleApp.directive('generalTagSelectPanel', ($timeout) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/general-tag-select-panel.html',
        replace: false,
        scope: {
            TagManager: '=tagManager',
            selected: '=selected',
            theme: '=theme'
        },
        link: (scope, element) => {

            const $selectPanel = $(element).find('.select-panel');

            // 創建一個新的 TagSelectPanel 實例，用於管理標籤選擇面板的行為
            const panel = new TagSelectPanel({
                showCreateTagBtn: false,
                fixedSize: true,
                scope: scope,
                panelSelector: "general-tag-select-panel .tag-select-panel",
                searchInputSelector: "general-tag-select-panel .panel-header input",
            });

            // 切換面板是否固定在屏幕上
            scope.togglePined = () => {
                scope.panel.isPined = !scope.panel.isPined;
            };

            // 監聽窗口大小改變事件，調整面板位置和尺寸以適應窗口
            const initWindowResize = () => {
                let resizeTimeout;
                $(window).on("resize.inspectTagSelect", () => {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        if (scope.panel.isPined) {

                            if (!$("general-tag-select-panel select-panel").hasClass("open")) return;

                            let windowHeight = $(window).height();
                            let windowWidth = $(window).width();
                            let popupHeight = $selectPanel.height();
                            let popupWidth = $selectPanel.width();
                            let popupTop = $selectPanel.offset().top;
                            let popupLeft = $selectPanel.offset().left;

                            // 確保面板不會超出視窗右邊界
                            if (popupLeft + popupWidth > windowWidth) {
                                let move = popupLeft + popupWidth - windowWidth + 20;
                                $selectPanel.css("left", `${popupLeft - move}px`);
                            }

                            // 確保面板不會超出視窗下邊界
                            if (popupHeight + 60 + popupTop > windowHeight) {
                                popupHeight = windowHeight - 60;
                                const height = Math.max(120, popupHeight - popupTop);
                                $selectPanel.height(height);
                            }
                        }
                    }, 333);
                });
            };

            const initDraggable = () => {
                // 初始化面板的拖動功能，允許用戶拖動面板
                let dragOriginalSize = {};
                $selectPanel.draggable({
                    scroll: false,
                    distance: 5,
                    containment: "body",
                    start: (e, ui) => {
                        dragOriginalSize = {
                            height: ui.helper.outerHeight(),
                            width: ui.helper.outerWidth(),
                        };
                    },
                    stop: () => {
                        $selectPanel.height(dragOriginalSize.height);
                        $selectPanel.width(dragOriginalSize.width);
                        panel.fixedSize = true;
                    }
                });
            };

            const initResizable = () => {
                // 初始化面板的調整大小功能，允許用戶調整面板尺寸
                $selectPanel.resizable({
                    maxWidth: 800,
                    minWidth: 200,
                    minHeight: 160,
                    maxHeight: 920,
                    containment: "body",
                    handles: "n, e, s, w, ne, se, sw, nw",
                    // 保存用戶設置的尺寸到 localStorage
                    stop: (event, ui) => {
                        const height = ui.element.innerHeight();
                        const width = ui.element.innerWidth();
                        localStorage.setItem("eagle.tagsPopup.height", height);
                        localStorage.setItem("eagle.tagsPopup.width", width);
                        panel.height = height;
                        panel.width = width;
                        panel.fixedSize = true;
                    }
                });
            };

            const initWatcher = () => {
                
                // 監聽面板開啟事件，初始化面板內容
                scope.$on('GENERAL.TAG.SELECT.PANEL.OPEN', (event, params) => {
                    $timeout(() => {
                        panel.init(params);
                        scope.panel = panel;
                        scope.listData = panel.listData;
                    }, 10);

                    $timeout(() => {
                        panel.open();
                    }, 0);

                    scope.panel = panel;
                });
            };

            // 初始化事件和監聽器
            const init = () => {
                initDraggable();
                initResizable();
                initWindowResize();
                initWatcher();
            };

            init();
        }
    }
})