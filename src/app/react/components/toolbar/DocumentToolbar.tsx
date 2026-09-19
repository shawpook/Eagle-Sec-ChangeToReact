import {
  Eye,
  Moon,
  PencilLine,
  SplitSquareVertical,
  Star,
  Sun,
} from 'lucide-react';
import { t } from '../../global/eagleGlobals';
import { sendDocumentViewerCommand } from '../../core/documentViewer';
import { useDocumentViewerHostState } from '../../store/documentViewerState';
import { useDetailState } from '../../store/detailState';
import { machinerySelectNext, machinerySelectPrev } from '../../core/selectionViewDomain';
import { machineryLeaveDetailMode } from '../../core/miscDomain';
import { machineryToggleAll } from '../../services/gridService';
import { openApplicationContextMenu, openSidebarVisibleContextMenu } from '../../services/miscMenuService';
import { runInBodyScope, SCOPED_HANDLER } from '../../core/appCore';

/**
 * F-DOC-2：文档查看器顶栏分支 —— **原生 `Toolbar` 的一个 render 分支**。
 *
 * 设计原则：改造原框架，而非套层皮。
 * 文档查看器打开且握手完成后，`Toolbar` 直接渲染本组件替代原生工具栏内容
 * （原生面包屑/缩放条/插件按钮/搜索框**根本不渲染**，不是被 `visibility` 盖住）。
 *
 * DOM 结构、类名与图标一律沿用原生 `.toolbar` 的既有体系：
 *   - 左栏 `.breadcrumbs`：`.ic-btn.prev.no-padding` 返回键 + `.counter` 计数器，
 *     与图像详情的 `DetailToolbar` 同一套写法（用户明确要求「和图像详情一样的箭头」）。
 *   - 右栏 `.right`：控件组。图标优先取 `assets/images/<theme>/icons/` 原生资源；
 *     该资源集中不存在的语义（主题/编辑/预览/收藏）沿用查看器 `ModeButton` 原有的
 *     lucide 描边图标——它们本就是这套控件组的原始外观。
 *
 * F-DOC-4：导航权威在宿主。计数器/上下篇禁用态与 DetailToolbar 同源
 * （`useDetailState` 快照的 currentIndex/allDataCount，即全部素材中的位置），
 * prev/next/返回键直调原生 machinery（machinerySelectPrev/Next / machineryLeaveDetailMode）
 * ——iframe 只是文档类条目的渲染分支，不再持有导航状态（修掉「下一项不是文档时
 * iframe 只能渲染占位图」的根因：非文档目标由 sync 层关闭 overlay、露出原生详情）。
 * iframe 上报的 header 仅保留表面状态（字体/配色/编辑模式/收藏/全屏）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;

/**
 * F-DOC-2：原生图标的**光学尺寸归一**。
 *
 * `assets/images/<theme>/icons/` 里的工具栏图标虽然同为 `ic-toolbar-*`，但 viewBox 与
 * 「墨迹填充率」差异极大——同一 `width` 下，填充率低的图标看起来会明显偏小：
 *
 *   ic-toolbar-exit            23×23   ink 11.1×11.1（画布 48%）→ 需放大
 *   ic-toolbar-prev / next     24×24   ink  6.6×12.0（画布 50%）→ 需放大
 *   ic-toolbar-close           10×10   ink 10.1×10.0（画布 101%）→ 基准
 *   ic-toolbar-open-default    14×14   ink 14.0×14.0（画布 100%）→ 基准
 *   ic-toolbar-zoom-fit        14×14   ink 13.0×13.0（画布 93%）
 *   ic-toolbar-zoom-actual     15×14   ink 14.0×13.0（画布 93%）
 *
 * 若统一 `width: 16px`，prev/next 的可见箭头只有 close 的一半高——这正是「大小不一」的根因。
 * 下表按填充率反比补偿，让**墨迹最长边**统一落在 `ICON_INK_TARGET`。
 * 填充率为实测值，改图标资源后需重跑 `tests-tmp/ink-probe.mjs` 更新。
 */
const ICON_INK_TARGET = 13;
const ICON_FILL: Record<string, number> = {
  'ic-toolbar-exit.svg': 0.48,
  'ic-toolbar-prev.svg': 0.5,
  'ic-toolbar-next.svg': 0.5,
  'ic-toolbar-close.svg': 1.01,
  'ic-toolbar-open-default.svg': 1.0,
  'ic-toolbar-zoom-fit.svg': 0.93,
  'ic-toolbar-zoom-actual.svg': 0.93,
};
const ICON_BOX: Record<string, number> = Object.fromEntries(
  Object.entries(ICON_FILL).map(([icon, fill]) => [icon, Math.round(ICON_INK_TARGET / fill)])
);

