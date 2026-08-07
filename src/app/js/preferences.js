const appRoot = require('app-root-path');
const i18n = new(require(appRoot + '/i18n'));
const fs = require('fs');
const electron = require('electron');
const remote = require('@electron/remote');
const systemPreferences = remote.systemPreferences;
const AutoLaunch = require('auto-launch');
const PreferenceApp = angular.module("PreferenceApp", ['shortcutInput', 'mgo-mousetrap', 'tippy']);
const isAppleSilicon = (process.platform === 'darwin' && process.arch === 'arm64');
const currentWindow = remote.getCurrentWindow();
const path = require("path");
const URL_MODULE = require(appRoot + '/my_modules/url');
const pluginModule = require(`${appRoot}/app/js/plugin`);
const platform = process.platform;

let preferences;
let $bodyScope;

function throttle(fn, delay, immediate, debounce) {
    var curr = +new Date(), //µ±Ç°ÊÂ¼þ
        last_call = 0,
        last_exec = 0,
        timer = null,
        diff, //Ê±¼ä²î
        context, //ÉÏÏÂÎÄ
        args,
        exec = function() {
            last_exec = curr;
            fn.apply(context, args);
        };
    return function() {
        curr = +new Date();
        context = this,
            args = arguments,
            diff = curr - (debounce ? last_call : last_exec) - delay;
        clearTimeout(timer);
        if (debounce) {
            if (immediate) {
                timer = setTimeout(exec, delay);
            } else if (diff >= 0) {
                exec();
            }
        } else {
            if (diff >= 0) {
                exec();
            } else if (immediate) {
                timer = setTimeout(exec, -diff);
            }
        }
        last_call = curr;
    }
};

PreferenceApp.directive('searchShow', () => {
    return {
        restrict: 'A',
        link: (scope, element, attrs) => {
            const updateDisplay = () => {
            
                if (scope.currentPanel.name !== 'search') return;

                const keywords = element.attr('search-keywords')?.toLowerCase() ?? '';
                const text = element.text().toLowerCase() + "" + keywords;
                const keyword = attrs.searchShow.toLowerCase();

                if (text.indexOf(keyword) > -1) {
                    element.css('display', 'block');
                } else {
                    element.css('display', 'none');
                }
            };

            // watch for changes in the keyword attribute
            attrs.$observe('searchShow', () => {
                setTimeout(() => {
                    updateDisplay();
                }, 50);
            });
        }
    };
});

PreferenceApp.directive('iframeAutoRetry', function($timeout) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var retryTimer = null;
            var retryDelay = parseInt(attrs.retryDelay, 10) || 2000;
            var maxRetries = parseInt(attrs.maxRetries, 10) || 30;
            var retryCount = 0;
            var healthUrl = attrs.iframeAutoRetry;

            function scheduleRetry() {
                if (retryCount >= maxRetries) return;
                retryTimer = $timeout(function() {
                    retryCount++;
                    fetch(healthUrl, { signal: AbortSignal.timeout(2000) })
                        .then(function(resp) {
                            if (resp.ok) {
                                retryCount = 0;
                                element[0].src = element[0].src;
                            } else {
                                scheduleRetry();
                            }
                        })
                        .catch(function() {
                            scheduleRetry();
                        });
                }, retryDelay);
            }

            element.on('load', function() {
                fetch(healthUrl, { signal: AbortSignal.timeout(2000) })
                    .then(function(resp) {
                        if (!resp.ok) scheduleRetry();
                        else retryCount = 0;
                    })
                    .catch(function() {
                        scheduleRetry();
                    });
            });

            scope.$on('$destroy', function() {
                if (retryTimer) $timeout.cancel(retryTimer);
            });
        }
    };
});

PreferenceApp.directive('selectAll', function() {
    return function(scope, element, attrs) {
        var mousetrap = new Mousetrap(element[0]);
        mousetrap.bind('mod+a', function(event) {
            event && event.stopPropagation();
            element.select();
        });
        mousetrap.bind('esc', function(event) {
            event && event.stopPropagation();
            element.blur();
        });
    }
});

PreferenceApp.filter('themePath', function () {
    return function (theme) {
        if (theme === 'light' || theme === 'lightgray') {
            return 'light';
        }
        else {
            return 'dark';
        }
    };
});

PreferenceApp.filter('mod', function($window) {
    return function(key) {
        if (process.platform != 'darwin') {
            return 'Ctrl';
        } else {
            return '⌘';
        }
    }
});

PreferenceApp.filter('i18n', function($window) {
    return function(key) {
        return i18n.__(key);
    };
});

