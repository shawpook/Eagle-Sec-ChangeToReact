console.log("test");
const electron = require("electron");
const remote = require('@electron/remote');
const app = remote.app;
const ipcRenderer = require('electron').ipcRenderer;
const currentWindow = remote.getCurrentWindow();
const shell = electron.shell;
var electronLog = remote.require('electron-log');
var RegistrationApp = angular.module("RegistrationApp", []);
var bodyScope;
var machineID;
const electronSettings = require(appRoot + '/my_modules/electron-settings');

Mailcheck.defaultDomains.push('foxmail.com');
Mailcheck.defaultDomains.push('sina.com');
Mailcheck.defaultDomains.push('163.com');
Mailcheck.defaultDomains.push('139.com');
Mailcheck.defaultDomains.push('126.com');
Mailcheck.defaultDomains.push('yeah.net');
Mailcheck.defaultDomains.push('mozmail.com');
Mailcheck.defaultTopLevelDomains.push('com.cn', 'com.tw', 'cn', 'tw');

$(document).ready(function () {
	// 所有帶有 target _blank 的連結都會使用預設瀏覽器開啟
	$("body").on('click', 'a', function(event) {
	    event && event.preventDefault();
	    if ($(this).attr("target") == "_blank") {
	        var link = this.href;
	        shell.openExternal(link);
	        if (this.href.indexOf('/extensions')) {
	            var label = $(this).attr('label') || "";
	        }
	    }
	});
});

RegistrationApp.config(function($sceProvider, $httpProvider) {
    $sceProvider.enabled(false);
});

RegistrationApp.filter('i18n', function($window) {
    return function (key) {
        return i18n.__(key);
    };
});

RegistrationApp.filter('themePath', function () {
    return function (theme) {
        if (theme === 'light' || theme === 'lightgray') {
            return 'light';
        }
        else {
            return 'dark';
        }
    };
});

