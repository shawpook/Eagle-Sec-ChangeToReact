import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../global/eagleGlobals';
import { shortcuts } from '../../app/filters';
import { usePanelState } from '../../store/panelState';
import { getIpc } from '../detail/detailHooks';
import { openAppContextMenu } from './selectPanelEngine';
import { fuzzyMatchHtml } from './ContextMenu';
import { themePathOf } from './SelectPanels';
import { getBodyScope, getRootScope } from '../../core/appCore';
import { openPluginCenterChannel, openPluginCenterDetailChannel, openPluginCreatorChannel, openPluginPanelChannel } from '../../global/bus';
import { scopeEvalAsync } from '../../core/scopeRuntime';
import { widthOf, heightOf } from '../../utils/domQuery';
import { useMiscRawState } from '../../store/miscRawState';
import { useBodyState } from '../../store/bodyState';
import { useSelectionState } from '../../store/selectionState';

/**
 * 阶段7d-5a：pluginPanel + pluginCreator 接管（pluginCenter 见 7d-5b）。
 *
 * 规范来源：
 * - pluginPanel = bundle 61420-62040 附近（镜像 js/directives/plugin-panel.js + html）
 * - pluginCreator = bundle 62040-62140 附近（镜像 js/directives/plugin-creator.js + html）
 *
 * 通道零改动：OPEN_PLUGIN_PANEL / UPDATE_PLUGIN_PANEL / OPEN_PLUGIN_CREATOR /
 * OPEN_PLUGIN_CENTER / OPEN_PLUGIN_CENTER_DETAIL 广播；ipc 'show-item-in-folder' /
 * 'open.preferences'。
 * 依赖等价：pluginModule（body.pluginModule === window.pluginModule shim）、URL_MODULE
 * （global.js 顶层 const → 全局词法绑定，typeof 守卫）、preferences/shell/path/sanitize/
 * resourcesPath 等经 window/req 等价获取、filterPluginItem 的 pinyin 打分与 selectPanelEngine
 * 同款 loadPinyinModules 等价（new Set/Math.max）。
 * 原版怪癖保留：plugin-creator 模板 ng-keydown="onKeydown($event)" 但控制器未定义
 * onKeydown（Angular $exceptionHandler 记录，无其它效果）→ React 侧 no-op。
 */

const ngShow = (show: boolean) => (show ? undefined : ({ display: 'none' } as React.CSSProperties));
const iv = (v: any): any => (v === undefined || v === null ? '' : v);
const w = () => window as any;

/** filterPluginItem（镜像 260-308 逐字；_.uniq/_.max 等价化） */
const filterPluginItem = (items: any[], keyword: string) => {
  const { chineseConvert, pinyinlite, cartesianProduct } = loadPinyinModules();
  if (!keyword) return items;
  const keyword_cn = chineseConvert
    .tw2cn(keyword)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\ /g, '')
    .toLowerCase();

  const temp = items.map((item: any) => {
    const nameCN = chineseConvert
      .tw2cn(item.keyword)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (keyword.length >= 30 || item.keyword.length >= 30) {
      return {
        item: item,
        name: nameCN,
        search: [nameCN],
      };
    }
    return {
      item: item,
      name: nameCN,
      search: [
        nameCN,
        ...new Set(
          cartesianProduct(pinyinlite(nameCN, { keepUnrecognized: true }).filter((p: any) => p.length > 0)).map((i: any) => i.join(' '))
        ),
      ],
    };
  });

  const scores = temp.map((item: any) => {
    return {
      item: item,
      name: item.keyword,
      score: Math.max(...item.search.map((pinyin: any) => (pinyin as any).score(keyword_cn))),
    };
  });

  const result = scores
    .filter((i: any) => i.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .map(function (i: any) {
      return i.item.item;
    });

  // 依據 keyword 的 indexof 來排序, 如果=-1則不改變順序
  const keywordLower = keyword.toLowerCase();
  const sorted = result.sort((a: any, b: any) => {
    const indexA = a.name.toLowerCase().indexOf(keywordLower);
    const indexB = b.name.toLowerCase().indexOf(keywordLower);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return sorted;
};

// 与 selectPanelEngine 相同的 pinyin 模块加载等价
const loadPinyinModules = () => {
  try {
    const win = w();
    return {
      chineseConvert: win.chineseConvert,
      pinyinlite: win.__eaglePinyinlite || (win.__eaglePinyinlite = win.require((win.appRoot && win.appRoot.path || '.') + '/my_modules/pinyinlite')),
      cartesianProduct: win.__eagleCartesianProduct || (win.__eagleCartesianProduct = win.require((win.appRoot && win.appRoot.path || '.') + '/my_modules/cartesian-product')),
    };
  } catch (err) {
    return { chineseConvert: null, pinyinlite: null, cartesianProduct: null };
  }
};

/** Angular $exceptionHandler 等价（见 DuplicateFamily/7d-2 教训） */
const ngSafe = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    console.error(e);
  }
};

