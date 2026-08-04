# Eagle 1:1 复刻工程深度构建审查报告

> 审查日期：2026-08-04  
> 复刻工程：`C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development`  
> 反编译资源：`C:\Program Files\Eagle\Eagle-reverse`  
> 审查方式：任务文档核对、源码静态审查、路由/IPC 对照、生产构建、服务健康检查、API 隔离探测、浏览器截图回归、Electron 冒烟复测。

## 0. 资源库创建闭环修复更新（2026-08-04）

本报告第 3.1 节记录的“创建资源库未实现”已在本轮修复，按最新源码与自动化结果应更新为：

### 完整实现

- `backend/src/library-service.js` 已统一 `create/open/switch/history/current`，current/history 写入独立状态文件，后端重启可恢复。
- `POST /api/library/create`、`GET /api/library/current`、`POST /api/library/open` 已实现；V1/V2 switch/history 已统一到同一服务。
- 新库真实创建 `metadata.json`、`tags.json`、`saved-filters.json`、`folders.json`、`cache.json`、`search-index.json` 与 `images/`，不是只返回 HTTP 200。
- Electron main/preload 已提供真实目录选择、保存对话框和 `library:create/open/switch/current/history` bridge；动态选择的新库会加入路径白名单。
- `frontend/public/shims.js` 在 Electron 中把原版 `create-library`、`open-library`、`add-to-history-and-open` 事件转发到受控 bridge，并使用真实文件系统读取当前库 cache；浏览器预览继续使用 mock。

### 自动化证据

- `tests/library-create-service.mjs`：新库结构、空 cache/索引、服务重建恢复 current/history 通过。
- `tests/library-create-api.mjs`：唯一系统临时目录、独立端口、后端进程退出并重启后恢复 current/history 通过。
- `tests/electron-library-bridge.mjs`：清除 `ELECTRON_RUN_AS_NODE`，独立启动 Vite/API/Electron，在原版 renderer 页面内验证 current/history/create/open/switch/dialog bridge，并真实执行 PNG 导入、图片导出与导出文件存在检查。
- API 冒烟 13/13、Workbench 交互、Electron desktop 冒烟、生产构建均通过。

### 图片导入闭环修复更新

- `addFromPaths` 已兼容 Electron 的 `{ paths: [...] }`，并继续接受 `{ images: [{ path }] }`；源不存在或不是文件时返回 400，禁止假成功。
- importer 会按 PNG/JPEG/GIF/WebP 魔数、originalname、MIME 和路径扩展名识别类型；PNG/JPG 尺寸、MIME、size、原文件和缩略图真实落盘。
- multer 上传已拆分原始文件名和扩展名，PNG 不再记录为 bin，也不再生成 `.png.bin` 导出名。
- Electron/preload/shim 已接通原版 `upload-local-files`、`upload-url(s)`、`import-folders`；成功项通过 `file-uploaded` 事件回到原版 renderer。
- `tests/image-import-closed-loop.mjs` 已验证真实 PNG/JPG、无扩展 PNG 魔数识别、上传、缺失源错误和后端重启恢复。

### 仍未完成或仅部分实现

- 尚未做系统文件对话框的点击级 UI 自动化；原版 library-panel 的业务通道已接通，但对话框人工交互仍需后续 UI E2E 补证。
- 文件夹导入缺口已补齐核心闭环：按原版行为生成同构 Eagle 文件夹树，条目绑定直接所属文件夹；嵌套 `.library`、符号链接、深度和文件数均有明确边界。
- 新增异步文件/文件夹导入作业、逐项进度、部分错误隔离和文件间取消；Electron/preload/shim 已将原版 `upload-local-files`、`importFolders`、`file-uploaded`、`cancel.all` 与 `folders-change` 接到真实实现。
- 未支持缩略图的格式现在写入 `noThumbnail=true`，不再复制 Welcome Library 占位图。
- `tests/folder-import-closed-loop.mjs` 已验证嵌套树、`.library` 跳过、直接文件夹绑定、进度、部分取消和后端重启恢复。
- 构建仍只转换 2 个模块，`dist/frontend` 未包含 `src/app`，不能据此称为独立发布构建。
### 图片导出闭环修复更新

