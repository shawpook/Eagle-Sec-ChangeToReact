import { autoscrollChannel } from '../../global/bus';
import { useSelectionState } from '../../store/selectionState';
import { scrollGridToItem } from './boxGridEngine';

/** Keyboard/selection navigation also works when the target is outside the rendered window. */
export function initAutoScroll(): () => void {
  return autoscrollChannel.on(() => {
    const selected = useSelectionState.getState().selected;
    const item = selected?.[selected.length - 1];
    if (item?.id) scrollGridToItem(item.id);
  });
}

export function initScrollToTopSentinel(): () => void {
  const sentinel = document.getElementById('scroll-to-top-sentinel');
  const container = document.querySelector<HTMLElement>(sentinel?.getAttribute('scroll-container') || '#box-container');
  const selector = sentinel?.getAttribute('target') || '#scroll-to-top';
  const threshold = Number(sentinel?.getAttribute('threshold')) || 200;
  const update = () => {
    document.querySelector(selector)?.classList.toggle('show', (container?.scrollTop || 0) >= threshold);
  };
  container?.addEventListener('scroll', update, { passive: true });
  update();
  return () => container?.removeEventListener('scroll', update);
}

/** The old overlay mapped its thumb to page numbers and reset the grid during drag.
 * The native scrollbar now represents the full list height, including subfolders/header. */
export function initBoxContainerScrollbar(): () => void {
  const container = document.getElementById('box-container');
  const overlay = document.getElementById('box-container-scrollbar');
  container?.classList.remove('hide-scrollbar');
  if (overlay) overlay.hidden = true;
  return () => {};
}