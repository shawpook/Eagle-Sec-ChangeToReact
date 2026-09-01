/**
 * 采集窗控制器——collect.js（CollectController）无 Angular 移植。阶段9b-1。
 *
 * controllerScope 字段/方法与原 $scope 同名同形（collectItem/folders/foldersMap/recentFolders/
 * tags/tagsMap/isLoadingData/isReady/theme/platform/browserName/getTheme/getThemeName/changeStar/
 * removeTag/openTagSelect/focusFolderInput/initFolderSelect/save/close），数据面走页面保留的
 * window.eagle（js/lib/api/* 脚本，fetch 经 shims 重写 41595→测试后端）。
 *
 * 测试契约：window.__eagleCollectController = controllerScope；
 * shims collect 分支轮询 folders 就绪后调 initFolderSelect()（原 Angular 行为等价）。
 * 右键菜单/TagSelectPanel 为 native Menu / 9b-2 面板——openTagSelect 与 ContextMenu 相关路径
 * 9b-1 为守卫 no-op（PROGRESS 记录）。
 */

const req = (name: string): any => (window as any).require?.(name);
const remote = req('@electron/remote');

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

let notifying = false;
function notify(): void {
  if (notifying) return;
  notifying = true;
  try {
    version++;
    listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('[eagle-collect-controller] listener error', err);
      }
    });
  } finally {
    notifying = false;
  }
}

/** ng-click 的 $apply 等价：执行变更后统一 notify。 */
export function applyController(fn?: (s: any) => void): void {
  try {
    if (fn) fn(controllerScope);
  } catch (err) {
    console.error('[eagle-collect-controller]', err);
  }
  notify();
}

/** $evalAsync 等价（异步回调边界）。 */
export function notifyController(): void {
  notify();
}

/* ================= i18n（Angular i18nService 等价：locales/{locale}.json） ================= */

let i18nWords: Record<string, string> = {};

export const ct = (key: string): string => {
  return i18nWords[key] || key;
};

/* ================= 鼠标追踪（collect.js 5-20 逐字；面板定位依赖） ================= */

export const mouseState = { windowMouseX: 0, windowMouseY: 0 };
let isMouseMoving = false;
let mousemoveTimeout: any;

document.addEventListener(
  'mousemove',
  (e: any) => {
    mouseState.windowMouseX = e.pageX;
    mouseState.windowMouseY = e.pageY;
    if (isMouseMoving) return;
    isMouseMoving = true;
    clearTimeout(mousemoveTimeout);
    mousemoveTimeout = setTimeout(() => {
      isMouseMoving = false;
    }, 500);
  },
  false
);

/* ================= Ctrl/Cmd 剪贴板 execCommand（collect.js 22-49 逐字） ================= */

document.addEventListener(
  'keydown',
  function (e: any) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'a':
          document.execCommand('selectAll');
          break;
        case 'c':
          document.execCommand('copy');
          break;
        case 'x':
          document.execCommand('cut');
          break;
        case 'v':
          document.execCommand('paste');
          break;
        case 'z':
          if (e.shiftKey) {
            document.execCommand('redo');
          } else {
            document.execCommand('undo');
          }
          break;
        case 'y':
          document.execCommand('redo');
          break;
      }
    }
  },
  false
);

/* ================= controllerScope ================= */

const scope: any = {
  browserName: '',
  theme: 'dark',
  platform: '',
  isOpen: true,
  isReady: false,
  isLoadingData: true,
  collectItem: undefined,
  folders: [],
  foldersMap: {},
  recentFolders: [],
  tags: [],
  tagsMap: {},
  isCmdOrCtrlPress: false,
  isMultipleSelectMode: false,
  isMac: false,
};

scope.getThemeName = function (theme: any) {
  if (theme.name === 'Auto') {
    if (remote?.nativeTheme?.shouldUseDarkColors) {
      return 'DARK';
    } else {
      return 'LIGHT';
    }
  } else {
    return theme.name;
  }
};

scope.getTheme = () => {
  return scope.getThemeName((window as any).preferences.theme).toLowerCase();
};

scope.changeStar = (star: number) => {
  if (!star || star === scope.collectItem.star) {
    delete scope.collectItem.star;
    return;
  }
  scope.collectItem.star = star;
};

scope.removeTag = (tag: string) => {
  const index = scope.collectItem.tags.indexOf(tag);
  if (index === -1) return;
  scope.collectItem.tags.splice(index, 1);
};

// 9b-2：TagSelectPanel（collect 自有 1555 行分叉）尚未移植——守卫 no-op，点击不崩
scope.openTagSelect = () => {
  console.warn('[eagle-collect] TagSelectPanel pending in 9b-2');
};

scope.focusFolderInput = () => {
  setTimeout(() => {
    const input = document.querySelector('#folder-select-panel-search-input') as any;
    if (!input) return;
    input.focus();
  }, 100);
};

// FolderSelectPanel 宿主注册的打开回调（folderPanel.tsx 挂载时写入）
let openFolderPanel: ((params: any) => void) | null = null;
export function registerFolderPanelOpener(fn: (params: any) => void): void {
  openFolderPanel = fn;
}