- 新增 `backend/src/export-service.js`，支持多选、目标同名冲突、已存在文件冲突、目录树导出与时间戳保留；复制使用排他模式，禁止静默覆盖。
- Electron/preload/shim 已接通原版 `export-images`、`export-as-folder` 与 `file-export-progress` 事件模型，逐文件发送进度，`cancel.all` 可在文件间停止后续复制并报告取消。
- `tests/image-export-closed-loop.mjs` 使用唯一系统临时目录验证平铺多选、同名冲突、目录树、时间戳、取消以及导出文件 SHA-256 与资源库原文件一致。

### Collect 保存闭环修复更新

- `41593` 扩展保存路由已由占位响应改为真实 importer：图片 Data URI 写入当前库的原文件、缩略图和 metadata；URL 采集生成真实 `.url` 文件。
- `title/name`、`annotation`、`url`、`tags[n]`、`folderIDs[n]` 与 `star` 已按采集窗口表单契约持久化。
- `tests/collect-save-closed-loop.mjs` 以唯一系统临时库和独立端口验证图片/书签落盘及后端重启恢复；`tests/smart-extension-plugin.mjs` 已隔离端口和临时库，验证三个扩展别名路由真实落盘。
- 截图回归已复验 18/18 通过，collect-window 文件夹选择面板稳定渲染；主界面断言不再依赖固定条目标题。

### Eaglepack 原版格式兼容修复更新

- 已依据原版 `background.js:4436-4572`、`4862-5085` 将新导出结构改为顶层 `pack.json + <id>.info/`，并在导入时重映射条目/文件夹 ID、coverId、folders、order 和 metadata。
- 合并导入按原文件 SHA-1 跳过重复内容；缺失原文件/条目目录的损坏包会拒绝，ZIP 条目做路径穿越校验。
- 保留旧自产 `manifest.json + images/` 包的只读导入兼容；新测试验证原版结构、ID 重映射、文件 SHA-256、重复合并、损坏包拒绝和旧格式恢复。
- 当前属于源码契约兼容，尚未取得真实 Eagle 客户端外部样本做双向客户端实测。

### 仍未完成

- 用户已明确暂不推进独立发布构建；当前构建仍只转换 2 个模块且不包含 `src/app`，不计为完成。

## 1. 结论摘要

当前工程不是“功能已经完成的 1:1 复刻”，更准确的定位是：

1. **原版 UI 可视化预览层**：原版 `index.html`、`app.bundle.js`、CSS、图片和 viewer 已能在 mock 生命周期下渲染。
2. **自建数据/API 原型**：具备 `.library` 读写、部分导入导出、搜索、缩略图、Eaglepack、插件包等后端函数和路由。
3. **Electron 冒烟壳**：窗口、少量文件 IPC、插件窗口、缩略图、剪贴板可通过冒烟测试，但原版业务 IPC 尚未接通。
4. **核心产品闭环尚未形成**：创建/打开资源库、原版主界面导入导出、真实库预览、文件对话框、后台窗口、采集保存、完整媒体管线等仍未实现或只存在函数级原型。

因此，TASK.md 与 README 中大量“已完成”表述应下调为“API 原型完成”“mock 页面可渲染”或“冒烟验证完成”，不能视为最终功能验收。

## 2. 本轮构建与测试结果

| 项目 | 结果 | 判断 |
| --- | --- | --- |
| 服务健康检查 | 5/5 通过 | 5176、41695、41692、41693 当前可响应 |
| `npm run build` | 成功，Vite 转换 2 个模块 | 仅证明静态入口能构建，不代表桌面产品可发布 |
| 构建产物检查 | `dist/frontend` 无 `src/app/` | `pages.html` 中原版页面链接在纯生产产物中不可独立工作 |
| API 冒烟 | 13/13 通过 | 主要是状态码和基本返回结构检查 |
| `npm test` | 在 importer 测试后失败 | `tests/importer-search.mjs:40-41` 的 `fs.rmSync` 被当前安全删除机制拦截，后续测试未执行 |
| Electron 四组冒烟 | 清除 `ELECTRON_RUN_AS_NODE=1` 后全部通过 | 证明 Electron 能启动及少量 IPC 可用，不证明资源库业务闭环 |
| Workbench 交互 | 单独运行通过 | 仅覆盖菜单、Inspector 显示、主题、列表视图、搜索框快捷键 |
| 截图回归 | 18/18 通过（最新复验） | collect-window 与主界面均稳定渲染；截图验证页面状态，采集业务写入另由独立闭环测试验证 |

