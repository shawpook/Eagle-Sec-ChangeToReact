import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3store', { items: 2 });
  const { ev, waitFor, delay } = ctx;
  await ev(`(() => { window.__eagleBodyState.setState({ viewMode: 'all', layout: 'GridLayout', keyword: '', currentFocus: 'sidebar' }); window.__eagleListState.setState({ layout: 'GridLayout', keyword: '', filteredsCount: 2, isLoading: false }); return true; })()`);
  await waitFor(async () => {
    const b = await ev(`JSON.stringify(window.__eagleBodyState.getState())`);
    const o = JSON.parse(b);
    return o.viewMode === 'all' && o.layout === 'GridLayout' && o.keyword === '' && o.currentFocus === 'sidebar';
  }, 'store-roundtrip', 10000);
  const boxes = await ev(`document.querySelectorAll('#box-list .box').length`);
  const cls = await ev(`document.body.className`);
  if (boxes !== 2) throw new Error('boxes ' + boxes);
  if (!/all-view/.test(cls)) throw new Error('all-view missing');
  extra = { boxes };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_STORE_ROUNDTRIP_OK', extra);
