# -*- coding: utf-8 -*-
# b1-9f 轮 test:isolated 前置：宿主 node fs.cpSync(recursive) 被静默击杀（exit 127）的绕过补丁。
# 四处调用点替换为手工递归拷贝。跑完必须 git checkout 回退，永不提交。
import io, sys

HELPER = '''
function copyRecursiveManual(source, destination, filter) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (filter && !filter(sourcePath)) continue;
    if (entry.isDirectory()) copyRecursiveManual(sourcePath, destPath, filter);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, destPath);
    else if (entry.isSymbolicLink()) {
      try { fs.symlinkSync(fs.readlinkSync(sourcePath), destPath); } catch (err) { /* noop */ }
    }
  }
}
'''

# (file, anchor_line_to_insert_helper_after, old_snippet, new_snippet)
JOBS = [
    (
        'backend/src/library-migration.js',
        "import { thumbnailPath } from './thumbnailer.js';",
        "fs.cpSync(sourceRoot, destination, { recursive: true });",
        "copyRecursiveManual(sourceRoot, destination);",
    ),
    (
        'backend/src/importer.js',
        None,  # 在第一个 fs import 块后插
        "fs.cpSync(library.rootDir, resolved, { recursive: true });",
        "copyRecursiveManual(library.rootDir, resolved);",
    ),
    (
        'backend/src/library-backup-service.js',
        None,
        "fs.cpSync(source, destination, {\n    recursive: true,\n    filter: (sourcePath) => path.basename(sourcePath) !== 'recovery-manifest.json',\n  });",
        "copyRecursiveManual(source, destination, (sourcePath) => path.basename(sourcePath) !== 'recovery-manifest.json');",
    ),
    (
        'tests/roadmap-panels.mjs',
        "import { fileURLToPath } from 'node:url';",
        "fs.cpSync(mockLibrary, tempLibrary, { recursive: true });",
        "copyRecursiveManual(mockLibrary, tempLibrary);",
    ),
]

def insert_helper_after_imports(text):
    lines = text.split('\n')
    last_import = -1
    for i, line in enumerate(lines[:40]):
        if line.startswith('import ') or line.startswith('} from') or (line.strip().startswith('from ') and last_import >= 0):
            last_import = i
    if last_import < 0:
        raise RuntimeError('no imports found in first 40 lines')
    return '\n'.join(lines[:last_import + 1]) + '\n' + HELPER + '\n'.join(lines[last_import + 1:])

for path, anchor, old, new in JOBS:
    with io.open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    if 'copyRecursiveManual' in text:
        print('SKIP (already patched):', path)
        continue
    if old not in text:
        print('FAIL: call site not found in', path)
        sys.exit(1)
    if anchor:
        if anchor not in text:
            print('FAIL: anchor not found in', path)
            sys.exit(1)
        text = text.replace(anchor, anchor + '\n' + HELPER.strip() + '\n', 1)
    else:
        text = insert_helper_after_imports(text)
    text = text.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print('PATCHED:', path)

print('ALL_PATCHED')
