import { FileUrlHelper } from '../../core/fileUrlHelper';
import { getBodyScope } from '../../global/scopeBridge';

/**
 * 阶段4：内容网格引擎 —— ngGridLayout 指令（bundle:66496-67305）的逐字移植。
 *
 * 契约与原版一致：
 *  - window.resetNgGridLayoutData(items, cursor, scrollPercentage)（bundle:66970；调用方为
 *    EagleController 的 21893/21908/27452/30541 四处，零改动）
 *  - window.ig / window.NgGridStrings 保持同名全局（被 boxContainerScrollbar/rect-select 等
 *    消费，bundle:4050/5264/5397/5420/5865）
 *  - bodyScope 上的 gl:reset / gl:scrollToTop / gl:removeItems 事件等价监听
 * DOM：boxes 生成于静态 #box-list（index.html 保留元素、删除 ng-* 属性，旧引用已删）。
 */

let ig: any = null;
let NgGridStrings: Record<string, string> = {};
let startCursor = 0;
let startGroupKey = 1000000;
let scrollAnimationFrame: number | null = null;
let initDataTimeout: any = null;
let pendingScrollPercentage: number | null = null;
let items: any[] = [];
let fixedImageMapinngs: Record<string, boolean> = {};
let checkedImageMapinngs: Record<string, boolean> = {};
let scopeEventsDereg: Array<() => void> = [];

const bodyScope = () => getBodyScope();

const AUDIO_TYPES = () => (window as any).AUDIO_TYPES || {};
const VIDEO_TYPES = () => (window as any).VIDEO_TYPES || {};
const FONT_TYPES = () => (window as any).FONT_TYPES || {};
const SPECIAL_TYPES = () => (window as any).SPECIAL_TYPES || {};

const fileSize = (bytes: number, precision?: number) => {
  const fn = (window as any).fileSize;
  return fn ? fn(bytes, precision) : `${bytes}`;
};

const ratingStrings: Record<string, string> = {
  undefined: '★★★★★',
  0: '★★★★★',
  1: '<y>★</y>★★★★',
  2: '<y>★★</y>★★★',
  3: '<y>★★★</y>★★',
  4: '<y>★★★★</y>★',
  5: '<y>★★★★★</y>',
};

