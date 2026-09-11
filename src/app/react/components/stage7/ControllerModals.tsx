import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { updateSelection } from '../../services/selectionService';
import { t } from '../../global/eagleGlobals';
import { useSidebarState } from '../../store/sidebarState';
import { useToolbarState } from '../../store/toolbarState';
import { usePanelState } from '../../store/panelState';
import { req, getIpc } from '../detail/detailHooks';
import { CornerBtns } from '../toolbar/Toolbar';
import { ayncsImagesChange } from './FolderModals';
import { useVirtualWindow } from '../sidebar/Sidebar';
import { syncErrorCount } from '../../store/toastState';
import { syncUploadFromScope } from '../../store/uploadState';
import { getBodyScope, getRootScope, scopeApply } from '../../core/appCore';

import { uploadFiles } from '../../services/uploadService';
import { cleanAllErrorChannel, openErrorChannel, openUrlInPanelChannel } from '../../global/bus';
import { scopeEvalAsync } from '../../global/scopeShim';

import { machineryUpdateItemView } from '../../core/itemDomain';
import { machineryToggleAll } from '../../services/gridService';
/**
 * 阶段7d-1b：ErrorModalController（bundle 76136-76270）+ WebsitePanelController
 * （bundle 74094-74144，含 websitePanelWebview 指令 74147-74189）接管。
 *
 * 触发通道零改动：OPEN_ERROR / CLEAN_ALL_ERROR 广播、OPEN_URL_IN_PANEL 广播。
 * retryAll 的 DOWNLOAD_ERROR → ipc 'upload-urls'、ADD_ERROR → body scope uploadFiles、
 * EDIT_ERROR → itemMappings 原地 extend + updateItemView/ayncsImagesChange；
 * copyAll → sendTo(backgroundWindowID, 'copy-paths-to-clipboard') + body notify；
 * cleanAll → swal 确认。错误列表保留生产方数组引用（remove/retry 直接 splice），
 * 开启期间以 500ms 轮询同步长度变化（原版由 digest 驱动）。
 * WebsitePanel：webview 指令行为（dom-ready 主题注入 + page-title-updated 标题/前进后退
 * 禁用态）逐字移植；显示条件 viewMode=='community' 与 isUILoaded 经 sidebarState 快照；
 * left = containerSize.sidebar + 1（sidebarWidth 快照即该值）。
 */

const iv = (v: any): any => (v === undefined || v === null ? '' : v);
const ngShow = (show: boolean) => (show ? undefined : { display: 'none' } as React.CSSProperties);
const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

/* ================= ErrorModalController（76136-76270） ================= */

