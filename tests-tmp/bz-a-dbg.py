# -*- coding: utf-8 -*-
import io
text = io.open(r'src/app/react/core/controllerFns.ts', encoding='utf-8').read()
lines = text.split('\n')

def scan(start_idx, open_col):
    depth = 0
    i, col = start_idx, open_col
    state = None
    started = False
    while i < len(lines):
        ln = lines[i]
        j = col
        while j < len(ln):
            c = ln[j]
            nxt = ln[j + 1] if j + 1 < len(ln) else ''
            if state == "'":
                if c == '\\':
                    j += 2; continue
                if c == "'": state = None
            elif state == '"':
                if c == '\\':
                    j += 2; continue
                if c == '"': state = None
            elif state == '`':
                if c == '\\':
                    j += 2; continue
                if c == '`': state = None
            elif state == '//':
                break
            elif state == '/*':
                if c == '*' and nxt == '/':
                    state = None; j += 2; continue
            else:
                if c == "'": state = "'"
                elif c == '"': state = '"'
                elif c == '`': state = '`'
                elif c == '/' and nxt == '/': state = '//'
                elif c == '/' and nxt == '*': state = '/*'; j += 1
                elif c == '{':
                    depth += 1; started = True
                elif c == '}':
                    depth -= 1
                    if depth == 0 and started:
                        return i, state
            j += 1
        i += 1
        col = 0
        if state == '//':
            state = None  # 行注释行尾复位
    return -1, state

r, st = scan(391, 2)
print('close:', (r + 1) if r >= 0 else 'FAIL', 'state:', repr(st))
# 逐行 trace 找发散
depth = 0
state = None
i, col = 391, 2
while i < 425:
    ln = lines[i]
    j = col
    while j < len(ln):
        c = ln[j]
        nxt = ln[j + 1] if j + 1 < len(ln) else ''
        if state == "'":
            if c == '\\': j += 2; continue
            if c == "'": state = None
        elif state == '"':
            if c == '\\': j += 2; continue
            if c == '"': state = None
        elif state == '`':
            if c == '\\': j += 2; continue
            if c == '`': state = None
        elif state == '//':
            break
        elif state == '/*':
            if c == '*' and nxt == '/': state = None; j += 2; continue
        else:
            if c == "'": state = "'"
            elif c == '"': state = '"'
            elif c == '`': state = '`'
            elif c == '/' and nxt == '/': state = '//'
            elif c == '/' and nxt == '*': state = '/*'; j += 1
            elif c == '{': depth += 1
            elif c == '}':
                depth -= 1
        j += 1
    i += 1
    col = 0
    print(i, 'depth=', depth, 'state=', repr(state), lines[i][:76] if i < len(lines) else '')
