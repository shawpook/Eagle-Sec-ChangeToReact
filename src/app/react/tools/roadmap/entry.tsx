/**
 * M5-1（F17）：`/roadmap.html` 的 React 入口（URL 不变）。
 *
 * 历史契约：本页在页面主世界暴露**裸标识符** `API`（`tests/roadmap-panels.mjs` 直接以
 * 标识符读取并与 `new URL(apiBase).origin` 比对）。module 作用域的 const 不会进入全局
 * 对象，因此必须显式挂到 `window` 上。
 */
import { createRoot } from 'react-dom/client'
import { API_BASE, Roadmap } from './Roadmap'

window.API = API_BASE

const container = document.getElementById('root')
if (!container) throw new Error('tools/roadmap：缺少 #root 挂载点')
createRoot(container).render(<Roadmap />)