export function ErrorModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const errorListRef = useRef<any[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-error-modal-host'));
  }, []);

  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const offOpen = openErrorChannel.on((params: any) => {
      errorListRef.current = params.errorList;
      setOpen(true);
    });
    const offClean = cleanAllErrorChannel.on((params: any) => {
      errorListRef.current = params.errorList;
      cleanAll();
    });
    return () => {
      offOpen();
      offClean();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // 原版由 digest 驱动生产方 push 的刷新；React 侧开启期间轮询长度
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      bump((v) => v + 1);
    }, 500);
    return () => clearInterval(timer);
  }, [open]);

  const errorList = errorListRef.current;

  /* remove（76155-76160） */
  const remove = (task: any) => {
    const idx = errorListRef.current.indexOf(task);
    if (idx > -1) {
      errorListRef.current.splice(idx, 1);
      syncErrorCount(errorListRef.current);
      bump((v) => v + 1);
    }
  };

  /* openPath（76162-76166） */
  const openPath = (filePath: string) => {
    if (filePath) {
      getIpc().send('show-item-in-folder', req('path').normalize(filePath));
    }
  };

  /* retryAll（76169-76228 逐字） */
  const retryAll = () => {
    const w = window as any;
    const body = getBodyScope();
    const rootScope = getRootScope();
    const urlFiles: any[] = [];
    const localFiles: any[] = [];
    errorListRef.current.forEach((error) => {
      if (error.type === 'DOWNLOAD_ERROR') {
        body.uploadQueue.push({});
        syncUploadFromScope();
        urlFiles.push({
          id: w.guid(),
          url: error.object.url,
          folders: error.object.folders || [],
          tags: error.object.tags || [],
          type: error.object.type || undefined,
          name: error.object.name,
          website: error.object.website || '',
          modificationTime: error.object.modificationTime,
        });
      } else if (error.type === 'ADD_ERROR') {
        localFiles.push({
          id: w.guid(),
          path: error.object.path,
          lastModified: Date.now(),
          folders: error.object.folders || [],
          tags: error.object.tags || [],
          type: error.object.type || undefined,
          name: error.object.name,
          website: error.object.website || '',
          modificationTime: error.object.modificationTime,
        });
      } else if (error.type === 'EDIT_ERROR') {
        try {
          if (error.modifiedData && error.modifiedData.id) {
            // 原版变量名 rootScope 实为 body scope（angular.element("body").scope()）
            const item = body.itemMappings[error.modifiedData.id];
            if (item) {
              Object.assign(item, error.modifiedData);
              machineryUpdateItemView(body, item);
              updateSelection();
              if (typeof body.$evalAsync === 'function') scopeEvalAsync();
              ayncsImagesChange([item]);
            }
          }
        } catch (err) {}
      }
    });

    if (urlFiles.length > 0) {
      getIpc().send('upload-urls', urlFiles);
    }

    if (localFiles.length > 0) {
      uploadFiles(localFiles);
    }

    errorListRef.current.length = 0;
    syncErrorCount(errorListRef.current);
    close();
    bump((v) => v + 1);
  };

  /* copyAll（76230-76242） */
  const copyAll = () => {
    const body = getBodyScope();
    const paths: string[] = [];
    errorListRef.current.forEach((error) => {
      if (error.object.path) {
        paths.push(error.object.path);
      }
    });
    getIpc().sendTo((window as any).backgroundWindowID, 'copy-paths-to-clipboard', paths);
    body.notify({
      message: t('previewWindow.copied'),
      duration: 1000,
    });
  };

  /* cleanAll（76245-76265） */
  const cleanAll = () => {
    const w = window as any;
    w.swal({
      html: `
                <div class="alert">
                    <div class="alert-icon warning"></div>
                    <h4 class="alert-title">${t('dialog.importErrorRemoveAll.title')}</h4>
                    <p class="alert-desc">${t('dialog.importErrorRemoveAll.desc')}</p>
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
      confirmButtonText: t('dialog.importErrorRemoveAll.button'),
      cancelButtonText: t('general.cancel'),
    }).then(() => {
      errorListRef.current.length = 0;
      syncErrorCount(errorListRef.current);
      close();
      const body = getBodyScope();
      if (body && typeof body.$evalAsync === 'function') scopeEvalAsync();
      bump((v) => v + 1);
    });
  };

  const close = () => {
    setOpen(false);
  };

  /* 渲染（index.html ErrorModalController 模板逐字；ng-if="isOpen" → 条件渲染） */
  const sizes = useMemo(() => errorList.map(() => 60), [errorList.length, open]);
  const win = useVirtualWindow(listRef, sizes, `${errorList.length}:${open}`);
  const windowed = errorList.slice(win.startIndex, win.endIndex);

  if (!host) return null;

  return createPortal(
    open ? (
      <>
        <div className="modal error-modal">
          <table>
            <tbody>
              <tr className="header">
                <td className="name">{t('modal.importError.thead.name')}</td>
                <td className="origin">{t('modal.importError.thead.origin')}</td>
                <td className="reason">{t('modal.importError.thead.reason')}</td>
                <td className="icon"></td>
                <td width="10px" style={ngShow(errorList.length > 10)}></td>
              </tr>
            </tbody>
          </table>
          <div className="error-list">
            <div className="table" ref={listRef}>
              <div className="vs-repeat-before-content" style={{ height: `${win.beforeSize}px` }} />
              {windowed.map((error, idx) => (
                <div className="tr" key={idx}>
                  {error.type === 'DOWNLOAD_ERROR' ? (
                    <div className="td name">
                      <a href={iv(error.object.website)} target="_blank">
                        {iv(error.object.name)}
                      </a>
                    </div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' ? (
                    <div className="td origin">
                      {error.object.url ? (
                        <a href={iv(error.object.url)} target="_blank" title={iv(error.object.url)}>
                          {iv(error.object.url)}
                        </a>
                      ) : (
                        <a>-</a>
                      )}
                    </div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' && error.reason == 'BASE64_ERROR' ? (
                    <div className="td reason">{t('modal.importError.reason.base64')}</div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' && error.reason == 'NETWORK_TIMEOUT' ? (
                    <div className="td reason">{t('modal.importError.reason.timeout')}</div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' && error.reason == 'NO_FILE' ? (
                    <div className="td reason" dangerouslySetInnerHTML={{ __html: t('modal.importError.reason.noFile') }}></div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' && error.reason == 'UNRECOGNIZED' ? (
                    <div className="td reason">{t('modal.importError.reason.unrecognized')}</div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' && error.reason == 'HTTP_ERROR' ? (
                    <div className="td reason">
                      {t('modal.importError.reason.httpError')}
                      {error.detail ? <span>，{iv(error.detail)}</span> : null}
                    </div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' && error.reason == 'CONTENT_TYPE_BLOCKED' ? (
                    <div className="td reason">
                      {t('modal.importError.reason.contentTypeBlocked')}
                      {error.detail ? <span> ({iv(error.detail)})</span> : null}
                    </div>
                  ) : null}
                  {error.type === 'DOWNLOAD_ERROR' ? (
                    <div className="td icon remove" onClick={() => remove(error)}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-list-remove.svg`} />
                    </div>
                  ) : null}
                  {/* TODO: 本地无法添加时，处理方式 */}
                  {error.type === 'ADD_ERROR' ? (
                    <div className="td name" title={iv(error.object.name)}>
                      {iv(error.object.name)}
                    </div>
                  ) : null}
                  {error.type === 'ADD_ERROR' ? (
                    <div className="td origin" onClick={() => openPath(error.object.path)}>
                      <a title={iv(error.object.path)}>{iv(error.object.path)}</a>
                    </div>
                  ) : null}
                  {error.type === 'ADD_ERROR' ? (
                    <div className="td reason" dangerouslySetInnerHTML={{ __html: iv(error.reason) }}></div>
                  ) : null}
                  {error.type === 'ADD_ERROR' ? (
                    <div className="td icon remove" onClick={() => remove(error)}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-list-remove.svg`} />
                    </div>
                  ) : null}
                  {/* 编辑错误 */}
                  {error.type === 'EDIT_ERROR' ? (
                    <div className="td name" title={iv(error.object.name)}>
                      {iv(error.object.name)}
                    </div>
                  ) : null}
                  {error.type === 'EDIT_ERROR' ? (
                    <div className="td origin" onClick={() => openPath(error.object.path)}>
                      <a title={iv(error.object.path)}>{iv(error.object.path)}</a>
                    </div>
                  ) : null}
                  {error.type === 'EDIT_ERROR' ? (
                    <div className="td reason" title={iv(error.reason)} dangerouslySetInnerHTML={{ __html: iv(error.reason) }}></div>
                  ) : null}
                  {error.type === 'EDIT_ERROR' ? (
                    <div className="td icon remove" onClick={() => remove(error)}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-list-remove.svg`} />
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="vs-repeat-after-content" style={{ height: `${win.afterSize}px` }} />
            </div>
          </div>
          <div className="section darken textAlign-right">
            <div className="button button-xs button-grey" style={{ float: 'left' }} onClick={() => cleanAll()}>
              {t('modal.importError.button.removeAll')}
            </div>
            <div className="button button-xs button-grey" style={{ float: 'left' }} onClick={() => copyAll()}>
              {t('modal.importError.button.copyAll')}
            </div>
            <div className="button button-xs button-primary" onClick={() => retryAll()}>
              <img src="assets/images/dark/icons/ic-refresh.svg" /> {t('modal.importError.button.retryAll')}
            </div>
            <div className="button button-xs button-grey" onClick={() => close()}>
              {t('modal.importError.button.cancel')}
            </div>
          </div>
        </div>
        <div className="modal-overlay"></div>
      </>
    ) : null,
    host
  );
}

