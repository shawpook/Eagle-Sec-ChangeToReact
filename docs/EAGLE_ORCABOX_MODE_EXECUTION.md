# Eagle 集成 OrcaBox 来源文件夹模式执行文档

> 目标仓库：`H:\dev\Eagle-Sec-development`
> 参考仓库：`H:\dev\orcabox-Sec-development`
> 文档用途：把 Eagle 的“资源库内导入/管理”模式与 OrcaBox 的“本地来源文件夹索引/管理”模式整合进同一应用，并把原版侧栏的“切换文件夹”按钮改为模式切换入口。
>
> **实际执行调整**：左栏不使用 iframe 套壳。改为直接修改 Eagle 原 `#sidebar`：进入来源模式时隐藏原 `.sidebar-header` 与 `.sidebar-container`，在原侧栏内部注入 `#eagle-source-mode-sidebar`（来源树/添加/管理/返回），退出时恢复原侧栏。详细执行见 git 历史 `d736dba0:docs/plan.md`（原 `docs/plan.md` 已随仓库卫生清理删除，内容可在该提交取回）。

## 1. 结论摘要

建议采用“单进程、双模式”架构，而不是把 OrcaBox 作为独立第二套应用运行：

1. Eagle 保留现有 `.library` 资源库模式，素材仍按现有逻辑复制进库。
2. 新增 `source-mode`，复用 OrcaBox 的核心文件夹管理语义：添加本地来源文件夹、扫描索引、目录树、文件网格、watch 同步、移除索引。
3. 来源文件夹只被索引和预览，不复制到 `.library`。
4. 原版侧栏的“切换文件夹”按钮作为进入 OrcaBox 模式的入口；OrcaBox 模式内提供“返回 Eagle 资源库模式”。
5. 为遵守当前工程“不改原版 `src/app` 资源”的约定，按钮拦截放在 `frontend/public/shims.js`，新 UI 放在独立 Vite 入口/iframe 中，不修改 `src/app/index.html`、`app.bundle.js`。
6. 来源索引建议存放在 `.library` 同级的 `<LibraryName>.library.eagle-source/` 目录，避免污染 Eagle 官方 `.library` 格式。

## 2. 现状调研

### 2.1 Eagle 当前模式

| 位置 | 现状 | 与本任务关系 |
| --- | --- | --- |
| `src/app/index.html:124` | 侧栏 `sidebar.switchFolderBtn` 图标按钮，`ng-click="openQuickSearch()"` | 这是用户说的“切换文件夹”按钮，改为模式入口 |
| `src/app/index.html:107` | 侧栏 `sidebar.switchLibrary` 按钮，调用 `switchLibrary()` | 保留原资源库切换，不应混淆为模式切换 |
| `src/app/app.bundle.js:32512` | `$scope.openQuickSearch()` 广播 `OPEN_QUICK_SEARCH_MODAL` | 按钮原行为；快捷键 `J` 和菜单仍可保留 |
| `frontend/public/workbench.html:218` | “Switch to Demo” 按钮调用 `/api/library/switch` | 这是 workbench 的资源库切换，不是目标入口 |
| `backend/src/library-service.js:140-180` | 只管理 `.library` 的 current/open/switch/history | 后端没有外部文件夹索引能力 |
| `backend/src/server.js:1352` | `/api/library/switch` | 只切换 `.library` |
| `electron/preload.cjs:11-26` | 暴露 `library` 与 `dialog.openDirectory` | 已有目录选择能力，可扩展为来源文件夹选择 |
| `electron/main.cjs:25,104-113` | `allowedRoots` + `safeResolve()` 路径白名单 | 来源文件夹路径必须加入白名单 |
| `frontend/public/shims.js:389-405` | 已有 document viewer iframe 覆盖层模式 | 可复用同一套 iframe 覆盖/关闭模式 |

Eagle 的“文件夹”本质是 `.library` 内部的 Eagle folder 树，导入文件夹时会复制文件并建立 `folders.json` 结构。该模型不能直接表达 OrcaBox 的“本地文件夹是唯一真实来源、磁盘上不复制”的语义。

### 2.2 OrcaBox 当前模式

