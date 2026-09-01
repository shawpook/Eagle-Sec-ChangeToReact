import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useListState } from '../../store/listState';
import { useBodyState } from '../../store/bodyState';
import { t } from '../../global/eagleGlobals';
import { getBodyScope } from '../../global/scopeBridge';

/**
 * 11-pre a4/a5/a6/a9：文件列表区域模板接管（index.html 原块逐字）。
 * - DropAreas：六种空状态（132-215）；
 * - ScrollToTop：ng-hide → display（111；show class 由 scroll-to-top-sentinel 指令与
 *   bundle click 处理器继续管理——元素保留原 id）；
 * - SubFolderSection：子文件夹列表（216-261；ui-sortable 经 scope.subFolderSortableOptions
 *   原对象初始化，update 回调走 bundle 原逻辑）；
 * - ListLayoutHeader：ListLayout 列头（263-292）；
 * - PanelDropArea：面板拖放浮层（297-308；on* 绑定 → React 原生事件调同名 scope 函数）；
 * - BoxContainerListeners：#box-container 的 on* / ng-right-click 移除后由原生监听补位
 *   （auto-scroll/rect-select/scrollToTopSentinel/boxContainerScrollbar 指令保持 Angular
 *   编译至 b 系列移植）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

function useHost(id: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById(id));
  }, [id]);
  return host;
}

/** scope 函数调用（e 为原生事件或合成事件，取 nativeEvent 最接近原 $event 语义）。 */
function scopeFn(fn: string, ...args: any[]) {
  return (e?: any) => {
    const scope = getBodyScope();
    if (!scope || typeof scope[fn] !== 'function') return;
    const ev = e && e.nativeEvent ? e.nativeEvent : e;
    scope[fn](...(args.length ? args : [ev]));
  };
}

