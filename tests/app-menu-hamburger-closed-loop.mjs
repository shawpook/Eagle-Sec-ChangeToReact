/**
 * 应用菜单（左上角 hamburger）闭环回归 —— F-DOC-9 / F-DOC-11。
 *
 * 保护的是这个具体缺陷：**菜单一打开整片灰**。
 * 根因在换形层 `toContextMenuItems()` 把「无 click 者一律 disabled」套到了
 * **顶层八个菜单节**上——它们是悬停展开的导航父项，本就没有 click。
 * 故本测试的核心断言是：**顶层项不得出现 `.disabled`**。
 *
 * F-DOC-11：菜单入口**全局唯一**、**与侧栏显隐无关**、**不与相邻图标重叠**。
 * 原版三处同款元素（`index.html:70` body 级 / `:79` `#sidebar` 内 / `:560` 工具栏
 * `ng-if="isHideSidebar"`）会随侧栏开合互相顶替，用户看出「不是同一个」；
 * 曾收敛到 body 级绝对定位层，结果又压住了工具栏的侧栏开关（用户截图见重叠）。
 * 最终落点：`Toolbar.tsx` 的 `.breadcrumbs` **首位、无显隐条件**——参与 flex 排列，
 * 后续图标自然右移，两态都不重叠。
 *
 * 另断言：
 * - 按钮常驻（不随资源库加载态消失）；
 * - 点开真的弹出 `.context-menu`；
 * - 悬停顶层节能展开子菜单，且子菜单里灰项极少（当前仅 2 项无后端支撑）。
 */
import { bootWithItem, finish } from './closed-loop-common.mjs';

const EXPECTED_SECTIONS = 8;
/** 当前有意保留置灰的动作数（mergeLibrary / reverseSearchEagle —— 均需后端支撑）。 */
const TOLERATED_DISABLED = 2;

let ctx;
let extra = {};
let failure = null;

