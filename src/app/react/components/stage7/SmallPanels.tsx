import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelState, PanelSnapshot, loadPjson } from '../../store/panelState';
import { useToolbarState } from '../../store/toolbarState';
import { updateSidebarList } from '../../services/sidebarService';
import { calculateImageBinding } from '../../services/gridBindingService';
import { saveFolder } from '../../services/folderService';
import { t } from '../../global/eagleGlobals';
import { filesize } from '../../app/filters';
import { useTippy } from '../hooks';
import { CornerBtns } from '../toolbar/Toolbar';
import { getIpc, getCurrentWindow, req } from '../detail/detailHooks';

import { syncPanelFromScope } from '../../store/panelState';
import { getBodyScope, getRootScope, runInBodyScope } from '../../core/appCore';
import { changeOrderBy } from '../../core/miscDomain';
import { switchGridLayout, switchJustifiedLayout, switchListLayout, switchSquareLayout } from '../../services/viewOpsService';

import { showListSubfolderContent } from '../../services/folderMenuService';
import { openApplicationContextMenu } from '../../services/miscMenuService';
import { switchLibrary } from '../../services/folderCoreService';
import { openAboutPanelChannel, openLayoutPanelChannel, openMousewheelPreferenceWindowChannel, openNotificationChannel, setFolderPasswordChannel } from '../../global/bus';
import { scopeEvalAsync } from '../../core/scopeRuntime';
import { q, qa, isVisible, widthOf, heightOf, addClass, removeClass } from '../../utils/domQuery';

import { machineryChangeMetaItems, machineryRebindRefresh } from '../../core/itemDomain';
/**
 * 阶段7c-1：小弹窗族接管。
 *
 * 规范 = js/directives/layout-panel.html、notification-modal.html、
 * new-version-notification-modal.html、folder-password-modal.html、
 * mousewheel-setting-modal.html、about-panel.html、welcome-page.html 逐字转写；
 * link 逻辑 = bundle 62723-63187。触发通道不变（OPEN_LAYOUT_PANEL / OPEN_NOTIFICATION /
 * SET-FOLDER-PASSWORD / OPEN_MOUSEWHEEL_PREFERENCE_WINDOW / OPEN_ABOUT_PANEL 广播与
 * show-update-message / app-status-welcome 等 ipc）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;

const call = (fn: string | ((...a: any[]) => any), ...preArgs: any[]) => (e?: any) =>
  runInBodyScope((scope) => {
    const target = typeof fn === 'function' ? fn : scope[fn];
    if (typeof target === 'function') target(...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });

/** global.js 的 moveToCursorPosition（const，window 上不可达，按原文转写）。 */
function movePanelToCursorPosition(el: HTMLElement) {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const containerWidth = widthOf(el);
  const containerHeight = heightOf(el);
  const w = window as any;
  let x = w.windowMouseX + 10;
  let y = w.windowMouseY - 10;

  if (w.windowMouseX + containerWidth > windowWidth) {
    x = w.windowMouseX - containerWidth - 20;
    x = x < 20 ? 20 : x;
  }

  if (w.windowMouseY + containerHeight > windowHeight - 20) {
    y = windowHeight - containerHeight - 20;
    y = y < 20 ? 20 : y;
  } else if (w.windowMouseY - 56 < 0) {
    y = 36;
  }

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function usePortalHost(hostId: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById(hostId));
  }, [hostId]);
  return host;
}

/* ---------------- layout-panel（62723-62776 + 模板 235 行逐字） ---------------- */

const LAYOUT_OPTIONS = ['GridLayout', 'JustifiedLayout', 'SquareLayout', 'ListLayout'];
const FOLDER_ORDER_BY = ['', 'MANUAL', 'IMPORT', 'MTIME', 'BTIME', 'NAME', 'EXT', 'FILESIZE', 'RESOLUTION', 'RATING', 'DURATION', 'RANDOM'];
const SMART_ORDER_BY = ['DEFAULT', 'IMPORT', 'MTIME', 'BTIME', 'NAME', 'EXT', 'FILESIZE', 'RESOLUTION', 'RATING', 'DURATION', 'RANDOM'];
const ALL_ORDER_BY = ['IMPORT', 'MTIME', 'BTIME', 'NAME', 'EXT', 'FILESIZE', 'RESOLUTION', 'RATING', 'DURATION'];
const META_TYPES = ['RESOLUTION', 'FILESIZE', 'TAGS', 'RATING', 'MTIME', 'BTIME'];

function OrderIcon({ theme, type }: { theme: string; type: string }) {
  const map: Record<string, string> = {
    IMPORT: 'ic-prop-importAt.svg',
    MTIME: 'ic-prop-modifiedAt.svg',
    BTIME: 'ic-prop-createdAt.svg',
    NAME: 'ic-prop-name.svg',
    EXT: 'ic-prop-ext.svg',
    FILESIZE: 'ic-prop-fileSize.svg',
    RESOLUTION: 'ic-prop-dimension.svg',
    RATING: 'ic-prop-rating.svg',
    DURATION: 'ic-prop-duration.svg',
    RANDOM: 'ic-prop-shuffle.svg',
  };
  const icon = map[type];
  if (!icon) return null;
  return <img src={iconSrc(theme, icon)} />;
}

function Toggle({ checked, onClick }: { checked: boolean; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <label className="toggle" onClick={(e) => e.preventDefault()}>
      <input type="checkbox" checked={checked} readOnly />
      <span className="slider" onClick={onClick as any} />
    </label>
  );
}

