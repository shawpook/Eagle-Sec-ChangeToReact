/**
 * b1-9ai：text-editor 接管——text-editor.js（381 行 Angular 控制器）+ wMousetrap 绑定 +
 * editable-selectall 指令 + 内联 throttle/debounce 全量 React 化。
 *
 * 键盘面：wMousetrap 绑定表（0-5 星标/f5·mod+r 刷新/left·right 切换/mod±·mod0·mod9 缩放/
 * mod+s 保存/mod+backspace·del 吞键）以原生 keydown 复刻（Mousetrap 单键对 contenteditable
 * 不静默——原生监听同语义；页面无原生 input 聚焦面）。selectall 指令（mod+a 全选/esc 失焦）
 * 并入 content keydown。
 *
 * 保存链：防抖 leading-edge（HTML 内联 debounce 逐字）→ 临时文件写入 → fs-extra moveSync
 * 原子覆盖 → 'update-txt-item' 通知（**主侧挂账**：main 无监听——原 background 承载随
 * b1-9t 删除，item 元数据 text 在本通道上悬空；electron-info/electron-log 同族）。
 * 原实现 save 错误路径引用裸 ipcRenderer（iframe 内 ReferenceError 潜伏 bug）——此处经
 * window.parent.ipcRenderer 修正。
 * changeName（模板内 UI 已注释、全仓零调用方）为死代码不移植。
 */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

