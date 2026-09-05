/**
 * b1-9ag：native-viewer 接管——index.html 内联脚本（170 行）逐字语义 React 化。
 * 特殊格式（psd/psb/ai/ppt…）原生高分辨率预览生成面：darwin 走 qlmanage 或
 * nativeImage.createThumbnailFromPath invoke，win32 走 'generate-hight-resolution-thumbnail'
 * send + 缓存轮询（img error → 1s 退避 cache-buster 重试；load → ready 隐 loader）。
 * 缓存于 parent.global.EAGLE_THUMBNAIL_TEMP_PATH/preview（nodeIntegration 下
 * window.global === window，与原实现同通道）；超 10 个缓存整目录清理。
 * **主侧已落地（b1-9at，台账⑦收口）**：win32 'generate-hight-resolution-thumbnail' →
 * main → backend /api/item/nativePreview（ai→pdf.js worker / ppt 族→soffice→worker /
 * psd 族无引擎 UNSUPPORTED）成功落 finalFile 轮询自取，失败回发 native-preview-failed
 * 停轮询 + ready 优雅降级；darwin invoke 经 shim 直通 → main nativeImage 原生缩图。
 */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const MAX_DIMENSION = 120000000;

function NativeViewer() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const errorTimeoutRef = useRef<any>(null);
  // b1-9at：主侧引擎明确失败（native-preview-failed）→ 停轮询 + ready（原版不支持
  // 扩展早退同 UX；否则 img error → 1s cache-buster 无限空转）
  const failedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [spec, setSpec] = useState<{ src: string; opacity?: number } | null>(null);

  // polling（原逐字语义）：error → 隐 + 1s 后 cache-buster 重试；load → 显 + ready
  function handleImageError() {
    if (failedRef.current) return;
    const el = imgRef.current;
    if (!el) return;
    setSpec((prev) => (prev ? { ...prev, opacity: 0 } : prev));
    const src = el.getAttribute('src') || '';
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(function () {
      console.log('文件不存在，继续轮询');
      setSpec((prev) => (prev ? { ...prev, src: src + '?d=' + Date.now() } : prev));
    }, 1000);
  }

  function handleImageLoad() {
    setSpec((prev) => (prev ? { ...prev, opacity: 1 } : prev));
    setReady(true);
    console.log('文件已存在，停止轮询');
  }

  useEffect(() => {
    const parent = window.parent as any;
    const urlParams = window.location.search.substr(1).split('&').reduce(function (accumulator: any, currentValue: string) {
      const pair = currentValue
        .split('=')
        .map(function (value) {
          return decodeURIComponent(value);
        });

      accumulator[pair[0]] = pair[1];

      return accumulator;
    }, {});

    const isAppleSilicon = parent.process.platform === 'darwin' && parent.process.arch === 'arm64';
    // b1-9at：失败回程监听用（win32 分支内另有同源局部 const，逐字保留）
    const ipcRendererRef = parent.ipcRenderer;
    const p = urlParams.path;
    const fileName = urlParams.name;
    const filePath = decodeURIComponent(p) + fileName;
    const id = urlParams.id;
    const ext = urlParams.ext;
    const height = parseInt(urlParams.height);
    const width = parseInt(urlParams.width);
    let size = Math.max(height, width) || 8192;

    const path = parent.require('path');
    const fs = parent.require('fs');
    const spawn = parent.require('child_process').spawn;
    const tempFolder = `${parent.global.EAGLE_THUMBNAIL_TEMP_PATH}/preview`;
    const finalPath = path.normalize(tempFolder + '/' + id + '.png');
    const previewLink = finalPath.replace(/#/g, '%23');

    function removeDirAllFiles(dir: string) {
      if (!dir) return;
      fs.readdir(dir, function (err: any, files: string[]) {
        if (err) return;
        files.forEach(function (file) {
          fs.unlink(path.join(dir, file), function (err2: any) { });
        });
      });
    }

    function polling(src: string, _ducation: number) {
      setSpec({ src });
    }

    function showCached() {
      setSpec({ src: previewLink });
      setTimeout(function () { setReady(true); }, 300);
    }

    if (parent.process.platform === 'darwin') {
      const timer = setTimeout(function () { initDarwin(); }, 500);

      function initDarwin() {
        const tempPath = path.normalize(tempFolder + '/' + decodeURIComponent(fileName) + '.png');

        if (height * width > MAX_DIMENSION) { setReady(true); return; }
        if (Math.min(width, height) < 600) { setReady(true); return; }

        if ('psd psdt psb ai exr hdr graffle mindnode ppt pptx doc docx xls xlsx numbers key pages dwg'.indexOf(ext) === -1) {
          setReady(true);
          return;
        }

        // 如果预览图时间 < 当前文件时间，就移除缓存
        try {
          const rawStat = fs.statSync(filePath);
          const finalStat = fs.statSync(finalPath);
          if (rawStat.mtimeMs > finalStat.mtimeMs) {
            fs.unlinkSync(finalPath);
            console.log('预览图过旧，重新制作');
          }
        } catch (err) {
          console.log(err);
        }

        if (!fs.existsSync(finalPath)) {
          if (!fs.existsSync(tempFolder)) {
            fs.mkdirSync(tempFolder);
          }

          // 避免太多缓存，超过一定量时，进行清理
          const tempFiles = fs.readdirSync(tempFolder);
          if (tempFiles.length >= 10) {
            removeDirAllFiles(tempFolder);
          }

          if ('sketch psd psb ai exr hdr graffle mindnode ppt pptx doc docx xls xlsx numbers key pages'.indexOf(ext) > -1) {
            if ('sketch exr hdr graffle mindnode ppt pptx doc docx xls xlsx numbers key pages'.indexOf(ext) > -1) {
              if (size <= 600) { setReady(true); return; }
              size = Math.max(size, 2048);
            } else {
              if (size <= 640) { setReady(true); return; }
            }

            if (isAppleSilicon) {
              const ipcRenderer = parent.ipcRenderer;
              const tempFilePath = `${tempFolder}/${path.basename(filePath)}.png`;
              ipcRenderer.invoke('nativeImage.createThumbnailFromPath', {
                tempFilePath: tempFilePath,
                filePath: filePath,
                size: size,
                maxHeight: Math.max(size, 10000),
              }).then(function (result: any) {
                console.log(result);
                if (fs.existsSync(tempPath)) {
                  fs.renameSync(tempPath, finalPath);
                  polling(previewLink, 1000);
                }
              });
            } else {
              const params: any[] = ['-t', '-s', size, '-x', '-F1'];
              params.push(path.resolve(filePath));
              params.push('-o');
              params.push(tempFolder);

              // 避免卡死，如果一个文件超过 30 秒仍无法处理，就触发 Timeout
              const task = spawn('qlmanage', params, { timeout: 20000 });
              task.on('close', function () {
                if (fs.existsSync(tempPath)) {
                  fs.renameSync(tempPath, finalPath);
                  polling(previewLink, 1000);
                }
              });
            }
          }
        } else {
          showCached();
        }
      }

      return () => clearTimeout(timer);
    }

    const timer = setTimeout(function () { initWin32(); }, 500);

    function initWin32() {
      const tempPath = path.normalize(tempFolder + '/' + decodeURIComponent(fileName) + '.png.tmp');

      if (Math.min(width, height) < 480) { setReady(true); return; }

      if (height * width > MAX_DIMENSION) {
        if (height > width) {
          size = parseInt(String(width * (MAX_DIMENSION / (height * width))));
        } else {
          size = parseInt(String(height * (MAX_DIMENSION / (height * width))));
        }
      }
      console.log('size > ' + size);

      if ('psd psb ai ppt pptx potx'.indexOf(ext) === -1) {
        setReady(true);
        return;
      }

      if (size <= 640) {
        setReady(true);
        return;
      }

      // 如果预览图时间 < 当前文件时间，就移除缓存
      try {
        const rawStat = fs.statSync(filePath);
        const finalStat = fs.statSync(finalPath);
        if (rawStat.mtimeMs > finalStat.mtimeMs) {
          fs.unlinkSync(finalPath);
          console.log('预览图过旧，重新制作');
        }
      } catch (err) {
        console.log(err);
      }

      if (!fs.existsSync(finalPath)) {
        if (!fs.existsSync(tempFolder)) {
          fs.mkdirSync(tempFolder);
        }

        // 避免太多缓存，超过一定量时，进行清理
        const tempFiles = fs.readdirSync(tempFolder);
        if (tempFiles.length >= 10) {
          removeDirAllFiles(tempFolder);
        }

        // 将制作预览图需求传给后台进行处理
        const ipcRenderer = parent.ipcRenderer;
        ipcRenderer.send('generate-hight-resolution-thumbnail', {
          filePath: path.normalize(filePath),
          tempFile: tempPath,
          finalFile: finalPath,
          size: size,
          ext: ext,
        });

        // 不断轮询是否完成
        polling(previewLink, 1000);
      } else {
        showCached();
      }
    }

    // b1-9at：主侧引擎失败回程（shim 总线两参签名——桥 emit 前置 {} 事件参）
    const failedHandler = (_e: any, params: any) => {
      if (params && params.ext !== ext) return;
      failedRef.current = true;
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      console.log('预览制作失败，停止轮询');
      setReady(true);
    };
    if (ipcRendererRef && typeof ipcRendererRef.on === 'function') {
      ipcRendererRef.on('native-preview-failed', failedHandler);
    }

    return () => {
      clearTimeout(timer);
      if (ipcRendererRef && typeof ipcRendererRef.off === 'function') {
        ipcRendererRef.off('native-preview-failed', failedHandler);
      }
    };
  }, []);

  // ready 类挂 body（原 body.ready CSS 由壳承载，隐 #loader）
  useEffect(() => {
    if (ready) document.body.classList.add('ready');
  }, [ready]);

  if (!spec) {
    return null;
  }
  return (
    <>
      <img
        id="preview"
        alt=""
        ref={imgRef}
        src={spec.src}
        style={{ opacity: spec.opacity ?? 1 }}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
      <div id="loader" className="loader">
        <svg className="spinner" width="12px" height="12px" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
          <circle className="path" fill="none" strokeWidth="3" strokeLinecap="round" cx="33" cy="33" r="30"></circle>
        </svg>
      </div>
    </>
  );
}

createRoot(document.getElementById('native-root')!).render(<NativeViewer />);
