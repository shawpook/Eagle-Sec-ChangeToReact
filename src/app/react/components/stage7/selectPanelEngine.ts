import { $ } from '../detail/detailHooks';
import { t } from '../../global/eagleGlobals';

/**
 * 阶段7d-1c-1：SelectPanel 体系纯类逐字移植（React 组件层见 SelectPanels.tsx）。
 *
 * 规范来源：
 * - TagSelectPanelItem = bundle 56438-56477
 * - SelectPanelSearchInput = bundle 55466-55572
 * - SelectPanel = bundle 55575-55800
 * - TagSelectPanel = bundle 56479-57910
 *
 * 移植约定：
 * - 原 class 内的 this.scope.$evalAsync() 由 notify 回调替代（组件层传入 React 重渲染触发器）。
 * - $panel/$input 与原版一致按 document 级 CSS 选择器取 jQuery 集合（general-tag-select-panel
 *   的 panelSelector/searchInputSelector 即文档级）。
 * - angular.copy → JSON 深拷贝；i18n.__ → t()；tinyPinyin/chineseConvert/pinyinlite/
 *   cartesianProduct/clipboard 等闭包绑定经 window 等价获取。
 * - levenshtein 在原版 sortByKeywordSimilarity 内为局部函数，随函数体逐字带入。
 */

export const deepCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const w = () => window as any;

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

/* ================= TagSelectPanelItem（56438-56477 逐字） ================= */

export class TagSelectPanelItem {
  id: any = null;
  name: any = null;
  type: any = null;
  isInit: any;
  isExist: any;
  color: any = null;
  size = 26;
  group: any = null;
  groupName: any = null;
  groups: any[] = [];
  groupsMap: any = {};
  pinyin: any = null;
  imageCount = 0;
  isRecent = false;
  isStarred = false;
  isSuggestion = false;
  index: any = null;

  constructor(obj: any) {
    const { id, name, type, color, size, group, groupName, groups, groupsMap, pinyin, imageCount, isRecent, isStarred, isSuggestion, index } = obj;
    try {
      this.isInit = false;
      this.id = id?.replace(/\\/g, '_') ?? '';
      this.name = name ?? '';
      this.type = type ?? null;
      this.color = color ?? null;
      this.size = size ?? 26;
      this.group = group ?? null;
      this.groupName = groupName ?? null;
      this.groups = groups ?? [];
      this.groupsMap = groupsMap ?? {};
      this.pinyin = pinyin ?? '';
      this.imageCount = imageCount ?? 0;
      this.isRecent = isRecent ?? false;
      this.isStarred = isStarred ?? false;
      this.isSuggestion = isSuggestion ?? false;
      this.index = index ?? null;
    } catch (err) {
      console.error(err);
    }
  }
}

/* ================= SelectPanelSearchInput（55466-55572 逐字） ================= */

export class SelectPanelSearchInput {
  enterKeydown: any;
  escKeydown: any;
  $input: any;
  onChange: any;
  onEnterKey: any;
  onEscKey: any;
  onTabKey: any;
  onUpKey: any;
  onDownKey: any;
  onLeftKey: any;
  onRightKey: any;
  onPaste: any;

  constructor(params: any) {
    // $ 是返回 window.jQuery 的工厂，必须双调用（7a 教训）
    this.$input = $()(params.selector);
    this.onChange = params.onChange || function () {};
    this.onEnterKey = params.onEnterKey || function () {};
    this.onEscKey = params.onEscKey || function () {};
    this.onTabKey = params.onTabKey || function () {};
    this.onUpKey = params.onUpKey || function () {};
    this.onDownKey = params.onDownKey || function () {};
    this.onLeftKey = params.onLeftKey || function () {};
    this.onRightKey = params.onRightKey || function () {};
    this.onPaste = params.onPaste || function () {};
    this.enterKeydown = false;
    this.escKeydown = false;

    // HACK: 中文輸入法的 enter 不會有完整的 keydown + keyup，所以這邊用 enterKeydown 確保是一次完整的 enter keydown + keyup 事件
    this.$input.off('keyup').on('keyup', (event: any) => {
      switch (event.keyCode) {
        case 13: // enter
          if (this.enterKeydown) {
            this.onEnterKey(event);
            this.enterKeydown = false;
          }
          break;
        case 27: // esc
          if (this.escKeydown) {
            event.preventDefault();
            event.stopPropagation();
            this.onEscKey();
            this.escKeydown = false;
          }
          break;
      }
    });

    this.$input.off('keydown').on('keydown', (event: any) => {
      switch (event.keyCode) {
        case 9: // tab
          if (this.onTabKey !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            this.onTabKey(event);
          }
          break;
        case 13: // enter
          event.preventDefault();
          if (event.metaKey || event.ctrlKey) {
            this.onEnterKey(event);
          } else {
            this.enterKeydown = true;
          }
          break;
        case 37: // left
          this.onLeftKey(event);
          break;
        case 39: // right
          this.onRightKey(event);
          break;
        case 38: // up
          event.preventDefault();
          this.onUpKey();
          break;
        case 40: // down
          event.preventDefault();
          this.onDownKey();
          break;
        case 27: // esc
          event.preventDefault();
          this.escKeydown = true;
          break;
        default:
          break;
      }
    });

    this.$input.off('paste').on('paste', (event: any) => {
      this.onPaste(event);
    });

    // off and bing jquery input change event
    this.$input.off('input').on('input', (event: any) => {
      void event;
      this.onChange();
    });
  }

  focus() {
    this.$input.focus();
  }

  blur() {
    this.$input.blur();
  }
}

/* ================= SelectPanel（55575-55800 逐字；scope.$evalAsync → notify） ================= */

export class SelectPanel {
  panelHeight: any;
  onLeftKey: any;
  onRightKey: any;
  fixedSize: any;
  searchInput: any;
  searchKeyword: any;
  listData: any;
  $panel: any;
  onOpened: any;
  onClosed: any;
  notify: any;

  constructor(params: any) {
    this.notify = params.notify || (() => {});
    this.$panel = $()(params.panelSelector);
    this.fixedSize = params.fixedSize ?? false;

    // 初始化搜尋輸入框、回呼函式
    this.searchInput = new SelectPanelSearchInput({
      selector: params.searchInputSelector,
      onChange: () => {
        this.listData.searchKeyword = this.searchInput.$input.val();
        this.keywordChanged();
        this.notify();
      },
      onEnterKey: (event: any) => {
        const item = this.listData?.items?.[this.listData.currentIndex];
        this.openItem(event, item);
        this.notify();
      },
      onEscKey: () => {
        this.close();
        this.notify();
      },
      onTabKey: (event: any) => {
        (this as any).onTabKey(event);
        this.notify();
      },
      onUpKey: (event: any) => {
        (this as any).selectUp(event);
        this.notify();
      },
      onDownKey: (event: any) => {
        (this as any).selectDown(event);
        this.notify();
      },
      onLeftKey: (event: any) => {
        const selectLeftFn = (this as any).selectLeft as any;
        selectLeftFn && selectLeftFn(event);
        this.onLeftKey && this.onLeftKey(event);
        this.notify();
      },
      onRightKey: (event: any) => {
        const selectRightFn = (this as any).selectRight as any;
        selectRightFn && selectRightFn(event);
        this.onRightKey && this.onRightKey(event);
        this.notify();
      },
      onPaste: (event: any) => {
        (this as any).onPaste(event);
        this.notify();
      },
    });
  }

