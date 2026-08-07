class CustomExport {
    // 私有屬性
    #pluginId = 'custom-export';
    #listeners = new Map(); // 事件監聽器

    // 公開屬性
    isInstalled = false;
    
    init() {
        this.isInstalled = pluginModule.checkPluginInstalled(this.#pluginId);

        ipcRenderer.on('plugin-installed', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = true;
                $bodyScope.$evalAsync();
            }
        });

        ipcRenderer.on('plugin-uninstalled', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = false;
                $bodyScope.$evalAsync();
            }
        });
    }

    open(items) {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        const ids = items.map(item => item.id);
        pluginModule.openPluginById(this.#pluginId, { ids });
    }
}

// 創建全局實例
eagle.customExport = new CustomExport();