/**
 * React 全量回归套件（27+1 项，顺序隔离执行）。
 */
import { spawnSync } from 'node:child_process';

const tests = [
  'tests/react-stage-smoke.mjs',
  'tests/react-stage5-smoke.mjs',
  'tests/react-stage6-smoke.mjs',
  'tests/react-stage7a-smoke.mjs',
  'tests/react-stage7b-smoke.mjs',
  'tests/react-stage7c-smoke.mjs',
  'tests/react-stage7c2-smoke.mjs',
  'tests/react-stage7d1a-smoke.mjs',
  'tests/react-stage7d1b-smoke.mjs',
  'tests/react-stage7d1c1-smoke.mjs',
  'tests/react-stage7d1c2-smoke.mjs',
  'tests/react-stage7d2-smoke.mjs',
  'tests/react-stage7d3a-smoke.mjs',
  'tests/react-stage7d3b-smoke.mjs',
  'tests/react-stage7d4-smoke.mjs',
  'tests/react-stage7d5a-smoke.mjs',
  'tests/react-stage7d5b-smoke.mjs',
  'tests/react-stage7d6a-smoke.mjs',
  'tests/react-stage7d6b-smoke.mjs',
  'tests/react-stage7d6c-smoke.mjs',
  'tests/react-stage8a-smoke.mjs',
  'tests/react-stage8b-smoke.mjs',
  'tests/react-stage8c-smoke.mjs',
  'tests/react-stage8d-smoke.mjs',
  'tests/react-stage8e-smoke.mjs',
  'tests/react-stage8e2-smoke.mjs',
  'tests/react-stage9a2-smoke.mjs',
  'tests/react-stage9a3-smoke.mjs',
  'tests/react-stage9b1-smoke.mjs',
  'tests/react-stage11a1-smoke.mjs',
  'tests/main-ui-workflow-closed-loop.mjs',
  'tests/source-mode-ui-closed-loop.mjs',
  'tests/library-switch-ui-closed-loop.mjs',
  'tests/drag-start-closed-loop.mjs',
  'tests/preview-delivery-closed-loop.mjs',
];

const failed = [];
for (const t of tests) {
  process.stdout.write(`RUN ${t} ... `);
  const r = spawnSync(process.execPath, [t], { encoding: 'utf8', timeout: 300000 });
  if (r.status === 0) {
    console.log('OK');
  } else {
    console.log(`FAIL (exit=${r.status})`);
    const tail = (r.stdout || '').split('\n').filter(l => /FAIL|SMOKE ERROR|OK$/.test(l)).slice(-8).join('\n');
    console.log(tail);
    failed.push(t);
  }
}
console.log(failed.length === 0 ? 'REACT SUITE ALL GREEN' : `REACT SUITE FAILED: ${failed.length}: ${failed.join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
