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

> **7d-1b 已验证并接管**（2026-08-30）：ErrorModalController + WebsitePanelController（含
> websitePanelWebview 指令）。
> - 接管方式：index.html 旧 `#website-panel` 块（81-101）与 `ErrorModalController` 区块
>   （762-810）删除，替换为 `#eagle-website-panel-host` / `#eagle-error-modal-host`；
>   React 组件 components/stage7/ControllerModals.tsx 逐字转写。
> - ErrorModal：OPEN_ERROR / CLEAN_ALL_ERROR 广播通道不变；错误列表保留生产方数组引用
>   （remove/retry 直接 splice，开启期 500ms 轮询同步——原版由 digest 驱动）；retryAll 三分支
>   （DOWNLOAD_ERROR → ipc 'upload-urls'、ADD_ERROR → body uploadFiles、EDIT_ERROR →
>   itemMappings 原地 extend + updateItemView/ayncsImagesChange）逐字；copyAll →
>   sendTo(backgroundWindowID,'copy-paths-to-clipboard')；cleanAll swal 确认。
> - 教训：原版 ErrorModalController 的 `rootScope` 变量实为 body scope
>   （angular.element("body").scope()），EDIT_ERROR 分支必须取 body scope 而非 $rootScope。
> - WebsitePanel：显示条件 viewMode=='community' + isUILoaded 经 sidebarState 快照；
>   left=containerSize.sidebar+1（快照 sidebarWidth 即该值）；webview 指令行为
>   （dom-ready 主题注入 / page-title-updated 标题+前进后退禁用态）逐字；
>   OPEN_URL_IN_PANEL → src 设置（community- 守卫）+ isOpenWebpagePanel。
> - **测试基建修复（harness）**：stop(stack) 原来只认 `.child` → 对 bootStack 返回对象是
>   no-op，electron/backend/vite 全部成为孤儿且 stdio 管道拖住测试进程不退出；现改为依次
>   关闭 CDP ws + 杀三子进程 + 销毁管道。7c2/7d1a/7d1b 测试 finally 补 process.exit
>   （undici keep-alive socket 拖事件循环）。
> - 闭环：react-stage7d1b-smoke 19/19（壳/广播开合/两错误行结构/remove/EDIT retryAll 数据面/
>   CLEAN swal 确认/面板显隐/left 偏移/webview src + isOpenWebpagePanel/截图留档）。
>   全量回归全绿：react-stage-smoke/5/6/7a/7b/7c/7c2/7d1a/7d1b、main-ui-workflow
>   （markdown 缩略图计数偶发竞态复现，重跑即绿——既有问题）、source-mode-ui、
>   library-switch-ui、drag-start、preview-delivery、api-smoke 13/13；tsc 零错。

