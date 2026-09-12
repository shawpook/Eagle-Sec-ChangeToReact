import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUploadState } from '../../store/uploadState';
import { useSidebarState } from '../../store/sidebarState';
import { useInspectorState } from '../../store/inspectorState';
import { useAppState } from '../../store/appState';
import { second2time } from '../../app/filters';
import { t } from '../../global/eagleGlobals';
// b1-9bz-B：callScope 字符串派发退役——改为落点导出直 import（表项本就是同对象指针）
import { cancelAllTasks } from '../../services/uploadService';
import { getBodyScope, runInBodyScope } from '../../core/appCore';

/**
 * 11-pre a1：文件写入进度条 + 檔案添加進度條（index.html 88-110 逐字）。
 *
 * - DOM/class 逐字复用原 CSS（.saving-progress-bar / .upload-progress-bar）；id 不带
 *   （原 id 仅供 bundle jQuery 直控，删除模板位后由 React 单一渲染）。
 * - saving 条原位在 #list-content-panel 内（absolute left:50% 定位继承面板）；upload 条
 *   position:fixed + left/right 内联（containerSize.sidebar+1 / inspector.width+1）+
 *   ng-hide isDetailMode 等价。
 * - cancel 按钮 ng-click="cancelAllTasks()" → callScope（ng-click $apply 语义）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

function useProgressBarsHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById('eagle-progress-bars-host'));
  }, []);
  return host;
}

/** 文件写入进度条（index.html 88-94 逐字；open/message 由 background-state ipc 驱动）。 */
export function SavingProgressBar() {
  const host = useProgressBarsHost();
  const savingOpen = useUploadState((s) => s.savingOpen);
  const savingMessage = useUploadState((s) => s.savingMessage);
  if (!host) return null;
  return createPortal(
    <div className={`saving-progress-bar${savingOpen ? ' open' : ''}`}>
      <div className="message">{savingMessage}</div>
      <div className="progressbar">
        <div className="current" style={{ width: '100%' }} />
      </div>
    </div>,
    host
  );
}

/** 檔案添加進度條（index.html 96-110 逐字；队列状态由 scope 快照驱动）。 */
export function UploadQueueProgressBar() {
  const host = useProgressBarsHost();
  const queueLength = useUploadState((s) => s.queueLength);
  const finishCount = useUploadState((s) => s.finishCount);
  const progress = useUploadState((s) => s.progress);
  const timeLeft = useUploadState((s) => s.timeLeft);
  const inspectorSnapshot = useInspectorState((s) => s.snapshot);
  const sidebarSnapshot = useSidebarState((s) => s.snapshot);
  const theme = useAppState((s) => s.theme);
  if (!host) return null;

  const hasQueue = queueLength > 0;
  return createPortal(
    <div
      className={`upload-progress-bar${hasQueue ? ' open' : ''}`}
      style={{
        left: sidebarSnapshot.sidebarWidth + 1,
        right: inspectorSnapshot.width + 1,
        display: inspectorSnapshot.isDetailMode ? 'none' : undefined,
      }}
    >
      {hasQueue && (
        <div className="progressbar">
          {queueLength > 1 && (
            <div className="current" style={{ width: `${(finishCount / queueLength) * 100}%` }} />
          )}
          {queueLength === 1 && <div className="current" style={{ width: `${progress * 100}%` }} />}
        </div>
      )}
      {hasQueue && (
        <div className="message">
          <span>{t('progress.uppload.addingImages')} </span>
          <span className="counter percentage">
            {finishCount}/{queueLength}
          </span>
          {!!timeLeft && (
            <span className="counter remain"> ({second2time(timeLeft)})</span>
          )}
        </div>
      )}
      {hasQueue && (
        <div className="ic-btn cancel" onClick={(e) => runInBodyScope(() => cancelAllTasks(e))}>
          <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-close.svg`} />
        </div>
      )}
    </div>,
    host
  );
}
