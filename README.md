# Eagle 1:1 复刻工作区

工作区：`H:/dev/Eagle-Sec-development - 副本`（分支 `react-in-place`）。

## 当前状态（R6，2026-09-14）

前端是**原地（in-place）Angular → React 19 + TypeScript + Vite 迁移**，已完成到 R6：

- **运行期没有 Angular**：`app.bundle.js`（4.4MB）已于 b1-9al 删除，`frontend/public/shims.js`、
  `mock-data.js` 已于 E9 删除，`src/app/js/directives|controllers|modules`（186 个 Angular
  指令模板/控制器/模块副本）已于 R6 删除。`index.html` 里只剩一个脚本标签：
  `<script type="module" src="/src/app/react/main.tsx">`。
- **启动契约**全量在 React 模块图内：十个窗口入口第一条 import 均为
  `src/app/react/core/shimsLegacy.ts` → `core/shim/install.ts`，按
  `environment / browserRuntime / moduleRegistry / settingsI18n / ipcBus / desktopCapability / demoSeed`
  分层装配 `require`/`process`/`electron`/`ipcRenderer`/`i18n`/`EagleConfig` 等全局。
- **主界面旧应用脚本**已逐件移植为具名 TS 模块：`eagle-api.js` → `core/eagleApi.ts` +
  `core/eagleBase.ts`，`url-enlarger.js` → `core/urlEnlarger.ts`，`lazy-load-manager.js` →
  `core/lazyLoadManager.ts`，`shortcut-manager.js` → `core/shortcutManager.ts`。
- 状态层：`src/app/react/store/**`（zustand）+ `core/scopeFieldBridge.ts` 的具名写点；
  Angular scope 面已由 `core/scopeFace.ts` + `core/driverApi.ts` 的显式白名单替代。
- 交付页面（主界面、偏好设置、预览大窗、采集窗、六个查看器、文档查看器、PDF/3D 引擎页、
  注册/设备替代页、静态工具页）逐条登记见 `docs/frontend-entry-ledger-2026-09-14.md`。
- 开发态与构建态共用同一份源 HTML（React 入口写在页面里）；开发中间件只补 API 地址与
  react-refresh 前置脚本。生产构建 `npm run build` 产出 `dist/frontend/`，URL 形状与开发态一致。

**尚未完成**：R7（统一交付验收入口：单一命令串起全范围类型检查 + 入口/架构检查 + 正式构建 +
关键业务回归 + 正式产物冒烟）。批间路线见 `docs/frontend-batch-plan-R0-R7-2026-09-14.md`。

## 启动

```powershell
Set-Location -LiteralPath 'H:/dev/Eagle-Sec-development - 副本'
npm install

npm run dev            # 仅前端（Vite，http://localhost:5176/src/app/index.html）
npm run dev:all        # 前端 + 后端（41695 API / 41692 缩略图 / 41693 扩展服务）
npm run dev:electron   # 前端 + 后端 + Electron 主进程（桌面态）
```

开发端口固定 5176（`strictPort`），被占用时任务直接失败而不是静默换端口；
端口清理见 `scripts/clear-ports.mjs`。

生产态：

```powershell
npm run build          # 产出 dist/frontend
npm run start:prod     # 本地静态服务 + 后端 + Electron（真实使用路径）
npm run serve:frontend # 只起静态服务
```

## 校验命令

```powershell
npm run typecheck             # src/app/react 全范围类型检查（0 诊断门禁）
npm run test:react-suite      # React 全量回归套件（71 项，顺序隔离执行）
npm run test:continuous-grid  # 连续网格几何 + 滚动/自动定位闭环（套件内的两项单跑）
npm run test:production       # 产物入口/资源检查 + Electron 正式启动冒烟（需先 npm run build）
npm test                      # 后端 API / 资源库 / 导入导出等后端链
npm run test:full             # npm test + 后端与 Electron 全链 + 截图回归
```

改动启动、IPC、全局状态或跨窗契约时请扩大回归面；日常批次跑受影响项 + `npm run typecheck` 即可。

## 目录