const dateFilter = (value: number, format: string): string => {
  // $filter("date")(x, "yyyy/MM/dd HH:mm")
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (format !== 'yyyy/MM/dd HH:mm') return String(value);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const escapeAttr = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeHtmlAll = (s: string) => {
  const charMap: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#60;', '=': '&#61;',
  };
  return String(s).replace(/[&<>"'`=\/]/g, (c) => charMap[c]);
};

const i18nStr = (key: string) => {
  const inst = (window as any).i18n;
  return inst && inst.__ ? inst.__(key) : key;
};

/* ---------- getItem / generateItem（bundle:66524-66963 逐字） ---------- */

function getItem(data: any): string {
  let resolutionStr = '';
  if (data.width) {
    resolutionStr = `${i18nStr('inspector.props.resolution')}: ${data.resolution}&#10;`;
  }
  const title = `${i18nStr('inspector.props.fileType')}: ${data.ext}&#10;${resolutionStr}${i18nStr('inspector.props.fileSize')}: ${data.sizeFormated}&#10;${i18nStr('inspector.props.mtime')}: ${data.mtimeFormated}&#10;${i18nStr('inspector.props.btime')}: ${dateFilter(data.btime || data.modificationTime, 'yyyy/MM/dd HH:mm')}`;
  let annotationTitle = '';
  if (data.annotationCount > 0) {
    try {
      data.comments.forEach((comment: any, index: number) => {
        if (index !== data.comments.length - 1) {
          annotationTitle += `${comment.annotation.replaceAll('\\<[^>]*>', '')}&#10;`;
        } else {
          annotationTitle += `${comment.annotation.replaceAll('\\<[^>]*>', '')}`;
        }
      });
    } catch (err) {
      annotationTitle = '';
    }
  }

  let imgStr = `<img class="${data.imgCss}" style="${data.imgStyle}" raw="${data.rawPath || ''}" lsrc="${data.src}" lazysrc="${data.thumbnailPath}" draggable="true" ondragend="onDragEndContainer(event)" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)" onerror="listImageError(event)">`;
  if (data.noPreview) {
    imgStr = `<div class="ext-icon-name" style="display: none;">${data.name}</div><img ext-icon draggable="true" ondragend="onDragEndContainer(event)" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)">`;
    data.hoverZoom = '';
    data.thumbnailClass = 'ext-icon';
  }
  if (data.ext === 'txt') {
    data.typeLabel = '';
    data.hoverZoom = '';
    imgStr = '';
    data.width = 200;
    data.height = 200;
  }
  if (AUDIO_TYPES()[data.ext]) {
    imgStr = `<div class="ext-icon-name">${data.name}</div>${imgStr}`;
  }
  if (data.customThumbnail) {
    data.css += ' custom-thumbnail ';
  }

  return `<div id="box-${data.id}" data-box-id="${data.id}" class="box ext-${data.ext} ${data.ext} ${data.medium} ${data.css} bg-${data.background}" box-item data-width="${data.width}" data-height="${data.height}">
      <div class="box-drag-helper" draggable="true" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)" style="display: none;"></div>
      <div class="thumbnail ${data.thumbnailClass}" draggable="true" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)" style="background-color: ${data.backgroundColor}; aspect-ratio:${data.aspectRatio};">
        ${data.typeLabel}
        ${data.fontActivateBtn}
        ${data.txtContent}
        <div class="annotation-count" title="${annotationTitle}"><span>${data.annotationCount}</span></div>
        ${data.hoverZoom}
        ${imgStr}
      </div>
      <div class="list-name-tools">
        <div class="pin"></div>
        ${data.fontActivateBtn}
      </div>
      <div class="name" title="${title}" data-ext=".${data.ext}"><span>${data.name}</span></div>
      <div class="prop tags">${data.tagsFormated}</div>
      <div class="prop resolution">${data.resolution}</div>
      <div class="prop rating"><span class="small star">${ratingStrings[data.star]}</span></div>
      <div class="prop ext">${data.ext}</div>
      <div class="prop size">${data.sizeFormated}</div>
      <div class="prop mtime">${data.mtimeFormated}</div>
      <div class="metas">${data.metas}</div>
      ${data.sortableHelper}
    </div>`;
}

function generateItem(item: any, index: number): string | undefined {
  if (!item.id) return;
  try {
    const scope = bodyScope();
    const isGridLayout = scope.layout === 'GridLayout';
    void isGridLayout;
    const templateData: any = {
      id: item.id,
      ext: item.ext,
      star: item.star || '0',
      medium: item.medium || '',
      name: item.name,
      size: item.size,
      sizeFormated: fileSize(item.size, 1),
      btime: item.btime,
      mtime: item.mtime,
      modificationTime: item.modificationTime,
      mtimeFormated: dateFilter(item.modificationTime, 'yyyy/MM/dd HH:mm'),
      metas: `${item.width} × ${item.height}`,
      resolution: `${item.width} × ${item.height}`,
      comments: item.comments,
      annotationCount: (item.comments && item.comments.length) || 0,
      css: '',
      background: item.background,
      imgCss: '',
      imgStyle: '',
      width: item.width,
      height: item.height,
      backgroundColor: 'rgba(128, 128, 128, 0.1)',
      preloadSrc: '',
      videoEmbed: '',
      fontActivateBtn: '',
      hoverZoom: '',
      typeLabel: '',
      sortableHelper: '',
      txtContent: '',
      customThumbnail: item.customThumbnail ?? false,
    };

    templateData.tagsFormated = '';
    if (item.tags && item.tags.length) {
      for (let i = 0; i < item.tags.length; i++) {
        try {
          templateData.tagsFormated += `<div class="tag color-${scope.TagManager.tagMappings[item.tags[i]].color}">${escapeAttr(item.tags[i])}</div>`;
        } catch (err) {}
      }
    } else {
      templateData.tagsFormated = '-';
    }

    if (scope.currentFolder) {
      templateData.sortableHelper = `
        <div class="box-sortable-helper left" ondragenter="onDragOverBoxItem(event)" ondragleave="onDragLeaveBoxItem(event)" ondrop="onDropBoxItem(event)"></div>
        <div class="box-sortable-helper right" ondragenter="onDragOverBoxItem(event)" ondragleave="onDragLeaveBoxItem(event)" ondrop="onDropBoxItem(event)"></div>
        `;
    }

    const lastThumbnailPath = FileUrlHelper ? FileUrlHelper.getLastestThumbnailUrl(item) : '';

    if (item.noPreview) {
      templateData.src = '';
      templateData.thumbnailPath = '';
      templateData.backgroundColor = 'transparent';
      templateData.resolution = '-';
      templateData.noPreview = item.noPreview;
    } else if (item && item.noThumbnail && item.ext === 'svg' && item.size >= 10000000) {
      templateData.src = '';
      templateData.thumbnailPath = '';
    } else if (item && item.noThumbnail && item.size >= 10000000) {
      templateData.src = '';
      templateData.thumbnailPath = lastThumbnailPath;
    } else {
      templateData.src = lastThumbnailPath;
      const supportLargeThumb: Record<string, boolean> = { jpg: true, png: true, webp: true, bmp: true, jfif: true };
      if (supportLargeThumb[item.ext] && (!item.orientation || item.orientation === 1)) {
        templateData.rawPath = scope.getRawUrl(item);
      }
      if ((item?.animated || item.ext === 'gif') && scope.preferences.habits.alwaysPlayGIF === 'on') {
        const rawPath = scope.getRawUrl(item);
        templateData.rawPath = rawPath;
        templateData.thumbnailPath = rawPath;
        templateData.src = rawPath;
      }
      templateData.thumbnailPath = '';
    }

    templateData.typeCSS = templateData.ext;
    templateData.typeValue = templateData.typeCSS.toUpperCase();

    if ('png jpg'.indexOf(templateData.ext) === -1) {
      if (item.bpm) {
        templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label ${templateData.typeCSS}">${templateData.typeValue} / BPM: ${parseInt(item.bpm)}</div></div>`;
      } else if (item.medium) {
        templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label ${templateData.typeCSS} ${item.medium}">${item.medium.capitalize()}</div></div>`;
      } else {
        templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label ${templateData.typeCSS}">${templateData.typeValue}</div></div>`;
      }
    } else {
      templateData.typeLabel = `<div class="top-left"><div class="pin"></div><div class="type-label"></div></div>`;
    }

    if (templateData.ext === 'txt') {
      templateData.resolution = '-';
      templateData.src = '';
      templateData.thumbnailPath = '';
      let paragraphs: string[] = String(item.text || '').split('\n').map((p: string) => escapeHtmlAll(p));
      let paragraphsHTML = '';
      paragraphsHTML += `<h4>${item.name.trim()}</h4>`;
      paragraphs.length = 50;
      paragraphs.forEach((paragraph) => {
        paragraphsHTML += `<p>${paragraph.trim()}</p>`;
      });
      templateData.txtContent = `<div class="txt-content" draggable="true" ondragend="onDragEndContainer(event)" ondragstart="onDragStartContainer(event)" ondrag="onImageDrag(event)"><div>${paragraphsHTML || ''}</div></div>`;
    }

    if (item.palettes && item.palettes[0]) {
      templateData.backgroundColor = `rgba(${item.palettes[0].color[0]}, ${item.palettes[0].color[1]}, ${item.palettes[0].color[2]}, 0.2)`;
    }

    if (item.tags && item.tags.length > 0) {
      templateData.css += ' tagged ';
    }

    if (item.fontMetas && item.fontMetas.postScriptName) {
      try {
        const fontFolder = (window as any).fontFolder || '';
        const key = Object.keys(item.fontMetas.postScriptName)[0];
        const postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
        const fontPath = `${fontFolder}/${postScriptName}.${item.ext}`;
        const fs = (window as any).require?.('fs');
        if (fs && fs.existsSync(fontPath)) {
          templateData.css += ' activated ';
          templateData.fontActivateBtn = `<div class="activate-btn"></div>`;
        } else {
          templateData.fontActivateBtn = `<div class="activate-btn"></div>`;
        }
        templateData.backgroundColor = 'rgba(255, 255, 255, 1)';
      } catch (err) {}
    }

    if (scope.preferences.habits.hoverZoom === 'on') {
      templateData.hoverZoom = `<div class="zoom-btn"></div>`;
    }

    templateData.aspectRatio = `${templateData.width || 200}/${templateData.height || 200}`;

    if (item.height / item.width >= 2.5) {
      templateData.imgCss += ' long';
      templateData.css += ' long ';
      templateData.aspectRatio = '';
    }

    if (item.height === item.width) {
      templateData.imgCss += ' square';
    }

    if (item.height <= 180 && item.width <= 240) {
      templateData.css += ' pixelated ';
    } else if (item.height <= 320 || item.width <= 320) {
      templateData.css += ' optimize-contrast ';
    }

    if (item.width / item.height >= 2) {
      templateData.imgCss += ' panoramic-landscape';
    }

    if (item.orientation && !item.noThumbnail) {
      const rMap: Record<number, string> = { 8: ' r8 ', 7: ' r7 ', 6: ' r6 ', 5: ' r5 ', 4: ' r4 ', 3: ' r3 ', 2: ' r2 ' };
      if (rMap[item.orientation]) templateData.imgCss += rMap[item.orientation];
      if (item.orientation > 4) {
        if (item.width < item.height) {
          templateData.imgStyle += ` min-width: ${(item.height / item.width) * 100}%; `;
        } else {
          templateData.imgStyle += ` width: ${(item.height / item.width) * 100}%; `;
        }
      }
    }

    if (item.comments && item.comments.length > 0) {
      templateData.css += ' has-annotation ';
    }

    switch (scope.listMetaType) {
      case 'RESOLUTION':
        if (item.duration && VIDEO_TYPES()[item.ext]) templateData.metas = durationFilter(item.duration);
        else if (item.duration && AUDIO_TYPES()[item.ext]) templateData.metas = durationFilter(item.duration);
        else if (item.fontMetas && FONT_TYPES()[item.ext]) templateData.metas = item.fontMetas.weight;
        else if (SPECIAL_TYPES()[item.ext]) templateData.metas = `${fileSize(item.size, 1)}`;
        else if (item.noPreview) templateData.metas = `${fileSize(item.size, 1)}`;
        else if (item.ext === 'url') {
          templateData.metas = item.duration ? durationFilter(item.duration) : domainNameFilter(item.url);
        } else templateData.metas = `${item.width} × ${item.height}`;
        break;
      case 'FILESIZE':
        templateData.metas = `${fileSize(item.size, 1)}`;
        break;
      case 'TYPE':
        templateData.metas = item.ext.toUpperCase();
        break;
      case 'MTIME':
        templateData.metas = dateFilter(item.mtime || item.modificationTime, 'yyyy/MM/dd HH:mm');
        break;
      case 'BTIME':
        templateData.metas = dateFilter(item.btime || item.modificationTime, 'yyyy/MM/dd HH:mm');
        break;
      case 'TAGS':
        templateData.metas = '';
        if (item.tags && item.tags.length) {
          templateData.metas = item.tags
            .map((tag: string) => `<div class="tag color-${scope.TagManager.tagMappings[tag].color}">${escapeAttr(tag)}</div>`)
            .join('');
        } else {
          templateData.metas = '-';
        }
        break;
      case 'RATING':
        templateData.metas = `<span class="small star">${ratingStrings[item.star]}</span>`;
        break;
    }
    return getItem(templateData);
  } catch (err) {
    console.log(err);
    return undefined;
  }
}

const durationFilter = (str: any): string => {
  try {
    if (str) {
      const date = new Date(0);
      const seconds = Math.max(1, parseInt(str));
      date.setSeconds(seconds);
      if (seconds < 3600) return date.toISOString().substr(14, 5);
      return date.toISOString().substr(11, 8);
    }
  } catch (err) {}
  return '';
};

const domainNameFilter = (url: string): string => {
  if (!url) return '';
  const a = document.createElement('a');
  a.href = url;
  return a.hostname.toLowerCase();
};

/* ---------- 引擎（bundle:66592-66620 + 66964-67303 逐字） ---------- */

const domparser = new DOMParser();
const getNodes = (str: string) => Array.from(domparser.parseFromString(str, 'text/html').body.childNodes);

let options = { page: 60, preload: 1, align: 'left' };

function getItems(start: number, length: number): HTMLElement[] {
  const arr: HTMLElement[] = [];
  let nodesString = '';
  for (let i = start; i < start + length; ++i) {
    if (items[i]) {
      const item = generateItem(items[i], i);
      if (item) {
        nodesString += item;
        NgGridStrings[items[i].id] = item;
      }
    }
  }
  const nodes = getNodes(nodesString);
  for (const node of nodes) {
    if ((node as HTMLElement).nodeName === 'DIV') arr.push(node as HTMLElement);
  }
  return arr;
}

const throttle = (fn: (...args: any[]) => void, wait: number) => {
  let last = 0;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
};

function onLayoutComplete(e: any) {
  const scope = bodyScope();
  if (!scope) return;
  e.target.forEach((item: any) => {
    if (!item.el || !item.el.parentNode) return;
    const id = item.el.getAttribute('data-box-id');
    const image = scope.itemMappings[id];
    if (!image) return;
    const $ = (window as any).jQuery || (window as any).$;
    const $item = $(item.el);
    let classNames = '';
    if (scope.selectedMappings[id]) classNames += 'selected ';
    if (image && image.tags && image.tags.length > 0) classNames += 'tagged ';
    if (scope.currentFolder && scope.currentFolder.orderBy !== 'RANDOM') {
      if (image.pinned && image.pinned[scope.currentFolder.id]) classNames += 'pinned ';
    }
    const $img = $item.find('img');
    if (classNames !== '') $item.addClass(classNames);
    const supportLargeThumb: Record<string, boolean> = { jpg: true, png: true, webp: true, bmp: true };
    if (supportLargeThumb[image.ext] && (!image.orientation || image.orientation === 1)) {
      $img.attr('raw', scope.getRawUrl(image));
    }
    const lazysrc = $img.attr('lazysrc');
    if (lazysrc && lazysrc !== 'undefined') {
      $img.attr('lsrc', lazysrc);
    }
  });
}

function registerToLazyLoadManager(e: any) {
  const scope = bodyScope();
  const lazyLoadManager = scope && scope.lazyLoadManager;
  if (!lazyLoadManager) return;
  e.target.forEach((item: any) => {
    if (!item.el || !item.el.parentNode) return;
    if (!item.el.classList.contains('show')) {
      lazyLoadManager.observe(item.el);
    }
  });
}

function applyScrollPercentage(decimalPart: number) {
  if (!ig || !ig._items || !ig._items._data) return;
  const groups = ig._items._data;
  if (groups.length === 0) return;
  const currentGroup = groups[0];
  if (!currentGroup || !currentGroup.outlines) return;
  const pageStart = currentGroup.outlines.start[0] || 0;
  const pageEnd = currentGroup.outlines.end[currentGroup.outlines.end.length - 1] || 0;
  const pageHeight = pageEnd - pageStart;
  if (pageHeight > 0) {
    const targetScrollTop = pageStart + pageHeight * decimalPart;
    const boxContainer = document.getElementById('box-container');
    if (boxContainer) smoothScrollTo(boxContainer, targetScrollTop, 200);
  }
}

function smoothScrollTo(element: HTMLElement, targetPosition: number, duration: number) {
  if (scrollAnimationFrame) {
    cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
  }
  const startPosition = element.scrollTop;
  const distance = targetPosition - startPosition;
  if (Math.abs(distance) < 5) {
    element.scrollTop = targetPosition;
    return;
  }
  const startTime = performance.now();
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    element.scrollTop = startPosition + distance * easeOutCubic(progress);
    if (progress < 1) scrollAnimationFrame = requestAnimationFrame(animate);
    else {
      element.scrollTop = targetPosition;
      scrollAnimationFrame = null;
    }
  };
  scrollAnimationFrame = requestAnimationFrame(animate);
}

function resetData(scrollPercentage?: number) {
  const list = document.querySelector('#box-container .box-list') as HTMLElement | null;
  if (!list || list.clientWidth === 0) {
    setTimeout(() => resetData(scrollPercentage), 100);
    return;
  }
  if (scrollAnimationFrame) {
    cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
  }
  const scope = bodyScope();
  const lazyLoadManager = scope && scope.lazyLoadManager;
  if (lazyLoadManager) {
    lazyLoadManager.softReset();
    lazyLoadManager.initObserver();
  }
  const eg = (window as any).eg;
  if (!eg) return;
  if (ig) {
    ig.clear();
    ig.destroy();
  }
  ig = new eg.InfiniteGrid('#box-container .box-list', {
    isOverflowScroll: false,
    threshold: 2000,
  });
  (window as any).ig = ig;
  NgGridStrings = {};
  (window as any).NgGridStrings = NgGridStrings;
  initData(scrollPercentage);
}

function initData(scrollPercentage?: number) {
  const scope = bodyScope();
  if (!items || items.length === 0) {
    const list = document.getElementById('box-list');
    if (list) list.style.height = '';
    return;
  }
  if (scrollPercentage !== undefined && scrollPercentage !== null) {
    pendingScrollPercentage = scrollPercentage;
  }
  if (!scope) return;
  const currentImageSize = scope.imageSize.height;
  const container = document.getElementById('box-container') as HTMLElement;
  const allLayout = 'grid-layout justified-layout list-layout';
  const eg = (window as any).eg;

  if (scope.layout === 'GridLayout' || scope.layout === 'SquareLayout') {
    container.classList.remove(...allLayout.split(' '));
    container.classList.add('grid-layout');
    ig.setLayout(eg.InfiniteGrid.GridLayout, { margin: 8, align: options.align });
  } else if (scope.layout === 'ListLayout') {
    container.classList.remove(...allLayout.split(' '));
    container.classList.add('list-layout');
    ig.setLayout(eg.InfiniteGrid.GridLayout, { margin: 0, align: options.align });
  } else {
    container.classList.remove(...allLayout.split(' '));
    container.classList.add('justified-layout');
    ig.setLayout(eg.InfiniteGrid.JustifiedLayout, {
      minSize: currentImageSize * 1 - 10,
      maxSize: currentImageSize * 1 + 10,
      margin: 8,
    });
  }

  ig.on({
    prepend: throttle(() => {
      const groupKeys = ig.getGroupKeys(true);
      const groupKey = (groupKeys[0] || 0) - 1;
      const next = getItems((groupKey + options.preload - 1 - startGroupKey + startCursor) * options.page, options.page);
      if (next.length > 0) ig.prepend(next, groupKey);
      if (scope.layout === 'GridLayout' && groupKey === 999999) ig.layout();
      if (groupKey === 999999) {
        const subFolderContainer = document.getElementById('sub-folder-container');
        if (subFolderContainer && subFolderContainer.style.display === 'none') {
          subFolderContainer.style.display = '';
        }
      }
    }, 100),
    append: () => {
      const groupKeys = ig.getGroupKeys(true);
      const groupKey = (groupKeys[groupKeys.length - 1] || 0) + 1;
      const next = getItems((groupKey + options.preload - 1 - startGroupKey + startCursor) * options.page, options.page);
      ig.append(next, groupKey);
    },
    layoutComplete: (e: any) => {
      setTimeout(() => {
        onLayoutComplete(e);
        registerToLazyLoadManager(e);
        if (pendingScrollPercentage !== null) {
          applyScrollPercentage(pendingScrollPercentage);
          pendingScrollPercentage = null;
        }
      }, 100);
    },
  });

  if (startCursor === 0 || !items[startCursor * options.page]) {
    const first = getItems(0 * options.page, options.page * options.preload);
    ig.append(first, startGroupKey);
  } else {
    const first = getItems(startCursor * options.page, options.page * options.preload);
    ig.append(first, startGroupKey);
    if (first.length < options.page) return;
    clearTimeout(initDataTimeout);
    initDataTimeout = setTimeout(() => {
      const nextItems = getItems((startCursor + 1) * options.page, options.page * options.preload);
      if (nextItems.length > 0) {
        ig.append(nextItems, startGroupKey + 1);
      } else {
        const nextItems2 = getItems((startCursor + 1) * options.page, options.page * options.preload);
        if (nextItems2.length > 0) {
          ig.prepend(nextItems2, startGroupKey - 1);
        }
      }
    }, 100);
  }
}

/* ---------- 对外契约（resetNgGridLayoutData + gl:* 事件） ---------- */

function removeItems(itemElements: any[]) {
  const scope = bodyScope();
  const lazyLoadManager = scope && scope.lazyLoadManager;
  (itemElements || []).forEach((item) => {
    if (lazyLoadManager && item.el) {
      lazyLoadManager.unobserve(item.el);
      lazyLoadManager.cancelLoad(item.el);
    }
    ig.remove(item);
  });
  ig.layout(true);
  setTimeout(() => {
    ig._updateContainerHeight();
  }, 100);
}

let installed = false;

export function installBoxGrid(): () => void {
  const w = window as any;
  if (installed) return () => {};
  installed = true;

  // 原由 ngGridLayout link 设置的全局（bundle:66507-66509）：window.$bodyScope。
  // InfiniteGrid 的 getViewportSize（bundle:4362）等大量模块直接读取它，必须保持。
  const ensureBodyScope = setInterval(() => {
    if (!w.$bodyScope) {
      const scope = bodyScope();
      if (scope) w.$bodyScope = scope;
    } else {
      clearInterval(ensureBodyScope);
    }
  }, 200);
  scopeEventsDereg.push(() => clearInterval(ensureBodyScope));

  w.resetNgGridLayoutData = (nextItems: any[], cursor?: number, scrollPercentage?: number) => {
    items = nextItems;
    startCursor = cursor || 0;
    startGroupKey = 1000000 + startCursor;
    resetData(scrollPercentage);
  };

  // 事件等价监听（原指令 scope 上的 $on，改挂 bodyScope）
  const attach = () => {
    const scope = bodyScope();
    if (!scope) return false;
    scopeEventsDereg.push(scope.$on('gl:reset', (_e: unknown, nextItems: any[], cursor?: number) => {
      items = nextItems;
      startCursor = cursor || 0;
      startGroupKey = 1000000 + startCursor;
      resetData();
    }));
    scopeEventsDereg.push(scope.$on('gl:scrollToTop', () => resetData()));
    scopeEventsDereg.push(scope.$on('gl:removeItems', (_e: unknown, itemElements: any[]) => removeItems(itemElements)));
    return true;
  };
  if (!attach()) {
    const retry = setInterval(() => {
      if (attach()) clearInterval(retry);
    }, 300);
    scopeEventsDereg.push(() => clearInterval(retry));
  }

  return () => {
    scopeEventsDereg.forEach((d) => { try { d(); } catch {} });
    scopeEventsDereg = [];
  };
}

export function getBoxListHost(): HTMLElement | null {
  return document.getElementById('box-list');
}
