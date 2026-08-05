# 下一大任务：原版主界面搜索、筛选与资源组织真实闭环

> 用途：把本文作为新 WorkBuddy 窗口的任务上下文和执行合同。执行者应先读证据、再改代码；不得把已有自研 Roadmap/Workbench 面板当作原版主界面闭环完成证据。

## 0. 新窗口可直接使用的任务指令

请在以下工程继续推进 Eagle 1:1 复刻：

```text
C:\Program Files\Eagle\Eagle-reverse\Eagle-Sec-development
```

本次大任务是：

> **打通原版 Electron 主界面的搜索、筛选与资源组织真实闭环。**

必须直接复用反编译原版 `src/app/index.html`、`app.bundle.js`、`quick-search-modal`、`filter-item-*`、文件夹/标签/智能文件夹 controller、批量管理和重复扫描/合并 directive；通过 `frontend/public/shims.js`、`electron/preload.cjs`、`electron/main.cjs` 与受控后端适配原版事件合同。不得用 `roadmap.html`、`workbench.html`、mock、固定成功响应或新造演示面板冒充完成。

任务结束时，用户必须能在原版主界面完成：

```text
导入真实资源
→ 新建/整理文件夹和标签
→ 快捷搜索与组合筛选
→ 保存并执行智能文件夹
→ 批量重命名/批量归类
→ 扫描和合并重复项
→ 重启后恢复全部状态
```

所有操作必须验证真实 `.library` 磁盘副作用、错误语义和后端重启恢复；测试必须使用 `os.tmpdir()` 唯一临时目录、随机安全端口和隔离 user-data。最后执行完全隔离回归、主界面 Electron E2E 和相邻回归，检查 Git 边界，使用中文提交。

基线提交：

```text
f76cb1cc140de3cc6960851070307e72b5c6e96c  修复条目接口兼容与导入事件重复
e571b88facd9af6342071b6f0a40fef226361eb7  打通原版主界面真实工作流闭环
```

不要混入独立生产构建、构建审计迁移和画布迁移文件。具体范围、源码证据、验收标准和禁止事项见本文后续章节。

---

## 1. 任务背景与目标

上一大任务已经证明原版主界面能够真实加载 `.library`，完成文件/文件夹/剪贴板导入、Inspector 编辑、物理重命名、回收站、详情、预览和重启恢复。本任务不是重复这些功能，而是解决资源数量增加后的核心可用性问题：**找到资源、组织资源、批量整理资源、消除重复资源。**

本任务完成后，工程应从“原版主界面可以导入和编辑单个条目”提升为“原版主界面可以持续管理中大型资源库”。

### 1.1 核心目标

1. 原版快捷搜索可搜索条目、文件夹、智能文件夹和标签。
2. 原版筛选组件可组合筛选真实条目，结果与后端合同一致。
3. 原版侧栏可真实管理文件夹、标签和智能文件夹。
4. 原版批量重命名、批量保存和归类组件作用于真实条目。
5. 原版重复扫描和合并组件作用于真实文件与 metadata。
6. 所有变化持久化到标准 `.library` 文件，并在后端/Electron 重启后恢复。
7. 不修改反编译原版文件；所有适配留在复刻工程。

### 1.2 用户体验闭环

最终必须在原版 Electron 主窗口完成以下场景：

1. 导入不少于 8 个真实夹具，其中包含：
   - 可按名称区分的条目；
   - 多种标签、评分、备注和 URL；
   - 不同尺寸/颜色/扩展名；
   - 至少一组字节完全相同的重复文件；
   - 至少一组视觉或 metadata 相似候选（若本轮承诺 similar）。