export function LayoutPanel() {
  const { snapshot } = usePanelState();
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const host = usePortalHost('eagle-layout-panel-host');
  const { theme } = snapshot;

  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = openLayoutPanelChannel.on(() => {
      const el = panelRef.current;
      if (el) movePanelToCursorPosition(el);
      setOpen(true);
      setTimeout(() => searchRef.current?.focus(), 50);
    });
    return () => off();
  }, []);

  const closePanel = () => {
    setOpen(false);
    searchRef.current?.blur();
  };

  useEffect(() => {
    const input = searchRef.current;
    if (!input || !open) return;
    const onKeyup = (event: any) => {
      if (event.keyCode === 27) {
        event.stopPropagation();
        closePanel();
      }
    };
    input.addEventListener('keyup', onKeyup);
    return () => input.removeEventListener('keyup', onKeyup);
  }, [open]);

  const onLayoutChange = (layout: string) => {
    runInBodyScope((s) => {
      s.layout = layout;
      switch (layout) {
        case 'GridLayout':
          switchGridLayout();
          break;
        case 'JustifiedLayout':
          switchJustifiedLayout();
          break;
        case 'SquareLayout':
          switchSquareLayout();
          break;
        case 'ListLayout':
          switchListLayout();
          break;
      }
    });
  };

  const writeOrderBy = (model: 'currentFolder' | 'currentSmartFolder' | 'currentOrderBy', value: string) => {
    runInBodyScope((s) => {
      if (model === 'currentOrderBy') {
        s.currentOrderBy = value;
      } else if (s[model]) {
        s[model].orderBy = value === 'DEFAULT' ? '' : value;
      }
      changeOrderBy(value === 'DEFAULT' ? '' : value);
    });
  };

  const orderByLabel = (key: string): string => {
    const map: Record<string, string> = {
      DEFAULT: 'context.order.orderBy>default',
      MANUAL: 'context.order.orderBy>manual',
      IMPORT: 'context.order.orderBy>import',
      MTIME: 'context.order.orderBy>mtime',
      BTIME: 'context.order.orderBy>btime',
      NAME: 'context.order.orderBy>name',
      EXT: 'context.order.displayItems>ext',
      FILESIZE: 'context.order.orderBy>filesize',
      RESOLUTION: 'context.order.orderBy>resolution',
      RATING: 'context.order.orderBy>rating',
      DURATION: 'context.order.orderBy>duration',
      RANDOM: 'appmenu.view>random',
    };
    return t(map[key] || 'context.order.orderBy>default');
  };

  return host
    ? createPortal(
        <div id="layout-panel" className={`layout-panel${open ? ' open' : ''}`} ref={panelRef}>
          <input id="layout-panel-search" type="text" className="shortcut-input" ref={searchRef} />
          <div className="layout-panel-container">
            {/* 佈局方式 */}
            <div className="panel-item">
              <div className="label">{t('layoutPanel.label.layout')}</div>
              <div className="value">
                <div className="select select-xs" onClick={(e) => e.stopPropagation()}>
                  <select tabIndex={-1} value={snapshot.layout} onChange={(e) => onLayoutChange(e.target.value)}>
                    {LAYOUT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {orderByLabel(option === 'GridLayout' ? 'MANUAL' : option)}
                      </option>
                    ))}
                  </select>
                  <div className="select-content">
                    <div className="select-value">
                      {snapshot.layout === 'GridLayout' && <img src={iconSrc(theme, 'ic-layout-pinterest.svg')} />}
                      {snapshot.layout === 'JustifiedLayout' && <img src={iconSrc(theme, 'ic-layout-justified.svg')} />}
                      {snapshot.layout === 'SquareLayout' && <img src={iconSrc(theme, 'ic-layout-grid.svg')} />}
                      {snapshot.layout === 'ListLayout' && <img src={iconSrc(theme, 'ic-layout-list.svg')} />}
                      {t(
                        snapshot.layout === 'GridLayout'
                          ? 'context.order.layout>grid'
                          : snapshot.layout === 'JustifiedLayout'
                          ? 'context.order.layout>justified'
                          : snapshot.layout === 'SquareLayout'
                          ? 'context.order.layout>square'
                          : 'context.order.layout>list'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 填充方式 */}
            <div
              className="panel-item"
              style={{ marginTop: 8, ...(snapshot.layout === 'SquareLayout' ? undefined : { display: 'none' }) }}
            >
              <div className="label">{t('layoutPanel.label.fill')}</div>
              <div className="value">
                <div className="btn-group label-mode">
                  <div
                    className={`btn${snapshot.layoutOptions === 'Fit' ? ' active' : ''}`}
                    onClick={(e) => call('switchLayoutOtpions', 'Fit')(e)}
                  >
                    {t('context.order.layoutOptions>fit')}
                  </div>
                  <div
                    className={`btn${snapshot.layoutOptions === 'Fill' ? ' active' : ''}`}
                    onClick={(e) => call('switchLayoutOtpions', 'Fill')(e)}
                  >
                    {t('context.order.layoutOptions>fill')}
                  </div>
                </div>
              </div>
            </div>

            {/* 縮略圖選項 */}
            <div className="panel-item" style={{ marginTop: 8 }}>
              <div className="label">{t('layoutPanel.label.thumbnail')}</div>
              <div className="value">
                <div className="btn-group label-mode">
                  <div
                    className={`btn${!snapshot.showOriginalImageWhenLarge ? ' active' : ''}`}
                    onClick={(e) => call('toggleShowOriginalImageWhenLarge')(e)}
                  >
                    {t('layoutPanel.label.thumbnail>speed')}
                  </div>
                  <div
                    className={`btn${snapshot.showOriginalImageWhenLarge ? ' active' : ''}`}
                    onClick={(e) => call('toggleShowOriginalImageWhenLarge')(e)}
                  >
                    {t('layoutPanel.label.thumbnail>quality')}
                  </div>
                </div>
              </div>
            </div>
            <div className="separator" />

            {/* 排列方式 */}
            <div className="panel-item">
              <div className="label">{t('layoutPanel.label.sortBy')}</div>
              <div className="value">
                {snapshot.currentFolder && (
                  <div className="select select-xs" onClick={(e) => e.stopPropagation()}>
                    <select
                      tabIndex={-1}
                      value={snapshot.currentFolder.orderBy || ''}
                      onChange={(e) => writeOrderBy('currentFolder', e.target.value)}
                    >
                      {FOLDER_ORDER_BY.map((option) => (
                        <option key={option || 'DEFAULT'} value={option}>
                          {orderByLabel(option || 'DEFAULT')}
                        </option>
                      ))}
                    </select>
                    <div className="select-content">
                      <div className="select-value">
                        <OrderIcon theme={theme} type={snapshot.currentFolder.orderBy || ''} />
                        {orderByLabel(snapshot.currentFolder.orderBy || 'DEFAULT')}
                      </div>
                    </div>
                  </div>
                )}
                {snapshot.currentSmartFolder && (
                  <div className="select select-xs" onClick={(e) => e.stopPropagation()}>
                    <select
                      tabIndex={-1}
                      value={snapshot.currentSmartFolder.orderBy || 'DEFAULT'}
                      onChange={(e) => writeOrderBy('currentSmartFolder', e.target.value)}
                    >
                      {SMART_ORDER_BY.map((option) => (
                        <option key={option} value={option}>
                          {orderByLabel(option)}
                        </option>
                      ))}
                    </select>
                    <div className="select-content">
                      <div className="select-value">
                        <OrderIcon theme={theme} type={snapshot.currentSmartFolder.orderBy || ''} />
                        {orderByLabel(snapshot.currentSmartFolder.orderBy || 'DEFAULT')}
                      </div>
                    </div>
                  </div>
                )}
                {!snapshot.currentFolder && !snapshot.currentSmartFolder && (
                  <div className="select select-xs" onClick={(e) => e.stopPropagation()}>
                    <select tabIndex={-1} value={snapshot.currentOrderBy} onChange={(e) => writeOrderBy('currentOrderBy', e.target.value)}>
                      {ALL_ORDER_BY.map((option) => (
                        <option key={option} value={option}>
                          {orderByLabel(option)}
                        </option>
                      ))}
                    </select>
                    <div className="select-content">
                      <div className="select-value">
                        <OrderIcon theme={theme} type={snapshot.currentOrderBy} />
                        {orderByLabel(snapshot.currentOrderBy)}
                      </div>
                    </div>
                  </div>
                )}
                <div className="btn-group">
                  <div
                    className={`btn${snapshot.currentSortIncrease ? ' active' : ''}`}
                    onClick={(e) => call('changeSortIncrease', true)(e)}
                    tippy=""
                    tippy-placement="bottom"
                    tippy-content={t('context.order.orderBy>increase')}
                  >
                    <img src={iconSrc(theme, 'ic-sortIncreace.svg')} />
                  </div>
                  <div
                    className={`btn${!snapshot.currentSortIncrease ? ' active' : ''}`}
                    onClick={(e) => call('changeSortIncrease', false)(e)}
                    tippy=""
                    tippy-placement="bottom"
                    tippy-content={t('context.order.orderBy>decrease')}
                  >
                    <img src={iconSrc(theme, 'ic-sortDecreace.svg')} />
                  </div>
                </div>
              </div>
            </div>
            <div className="separator" />

            {/* 顯示/隱藏信息 */}
            <div className="panel-item" onClick={() => call('showListName')()}>
              <div className="label">{t('layoutPanel.label.showName')}</div>
              <div className="value">
                <Toggle checked={snapshot.showName} />
              </div>
            </div>
            <div
              className="panel-item"
              onClick={(e) => {
                e.stopPropagation();
                call('showListMetas')(e);
              }}
            >
              <div className="label">{t('layoutPanel.label.showInfo')}</div>
              <div className="value">
                <div className="select select-xs" onClick={(e) => e.stopPropagation()} style={snapshot.showMetas ? undefined : { display: 'none' }}>
                  <select
                    tabIndex={-1}
                    value={snapshot.listMetaType}
                    onChange={(e) =>
                      runInBodyScope((s) => {
                        // b1-9bz-C-4：原经 $watch("listMetaType") 间接触发 —— 改显式调用
                        // machineryChangeMetaItems（其内部本身就写 s.listMetaType）。
                        machineryChangeMetaItems(s, e.target.value);
                      })
                    }
                  >
                    {META_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {t(`context.order.metaItems>${option === 'FILESIZE' ? 'fileSize' : option.toLowerCase()}`)}
                      </option>
                    ))}
                  </select>
                  <div className="select-content">
                    <div className="select-value">
                      <OrderIcon theme={theme} type={snapshot.listMetaType} />
                      {t(`context.order.metaItems>${snapshot.listMetaType === 'FILESIZE' ? 'fileSize' : snapshot.listMetaType.toLowerCase()}`)}
                    </div>
                  </div>
                </div>
                <Toggle checked={snapshot.showMetas} onClick={() => call('showListMetas')()} />
              </div>
            </div>
            <div className="panel-item" onClick={() => call('showListExtension')()}>
              <div className="label">{t('layoutPanel.label.showExtension')}</div>
              <div className="value">
                <Toggle checked={snapshot.showFileExtension} />
              </div>
            </div>
            <div className="panel-item" onClick={() => call('showListExtensionLabel')()}>
              <div className="label">{t('layoutPanel.label.showExtensionLabel')}</div>
              <div className="value">
                <Toggle checked={snapshot.showFileExtensionLabel} />
              </div>
            </div>
            <div className="panel-item" onClick={() => call('showListAnnotation')()}>
              <div className="label">{t('layoutPanel.label.showAnnotation')}</div>
              <div className="value">
                <Toggle checked={snapshot.showAnnotation} />
              </div>
            </div>
            <div className="panel-item" onClick={() => call(showListSubfolderContent)()}>
              <div className="label">{t('layoutPanel.label.showSubFolder')}</div>
              <div className="value">
                <Toggle checked={snapshot.showSubfolderContent} />
              </div>
            </div>
            <div className="separator" />
            <div className="panel-item" onClick={() => call('toggleSidebar')()}>
              <div className="label">{t('layoutPanel.label.showSidebar')}</div>
              <div className="value">
                <Toggle checked={!snapshot.isHideSidebar} />
              </div>
            </div>
            <div
              className="panel-item"
              onClick={() =>
                runInBodyScope((s) => {
                  if (s.inspector && typeof s.inspector.toggle === 'function') s.inspector.toggle();
                })
              }
            >
              <div className="label">{t('layoutPanel.label.showInspector')}</div>
              <div className="value">
                <Toggle checked={!snapshot.inspectorHide} />
              </div>
            </div>
            <div className="separator" />
            <div className="button button-xs button-block button-grey" style={{ margin: 0 }} onClick={call('reload')}>
              {t('context.order.refresh')}
            </div>
          </div>
        </div>,
        host
      )
    : null;
}

