/**
 * D-1 / Track B / B-3：键盘动作 handler 族（自 `core/dataMachinery.ts` 归位）。
 *
 * 仅收零反向依赖的键处理器（与 `core/keymap.ts` 的通用 Keymap 实现分离；本模块是
 * keymap 绑定表在 dataMachinery 侧引用的动作实现）。`machinerySaveHandler` 因依赖
 * `saveCrop`（imageOpsService → dataMachinery，会成环）暂留 dataMachinery。
 *
 * 消费面：
 * - dataMachinery 的键位绑定表（mod+w / m / j / g / mod+shift+方向）import 本模块；
 * - Sidebar（快捷搜索）/ Toolbar（动作面板）按钮直 import。
 */

import { openQuickSearchModalChannel, resizeCropToolChannel } from '../global/bus';
import { clickEl } from '../utils/domQuery';

import { machinerySaveHandler } from './keymap';
/** destoryMousetrap（bundle 49326-49330 邻域逐字：清空 scope.mousetrap 表并解绑全局键）。 */
export function machineryDestoryMousetrap(s: any): void {
  const w = window as any;
  if (!s.mousetrap) return;

  for (var key in s.mousetrap) {
    if (s.mousetrap.hasOwnProperty(key)) {
      w.Mousetrap.unbind(key);
    }
  }
}

/* ── mod+shift+方向：裁剪工具缩放（bundle 逐字）── */
export function machineryModShiftUpHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: -10
    });
    return;
  }
}

export function machineryModShiftDownHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: 10
    });
    return;
  }
}

export function machineryModShiftLeftHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: -10,
      vertical: 0
    });
    return;
  }
}

export function machineryModShiftRightHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 10,
      vertical: 0
    });
    return;
  }
}

/* closeWindowHandler（bundle 逐字；macOS quicklook 预览） */
export function machineryCloseWindowHandler(s: any, $event: any): void {
  const w = window as any;
  if (s.isPreviewing) {
    if (w.process.platform == 'darwin') {
      w.event && w.event.stopPropagation();
      w.event && w.event.preventDefault();
      w.IPCHelper.send('quicklook', s.selected[0]);
      s.isPreviewing = false;
    }
  }
}

/* mHandler（bundle 30825-30834 逐字：详情内视频/音频静音切换） */
export function machineryMHandler(s: any, $event: any): void {
  const w = window as any;
  if (!s.isDetailMode) {
    return;
  }
  if (w.VIDEO_TYPES[s.current.ext] || w.AUDIO_TYPES[s.current.ext]) {
    clickEl(".vjs-mute-control");
  }
}

/* openQuickSearch（bundle 32512-32514 逐字） */
export function machineryOpenQuickSearch(s: any, event: any): void {
  openQuickSearchModalChannel.emit();
}

/* openActionsPanel（bundle 43279-43282 逐字；eagle.action 经 window） */
export function machineryOpenActionsPanel(s: any, event: any): void {
  (window as any).eagle.action.open(s.selected);
}
