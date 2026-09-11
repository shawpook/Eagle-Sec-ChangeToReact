import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3search');
  const { ev, waitFor, delay } = ctx;
  await ev(`(() => { window.__eagleBodyState.setState({ keyword: 'zzz-no-hit' }); window.__eagleListState.setState({ keyword: 'zzz-no-hit', filteredsCount: 0, isLoading: false }); return true; })()`);
  await waitFor(async () => await ev(`document.getElementById('box-container').classList.contains('empty')`), 'empty-on', 15000);
  const areasOn = await ev(`document.querySelectorAll('#eagle-drop-areas-host .drop-area').length`);
  await ev(`(() => { window.__eagleBodyState.setState({ keyword: '' }); window.__eagleListState.setState({ keyword: '', filteredsCount: 2, isLoading: false }); return true; })()`);
  await waitFor(async () => !(await ev(`document.getElementById('box-container').classList.contains('empty')`)), 'empty-off', 15000);
  const areasOff = await ev(`document.querySelectorAll('#eagle-drop-areas-host .drop-area').length`);
  if (areasOn !== 1) throw new Error('expected 1 drop-area on empty, got ' + areasOn);
  if (areasOff !== 0) throw new Error('expected 0 drop-area restored, got ' + areasOff);
  extra = { areasOn, areasOff };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_SEARCH_EMPTY_OK', extra);
