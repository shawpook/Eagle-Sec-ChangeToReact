import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/app/react/components/grid/continuousGridLayout.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { calculateContinuousLayout, visibleGridRects, captureGridPosition, restoreGridPosition } =
  await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const items = Array.from({ length: 10000 }, (_, index) => ({
  id: `item-${index}`, width: index % 11 === 0 ? 0 : [400, 1920, 360, 800][index % 4],
  height: [1200, 1080, 1200, 800][index % 4], ext: index % 31 === 0 ? 'txt' : 'png',
}));
const modes = ['JustifiedLayout', 'GridLayout', 'SquareLayout', 'ListLayout'];
const start = performance.now();
for (const mode of modes) {
  const options = { layout: mode, width: 1080, size: 150, showName: true, showMetas: true };
  const layout = calculateContinuousLayout(items, options);
  assert.equal(layout.rects.length, items.length);
  for (let i = 0; i < layout.rects.length; i++) {
    const rect = layout.rects[i];
    assert.ok([rect.left, rect.top, rect.width, rect.height].every(Number.isFinite));
    assert.ok(rect.width > 0 && rect.height > 0);
    assert.ok(rect.left >= 0 && rect.left + rect.width <= layout.width + 0.01);
    assert.ok(rect.top + rect.height <= layout.height);
    assert.ok(i === 0 || layout.rects[i - 1].top <= rect.top, 'rectangles stay sorted in scroll order');
  }
  // Compare viewport lookup with a brute-force geometric oracle, including tall masonry items
  // that start before the first normally visible row and viewports around former 60-item edges.
  const points = [0, layout.height - 720, ...[59, 60, 119, 120, 5999].map((index) => layout.rects[index].top)];
  for (const top of points) {
    const expected = layout.rects.filter((rect) => rect.top <= top + 720 + 800 && rect.top + rect.height >= top - 800);
    assert.deepEqual(visibleGridRects(layout, top, 720).map((rect) => rect.id), expected.map((rect) => rect.id));
    assert.ok(visibleGridRects(layout, top, 720).length < 250, 'mounted window stays bounded for large libraries');
  }
  const origin = 217; // A subfolder section and list header precede the grid.
  const position = captureGridPosition(layout, layout.rects[300].top + origin + 17, origin);
  const resized = calculateContinuousLayout(items, { ...options, width: 740, size: 240 });
  const restored = restoreGridPosition(resized, position, origin);
  assert.ok(Math.abs(restored - origin - resized.byId.get(position.anchor.id).top - position.anchor.offset) < 0.001);
  assert.equal(restoreGridPosition(resized, { top: 0 }, origin), 0, 'top stays at the top during resize');
  assert.equal(calculateContinuousLayout([], options).height, 0);
  const hiddenCaptions = calculateContinuousLayout(items.slice(0, 15), { ...options, showName: false, showMetas: false });
  assert.ok(hiddenCaptions.rects.every((rect) => rect.height >= rect.thumbnailHeight));
  console.log(`PASS ${mode}: 10,000 items, viewport lookup, bounds, anchor restoration`);
}
console.log(`PASS full-list layout checks (${Math.round(performance.now() - start)} ms)`);
