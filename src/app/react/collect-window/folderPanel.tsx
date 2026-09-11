/**
 * 采集窗资料夹选择面板——folder-select-panel.js（类 1-585 逐字）+ 模板（120 行逐字）的 React 移植。
 * 阶段9b-1：vs-repeat 虚拟滚动暂以全量渲染等价（mock 数据量小；9b-2 接 useVsRepeat）；
 * library-switcher 元素保留占位（9b-2）；openItemSubmenu/ContextMenu 为守卫 no-op（9b-2）。
 */

import { useEffect, useRef, useState } from 'react';
import { controllerScope, applyController, registerFolderPanelOpener, ct, reloadData } from './controller';
import { SelectPanel, panelI18n, cartesianProduct } from './selectPanelEngine';
import { ContextMenu } from './contextMenu';
import { useVsRepeat, useVsAutoScroll } from '../components/stage7/FolderSelectPanels';
import { q } from '../utils/domQuery';

// folder-select-panel.html 的 vs-repeat 属性（vs-excess=30 vs-repeat=26 vs-size=size）
const VS_REPEAT_OPTIONS = { elementSize: 26, excess: 30 };

class FolderSelectPanel extends SelectPanel {
  originalParams: any;
  collapsedFolderIds: any = {};
  rawData: any;
  onChanged: any;
  onOpenItem: any;
  onCreateItem: any;
  onLibrarySwitching: any;
  onLibrarySwitched: any;
  onLibrarySwitchClosed: any;
  isMultipleSelect = false;

  constructor(params: any) {
    super(params);
    this.collapsedFolderIds = {};
  }

  init(params: any) {
    this.originalParams = params;
    super.init(params);
    this.reset();
    this.initRawData(params);
    this.updateItemList();
    this.onChanged = params.onChanged || (() => {});
    this.onOpenItem = params.onOpenItem || (() => {});
    this.onCreateItem = params.onCreateItem || (() => {});
    this.onLibrarySwitching = params.onLibrarySwitching || (() => {});
    this.onLibrarySwitched = params.onLibrarySwitched || (() => {});
    this.onLibrarySwitchClosed = params.onLibrarySwitchClosed || (() => {});
  }

  reset() {
    super.reset();
    if (localStorage['eagle.folderSelectPanel.collapsedFolderIds']) {
      try {
        this.collapsedFolderIds = JSON.parse(localStorage['eagle.folderSelectPanel.collapsedFolderIds']);
      } catch (e) {
        this.collapsedFolderIds = {};
      }
    }
    this.listData.selectedIds = {};
    this.listData.currentTab = 'ALL';
    this.rawData = {
      folders: [],
      selectedIds: {},
      recentFolderOrders: {},
      folderList: [],
      foldersMap: {},
      foldersDepthMap: {},
    };
  }

  initRawData(params: any) {
    const guidelinesMap: any = {};

    this.rawData = {
      folders: params.folders || [],
      selectedIds: params.selectedIds || {},
      recentFolderOrders: params.recentFolderOrders || {},
      folderList: [],
      foldersMap: {},
      folderItemsMap: {},
      foldersDepthMap: {},
    };

    this.listData.maxDepth = 0;
    (window as any).eagle.utils.tree.walk(this.rawData.folders, 'children', (folder: any, parent: any, depth: number) => {
      const { id, name, icon, iconColor, pinyin } = folder;

      this.rawData.folderList.push(folder);
      this.rawData.foldersMap[id] = folder;
      this.rawData.foldersDepthMap[id] = depth;

      let guidelines: string[] = [];
      if (parent && guidelinesMap[parent.id]) {
        guidelines = [...guidelinesMap[parent.id], folder.iconColor || 'normal'];
      } else {
        guidelines = [folder.iconColor || 'normal'];
      }
      guidelinesMap[folder.id] = guidelines;

      const hasChildren = folder.children && folder.children.length > 0;

      let isLast = false;
      if (depth !== 0 && parent && parent.children) {
        const idx = parent.children.indexOf(folder);
        isLast = idx === parent.children.length - 1 || (idx === 0 && parent.children.length === 1);
      }

      const item = {
        type: 'folder',
        id,
        name,
        pinyin,
        path: this.getFolderParentPath(folder),
        extendTags: folder.extendTags,
        icon,
        iconColor,
        depth: this.rawData.foldersDepthMap[id],
        size: 27,
        parent: parent?.id,
        parentItem: this.rawData.folderItemsMap[parent?.id],
        guidelines,
        hasChildren,
        isLast,
      };

      this.rawData.folderItemsMap[id] = item;
      if (this.listData.maxDepth < depth) {
        this.listData.maxDepth = depth;
      }
    });

    this.listData.selectedIds = { ...this.rawData.selectedIds };
  }

