/**
 * M5-1（F17）：`/media-viewer/video.html` 的 React 接管实现——URL 与查询契约不变
 * （`?path=`，值为同源可取的媒体地址），原 public 页的 28 行内联脚本逐字语义搬入模块图。
 *
 * `muted` 在 props 中先于 `src` 出现，保持「先静音、后设源」的顺序，自动播放策略不变。
 */
function readPathParam(): string | null {
  return new URLSearchParams(window.location.search).get('path')
}

export function VideoViewer() {
  const src = readPathParam()

  return (
    <main>
      <h1>Video Preview</h1>
      <p className="muted" id="pathLabel">{src ? decodeURIComponent(src) : 'No file'}</p>
      <video id="player" controls autoPlay muted src={src ?? undefined}></video>
    </main>
  )
}
