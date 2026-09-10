#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""扫测试侧对已迁移频道的**所有**使用形态（$broadcast / $on，任意接收者）。"""
import io, os, re, subprocess

CH = ['MOVE-CROP-TOOL','RESIZE-CROP-TOOL','SET-FOLDER-PASSWORD','OPEN_RENAME','REFRESH_VIDEO_COMMENTS','ADD_TO_LIBRARY','OPEN_DUPLICATE_SCAN_PANEL','OPEN_DUPLICATE','WEBP_CONVERT_START','UPDATE_INSPECTOR','NEW.SMART.FOLDER','INSPECTOR.TAG.SELECT.PANEL.OPEN','SAVE_FOLDER','OPEN_QUICK_SEARCH_MODAL','OPEN_URL_IN_PANEL','OPEN_PLUGIN_CREATOR','OPEN_PLUGIN_CENTER','Reset_Filter','OPEN_PLUGIN_PANEL','OPEN_PLUGIN_CENTER_DETAIL','OPEN_MOUSEWHEEL_PREFERENCE_WINDOW','OPEN_LAYOUT_PANEL','OPEN_ERROR','OPEN_ABOUT_PANEL','OPEN-MOVE-FOLDER-MODAL','OPEN-ADD-FOLDER-MODAL','IMPORT_IMAGES','IMPORT_ARTSTATION','GENERAL.TAG.SELECT.PANEL.OPEN','FOLDER_SETTINGS','FOLDER.SELECT.PANEL.OPEN','EDIT.SMART.FOLDER','CLOSE_QUICK_SEARCH_MODAL','CLEAN_ALL_ERROR','AutoScroll','REBIND_REFRESH','CALCULATE_IMAGE_BINDING','UPDATE_SELECTION','REFRESH_PLUGIN_CENTER','OPEN_NOTIFICATION','CLOSE-TAGS-POPUP']

tests = [f for f in subprocess.check_output(['git', 'ls-files', 'tests'], text=True).split()
         if f.endswith(('.mjs', '.js', '.cjs'))]
hits = []
for p in tests:
    s = io.open(p, encoding='utf-8', errors='ignore').read()
    L = s.split('\n')
    for i, l in enumerate(L):
        for ch in CH:
            if ch in l and ('$broadcast' in l or '$on(' in l):
                hits.append((p, i + 1, l.strip()[:92]))
                break
print('测试侧仍使用已迁移频道 %d 处:' % len(hits))
for p, ln, txt in hits:
    print('   %-42s :%-5d %s' % (p, ln, txt))