/* ---------------- notification-modal（62777-62813） ---------------- */

export function NotificationModal() {
  const { snapshot } = usePanelState();
  // b1-9ba：应用侧 OPEN_NOTIFICATION 发送面随 bundle 摘除死亡，但 7c 契约
  // （广播→弹窗开）仍锁定本监听——保留，通知竖切时随发送面重建一并归位。
  const [isOpen, setOpen] = useState(false);
  const host = usePortalHost('eagle-notification-host');
  const { theme } = snapshot;

  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = openNotificationChannel.on(() => setOpen(true));
    return () => off();
  }, []);

  const getPageUrl = () => {
    const s = getBodyScope() || {};
    const version = encodeURIComponent(s.appVersion || '');
    const buildVersion = encodeURIComponent(s.buildVersion || '');
    switch (snapshot.language) {
      case 'zh_CN':
        return `https://core.eagle.cool/app-notifications?theme=${s.theme}&version=${version}&buildVersion=${buildVersion}`;
      case 'zh_TW':
        return `https://tw.eagle.cool/app-notifications?theme=${s.theme}&version=${version}&buildVersion=${buildVersion}`;
      case 'ja_JP':
        return `https://jp.eagle.cool/app-notifications?theme=${s.theme}&version=${version}&buildVersion=${buildVersion}`;
      default:
        return `https://en.eagle.cool/app-notifications?theme=${s.theme}&version=${version}&buildVersion=${buildVersion}`;
    }
  };

  return host
    ? createPortal(
        <>
          <div className={`notification-modal modal${isOpen ? ' open' : ''}`} style={!isOpen ? { display: 'none' } : undefined}>
            <div className="modal-header">
              <div className="name">{t('modal.notification.title')}</div>
              <div className="close" onClick={() => setOpen(false)} />
            </div>
            <div className="modal-content">
              <iframe src={getPageUrl()} />
            </div>
          </div>
          <div className="notification-modal-overlay modal-overlay" style={!isOpen ? { display: 'none' } : undefined} onClick={() => setOpen(false)} />
        </>,
        host
      )
    : null;
}