/** 六种空状态（index.html 132-215 逐字；ng-if → 条件渲染，ng-show/ng-hide → display）。 */
export function DropAreas() {
  const host = useHost('eagle-drop-areas-host');
  const l = useListState();
  const theme = useBodyState((s) => s.theme);
  if (!host) return null;
  const tp = themePathOf(theme);

  const imageDropHidden =
    l.isLoading || l.viewMode === 'trash' || l.viewMode === 'unfiled' || l.viewMode === 'untagged'
    || l.allDataCount > 0 || !!l.keyword || l.hasSmartFolder || l.filterBadge > 0 || l.folderChildrenCount > 0;

  return createPortal(
    <>
      {!imageDropHidden && (
        <div id="image-drop-area" className="drop-area">
          <div className="dash-line" />
          {(l.viewMode === 'all' || l.viewMode === 'random') && (
            <div className="message">
              <img src={`assets/images/${tp}/illustrations/empty-library.png`} width={352} height={144} />
              <h2>{t('empty.all.title')}</h2>
              <p>{t('empty.all.desc')}</p>
              <div className="buttons">
                <div className="button button-xs button-grey" onClick={() => scopeFn('importFolders')()}>{t('dialog.importLocalFolder.title')}</div>
                <a className="button button-xs button-grey" href="https://eagle.cool/extensions" target="_blank" rel="noreferrer">{t('appmenu.help>installExtension')}</a>
              </div>
            </div>
          )}
          {(l.viewMode !== 'all' && l.viewMode !== 'random') && !l.folderLocked && (
            <div className="message">
              <img src={`assets/images/${tp}/illustrations/empty-folder.png`} width={352} height={144} />
              <h2>{t('empty.folder.title')}</h2>
              <p>{t('empty.all.desc')}</p>
              <div className="buttons">
                <div className="button button-xs button-grey" onClick={() => { const s = getBodyScope(); if (s) scopeFn('importFolders', s.currentFolder)(); }}>{t('dialog.importLocalFolder.title')}</div>
                <a className="button button-xs button-grey" href="https://eagle.cool/extensions" target="_blank" rel="noreferrer">{t('appmenu.help>installExtension')}</a>
              </div>
            </div>
          )}
        </div>
      )}

      {l.hasSmartFolder && l.filteredsCount === 0 && !l.keyword && (
        <div className="drop-area">
          <div className="message">
            <img src={`assets/images/${tp}/illustrations/empty-search.png`} width={256} height={144} />
            <h2>{t('empty.search.title')}</h2>
            <p>{t('empty.search.desc')}</p>
          </div>
        </div>
      )}

      {l.viewMode === 'unfiled' && l.unfiledCount === 0 && !l.keyword && l.allDataCount === 0 && (
        <div className="drop-area fill">
          {l.rawCount > 0 && (
            <div className="message">
              <img src={`assets/images/${tp}/illustrations/empty-unfiled-done.png`} width={400} height={144} />
              <h2>{t('empty.unfiled.done.title')}</h2>
              <p>{t('empty.unfiled.done.desc')}</p>
            </div>
          )}
          {l.rawCount === 0 && (
            <div className="message">
              <img src={`assets/images/${tp}/illustrations/empty-unfiled-intro.png`} width={400} height={144} />
              <h2>{t('empty.unfiled.intro.title')}</h2>
              <p>{t('empty.unfiled.intro.desc')}</p>
            </div>
          )}
        </div>
      )}

      {l.viewMode === 'untagged' && l.untaggedCount === 0 && !l.keyword && (
        <div className="drop-area fill">
          {l.rawCount > 0 && (
            <div className="message">
              <img src={`assets/images/${tp}/illustrations/empty-untagged-done.png`} width={400} height={144} />
              <h2>{t('empty.untagged.done.title')}</h2>
              <p>{t('empty.untagged.done.desc')}</p>
            </div>
          )}
          {l.rawCount === 0 && (
            <div className="message">
              <img src={`assets/images/${tp}/illustrations/empty-untagged-intro.png`} width={400} height={144} />
              <h2>{t('empty.untagged.intro.title')}</h2>
              <p>{t('empty.untagged.intro.desc')}</p>
            </div>
          )}
        </div>
      )}

      {l.viewMode === 'trash' && l.trashCount === 0 && !(l.keyword || l.filterBadge) && (
        <div className="drop-area">
          <div className="message">
            <img src={`assets/images/${tp}/illustrations/empty-trash.png`} width={124} height={144} />
            <h2>{t('empty.trash.title')}</h2>
            <p>{t('empty.trash.desc')}</p>
          </div>
        </div>
      )}

      {l.filteredsCount === 0 && !!(l.keyword || l.filterBadge) && (
        <div className="drop-area" style={{ pointerEvents: 'none' }}>
          {l.subFoldersCount === 0 && (
            <div className="message">
              <img src={`assets/images/${tp}/illustrations/empty-search.png`} width={256} height={144} />
              <h2>{t('empty.search.title')}</h2>
              <p>{t('empty.search.desc')}</p>
            </div>
          )}
        </div>
      )}
    </>,
    host
  );
}

/** scroll-to-top（index.html 111；ng-hide → display；show class 由 sentinel 指令管理）。 */
export function ScrollToTop() {
  const host = useHost('eagle-scroll-top-host');
  const isDetailMode = useBodyState((s) => s.isDetailMode);
  const viewMode = useBodyState((s) => s.viewMode);
  const theme = useBodyState((s) => s.theme);
  const tp = themePathOf(theme);
  const hidden = isDetailMode || viewMode === 'alltags';
  useEffect(() => {
    const el = document.getElementById('scroll-to-top');
    if (el) el.style.display = hidden ? 'none' : '';
  }, [hidden]);
  if (!host) return null;
  return createPortal(
    <div id="scroll-to-top" className="scroll-to-top" style={{ display: hidden ? 'none' : '' }}>
      <img src={`assets/images/${tp}/icons/ic-scroll-top.svg`} />
    </div>,
    host
  );
}

