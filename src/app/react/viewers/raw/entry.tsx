/**
 * b1-9ag：raw-viewer 接管——raw-player.js（104 行 jQuery）逐字语义 React 化。
 * 缩略图 img 即时显示（file URL）+ dcraw 引擎抽取 RAW 内嵌 JPEG 延迟 100ms 绘入 canvas
 * （<480px 跳过）；方向/适配类同 exif。dcraw.js 为 vendored 引擎（壳内 classic script
 * 先行加载，window.dcraw 直用）；fs/os/app-root-path/my_modules/url 经 parent require
 * （iframe 继承 nodeIntegration，与原实现同通道）。window.parent.focus() 原样保留。
 *
 * M4-D：挂载期资源改由 `shared/engineLifecycle` 统一回收（原实现漏 revoke blob URL、
 * 内层 rAF 未取消）——绘制语句与算法逐字未改。
 */
import '../../core/shimsLegacy';
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { viewerParent } from '../shared/parentChannel';
import { useEngineLifecycle } from '../shared/engineLifecycle';

function toArrayBuffer(buf: any): ArrayBuffer {
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

function RawPlayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [show, setShow] = useState(false);
  const [spec, setSpec] = useState<{ thumbUrl: string; className: string; rawPath: string } | null>(null);

  // M4-D：挂载期取得的一切（两帧 rAF、dcraw 定时器、内嵌缩略图 object URL）登记到同一
  // 释放点；卸载后到达的回调就地放弃。
  useEngineLifecycle((lc) => {
    try { viewerParent().focus(); } catch (err) { /* parent focus 失败不阻塞 */ }
    const params = new URLSearchParams(window.location.search);
    const dirPath = params.get('path') ?? '';
    const ext = params.get('ext') ?? '';
    const rawName = params.get('name') ?? '';
    const rawPath = decodeURIComponent(dirPath) + rawName + '.' + ext;
    const thumbPath = decodeURIComponent(dirPath) + rawName + '_thumbnail.png';
    let thumbUrl = '';
    try {
      const parent = viewerParent();
      const appRoot = parent.require('app-root-path');
      const URL_MODULE = parent.require(appRoot + '/my_modules/url');
      thumbUrl = URL_MODULE.pathToFileURL(thumbPath).href;
    } catch (err) {
      thumbUrl = 'file://' + thumbPath.replace(/\\/g, '/');
    }
    const orientation = parseInt(params.get('orientation') ?? '', 10);
    const height = parseInt(params.get('height') ?? '', 10);
    const width = parseInt(params.get('width') ?? '', 10);
    const parts: string[] = [`r${orientation}`];
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
    setSpec({ thumbUrl, className: parts.join(' '), rawPath });
    // 原实现：src 赋值后同 tick addClass("show")——保持两帧让 CSS opacity 过渡生效。
    // 原实现只取消了外层 rAF，内层那一帧会在卸载后仍触发 setShow；此处两帧都登记。
    lc.raf(() => lc.raf(() => setShow(true)));

    // dcraw 内嵌缩略图抽取（原 setTimeout 100ms 逐字）
    lc.timeout(() => {
      try {
        const parent = viewerParent();
        const fs = parent.require('fs');
        const buf = fs.readFileSync(rawPath);
        if (lc.disposed) return;
        const jpegBuf = (window as any).dcraw(buf, { extractThumbnail: true });
        const arrayBuf = toArrayBuffer(jpegBuf);
        const blob = new Blob([arrayBuf], { type: 'image/jpg' });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          if (lc.disposed) return;
          if ((img as any).width < 480 || (img as any).height < 480) return;
          canvas.width = (img as any).width;
          canvas.height = (img as any).height;
          ctx && ctx.drawImage(img, 0, 0);
          canvas.classList.add('show');
        };
        // 原实现每个挂载周期漏一个 blob URL（从不 revoke）；改由释放点回收。
        img.src = lc.objectUrl(blob);
      } catch (err) {
        console.log(err);
      }
    }, 100);
  }, []);

  if (!spec) return null;
  return (
    <>
      <img id="main-image" src={spec.thumbUrl} className={(spec.className + (show ? ' show' : ''))} alt="" />
      <canvas id="canvas" className={spec.className} ref={canvasRef} />
    </>
  );
}

createRoot(document.getElementById('raw-root')!).render(<RawPlayer />);
