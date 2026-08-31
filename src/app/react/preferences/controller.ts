/**
 * 偏好窗口控制器——preferences.js（PreferencesController + PasswordController）无 Angular 移植。
 *
 * 阶段8e-2：本模块取代 Angular 控制器成为唯一数据面。controllerScope 是普通对象，字段与
 * 原 $scope 同名同形（preferences/currentPanel/keyword/themes/currentTheme/launchAtLogin/
 * keybindGroups/installPlugins/sidebarPanels/changes/showSearchEmpty/...），方法保留原函数名
 * 与原语义（changeTheme/changeZoom/onKeywordChange/switchPanel/save/apply/cancel/escHandler/
 * openPasswordModal/lockNow/...），使面板层调用点零改动。
 *
 * 订阅模型：applyController(fn) = fn(controllerScope) + notify（ng-click 的 $apply 等价）；
 * 异步回调（ipc/对话框/Promise）内改字段后调 notifyController()（$evalAsync 等价）。
 * shell.tsx 订阅后驱动 React 渲染；panels.tsx 的快照桥同样订阅本模块。
 *
 * 数据面通道零改动：ipcRenderer（'chnage-preferences'/'electron-info'/'change-theme'/
 * 'change-zoom'/'open-with-default'/'lock-now'）、electron-settings、localStorage
 * （eagle.preference.lastPanel）、window.ShortcutManager、auto-launch。
 */

const req = (name: string): any => (window as any).require?.(name);

/* ================= i18n 通道（偏好页无 window.i18n，自建；从 panels.tsx 移入） ================= */

let i18nInst: any = null;
export const pfT = (key: string): string => {
  try {
    if (!i18nInst) {
      const appRoot = req('app-root-path');
      const I18nClass = req(String(appRoot) + '/i18n');
      i18nInst = new I18nClass();
    }
    const out = i18nInst.__(key);
    return out == null ? key : out;
  } catch (err) {
    return key;
  }
};

/* ================= 工具（preferences.js 模块级函数逐字） ================= */

function formatShortcut(shortcut: string): string {
  if (process.platform !== 'darwin') {
    shortcut = shortcut.replace('CommandOrControl', 'Ctrl');
    shortcut = shortcut.replace('CmdOrCtrl', 'Ctrl');
  } else {
    shortcut = shortcut.replace('CmdOrCtrl', 'Command');
    shortcut = shortcut.replace('CommandOrControl', 'Command');
    shortcut = shortcut.replace('Alt', 'Option');
    shortcut = shortcut.replace('Ctrl', 'Control');
  }
  return shortcut;
}