### 构建产物问题

`frontend/vite.preview.config.mjs:106-111` 只以 `frontend/public/pages.html` 为 Rollup 入口。构建输出显示仅转换 2 个模块，并产生了嵌套路径：

```text
dist/frontend/Eagle-Sec-development/frontend/public/pages.html
```

虽然 public 资源被复制，但反编译源目录 `src/app/` 没有进入 `dist/frontend`。因此当前构建更像“导航页静态打包”，不是可脱离源码目录运行的应用包。

## 3. 用户指出功能的实测结论

### 3.1 创建资源库：原审查时未实现，现已完成核心闭环

证据：

- 后端 `server.js` 没有 `/api/library/create`；隔离探测返回 HTTP 404。
- Electron `main.cjs:239-247` 的 File 菜单只有 `Open Library`，且点击后只弹目录对话框，没有切换或初始化资源库。
- 原版 UI 已包含完整入口：
  - `src/app/js/directives/library-panel.html:55-56`
  - `src/app/js/directives/library-panel.js:95-103`
  - `src/app/app.bundle.js:26233-26324`
- 原版后台创建逻辑可参考：`src/app/js/background.js:4014-4063`，会创建 `<name>.library/metadata.json` 并加入历史、打开资源库。
- 当前 shim 的 `dialog.showOpenDialog/showSaveDialog` 固定返回取消：`frontend/public/shims.js:502-503`；`ipcRenderer.send()` 仅打印日志：`shims.js:299-302`。

**更新结论：上述缺口已由本轮自研 `library-service`、API、Electron bridge 和 shim 接线补齐，且通过真实落盘与进程重启恢复测试；系统文件对话框的点击级 UI 自动化仍待补充。**

### 3.2 本地文件/路径导入：存在函数，但 Electron 路径导入是坏链路

隔离实测：向 `/api/item/addFromPaths` 发送 Electron 当前使用的 `{ paths: [...] }`，接口返回 200，但生成：

```text
name: New Item
ext: bin
size: 0
originalExists: false
```

原因：

- Electron `main.cjs:228-234` 发送 `{ paths: list }`。
- 后端 `addMockItems()`（`server.js:971-1015`）只读取 `body.images` 或单项 `path/src/url`，不读取顶层 `paths`。
- `importFile()` 对不存在的本地源仍会创建 metadata，只有 `sourcePath` 有效时才复制原文件（`importer.js:34-77`）。

**结论：路径拖拽/原生路径导入目前是假成功，会产生无原文件条目。**

### 3.3 Workbench 文件上传：能落盘，但扩展名处理错误

隔离上传 `Probe Image.png` 后，返回条目为：

```text
name: Probe Image.png
ext: bin
```

导出结果为 `Probe Image.png.bin`。原因是 multer 临时文件没有扩展名，而 `server.js:1048-1053` 只把 `originalname` 传成 `name`，没有把 `path.extname(originalname)` 传入 `ext`；`importer.js:43` 最终回退到 `bin`。

**结论：上传 API 具备复制能力，但图片类型、文件名、预览选择和导出名称尚未正确闭环。**

### 3.4 图片导出：函数级可用，产品级未实现

- `importer.js:139-147` 的 `exportItem()` 可复制单个本地原文件。
- `/api/item/export` 位于 `server.js:1185-1199`，隔离调用可落盘。
- 但 workbench 的 Export 区只有 CSV/Eaglepack/Backup/Restore（`workbench.html:294-303`），没有“导出所选图片”。
- 原版主界面的导出菜单依赖 `showOpenDialog/showSaveDialog` 和 `export-images/export-as-folder` IPC；当前 shim 不转发，Electron 也未注册这些业务通道。
- 当前实现不支持多选、同名冲突策略、保留时间戳、目录树导出、格式转换、取消/进度和完成后定位。

