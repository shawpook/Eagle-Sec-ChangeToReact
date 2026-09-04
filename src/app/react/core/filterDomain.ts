/**
 * cZ-5：筛选/搜索域——3 通道截肢 + eagle.filter watch 族 12 个 + 2 个 $on 广播处理器接管。
 *
 * - **通道**：keyword-suggestion（23520 → globalKeywords）/ show-and-search（23705 →
 *   show+focus+searchInAll）/ filter-folder（23712 → #folder-search 聚焦）。
 * - **watch 族（34180-34199，12 个）**：file/duration/bpm 的 min/max ×6、shape width/height
 *   ×2（双双就位才 filterContent）、resolution minW/maxW/minH/maxH ×4 → 全部
 *   filterContent()。scope watch 不随通道消亡——按 exp 从 scope.$$watchers 摘除 bundle
 *   watcher 后域内重挂同表达式。
 * - **$on 广播（42371/42375）**：CALCULATE_IMAGE_BINDING → calculateImageBinding(params)；
 *   REBIND_REFRESH → $timeout(500) rebindRefresh(mute)。bundle 仍有多处 $rootScope.$broadcast
 *   发送方（43433/55168/59582 等，未移植代码路径），接收端由本域独占——按 $$listeners 摘除
 *   bundle 处理器后重挂。UPDATE_SELECTION/SAVE_FOLDER 留 cZ-6。
 */

import { removeChannelListenersBySource, sweepForeignWatchers, persistSweep } from './appCore';
import { getBodyScope } from '../global/scopeBridge';
import { ipcRenderer } from '../global/eagleGlobals';

let done = false;

function domainTimeout(s: any, fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { s.$apply(); } catch (err) { /* noop */ } }
  }, ms || 0);
}


/* 按事件名摘除 scope $$listener（幂等；返回摘除数） */
function removeScopeListener(s: any, evt: string): number {
  let removed = 0;
  try {
    const listeners = s.$$listeners && s.$$listeners[evt];
    if (Array.isArray(listeners)) {
      removed = listeners.length;
      s.$$listeners[evt] = [];
    }
  } catch (err) { /* noop */ }
  return removed;
}

