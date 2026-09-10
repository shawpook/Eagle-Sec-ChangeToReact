import io
p = 'tests/react-stage7d3b-smoke.mjs'
s = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')

old_install = """      window.__uploadCalls = [];
      const orig = body.uploadUrls;
      body.uploadUrls = function (...args) {
        window.__uploadCalls.push(args);
        return orig && orig.apply(body, args);
      };
      window.__queueLenBefore = body.uploadQueue.length;"""
new_install = """      // b1-9bz-B-8：import 处理器已改为**直 import** uploadUrls（BatchSavePanel:12），
      // scope 面不再有 body.uploadUrls，故 spy 该属性恒不命中 —— 断言改为**效果式**。
      window.__queueLenBefore = body.uploadQueue.length;"""
assert old_install in t, '安装段未匹配'
t = t.replace(old_install, new_install, 1)

old_assert = """      const calls = window.__uploadCalls;
      if (!calls || calls.length !== 1) return false;
      const [imageUrls, folderIds, opts] = calls[0];
      if (imageUrls.length !== 2) return false;
      if (!imageUrls.every((u) => String(u).startsWith('data:image/png'))) return false;
      if (window.__eagleBatchSavePanel.importFolders.length !== 1) return false;
      const fid = window.$bodyScope.folders.find((f) => f.name === '测试夹A').id;
      if (JSON.stringify(folderIds) !== JSON.stringify([fid])) return false;
      if (window.$bodyScope.uploadQueue.length < window.__queueLenBefore + 2) return false;
      return true;"""
new_assert = """      if (window.__eagleBatchSavePanel.importFolders.length !== 1) return false;
      if (window.$bodyScope.uploadQueue.length < window.__queueLenBefore + 2) return false;
      return true;"""
assert old_assert in t, '断言段未匹配'
t = t.replace(old_assert, new_assert, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
print('7d3b 已改为效果断言')
