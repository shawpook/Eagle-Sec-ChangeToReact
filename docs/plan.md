# Eagle「来源文件夹模式」（Source Mode）执行文档
 
> 目标：在 Eagle 复刻项目中新增「切换模式」功能。点击界面左上方现有的「切换文件夹」按钮后，从**资源库模式**切换到**来源文件夹模式**（参考 OrcaBox 的直接索引本地文件夹方式），保持 Eagle 原版 UI 不重写，在原有框架内实现。
>
> 参考项目：`H:\dev\orcabox-Sec-development`（下称 OrcaBox）
 
---
 
## 一、结论先行（TL;DR）
 
1. **前端不需要重写一套 UI。** Eagle 前端是原版 AngularJS 应用，它的全部展示数据来自两个内存变量：条目数组 `$bodyScope.raw` 和文件夹树 `$bodyScope.folders`，网格过滤/排序/侧边栏渲染全部在这两个变量上内存完成。只要在进入来源模式时，把「虚拟库」（由来源文件夹扫描结果映射成的 Eagle 格式 folders/items）通过现有的生命周期事件重新喂进去，整套原版 UI（网格、侧边栏、筛选、排序）原样可用。
2. **后端已有一个未接线的 source-mode 骨架**（`backend/src/source-mode/`，含 SQLite 索引、chokidar 监听、缩略图服务、REST 路由、虚拟库生成器），且 `tests/source-mode-api.mjs`、`tests/source-mode-ui-closed-loop.mjs` 两个测试已写好预期行为。本方案的核心工作就是把这个骨架**接线到 server.js、main.cjs、shims.js** 三处。
3. **添加来源文件夹交互照抄 OrcaBox**：主进程 `dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] })` → 逐个 `addSourceRoot` → 启动 chokidar 监听 → 后台异步扫描。
4. 文件**永不复制**，缩略图缓存到 `<库名>.eagle-source/thumbs/`，原始文件路径白名单需在两处放行（backend 缩略图服务、electron `allowRoot`）。
 
---
 
## 二、现状盘点
 
### 2.1 Eagle 项目架构与数据加载链路（实测代码得出）
 
```
┌─ electron/main.cjs ──────────────────────────────┐
│ notifyLibraryLoaded(library)  (main.cjs:405)     │
│   ├─ allowRoot(library.rootDir)      路径白名单   │
│   └─ 向所有窗口广播:                              │
│       app-status-loading                          │
│       library:changed                             │
│       preload-library  {cachePath}                │
│       app-status-library-loaded                   │
│         {folders, smartFolders, quickAccess,      │
│          tagsGroups, rootDir, imagesDir,          │
│          cachePath, imagesStringPath,             │
│          usingCache, usingPreloadCache}           │
│         (libraryLoadedPayload, main.cjs:365)      │
└──────────────────────────────────────────────────┘
                    ↓ IPC
┌─ frontend/public/shims.js（注入到 index.html）────┐
│ startLifecycle() (shims.js:3120)                  │
│   desktopApi.library.current()                    │
│     → IPC library:get-current                     │
│     → main.cjs 调 backend                         │
│       GET /api/library/current?includeItems=true  │
│   写入 window.__mockLibrary / __mockLibraryCache  │
│   emitMockLifecycle() (shims.js:2960)             │
│     按 250/300/350/550ms 依次 emit 同上四个事件    │
└──────────────────────────────────────────────────┘
                    ↓ ipcRenderer.emit
┌─ src/app/app.bundle.js（原版 AngularJS）──────────┐
│ ipcRenderer.on('preload-library') (:22791)        │
│   逐行读 cachePath(JSONL) → libraryCache[]        │
│ ipcRenderer.on('app-status-library-loaded')       │
│   (:22857)                                        │
│   重置 scope 状态 ← folders/tags 来自 params      │
│   images = libraryCache                           │
│     或逐行读 params.imagesStringPath (:23081)     │
│   $scope.raw = images (:23130)                    │
│   $scope.updateSidebarList()                      │
└──────────────────────────────────────────────────┘
```
 
关键事实：
 