  updateItemList(keepIndex = false) {
    if (!keepIndex) {
      this.listData.currentIndex = -1;
    }
    this.listData.items = [];

    const searchKeyword = this.listData.searchKeyword;
    const folderList = this.rawData.folderList;
    let showCreateFolderBtn = searchKeyword !== '';
    let folders: any[] = [];
    let recentFolders: any[] = [];
    let recentFoldersCount = 5;

    folders.push({ type: 'all', size: 27, name: 'All' });

    folderList.forEach((folder: any) => {
      const { id, name } = folder;
      const item = this.rawData.folderItemsMap[id];
      const newItem = { ...item };
      const isSelected = this.listData.selectedIds[id];

      if (isSelected) {
        recentFoldersCount++;
      }

      if (this.rawData.recentFolderOrders[id] >= 0 || isSelected) {
        const recentItem = { ...item };
        recentItem.depth = 0;
        recentItem.isRecent = true;
        recentFolders.push(recentItem);
      }

      if (searchKeyword) {
        folders.push(newItem);
      } else if (this.isVisible(newItem)) {
        folders.push(newItem);
      }

      if (name === searchKeyword) {
        showCreateFolderBtn = false;
      }
    });

    recentFolders = recentFolders.sort((a: any, b: any) => {
      const aIdx = this.rawData.recentFolderOrders[a.id];
      const bIdx = this.rawData.recentFolderOrders[b.id];
      if (aIdx < bIdx) return -1;
      if (aIdx > bIdx) return 1;
      return 0;
    });
    recentFolders = recentFolders.sort((a: any, b: any) => {
      if (this.rawData.selectedIds[a.id] && !this.rawData.selectedIds[b.id]) return -1;
      if (!this.rawData.selectedIds[a.id] && this.rawData.selectedIds[b.id]) return 1;
      return 0;
    });
    recentFolders = recentFolders.sort((a: any, b: any) => {
      if (this.listData.selectedIds[a.id] && !this.listData.selectedIds[b.id]) return -1;
      if (!this.listData.selectedIds[a.id] && this.listData.selectedIds[b.id]) return 1;
      return 0;
    });

    if (this.listData.currentTab === 'ALL') {
      let filteredRecentFolders = this.filterByKeyword(recentFolders);
      filteredRecentFolders = filteredRecentFolders.slice(0, recentFoldersCount);
      folders = this.filterByKeyword(folders);

      if (searchKeyword !== '') {
        folders = folders.filter((folder: any) => {
          return !filteredRecentFolders.find((recentFolder: any) => recentFolder.id === folder.id);
        });
      }

      if (filteredRecentFolders.length > 0) {
        if (folders.length > 0) {
          this.listData.items = [...filteredRecentFolders, { type: 'separator', size: 5 }, ...folders];
        } else {
          this.listData.items = [...filteredRecentFolders];
        }
      } else {
        this.listData.items = [...folders];
      }
    } else if (this.listData.currentTab === 'RECENT') {
      recentFolders = this.filterByKeyword(recentFolders);
      this.listData.items = [...recentFolders.slice(0, 20)];
    } else if (this.listData.currentTab === 'SELECTED') {
      folders = folders.filter((folder: any) => {
        return this.listData.selectedIds[folder.id];
      });
      this.listData.items = [...folders];
    }

    if (showCreateFolderBtn) {
      if (this.listData.items.length > 0) {
        this.listData.items = [...this.listData.items, { type: 'separator', size: 5 }, { type: 'create', size: 27, name: searchKeyword }];
      } else {
        this.listData.items = [{ type: 'create', size: 27, name: searchKeyword }];
      }
    }

    this.listData.items.forEach((item: any, index: number) => {
      item.index = index;
    });

    if (!keepIndex) {
      if (searchKeyword !== '' && this.listData.items.length > 0) {
        this.listData.currentIndex = 0;
      } else {
        this.listData.currentIndex = -1;
      }
    }
  }