| 位置 | 现状 | 复用点 |
| --- | --- | --- |
| `src/renderer/components/layout/Sidebar.tsx:3128-3205` | 左侧栏“来源目录”分组和来源文件夹树 | 左侧栏视觉与交互设计 |
| `src/renderer/components/layout/Sidebar.tsx:3267-3278` | “添加来源文件夹”按钮，点击 `addSourceRoot.mutateAsync()` | 用户强调的入口 |
| `src/renderer/hooks/use-source-roots.ts:107-153` | `useAddSourceRoot()`，支持新增后的 history/undo/redo | 前端状态管理参考 |
| `src/renderer/components/management/SourceRootManagerPanel.tsx:91-180` | 空状态、添加、扫描、离线检查、移除来源目录 | 来源目录管理面板 |
| `src/main/preload.ts:30-51` | `sourceRoots.add/addPath/remove/list/rescan/...` | IPC 方法形态 |
| `src/main/ipc-handlers.ts:2057-2119` | `sourceRoots.add` 打开目录多选，随后 add + watch + scan | 添加来源文件夹主链路 |
| `src/main/services/index-service.ts:198-249` | `addSourceRoot()` 写入 `source_roots` | 来源根索引 |
| `src/main/services/index-service.ts:951+` | `scanRoot()` 扫描队列、批处理、进度 | 扫描核心 |
| `src/main/services/source-root-tree.ts:52-186` | 从 `source_roots`/`asset_files` 构建目录树和计数 | 左侧树数据 |
| `src/main/services/watch-service.ts:32-110` | chokidar watch/unwatch/watchAll | 文件夹实时同步 |
| `src/main/services/database-service.ts:239-326` | `source_roots`、`assets`、`asset_files`、exclusions、directories、policies、order 表 | 数据模型参考 |

OrcaBox 的模型可以概括为：

```text
source_roots
  └─ asset_files (磁盘路径, fingerprint, size, mtime, missing)
       └─ assets (唯一素材: kind, ext, width, height, duration...)
  ├─ source_directories
  ├─ source_exclusions
  └─ source_directory_policies / order
```

## 3. 目标交互

### 3.1 入口

1. 用户停留在 Eagle 主界面。
2. 点击原侧栏“切换文件夹”图标按钮。
3. 原按钮不再打开文件夹快捷搜索；`shims.js` 拦截点击并打开 OrcaBox 来源文件夹模式。
4. 原 `J` 快捷键和“查找 > 切换文件夹”菜单仍保留快速搜索，避免功能回归。

### 3.2 OrcaBox 模式内

1. 显示 OrcaBox 风格左侧栏：
   - 来源目录树
   - 每个来源根、子目录的素材数量
   - 离线来源状态
   - “添加来源文件夹”按钮
   - 来源目录管理入口
2. 点击“添加来源文件夹”：
   - Electron 环境：调用目录多选对话框。
   - 浏览器预览环境：退化为 `<input type="file" webkitdirectory multiple>` 或手动路径输入。
   - 选择后写入 `source_roots`，启动后台扫描，并开始 watch。
3. 选择来源根或子目录后，中间区域显示该目录下已索引素材。
4. 文件变化由 watcher 自动更新索引和网格。
5. 点击“返回 Eagle 资源库模式”关闭模式层，原 Eagle 当前库保持不变。

## 4. 建议架构

### 4.1 方案对比

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| A：内嵌 OrcaBox 完整应用 | 在 Eagle 里加载 OrcaBox web/Electron 实例 | 还原度高，但双后端/双进程/双数据库，状态割裂，不建议作为主方案 |
| B：移植 OrcaBox 来源目录核心栈到 Eagle | 后端移植索引/扫描/watch，前端复用 Sidebar 与来源管理 UI | 推荐 |
| C：只做伪模式 | 仅切换 UI，不建索引 | 不符合“直接复用文件夹管理”目标 |

### 4.2 推荐结构

