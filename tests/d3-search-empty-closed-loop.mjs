import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('d3search');
  const { ev, waitFor, delay } = ctx;
  const areaCount = () => ev(`document.querySelectorAll('#eagle-drop-areas-host .drop-area').length`);
  // 非空态的判据之一 `#image-drop-area` 的隐藏条件含 `allDataCount > 0`，而该字段在 boot 后
  // 异步就绪；若在全量套件负载下抢先读取，allDataCount 仍为 0 会按设计渲染 #image-drop-area，
  // 造成 areasOff 非 0 的假失败（本机复现率约 1/4）。故先等 allDataCount 就绪，并把两次
  // drop-area 计数改为等到期望值再断言。
  await waitFor(async () => (await ev(`window.__eagleListState.getState().allDataCount`)) > 0, 'allDataCount', 15000);
  await ev(`(() => { window.__eagleBodyState.setState({ keyword: 'zzz-no-hit' }); window.__eagleListState.setState({ keyword: 'zzz-no-hit', filteredsCount: 0, isLoading: false }); return true; })()`);
  await waitFor(async () => await ev(`document.getElementById('box-container').classList.contains('empty')`), 'empty-on', 15000);
  await waitFor(async () => (await areaCount()) === 1, 'areas-on', 15000);
  const areasOn = await areaCount();
  await ev(`(() => { window.__eagleBodyState.setState({ keyword: '' }); window.__eagleListState.setState({ keyword: '', filteredsCount: 2, isLoading: false }); return true; })()`);
  await waitFor(async () => !(await ev(`document.getElementById('box-container').classList.contains('empty')`)), 'empty-off', 15000);
  await waitFor(async () => (await areaCount()) === 0, 'areas-off', 15000);
  const areasOff = await areaCount();
  if (areasOn !== 1) throw new Error('expected 1 drop-area on empty, got ' + areasOn);
  if (areasOff !== 0) throw new Error('expected 0 drop-area restored, got ' + areasOff);
  extra = { areasOn, areasOff };

} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'D3_SEARCH_EMPTY_OK', extra);
