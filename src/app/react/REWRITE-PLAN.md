# 彻底化施工图（REWRITE-PLAN）

> b1-9az 起的系列工程蓝图。目标：把 src/app/react 从"React 面子 + Angular 里子"的
> 权宜架构，改造为**地道的 React 19 + TypeScript** 应用——状态单源、逻辑归位、
> 语义原语（scope/digest/broadcast）与 jQuery 胶水全部退场。
> 门禁铁律：**每批结束 52 项回归套件全绿才可提交**；触碰未覆盖功能面前先补闭环测试。

## 一、量化现状（2026-09-05 审计）

| 层 | 体量 | 形态问题 |
| --- | --- | --- |
| scopeShim + scopeBridge | 195 + 115 行 | Proxy 模拟 $scope/$digest；状态真身 coreState 无类型大袋子 |
| fns 表（controllerFns.ts） | 12,622 行 | 263 函数字符串键表，非 React 任何范式 |
| machinery（dataMachinery.ts） | 11,882 行 | Angular controller 形状逐字移植，s.* 赋值面 |
| 组件层绕道调用 | 576 处 | scopeApply/callScope/getBodyScope 直呼 scope 函数 |
| digest 语义 | $evalAsync 426 / $broadcast+$on 227 / $watch 63 | 手动脏检查 + 全局广播 |
| jQuery 胶水 | 1,056 处 + vendor 6 脚本 | smoothZoom/draggable/hover-preview 直驱 DOM |

已是 React 的部分：51 个组件、13 个 zustand store（渲染读侧）、Vite/TS 工具链、
Angular 运行时归零。数据流环：coreState → 快照进 zustand（渲染）→ 事件经 scopeApply
绕回 scope 世界改 coreState。

## 二、目标架构

```
React 组件（hooks + zustand）
  ├── 渲染：订阅 zustand store（唯一状态源）
  └── 事件：store action / 类型化 service 模块直调
领域逻辑：类型化 service 模块（显式入参出参，无 s.*）
跨组件通信：类型化事件总线（替代 $broadcast）或 store 订阅
scopeShim / fns 表 / controllerFns.ts / dataMachinery.ts / jQuery：删除
```

## 三、阶段与批次

### 阶段 1：状态单源（进行中）
- **机制（b1-9az 已落地）**：scopeShim 迁移注册表 `migrateScopeFieldToStore`——注册
  字段 get/set 委托 zustand store（set 保留 coreState 镜像供诊断），startScopeSync
  对已迁字段退化为无害回声；未注册字段行为不变。
- **批次 1（b1-9az）**：bodyState 20 个顶层同名字段（theme/platform/language/
  currentFocus/viewMode/isLoading/layoutOptions/isWin11/isDetailMode/isInlineMode/
  isCommentMode/isGrayscaleMode/isHideNavigator/smoothZoomDone/layout/isCropMode/
  isMaximize/isHideSidebar/isSlideshowMode/vibrancyEnabled）。
- 后续批次：detailState/listState/filterState/inspectorState 等其余 store 同机制
  逐组注册；嵌套路径（inspector.*、preferences.*、currentFolder.*、containerSize.*）
  以父对象迁移或字段拉平处理；派生字段改 store selector。

### 阶段 2：fns 表拆解（263 函数三向归位）
按子系统**竖切**推进（每竖切 = fns 条目 + machinery 实现 + 组件调用点 + 测试）：
1. 网格视图（zoom/layout/viewType/imageSize——含 smoothZoom 消费面）
2. 侧栏树（clickNode/openFolder 族——b1-9ay 已修的 dragCheck 链）
3. 筛选/搜索（filter 族 + searchFilter 管线）
4. 详情模式（toggleDetailMode/rotate/zoomFit/star 键族）
5. 批量操作与右键菜单族（openItemContextMenu 等 30+ 菜单构建器）
6. 设置/杂项（preferences/inspector 面板族）
归位三分法：UI 事件 → 组件 handler；数据操作 → service 模块；状态操作 → store
action。`controllerFns.ts`/`callScope` 清零后删除。

### 阶段 3：digest 语义退役
$evalAsync/$apply（426+28）→ 直接调用 + store 订阅；$watch（63）→ zustand
subscribe/useEffect；$broadcast/$on（227）→ 类型化事件总线（typed emitter）。

### 阶段 4：jQuery 退役
smoothZoom → React 缩放状态 + CSS transform；sidebar draggable/droppable → 原生
HTML5 DnD 或 pointer events；hover-preview → React 组件；egjs-infinitegrid 本身
React 兼容，保留。vendor 6 脚本随各面清零后移除。

### 阶段 5：终审
scopeShim/scopeBridge/shimFnsBridge 删除；appCore.coreState 删除；残留清单归零
（grep 断言入套件：无 scopeApply/callScope/$broadcast/jQuery 调用点）。

## 四、行为锁定策略

- 52 项套件（数据面通道 + 关键交互 + 残余哨兵）每批全绿。
- 竖切触碰的功能面若套件未覆盖，**先补闭环测试再动刀**。
- 实现体允许重写（不再逐字），但**对外行为以测试为准**；测试未定义的行为按原版
  bundle（git 历史 `5d3af6a^:src/app/app.bundle.js`）考据后补测试再迁移。
