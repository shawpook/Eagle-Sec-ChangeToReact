class Inspector {
    
    #isHideInspector;
    #width;

	constructor() {
        this.#isHideInspector = localStorage["eagle.inspector.isHideInspector"] === 'true';
        this.#width = (localStorage["eagle.containerSize.inspector"])? parseInt(localStorage["eagle.containerSize.inspector"]) : 240;
        this.newName = "";
        this.newUrl = "";
        this.newTags = [];
        this.newNamePlaceholder = "title";
        this.newUrlPlaceholder = "http://";
        this.folders = [];
        this.activeTab = 'ITEM';
        this.inspectorFolder = undefined;
        this.category = {
            newName: "",
            newDescription: "",
            createDate: "",
            imageCount: 0,
            fileSize: 0,
            exportable: false,
            editable: false
        };
        this.sortableOptions = {
            distance: 10,
            disabled: false,
			helper : 'clone',
            update: (e, ui) => {
                setTimeout(() => {
                    if (this.inspectorItems && this.inspectorItems.length > 0) {
                        let inspectorItemsOrder = {};
                        this.inspectorItems.forEach((item, index) => {
                            inspectorItemsOrder[item.id] = index;
                        });
                        localStorage.setItem("eagle.inspector.itemsOrder", JSON.stringify(inspectorItemsOrder));
                    }
                }, 1);
            },
        };
        this.inspectorItems = [];
        this.inspectorItemsOrder = localStorage["eagle.inspector.itemsOrder"] ? JSON.parse(localStorage["eagle.inspector.itemsOrder"]) : { tags: 0, folders: 1, annotations: 2, information: 100 };
	}

    initPlugins() {
        const inspectorPlugins = pluginModule.previewExtension.inspectorPlugins;
        const pluginItems = inspectorPlugins.map((plugin) => {
            return {
                type: "plugin",
                id: plugin?.manifest?.id,
                name: plugin?.manifest?.name,
                plugin: plugin,
            }
        });

        this.inspectorItems = [
            { id: "tags" ,name: i18n.__("inspector.includesTagsLabel"), type: "tags" },
            { id: "folders", name: i18n.__("inspector.includesFoldersLabel"), type: "folders" },
            { id: "annotations", name: i18n.__("inspector.annotationLabel"), type: "annotations" },
            ...pluginItems,
            { id: "information", name: i18n.__("inspector.infoLabel"), type: "information" },
        ];

        this.inspectorItems.sort((a, b) => {
            const aOrder = this.inspectorItemsOrder[a.id] ?? 3;
            const bOrder = this.inspectorItemsOrder[b.id] ?? 3;
            return aOrder - bOrder;
        });
    }

    reset() {
        this.inspectorFolder = undefined;
    }

    toggle() {
        this.isHideInspector = !this.isHideInspector;
        setTimeout(() => {
            $bodyScope.whenLayoutChange();
            $bodyScope.$evalAsync();
        }, 100);
        if (eagle.inspector.isHideInspector) { electronLog && electronLog.info("[app] Inspector: OFF"); }
        else { electronLog && electronLog.info("[app] Inspector: ON"); }
    }

    copyTags(tags) {
        tags = tags ?? this.newTags;
        if (tags?.length > 0) {
            this.copiedTags = tags;
            clipboard.writeText(this.copiedTags.join("\n"));
        }
    }

    calculateTags(images) {

        if (images.length == 1) return images[0].tags;

        var board = {}; // Ó‹·Ö±í
        var tags = [];
        images.forEach(function(image) {
            if (image && image.tags) {
                image.tags.forEach(function(tag) {
                    if (!board[tag]) {
                        board[tag] = 1;
                    } else {
                        board[tag] = board[tag] + 1;
                    }
                });
            }
        });
        Object.keys(board).forEach(function(key) {
            if (board[key] == images.length) {
                tags.push(key);
            }
        });
        return tags;
    }

    calculateFolders(images) {
        var board = {}; // Ó‹·Ö±í
        var folders = [];
        images.forEach(function(image) {
            if (!image || !image.folders) return;
            image.folders.forEach(function(folder) {
                if (!board[folder]) {
                    board[folder] = 1;
                } else {
                    board[folder] = board[folder] + 1;
                }
            });
        });
        Object.keys(board).forEach(function(key) {
            if (board[key] == images.length) {
                folders.push(key);
            }
        });
        return folders;
    }

    calculateName(images) {
        var name = images[0].name;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (name !== image.name) {
                return "";
            }
        }
        return name;
    }
    
    calculateUrl(images) {
        var url = images[0].url;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (url !== image.url) {
                return "";
            }
        }
        return url;
    }

    calculateAnnotation(images) {
        var annotation = images[0].annotation;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (annotation !== image.annotation) {
                return "";
            }
        }
        return annotation;
    }

    calculateStar(images) {
        var star = images[0].star;
        for (var i = 1; i < images.length; i++) {
            var image = images[i];
            if (star !== image.star) {
                return 0;
            }
        }
        return star;
    }

    calculateFileSize(images) {
        var total = 0;
        try {
            for (var i = 0; i < images.length; i++) {
                var image = images[i];
                if (image && image.size) {
                    total += parseInt(image.size);
                }
            }
        }
        catch (err) {
            return 0;
        }
        return total;
    }

    get isHideInspector() {
        return this.#isHideInspector;
    }

    set isHideInspector(value) {
        this.#isHideInspector = value;
        localStorage.setItem("eagle.inspector.isHideInspector", value);
    }

    get width() {
        return this.#width;
    }

    set width(value) {
        if (isNaN(value)) return;
        this.#width = value;
        localStorage.setItem("eagle.containerSize.inspector", value);
    }

    get showProperties() {
        return localStorage['eagle.inspector.showProperties'] !== 'false';
    }
    set showProperties(value) {
        localStorage['eagle.inspector.showProperties'] = value;
    }

    get showComments() {
        return localStorage['eagle.inspector.showComments'] !== 'false';
    }
    set showComments(value) {
        localStorage['eagle.inspector.showComments'] = value;
    }

    get showFolders() {
        return localStorage['eagle.inspector.showFolders'] !== 'false';
    }
    set showFolders(value) {
        localStorage['eagle.inspector.showFolders'] = value;
    }

    get showTags() {
        return localStorage['eagle.inspector.showTags'] !== 'false';
    }
    set showTags(value) {
        localStorage['eagle.inspector.showTags'] = value;
    }

}

eagle.inspector = new Inspector();