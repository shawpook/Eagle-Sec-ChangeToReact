/**
 * P3-b：来源文件夹模式（只读浏览 + 管理）——React/store 实现。
 *
 * 取代 `frontend/public/shims.js` 的 source-mode 块（其 tree/manage 交互属性全仓无监听器、
 * 三个意图 handler 零调用点，见 docs/e5-5-shims-retirement-plan.md §0.3）。
 *
 * 语义（用户决策）：
 *  - 点击来源根 → 网格显示该根下**全部**已索引素材（含子目录）；
 *  - 点击子目录 → 该目录及其子目录素材；清除跨目录选区、重置分页、保留排序；
 *  - 展开箭头只展开/折叠目录树，不改网格；
 *  - 重扫：期间保留已有内容 + 状态、防同一来源重复触发；完成后刷新树/计数/当前网格，
 *    保留当前目录与仍有效选区；当前目录消失则回来源根；失败保留上次成功数据 + 重试提示；
 *  - 移除此来源：停止监听并移除索引、保留磁盘文件；成功后刷新；移除非当前来源保持当前视图；
 *    移除当前来源按侧栏顺序选中第一个剩余来源；无来源留在来源模式显示空状态；
 *  - 退出来源模式：恢复原资源库视图（原目录/筛选/排序/仍有效的选区）；
 *  - 过期异步响应不得覆盖当前视图/不得复活已移除来源（generation 守卫）。
 *
 * 关键实现点：`/api/source-mode/virtual-library` 的 items **包含所有来源根的素材**（仅靠
 * sourceRootId 参数不算完成筛选）——本模块按选中根+目录（含子目录）**真正过滤**后才喂网格
 * （沿 virtual payload 的 folders 树收集目标目录的 folderId 后代集合，再按 item.folders 匹配）。
 * 网格喂料沿用既有机制：写 `__mockLibrary`/`__mockLibraryCache` + `__eagleEmitMockLifecycle()`
 * （shims 暴露的种子入口）——不重新接回 Angular。
 */
import { useSourceModeState, SourceRootNode } from '../store/sourceModeState';
import { useFolderState } from '../store/folderState';
import { useSelectionState } from '../store/selectionState';
import { useListState } from '../store/listState';
import { useMiscRawState } from '../store/miscRawState';

