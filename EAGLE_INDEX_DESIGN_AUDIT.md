# Eagle index.html 设计审计报告

> 审计日期：2026-08-11
> 审计对象：`src/app/index.html`（2279 行）+ 关联 SCSS 源
> 设计方向（硬约束）：
> 1. **没有边框，没有分割线**。`border` / `border-top/right/bottom/left` / `1px solid` / `hr` / `.separator` / `box-shadow inset` 充当分割线的，都算违规。
> 2. 全体布局用 `gap + shadow` 规划，不用 border 分隔。
> 3. 多重嵌套区域用「突出（raised，外阴影）」与「凹陷（sunken，内阴影）」两种 shadow 交替绘制层级。
> 4. 所有颜色用 HSL 表达；大部分颜色共用同一个 H 值；主题切换 = 改 H 值。
> 5. 响应式、可访问性、触控目标不退化。
>
> 本报告先记录结构与元素（下次调整无需重新探查），再列问题清单、令牌系统、改造计划。

---

## 第一部分：结构与元素观察

### 1.1 CSS 加载链（`index.html` head，第 4-29 行）

| 顺序 | 文件 | 作用 |
|---|---|---|
| 1 | `css/modules/angular-notify/angular-notify.min.css` | 通知组件 |
| 2 | `css/vendors/sweetalert2/sweetalert2.min.css` | 弹窗库 |
| 3 | `css/jquery-ui.min.css` | jQuery UI（resize/sortable） |
| 4 | `css/icons.css` | 图标 sprite |
| 5 | `css/style_{{theme}}.css`（`ng-href`，`id="app-style"`） | **主题文件**，按 `theme` 动态切换：dark/light/blue/gray/lightgray/purple |
| 6 | `css/base.css` | **编译产物**，来自 `src/app/style/base.scss`（聚合 `style/base/*` + `style/components/*`） |
| 7 | `css/app.css` | **编译产物**，来自 `src/app/style/app.scss` |
| 8-11 | flatpickr / nouislider / videojs / colorpicker | 第三方组件样式 |

> ⚠️ **关键**：`style_*.css`、`base.css`、`app.css` 都是 SCSS 编译压缩产物，单行 minified。**不能手改这些 css**，要改 SCSS 源（见 1.2）。

### 1.2 SCSS 源文件地图

项目有两套 SCSS 源目录：

**A. `src/app/css/base/` + `src/app/css/components/`**（旧体系，编译到 `base.css`/`app.css`）

```
base/
  _color.scss        # 颜色变量源（hex 体系，$primary-color #0072EF 等）
  _typography.scss   # 字号 px 阶梯
  _layout.scss       # padding/margin 工具类（无 gap 工具）
  _borderRadius.scss
  _font.scss
  _position.scss
  _animation.scss
  _reset.scss
components/
  _content-area.scss  # 26KB，detail/inline/not-support-preview
  _grid.scss          # 20KB，box 网格
  _button.scss        # 10KB
  _form-elements.scss # 10KB
  _tags-popup.scss    # 7.5KB
  _crop-image-tool.scss
  _smart-folder-modal.scss
  _import-artstation-modal.scss
  _scrollbar.scss / _menu.scss / _loader.scss / _spinner.scss
  _slideshow.scss / _website-panel.scss / _txt-content.scss
  _ext-icon.scss / _annotation-preview.scss / _error-modal.scss
```

**B. `src/app/style/`**（新体系，编译到 `base.css`/`app.css`，与 A 聚合）

