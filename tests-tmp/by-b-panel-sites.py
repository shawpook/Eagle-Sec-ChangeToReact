# -*- coding: utf-8 -*-
"""b1-9by-B 手术脚本（panelState 面）：panel 自有字段/currentFolder/currentSmartFolder/
inspector.isHideInspector 写点插入 syncPanelFromScope。单 apply 路径。"""
import re, io, os

BASE = 'src/app/react'
RCV = r'(?:s|scope|\$scope|\$rootScope|w|window|body|bs|rootScope|getBodyScope\(\)|this)'
ARR = r'(?:push|splice|pop|shift|unshift)'

PATTERNS = [
    (re.compile(RCV + r'\.(?:showOriginalImageWhenLarge|showName|showMetas|listMetaType|showFileExtension|showFileExtensionLabel|showAnnotation|layoutOptions)\s*=(?!=)'), ['syncPanelFromScope();']),
    (re.compile(RCV + r'\.currentFolder\s*=(?!=)'), ['syncPanelFromScope();']),
    (re.compile(RCV + r'\.currentSmartFolder\s*=(?!=)'), ['syncPanelFromScope();']),
    (re.compile(r'(?:w\.eagle|s\.eagle|eagle|\bthis)\.inspector\.isHideInspector\s*=(?!=)'), ['syncPanelFromScope();']),
]

FILES = {
 'core/dataMachinery.ts': ['syncPanelFromScope'],
 'core/controllerFns.ts': ['syncPanelFromScope'],
 'core/libraryDomain.ts': ['syncPanelFromScope'],
 'components/stage7/SmallPanels.tsx': ['syncPanelFromScope'],
 'components/shell/BodyBindings.tsx': ['syncPanelFromScope'],
 'services/folderMenuService.ts': ['syncPanelFromScope'],
 'services/batchOpsService.ts': ['syncPanelFromScope'],
 'core/eagleClasses.ts': ['syncPanelFromScope'],
 'components/inspector/Inspector.tsx': ['syncPanelFromScope'],
}
# store 面模块相对路径
STORE_REL = {
 'core': '../store/panelState', 'services': '../store/panelState',
 'components': '../../store/panelState',
}

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
    for rel, names in FILES.items():
        p = os.path.join(BASE, rel)
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
        for after, inserts in sorted(plan, reverse=True):
            lines[after+1:after+1] = inserts
        # import：同名已导入则跳过
        src = ''.join(lines)
        have = re.findall(r'import\s*\{([^}]*)\}\s*from', src)
        imported = set()
        for grp in have:
            imported.update(x.strip() for x in grp.split(','))
        missing = [n for n in names if n not in imported]
        if missing:
            li = last_import_end(lines)
            mod = STORE_REL[rel.split(os.sep)[0].replace('/', '')] if False else None
            top = rel.replace(os.sep, '/').split('/')[0]
            mod = {'core': '../store/panelState', 'services': '../store/panelState', 'components': '../../store/panelState'}[top]
            lines[li+1:li+1] = ['import { %s } from \'%s\';\n' % (', '.join(missing), mod)]
        io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lines))
        print('applied %s: %d inserts' % (rel, len(plan)))

main()
