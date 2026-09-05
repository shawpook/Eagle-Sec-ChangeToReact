/**
 * b1-9ah：gif-viewer 接管——index.html 内联粘合层（~80 行 jQuery）逐字语义 React 化。
 * SuperGif（gif-player.js，1143 行）为 vendored 引擎保留壳内 classic script；
 * 粘合层职责：URL 参数（path/render）→ file URL + body render-* 类 → 双 img 喂引擎
 * → gifPlayer.load 完成/进度回调转投 parent.$bodyScope.gifViewer.onFinished/onProgress
 * （主窗 tagManagerDomain / 预览窗 preview-window controller 两侧已供）+ 载入中途
 * 打开时的进度位置模拟（startTime 差值 → move_to）+ 150ms 后 body.loaded。
 */
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

function GifPlayer() {
  const insRef = useRef<HTMLImageElement | null>(null);
  const fakeRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    try { (window.parent as any).focus(); } catch (err) { /* parent focus 失败不阻塞 */ }
    const urlParams = window.location.search.substr(1).split('&').reduce(function (accumulator: any, currentValue: string) {
      const pair = currentValue
        .split('=')
        .map(function (value) {
          return decodeURIComponent(value);
        });

      accumulator[pair[0]] = pair[1];

      return accumulator;
    }, {});

    const parent = window.parent as any;
    const appRoot = parent.require('app-root-path');
    const URL_MODULE = parent.require(appRoot + '/my_modules/url');
    const gifPath = urlParams.path;
    const render = urlParams.render;
    const gifUrl = URL_MODULE.pathToFileURL(gifPath).href;

    document.body.classList.add(`render-${render}`);
    const ins = insRef.current;
    const fake = fakeRef.current;
    if (!ins || !fake) return;
    ins.setAttribute('src', gifUrl);
    ins.setAttribute('rel:animated_src', gifPath);
    fake.setAttribute('src', gifUrl);

    const gifPlayer = new (window as any).SuperGif({ gif: ins });

    console.time('gifPlayer.load');
    const parentScope = parent.$bodyScope;
    let startTime: number | undefined;

    gifPlayer.load(function () {
      console.timeEnd('gifPlayer.load');

      const frames = gifPlayer.get_frames();
      const originalState = gifPlayer.get_playing();

      // 如果 gif 载入完毕但尚未播放完成，模拟当前的进度位置
      const t = Date.now() - (startTime || Date.now());
      let idx = 0;
      let sum = 0;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (f.delay) {
          sum += f.delay * 10;
        }
        if (sum >= t) {
          idx = i;
          break;
        }
      }
      gifPlayer.move_to(idx);
      setTimeout(function () {
        document.body.classList.add('loaded');
      }, 150);

      parentScope.gifViewer.onFinished({
        frames: frames,
        playing: originalState,
        gifPlayer: gifPlayer,
      });
    }, function (progress: any, length: any) {
      if (!startTime) {
        startTime = Date.now();
      }
      parentScope.gifViewer.onProgress(progress, length);
    });
  }, []);

  return (
    <>
      <img id="gif-player-ins" ref={insRef} alt="" />
      <img id="gif-player-fake" ref={fakeRef} alt="" />
    </>
  );
}

createRoot(document.getElementById('gif-root')!).render(<GifPlayer />);
