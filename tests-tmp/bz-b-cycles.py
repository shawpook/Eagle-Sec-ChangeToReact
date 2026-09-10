"""检测 src/app/react 下的 import 环（只读）。"""
import io
import os
import re
import sys
from collections import defaultdict

ROOT = 'src/app/react'
IMP = re.compile(r'^\s*import\s+[\s\S]*?from\s+[\'"]([^\'"]+)[\'"]', re.M)

nodes = {}
graph = defaultdict(set)

for base, _d, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        rel = os.path.normpath(p).replace('\\', '/')
        nodes[rel] = io.open(p, encoding='utf-8').read()
        src = nodes[rel]
        for m in IMP.finditer(src):
            mod = m.group(1)
            if not mod.startswith('.'):
                continue
            tgt = os.path.normpath(os.path.join(os.path.dirname(rel), mod)).replace('\\', '/')
            for cand in (tgt + '.ts', tgt + '.tsx', tgt + '/index.ts', tgt):
                if cand in nodes or os.path.exists(cand):
                    graph[rel].add(cand if cand in nodes else cand)
                    break

# 只统计 src/app/react 内部的边
edges = defaultdict(set)
for a, outs in graph.items():
    for b in outs:
        if b in nodes:
            edges[a].add(b)

# DFS 找环
WHITE, GRAY, BLACK = 0, 1, 2
color = defaultdict(int)
cycles = []
stack = []


def dfs(u):
    color[u] = GRAY
    stack.append(u)
    for v in sorted(edges[u]):
        if color[v] == GRAY:
            cycles.append(stack[stack.index(v):] + [v])
        elif color[v] == WHITE:
            dfs(v)
    stack.pop()
    color[u] = BLACK


for n in sorted(nodes):
    if color[n] == WHITE:
        dfs(n)

print('模块数 %d / 内部边 %d' % (len(nodes), sum(len(v) for v in edges.values())))
print('发现环：%d' % len(cycles))
seen = set()
for cy in cycles:
    key = tuple(sorted(set(cy)))
    if key in seen:
        continue
    seen.add(key)
    short = [x.replace('src/app/react/', '') for x in cy]
    print('  [%d] %s' % (len(short), ' -> '.join(short)))
    if len(seen) >= 25:
        print('  ...(截断)')
        break
