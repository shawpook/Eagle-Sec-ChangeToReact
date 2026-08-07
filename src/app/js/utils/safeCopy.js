const safeCopy = {};

safeCopy.sync = function (src, dest, params = {}) {
    try {
        fse.copySync(src, dest, params);
    }
    catch (err) {
        ipcRenderer.send('electron-log', `[bg] Copy fail, ${src} to ${dest}`);
        ipcRenderer.send('electron-log', "" + err.stack || err);

        if (err.code === "ENOSPC") {
            throw err;
        }

        try {
            ipcRenderer.send('electron-log', `[bg] Try to remove "Rread-only" permission properity`);
            fse.chmodSync(src, 0755);
            ipcRenderer.send('electron-log', `[bg] "Read-only" remove successfully`);
        }
        catch (err) {
            ipcRenderer.send('electron-log', `[bg] "Read-only" remove fail`);
            ipcRenderer.send('electron-log', "" + err.stack || err);
        }
        try {
            fse.copySync(src, dest, params);
            ipcRenderer.send('electron-log', `[bg] Re-copy successfully`);
        }
        catch (err) {
            ipcRenderer.send('electron-log', `[bg] Re-copy fail`);
            ipcRenderer.send('electron-log', "" + err.stack || err);
            throw err;
        }
    }
};

safeCopy.async = function (src, dest, params = {}, callback) {
    fse.copy(src, dest, params, function (err) {

        if (err) {

            if (err.code === "ENOENT") {
                if (callback) callback(new Error(`File not existing: ${src}`));
                return;
            }

            if (err.code === "ENOSPC") {
                if (callback) callback(err);
                return;
            }

            ipcRenderer.send('electron-log', `[bg] Copy fail, ${src} to ${dest}`);
            ipcRenderer.send('electron-log', "" + err.stack || err);

            try {
                ipcRenderer.send('electron-log', `[bg] Try to remove "Rread-only" permission properity`);
                fse.chmodSync(src, 0755);
                ipcRenderer.send('electron-log', `[bg] "Read-only" remove successfully`);
            }
            catch (err) {
                ipcRenderer.send('electron-log', `[bg] "Read-only" remove fail`);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                if (callback) callback(err);
            }
            fse.copy(src, dest, params, function (err) {
                if (err) {
                    ipcRenderer.send('electron-log', `[bg] Re-copy successfully`);
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                    if (callback) callback(err);
                }
                else {
                    ipcRenderer.send('electron-log', `[bg] Re-copy fail`);
                    if (callback)callback();        
                }
            });
        }
        else {
            if (callback)callback();
        }
    });
};

module.exports = safeCopy;