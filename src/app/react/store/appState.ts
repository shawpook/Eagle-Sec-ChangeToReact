import { create } from 'zustand';
import { eagle, electronSettings, i18n, t } from '../global/eagleGlobals';

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
}));

export { t, i18n };
