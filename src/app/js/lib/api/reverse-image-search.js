class ReverseImageSearch {

    #pluginId = 'eagle-plugin-search-by-image';
    
    static ENGINES = {
        GOOGLE: 'google',
        YANDEX: 'yandex',
        BING: 'bing',
        TINEYE: 'tineye',
        BAIDU: 'baidu',
        SOGOU: 'sogou',
        SAUCENAO: 'saucenao'
    };

    search(item, searchEngine = 'google') {

        if (!item) return;

        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }

        pluginModule.openPluginById(this.#pluginId, { searchEngine: searchEngine });
    }
}

eagle.reverseImageSearch = new ReverseImageSearch();