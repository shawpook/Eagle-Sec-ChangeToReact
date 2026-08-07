angular.module("shortcutInput", [])
.directive('shortcutInput', function($timeout) {
    return {
        restrict: 'A',
        require: '?ngModel',
        link: function(scope, element, attrs, ngModel) {
            // 從屬性中獲取快速鍵名稱
            var getShortcutName = function() {
                return attrs.shortcutName;
            };
            // 初始化狀態樣式
            element.addClass('shortcut-input');
            
            // 創建錯誤提示元素
            var errorElement = angular.element('<div class="shortcut-error"></div>');
            element.after(errorElement);
            
            // 創建衝突提示元素
            var conflictElement = angular.element('<div class="shortcut-conflict-tip color-warning"></div>');
            element.before(conflictElement);
            
            // 更新狀態和提示
            function updateStatus(shortcutValue) {
                
                // 清除所有狀態和訊息
                element.removeClass('shortcut-valid shortcut-invalid shortcut-conflict');
                errorElement.hide().empty();
                conflictElement.hide().empty();
                
                if (!shortcutValue) {
                    element.addClass('shortcut-valid');
                    return;
                }
                
                // 驗證格式
                var validation = window.ShortcutManager.validateShortcut(shortcutValue);
                if (!validation.valid) {
                    element.addClass('shortcut-invalid');
                    errorElement.text(validation.error).show();
                    return;
                }
                
                // 檢測衝突
                var shortcutName = getShortcutName();
                var conflicts = window.ShortcutManager.getConflicts(shortcutValue, shortcutName);
                if (conflicts.length > 0) {
                    element.addClass('shortcut-conflict');
                    
                    // 顯示衝突提示，顯示已被佔用的功能名稱
                    var conflictNames = conflicts.map(function(conflictKey) {
                        // 嘗試從 i18n 獲取功能名稱，若無則使用原始 key
                        var i18nKey = 'shortcuts.' + conflictKey;
                        var displayName = scope.$eval("'" + i18nKey + "' | i18n");
                        return displayName !== i18nKey ? displayName : conflictKey;
                    });
                    
                    // 使用 i18n 翻譯，只顯示第一個衝突項目
                    var i18nTemplate = scope.$eval("'shortcuts.conflict.usedBy' | i18n");
                    var conflictText = i18nTemplate.replace('{0}', conflictNames[0]);
                    
                    conflictElement.text(conflictText).show();
                    return;
                }
                
                element.addClass('shortcut-valid');
            }
            
            // 監聽數值變化
            ngModel.$viewChangeListeners.push(function() {
                $timeout(function() {
                    updateStatus(ngModel.$viewValue);
                }, 10);
            });

            // 移除複雜的 input 監聽，讓用戶可以自由輸入
            
            element.on("keydown", function (e) {
                e.preventDefault();
                var keyCode = e.which;
                var char;
                if (e.originalEvent.code) {
                    char = e.originalEvent.code.replace("Key", "").replace("Digit", "");
                    switch (char) {
                        case "BracketLeft":
                            char = "[";
                            break;
                        case "BracketRight":
                            char = "]";
                            break;
                        case "Minus":
                            char = "-";
                            break;
                        case "Equal":
                            char = "=";
                            break;
                        case "Backslash":
                            char = "\\";
                            break;
                        case "Semicolon":
                            char = ";";
                            break;
                        case "Quote":
                            char = "'";
                            break;
                        case "Backquote":
                            char = "`";
                            break;
                        case "Slash":
                            char = "/";
                            break;
                        case "Period":
                            char = ".";
                            break;
                        case "Comma":
                            char = ",";
                            break;
                    }
                }
                
                var shiftKey = e.shiftKey;
                var metaKey = e.metaKey;
                var ctrlKey = e.ctrlKey;
                var altKey = e.altKey;
                var needCombindKey = false;
                var result = "";
                
                // 使用平台特定格式
                if (ctrlKey) {
                    if (process.platform != 'darwin') {
                        result += "Ctrl + ";
                    }
                    else {
                        result += "Ctrl + ";
                    }
                    needCombindKey = true;
                }
                if (metaKey && process.platform == 'darwin') { 
                    if (!ctrlKey) {
                        result += "Command + "; 
                    }
                    needCombindKey = true; 
                }
                if (shiftKey) { result += "Shift + "; needCombindKey = true; }
                if (altKey) {
                    result += "Alt + ";
                    needCombindKey = true;
                }
                
                switch (keyCode) {
                    case 8:
                        // Backspace 鍵處理
                        if (result.length == 0) {
                            // 無修飾鍵時清空快捷鍵
                            result = "";
                            ngModel.$setViewValue(result);
                            ngModel.$render();
                            updateStatus(result);
                            return;
                        } else {
                            // 有修飾鍵時作為快捷鍵
                            result += "Backspace";
                            needCombindKey = false;
                        }
                        break;
                    case 46:
                        result += "Delete"; needCombindKey = false; break;
                    case 36:
                        result += "Home"; needCombindKey = false; break;
                    case 35:
                        result += "End"; needCombindKey = false; break;
                    case 33:
                        result += "PageUp"; needCombindKey = false; break;
                    case 34:
                        result += "PageDown"; needCombindKey = false; break;
                    // F1 - F12
                    case 112:
                        result += "F1"; needCombindKey = false; break;
                    case 113:
                        result += "F2"; needCombindKey = false; break;
                    case 114:
                        result += "F3"; needCombindKey = false; break;
                    case 115:
                        result += "F4"; needCombindKey = false; break;
                    case 116:
                        result += "F5"; needCombindKey = false; break;
                    case 117:
                        result += "F6"; needCombindKey = false; break;
                    case 118:
                        result += "F7"; needCombindKey = false; break;
                    case 119:
                        result += "F8"; needCombindKey = false; break;
                    case 120:
                        result += "F9"; needCombindKey = false; break;
                    case 121:
                        result += "F10"; needCombindKey = false; break;
                    case 122:
                        result += "F11"; needCombindKey = false; break;
                    case 123:
                        result += "F12"; needCombindKey = false; break;
                    case 219:
                        result += "["; needCombindKey = false; break;
                    case 221:
                        result += "]"; needCombindKey = false; break;
                    case 13:
                        result += "Enter"; needCombindKey = false; break;
                    case 32:
                        result += "Space"; needCombindKey = false; break;
                    case 38:
                        result += "Up"; needCombindKey = false; break;
                    case 40:
                        result += "Down"; needCombindKey = false; break;
                    case 39:
                        result += "Right"; needCombindKey = false; break;
                    case 37:
                        result += "Left"; needCombindKey = false; break;
                    default:
                        // 英文数字按键必须要有搭配按键才算数
                        if (needCombindKey) {
                            if (ctrlKey || metaKey || altKey || shiftKey) {
                                if (keyCode === 107) {
                                    result += 'Plus';
                                    needCombindKey = false;
                                }
                                else if (keyCode === 189 || keyCode === 109) {
                                    result += '-';
                                    needCombindKey = false;
                                }
                                else if (keyCode === 187) {
                                    result += '=';
                                    needCombindKey = false;
                                }
                                else if (char && char.length === 1 && /^[A-Za-z0-9\[\]\\;',./`~\-=]$/.test(char)) {
                                    result += char.toUpperCase();
                                    needCombindKey = false;
                                }
                            }
                        }
                }
                
                if (result && !needCombindKey) {
                    $timeout(function(){
                        // 檢查是否有衝突
                        var shortcutName = getShortcutName();
                        var conflicts = window.ShortcutManager.getConflicts(result, shortcutName);
                        
                        if (conflicts.length > 0) {
                            // 有衝突，不更新model值
                            var originalValue = ngModel.$viewValue || "";
                            
                            // 直接設置衝突樣式，不透過 updateStatus
                            element.removeClass('shortcut-valid shortcut-invalid');
                            element.addClass('shortcut-conflict');
                            
                            // 顯示衝突提示
                            var conflictNames = conflicts.map(function(conflictKey) {
                                // 嘗試從 i18n 獲取功能名稱，若無則使用原始 key
                                var i18nKey = 'shortcuts.' + conflictKey;
                                var displayName = scope.$eval("'" + i18nKey + "' | i18n");
                                return displayName !== i18nKey ? displayName : conflictKey;
                            });
                            
                            // 使用 i18n 翻譯，只顯示第一個衝突項目
                            var i18nTemplate = scope.$eval("'shortcuts.conflict.usedBy' | i18n");
                            var conflictText = i18nTemplate.replace('{0}', conflictNames[0]);
                            
                            conflictElement.text(conflictText).show();
                            console.log(`[DEBUG] Conflict detected for "${result}", conflicts:`, conflicts);
                            
                            // 保持原始值
                            element.val(window.ShortcutManager.formatForDisplay(originalValue));
                            
                            // 使用標記避免 blur 事件覆蓋衝突樣式
                            element.data('showing-conflict', true);
                            
                            // 1.5秒後清除衝突狀態
                            $timeout(function() {
                                element.data('showing-conflict', false);
                                conflictElement.hide();
                                updateStatus(originalValue);
                            }, 1500);
                            
                            // 延遲 blur/focus 避免立即觸發事件
                            $timeout(function() {
                                element[0].blur();
                                element[0].focus();
                            }, 100);
                        } else {
                            // 無衝突，正常更新
                            ngModel.$setViewValue(result);
                            
                            // 但顯示格式化的版本給用戶看
                            var displayValue = window.ShortcutManager.formatForDisplay(result);
                            element.val(displayValue);
                            
                            updateStatus(result);
                            
                            element[0].blur();
                            element[0].focus();
                        }
                    });
                }
                else {
                    ngModel.$setViewValue(ngModel.$viewValue || "");
                    ngModel.$render();
                }
            });
            
            // 當元素獲得焦點時顯示原始格式（方便編輯）
            element.on('focus', function() {
                var currentValue = ngModel.$viewValue;
                if (currentValue) {
                    element.val(currentValue);
                }
            });

            // 當元素失去焦點時更新狀態並格式化顯示
            element.on('blur', function() {
                // 如果正在顯示衝突，不要覆蓋樣式
                if (element.data('showing-conflict')) {
                    return;
                }
                
                var currentValue = ngModel.$viewValue;
                updateStatus(currentValue);
                
                // 格式化顯示
                if (currentValue && window.ShortcutManager) {
                    var displayValue = window.ShortcutManager.formatForDisplay(currentValue);
                    element.val(displayValue);
                }
            });
            
            // 初始化時更新狀態和顯示格式
            $timeout(function() {
                var currentValue = ngModel.$viewValue;
                updateStatus(currentValue);
                
                // 如果有值，格式化顯示
                if (currentValue && window.ShortcutManager) {
                    var displayValue = window.ShortcutManager.formatForDisplay(currentValue);
                    element.val(displayValue);
                }
            }, 100);
            
            // 清理
            scope.$on('$destroy', function() {
                errorElement.remove();
                conflictElement.remove();
            });
        }
    }
});
