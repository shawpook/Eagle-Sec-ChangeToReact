// bw 考据：解析 React 树全部 swal 调用点的顶层 options 键 + Promise 消费形态
import fs from 'node:fs';
import path from 'node:path';

const root = 'src/app/react';
const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
})(root);

const keyCounter = {};
const sites = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // 找 swal( 直调点（w.swal( / window.swal( / sweetAlert( / swal(）
  const re = /(?:w\(\)\.swal|w\.swal|window\.swal|sweetAlert|swal)\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length - 1; // 指向 {
    // brace-depth 扫描找对象尾
    let depth = 0, end = -1;
    for (let i = start; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
      else if (c === '"' || c === "'" || c === '`') {
        const q = c; i++;
        while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      }
    }
    if (end < 0) continue;
    const body = src.slice(start + 1, end);
    // 顶层键（depth 0 的 identifier: 模式；字符串/模板字面量内容跳过）
    const keys = [];
    let d = 0, k = '';
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === '"' || c === "'" || c === '`') {
        const q = c; i++;
        while (i < body.length && body[i] !== q) { if (body[i] === '\\') i++; i++; }
        if (k && d === 0) { let j = i + 1; while (j < body.length && /\s/.test(body[j])) j++; if (body[j] === ':') keys.push(k); }
        k = '';
        continue;
      }
      if (c === '{' || c === '(' || c === '[') { d++; k = ''; continue; }
      if (c === '}' || c === ')' || c === ']') { d--; k = ''; continue; }
      if (d === 0 && /[A-Za-z0-9_$]/.test(c)) { k += c; continue; }
      if (d === 0 && k) {
        let j = i;
        while (j < body.length && /\s/.test(body[j])) j++;
        if (body[j] === ':') keys.push(k);
        k = '';
      }
    }
    // 调用点之后的消费形态（下 300 字符）
    const after = src.slice(end + 1, end + 300).replace(/\s+/g, ' ');
    const consumption = /\.then\s*\(/.test(after) ? 'then' : (/\bawait\b/.test(src.slice(Math.max(0, m.index - 60), m.index)) ? 'await' : (/\((function|\([^)]*\)\s*=>)/.test(after) ? 'callback?' : 'fire-and-forget'));
    for (const k of keys) keyCounter[k] = (keyCounter[k] || 0) + 1;
    sites.push({ file: file.replace(/\\/g, '/'), line: src.slice(0, m.index).split('\n').length, keys, consumption });
  }
}
console.log('== top-level option keys ==');
for (const [k, n] of Object.entries(keyCounter).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(2)} ${k}`);
console.log(`\n== ${sites.length} call sites ==`);
for (const s of sites) console.log(`${s.file}:${s.line} [${s.consumption}] ${s.keys.join(',')}`);
