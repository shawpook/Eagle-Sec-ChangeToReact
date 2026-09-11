// @ts-nocheck
import { getBodyScope } from '../../core/appCore';

import { scrollToSelectedItem } from '../../services/batchOpsService';
import { autoscrollChannel } from '../../global/bus';
import { q, heightOf, setCssEl, offsetOf, addClass, removeClass, onEl, offEl } from '../../utils/domQuery';
import { machineryGotoBottom } from '../../services/gridService';
/**
 * b 系列前置：网格容器四 Angular 指令逐字移植（rectSelect / autoScroll /
 * scrollToTopSentinel / boxContainerScrollbar）。
 *
 * 规范来源 = app.bundle.js 各指令 link 体逐字（提取脚本生成，非手抄）；机械替换仅三处：
 *   1. angular.element("body").scope() → getBodyScope()
 *   2. angular.copy → deepCopy（JSON 法）
 *   3. scope.$on('$destroy') → destroy 收集器（返回 cleanup）；$timeout → setTimeout shim
 * 运行期依赖的 bundle 全局（window.ig / resetNgGridLayoutData / HoverPreview /
 * isElementInViewport / jQuery + scrollTo 插件）在 b1 移除 bundle 前继续存在，其去留随
 * b3 bundle 分解处理。文件含 @ts-nocheck：逐字 JS 移植不做 TS 改写。
 */

function deepCopy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

export function initAutoScroll() {
  const $scope = getBodyScope();
  const $rootScope = $scope ? $scope.$root : null;
  const element = q('#box-container') as HTMLElement | null;
  const attrs = {};

            var $container = element;
            autoscrollChannel.on(function (event, index) {

                // 暫時做修正，未來有直接滾動 index 的方式再調整
                if (!$bodyScope.selected || $bodyScope.selected.length === 0) return;
                var boxId = $bodyScope.selected[$bodyScope.selected.length - 1].id;
                var height = $bodyScope.boxContianerHeight || heightOf(element),
                // var height = ig._renderer._size.view,
                    box = q(`#box-${boxId}`);

                if (!box) {
                    console.log("项目不再当前画面中，自动重新定位")
                    if ($scope.viewMode !== 'random' && $scope.viewMode !== 'duplicate') {
                        scrollToSelectedItem();
                    }
                    return;
                }

                var boxHeight = heightOf(box),
                    scrollTop = offsetOf(box)?.top || 0,
                    offset = height / 2 - boxHeight;

                if (scrollTop - boxHeight / 2 < 0 || scrollTop + boxHeight / 2 > height || !isElementInViewport(box)) {
                    if ($container) {
                        const delta = (offsetOf(box)?.top || 0) - (offsetOf($container)?.top || 0);
                        $container.scrollTop = $container.scrollTop + delta - boxHeight;
                    }
                }

                setTimeout(function () {
                    if ($container && $container.scrollTop === 0 && $bodyScope.startCursor !== 0) {
                        $container.scrollTop = 3;
                    }
                }, 200);
            });
  return function () {};
}

export function initScrollToTopSentinel() {
  const element = q('#scroll-to-top-sentinel') as HTMLElement | null;
  const attrs = {
    target: element?.getAttribute('target'),
    threshold: element?.getAttribute('threshold'),
    scrollContainer: element?.getAttribute('scroll-container'),
  };
  const destroyHandlers = [];
  const scope = { $on: function (name, fn) { if (name === '$destroy') destroyHandlers.push(fn); return function () {}; } };
  const $timeout = function (fn, ms) { return setTimeout(fn, ms); };
            const targetSelector = attrs.target;
            const threshold = parseInt(attrs.threshold) || 200;
            const scrollContainer = attrs.scrollContainer;
            
            if (!targetSelector) {
                console.error('scrollToTopSentinel: target attribute is required');
                return;
            }
            if (!element) return;
            
            let observer;
            let $target: HTMLElement | null;
            let $container: HTMLElement | null;
            let onFallbackScroll: any;
            
            function init() {
                $target = q(targetSelector);
                if (!$target) {
                    console.error('scrollToTopSentinel: target element not found:', targetSelector);
                    return;
                }
                
                // 確定捲動容器
                $container = scrollContainer ? q(scrollContainer) : element.parentElement;
                
                // 設置哨兵元素樣式
                setCssEl(element, {
                    height: '1px',
                    opacity: 0,
                    pointerEvents: 'none',
                    display: 'block'
                });
                
                // 檢查 IntersectionObserver 支援
                if (!window.IntersectionObserver) {
                    console.warn('IntersectionObserver not supported, using fallback');
                    initFallback();
                    return;
                }
                
                // 設定 IntersectionObserver
                observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        // 當哨兵元素在視窗內時，隱藏按鈕
                        // 當哨兵元素離開視窗時，顯示按鈕
                        if (entry.isIntersecting) {
                            $target!.classList.remove('show');
                        } else {
                            // 只有當容器確實有捲動時才顯示按鈕
                            const scrollTop = $container?.scrollTop || 0;
                            if (scrollTop >= threshold) {
                                $target!.classList.add('show');
                            }
                        }
                    });
                }, {
                    root: $container === document.body ? null : $container,
                    rootMargin: '0px',
                    threshold: 0
                });
                
                observer.observe(element);
            }
            
            // Fallback: 使用傳統 scroll 事件
            function initFallback() {
                let scrollTimeout;
                onFallbackScroll = function() {
                    clearTimeout(scrollTimeout);
                    
                    scrollTimeout = setTimeout(function() {
                        const scrollTop = $container?.scrollTop || 0;
                        if (scrollTop >= threshold) {
                            $target?.classList.add('show');
                        } else {
                            $target?.classList.remove('show');
                        }
                    }, 250);
                };
                $container?.addEventListener('scroll', onFallbackScroll);
            }
            
            // 清理
            scope.$on('$destroy', function() {
                if (observer) {
                    observer.disconnect();
                }
                if ($container && onFallbackScroll) $container.removeEventListener('scroll', onFallbackScroll);
            });
            
            // 延遲初始化以確保 DOM 就緒
            $timeout(init, 100);
  return function () { destroyHandlers.forEach(function (fn) { try { fn(); } catch (err) {} }); };
}

