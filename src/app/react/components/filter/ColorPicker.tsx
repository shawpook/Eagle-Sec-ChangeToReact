import React, { useEffect, useRef, useState } from 'react';

/**
 * b1-9bj：自研 HSV 平面取色器 —— 替代 colorpicker vendor（js/vendors/colorpicker/js/
 * colorpicker.js + eye.js + utils.js，jQuery 插件形态）。
 *
 * 视觉契约：饱和度/明度二维方格 + 横向色相条（对齐原 flat 模式布局）；指针拖拽取色。
 * 数据契约：onChange(hex) 派发不带 # 的 6 位大写 hex（原 vendor onChange(hsb, hex) 的
 * hex 参数形态，FilterItems 消费端零改动）；color 变更经 props 外部同步（原
 * ColorPickerSetColor 的等价物——filterWithColor 等 scope 写入面改值后 picker 跟随）。
 * 实现：Pointer Events + setPointerCapture，无任何 vendor 依赖。
 */

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return { h: 205, s: 1, v: 0.94 }; // #0087EF（原 vendor 初始色）
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh >= 0 && hh < 1) { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  const to = (n: number) => String(Math.round(clamp(n + m, 0, 1) * 255)).padStart(2, '0');
  return `${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

interface ColorPickerProps {
  /** 外部同步色（'#RRGGBB' 或 'RRGGBB'）。 */
  color?: string;
  /** 取色回调：派发 6 位大写 hex（不带 #，原 vendor onChange 的 hex 形态）。 */
  onChange: (hex: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(color || '0087EF'));
  const lastEmitted = useRef<string>('');
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // 外部同步（原 ColorPickerSetColor 等价）：props 色与当前派发值不同才回灌内部状态
  useEffect(() => {
    if (!color) return;
    const hex = String(color).replace('#', '').toUpperCase();
    if (hex === lastEmitted.current) return;
    setHsv(hexToHsv(hex));
  }, [color]);

  const emit = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    lastEmitted.current = hex;
    onChange(hex);
  };

  const trackHsv = (e: React.PointerEvent, part: 'sv' | 'hue') => {
    const host = part === 'sv' ? svRef.current : hueRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    if (part === 'sv') {
      const s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const v = 1 - clamp((e.clientY - rect.top) / rect.height, 0, 1);
      emit({ h: hsv.h, s, v });
    } else {
      const h = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360;
      emit({ h, s: hsv.s, v: hsv.v });
    }
  };

  const beginTrack = (part: 'sv' | 'hue') => (e: React.PointerEvent) => {
    e.preventDefault();
    const host = part === 'sv' ? svRef.current : hueRef.current;
    if (!host) return;
    const move = (ev: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (part === 'sv') {
        const s = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        const v = 1 - clamp((ev.clientY - rect.top) / rect.height, 0, 1);
        emit({ h: hsv.h, s, v });
      } else {
        const h = clamp((ev.clientX - rect.left) / rect.width, 0, 1) * 360;
        emit({ h, s: hsv.s, v: hsv.v });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    trackHsv(e, part);
  };

  const hueColor = `hsl(${Math.round(hsv.h)}, 100%, 50%)`;

  return (
    <div style={{ padding: '8px 10px 6px', userSelect: 'none' } as React.CSSProperties}>
      <div
        ref={svRef}
        onPointerDown={beginTrack('sv')}
        style={{
          position: 'relative',
          height: 118,
          borderRadius: 3,
          background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${hueColor})`,
          cursor: 'crosshair',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `calc(${hsv.s * 100}% - 5px)`,
            top: `calc(${(1 - hsv.v) * 100}% - 5px)`,
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '2px solid #fff',
            boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div
        ref={hueRef}
        onPointerDown={beginTrack('hue')}
        style={{
          position: 'relative',
          height: 10,
          marginTop: 8,
          borderRadius: 3,
          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `calc(${(hsv.h / 360) * 100}% - 4px)`,
            top: -2,
            width: 8,
            height: 14,
            borderRadius: 2,
            border: '2px solid #fff',
            boxShadow: '0 0 2px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}