function toBooleanString(string: any): string {
  if (string === undefined || string === null) return 'false';
  return Boolean(string).toString();
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getCurrentWindow(): any {
  try {
    return req('@electron/remote')?.getCurrentWindow?.();
  } catch (err) {
    return null;
  }
}

/* ================= 订阅存储（digest 等价） ================= */

let version = 0;
const listeners = new Set<() => void>();

export function subscribeController(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getControllerVersion(): number {
  return version;
}

function notify(): void {
  version++;
  listeners.forEach((l) => l());
}

/** ng-click 的 $apply 等价：执行变更后统一 notify。 */
export function applyController(fn?: (s: any) => void): void {
  try {
    if (fn) fn(controllerScope);
  } catch (err) {
    console.error('[eagle-preferences-controller]', err);
  }
  notify();
}

/** $evalAsync 等价（异步回调边界）。 */
export function notifyController(): void {
  notify();
}

/* ================= 静态数据（preferences.js 360-800 逐字） ================= */

function buildKeybindGroups(): any[] {
  const groups: any[] = [
    {
      name: 'global',
      conflict: 'all',
      items: [
        { key: 'global.show.eagle' },
        { key: 'global.show.search' },
        { key: 'global.capture.area' },
        { key: 'global.capture.window' },
        { key: 'global.capture.full' },
      ],
    },
    // 播放器(衝突判斷僅需跟組裡判斷，不需要跟組外)
    {
      name: 'player',
      conflict: 'player',
      items: [
        { key: 'player.playAndPause' },
        { key: 'player.prev1frame' },
        { key: 'player.next1frame' },
        { key: 'player.prev10frame' },
        { key: 'player.next10frame' },
        { key: 'player.volume.increase' },
        { key: 'player.volume.decrease' },
        { key: 'player.step.forward' },
        { key: 'player.step.backward' },
        { key: 'player.speed.up' },
        { key: 'player.speed.down' },
        { key: 'player.thumbnail.set' },
        { key: 'player.thumbnail.copy' },
        { key: 'player.thumbnail.save' },
      ],
    },
    {
      name: 'file',
      conflict: 'all',
      items: [
        { key: 'file.create.new' },
        { key: 'file.create.folder' },
        { key: 'file.create.subfolder' },
        { key: 'file.create.smartfolder' },
        { key: 'file.import.folders' },
        { key: 'file.import.links' },
        { key: 'file.import.eaglepack' },
        { key: 'file.import.pinterest' },
        { key: 'file.import.artstation' },
        { key: 'file.export.item.eaglepack' },
        { key: 'file.export.item.computer' },
        { key: 'file.export.item.as' },
        { key: 'file.export.csv' },
      ],
    },
    {
      name: 'library',
      conflict: 'all',
      items: [{ key: 'library.create' }, { key: 'library.load' }, { key: 'library.switch' }],
    },
    {
      name: 'edit',
      conflict: 'all',
      items: [
        { key: 'edit.rename.win32', platform: 'win32' },
        { key: 'edit.rename.darwin', platform: 'darwin' },
        { key: 'edit.copy.path' },
        { key: 'edit.copy.folderpath' },
        { key: 'edit.copy.eaglelink' },
        { key: 'edit.copy.thumbnail' },
        { key: 'edit.copy.base64' },
        { key: 'edit.copy.name' },
        { key: 'edit.duplicate' },
        { key: 'edit.thumbnail.refresh' },
        { key: 'edit.thumbnail.custom.file' },
        { key: 'edit.thumbnail.custom.clipboard' },
        { key: 'edit.thumbnail.custom.reset' },
        { key: 'edit.image.flip' },
        { key: 'edit.image.rotate' },
        { key: 'edit.image.crop' },
        { key: 'edit.image.merge' },
        { key: 'edit.folder.setting' },
        { key: 'edit.folder.password.create' },
        { key: 'edit.folder.password.change' },
        { key: 'edit.folder.password.reset' },
        { key: 'edit.folder.password.lock' },
        { key: 'edit.folder.move' },
        { key: 'edit.remove.folder.darwin', platform: 'darwin' },
        { key: 'edit.remove.folder.win32', platform: 'win32' },
        { key: 'edit.remove.trash.darwin', platform: 'darwin' },
        { key: 'edit.remove.trash.win32', platform: 'win32' },
      ],
    },
    {
      name: 'find',
      conflict: 'all',
      items: [
        { key: 'find.search.current' },
        { key: 'find.search.all' },
        { key: 'find.sidebar.filter' },
        { key: 'find.quicksearch' },
        { key: 'find.add.to' },
        { key: 'find.filter.toggle' },
        { key: 'find.filter.reset' },
        { key: 'find.filter.folder' },
        { key: 'find.filter.tag' },
        { key: 'find.filter.color' },
        { key: 'find.filter.shape' },
        { key: 'find.filter.rating' },
        { key: 'find.filter.import' },
        { key: 'find.filter.date' },
        { key: 'find.filter.type' },
        { key: 'find.filter.size' },
        { key: 'find.filter.resolution' },
        { key: 'find.filter.duration' },
        { key: 'find.filter.annotation' },
        { key: 'find.filter.note' },
        { key: 'find.filter.url' },
        { key: 'find.filter.bpm' },
        { key: 'find.filter.camera' },
        { key: 'find.filter.fonts' },
        { key: 'find.filter.other' },
      ],
    },
    {
      name: 'reverse',
      conflict: 'all',
      items: [
        { key: 'find.reverse.eagle' },
        { key: 'find.reverse.google' },
        { key: 'find.reverse.bing' },
        { key: 'find.reverse.yandex' },
        { key: 'find.reverse.tineye' },
        { key: 'find.reverse.saucenao' },
        { key: 'find.reverse.baidu' },
        { key: 'find.reverse.sogou' },
      ],
    },
    {
      name: 'organize',
      conflict: 'all',
      items: [
        // 評分
        { key: 'organize.rating.5' },
        { key: 'organize.rating.4' },
        { key: 'organize.rating.3' },
        { key: 'organize.rating.2' },
        { key: 'organize.rating.1' },
        { key: 'organize.rating.0' },
        // 標籤
        { key: 'organize.tag.add' },
        { key: 'organize.tag.copy' },
        { key: 'organize.tag.paste' },
        { key: 'organize.tag.clear' },
        // 文件夾
        { key: 'organize.folder.add' },
        { key: 'organize.folder.addLast' },
      ],
    },
    {
      name: 'view',
      conflict: 'all',
      items: [
        // 窗口控制
        { key: 'view.alwaysOnTop' },
        // 頁面切換
        { key: 'view.all' },
        { key: 'view.unfiled' },
        { key: 'view.untagged' },
        { key: 'view.recent' },
        { key: 'view.random' },
        { key: 'view.alltags' },
        { key: 'view.trash' },
        // 佈局切換
        { key: 'view.layout.grid' },
        { key: 'view.layout.justified' },
        { key: 'view.layout.waterfall' },
        { key: 'view.layout.list' },
        // 縮放
        { key: 'view.zoom.in' },
        { key: 'view.zoom.out' },
        { key: 'view.zoom.actual' },
        { key: 'view.zoom.fit' },
        // 檔案操作
        { key: 'view.file.opennewwindow' },
        { key: 'view.file.opendefault' },
        { key: 'view.file.openother', platform: 'win32' },
        { key: 'view.file.openfinder' },
        { key: 'view.file.openlink' },
        { key: 'view.reveal.darwin', platform: 'darwin' },
        { key: 'view.reveal.win32', platform: 'win32' },
        { key: 'view.duplicate.darwin', platform: 'darwin' },
        { key: 'view.duplicate.win32', platform: 'win32' },
        // 頁面滾動
        { key: 'view.scroll.home' },
        { key: 'view.scroll.end' },
        { key: 'view.scroll.prevpage' },
        { key: 'view.scroll.nextpage' },
        // 切換顯示
        { key: 'view.toggle.sidebar' },
        { key: 'view.toggle.inspector' },
        { key: 'view.toggle.all' },
        { key: 'view.toggle.listname' },
        { key: 'view.toggle.listmetas' },
        { key: 'view.toggle.listannotation' },
        { key: 'view.toggle.subfolder' },
        { key: 'view.toggle.navigator' },
        // 其他功能
        { key: 'view.grayscale' },
        { key: 'view.toggle.slideshow' },
      ],
    },
    {
      name: 'others',
      conflict: 'all',
      items: [{ key: 'app.preferences' }, { key: 'app.lock' }],
    },
  ];

  // 過濾平台特定的快捷鍵
  const currentPlatform = process.platform;
  return groups.map((group) => ({
    ...group,
    items: group.items.filter((item: any) => {
      // 如果沒有指定平台，則顯示
      if (!item.platform) return true;
      // 如果指定了平台，只在匹配的平台上顯示
      return item.platform === currentPlatform;
    }),
  }));
}

const SIDEBAR_PANELS: any[] = [
  { type: 'panel', name: 'general', iconPath: 'ic-general.svg', i18n: pfT('preferencesWindow.sidebar.general') },
  { type: 'panel', name: 'sidebar', iconPath: 'ic-sidebar.svg', i18n: pfT('preferencesWindow.sidebar.sidebar') },
  { type: 'separator' },
  { type: 'panel', name: 'control', iconPath: 'ic-control.svg', i18n: pfT('preferencesWindow.sidebar.control') },
  { type: 'panel', name: 'habits', iconPath: 'ic-view.svg', i18n: pfT('preferencesWindow.sidebar.habits') },
  { type: 'panel', name: 'screencapture', iconPath: 'ic-screenshot.svg', i18n: pfT('preferencesWindow.sidebar.screencCapture') },
  { type: 'panel', name: 'shortcuts', iconPath: 'ic-shortcuts.svg', i18n: pfT('preferencesWindow.sidebar.shortcuts') },
  { type: 'separator' },
  { type: 'panel', name: 'notification', iconPath: 'ic-notification.svg', i18n: pfT('preferencesWindow.sidebar.notification') },
  { type: 'panel', name: 'privacy', iconPath: 'ic-lock.svg', i18n: pfT('preferencesWindow.sidebar.privacy') },
  { type: 'panel', name: 'autoImport', iconPath: 'ic-autoimport.svg', i18n: pfT('preferencesWindow.sidebar.autoImport') },
  { type: 'separator' },
  { type: 'panel', name: 'developer', iconPath: 'ic-developer.svg', i18n: pfT('sidebar.developer') },
];

const THEMES: any[] = [
  { name: 'Auto', css: 'auto' },
  { name: 'LIGHT', color: '#f5f5f5', css: 'light' },
  { name: 'LIGHTGRAY', color: '#e5e5e5', css: 'lightgray' },
  { name: 'GRAY', color: '#303134', css: 'gray' },
  { name: 'DARK', color: '#1F2023', css: 'dark' },
  { name: 'BLUE', color: '#303342', css: 'blue' },
  { name: 'PURPLE', color: '#343141', css: 'purple' },
];

/* ================= 控制器（PreferencesController + PasswordController 合并移植） ================= */

const eagleAutoLauncher = (() => {
  try {
    const AutoLaunch = req('auto-launch');
    if (process.platform !== 'darwin') {
      return new AutoLaunch({ name: 'Eagle', isHidden: true });
    }
    return new AutoLaunch({ name: 'Eagle', path: '/Applications/Eagle.app', isHidden: true });
  } catch (err) {
    return null;
  }
})();

const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
const currentPlatform = process.platform;

function canUseTouchID(): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    const systemPreferences = req('@electron/remote')?.systemPreferences;
    if (!systemPreferences?.canPromptTouchID) return false;
    return !!systemPreferences.canPromptTouchID();
  } catch (err) {
    console.error('檢查 Touch ID 支援時發生錯誤:', err);
    return false;
  }
}

