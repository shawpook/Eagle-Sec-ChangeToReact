/**
 * 部署根（deployment root）的**单一事实源**。
 *
 * 为什么抽出来：`tests/isolated-deployment.mjs`（M8-1/M8-6，起完整生产栈 + Electron，重）
 * 与 `tests/deployment-root-runtime-probe.mjs`（R2-3，只起后端，快）都要构造同一个部署根；
 * 两份清单一旦漂移，「隔离门禁绿的布局」与「运行期探针绿的布局」就不是同一个东西。
 *
 * 本模块只放**数据结构与构造过程**，不含任何断言与进程编排：
 *   - `DEPLOYMENT_TREE`  部署副本清单（每项带 reason）
 *   - `RUNTIME_ROOT_GAPS` 四处「解析根不一致」耦合点（契约文档 docs/deployment-layout.md）
 *   - `buildDeploymentRoot()` 按清单构造部署根（含 node_modules 目录联接）
 *
 * 用法：node 侧 `import { buildDeploymentRoot } from './deployment-root.mjs'`
 */
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// 部署副本清单：只放「跑起来所必需」的东西，每项都写明为什么。
// 路径均为仓库相对路径；kind=tree 递归复制。
// ---------------------------------------------------------------------------
export const DEPLOYMENT_TREE = [
  {
    from: 'package.json',
    to: 'package.json',
    kind: 'file',
    reason: 'backend/src/*.js 是 ESM，靠 package.json 的 "type":"module" 才能被 node 解析',
  },
  {
    from: 'scripts/start-production.mjs',
    to: 'scripts/start-production.mjs',
    kind: 'file',
    reason: '生产启动入口（复用既有逻辑，不另写第二套）；projectRoot 由自身位置推导 ⇒ 天然指向隔离根',
  },
  {
    from: 'scripts/serve-frontend.mjs',
    to: 'scripts/serve-frontend.mjs',
    kind: 'file',
    reason: '前端静态服务 + /file 代理 + 运行时配置端点',
  },
  {
    from: 'frontend/runtime-config.mjs',
    to: 'frontend/runtime-config.mjs',
    kind: 'file',
    reason: 'serve-frontend.mjs 的相对导入，端口注入的唯一事实源',
  },
  {
    from: 'backend',
    to: 'backend',
    kind: 'tree',
    reason: '后端服务源码（deployment 单元，未打包）+ 其依赖的 plugins/ 加载器',
  },
  {
    from: 'electron',
    to: 'electron',
    kind: 'tree',
    reason: 'Electron 主进程 / preload / PDF、视频缩略图 worker / pdf-viewer',
  },
  {
    from: 'plugins',
    to: 'plugins',
    kind: 'tree',
    reason: 'main.cjs 启动时硬加载 plugins/example-service-plugin，缺失即 app.exit(1)',
  },
  {
    from: 'frontend/public/mock-library',
    to: 'frontend/public/mock-library',
    kind: 'tree',
    reason: '后端默认库（/mock-library/... 虚拟路径）与 Electron allowedRoots 都指向这里',
  },
  {
    from: 'frontend/public/browser-extension/icons',
    to: 'frontend/public/browser-extension/icons',
    kind: 'tree',
    reason: 'main.cjs 托盘图标 icon128.png',
  },
  {
    from: 'dist/frontend',
    to: 'dist/frontend',
    kind: 'tree',
    reason: 'npm run build 的产物，静态服务根（含注册发布树 dist/frontend/src）',
  },
  {
    from: 'dist/frontend/src',
    to: 'src',
    kind: 'tree',
    reason:
      '**登记发布树再落一份到隔离根根下的 src/**：backend/src/server.js 与 electron/preload.cjs '
      + '按 projectRoot/src/... 解析运行时资源（见下方 RUNTIME_ROOT_GAPS），而发布清单的 to 是 dist/frontend/src。'
      + '这里复用的正是构建期由 frontend/publish-asset-manifest.mjs 登记的同一棵树（不含 src/app/react）。',
  },
];

