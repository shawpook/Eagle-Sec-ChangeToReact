import { useEffect, useMemo } from 'react'
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
  type: 'ready' | 'mode' | 'close'
  mode?: PreviewMode
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
  const initialAssetId = params.get('id') || ''
  const initialMode = (params.get('mode') === 'fullscreen' ? 'fullscreen' : 'workspace') as PreviewMode
  const initialVisibleAssetIds = useMemo(
    () => (params.get('ids') || '').split(',').map((id) => id.trim()).filter(Boolean),
    [params],
  )
  const initialLibraryPath = params.get('library') || 'eagle'

  const previewAssetId = useUIStore((s) => s.previewAssetId)
  const previewMode = useUIStore((s) => s.previewMode)
  const setLibraryPath = useLibraryStore((s) => s.setLibraryPath)

  // Hydrate the initial preview state once from URL parameters.
  useEffect(() => {
    setLibraryPath(initialLibraryPath)
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
  // request unmount when the viewer fully closes.
  useEffect(() => {
    if (previewMode === 'fullscreen') {
      postParent({ source: 'eagle-document-viewer', type: 'mode', mode: 'fullscreen' })
    } else if (previewMode === 'workspace') {
      postParent({ source: 'eagle-document-viewer', type: 'mode', mode: 'workspace' })
    }
    if (previewAssetId === null && previewMode === null) {
      postParent({ source: 'eagle-document-viewer', type: 'close' })
    }
  }, [previewAssetId, previewMode])

  const stageMode: PreviewMode = previewMode ?? initialMode

  return (
    <div className="h-screen w-screen overflow-hidden">
      {previewMode !== null && previewAssetId !== null ? (
        <AssetPreviewStage mode={stageMode} />
      ) : null}
    </div>
  )
}
