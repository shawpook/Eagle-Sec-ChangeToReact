/**
 * b1-9af：exif-viewer 接管——exif-player.js（54 行 jQuery）逐字语义 React 化。
 * URL 参数 → img 方向类 r{n} + 适配类（横向 fit-width(-2)/纵向 fit-height(-2)）+
 * pixelated + src 赋值 + show 淡入（CSS opacity transition 在壳内）。
 * 本页为被动渲染 iframe（详情面板/预览窗内嵌），壳的 body pointer-events:none 原样保留。
 * 缺参时 parseInt 产生 NaN → rNaN 类与原实现一致（无 r 类命中、走 default 适配分支）。
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function ExifImage() {
  const [spec, setSpec] = useState<{ src: string; className: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orientation = parseInt(params.get('orientation') ?? '', 10);
    const height = parseInt(params.get('height') ?? '', 10);
    const width = parseInt(params.get('width') ?? '', 10);
    const pixelated = params.get('zoom') === 'pixelated';
    const path = params.get('path') ?? '';
    const parts: string[] = [];
    if (pixelated) parts.push('pixelated');
    parts.push(`r${orientation}`);
    switch (orientation) {
      case 5:
      case 6:
      case 7:
      case 8:
        parts.push(width > height ? 'fit-height2' : 'fit-width2');
        break;
      default:
        parts.push(width > height ? 'fit-width' : 'fit-height');
    }
    parts.push('show');
    setSpec({ src: path, className: parts.join(' ') });
  }, []);
  if (!spec) return null;
  return <img id="main-image" src={spec.src} className={spec.className} alt="" />;
}

createRoot(document.getElementById('exif-root')!).render(<ExifImage />);
