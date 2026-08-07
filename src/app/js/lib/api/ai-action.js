class AIAction {
    // 私有屬性
    #pluginId = 'ai-action';
    #listeners = new Map(); // 事件監聽器
    #configPath = '';
    #actions = [];

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

    // Library 開啟時初始化 actions config
    initActions(rootDir) {
        this.destroy();
        this.#configPath = path.join(rootDir, 'actions.config.json');
        this.#loadActions();
        this.#watchConfig();
    }

    #loadActions() {
        try {
            if (fs.existsSync(this.#configPath)) {
                const data = fs.readFileSync(this.#configPath, 'utf8');
                this.#actions = JSON.parse(data);
            } else {
                this.#actions = [];
            }
        } catch (err) {
            this.#actions = [];
        }
    }

    #watchConfig() {
        this.#unwatchConfig();
        try {
            if (fs.existsSync(this.#configPath)) {
                fs.watchFile(this.#configPath, { persistent: true, interval: 4000 }, (curr, prev) => {
                    if (curr.mtimeMs === prev.mtimeMs) return;
                    if (!fs.existsSync(this.#configPath)) return;
                    this.#loadActions();
                    $bodyScope.$root.initMenu();
                    $bodyScope.$evalAsync();
                });
            }
        } catch (err) {}
    }

    #unwatchConfig() {
        try {
            if (this.#configPath && fs.existsSync(this.#configPath)) {
                fs.unwatchFile(this.#configPath);
            }
        } catch (err) {}
    }

    get actions() {
        return this.#actions;
    }

    formatShortcut(shortcut) {
        if (!shortcut) return '';
        if (process.platform === 'win32') {
            return shortcut.replace("Command", "CmdOrCtrl");
        }
        return shortcut;
    }

    runByShortcut(actionId) {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        pluginModule.openPluginById(this.#pluginId, {
            triggerType: 'shortcut',
            actionId: actionId,
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

    show() {
        pluginModule.showPluginById(this.#pluginId);
    }

    isOpen() {
        // 檢查插件是否已安裝且服務就緒
        if (!this.isInstalled) {
            return false;
        }
        return pluginModule.isOpen(this.#pluginId);
    }

    isVisible() {
        if (!this.isInstalled) {
            return false;
        }
        return pluginModule.isVisible(this.#pluginId);
    }

    destroy() {
        this.#unwatchConfig();
        this.#actions = [];
        this.#configPath = '';
    }
}

// 創建全局實例
eagle.action = new AIAction();
