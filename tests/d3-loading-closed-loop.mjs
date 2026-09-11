import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3load');
  const { ev, waitFor, delay } = ctx;
  await ev(`window.__eagleBodyState.setState({ isLoading: true }); true`);
  await waitFor(async () => (await ev(`window.__eagleBodyState.getState().isLoading`)) === true, 'loading-on', 10000);
  await ev(`window.__eagleBodyState.setState({ isLoading: false }); true`);
  await waitFor(async () => (await ev(`window.__eagleBodyState.getState().isLoading`)) === false, 'loading-off', 10000);
  const boxes = await ev(`document.querySelectorAll('#box-list .box').length`);
  if (boxes < 1) throw new Error('boxes lost after loading toggle: ' + boxes);
  extra = { boxes };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_LOADING_OK', extra);
