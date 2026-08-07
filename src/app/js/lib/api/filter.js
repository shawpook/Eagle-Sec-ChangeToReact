class ItemFilter {
    #isOpen;
	constructor() {
        this.#isOpen = localStorage['isOpenFilter']  === 'true';
        this.isLockFilter = false;

        // 預設計數
        this.defaultCounts = {
            type: {},
            rating: {
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                '5': 0,
                '0': 0,
            },
            shape: {
                'panoramic-landscape': 0,
                'landscape': 0,
                'panoramic-portrait': 0,
                'portrait': 0,
                'square': 0,
                '4:3': 0,
                '3:4': 0,
                '16:9': 0,
                '9:16': 0,
            },
            import: {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            },
            mtime: {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            },
            camera: {},
            fontActivated: {
                'activated': 0,
                'deactivated': 0,
            },
            image: {
                itemId: undefined,
                base64: undefined
            },
            semantic: {
                value: undefined,
            }
        };
        this.filterCounts = {};
        this.resetFilterCounts();

        // 預設條件
        this.defaultRules = {
            type: {
                includes: {},
                excludes: {},
            },
            tag: {
                no: false,
                includes: [],
                excludes: [],
            },
            folder: {
                includes: {},
                excludes: {},
            },
            font: {
                activated: false,
                deactivated: false,
            },
            camera: {},
            import: {
                today: false,
                yesterday: false,
                last7day: false,
                last30day: false,
                last90day: false,
                last365day: false,
                usingRange: false,
                range: undefined,
                type: "undefined",
                model: undefined,
                selectedMonths: {},
            },
            mtime: {
                today: false,
                yesterday: false,
                last7day: false,
                last30day: false,
                last90day: false,
                last365day: false,
                usingRange: false,
                type: "undefined",
                model: undefined,
                selectedMonths: {},
            },
            rating: {
                '1': false,
                '2': false,
                '3': false,
                '4': false,
                '5': false,
                '0': false,
            },
            color: {
                gray: false,
                value: undefined,
                accuracy: 20
            },
            shape: {
                portrait: false,
                landscape: false,
                square: false,
                panoramicPortrait: false,
                panoramicLandscape: false,
                '43': false,
                '34': false,
                '169': false,
                '916': false,
                custom: false,
                width: 4,
                height: 3,
            },
            resolution: {
                minW: undefined,
                maxW: undefined,
                minH: undefined,
                maxH: undefined
            },
            file: {
                min: undefined,
                max: undefined,
                unit: 'kb',
            },
            duration: {
                min: undefined,
                max: undefined,
                unit: 's',
            },
            bpm: {
                min: undefined,
                max: undefined
            },
            annotation: {
                has: false,
                no: false,
                keywords: undefined
            },
            note: {
                has: false,
                no: false,
                keywords: undefined
            },
            url: {
                has: false,
                no: false,
                keywords: undefined
            },
            image: {
                itemId: undefined,
                base64: undefined
            },
            semantic: {
                value: undefined,
            }
        };
        this.filterRules = {};
        this.resetFilterRules();

        this.initPinned();

        // 工具列
        this.toolbar = [
            { type: 'image' }, // Eagle 5.0
            { type: 'semantic' }, // Eagle 5.0
            { type: 'color' },
            { type: 'tags' },
            { type: 'folders' },
            { type: 'shape' },
            { type: 'rating' },
            { type: 'types' },
            { type: 'import' },
            { type: 'mtime' },
            { type: 'resolution' },
            { type: 'duration' },
            { type: 'size' },
            { type: 'annotation' },
            { type: 'note' },
            { type: 'url' },
            { type: 'fontActivated' },
            { type: 'bpm' },
            { type: 'camera' },
        ];
        this.toolbarMap = {};
        this.toolbarSortableOptions = {
            distance: 10,
            disabled: false,
			helper : 'clone',
            update: (e, ui) => {
                setTimeout(() => {
                    console.log(this.toolbar);
                    if (this.toolbar && this.toolbar.length > 0) {
                        let toolbarOrders = [];
                        this.toolbar.forEach((item) => {
                            toolbarOrders.push(item.type);
                        });
                        localStorage.setItem("eagle.filter.toolbar.orders", JSON.stringify(toolbarOrders));
                    }
                }, 1);
            },
        };
        this.tagFilterLogic = "OR";
        this.folderFilterLogic = "OR";

        // 記錄支援的篩選格式
        this.filterExtensions = {};

        // 資料夾篩選關鍵字
        this.filterFolderKeyword = "";

        // 相機篩選條件
        this.filterCameras = [];
        this.filterCamerasMapping = {};
        this.initOrders();

        // 格式篩選條件
        this.buildInTypes = ['font','video','audio', 'youtube','vimeo','bilibili'];
        this.filterTypes = [];

        // 篩選器計數
        this.filterBadge = 0;
	}

    resetFilterRules() {
        this.filterRules = JSON.parse(JSON.stringify(this.defaultRules));
    }

    resetFilterCounts() {
        this.filterCounts = JSON.parse(JSON.stringify(this.defaultCounts));
    }

    initPinned() {
        const defaultPinned = {
            image: false,
            semantic: false,
            color: true,
            tags: true,
            folders: true,
            shape: true,
            rating: true,
            types: true,
            import: false,
            mtime: false,
            resolution: false,
            duration: false,
            size: false,
            annotation: false,
            note: false,
            url: false,
            fontActivated: false,
            bpm: false,
            camera: false,
        };
        let pinned = localStorage.getItem('eagle.filter.toolbar.pinned');
        if (pinned) {
            try {
                pinned = JSON.parse(pinned);
            }
            catch (err) {
                pinned = defaultPinned;
            }
        }
        else {
            pinned = defaultPinned;
        }
        this.pinned = pinned;
    }       

    savePinned() {
        localStorage.setItem('eagle.filter.toolbar.pinned', JSON.stringify(this.pinned));
    }

    initOrders() {
        const defaultOrders = [
            'color',
            'image',
            'semantic',
            'tags',
            'folders',
            'shape',
            'rating',
            'types',
            'resolution',
            'duration',
            'size',
            'annotation',
            'note',
            'url',
            'import',
            'mtime',
            'fontActivated',
            'bpm',
            'camera'
        ];
        var filterToolbarOrders = localStorage.getItem("eagle.filter.toolbar.orders");
        if (filterToolbarOrders) {
            try {
                filterToolbarOrders = JSON.parse(filterToolbarOrders);
            }
            catch (err) {
                filterToolbarOrders = defaultOrders;
            }
        }
        else {
            filterToolbarOrders = defaultOrders;
        }

        if (filterToolbarOrders.length > 0) {
            var filterToolbarOrdersIndexMap = {};
            
            filterToolbarOrders.forEach((item, index) => {
                filterToolbarOrdersIndexMap[item] = index;
            });

            this.toolbar = this.toolbar.sort((a, b) => filterToolbarOrdersIndexMap[a.type] - filterToolbarOrdersIndexMap[b.type]);

            // set toolbar map
            this.toolbar.forEach((item) => {
                this.toolbarMap[item.type] = item;
            });
        }


        this.filterToolbarOrders = filterToolbarOrders;
    }

    get isOpen() {
        return this.#isOpen;
    }
    set isOpen(value) {
        this.#isOpen = value;
        localStorage["isOpenFilter"] = value;
    }
}

eagle.filter = new ItemFilter();