const getURLModule = () => {
  // global.js 顶层 const（全局词法绑定，跨脚本可见；window 上无 → 走 eval 兜底）
  try {
    const mod = (w().eval && w().eval('typeof URL_MODULE !== "undefined" ? URL_MODULE : undefined')) || undefined;
    if (mod) return mod;
  } catch (err) {}
  return w().URL_MODULE;
};

/* ================= pluginPanel（镜像逐字 + 模板） ================= */

export function PluginPanel() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const rootRef = useRef<any>({});
  const panelRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-plugin-panel-host'));
  }, []);

  // link 初始化（镜像 9-17）
  if (rootRef.current.initialized === undefined) {
    rootRef.current.initialized = true;
    rootRef.current.resultList = [];
    rootRef.current.lastOpenedPlugins = [];
    rootRef.current.searchKeyword = '';
    rootRef.current.currentIndex = -1;
    rootRef.current.typeFilter = localStorage['eagle.pluginPanel.type'] ? localStorage['eagle.pluginPanel.type'] : 'window';
  }

  // moveToCursorPosition（镜像 24-57 逐字）
  const moveToCursorPosition = ($elem: HTMLElement) => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const containerWidth = widthOf($elem);
    const containerHeight = heightOf($elem);
    let x = w().windowMouseX + 10;
    let y = w().windowMouseY - 10;
    let maxHeight = windowHeight; // 初始化最大高度為視窗高度

    if (w().windowMouseX + containerWidth > windowWidth) {
      x = w().windowMouseX - containerWidth - 20;
      x = x < 20 ? 20 : x;
    }

    if (w().windowMouseY + containerHeight > windowHeight - 20) {
      y = windowHeight - containerHeight - 20;
      y = y < 20 ? 20 : y;
    } else if (w().windowMouseY - 56 < 0) {
      y = 36;
    }

    maxHeight = windowHeight - y - 160;

    $elem.style.left = `${x}px`;
    $elem.style.top = `${y}px`;

    // find .plugin-container and set max-height
    const container = $elem.querySelector('.plugin-container') as HTMLElement | null;
    if (container) container.style.maxHeight = `${maxHeight - 40}px`; // 設定最大高度
  };

  const calculateList = () => {
    const pluginModule = useMiscRawState.getState().pluginModule;
    const searchKeyword = rootRef.current.searchKeyword;
    const typeFilter = rootRef.current.typeFilter;

    let listItems: any[] = [];

    (pluginModule?.plugins || []).forEach((plugin: any) => {
      try {
        const manifest = plugin.manifest;
        listItems.push({
          id: `plugin-${plugin.manifest.id}`,
          type: 'plugin',
          icon: `${getURLModule().pathToFileURL(`${plugin.path}/${manifest.logo}`).href}?t=${Date.now()}`,
          name: manifest.name,
          dir: manifest?.main?.shortcut || '',
          path: plugin.path,
          executable: !!manifest.main,
          isPreviewPlugin: !!manifest.preview,
          isLocal: plugin.types.includes('development'),
          isDisabled: pluginModule.isPluginDisabled(plugin.manifest.id),
          keyword: `${manifest.name} ${manifest.keywords.join(' ')}`,
          types: plugin.types,
          plugin: plugin,
        });
      } catch (err) {
        console.error(err);
      }
    });

    const windowPlugins = listItems.filter((item: any) => {
      return item.types.includes('window');
    });
    rootRef.current.windowPlugins = windowPlugins;

    // sort by plugin.name
    listItems = listItems.sort((a: any, b: any) => {
      return a.name.localeCompare(b.name);
    });

    // 根據類型篩選
    listItems = listItems.filter((item: any) => {
      return item?.types?.includes(typeFilter);
    });

    if (searchKeyword !== '') {
      rootRef.current.resultList = filterPluginItem(listItems, searchKeyword).filter((item: any) => !item.isDisabled);

      if (rootRef.current.resultList.length > 0) {
        rootRef.current.currentIndex = 0;
      }
    } else {
      // 分離啟用/停用插件（僅非搜尋模式）
      const enabledItems: any[] = [];
      const disabledItems: any[] = [];
      for (const item of listItems) {
        (item.isDisabled ? disabledItems : enabledItems).push(item);
      }

      if (disabledItems.length > 0) {
        const disabledHeader = enabledItems.length > 0 ? [{ id: 'disabled-separator', type: 'separator' }] : [];
        listItems = [...enabledItems, ...disabledHeader, ...disabledItems];
      } else {
        listItems = enabledItems;
      }
      // 顯示最近執行插件
      if (windowPlugins.length > 1 && typeFilter === 'window') {
        rootRef.current.lastOpenedPlugins = rootRef.current.lastOpenedPlugins.filter((plugin: any) => {
          return pluginModule.installedPluginMaps[plugin.manifest.id] && !pluginModule.isPluginDisabled(plugin?.manifest?.id);
        });
        let lastOpenedItems = rootRef.current.lastOpenedPlugins.map((plugin: any) => {
          return {
            id: `last-opened-${plugin.manifest.id}`,
            type: 'plugin',
            icon: `${getURLModule().pathToFileURL(`${plugin.path}/${plugin.manifest.logo}`).href}?t=${Date.now()}`,
            name: plugin.manifest.name,
            dir: plugin.manifest?.main?.shortcut || '',
            path: plugin.path,
            executable: !!plugin.manifest.main,
            isPreviewPlugin: !!plugin.manifest.preview,
            isLocal: plugin.types.includes('development'),
            keyword: `${plugin.manifest.name} ${plugin.manifest.keywords.join(' ')}`,
            types: plugin.types,
            plugin: plugin,
          };
        });

        if (lastOpenedItems.length > 3) lastOpenedItems.length = 3;

        listItems = listItems.filter((item: any) => {
          return !lastOpenedItems.find((lastOpenedItem: any) => {
            return lastOpenedItem?.plugin?.manifest?.id === item?.plugin?.manifest?.id;
          });
        });

        listItems = [{ id: 'label', type: 'label', name: t('modal.pluginPanel.label.recent') }, ...lastOpenedItems, { id: 'separator', type: 'separator' }, ...listItems];
        rootRef.current.currentIndex = 1;
      }

      rootRef.current.resultList = (listItems as any).unique();
    }
    rootRef.current.listItems = listItems;
    bumpAll();
  };
  const calculateListRef = useRef(calculateList);
  calculateListRef.current = calculateList;

  const focusInput = () => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 24);
  };
  const focusInputRef = useRef(focusInput);
  focusInputRef.current = focusInput;

  const close = () => {
    scrollToTop();
    panelRef.current?.classList.remove('open');
    searchInputRef.current?.blur();
    scrollToTop();
    bumpAll();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  const scrollToTop = () => {
    const container = panelRef.current?.querySelector('.plugin-container') as HTMLElement | null;
    if (container) container.scrollTop = 0;
  };

  const hoverItem = (index: any) => {
    rootRef.current.currentIndex = index;
    bumpAll();
  };

  const selectType = (type: any) => {
    rootRef.current.currentIndex = -1;
    rootRef.current.typeFilter = type;
    localStorage['eagle.pluginPanel.type'] = type;
    calculateListRef.current();
  };

  const installPlugin = () => {
    const typeFilter = rootRef.current.typeFilter;
    if (typeFilter === 'window') {
      openPluginCenter();
    } else if (typeFilter === 'format') {
      openPluginCenter('format');
    } else if (typeFilter === 'inspector') {
      openPluginCenter('inspector');
    }
  };

  const openDevelopmentDocs = () => {
    const preferences = w().preferences;
    const shell = w().require('electron').shell;
    if (preferences.general.language === 'zh_CN') {
      shell.openExternal('https://developer.eagle.cool/plugin-api/v/zh-cn');
    } else {
      shell.openExternal('https://developer.eagle.cool/plugin-api');
    }
  };

  const onItemClick = (item: any) => {
    ngSafe(() => {
      if (item.isDisabled) return;
      const pluginModule = useMiscRawState.getState().pluginModule;
      const plugin = item?.plugin;
      if (!item.executable) {
                const file = useSelectionState.getState().selected[0];
        const ext = file?.ext;
        // 原版逐字：Object.keys(preview)（preview 可能 undefined → 抛）+ preview[keys]
        //（数组键恒 undefined → 提前 return），异常经 $exceptionHandler
        const keys = Object.keys(plugin?.manifest?.preview as any);
        const previewAny: any = plugin?.manifest?.preview;
        if (!previewAny?.[(keys as any)]?.viewer) return;
        for (const key of keys) {
          if (key.includes(ext)) {
            pluginModule.openPreview(plugin, file);
            closeRef.current();
            return;
          }
        }
      } else {
        pluginModule.open(plugin);
        closeRef.current();
      }
    });
  };

  const removePlugin = (item: any) => {
        const pluginModule = useMiscRawState.getState().pluginModule;
    const desc = t('dialog.removePlugin.desc', [{ property: 'name', value: item.name }]);
    const themePath = themePathOf(useBodyState.getState().theme);

    w().swal({
      html: `
                        <div class="alert">
                            <div class="alert-icon" style="background-image: url('${item.icon}')">
                                <img class="status" style="width: 20px; height: 20px;" src="assets/images/${themePath}/icons/ic-plugin-install-modal-uninstall.svg">
                            </div>
                            <h4 class="alert-title">${t('dialog.removePlugin.title')}</h4>
                            <p class="alert-desc">${desc}</p>
                        </div>
                    `,
      showCloseButton: false,
      showConfirmButton: true,
      showCancelButton: true,
      allowOutsideClick: false,
      focusConfirm: false,
      focusCancel: false,
      padding: 24,
      width: 400,
      customClass: 'alert-box large',
      cancelButtonColor: '#777777',
      confirmButtonText: `${t('dialog.removePlugin.remove')}`,
      cancelButtonText: t('general.cancel'),
    }).then(async () => {
      if (item.isLocal) {
        pluginModule.localPlugin.uninstall(item.plugin);
      } else {
        pluginModule.remotePlugin.uninstall(item.plugin);
      }
      calculateListRef.current();
    });
  };

  const pinPlugin = (event: any, item: any) => {
    event.stopPropagation();
    useMiscRawState.getState().pluginModule.pinPlugin(item.plugin);
  };

  const unpinPlugin = (event: any, item: any) => {
    event.stopPropagation();
    useMiscRawState.getState().pluginModule.unpinPlugin(item.plugin);
  };

  const openSubmenu = (event: any, item: any) => {
    event.stopPropagation();
    const pluginModule = useMiscRawState.getState().pluginModule;
    const newPlugin = pluginModule.needUpdatePluginMaps[item.plugin.manifest.id];
    const ipcRenderer = getIpc();

    openAppContextMenu({
      items: [
        {
          label: `${item.plugin.manifest.name} (${item.plugin.manifest.version})`,
          disabled: true,
        },
        {
          visible: !item.isDisabled,
          role: 'separator',
        },
        // 本地插件
        {
          visible: !!item.isLocal && !item.isDisabled,
          label: t('modal.pluginPanel.contextMenu.reload'),
          click: () => {
            pluginModule.reloadPlugin(item.plugin.path);
          },
        },
        {
          visible: !!item.isLocal && !item.isDisabled,
          label: t('modal.pluginPanel.contextMenu.openInExplorer'),
          click: () => {
            ipcRenderer.send('show-item-in-folder', item.plugin.path);
          },
        },
        {
          visible: !!item.isLocal && !item.isDisabled,
          role: 'separator',
        },
        {
          visible: !!item.isLocal && !item.isDisabled,
          label: t('modal.pluginPanel.contextMenu.packPlugin'),
          click: async () => {
            try {
              const path = w().require('path');
              const remote = w().require('@electron/remote');
              const currentWindow = remote.getCurrentWindow();
              const dialog = remote.dialog;
              const defaultPath = path.join('*/', item.plugin.manifest.name + '.eagleplugin');
              const result = await dialog.showSaveDialog(currentWindow, {
                defaultPath: defaultPath,
                filters: [{ name: 'Eagle Plugin', extensions: ['eagleplugin'] }],
              });
              const outputPath = result?.filePath;
              if (!outputPath || result?.canceled) return;
              await pluginModule.packPlugin(item.plugin.path, outputPath);
              ipcRenderer.send('show-item-in-folder', outputPath);
            } catch (err: any) {
              alert(err.stack || err);
              w().electronLog.error(`[app] Pack Plugin fail.`);
              w().electronLog.error(err.stack || err);
            }
          },
        },
        {
          visible: !!item.isLocal && !item.isDisabled,
          label: t('modal.pluginPanel.contextMenu.publish'),
          click: () => {
            const preferences = w().preferences;
            const shell = w().require('electron').shell;
            const lng2locale: any = {
              zh_CN: 'cn',
              zh_TW: 'tw',
              ja_JP: 'jp',
            };
            const baseUrl = `https://community-${lng2locale[preferences.general.language] || 'en'}.eagle.cool`;
            shell.openExternal(baseUrl);
          },
        },
        // 安裝版本插件
        {
          visible: !item.isLocal && !!newPlugin && !item.isDisabled,
          label: `${t('modal.pluginPanel.contextMenu.install')} (${newPlugin?.lasteVersion?.version})`,
          click: () => {
            openPluginCenter('update');
            scopeEvalAsync();
          },
        },
        {
          visible: !item.isLocal && !!newPlugin && !item.isDisabled,
          role: 'separator',
        },
        {
          visible: !item.isLocal && !item.isDisabled,
          label: t('modal.pluginPanel.contextMenu.viewInPluginCenter'),
          click: () => {
            closeRef.current();
            openPluginCenterDetailChannel.emit(item.plugin.manifest.id);
            scopeEvalAsync();
          },
        },
        {
          visible: !item.isLocal && !item.isPreviewPlugin && !item.isDisabled,
          label: t('modal.pluginPanel.contextMenu.shortcuts'),
          click: () => {
            ipcRenderer.send('open.preferences', {
              panel: 'shortcuts',
              keyword: 'plugin',
            });
          },
        },
        // 啟用/停用（所有插件共用）
        { role: 'separator' },
        {
          label: item.isDisabled ? t('modal.pluginPanel.contextMenu.enablePlugin') : t('modal.pluginPanel.contextMenu.disablePlugin'),
          click: () => {
            if (item.isDisabled) {
              pluginModule.enablePlugin(item.plugin);
            } else {
              pluginModule.disablePlugin(item.plugin);
            }
            calculateListRef.current();
            bumpAll();
          },
        },
        {
          visible: !item.isLocal,
          role: 'separator',
        },
        {
          visible: !item.isLocal,
          label: t('modal.pluginPanel.contextMenu.uninstall'),
          click: () => {
            removePlugin(item);
          },
        },
        {
          visible: !!item.isLocal,
          role: 'separator',
        },
        {
          visible: !!item.isLocal,
          label: t('modal.pluginPanel.contextMenu.uninstall'),
          click: () => {
            removePlugin(item);
          },
        },
      ],
    });
  };

  const openDevMenu = (event: any) => {
    event.stopPropagation();

    openAppContextMenu({
      items: [
        {
          label: t('modal.pluginPanel.contextMenu.createPlugin'),
          icon: 'ic-folder-new-folder.svg',
          click: () => {
            openPluginCreatorChannel.emit();
            scopeEvalAsync();
          },
        },
        {
          label: t('modal.pluginPanel.contextMenu.importPlugin'),
          icon: 'ic-import-local.svg',
          click: async () => {
            const remote = w().require('@electron/remote');
            const dialog = remote.dialog;
            const currentWindow = remote.getCurrentWindow();
            const pluginModule = useMiscRawState.getState().pluginModule;
            const result = await dialog.showOpenDialog(currentWindow, {
              properties: ['openDirectory'],
            });
            if (result?.filePaths) {
              console.log(`Load local project: ${result?.filePaths[0]}`);
              pluginModule.localPlugin.load(result?.filePaths[0]).then(() => {
                selectType('development');
              });
            }
          },
        },
        {
          role: 'separator',
        },
        {
          label: t('modal.pluginPanel.contextMenu.docs'),
          icon: 'ic-developer.svg',
          click: () => {
            openDevelopmentDocs();
          },
        },
      ],
    });
  };

  const openPluginCenter = (categoryId?: any) => {
    openPluginCenterChannel.emit(categoryId);
  };

  // selectCurrent/selectPrev/selectNext（镜像 310-342 逐字）
  const selectCurrent = () => {
    if (rootRef.current.resultList[rootRef.current.currentIndex]) {
      onItemClick(rootRef.current.resultList[rootRef.current.currentIndex]);
      bumpAll();
    }
  };

  const selectPrev = () => {
    let idx = rootRef.current.currentIndex - 1;
    while (idx >= 0) {
      const item = rootRef.current.resultList[idx];
      if (item?.type === 'plugin' && !item?.isDisabled) break;
      idx--;
    }
    if (idx >= 0) {
      rootRef.current.currentIndex = idx;
      bumpAll();
    }
  };

  const selectNext = () => {
    let idx = rootRef.current.currentIndex + 1;
    const len = rootRef.current.resultList.length;
    while (idx < len) {
      const item = rootRef.current.resultList[idx];
      if (item?.type === 'plugin' && !item?.isDisabled) break;
      idx++;
    }
    if (idx < len) {
      rootRef.current.currentIndex = idx;
      bumpAll();
    }
  };

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;

    // b1-9ba：UPDATE_PLUGIN_PANEL 頻道全樹無發送者（原發送面在 bundle，摘除後死亡）
    // ——死監聽移除。

    // $on("OPEN_PLUGIN_PANEL")（镜像 59-80 逐字）
    const offOpen = openPluginPanelChannel.on((params: any) => {
      void params;
      const pluginModule = useMiscRawState.getState().pluginModule;
      rootRef.current.currentIndex = -1;
      rootRef.current.searchKeyword = '';
      const searchEl = searchInputRef.current;
      if (searchEl) searchEl.value = '';
      rootRef.current.lastOpenedPlugins = pluginModule
        .getLastOpenedPlugins()
        .map((pluginId: any) => {
          return pluginModule.installedPluginMaps[pluginId];
        })
        .filter((plugin: any) => {
          return plugin && !plugin.manifest?.main?.serviceMode && !pluginModule.isPluginDisabled(plugin?.manifest?.id);
        });

      rootRef.current.lastOpenedPlugins.length = 3;

      calculateListRef.current();

      setTimeout(function () {
        if (panelRef.current) moveToCursorPosition(panelRef.current);
        panelRef.current?.classList.add('open');
        setTimeout(function () {
          focusInputRef.current();
        }, 50);
      }, 30);
      bumpAll();
    });

    // $searchInput.on("keyup")（镜像 584-616 逐字；jqLite/jQuery 元素级监听）
    const onKeyup = (event: any) => {
      const keyCode = event.keyCode;
      switch (keyCode) {
        case 13:
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            event.stopPropagation();
            closeRef.current();
          } else {
            selectCurrent();
          }
          break;
        case 27:
          event.stopPropagation();
          closeRef.current();
          break;
        // up
        case 38:
          event.preventDefault();
          selectPrev();
          break;
        // down
        case 40:
          event.preventDefault();
          selectNext();
          break;
        case 9:
          event.preventDefault();
          event.stopPropagation();
          break;
      }
    };
    const input = searchInputRef.current;
    if (input) {
      input.addEventListener('keyup', onKeyup);
    }

    // 闭环测试契约
    (window as any).__eaglePluginPanel = {
      get isOpen() {
        return !!panelRef.current && panelRef.current.classList.contains('open');
      },
      get resultList() {
        return rootRef.current.resultList;
      },
      get listItems() {
        return rootRef.current.listItems;
      },
      get currentIndex() {
        return rootRef.current.currentIndex;
      },
      get typeFilter() {
        return rootRef.current.typeFilter;
      },
    };

    return () => {
      offOpen();
      if (input) input.removeEventListener('keyup', onKeyup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const searchKeyword = rootRef.current.searchKeyword;
  const resultList: any[] = rootRef.current.resultList || [];
  const listItems: any[] = rootRef.current.listItems || [];
  const currentIndex = rootRef.current.currentIndex;
  const typeFilter = rootRef.current.typeFilter;
  const pluginModule = useMiscRawState.getState().pluginModule || {};

  const renderPluginItem = (item: any, index: number, searchMode: boolean) => (
    <div
      key={item.id || index}
      className={`check-item${currentIndex === index ? ' active' : ''}${!item.executable ? ' disabled' : ''}${item.isDisabled ? ' plugin-disabled' : ''}`}
      onMouseEnter={() => hoverItem(index)}
      onContextMenu={(e) => {
        e.preventDefault();
        openSubmenu(e, item);
      }}
      onClick={(e) => {
        onItemClick(item);
        focusInputRef.current();
      }}
    >
      <div className="icon-wrap">
        <div className="icon" style={{ backgroundImage: `url("${item.icon}")` }} />
        {!!item.isLocal && (
          <img
            className="local-badge"
            style={ngShow(!!item.isLocal)}
            tippy=""
            tippy-content={item.plugin.path}
            tippy-placement="top"
            src={`assets/images/${themePathOf(theme)}/icons/ic-plugin-local.svg`}
          />
        )}
      </div>
      <div className="info">
        <div className="plugin-name">
          {searchMode ? (
            <span dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(item.name, searchKeyword || '') }} />
          ) : (
            item.name
          )}
          <span style={ngShow(!!pluginModule.pluginShortcuts?.[item.plugin.manifest.id])} className="shortcut">
            {shortcuts(pluginModule.pluginShortcuts?.[item.plugin.manifest.id])}
          </span>
        </div>
      </div>
      <div className="more">
        {!searchMode && !item.isPreviewPlugin && (
          <>
            <div
              className="ic-btn"
              style={ngShow(!!(pluginModule.pinnedPluginMaps?.[item.plugin.manifest.id] && !item.isDisabled))}
              onClick={(e) => unpinPlugin(e, item)}
            >
              <img src={`assets/images/${themePathOf(theme)}/icons/context-menu/ic-filter-pinned.svg`} />
            </div>
            <div
              className="ic-btn"
              style={ngShow(!!(!pluginModule.pinnedPluginMaps?.[item.plugin.manifest.id] && !item.isDisabled))}
              onClick={(e) => pinPlugin(e, item)}
            >
              <img src={`assets/images/${themePathOf(theme)}/icons/context-menu/ic-filter-pin.svg`} />
            </div>
          </>
        )}
        <div className="ic-btn" onClick={(e) => openSubmenu(e, item)}>
          <img src={`assets/images/${themePathOf(theme)}/icons/ic-more.svg`} />
          <div className="badge-count" style={ngShow(!pluginModule.needUpdatePluginMaps?.[item.plugin.manifest.id])} />
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div id="plugin-panel" className="plugin-panel" ref={panelRef as any} onClick={() => focusInputRef.current()}>
        <div className="plugin-panel-header">
          <input
            id="plugin-panel-search"
            maxLength={1024}
            type="search"
            className="search shortcut-input"
            placeholder={t('modal.pluginPanel.searchPlaceholder')}
            ref={searchInputRef}
            onChange={(e: any) => {
              // ng-model debounce 50 / blur 0（非受控：视图即时、模型去抖）
              clearTimeout(rootRef.current.searchDebounce);
              rootRef.current.searchDebounce = setTimeout(() => {
                rootRef.current.searchKeyword = e.target.value;
                calculateListRef.current();
                scrollToTop();
              }, 50);
            }}
          />
          <div className="close" onClick={() => closeRef.current()} />
        </div>

        <div className="tabs">
          {['window', 'format', 'inspector', 'service', 'development'].map((typeKey) => (
            <div key={typeKey} className={`tab${typeFilter === typeKey ? ' active' : ''}`} onClick={() => selectType(typeKey)}>
              {t(`modal.pluginPanel.tabs.${typeKey}`)}
            </div>
          ))}
        </div>

        {/* 尚未安装任何插件 */}
        <div className="plugin-container empty" style={ngShow(!searchKeyword && listItems.length == 0)}>
          <div className="empty" style={ngShow(typeFilter !== 'development' && typeFilter !== 'service')}>
            <div className="icon">
              <img style={{ width: '256px' }} src={`assets/images/${themePathOf(theme)}/illustrations/plugin-empty.png`} />
            </div>
            <div className="title">{t('modal.pluginPanel.empty.title')}</div>
            <p>{t('modal.pluginPanel.empty.desc')}</p>
            <div className="button button-xs button-grey" onClick={() => installPlugin()}>
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-plugin-install.svg`} />
              {t('dialog.installPlugin.title')}
            </div>
          </div>
          <div className="empty" style={ngShow(typeFilter === 'development')}>
            <div className="icon">
              <img style={{ width: '256px' }} src={`assets/images/${themePathOf(theme)}/illustrations/plugin-empty.png`} />
            </div>
            <div className="title">{t('modal.pluginPanel.empty.dev.title')}</div>
            <p>{t('modal.pluginPanel.empty.dev.desc')}</p>
            <div className="button button-xs button-grey" onClick={() => openDevelopmentDocs()}>
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-plugin-developer.svg`} />
              {t('modal.pluginPanel.contextMenu.docs')}
            </div>
          </div>
          <div className="empty" style={ngShow(typeFilter === 'service')}>
            <div className="icon">
              <img style={{ width: '256px' }} src={`assets/images/${themePathOf(theme)}/illustrations/plugin-empty.png`} />
            </div>
            <div className="title">{t('modal.pluginPanel.empty.service.title')}</div>
            <p>{t('modal.pluginPanel.empty.service.desc')}</p>
            <div className="button button-xs button-grey" onClick={() => openDevelopmentDocs()}>
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-plugin-developer.svg`} />
              {t('modal.pluginPanel.contextMenu.docs')}
            </div>
          </div>
        </div>

        {/* 搜索空状态 */}
        <div className="plugin-container empty" style={ngShow(!searchKeyword || resultList.length != 0)}>
          <div className="empty">
            <div className="icon">
              <img style={{ width: '90px' }} src={`assets/images/${themePathOf(theme)}/illustrations/plugin-search-empty.png`} />
            </div>
            <div className="title">{t('modal.pluginPanel.searchEmpty.title')}</div>
            <p>{t('modal.pluginPanel.searchEmpty.desc')}</p>
          </div>
        </div>

        {/* 一般模式 */}
        <div className="plugin-container" style={ngShow(!searchKeyword && listItems.length > 0)} onMouseUp={() => focusInputRef.current()}>
          {listItems.map((item: any, index: number) => {
            if (item.type === 'separator') {
              return (
                <div key={item.id || index}>
                  <div className="separator" />
                </div>
              );
            }
            if (item.type === 'label') {
              return (
                <div key={item.id || index}>
                  <div className="label">{item.name}</div>
                </div>
              );
            }
            return renderPluginItem(item, index, false);
          })}
        </div>

        {/* 搜尋模式 */}
        <div className="plugin-container" style={ngShow(!searchKeyword || resultList.length <= 0)} onMouseUp={() => focusInputRef.current()}>
          {resultList.map((item: any, index: number) => renderPluginItem(item, index, true))}
        </div>
        <div className="fucntion-list">
          <div className="function-item">
            <div className="icon">
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-plugin-install.svg`} />
            </div>
            <div className="name" onClick={(e) => openPluginCenter(e)}>
              {t('modal.pluginPanel.function.install')}
            </div>
          </div>
          <div className="function-item">
            <div className="icon">
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-plugin-developer.svg`} />
            </div>
            <div className="name" onClick={(e) => openDevMenu(e)}>
              {t('modal.pluginPanel.function.developer')}
            </div>
          </div>
        </div>
      </div>
      <div className="plugin-panel-overlay" onClick={() => closeRef.current()} />
    </>,
    host
  );
}

/* ================= pluginCreator（镜像逐字 + 模板） ================= */

export function PluginCreator() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('window');
  const [pluginName, setPluginName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-plugin-creator-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;

    // $on("OPEN_PLUGIN_CREATOR")（镜像 16-18）
    const off = openPluginCreatorChannel.on((params: any) => {
      void params;
      setIsOpen(true);
    });

    // auto-focus 指令等价（OPEN_PLUGIN_CREATOR → $timeout(100) → click + focus + select）
    const offAutoFocus = openPluginCreatorChannel.on(() => {
      setTimeout(() => {
        const el = nameInputRef.current;
        if (el) {
          try {
            el.click();
          } catch (err) {}
          el.focus();
          el.select();
        }
      }, 100);
    });

    return () => {
      off();
      offAutoFocus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const close = () => {
    setIsOpen(false);
  };

  // create()（镜像 24-99 逐字）
  const create = () => {
    if (pluginName === '') return;

    const remote = w().require('@electron/remote');
    const dialog = remote.dialog;
    const currentWindow = remote.getCurrentWindow();
    const path = w().require('path');
    const fs = w().require('fs');
    const fse = w().require('fs-extra');
    const crypto = w().crypto || w().require('crypto');
    const pluginModule = useMiscRawState.getState().pluginModule;

    dialog
      .showOpenDialog(currentWindow, {
        filters: [],
        properties: ['openDirectory', 'createDirectory'],
        multiSelections: false,
      })
      .then((result: any) => {
        try {
          if (result.canceled) return;
          const filePaths = result.filePaths;
          const savedPath = path.normalize(`${filePaths[0]}/${w().sanitize(pluginName).trim()}`);
          const templateRootPath = path.normalize(`${w().resourcesPath}/plugin_templates`);
          const templatePath = path.normalize(`${templateRootPath}/${type}`);
          if (w().electronLog) w().electronLog.info(`[app] Create Plugin to ${savedPath}, name: ${pluginName}, type: ${type}.`);
          if (fs.existsSync(savedPath)) {
            w().swal({
              html: `
									<div class="alert">
										<div class="alert-icon warning"></div>
										<h4 class="alert-title">${t('modal.createPlugin.dialog.exists.title')}</h4>
										<p class="alert-desc">${t('modal.createPlugin.dialog.exists.desc')}</p>
									</div>
								`,
              showCloseButton: false,
              showConfirmButton: true,
              showCancelButton: false,
              allowOutsideClick: false,
              focusConfirm: false,
              focusCancel: false,
              padding: 24,
              width: 400,
              customClass: 'alert-box',
              cancelButtonColor: '#777777',
              confirmButtonText: t('general.ok'),
            }).then(function () {});
            return;
          }
          if (fs.existsSync(templatePath)) {
            fse.copySync(templatePath, savedPath);
            if (fs.existsSync(savedPath)) {
              const manifestPath = path.normalize(`${savedPath}/manifest.json`);
              const json = fs.readFileSync(manifestPath, 'utf8');
              const manifest = JSON.parse(json);
              manifest.id = crypto.randomUUID();
              manifest.name = pluginName;
              fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4), 'utf8');
              const themePath = themePathOf(useBodyState.getState().theme);
              w().swal({
                html: `
										<div class="alert">
											<div class="alert-icon" style="background-image: url('assets/images/base/icons/ic-plugin-modal-created.png')">
												<img class="status" style="width: 20px; height: 20px;" src="assets/images/${themePath}/icons/ic-plugin-install-modal-created.svg">
											</div>
											<h4 class="alert-title">${t('dialog.pluginCreated.title')}</h4>
											<p class="alert-desc">${t('dialog.pluginCreated.desc')}</p>
										</div>
									`,
                showCloseButton: false,
                showConfirmButton: true,
                showCancelButton: true,
                allowOutsideClick: false,
                focusConfirm: false,
                focusCancel: false,
                padding: 24,
                width: 400,
                customClass: 'alert-box large',
                cancelButtonColor: '#777777',
                confirmButtonText: t('dialog.pluginCreated.btn'),
                cancelButtonText: t('general.close'),
              }).then(function () {
                getIpc().send('show-item-in-folder', savedPath);
              });
              pluginModule.localPlugin.load(savedPath);
              setIsOpen(false);
              setPluginName('');
              if (w().electronLog) w().electronLog.info(`[app] New Plugin created.`);
              return;
            }
          }
        } catch (err: any) {
          alert(err);
          w().electronLog.error(`[app] Create Plugin fail.`);
          w().electronLog.error(err.stack || err);
        }
      });
  };

  if (!host) return null;

  return createPortal(
    <>
      <div className={`modal plugin-creator${isOpen ? ' open' : ''}`}>
        <div className="modal-header">
          <div className="name">{t('modal.createPlugin.title')}</div>
          <div className="close" onClick={() => close()} />
        </div>
        <div className="section">
          <input
            type="text"
            maxLength={128}
            selectall=""
            placeholder={t('modal.createPlugin.name')}
            tabIndex={-1}
            value={pluginName}
            ref={nameInputRef}
            onChange={(e: any) => setPluginName(e.target.value)}
            onKeyDown={() => {
              // 原版怪癖：模板 ng-keydown="onKeydown($event)" 但控制器未定义 onKeydown
              // （Angular $exceptionHandler 记录，无其它效果）→ no-op
            }}
            auto-focus="OPEN_PLUGIN_CREATOR"
          />
          <div className="plugin-types">
            {[
              { key: 'window', illustration: 'plugin-type-window.png', title: 'modal.createPlugin.type.window.title', desc: 'modal.createPlugin.type.window.desc' },
              { key: 'service', illustration: 'plugin-type-service.png', title: 'modal.createPlugin.type.service.title', desc: 'modal.createPlugin.type.service.desc' },
              { key: 'preview', illustration: 'plugin-type-preview.png', title: 'modal.createPlugin.type.format.title', desc: 'modal.createPlugin.type.format.desc' },
              { key: 'inspector', illustration: 'plugin-type-inspector.png', title: 'modal.createPlugin.type.inspector.title', desc: 'modal.createPlugin.type.inspector.desc' },
            ].map((item) => (
              <div key={item.key} className={`plugin-type${type === item.key ? ' checked' : ''}`} onClick={() => setType(item.key)}>
                <div className="icon-check" />
                <div className="illustration">
                  <img src={`assets/images/${themePathOf(theme)}/illustrations/${item.illustration}`} />
                </div>
                <div className="plugin-intro">
                  <h4>{t(item.title)}</h4>
                  <p>{t(item.desc)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="textAlign-right">
            <div className={`button button-xs button-primary${pluginName.length === 0 ? ' button-disabled' : ''}`} onClick={() => create()}>
              {t('modal.createPlugin.create')}
            </div>
            <div className="button button-xs button-grey" onClick={() => close()}>
              {t('general.cancel')}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-overlay" />
    </>,
    host
  );
}