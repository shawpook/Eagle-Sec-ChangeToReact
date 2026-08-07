/**
 * 快速鍵管理器
 * 處理快速鍵的註冊、刪除、衝突檢測和格式轉換功能
 */
class ShortcutManager {
    constructor() {
        this.registeredShortcuts = new Map(); // 記錄已註冊的快速鍵
        this.preferences = null;
    }

    /**
     * 初始化，傳入 preferences 物件和快速鍵群組資訊
     * @param {Object} preferences 偏好設定物件
     * @param {Array} keybindGroups 快速鍵群組資訊（可選）
     */
    init(preferences, keybindGroups = null) {
        this.preferences = preferences;
        this.keybindGroups = keybindGroups || [];
        
        // 建立快速鍵到衝突群組的映射，用於快速查詢
        this.keyToConflictGroupMap = new Map();
        if (this.keybindGroups) {
            this.keybindGroups.forEach(group => {
                // conflict 值就是衝突群組代號，預設為 'all'
                const conflictGroup = group.conflict || 'all';
                group.items.forEach(item => {
                    this.keyToConflictGroupMap.set(item.key, conflictGroup);
                });
            });
        }
        
        // 遷移舊格式的 CmdOrCtrl 為平台特定格式
        if (preferences.shortcuts && preferences.shortcuts.keybinds) {
            let migrated = false;
            for (const [key, value] of Object.entries(preferences.shortcuts.keybinds)) {
                if (value && value.includes('CmdOrCtrl')) {
                    const migratedValue = this.migrateToPlatformSpecific(value);
                    preferences.shortcuts.keybinds[key] = migratedValue;
                    migrated = true;
                }
            }
            if (migrated) {
                console.log('[ShortcutManager] Migrated CmdOrCtrl shortcuts to platform-specific format');
            }
        }
    }

    /**
     * Electron 格式轉 Mousetrap 格式
     * @param {string} electronKey - Electron 快速鍵格式 (e.g., "Ctrl + A", "Command + A")
     * @return {string} Mousetrap 格式 (e.g., "ctrl+a", "mod+a")
     */
    electronToMousetrap(electronKey) {
        if (!electronKey) return '';
        return electronKey
            .replace(/Command/g, 'mod')
            .replace(/Ctrl/g, 'ctrl')
            .replace(/Shift/g, 'shift')
            .replace(/Alt/g, 'alt')
            .replace(/Option/g, 'alt')
            .replace(/\s+\+\s*/g, '+')  // 移除 + 號前後空格
            .replace(/\s+/g, '')        // 移除其他空格
            .toLowerCase();
    }

    /**
     * 註冊快速鍵（用於全域快速鍵，非 mousetrap）
     * @param {string} name - 快速鍵名稱
     * @param {string} electronKey - Electron 快速鍵格式
     * @return {Object} 註冊結果
     */
    registerShortcut(name, electronKey) {
        if (!electronKey) return { success: true };
        
        const normalizedKey = this.normalizeShortcut(electronKey);
        
        if (this.registeredShortcuts.has(normalizedKey)) {
            return { 
                success: false, 
                conflict: this.registeredShortcuts.get(normalizedKey) 
            };
        }
        
        this.registeredShortcuts.set(normalizedKey, name);
        return { success: true };
    }

    /**
     * 移除快速鍵註冊
     * @param {string} electronKey - Electron 快速鍵格式
     */
    unregisterShortcut(electronKey) {
        const normalizedKey = this.normalizeShortcut(electronKey);
        this.registeredShortcuts.delete(normalizedKey);
    }

    /**
     * 標準化快速鍵格式用於比較
     * @param {string} electronKey 
     * @return {string}
     */
    normalizeShortcut(electronKey) {
        if (!electronKey) return '';
        
        // 處理舊格式 CmdOrCtrl 的相容性
        let normalized = electronKey;
        
        // 將 CmdOrCtrl 轉換為平台特定格式進行比較
        if (process.platform === 'darwin') {
            normalized = normalized.replace(/CmdOrCtrl/g, 'Command');
        } else {
            normalized = normalized.replace(/CmdOrCtrl/g, 'Ctrl');
        }
        
        return normalized
            .replace(/Command/g, 'mod')
            .replace(/Control/g, 'ctrl')
            .replace(/Ctrl/g, 'ctrl')
            .replace(/Option/g, 'alt')
            .replace(/\s+\+\s*/g, '+')
            .replace(/\s+/g, '')
            .toLowerCase();
    }

    /**
     * 檢查快速鍵名稱是否為當前平台的快速鍵
     * @param {string} keyName - 快速鍵名稱 (e.g., "edit.remove.folder.darwin")
     * @return {boolean} 是否為當前平台的快速鍵
     */
    isCurrentPlatformShortcut(keyName) {
        const currentPlatform = process.platform === 'darwin' ? 'darwin' : 'win32';
        
        // 如果快速鍵名稱包含平台標識符，檢查是否匹配當前平台
        if (keyName.includes('.darwin') || keyName.includes('.win32')) {
            return keyName.includes(`.${currentPlatform}`);
        }
        
        // 如果沒有平台標識符，視為通用快速鍵
        return true;
    }