  init(params: any) {
    this.reset();
    this.panelHeight = this.$panel.height();
    // 初始化事件 callbacks
    this.onOpened = params.onOpened || (() => {});
    this.onClosed = params.onClosed || (() => {});
  }

  reset() {
    if (!this.listData) {
      this.listData = {
        items: [],
        currentIndex: -1,
        searchKeyword: '',
      };
    }
    this.listData.items = [];
    this.listData.currentIndex = -1;
    this.listData.searchKeyword = '';
    this.clearSearchInput();
  }

  // 打開 Panel
  open() {
    if (this.$panel.hasClass('open')) {
      this.onOpened && this.onOpened();
      setTimeout(() => {
        this.searchInput.focus();
      }, 50);
      return;
    }
    this.moveToCursorPosition(() => {
      this.$panel.addClass('open');
      this.onOpened && this.onOpened();
      setTimeout(() => {
        this.searchInput.focus();
      }, 50);
    }, 1);
  }

  // 關閉 Panel
  close() {
    (this as any).scrollTop();
    this.$panel.removeClass('open');
    this.searchInput.blur();
    this.reset();
    this.onClosed();
  }

  // 選擇上一個項目
  selectUpBase() {
    if (this.listData.currentIndex > 0) {
      const prevIdx = this.listData.currentIndex - 1;
      const prevItem = this.listData.items[prevIdx];
      if (!prevItem) return;
      this.listData.currentIndex = prevIdx;
      if (!(this.isItemSelectable as any)(prevItem)) {
        this.selectUpBase();
      }
    }
  }

  // 選擇下一個項目
  selectDownBase() {
    if (this.listData.currentIndex < this.listData.items.length - 1) {
      const nextIdx = this.listData.currentIndex + 1;
      const nextItem = this.listData.items[nextIdx];
      if (!nextItem) return;
      this.listData.currentIndex = nextIdx;
      if (!(this.isItemSelectable as any)(nextItem)) {
        this.selectDownBase();
      }
    }
  }

  // 父類不實作，由子類實作
  openItem(event: any, item: any) {
    void event;
    void item;
    throw new Error('You have to implement the method doSomething!');
  }

  onTabKeyBase() {}

  onPasteBase() {}

  // 滑鼠懸停項目
  hoverItemBase(index: any) {
    this.listData.currentIndex = index;
  }

  focusSearchInput() {
    this.searchInput.focus();
  }

  clearSearchInput() {
    this.searchInput.$input.val('');
  }

  keywordChanged() {
    throw new Error('You have to implement the method doSomething!');
  }

  // 判斷項目是否可選擇
  isItemSelectable(item: any) {
    void item;
    throw new Error('You have to implement the method doSomething!');
  }

  scrollTopBase() {
    this.$panel.find('select-panel-list').scrollTop(0);
  }

  moveToCursorPosition(callback: any, retry: number) {
    const jQuery = $();
    const windowWidth = jQuery(window).width();
    const windowHeight = jQuery(window).height();
    const containerWidth = this.$panel.width();
    const containerHeight = this.$panel.height();
    let x = w().windowMouseX + 10;
    let y = w().windowMouseY - 10;
    let maxHeight = windowHeight; // 初始化最大高度為視窗高度

    // NOTE: 避免尚未完成渲染的時候，取得的 containerHeight 為 0
    if (!this.fixedSize) {
      if (retry < 30 && containerHeight === this.panelHeight) {
        setTimeout(() => {
          this.moveToCursorPosition(callback, retry + 1);
        }, 5);
        return;
      }
    }

    if (w().windowMouseX + containerWidth > windowWidth) {
      x = w().windowMouseX - containerWidth - 20;
    }

    if (w().windowMouseY + containerHeight > windowHeight - 20) {
      y = windowHeight - containerHeight - 20;
      y = y < 20 ? 20 : y;
    } else if (w().windowMouseY - 56 < 0) {
      y = 36;
    }

    maxHeight = windowHeight - y - 80;

    this.$panel.css({
      left: `${x}px`,
      top: `${y}px`,
    });

    // find [select-panel-list] and set max-height
    this.$panel.find('select-panel-list').css({
      'max-height': `${maxHeight - 40}px`, // 設定最大高度
    });

    void maxHeight;
    callback();
  }
}

/* ================= TagSelectPanel（56479-57910 逐字） ================= */

export class TagSelectPanel extends SelectPanel {
  TAG_TYPE = {
    TAG: 'tag',
    CREATE: 'create',
  };

  GROUP_ID = {
    NONE: 'none',
    SELECTED: 'group-selected',
    STARRED: 'group-starred',
    HISTORY: 'group-history',
    SUGGEST: 'group-suggest',
    NORMAL: 'group-normal',
  };

  height: any = localStorage['eagle.tagsPopup.height'] ?? 480;
  width: any = localStorage['eagle.tagsPopup.width'] ?? 320;
  isPined = false;
  isOpenSettings = false;
  isOpened = false;
  groups: any = [];
  originalParams: any;
  rawData: any;
  onChanged: any;
  onAdd: any;
  onRemove: any;
  pinSelected = true;
  // 原版为 (bool) ?? true —— 左侧恒不为 nullish，语义等价于布尔本身
  isShowCount: any = localStorage['eagle.tagsPopup.isShowCount'] !== 'false';
  isShowSidebar: any = localStorage['eagle.tagsPopup.isShowSidebar'] === 'true';
  isShowRecentTags: any = localStorage.getItem('eagle.tagsPopup.isShowRecentTags') !== 'false';
  isShowStarredTags: any = localStorage.getItem('eagle.tagsPopup.isShowStarredTags') !== 'false';
  isShowSuggestedTags: any = localStorage.getItem('eagle.tagsPopup.isShowSuggestedTags') !== 'false';
  showCreateTagBtn: any;

  vsGridLayoutColumnSizes: any = {
    xsmall: 100,
    small: 120,
    medium: 140,
    large: 160,
  };
  vsGridRepeatOptions: any = {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 16,
    columnWidth: this.vsGridLayoutColumnSizes[localStorage['eagle.tagsPopup.columnSize']] ?? 140,
    columnHeight: 26,
    columnGap: 2,
    rowGap: 2,
    extraRange: 500,
    groupLabelHeight: 36,
    squareMode: false,
    listMode: localStorage.getItem('eagle.tagsPopup.listMode') === 'true' || false,
    onScrollStart: () => {
      // 當滾動開始時，添加 scrolling 樣式
      this.$panel.find('select-panel-list').addClass('scrolling');
    },
    onScrollEnd: () => {
      // 當滾動結束時，移除 scrolling 樣式
      this.$panel.find('select-panel-list').removeClass('scrolling');
    },
  };
  // 配置虛擬滾動網格的選項，包括列寬、列高、間距等
  vsGridItems: any[] = [];
  vsGridState: any = {};

  columnSize: any = localStorage['eagle.tagsPopup.columnSize'] ?? 'small';

  static open(params: any) {
    const rootScope = (window as any).angular?.element('html')?.scope?.();
    if (rootScope) {
      rootScope.$broadcast('INSPECTOR.TAG.SELECT.PANEL.OPEN', params);
    }
  }

  constructor(params: any) {
    super(params);
  }

  open() {
    this.$panel.css({
      width: this.width + 'px',
      height: this.height + 'px',
    });
    super.open();
  }

