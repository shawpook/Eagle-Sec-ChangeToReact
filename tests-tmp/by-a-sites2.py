# -*- coding: utf-8 -*-
"""b1-9by-A 手术脚本 v3（单次应用）：四链 sync 调用插入。
教训：v1/v2 双 apply 块双插——本版仅一条 apply 路径；多行 import 取语句尾插入。"""
import re, io, sys, os

BASE = 'src/app/react'

RCV = r'(?:s|scope|\$scope|\$rootScope|w|window|body|bs|rootScope|getBodyScope\(\))'
ARR = r'(?:push|splice|pop|shift|unshift)'
def wassign(name):
    return re.compile(RCV + r'\.' + name + r'(\s*=(?!=)|\.' + ARR + r'\(|\.length\s*=(?!=))')

PATTERNS = [
    (re.compile(RCV + r'\.currentFolder\s*=(?!=)'), ['syncFolderLock();', 'syncListFromScope();']),
    (re.compile(RCV + r'\.currentFolder\.isUnLock\s*=(?!=)'), ['syncFolderLock();', 'syncListFromScope();']),
    (re.compile(RCV + r'\.currentSmartFolder\s*=(?!=)'), ['syncListFromScope();']),
    (re.compile(RCV + r'\.selectedFolderMappings(\s*=(?!=)|\[[^\]]+\]\s*=(?!=))'), ['syncListFromScope();']),
    (re.compile(RCV + r'\.\$root\.selectedFolders(\s*=(?!=)|\.' + ARR + r'\()'), ['syncListFromScope();']),
    (re.compile(r'\beagle\.filter\.filterBadge\s*=(?!=)'), ['syncListFromScope();']),
    (re.compile(r'^\s*filter\.filterBadge\s*=(?!=)'), ['syncListFromScope();']),
    (re.compile(r'this\.filterBadge\s*=(?!=)'), ['syncListFromScope();']),
    (re.compile(r'errorListRef\.current(\.length\s*=(?!=)|\.' + ARR + r'\()'), ['syncErrorCount(errorListRef.current);']),
    (wassign('errorList'), ['syncErrorCount();']),
    (wassign('(?:uploadQueue|finishQueue)'), ['syncUploadFromScope();']),
    (wassign('addImageTimeLeftInSeconds'), ['syncUploadFromScope();']),
    (re.compile(RCV + r'\.progress\s*=(?!=)'), ['syncUploadFromScope();']),
    (wassign('(?:raw|trash|allData|filtereds|subFolders)'), ['syncListFromScope();']),
]

FILES = {
 'core/miscDomain.ts': {'../store/toastState': ['syncErrorCount'], '../store/uploadState': ['syncUploadFromScope']},
 'core/libraryDomain.ts': {'../store/toastState': ['syncErrorCount'], '../store/lockState': ['syncFolderLock'], '../store/listState': ['syncListFromScope']},
 'core/dataMachinery.ts': {'../store/lockState': ['syncFolderLock'], '../store/uploadState': ['syncUploadFromScope'], '../store/listState': ['syncListFromScope']},
 'core/controllerFns.ts': {'../store/lockState': ['syncFolderLock'], '../store/uploadState': ['syncUploadFromScope'], '../store/listState': ['syncListFromScope']},
 'core/itemDomain.ts': {'../store/uploadState': ['syncUploadFromScope'], '../store/listState': ['syncListFromScope']},
 'core/bundleGlobals.ts': {'../store/listState': ['syncListFromScope']},
 'core/apiServerDomain.ts': {'../store/uploadState': ['syncUploadFromScope']},
 'core/eagleClasses.ts': {'../store/listState': ['syncListFromScope']},
 'services/folderMenuService.ts': {'../store/lockState': ['syncFolderLock'], '../store/listState': ['syncListFromScope']},
 'services/batchOpsService.ts': {'../store/lockState': ['syncFolderLock'], '../store/listState': ['syncListFromScope']},
 'services/folderCoreService.ts': {'../store/listState': ['syncListFromScope']},
 'services/imageOpsService.ts': {'../store/listState': ['syncListFromScope']},
 'services/sidebarService.ts': {'../store/listState': ['syncListFromScope']},
 'components/stage7/ControllerModals.tsx': {'../../store/toastState': ['syncErrorCount'], '../../store/uploadState': ['syncUploadFromScope']},
 'components/stage7/BatchSavePanel.tsx': {'../../store/uploadState': ['syncUploadFromScope']},
 'components/stage7/BatchRenameArtstationModals.tsx': {'../../store/uploadState': ['syncUploadFromScope']},
}

def is_skippable(line):
    t = line.strip()
    if t.startswith('//') or t.startswith('/*') or t.startswith('*'):
        return True
    if "'$scope." in line or '"$scope.' in line:
        return True
    return False

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
    """最后一条 import 语句的结束行（单行 import / 多行 } from 收口）。"""
    end = -1
    for i, l in enumerate(lines):
        if re.match(r"^import\s+.*from\s+'[^']*';\s*$", l):
            end = i
        elif re.match(r"^} from '[^']*';\s*$", l):
            end = i
    return end

def main():
    for rel, imports in FILES.items():
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
        li = last_import_end(lines)
        assert li >= 0, rel + ': no import end found'
        imp_lines = ['import { %s } from \'%s\';\n' % (', '.join(names), mod) for mod, names in imports.items()]
        lines[li+1:li+1] = imp_lines
        io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lines))
        print('applied %s: %d' % (rel, len(plan)))

main()
