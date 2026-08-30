# Eagle React 化改造进度清单（PROGRESS）

> 唯一跨会话续作依据。开工先读本文件，从第一个「待办」继续。
> 规范来源：`src/app/js/app.bundle.js`（逻辑）；`src/app/index.html` 与 `src/app/js/directives/*.html`（DOM）；
> `src/app/style/*.scss` / `src/app/css/*.css`（样式）；`src/i18n`（i18n）；`src/my_modules/electron-settings`（偏好）。
> 状态：待办 / 进行 / 已验证 / 已删旧实现。完成定义 = 无「待办/进行」+ index.html 移除 angular.min.js + 全闭环测试绿。

说明：
- 行号均为 `src/app/js/app.bundle.js` 中的定位（用 `grep -n "EagleApp.directive('xxx'" app.bundle.js` 可复现）。
- 每个阶段一个 commit，提交前必须：`npx tsc` 无错 + dev 栈可用 + CDP 闭环断言绿 + `tests/api-smoke.mjs` 哨兵绿 + 删除旧引用。

---

## 0. 构建接线

- [x] 入口固定 `src/app/index.html`；main.cjs 窗口 URL 不动。
- [x] `frontend/vite.preview.config.mjs`：react 插件处理 `src/app/react/**/*.tsx`；`readPreviewIndex()` 仅对主界面注入
  react-refresh preamble（本仓 /src/app/*.html 走自定义中间件直出、绕过 transformIndexHtml，必须手补 preamble，
  否则 .tsx 运行时抛 "can't detect preamble"）+ `<script type="module" src="/src/app/react/main.tsx">`。
  其它 /src/app/*.html 不注入，随各窗口迁移再逐一加。
- [x] `src/app/react/main.tsx` 挂载骨架 + `window.__eagleReactStore`（测试用）；
  `global/eagleGlobals.ts` 全局桥（i18n/eagle/electronSettings/eagleDesktop/ipc 只取引用零复制）；
  `store/appState.ts` zustand 全局状态；`app/filters.ts` 21 个 filter 的逐字转写；`app/AppRoot.tsx` 被动壳。
- [x] 根 `tsconfig.json`（`npx tsc` 零错）；闭环测试 `tests/react-stage-smoke.mjs`（9/9 PASS）+ `tests/react-cdp-harness.mjs`。
- [ ] index.html 移除 angular 引用（随各阶段替换逐个删）。

阶段状态：已提交（React mount 与 Angular 共存验证绿：截图 test-run/react-stage-smoke.png）。

---

## 1. 壳与全局状态（EagleController / RootController / 全局 eagle 对象）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| eagle 全局对象（eagle.inspector / eagle.filter / eagle.action / eagle.combineImages / eagle.customExport / eagle.media 等）| 全局单例 | 1-249（Inspector 类）、312-620（ItemFilter）、2048（eagle.action）等 | 进行 |
| RootController | controller | 20015-20197 | 待办 |
| EagleController | controller | 20197-54236 | 待办 |
| Inspector 类 + eagle.inspector | service/class | 1-249 | 待办 |
| ItemFilter 类 + eagle.filter | service/class | 312-606 | 待办 |
| DuplicateChecker / 等其他全局类 | class | 620-2048 | 待办 |

阶段收尾：body 的 `ng-controller="EagleController"` 移除，改为 React 壳。

---

## 2. 侧栏（sidebar / library-panel / folder 树）

> 阶段状态：**已验证并接管**。index.html 78-496 行的 Angular 侧栏模板已整体移除（旧引用已删），
> 由 `react/components/sidebar/Sidebar.tsx` 逐字接管渲染；scope 状态经 `global/scopeBridge.ts`
> （$watch 深投影）同步，事件回调调回 EagleController 同名函数（clickNode/openAll/...）。
> 闭环：tests/react-stage-smoke.mjs 28/28（含点击切换 active 交互、虚拟滚动 spacer、
> 主题图标路径、宽度跟随、footer 拖放区、筛选输入）；source-mode-ui / main-ui-workflow /
> library-switch-ui / drag-start 回归全绿。
> 注意：迁移期事件仍走 scope 函数，逻辑本体随阶段11 与 angular 一起拆除。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| #sidebar 壳（宽度/resizable/ondragleave）| shell | index.html:78 | 已验证（React 接管宽度与 hover 行为） |
| sidebar-header（library-info + toolbar）| 区块 | index.html:81-133 | 已验证 |
| sidebarFolderItem（拖拽/放置区）| directive | 69704-69856 | 已验证（jQuery UI 移植进 React） |
| sidebarSmartFolderItem | directive | 69904-70051 | 已验证 |
| sidebarQuickAccessItem | directive | 70051-70165 | 已验证 |
| libraryPanel | directive | 60409-60788 | 待办（库切换面板，尚未触发验证） |
| libraryIcon | directive | 60358-60409 | 已验证（React effect 移植） |
| folderDraggable | directive | 71140-71170 | 待办（侧栏未用；用于其它视图） |
| folderDroppable | directive | 71170-71226 | 待办（同上） |
| sortTopDroppable | directive | 71226-71313 | 待办（同上） |
| sortBottomDroppable | directive | 71313-71397 | 待办（同上） |
| smartFolderDraggable | directive | 71397-71425 | 待办（同上） |
| smartSortTopDroppable | directive | 71425-71473 | 待办（同上） |
| smartSortBottomDroppable | directive | 71473-71520 | 待办（同上） |
| sidebarScrollToActive | directive | 70672-70697 | 待办 |
| resizable | directive | 70423-70441 | 已验证（壳上原指令继续生效） |
| tagGroupResizable | directive | 70441-70461 | 待办（标签管理视图） |
| scrollToTopSentinel | directive | 73018-73114 | 行为已验证（React onScroll 移植） |
| vs-repeat 窗口算法 | 机制 | 16865-17425（侧栏用法）| 已验证（React 版窗口化 + spacer） |
| vsAutoScroll | directive | 69856-69904 | 已验证（sidebarIndex 滚动跟随） |
| tippy | directive | 17365-17425 | 已验证（React 子树内 tippy 初始化） |
| selectAll | directive | 70600-70614 | 已验证（folder-search Mousetrap 移植） |
| autoFocus | directive | 73003-73018 | 已验证（rename-folder-* 事件监听移植） |
| 拖入侧栏 hover 展开（委托）| 行为 | 69663 | 已验证（委托在 .sidebar 壳上仍生效） |

---

## 3. 工具栏与筛选（toolbar / filter-item-*）

> 阶段3a（工具栏）：**已验证并接管**。index.html 141-273 行 .toolbar + 130-139 行 .search-suggestions
> 旧引用已删（换为 #eagle-toolbar-host / #eagle-search-suggestions-host 壳），由
> `react/components/toolbar/Toolbar.tsx` 接管：面包屑/前进后退/缩放滑条/右侧按钮组/搜索框/
> 搜寻自动提示/cornerBtns 指令（bundle:63187）/置顶插件 ui-sortable。注意 portal 内容必须是
> Fragment（不能包 wrapper div），否则破坏 .toolbar 的 48px flex 行布局。
> 闭环：react-stage-smoke 42/42（筛选开关 active、搜索 keyword 回写+搜索结果面包屑、
> 检查器隐藏时 corner-btns 双实例与原版 ng-if 行为一致）；source-mode-ui / main-ui-workflow /
> library-switch-ui / drag-start / api-smoke 全绿。
> 阶段3b（筛选面板）：**已验证并接管**。index.html 舊 157-203 行 #filter-toolbar 旧引用已删
> （换壳 `#eagle-filter-toolbar-host`，`#filter-toolbar-overlay` 保留原元素使其 bootstrap 期
> jQuery 绑定继续生效），由 `react/components/filter/`（FilterItemShell + FilterItems/FilterItems2）
> 接管：17 个筛选器 + 容器 + filter-right（saved/lock/reset）。
> 关键语义修复：menu-wrap 内点击 stopPropagation（勾选不影响开合，bundle:67345）；clear-btn
> stopProp + clear + close（原 ng-click stopProp 语义）；快照 rules/counts 深拷贝（活对象引用
> 会让 useMemo 派生值失效）。注册键必须用工具列类型名（fontActivated 而非 fonts）。
> 闭环：react-stage-smoke 50/50（17 items 渲染、面板开合、types 互斥展开、勾选→规则/filterBadge/
> 搜索结果面包屑/active 联动、reset 清空）；source-mode-ui / main-ui-workflow / library-switch-ui /
> drag-start / api-smoke 全绿（main-ui-workflow 的 markdown 缩略图偶发竞态为环境既有问题，
> 已在无 3b 改动的 HEAD 上复现，非本阶段回归）。
> - **模板分族（已勘察 2026-08-29，模板在 js/directives/filter-item-*.html）**：
>   - 【check 列表族】rating(68766)/fonts(68812)/camera(68853)/shape(68704)/import(68913)/mtime(69010)/
>     types(68639)：`.check-item` 固定结构 `.check-icon>.checkbox + .name + .badge`，ng-click 序列
>     `focusInput(); 改规则; page=1; filterContent(); changeDisplayName();`。
>   - 【数值区间族】size(69220)/duration(69105)/bpm(69164)/resolution(69279)：min/max 输入
>     （debounce 300）+ unit select；displayName 拼接逻辑见各自 changeDisplayName。
>   - 【关键词族】annotation(69352)/note(69400)/url(69448)：has/no check-item + textarea（debounce 300，
>     `input-disabled` 类跟随 has）。
>   - 【复杂族】folders(68209)/tags(68364)：pinyin 搜索依赖全局 chineseConvert/pinyinlite/_/cartesianProduct；
>     tags 有 toggleAll/isAllSelected/filterSelected/filterWithGroup/logic rule；folders 有 changeRule +
>     `$body.calcuteContainFolders` 重算（监听 `open` 事件触发）。
>   - 【color 特例】(68163)：`#colorpickerHolder` jQuery ColorPicker(flat) + 13 固定 palette + accuracy 滑条，
>     onChange 33ms 防抖写 `$body.hexColor` 或 `filterWithColor`。
>   - 各指令 clear/displayName 逐字转写；`$scope.$on("Reset_Filter")` 以 `$bodyScope.$on('Reset_Filter',...)` 等价移植。
> - filterItem 基础指令（bundle:67305-67559，attribute 指令）需移植为 FilterItemShell：
>   click 切换 .open（互斥）、right-menu 对齐、`#filter-toolbar-overlay` .show 同步、
>   .check-item 键盘导航（up/down/enter/esc）与 hover active、clear-btn 关闭、focusInput 延时聚焦、
>   `[close-filter-item]` 委托关闭、增强输入 500ms 清空高亮。
> - 每个模板在 `js/directives/filter-item-*.html`，指令体在 bundle 对应行号（下表）。
> - 验证断言建议：toggleFilter 后 .filter 面板展开、color/size 等 check-item 计数、
>   键盘导航 active 迁移、reset 按钮清空 filterBadge、截图比对展开态。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| .toolbar 区块（面包屑/滑条/右侧/搜索）| 区块 | index.html:141-273（旧） | 已验证 |
| .search-suggestions | 区块 | index.html:130-139（旧） | 已验证 |
| cornerBtns | directive | 63187-63239 + corner-btns.html | 已验证 |
| selectAll（#search）| directive | 70600-70614 | 已验证 |
| $("#search") focus→currentFocus | 行为 | 21830 | 已验证（onFocus 移植） |
| filterItem | directive | 67305-67559 | 待办 |
| filterItemImage | directive | 67559-68091 | 待办 |
| filterItemSemantic | directive | 68091-68163 | 待办 |
| filterItemColor | directive | 68163-68209 | 待办 |
| filterItemFolders | directive | 68209-68364 | 待办 |
| filterItemTags | directive | 68364-68639 | 待办 |
| filterItemTypes | directive | 68639-68704 | 待办 |
| filterItemShape | directive | 68704-68766 | 待办 |
| filterItemRating | directive | 68766-68812 | 待办 |
| filterItemFonts | directive | 68812-68853 | 待办 |
| filterItemCamera | directive | 68853-68913 | 待办 |
| filterItemImport | directive | 68913-69010 | 待办 |
| filterItemMtime | directive | 69010-69105 | 待办 |
| filterItemDuration | directive | 69105-69164 | 待办 |
| filterItemBpm | directive | 69164-69220 | 待办 |
| filterItemSize | directive | 69220-69279 | 待办 |
| filterItemResolution | directive | 69279-69352 | 待办 |
| filterItemAnnotation | directive | 69352-69400 | 待办 |
| filterItemNote | directive | 69400-69448 | 待办 |
| filterItemUrl | directive | 69448-69688 | 待办 |
| 筛选面板容器（.filter/.filter-items/.filter-right + color-picker + ui-sortable 工具列）| 区块 | index.html 舊 157-203 | 已验证 |

---

## 4. 内容网格（ng-grid-layout / vs-repeat / thumb）

> 阶段状态：**已验证并接管**。index.html 舊 368-377 行 #box-list 的 ng-grid-layout/items/options/
> ng-mousedown/ng-right-click 旧引用已删（元素保留），boxes 由 react/components/grid/boxGridEngine.ts
> （ngGridLayout 指令 66496-67305 逐字移植）生成。三个全局契约保持：window.resetNgGridLayoutData
> （bundle 4 个调用点零改动）、window.ig/NgGridStrings（scrollbar/框选消费方）、window.$bodyScope
> （InfiniteGrid.getViewportSize 等读取，原由指令 link 设置、现由 React 接手）。
> gl:reset/gl:scrollToTop/gl:removeItems 事件改挂 bodyScope 等价监听。
> 闭环：react-stage-smoke 56/56（boxes 渲染/结构/缩略图/type-label/ig 全局/布局类与活 scope 一致/
> 点击选中链路）；source-mode-ui/main-ui-workflow/library-switch-ui/drag-start/api-smoke 全绿。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| ngGridLayout | directive | 66496-67305 | 已验证（引擎逐字移植） |
| resetNgGridLayoutData 全局契约 | 全局函数 | 66970（调用方 21893/21908/27452/30541）| 已验证 |
| window.ig / NgGridStrings 全局 | 全局变量 | 66491-66494 | 已验证 |
| window.$bodyScope 全局 | 全局变量 | 66507-66509 | 已验证（React 接手设置） |
| #box-list 壳 | 区块 | index.html 舊 368-377 | 已验证 |
| gl:* 事件 | scope 事件 | 67254-67280 | 已验证（挂 bodyScope） |
| generateItem/getItem 盒模板 | 模板生成 | 66524-66963 | 已验证 |
| onLayoutComplete / LazyLoadManager 注册 | 行为 | 67140-67225 | 已验证 |
| scroll 百分比恢复 + smoothScrollTo | 行为 | 67045-67140 | 已验证 |
| box 选择链路（委托 mousedown→select）| 行为 | 21918-21942 | 已验证（data-box-id 不依赖元素 scope） |
| vsGridRepeat | directive（独立模块）| 14686-15113 | 待办（使用点待勘察） |
| vsRepeat | directive（独立模块）| 16865-17425 | 已验证（侧栏/tags/folders 用法等效替代） |
| vsAutoScroll | directive | 69856-69904 | 已验证（阶段2） |
| lazyImgContainer / infiniteScroll | directive | 70461/70505（被注释）| 无需移植 |
| imageonload | directive | 70763-70781 | 待办 |
| retryWhenError | directive | 70198-70224 | 已验证（阶段5 随详情模板移植） |
| retryWhenThumbError | directive | 70224-70250 | 已验证（阶段5 随详情模板移植） |
| tgaImg | directive | 70250-70326 | 已验证（阶段5 随详情模板移植） |
| extIcon | directive | 70817-70837 | 待办 |
| boxContainerScrollbar | directive | 73114-74147 | 待办（与 ig 全局耦合） |

---

## 5. 详情模式与查看器（bitmap-viewer / media-element / 详情布局）

> **已验证并接管**（2026-08-30）。
> - 接管方式：index.html 387-928 行旧模板整块删除（index.html 由 1671 行减至 1148 行），
>   `.content-panel.detail-mode` 壳保留（ng-show / 左右边距插值 / 壳级 ng-dblclick /
>   ng-mousedown 仍由 Angular 驱动）。壳内新增三个静态宿主：
>   `#eagle-detail-host`（工具列/gif footbar/tips/too-big/not-support/inline）、
>   `#detail-container`（**元素身份永不重建** —— smoothZoom 初始化时会把该元素 wrap 进
>   `.smooth_zoom_preloader`（container/image_url 均为空默认值 → `$image` 即容器本身，
>   bundle:10814 + 11804），若 React 重建将破坏包裹关系与 `#bitmap-viewer canvas` 签名）、
>   `#eagle-detail-cropsize-host`（#crop-size）。
> - portal 内容全部是 Fragment；`#detail-container` 的 ng-class → `applyNgClassSet`
>   差量应用（不碰 smoothZoom/controller 加的 zooming 等类）；ng-click=onDetailClick 由
>   effect 绑回；ng-show 全部转 style.display 等价（不摘节点）。
> - 关键架构事实（勘察 2026-08-29）：`window.$bodyScope` = body scope = EagleController scope
>   （bundle:66508-66510）；`useMpvPlayer` 的唯一消费方是 React 快照，事件回调直接写 body scope；
>   commentVideo 指令仅供 inspector-annotations.html（阶段6）使用，不在本阶段范围；
>   rectSelect 实为内容网格框选（绑 #box-container），已按 PROGRESS 归属移植。
> - 全局契约保持：window.debounce/throttle/guid/AnnotationPreview/videoHelper/FileUrlHelper/
>   preferences/analytics/electronLog 为 bundle/global.js 的 var（window 属性，直接消费）；
>   `currentWindow`/`URL_MODULE`/`pjson` 为 bundle const/let（非 window 属性），React 侧经
>   `window.require` 等价获取；pluginView 的 `let pluginWebView` 单例不可达，React 侧建等价单例。
> - 闭环：react-stage5-smoke 19/19（静态壳/进详情/工具列/image 分支/smoothZoom 包裹保持/
>   detail-delivery 释放/滑条快照联动/退出复位；截图留档 react-stage5-list.png）；旧全量
>   （react-stage-smoke 全绿 + video-detail-mode-closed-loop + preview-delivery-closed-loop +
>   source-mode-ui + library-switch-ui + drag-start + main-ui-workflow（detailDelivery=canvas
>   交付）+ api-smoke 13/13）。tsc 零错。
> - 环境既有怪癖（非回归）：详情模式下 Page.captureScreenshot 会长时间挂起 —— 旧版 Angular
>   模板同样复现（stash 后复验），测试中详情截图限时降级 WARN，列表模式截图正常留存。


| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| mediaElement | directive（独立模块 mediaElement）| 64843-65684 | 已验证（useMediaElement） |
| mpvMediaElement | directive（独立模块 mpvMediaElement）| 65684-66094 | 已验证（useMpvMediaElement） |
| audioMediaElement | directive | 66094-66496 | 已验证（useAudioMediaElement） |
| commentVideo | directive | 70781-70817 | 待办（归属阶段6：仅 inspector-annotations.html 消费） |
| commentItem | directive | 72215-72353 | 已验证（useCommentItem） |
| commentsContainer | directive | 72353-72439 | 已验证（useCommentsContainer + removeComment） |
| rectComment | directive | 72439-72564 | 已验证（useRectComment） |
| rectSelect | directive | 72564-72799 | 已验证（useRectSelect；实为网格框选，绑 #box-container） |
| drawboard | directive（源码镜像）| app.bundle 未注册（见 js/directives/drawboard.js）| 无运行时引用（bundle 未注册，无旧引用可删） |
| cropImage | directive | 71520-72215 | 已验证（useCropImage） |
| mouseGesture | directive | 70837-71140 | 已验证（useMouseGesture；详情模板 2 处使用点） |
| notSupportPreview | directive | 61393-61419 + 模板 | 已验证（NotSupportPreview；详情模板唯一消费点） |
| webviewToolbar | directive | 64319-64398 + 模板 | 已验证（WebviewToolbar；详情工具列唯一消费点） |
| pluginView | directive（独立模块 pluginView）| 17598-17719 | 已验证（PluginView + React 侧 webview 单例） |
| webView | directive | 64240-64318 | 已验证（WebViewBranch；URL 分支） |
| tifImg | directive（阶段4 遗留）| 16580-16668 | 已验证（useTifImage） |
| 详情工具列/footbar/tips/too-big/inline | index.html 模板 | 387-634 | 已验证（DetailToolbar/GifFootbar/DetailFloatingBits） |
| 查看分支 ×13 + comments ×变体 | index.html 模板 | 646-924 | 已验证（DetailViewer/DetailContainerInterior） |

详情模式对应 index.html `#detail-container` / `#bitmap-viewer` 区块。

---

## 6. 检查器（inspector / inspector-*）

> **已验证并接管**（2026-08-30）。
> - 接管方式：index.html 中旧 `<inspector ...>` 元素整块替换为静态宿主 `#eagle-inspector-host`。
>   React 渲染完整 `.inspector` 树（规范 = js/directives/inspector.html + inspector-tags/
>   folders/annotations/information/plugin.html 逐字转写）。
> - 派生逻辑转写（components/inspector/inspectorActions.ts）：updateSelection（30ms debounce，
>   UPDATE_INSPECTOR/选中变化触发）、imagesChange、urlChange（200ms debounce）、annotationChange、
>   分类名/描述 1s debounce、tagsInputMouseDown 右键菜单、openHelpContextMenu、批注 7 函数、
>   onInspectorResize（resizable="w" = jQuery resizable handles 'w'/min 200/max 600）。
> - contenteditable 指令（15619-15834）移植为共享组件 ContentEditable（$render/blur 清洗/
>   linkify/keydown 特例 + editable-selectall 的 Mousetrap mod+a/esc）；后续阶段复用。
> - 数据面：eagle.inspector 全局对象仍是唯一可写缓冲（快照只读投影）；TagManager/folderMappings
>   事件回调取活对象；`is`/`ContextMenu`/`emojiRegex`/`remainingFilenameLength` 等 bundle 闭包内
>   绑定以等价方式替代（window.is 探测/同通道广播/同正则/req 加载），通道与语义零改动。
> - 闭环：react-stage6-smoke 13/13（壳/旧元素删除/宽度快照/corner-btns/SIDEBAR 分类名/ITEM 页签
>   #inspector-name/star 数据面/重命名持久化闭环/多选 selected-count；截图留档）。
> - electron/main.cjs --smoke-main-workflow 的 inspector 驱动段由 isolate-scope 改写为
>   body-scope + window.__eagleInspectorActions（测试健康规则：只改写不删除）；改写后
>   MAIN_WORKFLOW_SMOKE_OK（detailDelivery=canvas 全链路绿）。
> - 归属调整：inspectorTagSelectPanel（依赖 TagSelectPanel 类 + vsGridRepeat）、foldersInput、
>   tagsInput 的消费点均不在 #inspector 区块（智能文件夹规则编辑器/文件夹弹窗/独立面板岛），
>   移入阶段7 表。
> - 全量回归：react-stage-smoke、react-stage5-smoke、main-ui-workflow、source-mode-ui、
>   library-switch-ui、drag-start、preview-delivery、api-smoke 13/13 全绿；tsc 零错。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| inspector | directive | 54273-55301 | 已验证（Inspector + inspectorActions） |
| inspectorTags | directive | 55301-55309 | 已验证（InspectorTags） |
| inspectorFolders | directive | 55309-55317 | 已验证（InspectorFolders） |
| inspectorAnnotations | directive | 55317-55325 | 已验证（InspectorAnnotations + 批注排序） |
| inspectorInformation | directive | 55325-55439 | 已验证（InspectorInformation） |
| inspectorPlugin | directive | 55439-55447 | 已验证（InspectorPlugin + hidePluginMap） |
| inspectorPluginView | directive（独立模块 inspectorPluginView）| 17720-17873 | 已验证（InspectorPluginView） |
| commentVideo | directive | 70781-70817 | 已验证（useCommentVideo） |
| extIcon | directive | 70817-70837 | 已验证（ExtIcon；预览 noPreview 分支） |
| contenteditable | directive（独立模块）| 15619-15847 | 已验证（ContentEditable 共享组件） |
| editableSelectall | directive | 70614-70641 | 已验证（并入 ContentEditable） |
| resizable | directive | 70423-70440 | 已验证（.inspector 宽度拖拽） |
| retryWhenThumbError | directive | 70224-70250 | 已验证（预览缩图重试） |
| inspectorTagSelectPanel | directive | 57911-58122 | 移入阶段7（消费点为独立面板岛，依赖 TagSelectPanel/vsGridRepeat） |
| foldersInput | directive | 64399-64443 | 移入阶段7（消费点=智能文件夹规则编辑器） |
| tagsInput | directive | 64443-64560（模板 index.html 943-956 区）| 移入阶段7（同上） |

---

## 7. 弹窗 / 右键 / 标签 / 面板

> 本阶段体量大，按可验证子单元推进（同阶段3a/3b 先例）：**7a 右键菜单体系（已提交）→
> 7b tagManager + 面板族 → 7c 弹窗族 + 内联控制器弹窗**。

> **7a 已验证并接管**（2026-08-30）。
> - 接管方式：index.html 旧 `<context-menu theme="theme">` 岛替换为 `#eagle-context-menu-host`；
>   React 渲染 .context-menu + .context-menu-overlay（context-menu.html / context-menu-items.html /
>   context-menu-emoji-items.html 逐字转写，含递归子菜单、搜索拼音过滤、sortable、emoji/色板 role）。
> - 开合通道零改动：ContextMenu.open/close → $rootScope 广播 CONTEXTMENU.OPEN/CLOSE；
>   autoPositionContextMenu 指令（16350-16393）与 onErrorSrc（15869）同步移植；
>   fuzzyMatch filter（19951）= fuzzy_match(label, keyword)——顺带修正 Toolbar 搜索提示的参数序。
> - 教训：jQuery 包装调用必须走 $()(el) 双调用形式（$ 是返回 jQuery 的工厂），否则拿到的是
>   构造函数本身（`.off is not a function` 且整棵 React 树因渲染异常卸载）。
> - 闭环：react-stage7a-smoke 15/15（壳/真实右键链路 openItemContextMenu/自定义菜单点击回调/
>   keepOpen+checked 翻转/子菜单 down→right 开合/搜索过滤/overlay 关闭；截图留档）。
>   全量回归：react-stage-smoke、stage5、stage6、main-ui-workflow、source-mode-ui、drag-start、
>   api-smoke 全绿；tsc 零错。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| contextMenu | directive（独立模块 contextMenu）| 15887-16348 + context-menu.html | 已验证（ContextMenuPanel） |
| contextMenuItems | directive | 15848-15867 + context-menu-items.html | 已验证（MenuItems 递归组件） |
| contextMenuEmojiItems | directive | 16396-16582 + emoji 模板 | 已验证（EmojiItems 静态组） |
| autoPositionContextMenu | directive | 16350-16393 | 已验证（SubmenuPane effect） |
| onErrorSrc | directive | 15869-15879 | 已验证（MenuImage） |
| fuzzyMatch filter | filter | 19951-19960 | 已验证（随 7a；并修正 Toolbar 调用参数序） |

> **7b 已验证并接管**（2026-08-30）：tagManager + tagSelect。
> - 接管方式：index.html 旧 `<tag-manager>` 岛（sidebar 内）替换为 `#eagle-tag-manager-host`；
>   React 渲染 #tag-manager 全树（tag-manager.html 逐字：侧栏 ALL/UNFILED/STARRED/群组 +
>   vs-repeat 虚拟列表 + 三种空态）。
> - tagSelect 指令（72799-73001，标签橡皮筋多选）逐字移植为 useTagSelect——tagItems 位置
>   由 displayData 几何计算（非 DOM 测量），写 selectedTags/selectingTags 到 body scope。
> - 虚拟滚动复用 useVirtualWindow（vs-repeat 26/excess 30/vs-size=size → 行 size 累计）；
>   scroll-position-saver 以 sessionStorage 轻量移植；群组 ui-sortable（stop 内 saveFolder/
>   calculateTags 侧效）与侧栏 resizable="e"（onTagSidebarResize）已移植。
> - 闭环：react-stage7b-smoke 10/10（壳/视图切换/标签行渲染/名称一致/selectTag 数据面/
>   UNFILED 切换/空态隐藏/建群组输入框；截图留档）。全量回归全绿（见下）。

| tagManager | directive | 55447-55472 + tag-manager.html | 已验证（TagManagerPanel） |
| tagSelect | directive | 72799-73003 | 已验证（useTagSelect） |

> **7c-1 已验证并接管**（2026-08-30）：小弹窗族。
> - 接管方式：index.html 七个岛（layout-panel / mousewheel-setting-modal / folder-password-modal /
>   notification-modal / welcome-page / new-version-notification-modal / about-panel）全部替换为
>   React 宿主（#eagle-*-host）；模板逐字转写（components/stage7/SmallPanels.tsx）。
> - 触发通道零改动：OPEN_LAYOUT_PANEL / OPEN_MOUSEWHEEL_PREFERENCE_WINDOW / SET-FOLDER-PASSWORD /
>   OPEN_NOTIFICATION / OPEN_ABOUT_PANEL 广播 + show-update-message / app-status-welcome /
>   app-status-library-dirs-loaded / app-status-library-cache-loaded ipc。
> - 数据面断言：mousewheel save 写 $root.preferences.habits（scrollBehavior/scrollBehaviorTour）；
>   folder password 保存写 folder.password=btoa(新密码)（new/change/reset 三模式 + 抖动提示）。
> - 教训：ng-class '{open: isOpen}' 转写时不能只转 display —— CSS 依赖 .open 类控制可见性。
> - notificationBtn（54236-54273）无 index.html 消费点（无 attribute 使用），标记无运行时引用。


> **重大环境发现（shims 竞态，已修复）**：frontend/public/shims.js 用固定 250/300/350ms 定时
> 发射 initial / app-status-loading / preload-library，而 bundle 的 app-status-loading 监听器
> 是在 initial 处理器内部（bundle:22664→22722）同步注册的——页面 bootstrap 慢于 ~300ms 时
> 两个事件双双丢失，sanitize/tinyPinyin/fse 等 require 永不执行（rename 依赖 sanitize；
> main-ui-workflow 的偶发缩略图超时同源）。修复：shims 改为轮询 window.$bodyScope 就绪后
> 再按序发射（兜底 10s）。修复后 main-ui-workflow 首跑即绿。
> **7c-2 已验证并接管**（2026-08-30）：quickSearchModal。
> - 接管方式：index.html 旧 `<quick-search-modal class="modal-flex-center">` 岛替换为
>   `#eagle-quick-search-host`（宿主保留 modal-flex-center 类）；React 渲染
>   #quick-search-panel + .quick-search-overlay 两个模板根（quick-search-modal.html 逐字）。
> - 触发通道零改动：OPEN_QUICK_SEARCH_MODAL / CLOSE_QUICK_SEARCH_MODAL 广播（sidebar J 按钮
>   与 Mousetrap 'j' 仍走 body scope 的 openQuickSearch/closeQuickSearch）。
> - isolate scope 语义逐条对齐：模板里 folderList/tags/smartFolderList/all 在原版 isolate
>   scope 上不可达 → tab 计数 span 恒为 ng-show=false（React 侧保持隐藏形态）；
>   $parentScope 一律经 getBodyScope() 调活对象。
> - 拼音/模糊搜索原样移植：chineseConvert/pinyinlite/cartesianProduct/String.score/
>   fuzzy_match；pinyinlite 与 cartesianProduct 为 bundle 闭包 require，React 侧经
>   window.require(appRoot.path + '/my_modules/...') 等价加载。localStorage 键
>   eagle.quickSearch.history/.folder.history/.smartFolder.history 原样。
> - scrollToActive 指令（70641-70672）等价移植为 useScrollToActive（.active-item 不完整
>   可见时对齐；TAGS 无 enable 恒启用但无 .active-item 天然空转）；vs-repeat 复用
>   useVirtualWindow。searchMode 与 keyword 跨打开持久（原版 isolate scope 行为）。
> - 教训：ng-show 布尔转写多包一层 `!` 会把空态显隐整体反转（结果非空时空态反而显示），
>   CDP 断言 `["flex","flex"]` + 结果项数暴露；表达式必须逐字对照。
> - **tagPopup 定性为死代码**：js/controllers/tag-popup.js 未被 index.html 加载
>   （controllers/ 无 script 引用），TagPopupController/tagsPopupDraggable/tagInputTrigger
>   在 bundle 中 0 次注册，#tags-popup 无任何模板消费点（仅 CLOSE-TAGS-POPUP 广播与
>   TagManager.focusTag 的 #tags-popup 查询为无害 no-op）。与 notificationBtn 同处理。
> - 闭环：react-stage7c2-smoke 26/26（壳/广播开合/自动聚焦/keyword 清空/FOLDERS 扁平列表/
>   计数 span 隐藏/↓↑ active/拼音过滤/Enter openFolder 数据面+双 localStorage 历史/Tab 循环
>   TAGS 渲染+Enter openTag viewMode='all'/SMARTFOLDERS 空态/ITEMS 缩略图+meta 文件夹链接/
>   Esc currentFocus/overlay 关闭；截图留档）。全量回归全绿：react-stage-smoke/5/6/7a/7b/7c、
>   main-ui-workflow、source-mode-ui、library-switch-ui、drag-start、preview-delivery、
>   api-smoke 13/13；tsc 零错。

| quickSearchModal | directive | 60788-61393 | 已验证（QuickSearchModal） |
| tagManager | directive | 55447-56356 | 已验证（7b TagManagerPanel） |
| folderSelectPanel | directive | 56356-57911 | 待办（7b） |
| generalTagSelectPanel | directive | 58122-58257 | 待办（7b） |
| inspectorTagSelectPanel | directive | 57911-58122 | 待办（7b；依赖 TagSelectPanel 类/vsGridRepeat） |
| tagSelect | directive | 72799-73003 | 待办（7b） |
| batchSavePanel | directive | 58257-59288 | 待办（7b） |
| batchRectSelect | directive | 59288-59423 | 待办（7b） |
| duplicateModal | directive | 59423-59705 | 待办（7b） |
| duplicateScanPanel | directive | 59705-60104 | 待办（7b） |
| mergeEditor | directive | 60104-60358 | 待办（7b） |
| batchRenameModal | directive | 76783-77785 | 待办（7c） |
| folderPasswordModal | directive | 62888-63049 | 已验证（FolderPasswordModal） |
| mousewheelSettingModal | directive | 63049-63078 | 已验证（MousewheelModal） |
| aboutPanel | directive | 63078-63102 | 已验证（AboutPanel） |
| notificationBtn | directive | 54236-54273 | 无运行时引用（index.html 无消费点） |
| notificationModal | directive | 62777-62814 | 已验证（NotificationModal） |
| newVersionNotificationModal | directive | 62814-62888 | 已验证（NewVersionModal） |
| welcomePage | directive | 63102-63187 | 已验证（WelcomePage） |
| layoutPanel | directive | 62723-62777 | 已验证（LayoutPanel） |
| selectAll | directive | 70600-70614 | 待办（7c 小指令族） |
| noSpecialChar | directive | 70567-70600 | 待办（7c 小指令族） |
| ngRightClick | directive | 70544-70559 | 待办（7c 小指令族） |
| ngLongClick | directive | 70737-70750 | 待办（7c 小指令族） |
| ngHoverIntent | directive | 70750-70763 | 待办（7c 小指令族） |
| autoFocus | directive | 73003-73018 | 待办（7c 小指令族） |
| repeatDone | directive | 70559-70567 | 待办（7c 小指令族） |
| colorPicker | directive | 70388-70423 | 待办（7c 小指令族） |
| yaNoUiSlider | directive（独立模块）| 17425-17598 | 待办（7c 小指令族） |
| ngFlatpickr | directive | 见源码 | 待办（7c 小指令族） |
| tagsInput | directive | 64443-64560 | 待办（7b，随智能文件夹规则编辑器） |
| foldersInput | directive | 64399-64443 | 待办（7b，同上） |
> **7d-1a 已验证并接管**（2026-08-30）：AddToFolderController + MoveFolderController。
> - 接管方式：index.html 411-616 行两个 `ng-controller` 区块（模板内联）整体删除，替换为
>   `#eagle-add-to-folder-host` / `#eagle-move-folder-host`（保留 modal-flex-center）；
>   React 组件 components/stage7/FolderModals.tsx 逐字转写（AddToFolderModal 74733-75636 +
>   MoveFolderModal 75637-76134）。
> - 触发通道零改动：OPEN-ADD-FOLDER-MODAL（body scope addToFolders）/ OPEN-MOVE-FOLDER-MODAL
>   （body scope moveFolders）广播；autoFocus 指令（事件→100ms click+focus+select）移植。
> - 树数据 cloneTree（8207 逐字）与外界隔离；拼音/模糊筛选（filterFolders 打分版 +
>   $filter('filter') 谓词版）逐字（含过滤时原地改 isExpand 的副作用）；guidelines/styles
>   计算、↑↓←→/Esc/Enter(meta+save) 键盘链、最近使用文件夹（recentMoveFolders localStorage，
>   cap 50）、createFolder 行、electron 原生 Menu 新建子/同级文件夹（@electron/remote）、
>   swal 输入与确认（window.swal，bundle 内嵌 SweetAlert2 v6）全部保留。
> - save() 数据面零改动：ig.remove（window.ig）、body scope updateFilterCounts/
>   getSelection/smartZoom/leaveDetailMode、ayncsImagesChange（window.backgroundWindowID，
>   bundle 顶层 var→window 属性）+ hiddenByCurrentFilter（filterData/contentFilter/
>   gl:removeItems/smartFolderCount）均逐字移植；notify 恢复回调、CALCULATE_IMAGE_BINDING /
>   REBIND_REFRESH / UPDATE_SELECTION 广播、analytics/electronLog 不变。
> - MoveFolder 语义保留：源文件夹行 disabled（isVisible 抑制仅作用于子级——原版如此）、
>   top/inner/bottom 三区点击 → swal 确认 → body scope moveFoldersAsSibling/moveFoldersToFolder。
> - 教训：模板 `{{::folderList.length}}` 经原型链取 body scope folderList 且一次性绑定在
>   bootstrap 期即定型（恒为 0），按原样保留 "(0)" 形态。
> - 闭环：react-stage7d1a-smoke 23/23（壳/旧块删除/广播开合/树渲染/existsFolders 预勾选/勾选
>   翻转/save 数据面+recentMoveFolders/最近使用行/过滤/createFolder 行/Esc/复选框持久化/
>   MoveFolder disabled 行/swal 确认/moveFoldersAsSibling 数据面/截图留档）。
>   全量回归全绿：react-stage-smoke/5/6/7a/7b/7c/7c2、main-ui-workflow、source-mode-ui、
>   library-switch-ui、drag-start、preview-delivery、api-smoke 13/13；tsc 零错。
> - 环境协议：串行跑多测试必须在每个测试之间 clear-ports + 杀 electron，否则上一个测试的
>   vite 残留会让下一个 bootStack 静默挂起。

| NewSmartFolderController | controller | 74323-74733（模板 index.html 641-964）| 待办（7d-1c） |
| AddToFolderController | controller | 74733-75637（模板 index.html 411-544）| 已验证（7d-1a AddToFolderModal） |
| MoveFolderController | controller | 75637-76136（模板 index.html 545-617）| 已验证（7d-1a MoveFolderModal） |
| ErrorModalController | controller | 76136-76464（模板 index.html 965-1013）| 待办（7d-1b） |
| AutoTaggingController | controller | 74190-74323（模板 index.html 618-640）| 待办（7d-1b） |
| WebsitePanelController | controller | 74094-74190（模板 index.html 82-96）| 待办（7d-1b） |
| tagPopup（源码镜像 js/controllers/tag-popup.js）| controller | 源码 | 无运行时引用（tag-popup.js 未加载、bundle 无注册、无模板消费点；7c-2 定性） |

---
## 8. 设置页（preferences.html）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| preferences.js（原文件，非 bundle）| 独立页面 | `src/app/js/preferences.js` | 待办 |
| default-preferences.js | 数据 | `src/app/js/default-preferences.js` | 待办 |

对应 `src/app/preferences.html`（85KB）与 `src/app/style/preferences.scss`。

---

## 9. 其余窗口（preview-window / collect-window / registration / manage-device / progress / thumbnail）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| preview-window.js | 独立页面 | `src/app/js/preview-window.js` (102KB) | 待办 |
| collect-window | 独立页面 | `src/app/collect-window/*` | 待办 |
| registration | 安全替代页 | `frontend/public/replaced/registration.html` | 已删旧实现 |
| manage-device | 安全替代页 | `frontend/public/replaced/manage-device.html` | 已删旧实现 |
| progress.html | 进度窗口 | `src/app/progress.html` | 待办 |
| thumbnail.html | 缩略图窗口 | `src/app/thumbnail.html` | 待办 |
| manage-device.js / registration.js（原版）| 源码镜像 | `src/app/js/manage-device.js` / `src/app/js/registration.js` | 待办 |

---

## 10. 快捷键（shortcut-manager）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| shortcut-manager.js | 服务 | `src/app/js/services/shortcut-manager.js` (296 行) | 待办 |
| shortcutInput | directive（独立模块）| 64490-64843 | 待办 |
| filters shortcuts / shortcutsWrapper | filter | 69574 / 69585 | 待办 |
| wMousetrap | directive（独立模块 mgo-mousetrap）| 16683-16723 | 待办 |

---

## 11. 清理双轨 CSS + 移除 angular.min.js

- [ ] 移除 `js/vendors/angular*.js` 与 `app.bundle.js` 引用（index.html 尾部脚本区）。
- [ ] 双轨 CSS：确认 React 版使用同一套 `css/style_*.css` + `css/app.css`；删除为 React 额外引入的重复样式。
- [ ] `ng-app` / `ng-controller` / 所有 `ng-*` 属性从 index.html / 各 *.html 模板中移除。

---

## 过滤器清单（全量）

| 过滤器 | 规范来源行号 | 状态 |
| --- | --- | --- |
| numberFixedLen | 19823 | 待办 |
| noZero | 19831 | 待办 |
| longTitle | 19840 | 待办 |
| unique | 19849 | 待办 |
| encodeHash | 19889 | 待办 |
| second2time | 19896 | 待办 |
| duration | 19922 | 待办 |
| domainName | 19942 | 待办 |
| fuzzyMatch | 19951 | 待办 |
| encodeURIComponent | 19962 | 待办 |
| encodeURIComponentUrl | 19971 | 待办 |
| i18n | 19979 | 待办 |
| mod | 19991 | 待办 |
| thumbnailExt | 20001 | 待办 |
| substring | 69496 | 待办 |
| sortHSL | 69503 | 待办 |
| numberAbbreviate | 69556 | 待办 |
| shortcuts | 69574 | 待办 |
| shortcutsWrapper | 69585 | 待办 |
| filesize | 69603 | 待办 |
| themePath | 69631 | 待办 |

## 补充清单（进度对话框 / 插件 UI / webview / 其余待办）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| emptyTrashProgress | directive | 63239-63422 | 待办 |
| libraryLoadProgress | directive | 63422-63437 | 待办 |
| libraryMergeProgress | directive | 63437-63528 | 待办 |
| eaglepackImportProgress | directive | 63528-63601 | 待办 |
| eaglepackExportProgress | directive | 63601-63698 | 待办 |
| fileThumbnailProgress | directive | 63698-63707 | 待办 |
| fileExportProgress | directive | 63707-63779 | 待办 |
| fileAddLibraryProgress | directive | 63779-64111 | 待办 |
| debugReportProgress | directive | 64111-64120 | 待办 |
| webpConvertProgress | directive | 64120-64221 | 待办 |
| fixutilProgress | directive | 64221-64230 | 待办 |
| fixutilCleanEmptyFolderProgress | directive | 64230-64240 | 待办 |
| notSupportPreview | directive | 61393-61420 | 已验证（阶段5 随详情接管，详情模板唯一消费点） |
| pluginPanel | directive | 61420-62039 | 待办 |
| pluginCreator | directive | 62039-62179 | 待办 |
| pluginCenter | directive | 62179-62723 | 待办 |
| pluginView | directive（独立模块）| 17598-17720 | 已验证（阶段5 随详情接管；inspectorPluginView 另算） |
| webView | directive | 64240-64319 | 已验证（阶段5 随详情接管，URL 分支唯一消费点） |
| webviewToolbar | directive | 64319-64399 | 已验证（阶段5 随详情接管，详情工具列唯一消费点） |
| websitePanelWebview | directive | 74147-76464 | 待办 |
| artstationImportModal | directive | 76464-76783 | 待办 |
| findStringAutocomplete | directive | 77785-末 | 待办 |
| alwaysFocus | directive | 69688-69704 | 待办 |
| autoScroll | directive | 70697-70737 | 待办 |
| scrollToActive | directive | 70641-70672 | 已验证（7c-2 随 quickSearchModal 移植 useScrollToActive） |
| scrollPositionSaver | directive | 70165-70198 | 待办 |
| typeChecking | directive | 70326-70388 | 待办 |
| autoPositionContextMenu | directive | 独立模块 contextMenu 内 | 待办 |
| ngFlatpickr | directive | 独立模块 angular-flatpickr | 待办 |

## 其他独立 Angular 模块（同包内注册，不依赖 EagleApp）

| 模块 | 说明 | 行号 | 状态 |
| --- | --- | --- | --- |
| vsGridRepeat | 网格复用 | 14686 | 待办 |
| ui.sortable | 排序 | 15113 | 待办 |
| contenteditable | 可编辑 | 15619 | 待办 |
| contextMenu | 右键菜单 | 15847 | 待办 |
| tifImg | tif 图 | 16580 | 已验证（阶段5 随详情接管） |
| mgo-mousetrap | 快捷键 | 16683 | 待办 |
| angular.bind.notifier | notifier | 16723 | 待办 |
| cgNotify | notify | 16724 | 待办 |
| vs-repeat | 虚拟滚动 | 16865 | 待办 |
| tippy | tooltip | 17365 | 待办 |
| ya.nouislider | 滑块 | 17425 | 待办 |
| pluginView | 插件视图 | 17598 | 待办 |
| inspectorPluginView | 检查器插件视图 | 17720 | 待办 |
| shortcutInput | 快捷键输入 | 64490 | 待办 |
| mediaElement | 媒体元素 | 64843 | 待办 |
| mpvMediaElement | MPV 媒体元素 | 65684 | 待办 |
