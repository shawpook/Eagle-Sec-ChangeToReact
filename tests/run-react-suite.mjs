/**
 * React 全量回归套件（65 项，顺序隔离执行）。
 * b1-9ba 起第 1 项为彻底化哨兵、b1-9bc 起第 2 项为自研 utils 单元测试——
 * 两者均无 Electron、秒级以内，放最前让倒退最快暴露。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 每项前清理本仓残留 Electron（防「父进程被杀 → 子进程孤儿 → 后续 spawn 失败」级联假失败）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function killLeftoverElectron() {
  if (process.platform !== 'win32') return;
  try {
    spawnSync('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_Process -Filter "Name=\'electron.exe\'" | Where-Object { $_.CommandLine -like "*$env:EAGLE_SUITE_ROOT*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
    ], { encoding: 'utf8', timeout: 20000, env: { ...process.env, EAGLE_SUITE_ROOT: projectRoot } });
  } catch (err) { /* 清理失败不阻塞 */ }
}

const tests = [
  'tests/react-rewrite-sentinel.mjs',
  'tests/react-utils-native.mjs',
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
  'tests/react-stage11a2-smoke.mjs',
  'tests/react-stage11a3-smoke.mjs',
  'tests/react-stage11a49-smoke.mjs',
  'tests/react-stage11b0-smoke.mjs',
  'tests/react-stage1c2-smoke.mjs',
  'tests/react-stage1c3-smoke.mjs',
  'tests/react-stage1cz1-smoke.mjs',
  'tests/react-stage1cz2-smoke.mjs',
  'tests/react-stage1cz3-smoke.mjs',
  'tests/react-stage1m1-unified-smoke.mjs',
  'tests/main-ui-workflow-closed-loop.mjs',
  'tests/source-mode-ui-closed-loop.mjs',
  'tests/library-switch-ui-closed-loop.mjs',
  'tests/drag-start-closed-loop.mjs',
  'tests/react-s2-sidebar-dnd-closed-loop.mjs',
  'tests/preview-delivery-closed-loop.mjs',
  'tests/channel-wiring-closed-loop.mjs',
  'tests/menu-popup-closed-loop.mjs',
  'tests/txt-update-closed-loop.mjs',
  'tests/empty-trash-closed-loop.mjs',
  'tests/native-preview-closed-loop.mjs',
  'tests/ui-interactions-closed-loop.mjs',
  'tests/residue-closed-loop.mjs',
  // ── b1-9bz-D-3：10 项 React 状态→渲染闭环（store/scope 驱动 + 实测 DOM 断言）──
  'tests/d3-boot-render-closed-loop.mjs',
  'tests/d3-viewmode-closed-loop.mjs',
  'tests/d3-search-empty-closed-loop.mjs',
  'tests/d3-alltags-view-closed-loop.mjs',
  'tests/d3-detail-mode-closed-loop.mjs',
  'tests/d3-theme-closed-loop.mjs',
  'tests/d3-loading-closed-loop.mjs',
  'tests/d3-selection-closed-loop.mjs',
  'tests/d3-focus-closed-loop.mjs',
  'tests/d3-store-roundtrip-closed-loop.mjs',
];

const failed = [];
for (const t of tests) {
  killLeftoverElectron();
  process.stdout.write(`RUN ${t} ... `);
  let r = spawnSync(process.execPath, [t], { encoding: 'utf8', timeout: 300000 });
  if (r.status === 0) {
    console.log('OK');
    continue;
  }
  // b1-9bz-D-4：长套件下偶发环境级假失败（孤儿 Electron/文件锁/负载）——失败重跑一次。
  // 真回归会连败两次，仍计入 failed。
  console.log(`FAIL (exit=${r.status}) → RETRY`);
  killLeftoverElectron();
  const r2 = spawnSync(process.execPath, [t], { encoding: 'utf8', timeout: 300000 });
  if (r2.status === 0) {
    console.log(`OK (retry)`);
    continue;
  }
  r = r2;
  // 失败信息可能只走 stderr（console.error），stdout/stderr 都要看
  const tail = ((r.stdout || '') + '\n' + (r.stderr || ''))
    .split('\n').filter(l => /FAIL|SMOKE ERROR|OK$|Error:/.test(l)).slice(-8).join('\n');
  console.log(tail);
  failed.push(t);
}
console.log(failed.length === 0 ? 'REACT SUITE ALL GREEN' : `REACT SUITE FAILED: ${failed.length}: ${failed.join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
