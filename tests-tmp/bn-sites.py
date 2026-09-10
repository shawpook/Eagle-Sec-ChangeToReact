# -*- coding: utf-8 -*-
"""定位 body 内歧义自由标识符的精确行号。"""
import io
import re

lines = io.open('src/app/react/core/controllerFns.ts', encoding='utf-8').read().split('\n')
span = lines[912:2077]

pats = {
    'dollar': re.compile(r'(?<![\w$.])\$(?![\w$])'),
    'now': re.compile(r'(?<![\w$.])now(?![\w$])'),
    'preferences': re.compile(r'(?<![\w$.])preferences(?![\w$])'),
    'eagle': re.compile(r'(?<![\w$.])eagle(?![\w$])'),
    'path': re.compile(r'(?<![\w$.])path(?![\w$])'),
    'swal': re.compile(r'(?<![\w$.])swal(?![\w$])'),
    'pluginModule': re.compile(r'(?<![\w$.])pluginModule(?![\w$])'),
    'require': re.compile(r'(?<![\w$.])require(?![\w$])'),
}
for name, p in pats.items():
    hits = [(913 + i, ln.strip()[:140]) for i, ln in enumerate(span) if p.search(ln)]
    print('--- %s (%d)' % (name, len(hits)))
    for ln, txt in hits[:12]:
        print('   ', ln, ':', txt)