> **7d-1c 勘察（2026-08-30；7d-1c-1 已完成，7d-1c-2 待做）**：NewSmartFolderController + tagsInput/foldersInput +
> SelectPanel 面板族。依赖图谱与行号（当前 index.html 行号，已因 7d-1a/1b 删块偏移）：
> - 模板：index.html 420-745（`ng-controller="NewSmartFolderController"`，smart-folder-modal，
>   含 ng-flatpickr 日期规则 666-667、tags-input 717、folders-input 721）。
> - 控制器：NewSmartFolderController = bundle 74323-74733（模板数据 smartFolderScope、
>   规则编辑器 changeValue/save/cancel 等）。
> - tagsInput 指令 = bundle 64443-64489（模板 js/directives/tags-input.html，replace:true，
>   isolate scope {theme, tags, onChange}；点击 → GeneralTagSelectPanel.open({tagManager,
>   selectedTags, onChanged})；remove → tags.splice + onChange）。
> - foldersInput 指令 = bundle 64399-64442（folders-input.html；点击 → FolderSelectPanel.open
>   ({folders, selectedIds, onChanged: result.isDirty → selectedFolderIds})）。
> - SelectPanel 体系（OOP）：SelectPanelSearchInput = 55466-55575；SelectPanel = 55575-55801；
>   FolderSelectPanel extends SelectPanel = 55801-56356；TagSelectPanelItem = 56438-56479；
>   TagSelectPanel extends SelectPanel = 56479-56911 附近（其后到 generalTagSelectPanel 58122
>   之前是 batch 相关类，具体边界待读）；generalTagSelectPanel 指令 = 58122-58257（isolate
>   scope {TagManager, selected, theme}，new TagSelectPanel({showCreateTagBtn:false, fixedSize:true,
>   panelSelector:'general-tag-select-panel .tag-select-panel', searchInputSelector:'general-tag-select-panel
>   .panel-header input'})）+ 模板 js/directives/general-tag-select-panel.html。
> - inspectorTagSelectPanel = 57911-58122（依赖 TagSelectPanel + vsGridRepeat 14686-15113）。
> - 消费方：AutoTagging（74190-74323，FOLDER_SETTINGS 广播，模板 index.html 416-435 附近）
>   依赖 tagsInput；batchSavePanel 58257-59288 依赖上述面板类。
> - 建议子单元顺序：7d-1c-1（tagsInput + GeneralTagSelectPanel + TagSelectPanel/SelectPanel
>   类，先让 AutoTagging 完整）→ 7d-1c-2（foldersInput + FolderSelectPanel + NewSmartFolder
>   模板/控制器，含 ng-flatpickr 日期规则的 React 等价——flatpickr 库在 bundle 17395-17417 内联，
>   window.Flatpickr 可用性待验证；可先用 window.Flatpickr 直接驱动）。
> - ng-flatpickr 指令本体在 bundle ~17417-17425（angular-flatpickr 包装，读源码确认 API）。

> **7d-1c-1 已验证并接管**（2026-08-30）：tagsInput + generalTagSelectPanel（TagSelectPanel
> 体系）+ AutoTaggingController。
> - 接管方式：index.html 旧 AutoTaggingController 区块与 `<general-tag-select-panel theme>` 岛
>   删除，替换为 `#eagle-auto-tagging-host` / `#eagle-general-tag-select-panel-host`；React 层
>   components/stage7/selectPanelEngine.ts（纯类）+ SelectPanels.tsx（组件）。
> - 引擎逐字移植：TagSelectPanelItem（56438-56477）、SelectPanelSearchInput（55466-55572，
>   enter/esc keydown+keyup 状态机）、SelectPanel 基类（55575-55800，含 #moveToCursorPosition
>   鼠标定位与 retry）、TagSelectPanel（56479-57910 全部方法：initRawData/updateTagsState/
>   updateItemList 排序分组/filterByKeyword 拼音打分/sortByKeywordSimilarity Levenshtein/
>   selectUp-Down-Left-Right 网格导航/onTabKey 侧栏群组循环/openItem 选中翻转+createdTags/
>   onPaste 批量建标/设置面板开关与 localStorage 持久化）。scope.$evalAsync → notify 回调。
> - vsGridRepeat 指令（14686-15106）移植为 useVsGridRepeat：calculateColumns/Positions、
>   binarySearch 可见窗口（extraRange 500）、grid-placeholder 高度、scrolling class、
>   ResizeObserver、render 事件（jQuery trigger）——可见项差分渲染交由 React。
> - generalTagSelectPanel 指令（58122-58256）：GENERAL.TAG.SELECT.PANEL.OPEN 广播监听
>   （init 10ms + open 0ms 原时序）、jQuery UI draggable/resizable（尺寸持久化
>   eagle.tagsPopup.height/width）、窗口 resize 补位；GeneralTagSelectPanel 类（58115）
>   → openGeneralTagSelectPanel 助手。模板 general-tag-select-panel.html 逐字（侧栏群组、
>   网格项、footer 快捷键、设置面板）。
> - tagsInput（64443-64489 + tags-input.html）：点击 → GeneralTagSelectPanel.open、onChanged
>   经 '=' 双向绑定语义写回（onTagsReplace 替换父级数组引用）、remove splice + onChange。
> - AutoTaggingController（74190-74316 + 模板）：FOLDER_SETTINGS 广播、nameKeydown
>   (Esc/meta+Enter)、save（folder.name/tags 原地改 + isInFolder 子树加速 + raw 遍历
>   image.tags 去重 + ipc 'image-change' + SAVE_FOLDER/CALCULATE_IMAGE_BINDING/
>   UPDATE_SELECTION 广播）、input tabindex 101/-1 游戏。
> - **重大教训（复现 7a）**：`$` 是返回 window.jQuery 的工厂——引擎里 `$(selector)` 直接
>   `.off()` 抛 TypeError，React 19 静默卸载整棵树（onUncaughtError 默认只 console.error，
>   不触发 window error 事件）→ boot 连锁断裂（$bodyScope 由 React BoxList 挂载设置，树死则
>   shims 等不到 → boxes 永不渲染）。必须 `$()(selector)` 双调用。诊断手段：createRoot
>   临时挂 onUncaughtError + addScriptToEvaluateOnNewDocument hook console.error。
> - 测试契约：window.__eagleTagSelectPanel 暴露面板实例；冒烟需在面板 open 后等 init
>   （setTimeout 10ms）再发键盘（delay 300）。
> - 闭环：react-stage7d1c1-smoke 16/16（壳/广播开合/网格渲染+预选/键盘导航与翻转/
>   Esc onChanged 数据面（isDirty+deselectedTags）/AutoTagging 弹窗/tags-input 回写/
>   save 数据面 folder.name+tags；截图降级 WARN——面板态截图怪癖）。全量回归 15/15 全绿
>   （stage/5/6/7a/7b/7c/7c2/7d1a/7d1b/7d1c1 + main-ui-workflow 首跑即绿 + source-mode-ui +
>   library-switch-ui + drag-start + preview-delivery）+ api-smoke 13/13；tsc 零错。

> **7d-1c-2 已验证并接管**（2026-08-30）：folderSelectPanel + foldersInput +
> NewSmartFolderController。
> - 接管方式：index.html 旧 NewSmartFolderController 区块（399-720）与
>   `<folder-select-panel theme>` 岛删除，替换为 `#eagle-smart-folder-host`
>   （保留 modal-flex-center）/ `#eagle-folder-select-panel-host`；React 层
>   components/stage7/FolderSelectPanels.tsx（组件）+ selectPanelEngine.ts 追加
>   FolderSelectPanel 类（55801-56356 逐字，extends 基类并适配 selectUp/selectDown/
>   hoverItem/scrollTop → *Base 委托、onLeftKey/onRightKey 改字段形式以兼容基类属性声明）。
> - **vs-repeat 垂直虚拟化移植**（bundle 16736-17394 → useVsRepeat）：Eagle 改版 sizes
>   计算（`item.size || elementSize`）、sizesCumulative 前缀和、startIndex/endIndex 窗口
>   （excess/2 收缩扩展）、slice(endIndex+5) preload、before/after 占位 div
>   （min-height，插入为首/末子元素）；scroll 节流 33ms（leading+trailing）+
>   window resize 防抖 200ms；digestRequired 分支省略（React 重渲染即最新值）。
>   vs-auto-scroll（69856-69900）→ useVsAutoScroll：$watch(index) 语义（变化才滚动）、
>   三分支滚动定位、jQuery scrollTop(undefined) 为 getter no-op 的守卫。
> - **教训（ng-click digest 等价）**：面板实例方法经 DOM 事件（openItem/changeTab/
>   toggleExpand/hoverItem/close 遮罩）调用后必须 bumpAll()——原版依赖 ng-click 后
>   digest，React 不重渲染则 selected/active 类不更新（冒烟 fsp-click-toggled-off 抓到）；
>   键盘路径已由 SelectPanelSearchInput 回调内 notify 覆盖，无需重复。
> - foldersInput（64399-64442 + folders-input.html）：'=' 写回经 onFolderIdsReplace
>   （rule.value 引用替换）、$evalAsync+$timeout → setTimeout 0；folderMappings 为 link 期
>   一次性捕获的 body 引用（对象原地变更故实时）。
> - ng-flatpickr（17416）→ FlatpickrInput：new window.FlatpickrInstance(input, fpOpts) +
>   fpOnSetup({fpItem}) 等价 + 卸载 destroy；`angular.element(instance._input).scope().rule`
>   → `instance._input.__eagleRule`（useLayoutEffect 每渲染刷新，conditions 重建后仍指向
>   正确 rule）；data-enabletime 属性保留 DOM 对齐（flatpickr v3 dataset 合并为小写键，
>   实际 enableTime 不生效——与原版一致）。
> - NewSmartFolderController（74323-74733 + 模板逐字）：NEW.SMART.FOLDER / EDIT.SMART.FOLDER
>   广播（body scope 上监听，rootScope 广播可达）；conditions/rules 原地变异 + ref 持有，
>   recalculateResult 尾部 bumpAll 等价 digest；`$filter('filter')(raw, contentFilter)`
>   （contentFilter 是函数谓词）→ `raw.filter(body.contentFilter)`；ng-model-options
>   debounce（300/blur 0、色板 200/blur 0）→ 模型即时 + recalc 去抖 + blur 冲刷；
>   save 保留两处原版怪癖：edit 分支 `analytics.event(..., smartFolder.name)` 引用函数级
>   提升的未赋值 var → TypeError 被 try/catch 吞掉；`$scope.smartFolderCount` 经 scope
>   原型链解析到 body.smartFolderCount（port 直调 body）。新建后
>   body.createFolder/openSmartFolder/changeSidebarIndex(400ms)/saveFolder 数据面零改动。
> - selectall 指令（70600）：name 输入在 nameKeydown 内联模拟（AutoTaggingModal 同款，
>   Mousetrap 的 stopPropagation 会阻断 React 根委托 onKeyDown，不能用 useSelectAll）；
>   规则文本/数字输入经 SelectAllInput 包装（无其他 keydown 冲突）。
> - 测试契约：window.__eagleFolderSelectPanel / window.__eagleNewSmartFolder（save/cancel/
>   recalculateResult/isOpen/conditions）。swal 建夹冒烟：搜索关键字 → create 项点击 →
>   .swal2-input 设值 → .swal2-confirm 点击 → body.createFolder → onCreatedFolder 重置
>   init 并选中。
> - 闭环：react-stage7d1c2-smoke 29/29（壳/广播开合/预选渲染/点击翻转+Esc onChanged 数据面/
>   搜索建夹 swal→createFolder→onCreatedFolder/NEW.SMART.FOLDER 弹窗/property→tags 面板
>   回写+预览计数/property→folders 面板回写/create 保存 smartFolders 数据面/EDIT 回填改名
>   保存/截图留档）。全量回归 16/16 全绿（stage/5/6/7a/7b/7c/7c2/7d1a/7d1b/7d1c1/7d1c2 +
>   main-ui-workflow + source-mode-ui + library-switch-ui + drag-start + preview-delivery）
>   + api-smoke 13/13；tsc 零错。

> **7d-2 已验证并接管**（2026-08-30）：batchRenameModal + artstationImportModal。
> - 接管方式：index.html `<batch-rename-modal>` / `<artstation-import-modal>` 删除，替换为
>   `#eagle-batch-rename-host`（保留 modal-flex-center）/ `#eagle-artstation-import-host`；
>   React 层 components/stage7/BatchRenameArtstationModals.tsx。规范：artstationImportModal
>   = bundle 76464-76783 + 模板；batchRenameModal = 76783-77785 + 模板 + findStringAutocomplete
>   指令（内联渲染）+ autoFocus 指令（73003-73014）等价。
> - **$exceptionHandler 等价（ngSafe）——重大教训**：mock 环境 shims 的 moment 是 stub
>   （`moment: (value) => new Date(...)`，无 .format），原版 format() 在 try 块外调
>   moment(now).format → **mock 环境每次必抛**，异常经 Angular digest/ng-click 冒泡到
>   $exceptionHandler（console.error 后应用继续，format 预览恒空、format 模式改名不可达）。
>   React 未捕获异常会静默卸载整棵树（7a/7d1c1 教训复现）→ 必须在 $watch/$on/ng-click 等价
>   边界（watch effects、OPEN_RENAME $on、全部 JSX handler）用 ngSafe（try/catch +
>   console.error）包裹，两种环境下行为与原版一致。真实机器 moment 正常时 ngSafe 无感。
> - batchRename：$watch("[newName, startAt]") / $watch("[findString, replaceString]") →
>   useEffect 等价（startAt 经 window.is.number 钳制）；format() 77107-77246 逐字
>   （numberFixedLen 过滤器复用 react/app/filters、moment 经 require、emojiRegex 字面量带入、
>   sanitize/window.is/FileUrlHelper 经 window 等价）；insert* → openAppContextMenu
>   （CONTEXTMENU.OPEN 广播，items/role/showSearch/onClosed 原样）；rename 确认 swal 阈值
>   （IMAGE/FOLDER 10、TAGS 2）；renameImages/Folders/Tags 数据面逐字（deepCopy、
>   ayncsImagesChange/hiddenByCurrentFilter 复用 FolderModals 导出、rootScope.notify 恢复、
>   localStorage BATCH_RENAME_LAST_NAME / BATCH_RENAME_HISTORY_{TYPE}_FIND_STRING）；
>   预览表 tbody vs-repeat（41/30）复用 useVsRepeat（已导出）；原版怪癖保留：isRenaing 拼写、
>   artstation image 字面量 type 重复键（"image" 覆盖 getImageType，TS 侧直写生效值+注释）、
>   aperture between 分支 width: 54\px 无效样式逐字。
> - autoFocus 指令等价：OPEN_RENAME 广播 → $timeout(100) → newName/findString 两输入
>   click+focus+select（DOM 顺序），随后指令自身 setTimeout(200) focus 第一个可见文本输入。
> - artstationImport：IMPORT_ARTSTATION 广播 + ipc 'import-artstation'（getIpc().on）双通道
>   open()（$timeout 300 + focus/select setTimeout 300）；selectFolders → FolderSelectPanel.open
>   回写 importFolders（folder 对象数组）；importUrl/importUrlManual 逐字
>   （electron-referer 经 req('@electron/remote')、Artstation 全局、IMPORT_IMAGES 广播、
>   uploadUrls/uploadQueue/addToRecentFolders 数据面）；vaildateUrl 拼写保留。
> - **测试契约**：window.__eagleBatchRename（isOpen/previews/items）、window.__eagleArtstation
>   （vaildateUrl/urlError/pageUrl/isOpen）。
> - **CDP 测试注意**：(1) 受控输入 setState 同任务异步冲刷——同一 eval 内 input 事件后立刻
>   blur 读不到新值（Angular digest 同步无此差），测试须分 eval；组件侧 onChange 同步写 ref
>   对齐 Angular 模型语义。(2) `el.blur()` 在此 CDP 环境不触发 React 的 focusout 委派
>   （onBlur 绑定正常、手动 `new FocusEvent('focusout', {bubbles:true})` 可触发）——真实用户
>   点击离开焦点时 focusout 自然触发，组件无恙；测试派发 focusout 即可。
> - 闭环：react-stage7d2-smoke 22/22（壳/常驻 modal/IMAGE replace 改名数据面+LAST_NAME/
>   FOLDER replace 改名 folderMappings+历史/空集合守卫/artstation 开合聚焦/url 校验显隐/
>   FolderSelectPanel 选夹回写 option/Esc 关闭/截图留档）。format 模式预览/改名在 mock 环境
>   因 moment stub 不可用（原版一致），冒烟走 replace 分支覆盖 renameImages/Folders 数据面。
>   全量回归 17/17 全绿（…7d1c1/7d1c2/7d2 + main-ui-workflow + source-mode-ui +
>   library-switch-ui + drag-start + preview-delivery）+ api-smoke 13/13；tsc 零错。

> **7d-3a 已验证并接管**（2026-08-30）：inspectorTagSelectPanel。
> - 接管方式：index.html `<inspector-tag-select-panel theme selected tag-manager>` 岛删除，
>   替换为 `#eagle-inspector-tag-select-panel-host`；React 层
>   components/stage7/InspectorTagSelectPanel.tsx（复用引擎 TagSelectPanel + useVsGridRepeat，
>   两者已从 SelectPanels.tsx 导出）。
> - 与 generalTagSelectPanel 的模板差异逐字：pinned class + 置頂/取消置頂按鈕
>   （titlebar.alwayTop.on/off）、無選擇空狀態（inspector.noSelection，panel.isInit &&
>   selected.length===0）+ panel-list hide、select-panel-list 的 list-mode class、
>   setting-panel 無 right:6px、footer switch 快捷鍵 ng-hide（selected.length===0 ||
>   !panel.isShowSidebar）、overlay ng-show=!panel.isPined。
> - 逻辑逐字：INSPECTOR.TAG.SELECT.PANEL.OPEN（body scope $broadcast → body $on；init
>   10ms + open 0ms 原时序）；onAdd/onRemove → TagManager.addTags/removeTag +
>   calculateImageBinding({ignoreSort:true})；$watchCollection('selected')（body scope 上
>   注册，isPined 时 updateSelected：getSuggestTags → 50ms 后 selectedTags ←
>   eagle.inspector.newTags）；initWindowResize（333ms，isPined 分支）/draggable/resizable
>   逐字；ipc 'app-status-loading' → isPined 时 unpin + close。
> - **时序教训（冒烟抓到）**：eagle.inspector.newTags 由 inspector 控制器的选区 watcher
>   （30ms $timeout 防抖）写入，getSuggestTags 本身不写它（只算 folder 名串 +
>   TagManager.suggestions + jieba-extract ipc）——测试须在选区变更与广播之间留 digest
>   时间，同 eval 内广播读到的是空 newTags。mock 环境 TagManager.tags 为空时面板渲染
>   suggest 群组（SUGGEST group）的推荐标签，与原版一致。
> - 顺带修正 7d-1c-1 遗留保真偏差：GeneralTagSelectPanel 侧栏「全部標籤群組」item 缺
>   ng-class active（!listData.sidebarGroup）且多了 ng-show——两处已按模板逐字修正。
> - 测试契约：window.__eagleInspectorTagSelectPanel（面板实例）。面板搜索输入与 general
>   面板重复 id（原版即重复），测试须用元素级选择器
>   inspector-tag-select-panel .panel-header input。
> - 闭环：react-stage7d3a-smoke 10/10（壳/广播开合/预选渲染（suggest 链）/置顶 isPined +
>   pinned class + overlay 隐藏/键盘翻转 onRemove 数据面/Esc 关闭；面板态截图怪癖 WARN）。
>   全量回归 18/18 全绿 + tsc 零错。

> **7d-3b 已验证并接管**（2026-08-30）：batchSavePanel + batchRectSelect。
> - 接管方式：index.html `<batch-save-panel theme folders folder-mappings upload-queue
>   upload-urls add-to-recent-folders tag-manager>` 删除，替换为
>   `#eagle-batch-save-panel-host`；React 层 components/stage7/BatchSavePanel.tsx
>   （含 BatchSaver 类 595-1030 逐字 + batchRectSelect 59288-59423 内联移植）。
> - BatchSaver 逐字：loadTasks/loadOriginal/loadLarge/loadImage（data:image 离线路径 +
>   fetch + 文件头 MIME 嗅探 + Image/Video 元信息）、getSize/getResolution/
>   getContentDispositionType/getExtension、eagle.batchSaver.* 的 getter/setter（localStorage
>   直写）；onChange 用 window.throttle（global.js 同款 throttle(fn, delay, immediate)）。
> - batchRectSelect：jQuery mousedown/mousemove + window mouseup、$rect div prepend 到
>   .gallery、contain 碰撞判定、window.throttle 100ms caculate；原版
>   `angular.element(this).scope().image` → .item DOM 节点挂 __eagleItem（ref callback）。
> - **事件时序教训**：.item 的 select 原为元素级 ng-mousedown（先于 .gallery 祖先上的
>   rect-select jQuery mousedown，且 select 的 stopPropagation 阻止框选启动）；React 根委托
>   会被 .gallery 的 jQuery stopPropagation 拦截（7d-2 教训的姊妹篇）→ 改用
>   onMouseDownCapture（capture 相位先于 gallery bubble stopPropagation；synthetic
>   stopPropagation 透传 native stopPropagation → 框选不启动，与原版一致）。
> - 其余逐字：init（清 body.selected、src 去重、electron-referer、focusInput x2、
>   analytics）/calculateResult（ext/size/domain/keyword 过滤 + <200px 尾置排序 + counts）/
>   selectAll/invertSelected/select(shift 区间)/removeSelected/updateSelectedCount/
>   zoomIn/Out/alt+ctrl 滚轮缩放（jQuery mousewheel.zoomming + window.throttle 50)/
>   onKeyup 全套快捷键（mod+A/Esc/Del/F/T/mod+Enter/+−）/import（重名加序号、reverse、
>   hasLarge 分支、uploadUrls/uploadQueue/addToRecentFolders）/selectFolders（FolderSelectPanel）/
>   selectTags（GeneralTagSelectPanel）/auto-focus OPEN_DUPLICATE 等价。
> - 原版怪癖保留：模板 ng-mousedown="cleanSelected($event)" 的 cleanSelected 在该 isolate
>   scope 未定义（$exceptionHandler 记录后无效果）→ no-op；搜索 ng-model debounce 50/
>   blur 0 → setTimeout 50 等价；advanced 尺寸输入 → batchSaver.filterMinW 等四 setter
>   直写 localStorage + onChange 即算（原版 debounce 300——React 侧即时计算仅提前触发，
>   数据面一致；如需严格可后续补 debounce）。
> - 测试契约：window.__eagleBatchSavePanel（isOpen/items/selected/displayed/counts/tags/
>   importFolders）；uploadUrls 以 body 属性覆盖打桩验证数据面。测试图片须不同 src
>   （init 按 src 去重——原版行为）。
> - 闭环：react-stage7d3b-smoke 14/14（壳/IMPORT_IMAGES 开合/data URL 项渲染+缩略图/点击
>   选中/关键字过滤/FolderSelectPanel 选夹回写/全选 import 数据面（uploadUrls 参数、
>   folderIds、uploadQueue）/Esc 关闭/截图留档）。全量回归 19/19 全绿 + api-smoke 13/13；
>   tsc 零错。

> **7d-4 已验证并接管**（2026-08-30）：duplicateScanPanel + mergeEditor + duplicateModal。
> - 接管方式：index.html `<duplicate-scan-panel>`/`<duplicate-modal>` 删除，替换为
>   `#eagle-duplicate-scan-panel-host`/`#eagle-duplicate-modal-host`；React 层
>   components/stage7/DuplicateFamily.tsx（MergeEditor 子组件 + DuplicateScanPanel +
>   DuplicateModal）。
> - 逻辑逐字：扫描步骤机（INITIAL/SCAN/SCAN-RESULT/MERGE）、scanSame/scanSimilar
>   （$timeout 600 + eagle.duplicateChecker shim + cancellation tokenSource + 进度回调 +
>   timeLeftInSeconds）、initSimilarGroups（分辨率/格式 PNG>BMP>JPG>…/大小排序）、
>   changeSimilarity（100ms 去重 + findSimilarFiles 重算）、toggleGroupSelection/removeGroup/
>   selectChoice/openItemContextMenu（openAppContextMenu：open-with-default ipc、
>   openInNewWindow、移除项/空组移除）、updateSelectedItems（SAME 尾项/SIMILAR choice 之外的
>   reducedSize）、onMerged（swal 统计对话框 → 继续合并/退出）；结果列表 vs-repeat（275/10）
>   复用 useVsRepeat。mergeEditor：init props 计算（names/urls/folders/tags/annotations 去重
>   排序、star 取最大、mergedAnnotation 4096 截断）、toggleFolder/toggleTag/changeName/Url/
>   Annotation/selectCustomAnnotation、merge()（checkOperationSafety swal → choice 写回 →
>   非 choice isDeleted → ayncsImagesChange → calculateImageBinding 回调 → notify/
>   rebindRefresh/updateSelection → onMerged）。duplicateModal：OPEN_DUPLICATE（$timeout 300
>   开窗 + focus 200）、save/saveAll/cancel/cancelAll（usingExist 分支 → ipc
>   images-change/empty-trash/palette-resume；keepBoth 分支 → addToDuplicateMapping + raw.push；
>   cancel → selectedMappings 清理）、image.changed ipc → palettes 更新、
>   CALCULATE_IMAGE_BINDING/REBIND_REFRESH/gl:reset 广播、body 委托点击聚焦 duplicate-input。
> - **hooks 规则教训（全树卸载）**：DuplicateScanPanel 的 useVsRepeat 最初放在
>   `if (!host) return null` 之后 → 二次渲染 hooks 数量增加 → React 抛 "Rendered more hooks
>   than during the previous render" → onUncaughtError 整树卸载 → boxes 永不渲染。所有组件
>   hooks 必须在早退之前调用。
> - 原版怪癖保留（mock 环境行为与原版一致）：(1) shim 的 cancellation 无 cancel 方法 →
>   scan 面板 back()/close() 抛 TypeError（$exceptionHandler 吞掉、面板无法关闭）——冒烟
>   不对此断言；(2) duplicate-modal hasSelected() 未定义 → button-disabled 恒不生效；
>   (3) close() 内 `applyAll == 'false'` 比较表达式 no-op；(4) 右侧对比 iframe
>   getExifPath(left) 传 left；(5) `rootScope = angular.element("body").scope()` 隐式全局
>   → 等价读 body scope。
> - 契约：window.__eagleDuplicateScanPanel（step/groups/selectedItems/isOpen）、
>   window.__eagleDuplicateModal（isOpen（ref 镜像）/duplicates/left/right）。测试 ipc 间谍
>   须只安装一次（否则嵌套包装重复记录）。usingExist/applyAll 为 link 期字符串初始化
>   （漏初始化会让 save 走 keepBoth 分支）。
> - 闭环：react-stage7d4-smoke 13/13（壳/扫描步骤机+空结果/重开重置/弹窗开合/左右对比渲染/
>   show spy/save 数据面（images-change+empty-trash+CALCULATE_IMAGE_BINDING）/cancel 路径
>   （empty-trash+itemMappings）/截图留档）。全量回归 20/20 全绿 + api-smoke 13/13；tsc 零错。

> **7d-5a 已验证并接管**（2026-08-30）：pluginPanel + pluginCreator（pluginCenter 拆至 7d-5b）。
> - 接管方式：index.html `<plugin-panel>`/`<plugin-creator>` 删除，替换为
>   `#eagle-plugin-panel-host`/`#eagle-plugin-creator-host`（保留 modal-flex-center）；
>   React 层 components/stage7/PluginFamily.tsx。
> - pluginPanel 逐字：OPEN_PLUGIN_PANEL（$timeout 30 → moveToCursorPosition（鼠标定位，
>   maxHeight -160）→ open → focus 50）+ UPDATE_PLUGIN_PANEL；calculateList（插件清单组装
>   URL_MODULE.pathToFileURL 图标、类型筛选、启用/停用分组、最近使用 3 项 + label/separator、
>   currentIndex=1、filterPluginItem 拼音打分（与引擎同款 pinyin 等价化）+ keyword indexOf 排序、
>   .unique() 原型扩展直接可用）；键盘 keyup（Enter/mod+Enter/Esc/↑↓/Tab）为输入元素级原生
>   监听（等价 jqLite）；右键 openSubmenu（ContextMenu 完整菜单：reload/pack/publish/更新/
>   查看中心/快捷键/启停/卸载）、openDevMenu（create/import/docs）、pin/unpin、removePlugin
>   swal、onItemClick（ngSafe 包裹——原版 preview[keys] 数组键恒 undefined 提前 return +
>   Object.keys(undefined) 抛错怪癖）。typeFilter 持久化 localStorage eagle.pluginPanel.type。
> - pluginCreator 逐字：OPEN_PLUGIN_CREATOR + auto-focus 等价、chooseType 四类型卡、
>   create()（dialog.showOpenDialog → 模板复制 → manifest 写入 → swal → localPlugin.load）；
>   原版怪癖保留：模板 ng-keydown="onKeydown($event)" 但控制器未定义（$exceptionHandler no-op）。
> - mock 环境 pluginModule 为 shim 空实现（plugins: []）→ 面板渲染空状态；URL_MODULE 为
>   global.js 顶层 const（全局词法绑定）→ w().eval 守卫获取。
> - 闭环：react-stage7d5a-smoke 12/12（壳/OPEN_PLUGIN_PANEL 开合/空状态/功能列表/tab 切换 +
>   localStorage 持久化/Esc 关闭/creator 开合/名称聚焦/类型选择/关闭/截图留档）。
>   全量回归 21/21（7a 与 main-ui-workflow 各一次既有偶发竞态，重跑即绿）+ api-smoke 13/13；
>   tsc 零错。
> - 待办 7d-5b：pluginCenter（bundle 62140-62723 附近 + 模板 221 行；远程 API 依赖，
>   mock 环境加载失败 → 空列表；含 PluginCenterFactory/getBestURL/排序/详情页/安装流）。

> **7d-5b 已验证并接管**（2026-08-31）：pluginCenter。7d-5（插件族）全部完成。
> - 接管方式：index.html `<plugin-center>` 删除，替换为 `#eagle-plugin-center-host`
>   （保留 modal-flex-center）；React 层 components/stage7/PluginCenter.tsx
>   （含 PluginCenterFactory.data 模块级单例 + factoryInit 远程加载等价）。
> - 逻辑逐字：link 期 2s 预加载 init（远程 API，mock 环境 fetch 失败 → electronLog.error +
>   空数据——与原版一致）；OPEN_PLUGIN_CENTER / OPEN_PLUGIN_CENTER_DETAIL /
>   REFRESH_PLUGIN_CENTER 广播 + ipc 'install-plugin'（swal notAvailable 兜底）/
>   'open-plugin-center-and-search'；open()（空数据 → isLoading + init，30ms 后
>   `.category-{id}` click）；calculateList（关键词多词匹配 + 分类过滤 + update 分类走
>   needUpdatePluginMaps）/applySorting（downloads/developer/updatedAt）；buildOfficialPluginCache/
>   isPluginCompatible/calculateNeedUpdate（compare-versions require shim）；install/update/
>   uninstall swal（fileSize 全局函数）；onInstalledClick ContextMenu；switchTab 分段指示器
>   （offsetWidth/offsetLeft）；document click 关闭排序下拉（click.pluginCenterSort jQuery
>   命名空间）；detail 区链接 jQuery 委托 shell.openExternal；auto-focus OPEN_PLUGIN_CENTER 等价。
> - **保真教训**：sort 下拉与 loader 的 ng-show 一度写反（ngShow(!x)）——因初始可见掩盖了
>   sort-button 点击未生效的时序，冒烟「开合两断言」才暴露；ng-show 表达式必须逐字对照
>   （7c-2 同款教训第三次出现）。div 上的 disabled 无效属性 → data-disabled 等价。
> - Angular number/date 过滤器局部等价：ngNumber（千分位+小数位）/ngDate（yyyy-MM-dd）。
> - 闭环：react-stage7d5b-smoke 10/10（壳/开合/空数据分类（all+update）/reload 空状态/
>   排序下拉开合/REFRESH 不崩/关闭/截图留档）。全量回归 22/22（main-ui-workflow 既有
>   偶发竞态一次，重跑即绿）+ api-smoke 13/13；tsc 零错。

> **7d-6 勘察（2026-08-31；未开工）**：进度对话框族 12 个（bundle 63239-64240 附近）。
> - bundle 指令顺序：emptyTrashProgress(63239 起)、libraryLoadProgress、libraryMergeProgress、
>   eaglepackImportProgress、eaglepackExportProgress、fileThumbnailProgress、
>   fileExportProgress、fileAddLibraryProgress、debugReportProgress、webpConvertProgress、
>   fixutilCleanEmptyFolderProgress、fixutilProgress（其后为 webView 指令）。
> - 源码镜像：js/directives/{empty-trash,library-load,library-merge,eaglepack-import,
>   eaglepack-export,file-thumbnail,file-export,file-add-library,debug-report,
>   webp-convert,fixutil-clean-empty-folder,fixutil}-progress.{js,html}（js+html 合计 1131 行，
>   平均每个 ~47 行，均为小型对话框）。
> - index.html：450-461 为 12 个元素连续块（<empty-trash-progress> … <fixutil-progress>），
>   可一次性整块换壳为 12 个 host div（#eagle-{kebab}-progress-host 式命名）或合并单文件
>   多组件 portal（建议 components/stage7/ProgressDialogs.tsx，逐组件 export）。
> - 88-102 行的 saving-progress-bar/upload-queue-progress 属 body 模板（非本族，后续处理）。
> - 共性模式（由 7d-4/7d-5 经验可直接套用）：广播驱动开合 + refs/bump + $evalAsync→bumpAll、
>   ipc 进度事件监听（getIpc().on/off）、$exceptionHandler 等价 ngSafe 包 JSX 边界、
>   hooks 必须在 if (!host) return null 之前。
> - 建议子单元：7d-6a（empty-trash + library-load + library-merge + eaglepack×2）、
>   7d-6b（file-thumbnail/file-export/file-add-library/debug-report）、
>   7d-6c（webp-convert + fixutil×2）。每个子单元 tsc+冒烟（广播开合+进度渲染+关闭）
>   +全量回归+PROGRESS+commit。
> - 7d-6a 已勘读（未转写）：empty-trash-progress 为**空 link**（无 isolate scope），模板绑定
>   isCleaningTrash/removeProgress/cancelEmptyTrash 全部解析到 **body scope** 属性——React 侧
>   需 body.$watch('isCleaningTrash'/'removeProgress') 桥接 digest 变化 + 点击直调
>   body.cancelEmptyTrash（number:1 过滤 → ngNumber 局部等价，PluginCenter.tsx 已有同款）。
>   library-merge-progress 自包含：ipc 'show-import-library-task'/'finish-import-library-task'/
>   'close-import-library'（close 时 swal mergeLibraryDone → ipc 'reload-app'）、cancel → ipc
>   'cancel.all'、calcuteTimeLeft + 1s setInterval、second2time 过滤器（react filters 已有）。

> **7d-6a 已验证并接管（2026-08-31）**：ProgressDialogs.tsx——emptyTrashProgress +
> libraryLoadProgress + libraryMergeProgress + eaglepackImportProgress + eaglepackExportProgress
> （components/stage7/ProgressDialogs.tsx，index.html 450-454 五元素换壳为
> #eagle-empty-trash-progress-host / #eagle-library-load-progress-host /
> #eagle-library-merge-progress-host / #eagle-eaglepack-import-progress-host /
> #eagle-eaglepack-export-progress-host）。
> - empty-trash：body.$watch('isCleaningTrash'/'removeProgress') 桥接 + 取消按钮
>   scopeApply(body.cancelEmptyTrash)（ng-click $apply 等价——直接调用不触发 digest，$watch
>   桥不会更新）；number:1 → ngNumber(v,1) 局部等价；模板含 .progress-dialog-overlay 兄弟
>   （library-load 无 overlay，其余四个有——逐模板保真）。
> - library-load：LoadProgress 状态机（13 条 ipc 通道）逐字；close() 50ms setTimeout 等价；
>   'app-status-loading' 有重型 body-controller 监听器（清 allData/stopAPIServer），冒烟禁
>   emit → 组件暴露 window.__eagleLibraryLoad handler 钩子直调（测试契约，同
>   __eagleDuplicateScanPanel 模式）。
> - **mock ipc 语义（重要）**：shims EventEmitter.emit 自动前置空 event 对象
>   （`callback({}, ...args)`）——组件 handler 签名 (e, payload) 与真实 Electron 一致；冒烟
>   emit 只传 payload（emit('show-import-library-task', 5)），再传合成 event 会把 payload
>   顶成第二参。
> - library-merge：三条 ipc + swal mergeLibraryDone → ipc 'reload-app'（mock send 落
>   console.debug，无副作用）；eaglepack-import/export 状态机（curr/total/percent/progress、
>   calculateProgress a+b 截断、calcuteTimeLeft 三种口径）逐字。
> - **同任务 setState 异步冲刷（复现教训）**：同一 eval 内 emit('show-archive-task') 后立即
>   click 取消按钮 → 按钮尚未渲染 → click 落空；冒烟须拆两次 eval。
> - 闭环：react-stage7d6a-smoke 30/30（五壳/旧元素删除/empty-trash body 桥接开合+37.5%
>   counter/取消 palette-resume spy/library-load 状态机 41%→95%→关闭/merge 0/5→2/5→cancel
>   'cancel.all'→close-import-library swal→confirm 'reload-app'/import startMsg→doningMsg→
>   finish 关闭/export percent 40%→abort→cancel）。全量回归 23/23（新增 react-suite runner
>   tests/run-react-suite.mjs：22 既有 + 7d6a）+ api-smoke 13/13（隔离栈
>   tests/run-api-smoke-isolated.mjs）；tsc 零错。
> - **环境事件（非本次改动引入）**：npm test 链（full-regression-isolated，React 门外的
>   后端套件）在 library-migration 的 fs.cpSync 复制 mock 库时进程 fail-fast（0xC0000409），
>   连续两次复现；React 各阶段回归门为 React 套件 + api-smoke，不含该链。已清理 mock 库内
>   僵尸后端残渣 backup/recovery-v1（git 不跟踪的空目录）并击杀 6 个孤儿 node/vite/smoke
>   进程；cpSync 崩溃根因未深究（毒源仍在 images/ 侧，不影响 React 门）。
> - **7d-6b 约束（shims 依赖）**：shims.js close-export-task 处理器 query
>   `file-export-progress` 元素并直接 poke isolate scope（isExporting/total/curr/
>   timeLeftInSeconds + $evalAsync）——7d-6b 换壳后该 query 落空静默跳过（guard 安全），但
>   fileExportProgress React 版需自行处理 close-export-task 通道的等价重置。

> **7d-6b 已验证并接管（2026-08-31）**：ProgressDialogs.tsx 追加 FileThumbnailProgress +
> FileExportProgress + FileAddLibraryProgress + DebugReportProgress（index.html 455-458 四元素
> 换壳为 #eagle-file-thumbnail-progress-host / #eagle-file-export-progress-host /
> #eagle-file-add-library-progress-host / #eagle-debug-report-progress-host）。
> - file-thumbnail：空 link → body scope 函数型 watcher 桥接（队列原地 push/splice 引用不变，
>   watcher 读两队列 length 串等价模板逐 digest 重读）；cancel → scopeApply(
>   body.cancelRegenerateThumbnail)。i18n 键 progress.regenerateThumbanil.msg（原版拼写错误，
>   逐字保留）。
> - debug-report：debugReportStatus **初始不存在**（bundle 106539 仅在导出调试报告 swal 确认
>   回调里创建）→ watcher 宽容读 + 冒烟先等价初始化再置值；取消按钮原版无 ng-click（纯装饰），
>   逐字保留。
> - file-export：ipc show/finish/close-export-task；show 的 total 累加（`total += total`）、
>   finish 完成且 finishDir → send 'show-item-in-folder'；close-export-task 合并原指令
>   （仅 clearInterval）与 shim DOM poke（重置）语义——主进程错误路径必须关弹窗（真实流：
>   main.cjs runExport 出错即 send close-export-task）。
> - add-library：ADD_TO_LIBRARY 广播（单项直加/多项 swal BulkAction 确认）+ addToLibrary
>   逐字（existsSync 不存在 → show-error-box 早退且 isAdding 保持 true 的怪癖；tagGroup/
>   smartFolder/folder 三分支 metadata 写入 + updateLibraryMetadata 原子写 + copyToLibrary
>   async.parallelLimit(5)）；依赖 window 全局 cloneTree/guid/angular.copy/eagle.utils.tree.walk/
>   FileUrlHelper + req('fs'|'fs-extra'|'path'|'async')（shim async 无 parallelLimit，mock
>   existsSync 早退走不到）；window.Buffer 替代裸 Buffer（tsc 无 node types）。
> - 闭环：react-stage7d6b-smoke 21/21（四壳/旧元素删除/thumbnail 队列 (0/2)→50%→cancel/
>   debugReport 40% 开合/export 0%→50%→finish 关闭→finish(dir) show-item-in-folder→
>   close-export-task 关闭→cancel 'cancel.all'/add-library 单项 (0/1)+msg 库名→cancel
>   'electron-info'、多项 swal 确认→(0/2)→cancel）。全量回归 24/24（runner 增 7d6b）+
>   api-smoke 13/13；tsc 零错。
> - **冒烟 spy 教训**：ipc.send 包装的 rest 参数已含去 channel 的 payload，记录应为
>   `[...args]` 而非 `args[1]`（7d-6a spy 不记 args 未暴露）。

> **7d-6c 已验证并接管（2026-08-31；进度对话框族 12/12 全部完成）**：ProgressDialogs.tsx 追加
> WebpConvertProgress + FixutilCleanEmptyFolderProgress + FixutilProgress（index.html 459-461
> 三元素换壳为 #eagle-webp-convert-progress-host / #eagle-fixutil-clean-empty-folder-progress-host
> / #eagle-fixutil-progress-host；12 个 progress host 齐）。
> - webp：WEBP_CONVERT_START 广播（ext==='webp' 过滤 + swal webpConvert 确认）→ queue push +
>   ayncsWebpConvert（20 一批 rAF 循环、backgroundWindowID undefined 判定 send/sendTo）逐字；
>   ipc 'webp.converted' → finishQueue.push，finish==queue → 双清空关闭；cancel →
>   **IPCHelper 是 bundle 顶层 const（3471），window 上不可见** → 等价直接 ipcRenderer.send
>   ('cancel.webp.convert')（首次写 w.IPCHelper 落空被冒烟 wc-cancel-ipc 断言抓住）。
> - fixutil×2：空 link 绑 body.fixUtils（20513 初始化为 {}，流程动态加字段）→ 函数型 watcher
>   读字段串桥接（useFixUtilsBridge）；**外壳模板带 ng-if**（关闭时整个 .progress-dialog 不在
>   DOM，仅 overlay 恒在）→ 条件渲染；counter number:0 → ngNumber(v,0)；**ng-click="cancel()"
>   解析到 body scope 的 cancel——不存在**（$exceptionHandler 吞，原版死按钮怪癖）→
>   scopeApply + 存在性守卫 no-op，冒烟断言点击后保持 open。
> - 闭环：react-stage7d6c-smoke 16/16（三壳/12 host 齐/webp swal→(0/2)→50%→双清空关闭→
>   re-broadcast cancel 'cancel.webp.convert'/fixutil (3/10) 30% + cancel no-op 保持 open →
>   关闭 DOM 消失/clean-empty-folder (2/4) 50% 开合）。全量回归 25 项（runner 增 7d6c；
>   main-ui-workflow multi-inspector-persistence 偶发竞态一次，单测重跑即绿——既有问题新
>   变体，PROGRESS 先例同款）+ api-smoke 13/13；tsc 零错。

> **7d-7 勘察结论（2026-08-31；无独立可交付单元，拆并归属）**：原拟小指令族
> （noSpecialChar/ngRightClick/ngLongClick/ngHoverIntent/repeatDone/colorPicker/yaNoUiSlider/
> ngFlatpickr/autoScroll/scrollPositionSaver/typeChecking/alwaysFocus/imageonload 等）逐一
> 核查消费点后，全部归入以下三类，**不再单列阶段**：
> - **已被先前单元等价覆盖**：yaNoUiSlider/ngFlatpickr（7d-1c-2 NewSmartFolderModal 的
>   FlatpickrInput 等）、scrollPositionSaver（唯一消费点 tag-manager.html:62，TagManager 已
>   React 接管，旧模板不再编译消费）、colorPicker 属性指令本体（70388 仅 $destroy 清理，
>   主体是 ngModel 绑定）。
> - **消费点在阶段8 设置页**：shortcutInput（64490-64843）、typeChecking、preferences.html
>   内的各属性指令——随设置页转写一并实现。
> - **消费点被 bundle jQuery 直控（阶段11 与 bundle 一并重写，过渡期禁止接管）**：
>   index.html 剩余 Angular UI 块全部命中双轨风险——lock-screen（29026 起密码框 focus/val
>   直控）、colors-picker（32509 程序化 click + 68199 val）、annotation-preview-container
>   （52089 起 AnnotationPreview 类完整 jQuery 管理）、hover-preview-container（51696）、
>   tag-manager-drag-badge（53707）、saving-progress-bar（23349 background-state 处理器
>   addClass/text 直控）、upload-queue-progress（30500/30791/34539 .percentage/.current 直写
>   + 33641 removeClass open）。以上块接管必须与 bundle 上传/标注/锁屏逻辑重写同步进行。
> - index.html 残留 ng-*（ng-right-click 4 处等）属未删除旧模板，阶段11 ng-* 清理时处理。
> **阶段8 勘察（2026-08-31；未转写）**：设置页 = 独立窗口页，**已走 vite 管道**。
> - 窗口机制：main.cjs `openPreferencesWindow`（628-660）——`preferencesUrl() = previewUrl +
>   /src/app/preferences.html`，query 传 `panel`/`keyword`；BrowserWindow frame:false 980×720；
>   重复打开 focus/重载。shims 'open.preferences' → native ipc（1346-1350）。
> - 规模：preferences.html **1229 行**（ng-app="PreferenceApp"，12 个 ng-switch-when 面板：
>   general/sidebar/control/habits/screencapture/shortcuts/notification/privacy/autoImport/
>   developer + panel/separator 侧栏项；全部 panel-block 带 search-show="{{keyword}}" +
>   search-keywords 搜索关键词）；preferences.js **1350 行**（PreferencesController +
>   searchShow 指令 + throttle 局部实现）。
> - 自带依赖：angular.min.js + shortcut-manager.js + shortcut-input.js（shortcutInput 独立
>   模块，键位录入 UI）+ wMousetrap（mod+f focusSearch / mod+enter save / esc escHandler）+
>   tippy + @electron/remote（currentWindow）+ auto-launch + pluginModule（initPlugins）。
> - 数据面通道（零改动）：ipc 'init'（Registration/panel/keyword → currentPanel/keyword/
>   initAutoLaunch/initPreference/initPlugins/updateKeybinds/currentWindow.show/focusSearch
>   200ms）；save = apply()（electron-info 日志 + auto-launch enable/disable + autoImport 日志
>   + send 'chnage-preferences'——**原版拼写，逐字保留**）→ currentWindow.hide() → 300ms
>   close()；'open-with-default'（autoImportPath）、'lock-now'、'change-theme'（lastTheme）。
> - 接线方案（与主窗口绞杀者同构）：preferences.html 内加 `#eagle-preferences-react-host`
>   + `<script type="module" src="…/react/preferences-entry.tsx">`；新代码
>   src/app/react/preferences/（独立 entry + store 同步桥读 electronSettings/全局
>   preferences，回调仍调 scope/全局函数）。
> - mock 测试待办：shims 目前对 preferences.html 路径**无 init 发射序列**（emitAfterControllerReady
>   只认 index.html）——8a 需先补 shim 的偏好页 init 序列（Registration + preferences 对象），
>   冒烟用 CDP /json/list 连第二 target。
> - 分单元：**8a** 入口接线+壳（sidebarPanels/currentPanel/switchPanel/keyword/onKeywordChange/
>   searchShow 等价/主题 attr/class/save/esc/init）；**8b** general+sidebar 面板（73-355）；
>   **8c** control+habits（356-734）；**8d** shortcuts（735-796，shortcutInput 等价 +
>   updateKeybinds/shortcut-manager）；**8e** notification+screencapture+privacy+autoImport+
>   developer（797-1229）。每单元 tsc+冒烟+全量回归+PROGRESS+commit。
> **8a 已验证并接管（2026-08-31）**：偏好窗口入口接线 + 壳。
> - vite（frontend/vite.preview.config.mjs）：`readPreviewPreferences()`——/src/app/preferences.html
>   走独立 middleware 分支（injectPreviewScripts 的 shims + REACT_REFRESH_PREAMBLE +
>   `<script type="module" src="/src/app/react/preferences/entry.tsx">`）。注意：该页无
>   `<title>`，transformIndexHtml 钩子本就不生效（middleware 直出），此前无 shims 也无 React。
> - preferences.html：body 尾加 `#eagle-preferences-react-host`。
> - src/app/react/preferences/entry.tsx：PreferencesWindowState 外部 store（registration/
>   panel/keyword/ready）+ ipc 'init' 监听（数据面等价）；8a 不渲染 DOM（8b 起面板迁入）；
>   测试契约 window.__eaglePreferencesState。
> - shims.js：preferences.html 页面分支——等 PreferencesController 就绪（scope.sidebarPanels
>   数组，轮询 25ms×400 兜底）后 emit 'init' {Registration/trialRemain/machineID/panel/
>   keyword（URL query）}。与主窗口 emitAfterControllerReady 同款模式。
> - 冒烟（react-stage8a-smoke，5/5）：主窗口 send 'open.preferences' {panel:'shortcuts',
>   keyword:'theme'} → main.cjs openPreferencesWindow → CDP /json/list 连第二 target →
>   host/React 挂载/__eaglePreferencesState（panel/keyword/registration 透传）/Angular 壳同步
>   （sidebarPanels 13 项 + **keyword 非空 → 原版 onKeywordChange 切 currentPanel='search'
>   搜索结果面板**（preferences.js 1069，不是字面 panel 名）+ preferences 就绪）+ 第二窗口
>   截图。harness 复用 connect(wsUrl) + debugPort /json/list 连多窗口。
> - 全量回归 26 项（runner 增 8a；main-ui-workflow 偶发一次重跑即绿）+ api-smoke 13/13；
>   tsc 零错。
> **8b 已验证并接管（2026-08-31）**：偏好窗口 general + sidebar 面板。
> - 接管方式：preferences.html 旧 general `.panel-content`（73-229）+ sidebar `.panel-content`
>   （232-353）两块删除，替换为注释锚；React 层 react/preferences/panels.tsx（entry.tsx 渲染
>   PreferencesGeneralSidebarPanels）。**渲染位置修正**：8a host 在 .content 末尾（footer 之后），
>   而原版 .panel-content 在 footer 之前（footer 在 .content 内随内容滚动，1d85065 起的既有
>   DOM；8a 截图证实）——面板经 portal 渲染进 **.content 顶部动态锚点**（insertBefore
>   firstChild，data-eagle-react-panels="general-sidebar"），host 本体位置不动；锚点必须在
>   .content 内的另一半原因：Angular showSearchEmpty（preferences.js 332）统计
>   `.content .panel-content :visible`，React 块必须被数到（冒烟跨系统断言覆盖）。
> - 数据桥：签名 watcher（scope.$watch 函数型，JSON 签名引用比较）→ 快照 setState；
>   偏好页 scope 取本页 body scope（不走 scopeBridge.getBodyScope——其优先读主窗口语义的
>   window.$bodyScope）；preferences/themes/currentTheme/platform/isAppleSilicon/launchAtLogin
>   活引用守卫读。pfT 自建 i18n 通道：require('app-root-path')+'/i18n'（mock → MockI18n，
>   真实 → i18n 类），偏好页无 window.i18n。
> - 交互逐字：changeTheme/changeZoom/changeAutoLaunch/onKeywordChange 经 scopeApply（ng-click
>   $apply 等价）；language select 原版怪癖保留（ng-change 传参字面量 'preferences.general.language'，
>   $scope.changes.language 死存储无观察面差异）；checkbox ng-true/false-value="'true'/'false'"
>   字符串语义；sidebar 静态 disable 项（all/allTags/trash）无 ng-model 恒 checked 逐字；
>   platform=='darwin' / !isAppleSilicon 条件块。tippy 等价（js/modules/tippy.js 参数逐字，
>   Sidebar useTippy 同款）。
> - search-show 等价（preferences.js 54-81 逐字）：search 模式按 (textContent +
>   search-keywords).includes(keyword) 设 display:block/none；非 search 模式复位 inline display
>   （原版由 ng-switch 重建元素复位，渲染驱动等价）。
> - sidebar-search 接管（3.5 原位元素方案）：preferences.html 输入框去掉 select-all/ng-model/
>   ng-change 三属性，React 绑 keydown（mod+a preventDefault+select / Esc blur，selectAll
>   指令等价）+ input（写 scope.keyword + onKeywordChange()）；value 由快照同步（等价
>   ng-model 视图渲染，init keyword / switchPanel 清空均覆盖）。
> - **mock 数据面事实（后续 8c-8e 复用）**：shim ipcRenderer.send 的 change-theme/change-zoom/
>   chnage-preferences 会 savePreferences + applyPreferencesToCurrentDocument——后者整体替换
>   scope.preferences（saved 对象）+ $evalAsync；initPreference 的 angular.extend(preferences,
>   data) 是浅拷贝（preferences.general 等别名到 settings 存储对象，页面内写入即持久化）。
> - 闭环：react-stage8b-smoke 24/24（旧块删除/.content 顶部锚点在 footer 前/7 主题 + DARK
>   active/译文非 key/theme 点击 BLUE 数据面 + active class/enableVibrancy + launchAtLogin
>   翻转/language zh_TW + changes.language 字面量怪癖/zoom 150/窗内搜索 switch→search-show
>   过滤（5 块 1 显 4 隐）/无结果态 Angular panel-empty（跨系统统计）/清空回 general 复位/
>   sidebar switchPanel→radio rename 数据面/unfiled 翻转/{keyword:'theme'} 重开 loadURL 重载
>   → init 透传 + 过滤 + 输入框 value 同步/双截图）。全量回归 27 项（runner 增 8b）+
>   api-smoke 13/13；tsc 零错。
> - 教训：CDP 断言布尔化——compareDocumentPosition(...) & DocumentPosition 常量返回数字，
>   `=== true` 断言恒 false（位运算结果必须 Boolean() 包装）；首跑冷启动偶发（vite 首次
>   transform + init 500ms 定时）会吃掉前 1-2 个断言窗口，重跑即绿（既有偶发家族新成员）。
> **8c 已验证并接管（2026-08-31）**：偏好窗口 control + habits 面板。
> - 接管方式：preferences.html 旧 control `.panel-content`（原 75-207）+ habits `.panel-content`
>   （原 210-451）两块删除（378 行），替换为注释锚；React 层 panels.tsx 追加
>   ControlPanelContent + HabitsPanelContent，根组件更名 PreferencesPanels（entry.tsx 同步），
>   锚点标记改 data-eagle-react-panels="panels"（8b 冒烟同步更新）。
> - 组件逐字：RadioRow（label-item + label 240px + .right > .checkbox-items > radio inline；
>   hidden 选项 = ng-show darwin 的 display:none 等价——keyspace preview-native 行保留 DOM）；
>   HoverTip（hover-tip 三处逐字：icon/illustration 的 ng-src themeAttr()+themePath 等价——
>   themeAttr 1097-1109 + themePath 过滤器 144-153 转写为 themeAttrCss/themePathFor，
>   Auto 分支守卫 remote.nativeTheme）；视频 hoverPlay 的 hover-tip 带 style margin-top:-60px。
> - NgStringCheckbox 泛化：trueValue/falseValue 可参（GIF 组 'on'/'off' 逐字）+ tip 插槽；
>   **onToggle 语义改为传解析后的模型值字符串**（ng-model 写入语义一致，8b setSidebar 同步适配）。
> - 数据面：control/habits 全部为无 ng-change 的 ng-model 直写（scopeApply 包裹）；
>   video.*（5 checkbox）与 font.autoTag 归 habits 面板；签名 watcher 扩为整个
>   habits/video/font 对象。
> - 闭环：react-stage8c-smoke 16/16（control 13 radio + 5 组默认选中 + keyspace darwin 行
>   display:none/radio 数据面 paging+openPluginPanel+scroll/habits 4 块 + hover-tip×3
>   （src 走 /dark/）/gif 'on' 语义/zoomFill 翻转/video 'video'+'gif' 关键词过滤/清空回 habits/
>   {keyword:'gif'} 重开重载过滤/双截图）。全量回归 28 项（runner 增 8c，首次全绿无偶发）+
>   api-smoke 13/13；tsc 零错。
> - 教训：**测试选择器禁用 nth-child/nth-of-type 定位 checkbox**——block-content 子级含
>   block-title/separator/label-item（全 div），伪类序号失准且 RadioRow 的 radio 也藏在
>   .checkbox-item 里；统一用块内 querySelectorAll(...input[type=checkbox]) 索引。
>   Runtime.evaluate 表达式 throw 不 reject（落 exceptionDetails）——evalOn 必须检查
>   exceptionDetails 否则点击 eval 静默失败（本次 video[1] 点到 volume radio 即由此掩盖）。
> **8d 已验证并接管（2026-08-31）**：偏好窗口 shortcuts 面板。
> - 接管方式：preferences.html 旧 shortcuts `.panel-content`（61 行）删除 + `#shortcut-input`
>   搜索框去 select-all/ng-model/ng-change 三属性（React 原位接管：常驻轮询挂事件——元素在
>   ng-if 下随面板切换销毁重建；keydown mod+a/Esc 等价 selectAll + input → shortcutKeyword
>   React state）。React 层 panels.tsx 追加 ShortcutsPanelContent + ShortcutInput。
> - updateKeybinds 逐字移植为 computeShortcutResults（601-656）：空 keyword 全量分组；
>   搜索按 shortcuts.{key} i18n 名 + 键值（去空格）+ key + 组名 indexOf 过滤分组与插件清单；
>   i18n.__ → pfT 等价。keybindGroups/installPlugins 进快照与签名（分组为平台过滤后的静态
>   数组——win32 实际 10 组 143 键，含 find/reverse/organize 三个未在勘察记录里的组）。
> - shortcutInput 指令（js/directives/shortcut-input.js 353 行）逐字等价为 ShortcutInput：
>   keydown preventDefault + 修饰键前缀（Ctrl/Command/Shift/Alt 平台语义）+ 特殊键映射
>   （Backspace 清空模型/F 键/方向键/符号）/字母数字须带修饰键；冲突时**不写模型**（1.5s
>   提示 + 原值回显 + 100ms 后 blur/focus），无冲突 setViewValue + blur/focus；兄弟元素
>   shortcut-error（input 后）/shortcut-conflict-tip color-warning（input 前）+ valid/invalid/
>   conflict class；focus 显原值/blur 格式化；挂载 100ms 初始化等价。**ShortcutManager 消费
>   window 全局单例（数据面零改动）**——manager 由原版 initPreference init（Angular 侧持续运行）。
> - restore 按钮经 scopeApply 直调 scope.restoreDefaultShortcuts（Angular 流程不变；mock
>   remote.dialog.showMessageBox 固定 response 0 → 确认流不重置，冒烟用 spy 断言接线）。
>   search-active 死标记（仅写无读）照抄为 jQuery .data() 写入。
> - **ng-show 语义修正（冒烟抓到）**：插件块与 restore 区原版是 ng-show（display:none 常驻
>   DOM）+ search-show 双驱动——React 初版误用条件渲染（ng-if 语义），已改为常驻渲染 +
>   search-show 效果统一驱动（非搜索态按计数 display:none，搜索态按关键词 block/none——
>   原版 searchShow 的 css() 会覆盖 ng-show 的内联 display，逐字保留该怪癖）。
> - 教训：**键入捕获测试的组合键必须先对 default-preferences 键表做冲突扫描**——Ctrl+Shift+R
>   本身就是 edit.folder.setting 的默认键（'all' 冲突组），原样触发冲突路径（模型保留），
>   与捕获路径混淆；无冲突组合用 Ctrl+Shift+A。keybindGroups 组数以 scope 实际为准（10 非 7）。
> - 闭环：react-stage8d-smoke 12/12（10 组 143 键渲染 + 插件块 ng-show 隐藏/初始值格式化
>   （CmdOrCtrl→Ctrl 由原版 formatShortcut）+ valid class + 兄弟提示元素/ctrl+shift+A 捕获
>   写模型/ctrl+alt+E 冲突保留模型 + usedBy 提示 + 1.5s 自动复位/restore 接线 spy/搜索过滤
>   （capture）/空态隐藏 restore/清空恢复/截图）。全量回归 29 项（runner 增 8d，全绿无偶发）
>   + api-smoke 13/13；tsc 零错。
> **8e-1 已验证并接管（2026-08-31）**：偏好窗口最后五面板（notification/screencapture/privacy/
>   autoImport/developer）。
> - 接管方式：preferences.html 五块 `.panel-content`（376 行）删除（删后仅剩 Angular 壳层：
>   sidebar/header/footer/panel-empty/密码弹窗 + ng-app/ng-controller/脚本区，归 **8e-2**）；
>   React 层新文件 react/preferences/panels8e.tsx（共享助手 pfT/getPreferencesScope/themeAttrCss/
>   themePathFor/ShortcutInput/PanelSnap 自 panels.tsx 导出），根组件接五个渲染分支。
> - 组件逐字：NgToggle（label.toggle > input + span.slider.round）；notification 两块
>   （**弹窗区块反式 ng-if `enable !== 'false'` 逐字保留**；音效区块 === 'true'）；screencapture
>   三块（format radios 逐字含重复 id radio-scroll/radio-page + width:32% 内联样式、品质行/分隔线
>   ng-show format!=='png'、shortcutsEnable == 'true' 宽松比较控表显隐 + ng-disabled 三捕获输入
>   （ShortcutInput 加 disabled prop，复用 8d 键入等价）、进阶 5 checkbox）；privacy/autoImport
>   （ng-class disable 块 + toggle 的 ng-model/ng-click 双绑定 + ng-if 区块 list-item 行 +
>   tippy content=path 随路径重初始化）；developer（api-token + 嵌套 ng-click 双绑 copyApiToken
>   逐字冒泡双触发 + regenerate + 链接 href token 同步）。
> - 数据面：控制函数（openPasswordModal/lockNow/toggleTouchIDClick/openAutoImport/
>   chooseAutoImportPath/revealAutoImportPath/copyApiToken/regenerateApiToken/toggleTouchID）
>   留 Angular scope，React scopeApply 直调；签名扩全 notification/screencapture/privacy/
>   autoImport/developer + canUseTouchID（win32 恒 false → Touch ID 行不渲染）。
> - 闭环：react-stage8e-smoke 17/17（notification 渲染 + toggle ng-if 显隐 + 子 checkbox 数据面/
>   screencapture webp→品质行出现 + quality 80 + capture.window 键入 Ctrl+Alt+W + disable 三输入/
>   privacy disable class + toggle→enable true + **跨系统密码弹窗**（change 行 → SET-APP-PASSWORD
>   广播 → Angular PasswordController open/close）/autoImport 数据面直写→行渲染 + tippy 属性/
>   developer regenerate token + href/textContent 同步 + copy 嵌套双触发 spy/search 'screenshot'
>   过滤/截图）。全量回归 30 项（runner 增 8e；main-ui-workflow 偶发一次，单测重跑即绿，二次
>   全量 ALL GREEN）+ api-smoke 13/13；tsc 零错。
> - 教训：(1) **原版 ng-click 先于 ng-model 的 change 触发**（浏览器 click 处理器先于激活行为
>   的 change）——privacy 开关首次切换时 openPasswordModal 读到的 enable 仍是旧值（走
>   chnage-preferences 分支不弹窗）；React onChange/onClick 的触发序与原版一致，断言必须按
>   该时序写。(2) 开面板后首个动作必须是轮询断言（bare evalOn click 会在 React 渲染前落空）。
>   (3) CSS 属性选择器数字值必须加引号（[value=80] 非法）。
> **8e-2 已验证并接管（2026-09-01）**：偏好窗口 Angular 壳移除——窗口整体 React 化完成（阶段8 主体完成）。
> - 新文件：react/preferences/controller.ts（无 React 依赖的控制器本体）+ react/preferences/shell.tsx
>   （壳 JSX + 订阅）。controllerScope 为普通对象，字段/方法与原 $scope 同名同形
>   （preferences/currentPanel/keyword/themes/currentTheme/launchAtLogin/keybindGroups（win32 10 组
>   全量逐字）/installPlugins/sidebarPanels/changes/showSearchEmpty/canUseTouchID/password 区 + 
>   switchPanel/onKeywordChange/changeTheme/changeZoom/save/apply/cancel/escHandler/
>   openPasswordModal/lockNow/toggleTouchID(Check)/openAutoImport/chooseAutoImportPath/
>   revealAutoImportPath/copyApiToken/regenerateApiToken/restoreDefaultShortcuts/performShortcutsReset/
>   onPluginShortcutChange/pwd* 全套），面板层仅换接 applyController（fn + notify = $apply 等价），
>   调用点零改动。
> - init 序列接管（preferences.js 802-841 逐字）：ipc 'init' → Registration/panel/keyword（+
>   onKeywordChange + focusSearch 100ms）→ initAutoLaunch（AutoLaunch isEnabled，失败写
>   eagleAutoLauncher 字段的怪癖逐字）→ initPreference（getPreferences + default-preferences
>   深拷贝 + keybinds 迁移/formatShortcut + **angular.extend 浅拷贝 Object.assign 逐字** +
>   ShortcutManager.init）→ await initPlugins（Promise.race 5s）→ currentWindow.show() →
>   focusSearch 200ms。
> - 壳 JSX 逐字：sidebar（title/sidebar-search/sidebar-items + active/separator）、header
>   （panel-title 译文 + close=cancel）、shortcut-search 容器（ng-if shortcuts）、panel-empty
>   （showSearchEmpty watcher 逐字：keyword $watch → 100ms 后 $('.content .panel-content :visible')
>   计数）、footer（save=apply+hide+300ms close / apply=chnage-preferences 前的全套日志）、
>   密码弹窗（PasswordController 全移植：SET-APP-PASSWORD→isOpen/mode、new/change/reset 三态、
>   auto-focus 100ms click+focus+select、select-all、setNewPassword/chnagePassword（atob 校验 +
>   btoa 写入 + 抖动提示）、cancel（new 模式回写 enable='false'）、close 200ms 清字段）、
>   body 属性（platform 静态 + theme 随 notify + vibrancy/class 一次性绑定——**themeName 为大写
>   'DARK' 等 getThemeName 原值**，body class 即 theme-DARK）、w-mousetrap（mod+f/mod+enter
>   throttle50 + esc escHandler）。原版 lastPanel 在 sidebarPanels 定义前赋值（=undefined）怪癖逐字。
> - preferences.html 缩为静态根（138→22 行）：ng-app/ng-controller/w-mousetrap/ng-* 全删；
>   angular.min.js/preferences.js/wMousetrap/tippy模块/shortcut-input 脚本删；保留 jQuery
>   （search-active 标记）/tippy 厂家库/lodash/shortcut-manager（window 单例，ShortcutInput 消费）。
>   body 只剩 #eagle-preferences-react-host。
> - shims：两个偏好页分支合并为「等 __eaglePreferencesEntryReady 标记后发射 init」。**关键时序
>   修复**：标记必须在 React 提交后设置（entry 的 effect 内，子组件 shell 的监听器先于父 effect
>   注册）——放模块尾会在 React commit 前盲发丢失（探针定位：ready 标记真、init 未达）。
> - 测试迁移（测试健康规则）：8a-8e 冒烟的 window.angular...scope() 全部机械换写为
>   window.__eagleControllerScope（字段同形）；8e 的 $apply 直写改 __eagleApplyController 钩子；
>   8b/8c/8d 的键入改原生 value setter（React 受控输入的 value tracker 会吞「JS 改值 + 派发
>   input」——真实键盘不受影响）。8a 的 angular-shell 断言改 controller-shell 等价。
> - 闭环：react-stage8e2-smoke 18/18（无 Angular/shell 渲染（10 项+3 分隔）/init 透传/body 属性
>   （theme dark + class theme-DARK + win32）/React sidebar 切换 + localStorage/窗内搜索过滤 +
>   showSearchEmpty 空态 + 清空回 lastPanel/主题点击→body theme 联动/重开 init focusSearch/
>   privacy 时序 + React 密码弹窗 auto-focus/apply ipc spy（chnage-preferences + electron-info）/
>   Esc→cancel→窗口关闭（target 消失）/截图）。全量回归 31 项：全部单项绿；suite 三轮各轮转
>   一个既有偶发（main-ui-workflow markdown 缩略图计数 / react-stage-smoke），**stash 交替验证
>   证明 main-ui-workflow 竞态为既有（两态各出现失败）**，与本单元无关；api-smoke 13/13；tsc 零错。
> - 教训：(1) React commit 异步——「就绪标记」必须在 effect（提交后）设置，模块尾标记会早于
>   监听器注册；(2) React 受控输入的测试必须用原型原生 setter 设值（value tracker 去重会吞
>   合成 input 事件）；(3) 对既有偶发做回归归因时，用 git stash 交替跑两态最省事且可证伪。
> **下一步 = 阶段9（其余窗口：preview-window.js 102KB / collect-window / progress.html /
>   thumbnail.html）**；偏好窗口仅剩收尾项（8e-3，可选）：8a 遗留测试契约 __eaglePreferencesState
>   与 PreferencesRoot 旧监听的清理、body class 去重、与 index.html 一致的 ng-* 残留清扫。

| NewSmartFolderController | controller | 74323-74733（模板 index.html 641-964）| 已验证（7d-1c-2 NewSmartFolderModal） |
| AddToFolderController | controller | 74733-75637（模板 index.html 411-544）| 已验证（7d-1a AddToFolderModal） |
| MoveFolderController | controller | 75637-76136（模板 index.html 545-617）| 已验证（7d-1a MoveFolderModal） |
| ErrorModalController | controller | 76136-76464（模板 index.html 965-1013）| 已验证（7d-1b ErrorModal） |
| AutoTaggingController | controller | 74190-74323（模板 index.html 618-640）| 已验证（7d-1c-1 AutoTaggingModal） |
| WebsitePanelController | controller | 74094-74190（模板 index.html 82-96）| 已验证（7d-1b WebsitePanel，含 websitePanelWebview 指令） |
| tagPopup（源码镜像 js/controllers/tag-popup.js）| controller | 源码 | 无运行时引用（tag-popup.js 未加载、bundle 无注册、无模板消费点；7c-2 定性） |

---
## 8. 设置页（preferences.html）

> 阶段状态：**已验证并接管（8a-8e-2，2026-09-01）**。窗口整体 React 化：偏好页无 Angular
> （ng-app/ng-controller/ng-*/Angular 脚本全删，preferences.html 22 行静态根），控制器数据面 =
> react/preferences/controller.ts（controllerScope），壳 = shell.tsx，面板 = panels.tsx/panels8e.tsx。
> 数据面通道零改动（chnage-preferences/change-theme/change-zoom/electron-settings/localStorage/
> window.ShortcutManager/auto-launch）。唯一权威测试 = react-stage8a…8e2 六个冒烟 + suite。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| preferences 入口接线（vite 分支 + shims init + entry.tsx 壳）| 接线 | vite.preview.config / shims.js / react/preferences/entry.tsx | 已验证（8a；8e-2 改 React 就绪序列） |
| general 面板（.panel-content）| 模板块 | preferences.html 73-229（旧） | 已验证（8b GeneralPanelContent，portal .content 顶部锚点） |
| sidebar 面板（.panel-content）| 模板块 | preferences.html 232-353（旧） | 已验证（8b SidebarPanelContent，同上） |
| searchShow | directive | preferences.js 54-81 | 已验证（8b search-show effect 等价） |
| selectAll（#sidebar-search）| directive | preferences.js 130-142 | 已验证（8b keydown 等价，原位元素） |
| #sidebar-search ng-model/ng-change | 绑定 | preferences.html:38（旧） | 已验证（8b React input + scope 桥接管） |
| control 面板（.panel-content）| 模板块 | preferences.html 75-207（旧） | 已验证（8c ControlPanelContent，RadioRow 等） |
| habits 面板（.panel-content）| 模板块 | preferences.html 210-451（旧） | 已验证（8c HabitsPanelContent，HoverTip/GIF on-off 语义） |
| themeAttr + themePath（preferences 版）| 函数/过滤器 | preferences.js 1097-1109 / 144-153 | 已验证（8c themeAttrCss/themePathFor，HoverTip src） |
| shortcuts 面板（.panel-content）| 模板块 | preferences.html 76-135（旧） | 已验证（8d ShortcutsPanelContent + computeShortcutResults） |
| shortcutInput | directive | js/directives/shortcut-input.js（353 行）| 已验证（8d ShortcutInput；ShortcutManager 走 window 单例零改动） |
| updateKeybinds | scope 函数 | preferences.js 601-656 | 已验证（8d computeShortcutResults 等价） |
| #shortcut-input ng-model/ng-change | 绑定 | preferences.html:62（旧） | 已验证（8d React 接管，ng-if 常驻轮询） |
| restoreDefaultShortcuts | scope 函数 | preferences.js 1250-1322 | 已验证（8d scopeApply 直调，Angular 流程不变） |
| notification 面板（.panel-content）| 模板块 | preferences.html 78-169（旧） | 已验证（8e-1 NotificationPanelContent，反式 ng-if 逐字） |
| screencapture 面板（.panel-content）| 模板块 | preferences.html 172-336（旧） | 已验证（8e-1 ScreencapturePanelContent，ng-show/disabled） |
| privacy 面板（.panel-content）| 模板块 | preferences.html 339-388（旧） | 已验证（8e-1 PrivacyPanelContent，跨系统密码弹窗） |
| autoImport 面板（.panel-content）| 模板块 | preferences.html 391-425（旧） | 已验证（8e-1 AutoImportPanelContent，tippy path） |
| developer 面板（.panel-content）| 模板块 | preferences.html 428-451（旧） | 已验证（8e-1 DeveloperPanelContent，嵌套 copy 双触发） |
| openPasswordModal/lockNow/copyApiToken 等控制函数 | scope 函数 | preferences.js 894-936 | 已验证（8e-1 scopeApply 直调 → 8e-2 起由 controller.ts 承载） |
| PreferencesController（壳+init 序列+save/apply/cancel）| controller | preferences.js 289-1332 | 已验证（8e-2 controller.ts 全量移植，无 Angular） |
| PasswordController | controller | preferences.js 171-287 | 已验证（8e-2 shell.tsx PasswordModal + controller.ts password 区） |
| sidebar/header/footer/panel-empty 壳层 | index 模板 | preferences.html 34-88（旧） | 已验证（8e-2 shell.tsx 逐字） |
| wMousetrap（mod+f/mod+enter/esc）| directive | js/modules/wMousetrap.js | 已验证（8e-2 window keydown + throttle50 等价） |
| selectAll/auto-focus（密码弹窗）| directive | preferences.js 130-142 / bundle | 已验证（8e-2 shell.tsx 等价） |
| showSearchEmpty watcher | scope $watch | preferences.js 326-336 | 已验证（8e-2 shell.tsx effect 逐字） |
| 偏好页 Angular 脚本区 | 脚本 | preferences.html head（旧） | 已删旧实现（8e-2：仅剩 jQuery/tippy 厂家库/lodash/shortcut-manager） |
| preferences.js（原文件，非 bundle）| 独立页面 | `src/app/js/preferences.js` | 已验证（8e-2 controller.ts + shell.tsx 全量移植；原文件随窗口接管不再加载） |
| default-preferences.js | 数据 | `src/app/js/default-preferences.js` | 已验证（8e-2 controller.ts 消费，数据源保留） |

对应 `src/app/preferences.html`（85KB）与 `src/app/style/preferences.scss`。

---

## 9. 其余窗口（preview-window / collect-window / registration / manage-device / progress / thumbnail）

> **阶段9 勘察（2026-09-01；未转写）**：
> - **9a preview-window（预览大窗，活跃）**：preview-window.html（383 行，PreviewWindowController）
>   + js/preview-window.js（2565 行）。入口 = main.cjs `preview:open-original` handle →
>   openOriginalPreview（/src/app/preview-window.html + `preview:init` webContents.send）；shims 已有
>   preview-window init 分支（images/imagesDir/rootDir/machineID/Registration/pluginModule，页内
>   有无 Angular 的双路径）。依赖大多已移植可复用：mediaElement/mpvMediaElement/pluginView（阶段5）、
>   filters、smoothZoom、videojs、wMousetrap、tippy。**回归门 = 既有 preview-delivery-closed-loop**
>   （suite 成员，当前 Angular 态全绿——迁移期间该测试持续作门）。
> - **9a 深勘察（2026-09-01，未转写；下一会话按此执行）**：
>   - **冒烟驱动契约（main.cjs --smoke-preview-delivery，2474-2880）**：驱动全程走
>     `window.$bodyScope`（scope.current/images/selectNext()/selectPrev()/$evalAsync()）+ DOM 查询
>     （#detail-image/.gif-viewer/.pdf-viewer iframe 等）。迁移时按「只改写不删除」先例：
>     controllerScope 上加 `$evalAsync(fn?)` 门面（fn 执行 + notify），driver 内
>     `window.$bodyScope` 机械替换为 `window.__eaglePreviewController`，其余 driver 代码零改动。
>   - **init 序列**（preview-window.js 581-658）：'init' → images/pluginModule（含
>     previewExtension.allowZoom/getViewerPluginExt（IMAGE_TYPES 表 + customThumbnail 分支）/
>     getViewerPluginURL（FileUrlHelper.getRawPath + locale + **$bodyScope.theme**——改 controllerScope）/
>     getViewerPlugin）→ imagesDir（darwin/win32 encodeURI 分支）→ current=images[0] → metas →
>     initContainer()。另有 `get.viewer.image` send（URL 直开 fallback，shims 需带 id 处理或守卫）。
>   - **initContainer（821-851）**：`$('#detail-container').smoothZoom({...})` —— 同阶段5 详情模式
>     的元素身份保持问题（zoom 实例 wrap 容器），React 侧容器必须永不重建；
>     smoothZoom('updateNavigator'/'focusTo'/'rotate'/'flip') 多处调用。
>   - **指令清单**（preview-window.js 128-2565）：mouseGesture(128，阶段5 已有 useMouseGesture)、
>     tgaImg(2367，阶段5 已有)、ngRightClick(2449)、toolbarBtn Pin/Unpin/Close/ZoomFit/
>     FrameByFrame/ZoomActual(2464-2550，模板极简)、navigator(2551，prev/next + disabled)。
>     comments-container/comment-item 阶段5 已有；webview/webview-toolbar 阶段5 已有。
>   - **控制器函数族**：窗口控制（minimize/maximize/restore/close/toggleFullScreen/isMaximize）、
>     缩放体系（updateZoomRatio/zoomActual/zoomFit/zoomFitEdge/toggleZoom/zoomIn/Out/
>     openRatioContextMenu/lastZoomMode localStorage eagle.viewer.lastZoomMode）、旋转翻转
>     （rotateImage/flipImage/rotateVideo/flipVideo，含 writeToFile 与 ipc）、视频
>     （videoScreenShot/saveVideoFrame/copeVideoFrame/nextFrameHandler/prevFrameHandler/
>     toggleVideoPlay）、GIF（gifViewer 对象 + toggleGifPlay/nextGifFrame/prevGifFrame/
>     toggleGifPlayerMode/openGifContextMenu）、字体（isFontActivate/activateFont/deactivateFont）、
>     拖拽模式（Shift 拖拽 overlay，keydown/keyup/mousemove/mouseup 全套）、右键
>     （openContextMenu 912-1022 大菜单 + isHideNavigator）、复制 toast（copyAsPath/Link/Image）、
>     selectNext/selectPrev（1762/1779）、getMetas/getRawUrl/getThumbnailUrl/get*Path 各查看器路径。
>   - **html 分区**：工具列 ng-switch（url|video|font|3d|gif|txt|通用 7 分支，navigator +
>     ic-btn-group）、容器（toast/not-support-preview/#detail-container + 12 种 ng-switch 查看器
>     分支：plugin/gif/raw/pdf/txt/font/url/video/tga/model/特殊格式/custom/svg/image + 隐形占位
>     img）、gif footbar（play/pause/帧/进度条/速度菜单/isGifReady 两态）。
>   - **分片**：9a-1 = 接线 + controller/shell 骨架 + image 分支 + preview-delivery driver 改写
>     （scope 门面 + $bodyScope 替换）→ 回归门绿；9a-2 = 视频/gif/pdf/txt/font/url/model/raw 分支
>     补全 + 交互全套；9a-3 = 工具列细节/右键/拖拽模式/grayscale。每片按固定节奏（tsc+冒烟+回归+PROGRESS+commit）。

> **9a-1 已验证并接管（2026-09-01）**：预览大窗第一片——接线 + controller/shell 骨架 +
> image/svg/gif(image 态)/pdf/video(含 bad→mpv 回退)/custom/plugin 分支 + driver 改写。
> - 新文件：react/preview-window/controller.ts（PreviewWindowController 无 Angular 全量移植：
>   模块级依赖/videojs SeekBar 覆写/拖放阻断/controllerScope 全字段方法（缩放体系/导航/窗口控制/
>   拖拽/动作/右键/GIF 播放器对象/字体/initContainer/init 序列/壳级行为/Mousetrap 绑定）；
>   门面 $root/$$phase/$watch('theme'|'current.id')/$on/$evalAsync/$apply；订阅
>   applyController/notifyController/subscribeController（notify 重入折叠）；契约
>   window.__eaglePreviewController + window.$bodyScope（gif iframe 与 detailHooks 既有通道））+
>   detailHooks.ts（usePreviewMouseGesture 128-411 逐字——linear-800 缩放公式/333ms 换页阈值/
>   右键 openContextMenu、usePreviewTgaImage 2367-2440 逐字、usePreviewMousetrap wMousetrap 语义）+
>   shell.tsx（静态壳 + 4 锚点 portal：工具列 7 分支/查看器 14 分支/gif footbar/toast/not-support）+
>   entry.tsx（'init' → applyController(runInitSequence)；就绪标记 __eaglePreviewEntryReady 在
>   effect 内设置——8e-2 教训：模块尾标记早于 commit 盲发丢失）。
> - 接线：preview-window.html 缩为静态壳（head 删 angular 系 11 脚本，保留 jquery/smoothZoom/
>   mousetrap/tif-img/videojs+4 语言包/shortcut-manager/global/devices/tippy vendor + i18n 内联；
>   **两段关键 inline stub**：(1) window.angular 微型 stub——smoothZoom 5 处
>   `angular.element("body").scope()` 兜底；(2) window.path/fs/fse/electron/shell/clipboard/
>   ipcRenderer/remote/Menu/MenuItem/currentWindow/USER_DATA_PATH/electronSettings——见下教训）；
>   body 四锚点（toolbar/content/footbar/react-host）+ #detail-container 身份永不重建
>   （smoothZoom wrap，同阶段5）。vite readPreviewWindow() + middleware 分支；shims preview:init
>   桥改缓冲（__eaglePendingPreviewInit + entry-ready 判断，未就绪 25ms 轮询补发兜底 10s）+
>   preview-window mock 分支改 marker 等待（优先发缓冲载荷否则 mock 载荷，`?id=` 选图）；main.cjs
>   --smoke-preview-delivery 驱动 4 行 `window.$bodyScope` → `window.__eaglePreviewController`
>   机械替换（其余 driver 零改动）。
> - **重大教训（FileUrlHelper 全局词法绑定）**：回归门首跑 copy-path action timeout——
>   clipboard.writeText 收到 undefined。根因：原版 preview-window.js（classic script）顶层
>   `const path` 形成全局词法绑定，global.js FileUrlHelper.getRawPath 解析裸 `path`；React 化后
>   该文件不再加载，controller.ts 的 const 是模块作用域不可见 → path.normalize ReferenceError
>   被 try/catch 吞 → 返回 undefined。reveal 之所以「通过」是 ipc params=undefined 时 shims
>   跳过路径校验直接走 itemId 分支（掩盖断点）。修复 = 静态壳 inline script 以 window 属性提供
>   全套等价绑定（裸标识符解析兜底到全局对象，classic/module 消费方皆可见）。诊断手段：
>   ELECTRON_ENABLE_LOGGING=1 转发 renderer console + shims 拦截器探针（JSON.stringify 丢弃
>   undefined 字段正是线索）。
> - shell 逐字要点：Pin/Unpin 双渲染（ng-show 语义，两 ic-btn 常驻 DOM）；gif footbar ng-if
>   （gifViewer on 或 usingGifPlayer）外层条件渲染 + ng-show（ext=='gif'）内层 style；play/pause
>   双渲染；速度 span 静态 "1x"（显示由 setSpeed 的 jQuery .text() 直写拥有，React 静态节点
>   diff 不回写——与原版一致）；速度菜单 gifViewer.setSpeed 经 applyController 直调（call()
>   只解析顶层方法）；zoomActual tippy-content 用 filters 的 shortcuts 求值；批注层用真实
>   useCommentsContainer/useCommentItem（svg 分支 remove 点击 = $root.removeComment 在预览窗
>   $rootScope 不存在 → 原版 no-op，守卫等价保留）；not-support-preview 抽独立组件（内部 ref +
>   usePreviewMouseGesture，ng-if 挂载时序）；body class 中 theme/platform 按 {{::}} 一次性绑定
>   冻结初值、仅 type-{{ext}} 活绑；#detail-container 的 ng-class（hidden-footer/is-model/
>   is-pdf/is-font/is-plugin/is-url/is-video）由 effect 差量应用（原模板 210-215 逐字表）；
>   alway-show-toolbar 用 scope.FONT_TYPES/URL_TYPES/MODEL_TYPES 表。
> - controller 修正：'init' 监听单一注册点在 entry（controller 构造期不重复注册，防双 init
>   二次 initContainer/smoothZoom 包裹）；scope.runInitSequence 暴露给 entry 经 applyController
>   调用；ctx/flipType 等 TS 空值标注补齐。
> - 闭环：preview-delivery-closed-loop 三跑全绿（imageLoaded/svg.width/gif mode=image/pdf.page/
>   jpg.width/video readyState=4/badVideo.unsupported（useMpvPlayer 回退）/videoInteraction
>   （volume 0.5, t>0.05）/renamed name+rawPath/trashRejected/missingRejected/open-default/
>   reveal/copy-path/copy-image/drag 全 ok，两轮 negative 拒绝）。全量回归：suite 两轮失败轮转
>   （第一轮 7a/7d1a/7d6a/main-ui-workflow、第二轮 7d3a/main-ui-workflow——既有偶发家族
>   轮转模式同 8e-2，六项单项重跑全部即绿）+ run-api-smoke-isolated 13/13；tsc 零错。
> - 9a-2 待办：txt/font/url/model/raw/tga/特殊格式分支交互补全 + gif iframe 播放器链路
>   （gif-viewer 读 window.parent.$bodyScope 已通）+ cgNotify 等价层（controller.notify 占位）+
>   web-view 宿主（url 分支 9a-2 补全）+ 工具列 tippy 挂载。

> **9a-2 已验证并接管（2026-09-01）**：预览大窗第二片——web-view 宿主 + cgNotify 等价层 +
> gif iframe 链路 + 两个全局环境修复（EagleConfig / angular stub 扩充）。
> - web-view 宿主（js/directives/webview.js 预览窗版逐字）：shell.tsx PreviewWebViewBranch——
>   内建 `<webview id="url-viewer" class allowpopups useragent httpreferrer>`（youtube-nocookie →
>   httpreferrer localhost/、medium → is-video class）、leave-full-screen exitFullscreen、
>   enter-html-full-screen darwin exitFullscreen + toggleSlideshow（预览窗控制器无此函数 → 守卫
>   no-op，原版此处本就抛 TypeError 的怪癖等价）、did-fail-load/console-message/crash/
>   will-navigate（原版 else 分支全注释 → 仅 log）/page-favicon-updated；外层恢复模板的
>   `.detail-wrap full {ext}` 包裹 div。WebviewToolbar（stage5 DetailToolbar）加守卫：
>   webviewTag 未启用的窗口里 `<webview>` 是普通元素（无 canGoBack 等 API）→ 不 setControl
>   （按钮经 controlRef.current?. 可选链保持可点无操作），修复 setControl 后渲染期
>   `canGoBack is not a function` 崩树卸载。
> - cgNotify 等价层（controller.ts）：angular-notify.min.js 逐字语义无 Angular 版——模板
>   `.cg-notify-message[.cg-notify-message-center]`（隐藏 message div + .cg-notify-message-template +
>   .cg-notify-close）；堆叠 startTop=10/verticalSpacing=15/关闭中 +20px；center append 后按
>   offsetWidth/2 负 margin-left；opacity transitionend 移除并重排；duration 默认 10000。
>   scope.notify/closeAll/undo = preview-window.js 449-484 逐字（messageTemplate 拼
>   `<span>message [<a>undo</a>]`、notify.closeAll 先行、100ms setTimeout、undo 链接点击
>   closeAll()+undo()、restoreCallbackk 写 scope.undo）；CSS 复用保留的 angular-notify.min.css。
> - gif iframe 链路验证：habits.gifViewer='on' → #gif-viewer iframe（src
>   gif-viewer/index.html?path=…&render=…）+ body gifviewer class + footbar init/in 双态渲染。
> - **修复（全局环境，回归门二次受益）**：(1) window.EagleConfig——global.js 顶层 const（全局
>   词法绑定非 window 属性），controller 的 VIDEO/AUDIO/MODEL/FONT/URL_TYPES 表此前全为空表
>   （`?.` 静默吞）、web-view 的 USER_AGENT 直接崩树——静态壳 inline stub 补
>   `window.EagleConfig = require(appRoot + '/config.js')`，ng-class 的 is-video/is-url/
>   is-model/hidden-footer/alway-show-toolbar 从此生效；(2) angular stub 扩充 injector——
>   smoothZoom navigator 位图分支 `angular.element("html").injector().get('$rootScope')`
>   （仅 supportCrop/supportRotate 属性写入 + $evalAsync）→ stub injector.get 恒返
>   window.$bodyScope；(3) tif-img.js 从静态壳 head 移除——其首行 `angular.module("tifImg",[])`
>   在无 Angular 页面必抛 uncaught（tga/tif 已由 usePreviewTgaImage/useRetryWhenError 承接）。
> - 诊断手段沉淀（React 树「静默空渲染」定位法）：reactRoot 存活 + portal 容器查到 + 无
>   console error ≠ 无崩溃——真凶是 200ms 后 setControl 的重渲染抛错被 React 吞掉；最终用
>   页面内 error/unhandledrejection/console.error 三钩子（`window.__eagleErrLog`）抓到。
>   8c 教训（Runtime.evaluate 不查 exceptionDetails 静默失败）再次命中。
> - 闭环：react-stage9a2-smoke 12/12（接线契约/init 到达（real-path 缓冲桥）/entry 标记/
>   初始渲染/webview 宿主（id/useragent/allowpopups/src + .detail-wrap full url 包裹）/
>   webview-toolbar/无未捕获错误/notify 显示（译文含字体名 + close 按钮）/1.8s 自动消失/
>   gif iframe + gifviewer class/footbar 双态/截图留档 test-run/react-stage9a2-preview.png）。
>   回归门 preview-delivery-closed-loop 复跑绿；全量回归 suite 32 项 ALL GREEN（runner 增
>   9a2；对比 9a-1 期两轮轮转偶发本轮零偶发）+ api-smoke 13/13；tsc 零错。
> - 9a-3 待办：工具列 tippy 实际挂载、右键菜单细节实测、拖拽模式 overlay 实测、grayscale、
>   窗口控制按钮实测。

> **9a-3 已验证并接管（2026-09-01；阶段9a 预览窗 React 化完成）**：工具列 tippy 实际挂载 +
> 拖拽 overlay/grayscale/窗口控制实测 + close 真实关窗。
> - tippy：ToolbarSwitch/GifFootbar 挂 useTippy（bundle 17365 移植、stage5 同款钩子），依赖串 =
>   [theme, currentIndex, images.length, isAlwaysOnTop, isMaximize, lastZoomMode, usingGifPlayer,
>   platform] / [theme, isGifReady, playing, speed]——变化即销毁重建（原指令 attrs $observe 语义）；
>   共享 useTippy 加**逐元素 try/catch**（原 Angular 指令逐元素初始化语义：一颗失败不中断兄弟——
>   重建批次里当前隐藏元素的 tippy() 一旦抛错，其后的按钮全部无 tooltip）。
> - 实测（react-stage9a3-smoke 16 断言全绿）：grayscale toggle → body is-grayscale-mode 翻转；
>   Shift 拖拽 overlay（window keydown/keyup keyCode 16 + document mousemove shiftKey →
>   #drag-mode-overlay .show，initShellBehaviors 的 jQuery 委托）；pin/unpin 双渲染显隐 + 翻转后
>   tippy 实例仍在（**shims mock remote 无 isAlwaysOnTop，断言以 scope 标志 + DOM 判定**）；
>   maximize/restore（isMaximize + restore/fullscreen 按钮 swap + remote.isMaximized）；scope.close()
>   → preview CDP target 消失（真实关窗）。**右键菜单族为 Electron native Menu——popup() 在自动
>   化环境阻塞/抢输入（首跑实证整条冒烟卡死），CDP 无法断言原生菜单 UI；构造路径不依赖 DOM，
>   自动化方案留待阶段11 与 bundle 一并处理**。
> - 教训：(1) 断言层级笔误（tippy 实例挂在按钮 div，断言查成 `img._tippy` 恒 undefined）制造
>   了"重建丢失"假象——逐轮采样版断言 1ms 即过才暴露；(2) 诊断探针会污染被测状态（手工
>   tippy 探针 attach/destroy 会孤儿化 React 挂的实例）——探针与断言必须隔离或用后清理；
>   (3) shims mock remote 的 window 方法面不全（无 isAlwaysOnTop、有 isMaximized）。
> - 闭环：react-stage9a3-smoke 全绿；回归门 preview-delivery 复跑绿；stage5 冒烟绿（useTippy
>   共享面无回归）；全量 suite 33 项（runner 增 9a3）仅 main-ui-workflow 一次既有偶发（单跑
>   即绿）+ api-smoke 13/13；tsc 零错。
> - 阶段9a 小结：预览大窗数据面/壳/全部 14 查看器分支/工具列/footbar/notify/tippy 已由
>   react/preview-window/* 承接；旧 js/preview-window.js 与 html ng-* 残留按「只改写不删除」
>   待阶段11 清理；剩余已知简化：右键菜单 native popup 无自动化、cgNotify undo 链路（restore
>   callback）仅激活字体路径可触发。
> - **9b collect-window（采集窗，独立 Angular app）**：src/app/collect-window/*（自有
>   controllers/directives/lib/vendors，约 15k 行含 vendors；index.html 145 行）。入口 = 浏览器扩展
>   采集流（main.cjs `get-collect-window-data` handle + shims collect-window 分支）。自包含度高。
> - **9c 定性（无运行时 UI，记录不移植，同 tagPopup/死代码先例）**：
>   - progress.html（510 行，通知/进度悬浮窗 + jieba/搜索关键词/web metas worker）：全仓唯一引用是
>     frontend/public/pages.html 的人工链接——本仓 main.cjs/shims/bundle 均未创建该窗口（原版主进程
>     功能未接入；库加载/导出进度已由 7d-6 窗口内对话框承载）。文件原样保留。
>   - thumbnail.html（9 行空白页）：bundle executeJavaScriptInIsolatedWorld 的隐藏离屏插件执行宿主
>     （缩略图 worker），页面刻意无 UI，无界面可移植，原样保留。
> - registration / manage-device：安全替代页，已删旧实现（早前完成）。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| preview-window.js | 独立页面 | `src/app/js/preview-window.js` (102KB) | 已验证（9a-1/9a-2/9a-3 全片接管：接线+controller/shell+14 查看器分支+工具列/footbar+cgNotify+tippy+gif 链路+窗口控制/拖拽 overlay/grayscale 实测；回归门 preview-delivery-closed-loop；旧文件随阶段11 清理） |
| collect-window | 独立页面 | `src/app/collect-window/*` | 待办（9b） |
| registration | 安全替代页 | `frontend/public/replaced/registration.html` | 已删旧实现 |
| manage-device | 安全替代页 | `frontend/public/replaced/manage-device.html` | 已删旧实现 |
| progress.html | 进度窗口 | `src/app/progress.html` | 无运行时入口，定性不移植（9c 勘察） |
| thumbnail.html | 缩略图窗口 | `src/app/thumbnail.html` | 空白离屏插件宿主，无 UI 可移植（9c 勘察） |
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
| emptyTrashProgress | directive | 63239-63422 | 已验证（7d-6a EmptyTrashProgress） |
| libraryLoadProgress | directive | 63422-63437 | 已验证（7d-6a LibraryLoadProgress） |
| libraryMergeProgress | directive | 63437-63528 | 已验证（7d-6a LibraryMergeProgress） |
| eaglepackImportProgress | directive | 63528-63601 | 已验证（7d-6a EaglepackImportProgress） |
| eaglepackExportProgress | directive | 63601-63698 | 已验证（7d-6a EaglepackExportProgress） |
| fileThumbnailProgress | directive | 63698-63707 | 已验证（7d-6b FileThumbnailProgress） |
| fileExportProgress | directive | 63707-63779 | 已验证（7d-6b FileExportProgress） |
| fileAddLibraryProgress | directive | 63779-64111 | 已验证（7d-6b FileAddLibraryProgress） |
| debugReportProgress | directive | 64111-64120 | 已验证（7d-6b DebugReportProgress） |
| webpConvertProgress | directive | 64120-64221 | 已验证（7d-6c WebpConvertProgress） |
| fixutilProgress | directive | 64221-64230 | 已验证（7d-6c FixutilProgress） |
| fixutilCleanEmptyFolderProgress | directive | 64230-64240 | 已验证（7d-6c FixutilCleanEmptyFolderProgress） |
| notSupportPreview | directive | 61393-61420 | 已验证（阶段5 随详情接管，详情模板唯一消费点） |
| pluginPanel | directive | 61420-62039 | 已验证（7d-5a PluginPanel） |
| pluginCreator | directive | 62039-62179 | 已验证（7d-5a PluginCreator） |
| pluginCenter | directive | 62179-62723 | 已验证（7d-5b PluginCenter） |
| pluginView | directive（独立模块）| 17598-17720 | 已验证（阶段5 随详情接管；inspectorPluginView 另算） |
| webView | directive | 64240-64319 | 已验证（阶段5 随详情接管，URL 分支唯一消费点） |
| webviewToolbar | directive | 64319-64399 | 已验证（阶段5 随详情接管，详情工具列唯一消费点） |
| websitePanelWebview | directive | 74147-74189 | 已验证（7d-1b WebsitePanel） |
| artstationImportModal | directive | 76464-76783 | 已验证（7d-2 ArtstationImportModal） |
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
