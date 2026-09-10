# -*- coding: utf-8 -*-
# b1-9o：react-stage-smoke.mjs 的 13 处 angular.element(document.body).scope() 机械替换为
# window.$bodyScope（bundle 摘除后无 angular；$bodyScope 即 shim scope，语义等价）。
import io

PATH = 'tests/react-stage-smoke.mjs'
OLD = 'angular.element(document.body).scope()'
NEW = 'window.$bodyScope'

with io.open(PATH, 'r', encoding='utf-8') as f:
    text = f.read()

count = text.count(OLD)
if count == 0:
    print('NO_OCCURRENCES (already replaced?)')
else:
    text = text.replace(OLD, NEW)
    with io.open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print('REPLACED:', count)
