import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { updateSidebarList } from '../../services/sidebarService';
import { saveFolder } from '../../services/folderService';
import { t } from '../../global/eagleGlobals';
import { usePanelState } from '../../store/panelState';
import { req, getIpc } from '../detail/detailHooks';
import { fuzzyMatchHtml } from './ContextMenu';
import { useVirtualWindow } from '../sidebar/Sidebar';
import { max, uniq } from '../../utils/lang';
import { smartZoom } from '../../services/detailService';
import { syncInspectorFromScope } from '../../store/inspectorState';
import { syncDetailFromScope } from '../../store/detailState';
import { getBodyScope, getRootScope, scopeApply } from '../../core/appCore';
import { moveFoldersAsSibling, moveFoldersToFolder } from '../../services/folderCoreService';
import { calculateImageBindingChannel, glRemoveitemsChannel, openAddFolderModalChannel, openMoveFolderModalChannel, rebindRefreshChannel, updateSelectionChannel } from '../../global/bus';
import { scopeEvalAsync } from '../../global/scopeShim';
import { machineryContentFilter, machineryFilterData, machineryGetSelectedItemElements, machineryGetSelection, machineryLeaveDetailMode, machineryUpdateFilterCounts } from '../../core/dataMachinery';

import { machinerySmartFolderCount } from '../../core/libraryDomain';
/**
 * 阶段7d-1a：AddToFolderController（bundle 74733-75636）+ MoveFolderController
 * （bundle 75637-76134）接管，模板 = index.html 411-617 逐字转写。
 *
 * 触发通道零改动：OPEN-ADD-FOLDER-MODAL（body scope addToFolders 广播）/
 * OPEN-MOVE-FOLDER-MODAL（body scope moveFolders 广播）。树数据经 cloneTree（8207 逐字）
 * 与外界隔离；筛选拼音管线（chineseConvert/pinyinlite/cartesianProduct/fuzzy_match）原样；
 * save() 走 ig.remove/updateFilterCounts/ayncsImagesChange/hiddenByCurrentFilter/
 * gl:removeItems/CALCULATE_IMAGE_BINDING 等既有通道；最近使用文件夹键
 * recentMoveFolders、开关键 isRemoveFromOriginal 原样保留。
 * swal（window.swal，bundle 内嵌 SweetAlert2）、Menu/MenuItem（@electron/remote）、
 * guid（window var）等 bundle 全局按等价方式消费。
 */

const iv = (v: any): any => (v === undefined || v === null ? '' : v);

const ngShow = (show: boolean) => (show ? undefined : { display: 'none' } as React.CSSProperties);

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;

/* cloneTree（bundle 8207-8243 逐字） */
function cloneTree(newTree: any[], tree: any, extraInfo?: boolean) {
  let arr: any;
  if (Array.isArray(tree)) {
    arr = tree;
  } else {
    arr = tree['children'];
  }
  if (arr && Array.isArray(arr)) {
    arr.forEach((node) => {
      const newNode: any = {
        id: node.id,
        name: node.name,
        description: node.description || '',
        children: [],
        modificationTime: node.modificationTime,
        tags: node.tags || [],
        extendTags: node.extendTags,
        icon: node.icon,
        iconColor: node.iconColor,
        pinyin: node.pinyin,
        password: node.password || '',
        passwordTips: node.passwordTips || '',
        coverId: node.coverId,
      };
      if (node.orderBy) {
        newNode.orderBy = node.orderBy;
        newNode.sortIncrease = node.sortIncrease;
      }
      if (extraInfo) {
        newNode.isExpand = node.isExpand;
      }
      newTree.push(newNode);
      cloneTree(newNode.children, node, extraInfo);
    });
  }
}

function loadPinyinModules() {
  try {
    const w = window as any;
    return {
      chineseConvert: w.chineseConvert,
      pinyinlite: w.__eaglePinyinlite || (w.__eaglePinyinlite = w.require((w.appRoot && w.appRoot.path || '.') + '/my_modules/pinyinlite')),
      cartesianProduct: w.__eagleCartesianProduct || (w.__eagleCartesianProduct = w.require((w.appRoot && w.appRoot.path || '.') + '/my_modules/cartesian-product')),
    };
  } catch (err) {
    return { chineseConvert: null, pinyinlite: null, cartesianProduct: null };
  }
}

/* ayncsImagesChange（bundle 49667-49710 逐字；backgroundWindowID 为 bundle 顶层 var → window 属性） */
export function ayncsImagesChange(images: any[]) {
  if (!images || images.length === 0) return;
  setTimeout(() => {
    let total = images.length;
    let once = 350;
    let loopCount = total / once;
    let countOfSend = 0;
    const ipcRenderer = getIpc();

    function send() {
      const start = countOfSend * once;
      const willSendImages = images.slice(start, start + once);
      countOfSend += 1;
      console.log('第 %d 批傳送，目前進度 %d / %d', countOfSend, willSendImages.length + (countOfSend - 1) * once, total);

      willSendImages.forEach((image) => {
        image.lastModified = Date.now();
      });

      const backgroundWindowID = (window as any).backgroundWindowID;
      if (backgroundWindowID === undefined) {
        ipcRenderer.send('images-change', willSendImages);
      } else {
        ipcRenderer.sendTo(backgroundWindowID, 'images-change', willSendImages);
      }

      willSendImages.forEach((image) => {
        delete image['oldName'];
        delete image['newName'];
      });
      loop();
    }

    function loop() {
      if (countOfSend < loopCount) {
        window.requestAnimationFrame(send);
      }
    }
    loop();
  }, 0);
}

/* hiddenByCurrentFilter（bundle 49600-49665 逐字） */
export function hiddenByCurrentFilter(items: any[]) {
  if (!items || items.length === 0) return;
  let total = items.length;
  let once = 350;
  let loopCount = total / once;
  let countOfSend = 0;

  async function send() {
    const start = countOfSend * once;
    const willSendItems = items.slice(start, start + once);
    countOfSend += 1;

    try {
      if (!willSendItems || willSendItems.length === 0) return;
      console.log('第 %d 更新，目前進度 %d / %d', countOfSend, willSendItems.length + (countOfSend - 1) * once, total);
      let keepItems = await machineryFilterData(getBodyScope(), willSendItems);
      keepItems = keepItems.filter((x: any) => machineryContentFilter(getBodyScope(), x));
      const keetItemsMap: any = {};
      keepItems.forEach((item: any) => {
        keetItemsMap[item.id] = true;
      });
      const result: any[] = [];
      willSendItems.forEach((item) => {
        if (!keetItemsMap[item.id]) {
          result.push(item);
        }
      });
      if (result.length > 0) {
        const hiddenItemMap: any = {};
        const hiddenElements: any[] = [];
        result.forEach((item) => {
          const box = document.getElementById(`box-${item.id}`);
          if (box) {
            hiddenElements.push(box);
          }
          hiddenItemMap[item.id] = true;
        });

        // 从当前筛选结果移除项目
        getBodyScope().allData = getBodyScope().allData.filter((item: any) => {
          return !hiddenItemMap[item.id];
        });

        if (hiddenElements.length > 0) {
          glRemoveitemsChannel.emit(hiddenElements);
          if (getBodyScope().currentSmartFolder) {
            getBodyScope().currentSmartFolder.imageCount = machinerySmartFolderCount(getBodyScope(), getBodyScope().currentSmartFolder);
            scopeEvalAsync();
          }
        }
      }
    } catch (err) {}

    loop();
  }

  function loop() {
    if (countOfSend < loopCount) {
      window.requestAnimationFrame(send);
    }
  }
  loop();
}

