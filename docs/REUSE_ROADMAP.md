# Eagle 原版反编译资源复用执行文档

## 1. 目标

在 `C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development` 中，以 1:1 复刻为目标，优先复用 `Eagle-reverse/src/app/` 中已经反编译出来的原版 HTML、CSS、JS、directive、controller、viewer、插件系统和外部资源。

本文件用于新窗口继续执行时的详细任务清单。后续所有工作都应先确认是否已有原版资源可复用，再决定是否重写。

## 2. 当前已完成

- 浏览器预览：`http://localhost:5176/src/app/index.html`
- 工作台：`http://localhost:5176/workbench.html`
- 路线图执行面板：`http://localhost:5176/roadmap.html`
- 页面入口：`http://localhost:5176/pages.html`
- 原版页面已接入：
  - 主界面 `index.html`
  - 偏好设置 `preferences.html`
  - 预览窗口 `preview-window.html`
  - 进度窗口 `progress.html`
  - 采集窗口 `collect-window/index.html`
  - EXIF / Font / GIF / RAW / Text Editor / Texture / Native / Model / PDF viewer
- API 服务：
  - `41595` JSON API
  - `41592` 缩略图服务
  - `41593` 扩展服务
- 数据层：
  - `.library` 读取/写入
  - 导入导出
  - Eaglepack
  - 重复检测/合并
  - 搜索索引
  - 统计与修复
- Electron：
  - 主窗口
  - 文件系统 IPC
  - 原生缩略图
  - 剪贴板
  - 菜单/托盘/窗口状态
  - 插件窗口
- 浏览器捕获：
  - 后端开发端口保持 `41693/41695`，未显式指定端口时额外尝试绑定原版兼容 `41593/41595`
  - 远程图片受控下载、Data URI 截图、网页书签、页面多图批量任务
  - 视频页书签元数据持久化、直接视频 URL 受控下载入库
  - 批量任务状态、逐项错误、取消和终态恢复
  - 原版主界面外部捕获后即时刷新
  - 浏览器扩展 E2E 夹具验证内容脚本→后台→本机服务→真实 `.library`
- 原版浏览器捕获插件资产未在本机确认，真实原版插件 E2E 仍未最终验收。

## 3. 复用原则

1. 能直接用原版 HTML/JS 的，不重写。
2. 能复用原版 directive/controller 的，优先接入浏览器 shim。
3. 原版依赖 Node/Electron 的能力，先做 mock，再在 Electron 中替换真实实现。
4. 所有原版文件不改动；复刻层只放在 `Eagle-Sec-development`。
5. 授权、注册、设备校验逻辑不复刻。

## 4. 可直接复用的原版页面

| 页面 | 原文件 | 当前状态 |
| --- | --- | --- |
| 主界面 | `src/app/index.html` + `app.bundle.js` | 已接入 |
| 后台窗口 | `src/app/background.html` | 未接入 |
| 偏好设置 | `src/app/preferences.html` | 已接入 |
| 预览窗口 | `src/app/preview-window.html` | 已接入 |
| 进度窗口 | `src/app/progress.html` | 已接入 |
| 采集窗口 | `src/app/collect-window/index.html` | 已接入 |
| 缩略图 | `src/app/thumbnail.html` | 未接入 |
| 注册页 | `src/app/registration.html` | 已替换为安全替代页 |
| 设备管理 | `src/app/manage-device.html` | 已替换为安全替代页 |

## 5. 可复用核心逻辑

| 功能 | 原文件 | 建议 |
| --- | --- | --- |
| 主界面全局逻辑 | `src/app/js/global.js` | 已通过 app.bundle 生效 |
| 后台资源库逻辑 | `src/app/js/background.js` | 迁移关键能力 |
| 预览窗口逻辑 | `src/app/js/preview-window.js` | 已生效 |
| 设置逻辑 | `src/app/js/preferences.js` | 已生效 |
| 默认设置 | `src/app/js/default-preferences.js` | 已用于 shim |
| API V1 | `src/app/js/api-server.js` | 已复刻主要路由 |
| API V2 | `src/app/js/api-server-v2.js` | 已复刻主要路由 |
| API Playground | `src/app/js/api-v2-playground.js` | 未接入 |
| 快捷方式服务 | `src/app/js/services/shortcut-manager.js` | 未接入 |
| 懒加载服务 | `src/app/js/services/lazy-load-manager.js` | 未接入 |
| URL 状态服务 | `src/app/js/services/url-state-service.js` | 未接入 |

## 6. 可复用 UI 组件

### 6.1 管理类

- 批量重命名：`js/directives/batch-rename-modal.html` + `batch-rename-modal.js`
- 批量保存：`js/directives/batch-save-panel.html` + `batch-save-panel.js`
- 添加到文件夹：`js/controllers/add-to-folder.js`
- 移动文件夹：`js/controllers/move-folder.js`
- 新建智能文件夹：`js/controllers/new-smart-folder.js`
- 标签弹窗：`js/controllers/tag-popup.js`

