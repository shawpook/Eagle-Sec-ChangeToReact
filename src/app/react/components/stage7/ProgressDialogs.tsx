import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../global/eagleGlobals';
import { second2time } from '../../app/filters';
import { getIpc, req } from '../detail/detailHooks';
import { getBodyScope, getRootScope, scopeApply } from '../../core/appCore';
import { cancelEmptyTrash as cancelEmptyTrashAction } from '../../services/batchOpsService';
import { cancelRegenerateThumbnail as cancelRegenerateThumbnailAction } from '../../services/imageOpsService';
import { addToLibraryChannel, webpConvertStartChannel } from '../../global/bus';

/**
 * 阶段7d-6a：进度对话框族（第一部分）接管。
 *
 * 规范来源 = bundle 63239-64072 附近 + js/directives/{empty-trash,library-load,
 * library-merge,eaglepack-import,eaglepack-export}-progress.{js,html} 逐字镜像。
 *
 * 通道零改动：
 * - empty-trash：body scope 属性 isCleaningTrash/removeProgress/cancelEmptyTrash（空 link，
 *   模板绑定全部解析到 body scope），React 侧 body.$watch 桥接 + 点击直调 body.cancelEmptyTrash。
 * - library-load：ipc 'app-status-module-loading'/'app-status-module-loaded'/'app-status-welcome'/
 *   'app-status-loading'/'checking-library-cache'/'checking-library-cache-increase'/
 *   'app-status-library-dirs-loading'/'app-status-library-dirs-loaded'/
 *   'app-status-library-metadata-loading'/'app-status-library-metadata-loaded'/
 *   'app-status-library-loaded'/'app-status-library-cache-loading'/'app-status-library-cache-loaded'。
 * - library-merge：ipc 'show-import-library-task'/'finish-import-library-task'/'close-import-library'
 *   （close 时 swal mergeLibraryDone → ipc 'reload-app'），cancel → ipc 'cancel.all'。
 * - eaglepack-import：ipc 'show-extract-task'/'add-extract-task'/'cancel-extract-task'/
 *   'finish-extract-task'，cancel → ipc 'cancel.all'。
 * - eaglepack-export：ipc 'show-archive-task'/'add-archive-task'/'update-archive-percent'/
 *   'finish-archive-task'/'abort-archive-task'，cancel → ipc 'cancel.all'。
 *
 * 逻辑逐字移植：LoadProgress 类（init/initIPC/open/close/#calculateLoadLibraryTimeLeft）、
 * calcuteTimeLeft 等私有方法；ngSwitch/ngIf/ngShow 逐字对应。所有 ipc 回调与 JSX 边界包 ngSafe
 * （$exceptionHandler 等价，避免 mock 环境异常卸载整树）。
 */

const ngSafe = (fn: () => void) => {
  try {
    fn();
  } catch (err) {
    console.error(err);
  }
};
const ngShow = (show: boolean) => (show ? undefined : { display: 'none' } as React.CSSProperties);
const iv = (v: any): any => (v === undefined || v === null ? '' : v);
const ngNumber = (v: any, frac: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac });
};

/* ================= empty-trash-progress（空 link；body scope 桥接） ================= */