```text
src/app/
  index.html                 主界面（唯一脚本 = React 入口）
  其余窗口与查看器页面       各页内联 <script type="module" src="/src/app/react/...">
  react/                     React 应用（入口 main.tsx；每个窗口一个 entry.tsx）
    core/                    启动契约、store 桥、IPC、窗口驱动面、引擎移植
    store/                   zustand 状态域
    components/              界面组件
    api/ services/ utils/    React 侧纯业务/工具
  js/                        运行期仍被 require/Worker 使用的经典 JS（plugin、workers、
                             utils、vendors、api-server-v2）——非空目录，勿整目录删除
  css/ 图标 字体等静态资产
frontend/
  vite.preview.config.mjs    开发中间件 + 多页构建入口 + 产物资产交付
  public/                    整目录复制到产物（静态页、mock 库与 mock 资产，后者产物中删除）
backend/src/server.js        本地 API/扩展服务
electron/main.cjs            主进程（窗口、菜单、驱动脚本）
tests/                       回归套件与静态门禁
docs/                        迁移报告、批次计划、入口台账
```

## 文档索引

| 文档 | 用途 |
|---|---|
| `docs/frontend-batch-plan-R0-R7-2026-09-14.md` | R0–R7 批次计划与各批实施结果（**先读这个**） |
| `docs/2026-09-14_frontend-migration-remaining-report.md` | 迁移剩余量调查报告（R 划分的依据） |
| `docs/frontend-entry-ledger-2026-09-14.md` | 15 类交付页面的入口台账与处置清单 |
| `docs/e5-5-shims-retirement-plan.md` | shim 退役计划（E 阶段） |
| `docs/manual-qa-2026-09-13.md` | 实机 QA 记录 |
| `src/app/react/PROGRESS.md` | 逐批实施流水（含每批验证命令与结果，体量大） |

> 历史时间语境的文档（handover、收官、审计等）不在此表内；它们描述的是当时状态，
> 不代表现状，需要时以提交记录为准。

---

## 历史记录（时间语境，勿据此判断现状）

以下为早期阶段（Phase 0/1/2 与后续前端预览）的推进记录，保留原文以便追溯。
其中提到的 `app.bundle.js`、`frontend/public/shims.js`、`frontend/public/mock-data.js`、
原版 AngularJS 渲染路径与 41595 端口**均已退役**（见上文"当前状态"与
`src/app/react/PROGRESS.md`）。

### Phase 0 / Phase 1 / Phase 2（前端快速预览）

- 直接复用 `Eagle-reverse/src/app/index.html`、`app.bundle.js`、CSS、JS 和 assets。
- 浏览器 shim 提供 `require`、`process`、`electron`、`ipcRenderer` 和 Node 模块 mock。
- mock 资源库使用原版 `assets/images/light/illustrations` 素材生成 17 个条目、文件夹、智能文件夹、标签组。
- 已能在浏览器看到原版 AngularJS 主界面、侧栏、网格缩略图、Inspector 和中文界面文案。
- 偏好设置页 `/src/app/preferences.html`、预览窗口 `/src/app/preview-window.html?id=MOCK0001`、
  注册/许可替代页、采集窗口、页面入口 `/pages.html` 均可渲染。
- 后续按 `TASK.md` 继续推进独立页面、真实 `.library` 数据层、41595 API、Electron 文件能力、
  插件系统与导入导出。

### 已接入 Viewer（2026-08-03）

`pages.html` 已提供可直接查看的 viewer 入口：EXIF Viewer、Font Viewer、GIF Viewer、RAW Viewer、
Text Editor、Texture Viewer、Native Viewer、Model Viewer、PDF Viewer。

采集窗口已修复 mock 采集数据和文件夹面板时序问题，当前可在浏览器中看到缩略图、标签、
文件夹树和原版快捷键提示。详细验证记录见 `TASK.md`。

### Electron 与测试（2026-08-03 起）

- Electron 22 已安装，主进程/preload 提供采集数据、viewer 窗口、文件选择 IPC。
- 浏览器 shim 在 Electron 环境下会优先使用原生 `electron` 模块。
- `npm test`：API 冒烟、`.library` 校验、service plugin 生命周期。
- 截图回归覆盖 `screenshots/`：主界面、采集窗口、EXIF、Font、GIF、RAW、Text Editor、
  Texture、Native、Model、PDF、plugin、workbench、roadmap。

导入导出与搜索（历史能力清单）：

