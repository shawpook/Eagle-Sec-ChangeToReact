// b1-9bz-C-0：externalSupply 的注册端（副作用模块，由 main.tsx 引入一次）。
//
// 这里**集中**持有跨窗口 / 驱动脚本所需的 10 个函数。之所以单独成文件：
// 这些 service 都反向依赖 dataMachinery，若直接由 dataMachinery 静态 import 会改变
// ESM 求值顺序并打断启动加载链；改由入口导入后，dataMachinery 先完整求值，
// 本模块随后注册，依赖方向变为单向。

import { registerExternalSupply } from './externalSupply';
import { activateFont, deactivateFont, isFontActivate } from '../services/fontTagService';
import { addImagesToFolder } from '../services/folderCoreService';
import { select } from '../services/selectionService';
import { escHandler } from './miscDomain';
import { copyAsPath, getRawPath, getRawUrl } from './itemDomain';
import { startDrag } from '../services/imageOpsService';

registerExternalSupply({
  // 子窗口（viewers/font、viewers/text-editor）经 parent.$bodyScope 驱动
  activateFont,
  deactivateFont,
  isFontActivate,
  escHandler,
  // 主 UI 驱动脚本（electron/main.cjs）经 scope 驱动
  addImagesToFolder,
  copyAsPath,
  getRawPath,
  getRawUrl,
  select,
  startDrag,
});
