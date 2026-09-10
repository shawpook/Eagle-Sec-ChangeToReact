import io, os, re, sys

src = 'src/app/js/vendors/jquery.smoothZoom.min.js'
dst = 'frontend/public/vendor/eagle-smooth-zoom.js'

text = io.open(src, encoding='utf-8', errors='strict').read()

before_scope = text.count('angular.element("body").scope()')
before_inj = text.count('angular.element("html").injector()')

# 应用层胶水的 Angular 依赖 → shim 世界等价物（body scope 由 window.$bodyScope 承载）
text = text.replace('angular.element("body").scope()', 'window.$bodyScope')
text = text.replace(
    'angular.element("html").injector()',
    "{ get: function (name) { return name === '$rootScope' ? (window.$bodyScope && window.$bodyScope.$root) : undefined; } }",
)

assert 'angular.' not in text, 'residual angular.* reference: %r' % re.findall(r'angular\.[a-zA-Z]*', text)[:5]

header = (
    '/**\n'
    ' * b1-9e 提取：src/app/js/vendors/jquery.smoothZoom.min.js（详情原图缩放 + BitmapViewer +\n'
    ' * bitmapWorker 瓦片链）。原文件的代码内联在 app.bundle.js 里，b1-9d 摘除 bundle 后\n'
    ' * $.fn.smoothZoom 与 BitmapViewer 一并消失 → machineryEnterDetailMode 的初始化静默 no-op\n'
    ' * → 无 #bitmap-viewer canvas / 无瓦片 → 详情交付闸门超时。\n'
    ' *\n'
    ' * 与原文件的唯一差异（%d + %d 处，机械替换，其余逐字节相同）：应用层胶水的 Angular 依赖\n'
    ' *   angular.element("body").scope()   → window.$bodyScope\n'
    ' *   angular.element("html").injector() → 只暴露 $rootScope 的等价 injector（= $bodyScope.$root）\n'
    ' * 不改原文件、不注入 window.angular —— 全局 angular 存在会翻转 scopeBridge/itemDomain 等\n'
    ' * 「bundle 在世」探测点（shim scope 不再建立、finishQueue 双处理规避会误判）。\n'
    ' * 生成脚本：tests-tmp/extract-smooth-zoom.py（重跑即可复现）。\n'
    ' */\n'
) % (before_scope, before_inj)

os.makedirs(os.path.dirname(dst), exist_ok=True)
io.open(dst, 'w', encoding='utf-8', newline='').write(header + text)
print('replaced scope=%d injector=%d -> %s (%d bytes)' % (before_scope, before_inj, dst, os.path.getsize(dst)))