**结论：后端单文件复制不是 Eagle 图片导出功能，用户反馈“未实现”成立。**

### 3.5 URL、Base64、书签和文件夹导入

| 功能 | 当前状态 | 主要缺口 |
| --- | --- | --- |
| 文件夹递归 | 后端可调用 | 无文件类型过滤、无目录到 Eagle 文件夹映射、无批量进度/取消、错误隔离不足 |
| Base64 | 后端可调用 | 使用固定 `.import-base64.tmp`，并发冲突；名称/扩展推断有限 |
| 书签 | 仅生成 `.url` metadata | 不生成真实可预览书签文件/网页缩略图 |
| URL | 多数情况只存 URL metadata | 未下载远程内容；`addFromURL` 名称/扩展容易退化为占位 |
| 浏览器扩展 | 脚手架和接口存在 | 未证明与真实浏览器、当前真实库、原版采集窗口形成闭环 |

## 4. 关键架构断点

### P0：阻断 1:1 产品闭环

1. **原版 renderer 在 Electron 中仍强制使用 mock IPC**  
   `shims.js:12-17` 明确把 `realElectron` 和 `realRemote` 设为 `null`；`shims.js:1053-1055` 因而继续暴露 mock。README 第 89 行“Electron 环境优先使用原生 electron”与代码不符。
2. **原版文件系统写操作是空实现**  
   `shims.js:173-176` 的 `writeFileSync/writeFile` 不写盘；原版后台逻辑无法靠当前 shim 工作。
3. **业务 IPC 覆盖严重不足**  
   动态分析记录 211 条 IPC；当前 `electron/main.cjs` 仅约 15 个 handler/on，且缺少 `create-library`、`open-library`、`import-folders`、`upload-local-files`、`upload-url(s)`、`export-images`、`export-as-folder` 等关键通道。
4. **当前库状态分裂**  
   后端可切换真实库，但 Electron `library:get-current` 永远返回 mock 库（`main.cjs:155-159`），renderer `mock-data.js` 也固定 Demo.library。
5. **Workbench 预览路径硬编码 mock 库**  
   `workbench.html:431-443` 对任意条目都生成 `/mock-library/Eagle Reverse Demo.library/...`，切换真实库后预览会错库。

### P1：功能可靠性和数据正确性

1. `saveItems()` 只写当前 items 的 metadata，不清理已删除/改名后的旧目录和旧文件。
2. item rename/update 没有同步重命名实际原文件与缩略图。
3. `setCustomThumbnail`、`refreshPalette` 等路由直接返回 success，没有真实实现（`server.js:1149-1165`）。
4. 非 PNG/JPEG/Sharp 支持格式默认复制 Welcome Library 占位缩略图（`thumbnailer.js:64-67`），会造成内容错误而非“无缩略图”。
5. AI Search 路由全部是固定 false/空结果（`server.js:1893-1901`）。
6. Eaglepack 已改为原版 `pack.json + <id>.info/` 结构并补损坏校验、ID 重映射和旧格式导入兼容；仍缺真实 Eagle 客户端外部样本的跨客户端双向实测。
7. API 端口实际为 41695/41692/41693（`server.js:35-37`），TASK/README 多处仍写 41595/41592/41593，影响扩展和工具兼容目标。
8. Electron `allowedRoots` 包含 `Eagle-reverse` 上级范围但不包含任意用户选择的新库；真正打开外部库时安全模型和可用性冲突。

### P2：测试和文档可信度

1. `npm test` 依赖已有后端服务，没有自动启动/隔离服务。
2. 大量测试在共享 `test-run/` 上做删除，当前宿主的安全删除机制会中断测试链。
3. Screenshot 测试多为 DOM 存在断言，不覆盖点击创建库、真实文件选择、导入后预览、导出后校验等行为。
4. Electron smoke 只验证启动和少量桥接；`--smoke` 主进程测试甚至 1.5 秒后直接退出。
5. `collect` 截图回归已在最新复验中通过（18/18）；其真实保存能力由隔离临时库测试单独覆盖，避免仅以 DOM/截图代替业务验收。
6. TASK.md/README 的端口、shim 行为、完成状态互相矛盾，应按可复现测试重新分级。

