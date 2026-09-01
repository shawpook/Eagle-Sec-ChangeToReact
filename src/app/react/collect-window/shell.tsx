/**
 * 采集窗 React 壳——collect-window.html body（左列：假缩略图/星等/名稱/註釋/標籤；右列：
 * folder-select-panel + loader；tag-select-panel/context-menu 为 9b-2）逐字转写。阶段9b-1。
 */

import { useEffect, useRef, useState } from 'react';
import { controllerScope, applyController, subscribeController, getControllerVersion, ct } from './controller';
import { FolderSelectPanelHost } from './folderPanel';

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

function useControllerVersion(): number {
  const [, bump] = useState(0);
  useEffect(() => subscribeController(() => bump((v) => v + 1)), []);
  return getControllerVersion();
}

/* ---- 可编辑 div（angular-contenteditable 等价：plaintext-only/strip-br/maxlength/data-placeholder） ---- */

function EditableDiv({
  valueKey,
  placeholder,
  maxlength,
  stripBr,
  className,
}: {
  valueKey: 'title' | 'annotation';
  placeholder: string;
  maxlength: number;
  stripBr: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastExternal = useRef<any>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const value = controllerScope.collectItem?.[valueKey];
    // 仅外部赋值（init/get-collect-window-data）时回写 DOM，避免打断输入光标
    if (value !== undefined && value !== lastExternal.current && document.activeElement !== el) {
      el.textContent = value;
    }
    lastExternal.current = value;
  });

  return (
    <div
      ref={ref}
      data-placeholder={placeholder}
      contentEditable="plaintext-only"
      {...({ maxlength } as any)}
      className={className}
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
      onInput={(e) => {
        const el = e.currentTarget;
        let text = stripBr ? (el.textContent || '') : el.innerHTML;
        if (stripBr && text.length > maxlength) text = text.slice(0, maxlength);
        applyController((s) => {
          s.collectItem[valueKey] = text;
        });
      }}
      allow-scroll="true"
    />
  );
}

function CollectShell() {
  useControllerVersion();
  const scope = controllerScope;
  const theme = scope.theme || 'dark';
  const themePath = themePathOf(theme);
  const collectItem = scope.collectItem || {};
  const bodyPrev = useRef('');
  useEffect(() => {
    const body = document.body;
    if (!body) return;
    const base = `${scope.platform || ''} ${scope.theme || ''}`.trim();
    if (base !== bodyPrev.current) {
      body.className = base;
      bodyPrev.current = base;
    }
    body.setAttribute('theme', scope.theme || '');
    body.setAttribute('platform', scope.platform || '');
    body.setAttribute('eagle-extension', '');
    body.setAttribute('eagle-extension-locale', scope.browserName ? 'en' : 'en');
    body.setAttribute('eagle-browser', scope.browserName || '');
  });

  const toolbarAnchor = null;
  void toolbarAnchor;

  return (
    <>
      <div className={`collect-window${scope.isReady ? ' open' : ''}`} onClick={() => scope.focusFolderInput()}>
        <div className="left">
          {/* 假的預覽區 */}
          <div className="thumbnail">
            <img src={collectItem.src} />
            {collectItem.width ? <div className="resolution">{`${collectItem.width} x ${collectItem.height}`}</div> : null}
          </div>

          {/* 星等 */}
          <div className={`rating-container star-${collectItem.star ?? ''}`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                onClick={(e) => {
                  e.stopPropagation();
                  applyController((s) => s.changeStar(star));
                }}
              />
            ))}
          </div>

          {/* 名稱 */}
          <EditableDiv
            valueKey="title"
            placeholder={ct('collect-window.title')}
            maxlength={255}
            stripBr={true}
          />

          {/* 註釋 */}
          <EditableDiv
            valueKey="annotation"
            placeholder={ct('collect-window.annotation')}
            maxlength={8192}
            stripBr={false}
            className="annotation"
          />

          <div className="separator" />

          <div className="label-container">
            {(collectItem.tags || []).map((tag: string) => {
              const tagInfo = scope.tagsMap[tag] || {};
              return (
                <div key={tag} className={`label-item color-${tagInfo.color || ''}`} title={tagInfo.name || tag}>
                  <span className="label-item-name">{String(tagInfo.name || tag).slice(0, 200)}</span>
                  <div
                    className="ic-btn label-item-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      applyController((s) => s.removeTag(tag));
                    }}
                  >
                    <img src={`assets/images/${themePath}/icons/ic-inspector-remove-label.svg`} />
                  </div>
                </div>
              );
            })}

            {(collectItem.tags || []).length === 0 && (
              <div
                className="ic-btn has-bg create-label-btn full-width"
                onClick={(e) => {
                  e.stopPropagation();
                  scope.openTagSelect();
                }}
              >
                <img src={`assets/images/${themePath}/icons/ic-inspector-add-label.svg`} />
                <span>{ct('collect-window.add-tag')}</span>
              </div>
            )}

            {(collectItem.tags || []).length > 0 && (
              <div
                className="ic-btn create-label-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  scope.openTagSelect();
                }}
              >
                <img src={`assets/images/${themePath}/icons/ic-inspector-add-label.svg`} />
              </div>
            )}
          </div>
        </div>

        <div className="right">
          <FolderSelectPanelHost />

          {/* 載入提示 */}
          <div className="loader-overlay" style={scope.isLoadingData ? undefined : { display: 'none' }}>
            <div className="loader">
              <svg className="spinner" width="32px" height="32px" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
                <circle className="path" fill="none" strokeWidth="3" strokeLinecap="round" cx="33" cy="33" r="30" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* tag-select-panel（9b-2）与 context-menu（9b-2）：元素占位 */}
      <tag-select-panel theme={theme} />
      <context-menu theme={theme} />
    </>
  );
}

export default CollectShell;