| 事实 | 位置 |
|---|---|
| 「切换文件夹」按钮 = 侧边栏工具栏第 2 个 icon-btn（ic_switch.svg），当前 `ng-click="openQuickSearch()"` | `src/app/index.html:124` |
| `openQuickSearch` 只是广播 `OPEN_QUICK_SEARCH_MODAL` | `app.bundle.js:32512` |
| 全部条目在内存 `$bodyScope.raw`，文件夹树在 `$bodyScope.folders`，过滤排序全在前端 | `app.bundle.js:18739`(listImages)、`:17881`(getAPIFolders) |
| 缩略图 URL：`FileUrlHelper.getThumbnailUrl(image)` 拼 `{imagesDir}{id}.info/{name}_thumbnail.png` 再 `pathToFileURL` | `app.bundle.js:2323` |
| shims 覆写了 `url.pathToFileURL` → `localAssetUrl()`：绝对路径转成 `{origin}/file/{encodeURIComponent(path)}` | `shims.js:2231-2255` |
| n-readlines 被 shim：优先原生读文件，失败则用 `__mockLibraryCache` 序列化成行 | `shims.js:2209` |
| backend 缩略图服务 `/file/:encoded` 有路径白名单：仅允许 `currentLibrary.rootDir`、`frontend/public`、`src` 下的文件 | `server.js:3023 resolveThumbnailPath` |
| electron `allowRoot()/safeResolve()` 同样有白名单 | `main.cjs:28,107,111` |
| 原生目录选择对话框 IPC 已存在：`dialog:openDirectory`、`dialog:show-open`（支持 multiSelections），preload 暴露为 `eagleDesktop.dialog.openDirectory/open` | `main.cjs:893-909`、`preload.cjs:22-26` |
 
### 2.2 已有的 source-mode 骨架（已提交但完全未接线）
 
`backend/src/source-mode/` 共 6 个文件：
 
| 文件 | 内容 |
|---|---|
| `source-db.js` | better-sqlite3，库文件放在 **`<库名>.eagle-source/source.db`**；表：`source_roots`（path UNIQUE/name/watch/available/asset_count/last_scanned_at…）、`source_assets`（UNIQUE(source_root_id, relative_path)，fingerprint=path:size:mtime，missing 标记）、`source_directories`、`source_exclusions`；另有 `mode.json` 持久化 `{mode:'library'|'source', selectedSourceRootId}` |
| `source-indexer.js` | `addSourceRoot/removeSourceRoot/scanRoot(120条一批+fingerprint跳过+对账标记missing)/indexFile/markPathDeleted/listAssets/listAllAssets/buildTree(目录树含聚合数量)` |
| `source-watcher.js` | chokidar 监听，250ms 防抖 index/unlink，忽略 `.git/node_modules/.orcabox-recycle/*.library` |
| `source-thumbnails.js` | sharp 生成 320px PNG 缩略图缓存到 `.eagle-source/thumbs/`，仅图片类型 |
| `service.js` | `createSourceModeService(libraryRoot)` 组合以上模块；**`getVirtualLibrary(sourceRootId)` 是核心**——把扫描结果映射成 Eagle 兼容结构并写 `virtual-cache.json`（JSONL）：folders 为目录树（folderId=`SRC-{rootId}-{相对路径安全化}`），items 含 `id/name/ext/size/folders[](祖先链)/modificationTime/noThumbnail` 等 Eagle 字段 |
| `source-routes.js` | REST：`GET /api/source-mode/state`、`GET /api/source-mode/virtual-library`、`POST /api/source-mode/state`、`GET /api/source-roots`、`POST /api/source-roots/addPath|remove|rescan|reconcile`、`GET /api/source-assets`、`GET /api/source-assets/:id/thumbnail|original` |
 
**接线现状：`server.js` / `main.cjs` / `shims.js` 中均无任何引用 —— 这是本任务要补的全部缺口。**
 
依赖已就位：`node_modules` 中已有 `better-sqlite3`、`chokidar`、`fast-glob`、`sharp`。
 
### 2.3 已有测试定义了验收标准
 
