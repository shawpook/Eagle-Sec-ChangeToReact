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
- 文件夹导入已升级为完整核心闭环：后端按原版行为建立同构 Eagle 文件夹树，每个文件绑定直接所属文件夹；嵌套 `.library` 和符号链接会跳过并报告，深度/文件数有上限。
- 新增 `/api/item/importFolder/start`、`/api/item/importPaths/start`、`/api/jobs/:id/cancel` 和 `/api/jobs/cancel-active`，支持逐项进度、部分错误隔离和文件间取消。
- Electron/preload/shim 已接通文件/文件夹导入进度、`cancel.all` 和原版 `file-uploaded`；shim 的真实目录判断及 `folders-change` 持久化已补齐。
- `tests/folder-import-closed-loop.mjs` 使用唯一临时目录验证嵌套树、直接文件夹绑定、`.library` 跳过、未知文件无错误占位缩略图、逐项进度、部分取消及重启恢复，测试通过。
### 图片导出闭环更新（2026-08-04）

- 新增 `backend/src/export-service.js`，统一多选图片与目录树导出；同名/已存在文件自动追加序号，不覆盖目标文件。
- 复制使用排他模式并保留源文件时间戳；源文件缺失或条目不存在时明确失败。
- Electron/preload/shim 已接通原版 `export-images`、`export-as-folder`、`show-export-task`、`finish-export-task`、`close-export-task` 和 `cancel.all`，可驱动原版 `file-export-progress`。
- Electron 主进程直接执行异步导出服务，逐文件发送进度；取消标记在文件间检查，可停止后续复制并报告取消状态，完成后由原版进度组件定位目标目录。
- `tests/image-export-closed-loop.mjs` 使用唯一系统临时目录验证多选、同名冲突、目录树、时间戳、取消和 SHA-256 一致，测试通过。

### Collect 保存闭环更新（2026-08-04）

- `41593` 扩展服务的 `/api/item/addFile`、`/api/item/addURL`、`/api/item/import-images`、`/api/collect` 等路由不再返回占位 ID；图片 Data URI 会导入当前真实库，书签会生成真实 `.url` 文件。
- 采集字段 `title/name`、`annotation`、`url`、`tags[n]`、`folderIDs[n]`、`star` 会写入条目 metadata；图片原文件、缩略图与 metadata 均真实落盘。
- `frontend/public/shims.js` 已把原版 collect 使用的旧端口 `41595/41593` 映射到当前 `41695/41693`，不修改 `Eagle-reverse/src/app` 原文件。
- `tests/collect-save-closed-loop.mjs` 使用唯一系统临时库与独立端口，验证图片和书签保存、文件内容、标签/文件夹/评分，以及后端重启恢复，测试通过。
- `tests/smart-extension-plugin.mjs` 已改为隔离后端和唯一临时库，三个扩展别名路由均验证真实 PNG 落盘，不再删除或污染 `test-run`。
- 截图回归已复验 18/18 通过，其中 collect-window 的文件夹选择面板稳定渲染；主界面断言已从固定条目标题改为验证原版主框架、侧栏和图片节点。

### Eaglepack 原版格式兼容更新（2026-08-04）

- `backend/src/eaglepack.js` 已按原版 `background.js` 契约导出：压缩包顶层使用 `pack.json`，条目目录为 `<原条目ID>.info/`，不再以 `manifest.json + images/` 作为新导出格式。
- `pack.json` 保存完整条目 metadata；导出文件夹时同时保存 folder 子树与条目文件夹绑定，多选条目导出会像原版一样清空 folders。
- 导入原版包时会为条目和文件夹生成新 ID，重写 coverId、folders、order 与每个 `<新ID>.info/metadata.json`，防止与当前库 ID 冲突。
- 合并导入按原文件 SHA-1 跳过重复内容；缺失 `pack.json`、条目目录或原文件的损坏包会明确拒绝；ZIP 路径会做穿越校验。
- 仍兼容导入旧自产 `manifest.json + images/` 包，避免已有测试/备份无法恢复。
- `tests/eaglepack-duplicates.mjs` 已改用唯一系统临时目录，验证原版目录结构、pack.json、文件/文件夹 ID 重映射、SHA-256 一致、重复合并、损坏包拒绝和旧格式向后导入，测试通过。

