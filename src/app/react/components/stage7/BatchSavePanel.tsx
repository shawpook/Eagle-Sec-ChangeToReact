import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBodyScope } from '../../global/scopeBridge';
import { t } from '../../global/eagleGlobals';
import { $, getIpc, req } from '../detail/detailHooks';
import { duration } from '../../app/filters';
import { FolderSelectPanel } from './selectPanelEngine';
import { openGeneralTagSelectPanel, themePathOf } from './SelectPanels';
import { fuzzyMatchHtml } from './ContextMenu';
import { syncUploadFromScope } from '../../store/uploadState';
import { syncInspectorFromScope } from '../../store/inspectorState';

/**
 * 阶段7d-3b：batchSavePanel + batchRectSelect 指令接管。
 *
 * 规范来源：
 * - batchSavePanel = bundle 58257-59288（镜像 js/directives/batch-save-panel.js）+ 模板 245 行
 * - BatchSaver 类 = bundle 内同类（镜像 595-1030），onChange 用 window.throttle（global.js 同款）
 * - batchRectSelect = bundle 59288-59423（.gallery 上的框选指令，随面板内联移植）
 *
 * 通道零改动：IMPORT_IMAGES 广播、ipc 'open-batch-save-panel'、auto-focus OPEN_DUPLICATE；
 * localStorage 键 eagle.batchSaver.* 原样；数据面 uploadUrls/uploadQueue/addToRecentFolders/
 * folderMappings/TagManager 直读 body scope（= 号绑定同源）。
 * 原版怪癖保留：模板 ng-mousedown="cleanSelected($event)" 的 cleanSelected 在该 isolate scope
 * 未定义（Angular $exceptionHandler 记录后无其它效果）→ React 侧 no-op。
 */

const iv = (v: any): any => (v === undefined || v === null ? '' : v);
const ngShow = (show: boolean) => (show ? undefined : ({ display: 'none' } as React.CSSProperties));
const w = () => window as any;

/* ================= BatchSaver（595-1030 逐字） ================= */

class BatchSaver {
  onChange: any;

  constructor(onChange: any) {
    this.onChange = w().throttle(onChange, 100, true);
  }

  // 轉換格式
  loadTasks(tasks: any) {
    const result: any[] = [];

    for (const task of tasks) {
      const item: any = {
        src: task.src,
        url: task.url,
        title: task.title,
        original: {
          title: task.title,
          url: task.url,
          src: task.src,
          width: task.width,
          height: task.height,
          type: 'image',
          ext: 'Other',
        },
      };

      this.loadOriginal(item).then(() => {
        this.onChange();
      });

      this.loadLarge(item).then(() => {
        this.onChange();
      });

      result.push(item);
    }

    return result;
  }

  // 載入原始圖片資訊
  async loadOriginal(item: any) {
    return new Promise(async (resolve, reject) => {
      await this.loadImage(item, item.src, 'original');
      return resolve(item);
    });
  }

  // 載入大圖資訊
  async loadLarge(item: any) {
    return new Promise(async (resolve, reject) => {
      if (w().eagle.urlEnlarger.isEnlargable(item.src)) {
        const { url: src, largeUrl: largeSrc } = await w().eagle.urlEnlarger.enlarge(item.src);
        if (largeSrc && src !== largeSrc) {
          item.hasLarge = true;
          await this.loadImage(item, largeSrc, 'large');
          return resolve(item);
        } else {
          item.hasLarge = false;
          return resolve(item);
        }
      } else {
        item.hasLarge = false;
        return resolve(item);
      }
    });
  }