`tests/source-mode-ui-closed-loop.mjs` 预期：
1. 点击 `.sidebar-toolbar .icon-btn`（ic_switch.svg 那个）→ 出现 `#source-mode-add-folder` 元素；
2. 点击该按钮（测试环境下通过环境变量 `EAGLE_SOURCE_FOLDER_FIXTURE` 提供目录，绕过系统对话框）→ `GET /api/source-roots` 能看到该根且 `assetCount===1`；
3. 页面出现素材名（原版 Eagle 网格中渲染）；
4. 再次点击同一按钮 → `#source-mode-add-folder` 消失（退回资源库模式）。
 
### 2.4 OrcaBox 参考实现摘要（照抄的交互设计）
 
- **添加入口**：侧边栏底部一个整行按钮「➕ 添加来源文件夹」，点击后渲染端只调 `api.sourceRoots.add()`，**对话框在主进程弹出**：`dialog.showOpenDialog({ title:'Add Source Folder', properties:['openDirectory','multiSelections'] })`（`orcabox/src/main/ipc-handlers.ts:2057`）。之后逐个：`indexService.addSourceRoot(path)` → `watchService.watch(root.id)` → **后台异步** `scanRoot(root.id)`（不阻塞 UI）。
- **移除**：右键菜单「移除此来源目录」，confirm 文案强调 *"只会移除索引，不会删除磁盘上的原文件"*，乐观更新列表。
- **其他右键菜单项**（可分期实现）：重新扫描文件、展开/收起全部子文件夹、新建文件夹/子文件夹、在系统中显示、置顶、隐藏/锁定。
- **数据模型要点**：素材表带 `missing` 标记而非立即删除；fingerprint（path+size+mtime）增量跳过；扫描队列并发=1。
 
---
 
## 三、总体方案：「虚拟库」模式切换
 
**核心思路**：来源模式不是一个新界面，而是给现有界面喂一份不同的「库」。切换 = 重新走一遍库加载生命周期。
 
```
[library 模式]                        [source 模式]
GET /api/library/current              GET /api/library/current
  → 真实 .library 数据                  → source-service.getVirtualLibrary()
                                        生成的 Eagle 格式 folders/items
            ↕ 同一套 shims 生命周期事件 + 同一套 AngularJS UI ↕
```
 
三个角色的分工：
 
| 角色 | 职责 |
|---|---|
| **backend/server.js** | 挂载 source-mode 路由；维护全局模式状态；`/api/library/current` 与 `/api/item/*` 在 source 模式下返回虚拟库数据；缩略图白名单放行来源根 |
| **electron/main.cjs** | 新增 `source-mode:toggle`、`source-mode:add-folders`（弹系统多选目录对话框）IPC；每次模式切换后 `allowRoot()` 放行来源根并重新 `notifyLibraryLoaded()` 广播 |
| **frontend/public/shims.js** | 接管「切换文件夹」按钮行为（覆写 `openQuickSearch`）；注入来源模式侧边栏面板（来源根列表 + `#source-mode-add-folder` 按钮 + 扫描状态）；拦截缩略图 URL 把 `.info/{name}_thumbnail.png` 重写到 `/api/source-assets/:id/thumbnail` |
 
---
 
## 四、实施步骤
 
### Phase 1：后端接线（server.js）
 
**1.1 创建并挂载 source-mode 服务**
 
位置：`backend/src/server.js`，在 `let currentLibrary = ...`（约 :187）之后：
 
```js
import { createSourceModeService } from './source-mode/service.js';
import { createSourceModeRouter } from './source-mode/source-routes.js';
 
const sourceModeService = createSourceModeService(currentLibrary.rootDir, {
  onActivity: (activity) => {
    // 可选：通过 SSE/websocket 推送扫描进度（第一期可先落日志）
  },
});
app.use(createSourceModeRouter({ service: sourceModeService }));
```
 
注意：`createSourceModeService` 的第一个参数决定 `.eagle-source` 目录的位置，应跟随**当前激活库**变化——在 `activateLibrary()` 里同步重建或重指（见 1.3）。
 
