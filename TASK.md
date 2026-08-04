# Eagle 1:1 复刻任务文档

eagle安装目录“C:\Program Files\Eagle”
eagle逆向目录“C:\Program Files\Eagle\Eagle-reverse”

## 目标

在以下目录创建 Eagle 的 1:1 复刻项目：

```text
C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development
```

核心目标：

1. 尽可能复用逆向得到的资源，尤其是 `Eagle-reverse/src/app/` 下的 HTML、CSS、JS、图片、字体和 viewer。
2. 优先搭建可运行的前端预览，快速看到接近原版的效果。
3. 再逐步迁移资源库、后台逻辑、API、插件、缩略图、导入导出等功能。
4. 最终形成独立于原授权逻辑、可继续开发的完整复刻工程。

本阶段只创建任务文档，不执行项目构建。

## 复刻原则

- 1:1 复刻优先：布局、交互、主题、组件、页面路径尽量对齐原版。
- 资源复用优先：能直接使用 `Eagle-reverse/src/app/` 的原始资源就不重写。
- 前端优先：第一阶段目标是浏览器打开即可看到主界面。
- 授权隔离：不复制私钥、不绕过序列号认证、不包含原版授权逻辑。
- 逐步替换：先用 shim/mock 让原资源跑起来，再替换为自研实现。

## 引用 Eagle-reverse 指引文档

### 总览