/** 子文件夹列表（index.html 216-261 逐字；ui-sortable 走 scope.subFolderSortableOptions 原对象）。 */
export function SubFolderSection() {
  const host = useHost('eagle-sub-folder-host');
  const l = useListState();
  const theme = useBodyState((s) => s.theme);
  const listRef = useRef<HTMLDivElement | null>(null);
  const tp = themePathOf(theme);

  const ngIf = l.noSelectedFolders && l.folderChildrenCount > 0 && l.subFoldersCount > 0;
  const ngShow = l.listDone && l.filterBadge === 0 && !l.folderLocked;

  useEffect(() => {
    if (!ngIf || !listRef.current) return;
    const $ = (window as any).jQuery;
    const scope = getBodyScope();
    if (!$ || !scope || !$.fn.sortable) return;
    const $list = $(listRef.current);
    const options = scope.subFolderSortableOptions || {};
    if (!$list.data('ui-sortable') && !$list.data('sortable')) {
      $list.sortable({ ...options });
    }
    $list.sortable('option', 'disabled', !!options.disabled);
    return () => {
      try { if ($list.data('ui-sortable') || $list.data('sortable')) $list.sortable('destroy'); } catch { /* noop */ }
    };
  });

  if (!host || !ngIf) return null;
  return createPortal(
    <div
      id="sub-folder-container"
      style={{ width: '100%', display: ngShow ? '' : 'none' }}
    >
      {l.subFoldersCount > 0 && (
        <div className="list-label">
          <div style={{ display: 'inline-flex' }} onClick={() => scopeFn('toggleSubFolderList')()}>
            {t('subFolderList.sectionLabel')} ({l.folderChildrenCount})
            <div className={`expand-icon${!l.isHideSubFolder ? ' expand' : ''}`}>
              <img src={`assets/images/${tp}/icons/ic-arrow-right.svg`} />
            </div>
          </div>
          <div className="toggle-subfolder-content-btn" onClick={() => scopeFn('showListSubfolderContent')()}>
            <div className={`checkbox${l.showSubfolderContent ? ' checked' : ''}`} />
            {t('subFolderList.showSubFolderContentLabel')}
          </div>
        </div>
      )}
      {l.isHideSubFolder && (
        <div
          ref={listRef}
          className="sub-folder-list"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => scopeFn('cleanSelected')(e)}
        >
          {l.subFolders.map((folder: any, index: number) => (
            <div
              key={folder.id || index}
              className={`sub-folder${l.selectedFolderMappings[folder.id] ? ' selected' : ''}${folder.password && !folder.isUnLock ? ' locked' : ''}`}
              onDrop={(e) => scopeFn('onDropFolder')(e)}
              onDragOver={(e) => scopeFn('onDragOverSubFolder')(e)}
              onDragLeave={(e) => scopeFn('onDragEndSubFolder')(e)}
              onClick={(e) => { e.stopPropagation(); scopeFn('selectFolder', folder)(e); }}
              onDoubleClick={() => scopeFn('openFolder', folder, undefined, undefined, undefined, 'content')()}
              onContextMenu={(e) => { e.preventDefault(); scopeFn('openSubFolderContextMenu', folder)(e); }}
            >
              <div
                className="thumbnail"
                onClick={(e) => { e.stopPropagation(); scopeFn('selectFolder', folder)(e); }}
                onContextMenu={(e) => { e.preventDefault(); scopeFn('openSubFolderContextMenu', folder)(e); }}
              >
                <div className="pic" dangerouslySetInnerHTML={{ __html: (folder.covers && folder.covers[0]) || '' }} />
                <div className="pic" />
                <div className="pic" />
                <div className="lock-icon lock"><img src={`assets/images/${tp}/icons/ic-list-sub-folder-lock.svg`} /></div>
              </div>
              <div className="name" onDoubleClick={(e) => { e.stopPropagation(); scopeFn('enableSubFolderNameEditable', folder)(e); }}>{folder.name}</div>
              <div className="metas">
                <span>{folder.imageCount} {t('subFolderList.itemsLabel')}</span>
                {folder.children && folder.children.length > 0 && <span>．{folder.children.length} {t('subFolderList.subFolderLabel')}</span>}
              </div>
              <div className="metas mtime" style={{ display: 'none' }}><span /></div>
            </div>
          ))}
        </div>
      )}
      {l.isHideSubFolder && <div className="marginBottom-m" />}
      {l.isHideSubFolder && l.filteredsCount > 0 && l.listDone && l.subFoldersCount > 0 && (
        <div className="list-label">{t('subFolderList.contentLabel')} ({l.allDataCount})</div>
      )}
    </div>,
    host
  );
}