  init(params: any) {
    this.originalParams = params;
    super.init(params);
    this.isOpenSettings = false;
    this.pinSelected = params.pinSelected ?? true;
    this.reset();
    this.initRawData(params);
    this.onChanged = params.onChanged || (() => {});
    this.onAdd = params.onAdd || (() => {});
    this.onRemove = params.onRemove || (() => {});
    this.showCreateTagBtn = params.showCreateTagBtn ?? true;
    this.updateItemList();
  }

  isInit: any;

  reset() {
    super.reset();
    this.isInit = false;
    this.listData.selectedTags = {};
    this.listData.groups = [];
    this.rawData = {
      tags: [],
      tagItemsMap: {},
      tagGroups: [],
      tagGroupsMap: {},
      selectedTags: {},
    };
  }

  // 初始化資料
  initRawData(params: any) {
    this.isInit = false;
    this.rawData = {
      tagManager: params.tagManager,
      tags: deepCopy(params.tagManager.allTags) || [], // 複製所有標籤
      tagItemsMap: {},
      tagGroups: deepCopy(params.tagManager.groups) || [], // 複製所有標籤群組
      tagGroupsMap: {},
      tagGroupsIndexMap: {},
      selectedTags: params.selectedTags || {},
      recentTagsMap: {},
      starredTagsMap: {},
    };

    // 建立 TagGroup map
    this.rawData.tagGroupsMap['none'] = {};
    this.rawData.tagGroups.forEach((tagGroup: any, index: number) => {
      this.rawData.tagGroupsMap[tagGroup.id] = tagGroup;
      this.rawData.tagGroupsIndexMap[tagGroup.id] = index;
    });

    // 建立 item list
    this.rawData.tags.forEach((tag: any) => {
      const { name, pinyin, groups, imageCount } = tag;
      const group = groups[0];
      let groupsMap = groups.reduce((acc: any, cur: any) => {
        acc[cur] = true;
        return acc;
      }, {});

      if (!group) groupsMap['none'] = true;

      const item = new TagSelectPanelItem({
        type: this.TAG_TYPE.TAG,
        id: name,
        name: name,
        color: group ? this.rawData.tagGroupsMap[group].color : undefined,
        size: 26,
        group: group || 'none',
        groupName: null,
        groups: groups,
        groupsMap: groupsMap,
        pinyin: pinyin,
        imageCount: imageCount,
        isRecent: false,
        isStarred: false,
        index: null,
      });

      this.rawData.tagItemsMap[name] = item;
    });

    // 將 selectedTags 中不存在的標籤，加入到 rawData.tags 中
    Object.keys(this.rawData.selectedTags).forEach((name) => {
      if (!this.rawData.tagItemsMap[name]) {
        const item = new TagSelectPanelItem({
          type: this.TAG_TYPE.TAG,
          id: name,
          name: name,
          color: undefined,
          size: 26,
          group: 'none',
          groupName: null,
          groups: [],
          groupsMap: { none: true },
          pinyin: w().tinyPinyin.convertToPinyin(name),
          imageCount: 0,
          isRecent: false,
          isStarred: false,
          index: null,
        });
        this.rawData.tagItemsMap[name] = item;
        this.rawData.tags.push(item);
      }
    });

    // 建立最近使用標籤的映射
    let recentTagIdx = 1;
    const recentTagsMap = params.tagManager.historyTags
      .filter((tag: any) => this.rawData.tagItemsMap[tag] !== undefined)
      .slice(0, 12)
      .reduce((acc: any, cur: any) => {
        acc[cur] = recentTagIdx++;
        return acc;
      }, {});
    this.rawData.recentTagsMap = recentTagsMap;

    // 建立最愛標籤的映射
    this.rawData.starredTagsMap = {};
    params.tagManager.starredTags.forEach((tag: any) => {
      this.rawData.starredTagsMap[tag] = true;
    });

    // 設定預設已選擇的標籤
    this.listData.selectedTags = { ...this.rawData.selectedTags };
    this.listData.tagGroups = this.rawData.tagGroups;
    this.listData.tagGroupsCountMap = {};

    // 更新標籤狀態
    this.updateTagsState();
    this.isInit = true;
  }

  updateTagsState() {
    let tagsItems: any[] = []; // 全部標籤
    let suggestionTags: any[] = []; // 推薦的標籤
    let suggestionMap: any = {}; // 推薦的標籤映射

    // 確保 suggestions 存在
    this.rawData.tagManager.suggestions = this.rawData.tagManager.suggestions || [];

    // 處理推薦標籤
    this.rawData.tagManager.suggestions.forEach((tag: any) => {
      const existTagItem = this.rawData.tagItemsMap[tag];
      const suggestionItem = new TagSelectPanelItem({
        id: `suggestion-${tag}`,
        type: this.TAG_TYPE.TAG,
        isSuggestion: true,
        isExist: !!existTagItem,
        name: existTagItem?.name ?? tag,
        color: existTagItem?.color ?? undefined,
        size: 26,
        index: null,
        group: existTagItem?.group ?? 'none',
        groupName: existTagItem?.groupName ?? null,
        groups: existTagItem?.groups ?? undefined,
        groupsMap: existTagItem?.groupsMap ?? {},
        pinyin: existTagItem?.pinyin ?? undefined,
        imageCount: existTagItem?.imageCount ?? undefined,
      });
      suggestionMap[tag] = suggestionItem;
      suggestionTags.push(suggestionItem);
    });

    // 處理全部標籤
    this.rawData.tags.forEach((tag: any) => {
      const { name } = tag;
      const item = this.rawData.tagItemsMap[name];
      const { recentTagsMap, starredTagsMap } = this.rawData;
      if (!item.isSuggestion || (!this.isShowSuggestedTags && !suggestionMap[name])) {
        // 更新標籤狀態
        const newItem = new TagSelectPanelItem({
          id: item.id,
          type: item.type,
          isExist: item.isExist,
          name: item?.name ?? tag,
          color: item?.color ?? undefined,
          size: 26,
          index: item.index,
          group: item?.group ?? 'none',
          groupName: item?.groupName ?? null,
          groups: item?.groups ?? undefined,
          groupsMap: item?.groupsMap ?? {},
          pinyin: item.pinyin,
          imageCount: item.imageCount,
          isRecent: recentTagsMap[name],
          isStarred: starredTagsMap[name],
          isSuggestion: suggestionMap[name],
        });
        tagsItems.push(newItem);
      }
    });

    // 將最愛標籤但數量為 0 的標籤加入到標籤列表中
    if (this.rawData.tagManager.starredTags.length > 0) {
      this.rawData.tagManager.starredTags.forEach((tag: any) => {
        const existTagItem = this.rawData.tagItemsMap[tag];
        if (existTagItem) return;

        const starredItem = new TagSelectPanelItem({
          id: `starred-${tag}`,
          type: this.TAG_TYPE.TAG,
          isStarred: true,
          isExist: false,
          name: tag,
          color: undefined,
          size: 26,
          index: null,
        });

        tagsItems.push(starredItem);
      });
    }

    // 更新原始數據中的推薦標籤和全部標籤
    this.rawData.suggestionTags = suggestionTags;
    this.rawData.tagItems = tagsItems;
  }

