/**
 * M5-1（F17）：`/media-viewer/audio.html` 的 React 接管实现——URL 与查询契约不变
 * （`?path=`，值为同源可取的媒体地址），原 public 页的 66 行内联脚本逐字语义搬入模块图。
 *
 * 与旧实现的差异只有一处：波形绘制改在 `useEffect` 里对 ref 持有的 canvas 执行，
 * 绘制语句（fillRect / beginPath / moveTo / lineTo / stroke、颜色、step 计算）逐字未改，
 * 因此画布像素结果与迁移前一致。
 */
import { useEffect, useRef, useState } from 'react'

function readPathParam(): string | null {
  return new URLSearchParams(window.location.search).get('path')
}

export function AudioViewer() {
  const [src] = useState<string | null>(readPathParam)
  const [label, setLabel] = useState(src ? decodeURIComponent(src) : 'No file')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!src) return
    let cancelled = false
    fetch(src)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        const context = new AudioContext()
        return context.decodeAudioData(buffer)
      })
      .then((audioBuffer) => {
        if (cancelled) return
        const canvas = canvasRef.current
        if (!canvas) return
        const data = audioBuffer.getChannelData(0)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const width = canvas.width = canvas.clientWidth
        const height = canvas.height = canvas.clientHeight
        const step = Math.ceil(data.length / width)
        ctx.fillStyle = '#24282d'
        ctx.fillRect(0, 0, width, height)
        ctx.strokeStyle = '#3ecf8e'
        ctx.beginPath()
        for (let x = 0; x < width; x += 1) {
          let min = 1
          let max = -1
          for (let i = 0; i < step; i += 1) {
            const value = data[x * step + i] || 0
            if (value < min) min = value
            if (value > max) max = value
          }
          const y1 = height / 2 + min * height / 2
          const y2 = height / 2 + max * height / 2
          ctx.moveTo(x, y1)
          ctx.lineTo(x, y2)
        }
        ctx.stroke()
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLabel(`Waveform error: ${err instanceof Error ? err.message : String(err)}`)
      })
    return () => { cancelled = true }
  }, [src])

  return (
    <main>
      <h1>Audio Waveform</h1>
      <p className="muted" id="pathLabel">{label}</p>
      <audio id="player" controls src={src ?? undefined}></audio>
      <canvas id="waveform" ref={canvasRef}></canvas>
    </main>
  )
}
