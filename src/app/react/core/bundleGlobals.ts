/**
 * c10：bundle 全局接管（if-absent）——b1 后 app.bundle.js 死亡，其顶层 var/function/const
 * 在 window 上的 live binding 全部消失。本模块为 React 消费面（machinery/组件/域）依赖的
 * bundle 全局安装 React 自有实现：
 *
 * - **if-absent 语义**：window.X 无值才装——bundle 在世时沿用其绑定（加载顺序：bundle
 *   classic script 先于 React module script），行为零改变；b1 后 bundle 缺席，由本模块供给。
 *   幂等可重入。
 * - **Tier 1（本片）**：machinery/组件运行时硬依赖——appRoot（19002）、EagleConfig（2051）、
 *   VIDEO/AUDIO/FONT_TYPES（18988-18991）、SPECIAL_TYPES（18994）、fileSize（2548-2572）、
 *   re-require 十行（22776-22787 同路径，require 缓存命中同一实例）、installedFonts（19243）、
 *   fontFolder（19192-19198）、FileUrlHelper（React c1 移植版 fileUrlHelper.ts）。
 * - **Tier 2（后续片，PROGRESS 收口表跟踪）**：getHashID/guid/fuzzy_match/fuzzy_score/
 *   cloneTree/decodeBase64Image/hiddenByCurrentFilter/ayncsImagesChange/APIServer 族/
 *   Registration/SlowNotify/RecentFileManager/analytics/eg(InfiniteGrid)——当前仅 bundle
 *   域内路径使用，b1 前随各自 c 域移植接装。
 */

import { FileUrlHelper } from './fileUrlHelper';

let installed = false;

