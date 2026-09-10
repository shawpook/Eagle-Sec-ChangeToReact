# -*- coding: utf-8 -*-
"""b1-9bn 前置考据 v2：区分「自由标识符」与「属性访问」，并定位关键引用行号。"""
import io
import re
from collections import Counter

SRC = 'src/app/react/core/controllerFns.ts'
START = 913
END = 2077

lines = io.open(SRC, encoding='utf-8').read().split('\n')
body_lines = lines[START - 1:END]
body = '\n'.join(body_lines)

out = []
i = 0
n = len(body)
while i < n:
    c = body[i]
    two = body[i:i + 2]
    if c in ('"', "'"):
        q = c
        i += 1
        while i < n:
            if body[i] == '\\':
                i += 2
                continue
            if body[i] == q:
                i += 1
                break
            i += 1
        out.append(' ')
    elif c == '`':
        i += 1
        while i < n:
            if body[i] == '\\':
                i += 2
                continue
            if body[i] == '`':
                i += 1
                break
            if body[i] == '$' and i + 1 < n and body[i + 1] == '{':
                depth = 1
                j = i + 2
                while j < n and depth:
                    if body[j] == '{':
                        depth += 1
                    elif body[j] == '}':
                        depth -= 1
                    j += 1
                out.append(' ' + body[i + 2:j - 1] + ' ')
                i = j
            else:
                i += 1
        out.append(' ')
    elif two == '//':
        while i < n and body[i] != '\n':
            i += 1
    elif two == '/*':
        i += 2
        while i < n and body[i:i + 2] != '*/':
            i += 1
        i += 2
    else:
        out.append(c)
        i += 1

clean = ''.join(out)

free = Counter()      # not preceded by '.'
prop = set()          # preceded by '.'
for m in re.finditer(r'[A-Za-z_$][\w$]*', clean):
    name = m.group(0)
    j = m.start() - 1
    while j >= 0 and clean[j] in ' \t\n':
        j -= 1
    if j >= 0 and clean[j] == '.':
        prop.add(name)
    else:
        free[name] += 1

kw = set(('if else return var let const function async await for while do switch case break '
          'continue new typeof instanceof in of delete void this null true false undefined try '
          'catch finally throw default class extends super yield static'.split()))
# js builtins / ambient globals that need no handling
builtin = set(('window document localStorage Date Object Math JSON Array Number String Boolean '
               'Promise Set Map RegExp Error parseInt parseFloat isNaN encodeURIComponent '
               'decodeURIComponent setTimeout clearTimeout setInterval clearInterval requestAnimationFrame '
               'console process require Buffer global navigator location history alert confirm '
               'arguments event'.split()))

print('=== FREE identifiers (excluding keywords/prop-access/builtins/locals of the builder) ===')
builder_locals = set(('s item items viewMode isMultiple isSupportFormat isFullScreen isDetailMode '
                      'isInFolderList canPreview openInFolderMenuItems folder acc folderId canPin '
                      'historyLibraryMenu history isCurrent iconPath iconUrl openWithOtherMenuItem '
                      'submenu lastOpenedPluginsIds lastOpenedPluginsIdsMap lastOpenedPluginsMenuItems '
                      'otherPluginsMenuItems pluginsMenuItems itemElements result a b cur asso index '
                      'name dir path2 filePaths appRoot2 exec app icon label keywords image images '
                      'options files found file target event len fileExt2 sourceItem targetPath '
                      'destinationName thumbnailPath selectedFolders keybind role roles enabled2'.split()))
for k in sorted(free):
    if k in kw or k in builtin or k in builder_locals:
        continue
    print(f'{k} {free[k]}')

print()
print('=== locations of key refs ===')
for needle in ('fns', 'appRoot', 'getScope', 'initLinkVars', '$bodyScope', 'path.', 'require', 'swal', 'eagle', 'checkOperationSafety', 'removePlayingAudios', 'ayncsImagesChange', 'ayncsImagesGeneratePalette', 'FileUrlHelper', 'EagleConfig', 'PLUGIN', 'ShareMenu', 'shareMenu'):
    pat = re.compile(r'(?<![\w$.])' + re.escape(needle.replace('.', '')) + r'(?![\w$])' if needle.endswith('.') else r'(?<![\w$.])' + re.escape(needle) + r'(?![\w$])')
    hits = []
    for idx, ln in enumerate(body_lines):
        if pat.search(ln):
            hits.append(f'{START + idx}: {ln.strip()[:150]}')
    print(f'--- {needle} ({len(hits)} hits)')
    for h in hits[:6]:
        print('   ', h)
