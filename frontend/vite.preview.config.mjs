import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RUNTIME_CONFIG_PATH,
  injectRuntimeConfigTag,
  renderRuntimeConfigScript,
  resolveRuntimeConfig,
} from './runtime-config.mjs';
import {
  PUBLISH_OUT_DIR,
  copyPublishAssets,
} from './publish-asset-manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, '../');
const frontendPublic = path.resolve(here, 'public');
const publishOutDir = path.resolve(workspaceRoot, PUBLISH_OUT_DIR);
// R5：文档查看器已从 frontend/document-viewer 迁入 src/app/react/viewers/document
// （与其余六个查看器同址；其源码本就在 typecheck 的 src/app/react 范围内，迁移后不再需要
// tsconfig 的独立 include 条目）。
const documentViewerEntry = path.resolve(workspaceRoot, 'src/app/react/viewers/document/index.html');
// M5-1（F22）：开发态不再把地址写进 HTML。三处基址只在**请求 `/eagle-runtime-config.js`
// 时**按 dev server 的启动环境生成（见下面的中间件与 frontend/runtime-config.mjs），
// 与生产静态服务共用同一份解析逻辑；`/file` 代理目标也从同一解析结果取，避免两处各写一份。
const devRuntimeConfig = resolveRuntimeConfig(process.env);
const thumbnailTarget = devRuntimeConfig.thumbnailBaseUrl;

// @vitejs/plugin-react 的 refresh preamble 通常经 transformIndexHtml 注入；本仓的
// /src/app/*.html 走自定义中间件直出、绕过该钩子，因此这里手动补同一段内联脚本，
// 否则被转换的 .tsx 会在运行时抛 "can't detect preamble"，导致整条 React import 链失败。
const REACT_REFRESH_PREAMBLE = `<script type="module">
      import RefreshRuntime from "/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>`;

// b1-9bz-E9（P5）：mock-data.js / shims.js 注入摘除——启动契约（require/process/i18n/
// electronSettings/总线/种子）已全量迁 src/app/react/core/shimsLegacy.ts，由各 React 入口
// 第一 import 供给。
//
// M5-1（F22）：后端地址内联配置同样摘除。页面侧只剩 `injectRuntimeConfigTag` 这一个补齐动作
// ——它只插入指向同源 `/eagle-runtime-config.js` 的标签，不含任何地址值，因此 dev 直出与
// 生产构建出的 HTML 形状一致，值由实际服务进程在请求时给出。

// R1：React 入口已写入各页源 HTML（`<script type="module" src="/src/app/react/...">`），
// 因此开发态不再注入入口脚本，只补 react-refresh 前置脚本（该钩子在 dev 由 plugin-react
// 注入，但这些页面走自定义中间件直出、绕过它）。生产构建由 Vite 正常处理源 HTML 的入口。
function injectDevPreamble(html) {
  return html.replace('</head>', `    ${REACT_REFRESH_PREAMBLE}\n</head>`);
}

function readEntryPage(file) {
  return injectDevPreamble(injectRuntimeConfigTag(fs.readFileSync(file, 'utf8')));
}

// b1-9af：viewer 窗接管通用路由——iframe 查看器页逐个切 React 后在此登记
// （壳 HTML 保留，旧控制脚本摘除，入口由本表注入；generic route 统一处理）。
const REACT_VIEWER_ENTRIES = {
  '/src/app/exif-viewer/index.html': '/src/app/react/viewers/exif/entry.tsx',
  '/src/app/raw-viewer/index.html': '/src/app/react/viewers/raw/entry.tsx',
  '/src/app/native-viewer/index.html': '/src/app/react/viewers/native/entry.tsx',
  '/src/app/gif-viewer/index.html': '/src/app/react/viewers/gif/entry.tsx',
  '/src/app/text-editor/text-editor.html': '/src/app/react/viewers/text-editor/entry.tsx',
  '/src/app/font-viewer/font-viewer.html': '/src/app/react/viewers/font/entry.tsx',
};

