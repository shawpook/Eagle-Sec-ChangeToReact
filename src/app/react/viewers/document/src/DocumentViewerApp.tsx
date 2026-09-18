import { useEffect, useMemo, useRef } from 'react'
import { useUIStore } from './stores/ui-store'
import { useLibraryStore } from './stores/library-store'
import AssetPreviewStage from './components/AssetPreviewStage'
import type { PreviewMode } from './shared/types'

/**
 * Isolated document workspace entry. The Eagle AngularJS shell mounts this
 * page as an iframe/overlay, passing the item id, initial preview mode and the
 * visible asset order. The viewer notifies the shell (via postMessage) when the
 * preview mode changes so the shell can resize the overlay between the
 * workspace and fullscreen semantics of OrcaBox `AppLayout.tsx:369-417`.
 */

interface ParentMessage {
  source: 'eagle-document-viewer'
  type: 'ready' | 'mode' | 'close' | 'state'
  mode?: PreviewMode
  state?: unknown
}

/** F-DOC-2：宿主（Eagle 主窗）下发的指令消息。 */
interface HostCommandMessage {
  source: 'eagle-document-host'
  type: 'command'
  command: { type: string; value?: unknown }
}

/**
 * F-DOC-2：宿主顶栏的指令注册表。
 *
 * 用 `Set` 广播而非单一槽位：Stage 层（上下篇/收藏/全屏/关闭）与 Surface 层（字体/配色/
 * 编辑模式）各自注册handler，两层都挂载时**必须都能收到**——单一 `window.__eagleXxx`
 * 槽位会被后挂载的 Surface 覆盖掉 Stage 的处理器。
 */
type DocumentCommandHandler = (command: { type: string; value?: unknown }) => void
const commandHandlers = new Set<DocumentCommandHandler>()

/** 注册一个指令处理器，返回注销函数。 */
export function registerDocumentCommandHandler(handler: DocumentCommandHandler): () => void {
  commandHandlers.add(handler)
  return () => { commandHandlers.delete(handler) }
}

/** 把一条宿主指令广播给所有已注册的处理器。 */
function dispatchDocumentCommand(command: { type: string; value?: unknown }): void {
  commandHandlers.forEach((handler) => {
    try {
      handler(command)
    } catch (err) {
      console.error('[document-viewer] command handler failed', err)
    }
  })
}

/**
 * F-DOC-2：把查看器的 header 状态上报给宿主。
 * 用 rAF 节流 + JSON 去重：stage/surface 两层的 effect 会在同一帧里各报一次，
 * 合并成一次 postMessage，避免宿主侧重复渲染。
 */
let pendingState: Record<string, unknown> | null = null
let stateFrame = 0
let lastStateJson = ''

export function postViewerState(state: Record<string, unknown>): void {
  pendingState = { ...(pendingState || {}), ...state }
  if (stateFrame) return
  stateFrame = requestAnimationFrame(() => {
    stateFrame = 0
    const payload = pendingState
    pendingState = null
    if (!payload) return
    const json = JSON.stringify(payload)
    if (json === lastStateJson) return
    lastStateJson = json
    postParent({ source: 'eagle-document-viewer', type: 'state', state: payload })
  })
}

function postParent(message: ParentMessage) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*')
    }
  } catch {
    // Ignore postMessage failures (sandboxed preview page).
  }
}

export default function DocumentViewerApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const initialEagleTheme = params.get('theme') || 'dark'
  const initialAssetId = params.get('id') || ''
  const initialMode = (params.get('mode') === 'fullscreen' ? 'fullscreen' : 'workspace') as PreviewMode
  const initialVisibleAssetIds = useMemo(
    () => (params.get('ids') || '').split(',').map((id) => id.trim()).filter(Boolean),
    [params],
  )
  const initialLibraryPath = params.get('library') || 'eagle'
  // `chrome=external` is set by the Eagle shell shim: the shell injects its own
  // Eagle-native `.toolbar` and drives the viewer over postMessage, so the
  // viewer hides its generic stage actions and reports state back instead.
  const externalChrome = params.get('chrome') === 'external'

  // Eagle's original shell exposes the active theme on `body[theme=...]`.
  // Mirror it into the viewer so the document workspace can use the same
  // dark/light family without coupling to OrcaBox's default palette.
  const mappedEagleTheme: 'light' | 'dark' = ['light', 'lightgray'].includes(initialEagleTheme) ? 'light' : 'dark'
  document.documentElement.dataset.eagleTheme = initialEagleTheme
  document.documentElement.dataset.theme = mappedEagleTheme

  const previewAssetId = useUIStore((s) => s.previewAssetId)
  const previewMode = useUIStore((s) => s.previewMode)
  const setLibraryPath = useLibraryStore((s) => s.setLibraryPath)

  // Hydrate the initial preview state once from URL parameters.
  useEffect(() => {
    setLibraryPath(initialLibraryPath)
    useUIStore.getState().setExternalChrome(externalChrome)
    useUIStore.getState().setTheme(mappedEagleTheme)
    useUIStore.getState().setVisibleAssetIds(initialVisibleAssetIds)
    useUIStore.getState().openPreview(
      initialAssetId,
      initialMode,
      initialMode === 'fullscreen' ? 'workspace' : null,
    )
    // Handshake with the AngularJS shell so it knows the viewer mounted.
    postParent({ source: 'eagle-document-viewer', type: 'ready' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the AngularJS shell in sync with the workspace/fullscreen mode and
  // request unmount when the viewer fully closes. The close message is only
  // sent on a real open→closed transition (never on the initial mount, which
  // would make the shell tear the viewer down before it hydrates).
  const previousPreviewRef = useRef<{ id: string | null; mode: PreviewMode | null }>({ id: null, mode: null })

  useEffect(() => {
    const previous = previousPreviewRef.current
    previousPreviewRef.current = { id: previewAssetId, mode: previewMode }

    const isClosed = previewAssetId === null && previewMode === null
    const wasOpen = previous.id !== null || previous.mode !== null
    if (isClosed && wasOpen) {
      postParent({ source: 'eagle-document-viewer', type: 'close' })
      return
    }
    if (previewMode === 'fullscreen') {
      postParent({ source: 'eagle-document-viewer', type: 'mode', mode: 'fullscreen' })
    } else if (previewMode === 'workspace') {
      postParent({ source: 'eagle-document-viewer', type: 'mode', mode: 'workspace' })
    }
  }, [previewAssetId, previewMode])

  const stageMode: PreviewMode = previewMode ?? initialMode

  // F-DOC-2：接收宿主顶栏下发的指令并广播给已注册的处理器（Stage / Surface）。
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as HostCommandMessage | undefined
      if (!data || data.source !== 'eagle-document-host' || data.type !== 'command') return
      if (!data.command || typeof data.command.type !== 'string') return
      dispatchDocumentCommand(data.command)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden">
      {previewMode !== null && previewAssetId !== null ? (
        <AssetPreviewStage mode={stageMode} />
      ) : null}
    </div>
  )
}
