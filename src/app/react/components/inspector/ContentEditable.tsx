import React, { useEffect, useRef } from 'react';
import { $ } from '../detail/detailHooks';

/**
 * 阶段6：contenteditable 指令移植（bundle 15619-15834）+ editable-selectall
 * （70614-70639）。Angular 的 ngModel 视图/模型两侧等价转写：
 * - model → view：effect 中按 $render 规则写 innerHTML/textContent（允许 linkify）；
 *   焦点在元素上时跳过（对应 ngModel 视图→模型路径不触发 $render 的行为）。
 * - view → model：blur 时按规则清洗 HTML 并回调 onChange（等价 $setViewValue + ng-change）。
 */

function linkify(inputText: string): string {
  let replacedText: string;

  const replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
  replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

  const replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
  replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

  const replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
  replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

  return replacedText;
}

export interface ContentEditableProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  stripBr?: boolean;
  noLineBreaks?: boolean;
  allowLink?: boolean;
  selectall?: boolean;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  [key: string]: any;
}

export function ContentEditable({
  value,
  onChange,
  placeholder,
  stripBr,
  noLineBreaks,
  allowLink,
  selectall,
  className,
  id,
  style,
  onKeyDown,
  ...rest
}: ContentEditableProps) {
  const elRef = useRef<HTMLDivElement>(null);

  // model → view（$render）
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (document.activeElement === el) return; // 视图→模型路径不重渲染
    const html = value || '';
    if (new RegExp(/<\/?[b-z\d][^>]*>/gi).test(html)) {
      el.textContent = html;
    } else {
      let clean = html.replace(/<\S[^><]*>/g, '');
      if (allowLink) {
        clean = linkify(clean);
        el.innerHTML = clean;
      } else {
        el.textContent = clean;
      }
    }
  }, [value, allowLink]);

  // 事件绑定（keydown/blur/selectall）
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const cleanups: Array<() => void> = [];

    const onKeydown = (e: KeyboardEvent) => {
      onKeyDown?.(e as any);
      if (e.keyCode === 27) {
        e.stopPropagation();
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        document.execCommand('insertHTML', false, '<br><br>');
      }
      if (e.shiftKey && e.keyCode === 188) {
        e.preventDefault();
        e.stopPropagation();
        document.execCommand('insertHTML', false, '<');
      }
      if (e.shiftKey && e.keyCode === 190) {
        e.preventDefault();
        e.stopPropagation();
        document.execCommand('insertHTML', false, '>');
      }
    };
    el.addEventListener('keydown', onKeydown);
    cleanups.push(() => el.removeEventListener('keydown', onKeydown));

    const onBlur = () => {
      let html = el.innerHTML;
      const originalHTML = html;
      let rerender = false;
      if (stripBr) {
        html = html.replace(/<br>$/, '');
      }
      if (noLineBreaks) {
        const html2 = html.replace(/<div>/g, '').replace(/<br>/g, '').replace(/<\/div>/g, '').replace(/(\r\n|\n|\r)/g, '');
        if (html2 !== html) {
          rerender = true;
          html = html2;
        }
      }
      html = html.replace(/<div>/g, '').replace(/<\/div>/g, '');
      if (html && (html as any).replaceAll) {
        html = html.replaceAll('&amp;', '&');
      }
      onChange(html);
      if (originalHTML !== html) {
        // $render()：以清洗后的内容重渲染
        if (new RegExp(/<\/?[b-z\d][^>]*>/gi).test(html)) {
          el.textContent = html;
        } else {
          const clean = html.replace(/<\S[^><]*>/g, '');
          if (allowLink) el.innerHTML = linkify(clean);
          else el.textContent = clean;
        }
      }
      void rerender;
    };
    el.addEventListener('blur', onBlur);
    cleanups.push(() => el.removeEventListener('blur', onBlur));

    let trap: any;
    if (selectall) {
      const Mousetrap = (window as any).Mousetrap;
      if (Mousetrap) {
        trap = new Mousetrap(el);
        trap.bind('mod+a', (event: any) => {
          event && event.stopPropagation();
          window.setTimeout(function () {
            if (window.getSelection && document.createRange) {
              const range = document.createRange();
              range.selectNodeContents(el);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              if (sel && range) sel.addRange(range);
            }
          }, 1);
        });
        trap.bind('esc', (event: any) => {
          event && event.stopPropagation();
          el.blur();
        });
        cleanups.push(() => {
          try {
            trap.reset();
          } catch (err) {}
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, [stripBr, noLineBreaks, allowLink, selectall, onChange, onKeyDown]);

  return (
    <div
      ref={elRef}
      id={id}
      className={className}
      style={style}
      contentEditable={'plaintext-only' as any}
      data-placeholder={placeholder}
      {...rest}
    />
  );
}

void $;