try {
  ctx = await bootWithItem('appmenu');
  const { ev, waitFor, delay } = ctx;

  /* 1. 至少有一处菜单入口挂载（两态各一处，具体归属在下节断言） */
  await waitFor(
    async () => await ev(`document.querySelectorAll('.application-menu-btn').length > 0`),
    'hamburger button mounted',
    20000,
  );

  /* 1b. F-DOC-11：菜单入口两态**各恰好一处**、**永不重叠**。
     - 侧栏打开 → 侧栏内左上角 `12,12`（原版 index.html:79）
     - 侧栏关闭 → 工具栏 `.breadcrumbs` 首位（原版 index.html:560 ng-if="isHideSidebar"）
     用状态写入直切（等价于点工具栏的侧栏开关）。 */
  const setHideSidebar = async (hidden) => {
    await ev(`window.__eagleBodyState.setState({ isHideSidebar: ${hidden} }); true`);
    /* 侧栏收放是 ~300ms 过渡，且关闭时只是把 #sidebar 平移出视口（元素仍在 DOM 里、
       display 仍为 flex）。必须等动画落定，并按**视口内**判可见，否则会把
       滑到 x=-240 的侧栏副本误判为「可见」。 */
    await delay(900);
    return ev(`(() => {
      const inViewport = (r) => r.width > 0 && r.right > 0 && r.bottom > 0
        && r.left < (window.innerWidth || 0) && r.top < (window.innerHeight || 0);
      const els = [...document.querySelectorAll('.application-menu-btn')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          return inViewport(el.getBoundingClientRect());
        });
      const menu = els[0] || null;
      const overlaps = (sel) => {
        const other = document.querySelector(sel);
        if (!menu || !other || !other.offsetParent) return false;
        const a = menu.getBoundingClientRect(), b = other.getBoundingClientRect();
        if (b.width === 0 || !inViewport(b)) return false;
        return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      };
      return {
        count: els.length,
        inSidebar: menu ? !!menu.closest('#sidebar') : null,
        inBreadcrumbs: menu ? !!menu.closest('.breadcrumbs') : null,
        pos: menu ? getComputedStyle(menu).position : null,
        rect: menu ? [Math.round(menu.getBoundingClientRect().x), Math.round(menu.getBoundingClientRect().y)] : null,
        sidebarRect: (() => {
          const sb = document.getElementById('sidebar');
          if (!sb) return null;
          const r = sb.getBoundingClientRect();
          return [Math.round(r.x), Math.round(r.y), Math.round(r.width)];
        })(),
        overlapToggle: overlaps('#toggle-all-btn'),
        overlapPrev: overlaps('.breadcrumbs > .ic-btn.prev'),
        overlapSidebarIcons: overlaps('.sidebar-toolbar'),
      };
    })()`);
  };
  const closed = await setHideSidebar(true);
  const opened = await setHideSidebar(false);
  extra.visibility = { closed, opened };

  for (const [label, s] of [['侧栏关闭', closed], ['侧栏打开', opened]]) {
    if (s.count !== 1) throw new Error(`${label}时可见菜单按钮 ${s.count} 个（应恰好 1 个）：${JSON.stringify(s)}`);
    if (s.overlapToggle) throw new Error(`${label}时菜单按钮与侧栏开关(#toggle-all-btn)重叠：${JSON.stringify(s)}`);
    if (s.overlapPrev) throw new Error(`${label}时菜单按钮与上一页按钮重叠：${JSON.stringify(s)}`);
  }
  /* 侧栏打开 → 侧栏内左上角 (12,12)；`absolute` 是**必须**的：
     类名里的 `fixed` 会命中 `body[platform=win32] .application-menu-btn.fixed`
     的 `position:fixed;top:8;left:0`，把按钮拽到视口角（原版用 inline absolute 覆盖）。 */
  if (!opened.inSidebar) throw new Error(`侧栏打开时菜单按钮不在 #sidebar 内：${JSON.stringify(opened)}`);
  if (opened.pos !== 'absolute') throw new Error(`侧栏打开时菜单按钮 position=${opened.pos}（应为 absolute，否则会被 .fixed 规则拽到视口角）`);
  if (String(opened.rect) !== '12,12') throw new Error(`侧栏打开时菜单按钮坐标 ${JSON.stringify(opened.rect)}，应为 [12,12]`);
  /* 侧栏关闭 → 工具栏面包削内（flex 子项，relative 是正常的） */
  if (!closed.inBreadcrumbs) throw new Error(`侧栏关闭时菜单按钮不在 .breadcrumbs 内：${JSON.stringify(closed)}`);
  if (closed.overlapSidebarIcons) throw new Error(`侧栏关闭时菜单按钮压住了侧栏工具图标：${JSON.stringify(closed)}`);

  /* 1c. body class 也应同步（确认用的是同一状态源） */
  const bodyHasClass = await ev(`document.body.className.includes('hide-sidebar')`);
  extra.bodyHideSidebarClass = bodyHasClass;
  if (bodyHasClass) throw new Error('侧栏打开态下 body 仍带 hide-sidebar class，状态源可能不一致');

  /* 2. 点击 → 菜单弹出（点当前可见的那一个，两态通用） */
  await ev(`(() => {
    const btn = [...document.querySelectorAll('.application-menu-btn')].find((el) => {
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).display !== 'none' && r.width > 0;
    });
    btn.click();
    return true;
  })()`);
  await waitFor(async () => (await ev(`document.querySelectorAll('.context-menu').length`)) > 0, 'context menu open', 15000);

  /* 3. 顶层：不得整片灰 —— 这是本测试的核心 */
  await waitFor(async () => (await ev(`document.querySelectorAll('.context-menu .context-menu-item').length`)) >= EXPECTED_SECTIONS, 'sections rendered', 10000);
  const top = await ev(`(() => {
    const items = [...document.querySelectorAll('.context-menu .context-menu-item')];
    return {
      total: items.length,
      disabled: items.filter((el) => el.className.includes('disabled')).length,
      labels: items.map((el) => (el.querySelector('.label')?.textContent || '').trim()).filter(Boolean),
    };
  })()`);
  extra.topLevel = { total: top.total, disabled: top.disabled, labels: top.labels };

  if (top.disabled > 0) {
    throw new Error(`顶层菜单节出现 ${top.disabled}/${top.total} 个灰项（应为 0）：${JSON.stringify(top.labels)}`);
  }
  if (top.total < EXPECTED_SECTIONS) {
    throw new Error(`顶层菜单节只有 ${top.total} 个，期望 >= ${EXPECTED_SECTIONS}`);
  }
  if (top.labels.length === 0 || top.labels.some((l) => /^appmenu\./.test(l))) {
    throw new Error(`顶层文案异常（疑似 i18n 未解析）：${JSON.stringify(top.labels)}`);
  }

  /* 4. 悬停第二个节（文件）→ 展开子菜单，统计可用项 */
  await ev(`(() => {
    const items = [...document.querySelectorAll('.context-menu .context-menu-item')];
    const el = items[1];
    if (el) el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    return true;
  })()`);
  await delay(400);
  const sub = await ev(`(() => {
    const menus = [...document.querySelectorAll('.context-menu')];
    const last = menus[menus.length - 1];
    const items = [...last.querySelectorAll('.context-menu-item')];
    return {
      panes: menus.length,
      total: items.length,
      disabled: items.filter((el) => el.className.includes('disabled')).length,
    };
  })()`);
  extra.submenu = sub;

  if (sub.panes < 2) throw new Error(`悬停后未展开子菜单（.context-menu 面板数 ${sub.panes}）`);
  if (sub.total === 0) throw new Error('子菜单没有任何项');
  if (sub.disabled > TOLERATED_DISABLED) {
    throw new Error(`子菜单灰项 ${sub.disabled}/${sub.total}，超过容忍值 ${TOLERATED_DISABLED}`);
  }

  /* 5. 键盘可达：顶层第一项应可选中（灰项会被 isItemSelectable 排除） */
  const selectable = await ev(`(() => {
    const el = document.querySelector('.context-menu .context-menu-item');
    return !!el && !el.className.includes('disabled');
  })()`);
  if (!selectable) throw new Error('顶层首项不可选（键盘导航会跳过整份菜单）');
} catch (err) {
  failure = err;
}

await finish(ctx, failure, 'APP_MENU_OK', extra);
