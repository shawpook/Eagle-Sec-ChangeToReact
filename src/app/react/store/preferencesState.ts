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
  trialRemain: number;
}

export const usePreferencesState = create<PreferencesState>(() => ({
  preferences: null,
  trialRemain: 0,
}));

const MIGRATED: ReadonlyArray<keyof PreferencesState> = ['preferences', 'trialRemain'];
for (const fieldName of MIGRATED) {
  migrateScopeFieldToStore(
    fieldName as string,
    () => usePreferencesState.getState()[fieldName],
    (value: any) => {
      if (usePreferencesState.getState()[fieldName] !== value) {
        usePreferencesState.setState({ [fieldName]: value } as Partial<PreferencesState>);
      }
    },
  );
}

let bound = false;

export function bindPreferencesSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eaglePreferencesState = usePreferencesState;
}
