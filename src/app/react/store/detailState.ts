import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

/**
 * 阶段5：详情模式与查看器状态 —— 快照自 EagleController scope。
 *
 * DOM 规范 = index.html 387-928 行（.content-panel.detail-mode 模板）。
 * 事件回调仍调 scope 同名函数（leaveDetailMode/toggleCommentMode/getRawUrl...）；
 * URL/路径类 scope 函数（getRawUrl/getPDFPath/...）为纯函数，快照期直接求值。
 */

export interface DetailCurrentSnapshot {
  id: string;
  name: string;
  ext: string;
  width: number;
  height: number;
  background?: string;
  noPreview?: boolean;
  customThumbnail?: boolean;
  medium?: string;
  comments: any[];
}

export interface DetailSnapshot {
  ready: boolean;
  // 模式旗标
  isDetailMode: boolean;
  isInlineMode: boolean;
  isCommentMode: boolean;
  isCropMode: boolean;
  initDetailMode: boolean;
  useMpvPlayer: boolean;
  showDetailImage: boolean;
  smoothZoomDone: boolean;
  // gif 播放器
  usingGifPlayer: boolean;
  isGifReady: boolean;
  gifEnabled: boolean;
  gifPlaying: boolean;
  gifSpeed: number;
  // 平台/偏好
  theme: string;
  language: string;
  supportRotate: boolean;
  supportCrop: boolean;
  maxDimension: number;
  renderPixelated: boolean;
  keybinds: Record<string, string>;
  // 面包屑
  currentIndex: number;
  allDataCount: number;
  // 检查器（详情工具列 right 边距 + corner-btns 条件）
  inspectorHide: boolean;
  inspectorRenaming: boolean;
  inspectorWidth: number;
  // 当前条目
  current: DetailCurrentSnapshot | null;
  rawUrl: string;
  thumbnailUrl: string;
  lastestThumbnailUrl: string;
  rawPath: string;
  pdfPath: string;
  gifPath: string;
  nativeViewerPath: string;
  urlSrc: string;
  rawViewerPath: string;
  fontPath: string;
  txtPath: string;
  modelPath: string;
  // 插件查看分支（ng-switch on getViewerPluginExt(current)）
  pluginExt: string;
  pluginAllowZoom: boolean;
  pluginViewerUrl: string;
  pluginIsViewer: boolean;
  // 類型旗標（模板顯示條件）
  isUrlType: boolean;
  isFontType: boolean;
  isVideoType: boolean;
  isAudioType: boolean;
  isModelType: boolean;
  isPdf: boolean;
  isGif: boolean;
  disableZoom: boolean;
  notSupportFormat: boolean;
  // 缩放/批注
  commentRect: { startX?: number; startY?: number; w?: number; h?: number } | null;
  ratio: number;
  zoomRatio: number;
  zoomRatioExp: number;
  imageSizeHeight: number;
  sliderZoomRatio: number;
  lastZoomMode: string;
  viewMode: string;
  // 插件工具列
  pinnedPlugins: Array<{ name?: string; icon?: string }>;
  needUpdatePluginCount: number;
}

const EMPTY: DetailSnapshot = {
  ready: false,
  isDetailMode: false,
  isInlineMode: false,
  isCommentMode: false,
  isCropMode: false,
  initDetailMode: false,
  useMpvPlayer: false,
  showDetailImage: false,
  smoothZoomDone: false,
  usingGifPlayer: false,
  isGifReady: false,
  gifEnabled: false,
  gifPlaying: false,
  gifSpeed: 1,
  theme: 'gray',
  language: 'en',
  supportRotate: true,
  supportCrop: true,
  maxDimension: 120000000,
  renderPixelated: false,
  keybinds: {},
  currentIndex: 0,
  allDataCount: 0,
  inspectorHide: false,
  inspectorRenaming: false,
  inspectorWidth: 0,
  current: null,
  rawUrl: '',
  thumbnailUrl: '',
  lastestThumbnailUrl: '',
  rawPath: '',
  pdfPath: '',
  gifPath: '',
  nativeViewerPath: '',
  urlSrc: '',
  rawViewerPath: '',
  fontPath: '',
  txtPath: '',
  modelPath: '',
  pluginExt: '',
  pluginAllowZoom: false,
  pluginViewerUrl: '',
  pluginIsViewer: false,
  isUrlType: false,
  isFontType: false,
  isVideoType: false,
  isAudioType: false,
  isModelType: false,
  isPdf: false,
  isGif: false,
  disableZoom: false,
  notSupportFormat: false,
  commentRect: null,
  ratio: 0,
  zoomRatio: 100,
  zoomRatioExp: 100,
  imageSizeHeight: 200,
  sliderZoomRatio: 100,
  lastZoomMode: '',
  viewMode: 'all',
  pinnedPlugins: [],
  needUpdatePluginCount: 0,
};