```
style/
  app.scss            # 入口
  base.scss           # 聚合 base/*
  base/
    _color.scss       # :root CSS 变量源（$colors hex map + @while rgba 步进生成器）
    _animation.scss
    _font-family.scss
  components/
    _sidebar.scss          # 侧栏外壳/header/footer
    _sidebar-list.scss     # 侧栏列表项/guidelines/active-bg/drop
    _toolbar.scss          # 工具栏/breadcrumbs/search
    _filter-panel.scss     # 筛选栏/.separator
    _corner-btns.scss      # 右上角按钮/.separator
    _btn.scss              # .ic-btn
    _box-container.scss    # 图片网格
    _sub-folder-list.scss  # 子文件夹卡片
    _list-layout.scss      # 列表布局表头
    _empty-area.scss       # 空状态
    _lock-screen.scss      # 密码锁屏
    _modal.scss             # 弹窗基类
    _footbar.scss           # gif 工具栏
    _gif-player.scss
    _inspector.scss / _context-menu.scss / _tippy.scss / _toast.scss
    _form.scss / _form-elements.scss / _range.scss / _toggle.scss
    _search-suggestion.scss / _saving-progress.scss / _upload-progress-bar.scss
    _video-player.scss / _webview-toolbar.scss / _welcome-page.scss
    _hover-preview.scss / _labels-input.scss / _tag-manager.scss
    _progress-dialog.scss / _swal.scss / _text-editor.scss / _type-label.scss
    _spinner.scss
    modal/                  # 弹窗子目录
```

> 两套体系并存是历史遗留。**改 SCSS 源时两套都要看**，同名选择器可能两处都有定义。

### 1.3 body 根元素（第 31-68 行）

```html
<body theme="{{theme}}" platform="{{::platform}}" vibrancy="{{vibrancyEnabled}}"
  class="{{::platform}} {{language}} current-focus-{{currentFocus}} {{viewMode}}-view"
  ng-class="{ layout-fill, is-windows-11, is-detail-mode, is-inline-mode,
    is-comment-mode, is-grayscale-mode, hide-navigator, is-small-box,
    is-middle-box, is-square-layout, show-list-*, box-sortable, cropping,
    is-maximize, hide-sidebar, hide-inspector, hide-all, is-filter-open,
    slideshow, hide-badge, hide-zoom-btn, show-transparent-grid }">
```

主题切换入口：`theme="{{theme}}"` → `body[theme="dark"]` 等。这是改 H 值的落点。

### 1.4 各区域 DOM 结构与关键选择器

#### A. 侧栏 sidebar（第 76-493 行）

```
#sidebar .sidebar                         → style/components/_sidebar.scss
├─ .hover-show-sidebar                    # 悬停触发区
├─ .application-menu-btn                  # 应用菜单按钮
├─ #sidebar-scroll-to-top.scroll-to-top   # 回顶按钮（四向 border）
├─ .sidebar-header                        # 顶栏（library 信息 + toolbar）
│  ├─ .sidebar-library-info
│  │  ├─ #library-warning.library-warning # NTFS/性能警告（四向 border）
│  │  ├─ #background-state-spinner        # 颜色分析 spinner
│  │  └─ .library-switch-btn              # 资源库切换
│  └─ .sidebar-toolbar
│     └─ .icon-btn × 3                    # 新增/切换/显示隐藏
├─ .sidebar-container                     # 列表滚动容器（vs-repeat 虚拟滚动）
│  ├─ .sidebar-scroll-helper.top/.bottom
│  └─ #sidebar-item-container.sidebar-item-container
│     └─ [ng-repeat] .sidebar-folder-item / .item / .separator / .sidebar-item-label
│        ├─ .guidelines > .guideline      # 引导线（border-left + border-bottom）
│        ├─ .expand-icon                  # 展开箭头
│        ├─ .icon > .fake-svg             # 图标
│        ├─ .name                         # 名称（title 属性）
│        ├─ input[type=text]              # 重命名输入框
│        ├─ .badge.self / .badge.descendant # 计数徽标
│        ├─ .active-bg                    # 选中背景（border）
│        └─ .multiple-drop-folder-*-area  # 拖放落区
├─ .sidebar-droparea                      # 拖拽区
└─ .sidebar-footer                        # 底栏（搜索框 #folder-search）
```

- 列表项 `vstype` 类型：`folder / all / unfiled / untagged / recent / random / community / allTags / trash / separator / label-qucik-access / quickAccess / label-smart-folder / smartFolder / label-folder`
- `.sidebar-item-label`：快速访问/智能文件夹/文件夹 区隔标签
- 关键尺寸：`.item height:26px`、`.tool-btn width:24px`、搜索框 `height:28px`（均 <44px）