**1.2 让 `/api/library/current` 感知模式**
 
修改 `server.js:926`：
 
```js
app.get('/api/library/current', (req, res) => {
  const state = sourceModeService.getState();
  if (state.mode === 'source') {
    const virtual = sourceModeService.getVirtualLibrary(state.selectedSourceRootId);
    // 补齐 describeLibrary 形状必需的字段（path/libraryName/history 等）
    return res.json(ok({
      path: virtual.rootDir,
      rootDir: virtual.rootDir,
      libraryName: `${virtual.folders[0]?.name || '来源'} (来源模式)`,
      imagesDir: virtual.imagesDir,
      cachePath: virtual.cachePath,
      imagesStringPath: virtual.imagesStringPath,
      folders: virtual.folders,
      smartFolders: [], quickAccess: [], tagsGroups: [],
      items: req.query.includeItems === 'true' ? virtual.items : [],
      itemCount: virtual.items.length,
      sourceMode: true,
    }));
  }
  res.json(ok(describeLibrary(currentLibrary, { includeItems: req.query.includeItems === 'true' })));
});
```
 
这样 shims 的 `startLifecycle()` 和 main.cjs 的 `refreshCachedCurrentLibrary()` 无需感知差异。
 
**1.3 模式切换端点补强**
 
`source-routes.js` 已有 `POST /api/source-mode/state`。补充两点：
- 切到 `library` 时无需额外动作；切到 `source` 时若 `selectedSourceRootId` 为空则自动选第一个根；
- `POST /api/source-roots/addPath` 已实现「加根+监听+后台扫描」，符合 OrcaBox 行为，直接可用。
 
**1.4 缩略图白名单放行**
 
修改 `resolveThumbnailPath()`（server.js:3023）中绝对路径分支的 `allowedRoots`：
 
```js
const allowedRoots = [
  currentLibrary.rootDir,
  sourceModeService ? sourceModeService.db.root : null,  // .eagle-source 目录（缓存缩略图）
  ...sourceModeService ? sourceModeService.indexer.listSourceRoots().map(r => r.path) : [],
  ...roots,
].filter(Boolean);
```
 
（`/api/source-assets/:id/thumbnail` 路由本身不走这个白名单，此改动是为了让旧式 `/file/` 路径请求也能命中来源文件。）
 
**1.5 优雅退出**
 
`process.on('exit'/SIGINT)` 中调用 `sourceModeService.dispose()` 关闭 chokidar 与 sqlite（参照 server.js 现有退出处理位置）。
 
### Phase 2：Electron 主进程（main.cjs）
 
**2.1 新增 IPC**（注册位置：`registerIpc()` 内，dialog handlers 附近，main.cjs:893）：
 
```js
// 弹系统多选目录框（OrcaBox sourceRoots.add 的等价物）
ipcMain.handle('source-mode:add-folders', async (event) => {
  const result = await dialog.showOpenDialog(
    BrowserWindow.fromWebContents(event.sender),
    { title: '添加来源文件夹', properties: ['openDirectory', 'multiSelections'] },
  );
  if (result.canceled || result.filePaths.length === 0) return [];
  const added = [];
  for (const p of result.filePaths) {
    try {
      const r = await apiRequest('/api/source-roots/addPath', { method: 'POST', body: { path: p } });
      added.push(r);
      allowRoot(p);                      // 拖拽导出/原生缩略图需要
    } catch (err) { console.warn('[source-mode] add failed:', p, err.message); }
  }
  return added;
});
 
// 切换模式并广播重新加载
ipcMain.handle('source-mode:toggle', async () => {
  const cur = await apiRequest('/api/source-mode/state');
  const next = await apiRequest('/api/source-mode/state', {
    method: 'POST',
    body: { mode: cur.mode === 'source' ? 'library' : 'source' },
  });
  if (next.mode === 'source') {
    const lib = await apiRequest('/api/library/current');
    allowRoot(lib.rootDir);
  }
  const lib = await apiRequest('/api/library/current?includeItems=true');
  updateCachedCurrentLibrary(lib);
  notifyLibraryLoaded(lib);              // 复用现有广播函数 main.cjs:405
  return next;
});
 
// 选中某个来源根（虚拟库内容随之变化）
ipcMain.handle('source-mode:select-root', async (_e, rootId) => {
  await apiRequest('/api/source-mode/state', {
    method: 'POST', body: { mode: 'source', selectedSourceRootId: rootId },
  });
  const lib = await apiRequest('/api/library/current?includeItems=true');
  updateCachedCurrentLibrary(lib);
  notifyLibraryLoaded(lib);
  return lib;
});
```
 
