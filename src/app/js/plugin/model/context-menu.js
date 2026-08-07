const { ipcRenderer } = require("electron")

class ContextMenu {

    #callbackMaps = {};

    constructor() {
        ipcRenderer.on('context-menu-command', (event, commandId) => {
            if (this.#callbackMaps[commandId]) {
                this.#callbackMaps[commandId]();
            }
        });
    }

    open(items) {
        this.walkTree(items, item => {
            item.id = item.id || Math.random().toString(36).substring(7);
            if (item.id && item.click) {
                this.#callbackMaps[item.id] = item.click;
            }
        });

        const transferableItems = items.map(item => {
            return JSON.parse(JSON.stringify(item));
        });

        ipcRenderer.send('create-context-menu', transferableItems);
    }

    walkTree(items, callback) {
        items.forEach(item => {
            callback(item);
            if (item.submenu) {
                this.walkTree(item.submenu, callback);
            }
        });
    }
}

module.exports = new ContextMenu();