#### B. 网页浏览器 website-panel（第 495-515 行）

```
#website-panel.website-panel              # community 视图 webview 容器
├─ .drag-area
├─ .loader > svg.spinner
├─ webview#website-panel-webview
└─ .website-panel-webview-control         # 控制条（前进/后退/刷新/打开）
```

#### C. 内容区 content-panel（第 517-987 行）

```
#list-content-panel.content-panel         # 主内容容器
│  style="left:{{sidebar+1}}px; right:{{inspector.width+1}}px"
├─ #saving-progress-bar                   # 文件写入进度
├─ #upload-queue-progress                 # 档案添加进度
├─ .search-suggestions                    # 搜寻自动提示
├─ .toolbar                               # 列表模式工具列（见 D）
├─ .toast-alert / .toast-alert.warning.bottom  # 失败/本地/权限提示
├─ #filter-toolbar.filter-toolbar         # 筛选工具列
│  ├─ .filter-items > [ui-sortable] filter-item-* 组件
│  └─ .filter-right > .separator + .ic-btns
├─ #filter-toolbar-overlay
├─ #box-container-scrollbar               # 自定义滚轴
├─ tag-manager                            # 标签管理 directive
├─ #scroll-to-top
├─ #box-container.box-container.grid-layout   # 图片列表
│  ├─ .drop-area / .lock-screen / 空状态插图
│  ├─ #sub-folder-container .sub-folder-list > .sub-folder  # 子文件夹卡片
│  ├─ #list-layout-header .prop × 7        # 列表布局表头（border-top+bottom）
│  └─ #box-list.box-list [ng-grid-layout]   # 图片网格
└─ .box-container-droparea                # 容器拖拽区
```

- 空状态插图：`empty-library/empty-folder/empty-search/empty-unfiled-*/empty-untagged-*/empty-trash.png`
- 子文件夹卡片 `.sub-folder`：`.thumbnail > .pic × 3 + .lock-icon`、`.name`、`.metas`
- list-layout 表头 `.prop`：thumbnail/name/tags/resolution/rating/ext/size/mtime

#### D. 工具栏 toolbar（第 554-756 行，详情模式 993-1143 行）

```
.toolbar                                  # 列表模式工具列
├─ .breadcrumbs                          # 面包屑（-webkit-app-region:drag）
│  ├─ .application-menu-btn              # 隐藏侧栏时的应用菜单
│  ├─ #toggle-all-btn.ic-btn             # 侧栏显隐
│  ├─ .ic-btn.prev / .ic-btn.next        # 上一页/下一页
│  └─ ul > li × N                        # 面包屑项（all/unfiled/untagged/recent...）
├─ #box-list-slider.sliders-bar.has-btn  # 缩放滑块
│  └─ .slider > .ic-btn.zoom-btn × 2 + .range-wrap > input.range
└─ .right                                # 右侧常驻区
   ├─ .pinned-plugins [ui-sortable]      # 置顶插件（::after 分割线）
   ├─ .ic-btn.filter-btn × N             # 插件/随机/动作/排序/筛选
   ├─ .tabs > .tab × 2                   # 标签管理布局切换
   ├─ .ic-btn                            # 标签排序
   ├─ .search-wrap                       # 搜寻框
   │  ├─ .scope-select                   # 范围选择
   │  └─ input#search.search
   └─ corner-btns                        # 右上角按钮（.separator 分割线）
```

详情模式工具栏：`.toolbar.has-border`（第 994 行，**类名残留但无对应 scss 规则**）

#### E. 详情模式 detail-mode（第 989-1531 行）