/* scrollToActive 指令（70641-70672；index 为任意触发值，取 .active-item 对齐） */
function useScrollToActive(
  containerSelector: string,
  index: unknown,
  enable: boolean | undefined
) {
  useEffect(() => {
    if (enable !== undefined && !enable) return;
    const container = document.querySelector(containerSelector) as HTMLElement | null;
    if (!container) return;
    if (container.offsetParent === null) return;
    const timer = setTimeout(() => {
      if (index === undefined) return;
      const active = container.querySelector('.active-item') as HTMLElement | null;
      if (!active) return;
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

/* vsAutoScroll 指令（69856-69904 逐字，sizes/sizesCumulative 由 React 侧提供） */
function useVsAutoScroll(
  containerSelector: string,
  index: number | undefined,
  sizes: number[],
  sizesCumulative: number[],
  vsSize: number
) {
  useEffect(() => {
    try {
      if (index !== undefined) {
        const container = document.querySelector(containerSelector) as HTMLElement | null;
        if (!container) return;
        if (!sizes || !sizesCumulative) return;
        const targetPos = sizesCumulative[index];
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight || container.getBoundingClientRect().height;
        let to: number | undefined;
        // 如果根本不在画面上，直接跳跃
        if (Math.abs(targetPos - scrollTop) > containerHeight) {
          to = targetPos - containerHeight / 2;
        }
        // 处于画面下方
        else if (targetPos > scrollTop + containerHeight - (sizes[index] || vsSize)) {
          to = targetPos - containerHeight + (sizes[index] || vsSize);
        }
        // 处于画面上方
        else if (targetPos < scrollTop) {
          to = targetPos;
        }
        if (to !== undefined) container.scrollTop = to;
      }
    } catch (err) {
      //
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
}

/* ng-repeat 每节点包裹 div（ng-switch 宿主）内的 guideline 结构 */
const Guidelines = ({ node }: { node: any }) => (
  <div className="guidelines">
    {(node.guidelines || []).map((line: string, gi: number) => (
      <div key={gi} className={`guideline color-${iv(line)} depth-${gi + 1}`}>
        <div className="top"></div>
        {gi !== node.depth && node.children.length === 0 ? <div className="middle"></div> : null}
        <div className="bottom"></div>
      </div>
    ))}
  </div>
);

const themeIcon = (theme: string) => ({
  arrow: iconSrc(theme, 'ic-arrow-right.svg'),
  check: iconSrc(theme, 'ic-check.svg'),
  more: iconSrc(theme, 'ic-more.svg'),
  add: iconSrc(theme, 'ic-sidebar-add.svg'),
  close: iconSrc(theme, 'ic-modal-close.svg'),
});

/* ================= AddToFolderController（74733-75636） ================= */

const ADD_INITIAL = {
  open: false,
  images: [] as any[],
  current: undefined as any,
  existsFolders: [] as any[],
  showCreateButton: false,
  resultList: [] as any[],
  selectedFolder: undefined as any,
  currentIndex: undefined as number | undefined,
};

export function AddToFolderModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [view, setView] = useState(ADD_INITIAL);
  const viewRef = useRef(view);
  viewRef.current = view;

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const foldersRef = useRef<any[]>([]); // $scope.folders（隔离树）
  const folderMappingsRef = useRef<any>({});
  const selectedFoldersRef = useRef<any>({});
  const filterKeywordRef = useRef('');
  const recentMoveFoldersRef = useRef<any[]>([]);
  const searchScrollEnableRef = useRef<boolean | undefined>(undefined);
  const debounceTimerRef = useRef<any>(null);
  const [isRemoveFromOriginal, setIsRemoveFromOriginal] = useState<string>(localStorage.getItem('isRemoveFromOriginal') || 'false');
  const isRemoveRef = useRef(isRemoveFromOriginal);
  isRemoveRef.current = isRemoveFromOriginal;
  // {{::folderList.length}}（body scope folderList 的一次性绑定，bootstrap 期即定型）
  const folderCountRef = useRef<number | null>(null);
  if (folderCountRef.current === null) {
    const body = getBodyScope();
    if (body && body.folderList) folderCountRef.current = body.folderList.length;
  }

  useEffect(() => {
    setHost(document.getElementById('eagle-add-to-folder-host'));
  }, []);

  /* getFolderList（74814-74887 逐字） */
  const getFolderList = (folders: any[], filterFolderKeyword: string, folderMappings: any) => {
    const list: any[] = [];
    const isFiltering = !!filterFolderKeyword;
    const guidelinesMap: any = {};
    const w = window as any;

    w.eagle.utils.tree.walk(folders, 'children', (folder: any, parent: any, depth: number) => {
      // 計算 guidelines 顏色及數量
      let guidelines: string[] = [];
      if (parent && guidelinesMap[parent.id]) {
        const parentGuidelines = guidelinesMap[parent.id];
        guidelines = [...parentGuidelines, folder.iconColor || 'normal'];
      } else {
        guidelines = [folder.iconColor || 'normal'];
      }
      guidelinesMap[folder.id] = guidelines;

      let idx: number;
      folder.size = 27;
      folder.vstype = 'folder';
      folder.guidelines = guidelines.slice(0, guidelines.length - 1);
      folder.styles = {
        depth: depth,
        first: false,
        last: false,
      };

      if (parent) {
        folder.isVisible = folder.isExpand && parent.isVisible;
      } else {
        folder.isVisible = folder.isExpand;
      }

      if (depth !== 0 && parent && parent.children) {
        idx = parent.children.indexOf(folder);
        if (idx === 0 && parent.children.length > 1) {
          folder.styles.first = true;
          folder.styles.last = false;
        } else if (idx === 0 && parent.children.length === 1) {
          folder.styles.first = false;
          folder.styles.last = true;
        } else if (idx === parent.children.length - 1) {
          folder.styles.first = false;
          folder.styles.last = true;
        } else {
          folder.styles.first = false;
          folder.styles.last = false;
        }
      }
      if (folder && folder.isExpand && folder.children.length > 0) {
        folder.styles.last = true;
      }

      // 决定是否要在画面上显示
      if (!parent) {
        list.push(folder);
      } else if (isFiltering) {
        list.push(folder);
      } else {
        if (folder && parent.isVisible) {
          list.push(folder);
        }
      }
    });
    return list;
  };

  /* filterFolders（75110-75175 逐字；会原地改 folder.isExpand） */
  const filterFolders = (folders: any[], keyword: string) => {
    if (!keyword) return folders;
    const w = window as any;
    const { chineseConvert, pinyinlite, cartesianProduct } = loadPinyinModules();
    const folderMappings = folderMappingsRef.current;
    const keyword_cn = chineseConvert
      .tw2cn(keyword)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\ /g, '')
      .toLowerCase();

    const folderSearchItems = folders.map((folder: any) => {
      const folderNameCN = chineseConvert
        .tw2cn(folder.name)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (keyword.length >= 30 || folder.name.length >= 30) {
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

    const scores = folderSearchItems.map((item: any) => {
      let score = max(item.search.map((pinyin: any) => (pinyin as any).score(keyword_cn)));
      const folder = item.folder;
      if (folder && folder.parent && folderMappings[folder.parent]) {
        if (folderMappings[folder.parent].showChildren) {
          score = 1;
        }
      }
      if (folder.children) {
        let isMatch = false;
        w.eagle.utils.tree.walk(folder.children, 'children', (child: any) => {
          if ((w.fuzzy_match(child.name, keyword_cn) || '').length > 0) {
            folder.isExpand = true;
            isMatch = true;
          }
          if (child.pinyin && keyword_cn.length > 3) {
            if ((w.fuzzy_match(child.pinyin, keyword_cn) || '').length > 0) {
              folder.isExpand = true;
              isMatch = true;
            }
          }
        });
        if (isMatch) {
          score = 1;
        }
      }
      return {
        item: item,
        name: item.name,
        score: score,
      };
    });

    const result = scores.filter((i: any) => i.score > 0).map((i: any) => i.item.folder);

    return result;
  };

  /* renderFolderList（74889-74949 逐字）；返回最新列表供同步读取 */
  const renderFolderList = (): any[] => {
    let list: any[] = [];
    let folderList = getFolderList(foldersRef.current, filterKeywordRef.current, folderMappingsRef.current);
    const folderLabel = { vstype: 'label-folder', size: 25 };
    const createFolderItem = { vstype: 'createFolder', size: 28 };
    const body = getBodyScope();

    folderList = filterFolders(folderList, filterKeywordRef.current);

    if (filterKeywordRef.current.length <= 0) {
      if (recentMoveFoldersRef.current.length > 0) {
        list.push({ vstype: 'separator', size: 8 });
      }

      recentMoveFoldersRef.current.forEach((recentFolderId) => {
        if (recentFolderId && body?.folderMappings[recentFolderId]) {
          const folder = JSON.parse(JSON.stringify(body.folderMappings[recentFolderId]));
          folder.size = 28;
          folder.styles = {
            depth: 0,
            first: false,
            last: false,
          };
          folder.vstype = 'recentFolder';
          list.push(folder);
        }
      });

      list.push({ vstype: 'separator', size: 8 });
      list.push(folderLabel);
    } else {
      list.push({ vstype: 'separator', size: 8 });
    }

    list = list.concat(folderList);

    // 计算是否需要显示创建按钮
    let showCreateButton = false;
    if (filterKeywordRef.current) {
      showCreateButton = true;
      for (let i = 0; i < list.length; i++) {
        const folder = list[i];
        if (folder.name === filterKeywordRef.current) {
          showCreateButton = false;
          break;
        }
      }
    }

    if (showCreateButton) {
      list.push(createFolderItem);
    }

    setView((prev) => ({ ...prev, resultList: list, showCreateButton }));
    return list;
  };

  /* openModal（74749-74799 逐字） */
  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = openAddFolderModalChannel.on((params: any) => {
      const body = getBodyScope();
      const w = window as any;
      foldersRef.current = [];
      selectedFoldersRef.current = {};

      // 與外界隔離，不需要使用 body scope 的 folders
      cloneTree(foldersRef.current, params.folders);

      // 预设展开所有第一层
      foldersRef.current.forEach((folder) => {
        folder.isExpand = true;
      });

      const folderMappings: any = {};
      w.eagle.utils.tree.walk(foldersRef.current, 'children', (folder: any, parent: any) => {
        folderMappings[folder.id] = folder;
        if (folder && parent) {
          folder.parent = parent.id;
        }
        for (let i = 0; i < params.existsFolders.length; i++) {
          const existsFolder = params.existsFolders[i];
          // 该图片已经收藏在这个文件夹了
          if (folder.id === existsFolder) {
            selectedFoldersRef.current[folder.id] = true;
          }
        }
      });
      folderMappingsRef.current = folderMappings;

      // 最近使用的文件夹（存id)，去除已经不存在的文件夹
      let recentMoveFolders: any[] = [];
      const raw = localStorage.getItem('recentMoveFolders');
      if (raw) {
        recentMoveFolders = JSON.parse(raw);
        recentMoveFolders = recentMoveFolders.slice(0, 8);
      }
      recentMoveFoldersRef.current = recentMoveFolders.filter((folderId: any) => !!body?.folderMappings[folderId]);

      filterKeywordRef.current = '';
      const resultList = renderFolderList();
      setView({
        ...ADD_INITIAL,
        open: false,
        images: params.images,
        current: params.current,
        existsFolders: params.existsFolders,
        resultList,
        selectedFolder: resultList[0],
      });
      setTimeout(() => {
        setView((prev) => ({ ...prev, open: true }));
      }, 70);
      // autoFocus 指令（73003-73012）：事件 → 100ms 后 click+focus+select
      setTimeout(() => {
        searchRef.current?.click();
        searchRef.current?.focus();
        searchRef.current?.select();
      }, 100);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  /* renderFolderList 同步取 resultList（openModal 内需要立即读取） */
  const listRefResult = (): any[] => {
    return viewRef.current.resultList;
  };
  void listRefResult;

  const keywordRef = () => filterKeywordRef.current;

  const changeCurrentIndex = (node: any) => {
    const idx = viewRef.current.resultList.indexOf(node);
    if (idx !== -1) {
      setView((prev) => ({ ...prev, currentIndex: idx }));
    }
  };

  /* selectPrevFolder / selectNextFolder（75028-75058 逐字） */
  const selectPrevFolder = () => {
    const resultList = viewRef.current.resultList;
    const currentIndex = resultList.indexOf(viewRef.current.selectedFolder);
    let next;
    if (currentIndex === -1) {
      next = resultList[0];
    } else {
      next = resultList[currentIndex - 1] || resultList[0];
    }
    setView((prev) => ({ ...prev, selectedFolder: next }));
    if (currentIndex > 0 && next && next.vstype !== 'folder' && next.vstype !== 'recentFolder' && next.vstype !== 'createFolder') {
      setTimeout(selectPrevFolder, 0);
      return;
    }
    changeCurrentIndex(next);
    searchScrollEnableRef.current = true;
  };

  const selectNextFolder = () => {
    const resultList = viewRef.current.resultList;
    const currentIndex = resultList.indexOf(viewRef.current.selectedFolder);
    let next;
    if (currentIndex === -1) {
      next = resultList[0];
    } else {
      next = resultList[currentIndex + 1] || resultList[resultList.length - 1];
    }
    setView((prev) => ({ ...prev, selectedFolder: next }));
    if (currentIndex < resultList.length - 1 && next && next.vstype !== 'folder' && next.vstype !== 'recentFolder' && next.vstype !== 'createFolder') {
      setTimeout(selectNextFolder, 0);
      return;
    }
    changeCurrentIndex(next);
    searchScrollEnableRef.current = true;
  };

  /* keywordChange（75060-75070） */
  const keywordChange = (kw: string) => {
    const w = window as any;
    // 一律清除強制展開的功能
    w.eagle.utils.tree.walk(foldersRef.current, 'children', (folder: any) => {
      delete folder.showChildren;
    });
    filterKeywordRef.current = kw;
    const resultList = renderFolderList();
    setView((prev) => ({ ...prev, selectedFolder: resultList[0] }));
    scrollToTop();
  };

  /* onSearchKeyup（75072-75104） */
  const onSearchKeyup = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 38) {
      event.preventDefault();
      selectPrevFolder();
    } else if (keyCode === 40) {
      event.preventDefault();
      selectNextFolder();
    } else if (keyCode === 37) {
      if (viewRef.current.selectedFolder) {
        viewRef.current.selectedFolder.isExpand = false;
        viewRef.current.selectedFolder.showChildren = false;
        renderFolderList();
      }
    } else if (keyCode === 39) {
      if (viewRef.current.selectedFolder) {
        viewRef.current.selectedFolder.isExpand = true;
        viewRef.current.selectedFolder.showChildren = true;
        renderFolderList();
      }
    } else if (keyCode === 27) {
      event.preventDefault();
      cancel();
    } else if (keyCode === 13) {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        save();
      } else {
        select(viewRef.current.selectedFolder);
      }
    }
  };

  const scrollToTop = () => {
    const el = document.querySelector('.move-to-folder-modal .sidebar-item-container') as HTMLElement | null;
    if (el) el.scrollTop = 0;
  };

  /* toggleFolder（74976-75010） */
  const toggleFolder = (event: any, folder: any) => {
    event.stopPropagation();
    const w = window as any;
    if (filterKeywordRef.current) {
      folder.isExpand = !folder.isExpand;
      folder.showChildren = !folder.showChildren;
    } else {
      if (event.altKey && (event.metaKey || event.ctrlKey)) {
        const expand = !folder.isExpand;
        w.eagle.utils.tree.walk(foldersRef.current, 'children', (f: any) => {
          if (f.isExpand !== expand) f.isExpand = expand;
        });
      } else if (event.metaKey || event.ctrlKey) {
        const expand = !folder.isExpand;
        const parent = folderMappingsRef.current[folder.parent];
        let folders = foldersRef.current;
        if (parent && parent.children) {
          folders = parent.children;
        }
        folders.forEach((f: any) => {
          if (f.isExpand !== expand) f.isExpand = expand;
        });
      } else if (event.altKey) {
        const expand = !folder.isExpand;
        const folders = folder.children;
        folder.isExpand = expand;
        folders.forEach((f: any) => {
          if (f.isExpand !== expand) f.isExpand = expand;
        });
      } else {
        folder.isExpand = !folder.isExpand;
      }
    }
    renderFolderList();
    focusSeach();
  };

  /* hoverFolder / select（75234-75252） */
  const hoverFolder = (folder: any) => {
    searchScrollEnableRef.current = false;
    setView((prev) => ({ ...prev, selectedFolder: folder }));
  };

  const select = (folder: any) => {
    if (folder && folder.vstype === 'createFolder') {
      createFolder();
    } else {
      if (!selectedFoldersRef.current[folder.id]) {
        selectedFoldersRef.current[folder.id] = true;
      } else {
        delete selectedFoldersRef.current[folder.id];
      }
    }
    setView((prev) => ({ ...prev })); // selectedFolders 变化 → 刷新勾选
    focusSeach();
  };

  const focusSeach = () => {
    setTimeout(() => {
      document.getElementById('add-to-folder-search')?.focus();
    }, 24);
  };

  /* createFolder（75260-75281）+ swal 新建输入（75440-75464） */
  const createFolder = () => {
    const w = window as any;
    const newFolder = {
      id: w.guid(),
      name: filterKeywordRef.current,
      folders: [],
      modificationTime: Date.now(),
      editable: false,
      tags: [],
      children: [],
      isExpand: true,
    };

    selectedFoldersRef.current[newFolder.id] = true;

    if (filterKeywordRef.current && viewRef.current.showCreateButton) {
      foldersRef.current.unshift(newFolder);
      filterKeywordRef.current = '';
      renderFolderList();
      getIpc().send('prepend-folder', newFolder);
    }
    setView((prev) => ({ ...prev })); // 刷新勾选/输入
    syncKeywordInput('');
  };

  const syncKeywordInput = (value: string) => {
    setView((prev) => ({ ...prev }));
    const input = document.getElementById('add-to-folder-search') as HTMLInputElement | null;
    if (input) input.value = value;
  };

  const swalCreateFolder = (callback: (folderName?: string) => void) => {
    const w = window as any;
    w.swal({
      html: `
                <div class="alert">
                    <div class="alert-icon create"></div>
                    <h4 class="alert-title">${t('dialog.addToFolder.craeateFolder.title')}</h4>
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
      inputPlaceholder: t('dialog.addToFolder.craeateFolder.placeholder'),
      inputValue: '',
      cancelButtonColor: '#777777',
      confirmButtonText: t('dialog.addToFolder.craeateFolder.button'),
      cancelButtonText: t('general.cancel'),
    }).then(
      (result: any) => {
        const name = result;
        callback(name);
        focusSeach();
      },
      () => {
        focusSeach();
      }
    );
  };

  /* newFolder（75288-75317） */
  const newFolder = (event: any) => {
    event.stopPropagation();
    const w = window as any;
    const body = getBodyScope();
    const idx = 0;
    swalCreateFolder((folderName) => {
      if (folderName === undefined) return;
      const folderId = w.guid();
      const newFolder = {
        id: folderId,
        name: folderName,
        images: [],
        folders: [],
        modificationTime: Date.now(),
        imagesMappings: {},
        tags: [],
        children: [],
        isExpand: true,
      };
      const newFolderCopy = JSON.parse(JSON.stringify(newFolder));

      foldersRef.current.splice(idx, 0, newFolder);
      body.folders.splice(idx, 0, newFolderCopy);
      folderMappingsRef.current[newFolder.id] = newFolder;
      body.folderMappings[newFolder.id] = newFolderCopy;

      renderFolderList();
      updateSidebarList();
      saveFolder();
      focusSeach();
    });
  };

  /* removeRecentFolder（75319-75332） */
  const removeRecentFolder = (event: any, folder: any) => {
    const recentMoveFolders = recentMoveFoldersRef.current;
    if (recentMoveFolders && recentMoveFolders.length > 0) {
      const idx = recentMoveFolders.indexOf(folder.id);
      if (idx > -1) {
        const sidx = recentMoveFoldersRef.current.indexOf(folder.id);
        if (sidx > -1) {
          const next = [...recentMoveFoldersRef.current];
          next.splice(sidx, 1);
          recentMoveFoldersRef.current = next;
        }
        recentMoveFolders.splice(idx, 1);
        localStorage.setItem('recentMoveFolders', JSON.stringify(recentMoveFolders));
        renderFolderList();
      }
    }
  };

  /* moreButtonClick（75334-75438）：electron 原生菜单 */
  const moreButtonClick = (event: any, folder: any) => {
    event.stopPropagation();
    const w = window as any;
    const body = getBodyScope();
    const remote = req('@electron/remote');
    const Menu = remote.Menu;
    const MenuItem = remote.MenuItem;

    const contextMenu = new Menu();
    const newSubFolderItem = new MenuItem({
      label: t('context.addToFolder.addChilderFolder'),
      click: () => {
        swalCreateFolder((folderName) => {
          if (folderName === undefined) return;
          const folderId = w.guid();
          const newFolder: any = {
            id: folderId,
            name: folderName,
            images: [],
            folders: [],
            modificationTime: Date.now(),
            imagesMappings: {},
            tags: [],
            children: [],
            isExpand: true,
            parent: folder.id,
          };
          const newFolderCopy = JSON.parse(JSON.stringify(newFolder));

          const idx = 0;
          const bodyFolder = body.folderMappings[folder.id];
          if (!folder.children) folder.children = [];
          if (!bodyFolder.children) bodyFolder.children = [];

          folder.children.splice(folder.children.length, 0, newFolder);
          bodyFolder.children.splice(folder.children.length, 0, newFolderCopy);
          folderMappingsRef.current[newFolder.id] = newFolder;
          body.folderMappings[newFolder.id] = newFolderCopy;

          folder.isExpand = true;

          renderFolderList();
          updateSidebarList();
          saveFolder();
          focusSeach();
        });
      },
    });
    const newSiblingsItem = new MenuItem({
      label: t('context.addToFolder.addSiblingFolder'),
      click: () => {
        swalCreateFolder((folderName) => {
          if (folderName === undefined) return;

          const folderId = w.guid();
          const idx = 0;
          const bodyFolder = body.folderMappings[folder.id];
          const parentId = folder.parent;
          let parentFolderChildren: any;
          let bodyParentFolderChildren: any;

          if (!parentId) {
            parentFolderChildren = foldersRef.current;
            bodyParentFolderChildren = body.folders;
          } else {
            if (!folderMappingsRef.current[parentId]) return;
            if (!body.folderMappings[parentId]) return;
            parentFolderChildren = folderMappingsRef.current[parentId].children;
            bodyParentFolderChildren = body.folderMappings[parentId].children;
          }

          const realIdx = parentFolderChildren.indexOf(folder);
          if (realIdx === -1) return;

          const newFolder: any = {
            id: folderId,
            name: folderName,
            images: [],
            folders: [],
            modificationTime: Date.now(),
            imagesMappings: {},
            tags: [],
            children: [],
            isExpand: true,
            parent: parentId,
          };
          const newFolderCopy = JSON.parse(JSON.stringify(newFolder));

          parentFolderChildren.splice(realIdx + 1, 0, newFolder);
          bodyParentFolderChildren.splice(realIdx + 1, 0, newFolderCopy);
          folderMappingsRef.current[newFolder.id] = newFolder;
          body.folderMappings[newFolder.id] = newFolderCopy;

          renderFolderList();
          updateSidebarList();
          saveFolder();
          focusSeach();
        });
      },
    });

    contextMenu.append(newSubFolderItem);
    contextMenu.append(newSiblingsItem);
    contextMenu.popup(w.getCurrentWindow ? w.getCurrentWindow() : undefined);
    setTimeout(() => {
      focusSeach();
    }, 50);
  };

  /* hasSelected（75283-75286） */
  const hasSelected = () => {
    if (!viewRef.current.open) return undefined;
    return Object.keys(selectedFoldersRef.current).length > 0;
  };

  /* save（75466-75628 逐字） */
  const save = () => {
    const w = window as any;
    const body = getBodyScope();
    const rootScope = getRootScope();
    const selectedFolders: any[] = [];

    const origin: any[] = [];
    const originFolders: any[] = [];
    const originTags: any[] = [];
    const originDeleted: any[] = [];

    viewRef.current.images.forEach((image) => {
      origin.push(image);
      originFolders.push(JSON.parse(JSON.stringify(image.folders)));
      originTags.push(JSON.parse(JSON.stringify(image.tags)));
      originDeleted.push(image.isDeleted);
    });

    // 如果使用者取消打勾既有分类文件夹
    const removedFolderIds: any[] = [];
    viewRef.current.existsFolders.forEach((exFolderId) => {
      if (!selectedFoldersRef.current[exFolderId]) {
        removedFolderIds.push(exFolderId);
      }
    });

    let hasChanged = false;
    let hasRemoved = false;
    w.eagle.utils.tree.walk(foldersRef.current, 'children', (folder: any) => {
      if (selectedFoldersRef.current[folder.id]) {
        // 添加至最近使用文件夹
        const recentIdx = recentMoveFoldersRef.current.indexOf(folder.id);
        if (recentIdx !== -1) {
          recentMoveFoldersRef.current.splice(recentIdx, 1);
        }
        recentMoveFoldersRef.current.unshift(folder.id);

        selectedFolders.push(folder);
        viewRef.current.images.forEach((image: any) => {
          if (image.folders.indexOf(folder.id) === -1) {
            image.folders.push(folder.id);
            if (folder.extendTags) {
              folder.extendTags.forEach((tag: any) => {
                if (image.tags.indexOf(tag) === -1) {
                  image.tags.push(tag);
                }
              });
            }
          }
          if (viewRef.current.current && isRemoveRef.current == 'true') {
            const idx = image.folders.indexOf(viewRef.current.current.id);
            if (idx !== -1) {
              const box = document.getElementById(`box-${image.id}`);
              if (box && w.ig && typeof w.ig.remove === 'function') w.ig.remove(box);
              image.folders.splice(idx, 1);
              machineryUpdateFilterCounts(body, image, true);
              viewRef.current.current.imagesMappings[image.id] = false;
              hasRemoved = true;
            }
          }

          // 如果使用者取消打勾既有分类文件夹
          if (removedFolderIds && removedFolderIds.length > 0) {
            removedFolderIds.forEach((removedFolderId) => {
              const idx = image.folders.indexOf(removedFolderId);
              if (idx !== -1) {
                if (viewRef.current.current && viewRef.current.current.id === removedFolderId) {
                  const box = document.getElementById(`box-${image.id}`);
                  if (box && w.ig && typeof w.ig.remove === 'function') w.ig.remove(box);
                  viewRef.current.current.imagesMappings[image.id] = false;
                }
                image.folders.splice(idx, 1);
                machineryUpdateFilterCounts(body, image, true);
                hasRemoved = true;
              }
            });
          }

          image.isDeleted = false;
        });
        hasChanged = true;
      }
    });

    if (hasRemoved) {
      body.lastIndex = machineryGetSelection(body).start;

      // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
      const next = body.allData[body.lastIndex + body.selected.length];
      const prev = body.allData[body.lastIndex - 1];
      if (next) {
        body.selected = [next];
        syncInspectorFromScope();
        body.current = next;
        syncDetailFromScope();
        syncInspectorFromScope();
        // b1-9bk：直调 detailService（原 body.smartZoom() 绕 scope）
        smartZoom();
      } else if (prev) {
        body.selected = [prev];
        syncInspectorFromScope();
        body.current = prev;
        syncDetailFromScope();
        syncInspectorFromScope();
        // b1-9bk：直调 detailService（原 body.smartZoom() 绕 scope）
        smartZoom();
      } else {
        body.selected = [];
        syncInspectorFromScope();
        machineryLeaveDetailMode(body);
      }
    }

    if (hasChanged) {
      ayncsImagesChange(viewRef.current.images);
      hiddenByCurrentFilter(viewRef.current.images);
    }

    if (body.viewMode === 'unfiled') {
      const itemElements = machineryGetSelectedItemElements(body, );
      glRemoveitemsChannel.emit(itemElements);
    } else {
      if (w.ig && typeof w.ig.layout === 'function') w.ig.layout(false);
    }

    calculateImageBindingChannel.emit();
    rebindRefreshChannel.emit(true);
    updateSelectionChannel.emit();

    // 记录最近使用的文件夹
    recentMoveFoldersRef.current = recentMoveFoldersRef.current.slice(0, 50);
    localStorage.setItem('recentMoveFolders', JSON.stringify(recentMoveFoldersRef.current));

    let message = t('notify.image.moveToFolders', [
      
      { property: 'imageCount', value: String(viewRef.current.images.length) },
      
      { property: 'folderCount', value: String(selectedFolders.length) },
    ]);
    if (viewRef.current.images.length === 1) {
      message = message.replace('images', 'image');
    }
    if (selectedFolders.length === 1) {
      message = t('notify.image.moveToFolder', [
        { property: 'folderId', value: selectedFolders[0].id },
        
      { property: 'imageCount', value: String(viewRef.current.images.length) },
        { property: 'folderName', value: selectedFolders[0].name },
      ]);
    }

    // 復原操作
    if (rootScope.notify) {
      rootScope.notify(
        {
          message: message,
          duration: 4000,
        },
        () => {
          origin.forEach((image, index) => {
            image.folders = originFolders[index];
            image.tags = originTags[index];
            image.isDeleted = originDeleted[index];
          });
          getBodyScope().selected = origin;
          syncInspectorFromScope();
          getBodyScope().current = origin[0];
          syncDetailFromScope();
          syncInspectorFromScope();
          calculateImageBindingChannel.emit();
          rebindRefreshChannel.emit(true);
          updateSelectionChannel.emit();
        }
      );
    }

    setView((prev) => ({ ...prev, open: false }));
    const input = document.querySelector('.move-to-folder-modal input:focus') as HTMLElement | null;
    if (input) input.blur();
    scrollToTop();

    if (w.electronLog) w.electronLog.info(`[app] Categorize ${viewRef.current.images.length} files to ${selectedFolders.length} folders`);
    if (w.analytics && typeof w.analytics.event === 'function') w.analytics.event('File', 'Categorize', 'AddToFolder');
  };

  const cancel = () => {
    setView((prev) => ({ ...prev, open: false }));
    const input = document.querySelector('.move-to-folder-modal input:focus') as HTMLElement | null;
    if (input) input.blur();
    scrollToTop();
  };

  /* getMoveFolderItemClass（74951-74974） */
  const getMoveFolderItemClass = (node: any, folderName: any, selectedFolder: any) => {
    void folderName;
    const result: any = {
      'hover active-item': node == selectedFolder,
      checked: !!selectedFoldersRef.current[node.id],
      collapsed: !node.isExpand && !filterKeywordRef.current,
      'empty-node': node.children && node.children.length == 0,
      'color-red': node.iconColor == 'red',
      'color-orange': node.iconColor == 'orange',
      'color-yellow': node.iconColor == 'yellow',
      'color-green': node.iconColor == 'green',
      'color-aqua': node.iconColor == 'aqua',
      'color-blue': node.iconColor == 'blue',
      'color-purple': node.iconColor == 'purple',
      'color-pink': node.iconColor == 'pink',
      close: node.children && node.children.length <= 0 && node.isExpand,
    };

    result['icon-' + node.icon] = true;
    const parent = folderMappingsRef.current[node.parent];
    if (parent) {
      result[`parent-color-${parent?.iconColor}`] = true;
    }
    return result;
  };

  const classOf = (cls: any) =>
    Object.keys(cls)
      .filter((k) => cls[k])
      .join(' ');

  /* 输入（ng-model debounce 50ms / blur 立即同步） */
  const onInputChange = (event: any) => {
    const value = event.target.value;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      keywordChange(value);
    }, 50);
  };

  const onInputBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const input = document.getElementById('add-to-folder-search') as HTMLInputElement | null;
    if (input && input.value !== filterKeywordRef.current) {
      keywordChange(input.value);
    }
  };

  /* 渲染 */
  const sizes = useMemo(() => view.resultList.map((node) => node.size || 27), [view.resultList]);
  const sizesCumulative = useMemo(() => {
    const acc: number[] = [0];
    for (let i = 0; i < sizes.length; i++) acc.push(acc[i] + (sizes[i] || 27));
    return acc;
  }, [sizes]);
  const win = useVirtualWindow(listRef, sizes, `${view.resultList.length}:${view.open}:${filterKeywordRef.current}`);
  useScrollToActive('.move-to-folder-modal .sidebar-item-container', view.selectedFolder, searchScrollEnableRef.current);
  useVsAutoScroll('.move-to-folder-modal .sidebar-item-container', view.currentIndex, sizes, sizesCumulative, 28);

  const preventMiddleClick = (event: any) => {
    const body = getBodyScope();
    if (body && typeof body.preventMiddleClick === 'function') body.preventMiddleClick(event);
  };

  const renderNode = (node: any, idx: number) => {
    const style = { zIndex: 100000 - idx, height: `${node.size}px` };
    switch (node.vstype) {
      case 'label-folder':
        return (
          <div key={idx}>
            <div className="sidebar-item-label" style={style}>
              <div className="sidebar-item-label-warp">
                <div className="name expandable">
                  {t('modal.addToFolder.folderLabel')} ({iv(folderCountRef.current ?? 0)})
                </div>
                <div className="hide-btns show">
                  <div
                    className="hide-btn"
                    tippy=""
                    tippy-placement="bottom"
                    tippy-content={t('modal.addToFolder.newFolderHint')}
                    onClick={(e) => newFolder(e)}
                  >
                    <img src={iconSrc(theme, 'ic-sidebar-add.svg')} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'separator':
        return <div key={idx} className="separator" style={style}></div>;
      case 'folder':
        return (
          <div key={idx}>
            <div
              id={`modal-folder-${node.id}`}
              className={`item depth-${node.styles.depth} ${classOf(getMoveFolderItemClass(node, node.name, view.selectedFolder))}`}
              style={style}
              onClick={() => select(node)}
              onMouseOver={() => hoverFolder(node)}
              onMouseDown={preventMiddleClick}
              onContextMenu={(e) => {
                e.preventDefault();
                moreButtonClick(e, node);
              }}
            >
              <Guidelines node={node} />
              <div className="expand-icon" onClick={(e) => toggleFolder(e, node)}>
                <img src={iconSrc(theme, 'ic-arrow-right.svg')} />
              </div>
              <div className="icon">
                <div className="fake-svg png"></div>
              </div>
              <div className="checked-icon">
                <img src={iconSrc(theme, 'ic-check.svg')} />
              </div>
              <div className="more-icon" onClick={(e) => moreButtonClick(e, node)}>
                <img src={iconSrc(theme, 'ic-more.svg')} />
              </div>
              <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(node.name, filterKeywordRef.current) }}></div>
              <div className="active-bg"></div>
            </div>
          </div>
        );
      case 'recentFolder':
        return (
          <div key={idx}>
            <div
              id={`modal-recent-folder-${node.id}`}
              className="item depth-0"
              style={style}
              onClick={() => select(node)}
              onMouseOver={() => hoverFolder(node)}
              onMouseDown={preventMiddleClick}
            >
              <div className="icon">
                <div className="fake-svg" style={{ WebkitMaskImage: 'url(assets/images/base/mask-icons/ic_clock.png) !important' }}></div>
              </div>
              <div className="checked-icon">
                <img src={iconSrc(theme, 'ic-check.svg')} />
              </div>
              <div className="more-icon" onClick={(e) => removeRecentFolder(e, node)}>
                <img src={iconSrc(theme, 'ic-modal-close.svg')} />
              </div>
              <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(node.name, filterKeywordRef.current) }}></div>
              <div className="active-bg"></div>
            </div>
          </div>
        );
      case 'createFolder':
        return (
          <div key={idx}>
            <div
              className="item depth-0 sidebar-folder-item"
              style={style}
              onClick={() => createFolder()}
              onMouseOver={() => hoverFolder(node)}
              onMouseDown={preventMiddleClick}
            >
              <div className="icon">
                <div className="fake-svg" style={{ WebkitMaskImage: 'url(assets/images/base/icons/ic-plus.svg) !important' }}></div>
              </div>
              <div className="name">
                {t('modal.addToFolder.newFolderBtn')} “{filterKeywordRef.current}”
              </div>
              <div className="active-bg"></div>
            </div>
          </div>
        );
      default:
        return <div key={idx}></div>;
    }
  };

  if (!host) return null;

  return createPortal(
    <>
      <div className={`modal move-folder-modal${view.open ? ' open' : ''}`} onClick={() => focusSeach()}>
        <div className="modal-header">
          <div className="name">{t('modal.addToFolder.addToFolderBtn')}</div>
          <div className="close" onClick={() => cancel()}></div>
        </div>
        <div className="section search">
          <div className="search">
            <input
              id="add-to-folder-search"
              ref={searchRef}
              maxLength={1024}
              type="search"
              placeholder={t('modal.addToFolder.searchPlaceholder')}
              onKeyDown={onSearchKeyup}
              onChange={onInputChange}
              onBlur={onInputBlur}
              tabIndex={-1}
            />
          </div>
        </div>
        <div className="search-result">
          <div className="result-content">
            {/* 空状态 */}
            {view.resultList.length == 0 ? <div className="empty-state">{t('modal.addToFolder.empty')}</div> : null}

            <div
              className="sidebar-item-container"
              style={ngShow(view.resultList.length > 0)}
              ref={listRef}
            >
              <div className="vs-repeat-before-content" style={{ height: `${win.beforeSize}px` }} />
              {view.resultList.slice(win.startIndex, win.endIndex).map((node, i) => renderNode(node, win.startIndex + i))}
              <div className="vs-repeat-after-content" style={{ height: `${win.afterSize}px` }} />
            </div>
          </div>
        </div>
        <div className="section darken textAlign-right">
          <label className="control checkbox" style={ngShow(!!view.current)}>
            <input
              type="checkbox"
              checked={isRemoveFromOriginal === 'true'}
              onChange={(e) => {
                const value = e.target.checked ? 'true' : 'false';
                setIsRemoveFromOriginal(value);
                localStorage.setItem('isRemoveFromOriginal', value);
              }}
            />
            <span className="control-indicator"></span>
            {t('modal.addToFolder.removeFromCurrentFolderBtn')}
          </label>
          <div className={`button button-xs button-primary${!hasSelected() ? ' button-disabled' : ''}`} onClick={() => save()}>
            {t('modal.addToFolder.addToFolderBtn')}
          </div>
          <div className="button button-xs button-grey" onClick={() => cancel()}>
            {t('general.cancel')}
          </div>
        </div>
      </div>
      <div className="modal-overlay" onClick={() => focusSeach()}></div>
    </>,
    host
  );
}

/* ================= MoveFolderController（75637-76134） ================= */

const MOVE_INITIAL = {
  open: false,
  images: [] as any[],
  current: undefined as any,
  existsFolders: [] as any[],
  selectedFolders: [] as any[],
  showCreateButton: false,
  resultList: [] as any[],
  selectedFolder: undefined as any,
  currentIndex: undefined as number | undefined,
};

export function MoveFolderModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [view, setView] = useState(MOVE_INITIAL);
  const viewRef = useRef(view);
  viewRef.current = view;

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const foldersRef = useRef<any[]>([]);
  const folderMappingsRef = useRef<any>({});
  const selectedFoldersMappingsRef = useRef<any>({});
  const filterKeywordRef = useRef('');
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-move-folder-host'));
  }, []);

  /* getFolderList（75688-75763 逐字；isVisible 受 selectedFoldersMappings 抑制） */
  const getFolderList = (folders: any[], filterFolderKeyword: string) => {
    const list: any[] = [];
    const isFiltering = !!filterFolderKeyword;
    const guidelinesMap: any = {};
    const w = window as any;

    w.eagle.utils.tree.walk(folders, 'children', (folder: any, parent: any, depth: number) => {
      // 計算 guidelines 顏色及數量
      let guidelines: string[] = [];
      if (parent && guidelinesMap[parent.id]) {
        const parentGuidelines = guidelinesMap[parent.id];
        guidelines = [...parentGuidelines, folder.iconColor || 'normal'];
      } else {
        guidelines = [folder.iconColor || 'normal'];
      }
      guidelinesMap[folder.id] = guidelines;

      let idx: number;
      folder.size = 27;
      folder.vstype = 'folder';
      folder.guidelines = guidelines.slice(0, guidelines.length - 1);
      folder.styles = {
        depth: depth,
        first: false,
        last: false,
      };

      if (selectedFoldersMappingsRef.current[folder.id]) {
        folder.isVisible = false;
      } else if (parent) {
        folder.isVisible = folder.isExpand && parent.isVisible && !selectedFoldersMappingsRef.current[parent.id];
      } else {
        folder.isVisible = folder.isExpand;
      }

      if (depth !== 0 && parent && parent.children) {
        idx = parent.children.indexOf(folder);
        if (idx === 0 && parent.children.length > 1) {
          folder.styles.first = true;
          folder.styles.last = false;
        } else if (idx === 0 && parent.children.length === 1) {
          folder.styles.first = false;
          folder.styles.last = true;
        } else if (idx === parent.children.length - 1) {
          folder.styles.first = false;
          folder.styles.last = true;
        } else {
          folder.styles.first = false;
          folder.styles.last = false;
        }
      }
      if (folder && folder.isExpand && folder.children.length > 0) {
        folder.styles.last = true;
      }

      // 决定是否要在画面上显示
      if (!parent) {
        list.push(folder);
      } else if (isFiltering) {
        list.push(folder);
      } else {
        if (folder && parent.isVisible) {
          list.push(folder);
        }
      }
    });
    return list;
  };

  /* folderMoveSearchFilter（75806-75861 逐字；原地改 folder.isExpand） */
  const folderMoveSearchFilter = (folder: any) => {
    const w = window as any;
    const { chineseConvert } = loadPinyinModules();
    let result = false;
    let pinyinMatch = false;
    if (!filterKeywordRef.current) {
      return true;
    }
    if (folder) {
      // NOTE: 如果老爸有著无敌星星，那我就能直接显示
      if (folder.parent && folderMappingsRef.current[folder.parent]) {
        if (folderMappingsRef.current[folder.parent].showChildren) {
          return true;
        }
      }
      const match = w.fuzzy_match(folder.name, filterKeywordRef.current);
      result = match && match.length > 0;
      if (result) {
        return true;
      }
      const keyword_cn = chineseConvert.tw2cn(filterKeywordRef.current);
      const keyword_tw = chineseConvert.cn2tw(filterKeywordRef.current);
      if (keyword_cn !== keyword_tw) {
        result = (w.fuzzy_match(folder.name, keyword_cn) || '').length > 0;
        if (result) {
          return true;
        }

        result = (w.fuzzy_match(folder.name, keyword_tw) || '').length > 0;
        if (result) {
          return true;
        }
      }

      if (folder.pinyin && filterKeywordRef.current.length >= 2) {
        pinyinMatch = (w.fuzzy_match(folder.pinyin, filterKeywordRef.current) || '').length > 0;
      }
      if (pinyinMatch) {
        return true;
      }
      if (folder.children) {
        let isMatch = false;
        w.eagle.utils.tree.walk(folder.children, 'children', (child: any) => {
          if ((w.fuzzy_match(child.name, filterKeywordRef.current) || '').length > 0) {
            folder.isExpand = true;
            isMatch = true;
            return;
          }
          if (child.pinyin && filterKeywordRef.current.length > 3) {
            if ((w.fuzzy_match(child.pinyin, filterKeywordRef.current) || '').length > 0) {
              folder.isExpand = true;
              isMatch = true;
              return;
            }
          }
        });
        return isMatch;
      }
    }
    return false;
  };

  /* renderFolderList（75766-75804 逐字）；返回最新列表供同步读取 */
  const renderFolderList = (): any[] => {
    let list: any[] = [];
    let folderList = getFolderList(foldersRef.current, filterKeywordRef.current);
    const folderLabel = { vstype: 'label-folder', size: 25 };
    const createFolderItem = { vstype: 'createFolder', size: 28 };

    // $filter('filter')(folderList, folderMoveSearchFilter)
    folderList = folderList.filter(folderMoveSearchFilter);

    if (filterKeywordRef.current.length <= 0) {
      list.push({ vstype: 'separator', size: 8 });
      list.push(folderLabel);
    } else {
      list.push({ vstype: 'separator', size: 8 });
    }

    list = list.concat(folderList);

    // 计算是否需要显示创建按钮
    let showCreateButton = false;
    if (filterKeywordRef.current) {
      showCreateButton = true;
      for (let i = 0; i < list.length; i++) {
        const folder = list[i];
        if (folder.name === filterKeywordRef.current) {
          showCreateButton = false;
          break;
        }
      }
    }

    if (showCreateButton) {
      list.push(createFolderItem);
    }

    setView((prev) => ({ ...prev, resultList: list, showCreateButton }));
    return list;
  };

  /* openModal（75651-75680 逐字；filterFolderKeyword 不清空——原版该行被注释） */
  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = openMoveFolderModalChannel.on((params: any) => {
      const w = window as any;
      foldersRef.current = [];
      selectedFoldersMappingsRef.current = {};
      params.selectedFolders.forEach((f: any) => {
        selectedFoldersMappingsRef.current[f.id] = true;
      });

      const folderMappings: any = {};
      cloneTree(foldersRef.current, params.folders, true);

      w.eagle.utils.tree.walk(foldersRef.current, 'children', (folder: any, parent: any) => {
        folderMappings[folder.id] = folder;
        if (folder && parent) {
          folder.parent = parent.id;
        }
      });
      folderMappingsRef.current = folderMappings;

      const resultList = renderFolderList();
      setView({
        ...MOVE_INITIAL,
        open: false,
        images: params.images,
        current: params.current,
        existsFolders: params.existsFolders,
        selectedFolders: params.selectedFolders,
        resultList,
        selectedFolder: resultList[0],
      });
      setTimeout(() => {
        setView((prev) => ({ ...prev, open: true }));
      }, 70);
      // autoFocus 指令
      setTimeout(() => {
        searchRef.current?.click();
        searchRef.current?.focus();
        searchRef.current?.select();
      }, 100);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  /* onSearchKeyup（75949-75954） */
  const onSearchKeyup = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 27) {
      cancel();
    }
  };

  const scrollToTop = () => {
    const el = document.querySelector('.move-to-folder-modal .sidebar-item-container') as HTMLElement | null;
    if (el) el.scrollTop = 0;
  };

  /* toggleFolder（75884-75919） */
  const toggleFolder = (event: any, folder: any) => {
    event.stopPropagation();
    const w = window as any;
    if (filterKeywordRef.current) {
      folder.isExpand = !folder.isExpand;
      folder.showChildren = !folder.showChildren;
    } else {
      if (event.altKey && (event.metaKey || event.ctrlKey)) {
        const expand = !folder.isExpand;
        w.eagle.utils.tree.walk(foldersRef.current, 'children', (f: any) => {
          if (f.isExpand !== expand) f.isExpand = expand;
        });
      } else if (event.metaKey || event.ctrlKey) {
        const expand = !folder.isExpand;
        const parent = folderMappingsRef.current[folder.parent];
        let folders = foldersRef.current;
        if (parent && parent.children) {
          folders = parent.children;
        }
        folders.forEach((f: any) => {
          if (f.isExpand !== expand) f.isExpand = expand;
        });
      } else if (event.altKey) {
        const expand = !folder.isExpand;
        const folders = folder.children;
        folder.isExpand = expand;
        folders.forEach((f: any) => {
          if (f.isExpand !== expand) f.isExpand = expand;
        });
      } else {
        folder.isExpand = !folder.isExpand;
      }
    }
    renderFolderList();
    focusSeach();
  };

  const focusSeach = () => {
    setTimeout(() => {
      document.getElementById('move-folder-search')?.focus();
    }, 24);
  };

  /* moveToFolderTop / Inner / Bottom（75970-76121 逐字；swal 确认） */
  const moveConfirm = (descMsg: string, onConfirm: () => void) => {
    const w = window as any;
    w.swal({
      html: `
                <div class="alert">
                    <div class="alert-icon warning"></div>
                    <h4 class="alert-title">${t('dialog.moveFolder.title')}</h4>
                    <p class="alert-desc">${descMsg}</p>
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
      cancelButtonColor: '#777777',
      confirmButtonText: t('dialog.moveFolder.button'),
      cancelButtonText: t('general.cancel'),
      onOpen: () => {
        const search = document.getElementById('move-folder-search');
        if (search) search.blur();
        const button = w.swal.getConfirmButton();
        if (button) {
          button.focus();
        }
      },
    }).then(
      () => {
        onConfirm();
        focusSeach();
      },
      () => {
        focusSeach();
      }
    );
  };

  const moveToFolderTop = (node: any) => {
    const selectedFolders = viewRef.current.selectedFolders;
    let msg;
    if (selectedFolders.length === 1) {
      msg = t('dialog.moveFolder.descTop', [
        { property: 'first', value: selectedFolders[0].name },
        { property: 'target', value: node.name },
      ]);
    } else {
      msg = t('dialog.moveFolder.descTopMultiple', [
        { property: 'first', value: selectedFolders[0].name },
        { property: 'count', value: String(selectedFolders.length - 1) },
        { property: 'target', value: node.name },
      ]);
    }
    moveConfirm(msg, () => {
      const body = getBodyScope();
      const folder = body.folderMappings[node.id];
      focusSeach();
      if (folder) {
        moveFoldersAsSibling(viewRef.current.selectedFolders, folder);
        cancel();
        if (typeof body.$evalAsync === 'function') scopeEvalAsync();
      }
    });
  };

  const moveToFolderInner = (node: any) => {
    const selectedFolders = viewRef.current.selectedFolders;
    let msg;
    if (selectedFolders.length === 1) {
      msg = t('dialog.moveFolder.descInner', [
        { property: 'first', value: selectedFolders[0].name },
        { property: 'target', value: node.name },
      ]);
    } else {
      msg = t('dialog.moveFolder.descInnerMultiple', [
        { property: 'first', value: selectedFolders[0].name },
        { property: 'count', value: String(selectedFolders.length - 1) },
        { property: 'target', value: node.name },
      ]);
    }
    moveConfirm(msg, () => {
      const body = getBodyScope();
      const folder = body.folderMappings[node.id];
      if (folder) {
        moveFoldersToFolder(viewRef.current.selectedFolders, folder);
        cancel();
        if (typeof body.$evalAsync === 'function') scopeEvalAsync();
      }
      focusSeach();
    });
  };

  const moveToFolderBottom = (node: any) => {
    const selectedFolders = viewRef.current.selectedFolders;
    let msg;
    if (selectedFolders.length === 1) {
      msg = t('dialog.moveFolder.descBottom', [
        { property: 'first', value: selectedFolders[0].name },
        { property: 'target', value: node.name },
      ]);
    } else {
      msg = t('dialog.moveFolder.descBottomMultiple', [
        { property: 'first', value: selectedFolders[0].name },
        { property: 'count', value: String(selectedFolders.length - 1) },
        { property: 'target', value: node.name },
      ]);
    }
    moveConfirm(msg, () => {
      const body = getBodyScope();
      focusSeach();
      const folder = body.folderMappings[node.id];
      if (folder) {
        moveFoldersAsSibling(viewRef.current.selectedFolders, folder, true);
        cancel();
        if (typeof body.$evalAsync === 'function') scopeEvalAsync();
      }
    });
  };

  const cancel = () => {
    setView((prev) => ({ ...prev, open: false }));
    const input = document.querySelector('.move-to-folder-modal input:focus') as HTMLElement | null;
    if (input) input.blur();
  };

  /* getMoveFolderItemClass（75863-75882） */
  const getMoveFolderItemClass = (node: any, folderName: any, selectedFolder: any) => {
    void folderName;
    const result: any = {
      'hover active-item': node == selectedFolder,
      collapsed: !node.isExpand && !filterKeywordRef.current,
      'empty-node': node.children && node.children.length == 0,
      'color-red': node.iconColor == 'red',
      'color-orange': node.iconColor == 'orange',
      'color-yellow': node.iconColor == 'yellow',
      'color-green': node.iconColor == 'green',
      'color-aqua': node.iconColor == 'aqua',
      'color-blue': node.iconColor == 'blue',
      'color-purple': node.iconColor == 'purple',
      'color-pink': node.iconColor == 'pink',
      close: node.children && node.children.length <= 0 && node.isExpand,
      disabled: !!selectedFoldersMappingsRef.current[node.id],
    };

    result['icon-' + node.icon] = true;
    return result;
  };

  const classOf = (cls: any) =>
    Object.keys(cls)
      .filter((k) => cls[k])
      .join(' ');

  const keywordChange = (kw: string) => {
    const w = window as any;
    // 一律清除強制展開的功能
    w.eagle.utils.tree.walk(foldersRef.current, 'children', (folder: any) => {
      delete folder.showChildren;
    });
    filterKeywordRef.current = kw;
    const resultList = renderFolderList();
    setView((prev) => ({ ...prev, selectedFolder: resultList[0] }));
    scrollToTop();
  };

  const onInputChange = (event: any) => {
    const value = event.target.value;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      keywordChange(value);
    }, 50);
  };

  const onInputBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const input = document.getElementById('move-folder-search') as HTMLInputElement | null;
    if (input && input.value !== filterKeywordRef.current) {
      keywordChange(input.value);
    }
  };

  const sizes = useMemo(() => view.resultList.map((node) => node.size || 27), [view.resultList]);
  const win = useVirtualWindow(listRef, sizes, `${view.resultList.length}:${view.open}:${filterKeywordRef.current}`);

  const preventMiddleClick = (event: any) => {
    const body = getBodyScope();
    if (body && typeof body.preventMiddleClick === 'function') body.preventMiddleClick(event);
  };

  const renderNode = (node: any, idx: number) => {
    const style = { zIndex: 100000 - idx, height: `${node.size}px` };
    switch (node.vstype) {
      case 'label-folder':
        return (
          <div key={idx}>
            <div className="sidebar-item-label" style={style}>
              <div className="sidebar-item-label-warp">
                <div className="name expandable">{t('modal.moveFolder.tipLabel')}</div>
              </div>
            </div>
          </div>
        );
      case 'separator':
        return <div key={idx} className="separator" style={style}></div>;
      case 'folder':
        return (
          <div key={idx}>
            <div
              id={`modal-move-folder-${node.id}`}
              className={`item depth-${node.styles.depth} ${classOf(getMoveFolderItemClass(node, node.name, view.selectedFolder))}`}
              style={style}
              onMouseDown={preventMiddleClick}
            >
              <Guidelines node={node} />
              <div className="expand-icon" onClick={(e) => toggleFolder(e, node)}>
                <img src={iconSrc(theme, 'ic-arrow-right.svg')} />
              </div>
              <div className="icon">
                <div className="fake-svg png"></div>
              </div>
              <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(node.name, filterKeywordRef.current) }}></div>
              <div className="active-bg"></div>
              <div className="multiple-drop-folder-top-area" onClick={() => moveToFolderTop(node)}></div>
              <div className="multiple-drop-folder-name-area" onClick={() => moveToFolderInner(node)}></div>
              <div className="multiple-drop-folder-bottom-area" onClick={() => moveToFolderBottom(node)}></div>
            </div>
          </div>
        );
      default:
        return <div key={idx}></div>;
    }
  };

  if (!host) return null;

  return createPortal(
    <>
      <div
        className={`modal move-folder-modal${view.open ? ' open' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          focusSeach();
        }}
      >
        <div className="modal-header">
          <div className="name">{t('context.folder.moveFolder')}</div>
          <div className="close" onClick={() => cancel()}></div>
        </div>
        <div className="section search">
          <div className="search">
            <input
              id="move-folder-search"
              ref={searchRef}
              maxLength={1024}
              type="search"
              placeholder={t('modal.moveFolder.searchPlaceholder')}
              onKeyDown={onSearchKeyup}
              onChange={onInputChange}
              onBlur={onInputBlur}
              tabIndex={-1}
            />
          </div>
        </div>
        <div className="search-result">
          <div className="result-content">
            {/* 空状态 */}
            {view.resultList.length == 2 ? <div className="empty-state">{t('modal.moveFolder.searchEmpty')}</div> : null}

            <div className="sidebar-item-container" style={ngShow(view.resultList.length > 0)} ref={listRef}>
              <div className="vs-repeat-before-content" style={{ height: `${win.beforeSize}px` }} />
              {view.resultList.slice(win.startIndex, win.endIndex).map((node, i) => renderNode(node, win.startIndex + i))}
              <div className="vs-repeat-after-content" style={{ height: `${win.afterSize}px` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="move-folder-modal-overlay modal-overlay" onClick={() => cancel()}></div>
    </>,
    host
  );
}
