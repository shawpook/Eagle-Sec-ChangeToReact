import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useAsset, useUpdateAsset } from '../hooks/use-assets'
import { useUIStore } from '../stores/ui-store'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'
import AssetPreviewSurface from './AssetPreviewSurface'
import { ChevronLeft, ChevronRight, Copy, ExternalLink, FolderOpen, Maximize2, Minimize2, Star, X } from 'lucide-react'
import type { PreviewMode } from '../shared/types'

interface AssetPreviewStageProps {
  mode: PreviewMode
  className?: string
}

interface StageToast {
  tone: 'success' | 'error'
  title: string
  message?: string
}

export default function AssetPreviewStage({ mode, className }: AssetPreviewStageProps) {
  const { t } = useI18n()
  const shouldReduceMotion = useReducedMotion()
  const previewAssetId = useUIStore((s) => s.previewAssetId)
  const previewMode = useUIStore((s) => s.previewMode)
  const previewReturnMode = useUIStore((s) => s.previewReturnMode)
  const openPreview = useUIStore((s) => s.openPreview)
  const setPreviewMode = useUIStore((s) => s.setPreviewMode)
  const closePreview = useUIStore((s) => s.closePreview)
  const forceClosePreview = useUIStore((s) => s.forceClosePreview)
  const selectAsset = useUIStore((s) => s.selectAsset)
  const visibleAssetIds = useUIStore((s) => s.visibleAssetIds)
  const externalChrome = useUIStore((s) => s.externalChrome)
  const { data: asset, isFetched: assetFetched } = useAsset(previewAssetId)
  const updateAsset = useUpdateAsset()
  const isActive = previewAssetId !== null && previewMode === mode

  const [toast, setToast] = useState<StageToast | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((next: StageToast) => {
    setToast(next)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (isActive && previewAssetId && assetFetched && !asset) {
      forceClosePreview()
      selectAsset(null)
    }
  }, [asset, assetFetched, forceClosePreview, isActive, previewAssetId, selectAsset])

  const currentIndex = previewAssetId ? visibleAssetIds.indexOf(previewAssetId) : -1
  const prevAssetId = currentIndex > 0 ? visibleAssetIds[currentIndex - 1] : null
  const nextAssetId = currentIndex >= 0 && currentIndex < visibleAssetIds.length - 1
    ? visibleAssetIds[currentIndex + 1]
    : null

  const dismissPreview = useCallback(() => {
    forceClosePreview()
  }, [forceClosePreview])

  const closeStagePreview = useCallback(() => {
    if (mode === 'fullscreen') {
      dismissPreview()
      return
    }
    closePreview()
  }, [closePreview, dismissPreview, mode])

  const openDetailPlayback = useCallback(() => {
    if (mode === 'fullscreen') {
      setPreviewMode('workspace', null)
      return
    }
    setPreviewMode('fullscreen', 'workspace')
  }, [mode, setPreviewMode])

  const navigatePreview = useCallback((assetId: string | null) => {
    if (!assetId) return
    selectAsset(assetId)
    openPreview(assetId, mode, previewReturnMode)
  }, [mode, openPreview, previewReturnMode, selectAsset])

  // Document-appropriate keyboard shortcuts: Esc close/return, ←/→ navigate,
  // F favorite, Space toggles workspace/fullscreen. Typing surfaces own keys.
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      )) {
        return
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          closeStagePreview()
          break
        case 'ArrowLeft':
          if (!prevAssetId) break
          event.preventDefault()
          navigatePreview(prevAssetId)
          break
        case 'ArrowRight':
          if (!nextAssetId) break
          event.preventDefault()
          navigatePreview(nextAssetId)
          break
        case 'f':
        case 'F':
          if (!asset) break
          event.preventDefault()
          updateAsset.mutate({ id: asset.id, input: { favorite: !asset.favorite } })
          break
        case ' ':
          event.preventDefault()
          openDetailPlayback()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [asset, closeStagePreview, isActive, navigatePreview, nextAssetId, openDetailPlayback, prevAssetId, updateAsset])

  if (!isActive) {
    return null
  }

  // Unified stage chrome: the outer window-style toolbar is gone. The page
  // indicator and the stage action buttons are injected into the document
  // surface's own header (right of the in-surface controls) through
  // AssetPreviewSurface, so the preview keeps a single toolbar.
  const pageIndicator = currentIndex >= 0
    ? `${currentIndex + 1} / ${visibleAssetIds.length}`
    : null

  const stageActions = (
    <div data-preview-stage-actions className="flex shrink-0 items-center gap-1">
      <StageButton title={t('上一个素材', 'Previous asset')} onClick={() => navigatePreview(prevAssetId)} disabled={!prevAssetId}>
        <ChevronLeft className="h-4 w-4" />
      </StageButton>
      <StageButton title={t('下一个素材', 'Next asset')} onClick={() => navigatePreview(nextAssetId)} disabled={!nextAssetId}>
        <ChevronRight className="h-4 w-4" />
      </StageButton>
      <StageButton
        title={asset?.favorite ? t('取消收藏', 'Remove favorite') : t('收藏', 'Favorite')}
        onClick={() => {
          if (!asset) return
          updateAsset.mutate({ id: asset.id, input: { favorite: !asset.favorite } })
        }}
        disabled={!asset}
      >
        <Star className={cn('h-4 w-4', asset?.favorite && 'fill-yellow-400 text-yellow-400')} />
      </StageButton>
      <StageButton
        title={t('在系统中显示', 'Reveal in Finder')}
        onClick={async () => {
          if (!asset) return
          const ok = await api.asset.reveal(asset.id)
          showToast({
            tone: ok ? 'success' : 'error',
            title: ok ? t('已在系统中显示', 'Revealed in Finder') : t('显示失败', 'Reveal failed'),
            message: ok ? asset.name : t('Eagle 无法显示该文件。', 'Eagle could not reveal this file.'),
          })
        }}
        disabled={!asset}
      >
        <FolderOpen className="h-4 w-4" />
      </StageButton>
      <StageButton
        title={t('复制文件路径', 'Copy file path')}
        onClick={async () => {
          if (!asset) return
          const ok = await api.asset.copyPath(asset.id)
          showToast({
            tone: ok ? 'success' : 'error',
            title: ok ? t('路径已复制', 'Path copied') : t('复制失败', 'Copy failed'),
            message: ok ? asset.filePath ?? asset.name : t('Eagle 无法复制该文件的路径。', 'Eagle could not copy the path for this file.'),
          })
        }}
        disabled={!asset}
      >
        <Copy className="h-4 w-4" />
      </StageButton>
      <StageButton
        title={t('打开原文件', 'Open original file')}
        onClick={() => {
          if (!asset) return
          void api.asset.open(asset.id)
        }}
        disabled={!asset}
      >
        <ExternalLink className="h-4 w-4" />
      </StageButton>
      {mode === 'workspace' ? (
        <StageButton title={t('占满整个软件预览', 'Open full-app preview')} onClick={() => setPreviewMode('fullscreen', 'workspace')}>
          <Maximize2 className="h-4 w-4" />
        </StageButton>
      ) : (
        <StageButton title={t('返回中间预览', 'Return to centered preview')} onClick={() => setPreviewMode('workspace', null)}>
          <Minimize2 className="h-4 w-4" />
        </StageButton>
      )}
      <StageButton title={t('关闭预览', 'Close preview')} onClick={closeStagePreview}>
        <X className="h-4 w-4" />
      </StageButton>
    </div>
  )

  // Keep this iframe free of -webkit-app-region styles: Electron does not
  // reliably drag windows from subframes, and no-drag inside the iframe can
  // disable the outer Eagle toolbar's drag region on Windows.
  return (
    <div
      data-preview-stage
      className={cn('relative flex h-full min-h-0 flex-col bg-[color:var(--preview-stage-bg)] overflow-hidden', className)}
    >
      {toast ? (
        <div className="pointer-events-none absolute bottom-14 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-xs shadow-lg"
          style={{
            borderColor: toast.tone === 'error' ? 'rgba(248,113,113,0.4)' : 'rgba(34,197,94,0.4)',
            background: toast.tone === 'error' ? 'rgba(127,29,29,0.92)' : 'rgba(20,83,45,0.92)',
            color: '#f8fafc',
          }}
        >
          <div className="font-medium">{toast.title}</div>
          {toast.message ? <div className="mt-0.5 text-[11px] opacity-85">{toast.message}</div> : null}
        </div>
      ) : null}

      <div className={cn('relative min-h-0 flex-1 bg-[image:var(--preview-stage-content-bg)]', mode === 'fullscreen' ? 'p-0' : 'p-1.5')}>
        <AnimatePresence mode="wait" initial={false}>
          {asset ? (
            <motion.div
              key={asset.id}
              className={cn(
                'h-full',
                'overflow-hidden',
                mode === 'fullscreen'
                  ? 'border-0 bg-transparent shadow-none rounded-none'
                  : 'rounded-md border border-[color:var(--preview-stage-card-border)] bg-[color:var(--preview-stage-card-bg)] shadow-[var(--preview-stage-card-shadow)]',
              )}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.992 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.996 }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, mass: 0.84 }}
              style={{ willChange: shouldReduceMotion ? 'auto' : 'transform, opacity' }}
            >
              <AssetPreviewSurface
                asset={asset}
                previewMode={mode}
                documentPresentation="auto"
                onPreviousAsset={prevAssetId ? () => navigatePreview(prevAssetId) : null}
                onNextAsset={nextAssetId ? () => navigatePreview(nextAssetId) : null}
                hasPreviousAsset={Boolean(prevAssetId)}
                hasNextAsset={Boolean(nextAssetId)}
                pageIndicator={externalChrome ? null : pageIndicator}
                stageActions={externalChrome ? null : stageActions}
              />
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              className="flex h-full items-center justify-center text-sm text-muted-foreground"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14, ease: 'easeOut' }}
            >
              {t('正在加载预览…', 'Loading preview…')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StageButton({
  children,
  onClick,
  title,
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'ui-lift inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--document-border)] bg-[color:var(--document-shell-bg)] text-[color:var(--document-muted)] backdrop-blur-md transition hover:border-primary/30 hover:bg-primary/10 hover:text-[color:var(--document-heading)] disabled:cursor-not-allowed disabled:opacity-35',
      )}
    >
      {children}
    </button>
  )
}