```text
Eagle 主窗口
├─ Eagle 资源库模式（现有 Angular 主界面）
└─ source-mode iframe 覆盖层
   └─ frontend/source-mode/
      ├─ React 模式入口
      ├─ Sidebar（从 OrcaBox 复制/裁剪）
      ├─ SourceRootManagerPanel（可选）
      ├─ AssetGrid（从 OrcaBox 适配）
      └─ source-mode bridge

Eagle backend
├─ 现有 .library 服务
└─ source-mode 服务
   ├─ source-state.js
   ├─ source-db.js
   ├─ source-indexer.js
   ├─ source-tree.js
   ├─ source-watcher.js
   ├─ source-thumbnails.js
   └─ source-routes.js
```

### 4.3 数据存放

建议在 `.library` 同级创建：

```text
Eagle Demo.library/                # 现有 Eagle 库，不修改内部格式
Eagle Demo.library.eagle-source/   # 新增来源索引
  ├─ source.db                     # SQLite 索引
  ├─ mode.json                     # 当前库的 source-mode 状态
  ├─ thumbs/                       # 缩略图缓存
  └─ previews/                     # 大图/视频/PDF 等预览缓存
```

优点：

- 不污染 `.library` 官方结构。
- 跟随资源库目录移动，便于整套搬迁。
- 来源文件本身仍在原位置。

缺点与补偿：

- 库被移动后，同级索引路径会变化。`mode.json` 中保存 `libraryPath`，启动时发现不匹配则提示重新关联或重建索引。

## 5. 数据模型

第一版建议保留 OrcaBox 表名与核心字段，但只移植所需子集：

```sql
CREATE TABLE IF NOT EXISTS source_roots (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  watch INTEGER NOT NULL DEFAULT 1,
  storage_kind TEXT NOT NULL DEFAULT 'local',
  mount_type TEXT NOT NULL DEFAULT 'local',
  storage_label TEXT,
  available INTEGER NOT NULL DEFAULT 1,
  unavailable_since TEXT,
  asset_count INTEGER NOT NULL DEFAULT 0,
  missing_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_assets (
  id TEXT PRIMARY KEY,
  source_root_id TEXT NOT NULL REFERENCES source_roots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  absolute_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  ext TEXT NOT NULL,
  name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_ms REAL,
  missing INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  UNIQUE(source_root_id, relative_path)
);

CREATE TABLE IF NOT EXISTS source_directories (
  id TEXT PRIMARY KEY,
  source_root_id TEXT NOT NULL REFERENCES source_roots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(source_root_id, relative_path)
);

CREATE TABLE IF NOT EXISTS source_exclusions (
  id TEXT PRIMARY KEY,
  source_root_id TEXT NOT NULL REFERENCES source_roots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(source_root_id, relative_path)
);
```

后续需要 OrcaBox 的目录密码、排序、回收站时，再按需增加：

- `source_directory_policies`
- `source_directory_order`
- `recycle_bin_*`

## 6. 后端改造任务

### 6.1 新增依赖

在 Eagle `package.json` 中加入：

```json
{
  "better-sqlite3": "^12.4.1",
  "chokidar": "^4.0.3",
  "fast-glob": "^3.3.3"
}
```

如果完整复用 OrcaBox Sidebar 组件，还需要补充其已用到的前端依赖：

- `class-variance-authority`
- `@tanstack/react-virtual`

注意：Eagle 当前使用 Electron 22，OrcaBox 使用 Electron 37。`better-sqlite3` 应主要运行在 Node 后端进程中，若 Electron 主进程也要直接加载，需要单独执行 Electron ABI rebuild，避免原生模块加载失败。

### 6.2 新增后端模块

| 文件 | 职责 |
| --- | --- |
| `backend/src/source-mode/source-state.js` | 当前模式、当前库、上次选中的 source root/relativePath |
| `backend/src/source-mode/source-db.js` | 打开/迁移 `source.db`，提供 prepared statements |
| `backend/src/source-mode/source-indexer.js` | add/remove/list/scan/reconcile source root |
| `backend/src/source-mode/source-tree.js` | 从 `source_assets`/`source_directories` 构建目录树与计数 |
| `backend/src/source-mode/source-watcher.js` | chokidar watch/unwatch，事件合并与刷新 |
| `backend/src/source-mode/source-thumbnails.js` | 来源文件缩略图/预览缓存 |
| `backend/src/source-mode/source-routes.js` | Express 路由，挂载到 `backend/src/server.js` |

### 6.3 扫描流程