**2.2 preload.cjs 暴露**：
 
```js
sourceMode: {
  toggle: () => ipcRenderer.invoke('source-mode:toggle'),
  addFolders: () => ipcRenderer.invoke('source-mode:add-folders'),
  selectRoot: (id) => ipcRenderer.invoke('source-mode:select-root', id),
},
```
 
### Phase 3：前端接管（shims.js）
 
**3.1 劫持「切换文件夹」按钮**
 
按钮当前调 `openQuickSearch()`，快捷键 Ctrl+J 也走同一函数（`app.bundle.js:49254`）。在 Angular 启动完成后覆写它即可同时覆盖两条入口。在 shims.js 的 `emitMockLifecycle()` 之后（或 `startLifecycle()` 内 `setTimeout` 链尾部）加入：
 
```js
function installSourceModeToggle() {
  const tryInstall = () => {
    try {
      const scope = window.angular && angular.element(document.body).scope();
      if (!scope || !scope.openQuickSearch) return false;
      if (scope.__sourceModeHooked) return true;
      scope.__origOpenQuickSearch = scope.openQuickSearch;
      scope.openQuickSearch = function (event) {
        // 来源模式下再点 = 退出；资源库模式下点 = 进入
        Promise.resolve(
          desktopApi && desktopApi.sourceMode
            ? desktopApi.sourceMode.toggle()
            : fallbackToggleViaApi()
        );
      };
      scope.__sourceModeHooked = true;
      return true;
    } catch { return false; }
  };
  const timer = setInterval(() => { if (tryInstall()) clearInterval(timer); }, 300);
  setTimeout(() => clearInterval(timer), 15000);
}
```
 
浏览器回退 `fallbackToggleViaApi()`：直接 fetch `POST /api/source-mode/state` + `GET /api/library/current?includeItems=true`，然后手动更新 `__mockLibrary/__mockLibraryCache` 并重新 `emitMockLifecycle()`（shims 内已有同款逻辑可提取复用，见 shims.js:1360-1415 的 library switch 分支）。
 
**3.2 来源模式侧边栏面板**
 
在 `app-status-library-loaded` 事件处理后检测 `window.__mockLibrary.sourceMode`，向 `.sidebar-container` 顶部插入一块 DOM（样式对齐原版侧边栏，深色主题变量沿用现有 CSS）：
 
```
┌────────────────────────┐
│ [SRC] 来源文件夹        │  ← 标题行
│ ▸ D:\素材库      (1.2k)│  ← 来源根列表（点击 = selectRoot）
│ ▾ E:\图片         (340)│     当前选中高亮，显示 assetCount
│   ├ sub-a        (120)│  ← 二级目录树（可选，一期可只到根）
│ ───────────────────   │
│ ➕ 添加来源文件夹       │  ← id="source-mode-add-folder"
│ 🔄 全部重新扫描         │
└────────────────────────┘
```
 
- 「添加来源文件夹」点击逻辑（对齐 OrcaBox）：
 
```js
async function addSourceFolderClicked() {
  if (desktopApi && desktopApi.sourceMode) {
    const roots = await desktopApi.sourceMode.addFolders();  // 主进程弹框
    if (!roots || roots.length === 0) return;                 // 用户取消
  } else {
    // 浏览器/自动化回退：测试钩子优先
    const fixture = await fetch(`${apiBase}/api/source-mode/fixture-root`).then(r=>r.json()).catch(()=>null);
    if (fixture && fixture.path) {
      await fetch(`${apiBase}/api/source-roots/addPath`, { method:'POST',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: fixture.path }) });
    }
  }
  await refreshSourcePanel();   // GET /api/source-roots 重绘列表
}
```
 
  （`fixture-root` 端点读取 `EAGLE_SOURCE_FOLDER_FIXTURE` 环境变量，仅为测试与纯浏览器开发模式提供，正式环境返回空。这满足 `tests/source-mode-ui-closed-loop.mjs` 的自动化要求。）