2. 创建父子文件夹并将条目拖拽或通过原版“添加到文件夹”弹窗归类。
3. 创建标签、重命名标签、合并标签，并确认受影响条目同步变化。
4. 用原版快捷搜索在 ITEMS/FOLDERS/SMARTFOLDERS/TAGS 模式中定位目标。
5. 组合使用颜色、尺寸、日期、评分、标签、类型、备注和 URL 筛选。
6. 保存智能文件夹，关闭并重开后仍能执行相同规则。
7. 用原版批量重命名面板预览并提交真实批量改名。
8. 用原版重复扫描面板找到重复组，选择保留项并合并。
9. 重启后端和 Electron，确认侧栏、搜索、智能文件夹和合并结果恢复。

---

## 2. 必读文档与引用

执行前按以下顺序阅读，不要只依赖本文结论。

### 2.1 项目任务和路线

1. [`TASK.md`](./TASK.md)
   - “阶段 3：资源库与数据层”：文件夹树、标签组、智能文件夹、回收站。
   - “阶段 7：功能迁移”：管理、重复文件检测、搜索与智能文件夹。
   - “原版主界面真实工作流闭环更新”：上一任务已完成的真实基线。
   - “仍未实现 / 未验收”：独立生产构建目前明确不属于已完成项。

2. [`docs/REUSE_ROADMAP.md`](./docs/REUSE_ROADMAP.md)
   - 第 6.1 节：批量重命名、批量保存、添加/移动文件夹、新建智能文件夹、标签弹窗。
   - 第 6.2 节：重复扫描、重复弹窗、合并编辑器。
   - 第 6.5 节：标签选择、标签管理、标签输入。
   - 第 6.7 节：原版 `filter-item-*` 和 `quick-search-modal`。
   - 第 10 节大任务 A-D：原版组件接入和验收方向。

3. [`BUILD_AUDIT_REPORT.md`](./BUILD_AUDIT_REPORT.md)
   - 第 5 节：自研面板“可操作”不等于原版 directive 的真实事件与状态机已接通。
   - 第 6 节：`/api/v2/smartFolder/getRules` 仍是固定空数组，是本任务的明确语义缺口。
   - 第 8.9 节：V2 Playground 元数据可作为 API 合同与参数校验来源。
   - 第 8.10 节：中文分词、拼音和简繁归一化资源；本任务至少应保证原版快捷搜索已有的简繁/拼音路径不被 shim 破坏。
   - 第 11 节：API、Electron 和磁盘副作用验收标准。

### 2.2 原版架构和数据合同

4. [`../docs/LIBRARY_FORMAT.md`](../docs/LIBRARY_FORMAT.md)
   - 核对 `metadata.json`、`folders.json`、`tags.json`、`saved-filters.json`、item metadata 和 cache 的原版格式。

5. [`../docs/API.md`](../docs/API.md)
   - 核对 V1 item/folder/tag 接口的请求参数和返回语义。

6. [`../docs/PLUGIN_SYSTEM.md`](../docs/PLUGIN_SYSTEM.md)
   - 仅在智能文件夹或标签行为涉及插件 model 合同时参考；本任务不扩展为完整插件 SDK。

7. [`../docs/RENDERER_SOURCE_MAP.md`](../docs/RENDERER_SOURCE_MAP.md) 与 [`../docs/SOURCE_MAP.md`](../docs/SOURCE_MAP.md)
   - 定位原版 bundle 中 controller/directive 和主界面状态机。

### 2.3 原版源码证据

以下文件只读，不允许直接修改：

```text
C:\Program Files\Eagle\Eagle-reverse\src\app
```

关键入口：

- `src/app/index.html`
  - 约 1567 行挂载 `<quick-search-modal>`。
  - 约 1568 行挂载 `<batch-rename-modal>`。
  - 约 2175 行挂载 `<batch-save-panel>`。
  - 约 2183-2184 行挂载 `<duplicate-scan-panel>` 和 `<duplicate-modal>`。
  - 文件中还包含原版添加到文件夹、移动文件夹和智能文件夹 UI。

- `src/app/app.bundle.js`
  - `quick-search-modal`：约 60845 行。
  - `batch-save-panel`：约 58314 行。
  - `duplicate-modal`：约 59480 行。
  - `duplicate-scan-panel`：约 59762 行。
  - `merge-editor`：约 60162 行。
  - `batch-rename-modal`：约 76840 行。

