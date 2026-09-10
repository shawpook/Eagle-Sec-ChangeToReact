// 提取脚本未声明全局审计（不提交）：纯正则启发式。
// 对每个 vendor/eagle-*.js：收集本文件声明名（var/let/const/function/class + 常见参数形态），
// 收集裸标识符使用（排除 .prop 属性位、字符串、注释），差集减已知 window 全局 → 嫌疑清单。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const vendorDir = path.join(projectRoot, 'frontend', 'public', 'vendor');

const KNOWN_GLOBALS = new Set([
  'window', 'document', 'navigator', 'location', 'history', 'console', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'alert',
  'confirm', 'prompt', 'localStorage', 'sessionStorage', 'JSON', 'Math', 'Date', 'Object', 'Array',
  'String', 'Number', 'Boolean', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise', 'Map', 'Set',
  'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'Function', 'arguments',
  'globalThis', 'undefined', 'NaN', 'Infinity', 'eval', 'Blob', 'File', 'FileReader', 'FormData',
  'Image', 'Audio', 'XMLHttpRequest', 'WebSocket', 'Worker', 'URL', 'URLSearchParams',
  'TextDecoder', 'TextEncoder', 'Buffer', 'process', 'module', 'exports', 'require', 'define',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'PerformanceObserver', 'performance',
  'getComputedStyle', 'matchMedia', 'scrollTo', 'scrollBy', 'scrollX', 'scrollY', 'innerWidth',
  'innerHeight', 'devicePixelRatio', 'addEventListener', 'removeEventListener', 'dispatchEvent',
  'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'Event', 'Node', 'Element', 'HTMLElement',
  'structuredClone', 'queueMicrotask', 'reportError', 'atob', 'btoa', 'crypto', 'AbortController',
  'DOMParser', 'XMLSerializer', 'CSS',
  '$', 'jQuery', 'angular', 'eagle', 'i18n', '_', 'swal', 'ipcRenderer', 'electron', 'electronSettings',
  'electronLog', 'pluginModule', 'EagleConfig', 'EAGLE_THUMBNAIL_TEMP_PATH', 'preferences',
  '$bodyScope', '$rootScope', 'getHashID', 'FileUrlHelper', 'ItemManager', 'ItemFilter',
  'ItemViewManager', 'IPCHelper', 'analytics', 'RecentFileManager', 'EagleApi', 'APIServer',
  'ngGridLayoutData', 'resetNgGridLayoutData', 'ig', 'NgGridStrings',
  'HoverPreview', 'AnnotationPreview', 'cleanupBoxHoverPreview', 'startHoverPreviewWatch',
  'removePlayingAudios', 'removeBoxAudioPlayer', 'playingAudiosElements', 'TextManager',
  'throttle', 'debounce', 'guid', 'getExt', 'byteSize', 'unrom', 'sanitize', 'dcraw', 'toArrayBuffer',
  'Mousetrap', 'flatpickr', 'tippy', 'currentWindow', 'remote', 'dialog', 'app', 'clipboard',
  'nativeImage', 'shell', 'fse', 'fs', 'path', 'os', 'exec', 'execFile', 'async', 'appRoot',
  'tinyPinyin', 'pinyinlite', 'chineseConvert', 'languageBCP', 'hasCallback', 'dragging',
  'top', 'parent', 'self', 'frames', 'event', 'open', 'close', 'focus', 'blur', 'name', 'origin',
  'sort', 'scroll', 'moveTo', 'resizeTo', 'getSelection', 'find', 'length', 'true', 'false', 'null',
  'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'try', 'catch', 'finally', 'throw', 'var', 'let', 'const', 'function', 'class', 'typeof',
  'instanceof', 'in', 'of', 'delete', 'void', 'this', 'super', 'extends', 'import', 'export',
  'default', 'async', 'await', 'yield', 'static', 'get', 'set',
]);

function stripNoise(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

for (const file of fs.readdirSync(vendorDir).filter((f) => f.startsWith('eagle-') && f.endsWith('.js'))) {
  const full = path.join(vendorDir, file);
  const code = stripNoise(fs.readFileSync(full, 'utf8'));
  const declared = new Set();
  let m;
  const declRe = /(?:^|[;,{(\s])(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = declRe.exec(code)) !== null) declared.add(m[1]);
  // 多声明符 var a = 1, b = 2
  const multiRe = /(?:var|let|const)\s+[^;\n]{0,400}/g;
  while ((m = multiRe.exec(code)) !== null) {
    const seg = m[0].slice(4);
    const idRe = /([A-Za-z_$][\w$]*)\s*(?:=|,|$)/g;
    while ((m = idRe.exec(seg)) !== null) declared.add(m[1]);
  }
  const fnRe = /function\s+([A-Za-z_$][\w$]*)/g;
  while ((m = fnRe.exec(code)) !== null) declared.add(m[1]);
  const clsRe = /class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = clsRe.exec(code)) !== null) declared.add(m[1]);
  // 参数粗收：function (a, b) / (a, b) => / a =>（单参）
  const paramRe = /function\s*\(([^)]{0,300})\)|\(([^)]{0,120})\)\s*=>|([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = paramRe.exec(code)) !== null) {
    const params = m[1] || m[2] || m[3] || '';
    for (const piece of params.split(',')) {
      const id = piece.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (id) declared.add(id[1]);
    }
  }
  // catch (e)
  const catchRe = /catch\s*\(\s*([A-Za-z_$][\w$]*)/g;
  while ((m = catchRe.exec(code)) !== null) declared.add(m[1]);

  // 裸标识符使用
  const used = {};
  const idRe = /(?<![\w$.'"`])([A-Za-z_$][\w$]*)\s*(?=[\s;,,)\]}.:+=*/%<>!&|^?-])/g;
  while ((m = idRe.exec(code)) !== null) {
    const n = m[1];
    if (declared.has(n) || KNOWN_GLOBALS.has(n)) continue;
    used[n] = (used[n] || 0) + 1;
  }
  const missing = Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log(`${file}: ${missing.length ? 'SUSPECT → ' + missing.map(([n, c]) => `${n}×${c}`).join(', ') : 'clean'}`);
}