### 真实资源显示修复（2026-08-04）

- 修复原版 `FileUrlHelper` 经兼容层调用 `pathToFileURL()` 时，把 Windows 绝对路径误解析为网页 URL 导致网格和 Inspector 破图的问题。
- Electron preload 现在只暴露受控 `thumbnailUrl()`，将本地绝对路径映射到缩略图服务 `/file/<encoded-path>`；浏览器 mock 相对路径仍走 5176，不受影响。
- 41692 服务只允许读取当前资源库、项目 public 和反编译 `src` 受控根目录下的文件，拒绝任意绝对路径读取。
- 使用 path 路由而不是查询参数，兼容原版追加 `?v=modificationTime` 的缓存刷新逻辑。
- `tests/electron-library-bridge.mjs` 已扩展为真实创建 `<img>`，分别加载导入后的缩略图和原文件，并断言 `naturalWidth/naturalHeight > 0`；两者均通过。

### 原版主界面真实工作流闭环更新（2026-08-04）

- 不修改反编译原版 `src/app/index.html`、`app.bundle.js`、`js/directives/inspector.*` 和 `preview-window.html`；通过 `frontend/public/shims.js`、`electron/preload.cjs`、`electron/main.cjs` 接回受控后端。
- 原版主界面已真实加载当前 `.library`，并从原版 `onDropContainer()` 完成文件拖放、文件夹递归拖放；Windows 剪贴板图片和剪贴板文件路径分别经原版 `read-win-files`、`paste-paths` 导入，网格即时收到 `file-uploaded` 且不产生重复 ID。
- 新增 `backend/src/item-workflow-service.js`，以字段白名单处理原版 `images-change` 完整对象；名称修改会事务式同步重命名原文件和缩略图，冲突、非法 Windows 文件名、源文件缺失和持久化失败均返回明确错误并回滚。
- 原版 Inspector 单选已验证名称、URL、备注、标签、文件夹和评分；多选已验证批量备注、标签与评分。renderer 端按原版事件顺序冻结快照并串行提交，避免并发完整对象更新相互覆盖。
- 原版 `TagManager.save()` 已通过受控结构接口持久化 `historyTags/starredTags` 到 `tags.json`，保持 5 秒防抖语义；后端限制历史标签最多 120 个并规范化字符串。
- 原版 `removeSelected()` 已验证移入回收站，`images-change` 已验证恢复；原版 `enterDetailMode()` 已验证详情模式，`open-preview-window` 已打开真实 `preview-window.html`。预览 IPC 只传可结构化克隆的条目数据，插件模块由主进程受控构造。
- 新增 `tests/item-workflow-closed-loop.mjs` 与 `tests/main-ui-workflow-closed-loop.mjs`，均使用 `os.tmpdir()` 唯一资源库和随机端口。后者真实启动后端、Vite、Electron，覆盖 5 条导入、原版选择与 Inspector、磁盘重命名、回收站/恢复、详情/预览、`metadata.json`、`cache.json`、`search-index.json`、`tags.json` 及后端重启恢复。
- 验收结果：`ITEM_WORKFLOW_CLOSED_LOOP_OK`、`MAIN_WORKFLOW_SMOKE_OK`、`MAIN_UI_RESTART_OK`；Electron 资源库桥、导入搜索和统一缩略图任务相邻回归通过。
- 新增 `tests/full-regression-isolated.mjs` 与 `npm run test:isolated`：每次运行均使用随机安全端口、唯一 library state、唯一后端/Electron user-data，并独立启动后端、Vite 和隐藏 Electron 调试宿主，不依赖或关闭共享 5176/9226 开发进程。
- Roadmap 页面 API 基址支持受限的本机查询参数注入，默认仍兼容 41695；页面测试改为连接隔离 API、复用 Electron 页面目标并按真实 DOM 状态等待。旧测试中的固定 `test-run`、过期 320px 缩略图合同、Fetch 禁用端口及异常后未恢复资源库等问题已同步修复。
- 完全隔离的非 Electron 全量套件最终通过：API 13/13、资源库/导入导出/搜索/缩略图/视频/插件/安全/Roadmap 等全部成功，输出 `FULL_REGRESSION_ISOLATED_OK`。
- 提交后自审已修复条目 API 兼容边界：`batchUpdate` 的 patch 不能覆盖目标 ID；V1 回收站/恢复接受原版 `itemIds` 并保持布尔返回；V2 `item/update` 使用独立字段合同，支持 `ext/width/height/noThumbnail/noPreview`，扩展名仅在插件已准备好目标格式文件时更新 metadata，缺失或冲突均拒绝；V1 主界面白名单保持不变。
- 导入最终成功事件已去重，主界面 E2E 断言每次 `upload-local-files` 只发一次 `import:operation-result`；新增 `tests/item-api-compatibility.mjs` 覆盖 ID 隔离、V1/V2 合同、类型不匹配、扩展名缺失/冲突、真实文件与重启恢复。隔离回归和主界面 E2E 改用当前 Node 运行时并动态解析 npm CLI，不再绑定本机用户名和固定版本路径。

