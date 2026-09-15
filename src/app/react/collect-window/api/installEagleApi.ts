/**
 * 采集窗 API 装配的**求值期入口**（副作用模块）。
 *
 * 必须在 entry.tsx 的 import 列表中先于 `./shell`：controller.ts 模块尾的 IIFE 会在模块求值期
 * 同步读 `eagle.env.browser.name` / `eagle.env.os.isMac`，而 ESM 按 import 声明顺序求值依赖，
 * 故把装配放在这里、只做一次，即可保证 controller 求值时 `window.eagle` 已就绪。
 */
import { installCollectApi } from './install';

installCollectApi();
