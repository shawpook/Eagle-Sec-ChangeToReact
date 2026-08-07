/**
 * AI Search API Client
 * 提供與 AI Search 插件互動的功能，包括文字搜尋、圖片搜尋和狀態監控
 * @class
 */
class AISearch {
    // 配置常數
    static #CONFIG = {
        PLUGIN_ID: 'ai-search',
        API_SERVER_URL: 'http://localhost:38766',
        DEFAULT_SEARCH_LIMIT: 20,
        INTERVALS: {
            READY: 5000,      // 服務就緒時的檢查間隔
            NOT_READY: 1000   // 服務未就緒時的檢查間隔
        },
        TIMEOUTS: {
            DEFAULT: 5000,
            SEARCH: 30000,
            HEALTH: 1000
        },
        ENDPOINTS: {
            STATUS: '/api/status',
            HEALTH: '/api/health',
            SEARCH: {
                TEXT: '/api/search/text',
                IMAGE: '/api/search/image',
                ID: '/api/search/id'
            },
            SYNC: {
                FULL: '/api/sync/full'
            }
        },
        ERRORS: {
            TIMEOUT: 'TIMEOUT',
            NETWORK_ERROR: 'NETWORK_ERROR',
            SEARCH_FAILED: 'SEARCH_FAILED',
            PLUGIN_NOT_INSTALLED: 'PLUGIN_NOT_INSTALLED',
            SERVICE_NOT_READY: 'SERVICE_NOT_READY'
        }
    };

    // 私有屬性
    #pluginId = AISearch.#CONFIG.PLUGIN_ID;
    #apiServerUrl = AISearch.#CONFIG.API_SERVER_URL;
    #statusWatcher = null;
    #listeners = new Map(); // 事件監聽器

    // 公開屬性
    isInstalled = false;
    isInitialized = false;
    status = {};
    isSearching = false;
    isReady = false;
    isStarting = false;

    /**
     * 檢查是否正在同步中
     * @returns {boolean} 是否正在同步
     * @public
     */
    get isSyncing() {
        return eagle?.aiSearch?.status?.sync?.status === 'syncing';
    }

    /**
     * 初始化 AI Search 服務
     * @public
     */
    init() {
        this.isInstalled = pluginModule.checkPluginInstalled(this.#pluginId);
        this.isInitialized = true;

        if (this.isInstalled) {
            this.#startStatusWatcher();
        }

        ipcRenderer.on('plugin-installed', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = true;
                this.isReady = false;
                this.isStarting = true;
                this.#startStatusWatcher();
                this.open();
                ipcRenderer.send('open.preferences', {
                    panel: "ai-search"
                });
                $bodyScope.$evalAsync();
            }
        });

        ipcRenderer.on('plugin-uninstalled', (event, pluginId) => {
            if (pluginId === this.#pluginId) {
                this.isInstalled = false;
                this.isReady = false;
                this.stopWatching();
                $bodyScope.$evalAsync();
            }
        });
    }

    /**
     * 開啟 AI Search 插件
     * @public
     */
    open() {
        if (!pluginModule.checkPluginInstalled(this.#pluginId)) {
            pluginModule.showInstallPluginDialog(this.#pluginId);
            return;
        }
        pluginModule.openPluginById(this.#pluginId, {});
    }

    /**
     * 停止狀態監控
     * @public
     */
    stopWatching() {
        if (this.#statusWatcher) {
            clearInterval(this.#statusWatcher);
            this.#statusWatcher = null;
        }
    }

    /**
     * 註冊事件監聽器
     * @param {string} event - 事件名稱 ('statusChange', 'error')
     * @param {Function} callback - 回調函數
     * @public
     */
    on(event, callback) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);
    }

    /**
     * 移除事件監聽器
     * @param {string} event - 事件名稱
     * @param {Function} callback - 回調函數
     * @public
     */
    off(event, callback) {
        if (this.#listeners.has(event)) {
            this.#listeners.get(event).delete(callback);
        }
    }

    /**
     * 文字搜尋
     * @param {string} query - 搜尋關鍵字
     * @param {Object} options - 搜尋選項
     * @param {number} [options.limit=20] - 結果數量限制
     * @returns {Promise<Object>} 搜尋結果
     * @throws {Error} 搜尋失敗時拋出錯誤
     * @public
     */
    async searchByText(query, options = {}) {
        this.#validateServiceReady();
        this.#validateTextQuery(query);

        const { signal, ...restOptions } = options;
        const searchParams = {
            ...this.#getDefaultSearchOptions(),
            ...restOptions,
            query
        };

        return this.#executeSearch(
            AISearch.#CONFIG.ENDPOINTS.SEARCH.TEXT,
            searchParams,
            'POST',
            { 'Content-Type': 'application/json' },
            signal
        );
    }

    /**
     * 圖片搜尋
     * @param {File} imageFile - 圖片檔案
     * @param {Object} options - 搜尋選項
     * @param {number} [options.limit=20] - 結果數量限制
     * @returns {Promise<Object>} 搜尋結果
     * @throws {Error} 搜尋失敗時拋出錯誤
     * @public
     */
    async searchByImage(imageFile, options = {}) {
        this.#validateServiceReady();
        this.#validateImageFile(imageFile);

        const { signal, ...restOptions } = options;
        const formData = this.#createImageSearchFormData(imageFile, restOptions);

        return this.#executeSearch(
            AISearch.#CONFIG.ENDPOINTS.SEARCH.IMAGE,
            formData,
            'POST',
            {},
            signal
        );
    }

    /**
     * 以 Base64 圖片搜尋
     * @param {string} base64String - Base64 編碼的圖片字符串
     * @param {Object} options - 搜尋選項
     * @returns {Promise<Object>} 搜尋結果
     * @public
     */
    async searchByBase64(base64String, options = {}) {
        this.#validateServiceReady();
        if (!base64String) {
            throw new Error('Base64 string is required');
        }

        const file = this.#convertBase64ToFile(base64String);
        return this.searchByImage(file, options);
    }

    /**
     * 以 Item ID 搜尋相似圖片
     * @param {string} itemId - Eagle 項目 ID
     * @param {Object} options - 搜尋選項
     * @returns {Promise<Object>} 搜尋結果
     * @public
     */
    async searchByItemId(itemId, options = {}) {
        this.#validateServiceReady();
        if (!itemId) {
            throw new Error('Item ID is required');
        }

        const { signal, ...restOptions } = options;
        const searchParams = {
            ...this.#getDefaultSearchOptions(),
            ...restOptions,
            eagleId: itemId
        };

        return this.#executeSearch(
            AISearch.#CONFIG.ENDPOINTS.SEARCH.ID,
            searchParams,
            'POST',
            { 'Content-Type': 'application/json' },
            signal
        );
    }

    /**
     * 檢查 API 服務是否可用
     * @returns {Promise<boolean>} 服務是否可用
     * @public
     */
    async checkServiceHealth() {
        this.#validateInstalled();
        try {
            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.HEALTH}`,
                {},
                AISearch.#CONFIG.TIMEOUTS.HEALTH
            );
            
            if (response.ok) {
                const health = await response.json();
                return health.success === true;
            }
            return false;
        } catch (error) {
            console.warn('API health check failed:', error);
            return false;
        }
    }

    /**
     * 獲取同步狀態
     * @returns {Promise<Object>} 同步狀態
     * @public
     */
    async getSyncStatus() {
        this.#validateInstalled();
        try {
            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.STATUS}`
            );

            if (!response.ok) {
                throw new Error(`Failed to get status: ${response.status}`);
            }

            const result = await response.json();
            return result.status;
        } catch (error) {
            console.error('Failed to get sync status:', error);
            throw error;
        }
    }

    /**
     * 觸發全量同步
     * 用於刪除素材後（如清空垃圾桶）調用，確保索引與資料庫同步
     * @returns {Promise<Object|null>} 同步觸發結果，若插件未安裝或服務未就緒則返回 null
     * @public
     */
    async fullSync() {
        // 檢查插件是否已安裝且服務就緒
        if (!this.isInstalled || !this.isReady) {
            return null;
        }

        try {
            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.SYNC.FULL}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to trigger full sync: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to trigger full sync:', error);
            return null;
        }
    }

    // ========== 私有方法 ==========

    /**
     * 啟動狀態監控器
     * @private
     */
    #startStatusWatcher() {
        const checkStatus = async () => {
            try {
                const response = await fetch(
                    `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.STATUS}`
                );
                const data = await response.json();
                
                this.#updateStatus(data.status);
            } catch (error) {
                console.error('Error checking status:', error);
                this.#handleStatusError();
            }
        };

        // 立即執行第一次檢查
        checkStatus();

        // 設置初始間隔（假設初始狀態為 not ready）
        this.#statusWatcher = setInterval(
            checkStatus,
            AISearch.#CONFIG.INTERVALS.NOT_READY
        );
    }

    /**
     * 更新服務狀態
     * @param {Object} newStatus - 新的狀態對象
     * @private
     */
    #updateStatus(newStatus) {
        const wasReady = this.isReady;
        const wasStarting = this.isStarting;
        const wasError = this.isError;
        this.status = newStatus;
        
        // 檢查服務是否就緒
        this.isReady = this.#checkIfReady(newStatus);
        // 檢查服務是否正在啟動中
        this.isStarting = this.#checkIfStarting(newStatus);
        // 檢查是否有錯誤
        this.isError = this.#checkIfError(newStatus);
        
        // 如果狀態改變，調整檢查頻率和觸發更新
        if (wasReady !== this.isReady || wasStarting !== this.isStarting || wasError !== this.isError) {
            this.#adjustCheckInterval();
            this.#emit('statusChange', {
                isReady: this.isReady,
                isStarting: this.isStarting,
                isError: this.isError,
                status: this.status
            });
            $bodyScope.$evalAsync();
        }
    }

    /**
     * 處理狀態檢查錯誤
     * @private
     */
    #handleStatusError() {
        const wasReady = this.isReady;
        const wasStarting = this.isStarting;
        this.isReady = false;
        this.isStarting = false;
        
        if (wasReady !== this.isReady || wasStarting !== this.isStarting) {
            this.#adjustCheckInterval();
            this.#emit('error', {
                type: 'STATUS_CHECK_ERROR',
                isReady: this.isReady,
                isStarting: this.isStarting
            });
        }
    }

    /**
     * 檢查服務是否就緒
     * @param {Object} status - 狀態對象
     * @returns {boolean} 是否就緒
     * @private
     */
    #checkIfReady(status) {
        return status?.pythonServer?.healthy && status?.apiServer?.healthy;
    }

    /**
     * 檢查服務是否正在啟動中
     * @param {Object} status - 狀態對象
     * @returns {boolean} 是否正在啟動中
     * @private
     */
    #checkIfStarting(status) {
        return !status?.pythonServer?.healthy && status?.apiServer?.healthy;
    }

    /**
     * 檢查是否有錯誤
     * @param {Object} status - 狀態對象
     * @returns {boolean} 是否有錯誤
     * @private
     */
    #checkIfError(status) {
        // 檢查是否有任何錯誤
        const hasErrors = status?.errors || status?.apiServer?.hasErrors;
        
        if (hasErrors) {
            let errorMessage = '';
            let stopWatch = false;
            
            // 從新格式中提取錯誤訊息
            if (status?.errors?.pythonServer) {
                errorMessage = status.errors.pythonServer?.message?.message || 'Unknown Python server error';
                stopWatch = true;
            } 
            // 初始化錯誤
            else if (status?.errors?.initialization) {
                errorMessage = status.errors.initialization?.message?.message || 'Unknown initialization error';
                stopWatch = true;
            }
            // 超過允許同步的上限
            else if (status?.errors?.tooManyItems) {
                errorMessage = status.errors.tooManyItems?.message?.message || 'Unknown too many items error';
            } else {
                errorMessage = 'AI Search service error';
            }
            
            // 只在首次檢測到錯誤時顯示提示（避免重複提示）
            if (!this.isError) {
                
                // 停止狀態監控
                if (stopWatch) {
                    this.stopWatching();
                }

                this.isStarting = false;
                this.isReady = false;
                $bodyScope.$evalAsync();
                
                // 顯示錯誤訊息
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__("dialog.aiSearchServerError.title")}</h4>
                            <p class="alert-desc">${i18n.__("dialog.aiSearchServerError.desc")}: ${errorMessage}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__("dialog.aiSearchServerError.button"),
                }).then(() => {
                    this.open();
                });
            }
            
            // 觸發錯誤事件
            this.#emit('error', {
                type: 'AI_SEARCH_ERROR',
                message: errorMessage,
                details: status.errors
            });
            
            return true;
        }
        
        // 如果之前有錯誤但現在沒有了，觸發錯誤清除事件
        if (this.isError && !hasErrors) {
            this.#emit('errorCleared', {
                type: 'AI_SEARCH_ERROR',
                status: status
            });
            
            // 如果錯誤已清除且 watcher 未運行，重新啟動監控
            if (!this.#statusWatcher && this.isInstalled) {
                this.#startStatusWatcher();
            }
        }
        
        return false;
    }

    /**
     * 調整檢查間隔
     * @private
     */
    #adjustCheckInterval() {
        if (this.#statusWatcher) {
            clearInterval(this.#statusWatcher);
            
            const interval = this.isReady 
                ? AISearch.#CONFIG.INTERVALS.READY 
                : AISearch.#CONFIG.INTERVALS.NOT_READY;
            
            const checkStatus = async () => {
                try {
                    const response = await fetch(
                        `${this.#apiServerUrl}${AISearch.#CONFIG.ENDPOINTS.STATUS}`
                    );
                    const data = await response.json();
                    
                    this.#updateStatus(data.status);
                } catch (error) {
                    console.error('Error checking status:', error);
                    this.#handleStatusError();
                }
            };
            
            this.#statusWatcher = setInterval(checkStatus, interval);
        }
    }

    /**
     * 觸發事件
     * @param {string} event - 事件名稱
     * @param {*} data - 事件數據
     * @private
     */
    #emit(event, data) {
        if (this.#listeners.has(event)) {
            this.#listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * 執行搜尋請求
     * @param {string} endpoint - API 端點
     * @param {*} data - 請求數據
     * @param {string} method - HTTP 方法
     * @param {Object} headers - 請求頭
     * @returns {Promise<Object>} 搜尋結果
     * @private
     */
    async #executeSearch(endpoint, data, method = 'POST', headers = {}, signal) {
        try {
            this.isSearching = true;

            const requestOptions = {
                method,
                headers
            };

            // 根據數據類型設置請求體
            if (data instanceof FormData) {
                requestOptions.body = data;
            } else {
                requestOptions.body = JSON.stringify(data);
            }

            const response = await this.#fetchWithTimeout(
                `${this.#apiServerUrl}${endpoint}`,
                requestOptions,
                AISearch.#CONFIG.TIMEOUTS.SEARCH,
                signal
            );

            return await this.#handleSearchResponse(response);
        } finally {
            this.isSearching = false;
        }
    }

    /**
     * 處理搜尋響應
     * @param {Response} response - fetch 響應
     * @returns {Promise<Object>} 搜尋結果
     * @private
     */
    async #handleSearchResponse(response) {
        if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(
                errorData.message || 
                `Search failed: ${response.status} ${response.statusText}`
            );
            error.status = response.status;
            error.data = errorData;
            error.code = AISearch.#CONFIG.ERRORS.SEARCH_FAILED;
            throw error;
        }

        return await response.json();
    }

    /**
     * 具有超時功能的 fetch 包裝器
     * @param {string} url - 請求 URL
     * @param {Object} options - fetch 選項
     * @param {number} timeoutMs - 超時時間（毫秒）
     * @returns {Promise<Response>} fetch 響應
     * @private
     */
    async #fetchWithTimeout(
        url,
        options = {},
        timeoutMs = AISearch.#CONFIG.TIMEOUTS.DEFAULT,
        externalSignal
    ) {
        const controller = new AbortController();

        // 設置超時自動 abort
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // 若有外部 signal，監聽其 abort 事件來連動
        if (externalSignal) {
            if (externalSignal.aborted) {
                clearTimeout(timeoutId);
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                throw err;
            }
            externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } catch (error) {
            // 外部 abort 時直接拋出，不做 enhanceError 轉換
            if (externalSignal?.aborted) {
                throw error;
            }
            throw this.#enhanceError(error, timeoutMs);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * 增強錯誤信息
     * @param {Error} error - 原始錯誤
     * @param {number} timeoutMs - 超時時間
     * @returns {Error} 增強後的錯誤
     * @private
     */
    #enhanceError(error, timeoutMs) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            const timeoutError = new Error(
                `Request timeout (${timeoutMs / 1000} seconds)`
            );
            timeoutError.code = AISearch.#CONFIG.ERRORS.TIMEOUT;
            return timeoutError;
        }
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            const networkError = new Error('Cannot connect to API server');
            networkError.code = AISearch.#CONFIG.ERRORS.NETWORK_ERROR;
            return networkError;
        }
        
        return error;
    }

    /**
     * 獲取默認搜尋選項
     * @returns {Object} 默認選項
     * @private
     */
    #getDefaultSearchOptions() {
        return {
            limit: AISearch.#CONFIG.DEFAULT_SEARCH_LIMIT
        };
    }

    /**
     * 驗證插件是否已安裝
     * @throws {Error} 插件未安裝時拋出錯誤
     * @private
     */
    #validateInstalled() {
        if (!this.isInstalled) {
            const error = new Error('AI Search plugin is not installed');
            error.code = AISearch.#CONFIG.ERRORS.PLUGIN_NOT_INSTALLED;
            throw error;
        }
    }

    /**
     * 驗證服務是否就緒
     * @throws {Error} 服務未就緒時拋出錯誤
     * @private
     */
    #validateServiceReady() {
        this.#validateInstalled();
        if (!this.isReady) {
            const error = new Error('AI Search service is not ready');
            error.code = AISearch.#CONFIG.ERRORS.SERVICE_NOT_READY;
            throw error;
        }
    }

    /**
     * 驗證文字查詢
     * @param {string} query - 查詢字串
     * @throws {Error} 查詢無效時拋出錯誤
     * @private
     */
    #validateTextQuery(query) {
        if (!query || query.trim() === '') {
            throw new Error('Search query cannot be empty');
        }
    }

    /**
     * 驗證圖片檔案
     * @param {File} imageFile - 圖片檔案
     * @throws {Error} 檔案無效時拋出錯誤
     * @private
     */
    #validateImageFile(imageFile) {
        if (!imageFile) {
            throw new Error('Please select an image file');
        }

        if (!imageFile.type.startsWith('image/')) {
            throw new Error('Please select a valid image file');
        }
    }

    /**
     * 創建圖片搜尋表單數據
     * @param {File} imageFile - 圖片檔案
     * @param {Object} options - 搜尋選項
     * @returns {FormData} 表單數據
     * @private
     */
    #createImageSearchFormData(imageFile, options) {
        const searchOptions = {
            ...this.#getDefaultSearchOptions(),
            ...options
        };

        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('limit', searchOptions.limit.toString());

        return formData;
    }

    /**
     * 將 Base64 字串轉換為 File 對象
     * @param {string} base64String - Base64 編碼的圖片
     * @returns {File} 文件對象
     * @private
     */
    #convertBase64ToFile(base64String) {
        // 移除 data URL 前綴
        const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
        
        // 檢測圖片格式
        let mimeType = 'image/png';
        if (base64String.startsWith('data:image/')) {
            const matches = base64String.match(/^data:image\/([a-z]+);base64,/);
            if (matches && matches[1]) {
                mimeType = `image/${matches[1]}`;
            }
        }

        try {
            // 將 base64 轉換為 blob
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            
            // 創建 File 對象
            const fileName = `image_${Date.now()}.${mimeType.split('/')[1]}`;
            return new File([blob], fileName, { type: mimeType });
        } catch (error) {
            if (error.message.includes('atob')) {
                throw new Error('Invalid base64 string');
            }
            throw error;
        }
    }
}

// 創建全局實例
eagle.aiSearch = new AISearch();