/* ================= WebsitePanelController（74094-74144） + websitePanelWebview 指令（74147-74189） ================= */

export function WebsitePanel() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot: sidebarSnapshot } = useSidebarState();
  const toolbarSnapshot = useToolbarState((s: any) => s.snapshot);
  const webviewRef = useRef<any>(null);
  const currentUrlRef = useRef('');
  const [, bump] = useState(0);

  useEffect(() => {
    setHost(document.getElementById('eagle-website-panel-host'));
  }, []);

  // websitePanelWebview 指令（dom-ready / page-title-updated）
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    const body = getBodyScope();

    const onDomReady = () => {
      try {
        webview.executeJavaScript(
          `
                        localStorage["theme"] = "${body?.theme}";
                        document.querySelector("html").setAttribute("theme", "${body?.theme}");
                    `,
          true
        );
      } catch (e) {}
      webview.focus();
      window.blur();
      window.focus();
      if (webview.src.indexOf('file:///') > -1) {
        webview.clearHistory();
        webview.loadURL(`${body?.currentUrl}`);
      }
    };

    const onPageTitleUpdated = () => {
      const title = webview.getURL();
      const titleEl = document.getElementById('website-panel-webview-title');
      if (titleEl) titleEl.innerHTML = title;

      if (webview.canGoForward()) {
        document.getElementById('website-panel-webview-go-forward')?.classList.remove('disabled');
      } else {
        document.getElementById('website-panel-webview-go-forward')?.classList.add('disabled');
      }
      if (webview.canGoBack()) {
        document.getElementById('website-panel-webview-go-back')?.classList.remove('disabled');
      } else {
        document.getElementById('website-panel-webview-go-back')?.classList.add('disabled');
      }
    };

    webview.addEventListener('dom-ready', onDomReady);
    webview.addEventListener('page-title-updated', onPageTitleUpdated);
    return () => {
      webview.removeEventListener('dom-ready', onDomReady);
      webview.removeEventListener('page-title-updated', onPageTitleUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // controller：$watch('theme') → webview 主题注入
  useEffect(() => {
    const body = getBodyScope();
    if (body?.theme) {
      const webview = document.querySelector('#website-panel webview') as any;
      if (webview) {
        try {
          webview.executeJavaScript(
            `
                        localStorage["theme"] = "${body.theme}";
                        document.querySelector("html").setAttribute("theme", "${body.theme}");
                    `,
            true
          );
        } catch (e) {}
      }
    }
    bump((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarSnapshot.theme, host]);

  // OPEN_URL_IN_PANEL（74113-74120 逐字）
  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = openUrlInPanelChannel.on((url: any) => {
      currentUrlRef.current = url;
      const webview = (document.querySelector('#website-panel webview') as any) || webviewRef.current;
      if (webview && String(webview.src || '').indexOf('community-') === -1) {
        webview.setAttribute('src', `${url}`);
      }
      const body = getBodyScope();
      if (body) body.isOpenWebpagePanel = true;
      bump((v) => v + 1);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const goBack = () => {
    const webview = document.querySelector('#website-panel webview') as any;
    if (webview && webview.canGoBack()) {
      webview.goBack();
    }
  };

  const goForward = () => {
    const webview = document.querySelector('#website-panel webview') as any;
    if (webview && webview.canGoForward()) {
      webview.goForward();
    }
  };

  const openInBrowser = () => {
    const webview = document.querySelector('#website-panel webview') as any;
    const shell = req('electron')?.shell || req('@electron/remote')?.shell;
    if (webview && shell) shell.openExternal(webview.src);
  };

  const refresh = () => {
    const webview = document.querySelector('#website-panel webview') as any;
    if (webview) webview.reload();
  };

  const toggleAll = (event: any) => {
    scopeApply(getBodyScope(), (s: any) => machineryToggleAll(s, event));
  };

  const openSidebarMenu = (event: any) => {
    scopeApply(getBodyScope(), (s: any) => {
      if (typeof s.openSidebarMenu === 'function') s.openSidebarMenu(event);
    });
  };

  if (!host) return null;

  const visible = sidebarSnapshot.viewMode == 'community';

  return createPortal(
    <div
      id="website-panel"
      className="website-panel"
      style={{ left: `${sidebarSnapshot.sidebarWidth + 1}px`, ...(!visible ? { display: 'none' } : null) }}
    >
      {visible && sidebarSnapshot.isUILoaded ? (
        <>
          <div className="drag-area"></div>
          <div className="loader">
            <svg className="spinner" width="32px" height="32px" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
              <circle className="path" fill="none" strokeWidth="3" strokeLinecap="round" cx="33" cy="33" r="30"></circle>
            </svg>
          </div>
          <webview id="website-panel-webview" ref={webviewRef as any} {...({ frameborder: '0', allowpopups: '' } as any)} />
          <div className="website-panel-webview-control">
            <div id="toggle-all-btn" className="icon-btn" onContextMenu={openSidebarMenu} onClick={toggleAll}>
              <img src={`assets/images/${themePathOf(toolbarSnapshot.theme)}/icons/ic_toggle-sidebar.svg`} />
            </div>
            <div id="website-panel-webview-go-back" className="disabled icon-btn no-padding" onClick={goBack}>
              <img src={`assets/images/${themePathOf(toolbarSnapshot.theme)}/icons/ic-toolbar-prev.svg`} />
            </div>
            <div id="website-panel-webview-go-forward" className="disabled icon-btn no-padding" onClick={goForward}>
              <img src={`assets/images/${themePathOf(toolbarSnapshot.theme)}/icons/ic-toolbar-next.svg`} />
            </div>
            <div className="icon-btn" onClick={refresh}>
              <img src={`assets/images/${themePathOf(toolbarSnapshot.theme)}/icons/ic_refresh.svg`} />
            </div>
            <div className="website-panel-webview-control-btn icon-btn" onClick={openInBrowser}>
              <img src={`assets/images/${themePathOf(toolbarSnapshot.theme)}/icons/ic-toolbar-open-default.svg`} />
            </div>
            <div id="website-panel-webview-title" className="title"></div>
            <CornerBtns snapshot={toolbarSnapshot} />
          </div>
        </>
      ) : null}
    </div>,
    host
  );
}

