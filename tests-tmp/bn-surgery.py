# -*- coding: utf-8 -*-
"""b1-9bn span surgery v2 (content-anchor location, no hand-calculated line numbers)."""
import io
import os

CF = 'src/app/react/core/controllerFns.ts'
lines = io.open(CF, encoding='utf-8').read().split('\n')

def find_line(pred, desc, lo=0, hi=None):
    hi = hi if hi is not None else len(lines)
    hits = [i for i in range(lo, min(hi, len(lines))) if pred(lines[i])]
    assert len(hits) == 1, f'{desc}: {len(hits)} hits at {[h + 1 for h in hits]}'
    return hits[0]

i_url_cmt = find_line(lambda l: l.lstrip().startswith('// URL_MODULE'), 'URL comment', 0, 300)
i_url = find_line(lambda l: l.startswith('const URL_MODULE'), 'URL head', 0, 300)
i_url_end = i_url
while not lines[i_url_end].rstrip().endswith('})();'): i_url_end += 1

i_cm_cmt = find_line(lambda l: l.lstrip().startswith('// ContextMenu\uff08bundle'), 'CM comment', 0, 300)
i_cm = find_line(lambda l: l.startswith('const ContextMenu'), 'CM head', 0, 300)
i_cm_end = i_cm
while not lines[i_cm_end].rstrip().endswith('};'): i_cm_end += 1

i_rn_cmt = find_line(lambda l: l.lstrip().startswith('// renameImages'), 'rename comment', 0, 300)
i_rn = find_line(lambda l: l.startswith('function renameImages'), 'rename head', 0, 300)
depth = 0; i = i_rn
while True:
    depth += lines[i].count('{') - lines[i].count('}')
    if depth == 0 and i > i_rn: break
    i += 1
i_rn_end = i

i_a_cmt = find_line(lambda l: l.lstrip().startswith('/* openItemContextMenu'), 'A head')
i_glh = find_line(lambda l: l.lstrip().startswith('/* getLibraryHistory'), 'A neighbor')
assert lines[i_glh - 1].strip() == '' and lines[i_glh - 2].rstrip() == '  };', 'A tail'

assert (i_url_cmt, i_url, i_url_end) == (92, 93, 100)
assert (i_cm_cmt, i_cm, i_cm_end) == (102, 104, 113)
assert (i_rn_cmt, i_rn, i_rn_end) == (115, 117, 135)
assert (i_a_cmt, i_glh) == (912, 2080)

url_block = lines[i_url_cmt:i_url_end + 1]
cm_block = lines[i_cm_cmt:i_cm_end + 1]
rename_block = lines[i_rn_cmt:i_rn_end + 1]
a_block = lines[i_a_cmt:i_glh - 1]
assert a_block[-1].rstrip() == '  };'
assert len(a_block) == 1167, len(a_block)

os.makedirs('tests-tmp/bn-extracts', exist_ok=True)
io.open('tests-tmp/bn-extracts/url-contextmenu.ts', 'w', encoding='utf-8', newline='').write(
    '\n'.join(url_block) + '\n\n' + '\n'.join(cm_block) + '\n')
io.open('tests-tmp/bn-extracts/rename.ts', 'w', encoding='utf-8', newline='').write(
    '\n'.join(rename_block) + '\n')
io.open('tests-tmp/bn-extracts/openItemContextMenu.ts', 'w', encoding='utf-8', newline='').write(
    '\n'.join(a_block) + '\n')

lines[i_a_cmt:i_a_cmt + 1167] = [
    '  /* openItemContextMenu\uff08b1-9bn\uff1a1,159 \u884c async \u6784\u5efa\u5668\u6574\u4f53\u8fc1 itemMenuService\uff1b',
    '     fns \u8868\u7559\u58f3\u8d70 itemMenuOpenItemContextMenu\uff0c\u6302\u8f7d\u9762/\u952e\u4f4d\u8868/\u5185\u90e8\u8c03\u7528\u96f6\u6539\u52a8\uff09 */',
    '  fns["openItemContextMenu"] = function (...args) {',
    '    try { initLinkVars(); } catch (err) { /* link var \u521d\u59cb\u5316\u5931\u8d25\u4e0d\u963b\u585e\uff08bundle \u540e\u5907\u4ecd\u5728\uff09 */ }',
    '    return itemMenuOpenItemContextMenu(getScope(), ...args);',
    '  };',
]
del lines[i_rn_cmt:i_rn_end + 1]
del lines[i_cm_cmt:i_cm_end + 1]
del lines[i_url_cmt:i_url_end + 1]
lines.insert(i_url_cmt, '// b1-9bn\uff1aURL_MODULE / ContextMenu / renameImages \u5df2\u8fc1 contextMenuDomain.ts')

out = '\n'.join(lines)
assert 'const URL_MODULE' not in out and 'const ContextMenu' not in out
assert 'function renameImages' not in out and 'await getAssociatedApplications' not in out
assert out.count('itemMenuOpenItemContextMenu') == 2

imp_anchor = None
for i, ln in enumerate(lines[:60]):
    if "getFilter as machineryGetFilter } from './dataMachinery';" in ln:
        imp_anchor = i; break
assert imp_anchor is not None, 'import anchor'
lines[imp_anchor + 1:imp_anchor + 1] = [
    '// b1-9bn\uff1a\u83dc\u5355\u65cf\u7ad6\u5207\u2014\u2014builder \u8fc1 itemMenuService\uff1bURL_MODULE/ContextMenu/renameImages \u8fc1',
    '// contextMenuDomain\uff08getContextMenu \u4f9b\u5176\u4f59 8 \u4e2a\u83dc\u5355 builder \u6682\u7559\u6d88\u8d39\uff0cbo \u6279\u968f\u9891\u9053\u5207\u6362\u4e00\u5e76\u5f52\u4f4d\uff09',
    "import { itemMenuOpenItemContextMenu } from '../services/itemMenuService';",
    "import { getContextMenu, renameImages } from './contextMenuDomain';",
]

out = '\n'.join(lines)
io.open(CF, 'w', encoding='utf-8', newline='').write(out)
print('OK new line count', len(lines))
print('B', len(url_block) + len(cm_block), '/ C', len(rename_block), '/ A 1167 -> 6')