export function takeoverFilterDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const ipc: any = ipcRenderer();
  if (!ipc || typeof ipc.on !== 'function') return;
  const s0probe = (): any => getBodyScope();

  const diag: any = { takenOver: true, removed: {} as Record<string, number>, watchesRemoved: 0, listenersRemoved: {} as Record<string, number> };
  try {
    const ws0 = (s0probe() as any).$watchers || [];
    diag.watchersAtTakeover = ws0.length;
    diag.filterWatchersAtTakeover = ws0.filter((x: any) => typeof x.exp === 'string' && String(x.exp).indexOf('eagle.filter') === 0).length;
  } catch (err) { diag.watchersAtTakeover = 'err:' + String(err).slice(0, 80); }
  w.__eagleFilterDomain = diag;

  // ── 通道截肢 ──
  diag.removed['keyword-suggestion'] = removeChannelListenersBySource(ipc, 'keyword-suggestion', [
    'globalKeywords = keywords',
  ]);
  diag.removed['show-and-search'] = removeChannelListenersBySource(ipc, 'show-and-search', [
    'searchInAll()',
  ]);
  diag.removed['filter-folder'] = removeChannelListenersBySource(ipc, 'filter-folder', [
    'folder-search',
  ]);

  // ── 通道重挂（逐字）──
  // keyword-suggestion（23520）
  ipc.on('keyword-suggestion', function (_event: any, keywords: any) {
    const s: any = getBodyScope();
    if (!s) return;
    if (keywords) {
      s.globalKeywords = keywords;
    }
  });

  // show-and-search（23705）
  ipc.on('show-and-search', function (_e: any) {
    const s: any = getBodyScope();
    if (!s) return;
    const currentWindow: any = (w.electron && w.electron.remote && w.electron.remote.getCurrentWindow && w.electron.remote.getCurrentWindow())
      || (w.require && w.require('@electron/remote') && w.require('@electron/remote').getCurrentWindow && w.require('@electron/remote').getCurrentWindow());
    if (currentWindow) {
      currentWindow.show();
      currentWindow.focus();
    }
    s.searchInAll();
    s.$evalAsync();
  });

  // filter-folder（23712）
  ipc.on('filter-folder', function (_event: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.$evalAsync(function () {
      w.$("#folder-search").focus();
    });
  });

  // ── toggleFilter（30898 逐字；b1-9k 补端口——Toolbar 筛选按钮 onClick=call('toggleFilter')，
  //    缺席时 call() 静默 no-op → 按钮 active 不翻转、FilterItems2 消费的 filterIsOpen 恒 false。
  //    updateContainerHieght 为 controllerFns 移植件（bundle 原码 typo 逐字保留））──
  const s0toggle: any = getBodyScope();
  if (s0toggle) {
    s0toggle.toggleFilter = function () {
      const s: any = getBodyScope();
      if (!s) return;
      w.eagle.filter.isOpen = !w.eagle.filter.isOpen;
      if (!w.eagle.filter.isOpen) {
        w.$("[filter-item].open").removeClass("open");
      }
      s.updateContainerHieght(true);
      if (w.eagle.filter.isOpen) { w.electronLog && w.electronLog.info("[app] Filter: ON"); }
      else { w.electronLog && w.electronLog.info("[app] Filter: OFF"); }
    };
  }

  // ── eagle.filter watch 族 12 个（摘 bundle watcher → 域内重挂同表达式）──
  const s0: any = getBodyScope();
  if (s0 && typeof s0.$watch === 'function') {
    // 注册本域 watcher 句柄 → sweep 清扫 bundle 同 exp watcher（含竞态晚注册的 2s/8s 复扫）
    const claim = (exp: string, fn: any) => {
      s0.$watch(exp, fn);
      diag.watchesRemoved += sweepForeignWatchers(s0, exp, [fn]);
      persistSweep(s0, exp, [fn], undefined, undefined, diag);
    };
    const filterContentWatch = (exp: string) => {
      claim(exp, function () {
        const s: any = getBodyScope();
        if (!s) return;
        s.filterContent();
      });
    };
    const shapeWatch = (exp: string) => {
      claim(exp, function () {
        const s: any = getBodyScope();
        if (!s) return;
        if (w.eagle.filter.filterRules.shape.width && w.eagle.filter.filterRules.shape.height) {
          s.filterContent();
        }
      });
    };
    filterContentWatch('eagle.filter.filterRules.file.min');
    filterContentWatch('eagle.filter.filterRules.file.max');
    filterContentWatch('eagle.filter.filterRules.duration.min');
    filterContentWatch('eagle.filter.filterRules.duration.max');
    filterContentWatch('eagle.filter.filterRules.bpm.min');
    filterContentWatch('eagle.filter.filterRules.bpm.max');
    shapeWatch('eagle.filter.filterRules.shape.width');
    shapeWatch('eagle.filter.filterRules.shape.height');
    filterContentWatch('eagle.filter.filterRules.resolution.minW');
    filterContentWatch('eagle.filter.filterRules.resolution.maxW');
    filterContentWatch('eagle.filter.filterRules.resolution.minH');
    filterContentWatch('eagle.filter.filterRules.resolution.maxH');
  }

  // ── $on 广播处理器（摘 bundle → 域内重挂；发送方仍在 bundle 未移植路径）──
  if (s0 && typeof s0.$on === 'function') {
    diag.listenersRemoved['CALCULATE_IMAGE_BINDING'] = removeScopeListener(s0, 'CALCULATE_IMAGE_BINDING');
    s0.$on('CALCULATE_IMAGE_BINDING', function (_e: any, params: any) {
      const s: any = getBodyScope();
      if (!s) return;
      s.calculateImageBinding(params);
    });

    diag.listenersRemoved['REBIND_REFRESH'] = removeScopeListener(s0, 'REBIND_REFRESH');
    s0.$on('REBIND_REFRESH', function (_e: any, mute: any) {
      const s: any = getBodyScope();
      if (!s) return;
      domainTimeout(s, function () {
        s.rebindRefresh(mute);
      }, 500);
    });
  }
}