- `src/app/js/background.js`
  - 核对文件夹、标签、智能文件夹、条目变化、删除和重复合并的后台合同。

- `src/app/js/api-server.js`
  - 核对 V1 item/folder/tag/批量保存接口的原版参数与返回值。

- `src/app/js/api-server-v2.js`
  - 核对 V2 item query、folder、tag、smartFolder 合同。

- `src/app/js/api-v2-playground-config.js`
  - 用作字段类型、必填参数和示例的合同来源。

---

## 3. 必须复用的原版组件

### 3.1 快捷搜索

```text
src/app/js/directives/quick-search-modal.html
src/app/js/directives/quick-search-modal.js
```

原版已包含：

- `OPEN_QUICK_SEARCH_MODAL` / `CLOSE_QUICK_SEARCH_MODAL`；
- ITEMS、FOLDERS、SMARTFOLDERS、TAGS 四种模式；
- 搜索历史；
- 文件夹和智能文件夹历史；
- 简繁归一化；
- `pinyinlite` 拼音搜索组合；
- 键盘选择、跳转和焦点管理。

任务不是重写一个搜索框，而是让这些原版状态与真实资源库数据一致。

### 3.2 筛选组件

至少覆盖：

```text
filter-item-annotation.*
filter-item-color.*
filter-item-folders.*
filter-item-mtime.*
filter-item-note.*
filter-item-rating.*
filter-item-resolution.*
filter-item-size.*
filter-item-tags.*
filter-item-types.*
filter-item-url.*
filters.js
```

可延后但需明确记录：

```text
filter-item-bpm.*
filter-item-camera.*
filter-item-duration.*
filter-item-fonts.*
filter-item-semantic.*
filter-item-shape.*
```

如果当前条目数据没有可靠 BPM、相机、字体或语义字段，不得伪造结果；应明确标记为不在本轮承诺范围。

### 3.3 文件夹与智能文件夹

```text
src/app/js/controllers/add-to-folder.js
src/app/js/controllers/move-folder.js
src/app/js/controllers/new-smart-folder.js
src/app/js/directives/folder-select-panel.*
src/app/js/directives/folder-sortable.js
src/app/js/directives/folders-input.*
src/app/js/directives/smart-folder-sortable.js
src/app/js/plugin/handlers/smart-folder-rules.js
```

原版 `add-to-folder.js` 最终调用 `ayncsImagesChange($scope.images)`；适配层应继续复用上一任务已经建立的有序 item 更新队列，不能另造并发写入路径。

### 3.4 标签

```text
src/app/js/controllers/tag-popup.js
src/app/js/directives/tag-manager.*
src/app/js/directives/tag-select-panel.*
src/app/js/directives/general-tag-select-panel.*
src/app/js/directives/tags-input.*
```

上一任务已接通 `TagManager.save()` 到真实 `tags.json`，本任务应在此基础上补齐标签重命名、合并、删除和条目同步，而不是重写历史标签持久化。

### 3.5 批量管理

```text
src/app/js/directives/batch-rename-modal.*
src/app/js/directives/batch-save-panel.*
src/app/js/controllers/add-to-folder.js
src/app/js/controllers/move-folder.js
```

原版 `batch-rename-modal.js` 支持 IMAGE/FOLDER/SMART_FOLDER/TAGS 多种对象；必须逐类判断后端合同，不能把条目物理重命名规则错误套到文件夹或标签。

原版 `batch-save-panel` 实际是采集/保存面板，负责 URL、文件夹和标签的批量保存，不是多条目 metadata 编辑面板。多条目备注、标签、文件夹、评分编辑统一由原版多选 Inspector 和 `/api/item/batchSave`、`/api/v2/item/batchSave` 承担。

### 3.6 重复扫描与合并

```text
src/app/js/directives/duplicate-scan-panel.*
src/app/js/directives/duplicate-modal.*
src/app/js/directives/merge-editor.*
src/app/js/lib/api/duplicate-checker.js
```

