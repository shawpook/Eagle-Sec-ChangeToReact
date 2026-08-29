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

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
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

工具列对应 index.html 顶部 toolbar/`#filter-open` 区块。

---

## 4. 内容网格（ng-grid-layout / vs-repeat / thumb）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| ngGridLayout | directive | 66496-67305 | 待办 |
| vsGridRepeat | directive（独立模块 vsGridRepeat）| 14686-15113 | 待办 |
| vsRepeat | directive（独立模块 vs-repeat）| 16865-17425 | 待办 |
| lazyImgContainer | directive | 70461（被注释）| 待办 |
| infiniteScroll | directive | 70505（被注释）| 待办 |
| vsAutoScroll | directive | 69856-69904 | 待办 |
| imageonload | directive | 70763-70781 | 待办 |
| retryWhenError | directive | 70198-70224 | 待办 |
| retryWhenThumbError | directive | 70224-70250 | 待办 |
| tgaImg | directive | 70250-70326 | 待办 |
| extIcon | directive | 70817-70837 | 待办 |
| boxContainerScrollbar | directive | 73114-74147 | 待办 |

网格与缩略图容器对应 index.html `#box-container` / `.item-view` 区块。

---

## 5. 详情模式与查看器（bitmap-viewer / media-element / 详情布局）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| mediaElement | directive（独立模块 mediaElement）| 64843-65684 | 待办 |
| mpvMediaElement | directive（独立模块 mpvMediaElement）| 65684-66094 | 待办 |
| audioMediaElement | directive | 66094-66496 | 待办 |
| commentVideo | directive | 70781-70817 | 待办 |
| commentItem | directive | 72215-72353 | 待办 |
| commentsContainer | directive | 72353-72439 | 待办 |
| rectComment | directive | 72439-72564 | 待办 |
| rectSelect | directive | 72564-72799 | 待办 |
| drawboard | directive（源码镜像）| app.bundle 未注册（见 js/directives/drawboard.js）| 待办 |
| cropImage | directive | 71520-72215 | 待办 |
| mouseGesture | directive | 70837-71140 | 待办 |

详情模式对应 index.html `#detail-container` / `#bitmap-viewer` 区块。

---

## 6. 检查器（inspector / inspector-*）

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| inspector | directive | 54273-55301 | 待办 |
| inspectorTags | directive | 55301-55309 | 待办 |
| inspectorFolders | directive | 55309-55317 | 待办 |
| inspectorAnnotations | directive | 55317-55325 | 待办 |
| inspectorInformation | directive | 55325-55439 | 待办 |
| inspectorPlugin | directive | 55439-55447 | 待办 |
| inspectorPluginView | directive（独立模块 inspectorPluginView）| 17720-17598 | 待办 |
| inspectorTagSelectPanel | directive | 57911-58122 | 待办 |
| foldersInput | directive | 64399-64443 | 待办 |
| tagsInput | directive | 64443-66094（tags-input 模板在 index.html）| 待办 |

对应 index.html `#inspector` 区块。

---

## 7. 弹窗 / 右键 / 标签 / 面板

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| contextMenu | directive（独立模块 contextMenu）| 15847-16396 | 待办 |
| contextMenuEmojiItems | directive | 16396-16580 | 待办 |
| contextMenuItems | directive | 15847 模块内 | 待办 |
| quickSearchModal | directive | 60788-61393 | 待办 |
| tagManager | directive | 55447-56356 | 待办 |
| folderSelectPanel | directive | 56356-57911 | 待办 |
| generalTagSelectPanel | directive | 58122-58257 | 待办 |
| tagSelect | directive | 72799-73003 | 待办 |
| batchSavePanel | directive | 58257-59288 | 待办 |
| batchRectSelect | directive | 59288-59423 | 待办 |
| duplicateModal | directive | 59423-59705 | 待办 |
| duplicateScanPanel | directive | 59705-60104 | 待办 |
| mergeEditor | directive | 60104-60358 | 待办 |
| batchRenameModal | directive | 76783-77785 | 待办 |
| folderPasswordModal | directive | 62888-63049 | 待办 |
| mousewheelSettingModal | directive | 63049-63078 | 待办 |
| aboutPanel | directive | 63078-63102 | 待办 |
| notificationBtn | directive | 54236-54273 | 待办 |
| notificationModal | directive | 62777-62814 | 待办 |
| newVersionNotificationModal | directive | 62814-62888 | 待办 |
| welcomePage | directive | 63102-63187 | 待办 |
| cornerBtns | directive | 63187-63239 | 待办 |
| layoutPanel | directive | 62723-62777 | 待办 |
| selectAll | directive | 70600-70614 | 待办 |
| editableSelectall | directive | 70614-70641 | 待办 |
| noSpecialChar | directive | 70567-70600 | 待办 |
| contenteditable | directive（独立模块）| 15619-15847 | 待办 |
| ngRightClick | directive | 70544-70559 | 待办 |
| ngLongClick | directive | 70737-70750 | 待办 |
| ngHoverIntent | directive | 70750-70763 | 待办 |
| autoFocus | directive | 73003-73018 | 待办 |
| repeatDone | directive | 70559-70567 | 待办 |
| colorPicker | directive | 70388-70423 | 待办 |
| tippy | directive（独立模块 tippy）| 17365-17425 | 待办 |
| yaNoUiSlider | directive（独立模块）| 17425-17598 | 待办 |
| ngFlatpickr / autoPositionContextMenu / mouseGesture 等 | directive | 见源码 | 待办 |

控制器（弹窗/面板逻辑）：
| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| NewSmartFolderController | controller | 74323-74733 | 待办 |
| AddToFolderController | controller | 74733-75637 | 待办 |
| MoveFolderController | controller | 75637-76136 | 待办 |
| ErrorModalController | controller | 76136-76464 | 待办 |
| AutoTaggingController | controller | 74190-74323 | 待办 |
| WebsitePanelController | controller | 74094-74190 | 待办 |
| tagPopup（源码镜像 js/controllers/tag-popup.js）| controller | 源码 | 待办 |

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
| notSupportPreview | directive | 61393-61420 | 待办 |
| pluginPanel | directive | 61420-62039 | 待办 |
| pluginCreator | directive | 62039-62179 | 待办 |
| pluginCenter | directive | 62179-62723 | 待办 |
| pluginView | directive（独立模块）| 17598-17720 | 待办 |
| webView | directive | 64240-64319 | 待办 |
| webviewToolbar | directive | 64319-64399 | 待办 |
| websitePanelWebview | directive | 74147-76464 | 待办 |
| artstationImportModal | directive | 76464-76783 | 待办 |
| findStringAutocomplete | directive | 77785-末 | 待办 |
| alwaysFocus | directive | 69688-69704 | 待办 |
| autoScroll | directive | 70697-70737 | 待办 |
| scrollToActive | directive | 70641-70672 | 待办 |
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
| tifImg | tif 图 | 16580 | 待办 |
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
