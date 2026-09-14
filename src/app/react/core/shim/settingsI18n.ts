// @ts-nocheck
/**
 * R2 设置/i18n 族（启动契约的偏好面）：
 * settingsMemory + localStorage 持久化 + electron-settings 门面 + MockI18n。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 2462-2667 区间），函数体逐字保留。
 * 铁律（用户决策）：键名（preferences/broadcast/eagle.reverse.settings.*）、原生同步通道
 * `preferences:update`、事件名（update-preferences/change.current.theme/change.zoom）原样保留；
 * React 侧 `core/settings.ts` 经 window.electronSettings 消费同一实例，禁止另起一套。
 * `window.addEventListener(storage, ...)` 注册迁至 install 期（可释放）。
 */
import { desktopApi, nativeRequire } from "./environment";
import { syncText } from "./browserRuntime";
import { loadJsModule } from "./moduleRegistry";
import { mockEmit } from "./ipcBus";
export const settingsMemory = {};
export const settingsPrefix = 'eagle.reverse.settings.';
export const preferencesSettingKey = 'preferences';
export const broadcastSettingKey = 'broadcast';
export function readSetting(key) {
  if (Object.prototype.hasOwnProperty.call(settingsMemory, key)) return settingsMemory[key];
  try {
    const raw = localStorage.getItem(settingsPrefix + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (err) {
    return undefined;
  }
}
export function writeSetting(key, value) {
  settingsMemory[key] = value;
  try {
    localStorage.setItem(settingsPrefix + key, JSON.stringify(value));
  } catch (err) {
    // Keep the in-memory value when storage is unavailable.
  }
  if (desktopApi && desktopApi.library && key === 'libraryHistory') {
    desktopApi.library.setHistory(value).catch(() => {});
  }
}

export function cloneValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function mergePreferenceValue(target, source) {
  if (source === undefined || source === null) return cloneValue(target);
  if (Array.isArray(target) || Array.isArray(source)) return cloneValue(source);
  if (typeof target !== 'object' || typeof source !== 'object') return cloneValue(source);
  const result = cloneValue(target) || {};
  for (const key of Object.keys(source)) {
    result[key] = mergePreferenceValue(result[key], source[key]);
  }
  return result;
}

export function defaultPreferences() {
  const defaults = cloneValue(loadJsModule('/src/app/js/default-preferences.js')) || {};
  defaults.general = { ...(defaults.general || {}), language: 'zh_CN' };
  defaults.theme = { ...(defaults.theme || {}), name: 'DARK', css: 'dark' };
  return defaults;
}

export let activePreferences = null;

export function replaceActivePreferences(next) {
  if (!activePreferences) {
    activePreferences = next;
    return activePreferences;
  }
  Object.keys(activePreferences).forEach((key) => delete activePreferences[key]);
  Object.assign(activePreferences, next);
  return activePreferences;
}

export function currentPreferences(forceReload) {
  if (activePreferences && !forceReload) return activePreferences;
  if (forceReload) delete settingsMemory[preferencesSettingKey];
  const defaults = defaultPreferences();
  const saved = readSetting(preferencesSettingKey);
  return replaceActivePreferences(
    saved && typeof saved === 'object' ? mergePreferenceValue(defaults, saved) : defaults
  );
}

export function savePreferences(value) {
  const merged = mergePreferenceValue(currentPreferences(), value || {});
  const next = replaceActivePreferences(merged);
  writeSetting(preferencesSettingKey, next);
  syncNativePreferences(next);
  return next;
}

export function syncNativePreferences(preferences) {
  if (!nativeRequire) return;
  try {
    nativeRequire('electron').ipcRenderer.send('preferences:update', preferences);
  } catch (err) {
    // The native preferences bridge is optional in browser preview mode.
  }
}

export function applyPreferencesToCurrentDocument() {
  delete settingsMemory[preferencesSettingKey];
  const preferences = currentPreferences(true);
  if (window.__eagleMockI18n) window.__eagleMockI18n.reload();
  mockEmit('update-preferences');
  if (preferences.theme && preferences.theme.name) mockEmit('change.current.theme', preferences.theme);
  if (preferences.general && preferences.general.zoom) mockEmit('change.zoom', preferences.general.zoom);
  if (preferences.general && typeof window.languageBCP !== 'undefined') {
    window.languageBCP = String(preferences.general.language || 'en').replace('_', '-');
  }
  // b1-9bz-E9：angular scope 同步分支删除（window.angular 在 React 世界恒缺席 → 死代码；
  // 哨兵 C-6 禁项 scope.$evalAsync）。事件扇出已覆盖全部 React 消费面。
}

export function broadcastIpc(channel, params) {
  mockEmit(channel, params);
  try {
    localStorage.setItem(settingsPrefix + broadcastSettingKey, JSON.stringify({ channel, params, at: Date.now() }));
  } catch (err) {
    // Cross-window sync is best-effort; the current window already received the event.
  }
}

export function handleSettingsStorage(event) {
  if (!event || !event.key) return;
  if (event.key === settingsPrefix + preferencesSettingKey) {
    applyPreferencesToCurrentDocument();
    return;
  }
  if (event.key === settingsPrefix + broadcastSettingKey) {
    try {
      const payload = JSON.parse(event.newValue || 'null');
      if (payload && payload.channel && Date.now() - payload.at < 5000) {
        mockEmit(payload.channel, payload.params);
      }
    } catch (err) {
      // Ignore malformed broadcast payloads.
    }
  }
}

export const electronSettings = {
  getPreferences: currentPreferences,
  getSync(key) {
    const value = readSetting(key);
    if (value !== undefined) return value;
    if (key === 'colorSpace') return 'Unmanaged';
    if (key === 'libraryHistory') {
      const current = window.__mockLibrary && window.__mockLibrary.rootDir;
      return current ? [current] : [];
    }
    return undefined;
  },
  setSync(key, value) {
    writeSetting(key, value);
    if (key === preferencesSettingKey) {
      applyPreferencesToCurrentDocument();
      syncNativePreferences(currentPreferences());
    }
  },
  get(key) { return Promise.resolve(this.getSync(key)); },
  set(key, value) {
    this.setSync(key, value);
    return Promise.resolve(value);
  },
  has: (key) => readSetting(key) !== undefined,
  delete(key) {
    delete settingsMemory[key];
    try { localStorage.removeItem(settingsPrefix + key); } catch (err) {}
    if (key === preferencesSettingKey) activePreferences = null;
  },
  clear() {
    Object.keys(settingsMemory).forEach((key) => delete settingsMemory[key]);
    activePreferences = null;
  },
};

export class MockI18n {
  constructor() {
    this.locale = 'zh_CN';
    this.translations = this.load(this.locale);
    window.__eagleMockI18n = this;
    if (Object.keys(this.translations).length === 0) {
      const retry = setInterval(() => {
        const loaded = this.load(this.locale);
        if (Object.keys(loaded).length > 0) {
          this.translations = loaded;
          clearInterval(retry);
        }
      }, 50);
      setTimeout(() => clearInterval(retry), 3000);
    }
  }

  load(locale) {
    const raw = syncText(`/src/i18n/${locale}.js`);
    const text = raw ? raw.split(/\r?\n\/\/# sourceMappingURL=/)[0] : null;
    if (text === null) return {};
    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn('[eagle-shim] failed to parse i18n', locale, err);
      return {};
    }
  }

  __(phrase) {
    return this.translations[phrase] !== undefined ? this.translations[phrase] : phrase;
  }

  reload() {
    const preferences = electronSettings.getPreferences() || {};
    const locale = (preferences.general && preferences.general.language) || 'zh_CN';
    this.locale = locale;
    this.translations = this.load(locale);
  }
}
