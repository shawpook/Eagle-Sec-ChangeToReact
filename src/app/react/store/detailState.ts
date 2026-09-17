import { create } from 'zustand';
import { usePanelState } from './panelState';
import { useFilterState } from './filterState';
import { useListState } from './listState';
import { useBodyState } from './bodyState';
;
import { getMigratedScopeField } from '../core/scopeFieldBridge';

import { getGIFPath, getModelPath, getNativeViewerPath, getPDFPath, getRawPath, getRawUrl, getRawViewerPath, getTxtPath, getURLSrc } from '../core/itemDomain';
import { getThumbnailUrl } from '../services/imageOpsService';
import { getFontPath } from '../services/fontTagService';

import { machineryCurrentIndex } from '../services/gridService';
import { usePreferencesState } from './preferencesState';
import { useSelectionState } from './selectionState';
import { useMiscRawState } from './miscRawState';
import { useLayoutState } from './layoutState';
import { useItemState } from './itemState';
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
function callGetter(name: string | ((...a: any[]) => any), arg?: any): string {
  try {
    // E4：字符串形态的 getter 名按注册表解析（原 `scope[name]` 的等价物；未注册 = 未挂载）。
    const fn = typeof name === 'function' ? name : getMigratedScopeField(name)?.read();
    if (typeof fn !== 'function') return '';
    const value = arg !== undefined ? fn(arg) : fn();
    return value == null ? '' : String(value);
  } catch (err) {
    return '';
  }
}

