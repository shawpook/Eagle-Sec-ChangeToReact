import React, { useEffect, useRef } from 'react';
import { getBodyScope } from '../../global/scopeBridge';
import { FileUrlHelper } from '../../core/fileUrlHelper';

/**
 * b1-9be2：box 条目 JSX —— ng-grid-layout 模板（bundle:66524-66963）逐字 JSX 化。
 *
 * 模板字符串结构/类名/属性零改动；ng-grid 时代由 onLayoutComplete 在布局完成后补写
 * 的类（selected/tagged/pinned）与 raw/lsrc 属性，改为渲染时直读 bodyScope 等价实现
 * （v4 虚拟化下条目重挂即等价「每次布局后刷新」语义）。
 * 拖拽/错误 handler 走 window 全局函数（onDragStartContainer 等——bundle 时代即全局
 * 命名空间解析，见 gridDirectives 注记）。
 */

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

/* ---------- generateItem 计算段（bundle:66524-66963 逐字） ---------- */

function buildTemplateData(item: any): any {
  const scope = bodyScopeOf();
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
    templateData.hasSortableHelper = true;
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
    paragraphs.length = 50;
    const nameEl = <h4>{item.name.trim()}</h4>;
    void nameEl;
    templateData.txtParagraphs = paragraphs.map((p: string) => p.trim());
    templateData.isTxt = true;
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
      }
      templateData.fontActivateBtn = true;
      templateData.backgroundColor = 'rgba(255, 255, 255, 1)';
    } catch (err) {}
  }

  if (scope.preferences.habits.hoverZoom === 'on') {
    templateData.hoverZoom = true;
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
  return templateData;
}

const bodyScopeOf = () => getBodyScope();

/* ---------- 条目渲染（模板字符串 → JSX 结构逐字段对应） ---------- */

