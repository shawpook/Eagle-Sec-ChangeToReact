/**
 * 采集窗标签选择面板——tag-select-panel.js（1555）+ tag-select-panel.html（205）无 Angular
 * 逐字移植。阶段9b-2b。
 *
 * 与 7d-1c 引擎（bundle 版）同族分叉：collect 版自管 render（jQuery trigger("render")，9b-2c
 * 接 vs-grid-repeat 前 vsGridItems 为空 → scrollToItem/Group 为 no-op）、suggestions 处理被
 * 注释（NOTE: Collect Window 版本無此功能）、updateItemList 群组名走 locales 词表（原
 * $filter('i18n')）、selectUp/Down 的 columns attr 在无 vs-grid 时为 NaN（原行为等价分支）。
 * initDraggable/initResizable（jQuery UI draggable/resizable，stop 保存尺寸至
 * eagle.tagsPopup.height/width）逐字。onPaste 的裸 `clipboard` 全局未定义（原版怪癖）。
 */

import { useEffect, useRef, useState } from 'react';
import { controllerScope, applyController, ct } from './controller';
import { SelectPanel, panelI18n, cartesianProduct } from './selectPanelEngine';

const $: any = (...args: any[]) => (window as any).jQuery(...args);

function deepCopy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

/* ---- TagSelectPanelItem（1-40 逐字） ---- */

class TagSelectPanelItem {
  id = null as any;
  name = null as any;
  color = null as any;
  size = 26;
  group = null as any;
  groupName = null as any;
  groups: any = [];
  groupsMap: any = {};
  pinyin = null as any;
  imageCount = 0;
  isRecent = false;
  isStarred = false;
  isSuggestion = false;
  index = null as any;
  isInit = false;
  type = null as any;
  isExist: any;

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

/* ---- CollectTagSelectPanel（42-1469 逐字） ---- */

export class CollectTagSelectPanel extends SelectPanel {
  TAG_TYPE: any = { TAG: 'tag', CREATE: 'create' };
  GROUP_ID: any = { NONE: 'none', SELECTED: 'group-selected', STARRED: 'group-starred', HISTORY: 'group-history', SUGGEST: 'group-suggest', NORMAL: 'group-normal' };

  height: any = localStorage['eagle.tagsPopup.height'] ?? 480;
  width: any = localStorage['eagle.tagsPopup.width'] ?? 320;
  isPined = false;
  isOpenSettings = false;
  isOpened = false;
  groups: any = [];
  originalParams: any;
  searchKeyword: any;
  rawData: any;
  onChanged: any;
  onAdd: any;
  onRemove: any;
  pinSelected = true;
  showCreateTagBtn = true;
  isShowCount: any = localStorage['eagle.tagsPopup.isShowCount'] !== 'false';
  isShowSidebar: any = localStorage['eagle.tagsPopup.isShowSidebar'] === 'true';
  isShowRecentTags: any = localStorage.getItem('eagle.tagsPopup.isShowRecentTags') !== 'false';
  isShowStarredTags: any = localStorage.getItem('eagle.tagsPopup.isShowStarredTags') !== 'false';
  isShowSuggestedTags: any = localStorage.getItem('eagle.tagsPopup.isShowSuggestedTags') !== 'false';
  isInit = false;

  vsGridLayoutColumnSizes: any = { xsmall: 100, small: 120, medium: 140, large: 160 };
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
    listMode: localStorage.getItem('eagle.tagsPopup.listMode') === 'true',
    onScrollStart: () => {
      this.$panel.find('select-panel-list').addClass('scrolling');
    },
    onScrollEnd: () => {
      this.$panel.find('select-panel-list').removeClass('scrolling');
    },
  };
  vsGridItems: any = [];
  vsGridState: any = {};
  columnSize: any = localStorage['eagle.tagsPopup.columnSize'] ?? 'small';

  constructor(params: any) {
    super(params);
  }