### 搜索与筛选合同更新（2026-08-05）

- 新增 `backend/src/search-service.js`，把原先堆在 `server.js` 里的 `filterItems()` 拆为可独立测试的搜索服务，并补充原版 `filterRules` 形状映射：type/tag/folder、评分、颜色、分辨率、文件大小、duration/bpm、注释/备注/URL、import/mtime 和 shape。
- `/api/item/search`、`/api/export/csv` 与 `/api/v2/item/query` 已统一使用该搜索服务；V2 仍返回 `{ data, total, offset, limit }`，V1 保持数组返回。
- `/api/library/structure` 已接受 `savedFilters`，与 `library-store.saveLibraryState()` 的 `saved-filters.json` 写入闭环。
- `frontend/public/shims.js` 不再固定把 `saved-filters.json` 返回为 `[]`：浏览器 fallback 优先读取当前库的 `savedFilters`，Electron 写入会经 `library.updateStructure` 持久化。
- 原版快捷搜索依赖的 `pinyinlite`、`tiny-pinyin`、`chinese_convert`、`cartesian-product` 改为加载 `Eagle-reverse/src/my_modules` 真实实现；简繁转换和拼音组合不再使用恒等/空结果 stub。
- 本轮未完成：原版 filter directive 的完整事件/状态机逐项 E2E、V1/V2 合同专项测试。

### 文件夹、标签与智能文件夹组织更新（2026-08-05）

- `library-store.js` 新增文件夹删除的子树收集与条目引用清理：删除文件夹及其子文件夹时，只从条目 `folders` 移除引用，不误删原文件；新增 `moveFolder`、`createSmartFolder`、`updateSmartFolder`、`removeSmartFolder`、`moveSmartFolder` 与智能文件夹树查找/防循环移动。
- 后端新增 `/api/folder/remove`、`/api/folder/move`、`/api/v2/folder/move`、`/api/item/removeFromFolder`、`/api/v2/item/removeFromFolder`，支持文件夹删除、层级移动和从原文件夹移除条目。
- 标签合同补齐：新增 `/api/tag/create`、`/api/tag/remove`、`/api/v2/tag/create`；`replaceTag/mergeTags/removeTag` 现在同步条目、标签组、`historyTags` 与 `starredTags`；`/api/tag/all` 和 V2 标签列表返回真实 `imageCount`。
- 新增 `backend/src/smart-folder-rules.js`，`/api/v2/smartFolder/getRules` 不再固定返回空数组，改为返回原版属性/方法/值类型合同。
- `smart-folders.js` 改为按原版 `conditions[].rules[]` 结构执行：支持字符串、数值、日期、集合、type/rating/shape/color/fontActivated 规则，以及 condition 的 AND/OR、TRUE/FALSE 组合。
- 智能文件夹 create/update 增加规则校验；create/update/remove/move 支持父子层级并通过 `metadata.smartFolders` 持久化。
- `shims.js` 的 `folders-change` 在 Electron 结构写入成功后同步 `window.__mockLibrary` 与缓存，避免后续快捷搜索/侧栏数据过期。
- 本轮未完成：原版侧栏拖拽排序的逐项 E2E、标签管理面板/智能文件夹面板完整状态机验收，以及组织操作的后端重启专项测试属于下一批。