```
.content-panel.detail-mode                # 详情容器
├─ .toolbar.has-border                   # 详情工具列
│  ├─ .breadcrumbs > #toggle-all-btn + .ic-btn.prev + ul > li.show .counter
│  ├─ .sliders-bar.center.long           # 缩放滑块 + .ic-btn 比例显示
│  ├─ webview-toolbar                    # 书签工具列（URL 类型）
│  ├─ .right (isCropMode)                # 裁切：宽高 input + save/cancel
│  ├─ .right (插件预览)                   # 上下页
│  └─ .right (通用)                       # 旋转/翻转/裁切/标注/实际像素/适应/上下页
├─ .footbar                              # gif 工具栏（box-shadow:0 -1px 0 分割线）
│  └─ .gif-toolbar > .gif-toolbar-btn × N + .progress-bar + .speed-menu
├─ #is-last-item / #is-first-item        # 边界提示
├─ .not-support-preview                  # 无法预览
├─ .inline-toolbar                        # inline 模式工具条
│  ├─ .inline-toolbar-btn.prev-btn
│  ├─ .inline-pages > .curr + img + .total
│  └─ .inline-toolbar-btn.next-btn
├─ #inline-close-btn.inline-float-btn    # inline 关闭
└─ #detail-container.detail-container    # 详情容器
   └─ [ng-switch] .detail-wrap.{ext}     # 按类型切换查看器
      ├─ plugin / pdf / gif / raw / video / audio / font / txt
      ├─ tif/tiff / tga / model / 特殊格式 / custom / url / svg / image
      └─ .image-wrap > .comments > .comment × N   # 标注（.badge + .remove + .annotation）
```

- `.comment`：`border:1px solid $primary`、`border-radius:3px`、`resize:both`
- `.badge`：`border:2px solid #fff`、`background:$primary`
- `.annotation`：`background:#fff`、`box-shadow:0 2px 12px`

#### F. 弹窗 modals（第 1554-2200 行）

```
.modal-flex-center × N                    # 弹窗容器（居中）
└─ .modal.{type}-modal ng-class="{'open':isOpen}"
   ├─ .modal-header > .name + .close     # 标题栏（border-bottom 分割线）
   ├─ .section.search                    # 搜索区（border-top/bottom）
   ├─ .search-result > .result-content   # 结果列表（vs-repeat）
   │  └─ .sidebar-item-container > .item × N
   └─ .section.darken.textAlign-right     # 底栏（border-top）
      └─ .button.button-xs.button-primary/grey × N
```

弹窗类型：
- `move-folder-modal`（AddToFolderController + MoveFolderController）
- `auto-tagging-modal`（AutoTaggingController，tags-input）
- `smart-folder-modal`（NewSmartFolderController，条件规则编辑器）
- `error-modal`（ErrorModalController，表格列表）
- 其他 directive：`batch-save-panel / plugin-panel / plugin-creator / plugin-center / layout-panel / folder-select-panel / general-tag-select-panel / inspector-tag-select-panel / duplicate-scan-panel / duplicate-modal / mousewheel-setting-modal / context-menu / folder-password-modal / notification-modal`

#### G. 全局浮层（第 2172-2251 行）

- `welcome-page`、`new-version-notification-modal`、`about-panel`、`library-panel`
- 进度条 directives：`empty-trash-progress / library-load-progress / library-merge-progress / eaglepack-import-progress / eaglepack-export-progress / file-thumbnail-progress / file-export-progress / file-add-library-progress / debug-report-progress / webp-convert-progress / fixutil-clean-empty-folder-progress / fixutil-progress`
- `.lock-screen.app-lock-screen`（第 2202 行，应用锁）
- `#multiple-drag-placeholder`
- `#colors-picker`（隐藏 color input）
- `#annotation-preview-container`（图片标注预览，contenteditable）
- `#hover-preview-container`（悬停预览）
- `#tag-manager-drag-badge`

### 1.5 颜色体系现状（关键发现）

