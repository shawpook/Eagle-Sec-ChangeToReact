class LoadProgress {
    
    $scope = null;
    status = null;
    isOpen = true;
    libraryDiffCurr = 0;
    libraryDiffCount = 0;
    libraryTotal = 0;
    currentLoaded = 0;
    progress = 0;
    loadLibraryStartTime = 0;
    loadLibraryTimeLeftInSeconds = 0;

    constructor($scope) {
        this.$scope = $scope;
        this.init();
        this.initIPC();
        this.status = LoadProgress.STATUS.INIT;
    }

    static get STATUS() {
        return {
            INIT: 'init',
            MODULE_LOADING: 'module-loading',       // .NET Framework 載入中
            MODULE_LOADED: 'module-loaded',         // .NET Framework 載入完成
            LIBRARY_LOADING: 'library-loading',     // Library 開始載入
            DIR_LOADING: 'dir-loading',             // Library images 資料夾列表載入中
            DIR_LOADED: 'dir-loaded',               // Library images 資料夾列表載入完成
            METADATA_LOADING: 'metadata-loading',   // Library Metadata 載入中
            METADATA_LOADED: 'metadata-loaded',     // Library Metadata 載入完成
            CACHE_LOADING: 'cache-loading',         // Library Cache 載入中
            CACHE_LOADED: 'cache-loaded',           // Library Cache 載入完成
            LIBRARY_LOADED: 'library-loaded',       // Library 載入完成
        }
    }

    init() {
        this.isOpen = true;
        this.libraryDiffCurr = 0;
        this.libraryDiffCount = 0;
        this.libraryTotal = 0;
        this.currentLoaded = 0;
        this.progress = 0;
        this.loadLibraryStartTime = 0;
        this.loadLibraryTimeLeftInSeconds = 0;
    }

    open() {
        this.isOpen = true;
    }

    close() {
        setTimeout(() => {
            this.isOpen = false;
            this.$scope.$evalAsync();
        }, 50);
    }

    initIPC() {

        // app-status-module-loading
        ipcRenderer.on('app-status-module-loading', (e, params) => {
            this.status = LoadProgress.STATUS.MODULE_LOADING;
            this.$scope.$evalAsync();
        });

        // app-status-module-loaded
        ipcRenderer.on('app-status-module-loaded', (e, params) => {
            this.status = LoadProgress.STATUS.MODULE_LOADED;
            this.$scope.$evalAsync();
        });
        
        ipcRenderer.on('app-status-welcome', (e, params) => {
            this.close();
            this.$scope.$evalAsync();
        });

        // 剛開始載入資源庫
        ipcRenderer.on('app-status-loading', (e) => {
            this.init();
            this.open();
            this.status = LoadProgress.STATUS.LIBRARY_LOADING;
            this.$scope.$evalAsync();
        });

        ipcRenderer.on('checking-library-cache', (e, total) => {
            if (!total || total <= 0) return;
            this.libraryDiffCurr = 0;
            this.libraryDiffCount = total;
            this.$scope.$evalAsync();
        });

        ipcRenderer.on('checking-library-cache-increase', (e) => {
            this.libraryDiffCurr += 10;
            if (this.libraryDiffCurr >= this.libraryDiffCount) {
                this.libraryDiffCurr = this.libraryDiffCount;
            }
            this.$scope.$evalAsync();
        });

        // 資源庫 images 資料夾列表載入中
        ipcRenderer.on('app-status-library-dirs-loading', (e) => {
            this.status = LoadProgress.STATUS.DIR_LOADING;
            this.$scope.$evalAsync();
        });


        // 資源庫 images 資料夾列表載入完成
        let loadLibraryWithoutCacheTimeout;
        ipcRenderer.on('app-status-library-dirs-loaded', (e, count) => {
            this.loadLibraryStartTime = Date.now();
            if (count) {
                this.libraryTotal = count;
                this.currentLoaded = 0;
                loadLibraryWithoutCacheTimeout = setInterval(() => {
                    this.#calculateLoadLibraryTimeLeft();
                    this.$scope.$evalAsync();
                }, 1000);
            }
            this.status = LoadProgress.STATUS.DIR_LOADED;
            this.$scope.$evalAsync();
        });

        // 單個 metadata.json 載入完成
        ipcRenderer.on('app-status-library-metadata-loading', (e) => {
            if (this.libraryTotal > 0 && this.currentLoaded < this.libraryTotal) {
                this.status = LoadProgress.STATUS.METADATA_LOADING;
                this.currentLoaded += 10;
                if (this.currentLoaded > this.libraryTotal) {
                    this.currentLoaded = this.libraryTotal;
                }
                this.progress = 20 + (this.currentLoaded * 100 * 7 / this.libraryTotal) / 10;
                this.$scope.$evalAsync();
            }
        });

        // 所有 metadata.json 載入完成
        ipcRenderer.on('app-status-library-metadata-loaded', (e) => {
            this.progress = 95;
            this.status = LoadProgress.STATUS.METADATA_LOADED;
            this.$scope.$evalAsync();
        });

        // 資源庫完全載入完成
        ipcRenderer.on('app-status-library-loaded', async (e, params) => {
            this.loadLibraryStartTime = 0;
            this.loadLibraryTimeLeftInSeconds = 0;
            clearInterval(loadLibraryWithoutCacheTimeout);
            this.status = LoadProgress.STATUS.LIBRARY_LOADED;
            this.$scope.$evalAsync();
            this.close();
        });

        ipcRenderer.on('app-status-library-cache-loading', (e) => {
            this.status = LoadProgress.STATUS.CACHE_LOADING;
            this.$scope.$evalAsync();
        });

        // 緩存載入完成
        ipcRenderer.on('app-status-library-cache-loaded', (e) => {
            this.progress = 80;
            this.status = LoadProgress.STATUS.CACHE_LOADED;
            this.$scope.$evalAsync();
        });
    }

    #calculateLoadLibraryTimeLeft() {
        var et = Date.now() - this.loadLibraryStartTime;
        var cpt = this.currentLoaded / et;
        var ett = this.libraryTotal / cpt;
        this.loadLibraryTimeLeftInSeconds = parseInt((ett - et) / 1000);
    }
}

EagleApp.directive('libraryLoadProgress', () => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/library-load-progress.html',
        scope: {},
        link: ($scope) => {
            const loadProgress = new LoadProgress($scope);
            $scope.loadProgress = loadProgress;

            // $scope.$watch('loadProgress.status', (newValue, oldValue) => {
            //     console.log(`status: ${oldValue} -> ${newValue}`);
            // });
        }
    };
});