## 5. 仍可复用的反编译资源

本轮统计到：`src/app` 内约 92 个 HTML、55 个 CSS、397 个 JS；其中 directive 为 89 个 JS + 64 个 HTML，缩略图 handler 39 个，插件 runtime 17 个 JS，8 种语言资源，`src/my_modules` 下 57 个自定义模块目录。

### 5.1 可直接复用：视觉和纯前端组件

| 范围 | 资源 | 建议 |
| --- | --- | --- |
| 主界面结构/样式 | `src/app/index.html`、`app.bundle.js`、`css/`、`assets/` | 保留为 renderer 基线，不再另造 workbench 视觉层 |
| 资源库面板 | `js/directives/library-panel.html/.js` | 复用 UI、搜索、历史、固定库交互；替换其 Electron/Settings 依赖 |
| 导入面板 | `batch-save-panel.*`、`folder-select-panel.*`、`tags-input.*` | 接后端任务队列和真实 library store |
| 导出进度 | `file-export-progress.*`、`eaglepack-export-progress.*` | 复用 UI 和事件模型，重写 IPC handler |
| 重复与合并 | `duplicate-scan-panel.*`、`duplicate-modal.*`、`merge-editor.*` | 可接现有 duplicates API，但需补文件清理和事务 |
| Inspector | `inspector*.html/.js` | 复用 UI，统一 item 更新与文件重命名事务 |
| 搜索筛选 | `filter-item-*`、`quick-search-modal.*`、`filters.js` | 比当前 workbench 表单更接近 1:1，可接自建索引 |
| viewer | EXIF/Font/GIF/RAW/Text/Texture/Native/Model/PDF | 保留页面资源；改为从当前 library resolver 获取真实路径 |
| i18n | `src/i18n/*.js` | 可直接复用文案与语言键，去除授权相关入口即可 |

### 5.2 适合移植：纯 JS 或可替换依赖的业务逻辑

1. **资源库创建与导出算法**  
   参考 `background.js:4014-4111` 的创建/历史/打开流程，以及 `4155` 之后的文件夹和图片导出冲突处理。不要直接运行完整 background.js，应抽取并重写为可测试服务。
2. **V1/V2 API 参数语义**  
   `js/api-server.js`、`js/api-server-v2.js`、`api-v2-playground-config.js` 可作为兼容契约；保留路径和字段，替换执行层。
3. **插件模型**  
   `js/plugin/model/item.js` 等定义了 Base64/URL/Path/Bookmark/批量导入的统一参数，可作为新 importer 的 DTO 和 SDK 契约。
4. **缩略图分派表和格式 handler**  
   `js/thumbs/thumb.js` 提供 39 类 handler 的分派和尺寸策略。PNG/JPG/GIF/SVG/PDF 等 JS 路径可优先移植；视频、Office、RAW、3D 需逐个替换依赖。
5. **颜色、EXIF、IPTC、尺寸和中文搜索模块**  
   `src/my_modules/image-palette`、`exif`、`iptc`、`image-size`、`pinyinlite`、`tiny-pinyin` 可先做许可证和 Node 版本审查，再移植到独立 worker。

### 5.3 只能参考重写：强绑定 Electron/原生能力

| 范围 | 原资源 | 原因 |
| --- | --- | --- |
| 主进程 | `run.jsc`、`reconstructed/main-process-equivalent.js` | 字节码未完整还原；只应依据动态 IPC 契约重建 |
| 文件/窗口 IPC | `analysis/dynamic-hook-ipc.txt`、动态报告 | 可作为通道清单，handler 必须自研并加路径权限模型 |
| 视频/音频 | `thumbs/video.js`、`audio.js`、mpv/ffmpeg 相关 | 依赖 DOM、MPV、ffmpeg 或原生模块，需要 Electron worker 验证 |
| Office/系统缩略图 | `word.js`、`excel.js`、`powerpoint.js`、`native.js` | 依赖系统组件、DLL 或 Shell API |
| RAW/HEIC/3D | 对应 thumbs 与 viewer | 部分可复用 WASM/JS，但需独立测试依赖和再分发许可 |
| 系统集成 | clipboard、文件图标、网络盘、鼠标等 my_modules | 原生二进制存在 ABI/平台/安全风险，优先用 Electron/Node 标准能力替代 |