  // 建立 View Model 使用的資料，並更新畫面
  updateItemList() {
    this.resetListData();

    let tags = this.rawData.tagItems;

    const searchKeyword = this.listData.searchKeyword;
    const showCreateTagBtn = this.showCreateTagBtn && searchKeyword !== '' && !this.rawData.tags.some((tag: any) => tag.name === searchKeyword);

    // 如果有推薦標籤，將其加入標籤列表
    if (this.isShowSuggestedTags && this.rawData.suggestionTags.length > 0) {
      tags = [...this.rawData.suggestionTags, ...tags];
    }

    // 根據標籤的屬性進行排序
    tags = tags.sort((a: any, b: any) => {
      if (this.isShowStarredTags) {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
      }

      if (this.isShowRecentTags) {
        if (a.isRecent && b.isRecent) {
          if (this.rawData.recentTagsMap[a.name] < this.rawData.recentTagsMap[b.name]) return -1;
          if (this.rawData.recentTagsMap[a.name] > this.rawData.recentTagsMap[b.name]) return 1;
        }
      }

      // 只有在顯示推薦標籤時才優先排序推薦標籤
      if (this.isShowSuggestedTags) {
        if (a.isSuggestion && !b.isSuggestion) return -1;
        if (!a.isSuggestion && b.isSuggestion) return 1;
      }

      if (this.isShowRecentTags) {
        if (a.isRecent && !b.isRecent) return -1;
        if (!a.isRecent && b.isRecent) return 1;
      }

      const aName = a.name;
      const bName = b.name;
      const aGroup = a.group !== 'none' ? a.group : undefined;
      const bGroup = b.group !== 'none' ? b.group : undefined;

      if (aGroup === bGroup) {
        if (aName < bName) return -1;
        if (aName > bName) return 1;
      }

      const aGroupIdx = this.rawData.tagGroupsIndexMap[aGroup];
      const bGroupIdx = this.rawData.tagGroupsIndexMap[bGroup];
      if (!aGroup && bGroup) return 1;
      if (aGroup && !bGroup) return -1;
      if (aGroupIdx < bGroupIdx) return -1;
      if (aGroupIdx > bGroupIdx) return 1;

      return 0;
    });

    // 根據關鍵字過濾標籤
    tags = this.filterByKeyword(tags);

    // 計算每個群組的標籤數量
    const temp = [...tags];
    this.listData.tagGroupsCountMap = {};
    this.listData.tagGroupsCountMap['all'] = temp.length;
    temp.forEach((item: any) => {
      Object.keys(item.groupsMap).forEach((group) => {
        if (this.listData.tagGroupsCountMap[group] === undefined) {
          this.listData.tagGroupsCountMap[group] = 0;
        }
        this.listData.tagGroupsCountMap[group]++;
      });
    });

    // 根據群組過濾標籤
    tags = this.filterByGroup(tags);

    // 初始化各個群組
    const selectedGroup: any = { id: this.GROUP_ID.SELECTED, items: [], isCollapsed: false, name: t('selectTagPanel.label.selected') };
    const starredGroup: any = { id: this.GROUP_ID.STARRED, items: [], isCollapsed: false, name: t('selectTagPanel.label.starred') };
    const historyGroup: any = { id: this.GROUP_ID.HISTORY, items: [], isCollapsed: false, name: t('selectTagPanel.label.recent') };
    const suggestGroup: any = { id: this.GROUP_ID.SUGGEST, items: [], isCollapsed: false, name: t('selectTagPanel.label.recommend') };
    const normalGroup: any = { id: this.GROUP_ID.NORMAL, items: [], isCollapsed: false, name: t('selectTagPanel.label.others') };
    const tagGroupsMaps: any = {};
    const tagGroups = this.rawData.tagGroups.map((group: any) => {
      const g = {
        id: group.id,
        name: group.name,
        color: group.color,
        isCollapsed: false,
        items: [],
      };
      tagGroupsMaps[group.id] = g;
      return g;
    });

    const historyTags: any[] = [];
    const suggestTags: any[] = [];
    const normalTags: any[] = [];
    const starredTags: any[] = [];

    // 將標籤分類到不同的群組
    tags.forEach((item: any) => {
      if (item.type !== this.TAG_TYPE.TAG) return;
      if (!item.isRecent && !item.isSuggestion && !item.isStarred) {
        normalTags.push(item);
      } else {
        if (item.isStarred) {
          if (this.isShowStarredTags) {
            starredTags.push(item);
          } else {
            normalTags.push(item);
          }
        } else if (item.isRecent) {
          if (this.isShowRecentTags) {
            historyTags.push(item);
          } else {
            normalTags.push(item);
          }
        } else if (item.isSuggestion) {
          if (this.isShowSuggestedTags) {
            suggestTags.push(item);
          } else {
            normalTags.push(item);
          }
        }
      }
    });

    if (starredTags.length > 0) {
      starredGroup.items = [...starredTags];
    }

    if (historyTags.length > 0) {
      historyGroup.items = [...historyTags];
    }

    if (suggestTags.length > 0) {
      suggestGroup.items = [...suggestTags];
    }

    if (normalTags.length > 0) {
      normalTags.forEach((tag: any) => {
        if (tagGroupsMaps[tag.group]) {
          tagGroupsMaps[tag.group].items.push(tag);
        } else {
          normalGroup.items.push(tag);
        }
      });
    }

    // 如果有搜尋關鍵字，則顯示搜尋結果
    if (searchKeyword) {
      const items: any[] = [];

      // 建立標籤按鈕
      if (showCreateTagBtn) {
        items.push(
          new TagSelectPanelItem({
            id: `create-${encodeURIComponent(searchKeyword)}`,
            type: this.TAG_TYPE.CREATE,
            size: 26,
            name: searchKeyword,
          })
        );
      }

      // 最愛標籤
      if (this.isShowStarredTags && starredTags.length > 0) {
        Array.prototype.push.apply(items, starredGroup.items);
      }

      // 最近使用標籤
      if (this.isShowRecentTags && historyTags.length > 0) {
        Array.prototype.push.apply(items, historyGroup.items);
      }

      // 推薦標籤
      if (this.isShowSuggestedTags && suggestTags.length > 0) {
        Array.prototype.push.apply(items, suggestGroup.items);
      }

      items.forEach((item: any, index: number) => {
        item.index = index;
        item.groupName = 'group-default';
      });

      // 群組標籤
      tagGroups.forEach((group: any) => {
        if (group.items.length > 0) {
          Array.prototype.push.apply(items, group.items);
        }
      });

      // 其它標籤
      if (normalGroup.items.length > 0) {
        Array.prototype.push.apply(items, normalGroup.items);
      }

      this.listData.groups = [
        {
          id: 'group-default',
          items: items,
        },
      ];

      // 根據關鍵字相似度排序
      this.listData.groups[0].items = this.sortByKeywordSimilarity(this.listData.groups[0].items, searchKeyword);

      this.listData.groupsMap['group-default'] = this.listData.groups[0];

      this.listData.currentGroup = this.listData.groups[0];
    } else {
      this.listData.groups = [];

      // 最愛標籤
      if (this.isShowStarredTags && starredGroup.items.length > 0) {
        this.listData.groups.push(starredGroup);
      }

      // 最近使用標籤
      if (this.isShowRecentTags && historyGroup.items.length > 0) {
        this.listData.groups.push(historyGroup);
      }

      // 推薦標籤
      if (this.isShowSuggestedTags && suggestGroup.items.length > 0) {
        this.listData.groups.push(suggestGroup);
      }

      // 群組標籤
      tagGroups.forEach((group: any) => {
        if (group.items.length > 0) {
          this.listData.groups.push(group);
        }
      });

      // 其它標籤
      if (normalGroup.items.length > 0) {
        this.listData.groups.push(normalGroup);
      }

      // 預設選擇第一個群組
      this.listData.currentGroup = this.listData.groups.find((group: any) => !group.isCollapsed) ?? this.listData.groups[0];
    }

    // 更新項目在群組中的索引
    this.listData.groups.forEach((group: any) => {
      group.isCollapsed = localStorage[`eagle.tagsPopup.collapsedGroup.${group.id}`] === 'true' || false;
      group.items.forEach((item: any, index: number) => {
        item.index = index;
        item.groupName = group.id;
      });
      this.listData.groupsMap[group.id] = group;
    });

    // 決定默認選擇的項目
    this.decideDefaultSelectedItem();

    // 智能切換佈局模式
    this.decideLayoutMode();

    this.render();
  }

