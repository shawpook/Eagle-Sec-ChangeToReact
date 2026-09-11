import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3theme');
  const { ev, waitFor, delay } = ctx;
  await ev(`window.__eagleBodyState.setState({ theme: 'light' }); true`);
  await waitFor(async () => (await ev(`window.__eagleBodyState.getState().theme`)) === 'light', 'theme-light', 10000);
  await ev(`window.__eagleBodyState.setState({ theme: 'dark' }); true`);
  await waitFor(async () => (await ev(`window.__eagleBodyState.getState().theme`)) === 'dark', 'theme-dark', 10000);
  extra = { theme: 'dark' };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_THEME_OK', extra);
