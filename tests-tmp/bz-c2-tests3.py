#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2：测试侧驱动改写（第三波）—— 全量扫描 tests/ 并改写所有已迁移频道的使用。"""
import io, os, re, subprocess

CH = ['MOVE-CROP-TOOL', 'RESIZE-CROP-TOOL', 'SET-FOLDER-PASSWORD', 'OPEN_RENAME',
      'REFRESH_VIDEO_COMMENTS', 'ADD_TO_LIBRARY', 'OPEN_DUPLICATE_SCAN_PANEL', 'OPEN_DUPLICATE',
      'WEBP_CONVERT_START', 'UPDATE_INSPECTOR', 'NEW.SMART.FOLDER',
      'INSPECTOR.TAG.SELECT.PANEL.OPEN', 'SAVE_FOLDER', 'OPEN_QUICK_SEARCH_MODAL', 'OPEN_URL_IN_PANEL',
      'OPEN_PLUGIN_CREATOR', 'OPEN_PLUGIN_CENTER', 'Reset_Filter', 'OPEN_PLUGIN_PANEL',
      'OPEN_PLUGIN_CENTER_DETAIL', 'OPEN_MOUSEWHEEL_PREFERENCE_WINDOW', 'OPEN_LAYOUT_PANEL',
      'OPEN_ERROR', 'OPEN_ABOUT_PANEL', 'OPEN-MOVE-FOLDER-MODAL', 'OPEN-ADD-FOLDER-MODAL',
      'IMPORT_IMAGES', 'IMPORT_ARTSTATION', 'GENERAL.TAG.SELECT.PANEL.OPEN', 'FOLDER_SETTINGS',
      'FOLDER.SELECT.PANEL.OPEN', 'EDIT.SMART.FOLDER', 'CLOSE_QUICK_SEARCH_MODAL',
      'CLEAN_ALL_ERROR', 'AutoScroll']

tests = [f for f in subprocess.check_output(['git', 'ls-files', 'tests'], text=True).split()
         if f.endswith(('.mjs', '.js', '.cjs'))]

tot = 0
for p in tests:
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    for ch in CH:
        t, k = re.subn(r'[A-Za-z_$][\w$.]*\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*',
                       "window.__eagleBus.emit('%s', " % ch, t)
        n += k
        t, k2 = re.subn(r'[A-Za-z_$][\w$.]*\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*\)',
                        "window.__eagleBus.emit('%s')" % ch, t)
        n += k2
    if n:
        io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
        print('  %-44s %d 处' % (p, n))
        tot += n
print('合计改写 %d 处' % tot)
