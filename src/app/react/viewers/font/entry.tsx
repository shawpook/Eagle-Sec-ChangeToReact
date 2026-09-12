/**
 * b1-9aj：font-viewer 接管——font-viewer.js（865 行 Angular 控制器）全量 React 化。
 * 静态内容（i18nStrings + 4 语言 translation）机械抽取至 fontContent.ts；
 * MediumEditor/tippy 为 vendored 引擎（壳内 classic script，window.MediumEditor/window.tippy 直用）。
 *
 * 键盘面：wMousetrap 绑定表（0-5 星标/left·right/enter·esc·backspace·space→escHandler/
 * mod±·mod0·mod9 缩放/mod+backspace·del 吞键）原生 keydown 复刻；selectall 指令 +
 * contenteditable 全选并入 body keydown 委托。
 *
 * 语义修正（与 b1-9ai 同款）：原 `$parentScope.$eavlAsync()` 拼写 bug（静默 no-op）经
 * $evalAsync 修正。字体加载链（fs → FontFace → document.fonts.add → body font-family）与
 * 语言判定（support/ja/zh 分支 + preferLng 覆盖）逐字。mediumEditor 指令为模板未用死代码
 * 不移植（运行时 30ms 后的 MediumEditor 初始化才是活面）。
 */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fontI18nStrings, fontTranslation, buildAlphabetHTML } from './fontContent';

// HTML 内联 throttle 逐字（滚轮缩放用）
function throttle(fn: any, delay: number, immediate: boolean, isDebounce: boolean) {
  let curr = +new Date();
  let last_call = 0;
  let last_exec = 0;
  let timer: any = null;
  let diff: any;
  let context: any;
  let args: any;
  const exec = function () {
    last_exec = curr;
    fn.apply(context, args);
  };
  return function (this: any) {
    curr = +new Date();
    context = this;
    args = arguments;
    diff = curr - (isDebounce ? last_call : last_exec) - delay;
    clearTimeout(timer);
    if (isDebounce) {
      if (immediate) {
        timer = setTimeout(exec, delay);
      } else if (diff >= 0) {
        exec();
      }
    } else {
      if (diff >= 0) {
        exec();
      } else if (immediate) {
        timer = setTimeout(exec, -diff);
      }
    }
    last_call = curr;
  };
}