/** 按图标名取归一化盒子尺寸（未登记的图标回落到目标墨迹尺寸）。 */
const iconBoxOf = (icon: string) => ICON_BOX[icon] ?? ICON_INK_TARGET;

/**
 * 原生资源图标：显式带上归一化后的宽高，使各图标**可见墨迹**尺寸一致。
 * `data-ink` 仅用于测试断言（冒烟脚本读取它校验归一表生效）。
 */
function NativeIcon({ theme, icon }: { theme: string; icon: string }) {
  const box = iconBoxOf(icon);
  return <img src={iconSrc(theme, icon)} width={box} height={box} data-ink={Math.round(box * (ICON_FILL[icon] ?? 1))} alt="" />;
}

/** 圆形图标按钮：形状对齐查看器内 `ModeButton`（rounded-full / 32px）。 */
function DocRoundBtn({
  title,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`ic-btn doc-chrome-btn no-padding${active ? ' active' : ''}`}
    >
      {children}
    </button>
  );
}

/**
 * lucide 描边图标外框：`ModeButton` 原本用 `h-3.5 w-3.5`（= 14px）。
 * lucide 的 ink 铺满 viewBox，与上面归一化后的原生图标光学尺寸相当。
 */
function GlyphIcon({ children }: { children: React.ReactNode }) {
  return <span className="doc-chrome-glyph">{children}</span>;
}

/**
 * 与 `Toolbar.tsx` 的 `call` 同构：把调用包进 body scope 执行。
 * machinery 系函数带 `SCOPED_HANDLER` 标记时需以 scope 为首参。
 */
const call = (fn: string | ((...a: any[]) => any), ...preArgs: any[]) => (e?: any) =>
  runInBodyScope((scope: any) => {
    const target = typeof fn === 'function' ? fn : scope[fn];
    if (typeof target !== 'function') return;
    const args = preArgs.length ? preArgs : e === undefined ? [] : [e];
    if (typeof fn === 'function' && (fn as any)[SCOPED_HANDLER]) target(scope, ...args);
    else target(...args);
  });