export const useDetailState = create<{ snapshot: DetailSnapshot }>(() => ({ snapshot: EMPTY }));

const setSnapshot = (snapshot: DetailSnapshot) => useDetailState.setState({ snapshot });

/** 安全调用 scope 上的纯函数 getter（不可用時返回空串）。 */
function callGetter(scope: any, name: string, arg?: any): string {
  try {
    if (typeof scope[name] !== 'function') return '';
    const value = arg !== undefined ? scope[name](arg) : scope[name]();
    return value == null ? '' : String(value);
  } catch (err) {
    return '';
  }
}

export function bindDetailSync(): () => void {
  return startScopeSync({
    watch: [
      'isDetailMode',
      'isInlineMode',
      'isCommentMode',
      'isCropMode',
      'initDetailMode',
      'useMpvPlayer',
      'showDetailImage',
      'smoothZoomDone',
      'usingGifPlayer',
      'isGifReady',
      'current',
      'commentRect',
      'ratio',
      'imageSize',
      'sliderZoomRatio',
      'lastZoomMode',
      'gifViewer.speed',
      'gifViewer.playing',
      'allData.length',
      'inspector.isHideInspector',
      'inspector.isRenaming',
      'inspector.width',
      'supportRotate',
      'supportCrop',
      'theme',
      'pluginModule.pinnedPlugins',
      'pluginModule.needUpdatePluginCount',
      'preferences.habits.gifViewer',
      'preferences.habits.renderBehavior',
    ],
    build: (scope) => {
      const preferences = scope.preferences || {};
      const keybinds = (preferences.shortcuts && preferences.shortcuts.keybinds) || {};
      const habits = (scope.$root?.preferences || preferences).habits || {};
      const current = scope.current || null;
      const inspector = scope.inspector || {};
      const imageSize = scope.imageSize || {};
      const pinned = Array.isArray(scope.pluginModule?.pinnedPlugins) ? scope.pluginModule.pinnedPlugins : [];

      let currentSnap: DetailCurrentSnapshot | null = null;
      let pluginExt = '';
      let pluginAllowZoom = false;
      let pluginViewerUrl = '';
      if (current) {
        currentSnap = {
          id: current.id,
          name: current.name,
          ext: current.ext,
          width: current.width,
          height: current.height,
          background: current.background,
          noPreview: !!current.noPreview,
          customThumbnail: !!current.customThumbnail,
          medium: current.medium,
          // Angular 会在原地改 comments（rectComment push / commentItem 拖拽回写），必须深拷贝
          comments: Array.isArray(current.comments) ? JSON.parse(JSON.stringify(current.comments)) : [],
        };
        try {
          pluginExt = String(scope.pluginModule?.previewExtension?.getViewerPluginExt(current) ?? '');
        } catch (err) { pluginExt = ''; }
        try {
          pluginAllowZoom = !!scope.pluginModule?.previewExtension?.allowZoom(current.ext);
        } catch (err) { pluginAllowZoom = false; }
        try {
          pluginViewerUrl = String(scope.pluginModule?.previewExtension?.getViewerPluginURL(current) ?? '');
        } catch (err) { pluginViewerUrl = ''; }
      }

      let currentIndex = 0;
      try { currentIndex = typeof scope.currentIndex === 'function' ? (scope.currentIndex() || 0) : 0; } catch (err) {}

      let rect: DetailSnapshot['commentRect'] = null;
      if (scope.commentRect && typeof scope.commentRect === 'object') {
        rect = JSON.parse(JSON.stringify(scope.commentRect));
      }

      return {
        ready: true,
        isDetailMode: !!scope.isDetailMode,
        isInlineMode: !!scope.isInlineMode,
        isCommentMode: !!scope.isCommentMode,
        isCropMode: !!scope.isCropMode,
        initDetailMode: !!scope.initDetailMode,
        useMpvPlayer: !!scope.useMpvPlayer,
        showDetailImage: !!scope.showDetailImage,
        smoothZoomDone: !!scope.smoothZoomDone,
        usingGifPlayer: !!scope.usingGifPlayer,
        isGifReady: !!scope.isGifReady,
        gifEnabled: habits.gifViewer === 'on' || !!scope.usingGifPlayer,
        gifPlaying: !!(scope.gifViewer && scope.gifViewer.playing),
        gifSpeed: (scope.gifViewer && scope.gifViewer.speed) || 1,
        theme: scope.theme || 'gray',
        language: scope.language || 'en',
        supportRotate: scope.supportRotate !== false,
        supportCrop: scope.supportCrop !== false,
        maxDimension: scope.MAX_DIMENSION ?? 120000000,
        renderPixelated: habits.renderBehavior === 'pixelated',
        keybinds,
        currentIndex,
        allDataCount: Array.isArray(scope.allData) ? scope.allData.length : 0,
        inspectorHide: !!inspector.isHideInspector,
        inspectorRenaming: !!inspector.isRenaming,
        inspectorWidth: inspector.width || 0,
        current: currentSnap,
        rawUrl: current ? callGetter(scope, 'getRawUrl', current) : '',
        thumbnailUrl: current ? callGetter(scope, 'getThumbnailUrl', current) : '',
        lastestThumbnailUrl: current ? callGetter(scope, 'getLastestThumbnailPath', current) : '',
        rawPath: current ? callGetter(scope, 'getRawPath', current) : '',
        pdfPath: current ? callGetter(scope, 'getPDFPath') : '',
        gifPath: current ? callGetter(scope, 'getGIFPath') : '',
        nativeViewerPath: current ? callGetter(scope, 'getNativeViewerPath') : '',
        urlSrc: current ? callGetter(scope, 'getURLSrc') : '',
        rawViewerPath: current ? callGetter(scope, 'getRawViewerPath') : '',
        fontPath: current ? callGetter(scope, 'getFontPath') : '',
        txtPath: current ? callGetter(scope, 'getTxtPath') : '',
        modelPath: current ? callGetter(scope, 'getModelPath') : '',
        pluginExt,
        pluginAllowZoom,
        pluginViewerUrl,
        pluginIsViewer: (() => {
          try {
            const map = scope.pluginModule?.previewExtension?.viewerPluginMap;
            return !!(current && map && map[current.ext]);
          } catch (err) {
            return false;
          }
        })(),
        isUrlType: !!(current && scope.URL_TYPES && scope.URL_TYPES[current.ext]),
        isFontType: !!(current && scope.FONT_TYPES && scope.FONT_TYPES[current.ext]),
        isVideoType: !!(current && scope.VIDEO_TYPES && scope.VIDEO_TYPES[current.ext]),
        isAudioType: !!(current && scope.AUDIO_TYPES && scope.AUDIO_TYPES[current.ext]),
        isModelType: !!(current && scope.MODEL_TYPES && scope.MODEL_TYPES[current.ext]),
        isPdf: !!current && current.ext === 'pdf',
        isGif: !!current && current.ext === 'gif',
        disableZoom: !!(current && scope.DISABLE_ZOOM_TYPES && scope.DISABLE_ZOOM_TYPES[current.ext]),
        notSupportFormat: !!(current && scope.SUPPORT_FORMATS && !scope.SUPPORT_FORMATS[current.ext]),
        commentRect: rect,
        ratio: scope.ratio || 0,
        zoomRatio: imageSize.zoomRatio ?? 100,
        zoomRatioExp: imageSize.zoomRatioExp ?? 100,
        imageSizeHeight: imageSize.height || 200,
        sliderZoomRatio: scope.sliderZoomRatio ?? 100,
        lastZoomMode: scope.lastZoomMode || '',
        viewMode: scope.viewMode || 'all',
        pinnedPlugins: pinned.map((p: any) => ({ name: p?.manifest?.name, icon: p?.icon })),
        needUpdatePluginCount: scope.pluginModule?.needUpdatePluginCount || 0,
      } as DetailSnapshot;
    },
    apply: (snapshot) => setSnapshot(snapshot as DetailSnapshot),
  });
}