原版关键行为包括：

- SAME 和 SIMILAR 扫描模式；
- 进度、取消和结果分组；
- 合并 tags/folders/comments；
- `images-change` 更新保留项；
- `empty-trash` 删除被合并项；
- palette 暂停/恢复和主界面刷新。

不得只验证后端 JSON 分组；必须让原版面板真实显示结果并提交合并。

---

## 4. 当前复刻工程基线

### 4.1 已有能力，可复用而非重做

- `backend/src/item-workflow-service.js`
  - 原版 `images-change` 的字段白名单更新；
  - 条目名称和真实文件/缩略图重命名；
  - 回收站和恢复；
  - Windows 文件名校验与尽力回滚。

- `frontend/public/shims.js`
  - `images-change` / `image-change` 已冻结快照并有序提交；
  - `folders-change` 已转发 `library.updateStructure()`；
  - `TagManager.save()` 的 `tags.json` 已转发到受控后端。

- `backend/src/server.js`
  - `/api/item/search`；
  - `/api/v2/item/query`；
  - `/api/item/batchRename`、`batchUpdate`、`addToFolder`；
  - `/api/item/duplicates/scan`、`mergeDuplicates`；
  - V1/V2 folder/tag/smartFolder 基础路由。

- `backend/src/library-store.js`
  - 加载 `metadata.json`、`tags.json`、`saved-filters.json`、`folders.json`、cache 和 search index；
  - `saveLibraryState()` 写入 metadata/tags/saved-filters/folders；
  - `saveItems()` 写 item metadata、cache 和 search index。

- `backend/src/duplicates.js`
  - exact 和简化 similar 分组基础。

- `backend/src/smart-folders.js`
  - 已有规则执行基础，需要对照原版规则形状和组合语义复核。

### 4.2 已知缺口，必须先验证再修

1. `frontend/public/shims.js` 对 `saved-filters.json` 的浏览器 fallback 仍固定返回 `[]`；Electron 真实路径是否完整读取/写入必须核实。
2. `/api/v2/smartFolder/getRules` 当前固定返回 `[]`，不能支撑原版规则编辑器的完整选择和校验。
3. 当前 `roadmap.html` 能执行搜索、批量和重复 API，但这只是功能面板，不是本任务验收对象。
4. 当前搜索实现位于 `backend/src/server.js` 的 `filterItems()`，字段、组合逻辑、排序、分页和原版 UI 条件形状未建立完整合同映射。
5. 当前 exact/similar 扫描结果形状不一定与原版 `duplicate-scan-panel` 需要的 `group.items`、进度和取消合同一致。
6. 当前 merge API 是否会正确处理真实冗余文件、metadata 目录、回收站语义、失败回滚和后端重启，需要专项审计。
7. `saveItems()` 仍是多文件顺序写入，不是严格磁盘原子事务；本任务不得把它描述为严格 ACID。若批量/合并路径暴露实际数据风险，应做聚焦加固和故障注入测试。

---

## 5. 任务范围与分阶段实施

## 阶段 0：建立原版事件与数据合同表

在改代码前形成一份可执行映射（可写入 `TASK.md` 对应更新，不必另建大量文档）：

| 原版组件/函数 | 原版事件或直接调用 | 当前适配入口 | 后端服务/API | 磁盘副作用 |
|---|---|---|---|---|
| quick-search-modal | Angular scope/broadcast | 原版 scope 数据 | search/index | 无写入，读取真实索引 |
| add-to-folder | `images-change` | shim item queue | item updateMany | item metadata/cache/index |
| new-smart-folder | 智能文件夹变更 | library structure bridge | smartFolder service | metadata/saved-filters 或原版对应文件 |
| batch rename | 原版 rename 函数 | item/folder/tag 适配 | workflow/folder/tag | 原文件、metadata、cache/index |
| duplicate merge | `images-change` + `empty-trash` | shim/IPC | merge service | 保留项、冗余 item 目录、cache/index |