export function EmptyTrashProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const [isCleaning, setIsCleaning] = useState(false);
  const [removeProgress, setRemoveProgress] = useState(0);

  useEffect(() => {
    setHost(document.getElementById('eagle-empty-trash-progress-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    // 模板绑定 isCleaningTrash/removeProgress 解析到 body scope → $watch 桥接 digest 变化
    const off1 = body.$watch('isCleaningTrash', (v: any) => setIsCleaning(!!v));
    const off2 = body.$watch('removeProgress', (v: any) => {
      setRemoveProgress(Number(v) || 0);
      bumpAll();
    });
    setIsCleaning(!!body.isCleaningTrash);
    setRemoveProgress(Number(body.removeProgress) || 0);
    return () => {
      off1();
      off2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const cancelEmptyTrash = () => {
    // ng-click 等价：$apply 包裹（digest 触发 $watch 桥接 → isCleaningTrash=false → 关闭）
    scopeApply(getBodyScope(), () => cancelEmptyTrashAction());
  };

  return createPortal(
    <>
      <div className={`progress-dialog library-loading-dialog${isCleaning ? ' open' : ''}`}>
        {isCleaning && (
          <div className="progress-dialog-content">
            <div className="message">
              {t('sidebar.cleanTrashMsg')}
              <span className="counter">({ngNumber(removeProgress, 1)}%)</span>
            </div>
            <div className="progressbar">
              <div className="current" style={{ width: removeProgress + '%' }} />
            </div>
            <div className="button button-xs button-grey cancel-button cancel" onClick={cancelEmptyTrash}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= library-load-progress（LoadProgress 类逐字） ================= */

export function LibraryLoadProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const intervalRef = useRef<any>(null);
  const rootRef = useRef<any>({});

  // init()（镜像 37-46）+ status = STATUS.INIT
  if (rootRef.current.status === undefined) {
    rootRef.current.status = 'init';
    rootRef.current.isOpen = true;
    rootRef.current.libraryDiffCurr = 0;
    rootRef.current.libraryDiffCount = 0;
    rootRef.current.libraryTotal = 0;
    rootRef.current.currentLoaded = 0;
    rootRef.current.progress = 0;
    rootRef.current.loadLibraryStartTime = 0;
    rootRef.current.loadLibraryTimeLeftInSeconds = 0;
  }

  useEffect(() => {
    setHost(document.getElementById('eagle-library-load-progress-host'));
  }, []);

  useEffect(() => {
    const reset = () => {
      rootRef.current.isOpen = true;
      rootRef.current.libraryDiffCurr = 0;
      rootRef.current.libraryDiffCount = 0;
      rootRef.current.libraryTotal = 0;
      rootRef.current.currentLoaded = 0;
      rootRef.current.progress = 0;
      rootRef.current.loadLibraryStartTime = 0;
      rootRef.current.loadLibraryTimeLeftInSeconds = 0;
    };
    const open = () => {
      rootRef.current.isOpen = true;
    };
    const close = () => {
      setTimeout(() => {
        rootRef.current.isOpen = false;
        bumpAll();
      }, 50);
    };
    const calculateLoadLibraryTimeLeft = () => {
      const et = Date.now() - rootRef.current.loadLibraryStartTime;
      const cpt = rootRef.current.currentLoaded / et;
      const ett = rootRef.current.libraryTotal / cpt;
      rootRef.current.loadLibraryTimeLeftInSeconds = parseInt((ett - et) / 1000 as any);
    };
    const ipc = getIpc();

    const listeners: Record<string, any> = {
      'app-status-module-loading': (e: any) => {
        rootRef.current.status = 'module-loading';
        bumpAll();
      },
      'app-status-module-loaded': (e: any) => {
        rootRef.current.status = 'module-loaded';
        bumpAll();
      },
      'app-status-welcome': (e: any) => {
        close();
        bumpAll();
      },
      'app-status-loading': (e: any) => {
        reset();
        open();
        rootRef.current.status = 'library-loading';
        bumpAll();
      },
      'checking-library-cache': (e: any, total: number) => {
        if (!total || total <= 0) return;
        rootRef.current.libraryDiffCurr = 0;
        rootRef.current.libraryDiffCount = total;
        bumpAll();
      },
      'checking-library-cache-increase': (e: any) => {
        rootRef.current.libraryDiffCurr += 10;
        if (rootRef.current.libraryDiffCurr >= rootRef.current.libraryDiffCount) {
          rootRef.current.libraryDiffCurr = rootRef.current.libraryDiffCount;
        }
        bumpAll();
      },
      'app-status-library-dirs-loading': (e: any) => {
        rootRef.current.status = 'dir-loading';
        bumpAll();
      },
      'app-status-library-dirs-loaded': (e: any, count: number) => {
        rootRef.current.loadLibraryStartTime = Date.now();
        if (count) {
          rootRef.current.libraryTotal = count;
          rootRef.current.currentLoaded = 0;
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            ngSafe(() => {
              calculateLoadLibraryTimeLeft();
              bumpAll();
            });
          }, 1000);
        }
        rootRef.current.status = 'dir-loaded';
        bumpAll();
      },
      'app-status-library-metadata-loading': (e: any) => {
        if (rootRef.current.libraryTotal > 0 && rootRef.current.currentLoaded < rootRef.current.libraryTotal) {
          rootRef.current.status = 'metadata-loading';
          rootRef.current.currentLoaded += 10;
          if (rootRef.current.currentLoaded > rootRef.current.libraryTotal) {
            rootRef.current.currentLoaded = rootRef.current.libraryTotal;
          }
          rootRef.current.progress = 20 + (rootRef.current.currentLoaded * 100 * 7 / rootRef.current.libraryTotal) / 10;
          bumpAll();
        }
      },
      'app-status-library-metadata-loaded': (e: any) => {
        rootRef.current.progress = 95;
        rootRef.current.status = 'metadata-loaded';
        bumpAll();
      },
      'app-status-library-loaded': async (e: any, params: any) => {
        rootRef.current.loadLibraryStartTime = 0;
        rootRef.current.loadLibraryTimeLeftInSeconds = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
        rootRef.current.status = 'library-loaded';
        bumpAll();
        close();
      },
      'app-status-library-cache-loading': (e: any) => {
        rootRef.current.status = 'cache-loading';
        bumpAll();
      },
      'app-status-library-cache-loaded': (e: any) => {
        rootRef.current.progress = 80;
        rootRef.current.status = 'cache-loaded';
        bumpAll();
      },
    };

    Object.keys(listeners).forEach((channel) => {
      ngSafe(() => ipc && ipc.on && ipc.on(channel, listeners[channel]));
    });

    // 闭环测试契约（app-status-loading 有重型 body-controller 监听器，冒烟需绕开 emit 直调）
    (window as any).__eagleLibraryLoad = listeners;

    return () => {
      Object.keys(listeners).forEach((channel) => {
        ngSafe(() => ipc && ipc.off && ipc.off(channel, listeners[channel]));
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const st = rootRef.current.status;
  const isOpen = rootRef.current.isOpen;
  let messageNode: React.ReactNode = <div className="message">{t('loadProgress.msg.almostDone')}...</div>;
  if (st === 'init') {
    messageNode = <div className="message">{t('loadProgress.msg.initialize')}</div>;
  } else if (st === 'module-loading') {
    messageNode = <div className="message">{t('loadProgress.msg.moduleLoading')}</div>;
  } else if (st === 'library-loading') {
    messageNode = <div className="message">{t('loadProgress.msg.libraryLoading')}</div>;
  } else if (st === 'dir-loading') {
    messageNode = <div className="message">{t('loadProgress.msg.dirLoading')}</div>;
  } else if (st === 'cache-loading') {
    messageNode = <div className="message">{t('loadProgress.msg.cacheLoading')}</div>;
  } else if (st === 'metadata-loading') {
    messageNode = (
      <div className="message">
        {t('loadProgress.msg.metadataLoading')}
        <span className="counter" style={ngShow(!!rootRef.current.libraryTotal)}>
          ({ngNumber(rootRef.current.currentLoaded / rootRef.current.libraryTotal * 100, 2)}%)
        </span>
        <span className="counter" style={ngShow(!!rootRef.current.loadLibraryTimeLeftInSeconds)}>
          {' '}({second2time(rootRef.current.loadLibraryTimeLeftInSeconds)})
        </span>
      </div>
    );
  }

  return createPortal(
    <div className={`progress-dialog library-loading-dialog${isOpen ? ' open' : ''}`}>
      {isOpen && (
        <div className="progress-dialog-content">
          {messageNode}
          <div className="progressbar" style={ngShow(!!isOpen)}>
            <div className="current" style={{ width: (rootRef.current.progress || 0) + '%' }} />
          </div>
        </div>
      )}
    </div>,
    host
  );
}

/* ================= library-merge-progress ================= */

export function LibraryMergeProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const intervalRef = useRef<any>(null);
  const rootRef = useRef<any>({ isImporting: false, curr: 0, total: 0, timeLeftInSeconds: 0, updateStartTime: 0 });

  useEffect(() => {
    setHost(document.getElementById('eagle-library-merge-progress-host'));
  }, []);

  useEffect(() => {
    const calcuteTimeLeft = () => {
      const elapsedTime = (new Date().getTime()) - rootRef.current.updateStartTime;
      const chunksPerTime = rootRef.current.curr / elapsedTime;
      const estimatedTotalTime = rootRef.current.total / chunksPerTime;
      rootRef.current.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000 as any);
    };
    const ipc = getIpc();

    const onShow = (e: any, total: number) => {
      rootRef.current.curr = 0;
      rootRef.current.total = total;
      rootRef.current.isImporting = true;
      rootRef.current.updateStartTime = Date.now();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => ngSafe(() => { calcuteTimeLeft(); bumpAll(); }), 1000);
      bumpAll();
    };
    const onFinish = () => {
      rootRef.current.curr++;
      if (rootRef.current.curr >= rootRef.current.total) {
        rootRef.current.isImporting = false;
        rootRef.current.curr = 0;
        rootRef.current.total = 0;
        rootRef.current.timeLeftInSeconds = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        calcuteTimeLeft();
      }
      bumpAll();
    };
    const onCloseImport = () => {
      rootRef.current.isImporting = false;
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.timeLeftInSeconds = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      ngSafe(() => {
        const w = window as any;
        w.swal({
          html: `
                <div class="alert">
                    <div class="alert-icon success"></div>
                    <h4 class="alert-title">${t('dialog.mergeLibraryDone.title')}</h4>
                    <p class="alert-desc">${t('dialog.mergeLibraryDone.descript')}</p>
                </div>
            `,
          showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
          width: 400,
          customClass: 'alert-box',
          cancelButtonColor: '#777777',
          confirmButtonText: t('dialog.mergeLibraryDone.button'),
        }).then(() => {
          ipc && ipc.send && ipc.send('reload-app');
        });
      });
      bumpAll();
    };
    const cancel = () => {
      rootRef.current.isImporting = false;
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.updateStartTime = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      ipc && ipc.send && ipc.send('cancel.all');
      bumpAll();
    };

    ngSafe(() => {
      ipc && ipc.on && ipc.on('show-import-library-task', onShow);
      ipc && ipc.on && ipc.on('finish-import-library-task', onFinish);
      ipc && ipc.on && ipc.on('close-import-library', onCloseImport);
    });
    rootRef.current.cancel = cancel;

    return () => {
      ngSafe(() => {
        ipc && ipc.off && ipc.off('show-import-library-task', onShow);
        ipc && ipc.off && ipc.off('finish-import-library-task', onFinish);
        ipc && ipc.off && ipc.off('close-import-library', onCloseImport);
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const { isImporting, curr, total, timeLeftInSeconds } = rootRef.current;
  const width = (() => {
    const v = (curr / total * 100);
    return (Number.isFinite(v) ? v : 0) + '%';
  })();

  return createPortal(
    <>
      <div className={`progress-dialog${isImporting ? ' open' : ''}`} style={{ width: '400px' }}>
        {isImporting && (
          <div className="progress-dialog-content">
            <div className="message">
              {t('progress.mergingLibrary.msg')}... <span className="counter">{curr}/{total}</span>
              <span className="counter" style={ngShow(!!timeLeftInSeconds)}> ({second2time(timeLeftInSeconds)})</span>
            </div>
            <div className="progressbar" style={ngShow(!!isImporting)}>
              <div className="current" style={{ width }} />
            </div>
            <div className="button button-xs button-grey cancel-button" onClick={() => rootRef.current.cancel()}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= eaglepack-import-progress ================= */

export function EaglepackImportProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const intervalRef = useRef<any>(null);
  const rootRef = useRef<any>({});

  useEffect(() => {
    setHost(document.getElementById('eagle-eaglepack-import-progress-host'));
  }, []);

  useEffect(() => {
    const calcuteTimeLeft = () => {
      const elapsedTime = (new Date().getTime()) - rootRef.current.updateStartTime;
      const chunksPerTime = rootRef.current.curr / elapsedTime;
      const estimatedTotalTime = rootRef.current.total / chunksPerTime;
      rootRef.current.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000 as any);
    };
    const ipc = getIpc();

    const cancel = () => {
      rootRef.current.isExtracting = false;
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.updateStartTime = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      ipc && ipc.send && ipc.send('cancel.all');
      bumpAll();
    };
    const onShow = () => {
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.isExtracting = true;
      rootRef.current.updateStartTime = Date.now();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => ngSafe(() => { calcuteTimeLeft(); bumpAll(); }), 1000);
      bumpAll();
    };
    const onAdd = () => {
      rootRef.current.isExtracting = true;
      rootRef.current.total++;
      bumpAll();
    };
    const onCancelTask = () => {
      cancel();
      bumpAll();
    };
    const onFinish = () => {
      rootRef.current.curr++;
      if (rootRef.current.curr >= rootRef.current.total) {
        rootRef.current.isExtracting = false;
        rootRef.current.curr = 0;
        rootRef.current.total = 0;
        rootRef.current.timeLeftInSeconds = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        calcuteTimeLeft();
      }
      bumpAll();
    };

    ngSafe(() => {
      ipc && ipc.on && ipc.on('show-extract-task', onShow);
      ipc && ipc.on && ipc.on('add-extract-task', onAdd);
      ipc && ipc.on && ipc.on('cancel-extract-task', onCancelTask);
      ipc && ipc.on && ipc.on('finish-extract-task', onFinish);
    });
    rootRef.current.cancel = cancel;

    return () => {
      ngSafe(() => {
        ipc && ipc.off && ipc.off('show-extract-task', onShow);
        ipc && ipc.off && ipc.off('add-extract-task', onAdd);
        ipc && ipc.off && ipc.off('cancel-extract-task', onCancelTask);
        ipc && ipc.off && ipc.off('finish-extract-task', onFinish);
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const { isExtracting, curr, total, timeLeftInSeconds } = rootRef.current;
  const width = (() => {
    const v = (curr / total * 100);
    return (Number.isFinite(v) ? v : 0) + '%';
  })();

  return createPortal(
    <>
      <div id="extract-eaglepack-progress" className={`progress-dialog${isExtracting ? ' open' : ''}`}>
        {isExtracting && (
          <div className="progress-dialog-content">
            <div className="message" style={ngShow(total === 0)}>{t('progress.extractPack.startMsg')}...</div>
            <div className="message" style={ngShow(total > 0)}>
              {t('progress.extractPack.doningMsg')}... <span className="counter" style={ngShow(!!timeLeftInSeconds)}>({second2time(timeLeftInSeconds)})</span>
            </div>
            <div className="progressbar" style={ngShow(!!isExtracting)}>
              <div className="current" style={{ width }} />
            </div>
            <div className="button button-xs button-grey cancel-button" onClick={() => rootRef.current.cancel()}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= eaglepack-export-progress ================= */

export function EaglepackExportProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const intervalRef = useRef<any>(null);
  const rootRef = useRef<any>({});

  useEffect(() => {
    setHost(document.getElementById('eagle-eaglepack-export-progress-host'));
  }, []);

  useEffect(() => {
    const calculateProgress = () => {
      if (rootRef.current.curr === 0) return;
      const a = parseInt(rootRef.current.curr / rootRef.current.total * 50 as any);
      const b = parseInt(rootRef.current.percent as any) || 0;
      rootRef.current.progress = a + b;
      if (rootRef.current.progress >= 100) {
        rootRef.current.progress = 100;
      }
      if (rootRef.current.percent >= 100) {
        rootRef.current.isArchiving = false;
        rootRef.current.curr = 0;
        rootRef.current.total = 0;
      }
    };
    const calcuteTimeLeft = () => {
      const elapsedTime = (new Date().getTime()) - rootRef.current.updateStartTime;
      const chunksPerTime = rootRef.current.percent / elapsedTime;
      const estimatedTotalTime = 100 / chunksPerTime;
      rootRef.current.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000 as any);
    };
    const ipc = getIpc();

    const cancel = () => {
      rootRef.current.isArchiving = false;
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.percent = 0;
      rootRef.current.updateStartTime = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      ipc && ipc.send && ipc.send('cancel.all');
      bumpAll();
    };
    const onShow = () => {
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.percent = 0;
      rootRef.current.isArchiving = true;
      rootRef.current.updateStartTime = Date.now();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => ngSafe(() => { calcuteTimeLeft(); bumpAll(); }), 1000);
      bumpAll();
    };
    const onAdd = () => {
      rootRef.current.isArchiving = true;
      rootRef.current.total++;
      calculateProgress();
      bumpAll();
    };
    const onUpdatePercent = (e: any, percent: number) => {
      if (percent > rootRef.current.percent) {
        rootRef.current.percent = percent || 0;
        calcuteTimeLeft();
        calculateProgress();
        bumpAll();
      }
    };
    const onFinish = () => {
      rootRef.current.curr++;
      calculateProgress();
      if (intervalRef.current) clearInterval(intervalRef.current);
      bumpAll();
    };
    const onAbort = () => {
      rootRef.current.isArchiving = false;
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.percent = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      bumpAll();
    };

    ngSafe(() => {
      ipc && ipc.on && ipc.on('show-archive-task', onShow);
      ipc && ipc.on && ipc.on('add-archive-task', onAdd);
      ipc && ipc.on && ipc.on('update-archive-percent', onUpdatePercent);
      ipc && ipc.on && ipc.on('finish-archive-task', onFinish);
      ipc && ipc.on && ipc.on('abort-archive-task', onAbort);
    });
    rootRef.current.cancel = cancel;

    return () => {
      ngSafe(() => {
        ipc && ipc.off && ipc.off('show-archive-task', onShow);
        ipc && ipc.off && ipc.off('add-archive-task', onAdd);
        ipc && ipc.off && ipc.off('update-archive-percent', onUpdatePercent);
        ipc && ipc.off && ipc.off('finish-archive-task', onFinish);
        ipc && ipc.off && ipc.off('abort-archive-task', onAbort);
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const { isArchiving, total, percent, timeLeftInSeconds } = rootRef.current;

  return createPortal(
    <>
      <div className={`progress-dialog${isArchiving ? ' open' : ''}`}>
        {isArchiving && (
          <div className="progress-dialog-content">
            <div className="message" style={ngShow(total === 0)}>{t('progress.archive.startMsg')}...</div>
            <div className="message" style={ngShow(total > 0)}>
              {t('progress.archive.doingMsg')}... <span className="counter" style={ngShow(!!timeLeftInSeconds)}>({second2time(timeLeftInSeconds)})</span>
            </div>
            <div className="progressbar" style={ngShow(!!isArchiving)}>
              <div className="current" style={{ width: (percent || 0) + '%' }} />
            </div>
            <div className="button button-xs button-grey cancel-button" onClick={() => rootRef.current.cancel()}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= file-thumbnail-progress（空 link；body scope 桥接） ================= */

export function FileThumbnailProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const [lengths, setLengths] = useState<{ total: number; finish: number }>({ total: 0, finish: 0 });

  useEffect(() => {
    setHost(document.getElementById('eagle-file-thumbnail-progress-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    // 模板绑定 regenerateThumbnailQueue/finishGenerateQueue 解析到 body scope（原版空 link）；
    // 队列原地 push/splice 引用不变 → 函数型 watcher 读 length 串（等价模板逐 digest 重读插值）
    const read = () => {
      const b = getBodyScope();
      return `${b && b.finishGenerateQueue ? b.finishGenerateQueue.length : 0}|${b && b.regenerateThumbnailQueue ? b.regenerateThumbnailQueue.length : 0}`;
    };
    const sync = () => {
      const b = getBodyScope();
      setLengths({
        finish: b && b.finishGenerateQueue ? b.finishGenerateQueue.length : 0,
        total: b && b.regenerateThumbnailQueue ? b.regenerateThumbnailQueue.length : 0,
      });
      bumpAll();
    };
    const off = body.$watch(read, sync);
    sync();
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const isOpen = lengths.total > 0;
  const cancelRegenerateThumbnail = () => {
    scopeApply(getBodyScope(), () => cancelRegenerateThumbnailAction());
  };

  return createPortal(
    <>
      <div className={`progress-dialog${isOpen ? ' open' : ''}`}>
        {isOpen && (
          <div className="progress-dialog-content">
            <div className="message">
              {t('progress.regenerateThumbanil.msg')}...<span className="counter">({lengths.finish}/{lengths.total})</span>
            </div>
            <div className="progressbar" style={ngShow(isOpen)}>
              <div className="current" style={{ width: (lengths.total > 0 ? lengths.finish / lengths.total * 100 : 0) + '%' }} />
            </div>
            <div className="button button-xs button-grey cancel-button" onClick={cancelRegenerateThumbnail}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= file-export-progress（ipc 三通道） ================= */

export function FileExportProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const intervalRef = useRef<any>(null);
  const rootRef = useRef<any>({ isExporting: false, curr: 0, total: 0, timeLeftInSeconds: 0, updateStartTime: 0 });

  useEffect(() => {
    setHost(document.getElementById('eagle-file-export-progress-host'));
  }, []);

  useEffect(() => {
    const calcuteTimeLeft = () => {
      const elapsedTime = (new Date().getTime()) - rootRef.current.updateStartTime;
      const chunksPerTime = rootRef.current.curr / elapsedTime;
      const estimatedTotalTime = rootRef.current.total / chunksPerTime;
      rootRef.current.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000 as any);
    };
    const close = () => {
      rootRef.current.curr = 0;
      rootRef.current.total = 0;
      rootRef.current.isExporting = false;
      rootRef.current.timeLeftInSeconds = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    const ipc = getIpc();

    const onShow = (e: any, total: number) => {
      if (total > 0) {
        rootRef.current.total += total;
        rootRef.current.isExporting = true;
        rootRef.current.updateStartTime = Date.now();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => ngSafe(() => { calcuteTimeLeft(); bumpAll(); }), 1000);
        bumpAll();
      }
    };
    const onFinish = (e: any, finishDir: string) => {
      rootRef.current.curr++;
      if (rootRef.current.curr >= rootRef.current.total) {
        if (rootRef.current.isExporting && finishDir) {
          ipc && ipc.send && ipc.send('show-item-in-folder', finishDir);
        }
        close();
      } else {
        calcuteTimeLeft();
      }
      bumpAll();
    };
    const onClose = () => {
      // 原版仅 $evalAsync + clearInterval；mock shims 另以 DOM poke 重置 isolate scope
      // （query file-export-progress 元素，换壳后落空）——合并两者语义：重置 + 清 interval，
      // 保证主进程错误路径（close-export-task）弹窗关闭，与旧版 mock 观感一致。
      close();
      bumpAll();
    };
    const cancel = () => {
      close();
      ipc && ipc.send && ipc.send('cancel.all');
      bumpAll();
    };

    ngSafe(() => {
      ipc && ipc.on && ipc.on('show-export-task', onShow);
      ipc && ipc.on && ipc.on('finish-export-task', onFinish);
      ipc && ipc.on && ipc.on('close-export-task', onClose);
    });
    rootRef.current.cancel = cancel;

    return () => {
      ngSafe(() => {
        ipc && ipc.off && ipc.off('show-export-task', onShow);
        ipc && ipc.off && ipc.off('finish-export-task', onFinish);
        ipc && ipc.off && ipc.off('close-export-task', onClose);
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const { isExporting, curr, total, timeLeftInSeconds } = rootRef.current;
  const width = (() => {
    const v = (curr / total * 100);
    return (Number.isFinite(v) ? v : 0) + '%';
  })();

  return createPortal(
    <>
      <div className={`progress-dialog${isExporting ? ' open' : ''}`}>
        {isExporting && (
          <div className="progress-dialog-content">
            <div className="message">
              {t('progress.exporting.msg')}...<span className="counter" style={ngShow(!!timeLeftInSeconds)}> ({second2time(timeLeftInSeconds)})</span>
            </div>
            <div className="progressbar" style={ngShow(!!isExporting)}>
              <div className="current" style={{ width }} />
            </div>
            <div className="button button-xs button-grey cancel-button" onClick={() => rootRef.current.cancel()}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= debug-report-progress（空 link；body scope 桥接） ================= */

export function DebugReportProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const [st, setSt] = useState<{ isExporting: boolean; progress: number }>({ isExporting: false, progress: 0 });

  useEffect(() => {
    setHost(document.getElementById('eagle-debug-report-progress-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    // debugReportStatus 由 debug-reporter 写在 body scope（106539）；两个原始值 watch 即可
    const read = () => {
      const b = getBodyScope();
      const s = b && b.debugReportStatus ? b.debugReportStatus : {};
      return `${s.isExporting ? 1 : 0}|${s.progress}`;
    };
    const sync = () => {
      const b = getBodyScope();
      const s = b && b.debugReportStatus ? b.debugReportStatus : {};
      setSt({ isExporting: !!s.isExporting, progress: Number(s.progress) || 0 });
      bumpAll();
    };
    const off = body.$watch(read, sync);
    sync();
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  return createPortal(
    <>
      <div id="export-debug-report-dialog" className={`progress-dialog${st.isExporting ? ' open' : ''}`}>
        {st.isExporting && (
          <div className="progress-dialog-content">
            <div className="message">{t('dialog.debugReport.exporting')}</div>
            <div className="progressbar" style={ngShow(!!st.isExporting)}>
              <div className="current" style={{ width: st.progress + '%' }} />
            </div>
            {/* 原版此按钮无 ng-click（纯装饰），逐字保留 */}
            <div className="button button-xs button-grey cancel-button cancel">{t('general.cancel')}</div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= file-add-library-progress（ADD_TO_LIBRARY 广播 + 复制流程逐字） ================= */

export function FileAddLibraryProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const rootRef = useRef<any>({ isAdding: false, curr: 0, total: 0, libraryName: '', forceQuit: false });

  useEffect(() => {
    setHost(document.getElementById('eagle-file-add-library-progress-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    const ipc = getIpc();
    const w = window as any;
    const fsMod = req('fs');
    const fse = req('fs-extra');
    const pathMod = req('path');

    const updateLibraryMetadata = (targetMetadataPath: string, newMetadataJSON: string) => {
      const tempDir = targetMetadataPath.replace('metadata.json', '~$metadata.json.tmp');
      fsMod.writeFileSync(tempDir, newMetadataJSON);
      const outstream = fsMod.createWriteStream(targetMetadataPath, { flags: 'w' });
      outstream.write(newMetadataJSON);
      outstream.on('finish', function () {
        const jsonBytes = (window as any).Buffer.byteLength(newMetadataJSON, 'utf8');
        const jsonSizeStr = jsonBytes >= 1048576 ? (jsonBytes / 1048576).toFixed(2) + ' MB' : (jsonBytes / 1024).toFixed(2) + ' KB';
        ipc && ipc.send && ipc.send('electron-info', `[bg] metadata.json updated successfully: ${targetMetadataPath} (${jsonSizeStr})`);
        console.log('除存成功');
        fse.remove(tempDir);
      });
      outstream.on('error', function (err: any) {
        ipc && ipc.send && ipc.send('electron-log', '' + err.stack || err);
        try {
          fsMod.renameSync(tempDir, targetMetadataPath);
        } catch (err2: any) {
          ipc && ipc.send && ipc.send('electron-log', '' + err2.stack || err2);
        }
      });
      outstream.end();
    };

    const copyToLibrary = (item: any, libraryPath: string, folder: any, index: number, callback: any) => {
      try {
        const itemDir = `${pathMod.dirname(w.FileUrlHelper.getRawPath(item))}/`;
        const outDir = pathMod.normalize(`${libraryPath}/images/${item.id}.info/`);
        const newMetadataFile = pathMod.normalize(`${outDir}/metadata.json`);
        fsMod.exists(outDir, function (isExists: boolean) {
          if (isExists) {
            return callback();
          } else {
            fse.copy(itemDir, outDir, function (err: any) {
              if (err) {
                ipc && ipc.send && ipc.send('electron-log', '' + err.stack || err);
                return callback(err);
              }
              fsMod.readFile(newMetadataFile, 'utf8', function (err2: any, result: string) {
                try {
                  const newItem = JSON.parse(result);
                  // 框选搬移文件，需移除原来的 folders 属性
                  if (!folder) {
                    newItem.folders = [];
                  }
                  // 自动排序的文件夹，不更新修改时间
                  if (folder?.orderBy === 'MANUAL') {
                  } else {
                    newItem.modificationTime = Date.now() + index;
                  }
                  const json = JSON.stringify(newItem);
                  fsMod.writeFile(newMetadataFile, json, function (err3: any) {
                    callback(err3);
                  });
                } catch (err4: any) {
                  ipc && ipc.send && ipc.send('electron-log', '' + err4.stack || err4);
                  return callback(err4);
                }
              });
            });
          }
        });
      } catch (err) {
        callback(err);
      }
    };

    const addToLibrary = (params: any) => {
      rootRef.current.isAdding = true;
      rootRef.current.total = params.items.length;
      rootRef.current.libraryName = params.library.name;
      rootRef.current.msg = t('progress.copyingToLibrary.msg', [{ property: 'path', value: rootRef.current.libraryName }]);

      const libraryPath = params.library.path;
      const items = params.items;
      let folder = params.folder ? structuredClone(params.folder) : undefined;
      const smartFolder = params.smartFolder ? structuredClone(params.smartFolder) : undefined;
      const tagGroup = params.tagGroup ? structuredClone(params.tagGroup) : undefined;
      const success: any[] = [];
      const fail: any[] = [];

      // 資源庫不存在
      if (!fsMod.existsSync(libraryPath)) {
        ipc && ipc.send && ipc.send('show-error-box', {
          title: t('dialog.libraryMissed.title'),
          message: t('dialog.libraryMissed.desc'),
        });
        bumpAll();
        return;
      }

      if (tagGroup) {
        ipc && ipc.send && ipc.send('electron-info', `[app] Add tagGroup(${tagGroup.name}) to other library: ${libraryPath}`);
        const targetMetadataPath = pathMod.normalize(`${libraryPath}/metadata.json`);
        fsMod.readFile(targetMetadataPath, 'utf8', function (err: any, metadataJSON: string) {
          if (err) {
            ipc && ipc.send && ipc.send('electron-log', '' + err.stack || err);
          } else {
            const lib = JSON.parse(metadataJSON);
            const targetTagsGroups = lib.tagsGroups;
            tagGroup.id = w.guid();
            targetTagsGroups.unshift(tagGroup);
            lib.modificationTime = Date.now();
            const newMetadataJSON = JSON.stringify(lib);
            updateLibraryMetadata(targetMetadataPath, newMetadataJSON);
            getRootScope().notify({ message: t('general.taskFinished'), duration: 800 });
          }
        });
        rootRef.current.isAdding = false;
        bumpAll();
        return;
      }

      if (smartFolder) {
        ipc && ipc.send && ipc.send('electron-info', `[app] Add smartFolder(${smartFolder.name}) to other library: ${libraryPath}`);
        const targetMetadataPath = pathMod.normalize(`${libraryPath}/metadata.json`);
        fsMod.readFile(targetMetadataPath, 'utf8', function (err: any, metadataJSON: string) {
          if (err) {
            ipc && ipc.send && ipc.send('electron-log', '' + err.stack || err);
          } else {
            const lib = JSON.parse(metadataJSON);
            const targetSmartFolders = lib.smartFolders;
            // 更换所有智能文件夹 ID
            smartFolder.id = w.guid();
            w.eagle.utils.tree.walk(smartFolder.children, 'children', function (child: any, parent: any) {
              child.id = w.guid();
            });
            targetSmartFolders.unshift(smartFolder);
            lib.modificationTime = Date.now();
            const newMetadataJSON = JSON.stringify(lib);
            updateLibraryMetadata(targetMetadataPath, newMetadataJSON);
            getRootScope().notify({ message: t('general.taskFinished'), duration: 800 });
          }
        });
        rootRef.current.isAdding = false;
        bumpAll();
        return;
      }

      if (folder) {
        const clones: any[] = [];
        w.cloneTree(clones, [folder]);
        folder = clones[0];
        ipc && ipc.send && ipc.send('electron-info', `[app] Add folder(${folder.name}) contains ${items.length} files to other library: ${libraryPath}`);
        const targetMetadataPath = pathMod.normalize(`${libraryPath}/metadata.json`);
        fsMod.readFile(targetMetadataPath, 'utf8', function (err: any, metadataJSON: string) {
          if (err) {
            ipc && ipc.send && ipc.send('electron-log', '' + err.stack || err);
          } else {
            const lib = JSON.parse(metadataJSON);
            const targetFolders = lib.folders;
            const existsFolders: any = {};
            targetFolders.forEach(function (targetFolder: any) {
              existsFolders[targetFolder.id] = true;
            });
            w.eagle.utils.tree.walk(targetFolders, 'children', function (child: any, parent: any) {
              existsFolders[child.id] = true;
            });
            // 避免重复文件夹
            const removeFolders: any[] = [];
            w.eagle.utils.tree.walk(folder.children, 'children', function (child: any, parent: any) {
              if (parent && existsFolders[child.id]) {
                const idx = parent.children.indexOf(child);
                if (idx > -1) {
                  removeFolders.push({ folder: child, parent });
                }
              }
            });
            removeFolders.forEach(function (f: any) {
              const parent = f.parent;
              const folderItem = f.folder;
              const idx = parent.children.indexOf(folderItem);
              if (idx > -1) {
                parent.children.splice(idx, 1);
              }
            });
            if (!existsFolders[folder.id]) {
              targetFolders.unshift(folder);
              lib.modificationTime = Date.now();
              const newMetadataJSON = JSON.stringify(lib);
              updateLibraryMetadata(targetMetadataPath, newMetadataJSON);
            }
          }
        });
      } else {
        ipc && ipc.send && ipc.send('electron-info', `[app] Add ${items.length} files to other library: ${libraryPath}`);
      }

      const cbs = items.map(function (item: any, index: number) {
        return function (callback: any) {
          if (rootRef.current.forceQuit) {
            fail.push(item);
            callback();
            return;
          }
          copyToLibrary(item, libraryPath, folder, index, function (err: any) {
            if (err) {
              fail.push(item);
              ipc && ipc.send && ipc.send('electron-log', `[app] Add ${item.name} fail`);
              ipc && ipc.send && ipc.send('electron-log', '' + err.stack || err);
            } else {
              success.push(item);
            }
            rootRef.current.curr++;
            bumpAll();
            callback();
          });
        };
      });

      const asyncMod = req('async');
      asyncMod.parallelLimit(cbs, 5, function () {
        rootRef.current.isAdding = false;
        rootRef.current.curr = 0;
        rootRef.current.total = 0;
        rootRef.current.forceQuit = false;
        ipc && ipc.send && ipc.send('electron-info', `[app] Add to library finished, total: ${items.length}, success: ${success.length}, fail: ${fail.length}`);
        getRootScope().notify({ message: t('general.taskFinished'), duration: 800 });

        const targetMtimePath = pathMod.normalize(`${libraryPath}/mtime.json`);
        fsMod.readFile(targetMtimePath, 'utf8', function (err: any, data: string) {
          if (!err) {
            const mtimeMappings = JSON.parse(data);
            items.forEach(function (item: any) {
              mtimeMappings[item.id] = item.lastModified;
            });
            const updatedMtimeJSON = JSON.stringify(mtimeMappings);
            fsMod.writeFile(targetMtimePath, updatedMtimeJSON, function () { });
          }
        });
        bumpAll();
      });
    };

    const cancel = () => {
      rootRef.current.isAdding = false;
      rootRef.current.forceQuit = true;
      ipc && ipc.send && ipc.send('electron-info', `[app] User interrupt the add library task.`);
      bumpAll();
    };
    rootRef.current.cancel = cancel;

    const onAddToLibrary = (params: any) => {
      ngSafe(() => {
        if (!params.library || !params.items) return;
        if (params.smartFolder || params.tagGroup) {
          addToLibrary(params);
          return;
        }

        if (params.items.length === 1) {
          addToLibrary(params);
          bumpAll();
        } else {
          const html = t('Dialog.BulkAction.Descript', [{ property: 'count', value: params.items.length }]);
          w.swal({
            html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${t('Dialog.BulkAction.Title')}</h4>
                        <p class="alert-desc">${html}</p>
                    </div>
                `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
            width: 400,
            customClass: 'alert-box',
            cancelButtonColor: '#777777',
            confirmButtonText: t('Dialog.BulkAction.Button'),
            cancelButtonText: t('general.cancel'),
          }).then(function () {
            addToLibrary(params);
            bumpAll();
          }, function () { });
        }
      });
    };

    const off = addToLibraryChannel.on(onAddToLibrary);

    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const { isAdding, curr, total, msg } = rootRef.current;
  const width = (() => {
    const v = (curr / total * 100);
    return (Number.isFinite(v) ? v : 0) + '%';
  })();

  return createPortal(
    <>
      <div id="add-to-library-progress" className={`progress-dialog${isAdding ? ' open' : ''}`}>
        {isAdding && (
          <div className="progress-dialog-content">
            <div className="message">{iv(msg)} <span className="counter">({curr}/{total})</span></div>
            <div className="progressbar" style={ngShow(!!isAdding)}>
              <div className="current" style={{ width }} />
            </div>
            <div className="button button-xs button-grey cancel-button" onClick={() => rootRef.current.cancel()}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= webp-convert-progress（WEBP_CONVERT_START 广播 + webp.converted ipc） ================= */

export function WebpConvertProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const rootRef = useRef<any>({ queue: [], finishQueue: [] });

  useEffect(() => {
    setHost(document.getElementById('eagle-webp-convert-progress-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    const ipc = getIpc();
    const w = window as any;

    // ayncsWebpConvert（镜像 69-98 逐字：20 一批 rAF 循环，backgroundWindowID 判定 send/sendTo）
    const ayncsWebpConvert = (tasks: any[]) => {
      if (!tasks || tasks.length === 0) return;
      setTimeout(() => {
        const total = tasks.length;
        const once = 20;
        const loopCount = total / once;
        let countOfSend = 0;

        const send = () => {
          const start = countOfSend * once;
          const willSendImages = tasks.slice(start, start + once);
          countOfSend += 1;
          console.log('第 %d 批傳送，目前進度 %d / %d', countOfSend, willSendImages.length + (countOfSend - 1) * once, total);
          if (w.backgroundWindowID === undefined) {
            ipc && ipc.send && ipc.send('webp-convert', willSendImages);
          } else {
            ipc && ipc.sendTo && ipc.sendTo(w.backgroundWindowID, 'webp-convert', willSendImages);
          }
          loop();
        };

        const loop = () => {
          if (countOfSend < loopCount) {
            w.requestAnimationFrame(send);
          }
        };
        loop();
      }, 0);
    };

    const cancelWebpConvert = () => {
      // 原版经 IPCHelper.send（bundle 顶层 const，window 上不可见）→ 等价直接 ipcRenderer.send
      ipc && ipc.send && ipc.send('cancel.webp.convert');
      rootRef.current.queue = [];
      rootRef.current.finishQueue = [];
      bumpAll();
    };
    rootRef.current.cancel = cancelWebpConvert;

    const onStart = (params: any) => {
      ngSafe(() => {
        const images = params && params.images;
        const format = params && params.format;
        if (!images || images.length === 0 || !format) return;
        const webpConvertTasks: any[] = [];
        images.forEach((image: any) => {
          if (image && image.ext === 'webp') {
            webpConvertTasks.push({
              image: image,
              format: format,
            });
          }
        });
        const message = t('dialog.webpConvert.desc', [
          { property: 'count', value: String(webpConvertTasks.length) },
          { property: 'format', value: String(format).toUpperCase() },
        ]);
        w.swal({
          html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${t('dialog.webpConvert.title')}</h4>
                            <p class="alert-desc">${message}</p>
                        </div>
                    `,
          showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
          width: 400,
          customClass: 'alert-box',
          cancelButtonColor: '#777777',
          confirmButtonText: t('dialog.webpConvert.button'),
          cancelButtonText: t('general.cancel'),
        }).then(() => {
          webpConvertTasks.forEach((task: any) => {
            rootRef.current.queue.push(task.image);
          });
          if (webpConvertTasks.length > 0) {
            ayncsWebpConvert(webpConvertTasks);
          }
          bumpAll();
        });
      });
    };

    const onConverted = (e: any, converted: any) => {
      rootRef.current.finishQueue.push(converted);
      if (rootRef.current.finishQueue.length === rootRef.current.queue.length) {
        rootRef.current.finishQueue = [];
        rootRef.current.queue = [];
      }
      bumpAll();
    };

    const offStart = webpConvertStartChannel.on(onStart);
    ngSafe(() => {
      ipc && ipc.on && ipc.on('webp.converted', onConverted);
    });

    return () => {
      offStart();
      ngSafe(() => {
        ipc && ipc.off && ipc.off('webp.converted', onConverted);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const { queue, finishQueue } = rootRef.current;
  const isOpen = queue.length > 0;
  const width = (() => {
    const v = (finishQueue.length / queue.length * 100);
    return (Number.isFinite(v) ? v : 0) + '%';
  })();

  return createPortal(
    <>
      <div className={`progress-dialog${isOpen ? ' open' : ''}`}>
        {isOpen && (
          <div className="progress-dialog-content">
            <div className="message">
              {t('progress.webpConvert.msg')}... <span className="counter">({finishQueue.length}/{queue.length})</span>
            </div>
            <div className="progressbar" style={ngShow(isOpen)}>
              <div className="current" style={{ width }} />
            </div>
            <div className="button button-xs button-grey cancel-button" onClick={() => rootRef.current.cancel()}>
              {t('general.cancel')}
            </div>
          </div>
        )}
      </div>
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

/* ================= fixutil-clean-empty-folder / fixutil（空 link；body.fixUtils 桥接） ================= */

// hooks 规则：bumpAllRef 必须在组件早退前稳定存在（useFixUtilsBridge 内部使用）
const bumpAllRef = { current: () => {} };

/** fixUtils 字段函数型 watcher 桥接（等价模板逐 digest 重读；对象字段原地赋值） */
function useFixUtilsBridge(fields: string[]) {
  const [values, setValues] = useState<any>(() => fields.map(() => 0));
  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    const read = () => {
      const b = getBodyScope();
      const fu = b && b.fixUtils ? b.fixUtils : {};
      return fields.map((f) => String(fu[f])).join('|');
    };
    const sync = () => {
      const b = getBodyScope();
      const fu = b && b.fixUtils ? b.fixUtils : {};
      setValues(fields.map((f) => (fu[f] === undefined ? 0 : fu[f])));
      bumpAllRef.current();
    };
    const off = body.$watch(read, sync);
    sync();
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return values;
}

export function FixutilCleanEmptyFolderProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  bumpAllRef.current = () => bump((v: number) => v + 1);
  const [isCleaning, current, total] = useFixUtilsBridge(['isCleaningEmptyFolders', 'currentEmptyfolderRemoved', 'emptyFolderRemoved']);

  useEffect(() => {
    setHost(document.getElementById('eagle-fixutil-clean-empty-folder-progress-host'));
  }, []);

  if (!host) return null;

  // 原版外壳带 ng-if（isCleaning=false 时整个 .progress-dialog 不在 DOM，overlay 恒在）
  return createPortal(
    <>
      {!!isCleaning && (
        <div className="progress-dialog open">
          <div className="progress-dialog-content">
            <div className="message">
              {t('progress.fixUtils.removeEmptyFolder.msg')}
              <span className="counter"> ({ngNumber(current, 0)}/{ngNumber(total, 0)})</span>
            </div>
            <div className="progressbar">
              <div className="current" style={{ width: (Number.isFinite(current / total * 100) ? current / total * 100 : 0) + '%' }} />
            </div>
            {/* 原版 ng-click="cancel()" 解析到 body scope 的 cancel——不存在（$exceptionHandler 吞），
                用户可见行为为无操作；scopeApply + 守卫等价 */}
            <div
              className="button button-xs button-grey cancel-button"
              onClick={() => scopeApply(getBodyScope(), (s: any) => s.cancel && s.cancel())}
            >
              {t('general.cancel')}
            </div>
          </div>
        </div>
      )}
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}

export function FixutilProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  bumpAllRef.current = () => bump((v: number) => v + 1);
  const [isFixing, curr, total] = useFixUtilsBridge(['isFixing', 'fixingCurr', 'fixingTotal']);

  useEffect(() => {
    setHost(document.getElementById('eagle-fixutil-progress-host'));
  }, []);

  if (!host) return null;

  return createPortal(
    <>
      {!!isFixing && (
        <div className="progress-dialog open">
          <div className="progress-dialog-content">
            <div className="message">
              Scaning... <span className="counter">({ngNumber(curr, 0)}/{ngNumber(total, 0)})</span>
            </div>
            <div className="progressbar">
              <div className="current" style={{ width: (Number.isFinite(curr / total * 100) ? curr / total * 100 : 0) + '%' }} />
            </div>
            {/* 同上：body.cancel 不存在（原版怪癖） */}
            <div
              className="button button-xs button-grey cancel-button"
              onClick={() => scopeApply(getBodyScope(), (s: any) => s.cancel && s.cancel())}
            >
              {t('general.cancel')}
            </div>
          </div>
        </div>
      )}
      <div className="progress-dialog-overlay" />
    </>,
    host
  );
}
