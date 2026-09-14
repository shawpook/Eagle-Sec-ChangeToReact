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
  }
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
const pending = [...ledger.entries()].sort((a, b) => b[1] - a[1]);
console.log(`SCOPE_CONVERGENCE_OK：已收敛 ${convergedFields.length} 个字段（${convergedFields.join(', ')}）无字符串键残留`);
if (pending.length > 0) {
  const top = pending.slice(0, 12).map(([field, count]) => `${field}(${count})`).join(' ');
  console.log(`  待收敛字段台账（${pending.length} 个，调用量降序）：${top}${pending.length > 12 ? ' …' : ''}`);
}