scope.initFolderSelect = () => {
  const params = {
    recentFolderOrders: recentFolderOrders,
    folders: scope.folders,
    selectedIds: [],
    onOpenItem: async (selectedFolderItem: any) => {
      if (scope.isLoadingData) return;

      let collectItem = filterCollectItem(scope.collectItem);
      if (selectedFolderItem instanceof Array) {
        collectItem.folderIDs = selectedFolderItem;
        selectedFolderItem.forEach((folderId: string) => {
          const folder = scope.foldersMap[folderId];
          if (folder && folder.extendTags instanceof Array)
            collectItem.tags = [...new Set([...collectItem.tags, ...folder.extendTags])];
        });
      } else {
        if (selectedFolderItem.id) collectItem.folderIDs = [selectedFolderItem.id];
        if (selectedFolderItem.extendTags instanceof Array)
          collectItem.tags = [...new Set([...collectItem.tags, ...selectedFolderItem.extendTags])];
      }

      scope.save(collectItem);
    },
    onCreateItem: async (item: any) => {
      const folderName = item.name;
      const folder = await (window as any).eagle.folder.create(folderName);
      let collectItem = filterCollectItem(scope.collectItem);
      collectItem.folderIDs = [folder.id];
      scope.save(collectItem);
      notifyController();
    },
    onLibrarySwitching: () => {
      scope.isLoadingData = true;
    },
    onLibrarySwitched: () => {
      loadData();
    },
    onLibrarySwitchClosed: () => {
      scope.focusFolderInput();
    },
  };
  if (openFolderPanel) openFolderPanel(params);
};

scope.save = async (collectItem: any) => {
  const base64 = await (window as any).eagle.utils.urlToBase64(scope.collectItem.src, 1000);
  await (window as any).eagle.item.addFile({ src: base64, ...collectItem });
  (window as any).close();
};

scope.close = () => {
  (window as any).close();
};

function filterCollectItem(collectItem: any) {
  const allowedKeys = ['title', 'annotation', 'tags', 'folderIDs', 'star'];

  const collectItemCleaned = Object.keys(collectItem).reduce((result: any, key: string) => {
    if (allowedKeys.includes(key)) {
      result[key] = collectItem[key];
    }
    return result;
  }, {});

  return collectItemCleaned;
}
scope.filterCollectItem = filterCollectItem;

let recentFolderOrders: Record<string, number> = {};
let tagAll: any = null;

async function loadData() {
  scope.folders = [];
  scope.foldersMap = {};
  scope.recentFolders = [];
  scope.tags = [];
  scope.tagsMap = {};

  const eagle = (window as any).eagle;
  const [folders, recentFolders, tags] = await Promise.all([eagle.folder.all(), eagle.folder.recent(), eagle.tag.all()]);

  scope.folders = folders;
  scope.foldersMap = {};
  scope.recentFolders = recentFolders;
  scope.tags = tags?.tags || [];

  tagAll = tags || {};
  recentFolderOrders = {};
  scope.recentFolders.forEach((folder: any, index: number) => {
    recentFolderOrders[folder.id] = index;
  });

  scope.tagsMap = scope.tags.reduce((result: any, tag: any) => {
    result[tag.name] = tag;
    return result;
  }, {});

  eagle.utils.tree.walk(scope.folders, 'children', (folder: any, _parent: any) => {
    scope.foldersMap[folder.id] = folder;
  });

  scope.isLoadingData = false;

  scope.initFolderSelect();
  notifyController();
}

export function getTagAll(): any {
  return tagAll;
}

/** library-switcher 切换后的重载（原 initFolderSelect 参数 onLibrarySwitched: () => loadData()）。 */
export async function reloadData(): Promise<void> {
  await loadData();
}

/* ================= 初始化序列（collect.js 322-355 逐字） ================= */

(async () => {
  const eagle = (window as any).eagle;
  const preferences = (window as any).preferences;
  const ipcRenderer = req('electron')?.ipcRenderer;

  scope.browserName = eagle.env.browser.name;
  scope.theme = scope.getTheme();
  scope.platform = (window as any).process?.platform || 'win32';
  scope.isMac = typeof (eagle.env && eagle.env.os && eagle.env.os.isMac) === 'function' ? !!eagle.env.os.isMac() : !!(eagle.env && eagle.env.os && eagle.env.os.isMac);
  scope.isOpen = true;
  scope.collectItem = new (window as any).CollectItem();

  // 原版 i18nService.initLocale：locales/{locale}.json（页面相对路径）
  try {
    const locale = preferences.general.language || 'en';
    const response = await fetch(encodeURI(`locales/${locale}.json`));
    i18nWords = await response.json();
  } catch (err) {
    console.warn('[eagle-collect] locale load failed', err);
  }
  notifyController();

  await loadData();

  scope.isReady = true;
  remote?.getCurrentWindow?.()?.setOpacity?.(1);
  notifyController();

  if (ipcRenderer && ipcRenderer.invoke) {
    const item = await ipcRenderer.invoke('get-collect-window-data');
    scope.collectItem.src = req('url').pathToFileURL(item.path).href;
    scope.collectItem.url = item.url ?? '';
    scope.collectItem.title = item.name ?? '';
    scope.collectItem.type = item.type ?? 'image';
    scope.collectItem.tags = item.tags ?? [];
    scope.collectItem.folders = item.folders ?? [];
    notifyController();

    eagle.utils.getURLDimensions(scope.collectItem.src).then((dimensions: any) => {
      scope.collectItem.width = dimensions.width;
      scope.collectItem.height = dimensions.height;
      notifyController();
    });
  }
})();

/* ================= 测试契约 ================= */

export const controllerScope: any = scope;

(window as any).__eagleCollectController = scope;

void notifyController;