- `/api/item/addFromPath`、`addFromPaths`、`addFromURL`、`batchSave` 可导入本地文件或 URL 元数据。
- `/api/item/export` 可复制条目原文件到目标目录。
- `/api/item/search` 和 `/api/v2/item/query` 支持基础搜索过滤。
- `/api/item/refreshThumbnail`、`/api/v2/item/refreshThumbnail` 可生成缩略图。
- `/api/export/csv` 支持 CSV 下载或写文件；V2 item comments 已持久化。
- Electron 主进程启动时会加载示例 service plugin。
- `/api/export/eaglepack`、`/api/import/eaglepack` 支持 Eaglepack 打包与导入。
- `/api/item/duplicates` 支持按 size + sha1 检测重复条目。
- `/api/plugins` 提供插件列表，`/plugins/*` 与 `/plugin-templates/*` 提供插件静态资源。
- `/api/search/index`、`/api/v2/search/index` 提供持久化搜索索引。
- `/api/v2/folder/remove`、`/api/v2/tag/remove` 等管理接口已补齐。
- Electron `plugin:open` IPC 可打开插件窗口。
- `/api/v2/smartFolder/getItems` 按智能文件夹规则返回条目。
- 41593 扩展服务支持 addFile/addURL/import-images/collect 采集保存路由。
- 后端开发端口保持 `41695` API、`41692` 缩略图、`41693` 扩展服务；未显式指定端口时会额外尝试
  监听原版兼容 `41595/41592/41593`。远程图片走受控下载，批量捕获提供任务状态/取消/部分失败。
- 视频采集支持视频页书签元数据（`medium/videoID/videoEmbed/duration`）和直接视频 URL 受控下载入库。
- 外部捕获会通过原版 `file-uploaded` / `file-uploaded-end` / `import:operation-result` 通知链
  让已打开主界面即时刷新。
- `npm run test:browser-capture` 与 `npm run test:electron-extension-e2e`。
- `/api/item/mergeDuplicates`、`/api/v2/item/mergeDuplicates` 支持重复条目合并。
- PNG/JPEG 缩略图会缩放为最大边 320px。
- Eaglepack 导入支持 replace/merge 模式；`npm run test:electron-plugin` 验证插件窗口加载。
- `http://localhost:5176/workbench.html` 资源库管理工作台；`roadmap.html` 路线图执行面板。
- `/api/item/upload`、`/api/v2/item/upload` 支持文件上传导入。
- `/api/library/stats`、`/api/v2/library/stats` 提供资源库统计；`/api/library/repair` 补齐
  缺失 metadata 与缩略图；workbench 含 Library Stats / Repair / Migration 面板。
- 搜索支持颜色、尺寸、日期范围、评论和排序；workbench 搜索面板含对应控件。
- `/api/item/mediaInfo` 提供媒体类型识别。
- WebP/HEIC/AVIF/TIFF/RAW 缩略图尝试通过 sharp 解码生成。
- `/media-viewer/video.html` 与 `/media-viewer/audio.html` 提供视频预览和音频波形，
  workbench 视频/音频条目自动链接到 media viewer。
- `frontend/public/browser-extension/` 提供 Manifest V3 浏览器扩展脚手架；
  41593 提供 `/api/extension/status` 与 `/api/extension/collect`。
- Electron 主进程提供文件系统、原生缩略图、剪贴板、拖拽导入、菜单、托盘和窗口状态。
- `.eagleplugin` 支持打包、安装、卸载、启停和已安装列表；workbench 插件管理支持安装路径、
  卸载和禁用。
- 支持文件夹递归导入、Base64 导入、书签导入、资源库目录导出、Eaglepack 备份与恢复。
- `npm run dev:all` 一键启动 Vite 与 backend；`npm run health` 检查全部本地服务。
- `/api/library/scan`、`/api/library/migrate`、`/api/library/validate` 支持真实 `.library`
  扫描与迁移。
- 41595 增加 localhost/token 鉴权与统一 JSON 错误处理；Electron 文件 IPC 增加路径白名单与穿越防护。
- workbench 支持明暗主题、网格/列表切换、拖拽导入和快捷键。
- 后端新增 `/api/item/batchRename`、`/api/item/batchUpdate`、`/api/item/addToFolder`、文件夹密码、
  标签重命名/合并、重复扫描、Eaglepack 任务进度、`/api/plugins/center`；
  `npm test` 新增 `tests/roadmap-panels.mjs`，截图回归新增 `roadmap.png`。