  // 載入圖片資訊
  async loadImage(item: any, src: string, objectKey: string) {
    return new Promise(async (resolve, reject) => {
      const blobToBase64 = async (blob: any) => {
        return new Promise((resolve2, reject2) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            resolve2(dataUrl);
          };
          reader.readAsDataURL(blob);
        });
      };

      const getBlobMimeType = async (blob: any) => {
        return new Promise<string>((resolve3, reject3) => {
          const fileReader = new FileReader();

          fileReader.onloadend = function (e: any) {
            const arr = new Uint8Array(e.target.result).subarray(0, 4);
            let header = '';
            for (let i = 0; i < arr.length; i++) {
              header += arr[i].toString(16).padStart(2, '0');
            }

            let mimeType = 'unknown';

            // Check the file signature against known types
            switch (header) {
              case '89504e47':
                mimeType = 'image/png';
                break;
              case '47494638':
                mimeType = 'image/gif';
                break;
              case 'ffd8ffe0':
              case 'ffd8ffe1':
              case 'ffd8ffe2':
              case 'ffd8ffe3':
                mimeType = 'image/jpeg';
                break;
              // webp
              case '52494646':
                mimeType = 'image/webp';
                break;
              // avif
              case '41564946':
                mimeType = 'image/avif';
                break;
              // mp4
              case '66747970':
                mimeType = 'video/mp4';
                break;
              // webm
              case '1a45dfa3':
                mimeType = 'video/webm';
                break;
              default:
                mimeType = 'application/octet-stream'; // default binary type
            }
            resolve3(mimeType);
          };

          fileReader.onerror = function (e) {
            reject3(e);
          };

          fileReader.readAsArrayBuffer(blob.slice(0, 4));
        });
      };

      const result: any = {};
      if (src.startsWith('data:image')) {
        // 如果URL是base64編碼的圖片數據，則不需要進行fetch下載
        result.blobUrl = src;
        result.base64 = src;
        result.width = item.width;
        result.height = item.height;
        result.ext = this.getExtension(src);
        result.type = 'image';
        result.size = this.getSize(item.width, item.height);
        result.resolution = this.getResolution(item.width, item.height);
      } else {
        try {
          const response = await fetch(src);
          const contentType = response.headers.get('content-type') || '';
          const contentDisposition = response.headers.get('content-disposition') || '';

          if (!response.ok) {
            result.ext = this.getExtension(src);
            result.type = result.ext === 'mp4' || result.ext === 'webm' ? 'video' : 'image';
            result.width = item?.original?.width || 0;
            result.height = item?.original?.height || 0;
            result.size = this.getSize(result.width, result.height);
            result.resolution = `${item?.original?.width || 0} x ${item?.original?.height || 0}`;
          } else {
            result.contentType = contentType;
            result.type = contentType.split('/')[0];

            if (contentType === 'application/octet-stream') {
              const blob = await response.blob();
              const cdResult = this.getContentDispositionType(contentDisposition);

              if (cdResult.type) {
                result.type = cdResult.type;
                result.ext = cdResult.ext;
              } else {
                const mimeType = await getBlobMimeType(blob);
                result.contentType = mimeType;
                result.type = mimeType.split('/')[0];
                result.ext = this.getExtension(mimeType);
              }

              result.blobUrl = src;
            } else if (contentType.includes('image/')) {
              result.ext = this.getExtension(contentType);
              result.blobUrl = src;
            } else if (contentType.includes('video/')) {
              result.src = src;
              result.ext = this.getExtension(contentType);
            }
          }
        } catch (err) {
          // debugger
        }
      }

      if (result.type === 'image') {
        // 這裡可以獲取圖片的寬高
        let image = new Image();
        const releaseImage = () => {
          image.onload = null;
          image.onerror = null;
          (image as any).scr = '';
          image = null as any;
        };
        image.onload = () => {
          result.width = image.width;
          result.height = image.height;
          result.size = this.getSize(result.width, result.height);
          result.resolution = this.getResolution(result.width, result.height);
          releaseImage();
          return resolve(item);
        };
        image.onerror = () => {
          result.width = 0;
          result.height = 0;
          result.size = this.getSize(result.width, result.height);
          result.resolution = this.getResolution(result.width, result.height);
          releaseImage();
          return resolve(item);
        };
        image.src = result.blobUrl || result.src;
      } else if (result.type === 'video') {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          result.width = video.videoWidth || item?.original?.width || 0;
          result.height = video.videoHeight || item?.original?.height || 0;
          result.video = video;
          result.duration = video.duration;
          result.size = this.getSize(result.width, result.height);
          result.resolution = this.getResolution(result.width, result.height);
          return resolve(item);
        };
        video.onerror = () => {
          result.width = result.width || item?.original?.width || 0;
          result.height = result.height || item?.original?.height || 0;
          result.duration = 0;
          result.size = this.getSize(result.width, result.height);
          result.resolution = this.getResolution(result.width, result.height);
          return resolve(item);
        };
        video.src = result.blobUrl || result.src;
      }
      item[objectKey] = result;
    });
  }

  getSize(width: any, height: any) {
    if (width >= 600 || height >= 600) {
      return 'large';
    } else if (width >= 160 || height >= 160) {
      return 'medium';
    }
    return 'small';
  }

  getResolution(width: any, height: any) {
    return `${width} x ${height}`;
  }

  getContentDispositionType(str: string) {
    str = str.toLowerCase();
    if (str.indexOf('.mp4') > -1) {
      return { type: 'video', ext: 'mp4' };
    }
    if (str.indexOf('.webm') > -1) {
      return { type: 'video', ext: 'webm' };
    } else if (str.indexOf('.png') > -1) {
      return { type: 'image', ext: 'png' };
    } else if (str.indexOf('.avif') > -1) {
      return { type: 'image', ext: 'avif' };
    } else if (str.indexOf('.jpg') > -1) {
      return { type: 'image', ext: 'jpg' };
    } else if (str.indexOf('.jpeg') > -1) {
      return { type: 'image', ext: 'jpeg' };
    } else if (str.indexOf('.svg') > -1) {
      return { type: 'image', ext: 'svg' };
    } else if (str.indexOf('.webp') > -1) {
      return { type: 'image', ext: 'webp' };
    } else if (str.indexOf('.gif') > -1) {
      return { type: 'image', ext: 'gif' };
    }
    return {};
  }

  getExtension(str: string) {
    str = str.toLowerCase();
    if (str.indexOf('png') > -1) {
      return 'png';
    } else if (str.indexOf('avif') > -1) {
      return 'avif';
    } else if (str.indexOf('jpg') > -1) {
      return 'jpg';
    } else if (str.indexOf('jpeg') > -1) {
      return 'jpg';
    } else if (str.indexOf('svg') > -1) {
      return 'svg';
    } else if (str.indexOf('webp') > -1) {
      return 'webp';
    } else if (str.indexOf('gif') > -1) {
      return 'gif';
    } else if (str.indexOf('mp4') > -1) {
      return 'mp4';
    } else if (str.indexOf('webm') > -1) {
      return 'webm';
    }
    return 'other';
  }

  get showTags() {
    return localStorage['eagle.batchSaver.showTags'] !== 'false';
  }
  set showTags(value: any) {
    localStorage['eagle.batchSaver.showTags'] = value;
  }

  get showFolders() {
    return localStorage['eagle.batchSaver.showFolders'] !== 'false';
  }
  set showFolders(value: any) {
    localStorage['eagle.batchSaver.showFolders'] = value;
  }

  get showSize() {
    return localStorage['eagle.batchSaver.showSize'] !== 'false';
  }
  set showSize(value: any) {
    localStorage['eagle.batchSaver.showSize'] = value;
  }

  get showExt() {
    return localStorage['eagle.batchSaver.showExt'] !== 'false';
  }
  set showExt(value: any) {
    localStorage['eagle.batchSaver.showExt'] = value;
  }

  get showDomains() {
    return localStorage['eagle.batchSaver.showDomains'] !== 'false';
  }
  set showDomains(value: any) {
    localStorage['eagle.batchSaver.showDomains'] = value;
  }

  get filterMinW() {
    return localStorage['eagle.batchSaver.filterMinW'] ? parseInt(localStorage['eagle.batchSaver.filterMinW']) : undefined;
  }
  set filterMinW(value: any) {
    if (value !== undefined) localStorage['eagle.batchSaver.filterMinW'] = parseInt(value) || '';
  }

  get filterMinH() {
    return localStorage['eagle.batchSaver.filterMinH'] ? parseInt(localStorage['eagle.batchSaver.filterMinH']) : undefined;
  }
  set filterMinH(value: any) {
    if (value !== undefined) localStorage['eagle.batchSaver.filterMinH'] = parseInt(value) || '';
  }

  get filterMaxW() {
    return localStorage['eagle.batchSaver.filterMaxW'] ? parseInt(localStorage['eagle.batchSaver.filterMaxW']) : undefined;
  }
  set filterMaxW(value: any) {
    if (value !== undefined) localStorage['eagle.batchSaver.filterMaxW'] = parseInt(value) || '';
  }

  get filterMaxH() {
    return localStorage['eagle.batchSaver.filterMaxH'] ? parseInt(localStorage['eagle.batchSaver.filterMaxH']) : undefined;
  }
  set filterMaxH(value: any) {
    if (value !== undefined) localStorage['eagle.batchSaver.filterMaxH'] = parseInt(value) || '';
  }
}

/* ================= batchSavePanel + batchRectSelect（组件） ================= */

