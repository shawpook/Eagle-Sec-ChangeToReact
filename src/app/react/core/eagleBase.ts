/**
 * R6：主界面残余「应用侧独立脚本」的装配点收束。
 *
 * 源脚本在 `src/app/index.html` 中的位置与语义：
 *  - `js/lib/eagle-api.js`（:197）——`var eagle = new Eagle()` + `eagle.utils.tree`
 *    + `eagle.urlEnlargerRemote`。等价 `installEagleBase()`。
 *  - `js/lib/api/url-enlarger.js`（:198）——`globalThis.URLEnlarger` 类 + 尾行
 *    `eagle.urlEnlarger = new URLEnlarger()`。等价 `installUrlEnlarger()`。
 *  - 内联脚本（:250-252）`eagle.urlEnlargerRemote.load();`——拉取远端大图规则。
 *  - `js/services/lazy-load-manager.js`（:243）——**不在此装配**：它只导出类，实例由
 *    `core/libraryDomain.ts` 在「加载库」时构造（`window.LazyLoadManager` 兼容面另由
 *    `installLazyLoadManager()` 供给，见 core/lazyLoadManager.ts）。
 *
 * 时序契约（本文件存在的唯一理由）：原三个 `<script>` 都在 React 模块之前求值，而
 * `core/shimsLegacy`（main.tsx 首个 import）在模块求值期就要读 `window.eagle`
 * ——`shim/demoSeed.ts:721` 的 duplicateChecker 保鲜在 `!window.eagle` 时静默 return。
 * ESM 按源码顺序求值 import，故本模块必须是 main.tsx 的第一条 import。
 *
 * 装配顺序照抄原脚本顺序：基座 → 本实例 → 远端规则拉取。
 */
import { installEagleBase } from './eagleApi';
import { installUrlEnlarger } from './urlEnlarger';

installEagleBase();
installUrlEnlarger();

// 原内联脚本（index.html:250-252）逐字等价：不判断返回、失败仅由 load() 内部 log。
(window as any).eagle.urlEnlargerRemote.load();
