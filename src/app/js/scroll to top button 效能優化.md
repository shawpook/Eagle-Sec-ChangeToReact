圖片列表有一個 scrolltotop 按鈕，這個按鈕在 scroll position 超過一定值才會出現，為了達到這個功能，我們要一直監控 scroll event，我覺得這是一種效能的浪費，有沒有什麼方式可以更先進的處理這個任務?

$sidebarContainer.on("scroll.scrollToTop", function() {
            clearTimeout(showSidebarScrollToTopTimeout);
            showSidebarScrollToTopTimeout = setTimeout(function () {
                var scrollTop = $sidebarContainer.scrollTop();
                if (scrollTop >= 360) {
                    if (!$sidebarScrollTopButton.hasClass("show")) {
                        $sidebarScrollTopButton.addClass("show");
                    }
                }
                else {
                    if ($sidebarScrollTopButton.hasClass("show")) {
                        $sidebarScrollTopButton.removeClass("show");
                    }
                }
            }, 333);
        });

我認為我們應該使用先進的 IntersectionObserver 來解決這個問題，在列表頂部放一個不可見的元素，當這個元素離開視窗時，顯示 scroll-to-top 按鈕；回到視窗時隱藏。

