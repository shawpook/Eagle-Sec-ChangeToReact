/**
 * M5-1（F17）：`/media-viewer/audio.html` 的 React 入口（URL 不变）。
 * 本页是独立工具页，不参与主窗启动装配，因此不引 `core/shimsLegacy`。
 */
import { createRoot } from 'react-dom/client'
import { AudioViewer } from './AudioViewer'

const container = document.getElementById('root')
if (!container) throw new Error('media/audio：缺少 #root 挂载点')
createRoot(container).render(<AudioViewer />)
