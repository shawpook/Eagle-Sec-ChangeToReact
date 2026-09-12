import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3vm');
  const { ev, waitFor, delay } = ctx;
  await ev(`(() => { window.$bodyScope.viewMode = 'trash'; })(); true`);
  await waitFor(async () => /trash-view/.test(await ev(`document.body.className`)), 'trash-view', 15000);
  const dropTrash = await ev(`document.querySelectorAll('#eagle-drop-areas-host .drop-area').length`);
  await ev(`(() => { window.$bodyScope.viewMode = 'all'; })(); true`);
  await waitFor(async () => /all-view/.test(await ev(`document.body.className`)), 'all-view', 15000);
  const dropAll = await ev(`document.querySelectorAll('#eagle-drop-areas-host .drop-area').length`);
  if (dropTrash < 1) throw new Error('trash drop-area missing: ' + dropTrash);
  extra = { dropTrash, dropAll };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_VIEWMODE_OK', extra);