  open() {
    this.$panel.css({
      width: `${this.width}px`,
      height: `${this.height}px`,
    });
    super.open();
  }

  init(params: any) {
    this.originalParams = params;
    super.init(params);
    this.pinSelected = params.pinSelected ?? true;
    this.reset();
    this.initRawData(params);
    this.onChanged = params.onChanged || (() => {});
    this.onAdd = params.onAdd || (() => {});
    this.onRemove = params.onRemove || (() => {});
    this.showCreateTagBtn = params.showCreateTagBtn ?? true;
    this.updateItemList();
  }

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

  initRawData(params: any) {
    this.isInit = false;
    this.rawData = {
      tagManager: params.tagManager,
      tags: deepCopy(params.tagManager.allTags) || [],
      tagItemsMap: {},
      tagGroups: deepCopy(params.tagManager.groups) || [],
      tagGroupsMap: {},
      tagGroupsIndexMap: {},
      selectedTags: params.selectedTags || {},
      recentTagsMap: {},
      starredTagsMap: {},
    };

    this.rawData.tagGroupsMap['none'] = {};
    this.rawData.tagGroups.forEach((tagGroup: any) => {
      this.rawData.tagGroupsMap[tagGroup.id] = tagGroup;
      this.rawData.tagGroupsIndexMap[tagGroup.id] = this.rawData.tagGroups.indexOf(tagGroup);
    });

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

    Object.keys(this.rawData.selectedTags).forEach((name: string) => {
      if (!this.rawData.tagItemsMap[name]) {
        try {
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
            imageCount: 0,
            isRecent: false,
            isStarred: false,
            index: null,
          });
          this.rawData.tagItemsMap[name] = item;
          this.rawData.tags.push(item);
        } catch (err) {
          console.log(err);
        }
      }
    });

    let recentTagIdx = 1;
    const recentTagsMap = params.tagManager.recentTags
      .filter((tag: string) => this.rawData.tagItemsMap[tag] !== undefined)
      .slice(0, 12)
      .reduce((acc: any, cur: string) => {
        acc[cur] = recentTagIdx++;
        return acc;
      }, {});
    this.rawData.recentTagsMap = recentTagsMap;

    this.rawData.starredTagsMap = {};
    params.tagManager?.starredTags?.forEach((tag: string) => {
      this.rawData.starredTagsMap[tag] = true;
    });

    this.listData.selectedTags = { ...this.rawData.selectedTags };
    this.listData.tagGroups = this.rawData.tagGroups;
    this.listData.tagGroupsCountMap = {};

    this.updateTagsState();
    this.isInit = true;
  }

  updateTagsState() {
    const tagsItems: any[] = [];
    const suggestionTags: any[] = [];
    const suggestionMap: any = {};

    this.rawData.tagManager.suggestions = this.rawData.tagManager.suggestions || [];

    this.rawData.tags.forEach((tag: any) => {
      const { name } = tag;
      const item = this.rawData.tagItemsMap[name];
      const { recentTagsMap, starredTagsMap } = this.rawData;
      if (!item.isSuggestion || (!this.isShowSuggestedTags && !suggestionMap[name])) {
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

    this.rawData.suggestionTags = suggestionTags;
    this.rawData.tagItems = tagsItems;
  }

  updateItemList() {
    this.resetListData();

    let tags = this.rawData.tagItems;

    const searchKeyword = this.listData.searchKeyword;
    const showCreateTagBtn = this.showCreateTagBtn && searchKeyword !== '' && !this.rawData.tags.some((tag: any) => tag.name === searchKeyword);

    if (this.isShowSuggestedTags && this.rawData.suggestionTags.length > 0) {
      tags = [...this.rawData.suggestionTags, ...tags];
    }

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

    tags = this.filterByKeyword(tags);

    const temp = [...tags];
    this.listData.tagGroupsCountMap = {};
    this.listData.tagGroupsCountMap['all'] = temp.length;
    temp.forEach((item: any) => {
      Object.keys(item.groupsMap).forEach((group: string) => {
        if (this.listData.tagGroupsCountMap[group] === undefined) {
          this.listData.tagGroupsCountMap[group] = 0;
        }
        this.listData.tagGroupsCountMap[group]++;
      });
    });

    tags = this.filterByGroup(tags);

    // 原版经 angular injector $filter('i18n')（locales 词表）→ ct 等价
    const selectedGroup: any = { id: this.GROUP_ID.SELECTED, items: [], isCollapsed: false, name: ct('selectTagPanel.label.selected') };
    const starredGroup: any = { id: this.GROUP_ID.STARRED, items: [], isCollapsed: false, name: ct('selectTagPanel.label.starred') };
    const historyGroup: any = { id: this.GROUP_ID.HISTORY, items: [], isCollapsed: false, name: ct('selectTagPanel.label.recent') };
    const suggestGroup: any = { id: this.GROUP_ID.SUGGEST, items: [], isCollapsed: false, name: ct('selectTagPanel.label.recommend') };
    const normalGroup: any = { id: this.GROUP_ID.NORMAL, items: [], isCollapsed: false, name: ct('selectTagPanel.label.others') };
    const tagGroupsMaps: any = {};
    const tagGroups = this.rawData.tagGroups.map((group: any) => {
      const g: any = { id: group.id, name: group.name, color: group.color, isCollapsed: false, items: [] as any[] };
      tagGroupsMaps[group.id] = g;
      return g;
    });

    const historyTags: any[] = [];
    const suggestTags: any[] = [];
    const normalTags: any[] = [];
    const starredTags: any[] = [];

    tags.forEach((item: any) => {
      if (item.type !== this.TAG_TYPE.TAG) return;
      if (!item.isRecent && !item.isSuggestion && !item.isStarred) {
        normalTags.push(item);
      } else {
        if (item.isStarred) {
          if (this.isShowStarredTags) starredTags.push(item);
          else normalTags.push(item);
        } else if (item.isRecent) {
          if (this.isShowRecentTags) historyTags.push(item);
          else normalTags.push(item);
        } else if (item.isSuggestion) {
          if (this.isShowSuggestedTags) suggestTags.push(item);
          else normalTags.push(item);
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

    if (searchKeyword) {
      let items: any[] = [];

      if (showCreateTagBtn) {
        items.push(new TagSelectPanelItem({ id: `create-${encodeURIComponent(searchKeyword)}`, type: this.TAG_TYPE.CREATE, size: 26, name: searchKeyword }));
      }

      if (this.isShowStarredTags && starredTags.length > 0) {
        Array.prototype.push.apply(items, starredGroup.items);
      }
      if (this.isShowRecentTags && historyTags.length > 0) {
        Array.prototype.push.apply(items, historyGroup.items);
      }
      if (this.isShowSuggestedTags && suggestTags.length > 0) {
        Array.prototype.push.apply(items, suggestGroup.items);
      }

      items.forEach((item: any, index: number) => {
        item.index = index;
        item.groupName = 'group-default';
      });

      tagGroups.forEach((group: any) => {
        if (group.items.length > 0) {
          Array.prototype.push.apply(items, group.items);
        }
      });

      if (normalGroup.items.length > 0) {
        Array.prototype.push.apply(items, normalGroup.items);
      }

      this.listData.groups = [{ id: 'group-default', items }];
      this.listData.groups[0].items = this.sortByKeywordSimilarity(this.listData.groups[0].items, searchKeyword);
      this.listData.groupsMap['group-default'] = this.listData.groups[0];
      this.listData.currentGroup = this.listData.groups[0];
    } else {
      this.listData.groups = [];

      if (this.isShowStarredTags && starredGroup.items.length > 0) {
        this.listData.groups.push(starredGroup);
      }
      if (this.isShowRecentTags && historyGroup.items.length > 0) {
        this.listData.groups.push(historyGroup);
      }
      if (this.isShowSuggestedTags && suggestGroup.items.length > 0) {
        this.listData.groups.push(suggestGroup);
      }
      tagGroups.forEach((group: any) => {
        if (group.items.length > 0) {
          this.listData.groups.push(group);
        }
      });
      if (normalGroup.items.length > 0) {
        this.listData.groups.push(normalGroup);
      }

      this.listData.currentGroup = this.listData.groups.find((group: any) => !group.isCollapsed) ?? this.listData.groups[0];
    }

    this.listData.groups.forEach((group: any) => {
      group.isCollapsed = localStorage[`eagle.tagsPopup.collapsedGroup.${group.id}`] === 'true' || false;
      group.items.forEach((item: any, index: number) => {
        item.index = index;
        item.groupName = group.id;
      });
      this.listData.groupsMap[group.id] = group;
    });

    this.decideDefaultSelectedItem();
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
    if (this.listData.searchKeyword !== '') {
      const firstItem = this.listData.currentGroup.items.find((item: any) => item.type !== this.TAG_TYPE.CREATE);
      if (firstItem && firstItem.name.toLowerCase && firstItem.name.toLowerCase().startsWith(this.listData.searchKeyword.toLowerCase())) {
        this.listData.currentIndex = firstItem.index;
      } else if (this.listData.currentGroup.items.length > 0) {
        this.listData.currentIndex = 0;
      } else {
        this.listData.currentIndex = -1;
      }
    } else {
      this.listData.currentIndex = -1;
    }
    this.listData.currentItem = this.listData.currentGroup?.items?.[this.listData.currentIndex];
  }

  decideLayoutMode() {
    const vsGridRepeatOptions = this.vsGridRepeatOptions;
    if (this.listData.groups.length === 1 && this.listData.groups[0].items.length === 1) {
      vsGridRepeatOptions.listMode = true;
    } else {
      vsGridRepeatOptions.listMode = localStorage.getItem('eagle.tagsPopup.listMode') === 'true' || false;
    }
  }

  filterByGroup(list: any[]) {
    if (!this.listData.sidebarGroup?.id) return list;
    if (!this.isShowSidebar) return list;

    return list.filter((item: any) => {
      try {
        return item.groupsMap[this.listData.sidebarGroup.id];
      } catch (err) {
        console.log(err);
        return false;
      }
    });
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
    const keyword_lower = this.listData.searchKeyword.toLowerCase();
    const groupNameContainsKeyword = list.filter((item: any) => {
      if (this.listData.searchKeyword.length < 2) return false;
      const group = this.rawData.tagGroupsMap[item.groups?.[0]];
      if (!group?.name) return false;
      return group.name.toLowerCase().indexOf(keyword_lower) >= 0;
    });

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
          ...new Set(
            cartesianProduct(pinyinlite(nameCN, { keepUnrecognized: true }).filter((p: string) => p.length > 0)).map((parts: string[]) => parts.join(' '))
          ),
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

    list = scores.filter((i: any) => i.score > 0).map((i: any) => i.item.item);
    list = [...list, ...groupNameContainsKeyword];
    list = [...new Set(list)];

    return list;
  }

  sortByKeywordSimilarity(array: any[], keyword: string) {
    function hasCommonCharacters(str1: string, str2: string) {
      const set1 = new Set(str1);
      const set2 = new Set(str2);
      for (const char of set1) {
        if (set2.has(char)) {
          return true;
        }
      }
      return false;
    }

    function levenshtein(a: string, b: string) {
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
          }
        }
      }
      return matrix[b.length][a.length];
    }

    function customLevenshtein(a: string, b: string) {
      if (!hasCommonCharacters(a, b)) {
        return Infinity;
      }
      return levenshtein(a, b);
    }

    return array.sort((tagA: any, tagB: any) => {
      const isACreate = tagA.type === this.TAG_TYPE.CREATE;
      const isBCreate = tagB.type === this.TAG_TYPE.CREATE;

      if (isACreate && !isBCreate) return -1;
      if (!isACreate && isBCreate) return 1;

      const a = tagA.name;
      const b = tagB.name;

      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const keywordLower = keyword.toLowerCase();

      if (aLower === keywordLower) return -1;
      if (bLower === keywordLower) return 1;

      const aContains = aLower.includes(keywordLower);
      const bContains = bLower.includes(keywordLower);

      if (aContains && !bContains) return -1;
      if (!aContains && bContains) return 1;

      if (aContains && bContains) {
        const aIndex = aLower.indexOf(keywordLower);
        const bIndex = bLower.indexOf(keywordLower);
        return aIndex - bIndex;
      }

      const distanceA = customLevenshtein(keywordLower, aLower);
      const distanceB = customLevenshtein(keywordLower, bLower);

      if (Math.abs(distanceA - distanceB) < 2) {
        if (!tagA.isSuggestion && tagB.isSuggestion) return -1;
        if (tagA.isSuggestion && !tagB.isSuggestion) return 1;
      }

      return distanceA - distanceB;
    });
  }

  getCallbackResult() {
    const isEqual = (a: any, b: any) => {
      const aEntries = Object.entries(a);
      const bEntries = Object.entries(b);
      return aEntries.length === bEntries.length && aEntries.every(([key, value]) => (b as any)[key] === value);
    };

    const isDirty = !isEqual(this.rawData.selectedTags, this.listData.selectedTags);
    const selectedTags = { ...this.listData.selectedTags };
    const deselectedTags = Object.entries(this.rawData.selectedTags).reduce((result: any, [name, isSelected]) => {
      if (!this.listData.selectedTags[name]) {
        result[name] = true;
      }
      return result;
    }, {});

    return { isDirty, selectedTags, deselectedTags };
  }

  close() {
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
      this.listData.sidebarGroup = { id: 'none' };
    } else {
      this.listData.sidebarGroup = group;
    }
    this.updateItemList();
  }

  onPaste(_event: any) {
    // 原版裸 `clipboard` 全局在采集窗未定义（ReferenceError 怪癖逐字保留）
    const clipboardText = (window as any).clipboard.readText();
    if (!clipboardText) return;

    let tags = this.parseTags(clipboardText);

    if (tags.length > 1) {
      _event.preventDefault();
      _event.stopPropagation();

      tags = tags.slice(0, 200);
      tags = tags.map((tag: string) => tag.trim());
      tags = tags.filter((tag: string) => tag && tag.trim().length > 0);
      tags = tags.reverse();

      this.createdTags(tags);
      this.onAdd(tags);
    }
  }

  hoverItem(event: any, item: any) {
    const currentMouseX = event.clientX;
    const currentMouseY = event.clientY;
    const mouse = (window as any).__eagleCollectMouseState || { windowMouseX: 0, windowMouseY: 0 };
    const lastMouseX = mouse.windowMouseX;
    const lastMouseY = mouse.windowMouseY;
    const distance = Math.sqrt(Math.pow(currentMouseX - lastMouseX, 2) + Math.pow(currentMouseY - lastMouseY, 2));
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
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectPreviousGroup();

    const columns = parseInt(this.$panel.find('select-panel-list').attr('columns'));
    const currentGroup = this.listData.currentGroup;
    const currentIndex = this.listData.currentIndex;
    const items = currentGroup.items;
    const totalColumns = columns;
    const currentRow = Math.floor(currentIndex / totalColumns);
    const currentColumn = currentIndex % totalColumns;
    const previousRow = currentRow - 1;
    const previousIndex = previousRow * totalColumns + currentColumn;

    if (previousIndex >= 0) {
      this.listData.currentIndex = previousIndex;
      this.listData.currentItem = items[previousIndex];
    } else {
      const groups = this.listData.groups.filter((group: any) => !group.isCollapsed);

      const previousGroupIndex = groups.findIndex((group: any) => group.id === currentGroup.id) - 1;
      if (previousGroupIndex >= 0 && groups[previousGroupIndex]) {
        const previousGroup = groups[previousGroupIndex];
        const previousGroupItems = previousGroup.items;
        const previousGroupTotalItems = previousGroupItems.length;
        const previousGroupLastRow = Math.floor((previousGroupTotalItems - 1) / totalColumns);
        const previousGroupIndexInSameColumn = previousGroupLastRow * totalColumns + currentColumn;

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
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectNextGroup();

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

    if (nextIndex === -1) {
      this.listData.currentIndex = 0;
      this.listData.currentGroup = this.listData.groups[0];
      this.listData.currentItem = this.listData.currentGroup.items[this.listData.currentIndex];
    } else if (nextIndex < totalItems) {
      this.listData.currentIndex = nextIndex;
      this.listData.currentItem = items[nextIndex];
    } else if (nextRow < totalRows) {
      this.listData.currentIndex = totalItems - 1;
      this.listData.currentItem = items[this.listData.currentIndex];
    } else {
      const groups = this.listData.groups.filter((group: any) => !group.isCollapsed);
      const nextGroupIndex = groups.findIndex((group: any) => group.id === currentGroup.id) + 1;
      if (nextGroupIndex < totalGroups && groups[nextGroupIndex]) {
        const nextGroup = groups[nextGroupIndex];
        const nextGroupItems = nextGroup.items;
        const nextGroupItemIndex = currentColumn;

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
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectPreviousGroup();

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

    if (prevItem) {
      this.listData.currentIndex = prevItem.index;
      this.listData.currentItem = prevItem;
      this.listData.currentGroup = currentGroup;
    } else {
      if (prevGroup) {
        this.listData.currentGroup = prevGroup;
        this.listData.currentIndex = prevGroup.items.length - 1;
        this.listData.currentItem = this.listData.currentGroup.items[this.listData.currentIndex];
      } else {
        this.listData.currentIndex = 0;
        this.listData.currentItem = this.listData.currentGroup.items[this.listData.currentIndex];
      }
    }
    this.autoScroll();
  }

  selectRight() {
    if (this?.listData?.currentGroup?.isCollapsed) return this.selectNextGroup();

    const currentGroup = this.listData.currentGroup;
    const currentIndex = this.listData.currentIndex;
    const items = currentGroup.items;
    const nextItem = items[currentIndex + 1];

    if (nextItem) {
      this.listData.currentIndex = nextItem.index;
      this.listData.currentItem = nextItem;
      this.listData.currentGroup = currentGroup;
    } else {
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
    const shiftKey = event.shiftKey;
    const order = [undefined, ...this.rawData.tagGroups.map((group: any) => group.id), 'none'];
    const sidebarGroup = this.listData.sidebarGroup?.id;
    const currentIndex = order.indexOf(sidebarGroup);
    const prevIndex = (currentIndex - 1) % order.length;
    const nextIndex = (currentIndex + 1) % order.length;
    const targetGroup = shiftKey ? order[prevIndex] : order[nextIndex];

    if (targetGroup === 'none') {
      this.listData.sidebarGroup = { id: 'none' };
    } else {
      this.listData.sidebarGroup = this.rawData.tagGroupsMap[targetGroup];
    }
    this.updateItemList();
  }

  openItem(event: any) {
    const item = this.listData.currentItem;
    const pressCtrlOrCmd = event?.ctrlKey || event?.metaKey;

    if (!item) return;

    if (item.type === this.TAG_TYPE.CREATE) {
      const tags = this.parseTags(this.listData.searchKeyword);
      this.createdTags(tags);
      this.onAdd(tags);
    } else if (item.type === this.TAG_TYPE.TAG) {
      const name = item.name;
      const selectedTags = this.listData.selectedTags;
      if (!selectedTags[name]) {
        this.onAdd([name]);
        selectedTags[name] = true;
        if (!this.rawData.tagItemsMap[name]) {
          this.rawData.tagItemsMap[name] = item;
          this.rawData.tags.push(item);
        }
      } else {
        this.onRemove([name]);
        delete selectedTags[name];
        delete this.rawData.recentTagsMap[name];
      }
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

  scrollToGroup(groupId: string) {
    const itemPositions = this.vsGridItems;
    const top = itemPositions.find((item: any) => item.id === groupId)?.y;

    if (top !== undefined) {
      this.$panel.find('select-panel-list').scrollTop(top);
    }
  }

  scrollToItem(itemId: string) {
    function scrollPageTo(element: any, to: any, duration = 500) {
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

  createdTags(tags: string[]) {
    if (tags.length === 0) return;

    tags = tags.map((tag) => tag.trim() || tag);
    tags = [...new Set(tags)].reverse();
    tags = tags.slice(0, 200);

    let selectedTags = { ...this.listData.selectedTags };

    const group = this.rawData.tagGroupsMap[this?.listData?.sidebarGroup?.id];
    tags.forEach((name: string) => {
      if (this.rawData.tagItemsMap[name]) {
        selectedTags[name] = true;
        return;
      }

      const groupID = group ? group.id : 'none';
      const color = group ? group.color : undefined;
      const groups = group ? [group.id] : [];
      let groupsMap = groups.reduce((acc: any, cur: string) => {
        acc[cur] = true;
        return acc;
      }, {});

      if (!group) groupsMap['none'] = true;

      const item = new TagSelectPanelItem({
        type: this.TAG_TYPE.TAG,
        id: name,
        name: name,
        color: color,
        size: 26,
        group: groupID,
        groups: groups,
        groupsMap: groupsMap,
        imageCount: 0,
        isRecent: true,
      });

      this.rawData.tagItemsMap[name] = item;
      this.rawData.tags.push(item);
      selectedTags[name] = true;

      Object.keys(this.rawData.recentTagsMap).forEach((key: string) => {
        this.rawData.recentTagsMap[key] += 1;
      });
      this.rawData.recentTagsMap[name] = 1;
    });

    this.listData.searchKeyword = '';
    this.listData.selectedTags = selectedTags;
    this.clearSearchInput();
    this.updateTagsState();
    this.updateItemList();
  }

  parseTags(str: string) {
    try {
      return str.split(/[，,;、\n]+/).filter((tag) => tag.trim().length > 0);
    } catch (e) {
      return [];
    }
  }

  toggleGroup(groupId: string) {
    const group = this.listData.groupsMap[groupId];
    group.isCollapsed = !group.isCollapsed;
    if (group.isCollapsed) {
      localStorage[`eagle.tagsPopup.collapsedGroup.${groupId}`] = group.isCollapsed;
    } else {
      localStorage.removeItem(`eagle.tagsPopup.collapsedGroup.${groupId}`);
    }
    this.render();
  }

  toggleAllGroups(groupId: string) {
    const group = this.listData.groupsMap[groupId];
    const isCollapsed = !group.isCollapsed;

    this.listData.groups.forEach((g: any) => {
      g.isCollapsed = isCollapsed;
      if (isCollapsed) {
        localStorage[`eagle.tagsPopup.collapsedGroup.${g.id}`] = g.isCollapsed;
      } else {
        localStorage.removeItem(`eagle.tagsPopup.collapsedGroup.${g.id}`);
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

  setColumnSize(size: string) {
    this.vsGridRepeatOptions.columnWidth = this.vsGridLayoutColumnSizes[size];
    localStorage['eagle.tagsPopup.columnSize'] = size;
  }

  openSettings() {
    this.isOpenSettings = !this.isOpenSettings;
  }

  closeSettings() {
    this.isOpenSettings = false;
  }

  setListMode(listMode: boolean) {
    this.vsGridRepeatOptions.listMode = listMode;
    localStorage['eagle.tagsPopup.listMode'] = listMode;
  }
}
