# -*- coding: utf-8 -*-
"""b1-9by-A 手术脚本 v2（regex 扫描）：toast/lock/upload/list 四链 sync 调用插入。
--dry 校验匹配；--apply 落地。注释行/字符串表项/已知局部变量排除。"""
import re, io, sys, os

APPLY = '--apply' in sys.argv
BASE = 'src/app/react'
SEP = os.sep

# 接收者前缀（scope 形态全收录；rootRef/局部数组不收录）
RCV = r'(?:s|scope|\$scope|\$rootScope|w|window|body|bs|rootScope|getBodyScope\(\))'
ARR = r'(?:push|splice|pop|shift|unshift)'
def wassign(name):  # 赋值或数组方法变异
    return re.compile(RCV + r'\.' + name + r'(\s*=(?!=)|\.' + ARR + r'\(|\.length\s*=(?!=))')

PATTERNS = [
    # (正则, 插入行)  —— 顺序敏感：先专后泛
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

# 扫描文件 → 需注入的 import（模块 → 导出名）
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
    # fns 表字符串项（['image-processing-error', ['$scope.errorList.push...']]）
    if "'$scope." in line or '"$scope.' in line or '$bodyScope.' in line and t.startswith('['):
        return True
    return False

report = []
edits = {}  # file → list of (lineno, indent, [inserts])
for rel in FILES:
    p = os.path.join(BASE, rel)
    lines = io.open(p, encoding='utf-8').read().splitlines()
    file_edits = []
    seen_line = set()
    for i, line in enumerate(lines):
        if is_skippable(line):
            continue
        for pat, ins in PATTERNS:
            if pat.search(line):
                if i in seen_line:
                    break
                seen_line.add(i)
                indent = re.match(r'\s*', line).group(0)
                file_edits.append((i, [indent + x for x in ins]))
                break
    edits[rel] = file_edits
    report.append('%s: %d 处' % (rel, len(file_edits)))

print('=== 匹配统计 ===')
print('\n'.join(report))
print('TOTAL:', sum(len(v) for v in edits.values()))

if APPLY:
    for rel, file_edits in edits.items():
        p = os.path.join(BASE, rel)
        lines = io.open(p, encoding='utf-8').read().splitlines(True)
        for i, inserts in sorted(file_edits, reverse=True):
            lines[i+1:i+1] = [x + '\n' for x in inserts]
        # import 注入：最后一个 ^import 行后
        imports = FILES[rel]
        last_imp = max(i for i, l in enumerate(lines) if l.startswith('import '))
        imp_lines = []
        for mod, names in imports.items():
            imp_lines.append('import { %s } from \'%s\';\n' % (', '.join(names), mod))
        lines[last_imp+1:last_imp+1] = imp_lines
        io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lines))
    print('=== APPLIED ===')

# ── v2 追加：多行语句（行尾 { 开块） brace-match 到语句尾插入 ──
def brace_end(lines, start):
    """start 行以 { 结尾（语句续行）→ 返回配平 '}' 所在行号；找不到返回 start。"""
    depth = 0
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
        if depth <= 0 and i > start:
            return i
        if depth <= 0 and i == start:
            return start
    return start

def apply_v2():
    total = 0
    for rel, file_edits in edits.items():
        if not file_edits:
            continue
        p = os.path.join(BASE, rel)
        lines = io.open(p, encoding='utf-8').read().splitlines(True)
        plan = []  # (after_lineno, inserts)
        for i, inserts in file_edits:
            anchor = lines[i].rstrip('\n')
            if anchor.rstrip().endswith('{'):
                end = brace_end(lines, i)
                plan.append((end, inserts))
            else:
                plan.append((i, inserts))
        for after, inserts in sorted(plan, reverse=True):
            lines[after+1:after+1] = [x + '\n' for x in inserts]
        imports = FILES[rel]
        last_imp = max(i for i, l in enumerate(lines) if l.startswith('import '))
        imp_lines = ['import { %s } from \'%s\';\n' % (', '.join(names), mod) for mod, names in imports.items()]
        lines[last_imp+1:last_imp+1] = imp_lines
        io.open(p, 'w', encoding='utf-8', newline='').write(''.join(lines))
        total += len(plan)
        print('applied %s: %d' % (rel, len(plan)))
    print('TOTAL applied:', total)

if '--apply' in sys.argv:
    apply_v2()