// HTML 内联 debounce 逐字（func, wait, immediate）
function debounce(func: any, wait: number, immediate?: boolean) {
  let timeout: any;
  return function (this: any) {
    const context = this;
    const args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// HTML 内联 throttle 逐字（fn, delay, immediate, debounce）——滚轮缩放用
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

function TextEditor() {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const stateRef = useRef<any>({
    isLoaded: false,
    title: '',
    lastStat: undefined as any,
    isDirty: false,
    originText: '',
    txtPath: '',
    id: undefined as any,
    retryCount: 3,
  });

  // ── 保存（text-editor.js 281-340 逐字；防抖 leading-edge）──
  const saveRef = useRef<any>(null);
  useEffect(() => {
    const s = stateRef.current;
    const saveImpl = function (this: any, callback: any) {
      const parent = window.parent as any;
      const fs = parent.require('fs');
      const el = contentRef.current;
      const text = el ? (el.textContent || '') : '';
      if (text === '') {
        return;
      }
      s.isDirty = text !== s.originText;
      if (s.isDirty) {
        console.log('开始保存');
        const tempDir = s.txtPath + '.' + Date.now();
        const tempWStream = fs.createWriteStream(tempDir, { flags: 'w' });

        tempWStream.write(text);

        tempWStream.on('error', function (err: any) {
          parent.ipcRenderer.send('electron-info', '[app] An error has occurred save text file');
          parent.ipcRenderer.send('electron-log', '' + err.stack || err);
          parent.require('@electron/remote').dialog.showMessageBox({
            type: 'error',
            cancelId: 1,
            buttons: ['OK'],
            message: err.stack || err,
          });
          if (fs.existsSync(tempDir)) {
            parent.require('fs-extra').removeSync(tempDir);
          }
        });

        tempWStream.on('finish', function () {
          console.log('保存完成');

          const fse = parent.require('fs-extra');
          fse.moveSync(tempDir, s.txtPath, { overwrite: true });
          if (fs.existsSync(tempDir)) {
            fse.removeSync(tempDir);
          }

          s.originText = text;
          s.lastStat = fs.statSync(s.txtPath);
          parent.require('electron').ipcRenderer.send('update-txt-item', {
            id: s.id,
            text: text.substr(0, 1024 * 32),
          });
          s.isDirty = false;
          if (callback) {
            callback();
          }
        });
        tempWStream.end();
      } else {
        if (callback) {
          callback();
        }
      }
    };
    saveRef.current = debounce(saveImpl, 300, true);
  }, []);

  const callSave = (callback?: any) => saveRef.current && saveRef.current(callback);

  // ── 刷新（text-editor.js 113-171 逐字语义）──
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    const s = stateRef.current;
    refreshRef.current = function () {
      if (!window.parent) {
        return;
      }
      const parent = window.parent as any;
      const fs = parent.require('fs');
      setIsLoaded(false);
      s.isLoaded = false;
      const path = parent.require('path');
      const title = path.basename(s.txtPath, '.txt');
      if (!fs.existsSync(s.txtPath)) {
        setTimeout(() => {
          s.retryCount--;
          if (s.retryCount > 0) {
            refreshRef.current();
          }
        }, 400);
        console.error('file not exists');
        return;
      }
      s.retryCount = 3;
      fs.readFile(s.txtPath, 'utf8', (err: any, text: string) => {
        if (err) {
          console.error(err);
        } else {
          const el = contentRef.current;
          const content = el ? (el.textContent || '') : '';
          if (content !== '' && text === '') return;

          s.title = title;
          s.newTitle = title;
          s.originText = text;
          if (el) {
            el.textContent = text;
          }
          s.lastStat = fs.statSync(s.txtPath);
          s.isLoaded = true;
          s.isDirty = false;
          setIsLoaded(true);
        }
      });
    };
  }, []);

  // ── 初始化（参数解析 + txtPath + 首次 refresh + focus 对账）──
  useEffect(() => {
    const parent = window.parent as any;
    const s = stateRef.current;
    try { window.focus(); } catch (err) { /* window.focus 失败不阻塞 */ }

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

    const id = urlParams.id;
    s.id = id;
    const theme = urlParams.theme;
    const language = urlParams.language || 'en';
    document.body.className = `${theme} ${language}`;

    const $parentScope = parent.$bodyScope;
    const txtPath = $parentScope.imagesDir + $parentScope.current.id + '.info/' + $parentScope.current.name + '.' + $parentScope.current.ext;

    s.txtPath = decodeURIComponent(txtPath);
    console.log(s.txtPath);

    refreshRef.current();

    var isCheckingForUpdate = false;
    function checkForUpdate() {
      if (isCheckingForUpdate) return;
      isCheckingForUpdate = true;
      const fs = parent.require('fs');
      if (fs.existsSync(s.txtPath)) {
        const stat = fs.statSync(s.txtPath);
        if (stat.mtimeMs !== s.lastStat.mtimeMs) {
          console.log('发现修改，重新载入');
          isCheckingForUpdate = false;
          refreshRef.current();
        } else {
          console.log('没有修改，无须更动');
          isCheckingForUpdate = false;
        }
      }
    }

    const onFocus = function () {
      if (s.lastStat) {
        checkForUpdate();
      }
    };
    window.addEventListener('focus', onFocus);

    // a[target=_blank] 外开（text-editor.js 3-9 逐字）
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

    // ctrl/cmd+滚轮缩放（text-editor.js 213-234 逐字；吞默认行为 + throttle 200 immediate）
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

    return () => {
      window.removeEventListener('focus', onFocus);
      document.body.removeEventListener('click', onBodyClick);
      document.body.removeEventListener('wheel', zoomByWheel as any);
      document.body.removeEventListener('wheel', swallowZoom);
    };
  }, []);

  // ── 缩放（text-editor.js 236-258 逐字；preview-size input 状态化为 React state）──
  const [previewSize, setPreviewSize] = useState(62.5);
  const previewSizeRef = useRef(62.5);
  const applyZoom = (next: number) => {
    setPreviewSize(next);
    previewSizeRef.current = next;
    document.documentElement.style.fontSize = `${next}%`;
  };
  const zoomRef = useRef<any>((dir: 'in' | 'out' | 'fit') => {});
  useEffect(() => {
    document.documentElement.style.fontSize = '62.5%';
    zoomRef.current = function (dir: 'in' | 'out' | 'fit') {
      if (dir === 'fit') {
        applyZoom(62.5);
        return;
      }
      let size = previewSizeRef.current;
      size += (62.5 / 2) * (dir === 'in' ? 1 : -1);
      size = dir === 'in' ? Math.min(625, size) : Math.max(31.25, size);
      applyZoom(size);
    };
  }, []);

  // ── 星标/切换直通 parent（text-editor.js 73-111 逐字；$eavlAsync 原始拼写为原 bug，经
  //    $evalAsync 修正语义——原行 `$parentScope.$eavlAsync()` 是静默 no-op）──
  const parentCall = (fn: string) => {
    const p = (window.parent as any).$bodyScope;
    if (p && typeof p[fn] === 'function') p[fn]();
  };

  // ── 键盘（wMousetrap 绑定表 + preventEnter + selectall 指令）──
  const preventEnter = (event: any) => {
    if (event.shiftKey && event.keyCode === 13) {
      event.stopPropagation();
      event.preventDefault();
    } else if (event.keyCode === 27) {
      event.preventDefault();
      const el = contentRef.current;
      if (el) el.blur();
    } else if (event.keyCode === 9) {
      document.execCommand('insertHTML', false, '&#009');
      event.preventDefault();
    } else if (event.keyCode === 83 && (event.metaKey || event.ctrlKey)) {
      callSave();
    }
  };

  const selectAllContent = () => {
    window.setTimeout(function () {
      const el = contentRef.current;
      if (!el) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 1);
  };

  useEffect(() => {
    const onKeyDown = function (event: any) {
      const mod = event.metaKey || event.ctrlKey;
      switch (true) {
        case event.key === '0': parentCall('removeStar'); break;
        case event.key === '1': parentCall('changeTo1Star'); break;
        case event.key === '2': parentCall('changeTo2Star'); break;
        case event.key === '3': parentCall('changeTo3Star'); break;
        case event.key === '4': parentCall('changeTo4Star'); break;
        case event.key === '5': parentCall('changeTo5Star'); break;
        case event.key === 'F5':
          event.preventDefault();
          refreshRef.current();
          break;
        case mod && (event.key === 'r' || event.key === 'R'):
          event.preventDefault();
          refreshRef.current();
          break;
        case event.key === 'ArrowLeft': parentCall('selectPrev'); break;
        case event.key === 'ArrowRight': parentCall('selectNext'); break;
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
        case mod && (event.key === 's' || event.key === 'S'):
          event.preventDefault();
          callSave();
          break;
        case mod && event.key === 'Backspace':
        case event.key === 'Delete':
          event.preventDefault();
          event.stopPropagation();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const autoSaveRef = useRef<any>(null);
  useEffect(() => {
    // autoSave（text-editor.js 276-279 逐字；防抖 trailing 500ms）
    autoSaveRef.current = debounce(function () {
      stateRef.current.isDirty = true;
      callSave();
    }, 500);
  }, []);
  const callAutoSave = () => autoSaveRef.current && autoSaveRef.current();

  // escHandler（text-editor.js 105-111；wMousetrap 绑定表中已注释停用——保留语义备查）
  // const escHandler = (event) => { event && event.preventDefault(); callSave(() => { parentCall('escHandler'); }); };

  return (
    <>
      <div className="page-wrap" style={{ display: isLoaded ? undefined : 'none' }}>
        <div className="page">
          <div
            id="content"
            ref={contentRef}
            contentEditable={'plaintext-only' as any}
            onInput={() => { callAutoSave(); }}
            onBlur={() => { callSave(); }}
            onKeyDown={(e) => {
              const ev: any = e;
              // selectall 指令（mod+a 全选 / esc 失焦）
              if ((ev.metaKey || ev.ctrlKey) && ev.key === 'a') {
                ev.stopPropagation();
                selectAllContent();
                return;
              }
              if (ev.key === 'Escape') {
                ev.stopPropagation();
                const el = contentRef.current;
                if (el) el.blur();
                return;
              }
              preventEnter(ev);
              callAutoSave();
            }}
          />
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById('text-editor-root')!).render(<TextEditor />);
