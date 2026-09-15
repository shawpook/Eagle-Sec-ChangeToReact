/** M0 门禁清单：资源登记不是缺失豁免，也不代表行为验收已执行。 */
export const REACT_PAGES = [
  'src/app/index.html',
  'src/app/preferences.html',
  'src/app/preview-window.html',
  'src/app/collect-window/index.html',
  'src/app/exif-viewer/index.html',
  'src/app/raw-viewer/index.html',
  'src/app/native-viewer/index.html',
  'src/app/gif-viewer/index.html',
  'src/app/text-editor/text-editor.html',
  'src/app/font-viewer/font-viewer.html',
  'src/app/react/viewers/document/index.html',
];

export const STATIC_PAGES = [
  'pages.html', 'workbench.html', 'roadmap.html',
  'media-viewer/audio.html', 'media-viewer/video.html',
  'browser-extension/popup.html',
  'replaced/registration.html', 'replaced/manage-device.html',
  'src/app/pdf-viewer/web/viewer.html',
  'src/app/model-viewer/website/index.html',
  'src/app/model-viewer/website/embed.html',
];

// 字符串拼接/运行期选择的资源不能仅靠构建图发现；按真实消费者登记。
export const DYNAMIC_ASSETS = [
  { file: 'src/app/js/workers/bitmapWorker.js', owner: 'core/bitmapViewer.ts', kind: 'worker' },
  { file: 'src/app/js/workers/calHammingDistance.js', owner: 'core/eagleClasses.ts', kind: 'worker' },
  { file: 'src/app/js/workers/tifWorker.js', owner: 'components/detail/commentHooks.ts', kind: 'worker' },
  { file: 'src/app/js/workers/heic2bitmap-worker.js', owner: 'bitmapWorker.js', kind: 'worker' },
  { file: 'src/app/js/workers/libheif.js', owner: 'bitmapWorker.js', kind: 'engine' },
  { file: 'src/app/js/workers/libheif.wasm', owner: 'heic2bitmap-worker.js', kind: 'wasm' },
  { file: 'vendor/eagle-match-rules.js', owner: 'core/bundleGlobals.ts', kind: 'runtime' },
  { file: 'vendor/eagle-zoom-helpers.js', owner: 'core/bundleGlobals.ts', kind: 'runtime' },
  { file: 'vendor/eagle-ga4mp.js', owner: 'core/bundleGlobals.ts', kind: 'engine' },
  { file: 'src/config.js', owner: 'core/shim/moduleRegistry.ts', kind: 'runtime' },
  { file: 'src/app/js/default-preferences.js', owner: 'core/shim/settingsI18n.ts', kind: 'runtime' },
  { file: 'src/app/js/plugin/api-format-extension.js', owner: 'components/detail/DetailViewer.tsx', kind: 'plugin-preload' },
];

// 逐条精确登记的「已知缺失」——不是豁免清单，是有退出条件的债务台账。
//
// 与 DYNAMIC_ASSETS 的区别：DYNAMIC_ASSETS 说明「产物里必须有这个文件」（缺了就 FAIL）；
// 本表说明「产物里**确实没有**这个文件，且这是已核实的既有事实」。门禁对每条只做三件事：
//   1) 引用它的地方缺失时，按本条降级为范围说明，而不是 FAIL；
//   2) 若该路径在产物中**已存在**，判定登记表失效并 FAIL——防止条目变成长期垃圾；
//   3) 若整轮遍历没有任何引用命中它，输出范围说明提示复核。
// 「源码里也没有」不构成登记理由：本表每条都必须有非空的 reason / consumer / exit，
// 且必须逐条评审。真实运行时缺陷（如页面相对路径解析错）禁止登记于此。
export const KNOWN_MISSING_ASSETS = [
  {
    missing: 'src/my_modules/utif/UDOC.js',
    reason:
      'UTIF 的 UDOC 是可选的 CMYK 增强分支：上游 UTIF.js 自身已内联 UDOC 命名空间，'
      + 'worker 侧的两处 importScripts 被 try/catch 显式包裹，加载失败只降级为非增强 CMYK 路径，'
      + '不影响 TIF 解码主流程。补齐该文件等于伪造第三方产物，故按刻意可选依赖登记。',
    consumer: 'src/app/js/workers/bitmapWorker.js:457-462、src/app/js/workers/tifWorker.js:2-6',
    exit: '2026-12-31 复核：若上游 UTIF 发布独立 UDOC.js 并成为必需依赖，则随升级补齐并删除本条',
  },
  {
    missing: 'font/2.0.0/VideoJS.eot',
    reason:
      '第三方 vendor video.js 2.0.0 的 @font-face IE 遗留分支（src: url(../font/2.0.0/VideoJS.eot?#iefix) format("eot")）。'
      + '紧随其后的同字体 base64 内联 WOFF 声明已被 Chromium/Electron 采用，EOT 分支不产生实际请求失败；'
      + '本项目无 IE 支持目标，且修改 vendor 文件会破坏第三方逐字一致性，故登记而非补造字体。',
    consumer: 'src/app/css/vendors/videojs/video-js.css、src/app/js/vendors/videojs/video-js.css（@font-face VideoJS）',
    exit: '2026-12-31 复核：升级或移除 vendor video.js 2.0.0 CSS 时随之一并删除本条',
  },
];