### 6.2 重复与修复

- 重复扫描：`js/directives/duplicate-scan-panel.html` + `duplicate-scan-panel.js`
- 重复弹窗：`js/directives/duplicate-modal.html` + `duplicate-modal.js`
- 合并编辑器：`js/directives/merge-editor.html` + `merge-editor.js`

### 6.3 导入导出进度

- Eaglepack 导入进度：`js/directives/eaglepack-import-progress.*`
- Eaglepack 导出进度：`js/directives/eaglepack-export-progress.*`
- 文件导出进度：`js/directives/file-export-progress.*`
- 文件缩略图进度：`js/directives/file-thumbnail-progress.*`
- 资源库加载进度：`js/directives/library-load-progress.*`
- 资源库合并进度：`js/directives/library-merge-progress.*`
- WebP 转换进度：`js/directives/webp-convert-progress.*`
- 清理空文件夹进度：`js/directives/fixutil-clean-empty-folder-progress.*`

### 6.4 文件夹

- 文件夹选择面板：`js/directives/folder-select-panel.*`
- 文件夹排序：`js/directives/folder-sortable.js`
- 文件夹密码弹窗：`js/directives/folder-password-modal.*`
- 文件夹输入：`js/directives/folders-input.*`
- 库面板：`js/directives/library-panel.*`

### 6.5 标签

- 标签选择面板：`js/directives/tag-select-panel.*`
- 通用标签选择：`js/directives/general-tag-select-panel.*`
- 标签管理：`js/directives/tag-manager.*`
- 标签输入：`js/directives/tags-input.*`
- 标签矩形选择：`js/directives/tag-rect-select.js`

### 6.6 Inspector

- Inspector 主组件：`js/directives/inspector.html` + `inspector.js`
- 备注：`inspector-annotations.*`
- 文件夹：`inspector-folders.*`
- 信息：`inspector-information.*`
- 标签：`inspector-tags.*`
- 插件：`inspector-plugin.*` + `inspector-plugin-view.js`

### 6.7 搜索与筛选

可直接复用原版筛选器：

- `filter-item-annotation.*`
- `filter-item-bpm.*`
- `filter-item-camera.*`
- `filter-item-color.*`
- `filter-item-duration.*`
- `filter-item-folders.*`
- `filter-item-fonts.*`
- `filter-item-image.*`
- `filter-item-import.*`
- `filter-item-mtime.*`
- `filter-item-note.*`
- `filter-item-rating.*`
- `filter-item-resolution.*`
- `filter-item-semantic.*`
- `filter-item-shape.*`
- `filter-item-size.*`
- `filter-item-tags.*`
- `filter-item-types.*`
- `filter-item-url.*`
- `filters.js`

### 6.8 插件 UI

- 插件中心：`js/directives/plugin-center.html` + `plugin-center.js`
- 插件创建器：`js/directives/plugin-creator.*`
- 插件面板：`js/directives/plugin-panel.*`
- 插件视图：`js/directives/plugin-view.js`

### 6.9 其他

- 快捷搜索：`js/directives/quick-search-modal.*`
- 欢迎页：`js/directives/welcome-page.*`
- 关于面板：`js/directives/about-panel.*`
- 通知：`js/directives/notification-modal.*`
- 新版本通知：`js/directives/new-version-notification-modal.*`
- ArtStation 导入：`js/directives/artstation-import-modal.*`
- WebView 工具栏：`js/directives/webview-toolbar.*`
- 布局面板：`js/directives/layout-panel.*`
- 矩形选择：`js/directives/rect-select.js`
- 裁剪图片：`js/directives/crop-image.js`
- 绘制板：`js/directives/drawboard.js`
- 音频媒体：`js/directives/audio-media-element.js`
- 视频媒体：`js/directives/media-element.js`
- MPV 媒体：`js/directives/mpv-media-element.js`
- 右键菜单：`js/modules/context-menu/*`

## 7. 可复用插件系统

| 文件 | 用途 |
| --- | --- |
| `js/plugin/index.js` | 插件运行框架 |
| `js/plugin/api.js` | Eagle 插件 API |
| `js/plugin/main.js` | 插件主进程桥 |
| `js/plugin/model/item.js` | item API |
| `js/plugin/model/folder.js` | folder API |
| `js/plugin/model/tag.js` | tag API |
| `js/plugin/model/tag-group.js` | tagGroup API |
| `js/plugin/model/smart-folder.js` | smartFolder API |
| `js/plugin/handlers/smart-folder-rules.js` | 智能文件夹规则 |

## 8. 可复用 Node 模块

位于 `Eagle-reverse/src/my_modules/`：

