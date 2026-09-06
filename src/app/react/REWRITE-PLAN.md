# 彻底化全程计划（至收尾）——REWRITE-PLAN v2

> b1-9ba 定稿。目标：把 src/app/react 从「React 面子 + Angular 里子」的权宜架构，
> 改造为**地道的 React 19 + TypeScript** 应用——状态单源、逻辑归位、语义原语
> （scope/digest/broadcast）与 jQuery 胶水全部退场，含独立窗口面。
>
> **决策记录（b1-9ba 用户拍板）**：
> 1. 门禁节奏 = **定向 + 竖切收官全量**：常规批跑定向子集（~10 项、15 分钟级），
>    竖切收官批与危险批跑 53 项全量。
> 2. 独立窗口面（preview-window / collect-window / viewers）**纳入本轮彻底化**。
> 3. 非 Angular 第三方库**全部自研替换**（egjs-infinitegrid → @egjs/react-infinitegrid
>    官方 React 绑定除外；tippy/sweetalert2/mousetrap/lodash/flatpickr/colorpicker/
>    jquery-audio → 自研或 React 生态方案）。
>
> 旧「数据面零改动/逐字移植」铁律**退役**：实现体允许重写，对外行为以回归套件
> 为准（见「行为锁定策略」）。
> 门禁铁律：**每批结束门禁全绿才可提交**；触碰未覆盖功能面前先补闭环测试。

## 一、量化现状（2026-09-05 审计 + b1-9ba 哨兵基线）

| 层 | 体量 | 形态问题 |
| --- | --- | --- |
| scopeShim + scopeBridge | 195 + 115 行 | Proxy 模拟 $scope/$digest；状态真身 coreState 无类型大袋子 |
| fns 表（controllerFns.ts） | 12,622 行 | 263 函数字符串键表，非 React 任何范式 |
| machinery（dataMachinery.ts） | ~11,800 行 | Angular controller 形状逐字移植，s.* 赋值面 |
| 组件层绕道调用 | scopeApply 207 / getBodyScope 684 / callScope 27 | 直呼 scope 函数 |
| digest 语义 | $evalAsync 384 / $broadcast 129 + $on 74 / $watch 23+8 | 手动脏检查 + 全局广播 |
| jQuery 胶水 | jQuery() 78 + $root. 481 + vendor 10 脚本 | smoothZoom/draggable/hover-preview 直驱 DOM |
| 哨兵基线 | tests/react-rewrite-sentinel-baseline.json | 上述计数的单调递减门（53 项套件第 1 项） |

已是 React 的部分：51 个组件、13 个 zustand store（渲染读侧）、Vite/TS 工具链、
Angular 运行时归零、bundle 摘除。阶段 1（状态单源）已完成：31 个原始顶层字段
经 `migrateScopeFieldToStore` 委托 zustand（bodyState 20 / listState 8 / toastState 2 /
lockState 1），flat-store 普查无剩余可委托字段；单快照 store 与对象态归入各竖切。

b1-9ba 处置：死供应商 2（jquery-long-click / jquery.bez 移出 index.html）；
死频道 11（5 条无接收广播 + 4 条无发送监听移除，UPDATE_BOX_SCROLLBAR 留注释）；
`global/bus.ts` 类型化事件总线就位（$broadcast 的最终替代物）。

## 二、目标架构

```
React 组件（hooks + zustand）
  ├── 渲染：订阅 zustand store（唯一状态源）
  └── 事件：store action / 类型化 service 模块直调
领域逻辑：类型化 service 模块（显式入参出参，无 s.*）
跨组件通信：eagleBus（global/bus.ts 类型化总线）或 store 订阅
scopeShim / scopeBridge / fns 表 / controllerFns.ts / dataMachinery.ts / jQuery：删除
独立窗口：preview-window / collect-window / viewers 同构 React 化，mousetrap 自研
```

## 三、批次总表（P0→P4，27 批，提交号 b1-9ba → b1-9ca）

### P0 基建（批 1-3）
- **批 1（b1-9ba，本批）**：REWRITE-PLAN v2；bus.ts；死供应商/死频道处置；哨兵
  入套件（53 项）；**全量门禁**。
- **批 2（b1-9bb）**：selectionService / sidebarService 热点收编——把 machinery
  依赖热点（updateSidebarList 68 / saveFolder 39 / calculateImageBinding 44 /
  updateSelection 32 处调用）提为显式 service 模块，调用点直调，行为经定向子集。
- **批 3（b1-9bc）**：gridBindingService / folderService 补齐 + lodash 原生化
  （`_.` 调用点 → 原生 Array/Object/spread；window._ 供给面清点后退役 lodash.js）。

### P1 竖切（批 4-20；每竖切 = 状态收编 + fns/machinery 条目归位 + 组件接线 + 测试）
- **S1 网格（批 4-6：b1-9bd / be / bf）**
  - bd：gridState（imageSize/containerSize/layout/viewType）+ gridService + zoom 族
    （zoomIn/zoomOut/ctrl 滚轮）从 fns/machinery 归位。
  - be：switchLayout 链 + egjs-infinitegrid → **@egjs/react-infinitegrid**（官方
    React 绑定，唯一保留的第三方）；w.ig 全局退役评估。
  - bf：S1 残余 + 孤儿清扫，竖切收官**全量门禁**。
