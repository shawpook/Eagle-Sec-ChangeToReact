class DeviceManager {
    // 取得 License 對定的設備列表
	static async loadDevices (params) {
        const fn = async (url, licenseCode) => {
            return new Promise((resolve, reject) => {
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        licenseCode: licenseCode,
                    })
                })
                .then(response => response.json())
                .then(data => {
                    resolve(data);
                })
                .catch((error) => {
                    electronLog && electronLog.info(`[app] Unable to connect: ${url}`);
                    electronLog && electronLog.error(error);
                    resolve();
                });
            });
        };

        let result = (
            await fn("https://core.eagle.cool/get-license-devices", params.licenseCode) ||
            await fn("https://en.eagle.cool/get-license-devices", params.licenseCode) || 
            await fn("http://120.79.10.37/get-license-devices", params.licenseCode)
        );

        if (result?.devices) {

            result.devices.forEach((device) => {
                if (device.machineID === params.machineID) {
                    device.isCurrent = true;
                }
            });
    
            // sort by activeAt
            result.devices = result.devices.sort((a, b) => {
                if (a.activeAt > b.activeAt) {
                    return -1;
                }
                else if (a.activeAt < b.activeAt) {
                    return 1;
                }
                else {
                    return 0;
                }
            });
    
            // sort current to first
            result.devices = result.devices.sort((a, b) => {
                if (a.isCurrent) {
                    return -1;
                }
                else if (b.isCurrent) {
                    return 1;
                }
                else {
                    return 0;
                }
            });
        }

        return result;
	}

    static async unregister (params) {
        const fn = (url, params) => {
            return new Promise((resolve, reject) => {
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: params.email,
                        licenseCode: params.licenseCode,
                        machineID: params.machineID,
                    })
                })
                .then(response => response.json())
                .then(data => {
                    return resolve(data);
                })
                .catch((error) => {
                    electronLog && electronLog.info(`[app] Unable to connect: ${url}`);
                    electronLog && electronLog.error(error);
                    return resolve();
                });
            });
        };

        return (
            await fn("https://core.eagle.cool/unregister", params) || 
            await fn("https://en.eagle.cool/unregister", params) || 
            await fn("http://120.79.10.37/unregister", params)
        );
    }

    static async updateName (params) {
        const fn = (url, params) => {
            return new Promise((resolve, reject) => {
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: params.email,
                        licenseCode: params.licenseCode,
                        machineID: params.machineID,
                        name: params.name,
                    })
                })
                .then(response => response.json())
                .then(data => {
                    return resolve(data);
                })
                .catch((error) => {
                    electronLog && electronLog.info(`[app] Unable to connect: ${url}`);
                    electronLog && electronLog.error(error);
                    return resolve();
                });
            });
        };

        return (
            await fn("https://core.eagle.cool/update-device-name", params) || 
            await fn("https://en.eagle.cool/update-device-name", params) || 
            await fn("http://120.79.10.37/update-device-name", params)
        );
    }
}

const electron = require("electron");
const remote = require('@electron/remote');
const ipcRenderer = require('electron').ipcRenderer;
const currentWindow = remote.getCurrentWindow();
const shell = electron.shell;
const electronLog = remote.require('electron-log');
const ManageDeviceApp = angular.module("ManageDeviceApp", []);
const electronSettings = require(appRoot + '/my_modules/electron-settings');

$(document).ready(() => {
    $("body").on('click', 'a', function (event) {
        event && event.preventDefault();
        if ($(this).attr("target") == "_blank") {
            shell.openExternal(this.href);
        }
    });
});

ManageDeviceApp.config(($sceProvider, $httpProvider) => {
    $sceProvider.enabled(false);
});

ManageDeviceApp.filter('i18n', ($window) => (key) => i18n.__(key));

ManageDeviceApp.filter('themePath', () => (theme) => {
    if (theme === 'light' || theme === 'lightgray') {
        return 'light';
    }
    else {
        return 'dark';
    }
});

function resizeWindow () {
    const height = $("#manage-device-window").outerHeight();
    const width = currentWindow.getSize()[0];
    currentWindow.setSize(width, height);
}

ManageDeviceApp.controller("ManageDeviceController", function($scope, $timeout, $rootScope, $filter, $http) {

    $scope.isLoading = true;

    const preferences = electronSettings.getPreferences();
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

    ipcRenderer.on('change.current.theme', function(e, theme) {
        if (theme.name === "Auto") {
            if (remote.nativeTheme.shouldUseDarkColors) {
                $scope.theme = "gray";
            }
            else {
                $scope.theme = "light";
            }
        }
        else {
            $scope.theme = theme.css || "gray";
        }
        $scope.$evalAsync();
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    $scope.email = urlParams.get('email');
    $scope.licenseCode = urlParams.get('licenseCode');
    $scope.machineID = urlParams.get('machineID');
    
    // console.log($scope.email);
    // console.log($scope.licenseCode);
    // console.log($scope.machineID);

	$scope.devices = [];
    resizeWindow();

    // 載入此序號設備資訊
    DeviceManager.loadDevices({
        licenseCode: $scope.licenseCode,
        machineID: $scope.machineID,
    }).then((deviceInfo) => {

        let devices = deviceInfo.devices;
        const deviceCount = deviceInfo.deviceCount;

        $scope.total = deviceCount;
        $scope.used = devices.length;
        $scope.devices = devices;
        $scope.desc = i18n.__('manageDevice.desc').replace('{count}', $scope.total);
        $timeout(() => {
            $scope.isLoading = false;
            $scope.$evalAsync();
            $timeout(() => {
                resizeWindow();
            }, 50);
        }, 100); 
    });

    // 移除設備
	$scope.removeDevice = (device) => {

        if (device.isCurrent) {
            ipcRenderer.send('open-unregister');
            return;
        }

        swal({
            html: `
                <div class="alert">
                    <div class="alert-icon warning"></div>
                    <h4 class="alert-title">${i18n.__("dialog.removeDevice.title")}</h4>
                    <p class="alert-desc">${i18n.__("dialog.removeDevice.desc")}</p>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            cancelButtonColor: "#777777",
            confirmButtonText: i18n.__("dialog.removeDevice.removeBtn"),
            cancelButtonText: i18n.__("general.cancel"),
        }).then(async() => {
            const result = await DeviceManager.unregister({
                email: $scope.email,
                licenseCode: $scope.licenseCode,
                machineID: device.machineID,
            });
            if (result) {
                const index = $scope.devices.indexOf(device);
                if (index > -1) {
                    $scope.devices.splice(index, 1);
                    $scope.used = $scope.devices.length;
                    $scope.$evalAsync();
                }
            }
        });
    };

    // 修改設備名稱
    $scope.changeName = function (device) {
        swal({
            title: i18n.__("dialog.renameDevice.title"),
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            input: 'text',
            inputValue: device.name || "",
            cancelButtonColor: "#777777",
            confirmButtonText: i18n.__("general.ok"),
            cancelButtonText: i18n.__("general.cancel"),
        }).then((result) => {
            if (result && result.length > 0) {
                device.name = result.substr(0, 80);
                DeviceManager.updateName({
                    email: $scope.email,
                    licenseCode: $scope.licenseCode,
                    machineID: device.machineID,
                    name: result,
                });
                $scope.$evalAsync();
            }
        });
    }

    $scope.close = () => {
        currentWindow.close();
    };
});