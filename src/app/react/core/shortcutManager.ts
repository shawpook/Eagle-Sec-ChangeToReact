/**
 * R5：`js/services/shortcut-manager.js`（296 行经典脚本）的 TS 移植。
 *
 * 契约 = 逐字行为等价（考据见 PROGRESS §10「快捷键（shortcut-manager）」）：
 *  - 单例 `window.ShortcutManager`（三窗原各引一次经典脚本，现由各入口 `installShortcutManager()`
 *    幂等供给）；消费面 = preferences（`init`/`validateShortcut`/`getConflicts`/`formatForDisplay`、
 *    ShortcutInput 指令等价）、主窗（`keymap.ts` 键位映射、`detailHooks` 三处）、预览窗
 *    （`controller.ts` 键位映射）——一律只读 `electronToMousetrap`/冲突检测，无实例方法新增。
 *  - 迁移语义逐字保留：`init` 时把 `CmdOrCtrl` 旧格式改写为平台特定格式（darwin→Command、
 *    其余→Ctrl）并打点日志；`normalizeShortcut` 的替换顺序、`getConflicts` 的
 *    「同名排除 + 平台标识过滤 + 冲突群组相等」三重条件、`validateShortcut` 的四类主键
 *    正则与修饰键白名单，全部与经典脚本一致。
 *  - 行为差异仅两处，均不改语义：①经典脚本末尾的 `module.exports`（CommonJS 兼容面，本仓零消费）
 *    不再保留；②`init` 的 CmdOrCtrl 迁移加 `typeof value === 'string'` 守卫（原码对非字符串的
 *    truthy 值会抛错，属不可达脏数据路径，现降级为跳过）。
 *
 * 之所以是移植而非重写：主窗 `process.platform` 判定与冲突群组语义是用户可见行为
 * （快捷键编辑器的 valid/invalid/conflict 三态），任何简化都会改变反馈。
 */

interface ShortcutValidation {
  valid: boolean;
  error?: string;
}

export class ShortcutManager {
  registeredShortcuts: Map<string, string> = new Map();
  preferences: any = null;
  keybindGroups: any[] = [];
  keyToConflictGroupMap: Map<string, string> = new Map();

