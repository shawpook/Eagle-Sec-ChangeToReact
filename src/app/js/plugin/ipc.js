let callbacks = {
    'plugin-create': [],
	'plugin-run': [],
    'plugin-show': [],
    'plugin-hide': [],
    'plugin-exit': [],
    'theme-changed': [],
    'library-changed': [],
}

module.exports = {
    addCallback: (event, callback) => {
        callbacks[event].push(callback);
    },
    init: (ipcRenderer) => {

        ipcRenderer.r2r = async (id, channel, data) => {
            return new Promise((resolve, reject) => {

                if (id === undefined || id === null) {
                    reject('This method can only be used after the `plugin-create` event is triggered. Please refer to the API Document: https://developer.eagle.cool/plugin-api/api/event#gylpl');
                    return;
                }

                const params = {
                    windowID: windowID,
                    channel: `ipc2ipc-${crypto.randomUUID()}`,
                    data: data,
                };
                ipcRenderer.once(params.channel, (event, result) => {
                    resolve(result);
                });
                ipcRenderer.sendTo(id, channel, params);
            });
        };

        ipcRenderer.on('plugin-create', (event, params) => {
            callbacks['plugin-create'].forEach((pluginCreateCallback) => {
                if (pluginCreateCallback) {
                    pluginCreateCallback(params);
                }
            });
        });

        ipcRenderer.on('plugin-show', (event, params) => {
            callbacks['plugin-show'].forEach((pluginShowCallback) => {
                if (pluginShowCallback) {
                    pluginShowCallback(params);
                }
            });
        });

		ipcRenderer.on('plugin-run', (event, params) => {
            callbacks['plugin-run'].forEach((pluginRunCallback) => {
                if (pluginRunCallback) {
                    pluginRunCallback(params);
                }
            });
        });

        ipcRenderer.on('plugin-hide', (event, params) => {
            callbacks['plugin-hide'].forEach((pluginHideCallback) => {
                if (pluginHideCallback) {
                    pluginHideCallback(params);
                }
            });
        });

        ipcRenderer.on('plugin-exit', (event, params) => {
            let libraryPath = require('path').normalize(params.rootDir);
            callbacks['plugin-exit'].forEach((pluginExitCallback) => {
                if (pluginExitCallback) {
                    pluginExitCallback(libraryPath);
                }
            });
        });

        ipcRenderer.on('library-changed', (event, params) => {
            callbacks['library-changed'].forEach((callback) => {
                if (callback) {
                    callback(params);
                }
            });
        });

        ipcRenderer.on('theme-changed', (event, params) => {
            callbacks['theme-changed'].forEach((callback) => {
                if (callback) {
                    callback(params);
                }
            });
        });
    },

};