// R1：正式构建的多页入口表——以「工作区相对路径」为键；入口脚本同时写在源 HTML 中，
// build 经 rollupOptions.input + transformIndexHtml（仅补 API 地址/collect 清洗）产出。
const REACT_PAGE_ENTRIES = {
  'src/app/index.html': '/src/app/react/main.tsx',
  'src/app/preferences.html': '/src/app/react/preferences/entry.tsx',
  'src/app/preview-window.html': '/src/app/react/preview-window/entry.tsx',
  'src/app/collect-window/index.html': '/src/app/react/collect-window/entry.tsx',
  ...Object.fromEntries(
    Object.entries(REACT_VIEWER_ENTRIES).map(([url, entry]) => [url.replace(/^\//, ''), entry]),
  ),
};

// R6：sanitizeCollectTemplates / allowSingleColorPalette 一并删除——两个中间件改写的都是
// 已退役的 Angular 模板：前者修 `ng-mouseup="ng-mouseup="`（旧采集模板产物，全仓 0 命中），
// 后者把 `selected[0].palettes.length <= 1` 改成 `=== 0`（唯一命中在
// src/app/js/directives/inspector.html，该文件已随本批 git rm）。二者现状均为 no-op，
// 且只作用于 collect 分支。「单色面板」修复语义已归位 React 侧
// （components/inspector/Inspector.tsx 的 paletteShow）。

function readReplacement(name) {
  return fs.readFileSync(path.join(frontendPublic, 'replaced', name), 'utf8');
}

// M0：替代展示页（registration / manage-device）。源文件落在 frontend/public/replaced/，但**页面
// 内部引用按 `/src/app/` 层级书写**（`css/base.css`、`assets/images/...` 确实是 src/app 下的路径），
// 因此这张表的 URL 才是它们的真实解析基准：dev 由下面的中间件直出到该 URL，生产由
// eagle-production-assets 的复制规则交付到 `dist/frontend/src/app/` 下的同一路径。二者同源同基准。
const REPLACEMENT_PAGES = {
  '/src/app/registration.html': 'registration.html',
  '/src/app/manage-device.html': 'manage-device.html',
};

// M5-1（F17）：已迁入 React 模块图的外围工具页/媒体页。**URL 一个都不变**——
// 源码壳换到 `src/app/react/**` 后，产物落点通过 `closeBundle` 的重定位回到与旧
// public 页完全相同的位置（生产静态服务"路径即文件"，没有 rewrite 可言）；
// dev 则由下面的中间件把同一个 URL 直出为同一份壳。两侧因此共用一张表，不会漂移。
//   name = rollup input 键；url = 对外 URL（= 产物相对路径）；shell = 源码壳。
const RELOCATED_PAGES = [
  { name: 'workbench', url: '/workbench.html', shell: 'src/app/react/tools/workbench/index.html' },
  { name: 'roadmap', url: '/roadmap.html', shell: 'src/app/react/tools/roadmap/index.html' },
  { name: 'media-audio', url: '/media-viewer/audio.html', shell: 'src/app/react/viewers/media/audio/index.html' },
  { name: 'media-video', url: '/media-viewer/video.html', shell: 'src/app/react/viewers/media/video/index.html' },
];
const RELOCATED_PAGE_SHELLS = Object.fromEntries(RELOCATED_PAGES.map((page) => [page.url, page.shell]));

export default defineConfig({
  root: workspaceRoot,
  base: '/',
  publicDir: frontendPublic,
  plugins: [
    react(),
    {
      name: 'eagle-preview-shims',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url || '').split('?')[0]);
          // M5-1（F22）：运行时地址端点。与生产 `scripts/serve-frontend.mjs` 在同一路径、
          // 用同一份 `renderRuntimeConfigScript` 作答——页面无论由哪个进程服务，拿到的
          // 都是该进程启动环境解析出的地址，同一份产物因此可换端口启动。
          if (url === RUNTIME_CONFIG_PATH) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(renderRuntimeConfigScript(process.env));
            return;
          }
          if (url === '/') {
            res.statusCode = 302;
            res.setHeader('Location', '/src/app/index.html');
            res.end();
            return;
          }
          if (url === '/src/app/index.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/index.html')));
            return;
          }
          if (url === '/src/app/preferences.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/preferences.html')));
            return;
          }
          if (url === '/src/app/preview-window.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/preview-window.html')));
            return;
          }
          if (url === '/src/app/collect-window/index.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readEntryPage(path.join(workspaceRoot, 'src/app/collect-window/index.html')));
            return;
          }
          if (REPLACEMENT_PAGES[url]) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readReplacement(REPLACEMENT_PAGES[url]));
            return;
          }
          // M5-1（F17）：已迁入 React 的工具页/媒体页——对外 URL 不变，直出新的源码壳
          // （壳内含 `/src/app/react/**.tsx` 入口，由 Vite 正常转换；这里只补 refresh 前置脚本
          // 与运行期配置标签）。
          if (RELOCATED_PAGE_SHELLS[url]) {
            const file = path.join(workspaceRoot, RELOCATED_PAGE_SHELLS[url]);
            if (fs.existsSync(file)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(readEntryPage(file));
              return;
            }
          }
          // R5：文档查看器曾单列一条分支，因为它在迁移前经 Vite 原生 HTML 管线拿到的是
          // API+THUMBNAIL、与其余页的注入面不同。M5-1 统一地址来源后所有页只引用同一个
          // `/eagle-runtime-config.js`，该分支已无差异，故删除——本页落回下面的
          // `/src/app/**/*.html` 通用分支。
          if (url.startsWith('/src/app/') && url.endsWith('.html')) {
            // R1：viewer/其余页的 React 入口已写入源 HTML，这里只补 API 地址与 refresh 前置脚本。
            const file = path.join(workspaceRoot, url);
            if (fs.existsSync(file)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(readEntryPage(file));
              return;
            }
          }
          if (url.startsWith('/src/app/pdf-viewer/') && url.endsWith('.js')) {
            const file = path.join(workspaceRoot, url);
            if (fs.existsSync(file)) {
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              res.end(fs.readFileSync(file, 'utf8'));
              return;
            }
          }
          // R7：public 目录下的静态页默认由 Vite 原样直出。此前这里补的是「构建期写死的
          // API 地址」，与生产不一致；M5-1 起只补统一的配置脚本标签，值由上面的运行时端点
          // 给出——dev 与生产走完全相同的路径，页面对端口不再敏感。
          if (url.endsWith('.html')) {
            const file = path.resolve(frontendPublic, url.replace(/^\//, ''));
            if (file.startsWith(path.resolve(frontendPublic)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(injectRuntimeConfigTag(fs.readFileSync(file, 'utf8')));
              return;
            }
          }
          next();
        });
      },
      transformIndexHtml(html) {
        // M5-1（F22）：构建期不再写入任何地址值，只补统一的配置脚本标签（幂等）。
        // 值由实际服务产物的进程在请求 `/eagle-runtime-config.js` 时给出。
        // 说明：本钩子只覆盖走 Vite 的 HTML 输入；由 publicDir 原样复制的页面
        // （browser-extension/popup.html、replaced/*.html）在源码里自带该标签或不消费配置。
        return injectRuntimeConfigTag(html);
      },
    },
    {
      name: 'eagle-production-assets',
      apply: 'build',
      closeBundle() {
        const outDir = publishOutDir;
        console.log('[eagle] copying registered runtime assets ->', outDir);
        const { copied } = copyPublishAssets({
          workspaceRoot,
          outDir,
          appRuntimeHtmlExcludes: new Set(Object.keys(REACT_PAGE_ENTRIES)),
        });
        console.log(`[eagle] copied ${copied} registered asset entr${copied === 1 ? 'y' : 'ies'}`);
        // R1：publicDir（frontend/public）会整目录复制，其中 mock-library / mock-assets 是
        // 开发/演示数据，不进生产产物（开发态仍由 public 提供）。
        for (const devOnly of ['mock-library', 'mock-assets']) {
          fs.rmSync(path.join(outDir, devOnly), { recursive: true, force: true });
        }
        // M5-1（F17）：迁移后的工具页/媒体页做 URL 复位——Vite 按源码壳路径产出 HTML
        // （dist/frontend/src/app/react/...），这里把它搬到旧 public 页所在的完全相同位置，
        // 使产物 URL 与迁移前一致（生产静态服务「路径即文件」，没有 rewrite 可依赖）。
        // 用 rename 而非 copy：同一页面在产物里只能有一个解析基准；`base: '/'` 下
        // 资源引用是绝对路径，搬家不改变任何引用的解析。
        let relocated = 0;
        for (const page of RELOCATED_PAGES) {
          const from = path.join(outDir, page.shell);
          const to = path.join(outDir, page.url.replace(/^\//, ''));
          if (!fs.existsSync(from)) {
            throw new Error(`[eagle] 必需构建页不存在，无法重定位：${page.shell}`);
          }
          fs.mkdirSync(path.dirname(to), { recursive: true });
          fs.renameSync(from, to);
          relocated += 1;
          console.log(`[eagle] relocated ${page.shell} -> ${page.url}`);
        }
        // 全部复位成功才清理残留的空目录链；有失败时保留现场便于排查。
        if (relocated === RELOCATED_PAGES.length) {
          for (const dir of ['src/app/react/tools', 'src/app/react/viewers/media']) {
            fs.rmSync(path.join(outDir, dir), { recursive: true, force: true });
          }
        }
        console.log(`[eagle] runtime assets copied (${copied} item(s)); ${relocated}/${RELOCATED_PAGES.length} page(s) relocated; dev-only public data pruned`);
      },
    },
  ],
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      '/file': {
        target: thumbnailTarget,
        changeOrigin: true,
      },
    },
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    outDir: publishOutDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        pages: path.join(frontendPublic, 'pages.html'),
        'document-viewer': documentViewerEntry,
        // R1：交付页面多页入口（路径与开发态一致，产物落 dist/frontend/<相对路径>）。
        index: path.join(workspaceRoot, 'src/app/index.html'),
        preferences: path.join(workspaceRoot, 'src/app/preferences.html'),
        'preview-window': path.join(workspaceRoot, 'src/app/preview-window.html'),
        'collect-window': path.join(workspaceRoot, 'src/app/collect-window/index.html'),
        'exif-viewer': path.join(workspaceRoot, 'src/app/exif-viewer/index.html'),
        'raw-viewer': path.join(workspaceRoot, 'src/app/raw-viewer/index.html'),
        'native-viewer': path.join(workspaceRoot, 'src/app/native-viewer/index.html'),
        'gif-viewer': path.join(workspaceRoot, 'src/app/gif-viewer/index.html'),
        'text-editor': path.join(workspaceRoot, 'src/app/text-editor/text-editor.html'),
        'font-viewer': path.join(workspaceRoot, 'src/app/font-viewer/font-viewer.html'),
        // M5-1（F17）：迁移后的工具页/媒体页。产物先按源码壳路径落盘，
        // 再由 closeBundle 按 RELOCATED_PAGES.url 重定位回原 URL。
        ...Object.fromEntries(RELOCATED_PAGES.map((page) => [page.name, path.join(workspaceRoot, page.shell)])),
      },
    },
  },
});
