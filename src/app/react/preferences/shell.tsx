import React, { useEffect, useState } from 'react';
import {
  applyController,
  controllerScope,
  getControllerVersion,
  pfT,
  subscribeController,
} from './controller';
import { PreferencesPanels } from './panels';

/**
 * 阶段8e-2：偏好窗口 React 壳——接管 Angular 残余（sidebar/header/footer/panel-empty/
 * 密码弹窗/w-mousetrap/body 属性），并承载 controller.ts 的控制器状态渲染。
 *
 * 规范来源 = preferences.html 壳层逐字 + preferences.js（ipc 'init' 序列 802-841、
 * keyword $watch showSearchEmpty 326-336、wMousetrap 绑定 mod+f/mod+enter/esc、
 * PasswordController 171-287、auto-focus/select-all 指令等价）。
 *
 * 契约：#sidebar-search / #shortcut-input 由本壳渲染（原位语义不变：id/占位符/键盘行为），
 * panels 的搜索与面板渲染继续工作于同一 .content 锚点体系。
 */

const req = (name: string): any => (window as any).require?.(name);

function useControllerVersion(): number {
  const [ver, setVer] = useState(getControllerVersion());
  useEffect(() => subscribeController(() => setVer(getControllerVersion())), []);
  return ver;
}

function throttle50(fn: () => void): () => void {
  let last = 0;
  return () => {
    const now = +new Date();
    if (now - last >= 50) {
      last = now;
      fn();
    }
  };
}

/** selectAll 指令等价（preferences.js 130-142：mod+a 全选 / esc 失焦）。 */
function selectAllKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.select();
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    e.currentTarget.blur();
  }
}

/** 密码弹窗 auto-focus 指令等价：弹窗打开后 100ms click+focus+select 首个输入。 */
function useAutoFocusPasswordInput(isOpen: boolean, mode: string) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const id = mode === 'new' ? 'new-folder-password-input' : mode === 'reset' ? 'reset-folder-password-input' : 'change-folder-password-input';
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) {
        el.click();
        el.focus();
        el.select();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen, mode]);
}

