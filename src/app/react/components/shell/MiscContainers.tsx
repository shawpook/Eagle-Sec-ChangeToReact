import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyState } from '../../store/bodyState';
import { t } from '../../global/eagleGlobals';
import { getBodyScope, scopeApply } from '../../core/appCore';
import { filterWithColor, hexToRGB } from '../../core/filterDomain';

/**
 * 11-pre a7：colors-picker 与 annotation-preview-container 接管（index.html 原块逐字）。
 *
 * - ColorsPicker：隐藏 color input（id 保留——bundle 32509/68199 程序化 click 打开取色器、
 *   写 $body.hexColor）；ng-change filterWithColor(hexToRGB(hexColor)) → onChange 200ms
 *   debounce（ng-model-options 等价）；color-picker 属性指令本体仅 $destroy 清理（7d-7 勘察），
 *   不需移植。
 * - AnnotationPreviewContainer：ng-if isDetailMode → 条件渲染；annotation-box ng-show
 *   currentComment → display。AnnotationPreview 对象（bundle 全局）经 jQuery 对 React 渲染
 *   节点继续操作（html/addClass/focus——C 模式），paste/input/keydown/focus 委托处理器在
 *   bundle（body 级委托，对任意 DOM 生效）；strip-br/allow-link/editable-selectall 指令
 *   随模板删除（plaintext-only contenteditable + bundle 委托处理器已覆盖主要行为，见
 *   PROGRESS a7 块记录）。
 */

function useHost(id: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById(id));
  }, [id]);
  return host;
}

/** 取色器（index.html 414 逐字；id 保留，value 默认 #ff0000）。 */
export function ColorsPicker() {
  const host = useHost('eagle-colors-picker-host');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!host) return null;
  return createPortal(
    <input
      style={{ display: 'none' }}
      id="colors-picker"
      tabIndex={-1}
      type="color"
      name="favcolor"
      defaultValue="#ff0000"
      onChange={(e) => {
        const value = e.target.value;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          scopeApply(getBodyScope(), (s: any) => {
            if (typeof s.filterWithColor === 'function' && typeof s.hexToRGB === 'function') {
              filterWithColor(hexToRGB(value));
            }
          });
        }, 200);
      }}
    />,
    host
  );
}

/** 圖片標注预览容器（index.html 417-432 逐字；内容由 AnnotationPreview（bundle 全局）驱动）。 */
export function AnnotationPreviewContainer() {
  const host = useHost('eagle-annotation-preview-host');
  const isDetailMode = useBodyState((s) => s.isDetailMode);
  const hasCurrentComment = useBodyState((s) => s.hasCurrentComment);
  if (!host || !isDetailMode) return null;
  return createPortal(
    <div id="annotation-preview-container">
      <div
        className="annotation-box"
        style={{ display: hasCurrentComment ? '' : 'none' }}
        {...({ placeholder: t('annotation.newAnnotationPlaceholder') } as any)}
        contentEditable="plaintext-only"
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      />
      <div className="annotation-arrow" />
      <input id="annotation-preview-container-input" type="text" style={{ width: 1, height: 1, pointerEvents: 'none', opacity: 0 }} />
    </div>,
    host
  );
}
