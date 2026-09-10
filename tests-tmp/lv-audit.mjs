import fs from 'node:fs';

const file = 'src/app/react/core/controllerFns.ts';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// 1) 声明块
const decl = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^\s*var (__lv_\w+)\s*;\s*$/.exec(lines[i]);
  if (m) decl.push({ name: m[1], line: i + 1 });
}
console.log('declared link vars:', decl.length);

// 2) initLinkVars 区间（花括号配平）
const start = lines.findIndex((l) => /const initLinkVars = \(\) =>/.test(l));
let depth = 0, end = start;
for (let i = start; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth === 0 && i > start) { end = i; break; }
}
console.log('initLinkVars: lines', start + 1, '-', end + 1);
const inInit = (n) => n >= start && n <= end;

// 3) initLinkVars 内赋值
const initAssigns = [];
for (let i = start; i <= end; i++) {
  const m = /(__lv_\w+)\s*=(?!=)/.exec(lines[i]);
  if (m) initAssigns.push((i + 1) + ': ' + lines[i].trim().slice(0, 80));
}
console.log('initLinkVars __lv_ assignments:', initAssigns.length);
initAssigns.slice(0, 20).forEach((a) => console.log('   ', a));

// 4) 每个声明变量的读取点（排除声明行/initLinkVars/对象字面量 key）
const reads = {};
for (let i = 0; i < lines.length; i++) {
  if (inInit(i)) continue;
  const line = lines[i];
  for (const d of decl) {
    if (i + 1 === d.line) continue;
    const re = new RegExp('(?<![\\w$])' + d.name + '(?![\\w$])', 'g');
    let m;
    while ((m = re.exec(line))) {
      // 对象字面量 key：形如 __lv_path:
      const after = line.slice(m.index + d.name.length);
      if (/^\s*:/.test(after)) continue;
      // 声明：var __lv_x
      const before = line.slice(0, m.index);
      if (/var\s+$/.test(before)) continue;
      (reads[d.name] = reads[d.name] || []).push((i + 1) + ': ' + line.trim().slice(0, 100));
    }
  }
}
console.log('\n=== link vars with reads ===');
for (const n of Object.keys(reads)) {
  console.log('---', n, '(' + reads[n].length + ')');
  reads[n].slice(0, 3).forEach((r) => console.log('   ', r));
}