  /** 初始化，传入 preferences 对象和快捷键群组信息 */
  init(preferences: any, keybindGroups: any[] | null = null): void {
    this.preferences = preferences;
    this.keybindGroups = keybindGroups || [];

    // 建立快捷键到冲突群组的映射，用于快速查询
    this.keyToConflictGroupMap = new Map<string, string>();
    if (this.keybindGroups) {
      this.keybindGroups.forEach((group: any) => {
        // conflict 值就是冲突群组代号，默认为 'all'
        const conflictGroup = group.conflict || 'all';
        group.items.forEach((item: any) => {
          this.keyToConflictGroupMap.set(item.key, conflictGroup);
        });
      });
    }

    // 迁移旧格式的 CmdOrCtrl 为平台特定格式
    if (preferences.shortcuts && preferences.shortcuts.keybinds) {
      let migrated = false;
      for (const [key, value] of Object.entries(preferences.shortcuts.keybinds)) {
        if (typeof value === 'string' && value.includes('CmdOrCtrl')) {
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

  /** Electron 格式转 Mousetrap 格式（"Ctrl + A" → "ctrl+a"、"Command + A" → "mod+a"） */
  electronToMousetrap(electronKey: string): string {
    if (!electronKey) return '';
    return electronKey
      .replace(/Command/g, 'mod')
      .replace(/Ctrl/g, 'ctrl')
      .replace(/Shift/g, 'shift')
      .replace(/Alt/g, 'alt')
      .replace(/Option/g, 'alt')
      .replace(/\s+\+\s*/g, '+') // 移除 + 号前后空格
      .replace(/\s+/g, '') // 移除其他空格
      .toLowerCase();
  }

  /** 注册快捷键（用于全局快捷键，非 mousetrap） */
  registerShortcut(name: string, electronKey: string): { success: boolean; conflict?: string } {
    if (!electronKey) return { success: true };

    const normalizedKey = this.normalizeShortcut(electronKey);

    if (this.registeredShortcuts.has(normalizedKey)) {
      return { success: false, conflict: this.registeredShortcuts.get(normalizedKey) };
    }

    this.registeredShortcuts.set(normalizedKey, name);
    return { success: true };
  }

  /** 移除快捷键注册 */
  unregisterShortcut(electronKey: string): void {
    const normalizedKey = this.normalizeShortcut(electronKey);
    this.registeredShortcuts.delete(normalizedKey);
  }

  /** 标准化快捷键格式用于比较 */
  normalizeShortcut(electronKey: string): string {
    if (!electronKey) return '';

    // 处理旧格式 CmdOrCtrl 的相容性
    let normalized = electronKey;

    // 将 CmdOrCtrl 转换为平台特定格式进行比较
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

  /** 检查快捷键名称是否为当前平台的快捷键 */
  isCurrentPlatformShortcut(keyName: string): boolean {
    const currentPlatform = process.platform === 'darwin' ? 'darwin' : 'win32';

    // 如果快捷键名称包含平台标识符，检查是否匹配当前平台
    if (keyName.includes('.darwin') || keyName.includes('.win32')) {
      return keyName.includes(`.${currentPlatform}`);
    }

    // 如果没有平台标识符，视为通用快捷键
    return true;
  }

  /** 检测冲突（同名排除 + 平台过滤 + 冲突群组相等） */
  getConflicts(electronKey: string, excludeName: string | null = null): string[] {
    if (!electronKey) return [];

    const conflicts: string[] = [];
    const normalizedKey = this.normalizeShortcut(electronKey);

    // 获取当前快捷键的冲突群组代号
    const currentConflictGroup = (excludeName && this.keyToConflictGroupMap.get(excludeName)) || 'all';

    // 检查已注册的快捷键
    if (this.registeredShortcuts.has(normalizedKey)) {
      const conflictName = this.registeredShortcuts.get(normalizedKey) as string;
      if (conflictName !== excludeName && this.isCurrentPlatformShortcut(conflictName)) {
        if (this.shouldCheckConflict(excludeName, conflictName, currentConflictGroup)) {
          conflicts.push(conflictName);
        }
      }
    }

    // 检查 preferences 中的其他快捷键
    if (this.preferences && this.preferences.shortcuts && this.preferences.shortcuts.keybinds) {
      for (const [key, value] of Object.entries(this.preferences.shortcuts.keybinds)) {
        // 排除当前正在编辑的快捷键项目，避免自己跟自己冲突；只检查当前平台的快捷键
        if (
          key !== excludeName &&
          value &&
          this.isCurrentPlatformShortcut(key) &&
          this.normalizeShortcut(value as string) === normalizedKey
        ) {
          if (this.shouldCheckConflict(excludeName, key, currentConflictGroup)) {
            conflicts.push(key);
          }
        }
      }
    }

    return conflicts;
  }

  /** 判断是否需要检查冲突（仅同冲突群组的快捷键互相检查） */
  shouldCheckConflict(currentKey: string | null, targetKey: string, currentConflictGroup: string): boolean {
    // 获取目标快捷键的冲突群组代号
    const targetConflictGroup = this.keyToConflictGroupMap.get(targetKey) || 'all';

    // 只有相同冲突群组代号的快捷键才会互相检查冲突（'all' 只跟 'all'、'player' 只跟 'player'）
    return currentConflictGroup === targetConflictGroup;
  }

  /** 验证快捷键格式 */
  validateShortcut(electronKey: string): ShortcutValidation {
    if (!electronKey) return { valid: true };

    // 基本格式验证 - 支持多种组合
    const modifierKeys = ['CmdOrCtrl', 'Command', 'Ctrl', 'Control', 'Shift', 'Alt', 'Option'];
    const regularKeys = /^[A-Za-z0-9]$/;
    const functionKeys = /^F([1-9]|1[0-2])$/;
    const specialKeys = /^(Space|Tab|Enter|Backspace|Delete|Up|Down|Left|Right|PageUp|PageDown|Home|End|Escape|Insert)$/;
    const symbolKeys = /^[=\-+\[\]\\;',./`~]$/;

    // 分解快捷键
    const parts = electronKey.split(/\s*\+\s*/);
    if (parts.length === 0) return { valid: false, error: 'Invalid shortcut format' };

    const lastKey = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // 检查修饰键
    for (const modifier of modifiers) {
      if (!modifierKeys.includes(modifier)) {
        return { valid: false, error: `Unsupported modifier key: ${modifier}` };
      }
    }

    // 检查主要按键
    if (
      regularKeys.test(lastKey) ||
      functionKeys.test(lastKey) ||
      specialKeys.test(lastKey) ||
      symbolKeys.test(lastKey)
    ) {
      return { valid: true };
    }

    return { valid: false, error: 'Invalid shortcut format' };
  }

  /** 将旧格式的 CmdOrCtrl 转换为平台特定格式 */
  migrateToPlatformSpecific(electronKey: string): string {
    if (!electronKey) return '';

    if (process.platform === 'darwin') {
      return electronKey.replace(/CmdOrCtrl/g, 'Command');
    }
    return electronKey.replace(/CmdOrCtrl/g, 'Ctrl');
  }

  /** 格式化快捷键显示（考虑平台差异）——统一用原始格式，避免显示闪烁 */
  formatForDisplay(electronKey: string): string {
    if (!electronKey) return '';
    return electronKey;
  }

  /** 获取所有已注册的快捷键 */
  getRegisteredShortcuts(): Map<string, string> {
    return new Map(this.registeredShortcuts);
  }

  /** 清除所有注册的快捷键 */
  clearRegisteredShortcuts(): void {
    this.registeredShortcuts.clear();
  }
}

/** 单例供给（幂等）：三窗入口在模块求值期调用，等价原经典脚本的 `if (!window.ShortcutManager)`。 */
export function installShortcutManager(): void {
  const w = window as any;
  if (!w.ShortcutManager) w.ShortcutManager = new ShortcutManager();
}
