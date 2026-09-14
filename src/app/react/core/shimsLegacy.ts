// R2：启动契约已按职责拆分至 `src/app/react/core/shim/`
// （environment / browserRuntime / moduleRegistry / settingsI18n / ipcBus / desktopCapability / demoSeed）。
// 本文件保留为**兼容入口**——十个窗口入口仍首行 `import '.../core/shimsLegacy'`，装配时机
// （模块求值期，早于 DCL 链）与拆分前一致。装配顺序、全局契约面与释放口见 `shim/install.ts`。
import { installLegacyShimContract } from './shim/install';

installLegacyShimContract();
