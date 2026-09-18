import { create } from 'zustand';

/**
 * F-DOC-2：文档查看器宿主侧状态。
 *
 * 背景：文档查看器（`viewers/document/`，独立 iframe）自带一套 header 控件（字体下拉 +
 * 圆形图标：主题/编辑/分栏/预览/关闭），位于 iframe 内部顶端，与 Eagle 原生顶栏风格割裂。
 * 本 store 承接 iframe 经 postMessage 上报的 header 状态，供**原生 `Toolbar` 组件**
 * （`components/toolbar/Toolbar.tsx`）在文档查看器打开期间直接改渲染文档控件组。
 *
 * 设计原则（F-DOC-2 返工）：**改造原框架，而不是套层皮**。
 * 第一版实现是把文档控件 portal 到 `#eagle-toolbar-host` 再用 CSS 把原生 Toolbar 的
 * 子树 `visibility:hidden` —— 那只是视觉遮盖，原生 Toolbar 仍在渲染、两棵 React 树
 * 抢同一个宿主。现改为：`Toolbar` 组件内读本 store，`active` 时直接 return 文档控件
 * 分支，原生工具栏**根本不渲染**（不是被盖住）。
 *
 * 数据流向：iframe --(postMessage 'state')--> documentViewer.ts --> 本 store --> Toolbar
 *           Toolbar --(sendDocumentViewerCommand)--> documentViewer.ts --(postMessage)--> iframe
 */

/** 查看器上报的 header 快照。iframe 未就绪时为 null。 */
export interface DocumentViewerHeaderState {
  /** 素材显示名（标题）。 */
  name: string;
  /** 扩展名（不含点）。 */
  extension: string;
  /** 当前页/位置指示，如「1 / 60」；无则空串。 */
  pageIndicator: string;
  /** 编码标签（如 UTF-8）；无则空串。 */
  encoding: string;
  /** 保存状态标签文案（如「已保存」）；无则空串。 */
  statusLabel: string;
  /** 字体预设当前值。 */
  fontPreset: string;
  /** 字体可选项。 */
  fontOptions: Array<{ value: string; label: string }>;
  /** 编辑器配色模式。 */
  colorMode: 'light' | 'dark' | 'auto';
  /** 当前阅读/编辑模式（'edit' | 'live' | 'preview'）。 */
  editorMode: string;
  /** 是否允许切换编辑模式（不可编辑的素材隐藏这三个按钮）。 */
  editable: boolean;
  /** 是否有上/下一篇。 */
  hasPrev: boolean;
  hasNext: boolean;
  /**
   * F-DOC-3：上/下一篇的素材 id（无则空串）。
   *
   * 为什么要把 id 送到宿主：宿主的顶栏按钮点击后只能发一条 postMessage，
   * 而 iframe 内的「相邻项」得由 iframe 自己算。若宿主只说 "next"，
   * iframe 会基于**它自己**的列表推进 —— 两侧列表一旦不同步（宿主导航后 iframe 不知情），
   * 就会错位或原地不动。直接传 id 可让 iframe 精确跳转，无需重载 iframe。
   */
  prevId: string;
  nextId: string;
  /** 当前序号 / 总数（用于左上角计数器）。 */
  currentIndex: number;
  totalCount: number;
  /** 是否收藏。 */
  starred: boolean;
  /** 是否为全屏（fullscreen）语义。 */
  fullscreen: boolean;
}

/** 查看器可接收的宿主指令。 */
export type DocumentViewerCommand =
  | { type: 'setFont'; value: string }
  | { type: 'toggleColorMode' }
  | { type: 'setEditorMode'; value: string }
  | { type: 'prev' }
  | { type: 'next' }
  /**
   * F-DOC-3：切到指定素材。
   *
   * 背景：查看器的素材列表与当前项来自 **iframe URL 参数**（`id` / `ids`），
   * 宿主点击上/下一篇时只改了宿主自己的 React 状态，iframe 内那套 store 完全不知情，
   * 于是画面始终停在最初那篇（「切换失败、卡在文本框里」）。
   * 这里补一条带素材 id 的导航指令，让 iframe 在自己的 store 内切换，无需重载页面。
   */
  | { type: 'navigate'; value: string }
  | { type: 'toggleStar' }
  | { type: 'openExternal' }
  | { type: 'toggleFullscreen' }
  | { type: 'close' };

interface DocumentViewerHostState {
  /** 查看器容器是否挂载（即文档详情是否处于打开状态）。 */
  open: boolean;
  /** 是否已完成 postMessage 握手并收到首帧状态。 */
  ready: boolean;
  /**
   * 原生 `Toolbar` 是否改渲染文档控件。
   * 与 `open` 分开：握手前仍渲染原生工具栏，避免中途闪一帧空顶栏。
   */
  chromeActive: boolean;
  header: DocumentViewerHeaderState | null;
}

export const emptyDocumentViewerHeader: DocumentViewerHeaderState = {
  name: '',
  extension: '',
  pageIndicator: '',
  encoding: '',
  statusLabel: '',
  fontPreset: '',
  fontOptions: [],
  colorMode: 'auto',
  editorMode: 'preview',
  editable: false,
  hasPrev: false,
  hasNext: false,
  prevId: '',
  nextId: '',
  currentIndex: -1,
  totalCount: 0,
  starred: false,
  fullscreen: false,
};

export const useDocumentViewerHostState = create<DocumentViewerHostState>(() => ({
  open: false,
  ready: false,
  chromeActive: false,
  header: null,
}));

/** 容器挂载：暂不改渲染（等握手）。 */
export function writeDocumentViewerOpened(): void {
  useDocumentViewerHostState.setState({ open: true, ready: false, chromeActive: false, header: null });
}

/** 握手完成 + 首帧状态到达：原生 Toolbar 切到文档控件分支。 */
export function writeDocumentViewerHeader(header: DocumentViewerHeaderState): void {
  useDocumentViewerHostState.setState({ ready: true, chromeActive: true, header });
}

/** 容器卸载：完全复位，Toolbar 恢复原生渲染。 */
export function writeDocumentViewerClosed(): void {
  useDocumentViewerHostState.setState({ open: false, ready: false, chromeActive: false, header: null });
}