RegistrationApp.controller("RegistrationController", function ($rootScope, $scope, $window, $filter) {

    const preferences = electronSettings.getPreferences();
	bodyScope = $scope;
	$scope.platform = process.platform;
    $scope.language = preferences.general.language || "en";
    $scope.vibrancyEnabled = preferences?.general?.enableVibrancy !== 'false';
    $scope.theme = preferences.theme.css || "gray";
    if (preferences && preferences.theme.name === 'Auto') {
        if (remote.nativeTheme.shouldUseDarkColors) {
            $scope.theme = "gray";
        }
        else {
            $scope.theme = "light";
        }
    }

	$scope.registerScope = $scope;
    $scope.isLoading = false;
    $scope.MODE = 'EXPIRED';	// REMINDE EXPIRED SUCCESS REGISTER
    $scope.email = "";
    $scope.licenseCode = "";

    // note: Windows 7 已經不支援此功能，暫時防呆
    try {
        $scope.deviceName = require('os').hostname().replace(".local", "");
    }
    catch (err) {
        $scope.deviceName = "unknown";
    }
    $scope.devicePlatform = require('os').type();
    $scope.devices = [];

    // 旧版本用户升级就会有这个信息
    var oldRegistration = localStorage.getItem("Registration");
    if (oldRegistration) {
        $scope.isUpgradeMode = true;
        console.log("使用升级模式来显示提示激活");
    }

    $scope.useSuggestion = function (email) {
        $scope.email = email;
        $scope.suggestion = undefined;
    };

    $scope.$watch("licenseCode", debounce(function () {
        if (/[a-z]/.test($scope.licenseCode)) {
            $scope.licenseCode = $scope.licenseCode.toUpperCase();
            $scope.$evalAsync();
        }
        // 去除非法字元
        if (/[^a-zA-Z0-9-]/.test($scope.licenseCode)) {
            $scope.licenseCode = $scope.licenseCode.replace(/[^a-zA-Z0-9-]/g, "");
            $scope.$evalAsync();
        }
    }, 500));

    $scope.$watch("email", debounce(function () {
        if (!$scope.email) return;
        if ( is.email($scope.email) && validateEmail($scope.email) ) {
            Mailcheck.run({
                email: $scope.email,
                suggested: function(suggestion) {
                    if (suggestion) {
                        $scope.suggestion = suggestion;
                        $scope.$evalAsync();
                        setTimeout(function () { resizeWindow(); }, 20);
                    }
                },
                empty: function() {
                    if ($scope.email.indexOf("www.") > -1 && $scope.email.indexOf("qq.com") > -1) {
                        $scope.suggestion = {
                            full: $scope.email.replace("www.", "")
                        };
                    }
                    else {
                        $scope.suggestion = undefined;
                    }
                    $scope.$evalAsync();
                    setTimeout(function () { resizeWindow(); }, 20);
                }
            });
        }
    }, 500));

    if ($scope.devicePlatform === "Darwin") { devicePlatform = "macOS"; }

    $scope.toggleDevices = function () {
        ipcRenderer.send('open-manage-device-window', {
            licenseCode: $scope.licenseCode,
            email: $scope.email,
            machineID: machineID,
        });
    };

    $scope.changeMode = function (mode) {
        $scope.MODE = mode;
        setTimeout(function () { resizeWindow(); }, 20);
    };

    $scope.register = function () {

        if ( !is.email($scope.email) || !validateEmail($scope.email) ) { 
            $scope.isEmailError = true;
            setTimeout(function () { resizeWindow(); }, 20);
            return; 
        } 
        else if ($scope.email !== $scope.emailValidation) {
            $scope.isEmailError = true; 
            setTimeout(function () { resizeWindow(); }, 20);
            return; 
        }
        else if ($scope.email.indexOf("＠") > -1 || $scope.email.indexOf("　") > -1 ) { 
            $scope.isEmailError = true;
            setTimeout(function () { resizeWindow(); }, 20);
            return; 
        } 
        else { 
            $scope.isEmailError = false; 
        }
        if (!$scope.licenseCode) { 
            $scope.isLicenseError = true; 
            $scope.isRegisterError = false;
            setTimeout(function () { resizeWindow(); }, 20);
            return; 
        } 
        else if ($scope.licenseCode.indexOf("-") === -1) {
            $scope.isLicenseError = true; 
            $scope.isRegisterError = false;
            setTimeout(function () { resizeWindow(); }, 20);
            return;
        }
        else { 
            $scope.isLicenseError = false;
        }

        setTimeout(function () { resizeWindow(); }, 20);

        // 去除空格键
        $scope.email = $scope.email.trim();
        $scope.licenseCode = $scope.licenseCode.trim();

		register(machineID, (err) => {
            setTimeout(function () { resizeWindow(); }, 20);
        });
    };

    ipcRenderer.on("init-registration", function (e, { mode, machineID, trialRemain, transparent, params }) {
    	window.trialRemain = trialRemain;
    	window.machineID = machineID;
        console.log(machineID);
    	if (transparent > 0) {
    		$("body").addClass("transparent");
    	}
        if (mode) {
            $scope.MODE = mode;
        }

        $scope.trialRemain = trialRemain;

        if (params) {
            $scope.licenseCode = (params?.code)? window.atob(params.code) : "";
            $scope.email = params.email;
            $scope.emailValidation = params.email;
        }

        $scope.isOpen = true;

        setTimeout(function() {
            resizeWindow();
            currentWindow.show();
        }, 100);
        $scope.$evalAsync();
    });

    ipcRenderer.on("autocomplete", function (e, params) {
        if (params) {
            $scope.licenseCode = (params?.code)? window.atob(params.code) : "";
            $scope.email = params.email;
            $scope.emailValidation = params.email;
            $scope.changeMode("REGISTER");
        }
        $scope.$evalAsync();
    });

    $scope.changeMode($scope.MODE);
});

function resizeWindow () {
    const height = $("#register-modal").outerHeight();
    const width = currentWindow.getSize()[0];
    currentWindow.setMinimumSize(width, height)
    currentWindow.setSize(width, height);
}

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}