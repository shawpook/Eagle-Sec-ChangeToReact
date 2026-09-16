/**
 * React 全量回归套件（100 项，顺序隔离执行）。
 * 项数以 `react-suite-manifest.mjs` 的 `REACT_SUITE` 长度为准；合并各批次的登记项时
 * 必须重新数一遍长度再改这里——历史上多次出现注释与实际长度不同步（71/72/73/77/79 都写过）。
 * R8 起并入 F15 `preload-subscriptions` 与 F13-preview `preview-entry-subscriptions`
 * ——两者原先不属任何套件（只有 docs 里的手工运行记录），M4-R 审计发现后登记。
 * R9 起并入 M3-1 `match-rules-equivalence` 与 M4-C `m4-preview-dispose`。
 * R10 起并入 M2-4/M7-1 `module-registry-contract`（34 项分支等价性 + /index.js 绕过封堵）。
 * R11 起并入 M4-A `m4-url-history` 与 M3-2 `m3-filter-cold-start`、M4-B `m4-window-subscriptions`。
 * R12 起并入 M3-3 `worker-cancel-writeback` 与 `worker-protocol-contract`。
 * R13 起并入 M4-D `m4-ng-click-pairing` / `m4-engine-lifecycle` / `m4-domlite-containment`。
 * R14 起并入 M4-E `f11-scope-face-late-registration`。
 * R20 起并入 M8-4 `workbench-thumbnail-placeholder`（工作台缺图占位，CDP 拦截造阳性对照）。
 * R19 起并入 M8-2 `video-fixture-duration`（视频夹具的 EBML Duration 注入器，纯 Node）。
 * R18 起并入三个长期**不属任何套件**的 M1 交付测试（D15 同类问题，M8 覆盖面补齐）：
 * `f08f09-action-supply-contract`（W12）/ `image-transform-closed-loop`（W10）/
 * `source-mode-browse-closed-loop`（P3-b）。三者单独实跑通过后才登记，断言一字未改。
 * R17 起并入 M7-3 `publish-asset-manifest`（发布资产登记驱动：清单与源码实扫对账 +
 * 「复制源缺失必须拒绝」，守护任务书 M7 点名的「整树 copy → 登记驱动」与「复制失败即失败」两条）。
 * R16 起并入 M6-4 `webview-tag-enabled`（真机门禁：webviewTag 恢复后三处 <webview> 真的
 * guest 化、M6-3 解析出的 file:// preload 真的在 guest 内执行；起真实 Electron + Vite dev）。
 * R15 起并入 M7-2 `tab-bar-closed-loop`（改造为 11 项负向门禁）与 M6-3 `plugin-format-preload`
 * （格式插件 preload 的唯一解析点：三处调用点原先各自内联的惯用式，在包括 Electron 生产态
 * 在内的任何运行态下都产出 http:// URL，而 <webview preload> 只接受文件系统路径）。
 * （M5-2 的两个生产验收进了 `ARTIFACT_TESTS`，起完整生产栈 + Electron，不属本套件）。
 * b1-9ba 起第 1 项为彻底化哨兵、b1-9bc 起第 2 项为自研 utils 单元测试——
 * 两者均无 Electron、秒级以内，放最前让倒退最快暴露。
 * R0 起并入连续网格几何与滚动/自动定位两项；R2 并入 shim 模块边界检查；R3 并入类型门禁、R4 并入 scope 字段收敛台账（见数组内注释）。
 *
 * R7 起**清单移入 `tests/react-suite-manifest.mjs`**（与统一验收入口 `frontend-acceptance.mjs`
 * 共用同一事实来源）：本文件只负责执行（顺序 + 隔离清理 + 失败重跑一次），
 * 清单与分类不得在此再抄一份。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REACT_SUITE as tests } from './react-suite-manifest.mjs';

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

const failed = [];
const retried = [];
// 失败信息可能只走 stderr（console.error），stdout/stderr 都要看。
// R7：过滤后为空时**回落到原始尾部**——continuous-grid-scroll 的首败就是这样：
// 输出里没有 FAIL/Error: 形态的行，过滤结果为空，等于首败没留下任何线索。
const failureTail = (r, lines = 8) => {
  const all = ((r.stdout || '') + '\n' + (r.stderr || '')).split('\n');
  const filtered = all.filter(l => /FAIL|SMOKE ERROR|OK$|Error:|WATCHDOG/.test(l)).slice(-lines);
  if (filtered.length > 0) return filtered.join('\n');
  const raw = all.filter(l => l.trim().length > 0).slice(-lines);
  return raw.length > 0 ? `（无匹配行，原始尾部）\n${raw.join('\n')}` : '（无任何输出）';
};
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
  // R7：**首败也打印断言尾部**——R6 全量运行时 react-s2-sidebar-dnd 首败但重跑即过，
  // 因当时只在「二连败」分支打印，首败的具体断言名没有留下（事后无法归因）。
  // 现在首败即留证（重跑仍会覆盖：两个尾部都打印），不改任何断言、不放宽判据。
  console.log(`FAIL (exit=${r.status}) → RETRY`);
  console.log(`  [first-failure] ${failureTail(r, 5)}`);
  killLeftoverElectron();
  const r2 = spawnSync(process.execPath, [t], { encoding: 'utf8', timeout: 300000 });
  if (r2.status === 0) {
    retried.push(t);
    console.log(`OK (retry)`);
    continue;
  }
  console.log(`  [retry-failure] ${failureTail(r2, 5)}`);
  failed.push(t);
}
const okCount = tests.length - failed.length - retried.length;
console.log(
  `REACT SUITE ${failed.length === 0 ? 'ALL GREEN' : `FAILED: ${failed.length}: ${failed.join(', ')}`}`
  + ` （${tests.length} 项：OK ${okCount} + retry-OK ${retried.length}`
  + `${failed.length ? ` + FAIL ${failed.length}` : ''}）`,
);
if (retried.length > 0) console.log(`注意：以下项首跑失败、重跑通过（低频/环境相关，证据见上）：${retried.join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
