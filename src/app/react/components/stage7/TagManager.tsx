import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTagManagerState } from '../../store/tagManagerState';
import { getBodyScope, scopeApply } from '../../global/scopeBridge';
import { saveFolder } from '../../services/folderService';
import { t } from '../../global/eagleGlobals';
import { useTippy } from '../hooks';
import { ContentEditable } from '../inspector/ContentEditable';
import { useVirtualWindow } from '../sidebar/Sidebar';
import { $ } from '../detail/detailHooks';
import { fuzzyMatchHtml } from './ContextMenu';

/**
 * 阶段7b：标签管理接管（tag-manager 指令 + tag-select 指令）。
 *
 * DOM 规范 = js/directives/tag-manager.html 逐字转写；虚拟滚动（vs-repeat 26/excess 30/
 * vs-size=size）复用 useVirtualWindow；scope 函数（openTagGroup/selectTag/...）全在
 * EagleController body scope，事件回调经 getBodyScope() 调用活对象。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;

const call = (fn: string, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    if (typeof scope[fn] === 'function') scope[fn](...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });

/* ---------------- tag-select 指令（72799-73001 逐字） ---------------- */

function useTagSelect(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const w = window as any;
    let tagRectSelection: any = {};
    let startX = 0;
    let startY = 0;
    let offset: any;
    const rect = document.createElement('div');
    rect.className = 'rect';
    (rect.style as any).display = 'none';
    rect.style.opacity = '0';
    let tagItems: any[] = [];
    let container: HTMLElement | null = null;
    let windowHeight = 0;

    const contain = (el: any) => {
      const a = { width: el.width, height: el.height, x: el.left, y: el.top };
      const b = {
        width: tagRectSelection.w,
        height: tagRectSelection.h,
        x: tagRectSelection.startX,
        y: tagRectSelection.startY,
      };
      return !(
        (a.y + a.height < b.y) ||
        a.y > b.y + b.height ||
        (a.x + a.width < b.x) ||
        a.x > b.x + b.width
      );
    };

    const drawRect = () => {
      rect.style.transform = 'none';
      rect.style.top = tagRectSelection.startY + 'px';
      rect.style.left = tagRectSelection.startX + 'px';
      rect.style.width = tagRectSelection.w + 'px';
      rect.style.height = tagRectSelection.h + 'px';
      rect.style.opacity = '1';
    };

    const hideRect = () => {
      rect.style.top = '0px';
      rect.style.left = '0px';
      rect.style.width = '0px';
      rect.style.height = '0px';
      (rect.style as any).display = 'none !important';
      rect.style.transform = 'none';
      rect.style.opacity = '0';
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      tagItems = [];
      tagRectSelection = {};
      container = element.querySelector('.tag-manager-container') as HTMLElement;
      if (container) container.appendChild(rect);
      windowHeight = $()(window).height();
      tagRectSelection = {};

      const s = getBodyScope();
      if (e.which !== 1 || s?.isDetailMode) return;

      offset = $()(container).offset();
      if (!offset) return;

      const displayData = s?.TagManager?.tagsResult?.display || [];
      const columnWidth = s?.TagManager?.tagsResult?.columnWidth || 200;
      const $container = $()(container);
      const tagWidth = $container.find('.tag').width() || 0;
      const gapWidth = columnWidth - tagWidth;
      const containerPaddingLeft = parseInt($container.css('padding-left')) || 0;
      const containerPaddingTop = parseInt($container.css('padding-top')) || 0;

      const $groupDescription = $container.find('.group-description');
      let descriptionHeight = 0;
      if ($groupDescription.length > 0) {
        descriptionHeight = $groupDescription.outerHeight(true) || 0;
      }

      let currentY = 0;
      displayData.forEach((vsRepeatItem: any) => {
        if (vsRepeatItem.type === 'group') {
          currentY += 32;
          currentY += descriptionHeight;
        } else if (vsRepeatItem.type === 'starred') {
          currentY += 32;
        } else if (vsRepeatItem.type === 'row') {
          vsRepeatItem.tags.forEach((tag: string, index: number) => {
            tagItems.push({
              width: columnWidth - gapWidth,
              height: 27,
              left: index * columnWidth + containerPaddingLeft,
              top: currentY + containerPaddingTop,
              name: tag,
            });
          });
          currentY += 27;
        } else if (vsRepeatItem.type === 'separator') {
          currentY += 25;
        }
      });

      scopeApply(s, (sc) => {
        sc.selectedTags = {};
        sc.selectingTags = {};
      });

      tagRectSelection.startX = startX = e.pageX - offset.left;
      tagRectSelection.startY = startY = e.pageY - offset.top + $container.scrollTop();
      w.tagRectSelecting = true;

      rect.style.opacity = '1';
      rect.style.transform = 'none';
      rect.style.top = tagRectSelection.startY + 'px';
      rect.style.left = tagRectSelection.startX + 'px';
      (rect.style as any).display = 'block';

      scopeApply(s, (sc) => {
        sc.$root.currentFocus = 'content';
        sc.$evalAsync?.();
      });
    };

    const onMouseUp = () => {
      const s = getBodyScope();
      if (!w.tagRectSelecting) return;
      if (s?.isDetailMode) return;

      hideRect();

      tagRectSelection = {};
      w.tagRectSelecting = false;

      scopeApply(s, (sc) => {
        sc.selectedTags = { ...(sc.selectingTags || {}) };
        sc.selectingTags = {};
        sc.$evalAsync?.();
      });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!w.tagRectSelecting) return;
      const s = getBodyScope();

      const $container = $()(container);
      const scrollTop = $container.scrollTop();
      const flipX = startX > e.pageX - offset.left;
      const flipY = startY > e.pageY - offset.top + scrollTop;

      tagRectSelection.w = Math.abs(e.pageX - offset.left - startX);
      tagRectSelection.h = Math.abs(e.pageY - offset.top - startY + scrollTop);

      if (e.pageY <= offset.top + 24) {
        container!.scrollTop = scrollTop - 48;
      } else if (e.pageY >= windowHeight - 24) {
        container!.scrollTop = scrollTop + 48;
      }

      if (flipX) {
        tagRectSelection.startX = startX - tagRectSelection.w;
      }
      if (flipY) {
        tagRectSelection.startY = startY - tagRectSelection.h;
      }

      drawRect();

      if (tagItems.length > 0) {
        scopeApply(s, (sc) => {
          sc.selectingTags = {};
          for (let i = 0; i < tagItems.length; i++) {
            const tagName = tagItems[i].name;
            if (!tagName) continue;
            if (contain(tagItems[i])) {
              sc.selectingTags[tagName] = true;
            }
          }
          sc.$evalAsync?.();
        });
      }
    };

    element.addEventListener('mousedown', onMouseDown);
    $()(window).on('mouseup', onMouseUp);
    $()(window).on('mousemove', onMouseMove);
    return () => {
      element.removeEventListener('mousedown', onMouseDown);
      $()(window).off('mouseup', onMouseUp);
      $()(window).off('mousemove', onMouseMove);
      try {
        rect.remove();
      } catch (err) {}
    };
  }, []);
}

