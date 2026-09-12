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
import { useBodyState } from '../store/bodyState';
import { useMiscRawState } from '../store/miscRawState';
import { useSelectionState } from '../store/selectionState';
import { writeScopeField } from './scopeFieldBridge';
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
export function machineryModShiftUpHandler(event: any): void {
  event && event.preventDefault();
  if (useBodyState.getState().isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: -10
    });
    return;
  }
}

export function machineryModShiftDownHandler(event: any): void {
  event && event.preventDefault();
  if (useBodyState.getState().isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: 10
    });
    return;
  }
}

export function machineryModShiftLeftHandler(event: any): void {
  event && event.preventDefault();
  if (useBodyState.getState().isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: -10,
      vertical: 0
    });
    return;
  }
}

export function machineryModShiftRightHandler(event: any): void {
  event && event.preventDefault();
  if (useBodyState.getState().isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 10,
      vertical: 0
    });
    return;
  }
}

/* closeWindowHandler（bundle 逐字；macOS quicklook 预览） */
export function machineryCloseWindowHandler($event: any): void {
  const w = window as any;
  if (useMiscRawState.getState().isPreviewing) {
    if (w.process.platform == 'darwin') {
      w.event && w.event.stopPropagation();
      w.event && w.event.preventDefault();
      w.IPCHelper.send('quicklook', useSelectionState.getState().selected[0]);
      writeScopeField('isPreviewing', false);
    }
  }
}

/* mHandler（bundle 30825-30834 逐字：详情内视频/音频静音切换） */
export function machineryMHandler($event: any): void {
  const w = window as any;
  if (!useBodyState.getState().isDetailMode) {
    return;
  }
  if (w.VIDEO_TYPES[useSelectionState.getState().current.ext] || w.AUDIO_TYPES[useSelectionState.getState().current.ext]) {
    clickEl(".vjs-mute-control");
  }
}

/* openQuickSearch（bundle 32512-32514 逐字） */
export function machineryOpenQuickSearch(event: any): void {
  openQuickSearchModalChannel.emit();
}

/* openActionsPanel（bundle 43279-43282 逐字；eagle.action 经 window） */
export function machineryOpenActionsPanel(event: any): void {
  (window as any).eagle.action.open(useSelectionState.getState().selected);
}
