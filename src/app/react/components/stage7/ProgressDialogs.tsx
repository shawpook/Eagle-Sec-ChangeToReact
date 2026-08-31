import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBodyScope, scopeApply } from '../../global/scopeBridge';
import { t } from '../../global/eagleGlobals';
import { second2time } from '../../app/filters';
import { getIpc } from '../detail/detailHooks';

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
    scopeApply(getBodyScope(), (s: any) => s.cancelEmptyTrash && s.cancelEmptyTrash());
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