export const controllerScope: any = {
  keyword: '',
  shortcutKeyword: '',
  // 原版 $scope.lastPanel 在 sidebarPanels/currentPanel 定义之前赋值（preferences.js:339）→ undefined
  lastPanel: undefined,
  soundEffect: 'true',
  platform: currentPlatform,
  arch: process.arch,
  isAppleSilicon,
  canUseTouchID: canUseTouchID(),
  changes: {},
  searchSidebarItem: { name: 'search', i18n: pfT('preferencesWindow.sidebar.searchResult') },
  keybindGroups: buildKeybindGroups(),
  keybinds: [] as any[],
  sidebarPanels: SIDEBAR_PANELS,
  themes: THEMES,
  installPlugins: undefined,
  filteredInstallPlugins: undefined,
  showSearchEmpty: false,
  vibrancyEnabled: undefined,
  password: { isOpen: false, mode: 'change', oldPassword: '', newPassword: '', newRePassword: '', passwordTips: '' },
  preferences: undefined,

  initKeybindsFlat() {
    // 保持向後兼容的平面化結構用於搜索（preferences.js 596-599）
    this.keybinds = [];
    this.keybindGroups.forEach((group: any) => {
      this.keybinds = this.keybinds.concat(group.items);
    });
  },

  switchPanel(panel: any) {
    if (!panel) return;
    this.keyword = '';
    this.showSearchEmpty = false;
    localStorage['eagle.preference.lastPanel'] = panel.name;
    this.currentPanel = panel;
  },

  onKeywordChange($event?: any) {
    if (this.keyword) {
      if (this.currentPanel.name !== 'search') {
        this.lastPanel = this.currentPanel;
      }
      this.currentPanel = this.searchSidebarItem;
    } else {
      this.currentPanel = this.lastPanel;
    }
  },

  focusSearch($event?: any) {
    const el = document.getElementById('sidebar-search') as HTMLInputElement | null;
    if (el) el.focus();
  },

  // 更改开机自动启动
  changeAutoLaunch(autoLaunch: any) {
    this.launchAtLogin = autoLaunch;
  },

  changeTheme(theme: any) {
    this.currentTheme = theme;
    this.themeName = this.getThemeName(theme);
    this.preferences.theme = theme;
    req('electron').ipcRenderer.send('change-theme', theme);
  },

  themeAttr() {
    try {
      if (this?.preferences?.theme?.name === 'Auto') {
        if (req('@electron/remote').nativeTheme.shouldUseDarkColors) {
          return 'gray';
        } else {
          return 'light';
        }
      } else {
        return this?.preferences?.theme?.css || 'gray';
      }
    } catch (err) {
      // 原版在 Auto 且无 nativeTheme 时抛错（interpolation 吞掉）；此处守卫回退
      return this?.preferences?.theme?.css || 'gray';
    }
  },

  getThemeName(theme: any) {
    if (theme.name === 'Auto') {
      try {
        if (req('@electron/remote').nativeTheme.shouldUseDarkColors) {
          return 'GRAY';
        } else {
          return 'LIGHT';
        }
      } catch (err) {
        return 'GRAY';
      }
    } else {
      return theme.name;
    }
  },

  getThemeCSS(theme: any) {
    if (theme.name === 'Auto') {
      try {
        if (req('@electron/remote').nativeTheme.shouldUseDarkColors) {
          return 'gray';
        } else {
          return 'light';
        }
      } catch (err) {
        return 'light';
      }
    } else {
      return theme.css;
    }
  },

  languageChange(language: any) {
    this.changes.language = language;
  },

  changeZoom(zoom: any) {
    this.currentZoom = zoom;
    this.preferences.general.zoom = zoom;
    req('electron').ipcRenderer.send('change-zoom', zoom);
  },

  escHandler($event?: any) {
    $event && $event.stopPropagation && $event.stopPropagation();
    this.cancel();
  },

  getTheme(theme: any) {
    for (let i = 0; i < this.themes.length; i++) {
      if (this.themes[i].name === theme) {
        return this.themes[i];
      }
    }
    return this.themes[0];
  },

  // 储存设定：apply + hide + 300ms close（preferences.js 965-974）
  save() {
    this.apply();
    const currentWindow = getCurrentWindow();
    currentWindow && currentWindow.hide();
    setTimeout(() => {
      currentWindow && currentWindow.close();
    }, 300);
  },

  // 将用户设定写回 settings 物件（preferences.js 976-1009）
  apply() {
    const ipcRenderer = req('electron').ipcRenderer;
    ipcRenderer.send('electron-info', `[app] Save preferences`);
    if (process.platform !== 'darwin') {
      if (this.launchAtLogin == 'true') {
        eagleAutoLauncher && eagleAutoLauncher.enable();
        ipcRenderer.send('electron-info', `[app] Auto launch: ON`);
      } else {
        eagleAutoLauncher && eagleAutoLauncher.disable();
        ipcRenderer.send('electron-info', `[app] Auto launch: OFF`);
      }
    } else {
      if (this.launchAtLogin == 'true') {
        eagleAutoLauncher && eagleAutoLauncher.enable();
        ipcRenderer.send('electron-info', `[app] Auto launch: ON`);
      } else {
        eagleAutoLauncher && eagleAutoLauncher.disable();
        ipcRenderer.send('electron-info', `[app] Auto launch: OFF`);
      }
    }

    try {
      if (this.preferences.autoImport.enable == 'true') {
        ipcRenderer.send('electron-info', `[app] Auto-import: ON`);
        ipcRenderer.send('electron-info', `[app] Auto-import path: ${this.preferences.autoImport.path}`);
      } else {
        ipcRenderer.send('electron-info', `[app] Auto-import: OFF`);
      }
    } catch (err) {}

    ipcRenderer.send('chnage-preferences', this.preferences);
  },

  cancel() {
    if (this.preferences.theme != this.lastTheme) {
      this.currentTheme = this.lastTheme;
      this.themeName = this.getThemeName(this.currentTheme);
      this.preferences.theme = this.lastTheme;
      req('electron').ipcRenderer.send('change-theme', this.lastTheme);
    }

    if (this.preferences.general.zoom != this.lastZoom) {
      this.currentZoom = this.lastZoom;
      this.preferences.general.zoom = this.lastZoom;
      req('electron').ipcRenderer.send('change-zoom', this.lastZoom);
    }
    const currentWindow = getCurrentWindow();
    currentWindow && currentWindow.close();
  },

  openAutoImport(event?: any) {
    if (this.preferences.autoImport.enable !== 'false') {
      if (!this.preferences.autoImport.path) {
        this.chooseAutoImportPath();
      }
    }
  },

  chooseAutoImportPath(event?: any) {
    const remote = req('@electron/remote');
    remote.dialog
      .showOpenDialog(getCurrentWindow(), {
        title: pfT('Dialog.Import.Eaglepack.Message'),
        filters: [],
        properties: ['openDirectory', 'createDirectory'],
      })
      .then((result: any) => {
        const paths = result.filePaths;
        if (!paths || paths.length === 0) {
          if (!this.preferences.autoImport.path) {
            this.preferences.autoImport.enable = 'false';
          }
          notify();
          return;
        }
        const appRoot = req('app-root-path');
        const isNetworkDrive = req(String(appRoot) + '/my_modules/is-network-drive');
        const autoImportPath = paths[0];
        if (isNetworkDrive(autoImportPath)) {
          remote.dialog.showMessageBox(
            {
              type: 'warning',
              cancelId: 1,
              buttons: [pfT('general.close')],
              message: pfT('general.hint'),
              detail: pfT('dialog.autoImport.networkPath'),
            },
            () => {}
          );
        } else {
          this.preferences.autoImport.path = autoImportPath;
          notify();
        }
      })
      .catch((err: any) => {
        console.log(err);
      });
  },

  revealAutoImportPath(event?: any) {
    const autoImportPath = this.preferences.autoImport.path;
    const fs = req('fs');
    if (autoImportPath && fs.existsSync(autoImportPath)) {
      req('electron').ipcRenderer.send('open-with-default', autoImportPath);
    }
  },

  openPasswordModal(event: any, mode: string) {
    if (mode === 'new') {
      if (this.preferences.privacy.enable !== 'false' && !this.preferences.privacy.password) {
        // $rootScope.$broadcast('SET-APP-PASSWORD', mode) → PasswordController 接管（本对象 password 区）
        this.password.isOpen = true;
        this.password.mode = mode;
        notify();
      } else {
        req('electron').ipcRenderer.send('chnage-preferences', this.preferences);
      }
    } else if (mode === 'change') {
      this.password.isOpen = true;
      this.password.mode = mode;
      notify();
    }
  },

  lockNow() {
    if (this.preferences.privacy.enable !== 'false' && this.preferences.privacy.password) {
      req('electron').ipcRenderer.send('lock-now');
      this.pwdClose();
    }
  },

  toggleTouchIDClick(event?: any) {
    // 如果點擊的是 toggle 本身，不做任何事（讓 toggle 自己處理）
    if (event && event.target && (event.target.tagName === 'INPUT' || (event.target.classList && event.target.classList.contains('slider')))) {
      return;
    }
    // 否則切換 Touch ID 狀態
    if (this.preferences.privacy.enableTouchID === 'true') {
      this.preferences.privacy.enableTouchID = 'false';
    } else {
      this.preferences.privacy.enableTouchID = 'true';
    }
    // 觸發 toggleTouchID 函數
    this.toggleTouchID();
  },

  async toggleTouchID() {
    if (this.preferences.privacy.enableTouchID === 'true') {
      // 首次啟用時進行驗證
      try {
        const prompt = pfT('preferencesWindow.privacy.touchid.prompt.enable') || '驗證以啟用 Touch ID 解鎖功能';
        const systemPreferences = req('@electron/remote')?.systemPreferences;
        await systemPreferences.promptTouchID(prompt);
        // 驗證成功，儲存設定
        req('electron').ipcRenderer.send('chnage-preferences', this.preferences);
      } catch (err) {
        // 驗證失敗或取消，還原設定
        console.log('Touch ID 驗證失敗或取消:', err);
        this.preferences.privacy.enableTouchID = 'false';
        notify();
      }
    } else {
      // 停用 Touch ID
      req('electron').ipcRenderer.send('chnage-preferences', this.preferences);
    }
  },

  regenerateApiToken() {
    this.preferences.developer.apiToken = crypto.randomUUID();
  },

  copyApiToken() {
    const { clipboard } = req('electron');
    clipboard.writeText(this.preferences.developer.apiToken);
  },

  onPluginShortcutChange(plugin: any) {
    this.preferences.shortcuts.keybinds[plugin.id] = plugin.formatShortcut;
  },

  restoreDefaultShortcuts() {
    const remote = req('@electron/remote');
    const buttons = [pfT('general.cancel'), pfT('preferencesWindow.shortcuts.restoreDefaults>confirm')];
    remote.dialog
      .showMessageBox(getCurrentWindow(), {
        type: 'question',
        buttons: buttons,
        defaultId: 1,
        cancelId: 0,
        message: pfT('preferencesWindow.shortcuts.restoreDefaults>title'),
        detail: pfT('preferencesWindow.shortcuts.restoreDefaults>message'),
      })
      .then((result: any) => {
        if (result.response === 1) {
          // 用戶點擊確認
          this.performShortcutsReset();
          notify();
        }
      })
      .catch((err: any) => {
        console.error('Failed to show restore defaults dialog:', err);
      });
  },

  performShortcutsReset() {
    try {
      const appRoot = req('app-root-path');
      // 載入預設設定
      const defaultPreferences = req(String(appRoot) + '/app/js/default-preferences.js');

      // 重置所有快捷鍵
      const defaultKeybinds = deepCopy(defaultPreferences.shortcuts.keybinds);

      // 格式化快捷鍵字符串
      for (const key in defaultKeybinds) {
        defaultKeybinds[key] = formatShortcut(defaultKeybinds[key]);
      }

      // 更新當前設定
      this.preferences.shortcuts.keybinds = defaultKeybinds;

      // 重置插件快捷鍵
      if (this.installPlugins) {
        this.installPlugins.forEach((plugin: any) => {
          if (plugin.shortcut) {
            plugin.formatShortcut = formatShortcut(plugin.shortcut);
            this.preferences.shortcuts.keybinds[plugin.id] = plugin.formatShortcut;
          } else {
            // 清空插件自定義快捷鍵
            delete this.preferences.shortcuts.keybinds[plugin.id];
            plugin.formatShortcut = '';
          }
        });
      }

      // 更新搜尋結果（updateKeybinds——面板按 shortcutKeyword 自算，此处仅触发 UI 更新）
      // 記錄操作
      req('electron').ipcRenderer.send('electron-info', '[app] Shortcuts restored to defaults');
    } catch (error) {
      console.error('Failed to restore default shortcuts:', error);
      const remote = req('@electron/remote');
      // 顯示錯誤對話框
      remote.dialog.showMessageBox(getCurrentWindow(), {
        type: 'error',
        buttons: [pfT('general.close')],
        message: pfT('general.error'),
        detail: pfT('preferencesWindow.shortcuts.restoreDefaults>error'),
      });
    }
  },

  /* ---------- PasswordController（合并为 password 区；preferences.js 171-287 逐字） ---------- */

  pwdSave() {
    switch (this.password.mode) {
      case 'new':
        this.pwdSetNewPassword();
        break;
      case 'change':
        this.pwdChangePassword();
        break;
    }
  },

  pwdCancel() {
    this.pwdClose();
    if (this.password.mode === 'new') {
      this.preferences.privacy.enable = 'false';
    }
    notify();
  },

  pwdClose() {
    this.password.isOpen = false;
    setTimeout(() => {
      this.password.oldPassword = '';
      this.password.newPassword = '';
      this.password.newRePassword = '';
      this.password.passwordTips = '';
      notify();
    }, 200);
  },

  pwdSetNewPassword() {
    const newPassword = this.password.newPassword;
    const newRePassword = this.password.newRePassword;
    const passwordTips = this.password.passwordTips;
    const ipcRenderer = req('electron').ipcRenderer;
    if (newPassword && newRePassword && newPassword === newRePassword) {
      const endcodePassword = window.btoa(newPassword);
      this.preferences.privacy.enable = 'true';
      this.preferences.privacy.password = endcodePassword;
      this.preferences.privacy.passwordTips = passwordTips;
      console.log(endcodePassword);
      this.pwdClose();
      ipcRenderer.send('electron-info', `[app] Change app password`);
      ipcRenderer.send('chnage-preferences', this.preferences);
      notify();
    } else {
      // 界面提示缺少
      const el = document.getElementById('new-folder-password-input');
      if (el) {
        el.focus();
        el.classList.add('animation--shake-horizontal', 'constant');
        setTimeout(() => {
          el.classList.remove('animation--shake-horizontal', 'constant');
        }, 350);
      }
    }
  },

  pwdChangePassword() {
    const oldPassword = this.password.oldPassword;
    const newPassword = this.password.newPassword;
    const newRePassword = this.password.newRePassword;
    const passwordTips = this.password.passwordTips;
    const ipcRenderer = req('electron').ipcRenderer;
    const Registration = (window as any).Registration;

    try {
      // 原版隐式全局 email（Registration.license.email 赋值后未使用），保留无操作等价
      if (Registration && Registration.license && Registration.license.email) {
        (globalThis as any).email = Registration.license.email;
      }
    } catch (err) {}

    // 判断是否有填写
    if (oldPassword && newPassword && newRePassword && newPassword === newRePassword) {
      // 新旧密码验证
      if (window.atob(this.preferences.privacy.password) === oldPassword || (oldPassword && oldPassword === Registration?.license?.code)) {
        const endcodePassword = window.btoa(newPassword);
        this.preferences.privacy.enable = 'true';
        this.preferences.privacy.password = endcodePassword;
        this.preferences.privacy.passwordTips = passwordTips;
        this.pwdClose();
        ipcRenderer.send('electron-info', `[app] Change app password`);
        ipcRenderer.send('chnage-preferences', this.preferences);
        notify();
      } else {
        // 界面提示密码错误
        const el = document.getElementById('change-folder-password-input');
        if (el) {
          el.focus();
          el.classList.add('animation--shake-horizontal', 'constant');
          setTimeout(() => {
            el.classList.remove('animation--shake-horizontal', 'constant');
          }, 350);
        }
      }
    } else {
      // 界面提示缺少
    }
  },

  /* ---------- 初始化序列（ipc 'init' 处理器 + initAutoLaunch/initPreference/initPlugins） ---------- */

  initAutoLaunch() {
    if (!eagleAutoLauncher || !eagleAutoLauncher.isEnabled) {
      return;
    }
    eagleAutoLauncher
      .isEnabled()
      .then((isEnabled: boolean) => {
        console.log(isEnabled);
        if (isEnabled) {
          this.launchAtLogin = 'true';
        } else {
          this.launchAtLogin = 'false';
        }
        notify();
      })
      .catch((err: any) => {
        console.log(err);
        // 原版怪癖：失败时写的是 eagleAutoLauncher 字段（launchAtLogin 保持 undefined）
        this.eagleAutoLauncher = 'false';
        notify();
      });
  },

  initPreference() {
    const appRoot = req('app-root-path');
    const settings = req(String(appRoot) + '/my_modules/electron-settings');
    const data = settings.getPreferences();
    // 载入预设样版
    const defaultPreferences = req(String(appRoot) + '/app/js/default-preferences.js');
    const preferences = deepCopy(defaultPreferences);

    preferences.shortcuts.keybinds['global.capture.area'] =
      (data.shortcuts && data.shortcuts.screenCaptureShortcut) || preferences.shortcuts.keybinds['global.capture.area'];
    preferences.shortcuts.keybinds['global.capture.window'] =
      (data.shortcuts && data.shortcuts.windowCaptureShortcut) || preferences.shortcuts.keybinds['global.capture.area'];
    preferences.screencapture.useRetina = toBooleanString(data.useRetina) || preferences.screencapture.useRetina;

    this.currentTheme = data.theme || this.getTheme(preferences.theme);
    this.themeName = this.getThemeName(this.currentTheme);
    this.currentZoom = data.general.zoom;

    if (!this.currentTheme) this.currentTheme = this.themes[0];
    this.lastTheme = this.currentTheme;
    this.lastZoom = this.currentZoom;
    this.language = data.general.language || 'en';

    // 替换 CmdOrCtrl 预设值
    for (const key in preferences.shortcuts.keybinds) {
      preferences.shortcuts.keybinds[key] = formatShortcut(preferences.shortcuts.keybinds[key]);
    }
    if (data && data.shortcuts && data.shortcuts.keybinds) {
      for (const key in data.shortcuts.keybinds) {
        data.shortcuts.keybinds[key] = formatShortcut(data.shortcuts.keybinds[key]);
      }
    }

    // 避免旧版本的 shortcuts 压过
    if (preferences.shortcuts && !preferences.shortcuts.keybinds) {
      delete data.shortcuts;
    }

    // 将使用者设定的部分写入（angular.extend 为浅拷贝，逐字保留）
    Object.assign(preferences, data);

    this.preferences = preferences;
    this.preferences.general.language = (i18nInst && i18nInst.locale) || data.language || preferences.general.language;
    this.vibrancyEnabled = preferences?.general?.enableVibrancy !== 'false';

    // 舊版本相容：補上彈出通知總開關預設值
    if (!this.preferences.notification.notification.enable) {
      this.preferences.notification.notification.enable = 'true';
    }

    const fs = req('fs');
    if (this.preferences.autoImport.path && !fs.existsSync(this.preferences.autoImport.path)) {
      this.preferences.autoImport.path = '';
      this.preferences.autoImport.enable = 'false';
    }

    // 初始化快速鍵管理器，傳入群組資訊
    if ((window as any).ShortcutManager) {
      (window as any).ShortcutManager.init(this.preferences, this.keybindGroups);
      console.log('[ShortcutManager] Initialized with preferences and groups');
    } else {
      console.warn('[ShortcutManager] ShortcutManager not available');
    }

    notify();
  },

  async initPlugins() {
    const appRoot = req('app-root-path');
    const pluginModule = req(String(appRoot) + '/app/js/plugin');
    // pluginModule.init() 在偏好設定視窗中可能 hang 住，Promise.race 加超時避免（原版注释）
    await Promise.race([Promise.resolve(pluginModule.init()).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 5000))]);
    this.installPlugins = pluginModule.plugins.map((plugin: any) => plugin.manifest);

    this.installPlugins = this.installPlugins.filter((plugin: any) => !!plugin.main);

    this.installPlugins.forEach((plugin: any) => {
      if (plugin.shortcut || this.preferences.shortcuts.keybinds[plugin.id]) {
        try {
          plugin.formatShortcut = this.preferences.shortcuts.keybinds[plugin.id] || formatShortcut(plugin.shortcut);
        } catch (e) {}
      }
    });
    // 初始化過濾後的插件清單
    this.filteredInstallPlugins = this.installPlugins || [];
    notify();
  },

  /** ipc 'init' 序列（preferences.js 802-841 逐字；updateKeybinds 由面板按 shortcutKeyword 自算）。 */
  async runInitSequence(params: any) {
    (window as any).Registration = params.Registration;

    if (params.panel) {
      this.sidebarPanels.forEach((panel: any) => {
        if (panel.name === params.panel) {
          this.currentPanel = panel;
        }
      });
    }

    this.keyword = params.keyword || '';
    if (this.keyword.length > 0) {
      this.onKeywordChange();
      setTimeout(() => {
        this.focusSearch();
      }, 100);
    }

    // 初始化
    this.initAutoLaunch();
    // 初始化偏好设定
    this.initPreference();

    // 等待插件初始化完成
    await this.initPlugins();

    // 初始化分組結果（updateKeybinds——React 面板按 shortcutKeyword 即时计算，无需迁移）
    // 確保視圖更新（$evalAsync 等价由 notify 承担）
    notify();

    const currentWindow = getCurrentWindow();
    currentWindow && currentWindow.show();

    setTimeout(() => {
      this.focusSearch();
    }, 200);
  },
};

// 初始化扁平键表（保持向後兼容的平面化結構用於搜索）
controllerScope.initKeybindsFlat();

// currentPanel 初始化（preferences.js 754-763：默认第一项 + localStorage 记忆）
controllerScope.currentPanel = controllerScope.sidebarPanels[0];
{
  const lastPanelName = localStorage['eagle.preference.lastPanel'];
  if (lastPanelName) {
    controllerScope.sidebarPanels.forEach((panel: any) => {
      if (panel.name === lastPanelName) {
        controllerScope.currentPanel = panel;
      }
    });
  }
}

// 测试契约（CDP Runtime.evaluate 直读）
(window as any).__eagleControllerScope = controllerScope;
(window as any).__eagleApplyController = applyController;
