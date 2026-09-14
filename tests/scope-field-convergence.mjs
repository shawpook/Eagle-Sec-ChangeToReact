/**
 * R4 守卫：scope 字段「零字符串键」收敛台账。
 *
 * R4 的分域收敛是把 `writeScopeField('<字段>', v)` 换成该域的具体写点（store 导出的具名
 * action）。本项守护已收敛域**不得回退**为字符串键调用，并输出尚未收敛字段的调用量台账
 * （信息性——它是下一个 R4 切片的待办清单，不作为失败条件）。
 *
 * 判定时先剥离注释，避免把文档里出现的示例写法误判成真实调用。
 */
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const reactRoot = path.join(projectRoot, 'src/app/react');

/** 已收敛域：字段 → 提供具名写点的模块。 */
const CONVERGED = {
  selection: {
    module: 'src/app/react/store/selectionState.ts',
    fields: ['selected', 'current', 'lastSelectedIndex'],
    actions: ['writeSelected', 'writeCurrent', 'writeLastSelectedIndex'],
  },
  body: {
    module: 'src/app/react/store/bodyState.ts',
    fields: ['currentFocus', 'viewMode', 'isLoading', 'layout', 'isDetailMode'],
    actions: ['writeCurrentFocus', 'writeViewMode', 'writeIsLoading', 'writeLayout', 'writeIsDetailMode'],
  },
  folder: {
    module: 'src/app/react/store/folderState.ts',
    fields: ['currentFolder', 'currentSmartFolder', 'startCursor'],
    actions: ['writeCurrentFolder', 'writeCurrentSmartFolder', 'writeStartCursor'],
  },
  list: {
    module: 'src/app/react/store/listState.ts',
    fields: ['keyword', 'listDone', 'unfiledCount', 'untaggedCount'],
    actions: ['writeKeyword', 'writeListDone', 'writeUnfiledCount', 'writeUntaggedCount'],
  },
  item: {
    module: 'src/app/react/store/itemState.ts',
    fields: ['raw', 'shuffle', 'trash', 'selectedMappings', 'selectedFolderMappings'],
    actions: ['writeRaw', 'writeShuffle', 'writeTrash', 'writeSelectedMappings', 'writeSelectedFolderMappings'],
  },
  misc: {
    module: 'src/app/react/store/miscRawState.ts',
    fields: ['currentTagGroup', 'selectedTags', 'tagViewMode', 'tagViewModeName', 'hexColor', 'isGifReady', 'subFolders'],
    actions: ['writeCurrentTagGroup', 'writeSelectedTags', 'writeTagViewMode', 'writeTagViewModeName', 'writeHexColor', 'writeIsGifReady', 'writeSubFolders'],
  },
};

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * 旧 scope **动作槽**（`writeScopeField('<名>', machinery*)` 把函数挂到 scope 面）。
 * 它们不是数据字段，是 R6 要退役的旧 scope 函数 API；在此显式登记，使「未登记的落回退」
 * 成为可测不变量，而不是靠人记得。
 */
const ALLOWED_ACTION_SLOTS = new Set([
  'changeSmartFolderName', 'changeSortIncrease', 'toggleShowOriginalImageWhenLarge',
  'showListName', 'showListMetas', 'showListAnnotation', 'showListExtension',
  'showListExtensionLabel', 'toggleSidebar', 'switchLayoutOtpions',
  'createLibrary', 'importLibrary', 'refresh', 'openSearchScopeMenu',
  'onListSizeChange', 'boxListSizeChange',
]);

/** 从 store 文件收集已注册字段：`MIGRATED*` 数组字面量 + `migrateScopeFieldToStore('<名>'` 直调。 */
function collectRegisteredFields() {
  const registered = new Set();
  const storeDir = path.join(reactRoot, 'store');
  for (const entry of fs.readdirSync(storeDir)) {
    if (!entry.endsWith('.ts')) continue;
    const text = stripComments(fs.readFileSync(path.join(storeDir, entry), 'utf8'));
    for (const array of text.matchAll(/const\s+MIGRATED[A-Z_]*[^=]*=\s*\[([\s\S]*?)\]/g)) {
      for (const name of array[1].matchAll(/['"]([A-Za-z_$][\w$]*)['"]/g)) registered.add(name[1]);
    }
    for (const call of text.matchAll(/migrateScopeFieldToStore\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) {
      registered.add(call[1]);
    }
  }
  return registered;
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
})(reactRoot);

const failures = [];
const ledger = new Map();
const registered = collectRegisteredFields();
const unregisteredData = new Set();

for (const file of files) {
  const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  for (const match of code.matchAll(/writeScopeField\(\s*(['"])([A-Za-z_$][\w$]*)\1/g)) {
    const field = match[2];
    ledger.set(field, (ledger.get(field) || 0) + 1);
    for (const [domain, spec] of Object.entries(CONVERGED)) {
      if (spec.fields.includes(field)) {
        failures.push(`${rel}: writeScopeField('${field}') 属已收敛域 ${domain}，应改用具体写点`);
      }
    }
    // R4 不变量：数据字段必须已注册（否则写入落回退分支 `scope[name] = value`）。
    // 未登记的旧动作槽由 ALLOWED_ACTION_SLOTS 显式豁免（R6 退役对象）。
    if (!registered.has(field) && !ALLOWED_ACTION_SLOTS.has(field)) {
      unregisteredData.add(`${field} (${rel})`);
    }
  }
}

if (unregisteredData.size > 0) {
  failures.push(
    ...Array.from(unregisteredData).map(
      (entry) => `未注册字段写入将落回退分支：${entry}（应注册到 store 或登记为动作槽）`,
    ),
  );
}

// 写点必须真的存在于声明的模块里
for (const [domain, spec] of Object.entries(CONVERGED)) {
  const abs = path.join(projectRoot, spec.module);
  if (!fs.existsSync(abs)) { failures.push(`域 ${domain} 的写点模块缺失：${spec.module}`); continue; }
  const code = fs.readFileSync(abs, 'utf8');
  for (const action of spec.actions) {
    if (!new RegExp(`export function ${action}\\s*\\(`).test(code)) {
      failures.push(`域 ${domain} 缺少导出的写点 ${action}（${spec.module}）`);
    }
  }
}

if (failures.length > 0) {
  console.error('SCOPE_CONVERGENCE_FAIL');
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}

const convergedFields = Object.values(CONVERGED).flatMap((spec) => spec.fields);
const pending = [...ledger.entries()].filter(([field]) => !convergedFields.includes(field)).sort((a, b) => b[1] - a[1]);
console.log(`SCOPE_CONVERGENCE_OK：已收敛 ${convergedFields.length} 个字段 / ${Object.keys(CONVERGED).length} 个域，无字符串键残留`);
console.log(`  注册表 ${registered.size} 字段；剩余字符串键写入 ${pending.length} 个字段、其中动作槽 ${[...ledger.keys()].filter((f) => ALLOWED_ACTION_SLOTS.has(f)).length} 个（R6 退役面）；未注册数据字段 0`);
if (pending.length > 0) {
  const top = pending.slice(0, 12).map(([field, count]) => `${field}(${count})`).join(' ');
  console.log(`  待收敛字段台账（${pending.length} 个，调用量降序）：${top}${pending.length > 12 ? ' …' : ''}`);
}
