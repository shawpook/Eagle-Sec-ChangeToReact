/**
 * b1-9ah：gif-viewer 接管——index.html 内联粘合层（~80 行 jQuery）逐字语义 React 化。
 * SuperGif（gif-player.js，1143 行）为 vendored 引擎保留壳内 classic script；
 * 粘合层职责：URL 参数（path/render）→ file URL + body render-* 类 → 双 img 喂引擎
 * → gifPlayer.load 完成/进度回调转投 parent.$bodyScope.gifViewer.onFinished/onProgress
 * （主窗 tagManagerDomain / 预览窗 preview-window controller 两侧已供）+ 载入中途
 * 打开时的进度位置模拟（startTime 差值 → move_to）+ 150ms 后 body.loaded。
 *
 * M4-D：SuperGif 实例、body 上的 render-* 与 loaded 类、150ms 定时器、父窗回调统一由
 * `shared/engineLifecycle` 登记回收——载入进度算法与帧定位算法逐字未改。
 */
import '../../core/shimsLegacy';
import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { driverScope, viewerParent } from '../shared/parentChannel';
import { useEngineLifecycle } from '../shared/engineLifecycle';

/** SuperGif 引擎实例面（gif-player.js:1005-1089 返回对象的实际成员，此处只取用到的）。 */
interface SuperGifInstance {
  load(onLoad: () => void, onProgress: (progress: number, length: number) => void): void;
  get_frames(): Array<{ delay?: number }>;
  get_playing(): boolean;
  move_to(index: number): void;
  get_canvas(): HTMLCanvasElement | null | undefined;
}

/** SuperGif 构造器（vendored classic script 注入 window）。 */
interface SuperGifCtor {
  new (options: { gif: HTMLImageElement }): SuperGifInstance;
}

function GifPlayer() {
  const insRef = useRef<HTMLImageElement | null>(null);
  const fakeRef = useRef<HTMLImageElement | null>(null);

  useEngineLifecycle((lc) => {
    try { viewerParent().focus(); } catch (err) { /* parent focus 失败不阻塞 */ }
    const urlParams = window.location.search.substr(1).split('&').reduce(function (accumulator: any, currentValue: string) {
      const pair = currentValue
        .split('=')
        .map(function (value) {
          return decodeURIComponent(value);
        });

      accumulator[pair[0]] = pair[1];

      return accumulator;
    }, {});

    const parent = viewerParent();
    const appRoot = parent.require('app-root-path');
    const URL_MODULE = parent.require(appRoot + '/my_modules/url');
    const gifPath = urlParams.path;
    const render = urlParams.render;
    const gifUrl = URL_MODULE.pathToFileURL(gifPath).href;

    const renderClass = `render-${render}`;
    document.body.classList.add(renderClass);
    // 原实现只加不减：同一文档反复挂载会让 render-* 类累积，且上一次的 render-* 会
    // 与这一次同时生效。改由释放点对账回退。
    lc.onDispose(() => { document.body.classList.remove(renderClass); });
    const ins = insRef.current;
    const fake = fakeRef.current;
    if (!ins || !fake) return;
    ins.setAttribute('src', gifUrl);
    ins.setAttribute('rel:animated_src', gifPath);
    fake.setAttribute('src', gifUrl);

    const SuperGif = (window as unknown as { SuperGif: SuperGifCtor }).SuperGif;
    const gifPlayer = new SuperGif({ gif: ins });

    // SuperGif 的导出面（gif-player.js:1005-1089）没有 destroy/unload，无从「销毁引擎」；
    // 但它的 init()（:941-967）把 <img> 换成了自建的 div.jsgif——引擎对 DOM 的副作用就
    // 只有这一处，卸载时摘掉它即可把 DOM 恢复原状（这是本引擎可断言的那一部分）。
    lc.own(gifPlayer, (player) => {
      const canvas = player.get_canvas();
      const host = canvas ? canvas.parentNode : null;
      if (host && host.parentNode) host.parentNode.removeChild(host);
    });

    console.time('gifPlayer.load');
    // b1-9bz-E5-3：父窗驱动面优先 __eagleDriver，过渡期回落 parent.$bodyScope。
    const parentScope = driverScope();
    let startTime: number | undefined;

    gifPlayer.load(function () {
      if (lc.disposed) return;
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
      lc.timeout(function () {
        document.body.classList.add('loaded');
        lc.onDispose(function () { document.body.classList.remove('loaded'); });
      }, 150);

      parentScope.gifViewer.onFinished({
        frames: frames,
        playing: originalState,
        gifPlayer: gifPlayer,
      });
    }, function (progress: any, length: any) {
      if (lc.disposed) return;
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
