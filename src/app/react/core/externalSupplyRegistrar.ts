// b1-9bz-C-0：externalSupply 的注册端（副作用模块，由 main.tsx 引入一次）。
//
// 这里**集中**持有 `EXTERNAL_SUPPLY_NAMES` 契约声明的全部跨窗 / 驱动脚本供给函数
// （数量以契约为准，不在注释里硬编码）。之所以单独成文件：
// 这些 service 都反向依赖 dataMachinery，若直接由 dataMachinery 静态 import 会改变
// ESM 求值顺序并打断启动加载链；改由入口导入后，dataMachinery 先完整求值，
// 本模块随后注册，依赖方向变为单向。

import { registerExternalSupply } from './externalSupply';
import { changeToNStar, removeStar } from './crossWindowActions';
import { activateFont, deactivateFont, isFontActivate } from '../services/fontTagService';
import { addImagesToFolder } from '../services/folderCoreService';
import { select } from '../services/selectionService';
import { escHandler } from './miscDomain';
import { copyAsPath, getRawPath, getRawUrl } from './itemDomain';
import { startDrag } from '../services/imageOpsService';
import { imagesChange } from '../components/inspector/inspectorActions';

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
  // F08（m1-f08f09-actions）：字体改名 + 评级快捷键族。
  // 注册名 = 子窗既有调用协议（`viewers/font/entry.tsx`、`viewers/text-editor/entry.tsx`），
  // 实现全部指向 `core/crossWindowActions.ts` 的具名端口——转发既有业务实现
  // （`imagesChange` / `machineryChangeStar` 族），不复制第二套持久化逻辑。
  imagesChange,
  removeStar,
  changeTo1Star: () => changeToNStar(1),
  changeTo2Star: () => changeToNStar(2),
  changeTo3Star: () => changeToNStar(3),
  changeTo4Star: () => changeToNStar(4),
  changeTo5Star: () => changeToNStar(5),
});
