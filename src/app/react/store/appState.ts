import { create } from 'zustand';
import { eagle, electronSettings, i18n, ipcRenderer, t } from '../global/eagleGlobals';

/**
 * 全局应用状态（阶段1：壳与全局状态）。
 *
 * 数据来源零复制：theme/language/preferences 全部来自 electronSettings 的 getPreferences，
 * 而非本地重新实现。eagle 全局（inspector/filter/action...）保持由原全局单例持有，
 * 这里只建立「订阅视图」以便 React 组件响应式消费。
 */

export interface AppPreferences {
  theme: { name: string; css: string };
  general: { language: string; zoom: string; showSidebarBadge: string; enableVibrancy?: string };
  privacy: { enable: string };
  habits: { hoverZoom: string; transparency: string };
  shortcuts?: { keybinds: Record<string, string> };
  [key: string]: any;
}

export interface LibraryItem {
  id: string;
  name: string;
  ext: string;
  width?: number;
  height?: number;
  size?: number;
  url?: string;
  website?: string;
  annotation?: string;
  tags?: string[];
  folders?: string[];
  star?: number;
  palette?: Array<{ color: number[] }>;
  palettes?: Array<{ color: number[] }>;
  noThumbnail?: boolean;
  isDeleted?: boolean;
  modificationTime?: number;
  lastModified?: number;
  [key: string]: any;
}

export interface AppState {
  platform: string;
  isWin11: boolean;
  theme: string;
  language: string;
  languageBCP: string;
  vibrancyEnabled: boolean;
  preferences: AppPreferences | null;

  // eagle 全局子状态（读自 window.eagle，非复制）
  inspector: any;
  filter: any;

  // initial derived — 阶段2/3 填入具体字段
  appliedPreferences: () => AppPreferences | null;
  setTheme: (theme: string) => void;
  setLanguage: (language: string) => void;
  setPreferences: (preferences: AppPreferences) => void;
  refreshFromGlobals: () => void;
  /** RootController 的主题分支（bundle:20072-20090）：Auto 主题跟随系统深浅色。 */
  applyThemePreference: (themePref: { name?: string; css?: string } | undefined) => void;
  /** RootController.toggleAlwaysOnTop（bundle:20138-20151）。 */
  toggleAlwaysOnTop: () => void;
  /** RootController.openRegisterModal（bundle:20124-20126）。 */
  openRegisterModal: () => void;
  /** RootController.openTrialModal（bundle:20128-20133）。 */
  openTrialModal: (trialRemain: number) => void;
}

const inITIAL = electronSettings()?.getPreferences?.() || null;
const themePref = inITIAL?.theme?.css || 'gray';

export const useAppState = create<AppState>((set, get) => ({
  platform: (window as any).process?.platform || 'win32',
  isWin11: typeof (window as any).isWin11 === 'boolean' ? (window as any).isWin11 : false,
  theme: themePref,
  language: inITIAL?.general?.language || 'en',
  languageBCP: String(inITIAL?.general?.language || 'en').replace('_', '-'),
  vibrancyEnabled: inITIAL?.general?.enableVibrancy !== 'false',
  preferences: inITIAL,

  inspector: eagle()?.inspector || null,
  filter: eagle()?.filter || null,

  appliedPreferences: () => get().preferences,
  setTheme: (theme: string) => set({ theme }),
  setLanguage: (language: string) =>
    set({ language, languageBCP: String(language).replace('_', '-') }),
  setPreferences: (preferences: AppPreferences) =>
    set({ preferences, theme: preferences?.theme?.css || get().theme, language: preferences?.general?.language || get().language }),
  refreshFromGlobals: () => {
    const prefs = electronSettings()?.getPreferences?.() || null;
    set({
      preferences: prefs,
      theme: prefs?.theme?.css || 'gray',
      language: prefs?.general?.language || 'en',
      languageBCP: String(prefs?.general?.language || 'en').replace('_', '-'),
      vibrancyEnabled: prefs?.general?.enableVibrancy !== 'false',
      inspector: eagle()?.inspector || null,
      filter: eagle()?.filter || null,
    });
  },

  // 与 bundle:20072-20090 的 RootController 主题分支逐字对齐：
  // Auto → 跟随系统 nativeTheme；否则取 theme.css，缺省 gray。
  applyThemePreference: (themePref) => {
    let theme = themePref?.css || 'gray';
    if (themePref && themePref.name === 'Auto') {
      const nativeTheme = (window as any).require?.('electron')?.remote?.nativeTheme;
      theme = nativeTheme?.shouldUseDarkColors ? 'gray' : 'light';
    }
    set({ theme });
  },

  toggleAlwaysOnTop: () => {
    const state = get();
    const isAlwaysOnTop = !(state as any).isAlwaysOnTop;
    (state as any).isAlwaysOnTop = isAlwaysOnTop;
    const currentWindow = (window as any).require?.('electron')?.remote?.getCurrentWindow?.();
    if (isAlwaysOnTop) {
      currentWindow?.setAlwaysOnTop?.(true, 'pop-up-menu');
    } else {
      currentWindow?.setAlwaysOnTop?.(false);
    }
  },

  openRegisterModal: () => {
    ipcRenderer()?.send?.('open-registration', 'REGISTER');
  },

  openTrialModal: (trialRemain: number) => {
    if (trialRemain) ipcRenderer()?.send?.('open-trial-modal', trialRemain);
  },
}));

export { t, i18n };