- 扫描进行中显示 spinner：轮询 `GET /api/source-roots`（1s 间隔）直到 `lastScannedAt` 变化或 assetCount 稳定；扫描完成后调 `selectRoot` 刷新网格。
- 来源根右键菜单（一期最小集，DOM 实现）：**重新扫描**（POST rescan）、**在系统中显示**（`desktopApi` 已有 reveal 能力可后续接）、**移除来源目录**（confirm 文案照抄 OrcaBox："只会移除索引，不会删除磁盘上的原文件"，POST remove 后刷新）。
- 退出来源模式时移除整个面板。
 
**3.3 缩略图与原图 URL 重定向（关键难点）**
 
问题：原版 `FileUrlHelper` 拼的是物理路径 `{imagesDir}{id}.info/{name}_thumbnail.png`，来源模式的文件根本不是这个布局。但这个路径最终经过 `URL_MODULE.pathToFileURL()`，而 shims 已经全面接管了该函数（shims.js:2250）。因此在 `localAssetUrl()` 前加一层拦截即可，**不用改 bundle**：
 
```js
function sourceAssetUrlFromVirtualPath(p) {
  if (!(window.__mockLibrary && window.__mockLibrary.sourceMode)) return null;
  const norm = String(p || '').replace(/\\/g, '/');
  const m = norm.match(/\/([^/]+)\.info\/(.+)$/);   // 抓 {id}.info/...
  if (!m) return null;
  const itemId = m[1];
  const isThumb = m[2].endsWith('_thumbnail.png');
  return `${window.location.origin}/api/source-assets/${encodeURIComponent(itemId)}${isThumb ? '/thumbnail' : '/original'}`;
}
// 在 localAssetUrl() 入口处最先调用，命中则直接返回
```
 
后端 `source-routes.js` 已备好这两个端点（thumbnail miss 时回退发送原图、original 对 missing 返回 410）。详情大图（getRawUrl）、Inspector 预览走同一拦截，天然覆盖。
 
**3.4 视频等其他类型的兜底**
 
`ensureThumbnail` 只处理 image kind。非图片条目 `noThumbnail: true`（service.js 映射时已设置），原版 UI 会显示占位图标——一期可接受，与 OrcaBox 行为一致（视频缩略图 backfill 列为二期）。
 
### Phase 4：i18n 与细节
 
- 复用现有 key `sidebar.switchFolderBtn`（zh_CN: "切换文件夹"），tooltip 可改为 "切换 文件夹/来源 模式"。如需新文案，往 `src/i18n/zh_CN.js` 加 key 即可（bundle 用 `| i18n` filter 读取）。
- 模式指示：进入来源模式后在窗口标题或库图标区（`library-switch-btn`，index.html:107）把 `{{libraryName}}` 显示为 "来源模式 · {根名}"——数据来自 `/api/library/current` 返回的 `libraryName`，前端零改动。
 
---
 
## 五、数据流总览（切换一次的完整时序）
 
```
用户点击 [ic_switch 按钮]
  → shims 覆写的 openQuickSearch()
  → eagleDesktop.sourceMode.toggle()          (IPC)
  → main.cjs: 读 state → 取反 → POST /api/source-mode/state
  → allowRoot(root) + GET /api/library/current?includeItems=true
      (backend: source 模式 → getVirtualLibrary() 映射 folders/items)
  → updateCachedCurrentLibrary + notifyLibraryLoaded
  → 广播 preload-library{cachePath=virtual-cache.json}
         app-status-library-loaded{folders,imagesDir,...}
  → bundle: libraryCache←JSONL, $scope.raw=items, $scope.folders=folders
  → shims: 检测 sourceMode → 渲染来源侧边栏面板
  → 网格请求缩略图 → pathToFileURL 拦截 → /api/source-assets/:id/thumbnail
```
 
