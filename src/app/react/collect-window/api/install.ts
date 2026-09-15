import { ensureEagle } from './eagleRef';
import { Utils, TreeUtil, URLUtil } from './utils';
import { Environment } from './env';
import { EagleCrypto } from './crypto';
import { I18n } from './i18n';
import { installFetch } from './fetch';
import { Folder } from './folder';
import { Library } from './library';
import { Tag } from './tag';
import { Item } from './item';
import { SwalDialog } from './dialog';
import { CollectItem } from './collectItem';

/**
 * R5：采集窗「旧 API 全局」的 TS 模块装配（`js/lib/api/*` + `js/models/collect-item.js` 退役）。
 *
 * 装配顺序 = collect-window/index.html 原 `<script src>` 顺序（utils → env → crypto → i18n →
 * fetch → folder → library → tag → item → swal-dialog；url-enlarger 已在本批退役，
 * preference.js 因**从未被任何标签加载**且 `eagle.preference` 在本窗 undefined（R5 探针实测）
 * 而随批删除），末尾补 `window.CollectItem`（原内联 `<script>window.CollectItem = CollectItem;</script>`）。
 *
 * 键集契约（由 tests/react-stage9b1-smoke.mjs 的 pw4g 断言逐字钉住）= 迁移前实测值：
 * `crypto, dialog, env, fetch, fetchLargeJSON, folder, i18n, item, library, tag, utils`。
 * 顺序与键集都不得变——这是「迁移而非重写」的可验证判据。
 *
 * 时序约束（关键）：controller.ts 模块尾有一个立即执行的 IIFE，会在**模块求值期**同步读取
 * `eagle.env.browser.name` 等。故本函数必须由 `api/installEagleApi.ts` 在**模块顶层**调用，
 * 且该模块须在 entry.tsx 的 import 列表中**先于** `./shell`（ESM 按 import 顺序求值依赖）。
 */
export function installCollectApi(): void {
  const eagle = ensureEagle();
  const w = window as any;

  // ── ① js/lib/api/utils.js ──
  eagle.utils = new Utils();
  eagle.utils.tree = new TreeUtil();
  eagle.utils.url = new URLUtil();

  // ── ② js/lib/api/env.js ──
  eagle.env = new Environment();

  // ── ③ js/lib/api/crypto.js ──
  eagle.crypto = new EagleCrypto();

  // ── ④ js/lib/api/i18n.js ──
  eagle.i18n = new I18n();

  // ── ⑤ js/lib/api/fetch.js（尾 IIFE：eagle.fetch / eagle.fetchLargeJSON）──
  installFetch();

  // ── ⑥ js/lib/api/folder.js ──
  eagle.folder = new Folder();

  // ── ⑦ js/lib/api/library.js ──
  eagle.library = new Library();

  // ── ⑧ js/lib/api/tag.js ──
  eagle.tag = new Tag();

  // ── ⑨ js/lib/api/item.js ──
  eagle.item = new Item();

  // ── ⑩ js/lib/api/swal-dialog.js ──
  eagle.dialog = new SwalDialog();

  // ── ⑪ js/models/collect-item.js（全局类，非 eagle 命名空间成员）──
  w.CollectItem = CollectItem;
}
