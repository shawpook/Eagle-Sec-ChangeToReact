import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { updateSidebarList } from '../../services/sidebarService';
import { calculateImageBinding } from '../../services/gridBindingService';
import { saveFolder } from '../../services/folderService';
import { t } from '../../global/eagleGlobals';
import { numberFixedLen } from '../../app/filters';
import { getIpc, req } from '../detail/detailHooks';
import { deepCopy, openAppContextMenu, FolderSelectPanel } from './selectPanelEngine';
import { ayncsImagesChange, hiddenByCurrentFilter } from './FolderModals';
import { ExtIcon } from '../inspector/Inspector';
import { useVsRepeat } from './FolderSelectPanels';
import { syncUploadFromScope } from '../../store/uploadState';
import { getBodyScope, getRootScope } from '../../core/appCore';
import { openFolder } from '../../services/folderCoreService';
import { addToRecentFolders } from '../../services/batchOpsService';
import { uploadUrls } from '../../services/uploadService';
import { calculateImageBindingChannel, importArtstationChannel, importImagesChannel, openRenameChannel } from '../../global/bus';
import { useItemState } from '../../store/itemState';

/**
 * 阶段7d-2：batchRenameModal + artstationImportModal 接管。
 *
 * 规范来源：
 * - artstationImportModal = bundle 76464-76783（镜像 js/directives/artstation-import-modal.js）
 *   + artstation-import-modal.html
 * - batchRenameModal = bundle 76783-77785（镜像 js/directives/batch-rename-modal.js）
 *   + batch-rename-modal.html + findStringAutocomplete 指令（模板内联渲染）
 * - autoFocus 指令 = bundle 73003-73014（OPEN_RENAME 广播 → $timeout(100) → click+focus+select）
 *
 * 通道零改动：OPEN_RENAME / IMPORT_ARTSTATION / IMPORT_IMAGES / CALCULATE_IMAGE_BINDING 广播、
 * ipc 'import-artstation'；localStorage 键 BATCH_RENAME_LAST_NAME /
 * BATCH_RENAME_HISTORY_{TYPE}_FIND_STRING 原样。
 * bundle 闭包依赖等价：emojiRegex（19014 常量字面量随函数体带入）、moment/sanitize 经
 * require/window 等价获取、is.js（window.is）、FileUrlHelper（window 属性）。
 */

const ngShow = (show: boolean) => (show ? undefined : ({ display: 'none' } as React.CSSProperties));
const w = () => window as any;

// bundle 19014（closure const，随移植按字面量带入）
const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu;

/**
 * Angular $exceptionHandler 等价（log + 继续）：原版 $watch/$on/ng-click 中抛出的异常
 * 经 digest 冒泡到 $exceptionHandler（console.error 后应用继续运行）；React 未捕获异常
 * 会静默卸载整棵树，故在等价边界捕获并 console.error，两种环境下行为与原版一致。
 */
const ngSafe = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    console.error(e);
  }
};

/* ================= artstationImportModal（76464-76783 + 模板逐字） ================= */

