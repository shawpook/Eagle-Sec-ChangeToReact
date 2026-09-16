/**
 * R2 设置/i18n 族（启动契约的偏好面）：
 * settingsMemory + localStorage 持久化 + electron-settings 门面 + MockI18n。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 2462-2667 区间），函数体逐字保留。
 * 铁律（用户决策）：键名（preferences/broadcast/eagle.reverse.settings.*）、原生同步通道
 * `preferences:update`、事件名（update-preferences/change.current.theme/change.zoom）原样保留；
 * React 侧 `core/settings.ts` 经 window.electronSettings 消费同一实例，禁止另起一套。
 * `window.addEventListener(storage, ...)` 注册迁至 install 期（可释放）。
 *
 * M2-3 类型化：本文件已撤销整文件 `// @ts-nocheck`。偏好树在运行期是「用户设置文件 / 后端给的
 * JSON」，其形状由 `src/app/js/default-preferences.js` 定义并由本模块自身改写，故用**具名
 * interface**（{@link PreferenceRecord} 及其分支类型）声明；深克隆/合并等原语逐字不改，
 * 只在类型层窄化，不引入 `any`、不放宽门禁。
 */
import { desktopApi, nativeRequire } from "./environment";
import { syncText } from "./browserRuntime";
import { loadJsModule } from "./moduleRegistry";
import { mockEmit } from "./ipcBus";

/** 内存槽位表（`eagle.reverse.settings.<key>` 的写穿缓存；值形状随键而异）。 */
export const settingsMemory: Record<string, unknown> = {};
export const settingsPrefix = 'eagle.reverse.settings.';
export const preferencesSettingKey = 'preferences';
export const broadcastSettingKey = 'broadcast';

/** 偏好树 `general` 分支（形状取自 `src/app/js/default-preferences.js:3-5`）。 */
export interface GeneralPreferenceBranch {
  /** 界面语言（BCP-47 近似写法，如 `zh_CN`；默认值由 {@link defaultPreferences} 兜底为 `zh_CN`）。 */
  language?: string;
  /** 默认缩放档位（默认 `'100'`，以字符串存储）。 */
  zoom?: string;
  [key: string]: unknown;
}

/** 偏好树 `theme` 分支（形状取自 `src/app/js/default-preferences.js:213-217`）。 */
export interface ThemePreferenceBranch {
  /** 主题名（默认 `DARK`）。 */
  name?: string;
  /** 主题 CSS 标识（默认 `dark`）。 */
  css?: string;
  [key: string]: unknown;
}

/**
 * 偏好树根（`window.electronSettings.getPreferences()` 的返回面）。
 * 其余键（`notification` / `shortcuts` / …）由默认文件与用户设置自由扩展，故保留索引签名。
 */
export interface PreferenceRecord {
  [key: string]: unknown;
  general?: GeneralPreferenceBranch;
  theme?: ThemePreferenceBranch;
}

