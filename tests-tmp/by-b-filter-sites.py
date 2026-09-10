# -*- coding: utf-8 -*-
"""b1-9by-B 手术脚本 v3（filter 面）+ machineryFilterContent 汇聚点。单 apply 路径。"""
import re, io, os

BASE = 'src/app/react'
RCV = r'(?:s|scope|\$scope|\$rootScope|w|window|body|bs|rootScope|getBodyScope\(\)|this)'
ARR = r'(?:push|splice|pop|shift|unshift)'
FILTER_FIELDS = r'(?:isOpen|isLock|toolbar|pinned|filterRules|filterCounts|filterCameras|filterTypes|tagFilterLogic|folderFilterLogic|filterFolderKeyword)'

PATTERNS = [
    # eagle.filter.<field> = / bare alias filter.<field> =
    (re.compile(r'(?:\beagle|this)\.filter\.' + FILTER_FIELDS + r'\s*=(?!=)'), ['syncFilterFromScope();']),
    (re.compile(r'^\s*filter\.' + FILTER_FIELDS + r'\s*=(?!=)'), ['syncFilterFromScope();']),
    (re.compile(RCV + r'\.(?:containFolders|containTags)(\s*=(?!=)|\.' + ARR + r'\(|\.length\s*=(?!=))'), ['syncFilterFromScope();']),
    (re.compile(RCV + r'\.tagKeyword\s*=(?!=)'), ['syncFilterFromScope();']),
    (re.compile(RCV + r'\.filterImportDateMonths(\s*=(?!=)|\.' + ARR + r'\(|\.length\s*=(?!=))'), ['syncFilterFromScope();']),
    # TagManager 写点追加 filter sync（groups 进 filter 快照）——by-b-sites2 已有 syncTagManagerFromScope，本笔补第二行
    (re.compile(RCV + r'\.TagManager(\s*=(?!=)|\.' + ARR + r'\(|\.\w+\s*=(?!=))'), ['syncFilterFromScope();']),
]

EXCLUDE_DIRS = ('preview-window', 'collect-window', 'store', 'node_modules')

def is_skippable(line):
    t = line.strip()
    return t.startswith('//') or t.startswith('/*') or t.startswith('*') or "'$scope." in line or '"$scope.' in line

def brace_end(lines, start):
    depth = 0
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
        if depth <= 0:
            return i if i > start else start
    return start

def last_import_end(lines):
    end = -1
    for i, l in enumerate(lines):
        if re.match(r"^import\s+.*from\s+'[^']*';\s*$", l) or re.match(r"^} from '[^']*';\s*$", l):
            end = i
    return end

def main():
    total = 0
    for dirpath, _, files in os.walk(BASE):
        rel_dir = dirpath.replace(BASE + os.sep, '').replace(BASE + '/', '')
        if any(x in rel_dir for x in EXCLUDE_DIRS):
            continue
        for fn in files:
            if not fn.endswith(('.ts', '.tsx')):
                continue
            p = os.path.join(dirpath, fn)
            rel = p.replace(BASE + os.sep, '').replace(BASE + '/', '')
            lines = io.open(p, encoding='utf-8').read().splitlines(True)
            plan = []
            seen = set()
            for i, line in enumerate(lines):
                if is_skippable(line):
                    continue
                for pat, ins in PATTERNS:
                    if pat.search(line):
                        if i in seen:
                            break
                        seen.add(i)
                        indent = re.match(r'\s*', line).group(0)
                        if line.rstrip('\n').rstrip().endswith('{'):
                            plan.append((brace_end(lines, i), [indent + x + '\n' for x in ins]))
                        else:
                            plan.append((i, [indent + x + '\n' for x in ins]))
                        break
            if not plan:
                continue
            for after, inserts in sorted(plan, reverse=True):
                lines[after+1:after+1] = inserts
            src = ''.join(lines)
            imported = set()
            for grp in re.findall(r'import\s*\{([^}]*)\}\s*from', src):
                imported.update(x.strip() for x in grp.split(','))
            if 'syncFilterFromScope' not in imported:
                mod = '../../store/filterState' if rel.startswith('components') else '../store/filterState'
                li = last_import_end(lines)
                lines[li+1:li+1] = ['import { syncFilterFromScope } from \'%s\';\n' % mod]
            io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lines))
            total += len(plan)
            print('applied %s: %d' % (rel, len(plan)))
    print('TOTAL:', total)

main()
