import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToastState } from '../../store/toastState';
import { useAppState } from '../../store/appState';
import { t } from '../../global/eagleGlobals';
// b1-9bz-B：callScope 字符串派发退役——改为落点导出直 import（表项本就是同对象指针）
import { cleanLibraryPathPermissionError, cleanLocalhostError, openErrorModal } from '../../core/miscDomain';
import { cleanAllError } from '../../services/batchOpsService';
import { runInBodyScope } from '../../core/appCore';

/**
 * 11-pre a2：toast-alert 三块（index.html 96-121 逐字——失败重试提示 / 本地服务器无法
 * 访问警告 / 資源庫沒有寫入權限提示）。class 与结构逐字复用原 CSS；ng-if → 条件渲染；
 * 两条警告的 message 原版 ng-bind-html（i18n 文案含 <a> 链接）→ dangerouslySetInnerHTML。
 * openErrorModal/cleanAllError/cleanLocalhostError/cleanLibraryPathPermissionError 均
 * callScope（ng-click $apply 语义）；cleanAllError 内部 stopPropagation 阻止外层开弹窗，
 * CLEAN_ALL_ERROR 广播由既有 React ErrorModal 消费（7c 系列接线，通道零改动）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

function useToastAlertsHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById('eagle-toast-alerts-host'));
  }, []);
  return host;
}

export function ToastAlerts() {
  const host = useToastAlertsHost();
  const errorCount = useToastState((s) => s.errorCount);
  const localhostError = useToastState((s) => s.localhostError);
  const libraryPathPermissionError = useToastState((s) => s.libraryPathPermissionError);
  const theme = useAppState((s) => s.theme);
  if (!host) return null;

  const themePath = themePathOf(theme);
  return createPortal(
    <>
      {errorCount > 0 && (
        <div className="toast-alert" onClick={(e) => runInBodyScope(() => openErrorModal(e))}>
          <div className="icon">
            <img src={`assets/images/${themePath}/icons/ic-toast-error.svg`} />
          </div>
          <div className="message">
            {errorCount}{' '}
            <span style={errorCount === 1 ? undefined : { display: 'none' }}>
              {t('notify.errorToast.errorMsg1')}
            </span>
            <span style={errorCount > 1 ? undefined : { display: 'none' }}>
              {t('notify.errorToast.errorMsg2')}
            </span>
          </div>
          <div className="ic-btn clean-btn" onClick={(e) => runInBodyScope(() => cleanAllError(e))}>
            <img src={`assets/images/${themePath}/icons/ic-modal-close.svg`} />
          </div>
        </div>
      )}

      {localhostError && (
        <div className="toast-alert warning bottom">
          <div className="icon">
            <img src={`assets/images/${themePath}/icons/ic-toast-error.svg`} />
          </div>
          <div className="message" dangerouslySetInnerHTML={{ __html: t('notify.localhostError.msg') }} />
          <div className="ic-btn clean-btn" onClick={(e) => runInBodyScope(() => cleanLocalhostError(e))}>
            <img src={`assets/images/${themePath}/icons/ic-modal-close.svg`} />
          </div>
        </div>
      )}

      {libraryPathPermissionError && (
        <div className="toast-alert warning bottom">
          <div className="icon">
            <img src={`assets/images/${themePath}/icons/ic-toast-error.svg`} />
          </div>
          <div
            className="message"
            dangerouslySetInnerHTML={{ __html: t('notify.libraryPermissionError.msg') }}
          />
          <div className="ic-btn clean-btn" onClick={(e) => runInBodyScope(() => cleanLibraryPathPermissionError(e))}>
            <img src={`assets/images/${themePath}/icons/ic-modal-close.svg`} />
          </div>
        </div>
      )}
    </>,
    host
  );
}
