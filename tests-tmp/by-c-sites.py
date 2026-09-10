# -*- coding: utf-8 -*-
"""b1-9by-C 手术脚本：四链独有字段写点 + 共享写点多 sync。单 apply 路径。"""
import re, io, os

BASE = 'src/app/react'
RCV = r'(?:s|scope|\$scope|\$rootScope|w|window|body|bs|rootScope|getBodyScope\(\)|this)'
ARR = r'(?:push|splice|pop|shift|unshift)'
INSPECTOR_FIELDS = r'(?:newName|newUrl|newAnnotation|newTags|newNamePlaceholder|newUrlPlaceholder|inspectorFolder|inspectorItems|star|size|category|activeTab|isRenaming|showProperties|showTags|showFolders|showComments|width)'
DETAIL_SCALARS = r'(?:useMpvPlayer|showDetailImage|smoothZoomDone|usingGifPlayer|isGifReady|initDetailMode|isCropMode|isCommentMode|commentRect|ratio|sliderZoomRatio|lastZoomMode|supportRotate|supportCrop)'

TB = ['syncToolbarFromScope();']
BD = ['syncBodyFromScope();']
DT = ['syncDetailFromScope();']
IN = ['syncInspectorFromScope();']
TB_IN = ['syncToolbarFromScope();', 'syncInspectorFromScope();']
TB_BD = ['syncToolbarFromScope();', 'syncBodyFromScope();']
ALL4 = ['syncToolbarFromScope();', 'syncBodyFromScope();', 'syncDetailFromScope();', 'syncInspectorFromScope();']

PATTERNS = [
    (re.compile(RCV + r'\.currentTag\s*=(?!=)'), TB),
    (re.compile(RCV + r'\.currentFolderPath\s*=(?!=)'), TB),
    (re.compile(RCV + r'\.selectedSmartFolders(\s*=(?!=)|\.' + ARR + r'\()'), TB),
    (re.compile(RCV + r'\.(?:isMaximize|isAlwaysOnTop)\s*=(?!=)'), TB),
    (re.compile(RCV + r'\.(?:showSuggestions|keywordSuggestions|hsks|searchIndex)\s*=(?!=)'), TB),
    (re.compile(RCV + r'\.pluginModule(\s*=(?!=)|\.\w+\s*=(?!=))'), TB),
    (re.compile(RCV + r'\.MAX_LIST_WIDTH\s*=(?!=)'), TB),
    (re.compile(RCV + r'\.imageSize(\s*=(?!=)|\.(?:width|height)\s*=(?!=))'), ALL4),
    (re.compile(RCV + r'\.listLayoutSettings(\s*=(?!=)|\.\w+(\.\w+)?\s*=(?!=))'), BD),
    (re.compile(RCV + r'\.orderBy\s*=(?!=)'), BD),
    (re.compile(RCV + r'\.currentComment\s*=(?!=)'), BD),
    (re.compile(RCV + r'\.containerSize\.\w+\s*=(?!=)'), BD),
    (re.compile(RCV + r'\.inspector\.' + INSPECTOR_FIELDS + r'\s*=(?!=)'), IN),
    (re.compile(RCV + r'\.inspector\.width\s*=(?!=)'), BD),
    (re.compile(RCV + r'\.trialRemain\s*=(?!=)'), IN),
    (re.compile(RCV + r'\.' + DETAIL_SCALARS + r'\s*=(?!=)'), DT),
    (re.compile(RCV + r'\.(?:gifViewer|gifPlayer)(\s*=(?!=)|\.\w+\s*=(?!=))'), DT),
    (re.compile(RCV + r'\.current\s*=(?!=)'), IN),
    (re.compile(RCV + r'\.selected(\s*=(?!=)|\.' + ARR + r'\(|\.length\s*=(?!=))'), IN),
    (re.compile(RCV + r'\.\$root\.preferences(\.\w+)+\s*=(?!=)'), ['syncToolbarFromScope();', 'syncBodyFromScope();', 'syncDetailFromScope();']),
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

def store_mod(rel, name):
    mod = {'syncToolbarFromScope': 'toolbarState', 'syncBodyFromScope': 'bodyState',
           'syncDetailFromScope': 'detailState', 'syncInspectorFromScope': 'inspectorState'}[name]
    return ('../../store/' if rel.startswith('components') else '../store/') + mod

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
            needed = set()
            for i, line in enumerate(lines):
                if is_skippable(line):
                    continue
                for pat, ins in PATTERNS:
                    if pat.search(line):
                        if i in seen:
                            break
                        seen.add(i)
                        indent = re.match(r'\s*', line).group(0)
                        block = [indent + x for x in ins]
                        if line.rstrip('\n').rstrip().endswith('{'):
                            plan.append((brace_end(lines, i), block))
                        else:
                            plan.append((i, block))
                        for x in ins:
                            needed.add(x[:-3])
                        break
            if not plan:
                continue
            for after, inserts in sorted(plan, reverse=True):
                lines[after+1:after+1] = inserts
            src = ''.join(lines)
            imported = set()
            for grp in re.findall(r'import\s*\{([^}]*)\}\s*from', src):
                imported.update(x.strip() for x in grp.split(','))
            li = last_import_end(lines)
            imp_add = []
            for name in sorted(needed):
                if name not in imported:
                    imp_add.append('import { %s } from \'%s\';\n' % (name, store_mod(rel, name)))
            if imp_add:
                lines[li+1:li+1] = imp_add
            io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lines))
            total += len(plan)
            print('applied %s: %d' % (rel, len(plan)))
    print('TOTAL:', total)

main()