必须回答：调用方、参数、返回值、错误事件、UI 刷新、持久化文件、重启恢复分别是什么。

## 阶段 1：搜索与筛选后端合同统一

目标：原版 UI 和 HTTP API 使用同一套可测试搜索语义。

工作项：

1. 将 `server.js` 中的 `filterItems()` 拆为独立、可测试的搜索服务（若不拆也必须建立独立合同测试；优先拆分以避免继续膨胀 `server.js`）。
2. 明确字段映射：
   - keyword/name；
   - tags/folders；
   - annotation/note/comments；
   - url/website；
   - star/rating；
   - width/height/resolution；
   - size；
   - ext/type；
   - import/mtime/date；
   - palettes/color；
   - isDeleted。
3. 明确多条件逻辑：AND/OR、空条件、数组条件、范围边界、大小写、Unicode 和空值。
4. 对齐 V1 `/api/item/search` 与 V2 `/api/v2/item/query` 的返回形状、分页和排序。
5. 修改条目、标签或文件夹后，搜索 index 必须立即反映新状态。
6. 不把 AI Search、语义向量搜索扩入本轮。

验收：同一组条件经原版 UI、V1 API、V2 API得到相同 ID 集合和排序。

## 阶段 2：原版快捷搜索真实接入

目标：复用 `quick-search-modal` 原版交互，不另造 modal。

工作项：

1. 保证原版 `OPEN_QUICK_SEARCH_MODAL` 能从真实快捷键/菜单打开。
2. 给原版 scope 提供真实：
   - `all` / item mappings；
   - `folderList` / `folderMappings`；
   - `smartFolderList` / `smartFolderMappings`；
   - 标签列表。
3. 验证 ITEMS/FOLDERS/SMARTFOLDERS/TAGS 切换。
4. 验证键盘上下、Enter 跳转、Escape 关闭、焦点恢复。
5. 验证简体、繁体、全拼和拼音首字母路径；不得用远端服务。
6. 搜索选中条目后主网格和 Inspector 状态必须一致。

验收：通过真实 Electron 页面打开原版 modal，输入和键盘操作后定位正确资源或侧栏节点。

## 阶段 3：原版筛选器真实接入

目标：原版 filter directive 改变主网格真实结果，不只调用 Roadmap API。

工作项：

1. 接通本轮承诺的 filter-item 组件。
2. 将原版 condition 数据转换为统一搜索合同；转换必须有类型校验。
3. 支持多个条件组合、移除条件、清空筛选和排序。
4. 筛选计数、空状态和当前文件夹范围正确。
5. 条目更新后，当前筛选结果应增量刷新或可靠重查。
6. 回收站、未分类、当前文件夹和全库范围不得混淆。

验收：颜色、尺寸、日期、评分、标签、类型、备注和 URL 各自独立通过，并至少验证三组组合条件。

## 阶段 4：文件夹、标签与智能文件夹真实组织

目标：原版侧栏和弹窗完成资源组织并真实持久化。

### 文件夹

- 新建、重命名、移动、删除父/子文件夹；
- 原版拖拽排序和层级移动；
- 通过 add-to-folder/move-folder 给单选和多选条目归类；
- 从原文件夹移除的语义与 UI 状态一致；
- 删除文件夹时明确条目处理策略，不误删原文件。

### 标签

- 创建标签；
- 给单/多选条目添加和移除标签；
- 重命名标签并更新所有条目；
- 合并标签并去重；
- 删除标签并处理 history/starred/group 引用；
- 标签计数与搜索结果一致。

### 智能文件夹

- 让原版 `NewSmartFolderController` 获得真实规则定义；
- 实现 `getRules`，不能继续固定空数组；
- 创建、编辑、重命名、移动和删除；
- 执行规则后结果与统一搜索服务一致；
- 重启后恢复规则和层级。

持久化至少核对：