    /**
     * 檢測衝突
     * @param {string} electronKey - 要檢查的快速鍵
     * @param {string} excludeName - 排除的名稱（當前正在設定的快速鍵）
     * @return {Array} 衝突的快速鍵名稱列表
     */
    getConflicts(electronKey, excludeName = null) {
        if (!electronKey) return [];
        
        const conflicts = [];
        const normalizedKey = this.normalizeShortcut(electronKey);
        
        // 獲取當前快速鍵的衝突群組代號
        const currentConflictGroup = this?.keyToConflictGroupMap?.get(excludeName) || 'all';
        
        // 檢查已註冊的快速鍵
        if (this.registeredShortcuts.has(normalizedKey)) {
            const conflictName = this.registeredShortcuts.get(normalizedKey);
            if (conflictName !== excludeName && this.isCurrentPlatformShortcut(conflictName)) {
                // 根據衝突群組決定是否記錄衝突
                if (this.shouldCheckConflict(excludeName, conflictName, currentConflictGroup)) {
                    conflicts.push(conflictName);
                }
            }
        }
        
        // 檢查 preferences 中的其他快速鍵
        if (this.preferences && this.preferences.shortcuts && this.preferences.shortcuts.keybinds) {
            for (const [key, value] of Object.entries(this.preferences.shortcuts.keybinds)) {
                // 排除當前正在編輯的快速鍵項目，避免自己跟自己衝突
                // 只檢查當前平台的快速鍵
                if (key !== excludeName && 
                    value && 
                    this.isCurrentPlatformShortcut(key) &&
                    this.normalizeShortcut(value) === normalizedKey) {
                    
                    // 根據衝突群組決定是否記錄衝突
                    if (this.shouldCheckConflict(excludeName, key, currentConflictGroup)) {
                        conflicts.push(key);
                    }
                }
            }
        }
        
        return conflicts;
    }

    /**
     * 判斷是否需要檢查衝突
     * @param {string} currentKey - 當前設定的快速鍵
     * @param {string} targetKey - 目標快速鍵（可能衝突的）
     * @param {string} currentConflictGroup - 當前快速鍵的衝突群組代號
     * @return {boolean} 是否需要檢查衝突
     */
    shouldCheckConflict(currentKey, targetKey, currentConflictGroup) {
        // 獲取目標快速鍵的衝突群組代號
        const targetConflictGroup = this.keyToConflictGroupMap.get(targetKey) || 'all';
        
        // 只有相同衝突群組代號的快速鍵才會互相檢查衝突
        // 例如：
        // - 'all' 群組的快速鍵只跟 'all' 群組衝突
        // - 'player' 群組的快速鍵只跟 'player' 群組衝突
        // - 不同群組之間不會衝突
        return currentConflictGroup === targetConflictGroup;
    }

    /**
     * 驗證快速鍵格式
     * @param {string} electronKey - 快速鍵字串
     * @return {Object} 驗證結果 {valid: boolean, error?: string}
     */
    validateShortcut(electronKey) {
        if (!electronKey) return { valid: true };
        
        // 基本格式驗證 - 支援多種組合
        const modifierKeys = ['CmdOrCtrl', 'Command', 'Ctrl', 'Control', 'Shift', 'Alt', 'Option'];
        const regularKeys = /^[A-Za-z0-9]$/;
        const functionKeys = /^F([1-9]|1[0-2])$/;
        const specialKeys = /^(Space|Tab|Enter|Backspace|Delete|Up|Down|Left|Right|PageUp|PageDown|Home|End|Escape|Insert)$/;
        const symbolKeys = /^[=\-+\[\]\\;',./`~]$/;
        
        // 分解快速鍵
        const parts = electronKey.split(/\s*\+\s*/);
        if (parts.length === 0) return { valid: false, error: 'Invalid shortcut format' };
        
        const lastKey = parts[parts.length - 1];
        const modifiers = parts.slice(0, -1);
        
        // 檢查修飾鍵
        for (const modifier of modifiers) {
            if (!modifierKeys.includes(modifier)) {
                return { valid: false, error: `Unsupported modifier key: ${modifier}` };
            }
        }
        
        // 檢查主要按鍵
        if (regularKeys.test(lastKey) || functionKeys.test(lastKey) || 
            specialKeys.test(lastKey) || symbolKeys.test(lastKey)) {
            return { valid: true };
        }
        
        return { valid: false, error: 'Invalid shortcut format' };
    }

    /**
     * 將舊格式的 CmdOrCtrl 轉換為平台特定格式
     * @param {string} electronKey - 可能包含 CmdOrCtrl 的快速鍵字串
     * @return {string} 轉換後的平台特定格式
     */
    migrateToPlatformSpecific(electronKey) {
        if (!electronKey) return '';
        
        if (process.platform === 'darwin') {
            return electronKey.replace(/CmdOrCtrl/g, 'Command');
        } else {
            return electronKey.replace(/CmdOrCtrl/g, 'Ctrl');
        }
    }

    /**
     * 格式化快速鍵顯示（考慮平台差異）
     * @param {string} electronKey - 快速鍵字串
     * @return {string} 格式化後的顯示字串
     */
    formatForDisplay(electronKey) {
        if (!electronKey) return '';
        
        // 統一使用原始格式，不做符號轉換，避免顯示閃爍
        return electronKey;
    }

    /**
     * 獲取所有已註冊的快速鍵
     * @return {Map} 已註冊的快速鍵 Map
     */
    getRegisteredShortcuts() {
        return new Map(this.registeredShortcuts);
    }

    /**
     * 清除所有註冊的快速鍵
     */
    clearRegisteredShortcuts() {
        this.registeredShortcuts.clear();
    }
}

// 單例模式 - 全域可用
if (!window.ShortcutManager) {
    window.ShortcutManager = new ShortcutManager();
}

// 也可以透過 module exports 使用（如果需要的話）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShortcutManager;
}