module.exports = function (webContents) {
    webContents.on('before-input-event', (event, input) => {
        let ignoreMenuShortcuts = !(input.meta && (input.code === 'KeyW' || input.code === 'KeyQ'));
        webContents.setIgnoreMenuShortcuts(ignoreMenuShortcuts);
    });
};