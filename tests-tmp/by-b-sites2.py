# -*- coding: utf-8 -*-
"""b1-9by-B 手术脚本 v2（sidebar/tagManager 面）。单 apply 路径；排除独立窗口。"""
import re, io, os

BASE = 'src/app/react'
RCV = r'(?:s|scope|\$scope|\$rootScope|w|window|body|bs|rootScope|getBodyScope\(\)|this)'
ARR = r'(?:push|splice|pop|shift|unshift)'

SIDEBAR_FIELDS = r'(?:currentId|folderKeyword|isCleaningTrash|isUILoaded|isExpandFolder|isExpandSmartFolder|isExpandQuickAccess|showSlowNotify|showNTFSWarning|paletteQueuePaused|currentProcessCount|sidebarIndex|libraryPath|libraryName)'
SIDEBAR_ARRS = r'(?:sidebarList|quickAccess|smartFolderList|folderList|tags|trash|all)'

PATTERNS = [
    (re.compile(RCV + r'\.' + SIDEBAR_FIELDS + r'\s*=(?!=)'), ['syncSidebarFromScope();']),
    (re.compile(RCV + r'\.' + SIDEBAR_ARRS + r'(\s*=(?!=)|\.' + ARR + r'\(|\.length\s*=(?!=))'), ['syncSidebarFromScope();']),
    (re.compile(RCV + r'\.TagManager(\s*=(?!=)|\.' + ARR + r'\(|\.\w+\s*=(?!=))'), ['syncTagManagerFromScope();']),
    (re.compile(RCV + r'\.(?:selectedTags|selectingTags)(\s*=(?!=)|\[[^\]]+\]\s*=(?!=))'), ['syncTagManagerFromScope();']),
    (re.compile(RCV + r'\.currentTagGroup\s*=(?!=)'), ['syncTagManagerFromScope();']),
    (re.compile(RCV + r'\.newGroupName\s*=(?!=)'), ['syncTagManagerFromScope();']),
    (re.compile(RCV + r'\.tagViewMode(Name|LayoutMode)?\s*=(?!=)'), ['syncTagManagerFromScope();']),
    (re.compile(RCV + r'\.containerSize(\s*=(?!=)|\.\w+\s*=(?!=))'), ['syncSidebarFromScope();', 'syncTagManagerFromScope();']),
]

EXCLUDE_DIRS = ('preview-window', 'collect-window', 'store', 'preferences', 'node_modules')
SIDEBAR_IMPS = {'syncSidebarFromScope': '../store/sidebarState'}
TM_IMPS = {'syncTagManagerFromScope': '../store/tagManagerState'}

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

def store_mod(rel):
    top = rel.replace(os.sep, '/').split('/')[0]
    sub = rel.replace(os.sep, '/')
    if sub.startswith('components/'):
        return '../../store/sidebarState', '../../store/tagManagerState'
    return '../store/sidebarState', '../store/tagManagerState'

def main():
    total = 0
    for dirpath, _, files in os.walk(BASE):
        rel_dir = dirpath.replace(BASE + os.sep, '').replace(BASE + '/', '')
        if any(rel_dir.startswith(x) or x in rel_dir for x in EXCLUDE_DIRS):
            continue
        for fn in files:
            if not fn.endswith(('.ts', '.tsx')):
                continue
            p = os.path.join(dirpath, fn)
            rel = p.replace(BASE + os.sep, '').replace(BASE + '/', '')
            if rel in ('main.tsx',):
                continue
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
            need_sb = any('syncSidebarFromScope' in x for _, ins in [(0, [y for pl in plan for y in pl[1]])] for x in ins) or any('syncSidebarFromScope' in x for pl in plan for x in pl[1])
            need_tm = any('syncTagManagerFromScope' in pl[1][0] or any('syncTagManagerFromScope' in x for x in pl[1]) for pl in plan)
            mod_sb, mod_tm = store_mod(rel)
            li = last_import_end(lines)
            imp_add = []
            if need_sb and 'syncSidebarFromScope' not in imported:
                imp_add.append('import { syncSidebarFromScope } from \'%s\';\n' % mod_sb)
            if need_tm and 'syncTagManagerFromScope' not in imported:
                imp_add.append('import { syncTagManagerFromScope } from \'%s\';\n' % mod_tm)
            if imp_add:
                lines[li+1:li+1] = imp_add
            io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lines))
            total += len(plan)
            print('applied %s: %d' % (rel, len(plan)))
    print('TOTAL:', total)

main()