export function ArtstationImportModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const [urlError, setUrlError] = useState<any>(false);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);

  const importFoldersRef = useRef<any[]>([]);
  const currentRef = useRef(0);
  const totalRef = useRef(0);
  const userNameRef = useRef<any>(undefined);
  const pageUrlRef = useRef('');
  pageUrlRef.current = pageUrl;
  const isLoadingRef = useRef(false);
  isLoadingRef.current = isLoading;
  const urlErrorRef = useRef<any>(false);
  urlErrorRef.current = urlError;
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const setImportFolders = (next: any[]) => {
    importFoldersRef.current = next;
    bumpAll();
  };

  const close = () => {
    setIsOpen(false);
    setIsLoading(false);
    totalRef.current = 0;
    currentRef.current = 0;
    bumpAll();
  };

  const selectFolders = () => {
    const body = getBodyScope();
    const folders = body.folders;
    const originalSelectedIds = importFoldersRef.current.reduce(
      (map: any, folder: any) => {
        map[folder.id] = true;
        return map;
      },
      {} as any
    );
    FolderSelectPanel.open({
      folders: folders,
      selectedIds: originalSelectedIds,
      onChanged: (result: any) => {
        if (!result?.isDirty) return;

        const { selectedFolderIds } = result;
        void selectedFolderIds;

        const next: any[] = [];
        Object.keys(result.selectedFolderIds).forEach((id) => {
          const folder = body.folderMappings[id];
          if (folder) {
            next.push(folder);
          }
        });
        importFoldersRef.current = next;
        bumpAll();
      },
    });
  };

  const createNewFolder = (title: any) => {
    const body = getBodyScope();
    const folder = {
      id: w().guid(),
      name: title,
      tags: [],
      images: [],
      children: [],
      modificationTime: Date.now(),
      imagesMappings: {},
      isExpand: true,
      description: `${pageUrlRef.current}`,
    };
    body.folders.push(folder);
    body.folderMappings[folder.id] = folder;
    updateSidebarList();
    calculateImageBinding();
    saveFolder();
    return folder;
  };

  const getFolderNames = () => {
    if (importFoldersRef.current.length === 0) return t('modal.artstation.defaultFolder');
    return importFoldersRef.current
      .map(function (fd: any) {
        return fd.name;
      })
      .join(',');
  };

  const open = () => {
    importFoldersRef.current = [];
    currentRef.current = 0;
    totalRef.current = 0;
    bumpAll();
    // $timeout(300)
    setTimeout(() => {
      setIsOpen(true);
      setTimeout(() => {
        const input = document.getElementById('artstation-url') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
      }, 300);
    }, 300);
  };

  useEffect(() => {
    setHost(document.getElementById('eagle-artstation-import-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;

    const off = importArtstationChannel.on(() => {
      open();
    });

    // ipcRenderer.on('import-artstation')（通道零改动）
    const ipc = getIpc();
    const ipcHandler = () => {
      open();
      bumpAll();
    };
    if (ipc && ipc.on) {
      ipc.on('import-artstation', ipcHandler);
    }

    return () => {
      if (off) off();
      if (ipc && ipc.off) ipc.off('import-artstation', ipcHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const vaildateUrl = () => {
    if (!pageUrlRef.current) return;
    let nextError: any;
    if (!w().Artstation.isValidUrl(pageUrlRef.current)) {
      nextError = true;
    } else {
      if (!pageUrlRef.current.match(/^[a-zA-Z]+:\/\//)) {
        const prefixed = 'https://' + pageUrlRef.current;
        pageUrlRef.current = prefixed;
        setPageUrl(prefixed);
      }
      nextError = false;
    }
    setUrlError(nextError);
    return nextError;
  };
  const vaildateUrlRef = useRef(vaildateUrl);
  vaildateUrlRef.current = vaildateUrl;

  const importRef = useRef<(params: any) => void>(() => {});

  const importUrl = () => {
    if (!pageUrlRef.current) return;
    if (isLoadingRef.current) return;
    if (vaildateUrlRef.current()) return;

    setIsLoading(true);

    // 修改 refer 避免图片呈现不出来
    const refer =
      pageUrlRef.current.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) && pageUrlRef.current.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i)![0];
    const remote = req('@electron/remote');
    remote.require('electron-referer')(refer, remote.getCurrentWindow());

    currentRef.current = 0;
    console.info('下载网址：' + pageUrlRef.current);
    w().Artstation.getUserInfo(pageUrlRef.current, (err: any, result: any) => {
      if (err) {
        console.log(err);
        return;
      }

      currentRef.current = 0;
      totalRef.current = result.total;
      userNameRef.current = result.userName;
      bumpAll();

      console.info('用户 %s 拥有 %d 张图片', result.userName, result.total);

      w().Artstation.getUserProjects(
        {
          total: result.total,
          userName: result.userName,
          url: result.url,
        },
        (err2: any, images: any) => {
          if (err2) return;
          currentRef.current += images.length;
          console.info('下载进度 %d / %d', currentRef.current, result.total);
          bumpAll();
        },
        (err3: any, result2: any) => {
          console.info('下载完成，共下载了 %d 张图片', currentRef.current);
          console.log(result2);
          setIsLoading(false);
          importRef.current({
            title: userNameRef.current,
            images: result2,
          });
          bumpAll();
        }
      );
    });
  };

  const getImageType = (link: any) => {
    if (link.indexOf('.png') > -1) {
      return 'png';
    } else {
      return 'jpg';
    }
  };

  const importUrlManual = () => {
    if (!pageUrlRef.current) return;
    if (isLoadingRef.current) return;
    if (vaildateUrlRef.current()) return;

    setIsLoading(true);

    // 修改 refer 避免图片呈现不出来
    const refer =
      pageUrlRef.current.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) && pageUrlRef.current.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i)![0];
    const remote = req('@electron/remote');
    remote.require('electron-referer')(refer, remote.getCurrentWindow());

    currentRef.current = 0;
    console.info('下载网址：' + pageUrlRef.current);
    w().Artstation.getUserInfo(pageUrlRef.current, (err: any, result: any) => {
      if (err) {
        console.log(err);
        return;
      }

      currentRef.current = 0;
      totalRef.current = result.total;
      userNameRef.current = result.userName;
      bumpAll();

      console.info('用户 %s 拥有 %d 张图片', result.userName, result.total);

      w().Artstation.getUserProjects(
        {
          total: result.total,
          userName: result.userName,
          url: result.url,
        },
        (err2: any, images: any) => {
          if (err2) return;
          currentRef.current += images.length;
          console.info('下载进度 %d / %d', currentRef.current, result.total);
          bumpAll();
        },
        (err3: any, result2: any) => {
          console.info('下载完成，共下载了 %d 张图片', currentRef.current);
          console.log(result2);
          setIsLoading(false);

          const title = userNameRef.current;
          const images: any[] = [];

          result2.forEach(function (img: any) {
            const image: any = {
              title: img.title,
              src: img.src,
              url: img.link || pageUrlRef.current,
              // 原版字面量 type 出现两次（getImageType(...) 被 "image" 覆盖）——按最终生效值直写
              type: 'image',
              width: img.width || 200,
              height: img.height || 200,
            };

            images.push(image);
          });

          let importFolders = importFoldersRef.current;
          if (importFolders.length === 0) {
            const newFolder = createNewFolder(userNameRef.current);
            importFolders = [newFolder];
          }

          importImagesChannel.emit({
            title: userNameRef.current,
            url: pageUrlRef.current,
            images: images,
            importFolders: importFolders,
          });

          close();
          bumpAll();
        }
      );
    });
  };

  const urlKeydown = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 27) {
      close();
    } else if (keyCode === 13) {
      if (event.metaKey || event.ctrlKey) {
        event.target?.blur?.();
        importUrl();
      }
    }
  };

  // import(params)（76876-76930 逐字；挂到 ref 供 importUrl 回调引用）
  importRef.current = (params: any) => {
    if (isLoadingRef.current) return;

    if (!params.title) {
      return;
    }

    setIsLoading(true);

    const images = params.images;

    if (images.length > 0) {
      const names: any[] = [];
      const tags: any[] = [];
      const types: any[] = [];
      const originals: any[] = [];
      const imageUrls: any[] = [];
      images.forEach(function (image: any) {
        imageUrls.push(image.src);
        names.push(image.title.replace(/%/g, '').replace(/[:|"<>,.^&*?//-]+/g, '').substr(0, 36) || w().guid());
        originals.push(image.link || pageUrlRef.current);
        getBodyScope().uploadQueue.push({});
        syncUploadFromScope();
      });

      let selectedFolderIds: any[] = [];
      if (importFoldersRef.current.length === 0) {
        const newFolder = createNewFolder(userNameRef.current);
        selectedFolderIds = [newFolder.id];
      } else {
        selectedFolderIds = importFoldersRef.current.map(function (fd: any) {
          return fd.id;
        });
      }

      if (selectedFolderIds[0]) {
        openFolder(useItemState.getState().folderMappings[selectedFolderIds[0]]);
      }

      addToRecentFolders(selectedFolderIds);
      uploadUrls(imageUrls, selectedFolderIds, {
        names: names,
        urls: originals,
        tags: tags,
      });

      void types;
      if (w().electronLog) w().electronLog.info(`[app] Import Artstation link: ${pageUrlRef.current}，total: ${imageUrls.length} links`);
      w().analytics.event('Artstation', 'Import', pageUrlRef.current);
    }

    close();
    bumpAll();
  };

  // 闭环测试契约（refs 直读，避免闭包过期）
  (window as any).__eagleArtstation = {
    vaildateUrl: () => vaildateUrlRef.current(),
    get urlError() {
      return urlErrorRef.current;
    },
    get pageUrl() {
      return pageUrlRef.current;
    },
    get isOpen() {
      return isOpenRef.current;
    },
  };

  if (!host) return null;

  return createPortal(
    <>
      {isOpen && (
        <div id="artstation-import-modal" className="import-modal open">
          <div className="close" onClick={() => ngSafe(() => close())}>
            <img src="assets/images/light/icons/ic-modal-close.svg" />
          </div>
          {isLoading && (
            <div className="loader">
              <svg className="spinner" width="32px" height="32px" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
                <circle className="path" fill="none" strokeWidth="3" strokeLinecap="round" cx="33" cy="33" r="30" />
              </svg>
              <div className="message">
                {t('modal.importArtstation.loading')}
                <span className="counter" style={ngShow(!!totalRef.current)}>
                  ({currentRef.current}/{totalRef.current})
                </span>
              </div>
            </div>
          )}
          <div className="title">
            <img src="./images/icon-artstation.png" alt="" />
            <h2>{t('modal.importArtstation.title')}</h2>
          </div>
          <div className="form">
            <div className="margin-m" />
            <label htmlFor="">{t('modal.importArtstation.urlLabel')}</label>
            <input
              id="artstation-url"
              type="text"
              maxLength={1024}
              tabIndex={-1}
              placeholder="https://www.artstation.com/user_name"
              value={pageUrl}
              onChange={(e: any) => {
                // ref 同步更新（Angular ng-model 在 digest 内同步；React setState 异步冲刷）
                pageUrlRef.current = e.target.value;
                setPageUrl(e.target.value);
              }}
              onBlur={() => ngSafe(() => vaildateUrl())}
              className={urlError ? 'error' : ''}
              onKeyDown={(e: any) => ngSafe(() => urlKeydown(e))}
            />
            <div className="error-message" style={ngShow(!!urlError)}>
              {t('modal.importArtstation.urlError')}
            </div>

            <div className="margin-m" />
            <div>
              <label htmlFor="">{t('modal.importArtstation.folderLabel')}</label>
              <div className="select select-xs folder">
                <select
                  tabIndex={-1}
                  onMouseDown={(e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ngSafe(() => selectFolders());
                  }}
                >
                  <option value="none">{getFolderNames()}</option>
                </select>
              </div>
            </div>
            <div className="margin-m" />
            <div className="row">
              <div className="col-md-8">
                <div className="btn red" onClick={() => ngSafe(() => importUrl())}>
                  {t('modal.importArtstation.import')}
                </div>
              </div>
              <div className="col-md-4" style={{ paddingLeft: 0 }}>
                <div className="btn import-manual" onClick={() => ngSafe(() => importUrlManual())}>
                  {t('modal.importArtstation.importManual')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="import-modal-overlay" />
    </>,
    host
  );
}

/* ================= batchRenameModal（76783-77785 + 模板逐字） ================= */

function createRegexFromString(regexString: string) {
  // Match the pattern and the flags within the slashes.
  const match = regexString.match(/^\/(.+)\/([a-z]*)$/);
  if (!match) {
    throw new Error('Invalid regex format');
  }

  // Extract pattern and flags from the regex string
  const [_, pattern, flags] = match;

  // Return the RegExp object
  return new RegExp(pattern, flags);
}

// 獲取特定類型的搜尋歷史（77579-77584 逐字）
function getFindStringHistory(type: string) {
  const key = `BATCH_RENAME_HISTORY_${type}_FIND_STRING`;
  const history = localStorage.getItem(key);
  return history ? JSON.parse(history) : [];
}

// 保存搜尋歷史（77586-77604 逐字）
function saveFindStringHistory(type: string, value: string) {
  if (!value || value.trim() === '') return;

  const key = `BATCH_RENAME_HISTORY_${type}_FIND_STRING`;
  let history: any[] = getFindStringHistory(type);

  // 如果已經存在相同值，先移除
  history = history.filter((item: any) => item !== value);

  // 添加到歷史的開頭
  history.unshift(value);

  // 保持最多10個記錄
  if (history.length > 10) {
    history = history.slice(0, 10);
  }

  localStorage.setItem(key, JSON.stringify(history));
}

export function BatchRenameModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [startAt, setStartAt] = useState<any>(1);
  const [findString, setFindString] = useState('');
  const [replaceString, setReplaceString] = useState('');
  const [replaceMethod, setReplaceMethod] = useState('format');
  const [textCase, setTextCase] = useState('none');
  const [previews, setPreviews] = useState<any[]>([]);
  const [hasIndex, setHasIndex] = useState(false);
  const [hasDate, setHasDate] = useState(false);
  const [hasTags, setHasTags] = useState(false);
  const [hasFolders, setHasFolders] = useState(false);
  const [hasOriginal, setHasOriginal] = useState(false);
  const [showFindStringAutocomplete, setShowFindStringAutocomplete] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [findStringHistory, setFindStringHistory] = useState<any[]>([]);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);

  const itemsRef = useRef<any>(undefined);
  const typeRef = useRef('');
  const isRenaingRef = useRef(false);
  const regexRef = useRef<any>(undefined);
  const isRegexRef = useRef(false);
  const tempFindStringRef = useRef<any>(undefined);
  const newNameRef = useRef('');
  const startAtRef = useRef<any>(1);
  const findStringRef = useRef('');
  const replaceStringRef = useRef('');
  const replaceMethodRef = useRef('format');
  const textCaseRef = useRef('none');
  newNameRef.current = newName;
  startAtRef.current = startAt;
  findStringRef.current = findString;
  replaceStringRef.current = replaceString;
  replaceMethodRef.current = replaceMethod;
  textCaseRef.current = textCase;

  const newNameInputRef = useRef<HTMLInputElement>(null);
  const findStringInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLElement | null>(null);

  const updatePreviewRef = useRef<() => void>(() => {});

  const applyTextCase = (text: any) => {
    if (!text) return text;

    switch (textCaseRef.current) {
      case 'uppercase':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      case 'capitalize':
        return text.replace(/\w\S*/g, function (txt: string) {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
      default:
        return text;
    }
  };

  // format（77107-77246 逐字；moment/sanitize/emojiRegex/is 等按等价方式消费）
  const format = (item: any, name: string, options: any) => {
    const moment = w().require('moment');
    const originName = options.originName;
    const idx = options.idx;
    const now = new Date();

    // 現有的日期格式
    const date1 = moment(now).format('YYYY-MM-DD');
    const date2 = moment(now).format('MM-DD');
    const date3 = moment(now).format('ll');
    const dateHM = moment(now).format('YYYY-MM-DD HH_mm');
    const dateHMS = moment(now).format('YYYY-MM-DD HH_mm_ss');

    // 新增修改時間和創建時間
    const modifiedTime = item.mtime ? new Date(item.mtime) : item.modificationTime ? new Date(item.modificationTime) : now;
    const createdTime = item.btime ? new Date(item.btime) : item.modificationTime ? new Date(item.modificationTime) : now;

    // 現有的日期格式
    const mTime1 = moment(modifiedTime).format('YYYY_MM_DD');
    const mTime2 = moment(modifiedTime).format('MM_DD');
    const mTime3 = moment(modifiedTime).format('ll');
    const mTimeHM = moment(modifiedTime).format('YYYY_MM_DD HH_mm');
    const mTimeHMS = moment(modifiedTime).format('YYYY_MM_DD HH_mm_ss');

    const bTime1 = moment(createdTime).format('YYYY_MM_DD');
    const bTime2 = moment(createdTime).format('MM_DD');
    const bTime3 = moment(createdTime).format('ll');
    const bTimeHM = moment(createdTime).format('YYYY_MM_DD HH_mm');
    const bTimeHMS = moment(createdTime).format('YYYY_MM_DD HH_mm_ss');

    let newName = name;
    try {
      newName = newName.replace(/%NNNNNNNNN+/i, numberFixedLen(idx, 9));
      newName = newName.replace(/%nnnnnnnnn+/i, numberFixedLen(idx, 9));
      newName = newName.replace(/%NNNNNNNNN/i, numberFixedLen(idx, 8));
      newName = newName.replace(/%nnnnnnnnn/i, numberFixedLen(idx, 8));
      newName = newName.replace(/%NNNNNNNN/i, numberFixedLen(idx, 8));
      newName = newName.replace(/%nnnnnnnn/i, numberFixedLen(idx, 8));
      newName = newName.replace(/%NNNNNNN/i, numberFixedLen(idx, 7));
      newName = newName.replace(/%nnnnnnn/i, numberFixedLen(idx, 7));
      newName = newName.replace(/%NNNNNN/i, numberFixedLen(idx, 6));
      newName = newName.replace(/%nnnnnn/i, numberFixedLen(idx, 6));
      newName = newName.replace(/%NNNNN/i, numberFixedLen(idx, 5));
      newName = newName.replace(/%nnnnn/i, numberFixedLen(idx, 5));
      newName = newName.replace(/%NNNN/i, numberFixedLen(idx, 4));
      newName = newName.replace(/%nnnn/i, numberFixedLen(idx, 4));
      newName = newName.replace(/%NNN/i, numberFixedLen(idx, 3));
      newName = newName.replace(/%nnn/i, numberFixedLen(idx, 3));
      newName = newName.replace(/%NN/i, numberFixedLen(idx, 2));
      newName = newName.replace(/%nn/i, numberFixedLen(idx, 2));
      newName = newName.replace(/%N/i, numberFixedLen(idx, 1));
      newName = newName.replace(/%n/i, numberFixedLen(idx, 1));
      newName = newName.replace(/%DDD+/i, date3);
      newName = newName.replace(/%DDD/i, date3);
      newName = newName.replace(/%DD/i, date2);
      newName = newName.replace(/%DHMS/i, dateHMS);
      newName = newName.replace(/%DHM/i, dateHM);
      newName = newName.replace(/%D/i, date1);
      newName = newName.replace(/%ddd+/i, date3);
      newName = newName.replace(/%ddd/i, date3);
      newName = newName.replace(/%dd/i, date2);
      newName = newName.replace(/%dhms/i, dateHMS);
      newName = newName.replace(/%dhm/i, dateHM);
      newName = newName.replace(/%d/i, date1);

      // 修改時間格式
      newName = newName.replace(/%MMM+/i, mTime3);
      newName = newName.replace(/%MMM/i, mTime3);
      newName = newName.replace(/%MM/i, mTime2);
      newName = newName.replace(/%MHMS/i, mTimeHMS);
      newName = newName.replace(/%MHM/i, mTimeHM);
      newName = newName.replace(/%M/i, mTime1);

      // 小寫版本
      newName = newName.replace(/%mmm+/i, mTime3);
      newName = newName.replace(/%mmm/i, mTime3);
      newName = newName.replace(/%mm/i, mTime2);
      newName = newName.replace(/%mhms/i, mTimeHMS);
      newName = newName.replace(/%mhm/i, mTimeHM);
      newName = newName.replace(/%m/i, mTime1);

      // 創建時間格式
      newName = newName.replace(/%BBB+/i, bTime3);
      newName = newName.replace(/%BBB/i, bTime3);
      newName = newName.replace(/%BB/i, bTime2);
      newName = newName.replace(/%BHMS/i, bTimeHMS);
      newName = newName.replace(/%BHM/i, bTimeHM);
      newName = newName.replace(/%B/i, bTime1);

      // 小寫版本
      newName = newName.replace(/%bbb+/i, bTime3);
      newName = newName.replace(/%bbb/i, bTime3);
      newName = newName.replace(/%bb/i, bTime2);
      newName = newName.replace(/%bhms/i, bTimeHMS);
      newName = newName.replace(/%bhm/i, bTimeHM);
      newName = newName.replace(/%b/i, bTime1);

      newName = newName.replace(/\*/i, originName);
      if (newName.match('%T')) {
        let tagString = '';
        if (item.tags && item.tags.length > 0) {
          tagString = item.tags.sort().join('-');
          newName = newName.replace(/%T/i, tagString);
        } else {
          newName = newName.replace(/%T/i, '');
        }
      }
      if (newName.match('%F')) {
        let folderString = '';
        if (item.folders && item.folders.length > 0) {
          // 使用 folderMappings 將 folder id 轉換為名稱
          const folderNames: any[] = [];
          item.folders.forEach((id: any) => {
            const body = getBodyScope();
            if (body.folderMappings && body.folderMappings[id]) {
              folderNames.push(body.folderMappings[id].name);
            }
          });
          if (folderNames.length > 0) {
            folderString = folderNames.sort().join('-');
          }
          newName = newName.replace(/%F/i, folderString);
        } else {
          newName = newName.replace(/%F/i, '');
        }
      }
      if (typeRef.current === 'IMAGE') {
        newName = newName.replace(/[/]/g, '').replace(emojiRegex, '').replace(/%/g, '');
        newName = w().sanitize(newName);
      }
      if (newName.length === 0) {
        newName = originName;
      }
    } catch (e) {
      newName = originName;
    }
    newName = newName.substr(0, 255);
    return newName;
  };

  const updatePreview = () => {
    const newNameVal = newNameRef.current || '';
    const newNameLower = newNameVal.toLowerCase();

    const getBeforeHTML = (name: any) => {
      // 如果原始文字出現 findString，就將一樣的字串加上刪除線
      if (findStringRef.current) {
        const findStringEsc = findStringRef.current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (isRegexRef.current) {
          name = name.replace(regexRef.current, `<s>$&</s>`).replaceAll(/\\/g, '');
        } else {
          name = name.replace(new RegExp(findStringEsc, 'g'), `<s>${findStringEsc}</s>`).replaceAll(/\\/g, '');
        }
      }
      return name;
    };

    const getAfterHTML = (name: any) => {
      // 如果原始文字出現 replaceString，就將一樣的字串加上<b></b>
      const replaceStringVal = replaceStringRef.current || '';
      const replaceStringEsc = replaceStringVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (isRegexRef.current) {
        name = name.replace(regexRef.current, `<b>${replaceStringEsc}</b>`).replaceAll(/\\/g, '');
      } else {
        name = name.replace(new RegExp(replaceStringEsc, 'g'), `<b>${replaceStringEsc}</b>`).replaceAll(/\\/g, '');
      }
      return name;
    };

    if (!itemsRef.current) return;
    let nextPreviews: any[] = [];
    if (replaceMethodRef.current === 'format') {
      nextPreviews = itemsRef.current.map((item: any, index: number) => {
        let formattedName = format(item, newNameVal, {
          originName: item.name,
          idx: index + parseInt(startAtRef.current),
        });

        // 應用大小寫轉換
        formattedName = applyTextCase(formattedName);

        return {
          item: item,
          thumbnail: typeRef.current === 'IMAGE' ? w().FileUrlHelper.getLastestThumbnailUrl(item) : null,
          before: item.name,
          after: formattedName,
        };
      });
    } else {
      nextPreviews = itemsRef.current.map((item: any, index: number) => {
        let replacedName: any;
        if (isRegexRef.current) {
          replacedName = item.name.replace(regexRef.current, replaceStringRef.current);
        } else {
          replacedName = item.name.split(findStringRef.current).join(replaceStringRef.current);
        }

        // 應用大小寫轉換
        replacedName = applyTextCase(replacedName);

        return {
          item: item,
          thumbnail: typeRef.current === 'IMAGE' ? w().FileUrlHelper.getLastestThumbnailUrl(item) : null,
          before: getBeforeHTML(item.name),
          after: getAfterHTML(replacedName),
        };
      });
    }
    setPreviews(nextPreviews);

    setHasIndex(newNameLower.indexOf('%n') > -1);
    setHasDate(newNameLower.indexOf('%d') > -1 || newNameLower.indexOf('%m') > -1 || newNameLower.indexOf('%b') > -1);
    setHasTags(newNameLower.indexOf('%t') > -1);
    setHasFolders(newNameLower.indexOf('%f') > -1);
    setHasOriginal(newNameLower.indexOf('*') > -1);
  };
  updatePreviewRef.current = updatePreview;

  // 監聽名稱、開始編號（$watch("[newName, startAt]") 等价）
  useEffect(() => {
    ngSafe(() => {
      if (!w().is.number(startAt)) {
        setStartAt(1);
        return;
      }
      if (startAt < 0) {
        setStartAt(0);
        return;
      }
      updatePreviewRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newName, startAt]);

  // 監聽取代字串（$watch("[findString, replaceString]") 等价）
  useEffect(() => {
    try {
      regexRef.current = createRegexFromString(findStringRef.current);
      isRegexRef.current = true;
    } catch (e) {
      isRegexRef.current = false;
    }
    ngSafe(() => updatePreviewRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findString, replaceString]);

  const changeReplaceMethod = (mode: any) => {
    setReplaceMethod(mode);
    replaceMethodRef.current = mode;
    updatePreviewRef.current();
    setTimeout(() => {
      focusInputRef.current();
    }, 100);
  };

  const focusInput = () => {
    setTimeout(() => {
      const modal = modalRef.current;
      if (!modal) return;
      const inputs = Array.from(modal.querySelectorAll("input[type='text'], input[type='number']")) as HTMLInputElement[];
      const visible = inputs.find((el) => el.offsetParent !== null);
      if (visible) visible.focus();
    }, 24);
  };
  const focusInputRef = useRef(focusInput);
  focusInputRef.current = focusInput;

  // 快速鍵綁定（77190-77212 逐字）
  const onKeydown = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 27) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (keyCode === 13) {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        if (replaceMethodRef.current !== 'format') {
          if (!findStringRef.current) return;
        } else {
          if (!newNameRef.current || !w().is.number(startAtRef.current)) return;
        }
        event.target?.blur?.();
        renameRef.current();
      }
    }
  };

  const insertIndex = () => {
    const item = itemsRef.current[0];
    const items = ['%N', '%NN', '%NNN', '%NNNN'].map((label) => {
      return {
        label: format(item, newNameRef.current + label, {
          originName: item.name,
          idx: parseInt(startAtRef.current),
        }),
        accelerator: label,
        click: () => {
          setNewName(newNameRef.current + label);
          newNameRef.current = newNameRef.current + label;
          bumpAll();
        },
      };
    });

    openAppContextMenu({
      items: items,
      showSearch: false,
      onClosed: () => {
        focusInputRef.current();
      },
    });
  };

  const insertDate = () => {
    const item = itemsRef.current[0];

    // 導入時間選項
    const currentDateItems = ['%D', '%DD', '%DDD', '%DHM', '%DHMS'].map((label) => {
      return {
        label: format(item, newNameRef.current + label, {
          originName: item.name,
          idx: parseInt(startAtRef.current),
        }),
        accelerator: label,
        click: () => {
          setNewName(newNameRef.current + label);
          newNameRef.current = newNameRef.current + label;
          bumpAll();
        },
      };
    });

    // 創建時間選項
    const createdDateItems = ['%B', '%BB', '%BBB', '%BHM', '%BHMS'].map((label) => {
      return {
        label: format(item, newNameRef.current + label, {
          originName: item.name,
          idx: parseInt(startAtRef.current),
        }),
        accelerator: label,
        click: () => {
          setNewName(newNameRef.current + label);
          newNameRef.current = newNameRef.current + label;
          bumpAll();
        },
      };
    });

    // 修改時間選項
    const modifiedDateItems = ['%M', '%MM', '%MMM', '%MHM', '%MHMS'].map((label) => {
      return {
        label: format(item, newNameRef.current + label, {
          originName: item.name,
          idx: parseInt(startAtRef.current),
        }),
        accelerator: label,
        click: () => {
          setNewName(newNameRef.current + label);
          newNameRef.current = newNameRef.current + label;
          bumpAll();
        },
      };
    });

    // 組合所有選項
    const items = [
      { role: 'label', label: t('inspector.props.createAt') },
      ...currentDateItems,
      { role: 'separator' },
      { role: 'label', label: t('inspector.props.btime') },
      ...createdDateItems,
      { role: 'separator' },
      { role: 'label', label: t('inspector.props.mtime') },
      ...modifiedDateItems,
    ];

    openAppContextMenu({
      items: items,
      showSearch: false,
      onClosed: () => {
        focusInputRef.current();
      },
    });
  };

  const insertTags = () => {
    const item = itemsRef.current[0];
    const items = ['%T'].map((label) => {
      return {
        label: format(item, newNameRef.current + label, {
          originName: item.name,
          idx: parseInt(startAtRef.current),
        }),
        accelerator: label,
        click: () => {
          setNewName(newNameRef.current + label);
          newNameRef.current = newNameRef.current + label;
          bumpAll();
        },
      };
    });

    openAppContextMenu({
      items: items,
      showSearch: false,
      onClosed: () => {
        focusInputRef.current();
      },
    });
  };

  const insertFolders = () => {
    const item = itemsRef.current[0];
    const items = ['%F'].map((label) => {
      return {
        label: format(item, newNameRef.current + label, {
          originName: item.name,
          idx: parseInt(startAtRef.current),
        }),
        accelerator: label,
        click: () => {
          setNewName(newNameRef.current + label);
          newNameRef.current = newNameRef.current + label;
          bumpAll();
        },
      };
    });

    openAppContextMenu({
      items: items,
      showSearch: false,
      onClosed: () => {
        focusInputRef.current();
      },
    });
  };

  const insertOriginal = () => {
    const item = itemsRef.current[0];
    const items = ['*'].map((label) => {
      return {
        label: format(item, newNameRef.current + label, {
          originName: item.name,
          idx: parseInt(startAtRef.current),
        }),
        accelerator: label,
        click: () => {
          setNewName(newNameRef.current + label);
          newNameRef.current = newNameRef.current + label;
          bumpAll();
        },
      };
    });

    openAppContextMenu({
      items: items,
      showSearch: false,
      onClosed: () => {
        focusInputRef.current();
      },
    });
  };

  // 重命名按鈕點擊時（77249-77300 逐字）
  const rename = () => {
    const renameInner = () => {
      if (isRenaingRef.current) return;

      isRenaingRef.current = true;

      switch (typeRef.current) {
        case 'IMAGE':
          renameImagesRef.current();
          close();
          break;
        case 'FOLDER':
        case 'SMART_FOLDER':
          renameFoldersRef.current();
          close();
          break;
        case 'TAGS':
          renameTagsRef.current();
          close();
          break;
      }
    };

    let showAlert = 10;
    if (typeRef.current === 'TAGS') {
      showAlert = 2;
    }
    if (itemsRef.current.length >= showAlert) {
      w().swal({
        html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${t('dialog.batchRename.title')}</h4>
                                <p class="alert-desc">${t('dialog.batchRename.desc1') + itemsRef.current.length + t('dialog.batchRename.desc2')}</p>
                            </div>
                        `,
        showCloseButton: false,
        showCancelButton: true,
        allowOutsideClick: false,
        focusConfirm: true,
        focusCancel: false,
        padding: 20,
        width: 400,
        customClass: 'alert-box',
        cancelButtonColor: '#777777',
        confirmButtonText: t('dialog.batchRename.renameBtn'),
        cancelButtonText: t('general.cancel'),
      }).then(function () {
        renameInner();
      });
    } else {
      renameInner();
    }
  };
  const renameRef = useRef(rename);
  renameRef.current = rename;

  // 批次修改圖片名稱（77331-77421 逐字）
  const renameImages = () => {
    const changedItems: any[] = [];
    const originalItems: any[] = [];

    // 全新格式
    if (replaceMethodRef.current == 'format') {
      itemsRef.current.forEach(function (item: any, index: number) {
        const cloneItem = deepCopy(item);
        const originItem = deepCopy(item);
        const originName = cloneItem.name;
        let newNameFormatted = format(item, newNameRef.current, {
          originName: originName,
          idx: index + parseInt(startAtRef.current),
        });

        // 應用大小寫轉換
        newNameFormatted = applyTextCase(newNameFormatted);

        if (cloneItem.name !== newNameFormatted) {
          cloneItem.name = newNameFormatted;
          cloneItem.oldName = originName;
          cloneItem.newName = newNameFormatted;
          changedItems.push(cloneItem);

          originItem.name = originName;
          originItem.oldName = cloneItem.newName;
          originItem.newName = originName;
          originalItems.push(originItem);
        }
      });
      ayncsImagesChange(changedItems);
      hiddenByCurrentFilter(changedItems);
    }

    // 取代字串
    else {
      itemsRef.current.forEach(function (item: any, index: number) {
        const cloneItem = deepCopy(item);
        const originItem = deepCopy(item);
        const originName = cloneItem.name;
        let newNameFormatted: any;

        if (isRegexRef.current) {
          newNameFormatted = originName.replace(regexRef.current, replaceStringRef.current);
        } else {
          newNameFormatted = originName.split(findStringRef.current).join(replaceStringRef.current);
        }

        // 應用大小寫轉換
        newNameFormatted = applyTextCase(newNameFormatted);

        if (cloneItem.name !== newNameFormatted) {
          cloneItem.name = newNameFormatted;
          cloneItem.oldName = originName;
          cloneItem.newName = newNameFormatted;
          changedItems.push(cloneItem);

          originItem.name = originName;
          originItem.oldName = cloneItem.newName;
          originItem.newName = originName;
          originalItems.push(originItem);
        }
      });

      ayncsImagesChange(changedItems);
      hiddenByCurrentFilter(changedItems);

      // 儲存搜尋歷史
      saveFindStringHistory(typeRef.current, findStringRef.current);
    }

    try {
      if (w().electronLog) w().electronLog.info(`[app] Batch rename ${itemsRef.current.length} files, using format: ${replaceMethodRef.current}`);
    } catch (err) {}

    // 復原
    const rootScope = getRootScope();
    let message = t('notify.image.rename', [{ property: 'count', value: String(itemsRef.current.length) }]);
    if (itemsRef.current.length === 1) {
      message = message.replace('images', 'image');
    }
    if (rootScope.notify) {
      rootScope.notify(
        {
          message: message,
          duration: 10000,
        },
        function () {
          ayncsImagesChange(originalItems);
        }
      );
    }

    if (newNameRef.current) {
      localStorage.setItem('BATCH_RENAME_LAST_NAME', newNameRef.current);
    }
  };
  const renameImagesRef = useRef(renameImages);
  renameImagesRef.current = renameImages;

  // 批次修改資料夾名稱（77423-77491 逐字）
  const renameFolders = () => {
    const originNames: any = {};

    // 全新格式
    if (replaceMethodRef.current == 'format') {
      itemsRef.current.forEach(function (item: any, index: number) {
        const originName = item.name;
        let newNameFormatted = format(item, newNameRef.current, {
          originName: originName,
          idx: index + parseInt(startAtRef.current),
        });

        // 應用大小寫轉換
        newNameFormatted = applyTextCase(newNameFormatted);

        item.name = newNameFormatted;
        originNames[item.id] = originName;
      });
      saveFolder();
      calculateImageBindingChannel.emit();
    }

    // 取代字串
    else {
      itemsRef.current.forEach(function (item: any, index: number) {
        const originName = item.name;
        let newNameFormatted: any;
        if (isRegexRef.current) {
          newNameFormatted = originName.replace(regexRef.current, replaceStringRef.current);
        } else {
          newNameFormatted = originName.split(findStringRef.current).join(replaceStringRef.current);
        }

        // 應用大小寫轉換
        newNameFormatted = applyTextCase(newNameFormatted);

        item.name = newNameFormatted;
        originNames[item.id] = originName;
      });
      saveFolder();
      calculateImageBindingChannel.emit();

      // 儲存搜尋歷史
      saveFindStringHistory(typeRef.current, findStringRef.current);
    }

    try {
      if (w().electronLog) w().electronLog.info(`[app] Batch rename ${itemsRef.current.length} ${typeRef.current}, using format: ${replaceMethodRef.current}`);
    } catch (err) {}

    // 復原
    const rootScope = getRootScope();
    let message = t('notify.image.rename', [{ property: 'count', value: String(itemsRef.current.length) }]);
    if (itemsRef.current.length === 1) {
      message = message.replace('images', 'image');
    }
    if (rootScope.notify) {
      rootScope.notify(
        {
          message: message,
          duration: 10000,
        },
        function () {
          itemsRef.current.forEach(function (item: any) {
            if (originNames[item.id]) {
              item.name = originNames[item.id];
            }
          });
          saveFolder();
          calculateImageBindingChannel.emit();
        }
      );
    }
  };
  const renameFoldersRef = useRef(renameFolders);
  renameFoldersRef.current = renameFolders;

  // 批次修改標籤名稱（77493-77618 逐字）
  const renameTags = () => {
    const old2new: any = {};
    const body = getBodyScope();

    // 全新格式
    if (replaceMethodRef.current == 'format') {
      itemsRef.current.forEach(function (item: any, index: number) {
        const originName = item.name;
        let newNameFormatted = format(item, newNameRef.current, {
          originName: originName,
          idx: index + parseInt(startAtRef.current),
        });

        // 應用大小寫轉換
        newNameFormatted = applyTextCase(newNameFormatted);

        old2new[originName] = newNameFormatted;
      });
    }
    // 取代字串
    else {
      itemsRef.current.forEach(function (item: any, index: number) {
        const originName = item.name;
        let newNameFormatted: any;
        if (isRegexRef.current) {
          newNameFormatted = originName.replace(regexRef.current, replaceStringRef.current);
        } else {
          newNameFormatted = originName.split(findStringRef.current).join(replaceStringRef.current);
        }

        // 應用大小寫轉換
        newNameFormatted = applyTextCase(newNameFormatted);

        old2new[originName] = newNameFormatted;
      });

      // 儲存搜尋歷史
      saveFindStringHistory(typeRef.current, findStringRef.current);
    }

    const changed: any[] = [];
    for (let rindex = body.raw.length - 1; rindex >= 0; rindex--) {
      const item = body.raw[rindex];
      let needUpadate = false;
      if (item?.tags) {
        item.tags.forEach((tag: any, index: number) => {
          if (old2new[tag]) {
            item.tags[index] = old2new[tag];
            needUpadate = true;
          }
        });
        if (needUpadate) {
          item.tags = [...new Set(item.tags)];
          changed.push(item);
        }
      }
    }

    // 修改标签群组包含的标签
    if (body.TagManager.groups.length > 0) {
      body.TagManager.groups.forEach(function (group: any) {
        if (group.tags) {
          if (group?.tags) {
            let needUpadate = false;
            group.tags.forEach((tag: any, index: number) => {
              if (old2new[tag]) {
                group.tags[index] = old2new[tag];
                needUpadate = true;
              }
            });
            if (needUpadate) {
              group.tags = [...new Set(group.tags)];
            }
          }
        }
      });
    }

    // 更新所有文件夹智能标签
    w().eagle.utils.tree.walk(body.folders, 'children', function (folder: any, parent: any) {
      if (folder && folder.tags) {
        let needUpadate = false;
        folder.tags.forEach((tag: any, index: number) => {
          if (old2new[tag]) {
            folder.tags[index] = old2new[tag];
            needUpadate = true;
          }
        });
        if (needUpadate) {
          folder.tags = [...new Set(folder.tags)];
        }
      }
    });

    // 更新智能文件夹的标签属性
    w().eagle.utils.tree.walk(body.smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
      if (!smartFolder.conditions) return;
      smartFolder.conditions.forEach(function (condition: any) {
        if (!condition.rules) return;
        condition.rules.forEach(function (rule: any) {
          if (rule && rule.property === 'tags') {
            const ruleTags = rule.value;
            let needUpadate = false;
            if (ruleTags && ruleTags.length > 0) {
              ruleTags.forEach((tag: any, index: number) => {
                if (old2new[tag]) {
                  ruleTags[index] = old2new[tag];
                  needUpadate = true;
                }
              });
              if (needUpadate) {
                rule.value = [...new Set(rule.value)];
              }
            }
          }
        });
      });
    });

    ayncsImagesChange(changed);
    hiddenByCurrentFilter(changed);
    saveFolder();
    calculateImageBinding();
  };
  const renameTagsRef = useRef(renameTags);
  renameTagsRef.current = renameTags;

  const cancel = () => {
    close();
  };

  const close = () => {
    setIsOpen(false);
    isRenaingRef.current = false;
  };

  // 顯示搜尋字串自動完成
  const showAutocomplete = () => {
    if (findStringHistory && findStringHistory.length > 0) {
      // 直接顯示所有歷史記錄，不過濾
      setShowFindStringAutocomplete(true);
      setSelectedHistoryIndex(-1);
    }
  };

  // 隱藏搜尋字串自動完成
  const hideAutocomplete = () => {
    setTimeout(() => {
      setShowFindStringAutocomplete(false);
    }, 200);
  };

  // 選擇歷史搜尋字串
  const selectFindString = (value: any) => {
    setFindString(value);
    findStringRef.current = value;
    setShowFindStringAutocomplete(false);
    updatePreviewRef.current();
  };

  // 處理鍵盤事件（77653-77698 逐字）
  const onFindStringKeydown = (event: any) => {
    if (!showFindStringAutocomplete || !findStringHistory.length) {
      return onKeydown(event);
    }

    const keyCode = event.keyCode;

    // 上鍵
    if (keyCode === 38) {
      event.preventDefault();
      const prevIndex = Math.max(-1, selectedHistoryIndex - 1);
      setSelectedHistoryIndex(prevIndex);
      if (prevIndex === -1) {
        setFindString(tempFindStringRef.current || '');
      } else {
        setFindString(findStringHistory[prevIndex]);
      }
    }
    // 下鍵
    else if (keyCode === 40) {
      event.preventDefault();
      if (selectedHistoryIndex === -1) {
        tempFindStringRef.current = findStringRef.current;
      }
      const nextIndex = Math.min(findStringHistory.length - 1, selectedHistoryIndex + 1);
      setSelectedHistoryIndex(nextIndex);
      setFindString(findStringHistory[nextIndex]);
    }
    // Enter 鍵
    else if (keyCode === 13) {
      if (selectedHistoryIndex !== -1) {
        event.preventDefault();
        setFindString(findStringHistory[selectedHistoryIndex]);
        setShowFindStringAutocomplete(false);
      } else {
        return onKeydown(event);
      }
    }
    // Escape 鍵
    else if (keyCode === 27) {
      event.preventDefault();
      setShowFindStringAutocomplete(false);
      return onKeydown(event);
    } else {
      return onKeydown(event);
    }
  };

  const changeTextCase = (caseType: any) => {
    setTextCase(caseType);
    textCaseRef.current = caseType;
    updatePreviewRef.current();
  };

  useEffect(() => {
    setHost(document.getElementById('eagle-batch-rename-host'));
  }, []);

  // $on("OPEN_RENAME")（76807-76834 逐字）+ autoFocus 指令（73003-73014 等价）
  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;

    const off = openRenameChannel.on((params: any) => {
      ngSafe(() => {
      typeRef.current = params.type;
      switch (typeRef.current) {
        case 'IMAGE':
          itemsRef.current = params.images;
          setNewName(`${t('general.untitled.newName')} - %N`);
          newNameRef.current = `${t('general.untitled.newName')} - %N`;
          if (localStorage.getItem('BATCH_RENAME_LAST_NAME')) {
            setNewName(localStorage.getItem('BATCH_RENAME_LAST_NAME')!);
            newNameRef.current = localStorage.getItem('BATCH_RENAME_LAST_NAME')!;
          }
          break;
        case 'FOLDER':
        case 'SMART_FOLDER':
          itemsRef.current = params.folders;
          setNewName(`${t('general.untitled.newName')} - %N`);
          newNameRef.current = `${t('general.untitled.newName')} - %N`;
          break;
        case 'TAGS':
          itemsRef.current = params.tags;
          setNewName(`*`);
          newNameRef.current = `*`;
          break;
      }

      if (itemsRef.current && itemsRef.current.length) {
        setIsOpen(true);
        isRenaingRef.current = false;
        updatePreviewRef.current();
        setFindStringHistory(getFindStringHistory(typeRef.current));
        // 指令自身的 setTimeout(200) focus
        setTimeout(function () {
          focusInputRef.current();
        }, 200);
        // autoFocus 指令：OPEN_RENAME → $timeout(100) → click + focus + select（两个宿主 input 依 DOM 顺序）
        setTimeout(() => {
          [newNameInputRef.current, findStringInputRef.current].forEach((el) => {
            if (el) {
              try {
                el.click();
              } catch (err) {}
              el.focus();
              el.select();
            }
          });
        }, 100);
      }
      });
    });

    return () => {
      if (off) off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // 闭环测试契约（DOM/refs 直读，避免闭包过期）
  (window as any).__eagleBatchRename = {
    get isOpen() {
      return isOpen;
    },
    get previews() {
      return previews;
    },
    get items() {
      return itemsRef.current;
    },
  };

  const vr = useVsRepeat(tbodyRef, previews, { elementSize: 41, excess: 30 }, previews.length);

  if (!host) return null;

  const isImage = typeRef.current === 'IMAGE';

  return createPortal(
    <>
      <div className={`modal batch-rename-modal${isOpen ? ' open' : ''}`} ref={modalRef}>
        {/* header */}
        <div className="modal-header">
          <div className="name">
            {t('modal.batchRename.title')} ({itemsRef.current?.length ?? ''})
          </div>
          <div className="close" onClick={() => ngSafe(() => close())} />
        </div>

        <div className="batch-rename-modal-container">
          {/* 側欄 */}
          <div className="batch-rename-modal-sidebar">
            {/* 重新命名設定 */}
            <div className="batch-rename-modal-sidebar-form">
              <div className="form-item">
                <label>{t('modal.batchRename.method')}</label>
                <div className="segment-control">
                  <div
                    className={`segment${replaceMethod === 'format' ? ' active' : ''}`}
                    onClick={() => ngSafe(() => changeReplaceMethod('format'))}
                  >
                    {t('modal.batchRename.format')}
                  </div>
                  <div
                    className={`segment${replaceMethod === 'replace' ? ' active' : ''}`}
                    onClick={() => ngSafe(() => changeReplaceMethod('replace'))}
                  >
                    {t('modal.batchRename.replace')}
                  </div>
                </div>
              </div>

              <div className="form-item" style={ngShow(replaceMethod == 'format')}>
                <label>{t('modal.batchRename.name')}</label>
                <input
                  type="text"
                  maxLength={1024}
                  selectall=""
                  placeholder={t('modal.batchRename.placeholder')}
                  tabIndex={-1}
                  value={newName}
                  ref={newNameInputRef}
                  onChange={(e: any) => setNewName(e.target.value)}
                  onKeyDown={(e: any) => ngSafe(() => onKeydown(e))}
                />
                <div className="insert-btns">
                  <div className={`insert-btn${hasIndex ? ' disabled' : ''}`} onClick={() => ngSafe(() => insertIndex())}>
                    {t('modal.batchRename.insert>index')}
                  </div>
                  <div className={`insert-btn${hasDate ? ' disabled' : ''}`} onClick={() => ngSafe(() => insertDate())}>
                    {t('modal.batchRename.insert>date')}
                  </div>
                  <div className={`insert-btn${hasTags ? ' disabled' : ''}`} onClick={() => ngSafe(() => insertTags())}>
                    {t('modal.batchRename.insert>tags')}
                  </div>
                  <div className={`insert-btn${hasFolders ? ' disabled' : ''}`} onClick={() => ngSafe(() => insertFolders())}>
                    {t('modal.batchRename.insert>folders')}
                  </div>
                  <div className={`insert-btn${hasOriginal ? ' disabled' : ''}`} onClick={() => ngSafe(() => insertOriginal())}>
                    {t('modal.batchRename.insert>original')}
                  </div>
                </div>
              </div>

              <div className="form-item" style={ngShow(!!(hasIndex && replaceMethod == 'format'))}>
                <label>{t('modal.batchRename.index')}</label>
                <input
                  type="number"
                  min={0}
                  selectall=""
                  placeholder="1"
                  tabIndex={-1}
                  value={startAt ?? ''}
                  onChange={(e: any) => setStartAt(e.target.value === '' ? undefined : Number(e.target.value))}
                  onKeyDown={(e: any) => ngSafe(() => onKeydown(e))}
                />
              </div>

              <div className="form-item" style={ngShow(replaceMethod == 'replace')}>
                <label>{t('modal.batchRename.findString')}</label>
                <div className="input-autocomplete-container">
                  <input
                    type="text"
                    maxLength={1024}
                    selectall=""
                    tabIndex={-1}
                    value={findString}
                    ref={findStringInputRef}
                    onChange={(e: any) => setFindString(e.target.value)}
                    placeholder={t('modal.batchRename.findStringPlaceholder')}
                    onKeyDown={(e: any) => ngSafe(() => onFindStringKeydown(e))}
                    onFocus={() => ngSafe(() => showAutocomplete())}
                    onBlur={() => ngSafe(() => hideAutocomplete())}
                  />
                  {/* find-string-autocomplete（77785-77809 逐字） */}
                  <div
                    className="find-string-autocomplete"
                    style={ngShow(!!(showFindStringAutocomplete && findStringHistory.length > 0))}
                  >
                    {findStringHistory.map((item: any, index: number) => (
                      <div
                        key={index}
                        className={`find-string-autocomplete-item${selectedHistoryIndex === index ? ' selected' : ''}`}
                        onClick={() => ngSafe(() => selectFindString(item))}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-item" style={ngShow(replaceMethod == 'replace')}>
                <label htmlFor="">{t('modal.batchRename.replaceString')}</label>
                <input
                  type="text"
                  maxLength={1024}
                  selectall=""
                  tabIndex={-1}
                  value={replaceString}
                  onChange={(e: any) => setReplaceString(e.target.value)}
                  onKeyDown={(e: any) => ngSafe(() => onKeydown(e))}
                />
              </div>

              <div className="form-item">
                <label>{t('modal.batchRename.textFormat')}</label>
                <div className="segment-control">
                  <div className={`segment${textCase === 'none' ? ' active' : ''}`} onClick={() => changeTextCase('none')}>
                    -
                  </div>
                  <div className={`segment${textCase === 'uppercase' ? ' active' : ''}`} onClick={() => changeTextCase('uppercase')}>
                    AG
                  </div>
                  <div className={`segment${textCase === 'lowercase' ? ' active' : ''}`} onClick={() => changeTextCase('lowercase')}>
                    ag
                  </div>
                  <div className={`segment${textCase === 'capitalize' ? ' active' : ''}`} onClick={() => changeTextCase('capitalize')}>
                    Ag
                  </div>
                </div>
              </div>
            </div>
            {/* 底部工具列 */}
            <div className="batch-rename-modal-sidebar-controls">
              <div
                className={`button button-xs button-primary${(!newName && replaceMethod == 'format') || (replaceMethod == 'replace' && !findString) ? ' button-disabled' : ''}`}
                onClick={() => ngSafe(() => renameRef.current())}
              >
                <img src="assets/images/base/icons/ic-rename.svg" />
                {t('modal.batchRename.renameBtn')}
              </div>
            </div>
          </div>
          {/* 預覽區域 */}
          <div className="batch-rename-modal-preview">
            <div className={`table${typeRef.current !== 'IMAGE' ? ' hide-thumbnail' : ''}`}>
              <div className="thead">
                <div className="thumbnail" />
                <div className="before">{t('modal.batchRename.original')}</div>
                <div className="after">{t('modal.batchRename.new')}</div>
              </div>
              <div className="tbody" ref={tbodyRef as any}>
                <div className="vs-repeat-before-content" style={{ width: '100%', minHeight: vr.beforeHeight }} />
                {vr.innerItems.map((preview: any, index: number) => (
                  <div className="tr" key={index}>
                    {isImage && (
                      <div className="thumbnail">
                        {!preview.item.noPreview && (
                          <img
                            src={preview.thumbnail}
                            style={{ aspectRatio: `${preview.item.width}/${preview.item.height}` }}
                          />
                        )}
                        {!!preview.item.noPreview && <ExtIcon itemId={preview.item.id} />}
                      </div>
                    )}
                    <div className="before" dangerouslySetInnerHTML={{ __html: preview.before }} />
                    <div className="after" dangerouslySetInnerHTML={{ __html: preview.after }} />
                  </div>
                ))}
                <div className="vs-repeat-after-content" style={{ width: '100%', minHeight: vr.afterHeight }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-overlay" />
    </>,
    host
  );
}

/** batch-rename-modal.html 的 vs-repeat（vs-excess=30 vs-repeat=41 vs-size=size）在组件内接 tbody ref。 */