```text
添加目录
  └─ source-indexer.addSourceRoot(path)
       └─ 插入 source_roots
            └─ source-watcher.watch(rootId)
                 └─ source-indexer.scanRoot(rootId)
                      ├─ fast-glob 枚举受支持扩展
                      ├─ 按 batch 写入 source_assets
                      ├─ 更新 source_directories
                      ├─ 标记缺失文件
                      ├─ 更新 source_roots.asset_count / missing_count
                      └─ 入队缩略图生成
```

支持的扩展名建议复用 Eagle 的：

- `backend/src/file-format-policy.js`
- `backend/src/media-info.js`
- `backend/src/thumbnailer.js`

不要直接照搬 OrcaBox 的整套 AI/FFmpeg/3D 管线；第一阶段优先覆盖图片、视频、PDF、文本、Office 等 Eagle 已有渲染能力的格式。

### 6.4 API 合同

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/source-mode/state` | 返回 `mode/libraryPath/sourceRoots/selectedSection` |
| POST | `/api/source-mode/state` | 保存选中状态 |
| POST | `/api/source-roots/addPath` | 用指定路径添加来源文件夹 |
| GET | `/api/source-roots` | 列出来源根与目录树 |
| POST | `/api/source-roots/remove` | 只移除索引，不删除磁盘文件 |
| POST | `/api/source-roots/rescan` | 手动扫描整个根或子目录 |
| POST | `/api/source-roots/reconcile` | 校正缺失/离线状态 |
| GET | `/api/source-roots/:id/tree` | 返回单个来源根的目录树 |
| GET | `/api/source-assets` | 按 `sourceRootId` + `relativePath` 分页取素材 |
| GET | `/api/source-assets/:id/thumbnail` | 返回缩略图缓存 |
| GET | `/api/source-assets/:id/original` | 受控读取原文件用于预览 |

### 6.5 活动推送

建议提供轻量轮询或 SSE：

- `GET /api/source-mode/activity`
- 或者前端每 1 秒轮询 `GET /api/source-mode/state`

Eagle 已有类似捕获轮询模式，参考 `frontend/public/shims.js:2892-2927`。

## 7. Electron / Preload 改造

### 7.1 preload 暴露

在 `electron/preload.cjs` 中新增：

```js
sourceMode: {
  getState: () => ipcRenderer.invoke('source-mode:get-state'),
  openFolderPicker: () => ipcRenderer.invoke('source-mode:open-folder-picker'),
  addPath: (path) => ipcRenderer.invoke('source-mode:add-path', path),
  list: () => ipcRenderer.invoke('source-mode:list'),
  remove: (id) => ipcRenderer.invoke('source-mode:remove', id),
  rescan: (id, relativePath) => ipcRenderer.invoke('source-mode:rescan', id, relativePath),
  listAssets: (query) => ipcRenderer.invoke('source-mode:list-assets', query),
  onActivity: (callback) => {
    ipcRenderer.on('source-mode:activity', (_event, value) => callback(value));
  },
},
```

### 7.2 main 进程

在 `electron/main.cjs` 中：

1. 注册 `source-mode:open-folder-picker`：
   - `dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] })`
2. 注册 `source-mode:add-path`：
   - 调用后端 `/api/source-roots/addPath`
   - 对每个新增 root 执行 `allowRoot(root.path)`
3. 注册其余 source-mode IPC，转发到后端。
4. 启动或读取来源根时，把已有 `source_roots.path` 全部加入 `allowedRoots`。
5. 保持 `safeResolve()` 白名单语义：不允许未登记目录被任意文件 IPC 读取。

### 7.3 自动化测试钩子

为目录选择对话框增加测试注入：

```text
EAGLE_SOURCE_FOLDER_FIXTURE=C:\path\to\fixture
```

设置后 `source-mode:open-folder-picker` 直接返回该路径，避免自动化测试卡在原生对话框。

## 8. 前端 source-mode 改造

### 8.1 新 Vite 入口

在 `frontend/vite.preview.config.mjs` 中新增：

```js
const sourceModeEntry = path.resolve(here, 'source-mode/index.html');