### 5.4 不应复用

授权、试用、注册、机器 ID、私钥、hosts/时间校验和原版内置 token 校验逻辑不应迁移。反编译页面、图片、字体、第三方库和原生二进制在发布前还需逐项确认许可证、著作权和再分发授权；“技术上可复用”不等于“可合法分发”。

## 6. 建议实施顺序

### 里程碑 1：先打通资源库主链路

1. 新建 `library-service`：`create/open/switch/close/history`，定义唯一 current library 状态。
2. 实现 `/api/library/create` 与 Electron `library:create/open/switch` IPC。
3. 复用原版 `library-panel`，把 dialog 和 history 接到真实桥接层。
4. 新库必须创建并验证 `metadata.json`、`tags.json`、`saved-filters.json`、`images/`、`cache.json`、索引文件。
5. 加入隔离 E2E：创建库 → 导入一张 PNG → 重启/重载 → 仍可读取。

### 里程碑 2：修复导入数据正确性

1. 修正 `addFromPaths` 的请求契约，禁止源不存在时返回 success。
2. 上传时从 `originalname` 正确分离 name/ext，并识别 MIME/魔数。
3. 用任务队列处理本地文件、文件夹、URL、Base64、书签，支持进度、取消、逐项错误。
4. 复用 `batch-save-panel`、`folder-select-panel`、标签组件。
5. 补缩略图、尺寸、EXIF、palette 和原文件哈希；失败时标记 `noThumbnail`，不得复制无关占位图。

### 里程碑 3：实现图片/文件夹导出闭环

1. 实现 `export-images`、`export-as-folder`、取消与进度 IPC。
2. 复用原版冲突命名、目录树和 `file-export-progress`。
3. Workbench 和原版主界面统一调用同一个导出服务。
4. E2E 验证：多选 → 选择目录 → 导出 → 哈希一致 → 同名不覆盖 → 取消可回滚/报告。

### 里程碑 4：消除 mock 主界面

1. Electron 下不再把 `realElectron` 强制置空；建立受控 preload API，而不是开放任意 Node。
2. 把 main renderer 的 library/items/folders/tags 生命周期改为真实事件源。
3. 删除媒体路径对 Demo.library 的硬编码。
4. 接入 `background.html` 或将其职责拆为主进程/worker 服务。
5. collect window 已补真实保存闭环与截图回归；后续可再增加 Electron 窗口内点击“保存”的 UI E2E。

### 里程碑 5：格式、插件与发布

1. 按 PNG/JPG/GIF/SVG/PDF → WebP/HEIC/RAW → 视频/音频 → Office/3D 顺序迁移缩略图 handler。
2. 插件 API 按 item/folder/tag/tagGroup/smartFolder 的模型契约做真实 bridge，不只注入生命周期对象。
3. 修正 Vite/Electron 打包，使 `dist`/安装包包含所需 renderer 资源且能离线启动。
4. 将 API 端口统一回兼容目标或集中配置，修正文档。
5. 建立真实 E2E、数据迁移兼容、崩溃恢复、截图像素差异与大库性能基线。

## 7. 建议的下一轮验收标准

下一轮不要再以“页面出现”“接口 200”“函数存在”为完成标准，至少要求：

- 创建一个全新的 `.library`，退出并重新打开后数据不丢失。
- 从系统文件对话框和拖拽分别导入 PNG/JPG，原文件、metadata、缩略图、尺寸和扩展名正确。
- 在原版主界面中选择条目并导出，导出文件哈希与原文件一致。
- 切换两个真实库后，列表、Inspector、viewer、搜索和导出均使用当前库。
- 采集窗口保存后，条目真实出现在当前库；不是只渲染 mock 数据。
- Electron 业务 E2E 覆盖关键 IPC，不依赖 mock `ipcRenderer.send()`。
- 生产构建/安装包在没有 `Eagle-reverse/src` 开发目录的环境中可以启动。

## 8. 本轮遗留测试产物与环境说明

本轮隔离探测在以下项目内路径留下测试产物，清理时被宿主安全删除机制拦截，本报告未继续删除：