export function initBoxContainerScrollbar() {
  const element = q('#box-container-scrollbar') as HTMLElement | null;
  const destroyHandlers = [];
  const scope = { $on: function (name, fn) { if (name === '$destroy') destroyHandlers.push(fn); return function () {}; } };
  const attrs = {};

            var enabledSize = 3;
            var $bodyScope = getBodyScope();
            var $boxContainer = q("#box-container") as HTMLElement | null;
            var $scrollThumb = element ? (element.querySelector(".box-container-scrollbar-thumb") as HTMLElement | null) : null;
            // var $scrollHints = element.find(".box-container-scrollbar-hints");
            var orderBy;
            
            // 初始化 thumb 的 transform 和效能優化屬性
            setCssEl($scrollThumb, {
                transform: 'translateY(0px)',
                top: '0',
                'will-change': 'transform',
                'contain': 'layout style paint',
                'backface-visibility': 'hidden',
                'transform-style': 'preserve-3d'
            });

            onEl(element, "UPDATE_BOX_SCROLLBAR", function () {
            // scope.$on("UPDATE_BOX_SCROLLBAR", function () {
                var total = $bodyScope.allData.length;
                // var pageLength = parseInt($bodyScope.allData.length / $bodyScope.options.page);
                // var current;
                // var itgs = ig._items._data;
                // if (itgs[0]) {
                //     var pos = ig._watcher.getScrollPos();
                //     for (var i = itgs.length - 1; i >= 0; i--) {
                //         var group = itgs[i];
                //         if (pos > group.outlines.end[group.outlines.end.length - 1]) {
                //             break;
                //         }
                //         current = group.groupKey - 1000000;
                //     }
                // }

                // if (current === undefined) {
                //     switchNormalMode();
                //     return;
                // }

                updateThumbHeight(total);
                // updateThumbPosition(current, pageLength, 0);
                $boxContainer && $boxContainer.dispatchEvent(new Event("scroll"));

                if ($bodyScope.currentFolder) {
                    if ($bodyScope.currentFolder.orderBy) {
                        orderBy = $bodyScope.currentFolder.orderBy;
                    }
                    else {
                        orderBy = $bodyScope.orderBy;
                    }
                }
                else if ($bodyScope.currentSmartFolder) {
                    if ($bodyScope.currentSmartFolder.orderBy) {
                        orderBy = $bodyScope.currentSmartFolder.orderBy;
                    }
                    else {
                        orderBy = $bodyScope.orderBy;
                    }
                }
                else {
                    orderBy = $bodyScope.orderBy;
                }
            });

            //var scrollTimeout;
            // $boxContainer.on("mousewheel.boxContainer", _.throttle(function () {
            //     $boxContainer && $boxContainer.dispatchEvent(new Event("scroll"));
            // }, 200, true));
            
            // 動態節流的滾動處理
            var lastScrollTime = 0;
            var scrollThrottleDelay = 33;
            
            // 創建一個動態節流的函數
            function dynamicThrottle(func) {
                return function() {
                    var now = Date.now();
                    var timeSinceLastScroll = now - lastScrollTime;
                    
                    // 根據性能動態調整節流時間
                    scrollThrottleDelay = Math.max(16, performanceMetrics.currentDelay * 0.8);
                    
                    if (timeSinceLastScroll >= scrollThrottleDelay) {
                        lastScrollTime = now;
                        func.apply(this, arguments);
                    }
                };
            }
            
            onEl($boxContainer, "scroll", dynamicThrottle(function () {

                if (!ig || isDragging || justFinishedDragging) return; // 拖拽時和剛結束拖拽時不處理 scroll 事件
                
                var total = $bodyScope.allData.length;
                var pageLength = getTotalPageCount();
                var pos = ig._watcher.getScrollPos();
                var groups = ig._items._data;
                
                // 如果沒有 groups 數據，不更新 thumb
                if (!groups || groups.length === 0) {
                    return;
                }
                
                // 特殊處理：如果滾動位置很小
                if (pos <= 10) {
                    // 快取 DOM 查詢結果
                    if (!this._scrollBarHeight) {
                        this._scrollBarHeight = heightOf(element);
                        this._thumbnailHeight = heightOf($scrollThumb);
                    }
                    
                    // 使用微小的百分比而不是直接設為0，避免突然跳動
                    var percentage = (pos / 1000) * 100; // 給一個很小的百分比
                    var scrollTop = (this._scrollBarHeight - this._thumbnailHeight) * percentage / 100;
                    
                    // 使用 transform3d 強制 GPU 加速
                    $scrollThumb.style.transform = `translate3d(0, ${scrollTop}px, 0)`;
                    if ($subFolderContainer) $subFolderContainer.style.display = '';
                    return;
                }
                
                // 反推當前的頁數和小數位置
                var currentPageInfo = calculatePrecisePagePosition(pos, groups, pageLength);
                
                if (currentPageInfo) {
                    // 根據頁數（含小數）計算百分比
                    var currentPageWithDecimal = currentPageInfo.page + currentPageInfo.decimal;
                    var percentage = (currentPageWithDecimal / pageLength) * 100;
                    if (percentage > 100) percentage = 100;
                    if (percentage < 0) percentage = 0;
                    
                    // 更新 thumb 位置（使用快取值）
                    if (!this._scrollBarHeight) {
                        this._scrollBarHeight = heightOf(element);
                        this._thumbnailHeight = heightOf($scrollThumb);
                    }
                    var scrollBarHeight = this._scrollBarHeight;
                    var thumbnailHeight = this._thumbnailHeight;
                    var scrollTop = (scrollBarHeight - thumbnailHeight) * percentage / 100;
                    
                    // 使用 transform3d 強制 GPU 加速
                    $scrollThumb.style.transform = `translate3d(0, ${scrollTop}px, 0)`;
                    
                    // 更新 UI 元素
                    if (currentPageWithDecimal >= 1) {
                        if ($subFolderContainer) $subFolderContainer.style.display = 'none';
                        if (!$scrollToTop?.classList.contains("show")) {
                            $scrollToTop?.classList.add("show");
                        }
                    } else {
                        if ($subFolderContainer) $subFolderContainer.style.display = '';
                    }
                }
                
            })); // 使用動態節流替代固定的 throttle

            function switchNormalMode() {
                const sfc = q("#sub-folder-container"); if (sfc) sfc.style.display = '';
                removeClass("#box-container", "hide-scrollbar");
                if (element) element.style.display = 'none';
            };

            function switchPageMode() {
                addClass("#box-container", "hide-scrollbar");
                if (element) element.style.display = '';
                // 觸發一次重新計算以更新快取值
                this._scrollBarHeight = null;
                this._thumbnailHeight = null;
            };

            function updateThumbHeight(total) {
                if (total / $bodyScope.options.page <= enabledSize) {
                    switchNormalMode();
                }
                else {
                    switchPageMode();
                    var scrollHeight = heightOf(element);
                    var height = parseInt($bodyScope.options.page / total * scrollHeight);
                    if (height < 18) height = 18;
                    setCssEl($scrollThumb, { height: height });
                    // console.log(`thumbHeight: ${height}`);
                }
            };

            var updateThumbPositionAnimateTimeout;
            var $subFolderContainer = q("#sub-folder-container") as HTMLElement | null;
            var $scrollToTop = q("#scroll-to-top") as HTMLElement | null;
            var updateThumbPositionTimeout;
            var updateThumbPositionRequest;
            // 移除這些變數，改為在需要時動態獲取
            function updateThumbPosition(to, total, decimal) {
                // 保留這個函數以維持兼容性，但簡化邏輯
                // 實際的 thumb 更新已經在 scroll.boxContainer 事件中處理
                
                var precisePosition = to + (decimal || 0);
                
                // 更新 UI 元素顯示
                if (precisePosition >= 1) {
                    if ($subFolderContainer) $subFolderContainer.style.display = 'none';
                    if (!$scrollToTop?.classList.contains("show")) {
                        $scrollToTop?.classList.add("show");
                    }
                }
                else {
                    if ($subFolderContainer) $subFolderContainer.style.display = '';
                }
            };

            // 性能自適應系統
            var performanceMetrics = {
                // 執行時間歷史（保留最近10次）
                executionTimes: [],
                // 平均執行時間
                averageTime: 16, // 預設值 16ms (60fps)
                // 當前延遲時間
                currentDelay: 33,
                // 最小和最大延遲
                minDelay: 8, // 最快 125fps
                maxDelay: 100, // 最慢 10fps
                // 性能等級
                performanceLevel: 'medium', // 'high', 'medium', 'low'
                // 上次更新時間
                lastUpdateTime: 0,
                // 幀率目標
                targetFrameTime: 16.67, // 60fps 目標
                // 是否正在測量
                isMeasuring: false
            };

            // 測量執行時間並更新性能指標
            function measureExecutionTime(callback) {
                if (performanceMetrics.isMeasuring) {
                    // 如果已經在測量，直接執行
                    callback();
                    return;
                }

                performanceMetrics.isMeasuring = true;
                var startTime = performance.now();
                
                callback();
                
                // 使用 requestAnimationFrame 來確保渲染完成後測量
                requestAnimationFrame(function() {
                    var endTime = performance.now();
                    var executionTime = endTime - startTime;
                    
                    // 添加到歷史記錄
                    performanceMetrics.executionTimes.push(executionTime);
                    if (performanceMetrics.executionTimes.length > 10) {
                        performanceMetrics.executionTimes.shift();
                    }
                    
                    // 計算平均執行時間（使用加權平均，最近的權重更高）
                    var totalWeight = 0;
                    var weightedSum = 0;
                    performanceMetrics.executionTimes.forEach(function(time, index) {
                        var weight = index + 1; // 越新的權重越高
                        weightedSum += time * weight;
                        totalWeight += weight;
                    });
                    performanceMetrics.averageTime = weightedSum / totalWeight;
                    
                    // 更新性能等級
                    updatePerformanceLevel();
                    
                    // 調整延遲時間
                    adjustDelay();
                    
                    performanceMetrics.isMeasuring = false;
                });
            }

            // 更新性能等級
            function updatePerformanceLevel() {
                var avgTime = performanceMetrics.averageTime;
                
                if (avgTime < 10) {
                    performanceMetrics.performanceLevel = 'high';
                } else if (avgTime < 25) {
                    performanceMetrics.performanceLevel = 'medium';
                } else {
                    performanceMetrics.performanceLevel = 'low';
                }
            }

            // 動態調整延遲時間
            function adjustDelay() {
                var avgTime = performanceMetrics.averageTime;
                var targetFrameTime = performanceMetrics.targetFrameTime;
                
                // 基於執行時間計算理想延遲
                // 如果執行時間短，可以更頻繁地更新
                // 如果執行時間長，需要給更多時間恢復
                var idealDelay;
                
                if (avgTime < targetFrameTime * 0.5) {
                    // 非常快的設備，可以高頻更新
                    idealDelay = Math.max(performanceMetrics.minDelay, avgTime * 1.5);
                } else if (avgTime < targetFrameTime) {
                    // 良好性能，保持60fps左右
                    idealDelay = targetFrameTime;
                } else if (avgTime < targetFrameTime * 2) {
                    // 中等性能，降低到30fps左右
                    idealDelay = Math.max(33, avgTime * 1.2);
                } else {
                    // 低性能，進一步降低更新頻率
                    idealDelay = Math.min(performanceMetrics.maxDelay, avgTime * 1.5);
                }
                
                // 平滑過渡，避免突然變化
                var currentDelay = performanceMetrics.currentDelay;
                var diff = idealDelay - currentDelay;
                
                // 使用漸進式調整
                if (Math.abs(diff) > 5) {
                    performanceMetrics.currentDelay = currentDelay + (diff * 0.3);
                } else {
                    performanceMetrics.currentDelay = idealDelay;
                }
                
                // 確保在範圍內
                performanceMetrics.currentDelay = Math.max(
                    performanceMetrics.minDelay,
                    Math.min(performanceMetrics.maxDelay, performanceMetrics.currentDelay)
                );
                
                // 調試輸出（生產環境可以移除）
                // console.log('Performance:', {
                //     level: performanceMetrics.performanceLevel,
                //     avgTime: avgTime.toFixed(2) + 'ms',
                //     delay: performanceMetrics.currentDelay.toFixed(2) + 'ms',
                //     fps: (1000 / performanceMetrics.currentDelay).toFixed(1) + 'fps'
                // });
            }

            // 獲取當前的動態延遲時間
            function getDynamicDelay() {
                // 根據不同情況返回不同的延遲
                if (isDragging) {
                    // 拖拽時使用更短的延遲以提高響應性
                    return Math.max(5, performanceMetrics.currentDelay * 0.3);
                }
                
                return performanceMetrics.currentDelay;
            }

            // 計算總頁數（包含最後不完整的頁面）
            function getTotalPageCount() {
                return Math.ceil($bodyScope.allData.length / $bodyScope.options.page);
            }

            var goToPageTimeout;
            var lastPage;
            function goToPage(targetPage, { updatePosition, scrollPercentage }) {

                // if (targetPage !== lastPage) {
                    clearTimeout(goToPageTimeout);
                // }
                
                if (targetPage === $bodyScope.startCursor) {
                    if (targetPage === 0) {
                        // 測量執行時間
                        measureExecutionTime(function() {
                            resetNgGridLayoutData($bodyScope.allData, 0, scrollPercentage);
                        });
                        if (!scrollPercentage) {
                            setTimeout(function () { if ($boxContainer) $boxContainer.scrollTop = 10; }, 200);
                        }
                    }
                    return;
                }

                $bodyScope.startCursor = targetPage;
                var pageLength = getTotalPageCount();
                var percentage = targetPage / pageLength * 100;

                // if (updatePosition) {
                //     updateThumbPosition(targetPage, pageLength, 0);
                // }

                lastPage = targetPage;

                // 使用動態延遲時間
                var dynamicDelay = getDynamicDelay();
                
                goToPageTimeout = setTimeout(function () {
                    if (targetPage >= pageLength) {
                        machineryGotoBottom($bodyScope);
                    }
                    else {
                        // 測量執行時間
                        measureExecutionTime(function() {
                            resetNgGridLayoutData($bodyScope.allData, targetPage, scrollPercentage);
                        });
                    }

                    if (updatePosition) {
                        updateThumbPosition(targetPage, pageLength, 0);
                    }
                }, dynamicDelay);

                // if (updatePosition) {
                //     if (targetPage > 0) {
                //         // setTimeout(function () { 
                //             $boxContainer.scrollTop($boxContainer.scrollTop() + 100); 
                //         // }, 200);
                //     }
                // }
                // else {
                //     if (targetPage > 0) {
                //     }
                // }
            }

            // 新增：精準定位函數
            function applyPreciseScrollPosition(page, decimalPart) {
                // 由於 resetNgGridLayoutData 是同步的，頁面切換後可以立即執行定位
                // 但需要給 DOM 一點時間更新
                setTimeout(function() {
                    if (!ig || !ig._items || !ig._items._data) return;
                    
                    var groups = ig._items._data;
                    // 注意：reset 後只會有當前頁面的資料
                    var currentGroup = groups[0]; // 通常 reset 後只有一個 group
                    
                    if (currentGroup && currentGroup.outlines) {
                        var pageStart = currentGroup.outlines.start[0] || 0;
                        var pageEnd = currentGroup.outlines.end[currentGroup.outlines.end.length - 1] || 0;
                        var pageHeight = pageEnd - pageStart;
                        
                        if (pageHeight > 0) {
                            // 使用可滾動範圍計算精準的 scrollTop 位置
                            var viewportHeight = $boxContainer.clientHeight;
                            var scrollableRange = pageHeight - viewportHeight;
                            var targetScrollTop = (scrollableRange > 0) ? pageStart + (scrollableRange * decimalPart) : pageStart;

                            if ($boxContainer) $boxContainer.scrollTop = targetScrollTop;
                        } else {
                            // 如果頁面高度為 0，至少滾動到頁面開始位置
                            if ($boxContainer) $boxContainer.scrollTop = pageStart;
                        }
                    }
                }, 50);
            }

            // 新增：立即應用精準定位（用於拖拽時）
            let scrollAnimationFrame = null;
            function applyPreciseScrollPositionImmediate(page, decimalPart) {
                if (!ig || !ig._items || !ig._items._data) return;
                
                var groups = ig._items._data;
                var targetGroup = null;
                
                // 找到目標頁面的 group
                for (var i = 0; i < groups.length; i++) {
                    if (groups[i].groupKey - 1000000 === page) {
                        targetGroup = groups[i];
                        break;
                    }
                }
                
                if (targetGroup && targetGroup.outlines) {
                    var pageStart = targetGroup.outlines.start[0] || 0;
                    var pageEnd = targetGroup.outlines.end[targetGroup.outlines.end.length - 1] || 0;
                    var pageHeight = pageEnd - pageStart;
                    
                    if (pageHeight > 0) {
                        // 使用可滾動範圍計算精準的 scrollTop 位置
                        var viewportHeight = $boxContainer.clientHeight;
                        var scrollableRange = pageHeight - viewportHeight;
                        var targetScrollTop = (scrollableRange > 0) ? pageStart + (scrollableRange * decimalPart) : pageStart;

                        smoothScrollTo($boxContainer, targetScrollTop, 100);
                    } else if (decimalPart === 0) {
                        // 如果是頁面開頭，直接滾動到起始位置
                        // if ($boxContainer) $boxContainer.scrollTop = pageStart;
                        smoothScrollTo($boxContainer, pageStart, 100);
                    }
                }
            }

            function smoothScrollTo(element, targetPosition, duration) {
                // 取消之前的動畫
                if (scrollAnimationFrame) {
                    cancelAnimationFrame(scrollAnimationFrame);
                }
                
                const startPosition = element.scrollTop;
                const distance = targetPosition - startPosition;
                
                // 如果距離太小，直接跳轉
                if (Math.abs(distance) < 4) {
                    element.scrollTop = targetPosition;
                    return;
                }
                
                const startTime = performance.now();

                function easeOutCubic(t) {
                    return 1 - Math.pow(1 - t, 3);
                }

                function animate(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const easeProgress = easeOutCubic(progress);

                    element.scrollTop = startPosition + distance * easeProgress;

                    if (progress < 1) {
                        scrollAnimationFrame = requestAnimationFrame(animate);
                    } else {
                        // 確保最後精確到達目標位置
                        element.scrollTop = targetPosition;
                        scrollAnimationFrame = null;
                    }
                }

                scrollAnimationFrame = requestAnimationFrame(animate);
            }

            function calculatePrecisePagePosition(scrollPos, groups, totalPages) {
                if (!groups || groups.length === 0) return null;
                
                // 如果只有一個 group，直接計算
                if (groups.length === 1) {
                    var group = groups[0];
                    var page = group.groupKey - 1000000;
                    var groupStart = group.outlines.start[0] || 0;
                    var groupEnd = group.outlines.end[group.outlines.end.length - 1] || 0;
                    var groupHeight = groupEnd - groupStart;

                    var decimal = 0;
                    if (groupHeight > 0) {
                        // 使用可滾動範圍而非內容高度，確保與 applyPreciseScrollPositionImmediate 一致
                        var viewportHeight = $boxContainer.clientHeight;
                        var scrollableRange = groupHeight - viewportHeight;
                        if (scrollableRange > 0) {
                            decimal = (scrollPos - groupStart) / scrollableRange;
                        } else {
                            // 內容不足以填滿視窗，所有項目皆可見
                            decimal = 0;
                        }
                        decimal = Math.max(0, Math.min(1, decimal));
                    }

                    return { page: page, decimal: decimal };
                }
                
                // 多個 groups 的情況
                for (var i = 0; i < groups.length; i++) {
                    var group = groups[i];
                    var groupStart = group.outlines.start[0] || 0;
                    var groupEnd = group.outlines.end[group.outlines.end.length - 1] || 0;
                    
                    // 如果 scrollPos 在這個 group 的範圍內
                    if (scrollPos >= groupStart && scrollPos <= groupEnd) {
                        var page = group.groupKey - 1000000;
                        var groupHeight = groupEnd - groupStart;

                        var decimal = 0;
                        if (groupHeight > 0) {
                            var viewportHeight = $boxContainer.clientHeight;
                            var scrollableRange = groupHeight - viewportHeight;
                            if (scrollableRange > 0) {
                                decimal = (scrollPos - groupStart) / scrollableRange;
                            } else {
                                decimal = 0;
                            }
                            decimal = Math.max(0, Math.min(1, decimal));
                        }

                        return { page: page, decimal: decimal };
                    }
                }
                
                // 如果沒有找到，返回最接近的
                if (scrollPos <= 0) {
                    return { page: 0, decimal: 0 };
                } else {
                    // 返回最後一頁
                    var lastGroup = groups[groups.length - 1];
                    return { page: lastGroup.groupKey - 1000000, decimal: 1 };
                }
            }

            // function updateScrollHints(page, decimalPart) {
            //     // 根據當前模式顯示精準位置
            //     if ($bodyScope.viewMode === "random") return;
                
            //     var precisePosition = page + decimalPart;
                
            //     // 顯示精準頁面位置，如 "1.22/50"
            //     var hintText = "";
                
            //     // 如果有項目資料，也顯示項目資訊
            //     var itemIndex = Math.floor($bodyScope.options.page * precisePosition);
            //     var item = $bodyScope.allData[itemIndex];
                
            //     if (item) {
            //         switch (orderBy) {
            //             case "IMPORT":
            //             case "MANUAL":
            //                 hintText += $filter('date')(item.modificationTime, i18n.__('general.timeFormat'));
            //                 break;
            //             case "NAME":
            //                 hintText += (item.name.trim()[0] && item.name.trim()[0].toUpperCase());
            //                 break;
            //             case "FILESIZE":
            //                 hintText += fileSize(item.size);
            //                 break;
            //         }
            //     }
                
            //     $scrollHints.text(hintText);
            //     $scrollHints.css("display", "flex");
            // }

            // 記錄拖拽開始時的狀態
            var isDragging = false;
            var lastTargetPage = -1;
            var pageChangeTimeout;
            var lastDecimalPart = -1;
            var lastDragTime = 0;
            var lastDragPosition = 0;
            var dragVelocity = 0;
            var justFinishedDragging = false;
            
            // DOM 元素快取
            var subFolderContainerCache = null;
            var scrollToTopCache = null;

            // 現代原生拖拽實作
            var draggableInstance = null;
            
            function initDraggable() {
                var draggableThumb = $scrollThumb;
                var parentElement = element;
                
                var dragState = {
                    isDragging: false,
                    startY: 0,
                    startTop: 0,
                    currentTop: 0,
                    parentHeight: 0,
                    thumbHeight: 0,
                    maxTop: 0
                };
                
                function handleStart(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    dragState.isDragging = true;
                    dragState.startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
                    
                    // 從 transform 中提取當前位置（優化正則表達式）
                    var transform = draggableThumb.style.transform;
                    var match = transform.match(/translate3d\(0(?:px)?,\s*([\d.-]+)px/);
                    if (match) {
                        dragState.startTop = parseFloat(match[1]) || 0;
                    } else {
                        // 降級處理舊格式
                        var matrix = window.getComputedStyle(draggableThumb).transform;
                        var matrixMatch = matrix.match(/matrix.*\((.+)\)/);
                        if (matrixMatch && matrixMatch[1]) {
                            var values = matrixMatch[1].split(', ');
                            dragState.startTop = parseFloat(values[5]) || 0;
                        } else {
                            dragState.startTop = 0;
                        }
                    }
                    
                    dragState.parentHeight = parentElement.offsetHeight;
                    dragState.thumbHeight = draggableThumb.offsetHeight;
                    dragState.maxTop = dragState.parentHeight - dragState.thumbHeight;
                    
                    // 觸發 start 回調
                    $scrollThumb?.classList.add("dragging");
                    document.body.classList.add("dragging-list-scrollbar");
                    isDragging = true;
                    lastTargetPage = $bodyScope.startCursor;
                    lastDecimalPart = -1;
                    
                    // 開始拖拽時設置 will-change 和 contain
                    draggableThumb.style.willChange = 'transform';
                    draggableThumb.style.contain = 'layout style paint';
                    
                    // 添加全局事件監聽
                    if (e.type === 'mousedown') {
                        document.addEventListener('mousemove', handleMove, { passive: false });
                        document.addEventListener('mouseup', handleEnd, { passive: false });
                    } else {
                        document.addEventListener('touchmove', handleMove, { passive: false });
                        document.addEventListener('touchend', handleEnd, { passive: false });
                    }
                    
                    // 禁用文本選擇
                    document.body.style.userSelect = 'none';
                    document.body.style.webkitUserSelect = 'none';
                }
                
                function handleMove(e) {
                    if (!dragState.isDragging) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
                    var deltaY = currentY - dragState.startY;
                    var newTop = dragState.startTop + deltaY;
                    
                    // 限制在父元素內
                    if (newTop < 0) newTop = 0;
                    if (newTop > dragState.maxTop) newTop = dragState.maxTop;
                    
                    dragState.currentTop = newTop;
                    
                    // 使用 transform3d 提升性能，強制 GPU 加速
                    draggableThumb.style.transform = `translate3d(0, ${newTop}px, 0)`;
                    
                    // 觸發 drag 回調邏輯
                    handleDrag(newTop);
                }
                
                function handleDrag(top) {
                    // 計算考慮 thumb 高度的百分比
                    var maxThumbTop = dragState.maxTop;
                    
                    // 確保 top 在有效範圍內
                    if (top < 0) top = 0;
                    if (top > maxThumbTop) top = maxThumbTop;
                    
                    // 計算真實的百分比（0-100）
                    var percentage = (top / maxThumbTop) * 100;
                    if (isNaN(percentage) || maxThumbTop === 0) percentage = 0;
                    
                    // 計算拖拽速度
                    var currentTime = Date.now();
                    var timeDelta = currentTime - lastDragTime;
                    if (timeDelta > 0) {
                        dragVelocity = Math.abs(percentage - lastDragPosition) / timeDelta * 1000; // 每秒的百分比變化
                    }
                    lastDragTime = currentTime;
                    lastDragPosition = percentage;
                    
                    // 根據百分比計算頁數（含小數）
                    var totalPageCount = getTotalPageCount();
                    var targetPageWithDecimal = percentage / 100 * totalPageCount;
                    var targetPage = Math.min(Math.floor(targetPageWithDecimal), totalPageCount - 1);
                    var decimalPart = targetPageWithDecimal - targetPage;
                    if (decimalPart > 1) decimalPart = 1;
                    
                    // 處理子資料夾容器顯示（使用快取）
                    if (!subFolderContainerCache) {
                        subFolderContainerCache = q("#sub-folder-container");
                    }
                    if (targetPageWithDecimal < 0.1) {
                        subFolderContainerCache.show();
                    } else {
                        subFolderContainerCache.hide();
                    }
                    
                    // 檢查目標頁面是否已經在畫面上（相鄰頁面）
                    var isAdjacentPage = Math.abs(targetPage - $bodyScope.startCursor) <= 1;
                    var groups = ig._items._data;
                    var targetPageExists = false;
                    
                    // 檢查目標頁面是否已經載入
                    if (groups) {
                        for (var i = 0; i < groups.length; i++) {
                            if (groups[i].groupKey - 1000000 === targetPage) {
                                targetPageExists = true;
                                break;
                            }
                        }
                    }
                    
                    // 計算頁面距離，用於更智能的切換
                    var pageDistance = Math.abs(targetPage - $bodyScope.startCursor);
                    
                    // 如果在相同頁面內拖拽，直接滾動
                    if (targetPage === $bodyScope.startCursor && targetPageExists) {
                        applyPreciseScrollPositionImmediate(targetPage, decimalPart);
                        lastDecimalPart = decimalPart;
                        lastTargetPage = targetPage;
                    }
                    // 如果目標頁面已經在畫面上（相鄰頁面），直接滾動
                    else if (targetPageExists && isAdjacentPage) {
                        applyPreciseScrollPositionImmediate(targetPage, decimalPart);
                        lastDecimalPart = decimalPart;
                        lastTargetPage = targetPage;
                    }
                    // 如果需要跳轉到不在畫面上的頁面，使用 reset
                    else if (targetPage !== lastTargetPage) {
                        lastTargetPage = targetPage;
                        lastDecimalPart = decimalPart;
                        
                        // 取消之前的頁面切換
                        clearTimeout(pageChangeTimeout);
                        
                        // 使用動態延遲，高性能設備響應更快
                        var dragDelay = Math.max(5, performanceMetrics.currentDelay * 0.15);
                        
                        pageChangeTimeout = setTimeout(function() {
                            if (isDragging && targetPage !== $bodyScope.startCursor) {
                                // 取消正在進行的滾動動畫
                                if (scrollAnimationFrame) {
                                    cancelAnimationFrame(scrollAnimationFrame);
                                    scrollAnimationFrame = null;
                                }
                                delete HoverPreview.lastElem;
                                // 直接傳遞百分比參數，實現一氣呵成的滾動
                                $bodyScope.startCursor = targetPage;
                                // 測量拖拽時的執行時間
                                measureExecutionTime(function() {
                                    resetNgGridLayoutData($bodyScope.allData, targetPage, lastDecimalPart);
                                });
                            }
                        }, dragDelay);
                    }
                }
                
                function handleEnd(e) {
                    if (!dragState.isDragging) return;
                    
                    dragState.isDragging = false;
                    
                    // 保持使用 transform，不切換回 top
                    // 這樣可以避免拖拽結束時的重繪
                    
                    // 觸發 stop 回調
                    $scrollThumb?.classList.remove("dragging");
                    document.body.classList.remove("dragging-list-scrollbar");
                    isDragging = false;
                    clearTimeout(pageChangeTimeout);
                    
                    // 設置標記，防止 scroll 事件干擾
                    justFinishedDragging = true;
                    setTimeout(function() {
                        justFinishedDragging = false;
                    }, 200); // 200ms 後恢復正常 scroll 處理
                    
                    // 拖拽結束時，如果有待處理的頁面切換，立即執行
                    if (lastTargetPage !== $bodyScope.startCursor && lastTargetPage >= 0) {
                        // 取消正在進行的滾動動畫
                        if (scrollAnimationFrame) {
                            cancelAnimationFrame(scrollAnimationFrame);
                            scrollAnimationFrame = null;
                        }
                        delete HoverPreview.lastElem;
                        $bodyScope.startCursor = lastTargetPage;
                        // 測量拖拽結束時的執行時間
                        measureExecutionTime(function() {
                            resetNgGridLayoutData($bodyScope.allData, lastTargetPage, lastDecimalPart);
                        });
                    }
                    
                    // 移除全局事件監聽
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleEnd);
                    document.removeEventListener('touchmove', handleMove);
                    document.removeEventListener('touchend', handleEnd);
                    
                    // 恢復文本選擇
                    document.body.style.userSelect = '';
                    document.body.style.webkitUserSelect = '';
                    
                    // 拖拽結束後移除 will-change
                    // 延遲一點移除，讓動畫完成
                    setTimeout(function() {
                        draggableThumb.style.willChange = 'auto';
                        draggableThumb.style.contain = '';
                    }, 100);
                }
                
                // 綁定事件
                draggableThumb.addEventListener('mousedown', handleStart, { passive: false });
                draggableThumb.addEventListener('touchstart', handleStart, { passive: false });
                
                // 防止拖拽時的默認行為
                draggableThumb.addEventListener('dragstart', function(e) {
                    e.preventDefault();
                });
                
                // 返回清理函數
                return function cleanup() {
                    draggableThumb.removeEventListener('mousedown', handleStart);
                    draggableThumb.removeEventListener('touchstart', handleStart);
                };
            }
            
            // 初始化拖拽
            draggableInstance = initDraggable();

            onEl(element, "mousedown", function (event) {
                // 避免點擊 thumb 時觸發
                if (event.target && event.target.classList && event.target.classList.contains('box-container-scrollbar-thumb')) {
                    return;
                }
                
                // 如果正在拖拽，忽略點擊事件
                if (isDragging) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                
                
                var scrollHeight = heightOf(element);
                var elementOffset = offsetOf(element);
                var mouseY = event.pageY - elementOffset.top;
                
                var totalPageCount = getTotalPageCount();
                var percentage = (mouseY / scrollHeight) * 100;
                if (percentage > 100) percentage = 100;
                if (percentage < 0) percentage = 0;

                // 簡單計算：點擊位置對應的頁數和頁內位置
                var targetPageWithDecimal = percentage / 100 * totalPageCount;
                var targetPage = Math.min(Math.floor(targetPageWithDecimal), totalPageCount - 1);
                var decimalPart = targetPageWithDecimal - targetPage;
                if (decimalPart > 1) decimalPart = 1;

                // 先取消正在進行的滾動動畫
                if (scrollAnimationFrame) {
                    cancelAnimationFrame(scrollAnimationFrame);
                    scrollAnimationFrame = null;
                }
                
                // 檢查是否在相同頁面
                if (targetPage === $bodyScope.startCursor) {
                    // 相同頁面內，檢查當前頁面是否已載入
                    if (ig && ig._items && ig._items._data && ig._items._data.length > 0) {
                        // 直接滾動到目標位置
                        applyPreciseScrollPositionImmediate(targetPage, decimalPart);
                    } else {
                        // 如果頁面數據不完整，重新載入
                        measureExecutionTime(function() {
                            resetNgGridLayoutData($bodyScope.allData, targetPage, decimalPart);
                        });
                    }
                } else {
                    // 不同頁面，使用新的一氣呵成方式跳轉
                    $bodyScope.startCursor = targetPage;
                    measureExecutionTime(function() {
                        resetNgGridLayoutData($bodyScope.allData, targetPage, decimalPart);
                    });
                }
            });
            
            // 清理函數
            scope.$on('$destroy', function() {
                // 清理所有 timeout 和動畫
                clearTimeout(updateThumbPositionAnimateTimeout);
                clearTimeout(updateThumbPositionTimeout);
                clearTimeout(goToPageTimeout);
                clearTimeout(pageChangeTimeout);
                if (scrollAnimationFrame) {
                    cancelAnimationFrame(scrollAnimationFrame);
                }
                
                if (draggableInstance) {
                    draggableInstance();
                }
                offEl(element, "UPDATE_BOX_SCROLLBAR");
                offEl(element, "mousedown");
                offEl($boxContainer, "scroll");
                
                // 清理快取
                subFolderContainerCache = null;
                scrollToTopCache = null;
            });
  return function () { destroyHandlers.forEach(function (fn) { try { fn(); } catch (err) {} }); };
}