function buildDetailSnapshot(): Partial<DetailSnapshot> {
      const preferences = usePreferencesState.getState().preferences || {};
      const keybinds = (preferences.shortcuts && preferences.shortcuts.keybinds) || {};
      const habits = (usePreferencesState.getState().preferences || preferences).habits || {};
      const current = useSelectionState.getState().current || null;
      const inspector = useMiscRawState.getState().inspector || {};
      const imageSize = useLayoutState.getState().imageSize || {};
      const pinned = Array.isArray(useMiscRawState.getState().pluginModule?.pinnedPlugins) ? useMiscRawState.getState().pluginModule.pinnedPlugins : [];

      /**
       * F-VP-1d（2026-09-17，视频详情控件条/右键菜单修复）：类型表取值必须带 window 兜底。
       *
       * 背景：`VIDEO_TYPES` / `AUDIO_TYPES` / `FONT_TYPES` / `URL_TYPES` / `MODEL_TYPES` /
       * `DISABLE_ZOOM_TYPES` / `SUPPORT_FORMATS` 这几张类型表是 bundle 时代由
       * `bundleGlobals.ts` 直接挂在 **window** 上的静态常量（`w.VIDEO_TYPES = {...}`，
       * 构建期由 EagleConfig.*_FORMATS 一次性生成），**从不经过 scope 写入路径**。
       * miscRawState 虽把这些名字登记进 MIGRATED（miscRawState.ts:548）以承接「后续 scope 写入」，
       * 但其初始值恒为 `null`（miscRawState.ts:509）且无人写入。
       *
       * 后果（本函数原先只读 store）：`isVideoType` 恒为 false → `#detail-container` 永远拿不到
       * `is-video` 类 → `_content-area.scss:527` 的 `#detail-container { width: 20000px }`
       *（图片缩放虚拟画布）无法被 `.is-video { width: 100% !important }`（同文件 580-581 行）覆盖，
       * 容器撑到 20000px，`.vjs-control-bar` 随之同宽并溢出视口 —— 控件条 DOM 齐全（17 个按钮）
       * 却不可见，用户可感知为「视频能播放但没有控件条 / 右键扩展菜单唤不出」。
       *
       * 取值语义与全仓其它消费点一致（Inspector.tsx:705/707、inspectorActions.ts:320/592、
       * boxItem.tsx:13 均读 `window.X`）：store 优先承接未来迁移，window 兜底承接当前静态表。
       */
      const typeTable = (name: string): any =>
        (useMiscRawState.getState() as any)[name] || (window as any)[name] || null;

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
          pluginExt = String(useMiscRawState.getState().pluginModule?.previewExtension?.getViewerPluginExt(current) ?? '');
        } catch (err) { pluginExt = ''; }
        try {
          pluginAllowZoom = !!useMiscRawState.getState().pluginModule?.previewExtension?.allowZoom(current.ext);
        } catch (err) { pluginAllowZoom = false; }
        try {
          pluginViewerUrl = String(useMiscRawState.getState().pluginModule?.previewExtension?.getViewerPluginURL(current) ?? '');
        } catch (err) { pluginViewerUrl = ''; }
      }

      let currentIndex = 0;
      try { currentIndex = machineryCurrentIndex() || 0; } catch (err) {}

      let rect: DetailSnapshot['commentRect'] = null;
      if (useMiscRawState.getState().commentRect && typeof useMiscRawState.getState().commentRect === 'object') {
        rect = JSON.parse(JSON.stringify(useMiscRawState.getState().commentRect));
      }

      return {
        ready: true,
        isDetailMode: !!useBodyState.getState().isDetailMode,
        isInlineMode: !!useBodyState.getState().isInlineMode,
        isCommentMode: !!useBodyState.getState().isCommentMode,
        isCropMode: !!useBodyState.getState().isCropMode,
        initDetailMode: !!useMiscRawState.getState().initDetailMode,
        useMpvPlayer: !!useMiscRawState.getState().useMpvPlayer,
        showDetailImage: !!useMiscRawState.getState().showDetailImage,
        smoothZoomDone: !!useBodyState.getState().smoothZoomDone,
        usingGifPlayer: !!useMiscRawState.getState().usingGifPlayer,
        isGifReady: !!useMiscRawState.getState().isGifReady,
        gifEnabled: habits.gifViewer === 'on' || !!useMiscRawState.getState().usingGifPlayer,
        gifPlaying: !!(useMiscRawState.getState().gifViewer && useMiscRawState.getState().gifViewer.playing),
        gifSpeed: (useMiscRawState.getState().gifViewer && useMiscRawState.getState().gifViewer.speed) || 1,
        theme: useBodyState.getState().theme || 'gray',
        language: useBodyState.getState().language || 'en',
        supportRotate: useMiscRawState.getState().supportRotate !== false,
        supportCrop: useMiscRawState.getState().supportCrop !== false,
        maxDimension: useMiscRawState.getState().MAX_DIMENSION ?? 120000000,
        renderPixelated: habits.renderBehavior === 'pixelated',
        keybinds,
        currentIndex,
        allDataCount: Array.isArray(useItemState.getState().allData) ? useItemState.getState().allData.length : 0,
        inspectorHide: !!inspector.isHideInspector,
        inspectorRenaming: !!inspector.isRenaming,
        inspectorWidth: inspector.width || 0,
        current: currentSnap,
        rawUrl: current ? callGetter(getRawUrl, current) : '',
        thumbnailUrl: current ? callGetter(getThumbnailUrl, current) : '',
        lastestThumbnailUrl: current ? callGetter('getLastestThumbnailPath', current) : '',
        rawPath: current ? callGetter(getRawPath, current) : '',
        pdfPath: current ? callGetter(getPDFPath) : '',
        gifPath: current ? callGetter(getGIFPath) : '',
        nativeViewerPath: current ? callGetter(getNativeViewerPath) : '',
        urlSrc: current ? callGetter(getURLSrc) : '',
        rawViewerPath: current ? callGetter(getRawViewerPath) : '',
        fontPath: current ? callGetter(getFontPath) : '',
        txtPath: current ? callGetter(getTxtPath) : '',
        modelPath: current ? callGetter(getModelPath) : '',
        pluginExt,
        pluginAllowZoom,
        pluginViewerUrl,
        pluginIsViewer: (() => {
          try {
            const map = useMiscRawState.getState().pluginModule?.previewExtension?.viewerPluginMap;
            return !!(current && map && map[current.ext]);
          } catch (err) {
            return false;
          }
        })(),
        isUrlType: !!(current && typeTable('URL_TYPES') && typeTable('URL_TYPES')[current.ext]),
        isFontType: !!(current && typeTable('FONT_TYPES') && typeTable('FONT_TYPES')[current.ext]),
        isVideoType: !!(current && typeTable('VIDEO_TYPES') && typeTable('VIDEO_TYPES')[current.ext]),
        isAudioType: !!(current && typeTable('AUDIO_TYPES') && typeTable('AUDIO_TYPES')[current.ext]),
        isModelType: !!(current && typeTable('MODEL_TYPES') && typeTable('MODEL_TYPES')[current.ext]),
        isPdf: !!current && current.ext === 'pdf',
        isGif: !!current && current.ext === 'gif',
        disableZoom: !!(current && typeTable('DISABLE_ZOOM_TYPES') && typeTable('DISABLE_ZOOM_TYPES')[current.ext]),
        notSupportFormat: !!(current && typeTable('SUPPORT_FORMATS') && !typeTable('SUPPORT_FORMATS')[current.ext]),
        commentRect: rect,
        ratio: useMiscRawState.getState().ratio || 0,
        zoomRatio: imageSize.zoomRatio ?? 100,
        zoomRatioExp: imageSize.zoomRatioExp ?? 100,
        imageSizeHeight: imageSize.height || 200,
        sliderZoomRatio: useMiscRawState.getState().sliderZoomRatio ?? 100,
        lastZoomMode: useMiscRawState.getState().lastZoomMode || '',
        viewMode: useBodyState.getState().viewMode || 'all',
        pinnedPlugins: pinned.map((p: any) => ({ name: p?.manifest?.name, icon: p?.icon })),
        needUpdatePluginCount: useMiscRawState.getState().pluginModule?.needUpdatePluginCount || 0,
      } as DetailSnapshot;
}

// b1-9by-C：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEqDetail(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastDetailSnapshot: any = null;

/** b1-9by-C：快照直写收敛——原 startScopeSync 200ms 轮询退役。 */
export function syncDetailFromScope(): void {
  const next = buildDetailSnapshot();
  if (lastDetailSnapshot !== null && shallowEqDetail(next, lastDetailSnapshot)) return;
  lastDetailSnapshot = next;
  useDetailState.setState({ snapshot: next as DetailSnapshot });
}

let bound = false;
let unbindSubscriptions: (() => void) | null = null;

export function unbindDetailSync(): void {
  if (!bound) return;
  bound = false;
  if (unbindSubscriptions) {
    unbindSubscriptions();
    unbindSubscriptions = null;
  }
}

export function bindDetailSync(): void {
  if (bound) return;
  bound = true;
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleDetailSync = syncDetailFromScope;
  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleDetailState = useDetailState;
  const unsub1 = useBodyState.subscribe(() => syncDetailFromScope());
  const unsub2 = useListState.subscribe(() => syncDetailFromScope());
  const unsub3 = useFilterState.subscribe(() => syncDetailFromScope());
  const unsub4 = usePanelState.subscribe(() => syncDetailFromScope());
  unbindSubscriptions = () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
  };
  // 启动期一次性对齐。
  syncDetailFromScope();
}
