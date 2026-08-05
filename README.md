# Eagle 1:1 复刻工作区

目标目录：`C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development`

## 当前状态

已完成 Phase 0 工程初始化和 Phase 1 前端快速预览：

- 直接复用 `Eagle-reverse/src/app/index.html`、`app.bundle.js`、CSS、JS 和 assets。
- 浏览器 shim 提供 `require`、`process`、`electron`、`ipcRenderer` 和 Node 模块 mock。
- mock 资源库使用原版 `assets/images/light/illustrations` 素材生成 17 个条目、文件夹、智能文件夹、标签组。
- 已能在浏览器看到原版 AngularJS 主界面、侧栏、网格缩略图、Inspector 和中文界面文案。

已继续推进 Phase 2 独立页面：

- 偏好设置页：`/src/app/preferences.html`，原版 AngularJS 设置界面可渲染。
- 预览窗口：`/src/app/preview-window.html?id=MOCK0001`，原版预览窗口可渲染。
- 进度窗口：`/src/app/progress.html`，原版进度界面可渲染。
- 注册/许可状态与设备管理：使用安全替代页，不执行原版授权逻辑。
- 采集窗口：能进入 Angular 渲染，仍存在原版模板解析和 API 返回格式兼容问题。
- 页面入口：`/pages.html`

## 启动

```powershell
cd C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:5176/src/app/index.html
```

如果端口被占用，可在 `frontend/vite.preview.config.mjs` 中调整 `server.port` 和 `strictPort`。

## 脚本

```text
npm run dev       Vite 前端预览
npm run backend   41595 mock API 服务
npm run electron  桌面版入口（需先安装 Electron）
```

当前两个服务已运行：

```text
前端预览：http://localhost:5176/
页面入口：http://localhost:5176/pages.html
Mock API：http://localhost:41595/
```

## 目录

```text
frontend/
  vite.preview.config.mjs
  public/
    shims.js
    mock-data.js
    mock-library/
backend/
  src/server.js
electron/
  main.cjs
  preload.cjs
docs/
tests/
```

## 后续迁移

后续按 `TASK.md` 继续推进独立页面、真实 `.library` 数据层、41595 API、Electron 文件能力、插件系统与导入导出。

## 已接入 Viewer（2026-08-03）

`pages.html` 已提供可直接查看的 viewer 入口：

- EXIF Viewer、Font Viewer、GIF Viewer、RAW Viewer、Text Editor
- Texture Viewer、Native Viewer、Model Viewer、PDF Viewer

采集窗口已修复 mock 采集数据和文件夹面板时序问题，当前可在浏览器中看到缩略图、标签、文件夹树和原版快捷键提示。详细验证记录见 `TASK.md`。

## Electron 与测试（2026-08-03）