**`src/app/css/base/_color.scss`**（SCSS 变量源）：
- `$black-color: #303134`（第 6 行）——各主题在此覆盖为不同 hex
- `$primary-color: #0072EF`（第 11 行）+ `darken/lighten` 派生
- `$secondary-color: #14486F`、`$third-color: #A3C42F`
- `$folder-color-*`：8 个 hex（red/orange/green/yellow/aqua/blue/purple/pink）
- `$grey-900: #1A1C27` + `lighten` 阶梯（第 102-110 行）
- `$steel/slate/sliver/smoke/snow` 全 hex（第 132-140 行）
- `$icon-btn-*`、`$sidebar-item-*`、`$sidebar-label-*`：`rgba(251,252,255,X)`（第 317-336 行）
- `$modal-border: 1px solid rgba(...)`（第 338 行）
- `$modal-box-shadow`（第 339 行，全仓唯一 shadow 令牌）

**`src/app/style/base/_color.scss`**（:root CSS 变量源）：
- `$colors` hex map + `@while` 循环生成 `--color-*-1..99` rgba 步进
- `--color-primary: #3297FF`(dark) / `#0072ef`(light) 两套
- `--box-border-top/right/bottom/left` 四向 1px solid 令牌
- `--box-border-no-shadow: 0 0 0 1px`（本质 1px 描边）
- `--box-border-shadow: 0 12px 24px + 0 0 0 1px`

**主题文件**（`style_dark.scss` 等）：
- 各自覆盖 `$black-color: #hex`（dark `#18191c` / blue `#0d1630` / purple `#1C1424` / gray `#303134`）
- `style_light.scss` 重新定义所有 folder-color-* 为另一套 hex

> **没有 HSL，没有共享 H 值，没有 raised/sunken 令牌。** 这是 TOKEN-01 的核心。

### 1.6 间距体系现状

- `src/app/css/base/_layout.scss`：约 60 个 `paddingX-*/marginX-*` 工具类（xxs=5/xs=10/s=15/m=20/l=40/xl=80）
- `app.css` 里 `gap` 仅出现 1 处
- 组件内普遍用 `margin-left/right` px + `absolute top/left/right/bottom` 偏移
- 无 `--space-*` CSS 变量

### 1.7 字号体系现状

`src/app/css/base/_typography.scss`：
- `fontSize-xxxxl:48px / xxxl:38px / xxl:28px / xl:20px / l:18px / m:16px / s:14px / xs:13px`
- 全固定 px，无 `clamp()`/`rem`

---

## 第二部分：问题清单

### P0 — 阻断，违反硬约束

