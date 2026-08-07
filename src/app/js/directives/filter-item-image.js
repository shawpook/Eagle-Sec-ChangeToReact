EagleApp.directive('filterItemImage', function($rootScope, $timeout, UrlStateService) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-image.html',
        replace: true,
        link: function($scope, elem, attrs) {
            // ==================== 初始化 ====================
            $scope.$body = angular.element("body").scope();
            
            // 貼上事件處理器
            let pasteHandler = null;
            
            // 拖曳計數器
            let dragCounter = 0;
            let menuDragCounter = 0;
            
            // DOM 元素引用
            const element = elem[0];
            const menuElement = elem.find('.filter-menu')[0];
            const aiSearchSection = elem.find('.ai-search-section')[0];
            
            // MIME 類型映射
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'bmp': 'image/bmp',
                'webp': 'image/webp',
                'avif': 'image/avif'
            };
            
            // ==================== 核心功能 ====================
            
            /**
             * 檢查 AI 搜尋是否可用
             * @returns {boolean} AI 搜尋是否已安裝且準備就緒
             */
            function checkAISearchAvailable() {
                if (!eagle.aiSearch.isInstalled) {
                    eagle.aiSearch.open();
                    return false;
                }
                
                if (!eagle.aiSearch.isReady) {
                    swal({
                        html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${i18n.__("dialog.aiSearchNotReady.title")}</h4>
                                <p class="alert-desc">${i18n.__("dialog.aiSearchNotReady.desc")}</p>
                            </div>
                        `,
                        showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                        width: 400,
                        customClass: "alert-box",
                        cancelButtonColor: "#777777",
                        confirmButtonText: i18n.__("general.ok"),
                    }).then(function () {});
                    return false;
                }
                
                return true;
            }
            
            /**
             * 清除圖片篩選器
             */
            $scope.clearImageFilter = function(event) {
                event && event.stopPropagation();
                eagle.filter.filterRules.image.itemId = undefined;
                eagle.filter.filterRules.image.base64 = undefined;
                $scope.$body.page = 1;
                $scope.$body.reload();
                $scope.$body.calculateFilterCounts();
                
                // 新增：清除 URL 參數
                UrlStateService.setState({ imageFilter: null });
            };
            
            /**
             * 選擇圖片
             */
            $scope.selectImage = function() {
                if (!checkAISearchAvailable()) {
                    return;
                }
                
                dialog.showOpenDialog(currentWindow, {
                    title: "Choose image",
                    filters: [
                        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'avif'] }
                    ],
                    properties: ['openFile']
                }).then(result => {
                    const paths = result.filePaths;
                    
                    if (paths && paths.length > 0) {
                        const fs = require('fs');
                        const path = require('path');
                        const filePath = paths[0];
                        
                        fs.readFile(filePath, (err, data) => {
                            if (err) {
                                console.error('Error reading file:', err);
                                return;
                            }
                            
                            const fileName = path.basename(filePath);
                            const ext = path.extname(filePath).toLowerCase().substring(1);
                            const mimeType = mimeTypes[ext] || 'image/jpeg';
                            const file = new File([data], fileName, { type: mimeType });
                            
                            handleDrop([file]);
                            
                            $scope.$apply(() => {
                                $('[filter-item].open').removeClass('open');
                            });
                        });
                    }
                });
            };
            
            // ==================== 輔助函數 ====================
            
            /**
             * 更新篩選器狀態並觸發搜尋
             * @param {string} itemId - 項目 ID
             * @param {string} base64 - Base64 圖片資料
             * @param {boolean} skipUrlUpdate - 是否跳過 URL 更新（從 URL 變更觸發時為 true）
             */
            function updateFilterAndSearch(itemId, base64, skipUrlUpdate) {
                eagle.filter.filterRules.image.itemId = itemId;
                eagle.filter.filterRules.image.base64 = base64;
                $scope.$body.page = 1;
                $scope.$body.reload();
                $scope.$body.calculateFilterCounts();
                
                // 確保圖片篩選器是可見的
                if (!eagle.filter.pinned || !eagle.filter.pinned.image) {
                    eagle.filter.pinned = eagle.filter.pinned || {};
                    eagle.filter.pinned.image = true;
                }
                
                // 新增：更新 URL（除非明確指定跳過）
                if (!skipUrlUpdate) {
                    if (itemId) {
                        UrlStateService.setState({ imageFilter: itemId });
                    }
                }
            }
            
            /**
             * 壓縮圖片
             */
            function compressImage(img, callback) {
                const minSide = 400;
                let newWidth, newHeight;
                
                if (img.width < img.height) {
                    newWidth = minSide;
                    newHeight = (img.height / img.width) * minSide;
                } else {
                    newHeight = minSide;
                    newWidth = (img.width / img.height) * minSide;
                }
                
                // 只有當圖片尺寸大於目標尺寸時才壓縮
                if (img.width > newWidth || img.height > newHeight) {
                    const canvas = document.createElement('canvas');
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    
                    callback(canvas.toDataURL('image/jpeg', 0.9));
                } else {
                    callback(null);
                }
            }
            
            /**
             * 處理從瀏覽器拖曳的圖片 URL
             */
            async function handleDroppedUrl(url) {
                if (!checkAISearchAvailable()) {
                    return;
                }
                
                try {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    
                    img.onload = function() {
                        compressImage(img, function(compressedBase64) {
                            $scope.$apply(function() {
                                if (compressedBase64) {
                                    updateFilterAndSearch(undefined, compressedBase64);
                                } else {
                                    // 圖片太小，使用原始 canvas 轉換
                                    const canvas = document.createElement('canvas');
                                    canvas.width = img.width;
                                    canvas.height = img.height;
                                    const ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0);
                                    updateFilterAndSearch(undefined, canvas.toDataURL('image/jpeg', 0.9));
                                }
                            });
                        });
                    };
                    
                    img.onerror = function() {
                        console.error('Failed to load image from URL:', url);
                    };
                    
                    img.src = url;
                } catch (error) {
                    console.error('Error handling dropped URL:', error);
                }
            }
            
            /**
             * 處理拖曳的統一邏輯
             */
            async function handleDrop(files, searchScope) {
                if (!checkAISearchAvailable()) {
                    return;
                }
                
                const bodyScope = searchScope || $scope.$body;
                
                // 檢查是否為 Eagle 內部拖曳
                if (draggingItem && dragging && bodyScope.selected && bodyScope.selected[0]) {
                    const selectedItem = bodyScope.selected[0];
                    if (selectedItem) {
                        updateFilterAndSearch(selectedItem.id, undefined);
                    }
                } else if (files.length > 0) {
                    // 外部文件拖曳
                    const file = files[0];
                    
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        
                        reader.onload = function(event) {
                            const img = new Image();
                            
                            img.onload = function() {
                                compressImage(img, function(compressedBase64) {
                                    $scope.$apply(function() {
                                        updateFilterAndSearch(undefined, compressedBase64 || event.target.result);
                                    });
                                });
                            };
                            
                            img.src = event.target.result;
                        };
                        
                        reader.readAsDataURL(file);
                    } else if (searchScope) {
                        // 非圖片文件，執行文字搜尋
                        const firstFileName = file.name;
                        const nameWithoutExt = firstFileName.substring(0, firstFileName.lastIndexOf('.')) || firstFileName;
                        searchScope.keyword = nameWithoutExt;
                        searchScope.filterContent();
                    }
                }
            }
            
            /**
             * 建立貼上事件處理器
             */
            function createPasteHandler() {
                return async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const clipboardData = await getClipboardImage();
                    const filePath = clipboardData?.files[0];
                    const image = clipboardData.image;
                    
                    if (filePath) {
                        // 處理文件路徑
                        const fs = require('fs');
                        const path = require('path');
                        
                        fs.readFile(filePath, (err, data) => {
                            if (err) {
                                console.error('Error reading clipboard file:', err);
                                return;
                            }
                            
                            const fileName = path.basename(filePath);
                            const ext = path.extname(filePath).toLowerCase().substring(1);
                            const mimeType = mimeTypes[ext] || 'image/jpeg';
                            const file = new File([data], fileName, { type: mimeType });
                            
                            handleDrop([file]);
                            
                            $scope.$apply(() => {
                                $('[filter-item].open').removeClass('open');
                            });
                        });
                    } else if (image && !image.isEmpty()) {
                        // 處理圖片數據
                        const buffer = image.toPNG();
                        const blob = new Blob([buffer], { type: 'image/png' });
                        const file = new File([blob], `Clipboard-${Date.now()}.png`, { type: 'image/png' });
                        
                        handleDrop([file]);
                        
                        $scope.$apply(() => {
                            $('[filter-item].open').removeClass('open');
                        });
                    }
                };
            }
            
            // ==================== 事件監聽器 ====================
            
            /**
             * 監聽過濾器選單開關狀態
             */
            $scope.$watch(function() {
                return elem.hasClass('open');
            }, function(isOpen) {
                if (isOpen) {
                    $timeout(() => {
                        // 建立隱藏輸入框接收貼上事件
                        let hiddenInput = elem.find('.paste-receiver');
                        if (!hiddenInput.length) {
                            hiddenInput = $('<input class="paste-receiver" style="position: absolute; left: -9999px; top: -9999px;" />');
                            elem.find('.menu-content').append(hiddenInput);
                        }
                        
                        hiddenInput[0].focus();
                        
                        // 移除舊的事件監聽器
                        if (pasteHandler) {
                            hiddenInput.off('paste', pasteHandler);
                        }
                        
                        // 添加新的貼上事件監聽器
                        pasteHandler = createPasteHandler();
                        hiddenInput.on('paste', pasteHandler);
                    }, 100);
                }
            });
            
            /**
             * 監聽 OPEN_IMAGE_FILTER 事件
             */
            $scope.$on('OPEN_IMAGE_FILTER', function(event, data) {
                if (data) {
                    if (!checkAISearchAvailable()) {
                        return;
                    }
                    
                    // 檢查是否來自 URL 變更（如果有 fromUrl 標記，則跳過 URL 更新）
                    var skipUrlUpdate = data.fromUrl === true;
                    
                    if (data.itemId) {
                        updateFilterAndSearch(data.itemId, undefined, skipUrlUpdate);
                    } else if (data.base64) {
                        updateFilterAndSearch(undefined, data.base64, skipUrlUpdate);
                    }
                }
            });
            
            /**
             * 監聽來自搜尋框的拖曳事件
             */
            $scope.$on('SEARCH_DROP', function(_, data) {
                if (data.files && data.files.length > 0) {
                    handleDrop(data.files, data.scope);
                } else if (data.urlData && (data.urlData.startsWith('http://') || data.urlData.startsWith('https://'))) {
                    console.log('Dropped image URL from search:', data.urlData);
                    handleDroppedUrl(data.urlData);
                } else if (data.htmlData) {
                    const imgMatch = data.htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (imgMatch && imgMatch[1]) {
                        console.log('Extracted image URL from search:', imgMatch[1]);
                        handleDroppedUrl(imgMatch[1]);
                    }
                }
            });
            
            // ==================== 拖曳事件設置 ====================
            
            /**
             * 設置主元素拖曳事件
             */
            function setupMainElementDragEvents() {
                element.addEventListener('dragenter', function(e) {
                    e.preventDefault();
                    dragCounter++;
                    if (dragCounter === 1) {
                        element.classList.add('dragenter');
                    }
                });
                
                element.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    dragCounter--;
                    if (dragCounter === 0) {
                        element.classList.remove('dragenter');
                    }
                });
                
                element.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                });
                
                element.addEventListener('drop', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    dragCounter = 0;
                    element.classList.remove('dragenter');
                    
                    const files = Array.from(e.dataTransfer.files);
                    const htmlData = e.dataTransfer.getData('text/html');
                    const urlData = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                    
                    if (files.length > 0) {
                        handleDrop(files);
                    } else if (urlData && (urlData.startsWith('http://') || urlData.startsWith('https://'))) {
                        console.log('Dropped image URL:', urlData);
                        handleDroppedUrl(urlData);
                    } else if (htmlData) {
                        const imgMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
                        if (imgMatch && imgMatch[1]) {
                            console.log('Extracted image URL:', imgMatch[1]);
                            handleDroppedUrl(imgMatch[1]);
                        }
                    }
                });
            }
            
            /**
             * 設置選單拖曳事件
             */
            function setupMenuDragEvents() {
                if (!menuElement) return;
                
                menuElement.addEventListener('dragenter', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    menuDragCounter++;
                    if (menuDragCounter === 1 && aiSearchSection) {
                        aiSearchSection.classList.add('dragenter');
                    }
                });
                
                menuElement.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    menuDragCounter--;
                    if (menuDragCounter === 0 && aiSearchSection) {
                        aiSearchSection.classList.remove('dragenter');
                    }
                });
                
                menuElement.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                });
                
                menuElement.addEventListener('drop', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    menuDragCounter = 0;
                    
                    if (aiSearchSection) {
                        aiSearchSection.classList.remove('dragenter');
                    }
                    
                    const files = Array.from(e.dataTransfer.files);
                    const htmlData = e.dataTransfer.getData('text/html');
                    const urlData = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                    
                    if (files.length > 0) {
                        handleDrop(files);
                        $('[filter-item].open').removeClass('open');
                    } else if (urlData && (urlData.startsWith('http://') || urlData.startsWith('https://'))) {
                        console.log('Dropped image URL to menu:', urlData);
                        handleDroppedUrl(urlData);
                        $('[filter-item].open').removeClass('open');
                    } else if (htmlData) {
                        const imgMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
                        if (imgMatch && imgMatch[1]) {
                            console.log('Extracted image URL from menu:', imgMatch[1]);
                            handleDroppedUrl(imgMatch[1]);
                        }
                    }
                });
            }
            
            // 初始化拖曳事件
            setupMainElementDragEvents();
            setupMenuDragEvents();
            
            // ==================== 清理 ====================
            
            /**
             * 清理所有事件監聽器
             */
            $scope.$on('$destroy', function() {
                // 注意：這裡的 arguments.callee 實際上不會正確工作
                // 因為它們引用的是錯誤的函數，但為了保持原始功能不變，暫時保留
                element.removeEventListener('dragenter', arguments.callee);
                element.removeEventListener('dragleave', arguments.callee);
                element.removeEventListener('dragover', arguments.callee);
                element.removeEventListener('drop', arguments.callee);
                
                if (menuElement) {
                    menuElement.removeEventListener('dragenter', arguments.callee);
                    menuElement.removeEventListener('dragleave', arguments.callee);
                    menuElement.removeEventListener('dragover', arguments.callee);
                    menuElement.removeEventListener('drop', arguments.callee);
                }
                
                const hiddenInput = elem.find('.paste-receiver');
                if (hiddenInput.length && pasteHandler) {
                    hiddenInput.off('paste', pasteHandler);
                    hiddenInput.remove();
                }
            });
        }
    };
});