import fs from 'node:fs';

const file = 'src/app/react/core/controllerFns.ts';
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');

const decl = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^\s*var (__lv_\w+)\s*;\s*$/.exec(lines[i]);
  if (m) decl.push(m[1]);
}

// 找每个 __lv_X 的「局部绑定」出现：var/let/const __lv_X，或作为形参
const bound = {};
for (const n of decl) {
  const re = new RegExp('(?:\\bvar\\s+|\\blet\\s+|\\bconst\\s+)' + n + '(?![\\w$])', 'g');
  const m = text.match(re);
  bound[n] = m ? m.length : 0;
}

// initLinkVars 里赋的是「无前缀」还是「有前缀」
const start = lines.findIndex((l) => /const initLinkVars = \(\) =>/.test(l));
let depth = 0, end = start;
for (let i = start; i < lines.length; i++) {
  for (const ch of lines[i]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth === 0 && i > start) { end = i; break; }
}
const initLines = lines.slice(start, end + 1);
console.log('initLinkVars: lines', start + 1, '-', end + 1);

console.log('\n=== 无局部绑定的 __lv_*（完全依赖 initLinkVars 赋值）===');
const orphan = [];
for (const n of decl) {
  // 是否出现在 initLinkVars（任意形式）
  const inInit = initLines.some((l) => new RegExp('(?<![\\w$])' + n + '(?![\\w$])').test(l));
  const bare = n.replace(/^__lv_/, '');
  const inInitBare = initLines.some((l) => new RegExp('(?<![\\w$])' + bare + '(?![\\w$])').test(l));
  if (bound[n] === 0) {
    orphan.push({ n, inInit, inInitBare });
    console.log(n, '| initLinkVars 有前缀:', inInit, '| 无前缀:', inInitBare);
  }
}

console.log('\n=== initLinkVars 中「无前缀」赋值一览 ===');
for (let i = start; i <= end; i++) {
  const m = /^\s*(pinyinCache|updateListHeight|saveListHeight|setLastFolder|start|image|video|autoplay|src|vq|mute|thumbnailPath|offset|x|y|width|height|delay|comment|offsetY|html|transformsJSON|file|packPath|libraryPath|fds|folderId|filePath|ext|files|now|tags|group|result|selected|idx|target)\s*=/.exec(lines[i]);
  if (m) console.log('  ', (i + 1) + ': ' + lines[i].trim().slice(0, 70));
}