export function BatchSavePanel() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [listSize, setListSize] = useState(150);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);

  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const listSizeRef = useRef(150);
  listSizeRef.current = listSize;

  // isolate scope 数据（原版 digest 驱动 → refs + bump）
  const itemsRef = useRef<any[]>([]);
  const displayedRef = useRef<any[]>([]);
  const selectedRef = useRef<any[]>([]);
  const importFoldersRef = useRef<any[]>([]);
  const tagsRef = useRef<any[]>([]);
  const urlRef = useRef('');
  const filterRef = useRef<any>({ ext: undefined, size: undefined, keyword: undefined, domain: undefined });
  const countsRef = useRef<any>({});
  const domainsRef = useRef<any[]>([]);
  const domainMappingsRef = useRef<any>({});
  const lastIdxRef = useRef<any>(undefined);

  const galleryRef = useRef<HTMLElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const calculateResultRef = useRef<(ignoreCalculateExtensionCount?: boolean) => void>(() => {});
  const searchDebounceRef = useRef<any>(null);

  const batchSaverRef = useRef<BatchSaver | null>(null);
  if (!batchSaverRef.current) {
    batchSaverRef.current = new BatchSaver(() => {
      calculateResultRef.current();
      bumpAll();
    });
  }
  const batchSaver = batchSaverRef.current!;

  const updateSelectedCount = () => {
    countsRef.current.selected = {
      ext: {},
      size: {},
      domain: {},
    };
    selectedRef.current.forEach((item) => {
      const image = item.large ?? item.original;
      countsRef.current.selected.ext[image.ext] = countsRef.current.selected.ext[image.ext] ? countsRef.current.selected.ext[image.ext] + 1 : 1;
      countsRef.current.selected.size[image.size] = countsRef.current.selected.size[image.size] ? countsRef.current.selected.size[image.size] + 1 : 1;
      if (item.url) {
        const url = new URL(item.url);
        const domain = url.hostname;
        countsRef.current.selected.domain[domain] = countsRef.current.selected.domain[domain] ? countsRef.current.selected.domain[domain] + 1 : 1;
      }
    });
  };
  const updateSelectedCountRef = useRef(updateSelectedCount);
  updateSelectedCountRef.current = updateSelectedCount;

  const focusInput = () => {
    setTimeout(() => {
      document.getElementById('batch-save-panel-input')?.focus();
    }, 24);
  };
  const focusInputRef = useRef(focusInput);
  focusInputRef.current = focusInput;

  const focusMinWInput = () => {
    setTimeout(() => {
      document.getElementById('batch-saver-min-w')?.focus();
    }, 100);
  };

  // init（37-104 逐字）
  const init = (params: any) => {
    const body = getBodyScope();

    // Note: 取消全域选取的图片
    body.selected = [];
    syncInspectorFromScope();
    itemsRef.current = [];
    displayedRef.current = [];
    selectedRef.current = [];
    importFoldersRef.current = params.importFolders || [];
    tagsRef.current = [];
    urlRef.current = params.url || '';
    filterRef.current = {
      ext: undefined,
      size: undefined,
      keyword: undefined,
      domain: undefined,
    };

    countsRef.current = {
      ext: {},
      size: {},
      domain: {},
      selected: {
        ext: {},
        size: {},
        domain: {},
      },
      total: 0,
    };

    // ng-model 初始化：清空搜索框（原版 filter 替换后 digest 回写输入）
    const search = document.getElementById('batch-save-panel-search') as HTMLInputElement | null;
    if (search) search.value = '';

    setListSize(150);
    listSizeRef.current = 150;
    const slider = document.getElementById('batch-save-panel-slider') as HTMLInputElement | null;
    if (slider) slider.value = '150';

    // 修改 refer 避免图片呈现不出来
    try {
      const refer =
        urlRef.current.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) && urlRef.current.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i)![0];
      const remote = req('@electron/remote');
      remote.require('electron-referer')(refer, remote.getCurrentWindow());
    } catch (err) {
      console.error(err);
    }

    const uniqueUrls: any = {};
    const tasks: any[] = [];
    params.images.forEach((image: any) => {
      if (!uniqueUrls[image.src]) {
        uniqueUrls[image.src] = true;
        tasks.push({
          src: image.src,
          url: image.url,
          title: image.title,
          width: image.width,
          height: image.height,
        });
      }
    });

    itemsRef.current = batchSaver.loadTasks(tasks);

    calculateResultRef.current();
    updateSelectedCountRef.current();
    focusInputRef.current();
    setTimeout(() => {
      focusInputRef.current();
    }, 200);
    w().analytics.event('BatchCollect', 'Open');
  };

  // calculateResult（106-255 逐字）
  const calculateResult = (ignoreCalculateExtensionCount?: boolean) => {
    void ignoreCalculateExtensionCount;
    const filter = filterRef.current;
    const items = itemsRef.current;

    countsRef.current = {
      ext: {},
      size: {},
      domain: {},
      selected: {
        ext: {},
        size: {},
        domain: {},
      },
      has: {
        ext: {},
        size: {},
        domain: {},
      },
      total: 0,
    };

    countsRef.current.total = items.length;

    // 計算域名及對應數量
    domainMappingsRef.current = {};
    let domains: any[] = [];
    items.forEach((item) => {
      if (item.url) {
        const url = new URL(item.url);
        const domain = url.hostname;
        if (!domainMappingsRef.current[domain]) {
          domainMappingsRef.current[domain] = true;
          domains.push(domain);
          countsRef.current.has.domain[domain] = true;
        }
        // update ext size has map
        const image = item.large ?? item.original;
        countsRef.current.has.ext[image.ext] = true;
        countsRef.current.has.size[image.size] = true;
      }
    });

    // 排序 domains，依據數量多寡
    domains = domains.sort((a, b) => {
      return countsRef.current.domain[b] - countsRef.current.domain[a];
    });
    domainsRef.current = domains;

    let displayed = [...items];

    // 類型篩選
    if (filter.ext) {
      displayed = displayed.filter((item) => {
        const image = item.large ?? item.original;
        if (image?.ext === undefined) return false;
        if (filter.ext === undefined) return true;
        return image.ext === filter.ext;
      });
    }

    // 大小篩選
    if (filter.size) {
      if (filter.size === 'advanced') {
        if (batchSaver.filterMinW || batchSaver.filterMinH || batchSaver.filterMaxW || batchSaver.filterMaxH) {
          displayed = displayed.filter((item) => {
            const image = item.large ?? item.original;
            if (image?.width === undefined || image?.height === undefined) return false;
            if (batchSaver.filterMinW && image.width < batchSaver.filterMinW) return false;
            if (batchSaver.filterMinH && image.height < batchSaver.filterMinH) return false;
            if (batchSaver.filterMaxW && image.width > batchSaver.filterMaxW) return false;
            if (batchSaver.filterMaxH && image.height > batchSaver.filterMaxH) return false;
            return true;
          });
        }
      } else {
        displayed = displayed.filter((item) => {
          const image = item.large ?? item.original;
          if (image?.size === undefined) return false;
          if (filter.size === undefined) return true;
          return image.size === filter.size;
        });
      }
    }

    // 網域篩選
    if (filter.domain) {
      displayed = displayed.filter((item) => {
        if (item?.url === undefined) return false;
        const url = new URL(item.url);
        return url.hostname === filter.domain;
      });
    }

    // 關鍵字篩選
    if (filter.keyword) {
      displayed = displayed.filter((item) => {
        if (item?.title === undefined) return false;
        const title = item.title;
        const ext = item.large?.ext ?? item.original?.ext;
        const fileName = `${title}.${ext}`.toLowerCase();
        const keywords = filter.keyword.split(' ');
        let isMatch = true;
        for (let i = 0; i < keywords.length; i++) {
          const keyword = keywords[i].toLowerCase();
          const idx = fileName.indexOf(keyword);
          if (idx === -1) isMatch = false;
        }
        return isMatch;
      });
    }

    // 將寬、高少於 200px 的放在最尾端，並針對這些圖片進行寬度大小排序
    const smalls = displayed
      .filter((item) => {
        const image = item.large ?? item.original;
        return image.width < 200 || image.height < 200;
      })
      .sort((a, b) => {
        const imageA = a.large ?? a.original;
        const imageB = b.large ?? b.original;
        if (imageA.width < imageB.width) {
          return 1;
        } else if (imageA.width > imageB.width) {
          return -1;
        } else {
          return 0;
        }
      });

    const bigs = displayed.filter((item) => {
      return smalls.indexOf(item) === -1;
    });

    displayedRef.current = [...bigs, ...smalls];

    console.log(itemsRef.current.length, displayedRef.current.length);
    console.log(countsRef.current);

    displayedRef.current.forEach((item) => {
      const image = item.large ?? item.original;
      countsRef.current.ext[image.ext] = countsRef.current.ext[image.ext] ? countsRef.current.ext[image.ext] + 1 : 1;
      countsRef.current.size[image.size] = countsRef.current.size[image.size] ? countsRef.current.size[image.size] + 1 : 1;
      if (item.url) {
        const url = new URL(item.url);
        const domain = url.hostname;
        countsRef.current.domain[domain] = countsRef.current.domain[domain] ? countsRef.current.domain[domain] + 1 : 1;
      }
    });

    updateSelectedCountRef.current();
    bumpAll();
  };
  calculateResultRef.current = calculateResult;

  // selectFolders（289-318 逐字）
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
      onClosed: () => {
        focusInputRef.current();
      },
    });
  };

  // removeImportFolder（320-325 逐字）
  const removeImportFolder = (event: any, folder: any) => {
    event.stopPropagation();
    importFoldersRef.current = importFoldersRef.current.filter((fd: any) => {
      return fd.id !== folder.id;
    });
    bumpAll();
  };

  // selectTags（327-362 逐字）
  const selectTags = () => {
    const body = getBodyScope();
    const originSelected = tagsRef.current.reduce(
      (acc: any, cur: any) => {
        acc[cur] = true;
        return acc;
      },
      {} as any
    );

    openGeneralTagSelectPanel({
      tagManager: body.TagManager,
      selectedTags: originSelected,
      onChanged: (result: any) => {
        if (!result?.isDirty) return;
        const { selectedTags, deselectedTags } = result;

        if (Object.keys(selectedTags).length > 0) {
          const nextTags: any[] = [];
          Object.keys(selectedTags).forEach((tag) => {
            if (originSelected[tag]) return;
            nextTags.push(tag);
          });
          tagsRef.current = [...tagsRef.current, ...nextTags];
        }

        if (Object.keys(deselectedTags).length > 0) {
          tagsRef.current = tagsRef.current.filter((tag: any) => {
            return !deselectedTags[tag];
          });
        }

        bumpAll();
      },
      onClosed: () => {
        focusInputRef.current();
      },
    });
  };

  // removeImportTag（364-369 逐字）
  const removeImportTag = (event: any, t: any) => {
    event.stopPropagation();
    tagsRef.current = tagsRef.current.filter((tag: any) => {
      return tag !== t;
    });
    bumpAll();
  };

  // onFilterChange（371-373）
  const onFilterChange = () => {
    calculateResult(true);
  };

  // onKeyup（387-430 逐字）
  const onKeyup = (event: any) => {
    event.stopPropagation();
    event.preventDefault();
    const keyCode = event.keyCode;
    if (keyCode === 65) {
      if (event.metaKey || event.ctrlKey) {
        selectAll();
      }
    } else if (keyCode === 27) {
      if (selectedRef.current.length > 0) {
        selectedRef.current = [];
        updateSelectedCountRef.current();
        bumpAll();
      } else {
        close();
      }
    } else if (keyCode === 46 || keyCode === 8) {
      removeSelected(event);
    } else if (keyCode === 70) {
      if (event.metaKey || event.ctrlKey) {
        document.getElementById('batch-save-panel-search')?.focus();
      } else {
        selectFolders();
      }
    } else if (keyCode === 84) {
      selectTags();
    } else if (keyCode === 13) {
      if (event.metaKey || event.ctrlKey) {
        importRef.current();
      }
    } else if (keyCode === 107 || keyCode === 61 || keyCode === 187) {
      zoomIn();
    } else if (keyCode === 109 || keyCode === 189) {
      zoomOut();
    }
  };

  // 全选（433-437）
  const selectAll = () => {
    selectedRef.current = [...selectedRef.current, ...displayedRef.current];
    selectedRef.current = [...new Set(selectedRef.current)];
    updateSelectedCountRef.current();
    bumpAll();
  };

  // 反选（440-445）
  const invertSelected = () => {
    selectedRef.current = itemsRef.current.filter((item: any) => {
      return selectedRef.current.indexOf(item) === -1;
    });
    updateSelectedCountRef.current();
    bumpAll();
  };

  const isSelected = (item: any) => selectedRef.current.indexOf(item) !== -1;

  // select（449-486 逐字）
  const select = (event: any, item: any) => {
    event && event.stopPropagation();
    focusInputRef.current();

    const idx = selectedRef.current.indexOf(item);
    const selectIdx = displayedRef.current.indexOf(item);

    if (idx !== -1) {
      selectedRef.current.splice(idx, 1);
      updateSelectedCountRef.current();
      bumpAll();
      return;
    }

    if (event.shiftKey) {
      if (lastIdxRef.current !== undefined) {
        if (lastIdxRef.current > selectIdx) {
          for (let i = selectIdx; i <= lastIdxRef.current; i++) {
            selectedRef.current.push(displayedRef.current[i]);
          }
        } else {
          for (let i = lastIdxRef.current; i <= selectIdx; i++) {
            selectedRef.current.push(displayedRef.current[i]);
          }
        }
      } else {
        selectedRef.current.push(item);
      }
    } else if (idx === -1) {
      selectedRef.current.push(item);
      lastIdxRef.current = displayedRef.current.indexOf(item);
    }
    selectedRef.current = [...new Set(selectedRef.current)];
    updateSelectedCountRef.current();
    bumpAll();
  };

  // removeSelected（488-496 逐字）
  const removeSelected = (event: any) => {
    event.stopPropagation();
    itemsRef.current = itemsRef.current.filter((item: any) => {
      return selectedRef.current.indexOf(item) === -1;
    });
    selectedRef.current = [];
    calculateResultRef.current();
    updateSelectedCountRef.current();
    bumpAll();
  };

  // zoomIn / zoomOut（516-526 逐字）
  const zoomIn = () => {
    setListSize((prev) => {
      let next = prev + 50;
      if (next > 600) next = 600;
      if (next < 50) next = 50;
      listSizeRef.current = next;
      return next;
    });
  };
  const zoomOut = () => {
    setListSize((prev) => {
      let next = prev - 50;
      if (next > 600) next = 600;
      if (next < 50) next = 50;
      listSizeRef.current = next;
      return next;
    });
  };

  // import（528-578 逐字）
  const importRef = useRef<() => void>(() => {});
  const importImages = () => {
    const body = getBodyScope();

    if (selectedRef.current.length === 0) return;

    const names: any[] = [];
    const websiteUrls: any[] = [];
    const imageUrls: any[] = [];
    const duplicateNameMappings: any = {};

    // 避免图片名称一模一样，如果一样就加上序号
    selectedRef.current.forEach((item: any) => {
      if (duplicateNameMappings[item.title] === undefined) {
        duplicateNameMappings[item.title] = 1;
      } else {
        duplicateNameMappings[item.title]++;
        item.title += ' (' + duplicateNameMappings[item.title] + ')';
      }
    });

    selectedRef.current.reverse();
    selectedRef.current.forEach((item: any) => {
      const large = item.large;
      const original = item.original;

      if (item) {
        names.push(item.title);
        websiteUrls.push(item.url ?? urlRef.current ?? '');
        if (item.hasLarge) {
          imageUrls.push(large?.base64 ?? large?.src ?? original?.src ?? item.src);
        } else {
          imageUrls.push(original.base64 ?? original.src ?? item.src);
        }
        body.uploadQueue.push({});
        syncUploadFromScope();
      }
    });

    const folderIds = importFoldersRef.current.map((fd: any) => fd.id);
    const tags = tagsRef.current;

    body.uploadUrls(imageUrls, folderIds, {
      names: names,
      urls: websiteUrls,
      tags: tags,
    });

    body.addToRecentFolders(folderIds);
    close();
    bumpAll();
  };
  importRef.current = importImages;

  // close（584-588 逐字）
  const close = () => {
    setIsOpen(false);
    itemsRef.current = [];
    selectedRef.current = [];
    bumpAll();
  };

  useEffect(() => {
    setHost(document.getElementById('eagle-batch-save-panel-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;

    const offs: any[] = [];

    // $on("IMPORT_IMAGES")（25-28）
    offs.push(
      body.$on('IMPORT_IMAGES', (e: any, params: any) => {
        setIsOpen(true);
        init(params);
        bumpAll();
      })
    );

    // ipcRenderer.on('open-batch-save-panel')（30-34；通道零改动）
    const ipc = getIpc();
    const onOpen = (event: any, params: any) => {
      setIsOpen(true);
      init(params);
      bumpAll();
    };
    if (ipc && ipc.on) {
      ipc.on('open-batch-save-panel', onOpen);
    }

    // auto-focus 指令（OPEN_DUPLICATE → $timeout(100) → click + focus + select）
    const offDuplicate = body.$on('OPEN_DUPLICATE', () => {
      setTimeout(() => {
        const el = hiddenInputRef.current;
        if (el) {
          try {
            el.click();
          } catch (err) {}
          el.focus();
          el.select();
        }
      }, 100);
    });
    offs.push(offDuplicate);

    // 闭环测试契约
    (window as any).__eagleBatchSavePanel = {
      get isOpen() {
        return isOpenRef.current;
      },
      get items() {
        return itemsRef.current;
      },
      get selected() {
        return selectedRef.current;
      },
      get displayed() {
        return displayedRef.current;
      },
      get counts() {
        return countsRef.current;
      },
      get tags() {
        return tagsRef.current;
      },
      get importFolders() {
        return importFoldersRef.current;
      },
    };

    return () => {
      offs.forEach((off) => off());
      if (ipc && ipc.off) ipc.off('open-batch-save-panel', onOpen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  /* ── initMouseWheelEvent（257-287 逐字；jQuery mousewheel + window.throttle） ── */
  useEffect(() => {
    if (!galleryRef.current) return;
    const jQuery = $();
    if (!jQuery) return;
    const $gallery = jQuery(galleryRef.current);

    $gallery.on('mousewheel.zoomming', (e: any) => {
      if (e.altKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    $gallery.on(
      'mousewheel.zoomming',
      w().throttle((e: any) => {
        if (e.altKey || e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          const speedControl = 2;
          const delta0 = Math.abs(e.originalEvent.wheelDelta / 20);
          const ne = e.originalEvent.wheelDelta / Math.abs(e.originalEvent.wheelDelta) || 1;
          let delta = delta0;
          if (delta < 10) delta = 10;
          if (delta > 80) delta = 80;
          delta = ne * delta * speedControl;
          setListSize((prev) => {
            let next = prev + delta * 1.2;
            next = Math.floor(next / 5) * 5;
            if (next > 600) next = 600;
            if (next < 50) next = 50;
            listSizeRef.current = next;
            const slider = document.getElementById('batch-save-panel-slider') as HTMLInputElement | null;
            if (slider) slider.value = String(next);
            return next;
          });
          bumpAll();
          return false;
        }
      }, 50, true)
    );

    return () => {
      $gallery.off('mousewheel.zoomming');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  /* ── batchRectSelect（59288-59423 逐字；$scope.selected/isOpen → refs） ── */
  useEffect(() => {
    if (!galleryRef.current) return;
    const jQuery = $();
    if (!jQuery) return;
    const element = jQuery(galleryRef.current);

    let rectSelection: any = {};
    let rectSelecting = false;
    let startX: any, startY: any;
    let offset = element.offset();
    const $rect = jQuery('<div class="rect"></div>').hide();
    let $boxs: any;
    let originSelected: any[] = [];

    jQuery('#batch-save-panel .gallery').prepend($rect);

    element.on('mousedown', (e: any) => {
      e.stopPropagation();

      if (e.which != 1) return;
      if (e.metaKey || e.shiftKey || e.ctrlKey) {
        originSelected = selectedRef.current.map(function (i) {
          return i;
        });
      } else {
        originSelected = [];
      }

      offset = element.offset();
      $boxs = element.find('.item');
      rectSelection.startX = startX = e.pageX - offset.left;
      rectSelection.startY = startY = e.pageY - offset.top + element.scrollTop();
      rectSelecting = true;

      $rect.css({
        top: rectSelection.startY,
        left: rectSelection.startX,
      });
      $rect.show();
    });

    jQuery(window).on('mouseup', (e: any) => {
      if (!isOpenRef.current) return;
      e.stopPropagation();

      rectSelection = {};
      rectSelecting = false;

      $rect.css({
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      });
      $rect.hide();
    });

    element.on('mousemove', (e: any) => {
      e.stopPropagation();

      if (rectSelecting) {
        const scrollTop = element.scrollTop(),
          flipX = startX > e.pageX - offset.left,
          flipY = startY > e.pageY - offset.top + scrollTop;

        rectSelection.w = Math.abs(e.pageX - offset.left - startX);
        rectSelection.h = Math.abs(e.pageY - offset.top - startY + scrollTop);

        if (flipX) {
          rectSelection.startX = startX - rectSelection.w;
        }
        if (flipY) {
          rectSelection.startY = startY - rectSelection.h;
        }
        $rect.css({
          top: rectSelection.startY,
          left: rectSelection.startX,
          width: rectSelection.w,
          height: rectSelection.h,
        });

        caculate();
      }
    });

    function contain(el: any) {
      const a = {
        width: el.width(),
        height: el.height(),
        x: el[0].offsetLeft,
        y: el[0].offsetTop,
      };
      const b = {
        width: rectSelection.w,
        height: rectSelection.h,
        x: rectSelection.startX,
        y: rectSelection.startY,
      };
      return !(
        a.y + a.height < b.y || a.y > b.y + b.height || a.x + a.width < b.x || a.x > b.x + b.width
      );
    }

    const caculate = w().throttle(() => {
      const rectSelected: any[] = [];
      let miss = 0;
      let hit = 0;
      const BreakException = {};

      try {
        $boxs.each(function (this: any) {
          if (miss > 20) {
            throw BreakException;
          }
          const domNode = this;
          if (contain(jQuery(domNode))) {
            hit++;
            // 原：angular.element(this).scope().image → DOM 节点挂 __eagleItem
            const item = (domNode as any).__eagleItem;
            if (originSelected.indexOf(item) == -1) {
              rectSelected.push(item);
            }
          } else if (hit > 1) {
            miss++;
          }
        });
      } catch (e) {}

      if (rectSelected.length > 0) {
        selectedRef.current = originSelected.concat(rectSelected);
        updateSelectedCountRef.current();
        bumpAll();
      }
    }, 100);

    return () => {
      element.off('mousedown');
      element.off('mousemove');
      jQuery(window).off('mouseup');
      $rect.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const counts = countsRef.current;
  const body = getBodyScope();

  const renderMetas = (image: any) => {
    if (image.original.type === 'image' && !image.hasLarge) {
      return <div className="metas">{image.original.width} × {image.original.height} / {image.original.ext}</div>;
    }
    if (image.original.type === 'image' && image.hasLarge) {
      return (
        <div className="metas">
          {!image.large.width && <span>{t('batchImport.originalSize')}</span>}
          {!!image.large.width && (
            <span>
              {image.large.width} × {image.large.height} / {image.large.ext}
            </span>
          )}
        </div>
      );
    }
    if (image.original.type === 'video') {
      return (
        <div className="metas">
          {duration(image.original.duration)} / {image.original.width} × {image.original.height}
        </div>
      );
    }
    return null;
  };

  return createPortal(
    <>
      <div id="batch-save-panel" className={`modal batch-save-panel${isOpen ? ' open' : ''}`} onClick={() => focusInputRef.current()}>
        <input
          id="batch-save-panel-input"
          style={{ position: 'absolute', opacity: 0, height: 0, marginBottom: 0 }}
          ref={hiddenInputRef}
          onKeyDown={onKeyup}
          auto-focus="OPEN_DUPLICATE"
          tabIndex={-1}
        />

        <div className="modal-header">
          <div className="name">
            {t('batchImport.import')}{' '}
            <span className="count" style={ngShow(selectedRef.current.length > 0)}>
              ({selectedRef.current.length})
            </span>
          </div>
          <div className="sliders-bar has-btn">
            <div className="slider">
              <div className="ic-btn zoom-btn" onClick={() => zoomOut()}>
                <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-toolbar-zoom-out.svg`} />
              </div>
              <div className="range-wrap">
                <div className="range-progressbar">
                  <div className="current" style={{ width: `${(listSize / 600) * 100}%` }} />
                </div>
                <input
                  id="batch-save-panel-slider"
                  className="range"
                  type="range"
                  name="points"
                  min={50}
                  max={600}
                  step={5}
                  tabIndex={-1}
                  value={listSize}
                  onChange={(e: any) => {
                    setListSize(Number(e.target.value));
                    listSizeRef.current = Number(e.target.value);
                  }}
                />
              </div>
              <div className="ic-btn zoom-btn" onClick={() => zoomIn()}>
                <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-toolbar-zoom-in.svg`} />
              </div>
            </div>
          </div>
          <div className="right">
            <div className="ic-btns">
              <div className="ic-btn" onClick={() => selectAll()}>
                <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/batch-save-select-all.svg`} />
                {t('batchImport.selectAll')}
              </div>
              <div className="ic-btn" onClick={() => invertSelected()}>
                <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/batch-save-select-invert.svg`} />
                {t('batchImport.reverseSelect')}
              </div>
            </div>
            <input
              id="batch-save-panel-search"
              maxLength={4096}
              type="search"
              selectall=""
              className="search"
              placeholder={t('toolbar.searchPlaceholder')}
              onChange={(e: any) => {
                // ng-model debounce 50 / blur 0
                clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => {
                  filterRef.current.keyword = e.target.value;
                  onFilterChange();
                }, 50);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="close" onClick={() => close()} />
          </div>
        </div>

        <div className="batch-save-panel-container">
          {/* 內容列表 */}
          <div className="gallery" ref={galleryRef as any}>
            <div className="gallery-container" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${listSize}px, 1fr))` }}>
              <div className="empty" style={ngShow(displayedRef.current.length !== 0)}>
                <img
                  src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/illustrations/batch-save-empty.png`}
                  width={256}
                  height={144}
                />
                {t('batchImport.empty')}
              </div>
              {itemsRef.current.length > 0 &&
                displayedRef.current.map((image: any, index: number) => (
                  <div
                    key={index}
                    className={`item${isSelected(image) ? ' selected' : ''}`}
                    ref={(node: any) => {
                      if (node) node.__eagleItem = image;
                    }}
                    // 原版 ng-mousedown 为元素级监听（先于 .gallery 的 rect-select mousedown，
                    // 且 select 的 stopPropagation 阻止框选启动）；React 根委托会被 .gallery 上
                    // jQuery stopPropagation 拦截，故用 capture 相位等价
                    onMouseDownCapture={(e) => select(e, image)}
                  >
                    <div className="thumbnail">
                      {image.original.type === 'video' ? (
                        <video controls controlsList="nodownload nofullscreen" src={image.original.src || image.src} />
                      ) : (
                        <img src={image.original.blobUrl || image.original.src} />
                      )}
                    </div>

                    <div className="info">
                      <div
                        className="name"
                        title={iv(image.title)}
                        dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(image.title, filterRef.current.keyword || '') }}
                      />
                      {renderMetas(image)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          {/* 側欄 */}
          <div className="gallery-sidebar">
            <div className="gallery-sidebar-sections">
              {/* 大小篩選 */}
              <div className={`gallery-sidebar-section${batchSaver.showSize ? ' expand' : ''}`}>
                <div
                  className="info-section-label"
                  onClick={() => {
                    batchSaver.showSize = !batchSaver.showSize;
                    bumpAll();
                  }}
                >
                  <div className="name">{t('batchImport.size')}</div>
                  <div className="ic-btn info-section-expand">
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-expand.svg`} />
                  </div>
                </div>
                <div className="info-section-container options">
                  <div
                    className={`option${!filterRef.current.size ? ' selected' : ''}`}
                    onClick={() => {
                      filterRef.current.size = undefined;
                      onFilterChange();
                    }}
                  >
                    <div className="radio-icon" />
                    <div className="name">{t('batchImport.typeAll')}</div>
                  </div>
                  {['large', 'medium', 'small'].map((sizeKey) => (
                    <div
                      key={sizeKey}
                      className={`option${filterRef.current.size === sizeKey ? ' selected' : ''}`}
                      onClick={() => {
                        filterRef.current.size = sizeKey;
                        onFilterChange();
                      }}
                    >
                      <div className="radio-icon" />
                      <div className="name">{t(`batchImport.size>${sizeKey}`)}</div>
                      <div className="count">
                        <span style={ngShow(!!counts.selected?.size?.[sizeKey])}>{counts.selected?.size?.[sizeKey]} / </span>
                        {counts.size?.[sizeKey]}
                      </div>
                    </div>
                  ))}
                  <div
                    className={`option${filterRef.current.size === 'advanced' ? ' selected' : ''}`}
                    onClick={() => {
                      filterRef.current.size = 'advanced';
                      focusMinWInput();
                      onFilterChange();
                    }}
                  >
                    <div className="radio-icon" />
                    <div className="name">{t('batchImport.size>custom')}</div>
                  </div>
                  <div
                    className="image-size-filter"
                    style={ngShow(filterRef.current.size === 'advanced')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="item">
                      <div className="label">{t('filter.resolution>width')}</div>
                      <div className="range">
                        <input
                          id="batch-saver-min-w"
                          maxLength={256}
                          type="text"
                          placeholder={t('filter.resolution>min')}
                          defaultValue={batchSaver.filterMinW ?? ''}
                          onChange={(e: any) => {
                            // ng-model → batchSaver.filterMinW（setter 写 localStorage）+ debounce 300/blur 0
                            batchSaver.filterMinW = e.target.value;
                            onFilterChange();
                          }}
                        />
                        -
                        <input
                          id="batch-saver-max-w"
                          maxLength={256}
                          type="text"
                          placeholder={t('filter.resolution>max')}
                          defaultValue={batchSaver.filterMaxW ?? ''}
                          onChange={(e: any) => {
                            batchSaver.filterMaxW = e.target.value;
                            onFilterChange();
                          }}
                        />
                      </div>
                    </div>
                    <div className="item">
                      <div className="label">{t('filter.resolution>height')}</div>
                      <div className="range">
                        <input
                          id="batch-saver-min-h"
                          maxLength={256}
                          type="text"
                          placeholder={t('filter.resolution>min')}
                          defaultValue={batchSaver.filterMinH ?? ''}
                          onChange={(e: any) => {
                            batchSaver.filterMinH = e.target.value;
                            onFilterChange();
                          }}
                        />
                        -
                        <input
                          id="batch-saver-max-h"
                          maxLength={256}
                          type="text"
                          placeholder={t('filter.resolution>max')}
                          defaultValue={batchSaver.filterMaxH ?? ''}
                          onChange={(e: any) => {
                            batchSaver.filterMaxH = e.target.value;
                            onFilterChange();
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 格式篩選 */}
              <div className={`gallery-sidebar-section${batchSaver.showExt ? ' expand' : ''}`}>
                <div
                  className="info-section-label"
                  onClick={() => {
                    batchSaver.showExt = !batchSaver.showExt;
                    bumpAll();
                  }}
                >
                  <div className="name">{t('batchImport.type')}</div>
                  <div className="ic-btn info-section-expand">
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-expand.svg`} />
                  </div>
                </div>
                <div className="info-section-container options">
                  <div
                    className={`option${!filterRef.current.ext ? ' selected' : ''}`}
                    onClick={() => {
                      filterRef.current.ext = undefined;
                      onFilterChange();
                    }}
                  >
                    <div className="radio-icon" />
                    <div className="name">{t('batchImport.typeAll')}</div>
                  </div>
                  {['avif', 'gif', 'jpg', 'png', 'svg', 'webp', 'mp4', 'webm'].map((extKey) => (
                    <div
                      key={extKey}
                      className={`option${filterRef.current.ext === extKey ? ' selected' : ''}`}
                      style={ngShow(!!counts.has?.ext?.[extKey])}
                      onClick={() => {
                        filterRef.current.ext = extKey;
                        onFilterChange();
                      }}
                    >
                      <div className="radio-icon" />
                      <div className="name">{extKey}</div>
                      <div className="count">
                        <span style={ngShow(!!counts.selected?.ext?.[extKey])}>{counts.selected?.ext?.[extKey]} / </span>
                        {counts.ext?.[extKey]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 域名篩選 */}
              <div
                className={`gallery-sidebar-section${batchSaver.showDomains ? ' expand' : ''}`}
                style={ngShow(domainsRef.current.length > 1)}
              >
                <div
                  className="info-section-label"
                  onClick={() => {
                    batchSaver.showDomains = !batchSaver.showDomains;
                    bumpAll();
                  }}
                >
                  <div className="name">{t('batchImport.domain')}</div>
                  <div className="ic-btn info-section-expand">
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-expand.svg`} />
                  </div>
                </div>
                <div className="info-section-container options">
                  <div
                    className={`option${!filterRef.current.domain ? ' selected' : ''}`}
                    onClick={() => {
                      filterRef.current.domain = undefined;
                      onFilterChange();
                    }}
                  >
                    <div className="radio-icon" />
                    <div className="name">{t('batchImport.typeAll')}</div>
                  </div>
                  {domainsRef.current.map((domain: any, index: number) => (
                    <div
                      key={index}
                      className={`option${domain === filterRef.current.domain ? ' selected' : ''}`}
                      onClick={() => {
                        filterRef.current.domain = domain;
                        onFilterChange();
                      }}
                    >
                      <div className="radio-icon" />
                      <div className="name">{domain}</div>
                      <div className="count">
                        <span style={ngShow(!!counts.selected?.domain?.[domain])}>{counts.selected?.domain?.[domain]} / </span>
                        {counts.domain?.[domain]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 文件夾 */}
              <div className={`gallery-sidebar-section${batchSaver.showFolders ? ' expand' : ''}`}>
                <div
                  className="info-section-label"
                  onClick={() => {
                    batchSaver.showFolders = !batchSaver.showFolders;
                    bumpAll();
                  }}
                >
                  <div className="name">{t('inspector.includesFoldersLabel')}</div>
                  <div className="ic-btn info-section-expand">
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-expand.svg`} />
                  </div>
                </div>
                <div className="info-section-container label-container">
                  {importFoldersRef.current.map((folder: any, index: number) => (
                    <div
                      key={index}
                      className={`label-item color-${body?.folderMappings?.[folder.id]?.iconColor ?? ''}`}
                      style={ngShow(importFoldersRef.current.length > 0)}
                    >
                      <span className="label-item-name">{body?.folderMappings?.[folder.id]?.name}</span>
                      <div className="ic-btn label-item-remove-btn" onClick={(e) => removeImportFolder(e, folder)}>
                        <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-remove-label.svg`} />
                      </div>
                    </div>
                  ))}
                  {/* 新增資料夾（空狀態） */}
                  <div
                    className="ic-btn has-bg create-label-btn full-width"
                    style={ngShow(importFoldersRef.current.length !== 0)}
                    tippy=""
                    tippy-placement="bottom"
                    tippy-content={`${t('inspector.includesFoldersBtn')}<key>F</key>`}
                    onClick={() => selectFolders()}
                  >
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-add-label.svg`} />
                    <span>{t('inspector.includesFoldersBtn')}</span>
                  </div>
                  {/* 新增資料夾（已有資料狀態） */}
                  <div
                    className="ic-btn create-label-btn"
                    style={ngShow(importFoldersRef.current.length === 0)}
                    tippy=""
                    tippy-placement="bottom"
                    tippy-content={`${t('inspector.includesFoldersBtn')}<key>F</key>`}
                    onClick={() => selectFolders()}
                  >
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-add-label.svg`} />
                  </div>
                </div>
              </div>

              {/* 標籤 */}
              <div className={`gallery-sidebar-section${batchSaver.showTags ? ' expand' : ''}`}>
                <div
                  className="info-section-label"
                  onClick={() => {
                    batchSaver.showTags = !batchSaver.showTags;
                    bumpAll();
                  }}
                >
                  <div className="name">{t('inspector.includesTagsLabel')}</div>
                  <div className="ic-btn info-section-expand">
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-expand.svg`} />
                  </div>
                </div>
                <div className="info-section-container label-container">
                  {tagsRef.current.map((tag: any, index: number) => (
                    <div key={index} className={`label-item color-${body?.TagManager?.tagMappings?.[tag]?.color ?? ''}`} style={ngShow(tagsRef.current.length > 0)}>
                      <span className="label-item-name">{tag}</span>
                      <div className="ic-btn label-item-remove-btn" onClick={(e) => removeImportTag(e, tag)}>
                        <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-remove-label.svg`} />
                      </div>
                    </div>
                  ))}
                  {/* 新增標籤（空狀態） */}
                  <div
                    className="ic-btn has-bg create-label-btn full-width"
                    style={ngShow(tagsRef.current.length !== 0)}
                    tippy=""
                    tippy-placement="bottom"
                    tippy-content={`${t('inspector.tagInputPlaceholder')}<key>T</key>`}
                    onClick={() => selectTags()}
                  >
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-add-label.svg`} />
                    <span>{t('inspector.tagInputPlaceholder')}</span>
                  </div>
                  {/* 新增標籤（已有資料狀態） */}
                  <div
                    className="ic-btn create-label-btn"
                    style={ngShow(tagsRef.current.length === 0)}
                    tippy=""
                    tippy-placement="bottom"
                    tippy-content={`${t('inspector.tagInputPlaceholder')}<key>T</key>`}
                    onClick={() => selectTags()}
                  >
                    <img src={`assets/images/${themePathOf((body?.theme as string) || 'dark')}/icons/ic-inspector-add-label.svg`} />
                  </div>
                </div>
              </div>
            </div>

            {/* 按鈕 */}
            <div className="gallery-controls">
              <div
                className={`button button-xs button-primary button-block${selectedRef.current.length == 0 ? ' button-disabled' : ''}`}
                onClick={() => importRef.current()}
              >
                <img src="assets/images/base/icons/batch-save-import.svg" />
                {t('batchImport.import')}{' '}
                <span style={ngShow(selectedRef.current.length <= 0)}>({selectedRef.current.length})</span>
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