- **S2 侧栏（批 7-8：b1-9bg / bh）**：sidebarState 收编 + 树 fns（clickNode/
  openFolder/dragCheck 链）；sidebar draggable/droppable → 原生 HTML5 DnD /
  pointer events（jquery-ui draggable 退役面 1/3）。
- **S3 筛选/搜索（批 9-10：b1-9bi / bj）**：filterStore + filterService + 13 个
  filter 相关 $watch → store 订阅；自研取色器（colorpicker vendor 退役）+
  quickSearch 弹窗 React 化。
- **S4 详情（批 11-13：b1-9bk / bl / bm）**：detailState 收编（含 detailHooks
  jQuery choke point 拆解）；smoothZoom 退役（先剥壳评估其真实职责，CSS transform
  + React 状态重写）；媒体族（video/audio/iframe preview）。
- **S5 菜单族（批 14-16：b1-9bn / bo / bp）**：openItemContextMenu（1,162 行 +
  派发 action）→ typed descriptor + React ContextMenuPanel 数据面；folder/
  smartFolder 菜单 + CRUD 37 条目；filterAdd/new/orderBy 12 条目。
- **S6 批量/回收站/杂项（批 17-18：b1-9bq / br）**：批量操作（移动/打标/删除）；
  回收站 + 杂项面板归位。
- **S7 inspector/TagManager/字体（批 19-20：b1-9bs / bt）**：inspectorState 收编 +
  inspector 表单族；TagManager + installedFonts 扫描链。

### P2 独立窗口（批 21-22）
- **批 21（b1-9bu）**：preview-window React 化（悬浮预览窗）。
- **批 22（b1-9bv）**：collect-window / document-viewer / viewers React 化 +
  **mousetrap 自研**（~80 行 keymap：keypress 字符键 + keydown 修饰组合，覆盖
  bind/unbind/reset 语义）。

### P3 UI 原语自研（批 23-24）
- **批 23（b1-9bw）**：sweetalert2 → 自研 Dialog（107 处 swal 调用面：confirm/
  prompt/alert 三原语 + Promise 契约），vendor 退役。
- **批 24（b1-9bx）**：tippy → useTippy 换实现（333 处 tooltip 面板自研，定位用
  原生 floating 算法）；flatpickr / jquery-audio / artstation-download 逐个评估：
  有消费面则自研替换，零消费直接移除。

### P4 终审（批 25-27）
- **批 25（b1-9by）**：digest 清扫 + startScopeSync 退役——12 store 218 表达式
  改 store action 直写；$evalAsync/$apply 残余归零；scopeBridge 摘除。
- **批 26（b1-9bz）**：fns 表清零——最后字符串键函数归位；controllerFns.ts /
  dataMachinery.ts / shimFnsBridge.ts 删除。
- **批 27（b1-9ca）**：scopeShim / appCore.coreState 删除；grep 永久哨兵扩面
  （react + collect-window + preview-window + viewers 全禁：$evalAsync/$apply/
  $watch/$broadcast/$on/jQuery/$(/callScope/scopeApply/getBodyScope，bus.ts 白名单）；
  收官审计文档；**全量门禁 + 新增闭环项复跑**。

## 四、收尾 DoD（Definition of Done）

1. **六项删除 grep-zero**：scopeShim、scopeBridge、shimFnsBridge、controllerFns、
   dataMachinery、appCore.coreState——文件删除且全树无引用。
2. **永久哨兵**（套件常驻）：src/app/react + collect-window + preview-window +
   viewers 无 Angular 语义与 jQuery 调用点；eagleBus 为唯一跨组件事件通道。
3. **index.html vendor 清零**：jQuery 家族 / lodash / mousetrap / tippy /
   sweetalert2 / colorpicker / flatpickr / jquery-audio 全部退役（或评估后留任
   需留任者在 PROGRESS 记录理由）；网格 = @egjs/react-infinitegrid。
4. **套件 53 → 65+ 全绿**：每竖切至少 +1 闭环项（覆盖该竖切关键交互）。
5. **收官文档**：PROGRESS 终章（架构前后对照 + 已知行为差异清单）+ 本文件归档。

## 五、行为锁定策略

- 53 项套件（数据面通道 + 关键交互 + 彻底化哨兵）门禁：常规批定向子集，竖切
  收官批与危险批全量。
- 竖切触碰的功能面若套件未覆盖，**先补闭环测试再动刀**。
- 实现体允许重写（不再逐字），但**对外行为以测试为准**；测试未定义的行为按原版
  bundle（git 历史 `5d3af6a^:src/app/app.bundle.js`）考据后补测试再迁移。
- b1-9ba 已知「bundle 摘除时代」死特性（本计划竖切时按 React 语义决定重建或
  正式移除）：程式库面板（OPEN_LIBRARY_PANEL）、URL imageFilter 直开筛选面板、
  移动到文件夹选择器（MOVE_TO_FOLDER）、通知弹窗（OPEN_NOTIFICATION）、
  插件面板/插件中心刷新广播（UPDATE_PLUGIN_PANEL / REFRESH_PLUGIN_CENTER）。
