import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../global/eagleGlobals';
import { numberAbbreviate } from '../../app/filters';
import { getIpc } from '../detail/detailHooks';
import { delegateTarget } from '../../utils/domQuery';
import { openAppContextMenu } from './selectPanelEngine';
import { themePathOf } from './SelectPanels';

import { openPluginCenterChannel, openPluginCenterDetailChannel, refreshPluginCenterChannel } from '../../global/bus';
import { useMiscRawState } from '../../store/miscRawState';
import { useBodyState } from '../../store/bodyState';

/**
 * 阶段7d-5b：pluginCenter 接管（bundle 62140-62723 附近；镜像 js/directives/plugin-center.js
 * 581 行 + plugin-center.html 221 行 + PluginCenterFactory）。
 *
 * 通道零改动：OPEN_PLUGIN_CENTER / OPEN_PLUGIN_CENTER_DETAIL / REFRESH_PLUGIN_CENTER 广播、
 * ipc 'install-plugin' / 'open-plugin-center-and-search'；auto-focus OPEN_PLUGIN_CENTER 等价。
 * 依赖等价：getBestURL/package.json（require shim：mock 返回 '' → 回退真实 URL，远程 fetch
 * 失败 → electronLog.error + 空数据，与原版一致）；compare-versions（require shim stub）；
 * fileSize（global.js 顶层函数 → window）；.unique() 原型扩展直接可用。
 * Angular number:0 / number:1 / date:"yyyy-MM-dd" 过滤器 → ngNumber/ngDate 局部等价。
 */

const ngShow = (show: boolean) => (show ? undefined : ({ display: 'none' } as React.CSSProperties));
const w = () => window as any;

/** Angular number 过滤等价（千分位 + 指定小数位；非数值返回 ''） */
const ngNumber = (v: any, frac: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac });
};

const ngDate = (v: any) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// PluginCenterFactory.data（factory 单例；镜像 8-11）
const pluginCenterData: any = { categories: [], plugins: [] };

const getGetBestURL = () => {
  try {
    return w().require((w().appRoot && w().appRoot.path || '.') + '/app/js/utils/getBestURL.js');
  } catch (err) {
    return async () => '';
  }
};

// PluginCenterFactory.init（镜像 13-23 等价；远程 API，mock 环境加载失败 → 空数据）
const factoryInit = async () => {
  const getBestURL = getGetBestURL();
  const pjson = w().require((w().appRoot && w().appRoot.path || '.') + '/package.json');
  const preferences = w().preferences;
  const JSON_URL_CATEGORY = `https://community-en.eagle.cool/api/plugin/categories?locale=${preferences.general.language}&build=${pjson.buildVersion}`;
  const JSON_URL_PLUGINS = `https://community-en.eagle.cool/api/plugin/list?locale=${preferences.general.language}&build=${pjson.buildVersion}`;
  const options = { cache: 'no-store' } as any;
  try {
    pluginCenterData.categories = (await (await fetch((await getBestURL([{ url: JSON_URL_CATEGORY, delay: 0 }])) ?? JSON_URL_CATEGORY, options)).json()).data;
    pluginCenterData.plugins = (await (await fetch((await getBestURL([{ url: JSON_URL_PLUGINS, delay: 0 }])) ?? JSON_URL_PLUGINS, options)).json()).data;
  } catch (error) {
    if (w().electronLog) w().electronLog.error(`[plugin] Can't load plugin list or category list.`);
  }
};

