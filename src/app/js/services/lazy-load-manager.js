/**
 * LazyLoadManager - 使用 IntersectionObserver API 實現高效的圖片懶加載
 * 替代原有的 scroll event + scrollTop 方式，提升滾動性能
 */
(function() {
    'use strict';
    
    class LazyLoadManager {
        constructor(options = {}) {
            // 配置選項
            this.options = {
                root: null, // 預設為 viewport
                rootMargin: '50px', // 提前 50px 開始載入
                threshold: [0, 0.01, 0.1], // 多個閾值點
                debug: false, // 調試模式
                ...options
            };
            
            // 內部狀態
            this.observer = null;
            this.loadingQueue = new Map(); // 追蹤載入中的請求
            this.loadingTimeouts = new Map(); // 追蹤延遲載入的 timeout
            this.pendingQueue = []; // 等待載入的隊列
            this.maxConcurrentLoads = 6; // 最大並發載入數
            this.loadedCache = new Map(); // 已載入圖片的緩存記錄
            this.cacheExpiry = 5 * 60 * 1000; // 緩存過期時間：5分鐘
            this.performanceData = {
                avgLoadTime: 0,
                loadCount: 0,
                totalLoadTime: 0
            };
            this.hardDiskSpeed = 'normal'; // 'normal' 或 'fast'
            
            // 初始化觀察器
            this.initObserver();
            
            // 綁定方法到實例
            this.observe = this.observe.bind(this);
            this.unobserve = this.unobserve.bind(this);
            this.disconnect = this.disconnect.bind(this);
            this.loadImage = this.loadImage.bind(this);
            this.cancelLoad = this.cancelLoad.bind(this);
            
            // 當頁面被隱藏時清理部分緩存（節省記憶體）
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.cleanupCache();
                }
            });
            
            // 定期清理過期緩存（每5分鐘）
            this.cacheCleanupInterval = setInterval(() => {
                this.cleanupCache();
            }, 5 * 60 * 1000);
            
            // 暫時註釋掉，找出根本原因
            // this.missedCheckInterval = setInterval(() => {
            //     const missed = document.querySelectorAll('.box:not(.show):not([loading])');
            //     if (missed.length > 0) {
            //         // 檢查是否有可見但未載入的
            //         let visibleMissed = 0;
            //         missed.forEach(box => {
            //             const rect = box.getBoundingClientRect();
            //             if (rect.top < window.innerHeight && rect.bottom > 0) {
            //                 this.observe(box);
            //                 visibleMissed++;
            //             }
            //         });
            //         
            //         if (visibleMissed > 0) {
            //             this.log(`🔍 發現並修復 ${visibleMissed} 個遺漏的可見元素`);
            //         }
            //     }
            // }, 3000);
        }
        
        /**
         * 調試日誌
         */
        log(...args) {
            if (this.options.debug) {
                console.log('[LazyLoadManager]', ...args);
            }
        }
        
        /**
         * 初始化 IntersectionObserver
         */
        initObserver() {
            if (!window.IntersectionObserver) {
                console.warn('IntersectionObserver API not supported');
                return;
            }
            
            this.observer = new IntersectionObserver((entries) => {
                this.handleIntersection(entries);
            }, this.options);
        }
        
        /**
         * 處理元素可見性變化
         */
        handleIntersection(entries) {
            // 批次處理優化
            const toLoad = [];
            const toCancel = [];
            
            entries.forEach(entry => {
                const box = entry.target;
                
                // 檢查元素是否仍在 DOM 中
                if (!box.isConnected) {
                    this.unobserve(box);
                    return;
                }
                
                const boxId = box.getAttribute('data-box-id');
                
                if (entry.isIntersecting) {
                    // 元素進入可視區域
                    if (!box.classList.contains('show') && !box.hasAttribute('loading')) {
                        toLoad.push({ box, ratio: entry.intersectionRatio });
                        // this.log(`📥 進入視窗: ${boxId}, 可見度: ${(entry.intersectionRatio * 100).toFixed(1)}%`);
                    }
                } else {
                    // 元素離開可視區域
                    if (box.hasAttribute('loading') || this.loadingQueue.has(boxId) || this.loadingTimeouts.has(boxId)) {
                        toCancel.push(box);
                        // this.log(`📤 離開視窗: ${boxId}`);
                    }
                }
            });
            
            // 批次取消
            if (toCancel.length > 0) {
                // this.log(`🚫 批次取消 ${toCancel.length} 個載入任務`);
                toCancel.forEach(box => this.cancelLoad(box));
            }
            
            // 批次排程載入（根據優先級排序）
            if (toLoad.length > 0) {
                // this.log(`📋 排程載入 ${toLoad.length} 個圖片`);
                toLoad
                    .sort((a, b) => b.ratio - a.ratio) // 優先載入可見度高的
                    .forEach(({ box, ratio }) => this.scheduleLoad(box, ratio));
            }
        }
        
        /**
         * 排程載入（考慮優先級和延遲）
         */
        scheduleLoad(box, intersectionRatio) {
            const boxId = box.getAttribute('data-box-id');
            
            // 如果已經在載入隊列中，跳過
            if (this.loadingQueue.has(boxId) || this.loadingTimeouts.has(boxId)) {
                return;
            }
            
            // 計算載入延遲（基於距離和硬碟速度）
            const delay = this.calculateDelay(box, intersectionRatio);
            
            if (delay === 0) {
                // 立即載入
                this.loadImage(box);
            } else {
                // 延遲載入
                const timeout = setTimeout(() => {
                    this.loadingTimeouts.delete(boxId);
                    this.loadImage(box);
                }, delay);
                
                this.loadingTimeouts.set(boxId, timeout);
            }
        }
        
        /**
         * 計算載入延遲
         */
        calculateDelay(box, intersectionRatio) {
            // 完全可見的元素立即載入
            if (intersectionRatio >= 0.1) {
                return 0;
            }
            
            // 根據硬碟速度調整延遲
            if (this.hardDiskSpeed === 'fast') {
                return intersectionRatio > 0.01 ? 10 : 50;
            } else {
                return intersectionRatio > 0.01 ? 30 : 100;
            }
        }
        
        /**
         * 載入圖片
         */
        loadImage(box) {
            const boxId = box.getAttribute('data-box-id');
            
            // 檢查是否已經載入或正在載入
            if (box.classList.contains('show') || box.hasAttribute('loading')) {
                return;
            }
            
            // 檢查緩存記錄
            const cachedData = this.loadedCache.get(boxId);
            this.log(`🔍 檢查緩存: ${boxId}, 找到: ${cachedData ? '是' : '否'}, 緩存大小: ${this.loadedCache.size}`);
            
            if (cachedData && Date.now() - cachedData.timestamp < this.cacheExpiry) {
                // 圖片在緩存有效期內
                const img = box.querySelector('img');
                if (img) {
                    const lsrc = img.getAttribute('lsrc');
                    
                    // 確保有正確的 src
                    if (!img.src || img.src.includes('index.html')) {
                        if (lsrc) {
                            img.src = lsrc;
                        }
                    }
                    
                    // 如果圖片已載入完成，直接顯示
                    if (img.complete && img.naturalHeight !== 0) {
                        // 圖片已在瀏覽器緩存中，直接顯示無動畫
                        this.log(`⚡ 快速顯示（緩存）: ${boxId}`);
                        box.classList.add('show', 'from-cache');
                        this.unobserve(box);
                        
                        // 更新緩存時間戳
                        cachedData.timestamp = Date.now();
                        return;
                    } else if (lsrc) {
                        // 圖片需要載入，設置 src
                        img.src = lsrc;
                        // 給瀏覽器一點時間載入
                        setTimeout(() => {
                            if (img.complete && img.naturalHeight !== 0) {
                                this.log(`⚡ 快速顯示（緩存）: ${boxId}`);
                                box.classList.add('show', 'from-cache');
                                this.unobserve(box);
                                cachedData.timestamp = Date.now();
                            } else {
                                // 如果還沒載入完，走正常載入流程
                                this.loadedCache.delete(boxId);
                                this.loadImage(box);
                            }
                        }, 10);
                        return;
                    }
                }
            }
            
            // 檢查並發限制
            if (this.loadingQueue.size >= this.maxConcurrentLoads) {
                // 加入等待隊列
                if (!this.pendingQueue.some(item => item.box === box)) {
                    this.pendingQueue.push({ box, priority: this.calculatePriority(box) });
                    // 根據優先級排序
                    this.pendingQueue.sort((a, b) => b.priority - a.priority);
                    this.log(`⏳ 等待隊列: ${boxId} (隊列長度: ${this.pendingQueue.length})`);
                }
                return;
            }
            
            // this.log(`🎯 開始載入: ${boxId}`);
            
            // 標記為載入中
            box.setAttribute('loading', 'true');
            
            // 建立 AbortController 用於取消請求
            const controller = new AbortController();
            this.loadingQueue.set(boxId, controller);
            
            // 開始計時
            const startTime = Date.now();
            
            // 執行載入
            this.performLoad(box, controller.signal)
                .then(() => {
                    // 載入成功
                    const loadTime = Date.now() - startTime;
                    this.updatePerformanceData(loadTime);
                    
                    // this.log(`✅ 載入成功: ${boxId}, 耗時: ${loadTime}ms`);
                    
                    // 標記為已載入
                    box.classList.add('show');
                    box.removeAttribute('loading');
                    
                    // 記錄到緩存（只記錄 boxId 和時間戳）
                    const cacheData = {
                        timestamp: Date.now(),
                        loadTime: loadTime
                    };
                    this.loadedCache.set(boxId, cacheData);
                    
                    this.log(`💾 記錄到緩存: ${boxId}, 耗時: ${loadTime}ms, 緩存大小: ${this.loadedCache.size}`);
                    
                    // 停止觀察此元素
                    this.unobserve(box);
                    
                    // 清理載入隊列
                    this.loadingQueue.delete(boxId);
                    
                    // 處理等待隊列
                    this.processNextInQueue();
                })
                .catch((error) => {
                    if (error.name === 'AbortError') {
                        // this.log(`❌ 載入取消: ${boxId} (原因: ${error.message || '滾出視窗'})`);
                    } else {
                        // this.log(`⚠️ 載入失敗: ${boxId}, 錯誤: ${error.message}`);
                        console.error('Image load error:', error);
                        
                        // 載入失敗也要標記為已處理
                        box.classList.add('show', 'error');
                        box.removeAttribute('loading');
                        this.unobserve(box);
                    }
                    
                    // 清理載入隊列
                    this.loadingQueue.delete(boxId);
                    
                    // 處理等待隊列
                    this.processNextInQueue();
                });
        }
        
        /**
         * 執行實際的圖片載入
         */
        async performLoad(box, signal) {
            const img = box.querySelector('img');
            if (!img) return;
            
            // 檢查是否需要使用特殊載入方式
            const isExtIcon = img.hasAttribute('ext-icon');
            
            if (isExtIcon) {
                // 使用 FILE_ICON.getFileThumbnail 載入
                return this.loadExtIcon(box, img, signal);
            } else {
                // 一般圖片載入
                return this.loadNormalImage(box, img, signal);
            }
        }
        
        /**
         * 載入一般圖片
         */
        loadNormalImage(box, img, signal) {
            return new Promise((resolve, reject) => {
                // 檢查是否已取消
                if (signal.aborted) {
                    reject(new DOMException('Aborted', 'AbortError'));
                    return;
                }
                
                const src = img.getAttribute('lsrc');
                if (!src) {
                    resolve();
                    return;
                }
                
                // 處理大尺寸圖片的特殊邏輯
                // b1-9d：去 Angular 後 window.angular 缺席；window.$bodyScope 由 main.tsx
                // 在兩個世界歸一為同一物件（bundle 在世時語義零改變）。
                const $bodyScope = window.$bodyScope || angular.element('body').scope();
                if ($bodyScope && $bodyScope.imageSize && $bodyScope.imageSize.height > 440) {
                    const rawSrc = img.getAttribute('raw');
                    if (rawSrc) {
                        img.src = rawSrc;
                        box.classList.add('enlarge-thumbnail');
                    } else {
                        img.src = src;
                    }
                } else {
                    img.src = src;
                }
                
                // 如果圖片已經載入完成
                if (img.complete && img.naturalHeight !== 0) {
                    requestAnimationFrame(() => {
                        if (!signal.aborted) {
                            box.classList.add('show');
                            box.removeAttribute('loading');
                            resolve();
                        }
                    });
                    return;
                }
                
                // 監聽載入事件
                const onLoad = () => {
                    cleanup();
                    if (!signal.aborted) {
                        requestAnimationFrame(() => {
                            box.classList.add('show', 'with-animation');
                            box.removeAttribute('loading');
                            const dummy = img.parentElement;
                            if (dummy) {
                                $(dummy).removeClass('dummy').prop('title', '');
                            }
                            resolve();
                        });
                    }
                };
                
                const onError = () => {
                    cleanup();
                    if (!signal.aborted) {
                        box.classList.add('show', 'error');
                        box.removeAttribute('loading');
                    }
                    reject(new Error('Image load failed'));
                };
                
                const onAbort = () => {
                    cleanup();
                    img.src = ''; // 取消載入
                    reject(new DOMException('Aborted', 'AbortError'));
                };
                
                const cleanup = () => {
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onError);
                    signal.removeEventListener('abort', onAbort);
                };
                
                // 綁定事件
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);
                signal.addEventListener('abort', onAbort);
            });
        }
        
        /**
         * 載入特殊檔案圖標
         */
        loadExtIcon(box, img, signal) {
            return new Promise((resolve, reject) => {
                if (signal.aborted) {
                    reject(new DOMException('Aborted', 'AbortError'));
                    return;
                }
                
                const boxId = box.getAttribute('data-box-id');
                // b1-9d：同上——window.$bodyScope 優先，angular 缺席時不拋。
                const $bodyScope = window.$bodyScope || angular.element('body').scope();
                
                if (!$bodyScope || !$bodyScope.itemMappings) {
                    reject(new Error('Scope not available'));
                    return;
                }
                
                const item = $bodyScope.itemMappings[boxId];
                if (!item) {
                    reject(new Error('Item not found'));
                    return;
                }
                
                const rawPath = FileUrlHelper.getRawPath(item);
                
                let isAborted = false;
                
                // 監聽取消事件
                const onAbort = () => {
                    isAborted = true;
                };
                signal.addEventListener('abort', onAbort);
                
                // 使用 FILE_ICON.getFileThumbnail
                FILE_ICON.getFileThumbnail(item, rawPath, (base64) => {
                    signal.removeEventListener('abort', onAbort);
                    
                    if (isAborted || signal.aborted) {
                        reject(new DOMException('Aborted', 'AbortError'));
                        return;
                    }
                    
                    if (base64) {
                        img.src = base64;
                        box.classList.add('show');
                        box.removeAttribute('loading');
                        resolve();
                    } else {
                        box.classList.add('show', 'error');
                        box.removeAttribute('loading');
                        reject(new Error('Failed to generate thumbnail'));
                    }
                });
            });
        }
        
        /**
         * 計算載入優先級（簡化版本）
         */
        calculatePriority(box) {
            // 優先使用 posY，避免 DOM 操作
            const posY = parseInt(box.getAttribute('posY'), 10);
            if (!isNaN(posY)) {
                // 簡單的線性優先級：越靠近當前滾動位置優先級越高
                const scrollTop = window.ig?._watcher?.getScrollPos() || 0;
                return 10000 - Math.abs(posY - scrollTop);
            }
            // 沒有 posY 就給固定優先級
            return 5000;
        }
        
        /**
         * 處理等待隊列中的下一個
         */
        processNextInQueue() {
            if (this.pendingQueue.length === 0 || this.loadingQueue.size >= this.maxConcurrentLoads) {
                return;
            }
            
            // 取出優先級最高的項目
            const next = this.pendingQueue.shift();
            if (next && next.box.isConnected && !next.box.classList.contains('show')) {
                this.loadImage(next.box);
            } else {
                // 如果元素已經不在 DOM 中或已載入，繼續處理下一個
                this.processNextInQueue();
            }
        }
        
        /**
         * 取消載入
         */
        cancelLoad(box) {
            const boxId = box.getAttribute('data-box-id');
            let cancelled = false;
            
            // 取消延遲載入
            const timeout = this.loadingTimeouts.get(boxId);
            if (timeout) {
                clearTimeout(timeout);
                this.loadingTimeouts.delete(boxId);
                cancelled = true;
                // this.log(`🚫 取消延遲載入: ${boxId}`);
            }
            
            // 取消進行中的載入
            const controller = this.loadingQueue.get(boxId);
            if (controller) {
                controller.abort();
                this.loadingQueue.delete(boxId);
                box.removeAttribute('loading');
                cancelled = true;
                // this.log(`🚫 取消進行中載入: ${boxId}`);
            }
            
            // 從等待隊列中移除
            const originalLength = this.pendingQueue.length;
            this.pendingQueue = this.pendingQueue.filter(item => item.box !== box);
            if (this.pendingQueue.length < originalLength) {
                cancelled = true;
                // this.log(`🚫 從等待隊列移除: ${boxId}`);
            }
            
            return cancelled;
        }
        
        /**
         * 更新性能數據
         */
        updatePerformanceData(loadTime) {
            this.performanceData.loadCount++;
            this.performanceData.totalLoadTime += loadTime;
            this.performanceData.avgLoadTime = 
                this.performanceData.totalLoadTime / this.performanceData.loadCount;
            
            // 根據平均載入時間調整硬碟速度設定
            if (this.performanceData.loadCount > 10) {
                if (this.performanceData.avgLoadTime < 200) {
                    this.hardDiskSpeed = 'fast';
                } else {
                    this.hardDiskSpeed = 'normal';
                }
                
                // 重置計數器避免數據過舊
                if (this.performanceData.loadCount > 100) {
                    this.performanceData.loadCount = 0;
                    this.performanceData.totalLoadTime = 0;
                }
            }
            
            // 整合 SlowNotify（如果存在）
            if (window.SlowNotify && typeof window.SlowNotify.calculate === 'function') {
                window.SlowNotify.calculate(this.performanceData.avgLoadTime);
            }
            
            // 更新全域硬碟速度變數（如果存在）
            if (window.hardDiskSpeed !== undefined) {
                window.hardDiskSpeed = this.hardDiskSpeed;
            }
        }
        
        /**
         * 開始觀察元素
         */
        observe(element) {
            if (this.observer && element) {
                // 檢查是否已經載入
                if (!element.classList.contains('show')) {
                    this.observer.observe(element);
                    // this.log('Observing element:', element.getAttribute('data-box-id'));
                }
            }
        }
        
        /**
         * 停止觀察元素
         */
        unobserve(element) {
            if (this.observer && element) {
                this.observer.unobserve(element);
            }
        }
        
        /**
         * 批次觀察元素
         */
        observeAll(elements) {
            if (!this.observer) return;
            
            elements.forEach(element => {
                this.observe(element);
            });
        }
        
        /**
         * 清理過期的緩存記錄
         */
        cleanupCache() {
            const now = Date.now();
            const expiredKeys = [];
            
            this.loadedCache.forEach((data, key) => {
                if (now - data.timestamp > this.cacheExpiry) {
                    expiredKeys.push(key);
                }
            });
            
            expiredKeys.forEach(key => {
                this.loadedCache.delete(key);
            });
            
            if (expiredKeys.length > 0) {
                this.log(`🧹 清理了 ${expiredKeys.length} 個過期緩存記錄`);
            }
        }
        
        /**
         * 軟重置 - 清理觀察器但保留緩存
         */
        softReset() {
            // 取消所有進行中的載入
            this.loadingQueue.forEach((controller, boxId) => {
                controller.abort();
            });
            this.loadingQueue.clear();
            
            // 清除所有延遲載入
            this.loadingTimeouts.forEach((timeout, boxId) => {
                clearTimeout(timeout);
            });
            this.loadingTimeouts.clear();
            
            // 清空等待隊列
            this.pendingQueue = [];
            
            // 斷開觀察器
            if (this.observer) {
                this.observer.disconnect();
            }
            
            this.log(`♻️ 軟重置完成，保留 ${this.loadedCache.size} 個緩存項目`);
        }
        
        /**
         * 取消所有觀察並清理資源
         */
        disconnect() {
            // 取消所有進行中的載入
            this.loadingQueue.forEach((controller, boxId) => {
                controller.abort();
            });
            this.loadingQueue.clear();
            
            // 清除所有延遲載入
            this.loadingTimeouts.forEach((timeout, boxId) => {
                clearTimeout(timeout);
            });
            this.loadingTimeouts.clear();
            
            // 清空等待隊列
            this.pendingQueue = [];
            
            // 清理緩存
            this.loadedCache.clear();
            
            // 清理定時器
            if (this.cacheCleanupInterval) {
                clearInterval(this.cacheCleanupInterval);
            }
            if (this.missedCheckInterval) {
                clearInterval(this.missedCheckInterval);
            }
            
            // 斷開觀察器
            if (this.observer) {
                this.observer.disconnect();
            }
        }
        
        /**
         * 取得性能統計資訊
         */
        getPerformanceStats() {
            return {
                ...this.performanceData,
                hardDiskSpeed: this.hardDiskSpeed,
                pendingLoads: this.loadingQueue.size,
                scheduledLoads: this.loadingTimeouts.size,
                waitingInQueue: this.pendingQueue.length,
                cachedItems: this.loadedCache.size,
                cacheExpiryMinutes: this.cacheExpiry / (60 * 1000)
            };
        }
        
    }
    
    // 導出到全域
    window.LazyLoadManager = LazyLoadManager;
    
})();