const apiBase = (): string => ((window as any).__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');

async function sourceModeApi<T>(route: string, options: any = {}): Promise<T> {
  const response = await fetch(`${apiBase()}${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload: any;
  try { payload = JSON.parse(text); } catch (err) { payload = { status: 'error', message: text || `HTTP ${response.status}` }; }
  if (!response.ok || !payload || payload.status !== 'success') {
    throw new Error(payload && payload.message ? payload.message : `API request failed: HTTP ${response.status}`);
  }
  return payload.data as T;
}

function emitMockLifecycle(): void {
  const fn = (window as any).__eagleEmitMockLifecycle;
  if (typeof fn === 'function') fn();
}

function setStore(partial: Partial<ReturnType<typeof useSourceModeState.getState>>): void {
  useSourceModeState.setState(partial as any);
}

/* ── 视图快照（退出来源模式复原原资源库视图）── */
interface ViewSnapshot {
  currentFolder: any;
  keyword: any;
  orderBy: any;
  sortIncrease: any;
  selectedIds: string[];
}

function takeViewSnapshot(): ViewSnapshot {
  return {
    currentFolder: useFolderState.getState().currentFolder,
    keyword: useListState.getState().keyword,
    orderBy: useMiscRawState.getState().orderBy,
    sortIncrease: useMiscRawState.getState().sortIncrease,
    selectedIds: useSelectionState.getState().selected.map((item: any) => item && item.id).filter(Boolean),
  };
}

function restoreViewSnapshot(snap: ViewSnapshot | null): void {
  if (!snap) return;
  useFolderState.setState({ currentFolder: snap.currentFolder });
  useListState.setState({ keyword: snap.keyword });
  useMiscRawState.setState({ orderBy: snap.orderBy, sortIncrease: snap.sortIncrease });
  // 仍有效的选区：只保留在当前库缓存里仍存在的 id。
  const cached = (window as any).__mockLibraryCache || [];
  const valid = new Set(cached.map((item: any) => item && item.id).filter(Boolean));
  const survived = snap.selectedIds.filter((id) => valid.has(id));
  if (survived.length > 0) {
    const selected = survived.map((id) => cached.find((item: any) => item.id === id)).filter(Boolean);
    useSelectionState.setState({ selected });
  } else {
    useSelectionState.setState({ selected: [] });
  }
}

/* ── 模块级来源模式状态 ── */
let savedLibrary: any = null;
let savedCache: any[] = [];
let savedView: ViewSnapshot | null = null;
let virtualPayload: any = null; // 最近一次 virtual-library 载荷（本地过滤，避免异步竞态）
let generation = 0;

function applyVirtualLibrary(virtual: any): void {
  const lib = (window as any).__mockLibrary || {};
  (window as any).__mockLibrary = {
    ...lib,
    mode: 'source',
    rootDir: virtual.rootDir,
    imagesDir: virtual.imagesDir,
    libraryName: lib.libraryName || virtual.libraryName || '来源文件夹模式',
    folders: [],
    smartFolders: [],
    quickAccess: [],
    tagsGroups: [],
    cachePath: virtual.cachePath,
    imagesStringPath: virtual.imagesStringPath || virtual.cachePath,
  };
  (window as any).__mockLibraryCache = Array.isArray(virtual.items) ? virtual.items.slice() : [];
}

/** 真正按 (rootId, relativePath) 过滤（含子目录）：收集目标目录的 folderId 后代集合后按 item.folders 匹配。 */
function filteredItems(rootId: string, relPath: string): any[] {
  if (!virtualPayload) return [];
  const folders = Array.isArray(virtualPayload.folders) ? virtualPayload.folders : [];
  const rootEntry = folders.find((f: any) => (f.relativePath === '.' || !f.relativePath) && f.id === `SRC-${rootId}-root`);
  if (!rootEntry) return [];
  const ids = new Set<string>();
  const collect = (node: any): void => {
    if (!node) return;
    ids.add(node.id);
    (node.children || []).forEach(collect);
  };
  if (relPath === '.') {
    collect(rootEntry);
  } else {
    const walk = (node: any): boolean => {
      if (node.relativePath === relPath) { collect(node); return true; }
      return (node.children || []).some((c: any) => walk(c));
    };
    if (!walk(rootEntry)) collect(rootEntry); // 目录已不存在 → 保守回根
  }
  const items = Array.isArray(virtualPayload.items) ? virtualPayload.items : [];
  return items.filter((it: any) => Array.isArray(it.folders) && it.folders.some((f: any) => ids.has(f)));
}

function feedGrid(rootId: string, relPath: string): void {
  const virtual = virtualPayload || { rootDir: '', imagesDir: '', libraryName: '', cachePath: '' };
  const items = filteredItems(rootId, relPath);
  (window as any).__mockLibrary = {
    ...((window as any).__mockLibrary || {}),
    mode: 'source',
    rootDir: virtual.rootDir,
    imagesDir: virtual.imagesDir,
    libraryName: (window as any).__mockLibrary && (window as any).__mockLibrary.libraryName || virtual.libraryName || '来源文件夹模式',
    folders: [],
    smartFolders: [],
    quickAccess: [],
    tagsGroups: [],
    cachePath: virtual.cachePath,
    imagesStringPath: virtual.imagesStringPath || virtual.cachePath,
  };
  (window as any).__mockLibraryCache = items.slice();
  emitMockLifecycle();
}

function feedEmpty(): void {
  (window as any).__mockLibrary = { ...((window as any).__mockLibrary || {}), mode: 'source', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [] };
  (window as any).__mockLibraryCache = [];
  emitMockLifecycle();
}

async function refreshVirtual(): Promise<void> {
  const gen = ++generation;
  const sel = useSourceModeState.getState();
  const virtual = await sourceModeApi<any>(`/api/source-mode/virtual-library?sourceRootId=${encodeURIComponent(sel.selectedRootId || '')}`);
  if (gen !== generation) return;
  virtualPayload = virtual;
  const roots = await sourceModeApi<SourceRootNode[]>('/api/source-roots');
  if (gen !== generation) return;
  setStore({ roots });
  feedGrid(sel.selectedRootId, sel.selectedRelativePath);
}

function dirExists(roots: SourceRootNode[], rootId: string, relPath: string): boolean {
  const root = roots.find((r) => r.id === rootId);
  if (!root) return false;
  if (relPath === '.') return true;
  const walk = (nodes: any[]): boolean => nodes.some((n) => n.relativePath === relPath || walk(n.children || []));
  return walk(Array.isArray(root.directories) ? root.directories : []);
}

export async function openSourceMode(): Promise<void> {
  if (useSourceModeState.getState().active) return;
  const gen = ++generation;
  savedLibrary = (window as any).__mockLibrary ? JSON.parse(JSON.stringify((window as any).__mockLibrary)) : null;
  savedCache = Array.isArray((window as any).__mockLibraryCache) ? JSON.parse(JSON.stringify((window as any).__mockLibraryCache)) : [];
  savedView = takeViewSnapshot();
  try {
    await sourceModeApi('/api/source-mode/state', { method: 'POST', body: JSON.stringify({ mode: 'source' }) });
    const state = await sourceModeApi<any>('/api/source-mode/state');
    const roots = await sourceModeApi<SourceRootNode[]>('/api/source-roots');
    if (gen !== generation) return;
    let rootId = state.selectedSourceRootId || (roots.length > 0 ? roots[0].id : '');
    const virtual = await sourceModeApi<any>(`/api/source-mode/virtual-library?sourceRootId=${encodeURIComponent(rootId)}`);
    if (gen !== generation) return;
    virtualPayload = virtual;
    setStore({ active: true, roots, selectedRootId: rootId, selectedRelativePath: '.', expanded: rootId ? { [rootId]: true } : {}, scanning: {}, lastError: null, view: 'tree' });
    applyVirtualLibrary(virtual);
    if (!rootId) {
      (window as any).__mockLibraryCache = [];
      setStore({ selectedRootId: '', selectedRelativePath: '.' });
    }
    feedGrid(rootId, '.');
  } catch (err) {
    setStore({ lastError: (err && (err as any)?.message ? String((err as any)?.message) : String(err)) });
    console.warn('[sourceMode] open failed', err);
  }
}

export async function closeSourceMode(): Promise<void> {
  generation += 1; // 作废所有在飞异步（快速切换/退出后过期响应不得覆盖当前视图）
  if (!useSourceModeState.getState().active) return;
  if (savedLibrary) (window as any).__mockLibrary = savedLibrary;
  if (Array.isArray(savedCache)) (window as any).__mockLibraryCache = savedCache;
  sourceModeApi('/api/source-mode/state', { method: 'POST', body: JSON.stringify({ mode: 'library' }) }).catch(() => {});
  setStore({ active: false, roots: [], selectedRootId: '', selectedRelativePath: '.', expanded: {}, scanning: {}, lastError: null, view: 'tree' });
  emitMockLifecycle();
  // 种子（emitMockLifecycle）经 waitControllerReady 异步轮询发射，且各窗口就绪节奏不同——视图快照
  // （原目录/筛选/排序/仍有效选区）须在种子落定后重放。种子可能在数百 ms 内多次触发（多个
  // 就绪源），故 450ms / 1200ms 双次重放兜底。
  const snap = savedView;
  setTimeout(() => { restoreViewSnapshot(snap); }, 450);
  setTimeout(() => { restoreViewSnapshot(snap); savedView = null; }, 1200);
  savedLibrary = null;
  savedCache = [];
}

export function toggleSourceMode(e?: any): void {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  if (useSourceModeState.getState().active) void closeSourceMode();
  else void openSourceMode();
}

export function toggleSourceRoot(rootId: string): void {
  const st = useSourceModeState.getState();
  setStore({ expanded: { ...st.expanded, [rootId]: !st.expanded[rootId] } });
}

export function selectSourceDirectory(rootId: string, relPath: string): void {
  const st = useSourceModeState.getState();
  if (rootId === st.selectedRootId && relPath === st.selectedRelativePath) return;
  // 清除跨目录选区 + 重置分页（保留排序：不动 orderBy/sortIncrease）
  useSelectionState.setState({ selected: [] });
  useMiscRawState.setState({ page: 1 });
  setStore({ selectedRootId: rootId, selectedRelativePath: relPath });
  feedGrid(rootId, relPath);
}

export async function handleSourceAdd(): Promise<void> {
  const gen = ++generation;
  try {
    const d = (window as any).eagleDesktop;
    if (d && d.sourceMode && typeof d.sourceMode.pickAndAdd === 'function') {
      await d.sourceMode.pickAndAdd();
    } else if ((window as any).__EAGLE_SOURCE_FOLDER_FIXTURE) {
      await sourceModeApi('/api/source-roots/addPath', {
        method: 'POST',
        body: JSON.stringify({ path: (window as any).__EAGLE_SOURCE_FOLDER_FIXTURE }),
      });
    } else {
      window.alert('浏览器预览中请设置 EAGLE_SOURCE_FOLDER_FIXTURE 后使用来源模式。');
      return;
    }
    if (gen !== generation) return;
    const roots = await sourceModeApi<SourceRootNode[]>('/api/source-roots');
    if (gen !== generation) return;
    const st = useSourceModeState.getState();
    if (!st.selectedRootId || !roots.some((r) => r.id === st.selectedRootId)) {
      if (roots.length > 0) setStore({ selectedRootId: roots[0].id, selectedRelativePath: '.', expanded: { ...st.expanded, [roots[0].id]: true } });
    }
    await refreshVirtual();
  } catch (err) {
    setStore({ lastError: (err && (err as any)?.message ? String((err as any)?.message) : String(err)) });
    console.warn('[sourceMode] add failed', err);
  }
}

export async function rescanSourceRoot(rootId: string): Promise<void> {
  const st = useSourceModeState.getState();
  if (st.scanning[rootId]) return; // 防同一来源重复触发
  setStore({ scanning: { ...st.scanning, [rootId]: true }, lastError: null });
  try {
    await sourceModeApi('/api/source-roots/rescan', { method: 'POST', body: JSON.stringify({ id: rootId, relativePath: null }) });
    // 扫描期间保留已有内容（不提前清网格）；完成后刷新树/计数/当前网格
    await refreshVirtual();
    const cur = useSourceModeState.getState();
    if (!dirExists(cur.roots, cur.selectedRootId, cur.selectedRelativePath)) {
      setStore({ selectedRelativePath: '.' });
      feedGrid(cur.selectedRootId, '.');
    }
  } catch (err) {
    // 失败保留上次成功数据 + 重试提示
    setStore({ lastError: '重新扫描失败：' + (err && (err as any)?.message ? (err as any)?.message : err) });
    console.warn('[sourceMode] rescan failed', err);
  } finally {
    setStore({ scanning: { ...useSourceModeState.getState().scanning, [rootId]: false } });
  }
}

export async function removeSourceRoot(rootId: string): Promise<void> {
  const gen = ++generation;
  try {
    await sourceModeApi('/api/source-roots/remove', { method: 'POST', body: JSON.stringify({ id: rootId }) });
    if (gen !== generation) return;
    const roots = await sourceModeApi<SourceRootNode[]>('/api/source-roots');
    if (gen !== generation) return;
    const st = useSourceModeState.getState();
    if (rootId === st.selectedRootId) {
      const next = roots[0] || null;
      const nextId = next ? next.id : '';
      if (next) {
        setStore({ roots, selectedRootId: nextId, selectedRelativePath: '.', expanded: { ...st.expanded, [nextId]: true } });
        await refreshVirtual();
      } else {
        // 没有来源：留在来源模式显示空状态
        setStore({ roots, selectedRootId: '', selectedRelativePath: '.', expanded: {} });
        feedEmpty();
      }
    } else {
      setStore({ roots }); // 移除非当前来源保持当前视图
    }
  } catch (err) {
    setStore({ lastError: '移除此来源失败：' + (err && (err as any)?.message ? (err as any)?.message : err) });
    console.warn('[sourceMode] remove failed', err);
  }
}