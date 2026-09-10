import { FileUrlHelper } from '../../core/fileUrlHelper';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../global/eagleGlobals';
import { useVirtualWindow } from '../sidebar/Sidebar';
import { fuzzyMatchHtml } from './ContextMenu';
import { ExtIcon } from '../inspector/Inspector';
import { max, uniq } from '../../utils/lang';
import { getBodyScope, getRootScope, scopeApply } from '../../core/appCore';
import { machineryChangeSidebarIndex } from '../../core/dataMachinery';
import { openItemLocation } from '../../core/itemDomain';
import { openFolder, openSmartFolder } from '../../services/folderCoreService';
import { openTag } from '../../services/batchOpsService';
import { closeQuickSearch } from '../../core/filterDomain';
import { closeQuickSearchModalChannel, openQuickSearchModalChannel } from '../../global/bus';
import { scopeEvalAsync } from '../../global/scopeShim';
/**
 * 阶段7c-2：quickSearchModal 接管。
 *
 * 规范 = js/directives/quick-search-modal.html 逐字转写；link 逻辑 = bundle 60788-61393。
 * isolate scope（scope: {}）语义逐条对齐：模板里的 folderList/tags/smartFolderList/all
 * 在原版 isolate scope 上不可达（计数 span 永远 ng-show=false），这里保持同样的隐藏形态；
 * $parentScope 一律经 getBodyScope() 取活对象，openFolder/openTag/openSmartFolder/
 * openItemLocation/changeSidebarIndex/closeQuickSearch 均调回 body scope 同名函数。
 * 触发通道不变：OPEN_QUICK_SEARCH_MODAL / CLOSE_QUICK_SEARCH_MODAL 广播（sidebar J 按钮
 * 与 Mousetrap 'j' 仍走原 $scope.openQuickSearch）。
 * localStorage 键不变：eagle.quickSearch.history / .folder.history / .smartFolder.history。
 * 快照源与快捷键数据的拼音/模糊过滤原样移植（chineseConvert/pinyinlite/cartesianProduct/
 * String.prototype.score/fuzzy_match），pinyinlite 与 cartesianProduct 为 bundle 闭包内
 * require 的模块，这里经 window.require(appRoot.path + '/my_modules/...') 等价加载。
 * 原作用域上的死代码 quickSearchFilter/quickSearchOrder（模板无消费点）不移植。
 */

/* Angular 插值语义：undefined/null → ''。 */
const iv = (v: any): any => (v === undefined || v === null ? '' : v);