function PasswordModal(props: { ver: number }) {
  const pwd = controllerScope.password;
  useAutoFocusPasswordInput(pwd.isOpen, pwd.mode);

  if (!pwd.isOpen) return null;

  const set = (key: string, value: string) =>
    applyController((s) => {
      s.password[key] = value;
    });

  return (
    <div className="modal folder-password-modal open">
      <div className="modal-header">
        <div className="name">{pfT('context.folder.password')}</div>
        <div className="close" onClick={() => applyController((s) => s.pwdCancel())}></div>
      </div>
      <div className="section">
        {pwd.mode === 'new' && (
          <div>
            <label htmlFor="">{pfT('modal.folderPassword.password')}</label>
            <input
              id="new-folder-password-input"
              type="password"
              placeholder=""
              value={pwd.newPassword}
              onChange={(e) => set('newPassword', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            />
            <div className="margin-bottom-12"></div>
            <label htmlFor="">{pfT('modal.folderPassword.rePassword')}</label>
            <input
              type="password"
              placeholder=""
              value={pwd.newRePassword}
              onChange={(e) => set('newRePassword', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            />
            <div className="margin-bottom-12"></div>
            <label htmlFor="">{pfT('modal.folderPassword.passwordTips')}</label>
            <textarea
              name=""
              id=""
              cols={30}
              rows={2}
              placeholder=""
              value={pwd.passwordTips}
              onChange={(e) => set('passwordTips', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            ></textarea>
          </div>
        )}

        {pwd.mode === 'change' && (
          <div>
            <label htmlFor="">{pfT('modal.folderPassword.oldPassword')}</label>
            <input
              id="change-folder-password-input"
              type="password"
              placeholder=""
              value={pwd.oldPassword}
              onChange={(e) => set('oldPassword', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            />
            <div className="margin-bottom-12"></div>
            <label htmlFor="">{pfT('modal.folderPassword.newPassword')}</label>
            <input
              type="password"
              placeholder=""
              value={pwd.newPassword}
              onChange={(e) => set('newPassword', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            />
            <div className="margin-bottom-12"></div>
            <label htmlFor="">{pfT('modal.folderPassword.rePassword')}</label>
            <input
              type="password"
              placeholder=""
              value={pwd.newRePassword}
              onChange={(e) => set('newRePassword', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            />
            <div className="margin-bottom-12"></div>
            <label htmlFor="">{pfT('modal.folderPassword.passwordTips')}</label>
            <textarea
              name=""
              id=""
              cols={30}
              rows={2}
              placeholder=""
              value={pwd.passwordTips}
              onChange={(e) => set('passwordTips', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            ></textarea>
          </div>
        )}

        {pwd.mode === 'reset' && (
          <div>
            <label htmlFor="">{pfT('modal.folderPassword.currentPassword')}</label>
            <input
              id="reset-folder-password-input"
              type="password"
              value={pwd.oldPassword}
              onChange={(e) => set('oldPassword', e.currentTarget.value)}
              onKeyDown={selectAllKeyDown}
            />
          </div>
        )}
      </div>
      <div className="section darken textAlign-right">
        {pwd.mode === 'new' && (
          <div className="button button-s button-block button-primary" onClick={() => applyController((s) => s.pwdSave())}>
            {pfT('modal.folderPassword.saveNew')}
          </div>
        )}
        {pwd.mode === 'change' && (
          <div className="button button-s button-block button-primary" onClick={() => applyController((s) => s.pwdSave())}>
            {pfT('modal.folderPassword.saveChange')}
          </div>
        )}
        {pwd.mode === 'reset' && (
          <div className="button button-s button-block button-primary" onClick={() => applyController((s) => s.pwdSave())}>
            {pfT('modal.folderPassword.saveReset')}
          </div>
        )}
      </div>
    </div>
  );
}

function PreferencesShell() {
  const ver = useControllerVersion();
  // 引用 controllerScope 保证渲染读取最新字段（notify → version → re-render）
  void ver;

  // ipc 'init' 序列（preferences.js 802-841 的数据面接管；entry.tsx 的测试契约监听并存）
  useEffect(() => {
    const ipc = req('electron')?.ipcRenderer;
    if (!ipc || !ipc.on) return;
    const onInit = (event: any, params: any) => {
      applyController((s) => s.runInitSequence(params));
    };
    ipc.on('init', onInit);
    return () => {
      if (ipc.off) ipc.off('init', onInit);
    };
  }, []);

  // w-mousetrap（preferences.html body 属性）：mod+f focusSearch / mod+enter save / esc escHandler
  useEffect(() => {
    const throttledFocus = throttle50(() => applyController((s) => s.focusSearch()));
    const throttledSave = throttle50(() => applyController((s) => s.save()));
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = (e.key || '').toLowerCase();
      if (mod && key === 'f') {
        throttledFocus();
      } else if (mod && e.key === 'Enter') {
        throttledSave();
      } else if (e.key === 'Escape') {
        // escHandler(e) 需要事件对象（stopPropagation + cancel）
        applyController((s) => s.escHandler(e));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // showSearchEmpty watcher（preferences.js 326-336 逐字：100ms 后统计 .content .panel-content :visible）
  useEffect(() => {
    if (!controllerScope.keyword) {
      if (controllerScope.showSearchEmpty) {
        applyController((s) => {
          s.showSearchEmpty = false;
        });
      }
      return;
    }
    const timer = setTimeout(() => {
      const $ = (window as any).jQuery;
      let count = 0;
      if ($) {
        try {
          count = $('.content').find('.panel-content :visible').length;
        } catch (err) {
          count = 0;
        }
      }
      const next = count === 0 && !!controllerScope.keyword;
      if (controllerScope.showSearchEmpty !== next) {
        applyController((s) => {
          s.showSearchEmpty = next;
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [ver]);

  // body 属性（preferences.html body 逐字）：platform 静态 + theme 随 digest + vibrancy/class 一次性
  useEffect(() => {
    document.body.setAttribute('platform', String(controllerScope.platform));
    if (!document.body.classList.contains(String(controllerScope.platform))) {
      document.body.classList.add(String(controllerScope.platform));
    }
  }, []);
  useEffect(() => {
    const theme = String(
      controllerScope.themeAttr ? controllerScope.themeAttr() : 'gray'
    );
    if (document.body.getAttribute('theme') !== theme) {
      document.body.setAttribute('theme', theme);
    }
  });
  useEffect(() => {
    if (!controllerScope.preferences) return;
    // {{::vibrancyEnabled}} / {{::platform}} {{language}} theme-{{themeName}} 一次性绑定
    document.body.setAttribute('vibrancy', String(controllerScope.vibrancyEnabled));
    const cls = `${controllerScope.platform} ${controllerScope.language || ''} theme-${controllerScope.themeName || ''}`;
    document.body.className = cls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!controllerScope.preferences]);

  const s = controllerScope;
  const currentPanel = s.currentPanel;
  if (!currentPanel) return null;

  return (
    <>
      <div className="preferences-layout">
        {/* 侧边栏 */}
        <div className="sidebar">
          <div className="title" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            {pfT('preferencesWindow.title')}
          </div>
          <input
            id="sidebar-search"
            type="search"
            placeholder={pfT('general.search')}
            value={s.keyword || ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              applyController((c) => {
                c.keyword = value;
                c.onKeywordChange();
              });
            }}
            onKeyDown={selectAllKeyDown}
          />
          <div className="sidebar-items">
            {s.sidebarPanels.map((panel: any, i: number) =>
              panel.type === 'separator' ? (
                <div className="separator" key={'sep-' + i}></div>
              ) : (
                <div
                  key={panel.name}
                  className={`sidebar-item${panel.name === currentPanel.name ? ' active' : ''}`}
                  onClick={() => applyController((c) => c.switchPanel(panel))}
                >
                  <div
                    className="icon"
                    style={{ WebkitMaskImage: `url(assets/images/base/preferences/${panel.iconPath})` } as React.CSSProperties}
                  ></div>
                  <div className="name">{panel.i18n}</div>
                  {!!panel.ai && (
                    <img
                      src={`assets/images/${
                        (s.themeAttr ? s.themeAttr() : 'dark') === 'light' || (s.themeAttr ? s.themeAttr() : 'dark') === 'lightgray'
                          ? 'light'
                          : 'dark'
                      }/icons/context-menu/ic-ai.svg`}
                    />
                  )}
                </div>
              )
            )}
          </div>
        </div>

        <div className="container">
          <div className="header" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div className="panel-title">{currentPanel.i18n}</div>
            <div className="close" onClick={() => applyController((c) => c.cancel())}></div>
          </div>

          {/* 快捷鍵搜索框（ng-if shortcuts） */}
          {currentPanel.name === 'shortcuts' && (
            <div className="shortcut-search-container">
              <input
                id="shortcut-input"
                type="search"
                placeholder={pfT('general.search')}
                value={s.shortcutKeyword || ''}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  applyController((c) => {
                    c.shortcutKeyword = value;
                  });
                }}
                onKeyDown={selectAllKeyDown}
              />
            </div>
          )}

          <div className="content">
            {s.showSearchEmpty && (
              <div className="panel-empty">
                <div className="icon">
                  <img
                    style={{ width: '400px', height: '144px' }}
                    src={`assets/images/${s.themeAttr ? s.themeAttr() : 'dark'}/illustrations/preferences-search-empty.png`}
                  />
                </div>
                <div className="title">{pfT('preferencesWindow.searchEmpty.title')}</div>
                <p>{pfT('preferencesWindow.searchEmpty.desc')}</p>
              </div>
            )}

            {/* 面板内容（panels.tsx portal 渲染于 .content 顶部锚点） */}
            <PreferencesPanels />

            <div className="footer">
              <div className="right">
                <div className="button button-primary" onClick={() => applyController((c) => c.save())}>
                  {pfT('preferencesWindow.saveBtn')}
                </div>
                <div className="button button-grey" onClick={() => applyController((c) => c.apply())}>
                  {pfT('preferencesWindow.apply')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 密码设置（PasswordController） */}
        <PasswordModal ver={ver} />
        <div className="modal-overlay"></div>
      </div>
    </>
  );
}

export { pfT } from './controller';
export { applyController, controllerScope, getControllerVersion, subscribeController } from './controller';
export default PreferencesShell;