/* ---------------- new-version-notification-modal（62814-62887） ---------------- */

export function NewVersionModal() {
  const { snapshot } = usePanelState();
  const [isOpen, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [detail, setDetail] = useState('');
  const [version, setVersion] = useState('');
  const [size, setSize] = useState(0);
  const host = usePortalHost('eagle-newversion-host');
  const { theme } = snapshot;

  useEffect(() => {
    let pjson: any = null;
    (async () => {
      pjson = await loadPjson();
    })();
    const ipc = getIpc();
    const handler = (event: any, updateResult: any) => {
      console.log(updateResult);
      if (!updateResult) return;
      let content = updateResult.content;
      switch (snapshot.language) {
        case 'zh_TW':
          content = updateResult.contentZH || updateResult.content;
          break;
        case 'zh_CN':
          content = updateResult.contentCN || updateResult.content;
          break;
        case 'ja_JP':
          content = updateResult.contentJP || updateResult.content;
          break;
      }
      setDetail(content);
      setVersion(updateResult.version);
      setSize(process.platform === 'darwin' ? updateResult.file?.size || 0 : updateResult.windows?.size || 0);
      setResult(updateResult);
      setOpen(true);
      scopeEvalAsync();
      void pjson;
    };
    ipc?.on?.('show-update-message', handler);
    return () => {
      try {
        ipc?.removeListener?.('show-update-message', handler);
      } catch (err) {}
    };
  }, [snapshot.language]);

  const download = () => {
    const shell = req('electron')?.shell;
    if (process.platform === 'darwin') {
      shell?.openExternal('https:' + result?.dmg?.url);
    } else {
      shell?.openExternal('https:' + result?.windows?.url);
    }
  };

  const cancel = () => {
    localStorage['lastCheckForUpdateTime'] = String(Date.now());
    setOpen(false);
  };

  return host
    ? createPortal(
        <>
          <div className={`modal new-version-notification-modal${isOpen ? ' open' : ''}`} style={!isOpen ? { display: 'none' } : undefined}>
            <div className="modal-header">
              <div className="name">
                {t('modal.updateApp.title')} {version}{' '}
                <span className="sub-title">
                  / {t('modal.updateApp.desc')} {(window as any).__eaglePjson?.prerelease || (window as any).__eaglePjson?.version || ''}
                </span>
              </div>
              <div className="close" onClick={() => setOpen(false)} />
            </div>
            <div className="content section">
              <div className="update-message" dangerouslySetInnerHTML={{ __html: detail }} />
            </div>
            <div className="section darken textAlign-right">
              <div className="button button-s button-primary fontWeight-bold" onClick={download}>
                <img src="assets/images/base/icons/ic-download.svg" />
                {t('modal.updateApp.installBtn')}（{t('modal.updateApp.aboutSize')} {filesize(size)}）
              </div>
              <div className="button button-s button-grey" onClick={cancel}>
                <img src={iconSrc(theme, 'ic-remind-later.svg')} />
                {t('modal.updateApp.remindBtn')}
              </div>
            </div>
          </div>
          <div className="modal-overlay" style={!isOpen ? { display: 'none' } : undefined} onClick={() => setOpen(false)} />
        </>,
        host
      )
    : null;
}

/* ---------------- folder-password-modal（62888-63048） ---------------- */

export function FolderPasswordModal() {
  const [isOpen, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'change' | 'reset'>('change');
  const [folder, setFolder] = useState<any>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRePassword, setNewRePassword] = useState('');
  const [passwordTips, setPasswordTips] = useState('');
  const host = usePortalHost('eagle-folder-password-host');

  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = setFolderPasswordChannel.on((params: any) => {
      setFolder(params.folder);
      setMode(params.mode);
      setOpen(true);
      setTimeout(() => {
        qa('.folder-password-modal input').filter(isVisible)[0]?.focus();
      }, 300);
    });
    return () => off();
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setOldPassword('');
      setNewPassword('');
      setNewRePassword('');
      setPasswordTips('');
    }, 200);
  };

  const shake = (selector: string) => {
    q(selector)?.focus();
    addClass(selector, 'animation--shake-horizontal constant');
    setTimeout(() => {
      removeClass(selector, 'animation--shake-horizontal constant');
    }, 350);
  };

  const save = () => {
    const s = getBodyScope();
    const Registration = s?.Registration;
    const electronLog = (window as any).electronLog;
    if (mode === 'new') {
      if (newPassword && newRePassword && newPassword === newRePassword) {
        const encoded = window.btoa(newPassword);
        folder.password = encoded;
        folder.isUnlock = false;
        folder.passwordTips = passwordTips;
        updateSidebarList();
        calculateImageBinding({ ignoreSort: true }, () => {
          machineryRebindRefresh(s);
        });
        saveFolder();
        close();
        electronLog && electronLog.info(`[app] 设置文件夹密码：${folder.name}(${folder.id})`);
      } else {
        shake('#new-folder-password-input');
      }
    } else if (mode === 'change') {
      if (oldPassword && newPassword && newRePassword && newPassword === newRePassword) {
        if (oldPassword === window.atob(folder.password || '') || (oldPassword && oldPassword === Registration?.license?.code)) {
          const encoded = window.btoa(newPassword);
          folder.password = encoded;
          folder.isUnlock = false;
          folder.passwordTips = passwordTips;
          calculateImageBinding({ ignoreSort: true }, () => {
            machineryRebindRefresh(s);
          });
          saveFolder();
          close();
          electronLog && electronLog.info(`修改文件夹密码：${folder.name}(${folder.id})`);
        } else {
          shake('#change-folder-password-input');
        }
      }
    } else if (mode === 'reset') {
      if (
        (oldPassword && oldPassword === window.atob(folder.password || '')) ||
        (oldPassword && oldPassword === Registration?.license?.code)
      ) {
        delete folder.password;
        delete folder.isUnlock;
        delete folder.passwordTips;
        updateSidebarList();
        calculateImageBinding({ ignoreSort: true }, () => {
          machineryRebindRefresh(s);
        });
        saveFolder();
        close();
        electronLog && electronLog.info(`移除文件夹密码：${folder.name}(${folder.id})`);
      } else {
        shake('#reset-folder-password-input');
      }
    }
  };

  return host
    ? createPortal(
        <>
          <div className={`modal folder-password-modal${isOpen ? ' open' : ''}`} style={!isOpen ? { display: 'none' } : undefined}>
            <div className="modal-header">
              <div className="name">{t('context.folder.password')}</div>
              <div className="close" onClick={close} />
            </div>
            <div className="section">
              <div style={mode === 'new' ? undefined : { display: 'none' }}>
                <label>{t('modal.folderPassword.password')}</label>
                <input
                  id="new-folder-password-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder=""
                />
                <div className="margin-bottom-12" />
                <label>{t('modal.folderPassword.rePassword')}</label>
                <input
                  type="password"
                  value={newRePassword}
                  onChange={(e) => setNewRePassword(e.target.value)}
                  placeholder=""
                />
                <div className="margin-bottom-12" />
                <label>{t('modal.folderPassword.passwordTips')}</label>
                <textarea
                  cols={30}
                  rows={2}
                  placeholder=""
                  value={passwordTips}
                  onChange={(e) => setPasswordTips(e.target.value)}
                />
              </div>

              <div style={mode === 'change' ? undefined : { display: 'none' }}>
                <label>{t('modal.folderPassword.oldPassword')}</label>
                <input
                  id="change-folder-password-input"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder=""
                />
                <div className="margin-bottom-12" />
                <label>{t('modal.folderPassword.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder=""
                />
                <div className="margin-bottom-12" />
                <label>{t('modal.folderPassword.rePassword')}</label>
                <input
                  type="password"
                  value={newRePassword}
                  onChange={(e) => setNewRePassword(e.target.value)}
                  placeholder=""
                />
                <div className="margin-bottom-12" />
                <label>{t('modal.folderPassword.passwordTips')}</label>
                <textarea
                  cols={30}
                  rows={2}
                  placeholder=""
                  value={passwordTips}
                  onChange={(e) => setPasswordTips(e.target.value)}
                />
              </div>

              <div style={mode === 'reset' ? undefined : { display: 'none' }}>
                <label>{t('modal.folderPassword.currentPassword')}</label>
                <input
                  id="reset-folder-password-input"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="section darken textAlign-right">
              {mode === 'new' && (
                <div className="button button-s button-block button-primary" onClick={save}>
                  {t('modal.folderPassword.saveNew')}
                </div>
              )}
              {mode === 'change' && (
                <div className="button button-s button-block button-primary" onClick={save}>
                  {t('modal.folderPassword.saveChange')}
                </div>
              )}
              {mode === 'reset' && (
                <div className="button button-s button-block button-primary" onClick={save}>
                  {t('modal.folderPassword.saveReset')}
                </div>
              )}
            </div>
          </div>
          <div className="modal-overlay" style={!isOpen ? { display: 'none' } : undefined} onClick={close} />
        </>,
        host
      )
    : null;
}

/* ---------------- mousewheel-setting-modal（63049-63077） ---------------- */

export function MousewheelModal() {
  const { snapshot } = usePanelState();
  const [isOpen, setOpen] = useState(false);
  const [mode, setMode] = useState('zoom');
  const host = usePortalHost('eagle-mousewheel-modal-host');

  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = openMousewheelPreferenceWindowChannel.on(() => {
      setOpen(true);
      scope.$evalAsync?.();
    });
    return () => off();
  }, []);

  const save = () => {
    setOpen(false);
    const root = getRootScope();
    if (root) {
      root.preferences.habits.scrollBehaviorTour = true;
      root.preferences.habits.scrollBehavior = mode;
    }
    getIpc()?.send?.('chnage-scrollBehavior', mode);
  };

  return host
    ? createPortal(
        <>
          <div className={`modal mousewheel-setting-modal${isOpen ? ' open' : ''}`} style={!isOpen ? { display: 'none' } : undefined}>
            <div className="content">
              <h2>{t('MousewheeloWindow.title')}</h2>
              <p>{t('MousewheeloWindow.desc')}</p>
              <div className="items">
                {[
                  { id: 'scroll', label: 'MousewheeloWindow.modeScroll', img: 'illustration-mousewhell-scroll.png' },
                  { id: 'zoom', label: 'MousewheeloWindow.modeZoom', img: 'illustration-mousewhell-zoom.png' },
                  { id: 'paging', label: 'MousewheeloWindow.modePaging', img: 'illustration-mousewhell-paging.png' },
                ].map((item) => (
                  <div
                    key={item.id}
                    className={`item${mode === item.id ? ' active' : ''}`}
                    onClick={() => setMode(item.id)}
                  >
                    <div className="thumbnail">
                      <img
                        src={`assets/images/${themePathOf(snapshot.theme)}/illustrations/${item.img}`}
                        width={192}
                        height={192}
                      />
                    </div>
                    <div className="label">{t(item.label)}</div>
                  </div>
                ))}
              </div>
              <div className="tips" dangerouslySetInnerHTML={{ __html: t('MousewheeloWindow.tips') }} />
              <div className="button button-m button-primary" onClick={save}>
                {t('MousewheeloWindow.saveBtn')}
              </div>
            </div>
          </div>
          <div className="modal-overlay" style={!isOpen ? { display: 'none' } : undefined} onClick={() => setOpen(false)} />
        </>,
        host
      )
    : null;
}

