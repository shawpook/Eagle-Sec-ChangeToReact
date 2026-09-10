import re, os, collections

# 1) React 侧 w.* 标识符全量
w_names = collections.Counter()
where = collections.defaultdict(set)
base = 'src/app/react'
for root, dirs, fs in os.walk(base):
    if 'node_modules' in root:
        continue
    for f in fs:
        if not f.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(root, f)
        src = open(p, encoding='utf-8').read()
        for m in re.finditer(r'\bw\.([A-Za-z_$][\w$]*)', src):
            n = m.group(1)
            w_names[n] += 1
            where[n].add(os.path.relpath(p, base).replace('\\', '/'))

# 2) bundle 顶层声明（0-4 缩进的 function/var/let/const/class）
bundle = open('src/app/app.bundle.js', encoding='utf-8').read()
top = set()
for m in re.finditer(r'^(?:function|var|let|const|class)\s+([A-Za-z_$][\w$]*)', bundle, re.M):
    top.add(m.group(1))
# 隐式全局赋值（无声明的顶层赋值形如 NAME = ...）
for m in re.finditer(r'^([A-Za-z_$][\w$]*)\s*=(?!=)', bundle, re.M):
    top.add(m.group(1))

# 3) 其他 classic script 顶层（index.html 引入的 js/*.js 粗查）
classic = set()
for f in ['src/app/js/lib/eagle-api.js', 'src/app/js/services/lazy-load-manager.js',
          'src/app/js/services/shortcut-manager.js', 'src/app/js/vendors/lodash.js',
          'src/app/js/vendors/mousetrap.min.js', 'src/app/js/vendors/tippy.js']:
    try:
        s = open(f, encoding='utf-8', errors='ignore').read()
        for m in re.finditer(r'^(?:function|var|let|const|class)\s+([A-Za-z_$][\w$]*)', s, re.M):
            classic.add(m.group(1))
    except OSError:
        pass

print("React w.* 消费名总数:", len(w_names))
hits = sorted(n for n in w_names if n in top)
print("\n== bundle 顶层供给（去 Angular 后需 vendor 提取/等价物）==")
for n in hits:
    print("  %-28s %3d处  例:%s" % (n, w_names[n], sorted(where[n])[0]))
print("\n== classic script 供给（不受 bundle 移除影响）==")
for n in sorted(n for n in w_names if n in classic and n not in top):
    print("  %-28s 例:%s" % (n, sorted(where[n])[0]))