  isVisible(item: any): boolean {
    const parentId = item.parent;
    if (parentId) {
      const parentItem = this.rawData.folderItemsMap[parentId];
      if (!parentItem) return false;
      if (this.collapsedFolderIds[parentId]) return false;
      return this.isVisible(parentItem);
    }
    return true;
  }

  filterByKeyword(list: any[]) {
    if (this.listData.searchKeyword.length === 0) return list;

    const chineseConvert = (window as any).chineseConvert;
    const pinyinlite = (window as any).pinyinlite;
    const keyword_cn = chineseConvert
      .tw2cn(this.listData.searchKeyword)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\ /g, '')
      .toLowerCase();
    const temp = list.map((item: any) => {
      const nameCN = chineseConvert.tw2cn(item.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (item.name.length >= 30) {
        return { item: item, name: nameCN, search: [nameCN] };
      }
      return {
        item: item,
        name: nameCN,
        search: [
          nameCN,
          ...new Set(cartesianProduct(pinyinlite(nameCN, { keepUnrecognized: true }).filter((p: string) => p.length > 0)).map((parts: string[]) => parts.join(' '))),
        ],
      };
    });

    const scores = temp.map((item: any) => {
      const itemName = `${item.name ?? ''} ${item.keywords ?? ''}`;
      return {
        item: item,
        name: itemName,
        score: Math.max(...item.search.map((pinyin: string) => (pinyin as any).score(keyword_cn))),
      };
    });

    list = scores
      .filter((i: any) => i.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .map((i: any) => i.item.item);

    const result = list.reduce(
      (acc: any, cur: any) => {
        if (cur.name.toLowerCase().startsWith(this.listData.searchKeyword.toLowerCase())) {
          acc.startWithKeyword.push(cur);
        } else {
          acc.notStartWithKeyword.push(cur);
        }
        return acc;
      },
      { startWithKeyword: [], notStartWithKeyword: [] }
    );

    return [...result.startWithKeyword, ...result.notStartWithKeyword];
  }

  getFolderParentPath(folder: any) {
    const parentFolder = this.rawData.foldersMap[folder.parent];
    const grandParentFolder = this.rawData.foldersMap[parentFolder?.parent];
    const greatGrandParentFolder = this.rawData.foldersMap[grandParentFolder?.parent];
    const parentFolderName = parentFolder?.name;
    const grandParentFolderName = grandParentFolder?.name;
    const greatGrandParentFolderName = greatGrandParentFolder?.name;
    let result = '';
    if (greatGrandParentFolderName && grandParentFolderName && parentFolderName) {
      result = `../<span>${grandParentFolderName}</span>/<span>${parentFolderName}</span>`;
    } else if (!greatGrandParentFolderName && grandParentFolderName && parentFolderName) {
      result = `<span>${grandParentFolderName}</span>/<span>${parentFolderName}</span>`;
    } else if (!greatGrandParentFolderName && !grandParentFolderName && parentFolderName) {
      result = `${parentFolderName}`;
    }
    return result;
  }

  close() {
    // 原版 close() 逻辑整体被注释（逐字保留：关闭=无操作）
  }

  onTabKey() {
    return;
  }

  openItem(_event: any, item: any) {
    this.collectItem(item);
  }

  collectItem(item: any) {
    if (item.type === 'create') {
      this.onCreateItem(item);
    } else {
      this.onOpenItem(item);
    }
  }

  collectItems(items: any) {
    this.onOpenItem(items);
  }

  getSelectedItems() {
    return Object.keys(this.listData.selectedIds);
  }

  selectItem(item: any) {
    this.listData.selectedIds[item.id] = !this.listData.selectedIds[item.id];
  }

  openItemSubmenu(item: any) {
    const i18n = (window as any).i18n;
    const bodyScope: any = (window as any).$bodyScope; // 原版裸 $bodyScope 在采集窗未定义（ReferenceError 怪癖逐字保留）
    if (item.isRecent) {
      ContextMenu.open({
        items: [
          {
            label: panelI18n('selectFolderPanel.context.removeHistory'),
            click: () => {
              bodyScope.removeRecentFolder(item.id, () => {
                const selectedIds = { ...this.listData.selectedIds };
                this.reset();
                this.init(this.originalParams);
                this.listData.selectedIds = selectedIds;
                this.updateItemList();
              });
            },
          },
        ],
        onClosed: () => {
          this.focusSearchInput();
        },
      });
    } else {
      ContextMenu.open({
        items: [
          {
            label: panelI18n('selectFolderPanel.context.addChilderFolder'),
            icon: 'ic-folder-new-sub-folder.svg',
            click: () => {
              this.createFolder('', (folderName: string) => {
                bodyScope.createFolder({
                  name: folderName,
                  parentID: item.id,
                  callback: (folder: any) => {
                    this.onCreatedFolder(folder);
                  },
                });
              });
            },
          },
          {
            label: panelI18n('selectFolderPanel.context.addSiblingFolder'),
            icon: 'ic-expand-same.svg',
            click: () => {
              this.createFolder('', (folderName: string) => {
                bodyScope.createFolder({
                  name: folderName,
                  sibling: item,
                  callback: (folder: any) => {
                    this.onCreatedFolder(folder);
                  },
                });
              });
            },
          },
        ],
        onClosed: () => {
          this.focusSearchInput();
        },
      });
    }
    void i18n;
  }

  changeTab(tab: string) {
    this.listData.currentTab = tab;
    this.updateItemList();
  }

  keywordChanged() {
    this.updateItemList();
    this.scrollToTop();
  }

  scrollToTop() {
    const list = q('folder-select-panel select-panel-list');
    if (list) list.scrollTop = 0;
  }

  isItemSelectable(item: any) {
    const selectableTypes: any = { folder: true, create: true, all: true };
    return selectableTypes[item.type];
  }

  createFolder(defaultName = '', callback: any) {
    const swal = (window as any).swal;
    swal({
      html: `
				<div class="alert">
					<div class="alert-icon create"></div>
					<h4 class="alert-title">${panelI18n('selectFolderPanel.createFolder.title')}</h4>
				</div>
			`,
      showCloseButton: false,
      showCancelButton: true,
      allowOutsideClick: false,
      focusConfirm: true,
      focusCancel: false,
      padding: 24,
      width: 400,
      customClass: 'alert-box',
      input: 'text',
      inputPlaceholder: panelI18n('selectFolderPanel.createFolder.placeholder'),
      inputValue: defaultName,
      cancelButtonColor: '#777777',
      confirmButtonText: panelI18n('selectFolderPanel.createFolder.button'),
      cancelButtonText: panelI18n('general.cancel'),
    }).then(
      (result: any) => {
        callback(result);
        this.focusSearchInput();
      },
      () => {
        this.focusSearchInput();
      }
    );
  }

  onCreatedFolder(folder: any) {
    const selectedIds = { ...this.listData.selectedIds };
    selectedIds[folder.id] = true;
    this.reset();
    this.init(this.originalParams);
    this.listData.selectedIds = selectedIds;
    this.updateItemList();
  }

  toggleExpand(item: any) {
    if (this.collapsedFolderIds[item.id]) {
      this.expand(item);
    } else {
      this.collapse(item);
    }
  }

  expand(item: any) {
    delete this.collapsedFolderIds[item.id];
    this.updateItemList(true);
    try {
      localStorage['eagle.folderSelectPanel.collapsedFolderIds'] = JSON.stringify(this.collapsedFolderIds);
    } catch (e) {
      console.error(e);
    }
  }

  collapse(item: any) {
    this.collapsedFolderIds[item.id] = true;
    this.updateItemList(true);
    try {
      localStorage['eagle.folderSelectPanel.collapsedFolderIds'] = JSON.stringify(this.collapsedFolderIds);
    } catch (e) {
      console.error(e);
    }
  }

  onLeftKey() {
    const currentItem = this.listData.items[this.listData.currentIndex];
    if (currentItem && currentItem.type === 'folder') {
      this.collapse(currentItem);
    }
  }

  onRightKey() {
    const currentItem = this.listData.items[this.listData.currentIndex];
    if (currentItem && currentItem.type === 'folder') {
      this.expand(currentItem);
    }
  }
}

/* ---- 模板（folder-select-panel.html 120 行逐字；vs-repeat 全量渲染等价） ---- */

function fuzzyMatchHtml(name: string, keyword: string): string {
  if (!keyword) return escapeHtml(name);
  const search = keyword.replace(/ /g, '').toLowerCase();
  let searchPosition = 0;
  let tokens = '';
  for (let n = 0; n < name.length; n++) {
    let ch = escapeHtml(name[n]);
    if (searchPosition < search.length && name[n].toLowerCase() === search[searchPosition]) {
      ch = '<b>' + ch + '</b>';
      searchPosition += 1;
    }
    tokens += ch;
  }
  if (searchPosition !== search.length) return escapeHtml(name);
  return tokens;
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function FolderSelectPanelHost() {
  const panelRef = useRef<any>(null);
  const [renderTick, bump] = useState(0);
  const [maxDepth, setMaxDepth] = useState(0);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  const scopeShim = { $evalAsync: () => applyController() };

  useEffect(() => {
    const panel = new FolderSelectPanel({
      scope: scopeShim,
      panelSelector: '#folder-select-panel',
      searchInputSelector: '#folder-select-panel-search-input',
    });
    panelRef.current = panel;

    const bumpAll = () => bump((v: number) => v + 1);

    registerFolderPanelOpener((params: any) => {
      panel.init(params);
      setMaxDepth(panel.listData.maxDepth || 0);
      setTimeout(() => {
        panel.open();
      }, 50);
      bumpAll();
    });

    (window as any).__eagleCollectFolderPanel = panel;
    return () => {
      (window as any).__eagleCollectFolderPanel = null;
    };
  }, []);

  const panel = panelRef.current;
  // open() 之前 panel.listData 尚未初始化（原版类字段 listData = {}）→ 守卫为空模型
  const listData =
    panel && panel.listData && Array.isArray(panel.listData.items)
      ? panel.listData
      : { items: [], currentIndex: -1, searchKeyword: '', selectedIds: {}, currentTab: 'ALL' };
  const theme = controllerScope.theme || 'dark';
  const themePath = theme === 'light' || theme === 'lightgray' ? 'light' : 'dark';
  const isMac = controllerScope.isMac;

  // vs-repeat（vs-excess=30 vs-repeat=26 vs-size=size）+ vs-auto-scroll（index=currentIndex，
  // scroll-container = select-panel-list 自身）。items 引用随 updateItemList 重建 → useMemo 重算；
  // mounted/version 供首挂载与交互后刷新窗口。
  const vr = useVsRepeat(listRef, listData.items, VS_REPEAT_OPTIONS, renderTick * 2 + (mounted ? 1 : 0));
  useVsAutoScroll(listRef, vr, listData.currentIndex);

  const clickItem = (item: any) => {
    if (controllerScope.isCmdOrCtrlPress) {
      controllerScope.isMultipleSelectMode = true;
    }
    if (controllerScope.isMultipleSelectMode) {
      panel.selectItem(item);
    } else {
      panel.collectItem(item);
    }
    applyController();
  };

  return (
    <select-panel
      id="folder-select-panel"
      className={`select-panel folder-select-panel max-depth-${maxDepth} open`}
      onMouseUp={() => panel && panel.focusSearchInput()}
    >
      <div className="panel-header">
        <div className="search">
          <input id="folder-select-panel-search-input" type="search" placeholder={ct('collect-window.folder-select-panel.search-folder')} />
        </div>
        <div className="tabs" style={{ display: 'none' }}>
          <div className="tab" onClick={() => panel.changeTab('ALL')}>
            <img src={`assets/images/${themePath}/icons/ic-folder-select-all.svg`} />
          </div>
          <div className="tab" onClick={() => panel.changeTab('RECENT')}>
            <img src={`assets/images/${themePath}/icons/ic-folder-select-recent.svg`} />
          </div>
        </div>
        <LibrarySwitcher
          theme={theme}
          onLibrarySwitching={() => {
            controllerScope.isLoadingData = true;
            applyController();
          }}
          onLibrarySwitched={() => {
            // 原回调 = initFolderSelect 参数 onLibrarySwitched: () => loadData()
            reloadData();
          }}
          onLibrarySwitchClosed={() => {
            panel && panel.focusSearchInput();
          }}
        />
        <div className="close" onClick={() => panel.close()} />
      </div>

      {listData.items.length === 0 && (
        <div className="panel-empty">
          {listData.currentTab === 'RECENT' && <span>{ct('collect-window.folder-select-panel.empty')}</span>}
        </div>
      )}

      {listData.items.length !== 0 && (
        <div className="panel-list">
          <select-panel-list ref={listRef as any} style={{ overflowY: 'auto' }}>
            {/* vs-repeat before 占位（angular-vs-repeat 插入为首子元素） */}
            <div style={{ height: `${vr.beforeHeight}px` }} />
            {vr.innerItems.map((item: any) => (
              <div
                key={item.index}
                className={`select-panel-item${item.index === listData.currentIndex || item.selected ? ' active' : ''}${
                  listData.selectedIds[item.id] ? ' checked' : ''
                }`}
                onClick={() => clickItem(item)}
                onMouseEnter={() => panel.hoverItem(item.index)}
              >
                {item.type === 'separator' && <div className="separator" />}
                {item.type === 'create' && (
                  <div
                    className={`list-item${item.index === listData.currentIndex ? ' active' : ''}`}
                    style={{ height: 26, lineHeight: '26px' }}
                  >
                    <div className="icon">
                      <div className="fake-svg png" />
                    </div>
                    <div className="name">
                      {ct('collect-window.folder-select-panel.create')} "<b>{item.name}</b>"
                    </div>
                  </div>
                )}
                {item.type === 'all' && (
                  <div
                    className={`list-item${item.index === listData.currentIndex ? ' active' : ''}`}
                    style={{ height: 26, lineHeight: '26px' }}
                  >
                    <div className="icon">
                      <div className="fake-svg png" />
                    </div>
                    <div className="name">{ct('collect-window.folder-select-panel.all')}</div>
                    <div className="right" />
                  </div>
                )}
                {item.type !== 'separator' && item.type !== 'create' && item.type !== 'all' && (
                  <div
                    className={`list-item depth-${item.depth} color-${item.iconColor} has-icon${
                      item.index === listData.currentIndex || listData.selectedIds[item.id] ? ' active' : ''
                    }${listData.selectedIds[item.id] ? ' selected' : ''}${
                      listData.currentTab === 'SELECTED' || (listData.searchKeyword || '').length > 0 ? ' search-mode' : ''
                    }${item.isLast ? ' last' : ''}`}
                    style={{ height: 26, lineHeight: '26px' }}
                    title={item.name}
                    onContextMenu={(e: any) => {
                      e.stopPropagation();
                      panel.openItemSubmenu(item);
                    }}
                  >
                    {!item.isRecent && (
                      <div className="guidelines">
                        {(item.guidelines || []).map(
                          (line: string, gi: number) =>
                            item.depth !== gi && (
                              <div key={gi} className={`guideline color-${line} depth-${gi + 1}`}>
                                <div className="top" />
                                <div className="middle" />
                                <div className="bottom" />
                              </div>
                            )
                        )}
                      </div>
                    )}
                    <div className="icon">
                      <div className="fake-svg png" style={{ '--icon-url': `url(assets/images/folder-icons/ic_${item.icon || 'folder'}.png)` } as any} />
                      {item.isRecent && <div className="history-badge" />}
                    </div>
                    <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(item.name, listData.searchKeyword) }} />
                    <div className="right">
                      {item.parentItem && <div className="parent-name">{item.parentItem.name}</div>}
                      {listData.selectedIds[item.id] && (
                        <div className="icon">
                          <div className="selected" />
                        </div>
                      )}
                      {!listData.searchKeyword && !item.isRecent && (
                        <div
                          className={`ic-btn collapse${!panel.collapsedFolderIds[item.id] ? ' rotate' : ''}${
                            item.isRecent || !item.hasChildren ? ' disabled' : ''
                          }`}
                          onClick={(e: any) => {
                            e.stopPropagation();
                            panel.toggleExpand(item);
                          }}
                        >
                          {!item.isRecent && item.hasChildren && <img src={`assets/images/${themePath}/icons/ic-panel-item-expand.svg`} />}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* vs-repeat after 占位 */}
            <div style={{ height: `${vr.afterHeight}px` }} />
          </select-panel-list>
        </div>
      )}

      <div className="panel-footer">
        {!controllerScope.isMultipleSelectMode && (
          <div className="left">
            <div className="shortcut-tip">
              {ct('collect-window.folder-select-panel.shortcut.multi-select')}
              <key>{isMac ? '⌘' : 'Ctrl'}</key>
            </div>
            <div className="shortcut-tip">
              {ct('collect-window.folder-select-panel.shortcut.move')}
              <div className="keys">
                <key>↑</key>
                <key>↓</key>
              </div>
            </div>
            <div className="shortcut-tip">
              {ct('collect-window.folder-select-panel.shortcut.select')}
              <key>︎⏎</key>
            </div>
          </div>
        )}
        {controllerScope.isMultipleSelectMode && (
          <div
            className="collect-btn"
            onClick={() => {
              const selectedItems = panel.getSelectedItems();
              panel.collectItems(selectedItems);
            }}
          >
            <div className="icon download" />
            <span>{ct('collect-window.folder-select-panel.collect')}</span>
          </div>
        )}
      </div>
    </select-panel>
  );
}


/* ---- library-switcher（library-switcher.js 83 行 + 模板逐字） ---- */

export function LibrarySwitcher({ theme, onLibrarySwitching, onLibrarySwitched, onLibrarySwitchClosed }: any) {
  const [currentLibrary, setCurrentLibrary] = useState<any>(null);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eagle = (window as any).eagle;
    eagle.library
      .info()
      .then((info: any) => {
        setCurrentLibrary(info.library || { name: '', path: '' });
      })
      .catch(() => setCurrentLibrary({ name: '', path: '' }));
  }, []);

  const extractLibraryName = (libPath: string) => {
    const match = libPath.match(/([^\/]+)\.library$/);
    return match ? match[1] : libPath.split('/').pop();
  };

  const onClick = async () => {
    const eagle = (window as any).eagle;
    const current = await eagle.library.info();
    const currentPath = current.library.path;
    const libraryPatches = await eagle.library.history();

    ContextMenu.open({
      showSearch: true,
      items: libraryPatches.map((libraryPath: string) => {
        const libraryName = extractLibraryName(libraryPath);
        const parentFolderPath = libraryPath.replace(/[^/]+\.library$/, '');
        void parentFolderPath;
        const libraryImage = 'http://localhost:41595/api/library/icon?libraryPath=' + encodeURIComponent(libraryPath);
        const fallbackImage = 'assets/images/base/icons/default-library-icon.png';
        return {
          label: libraryName,
          disabled: libraryPath === currentPath,
          checked: libraryPath === currentPath,
          image: libraryImage,
          fallbackImage,
          click: async () => {
            onLibrarySwitching();
            let targetLibraryPath = libraryPath;
            await eagle.library
              .switchPromise(libraryPath)
              .catch(() => {
                targetLibraryPath = currentPath;
              })
              .finally(() => {
                eagle.library
                  .info()
                  .then((info: any) => setCurrentLibrary(info.library || { name: '', path: '' }))
                  .catch(() => {});
                onLibrarySwitched(targetLibraryPath);
              });
          },
        };
      }),
      onClosed: () => {
        onLibrarySwitchClosed();
      },
    });
  };

  return (
    <div className="library-switcher" ref={elRef} onClick={onClick}>
      <div className="switcher-name">{(currentLibrary && currentLibrary.name) || ''}</div>
      <div className="switcher-icon" />
    </div>
  );
}
