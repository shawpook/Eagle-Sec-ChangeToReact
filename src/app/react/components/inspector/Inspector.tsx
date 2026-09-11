import { FileUrlHelper } from '../../core/fileUrlHelper';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInspectorState, InspectorSnapshot, SelectedItemSnapshot } from '../../store/inspectorState';
import { useToolbarState } from '../../store/toolbarState';
import { t } from '../../global/eagleGlobals';
import { filesize, duration, longTitle, substring, sortHSL, shortcuts } from '../../app/filters';
import { useTippy, useSelectAll } from '../hooks';
import { CornerBtns } from '../toolbar/Toolbar';
import { ContentEditable } from './ContentEditable';
import { $ } from '../detail/detailHooks';
import {
  updateSelection,
  imagesChange,
  inspectorNameChange,
  annotationChange,
  urlChange,
  inspectorCategoryNameChange,
  inspectorCategoryDescriptionChange,
  preventEnter,
  selectLinkInput,
  newUrlKeyup,
  setFolderPassword,
  changeFolderPassword,
  resetFolderPassword,
  rgbToHex,
  copyComment,
  openComment,
  highlightAnnotation,
  removeHighlightAnnotation,
  removeImageComment,
  openVideoComment,
  editVideoComment,
  removeVideoComment,
  tagsInputMouseDown,
  openHelpContextMenu,
  onInspectorResize,
  bindInspectorEvents,
} from './inspectorActions';
import { req } from '../detail/detailHooks';
import { makeResizable } from '../interactions/resizable';
import { makeSortable, sortableToArray } from '../interactions/sortable';
import { syncPanelFromScope } from '../../store/panelState';
import { syncInspectorFromScope } from '../../store/inspectorState';
import { getBodyScope, scopeApply, scoped, SCOPED_HANDLER } from '../../core/appCore';
import { machineryAutoScroll, machineryChangeStar, machineryOpenInspectorTagSelectPanel, machineryOpenInspectorFolderSelectPanel, machineryQuickOpenFolder } from '../../core/dataMachinery';
import { filterWithColor } from '../../core/filterDomain';
import { removeFromFolder } from '../../services/batchOpsService';
import { getRawUrl } from '../../core/itemDomain';

/**
 * 阶段6：检查器接管。
 *
 * DOM 规范 = src/app/js/directives/inspector.html + inspector-tags/folders/annotations/
 * information/plugin.html（旧 <inspector> 元素与模板已从 index.html 删除，壳保留为
 * #eagle-inspector-host）。事件调回 EagleController 同名函数；inspector 指令 link
 * （bundle 54273-55300）的派生逻辑转写为 inspectorActions（updateSelection 等）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;

const call = (fn: string | ((...a: any[]) => any), ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    const target = typeof fn === 'function' ? fn : scope[fn];
    if (typeof target !== 'function') return;
    const args = preArgs.length ? preArgs : e === undefined ? [] : [e];
    // scoped(fn)：见 appCore.SCOPED_HANDLER——machinery 函数需以 scope 为首参。
    if (typeof fn === 'function' && (fn as any)[SCOPED_HANDLER]) target(scope, ...args);
    else target(...args);
  });

/** Angular number 过滤器（分组）。 */
const numFilter = (value: any, frac = 0): string => {
  if (value == null || isNaN(Number(value))) return String(value ?? '');
  return Number(value)
    .toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac });
};

