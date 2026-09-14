/** Geometry for the entire result set. Scrolling only changes which rectangles are mounted. */
export interface GridMedia {
  id: string;
  width?: number;
  height?: number;
  ext?: string;
  noPreview?: boolean;
}

export interface GridRect {
  id: string;
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  thumbnailHeight: number;
}

export interface ContinuousLayout {
  rects: GridRect[];
  byId: Map<string, GridRect>;
  /** Monotonic bottom edges let a tall masonry item remain visible above later, shorter items. */
  maxBottoms: number[];
  height: number;
  width: number;
  columns: number;
}

export interface GridLayoutOptions {
  width: number;
  size: number;
  layout: string;
  showName: boolean;
  showMetas: boolean;
}

// Keep these in sync with continuousGrid.css. Reserving caption space makes image loading
// and filename wrapping unable to change scrollHeight while the native thumb is held.
export const GRID_NAME_HEIGHT = 37;
export const GRID_META_HEIGHT = 27;
const GAP = 8;

function aspectRatio(item: GridMedia): number {
  const ratio = Number(item.width) / Number(item.height);
  if (item.ext === 'txt' || item.noPreview || !Number.isFinite(ratio) || ratio <= 0) return 1;
  // Eagle displays long screenshots in a cropped thumbnail, rather than a whole tall column.
  return Math.max(0.4, ratio);
}

export function calculateContinuousLayout(items: readonly GridMedia[], options: GridLayoutOptions): ContinuousLayout {
  const isList = options.layout === 'ListLayout';
  const isMasonry = options.layout === 'GridLayout' || options.layout === 'SquareLayout';
  const width = Math.max(isList ? 640 : 1, options.width);
  const left = isList ? 0 : 16;
  const innerWidth = Math.max(1, width - left - (isList ? 0 : 8));
  const size = Math.max(50, Number(options.size) || 150);
  const caption = (options.showName ? GRID_NAME_HEIGHT : 0) + (options.showMetas ? GRID_META_HEIGHT : 0);
  const rects: GridRect[] = [];
  let columns = 1;
  let bottom = isList ? 0 : 3;

  const add = (index: number, x: number, y: number, w: number, thumbnailHeight: number, height: number) => {
    rects.push({ id: items[index].id, index, left: x, top: y, width: w, height, thumbnailHeight });
    bottom = Math.max(bottom, y + height);
  };

  if (isList) {
    const thumbnail = Math.floor(size / 5) * 5 / 3;
    const height = Math.max(36, thumbnail + 2);
    for (let i = 0; i < items.length; i++) add(i, 0, i * height, innerWidth, thumbnail, height);
  } else if (isMasonry) {
    columns = Math.max(1, Math.floor((innerWidth + GAP) / (size + GAP)));
    const columnWidth = (innerWidth - GAP * (columns - 1)) / columns;
    const bottoms = Array<number>(columns).fill(3);
    for (let i = 0; i < items.length; i++) {
      let column = 0;
      for (let c = 1; c < columns; c++) if (bottoms[c] < bottoms[column]) column = c;
      const thumbnail = options.layout === 'SquareLayout' ? columnWidth : columnWidth / aspectRatio(items[i]);
      const height = thumbnail + caption;
      add(i, left + column * (columnWidth + GAP), bottoms[column], columnWidth, thumbnail, height);
      bottoms[column] += height + GAP;
    }
  } else {
    // Choose a row break near the requested height using metadata, then fill the row exactly.
    // There are no page/group boundaries: a row can contain items 59 and 60, for example.
    const target = Math.max(24, size - caption);
    let start = 0;
    let y = 3;
    while (start < items.length) {
      let end = start;
      let ratioSum = 0;
      let previousHeight = Infinity;
      while (end < items.length) {
        const ratio = aspectRatio(items[end]);
        const nextHeight = Math.max(1, innerWidth - GAP * (end - start)) / (ratioSum + ratio);
        if (end > start && nextHeight < target && Math.abs(previousHeight - target) < Math.abs(nextHeight - target)) break;
        ratioSum += ratio;
        end++;
        previousHeight = nextHeight;
        if (nextHeight <= target || innerWidth - GAP * (end - start) <= GAP) break;
      }
      const count = end - start;
      const thumbnail = Math.max(1, innerWidth - GAP * (count - 1)) / ratioSum;
      let x = left;
      for (let i = start; i < end; i++) {
        const itemWidth = thumbnail * aspectRatio(items[i]);
        add(i, x, y, itemWidth, thumbnail, thumbnail + caption);
        x += itemWidth + GAP;
      }
      columns = Math.max(columns, count);
      y += thumbnail + caption + GAP;
      start = end;
    }
  }

  let maxBottom = 0;
  const maxBottoms = rects.map((rect) => (maxBottom = Math.max(maxBottom, rect.top + rect.height)));
  return { rects, maxBottoms, byId: new Map(rects.map((rect) => [rect.id, rect])),
    height: items.length ? bottom + 10 : 0, width, columns };
}

function firstAfter(values: readonly number[], value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid] < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function visibleGridRects(layout: ContinuousLayout, top: number, height: number, overscan = 800): GridRect[] {
  const start = top - overscan;
  const end = top + height + overscan;
  const visible: GridRect[] = [];
  for (let i = firstAfter(layout.maxBottoms, start); i < layout.rects.length; i++) {
    const rect = layout.rects[i];
    if (rect.top > end) break;
    if (rect.top + rect.height >= start) visible.push(rect);
  }
  return visible;
}

export interface GridScrollPosition {
  top: number;
  anchor?: { id: string; offset: number };
}

export function captureGridPosition(layout: ContinuousLayout, top: number, origin: number): GridScrollPosition {
  if (top <= 0) return { top: 0 };
  const index = firstAfter(layout.maxBottoms, top - origin);
  const rect = layout.rects[Math.min(index, layout.rects.length - 1)];
  return rect ? { top, anchor: { id: rect.id, offset: top - origin - rect.top } } : { top };
}

export function restoreGridPosition(layout: ContinuousLayout, position: GridScrollPosition, origin: number): number {
  const rect = position.anchor && layout.byId.get(position.anchor.id);
  return rect ? Math.max(0, origin + rect.top + position.anchor!.offset) : position.top;
}
