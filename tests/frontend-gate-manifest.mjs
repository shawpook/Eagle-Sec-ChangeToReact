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
  // M5-1（F17）：四个原属 public 的产品入口点已迁入 React 模块图，**URL 一个都没变**——
  // 源码壳换到 `src/app/react/**`，产物落点由 `frontend/vite.preview.config.mjs` 的
  // RELOCATED_PAGES 在 closeBundle 阶段复位到下面这些旧 public 路径。
  // 登记在 REACT_PAGES（而非 STATIC_PAGES）是有意的强断言：它们必须带 module 入口
  // 且不得残留 `.tsx` 源码引用，否则「已进模块图」这句话就没有门禁支撑。
  'workbench.html',
  'roadmap.html',
  'media-viewer/audio.html',
  'media-viewer/video.html',
];

// 产物中按 URL 交付的**纯静态**页面（只需存在，不要求 module 入口）。
// 注意本表同时被 `tests/typecheck.mjs` 用作「frontend/public/**/*.html 必须登记」的判据，
// 因此这里的条目一律写成相对 public 的路径；交付于其它路径的页面见 SUPPORTED_PAGES。
export const STATIC_PAGES = [
  'pages.html',
  'browser-extension/popup.html',
  'replaced/registration.html', 'replaced/manage-device.html',
  'src/app/pdf-viewer/web/viewer.html',
  'src/app/model-viewer/website/index.html',
  'src/app/model-viewer/website/embed.html',
];

// M5-1（F17/F22）：**已明确取舍**的「源码在 public、交付在别处」页面台账。
//
// `frontend/public/replaced/*.html` 的页面内部引用按 `/src/app/` 层级书写（自带
// `<base href="/src/app/">`），其真实 URL 因此不是 `replaced/`。M5-1 要求把这一取舍写明：
// 结论是**正式支持**（生产同 URL 交付，不是"仅开发可用"），故此处逐条登记交付路径，
// 并把它并入 DIST_POLICY.pages 让产物闭包门禁真正检查该路径存在、其引用可解析。
// 每条都必须有非空 reason/consumer/exit，且由 `tests/frontend-public-policy.mjs` 反向校验
// consumer 确实引用了该 URL——防止条目退化成没人消费的长期垃圾。
export const SUPPORTED_PAGES = [
  {
    url: 'src/app/registration.html',
    source: 'frontend/public/replaced/registration.html',
    reason:
      '注册/许可状态展示页。取舍为**正式支持**：生产由 closeBundle 复制到 `dist/frontend/src/app/registration.html`，'
      + 'dev 由 vite.preview.config.mjs 的 REPLACEMENT_PAGES 中间件直出到同一 URL，两侧同源同基准。'
      + '未改 URL、未改页面内容。',
    consumer: 'frontend/public/pages.html:62（`<a href="/src/app/registration.html">`）',
    exit: '该页迁入 React 模块图（或产品决定下线该入口）时删除本条，并同步删除 REPLACEMENT_PAGES 中对应项',
  },
  {
    url: 'src/app/manage-device.html',
    source: 'frontend/public/replaced/manage-device.html',
    reason:
      '设备管理展示页。取舍同 registration：**正式支持**，生产与 dev 均交付于 `/src/app/manage-device.html`。',
    consumer: 'frontend/public/pages.html:63（`<a href="/src/app/manage-device.html">`）',
    exit: '该页迁入 React 模块图（或产品决定下线该入口）时删除本条，并同步删除 REPLACEMENT_PAGES 中对应项',
  },
];

// M5-1（F22）：`frontend/public` 中**显式豁免**的页面（不是遗漏，也不是隐藏）。
//
// 判据：页面是纯静态导航/展示，自身不发起任何 API/缩略图/扩展请求，因此不需要参与
// 统一地址策略，也不必进模块图。逐条登记 reason/consumer/exit，并由
// `tests/frontend-public-policy.mjs` 校验：豁免项必须真实存在、不得同时登记为 REACT_PAGES、
// 且每个 public HTML 都必须"已登记或被豁免"二者其一。
export const PUBLIC_PAGE_EXEMPTIONS = [
  {
    file: 'frontend/public/pages.html',
    reason:
      '复刻工程页面入口索引：一份纯静态导航页，全页只有一个 `<style>` 与一组 `<a href>`，'
      + '没有 script、不读取运行期地址、不访问后端，故不满足"需要进模块图"的条件。'
      + '它链接的每个目标 URL 本身都是已登记页面，闭包由 dist-entry-check 照常校验。',
    consumer: '人工入口页（M5-1 交付说明中列为开发/验收导航）；其出链被 tests/dist-entry-check.mjs 作为产物闭包的一部分检查',
    exit: '若该页开始携带脚本或需要按运行期地址拼链，则改为迁入 React 模块图并删除本条',
  },
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
  // 交付路径参与产物闭包检查：SUPPORTED_PAGES 的 url 必须真实存在于 dist 且引用可解析。
  pages: [...STATIC_PAGES, ...SUPPORTED_PAGES.map((page) => page.url)],
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
  // M5-1（F22）：`/eagle-runtime-config.js` 的静态兜底副本（正常由服务进程按启动环境生成）。
  'frontend/public/eagle-runtime-config.js',
  // M7-2（F02/D24，2026-09-16）：`frontend/public/tab-bar.js` 已退役，登记条目随之删除。
  // 该文件曾登记于此，退役前当场复核「无现役加载入口」（逐项 0 命中，见
  // `docs/retired-2026-09-16/README.md`），归档于 `docs/retired-2026-09-16/frontend/public/`。
  // 该文件若被重新引入 `frontend/public`，`tests/tab-bar-closed-loop.mjs` 的负向门禁会变红，
  // 且此处必须同时恢复登记，否则 `tests/typecheck.mjs` 的 `图外运行脚本未登记` 会失败。
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
    'plugins/eagle-note-plugin.js',
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