/** Angular date 过滤器（本例只用 yyyy/MM/dd [HH]:mm 两种格式）。 */
const angDate = (value: any, format: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  if (format === 'yyyy/MM/dd h:mm') {
    const h = d.getHours();
    const mm = pad(d.getMinutes());
    return `${yyyy}/${MM}/${dd} ${h}:${mm}`;
  }
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}/${MM}/${dd} ${HH}:${mm}`;
};

/* ---------------- ext-icon 指令（70817-70836） ---------------- */

export function ExtIcon({ itemId }: { itemId: string }) {
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !itemId) return;
    const item = getBodyScope()?.itemMappings?.[itemId];
    if (!item) return;
    const rawPath = FileUrlHelper.getRawPath(item);
    el.innerHTML = `<div class="ext-icon"><img></div>`;
    const FILE_ICON = req((window as any).appRoot.path + '/my_modules/file-icon');
    FILE_ICON.getFileThumbnail(item, rawPath, (base64: string) => {
      const img = el.querySelector('img');
      if (img) img.setAttribute('src', base64);
    });
    return () => {
      el.innerHTML = '';
    };
  }, [itemId]);

  return <ext-icon ref={hostRef as any} />;
}

/* ---------------- comment-video 指令（70781-70817） ---------------- */

function useCommentVideo(videoRef: React.RefObject<HTMLVideoElement | null>, comment: any) {
  const isLoadRef = useRef(false);
  const duration = comment?.duration;

  useEffect(() => {
    isLoadRef.current = false;
  }, [comment]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const $comment = $(video).parent();

    const onHover = () => {
      if (!isLoadRef.current) {
        isLoadRef.current = true;
        video.src = getRawUrl(getBodyScope().selected[0]);
        const onLoaded = () => {
          if (duration) {
            video.currentTime = duration;
          }
        };
        const onError = () => {
          video.style.display = 'none';
        };
        $(video).on('loadedmetadata', onLoaded);
        $(video).on('error', onError);
      }
    };
    $comment.on('hover.comment', onHover);
    return () => {
      $comment.off('hover.comment');
    };
  }, [duration]);
}

/* ---------------- 预览图（selected-preview 内单个 image 块） ---------------- */

function PreviewImage({
  snapshot,
  image,
  isSingle,
}: {
  snapshot: InspectorSnapshot;
  image: SelectedItemSnapshot;
  isSingle: boolean;
}) {
  const { theme, isDetailMode } = snapshot;
  const ext = image.ext;
  const isSvg = ext === 'svg';
  const isTxt = ext === 'txt';

  const commonCls = `image ${ext} bg-${image.background}${
    isSingle
      ? `${image.noPreview ? ' no-preview' : ''}${image.noPreview ? ' no-border' : ''}`
      : `${image.noPreview ? ' no-preview' : ''}${snapshot.selectedCount >= 5 ? ' no-animation' : ''}${
          (snapshot.selectedIndexMappings[image.id] ?? 0) % 2 === 0 ? ' odd' : ' even'
        }${image.noPreview ? ' no-border' : ''}`
  }`;

  const defaultCls =
    `${image.width !== undefined && image.width <= 120 ? 'pixelated' : ''} ${
      image.width !== undefined && image.height !== undefined && image.height >= image.width && image.height > 200 ? 'fit-height' : ''
    } ${image.width !== undefined && image.height !== undefined && image.width === image.height ? 'square' : ''}`;

  const imgShow =
    !image.noPreview &&
    (!image.orientation || image.orientation === 1 || image.noThumbnail) &&
    (isDetailMode || (!image.disable && (!image.orientation || image.orientation === 1 || (isSingle && image.noThumbnail))));

  return (
    <div
      className={commonCls.trim()}
      draggable
      onDragEnd={(e) => (window as any).onDragEndContainer(e.nativeEvent)}
      onDragStart={(e) => (window as any).onDragStartContainer(e.nativeEvent)}
      onDrop={(e) => (window as any).onDropInspector(e.nativeEvent)}
      onClick={() => call(scoped(machineryAutoScroll))()}
    >
      {isSvg && <div className="svg" style={{ backgroundImage: `url('${image.lastThumbnailUrl}')` }} />}
      {isTxt && (
        <div className="txt-content">
          <div>
            <h4>{image.name}</h4>
            <p>{image.text}</p>
          </div>
        </div>
      )}
      {!isSvg && !isTxt && (
        <div className={defaultCls.trim().replace(/\s+/g, ' ') || undefined}>
          {image.orientation && image.orientation !== 1 && !image.noThumbnail && (
            <iframe src={image.exifPath} frameBorder={0} sandbox="allow-scripts allow-same-origin" />
          )}
          {imgShow && <ThumbImg image={image} />}
          <div className={`type-label ${ext}`} style={!image.noPreview ? undefined : { display: 'none' }}>
            <span>{ext}</span>
          </div>
          {image.noPreview && <ExtIcon itemId={image.id} />}
        </div>
      )}
    </div>
  );
}

function ThumbImg({ image }: { image: SelectedItemSnapshot }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [currentSrc, setCurrentSrc] = useState(image.lastThumbnailUrl);
  useEffect(() => setCurrentSrc(image.lastThumbnailUrl), [image.lastThumbnailUrl, image.id]);

  // retry-when-thumb-error 指令移植（70224-70248：縮圖 50 次 / 100ms 重試）
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    let retryCount = 50;
    const handler = (window as any)._?.debounce(function () {
      try {
        if (retryCount === 0) return;
        const item = getBodyScope()?.selected?.find?.((s: any) => s?.id === image.id);
        if (!item) return;
        const helper = FileUrlHelper;
        const newPath = helper.getThumbnailUrl(item);
        img.setAttribute('src', newPath);
        retryCount--;
      } catch (err) {}
    }, 100, true);
    img.addEventListener('error', handler);
    return () => img.removeEventListener('error', handler);
  }, [image.id]);

  return <img src={currentSrc} ref={imgRef} />;
}

/* ---------------- info-section 折叠头 ---------------- */

function SectionLabel({
  name,
  expanded,
  onToggle,
  theme,
}: {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  theme: string;
}) {
  return (
    <div className="info-section-label" onClick={onToggle}>
      <div className="name">{name}</div>
      <div className="ic-btn info-section-expand">
        <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
      </div>
    </div>
  );
}

/* ---------------- inspector-tags（模板逐字） ---------------- */

function InspectorTags({ snapshot }: { snapshot: InspectorSnapshot }) {
  const { theme, newTags } = snapshot;
  return (
    <div
      className={`info-section${snapshot.showTags ? ' expand' : ''}`}
      onContextMenu={(e) => {
        tagsInputMouseDown(e.nativeEvent);
        e.stopPropagation();
      }}
    >
      <div
        className="info-section-label"
        onClick={(e) =>
          scopeApply(getBodyScope(), (s) => {
            s.inspector.showTags = !s.inspector.showTags;
            syncInspectorFromScope();
          })
        }
      >
        <div className="name">{t('inspector.includesTagsLabel')}</div>
        <div className="ic-btn info-section-expand">
          <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
        </div>
      </div>
      <div className="info-section-container">
        <div className="label-container" onClick={(e) => { e.stopPropagation(); call(scoped(machineryOpenInspectorTagSelectPanel))(e); }}>
          {newTags.map((tag, i) => (
            <div
              key={i}
              className={`label-item color-${snapshot.tagColor[tag]}`}
              onContextMenu={(e) => {
                tagsInputMouseDown(e.nativeEvent, tag);
                e.stopPropagation();
              }}
            >
              <span className="label-item-name" title={longTitle(tag)}>
                {substring(tag, 0, 200)}
              </span>
              <div
                className="ic-btn label-item-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  scopeApply(getBodyScope(), (s) => s.TagManager.removeTag(tag));
                  e.stopPropagation();
                }}
              >
                <img src={iconSrc(theme, 'ic-inspector-remove-label.svg')} />
              </div>
            </div>
          ))}
          {newTags.length === 0 && (
            <div
              className="ic-btn has-bg create-label-btn full-width"
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('inspector.tagInputPlaceholder')}<key>T</key>`}
              onClick={(e) => {
                e.stopPropagation();
                call(scoped(machineryOpenInspectorTagSelectPanel))(e);
              }}
            >
              <img src={iconSrc(theme, 'ic-inspector-add-label.svg')} />
              <span>{t('inspector.tagInputPlaceholder')}</span>
            </div>
          )}
          {newTags.length > 0 && (
            <div
              className="ic-btn create-label-btn"
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('inspector.tagInputPlaceholder')}<key>T</key>`}
              onClick={(e) => {
                e.stopPropagation();
                call(scoped(machineryOpenInspectorTagSelectPanel))(e);
              }}
            >
              <img src={iconSrc(theme, 'ic-inspector-add-label.svg')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- inspector-folders（模板逐字；单选/多选两块） ---------------- */

function InspectorFolders({ snapshot }: { snapshot: InspectorSnapshot }) {
  const { theme } = snapshot;
  const single = snapshot.selectedCount === 1;
  const multi = snapshot.selectedCount > 1;
  const folderIds = single ? snapshot.selectedFirst?.folders || [] : snapshot.folders;

  const openPanel = (e: any) => call(scoped(machineryOpenInspectorFolderSelectPanel), e)(e);
  const folderRow = (folderId: string, i: number) => (
    <div
      key={i}
      className={`label-item color-${snapshot.folderColor[folderId]}`}
      title={snapshot.folderFullPath[folderId] || ''}
      style={snapshot.folderName[folderId] ? undefined : { display: 'none' }}
      onContextMenu={(e) => {
        e.stopPropagation();
        const live = getBodyScope()?.folderMappings?.[folderId];
        if (live) call('openFolderFullPathContextMenu', e.nativeEvent, live)(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        const live = getBodyScope()?.folderMappings?.[folderId];
        if (live) call(scoped(machineryQuickOpenFolder), live)(e);
      }}
    >
      <span className="label-item-name">{snapshot.folderName[folderId]}</span>
      <div
        className="ic-btn label-item-remove-btn"
        onClick={(e) => {
          e.stopPropagation();
          call(removeFromFolder, e.nativeEvent, folderId)(e);
        }}
      >
        <img src={iconSrc(theme, 'ic-inspector-remove-label.svg')} />
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
      {single && (
        <div className={`info-section${snapshot.showFolders ? ' expand' : ''}`}>
          <div
            className="info-section-label"
            onClick={() =>
              scopeApply(getBodyScope(), (s) => {
                s.inspector.showFolders = !s.inspector.showFolders;
                syncInspectorFromScope();
              })
            }
          >
            <div className="name">{t('inspector.includesFoldersLabel')}</div>
            <div className="ic-btn info-section-expand">
              <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
            </div>
          </div>
          <div className="info-section-container">
            <div className="label-container" onClick={openPanel}>
              {folderIds.map(folderRow)}
              {folderIds.length === 0 && (
                <div
                  className="ic-btn has-bg create-label-btn full-width"
                  tippy=""
                  tippy-placement="bottom"
                  tippy-content={`${t('inspector.includesFoldersBtn')}<key>F</key>`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openPanel(e);
                  }}
                >
                  <img src={iconSrc(theme, 'ic-inspector-add-label.svg')} />
                  <span>{t('inspector.includesFoldersBtn')}</span>
                </div>
              )}
              {folderIds.length > 0 && (
                <div
                  className="ic-btn create-label-btn"
                  tippy=""
                  tippy-placement="bottom"
                  tippy-content={`${t('inspector.includesFoldersBtn')}<key>F</key>`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openPanel(e);
                  }}
                >
                  <img src={iconSrc(theme, 'ic-inspector-add-label.svg')} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {multi && (
        <div className={`info-section${snapshot.showFolders ? ' expand' : ''}`}>
          <div
            className="info-section-label"
            onClick={() =>
              scopeApply(getBodyScope(), (s) => {
                s.inspector.showFolders = !s.inspector.showFolders;
                syncInspectorFromScope();
              })
            }
          >
            <div className="name">{t('inspector.includesFoldersLabel')}</div>
            <div className="ic-btn info-section-expand">
              <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
            </div>
          </div>
          <div className="info-section-container">
            <div className="label-container">
              {folderIds.map(folderRow)}
              {folderIds.length === 0 && (
                <div
                  className="ic-btn has-bg create-label-btn full-width"
                  tippy=""
                  tippy-placement="bottom"
                  tippy-content={`${t('inspector.includesFoldersBtn')}<key>F</key>`}
                  onClick={openPanel}
                >
                  <img src={iconSrc(theme, 'ic-inspector-add-label.svg')} />
                  <span>{t('inspector.includesFoldersBtn')}</span>
                </div>
              )}
              {folderIds.length > 0 && (
                <div
                  className="ic-btn create-label-btn"
                  tippy=""
                  tippy-placement="bottom"
                  tippy-content={`${t('inspector.includesFoldersBtn')}<key>F</key>`}
                  onClick={openPanel}
                >
                  <img src={iconSrc(theme, 'ic-inspector-add-label.svg')} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- inspector-annotations（模板逐字 + comment-video） ---------------- */

function AnnotationComment({
  snapshot,
  comment,
  index,
}: {
  snapshot: InspectorSnapshot;
  comment: any;
  index: number;
}) {
  const { theme } = snapshot;
  const videoRef = useRef<HTMLVideoElement>(null);
  useCommentVideo(videoRef, comment);
  const image = snapshot.selectedFirst;
  if (!image) return null;

  if (!comment.duration) {
    // 圖片標註
    const bgStyle =
      comment.width > comment.height
        ? { zoom: 36 / comment.width, aspectRatio: `${comment.width}/${comment.height}`, width: comment.width, height: comment.height }
        : { zoom: 36 / comment.height, aspectRatio: `${comment.width}/${comment.height}`, width: comment.width, height: comment.height };
    const style: React.CSSProperties = {
      ...(bgStyle as any),
      backgroundSize: `${image.width}px`,
      backgroundPosition: `${-comment.x}px ${-comment.y}px`,
      backgroundImage: `url('${image.thumbnailUrl}')`,
    };
    return (
      <div className="comment image">
        <div className="preview-image">
          <div style={style} />
        </div>
        {comment.annotation && (
          <div
            className="annotation"
            onClick={(e) => openComment(e.nativeEvent, image, comment)}
            onContextMenu={(e) => copyComment(e.nativeEvent, image, comment)}
            onMouseOver={(e) => highlightAnnotation(e.nativeEvent, comment)}
            onMouseLeave={(e) => removeHighlightAnnotation(e.nativeEvent, comment)}
            dangerouslySetInnerHTML={{ __html: comment.annotation }}
          />
        )}
        {!comment.annotation && (
          <div
            className="annotation"
            onClick={(e) => openComment(e.nativeEvent, image, comment)}
            onMouseOver={(e) => highlightAnnotation(e.nativeEvent, comment)}
            onMouseLeave={(e) => removeHighlightAnnotation(e.nativeEvent, comment)}
          >
            {t('inspector.untitledAnnotation')}
          </div>
        )}
        <div className="remove" onClick={() => {
          const live = getBodyScope()?.selected?.[0];
          if (live) removeImageComment(live, index);
        }}>
          <img src={iconSrc(theme, 'ic-inspector-comment-remove.svg')} />
        </div>
      </div>
    );
  }

  // 視頻標註
  return (
    <div
      className="comment video"
      onClick={(e) => openVideoComment(e.nativeEvent, image, comment)}
      onContextMenu={(e) => editVideoComment(e.nativeEvent, image, comment)}
    >
      <video className="preview-video" comment-video="" duration={comment.duration} ref={videoRef}>
        <source type="video/mp4" />
      </video>
      <div className="duration">{duration(comment.duration)}</div>
      <div className="separator" />
      {comment.annotation && <div className="annotation" dangerouslySetInnerHTML={{ __html: comment.annotation }} />}
      <div
        className="remove"
        onClick={(e) => {
          const live = getBodyScope()?.selected?.[0];
          if (live) removeVideoComment(e.nativeEvent, live, comment);
        }}
      >
        <img src={iconSrc(theme, 'ic-inspector-comment-remove.svg')} />
      </div>
      <div
        className="ic-btn edit"
        onClick={(e) => {
          const live = getBodyScope()?.selected?.[0];
          if (live) editVideoComment(e.nativeEvent, live, comment);
        }}
      >
        <img src={iconSrc(theme, 'ic-inspector-comment-edit.svg')} />
      </div>
    </div>
  );
}

function InspectorAnnotations({ snapshot }: { snapshot: InspectorSnapshot }) {
  const { theme } = snapshot;
  const comments = snapshot.selectedFirst?.comments || [];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ui-sortable（imageCommentsSortableOptions）：拖拽结束按 DOM 顺序回写 selected[0].comments
    const el = containerRef.current;
    if (!el) return;
    // D-2f：jQuery-UI sortable → 自研
    const sortable = makeSortable(el, {
      distance: 5,
      tolerance: 'pointer',
      disabled: false,
      helper: 'clone',
      update: () => {
        scopeApply(getBodyScope(), (s) => {
          const item = s.selected?.[0];
          if (!item) return;
          const order = sortableToArray(el, 'data-comment-index').map(Number);
          item.comments = order.map((i: number) => item.comments[i]).filter(Boolean);
          (window as any).ayncsImagesChange([item]);
          try {
            (window as any).electronLog && (window as any).electronLog.info(`[app] Sort item's annotations: ${item.id}`);
          } catch (err) {}
        });
      },
    });
    return () => {
      sortable.destroy();
    };
  }, [comments.length]);

  return (
    <div
      className={`info-section${snapshot.showComments ? ' expand' : ''}`}
      style={{ overflow: 'initial' }}
      // ng-if="selected.length == 1" 已由容器渲染条件保证
    >
      <div
        className="info-section-label"
        onClick={() =>
          scopeApply(getBodyScope(), (s) => {
            s.inspector.showComments = !s.inspector.showComments;
            syncInspectorFromScope();
          })
        }
      >
        <div className="name">{t('inspector.annotationLabel')}</div>
        <div className="ic-btn info-section-expand">
          <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
        </div>
      </div>
      <div className="info-section-container">
        <div className="comments" ref={containerRef}>
          {comments.map((comment: any, i: number) => (
            <div key={i} data-comment-index={i} style={{ display: 'contents' }}>
              <AnnotationComment snapshot={snapshot} comment={comment} index={i} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- inspector-information（模板逐字） ---------------- */

function InspectorInformation({ snapshot }: { snapshot: InspectorSnapshot }) {
  const { theme } = snapshot;
  const single = snapshot.selectedCount === 1;
  const multi = snapshot.selectedCount > 1 && snapshot.size;
  const item = snapshot.selectedFirst;

  if (!single && !multi) return null;

  const changeStar = (star: number) => (e: any) => call(scoped(machineryChangeStar), star)(e);
  const resHide =
    single && item && (!item.width || item.ext === 'txt' || (window as any).FONT_TYPES?.[item.ext] || (window as any).AUDIO_TYPES?.[item.ext]);
  const resShow = single && item && !((window as any).VIDEO_TYPES?.[item.ext] || !item.width || item.ext === 'txt' || (window as any).FONT_TYPES?.[item.ext] || (window as any).AUDIO_TYPES?.[item.ext]);
  const videoResShow =
    single && item && (window as any).VIDEO_TYPES?.[item.ext] && (item.resolutionWidth || item.width);

  return (
    <div style={{ width: '100%' }}>
      {single && (
        <div className={`info-section${snapshot.showProperties ? ' expand' : ''}`}>
          <div
            className="info-section-label"
            onClick={() =>
              scopeApply(getBodyScope(), (s) => {
                s.inspector.showProperties = !s.inspector.showProperties;
                syncInspectorFromScope();
              })
            }
          >
            <div className="name">{t('inspector.infoLabel')}</div>
            <div className="ic-btn info-section-expand">
              <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
            </div>
          </div>
          <div className="info-section-container">
            <div className="prop">
              <div className="keys">
                <div className="key">{t('inspector.props.rating')}</div>
                <div className="key" style={resHide ? { display: 'none' } : undefined}>
                  {t('inspector.props.resolution')}
                </div>
                <div className="key" style={item?.duration ? undefined : { display: 'none' }}>
                  {t('inspector.props.duration')}
                </div>
                <div className="key" style={item?.bpm ? undefined : { display: 'none' }}>BPM</div>
                <div className="key">{t('inspector.props.fileSize')}</div>
                <div className="key">{t('inspector.props.fileType')}</div>
                <div className="key" style={item?.rawMetas ? undefined : { display: 'none' }}>{t('inspector.props.camera')}</div>
                <div className="key" style={item?.rawMetas ? undefined : { display: 'none' }}>{t('inspector.props.focalLength')}</div>
                <div className="key" style={item?.rawMetas ? undefined : { display: 'none' }}>{t('inspector.props.isoSpeed')}</div>
                <div className="key" style={item?.rawMetas ? undefined : { display: 'none' }}>{t('inspector.props.aperture')}</div>
                <div className="key" style={item?.rawMetas ? undefined : { display: 'none' }}>{t('inspector.props.shutter')}</div>
                <div className="key" style={item?.rawMetas ? undefined : { display: 'none' }}>{t('inspector.props.timestamp')}</div>
                <div className="key">{t('inspector.props.createAt')}</div>
                <div className="key">{t('inspector.props.btime')}</div>
                <div className="key">{t('inspector.props.mtime')}</div>
              </div>
              <div className="values">
                <div className="value">
                  <div className={`rating-container star-${item?.star ?? 0}`}>
                    <div onClick={changeStar(1)} />
                    <div onClick={changeStar(2)} />
                    <div onClick={changeStar(3)} />
                    <div onClick={changeStar(4)} />
                    <div onClick={changeStar(5)} />
                  </div>
                </div>
                <div className="value" style={videoResShow ? undefined : { display: 'none' }}>
                  {item?.resolutionWidth || item?.width} × {item?.resolutionHeight || item?.height}
                </div>
                <div className="value" style={resShow ? undefined : { display: 'none' }}>
                  {item?.width} × {item?.height}
                </div>
                <div className="value" style={item?.duration ? undefined : { display: 'none' }}>
                  {duration(item?.duration)}
                </div>
                <div className="value" style={item?.bpm ? undefined : { display: 'none' }}>{item?.bpm}</div>
                <div className="value">{filesize(item?.size || 0)}</div>
                <div
                  className="value extension-value"
                  style={{ cursor: 'pointer' }}
                  tippy=""
                  tippy-content={t('inspector.clickToChangeExtension')}
                  tippy-placement="left"
                  onClick={call('changeExtension')}
                >
                  {String(item?.ext || '').toUpperCase()}
                </div>
                <div className="value" style={item?.rawMetas ? undefined : { display: 'none' }}>{item?.rawMetas?.camera}</div>
                <div className="value" style={item?.rawMetas ? undefined : { display: 'none' }}>{item?.rawMetas?.focalLength}</div>
                <div className="value" style={item?.rawMetas ? undefined : { display: 'none' }}>{item?.rawMetas?.isoSpeed}</div>
                <div className="value" style={item?.rawMetas ? undefined : { display: 'none' }}>{item?.rawMetas?.aperture}</div>
                <div className="value" style={item?.rawMetas ? undefined : { display: 'none' }}>{item?.rawMetas?.shutter}</div>
                <div className="value" style={item?.rawMetas ? undefined : { display: 'none' }}>{angDate(item?.rawMetas?.timestamp, 'yyyy/MM/dd HH:mm')}</div>
                <div className="value">{angDate(item?.modificationTime, 'yyyy/MM/dd HH:mm')}</div>
                <div className="value">{angDate(item?.btime || item?.modificationTime, 'yyyy/MM/dd HH:mm')}</div>
                <div className="value">{angDate(item?.mtime || item?.modificationTime, 'yyyy/MM/dd HH:mm')}</div>
              </div>
            </div>

            <div className="export-container">
              <div className="ic-btn export-btn has-bg" onClick={call('openImageExportContextMenu')}>
                <img src={iconSrc(theme, 'ic-inspector-export.svg')} />
                {t('context.image.export')}
              </div>
            </div>
          </div>
        </div>
      )}

      {multi && (
        <div className={`info-section${snapshot.showProperties ? ' expand' : ''}`}>
          <div
            className="info-section-label"
            onClick={() =>
              scopeApply(getBodyScope(), (s) => {
                s.inspector.showProperties = !s.inspector.showProperties;
                syncInspectorFromScope();
              })
            }
          >
            <div className="name">{t('inspector.infoLabel')}</div>
            <div className="ic-btn info-section-expand">
              <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
            </div>
          </div>
          <div className="info-section-container">
            <div className="prop">
              <div className="keys">
                <div className="key">{t('inspector.props.rating')}</div>
                <div className="key" style={snapshot.size > 0 ? undefined : { display: 'none' }}>
                  {t('inspector.props.fileSize')}
                </div>
              </div>
              <div className="values">
                <div className="value">
                  <div className={`rating-container star-${snapshot.star}`}>
                    <div onClick={changeStar(1)} />
                    <div onClick={changeStar(2)} />
                    <div onClick={changeStar(3)} />
                    <div onClick={changeStar(4)} />
                    <div onClick={changeStar(5)} />
                  </div>
                </div>
                <div
                  className="value"
                  style={snapshot.size > 0 && snapshot.size / 1024 < 1 ? undefined : { display: 'none' }}
                >
                  {filesize(snapshot.size)}
                </div>
                <div
                  className="value"
                  style={snapshot.size > 0 && snapshot.size / 1024 >= 1 ? undefined : { display: 'none' }}
                >
                  {filesize(snapshot.size)}
                </div>
              </div>
            </div>
            <div className="export-container">
              <div className="ic-btn export-btn has-bg" onClick={call('openImageExportContextMenu')}>
                <img src={iconSrc(theme, 'ic-inspector-export.svg')} />
                {t('context.image.export')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- inspector-plugin（模板逐字） ---------------- */

function InspectorPlugin({ snapshot, item }: { snapshot: InspectorSnapshot; item: any }) {
  const { theme } = snapshot;
  const visible = item.visible;
  const pluginId = item.plugin?.id;
  const [, bumpVersion] = React.useReducer((x: number) => x + 1, 0);

  // 原 hidePluginMap（link scope，init 於 localStorage + togglePlugin 同步寫回）
  const readHiddenMap = (): Record<string, boolean> => {
    try {
      return JSON.parse(localStorage['eagle.inspector.hidePluginMap'] || '{}');
    } catch (err) {
      return {};
    }
  };
  const hiddenMap = readHiddenMap();

  return (
    <div style={{ width: '100%', ...(visible ? undefined : { display: 'none' }) }}>
      {visible && (
        <div className="inspector-plugin-section">
          <div className={`info-section${!hiddenMap[pluginId] ? ' expand' : ''}`}>
            <div
              className="info-section-label"
              onClick={() => {
                // 原 togglePlugin（bundle:54355-54364）
                const map = readHiddenMap();
                if (!map[pluginId]) map[pluginId] = true;
                else delete map[pluginId];
                localStorage['eagle.inspector.hidePluginMap'] = JSON.stringify(map);
                bumpVersion();
              }}
            >
              <div className="name">{item.plugin?.name}</div>
              <div className="ic-btn info-section-expand">
                <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
              </div>
            </div>
            <div className="info-section-container">
              <InspectorPluginView snapshot={snapshot} plugin={item.plugin} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- inspector-plugin-view 指令（17720-17873） ---------------- */

function InspectorPluginView({ snapshot, plugin }: { snapshot: InspectorSnapshot; plugin: any }) {
  const hostRef = useRef<HTMLElement>(null);
  const firstItemId = snapshot.selectedFirst?.id;
  const stateRef = useRef<{ heightInterval: any; lastPluginHeight: number; lastItem?: string }>({
    heightInterval: 0,
    lastPluginHeight: 0,
  });

  useEffect(() => {
    const element = hostRef.current;
    if (!element || !plugin || !firstItemId) return;
    const st = stateRef.current;

    function init() {
      const item = getBodyScope()?.selected?.[0];
      if (!item) return;

      const webviewId = `inspector-plugin-${plugin?.manifest?.id}`;
      const $webview = $()(`#${webviewId}`);
      const src = getBodyScope()?.pluginModule?.previewExtension?.getInspectorPluginURL(plugin, item);
      const hasInspectorPlugin = getBodyScope()?.pluginModule?.previewExtension?.hasInspectorPlugin(item);
      if (!hasInspectorPlugin) return;

      if ($webview.length) {
        $webview.attr('src', src);
        return;
      }

      const height =
        Object.keys(plugin?.manifest?.preview || {}).reduce((acc: number, key: string) => {
          if (key.includes(item.ext)) {
            return plugin?.manifest?.preview?.[key]?.inspector?.height || 32;
          }
          return acc;
        }, 100) || 32;
      const preloadPath = req('url')
        .pathToFileURL(req('path').join((window as any).appRoot.path, '/app/js/plugin/api-format-extension.js'))
        .href;

      (element as HTMLElement).innerHTML = `<webview id="${webviewId}" style="height: ${height}px;" src="${src}" preload="${preloadPath}" allowpopups nodeintegration webpreferences="contextIsolation=false"></webview>`;
      const webview = (element as HTMLElement).querySelector('webview') as any;
      if (!webview) return;

      webview.addEventListener('did-fail-load', (e: any) => console.log(e));
      webview.addEventListener('crash', (e: any) => console.log(e));
      webview.addEventListener('will-navigate', (e: any) => {
        console.log(e.url);
        if (e.url && e.url !== webview.src) {
        } else {
          e.preventDefault();
          e.stopPropagation();
          webview.stop();
          webview.reload();
        }
      });

      webview.addEventListener('dom-ready', () => {
        try {
          const remote = req('@electron/remote');
          const app = remote?.app;
          const pjson = req((window as any).appRoot.path + '/package.json');
          const preferences = (window as any).preferences;
          const s = getBodyScope();
          const script = `
                            window.parentID = ${remote?.getCurrentWindow?.()?.webContents?.id};
                            window.windowID = ${webview.getWebContentsId()};
                            window.eagle.app.theme = '${preferences?.theme?.name}';
                            window.eagle.app.version = '${pjson?.version}';
                            window.eagle.app.build = ${pjson?.buildNumber};
                            window.eagle.app.locale = '${preferences?.general?.language}';
                            window.eagle.app.runningUnderARM64Translation = ${app?.runningUnderARM64Translation};
                            window.eagle.library.path = '${String(s?.libraryPath || '').replace(/\\/gm, '/').replace(/'/g, "\\'")}';
                            window.eagle.library.path = require('path').normalize(window.eagle.library.path);
                            window.eagle.plugin = {};

                            window.eagle.plugin.path = '${String(plugin?.path || '').replace(/\\/gm, '/').replace(/'/g, "\\'")}';
                            window.eagle.plugin.path = require('path').normalize(window.eagle.plugin.path);

                            window.eagle.library.path = '${String(s?.libraryPath || '').replace(/\\/gm, '/').replace(/'/g, "\\'")}';
                            window.eagle.library.path = require('path').normalize(window.eagle.library.path);
                            window.eagle.app.userDataPath = '${String(app?.getPath('userData') || '').replace(/\\/gm, '/').replace(/'/g, "\\'")}';
                            
                            try {
                                global.__dirname = eagle.plugin.path;
                                eagle.isDev = !eagle.plugin.path.includes('Eagle/Plugins') && !eagle.plugin.path.includes('Eagle\\\\Plugins');
                            } catch (err) {
                                console.log(err);
                            }
                        `;
          webview.executeJavaScript(script);
        } catch (err) {}
        setTimeout(() => {
          try {
            webview.send('plugin-create', plugin);
            webview.send('plugin-run');
          } catch (err) {}
        }, 100);

        clearInterval(st.heightInterval);
        st.heightInterval = setInterval(() => {
          try {
            const hiddenMap = JSON.parse(localStorage['eagle.inspector.hidePluginMap'] || '{}');
            if (hiddenMap[plugin.id]) {
              $(webview).height(height);
              return;
            }
            webview.executeJavaScript(`document.body.scrollHeight;`).then((h: number) => {
              if (st.lastPluginHeight === h) return;
              st.lastPluginHeight = h;
              $(webview).height(h);
            });
          } catch (err) {}
        }, 100);
      });
    }

    if (st.lastItem !== firstItemId) {
      init();
    }
    st.lastItem = firstItemId;

    return () => {
      clearInterval(st.heightInterval);
    };
  }, [firstItemId, plugin?.manifest?.id]);

  return <inspector-plugin-view id="plugin-viewer" ref={hostRef as any} />;
}

void angDate;

/* ---------------- 主组件：.inspector（inspector.html 逐字） ---------------- */

function Inspector({ snapshot }: { snapshot: InspectorSnapshot }) {
  const { theme } = snapshot;
  const toolbarSnapshot = useToolbarState((s: any) => s.snapshot);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, JSON.stringify([snapshot.theme, snapshot.newUrl, snapshot.trialRemain, snapshot.items.map((i) => i.id).join(',')]));
  useSelectAllItems(itemsRef, snapshot);

  // resizable="w" 指令（bundle:70423-70440，maxWidth 600 / minWidth 200）——D-2f：自研 makeResizable
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = makeResizable(el, {
      maxWidth: 600,
      minWidth: 200,
      handles: 'w',
      resize: (event: any, ui: any) => {
        onInspectorResize(event, ui);
        getBodyScope()?.$evalAsync?.();
      },
    });
    return () => {
      r.destroy();
    };
  }, []);

  // inspector.inspectorItems ui-sortable：拖拽结束按 DOM 顺序回写模型
  useEffect(() => {
    const el = itemsRef.current;
    if (!el) return;
    // D-2f：jQuery-UI sortable → 自研
    const sortable = makeSortable(el, {
      update: () => {
        scopeApply(getBodyScope(), (s) => {
          const order = sortableToArray(el, 'data-item-id');
          const items = s.inspector.inspectorItems || [];
          s.inspector.inspectorItems = order.map((id: string) => items.find((i: any) => String(i.id) === id)).filter(Boolean);
          syncInspectorFromScope();
        });
      },
    });
    return () => {
      sortable.destroy();
    };
  }, [snapshot.items.length]);

  const ins = getBodyScope()?.inspector || {};
  const categoryNameEditable = snapshot.category?.editable;

  const writeCategoryName = (html: string) => {
    scopeApply(getBodyScope(), (s) => {
      s.inspector.category.newName = html;
    });
    inspectorCategoryNameChange();
  };
  const writeCategoryDescription = (html: string) => {
    scopeApply(getBodyScope(), (s) => {
      s.inspector.category.newDescription = html;
    });
    inspectorCategoryDescriptionChange();
  };
  const writeName = (html: string) => {
    scopeApply(getBodyScope(), (s) => {
      s.inspector.newName = html;
      syncInspectorFromScope();
    });
    inspectorNameChange();
  };
  const writeAnnotation = (html: string) => {
    scopeApply(getBodyScope(), (s) => {
      s.inspector.newAnnotation = html;
      syncInspectorFromScope();
    });
    annotationChange();
  };
  const [urlDebounce] = useState<any>({ id: 0 });
  const writeUrl = (html: string) => {
    scopeApply(getBodyScope(), (s) => {
      s.inspector.newUrl = html;
      syncInspectorFromScope();
    });
    // ng-model-options debounce 200
    clearTimeout(urlDebounce.id);
    urlDebounce.id = setTimeout(() => {
      urlChange();
    }, 200) as unknown as number;
  };

  const showSidebar = snapshot.activeTab === 'SIDEBAR';
  const showItem = snapshot.selectedCount > 0 && snapshot.activeTab === 'ITEM';
  const item = snapshot.selectedFirst;
  const paletteShow =
    snapshot.selectedCount === 1 &&
    item &&
    !item.processingPalette &&
    !(item.noPreview || item.ext === 'txt' || (window as any).FONT_TYPES?.[item.ext] || (window as any).AUDIO_TYPES?.[item.ext] || (item.palettes?.length || 0) <= 1);
  const palettes = paletteShow && item ? (sortHSL(item.palettes || []) || []).slice(0, 10) : [];

  return (
    <div
      className="inspector"
      style={{ width: snapshot.width, ...(snapshot.viewMode === 'alltags' ? { display: 'none' } : undefined) }}
      ref={rootRef}
    >
      {/* 右上角按鈕 */}
      <div className="inspector-header">
        <CornerBtns
          snapshot={{
            ...(toolbarSnapshot as any),
            theme,
            isAlwaysOnTop: toolbarSnapshot.isAlwaysOnTop,
            isMaximize: toolbarSnapshot.isMaximize,
            platform: toolbarSnapshot.platform,
          }}
        />
      </div>

      {/* 資料夾信息 */}
      <div className="inspector-content" style={!showSidebar ? { display: 'none' } : undefined}>
        {/* 資料夾名、描述 */}
        <form className="properties-form" name="properties-form">
          <ContentEditable
            value={snapshot.category?.newName || ''}
            onChange={writeCategoryName}
            placeholder={t('inspector.selection>title')}
            noLineBreaks
            selectall
            className={categoryNameEditable ? undefined : 'disable'}
            style={{ marginBottom: 8 }}
            tabIndex={0}
            onKeyDown={(e) => preventEnter(e.nativeEvent)}
          />
          <ContentEditable
            value={snapshot.category?.newDescription || ''}
            onChange={writeCategoryDescription}
            placeholder={t('inspector.selection>description')}
            noLineBreaks
            selectall
            allowLink
            className={`annotation${categoryNameEditable ? '' : ' disable'}`}
            style={{ marginBottom: 8, ...(categoryNameEditable ? undefined : { display: 'none' }) }}
            tabIndex={0}
          />
        </form>
        {/* 資料夾屬性 */}
        <div className={`info-section${snapshot.showProperties ? ' expand' : ''}`}>
          <div
            className="info-section-label"
            onClick={() =>
              scopeApply(getBodyScope(), (s) => {
                s.inspector.showProperties = !s.inspector.showProperties;
                syncInspectorFromScope();
              })
            }
          >
            <div className="name">{t('inspector.infoLabel')}</div>
            <div className="ic-btn info-section-expand">
              <img src={iconSrc(theme, 'ic-inspector-expand.svg')} />
            </div>
          </div>
          <div className="info-section-container">
            <div className="prop">
              <div className="keys">
                <div className="key" style={passwordLocked(snapshot) ? { display: 'none' } : undefined}>
                  {t('inspector.props.count')}
                </div>
                <div className="key" style={passwordLocked(snapshot) ? { display: 'none' } : undefined}>
                  {t('inspector.props.folderSize')}
                </div>
                <div className="key" style={snapshot.category?.createDate ? undefined : { display: 'none' }}>
                  {t('inspector.props.createAt')}
                </div>
                <div className="key" style={snapshot.inspectorFolder ? undefined : { display: 'none' }}>
                  {t('context.folder.password')}
                </div>
              </div>
              <div className="values">
                <div className="value" style={passwordLocked(snapshot) ? { display: 'none' } : undefined}>
                  {numFilter(snapshot.category?.imageCount, 0)}
                </div>
                <div className="value" style={passwordLocked(snapshot) ? { display: 'none' } : undefined}>
                  {filesize(snapshot.category?.fileSize ?? 0)}
                </div>
                <div className="value" style={snapshot.category?.createDate ? undefined : { display: 'none' }}>
                  {angDate(snapshot.category?.createDate, 'yyyy/MM/dd h:mm')}
                </div>
                <div className="value" style={snapshot.inspectorFolder ? undefined : { display: 'none' }}>
                  {!snapshot.inspectorFolder?.password && (
                    <div className="value">
                      <span className="clickable" onClick={() => setFolderPassword(liveInspectorFolder())}>
                        {t('context.folder.password>create')}
                      </span>
                    </div>
                  )}
                  {snapshot.inspectorFolder?.password && snapshot.selectedFolderCount === 0 && (
                    <div className="value">
                      <span className="clickable" onClick={() => changeFolderPassword(liveInspectorFolder())}>
                        {t('context.folder.password>change')}
                      </span>
                      {' | '}
                      <span className="clickable" onClick={() => resetFolderPassword(liveInspectorFolder())}>
                        {t('context.folder.password>reset')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="export-container" style={snapshot.category?.exportable && (snapshot.category?.imageCount ?? 0) > 0 ? undefined : { display: 'none' }}>
              {snapshot.selectedFoldersFirstId === '' && snapshot.category?.exportable && (
                <span>
                  {ins.currentFolder ? (
                    <div
                      className="ic-btn export-btn has-bg"
                      onClick={(e) => call('openFolderExportContextMenu', e.nativeEvent, liveInspectorFolder())(e)}
                    >
                      <img src={iconSrc(theme, 'ic-inspector-export.svg')} />
                      {t('inspector.selection>export')}
                    </div>
                  ) : null}
                  {getBodyScope()?.currentSmartFolder ? (
                    <div
                      className="ic-btn export-btn has-bg"
                      onClick={(e) => call('openSmartFolderExportContextMenu', e.nativeEvent, getBodyScope().currentSmartFolder)(e)}
                    >
                      <img src={iconSrc(theme, 'ic-inspector-export.svg')} />
                      {t('inspector.selection>export')}
                    </div>
                  ) : null}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 檔案信息 */}
      <div className="inspector-content" style={!showItem ? { display: 'none' } : undefined}>
        {/* 縮略圖預覽 */}
        <div className="selected-preview">
          {snapshot.selectedCount !== 1 &&
            snapshot.selectedWindow.map((image) => <PreviewImage key={image.id} snapshot={snapshot} image={image} isSingle={false} />)}
          {snapshot.selectedCount === 1 && item && <PreviewImage snapshot={snapshot} image={item} isSingle />}
        </div>

        {/* 色票 */}
        {paletteShow && (
          <div className="palette">
            {palettes.map((palette: any, i: number) => (
              <div
                key={i}
                className="color-wrap"
                tippy=""
                tippy-placement="top"
                tippy-content={`${rgbToHex(palette.color[0], palette.color[1], palette.color[2])} (${numFilter(palette.ratio, 1)}%)`}
                onClick={(e) => call('openColorContextMenu', palette)(e)}
                onContextMenu={(e) => {
                  scopeApply(getBodyScope(), (s) => {
                    const hex = rgbToHex(palette.color[0], palette.color[1], palette.color[2]);
                    if (typeof hex === 'string') s.$body?.hexColor !== undefined && (s.$body.hexColor = hex);
                    s.hexColor = hex;
                    filterWithColor(palette.color);
                  });
                }}
              >
                <div
                  className="color"
                  style={{ backgroundColor: `rgba(${palette.color[0]}, ${palette.color[1]}, ${palette.color[2]}, 1)` }}
                />
              </div>
            ))}
          </div>
        )}

        {/* 已選取 N 個 */}
        {snapshot.selectedCount > 1 && (
          <div className={`selected-count${snapshot.selectedCount >= 100 ? ' warning' : ''}`}>
            <div className="icon">
              <img src={iconSrc(theme, 'ic-inspector-warning.png')} />
            </div>
            {t('inspector.itemSelected1')} <span className="count">{snapshot.selectedCount}</span> {t('inspector.itemSelected2')}
          </div>
        )}

        {/* 屬性：標籤、文件夾、標注、基本信息 */}
        <form className="properties-form" name="properties-form">
          {/* 文件名 */}
          <ContentEditable
            id="inspector-name"
            value={snapshot.newName}
            onChange={writeName}
            placeholder={snapshot.newNamePlaceholder}
            noLineBreaks
            selectall
            style={snapshot.selectedCount > 1 ? { display: 'none' } : undefined}
            tabIndex={0}
            onKeyDown={(e) => preventEnter(e.nativeEvent)}
          />
          {/* 註釋 */}
          <ContentEditable
            className="annotation"
            value={snapshot.newAnnotation}
            onChange={writeAnnotation}
            placeholder={t('inspector.notePlaceholder')}
            allowLink
            selectall
            tabIndex={0}
          />
          {/* 連結 */}
          <div
            className="link-input"
            title={snapshot.newUrl}
            onDragEnter={(e) => (window as any).onDragEnterLinkInput(e.nativeEvent)}
            onDragLeave={(e) => (window as any).onDragLeaveLinkInput(e.nativeEvent)}
            onDrop={(e) => (window as any).onDropLinkInput(e.nativeEvent)}
          >
            <input
              tabIndex={0}
              type="text"
              name="url"
              maxLength={4096}
              onFocus={(e) => selectLinkInput(e.nativeEvent)}
              placeholder={snapshot.newUrlPlaceholder}
              value={snapshot.newUrl}
              onChange={(e) => writeUrl(e.target.value)}
              onKeyDown={(e) => preventEnter(e.nativeEvent)}
              onKeyUp={(e) => newUrlKeyup(e.nativeEvent)}
            />
            <div
              className="open-link ic-btn"
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('inspector.openUrlBtn')}${shortcuts('<key>⌘</key><key>Shift</key><key>O</key>')}`}
              style={!snapshot.newUrl ? { display: 'none' } : undefined}
              onClick={call('openLink')}
            >
              <img src={iconSrc(theme, 'ic-inspector-open-link.svg')} />
            </div>
          </div>
        </form>
        <div style={{ width: '100%' }} ref={itemsRef}>
          {snapshot.items.map((inspectorItem) => (
            <div key={inspectorItem.id} style={{ width: '100%' }} data-item-id={inspectorItem.id}>
              {inspectorItem.type === 'tags' && <InspectorTags snapshot={snapshot} />}
              {inspectorItem.type === 'folders' && <InspectorFolders snapshot={snapshot} />}
              {inspectorItem.type === 'annotations' && snapshot.selectedCount === 1 && snapshot.selectedFirst && (snapshot.selectedFirst.comments?.length ?? 0) > 0 && (
                <InspectorAnnotations snapshot={snapshot} />
              )}
              {inspectorItem.type === 'annotations' && !(snapshot.selectedCount === 1 && (snapshot.selectedFirst?.comments?.length ?? 0) > 0) && null}
              {inspectorItem.type === 'information' && <InspectorInformation snapshot={snapshot} />}
              {inspectorItem.type === 'plugin' && <InspectorPlugin snapshot={snapshot} item={inspectorItem} />}
            </div>
          ))}
        </div>
      </div>

      {/* 底部幫助按鈕、試用到期提示 */}
      <div className="help-area">
        {snapshot.trialRemain > 0 && snapshot.trialRemain <= 31 && (
          <div className="trial-remain" onClick={() => call('openTrialModal', snapshot.trialRemain)()}>
            {t('titlebar.remian')} {snapshot.trialRemain} {t('titlebar.day')}
          </div>
        )}
        <div className="help-btn" onClick={(e) => openHelpContextMenu()}>
          <img src={iconSrc(theme, 'ic-help-btn.svg')} />
        </div>
      </div>
    </div>
  );
}

/** 原 template 的 ng-hide 條件：inspectorFolder 密碼存在且未解鎖。 */
function passwordLocked(snapshot: InspectorSnapshot): boolean {
  const f = snapshot.inspectorFolder;
  return !!(f && f.password && !f.isUnLock);
}

function liveInspectorFolder() {
  return (getBodyScope() as any)?.inspector?.inspectorFolder || (getBodyScope() as any)?.inspectorFolder;
}

/** annotations 的 info-section 有 ng-if="selected.length == 1" 且 ng-show comments>0；
 *  tags/folders/information/plugin 由模板內部條件控制，此處僅提供 ref 容器。 */
function useSelectAllItems(_ref: React.RefObject<HTMLDivElement | null>, _snapshot: InspectorSnapshot) {}

/* ---------------- portal 挂载 + 事件绑定 ---------------- */

export function InspectorPanel() {
  const { snapshot } = useInspectorState();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-inspector-host'));
  }, []);

  // link 中的事件订阅（UPDATE_INSPECTOR / INSPECTOR_SAVE_CHANGES / PLUGIN_UNINSTALL / ipc / mouseup / selected watch）
  useEffect(() => bindInspectorEvents(), []);

  // 初始派生（$watchCollection 首帧）
  useEffect(() => {
    updateSelection();
  }, []);

  if (!host) return null;
  return createPortal(<Inspector snapshot={snapshot} />, host);
}
