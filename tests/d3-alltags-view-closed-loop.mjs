import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3tags');
  const { ev, waitFor } = ctx;
  await ev(`(() => { window.$bodyScope.viewMode = 'alltags'; })(); true`);
  await waitFor(async () => await ev(`(() => { const el = document.querySelector('#eagle-tag-manager-host #tag-manager'); return !!el && el.style.display !== 'none'; })()`), 'tag-manager-visible', 20000);
  const groups = await ev(`document.querySelectorAll('#eagle-tag-manager-host .tag-manager-sidebar .sidebar-item').length`);
  if (!(groups >= 3)) throw new Error('tag manager sidebar items ' + groups);
  await ev(`(() => { window.$bodyScope.viewMode = 'all'; })(); true`);
  await waitFor(async () => /all-view/.test(await ev(`document.body.className`)), 'back-to-all', 15000);
  extra = { groups };
} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_ALLTAGS_VIEW_OK', extra);