rollupOptions: {
  input: {
    pages: ...,
    'document-viewer': documentViewerEntry,
    'source-mode': sourceModeEntry,
  },
},
```

浏览器地址示例：

```text
http://localhost:5176/source-mode/index.html?libraryPath=...
```

### 8.2 模式覆盖层

在 `frontend/public/shims.js` 中实现：

```text
installModeSwitch()
  └─ 在 DOMContentLoaded 后找到原“切换文件夹”按钮
       └─ 点击时 stopImmediatePropagation()
            └─ openSourceMode()
                 └─ 创建 #eagle-source-mode-container + iframe
                      └─ iframe.src = /source-mode/index.html
                           └─ postMessage 桥接
                                ├─ open-folder-picker
                                ├─ list/scan/activity
                                └─ close-mode
```

按钮定位建议：

```js
document.querySelectorAll('.sidebar-toolbar .icon-btn').forEach((btn) => {
  const img = btn.querySelector('img[src*="ic_switch.svg"]');
  if (img) { ... }
});
```

不要依赖按钮文字，避免多语言导致选择器失效。

### 8.3 复用 OrcaBox UI

建议复制并裁剪以下 OrcaBox 文件到 `frontend/source-mode/`：

| OrcaBox 源文件 | 用途 |
| --- | --- |
| `src/renderer/components/layout/Sidebar.tsx:3128-3278` | 来源目录树 + “添加来源文件夹”按钮 |
| `src/renderer/components/layout/SourceFolderContextMenu.tsx` | 来源目录右键菜单 |
| `src/renderer/hooks/use-source-roots.ts` | 来源根 query/mutation |
| `src/renderer/lib/source-sections.ts` | 选中来源目录的 section 编码 |
| `src/renderer/components/layout/sidebar-utils.ts` | 目录树辅助函数 |
| `src/renderer/components/management/SourceRootManagerPanel.tsx` | 来源目录管理面板 |
| `src/renderer/components/assets/AssetGrid.tsx` | 素材网格（按需要裁剪） |
| `src/renderer/locales/zh.json` / `en.json` | 文案 |
| `src/renderer/compiled-tailwind.css` | 样式基底 |

裁剪原则：

- 第一阶段保留：来源树、添加、移除索引、手动扫描、选中目录、素材网格、缩略图。
- 第二阶段再接入：目录密码、移动/删除来源目录、回收站、AI 标签、批量操作。

### 8.4 模式内返回

OrcaBox 模式覆盖层内必须提供明确返回入口：

- 文案：“返回 Eagle 资源库模式”
- 行为：向父窗口发送 `close-mode`，由 `shims.js` 移除 iframe。
- 也可以保留 Eagle 顶部工具栏可见，让原有窗口按钮继续可用；但覆盖层内自身返回按钮仍是主路径。

## 9. 安全与边界

1. 来源目录是任意本地路径，必须进入 Electron `allowedRoots` 白名单。
2. 后端只接受本地请求，保持现有 `security.js` 的 localhost/token 校验。
3. 路径解析统一使用 `path.resolve` + 前缀校验，防止 `../` 越权。
4. 扫描忽略 `.git`、`node_modules`、`.orcabox-recycle`，并限制符号链接/嵌套项目包。
5. 大目录扫描必须支持队列、并发上限、取消、进度、重启恢复。
6. “移除来源目录”默认只删除索引，不删除磁盘文件；删除目录等破坏性操作放到后续阶段并增加二次确认。
7. `.library` 内文件继续走现有 Eagle 导入流程，不因 source-mode 被复制或改写。

## 10. 测试与验收

### 10.1 新增测试

| 测试文件 | 覆盖 |
| --- | --- |
| `tests/source-mode-api.mjs` | add/list/remove/scan/tree/restart persistence |
| `tests/source-mode-watch.mjs` | 新增、修改、删除文件后索引刷新 |
| `tests/source-mode-ui-closed-loop.mjs` | 点击原切换按钮进入模式、返回、来源目录选择 |
| `tests/source-mode-thumbnails.mjs` | 图片/视频/PDF/文本缩略图生成与缓存 |

### 10.2 验收标准

- 点击原侧栏“切换文件夹”按钮进入 OrcaBox 模式，不再打开快捷搜索。
- 模式内左侧栏与 OrcaBox 风格一致，包含“添加来源文件夹”。
- 添加来源文件夹后，文件不出现在 `.library/images/`，但出现在来源模式网格中。
- 来源根与子目录计数正确，新增/修改/删除文件可自动刷新。
- 返回 Eagle 模式后，当前 `.library` 和现有功能不受影响。
- `npm test` 原有回归全部通过。
- `npm run build` 可生成 `source-mode` 入口。

## 11. 建议执行顺序

### 里程碑 1：后端 source-mode 骨架

- 添加依赖。
- 新增 `source-db.js`、`source-indexer.js`、`source-routes.js`。
- 实现 `addPath/list/scan/tree/remove`。
- 通过 API 测试。

### 里程碑 2：Electron 桥接

- preload/main 新增 sourceMode IPC。
- 目录选择对话框和路径白名单。
- 测试注入环境变量。

### 里程碑 3：前端模式层

- 新增 Vite entry。
- 复制/裁剪 OrcaBox Sidebar 与 hooks。
- shims 拦截原按钮并创建 iframe。
- 实现返回 Eagle 模式。

### 里程碑 4：素材展示与缩略图

- 来源素材网格。
- 缩略图缓存服务。
- watcher 刷新 UI。

### 里程碑 5：完整回归

- `npm test`
- `npm run build`
- Electron UI 闭环测试。

## 12. 主要风险

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| `better-sqlite3` 原生模块 ABI | Electron 22 与 OrcaBox 的 Electron 37 不同 | 只在 Node 后端使用；如主进程需要则单独 rebuild |
| 复制 `Sidebar.tsx` 依赖过多 | 前端改动大、维护成本高 | 先裁剪来源目录区块，不整体复制 3400 行 Sidebar |
| 大目录扫描阻塞 | 添加来源后 UI 卡顿 | 使用 OrcaBox 的 batch/queue/progress 思路 |
| 来源目录路径变化 | 索引失效 | `reconcile` + 离线状态 + 重新扫描 |
| 原按钮行为被改 | 快速搜索回归 | 保留 `J` 快捷键与原菜单“切换文件夹” |

## 13. 关键文件参考

### Eagle

- `src/app/index.html:107-126`：资源库切换按钮与“切换文件夹”按钮。
- `src/app/app.bundle.js:32512-32517`：`openQuickSearch()`。
- `frontend/public/shims.js:389-405`：document viewer iframe 容器模式。
- `frontend/public/shims.js:3134-3146`：DOMContentLoaded 生命周期。
- `backend/src/library-service.js:140-180`：当前 `.library` 服务。
- `backend/src/server.js:1352-1362`：`/api/library/switch`。
- `electron/preload.cjs:11-26`：library 与 dialog API。
- `electron/main.cjs:25,104-113`：路径白名单。

### OrcaBox

- `src/renderer/components/layout/Sidebar.tsx:3128-3205`：来源目录树。
- `src/renderer/components/layout/Sidebar.tsx:3267-3278`：添加来源文件夹按钮。
- `src/renderer/hooks/use-source-roots.ts:107-153`：添加来源 mutation。
- `src/renderer/components/management/SourceRootManagerPanel.tsx:91-180`：来源目录管理。
- `src/main/preload.ts:30-51`：sourceRoots IPC。
- `src/main/ipc-handlers.ts:2057-2119`：add/list/remove 主链路。
- `src/main/services/index-service.ts:198-249`：`addSourceRoot()`。
- `src/main/services/index-service.ts:951+`：`scanRoot()`。
- `src/main/services/source-root-tree.ts:52-186`：SourceRoot 映射。
- `src/main/services/watch-service.ts:32-110`：watch/unwatch。
- `src/main/services/database-service.ts:239-326`：核心表结构。

## 14. 不实现项

第一阶段不承诺完整移植 OrcaBox 的全部能力：

- AI 标签、相似重复、Smart Cutout、DaVinci 集成。
- 来源目录密码、目录排序、完整回收站。
- 移动/删除来源目录时的物理文件操作。
- Lottie/3D/字体等高级预览管线。

这些可作为 `source-mode` 后续迭代，不阻塞“添加来源文件夹 + 文件夹树 + 素材展示”的 MVP。
