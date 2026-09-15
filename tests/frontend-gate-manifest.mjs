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

export const DIST_POLICY = {
  reactPages: REACT_PAGES,
  pages: STATIC_PAGES,
  dynamicAssets: DYNAMIC_ASSETS,
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