| 用途 | 文档/资源 |
| --- | --- |
| 逆向工作区总览 | [README.md](../README.md) |
| 总体架构 | [ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| 逆向执行日志 | [REVERSE_LOG.md](../docs/REVERSE_LOG.md) |
| 文件清单与 asar 信息 | [manifest/](../manifest) |

### 前端复刻

| 用途 | 文档/资源 |
| --- | --- |
| 源码与文件映射 | [SOURCE_MAP.md](../docs/SOURCE_MAP.md) |
| Bundle 源码定位 | [RENDERER_SOURCE_MAP.md](../docs/RENDERER_SOURCE_MAP.md) |
| Bundle 定位数据 | [analysis/bundle-source-map.json](../analysis/bundle-source-map.json) |
| Bundle 分类数据 | [analysis/bundle-source-categories.json](../analysis/bundle-source-categories.json) |
| 原版前端资源 | [src/app](../src/app) |
| 多语言资源 | [src/i18n](../src/i18n) |

### API 与后台

| 用途 | 文档/资源 |
| --- | --- |
| 本地 HTTP API | [API.md](../docs/API.md) |
| API 服务源码 | [api-server.js](../src/app/js/api-server.js) |
| V2 API 路由 | [api-server-v2.js](../src/app/js/api-server-v2.js) |
| API 参数定义 | [api-v2-playground-config.js](../src/app/js/api-v2-playground-config.js) |
| JSON REST 实现 | [my_modules/json-rest-light](../src/my_modules/json-rest-light) |

### 插件系统

| 用途 | 文档/资源 |
| --- | --- |
| 插件系统说明 | [PLUGIN_SYSTEM.md](../docs/PLUGIN_SYSTEM.md) |
| 插件运行时源码 | [src/app/js/plugin](../src/app/js/plugin) |
| 官方插件模板 | [../resources/plugin_templates](../resources/plugin_templates) |
| 示例 service 插件 | [plugins/example-service-plugin](../plugins/example-service-plugin) |
| 插件测试工具 | [tools/test-plugin.mjs](../tools/test-plugin.mjs) |

### 资源库与数据格式

| 用途 | 文档/资源 |
| --- | --- |
| 资源库格式 | [LIBRARY_FORMAT.md](../docs/LIBRARY_FORMAT.md) |
| 后台资源库逻辑 | [background.js](../src/app/js/background.js) |
| 示例资源库 | [library-example/Demo.library](../library-example/Demo.library) |
| 资源库校验工具 | [tools/validate-library.mjs](../tools/validate-library.mjs) |

### 主进程与重建

| 用途 | 文档/资源 |
| --- | --- |
| 主进程动态分析 | [DYNAMIC_ANALYSIS.md](../docs/DYNAMIC_ANALYSIS.md) |
| 主进程等价重建 | [MAIN_PROCESS_RECONSTRUCTION.md](../docs/MAIN_PROCESS_RECONSTRUCTION.md) |
| 主进程等价骨架 | [reconstructed/main-process-equivalent.js](../reconstructed/main-process-equivalent.js) |
| 动态 hook 报告 | [analysis/dynamic-hook-report.json](../analysis/dynamic-hook-report.json) |
| IPC 通道清单 | [analysis/dynamic-hook-ipc.txt](../analysis/dynamic-hook-ipc.txt) |
| 文件/网络追踪 | [analysis/dynamic-hook-fs.txt](../analysis/dynamic-hook-fs.txt)、[analysis/dynamic-hook-http.txt](../analysis/dynamic-hook-http.txt) |

### 构建与二次开发

| 用途 | 文档/资源 |
| --- | --- |
| 构建与二次开发 | [BUILD_RECONSTRUCTION.md](../docs/BUILD_RECONSTRUCTION.md) |
| 重建构建链 | [../build](../build) |
| repack 工具 | [tools/pack-asar.mjs](../tools/pack-asar.mjs) |
| 校验工具 | [tools/verify-packed-asar.mjs](../tools/verify-packed-asar.mjs) |

### 实操参考

| 用途 | 文档/资源 |
| --- | --- |
| 插件/资源库实操 | [PRACTICAL_TESTS.md](../docs/PRACTICAL_TESTS.md) |
| 原始 asar 归档 | [../archive](../archive) |
| 外部资源 | [../resources-external](../resources-external) |

## 推荐技术栈

第一阶段推荐用最小改造的方式启动原版前端：

- Vite：静态资源服务和开发热更新。
- 原生 HTML + 原版 AngularJS 资源：尽量不改写原 UI。
- 浏览器 shim：模拟 `require`、`electron`、`app-root-path`、`fs` 等 Node/Electron API。
- mock library：模拟 `metadata.json`、图片、缩略图、标签、文件夹数据。

后续阶段可加入：

- Node.js/Express：提供 `41595` API。
- Electron 22：提供文件系统、缩略图、原生窗口能力。
- IndexedDB/SQLite：存储资源库元数据。
- 独立插件运行时：复用 `src/app/js/plugin/` API 模型。

## 项目结构规划

```text
Eagle-Sec-development/
  TASK.md
  docs/
  frontend/
    vite.preview.config.mjs
    index.html
    src/
      shims/
        electron-shim.js
        node-shim.js
        app-root-path.js
      mocks/
        library.js
        items.js
        folders.js
        preferences.js
    public/
      assets/     # 优先 symlink 或 copy 自 Eagle-reverse/src/app/assets
      css/        # 优先复用 Eagle-reverse/src/app/css
      js/         # 优先复用 Eagle-reverse/src/app/js
      app.bundle.js
  backend/
    src/
      server.js
      library/
      api/
      thumbnail/
  electron/
    main.js
    preload.js
  tests/
```

## 阶段计划

### 阶段 0：工程初始化

- 创建 `frontend/`、`backend/`、`electron/`、`tests/` 目录。
- 初始化 npm 项目。
- 把 `Eagle-reverse/src/app/` 的静态资源接入 Vite。
- 建立资源复用清单，避免重复复制大文件。
- 创建 shim 和 mock 目录。

### 阶段 1：前端快速预览

目标：浏览器打开后能看到原版主界面。

参考文档：`../docs/RENDERER_SOURCE_MAP.md`、`../docs/SOURCE_MAP.md`、`../analysis/bundle-source-categories.json`。

工作项：

- 使用 Vite 以 `Eagle-reverse/src/app/index.html` 作为入口。
- 注入 browser shim：
  - `window.require`
  - `window.process`
  - `window.appRoot`
  - `window.electron`
  - `window.$$electronIpc`
- mock：
  - `preferences`
  - `library`
  - `folders`
  - `items`
  - `tags`
  - `smartFolders`
  - 缩略图 URL
- 启动后验证：
  - 主界面侧边栏
  - 网格/列表/瀑布流
  - 暗色/浅色主题
  - 搜索框
  - Inspector 面板
  - 设置页入口

### 阶段 2：原版页面逐个接入

- `index.html`：主界面。
- `preferences.html`：偏好设置。
- `preview-window.html`：预览窗口。
- `background.html`：后台逻辑。
- `registration.html`：替换为“设置/许可状态”页，不实现原授权。
- `manage-device.html`：设备管理。
- `progress.html`：进度窗口。
- `collect-window/index.html`：采集窗口。
- 各 viewer：
  - `exif-viewer`
  - `font-viewer`
  - `gif-viewer`
  - `model-viewer`
  - `pdf-viewer`
  - `raw-viewer`
  - `text-editor`
  - `texture-viewer`
  - `native-viewer`

### 阶段 3：资源库与数据层

参考文档：`../docs/LIBRARY_FORMAT.md`、`../src/app/js/background.js`、`../library-example/Demo.library`。

- 实现 `.library` 目录结构：
  - `metadata.json`
  - `images/<id>.info/metadata.json`
  - 原始文件和缩略图
- 实现 `metadata.json` 读写与备份。
- 实现文件夹树、标签组、智能文件夹、最近使用、回收站。
- 使用 IndexedDB/SQLite 建立索引。
- 提供 mock 数据导入和真实库导入两种模式。

### 阶段 4：API 服务

参考文档：`../docs/API.md`、`../src/app/js/api-server.js`、`../src/app/js/api-server-v2.js`。

- 复刻 V1 API：
  - `/api/library/*`
  - `/api/folder/*`
  - `/api/tag/*`
  - `/api/item/*`
  - `/api/preferences/*`
- 复刻 V2 API：
  - `/api/v2/item/*`
  - `/api/v2/folder/*`
  - `/api/v2/smartFolder/*`
  - `/api/v2/tag/*`
  - `/api/v2/tagGroup/*`
  - `/api/v2/library/*`
  - `/api/v2/app/*`
  - `/api/v2/aiSearch/*`
- 默认端口保持 `41595`，便于兼容原扩展/工具。

### 阶段 5：Electron 包装

- 使用 Electron 22。
- 实现 `main.js` 和 `preload.js`。
- 提供真实文件系统访问。
- 提供原生缩略图、拖拽、剪贴板、窗口管理。
- 将浏览器 shim 替换为 Electron IPC。
- 最终目标是可用 `npm run electron` 启动桌面版。

### 阶段 6：插件系统

参考文档：`../docs/PLUGIN_SYSTEM.md`、`../src/app/js/plugin`、`../resources/plugin_templates`。

- 复用：
  - `Eagle-reverse/src/app/js/plugin/*`
  - `resources/plugin_templates/*`
- 实现：
  - window plugin
  - service plugin
  - inspector plugin
  - preview plugin
- 实现 `.eagleplugin` 打包与安装。
- 实现 `eagle.item`、`eagle.folder`、`eagle.tag`、`eagle.tagGroup`、`eagle.smartFolder` API。

### 阶段 7：功能迁移

参考文档：`../src/app/js/background.js`、`../src/app/js/global.js`、`../src/app/js/preview-window.js`。

- 导入：
  - 本地文件
  - 文件夹
  - URL
  - Base64
  - 书签
  - Eaglepack
  - 浏览器扩展
- 导出：
  - 图片导出
  - 文件夹导出
  - CSV
  - Eaglepack
- 管理：
  - 重命名
  - 移动
  - 删除/回收站
  - 标签
  - 评分
  - 备注
  - 复制/移动路径
  - 重复文件检测
- 搜索：
  - 文件名
  - 标签
  - 颜色
  - 形状
  - 日期
  - 尺寸
  - 注释
  - URL
  - 智能文件夹
- 媒体：
  - 图片缩略图
  - RAW 解析
  - HEIC
  - GIF
  - 视频预览
  - 音频波形
  - 字体预览
  - PDF
  - 3D 模型

### 阶段 8：验证与收尾

- 建立功能对照表，逐项与原版对比。
- 编写自动化测试：
  - library 格式
  - API 响应
  - 插件加载
  - 前端页面渲染
- 编写截图回归。
- 整理复用资源清单和独立实现清单。

## 启动命令

以下命令由后续执行阶段使用，本阶段不执行。

### 前端快速预览

```powershell
cd C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development
npm init -y
npm install -D vite
npm run dev
```

预期命令：

```powershell
npm run dev
```

对应 `package.json`：

```json
{
  "scripts": {
    "dev": "vite --config frontend/vite.preview.config.mjs",
    "build": "vite build --config frontend/vite.preview.config.mjs",
    "preview": "vite preview --config frontend/vite.preview.config.mjs"
  }
}
```

`frontend/vite.preview.config.mjs` 建议：

```js
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, '../src/app'),
  base: '/',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/frontend'),
    emptyOutDir: true,
  },
});
```

### 后端 API

```powershell
cd C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development
npm install express cors
npm run backend
```

预期命令：

```powershell
npm run backend
```

默认监听：

```text
http://localhost:41595
```

### Electron 桌面版

```powershell
cd C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development
npm install -D electron@22.3.7
npm run electron
```

预期命令：

```powershell
npm run electron
```

对应 `package.json`：

```json
{
  "scripts": {
    "backend": "node backend/src/server.js",
    "electron": "electron electron/main.js",
    "dev:web": "vite --config frontend/vite.preview.config.mjs",
    "dev:electron": "concurrently \"npm:dev:web\" \"npm:electron\""
  }
}
```

## 资源复用优先级

高优先级：

- `Eagle-reverse/src/app/index.html`
- `Eagle-reverse/src/app/app.bundle.js`
- `Eagle-reverse/src/app/css/`
- `Eagle-reverse/src/app/js/`
- `Eagle-reverse/src/app/assets/`
- `Eagle-reverse/src/app/*-viewer/`
- `Eagle-reverse/src/i18n/`
- `Eagle-reverse/resources/plugin_templates/`

中优先级：

- `Eagle-reverse/src/my_modules/`
- `Eagle-reverse/src/app/js/lib/api/`
- `Eagle-reverse/src/app/js/plugin/model/`
- `Eagle-reverse/library-example/Demo.library/`

需要重写/替换：

- 主进程 `run.jsc`
- 授权、试用、注册逻辑
- 机器 ID 和许可校验
- 原版 hosts/系统时间校验
- 原版内置 API token 校验逻辑

## 注意事项

- 复刻 UI、功能和 API 交互是目标。
- 不复刻授权破解，不保存/分发原版私钥。
- 前端预览阶段 mock 数据只用于界面验证。
- 后续 Electron 阶段可以读取真实资源库，但需要自行实现安全边界。

## 资源库创建闭环（2026-08-04）

本轮按源码、真实落盘与重启恢复重新验收，状态如下：

### 完整实现并通过自动化闭环

- 新增 `backend/src/library-service.js`，统一提供 `create/open/switch/history/current`，并以 `library-state.json` 持久化 current/history。
- 新增 `POST /api/library/create`、`GET /api/library/current`、`POST /api/library/open`，V1/V2 switch/history 统一使用同一服务。
- 新库会创建 `metadata.json`、`tags.json`、`saved-filters.json`、`folders.json`、`cache.json`、`search-index.json` 与 `images/`。
- Electron preload/main 已提供目录选择、保存对话框以及 `library:create/open/switch/current/history` 受控桥接。
- 原版 `library-panel` 与 `app.bundle.js` 的 `create-library`、`open-library`、`add-to-history-and-open` 已由 `frontend/public/shims.js` 转发到真实桥接；Electron 下文件存在性检查和 cache 读取使用真实 Node 文件系统，浏览器预览仍保留 mock。
- 新增独立临时目录测试：
  - `tests/library-create-service.mjs`：验证结构落盘及服务重建恢复。
  - `tests/library-create-api.mjs`：验证独立后端进程创建、退出、重启后恢复 current/history。
  - `tests/electron-library-bridge.mjs`：清除 `ELECTRON_RUN_AS_NODE`，以独立 Vite/API 进程启动原版 renderer，并在 Electron 页面内真实执行当前库读取 → PNG 导入 → 图片导出 → 导出文件存在验证。

### 本轮验证结果

- 新增/修改 JS 语法检查：通过。
- 资源库服务创建与重启恢复：通过。
- API 创建与后端进程重启恢复：通过。
- Electron 资源库桥接：通过。
- API 冒烟：13/13 通过。
- Workbench 交互回归：通过。
- Electron desktop 冒烟：通过。
- `npm run build`：通过；但构建仍只转换 2 个模块，`dist/frontend` 仍未包含原版 `src/app`，独立发布问题未解决。

### 图片导入闭环更新（2026-08-04）

- `addFromPaths` 同时兼容 `{ paths: [...] }` 与 `{ images: [{ path }] }`，源文件不存在/不是文件时返回 400，不再生成无原文件条目。
- `importer.js` 按文件魔数、originalname、MIME 和路径扩展名识别 PNG/JPG/GIF/WebP；PNG/JPG 会写入正确 width/height/mime/size。
- multer 上传会正确拆分 name/ext，`Uploaded Probe.png` 持久化为 name=`Uploaded Probe`、ext=`png`，不再出现 `.png.bin`。
- Electron/preload/shim 已接通原版 `upload-local-files`、`upload-url(s)`、`import-folders` 业务通道；成功项通过原版 `file-uploaded` 事件进入 renderer 列表。
- URL 导入会真实下载远程文件，并限制 100 MB；Base64 导入改用唯一系统临时目录，避免固定临时文件并发冲突。
- `tests/image-import-closed-loop.mjs` 使用唯一系统临时目录创建真实 PNG/JPG，验证原文件、metadata、缩略图、尺寸、扩展名、MIME、缺失源错误、multer 上传和后端重启恢复，测试通过。

### 部分实现 / 未实现

- 已接通资源库创建/打开业务事件，但尚未新增系统文件对话框点击级 UI 自动化；当前以真实 bridge、API 和文件闭环测试验收。
- 原版文件夹导入入口会继续复用其现有目录树/标签 UI，但后端导入尚未完整复刻原版文件夹树映射、逐项进度和取消语义，标记为部分实现。
### 图片导出闭环更新（2026-08-04）

- 新增 `backend/src/export-service.js`，统一多选图片与目录树导出；同名/已存在文件自动追加序号，不覆盖目标文件。
- 复制使用排他模式并保留源文件时间戳；源文件缺失或条目不存在时明确失败。
- Electron/preload/shim 已接通原版 `export-images`、`export-as-folder`、`show-export-task`、`finish-export-task`、`close-export-task` 和 `cancel.all`，可驱动原版 `file-export-progress`。
- Electron 主进程直接执行异步导出服务，逐文件发送进度；取消标记在文件间检查，可停止后续复制并报告取消状态，完成后由原版进度组件定位目标目录。
- `tests/image-export-closed-loop.mjs` 使用唯一系统临时目录验证多选、同名冲突、目录树、时间戳、取消和 SHA-256 一致，测试通过。

### 仍未实现 / 未验收

- Eaglepack 仍是现有自定义格式，不属于本轮“图片导出闭环”完成范围。
- collect 截图回归和独立发布构建仍未完成；构建虽然成功，仍只转换 2 个模块且未包含 `src/app`。

## 执行状态（2026-08-03）

当前已完成：

- Phase 0 工程初始化：`frontend/`、`backend/`、`electron/`、`tests/`、`package.json`、Vite 配置。
- Phase 1 前端快速预览：原版 `src/app/index.html`、`app.bundle.js`、CSS、JS、assets 直接复用。
- 浏览器 shim：`frontend/public/shims.js` 提供 `require`、`process`、`electron`、`ipcRenderer`、Node mock。
- mock 资源库：`frontend/public/mock-data.js` + `mock-library/`，缩略图复用原版 PNG 素材。
- 已启动地址：`http://localhost:5176/src/app/index.html`
- Phase 2 部分页面：偏好设置、预览窗口、进度窗口可渲染；注册/设备管理使用安全替代页。
- Phase 3/4 初步：生成 `cache.json`，41595 API 服务已提供 library/folder/tag/item 和部分 v2 接口。
- 页面入口：`http://localhost:5176/pages.html`

已验证：

- AngularJS 主界面成功初始化。
- 侧栏、文件夹、智能文件夹、标签组、Inspector、中文文案、16 个网格缩略图正常渲染。
- 偏好设置页 13 个设置分区正常渲染。
- 预览窗口显示资源名、尺寸、缩放和原版工具栏结构。
- 进度窗口显示下载进度。
- 41595 API `/api/item/list` 返回 17 个 mock 条目。
- 原版 HTML 模板因 Vite parse5 严格解析问题，由 Vite middleware 直接返回原始文件并注入 shim，不改动 `Eagle-reverse/src/app` 原文件。

待迁移：

- Phase 2：继续修复采集窗口模板/API 兼容，接入 viewer 页面。
- Phase 3：真实 `.library` 数据层、IndexedDB/SQLite 索引。
- Phase 4：完整 V1/V2 API 与扩展/缩略图服务。
- Phase 5：Electron 文件系统、原生能力、桌面壳。
- Phase 6：插件系统。
- Phase 7：导入导出、搜索、媒体能力。
- Phase 8：自动化测试和截图回归。

## Viewer 接入更新（2026-08-03）

已完成 Phase 2 viewer 接入和浏览器验证：

- EXIF Viewer：加载 mock 图片，原版 exif-player 无控制台错误。
- Font Viewer：复用原版 Liberation Sans 字体，Angular 页面完整渲染。
- GIF Viewer：加载 mock GIF，页面无脚本错误。
- RAW Viewer：加载原图缩略图，dcraw 分支在浏览器中安全降级。
- Text Editor：通过 mock 父 scope 加载本地文本并进入可编辑状态。
- Texture Viewer：sample.hdr 通过原版 RGBELoader 渲染到 WebGL canvas。
- Native Viewer：原版页面进入 ready 状态，无控制台错误。
- PDF Viewer：原版 PDF.js viewer 渲染 sample.pdf，页码和内容正常。
- Model Viewer：website/embed 页面可导入 GLB/OBJ，无控制台错误；无头浏览器中 WebGL canvas 像素验证为空，渲染部分留待 Electron/真实窗口继续确认。

新增兼容与素材：

- `frontend/public/shims.js`：增加二进制 fs 读取、viewer 父 scope mock、model frameElement mock。
- `frontend/vite.preview.config.mjs`：PDF.js 资源绕过 Vite transform，保持 UMD 经典脚本加载。
- `frontend/public/mock-assets/`：sample.gif、sample.hdr、sample.pdf、cube.obj、box.glb。
- `frontend/public/mock-library/.../MOCK-FONT.info/`：复用原版 LiberationSans-Regular.ttf。
- `frontend/public/mock-library/.../MOCK0001.info/Sample Notes.txt`：文本编辑器示例。

当前服务：

```text
http://localhost:5176/pages.html
http://localhost:5176/src/app/collect-window/index.html
http://localhost:41595/
```

## 数据层与 API 更新（2026-08-03）

已完成：

- `mock-library` 所有 17 个图片条目新增 `images/<id>.info/metadata.json`。
- `MOCK-FONT.info/metadata.json` 已补全，字体 viewer 素材保持原版资源。
- 41592 缩略图静态服务已启动，支持 `?filePath=` 查询 mock 库与原版 `src` 资源。
- 41593 浏览器扩展服务已启动，支持 `GET /` 和 `POST /` 采集保存响应。
- 41595 API 扩充 V1/V2 主要路由：
  - V1：application、library switch/icon、folder create/rename/update/unlock、item add/update/trash/thumbnail、script inject、深链跳转。
  - V2：app、library、item get/query/count/add/update/comments、folder、smartFolder、tag、tagGroup、aiSearch。

当前端口：

```text
41592 缩略图静态服务
41593 浏览器扩展服务
41595 JSON API 服务
```

## Electron 与插件更新（2026-08-03）

已完成：

- 安装 `electron@22.3.7`。
- `electron/main.cjs` 增加窗口创建、采集数据 IPC、viewer 窗口 IPC、文件选择 IPC。
- `electron/preload.cjs` 暴露 `eagleDesktop` 桌面桥接。
- `frontend/public/shims.js` 在 Electron 运行时优先使用原生 `electron`，浏览器预览继续使用 mock shim。
- `backend/src/plugin-runtime.js` 支持 service/window 插件生命周期：create/run/show/hide/beforeExit。
- `tests/plugin-smoke.mjs` 验证 `Eagle-reverse/plugins/example-service-plugin`。

测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:screenshots
```

## 设置入口与设置页接入（2026-08-03）

已完成：

- workbench 左上角改为三条横杠汉堡菜单。
- 汉堡菜单包含“设置”“浏览器扩展”“刷新”。
- “设置”打开原版 `/src/app/preferences.html`。
- `pages.html` 原已提供偏好设置入口，保留原版设置页。
- 截图回归新增 preferences 页面，当前共 17 张截图。
- 交互测试新增汉堡菜单打开验证。

当前测试命令：

```powershell
npm run test:workbench
npm run test:screenshots
```

## 原版资源复用执行文档

新增详细执行文档：

```text
docs/REUSE_ROADMAP.md
```

该文档列出所有可直接复用的原版页面、directive、controller、插件系统、Node 模块和外部资源，并给出后续大任务的执行顺序与验收标准。

## 原版 UI 结构与 workbench 交互调整（2026-08-03）

已完成：

- 分析反编译资料确认 Electron 主界面直接复用原版 `index.html`、`app.bundle.js`、CSS 和 assets。
- Electron 主界面截图验证侧栏、网格、Inspector、主题等原版结构正常渲染。
- workbench 调整为原版三段式结构：左侧管理侧栏、中间条目网格、右侧 Inspector。
- workbench 新增条目选择交互，Inspector 展示名称、类型、尺寸、大小、星级、标签、URL。
- Inspector 支持 Preview、Trash、Copy URL 操作。
- workbench 交互测试新增 Inspector 选中渲染验证。

当前测试命令：

```powershell
npm run test:workbench
npm run test:screenshots
```

## 前端 1:1 交互细节大任务（2026-08-03）

已完成：

- workbench 新增明暗主题切换，主题状态持久化到 localStorage。
- workbench 新增网格/列表视图切换，复用原版 `ic-layout-grid.svg` 与 `ic-layout-list.svg`。
- workbench 新增拖拽文件导入。
- workbench 新增快捷键：
  - `Ctrl/Cmd+K` 聚焦搜索
  - `Ctrl/Cmd+Enter` 上传
  - `Escape` 清空状态
- 新增 `tests/workbench-interactions.mjs`，验证主题切换、列表切换和快捷键。

当前测试命令：

```powershell
npm run test:workbench
npm run test:full
```

## 安全与健壮性收尾大任务（2026-08-03）

已完成：

- 新增 `backend/src/security.js`：
  - `isLocalRequest` 本地请求识别
  - `getRequestToken` token 读取
  - `safeResolve` 路径穿越防护
- 41595 API 增加鉴权中间件，允许 localhost 或 `token` 参数访问。
- 41595 API 增加统一 JSON 错误处理器。
- Electron `fs:list`、`fs:read`、`library:resolve`、`thumbnail:native` 增加路径白名单校验。
- 新增 `tests/security.mjs`，覆盖合法路径、路径穿越和本地请求识别。

当前测试命令：

```powershell
npm test
npm run test:full
```

## 真实原版 .library 深度兼容与迁移大任务（2026-08-03）

已完成：

- 新增 `backend/src/library-migration.js`：
  - 扫描任意 `.library`，检查 metadata/cache/tags/条目 metadata/原文件/缩略图
  - 迁移到目标目录，自动生成 cache、search-index、tags、saved-filters 和 folders
- 新增 API：
  - `GET /api/library/scan?path=...`
  - `POST /api/library/migrate`
  - `GET /api/library/validate?path=...`
- workbench 新增 Library Migration 面板，支持扫描和迁移。
- 新增 `tests/library-migration.mjs`，覆盖 mock 库、原版 Demo 库扫描和迁移。

当前测试命令：

```powershell
npm test
npm run test:full
```

## 路线图 A-F 执行面板大任务（2026-08-04）

已完成：

- 新增 `frontend/public/roadmap.html` 路线图执行面板，入口已加入 `pages.html` 与 workbench 汉堡菜单。
- 批量管理：`/api/item/batchRename`、`/api/item/batchUpdate`、`/api/item/addToFolder`、文件夹密码、标签重命名/合并。
- 重复扫描：`/api/item/duplicates/scan` 与 V2 等价接口，支持 exact/similar 扫描。
- Inspector：`roadmap.html` 可直接编辑名称、备注、URL、标签、文件夹、评分、comments 并持久化。
- 筛选搜索：快捷搜索与颜色/尺寸/日期/评分/标签/类型/注释/URL 筛选，使用现有 search API。
- Eaglepack：`/api/export/eaglepack/start`、`/api/import/eaglepack/start`、`/api/jobs/:id` 提供任务进度。
- 插件中心：`/api/plugins/center` 汇总已安装插件与模板，`roadmap.html` 支持详情、打开、安装、卸载、打包。
- 新增 `tests/roadmap-panels.mjs`，截图回归新增 `roadmap.png`。

当前测试命令：

```powershell
npm test
npm run test:workbench
npm run test:screenshots
```

## 自动化验证与发布收尾大任务（2026-08-03）

已完成：

- 新增 `scripts/health-check.mjs`，检查 Vite、workbench、41595、41592、41593 服务健康。
- 新增一键启动：`npm run dev:all`，同时启动 Vite 和 backend。
- 新增全量测试：`npm run test:full`，串联 API/library/plugin/importer/media/extension/Electron/screenshots。
- 修正 `npm run build`，生产构建使用 `pages.html` 作为入口并复制 public 静态资源。
- 新增 `npm run health` 健康检查命令。

当前测试命令：

```powershell
npm run dev:all
npm run health
npm run test:full
npm run build
```

## 导入导出与数据迁移完整化大任务（2026-08-03）

已完成：

- importer 新增：
  - 文件夹递归导入 `importFolder`
  - Base64 Data URI 导入 `importBase64`
  - 书签导入 `importBookmark`
  - 资源库目录导出 `exportLibrary`
- 新增 API：
  - `POST /api/item/importFolder`
  - `POST /api/item/importBase64`
  - `POST /api/item/importBookmark`
  - `POST /api/export/library`
  - `POST /api/library/backup`
  - `POST /api/library/restore`
- workbench 新增文件夹导入、Base64 导入、备份、恢复入口。
- 新增 `tests/import-export-migration.mjs`，覆盖文件夹/Base64/书签导入、库导出、备份和恢复。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:electron-desktop
npm run test:screenshots
```

## 插件系统完整化大任务（2026-08-03）

已完成：

- 新增 `backend/src/plugin-package.js`，支持 `.eagleplugin` 打包、安装、卸载和已安装列表。
- 插件 API 新增：
  - `GET /api/plugins/installed`
  - `POST /api/plugins/pack`
  - `POST /api/plugins/install`
  - `POST /api/plugins/uninstall`
  - `POST /api/plugins/enable`
  - `POST /api/plugins/disable`
- 已安装插件会合并到 `/api/plugins` 列表，并通过 `/plugins/*` 静态服务提供页面。
- workbench 插件管理支持安装路径、卸载和禁用。
- 新增 `tests/plugin-package.mjs`，覆盖打包、安装、列表、启停和卸载。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:electron-desktop
npm run test:screenshots
```

## Electron 桌面壳完整化大任务（2026-08-03）

已完成：

- 主进程新增文件系统 IPC：`fs:list`、`fs:read`、`library:resolve`。
- 新增原生缩略图 IPC：`thumbnail:native`，使用 `nativeImage` 生成 PNG dataURL。
- 新增剪贴板 IPC：`clipboard:readImage`。
- 新增拖拽/路径导入 IPC：`item:importPaths`，调用 41595 导入接口。
- 新增应用菜单、托盘、窗口状态持久化。
- preload 暴露 `eagleDesktop` 桌面桥接。
- 新增 `npm run test:electron-desktop`，验证原生缩略图、目录读取、剪贴板和应用菜单。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:electron-desktop
npm run test:screenshots
```

## 浏览器扩展采集闭环大任务（2026-08-03）

已完成：

- 新增 `frontend/public/browser-extension/` Manifest V3 扩展脚手架：
  - `manifest.json`
  - `background.js` service worker
  - `content.js` 页面图片采集
  - `popup.html` / `popup.js` 采集入口
  - `icons/icon128.png`
- 41593 扩展服务新增：
  - `GET /api/extension/status`
  - `POST /api/extension/collect`
- `pages.html` 新增“浏览器扩展”入口。
- 新增 `tests/browser-extension.mjs`，验证 manifest、静态文件、status/collect 接口和 popup。
- 截图回归新增 extension 页面，当前共 16 张截图。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:screenshots
```

## 媒体格式与播放大任务（2026-08-03）

已完成：

- thumbnailer 使用 `sharp` 为 WebP/HEIC/HEIF/AVIF/TIFF/RAW 尝试生成真实 PNG 缩略图。
- PNG/JPG 仍走同步 pngjs/jpeg-js 管线。
- 新增 `frontend/public/media-viewer/video.html` 视频预览页。
- 新增 `frontend/public/media-viewer/audio.html` 音频波形页，使用 Web Audio 绘制 canvas 波形。
- 生成 `sample.wav` 与 `sample.webp` mock 素材。
- workbench 视频/音频条目会链接到对应 media viewer。
- 截图回归新增 video/audio 页面，当前共 15 张截图。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:screenshots
```

## 媒体识别与智能文件夹 UI 大任务（2026-08-03）

已完成：

- 新增 `backend/src/media-info.js`，按扩展名识别 image/video/audio/font/model/text/document/archive。
- 新增 `GET /api/item/mediaInfo`，返回条目媒体类型、尺寸、文件大小和 viewer 类型。
- workbench 智能文件夹支持多条件 JSON 编辑、已有智能文件夹列表和快速使用。
- workbench 条目卡片显示媒体类型徽标。
- `tests/search-media.mjs` 新增媒体类型识别和多条件智能文件夹验证。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:screenshots
```

## 搜索与媒体能力完整化大任务（2026-08-03）

已完成：

- 搜索过滤新增：颜色、minWidth/minHeight、maxWidth/maxHeight、dateFrom/dateTo、comments、hasComment。
- `/api/item/search` 与 `/api/v2/item/query` 支持 `sortBy` 与 `sortIncrease` 排序。
- thumbnailer 新增 JPEG/JPG 缩略图缩放，统一输出最大边 320px PNG。
- workbench 搜索面板新增颜色、尺寸、日期、排序条件。
- workbench 条目卡片新增 Preview 入口。
- 新增 `tests/search-media.mjs`，覆盖颜色/尺寸/排序搜索和 JPEG 缩略图。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:screenshots
```

## 资源库统计与一致性管理大任务（2026-08-03）

已完成的大任务：资源库统计与一致性管理。

- 新增 `backend/src/library-stats.js`，支持统计条目、文件夹、标签、智能文件夹、重复组、缺失文件/缩略图、近期新增等。
- 新增 `GET /api/library/stats`、`GET /api/v2/library/stats`。
- 新增 `GET /api/folder/stats` 文件夹统计。
- 新增 `POST /api/library/repair`，可补齐缺失 metadata 与缩略图，并报告缺失原文件。
- workbench 工作台新增 Library Stats 面板，支持刷新统计与一键修复。
- 新增 `tests/library-stats.mjs`，覆盖统计、修复缩略图和文件夹统计。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:screenshots
```

## 资源库管理工作台大任务（2026-08-03）

已完成的大任务：资源库管理工作台。

- 后端新增 multer 文件上传：`POST /api/item/upload`、`POST /api/v2/item/upload`。
- 新增 `frontend/public/workbench.html` 工作台页面，包含：
  - 资源库信息与 Demo 库切换
  - 条目网格、关键字/标签/星级搜索
  - 文件上传导入
  - CSV/Eaglepack 导出
  - 智能文件夹创建与查询
  - 重复条目检测与合并
  - 插件列表与打开
- `pages.html` 已加入“资源库管理工作台”入口。
- 新增 `tests/workbench-upload.mjs`，验证上传导入与列表读取。
- 截图回归新增 workbench 页面，当前共 13 张截图。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:screenshots
```

## 缩略图缩放、Eaglepack 合并与插件窗口端到端更新（2026-08-03）

已完成：

- thumbnailer 使用 `pngjs` 对 PNG 做同步缩放，生成最大边 320px 的真实缩略图。
- Eaglepack 导入支持 `replace` 与 `merge` 两种模式，merge 会保留已有条目并合并 metadata/tags。
- 新增 `npm run test:electron-plugin`，Electron 隐藏窗口打开示例插件页面并确认 `window.eagle` 可用。
- 测试新增缩略图尺寸校验和 Eaglepack merge 校验。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:electron-plugin
npm run test:screenshots
```

## 智能文件夹、扩展采集、插件窗口与重复合并更新（2026-08-03）

已完成：

- 新增 `backend/src/smart-folders.js`，支持字段规则匹配，`v2/smartFolder/getItems` 按条件返回条目。
- 41593 扩展服务新增 `/api/item/addFile`、`/api/item/addURL`、`/api/item/import-images`、`/api/collect` 等采集保存路由。
- 新增 `/api/plugins/open`，返回可打开的插件页面 URL；插件 HTML 自动注入 `/plugin-shim.js`。
- Electron `plugin:open` 可打开插件窗口。
- 新增 `/api/item/mergeDuplicates` 与 `/api/v2/item/mergeDuplicates`，合并重复条目的 tags/folders/comments。
- 截图回归新增 plugin 页面，当前共 12 张截图。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:screenshots
```

## 搜索索引、V2 管理接口与插件窗口更新（2026-08-03）

已完成：

- `.library` 新增持久化 `search-index.json`，item 保存时自动重建。
- 新增 `GET /api/search/index`、`GET /api/v2/search/index`、`POST /api/v2/search/rebuild`。
- 补齐 V2 管理接口：folder all/remove、tag all/remove。
- 新增 `GET /api/plugins/:id` 插件详情接口。
- Electron 新增 `plugin:open` IPC，preload 暴露 `openPlugin`，可打开插件窗口。
- 新增 `tests/search-index-v2.mjs`，覆盖搜索索引、V2 remove、插件详情。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:screenshots
```

## Eaglepack、重复检测与插件资源更新（2026-08-03）

已完成：

- 新增 `backend/src/eaglepack.js`，支持导出/导入 `.eaglepack`，包含 manifest、library metadata、cache 和 images。
- 新增 `POST /api/export/eaglepack` 与 `POST /api/import/eaglepack`。
- 新增 `backend/src/duplicates.js`，按 size + sha1 检测重复条目。
- 新增 `GET /api/item/duplicates`。
- 新增 `GET /api/plugins`，列出示例 service plugin 和原版 plugin templates。
- 后端提供 `/plugins/eagle-reverse-example-service/*` 与 `/plugin-templates/*` 静态资源服务。
- 新增 `tests/eaglepack-duplicates.mjs`，覆盖打包、导入、重复检测和插件列表。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:screenshots
```

## 缩略图、CSV 导出与评论持久化更新（2026-08-03）

已完成：

- 新增 `backend/src/thumbnailer.js`，支持生成/刷新条目缩略图；图片缩略图统一为 `_thumbnail.png`。
- `/api/item/refreshThumbnail`、`/api/v2/item/refreshThumbnail`、`/api/item/thumbnail` 已接入缩略图生成。
- 新增 `backend/src/csv-export.js`，支持 `/api/export/csv` 的 GET 下载和 POST 落盘。
- V2 item comments 已持久化到条目 metadata，支持 get/add/update/remove。
- 新增 `tests/csv-comments-thumbnail.mjs`，覆盖缩略图刷新、CSV 导出、评论 CRUD。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:screenshots
```

## 导入导出、搜索与 Electron 插件启动更新（2026-08-03）

已完成：

- 新增 `backend/src/importer.js`，支持把本地文件导入 `.library`，自动生成 `images/<id>.info/<name>.<ext>`、缩略图副本和条目 metadata。
- `/api/item/addFromPath`、`addFromPaths`、`addFromURL`、`batchSave` 等接口已接入 importer。
- 新增 `POST /api/item/export`，支持把条目原文件复制到指定目录。
- 新增 `/api/item/search` 与 V2 `/api/v2/item/query` 过滤，支持 keyword/name/tags/folders/star/ext/isDeleted。
- Electron 主进程启动时加载 `Eagle-reverse/plugins/example-service-plugin`，`npm run test:electron-main` 已验证。
- 新增 `tests/importer-search.mjs`，覆盖导入、缩略图、导出和搜索过滤。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:electron-main
npm run test:screenshots
```

当前覆盖：

- API 冒烟测试：13 项。
- `.library` 资源库校验：17 个条目。
- service plugin 生命周期冒烟测试。
- Electron 隐藏窗口启动冒烟测试。

## 数据层与截图回归更新（2026-08-03）

已完成：

- 新增 `backend/src/library-store.js`，统一读取/写入 `.library` 的 `metadata.json`、`tags.json`、`saved-filters.json`、`folders.json`、`cache.json` 和 `images/<id>.info/metadata.json`。
- `/api/library/switch` 与 `/api/v2/library/switch` 已支持切换到真实 `.library` 路径，并自动重载 folders/items/tags。
- V1/V2 folder、item、smartFolder、tagGroup 的创建/更新/删除已通过 library-store 持久化。
- 新增 `tests/screenshot-regression.mjs`，使用 CDP 截取主界面、采集窗口和 9 个 viewer，共 11 张截图。
- 截图已生成到 `screenshots/`。

当前测试命令：

```powershell
npm test
npm run test:electron
npm run test:screenshots
```