PreferenceApp.controller("PasswordController", function($scope, $rootScope, $timeout) {

    var ipcRenderer = require('electron').ipcRenderer;
    $bodyScope = angular.element("body").scope();
    $scope.folderPwdScope = $scope;
    $scope.isOpen = false;
    $scope.mode = "change";    // new change reset

    $scope.oldPassword = "";
    $scope.newPassword = "";
    $scope.newRePassword = "";
    $scope.passwordTips = "";
	$scope.apiToken = "";

    // $scope.mode = "change";
    $rootScope.$on("SET-APP-PASSWORD", function (event, mode) {
        $scope.isOpen = true;
        $scope.mode = mode;
    });

    function setNewPassword () {
        var newPassword = $scope.newPassword;
        var newRePassword = $scope.newRePassword;
        var passwordTips = $scope.passwordTips;
        if (newPassword && newRePassword && newPassword === newRePassword) {
            var endcodePassword = window.btoa(newPassword);
            $bodyScope.preferences.privacy.enable = 'true';
            $bodyScope.preferences.privacy.password = endcodePassword;
            $bodyScope.preferences.privacy.passwordTips = passwordTips;
            console.log(endcodePassword);
            close();
            ipcRenderer.send('electron-info', `[app] Change app password`);
            ipcRenderer.send('chnage-preferences', $bodyScope.preferences);
        }
        else {
            // 界面提示缺少
            $("#new-password-input").focus();
            $("#new-password-input").addClass("animation--shake-horizontal constant");
            setTimeout(function () {
                $("#new-password-input").removeClass("animation--shake-horizontal constant");
            }, 350);
        }
    };

    function chnagePassword () {
        var oldPassword = $scope.oldPassword;
        var newPassword = $scope.newPassword;
        var newRePassword = $scope.newRePassword;
        var passwordTips = $scope.passwordTips;
        const Registration = window.Registration;

        try {
            if (Registration && Registration.license && Registration.license.email) {
                email = Registration.license.email;
            }
        } catch (err) {}

        // 判断是否有填写
        if (
            oldPassword && newPassword && newRePassword && newPassword === newRePassword
        ) {
            // 新旧密码验证
            if (
                window.atob($bodyScope.preferences.privacy.password) === oldPassword ||
                oldPassword && oldPassword === Registration?.license?.code
            ) {
                var endcodePassword = window.btoa(newPassword);
                $bodyScope.preferences.privacy.enable = 'true';
                $bodyScope.preferences.privacy.password = endcodePassword;
                $bodyScope.preferences.privacy.passwordTips = passwordTips;
                close();
                ipcRenderer.send('electron-info', `[app] Change app password`);
                ipcRenderer.send('chnage-preferences', $bodyScope.preferences);
            }
            // 界面提示密码错误
            else {
                $("#change-password-input").focus();
                $("#change-password-input").addClass("animation--shake-horizontal constant");
                setTimeout(function () {
                    $("#change-password-input").removeClass("animation--shake-horizontal constant");
                }, 350);
            }
        }
        else {
            // 界面提示缺少
        }
    };

    $scope.save = function () {
        switch ($scope.mode) {
            case 'new':
                setNewPassword();
                break;
            case 'change':
                chnagePassword();
                break;
        }
    };

    $scope.cancel = function () {
        close();
        if ($scope.mode === 'new') {
            $bodyScope.preferences.privacy.enable = 'false';
        }
        $bodyScope.$evalAsync();
    };

    function close () {
        $scope.isOpen = false;
        $timeout(function () {
            $scope.oldPassword = "";
            $scope.newPassword = "";
            $scope.newRePassword = "";
            $scope.passwordTips = "";
        }, 200);
    };
});

