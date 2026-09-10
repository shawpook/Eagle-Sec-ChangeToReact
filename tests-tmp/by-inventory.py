# -*- coding: utf-8 -*-
"""P4-by 考据：12 store 的 startScopeSync watch/build 表达式盘点"""
import re, io, os

store_dir = r'src/app/react/store'
report = []
total_watch = 0
total_build_fields = 0

for fn in sorted(os.listdir(store_dir)):
    if not fn.endswith('.ts') or fn == 'appState.ts':
        continue
    path = os.path.join(store_dir, fn)
    src = io.open(path, encoding='utf-8').read()
    m = re.search(r'startScopeSync\(\{(.*?)\n  \}\);', src, re.S)
    if not m:
        report.append('%s: NO startScopeSync' % fn)
        continue
    body = m.group(1)
    # watch 数组
    wm = re.search(r'watch: \[(.*?)\]', body, re.S)
    watches = re.findall(r"'([^']+)'", wm.group(1)) if wm else []
    # build 函数体里的字段（key: value 对）
    bm = re.search(r'build: \(scope\) => \(\{(.*?)\} as Partial', body, re.S)
    build_fields = re.findall(r'^\s*(\w+):', bm.group(1), re.M) if bm else []
    total_watch += len(watches)
    total_build_fields += len(build_fields)
    report.append('%s: watch=%d build_fields=%d' % (fn, len(watches), len(build_fields)))
    report.append('   watch: ' + ' | '.join(watches))
    report.append('   build: ' + ', '.join(build_fields))

print('\n'.join(report))
print('\n=== TOTAL watch=%d build_fields=%d sum=%d ===' % (total_watch, total_build_fields, total_watch + total_build_fields))