```text
metadata.json
folders.json
tags.json
saved-filters.json
每个受影响条目的 metadata.json
cache.json
search-index.json
```

实际原版格式若把 smartFolders 存在 `metadata.json` 而不是 `saved-filters.json`，必须按 `LIBRARY_FORMAT.md` 和真实样本执行，不能为了列表完整而重复写两份相互冲突的数据。

## 阶段 5：原版批量管理真实闭环

目标：通过原版面板批量修改真实条目、文件夹、智能文件夹和标签。

工作项：

1. `batch-rename-modal`：
   - 打开、预览、确认、取消；
   - 前缀/后缀/替换/编号等原版已支持模式；
   - 条目改名必须继续走 `ItemWorkflowService`，同步真实原文件和缩略图；
   - 批内冲突、非法 Windows 名称和中途失败必须拒绝并回滚。
2. `batch-save-panel`：
   - 原版 directive 按采集/保存语义验收；多条目 metadata 编辑走原版多选 Inspector 与 `/api/item/batchSave`；
   - 不允许旧完整对象覆盖后提交状态；复用已有有序 item 队列。
3. 文件夹/标签/智能文件夹批量改名：
   - 使用各自结构服务；
   - 不调用条目文件重命名逻辑；
   - 引用和侧栏映射同步更新。

验收：UI 预览与最终落盘完全一致，失败时没有半批次静默成功。

## 阶段 6：原版重复扫描与合并真实闭环

目标：原版 duplicate panel 显示真实进度和分组，并安全合并真实资源。

工作项：

1. exact：以真实原文件 hash/size 为依据，不能仅比 name/ext。
2. similar：若保留本轮承诺，明确算法、阈值和数据来源；当前简化实现若不满足原版面板语义，应先只承诺 exact，把 similar 标为后续，不能伪造。
3. 扫描任务应支持：
   - 进度；
   - 取消；
   - 单条失败隔离；
   - 大库内存/并发上限。
4. 合并策略：
   - 用户指定保留项；
   - 合并 tags/folders/comments 等 metadata；
   - 保留项真实原文件不丢失；
   - 冗余条目按原版语义进入回收站或永久删除，必须从源码确认；
   - 若永久删除，先完成任务自有临时库测试，绝不能对用户个人目录做宽泛清理；
   - 更新 cache 和 search index；
   - 失败时保持可恢复状态。
5. 原版面板完成后主网格、选择和 Inspector 立即刷新。

验收：真实重复文件从扫描、分组、选择、合并到重启恢复全链通过；磁盘中不存在孤儿 metadata 或误删保留文件。

## 阶段 7：端到端与重启恢复

新增一个聚焦 E2E，例如：

```text
tests/main-ui-search-organization-closed-loop.mjs
```

测试必须：

- 使用 `os.tmpdir()` 下唯一根目录；
- 随机选择 Fetch 安全端口（建议 `>= 12000`）；
- 独立 API、Vite、Electron user-data；
- 异常时 `finally` 终止所有子进程；
- 只清理本次唯一临时根目录；
- 不连接或切换共享 41695 后端；
- Electron 媒体相关回归串行执行，避免 worker 争用。

E2E 应真实调用原版组件/函数，不能直接调用后端替代 UI 合同。可以像上一主界面 E2E 一样在 Electron 页面内访问 Angular scope，但必须优先触发原版广播、directive 方法和 DOM 事件，并验证可见状态。

---

## 6. 数据一致性与错误合同

每一种写操作至少验证：

1. 正常输入；
2. 缺失参数；
3. 不存在 ID；
4. 重复名称/目标冲突；
5. 非法 Windows 文件名；
6. 非法层级和循环文件夹移动；
7. 删除被引用文件夹/标签；
8. 批处理中途失败；
9. 后端重启；
10. Electron 重启后的 UI 恢复。

磁盘一致性检查：

```text
metadata.json
folders.json
tags.json
saved-filters.json
images/<id>.info/metadata.json
images/<id>.info/<name>.<ext>
images/<id>.info/<name>_thumbnail.png
cache.json
search-index.json
```

