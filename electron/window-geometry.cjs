'use strict';

/**
 * 窗口几何的**纯函数**载体（R0-1，2026-09-17）。
 *
 * 背景：验收报告 §3.1 记录的「启动后窗口不见」缺陷（陈旧 window-state.json 把主窗建到屏幕外）
 * 是被**人肉**发现的——修复逻辑写在 `electron/main.cjs` 里，而 main.cjs 既不进 tsconfig，
 * 也不是任何静态门禁的扫描对象，因此「把可见性校验删掉」不会让任何门禁变红。
 *
 * 本模块把那段逻辑抽成**不依赖 electron 的纯函数**（显示器集合由调用方注入），使
 * `tests/electron-window-geometry.mjs` 能在纯 Node 下穷举：完全屏外 / 只交叠 79px /
 * 多显示器 / 只有副屏 / 0 假值 等用例。抽离后 main.cjs 只剩薄封装，语义逐字保持。
 *
 * 约定：本文件**不得** require('electron')，否则纯 Node 单测无法加载。
 */

/** 与任一显示器工作区在两个方向上的最小交叠（px）；低于此值视为「窗口看不见」。 */
const MIN_VISIBLE_WINDOW_PX = 80;

/** 宽度/高度缺省值（与抽离前 main.cjs 的 `|| 1280` / `|| 800` 同值）。 */
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 取「大于 0 的有限数」，否则回落到 fallback —— 修 `||` 把 0 当假值的老问题。 */
function positiveNumber(value, fallback) {
  return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function workAreaOf(display) {
  const area = display && (display.workArea || display.bounds);
  if (!area) return null;
  if (!isFiniteNumber(area.x) || !isFiniteNumber(area.y)
    || !isFiniteNumber(area.width) || !isFiniteNumber(area.height)) return null;
  return area;
}

/**
 * 窗口矩形与单个显示器工作区的交叠尺寸。
 * 抽离前是内联在 `boundsVisibleEnough` 里的两行 min/max，此处原样保留。
 */
function overlapWith(bounds, area) {
  return {
    width: Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x),
    height: Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y),
  };
}

/**
 * 窗口是否「看得见」：与任一显示器工作区的交叠在横纵两个方向都 ≥ 阈值。
 *
 * @param {{x:number,y:number,width:number,height:number}} bounds 窗口矩形
 * @param {Array<{workArea?:{x:number,y:number,width:number,height:number}}>} displays 显示器集合
 * @returns {boolean} 显示器集合为空时返回 true —— 与抽离前「app 未 ready 拿不到 screen 就不拦」同义。
 */
function boundsVisibleEnough(bounds, displays) {
  if (!bounds || !isFiniteNumber(bounds.x) || !isFiniteNumber(bounds.y)) return false;
  const width = positiveNumber(bounds.width, DEFAULT_WIDTH);
  const height = positiveNumber(bounds.height, DEFAULT_HEIGHT);
  const list = Array.isArray(displays) ? displays : [];
  if (list.length === 0) return true;
  return list.some((display) => {
    const area = workAreaOf(display);
    if (!area) return false;
    const overlap = overlapWith({ x: bounds.x, y: bounds.y, width, height }, area);
    return overlap.width >= MIN_VISIBLE_WINDOW_PX && overlap.height >= MIN_VISIBLE_WINDOW_PX;
  });
}

/**
 * 丢弃落盘几何里「会让窗口看不见」的 x/y（宽高与 maximized 原样保留）。
 *
 * @param {object} saved `window-state.json` 的内容（可能缺失/脏数据）
 * @param {Array} displays 显示器集合
 */
function clampWindowState(saved, displays) {
  if (!saved || typeof saved !== 'object') return {};
  const next = { ...saved };
  if (!isFiniteNumber(next.x) || !isFiniteNumber(next.y)) {
    delete next.x;
    delete next.y;
    return next;
  }
  const width = positiveNumber(next.width, DEFAULT_WIDTH);
  const height = positiveNumber(next.height, DEFAULT_HEIGHT);
  if (boundsVisibleEnough({ x: next.x, y: next.y, width, height }, displays)) return next;
  delete next.x;
  delete next.y;
  return next;
}

/**
 * 解析最终的窗口几何（把 createWindow 里的「调用方参数 → 历史状态 → 缺省」三选一收敛到一处）。
 *
 * @returns {{width:number,height:number,x?:number,y?:number,positionApplied:boolean}}
 *   `positionApplied=false` 表示位置被丢弃，调用方**不要**写 x/y，交给系统居中。
 */
function resolveWindowBounds(options = {}, saved = {}, displays = []) {
  const width = positiveNumber(options.width, positiveNumber(saved.width, DEFAULT_WIDTH));
  const height = positiveNumber(options.height, positiveNumber(saved.height, DEFAULT_HEIGHT));
  const requestedX = isFiniteNumber(options.x) ? options.x : saved.x;
  const requestedY = isFiniteNumber(options.y) ? options.y : saved.y;
  if (isFiniteNumber(requestedX) && isFiniteNumber(requestedY)
    && boundsVisibleEnough({ x: requestedX, y: requestedY, width, height }, displays)) {
    return { width, height, x: requestedX, y: requestedY, positionApplied: true };
  }
  return { width, height, positionApplied: false };
}

module.exports = {
  MIN_VISIBLE_WINDOW_PX,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  overlapWith,
  boundsVisibleEnough,
  clampWindowState,
  resolveWindowBounds,
};