export function PluginCenter() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const rootRef = useRef<any>({});
  const rootElRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const calculateListRef = useRef<() => void>(() => {});
  const calculateNeedUpdateRef = useRef<() => void>(() => {});
  const initRef = useRef<() => Promise<unknown>>(async () => {});
  const openRef = useRef<(categoryId?: any) => Promise<void>>(async () => {});

  // link 初始化（镜像 48-69）
  if (rootRef.current.initialized === undefined) {
    rootRef.current.initialized = true;
    rootRef.current.isOpen = false;
    rootRef.current.searchKeyword = '';
    rootRef.current.categories = [];
    rootRef.current.plugins = [];
    rootRef.current.resultList = [];
    rootRef.current.needUpdatePlugins = [];
    rootRef.current.currentPluginId = undefined;
    rootRef.current.pluginDetails = {};
    rootRef.current.currentTab = 'detail';
    rootRef.current.officialPluginMap = {};
    rootRef.current.sortBy = 'default';
    rootRef.current.isSortDropdownOpen = false;
    rootRef.current.sortOptions = [
      { value: 'default', label: t('modal.pluginCenter.sort.default') },
      { value: 'downloads', label: t('modal.pluginCenter.sort.downloads') },
      { value: 'developer', label: t('modal.pluginCenter.sort.developer') },
      { value: 'updatedAt', label: t('modal.pluginCenter.sort.updatedAt') },
    ];
    rootRef.current.currentSortOption = rootRef.current.sortOptions[0];
    rootRef.current.tabIndicatorStyle = {};
  }

  const toggleSortDropdown = (event: any) => {
    event.stopPropagation();
    rootRef.current.isSortDropdownOpen = !rootRef.current.isSortDropdownOpen;
    bumpAll();
  };

  const setSortBy = (option: any, event: any) => {
    event.stopPropagation();
    rootRef.current.sortBy = option.value;
    rootRef.current.currentSortOption = option;
    rootRef.current.isSortDropdownOpen = false;
    calculateListRef.current();
    bumpAll();
  };

  // 建立官方插件快取（镜像 107-123 逐字）
  const buildOfficialPluginCache = (plugins: any[]) => {
    rootRef.current.officialPluginMap = {};
    plugins.forEach((plugin: any) => {
      if (!plugin || !plugin.id) return;
      const email = plugin?.author?.email || '';
      const contact = plugin?.contact || '';
      if (email.includes('eagle.cool') || contact.includes('eagle.cool')) {
        rootRef.current.officialPluginMap[plugin.id] = true;
      }
    });
  };

  // isPluginCompatible（镜像 516-529 逐字）
  const isPluginCompatible = (plugin: any) => {
    if (!plugin) return false;
    const currentPlatform = w().process.platform === 'win32' ? 'win' : 'mac';
    const currentArch = w().process.arch;
    const pluginPlatform = plugin.platform || 'all';
    const pluginArch = plugin.arch || 'all';
    const platformMatch = pluginPlatform === 'all' || pluginPlatform === currentPlatform;
    const archMatch = pluginArch === 'all' || pluginArch === currentArch;
    return platformMatch && archMatch;
  };

  // loadRemoteData（镜像 535-565 逐字）
  const loadRemoteData = () => {
    return new Promise(async (resolve, reject) => {
      try {
        if (pluginCenterData.plugins.length === 0) {
          await factoryInit();
        }
        let categories = pluginCenterData.categories;
        let plugins = pluginCenterData.plugins;
        const platform = w().process.platform === 'win32' ? 'win' : 'mac';
        const arch = w().process.arch;
        plugins = plugins.filter((plugin: any) => {
          const samePlatform = plugin.platform === platform || plugin.platform === 'all';
          const sameArch = plugin.arch === arch || plugin.arch === 'all';
          if (samePlatform && sameArch) return true;
          return plugin.arch === arch && plugin.platform === platform;
        });
        return resolve({ categories: categories, plugins: plugins });
      } catch (error) {
        if (w().electronLog) w().electronLog.error(`[plugin] Can't load plugin list or category list.`);
        if (w().electronLog) w().electronLog.error(error);
        return reject(error);
      }
    });
  };

  // loadDetailData（镜像 567-578 逐字）
  const loadDetailData = async (pluginId: any) => {
    const getBestURL = getGetBestURL();
    const preferences = w().preferences;
    const options = { cache: 'no-store' } as any;
    const JSON_URL = `https://community-en.eagle.cool/api/plugin/${pluginId}?locale=${preferences.general.language}`;
    const result = await (await fetch((await getBestURL([{ url: JSON_URL, delay: 0 }])) ?? JSON_URL, options)).json();
    fetch(`https://community-en.eagle.cool/api/plugin/${pluginId}/view`, { method: 'POST' });
    return result.data;
  };

  // init（镜像 125-160 逐字）
  const init = () => {
    return new Promise(async (resolve, reject) => {
      rootRef.current.isLoading = true;
      bumpAll();
      loadRemoteData().then((result: any) => {
        rootRef.current.plugins = result.plugins;

        // 預先計算所有插件的相容性
        rootRef.current.plugins.forEach((plugin: any) => {
          plugin.isCompatible = isPluginCompatible(plugin);
        });

        // 建立官方插件快取
        buildOfficialPluginCache(rootRef.current.plugins);

        rootRef.current.categories = [
          {
            id: 'all',
            slug: 'all',
            name: t('modal.pluginCenter.sidebar.all'),
          },
          ...result.categories,
          {
            id: 'update',
            slug: 'update',
            name: t('modal.pluginCenter.sidebar.updates'),
          },
        ];
        calculateNeedUpdateRef.current();
        rootRef.current.selectedCategory = rootRef.current.categories[0];
        calculateListRef.current();
        rootRef.current.isLoading = false;
        bumpAll();
        return resolve(undefined);
      });
    });
  };
  initRef.current = init;

  // openPlugin（镜像 166-177 逐字）
  const openPlugin = async (plugin: any) => {
    rootRef.current.currentPluginId = plugin.id;
    if (!rootRef.current.pluginDetails[plugin.id]) {
      rootRef.current.pluginDetails[plugin.id] = plugin;
    }
    rootRef.current.pluginDetails[plugin.id] = await loadDetailData(plugin.id);
    rootRef.current.pluginDetails[plugin.id].isCompatible = isPluginCompatible(rootRef.current.pluginDetails[plugin.id]);
    bumpAll();
  };

  // openPluginById（镜像 179-187 逐字）
  const openPluginById = async (pluginId: any) => {
    rootRef.current.currentPluginId = pluginId;
    rootRef.current.pluginDetails[pluginId] = await loadDetailData(pluginId);
    rootRef.current.pluginDetails[pluginId].isCompatible = isPluginCompatible(rootRef.current.pluginDetails[pluginId]);
    bumpAll();
  };

  const closeDetailPage = () => {
    rootRef.current.currentPluginId = undefined;
    bumpAll();
  };

  // switchTab（镜像 195-210 逐字）
  const switchTab = (tab: any) => {
    rootRef.current.currentTab = tab;
    setTimeout(() => {
      const container = rootElRef.current?.querySelector('.segmented-tabs');
      if (!container) return;
      const tabs = container.querySelectorAll('.tab');
      const activeIndex = tab === 'logs' ? 1 : 0;
      const activeTab = tabs[activeIndex] as HTMLElement;
      if (!activeTab) return;
      rootRef.current.tabIndicatorStyle = {
        width: activeTab.offsetWidth + 'px',
        transform: 'translateX(' + activeTab.offsetLeft + 'px)',
      };
      bumpAll();
    }, 0);
    bumpAll();
  };

  const changeCategory = (category: any) => {
    rootRef.current.selectedCategory = category;
    calculateListRef.current();
    bumpAll();
  };

  const onKeywordChanged = () => {
    calculateListRef.current();
  };

  // applySorting（镜像 269-295 逐字）
  const applySorting = () => {
    const sortBy = rootRef.current.sortBy;
    const officialPluginMap = rootRef.current.officialPluginMap;
    if (sortBy === 'default') return;

    rootRef.current.resultList.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'downloads':
          return (b.downloads || 0) - (a.downloads || 0);
        case 'developer': {
          const aIsOfficial = officialPluginMap[a.id] ? 1 : 0;
          const bIsOfficial = officialPluginMap[b.id] ? 1 : 0;
          if (aIsOfficial !== bIsOfficial) return bIsOfficial - aIsOfficial;
          const aName = (a.author?.name || '').toLowerCase();
          const bName = (b.author?.name || '').toLowerCase();
          const nameCompare = aName.localeCompare(bName);
          if (nameCompare !== 0) return nameCompare;
          return (b.downloads || 0) - (a.downloads || 0);
        }
        case 'updatedAt': {
          const aTime = a.lasteVersion?.createdAt || 0;
          const bTime = b.lasteVersion?.createdAt || 0;
          return bTime - aTime;
        }
        default:
          return 0;
      }
    });
  };

  // calculateList（镜像 229-267 逐字）
  const calculateList = () => {
    rootRef.current.resultList = (rootRef.current.plugins as any).unique();
    const searchKeyword = rootRef.current.searchKeyword;
    if (searchKeyword !== '') {
      const keywords = searchKeyword.split(' ');
      rootRef.current.resultList = rootRef.current.resultList.filter((item: any) => {
        let allKeywords = '';
        allKeywords += item.name;
        if (item?.author?.name) {
          allKeywords += ' ' + item.author.name;
        }
        if (item?.tags?.length > 0) {
          allKeywords += item.tags.join(' ');
        }
        if (item?.exts?.length > 0) {
          allKeywords += item.exts.join(' ');
        }
        for (let i = 0; i < keywords.length; i++) {
          const keyword = keywords[i];
          if (allKeywords.toLowerCase().includes(keyword.toLowerCase())) return true;
        }
        return false;
      });
    }
    const selectedCategory = rootRef.current.selectedCategory;
    if (selectedCategory) {
      if (selectedCategory.slug === 'update') {
        rootRef.current.resultList = rootRef.current.resultList.filter((item: any) => {
          return rootRef.current.pluginModule.needUpdatePluginMaps[item.id];
        });
        applySorting();
        return;
      }
      if (selectedCategory.slug !== 'all') {
        rootRef.current.resultList = rootRef.current.resultList.filter((item: any) => {
          return item.categories.includes(rootRef.current.selectedCategory.slug);
        });
      }
    }
    applySorting();
    bumpAll();
  };
  calculateListRef.current = calculateList;

  // calculateNeedUpdate（镜像 499-514 逐字）
  const calculateNeedUpdate = () => {
    const pluginModule = useMiscRawState.getState().pluginModule;
    const versionCompare = w().require('compare-versions');
    rootRef.current.needUpdatePlugins = [];
    pluginModule.needUpdatePluginMaps = {};
    rootRef.current.plugins.forEach((plugin: any) => {
      // 檢查是否需要更新
      if (pluginModule.installedPluginMaps[plugin.id]) {
        const existsPlugin = pluginModule.installedPluginMaps[plugin.id].manifest;
        if (versionCompare(existsPlugin.version, plugin.lasteVersion.version) === -1) {
          rootRef.current.needUpdatePlugins.push(plugin);
          pluginModule.needUpdatePluginMaps[plugin.id] = plugin;
        }
      }
    });
    pluginModule.needUpdatePluginCount = Object.keys(pluginModule.needUpdatePluginMaps).length;
  };
  calculateNeedUpdateRef.current = calculateNeedUpdate;

  // open（镜像 350-363 逐字）
  const open = async (categoryId?: any) => {
    rootRef.current.isOpen = true;
    bumpAll();
    if (rootRef.current.plugins.length === 0) {
      rootRef.current.isLoading = true;
      bumpAll();
      await initRef.current();
    } else {
      calculateListRef.current();
      calculateNeedUpdateRef.current();
    }
    setTimeout(() => {
      const el = document.querySelector(`.category-${categoryId || 'all'}`) as HTMLElement | null;
      el?.click();
    }, 30);
  };
  openRef.current = open;

  const close = () => {
    rootRef.current.isOpen = false;
    bumpAll();
  };

  // installPlugin（镜像 369-398 逐字）
  const installPlugin = async (plugin: any) => {
        const pluginModule = useMiscRawState.getState().pluginModule;
    const desc = t('dialog.installPlugin.desc', [
      { property: 'name', value: plugin.name },
      { property: 'version', value: `v${plugin.lasteVersion.version}` },
    ]);
    const themePath = themePathOf(useBodyState.getState().theme);
    const size = w().fileSize(plugin.lasteVersion.fileSize);

    w().swal({
      html: `
						<div class="alert">
							<div class="alert-icon" style="background-image: url('${plugin.lasteVersion.logo}')">
								<img class="status" style="width: 20px; height: 20px;" src="assets/images/${themePath}/icons/ic-plugin-install-modal-download.svg">
							</div>
							<h4 class="alert-title">${t('dialog.installPlugin.title')}</h4>
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
      confirmButtonText: `${t('dialog.installPlugin.install')}<span class="small font-mono">(${size})</span>`,
      cancelButtonText: t('general.cancel'),
    }).then(async () => {
      await pluginModule.remotePlugin.install(plugin);
      calculateNeedUpdateRef.current();
      bumpAll();
    });
  };

  // updatePlugin（镜像 400-429 逐字）
  const updatePlugin = async (plugin: any) => {
        const pluginModule = useMiscRawState.getState().pluginModule;
    const desc = t('dialog.updatePlugin.desc', [
      { property: 'name', value: plugin.name },
      { property: 'version', value: `v${plugin.lasteVersion.version}` },
    ]);
    const themePath = themePathOf(useBodyState.getState().theme);
    const size = w().fileSize(plugin.lasteVersion.fileSize);

    w().swal({
      html: `
						<div class="alert">
							<div class="alert-icon" style="background-image: url('${plugin.lasteVersion.logo}')">
								<img class="status" style="width: 20px; height: 20px;" src="assets/images/${themePath}/icons/ic-plugin-install-modal-update.svg">
							</div>
							<h4 class="alert-title">${t('dialog.updatePlugin.title')}</h4>
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
      confirmButtonText: `${t('dialog.updatePlugin.update')}<span class="small font-mono">(${size})</span>`,
      cancelButtonText: t('general.cancel'),
    }).then(async () => {
      await pluginModule.remotePlugin.install(plugin);
      calculateNeedUpdateRef.current();
      bumpAll();
    });
  };

  // onInstalledClick（镜像 431-469 逐字）
  const onInstalledClick = (event: any, plugin: any) => {
    event.stopPropagation();
    const pluginModule = useMiscRawState.getState().pluginModule;
    const installed = pluginModule.installedPluginMaps[plugin.id];
    if (!installed) return;
    const isDisabled = pluginModule.isPluginDisabled(plugin.id);
    const isNonLaunchable = plugin.categories && (plugin.categories.includes('inspector') || plugin.categories.includes('format'));

    openAppContextMenu({
      items: [
        {
          visible: !isDisabled,
          label: t('modal.pluginCenter.contextMenu.launch'),
          disabled: isNonLaunchable,
          click: () => {
            pluginModule.open(installed);
            bumpAll();
          },
        },
        {
          label: isDisabled ? t('modal.pluginPanel.contextMenu.enablePlugin') : t('modal.pluginPanel.contextMenu.disablePlugin'),
          click: () => {
            if (isDisabled) {
              pluginModule.enablePlugin(installed);
            } else {
              pluginModule.disablePlugin(installed);
            }
            bumpAll();
          },
        },
        { role: 'separator' },
        {
          label: t('modal.pluginCenter.contextMenu.remove'),
          click: () => {
            uninstall(plugin);
            bumpAll();
          },
        },
      ],
    });
  };

  // uninstall（镜像 471-497 逐字）
  const uninstall = async (plugin: any) => {
        const pluginModule = useMiscRawState.getState().pluginModule;
    const installed = pluginModule.installedPluginMaps[plugin.id];
    const desc = t('dialog.removePlugin.desc', [{ property: 'name', value: installed.manifest.name }]);
    const themePath = themePathOf(useBodyState.getState().theme);
    w().swal({
      html: `
						<div class="alert">
							<div class="alert-icon" style="background-image: url('${plugin.lasteVersion.logo}')">
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
      await pluginModule.remotePlugin.uninstall(installed);
      bumpAll();
    });
  };

  const reload = async () => {
    initRef.current();
  };

  useEffect(() => {
    setHost(document.getElementById('eagle-plugin-center-host'));
  }, []);

  // link 期 2s 后预加载（镜像 162-164）
  useEffect(() => {
    const timer = setTimeout(() => {
      initRef.current();
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ipc = getIpc();

    // 點擊外部關閉排序下拉選單（镜像 85-94）
    const onDocClick = () => {
      if (rootRef.current.isSortDropdownOpen) {
        rootRef.current.isSortDropdownOpen = false;
        bumpAll();
      }
    };
    document.addEventListener('click', onDocClick);

    // 攔截 detail 區塊內所有連結點擊（镜像 97-104；原生委托）
    let offDetailLinks: any;
    const rootEl = rootElRef.current;
    if (rootEl) {
      const onDetailLinkClick = (event: any) => {
        const a = delegateTarget(event, '.page.detail a');
        if (!a || !rootEl.contains(a)) return;
        event.preventDefault();
        event.stopPropagation();
        const href = a.getAttribute('href');
        if (href && href !== '#') {
          w().require('electron').shell.openExternal(href);
        }
      };
      rootEl.addEventListener('click', onDetailLinkClick);
      offDetailLinks = () => rootEl.removeEventListener('click', onDetailLinkClick);
    }

    const currentWindow = w().require('@electron/remote').getCurrentWindow();

    // ipc 'install-plugin'（镜像 297-323 逐字）
    const onInstallPlugin = async (event: any, pluginId: any) => {
      currentWindow.show();
      await openRef.current();
      try {
        await openPluginById(pluginId);
      } catch (e) {}
      bumpAll();

      if (!rootRef.current.pluginDetails[pluginId]) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        w().swal({
          html: `
							<div class="alert">
								<div class="alert-icon info"></div>
								<h4 class="alert-title">${t('dialog.plugin.notAvailable.title')}</h4>
								<p class="alert-desc">${t('dialog.plugin.notAvailable.desc')}</p>
							</div>
						`,
          showCloseButton: false,
          showCancelButton: false,
          allowOutsideClick: false,
          focusConfirm: true,
          padding: 24,
          width: 400,
          customClass: 'alert-box',
          confirmButtonText: t('general.ok'),
        });
      }
    };

    // ipc 'open-plugin-center-and-search'（镜像 325-331 逐字）
    const onOpenAndSearch = (event: any, keyword: any) => {
      currentWindow.show();
      openRef.current();
      closeDetailPage();
      rootRef.current.searchKeyword = keyword;
      const input = searchInputRef.current;
      if (input) input.value = keyword;
      bumpAll();
    };

    // $on("OPEN_PLUGIN_CENTER")（镜像 333-336）
    const offOpen = openPluginCenterChannel.on(async (categoryId: any) => {
      await openRef.current(categoryId);
      bumpAll();
    });

    // $on("OPEN_PLUGIN_CENTER_DETAIL")（镜像 338-342）
    const offOpenDetail = openPluginCenterDetailChannel.on(async (pluginId: any) => {
      await openRef.current();
      try {
        await openPluginById(pluginId);
      } catch (e) {}
      bumpAll();
    });

    // b1-9ba：应用侧发送面随 bundle 摘除死亡，但 7d5b 契约（广播不崩、面板保持）
    // 仍锁定本监听——保留，插件竖切时归位。
    const offRefresh = refreshPluginCenterChannel.on(async (categoryId: any) => {
      void categoryId;
      calculateListRef.current();
      calculateNeedUpdateRef.current();
      bumpAll();
    });

    // auto-focus 指令等价（OPEN_PLUGIN_CENTER → click + focus + select）
    const offAutoFocus = openPluginCenterChannel.on(() => {
      setTimeout(() => {
        const el = searchInputRef.current;
        if (el) {
          try {
            el.click();
          } catch (err) {}
          el.focus();
          el.select();
        }
      }, 100);
    });

    // 闭环测试契约
    (window as any).__eaglePluginCenter = {
      get isOpen() {
        return rootRef.current.isOpen;
      },
      get categories() {
        return rootRef.current.categories;
      },
      get resultList() {
        return rootRef.current.resultList;
      },
      get isLoading() {
        return rootRef.current.isLoading;
      },
    };

    return () => {
      document.removeEventListener('click', onDocClick);
      if (offDetailLinks) offDetailLinks();
      if (ipc && ipc.off) {
        ipc.off('install-plugin', onInstallPlugin);
        ipc.off('open-plugin-center-and-search', onOpenAndSearch);
      }
      offOpen();
      offOpenDetail();
      offRefresh();
      offAutoFocus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const isOpen = rootRef.current.isOpen;
  const isLoading = rootRef.current.isLoading;
  const categories: any[] = rootRef.current.categories || [];
  const resultList: any[] = rootRef.current.resultList || [];
  const needUpdatePlugins: any[] = rootRef.current.needUpdatePlugins || [];
  const currentPluginId = rootRef.current.currentPluginId;
  const pluginDetails = rootRef.current.pluginDetails || {};
  const currentTab = rootRef.current.currentTab;
  const sortBy = rootRef.current.sortBy;
  const sortOptions: any[] = rootRef.current.sortOptions || [];
  const currentSortOption = rootRef.current.currentSortOption;
  const isSortDropdownOpen = rootRef.current.isSortDropdownOpen;
  const officialPluginMap = rootRef.current.officialPluginMap;
  const tabIndicatorStyle = rootRef.current.tabIndicatorStyle || {};
  const pluginModule = useMiscRawState.getState().pluginModule || {};
    const theme = themePathOf((useBodyState.getState().theme as string) || 'dark');
  const detail = pluginDetails[currentPluginId];
  const isDetailShown = !!(currentPluginId && pluginDetails[currentPluginId]);

  return createPortal(
    <>
      <div className={`modal plugin-center${isOpen ? ' open' : ''}`} ref={rootElRef as any}>
        {/* 載入提示 */}
        <div className="loader" style={ngShow(!!isLoading)}>
          <svg className="spinner" width="32px" height="32px" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
            <circle className="path" fill="none" strokeWidth="3" strokeLinecap="round" cx="33" cy="33" r="30" />
          </svg>
        </div>

        <div className={`page list${!pluginDetails[currentPluginId] ? ' show' : ''}`}>
          <div className="plugin-center-container list">
            {/* 左側 Sidebar */}
            <div className="left-panel">
              <div className="title">{t('modal.pluginCenter.title')}</div>
              <input
                type="search"
                auto-focus="OPEN_PLUGIN_CENTER"
                ref={searchInputRef}
                onChange={(e: any) => {
                  rootRef.current.searchKeyword = e.target.value;
                  onKeywordChanged();
                  bumpAll();
                }}
                placeholder={t('modal.pluginCenter.searchPlaceholder')}
              />
              <div className="plugin-category-list">
                {categories.map((category: any, index: number) => (
                  <div
                    key={index}
                    className={`plugin-category category-${category.slug}${category.slug === rootRef.current.selectedCategory?.slug ? ' active' : ''}`}
                    onClick={() => changeCategory(category)}
                  >
                    <div className="icon">
                      <img src={`assets/images/${theme}/icons/ic-plugin-type-${category.slug}.svg`} />
                    </div>
                    <div className="name">{category.name}</div>
                    {category.slug === 'update' && needUpdatePlugins.length > 0 && <div className="badge">{needUpdatePlugins.length}</div>}
                  </div>
                ))}
              </div>
            </div>
            {/* 右側面板 */}
            {isOpen && (
              <div className="right-panel" style={ngShow(!!isLoading)}>
                <div className="panel-header">
                  <div className="panel-title">{rootRef.current.selectedCategory?.name}</div>
                  <div className="sort-controls">
                    <div className="sort-button" onClick={(e) => toggleSortDropdown(e)}>
                      <span>{currentSortOption?.label}</span>
                      <svg className={`sort-arrow${isSortDropdownOpen ? ' open' : ''}`} width="10" height="6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>
                    <div className="sort-dropdown" style={ngShow(!!isSortDropdownOpen)}>
                      {sortOptions.map((option: any, index: number) => (
                        <div key={index} className={`sort-option${option.value === sortBy ? ' active' : ''}`} onClick={(e) => setSortBy(option, e)}>
                          <span>{option.label}</span>
                          {option.value === sortBy && (
                            <svg className="check-icon" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="divider" />
                  </div>
                  <div className="close" onClick={() => close()} />
                </div>
                <div className="empty-state" style={ngShow(!(resultList.length === 0 && rootRef.current.searchKeyword))}>
                  <div className="icon">
                    <img style={{ width: '90px' }} src={`assets/images/${theme}/illustrations/plugin-search-empty.png`} />
                  </div>
                  <div className="title">{t('modal.pluginCenter.searchEmpty.title')}</div>
                  <p>{t('modal.pluginCenter.searchEmpty.desc')}</p>
                </div>
                <div className="empty-state" style={ngShow(!(resultList.length === 0 && !rootRef.current.searchKeyword))}>
                  {rootRef.current.selectedCategory?.slug === 'update' ? (
                    <div>
                      <div className="icon">
                        <img style={{ width: '90px' }} src={`assets/images/${theme}/illustrations/plugin-search-empty.png`} />
                      </div>
                      <div className="title">{t('modal.pluginCenter.updatesEmpty.title')}</div>
                      <p>{t('modal.pluginCenter.updatesEmpty.desc')}</p>
                    </div>
                  ) : (
                    <div>
                      <a className="button button-grey button-xs" onClick={() => reload()}>
                        {t('modal.pluginPanel.contextMenu.reload')}
                      </a>
                    </div>
                  )}
                </div>
                <div className="plugin-list" style={ngShow(!(resultList.length > 0))}>
                  {resultList.map((plugin: any, index: number) => (
                    <div className="plugin" key={index} onClick={() => openPlugin(plugin)}>
                      <div className="logo" style={{ backgroundImage: `url('${plugin.lasteVersion.logo}')` }}>
                        {!!(pluginModule.installedPluginMaps?.[plugin.id] && pluginModule.needUpdatePluginMaps?.[plugin.id]) && (
                          <div className="status">
                            <img src={`assets/images/${theme}/icons/ic-plugin-list-needupdate.svg`} />
                          </div>
                        )}
                        {!!(pluginModule.installedPluginMaps?.[plugin.id] && !pluginModule.needUpdatePluginMaps?.[plugin.id]) && (
                          <div className="status">
                            <img src={`assets/images/${theme}/icons/ic-plugin-list-installed.svg`} />
                          </div>
                        )}
                      </div>
                      <div className="info">
                        <div>
                          <div className="name">
                            {plugin.name}
                            <span className="version">{plugin.version}</span>
                          </div>
                          <div className="desc">{plugin.description}</div>
                        </div>
                        <div className="more">
                          <div className="author" style={{ maxWidth: '100px', minWidth: '100px' }}>
                            <img src={plugin.author?.avatar || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='} />
                            {plugin.author?.name}
                          </div>
                          {plugin.downloads > 0 && (
                            <div className="counts">
                              <div className="count" style={{ maxWidth: '80px', minWidth: '80px' }}>
                                <img src={`assets/images/${theme}/icons/ic-plugin-prop-download.svg`} />
                                {numberAbbreviate(plugin.downloads) ?? ''}
                              </div>
                            </div>
                          )}
                          {!!pluginModule.installingPluginMaps?.[plugin.id] ? (
                            <div style={{ minWidth: '120px', display: 'flex', flexDirection: 'row-reverse' }}>
                              <div className="button button-grey button-xs">
                                {t('modal.pluginCenter.installing')}...<span>({ngNumber(pluginModule.installingPluginMaps[plugin.id].percentage, 1)}%)</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ minWidth: '120px', display: 'flex', flexDirection: 'row-reverse' }}>
                              {/* 系統不相容時顯示不可用按鈕 */}
                              <div className="button button-grey button-xs" style={ngShow(!pluginModule.installedPluginMaps?.[plugin.id] && !plugin.isCompatible)} data-disabled="true">
                                <img src={`assets/images/${theme}/icons/ic-plugin-list-download.svg`} />
                                {t('modal.pluginCenter.incompatible')}
                              </div>
                              {/* 尚未安裝且相容 */}
                              <div
                                className="button button-primary button-xs"
                                style={ngShow(!pluginModule.installedPluginMaps?.[plugin.id] && !!plugin.isCompatible)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  installPlugin(plugin);
                                }}
                              >
                                <img src={`assets/images/${theme}/icons/ic-plugin-list-download.svg`} />
                                {t('modal.pluginCenter.install')}
                              </div>
                              {/* 需更新且相容 */}
                              <div
                                className="button button-primary button-xs"
                                style={ngShow(!!(pluginModule.installedPluginMaps?.[plugin.id] && pluginModule.needUpdatePluginMaps?.[plugin.id] && plugin.isCompatible))}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updatePlugin(plugin);
                                }}
                              >
                                <img src={`assets/images/${theme}/icons/ic-plugin-list-update.svg`} />
                                {t('modal.pluginCenter.update')}
                              </div>
                              {/* 已安裝 - 啟用中 */}
                              <div
                                className="button button-grey button-xs"
                                style={ngShow(!!(pluginModule.installedPluginMaps?.[plugin.id] && !pluginModule.needUpdatePluginMaps?.[plugin.id] && !pluginModule.isPluginDisabled(plugin.id)))}
                                onClick={(e) => onInstalledClick(e, plugin)}
                              >
                                {t('modal.pluginCenter.installed')}
                              </div>
                              {/* 已安裝 - 禁用中 */}
                              <div
                                className="button button-grey button-xs"
                                style={ngShow(!!(pluginModule.installedPluginMaps?.[plugin.id] && !pluginModule.needUpdatePluginMaps?.[plugin.id] && pluginModule.isPluginDisabled(plugin.id)))}
                                onClick={(e) => onInstalledClick(e, plugin)}
                              >
                                {t('modal.pluginCenter.disabled')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={`page detail${isDetailShown ? ' show' : ''}`}>
          <div className="plugin-center-container">
            <div className="left-panel detail-left-panel">
              <div className="plugin-detail-info">
                <div className="plugin-card">
                  <div className="logo" style={{ backgroundImage: `url('${detail?.lasteVersion?.logo}')` }} />
                  <div className="name">{detail?.name}</div>
                  <div className="desc">{detail?.description}</div>
                  <div style={{ width: '100%', display: pluginModule.installingPluginMaps?.[currentPluginId] ? undefined : 'none' }}>
                    <div className="button button-block button-grey button-xs">
                      {t('modal.pluginCenter.installing')}...{ngNumber(pluginModule.installingPluginMaps?.[currentPluginId]?.percentage, 1)}%
                    </div>
                  </div>
                  <div style={{ width: '100%', display: pluginModule.installingPluginMaps?.[currentPluginId] ? 'none' : undefined }}>
                    {/* 系統不相容時顯示不可用按鈕 */}
                    <div className="button button-block button-grey button-xs" style={ngShow(!pluginModule.installedPluginMaps?.[currentPluginId] && !detail?.isCompatible)} data-disabled="true">
                      {t('modal.pluginCenter.incompatible')}
                    </div>
                    {/* 一般安裝按鈕 */}
                    <div
                      className="button button-block button-primary button-xs"
                      style={ngShow(!pluginModule.installedPluginMaps?.[currentPluginId] && !!detail?.isCompatible)}
                      onClick={(e) => {
                        e.stopPropagation();
                        installPlugin(pluginDetails[currentPluginId]);
                      }}
                    >
                      <img src={`assets/images/${theme}/icons/ic-plugin-list-download.svg`} />
                      {t('modal.pluginCenter.install')}
                    </div>
                    {/* 更新按鈕 - 只有相容時才能更新 */}
                    <div
                      className="button button-block button-primary button-xs"
                      style={ngShow(!!(pluginModule.installedPluginMaps?.[currentPluginId] && pluginModule.needUpdatePluginMaps?.[currentPluginId] && detail?.isCompatible))}
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePlugin(pluginDetails[currentPluginId]);
                      }}
                    >
                      <img src={`assets/images/${theme}/icons/ic-plugin-list-update.svg`} />
                      {t('modal.pluginCenter.update')}
                    </div>
                    {/* 已安裝按鈕 - 啟用中 */}
                    <div
                      className="button button-block button-grey button-xs"
                      style={ngShow(!!(pluginModule.installedPluginMaps?.[currentPluginId] && !pluginModule.needUpdatePluginMaps?.[currentPluginId] && !pluginModule.isPluginDisabled(currentPluginId)))}
                      onClick={(e) => onInstalledClick(e, pluginDetails[currentPluginId])}
                    >
                      {t('modal.pluginCenter.installed')}
                    </div>
                    {/* 已安裝按鈕 - 禁用中 */}
                    <div
                      className="button button-block button-grey button-xs"
                      style={ngShow(!!(pluginModule.installedPluginMaps?.[currentPluginId] && !pluginModule.needUpdatePluginMaps?.[currentPluginId] && pluginModule.isPluginDisabled(currentPluginId)))}
                      onClick={(e) => onInstalledClick(e, pluginDetails[currentPluginId])}
                    >
                      {t('modal.pluginCenter.disabled')}
                    </div>
                  </div>
                </div>
                <div className="plugin-props" style={ngShow(!detail?.author?.name)}>
                  <div className="props">
                    <div className="prop">
                      <div className="icon">
                        <img src={`assets/images/${theme}/icons/ic-plugin-prop-developer.svg`} />
                      </div>
                      {t('modal.pluginCenter.props.developer')}
                    </div>
                    <div className="prop">
                      <div className="icon">
                        <img src={`assets/images/${theme}/icons/ic-plugin-prop-version.svg`} />
                      </div>
                      {t('modal.pluginCenter.props.version')}
                    </div>
                    <div className="prop">
                      <div className="icon">
                        <img src={`assets/images/${theme}/icons/ic-plugin-prop-download.svg`} />
                      </div>
                      {t('modal.pluginCenter.props.download')}
                    </div>
                    <div className="prop">
                      <div className="icon">
                        <img src={`assets/images/${theme}/icons/ic-plugin-prop-view.svg`} />
                      </div>
                      {t('modal.pluginCenter.props.view')}
                    </div>
                    <div className="prop">
                      <div className="icon">
                        <img src={`assets/images/${theme}/icons/ic-plugin-prop-support.svg`} />
                      </div>
                      {t('modal.pluginCenter.props.support')}
                    </div>
                    {detail?.website && (
                      <div className="prop">
                        <div className="icon">
                          <img src={`assets/images/${theme}/icons/ic-plugin-prop-site.svg`} />
                        </div>
                        {t('modal.pluginCenter.props.site')}
                      </div>
                    )}
                  </div>
                  <div className="values">
                    <div className="value">
                      {detail?.author?.name}
                      {officialPluginMap[currentPluginId] && (
                        <span className="official-badge" tippy="" tippy-content={t('modal.pluginCenter.officialPlugin')} tippy-placement="top">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" />
                        </span>
                      )}
                    </div>
                    <div className="value font-mono">{detail?.lasteVersion?.version}</div>
                    <div className="value font-mono">{ngNumber(detail?.downloads, 0)}</div>
                    <div className="value font-mono">{ngNumber(detail?.views, 0)}</div>
                    <div className="value">{detail?.contact}</div>
                    <div className="value">
                      {detail?.website && (
                        <a tippy="" tippy-content={detail.website} tippy-placement="top" href={detail.website} target="_blank">
                          {detail.website}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {isOpen && (
              <div className="right-panel" style={ngShow(!!isLoading)}>
                <div className="panel-header detail-panel-header">
                  <div className="back" onClick={() => closeDetailPage()} />
                  <div className="segmented-tabs">
                    <div className="tab-indicator" style={tabIndicatorStyle} />
                    <div className={`tab${currentTab === 'detail' ? ' active' : ''}`} onClick={() => switchTab('detail')}>
                      {t('modal.pluginCenter.detail.overview')}
                    </div>
                    <div className={`tab${currentTab === 'logs' ? ' active' : ''}`} onClick={() => switchTab('logs')}>
                      {t('modal.pluginCenter.detail.version')}
                    </div>
                  </div>
                  <div className="close" onClick={() => close()} />
                </div>
                <div className="tabs-container" style={ngShow(currentTab !== 'detail')}>
                  <div className="plugin-intro" dangerouslySetInnerHTML={{ __html: detail?.details ?? '' }} />
                </div>
                <div className="tabs-container" style={ngShow(currentTab !== 'logs')}>
                  <div className="logs">
                    {(detail?.versions || []).map((version: any, index: number) => (
                      <div className="log" key={index}>
                        <div className="version">
                          <span className="number">v{version.version}</span>
                          <span className="date">{ngDate(version.createdAt)}</span>
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: version.changelog ?? '' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="modal-overlay" />
    </>,
    host
  );
}