| ID | 类别 | 区域 | 问题 | 修法 |
|---|---|---|---|---|
| **TOKEN-01** | token | 全部 6 区 | 颜色体系基于 hex + rgba 阶梯 + SCSS `darken/lighten`，没有 HSL，没有共享 H 值。主题切换靠每个 `style_*.scss` 重定义 `$black-color`（`#18191c`/`#0d1630`/`#1C1424`/`#303134`）或 `style/base/_color.scss` 整块重定义上百个 rgba 令牌，而非改一个 H。`primary` 还分 `#0072ef`(light)/`#3297FF`(dark) 两套硬编码。直接违反方向#4。 | `_color.scss` 顶部定义 `$hue`（每主题只改它），中性色全改 `hsl($hue $sat L%)`，primary 改 `hsl($hue 90% 50%)`，删 `darken/lighten`；`style/base/_color.scss` 的 `$colors` hex map + `@while` rgba 步进生成器删掉，改 `:root{--h:220; --color-primary: hsl(var(--h) 90% 50%);}`，各 `style_*.scss` 只覆盖 `--h`。 |
| **DIV-01** | border-divider | 工具栏/内容区/弹窗 | `.separator` 类（`width:1px/height:1px + background-color`，含 `::before/::after` 画 1px 实线）在工具栏、筛选栏、corner-btns、内容区、move-folder-modal 多处复用，`app.css` 里集中存在 12 条 `.separator` 规则。`hr` 也被设为 `border-top:1px solid`。 | 删除 `.separator` 类与 DOM 节点；分组父容器改 `display:flex; gap:var(--space-m)`；如需视觉分组用 raised shadow 包裹而非画线。 |
| **DIV-02** | border-divider | sidebar/工具栏/详情/弹窗/令牌 | `--box-border-top/right/bottom/left` 四向各 1px solid 令牌 + `$modal-border`，被 sidebar scroll-to-top、library-warning、sidebar-footer 搜索框、active-bg、speed-menu、modal 四向包边等大量复用。`--box-border-no-shadow(0 0 0 1px)` 本质仍是 1px 描边。 | 删四向 box-border 变量与 `$modal-border`；新增 `--shadow-ring`/`--shadow-raised`/`--shadow-sunken`，边界与层级一律用 box-shadow。 |
| **DIV-03** | border-divider | 内容区/弹窗/sidebar | 用 `border-top/border-bottom:1px solid` 充当区块/行/表头分割线：`modal-header` border-bottom、`.section/.section.darken` border-top/bottom、`.condition` border-top rgba(0,0,0,.3)、error-modal `.tr/.tr.header` border-bottom、move-folder `.search-result` border-bottom、`#list-layout-header` border-top+bottom。 | header/body 间用 padding/gap；header 用 raised、body 用 sunken 交替；section 间 `flex column + gap`；行间用 gap + 行内 padding，不画 1px 线。 |
| **DIV-04** | border-divider | 全部 5 区 | 单元素用 1px/2px solid border 充当容器轮廓或交互态：sidebar resize 手柄、scroll-to-top 四向、library-warning 四向、搜索框 border+focus border、.active-bg/.context-activate/.drop、box-container droparea `border:2px`、sub-folder 堆叠卡、box 缩略图 `::after`、空状态 CTA、lock-screen input、speed-menu/thumbnail-preview 四向(+3px 加粗)、.comment/.badge/.remove、vjs-control-bar、multiple-drag-helper。 | resize 手柄用 background+shadow；选中/拖放用 raised ring；context-activate 用 sunken；堆叠卡用 sunken+位移；缩略图 `::after` 改极轻 raised；CTA/lock-screen input 用 raised/sunken。 |
| **DIV-05** | border-divider | 详情/工具栏/令牌 | 用 `box-shadow`（含 inset）充当 1px 分割线：`.footbar` `box-shadow:0 -1px 0`、`.filter-bar` `inset 0 -1px 0 rgba(0,0,0,.40)` + `inset 0 1px 0 rgba(255,255,255,.1)`、`search-wrap.dragenter` `box-shadow:0 0 0 1px primary`（本质 1px ring）。 | footbar 改 sunken 内阴影表达凹陷，与上方 raised 交替；filter-bar inset 删除改 raised 浮起；dragenter ring 改 `0 0 0 2px` + 外投影。 |
| **HIER-01** | hierarchy | 全部 6 区 | 全局完全没有 raised/sunken 阴影分层令牌，也没有 `.raised/.sunken` 工具类（base.css grep raised/sunken/elevation=0，仅 `$modal-box-shadow` 一处）。sidebar header/container/footer/active-bg、toolbar 各层、内容区 box→sub-folder→box 三层、detail-container→detail-wrap→image-wrap、modal 嵌套全部扁平，靠 border/分割线/背景色/opacity 区分。违反方向#3。 | 新增 `--shadow-raised`/`--shadow-sunken` 令牌与 `.raised/.sunken` 工具类；嵌套层交替：sidebar 整体 raised→列表区 sunken→active-bg raised；toolbar raised→filter-toolbar sunken；box-container sunken→sub-folder/list-header raised；detail-container sunken→footbar raised；modal raised→section.darken footer sunken。 |
| **DIV-06** | border-divider | sidebar/工具栏/内容区 | 用 `border/border-color` 表达 focus/active/drag 交互态：sidebar-footer 搜索框 `border-color + :focus border:1px solid`、toolbar 搜索框 `border:var(--input-border) + :focus border:1px solid primary`、lock-screen input border+focus、.active-bg border、.context-activate/.drop border。 | 常态输入框用 sunken 内阴影表达凹陷输入槽；focus 用 `box-shadow: 0 0 0 2px hsl(var(--h) 90% 50% / 0.5)` 聚焦环叠加；选中/激活用 raised 外阴影。 |