/** Angular date 过滤器（本文件只用 yyyy/MM/dd HH:mm）。 */
const angDate = (value: any, format: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  if (format !== 'yyyy/MM/dd HH:mm') return `${d.getFullYear()}`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ngShow = (show: boolean) => (show ? undefined : { display: 'none' } as React.CSSProperties);

const loadPinyinModules = () => {
  try {
    const w = window as any;
    return {
      pinyinlite: w.__eaglePinyinlite || (w.__eaglePinyinlite = w.require((w.appRoot && w.appRoot.path || '.') + '/my_modules/pinyinlite')),
      cartesianProduct: w.__eagleCartesianProduct || (w.__eagleCartesianProduct = w.require((w.appRoot && w.appRoot.path || '.') + '/my_modules/cartesian-product')),
    };
  } catch (err) {
    return { pinyinlite: null, cartesianProduct: null };
  }
};

const getQuickSearchFolderHistory = (): any[] => {
  try {
    const raw = localStorage.getItem('eagle.quickSearch.folder.history');
    if (raw) return JSON.parse(raw);
  } catch (err) {}
  return [];
};

const addQuickSearchFolderHistory = (folderId: any) => {
  let quickSearchFolderHistory = getQuickSearchFolderHistory();
  quickSearchFolderHistory.unshift(folderId);
  quickSearchFolderHistory = [...new Set(quickSearchFolderHistory)];
  if (quickSearchFolderHistory.length > 200) {
    quickSearchFolderHistory.length = 200;
  }
  localStorage.setItem('eagle.quickSearch.folder.history', JSON.stringify(quickSearchFolderHistory));
};

const getQuickSearchSmartFolderHistory = (): any[] => {
  try {
    const raw = localStorage.getItem('eagle.quickSearch.smartFolder.history');
    if (raw) return JSON.parse(raw);
  } catch (err) {}
  return [];
};

const addQuickSearchSmartFolderHistory = (smartFolderId: any) => {
  let quickSearchSmartFolderHistory = getQuickSearchSmartFolderHistory();
  quickSearchSmartFolderHistory.unshift(smartFolderId);
  quickSearchSmartFolderHistory = [...new Set(quickSearchSmartFolderHistory)];
  if (quickSearchSmartFolderHistory.length > 200) {
    quickSearchSmartFolderHistory.length = 200;
  }
  localStorage.setItem('eagle.quickSearch.smartFolder.history', JSON.stringify(quickSearchSmartFolderHistory));
};

/* scrollToActive 指令（70641-70672）等价移植：watch index → 容器内不完整可见时对齐。 */
function useScrollToActive(
  containerRef: React.RefObject<HTMLElement | null>,
  index: number,
  enable: boolean | undefined
) {
  useEffect(() => {
    if (enable !== undefined && !enable) return;
    const container = containerRef.current;
    if (!container) return;
    if ((container as HTMLElement).offsetParent === null) return; // jQuery :visible
    const timer = setTimeout(() => {
      if (index === undefined) return;
      const active = container.querySelector('.active-item') as HTMLElement | null;
      if (!active) return; // 原版 find('.active-item') 为空 → offset() undefined → 跳过
      const rect = active.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const height = rect.height;
      const top = rect.top;
      const bottom = rect.bottom;
      const inContainer =
        top <= containerRect.top ? containerRect.top - top <= height : bottom - containerRect.bottom <= height;
      if (inContainer) return;
      const innerHeight = container.clientHeight;
      const relTop = top - containerRect.top + container.scrollTop;
      if (top > containerRect.top + innerHeight / 2) {
        container.scrollTop = relTop - innerHeight + height;
      } else {
        container.scrollTop = relTop;
      }
    }, 5);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, enable]);
}

interface QsView {
  open: boolean;
  mode: string;
  keyword: string; // 已应用的 quickSearchKeyword（ng-model debounce 后）
  inputValue: string; // 输入框实时值
  result: any[];
  active: number; // quickSearchIndex
}

const initialView: QsView = { open: false, mode: 'FOLDERS', keyword: '', inputValue: '', result: [], active: 0 };

const ROW_SIZES: Record<string, number> = { FOLDERS: 28, TAGS: 28, SMARTFOLDERS: 28, ITEMS: 92 };

export function QuickSearchModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<QsView>(initialView);
  const viewRef = useRef(view);
  viewRef.current = view;

  const inputRef = useRef<HTMLInputElement>(null);
  const folderResRef = useRef<HTMLDivElement>(null);
  const tagsResRef = useRef<HTMLDivElement>(null);
  const smartResRef = useRef<HTMLDivElement>(null);
  const itemsResRef = useRef<HTMLDivElement>(null);

  const modeRef = useRef<string>('FOLDERS');
  const keywordRef = useRef<string>(''); // 已应用 keyword
  const quickScrollEnableRef = useRef<boolean | undefined>(undefined);
  const historyIndexRef = useRef(0); // quickSearchHistoryIndex（原版仅有读写，无消费点）
  const debounceTimerRef = useRef<any>(null);
  const historyRef = useRef<string[] | null>(null);
  if (historyRef.current === null) {
    // link 期一次性载入（原版无 try，这里兜底防崩）
    try {
      const raw = localStorage.getItem('eagle.quickSearch.history');
      historyRef.current = raw ? JSON.parse(raw) : [];
    } catch (err) {
      historyRef.current = [];
    }
  }

  useEffect(() => {
    setHost(document.getElementById('eagle-quick-search-host'));
  }, []);

  /* ---------------- quickSearchKeywordChange（60910-61064 逐字） ---------------- */

  const searchFilterForQuickSeach = (kw: string) => (image: any) => {
    try {
      const w = window as any;
      const body = getBodyScope();
      let isMatch = false;
      const keywords = String(kw).toLowerCase().split(' ');

      for (let i = 0; i < keywords.length; i++) {
        let keyword = keywords[i];
        const isNotLogic = keyword[0] === '-';
        const isFullMathLogic = keyword[0] === '"' && keyword[keyword.length - 1] === '"';

        if (keyword === '-') continue;

        const name = image.name;
        const annotation = image.annotation;
        const ext = image.ext;
        const url = image.url;
        let camera = '';
        let postScriptName = '';
        let allText = '';

        if (image.fontMetas && image.fontMetas.postScriptName) {
          try {
            const key = Object.keys(image.fontMetas.postScriptName)[0];
            postScriptName = (image.fontMetas.postScriptName && image.fontMetas.postScriptName[key].toLowerCase()) || '';
          } catch (err) {}
        }

        if (image.text) {
          allText += image.text.toLowerCase() + ' ';
        }

        if (image.rawMetas && image.rawMetas.camera) {
          try {
            camera = image.rawMetas.camera;
            allText += `${camera} `;
          } catch (err) {}
        }

        if (name && body.isSearchScopeName) {
          allText += `${name}`;
        }

        if (ext && body.isSearchScopeExt) {
          allText += `.${ext} `;
        }

        if (url && body.isSearchScopeUrl) {
          if (body.keyword.length >= 2) {
            allText += `${url} `;
          }
        }

        if (annotation && body.isSearchScopeNote) {
          allText += `${annotation} `;
        }

        // 提前判断，如果已经符合，就不需要下面的复杂判断
        allText = allText.toLowerCase();

        if (isNotLogic) {
          //
        } else if (isFullMathLogic) {
          if (name === keyword.replace(/"/g, '')) {
            isMatch = true;
            continue;
          } else {
            const textArray = name.toLowerCase().split(/[ ，,;、]+/);
            if (textArray.indexOf(keyword.replace(/"/g, '')) > -1) {
              isMatch = true;
              continue;
            } else {
              // return false;
            }
          }
        } else {
          if (
            (w.i18n.locale !== 'zh_CN' && w.i18n.locale !== 'zh_TW' && w.i18n.locale !== 'en') ||
            body.isContainAlphabet
          ) {
            if (allText.indexOf(keyword) != -1) {
              isMatch = true;
              continue;
            } else {
              //
            }
          } else {
            const keyword2 = keywords[i];
            if (allText.indexOf(keyword2) != -1) {
              isMatch = true;
              continue;
            }
          }
        }

        let annotations = '';
        if (body.isSearchScopeAnnotation) {
          if (image.comments) {
            image.comments.forEach((comment: any) => {
              annotations += comment.annotation;
            });
          }
          allText += `${annotations} `;
        }

        let tagsString = '';
        if (body.isSearchScopeTag && image.tags && image.tags.length > 0) {
          for (let ti = 0; ti < image.tags.length; ti++) {
            if (image.tags[ti]) {
              tagsString += `${image.tags[ti]} `;
            }
          }
          allText += `${tagsString} `;
        }

        // 这个很花时间，如果图片名称就已经符合条件，应立即 return 不该等到这个时间
        let folderNames = ' ';
        let folderDescriptions = ' ';
        if (body.isSearchScopeFolderDesc || body.isSearchScopeFolderName) {
          if (image.folders && image.folders.length > 0) {
            for (let fi = 0; fi < image.folders.length; fi++) {
              const folderId = image.folders[fi];
              const folder = body.folderMappings[folderId];
              if (folder) {
                if (body.isSearchScopeFolderName && folder && folder.name) {
                  folderNames += `${folder.name} `;
                }
                if (body.isSearchScopeFolderDesc && folder.description) {
                  folderDescriptions += `${folder.description} `;
                }
              }
            }
          }
          allText += folderNames;
          allText += folderDescriptions;
        }

        allText = allText.toLowerCase();

        if (isNotLogic) {
          const notKeyword = keyword.replace('-', '');
          if (notKeyword && allText.indexOf(notKeyword) != -1) {
            return false;
          } else {
            isMatch = true;
          }
        } else if (isFullMathLogic) {
          keyword = keyword.replace(/"/g, '');
          if (name === keyword) {
            isMatch = true;
          } else {
            const textArray = name.toLowerCase().split(/[ ，,;、]+/);
            if (textArray.indexOf(keyword) > -1) {
              isMatch = true;
            } else {
              return false;
            }
          }
        } else {
          if (
            (w.i18n.locale !== 'zh_CN' && w.i18n.locale !== 'zh_TW' && w.i18n.locale !== 'en') ||
            body.isContainAlphabet
          ) {
            if (allText.indexOf(keyword) != -1) {
              isMatch = true;
            } else {
              return false;
            }
          } else {
            const keyword2 = keywords[i];
            if (allText.indexOf(keyword2) != -1) {
              isMatch = true;
            } else {
              return false;
            }
          }
        }
      }

      return isMatch;
    } catch (err) {}
    return false;
  };

  const runKeywordChange = (mode: string, kw: string) => {
    const body = getBodyScope();
    if (!body) return;
    const w = window as any;
    const { pinyinlite, cartesianProduct } = loadPinyinModules();

    const keyword_cn = w.chineseConvert
      .tw2cn(kw)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\ /g, '')
      .toLowerCase();

    let list: any[] = [];

    const cloneWithoutKey = (object: any, key: string) => {
      const { [key]: deletedKey, ...otherKeys } = object;
      void deletedKey;
      return otherKeys;
    };

    switch (mode) {
      case 'ITEMS':
        list = body.all || [];
        break;
      case 'FOLDERS': {
        // 顯示歷史記錄
        if (!kw && (body.folderList || []).length > 15 && getQuickSearchFolderHistory().length > 0) {
          getQuickSearchFolderHistory().forEach((fid: any) => {
            if (list.length >= 10) return;
            if (body.folderMappings[fid]) {
              const copy = cloneWithoutKey(body.folderMappings[fid], 'children');
              delete copy.$$hashKey;
              copy.isRecent = true;
              list.push(copy);
            }
          });
        }

        const folderList: any[] = [];
        const ancestorsCache: any = {};
        const guidelinesMap: any = {};

        w.eagle.utils.tree.walk(body.folders, 'children', (folder: any, parent: any) => {
          const item = { ...folder };
          if (item && parent) {
            item.parent = parent.id;
          }

          // 計算 guidelines 顏色及數量（原版只写入本地 map，模板消费的是 spread 自带的
          // folder.guidelines —— 逐字保留这段计算）
          let guidelines: string[] = [];
          if (parent && guidelinesMap[parent.id]) {
            const parentGuidelines = guidelinesMap[parent.id];
            guidelines = [...parentGuidelines, item.iconColor || 'normal'];
          } else {
            guidelines = [item.iconColor || 'normal'];
          }
          guidelinesMap[item.id] = guidelines;

          // 列表版本 Folders
          folderList.push(item);
        });

        list.push(...folderList);
        break;
      }
      case 'TAGS': {
        const tagGroupsIndexMap: any = {};
        (body.TagManager?.groups || []).forEach((tagGroup: any, index: number) => {
          tagGroupsIndexMap[tagGroup.id] = index;
        });
        list = [...(body.tags || [])];

        // sort tags by tag.group property（原版直接 a.groups[0]，这里对缺失 groups 兜底）
        list = list.sort((a: any, b: any) => {
          const aGroup = a.groups && a.groups[0] ? a.groups[0] : undefined;
          const bGroup = b.groups && b.groups[0] ? b.groups[0] : undefined;
          const aGroupIdx = tagGroupsIndexMap[aGroup];
          const bGroupIdx = tagGroupsIndexMap[bGroup];
          if (!aGroup && bGroup) return 1;
          if (aGroup && !bGroup) return -1;
          if (aGroupIdx < bGroupIdx) return -1;
          if (aGroupIdx > bGroupIdx) return 1;
          return 0;
        });

        // if group is equal, then sort a-z
        list = list.sort((a: any, b: any) => {
          const aGroup = a.groups && a.groups[0] ? a.groups[0] : undefined;
          const bGroup = b.groups && b.groups[0] ? b.groups[0] : undefined;
          const aName = a.name;
          const bName = b.name;
          if (aGroup === bGroup) {
            if (aName < bName) return -1;
            if (aName > bName) return 1;
          }
          return 0;
        });

        break;
      }
      case 'SMARTFOLDERS': {
        if (!kw && (body.smartFolderList || []).length > 10 && getQuickSearchSmartFolderHistory().length > 0) {
          getQuickSearchSmartFolderHistory().forEach((fid: any) => {
            if (list.length >= 10) return;
            if (body.smartFolderMappings[fid]) {
              const copy = cloneWithoutKey(body.smartFolderMappings[fid], 'children');
              delete copy.$$hashKey;
              delete copy.iconColor;
              copy.isRecent = true;
              list.push(copy);
            }
          });
        }
        list.push(...(body.smartFolderList || []));
        break;
      }
    }

    let result: any[];
    if (!kw) {
      result = list;
    } else if (mode !== 'ITEMS') {
      console.time('$scope.quickSearchKeywordChange');
      const searchItems = list.map((folder: any) => {
        const folderNameCN = w.chineseConvert
          .tw2cn(folder.name)
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        if (kw.length >= 30 || folder.name.length >= 30) {
          return {
            folder: folder,
            name: folderNameCN,
            search: [folderNameCN],
          };
        }
        return {
          folder: folder,
          name: folderNameCN,
          search: [
            folderNameCN,
            ...uniq(
              cartesianProduct(pinyinlite(folderNameCN, { keepUnrecognized: true }).filter((p: any) => p.length > 0)).map(
                (item: any) => item.join(' ')
              )
            ),
          ],
        };
      });

      const scores = searchItems.map((item: any) => {
        return {
          item: item,
          name: item.name,
          score: max(item.search.map((pinyin: any) => (pinyin as any).score(keyword_cn))),
        };
      });

      result = scores.filter((i: any) => i.score > 0).sort((a: any, b: any) => b.score - a.score).map((i: any) => i.item.folder);

      console.timeEnd('$scope.quickSearchKeywordChange');
    } else {
      console.time('$scope.quickSearchKeywordChange');
      result = list.filter(searchFilterForQuickSeach(kw));
      console.timeEnd('$scope.quickSearchKeywordChange');
    }

    keywordRef.current = kw;
    setView((prev) => ({ ...prev, keyword: kw, result }));
  };

  /* ---------------- open / close（60802-60834） ---------------- */

  const close = () => {
    setView((prev) => ({ ...prev, open: false }));
    inputRef.current?.blur();
    const rootScope = getRootScope();
    if (rootScope) rootScope.currentFocus = 'content';
  };

  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const offOpen = openQuickSearchModalChannel.on(() => {
      const body = getBodyScope();
      if (body) body.keyword = '';
      setView((prev) => ({ ...prev, open: true, active: prev.active || 0 }));
      setTimeout(() => {
        inputRef.current?.focus();
        document.querySelectorAll('.quick-search .search-result-container').forEach((el) => (el.scrollTop = 0));
      }, 100);
      setTimeout(() => inputRef.current?.focus(), 200);
      inputRef.current?.focus();
      inputRef.current?.select();
      runKeywordChange(modeRef.current, keywordRef.current);
    });
    const offClose = closeQuickSearchModalChannel.on(() => {
      close();
    });
    return () => {
      offOpen();
      offClose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  /* ---------------- 模式切换（60836-60870） ---------------- */

  const changeMode = (mode: string) => {
    modeRef.current = mode;
    setView((prev) => ({ ...prev, mode }));
    runKeywordChange(mode, keywordRef.current);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
  };

  /* ---------------- 结果操作（61066-61106） ---------------- */

  const saveQuickSearchHistory = (keyword: string) => {
    if (!keyword) return;
    const history = historyRef.current || [];
    history.unshift(keyword);
    if (history.length >= 100) {
      history.length = 100;
    }
    historyRef.current = history;
    localStorage.setItem('eagle.quickSearch.history', JSON.stringify(history));
  };

  const openQuickSearchResult = (target: any) => {
    if (!target) return;
    const body = getBodyScope();
    const w = window as any;
    const mode = modeRef.current;
    if (!body) return;
    if (mode === 'FOLDERS') {
      scopeApply(body, (s: any) => openFolder(target));
      addQuickSearchFolderHistory(target.id);
      setTimeout(() => {
        scopeApply(getBodyScope(), (s: any) => {
          machineryChangeSidebarIndex(s, target);
          if (typeof s.$evalAsync === 'function') scopeEvalAsync();
        });
      }, 200);
    } else if (mode === 'TAGS') {
      scopeApply(body, (s: any) => {
        s.viewMode = undefined;
        openTag(target.name);
      });
    } else if (mode === 'ITEMS') {
      scopeApply(body, (s: any) => {
        let folder = null;
        if (target.folders && target.folders[0]) {
          folder = s.folderMappings[target.folders[0]];
        }
        openItemLocation(target, folder);
      });
    } else {
      scopeApply(body, (s: any) => openSmartFolder(target));
      addQuickSearchSmartFolderHistory(target.id);
      setTimeout(() => {
        scopeApply(getBodyScope(), (s: any) => {
          machineryChangeSidebarIndex(s, target);
          if (typeof s.$evalAsync === 'function') scopeEvalAsync();
        });
      }, 200);
    }
    saveQuickSearchHistory(keywordRef.current);
    historyIndexRef.current = 0;
    close();
    if (w.analytics && typeof w.analytics.event === 'function') w.analytics.event('QuickSearch', 'Open');
  };

  const selectQuickSearchResult = (index: number) => {
    setView((prev) => ({ ...prev, active: index }));
    quickScrollEnableRef.current = false;
  };

  const resetResultScroll = () => {
    document.querySelectorAll('.quick-search .search-result-container').forEach((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });
  };

  /* ---------------- quickSeachKeyup（61108-61144）+ selectall（70600-70614） ---------------- */

  const onInputKeyDown = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 38) {
      event.preventDefault();
      quickScrollEnableRef.current = true;
      setView((prev) => ({ ...prev, active: prev.active - 1 >= 0 ? prev.active - 1 : prev.active }));
    } else if (keyCode === 40) {
      event.preventDefault();
      quickScrollEnableRef.current = true;
      setView((prev) => ({
        ...prev,
        active: prev.active + 1 < prev.result.length ? prev.active + 1 : prev.active,
      }));
    } else if (keyCode === 27) {
      event.preventDefault();
      close();
    } else if (keyCode === 13) {
      openQuickSearchResult(viewRef.current.result[viewRef.current.active]);
    } else if (keyCode === 9) {
      event && event.preventDefault();
      const mode = modeRef.current;
      if (!event.shiftKey) {
        if (mode === 'FOLDERS') changeMode('TAGS');
        else if (mode === 'TAGS') changeMode('SMARTFOLDERS');
        else if (mode === 'SMARTFOLDERS') changeMode('ITEMS');
        else changeMode('FOLDERS');
      } else {
        if (mode === 'FOLDERS') changeMode('ITEMS');
        else if (mode === 'TAGS') changeMode('FOLDERS');
        else if (mode === 'SMARTFOLDERS') changeMode('TAGS');
        else changeMode('SMARTFOLDERS');
      }
      setView((prev) => ({ ...prev, active: 0 }));
      historyIndexRef.current = 0;
      resetResultScroll();
    } else {
      setView((prev) => ({ ...prev, active: 0 }));
      historyIndexRef.current = 0;
      resetResultScroll();
    }

    // selectall 指令（Mousetrap mod+a / esc，keydown 注册在 ng-keydown 之后）
    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'a') {
      event.stopPropagation();
      inputRef.current?.select();
    } else if (keyCode === 27) {
      event.stopPropagation();
      inputRef.current?.blur();
    }
  };

  /* 输入（ng-model debounce 50ms / blur 立即同步） */
  const onInputChange = (event: any) => {
    const value = event.target.value;
    setView((prev) => ({ ...prev, inputValue: value }));
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      runKeywordChange(modeRef.current, value);
    }, 50);
  };

  const onInputBlur = () => {
    // ng-model-options blur:0 —— blur 立即同步
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (inputRef.current && inputRef.current.value !== keywordRef.current) {
      runKeywordChange(modeRef.current, inputRef.current.value);
    }
  };

  /* ---------------- 渲染（quick-search-modal.html 逐字） ---------------- */

  const body = getBodyScope();

  const getThumbnailUrl = (image: any) => {
    if (!body?.imagesDir || !image) return '';
    return FileUrlHelper.getThumbnailUrl(image) || '';
  };

  const rowSize = ROW_SIZES[view.mode] || 28;
  const folderSizes = useMemo(() => new Array(view.result.length).fill(28), [view.result.length]);
  const itemsSizes = useMemo(() => new Array(view.result.length).fill(92), [view.result.length]);
  const resetKey = `${view.open}:${view.mode}:${view.keyword}:${view.result.length}`;
  const folderWin = useVirtualWindow(folderResRef, folderSizes, resetKey);
  const tagsWin = useVirtualWindow(tagsResRef, folderSizes, resetKey);
  const smartWin = useVirtualWindow(smartResRef, folderSizes, resetKey);
  const itemsWin = useVirtualWindow(itemsResRef, itemsSizes, resetKey);

  useScrollToActive(folderResRef, view.active, quickScrollEnableRef.current);
  useScrollToActive(tagsResRef, view.active, undefined);
  useScrollToActive(smartResRef, view.active, quickScrollEnableRef.current);
  useScrollToActive(itemsResRef, view.active, quickScrollEnableRef.current);

  // isolate scope 上 folderList/tags/smartFolderList/all 不可达 → 计数 span 恒为 ng-show=false
  const hiddenCount = <span style={{ display: 'none' }} />;

  const closeViaScope = () => {
    const s = getBodyScope();
    if (s) scopeApply(s, () => closeQuickSearch());
    else close();
  };

  const renderFolderItem = (folder: any, idx: number, kind: 'folder' | 'smart') => (
    <div
      key={idx}
      className={`search-result-item color-${iv(folder.iconColor)} icon-${iv(folder.icon)} depth-${iv(folder.depth)}${
        view.active === idx ? ' active active-item' : ''
      }${folder.isRecent || view.keyword.length > 0 ? ' search-mode' : ''}`}
      onClick={() => openQuickSearchResult(folder)}
      onMouseEnter={() => selectQuickSearchResult(idx)}
    >
      {!folder.isRecent && (
        <div className="guidelines">
          {(folder.guidelines || []).map((line: string, gi: number) => (
            <div key={gi} className={`guideline color-${iv(line)} depth-${gi + 1}`} style={ngShow(folder.depth !== gi)}>
              <div className="top"></div>
              <div className="middle"></div>
              <div className="bottom"></div>
            </div>
          ))}
        </div>
      )}
      <div className="icon">
        <div className="fake-svg"></div>
        {folder.isRecent && <div className="history-badge"></div>}
      </div>
      <div className="info">
        <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(folder.name, view.keyword) }} />
        <div className="right">
          {folder.parent ? (
            <span
              className="parent-name"
              onClick={(e) => {
                e.stopPropagation();
                scopeApply(getBodyScope(), (s: any) =>
                  kind === 'folder' ? openFolder(s.folderMappings[folder.parent]) : openSmartFolder(s.smartFolderMappings[folder.parent])
                );
                closeViaScope();
              }}
            >
              {iv(kind === 'folder' ? body?.folderMappings?.[folder.parent]?.name : body?.smartFolderMappings?.[folder.parent]?.name)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderTagItem = (tag: any, idx: number) => (
    <div
      key={idx}
      className={`search-result-item color-${iv(tag.color)}${view.active === idx ? ' active' : ''}`}
      onClick={() => openQuickSearchResult(tag)}
      onMouseEnter={() => selectQuickSearchResult(idx)}
    >
      <div className="icon">
        <div className="fake-svg" style={{ WebkitMaskImage: 'url(assets/images/base/icons/ic-tag-select-tag.png)' }}></div>
      </div>
      <div className="info">
        <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(tag.name, view.keyword) }} />
        <div className="right">
          {tag.groups && tag.groups[0] ? (
            <span className="parent-name">{iv(body?.TagManager?.groupMappings?.[tag.groups[0]]?.name)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderItem = (item: any, idx: number) => (
    <div
      key={idx}
      className={`search-result-item large${view.active === idx ? ' active active-item' : ''}`}
      onClick={() => openQuickSearchResult(item)}
      onMouseEnter={() => selectQuickSearchResult(idx)}
    >
      {view.mode === 'ITEMS' && (
        <div className="icon">
          <img src={getThumbnailUrl(item)} />
          {item.noPreview && <ExtIcon itemId={String(item.id)} />}
        </div>
      )}
      <div className="info">
        <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(item.name, view.keyword) }} />
        <div className="meta">
          {angDate(item.modificationTime, 'yyyy/MM/dd HH:mm')}
          {item.folders?.length > 0 ? <span>・</span> : null}
          {(item.folders || []).map((folderId: any, fi: number) => (
            <span
              key={fi}
              className="parent"
              onClick={() => scopeApply(getBodyScope(), (s: any) => openItemLocation(item, s.folderMappings[folderId]))}
            >
              <a>{iv(body?.folderMappings?.[folderId]?.name)} </a>
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const emptyKeys: Record<string, [string, string]> = {
    FOLDERS: ['quickSearch.empty.folder', 'quickSearch.searchEmpty.folder'],
    TAGS: ['quickSearch.empty.tag', 'quickSearch.searchEmpty.tag'],
    SMARTFOLDERS: ['quickSearch.empty.folder', 'quickSearch.searchEmpty.folder'],
    ITEMS: ['quickSearch.empty.folder', 'quickSearch.searchEmpty.folder'],
  };
  const [emptyKey, searchEmptyKey] = emptyKeys[view.mode] || emptyKeys.FOLDERS;

  if (!host) return null;

  return createPortal(
    <>
      <div id="quick-search-panel" className={`quick-search${view.open ? ' open' : ''}`}>
        {/* Header */}
        <div className="panel-header">
          <input
            id="quick-search-input"
            ref={inputRef}
            className="search"
            maxLength={1024}
            type="search"
            placeholder={t('quickSearch.searchPlaceholder')}
            onKeyDown={onInputKeyDown}
            onChange={onInputChange}
            onBlur={onInputBlur}
            value={view.inputValue}
            tabIndex={-1}
          />
          <div className="close" onClick={close}></div>
        </div>

        <div className="tabs">
          <div className={`tab${view.mode === 'FOLDERS' ? ' active' : ''}`} onClick={() => changeMode('FOLDERS')}>
            {t('quickSearch.tabs.folderLabel')}
            {hiddenCount}
          </div>
          <div className={`tab${view.mode === 'TAGS' ? ' active' : ''}`} onClick={() => changeMode('TAGS')}>
            {t('quickSearch.tabs.tagLabel')}
            {hiddenCount}
          </div>
          <div className={`tab${view.mode === 'SMARTFOLDERS' ? ' active' : ''}`} onClick={() => changeMode('SMARTFOLDERS')}>
            {t('quickSearch.tabs.smartFolderLabel')}
            {hiddenCount}
          </div>
          <div className={`tab${view.mode === 'ITEMS' ? ' active' : ''}`} onClick={() => changeMode('ITEMS')}>
            {t('general.document')} {hiddenCount}
          </div>
        </div>

        {/* 資料夾列表 */}
        <div className="search-result" style={ngShow(view.mode === 'FOLDERS')}>
          <div className="empty" style={ngShow(view.result.length === 0 && !view.keyword)}>{t(emptyKey)}</div>
          <div className="empty" style={ngShow(view.result.length === 0 && !!view.keyword)}>{t(searchEmptyKey)}</div>
          <div
            id="folder-search-result-container"
            className="search-result-container"
            style={ngShow(view.result.length > 0)}
            ref={folderResRef}
          >
            <div className="vs-repeat-before-content" style={{ height: `${folderWin.beforeSize}px` }} />
            {view.result.slice(folderWin.startIndex, folderWin.endIndex).map((folder, i) => renderFolderItem(folder, folderWin.startIndex + i, 'folder'))}
            <div className="vs-repeat-after-content" style={{ height: `${folderWin.afterSize}px` }} />
          </div>
        </div>

        {/* 標籤列表 */}
        <div className="search-result" style={ngShow(view.mode === 'TAGS')}>
          <div className="empty" style={ngShow(view.result.length === 0 && !view.keyword)}>{t(emptyKey)}</div>
          <div className="empty" style={ngShow(view.result.length === 0 && !!view.keyword)}>{t(searchEmptyKey)}</div>
          <div
            id="tags-search-result-container"
            className="search-result-container"
            style={ngShow(view.result.length > 0)}
            ref={tagsResRef}
          >
            <div className="vs-repeat-before-content" style={{ height: `${tagsWin.beforeSize}px` }} />
            {view.result.slice(tagsWin.startIndex, tagsWin.endIndex).map((tag, i) => renderTagItem(tag, tagsWin.startIndex + i))}
            <div className="vs-repeat-after-content" style={{ height: `${tagsWin.afterSize}px` }} />
          </div>
        </div>

        {/* 智能文件夾 */}
        <div className="search-result" style={ngShow(view.mode === 'SMARTFOLDERS')}>
          <div className="empty" style={ngShow(view.result.length === 0 && !view.keyword)}>{t(emptyKey)}</div>
          <div className="empty" style={ngShow(view.result.length === 0 && !!view.keyword)}>{t(searchEmptyKey)}</div>
          <div
            id="smartfolder-search-result-container"
            className="search-result-container"
            style={ngShow(view.result.length > 0)}
            ref={smartResRef}
          >
            <div className="vs-repeat-before-content" style={{ height: `${smartWin.beforeSize}px` }} />
            {view.result.slice(smartWin.startIndex, smartWin.endIndex).map((smartFolder, i) => renderFolderItem(smartFolder, smartWin.startIndex + i, 'smart'))}
            <div className="vs-repeat-after-content" style={{ height: `${smartWin.afterSize}px` }} />
          </div>
        </div>

        {/* 項目 */}
        <div className="search-result" style={ngShow(view.mode === 'ITEMS')}>
          <div className="empty" style={ngShow(view.result.length === 0 && !view.keyword)}>{t(emptyKey)}</div>
          <div className="empty" style={ngShow(view.result.length === 0 && !!view.keyword)}>{t(searchEmptyKey)}</div>
          <div
            id="items-search-result-container"
            className="search-result-container"
            style={ngShow(view.result.length > 0)}
            ref={itemsResRef}
          >
            <div className="vs-repeat-before-content" style={{ height: `${itemsWin.beforeSize}px` }} />
            {view.result.slice(itemsWin.startIndex, itemsWin.endIndex).map((item, i) => renderItem(item, itemsWin.startIndex + i))}
            <div className="vs-repeat-after-content" style={{ height: `${itemsWin.afterSize}px` }} />
          </div>
        </div>

        <div className="panel-footer">
          <div className="left">
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.switch')}
              <key>Tab</key>
            </div>
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.move')}
              <div className="keys">
                <key>↑</key>
                <key>↓</key>
              </div>
            </div>
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.select')}
              <key>︎⏎</key>
            </div>
          </div>
          <div className="right">
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.close')}
              <key>︎ESC</key>
            </div>
          </div>
        </div>
      </div>
      <div className="quick-search-overlay" onClick={closeViaScope}></div>
    </>,
    host
  );
}