禁止：

- API 返回成功但没有实际落盘；
- UI 局部更新但重启丢失；
- 只更新 cache、不更新 item metadata；
- 只更新 item metadata、不重建 search index；
- 合并重复项后残留无主 item 目录；
- 错误发生后继续返回 `status: success`。

---

## 7. 测试要求

### 7.1 新增专项测试

建议至少新增：

```text
tests/search-contract-closed-loop.mjs
tests/library-organization-closed-loop.mjs
tests/duplicate-merge-closed-loop.mjs
tests/main-ui-search-organization-closed-loop.mjs
```

如果为了控制文件数量合并测试，可以合并，但必须保持失败定位清晰。

### 7.2 必跑回归

```text
node --check <所有新增/修改 JS>
node tests/item-workflow-closed-loop.mjs
node tests/item-api-compatibility.mjs
node tests/main-ui-workflow-closed-loop.mjs
node tests/main-ui-search-organization-closed-loop.mjs
node tests/electron-library-bridge.mjs
node tests/full-regression-isolated.mjs
git diff --check
```

最终至少应看到：

```text
ITEM_WORKFLOW_CLOSED_LOOP_OK
ITEM_API_COMPATIBILITY_OK
MAIN_WORKFLOW_SMOKE_OK
MAIN_UI_RESTART_OK
LIBRARY_SMOKE_OK
FULL_REGRESSION_ISOLATED_OK
```

并增加本任务专项成功标记，例如：

```text
SEARCH_CONTRACT_CLOSED_LOOP_OK
LIBRARY_ORGANIZATION_CLOSED_LOOP_OK
DUPLICATE_MERGE_CLOSED_LOOP_OK
MAIN_UI_SEARCH_ORGANIZATION_OK
MAIN_UI_SEARCH_ORGANIZATION_RESTART_OK
```

### 7.3 防止误报

- 异步 `waitFor()` 必须 `await` 检查函数。
- 不能使用固定 800ms 睡眠代替具体 DOM/网络/磁盘状态条件。
- 不能只断言元素存在；必须断言可见结果、目标 ID 和磁盘副作用。
- 不能只修改 `scope.selected`；必须维护原版选择合同。
- 不能只调用 API 后手工修改 scope 来模拟 UI 已更新。
- 重启恢复必须真正终止并重启隔离后端，不能只重新读取当前进程内存。

---

## 8. 安全与架构边界

1. 不修改：

```text
C:\Program Files\Eagle\Eagle-reverse\src\app\**
```

2. B 类原版后台逻辑只能作为行为合同，不能直接加载完整高权限 `background.html/background.js`。
3. 不复制、恢复、绕过授权、注册、设备、机器 ID 或许可逻辑。
4. renderer 不获得任意磁盘读写；文件操作继续通过受控 preload/IPC/后端。
5. 不新增任意脚本注入来完成筛选或批量功能。
6. 不把 `nodeIntegration: true/contextIsolation: false` 描述成完整安全沙箱；这是既有结构债务，不在本任务中无边界重构。
7. 重复合并涉及删除时，优先使用回收站语义或仅操作测试临时库；不能对个人目录执行递归删除。
8. `saveItems()` 多文件写入并非严格原子事务。若本任务增加批量/合并事务服务，必须准确描述“尽力回滚”或实现可证明的 staging/原子替换，不得夸大。

---

## 9. 明确不在本任务范围

以下内容不得混入本次提交：

- 独立生产构建和“Vite 只转换 2 个模块”问题；用户已明确暂不推进。
- AI Search、向量数据库或远程语义搜索。
- 音频、字体、PSD、AI、XD、Office、RAW、3D 新格式管线。
- 完整插件 SDK 重构。
- 全量 211 个 IPC 覆盖。
- Electron 全面安全沙箱迁移。
- 与搜索/组织无关的 UI 美化或新自研面板。

当前工作树中以下既有文件属于其他任务，不得暂存到本任务提交：