export function installBundleGlobals(): void {
  if (installed) return;
  installed = true;
  const w = window as any;
  const req = (name: string): any => {
    try {
      return w.require ? w.require(name) : undefined;
    } catch (err) { return undefined; }
  };

  // ── appRoot（bundle 19002：var appRoot = require('app-root-path')）──
  if (!w.appRoot) {
    const appRootMod = req('app-root-path');
    if (appRootMod) w.appRoot = appRootMod;
  }

  // ── EagleConfig（bundle 2051：const EagleConfig = require(appRoot + '/config.js')）──
  if (!w.EagleConfig && w.appRoot) {
    const cfg = req(w.appRoot + '/config.js');
    if (cfg) w.EagleConfig = cfg;
  }

  // ── 类型表（bundle 18988-18994 逐字；由 EagleConfig 格式表构建）──
  if (!w.VIDEO_TYPES && w.EagleConfig && w.EagleConfig.VIDEO_FORMATS) {
    const VIDEO_TYPES: any = {}; w.EagleConfig.VIDEO_FORMATS.forEach(function (ext: string) { VIDEO_TYPES[ext] = true; });
    w.VIDEO_TYPES = VIDEO_TYPES;
  }
  if (!w.AUDIO_TYPES && w.EagleConfig && w.EagleConfig.AUDIO_FORMATS) {
    const AUDIO_TYPES: any = {}; w.EagleConfig.AUDIO_FORMATS.forEach(function (ext: string) { AUDIO_TYPES[ext] = true; });
    w.AUDIO_TYPES = AUDIO_TYPES;
  }
  if (!w.FONT_TYPES && w.EagleConfig && w.EagleConfig.FONT_FORMATS) {
    const FONT_TYPES: any = {}; w.EagleConfig.FONT_FORMATS.forEach(function (ext: string) { FONT_TYPES[ext] = true; });
    w.FONT_TYPES = FONT_TYPES;
  }
  if (!w.SPECIAL_TYPES) {
    // bundle 18994 原文 afpub 出现两次（对象键去重后行为一致），此处只保留一次
    w.SPECIAL_TYPES = { mhtml: true, html: true, fbx: true, obj: true, 'glb': true, '3ds': true, '3mf': true, 'dae': true, 'ifc': true, 'ply': true, 'stl': true, af: true, afpub: true, afdesign: true, afphoto: true, fig: true, cdr: true, skp: true, dwg: true, blend: true, c4d: true, clip: true, prd: true, exr: true, hdr: true, skt: true, ppt: true, pptx: true, potx: true, docx: true, doc: true, xls: true, xlsx: true, eddx: true, emmx: true, number: true, page: true, txt: true };
  }

  // ── fileSize（bundle 2548-2572 逐字）──
  if (!w.fileSize) {
    w.fileSize = function (bytes: any, precision: any) {
      var units = [
        'bytes',
        'KB',
        'MB',
        'GB',
        'TB',
        'PB'
      ];

      if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) {
        return '?';
      }

      var unit = 0;
      var k = 1024;
      if (w.process && w.process.platform === 'darwin') k = 1000;

      while (bytes >= k) {
        bytes /= k;
        unit++;
      }

      return bytes.toFixed(+precision) + ' ' + units[unit];
    };
  }

  // ── re-require 十行（bundle 22776-22787 同路径；同 require 缓存命中同一实例）──
  try {
    if (!w.fse) w.fse = req('fs-extra');
    if (!w.tinyPinyin) w.tinyPinyin = req(w.appRoot + '/my_modules/tiny-pinyin');
    if (!w.pinyinlite) w.pinyinlite = req(w.appRoot + '/my_modules/pinyinlite');
    if (!w.readChunk) w.readChunk = req('read-chunk');
    if (!w.writeFileAtomic) w.writeFileAtomic = req('write-file-atomic');
    if (!w.cartesianProduct) w.cartesianProduct = req(w.appRoot + '/my_modules/cartesian-product');
    if (!w.sanitize) w.sanitize = req(w.appRoot + '/my_modules/sanitize-filename');
    if (!w.unicodeNormalize) w.unicodeNormalize = req('normalize-strings');
    if (!w.chineseConvert) w.chineseConvert = req(w.appRoot + '/my_modules/chinese_convert');
    if (!w.colorConvert) w.colorConvert = req('color-convert');
    if (!w.DeltaE) w.DeltaE = req('delta-e');
  } catch (err) { /* noop */ }

  // ── installedFonts（bundle 19243：var installedFonts = {}）──
  if (!w.installedFonts) w.installedFonts = {};

  // ── fontFolder（bundle 19192-19198 逐字）──
  if (!w.fontFolder) {
    if (w.process && w.process.platform === 'darwin') {
      try {
        const remoteMod = w.electron && w.electron.remote ? w.electron.remote : (w.require('@electron/remote') || undefined);
        const app = remoteMod && remoteMod.app;
        if (app) w.fontFolder = `${app.getPath("home")}/library/Fonts/EagleApp/`;
      } catch (err) { /* noop */ }
    }
    else {
      w.fontFolder = w.process ? `${w.process.env.SYSTEMROOT}/Fonts/` : undefined;
    }
  }

  // ── FileUrlHelper（React c1 移植版 fileUrlHelper.ts——bundle 2287 对象字面量的逐字提取，
  //    方法面全覆盖：getMetadataPath/getRawPath/getThumbnailPath/getThumbnailUrl/
  //    getLastestThumbnailUrl/getRawUrl）──
  if (!w.FileUrlHelper) w.FileUrlHelper = FileUrlHelper;

  // 诊断契约：冒烟断言全部关键全局在位（bundle 在世 = 沿用其绑定；b1 后 = 本模块供给）
  (window as any).__eagleBundleGlobals = {
    installed: true,
    present: ['appRoot', 'EagleConfig', 'VIDEO_TYPES', 'AUDIO_TYPES', 'FONT_TYPES', 'SPECIAL_TYPES',
      'fileSize', 'fse', 'tinyPinyin', 'pinyinlite', 'readChunk', 'writeFileAtomic', 'cartesianProduct',
      'sanitize', 'unicodeNormalize', 'chineseConvert', 'colorConvert', 'DeltaE', 'installedFonts',
      'fontFolder', 'FileUrlHelper'].filter((n) => w[n] !== undefined),
  };
}