export function DocumentToolbarBranch({ theme }: { theme: string }) {
  const { header } = useDocumentViewerHostState();
  const send = sendDocumentViewerCommand;
  // F-DOC-4：计数器与上下篇禁用态取自宿主 detail 快照（与 DetailToolbar 同一来源、同一语义：
  // currentIndex 为 1 起始的全体素材位置）。文档分支与图像分支在顶栏导航上完全同构。
  const { currentIndex, allDataCount } = useDetailState((s: any) => s.snapshot);

  const fontOptions = header?.fontOptions ?? [];
  const editable = Boolean(header?.editable);
  const editorMode = header?.editorMode ?? '';
  const colorMode = header?.colorMode;

  return (
    <>
      {/* ── 左：应用菜单 + 侧栏开关 + 返回键 + 计数器 ──
          应用菜单（hamburger）与侧栏开关**直接沿用原生组件、图标与点击处理**。
          hamburger 在原生工具栏里是「侧栏隐藏时才显示」，但文档态有个关键差异：
          文档查看器**本身就会自动收起侧栏**，且用户随时可能重新展开，
          若沿用原生条件，菜单入口会在展开侧栏时凭空消失——因此这里**常显**。 */}
      <div className="breadcrumbs" onDoubleClick={(e) => e.stopPropagation()}>
        <div
          id="doc-chrome-app-menu"
          className="ic-btn application-menu-btn"
          data-click="openApplicationContextMenu($event)"
          onClick={call(openApplicationContextMenu)}
        >
          <img src={iconSrc(theme, 'ic-app-menu.svg')} />
        </div>
        <div
          id="toggle-all-btn"
          className="ic-btn"
          data-click="toggleAll($event)"
          onClick={call(machineryToggleAll)}
          onContextMenu={call(openSidebarVisibleContextMenu)}
        >
          <img src={iconSrc(theme, 'ic_toggle-sidebar.svg')} />
        </div>
        <div
          id="doc-chrome-back"
          className="ic-btn prev no-padding"
          title={t('toolbar.exitBtn')}
          onClick={call(machineryLeaveDetailMode)}
        >
          <NativeIcon theme={theme} icon="ic-toolbar-exit.svg" />
        </div>
        <ul>
          <li className="show">
            <div className="counter">
              {allDataCount > 0 ? `${currentIndex} / ${allDataCount}` : ''}
            </div>
          </li>
        </ul>
      </div>

      {/* ── 右：查看器控件组 ── */}
      <div className="right doc-chrome" onDoubleClick={(e) => e.stopPropagation()}>
        {fontOptions.length > 0 ? (
          <select
            id="doc-chrome-font"
            value={header?.fontPreset ?? ''}
            onChange={(event) => send({ type: 'setFont', value: event.currentTarget.value })}
            title="文档字体"
            className="doc-chrome-font"
          >
            {fontOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : null}

        <DocRoundBtn
          title={colorMode === 'dark' ? '切换为浅色编辑器' : '切换为深色编辑器'}
          onClick={() => send({ type: 'toggleColorMode' })}
        >
          {colorMode === 'dark'
            ? <Sun className="doc-chrome-glyph" />
            : <Moon className="doc-chrome-glyph" />}
        </DocRoundBtn>

        {editable ? (
          <>
            <DocRoundBtn
              active={editorMode === 'edit'}
              title="编辑"
              onClick={() => send({ type: 'setEditorMode', value: 'edit' })}
            >
              <PencilLine className="doc-chrome-glyph" />
            </DocRoundBtn>
            <DocRoundBtn
              active={editorMode === 'live'}
              title="分栏"
              onClick={() => send({ type: 'setEditorMode', value: 'live' })}
            >
              <SplitSquareVertical className="doc-chrome-glyph" />
            </DocRoundBtn>
            <DocRoundBtn
              active={editorMode === 'preview'}
              title="预览"
              onClick={() => send({ type: 'setEditorMode', value: 'preview' })}
            >
              <Eye className="doc-chrome-glyph" />
            </DocRoundBtn>
          </>
        ) : null}

        <span className="separator" />

        {/*
          F-DOC-3/F-DOC-4：上/下一篇用**原生 .ic-btn.prev / .next**（无外框、无圆形背景），
          与图像详情的同类按钮完全一致。
          点击直调原生 machinerySelectPrev/Next（F-DOC-4 起不再向 iframe 下发 navigate）：
          目标仍是文档时由 sync 层原地切页；目标不是文档时关闭 overlay、露出原生详情。
          禁用态与 DetailToolbar 同源：首篇禁 prev、末篇禁 next。
        */}
        <div
          id="doc-chrome-prev"
          className={`ic-btn prev no-padding${currentIndex <= 1 ? ' disabled' : ''}`}
          title="上一个素材"
          onClick={call(machinerySelectPrev)}
        >
          <NativeIcon theme={theme} icon="ic-toolbar-prev.svg" />
        </div>
        <div
          id="doc-chrome-next"
          className={`ic-btn next no-padding${currentIndex >= allDataCount ? ' disabled' : ''}`}
          title="下一个素材"
          onClick={call(machinerySelectNext)}
        >
          <NativeIcon theme={theme} icon="ic-toolbar-next.svg" />
        </div>

        <DocRoundBtn
          title={header?.starred ? '取消收藏' : '收藏'}
          onClick={() => send({ type: 'toggleStar' })}
        >
          <Star className={`doc-chrome-glyph${header?.starred ? ' doc-chrome-starred' : ''}`} />
        </DocRoundBtn>
        <DocRoundBtn title="打开原文件" onClick={() => send({ type: 'openExternal' })}>
          <NativeIcon theme={theme} icon="ic-toolbar-open-default.svg" />
        </DocRoundBtn>
        <DocRoundBtn
          title={header?.fullscreen ? '返回中间预览' : '占满整个软件预览'}
          onClick={() => send({ type: 'toggleFullscreen' })}
        >
          <NativeIcon
            theme={theme}
            icon={header?.fullscreen ? 'ic-toolbar-zoom-fit.svg' : 'ic-toolbar-zoom-actual.svg'}
          />
        </DocRoundBtn>
        {/* F-DOC-4：关闭预览 = 退出详情（machineryLeaveDetailMode 会同步卸载 overlay 回网格）。 */}
        <DocRoundBtn title="关闭预览" onClick={call(machineryLeaveDetailMode)}>
          <NativeIcon theme={theme} icon="ic-toolbar-close.svg" />
        </DocRoundBtn>
      </div>
    </>
  );
}
