import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3boot', { items: 2 });
  const { ev, waitFor, delay } = ctx;
  const boxes = await ev(`document.querySelectorAll('#box-list .box').length`);
  if (boxes !== 2) throw new Error('expected 2 boxes, got ' + boxes);
  const all = await ev(`(window.$bodyScope && window.$bodyScope.allData) ? window.$bodyScope.allData.length : -1`);
  if (all !== 2) throw new Error('expected allData 2, got ' + all);
  const empty = await ev(`document.getElementById('box-container').classList.contains('empty')`);
  if (empty !== false) throw new Error('box-container should not be empty');
  const cnt = await ev(`window.__eagleListState.getState().filteredsCount`);
  if (!(cnt >= 2)) throw new Error('filteredsCount ' + cnt);
  const cls = await ev(`document.body.className`);
  if (!/all-view/.test(cls)) throw new Error('missing all-view: ' + cls);
  extra = { boxes, all, cnt };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_BOOT_RENDER_OK', extra);