- Electron 22 已安装，主进程/preload 提供采集数据、viewer 窗口、文件选择 IPC。
- 浏览器 shim 在 Electron 环境下会优先使用原生 `electron` 模块。
- 新增 `npm test`：API 冒烟、`.library` 校验、service plugin 生命周期。

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:screenshots
```

截图回归覆盖 `screenshots/`：主界面、采集窗口、EXIF、Font、GIF、RAW、Text Editor、Texture、Native、Model、PDF。

导入导出与搜索：

- `/api/item/addFromPath`、`addFromPaths`、`addFromURL`、`batchSave` 可导入本地文件或 URL 元数据。
- `/api/item/export` 可复制条目原文件到目标目录。
- `/api/item/search` 和 `/api/v2/item/query` 支持基础搜索过滤。
- `/api/item/refreshThumbnail`、`/api/v2/item/refreshThumbnail` 可生成缩略图。
- `/api/export/csv` 支持 CSV 下载或写文件。
- V2 item comments 已持久化。
- Electron 主进程启动时会加载示例 service plugin。
- `/api/export/eaglepack`、`/api/import/eaglepack` 支持 Eaglepack 打包与导入。
- `/api/item/duplicates` 支持按 size + sha1 检测重复条目。
- `/api/plugins` 提供插件列表，`/plugins/*` 与 `/plugin-templates/*` 提供插件静态资源。
- `/api/search/index`、`/api/v2/search/index` 提供持久化搜索索引。
- `/api/v2/folder/remove`、`/api/v2/tag/remove` 等管理接口已补齐。
- Electron `plugin:open` IPC 可打开插件窗口。
- `/api/v2/smartFolder/getItems` 按智能文件夹规则返回条目。
- 41593 扩展服务支持 addFile/addURL/import-images/collect 采集保存路由。
- 后端开发端口保持 `41695` API、`41692` 缩略图、`41693` 扩展服务；未显式指定端口时会额外尝试监听原版兼容 `41595/41592/41593`。远程图片走受控下载，批量捕获提供任务状态/取消/部分失败。
- 视频采集支持视频页书签元数据（`medium/videoID/videoEmbed/duration`）和直接视频 URL 受控下载入库。
- 外部捕获会通过原版 `file-uploaded` / `file-uploaded-end` / `import:operation-result` 通知链让已打开主界面即时刷新。
- 新增 `npm run test:browser-capture` 与 `npm run test:electron-extension-e2e`。
- `/api/item/mergeDuplicates`、`/api/v2/item/mergeDuplicates` 支持重复条目合并。
- 截图回归现覆盖 plugin 页面，共 12 张。
- PNG 缩略图会缩放为最大边 320px。
- Eaglepack 导入支持 replace/merge 模式。
- `npm run test:electron-plugin` 可验证 Electron 中插件窗口加载。
- 新增 `http://localhost:5176/workbench.html` 资源库管理工作台。
- `/api/item/upload`、`/api/v2/item/upload` 支持文件上传导入。
- 截图回归现覆盖 workbench 页面，共 13 张。
- `/api/library/stats`、`/api/v2/library/stats` 提供资源库统计。
- `/api/library/repair` 可补齐缺失 metadata 与缩略图。
- workbench 工作台包含 Library Stats 与 Repair 面板。
- 搜索支持颜色、尺寸、日期范围、评论和排序。
- JPEG/JPG 缩略图支持缩放为最大边 320px PNG。
- workbench 搜索面板包含颜色、尺寸、日期和排序控件。
- `/api/item/mediaInfo` 提供媒体类型识别。
- workbench 智能文件夹支持多条件 JSON 编辑和已有列表选择。
- WebP/HEIC/AVIF/TIFF/RAW 缩略图尝试通过 sharp 解码生成。
- `/media-viewer/video.html` 与 `/media-viewer/audio.html` 提供视频预览和音频波形。
- workbench 视频/音频条目自动链接到 media viewer。
- `frontend/public/browser-extension/` 提供 Manifest V3 浏览器扩展脚手架。
- 41593 提供 `/api/extension/status` 与 `/api/extension/collect`。
- Electron 主进程提供文件系统、原生缩略图、剪贴板、拖拽导入、菜单、托盘和窗口状态。
- `npm run test:electron-desktop` 可验证 Electron 桌面能力。
- `.eagleplugin` 支持打包、安装、卸载、启停和已安装列表。
- workbench 插件管理支持安装路径、卸载和禁用。
- 支持文件夹递归导入、Base64 导入、书签导入。
- 支持资源库目录导出、Eaglepack 备份与恢复。
- `npm run dev:all` 一键启动 Vite 与 backend。
- `npm run health` 检查全部本地服务。
- `npm run test:full` 运行完整测试链。
- `npm run build` 可生成 `dist/frontend` 静态构建。
- `/api/library/scan`、`/api/library/migrate`、`/api/library/validate` 支持真实 `.library` 扫描与迁移。
- workbench 包含 Library Migration 面板。
- 41595 增加 localhost/token 鉴权与统一 JSON 错误处理。
- Electron 文件 IPC 增加路径白名单与穿越防护。
- workbench 支持明暗主题、网格/列表切换、拖拽导入和快捷键。
- `npm run test:workbench` 可验证前端交互。
- Electron 主界面直接复用原版 `index.html`、`app.bundle.js` 和 CSS。
- workbench 采用原版三段式布局：左侧管理栏、中间网格、右侧 Inspector。
- workbench 左上角汉堡菜单包含“设置”“浏览器扩展”“刷新”。
- 汉堡菜单“设置”可打开原版偏好设置页。
- 新增 `http://localhost:5176/roadmap.html` 路线图执行面板，集中覆盖批量管理、重复扫描合并、Inspector 编辑、筛选/快捷搜索、Eaglepack 进度、插件中心。
- 后端新增 `/api/item/batchRename`、`/api/item/batchUpdate`、`/api/item/addToFolder`、文件夹密码、标签重命名/合并、重复扫描、Eaglepack 任务进度、`/api/plugins/center`。
- `npm test` 新增 `tests/roadmap-panels.mjs`，截图回归新增 `roadmap.png`。

原版资源复用路线图见 `docs/REUSE_ROADMAP.md`。
