EagleApp.directive('scrollToTopSentinel', function($timeout) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            const targetSelector = attrs.target;
            const threshold = parseInt(attrs.threshold) || 200;
            const scrollContainer = attrs.scrollContainer;
            
            if (!targetSelector) {
                console.error('scrollToTopSentinel: target attribute is required');
                return;
            }
            
            let observer;
            let $target;
            let $container;
            
            function init() {
                $target = $(targetSelector);
                if (!$target.length) {
                    console.error('scrollToTopSentinel: target element not found:', targetSelector);
                    return;
                }
                
                // 確定捲動容器
                $container = scrollContainer ? $(scrollContainer) : element.parent();
                
                // 設置哨兵元素樣式
                element.css({
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
                            $target.removeClass('show');
                        } else {
                            // 只有當容器確實有捲動時才顯示按鈕
                            const scrollTop = $container.scrollTop();
                            if (scrollTop >= threshold) {
                                $target.addClass('show');
                            }
                        }
                    });
                }, {
                    root: $container[0] === document.body ? null : $container[0],
                    rootMargin: '0px',
                    threshold: 0
                });
                
                observer.observe(element[0]);
            }
            
            // Fallback: 使用傳統 scroll 事件
            function initFallback() {
                let scrollTimeout;
                $container.on('scroll.scrollToTopSentinel', function() {
                    clearTimeout(scrollTimeout);
                    
                    scrollTimeout = setTimeout(function() {
                        const scrollTop = $container.scrollTop();
                        if (scrollTop >= threshold) {
                            $target.addClass('show');
                        } else {
                            $target.removeClass('show');
                        }
                    }, 250);
                });
            }
            
            // 清理
            scope.$on('$destroy', function() {
                if (observer) {
                    observer.disconnect();
                }
                $container.off('scroll.scrollToTopSentinel');
            });
            
            // 延遲初始化以確保 DOM 就緒
            $timeout(init, 100);
        }
    };
});