- `json-rest-light`：API 服务框架
- `electron-settings`：设置持久化
- `image-palette`、`quantize`：颜色分析
- `exif`、`iptc`、`raw-parser`、`heif`：元数据/图片格式
- `extract-icon`、`file-icon`、`set-icon`：图标
- `win-clipboard`、`native-mouse`、`osascript`：平台能力
- `curl-request`、`downloadFile`：网络下载
- `pinyinlite`、`tiny-pinyin`：中文搜索
- `image-size`：图片尺寸

## 9. 可复用外部资源

- `C:\Program Files\Eagle\resources\plugin_templates\`
- `C:\Program Files\Eagle\resources\templates\`
- `C:\Program Files\Eagle\resources\dict\`
- `C:\Program Files\Eagle\resources\assets\`
- `Eagle-reverse/src/app/sounds/`
- `Eagle-reverse/src/app/images/`
- `Eagle-reverse/src/app/templates/`

## 10. 执行顺序建议

以下大任务已按路线图在 `roadmap.html` 与后端 API 中补齐可操作面板，覆盖 `.library` 持久化、筛选搜索、重复合并、Eaglepack 进度和插件中心；原版组件仍可通过主界面直接打开。

### 大任务 A：批量管理功能

已完成：`roadmap.html` 提供批量重命名、批量更新、文件夹分配、文件夹密码、标签重命名/合并；后端提供 `/api/item/batchRename`、`/api/item/batchUpdate`、`/api/item/addToFolder`、`/api/folder/*Password`、`/api/tag/update`、`/api/tag/merge`。

1. 接入批量重命名面板。
2. 接入批量保存面板。
3. 接入添加到文件夹/移动文件夹。
4. 接入文件夹密码弹窗。
5. 接入标签管理。

验收标准：

- workbench 或主界面可打开原版面板。
- 操作后 `.library` 数据持久化。
- 截图回归通过。

### 大任务 B：重复扫描与合并

已完成：`roadmap.html` 提供 exact/similar 扫描、进度展示和分组合并；后端提供 `/api/item/duplicates/scan`、`/api/v2/item/duplicates/scan`，合并继续使用 `/api/item/mergeDuplicates`。

1. 接入原版 duplicate-scan-panel。
2. 接入 duplicate-modal。
3. 接入 merge-editor。
4. 对接当前 duplicates API。

验收标准：

- 可扫描重复项。
- 可合并 tags/folders/comments。
- 合并后索引和 cache 更新。

### 大任务 C：Inspector 编辑

已完成：`roadmap.html` 提供条目名称、备注、URL、标签、文件夹、评分、comments 编辑并持久化到 metadata。

1. 接入原版 Inspector 主组件。
2. 接入 annotations、folders、information、tags、plugin。
3. 对接 item update API。
4. 保留当前 workbench 三段式布局。

验收标准：

- 选中条目后可编辑备注、标签、文件夹、评分。
- 修改持久化到 metadata。

### 大任务 D：筛选器与快捷搜索

已完成：`roadmap.html` 提供快捷搜索和颜色、尺寸、日期、评分、标签、类型、注释、URL 筛选，搜索接口与 `/api/item/search` 保持一致。

1. 接入原版 filter-item-* 组件。
2. 接入 quick-search-modal。
3. 对接现有 search index。

验收标准：

- 可按颜色、尺寸、日期、评分、标签、URL、注释筛选。
- 搜索结果与 API 一致。

### 大任务 E：Eaglepack 进度与导入导出

已完成：`roadmap.html` 通过 `/api/export/eaglepack/start`、`/api/import/eaglepack/start`、`/api/jobs/:id` 展示任务进度。

1. 接入 eaglepack-import-progress。
2. 接入 eaglepack-export-progress。
3. 接入 file-export-progress。
4. 对接当前 eaglepack API。

验收标准：

- 导入/导出时有原版进度面板。
- 完成后索引和缓存正确。

### 大任务 F：插件中心

已完成：`roadmap.html` 提供插件列表、详情、打开、安装、卸载、打包入口，后端 `/api/plugins/center` 汇总已安装插件与模板。

1. 接入 plugin-center。
2. 接入 plugin-creator。
3. 接入 plugin-panel。
4. 对接当前插件安装/卸载 API。

验收标准：

- 可浏览已安装插件。
- 可打开插件详情。
- 可安装/卸载插件。

## 11. 测试与截图

每个大任务完成后必须：

1. `node --check` 所有新增 JS。
2. `npm test` 通过。
3. `npm run test:workbench` 通过。
4. `npm run test:electron-desktop` 通过。
5. `npm run test:screenshots` 通过，并新增对应页面截图。

当前 `npm test` 已包含 `tests/roadmap-panels.mjs`，截图回归包含 `roadmap.png`。

## 12. 禁止事项

- 不修改 `Eagle-reverse/src/app` 原文件。
- 不复刻授权、注册、设备校验。
- 不保存原版私钥或绕过许可。
- 不把 mock 数据当作真实用户数据。
