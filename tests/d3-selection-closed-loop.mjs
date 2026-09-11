import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3sel');
  const { ev, waitFor, delay } = ctx;
  const before = await ev(`(window.$bodyScope && window.$bodyScope.selected) ? window.$bodyScope.selected.length : -1`);
  if (before !== 0) throw new Error('expected empty selection at boot, got ' + before);
  await ev(`window.$bodyScope.$apply(() => { window.$bodyScope.selected = [window.$bodyScope.allData[0]]; }); true`);
  await waitFor(async () => (await ev(`window.$bodyScope.selected.length`)) === 1, 'select-1', 10000);
  extra = { before, after: 1 };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_SELECTION_OK', extra);
