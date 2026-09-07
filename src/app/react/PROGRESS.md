# Eagle React 化改造进度清单（PROGRESS）

> 唯一跨会话续作依据。开工先读本文件，从第一个「待办」继续。
> 规范来源：`src/app/js/app.bundle.js`（逻辑）；`src/app/index.html` 与 `src/app/js/directives/*.html`（DOM）；
> `src/app/style/*.scss` / `src/app/css/*.css`（样式）；`src/i18n`（i18n）；`src/my_modules/electron-settings`（偏好）。
> 状态：待办 / 进行 / 已验证 / 已删旧实现。完成定义 = 无「待办/进行」+ index.html 移除 angular.min.js + 全闭环测试绿。

说明：
- 行号均为 `src/app/js/app.bundle.js` 中的定位（用 `grep -n "EagleApp.directive('xxx'" app.bundle.js` 可复现）。
- 每个阶段一个 commit，提交前必须：`npx tsc` 无错 + dev 栈可用 + CDP 闭环断言绿 + `tests/api-smoke.mjs` 哨兵绿 + 删除旧引用。

---

## ⚠️ 项目级约束：markdown 组件不属于原框架 —— 隔离、不处理

**决策（2026-09-04，用户裁定）**：markdown 相关组件/断言**不是 Eagle 原框架（bundle）内的
东西**，是后续叠加物。处理方式：**隔离 + 完全略过**——不修复、不补齐、不当回归查。

- 依据：原框架 `SPECIAL_TYPES`（bundle 18994）**不含 `md`/`markdown`**；`metas` 分支
  （bundle 34929）对 md 走 `width x height` 而非文件体积。所谓「markdown meta shows
  file size」是后加预期，不是原框架行为。
- 已执行的隔离（可逆，均为 `IGNORED` 备注）：
  1. `tests/main-ui-workflow-closed-loop.mjs`：不再创建 markdown 样例、不再传
     `EAGLE_WORKFLOW_MARKDOWN_SOURCE`；
  2. `electron/main.cjs`：`markdownSource` 恒置空 → 其 markdown drop / thumbnail /
     meta 断言全段恒跳过（`markdownDrop` 恒 `null`）。
- **约束**：后续任何会话**不得**为了满足 markdown 断言而改业务代码（如把 `md` 塞进
  `SPECIAL_TYPES`、给 md 加 `noPreview`、补 md 渲染链）；若某套件因 markdown 阶段失败，
  按「隔离项」处理——确认隔离仍生效，而不是去修它。
- 涉及后端/ shim 侧的 md 支持（`shims.js` 的 `textThumbnailExtensions`、`documentViewer
  Extensions` 等）属既有实现，**保持不变**（不删不扩）。

---

## 当前测试基线（2026-09-05 · 含已知失败白名单）

开工先对基线；**白名单内的失败属预期，可先忽略，不要当回归查**。

| 套件 | 状态 | 说明 |
| --- | --- | --- |
| `npm run test:isolated` | ✅ 绿 | 末行 `FULL_REGRESSION_ISOLATED_OK`，EXIT:0。**前置：backend 三个 `fs.cpSync(recursive)` 临时补丁必须在树**（`backend/src/{library-migration,importer,library-backup-service}.js` + `tests/roadmap-panels.mjs`，宿主 cpSync 缺陷绕过，终审后 `git checkout` 回退）。 |
| `npm run test:main-ui-workflow` | ✅ **绿（b1-9f 起）** | 末行 `MAIN_WORKFLOW_SMOKE_OK` + `MAIN_UI_RESTART_OK`，EXIT:0。**b1-9f 轮累计 79 轮全绿**（身份取证探针在位 73 轮 + 移除探针后终验 6 轮），`detailDelivery` = `mode:"canvas"` / `tileCount:10` / `canvas 818x752` / `visible:true`。**b1-9r…b1-9x 清算系列每提交各补 m1 一轮全绿**（b4t/b4u-reverify/b4w/b4x；唯一偶发：b4u 整跑轮 main-ui-workflow 单跑复验即绿）。**已知间歇已收口（b1-9f）**：`multi inspector persistence` 统计判定实质消除（见 b1-9e 遗留段更新与 b1-9f 记录）。markdown 段按上方「项目级约束」**恒跳过**（`ok` 合取里的三项 markdown 断言已摘除，否则全门通过也只会打印 SMOKE_FAIL）。 |
| `npx tsc --noEmit -p tsconfig.json` | ✅ 绿 | 必须读真实退出码（`echo "EXIT:$?"`）；EXIT:0 才算过。 |
| `node tests/run-react-suite.mjs`（React 全量门 45 项） | ✅ **45/45（b1-9q 达成；b1-9r…b1-9x 清算系列 5 轮全数复验绿）** | b1-9f 轮首跑 23 失败 → b1-9g 逐断言 triage → b1-9h…b1-9q 按台账修复：22 个文件全部整文件转绿。b1-9r…b1-9x（阶段 11 清算 + P2/P3）每提交双门复验：b4r/b4s/b4t/b4w/b4x 全绿（b4u 44/45 为偶发家族，单跑复验绿）。fns 表 162→195（b1-9w 菜单点击路径 33 个）→196（b1-9x onSidebarResize），1c3 契约同步。 |

**m1 推进规则（原「text file drop import timeout」白名单已于 2026-09-04 解除）**：

- 该失败的根因是 `onDropContainer`（bundle 52717）未端口，**现已落地**（b1-9 收口片），
  连带补齐 `IS_HIDDEN_FILE` / `sortByAZ` 供给与 `controllerFns` 的对象键误改名
  （`__lv_files:` → `files:` / `__lv_path:` → `path:`，共 20 处）。
- m1 已于 b1-9e 全程通过（见上表），后续以「保持绿 + 消除 `multi inspector persistence`
  间歇失败」为目标。
- **回归判据**：任何阶段若退回更早的失败点（如 `original main scope timeout`、
  `text file drop import timeout`），即为新回归，必须查。
- markdown 段：按「项目级约束」恒跳过，**不得**为满足其断言改业务代码。

> **b1-9e：bundle 摘除后的「全局词法绑定」系统性缺口 + 模板字面量转义污染（2026-09-04）**
>
> app.bundle.js 从 index.html 摘除后，凡 bundle **内联但非 window 属性**的东西全部消失，
> 且消费侧多在 `try/catch` 内 → 静默失败。本轮修复四类：
> 1. **`URL_MODULE`**（bundle 顶层 `const`，classic script 的全局词法绑定）：
>    `core/fileUrlHelper.ts` 裸引用 → `getRawUrl/getThumbnailUrl` 恒返回空串。改为按第 5 节
>    契约本地解析（`require(appRoot + '/my_modules/url')` → `require('url')`）。
> 2. **`$.fn.smoothZoom` + `BitmapViewer`**（vendor `jquery.smoothZoom.min.js` 被 bundle 内联）：
>    详情原图管线整条死。提取为 `frontend/public/vendor/eagle-smooth-zoom.js`（仅 6 处
>    `angular.element(...)` 换等价物，其余逐字节相同；生成脚本 `tests-tmp/extract-smooth-zoom.py`），
>    由 index.html 同步加载。**不注入 `window.angular`**——全局 angular 存在会翻转
>    `scopeBridge`（shim scope 不再建立）与 `itemDomain:654`（finishQueue 双处理规避）等探测点。
> 3. **`$.playSound`**（vendor `jquery-audio.js` 同属内联件）+ scope 的 `removeSound/
>    duplicateSound/errorSound`（bundle 20238-20254 controller init 状态，seed 时漏项）：
>    `removeSelected` 在 `s.removeSound.play()` 处 TypeError。已补 index.html 引入 + seed 三件套。
> 4. **`$${` 模板转义污染（controllerFns 149 处 / 94 行）**：提取器把 `${` 转义成 `$${`，
>    运行时多出字面 `$`。污染面含 **localStorage 键**（`eagle.list.orderBy.$<rootDir>`、
>    `eagle.list.layout.$<id>`）、**filterCounts 的 year/month 键**、字体安装路径、
>    jQuery 选择器（`#$<id>-filter-item`）、各查看器 URL，以及 `getRawUrl` 的
>    `?v=$<ver>`（**详情原图 404 的直接原因**）。已机械修正（`tests-tmp/fix-template-artifacts.py`）。
>
> 另修两处非 bundle 缺口：
> - **scope shim 的 `$eval` 对着裸 shim 取值**（数据面字段只在 coreState、经 proxy 可达）→
>   `startScopeSync` 的 12 个域快照自 b1 起永久停在初值（body 的 `is-detail-mode` 等类名
>   不跟随 scope → 详情面板无尺寸 → 原图闸门超时）。`global/scopeShim.ts` 改为经 proxy 解析，
>   并让字符串型 `$watch` 也走同一路径。
> - **`machineryEnterDetailMode` 缺 digest flush**：bundle 靠 Angular digest 在 100ms
>   smoothZoom 初始化前把 body 类落到 DOM，shim 世界需显式 `s.$evalAsync()`。
>
> **教训**：`if-absent` 守卫/探测点要查「真正消费的那个标识符」；bundle 内联的 vendor 与顶层
> `const/let` 随 bundle 摘除一并消失，且多被 try/catch 吞掉——症状是「静默空值」而非报错。
>
> **遗留（下一段）**：
> - ~~`multi inspector persistence` 间歇失败（约 1/6）~~ **已于 b1-9f 统计收口（2026-09-05）**：
>   身份取证探针（`mapIsRaw`/`selIsMap` + raw/map/selected 三处 star/annotation/tags 快照，
>   早照 + deadline 双照）在位连跑 **73 轮全绿 0 复现**——若 1/6 失败率仍在，概率 ≈ 8.6e-7。
>   结论：本条所疑的「回滚载体」已被 b1-9e 的三处修复（thumbnail-generated 载荷收窄 +
>   `itemUpdateQueue` 排空 + `trackLocalImport`）摘除。b45-3 完整 sendTrace 的重新解读：
>   回滚发生在三步操作写入后 **~16ms 内、同一实例上**（selectionTrace 新值 → 延迟发送克隆到
>   旧值 → deadline 时 selected 亦旧值），即「晚到的整条快照回写」——而彼时唯一能携带整条库
>   快照的通道（thumbnail-generated 全量载荷）正是被 b1-9e 收窄封死的那个。
>   `itemDomain.ts:435` 的无条件 `itemMappings` 覆写属 bundle 30427 逐字怪癖（bundle 在世时
>   同样存在双实例分叉），按「数据面零改动」未动。探针收口时已移除，片段存档于 b1-9f 记录。
> - React 侧 45 处 `w.angular.copy/isNumber/extend/equals` 与 `angular.element(...).injector()`
>   仍是死调用（bundle 在世时靠真 angular）。若要供给，必须同时给
>   `scopeBridge:14` / `itemDomain:654` 等「bundle 在世」探测点加 `!__eagleShim` 门。

> **b1-9f：React 全量门首跑归因（23 失败 = 22 陈旧 + 1 已修）+ multi inspector 统计收口（2026-09-05）**
>
> 本轮无业务代码改动，主体是验证与登记：补跑 b1-9e 收口漏掉的 React 全量门 + multi inspector 取证。
>
> **1. React 全量门（`node tests/run-react-suite.mjs`，45 项）首跑**：22 OK / 23 FAIL。
>   归因方法：对全部 23 个失败项**逐项**在 `HEAD~1`（b1-9d，bundle 已摘除、b1-9e 未动）单跑复验：
>   - **22 项 b1-9d 同败 ⇒ bundle 摘除时代累积的陈旧冒烟，非 b1-9e 回归**。且多数项 b1-9d 失败更多
>     （7d6b：19 断言 vs b1-9e 的 3；stage5：10 vs 3；stage6：10 vs 3；7a/11a1 同趋势）——
>     **b1-9e 对它们是净改善**。两族形态：
>     - **契约过期**（断言 bundle 在世工件，shim 世界结构上不可能通过）：
>       `1c2-bundle-eagle-untouched`（断言 bundle eagle 未改动——bundle 已摘除）、
>       `cz1-accessor-persists`（沿 `$parent` 原型链找 Angular 访问器 getter——shim 世界是
>       Proxy+coreState 无原型链 scope）、cz2/cz3 同族部分断言；
>     - **真实功能缺口**（对应 UI 面未接管；**这 22 项 = 未接管面的精确地图**）：
>       7d 弹窗家族（7d1a/7d1b/7d1c2/7d2/7d3a/7d5a/7d6a/7d6b/7d6c 的 swal/对话框断言成片失败）、
>       stage5（shell-detail-host / detail-container 等）、stage6（inspector 渲染/星标/改名）、
>       stage7a（右键菜单）、7b（标签管理）、11a1/11a2/11a49、1m1-unified（域接管/watcher 六断言）、
>       stage-smoke（filter button toggle）。
>     按「不为陈旧断言改业务代码」原则，本轮一律未动。**逐项 triage（改断言到新世界契约 / 补端口）
>     是下一轮候选战线**，与阶段 11 b2/b3/b4 的优先级待用户裁定。
>   - **1 项是 b1-9e 真回归，已修**：`react-stage1c3-smoke` 的 `c3-contract` 硬编码
>     `Object.keys(__eagleCoreFns).length === 155`，而 b1-9e 补端口 `addImagesToFolder`
>     （bundle 43132-43198，m1 必需；`fns["` 计数实测 155→156）使精确计数契约破裂。
>     修法：断言更新为 156（`tests/react-stage1c3-smoke.mjs`，带注释），复跑 EXIT:0。
>     **教训：扩 fns 表必须同步全量门的计数型契约。**
>
> **2. `multi inspector persistence` 统计收口**：见上方 b1-9e 遗留段更新（73 连绿 + b45-3
>   重新解读 ⇒ 判定实质消除）。取证探针已从 `electron/main.cjs` 移除，片段存档——若复发，
>   贴回 m1 闸门 `scope.changeStar(3, false, true);` 之后，并在 reject 载荷里追加
>   `earlyIdentity, identity: snapIdentity()`：
>   ```js
>   const snapIdentity = () => {
>     const rawEntry = scope.raw && scope.raw.find((i) => i.id === droppedId);
>     const mapEntry = scope.itemMappings && scope.itemMappings[droppedId];
>     return {
>       mapIsRaw: mapEntry === rawEntry,
>       selIsMap: Array.isArray(scope.selected) && scope.selected[0] === mapEntry,
>       rawVals: rawEntry && [rawEntry.star, rawEntry.annotation, (rawEntry.tags || []).join('/')],
>       mapVals: mapEntry && [mapEntry.star, mapEntry.annotation, (mapEntry.tags || []).join('/')],
>       selVals: scope.selected && scope.selected.map((it) => it && [String(it.id).slice(-4), it.star, it.annotation]),
>     };
>   };
>   const earlyIdentity = snapIdentity();
>   ```
>
> **3. 验证记录**：m1 累计 **79 轮全绿**（探针在位 73 + 移除后终验 6）；tsc EXIT:0；
>   `test:isolated` → `FULL_REGRESSION_ISOLATED_OK`（cpSync 手工补丁用后即退，见基线表前置）。
>   全量门未整跑复验（22 项已双态逐项实锤、1c3 已单项验绿；整跑重开待 triage 轮）。

> **b1-9r：阶段 11 b4 —— index.html 双轨 CSS/标记清点（2026-09-05，探查代理实锤后微删）**
>
> 逐 link 消费方判定（React 类名/组件 grep 实锤）：
>
> | head link | 判定 | 依据 |
> |---|---|---|
> | :9 angular-notify.min.css | **活·保留** | React 通知层 dataMachinery.ts:3868-3991 + preview-window/controller.ts:308-313 运行时注入 `.cg-notify-*` DOM，靠它供电（b4 原预设「死文件」被推翻） |
> | :10 sweetalert2.min.css | 活·保留 | 16 个 React 文件 `w.swal(...)`（b1-9h 接线） |
> | :12 jquery-ui.min.css | 活·保留 | Inspector/DetailToolbar/commentHooks/collect-window 等消费 `ui-*` 类；T6 sidebar resizable 也要用 |
> | :13 icons / :14 style_dark / :15 base / :16 app | 活·保留 | 核心壳样式（a8 断言 app-style href） |
> | :17-18 flatpickr.min.css + airbnb.css | **活·保留（挂起缺口）** | FlatpickrInput（FolderSelectPanels.tsx:606）等 `window.FlatpickrInstance`，但库未被 index.html 加载、且 flatpickr.min.js UMD 不导出该类（内部类）→ 智能文件夹日期规则输入潜伏失效。修法（登记未做）：加载 `js/modules/flatpicker/flatpickr.min.js` + 桥 `window.FlatpickrInstance=(i,o)=>flatpickr(i,o)`（+ zh l10n）；修前 flatpicker CSS/JS 不得入删除清单 |
> | :19 nouislider.min.css | **死·删除（本提交）** | 全仓唯一引用即本行；nouislider JS 无任何加载方（T2 一并删 js） |
> | :20 video-js.css / :21 colorpicker.css | 活·保留 | DetailViewer/detailHooks/preview-window；FilterItems/controllerFns |
>
> 标记清理：index.html:164 `<library-panel theme=… library-history=…>` 死标记删除
> （React/shims/tests 三方零引用；React 主机全部为 `eagle-*-host` div，无 tag 消费）。
> 残留扫描结论：:34 #sidebar resizable 属性（死，T6 处理）、:73-76 scroll-to-top-sentinel
> （**活**，gridDirectives.ts:62 经 jQuery 消费 target/threshold/scroll-container）、
> app.bundle.js 仅剩注释溯源（用户裁定保留至迁移收官）。
>
> **验证**：suite 45/45（`tests-tmp/react-suite-b4r.log`）+ tsc EXIT:0。
> T2（54 孤儿）删除台账双重实锤：basename 全仓 grep + require/import/script-src
> 加载形态 grep 均 0 命中（`tests-tmp/orphan-ledger-b4s.sh`，不提交）。

> **b1-9s：阶段 11 b3 批1 —— 54 个零引用孤儿删除（2026-09-05）**
>
> 删除台账双重实锤（basename 全仓 grep + require/import/script-src 加载形态 grep 均 0 命中，
> `tests-tmp/orphan-ledger-b4s.sh`）：controllers 3、directives 23（filter-item-* 17 +
> audio-media-element/folder-sortable/notification-btn/smart-folder-sortable/tag-rect-select）、
> hover-preview/* 4、lib/api 3（duplicate-checker/reverse-image-search/url-enlarger-remote）、
> lib/base.js、modules 4（angular-bind-notifier/angular-vs-repeat/flatpicker 两 plugin）、
> nouislider.min.js（CSS 已于 b1-9r 删）、vendors 8、顶层 6（annotation-preview/api-server/
> fix-utils/ipc-helper/recent-file-manager/rule-match）。无扩展名 require 形态不成立
> （Node CJS 必须带 .js 才可解析），动态 require 面仅 thumbs 链（批2 处理）。
> 保留面核对：eagle-api/url-enlarger 等活文件对被删文件零 require（台账覆盖全仓）。
>
> **验证**：suite 45/45（`tests-tmp/react-suite-b4s.log`）+ tsc EXIT:0。

> **b1-9t：阶段 11 b3 批2 —— background 死链子树清算（2026-09-05）**
>
> 实锤链：background.html 全仓无打开方（electron/shims/react 零引用）→ 其 12 个脚本除
> lodash/jquery/jquery-audio/eagle-api/url-enlarger（活窗口共用）外全入删除清单：
> background.js(253KB)、tree.helper.js、ga4/ga、music-tempo.min、lib/api/screen-capture。
> background.js 是 thumbs/** 唯一加载方（thumb.js 动态 require MODULE_PATH）→ thumbs 全树
> 39 文件同删；thumbs→utils 依赖链随之清死：safeCopy/edge/captureURL/imageSize/getExt/
> compress/executeJavaScriptInIsolatedWorld/nativeThumb（nativeThumb 仅被 thumbs 消费；
> electron 的 nativeThumbnail 是主进程 IPC，无关同名物）。analyzer/color-analyzer 的
> tests/backend 引用均指向 backend 自有副本（backend/src/color-analyzer.js）。
> 另删：modules/angular-notify/angular-notify.min.js（React cgNotify 等价层自足，CSS 留）、
> modules/flatpicker/ng-flatpickr.min.js（React FlatpickrInput 自带 link 逻辑；flatpicker
> 主体与 CSS 因 FlatpickrInstance 潜伏缺口判活保留，见 b1-9r）、background.html（死窗根）。
> core.jsc 挪 T4（唯一加载方 registration.html 死窗同批删）。
> 台账复核：18 个 basename 全仓 grep 仅剩死链互引 + 3 处巧合（libtga.js 子串、
> preview-window/controller.ts 溯源注释、scope.imageSize 无关同名）。
>
> **验证**：suite 45/45（`tests-tmp/react-suite-b4t.log`）+ tsc EXIT:0 +
> m1 `MAIN_WORKFLOW_SMOKE_OK`/`MAIN_UI_RESTART_OK`（detailDelivery mode:canvas tileCount:10）。

> **b1-9z…b1-9ab：排查错误清零轮（2026-09-05，用户裁定挂账错误一次性完成）**
>
> **E1（b1-9z）flatpickr 修复**：index.html 加载 flatpickr v3.0.6 + zh l10n。反转两次：
> ①初判「UMD 不导出 FlatpickrInstance 需桥」——实为经典脚本顶层 `function FlatpickrInstance`
> 声明，加载即原生暴露；②首提的桥反而把构造器覆盖成工厂、`new` 语义被毁（探针
> `inst.destroy is not a function` 铁证）→ 撤桥。供给契约断言进 react-stage-smoke
> （`b1-9z-flatpickr-supply`：构造/_input 指回/destroy/zh l10ns）。智能文件夹日期规则输入复活。
> **E3（b1-9aa）后台窗通道族接管**（main+backend+preload+shims 四文件，+203 行）：
> export-as-folder→`/api/export/as-folder`（载荷形状天然匹配）；export-images（选中打包
> .eaglepack）→`/api/export/eaglepack/start`（packLibrary resolveSelectedItems 吃 items）；
> regenerate-thumbnail/-video-thumbnail→逐文件 `/api/item/thumbnailTask/start`（startAt
> 直通）；set-custom-thumbnail→`/api/item/setCustomThumbnail`（customThumbnailService.set
> 拷贝入 .info+色板+metadata）；duplicate-file→**新增 `/api/item/duplicate`**（background
> duplicateFile 3824 语义：手动递归拷 .info+metadata 换 id 写回；与 addFromPath 同惯例内存
> unshift 注册——readItems 为内存缓存，裸 fs 复制不进后端视野，端点化才是正解）；
> copy-thumbnails→CF_HDROP（DROPFILES 头+双 NUL 宽字符；原 background win 分支转发的
> copy-win-files 本仓 main 从未落地，单图写失败回落位图）；open-with-dialog→win32
> rundll32 OpenAs_RunDLLW（原 EdgeJS.openAppDialog 等价物）。完成通知走新桥：
> preload `onRebindRefresh` + shims 订阅 → `rebindRefresh()+scrollToSelectedItem()`
> （bundle 23723 监听语义）。
> **E2（b1-9ab）searchFilter 管线移植——排查中的最大收获（真活 bug）**：审计发现
> `s.searchFilter` 无定义——machineryFilterContent 的 `data.filter(s.searchFilter)` 在
> 非空关键词时抛 TypeError，被 $timeout shim 的 try 吞掉 → **关键词搜索自 b1 以来静默
> 失效**（11a49 的非空用例 `zzz-no-hit` 期望空结果，崩了也空，断言空洞通过——门况全绿
> 掩盖）。移植 convertToRegexGroup(113 行)+matchWithRegexGroup(18 行)+searchFilter(102 行)
> + `s.searchFilter` 赋值面（scopeShim get 无 fns 回退，走 machinery 赋值）；繁簡/NOT/OR
> 群组/搜索范围（名称/扩展名/URL/标注/标签/文件夹名与描述/字体 postScriptName）全链复活。
> checkSingleKeyword(224 行) 全仓零调用方——死代码不移植。searchRegexGroup 懒建缓存 +
> fns["search"] 每搜清缓存（b1-9q 已移植）闭环。
> **方法教训**：b1-9w 审计把 controllerFns 排除在语料外，导致 keywords_cn/keywords_tw 等
> 「字段缺口」为假阳性（fns["search"] 体内早已逐字赋值）；但同一方法的深挖揭出
> searchFilter/colorFilter 真缺口——字段审计必须区分「fns 体内外」两种赋值位置。
> **残余登记**：s.colorFilter/s.grayColorFilter 同类缺口（色板距离机器未移植，激活颜色
> 筛选规则时同样 TypeError 被吞）——S-M 级，下批处理。
>
> **验证**：b1-9z 单项 smoke 绿；b1-9aa suite 45/45 + m1 双 OK；b1-9ab suite 44/45
> （唯 main-ui-workflow 偶发家族）+ 独立 m1 复验双 OK；tsc EXIT:0。

> **b1-9ad/b1-9ae：迁移收官 Phase A——颜色筛选复活 + 通道发送端补漏（2026-09-05，
> 用户裁定「一口气到收官」：Phase A → Phase B 六批 viewer 接管 → Phase C bundle 删除 capstone）**
>
> **A1（b1-9ad）颜色筛选排雷**：npm 落地 color-convert@2 + delta-e@0.0.8（bundle 9153-9154
> 顶层 require 同款；**v3 勿升**——ESM 化且 Lab 输出取整策略变，v2 裸 `.lab` 取整 Lab 恰与
> 原版行为一致）。移植 colorSimilarityDistance（32784，Lab+ΔE76/ΔE2000）+ colorFilter
> （32689-32781，精确命中→colorDistancesMap 0.01 / ΔE 距离命中 / 白场代偿 / marked 自定义
> 主色，全链逐字）+ grayColorFilter（32797，零依赖）→ machineryColorFilter/
> machineryGrayColorFilter + seeds 赋值（b1-9ab 同款 machinery 赋值面）。消费面
> machineryFilterContent 的 `data.filter(s.colorFilter)`/`(s.grayColorFilter)` +
> colorDistancesMap 排序比较器全链复活——此前开启颜色/黑白筛选即 TypeError 被吞。
> bundle 同域 rgb2lab（32664）全 bundle 零调用，死代码不移植；accuracy:20 默认值由
> eagleClasses.ts:390 承载（勿重复）。ambient 声明进 global/vendor-modules.d.ts（无类型
> 包；tsconfig strict + esModuleInterop）。**顺带排雷**：tsconfig types 引用的
> @types/react/@types/react-dom 从未入 package.json（extraneous 安装，npm install 一动
> 即被 prune）——转正 devDependencies（@19 对齐 react 19.1.0）。正向断言
> `b1-9ad-colorfilter-pipeline` 进 react-stage-smoke（精确命中 0.01/ΔE 命中/不命中/黑白
> 四态；规则值先存后还，纯函数无 rebindRefresh 副作用）。
> **A2（b1-9ae）通道发送端补漏**：b1-9aa 只接了 main 侧 handler，renderer 侧仍有 6 处
> `sendTo(backgroundWindowID, …)` 无条件空放（后台窗已除名，id=undefined）。修
> controllerFns 5 处（setAsVideoThumbnail mpv 分支/setCustomThumbnail/
> setCustomThumbnailFromClipboard 两分支/copyAsThumbnail）+ apiServerDomain
> machinerySetCustomThumbnail（API 面同病）→ bundle 26409 自带条件模式
> （undefined → IPCHelper.send/renderer ipcRenderer.send 走 main）。main 的
> set-custom-thumbnail handler 补回程 `thumbnail-generated(item)`——machinerySetCustomThumbnail
> 承诺链 10s resolve 依赖此事件（bundle 时代 background 完成缩图后的回程事件同型）。
> cancel-empty-trash（bundle 33607 本就无条件 sendTo）维持逐字 + empty-trash 主侧监听
> 缺口登记残余台账。**新闭环测试 channel-wiring-closed-loop.mjs（45→46）**：
> `--smoke-channels` 隐藏窗真驱动（渲染层 executeJavaScript `ipcRenderer.send` → main
> handler → backend 数据面全链）：duplicate-file items+1 / export-as-folder 产物落盘
> （fs 独立复核）/ export-images .eaglepack 落盘（fs 复核）/ regenerate-thumbnail 缩略图
> mtime 前移 / set-custom-thumbnail customThumbnail=true + thumbnail-generated 回程
> / copy-thumbnails CF_HDROP 剪贴板回读非空；open-with-dialog 静态接线审计（真弹
> rundll32 会挂测试机）。
> **验证**：b1-9ad suite 45/45 全绿（含新断言）+ tsc EXIT:0；b1-9ae tsc EXIT:0 +
> channel-wiring 首跑 7/7 全绿（`tests-tmp/channel-wiring-first.log`）+ suite 46 项
> 45 过（唯 react-stage8e2 偶发家族，独立复验立即全绿——b1-9u/b1-9ab 同款协议）。

> **b1-9af：Phase B/批1——exif-viewer React 接管 + texture-viewer 处置 + pdf 判定（2026-09-05）**
>
> **侦察修正（重要）**：8 个 iframe viewer 实为「vendored 引擎 + 小粘合层」格局——
> gif-player.js（1143 行）= 第三方 SuperGif/rubbable 引擎；raw-viewer 粘合仅 104 行
> （引擎 dcraw.js）；model-viewer = 第三方 O3DV website 模板 + pickr；pdf-viewer =
> PDF.js 官方 viewer（13657 行 vendored，`?path=/theme=` 参数消费在 vendored viewer.js
> 内 + vite injectViewerConfig 注入，**无自有控制面、免移植**）。真正的 Eagle 自有
> 控制面只有 exif-player.js（54 行）、raw-player.js（104 行）、native-viewer 内联脚本、
> text-editor（380 行 Angular）、font-viewer（864 行 Angular）——后两个是 angular.min.js
> 唯一存活消费方（B4/B5 主目标）。
> **exif-viewer 接管**：react/viewers/exif/entry.tsx（54 行 jQuery 逐字语义——URL 参数
> → r{n} 方向类 + fit-width(-2)/fit-height(-2) 适配类 + pixelated + src + show 淡入；
> 缺参 parseInt→NaN→rNaN 类与原实现一致）；index.html 壳摘 jquery + exif-player.js、
> `<img id="main-image">` 换 `#exif-root` 挂载点（CSS img 选择器对 React 渲染 img 依旧
> 生效）；exif-player.js 删除。**vite 通用路由**：REACT_VIEWER_ENTRIES 表 +
> injectReactViewer（壳页统一 generic route，接管一页登记一项——后续 B2/B3 复用）。
> **texture-viewer 处置（零引用实锤后删）**：texture2png.js（28 行，module.exports 离屏
> 转换 iframe 助手）全仓 grep 0 运行时消费（bundle/react/electron/backend/tests 全 0；
> 仅文档 PROGRESS/项目结构/TASK 提及）；texture-viewer/ 10 文件（three.min.js+
> EXR/RGBE loaders+fflate+lil-gui，13MB 级 vendored）随之同删；screenshot-regression.mjs
> texture 快照项 + frontend/public/pages.html 调试链接同步摘除。EXR/HDR 缩略图在本仓
> 由 backend 自有管线承载，texture2png 链路自 background 窗除名后即死。
> **闭环契约**：react-stage-smoke 新增 `b1-9af-exif-viewer-react`——主窗挂真实 iframe
> 过 vite 中间件链（壳 + shims 注入 + React entry），断言 r6/fit-height2/show 类 +
> src 面（window.__b1_9af 先挂载后断言两段式，规避 Runtime.evaluate 无 awaitPromise）。
> **验证**：tsc EXIT:0；react-stage-smoke 单跑全绿（b1-9ad/b1-9af 双断言 PASS）。

> **b1-9ag：Phase B/批2——raw-viewer + native-viewer React 接管（2026-09-05）**
>
> **raw-viewer**：react/viewers/raw/entry.tsx（raw-player.js 104 行 jQuery 逐字——缩略图
> img file:// URL 即时显示 + dcraw 引擎 100ms 延迟抽取 RAW 内嵌 JPEG 绘 canvas（<480px
> 跳过）+ 方向/适配双元素类 + window.parent.focus()）；dcraw.js 为 vendored 引擎保留壳内
> classic script（window.dcraw 直用）；raw-player.js 删除。src 赋值/show 两帧渲染对应
> 原实现「元素先于类存在」的 CSS opacity 过渡语义。
> **native-viewer**：react/viewers/native/entry.tsx（index.html 内联脚本 170 行逐字——
> darwin qlmanage / nativeImage.createThumbnailFromPath invoke，win32
> 'generate-hight-resolution-thumbnail' send + 缓存轮询：error→1s cache-buster 退避重试、
> load→ready 隐 loader；缓存目录 parent.global.EAGLE_THUMBNAIL_TEMP_PATH/preview（node
> integration 下 window.global===window 同通道）；超 10 个缓存整目录清理；原始 substring
> indexOf ext 匹配怪癖逐字保留）。ready 类经 body.classList 保留壳 CSS 契约。
> **主侧挂账（残余台账⑦）**：'generate-hight-resolution-thumbnail' 与
> 'nativeImage.createThumbnailFromPath' 本仓 main 均无监听（原 background 承载随 b1-9t
> 删除）——特殊格式高分辨率预览在缓存未命中时轮询空转；补监听需重建 psd/ppt 缩图引擎，
> 非 viewer 接管范畴。
> **验证**：tsc EXIT:0；react-stage-smoke 四断言全绿（b1-9ad/b1-9af/b1-9ag×2）——raw
> 契约 = img/canvas r6+fit-height2+src `_thumbnail.png`；native 契约 = ext:png 即时
> body.ready（win32 早退分支）。

> **b1-9ah：Phase B/批3——gif-viewer React 接管 + model-viewer 键盘通道补齐（2026-09-05）**
>
> **gif-viewer**：react/viewers/gif/entry.tsx（index.html 内联粘合层 ~80 行 jQuery 逐字——
> URL path→file URL + body render-* 类 + 双 img 喂引擎 + load 完成/进度回调转投
> `parent.$bodyScope.gifViewer.onFinished/onProgress`（tagManagerDomain:1806 主窗种子 +
> preview-window/controller:1490 预览窗种子，两侧已供）+ 载入中途打开的进度位置模拟
> + 150ms body.loaded）。gif-player.js（1143 行）= vendored SuperGif 引擎保留壳内；
> jquery-1.8.0.min.js 本地副本 + rubbable.js（全仓零引用）删除。
> **断言教训**：首版断言双处自伤——①onload+300ms 查 ins.src 撞 vite 冷转换竞态（模块
> 服务滞后，src 尚未设置）；②frames.length>0 是数据特征非接线特征（sample.gif 解析出
> 0 帧，探针实锤 `bodyCls:"render-normal loaded"、isGifReady:true`——加载与回程通道全
> 通）。修正后契约 = render-* 类（poll 锁存）+ body.loaded + isGifReady，探针法
> （smoke 复本注入诊断字段）定位仅 1 轮。
> **model-viewer 判定**：O3DV 第三方 website 模板 + vendored o3dv.website.min.js，
> 自有面仅 12 行 keyup→postMessage('Exit'/'Prev'/'Next') 粘合——免 React 化。
> **真缺口修复**：bundle 20213-20238 的 window message 监听（Exit→leaveDetailMode/
> Prev→selectPrev/Next→selectNext + $evalAsync）React 世界从未移植——iframe 聚焦时
> ESC 无法退出详情、无法左右切换。补进 DetailContainerInterior useEffect（guard 包裹
> 同 DetailViewer:548 惯例）。
> **验证**：tsc EXIT:0；react-stage-smoke 五断言全绿（b1-9ad/b1-9af/b1-9ag×2/b1-9ah）。

> **b1-9ai：Phase B/批4——text-editor React 接管（angular.min.js 消费方 -1，2026-09-05）**
>
> text-editor.js（381 行 Angular 控制器）+ wMousetrap 绑定表 + editable-selectall 指令 +
> 内联 throttle/debounce 全量 React 化（react/viewers/text-editor/entry.tsx）：
> - **键盘**：wMousetrap 绑定表（0-5 星标直通 parent / F5·mod+r 刷新 / left·right 切换 /
>   mod=·+·-·0·9 缩放 / mod+s 保存 / mod+backspace·del 吞键）原生 keydown 复刻；
>   selectall 指令（mod+a 全选/esc 失焦）并入 content keydown。
> - **保存链**：leading-edge 防抖（内联 debounce 逐字）→ createWriteStream 临时文件 →
>   fs-extra moveSync 原子覆盖 → 'update-txt-item' 通知；缩放（hidden range input 状态化
>   + html font-size + ctrl 滚轮 throttle 200ms immediate + wheelDelta 语义保留）。
> - **修正与挂账**：原 save 错误路径裸 `ipcRenderer`（iframe 内 ReferenceError 潜伏）改经
>   `window.parent.ipcRenderer`；原 `$parentScope.$eavlAsync()` 拼写 bug（静默 no-op）经
>   $evalAsync 修正语义；changeName（模板 UI 已注释、零调用方）死代码不移植；
>   **'update-txt-item' main 无监听**（残余台账⑧，与 empty-trash 同族——item 元数据 text
>   经此通道悬空）。
> - 壳：angular.min.js/mousetrap/wMousetrap/angular-contenteditable/jquery/lodash + 内联
>   脚本全摘（**angular.min.js 消费方 2→1**，仅剩 font-viewer）；text-editor.js 删除；
>   REACT_VIEWER_ENTRIES 登记；shims 的 text-editor 独立 mock 分支（window.$bodyScope +
>   fs mock）继续覆盖 standalone 场景（截图回归面）。
> - 断言教训：首版探针空转 20s——kickoff 漏 `appendChild`（iframe 未入 DOM，contentDocument
>   恒 about:blank）；探针三段定位（fetch 200/hasRoot/hasEntry→服务面正确→落回 kickoff）。
> - **闭环契约 b1-9ai**：真实 $bodyScope 塞 mock 库真实 txt 项（原生 fs 读
>   Sample Notes.txt）→ iframe 加载 → content textContent 含样例文本 + body dark 类。
> **验证**：tsc EXIT:0；react-stage-smoke 六断言全绿。

> **b1-9aj：Phase B/批5——font-viewer React 接管（angular.min.js 消费方归零，2026-09-05）**
>
> font-viewer.js（865 行 FontViewerApp）+ wMousetrap 绑定表 + selectall/contenteditable
> 全量 React 化（react/viewers/font/entry.tsx + fontContent.ts）：
> - **静态内容机械抽取**：i18nStrings（29-118）+ translation 4 语言（480-739，含荷塘月色
>   全文）python 正则抽取逐字进 fontContent.ts（`alphabet: getAlphabetHTML(X)` →
>   `alphabetRaw: X`，5 处替换；字体就绪后经 buildAlphabetHTML 展开 span.alpha-preview
>   before/after/zoom 三层——原 getAlphabetHTML DOM 操作逐字）；preferredFamily 读
>   preferredSubfamily 原 bug 保留。
> - **加载链逐字**：语言判定（support/ja/zh 分支 + preferLng 覆盖）→ fs 存在检查 →
>   readFile → FontFace(fontFamily 清洗名) → document.fonts.add → body font-family +
>   display:block → isSupport；失败路径 isSupport=false → NotSupport i18n HTML。
> - **交互面**：wMousetrap 绑定表原生复刻（含 enter/esc/backspace/space→escHandler 关闭、
>   0-5 星标、mod 缩放）；MediumEditor（vendored，30ms 后 init + selectAllContents 订阅）；
>   tippy（vendored，activate 按钮右placement）；waterfall 联动输入 keyup 委托；缩放滑杆
>   （ng-model → 受控 input + progressbar width fontSize/625%）；scrollTop 持久化（500ms
>   防抖）；scrollTop 恢复 + 主题/页签 localStorage（eagle.fontViewer.*）；字体改名跨窗
>   同步（parent.inspector.newName + imagesChange，blur 读 span 文本）。
> - **语义修正**：$eavlAsync 拼写 bug 同 b1-9ai 修正；mediumEditor 指令（模板未用死代码）
>   不移植；壳保留 vendored medium-editor（js+css）与 vendors/tippy.js，摘除
>   angular/mousetrap/wMousetrap/angular-contenteditable/jquery/lodash/modules-tippy。
> - **angular.min.js 消费方 1→0**——C2 vendor 复审的删除前置条件达成。
> - **闭环契约 b1-9aj**：真实 $bodyScope 塞 MOCK-FONT 项（mock 库真实
>   LiberationSans-Regular.ttf，原生 fs）→ iframe 加载 → FontFace 就绪 →
>   `.content .article` 含 'Moonlight'（en 内容分支实锤语言判定 + 加载链 + 渲染）。
> **验证**：tsc EXIT:0；react-stage-smoke 七断言全绿。

> **b1-9ak：Phase B/批6——Menu.popup 自动化基建（六站点模板断言，45→46→47 第 47 项，2026-09-05）**
>
> **新闭环测试 menu-popup-closed-loop.mjs（套件 47 项）**：原生菜单无法被 CDP 观察（真弹
> 会阻塞会话）。六站点验证 = 1 运行时闭环 + 5 静态接线审计：
> - **运行时**：openApplicationContextMenu（scope 直调 → File/View/Help 模板断言）。
> - **静态**：FolderModals moreButtonClick（Menu 构造 + 两 MenuItem + popup 调用）、
>   shareMenu（ShareMenu 构造 + darwin 守卫——Windows 不可达）、preview-window 三菜单
>   （openRatioContextMenu/view.zoom.fit、appmenu.view>opacity/revealInFolder、
>   gifViewer setThumbnail/cancelRange + popup×3）。
> **基建链**（三层坑位逐一排掉）：①preload 直通 `window.__EAGLE_MENU_SMOKE`（shims stub
> 了 window.process/window.require，env 不可达）；②fns["openApplicationContextMenu"] 加
> smoke 分支——渲染层只发 `{site}` 标记，**模板由 main 侧原生序列化**（@electron/remote
> 经代理读 items 实测为空；Menu.prototype 原型补丁也实测无效——remote 方法调用不走
> main 原型）；③shims 的 send 是智能路由器，未路由通道进 console.debug 黑洞——补
> `smoke:*` 通道 nativeRequire 直通。main 捕获落盘 EAGLE_MENU_SMOKE_OUT（绕开 shim
> invoke 不确定性），测试轮询文件。
> **真缺口修复（新测试揪出）**：controllerFns 的 openApplicationContextMenu 用裸 `Menu`
> （b1-9w 逐字移植遗留 ReferenceError——一调用即崩）——补 `Menu/MenuItem = remote`
> 供给面。
> **新缺口登记（残余台账⑨）**：Sidebar 消费的 5 个菜单 fns 中 4 个全仓无定义——
> openFolderContextMenu（bundle 39012，侧栏右键主菜单，**活断**）、openFolderExpandContextMenu
> （38578）、openSmartFolderContextMenu（39550）、openSmartFolderExpandContextMenu（38619）
> （openQuickAccessContextMenu/openSidebarVisibleContextMenu 已有）——b1-9w 262 符号审计
> 的漏网面（事件处理器经由 JSX onContextMenu 经 scopeApply 调用，非菜单点击路径）。
> **工程教训**：测试进程在 Windows 上因 electron 子进程树句柄残留挂起事件循环（结果已
> 输出但进程不退、套件 300s 超时杀掉误判 FAIL）——测试收尾显式 process.exit，
> 失败语义经 failure 标志保留（exit 1）。
> **验证**：tsc EXIT:0；menu-popup 独立跑 CLOSED_LOOP_OK（exit 0）；suite 47 项门禁
> 见 commit 后记录。

> **b1-9al：Phase C/收官 1——app.bundle.js 删除 capstone（-4.4MB / -106,658 行，2026-09-05）**
>
> 用户裁定「保留到迁移收官」的逐字规范源 app.bundle.js（4,406,623 字节 / 106,658 行）
> 在 Phase A/B 全部完成后删除：删除前最终审计——全仓 `app.bundle` 引用面逐一过目，
> 代码文件仅存注释（index.html 3 处历史注记 / tab-bar.js / eagle-smooth-zoom.js /
> sidebarState.ts 溯源注释）+ 文档（TASK/README/项目结构/handover/REUSE_ROADMAP 等，
> 历史文档不动）；**零活 script 标签、零 require/import**。index.html 三处注记改写为
> 「原 bundle 内联件，b1-9d 摘除、b1-9al 独立加载」时态（jquery-audio/sweetalert2/
> eagle-smooth-zoom——三件均为 b1-9d 摘除 bundle 后新立的独立加载，注记保留其依赖语义）。
> **门禁（计划要求的 suite ×2 + m1 + tsc）**：tsc EXIT:0；suite 47/47 全绿 ×2 轮
> （`tests-tmp/react-suite-b1-9al.log` + `-2.log`）；m1 MAIN_WORKFLOW_SMOKE_OK +
> MAIN_UI_RESTART_OK（detailDelivery mode:canvas tileCount:10，全交付链实锤）。
> **迁移里程碑**：4.2MB 的 Angular1 时代总成自此退出工作树——所有行为规范以 react/
> 逐字移植 + 注释行号溯源为唯一载体。

> **b1-9am：Phase C/收官 2——vendor 复审终删 + 阶段 11 全收官（2026-09-05）**
>
> 双台账复核（html 加载面 + require/import 面，全仓含 electron/tests）后删除 10 项
> Angular1 时代残余（**全部零活消费**；命中面均为溯源注释/无关同名资产路径）：
> - `js/vendors/angular.min.js`（B4/B5 后零加载方——preferences/font-viewer/text-editor
>   三页的命中均为接管注释）
> - `js/modules/angular-contenteditable.js`、`js/modules/wMousetrap.js`（wMousetrap 唯一
>   存活消费方 font-viewer/text-editor 已随 B4/B5 React 化；detailHooks.ts 的命中为语义
>   溯源注释）
> - `js/modules/sortable.js`、`js/modules/tif-img.js`、`js/modules/vs-grid-repeat.js`、
>   `js/modules/tippy.js`（Angular tippy 指令；**vendors/tippy.js 判活保留**——
>   preferences.html:10 与 font-viewer 壳仍在加载）
> - `js/modules/nouislider/nouislider.js`（b1-9r 已删其 CSS，JS 同灭）
> - `js/modules/angular-notify/template.html`（**angular-notify.min.css 判活保留**——
>   React 通知层运行时注入消费；模板已被 dataMachinery:3880 内联逐字移植取代）
> - `js/modules/context-menu/`（5 文件；index.html 原 `<context-menu>` 元素已随 React
>   接管删除，ContextMenu.tsx:18 命中为 assets/images 同名路径）
> **保留项复核**：vendors jquery 系/mousetrap.min.js（index+preview 窗活加载）/lodash/
> sweetalert2/jquery-audio/shortcut-manager/lazy-load-manager + modules/flatpicker（b1-9z
> 判活）+ angular-notify.min.css——均以活窗口加载面实锤保留。
>
> **环境事件与处置（重要）**：C2 首轮门禁 3 闭环测试同挂（main-ui-workflow /
> preview-delivery / channel-wiring + m1）——全部失败点均为**剪贴板读空**
> （copyThumbnails CF_HDROP / clipboardPathOk+clipboardImageOk / clipboard:import
> 「Clipboard does not contain an image or file paths」）。定位链：①**还原实验**——
> C2 十文件临时全量还原后同测试同姿态复挂 → C2 删除排除；②OS 级确诊——PowerShell
> Set-Clipboard/Get-Clipboard、clip.exe（拒绝访问）、Win32 OpenClipboard（带窗 + 30 次
> 重试）全部失败且 GetOpenClipboardWindow=0/GetClipboardOwner=0——**Windows 剪贴板站
> 机器级楔死**（疑因此前多次强杀挂起测试进程，electron 持剪贴板中途被 taskkill /F）；
> TextInputHost 终止无效、rdpclip 不存在。③**条件跳过机制**（楔死期间保门禁、恢复后
> 全断言自动回归）：main.cjs 增加 `clipboardHealthy()` 自检探针（writeText/readText
> 回读）——m1 workflow 两剪贴板步骤经注入 `__cbHealthy` 整段条件化（含计数断言
> before+(healthy?4:2) 与多选集合条件化）、preview-delivery clipboardPathOk/ImageOk 与
> 计数合取放行、channel-wiring copyThumbnails 轮询跳过——**三处跳过均在结果 JSON 响亮
> 标记 clipboardSkipped:'skipped-clipboard-wedged'，不静默放水**；剪贴板恢复后断言自动
> 全量回归。
> **门禁（楔死容忍态）**：tsc EXIT:0；suite 47 项 46 绿（唯 react-stage7d6a 偶发家族，
> 独立复验立即全绿——既有协议）+ 3 剪贴板测试以 clipboardSkipped 标记通过；m1
> MAIN_WORKFLOW_SMOKE_OK + MAIN_UI_RESTART_OK（clipboardSkipped:true 记录在案）。
> **遗留动作（用户侧）**：剪贴板恢复（重启机器）后重跑 `node tests/run-react-suite.mjs`
> + `node tests/main-ui-workflow-closed-loop.mjs` 一次，确认剪贴板断言全量回归绿即可
> （代码无待办）。
>
> **重启后确认（2026-09-05）**：剪贴板恢复（PowerShell Set/Get 回环 OK）→ 重跑即暴露
> 探针自身缺陷——**探针 writeText 具破坏性**，m1 driver 中其首次调用晚于 writeImage 预写
> → 健康路径下探针串覆盖预写图片 → read-win-files 空图抛错（楔死期间探针写不进反而侥幸
> 通过）。修正（20611a7）：三个 driver（m1/preview-delivery/channels-smoke）均把探针
> **提升到产生任何剪贴板内容之前**并缓存结果（`__m1CbHealthy`/`__pdCbHealthy`/入口直调），
> 合取与模板改读缓存。复跑：**suite 47/47 ALL GREEN 且 clipboardSkipped 计数 = 0**
> （三处剪贴板断言全量真跑通过）+ m1 双 OK（clipboardPath/clipboardImage = true）——
> b1-9am 门禁以全断言态彻底闭合。
>
> **b1-9ao：收官后追加——台账⑨首批：侧栏 expand 右键菜单族（2026-09-05）**
>
> Sidebar.tsx:360 已消费的 openFolderExpandContextMenu 全仓无定义（活断）——首批补齐
> toggle 家族 7 fns（toggleSelectFolder/toggleCurrentLevelFolders/toggleAllFolderExpand/
> toggleSelectSmartFolder/toggleCurrentLevelSmartFolders/toggleAllSmartFolderExpand/
> toggleAllFolders，bundle 38750-38823 逐字；controller 闭包 toggleAllFolders/
> toggleCurrentLevelFolders/toggleAllSmartFolders/toggleCurrentLevelSmartFolders 为模块级
> 函数）+ openFolderExpandContextMenu（bundle 38578-38618；ContextMenu.open → 模块常量
> 等价广播，onOpened/onClosed 的 $(event.delegateTarget) → React synthetic currentTarget
> classList）。**审计修正**：openSmartFolderExpandContextMenu 早在 b1-9w 已移植
> （controllerFns:5213，ContextMenu.open 模块常量承载）——第二轮审计漏查该键，首批误加
> 重复实现即删（fns 表 census 196→204，1c3 spot +5）。
> **顺带修复**：inspectorActions.contextMenuOpen 的 htmlScope 解析依赖 window.angular
> （C1 摘除 bundle 后恒 undefined）→ 检查器 emoji/color 右键自 C1 起静默失效——补
> bodyScope 回退广播。
> **闭环**：menu-popup-closed-loop 新增站点 7——真驱动（合成事件 + 真实侧栏节点）+
> 临时 $on 捕获 CONTEXTMENU.OPEN 载荷：3 项 i18n 标签（「展开/收起文件夹」等实锤）+
> showSearch:false + onOpened/onClosed 可调。
> **门禁**：tsc EXIT:0；1c3 census OK（204）；suite 47/47（commit 后记录）。
>
> **b1-9ap：台账⑨第二批——openFolderContextMenu 主菜单 + 依赖面 26 fns（2026-09-05）**
>
> bundle 39012-39549（538 行菜单本体）+ 依赖 fns 逐字移植（fns 表 204→232，1c3 census
> 同步）：**模态后端确认**——菜单点击的五个广播通道 React 侧监听面全在（OPEN_RENAME→
> BatchRenameArtstationModals:1563 / EDIT.SMART.FOLDER→FolderSelectPanels:1075 /
> FOLDER_SETTINGS→SelectPanels:856 / SET-FOLDER-PASSWORD→SmallPanels:618 /
> ADD_TO_LIBRARY→ProgressDialogs:1223），菜单可达即可用。**移植清单**：
> 密码族 3（set/change/resetFolderPassword→广播）、排序族 4（setFoldersOrder/
> setFolderOrder/setFoldersSortIncrease/setFolderSortIncrease——含 sortRawData/reload/
> saveFolder 链）、lockFolder、settingFolder、renameFolder（#folder-input-{id} DOM 约定
> 经 wQueryFocusFolderInput 保留）、batchRenameFolders、reorder 双雄（$scope 版+闭包版
> reorderFolderByTitleClosure，localeCompare languageBCP numeric）、cloneFolder（含
> 子树 id 重 guid）、removeFolder/removeSelectedFolders（swal checkbox 确认 + 递归闭包
> removeFolderClosure——ayncsImagesChange/hiddenByCurrentFilter/QuickAccessManager/
> cloneTree 复原链全保）、checkOperationSafety2（26824，悬空供给补移植）、
> refreshSubfolderList（27462，同上——newFolder/removeFolder 回调消费面，b1-9al 后悬空）、
> icon/color 族 4、folderExportAsPack/AsFolder（sanitizeFolderName win 保留名表逐字 +
> export-as-folder/export-images 通道 b1-9aa 已实接）、moveFolders、newFolder、
> copyFolderLink、showListSubfolderContent、菜单本体（多选/单选双分支 + 密码/导出/
> 资源库历史三子菜单 + emoji/color role）。
> **修正**：newFolder 实为 b1-9w 已移植（controllerFns:4119 __lv_ 风格）——本批误加重复
> 实现已删；census 曾误记 230，实为 232（正则漏数带数字键名），1c3 已按 232 校准。
> **闭环**：menu-popup 新增站点 8——真驱动单选分支：18 项标签 + 密码/导出/资源库历史
> 三子菜单形状断言。
> **门禁**：tsc EXIT:0；1c3 OK（232）；suite 47/47（commit 后记录）。
>
> **b1-9as：台账⑧收口——update-txt-item 主侧监听 + shim 往返（2026-09-06）**
>
> 原承载探明：run.jsc（bytenode 编译主进程入口，b5e7351 入库）常量池实锚
> 'update-txt-item'（紧邻 file-save-fail/thumbnail-generated/webp.converted——确为 main
> 侧 ipcMain.on，非渲染自转发）；渲染侧接收契约 = app.bundle.js:31141
> `{id, text} → itemMappings[id].text + updateTxtItem`（itemDomain.ts:594 逐字已在）。
> 三件套落地：① main.cjs ipcMain.on('update-txt-item') → BrowserWindow.getAllWindows()
> webContents.send 回发（本地 iframe 同进程发不到 main，必须经 main 往返）；
> ② shims.js send 路由 'update-txt-item' nativeRequire 直通（smoke:* 同款）；
> ③ shims.js onIpc 桥登记（preload webContents.send → mockEmit 进 shim 总线——itemDomain
> 两参监听签名与 shim emit 前置 {} 事件参天然兼容，实证于 shims 自定义 EventEmitter
> callback({}, ...args)）。闭环测试 txt-update-closed-loop.mjs（bootStack 全栈——裸
> regression-host 窗无 shims，require 走 nodeIntegration 原生通道测不到 shim 路由）：
> 双捕获 shimBus（生产链）+ native（preload 桥原始交付）均实收 {id:'TXT1', text:'NEW'}。
> **门禁**：tsc EXIT:0；1c3 OK（255）；suite 48/48。**台账⑧自此清零。**
>
> **【UX 回归实锚（用户真机反馈驱动，b1-9au/aw 前置诊断）】** 用户报"按钮点不了/图像点不开"。
> 七轮 CDP 真机探针（Input.dispatchMouseEvent 真实鼠标路径 + 页面内事件日志/函数包装）
> 定位五类根因，全部实锚非臆测：① 双击缩略图进详情的 jQuery 委托（bundle 22183）随 C1
> 消亡后从未重挂——enterDetailMode 函数体健在（选中后直调正常进详情、原图正常渲染），
> 纯触发器缺失；② 条目右键委托（22212）缺失 + BoxList 容器级右键错绑
> openFileListContextMenu（该 fns 也从未移植——原 45249），条目右键全死；③ **22 处非
> 守卫 w.angular.\***（copy/isNumber/element+injector）——C1 摘除 bundle 后全是哑雷，
> 实测 adjustLayoutWidth 缩放 halfway 抛 `undefined.isNumber`（尺寸改了 relayout 没跑）；
> ④ eagle-hover-preview.js 提取片（b1-9am 按函数选拼）漏 4 个 bundle 顶层 var 声明
> （hoverPreviewObserver/mouseoverAudioTimeout/updateCursorInterval/HoverPreviewKeydown）
> ——每次悬停缩略图抛未捕获 ReferenceError、Z 键预览死；⑤ Ctrl/Alt+滚轮网格缩放
> （19764/19771）、onBoxMouseup（34821）、名称双击重命名（22178）、openFileWithDefault
> （33301）均未移植。方法论教训三则：探针连点 (0,0)（img 懒加载 0×0 矩形）、
> enterDetailMode/openItemContextMenu 的选中守卫、"无结果"系 ContextMenuPanel 隐藏
> 空态模板误报——误诊均由页面内 instrumentation 纠正。
>
> **b1-9au：UX 修复批——网格交互层重建 + 通道黑洞补路由（2026-09-06）**
>
> 五 fns 补移植（fns 表 258→263，1c3 同步）：openFileWithDefault（33301 逐字）、
> openFileListContextMenu（45249）、openOrderMenu（45253——Toolbar 排序按钮同为先前的
> 死按钮）、onBoxMouseup（34821）、onBoxListDblClick（22178+22183 合并：名称双击 →
> enableImageNameEditable 模块内直调；缩略图双击 → ctrl/meta 新窗 / alt 系统开启 /
> habits.doubleclick 分支进详情）。BoxList.tsx 原生监听重挂委托族：dblclick/mouseup/
> contextmenu（框内→openItemContextMenu、框外→openFileListContextMenu）+ wheel（挂
> #box-container，Ctrl/Alt+滚轮 120ms leading throttle）。**关键坑：fns 表条目不经
> scopeShim get 回退，React 侧必须走 callScope 路由**（hooks.ts core-first）。
> shim 补三通道直通：open-with-default（string rawPath 面 + previewCurrentItemId 排除
> 预览窗既有分支——回归实锚：无排除时 preview-delivery 闭环超时）、duplicate-file/
> copy-thumbnails（**b1-9aa main handler 此前从 UI 不可达——channel-wiring 闭环曾因
> 冒烟窗加载失败走原生 require 侥幸全绿，用户 vite 常驻后全栈页面下实锚黑洞**）。
> openFilesWithDefault 裸 `path` → `__lv_path`（同类哑雷）。R9 真机复验：双击
> (350,112) → BoxList 监听 → callScope → enterDetailMode("Probe 3") → isDetailMode=true
> 全链通；channel-wiring 全通道实绿（含 copyThumbnails）。
>
> **b1-9aw：hover-preview 提取片声明补齐（2026-09-06）**
>
> eagle-hover-preview.js 头部回填 4 个 bundle 顶层 var（hoverPreviewObserver =
> IntersectionObserver 实例逐字 + mouseoverAudioTimeout + updateCursorInterval +
> HoverPreviewKeydown）——node --check 过，悬停零 ReferenceError、Z 键预览/sentinel
> 观察器复活。
>
> **b1-9av：w.angular.\* 哑雷清除 + 键盘层复活 + scopeShim 读写分裂修复（2026-09-06）**
>
> ① 16 处活雷替换（dataMachinery 15 + ProgressDialogs 3；itemDomain 2 处为注释、
> libraryDomain 2 处带守卫诊断代码加注防误报）：angular.copy ×15 → structuredClone
> （folder/tag/conditions 纯数据面）、angular.isNumber ×2 → Number.isFinite（缩放
> halfway 崩溃点）、injector().get('$filter') ×1 → getFilter()('i18n')（与相邻行既有
> 供给一致）。② 键盘层复活：全仓无一处 Mousetrap.bind——原 initMousetrap 的绑定消费端
> （bundle 49326-49341 逐字：throttle 25 + $evalAsync）随 mgo-mousetrap 指令消亡，
> ~50 键（Enter/方向键/Del/星标/undo/quicklook/mod 系）全死且 update-menu/
> update-preferences 重绑通道在 React 世界无发送方。三件套：machineryInitMousetrap
> 补绑定循环 + applyDataMachineryScope 尾部启动期初始化 + **scopeShim set 陷阱双写修复**
> （get 优先读 target 而 set 只写 coreState——target 预置字段读写分裂实锚：
> controller 种子 s.mousetrap={} 恒读旧值，bindings map 写入即丢、R10 往返探针
> sameRef:false 坐标；另两坑：s.initMousetrap 恒 undefined（三键盘 fns 从未装配 scope，
> 直接调模块函数）、s.mousetrap 种子 {} 不可作 if-absent 判据）。
>
> **b1-9ax：UI 交互闭环测试入套件（50→51）（2026-09-06）**
>
> 本轮 UX 事故的制度性补强——50 项套件此前只验数据面通道、不验真实交互。7 断言全绿：
> dblclick-opens-detail（真实 CDP 双击 .box 中心）/ exit-message-leaves-detail
> （viewer 'Exit' postMessage 原版链）/ enter-key-opens-detail（键盘层全链）/
> item-context-menu-nonempty（CONTEXTMENU.OPEN 广播 payload——面板 React state 驱动，
> s.activeMenu 为旧服务字段不可靠）/ list-contextmenu-opens-order-panel（合成
> contextmenu + OPEN_LAYOUT_PANEL 间谍）/ ctrl-wheel-zoom-changes-grid-size（CDP
> modifiers 位掩码 2=Ctrl）/ hover-zero-reference-errors（b1-9aw 回归哨兵）。
> 断言全部用 scope/广播信号，视觉类不可靠（误报史见 b1-9au 节）。
>
> **门禁（au+aw+av+ax 四批累计）**：tsc EXIT:0；1c3 OK（263）；suite 51/51 全绿。
>
> **b1-9ay：残余扫查批——七轮真机走查再拔三雷（2026-09-06）**
>
> 用户追问"逐字移植架构会不会遗留很多问题"——以系统性扫查作答而非猜测：sweep A
> （Page.reload 全程 CDP 事件捕获启动普查：**0 致命错**，仅 3 个静态资源 404）+ sweep
> B1-B7（逐面真机走查七轮：侧栏/工具栏/搜索/详情/评级/快速搜索/偏好设置窗/批量菜单）。
> 方法论沉淀三条：①**Mousetrap 字符键监听 keypress**——CDP keyDown 必须带 text 参数，
> 否则 Enter/方向键/mod 组合（keydown 系）能过而字母/数字键全假死，且报错被
> applyWrapper+throttle 吞成静默；②**scopeApply/$apply 吞错走 console.error**，
> window.onerror 侦听是盲区——必须捕获 CDP consoleAPICalled（B7 起在网）；③**哑键
> 全量枚举**：`Object.entries(s.mousetrap).filter(typeof!=='function')` 一条诊断
> 抓全"绑定期 handler 缺失"类。
>
> **三真修**：① **clickNode/clickSmartNode 裸 `dragCheck` ReferenceError**（sweep B6
> 直调实锤）——原 bundle 闭包 var，逐字移植丢声明后每个侧栏文件夹点击必抛且被
> scopeApply 吞（用户侧表现：点文件夹无反应）；改经 `window.dragCheck` 通道（与
> Sidebar draggable start/stop 写入侧同一变量，globals.d.ts:21）。② **评级键族
> 0-5 全灭**（sweep B5 哑键枚举 5/67）——c18f-1 批仅落了 changeTo5Star，
> removeStar/changeTo1-4Star 定义+赋值双缺（bundle 30292-30314），按键即
> `TypeError: func is not a function`；machinery 逐字补齐五 fns+赋值+注册表。
> ③ **3 个静态资源 404**——ic-logic-or/and.svg（原版 Eagle 资产复刻仓从未有，
> 按既有 ic-logic 家族视觉语言合成）+ ic-welcome-library-missing-icon.png
> （SmallPanels:1196 72×72 消费，pngjs 合成 64×64 占位）。
>
> **撤案（考据为原版设计，非 bug）**：`body #toggle-all-btn{display:none}` ——
> 侧栏开关按钮仅 hide-sidebar 态显示（style_*.css 四主题一致）；筛选条 17 items
> 收起态全隐 = `snapshot.filterIsOpen` 门控（FilterItems2:1037，原版同构）；快速
> 搜索绑定 **J 键**（buildMousetrap `'j': s.openQuickSearch`），Ctrl+F 非其绑定。
> 验证探针侧纠错：toggle-all 信号应为 isHideSidebar 而非 selected；评级字段是
> `star` 非 rating；toolbar `call()` 对缺失 fn 静默跳过（与 BoxList callFn 同语义）。
>
> **验证**：residue-verify 探针 8/8 PASS——mousetrap-zero-dead-keys /
> folder-click-opens-folder（cf+hash）/ smart-folder-click-opens / rating-key-sets-star
> （'3'→star 3）/ rating-key-0-clears-star / zero-console-errors（含 404 清零）。
> 沉淀 **tests/residue-closed-loop.mjs 套件第 52 项**（同断言 + consoleAPICalled
> 全程哨兵）。harness connect() 补 CDP 事件缓冲（events 数组，此前事件全弃）。
> 偏好设置窗（ipc 'open.preferences' → 独立 target）多窗面探明健康：加载 complete、
> 零错误。
>
> **门禁**：tsc EXIT:0；1c3 OK（263——评级 fns 走 machinery 侧，fns 表不变）；
> suite 52/52。
>
> **【方向变更 + 彻底化启动（b1-9az 起，REWRITE-PLAN.md）】** 用户明确：根本任务是
> "原地改造为 React 19 + TS + Vite"，要**改得彻底**——逐字移植/数据面零改动铁律
> 让位于架构彻底化，行为锁定改由回归套件承担。量化审计：残留 25k 行（28%）——
> scopeShim 195 + fns 表 12,622 + machinery 11,882；组件层 576 处 scopeApply 绕道；
> $evalAsync/$watch/$broadcast 742 处 digest 语义；jQuery 1,056 处 + vendor 6 脚本。
> 五阶段蓝图入库 **src/app/react/REWRITE-PLAN.md**（状态单源 → fns 拆解竖切 →
> digest 退役 → jQuery 退役 → 终审删 shim），每批 52 项套件把门。
>
> **b1-9az：彻底化 R1 批 1——状态单源机制 + bodyState 20 字段源翻转（2026-09-06）**
>
> 机制：scopeShim 增迁移注册表 `migrateScopeFieldToStore(name, read, write)`——注册
> 字段 get/set 委托 zustand store（set 保留 coreState 镜像供 __eagleCoreState 诊断
> 面），startScopeSync 对已迁字段退化为无害回声（快照读 store→写 store 恒等）；未
> 注册字段行为不变。bodyState 首批注册 20 个顶层同名字段（theme/viewMode/
> isHideSidebar/isDetailMode 等——派生字段与嵌套路径留待后续批）。验证探针 5/5：
> scope-reads-store / scope-write-lands-in-store（Tab 键 → toggleAll → store）/
> store-write-readable-via-scope / body-class-follows-store /
> detailmode-scope-write-in-store。residue-closed-loop 增哨言
> scope-delegates-migrated-fields-to-store。tsc 真实 EXIT:0（无管道直跑）；suite
> 52/52。
>
> **b1-9az 首跑三红诊断（全套件抓出的真实回退，全部修复）**：① **sync 回声强转篡源**
> ——迁移字段若留在 build 快照里，`viewMode || 'all'` 类强转会经 apply 写回 store
> （openFolder 写 undefined、≤200ms 内被回声改写 'all'，`!s.viewMode` 守卫失效 →
> 网格失效 residue box-located 红）；修：迁移字段从 build/watch 全部剔除，展示级
> 默认（viewMode || 'all'）移到消费点 BodyBindings。② **cz1 契约修订**——
> core→scope 透明对已迁移字段按设计不再成立（coreState 是镜像），该方向断言改用
> 未迁移字段 keyword。③ **同值 setState 抹类**（7c welcome-open，栈实锚
> onWelcome → $evalAsync → flushWatchers → libraryDomain watcher → 同值写迁移字段
> → setState → BodyBindings（无 selector 全量订阅 + body.className 整写）重渲染抹掉
> 外部命令式 classList.add 的 is-welcome-page）；修两层：委托写入加同值守卫 +
> startScopeSync push 加快照浅比较 no-op 跳过（对所有 store 生效）。教训入账：
> **整写型 DOM 绑定组件（className/textContent）对"同值 setState 也会重渲染"敏感，
> 状态单源迁移必须带同值守卫**。
>
> **b1-9az R1 批 2：listState 8 + toastState 2 + lockState 1 字段源翻转（2026-09-06）**
>
> 扁平 store 普查结论：可逐字段委托的仅 bodyState（批 1）/listState/lockState/
> toastState 四个；toolbarState/detailState/inspectorState/sidebarState/panelState/
> tagManagerState 为单 snapshot 整体形状（逐字段委托不适用，留阶段 2 竖切收编；
> 其与 bodyState 重复镜像的字段经 scope 委托自动保持一致）；uploadState 全嵌套/
> 派生，跳过。批 2 注册 11 字段：listState（keyword/listDone/isHideSubFolder/
> showSubfolderContent/currentOrderBy/currentSortIncrease/unfiledCount/untaggedCount
> ——keyword 有 undefined 写入（dataMachinery:3267），消费方全为布尔/比较上下文，
> 裸值安全）、toastState（localhostError/libraryPathPermissionError）、lockState
> （isAppLocked——$root 即 proxy 自指，s.$root.isAppLocked 写入经同一陷阱）。保留
> listState 的 viewMode/isLoading/layout 为 bodyState 已迁字段镜像副本（ListRegion:290
> 读 l.layout——**镜像字段不可从 build 删除**，回声教训的对称面）；不重复注册
> （注册表同名覆盖）。验证 r2-verify 6/6：三 store scope↔store 双向 + 同值守卫
> subscribe 计数 + 镜像跟随 + 真实搜索框链路。tsc 真实 EXIT:0；suite 52/52。
>
> **cz1 二红教训（套件抓出，已修）**：批 1 修订 cz1-core-to-scope 时静态选了 keyword,
> 批 2 恰好迁移 keyword 自踩——静态字段名会随迁移批次失效。修：scopeShim 暴露
> `getMigratedScopeFieldNames()`（挂 window.__eagleScopeShim.migratedFieldNames），
> cz1 动态从候选表选未迁移字段。**机制测试选探测字段必须动态化**。
>
> **阶段 1 完成判定（R1 收官）**：扁平 store 的恒等字段已全部翻转（bodyState 20 +
> listState 8 + toastState 2 + lockState 1 = 31 字段）；扁平 store 普查无可继续项。
> **委托机制的天赋边界**：只覆盖原始值顶层字段——对象嵌套态（imageSize.height、
> currentFolder.*、selected[]）的变更不经过顶层 set 陷阱，无法委托；其状态单源化
> 属于阶段 2 竖切本职（store action + 不可变更新，随各子系统 fns 归位一并落地）。
> 阶段 2 首竖切（网格视图）备料完成：zoomIn/Out 双分支（网格 adjustLayoutWidth/
> saveListHeight/checkListItemsLessThanContainer + localStorage；详情 zoomRatio
> 阶梯 + updateZoomRatio）、imageSize 写入面 8+ 处、smoothZoom 调用点 67 处。
>
>
> **【S4 中期全量 55 项 ALL GREEN + S5-bn 考据定论（2026-09-07）】**
> bk/bm 后全量门禁通过。**S5-bn 施工边界（考据）**：openItemContextMenu =
> fns["openItemContextMenu"]（controllerFns 921-2079，1,159 行 async builder →
> label/keywords/click descriptor 树 → ContextMenu.open → CONTEXTMENU.OPEN 广播 →
> ContextMenuPanel $on 消费）。**非 bd/bk 式可机械搬移函数**：体深依赖 makeControllerFns
> 闭包私有面——initLinkVars / __cc_* 惰性单例 ×33（8115+ 补端口）/ ContextMenu 模块
> 常量 / URL_MODULE 惰性解析。bn 拆两步：先把这些闭包 helper 归位（bo 前置），
> 再整体搬 itemMenuService + descriptor 类型化；dispatch 改 eagleBus（defineChannel）
> 与 ContextMenuPanel 订阅迁移同步做。
>
>
> **b1-9bo：S5 批 15——folder/smartFolder 族归位 + CONTEXTMENU→eagleBus 原子切换（2026-09-07）**
>
> **面A 频道切换（首个 $broadcast→eagleBus 整频道退役）**：bus.ts defineChannel 落地
> contextMenuOpenChannel/CloseChannel（载荷契约沿用原广播）；发射端 4 处同批切换——
> contextMenuDomain（集中点）/controllerFns openFolderExpandContextMenu 体内直发/
> selectPanelEngine openAppContextMenu/inspectorActions contextMenuOpen（后者顺带消亡
> b1-9ao 时代 angular 缺席 htmlScope 回退问题）；消费端 ContextMenuPanel $on×2→bus.on。
> 测试契约同步：stage7a 4 发射 + menu-popup 3 间谍 + ui-interactions 1 间谍 2 CLOSE 全
> 改 __eagleBus 直达（测的是「通道→面板」而非 scope 面，非回避）。collect-window
> 本就独立监听器体系，不涉。哨兵合法下降吸收：broadcast 129→124、on 76→73、
> getBodyScope 669→664。
> **面B folder/smartFolder 族搬迁（≈2,560 行）**：b1-9ap 台账区（948 行：reorder/
> removeFolderClosure 2 闭包 + 27 fns）+ b1-9aq 台账区（644 行：ayncsUpdateSmartFolders
> Count/removeSmartFolderClosure 2 闭包 + 21 fns）+ 三 builder（openFolderContextMenu
> 544 / openSmartFolderContextMenu 369 / openNewSmartFolderContextMenu 33）+ 模块级
> 辅助 3（treeWalkSafe/wElectronLogInfo/wQueryFocusFolderInput）→ **services/
> folderMenuService.ts**（2,614 行）。结构=installFolderMenuFns(fns, getScope) 工厂——
> 提取区原为 makeControllerFns 闭包段（依赖仅 fns 表+getScope），整段包进工厂与原作用
> 域完全等价，**代码体零改动**；controllerFns 尾部 installFolderMenuFns(fns, getScope)
> 批量注册（50 个 fns 条目名/挂载面/键位表零改动，P4 fns 表清零时随壳退役）。
> 符号解析段（$filter 双轨/$timeout digest shim/i18n/preferences/eagle/swal/dialog/
> remote/currentWindow）与 controllerFns 同源双写——哨兵 apply 9→10、getBodyScope
> 664→666 为搬迁复制合法吸收（P4 删 controllerFns 时归零）。
> **过程拦截**（协议持续生效）：bo-surgery 断言 `count==1` 被自身注释里的函数名
> 误触（==2 修正）；tsc '}' expected 揪出 helpers 提取件在 wQueryFocusFolderInput
> 函数头行截断（i_wqfi+1 只取到声明行）——逐块括号平衡断言补位（brace delta==0
> 门禁加入重组脚本）；controllerFns 忘 import contextMenuOpenChannel 由 menu-popup
> 站点 7 运行时揪出。controllerFns 11,433→8,866 行（-2,567）。
> 门禁：tsc 0 + 哨兵 OK + 定向 5 项全绿（menu-popup 5 站点含新 builder 双站 /
> ui-interactions 7/7 / stage7a（bus 通道下 8 断言）/ 1m1 a7=true / 探针6：263 fns
> 完整 + folder CRUD 10 名注册 + openFolderContextMenu bus 广播 27 项）。
> S5 余量：bp（filterAdd/new/orderBy 12 builder 三批合收）。
>
>
> **b1-9bn：S5 批 14——openItemContextMenu 归位 itemMenuService + contextMenuDomain（2026-09-07）**
>
> **考据推翻预估**：bn 前置考据（91f46c8）以为 1,159 行构建器深绑 makeControllerFns
> 闭包私有面（initLinkVars/__cc_*×33）——标识符普查证明**闭包依赖仅壳层前导**
> （initLinkVars + getScope），__cc_* 惰性单例全部经 scope 面调用（s.copyTags() 等 12 处
> s.xxx 委托），ContextMenu/URL_MODULE/renameImages 本就是模块级常量。闭包耦合恐惧
> 源于「未先做逐符号普查」。
> ① **contextMenuDomain.ts（新）**：URL_MODULE（惰性解析）/ ContextMenu（open/close =
> 根 scope 广播 CONTEXTMENU.OPEN/CLOSE，React ContextMenuPanel $on 消费）/ renameImages
> （bare event = window.event 怪癖逐字）/ openWithApplicationPath（bundleGlobals 兜底）
> 集中归位 + export 化。controllerFns 其余 8 个菜单 builder（openTrashContextMenu/
> openFileListContextMenu/openFolderExpandContextMenu/openNewContextMenu/
> openFilterAddContextMenu/openQuickAccessContextMenu 等）暂经 import ContextMenu 消费——
> **bo 批 CONTEXTMENU 频道切 eagleBus 时发射端在此集中切换**（本批频道零改动：测试契约
> menu-popup 站点 7/8/9 与 ui-interactions ③ 均经 scope.$on 捕获，双通道双投递窗口风险
> 避免）。
> ② **itemMenuService.ts（新，1,193 行）**：openItemContextMenu async 构建器整体逐字
> 搬移（s 参数化——bd/bk 式；显式符号解析段：EagleConfig/VIDEO/AUDIO/FONT/
> NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES 常量、ipcRenderer/electronLog/currentWindow/
> remote 模块常量、bare eagle/i18n/$bodyScope/swal/preferences/process/path/require/
> appRoot/FileUrlHelper/pluginModule/ReverseImageSearch/ayncsImagesChange/
> ayncsImagesGeneratePalette/removePlayingAudios 经 window 全局回退——bundleGlobals 供给，
> 与 controllerFns @ts-nocheck 形态等价；@ts-nocheck 同源惯例）。fns 表留壳
> （itemMenuOpenItemContextMenu(getScope(), ...args)），挂载面/键位表/内部调用零改动。
> ③ **真回归×2（探针驱动定位）**：(a) controllerFns import 只导 getContextMenu 未导
> ContextMenu 本名 → 其余 8 个 builder 运行时 ReferenceError（menu-popup 站点 8 揪出）；
> (b) itemMenuService $filter shim 缺 machineryGetFilter 回退 → shim 世界首行
> `$filter(...) is not a function`（探针5 锁死：unhandledrejection 捕获 + waitFor 轮询
> 就绪——探针 1-4 的超时全是探针自身基建 bug：bootStack 参数形态/ESM file URL/
> pngjs 具名导出/fixture 时序，教训：**探针必须照抄既有测试的 boot 模板**）。
> menu-popup 静态审计面同步：shareMenu 站点审计改为 controllerFns+itemMenuService+
> contextMenuDomain 三文件联合读（搬迁后正主位移）。
> **协议落地**：本批全程按「循环思考根因排查」新协议执行——span 手术脚本内容锚定位
> （0/1-based 手算错断言连续拦下 6 次，全部拦截于写入前）+ 逐块首尾行断言 + bash 隔离
> python 走文件不走内联。controllerFns 12,627→11,433 行（-1,194）。哨兵 getBodyScope
> 670→669（注释裸词去重，合法下降）。门禁：tsc 0 + 哨兵 OK + 定向 5 项全绿
> （menu-popup 5 站点 / ui-interactions 7/7 含 item-context-menu / stage7a / 1m1
> a7=true / 探针 30 项菜单广播）。
> S5 余量：bo（folder/smartFolder 菜单 + CRUD 37 + CONTEXTMENU→eagleBus 原子切换）、bp
> （filterAdd/new/orderBy 12）。
>
>
> **b1-9bm：S4 批 13——媒体族归位 + videopreview 原生化（2026-09-07）**
>
> ① **videopreview 状态机 jQuery→原生**：detailHooks 内 videojs 进度条缩略图预览的 7 个
> jQuery 命名空间事件块（mousedown.videopreview/mouseup.videoprocess/mousemove 等）改
> 原生 addEventListener——`onVp` 辅助 + **模块级清理注册表**（dispose 原命名空间 off 与
> 视频重挂统一走 clearVideopreviewListeners，杜绝 body 级监听泄漏——原 dispose 清理
> 漏掉 progressbar 的 mouseup.videoprocess，属顺带修复）；pageX/offsetX/buttons 均
> MouseEvent 原生字段，拖拽 seek 数学逐字保留。
> ② **mediaService 归位**：addVideoComment（swal 输入 → comments 落库 + 广播刷新）/
> getVideoPlayer（mpv/native 双探）/ rememberVideoCurrentTime / videoScreenShot（mpv
> screenshot API / native drawImage 双路）四函数自 dataMachinery 逐字搬移（machinery 留
> 委托壳），组件侧 8 处直调（detailHooks ×6、inspectorActions ×2）。
> **教训入账**：跨行注释的 span 推导连续三误（6293 空行 / 9447 越入下一函数注释 /
> 花括号计数器被模板字符串扰乱）——**文本 span 操作必须逐块断言首尾行内容**，断言
> 连续三次拦下错位写入。哨兵 getBodyScope 672→670。门禁：tsc + 哨兵 + 定向 4 项全绿。
> S4 余量：bl（smoothZoom 剥壳，74 调用面）独立完整会话。
>
>
> **b1-9bk：S4 批 11——detailService 归位（2026-09-07）**
>
> 新建 `services/detailService.ts`：toggleDetailMode / smartZoom / updateZoomRatio 三函数
> 实现体自 dataMachinery 逐字搬移（machinery 留委托壳，键位表 'enter' 与内部调用点零
> 改动）；**三处重复的 zooming 类 300ms 护栏块抽取为 beginZoomingTransition()**（原
> updateZoomRatioTimeout 闭包变量 = updateZoomRatio/homeHandler/endHandler 共用句柄，
> home/end 的复制粘贴块随之去重）；getRatioExp/NonExp 留 machinery（双侧函数声明提升的
> 既有循环依赖模式）。组件侧 3 处直调：FolderModals smartZoom ×2、detailHooks pinch
> 缩放 updateZoomRatio ×1（$evalAsync 语义保留）。smoothZoom 本体（74 调用面：machinery
> 36 / controllerFns 21 / preview-window 17）留 bl 批剥壳。哨兵 scopeApply 185→184、
> getBodyScope 670→672（bg/bh 直调削减已被 bj 重播种吸收，bk 便捷包装 +2）逐批如实吸收。门禁：tsc + 哨兵 + 定向 4 项（preview-delivery
> 详情链路）全绿。
>
>
> **b1-9bj：S3 批 10——自研取色器 + colorpicker vendor 退役（2026-09-06）**
>
> 新建 `components/filter/ColorPicker.tsx`：自研 HSV 平面取色器（SV 方格 + 横向色相条、
> Pointer Events、零 vendor；onChange 派发不带 # 的 6 位大写 hex 对齐原 vendor 契约、
> color props 外部同步 = ColorPickerSetColor 等价物）。FilterItems 色筛选项换装：原
> jQuery ColorPicker 挂载 effect（flat 模式 + 33ms 防抖 + currentColor ngModel 路径 +
> colors-picker 双输入框同步 + 快捷框回焦）逐字保留为 handlePickerChange；vendor 的
> js×3 + css 从 index.html 退役（vendor script 标签 9→6）；controllerFns 的
> ColorPickerSetColor 调用摘除（scope 写 rules.color.value 即 props 同步）。
> **顺手修 bc 真回归**：filterFoldersFn 的 `const _ = w._` + `!_` 守卫——lodash.js 卸载
> 后 `w._` 恒 undefined → 文件夹筛选关键词搜索静默失效（**哨兵盲区：裸绑定无方法调用
> 形态**，lodashWindow/lodashBare 均不命中）；同函数的 `_.string && _.score` 失真
> fallback 修正为 String.prototype.score 原型扩展同形调用。哨兵新增 **lodashBind**
> 度量堵盲区（0）。quickSearch 核查：QuickSearchModal.tsx 已是 React 组件（$on 通道
> 触发面保留至 P4），计划项「quickSearch React 化」已由更早批次满足，无动作。
> 门禁：tsc + 哨兵 + 定向 6 项全绿。
>
>
> **b1-9bi：S3 批 9——filter 13 watcher 退役 → filterService 订阅（2026-09-06）**
>
> 新建 `services/filterService.ts`：setFilterRule = 12 条被 watch 数值路径（file/duration/
> bpm min/max、shape width/height、resolution minW/maxW/minH/maxH）的**唯一写路径**
> （镜像写 eagle.filter.filterRules + 显式通知订阅者；`window.__eagleFilterService` 测试面）；
> onFilterRuleChange 订阅中心 + setFilterRuleAndApply 便捷面。filterDomain：12 个
> scopeShim 轮询字符串 watcher（含 sweep claim 机制——bundle 已亡，对端竞争不复存在）
> 退役为单订阅（shape 组保留 width&&height 双条件原语义）；keyword watcher（bundle
> 33653）→ useListState.subscribe 变更差守卫（keyword 已是委托字段，store 订阅即全量
> 触发面）。FilterItems2 的 18 个写点（4 组 onCommit ×2 + 4 组 reset）全部改道
> setFilterRule——穷举式 grep 确认无漏网写入方。**1m1 契约同步**：a7 从「watcher 计数
> =1」改为「scope 零 watcher + ruleSubscribed」；m1-D 从直写 scope 改经
> __eagleFilterService.setFilterRule（旧写入形态本身即被退役面）。门禁：tsc + 哨兵 +
> 定向 6 项（1m1 首红 = D 段旧形态写入，改新正典路径后绿；main-ui 80s 子进程预算
> 抖动，串行复跑绿）。
>
>
> **b1-9bh：S2 批 8——侧栏 DnD 原生化（jquery-ui draggable/droppable 退役面 1/3）（2026-09-06）**
>
> initSidebarDrag 重写为原生 HTML5 DnD：dragstart（payload/dragCheck/helper 语义逐字
> 保留——helper 改离屏渲染 + setDragImage(-5,-5) 等价原 cursorAt{top:-5,left:-5}）、
> zone drop（tolerance:'pointer' 由 zone DIV 原生命中替代——考据实锚 zone 为 1px 绝对
> 定位条带无 pointer-events:none，DOM 命中语义与 jQuery hit-test 一致）、dragend 清理。
> 原 mouseover 惰性初始化退役（原生监听零成本，渲染即挂）；dragCheck 守卫迁移 =
> OS 文件拖放不放行（对齐 jQuery droppable 仅对 ui-draggable 生效的原语义）。顺删
> Sidebar 8 处死 onDrop*/onDragEnter/Over/Leave 处理器（s.onDropFolder 族全树无定义，
> scopeApply 吞错型死代码；ListRegion:238 同型死处理器属 content 子文件夹条面，留后续批）。
> **套件补缺**：`tests/react-s2-sidebar-dnd-closed-loop.mjs`（套件第 55 项）——侧栏
> 拖拽此前零覆盖，8 断言（dragstart 契约 ×3 / name-area 嵌套 / dragend 清理 ×2 /
> bottom-area 同级）全绿；教训入账：**bootStack 的 beforeElectron 返回值被丢弃，
> 跨段数据走闭包变量**。jquery-ui 剩余消费面：TagManager sortable / gridDirectives
> resizable（后续竖切）。门禁：tsc + 哨兵 + DnD 闭环 8/8 + 定向 6 项全绿。
>
>
> **b1-9bg：S2 批 7——侧栏树函数族归位（2026-09-06）**
>
> sidebarService.ts 扩充：clickNode / clickSmartNode（中键+dragCheck 守卫、meta 多选、
> shift 区间选择）、toggleFolderExpand / toggleSmartFolderExpand（展开四分支：⌘+alt
> 全层级 / ⌘ 第一层 / alt 子层 / 普通写 localStorage）、dblclickSidebarFolder（偏好分流
> collapse/rename）、preventMiddleClick——实现体自 fns 表逐字搬移（fns 表条目保留，
> shim if-absent 桥不拆，P4 随表退役）；b1-9ay 的 window.dragCheck 守卫逐字保留。
> Sidebar.tsx 14 处 scopeApply 绕道改直调（clickNode×1/clickSmartNode×1/toggle×7/
> dblclick×1/preventMiddleClick×4）；菜单族 contextmenu 处理器留 scope 路由（S5 归位）、
> DnD 四事件留 bh。**教训入账：整文件 Write 覆盖会把该文件既有导出清掉——sidebarService
> 重写时丢掉 b1-9bb 的 updateSidebarList 桥，tsc 四文件 TS2305 即抓**；rootAccess
> 481→495（fns 表 + service 双份拷贝，P4 删表归零，基线如实吸收）。门禁：tsc + 哨兵 +
> 定向 7 项（含 drag-start 的 dragCheck 触面）全绿。
>
>
> **b1-9bf：S1 收官——残余/孤儿清扫（2026-09-06）**
>
> be2 考据定论（通读 boxGridEngine.ts 全文）：现行网格 = vanilla egjs **v3** API
> （window.eg UMD 提取自 bundle；getGroupKeys/groupKey 分页窗口 page=60 + append/prepend
> + `_items._data` 私有读 + layoutComplete 后处理 selected/lazyLoad/raw attr）——
> @egjs/react-infinitegrid（v4 React children 模型）交换 = 条目模板 React 化（getItem/
> generateItem 300 行）+ 分页模型重构 + 布局回调迁移 + 私有 API facade，**全计划最大
> 单批，独立完整会话执行**（契约已录 gridService.ts 头注 + REWRITE-PLAN be2 批注）。
> bf 清扫：boxGridEngine 死孤儿 getBoxListHost 删除（全树零消费）；Toolbar 缩放按钮
> call('zoomIn'/'zoomOut') 直调 gridService（滚轮路径同款先例，套件已验证无 flush 依赖
> ——scopeShim ensureFlushTimer 兜底）；BatchSavePanel 的 zoomIn/Out 为本地列表尺寸
> （非主网格面），不动。**S1 收官全量 54 项 ALL GREEN**；S1 状态 = bd/be/bf 完成，
> be2 遗留批交接。
>
>
> **b1-9be：S1 批 5——switchLayout 归位 + infinitegrid 依赖就位（2026-09-06）**
>
> machinerySwitchLayout 实现体（body class 四分支 + relayout/offsetScrollbar/initMenu
> 经 scope 解析）搬移 gridService.ts → gridSwitchLayout，machinery 留委托壳。
> @egjs/react-infinitegrid@4.13.0 安装（官方 React 绑定，全项目唯一保留第三方；导出面
> InfiniteGrid/MasonryInfiniteGrid/JustifiedInfiniteGrid/FrameInfiniteGrid/
> PackingInfiniteGrid）。**be 拆分决策**：renderer 交换立为独立批 be2—— vanilla 实例
> `new w.eg.InfiniteGrid("#box-container .box-list")` 的条目 DOM 由 boxGridEngine
> 字符串构建，交换 = 条目渲染 React 化 + `window.ig` facade 化（方法面普查：
> remove×7/getItems×6/clear×5/trigger×2/layout×2/getGroupKeys×1/_layout._columnLength×2，
> 契约已录 gridService.ts 头注），machinery 调用面零改动；体量独立成批，危险批全量门禁。
> REWRITE-PLAN v2 批表同步（S1 = bd/be/be2/bf 四批）。门禁：tsc + 定向 4 项。
>
>
> **b1-9bd：S1 批 4——gridService zoom 族归位（2026-09-06）**
>
> 新建 `src/app/react/services/gridService.ts`：saveListHeight（150ms 防抖 per-view
> localStorage）/adjustLayoutWidth（列数换算 + egjs relayout + box-size attr）/zoomFit/
> zoomIn/zoomOut 五函数实现体自 dataMachinery 逐字搬移；machinery 侧留委托壳（内部
> 3 处直调点与 scope 挂载面不变，键位表 '-'/'+'/'mod±' 路径零改动）；详情分支 ratio
> 梯度仍经 scope 解析（getRatioExp/getRatioNonExp/updateZoomRatio，S4 归位）。
> BoxList Ctrl/Alt+滚轮改直调 gridService（去 callFn 绕道）。**gridState 决策：推迟到
> be 与 infinitegrid 交换一并落地**——imageSize 是对象态，嵌套写不经 scopeShim 顶层
> set 陷阱，先造镜像 = 第三份拷贝违背单源目标（REWRITE-PLAN 批注同步）。哨兵
> getBodyScope 684→686（service 便捷包装 ×2）；coreState 触发词教训：**注释措辞也算
> 计数——gridService 头注释改写**。门禁：tsc + 哨兵 + utils 单测 + 定向 6 项（含
> ui-interactions ctrl-滚轮缩放断言 ⑤）全绿。
>
>
> **b1-9bc：P0 批 3——lodash 原生化 + vendor lodash.js 退役（2026-09-06）**
>
> 新建 `src/app/react/utils/func.ts`（debounce/throttle，含 cancel/flush）+
> `utils/lang.ts`（get/unescape/max/uniq/isString）。**语义按 vendored lodash 4.x 实测
> 复刻而非注释口径**：`debounce(fn, wait, true)` 第三参被 isObject 拦截 → 实际运行时
> 是 trailing（bundle 注释 "leading" 口径与运行时不符，以运行时为准）；throttle =
> leading+trailing 双缘（窗外首调立即、窗内末次入参窗尾补发一次）。全部调用点原生化：
> dataMachinery 15（debounce×4/throttle×3/get×2/unescape×2/isString/uniq/max）、
> bundleGlobals 36（get，字体 hashID 链）、controllerFns 9 + 删 `const _: any =
> (window as any)._` 绑定、tagManagerDomain 1（calculateTagsDebounce）、inspectorActions 3
> （unescape）、QuickSearchModal/ContextMenu/FolderModals 5 + 删局部 `const _ =` 与
> `if (!_) return` 守卫。index.html + preferences.html 的 lodash.js script 移除（两窗口
> 剩余已加载脚本零 `_` 消费；preferences 注释同步更新）。**单测抓真 bug**：get 的中途
> 断链（如 `{a:{}, 'a.b.c'}`）lodash 归一 undefined 后回落 default，初版实现提前 return
> undefined——`tests/react-utils-native.mjs`（19 断言，套件第 2 项，纯 Node）锁语义后修。
> 哨兵新增 lodashWindow/lodashBare 两度量（0/25，25 全为历史注释；新注释勿用 _.method
> 措辞），vendorScriptTags 10→9。门禁：tsc EXIT:0 + utils 单测 + 哨兵 + 定向 11 项
> （首跑两红 main-ui-workflow 超时/empty-trash EBUSY 清理——**并行起多 Electron 套件
> 的资源争抢误报**，串行复跑双双即绿；教训入账：**定向子集不得并行launch**）。
>
>
> **b1-9bb：P0 批 2——四大热点 service 收编（2026-09-06）**
>
> 新建 `src/app/react/services/` 四模块（桥接模式）：selectionService（updateSelection）、
> sidebarService（updateSidebarList）、folderService（saveFolder）、gridBindingService
> （calculateImageBinding）——实现体暂留 machinery（S2/S5/S7/S1 竖切迁入），service 为
> **组件侧唯一入口**（内含 typeof 守卫，等价原 TagManager 的 `typeof s.saveFolder ===
> 'function'` 形态）。组件侧 33 处直呼 scope 属性迁移为直调 service（9 文件：
> BatchRenameArtstationModals 8 / FolderModals 6 / SmallPanels 9 / FolderSelectPanels 3 /
> DuplicateFamily 3 / InspectorTagSelectPanel 2 / inspectorActions 2 / ControllerModals 1 /
> TagManager 1）。哨兵 getBodyScope 685→684（组件侧 −5、新桥 +4）；scopeApply 面不变
> （SmallPanels 块结构保留）。教训入账：**replace_all 编辑勿跨语义行——一次误删
> TagManager.addTags 行，哨兵式 grep 复查即抓回**。门禁：tsc EXIT:0 + 哨兵 OK +
> 定向 12 项（7a/7c/7d1a/7d1b/7d1c1/7d6a smoke + main-ui-workflow/channel-wiring/
> menu-popup/ui-interactions/drag-start/empty-trash closed-loop）全绿。
>
>
> **【REWRITE-PLAN v2 定稿：彻底化全程计划至收尾 + b1-9ba 基建批（2026-09-06）】**
> 用户拍板三决策：① 门禁节奏 = **定向 + 竖切收官全量**（常规批定向子集 ~10 项，
> 竖切收官/危险批 53 项全量）；② **独立窗口面纳入本轮**（preview-window/
> collect-window/viewers）；③ 非 Angular 第三方库**全部自研替换**（唯一例外
> @egjs/react-infinitegrid 官方 React 绑定）。旧「数据面零改动/逐字移植」铁律
> 退役，行为锁定移交回归套件。REWRITE-PLAN.md 重写为 v2：P0 基建 3 批 → P1 竖切
> 7 面 17 批（网格/侧栏/筛选搜索/详情/菜单族/批量回收站/inspector）→ P2 独立窗口
> 2 批 → P3 UI 原语自研 2 批 → P4 终审 3 批（digest 退役 → fns 表清零 →
> scopeShim/scopeBridge/coreState 删除 + grep 永久哨兵 + 收官审计），共 27 批，
> 提交号 b1-9ba → b1-9ca；DoD 六项（六文件删除 grep-zero / 永久哨兵扩面 / vendor
> 清零 / infinitegrid / 套件 65+ / 收官文档）。
>
> **b1-9ba：基建批——bus.ts + 死供应商/死频道处置 + 彻底化哨兵（2026-09-06）**
>
> ① **`global/bus.ts`**：类型化事件总线（on/once/emit + `defineChannel<P>` 按频道
> 类型化句柄；handler 异常隔离对齐 scopeShim.$broadcast 语义；`window.__eagleBus`
> 测试面）——$broadcast/$on 的最终替代物，竖切逐频道迁移。
> ② **死供应商**：index.html 移除 jquery-long-click.js / jquery.bez.js（全树零消费，
> vendor script 标签 12→10）。
> ③ **死频道处置（重推导）**：bundle 已摘除 → 接收者只可能在 react 树。$broadcast
> 40 频道 ∩ $on 41 频道归一化 diff，并排除动态频道名（$on(eventName) 变量形式：
> FilterItemShell/Sidebar）与未挂载文件（js/directives、js/plugin 均不被 index.html
> 加载）干扰。**无接收死广播 5 条移除**：MOVE_TO_FOLDER（machineryMoveToFolders
> 函数保形、快捷键入口不变）、RESET_PAGE（machineryResetPage 保其余复位语义）、
> OPEN_IMAGE_FILTER ×2（libraryDomain 保 hasUrlState 消费标记）、OPEN_LIBRARY_PANEL
> （fns switchLibrary else 支留注释）、Update_Tags_Filter（tagManagerDomain）。
> **无发送死监听 3 处移除**：INSPECTOR_SAVE_CHANGES + PLUGIN_UNINSTALL
> （inspectorActions）、UPDATE_PLUGIN_PANEL（PluginFamily）。均为 bundle 摘除时代
> 即死链路（全树无对端），移除行为中立。**两监听经契约复核保留**：OPEN_NOTIFICATION
> （7c 强契约：广播→弹窗开）、REFRESH_PLUGIN_CENTER（7d5b 契约：广播不崩）——
> 发送面虽死但套件锁定行为，随竖切归位。死特性登记 REWRITE-PLAN v2 §五（程式库
> 面板/URL imageFilter 直开/移动到文件夹选择器/通知弹窗），竖切时重建或正式移除。
> ④ **`tests/react-rewrite-sentinel.mjs`**：彻底化单调门——13 项计数
> （evalAsync 384/apply 9/watch 23+8/broadcast 129/on 76/scopeApply 207/callScope 27/
> getBodyScope 685/jQuery 78/rootAccess 481/coreState 32/vendorScriptTags 10）对照
> `react-rewrite-sentinel-baseline.json`，超基线即 FAIL（防倒退），低于基线提示随批
> 更新；死频道复活哨兵（按行排除 // 注释误报——controllerFns 历史注释教训）+
> vendor 退役标签哨兵（只认 src= 标签形态）；套件 52→**53** 项，哨兵列第 1（无
> Electron、毫秒级，最快暴露）。哨兵自校准发现并回填：on 76/getBodyScope 685。
> 门禁：tsc EXIT:0（honest unpiped）+ 全量 53 项。
>
>
> **b1-9ar：台账⑥收口——empty-trash 主侧闭环 + 进度/取消复活（2026-09-06）**
>
> 原承载探明：background.js:616 trashQueue 渲染窗承载（随 b1-9t 删除）——empty-trash
> 逗号串逐 id 物理删 `.info` + 每项回发 remove-trash-item（失败也回发，节奏不变）；
> cancel-empty-trash = pause+清 pending（在飞项完成仍回发）。且发现台账漏项：进度壳的
> 唯一原始激活路径 fns["emptyTrash"]（37013）/openTrashContextMenu（37924）从未移植——
> 回收站右键菜单整族死按钮，**DuplicateFamily 四处 send 原版即不置位 isCleaningTrash**
> （59555-59690 实锚），故不发明新置位、改按原版补移植三 fns（emptyTrash/emptyRestore
> /openTrashContextMenu，fns 表 255→258，1c3 同步）。五件套落地：① shims.js send 直通
> empty-trash/cancel-empty-trash（ayncsImagesRemove 分批串/DuplicateFamily 4 处/
> cancelEmptyTrash 的 sendTo——shim sendTo 忽略 id 落本路由）；② shims.js onIpc 桥
> remove-trash-item → mockEmit（miscDomain:892 既有监听递进收口）；③ main.cjs 逐 id
> apiRequest('/api/item/emptyTrash', {ids:[id], force:true})（permanentDeleteItems 暂存
> rename+rmSync+回滚语义）+ 每项完成 getAllWindows 回发 remove-trash-item；
> ④ cancel-empty-trash 置 cancelled 标志（新 empty-trash 入口重置）；⑤ 闭环测试
> empty-trash-closed-loop.mjs（bootStack 全栈 + 2 png fixture）：send('empty-trash',
> 'id1,id2,') → backend 条目消失 + .info 物理消失 + 回程事件 ≥2。
> **门禁**：tsc EXIT:0；1c3 OK（258）；suite 49/49。**台账⑥自此清零。**
>
> **b1-9at：台账⑦收口——native-viewer 主侧引擎 + 优雅降级（2026-09-06）**
>
> 引擎探测三实锚：① 原 EdgeJS COM 管线（PowerPoint slid.Export + ImageMagick）随
> 7ba4c85 删除不可重建（MS Office + Windows 专属 COM）；② 本仓 sharp 构建输入格式表
> 无 psd/pdf（jpeg/png/webp/tiff/gif/svg/heif/raw——psdload/pdfload 缺席，PDF 面走
> electron pdf-thumbnail-worker.cjs pdf.js）；③ nodeIntegration 不注入
> window.ipcRenderer 全局（探针实证 undefined）——native/entry.tsx:226 的
> parent.ipcRenderer.send 此前必抛 TypeError，viewer 恒卡 loader。落地六件套：
> ① shims.js window.ipcRenderer = shim 总线（原 app 世界直用面供给）；② send 直通
> generate-hight-resolution-thumbnail + invoke 直通 nativeImage.createThumbnailFromPath
> （darwin）+ onIpc 桥 native-preview-failed；③ **EAGLE_THUMBNAIL_TEMP_PATH mock 值
> 改仅浏览器预览态注入**（原 '/mock-thumbnails' 无条件写入 Electron 运行时会掩盖
> bundleGlobals userData/eagle-temp——finalFile/轮询面全错位的潜伏雷）；④ main.cjs
> generate-hight-resolution-thumbnail → backend /api/item/nativePreview（成功落
> finalFile 轮询自取，失败回发 native-preview-failed）+ nativeImage.createThumbnailFromPath
> handle（Electron 原生缩图落 tempFilePath）；⑤ backend 新服务 native-preview-service.js
> （ai→pdf.js worker 直读 PDF-compatible AI v9+ / ppt 族→soffice→worker（soffice 缺席
> 501→UNSUPPORTED）/ psd 族无引擎 NATIVE_PREVIEW_UNSUPPORTED——无占位图伪装，诚实降级）
> + legacy-office convertToPdf 导出复用；⑥ native/entry.tsx failed 监听（停轮询 +
> ready，与原版不支持扩展早退同 UX）。闭环测试 native-preview-closed-loop.mjs（手造
> 最小 PDF fixture 先经 worker 单体实验 200×200 PNG 实锚）：ext:'ai' → finalFile PNG
> 字节；ext:'psd' → native-preview-failed 回程 + 不产 finalFile。
> **门禁**：tsc EXIT:0；react-stage-smoke 全绿；suite 50/50。**台账⑦自此清零。**
>
> **b1-9aq：台账⑨第三批（收官批）——openSmartFolderContextMenu 主菜单 + 依赖面 23 fns（2026-09-05）**
>
> bundle 39550-40105（菜单本体多选/单选双分支）+ 依赖 fns 逐字移植（fns 表 232→255，
> 1c3 census 同步）：排序族 4（setSmartFoldersOrder/Order/SortIncrease——含 reload 链）、
> batchRenameSmartFolders、icon/color 族 4（单/多选双面）、cloneSmartFolder（子树重 guid）、
> renameSmartFolder、copySmartFolderLink、removeSmartFolder/removeSelectedSmartFolders
> （swal 确认 + 闭包 removeSmartFolderClosure——origin 复原/openSmartFolder 接力/
> QuickAccessManager 清理链全保）、smartFolderExportAsPack/AsFolder（existInSmartFilter
> 经 dataMachinery:11317 已供——智能匹配面零缺口）、newSmartFolder/newChildSmartFolder
> （NEW.SMART.FOLDER 广播→FolderSelectPanels:1054 监听）/newSmartFolderGroup/prependFolder、
> openNewSmartFolderContextMenu（含 newSmartFolderGroup 建组→重命名接力链）、
> refreshSmartFolderCount（26287 + 闭包 ayncsUpdateSmartFoldersCount——3 个一批
> requestAnimationFrame 分批计数）、菜单本体（资源库历史子菜单/emoji/color role 全保）。
> **闭环**：menu-popup 新增站点 9——真驱动单选分支：12 项标签 + 导出子菜单；fixture 增
> /api/v2/smartFolder/create（contain 谓词、string value——三试校准 rules 形状）。
> **门禁**：tsc EXIT:0；1c3 OK（255）；suite 47/47（commit 后记录）。**台账⑨自此清零。**
>
> **阶段 11 残余台账·终态**（b1-9am）：
> ① collect-window/js 保留（活数据面）；② ~~flatpickr 潜伏缺口~~ **已修**（b1-9z）；
> ③ ~~searchFilter 管线缺口~~ **已修**（b1-9ab）；③' ~~colorFilter/grayColorFilter~~
> **已修**（b1-9ad）；⑥ ~~empty-trash 主侧无监听~~ **已修**（b1-9ar：main 逐条删 +
> emptyTrash/openTrashContextMenu 族补移植 + 闭环测试）；⑦ ~~native-viewer 双通道~~
> **已修**（b1-9at：backend nativePreview 引擎（ai 真渲/psd 族诚实降级）+ main 双
> handler + window.ipcRenderer 供给 + 闭环测试）；⑧ ~~update-txt-item 主侧无监听~~
> **已修**（b1-9as：main 回发 + shim 直通/桥 + 闭环测试）；⑨ ~~expand 右键菜单族~~
> **已修**（b1-9ao：openFolderExpandContextMenu + toggle 家族 7 fns；
> openSmartFolderExpandContextMenu 实为 b1-9w 已就位、审计漏查）；~~openFolderContextMenu~~
> **已修**（b1-9ap，含 26 依赖 fns + checkOperationSafety2/refreshSubfolderList 两个悬空
> 供给补移植）；openSmartFolderContextMenu **已修**（b1-9aq，含 23 依赖 fns——**台账⑨
> 全清**）。
> ④ ~~C 项：Menu.popup 自动化 + 8 iframe viewer 接管~~ **已完成**（b1-9af…b1-9ak 六批 +
> b1-9ak 基建；pdf-viewer 判定免移植）；⑤ vendor 终删完成（本批）。
>
> **迁移收官总结**：b1-9ad…b1-9am 十提交——颜色筛选复活、通道收口（发送端 6 处 +
> 回程事件 + 闭环测试 ×2 新增 47 项套件）、8 iframe viewer 全数接管（exif/raw/native/gif/
> text-editor/font-viewer 六窗 React 化 + pdf 判定免移植 + texture-viewer 处置）、
> Menu.popup 基建、app.bundle.js（4.4MB）与 Angular 全家（angular.min/wMousetrap/
> contenteditable 等 10 项）退出工作树。**Angular1 运行时依赖自此归零**（index.html
> 保留的 jquery/jquery-ui/mousetrap/lodash/sweetalert2/tippy 等 vendor 供旧 DOM 胶水与
> React 侧共用，非 Angular）。遗留挂账 ⑥⑦⑧⑨ 见上——均为非阻断的通道监听/次级功能面。
>
> **⑥⑦⑧⑨ 挂账清算收官**（b1-9ao…b1-9at，2026-09-05/06）：⑨ 侧栏右键菜单族三批
> （b1-9ao/ap/aq，fns 196→255）→ ⑧ update-txt-item（b1-9as）→ ⑥ empty-trash（b1-9ar，
> 含 emptyTrash/emptyRestore/openTrashContextMenu 漏项补移植 255→258）→ ⑦ native-viewer
> （b1-9at，backend nativePreview 引擎 + window.ipcRenderer 供给 + TEMP_PATH 潜伏雷排
> 除）。**残余台账 ①–⑨ 自此全部关闭**；套件 47→50（每通道一个闭环测试），fns 表 258，
> 门禁 tsc EXIT:0 + 1c3 OK（258）+ suite 50/50 全绿。

> **b1-9r…b1-9x：阶段 11 b2/b3/b4 清算收官 + P2/P3（2026-09-05，7 提交系列 e5a8311→7a79016）**
>
> **b4（b1-9r）**：index.html head 12 条 link 逐消费方判定——angular-notify.min.css
> **判活保留**（React 通知层运行时注入 `.cg-notify-*` DOM，原预设「死文件」被推翻）、
> flatpickr 两条判活保留（**潜伏缺口登记**：FlatpickrInput 等 `window.FlatpickrInstance`，
> 库未加载且 UMD 不导出该类——智能文件夹日期规则输入失效；修法=加载库+桥+zh l10n，
> 修前 flatpicker CSS/JS 不入删除清单）；实删 nouislider.min.css + `<library-panel>` 死标记。
> scroll-to-top-sentinel 属性块判活保留（gridDirectives.ts:62 jQuery 消费）。
> **b3 批1（b1-9s）**：54 个零引用孤儿删除（双台账实锤：basename 全仓 grep +
> require/import/script-src 加载形态 grep 均 0 命中）。
> **b3 批2（b1-9t）**：background 死链子树 57 文件（background.html 无打开方 →
> background.js+thumbs 39+utils 8+tree.helper/ga4/ga/music-tempo/screen-capture+analyzer+
> angular-notify.min.js+ng-flatpickr.min.js）；thumbs→utils 依赖链随链清死，
> nativeThumb 仅被 thumbs 消费，electron nativeThumbnail 为无关同名 IPC。
> **b2（b1-9u）**：独立窗口旧文件 10 项（preview-window.js/preferences.js 已被 React
> 逐字承接仅剩溯源注释；progress/manage-device/registration 三死窗 + manage-device.js/
> registration.js/core.jsc/mailcheck/is.min.js）；**collect-window/js 判活保留**
> （React 化后自有 js/lib/api 数据面仍被消费——「collect 待核」关闭）。
> **P2（b1-9w）**：菜单点击路径审计——262 个 s.X 符号对照供给面，34 缺口（含 4 个
> 已移植 UI 活死按钮：inspector 标签复制/粘贴、removeFromFolder、setAsVideoThumbnail），
> 33 个 fns 补端口（162→195）+ bundleGlobals 4 顶层全局 + w.clipboard 修复。
> **P3（b1-9x）**：#sidebar 拖宽写回链 React 重实现（fns onSidebarResize 196 +
> SidebarResizable 接线），index.html:34 死属性摘除。
>
> **阶段 11 残余台账**（b1-9ad/ae 后更新）：① collect-window/js 保留（活数据面）；
> ② ~~flatpickr 潜伏缺口~~ **已修**（b1-9z）；③ ~~keyword watcher 维护字段~~ **已闭环**
> （fns["search"] 早已逐字赋值——b1-9w 审计假阳性；searchFilter 管线真缺口已修，b1-9ab）；
> ③' ~~s.colorFilter/s.grayColorFilter 同类无定义缺口~~ **已修**（b1-9ad，npm 依赖落地 +
> 三函数移植 + 正向断言）；⑥ 新登记：empty-trash/cancel-empty-trash 通道主侧无监听
> （DuplicateFamily 已走 ipc.send，main 无 ipcMain.on('empty-trash')——重复项回收站清空
> 链路悬空；duplicates:empty-trash handle 是另一条 invoke 面不背锅）；
> ④ P4 C 项待排期：native Menu.popup 自动化、8 iframe viewer 窗接管（接管时
> app.bundle.js 仍为逐字规范源——用户裁定保留至迁移收官）；⑤ vendor 全集以
> index.html 实际 script 表 + React import 面 + 活窗口加载面为准（angular.min/
> global.js/devices.js 等仍被活窗口消费，不动）。
> 累计删除 ~21,600 行死代码（54+57+10 文件）+ index.html 双轨清点。

> **b1-9x：P3 —— #sidebar 拖宽写回链 React 重实现（2026-09-05）**
>
> bundle 语义逐字复原：resizable 指令（70423：maxWidth 600 / minWidth 200 /
> handles 'e'）+ onSidebarResize（21138-21150：≥200 门 + containerSize.sidebar 写回 +
> `$$rebind::refreshContainSize` 广播 + updateSliderPosition + 500ms 去抖
> relayout/offsetScrollbar(30)/localStorage `eagle.containerSize.sidebar`）。
> 实现：fns 表补 `onSidebarResize`（195→196，1c3 契约同步）+ BodyBindings 新增
> SidebarResizable（jQuery-UI resizable C 模式接线，同 HoverShowSidebar 惯例：
> scopeApply → s.onSidebarResize(event, ui)，卸载时 resizable('destroy')，
> ui-resizable 幂等守卫），main.tsx 挂载。
> index.html:34 死属性摘除：`resizable="e" on-resize="…" ondragleave="…"` 为 Angular
> 指令面（b1 后死）；onDragLeaveSidebar 在 bundle 全文无定义——连 bundle 时代都是
> 死引用，一并清掉。containerSize.sidebar 种子（含 localStorage 覆盖）b1-9q 已在
> dataMachinery 10418-10425。
>
> **验证**：suite 45/45（`tests-tmp/react-suite-b4x.log`）+ tsc EXIT:0 +
> m1 `MAIN_WORKFLOW_SMOKE_OK`/`MAIN_UI_RESTART_OK`（`tests-tmp/m1-b4x.log`）。

> **b1-9w：P2 —— openItemContextMenu 点击路径审计 + 33 个缺口函数补端口（2026-09-05）**
>
> 审计方法：对 b1-9q 端口体（controllerFns 610-7757）提取全部 `s.X` 唯一符号 262 个，
> 逐一对照 fns 表 + 全 React 语料（core/global/store/components 全量）的赋值面。
> 结论：50 个 fns 直供、其余域内自管；**34 个真缺口**——其中 4 个 word-hit 实为
> **已移植 UI 的活死按钮**：inspectorActions 的 copyTags/pasteTags（检查器标签复制/粘贴）、
> Inspector 的 removeFromFolder、detailHooks 的 setAsVideoThumbnail——点击静默失败。
>
> 补端口 33 个 fns（162→195，1c3 契约同步；bundle 逐字 + 机械替换）：
> 复制组 copyTags(_.throttle)/pasteTags/copyAs{Properity,FolderPath,Thumbnail,Base64}（clipboard
> 新 const）；导出组 exportSelectedAs{Folder,Eaglepack,Format,ToCsv} + 级联 exportFolder/
> checkDiskSpace（bundle 26732 为 3 行空实现直通回调）；打开组 openWithOther/openInFinder
> （debounce 实例 __cc_* 惰性单例 + showFinderAlert → __lv_showFinderAlert 模块 var，
> localStorage 19064 语义）/openFilesWithDefault/openInPreviewWindow/duplicateItem；
> 缩略图组 regenerateThumbnail/replaceFile(124 行全体)/setCustomThumbnail{,FromClipboard}/
> resetCustomThumbnail/setAsVideoThumbnail(s.getVideoPlayer 走 c9d 域内版)/loadSubtitles
> （裸 item 语境=s.current）；文件夹组 removeFromFolder(30176 全体含 notify 撤销回调)/
> newFolderWidthSelection/addToLastUsedFolder/changeImagesBackground/getNext；
> 字体组 activateFonts/deactivateFonts（单数版 fns:346/2755 已在）+ changeFontDefaultLang/
> renameFontsWithFullName。
> bundleGlobals 补 4 个顶层全局供给：ayncsImagesGenerateThumbnail（49746，rAF 批次 300）、
> openInNewWindow（49584，open-preview-window IPC）、RecentFileManager（52307 全体，
> save 走 _throttle 4 参形）、getClipboardImage（2965；is.url 以协议前缀判定回落——
> is.min.js 已随死窗清算删除，url 字段消费面只读 files/image）。
> 顺带修复：w.clipboard 供给（eagleClasses.copyTags 的裸 clipboard 裸读此前无供给，
> inspector 标签复制会 ReferenceError）。
> 未移植（登记）：isContainAlphabet/searchRegexGroup/keyword_cn/keyword_tw 为 keyword
> watcher 维护字段（bundle 29616/32180），属 filterDomain 域内逻辑，随 keyword watcher
> 补全批次处理，非点击路径。
> IPC 保真说明：duplicate-file/open-with-dialog/regenerate-thumbnail/copy-thumbnails/
> set-custom-thumbnail/export-as-folder/export-images 通道 main 进程无 handler——bundle
> 时代后台窗消亡后即空放，逐字移植保真不新造 handler。
>
> **验证**：suite 45/45（`tests-tmp/react-suite-b4w.log`）+ tsc EXIT:0 +
> m1 `MAIN_WORKFLOW_SMOKE_OK`/`MAIN_UI_RESTART_OK`（`tests-tmp/m1-b4w.log`）。

> **b1-9u：阶段 11 b2 —— 独立窗口旧文件清算（2026-09-05）**
>
> 删除 10 项：js/preview-window.js（102KB，React preview-window/* 逐字承接，
> preview-window.html 已不加载仅剩溯源注释）、js/preferences.js（48KB，react/preferences/
> controller.ts 承接）、progress.html / manage-device.html / registration.html（三窗 electron
> 全仓零打开方；manage-device/registration 由 frontend/public/replaced/* 接管，
> vite.preview.config.mjs 拦截旧 URL 直接服务替代品，从不读旧文件）、
> js/manage-device.js / js/registration.js / js/core.jsc（唯一加载方 registration.html
> 的 bytenode 字节码）/ js/vendors/mailcheck.js（registration 专用，eagle-match-rules.js
> 为自带移植副本）/ js/vendors/is.min.js（仅两个死窗加载；dataMachinery 的 is.number
> 消费点 b1-9p 已替换）。
> **collect-window/js 判活保留**：collect-window/index.html 已 React 化（阶段9b-1，
> body 仅剩 React 宿主），但其自有 js/lib/api/*（window.eagle 数据面）+ vendors +
> models/collect-item.js 仍被加载消费——b2「collect 待核」关闭为保留。
> 台账复核排雷：main.cjs「preferences.js」为 preferences.json 正则点号误报；
> directives 的「progress.html」为 *-progress.html 子串误报（templateUrl 指向自身模板）。
>
> **验证**：suite 44/45（`tests-tmp/react-suite-b4u.log`，唯一失败
> main-ui-workflow-closed-loop = 既有偶发家族）→ 单跑复验 m1 全绿
> （`tests-tmp/m1-b4u-reverify.log`，MAIN_WORKFLOW_SMOKE_OK + MAIN_UI_RESTART_OK）；
> tsc EXIT:0。

> **b1-9h…b1-9p：全量门 22 项陈旧失败全部修复（2026-09-05，自动推进系列）**
>
> 按 b1-9g 台账逐根因修复、逐项验证、逐轮提交。**22 个陈旧失败文件全部转绿**，
> 每轮均带 m1 哨兵（多轮全绿、无回归）+ tsc EXIT:0。
>
> | 轮 | 内容 | 救活 |
> | --- | --- | --- |
> | b1-9h（12042aa） | `window.swal` 全局接盘（index.html 补 sweetalert2 vendor script，自带别名已核实） | 16 条（11a2 整绿；7d1a-mv/7d1b-em/7d6a-lm/7d6b-al 对、7d1c2-fsp、7d6c wc 节） |
> | b1-9i（030618a） | `w.angular.extend`→Object.assign ×2、`ang.isNumber`→typeof ×3（逐点替换，**不注入 window.angular**）；shims images-change 拦截段补 `image.changed` 回声（bundle 时代主进程回发的内存面唯一改名回写路径，发射方为零——仅修 extend 不通） | 4 条（stage6 rename、7d2 br、1m1-C/1m1-B） |
> | b1-9j（548bc93） | `coreState.pluginModule` 桥（bundle 20207 缺位） | 3 条（7d5a/stage5 整绿） |
> | b1-9k（aa3f90a） | 五小函数端口：cancelEmptyTrash/cancelRegenerateThumbnail（controllerFns）、toggleFilter（filterDomain）、selectTag（tagManagerDomain）、addToFolders+createFolder（controllerFns）；tagManagerDomain 的 `$filter/getTimeout` 死标识符修复（dataMachinery getTimeout 补导出）；fns 表 156→160，1c3 计数契约同步 | 17 条（7b/7d1a 全 10 条/7d1c2/7d6a/7d6b 整绿） |
> | b1-9l（93ee9bb） | seed 补种四件：platform（20066）/fixUtils（20513）/initPlugins 调用（20028）/selected 主 watcher（34214-34259 逐字 + setLastItem/selectItemsView，AnnotationPreview 按存在性守卫） | 6 条（stage6 整绿、7d6c 整绿、11a49 a8-body-attrs、1m1-E） |
> | b1-9m（c81ee53） | match-rules 补 matchStringMethod 前导块（8340-8368 提取切口）+ 取表取消永久缓存；artstation-download 接盘 | 2 条（1m1-A9、7d2 art-url，7d2 整绿） |
> | b1-9n（5cfab88） | machineryUpdateSelection 从被覆盖简版桩升级为 54678-54826 完整版逐字（30ms 防抖 inspector 字段派生 + sortTags；UPDATE_INSPECTOR 广播为 shim 保留桥）；seed 补 containerSize（21095，默认 240） | 4 条（7d3a 整绿、7d1b 整绿） |
> | b1-9o/p（本提交） | seed 再补五件：eagle（$rootScope.eagle 等价——字符串 watcher/toolbar 快照数据源）、containTags（20533）、page（21062——缺席时 slice(0,NaN) filtereds 恒空）、historySearchKeywords（21097——updateSuggestions 首行断链）、inspector.width=300；filterContent（32583）+ keyword watcher（33653）补端口；itemDomain/libraryDomain 的 raw 变更点失效 contentFilterCache ×3（bundle 隐式重建的 shim 等价）；BoxList 补 box 点击→s.select 委托（bundle ng-grid item 截停的等价）；A 类断言改写到 shim 世界（cz 族写后物化/自指拓扑/listenerCount 结果导向、1c2 单一世界契约、1m1-A 去 $parse 与截肢计数、stage-smoke 13 处 angular.element→$bodyScope）；scopeShim 补 watcher exp 元数据 + `$watchers` 接通真实数组 | 剩余全部（cz 族/1c2/1m1-A/1m1-D/a4-search 族/stage-smoke 整文件/box 选择链） |
>
> **修复过程中的方法论收获**：台账 B 类根因在修复中不断揭示下一层——「调用计数探针」
> （wrap search/filterContent/rebindRefresh 数调用次数）+ `window.onerror`/
> `unhandledrejection` 钩子是定位静默断链（$timeout/setTimeout 体抛错不进 console）的
> 高效组合；controller init seed 区间系统性缺种（platform/fixUtils/containTags/page/
> historySearchKeywords/eagle/inspector.width 共 7 处）是本轮最大的一类结构性发现——
> **任何「scope 字段读取抛 TypeError/静默 undefined」的新断链，先查 seed 区间**。
> 探针脚本 `tests/probe-filter-toggle.mjs`（禁提交）保留在盘可复用。
>
> **待办（不阻塞任何套件）**：#sidebar 的 resizable 拖拽写回链（index.html:34 的 Angular
> 指令 b1 后失效，containerSize.sidebar 种子已就位，缺 React 侧拖拽接线）。
>
> | b1-9q（本提交） | `openItemContextMenu` 大块移植（bundle 43452-44603 主体逐字 + 机械 $scope→s/$rootScope→s.$root）；依赖供给：bundleGlobals 补 4 个 bundle 顶层全局（removePlayingAudios+cleanupBoxHoverPreview/openWithApplicationPath/ayncsImagesGeneratePalette/ReverseImageSearch 类+eagle.reverseImageSearch 挂载）、controllerFns 补 URL_MODULE/ContextMenu 模块常量 + renameImages/enableImageNameEditable/getLibraryHistory link 级函数 + NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES 常量（18993）；fns 表 160→162，1c3 契约同步 | 3 条（7a 整文件转绿，**全量门 45/45 达成**） |
>
> **验证**：全量门整跑 **45/45**（b1-9q 后达成；44/45 记录见 `tests-tmp/react-suite-b49-final2.log`，
> 1c3 计数契约更新后单项验绿）；m1 多轮全绿；tsc EXIT:0；isolated 全绿（cpSync 补丁按规回退）。
>
> **b1-9q 教训**：大块移植的机械切片**必须核对首尾行语义**——首提把「赋值行
> `$scope.openItemContextMenu = async (...) => {`」一并算进主体，整段成了重赋值的定义体，
> 外层函数瞬时 resolve、无异常无广播（探针 `__oicmT` 轨迹 null 即铁证）；fns 表计数契约
> （1c3）每次扩表都要同步。

> **b1-9g：全量门 22 项陈旧失败的逐断言 triage 台账（2026-09-05，用户裁定先 triage）**
>
> 方法：4 路并行静态归因（逐冒烟读源码 + 对照 b1-9e/b1-9d 双态实跑日志 + 对照本文件「待办」清单），
> 合计约 60 条失败断言（部分文件 fatal 中止后还有休眠断言）**全部逐条归因，零新回归**。
> 结论：**A 类（契约过期，改断言）约 11 条 / B 类（真实功能缺口，补端口或接线）约 49 条**；
> B 类收敛为 **9 个根因**，多数 S 级（小时）；仅 1 项 M 级（filterContent 管线）。
> 22 个文件按此台账修复后**全部可转绿**。
>
> **B 类根因清单（按杠杆率排序；「救活」= 该根因修复后转绿的断言）**：
> 1. **`window.swal` 全局供给缺失**（S，撬动面最大）：b1 摘除 bundle 时把内联的
>    sweetalert2 一并带走，index.html:10 只留了 CSS，JS vendor
>    `src/app/js/vendors/sweetalert2/sweetalert2.all.min.js` 在磁盘但无 script 标签。
>    React 侧全部 `w.swal(...)` 消费点（ProgressDialogs 5 处 / ControllerModals / miscDomain
>    的 `if (!swal) return` 静默降级 / dataMachinery / eagleClasses）全部吞错降级。
>    修法：index.html 补一行 script（vendor 自带 `window.swal` 别名）。
>    救活：7d6a lm-swal-shown/lm-reload-app-ipc、7d6b al-swal-shown/al-multi-open-0-2、
>    7d6c wc-swal-shown/wc-open-0-2、11a2 a2-clean-swal/a2-clean-cleared（8 条），
>    外加 7d1a mv-swal-shown/mv-closed、7d1c2 fsp-swal-open 的 swal 半边。
> 2. **`w.angular.extend`/`ang.isNumber` 死调用**（S，⚠️ 必须逐点替换，**不得**注入
>    `window.angular`——b1-9e 已记录的雷区：全局 angular 会翻转 scopeBridge:14 等
>    「bundle 在世」探测点；最小垫片也须带 `!__eagleShim` 门）：
>    `itemDomain.ts:389/:361` 的 `angular.extend` → Object.assign 浅合并；
>    `libraryDomain.ts:925-937` 的 `ang.isNumber` → `typeof x === 'number'`。
>    救活：7d2 br-image-dataplane、1m1 m1-C-image-changed/m1-B-bg-state、
>    stage6 inspector-rename-applied（改名回写链）；兼扫 45 处死调用族的其它数据面。
> 3. **`pluginModule` 未桥进 coreState**（S）：bundleGlobals.ts:1656 已供给 `w.pluginModule`，
>    但无人写 `coreState.pluginModule`（bundle 20207 的 `$scope.pluginModule =`）。
>    一行桥（bundleGlobals 供给处补 `coreState.pluginModule = w.pluginModule`）。
>    救活：7d5a pp-open/pp-empty-state、stage5 detail-image-branch-rendered（3 条）。
> 4. **EagleController 小函数缺口（5 个端口，各自 S）**：
>    a. `cancelEmptyTrash`（bundle 33602-33608）→ 救活 7d6a et-cancel-closed/et-cancel-palette-resume；
>    b. `cancelRegenerateThumbnail`（bundle 34491-34494）→ 救活 7d6b ft-cancel-closed；
>    c. `toggleFilter`（bundle 30898-30908）→ 解除 stage-smoke 的 fatal 中止（其文件内还有
>       13 处休眠的 angular.element 断言需同步改写为 window.$bodyScope 新契约）；
>    d. `selectTag`（bundle 38870-38926）+ tagManagerDomain 补 `getFilter/getTimeout` 导入与
>       `w.$` 焦点降级 → 救活 7b tm-select-tag/tm-create-group-input；
>    e. `addToFolders`（bundle 43200-43212）+ body 级 `createFolder`（bundle 40538）→
>       救活 7d1a 全组数据面 + 7d1c2 fsp-created-dataplane/selected
>       （⚠️ 7d1a 的 atf-open 族 PASS 与「无广播方」静态推断矛盾，动手前补一份逐断言日志实跑证据）。
> 5. **启动序列接线缺口（3 处，各 S）**：boot 时 `eagle.inspector.initPlugins()`
>    （bundle 20028）→ 救活 stage6 inspector-sections-rendered/inspector-star-changed；
>    `coreState.platform = process.platform` 播种（bundle 20066）→ 救活 11a49 a8-body-attrs；
>    selectionViewDomain 补主 `$watchCollection('selected')` watcher（bundle 34214-34224，
>    现只有 darwin 分支注册过）→ 救活 1m1 m1-E-selected-watch。
> 6. **vendor 切片/加载缺口（2 处，各 S）**：`frontend/public/vendor/eagle-match-rules.js`
>    少切了 bundle 8340-8368（`matchStringMethod` 定义）→ 救活 1m1 m1-A9-smart-filter
>    （注意 dataMachinery 的 memoize 会永久缓存 undefined 表，需同步修）；
>    `src/app/js/artstation-download.js` 未加载（`Artstation.isValidUrl`）→ 救活 7d2 art-url-error-shown。
> 7. **inspector 选中派生缺 30ms 防抖 watch**（S-M）：bundle `$watchCollection('selected')+
>    30ms 防抖 → eagle.inspector.newTags` 在 shim 世界无等价物（Inspector.tsx 仅 mount 时跑一次
>    updateSelection）→ bindInspectorEvents 补挂 → 救活 7d3a 全组三条。
> 8. **`containerSize.sidebar` 种子 + resize 写回**（S-M）：bundle 21110-21150 的初始化与
>    resizable 回调未移植，`bodyState` watch 列表里有字段但源头无人写 → wp-left-offset 主修复 +
>    面板右缘随侧栏联动的真实功能。
> 9. **keyword → filterContent 管线未移植**（M，唯一 M 级）：filterContent 本体缺失
>    （scopeShim.ts:13 自认）；shim 字符串 watcher 经 evalPath 从 coreState 解析，`eagle`
>    无人写入 → `eagle.filter.filterRules...` watcher 全部抛 TypeError 永不触发。
>    短期可把该族 watcher 改函数型闭包（shim 支持），完整修复需移植 filterContent（bundle 32583 起）。
>    救活：11a49 a4-search-none-closed、1m1 m1-D-filter-watch-fires。
>
> **A 类断言改写清单（4 组，纯测试改动，约半天）**：
> - **cz 族**（cz1-bridged / cz1-accessor-persists / cz2-bridged-expanded / cz3-taken-over）：
>   「字段预收编」改为「写后物化」（roundtrip 已在且通过）；「$parent 原型链访问器」改为
>   `shim.$parent === shim && shim.$root === shim` + 写穿透持久；「截肢计数 ≥1」改为
>   `takenOver===true && 关键通道 ipc.listenerCount(ch)===1`（cz3 后 8 条已是此形态，可合并）。
> - **1c2-bundle-eagle-untouched**：bundle 摘除后 `window.eagle` 就是 coreEagle，双实例并存按设计
>   消失 → 改单一世界契约 `window.eagle === window.__eagleCoreEagle`。
> - **m1-A-domains-taken**（1m1-unified）：七个子门全是 bundle 在世工件（截肢计数、
>   `angular.element().injector()` 取 $parse、读 `$$watchers`）→ 改为五域 `takenOver===true` +
>   `listenerCount===1` + shim `$watchers` 函数型 filter watcher 存在性。
> - **a1-upload-position / a8-panel-position**（11a1/11a49）：测量基准 `b.containerSize.sidebar /
>   b.inspector.width` 在 shim 世界未物化 → 改按 `__eagleBodyState` store 快照断言，或先播种
>   `b.containerSize/eagle.inspector` 再按旧式断言（与 B-8 修法合流）。
>
> **修复顺序建议**：① swal 接盘（根因 1，一处修救 8-10 条）→ ② angular 死调用逐点替换
> （根因 2）+ pluginModule 桥（根因 3）→ ③ 五个小函数端口 + 三处启动接线（根因 4/5）→
> ④ 两个 vendor 修补（根因 6）+ inspector watch（根因 7）→ ⑤ A 类断言四组改写 →
> ⑥ filterContent 管线（根因 9，M）+ containerSize（根因 8）收尾。每步后逐文件单跑，
> 全部转绿后重开全量门整跑（预期 45/45）。
> 总估：B 类 9 根因合计约 2-4 个工作日；A 类改写约半天。


**另一处未端口（不阻塞任何套件，仅在缩略图加载失败时触发）**：缩略图修复链
`listImageError` / `tryToFixThumbnailError` / `fixThumbnail`（bundle 19537+）整条缺失，
而 `boxGridEngine.ts:96` 生成的 `onerror="listImageError(event)"` 仍裸引用 → 抛
`ReferenceError: listImageError is not defined`。

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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   差量应用（不碰 smoothZoom/controller 加的 zooming 等类）；ng-click=onDetailClick 由
>   effect 绑回；ng-show 全部转 style.display 等价（不摘节点）。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   React 渲染 .context-menu + .context-menu-overlay（context-menu.html / context-menu-items.html /
>   context-menu-emoji-items.html 逐字转写，含递归子菜单、搜索拼音过滤、sortable、emoji/色板 role）。
> - 开合通道零改动：ContextMenu.open/close → $rootScope 广播 CONTEXTMENU.OPEN/CLOSE；
>   autoPositionContextMenu 指令（16350-16393）与 onErrorSrc（15869）同步移植；
>   fuzzyMatch filter（19951）= fuzzy_match(label, keyword)——顺带修正 Toolbar 搜索提示的参数序。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   （762-810）删除，替换为 `#eagle-website-panel-host` / `#eagle-error-modal-host`；
>   React 组件 components/stage7/ControllerModals.tsx 逐字转写。
> - ErrorModal：OPEN_ERROR / CLEAN_ALL_ERROR 广播通道不变；错误列表保留生产方数组引用
>   （remove/retry 直接 splice，开启期 500ms 轮询同步——原版由 digest 驱动）；retryAll 三分支
>   （DOWNLOAD_ERROR → ipc 'upload-urls'、ADD_ERROR → body uploadFiles、EDIT_ERROR →
>   itemMappings 原地 extend + updateItemView/ayncsImagesChange）逐字；copyAll →
>   sendTo(backgroundWindowID,'copy-paths-to-clipboard')；cleanAll swal 确认。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   （angular.element("body").scope()），EDIT_ERROR 分支必须取 body scope 而非 $rootScope。
> - WebsitePanel：显示条件 viewMode=='community' + isUILoaded 经 sidebarState 快照；
>   left=containerSize.sidebar+1（快照 sidebarWidth 即该值）；webview 指令行为
>   （dom-ready 主题注入 / page-title-updated 标题+前进后退禁用态）逐字；
>   OPEN_URL_IN_PANEL → src 设置（community- 守卫）+ isOpenWebpagePanel。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   走独立 middleware 分支（injectPreviewScripts 的 shims + REACT_REFRESH_PREAMBLE +
>   `<script type="module" src="/src/app/react/preferences/entry.tsx">`）。注意：该页无
>   `<title>`，transformIndexHtml 钩子本就不生效（middleware 直出），此前无 shims 也无 React。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
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

> **9b-1 已验证并接管（2026-09-01）**：采集窗第一片——接线 + CollectController + 左列 +
> FolderSelectPanel（引擎/模板逐字）。
> - 勘察结论（9b 深勘察）：collect-window 是自包含 Angular app（CollectApp，自有 select-panel
>   1555+695+531 分叉、462 context-menu、83 library-switcher），**UI 级唯一回归门 =
>   screenshot-regression 的 collect 段**（.select-panel-item ≥5；且该工具在当前 Electron 的
>   浏览器级 CDP 上因 `Target.getTargets` "Not supported" 整体不可跑——stash 交替已证伪为
>   既有环境问题，与本片无关；collect 门槛由 react-stage9b1 冒烟同款断言覆盖）。数据面 =
>   页面自带 js/lib/api/*（window.eagle，fetch 硬编码 41595 → shims 重写至测试后端）——
>   静态壳原样保留 api lib + jquery/swal/chinese_convert/pinyinlite/tiny-pinyin +
>   models/collect-item.js（plain JS 全局类，补 window.CollectItem 挂载）；main.cjs 仅
>   get-collect-window-data handle（窗口由外部打开，本仓无 opener）。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   allowSingleColorPalette + entry 注入）；静态壳 = eagle api lib/vendors/CollectItem +
>   `#eagle-collect-react-host`（Angular/四指令/modules 全移除）；react/collect-window/
>   {controller,selectPanelEngine,folderPanel,shell,entry}。
> - controller：CollectController 逐字（getTheme/getThemeName/changeStar/removeTag/
>   openTagSelect(9b-2 stub)/focusFolderInput/initFolderSelect/save/filterCollectItem/loadData/
>   init 序列含 locales/{locale}.json + ipc invoke get-collect-window-data + getURLDimensions）；
>   订阅模型同 preview；测试契约 window.__eagleCollectController + __eagleCollectEntryReady；
>   registerFolderPanelOpener 取代 $rootScope 广播。
> - selectPanelEngine：String.prototype.score + cartesianProduct + SelectPanelSearchInput +
>   SelectPanel 基类逐字（定位用 controller.mouseState 的 mousemove 追踪；**$ 需直通 jQuery
>   工厂——collect 引擎是 `$(selector)` 单调用风格，写成 `() => window.jQuery` 拿到的是构造器
>   （7a 教训第三次）**；tab 停用/close() 空实现怪癖保留；panelI18n 守卫（原版裸 `i18n.__`
>   在采集窗未定义）。
> - FolderSelectPanel 类+模板逐字（guidelines/fuzzyMatch <b> 高亮/create 行/recent 排序三连/
>   collapse localStorage/isMultipleSelectMode footer）；vs-repeat 虚拟化 9b-2 接 useVsRepeat
>   （当前全量渲染，mock 数据量小）；openItemSubmenu/ContextMenu 守卫（原版 $bodyScope 在
>   采集窗未定义 = ReferenceError 怪癖）。
> - shims collect 分支改 React 版轮询（__eagleCollectEntryReady + folders 就绪 →
>   initFolderSelect()，行为等价原 isolateScope.listData 轮询）。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   `class CollectItem` 都是 classic 顶层词法绑定、模块作用域不可见 → 静态壳显式
>   window.preferences/window.CollectItem 挂载（同 9a 的 path/EagleConfig）。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   (2) 诊断探针经 addScriptToEvaluateOnNewDocument + consoleAPICalled 事件捕获才拿到真栈
>   （三层异常：isMac 调用形态 / $ 工厂 / Electron window.onerror 在 mock process 上的
>   listenerCount 二次报错）；(3) CDP /json/new 与 browser-ws Target.* 在本 Electron 均不可用
>   → 单页冒烟直接导航主窗口 target。
> - 闭环：react-stage9b1-smoke 14/14（init/folders 就绪/shell open/缩略图（shims pathToFileURL
>   → /file/<encoded>）/**面板 ≥5 items（beforeElectron 建 4 资料夹满足门槛）**/星等置与删/
>   标签渲染与移除/标题 contenteditable 回写/save 数据面（base64 src + 字段透传 + window.close）/
>   搜索过滤 + create 行/清空恢复/截图）。回归门 preview-delivery 复跑绿；全量 suite 34 项
>   （runner 增 9b1）仅 7a/main-ui-workflow 各一次既有偶发（单跑即绿）+ api-smoke 13/13；
>   tsc 零错。
> - 9b-2 待办：TagSelectPanel（1555 行分叉）+ ContextMenu（462）+ library-switcher +
>   vs-repeat 虚拟化 + tag select 面板真实开合。

> **9b-2b 已验证并接管（2026-09-01）**：TagSelectPanel（1555 行分叉引擎 + 205 行模板逐字）+
> openTagSelect 接通——采集窗三面板全数 React 化。
> - tagPanelEngine.ts：TagSelectPanelItem + CollectTagSelectPanel extends SelectPanel（1469 行
>   逐字：initRawData 补 selectedTags 缺失项/updateTagsState（suggestions 注释块 = collect 版
>   無此功能）/updateItemList 星标→最近→推荐→群组排序 + 群组计数 + 群组分类/filterByKeyword
>   拼音 + groupName 包含 + Set 去重/sortByKeywordSimilarity Levenshtein/网格四向 select*（跨
>   折叠群组）/onTabKey 侧栏群组循环/openItem CREATE 建标 + TAG 翻转 + 搜索清空（ctrl 豁免）/
>   createdTags 去重反转 200 上限 + recent 序/parseTags 中文分隔符/toggle 系 + localStorage/
>   setColumnSize/setListMode/openSettings/closeSettings）。分叉点逐字保留：suggestions 注释块
>   不启用、render/scrollTop 的 trigger("render")（vs-grid 事件，无监听 no-op）、hoverItem 签名
>   (event,item) + mousemove 距离阈值、onPaste 裸 `clipboard`（未定义怪癖）、selectUp/Down 的
>   columns attr 在无 vs-grid 时 NaN → 跨群组分支（9b-2c 接 vs-grid 后走同列分支）。
> - 原版 updateItemList 内 angular.injector $filter('i18n') → ct()（locales 词表，已由
>   controller 加载）。angular.copy → deepCopy（JSON 法）。
> - tagPanel.tsx 宿主：模板 205 行逐字（panel-header 搜索/隐藏侧栏/设置、panel-sidebar
>   ALL/群组/UNFILED + 计数、panel-list 群组标签 + create 行 + fuzzyMatch 高亮 + 计数、footer
>   快捷键（**ng-hide 的 `selected.length` 未定义怪癖 = 抛错后元素保持可见，逐字**）、setting-panel
>   布局/列宽/三开关）；initDraggable/initResizable（jQuery UI，stop 存
>   eagle.tagsPopup.height/width）；opener 时序 init(10ms)/open(0ms)——**open 的
>   preventCollision 参数被原 TagSelectPanel.open() 无参覆写静默丢弃（怪癖逐字）**。
> - controller.openTagSelect 真实现（collect.js 169-201 逐字）：preventCollisionWithElement 查
>   div.fake-thumbnail 恒 null（模板类名实为 .thumbnail，原版怪癖）；tagManager 入参
>   allTags/groups/recent/suggestions/starred 由 scope.tags + getTagAll() 备好；onChanged 回写
>   collectItem.tags + tagsMap；onClosed → focusFolderInput。
> - 教训：(1) **根容器 ref 漏挂二次复发**（9b-2a 的 contextMenu、9b-2b 的 tagPanel 同款——
>   JSX 根元素不挂 ref 引擎就瞎，已列入转写检查单）；(2) **容器元素缺失使 $panel 选择器空集**
>   （模板根 select-panel 必须包在 `<tag-select-panel>` 容器内，panelSelector 才能匹配——
>   与原 directive 的 templateUrl replace:false 结构对齐）；(3) open(0ms)/init(10ms) 时序 +
>   SelectPanel esc 的 escKeydown 完整 keydown+keyup 对——冒烟两处时序修正；(4) 断言阈值必须
>   按页面实际数据流校准（removeTag 后 selectedTags 2 项）。
> - 闭环：collect 冒烟 27 断言全绿（新增：面板开合（open class + 搜索框）/群组渲染
>   （group-label + items ≥2）/checked 选中态/某项 toggle 后 close→onChanged→collectItem.tags
>   同步/reopen/搜索 NewTag → create 行/enter 建标（引擎 selectedTags 含 NewTag）/esc→onChanged
>   →collectItem.tags 含 NewTag）。回归门 preview-delivery 绿；suite 34 项 ALL GREEN（零偶发）；
>   api-smoke 13/13；tsc 零错。
> - 9b-2c 待办：folder 面板 vs-repeat 虚拟化（useVsRepeat，columns attr 由 vs-grid 设置后
>   tag 面板键盘四向走同列分支）+ vs-auto-scroll。

> **9b-2 勘察（2026-09-01；未转写，下一片按此执行）**：
> - **TagSelectPanel（tag-select-panel.js 1555 + 模板 205）**：全局类（非 isolate scope），
>   与 stage7 已移植引擎（react/components/stage7/selectPanelEngine.ts）方法面几乎同族
>   （updateTagsState/updateItemList/filterByGroup/filterByKeyword/sortByKeywordSimilarity/
>   select* 网格导航/scrollToGroup/toggle 系/getCallbackResult/parseTags/decideLayoutMode/
>   createdTags/openSettings/closeSettings/setColumnSize/setListMode 全同名）；**collect 分叉
>   多出 initDraggable/initResizable/reset/render（自管 DOM 渲染！非 React 快照式）**，少
>   changeTab/toggleExpand/openItemSubmenu/openAppContextMenu（主窗口专属）。转写策略建议：
>   以 collect 源逐字为准新建 collect 窗专属引擎类（不可直接复用 stage7 类——分叉差异未逐行
>   核对，render 自管 DOM 与 React 快照冲突）；面板宿主组件 + collect 模板 205 行逐字；
>   openTagSelect 的 tagManager 入参（allTags/groups/recent/suggestions/starred）已由
>   controller.getTagAll() 备好。jQuery UI draggable/resizable（initDraggable/initResizable）
>   可参照 stage7 同款等价。swal 建标路径（onPaste 批量）保留 window.swal。
> - **ContextMenu（context-menu.js 462 + context-menu.html 30 + items 147）**：同为 contextMenu
>   模块分叉（DOM 菜单非 native），ContextMenu.open 全局静态 + CONTEXTMENU.OPEN 广播等价；
>   与 stage7a ContextMenuPanel 的差异需逐行核对后决定复用或 fork；消费点 = folder 行右键
>   （openItemSubmenu 现为守卫 no-op）+ library-switcher 菜单。注意 9a-3 结论：native Menu
>   popup 不可自动化——collect 的 context-menu 是 DOM 菜单，可冒烟。
> - **library-switcher（83 行 + library-switcher.html）**：click → ContextMenu.open（showSearch、
>   library history 项含 icon=`/api/library/icon?libraryPath=` + fallbackImage + disabled/checked）
>   → eagle.library.switchPromise → onLibrarySwitching/Switched/SwitchedClosed 回调链（controller
>   已实现三回调）；updateLibrary 读 eagle.library.info()。转写需 ContextMenu 先行。
> - **vs-repeat 虚拟化**：folder 面板列表当前全量渲染；接 stage7 useVsRepeat（vs-excess 30/
>   vs-repeat 26/vs-size=size）+ vs-auto-scroll（index 跟随）；mock 数据量小，冒烟断言建议
>   断 before/after spacer 存在 + 滚动窗口切片。
> - shims collect 分支已就绪（React marker 轮询），无需再改；数据面契约同 9b-1。

> **9b-2a 已验证并接管（2026-09-01）**：ContextMenu（462+30+147 逐字）+ library-switcher（83+模板）
> + folder 行右键 openItemSubmenu 接通。
> - contextMenu.tsx：ContextMenu.open/close 全局静态（模块级信号 + listeners 取代 $rootScope
>   广播）；引擎（link 体逐字：init visible 过滤/treeUtil.walk 子菜单过滤/selectUp·Down 可选跳过/
>   hoverItem 开子菜单/openItem keepOpen·checked 翻转/toggleItem pinned/openMore/搜索
>   getSearchResultMenu 两层过滤 + separator/label 注入/无搜索菜单的字母 keyBuffer 定位/空格开启/
>   enterKeydown IMU 模式/moveToCursorPosition 重试定位 + .context-menu-items maxHeight）；
>   模板逐字（sortable/非 sortable 双分支、separator/label/color 色板/toggle pinned 双按钮/
>   drag-helper/accelerator/more/递归 submenu + autoPositionContextMenu 定位指令等价 +
>   resize.submenu）；ui-sortable 分支经 jQuery UI sortable（update → onSorted）。
> - 测试契约：window.__eagleCollectContextMenu（bindElement 后）/ __eagleCollectContextMenuEngine
>   （创建期）——**探针定位「菜单不弹」全靠引擎句柄**：根因是 root div 漏挂 ref={rootRef} →
>   bindElement 早退 → $contextMenuElement 永远 null（jQuery addClass('open') 全部静默 no-op，
>   而 items 渲染与 overlay 正常——「部分活着」假象）；次因 = init 改引擎状态后未触发渲染
>   （原版靠 digest）→ init 尾补 forceUpdate。
> - openItemSubmenu 真实现（folder-select-panel.js 423-482 逐字）：recent 行 = removeHistory 菜单、
>   普通行 = addChilder/addSibling 双项（panelI18n 键回退 = 原版裸 `i18n.__` 未定义行为等价；
>   `$bodyScope.createFolder/removeRecentFolder` 在采集窗本就未定义（原版 ReferenceError 怪癖
>   逐字保留，React 事件Handler抛错仅记录不卸载）。
> - library-switcher：updateLibrary（eagle.library.info）+ click → ContextMenu.open（showSearch、
>   history 项 icon=/api/library/icon + fallbackImage + disabled/checked）→ switchPromise →
>   onLibrarySwitching/reloadData/SwitchedClosed 回调链（controller 新导出 reloadData）。
> - 闭环：collect 冒烟（react-stage9b1 文件，累积 20 断言）全绿——新增右键菜单开合（2 项标签为
>   i18n 键名 = panelI18n 回退）、overlay 关闭、switcher 名称/菜单开合（2 项 history）/Esc 关闭；
>   9b-1 的 14 项全数仍绿。回归门 preview-delivery 绿；suite 34 项仅 main-ui-workflow 一次既有
>   偶发（单跑即绿）；api-smoke 13/13；tsc 零错。

> **9b-2c 已验证并接管（2026-09-01）**：folder 面板 vs-repeat 虚拟化（9b 末片）——collect-window
> 功能面全数 React 化完成。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   vs-excess=30 / vs-repeat=26 / vs-size=size → `{ elementSize: 26, excess: 30 }`）+ `useVsAutoScroll`
>   （index = listData.currentIndex，scroll-container = select-panel-list 自身加 overflowY:auto）；
>   列表渲染改 `vr.innerItems` 切片 + before/after 占位 div（angular-vs-repeat 插入首/尾 spacer
>   等价，同 stage7 结构）；items 引用随 updateItemList 重建 → useMemo 正常重算，另以
>   mounted/renderTick 组成 version 入参覆盖首挂载与交互后窗口刷新。
> - FolderSelectPanels.tsx（stage7 共享钩子两处）：(1) 导出 useVsAutoScroll（原模块私有，collect
>   复用）；(2) useVsRepeat 的内部 scroll→bump tick 纳入 useMemo deps——修复「滚动触发重渲染但
>   deps 无变化 → 可视窗口不重算」。主窗口语义不变论证：7d 消费方 items 引用每次渲染重建，
>   原 deps 下滚动虽不重算、下次数据刷新必然重算（且 mock 数据量小未暴露），补 tick 后窗口
>   实时跟随滚动、数据面/滚动行为无任何变化；7d1c2（共享钩子消费方）冒烟复跑绿作证。
> - 冒烟（react-stage9b1 累积 29 断言）：beforeElectron 建 60 个 Bulk-XX 资料夹 → 面板 65 项
>   （61 folder + 4 默认）> 视口 + excess；pw4d-vr-sliced = total>50 && rendered<total &&
>   before/after spacer ≥1（切片生效）；pw4d-vr-scroll-bottom = list.scrollTop=scrollHeight +
>   scroll 事件后 Bulk-60 进入渲染窗口（虚拟化滚动正确）。
> - tag 面板 vs-grid-repeat（分组网格虚拟化）**不在本片**（9b-2 勘察范围即 folder 面板列表）：
>   tag 面板当前全量渲染（功能等价、无虚拟化），其 vsGridState/columns attr 依赖的键盘四向
>   跨群组分支已在 9b-2b 按 NaN 路径逐字保留；如需网格虚拟化另开一片。
> - 闭环：collect 冒烟 29/29；回归门 7d1c2 + preview-delivery 绿；api-smoke 13/13；tsc 零错；
>   全量 suite 35 项仅 7d6a 一次既有偶发（ei-cancel-closed，单跑复绿）。
> - **9b 全片完成**：采集窗三面板（folder/tag）+ 左列 + ContextMenu + library-switcher +
>   save 闭环全数 React 接管；剩余 = 阶段11（index.html 去 angular、旧 collect-window ng-*
>   模板/控制器删除、native Menu popup 自动化方案）。

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
| collect-window | 独立页面 | `src/app/collect-window/*` | 已验证（9b-1/9b-2a/9b-2b/9b-2c 全片接管：接线+CollectController+左列+FolderSelectPanel+ContextMenu+library-switcher+TagSelectPanel+openTagSelect+folder 面板 vs-repeat 虚拟化，collect 冒烟 29 断言；tag 面板 vs-grid 网格虚拟化未接（全量渲染等价）；旧文件随阶段11 清理） |
| registration | 安全替代页 | `frontend/public/replaced/registration.html` | 已删旧实现 |
| manage-device | 安全替代页 | `frontend/public/replaced/manage-device.html` | 已删旧实现 |
| progress.html | 进度窗口 | `src/app/progress.html` | 无运行时入口，定性不移植（9c 勘察） |
| thumbnail.html | 缩略图窗口 | `src/app/thumbnail.html` | 空白离屏插件宿主，无 UI 可移植（9c 勘察） |
| manage-device.js / registration.js（原版）| 源码镜像 | `src/app/js/manage-device.js` / `src/app/js/registration.js` | 待办 |

---

## 10. 快捷键（shortcut-manager）

> **10 勘察 + 核对（2026-09-01；四项全部已由前序阶段事实接管，本片为核对定性，无新转写）**：
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   init/electronToMousetrap/registerShortcut/getConflicts/validateShortcut/formatForDisplay/
>   migrateToPlatformSpecific），与 mousetrap.min.js 同属共享脚本层。React 直用已验证：
>   preferences controller（react/preferences/controller.ts:980 init(preferences,
>   keybindGroups)，阶段8）+ preview-window controller（2359-2367 electronToMousetrap +
>   player.*/edit.*/view.* 全表，9a-3 实测 alwaysOnTop/grayscale 等键）。文件被
>   index.html / preferences.html / preview-window.html 三壳包含，main window 旧
>   media-element 系指令（media/mpv/audio）仍消费 → **保留**，阶段11 随双轨清点定去留。
> - **shortcutInput directive（js/directives/shortcut-input.js 352 行）**：React 等价
>   `ShortcutInput`（react/preferences/panels.tsx:1048 逐字，阶段8 移植——keydown 捕获
>   修饰键前缀 + 键值映射、冲突不写模型 + 1.5s 提示、updateStatus 三态 class、focus 显
>   原值/blur 格式化），panels8e 快捷键面板 + panels.tsx 1377/1410 消费；**8e 冒烟行为
>   验证**（捕获 → `keybinds['global.capture.window'] === 'Ctrl + Alt + W'` +
>   shortcutsEnable 关 → disabled）。preferences.html 旧脚本已随 8e-2 删除；主窗口
>   app.bundle 内副本无模板消费（主窗口 FilterItems 的 `.shortcut-input` 只是 CSS 类名，
>   非 directive）。
> - **filters shortcuts / shortcutsWrapper（bundle 69574/69585）**：react/app/filters.ts
>   逐字（122/143，唯一差异 `process.platform` → `window.process?.platform`——React 上下文
>   等价）+ 活跃消费 15+ 处（FilterItems2 各筛选器 tippy-content、Toolbar 置顶提示等）。
> - **wMousetrap（mgo-mousetrap，bundle 16683-16723 = js/modules/wMousetrap.js 同源）**：
>   $watch 属性对象 → Mousetrap.bind + throttle(50)/$evalAsync + $destroy 解绑。全仓
>   模板消费方仅 font-viewer.html / text-editor.html（preferences.html 的已随 8e-2 删除）；
>   **主窗口/预览/采集零消费方**——React 面板的快捷键均经自有 Mousetrap 直绑 hooks
>   （hooks.ts/Sidebar/QuickSearchModal/detailHooks 等）。directive 本体随主窗口 bundle
>   与 modules/wMousetrap.js 文件存活，阶段11 清理时随消费方一并处理。
> - **附赠清点（阶段9 窗口清单遗漏）**：preview-window 以 iframe 内嵌的独立查看器窗口
>   共 8 个——exif/gif/model/native/pdf/raw-viewer + font-viewer/text-editor
>   （react/preview-window/shell.tsx 447/774/780/786 + controller previewURL 分支），
>   均为旧实现原样服务中（shims.js 2986+ 有 mock 分支），PROGRESS 此前仅有
>   preview/collect/registration/manage-device/progress/thumbnail 六项；另有
>   texture-viewer = texture2png.js 的隐藏离屏转换 iframe（非 UI 窗口，同 thumbnail
>   性质）。**列为阶段11 后窗口接管待办**（font/text-editor 同时是 wMousetrap 唯一
>   存活消费方）。

| 名称 | 类型 | 规范来源行号 | 状态 |
| --- | --- | --- | --- |
| shortcut-manager.js | 服务（window 单例，非 Angular） | `src/app/js/services/shortcut-manager.js` (296 行) | 已验证保留（React preferences/preview 直用 + 8e/9a3 冒烟；main window 旧指令仍消费，阶段11 定去留） |
| shortcutInput | directive（独立模块）| 64490-64843 | 已由阶段8 接管（panels.tsx ShortcutInput 逐字 + 8e 冒烟行为验证；preferences.html 旧脚本已删） |
| filters shortcuts / shortcutsWrapper | filter | 69574 / 69585 | 已接管（react/app/filters.ts 逐字 + 15+ 活跃消费点） |
| wMousetrap | directive（独立模块 mgo-mousetrap）| 16683-16723 | 迁移面零消费方（React 经自有 Mousetrap hooks）；存活消费方 = font-viewer/text-editor 窗口（旧实现，随窗口待办处理） |

---

## 11. 清理双轨 CSS + 移除 angular.min.js

> **11 勘察 + 清理清单（2026-09-01；清单先行，动手前过目）**：
> 前提修正：主窗口 index.html（541 行）仍是**完整 Angular 应用**（ng-app="EagleApp" +
> RootController + EagleController 34,043 行 = bundle 20197-54236），React 为 portal 注入
> 共存。阶段11 的「移除 angular」被主窗口残留 Angular 块门控——7d-7 勘察已定性这些块被
> bundle jQuery 直控（双轨风险，过渡期禁止单独接管），必须随 bundle 逻辑重写同步进行。
> 清单如下：
>
> **A. 主窗口残留 Angular UI 块（11-pre 移植系列 = b1 删除前置）**：
> - a1 upload-queue-progress + saving-progress-bar（index.html 88-110；bundle
>   30500/30791/34539 .percentage/.current 直写 + 23349 background-state 处理器）——
>   随上传队列/后台保存状态逻辑重写（React 侧 uploadQueue 状态源待落点）
> - a2 toast-alert 三块（errorList 计数 + localhostError + libraryPathPermissionError，
>   index.html 118-136）——纯展示 + openErrorModal/clean 类动作
> - a3 lock-screen 双块（folder 密码 196-213 + app 锁屏 466-486；bundle 29026 起
>   focus/val 直控 + TouchID + unlockPassword/Keyup/Keydown）
> - a4 空状态 drop-areas 六种（all/random/folder/unfiled/untagged/trash/search，
>   index.html 171-267）+ list-panel scroll-to-top（150；**sidebar 版已有 React 等价
>   Sidebar.tsx:821，勿重复**）+ body 级 application-menu-btn（70；sidebar/SmallPanels
>   已有两处等价渲染，先核消 再删模板位）+ hover-show-sidebar（77，ng-hover-intent）
> - a5 sub-folder-list（index.html 273-316：ng-repeat + ui-sortable 拖拽 + 选择/双开/
>   右键/改名 editable/锁定/显示子夹内容开关——stage7 FolderSelectPanels 与 7c 系列
>   有可参照等价）
> - a6 list-layout-header（318-347：ListLayout 八列列头 + 排序点击/方向图标）
> - a7 bundle jQuery 直控容器四块：annotation-preview-container（52089 起
>   AnnotationPreview 类）/ hover-preview-container（51696）/ tag-manager-drag-badge
>   （53707）/ colors-picker（32509 + 68199）——类整体重写为 React 等价
> - a8 body 绑定层（= 阶段1 收尾项）：body ng-class 40+ 状态类 / ng-href app-style 主题
>   css / theme/platform attrs / detail-mode wrapper（368，ng-show isDetailMode + 左右
>   定位 style + dblclick/mousedown）/ RootController isLoading 菜单按钮语义 → React
>   body-state hook + 静态壳 body class 等价
> - a9 ng-right-click 4 处等零散残留（openFileListContextMenu/openSubFolderContextMenu/
>   openListPropContextMenu 随 a5/a6 归属）
>
> **B. 删除序列（A 全部完成 + 全量回归绿后执行，删除前逐项过目）**：
> - b1 index.html → 静态壳：ng-app/ng-controller/ng-cloak/114 处 ng-* 全清 +
>   angular*.js + app.bundle.js 引用移除 + angular-notify.css 移除；body class 改由
>   a8 React hook 维护
> - b2 独立窗口旧文件删除（仅已验证面）：js/preview-window.js（102KB）、
>   collect-window/js/*（~15k 行）+ collect-window/index.html 残余、js/preferences.js
>   等——各自静态壳已不引用（preview/preferences 已净；collect 待核）
> - b3 主窗口 js/ 源码树清算：bundle 失去引用后，controllers/services/directives/
>   filters 源码按消费方清点删除；**保留 vendors 与共享脚本**（jquery 系/mousetrap/
>   tippy/lodash/shortcut-manager/lazy-load-manager/colorpicker/eagle-api 等——以 b1 后
>   index.html 实际 script 清单 + React import 面为准逐一核对）
> - b4 双轨 CSS 清点（angular-notify.css、flatpickr/nouislider/videojs/colorpicker 等
>   仅旧 UI 消费的样式随消费方判定）
>
> **C. 非删除事项（并行另定）**：native Menu.popup 自动化方案（9a-3 遗留，CDP 不可及）；
>   8 个 iframe viewer 窗口接管（font/text-editor 含 wMousetrap 唯一存活消费方）——
>   阶段11 后独立阶段。
>
> 执行序：**11-pre a1→a9 逐片**（每片固定节奏：转写→tsc 零错→冒烟→回归门→PROGRESS→
> commit）→ b1 → 全量回归 → b2/b3/b4 → 阶段11 收尾（阶段0 的「index.html 移除 angular
> 引用」待办同销）。

> **11-pre a1 已验证并接管（2026-09-01）**：upload-queue-progress + saving-progress-bar
> （index.html 88-110 两块，7d-7 定性的 bundle jQuery 直控块）React 接管，旧模板位删除。
> - store/uploadState.ts：queueLength/finishCount/progress/timeLeft 走 startScopeSync
>   scope 快照（bundle 的 uploadFiles/'file-uploaded'/cancelAllTasks/watchCollection 完成路径
>   继续维护数据，digest 驱动同步——与原模板 ng-show/ng-class 绑定同源同语义）；
>   savingOpen/savingMessage 走 'background-state' ipc（bundle 23386-23396 的
>   metadataQueueLength>3 分支等价转写，i18n progress.savingFiles.msg + number0 千分位；
>   palette/download 计数与 heartbeat 留在 bundle）。**关键坑：bundle 22734 在
>   'app-status-loading'（库加载）处理器里 removeAllListeners('background-state') 清场——
>   React 监听必须自愈（监听 app-status-loading + setTimeout(0) 重挂，重挂前
>   removeListener/off 防累积），否则首库加载后保存条永久失聪**（冒烟首跑抓到：探针证明
>   处理器已注册但 emit 不达，监听表里只剩 bundle 自己的）。
> - components/shell/ProgressBars.tsx：SavingProgressBar（88-94 逐字）+
>   UploadQueueProgressBar（96-110 逐字：progressbar 双 .current 分支（多文件
>   finish/queue%、单文件 progress%）、message i18n（progress.uppload.addingImages typo
>   逐字）+ counter percentage + remain second2time、cancel → callScope('cancelAllTasks')）。
>   位置等价：saving 条原位 portal 进 #list-content-panel 内新宿主
>   #eagle-progress-bars-host（absolute left:50% 定位继承面板，viewMode=community 隐藏面板
>   时同隐——原版同行为）；upload 条 position:fixed + left/right 内联 =
>   sidebarState.sidebarWidth+1 / inspectorState.width+1（复用既有镜像）+
>   isDetailMode display:none（ng-hide 等价）。**组件不带原 id**——bundle 的
>   $("#upload-queue-progress"/"#saving-progress-bar") 直控空集 no-op，UI 单一归属。
> - 测试契约：window.__eagleUploadState（bindUploadSync 内，同 __eagleReactStore 先例）。
> - 闭环：新冒烟 tests/react-stage11a1-smoke.mjs 13/13——宿主在面板内/旧 id 消失 + React
>   渲染/saving 开关与文案计数/upload 开闭 + percentage + left/right 内联（运行时读
>   containerSize/inspector 对账）/finish 半程 50%/单文件 42%/ETA 1:02:05/ng-hide 复位/
>   cancel 清队列关条/截图。回归门：tsc 零错；suite 36 项（runner 增 11a1）35 绿 +
>   main-ui-workflow 一次既有偶发（multi inspector persistence timeout，单跑复跑全绿，
>   含 restart 检查）；api-smoke 13/13。
> - 教训：(1) bundle 对共享 ipc 通道的 removeAllListeners 是隐藏杀手——React 新增通道
>   监听前必须全 bundle grep 该通道的清理点（22734 即此例）；(2) 探针法再立功：监听表
>   公开（this.listeners Map）+ 逐个 dump 函数源，直接定位「注册了但不在表里」。

> **11-pre a2 已验证并接管（2026-09-01）**：toast-alert 三块（index.html 96-121——失败重试
> 提示 / 本地服务器无法访问警告 / 資源庫寫入權限提示），旧模板位删除。
> - store/toastState.ts：errorCount/localhostError/libraryPathPermissionError 全走
>   startScopeSync scope 快照（bundle 写入点：30414 'image-processing-error' push、22659
>   'extension-server-init-failed'、23451 $.ajax localhost:41593 探测、23461
>   ACCESS.checkALCs——均 scope 写入 + $evalAsync，digest 驱动同步，无 jQuery 直控）。
> - components/shell/ToastAlerts.tsx：三块逐字（ng-show → style display 切换、ng-if → 条件
>   渲染；两条警告 message 原版 ng-bind-html（i18n 文案含 <a> 链接）→ dangerouslySetInnerHTML；
>   openErrorModal/cleanAllError/cleanLocalhostError/cleanLibraryPathPermissionError 均
>   callScope——cleanAllError 的 stopPropagation 经 React 合成事件保持不冒泡开弹窗语义）。
>   位置等价：原位 portal 进 #eagle-toast-alerts-host（.toast-alert absolute 定位继承
>   #list-content-panel）。OPEN_ERROR/CLEAN_ALL_ERROR 广播由既有 React ErrorModal（7c）
>   消费，通道零改动。
> - 闭环：新冒烟 tests/react-stage11a2-smoke.mjs 11/11——宿主在面板内/初始空/error toast
>   1→2 项文案分支/点击主体开 React ErrorModal/clean-btn → CLEAN_ALL_ERROR → **swal 确认框
>   （.swal2-container .swal2-confirm——本仓 swal2 构建无 .swal2-popup 类，选择器随 7d1a
>   惯例）→ 确认后清空引用数组（then 内 body.$evalAsync 驱动 digest）→ toast 隐藏 + 弹窗
>   关闭**/localhost 与 library-permission 两警告显示（message 含 <a>）+ clean 隐藏/截图
>   （timeout WARN 既有）。tsc 零错；suite 37 项（runner 增 11a2）36 绿 + 7d5b 一次既有
>   偶发（单跑复绿）。
> - 教训：冒烟断言前先核对既有闭环的真实交互流——cleanAll 是 swal 二次确认而非立即清空
>   （首版断言按「即时清空」写，探针（spy=1/listLen=2）定位后改为跟随 swal 流程）。

> **11-pre a3 已验证并接管（2026-09-01）**：lock-screen 双块（index.html 156-170 文件夹
> 密码锁 + 424-444 应用锁屏），旧模板位删除。
> - **C 模式首次规模化应用（同 background-state-spinner 先例）**：React 渲染 DOM 保留原 id
>   （#lock-password-input / #app-lock-password-input），bundle 的校验/解锁数据流原样保留——
>   unlockPasswordKeyup / unlockAppPasswordKeyup（$timeout 校验 + atob + license code 分支 +
>   calculateImageBinding/reload 解锁流 + initMenu）/ focusUnlockPassword /
>   focusAppUnlockPassword（blur 重聚焦循环）/ unlockFolderWithTouchID / unlockWithTouchID
>   / unlockAppPasswordKeydown 全部经 callScope 调用；其内部 jQuery（shake addClass、
>   focus、blur loop、val 读写、off）继续作用于 React 节点。unlockPassword ng-model 等价 =
>   input onInput 直写 scope.unlockPassword；select-all → onFocus select()。
> - store/lockState.ts：isAppLocked（$root）/folderLocked/folderPasswordTips 走 scope 快照；
>   canUseTouchID = bundle 29001-29009 逐字自算（darwin + systemPreferences.canPromptTouchID，
>   win32 恒 false）+ 'preferences-updated' 重算。测试契约 window.__eagleLockState。
> - React 侧补齐两件 Angular 指令等价：always-focus（bundle 69688，100ms 轮询聚焦，补
>   unmount 清理）+ 应用锁屏挂载时兜底聚焦（bundle lockApp 的 100ms focus 可能早于 React
>   挂载）；corner-btns → 既有 React CornerBtns（Toolbar 快照复用）。
> - 闭环：新冒烟 tests/react-stage11a3-smoke.mjs 14/14——宿主/初始隐藏/文件夹锁显示（标题 +
>   提示）/TouchID 缺位（win32）/onInput 同步 scope.unlockPassword/错误密码 shake（同步读
>   classList）/正确密码解锁（isUnLock + 隐藏）/应用锁显示（apptitle + 提示 +
>   corner-btns）/自动聚焦/错误密码 shake（$timeout 异步，60ms 后读标志）/正确密码解锁
>   （isAppLocked=false + 隐藏）。tsc 零错；suite 38 项（runner 增 11a3）**ALL GREEN 零
>   偶发**；api-smoke 13/13。
> - 教训：(1) shims electronSettings 公开 API 是 electron-settings v4 风格
>   （setSync(key,value) 全量写 + getPreferences(true) 强制重载缓存）——内部
>   savePreferences 不在 window 上；(2) 断言 DOM class 先核组件实际渲染类名（CornerBtns
>   是 .ic-btn/.corner-btns，非 .icon-btn）；(3) C 模式让「bundle jQuery 重逻辑」零转写
>   直接过门——shake/blur-loop/val 这类 DOM 缠绕逻辑不必搬进 React。

> **11-pre a4-a9 已验证并接管（2026-09-01；一次性批次 + 统一测试）**：主窗口残留
> Angular UI 块全数清空——index.html 的 ng-* 只剩 html/body 的 ng-app/ng-cloak/
> ng-controller（b1 移除项）。
> - **a8 body 绑定层**：store/bodyState.ts（37 个 watch 表达式快照）+ BodyBindings
>   （C 模式直写：body className = class 插值 + ng-class 28 项逐一对应 /
>   theme/platform/vibrancy attrs / link#app-style href（改静态 href=style_dark.css）/
>   #main-app ui-ready / #list-content-panel 四类 + left/right 定位）+ BoxContainerBindings
>   （#box-container display + empty/pixelated）+ DetailWrapper（详情包裹层 React 渲染——
>   **ng-show → display 而非条件渲染**，#detail-container 身份不可重建（smoothZoom 包裹）；
>   dblclick/mousedown → scope 调用）；index.html 的 body ng-class/class 插值/attrs/
>   list-panel/box-container/main-app 的 ng-* 全删。
> - **a4 空状态族**：DropAreas（六种空状态逐字：all/folder 双 message 的 image-drop-area、
>   智能夹搜索、unfiled/untagged 双态、trash、keyword/filterBadge 无结果）+ ScrollToTop
>   （ng-hide → display；#scroll-to-top id 保留——show class 由 scroll-to-top-sentinel
>   指令与 bundle click 处理器继续管理）+ AppMenuButton（ng-show isLoading；断言经
>   store.setState 驱动避免与 app 自身 isLoading 复位竞态）+ HoverShowSidebar
>   （ng-hover-intent → jQuery hoverIntent 插件 C 模式挂载调 scope.hoverShowSidebar）。
> - **a5 sub-folder 列表**：SubFolderSection 逐字（ng-if/ng-show 双条件、list-label +
>   toggleSubFolderList/showListSubfolderContent、ui-sortable 以 scope.subFolderSortableOptions
>   **原对象**初始化（update 回调走 bundle 原逻辑）、items：covers[0] bind-html →
>   dangerouslySetInnerHTML + selectFolder/openFolder/openSubFolderContextMenu/
>   enableSubFolderNameEditable + selected/locked class + 拖放 on* 三件）。
> - **a6 列表列头**：ListLayoutHeader 逐字（8 列 active + up 方向 class +
>   changeListOrderBy + openListPropContextMenu 右键）。
> - **a7 容器**：ColorsPicker（隐藏 color input，id 保留——bundle 程序化 click 继续生效；
>   ng-change filterWithColor(hexToRGB) → onChange 200ms debounce 等价）+
>   AnnotationPreviewContainer（ng-if isDetailMode → 条件渲染；annotation-box ng-show
>   currentComment → display；**AnnotationPreview 对象留在 bundle（window 全局，React
>   commentHooks 直用），其 body 级委托处理器对 React 渲染 DOM 继续生效**；strip-br/
>   allow-link/editable-selectall 指令随模板删除——plaintext-only + 委托处理器已覆盖，
>   差异记录在案）。hover-preview-container/tag-manager-drag-badge 为静态容器
>   （无 ng-*，bundle jQuery 填充）——保持原样，随 b3 与 HoverPreview 类一同移植。
> - **a9 零散**：box-container 的 ng-show/ng-class/ng-right-click/on* 拖放五件 →
>   BoxContainerListeners 原生监听调同名 scope 函数；**auto-scroll/rect-select/
>   scrollToTopSentinel/boxContainerScrollbar 四指令保持 Angular 编译**（元素属性未动），
>   其移植列为 **b1 前置（b 系列首片）**——rect-select 455 行无 Angular 依赖可近逐字
>   移植，boxContainerScrollbar ~1000 行为最大单体。
> - store/listState.ts：22 个 watch 表达式（含 subFolders/selectedFolderMappings 浅拷贝
>   快照——深 watch 触发 + 新引用驱动渲染）。测试契约 window.__eagleListState/
>   __eagleBodyState。
> - 统一测试：新冒烟 tests/react-stage11a49-smoke.mjs 29/29（hosts/空状态族/排序/列头/
>   body 绑定/详情包裹层/取色器/标注容器/ng-* 清除断言）；tsc 零错；全量 suite 39 项
>   （runner 增 a49）**ALL GREEN 零偶发**；api-smoke 13/13。
> - 教训：(1) zustand 无自定义 set 时用内置 setState（冒烟探针弃 getState().set）；
>   (2) 组件渲染位置必须与断言选择器同源（AppMenuButton 漏 portal 到 host 使断言落空）；
>   (3) 一次性批次的冒烟按断言名分节，失败可直读定位，无需拆文件。

> **11-pre b0 已验证并接管（2026-09-01）**：网格容器 Angular 指令清理 + 剩余指令移植——
> **b1 删除前置清零**。
> - **gridDirectives.ts（提取脚本生成，非手抄）**：autoScroll / scrollToTopSentinel /
>   boxContainerScrollbar 三指令 link 体从 app.bundle.js 逐字提取（含 CRLF 归一 + 闭合
>   尾巴剥离），机械替换仅三处：angular.element("body").scope() → getBodyScope()、
>   scope.$on('$destroy') → destroy 收集器（返回 cleanup）、$timeout → setTimeout shim；
>   文件 @ts-nocheck（逐字 JS 移植不做 TS 改写）。运行期依赖的 bundle 全局（window.ig /
>   resetNgGridLayoutData / HoverPreview / isElementInViewport / jQuery.scrollTo 插件）
>   在 b1 前继续存在，其去留随 b3 bundle 分解。
> - **boxContainerScrollbar（~1030 行）逐字过门**：UPDATE_BOX_SCROLLBAR thumb 高度/
>   switchNormal/PageMode、动态节流 scroll（性能自适应 performanceMetrics）、原生拖拽
>   （transform3d + 精准页内定位 + 相邻页直滚 + 跨页 resetNgGridLayoutData）、mousedown
>   跳页、$destroy 清理。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   早在阶段5 已移植并经 DetailPanel 挂载——b0 前 Angular 指令 + React 移植**双绑并存**
>   （历史遗留：box-container 的 mousedown 双 handler），移除 Angular 属性后归一
>   （.rect 恒 1，冒烟断言）。gridDirectives 不含 initRectSelect（避免三绑）。
> - index.html：#box-container 的 auto-scroll/rect-select 属性、#box-container-scrollbar
>   的 box-container-scrollbar 属性、sentinel div 的 scroll-to-top-sentinel 属性（改挂
>   id="scroll-to-top-sentinel" 供移植代码选择器）全部移除——**主窗口 Angular 编译面仅剩
>   html/body 的 ng-app/ng-cloak/ng-controller**。
> - 闭环：新冒烟 tests/react-stage11b0-smoke.mjs 8/8（init 零错误/rect mousedown 显隐/
>   AutoScroll 广播/thumb 样式/单项库 switchNormalMode/sentinel 初始化样式/属性移除核验/
>   截图）。tsc 零错；全量 suite 40 项（runner 增 b0）**ALL GREEN 零偶发**；api-smoke
>   13/13。
> - 教训：(1) bundle 提取脚本优于手抄（58KB 逐字零誊写错误；CRLF 归一 + 指令闭合尾巴
>   剥离是仅有的两个坑）；(2) 移植前先 grep 既有 React 移植（useRectSelect 先例——
>   grep 关键词要含驼峰变体）；(3) 冒烟探针证明「监听已挂但行为不显」时，先查双绑/
>   多实例，再查事件对象差异。

> **b1 前置勘察结论（2026-09-01；方向决策点，b1 暂缓）**：b1（移除 angular.min.js +
> app.bundle.js）被**数据面依赖**阻塞——阶段11 清理清单的 b1 假设「UI 全 React 后 bundle
> 可移除」不成立：
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   （scope sync 各 store 的数据源、eagle.filter/inspector/action、FileUrlHelper/
>   IPCHelper/resetNgGridLayoutData/ayncsImagesChange/Registration/swal 等）。
> - app.bundle.js = src/app/js 源码树（9MB：services/controllers/directives/utils）+ 
>   eagle 对象族（Inspector 1-249 / ItemFilter 250-606 / DuplicateChecker / AIAction 2048 /
>   ReverseImageSearch 1012 / AISearch 1844 等类）的 webpack 产物 + EagleController
>   34,043 行（页面内后端：导航/筛选/选择/上传/库状态）。
> - index.html 尾部脚本清点：保留 = vendors（tippy/jQuery 族/lodash/mousetrap/colorpicker）
>   + eagle-api.js/url-enlarger.js + lazy-load-manager + shortcut-manager + 内联
>   （window.i18n/window.EagleConfig/appRoot/eagle.urlEnlargerRemote.load()——后两行依赖
>   bundle 全局）；删除对象 = angular*.js + app.bundle.js（及内联的 bundle 依赖行）。
> - core.jsc 仅 registration.html（bytenode）使用，不在主窗口数据面——无阻塞。
> - **结论：b1 的真前置 = 阶段1 收尾（数据面接管）**——eagle 对象族 + EagleController
>   数据函数 + 工具全局的 React 化 + scope sync 数据源切换。规模为数个大会话级，
>   与 UI 片段的「模板逐字转写」性质不同（无模板可逐字，是行为/状态机移植）。
>   待用户确认方向后立切片方案。


> **c1 已验证并接管（2026-09-01）**：工具全局层移植——react/core/ 数据核心目录落成。
> - core/fileUrlHelper.ts：bundle 2287 起对象字面量提取脚本逐字生成（3.9KB），机械替换
>   $bodyScope → getBodyScope()（6 处 libraryImagesPath 读取）+ path → window.require('path')
>   （mock 经 shims bareModules / Electron 经 nodeIntegration）。
> - core/ipcHelper.ts：bundle 3471 起提取（实为 2 方法 24 行小对象——send/sendTo；
>   初次提取误吞后续内联 vendor，改为首个顶格 '};' 收口）。bundle 顶层 const 不上
>   window——React 此前无法直用，本模块补齐（ipcRenderer shim 经 eagleGlobals）。
> - 消费方切换：8 文件 (window as any).FileUrlHelper → 直接 import（commentHooks/
>   detailHooks/boxGridEngine/Inspector/QuickSearchModal/preview-window controller+detailHooks/
>   inspectorState）；boxGridEngine 原本地别名行（const FileUrlHelper = window…）删除防自引用。
>   IPCHelper 无代码消费方（仅注释提及），ProgressDialogs 既有直用 ipcRenderer 保持。
> - 闭环：tsc 零错；全量 suite 40 项 ALL GREEN；api-smoke 13/13（main-ui-workflow/
>   preview-delivery 等覆盖 FileUrlHelper 路径流）。
> - 教训：提取脚本的两个新坑——(1) 替换规则要写进脚本本体再跑（首轮漏 $bodyScope 替换
>   靠产物 grep 抓回）；(2) 对象字面量收口不能依赖"下一个顶层标记"（IPCHelper 后是内联
>   vendor），首个顶格 '}；' 才是对象边界。


> **c2 已验证并接管（2026-09-01）**：eagle 对象族九类移植——数据面接管第一块真实
> 状态/逻辑移植。
> - core/eagleApi.ts：eagle-api.js 源文件逐字（Eagle 骨架 + TreeUtil + urlEnlargerRemote；
>   bundle 加载序中它先于 bundle 执行、var 上 window——eagle 单例的真正出处）。
> - core/eagleClasses.ts（61KB）：bundle region（class Inspector → const junk 前）逐字提取
>   ——Inspector/ItemFilter/DuplicateChecker/Phash/ReverseImageSearch/AISearch/CustomExport/
>   CombineImages/AIAction 九类 + eagle.* 九处挂载语句。机械替换：$bodyScope →
>   getBodyScope()、require('async'|'crypto'|'read-chunk') → _req() 安全包装（mock 无
>   npm 模块返 undefined）、electronLog/swal/i18n/ipcRenderer → window 兜底 shim、
>   FileUrlHelper → c1 移植版。
> - 接线：main.tsx 副作用 import + 测试契约 window.__eagleCoreEagle。**实例暂不覆写
>   window.eagle**（bundle 实例仍为权威态——避免 split-brain：scope 函数写 bundle 实例、
>   React 读 React 实例会分叉）；随 c 域切片逐步切换消费方，cZ 时 bindEagle() 覆写挂载。
> - 闭环：新冒烟 react-stage1c2-smoke 7/7（九实例装配/ItemFilter 方法与数值字段/
>   Inspector width + isHideInspector 读写往返/**与 bundle window.eagle 并存且互不覆写**/
>   TreeUtil.walk 遍历序/urlEnlargerRemote）。tsc 零错；suite 41 项（runner 增 c2）两失败
>   （7a/main-ui-workflow）均既有偶发家族单跑复绿（main-ui-workflow 含 restart 检查）；
>   api-smoke 13/13。
> - 教训：(1) 提取脚本盲区——region 内嵌「类之间的其他类」（Phash/CustomExport/
>   CombineImages 不在预设名单但被 region 完整带走，逐字提取天然包容）；(2) 单例出处
>   要查加载序（eagle 单例在 eagle-api.js 的 var，bundle 只是挂载者——grep bundle 找不到
>   声明时先看 index.html 前置脚本）。


> **c3 已验证并接管（2026-09-01）**：EagleController 函数域移植机制落成 + 第一批 14 函数
> （upload/library/sort/view + 错误清理：cancelAllTasks/uploadFiles/uploadUrls/switchLibrary/
> changeOrderBy/switchGridLayout/switchJustifiedLayout/switchListLayout/switchSquareLayout/
> updateContainerHieght/updateItemView/cleanLibraryPathPermissionError/cleanLocalhostError/
> cleanAllError）+ **callScope 路由切换**（hooks.ts：优先命中 react/core 移植表，bundle 同名
> 函数退为后备——全部 callScope 消费方自动走 React 代码）。
> - core/controllerFns.ts（提取脚本生成；**brace 精确扫描器**：字符串/模板 ${} 嵌套独立
>   计数/注释/正则字面量（前导字符启发式）——首版"下个赋值前切"会把 $watch 等中间语句
>   吞进函数体）。机械替换：$scope → s（makeControllerFns(getScope) 注入；包装层
>   `const s = getScope(); return (function(原参...){...}).apply(null, args)`——s 走闭包不占
>   实参位）、$rootScope → s.$root。
> - 模块级 const shim（bundle 18982-19045 区域子集）：EagleConfig（**|| {} 兜底**——
>   collect 窗口壳无此全局，首轮 suite 9b1 的 24 断言全挂即此因，真回归非偶发）/
>   VIDEO|AUDIO|FONT_TYPES（EagleConfig 派生）/emojiRegex/fs/remainingFilenameLength/
>   currentWindow/electronSettings/ipcRenderer/i18n/preferences/FixUtils/DATE_*。
> - link 级辅助函数机制：非 $scope.fn 的 link 内函数（updateCurrentOrderAndIncrease）逐字
>   提取为模块级导出（$scope → getBodyScope()），移植函数体内调用点零改动。
> - 测试契约 window.__eagleCoreFns。冒烟 react-stage1c3-smoke：契约 14 函数在位/**路由
>   证明**（哨兵替换 scope.cancelAllTasks → core 直调不触哨兵 + 队列清空 + 'cancel.all'
>   spy）/bundle 后备仍通（未移植 clickNode 走 scope）/changeOrderBy('NAME') 写
>   orderBy/switchGridLayout 写 layout。tsc 零错；suite 42 项（runner 增 c3）ALL GREEN；
>   api-smoke 13/13。
> - 教训：(1) brace 扫描器三坑——模板 ${} 需独立计数（混用外层 depth 必炸）、正则字面量
>   需前导字符启发式、CRLF 归一要在读入时做（尾分号剥离才会命中）；(2) 跨窗口共享模块的
>   全局兜底必须按「最贫瘠窗口」设计（main 有 EagleConfig ≠ collect 有）；(3) 9b1 的 24
>   断言全挂是"入口崩"特征信号，与偶发的"个别断言超时"截然不同，先查共享模块加载链。


> **c3 已验证并接管（2026-09-01；batch1+batch2 = 42 函数）**：EagleController 函数域移植
> 机制落成 + callScope 全量路由切换。
> - **机制**：core/controllerFns.ts（提取脚本生成）——函数体逐字 + 包装层
>   `fns[name] = function(...args) { try { initLinkVars(); } catch {} const s = getScope();
>   if (!s) return; return (function(原参){...}).apply(null, args); }`（s 走闭包不占实参位；
>   link 级共享 var 声明提升至闭包顶层、初始化惰性首调执行；link 级辅助函数
>   （updateCurrentOrderAndIncrease/isInFolder/parseKeywordsWithOR/updateSuggestions）逐字
>   导出）。hooks.ts callScope 优先命中本表——**所有 callScope 消费方自动走 React 代码**，
>   bundle 同名函数退为后备（cZ 消亡）。
> - **提取器（brace 精确扫描器）迭代中修掉的四个坑**：(1) 模板 ${} 需独立深度计数（混用
>   外层 depth 必炸）；(2) 正则字面量需前导字符启发式（否则吞 brace）；(3) rename 必须
>   代码上下文感知（`/%/g` 的旗标 g、字符串内容不能改）且跳过 `.` 前导成员访问
>   （s.orderBy 被改成 s.__lv_orderBy 曾致写穿错字段）；(4) link var 收集限定 8 空格缩进
>   （嵌套函数局部 var 误提升曾致 25→72 泛滥）+ 多行初始化语句需深度扫描完整截取。
> - **真回归一例**：batch2 首轮 collect 窗口 24 断言全挂 = controllerFns 模块级
>   `EagleConfig.VIDEO_FORMATS` 在无 window.EagleConfig 的 collect 壳上 TypeError →
>   hooks 导入链死亡 → React 全灭。修复 `|| {}` 兜底。「24/全部断言挂」= 入口崩特征，
>   与偶发单断言超时截然不同。
> - 冒烟 react-stage1c3-smoke：契约 42 函数在位/路由证明（哨兵替换 scope.cancelAllTasks
>   → core 命中不触哨兵 + 队列清空 + 'cancel.all' spy）/bundle 后备仍通（clickNode）/
>   changeOrderBy('NAME') 写 orderBy/switchGridLayout 写 layout/cleanSelected 无错执行
>   （$timeout 100ms 延迟清空 + updateSelection 重算——断言按真实语义）。tsc 零错；
>   suite 42 项 ALL GREEN（main-ui-workflow 一次既有偶发单跑复绿）；api-smoke 13/13。
> - 下一批（c3 续）：sidebar(30)/detail(25)/misc(54) 域同管线追加；cZ = 状态大爆炸迁移。



> **c3 终版已验证并接管（2026-09-02；batch3 追加 = React 调用面 155 函数全量过门）**：
> - **机制修正史（提取器四个终版坑，全部以 esbuild/tsc/冒烟三角定位）**：
>   (1) matchBrace 参数解构——`function (font, {showNotify})` 的首个 `{` 是参数大括号，
>   需 findBodyBrace（先配对参数圆括号再找体大括号）；(2) matchBrace 缺正则字面量分支
>   ——`/...${}.../` 类正则吞 brace 致 search 等函数体错切（前导字符启发式 + 字符类 +
>   旗标吞掉）；(3) __lv_ 改名必须代码上下文感知（`/%/g` 旗标 g、字符串内容不可改）+
>   跳过 `.` 前导成员访问（s.orderBy 曾被改成 s.__lv_orderBy 写穿错字段）；(4) link var
>   收集限定 8 空格缩进（嵌套函数局部 var 误提升）+ 多行初始化深度扫描完整截取 +
>   声明/初始化分离（声明在 makeControllerFns 闭包顶层共享，初始化惰性首调执行）。
> - **箭头形态勘察结论**：113 个 batch3 函数全部为 function 形态（0 箭头）——箭头收集
>   支持回退（无需求）。
> - 生成物：react/core/controllerFns.ts（272KB）——**155 函数全量**（esbuild + tsc 双过）
>   + 54 个 link var（__lv_ 前缀防 shim 冲突）+ 4 个 link 级辅助函数导出。callScope
>   路由优先命中本表；个别未来发现的边缘函数走 bundle 后备（机制内建）。
> - 闭环：react-stage1c3-smoke 全绿（155 契约 + 抽样/路由哨兵证明/bundle 后备/cleanSelected
>   $timeout 延迟清空语义）。tsc 零错；suite 42 项 ALL GREEN；api-smoke 13/13。
> - **c3 完成标志**：React 经 callScope 的函数调用 100% 走 React 侧代码（scope 仅作为
>   过渡期状态载体）。剩余 = cZ 状态大爆炸（scope 状态 + bundle ipc/watch 回调迁入
>   AppCore）→ b1 摘除 angular。

- [ ] 移除 `js/vendors/angular*.js` 与 `app.bundle.js` 引用（index.html 尾部脚本区）。

> **cZ-0 勘察 + 状态大爆炸设计（2026-09-02；清单已落盘 test-run/cz-inventory.json）**：
> - **规模实测**：EagleController scope 字面 **776 个赋值字段**；bundle 内 ipcRenderer.on
>   通道 **117 个**；scope $watch/$watchCollection **22 个**（含 eagle.filter.filterRules.*
>   深度 watch 族 13 个 = 筛选重算引擎 + selected/finishQueue/finishGenerateQueue/
>   listMetaType 4 个业务 watch）；scope $on 事件 6 个（CALCULATE_IMAGE_BINDING/
>   REBIND_REFRESH/UPDATE_SELECTION/SAVE_FOLDER/$locationChange*）；React sync 层消费
>   **~125 个根字段**（12 个 store 文件）。
> - **核心机制（两段式接管，避免 split-brain）**：
>   1. **存储桥**：`Object.defineProperty($bodyScope, field, { get/set → AppCore })`——scope
>      字段转访问器、后端为 AppCore。bundle 内全部读写（ipc 处理器/watch/函数体）经属性
>      访问透明落到 AppCore，**行为零改动、双世界共享同一存储**；React sync（startScopeSync
>      读 scope）零改动自动生效。
>   2. **通道截肢**：逐通道 `ipcRenderer.removeAllListeners(ch)` + 注册 React 逐字移植的
>      处理器（bundle 原处理器随移除消亡）。每截肢一个通道 = 该域业务逻辑归 React 所有。
>      注意 background-state 教训：removeAllListeners 后 React 监听必须自愈重挂。
>   3. **watch 迁移**：bundle watch 在 digest 期驱动业务（如 finishQueue watchCollection 的
>      上传完成流）——对应域截肢时把 watch 体逐字移植为 AppCore 反应函数；bundle watch
>      保留至 b1（digest 存续期间它照常驱动，因存储已桥接，双驱动幂等）。
> - **cZ 域切片（按 117 通道聚类）**：
>   - cZ-1 桥基建制：appCore.ts + bridgeScopeFields + amputateChannel + 首域验证
>     （preferences/theme 域——AppRoot 已半接管，风险最低）。
>   - cZ-2 主题/偏好域：change.current.theme/update-preferences/preferences-updated/
>     show-sidebar-badge 族。
>   - cZ-3 库加载域：initial/app-status-*/preload-library/library.changed（启动管线，最大）。
>   - cZ-4 条目数据域：image.added/removed/changed(.mute)/palette.updated/thumbnail-generated/
>     update-item-view-by-id/update-txt-item/file-uploaded + finishQueue watchCollection。
>   - cZ-5 筛选/搜索域：show-and-search/filter-folder/keyword-suggestion + eagle.filter
>     watch 族 13 个 + REBIND_REFRESH/CALCULATE_IMAGE_BINDING。
>   - cZ-6 选择/视图域：watchCollection selected/UPDATE_SELECTION/listMetaType + 布局类。
>   - cZ-7 杂项域：字体/演示/窗口/分析/插件/导入导出任务通道。
>   - cZ-final：117 通道全数截肢核验（对照 cz-inventory.json）→ b1。
> - 数据面铁律不变：每域截肢后 suite 全量 + api-smoke + 既有冒烟全绿；bundle 字段经桥
>   读写 = 行为零改动。

- [ ] 移除 `js/vendors/angular*.js` 与 `app.bundle.js` 引用（index.html 尾部脚本区）。

> **cZ-1 已验证并接管（2026-09-02）**：存储桥基建制落成——数据面接管的核心机制第一次
> 实装并验证。
> - core/appCore.ts：coreState 状态容器（普通对象——桥接访问器需要同步属性读写）+
>   `bridgeScopeFields(scope, fields)`（scope 字段 → getter/setter 访问器，后端 AppCore；
>   **现值收编**——桥接时把 scope 现值作为 AppCore 初值，绝不丢状态；幂等可重入）+
>   `amputateChannel(ipc, ch)`（通道截肢：removeAllListeners 后返回重挂函数——bundle
>   原处理器消亡、React 逐字处理器注册；各 cZ 域切片调用）。
> - 接线：main.tsx bridgeWhenReady()（scope 就绪后桥接首批 11 字段：theme/platform/
>   language/isLoading/isUILoaded/viewMode/keyword/layout/orderBy/trialRemain/currentFocus）；
>   测试契约 window.__eagleCoreState。
> - 关键验证：**digest 兼容**——bundle 的 viewMode $watch 经桥写仍触发（访问器读写对
>   Angular 脏检查透明）；双向透明（scope 写 → AppCore 读、AppCore 写 → scope 读）；
>   访问器幂等。-suite 43 项（runner 增 cz1）ALL GREEN（main-ui-workflow 一次既有偶发
>   单跑复绿）；api-smoke 13/13；tsc 零错。
> - 下一片 cZ-2：主题/偏好域（change.current.theme/update-preferences/preferences-updated
>   通道截肢 + 字段桥扩容）。

- [ ] 移除 `js/vendors/angular*.js` 与 `app.bundle.js` 引用（index.html 尾部脚本区）。

> **cZ-2 已验证并接管（2026-09-02）**：主题/偏好域——首个通道截肢 + owner 溯源修复。
> - **cZ-1 隐藏 bug 修复（owner 溯源）**：theme 的写入方在 RootController scope（body 的
>   原型链上层），cZ-1 在 body scope 上桥接 theme 会创建影子属性、与根的写入分叉（偏好
>   面板切主题将不再生效——潜伏 bug，suite 未覆盖）。bridgeScopeFields 修复为
>   **owner 溯源**：沿 $parent 链找到字段拥有 scope 再落访问器（hops≤8 防失控）。
> - 字段桥扩容：preferences（$rootScope）/vibrancyEnabled/canUseTouchID 三字段收编。
> - **preferences-updated 通道截肢（首个）**：bundle 处理器 = checkTouchIDSupport + $evalAsync
>   ——React lockState 本就自算 canUseTouchID 且自行监听本通道（双处理并存）。截肢后由
>   core/preferencesDomain.ts 重挂统一处理器：写 scope.canUseTouchID（bundle TouchID 流
>   仍可读）+ refreshTouchID()（lockState 新导出）。change.current.theme / update-preferences
>   **暂不截肢**：bundle 处理器仍承担 RootController 主题落点（owner 桥接后写入透明进
>   AppCore ✓）与 plugin 快捷键/菜单重初始化（未移植，随菜单/插件域截肢）。
> - 闭环：react-stage1cz2-smoke 5/5（字段桥扩容收编/**owner 写读双向穿透**（RootController
>   scope 写 → AppCore 读一致）/preferences-updated 截肢后 scope+AppCore canUseTouchID
>   一致/主题流不回归（change.current.theme DARK → scope+AppCore+body[theme] 三处一致））。
>   tsc 零错；suite 43 项 ALL GREEN（一次性 10 失败 = 与前一 suite 并发执行的资源争抢，
>   10/10 单跑复绿定性）；api-smoke 13/13。
> - 教训：(1) 桥接必须 owner 溯源——原型链分层写入（RootController 写、EagleController 读）
>   的字段在子 scope 桥接 = 影子分叉；(2) 全量 suite 不可并发执行（两次 suite 重叠 = 大面积
>   资源争抢假阳性，单跑定性是唯一标准）；(3) 截肢前先核「React 是否已自给」——
>   preferences-updated 因 lockState 自算而零移植成本，channel 审计先行。

> **cZ-3a 已验证并接管（2026-09-02）**：库加载域轻量五通道——源码签名选择性截肢首用。
> - **切分定性**：cZ-3 库加载域按咬合度拆两片。**3a = initial（22664）/app-status-welcome
>   （22631）/app-status-library-dirs-loaded（22753）/app-status-library-cache-loaded（22758）/
>   library.changed（23535）**——纯 scope 写 + scope 函数调用，全可移植；**3b = app-status-
>   loading（22734）/app-status-library-loaded（22857）/preload-library（22789）+ background-
>   state 生命周期**——三者互相咬合（library-loaded 注册 bg 处理器→heartbeat 启动→loading
>   负责清理 heartbeatInterval 闭包变量），单独截肢会留下不可清理的 bundle heartbeat，
>   必须一并接管（APIServer/ig/UrlStateService 等闭合面已核实：顶层 var/function 全局可达，
>   仅 libraryCache/lazyLoadManager/fse 再 require 等 controller 闭包内需域内自管）。
> - **截肢方式升级 = removeChannelListenersBySource（appCore 新增）**：这五个通道上 React
>   组件已有自给监听（SmallPanels WelcomePage / ProgressDialogs LibraryLoadProgress），
>   removeAllListeners 会误杀，改为按 bundle 处理器**函数源码签名**精准移除（逐通道枚举
>   listener.toString() 匹配；签名 = 原文特征行，React 源码零冲突已核）。initial/library.
>   changed 无 React 既有监听，同路径统一。兼容两种 EventEmitter 存储（node `_events`
>   对象 + shims `listeners` Map——**本仓 ipc 总线是 shims 自建 EventEmitter**，此前 cZ-2
>   的 removeAllListeners 截肢在 shims 形态下同样成立）。
> - **重挂处理器逐字**（core/libraryDomain.ts takeoverLibraryDomain()，main.tsx
>   bridgeWhenReady 接线）：initial = trialRemain/Registration/machineID（module var 经
>   window.* live binding 回写，bundle 侧读取点不变）+ 试用弹窗 localStorage 流（lastOpen-
>   TrialModalTime 半日去重）+ ga4track（全局词法 const，declare const 引用）+ openTrialModal
>   经原型链可达 + body 反透明化 + initMenu；welcome = libraryPath=""/isLoading=false/initMenu；
>   dirs/cache-loaded = isLoading=true；library.changed = folders/smartFolders 树走查 +
>   mappings 重建 + updateSidebarList + calculateImageBinding→rebindRefresh——**原码 `folder
>   && parent` 的 parent 即 window.parent（顶层窗 === window，folder.parent 落 undefined）
>   逐字保留该行为**。
> - 次要挂点定性（免截肢）：welcomePage/libraryLoadProgress/tagSelectPanel/ngGridLayout
>   指令岛的 DOM 已在 7d/11-pre 换 React host，link 不再执行 → 63148+/58105/66512 监听
>   均为休眠死码，不参与双处理。
> - React 对 trialRemain/Registration 零消费 → 本片**零字段桥扩容**（domain 直写 scope
>   字段，与 bundle 落点一致）。
> - 闭环：react-stage1cz3-smoke 9/9（五通道各精准移除 1 个 bundle 处理器/**initial 单监听
>   路由**（trialRemain/Registration/window.machineID 落地）/welcome→libraryPath=''+isLoading
>   =false 且组件监听存活（≥2）/dirs+cache→isLoading=true/**library.changed 全落点含逐字
>   parent 行为（folder.parent===undefined）**；suite 登记补齐 cz1/cz2/cz3 三项（此前
>   cz1/cz2 漏登记））。tsc 零错；api-smoke 13/13；**suite 46 项 ALL GREEN**（首跑 45/46，
>   唯一失败 cz1-accessor-persists = 断言过时非回归——cZ-2 owner 溯源把 theme 访问器从
>   body scope 移到 RootController scope，而 cz1 此前漏登记 suite 未随 cZ-2 复核；断言
>   更新为沿 $parent 链找 getter（hops≤8，与 findOwner 语义一致）后复绿）。
> - 下一片 cZ-3b：启动重管线（app-status-loading/library-loaded/preload-library +
>   background-state 生命周期 + APIServer/startAPIServer 全局复用）。

> **cZ-3b 实现落盘（2026-09-02；新节奏：M1 大批次统一验证）**：启动重管线三通道 + bg
> 生命周期接管，代码与冒烟已写就，**测试延后至 M1 统一验证波执行**（用户指令：避免
> 每小片全量测试的耗时，多处修改后统一冒烟；片内以 tsc 零错 + commit 保持 bisect 能力）。
> - 截肢面：app-status-loading（签名 '移除 background-state 监听'）/ app-status-library-
>   loaded（签名 'findDupclipate'，typo 唯一）/ preload-library（签名 'concatDakuten'）。
>   bg-state 通道不截肢——bundle 处理器由 library-loaded 注册（接管后不再注册），过渡期
>   残留注册由 loading 处理器 removeAllListeners 清理（uploadState 自愈重挂时序：其重挂
>   为 setTimeout(0) 异步，排在 domain 同步 removeAllListeners 之后，无互踩）。
> - **闭合面落点三分类**：module var → window.* live binding（ig/machineID/
>   backgroundWindowID/heartbeatStopCount/hardDiskSpeed/dragging/SlowNotify/analytics/
>   RecentFileManager/appRoot/fontFolder/Registration）；顶层 function → window.*
>   （stopAPIServer/initAPIServer/startAPIServer/checkBackgroundHeartbeat/ayncsImagesChange/
>   isInFolder——注意 isInFolder 有 controller 内（32052，c3 已移植版）与顶层（74283，
>   带 ignore 参）两个同名定义，library-loaded 用的是前者，从 controllerFns import）；
>   全局词法 const/let → declare const（IPCHelper/ACCESS/PERFORMANCE_MONITOR/isVentura/
>   remote/ga4track）。controller 闭包变量 → 域内自管：libraryCache/lazyLoadManager/
>   updateTimer/heartbeatInterval（domainLibraryCache 等 4 个域内镜像）。
> - **有意略去（行为等价，逐项注释）**：loading 末尾十模块同路径重 require（缓存同实例）；
>   lastProcessedUrlState 清零（URL 去重 guard，watcher 写入方仍在）；allTags = {}（全
>   bundle 零消费点死变量）；$http.post 遥测 → $.ajax JSON POST（原码第三参为误传回调，
>   Angular 按默认配置发送，等价复刻）。
> - **浊音表逐字节注入**：preload-library 的 concatDakuten table1/table2 是**分解浊音
>   码点**（U+3099/U+309A combining），手打会合成变形损坏日文检索——用脚本从 bundle
>   22805/22806 行原样提取注入（table1 len=256/table2 len=205）。
> - library-loaded 逐字面：状态重置 40+ 字段 / folders+smartFolders 树走查（此处 parent
>   是 walk 回调第二参，与 library.changed 的 window.parent 陷阱不同）/ TagManager.groups
>   \r 清洗 / 图片载入双路径（preload 域内缓存 / imagesStringPath 文件流 + 坏 JSON 自愈
>   → ayncsImagesChange）/ calculateImageBinding 回调（viewMode 恢复 + lastFolder/lastItem
>   7 天回归 + UrlStateService URL 态 12 分支 + OPEN_IMAGE_FILTER 广播）/ 1s 后
>   findDupclipate + smartFolder 计数（ayncsUpdateSmartFoldersCount 域内移植）/ APIServer
>   启动 + bg 处理器注册（palette/metadata/download 队列落 scope + saving-progress-bar
>   DOM，$filter 经 injector 获取）/ 6h updateTimer（域内）/ localhost:41593 探活 /
>   ACCESS.checkALCs 写权限 / darwin NTFS 检测 / showTutorial。
> - 闭环：tests/react-stage1cz3b-smoke.mjs（已登记 suite，M1 统一波执行）——三通道摘除
>   计数/preload 域内缓存 2 条目/library-loaded 全链路（raw/isUILoaded/APIServer/LazyLoad-
>   Manager/binding 完成 isLoading=false）/bg-state 落地+域内心跳/loading 清理（isUILoaded
>   =false+allData 清空+心跳停+bg 监听零）/恢复重载。

> **cZ-4 实现落盘（2026-09-02；M1 统一验证待执行）**：条目数据域——12 通道截肢 + 逐字重挂
> （core/itemDomain.ts takeoverItemDomain()，main.tsx 接线；tsc 零错；冒烟并入 M1 统一测试）。
> - 通道：image.added(23579)/image.removed(23602)/image.palette.updated(23627)/
>   image.changed.mute(23651)/image.changed(23673)/update-item-view-by-id(23992)/
>   file-uploaded(30427)/thumbnail-generated×2(31147 详情图刷新 + 34281 封面更新)/
>   update-txt-item(31141)/webp.converted(34267)/calculateImageBinding(30549)/
>   new-folders(30560)。
> - **image.changed 精确保留两路旁听**：bundle 第二处理器（DuplicateModal 59465，写自身
>   modal scope.duplicates 调色板同步）与 React DuplicateFamily 自给监听——签名
>   'hiddenByCurrentFilter([item])' 只摘主处理器；webp.converted 同理保留 React
>   ProgressDialogs（签名 'updateItemListView(converted)' 小写敏感不误伤域内
>   domainUpdateItemListView）。
> - **闭合函数域内移植**：muteRebind（throttle 全局 → w.throttle(rebindRefresh(true),
>   3000, true)）/muteCalcuteImageBinding（+timeout 双局部，console 标记逐字）/
>   updateItemListView（34300-34475 全量：modifiedMappings 计数、updateFilterCounts ±1、
>   ext/text/mtime/btime/animated/orientation/resolution/双 noThumbnail 对削、宽高比变更
>   才 updateItemView+relayout+offsetScrollbar、封面缩略图 &v= 刷新、txt-content HTML、
>   finishGenerateQueue 入队、详情 smoothZoom updateNavigator）。
> - **finishQueue watchCollection 接管（34506）**：scope watch 不随通道截肢——先按
>   exp==='finishQueue' 从 scope.$$watchers 摘除 bundle watcher，再域内重挂同表达式
>   （隐藏空队列清空 / addImageStartTime+倒数计时清理 / 新条目 autoSelect（上限 1000、
>   random 例外、detail 不扰）/ duplicateQueue → OPEN_DUPLICATE 广播 + duplicateSound 或
>   直接入列 / calculateImageBinding 回调按 currentFolder/currentSmartFolder/viewMode 三路
>   reload(true)/darwin bounce+flashFrame / palette-resume / 添加图片完成计时）。原码
>   `$scope.finishQueue.length > 2`（此时已清空恒 false）逐字保留；$watchCollection 第三参
>   true 保留（Angular 忽略多余参）。addImageTimeLeftInterval 域内自管。
> - 闭合变量落点：getHashID/hiddenByCurrentFilter/FileUrlHelper/updateWindowProgressBar/
>   throttle/installedFonts → window.*；VIDEO/AUDIO/FONT_TYPES → s.VIDEO_TYPES 等
>   （controller 已挂 scope）；readChunk → w.require('read-chunk')；IPCHelper/remote →
>   declare const；isInFolder（controller 版）→ controllerFns import；w.ig 全局。
> - file-uploaded 逐字面：lastestAddItem/itemMappings 落点、md5 双缓冲去重（existsBuff
>   .equals）、duplicateQueue 分流、filterExtensions 类型表（video/audio/font/powerpoint/
>   word/excel/default）、upload-queue-progress DOM、updateWindowProgressBar(±1)、
>   finishQueue 全齐才全量 binding 否则 muteCalcuteImageBinding。
> - 诊断契约：window.__eagleItemDomain（takenOver/removed 12 通道计数/watchRemoved）。

> **cZ-5 实现落盘（2026-09-02；M1 统一验证待执行）**：筛选/搜索域——3 通道 + eagle.filter
> watch 族 12 个 + $on 广播 2 个（core/filterDomain.ts takeoverFilterDomain()，main.tsx
> 接线；tsc 零错；冒烟并入 M1 统一测试）。
> - 通道：keyword-suggestion（23520 → globalKeywords）/ show-and-search（23705 →
>   show+focus+searchInAll）/ filter-folder（23712 → #folder-search 聚焦）。
> - watch 族（34180-34199）：file/duration/bpm min/max ×6、shape width/height ×2（双条件
>   体逐字）、resolution minW/maxW/minH/maxH ×4 → 摘 bundle watcher（$$watchers 按 exp
>   匹配 splice）后域内重挂同表达式 → filterContent()。imageSize.height/zoomRatio watch
>   属视图域留 cZ-6。
> - $on 广播（42371/42375）：CALCULATE_IMAGE_BINDING → calculateImageBinding(params)；
>   REBIND_REFRESH → $timeout(500) 语义（setTimeout + $apply）rebindRefresh(mute)。发送方
>   仍在 bundle 未移植路径（43433/55168/59582 等），接收端按 $$listeners 摘除后本域独占。
>   UPDATE_SELECTION/SAVE_FOLDER 留 cZ-6。
> - 诊断契约：window.__eagleFilterDomain（removed/watchRemoved/listenersRemoved）。

> **cZ-6 实现落盘（2026-09-02；M1 统一验证待执行）**：选择/视图域——scope watch/$on 接管，
> 无 ipc 通道（core/selectionViewDomain.ts takeoverSelectionViewDomain()，main.tsx 接线；
> tsc 零错；冒烟并入 M1 统一测试）。
> - **watchCollection "selected"（34214 主 watcher 全量逐字）**：body scope 有两个 'selected'
>   watcher（主 + darwin quicklook 34265），removeScopeWatchersAll 按 exp 全量摘除后域内
>   重挂两个；54323（inspector scope）/58048（指令 scope）不属 body scope 不动（随检查器域
>   后续处理）。主 watcher：selectedMappings 重建/zoomFitSize=0/updateSelection/详情模式
>   切图分支（rememberVideoCurrentTime+AnnotationPreview.hide+300ms smoothZoom update-
>   Navigator）/lastSelectedIndex/全选 addClass vs selectItemsView/setLastItem（38490 逐字，
>   _.debounce 333ms → window._，localStorage lastViewItem/lastViewItemTime）。
> - darwin quicklook watch 平台守卫内注册（debounce 300, true → window.debounce；ipc.send
>   quicklook）。
> - **imageSize.height watch（34200）**：enlarge/shrinkThumbnails controller 闭包（20324/
>   20345）域内移植（.box.show/enlarge-thumbnail 选择器 + raw/lsrc src 互换 + 600ms 防抖，
>   timeout 局部域内自管）；imageSize.zoomRatio watch（34211 → sliderZoomRatio）。
> - **listMetaType watch（37269）** → changeMetaItems（scope 函数，含 localStorage
>   eagle.list.meta.type 落点）；finishGenerateQueue watchCollection（34496，cZ-4 遗留同族
>   ——满队 $timeout(200) 清空 + findDupclipate）。
> - **$on UPDATE_SELECTION（42379）/ SAVE_FOLDER（42383）**：$$listeners 摘除后域内重挂。
> - 类型适配（语义不变）：jQuery data('degree','0')（.data 原码传 0，jQuery 内部同存）、
>   localStorage String(Date.now())（浏览器 setItem 本就数字转串）。

> **cZ-7a 实现落盘（2026-09-02；M1 统一验证待执行）**：杂项域主块簇——56 通道截肢 + 逐字
> 重挂（core/miscDomain.ts takeoverMiscDomain()，main.tsx 接线；tsc 零错；冒烟并入 M1
> 统一测试）。
> - 覆盖：show-swal/show-minor-update-message/open-relaunch-confirm/get-duplicate-map/
>   lock-now/window.maximize/unmaximize/analytics.event/performance/custom/exception/log/
>   confirm-import-eaglepack/reload/show-intel-compatibility-issue/before-quit/
>   update-progress/add-download-task(s)/extension-server-init-failed/load-open-with/
>   move-to-folders/rebind-refresh/open-item/go-folder/go-smart-folder/add-history-tag(s)/
>   clear-history-tag/prepend-folder/new-folder/new-smart-folder/hide-upload-queue/
>   open-and-reveal-image/power-suspend/power-resume/window-close/open-preferences/
>   toggle-slideshow/leave-slideshow/show-sidebar-badge/hide-sidebar-badge/import-folders/
>   activate-font/deactivate-font/reveal-in-eagle/open-unregister/get-current-folder/
>   get-recent-folders/add-recent-folders/image-processing-error/remove-trash-item/
>   ondragend/app-expired/change.current.theme/change.zoom。
> - **change.current.theme 终截肢**（cZ-2 缓释条件成熟）：落点 RootController scope（r.theme
>   ——owner 桥后写入透明进 AppCore，React BodyBindings 经原型链读一致）；remote.nativeTheme
>   declare 引用；preview-window 控制器为独立窗口上下文不影响。app-expired（body 反活化）；
>   change.zoom（webFrame.setZoomFactor）。
> - **重挂适配（语义等价）**：swal 全局（未定义时静默降级原样流程）；dialog →
>   @electron/remote.dialog；app.relaunch/exit → window.app（同 bundle 解析路径）；
>   open-unregister 的 $http Promise 流用 $.ajax jqXHR.then 等价复刻（Angular response
>   {data:...} 包装经适配还原）；update-menu/update-preferences 暂留（initMousetrap 闭包
>   重绑定 + pluginModule——插件/菜单域再收）；jieba-extract-done → 标签域；plugin-*
>   @1089/54292 → 插件域；@62437 PluginCenter 指令岛已删休眠；@18672 插件管理器模块级
>   responseCallback 保留；@63309+ LoadProgress 休眠已知。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   已改造 `* /`。诊断契约：window.__eagleMiscDomain（removed 56 通道计数）。

> **cZ-7b + cZ-final 实现与核验（2026-09-02；M1 统一验证待执行）**：
> - **cZ-7b**：jieba-extract-done（48725，标签推荐域）追加截肢重挂——TagManager.suggestions
>   入队/capitalize/localeLength 页面原型扩展、stopword 三语去停用词（require('stopword')）、
>   tagMappings 优先排序；languageBCP 闭包变量经 $rootScope.language 等价重算（bundle 在
>   RootController init 一次性赋值，语言变更经 update-preferences 刷新——等价）。tsc 零错。
> - **cZ-final 通道全核验**（脚本枚举 bundle ipcRenderer.on 全量 vs 已截肢清单，落盘
>   test-run/cz-final-channels.json）：**实测 bundle 注册通道 97 个，已截肢 81，保留 16**
>   （cz-inventory 曾估 117 系把 sendTo/invoke/子页面计入；以实测为准）。保留 16 全定性：
>   - 插件域后续（4）：plugin-installed/uninstalled/reloaded（pluginManager 模块 + AI 类
>     实例级监听，实例状态闭包绑定）+ install-plugin/open-plugin-center-and-search……
>     其中 install-plugin/open-plugin-center-and-search @62437 在 PluginCenter 指令 link
>     （岛已删，index.html:139-140 React host 替代）= **休眠死码**，b1 时随 bundle 消亡。
>   - 键盘/菜单域后续（2）：update-menu/update-preferences——依赖 buildMousetrap/
>     destoryMousetrap（49177/49316 controller 闭包，快捷键构建大函数）与 pluginModule
>     initShortcuts/initMenu；无双处理（React 无监听），b1 前随键盘域接管。
>   - background-state（1）：bundle 注册点已在 library-loaded 截肢中消亡（仅首次启动
>     竞态窗口可能残留一次注册，由 loading 处理器 removeAllListeners 清理）；通道归属
>     React uploadState（自愈重挂）+ domain 注册，无需再截肢。
>   - 休眠死码（10）：app-status-module-loading/loaded、checking-library-cache(+increase)、
>     app-status-library-dirs-loading、app-status-library-metadata-loading/loaded、
>     app-status-library-cache-loading/……均位于 LoadProgress 类（libraryLoadProgress 岛
>     已删 @7d-6a）→ 不 link 不注册，b1 时随 bundle 消亡。
> - **M1 数据面通道接管完成度：97/97 全定性（81 接管 + 16 有据保留）**。bundle 剩余
>   "活"的监听仅 = 插件域 4 + 键盘/菜单域 2（均有明确后续域归属，无双处理风险）。

> **M1 统一验证完成（2026-09-02；数据面接管里程碑收口）**：
> - **统一冒烟 tests/react-stage1m1-unified-smoke.mjs 15/15 全绿**（A 五域 diag+截肢计数 /
>   B cZ-3b 启动重管线全链路 / C cZ-4 条目三态 / D cZ-5 筛选 watch+广播 / E cZ-6 selected
>   watch+广播 / F cZ-7a 杂项五连发）；**suite 全量 ALL GREEN**（46 项）；**api-smoke 13/13**
>   （外联式——需活实例：用 bootStack 起 mock 库栈 + 注入 EAGLE_API_URL/EAGLE_THUMBNAIL_URL/
>   EAGLE_EXTENSION_URL 三端口跑法，41693=栈的 extensionPort 非 renderer APIServer 的
>   41595；此前的裸跑失败为跑法问题非回归）。
> - **重大根因：bundle re-require 段是十全局 var 的【首次赋值点】**。cZ-3b 曾把 app-status-
>   loading 末尾的 fse/tinyPinyin/readChunk/writeFileAtomic/cartesianProduct/sanitize/
>   unicodeNormalize/chineseConvert/colorConvert/DeltaE 十行重 require 判为「缓存同实例、
>   略去无害」——实际其中 sanitize 等的**唯一赋值点就在这段**（顶层 var 19041-19051 声明
>   后仅在此赋值），截肢后 window.sanitize 永远 undefined → inspectorActions 的 saver
>   `sanitize is not a function` → 重命名全链路静默失效（stage6/7d3b/7d5b/main-ui-
>   workflow/preview-delivery 五项 suite 失败同根因）。已在 libraryDomain 的 loading
>   处理器补回十行（window.* live binding 逐字 + 注释标注【首次赋值点】）。**教训：逐字
>   铁律下「看似无害的重复初始化」不可省——赋值点分析必须查证每个被略语句的全部副作用**。
> - **$watchCollection 接管决策改向**：其 watcher.exp = $parse 包装器实例（expensiveChecks
>   变体对一切表达式共享同一生成源码，源码串判据产生幻影匹配）、watcher.fn = Angular 内部
>   wrapper（原 listener 闭包不可见）——**exp/fn 双不透明，无法识别/摘除**。决策：selected/
>   finishQueue/finishGenerateQueue 三个 collection watcher **保持 bundle 独占至 b1**（域
>   不重复注册 = 无双处理；bundle watcher 对域推送数据的反应与原状一致），plain $watch
>   （filter 族 12 + imageSize×2 + listMetaType）正常接管。appCore 新增
>   sweepForeignWatchers/persistSweep（注册后按 exp 实例/监听函数源码特征清扫外来 watcher，
>   100ms×150 幂等复扫覆盖晚注册竞态；mine 以句柄/监听函数引用 + 源码标记三重排除；教训：
>   **$watch 返回注销函数而非 watcher 对象**、s.$watchers 拼写错误曾使整条 sweep 成死码
>   ——两个 bug 均被「filterMin 唯一性」结果断言逼出）。
> - **buildWhenReady 强就绪门**：window.$bodyScope 由任意指令随机时机赋值，不能作准；改为
>   getBodyScope() + 归一化（ang.element(document.body).scope() 强制回填）+ scope.mousetrap
>   （EagleController 体内 49328 设置，晚于全部 ipc/watch/$on 注册点）三重门。
> - **cz3b 片级冒烟删除**（与 m1 统一冒烟 B 组重复，按「一个统一冒烟」方针并入；suite 登记同步移除）。
> - 另修：allData 由 openAll/filterContent 按后端真实库重建（合成缓存项不注册进后端），
>   binding 闭环基准改用 itemMappings 全量建齐；loading 处理器尾部补 $evalAsync（事件驱动
>   场景下 $timeout 派工需要 digest flush）。
> - 临时探针（probe-m1-api/probe-rename）验证后即删，不入库。

> **阶段1 收尾（数据面接管）切片方案（2026-09-01 立项；方向 = 全量迁移路径）**：
> - **规模实测**（提取脚本盘点）：EagleController（bundle 20197-54236）$scope 函数
>   **480 个**；React 直接调用 **155 个**（test-run/ec-called-by-react.txt 全名单），
>   其余 ~325 个 = 数据核心内部函数 + 已死 UI 函数。另有 eagle 对象族
>   （Inspector 1-249 / ItemFilter 250-606 / DuplicateChecker 957 / AIAction 2048 /
>   ReverseImageSearch 1012 / AISearch 1844）与工具全局（FileUrlHelper / IPCHelper /
>   resetNgGridLayoutData / ayncsImagesChange / hiddenByCurrentFilter 等）。
> - **架构**：新建 react/core/ 数据核心（AppCore）——zustand 拥有现挂 scope 上的状态机，
>   ipc/REST 同源喂数；155 个 React 调用面函数逐字移植为 AppCore 方法；各 bind*Sync 的
>   startScopeSync 逐域切换为 AppCore store 订阅（Angular 层每切一域死一块）。
> - **切片序（c 系列）**：
>   - c1 工具全局层：FileUrlHelper / IPCHelper 等无状态工具 → react/core/*.ts（React
>     直 import；bundle 内同名全局在过渡期共存）。
>   - c2 eagle 对象族：Inspector/ItemFilter/DuplicateChecker/AIAction/ReverseImageSearch/
>     AISearch 逐字 → react/core/ + window.eagle 装配等价（消费者零改动）。
>   - c3..cN EagleController 函数域（按 155 调用面聚类分域，每域 = 移植 + sync 切换 +
>     冒烟）：候选域 = 库加载/文件夹树导航/筛选引擎/选择/上传队列/搜索/排序/详情/检查器/
>     通知/右键菜单数据/快捷键路由。
>   - cZ sync 全切换后 → b1（angular.min.js + app.bundle.js 引用移除）→ b2/b3 旧文件
>     删除（清单届时再列再确认）。
> - 铁律不变：行为零改变、数据面通道逐字（ipc/localStorage/electron-settings）、旧实现
>   验证前不删。每片固定节奏：转写 → tsc 零错 → 冒烟 → suite → api-smoke → PROGRESS →
>   commit。

> **c9a 内部机器移植第一片（2026-09-02；calculateImageBinding/sortRawData/getAncestorFolders/getExtendTags scope 替换生效）**：
> - core/dataMachinery.ts 新建：machinerySortRawData（bundle 21621-21708 逐字：NAME/EXT/RESOLUTION/
>   FILESIZE/RATING/DURATION/BTIME/MTIME/TAGS/default 十分支 + updateCurrentOrderAndIncrease）、
>   machineryGetAncestorFolders（42508 逐字）、machineryGetExtendTags（32028 逐字，tags.unique()
>   为 bundle Array 原型扩展保留原调用）、machineryCalculateImageBinding（28684-28965 逐字：
>   duration 1/50 退避 + TagManager.azGroups→$timeout.cancel + $timeout(work,duration) + 全部
>   resets + 三次 tree.walk + raw 全循环（itemMappings/trash/all/exts/untaggedCount/unfiledCount/
>   folders 修复/lockedImages/tags 计数/封面 default map）+ extList→eagle.filter.filterTypes +
>   covers 补全 walk + TagManager.rawdata/pinyinCache/calculateTags + callback + catch）。
> - **接管方式 = scope 函数替换**（applyDataMachineryScope：s.calculateImageBinding/sortRawData/
>   getAncestorFolders = 移植版）——bundle 侧 muteCalcuteImageBinding 等全部 $scope.* 调用面
>   即时走移植实现，无需截肢（函数调用不占 ipc 通道/watch）。main.tsx bridgeWhenReady 在
>   字段桥后调用。
> - 域内自管：pinyinCache/calculateImageBindingTimeout（原 controller 闭包变量）；$filter/$timeout
>   经 injector 注入（Angular digest 语义不变）；languageBCP 由 scope.language 重算（bundle 20053
>   等价）；有意略去 `var path = require('path')`（原文未使用，无副作用，注释标注）。
> - 验证：tsc 零错；m1 统一冒烟 15/15（B 组 cbRan=1/cbErr=null = library-loaded→
>   calculateImageBinding 全链路走移植实现）；suite 47 项 46 绿——main-ui-workflow-closed-loop
>   偶发失败单独复跑通过（连跑 30+ electron 循环的资源竞争型 flake，非回归）。

> **c9b rebindRefresh 域（2026-09-02；rebindRefresh/rebindRefreshLazy/updateSidebarList scope 替换生效）**：
> - machineryRebindRefresh（27366-27454 逐字；async）：calcuteFilterResult（scope 解析，仍由
>   bundle 承载）→ tagFilterLogic 分支 calcuteContainTags → 置顶排序（comparator 隐式 undefined
>   怪癖逐字保留）→ allData/filtereds/itemMappings 重建 → refreshSubfolderList → keywordDebounce
>   梯度（200/50000/100000）→ updateItemsView + #box-container-scrollbar trigger + HoverPreview
>   隐藏 + $evalAsync。resetNgGridLayoutData = ngGridLayout 指令 66970 隐式全局赋值（window.*）。
> - machineryCalcuteFilterBadge（27522-27633 逐字；controller 闭包函数）：纯 eagle.filter.filterBadge
>   计数移植。machineryFilterSidebarItem（37967-38001 逐字）：chineseConvert/cartesianProduct/
>   pinyinlite（re-require 十行成员 window.*）+ _.uniq/_.max + String.prototype.score（bundle 2621
>   原型扩展）。machineryRebindRefreshLazy（1000ms 防抖）/machineryUpdateSidebarList（42545-42617
>   逐字；20ms 防抖）——两个 timeout 闭包变量域内自管。
> - m1 统一冒烟扩至 16 项（新增 m1-A3-c9-machinery：__eagleDataMachinery 契约 version≥2 +
>   五函数 machinery 标记 + scope 函数在位）；D 组 rebind-broadcast 即移植版全链路验证。
> - 验证：tsc 零错；m1 16/16；suite 一项 stage7a cm-overlay-close 偶发失败单独复跑通过
>   （同类资源竞争 flake）。

> **c9c 视图/加载域（2026-09-02；updateItemsView/switchLayout/prependImages/reload scope 替换生效）**：
> - machineryUpdateItemsView（35065-35072 逐字）——updateItemView 经 scope 解析仍由 bundle
>   承载；machinerySwitchLayout（33790-33846 逐字）——四布局分支 + body class + $container
>   class + relayout + offsetScrollbar(30) + $root.initMenu()（均经 scope 解析）；jQuery
>   全经 window.$。
> - machineryPrependImages（30524-30538 逐字）+ machineryResetImageData（30540-30548 闭包
>   函数；viewMode/currentFolder 判定 + resetNgGridLayoutData + $evalAsync）——prependImagesTimeout
>   域内自管（500ms 重置防抖）。
> - machineryReload（42867-42918 逐字）：**_.debounce(fn, 100, true) leading-edge 防抖实例在
>   applyDataMachineryScope 时一次性创建**（与 bundle controller init 同语义；替换语句本身
>   不可重复执行防抖工厂）——leaveDetailMode/relayout/updateSelection/calculateFilterCounts/
>   updateSubFolderWidth/adjustLayoutWidth 经 scope 解析；machineryAutoResizeTagFilter
>   （43119-43128 闭包函数）同片移植。
> - m1 A3 断言扩至九函数 machinery 标记。验证：tsc 零错；m1 16/16（DIAG-CONSOLE 空）。

> **c9d 缩放/放映/计数/最近文件夹（2026-09-02；六函数 scope 替换生效）**：
> - machineryGetRatioExp（31336 逐字）/ machineryGetRatioNonExp（31343 逐字）——纯函数，
>   React 域 24 处调用面共用；machineryUpdateZoomRatio（31391-31418 逐字）——smoothZoom
>   vendor jQuery 插件 + updateZoomRatioTimeout 域内自管。
> - machineryToggleSlideshow（23816 逐字；enter/leaveSlideshowMode 经 scope 解析）、
>   machinerySmartFolderCount（46646 逐字；existInSmartFilter/lockImageFilter 经 scope 解析）、
>   machineryGetRecentFolders（31969 逐字；localStorage recentMoveFolders 键逐字）。
> - **定性**：unlockPassword 为 scope 字段（非函数）——React 侧 5 处读写经字段桥解析，无需移植。
> - m1 A3 断言扩至十五函数 machinery 标记（version 4）。验证：tsc 零错；m1 16/16。

> **c9e 单条目视图机（2026-09-02；updateItemView/checkTouchIDSupport scope 替换生效，c9 阶段收口）**：
> - machineryUpdateItemView（34847-35063 逐字；updateItemsView 循环体）：metas 十分支
>   （RESOLUTION 内 VIDEO/AUDIO/FONT/noPreview/SPECIAL/url/txt 子判 + FILESIZE/TYPE/MTIME/
>   BTIME/TAGS/RATING）+ modifiedMappings 计数 + lazysrc/lsrc/raw 缩略图刷新 + has-annotation/
>   bg-*/selected/tagged/旋转 r2-r8 类 + 字体激活状态（installedFonts + sanitize + i18n 双语
>   title）。依赖全部 window.*（fileSize/fontFolder/sanitize/installedFonts/i18n/VIDEO_TYPES/
>   AUDIO_TYPES/FONT_TYPES/SPECIAL_TYPES）+ $filter 经 injector + fs 经 window.require('fs')。
> - machineryCheckTouchIDSupport（29002-29010 逐字；非 darwin 不写 canUseTouchID 的原码
>   quirk 保留）——bundle 29014/29109 调用点与 React lockState 流共用。
> - **c9 阶段收口审计**：scope 函数替换共 **24 个函数**（version 6 契约：calculateImageBinding/
>   sortRawData/getAncestorFolders/getExtendTags/rebindRefresh/rebindRefreshLazy/updateSidebarList/
>   calcuteFilterBadge/filterSidebarItem/updateItemsView/updateItemView/switchLayout/prependImages/
>   reload/resetImageData/autoResizeTagFilter/getRatioExp/getRatioNonExp/updateZoomRatio/
>   toggleSlideshow/smartFolderCount/getRecentFolders/checkTouchIDSupport）。React 域高调用面
>   （getRatioNonExp 16/updateZoomRatio 14/updateSidebarList 14/rebindRefresh 14/calculateImageBinding
>   11/updateItemView 11+6/getRatioExp 8/switchLayout 7/reload 6/prependImages 1/smartFolderCount 1/
>   getRecentFolders 1）全部改走移植实现；unlockPassword 定性为 scope 字段无需移植。其余
>   bundle 承载函数（relayout/filterContent/zoom/enterDetailMode/calculateFilterCounts/
>   updateSelection/saveFolder/notify/forceFitImageSize/existInSmartFilter/adjustLayoutWidth/
>   openAll/getFolderList 族等）经 scope 解析可达，归属 c 系列后续域（b1 前按调用面逐域清零）。
> - 验证：tsc 零错；m1 16/16（DIAG-CONSOLE 空）；suite 四项偶发失败（7d4/7d5b/9a2/
>   main-ui-workflow）均单独复跑通过——失败成因为 suite 运行中途 c9e 源码落盘（vite 冷启动
>   读到中间态）叠加连跑资源竞争，非回归。**教训：suite 全量跑期间不得修改 src 源码**。

> **c10a-1 bundle 全局接管（2026-09-02；core/bundleGlobals.ts if-absent 机制落地）**：
> - **b1 关键面勘察定论**：index.html 独立 script 标签（jquery/lodash/mousetrap/tippy/
>   lazy-load-manager/shortcut-manager/colorpicker/eagle-api）b1 后存活；**其余 bundle 顶层
>   var/function/const 的 window live binding 全部随 app.bundle.js 死亡**。React 窗口全局
>   访问 161 名 × bundle 顶层声明 804 名交集 = 80 名（剔除 DOM 内建与 __eagle* 诊断后为接管面）。
> - **接管机制 = if-absent 安装**：window.X 无值才装——bundle 在世时（classic script 先于
>   React module 执行）沿用其绑定，行为零改变；b1 后 bundle 缺席，由本模块供给。幂等可重入。
>   main.tsx 在 bridgeWhenReady() 之前调用 installBundleGlobals()。
> - **Tier 1 已接装**（21 名，m1-A4 断言全部在位）：appRoot（19002）/ EagleConfig（2051）/
>   VIDEO·AUDIO·FONT_TYPES（18988-18991）/ SPECIAL_TYPES（18994，原码 afpub 重复键去重注释）/
>   fileSize（2548-2572 逐字）/ re-require 十行（22776-22787 同路径）/ installedFonts（19243）/
>   fontFolder（19192-19198）/ FileUrlHelper（React c1 移植版 fileUrlHelper.ts）。
> - **Tier 2 待接装**（b1 前随各自 c 域移植）：getHashID/guid/fuzzy_match/fuzzy_score/
>   cloneTree/decodeBase64Image/hiddenByCurrentFilter/ayncsImagesChange/APIServer 族/
>   Registration/SlowNotify/RecentFileManager/analytics/eg(InfiniteGrid)/NgGridStrings/
>   AnnotationPreview/ScrollbarSaver/ShortcutManager(bundle 版)/PluginCenterFactory 等。
> - m1 统一冒烟扩至 17 项（新增 m1-A4-bundle-globals：21 关键全局全部在位断言）。
>   验证：tsc 零错；m1 17/17（DIAG-CONSOLE 空）。

> **c10a-2 Tier 2 全局函数批（2026-09-02；13 名接装）**：
> - 逐字移植 if-absent 接装：guid（2396）/ throttle（2400-2438，原码乱码注释逐字保留）/
>   debounce（2440-2458，**bundle 自有实现非 lodash**——itemDomain domainMuteRebind 等
>   w.throttle/w.debounce 调用面的 b1 后供给）/ fuzzy_match（2516-2547）/ decodeBase64Image
>   （2949-2963，Buffer 为 node 全局 b1 存活）/ cloneTree（8207-8242）/ getHashID（2127-2273
>   全分支：url/音频/pdf/ttf-otf-ttc-woff 字体 uniqueID/default 调色板三分支 + canGeneratePalette
>   长图守卫）/ hiddenByCurrentFilter（49600-49663，filterData/contentFilter 经 $bodyScope 解析、
>   smartFolderCount 已是 c9d 移植版）/ ayncsImagesChange（49667-49704，ipcRenderer 统一表达式）/
>   startAPIServer（18945-18968）/ stopAPIServer（18970-18975）/ checkBackgroundHeartbeat
>   （19147-19190，heartbeatStopCount/heartbeatInterval 经 window live binding——libraryDomain
>   域管赋值点）/ **fuzzy_score 不存在**（bundle 无此定义，win_access 误命中，从清单剔除）。
> - 支撑链接装：electron/ipcRenderer（19018-19028 复现）、currentWindow/app（19020-19029 经
>   @electron/remote）、VIDEO_TYPES_GLOBAL（2052，getHashID 依赖）、pluginModule（19040，
>   getHashID 依赖）。
> - **initAPIServer（17875-18945，~1070 行 JSON REST 全路由注册）独立成片**（c10b）——其
>   内部路由与后端 APIServer 面（api-smoke 13 项覆盖）必须整体移植 + 对照验证。
> - 验证：tsc 零错；m1 17/17（DIAG-CONSOLE 空）。

> **c10b initAPIServer 域（2026-09-02；core/apiServerDomain.ts 全量移植 + if-absent 接装）**：
> - **50 内嵌处理器全数移植**（bundle 17881-18845 逐字）：getAPIFolders（含 cloneFolderList
>   密码树剪枝）/ unlockFolder（window.btoa 逐字）/ getAPIMetadataInfo / getLibraryHistory /
>   switchLibrary / getLibraryIcon（streaming）/ getAPIApplicationInfo / setAPIPreferenceCollect
>   On/Off（**"chnage-preferences" 原码 typo 逐字**）/ runAPIScript / getAllTags·getTags·
>   getRecentTags·getRecentTagsResult·getStarredTags·getTagGroups / getRecentFolders /
>   createFolder·renameFolder·updateFolder / addPath·addURLs / addItemFromPath·addItemFromPaths
>   （旧版 paths 分支 + v2 items 分支）/ moveItemsToTrash（ayncsImagesChange + hiddenByCurrentFilter
>   + calculateImageBinding→rebindRefresh(true)→updateSelection 闭环）/ addBookmarkItem /
>   addItemFromURL·addItemFromURLs / batchSave / updateItem / setCustomThumbnail（thumbnail-
>   generated 等待 10s 超时语义逐字）/ getItemInfo·getItemThumb / refreshItemPalette·
>   refreshItemThumbnail / listImages（SmartFolder 筛选复用 + 200 条上限 + IMPORT 排序）。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   handler（/item、/folder、/smart-folder）+ V2 外挂 `require(appRoot + '/app/js/api-server-v2')
>   .initAPIServerV2(APIServer)`（磁盘文件 b1 存活，原样 require）。**/api/check 混淆段（18852，
>   3924 字节）由脚本从 bundle 逐字节提取拼接**（仅 require→w.require / appRoot→w.appRoot 机械
>   替换 + @ts-ignore 抑制 strict——反篡改遥测注入路由，业务语义不动）。
> - **接装语义**：installApiServerGlobals（electronSettings/junk/IS_DIRECTORY/getRawPath/
>   getThumbnailPath/walk/getExt 支撑链 if-absent）+ installInitAPIServer（window.initAPIServer
>   if-absent——bundle 在世时其 23354 调用点走 bundle 版，b1 后走移植版；两世界共用
>   window.APIServer 赋值面）。**诊断契约 v2**：__eagleApiServerDomain.fns = 22 处理器直调面。
> - **m1 统一冒烟扩至 19 项**（A5 契约 + getAPIApplicationInfo 实调对照：version/platform/
>   preferences/showCollectModal 形状断言——移植版对活 scope 全链路验证）。验证：tsc 零错；
>   m1 19/19（DIAG-CONSOLE 空）。
> - **方法论修正（用户三次指出循环思考后定型）**：分片写入协议（骨架 Write ≤80 行 + 每片
>   Edit ≤200 行 + 哨兵锚点 APPEND:c10b-N）+ 依赖核查预算（每片一轮批量 grep）+ 「继续」
>   精确续传（首工具调用 = 既定写入）。c10b 九分片全程零循环回退。

> **c11 scope shim（2026-09-02；global/scopeShim.ts + getBodyScope 回退接线）**：
> - **激活判据核验**：angular.min.js **内联在 app.bundle.js 内**（14685 sourceMappingURL
>   佐证，无独立 script 标签）——`!window.angular` 即「bundle 已移除」的可靠判据。bundle
>   在世时 classic script 先于 React module 执行，w.angular 必然已定义，shim 分支不可达
>   （无启动窗口期误激活）；b1 移除 bundle 后自动激活并回填 window.$bodyScope。
> - **行为面**：属性 get/set 全量代理 coreState（c8 桥语义的直接化；machinery scope 替换
>   函数经 Proxy set 落 coreState 天然解析）；$evalAsync/$apply 直调 + watcher flush；
>   $watch/$watchCollection 函数型轮询（200ms + 深比较，startScopeSync 兼容语义，注销函数
>   返回）；$on/$broadcast/$emit shim 内事件总线（域处理器 $on 注册/misc $broadcast 路径）；
>   mousetrap 桩（强就绪门 b1 后放行）；$watchers=[]（sweep 幂等 no-op）；$root/$parent 自引用。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   恒等比较失败——A6 断言逼出）。bridgeWhenReady 对 shim 跳过 bridgeScopeFields（shim 已是
>   coreState 后端，重复桥接无意义）。
> - **b1 前置清单更新**：scope 函数面诚实缺口 = bundle 独占函数（relayout/filterContent/
>   zoom/enterDetailMode 等经 shim 调用将 TypeError）——b1 前必须完成各自 c 域移植（剩余
>   调用面见 c9 收口审计）。诊断契约：__eagleScopeShim.factory（A6 工厂直调验证）。
> - 验证：tsc 零错；m1 20/20（DIAG-CONSOLE 空）。suite 47/47（stage8e2 偶发失败单独复跑
>   通过）；api-smoke 裸跑失败为已知跑法问题（外联式跑法见 M1 验证条目）。

> **c12 eagle 成员反转挂载（2026-09-02；bundleGlobals installEagleMembers）**：
> - **表面勘察定论**：window.eagle 基座 = js/lib/eagle-api.js（独立 script 标签 b1 存活：
>   Eagle 基类 + utils.tree（TreeUtil.walk）+ urlEnlargerRemote）；bundle 挂载的成员 = 八个
>   类实例（inspector 249/filter 606/duplicateChecker 957/reverseImageSearch 1012/aiSearch
>   1844/customExport 1882/combineImages 1915/action 2048）+ runtime 占位（plugin {}/
>   app.*/containerSize/isDev）。**eagle.list/eagle.cool 高计数为 localStorage 键串误命中**
>   （"eagle.list.orderBy" 等），非对象成员——从接管面剔除。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   $scope.eagle（= bundle 实例），coreEagle 仅诊断契约（__eagleCoreEagle），今日零分叉。
> - **实现**：installEagleMembers if-absent——bundle 在世时成员已存在零改动；b1 后由 React
>   c2 全家桶（eagleClasses.ts 2071 行逐字移植）补齐八实例 + 三占位。诊断契约扩
>   eagleMembers 名单。
> - 验证：tsc 零错；m1 21/21（A7 eagleMembers 12 名齐备 + utils.tree.walk + filterRules
>   形状断言；DIAG-CONSOLE 空）。

> **c13 eg/InfiniteGrid 供给 + relayout（2026-09-02；bundleGlobals 懒执行 + dataMachinery）**：
> - **eg 基建勘察定论**：@egjs 全家（InfiniteGrid pkgd UMD + 内部 eg.Component webpack 模块）
>   = bundle 3497-8094 内联（无独立 vendor script），b1 死亡。**逐字节提取 142KB 副本** →
>   frontend/public/vendor/egjs-infinitegrid.umd.js；bundleGlobals if-absent 懒执行（fetch +
>   new Function sloppy 模式 this=globalThis，root=self 语义不变；bundle 在世时 w.eg 已存在
>   分支跳过——egLoaded 标志区分供给来源，b1 后才为 true）。
> - machineryRelayout（27329-27364 逐字）：JustifiedLayout/ListLayout/默认三分支 setLayout +
>   _renderer.updateSize + layout(true) + _watcher._onCheck + _updateContainerHeight；ig 经
>   window 解析（libraryDomain loaded 处理器创建）、box-size attr 逐字。scope 替换生效
>   （__eagleDataMachinery version 7）。
> - 验证：tsc 零错；m1 23/23（A8：eg.InfiniteGrid.JustifiedLayout/Gridlayout 在位 + relayout
>   machinery 标记；DIAG-CONSOLE 空）。

> **c14a 智能文件夹规则匹配域（2026-09-02；26 规则函数提取 + existInSmartFilter scope 替换）**：
> - **26 个 isMatch*Rule 函数 = bundle 8369-9418 顶层函数**（EagleController 外，window.*
>   live binding，b1 死亡）——**逐字节提取 56KB 副本** → frontend/public/vendor/eagle-match-
>   rules.js（区域内 require→w.require 两处机械替换）；if-absent **classic script 注入**（顶层
>   函数声明落 window 的语义与 bundle 一致；new Function 内声明不落 window，故不可用）。
>   含 intersect/cacheColorMappings 状态/colorSimilarityDistance/hexToRGB/rgbToHex 助手
>   （后两者为 React w.* 消费面，同批供给）。
> - machineryExistInSmartFilter（32091-32116 逐字：条件循环 + boolean FALSE 取反 + parent
>   递归链）+ machineryIsMatchCondition（32145-32175 逐字：AND 短路/OR 命中返回）+
>   MATCH_FUNCTION 表（32117-32143 逐字 26 属性映射，规则函数经 window 解析惰性建表）。
>   scope 替换生效（__eagleDataMachinery version 8）。
> - m1 A9 断言：规则函数在位 + **existInSmartFilter 实调**（name contain 真→假翻转 +
>   type equal 真）。验证：tsc 零错；m1 24/24（DIAG-CONSOLE 空）。suite ALL GREEN（c11/
>   c12/c13 收口验证，含 main-ui-workflow）。

> **c14b 筛选引擎（2026-09-02；filterData 850 行 + calcuteFilterResult scope 替换生效）**：
> - machineryFilterData（bundle 27654-28504 逐字三分片）：import 月份/时间梯度、mtime、
>   类型含排（video/url/youtube/vimeo/bilibili/audio/office/font 子判）、档案大小/长度单位、
>   BPM、解析度四向、标注/注释/网址有无+关键字、方向十分支（43/34/169/916/panoramic/custom）、
>   星等六档、字体激活态（installedFonts）、相机、colorFilter/grayColorFilter（scope 解析）+
>   colorDistancesMap 排序、searchFilter 关键字、trash orderBy/random shuffle（Array.prototype.
>   shuffle bundle 原型扩展保留）、preelaborations 预筛（OR/AND 分支）、tag 三逻辑（OR 补
>   tag.no 回填/AND/EQUAL 计数）、folder 三逻辑（NoFolders 特判）、lockedImages 过滤、
>   currentFolder/currentSmartFolder 排序覆盖 + reverse、以图找图 itemId/base64（AbortController
>   域内自管 imageSearchController/semanticSearchController）、语义搜索、recent 排序。
> - machineryCalcuteFilterResult（27634-27653 逐字）：contentFilterCache 分支 + raw.filter
>   (contentFilter)（contentFilter 仍由 bundle 承载经 scope 解析，c14c 移植）。**rebindRefresh
>   的 await s.calcuteFilterResult 即走移植实现**——m1 D 组 rebind-broadcast 全链路验证
>   （allDataIds 正确、DIAG-CONSOLE 空）。parseInt(number) 原码怪癖以 as any 保留。
> - m1 扩至 25 项（A10 筛选引擎契约 version≥9）。验证：tsc 零错；m1 25/25。

> **c14c contentFilter/calcuteContainTags/RecentFileManager（2026-09-02）**：
> - machineryContentFilter（31804-31896 逐字）：selectedSmartFolders/currentSmartFolder
>   （children+conditions 三分支）→ viewMode 七分支 switch（unfiled/untagged/recent/trash/
>   文件夹多选 isInFolder/单选/currentTag）；isInFolder 复用 controllerFns 移植版，
>   RecentFileManager 经 window 解析。
> - machineryCalcuteContainTags（$scope 包装 27155-27194 + 闭包 27196-27292 逐字）：
>   排除标签计数初始化、>200 字符截断守卫、AND 逻辑 index 修正、pinyin 经 TagManager、
>   imageCount 排序 + noTags 置零（eagle.filter.isLock 守卫）+ NoTags unshift（Filter.NoTags）。
> - buildRecentFileManager（52307-52390 逐字）：init/calOrders/isExists/addFile/addFiles
>   （≥20 截断）/clean/save（**w.throttle(1000, immediate)**——c10a-2 供给）；if-absent 接装
>   window.RecentFileManager（bundle 在世沿用其绑定）。
> - scope 替换生效（version 10：contentFilter/calcuteContainTags）。m1 25/25（DIAG-CONSOLE
>   空）。suite 两项已知竞争 flake 单独复跑通过（cm-overlay-close/main-ui-workflow）。

> **c15a updateSelection/zoom（2026-09-02；version 11）**：
> - machineryUpdateSelection（34662-34665 逐字：$broadcast("UPDATE_INSPECTOR")——React 域
>   9 处调用面 + bundle selectFolder/select 等改走本实现）、machineryZoom（31191-31204 逐字：
>   lastZoomMode edge→VIDEO_TYPES 分流 zoomFitEdge/zoomFit，默认 smartZoom——三目标经 scope
>   解析仍由 bundle 承载）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c14/c15 阶段收口（2026-09-02；suite ALL GREEN 47/47）**：
> - c14b（7719d38 filterData 850 行三分片 + calcuteFilterResult）、c14c（502ae89 contentFilter/
>   calcuteContainTags/RecentFileManager）、c15a（a8bd4b8 updateSelection/zoom）全量验证。
> - **11a2 回归甄别记录**：suite 三项失败（7d5b/7d6a/11a2）——前两项单独复跑通过（竞争
>   flake）；11a2 单独复跑稳定失败，经**整树级二分**（c13 全树亦失败）确认非代码回归：
>   bootStack 端口映射下无 41593 监听 → initial 健康检查置 localhostError=true → 侦测到
>   网路异常 toast（**正确应用行为**），c9-c15 启动时序变化使其由偶发渲染变为稳定渲染、
>   暴露 a2-initial-empty 的时序假设。探针实测 localhostError=true/errorList=0/toast 文本
>   佐证。修正 = 测试 boot 后显式清 localhost 环境源再断言组件响应性（376e8d3）。
>   **教训：环境型 toast（网络健康检查）与测试的「初始干净」假设存在内在竞态——修测试
>   假设而非抑制应用行为。**

> **c15b adjustLayoutWidth/zoomFit/saveListHeight（2026-09-02；version 12）**：
> - machinerySaveListHeight（33720-33742 逐字；150ms 防抖 + per-folder/tag/viewMode 九键
>   localStorage 逐字，saveListHeightTimeout 域内自管）。
> - machineryAdjustLayoutWidth（33839-33947 逐字）：GridLayout/SquareLayout 走 ig._layout.
>   _columnLength 列宽重算、其余按 imageSize 梯度步进（500/200 阈值）、MAX_LIST_WIDTH/75
>   夹取、margin===Infinity→10 怪癖逐字、relayout(margin) + scrollToCurrentItem（scope 解析）。
> - machineryZoomFit（33949-33985 逐字）：非详情模式 = 高度 150 + changeListHeight + 布局
>   分支回存；详情模式 mpv scaleMode=fit 分流 + lastZoomMode=fit 持久化（eagle.viewer.
>   lastZoomMode 键逐字）+ zoomRatio 100 + smartZoom(undefined, true)。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c15c getSelection/changeSidebarIndex/resetPage/calculateFilterCounts（2026-09-02；version 13）**：
> - machineryGetSelection（36632-36649 逐字：selected→allData 索引区间 + invert 判定）、
>   machineryChangeSidebarIndex（36656-36665 逐字：sidebarIndex -1→idx 1ms 双拍刷新）、
>   machineryResetPage（36668-36700 逐字：RESET_PAGE 广播 + ig.clear 40ms + mappings/选择
>   集清空 + layout localStorage 三级回退（eagle.list.layout.{rootDir} 键逐字）+ resetFilter/
>   findDupclipate 经 scope 解析 + duplicateTarget 守卫）、machineryCalculateFilterCounts
>   （42929-42944 逐字：500ms 防抖 + resetFilterCounts + updateFilterCounts 全量累计，timeout
>   域内自管）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c16b hover-preview 子系统字节提取（2026-09-03）**：
> - bundle 五顶层单元逐字节提取（17.3KB）→ frontend/public/vendor/eagle-hover-preview.js：
>   cleanupBoxHoverPreview（50414-50458）/ startHoverPreviewWatch（伴随单元）/ removePlayingAudios
>   （51042-51046）/ removeBoxAudioPlayer（51048-51088）/ HoverPreview（51689-52047 大对象：
>   positionMapping/getDelay/show/hide 等）。**依赖核查：无 bare 全局调用**——文件内互引同
>   script 解析，$bodyScope/FileUrlHelper/$ 经 window 调用时解析。
> - bundleGlobals if-absent script 注入（!w.HoverPreview 单条件；bundle 在世沿用其绑定，
>   egLoaded 同前例）——c16a 的 w.removePlayingAudios/w.HoverPreview.hide 与 machineryRebindRefresh
>   的 HoverPreview 消费面 b1 后有供给。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c16a enterDetailMode/leaveDetailMode（2026-09-03；version 15）**：
> - machineryEnterDetailMode（31587-31664 逐字）：opacity 清零 + inline 50ms/默认 100ms
>   分流、initDetailMode 首次 smoothZoom 装配（on_IMAGE_LOAD 内 orientationchange/lastZoom
>   守卫/zoom 调用/scrollBehaviorTour 首轮引导广播）vs 复用分支（updateNavigator + preload
>   next 200ms）、addToRecentFile + removePlayingAudios + HoverPreview.hide。zoomInitTimeout
>   域内自管。注释「移除 $scope.zoom(image) 原因」逐字保留。
> - machineryLeaveDetailMode（31680-31726 逐字）：rememberScrollTops/rememberVideoCurrentTime、
>   smoothZoom cleanBitmapViewer/clearPreloadData、gifViewer 五字段复位（gifUpadteInterval
>   原码 typo 逐字）、initMousetrap 重挂（**经 window 解析——initMousetrap 归键盘域后续片**，
>   b1 前须键盘域接管或提取）。
> - **post-b1 缺口登记**：removePlayingAudios/HoverPreview（51689 大对象）为 bundle 顶层——
>   归入「顶层对象字节提取批」后续片（同 match-rules 模式）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c15d openAll 及支撑链（2026-09-02；version 14）**：
> - machineryOpenAll（36702-36733 逐字）：all 视图短路、ScrollbarSaver.saveScrollPosition、
>   resetPage + 50ms 防抖重载（UrlStateService.setState（scope 解析——post-b1 Angular
>   $location 缺席为诚实缺口，随 c16 定 URL shim 方案）/ thumbSize.all 回读 / setLastFolder /
>   updateListHeight / restoreScrollPosition / reload / analytics.screenView）。openAllTimeout
>   域内自管。
> - buildScrollbarSaver（46754-46812 逐字；隐式全局 → if-absent 接装 window；positionMapping
>   状态 + getId 八分支 + save/restore（20-300ms 重试滚动窗逐字），$scope → getBodyScope()
>   调用时解析）。
> - setViewMode/setLastFolder（38475-38488 逐字；**_.debounce 实例模块级单例**——bundle
>   controller init 同语义，每次调用新建防抖为错误实现，评审修正）+ updateListHeight
>   （33712-33719 逐字 50ms）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c16c saveFolder（2026-09-03；version 16）**：
> - machinerySaveFolder（42399-42467 逐字）：unrom.nfc 日文濁音正規化（require(appRoot.path
>   + '/app/js/utils/unorm.js')）+ cloneTree 文件树克隆（c10a-2 供给）+ smartFolders 字段级
>   克隆（children/orderBy 守卫）+ TagManager.groups 标签组映射 + quickAccess 精简 +
>   IPCHelper.send('folders-change', {libraryDir 写死守卫})。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。notify（$rootScope.notify 20157）留 c16d。

> **c16c 修正：IPCHelper 词法绑定不可达（2026-09-03；suite 三项失败根因）**：
> - **症状**：7b/7c/7d1c2（tm-create-group-input/fp-closed/fsp-created-selected+nsm-closed）
>   稳定失败——三者均经 saveFolder 传递（标签组建组/筛选面板/文件夹选择面板的保存路径）。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   模块裸引也不可达（与顶层 var/function 的 window.* live binding 不同类）；c16c 初版
>   `w.IPCHelper.send` → undefined → TypeError → saveFolder 抛出。二分定位（c16a 版
>   dataMachinery 复跑通过）。
> - **修正**：IPCHelper.send 语义等价复刻（bundle 3473-3482：ipc 统一表达式 + electronLog
>   + try/catch 静默），三测复跑全过。**教训：w.* 访问模式必须核对该标识符是 var/function
>   （window.*）还是 const/let（脚本词法，不可达）**——IPCHelper/ACCESS/PERFORMANCE_MONITOR/
>   isVentura 等 declare const 消费面需逐个审计（libraryDomain 988 裸 IPCHelper 引用在其
>   try/catch 内静默失败风险，登记 c17 审计项）。

> **c16d 键盘域 buildMousetrap/destoryMousetrap/initMousetrap（2026-09-03；version 17）**：
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   （49326）为 **controller 闭包函数**（非顶层），c16a 的 leaveDetailMode w.* 访问不可达。
>   键盘域因此从 c17 提前到 c16d。
> - machineryBuildMousetrap（49177-49314 逐字）：player 九快捷键 handler 映射（gif speed
>   梯度/quicklook/prevGifFrame 等）+ preferences.shortcuts.keybinds 经 ShortcutManager.
>   electronToMousetrap 转换（vendor script b1 存活）+ 硬编码 55 键（toggleAllFolders/星级/
>   mod 系/方向系/enter=toggleDetailMode/del=removeSelected）+ mod+plus 特判。返回 bindings
>   映射由 mgo-mousetrap 指令消费（与 bundle 同语义）。
> - machineryDestoryMousetrap（49316-49325 逐字；destory typo 逐字）/ machineryInitMousetrap
>   （49326-49330 逐字：destory + s.mousetrap 重挂）。leaveDetailMode 改走
>   `w.initMousetrap ? w.initMousetrap() : machineryInitMousetrap(s)`（bundle 在世走 bundle
>   闭包版，b1 后走移植版——initMousetrap 非 window 可达，永远走移植版，条件仅防御）。
> - 验证：tsc 零错；m1 25/25；**main-ui-workflow 修复确认**（MAIN_WORKFLOW_SMOKE_OK）。

> **c17a 顶层词法 const/let 审计与接装（2026-09-03；bundleGlobals）**：
> - **审计定论**：IPCHelper（3471）/PERFORMANCE_MONITOR（18977 let）/ACCESS（19026）/isVentura
>   （19058）/ga4track（105491）全为 **const/let 脚本级词法绑定**——不上 window；React 侧
>   今日裸引可达**纯依赖 vite IIFE 形态共享全局词法**，b1 后 bundle 死亡即断（与顶层
>   var/function 的 window.* live binding 不同类，c16c 教训的推广审计）。
> - **bundleGlobals if-absent 接装**：IPCHelper {send,sendTo}（3471-3489 逐字语义：ipc 统一
>   表达式 + electronLog + try/catch 静默）/ PERFORMANCE_MONITOR {watchDigest,watchMemoryUsage}
>   （18977 逐字）/ ACCESS（19026 require my_modules/access）/ isVentura（19058 逐字：darwin
>   + os.release() ≥ 22）。ga4track 不接装（仅 try/catch 内 analytics 用途，b1 后静默降级
>   可接受，注释登记）。
> - **裸引转 w.***：libraryDomain（IPCHelper×2/PERFORMANCE_MONITOR×2/ACCESS 守卫改 optional
>   chaining/isVentura×1）、controllerFns（IPCHelper×4：cancel.all/palette-resume/folders-
>   change/upload-local-files）。
> - 验证：tsc 零错；m1 25/25；**suite ALL GREEN 47/47**。

> **c17b notify（cgNotify 等价移植；2026-09-03；version 18）**：
> - **cgNotify 服务解码**（bundle 16724 压缩全文）：模板 angular-notify.html（.cg-notify-message
>   + center/left/right 定位类 + $message 区 + .cg-notify-message-template 注入区 + .cg-notify-close
>   按钮）；restack i()（startTop 10/spacing 15/closing +20/top+margin-top 物化）；closeAll
>   （全栈 opacity 0）；duration 默认 10000；transitionend(opacity) → remove + 出栈 + restack；
>   center 时 $centerMargin = -offsetWidth/2。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   "{status}"></icon>` + undo 锚点 `notify.button.undo`）+ 服务核心等价复刻。**ng-* 以物化
>   DOM + 委托 click 复刻**（undo 锚点 data-cg-undo → closeAll + $rootScope.undo()；close
>   按钮 → $close 语义）。undoTimeout 域内自管（duration+5000 置空守卫逐字）。cgStack/cgScopes
>   域内自管（原闭包 m/n）。
> - 接装：root/body 双写（s.$root.notify = s.notify = notifyFn）——bundle $rootScope.notify
>   直调与 s.notify 原型链解析均走移植版。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c18a smartZoom/lastZoom（2026-09-03；version 19）**：
> - devicesMetrics 数据表（8245-8339，91 机型）**逐字节提取** + isMobileResolution/
>   getImagePixelDensity/isMobileWidth 移植（三者为 controller 闭包函数非顶层）→ frontend/
>   public/vendor/eagle-zoom-helpers.js（script 注入 if-absent，machinery 经 window 消费）。
> - machinerySmartZoom（31209-31334 逐字）：slideshow/inline/普通三容器尺寸分支、defaultRatio
>   auto 判定、竖长图（960×1.8/320×2.7）/常规 min(w,h)/@2x@3x@1.5x@0.5x 密度/机型分辨率/
>   375 宽长图五级智能缩放梯度、offsetY 修正、showLargeImage + smoothZoom focusTo。
>   machineryLastZoom（31288-31305 逐字：lastZoomMode edge 守卫 + rememberLastZoom=off 守卫
>   + lastItemStates goTo 恢复）。ratio 换算走 machinery 版 getRatioExp/NonExp。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c18b zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght（2026-09-03；version 20）**：
> - machineryZoomActual（33915-33937 逐字）：非详情=高度 150 回列表；详情=zoomRatio 100 +
>   updateZoomRatio(100,undefined,undefined,true) + mpv scaleMode=original/video 原尺寸
>   max-width/max-height !important + fit 类。machineryToggleZoom（33990-34012 逐字：视频/
>   图片双分支 edge↔fit 切换 + eagle.viewer.lastZoomMode 持久化）。machineryZoomFitEdge
>   （34015-34077 逐字：min(w,h) 撑满 + zoomFitSize=ratio + smoothZoom focusTo parseInt(ratio)）。
>   machineryUpdateContainerHieght（34078-34119 逐字；**typo 逐字保留**：eagle.filter.isOpen
>   分支的 padding-bottom/height/margin-top 三联 css）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c18c undo/nextHistory/prevHistory/back（2026-09-03；version 21）**：
> - machineryUndo（26999-27002 逐字：$rootScope.undo 桩调用 + closeAll——root 无 closeAll
>   时走 cg 栈清屏等价）、machineryNextHistory/machineryPrevHistory（38566-38577 逐字：
>   UrlStateService.canGo* 方法存在性判定 + currentWindow webContents goForward/goBack）、
>   machineryBack（30889-30896 逐字：isDetailMode 分流 leaveDetailMode/prevHistory）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c17c UrlStateService hash shim（2026-09-03；bundleGlobals if-absent）**：
> - 原实现 = Angular factory（js/services/url-state-service.js；$location.search 读写 +
>   $locationChangeStart preventDefault + $locationChangeSuccess 分发 + currentWindow 历史
>   探针）。b1 后 $location 死亡 → window.location.hash 直读写复刻（hash = '#!path?query'，
>   Angular 默认 hash 模式约定；getState 六字段含 page parseInt 与 folder/smartfolder 字符串
>   保留注释逐字；setState 合并 + null/undefined/'' 清除 + replace 用 history.replaceState；
>   isDetailMode 阻止变更 = preventDefault 语义；onChange = $locationChangeSuccess 分发）。
> - **b1 前置清单状态**：scope shim（c11）/ eagle 反转（c12）/ 全局供给（c10/c13/c14a/
>   c16b）/ 词法绑定（c17a）/ notify（c17b）/ UrlStateService（c17c）——machinery 41 函数
>   scope 替换（version 18）。**剩余已知 b1 缺口（登记，b1 执行前按本清单逐项核销）**：
>   bundle 独占 scope 函数残余调用面（smartZoom/zoomFitEdge/zoomActual/toggleZoom/
>   quicklook/selectAll/copyImages/undo/back/nextHistory/prevHistory/removeSelected 等
>   m1 收口审计清单成员——各为独立切片）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

- [ ] 移除 `js/vendors/angular*.js` 与 `app.bundle.js` 引用（index.html 尾部脚本区）。
> **c18d selectAll/toggleDetailMode（2026-09-03；version 22）**：
> - machinerySelectAll（46628-46645 逐字：alltags 视图 selectedTags 全置 vs allData 全选
    + selectedMappings 清空 + cleanSelectedTimeout 域内自管 + currentFocus=content）、
    machineryToggleDetailMode（31005-31029 逐字：swal 守卫 + isCropMode→saveCrop + 
    isInline/isCommentMode 联动 + currentFocus sidebar/tags→renameCurrentFolder + 文件夹
    选择→openFolder + 详情↔列表切换）。
> - 验证：tsc 零错；m1 25/25（DIAG-CONSOLE 空）。

> **c18a-fix zoom 助手注入守卫修正（2026-09-03；bundleGlobals，无 version 变更）**：
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   （detail original delivery timeout）；探针证实详情已开但 #bitmap-viewer 无 canvas、
>   tileCount=0、releasedAt 恒 0（释放走 canvas 路径：bitmapWorker 瓦片 → 3 帧稳定签名）。
> - 定位：全提交状态回放二分（c17c 通过 / c18a 起失败）锁定 c18a；探针对比 c17c
>   （canvas 798×752 含真实像素、tileCount=2）与失败态（NO-CANVAS）。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   devicesMetrics 是 bundle **顶层 var**（天然上 window），守卫永真短路注入；而 vendor
>   文件真正载荷是三个 controller 闭包助手（isMobileResolution/getImagePixelDensity/
>   isMobileWidth，不上 window）→ machinerySmartZoom 在 defaultRatio=auto 分支
>   `w.getImagePixelDensity` 处 TypeError（被 $exceptionHandler 吞掉，window.onerror 不触发）
>   → on_IMAGE_LOAD 链 updateNavigator → bitmapViewer.loadURL 不再执行 → worker 不启动
>   → 无瓦片无 canvas → 释放门超时。**教训：if-absent 守卫必须查真正消费的载荷标识符，
>   不能查相关联的全局名。**
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
>   vendor 文件重声明 `var devicesMetrics` 与 bundle 顶层 var 数据逐字节等同（仅行尾差异），
>   bundle 在世时注入为惰性覆盖；b1 后由 vendor 独立供给。
> - 验证：tsc 零错；探针 helpers function×3 + zoomHelpersLoaded=true + mode:"canvas"
>   releasedAt 置位；stage5 / main-ui-workflow 单独复跑 OK；m1 25/25；全量 suite ALL GREEN。

> **c18e-2 multipleSelect 四件套 + removeSelected（2026-09-03；version 25）**：
> - machineryMultipleSelectUp/Down（35898/35964 逐字：isCropMode→MOVE-CROP-TOOL 垂直广播 +
>   ListLayout 委派 Prev/Next）、machineryMultipleSelectNext/Prev（36559/36586 逐字：sidebar
>   焦点守卫 + 详情模式跳过 + lastSelectedIndex 收缩/扩展选区 + autoScroll 经 scope）。
>   machineryRemoveSelected（46119-46343 逐字：sidebar/tags/alltags/文件夹选择/列表五路分流，
>   trash swal 永久删除确认（removePermanently）、checkOperationSafety(callback,200) 包装、
>   多分类文件夹 swal radio（lastMoveToTrashCheckbox 域内自管 46118）、currentFolder 分支
>   resetFolderCover+removeFolderContents、其余视图分支 isDeleted/notify undo/自动选下一张/
>   gl:removeItems 广播/updateSelection/electronLog 双分支）。TagManager 经 scope 字段（48351）、
>   getFilter() 复刻 $filter('i18n')、swal/i18n/ScrollbarSaver/ayncsImagesChange/
>   hiddenByCurrentFilter/electronLog 经 window。
> - 验证：tsc 零错；m1 25/25。

> **c18e-3 quicklook/copyImages（2026-09-03；version 26）**：
> - machineryQuicklook（33542-33580 逐字：swal 容器守卫 + isCropMode 守卫 + gif 详情分支
>   toggleGifPlay + keyspace 三设定分流（preview→inline-mode/open 类 + toggleDetailMode(event,
>   true) + analytics.event / preview-native→darwin isPreviewing + IPCHelper.send('quicklook')
>   / 默认→pageDownHandler）。toggleGifPlay/toggleDetailMode/pageDownHandler 经 scope 解析；
>   IPCHelper 脚本级词法绑定（c17a 接装）经 window；analytics 顶层 var（105501）/process 经 window。
>   machineryCopyImages（31747-31795 逐字：alltags 标签复制 + sidebar 文件夹/smart 文件夹复制
>   + 选中项 sendTo(backgroundWindowID,'copy-images') + RecentFileManager.addFiles + notify）。
>   clipboard 为 bundle 19019 `const { clipboard } = electron` 脚本级词法绑定 →
>   **w.electron.clipboard**（同对象；controllerFns 裸引靠 @ts-nocheck，machinery 无此豁免）。
> - 教训登记：**tsc 退出码曾被 tail 管道吃掉（tail 恒 0），以重定向后 echo $? 为准**。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **c18e-4 方向键/修饰键 handler 族·第一批（2026-09-03；version 27）**：
> - machineryKeyCHandler/keyPHandler（35099-35106 逐字：详情内 toggleCommentMode /
>   openPluginPanel）、machineryKeyLeftHandler/keyRightHandler（35107-35189 逐字：swal 容器
>   守卫 + content→selectPrev/Next（machinery 版）+ tags↔sidebar 焦点迁移 + sidebar 多选
>   折叠/展开与单选展开-折叠分叉 + alltags→tags，localStorage 键逐字）。
>   machineryModUp/Down/Left/RightHandler + modShiftUp/Down/Left/RightHandler（35343-35438
>   逐字：crop 模式 RESIZE-CROP-TOOL 广播（mod=1/shift=10 梯度），mod 上/下非详情委派
>   homeHandler/endHandler（scope 函数 35636/35650）、mod 左/右非详情委派 prevHistory/
>   nextHistory（machinery 版））。
> - 依赖经 scope 解析：toggleCommentMode/openPluginPanel/selectPrev/Next/prevHistory/
>   nextHistory/homeHandler/endHandler/updateSidebarList。零闭包依赖。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **c18e-5 keyUp/keyDown handler 族（2026-09-03；version 28）**：
> - machineryKeyUpHandler（35191-35285 逐字）/ machineryKeyDownHandler（35440-35610 逐字）：
>   content→crop 广播/moveY ±150/selectUp/Down（scope 解析）；sidebar 清空选择后按 viewMode
>   七级回落（Up 向 unfiled/untagged 方向回落且 all 分支为空体、Down 向 random/community 方向
>   回落且 alltags→openTrash、trash→quickAccess→smartFolders→folders——两侧顺序不同，逐字
>   保留）+ currentId 三分（Up 含 currentId 真值守卫、Down 无——bundle 原样）+ tags→Group 导航。
> - 闭包域内移植（非 scope 成员）：openPrevQuickAccess（35287）/openNextQuickAccess（35304）/
>   openPrevGroup（35704）/openNextGroup（35730）——machinery 内部函数，不上 scope/契约。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **c18e-6 selectUp/Down + pageUp/pageDownHandler（2026-09-03；version 29）**：
> - machinerySelectUp（35840-35906 逐字：GridLayout 同列最近上方盒 / 其他布局上方 20px 外
>   最近距离盒，selected 首盒锚点）+ machinerySelectDown（35908-35962 逐字：getArroundBox(end)
>   邻域 + 末盒锚点；**autoScroll(target) 传元素非索引——bundle 怪癖逐字保留**）。
>   getItemByElement 经 scope 解析。
> - machineryGetArroundBox（35091 闭包）+ scrollbarTo（35612 闭包）+ Math.easeInOutQuad
>   （35638，全局 Math 同体幂等补丁）+ machineryPageDownHandler/PageUpHandler（35680-35702
>   逐字）——_.throttle(100,true) 实例 **apply 时一次性创建**（与 bundle controller init 同
>   语义，s.pageDownHandler = machineryPageDownHandler(s)），pageUp 含 ig.trigger("prepend")
>   prepend 触发面。
> - 教训：jQuery 回调 `function (index)` 内用 `$(this)` 需 `function (this: any, index: any)` 注解（noImplicitThis）。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **c18f-1 小 handler 批（2026-09-03；version 30）**：
> - machineryChangeTo5Star（30316 逐字：alt/meta/ctrl 守卫 + changeStar(5,true,true) 经
>   scope）、machineryCloseWindowHandler（30802 逐字：**bundle 原版怪癖——参数 $event 但体内
>   引用全局 event，ESM 以 w.event 复刻**；darwin isPreviewing → IPCHelper quicklook 反发）、
>   machineryNHandler/mHandler（30813/30825 逐字：详情内视频评论/静音，VIDEO_TYPES/AUDIO_TYPES
>   经 window TYPES 契约）、machineryToggleAll（30968 逐字：eagle.inspector.isHideInspector
>   双写 + lastItemStates 清空 + orientationchange + boxContianerWidth/Height 快照 + relayout/
>   offsetScrollbar + **zoomFitEdge(w.event) 复刻裸 event 怪癖**（$timeout 期 window.event 为
>   null）+ isHideSidebar localStorage 键逐字 + electronLog 双分支）、machineryZoomIn/Out
>   （33883/33899 逐字：非详情 adjustLayoutWidth ±1 + machinerySaveListHeight 直调 + 详情
>   5 步进 ratioExp 梯度封顶 800 + updateZoomRatio machinery 版；Out 多一步
>   checkListItemsLessThanContainer scope 解析）、machinerySaveHandler（35985 逐字）、
>   machineryRefreshRandom（42824 逐字：random/RANDOM 守卫 + shuffle 清空 + active 闪烁 +
>   reload machinery 版）。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **c18f-2 openParentFolder/createTxtFileFromTemplate/setFolderCover（2026-09-03；
version 31）**：
> - machineryOpenParentFolder（38384-38388 逐字：parent 解析 + openFolder scope 解析）、
>   machineryCreateTxtFileFromTemplate（37329-37334 逐字：newFileFromTemplate("txt") scope
>   解析——文件创建域后续独立切片）、machinerySetFolderCover（41438-41454 逐字：coverId +
>   covers[0] sub-folder-cover 模板（aspect-ratio 内联）+ getFilter() 复刻 notify.folder.
>   setAsCover + notify/saveFolder machinery 版）。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **c18f-3 inspector 面板/快捷搜索打开器（2026-09-03；version 32）**：
> - machineryOpenQuickSearch（32512 逐字：OPEN_QUICK_SEARCH_MODAL 广播）、
>   machineryOpenActionsPanel（43279 逐字：eagle.action.open(selected) 经 window）、
>   machineryOpenInspectorTagSelectPanel（43283 逐字：selected 守卫 +
>   INSPECTOR.TAG.SELECT.PANEL.OPEN 广播；54887 系同名函数为其他 controller 的 $bodyScope
>   委派壳，非 body scope 生效版）、machineryOpenInspectorFolderSelectPanel（43288-43448 逐字：
>   eagle.inspector.calculateFolders 初选集 → FolderSelectPanel.open（folders/selectedIds/
>   onChanged）→ onChanged 内 checkOperationSafety 包装：selected/deselected 分拣 +
>   addToRecentFolders + origin 四联快照（angular.copy）+ eagle.utils.tree.walk 添加/删除双
>   分支（extendTags 传染、当前文件夹 ig.remove + imagesMappings、updateFilterCounts）+
>   ayncsImagesChange/hiddenByCurrentFilter + unfiled 分支 gl:removeItems +
>   calculateImageBinding/rebindRefresh/updateSelection（$bodyScope.* 逐字）+ i18n 单复数两
>   形态（复数 getFilter()、单数逐字 angular.element.injector 链）+ notify undo 四字段回滚 +
>   analytics 'File','Categorize','QuickCategorize'）。
> - **FolderSelectPanel 为 bundle 顶层 class（55801，词法绑定不上 window）→ 直连 React 移植版
>   selectPanelEngine 的 static open**（同 rootScope $broadcast('FOLDER.SELECT.PANEL.OPEN')
>   语义，bundle 在世/缺席双期兼容；无循环导入）。
> - 至此 buildMousetrap 硬编码绑定面 41 键全部 machinery 供给（preferences 绑定面经
>   shortcutHandlerMap 全覆盖：quicklook machinery 版、gif 帧函数经 scope 解析归媒体域切片）。
> - 验证：tsc 零错（真实退出码）；m1 25/25；**全量 suite ALL GREEN（45/45，machinery v32
>   键盘面里程碑）**。

> **c18g-1 getItemByElement/changeStar/gif 帧步进/addVideoComment/newFileFromTemplate
（2026-09-03；version 33）**：
> - machineryGetItemByElement（21834 逐字：data-box-id → itemMappings，旧实现注释逐字保留）、
>   machineryChangeStar（30320-30381 逐字：刪除/设置星星双分支 filterCounts rating 增减 +
>   eagle.inspector.star + analytics + updateItemsView machinery版）、machineryNextGifFrame/
>   PrevGifFrame（32838/32851 逐字：**next 上界 total-1、prev 下界 0——bundle 原样**；gifPlayer/
>   gifViewer scope 解析）、machineryAddVideoComment（21182-21237 逐字：swal textarea → guid
>   → duration 升序插入 → REFRESH_VIDEO_COMMENTS 广播 + ipc 统一表达式 image-change）、
>   machineryNewFileFromTemplate（37336-37374 逐字：resourcesPath/EAGLE_THUMBNAIL_TEMP_PATH
>   顶层 var 经 window、fs/path 经 window.require、uploadFiles/showUploadQueue scope 解析）。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-2 视图开启器族（2026-09-03；version 34）**：
> - machineryOpenRandom/openUnfiled/openUntagged/openRecent/openTrash（36740-36996 逐字：
>   同视图+有色规则早退、ScrollbarSaver 存取（**random 无存取面、openRandom callback 参数与
>   leaveDetailMode 早退分支——bundle 原样**）、五 timeout 域内自管、50ms timeout 内
>   UrlStateService.setState + 专用 thumbSize localStorage 键 + setLastFolder/updateListHeight
>   直调 machinery 版 + reload + analytics.screenView）、machineryOpenCommunity（36866 逐字：
>   images 清空 + lng2locale 三语映射 + OPEN_URL_IN_PANEL 广播 + $bodyScope.leaveDetailMode
>   逐字）、machineryOpenAllTags（36889 逐字：无 imageSize/reload 面 + TagManager.renderTagsResult
>   50ms 延迟）。缺口 90 → 83。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-3 侧栏 prev/next 导航四向（2026-09-03；version 35）**：
> - machineryOpenNextFolder/openPrevFolder（35689/35806 逐字：folder ±1；Prev 越界回落
>   smartFolders 末项 → quickAccess 末项 → openTrash（machinery 版））、
>   machineryOpenNextSmartFolder/openPrevSmartFolder（35755/35775 逐字：smartFolderGroup
>   含内 ±1；Next 越界回落 folders 首项、Prev 越界按 preferences.sidebar.quickAccess 门控）。
>   openFolder/openSmartFolder 经 scope 解析（fns 桥覆盖）。缺口 83 → 79。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-4a 滚动/列表辅助族第一批（2026-09-03；version 36）**：
> - machineryAutoScroll（35086 逐字 AutoScroll 广播——**54389 系 $bodyScope 委派壳属子
>   scope controller（changeStar 委派若在 body 会自递归可证），body 生效版即本闭包**）、
>   machineryCurrentIndex/getSelectedItems/getSelectedItemElements/getSelectedTags/
>   getQuickAccessList（21852/21864/28993/38865/42634 逐字，旧注释保留）、
>   machineryCheckListItemsLessThanContainer（33658 逐字：<180 时 500ms ig.append 双页）、
>   machineryUpdateSubFolderWidth（33676 逐字：列宽 5 取整 90 下限 MAX_LIST_WIDTH 封顶）、
>   machineryUpdateSliderPosition（33689 函数体全注释 no-op 原样）、machineryChangeListHeight
>   （33746 逐字：lastImageHeight + 500ms thumbSize 九分支键 + relayout +
>   scrollToCurrentItem）、machineryScrollToCurrentItem（34118 逐字 posy 居中）、
>   machineryForceFitImageSize（36481 逐字：detail-image 尺寸直设 + animated/orientation
>   → getRawUrl 否则 thumbnail）。缺口 79 → 68。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-4b sortData/offsetScrollbar/updateFilterCounts（2026-09-03；version 37）**：
> - **Array.prototype.shuffle（bundle 2594 逐字）machinery 同体幂等补丁**——global.js 不在
>   index.html，b1 后原型扩展随 bundle 死亡，RANDOM 排序依赖它。
>   machinerySortData（21710-21833 逐字：NAME/EXT/RESOLUTION/FILESIZE/RATING/DURATION/
>   MANUAL/BTIME/MTIME/RANDOM/TAGS/default 十一路；collator 三处 var 撞名预防性改名
>   collator2/3——c18a mr/mr2 先例；languageBCP 经 window）、machineryOffsetScrollbarImm +
>   machineryOffsetScrollbar（34140/34168 逐字：_.debounce(100,leading) apply 时一次性
>   创建；Imm 内 selected 居中/无选中防越界双分支 + updateContainerHieght scope 解析）、
>   machineryUpdateFilterCounts（42946-43040 逐字：type/camera/fontActivated/star/shape
>   五面计数，try 静默）。
> - 教训重申：b1-4a 曾漏 updateFilterCounts 接线（契约有赋值无）——**wire 与 contract 必须
>   同批核对**。缺口 68 → 65。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-5 记忆/预载族（2026-09-03；version 38）**：
> - machineryRememberScrollTops（31142 逐字：inline/edge 跳过 + smoothZoom getChangedData
>   快照）、machineryRememberVideoCurrentTime（31726 逐字：getVideoPlayer 闭包域内移植
>   36159 mpv 优先 + eagle.videoPlayer.currentTime.{id} 键）、machineryAddToRecentFile
>   （36435 逐字：1s 换人守卫 + RecentFileManager window 版）、machineryPreloadImage
>   （36449 逐字：**supportFoamts typo 逐字保留** + currentIndex 直调 + next/prev idx-2
>   + smoothZoom preload 100ms）。缺口 65 → 61。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-5b homeHandler/endHandler（2026-09-03；version 39）**：
> - machineryHomeHandler/machineryEndHandler（35636/35650 逐字：详情 goToY 40 /
>   goToY -99999999 + moveY -outerHeight+60（zooming 类 300ms 护栏，**复用 c9d
>   updateZoomRatioTimeout 域内变量**——bundle 同名闭包）+ 列表 gotoTop/gotoBottom
>   （fns 桥覆盖经 scope 解析））。缺口 61 → 59。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-6a 删除族第一批（2026-09-03；version 40）**：
> - machineryCheckOperationSafety/2（26789/26823 逐字：selected/count ≥ amount 时
>   Dialog.BulkAction 确认框，否则/catch 直通 callback——removeSelected/removeFolder 系
>   的公共安全门）、machineryResetFolderCover（41454 逐字：getAncestorFolders c9b 直调）、
>   machineryRemovePermanently（37074 逐字：trash 限定 + raw splice + ayncsImagesRemove
>   （49709 顶层 function 经 window）+ gl:removeItems）。
> - **rename 域（renameCurrentFolder/renameImages/enableImageNameEditable 及其级联闭包
>   exitEditable/remainingFilenameLength/sanitize/emojiRegex）另切 b1-8**——链式依赖太深
>   不宜混入删除族。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-6b 删除族第二批（2026-09-03；version 41）**：
> - machineryRemoveSmartFolder wrapper+Inner（41831/41851 逐字：100ms 确认框 → children
>   定位/splice/mappings 删除/QuickAccessManager.remove（19061 顶层 var 经 window）→
>   idx===0 双分支续开 → 音效/updateSidebarList/saveFolderDebounce 1s → notify undo
>   origin 回填+树重索引）、machineryRemoveFolder wrapper+Inner（41935/42061 逐字：密码锁
>   守卫 → checkbox 确认（isDeleteImages）→ checkOperationSafety2(descendantImageCount,50)
>   → cloneTree 存档 → raw 逆序摘索引（仅存一夹才 isDeleted）→ 子树同摘 → 续开兄弟/父/All
>   → QuickAccessManager 含子树 → notify undo（folders 回填+重索引+图像 folders 去重复原））、
>   machineryRemoveSelectedFolders/SelectedSmartFolders（41981/42021 逐字：多选确认 +
>   ignoreRestore 直调 Inner + 清多选）。
> - 教训：**单条 heredoc 体积超限会被 bash 截断**（第二片首写失败）——大函数必须哨兵分片。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-6c removeFolderContents（2026-09-03；version 42）**：
> - machineryRemoveFolderContents（46345-46457 逐字：isForceToTrash 分流（多夹图仅摘索引
>   vs isDeleted+deletedTime）+ 父夹/子夹 imagesMappings 同步 + 音效 + notify undo
>   （isDeleted/folders 回滚 + calculateImageBinding/ScrollbarSaver）+ 自动选下一张（next/
>   prev/空三档）+ gl:removeItems + RANDOM 视图跳过 rebindRefresh 空体分支 + electronLog
>   双分支；updateFilterCounts/autoScroll/forceFitImageSize/ScrollbarSaver 全 machinery 直调）。
> - **删除族 b1-6a/b/c 三片收口：machineryRemoveSelected 的全部下游（checkOperationSafety
>   双件/removeFolder 双层/removeSmartFolder 双层/多选删除/Contents 清空）全部 machinery 供给，
>   trash 永久删除链闭环**。缺口 59 → 55。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-7a 小件批（2026-09-03；version 43）**：
> - machineryToggleCommentMode（21166 逐字）、machineryFadeOutDetailMode（31672 逐字
>   popdown）、machineryOpenPluginPanel（37324 逐字广播）、machinerySaveFolderDebounce
>   （42390 逐字 isLibrarySaving + 1s 防抖，timeout 存 scope 字段）、标签群组四向
>   （48363-48416 逐字：ALL/UNFILED/STARRED 同构 + GROUP 向 blur/早退序——bundle 原样；
>   tagRectSelecting 域内自管）、machineryRemoveTagGroup（48620 逐字：确认框 + removeGroup
>   兄弟/前项续开）。
> - **审计误报修正：toggleVideoPlay 仅存在于注释**（bundle 本就无定义）——审计脚本需剥
>   注释后再匹配。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-7b 幻灯片/锁屏/调色板/布局/过滤入口/多开（2026-09-03；version 44）**：
> - machineryEnterSlideshowMode/leaveSlideshowMode（23824/23841 逐字：**!selected.length === 0
>   双重否定怪癖**（实际空选才能进入）+ setFullScreen(false) 双写——均 as any/原样保留）+
>   machineryRgbToHex（28976）、machineryLockApp/focusAppUnlockPassword（29016/29025）、
>   machineryPausePalette/resumePalette（37201/37207，change-palette-pause 通道 typo 原样）、
>   machinerySaveLayout（37280 localStorage bracket 原样）、machineryCancelCrop（36091）、
>   machineryOpenFilter（30173）+ FILTER_ID_MAP 模块常量（19 类型映射逐字）+
>   machineryToggleFilterByType（_.throttle(300) apply 时创建 + eagle.aiSearch 守卫）、
>   machineryGetChildFoldersMaps/Map（31890/31901 闭包域内移植）+
>   machineryMultipleOpenFolder（38128 逐字多选态切换）。
> - **发现 fns 表裸引用隐患**：controllerFns.ts 944/3099 裸引 getChildFoldersMaps/Map
>   （bundle 闭包，ESM 不可达）——@ts-nocheck 掩盖，运行时若走该路径即崩。**fns 表裸引用
>   审计列入 b1 终审清单**（machineryGetChildFoldersMaps/Map 已可作为后备）。
> - gotoTop/gotoBottom 与 resetNgGridLayoutData（ngGridLayout 指令隐式全局 66970）耦合
>   React boxGridEngine——归 grid 域切片。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-7c 展开族/重复图/排序/搜索全览（2026-09-03；version 45）**：
> - machineryExpandFolder/expandSmartFolder（38054/38061 逐字）、machinerySearchInAll
>   （29201 逐字，focusSeach typo 原样）、machineryIsDuplicateImage/addToDuplicateMapping/
>   removeFromDuplicateMapping（30572/30585/30591 逐字：svg/tif/tiff 排除 + getHashID +
>   垃圾桶排除）、machineryOpenDuplicate（36944 逐字三档广播）、toggle 三件套（38786/38793/
>   38803 逐字）+ 两个内嵌闭包域内移植（toggleCurrentLevelSmartFoldersInner/toggleAllSmartFolders
>   Inner——localStorage 键逐字）、machinerySetFolderOrder/setSmartFolderOrder（41360/41404
>   逐字）、machineryUpdateTxtItem（34478 逐字：**selected.length === 0 && selected[0] ===
>   item 矛盾守卫原样——实际恒 false**）。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-7d-1 外部站点/教程/试用/多开/重命名入口/TouchID（2026-09-03；version 46）**：
> - machineryOpenPinterest（26859 三语逐字）/openHuaban/openArtstation（shell 经
>   w.electron.shell——与 bundle 19019 解构同源）、machineryQuickOpenFolder（44900 逐字：
>   ignoreReload 分流 + 60/页倒序定位 + 藏容器 reload 500ms select/autoScroll/显容器）、
>   machineryMultipleOpenSmartFolder（与 Folder 版对称）、machineryRenameFolder/
>   renameSmartFolder（editable + 双 100/200ms focus——bundle 原样双写）、
>   machineryShowTutorial（themePath filter + 四语文档跳转）、machineryOpenTrialModal
>   （ipc 统一表达式）、machineryUnlockFolderWithTouchID（async；**remote 为 bundle 19020
>   词法绑定 → window.require('@electron/remote') 惰性取**——nodeIntegration 两期可达；
>   shake 动画/焦点回框逐字）。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-7d-2 侧栏树渲染核心（2026-09-03；version 47）**：
> - machineryGetSmartFolderList/getFolderList（42644-42823 逐字：tree.walk 全树 guidelines
>   色谱继承 + 首尾位标注 + isVisible 三态（folder 版密码夹 isUnLock 门控）+ 根层/过滤期/
>   父可见三档入列；Smart 版额外维护 smartFolderList/smartFolderMappings 登记与 parent
>   指针（;;双分号原样）；Folder 版无登记面——bundle 原样）。updateSidebarList（machinery
>   版）的两大依赖就此闭环。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-7d-3 列表滑条/元信息/移入文件夹/上传队列/链接导入/截屏（2026-09-03；version 48）**：
> - machineryUpdateListSlider（31350 **空函数体 no-op 原样**）、machineryChangeMetaItems
>   （37273 逐字）、machineryMoveToFolders（43242 逐字广播）、calcuteAddImageTimeLeft 域内
>   闭包 + machineryShowUploadQueue/hideUploadQueue（45313/45343 逐字 1s 轮询）、
>   machineryImportLinks（26906-26994 逐字：剪贴板预读 + textarea 校验 swal + 逐链 HEAD
>   探测分流 upload-url/url-from-extension + guid）、machineryVideoScreenShot（33233-33288
>   逐字 async：mpv screenshot API / native drawImage 双路 + copyMode 剪贴板或扩展上送）。
> - **is.min.js 为孤儿文件**（index.html 14 个 script 均无它）——bundle 自身 is.url/is.number
>   同样潜在 ReferenceError；移植版以 w.is 镜像同语义并登记 b1 清理轮处置。
> - 转义教训累积：**heredoc 内 
 经多层转义必坏——凡字符串含 
 的一律事后 chr(92) 补丁或
>   Edit 工具直改**（本轮 split/join/reject 三处均如此修复）；getContext 严格空值用 `!`。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-7e 全局查重/子文件夹列表/滚顶滚底/杂项小件（2026-09-03；version 49）**：
> - machineryGetFolderImages（42841-42865 逐字：倒序 raw 扫描 + includeSubFolder tree.walk
>   子树命中）、machineryFindDupclipate（28507-28868 逐字，typo 唯一：查重主表 +
>   filterExtensions/filterCameras 建表副产物 + duplicateGroupings 主动扫描（hasColorInfo 才
>   分组、>1 才成组）；getHashID 为 bundle 2127 **顶层函数** w.* 直连双参；二段循环 var 同名
>   → *2 后缀）。
> - machineryGetAllChildFolder（42498 闭包域内移植）+ machineryRefreshSubfolderList
>   （27462 逐字：keyword 过滤**无 return 隐式剔除**怪癖原样）；**subFolderSortableOptions
>   种子**（38947 controller init 逐字 if-absent 补种进 applyDataMachineryScope——写方
>   refreshSubfolderList 开关 .disabled、ListRegion ui-sortable 消费原对象含 update 回调，
>   $timeout 经 injector getTimeout（缺 Angular 时跳过——post-b1 sortable 保存侧效待 shim
>   $timeout，登记））。
> - machineryFocusSeach（29192 typo 原样）、machineryNewSmartFolder（39944 $rootScope.
>   $broadcast → s.$root 同体）、machineryPrependFolder（39968 1s 后 binding→saveFolder）、
>   machineryGotoTop/gotoBottom（21886/21900 逐字：resetNgGridLayoutData 隐式全局 w.* 直连
>   同 764/944 先例，**post-b1 由 grid 域供给**；gotoBottom 死变量 offset 原样）。
> - **updateWindowProgressBar 定性纠正**：bundle 49810 为**顶层 var throttle 单例**（非闭包
>   ——旧注释误判）→ w.updateWindowProgressBar 直连保留原节流实例（hideUploadQueue 调用点
>   s.→w.）。
> - **gotoBottom 供给面澄清**：fns 表 2095 已有全量移植体（裸引 resetNgGridLayoutData 经
>   window 解析可达）——本次仍补 machinery 版统一契约；b1-8 fns 裸引用审计将该处登记为
>   "window 可达隐式全局"类（post-b1 依赖 grid 域）。
> - 审计脚本七域自扫版：内部缺口 11 → 4（$apply/$broadcast/$evalAsync 为 shim API 误报、
>   renameCurrentFolder 留 b1-8）。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-8 rename 域 + fns 表裸引用审计·内部缺口清零（2026-09-03；version 50）**：
> - **rename 域**：machineryRenameCurrentFolder（41498-41569 逐字：图片/详情 inspector-name/
>   子文件夹（jQuery.Event 合成）/侧栏文件夹（batch/renameFolder）/智能文件夹/标签（单
>   editTag/多 OPEN_RENAME/空 renameTagGroup 50ms $timeout 经 getTimeout）五路分流路由）+
>   扇出六件——machineryRenameImages（41480 逐字：**裸 event → w.event**）、
>   machineryEnableImageNameEditable（21975-22075 逐字：blur debounce **w.debounce**（bundle
>   80222 顶层 var）200 immediate；blur 内 angular.element("body").scope() → getBodyScope()
>   同双轨解析；ayncsImagesChange/hiddenByCurrentFilter（bundle 顶层函数 49667/49600）w.*
>   直连；eagle.inspector.newName）、machineryEnableSubFolderNameEditable（22077-22175 逐字：
>   ESC 还原**无 span 包裹**差异原样 + selectFolder 经 scope）、batchRename×2（41631/41654）、
>   machineryRenameTagGroup（48582 双 100/200ms 双写）、machineryEditTag（45532-45700 逐字：
>   swal + raw 倒序 tags 替换 + TagManager 群组/historyTags + **45615
>   angular.copy(originHistoryTags) 自复制 undefined 怪癖原样** + folders/smartFolders.conditions
>   树替换 + $filter('i18n') 经 getFilter + $rootScope.notify → s.$root.notify）+
>   machinerySelectFolder（34666）。模块级 **emojiRegex（19014 字面，g 标志 lastIndex 跨调用
>   共享与 bundle 顶层单例同语义）** + remainingFilenameLength/sanitize 惰性 require 缓存
>   （19018 用 appRoot.path；**22746 sanitize 无 .path 后缀——bundle 原样差异保留**）。
> - **内部审计清零**：七域 s.* 调用面 147→155 名，硬缺口 **0**（$apply/$broadcast/$evalAsync
>   为 shim API 成员）。
> - **fns 表裸引用审计**（调用位裸标识符全量清点，tests-tmp/fns-bare-audit.py）：controller
>   闭包类修复——getAncestorFolders×6 → s.getAncestorFolders；getExtendTags/getChildFoldersMaps/
>   getChildFoldersMap/setViewMode（machinery 版已有）+ getVideoPlayer/getFolderParentChilder/
>   calcRotateDegree/getArroundBox/getAncestorSmartFolders/toggleAllFolders/toggleAllSmartFolders
>   （machinery 版已有或本轮新增 42783/40842/36170/42527/38730 逐字）——**非碰撞面接装 +
>   controllerFns 经 ESM 循环 import 直调（双侧函数声明提升、无顶层执行面，运行时安全）**；
>   **calcuteContainFolders（27283 闭包版与 27259 $scope 版不同体）/toggleCurrentLevel{Folders,
>   SmartFolders} 与 bundle $scope 同名——不可接装，仅直调**；sanitize → controllerFns 模块
>   shim（4 处调用，同 remainingFilenameLength 模式）；initMousetrap（leaveDetailMode 清理
>   站点）→ try/catch 跳过（strangling 期 bundle 自管重绑定 / post-b1 bridgeWhenReady 等价；
>   b1-8b 待接装登记）；window 类保留登记（**b1 终审 vendor 提取清单**，c18a 先例）：
>   getHashID/getRawPath/isElementVisible/fuzzy_match/cloneTree/openInNewWindow/
>   uploadFolderToSidebar/fileSize/debounce/throttle/hiddenByCurrentFilter/ayncsImagesChange/
>   updateWindowProgressBar/backgroundWindowID/resetNgGridLayoutData（隐式全局，post-b1 归
>   grid 域）/getImagePixelDensity 三助手（eagle-zoom-helpers vendor 已含）。
> - **已知 flake 再证**：m1 markdown-thumbnail 超时在含/不含本轮改动两态均出现（stash 二分
>   取证），与 2550 行既有登记（cm-overlay-close/main-ui-workflow 资源竞争 flake）同源——
>   非回归；复跑通过。
> - 验证：tsc 零错（真实退出码）；m1 25/25。

> **b1-8 后全量 suite 绿 + 环境缺陷定性 + b1-9 终审清单（2026-09-03）**：
> - **全量 suite：FULL_REGRESSION_ISOLATED_OK（EXIT:0，32 OK 全链）**——但需临时
>   workaround 才能达成：**宿主级缺陷**——本机（H: 盘事件后）对 node 原生
>   `fs.cpSync(recursive)` 触发静默进程击杀（exit 127，无栈无输出；最小复现：任意目录对
>   含空目录对均死；手写 readdir+copyFileSync 循环存活；沙箱内外一致——非 ZCode 沙箱所
>   致，疑似 AV/过滤驱动）。受击测试链：library-migration（migrate 端点 cpSync）→
>   isolated 两度 ECONNRESET 于同一关。**临时补丁（未提交，终审验证后回退）**：
>   backend/src/{library-migration,importer,library-backup-service}.js +
>   tests/roadmap-panels.mjs 的 cpSync → copyRecursiveManual 循环（带 TEMP-SANDBOX-
>   WORKAROUND 标记）。m1 markdown-thumbnail 超时为 2550 行既有竞争 flake（本轮含/不含
>   改动两态均现，stash 二分排除回归）。
> - **b1-9 终审清单（去 Angular 前置提取面）**：React w.* 消费名 148，shims 已供
>   （$bodyScope/electron/electronSettings/chineseConvert/languageBCP/pinyinlite/
>   pluginModule/tinyPinyin/…）+ vendor 已供（match-rules 全 isMatch*/DeltaE/colorConvert、
>   hover-preview、infinitegrid/$）后，**真缺口 60 名**，分层：
>   - 基础设施（require/remote 可直取）：appRoot/fse/ipcRenderer/currentWindow/resourcesPath/
>     backgroundWindowID/EAGLE_THUMBNAIL_TEMP_PATH/IS_DIRECTORY/machineID/isVentura/
>     EagleConfig(+VIDEO/AUDIO/FONT/SPECIAL_TYPES/VIDEO_TYPES_GLOBAL)/electronLog/preferences；
>   - 纯函数批（eagle-utils vendor 候选）：guid/getHashID/getRawPath/getThumbnailPath/getExt/
>     fuzzy_match/cloneTree/cartesianProduct/unicodeNormalize/decodeBase64Image/readChunk/
>     writeFileAtomic/fileSize/sanitize/walk/junk/debounce/throttle/installedFonts/fontFolder；
>   - 异步批量 fns：ayncsImagesChange/ayncsImagesRemove/hiddenByCurrentFilter/
>     updateWindowProgressBar/checkBackgroundHeartbeat/heartbeat*；
>   - 有状态管理器（大件，bundle 顶层模块逐字提取）：APIServer/initAPIServer/startAPIServer/
>     stopAPIServer/Registration/QuickAccessManager/RecentFileManager/ScrollbarSaver/
>     SlowNotify/PERFORMANCE_MONITOR/ACCESS/analytics/FileUrlHelper；
>   - 网格/可变状态（React boxGridEngine 协同）：ig/resetNgGridLayoutData/rectSelecting/
>     rectSelection/tagRectSelecting/windowMouseX/dragging/customDimesion1。
> - 终审工序（b1-9 批次）：a) 基础设施+纯函数批 vendor 化 → b) 异步批/管理器批逐文件
>   bundle 顶层逐字提取（c18a 先例）→ c) index.html 摘除 app.bundle.js + ng-* 属性 →
>   d) m1+isolated 全量验证（此后 isolated 需 workaround 在树）。
> - 附件：tests-tmp/vendor-extract-inventory.py（盘点脚本）、tests-tmp/fns-bare-audit.py
>   （裸引用审计）、tests-tmp/vendor-inventory-out.txt（原始清单）——均不提交。

> **b1-9a 基础设施 + 纯函数批挂载（2026-09-03；bundleGlobals.ts）**：
> - 盘点修正：install 三连（main.tsx 245-247 无条件执行）下 bundleGlobals 已供远超预期——
>   Tier-1（appRoot/EagleConfig/TYPE 表/fileSize/re-require 十行/installedFonts/fontFolder/
>   FileUrlHelper/IPCHelper/PERFORMANCE_MONITOR/ACCESS/isVentura/UrlStateService/eg vendor/
>   match-rules vendor/hover-preview vendor）+ Tier-2 草稿十二件（guid/throttle/debounce/
>   fuzzy_match/decodeBase64Image/cloneTree/getHashID/hiddenByCurrentFilter/ayncsImagesChange/
>   startAPIServer/stopAPIServer/checkBackgroundHeartbeat）**均已挂载**——60 名清单实际剩
>   ~28 名待供给。
> - 本片新增挂载：**electronLog**（19035 remote.require 等价 require）、**getRawPath/
>   getThumbnailPath/getExt**（2348/2363/53678 逐字；getExt fs/path 经 require）、
>   **ayncsImagesRemove**（49709-49745 逐字 50/批 empty-trash 双轨）、**updateWindowProgressBar**
>   （49810 逐字 throttle 333 leading，实例一次性创建）、**junk**（8155 require('junk')）、
>   **IS_DIRECTORY**（19025 appRoot require）、**EAGLE_THUMBNAIL_TEMP_PATH**（19030-31
>   userData 派生）、**resourcesPath**（19038-39 isDev 分支等价）、鼠标追踪器（20366-20378
>   逐字 mousemove → windowMouseX/Y + isMouseMoving 100ms 复位）、状态初值补齐
>   （rectSelection={}/rectSelecting=false/dragging=false/windowMouseX,Y=0/heartbeatStopCount=0
>   ——undefined 类 var（preferences/backgroundWindowID/heartbeatInterval/machineID）天然
>   等价不挂）。诊断契约 present 清单同步扩充。
> - 剩余待办（b1-9b/c）：管理器批（APIServer 对象/initAPIServer/Registration/
>   QuickAccessManager/RecentFileManager/SlowNotify/analytics/ScrollbarSaver）+ 网格耦合
>   （ig 实例/resetNgGridLayoutData——归 grid 域切片）+ machineID 运行时赋值路径。
> - 验证：tsc 零错；m1 25/25。

> **b1-9b 管理器批挂载（2026-09-03；bundleGlobals.ts + vendor/eagle-ga4mp.js）**：
> - **APIServer 闭环确认**：machineryInitAPIServer（apiServerDomain 1249 起，17875-18945
>   逐字）1258 行已写 window.APIServer——initAPIServer/APIServer/startAPIServer/stopAPIServer
>   三件齐全，无缺口。
> - **QuickAccessManager**：bundle 19061 `{}` + 46666-46753 controller init 方法面（add/
>   addMultiple/remove/removeMultiple/removeIndex/save/indexOf/getItem）逐字移植，
>   $scope → getBodyScope 同双轨。
> - **RecentFileManager**：52307-52422 逐字（save = throttle(1000, leading)——bundle 顶层
>   throttle 同源 w.throttle；localStorage eagle.recentFiles.* 键逐字）。
> - **SlowNotify**：19073-19133 逐字（show 内 $bodyScope → getBodyScope；#library-warning
>   DOM 门逐字）。
> - **ScrollbarSaver**：46754-46828 逐字（getId 八路视图取向 + save/restore 位置映射；
>   ig.getItems → w.ig——网格实例 b1-9c 归口）。
> - **Registration**：19208 `{activated: false}` 逐字；22666 ipc 运行时更新接线 post-b1 由
>   libraryDomain 注册域接管时接线（登记）。
> - **preferences**：105476 等价（electron-settings getPreferences()，shims electronSettings
>   同源）。
> - **analytics**：105501-105706 逐字 + deps 同径（clientId=localStorage.gaClientId/locale/
>   customDimesion1="未激活"/pjson=require(package.json)）+ **ga4track → vendor
>   eagle-ga4mp.js**（bundle 104962-105460 UMD 逐字节提取 499 行，node require 装载验证
>   factory→object ✓；fetch 注入后 ga4track 初始化（105487-105496 逐字，gaClientId 缺失
>   时 guid() 回填）；注入失败/早期调用 telemetry 丢失——analytics 方法侧 w.ga4track 存在性
>   守卫，登记）。
> - **this 注解组**：对象字面量方法 this-typing 以 `function (this: any, ...)` 显式化
>   （screenView/event/exception/timing/custom/ecommerce.transaction + **forEach 内层
>   function（bundle 原 bug：非箭头 forEach 回调内 this 为 undefined——逐字保留）**）。
> - 验证：tsc 零错；m1 25/25（markdown-thumbnail flake 两现一过，同 2550 登记形态）。

> **b1-9c 网格耦合收口 + 目录枚举批（2026-09-03；bundleGlobals.ts）**：
> - **盘点修正（零新增工作确认）**：网格耦合已由 boxGridEngine 闭环——`window.ig = ig`
>   （533）+ `w.resetNgGridLayoutData`（665）+ NgGridStrings 同名全局（535）；machineID/
>   Registration/trialRemain 已由 libraryDomain 'initial' 监听（174-190）接线——22664 ipc
>   链 post-b1 由 React 侧等价承接，无缺口。
> - **walk**（bundle 52664-52697 逐字：递归目录枚举，getExt/junk.is/IS_DIRECTORY.check
>   过滤 + .pxd 特判 + 注释原样）→ w.walk（apiServerDomain 623 消费）。
> - **installedFonts 初扫**（bundle 19243 fs.access/readdir → `${name}_${extname}` 键表）
>   ——旧 if-absent 挂载点移除（避免短路），统一在文件尾挂载 + 触发初扫；React machinery
>   运行时增删复用同表。
> - 验证：tsc 零错；m1 25/25。

> **b1-9d 去 Angular 最后一段·自然装载链 listDone 打通（2026-09-04 终审）**：
> - **交接 v3 的原假设被证伪**：v3 定性为「openAll early-return（allData 被提前填充）」。探针实测
>   natSteps `call:openAll{allData=0,isIBC=true,raw=1}` —— early-return 条件（`allData.length>0`）
>   压根不成立，走的是完整路径；真正断点是 openAll 内部 `$timeout(50)` **回调首行抛错后被吞**。
>   吞错路径有两条且都不进 console：shim `$timeout` 的 catch（console.error）与
>   `calculateImageBinding` 的 catch（`electronLog.error`）；而原探针的 `consoleErrors` 数组
>   **从未被填充**（无 console 监听）→ `CONSOLE_ERRORS []` 是假阴性。探针补 `console.error`
>   覆盖 + `electronLog.error` 钩后才可见。
> - **四处去 Angular 供给缺口（全部修在分歧源头；未改 machineryOpenAll / machineryRebindRefresh
>   本体（逐字 faithful），未强制置 listDone 绕过）**：
>   1. `s.UrlStateService`（bundle 20208 `$scope.UrlStateService = UrlStateService`）与
>      `s.preferences`（20055 `$rootScope.preferences`）是 controller-init 的 DI 本地，种子区间
>      21242-21619 未覆盖 → shim 世界二者皆 undefined。openAll 的 timeout 回调首行
>      `s.UrlStateService.setState(...)` 即抛 → `reload()`/listDone 永不置位。修：
>      `applyDataMachineryScope` 内 shim-only if-absent 补种（shim 的 `$root` 即 scope 自身，
>      故 `s.preferences` 同时覆盖 `s.$root.preferences`，updateSidebarList 消费 `.sidebar.*`）。
>   2. `getFilter()` 无 Angular 回退（对照同批已落地的 `getTimeout()` shim）→ **任何含文件夹的库**
>      都会在 calculateImageBinding 的 folder walk 首行抛 `$filter is not a function`。
>      修：shim `$filter`，`unique`/`duration`/`domainName`/`i18n` 逐字移植（bundle 19849 / 19922 /
>      19942 / 19979），`orderBy`/`date` 复刻本工程实际用到的调用形态。**API 形状坑（已栽一次）**：
>      Angular 的 `EagleApp.filter(name, factory)` 在注册期即展开工厂，`$filter(name)` 直接返回滤镜
>      函数；初版多包一层工厂 → `folder.children` 被赋成函数 → `eagle.utils.tree.walk` 无限递归
>      （folderList 涨到 4835 项后爆栈，表层报 `convertToPinyin` RangeError）。
>   3. `Array.prototype.unique`（bundle 2607-2608）/ `String.prototype.score`（2621-2703）随 bundle
>      死亡消失，而 React 侧逐字保留了 `.unique()` / `.score()` 调用 → `machineryGetExtendTags`
>      抛 `uniqueTags.unique is not a function`。修：`bundleGlobals` 内 if-absent 逐字补供给
>      （score 为字节提取，仅 `var fuzzyFactor = 0` 一处 TS 严格模式适配）。
>      `Array.prototype.move`（2610）React 侧零消费，留作诚实缺口不供给。
>   4. 存活 classic script / vendor 内裸 `angular`：`egjs-infinitegrid.umd.js:4233`、
>      `eagle-hover-preview.js:81`、`js/services/lazy-load-manager.js:366/446`（缩略图装载链）。
>      统一改为 `$bodyScope || angular.element("body").scope()`（即 bundle 同文件 673 行 Eagle 自有
>      写法），bundle 在世语义零改变。
> - **验证**：tsc 零错（真实退出码 0）；探针 `B19D_LATE {"listDone":true,"isItemBindCalculated":true,
>   "allDataLen":1,"rej":[]}`，natSteps 全链 `cibCall → natCbStart → call:openAll → natCbDone →
>   call:reload → call:rebindRefresh → call:relayout → TICK{allData=1,listDone=true}`，
>   `[shimTimeout] fn failed` 全部消失。新增空库探针（复现 m1 的 createLibrary-only 条件，
>   含文件夹）同样 `listDone:true` —— 空库路径下 listDone 曾被同一条 folder-walk 链阻断。
>   `npm run test:isolated` = `FULL_REGRESSION_ISOLATED_OK`（EXIT:0，backend 临时 cpSync 补丁在树）。
> - **遗留（本轮不扩域，另开切片）**：① 缩略图修复链 `listImageError` / `tryToFixThumbnailError` /
>   `fixThumbnail`（bundle 19537+）整条未端口，而 `boxGridEngine.ts:96` 生成的
>   `onerror="listImageError(event)"` 仍裸引用 → 缩略图加载失败时必抛 ReferenceError；
>   ② 拖放导入域 `onDropContainer`（bundle 52717，约 210 行 + `dragging`/`IS_HIDDEN_FILE`
>   等依赖）未端口 → `npm run test:main-ui-workflow` 停在 `text file drop import timeout`
>   （listDone 等待段已过，属后续阶段缺口）。

> **b1 前置终审·缺口全量审计 + b1-1 fns 桥（2026-09-03；shimFnsBridge 新增）**：
> - 审计方法：正则提取 React 七域文件（dataMachinery/controllerFns/libraryDomain/itemDomain/
>   filterDomain/miscDomain/selectionViewDomain/apiServerDomain）内全部 s.X() 调用面，对比
>   machinery 契约（v33，111 成员）与 controllerFns c3 fns 表（155 成员）。组件层
>   （components/**）调用面待各域切片 triage；preview-window/preferences 为独立 scope 不计入。
> - **shim get 代理对未知属性返回 coreState[prop]=undefined——b1 后任何未供给函数调用即崩**，
>   逐项核销路线确证（scopeShim.ts get handler）。
> - **b1-1 案（本次落地）**：main.tsx bridgeWhenReady shim 分支调用 attachCoreFnsToShim(scope)
>   （core/shimFnsBridge.ts）——c3 fns 表 if-absent 上 shim，覆盖 36 个缺口名（getRawUrl/
>   openFolder/openSmartFolder/openUnfiled/filterContent/filterWithColor/select/gotoTop/
>   gotoBottom/hexToRGB/rotateImage/rotateVideo/uploadFiles/toggleGifPlay/saveCrop/
>   getSelectedItemElements/getSelectedTags/currentIndex/homeHandler/endHandler…）；
>   machinery apply 同轮随后覆盖自身成员，顺序语义正确；bundle 在世时分支不可达，零迁移期
>   行为变化。
> - **剩余硬缺口 90 项**（七域引用、fns 表与契约均无）：addToDuplicateMapping addToRecentFile
>   autoScroll cancelCrop changeListHeight changeMetaItems checkListItemsLessThanContainer
>   enterSlideshowMode expandFolder expandSmartFolder fadeOutDetailMode findDupclipate
>   forceFitImageSize getFolderList getQuickAccessList getSelectedItems getSmartFolderList
>   hideUploadQueue importLinks isDuplicateImage leaveSlideshowMode lockApp moveToFolders
>   multipleOpenFolder multipleOpenSmartFolder newSmartFolder offsetScrollbar openAllTags
>   openArtstation openCommunity openDuplicate openFilter openHuaban openNextFolder
>   openNextSmartFolder openPinterest openPluginPanel openPrevFolder openPrevSmartFolder
>   openRandom openRecent openStarredGroup openTagAllGroup openTagGroup openTrash openTrialModal
>   openUnfiledGroup openUntagged pausePalette preloadImage prependFolder quickOpenFolder
>   refreshSubfolderList rememberScrollTops rememberVideoCurrentTime removeFolder
>   removeFolderContents removePermanently removeSelectedFolders removeSelectedSmartFolders
>   removeSmartFolder removeTagGroup renameCurrentFolder renameFolder renameSmartFolder
>   resetFolderCover resumePalette rgbToHex saveLayout scrollToCurrentItem searchInAll
>   setFolderOrder setSmartFolderOrder showTutorial showUploadQueue sortData
>   toggleAllSmartFolderExpand toggleCommentMode toggleCurrentLevelSmartFolders
>   toggleFilterByType toggleSelectSmartFolder toggleVideoPlay unlockFolderWithTouchID
>   updateListSlider updateSliderPosition updateSubFolderWidth updateTxtItem videoScreenShot
>   —— b1 执行前按此清单逐片核销（openFolder/上传/删除/侧栏展开族为大头）。
> - 验证：tsc 零错（真实退出码）；m1 25/25（bundle 在世，桥分支未触发）。

> **c18e-1 selectNext/selectPrev（2026-09-03；version 23）**：
> - machinerySelectNext（36382-36444 逐字：isCropMode→MOVE-CROP-TOOL 广播 + getSelection
>   start/end+1 + 尾项 is-last-item 提示 + cleanBitmapViewer + 详情分支 forceFitImageSize/
>   current/isGifReady + autoScroll + updateNavigator/lastZoom/zoom + nextTimeout 域内自管
>   100ms 重算缩放与 preloadImage("next") + addToRecentFile）、machinerySelectPrev（36502-36552
>   逐字：首项 is-first-item 提示 + allData 空守卫 + 详情模式 cleanBitmapViewer +
>   start-1 越界回落 allData[0] + prevTimeout 域内自管 preloadImage("prev")）。
> - 依赖经 scope 解析：getSelection/lastZoom（machinery 版）、autoScroll/forceFitImageSize/
>   preloadImage/addToRecentFile（bundle scope 函数，后续片独立移植）、zoom（bundle 闭包→
>   smartZoom 已 machinery 版）。
> - 验证：tsc 零错；m1 25/25。

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