/* ---------------- about-panel（63078-63101） ---------------- */

export function AboutPanel() {
  const [open, setOpen] = useState(false);
  const [pjson, setPjson] = useState<any>(null);
  const host = usePortalHost('eagle-about-host');

  useEffect(() => {
    (async () => setPjson(await loadPjson()))();
    const scope = getBodyScope();
    if (!scope) return;
    const off = openAboutPanelChannel.on(() => setOpen(true));
    return () => off();
  }, []);

  return host
    ? createPortal(
        <>
          <div id="about-panel" className={`about-panel${open ? ' open' : ''}`}>
            <div className="about-panel-header">
              <div className="close" onClick={() => setOpen(false)} />
            </div>
            <div className="about-panel-content">
              <img src="assets/images/base/logo_80.png" className="logo" />
              <div className="title">Eagle</div>
              <div className="sub-title">{t('aboutWindow.title')}</div>
              <div className="meta">
                <div className="version">
                  {pjson?.version || ''} Build{pjson?.buildNumber || ''} ({pjson?.buildVersion || ''})
                </div>
              </div>
              <div className="button button-primary" onClick={() => setOpen(false)}>
                {t('general.ok')}
              </div>
              <div className="copyright">Copyright © 2017-2026 OGDESIGN</div>
            </div>
          </div>
          <div className="about-panel-overlay" onClick={() => setOpen(false)} />
        </>,
        host
      )
    : null;
}

