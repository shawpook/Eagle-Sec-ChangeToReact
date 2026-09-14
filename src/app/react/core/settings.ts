/**
 * P1-c-3：设置族（preferences/theme/zoom/shortcut/scrollBehavior/broadcast）迁入接缝。
 *
 * 数据面零改动：持久化仍经全局 `electronSettings`（P5 前由 shims 提供同一对象；键名
 * `preferences`、原生同步通道 `preferences:update`、事件名全部原样保留）。语义逐字对齐
 * shims 的 `savePreferences` / `applyPreferencesToCurrentDocument` / `broadcastIpc`。
 *
 * 说明：`electronSettings.setSync('preferences', …)` 会触发 shims 侧的 apply（事件扇出 +
 * 原生同步），因此本模块不再重复植入一份 apply；`applyPreferencesToCurrentDocument` 仅用于
 * shims 的 `update-preferences` 频道语义（强制重读后扇出事件）。
 */
import { electronSettings } from '../global/eagleGlobals';
import { getIpcBus } from './channelBridge';

const PREFERENCES_KEY = 'preferences';
const BROADCAST_SETTING_KEY = 'broadcast';
const SETTINGS_PREFIX = 'eagle.reverse.settings.';

function cloneValue(value: any): any {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/** 与 shims `mergePreferenceValue` 逐字同语义（数组整体覆盖，对象递归合并）。 */
function mergePreferenceValue(target: any, source: any): any {
  if (source === undefined || source === null) return cloneValue(target);
  if (Array.isArray(target) || Array.isArray(source)) return cloneValue(source);
  if (typeof target !== 'object' || typeof source !== 'object') return cloneValue(source);
  const result = cloneValue(target) || {};
  for (const key of Object.keys(source)) {
    result[key] = mergePreferenceValue(result[key], source[key]);
  }
  return result;
}

function settings(): any {
  return electronSettings();
}

export function currentPreferences(): any {
  const s = settings();
  if (!s || typeof s.getPreferences !== 'function') return {};
  return s.getPreferences() || {};
}

/** 偏好落盘（合并写 + shims 侧同日扇出/原生同步）。返回合并后的偏好；无 settings 桥时返回 null。 */
export function savePreferences(value: any): any {
  const s = settings();
  if (!s || typeof s.setSync !== 'function') return null;
  const merged = mergePreferenceValue(currentPreferences(), value || {});
  s.setSync(PREFERENCES_KEY, merged);
  return merged;
}

function emit(channel: string, params?: any): void {
  const bus = getIpcBus();
  if (bus && typeof bus.emit === 'function') bus.emit(channel, params);
}

/** shims `update-preferences` 频道语义：强制重读偏好并对当前文档扇出事件。 */
export function applyPreferencesToCurrentDocument(): void {
  const s = settings();
  if (s && typeof s.delete === 'function') {
    try { s.delete(PREFERENCES_KEY); } catch (err) { /* 缓存失效为尽力而为 */ }
  }
  const preferences = currentPreferences();
  if ((window as any).__eagleMockI18n && typeof (window as any).__eagleMockI18n.reload === 'function') {
    (window as any).__eagleMockI18n.reload();
  }
  emit('update-preferences');
  if (preferences.theme && preferences.theme.name) emit('change.current.theme', preferences.theme);
  if (preferences.general && preferences.general.zoom) emit('change.zoom', preferences.general.zoom);
  // F15b：原 typeof!=='undefined' 守卫恒 false（语言刷新永不生效）；bundle 20053 为无条件赋值。
  if (preferences.general) {
    (window as any).languageBCP = String(preferences.general.language || 'en').replace('_', '-');
  }
}

/** 跨窗广播（shims `broadcastIpc` 逐字：本地总线 + localStorage 供其它窗接收）。 */
export function broadcastIpc(channel: string, params?: any): void {
  emit(channel, params);
  try {
    localStorage.setItem(SETTINGS_PREFIX + BROADCAST_SETTING_KEY, JSON.stringify({ channel, params, at: Date.now() }));
  } catch (err) {
    // 跨窗同步尽力而为；当前窗已收到事件。
  }
}
