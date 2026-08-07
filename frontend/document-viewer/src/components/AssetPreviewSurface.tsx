import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import type { Asset, PreviewMode } from '../shared/types'
import { AlertTriangle, FileX2 } from 'lucide-react'
import TextDocumentSurface from './TextDocumentSurface'
import OfficeDocumentSurface from './OfficeDocumentSurface'
import { usePreviewDocumentSource } from '../hooks/use-preview'
import {
  isTextEditableDocumentExtension,
} from '../shared/asset-formats'

interface AssetPreviewSurfaceProps {
  asset: Asset
  className?: string
  previewMode?: PreviewMode | null
  documentPresentation?: 'auto' | 'preview' | 'editor' | 'compact'
  onPreviousAsset?: (() => void) | null
  onNextAsset?: (() => void) | null
  hasPreviousAsset?: boolean
  hasNextAsset?: boolean
}

/**
 * Document dispatch surface migrated from OrcaBox `AssetPreviewSurface`.
 * Only the text, Office and PDF/document branches are kept; media, image,
 * 3D, font, Lottie, archive and project branches are intentionally excluded
 * from this migration and continue through Eagle's original preview chain.
 */
export default function AssetPreviewSurface({
  asset,
  className,
  previewMode = null,
  documentPresentation = 'auto',
  onPreviousAsset = null,
  onNextAsset = null,
  hasPreviousAsset = false,
  hasNextAsset = false,
}: AssetPreviewSurfaceProps) {
  if (asset.status === 'missing') {
    return (
      <div className={cn('flex h-full min-h-0 items-center justify-center bg-secondary/60 text-destructive', className)}>
        <div className="flex flex-col items-center gap-2 text-xs">
          <AlertTriangle className="h-6 w-6" />
          <span>Original file is missing</span>
        </div>
      </div>
    )
  }

  if (isEditableTextDocumentAsset(asset)) {
    const editable = documentPresentation === 'auto' || documentPresentation === 'editor'
    return (
      <TextDocumentSurface
        asset={asset}
        className={className}
        editable={editable}
      />
    )
  }

  if (isReadableOfficeDocumentAsset(asset)) {
    return (
      <OfficeDocumentSurface
        asset={asset}
        className={className}
        presentation={documentPresentation}
        fallback={<DocumentPreviewSurface asset={asset} className={className} />}
      />
    )
  }

  if (shouldPreferDocumentPreview(asset)) {
    return (
      <DocumentPreviewSurface asset={asset} className={className} />
    )
  }

  // Non-document items are not routed through the document workspace; render a
  // clear placeholder so navigation never shows a blank stage.
  return (
    <div className={cn('flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-[color:var(--preview-stage-bg)] text-muted-foreground', className)}>
      <FileX2 className="h-10 w-10 stroke-[1.25]" />
      <div className="max-w-[70%] truncate text-sm font-medium text-foreground">{asset.name}</div>
      <div className="text-xs">{asset.extension.replace(/^\./, '').toUpperCase()}</div>
    </div>
  )
}

function DocumentPreviewSurface({
  asset,
  className,
}: {
  asset: Asset
  className?: string
}) {
  const normalizedExtension = normalizeAssetExtension(asset.extension)
  const isDirectPdf = normalizedExtension === 'pdf'
  const documentSource = usePreviewDocumentSource(asset.id)
  const source = documentSource.data ?? null

  if (source) {
    return (
      <div className={cn('relative h-full min-h-0 overflow-hidden bg-[color:var(--document-surface-bg)]', className)}>
        <iframe
          src={source.url}
          title={asset.name}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-white"
        />
        {source.derived ? (
          <div className="pointer-events-none absolute top-4 left-4 rounded-full border border-[color:var(--preview-ui-border)] bg-[image:var(--preview-ui-bg)] px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-[color:var(--preview-ui-fg-muted)] shadow-[var(--preview-ui-shadow)]">
            PDF Preview
          </div>
        ) : null}
      </div>
    )
  }

  if (isDirectPdf && documentSource.isLoading) {
    return (
      <div className={cn('flex h-full min-h-0 items-center justify-center bg-[color:var(--document-surface-bg)] text-sm text-muted-foreground', className)}>
        正在加载 PDF 预览…
      </div>
    )
  }

  if (documentSource.error) {
    return (
      <div className={cn('flex h-full min-h-0 items-center justify-center bg-[color:var(--document-surface-bg)] text-sm text-muted-foreground', className)}>
        PDF preview is unavailable for this file.
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 items-center justify-center bg-[color:var(--document-surface-bg)] text-sm text-muted-foreground', className)}>
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <AlertTriangle className="h-5 w-5" />
        <span>No preview available for this file.</span>
      </div>
    </div>
  )
}

function isEditableTextDocumentAsset(asset: Asset) {
  const extension = normalizeAssetExtension(asset.extension)
  return asset.kind === 'document' && isTextEditableDocumentExtension(`.${extension}`)
}

function isReadableOfficeDocumentAsset(asset: Asset) {
  const extension = normalizeAssetExtension(asset.extension)
  return (asset.kind === 'document' || asset.kind === 'project') && READABLE_OFFICE_DOCUMENT_EXTENSIONS.has(extension)
}

function shouldPreferDocumentPreview(asset: Asset) {
  const extension = normalizeAssetExtension(asset.extension)
  return DOCUMENT_PREVIEW_PROJECT_EXTENSIONS.has(extension)
}

const READABLE_OFFICE_DOCUMENT_EXTENSIONS = new Set([
  'docx',
  'pptx',
  'xlsx',
])

/**
 * Extensions the migrated backend can actually preview/convert. This set is
 * aligned with the backend's `isPdfConvertibleDocumentExtension` (which does
 * NOT include `.key/.numbers/.pages/.xla/.xlam`), so the frontend never
 * claims derived-PDF support the backend cannot deliver.
 */
const DOCUMENT_PREVIEW_PROJECT_EXTENSIONS = new Set([
  'doc',
  'docm',
  'docx',
  'dot',
  'dotm',
  'dotx',
  'dps',
  'epub',
  'et',
  'odp',
  'ods',
  'odt',
  'pot',
  'potm',
  'potx',
  'pps',
  'ppsm',
  'ppsx',
  'ppt',
  'pptm',
  'pptx',
  'rtf',
  'wps',
  'xls',
  'xlsb',
  'xlsm',
  'xlsx',
  'xlt',
  'xltm',
  'xltx',
])

function normalizeAssetExtension(extension: string) {
  return extension.replace(/^\./, '').toLowerCase()
}