### P1 — 主要，影响体验

| ID | 类别 | 区域 | 问题 | 修法 |
|---|---|---|---|---|
| **TOKEN-02** | token | 全部 6 区 | 组件级大量硬编码 hex/rgba/独立 HSL 字面量，主题切 H 不跟随：sidebar `#fff/#333/#777`、内容区 `#fff/#000/#888/#e0e0e0/#fbff00/#FF9F0A`、detail `$black-color#303134/$primary#0072EF`、gif-toolbar `#BDBEC0/#50555B`、modal `rgba(0,0,0,0.3)/#222/hsl(228,6.17%,30.88%)`。 | 全换 HSL token：`#fff`→`--surface-text-on-primary`、`#000/#333`→`hsl(var(--h) 8% 11% / 30%)`、`#888/#777`→`hsl(var(--h) 6% 50%)`、独立 `hsl(228,...)` 并入 `--h`。 |
| **SPAC-01** | spacing | 全部 6 区 | 布局用 margin/padding px + absolute 定位 + 硬编码 magic offset 而非 flex gap：sidebar `top:86px/bottom:44px/margin-left:40px/left:36px/right:2px`、toolbar `margin-left:2px/8px`、内容区 `padding:40px + margin-bottom` 阶梯、detail 负 margin 撑满、modal `margin-top/bottom`、index.html inline `style="width:85px;margin:0 0 0 6px;float:right"`。`app.css` gap 仅 1 处，`_layout.scss` 约 60 个 padding/margin 工具类无 gap。 | 父容器统一 `flex/grid + gap:var(--space-*)`；删子元素 margin 与负 margin；inline style 全提取到 SCSS；sidebar 改 flex column + gap，列表项 icon/name/badge 用 flex+gap 删 `left/right` 偏移。 |
| **A11Y-01** | a11y | 全部 6 区 | 可交互元素触控目标普遍 <44px：sidebar `.item/.expand-icon` 26px、`.tool-btn` 24px、搜索框 28px；toolbar ic-btn/zoom-btn/scope-select 23-24px、corner-btns 24×24；内容区 `.checkbox` 13×13、`.expand-icon` 12px；detail gif-toolbar-btn 24×24、inline-float 32×32、speed-menu 28px；modal `button-xs` 24-26px。 | 可点击元素 `min-height:44px; min-width:44px`（视觉 glyph 可小，透明 padding 撑 hit area）；`@media (pointer: coarse)` 单独放大；提供 `:focus-visible` 可见焦点环。 |

### P2 — 次要

| ID | 类别 | 区域 | 问题 | 修法 |
|---|---|---|---|---|
| **RESP-01** | responsive | 工具栏/内容区/详情/弹窗 | 固定 px 宽高在窄窗/大字缩放下退化：toolbar `height:48px` + 多档固定搜索框宽 220/200/180px + breadcrumbs `max-width:calc(100%-500px)`；modal smart-folder `width:600px`、error-modal 列宽 200/300px、默认 `.modal` 480px；detail not-support `top:76px/bottom:40px`、footbar `right:251px` 硬编码 inspector 宽；list-layout `min-width:640px` 强制横滚；字号全固定 px 无 clamp/rem。 | 搜索框 `flex:1; min-width:160px; max-width:240px`；breadcrumbs `min-width:0; flex-shrink:1` + ellipsis；modal `width:min(600px, calc(100vw - 32px))`；footbar right 绑定 inspector CSS 变量；字号 `clamp()`。 |
| **A11Y-02** | a11y | 令牌 | `index.html:7` viewport 设 `maximum-scale=1, user-scalable=no` 禁止用户缩放，低视力/窄窗可访问性退化。 | viewport 改 `width=device-width, initial-scale=1`（删 maximum-scale 与 user-scalable=no）。 |

> P3（工具栏 `has-border` 残留类名、`.tips` 硬编码 `#fff` 等）零散且无系统性，不展开。