### 仍未实现 / 未验收

- 用户已明确暂不推进独立发布构建；现有构建仍只转换 2 个模块且未包含 `src/app`，不计为已完成。
- Eaglepack 已按源码契约完成结构兼容，但尚未拿真实 Eagle 客户端生成的外部样本做跨客户端双向实测。

### 受控下载服务与下载 IPC 更新（2026-08-04）

- 新增 `backend/src/controlled-downloader.js`，按 B 类资源边界重建原版下载合同：默认并发 5、单任务超时 5 分钟、最多 5 次重定向、100MB 流式上限，并提供任务状态、排队、运行中/排队中取消、临时文件租约与释放。
- 默认仅接受 HTTP/HTTPS 且拒绝 URL 凭据；对初始地址和每次重定向都重新解析 DNS 并拦截回环、私网、链路本地、云元数据、IPv4 映射 IPv6、保留和组播地址。仅测试环境可通过 `EAGLE_DOWNLOAD_ALLOW_HOSTS` 显式放行本地夹具服务器。
- 下载使用唯一 `os.tmpdir()/eagle-download-*` 目录和流式计数，不再 `arrayBuffer()` 后验限额；只转发 Accept、Accept-Language、Referer、User-Agent 白名单头，拒绝 Authorization、Cookie 和任意自定义敏感头。HTML/登录墙、空文件、损坏图片、连接中断、HTTP 错误、超时和超限均返回明确错误码。
- `backend/src/importer.js` 的单 URL/批量 URL 导入已统一复用受控下载服务；批量任务受全局并发 5 限制，成功后继续复用现有文件识别、`.library` 落盘、metadata/cache/search index 与缩略图生成闭环，并立即释放临时下载。
- 后端新增 `/api/download/start|status|direct|cancel|release`；Electron main/preload 和 renderer shim 已接通 `downloadWithNet`、`downloadWithRequest` 及任务 API。兼容 IPC 忽略 renderer 传入的任意 directory/filename，只返回后端受控临时路径，支持按任务 ID 或路径释放。
- 新增 `tests/controlled-download-closed-loop.mjs`，唯一系统临时目录测试覆盖正常/批量/重定向、404、超时、中断、伪 Content-Length、流式超限、HTML、损坏图片、回环/私网/IPv6/重定向绕过、请求头过滤、并发上限、运行中和排队中取消、租约清理、后端重启持久化与无临时目录泄漏。Electron 隐藏窗口验证 preload 下载 API 和两个原版 IPC 均返回真实可读文件且可释放。
- 图片导入、自定义缩略图、颜色分析回归及隔离 Vite 构建均通过；构建仍仅转换 2 个模块，不计为独立生产构建完成。剩余风险是当前不实现原版 URL 转大图规则、通知音效和下载任务跨进程恢复；跨代理、企业 DNS 与公网多格式样本仍需后续兼容矩阵验证。

### 统一缩略图任务服务更新（2026-08-04）

