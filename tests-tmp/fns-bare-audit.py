import re

# 原始文件直接扫描（不做字符串剥离——宁可多报不可漏报），人工 triage
src = open('src/app/react/core/controllerFns.ts', encoding='utf-8').read()
lines = src.split('\n')

decl = set(re.findall(r'\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)', src))
decl |= set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)', src))
decl |= {'makeControllerFns', 'fns', 'getScope', 'getBodyScope', 'IPCHelper', '_req',
         'initLinkVars', 'linkVarsInited', 'sanitize', 'remainingFilenameLength',
         'currentWindow', 'electronSettings', 'electronLog', 'ipcRenderer', 'i18n',
         'preferences', 'FixUtils', 'dialog', 'systemPreferences', '$timeout', '$filter',
         'EagleConfig', 'fs', 'DATE_1_DAY', 'DATE_2_DAY', 'DATE_7_DAY', 'DATE_30_DAY',
         'DATE_90_DAY', 'DATE_365_DAY', 'VIDEO_TYPES', 'AUDIO_TYPES', 'FONT_TYPES',
         'SPECIAL_TYPES', 'emojiRegex'}
kw = {'if', 'function', 'return', 'catch', 'for', 'while', 'switch', 'new', 'typeof', 'in',
      'of', 'do', 'else', 'case', 'throw', 'await', 'async', 'void', 'delete', 'try',
      'finally', 'break', 'continue', 'instanceof', 'var', 'let', 'const', 'true', 'false',
      'null', 'undefined', 'this', 'super', 'class', 'import', 'export', 'from', 'default',
      'Error', 'Promise', 'Object', 'Array', 'JSON', 'Math', 'Date', 'String', 'Number',
      'Boolean', 'RegExp', 'Set', 'Map', 'parseInt', 'parseFloat', 'isNaN', 'setTimeout',
      'clearTimeout', 'setInterval', 'clearInterval', 'encodeURIComponent',
      'decodeURIComponent', 'require', 'module', 'process', 'Buffer', 'alert', 'confirm',
      'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'document',
      'window', 'console', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch',
      'FileReader', 'Blob', 'URL', 'Image', 'getSelection', 'structuredClone',
      'queueMicrotask', 'performance', 'globalThis', 'Symbol', 'Reflect', 'Proxy',
      'arguments', 'resolve', 'reject', 'isNaN'}

# 已知 window 类（bundle 顶层/隐式全局/运行时全局——安全类）
window_class = {'$', 'getExt', 'getHashID', 'resetNgGridLayoutData', 'debounce', 'throttle',
                'analytics', 'swal', 'eagle', 'tinyPinyin', 'guid', 'moment', '_',
                'RecentFileManager', 'HoverPreview', 'QuickAccessManager', 'FileUrlHelper',
                'electron', 'backgroundWindowID', 'appRoot', 'isTahoe', 'TagManager',
                'hiddenByCurrentFilter', 'ayncsImagesChange', 'ayncsImagesRemove'}

hits = []
for i, ln in enumerate(lines, 1):
    t = ln.strip()
    if t.startswith('//') or t.startswith('*') or t.startswith('/*'):
        continue
    for m in re.finditer(r'(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(', ln):
        nm = m.group(1)
        if nm in decl or nm in kw or nm in window_class or nm.startswith('__lv_'):
            continue
        hits.append((i, nm, t[:110]))

print("原始文件调用位置裸标识符（含字符串内误报，人工 triage）：")
for i, nm, t in hits:
    print("  行%-6d %-30s | %s" % (i, nm, t))
