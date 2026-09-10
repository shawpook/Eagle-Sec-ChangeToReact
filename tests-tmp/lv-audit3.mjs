import fs from 'node:fs';

const file = 'src/app/react/core/controllerFns.ts';
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');

// 切分 fns["name"] = function (...) { ... }; 块
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^\s*fns\["(\w+)"\] = function/.exec(lines[i]);
  if (!m) continue;
  let depth = 0, started = false, end = i;
  for (let j = i; j < lines.length; j++) {
    for (const ch of lines[j]) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; }
    if (started && depth === 0) { end = j; break; }
  }
  blocks.push({ name: m[1], start: i, end });
}
console.log('fns blocks:', blocks.length);

const unbound = [];
for (const b of blocks) {
  const body = lines.slice(b.start, b.end + 1);
  const bodyText = body.join('\n');
  // 局部绑定：var/let/const __lv_X  |  形参 __lv_X  |  function(__lv_X)
  const local = new Set();
  let m;
  const reDecl = /(?:^|[^\w$.])(?:var|let|const)\s+(__lv_\w+)/g;
  while ((m = reDecl.exec(bodyText))) local.add(m[1]);
  const reParam = /function\s*\(([^)]*)\)/g;
  while ((m = reParam.exec(bodyText))) {
    for (const p of m[1].split(',')) {
      const t = p.trim().replace(/=.*$/, '').trim();
      if (/^__lv_\w+$/.test(t)) local.add(t);
    }
  }
  // 读取但未局部绑定
  for (let k = 0; k < body.length; k++) {
    const line = body[k];
    const re = /(?<![\w$])(__lv_\w+)(?![\w$])/g;
    let mm;
    while ((mm = re.exec(line))) {
      const name = mm[1];
      if (local.has(name)) continue;
      // 跳过: 声明行 / 对象字面量 key
      const after = line.slice(mm.index + name.length);
      if (/^\s*:/.test(after)) continue;
      const before = line.slice(0, mm.index);
      if (/(?:var|let|const)\s+$/.test(before)) continue;
      unbound.push({ fn: b.name, line: b.start + k + 1, name, text: line.trim().slice(0, 95) });
    }
  }
}

console.log('\n=== 读取但未在函数内绑定的 __lv_* ===', unbound.length);
const byName = {};
for (const u of unbound) (byName[u.name] = byName[u.name] || []).push(u);
for (const n of Object.keys(byName)) {
  const list = byName[n];
  console.log('---', n, '(', list.length, ') fns:', [...new Set(list.map((x) => x.fn))].join(','));
  list.slice(0, 3).forEach((x) => console.log('    ', x.line + ': ' + x.text));
}