- 新增 `backend/src/thumbnail-task-service.js`，把导入、刷新、重置、资源库修复和显式任务 API 统一到并发 3、默认 100 秒超时的受控队列；同条目拒绝重复任务，支持排队/运行取消、状态查询和后端重启后的处理中状态清理。
- 第一阶段真实覆盖 SVG、GIF、WebP、TIFF 与 PDF：首页/首帧生成统一 PNG 缩略图。SVG/GIF/WebP/TIFF 使用 Sharp 受限解码，PDF 使用隔离 Electron 子进程加载项目内 PDF.js，仅允许工作页、原 PDF 与反编译 PDF.js 静态资源，禁用窗口打开、权限请求、脚本求值与外部导航。
- 所有格式限制 100MB 输入、3000 万解码像素和最大 480px 缩略图；先写条目目录唯一 pending 文件，再经备份/重命名原子替换，metadata/cache/search index 持久化失败会回滚旧缩略图和旧条目状态。
- 成功时同步原始宽高、动画/页数、palettes、`lastModified` 和 `noThumbnail/noPreview`；失败、取消、超时分别持久化稳定错误码，并清理 pending 文件与 `processingThumbnail/thumbnailTask`，不覆盖已有有效缩略图。
- 新增 V1/V2 `/api/item/thumbnailTask/start|status|cancel`，Electron preload/main 和 renderer shim 提供 start/status/cancel 兼容桥接；`refreshThumbnail` 与 `resetCustomThumbnail` 复用同一任务服务，普通刷新继续保留有效自定义封面。
- 新增 `tests/thumbnail-task-closed-loop.mjs`，唯一系统临时目录验证五种格式、自动导入入队、V1/V2、并发 3、同条目冲突、排队取消、超时、损坏 SVG、重启持久化和中断状态恢复。自定义缩略图、图片/文件夹导入、颜色分析和 Electron 隐藏窗口桥接回归均通过。
- 第二阶段视频首片已真实覆盖 MP4/WebM：新增隔离 Electron 视频 worker，基于 Chromium 媒体解码提取默认 `min(10 秒, duration/3)` 或显式 `startAt/thumbnailAt` 帧，统一输出 PNG，并持久化 `width/height`、`resolutionWidth/resolutionHeight`、`duration`、`thumbnailAt` 和 palettes。视频输入上限 2GB、单帧 3000 万像素，禁用导航、新窗口、权限请求和除工作页/源视频外的资源访问；不支持的编码返回 `VIDEO_CODEC_UNSUPPORTED`，无占位成功。
- 导入器文件类型检测由整文件 `readFileSync` 改为只读取最多 4KB 头部，避免大视频导入产生等量内存峰值；新增 MP4 `ftyp` 与 WebM EBML/DocType 识别及正确 MIME。V1/V2 任务 API、`refreshThumbnail`、Electron preload/main 与原版 `regenerate-video-thumbnail` 兼容事件均支持指定帧；自动导入任务与用户指定帧刷新按同条目串行，避免竞态覆盖。
- `tests/video-thumbnail-closed-loop.mjs` 在唯一系统临时目录动态生成真实 WebM，覆盖自动入队、默认/指定帧、宽高/时长/色板、运行取消、损坏编码、非法 startAt、真实 worker 超时、旧缩略图保留和重启持久化；公开 H.264 MP4 样本实测得到 320×176、10.026667 秒和 1 秒帧。Electron 隐藏窗口进一步验证视频导入、等待自动任务及指定 0.9 秒刷新。
- 当前仍未覆盖音频/字体及 PSD/AI/XD/Office/RAW/3D；MP4/WebM 的具体编码支持受 Electron/Chromium 平台构建约束，MOV/MKV/AVI/HEVC 尚未承诺。PDF/视频均按任务启动隔离子进程，后续可升级为受限常驻 worker 池。隔离 Vite 构建仍只转换 2 个模块，不计为独立生产构建完成。

### 真实自定义缩略图闭环更新（2026-08-04）

