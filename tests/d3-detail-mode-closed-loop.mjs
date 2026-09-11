import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3detail');
  const { ev, waitFor, delay } = ctx;
  await ev(`window.__eagleBodyState.setState({ isDetailMode: true }); true`);
  await waitFor(async () => /is-detail-mode/.test(await ev(`document.body.className`)), 'detail-on', 15000);
  await ev(`window.__eagleBodyState.setState({ isDetailMode: false }); true`);
  await waitFor(async () => !/is-detail-mode/.test(await ev(`document.body.className`)), 'detail-off', 15000);
  extra = { ok: true };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_DETAIL_MODE_OK', extra);