PreferenceApp.controller("PreferencesController", function ($scope, $rootScope, $timeout, $sce) {

    $("body").on('click', 'a', function(event) {
        event && event.preventDefault();
        var shell = require('electron').shell;
        if ($(this).attr("target") == "_blank") {
            var link = this.href;
            shell.openExternal(link);
        }
    });

    var winPath = 'C:/Program Files (x86)/Eagle/Eagle.exe';
    var macPath = '/Applications/Eagle.app';
    var appPath;
    if (process.platform != 'darwin') {
        appPath = winPath;
    } else {
        appPath = macPath;
    }
    var ipcRenderer = require('electron').ipcRenderer;
    var eagleAutoLauncher;

    if (process.platform !== 'darwin') {
        eagleAutoLauncher = new AutoLaunch({
            name: 'Eagle',
            isHidden: true,
        });
    }
    else {
        eagleAutoLauncher = new AutoLaunch({
            name: 'Eagle',
            path: '/Applications/Eagle.app',
            isHidden: true,
        });   
    }
    $scope.keyword = "";

    $scope.$watch("keyword", () => {
        if ($scope.keyword.length === 0) {
            $scope.showSearchEmpty = false;
            return;
        }
        setTimeout(() => {
            const $visibleItems = $(".content").find(".panel-content :visible");
            $scope.showSearchEmpty = $visibleItems.length === 0 && $scope.keyword;
            $scope.$evalAsync();
        }, 100);
    });

    $scope.shortcutKeyword = "";
    $scope.lastPanel = $scope.currentPanel;
    $scope.soundEffect = 'true';
    $scope.platform = process.platform;
    $scope.arch = process.arch;
    $scope.isAppleSilicon = isAppleSilicon;
    
    // Touch ID 支援檢查
    $scope.canUseTouchID = false;
    if (process.platform === 'darwin' && systemPreferences.canPromptTouchID) {
        try {
            $scope.canUseTouchID = systemPreferences.canPromptTouchID();
        } catch (err) {
            console.error('檢查 Touch ID 支援時發生錯誤:', err);
            $scope.canUseTouchID = false;
        }
    }
    $scope.changes = {};
    $scope.searchSidebarItem = {
        name: "search",
        i18n: i18n.__('preferencesWindow.sidebar.searchResult'),
    };
    $scope.keybindGroups = [
        {
            name: 'global',
            conflict: 'all',
            items: [
                { key: 'global.show.eagle' },
                { key: 'global.show.search' },
                { key: 'global.capture.area' },
                { key: 'global.capture.window' },
                { key: 'global.capture.full' }
            ]
        },
        // 播放器(衝突判斷僅需跟組裡判斷，不需要跟組外)
        {
            name: 'player',
            conflict: 'player',
            items: [
                { key: 'player.playAndPause' },
                { key: 'player.prev1frame' },
                { key: 'player.next1frame' },
                { key: 'player.prev10frame' },
                { key: 'player.next10frame' },
                { key: 'player.volume.increase' },
                { key: 'player.volume.decrease' },
                { key: 'player.step.forward' },
                { key: 'player.step.backward' },
                { key: 'player.speed.up' },
                { key: 'player.speed.down' },
                { key: 'player.thumbnail.set' },
                { key: 'player.thumbnail.copy' },
                { key: 'player.thumbnail.save' }
            ]
        },
        {
            name: 'file',
            conflict: 'all',
            items: [
                { key: 'file.create.new' },
                { key: 'file.create.folder' },
                { key: 'file.create.subfolder' },
                { key: 'file.create.smartfolder' },
                { key: 'file.import.folders' },
                { key: 'file.import.links' },
                { key: 'file.import.eaglepack' },
                { key: 'file.import.pinterest' },
                { key: 'file.import.artstation' },
                { key: 'file.export.item.eaglepack' },
                { key: 'file.export.item.computer' },
                { key: 'file.export.item.as' },
                { key: 'file.export.csv' }
            ]
        },
        {
            name: 'library',
            conflict: 'all',
            items: [
                { key: 'library.create' },
                { key: 'library.load' },
                { key: 'library.switch' }
            ]
        },
        {
            name: 'edit',
            conflict: 'all',
            items: [
                { key: 'edit.rename.win32', platform: 'win32' },
                { key: 'edit.rename.darwin', platform: 'darwin' },
                { key: 'edit.copy.path' },
                { key: 'edit.copy.folderpath' },
                { key: 'edit.copy.eaglelink' },
                { key: 'edit.copy.thumbnail' },
                { key: 'edit.copy.base64' },
                { key: 'edit.copy.name' },
                { key: 'edit.duplicate' },
                { key: 'edit.thumbnail.refresh' },
                { key: 'edit.thumbnail.custom.file' },
                { key: 'edit.thumbnail.custom.clipboard' },
                { key: 'edit.thumbnail.custom.reset' },
                { key: 'edit.image.flip' },
                { key: 'edit.image.rotate' },
                { key: 'edit.image.crop' },
                { key: 'edit.image.merge' },
                { key: 'edit.folder.setting' },
                { key: 'edit.folder.password.create' },
                { key: 'edit.folder.password.change' },
                { key: 'edit.folder.password.reset' },
                { key: 'edit.folder.password.lock' },
                { key: 'edit.folder.move' },
                { key: 'edit.remove.folder.darwin', platform: 'darwin' },
                { key: 'edit.remove.folder.win32', platform: 'win32' },
                { key: 'edit.remove.trash.darwin', platform: 'darwin' },
                { key: 'edit.remove.trash.win32', platform: 'win32' }
            ]
        },
        {
            name: 'find',
            conflict: 'all',
            items: [
                { key: 'find.search.current' },
                { key: 'find.search.all' },
                { key: 'find.sidebar.filter' },
                { key: 'find.quicksearch' },
                { key: 'find.add.to' },
                { key: 'find.filter.toggle' },
                { key: 'find.filter.reset' },
                { key: 'find.filter.folder' },
                { key: 'find.filter.tag' },
                { key: 'find.filter.color' },
                { key: 'find.filter.shape' },
                { key: 'find.filter.rating' },
                { key: 'find.filter.import' },
                { key: 'find.filter.date' },
                { key: 'find.filter.type' },
                { key: 'find.filter.size' },
                { key: 'find.filter.resolution' },
                { key: 'find.filter.duration' },
                { key: 'find.filter.annotation' },
                { key: 'find.filter.note' },
                { key: 'find.filter.url' },
                { key: 'find.filter.bpm' },
                { key: 'find.filter.camera' },
                { key: 'find.filter.fonts' },
                { key: 'find.filter.image' },
                { key: 'find.filter.semantic' },
                { key: 'find.filter.other' }
            ]
        },
        {
            name: 'reverse',
            conflict: 'all',
            items: [
                { key: 'find.reverse.eagle' },
                { key: 'find.reverse.google' },
                { key: 'find.reverse.bing' },
                { key: 'find.reverse.yandex' },
                { key: 'find.reverse.tineye' },
                { key: 'find.reverse.saucenao' },
                { key: 'find.reverse.baidu' },
                { key: 'find.reverse.sogou' }
            ]
        },
        {
            name: 'organize',
            conflict: 'all',
            items: [
                // 評分
                { key: 'organize.rating.5' },
                { key: 'organize.rating.4' },
                { key: 'organize.rating.3' },
                { key: 'organize.rating.2' },
                { key: 'organize.rating.1' },
                { key: 'organize.rating.0' },
                // 標籤
                { key: 'organize.tag.add' },
                { key: 'organize.tag.copy' },
                { key: 'organize.tag.paste' },
                { key: 'organize.tag.clear' },
                // 文件夾
                { key: 'organize.folder.add' },
                { key: 'organize.folder.addLast' }
            ]
        },
        {
            name: 'view',
            conflict: 'all',
            items: [
                // 窗口控制
                { key: 'view.alwaysOnTop' },
                // 頁面切換
                { key: 'view.all' },
                { key: 'view.unfiled' },
                { key: 'view.untagged' },
                { key: 'view.recent' },
                { key: 'view.random' },
                { key: 'view.alltags' },
                { key: 'view.trash' },
                // 佈局切換
                { key: 'view.layout.grid' },
                { key: 'view.layout.justified' },
                { key: 'view.layout.waterfall' },
                { key: 'view.layout.list' },
                // 縮放
                { key: 'view.zoom.in' },
                { key: 'view.zoom.out' },
                { key: 'view.zoom.actual' },
                { key: 'view.zoom.fit' },
                // 檔案操作
                { key: 'view.file.opennewwindow' },
                { key: 'view.file.opendefault' },
                { key: 'view.file.openother', platform: 'win32' },
                { key: 'view.file.openfinder' },
                { key: 'view.file.openlink' },
                { key: 'view.reveal.darwin', platform: 'darwin' },
                { key: 'view.reveal.win32', platform: 'win32' },
                { key: 'view.duplicate.darwin', platform: 'darwin' },
                { key: 'view.duplicate.win32', platform: 'win32' },
                // 頁面滾動
                { key: 'view.scroll.home' },
                { key: 'view.scroll.end' },
                { key: 'view.scroll.prevpage' },
                { key: 'view.scroll.nextpage' },
                // 切換顯示
                { key: 'view.toggle.sidebar' },
                { key: 'view.toggle.inspector' },
                { key: 'view.toggle.all' },
                { key: 'view.toggle.listname' },
                { key: 'view.toggle.listmetas' },
                { key: 'view.toggle.listannotation' },
                { key: 'view.toggle.subfolder' },
                { key: 'view.toggle.navigator' },
                // 其他功能
                { key: 'view.grayscale' },
                { key: 'view.toggle.slideshow' },
            ]
        },
        {
            name: 'others',
            conflict: 'all',
            items: [
                { key: 'app.preferences' },
                { key: 'app.lock' }
            ]
        }
    ];

    // 過濾平台特定的快捷鍵
    const currentPlatform = process.platform;
    $scope.keybindGroups = $scope.keybindGroups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            // 如果沒有指定平台，則顯示
            if (!item.platform) return true;
            // 如果指定了平台，只在匹配的平台上顯示
            return item.platform === currentPlatform;
        })
    }));
    
    // 保持向後兼容的平面化結構用於搜索
    $scope.keybinds = [];
    $scope.keybindGroups.forEach(group => {
        $scope.keybinds = $scope.keybinds.concat(group.items);
    });

    $scope.updateKeybinds = () => {
        const lowerKeyword = $("#shortcut-input").val()?.toLowerCase() ?? "";
        const isSearching = !!lowerKeyword;
        
        // 設置搜索狀態標記到所有快捷鍵輸入框
        $timeout(() => {
            $('.shortcut-input').each(function() {
                $(this).data('search-active', isSearching);
            });
        });
        
        if (!lowerKeyword) {
            $scope.keybindGroupResult = $scope.keybindGroups.map(group => ({
                ...group,
                items: [...group.items]
            }));
            $scope.keybindResult = $scope.keybinds;
            $scope.filteredInstallPlugins = $scope.installPlugins || [];
            return;
        }

        // 分組搜索結果
        $scope.keybindGroupResult = $scope.keybindGroups.map(group => {
            const filteredItems = group.items.filter((item) => {
                const shortcutName = i18n.__(`shortcuts.${item.key}`) || '';
                const lowerName = shortcutName.toLowerCase();
                const shortcut = $scope.preferences.shortcuts.keybinds[item.key];
                const lowerShortcut = shortcut?.toLowerCase()?.replaceAll(" ", "") ?? "";
                const lowerKey = item.key.toLowerCase();
                const groupName = i18n.__(`shortcuts.group.${group.name}`)?.toLowerCase() || '';
                const str = `${lowerName} ${lowerShortcut} ${lowerKey} ${groupName}`;
                return str.indexOf(lowerKeyword) > -1;
            });

            return {
                ...group,
                items: filteredItems
            };
        }).filter(group => group.items.length > 0);

        // Plugin搜索結果
        $scope.filteredInstallPlugins = ($scope.installPlugins || []).filter((plugin) => {
            const pluginName = plugin.name?.toLowerCase() || '';
            const pluginId = plugin.id?.toLowerCase() || '';
            const shortcut = plugin.formatShortcut?.toLowerCase()?.replaceAll(" ", "") ?? "";
            const pluginKeyword = i18n.__('preferencesWindow.shortcuts.plugin')?.toLowerCase() || 'plugin';
            const str = `${pluginName} ${pluginId} ${shortcut} ${pluginKeyword}`;
            return str.indexOf(lowerKeyword) > -1;
        });

        // 保持向後兼容的平面化結果
        $scope.keybindResult = [];
        $scope.keybindGroupResult.forEach(group => {
            $scope.keybindResult = $scope.keybindResult.concat(group.items);
        });
    };
    
    $scope.sidebarPanels = [
        {
            type: "panel",
            name: "general",
            "iconPath": "ic-general.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.general")
        },
        {
            type: "panel",
            name: "sidebar",
            "iconPath": "ic-sidebar.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.sidebar")
        },
        {
            type: "separator"
        },
        {
            type: "panel",
            name: "control",
            "iconPath": "ic-control.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.control")
        },
        {
            type: "panel",
            name: "habits",
            "iconPath": "ic-view.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.habits")
        },
        {
            type: "panel",
            name: "screencapture",
            "iconPath": "ic-screenshot.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.screencCapture")
        },
        {
            type: "panel",
            name: "shortcuts",
            "iconPath": "ic-shortcuts.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.shortcuts")
        },
        // {
        //     type: "panel",
        //     name: "download",
        //     "iconPath": "ic_download.svg",
        //     "i18n": i18n.__("preferencesWindow.sidebar.download")
        // },
        {
            type: "separator"
        },
        {
            type: "panel",
            name: "notification",
            "iconPath": "ic-notification.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.notification")
        },
        // {
        //     type: "panel",
        //     name: "video",
        //     "iconPath": "ic_video.svg",
        //     "i18n": i18n.__("preferencesWindow.sidebar.video")
        // },
        // {
        //     type: "panel",
        //     name: "gif",
        //     "iconPath": "ic_gif.svg",
        //     "i18n": i18n.__("preferencesWindow.sidebar.gif")
        // },
        // {
        //     type: "panel",
        //     name: "font",
        //     "iconPath": "ic_font.svg",
        //     "i18n": i18n.__("preferencesWindow.sidebar.font")
        // },
        {
            type: "panel",
            name: "privacy",
            "iconPath": "ic-lock.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.privacy")
        },
        {
            type: "panel",
            name: "autoImport",
            "iconPath": "ic-autoimport.svg",
            "i18n": i18n.__("preferencesWindow.sidebar.autoImport")
        },
        {
            type: "separator"
        },
        // Eagle 5.0
        {
            type: "panel",
            name: "ai-search",
            ai: true,
            "iconPath": "ic-ai-search.svg",
            "i18n": i18n.__("sidebar.aiSearch")
        },
        {
            type: "panel",
            name: "ai-sdk",
            ai: true,
            "iconPath": "ic-ai-sdk.svg",
            "i18n": i18n.__("sidebar.aiSdk")
        },
        {
            type: "panel",
            name: "mcp-server",
            ai: true,
            "iconPath": "ic-mcp.svg",
            "i18n": "Eagle MCP"
        },
        {
            type: "separator"
        },
        {
            type: "panel",
            name: "developer",
            "iconPath": "ic-developer.svg",
            "i18n": i18n.__("sidebar.developer")
        },
    ];

    $scope.currentPanel = $scope.sidebarPanels[0];
    const lastPanelName = localStorage["eagle.preference.lastPanel"];

    if (lastPanelName) {
        $scope.sidebarPanels.forEach((panel) => {
            if (panel.name === lastPanelName) {
                $scope.currentPanel = panel;
            }
        });
    }
    
    $scope.themes = [
        {
            name: "Auto",
            css: "auto"
        },
        {
            name: "LIGHT",
            color: "#f5f5f5",
            css: "light",
        },
        {
            name: "LIGHTGRAY",
            color: "#e5e5e5",
            css: "lightgray",
        },
        {
            name: "GRAY",
            color: "#303134",
            css: "gray",
        },
        {
            name: "DARK",
            color: "#1F2023",
            css: "dark",
        },
        {
            name: "BLUE",
            color: "#303342",
            css: "blue",
        },
        {
            name: "PURPLE",
            color: "#343141",
            css: "purple",
        },
    ];

    ipcRenderer.on('init', async function(event, params) {

        window.Registration = params.Registration;

        if (params.panel) {
            $scope.sidebarPanels.forEach((panel) => {
                if (panel.name === params.panel) {
                    $scope.currentPanel = panel;
                }
            });
        }

        $scope.keyword = params.keyword || "";
        if ($scope.keyword.length > 0) {
            $scope.onKeywordChange();
            setTimeout(() => {
                $scope.focusSearch();
            }, 100);
        }

        // 初始化
        initAutoLaunch();
        // 初始化偏少设定
        initPreference();

        // 等待插件初始化完成
        await initPlugins();

        // 初始化分組結果
        $scope.updateKeybinds();
        
        // 確保視圖更新
        $scope.$evalAsync();

        currentWindow.show();

        setTimeout(() => {
            $scope.focusSearch();
        }, 200);
    });

    $scope.openAutoImport = function (event) {
        if ($scope.preferences.autoImport.enable !== 'false') {
            if (!$scope.preferences.autoImport.path) {
                $scope.chooseAutoImportPath();
            }
        }
    };

    $scope.chooseAutoImportPath = function () {
        console.log("chooseAutoImportPath");
        remote.dialog.showOpenDialog(currentWindow, {
            title: i18n.__("Dialog.Import.Eaglepack.Message"),
            filters: [],
            properties: ['openDirectory', 'createDirectory'],
        }).then(result => {
            var paths = result.filePaths;
            if (!paths || paths.length === 0) {
                if (!$scope.preferences.autoImport.path) {
                    $scope.preferences.autoImport.enable = 'false';
                }
                $scope.$evalAsync();
                return;
            }
            var isNetworkDrive = require(appRoot + '/my_modules/is-network-drive');
            var autoImportPath = paths[0];
            if (isNetworkDrive(autoImportPath)) {
                remote.dialog.showMessageBox({
                    type: "warning",
                    cancelId: 1,
                    buttons: [i18n.__('general.close')],
                    message: i18n.__('general.hint'),
                    detail: i18n.__('dialog.autoImport.networkPath')
                }, (response) => {});
            }
            else {
                $scope.preferences.autoImport.path = autoImportPath;
                $scope.$evalAsync();
            }
        }).catch(err => {
            console.log(err)
        })
    }

    $scope.revealAutoImportPath = function () {
        var autoImportPath = $scope.preferences.autoImport.path;
        if (autoImportPath && fs.existsSync(autoImportPath)) {
            const shell = require('electron').shell;
            ipcRenderer.send('open-with-default', autoImportPath);
        }
    }

	$scope.regenerateApiToken = () => {
		$scope.preferences.developer.apiToken = crypto.randomUUID();
	};

    $scope.copyApiToken = () => {
        const { clipboard } = require('electron');
        clipboard.writeText($scope.preferences.developer.apiToken);
    };

    $scope.openPasswordModal = function (event, mode) {
        if (mode === 'new') {
            if ($scope.preferences.privacy.enable !== 'false' && !$scope.preferences.privacy.password) {
                $rootScope.$broadcast("SET-APP-PASSWORD", mode);
            }    
            else {
                ipcRenderer.send('chnage-preferences', $scope.preferences);
            }
        }
        else if (mode === 'change') {
            $rootScope.$broadcast("SET-APP-PASSWORD", mode);
        }
    };

    $scope.lockNow = function () {
        if ($scope.preferences.privacy.enable !== 'false' && $scope.preferences.privacy.password) {
            ipcRenderer.send('lock-now');
            close();
        }
    };

    // 處理整個 Touch ID list-item 的點擊
    $scope.toggleTouchIDClick = function(event) {
        // 如果點擊的是 toggle 本身，不做任何事（讓 toggle 自己處理）
        if (event.target.tagName === 'INPUT' || event.target.classList.contains('slider')) {
            return;
        }
        
        // 否則切換 Touch ID 狀態
        if ($scope.preferences.privacy.enableTouchID === 'true') {
            $scope.preferences.privacy.enableTouchID = 'false';
        } else {
            $scope.preferences.privacy.enableTouchID = 'true';
        }
        
        // 觸發 toggleTouchID 函數
        $scope.toggleTouchID();
    };

    // 切換 Touch ID 功能
    $scope.toggleTouchID = async function() {
        if ($scope.preferences.privacy.enableTouchID === 'true') {
            // 首次啟用時進行驗證
            try {
                const prompt = i18n.__('preferencesWindow.privacy.touchid.prompt.enable') || '驗證以啟用 Touch ID 解鎖功能';
                await systemPreferences.promptTouchID(prompt);
                // 驗證成功，儲存設定
                ipcRenderer.send('chnage-preferences', $scope.preferences);
            } catch (err) {
                // 驗證失敗或取消，還原設定
                console.log('Touch ID 驗證失敗或取消:', err);
                $scope.preferences.privacy.enableTouchID = 'false';
                $scope.$evalAsync();
            }
        } else {
            // 停用 Touch ID
            ipcRenderer.send('chnage-preferences', $scope.preferences);
        }
    };

    // 储存设定
    // 将用户设定写回 settings 物件
    $scope.save = function() {

        $scope.apply();

        currentWindow.hide();
        // currentWindow.blur();
        setTimeout(function () {
            currentWindow.close();
        }, 300);
    };

    $scope.apply = function () {
        ipcRenderer.send('electron-info', `[app] Save preferences`);
        if (process.platform != 'darwin') {
            if ($scope.launchAtLogin == 'true') {
                eagleAutoLauncher.enable();
                ipcRenderer.send('electron-info', `[app] Auto launch: ON`);
            } else {
                eagleAutoLauncher.disable();
                ipcRenderer.send('electron-info', `[app] Auto launch: OFF`);
            }
        }
        else {
            if ($scope.launchAtLogin == 'true') {
                eagleAutoLauncher.enable();
                ipcRenderer.send('electron-info', `[app] Auto launch: ON`);
            } else {
                eagleAutoLauncher.disable();
                ipcRenderer.send('electron-info', `[app] Auto launch: OFF`);
            }
        }

        try {
            if ($scope.preferences.autoImport.enable == 'true') {
                ipcRenderer.send('electron-info', `[app] Auto-import: ON`);
                ipcRenderer.send('electron-info', `[app] Auto-import path: ${$scope.preferences.autoImport.path}`);
            } 
            else {
                ipcRenderer.send('electron-info', `[app] Auto-import: OFF`);
            }
        }
        catch (err) {}

        ipcRenderer.send('chnage-preferences', $scope.preferences);
    };

    $scope.escHandler = function ($event) {
        $event.stopPropagation();
        $scope.cancel();
    };

    $scope.getThemeName = function (theme) {
        if (theme.name === "Auto") {
            if (remote.nativeTheme.shouldUseDarkColors) {
                return "GRAY";
            }
            else {
                return "LIGHT";
            }
        }
        else {
            return theme.name;
        }
    };

    $scope.getThemeCSS = function (theme) {
        if (theme.name === "Auto") {
            if (remote.nativeTheme.shouldUseDarkColors) {
                return "gray";
            }
            else {
                return "light";
            }
        }
        else {
            return theme.css;
        }
    };

    $scope.cancel = function() {

        if ($scope.preferences.theme != $scope.lastTheme) {
            $scope.currentTheme = $scope.lastTheme;
            $scope.themeName = $scope.getThemeName($scope.currentTheme);
            $scope.preferences.theme = $scope.lastTheme;
            ipcRenderer.send('change-theme', $scope.lastTheme);
        }

        if ($scope.preferences.general.zoom != $scope.lastZoom) {
            $scope.currentZoom = $scope.lastZoom;
            $scope.preferences.general.zoom = $scope.lastZoom;
            ipcRenderer.send('change-zoom', $scope.lastZoom);
        }
        currentWindow.close();
    };

    $scope.switchPanel = function(panel) {
        if (!panel) return;
        $scope.keyword = "";
        $scope.showSearchEmpty = false;
        localStorage["eagle.preference.lastPanel"] = panel.name;
        $scope.currentPanel = panel;
    };

    $scope.onKeywordChange = ($event) => {
        if ($scope.keyword) {
            if ($scope.currentPanel.name !== "search") {
                $scope.lastPanel = $scope.currentPanel;
            }
            $scope.currentPanel = $scope.searchSidebarItem;
        }
        else {
            $scope.currentPanel = $scope.lastPanel;
        }
    };

    $scope.focusSearch = ($event) => {
        $("#sidebar-search").focus();
    };

    // 更改开机自动启动
    $scope.changeAutoLaunch = function(autoLaunch) {
        $scope.launchAtLogin = autoLaunch;
    };

    $scope.changeTheme = function(theme) {
        $scope.currentTheme = theme;
        $scope.themeName = $scope.getThemeName(theme);
        $scope.preferences.theme = theme;
        ipcRenderer.send('change-theme', theme);
    };

    $scope.themeAttr = () => {
        if ($scope?.preferences?.theme?.name === "Auto") {
            if (remote.nativeTheme.shouldUseDarkColors) {
                return "gray";
            }
            else {
                return "light";
            }
        }
        else {
            return $scope?.preferences?.theme?.css || "gray";
        }
    }

    $scope.languageChange = function(language) {
        $scope.changes.language = language;
    };

    $scope.changeZoom = function(zoom) {
        $scope.currentZoom = zoom;
        $scope.preferences.general.zoom = zoom;
        ipcRenderer.send('change-zoom', zoom);
    };

    $scope.changeShortcut = function() {
        ipcRenderer.send('chnage-shortcut', {
            screenCaptureShortcut: $scope.screenCaptureShortcut.replace("⌘", "Command") || "",
            windowCaptureShortcut: $scope.windowCaptureShortcut.replace("⌘", "Command") || ""
        });
    };

    remote.nativeTheme.on('updated', function theThemeHasChanged () {
        if ($scope.preferences.theme.name === "Auto") {
            $scope.themeName = $scope.getThemeName($scope.currentTheme);
            $scope.$evalAsync();
        }
        $scope.themeName = $scope.getThemeName($scope.currentTheme);
    });


    function initAutoLaunch() {
        eagleAutoLauncher.isEnabled().then(function(isEnabled) {
            console.log(isEnabled);
            if (isEnabled) {
                $scope.launchAtLogin = "true";
            } else {
                $scope.launchAtLogin = "false";
            }
            $scope.$evalAsync();
        }).catch(function(err) {
            console.log(err);
            $scope.eagleAutoLauncher = "false";
            $scope.$evalAsync();
        });
    };

    function initPreference() {

        const settings = require(appRoot + '/my_modules/electron-settings');
        var data = settings.getPreferences();
        // 载入预设样版
        const defaultPreferences = require(appRoot + '/app/js/default-preferences.js');
        preferences = angular.copy(defaultPreferences);
        // var userPreference = data;
        
        // preferences.general.launchAtLogin = "这个值不需要设定，采用程式自动判断")
        preferences.shortcuts.keybinds["global.capture.area"] = data.shortcuts && data.shortcuts.screenCaptureShortcut || preferences.shortcuts.keybinds["global.capture.area"];
        preferences.shortcuts.keybinds["global.capture.window"] = data.shortcuts && data.shortcuts.windowCaptureShortcut || preferences.shortcuts.keybinds["global.capture.area"];
        preferences.screencapture.useRetina = toBooleanString(data.useRetina) || preferences.screencapture.useRetina;

        $scope.currentTheme = data.theme || getTheme(preferences.theme);
        $scope.themeName = $scope.getThemeName($scope.currentTheme);
        $scope.currentZoom = data.general.zoom;

        if (!$scope.currentTheme) $scope.currentTheme = $scope.themes[0];
        $scope.lastTheme = $scope.currentTheme;
        $scope.lastZoom = $scope.currentZoom;
        $scope.language = data.general.language || "en";

        // 替换 CmdOrCtrl 预设值
        for (var key in preferences.shortcuts.keybinds) {
            preferences.shortcuts.keybinds[key] = formatShortcut(preferences.shortcuts.keybinds[key]);
        }
        if (data && data.shortcuts && data.shortcuts.keybinds) {
            for (var key in data.shortcuts.keybinds) {
                data.shortcuts.keybinds[key] = formatShortcut(data.shortcuts.keybinds[key]);
            }
        }

        // 避免旧版本的 shortcuts 压过
        if (preferences.shortcuts && !preferences.shortcuts.keybinds) {
            delete data.shortcuts;
        }

        // 将使用者设定的部分写入
        angular.extend(preferences, data);

        $scope.preferences = preferences;
        $scope.preferences.general.language = i18n.locale || data.language || preferences.general.language;
        $scope.vibrancyEnabled = preferences?.general?.enableVibrancy !== 'false';

        // 舊版本相容：補上彈出通知總開關預設值
        if (!$scope.preferences.notification.notification.enable) {
            $scope.preferences.notification.notification.enable = 'true';
        }

        if ($scope.preferences.autoImport.path && !fs.existsSync($scope.preferences.autoImport.path)) {
            $scope.preferences.autoImport.path = "";
            $scope.preferences.autoImport.enable = "false";
        }

        // 初始化快速鍵管理器，傳入群組資訊
        if (window.ShortcutManager) {
            window.ShortcutManager.init($scope.preferences, $scope.keybindGroups);
            console.log('[ShortcutManager] Initialized with preferences and groups');
        } else {
            console.warn('[ShortcutManager] ShortcutManager not available');
        }

        $scope.$evalAsync();
    };

    async function initPlugins () {
        // pluginModule.init() 在偏好設定視窗中可能因 $bodyScope 未定義導致 promise 永遠不結束，
        // 使用 Promise.race 加超時避免 hang 住，installedPluginMaps 在拋錯前已正確重建
        await Promise.race([
            pluginModule.init().catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 5000))
        ]);
        $scope.installPlugins = pluginModule.plugins.map((plugin) => {
            return plugin.manifest;
        });

        $scope.installPlugins = $scope.installPlugins.filter((plugin) => {
            return !!plugin.main;
        });

        $scope.installPlugins.forEach((plugin) => {
            if (plugin.shortcut || preferences.shortcuts.keybinds[plugin.id]) {
                try {
                    plugin.formatShortcut = preferences.shortcuts.keybinds[plugin.id] || formatShortcut(plugin.shortcut);
                } catch (e) {}
            }
        });
        $scope.mcpPluginInstalled = pluginModule.checkPluginInstalled("mcp-server");
        $scope.aiSearchPluginInstalled = pluginModule.checkPluginInstalled("ai-search");
        $scope.aiSdkPluginInstalled = pluginModule.checkPluginInstalled("ai-sdk");

        $scope.mcpPluginDisabled = pluginModule.isPluginDisabled("mcp-server");
        $scope.aiSearchPluginDisabled = pluginModule.isPluginDisabled("ai-search");
        $scope.aiSdkPluginDisabled = pluginModule.isPluginDisabled("ai-sdk");

        // 初始化過濾後的插件清單
        $scope.filteredInstallPlugins = $scope.installPlugins || [];
    }

    $scope.handleMcpAction = function($event) {
        $event.preventDefault();
        if (!$scope.mcpPluginInstalled) {
            ipcRenderer.send('install-plugin', { pluginId: 'mcp-server' });
        }
    };

    $scope.getMcpIframeUrl = function() {
        var url = 'http://localhost:41596/web-ui?theme=' + $scope.themeAttr() + '&locale=' + (i18n.locale || 'en');
        return $sce.trustAsResourceUrl(url);
    };

    $scope.openMcpDocs = function() {
        const shell = require('electron').shell;
        shell.openExternal('https://eagle.cool/support/article/eagle-mcp-server');
    };

    $scope.getAiSearchIframeUrl = function() {
        var url = 'http://127.0.0.1:38766/?theme=' + $scope.themeAttr() + '&locale=' + (i18n.locale || 'en');
        return $sce.trustAsResourceUrl(url);
    };

    $scope.handleAiSearchAction = function($event) {
        $event.preventDefault();
        if (!$scope.aiSearchPluginInstalled) {
            ipcRenderer.send('install-plugin', { pluginId: 'ai-search' });
        }
    };

    $scope.openAiSearchDocs = function() {
        const shell = require('electron').shell;
        shell.openExternal('https://eagle.cool/support/article/ai-search');
    };

    $scope.getAiSdkIframeUrl = function() {
        var url = 'http://localhost:41597/web-ui?theme=' + $scope.themeAttr() + '&locale=' + (i18n.locale || 'en');
        return $sce.trustAsResourceUrl(url);
    };

    $scope.handleAiSdkAction = function($event) {
        $event.preventDefault();
        if (!$scope.aiSdkPluginInstalled) {
            ipcRenderer.send('install-plugin', { pluginId: 'ai-sdk' });
        }
    };

    $scope.openAiSdkDocs = function() {
        const shell = require('electron').shell;
        shell.openExternal('https://eagle.cool/support/article/ai-sdk');
    };

    $scope.enableServicePlugin = function(pluginId) {
        ipcRenderer.send('enable-plugin', pluginId);
    };

    $scope.openPluginDevTools = function(pluginId) {
        ipcRenderer.send('open-plugin-devtools', pluginId);
    };

    // 即時監聽插件安裝/移除事件，更新偏好設定畫面
    ipcRenderer.on('plugin-installed', (event, pluginId) => {
        if (pluginId === 'mcp-server') $scope.mcpPluginInstalled = true;
        if (pluginId === 'ai-search') $scope.aiSearchPluginInstalled = true;
        if (pluginId === 'ai-sdk') $scope.aiSdkPluginInstalled = true;
        $scope.$evalAsync();
    });

    ipcRenderer.on('plugin-uninstalled', (event, pluginId) => {
        if (pluginId === 'mcp-server') $scope.mcpPluginInstalled = false;
        if (pluginId === 'ai-search') $scope.aiSearchPluginInstalled = false;
        if (pluginId === 'ai-sdk') $scope.aiSdkPluginInstalled = false;
        $scope.$evalAsync();
    });

    ipcRenderer.on('plugin-enabled', (event, pluginId) => {
        if (pluginId === 'mcp-server') $scope.mcpPluginDisabled = false;
        if (pluginId === 'ai-search') $scope.aiSearchPluginDisabled = false;
        if (pluginId === 'ai-sdk') $scope.aiSdkPluginDisabled = false;
        $scope.$evalAsync();
    });

    $scope.onPluginShortcutChange = (plugin) => {
        preferences.shortcuts.keybinds[plugin.id] = plugin.formatShortcut;
    };

    $scope.restoreDefaultShortcuts = function() {
        const buttons = [
            i18n.__('general.cancel'),
            i18n.__('preferencesWindow.shortcuts.restoreDefaults>confirm')
        ];
        
        remote.dialog.showMessageBox(currentWindow, {
            type: "question",
            buttons: buttons,
            defaultId: 1,
            cancelId: 0,
            message: i18n.__('preferencesWindow.shortcuts.restoreDefaults>title'),
            detail: i18n.__('preferencesWindow.shortcuts.restoreDefaults>message')
        }).then(result => {
            if (result.response === 1) { // 用戶點擊確認
                performShortcutsReset();
            }
        }).catch(err => {
            console.error('Failed to show restore defaults dialog:', err);
        });
    };

    function performShortcutsReset() {
        try {
            // 載入預設設定
            const defaultPreferences = require(appRoot + '/app/js/default-preferences.js');
            
            // 重置所有快捷鍵
            const defaultKeybinds = angular.copy(defaultPreferences.shortcuts.keybinds);
            
            // 格式化快捷鍵字符串
            for (var key in defaultKeybinds) {
                defaultKeybinds[key] = formatShortcut(defaultKeybinds[key]);
            }
            
            // 更新當前設定
            $scope.preferences.shortcuts.keybinds = defaultKeybinds;
            
            // 重置插件快捷鍵
            if ($scope.installPlugins) {
                $scope.installPlugins.forEach((plugin) => {
                    if (plugin.shortcut) {
                        plugin.formatShortcut = formatShortcut(plugin.shortcut);
                        $scope.preferences.shortcuts.keybinds[plugin.id] = plugin.formatShortcut;
                    } else {
                        // 清空插件自定義快捷鍵
                        delete $scope.preferences.shortcuts.keybinds[plugin.id];
                        plugin.formatShortcut = '';
                    }
                });
            }
            
            // 更新搜尋結果
            $scope.updateKeybinds();
            
            // 觸發 UI 更新
            $scope.$evalAsync();
            
            // 記錄操作
            ipcRenderer.send('electron-info', '[app] Shortcuts restored to defaults');
            
        } catch (error) {
            console.error('Failed to restore default shortcuts:', error);
            
            // 顯示錯誤對話框
            remote.dialog.showMessageBox(currentWindow, {
                type: "error",
                buttons: [i18n.__('general.close')],
                message: i18n.__('general.error'),
                detail: i18n.__('preferencesWindow.shortcuts.restoreDefaults>error')
            });
        }
    }

    function getTheme(theme) {
        for (var i = 0; i < $scope.themes.length; i++) {
            if ($scope.themes[i].name === theme) {
                return $scope.themes[i];
            }
        }
        return $scope.themes[0];
    };
});

function formatShortcut(shortcut) {
    if (process.platform != 'darwin') {
        shortcut = shortcut.replace("CommandOrControl", "Ctrl");
        shortcut = shortcut.replace("CmdOrCtrl", "Ctrl");
    } else {
        shortcut = shortcut.replace("CmdOrCtrl", "Command");
        shortcut = shortcut.replace("CommandOrControl", "Command");
        shortcut = shortcut.replace("Alt", "Option");
        shortcut = shortcut.replace("Ctrl", "Control");
    }
    return shortcut;
};

function toBooleanString(string) {
    if (string === undefined || string === null) return 'false';
    return Boolean(string).toString();
}