/* ---------------- 主组件（tag-manager.html 逐字） ---------------- */

export function TagManagerPanel() {
  const { snapshot } = useTagManagerState();
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useTagSelect(rootRef);
  useTippy(rootRef, JSON.stringify([snapshot.theme, snapshot.groups.length]));

  useEffect(() => {
    setHost(document.getElementById('eagle-tag-manager-host'));
  }, []);

  // resizable="e"（bundle:70423-70440；onTagSidebarResize 在 body scope）
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const jQuery = $();
    if (!jQuery) return;
    jQuery(el).resizable({
      maxWidth: 600,
      minWidth: 200,
      handles: 'e',
      resize: (event: any, ui: any) => {
        scopeApply(getBodyScope(), (s) => {
          if (typeof s.onTagSidebarResize === 'function') s.onTagSidebarResize(event, ui);
          s.$evalAsync?.();
        });
      },
    });
    return () => {
      try {
        jQuery(el).resizable('destroy');
      } catch (err) {}
    };
  }, [host]);

  // ui-sortable（tagGroupSortableOptions：动画/距离/克隆 + stop 侧效）
  useEffect(() => {
    const el = groupsRef.current;
    if (!el) return;
    const jQuery = $();
    if (!jQuery) return;
    jQuery(el).sortable({
      animation: 200,
      distance: 10,
      disabled: false,
      helper: 'clone',
      stop: () => {
        scopeApply(getBodyScope(), (s) => {
          const order = jQuery(el).sortable('toArray', { attribute: 'data-group-id' });
          const groups = s.TagManager.groups || [];
          s.TagManager.groups = order.map((id: string) => groups.find((g: any) => g.id === id)).filter(Boolean);
          saveFolder();
          s.$evalAsync?.();
          const w = window as any;
          w.tagRectSelecting = false;
          try {
            w.electronLog && w.electronLog.info(`[app] Sort tag groups`);
          } catch (err) {}
          setTimeout(() => {
            s.TagManager.calculateTags();
          }, 500);
        });
      },
    });
    return () => {
      try {
        jQuery(el).sortable('destroy');
      } catch (err) {}
    };
  }, [snapshot.groups.length, host]);

  // vs-repeat（26/excess 30/vs-size=size）—— 虚拟窗口
  const sizes = useMemo(() => snapshot.display.map((row) => row.size || 27), [snapshot.display]);
  const listRef = useRef<HTMLDivElement>(null);
  const win = useVirtualWindow(listRef, sizes, snapshot.display.length + ':' + snapshot.tagViewModeName + ':' + snapshot.keyword);

  // scroll-position-saver（tagViewModeName 键，轻量移植）
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const key = `eagle.vsrepeat.scroll.${snapshot.tagViewModeName || 'default'}`;
    const saved = sessionStorage.getItem(key);
    if (saved) el.scrollTop = Number(saved) || 0;
    const save = () => sessionStorage.setItem(key, String(el.scrollTop));
    el.addEventListener('scroll', save, { passive: true });
    return () => {
      el.removeEventListener('scroll', save);
      save();
    };
  }, [snapshot.tagViewModeName, host]);

  const visible = !snapshot.isDetailMode && snapshot.viewMode === 'alltags';
  const { theme } = snapshot;

  const liveMapping = (tag: string) => getBodyScope()?.TagManager?.tagMappings?.[tag];
  const liveGroup = (id: string) => getBodyScope()?.TagManager?.groups?.find?.((g: any) => g.id === id);

  const windowed = snapshot.display.slice(win.startIndex, win.endIndex);

  const renderRow = (item: any, i: number) => {
    if (item.type === 'separator') {
      return <div key={i} className="separator" style={{ height: 25 }} />;
    }
    if (item.type === 'group' || item.type === 'starred') {
      const isGroup = item.type === 'group';
      return (
        <div key={i} className="group-header">
          <div className="group-name" style={{ height: 32, lineHeight: '32px' }}>
            {item.name} <span className="count">({item.count})</span>
            {isGroup && snapshot.currentTagGroup && (
              <div
                className="ic-btn"
                onClick={(e) => {
                  const live = liveGroup(snapshot.currentTagGroup!.id);
                  if (live) call('addGroupTags', live)(e);
                }}
              >
                <img src={iconSrc(theme, 'ic-sidebar-add.svg')} />
              </div>
            )}
          </div>
          {isGroup && snapshot.currentTagGroup && (
            <ContentEditable
              className="group-description"
              value={snapshot.currentTagGroup.description || ''}
              placeholder={t('pages.allTags.group.descriptionPlaceholder')}
              stripBr
              tabIndex={0}
              onFocus={() => call('tagGroupDescriptionFocus')()}
              onBlur={() => call('tagGroupDescriptionBlur')()}
              onChange={(html) => {
                scopeApply(getBodyScope(), (s) => {
                  s.currentTagGroup.description = html;
                });
              }}
            />
          )}
        </div>
      );
    }
    // row
    return (
      <div key={i} className="tag-group-tags" style={{ height: 27, lineHeight: '27px' }}>
        {item.tags?.map((tag: string, ti: number) => {
          const mapping = snapshot.tagMappings[tag] || {};
          const selected = !!(snapshot.selectedTags[mapping.name || tag] || snapshot.selectingTags[tag]);
          return (
            <span
              key={ti}
              className={`tag color-${mapping.color}${mapping.color ? ' has-color' : ''}${selected ? ' selected' : ''}${
                ti === 0 ? ' first' : ''
              }${snapshot.keyword ? ' disable-sort' : ''}`}
              onClick={(e) => {
                const live = liveMapping(tag);
                if (live) call('selectTag', e.nativeEvent, live)(e);
              }}
              onDoubleClick={(e) => call('openTag', mapping.name || tag)(e)}
              onContextMenu={(e) => {
                const live = liveMapping(tag);
                if (live) call('openTagContextMenu', e.nativeEvent, live)(e);
              }}
              draggable
              onMouseDown={(e) => e.stopPropagation()}
              onDragEnd={(e) => (window as any).onDragTagEnd(e.nativeEvent)}
              onDragStart={(e) => (window as any).onDragTagStart(e.nativeEvent)}
              onDrag={(e) => (window as any).onDragTag(e.nativeEvent)}
            >
              <div className="icon">
                <div className="dot" />
              </div>
              <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(tag, snapshot.keyword) }} />
              <span className="count">({mapping.imageCount})</span>
            </span>
          );
        })}
      </div>
    );
  };

  return host
    ? createPortal(
        <div
          id="tag-manager"
          style={!visible ? { display: 'none' } : undefined}
          className={snapshot.tagViewLayoutMode === 'LIST' ? 'list-mode' : undefined}
          ref={rootRef}
        >
          {/* 側欄 */}
          <div
            className="tag-manager-sidebar"
            style={{ width: snapshot.tagSidebarWidth }}
            onMouseDown={(e) => e.stopPropagation()}
            ref={sidebarRef}
          >
            <div
              className={`sidebar-item${snapshot.tagViewMode === 'ALL' ? ' active' : ''}`}
              onClick={() => call('openTagAllGroup')()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="icon">
                <div className="fake-svg" style={{ WebkitMaskImage: `url(${iconSrc(theme, 'ic-tag-manager-all.svg')})`, WebkitMaskSize: '16px' } as React.CSSProperties} />
              </div>
              <div className="name">{t('pages.allTags.sidebar.all')}</div>
              <div className="count" style={snapshot.allTagsCount > 0 ? undefined : { display: 'none' }}>
                {snapshot.allTagsCount}
              </div>
            </div>
            <div
              className={`sidebar-item${snapshot.tagViewMode === 'UNFILED' ? ' active' : ''}`}
              onClick={() => call('openUnfiledGroup')()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="icon">
                <div className="fake-svg" style={{ WebkitMaskImage: `url(${iconSrc(theme, 'ic-tag-manager-unfiled.svg')})`, WebkitMaskSize: '16px' } as React.CSSProperties} />
              </div>
              <div className="name">{t('pages.allTags.sidebar.unfiled')}</div>
              <div className="count" style={snapshot.unfiledTagsCount > 0 ? undefined : { display: 'none' }}>
                {snapshot.unfiledTagsCount}
              </div>
            </div>
            <div
              className={`sidebar-item${snapshot.tagViewMode === 'STARRED' ? ' active' : ''}`}
              onClick={() => call('openStarredGroup')()}
              onMouseDown={(e) => e.stopPropagation()}
              onDrop={(e) => (window as any).onDropStarredTag(e.nativeEvent)}
              onDragOver={(e) => (window as any).onDragOverTag(e.nativeEvent)}
            >
              <div className="icon">
                <div className="fake-svg" style={{ WebkitMaskImage: `url(${iconSrc(theme, 'ic-tag-manager-starred.svg')})`, WebkitMaskSize: '16px' } as React.CSSProperties} />
              </div>
              <div className="name">{t('pages.allTags.sidebar.starred')}</div>
              <div className="count" style={snapshot.starredTagsCount > 0 ? undefined : { display: 'none' }}>
                {snapshot.starredTagsCount}
              </div>
            </div>
            <label>
              {t('pages.allTags.sidebar.groupsLabel')}{' '}
              <span style={snapshot.groups.length > 0 ? undefined : { display: 'none' }}>({snapshot.groups.length})</span>
              <div
                className="ic-btn new-btn"
                tippy=""
                tippy-placement="bottom"
                tippy-content={t('context.tagGroup.create')}
                onClick={call('createTagGroup')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <img src={iconSrc(theme, 'ic-sidebar-add.svg')} />
              </div>
            </label>
            <div ref={groupsRef}>
              {snapshot.groups.map((group) => (
                <div
                  key={group.id}
                  data-group-id={group.id}
                  className={`sidebar-item group-item color-${group.color}${snapshot.currentTagGroup?.id === group.id ? ' active' : ''}`}
                  onClick={(e) => {
                    const live = liveGroup(group.id);
                    if (live) call('openTagGroup', live)(e);
                  }}
                  onDoubleClick={(e) => {
                    const live = liveGroup(group.id);
                    if (live) call('renameTagGroup', live)(e);
                  }}
                  onContextMenu={(e) => {
                    const live = liveGroup(group.id);
                    if (live) call('openTagGroupContextMenu', e.nativeEvent, live)(e);
                  }}
                  onDrop={(e) => (window as any).onDropTag(e.nativeEvent)}
                  onDragEnter={(e) => (window as any).onDragOverTag(e.nativeEvent)}
                >
                  <div className="icon">
                    <div className="fake-svg" style={{ WebkitMaskImage: 'url(assets/images/base/icons/ic-tag-select-tag.png)' } as React.CSSProperties} />
                  </div>
                  {!group.editable && <div className="name">{group.name}</div>}
                  {group.editable && (
                    <div className="name">
                      <input
                        id={`group-input-${group.id}`}
                        type="text"
                        maxLength={2048}
                        defaultValue={snapshot.newGroupName}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          e.nativeEvent.stopPropagation();
                          scopeApply(getBodyScope(), (s) => {
                            s.newGroupName = (e.target as HTMLInputElement).value;
                            if (typeof s.renameTagGroupKeyup === 'function') s.renameTagGroupKeyup(e.nativeEvent, liveGroup(group.id), s.newGroupName);
                          });
                        }}
                        onBlur={(e) => {
                          scopeApply(getBodyScope(), (s) => {
                            s.newGroupName = (e.target as HTMLInputElement).value;
                            if (typeof s.renameTagGroupBlur === 'function') s.renameTagGroupBlur(liveGroup(group.id), s.newGroupName);
                          });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {!group.editable && <div className="count">{group.tagsCount}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* 標籤列表 */}
          <div
            className="tag-manager-container"
            style={{ left: snapshot.tagSidebarWidth }}
            onContextMenu={(e) => call('openTagGroupListContextMenu', e.nativeEvent)(e)}
            ref={listRef}
          >
            <div className="vs-repeat-before-content" style={{ height: `${win.beforeSize}px` }} />
            {windowed.map((item, i) => renderRow(item, win.startIndex + i))}
            <div className="vs-repeat-after-content" style={{ height: `${win.afterSize}px` }} />
          </div>

          {/* 空白狀態 */}
          <div
            className="tag-manager-container empty"
            style={!snapshot.keyword && snapshot.tagsResultTags.length === 0 ? undefined : { display: 'none' }}
          >
            {snapshot.rawdataCount === 0 && snapshot.tagViewMode === 'UNFILED' && (
              <div className="empty-state">
                <img src={`assets/images/${themePathOf(theme)}/illustrations/empty-tag-manager-all.png`} width={400} height={144} />
                <h2>{t('empty.tags.title')}</h2>
                <p>{t('empty.tags.desc')}</p>
              </div>
            )}
            {snapshot.rawdataCount !== 0 && snapshot.tagViewMode === 'UNFILED' && (
              <div className="empty-state">
                <img src={`assets/images/${themePathOf(theme)}/illustrations/empty-tag-manager-done.png`} width={400} height={144} />
                <h2>{t('empty.allTags.done.title')}</h2>
                <p>{t('empty.allTags.done.desc')}</p>
              </div>
            )}
            {snapshot.tagViewMode !== 'UNFILED' && (
              <div className="empty-state">
                <img src={`assets/images/${themePathOf(theme)}/illustrations/empty-tag-manager-all.png`} width={400} height={144} />
                <h2>{t('empty.tags.title')}</h2>
                <p>{t('empty.tags.desc')}</p>
              </div>
            )}
          </div>

          {/* 搜寻空 */}
          <div
            className="tag-manager-container empty"
            style={snapshot.keyword && snapshot.tagsResultTags.length === 0 ? undefined : { display: 'none' }}
          >
            <div className="empty-state">
              <img src={`assets/images/${themePathOf(theme)}/illustrations/empty-search.png`} width={256} height={144} />
              <h2>{t('empty.search.title')}</h2>
              <p>{t('empty.search.desc')}</p>
            </div>
          </div>
        </div>,
        host
      )
    : null;
}