全程复用原版加载管线，无一处新建 UI 框架。
 
---
 
## 六、测试与验收
 
1. **API 层**：`tests/source-mode-api.mjs`（已有）验证路由与虚拟库结构。接入 `package.json`：
   ```json
   "test:source-mode": "node tests/source-mode-api.mjs && node tests/source-mode-ui-closed-loop.mjs"
   ```
   并追加到 `test:full`。
2. **UI 闭环**：`tests/source-mode-ui-closed-loop.mjs`（已有）覆盖第四节 3.2 的全部验收点。
3. **回归**：确认资源库模式不受影响——`npm run test:library-switch-ui`、`npm run test:main-ui-workflow` 必须全绿（重点回归 `/api/library/current` 的改动分支）。
4. **手工验收清单**：
   - 添加单个/多个文件夹（含中文路径、网络盘路径）
   - 扫描中 UI 不卡顿（后台异步）；进度可见
   - 网格缩略图正常、双击看原图正常
   - 在资源管理器中删除文件 → watcher 标记 missing → 界面刷新后条目消失或显示缺失态
   - 移除来源 → confirm → 索引消失、磁盘文件仍在
   - 切回资源库模式 → 原 .library 数据完好无损（source 模式全程零写入 .library）
   - 重启应用 → 模式状态持久化（mode.json）恢复正确
 
---
 
## 七、风险与边界
 
| 风险 | 应对 |
|---|---|
| `/api/library/current` 改动波及面广（workbench、扩展采集、document-viewer 都调用它） | source 模式仅在 `state.mode==='source'` 时分支；其余路径字节不变。回归测试兜底 |
| 拖拽导出（startItemDrag）依赖 `cachedCurrentLibrary` 的物理 `.info` 布局，来源模式下会失效 | 一期明确不支持拖出到资源管理器（可在 main.cjs `startItemDrag` 检测 source 模式提前返回）；二期在 main.cjs 增加 source 资产路径解析分支 |
| 条目级操作（打星/标签/注释/移动文件夹）写入会落到真实 .library 的 API | 一期范围声明：来源模式为**只读浏览+索引管理**；`/api/item/update` 等在 source 模式返回错误提示（OrcaBox 的标签/收藏同样不落地到源盘） |
| 大文件夹首次扫描耗时 | 沿用骨架的分批+fingerprint 增量；扫描异步后台跑，UI 显示进行中状态；二期移植 OrcaBox 的扫描队列并发=1 |
| Windows 路径大小写/分隔符 | 骨架已统一 `path.resolve` + 正斜杠归一化 relative_path |
| `angular.element(document.body).scope()` 覆写时机 | shims 已有成熟的轮询等待模式（参考 collect-window 的 retry 逻辑 shims.js:3040），照抄即可 |
 
## 八、工作量与顺序建议
 
| 阶段 | 内容 | 预估 |
|---|---|---|
| P1 | server.js 接线（挂路由、current 分支、白名单、dispose） | 0.5 天 |
| P2 | main.cjs + preload IPC（toggle/add-folders/select-root） | 0.5 天 |
| P3 | shims：按钮劫持 + 侧边栏面板 + 缩略图拦截 | 1.5 天 |
| P4 | 测试跑通 + 回归 + 手工验收 | 1 天 |
 
P1→P2→P3 严格串行（每层依赖前者的接口），P4 与 P3 尾部并行。
 
---
 
附：本文档所有文件路径与行号均基于当前工作区实际代码核实（2026-08-21），关键锚点：`backend/src/server.js:187,3023,3079,926`、`electron/main.cjs:28,107,365,405,893`、`electron/preload.cjs:22`、`frontend/public/shims.js:2231,2250,2960,3120`、`src/app/index.html:107,124`、`src/app/app.bundle.js:22791,22857,23130,2323,32512`、`tests/source-mode-ui-closed-loop.mjs:191-263`。
 