```text
C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development\test-run\deep-probe.library
C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development\test-run\deep-probe-export
C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development\test-run\importer-test.library
C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development\test-run\importer-export
```

Electron 首轮失败是宿主环境变量 `ELECTRON_RUN_AS_NODE=1` 所致；清除该变量后四组 Electron 冒烟均通过。这个事实不改变业务 IPC 尚未闭环的判断。

## 9. 外部报告对照后的补充证据

对照 `C:\Users\Administrator\Desktop\BUILD_REPORT.md` 后，下列内容已重新回到源码核验，结论成立，补充进本报告：

### 9.1 原版导入入口与处理队列

- 新建导入菜单：`src/app/app.bundle.js:37492` 的 `$scope.openNewContextMenu()`。
- 文件夹导入：`src/app/app.bundle.js:26935` 的 `$scope.importFolders()`。
- 链接导入：`src/app/app.bundle.js:26960` 的 `$scope.importLinks()`。
- 原版后台处理链：
  - `src/app/js/background.js:6016` `addToProcessQueue()`
  - `src/app/js/background.js:6045` `copyProcessFile()`
  - `src/app/js/background.js:6105` `processImage()`
  - `src/app/js/background.js:5123` `importInboardApp()`

这些资源说明后续不应只把现有 `importer.js` 修补成文件复制函数，而应借鉴原版的任务队列、文件处理和逐项状态模型，再用自研安全服务替换其全局变量与直接文件系统依赖。

### 9.2 原版导出与 Eaglepack 的精确入口

- Renderer：
  - `app.bundle.js:26418` `exportSelectedAsFolder()`
  - `app.bundle.js:26643` `exportSelectedAsEaglepack()`
  - `app.bundle.js:26687` `exportSelectedAsFormat()`
  - `app.bundle.js:26692` `exportSelectedToCsv()`
- Background：
  - `background.js:4156` `exportFolder()`
  - `background.js:4295` `exportImages()`
  - `background.js:4436` `exportEaglePackage()`
  - `background.js:4862` `importEaglePackage()`

其中 `exportFolder()`/`exportImages()` 已包含同名冲突、子目录、权限检查、并行复制和进度事件等处理，可作为新导出服务的行为基线；但不建议直接加载完整 `background.js`。

### 9.3 主界面已经挂载、但未完成真实接线的组件

源码确认 `src/app/index.html` 已挂载：

- `quick-search-modal`（1567）
- `batch-save-panel`、`plugin-panel`、`plugin-creator`、`plugin-center`（2175-2178）
- `folder-select-panel`、`duplicate-scan-panel`、`duplicate-modal`、`context-menu`（2180-2186）
- `notification-modal`、`about-panel`、`library-panel`（2188-2201）
- `library-load-progress`、`library-merge-progress`、Eaglepack 与文件缩略图/导出进度组件（2205-2210）

因此“复用原版组件并补 IPC/API 接线”比继续扩展 `workbench.html`/`roadmap.html` 更符合 1:1 目标。

### 9.4 右键菜单状态的准确表述

`frontend/public/shims.js:611-619` 已把 Electron `Menu.popup()` 适配到原版 `ContextMenu.open()`，所以“原版右键菜单渲染通道已接通”成立；但菜单项对应的创建库、导入、导出等点击处理仍会落入 mock dialog/mock IPC，因此不能表述为“右键菜单业务已完成”。

### 9.5 对外部报告中偏乐观表述的修正

- API 实际端口是 `41695`，不是报告中的 `41595`；兼容目标与实现不一致。
- “V1/V2 大部分已实现”只能理解为路由数量较多，不能理解为语义兼容；部分路由固定返回 success、false 或空数组。
- 外部报告记录的“前 16 个测试套件通过”可能来自另一运行环境；本轮可复现结果是在 importer 测试清理阶段被安全删除机制中断，不能据此宣称当前 `npm test` 全链通过。
- collect window 虽有页面资源和 mock 初始化，但本轮截图回归明确失败，当前应标记为“不稳定/未验收”。
- Electron 窗口、菜单、缩略图和插件冒烟可通过，但原版业务 IPC 覆盖仍远少于动态记录的 211 条通道。