export function readSetting(key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(settingsMemory, key)) return settingsMemory[key];
  try {
    const raw = localStorage.getItem(settingsPrefix + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (err) {
    return undefined;
  }
}
export function writeSetting(key: string, value: unknown): void {
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

/** JSON 深克隆（`undefined` 原样返回；与修前的 `JSON.parse(JSON.stringify(v))` 逐字同义）。 */
export function cloneValue<T>(value: T): T {
  if (value === undefined) return undefined as T;
  return JSON.parse(JSON.stringify(value));
}

/**
 * 偏好树深合并：`source` 覆盖 `target`，数组与非对象按 `source` 整取。
 *
 * 入参在运行期是「任意 JSON 值」（可来自用户设置文件），故签名停在 `unknown`；
 * 内部只在已判定为对象的分支上做窄化，判定顺序与修前逐字相同。
 */
export function mergePreferenceValue(target: unknown, source: unknown): unknown {
  if (source === undefined || source === null) return cloneValue(target);
  if (Array.isArray(target) || Array.isArray(source)) return cloneValue(source);
  if (typeof target !== 'object' || typeof source !== 'object') return cloneValue(source);
  // 此处 `source` 已收窄为 `object`、`target` 为 `object | null`（`typeof null === 'object'`），
  // 故 `|| {}` 同时承担修前的空值兜底；两次断言均为**纯类型**转换。
  const sourceRecord = source as Record<string, unknown>;
  const result = (cloneValue(target || {}) || {}) as Record<string, unknown>;
  for (const key of Object.keys(sourceRecord)) {
    result[key] = mergePreferenceValue(result[key], sourceRecord[key]);
  }
  return result;
}

export function defaultPreferences(): PreferenceRecord {
  const defaults = (cloneValue(loadJsModule('/src/app/js/default-preferences.js')) || {}) as PreferenceRecord;
  defaults.general = { ...(defaults.general || {}), language: 'zh_CN' };
  defaults.theme = { ...(defaults.theme || {}), name: 'DARK', css: 'dark' };
  return defaults;
}

export let activePreferences: PreferenceRecord | null = null;

/**
 * 原地替换生效偏好（保持**同一对象引用**——React 侧持有该引用的订阅面不因此重建）。
 *
 * 类型注记：模块级 `let` 在闭包内不被 TS 收窄，故用 `const current` 承接首读；对象与返回值
 * 均与修前一致（首分支返回的就是刚赋值的 `activePreferences`）。
 */
export function replaceActivePreferences(next: PreferenceRecord): PreferenceRecord {
  const current = activePreferences;
  if (!current) {
    activePreferences = next;
    return activePreferences;
  }
  Object.keys(current).forEach((key) => delete current[key]);
  Object.assign(current, next);
  return current;
}

export function currentPreferences(forceReload?: boolean): PreferenceRecord {
  if (activePreferences && !forceReload) return activePreferences;
  if (forceReload) delete settingsMemory[preferencesSettingKey];
  const defaults = defaultPreferences();
  const saved = readSetting(preferencesSettingKey);
  return replaceActivePreferences(
    saved && typeof saved === 'object'
      ? (mergePreferenceValue(defaults, saved) as PreferenceRecord)
      : defaults
  );
}

export function savePreferences(value: unknown): PreferenceRecord {
  const merged = mergePreferenceValue(currentPreferences(), value || {}) as PreferenceRecord;
  const next = replaceActivePreferences(merged);
  writeSetting(preferencesSettingKey, next);
  syncNativePreferences(next);
  return next;
}

/**
 * `require('electron')` 在渲染进程内的**本模块消费面**（主进程侧契约见 `electron/preload.cjs`）。
 * `ipcRenderer` 声明为必填：缺失时下面的 `try` 会接住 TypeError，与修前同一条失败路径。
 */
interface NativeElectronModule {
  ipcRenderer: { send(channel: string, params?: unknown): void };
}

export function syncNativePreferences(preferences: unknown): void {
  if (!nativeRequire) return;
  try {
    const nativeElectron = nativeRequire('electron') as NativeElectronModule;
    nativeElectron.ipcRenderer.send('preferences:update', preferences);
  } catch (err) {
    // The native preferences bridge is optional in browser preview mode.
  }
}

export function applyPreferencesToCurrentDocument(): void {
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

export function broadcastIpc(channel: string, params?: unknown): void {
  mockEmit(channel, params);
  try {
    localStorage.setItem(settingsPrefix + broadcastSettingKey, JSON.stringify({ channel, params, at: Date.now() }));
  } catch (err) {
    // Cross-window sync is best-effort; the current window already received the event.
  }
}

/**
 * 跨窗广播载荷——**本模块是唯一写入方**（见 {@link broadcastIpc}，恒填 `at: Date.now()`）。
 * `at` 声明为必填 `number`：若该槽位被外部写坏而缺失，`Date.now() - undefined` 为 `NaN`，
 * 比较仍为假——与修前的判据一致。
 */
interface BroadcastPayload {
  channel: string;
  params?: unknown;
  at: number;
}

export function handleSettingsStorage(event: StorageEvent): void {
  if (!event || !event.key) return;
  if (event.key === settingsPrefix + preferencesSettingKey) {
    applyPreferencesToCurrentDocument();
    return;
  }
  if (event.key === settingsPrefix + broadcastSettingKey) {
    try {
      const payload = JSON.parse(event.newValue || 'null') as BroadcastPayload | null;
      if (payload && payload.channel && Date.now() - payload.at < 5000) {
        mockEmit(payload.channel, payload.params);
      }
    } catch (err) {
      // Ignore malformed broadcast payloads.
    }
  }
}

/**
 * `window.electronSettings` 门面（React 侧 `core/settings.ts` 与本模块各 shim **共用同一实例**；
 * 也即 `RuntimeSettingsService` 的转发面，见 `core/runtimeServices.ts:496`）。
 */
export interface ElectronSettingsFace {
  /** 当前生效偏好（不带 `forceReload` 时走 {@link activePreferences} 缓存）。 */
  getPreferences(forceReload?: boolean): PreferenceRecord;
  /** 同步读单个设置键（含 `colorSpace`/`libraryHistory` 的既有派生兜底）。 */
  getSync(key: string): unknown;
  /** 同步写单个设置键（写穿内存 + localStorage，并在写偏好时同步原生与当前文档）。 */
  setSync(key: string, value: unknown): void;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
}

export const electronSettings: ElectronSettingsFace = {
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

/**
 * 演示态的 i18n 替身（`window.__eagleMockI18n`；`moduleRegistry.installMockI18n()` 装配）。
 * 词条以 JSON 文本存放于 `/src/i18n/<locale>.js`，经 `syncText` 同步取回后解析。
 */
export class MockI18n {
  /** 当前语言（构造函数内定型，`reload()` 时更新）。 */
  locale: string;
  /** 已装载词条表（未装载或解析失败时为空表——`__()` 会原样回吐 key）。 */
  translations: Record<string, string>;

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

  load(locale: string): Record<string, string> {
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

  __(phrase: string): string {
    return this.translations[phrase] !== undefined ? this.translations[phrase] : phrase;
  }

  reload(): void {
    const preferences = (electronSettings.getPreferences() || {}) as PreferenceRecord;
    const locale = (preferences.general && preferences.general.language) || 'zh_CN';
    this.locale = locale;
    this.translations = this.load(locale);
  }
}