- 新增 `backend/src/custom-thumbnail.js`，按 B 类资源边界重建原版 `set-custom-thumbnail` 行为：源图片必须为不超过 10MB 的绝对普通文件，拒绝相对路径、目录、符号链接、损坏图片和超过 3000 万像素的解码输入。
- 自定义封面先由 Sharp 解码、自动旋转并规范为 PNG，写入条目目录内唯一临时文件；同条目操作串行，正式文件采用备份与重命名替换，metadata 持久化失败会回滚旧文件和旧条目状态。
- V1/V2 `setCustomThumbnail` 已关闭固定成功空壳，兼容 `id/itemID/itemId` 与 `thumbnailPath/filePath`；新增 V1/V2 `resetCustomThumbnail`，`refreshThumbnail` 不再覆盖有效自定义封面。成功时同步 `customThumbnail`、宽高、palettes、`lastModified`、metadata/cache，失败返回明确 400/404/413/422/500 错误码。
- Electron main/preload 和原版 renderer shim 已接通 `set-custom-thumbnail`、`regenerate-thumbnail` 与插件 `ipcRenderer.r2r('item.setCustomThumbnail')`；完成后发送 `thumbnail-generated`，重置操作会恢复从原文件生成的普通缩略图。
- 新增 `tests/custom-thumbnail-closed-loop.mjs`，使用 `os.tmpdir()` 唯一库验证正常图片、损坏图片无副作用、缺参、不存在 ID、相对路径/目录拒绝、10MB 上限、V1/V2、同条目并发顺序、刷新保留、重置和两轮重启持久化。Electron 隐藏窗口同时验证 preload API、真实文件生成、palettes 和图片解码。
- 颜色分析与图片导入回归通过；隔离 Vite 构建通过但仍仅转换 2 个模块。剩余风险：跨平台原子替换和更多 Sharp 输入格式仍需在 Windows/macOS/Linux 与真实 Eagle 外部样本矩阵中继续验证；浏览器 HTTP API 的绝对路径输入仍依赖现有本机请求/令牌边界，不能扩展为远程任意文件读取。

### 真实颜色分析闭环更新（2026-08-04）

- 新增 `backend/src/color-analyzer.js`，按 BUILD_AUDIT_REPORT.md 的 B 类迁移边界重建颜色分析：仅参考原版队列和持久化语义，不加载原版 renderer 全局变量、IPC，也不引入原版 `image-palette` 中夹带的授权检查。
- 当前实现使用项目已有 `sharp` 解码并缩放到最大 480px，在后端进行带透明度过滤的颜色量化，输出最多 12 个 `{ color: [r, g, b], ratio }`。
- 队列并发固定为 3，默认任务超时 30 秒、任务间延迟 20ms；服务提供队列状态、暂停、恢复和延迟调整接口。分析前持久化 `processingPalette` 并移除旧 palettes，成功后写回 `.library` 的条目 metadata/cache，失败或超时会清理处理中状态且不会伪造结果。
- `POST /api/item/refreshPalette` 不再固定返回 `ok(true)`：缺少 ID 返回 400，不存在 ID 返回 404，损坏/不可解码图片返回 422，超时返回 504，成功返回更新后的 item、palettes 与队列状态。
- 新增 `tests/color-palette-closed-loop.mjs`，所有测试数据和资源库都创建在 `os.tmpdir()` 的唯一目录；已验证正常双色 PNG、损坏 PNG、不存在 ID、7 请求并发队列（最大 active=3）、超时清理、暂停/恢复和后端重启持久化。
- 针对性语法检查、颜色分析闭环测试、图片导入重启回归均通过。隔离 Vite 构建通过，但仍只转换 2 个模块；这只证明本次后端改动未破坏现有构建，不改变“独立生产构建未验收”的状态。
- 剩余风险：量化输出已满足当前搜索/UI 数据形状，但尚未用真实 Eagle 客户端样本做逐色差兼容对比；Sharp 可解码格式仍受其编译能力限制，媒体格式矩阵需继续补测。

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
