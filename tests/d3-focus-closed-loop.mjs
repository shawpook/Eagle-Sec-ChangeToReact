import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3focus');
  const { ev, waitFor, delay } = ctx;
  await ev(`window.__eagleBodyState.setState({ currentFocus: 'sidebar' }); true`);
  await waitFor(async () => /current-focus-sidebar/.test(await ev(`document.body.className`)), 'focus-sidebar', 10000);
  extra = { focus: 'sidebar' };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_FOCUS_OK', extra);