```text
docs/BUILD_AUDIT_REPORT_2026-08-04.md          # 当前为既有删除状态
BUILD_AUDIT_REPORT.md                          # 既有未跟踪审计迁移文件
audit-build-20260804-1653/                    # 既有隔离构建目录
canvas-settings-migration-plan-codexgrok.md    # 既有画布迁移文档
scripts/assemble-frontend.mjs                  # 既有生产装配实验
tests/production-build.mjs                    # 既有生产构建测试实验
```

不要删除这些文件，也不要恢复、暂存或修改它们，除非用户另行明确要求。

---

## 10. 完成定义

只有同时满足以下条件，任务才可标记完成：

### 原版 UI

- 原版快捷搜索 modal 在真实 Electron 主界面打开并可用。
- 原版 filter-item 组件改变真实网格结果。
- 原版文件夹/标签/智能文件夹 UI 完成真实写入。
- 原版 batch rename 面板完成真实批量改名；批量保存通过原版多选/Inspector 与 `/api/item/batchSave` 完成真实批量写入。
- 原版 duplicate scan/merge 面板完成真实扫描与合并。

### 数据

- 所有相关 `.library` 文件一致。
- 没有固定成功、固定空数组或 mock ID 冒充完成。
- 修改后立即可搜索，重启后仍可搜索。
- 合并后没有误删保留文件或残留孤儿数据。

### 测试

- 专项服务测试通过。
- 原版主界面 E2E 通过。
- 后端/Electron 重启恢复通过。
- 完全隔离全量回归通过。
- 语法、JSON 和 Git 差异检查通过。

### 提交

- 更新 `TASK.md`，记录真实完成项、证据和仍未完成项。
- 自审提交差异，重点检查 ID 覆盖、字段合同、重复事件、删除语义和测试误报。
- 只暂存本任务文件。
- 中文 Git 提交。
- 报告提交哈希、测试结果、未解决风险和未进入提交的既有文件。

---

## 11. 推荐执行顺序

为避免再次出现长时间扩范围，按以下顺序推进，每片都先通过专项测试再进入下一片：

1. 搜索合同服务与 V1/V2 一致性。
2. 原版快捷搜索 modal。
3. 原版核心筛选器。
4. 文件夹与标签组织。
5. 智能文件夹规则和持久化。
6. 原版批量重命名/批量保存。
7. exact 重复扫描与合并。
8. similar 扫描仅在证据和算法都可靠时加入。
9. 原版主界面完整 E2E 与重启恢复。
10. 完全隔离全量回归、自审、中文提交。

如果某片暴露基础服务缺陷，应聚焦修复该缺陷并增加负向测试；不要顺手扩展到生产构建、媒体格式或插件 SDK。

---

## 12. 新窗口开始时的第一步

新窗口不要立刻改代码。先执行：

1. 阅读本文以及第 2 节引用文档。
2. 查看：

```text
git log -3 --oneline
git status --short
```

3. 核对基线提交 `f76cb1c` 存在。
4. 只读探索原版组件和当前 shim/API。
5. 建立阶段 0 的事件/数据合同表。
6. 从“搜索合同统一”开始实现，不从 Roadmap UI 开始。

任务总体判断：

> 这是原版主界面继“导入与 Inspector 闭环”之后最能提升真实可用性的下一大任务；核心不是增加路由数量，而是让原版搜索、筛选、侧栏组织、批量管理和重复合并状态机在真实 `.library` 上闭环。

## 13. 当前状态（2026-08-05）

- 实现层：搜索/筛选合同、文件夹/标签/智能文件夹组织、批量管理、重复扫描/合并和剩余加固代码已完成。
- 验收层：真实 `.library` 测试、原版主界面 Electron E2E、重启恢复和完全隔离回归由用户执行。
- 口径说明：`batch-save-panel` 按原版采集/保存语义验收；多条目 metadata 编辑以 `/api/item/batchSave` 为统一合同。
