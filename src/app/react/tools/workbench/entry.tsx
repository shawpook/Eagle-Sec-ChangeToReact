/**
 * M5-1（F17）：`/workbench.html` 的 React 入口（URL 不变）。
 * 本页是独立工具页，不参与主窗启动装配，因此不引 `core/shimsLegacy`。
 */
import { createRoot } from 'react-dom/client'
import { Workbench } from './Workbench'

const container = document.getElementById('root')
if (!container) throw new Error('tools/workbench：缺少 #root 挂载点')
createRoot(container).render(<Workbench />)