export const DIST_POLICY = {
  reactPages: REACT_PAGES,
  pages: STATIC_PAGES,
  dynamicAssets: DYNAMIC_ASSETS,
  knownMissing: KNOWN_MISSING_ASSETS,
  extensionManifests: ['browser-extension/manifest.json'],
  // 后端插件不伪装成已进入 dist/frontend；可在隔离部署根用同一检查器验证。
  pluginManifests: [],
  forbidden: ['mock-library', 'mock-assets'],
};

// 精确登记图外脚本。新增文件必须分类，不能凭 vendor 目录名自动免检。
export const SCRIPT_INVENTORY_ROOTS = ['frontend/public', 'src/app/js'];
export const FIRST_PARTY_SCRIPTS = [
  'frontend/public/browser-extension/background.js',
  'frontend/public/browser-extension/content.js',
  'frontend/public/browser-extension/popup.js',
  'frontend/public/tab-bar.js',
  'frontend/public/vendor/eagle-match-rules.js',
  'frontend/public/vendor/eagle-zoom-helpers.js',
  ...[
    'api-server-v2.js', 'api-v2-playground-config.js', 'api-v2-playground.js',
    'auto-import/auto-import.js', 'devices.js', 'downloader/downloader.js',
    'default-preferences.js', 'global.js',
    'plugin/api-format-extension.js', 'plugin/api.js', 'plugin/extra-module.js',
    'plugin/handlers.js', 'plugin/handlers/smart-folder-handlers.js', 'plugin/handlers/smart-folder-rules.js',
    'plugin/index.js', 'plugin/ipc.js', 'plugin/logger.js', 'plugin/main.js',
    'plugin/model/context-menu.js', 'plugin/model/folder.js', 'plugin/model/item.js',
    'plugin/model/smart-folder.js', 'plugin/model/tag-group.js', 'plugin/model/tag.js',
    'plugins/eagle-note-plugin.js', 'services/url-state-service.js',
    'utils/downloadFile.js', 'utils/flipImage.js', 'utils/getBestURL.js',
    'utils/ignoreMenuShortcuts.js', 'utils/is-accelerator.js',
    'utils/remainingFilenameLength.js', 'utils/rotateImage.js',
    'workers/bitmapWorker.js', 'workers/calHammingDistance.js',
    'workers/heic2bitmap-worker.js', 'workers/tifWorker.js',
  ].map((file) => `src/app/js/${file}`),
];

export const ENGINE_SCRIPTS = [
  ['frontend/public/vendor/eagle-ga4mp.js', 'GA4 Measurement Protocol 库'],
  ...[
    ['japanese.js', 'Japanese.js 转换库'],
    ['plugin/i18next.min.js', 'i18next'],
    ['utils/piexif.js', 'piexif'], ['utils/unorm.js', 'Unicode normalization'],
    ['vendors/bignumber.js', 'BigNumber'], ['vendors/libheif.js', 'libheif'],
    ['vendors/libtga.js', 'TGA 解码器'], ['vendors/tga.js', 'TGA 解码器'],
    ['vendors/tiny-pinyin.js', 'tiny-pinyin'], ['vendors/wavesurfer.min.js', 'WaveSurfer'],
    ['vendors/videojs/video.js', 'video.js'],
    ...['en', 'ja_JP', 'ko_KR', 'zh_CN', 'zh_TW'].map((lang) => [`vendors/videojs/lang/${lang}.js`, 'video.js 语言包']),
    ['workers/libheif.js', 'libheif Worker 引擎'],
  ].map(([file, reason]) => [`src/app/js/${file}`, reason]),
];

export const GATE_LIMITS = [
  '类型语义检查仍仅覆盖 tsconfig 的 React 子树；图外自有脚本仅做登记和注释指令扫描',
  '后端供给的插件/模板、后台 Worker 与用户插件尚无独立部署根，未计作前端产物通过',
  'src/my_modules、其它引擎目录、Electron/Node 业务未纳入本轮类型登记守卫',
  '动态拼接 URL、远程资源、API/用户媒体和原生 require 需运行期或专门清单验收',
];

export const GATE_UNIT_TEST = 'tests/frontend-gates-unit.mjs';