// ---------------------------------------------------------------------------
// 已知的「解析根不一致」耦合点：产品代码按 projectRoot/src（以及 preload 的 __dirname/../src）
// 解析运行时资源，而发布清单的落点是 dist/frontend/src。
//
// 用户裁决 D34：不改产品代码，改为**固化部署根布局**——只要部署根是
// {backend, electron, src} 三段、且 src/ 就是发布树，这四处就自然解析到发布树。
//
// 每条给出**期望的解析结果**，由两侧门禁共用：
//   - `tests/isolated-deployment.mjs`：静态断言（部署根内存在该 file/dir）；
//   - `tests/deployment-root-runtime-probe.mjs`：**运行期**断言（真实进程/真实解析后确实是这条路径）。
// 契约文档：docs/deployment-layout.md。
// ---------------------------------------------------------------------------
export const RUNTIME_ROOT_GAPS = [
  {
    id: 'preload-format-extension',
    where: 'electron/preload.cjs:14-16（锚点 :15）',
    detail: "path.join(__dirname, '..', 'src', 'app', 'js', 'plugin', 'api-format-extension.js')",
    why: '格式插件 webview 的唯一磁盘 preload 来源（消费者 preload.cjs:160/165-166，缺失静默降级）',
    // 锚点：preload 模块作用域内 __dirname = <部署根>/electron ⇒ '..' = 部署根
    resolve: (root) => path.join(root, 'src', 'app', 'js', 'plugin', 'api-format-extension.js'),
    expect: 'file',
  },
  {
    id: 'library-default-icon',
    where: 'backend/src/server.js:1489 / 2483',
    detail: "path.join(projectRoot, 'src/app/collect-window/assets/images/base/icons/default-library-icon.png')",
    why: '/api/library/icon 与 /api/v2/library/icon 的图标文件（缺失回落 404）',
    resolve: (root) => path.join(
      root, 'src', 'app', 'collect-window', 'assets', 'images', 'base', 'icons', 'default-library-icon.png',
    ),
    expect: 'file',
  },
  {
    id: 'thumbnail-resolve-roots',
    where: 'backend/src/server.js:3264-3267',
    detail: "resolveThumbnailPath 的 roots = [projectRoot/frontend/public, projectRoot/src]",
    why: '虚拟路径 /mock-library/... 与 /src/... 的缩略图解析根（命中条件见 server.js:3272-3275）',
    resolve: (root) => path.join(root, 'src'),
    expect: 'dir',
    also: [
      {
        label: 'roots[0] = path.join(projectRoot, "frontend/public")',
        resolve: (root) => path.join(root, 'frontend', 'public'),
        expect: 'dir',
      },
    ],
  },
  {
    id: 'library-store-src-mapping',
    where: 'backend/src/library-store.js:110',
    detail: "resolveLibraryPath 把 '/src/...' 映射到 projectRoot/src/...",
    why: '库路径的 /src/ 虚拟前缀',
    resolve: (root) => path.join(root, 'src'),
    expect: 'dir',
    also: [
      {
        label: "resolveLibraryPath('/src/package.json')",
        resolve: (root) => path.join(root, 'src', 'package.json'),
        expect: 'file',
      },
      {
        label: "resolveLibraryPath('/src/node_modules/compare-versions/package.json')",
        resolve: (root) => path.join(root, 'src', 'node_modules', 'compare-versions', 'package.json'),
        expect: 'file',
      },
    ],
  },
];

/** 显式递归复制——**不用** fs.cpSync(recursive)：本机宿主上该调用会被静默击杀（见环境坑）。 */
export function copyTree(from, to) {
  const stat = fs.statSync(from);
  if (stat.isFile()) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    return 1;
  }
  fs.mkdirSync(to, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    count += copyTree(path.join(from, entry.name), path.join(to, entry.name));
  }
  return count;
}

/**
 * 按 DEPLOYMENT_TREE 在 `deployRoot` 构造部署根（不复制整个仓库）。
 *
 * node_modules 走**目录联接**：它是共享依赖仓，不是源工作区，复制一份既慢又没意义。
 * 返回的 `copied` 是 `{...entry, files}`，供调用方打印与断言。
 */
export function buildDeploymentRoot(projectRoot, deployRoot, options = {}) {
  const linkNodeModules = options.linkNodeModules !== false;
  const copied = [];
  for (const entry of DEPLOYMENT_TREE) {
    const from = path.join(projectRoot, entry.from);
    const to = path.join(deployRoot, entry.to);
    if (!fs.existsSync(from)) throw new Error(`部署清单源不存在：${entry.from}`);
    const files = copyTree(from, to);
    copied.push({ ...entry, files });
  }
  if (linkNodeModules) {
    const target = path.join(projectRoot, 'node_modules');
    const link = path.join(deployRoot, 'node_modules');
    if (!fs.existsSync(link) && fs.existsSync(target)) {
      fs.symlinkSync(target, link, 'junction');
    }
  }
  return { copied, root: deployRoot };
}