  resetListData() {
    this.listData.currentIndex = -1;
    this.listData.currentGroup = null;
    this.listData.currentItem = null;
    this.listData.groups = [];
    this.listData.groupsMap = {};
  }

  decideDefaultSelectedItem() {
    // 更新预设选取的项目
    if (this.listData.searchKeyword !== '') {
      const firstItem = this.listData.currentGroup.items.find((item: any) => item.type !== this.TAG_TYPE.CREATE);
      // 有建立按鈕，但搜尋結果第一個項目開頭一樣時，自動選擇該項目
      if (firstItem && firstItem.name.toLowerCase && firstItem.name.toLowerCase().startsWith(this.listData.searchKeyword.toLowerCase())) {
        this.listData.currentIndex = firstItem.index;
      }
      // 搜尋結果有內容時，自動選擇第一個項目
      else if (this.listData.currentGroup.items.length > 0) {
        this.listData.currentIndex = 0;
      } else {
        this.listData.currentIndex = -1;
      }
    }
    // 如果不是搜尋狀態，就不自動選擇第一個項目
    else {
      this.listData.currentIndex = -1;
    }

    this.listData.currentItem = this.listData.currentGroup?.items?.[this.listData.currentIndex];
  }

  decideLayoutMode() {
    // 如果只有一個群組且只有一個項目，切換成列表模式
    const vsGridRepeatOptions = this.vsGridRepeatOptions;
    if (this.listData.groups.length === 1 && this.listData.groups[0].items.length === 1) {
      vsGridRepeatOptions.listMode = true;
    } else {
      // 否則根據 localStorage 中的設定決定是否使用列表模式
      vsGridRepeatOptions.listMode = localStorage.getItem('eagle.tagsPopup.listMode') === 'true' || false;
    }
  }

  filterByGroup(list: any[]) {
    // 如果沒有選擇側邊欄群組，直接返回原列表
    if (!this.listData.sidebarGroup?.id) return list;
    // 如果側邊欄未顯示，直接返回原列表
    if (!this.isShowSidebar) return list;

    // 過濾列表中的項目，只保留屬於選定群組的項目
    return list.filter((item: any) => {
      try {
        // 檢查項目是否屬於選定的群組
        return item.groupsMap[this.listData.sidebarGroup.id];
      } catch (err) {
        // 如果發生錯誤，記錄錯誤並返回 false
        console.log(err);
        return false;
      }
    });
  }

  filterByKeyword(list: any[]) {
    if (this.listData.searchKeyword.length === 0) return list;

    const { chineseConvert, pinyinlite, cartesianProduct } = loadPinyinModules();
    const keyword_cn = chineseConvert
      .tw2cn(this.listData.searchKeyword)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\ /g, '')
      .toLowerCase();
    const keyword_lower = this.listData.searchKeyword.toLowerCase();
    const groupNameContainsKeyword = list.filter((item: any) => {
      if (this.listData.searchKeyword.length < 2) return false;
      const group = this.rawData.tagGroupsMap[item.groups?.[0]];
      if (!group?.name) return false;
      return group.name.toLowerCase().indexOf(keyword_lower) >= 0;
    });