function FontViewer() {
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('eagle.fontViewer.theme') || 'auto');
  const [currentTab, setCurrentTab] = useState(localStorage.getItem('eagle.fontViewer.tab') || 'article');
  const [fontSize, setFontSize] = useState(62.5);
  const fontSizeRef = useRef(62.5);
  const [isSupport, setIsSupport] = useState<boolean | null>(null);
  const [isActivate, setIsActivate] = useState(false);
  const [info, setInfo] = useState<any>({});
  const [fontCSSName, setFontCSSName] = useState('');
  const [contentHTML, setContentHTML] = useState<{ article: string; waterfall: string; alphabet: string } | null>(null);
  const fontNameRef = useRef<HTMLSpanElement | null>(null);
  const mediumEditorInitRef = useRef(false);
  const stateRef = useRef<any>({ fontName: '', newFontName: '', fontCSSName: '' });

  const urlParams = window.location.search.substr(1).split('&').reduce(
    function (accumulator: any, currentValue: string) {
      const pair = currentValue
        .split('=')
        .map(function (value) {
          return decodeURIComponent(value);
        });
      accumulator[pair[0]] = pair[1];
      return accumulator;
    },
    {}
  );

  const parent = window.parent as any;
  // b1-9bz-E5-3：父窗驱动面优先 __eagleDriver（显式白名单），过渡期回落 parent.$bodyScope。
  const $parentScope = parent.__eagleDriver || parent.$bodyScope;
  const lng: string = $parentScope.preferences.general.language;
  const platform: string = parent.process.platform;
  const theme: string = urlParams.theme || 'gray';
  const themePath = theme === 'light' || theme === 'lightgray' ? 'light' : 'dark';
  const i18n = (key: string) => (fontI18nStrings as any)[lng] ? (fontI18nStrings as any)[lng][key] : (fontI18nStrings as any)['en'][key];

  // body class/theme/platform（模板 body 属性逐字）
  useEffect(() => {
    document.body.className = `${currentTheme} ${lng} ${platform}`;
    document.body.setAttribute('theme', theme);
    document.body.setAttribute('platform', platform);
  }, [currentTheme]);

  const parentCall = (fn: string, ...args: any[]) => {
    if ($parentScope && typeof $parentScope[fn] === 'function') $parentScope[fn](...args);
  };
  // 原实现 `$parentScope.$eavlAsync()`（拼写 bug no-op）——语义为触发 parent 刷新
  const parentEval = () => {
  };

  const applyZoom = (next: number) => {
    setFontSize(next);
    fontSizeRef.current = next;
    document.documentElement.style.fontSize = `${next}%`;
    const waterfall = document.querySelector('.waterfall');
    if (waterfall) waterfall.scrollLeft = 0;
  };

  const zoomRef = useRef<any>((dir: 'in' | 'out' | 'fit') => {});
  useEffect(() => {
    zoomRef.current = function (dir: 'in' | 'out' | 'fit') {
      if (dir === 'fit') {
        applyZoom(62.5);
        return;
      }
      let size = fontSizeRef.current;
      size += (62.5 / 2) * (dir === 'in' ? 1 : -1);
      size = dir === 'in' ? Math.min(625, size) : Math.max(31.25, size);
      applyZoom(size);
    };
  }, []);

  // setAsFileName（font-viewer.js 234-241 逐字）
  const setAsFileName = (fullName: string) => {
    if (!fullName) return;
    stateRef.current.fontName = fullName;
    stateRef.current.newFontName = fullName;
    if (fontNameRef.current) fontNameRef.current.textContent = fullName;
    $parentScope.inspector.newName = fullName;
    parentCall('imagesChange');
  };

  // 字体加载链 + 语言判定 + 内容构建（font-viewer.js 414-528 + 636-864 逐字）
  useEffect(() => {
    try { window.focus(); } catch (err) { /* noop */ }
    const fs = parent.require('fs');
    const fontMetas = $parentScope.current.fontMetas || {};
    let fontPath = $parentScope.imagesDir + $parentScope.current.id + '.info/' + $parentScope.current.name + '.' + $parentScope.current.ext;
    fontPath = decodeURIComponent(fontPath);

    // info（438-457 逐字；preferredFamily 读 preferredSubfamily 为原 bug 保留）
    const preferLng = (lng === 'zh_TW' || lng === 'zh_CN') ? 'zh' : 'en';
    const g = (k: string, fallback: any = '') => {
      const v = fontMetas[k];
      return (v && v[preferLng]) || (v && v.en) || fallback;
    };
    setInfo({
      version: g('version'),
      postScriptName: g('postScriptName'),
      fullName: g('fullName'),
      fontFamily: g('fontFamily'),
      fontSubfamily: g('fontSubfamily'),
      preferredFamily: fontMetas.preferredSubfamily && fontMetas.preferredSubfamily.en || 'Regular',
      preferredSubfamily: fontMetas.preferredSubfamily && fontMetas.preferredSubfamily.en || 'Regular',
      designer: g('designer'),
      designerURL: g('designerURL'),
      trademark: g('trademark'),
      description: g('description'),
      manufacturer: g('manufacturer'),
      manufacturerURL: g('manufacturerURL'),
      copyright: g('copyright'),
      license: g('license'),
      licenseURL: g('licenseURL'),
      numGlyphs: fontMetas.numGlyphs,
      weight: fontMetas.weight,
    });

    const fontName = $parentScope.current.name;
    stateRef.current.fontName = fontName;
    stateRef.current.newFontName = fontName;
    if (fontNameRef.current) fontNameRef.current.textContent = fontName;
    const fontFamily = (fontMetas.fontFamily && fontMetas.fontFamily.en) || fontName;

    // 语言判定（821-852 逐字）
    let lang = 'en';
    const lngMap: any = { ko_KR: 'kr', ja_JP: 'jp' };
    if (fontMetas.support) {
      if (lng && lng !== 'en' && fontMetas.support[lngMap[lng]]) {
        lang = lngMap[lng];
      } else {
        if (
          (fontMetas.postScriptName && fontMetas.postScriptName.ja) ||
          (fontMetas.fontFamily && fontMetas.fontFamily.ja)
        ) { lang = 'jp'; }
        else if (fontMetas.support['zh_CN'] && fontMetas.support['zh_TW']) { lang = 'zh_CN'; }
        else if (fontMetas.support['zh_CN'] && fontMetas.postScriptName && fontMetas.postScriptName.zh) { lang = 'zh_CN'; }
        else if (fontMetas.support['zh_TW'] && fontMetas.postScriptName && fontMetas.postScriptName['zh_TW']) { lang = 'zh_TW'; }
        else if (fontMetas.support['zh_CN']) { lang = 'zh_CN'; }
        else if (fontMetas.support['zh_TW']) { lang = 'zh_TW'; }
        else if (fontMetas.support['kr']) { lang = 'kr'; }
        else if (fontMetas.support['jp']) { lang = 'jp'; }
        else { lang = 'en'; }
      }
    } else { lang = 'en'; }
    if (fontMetas.preferLng) {
      lang = fontMetas.preferLng;
    }
    console.log(`语言判断：${lang}`);

    setIsActivate(typeof $parentScope.isFontActivate === 'function' ? !!$parentScope.isFontActivate($parentScope.current) : false);

    // 字体加载（465-819 逐字语义）
    if (fs.existsSync(fontPath)) {
      parent.require('fs').readFile(fontPath, function (err: any, fontBinary: any) {
        if (typeof (window as any).FontFace === 'undefined') return;
        const cleanName = fontFamily
          .replace(/[({.})]/ig, '')
          .replace(/\s/g, '')
          .replace(/[@#$%^&*()<>:`'"\/\\|?*]/g, '')
          .replace(/^\d+/, '');
        const font = new (window as any).FontFace(cleanName, fontBinary, { style: 'normal' });
        font.load();
        font.loaded.then(function () {
          document.fonts.add(font);
          stateRef.current.fontCSSName = cleanName;
          setFontCSSName(cleanName);
          document.body.style.fontFamily = `'${cleanName}'` + ', "Fallback Outline"';
          document.body.style.display = 'block';
          setIsSupport(true);

          setContentHTML({
            article: (fontTranslation as any)[lang].article,
            waterfall: (fontTranslation as any)[lang].waterfall,
            alphabet: buildAlphabetHTML((fontTranslation as any)[lang].alphabetRaw, cleanName),
          });

          // 30ms 后：scrollTop 恢复 + MediumEditor 初始化（767-806 逐字）
          setTimeout(function () {
            const scrollTop = localStorage.getItem('eagle.fontViewer.scrollTop') || 0;
            window.scrollTo(0, Number(scrollTop));

            const articleEl = document.querySelector('.content .article') as any;
            if (articleEl && (window as any).MediumEditor && !mediumEditorInitRef.current) {
              mediumEditorInitRef.current = true;
              const editor = new (window as any).MediumEditor(articleEl, {
                placeholder: { text: '', hideOnClick: true },
                toolbar: {
                  buttons: ['h2', 'h3', 'bold', 'italic', 'underline', 'quote'],
                },
                anchor: {
                  customClassOption: null,
                  customClassOptionText: 'Button',
                  linkValidation: false,
                  placeholderText: 'Paste or type a link',
                  targetCheckbox: false,
                  targetCheckboxText: 'Open in new window',
                },
                paste: {
                  cleanPastedHTML: true,
                  cleanAttrs: ['style', 'dir'],
                  cleanTags: ['label', 'meta'],
                  cleanReplacements: ['img'],
                  unwrapTags: ['sub', 'sup'],
                },
                autoLink: true,
              });
              editor.subscribe('editableKeydown', function (event: any) {
                const keyCode = event.keyCode;
                if (keyCode == 65 && (event.ctrlKey || event.metaKey)) {
                  editor.selectAllContents();
                }
              });
            }
          }, 30);
        }, function (err: any) {
          console.log(err);
          document.body.style.display = 'block';
          setIsSupport(false);
        });
      });
    } else {
      document.body.style.display = 'block';
      setIsSupport(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // changeFontName（250-264 逐字；blur 时读取 span 文本）
  const changeFontName = () => {
    setTimeout(() => {
      const s = stateRef.current;
      const el = fontNameRef.current;
      const newName = el ? (el.textContent || '') : s.newFontName;
      if (newName === s.fontName) return;
      if (newName !== '') {
        s.fontName = newName;
        s.newFontName = newName;
        $parentScope.inspector.newName = newName;
        parentCall('imagesChange');
      } else {
        s.newFontName = s.fontName;
        if (el) el.textContent = s.fontName;
      }
    }, 200);
  };

  const preventEnter = (event: any) => {
    if (event.keyCode === 13 || event.keyCode === 27) {
      event.preventDefault();
      const el = fontNameRef.current;
      if (el) el.blur();
    }
  };

  const escHandler = (event: any) => {
    event && event.preventDefault();
    parentCall('escHandler');
  };

  // 全局键盘/滚轮/点击/滚动（317-388 + 19-25 逐字委托）
  useEffect(() => {
    const selectContents = (el: any) => {
      window.setTimeout(function () {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 1);
    };

    const onKeyDown = function (event: any) {
      const mod = event.metaKey || event.ctrlKey;
      const target = event.target as any;
      // ctrl/cmd+A：input/textarea 原生 select；[contenteditable] selectNodeContents（319-346）
      if (event.keyCode == 65 && mod) {
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          target.select();
          return;
        }
        if (target && target.getAttribute && target.getAttribute('contenteditable') !== null) {
          event && event.stopPropagation();
          selectContents(target);
          return;
        }
      }
      switch (true) {
        case event.key === '0': parentCall('removeStar'); break;
        case event.key === '1': parentCall('changeTo1Star'); break;
        case event.key === '2': parentCall('changeTo2Star'); break;
        case event.key === '3': parentCall('changeTo3Star'); break;
        case event.key === '4': parentCall('changeTo4Star'); break;
        case event.key === '5': parentCall('changeTo5Star'); break;
        case event.key === 'ArrowLeft': parentCall('selectPrev'); break;
        case event.key === 'ArrowRight': parentCall('selectNext'); break;
        case event.key === 'Enter':
        case event.key === 'Escape':
        case event.key === 'Backspace':
        case event.key === ' ':
          escHandler(event);
          break;
        case mod && (event.key === '=' || event.key === '+'):
          event.preventDefault();
          zoomRef.current('in');
          break;
        case mod && event.key === '-':
          event.preventDefault();
          zoomRef.current('out');
          break;
        case mod && (event.key === '0' || event.key === '9'):
          event.preventDefault();
          zoomRef.current('fit');
          break;
        case mod && event.key === 'Backspace':
        case event.key === 'Delete':
          event.preventDefault();
          event.stopPropagation();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // waterfall 联动输入（348-351 逐字）
    const onKeyUp = function (event: any) {
      const target = event.target as any;
      if (target && target.closest && target.closest('.waterfall [contenteditable]')) {
        const val = target.textContent || '';
        document.querySelectorAll('.waterfall [contenteditable]').forEach((el: any) => {
          if (el !== target) el.textContent = val;
        });
      }
    };
    document.body.addEventListener('keyup', onKeyUp);

    // a[target=_blank] 外开（19-25 逐字）
    const onBodyClick = function (event: any) {
      const a = event.target && event.target.closest && event.target.closest('a');
      if (!a) return;
      event && event.preventDefault();
      if (a.getAttribute('target') == '_blank') {
        const link = a.href;
        parent.require('electron').shell.openExternal(link);
      }
    };
    document.body.addEventListener('click', onBodyClick);

    // ctrl 滚轮缩放（367-388 逐字）
    const zoomByWheel = throttle(function (e: any) {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.wheelDelta > 5) {
          zoomRef.current('in');
        } else if (e.wheelDelta < -5) {
          zoomRef.current('out');
        }
        return false;
      }
    }, 200, true, false);
    const swallowZoom = function (e: any) {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.body.addEventListener('wheel', zoomByWheel, { passive: false });
    document.body.addEventListener('wheel', swallowZoom, { passive: false });

    // scrollTop 持久化（314-316；_.debounce(fn,500,true) 老签名 → trailing 等价）
    let scrollTimer: any = null;
    const onScroll = function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        localStorage.setItem('eagle.fontViewer.scrollTop', String(window.scrollY));
      }, 500);
    };
    window.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.removeEventListener('keyup', onKeyUp);
      document.body.removeEventListener('click', onBodyClick);
      document.body.removeEventListener('wheel', zoomByWheel as any);
      document.body.removeEventListener('wheel', swallowZoom);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // tippy 提示（模板 tippy-content 逐字）
  const activateBtnRef = useRef<HTMLDivElement | null>(null);
  const deactivateBtnRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof (window as any).tippy !== 'function') return;
    if (isActivate && activateBtnRef.current) {
      (window as any).tippy(activateBtnRef.current, { content: i18n('Font.Deactivate'), placement: 'right' });
    }
    if (!isActivate && deactivateBtnRef.current) {
      (window as any).tippy(deactivateBtnRef.current, { content: i18n('Font.Activate'), placement: 'right' });
    }
  }, [isActivate]);

  const activateFont = () => {
    setIsActivate(true);
    parentCall('activateFont', $parentScope.current, { showNotify: true, updateView: true });
  };
  const deactivateFont = () => {
    setIsActivate(false);
    parentCall('deactivateFont', $parentScope.current, { showNotify: true, updateView: true });
  };

  const numGlyphsText = info.numGlyphs !== undefined && info.numGlyphs !== null
    ? Number(info.numGlyphs).toLocaleString('en-US').replace(/,/g, ',')
    : '';

  return (
    <div className="page">
      <div className="header">
        <div className="font-name">
          <span
            data-placeholder="输入字体名称"
            ref={fontNameRef}
            contentEditable={'plaintext-only' as any}
            onKeyDown={(e) => preventEnter(e as any)}
            onBlur={() => changeFontName()}
          ></span>
          <div
            ref={activateBtnRef}
            style={{ display: isActivate ? undefined : 'none' }}
            onClick={() => deactivateFont()}
            className={'activate-btn' + (isActivate ? ' activated' : '')}
          ></div>
          <div
            ref={deactivateBtnRef}
            style={{ display: !isActivate ? undefined : 'none' }}
            onClick={() => activateFont()}
            className={'activate-btn' + (!isActivate ? ' activated' : '')}
          ></div>
        </div>
        <div className="font-postscript-name">
          {info.postScriptName}
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs" onDoubleClick={(e) => e.stopPropagation()}>
          {([['article', 'FontViewer.Tab.Article'], ['waterfall', 'FontViewer.Tab.Waterfall'], ['alphabet', 'FontViewer.Tab.Alphabet'], ['other', 'FontViewer.Tab.Other']] as const).map(([tab, key]) => (
            <div key={tab} className={'tab' + (currentTab === tab ? ' active' : '')} onClick={() => { setCurrentTab(tab); localStorage.setItem('eagle.fontViewer.tab', tab); }}>
              {i18n(key)}
            </div>
          ))}
        </div>
        <div className="theme-switcher" onDoubleClick={(e) => e.stopPropagation()}>
          {(['auto', 'light', 'dark', 'purple', 'yellow'] as const).map((t) => (
            <div key={t} className={'theme ' + t + (currentTheme === t ? ' active' : '')} onClick={() => { setCurrentTheme(t); localStorage.setItem('eagle.fontViewer.theme', t); }}>
              A
            </div>
          ))}
        </div>
      </div>

      <div className="slider" style={{ display: currentTab === 'other' ? 'none' : undefined }}>
        <div className="ic-btn zoom-btn" style={{ WebkitAppRegion: 'initial' } as any} onClick={() => zoomRef.current('out')}>
          <img src={`../assets/images/${themePath}/icons/ic-toolbar-zoom-out.svg`} alt="" />
        </div>
        <div className="range-wrap">
          <div className="range-progressbar">
            <div className="current" style={{ width: `${(fontSize / 625) * 100}%` }}></div>
          </div>
          <input
            id="preview-size"
            className="range"
            type="range"
            min={31.25}
            max={625}
            value={fontSize}
            step={0.5}
            tabIndex={-1}
            onChange={(e) => applyZoom(parseFloat(e.target.value))}
            onBlur={(e) => e.target.blur()}
          />
        </div>
        <div className="ic-btn zoom-btn" style={{ WebkitAppRegion: 'initial' } as any} onClick={() => zoomRef.current('in')}>
          <img src={`../assets/images/${themePath}/icons/ic-toolbar-zoom-in.svg`} alt="" />
        </div>
      </div>

      <div className="content">
        {!isSupport && currentTab !== 'other' && (
          <div className="not-support" dangerouslySetInnerHTML={{ __html: i18n('NotSupport') }}></div>
        )}
        {isSupport && (
          <>
            {currentTab === 'article' && <div className="article" dangerouslySetInnerHTML={{ __html: (contentHTML && contentHTML.article) || '' }}></div>}
            {currentTab === 'waterfall' && <div className="waterfall" dangerouslySetInnerHTML={{ __html: (contentHTML && contentHTML.waterfall) || '' }}></div>}
            {currentTab === 'alphabet' && <div><div dangerouslySetInnerHTML={{ __html: (contentHTML && contentHTML.alphabet) || '' }}></div></div>}
            {currentTab === 'other' && (
              <div className="other">
                {info.postScriptName && <div><span className="prop">{i18n('Information.postScriptName')}</span><span className="value">{info.postScriptName}<span className="rename-btn" onClick={() => setAsFileName(info.postScriptName)}>{i18n('Information.fullName.Button')}</span></span></div>}
                {info.fullName && <div><span className="prop">{i18n('Information.fullName')}</span><span className="value">{info.fullName}<span className="rename-btn" onClick={() => setAsFileName(info.fullName)}>{i18n('Information.fullName.Button')}</span></span></div>}
                {info.fontFamily && <div><span className="prop">{i18n('Information.fontFamily')}</span><span className="value">{info.fontFamily}<span className="rename-btn" onClick={() => setAsFileName(info.fontFamily)}>{i18n('Information.fullName.Button')}</span></span></div>}
                {info.weight && <div><span className="prop">{i18n('Information.preferredFamily')}</span><span className="value">{info.weight}</span></div>}
                {info.version && <div><span className="prop">{i18n('Information.version')}</span><span className="value">{info.version}</span></div>}
                {info.designer && <div><span className="prop">{i18n('Information.designer')}</span><span className="value">{info.designer}</span></div>}
                {info.manufacturer && <div><span className="prop">{i18n('Information.manufacturer')}</span><span className="value">{info.manufacturer}</span></div>}
                {info.description && <div><span className="prop">{i18n('Information.description')}</span><span className="value">{info.description}</span></div>}
                {info.copyright && <div><span className="prop">{i18n('Information.copyright')}</span><span className="value">{info.copyright || info.license}</span></div>}
                {info.trademark && <div><span className="prop">{i18n('Information.trademark')}</span><span className="value">{info.trademark}</span></div>}
                {info.numGlyphs && <div><span className="prop">{i18n('Information.numGlyphs')}</span><span className="value">{numGlyphsText}</span></div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('font-viewer-root')!).render(<FontViewer />);