export function BoxItem({ item, ...rest }: { item: any; [key: string]: any }) {
  const data = buildTemplateData(item);
  const scope = bodyScopeOf();
  const ref = useRef<HTMLDivElement>(null);

  // ng-grid 时代 onLayoutComplete 补写的类/属性（bundle:67247-67294 逐字语义）：
  // selected/tagged/pinned 类 + raw/lsrc 属性 —— 渲染时直读 scope。
  const selected = !!(scope && scope.selectedMappings && scope.selectedMappings[data.id]);
  const pinned =
    !!(scope && scope.currentFolder && scope.currentFolder.orderBy !== 'RANDOM' &&
      item.pinned && item.pinned[scope.currentFolder.id]);

  useEffect(() => {
    // v4 布局引擎在条目挂载后自行定位；raw 属性按 onLayoutComplete 语义补写
    const el = ref.current;
    if (!el) return;
    const img = el.querySelector('img');
    if (img) {
      // raw/lsrc/lazysrc 为应用自定义裸属性（LazyLoadManager/懒加载链读取），React JSX
      // 不承载 —— 挂载后命令式补写（v3 模板 innerHTML 同形态）。
      img.setAttribute('raw', data.rawPath || '');
      img.setAttribute('lsrc', data.src || '');
      img.setAttribute('lazysrc', data.thumbnailPath || '');
      const supportLargeThumb: Record<string, boolean> = { jpg: true, png: true, webp: true, bmp: true };
      if (supportLargeThumb[item.ext] && (!item.orientation || item.orientation === 1) && scope) {
        img.setAttribute('raw', scope.getRawUrl(item));
      }
      const lazysrc = img.getAttribute('lazysrc');
      if (lazysrc && lazysrc !== 'undefined') {
        img.setAttribute('lsrc', lazysrc);
      }
    }
  });

  const imgStyle = data.imgStyle || undefined;
  let imgEl: React.ReactNode = (
    <img
      className={data.imgCss}
      style={imgStyle as any}
      draggable={true}
      onDragEnd={(e) => (window as any).onDragEndContainer(e)}
      onDragStart={(e) => (window as any).onDragStartContainer(e)}
      onDrag={(e) => (window as any).onImageDrag(e)}
      onError={(e) => (window as any).listImageError(e)}
    />
  );
  if (data.noPreview) {
    imgEl = (
      <>
        <div className="ext-icon-name" style={{ display: 'none' }}>{data.name}</div>
        <img
          ext-icon=""
          draggable={true}
          onDragEnd={(e) => (window as any).onDragEndContainer(e)}
          onDragStart={(e) => (window as any).onDragStartContainer(e)}
          onDrag={(e) => (window as any).onImageDrag(e)}
        />
      </>
    );
  }
  if (data.isTxt) {
    imgEl = null;
  }
  if (AUDIO_TYPES()[data.ext]) {
    imgEl = (
      <>
        <div className="ext-icon-name">{data.name}</div>
        {imgEl}
      </>
    );
  }

  const cls = [
    'box', `ext-${data.ext}`, data.ext, data.medium, data.css, `bg-${data.background}`,
    selected ? 'selected' : '', pinned ? 'pinned' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      id={`box-${data.id}`}
      data-box-id={data.id}
      className={cls}
      box-item=""
      data-width={data.width}
      data-height={data.height}
      {...rest}
    >
      <div
        className="box-drag-helper"
        draggable={true}
        onDragStart={(e) => (window as any).onDragStartContainer(e)}
        onDrag={(e) => (window as any).onImageDrag(e)}
        style={{ display: 'none' }}
      />
      <div
        className={`thumbnail ${data.thumbnailClass || ''}`}
        draggable={true}
        onDragStart={(e) => (window as any).onDragStartContainer(e)}
        onDrag={(e) => (window as any).onImageDrag(e)}
        style={{ backgroundColor: data.backgroundColor, aspectRatio: data.aspectRatio || undefined } as React.CSSProperties}
      >
        {data.typeLabel ? <span dangerouslySetInnerHTML={{ __html: data.typeLabel }} /> : null}
        {data.fontActivateBtn ? <div className="activate-btn" /> : null}
        {data.isTxt ? (
          <div
            className="txt-content"
            draggable={true}
            onDragEnd={(e) => (window as any).onDragEndContainer(e)}
            onDragStart={(e) => (window as any).onDragStartContainer(e)}
            onDrag={(e) => (window as any).onImageDrag(e)}
          >
            <div>
              <h4>{item.name.trim()}</h4>
              {(data.txtParagraphs || []).map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </div>
        ) : null}
        <div className="annotation-count" title={annotationTitleOf(item, data)}>
          <span>{data.annotationCount}</span>
        </div>
        {data.hoverZoom ? <div className="zoom-btn" /> : null}
        {imgEl}
      </div>
      <div className="list-name-tools">
        <div className="pin" />
        {data.fontActivateBtn ? <div className="activate-btn" /> : null}
      </div>
      <div className="name" title={titleOf(item, data)} data-ext={`.${data.ext}`}>
        <span>{data.name}</span>
      </div>
      <div className="prop tags" dangerouslySetInnerHTML={{ __html: data.tagsFormated }} />
      <div className="prop resolution">{data.resolution}</div>
      <div className="prop rating">
        <span className="small star" dangerouslySetInnerHTML={{ __html: ratingStrings[data.star] }} />
      </div>
      <div className="prop ext">{data.ext}</div>
      <div className="prop size">{data.sizeFormated}</div>
      <div className="prop mtime">{data.mtimeFormated}</div>
      <div className="metas" dangerouslySetInnerHTML={{ __html: data.metas }} />
      {data.hasSortableHelper ? (
        <>
          <div
            className="box-sortable-helper left"
            onDragEnter={(e) => (window as any).onDragOverBoxItem(e)}
            onDragLeave={(e) => (window as any).onDragLeaveBoxItem(e)}
            onDrop={(e) => (window as any).onDropBoxItem(e)}
          />
          <div
            className="box-sortable-helper right"
            onDragEnter={(e) => (window as any).onDragOverBoxItem(e)}
            onDragLeave={(e) => (window as any).onDragLeaveBoxItem(e)}
            onDrop={(e) => (window as any).onDropBoxItem(e)}
          />
        </>
      ) : null}
    </div>
  );
}

/* title / annotationTitle（bundle:66524-66546 逐字） */

function titleOf(item: any, data: any): string {
  let resolutionStr = '';
  if (data.width) {
    resolutionStr = `${i18nStr('inspector.props.resolution')}: ${data.resolution}\n`;
  }
  return `${i18nStr('inspector.props.fileType')}: ${data.ext}\n${resolutionStr}${i18nStr('inspector.props.fileSize')}: ${data.sizeFormated}\n${i18nStr('inspector.props.mtime')}: ${data.mtimeFormated}\n${i18nStr('inspector.props.btime')}: ${dateFilter(data.btime || data.modificationTime, 'yyyy/MM/dd HH:mm')}`;
}

function annotationTitleOf(_item: any, data: any): string {
  let annotationTitle = '';
  if (data.annotationCount > 0) {
    try {
      data.comments.forEach((comment: any, index: number) => {
        if (index !== data.comments.length - 1) {
          annotationTitle += `${comment.annotation.replaceAll('\\<[^>]*>', '')}\n`;
        } else {
          annotationTitle += `${comment.annotation.replaceAll('\\<[^>]*>', '')}`;
        }
      });
    } catch (err) {
      annotationTitle = '';
    }
  }
  return annotationTitle;
}