const LIST_HEADER_PROPS: Array<{ cls: string; key: string; i18n: string }> = [
  { cls: 'name', key: 'NAME', i18n: 'context.order.displayItems>name' },
  { cls: 'tags', key: 'TAGS', i18n: 'context.order.metaItems>tags' },
  { cls: 'resolution', key: 'RESOLUTION', i18n: 'context.order.orderBy>resolution' },
  { cls: 'rating', key: 'RATING', i18n: 'context.order.orderBy>rating' },
  { cls: 'ext', key: 'EXT', i18n: 'context.order.displayItems>ext' },
  { cls: 'size', key: 'FILESIZE', i18n: 'context.order.orderBy>filesize' },
  { cls: 'mtime', key: 'IMPORT', i18n: 'context.order.orderBy>import' },
];

/** ListLayout 列表列头（index.html 263-292 逐字）。 */
export function ListLayoutHeader() {
  const host = useHost('eagle-list-header-host');
  const l = useListState();
  const theme = useBodyState((s) => s.theme);
  const tp = themePathOf(theme);
  if (!host || l.layout !== 'ListLayout') return null;
  return createPortal(
    <div
      id="list-layout-header"
      style={{ display: l.filteredsCount > 0 ? '' : 'none' }}
      onContextMenu={(e) => { e.preventDefault(); scopeFn('openListPropContextMenu')(e); }}
    >
      <div className="prop thumbnail" />
      {LIST_HEADER_PROPS.map((prop) => (
        <div
          key={prop.key}
          className={`prop ${prop.cls}${l.currentOrderBy === prop.key ? ' active' : ''}`}
          onClick={() => scopeFn('changeListOrderBy', prop.key)()}
        >
          <div className="name">{t(prop.i18n)}</div>
          <div className="icon">
            <img className={l.currentSortIncrease ? 'up' : ''} src={`assets/images/${tp}/icons/ic-list-arrow-down.svg`} />
          </div>
        </div>
      ))}
    </div>,
    host
  );
}

/** 面板拖放浮层（index.html 297-308 逐字；on* 绑定 → React 事件调同名 scope 函数）。 */
export function PanelDropArea() {
  const host = useHost('eagle-panel-droparea-host');
  if (!host) return null;
  return createPortal(
    <div className="box-container-droparea"
      onDragEnter={(e) => scopeFn('onDragEnterContainer')(e)}
      onDragLeave={(e) => scopeFn('onDragLeaveContainer')(e)}
      onDrop={(e) => scopeFn('onDropContainer')(e)}
      onDragOver={(e) => scopeFn('onDragOverContainer')(e)}
      onMouseMove={(e) => scopeFn('onMouseMoveContainer')(e)}
    >
      <div className="tips">{t('pages.droparea.container')}</div>
    </div>,
    host
  );
}

/** #box-container 属性绑定补位（ng-right-click/on* 移除后的原生监听）。 */
export function BoxContainerListeners() {
  useEffect(() => {
    const box = document.getElementById('box-container');
    const scope = getBodyScope();
    if (!box || !scope) return;
    const call = (fn: string) => (e: Event) => {
      const s = getBodyScope();
      if (s && typeof s[fn] === 'function') s[fn](e);
    };
    const onContextMenu = (e: Event) => { e.preventDefault(); call('openFileListContextMenu')(e); };
    box.addEventListener('contextmenu', onContextMenu);
    const enter = call('onDragEnterContainer');
    const leave = call('onDragLeaveContainer');
    const over = call('onDragOverContainer');
    const drop = call('onDropContainer');
    const move = call('onMouseMoveContainer');
    box.addEventListener('dragenter', enter);
    box.addEventListener('dragleave', leave);
    box.addEventListener('dragover', over);
    box.addEventListener('drop', drop);
    box.addEventListener('mousemove', move);
    return () => {
      box.removeEventListener('contextmenu', onContextMenu);
      box.removeEventListener('dragenter', enter);
      box.removeEventListener('dragleave', leave);
      box.removeEventListener('dragover', over);
      box.removeEventListener('drop', drop);
      box.removeEventListener('mousemove', move);
    };
  }, []);
  return null;
}
