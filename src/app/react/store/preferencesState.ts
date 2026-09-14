import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';

/**
 * b1-9bz-E2-2：偏好/授权真身 store（注册式双写）。
 *
 * `preferences`(29) / `trialRemain`。`preferences` 默认必须为 `null`：`machineryInfra.ts:70`
 * 用 `if (!s.preferences && w.preferences) s.preferences = w.preferences;` 播种，若默认 `{}`
 * 则该守卫恒假、偏好永不注入。`$root.preferences` 经 proxy 自指读到这里。
 */
interface PreferencesState {
  preferences: any;
  trialRemain: any;
}

export const usePreferencesState = create<PreferencesState>(() => ({
  preferences: null,
  trialRemain: 0,
}));

const MIGRATED: ReadonlyArray<keyof PreferencesState> = ['preferences', 'trialRemain'];
/** 单一守卫实现：注册表与 R4 的具体写点共用同一 writer（不得各留一套）。 */
const writers: Record<string, (value: any) => void> = {};
for (const fieldName of MIGRATED) {
  const key = fieldName as string;
  writers[key] = (value: any) => {
    if (usePreferencesState.getState()[fieldName] !== value) {
      usePreferencesState.setState({ [fieldName]: value } as Partial<PreferencesState>);
    }
  };
  migrateScopeFieldToStore(key, () => usePreferencesState.getState()[fieldName], writers[key]);
}

let bound = false;

export function bindPreferencesSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eaglePreferencesState = usePreferencesState;
}

// R4 写点：
/** R4 写点（取代字符串键 writeScopeField('<字段>', v)）。与注册表同一 writer。 */
export function writeTrialRemain(value: any): void { writers.trialRemain(value); }