/* ---------------- welcome-page（63102-63186 + 模板逐字） ---------------- */

export function WelcomePage() {
  const { snapshot } = usePanelState();
  const toolbarSnapshot = useToolbarState((s: any) => s.snapshot);
  const [isOpen, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [currentTheme, setCurrentTheme] = useState('DARK');
  const [libraryMissed, setLibraryMissed] = useState(false);
  const [libraryPath, setLibraryPath] = useState('');
  const host = usePortalHost('eagle-welcome-host');
  const tippyRef = useRef<HTMLDivElement>(null);
  useTippy(tippyRef, JSON.stringify([step, currentTheme]));
  const { theme, platform } = snapshot;

  useEffect(() => {
    loadPjson();
    const ipc = getIpc();
    const win = getCurrentWindow();
    const onWelcome = (e: any, params: any) => {
      win?.setMinimumSize?.(1024, 768);
      setOpen(true);
      document.body.classList.add('is-welcome-page');
      if (params && params.libraryMissed) {
        setStep(5);
        setLibraryPath(params.libraryPath);
        setLibraryMissed(true);
      } else {
        setTimeout(() => setStep(1), 500);
      }
      scopeEvalAsync();
    };
    const onDirsLoaded = () => {
      document.body.classList.remove('is-welcome-page');
      win?.setMinimumSize?.(500, 375);
      setOpen(false);
      scopeEvalAsync();
    };
    const onCacheLoaded = () => {
      document.body.classList.remove('is-welcome-page');
      win?.setMinimumSize?.(500, 375);
      setOpen(false);
      scopeEvalAsync();
    };
    ipc?.on?.('app-status-welcome', onWelcome);
    ipc?.on?.('app-status-library-dirs-loaded', onDirsLoaded);
    ipc?.on?.('app-status-library-cache-loaded', onCacheLoaded);
    return () => {
      try {
        ipc?.removeListener?.('app-status-welcome', onWelcome);
        ipc?.removeListener?.('app-status-library-dirs-loaded', onDirsLoaded);
        ipc?.removeListener?.('app-status-library-cache-loaded', onCacheLoaded);
      } catch (err) {}
    };
  }, []);

  const totalSteps = [1, 2, 3, 4];

  const selectTheme = (next: string) => {
    setCurrentTheme(next);
    const el = document.getElementById('welcome-page');
    el?.classList.add('theme-changing');
    setTimeout(() => el?.classList.remove('theme-changing'), 500);
    getIpc()?.send?.('change-theme', { name: next, css: next.toLowerCase() });
  };

  const next = () => setStep((s) => Math.min(s + 1, totalSteps.length));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const stepCls = (n: number) =>
    `step step${n}${step === n ? ' step-show' : step > n ? ' step-hide' : ''}${
      step < n ? ' step-left' : ''
    }${step > n && n > 1 ? ' step-right' : ''}`;

  return host
    ? createPortal(
        <div id="welcome-page" className="welcome-page" style={!isOpen ? { display: 'none' } : undefined} ref={tippyRef}>
          <div className="welcome-page-header">
            <div className="icon-btn application-menu-btn fixed" onClick={(e) => call(openApplicationContextMenu, e.nativeEvent)(e)}>
              <img src={iconSrc(theme, 'ic-app-menu.svg')} />
            </div>
            <div className="drag-area" />
            <CornerBtns
              snapshot={{ ...(toolbarSnapshot as any), theme, isAlwaysOnTop: toolbarSnapshot.isAlwaysOnTop }}
              hideAlwaysOnTop
            />
          </div>

          <div className="welcome-page-footer" style={step === 5 ? { display: 'none' } : undefined}>
            <div className="ic-btn prev-btn" style={step <= 1 ? { display: 'none' } : undefined} onClick={prev}>
              {t('welcome.prev')}
            </div>
            <div className="pagination">
              {totalSteps.map((n) => (
                <div key={n} className={`dot${step === n ? ' active' : ''}`} onClick={() => setStep(n)} />
              ))}
            </div>
            <div
              className="ic-btn next-btn primary"
              style={step <= 1 || step === totalSteps.length ? { display: 'none' } : undefined}
              onClick={next}
            >
              {t('welcome.next')}
              <img src="assets/images/base/icons/ic-welcome-next.svg" />
            </div>
            <div
              className="ic-btn next-btn primary"
              style={step > 1 || step === totalSteps.length ? { display: 'none' } : undefined}
              onClick={next}
            >
              {t('welcome.start')}
              <img src="assets/images/base/icons/ic-welcome-next.svg" />
            </div>
          </div>

          <div className="welcome-page-container">
            {/* Step1 */}
            <div className={stepCls(1)}>
              <div className="app-logo">
                <img src="assets/images/base/logo_72.png" width={72} height={72} />
              </div>
              <h2>{t('welcome.step1.title')}</h2>
              <p>{t('welcome.step1.desc')}</p>
              <p className="small" dangerouslySetInnerHTML={{ __html: t('welcome.agree') }} />
              <img
                className="hero-image"
                src={`assets/images/${themePathOf(theme)}/illustrations/welcome-hero-${platform}.png`}
                width={1080}
                height={464}
              />
            </div>

            {/* Step2: 設定主題 */}
            <div className={stepCls(2)}>
              <h2>{t('welcome.step2.title')}</h2>
              <p>{t('welcome.step2.desc')}</p>
              <div className="theme-picker">
                {['Auto', 'LIGHT', 'LIGHTGRAY', 'GRAY', 'DARK', 'BLUE', 'PURPLE'].map((option) => (
                  <div
                    key={option}
                    className={`theme-item ${option.toLowerCase()}${currentTheme === option ? ' active' : ''}`}
                    onClick={() => selectTheme(option)}
                    tippy=""
                    tippy-placement="top"
                    tippy-content={t(`preferencesWindow.themes.${option}`)}
                  >
                    <div className="circle" />
                  </div>
                ))}
              </div>
              <img
                className="hero-image"
                src={`assets/images/${themePathOf(theme)}/illustrations/welcome-hero-${platform}.png`}
                width={1080}
                height={464}
              />
            </div>

            {/* Step3: 瀏覽器擴充 */}
            <div className={stepCls(3)}>
              <h2>{t('welcome.step3.title')}</h2>
              <p>{t('welcome.step3.desc')}</p>
              <div className="extension-picker">
                <a
                  className="extension-item"
                  href="https://chrome.google.com/webstore/detail/eagle/lieogkinebikhdchceieedcigeafdkid"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="icon" style={{ backgroundImage: "url('assets/images/base/icons/ic-welcome-extenstion-chrome.png')" }} />
                  <div className="name">Chrome</div>
                  <div className="download" style={{ backgroundImage: `url('${iconSrc(theme, 'ic-welcome-extenstion-download.svg')}')` }} />
                </a>
                <a
                  className="extension-item"
                  href="https://microsoftedge.microsoft.com/addons/detail/cfgchmkedjfehclfhhmgedljhcibojcm"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="icon" style={{ backgroundImage: "url('assets/images/base/icons/ic-welcome-extenstion-edge.png')" }} />
                  <div className="name">Edge</div>
                  <div className="download" style={{ backgroundImage: `url('${iconSrc(theme, 'ic-welcome-extenstion-download.svg')}')` }} />
                </a>
                <a className="extension-item" href="https://apps.apple.com/app/id1526651672" target="_blank" rel="noreferrer">
                  <div className="icon" style={{ backgroundImage: "url('assets/images/base/icons/ic-welcome-extenstion-safari.png')" }} />
                  <div className="name">Safari</div>
                  <div className="download" style={{ backgroundImage: `url('${iconSrc(theme, 'ic-welcome-extenstion-download.svg')}')` }} />
                </a>
                <a className="extension-item" href="https://addons.mozilla.org/firefox/addon/eagle-app/" target="_blank" rel="noreferrer">
                  <div className="icon" style={{ backgroundImage: "url('assets/images/base/icons/ic-welcome-extenstion-firefox.png')" }} />
                  <div className="name">Firefox</div>
                  <div className="download" style={{ backgroundImage: `url('${iconSrc(theme, 'ic-welcome-extenstion-download.svg')}')` }} />
                </a>
                <a className="extension-item other" href="https://eagle.cool/extensions" target="_blank" rel="noreferrer">
                  <div className="name">{t('welcome.step3.others')}</div>
                  <div className="download" style={{ backgroundImage: `url('${iconSrc(theme, 'ic-welcome-extenstion-download.svg')}')` }} />
                </a>
              </div>
              <div className="hero-image-wrap">
                <img
                  className="hero-image"
                  src={`assets/images/${themePathOf(theme)}/illustrations/welcome-extension-${platform}.png`}
                  width={1080}
                  height={464}
                />
                <img
                  className="extension-popup"
                  src={`assets/images/${themePathOf(theme)}/illustrations/welcome-extension-popup.png`}
                  width={270}
                  height={303}
                />
              </div>
            </div>

            {/* Step4: 建立資源庫 */}
            <div className={stepCls(4)}>
              <h2>{t('welcome.step4.title')}</h2>
              <p dangerouslySetInnerHTML={{ __html: t('welcome.step4.desc') }} />
              <div className="hero-image-wrap">
                <img
                  className="hero-image"
                  src={`assets/images/${themePathOf(theme)}/illustrations/welcome-library-${platform}.png`}
                  width={1080}
                  height={380}
                />
                <div className="library-items">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div className="library-item" key={n}>
                      <div className="icon">
                        <img src="assets/images/base/icons/ic-welcome-library-icon.png" width={72} height={72} />
                      </div>
                      <div className="name">{t(`welcome.step4.example${n}`)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="library-controls">
                <div className="buttons">
                  <div className="button button-primary" onClick={call('createLibrary')}>
                    <img src={iconSrc(theme, 'ic-welcome-library-create.svg')} />
                    {t('welcome.step4.create')}
                  </div>
                  <div className="button button-grey" onClick={call('importLibrary')}>
                    <img src={iconSrc(theme, 'ic-welcome-library-import.svg')} />
                    {t('welcome.step4.import')}
                  </div>
                </div>
                <div className="hint-message">{t('welcome.step4.hint')}</div>
              </div>
            </div>

            {/* Step5: 資源庫遺失 */}
            <div className={`step step5${step === 5 ? ' step-show' : ''}`}>
              <h2>{t('libraryMissing.title')}</h2>
              <p>
                {t('libraryMissing.desc1')}
                <b>{libraryPath}</b>
                <span dangerouslySetInnerHTML={{ __html: t('libraryMissing.desc2') }} />
              </p>
              <div className="hero-image-wrap">
                <img
                  className="hero-image"
                  src={`assets/images/${themePathOf(theme)}/illustrations/welcome-library-${platform}.png`}
                  width={1080}
                  height={380}
                />
                <div className="library-items">
                  <div className="library-item">
                    <div className="icon">
                      <img src={`assets/images/base/icons/ic-welcome-library-missing-icon.png`} width={72} height={72} />
                    </div>
                    <div className="name">{libraryMissed ? (window as any).path?.basename?.(libraryPath) || '' : ''}</div>
                  </div>
                </div>
              </div>
              <div className="library-controls">
                <div className="buttons">
                  <div className="button button-primary" onClick={call('refresh')}>
                    {t('libraryMissing.refresh')}
                  </div>
                  <div className="button button-grey" onClick={(e) => call(switchLibrary, e.nativeEvent)(e)}>
                    {t('libraryMissing.reimport')}
                  </div>
                </div>
                <div className="hint-message">
                  {t('libraryMissing.recreateTip')}
                  <a onClick={call('createLibrary')}>{t('libraryMissing.recreateBtn')}</a>
                </div>
              </div>
            </div>
          </div>
        </div>,
        host
      )
    : null;
}