    const temp = list.map((item: any) => {
      const nameCN = chineseConvert
        .tw2cn(item.name)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (item.name.length >= 30) {
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
            cartesianProduct(pinyinlite(nameCN, { keepUnrecognized: true }).filter((p: any) => p.length > 0)).map((item: any) =>
              item.join(' ')
            )
          ),
        ],
      };
    });

    const scores = temp.map((item: any) => {
      const itemName = `${item.name ?? ''} ${item.keywords ?? ''}`;
      return {
        item: item,
        name: itemName,
        score: Math.max(...item.search.map((pinyin: any) => (pinyin as any).score(keyword_cn))),
      };
    });

    list = scores.filter((i: any) => i.score > 0).map((i: any) => i.item.item);
    list = [...list, ...groupNameContainsKeyword];
    list = [...new Set(list)];

    return list;
  }

  sortByKeywordSimilarity(array: any[], keyword: string) {
    // 檢查兩個字串是否有共同字符
    function hasCommonCharacters(str1: string, str2: string) {
      const set1 = new Set(str1);
      const set2 = new Set(str2);
      for (const char of set1) {
        if (set2.has(char)) {
          return true; // 有共同字符
        }
      }
      return false; // 沒有共同字符
    }

    // 自定義的 Levenshtein 距離計算函數
    function customLevenshtein(a: string, b: string) {
      if (!hasCommonCharacters(a, b)) {
        return Infinity; // 如果沒有共同字符，返回無限大
      }
      return levenshtein(a, b);
    }

    // Levenshtein 距離計算函數
    function levenshtein(a: string, b: string) {
      const matrix: number[][] = [];

      // 初始化矩陣
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      // 填充矩陣
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1]; // 不需要操作
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // 替換
              matrix[i][j - 1] + 1, // 插入
              matrix[i - 1][j] + 1 // 刪除
            );
          }
        }
      }

      return matrix[b.length][a.length];
    }

    return array.sort((tagA: any, tagB: any) => {
      const isACreate = tagA.type === this.TAG_TYPE.CREATE;
      const isBCreate = tagB.type === this.TAG_TYPE.CREATE;

      // 建立標籤按鈕排最前
      if (isACreate && !isBCreate) return -1;
      if (!isACreate && isBCreate) return 1;

      const a = tagA.name;
      const b = tagB.name;

      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const keywordLower = keyword.toLowerCase();

      // 1. 完全相符
      if (aLower === keywordLower) return -1;
      if (bLower === keywordLower) return 1;

      // 2. 包含關鍵字
      const aContains = aLower.includes(keywordLower);
      const bContains = bLower.includes(keywordLower);

      if (aContains && !bContains) return -1;
      if (!aContains && bContains) return 1;

      // 3. 根據出現位置排序
      if (aContains && bContains) {
        const aIndex = aLower.indexOf(keywordLower);
        const bIndex = bLower.indexOf(keywordLower);
        return aIndex - bIndex; // 位置越前的排越前
      }

      // 4. 模糊匹配（使用 Levenshtein 距離）
      const distanceA = customLevenshtein(keywordLower, aLower);
      const distanceB = customLevenshtein(keywordLower, bLower);

      // 當相似度接近時（距離差小于2），優先顯示已有標籤
      if (Math.abs(distanceA - distanceB) < 2) {
        if (!tagA.isSuggestion && tagB.isSuggestion) return -1;
        if (tagA.isSuggestion && !tagB.isSuggestion) return 1;
      }

      return distanceA - distanceB; // 距離越小的排越前
    });
  }

  // 取得回傳結果
  getCallbackResult() {
    const isEqual = (a: any, b: any) => {
      const aEntries = Object.entries(a);
      const bEntries = Object.entries(b);
      return aEntries.length === bEntries.length && aEntries.every(([key, value]) => b[key] === value);
    };

    const isDirty = !isEqual(this.rawData.selectedTags, this.listData.selectedTags);
    const selectedTags = { ...this.listData.selectedTags };
    const deselectedTags = Object.entries(this.rawData.selectedTags).reduce((result: any, [name, isSelected]: any) => {
      if (!this.listData.selectedTags[name]) {
        result[name] = true;
      }
      return result;
    }, {});

    return { isDirty, selectedTags, deselectedTags };
  }

  close() {
    // 如果設定面板是開啟的，則先關閉設定面板
    if (this.isOpenSettings) {
      this.closeSettings();
      return;
    }
    if (this.onChanged) {
      const result = this.getCallbackResult();
      if (result.isDirty) this.onChanged(result);
    }
    super.close();
    this.reset();
  }

  selectGroup(group: any) {
    if (group === 'none') {
      this.listData.sidebarGroup = {
        id: 'none',
      };
    } else {
      this.listData.sidebarGroup = group;
    }
    this.updateItemList();
  }

  onPaste(event: any) {
    // 從剪貼板讀取文本
    const clipboardText = w().require('electron').clipboard.readText();
    if (!clipboardText) return;

    // 解析剪貼板中的文本為標籤
    let tags = this.parseTags(clipboardText);

    // 如果包含多個標籤
    if (tags.length > 1) {
      event.preventDefault();
      event.stopPropagation();

      // 一次最多產生 200 個標籤
      tags = tags.slice(0, 200);

      // 去除標籤中的空白字符
      tags = tags.map((tag: any) => tag.trim());
      // 過濾掉空的標籤
      tags = tags.filter((tag: any) => tag && tag.trim().length > 0);

      tags = tags.reverse();

      // 創建標籤並添加到選擇列表中
      this.createdTags(tags);
      this.onAdd(tags);
    }
  }

  // 滑鼠懸停項目
  hoverItem(event: any, item: any) {
    // 取得當前滑鼠位置
    const currentMouseX = event.clientX;
    const currentMouseY = event.clientY;
    // 取得上一次滑鼠位置
    const lastMouseX = w().windowMouseX;
    const lastMouseY = w().windowMouseY;
    // 計算滑鼠移動距離
    const distance = Math.sqrt(Math.pow(currentMouseX - lastMouseX, 2) + Math.pow(currentMouseY - lastMouseY, 2));
    // 如果滑鼠有移動，更新當前選中的項目
    if (distance !== 0) {
      this.listData.currentItem = item;
      this.listData.currentIndex = item.index;
      this.listData.currentGroup = this.listData.groupsMap[item.group];
    }
  }

  autoScroll() {
    if (this.listData?.currentItem?.id) {
      this.scrollToItem(this.listData.currentItem.id);
    }
  }

  selectPreviousGroup() {
    const currentGroup = this.listData.currentGroup;
    const groups = this.listData.groups;
    const currentGroupIndex = groups.findIndex((group: any) => group.id === currentGroup.id);
    const previousGroup = groups.find((group: any, index: number) => !group.isCollapsed && index < currentGroupIndex);
    if (previousGroup) {
      this.listData.currentGroup = previousGroup;
      this.listData.currentIndex = previousGroup.items.length - 1;
      this.listData.currentItem = previousGroup.items[this.listData.currentIndex];
    }
    this.autoScroll();
  }

  selectNextGroup() {
    const currentGroup = this.listData.currentGroup;
    const groups = this.listData.groups;
    const currentGroupIndex = groups.findIndex((group: any) => group.id === currentGroup.id);
    const nextGroup = groups.find((group: any, index: number) => !group.isCollapsed && index > currentGroupIndex);
    if (nextGroup) {
      this.listData.currentGroup = nextGroup;
      this.listData.currentIndex = 0;
      this.listData.currentItem = nextGroup.items[this.listData.currentIndex];
    }
    this.autoScroll();
  }

  selectUp() {
    // 如果當前群組已折疊，選擇上一個群組
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectPreviousGroup();

    // 取得當前群組的項目和索引
    const columns = parseInt(this.$panel.find('select-panel-list').attr('columns'));
    const currentGroup = this.listData.currentGroup;
    const currentIndex = this.listData.currentIndex;
    const items = currentGroup.items;
    const totalColumns = columns;
    const currentRow = Math.floor(currentIndex / totalColumns);
    const currentColumn = currentIndex % totalColumns;
    const previousRow = currentRow - 1;
    const previousIndex = previousRow * totalColumns + currentColumn;

    // 如果上一個索引有效，更新當前索引和項目
    if (previousIndex >= 0) {
      this.listData.currentIndex = previousIndex;
      this.listData.currentItem = items[previousIndex];
    } else {
      // 如果上一個索引無效，查找上一個未折疊的群組
      const groups = this.listData.groups.filter((group: any) => !group.isCollapsed);

      const previousGroupIndex = groups.findIndex((group: any) => group.id === currentGroup.id) - 1;
      if (previousGroupIndex >= 0 && groups[previousGroupIndex]) {
        const previousGroup = groups[previousGroupIndex];
        const previousGroupItems = previousGroup.items;
        const previousGroupTotalItems = previousGroupItems.length;
        const previousGroupLastRow = Math.floor((previousGroupTotalItems - 1) / totalColumns);
        const previousGroupIndexInSameColumn = previousGroupLastRow * totalColumns + currentColumn;

        // 如果上一個群組的索引在同一列中有效，更新當前索引和項目
        if (previousGroupIndexInSameColumn < previousGroupTotalItems) {
          this.listData.currentIndex = previousGroupIndexInSameColumn;
        } else {
          this.listData.currentIndex = previousGroupTotalItems - 1;
        }

        this.listData.currentGroup = previousGroup;
        this.listData.currentItem = previousGroup.items[this.listData.currentIndex];
      }
    }
    this.autoScroll();
  }

  selectDown() {
    // 如果當前群組已折疊，選擇下一個群組
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectNextGroup();

    // 取得當前群組的項目和索引
    const columns = parseInt(this.$panel.find('select-panel-list').attr('columns'));
    const currentGroup = this.listData.currentGroup;
    const currentIndex = this.listData.currentIndex;
    const items = currentGroup.items;
    const totalItems = items.length;
    const totalGroups = this.listData.groups.length;
    const totalColumns = columns;
    const totalRows = Math.ceil(totalItems / totalColumns);
    const currentRow = Math.floor(currentIndex / totalColumns);
    const currentColumn = currentIndex % totalColumns;
    const nextRow = currentRow + 1;
    const nextIndex = nextRow * totalColumns + currentColumn;

    // 如果下一個索引為 -1，選擇第一個群組的第一個項目
    if (nextIndex === -1) {
      this.listData.currentIndex = 0;
      this.listData.currentGroup = this.listData.groups[0];
      this.listData.currentItem = this.listData.currentGroup.items[this.listData.currentIndex];
    }
    // 如果下一個索引在當前群組內有效，更新當前索引和項目
    else if (nextIndex < totalItems) {
      this.listData.currentIndex = nextIndex;
      this.listData.currentItem = items[nextIndex];
    }
    // 如果下一行在當前群組內有效，選擇當前群組的最後一個項目
    else if (nextRow < totalRows) {
      this.listData.currentIndex = totalItems - 1;
      this.listData.currentItem = items[this.listData.currentIndex];
    }
    // 如果下一行無效，查找下一個未折疊的群組
    else {
      const groups = this.listData.groups.filter((group: any) => !group.isCollapsed);
      const nextGroupIndex = groups.findIndex((group: any) => group.id === currentGroup.id) + 1;
      if (nextGroupIndex < totalGroups && groups[nextGroupIndex]) {
        const nextGroup = groups[nextGroupIndex];
        const nextGroupItems = nextGroup.items;
        const nextGroupItemIndex = currentColumn;

        // 如果下一個群組的索引在同一列中有效，更新當前索引和項目
        if (nextGroupItemIndex < nextGroupItems.length) {
          this.listData.currentIndex = nextGroupItemIndex;
        } else {
          this.listData.currentIndex = 0;
        }

        this.listData.currentGroup = nextGroup;
        this.listData.currentItem = nextGroup.items[this.listData.currentIndex];
      }
    }
    this.autoScroll();
  }

  selectLeft() {
    // 如果當前群組已折疊，選擇上一個群組
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectPreviousGroup();

    // 取得當前群組的項目和索引
    const currentGroup = this.listData.currentGroup;
    const currentIndex = this.listData.currentIndex;
    const items = currentGroup.items;
    const prevItem = items[currentIndex - 1];
    const groups = this.listData.groups.filter((group: any) => !group.isCollapsed);
    const prevGroup = groups.reduce((acc: any, cur: any, index: number) => {
      if (cur.id === currentGroup.id && groups[index - 1]) {
        acc = groups[index - 1];
      }
      return acc;
    }, undefined);

    // 如果上一個項目存在，更新當前索引和項目
    if (prevItem) {
      this.listData.currentIndex = prevItem.index;
      this.listData.currentItem = prevItem;
      this.listData.currentGroup = currentGroup;
    } else {
      // 如果上一個項目不存在，查找上一個未折疊的群組
      if (prevGroup) {
        this.listData.currentGroup = prevGroup;
        this.listData.currentIndex = prevGroup.items.length - 1;
        this.listData.currentItem = this.listData.currentGroup.items[this.listData.currentIndex];
      } else {
        // 如果沒有上一個群組，選擇當前群組的第一個項目
        this.listData.currentIndex = 0;
        this.listData.currentItem = this.listData.currentGroup.items[this.listData.currentIndex];
      }
    }
    this.autoScroll();
  }

  selectRight() {
    // 如果當前群組已折疊，選擇下一個群組
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectNextGroup();

    // 取得當前群組的項目和索引
    const currentGroup = this.listData.currentGroup;
    const currentIndex = this.listData.currentIndex;
    const items = currentGroup.items;
    const nextItem = items[currentIndex + 1];

    // 如果下一個項目存在，更新當前索引和項目
    if (nextItem) {
      this.listData.currentIndex = nextItem.index;
      this.listData.currentItem = nextItem;
      this.listData.currentGroup = currentGroup;
    } else {
      // 如果下一個項目不存在，查找下一個未折疊的群組
      const groups = this.listData.groups.filter((group: any) => !group.isCollapsed);
      const nextGroup = groups.reduce((acc: any, cur: any, index: number) => {
        if (cur.id === currentGroup.id && groups[index + 1]) {
          acc = groups[index + 1];
        }
        return acc;
      }, undefined);
      if (nextGroup) {
        this.listData.currentGroup = nextGroup;
        this.listData.currentIndex = 0;
        this.listData.currentItem = this.listData.currentGroup.items[this.listData.currentIndex];
      }
    }
    this.autoScroll();
  }

  onTabKey(event: any) {
    // 判斷是否按下 Shift 鍵
    const shiftKey = event.shiftKey;
    // 建立群組順序陣列，包含所有標籤群組的 ID 和 'none'
    const order = [undefined, ...this.rawData.tagGroups.map((group: any) => group.id), 'none'];
    // 取得當前選擇的側邊欄群組 ID
    const sidebarGroup = this.listData.sidebarGroup?.id;
    // 取得當前群組在順序陣列中的索引
    const currentIndex = order.indexOf(sidebarGroup);
    // 計算前一個群組的索引
    const prevIndex = (currentIndex - 1) % order.length;
    // 計算下一個群組的索引
    const nextIndex = (currentIndex + 1) % order.length;
    // 根據是否按下 Shift 鍵決定目標群組
    const targetGroup = shiftKey ? order[prevIndex] : order[nextIndex];

    // 如果目標群組為 'none'，設置側邊欄群組為 'none'
    if (targetGroup === 'none') {
      this.listData.sidebarGroup = { id: 'none' };
    }
    // 否則，設置側邊欄群組為目標群組
    else {
      this.listData.sidebarGroup = this.rawData.tagGroupsMap[targetGroup];
    }
    // 更新項目列表
    this.updateItemList();
  }

  openItem(event: any) {
    // 取得當前選中的項目
    const item = this.listData.currentItem;
    // 判斷是否按下 Ctrl 或 Cmd 鍵
    const pressCtrlOrCmd = event?.ctrlKey || event?.metaKey;

    // 如果沒有選中的項目，直接返回
    if (!item) return;

    // 如果選中的項目是 "建立標籤" 按鈕
    if (item.type === this.TAG_TYPE.CREATE) {
      // 解析搜尋關鍵字為標籤
      const tags = this.parseTags(this.listData.searchKeyword);
      // 建立標籤並添加到選擇列表中
      this.createdTags(tags);
      this.onAdd(tags);
    }
    // 如果選中的項目是標籤
    else if (item.type === this.TAG_TYPE.TAG) {
      const name = item.name;
      const selectedTags = this.listData.selectedTags;
      // 如果標籤未被選中，添加標籤
      if (!selectedTags[name]) {
        this.onAdd([name]);
        selectedTags[name] = true;
        // 如果標籤不存在於原始數據中，添加到原始數據中
        if (!this.rawData.tagItemsMap[name]) {
          this.rawData.tagItemsMap[name] = item;
          this.rawData.tags.push(item);
        }
      }
      // 如果標籤已被選中，移除標籤
      else {
        this.onRemove([name]);
        delete selectedTags[name];
        delete this.rawData.recentTagsMap[name];
      }
      // 如果有搜尋關鍵字且未按下 Ctrl 或 Cmd 鍵，清空搜尋關鍵字並更新項目列表
      if (this.listData.searchKeyword !== '' && !pressCtrlOrCmd) {
        this.listData.searchKeyword = '';
        this.clearSearchInput();
        this.updateItemList();
      }
    }
  }

  scrollTop() {
    this.$panel.find('select-panel-list').scrollTop(0);
    this.$panel.find('select-panel-list').trigger('render');
  }

  render() {
    this.$panel.find('select-panel-list').trigger('render');
  }

  keywordChanged() {
    this.updateItemList();
    setTimeout(() => {
      this.scrollTop();
    }, 50);
  }

  scrollToGroup(groupId: any) {
    const itemPositions = this.vsGridItems;
    const top = itemPositions.find((item: any) => item.id === groupId)?.y;

    if (top !== undefined) {
      this.$panel.find('select-panel-list').scrollTop(top);
    }
  }

  scrollToItem(itemId: any) {
    function scrollPageTo(element: any, to: any, duration = 500) {
      //t = current time
      //b = start value
      //c = change in value
      //d = duration
      const easeInOutQuad = (t: number, b: number, c: number, d: number) => {
        t /= d / 2;
        if (t < 1) return (c / 2) * t * t + b;
        t--;
        return (-c / 2) * (t * (t - 2) - 1) + b;
      };

      return new Promise((resolve, reject) => {
        if (typeof to === 'string') {
          to = document.querySelector(to) || reject();
        }
        if (typeof to !== 'number') {
          to = to.getBoundingClientRect().top + element.scrollTop;
        }

        const start = element.scrollTop;
        const change = to - start;
        let currentTime = 0;
        const increment = 20;

        const animateScroll = () => {
          currentTime += increment;
          const val = easeInOutQuad(currentTime, start, change, duration);
          element.scrollTop = val;
          if (currentTime < duration) {
            setTimeout(animateScroll, increment);
          } else {
            resolve(undefined);
          }
        };
        animateScroll();
      });
    }

    const $list = this.$panel.find('select-panel-list');
    const itemPositions = this.vsGridItems;
    const item = itemPositions.find((item: any) => item.id === itemId);

    if (!item) return;

    const itemTop = item.y;
    const itemHeight = item.height;

    const currentScrollTop = $list.scrollTop();
    const isVisible = itemTop >= currentScrollTop && itemTop + itemHeight <= currentScrollTop + $list.height();
    const targetScrollTop = itemTop - $list.height() / 2;

    if (!isVisible) {
      scrollPageTo($list[0], targetScrollTop, 100);
    }
  }

  createdTags(tags: any[]) {
    // 如果標籤數組為空，直接返回
    if (tags.length === 0) return;

    // 去除標籤中的空白字符，並移除重複的標籤
    tags = tags.map((tag) => tag.trim() || tag);
    tags = [...new Set(tags)].reverse();

    // 一次最多產生 200 個標籤
    tags = tags.slice(0, 200);

    // 複製當前選中的標籤
    const selectedTags = { ...this.listData.selectedTags };

    // 取得當前選中的群組
    const group = this.rawData.tagGroupsMap[this?.listData?.sidebarGroup?.id];
    tags.forEach((name) => {
      // 如果標籤已存在於原始數據中，直接標記為選中
      if (this.rawData.tagItemsMap[name]) {
        selectedTags[name] = true;
        return;
      }

      // 設定標籤的群組 ID 和顏色
      const groupID = group ? group.id : 'none';
      const color = group ? group.color : undefined;
      const groups = group ? [group.id] : [];
      let groupsMap = groups.reduce((acc: any, cur: any) => {
        acc[cur] = true;
        return acc;
      }, {});

      // 如果沒有群組，將標籤分配到 'none' 群組
      if (!group) groupsMap['none'] = true;

      // 創建新的標籤項目
      const item = new TagSelectPanelItem({
        type: this.TAG_TYPE.TAG,
        id: name,
        name: name,
        color: color,
        size: 26,
        group: groupID,
        groups: groups,
        groupsMap: groupsMap,
        pinyin: w().tinyPinyin.convertToPinyin(name),
        imageCount: 0,
        isRecent: true,
      });

      // 將新標籤添加到原始數據中
      this.rawData.tagItemsMap[name] = item;
      this.rawData.tags.push(item);
      selectedTags[name] = true;

      Object.keys(this.rawData.recentTagsMap).forEach((key) => {
        this.rawData.recentTagsMap[key] += 1;
      });
      this.rawData.recentTagsMap[name] = 1;

      // 如果有群組，將標籤添加到群組中
      if (group) {
        this.rawData.tagManager.addTagsToGroup(groupID, [name], false);
      }
    });

    // 清空搜尋關鍵字，更新選中的標籤和項目列表
    this.listData.searchKeyword = '';
    this.listData.selectedTags = selectedTags;
    this.clearSearchInput();
    this.updateTagsState();
    this.updateItemList();
  }

  parseTags(str: string) {
    try {
      // 使用正則表達式分割字串，分隔符包括中文逗號、英文逗號、分號、頓號和換行符
      return str.split(/[，,;、\n]+/).filter((tag) => tag.trim().length > 0);
    } catch (e) {
      // 如果解析過程中發生錯誤，返回空陣列
      return [];
    }
  }

  toggleGroup(groupId: any) {
    const group = this.listData.groupsMap[groupId];
    group.isCollapsed = !group.isCollapsed;
    if (group.isCollapsed) {
      localStorage[`eagle.tagsPopup.collapsedGroup.${groupId}`] = group.isCollapsed;
    } else {
      localStorage.removeItem(`eagle.tagsPopup.collapsedGroup.${groupId}`);
    }
    this.render();
  }

  toggleAllGroups(groupId: any) {
    // 根據當前選中的狀態來決定其它群組的狀態
    const group = this.listData.groupsMap[groupId];
    const isCollapsed = !group.isCollapsed;

    // 遍歷所有群組，設定其折疊狀態
    this.listData.groups.forEach((group: any) => {
      group.isCollapsed = isCollapsed;
      if (isCollapsed) {
        // 如果群組是折疊狀態，將其狀態儲存到 localStorage
        localStorage[`eagle.tagsPopup.collapsedGroup.${group.id}`] = group.isCollapsed;
      } else {
        // 如果群組不是折疊狀態，從 localStorage 移除其狀態
        localStorage.removeItem(`eagle.tagsPopup.collapsedGroup.${group.id}`);
      }
    });

    this.render();
  }

  toggleSidebar() {
    this.listData.sidebarGroup = undefined;
    this.isShowSidebar = !this.isShowSidebar;
    this.updateItemList();
    localStorage['eagle.tagsPopup.isShowSidebar'] = this.isShowSidebar;
  }

  toggleCount() {
    this.isShowCount = !this.isShowCount;
    localStorage['eagle.tagsPopup.isShowCount'] = this.isShowCount;
  }

  toggleSuggestedTags() {
    this.isShowSuggestedTags = !this.isShowSuggestedTags;
    this.updateItemList();
    localStorage['eagle.tagsPopup.isShowSuggestedTags'] = this.isShowSuggestedTags;
  }

  toggleRecentTags() {
    this.isShowRecentTags = !this.isShowRecentTags;
    this.updateItemList();
    localStorage['eagle.tagsPopup.isShowRecentTags'] = this.isShowRecentTags;
  }

  toggleStarredTags() {
    this.isShowStarredTags = !this.isShowStarredTags;
    this.updateItemList();
    this.render();
    localStorage['eagle.tagsPopup.isShowStarredTags'] = this.isShowStarredTags;
  }

  setColumnSize(size: any) {
    this.vsGridRepeatOptions.columnWidth = this.vsGridLayoutColumnSizes[size];
    localStorage['eagle.tagsPopup.columnSize'] = size;
  }

  openSettings() {
    this.isOpenSettings = !this.isOpenSettings;
  }

  closeSettings() {
    this.isOpenSettings = false;
  }

  setListMode(listMode: any) {
    this.vsGridRepeatOptions.listMode = listMode;
    localStorage['eagle.tagsPopup.listMode'] = listMode;
  }
}
