import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLockState } from '../../store/lockState';
import { useAppState } from '../../store/appState';
import { useSidebarState } from '../../store/sidebarState';
import { useToolbarState } from '../../store/toolbarState';
import { t } from '../../global/eagleGlobals';
// b1-9bz-B：callScope 字符串派发退役——改为落点导出直 import（表项本就是同对象指针）
import { focusAppUnlockPassword, focusUnlockPassword, unlockAppPasswordKeydown, unlockAppPasswordKeyup, unlockPasswordKeyup } from '../../services/lockService';

import { CornerBtns } from '../toolbar/Toolbar';
import { runInBodyScope } from '../../core/appCore';

import { machineryUnlockFolderWithTouchID } from '../../core/libraryDomain';
import { writeScopeField } from '../../core/scopeFieldBridge';
/**
 * 11-pre a3：文件夹密码锁 + 应用锁屏（index.html 156-170 / 424-444 逐字）。
 *
 * C 模式（同 background-state-spinner 先例）：React 渲染 DOM **保留原 id**
 * （#lock-password-input / #app-lock-password-input），bundle 的校验/解锁数据流
 * （unlockPasswordKeyup / unlockAppPasswordKeyup / focus* / TouchID 处理器）经 callScope
 * 调用，其内部 jQuery（shake addClass、focus、blur 重聚焦、val 读写）继续作用于 React
 * 节点；unlockPassword ng-model 等价 = onInput 直写 scope.unlockPassword。
 * always-focus 指令（bundle 69688，100ms 轮询聚焦）由 React effect 等价（补 unmount 清理）；
 * 应用锁屏挂载时兜底聚焦（bundle lockApp 的 100ms focus 可能早于 React 挂载）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

function useLockHost(id: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById(id));
  }, [id]);
  return host;
}

/** always-focus 指令等价（bundle 69688-69700：100ms 轮询，可见且未聚焦则聚焦）。 */
function useAlwaysFocus(ref: React.RefObject<HTMLInputElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      if (el.offsetParent !== null && document.activeElement !== el) {
        el.focus();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [ref, active]);
}

/** 文件夹密码输入（index.html 156-170 逐字）。 */
export function FolderLockScreen() {
  const host = useLockHost('eagle-folder-lock-host');
  const folderLocked = useLockState((s) => s.folderLocked);
  const folderPasswordTips = useLockState((s) => s.folderPasswordTips);
  const canUseTouchID = useLockState((s) => s.canUseTouchID);
  const theme = useAppState((s) => s.theme);
  if (!host || !folderLocked) return null;

  const themePath = themePathOf(theme);
  return createPortal(
    <div className="lock-screen" onClick={(e) => runInBodyScope(() => focusUnlockPassword(e))}>
      <div className="info">
        <img src={`assets/images/${themePath}/illustrations/lock-screen.png`} width={400} height={144} />
        <h4>{t('pages.unlock.title')}</h4>
        {folderPasswordTips && <p>{t('pages.unlock.passwordTips')}{folderPasswordTips}</p>}
        <div className="password-input-wrapper">
          <input
            id="lock-password-input"
            type="password"
            placeholder={t('pages.unlock.placeholder')}
            onInput={(e) => {
              writeScopeField('unlockPassword', (e.target as HTMLInputElement).value);
            }}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            onKeyUp={(e) => runInBodyScope(() => unlockPasswordKeyup(e))}
          />
          {/* Touch ID 按鈕 - 整合在輸入框內 */}
          {canUseTouchID && (
            <button className="ic-btn touchid-btn-inline" onClick={(e) => runInBodyScope((s) => machineryUnlockFolderWithTouchID(e))}>
              <img src={`assets/images/${themePath}/icons/ic-touchid.svg`} width={20} height={20} />
            </button>
          )}
        </div>
      </div>
    </div>,
    host
  );
}

/** 应用锁密码输入（index.html 424-444 逐字；corner-btns → 既有 React CornerBtns）。 */
export function AppLockScreen() {
  const host = useLockHost('eagle-app-lock-host');
  const isAppLocked = useLockState((s) => s.isAppLocked);
  const canUseTouchID = useLockState((s) => s.canUseTouchID);
  const isUILoaded = useSidebarState((s) => s.snapshot.isUILoaded);
  const preferences = useAppState((s) => s.preferences);
  const theme = useAppState((s) => s.theme);
  const toolbarSnapshot = useToolbarState((s) => s.snapshot);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const privacy: any = preferences?.privacy;
  const visible = !!(privacy && privacy.enable !== 'false' && isAppLocked && isUILoaded);

  // bundle lockApp 的 100ms focus 可能早于 React 挂载：挂载时兜底聚焦一次。
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [visible]);
  useAlwaysFocus(inputRef, visible);

  if (!host || !visible) return null;

  const themePath = themePathOf(theme);
  const enableTouchID = privacy && privacy.enableTouchID === 'true';
  return createPortal(
    <div className="lock-screen app-lock-screen" onClick={(e) => runInBodyScope(() => focusAppUnlockPassword(e))}>
      <CornerBtns snapshot={toolbarSnapshot} />
      <div className="info">
        <img src={`assets/images/${themePath}/illustrations/lock-screen.png`} width={400} height={144} />
        <h4>{t('pages.unlock.apptitle')}</h4>
        {privacy && privacy.passwordTips && <p>{t('pages.unlock.passwordTips')}{privacy.passwordTips}</p>}
        <div className="password-input-wrapper">
          <input
            id="app-lock-password-input"
            type="password"
            placeholder={t('pages.unlock.placeholder')}
            ref={inputRef}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            onKeyDown={(e) => runInBodyScope(() => unlockAppPasswordKeydown(e))}
            onKeyUp={(e) => runInBodyScope(() => unlockAppPasswordKeyup(e))}
          />
          {/* Touch ID 按鈕 - 整合在輸入框內 */}
          {canUseTouchID && enableTouchID && (
            <button className="ic-btn touchid-btn-inline" onClick={(e) => runInBodyScope((s) => { if (typeof s.unlockWithTouchID === 'function') s.unlockWithTouchID(e); })}>
              <img src={`assets/images/${themePath}/icons/ic-touchid.svg`} width={20} height={20} />
            </button>
          )}
        </div>
      </div>
    </div>,
    host
  );
}
