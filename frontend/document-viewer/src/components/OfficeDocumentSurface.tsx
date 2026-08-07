import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TextareaHTMLAttributes } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  LoaderCircle,
  Pencil,
  Presentation,
  RefreshCw,
  RotateCcw,
  Save,
  Table2,
} from 'lucide-react'
import type {
  Asset,
  OfficeDocumentBlockData,
  OfficeDocumentData,
  OfficeDocumentSaveInput,
  OfficeDocumentSheetData,
  OfficeDocumentSlideData,
} from '../shared/types'
import { cn } from '../lib/utils'
import {
  usePreviewOfficeDocument,
  useSavePreviewOfficeDocument,
} from '../hooks/use-preview'
import { useI18n } from '../lib/i18n'

interface OfficeDocumentSurfaceProps {
  asset: Asset
  className?: string
  fallback?: ReactNode
  presentation?: 'auto' | 'preview' | 'editor' | 'compact'
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
type OfficeWorkspaceMode = 'preview' | 'edit'
type OfficeSurfaceThemeId = 'paper' | 'ivory' | 'mint' | 'graphite'

const OFFICE_SURFACE_THEMES: Record<OfficeSurfaceThemeId, {
  swatch: string
  surfaceBg: string
  headerBg: string
  shellBg: string
  toolbarBg: string
  mutedPanelBg: string
  border: string
  text: string
  heading: string
  muted: string
  accent: string
  selectionBg: string
}> = {
  paper: {
    swatch: 'linear-gradient(135deg, #ffffff, #eef3fb)',
    surfaceBg: '#f3f6fb',
    headerBg: 'rgba(255,255,255,0.94)',
    shellBg: '#ffffff',
    toolbarBg: 'rgba(248, 250, 252, 0.92)',
    mutedPanelBg: '#f8fafc',
    border: '#d9e2ef',
    text: '#0f172a',
    heading: '#0b1220',
    muted: '#526277',
    accent: '#2563eb',
    selectionBg: 'rgba(72, 134, 255, 0.22)',
  },
  ivory: {
    swatch: 'linear-gradient(135deg, #fffef7, #f6efd9)',
    surfaceBg: '#f7f2e8',
    headerBg: 'rgba(255,250,240,0.94)',
    shellBg: '#fffdf7',
    toolbarBg: 'rgba(251, 246, 233, 0.94)',
    mutedPanelBg: '#faf6ec',
    border: '#e6dbc3',
    text: '#2b2418',
    heading: '#17120d',
    muted: '#756854',
    accent: '#c27821',
    selectionBg: 'rgba(194, 120, 33, 0.20)',
  },
  mint: {
    swatch: 'linear-gradient(135deg, #f5fffb, #d8f4ea)',
    surfaceBg: '#edf8f3',
    headerBg: 'rgba(245,255,251,0.94)',
    shellBg: '#fcfffd',
    toolbarBg: 'rgba(232, 247, 240, 0.94)',
    mutedPanelBg: '#f3fbf7',
    border: '#cfe5dc',
    text: '#10221e',
    heading: '#0b1714',
    muted: '#50706a',
    accent: '#109572',
    selectionBg: 'rgba(16, 149, 114, 0.20)',
  },
  graphite: {
    swatch: 'linear-gradient(135deg, #1c2430, #0d1117)',
    surfaceBg: '#0e141c',
    headerBg: 'rgba(12,18,26,0.95)',
    shellBg: '#121a24',
    toolbarBg: 'rgba(10, 15, 22, 0.95)',
    mutedPanelBg: '#0f1721',
    border: 'rgba(148, 163, 184, 0.16)',
    text: '#edf3ff',
    heading: '#f8fbff',
    muted: '#93a4bb',
    accent: '#6ca2ff',
    selectionBg: 'rgba(108, 162, 255, 0.34)',
  },
}

const DOCX_HTML_FALLBACK_STYLES = `
.office-docx-html {
  color: var(--document-text);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
  line-height: 1.7;
  font-size: 14px;
}
.office-docx-html h1,
.office-docx-html h2,
.office-docx-html h3,
.office-docx-html h4,
.office-docx-html h5,
.office-docx-html h6 {
  color: var(--document-heading);
  line-height: 1.35;
  margin: 1.25em 0 0.5em;
  font-weight: 600;
}
.office-docx-html h1 { font-size: 28px; }
.office-docx-html h2 { font-size: 22px; }
.office-docx-html h3 { font-size: 18px; }
.office-docx-html p,
.office-docx-html ul,
.office-docx-html ol,
.office-docx-html blockquote,
.office-docx-html pre,
.office-docx-html table {
  margin: 0.8em 0;
}
.office-docx-html ul,
.office-docx-html ol {
  padding-left: 1.35rem;
}
.office-docx-html blockquote {
  border-left: 3px solid var(--document-border);
  padding-left: 1rem;
  color: var(--document-muted);
}
.office-docx-html img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1rem 0;
}
.office-docx-html table {
  width: 100%;
  border-collapse: collapse;
}
.office-docx-html th,
.office-docx-html td {
  border: 1px solid var(--document-border);
  padding: 10px 12px;
  vertical-align: top;
}
.office-docx-html th {
  background: var(--document-toolbar-bg);
  text-align: left;
  font-weight: 600;
}
.office-docx-html code,
.office-docx-html pre {
  background: var(--document-muted-panel-bg);
  border-radius: 6px;
}
.office-docx-html code {
  padding: 0.12rem 0.35rem;
}
.office-docx-html pre {
  padding: 0.9rem 1rem;
  overflow: auto;
}
`

export default function OfficeDocumentSurface({
  asset,
  className,
  fallback,
  presentation = 'auto',
}: OfficeDocumentSurfaceProps) {
  const { t } = useI18n()
  const documentQuery = usePreviewOfficeDocument(asset.id)
  const saveMutation = useSavePreviewOfficeDocument(asset.id)
  const document = documentQuery.data ?? null

  const [blocks, setBlocks] = useState<OfficeDocumentBlockData[]>([])
  const [sheets, setSheets] = useState<OfficeDocumentSheetData[]>([])
  const [slides, setSlides] = useState<OfficeDocumentSlideData[]>([])
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [mode, setMode] = useState<OfficeWorkspaceMode>(presentation === 'editor' ? 'edit' : 'preview')
  const [lastSaveOutcome, setLastSaveOutcome] = useState<'saved' | 'error' | null>(null)

  const lastSavedSnapshotRef = useRef<string | null>(null)
  const saveStateResetTimerRef = useRef<number | null>(null)
  const surfaceTheme: OfficeSurfaceThemeId = 'paper'

  const surfaceStyle = useMemo<CSSProperties>(() => {
    const theme = OFFICE_SURFACE_THEMES[surfaceTheme]
    const sourceBackground = normalizeOfficeBackgroundColor(document?.backgroundColor)
    const useSourceBackground = sourceBackground !== null && document?.readerKind !== 'xlsx'
    const sourceForeground = sourceBackground && isDarkOfficeBackground(sourceBackground) ? '#f8fafc' : theme.text
    return {
      '--document-surface-bg': useSourceBackground ? sourceBackground : theme.surfaceBg,
      '--document-header-bg': theme.headerBg,
      '--document-shell-bg': useSourceBackground ? sourceBackground : theme.shellBg,
      '--document-toolbar-bg': theme.toolbarBg,
      '--document-muted-panel-bg': theme.mutedPanelBg,
      '--document-border': theme.border,
      '--document-text': sourceForeground,
      '--document-heading': useSourceBackground ? sourceForeground : theme.heading,
      '--document-muted': theme.muted,
      '--document-accent': theme.accent,
      '--office-selection-bg': theme.selectionBg,
    } as CSSProperties
  }, [document?.backgroundColor, document?.readerKind, surfaceTheme])

  useEffect(() => {
    return () => {
      if (saveStateResetTimerRef.current !== null) {
        window.clearTimeout(saveStateResetTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!document) return
    setBlocks(document.blocks ?? [])
    setSheets(document.sheets ?? [])
    setSlides(document.slides ?? [])
    setActiveSheetIndex(0)
    setActiveSlideIndex(0)
    const snapshot = serializeOfficeState(document.readerKind, {
      readerKind: document.readerKind,
      blocks: document.blocks ?? [],
      sheets: document.sheets ?? [],
      slides: document.slides ?? [],
    })
    lastSavedSnapshotRef.current = snapshot
    setLastSaveOutcome(null)
  }, [document])

  useEffect(() => {
    setMode(presentation === 'editor' && document ? 'edit' : 'preview')
  }, [document, presentation])

  const currentInput = useMemo<OfficeDocumentSaveInput | null>(() => {
    if (!document) return null
    if (document.readerKind === 'docx') return { readerKind: 'docx', blocks }
    if (document.readerKind === 'xlsx') return { readerKind: 'xlsx', sheets }
    return { readerKind: 'pptx', slides }
  }, [blocks, document, sheets, slides])

  const currentSnapshot = useMemo(() => (
    document && currentInput
      ? serializeOfficeState(document.readerKind, currentInput)
      : null
  ), [currentInput, document])

  const hasStructuredDocument = Boolean(document)
  const hasAnyPreview = Boolean(document?.html || hasStructuredDocument)
  const isDirty = Boolean(currentSnapshot && currentSnapshot !== lastSavedSnapshotRef.current)
  const isSaving = saveMutation.isPending
  const saveState: SaveState = isSaving
    ? 'saving'
    : lastSaveOutcome === 'error'
      ? 'error'
      : isDirty
        ? 'dirty'
        : lastSaveOutcome === 'saved'
          ? 'saved'
          : 'idle'

  useEffect(() => {
    if (isDirty && lastSaveOutcome === 'saved') {
      setLastSaveOutcome(null)
    }
  }, [isDirty, lastSaveOutcome])

  const handleReload = () => {
    setLastSaveOutcome(null)
    void documentQuery.refetch()
  }

  const handleResetDraft = () => {
    setLastSaveOutcome(null)
    void documentQuery.refetch()
  }

  const handleSave = () => {
    if (!currentInput || !currentSnapshot || !isDirty || isSaving) return
    setLastSaveOutcome(null)
    saveMutation.mutate(currentInput, {
      onSuccess: () => {
        lastSavedSnapshotRef.current = currentSnapshot
        setLastSaveOutcome('saved')
        if (saveStateResetTimerRef.current !== null) {
          window.clearTimeout(saveStateResetTimerRef.current)
        }
        saveStateResetTimerRef.current = window.setTimeout(() => {
          setLastSaveOutcome((state) => state === 'saved' ? null : state)
          saveStateResetTimerRef.current = null
        }, 1600)
      },
      onError: () => {
        setLastSaveOutcome('error')
      },
    })
  }

  if (presentation === 'compact') {
    if (!document && documentQuery.isLoading) {
      return (
        <div
          className={cn('flex h-full min-h-0 items-center justify-center', className)}
          style={surfaceStyle}
        >
          <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: 'var(--document-muted)' }} />
        </div>
      )
    }

    if (document) {
      return (
        <CompactOfficeDocumentPreview
          asset={asset}
          document={document}
          className={className}
          style={surfaceStyle}
        />
      )
    }

    if (fallback) return <>{fallback}</>
  }

  if (!hasAnyPreview && documentQuery.isLoading) {
    return (
      <div
        className={cn('flex h-full min-h-0 items-center justify-center text-sm', className)}
        style={{ background: 'var(--document-surface-bg)', color: 'var(--document-muted)' }}
      >
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>{t('正在加载 Office 工作区…', 'Loading Office workspace...')}</span>
        </div>
      </div>
    )
  }

  if (!hasAnyPreview) {
    if (fallback) return <>{fallback}</>
    const detail = documentQuery.error instanceof Error
      ? documentQuery.error.message
      : null
    return (
      <div
        className={cn('flex h-full min-h-0 items-center justify-center text-sm text-destructive', className)}
        style={{ background: 'var(--document-surface-bg)' }}
      >
        <div className="flex max-w-[520px] flex-col items-center gap-2 px-6 text-center">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('Office 预览不可用。', 'Office preview is unavailable.')}</span>
          </div>
          {detail ? <div className="text-[12px] leading-5 text-destructive/80">{detail}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('office-document-surface flex h-full min-h-0 flex-col overflow-hidden', className)}
      style={surfaceStyle}
    >
      <style>{DOCX_HTML_FALLBACK_STYLES}</style>
      <OfficeWorkspaceHeader
        asset={asset}
        document={document}
        presentation={presentation}
        mode={mode}
        saveState={saveState}
        canSave={Boolean(document && mode === 'edit')}
        canReset={Boolean(document && mode === 'edit')}
        isRefreshing={documentQuery.isFetching}
        isSaving={isSaving}
        onModeChange={setMode}
        onReload={handleReload}
        onReset={handleResetDraft}
        onSave={handleSave}
        t={t}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'preview' ? (
          <OfficePreviewWorkspace
            document={document}
            t={t}
          />
        ) : (
          <OfficeQuickEditWorkspace
            document={document}
            blocks={blocks}
            sheets={sheets}
            slides={slides}
            warnings={document?.warnings ?? []}
            activeSheetIndex={activeSheetIndex}
            activeSlideIndex={activeSlideIndex}
            onBlocksChange={setBlocks}
            onSheetsChange={setSheets}
            onSlidesChange={setSlides}
            onActiveSheetIndexChange={setActiveSheetIndex}
            onActiveSlideIndexChange={setActiveSlideIndex}
            t={t}
          />
        )}
      </div>
    </div>
  )
}

function CompactOfficeDocumentPreview({
  asset,
  document,
  className,
  style,
}: {
  asset: Asset
  document: OfficeDocumentData
  className?: string
  style: CSSProperties
}) {
  const extensionLabel = asset.extension.replace(/^\./, '').toUpperCase() || 'DOCX'

  return (
    <div
      className={cn('office-document-surface relative h-full min-h-0 overflow-hidden', className)}
      style={style}
    >
      <style>{DOCX_HTML_FALLBACK_STYLES}</style>
      <div
        className="pointer-events-none absolute top-2 right-2 z-10 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em]"
        style={{
          borderColor: 'var(--document-border)',
          background: 'var(--document-header-bg)',
          color: 'var(--document-muted)',
        }}
      >
        {extensionLabel}
      </div>
      <div
        className="h-full overflow-auto px-4 py-4 pr-12"
        style={{ background: 'var(--document-shell-bg)' }}
      >
        {document.readerKind === 'docx' && document.html ? (
          <DocxFallbackPreview html={document.html} compact />
        ) : document.readerKind === 'docx' ? (
          <div className="space-y-2">
            {(document.blocks ?? []).map((block: any) => (
              <SelectableBlock key={block.id} level={block.level} text={block.text} />
            ))}
          </div>
        ) : document.readerKind === 'xlsx' ? (
          <CompactSpreadsheetPreview sheets={document.sheets ?? []} />
        ) : (
          <CompactPresentationPreview slides={document.slides ?? []} />
        )}
      </div>
    </div>
  )
}

function CompactSpreadsheetPreview({ sheets }: { sheets: OfficeDocumentSheetData[] }) {
  const activeSheet = sheets[0] ?? null
  if (!activeSheet) return <EmptyMessage label="暂无可预览表格内容。" />

  return (
    <div className="overflow-auto">
      <SheetReadOnlyTable sheet={activeSheet} />
    </div>
  )
}

function CompactPresentationPreview({ slides }: { slides: OfficeDocumentSlideData[] }) {
  if (!slides.length) return <EmptyMessage label="暂无可预览演示内容。" />

  return (
    <div className="space-y-4">
      {slides.map((slide) => (
        <section key={slide.index} className="border-b pb-4 last:border-b-0" style={{ borderColor: 'var(--document-border)' }}>
          {slide.texts.map((text: any, index: number) => (
            <SelectableBlock key={`${slide.index}-${index}`} level={index === 0 ? 2 : 0} text={text} />
          ))}
        </section>
      ))}
    </div>
  )
}

function OfficeWorkspaceHeader({
  asset,
  document,
  presentation,
  mode,
  saveState,
  canSave,
  canReset,
  isRefreshing,
  isSaving,
  onModeChange,
  onReload,
  onReset,
  onSave,
  t,
}: {
  asset: Asset
  document: OfficeDocumentData | null
  presentation: 'auto' | 'preview' | 'editor' | 'compact'
  mode: OfficeWorkspaceMode
  saveState: SaveState
  canSave: boolean
  canReset: boolean
  isRefreshing: boolean
  isSaving: boolean
  onModeChange: (mode: OfficeWorkspaceMode) => void
  onReload: () => void
  onReset: () => void
  onSave: () => void
  t: (zh: string, en: string) => string
}) {
  const kind = document?.readerKind ?? inferOfficeKindFromExtension(asset.extension)
  const Icon = kind === 'xlsx'
    ? Table2
    : kind === 'pptx'
      ? Presentation
      : FileText

  return (
    <div
      className="border-b px-4 py-3"
      style={{ borderColor: 'var(--document-border)', background: 'var(--document-header-bg)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)', color: 'var(--document-muted)' }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold" style={{ color: 'var(--document-heading)' }}>
              {asset.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--document-muted)' }}>
              <HeaderChip>{asset.extension.replace(/^\./, '').toUpperCase()}</HeaderChip>
              <HeaderChip>{renderOfficeKindLabel(kind, t)}</HeaderChip>
              <SaveIndicator state={saveState} t={t} />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {presentation !== 'preview' && document ? (
            <ModeSwitcher
              mode={mode}
              onModeChange={onModeChange}
              t={t}
            />
          ) : null}
          {canReset ? (
            <ToolbarButton title={t('放弃当前草稿并重新载入', 'Discard draft and reload')} onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {canSave ? (
            <ToolbarButton title={t('保存快速编辑内容', 'Save quick-edit content')} onClick={onSave} primary disabled={isSaving || saveState === 'idle'}>
              <Save className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          <ToolbarButton title={t('重新载入文档', 'Reload document')} onClick={onReload}>
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </ToolbarButton>
        </div>
      </div>
    </div>
  )
}

function ModeSwitcher({
  mode,
  onModeChange,
  t,
}: {
  mode: OfficeWorkspaceMode
  onModeChange: (mode: OfficeWorkspaceMode) => void
  t: (zh: string, en: string) => string
}) {
  const items: Array<{
    id: OfficeWorkspaceMode
    label: string
    icon: ReactNode
  }> = [
    { id: 'preview', label: t('阅读', 'Read'), icon: <Eye className="h-3.5 w-3.5" /> },
    { id: 'edit', label: t('编辑', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" /> },
  ]

  return (
    <div
      className="flex items-center gap-1 rounded-lg border p-1"
      style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)' }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onModeChange(item.id)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition"
          style={item.id === mode
            ? { background: 'var(--document-toolbar-bg)', color: 'var(--document-heading)' }
            : { color: 'var(--document-muted)' }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function OfficePreviewWorkspace({
  document,
  t,
}: {
  document: OfficeDocumentData | null
  t: (zh: string, en: string) => string
}) {
  return (
    <div className="allow-text-selection min-h-0 h-full overflow-auto p-4">
      <div className="mx-auto max-w-[1320px]">
        <div
          className="overflow-hidden border"
          style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)' }}
        >
          {document?.readerKind === 'docx' && document.html ? (
            <DocxFallbackPreview html={document.html} />
          ) : document?.readerKind === 'docx' ? (
            <div className="min-h-[520px] space-y-3 p-6">
              {(document.blocks ?? []).map((block: any) => (
                <SelectableBlock key={block.id} level={block.level} text={block.text} />
              ))}
            </div>
          ) : document?.readerKind === 'xlsx' ? (
            <XlsxReadOnlyPreview
              sheets={document.sheets ?? []}
              t={t}
            />
          ) : document?.readerKind === 'pptx' ? (
            <PptxReadOnlyPreview
              slides={document.slides ?? []}
              t={t}
            />
          ) : (
            <LoadingPanel label={t('当前文件没有可用预览。', 'No preview is available for this file.')} />
          )}
        </div>
      </div>
    </div>
  )
}

function OfficeQuickEditWorkspace({
  document,
  blocks,
  sheets,
  slides,
  warnings,
  activeSheetIndex,
  activeSlideIndex,
  onBlocksChange,
  onSheetsChange,
  onSlidesChange,
  onActiveSheetIndexChange,
  onActiveSlideIndexChange,
  t,
}: {
  document: OfficeDocumentData | null
  blocks: OfficeDocumentBlockData[]
  sheets: OfficeDocumentSheetData[]
  slides: OfficeDocumentSlideData[]
  warnings: string[]
  activeSheetIndex: number
  activeSlideIndex: number
  onBlocksChange: (next: OfficeDocumentBlockData[]) => void
  onSheetsChange: (next: OfficeDocumentSheetData[]) => void
  onSlidesChange: (next: OfficeDocumentSlideData[]) => void
  onActiveSheetIndexChange: (index: number) => void
  onActiveSlideIndexChange: (index: number) => void
  t: (zh: string, en: string) => string
}) {
  if (!document) {
    return (
      <div className="p-4">
        <EmptyMessage label={t('当前文件不支持内置快速编辑。', 'This file does not support built-in quick edit.')} />
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      {document.readerKind === 'docx' ? (
        <DocxEditor
          blocks={blocks}
          warnings={warnings}
          onChange={onBlocksChange}
          t={t}
        />
      ) : document.readerKind === 'xlsx' ? (
        <XlsxEditor
          sheets={sheets}
          warnings={warnings}
          activeSheetIndex={activeSheetIndex}
          onActiveSheetIndexChange={onActiveSheetIndexChange}
          onChange={onSheetsChange}
          t={t}
        />
      ) : (
        <PptxEditor
          slides={slides}
          warnings={warnings}
          activeSlideIndex={activeSlideIndex}
          onActiveSlideIndexChange={onActiveSlideIndexChange}
          onChange={onSlidesChange}
          t={t}
        />
      )}
    </div>
  )
}

function DocxFallbackPreview({ html, compact = false }: { html: string; compact?: boolean }) {
  const safeHtml = useMemo(() => sanitizeDocxHtmlForRenderer(html), [html])

  return (
    <div className={cn('allow-text-selection', compact ? 'min-h-0 bg-transparent p-0' : 'min-h-[520px] overflow-auto bg-[color:var(--document-muted-panel-bg)] p-6')}>
      <article className={cn(compact ? 'max-w-none bg-transparent px-0 py-0 shadow-none' : 'mx-auto max-w-[940px] border px-10 py-10 shadow-sm')} style={compact ? undefined : { borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)' }}>
        <div className="office-docx-html" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </article>
    </div>
  )
}

const DOCX_RENDERER_ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'EM', 'H1', 'H2', 'H3', 'H4',
  'H5', 'H6', 'HR', 'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG',
  'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL',
])

function sanitizeDocxHtmlForRenderer(input: string) {
  if (typeof DOMParser === 'undefined') return ''

  const document = new DOMParser().parseFromString(input, 'text/html')
  const elements = Array.from(document.body.querySelectorAll('*'))

  for (const element of elements) {
    if (!DOCX_RENDERER_ALLOWED_TAGS.has(element.tagName)) {
      element.remove()
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const allowed = (
        (element.tagName === 'A' && (name === 'href' || name === 'name' || name === 'target'))
        || (element.tagName === 'IMG' && ['alt', 'decoding', 'height', 'loading', 'src', 'title', 'width'].includes(name))
        || ((element.tagName === 'TD' || element.tagName === 'TH') && ['colspan', 'rowspan'].includes(name))
      )

      if (!allowed || name.startsWith('on') || name === 'style' || name === 'srcset') {
        element.removeAttribute(attribute.name)
      }
    }

    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') ?? ''
      if (!/^data:image\/(?:gif|jpe?g|png|webp);/i.test(src)) {
        element.remove()
      }
    } else if (element.tagName === 'A') {
      const href = element.getAttribute('href') ?? ''
      if (!/^(?:https?:|mailto:|#)/i.test(href)) {
        element.removeAttribute('href')
      }
      if (element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', 'noopener noreferrer')
      }
    }
  }

  return document.body.innerHTML
}

function XlsxReadOnlyPreview({
  sheets,
  t,
}: {
  sheets: OfficeDocumentSheetData[]
  t: (zh: string, en: string) => string
}) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const safeIndex = Math.min(activeSheetIndex, Math.max(0, sheets.length - 1))
  const activeSheet = sheets[safeIndex] ?? null

  useEffect(() => {
    if (safeIndex !== activeSheetIndex) {
      setActiveSheetIndex(safeIndex)
    }
  }, [activeSheetIndex, safeIndex])

  if (!activeSheet) {
    return <LoadingPanel label={t('当前工作簿没有可用表格视图。', 'This workbook has no previewable sheet.')} />
  }

  return (
    <div className="allow-text-selection min-h-[480px] overflow-hidden">
      <div className="flex items-center gap-2 overflow-x-auto border-b px-4 py-3" style={{ borderColor: 'var(--document-border)', background: 'var(--document-toolbar-bg)' }}>
        {sheets.map((sheet, index) => (
          <button
            key={sheet.name}
            type="button"
            onClick={() => setActiveSheetIndex(index)}
            className="shrink-0 rounded-md border px-3 py-1.5 text-[12px] transition"
            style={index === safeIndex
              ? { borderColor: 'rgba(37,99,235,0.24)', background: 'rgba(37,99,235,0.10)', color: 'var(--document-heading)' }
              : { borderColor: 'var(--document-border)', color: 'var(--document-muted)' }}
          >
            {sheet.name}
          </button>
        ))}
      </div>
      <div className="overflow-auto">
        <SheetReadOnlyTable sheet={activeSheet} />
      </div>
    </div>
  )
}

function PptxReadOnlyPreview({
  slides,
  t,
}: {
  slides: OfficeDocumentSlideData[]
  t: (zh: string, en: string) => string
}) {
  if (!slides.length) {
    return <LoadingPanel label={t('当前演示文稿没有可用页面视图。', 'This presentation has no previewable slides.')} />
  }

  return (
    <div className="allow-text-selection grid gap-4 overflow-auto p-5 xl:grid-cols-2">
      {slides.map((slide) => {
        const background = normalizeOfficeBackgroundColor(slide.backgroundColor) ?? '#FFFFFF'
        const isDark = isDarkOfficeBackground(background)
        const foreground = isDark ? '#F8FAFC' : '#0F172A'
        const muted = isDark ? '#CBD5E1' : '#64748B'
        return (
          <section
            key={slide.index}
            className="border p-5 shadow-sm"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#e2e8f0', background }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-[13px] font-semibold" style={{ color: foreground }}>
                {slide.title || `Slide ${slide.index}`}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: muted }}>
                {slide.index}
              </div>
            </div>
            <div className="aspect-[16/9] border p-4" style={{ borderColor: isDark ? 'rgba(255,255,255,0.16)' : '#dbe4ee', background: 'rgba(255,255,255,0.08)' }}>
              <div className="space-y-3">
                {slide.texts.map((text: any, index: number) => (
                  <SelectableBlock key={`${slide.index}-${index}`} level={index === 0 ? 2 : 0} text={text} color={foreground} />
                ))}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

function SheetReadOnlyTable({ sheet }: { sheet: OfficeDocumentSheetData }) {
  const columnLabels = buildSpreadsheetColumnLabels(sheet.columnCount)
  return (
    <table className="allow-text-selection min-w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th
            className="sticky left-0 top-0 z-20 min-w-[56px] border-r border-b px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ borderColor: 'var(--document-border)', background: 'var(--document-toolbar-bg)', color: 'var(--document-muted)' }}
          >
            #
          </th>
          {columnLabels.map((label) => (
            <th
              key={label}
              className="sticky top-0 z-10 min-w-[156px] border-r border-b px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ borderColor: 'var(--document-border)', background: 'var(--document-toolbar-bg)', color: 'var(--document-muted)' }}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.previewRows.map((row: any[], rowIndex: number) => (
          <tr key={`${sheet.name}-${rowIndex}`}>
            <th
              className="sticky left-0 z-10 border-r border-b px-2 py-2 text-right text-[11px] font-medium"
              style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)', color: 'var(--document-muted)' }}
            >
              {rowIndex + 1}
            </th>
            {columnLabels.map((label, columnIndex) => (
              <td
                key={`${label}-${rowIndex}-${columnIndex}`}
                className="border-r border-b px-3 py-2 align-top text-[12px] leading-5"
                style={{ borderColor: 'var(--document-border)', color: 'var(--document-text)' }}
              >
                <div className="whitespace-pre-wrap break-words">{row[columnIndex] ?? ''}</div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DocxEditor({
  blocks,
  warnings,
  onChange,
  t,
}: {
  blocks: OfficeDocumentBlockData[]
  warnings: string[]
  onChange: (next: OfficeDocumentBlockData[]) => void
  t: (zh: string, en: string) => string
}) {
  return (
    <div className="min-h-0 overflow-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-[980px] rounded-xl border px-6 py-7" style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)' }}>
        <div className="mb-5 text-[12px]" style={{ color: 'var(--document-muted)' }}>
          {t('按段落直接修改文案，界面只保留正文编辑本身。', 'Edit copy paragraph by paragraph with a focused writing surface.')}
        </div>
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <EditableParagraph
              key={block.id}
              value={block.text}
              level={block.level}
              placeholder={t(`第 ${index + 1} 段`, `Paragraph ${index + 1}`)}
              onChange={(nextValue) => {
                const nextBlocks = [...blocks]
                nextBlocks[index] = { ...block, text: nextValue }
                onChange(nextBlocks)
              }}
            />
          ))}
        </div>
        <Warnings warnings={warnings} t={t} />
      </div>
    </div>
  )
}

function XlsxEditor({
  sheets,
  warnings,
  activeSheetIndex,
  onActiveSheetIndexChange,
  onChange,
  t,
}: {
  sheets: OfficeDocumentSheetData[]
  warnings: string[]
  activeSheetIndex: number
  onActiveSheetIndexChange: (index: number) => void
  onChange: (next: OfficeDocumentSheetData[]) => void
  t: (zh: string, en: string) => string
}) {
  const activeSheet = sheets[Math.min(activeSheetIndex, Math.max(0, sheets.length - 1))] ?? null
  const columnLabels = activeSheet ? buildSpreadsheetColumnLabels(activeSheet.columnCount) : []

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
      <EditorSidebar
        title={t('工作表', 'Sheets')}
        subtitle={t('切换并修改当前预览区域', 'Switch and edit the visible preview range')}
        items={sheets.map((sheet, index) => ({
          id: `${index}`,
          label: sheet.name,
          meta: `${sheet.rowCount} × ${sheet.columnCount}`,
          active: index === activeSheetIndex,
          onClick: () => onActiveSheetIndexChange(index),
        }))}
      />
      <div className="min-h-0 overflow-auto px-4 py-4 sm:px-6">
        {activeSheet ? (
          <div className="mx-auto max-w-[1240px] rounded-lg border" style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)' }}>
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--document-border)', background: 'var(--document-toolbar-bg)' }}>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--document-heading)' }}>{activeSheet.name}</div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--document-muted)' }}>
                {t('这里更适合轻量内容修订，不替代 Excel 的格式、公式和图表编辑。', 'This view is for light content revisions, not full Excel formatting, formula, or chart editing.')}
              </div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 min-w-[56px] border-r border-b px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: 'var(--document-border)', background: 'var(--document-toolbar-bg)', color: 'var(--document-muted)' }}>
                      #
                    </th>
                    {columnLabels.map((label) => (
                      <th key={label} className="sticky top-0 z-10 min-w-[156px] border-r border-b px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: 'var(--document-border)', background: 'var(--document-toolbar-bg)', color: 'var(--document-muted)' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.previewRows.map((row: any[], rowIndex: number) => (
                    <tr key={`${activeSheet.name}-${rowIndex}`}>
                      <th className="sticky left-0 z-10 border-r border-b px-2 py-2 text-right text-[11px] font-medium" style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)', color: 'var(--document-muted)' }}>
                        {rowIndex + 1}
                      </th>
                      {columnLabels.map((label, columnIndex) => (
                        <td key={`${label}-${rowIndex}-${columnIndex}`} className="border-r border-b align-top" style={{ borderColor: 'var(--document-border)' }}>
                          <CellTextarea
                            value={row[columnIndex] ?? ''}
                            className="min-h-[48px] w-full resize-none border-0 bg-transparent px-3 py-2 text-[12px]"
                            style={{ color: 'var(--document-text)' }}
                            onChange={(event) => {
                              const nextSheets = [...sheets]
                              const nextRows = nextSheets[activeSheetIndex].previewRows.map((existingRow: any[]) => [...existingRow])
                              nextRows[rowIndex][columnIndex] = event.currentTarget.value
                              nextSheets[activeSheetIndex] = { ...nextSheets[activeSheetIndex], previewRows: nextRows }
                              onChange(nextSheets)
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Warnings warnings={warnings} t={t} />
            </div>
          </div>
        ) : (
          <EmptyMessage label={t('当前工作簿没有可编辑工作表。', 'Workbook has no editable sheet preview.')} />
        )}
      </div>
    </div>
  )
}

function PptxEditor({
  slides,
  warnings,
  activeSlideIndex,
  onActiveSlideIndexChange,
  onChange,
  t,
}: {
  slides: OfficeDocumentSlideData[]
  warnings: string[]
  activeSlideIndex: number
  onActiveSlideIndexChange: (index: number) => void
  onChange: (next: OfficeDocumentSlideData[]) => void
  t: (zh: string, en: string) => string
}) {
  const activeSlide = slides[Math.min(activeSlideIndex, Math.max(0, slides.length - 1))] ?? null

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <EditorSidebar
        title={t('幻灯片', 'Slides')}
        subtitle={t('逐页调整页面文案和文本块', 'Adjust slide copy block by block')}
        items={slides.map((slide, index) => ({
          id: `${slide.index}`,
          label: slide.title || t(`第 ${slide.index} 页`, `Slide ${slide.index}`),
          meta: `${slide.texts.length}`,
          active: index === activeSlideIndex,
          onClick: () => onActiveSlideIndexChange(index),
        }))}
      />
      <div className="min-h-0 overflow-auto px-4 py-4 sm:px-6">
        {activeSlide ? (
          <div className="mx-auto max-w-[980px] rounded-xl border px-6 py-6" style={{ borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)' }}>
            <div className="mb-4">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--document-heading)' }}>
                {activeSlide.title || t(`第 ${activeSlide.index} 页`, `Slide ${activeSlide.index}`)}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--document-muted)' }}>
                {t('只保留当前页文本编辑，方便快速修订标题和正文。', 'Keep the editor focused on the current slide copy only.')}
              </div>
            </div>
            <div className="space-y-3">
              {activeSlide.texts.map((text: any, textIndex: number) => (
                <div key={`${activeSlide.index}-${textIndex}`} className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--document-border)', background: 'var(--document-muted-panel-bg)' }}>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--document-muted)' }}>
                    {textIndex === 0 ? t('主标题 / 首块', 'Primary block') : t(`文本块 ${textIndex + 1}`, `Text block ${textIndex + 1}`)}
                  </div>
                  <CellTextarea
                    value={text}
                    className="min-h-[72px] w-full resize-none border-0 bg-transparent px-0 py-0 text-[14px] leading-6"
                    style={{ color: 'var(--document-text)' }}
                    onChange={(event) => {
                      const nextSlides = [...slides]
                      const nextTexts = [...nextSlides[activeSlideIndex].texts]
                      nextTexts[textIndex] = event.currentTarget.value
                      nextSlides[activeSlideIndex] = {
                        ...nextSlides[activeSlideIndex],
                        title: textIndex === 0 ? deriveEditorTitle(event.currentTarget.value) : nextSlides[activeSlideIndex].title,
                        texts: nextTexts,
                      }
                      onChange(nextSlides)
                    }}
                  />
                </div>
              ))}
            </div>
            <Warnings warnings={warnings} t={t} />
          </div>
        ) : (
          <EmptyMessage label={t('当前演示文稿没有可编辑文本块。', 'Presentation has no editable text blocks.')} />
        )}
      </div>
    </div>
  )
}

function EditableParagraph({
  value,
  level,
  placeholder,
  textareaRef,
  onFocus,
  onChange,
}: {
  value: string
  level: number
  placeholder: string
  textareaRef?: (node: HTMLTextAreaElement | null) => void
  onFocus?: () => void
  onChange: (value: string) => void
}) {
  const className = level === 1
    ? 'text-[26px] font-semibold leading-[1.35]'
    : level === 2
      ? 'text-[22px] font-semibold leading-[1.4]'
      : level === 3
        ? 'text-[18px] font-semibold leading-[1.45]'
        : 'text-[15px] leading-7'

  return (
    <CellTextarea
      value={value}
      textareaRef={textareaRef}
      className={cn(
        'w-full resize-none rounded-lg border px-4 py-3 transition focus:outline-none',
        className,
      )}
      style={{
        borderColor: 'var(--document-border)',
        background: level > 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
        color: 'var(--document-text)',
      }}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}

function EditorSidebar({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: Array<{ id: string; label: string; depth?: number; meta?: string; active?: boolean; onClick?: () => void }>
}) {
  return (
    <div className="overflow-y-auto border-b px-4 py-4 md:border-r md:border-b-0" style={{ borderColor: 'var(--document-border)', background: 'var(--document-toolbar-bg)' }}>
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--document-muted)' }}>{title}</div>
        <div className="mt-1 text-[11px]" style={{ color: 'var(--document-muted)' }}>{subtitle}</div>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left transition"
            style={item.active
              ? { background: 'rgba(59, 130, 246, 0.10)' }
              : undefined}
          >
            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--document-text)', paddingLeft: `${(item.depth ?? 0) * 10}px` }}>
              {item.label}
            </span>
            {item.meta ? <span className="shrink-0 text-[10px]" style={{ color: 'var(--document-muted)' }}>{item.meta}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function SaveIndicator({
  state,
  t,
}: {
  state: SaveState
  t: (zh: string, en: string) => string
}) {
  if (state === 'saving') return <HeaderChip>{t('保存中…', 'Saving...')}</HeaderChip>
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ borderColor: 'rgba(34, 197, 94, 0.24)', background: 'rgba(34, 197, 94, 0.10)', color: '#22c55e' }}>
        <CheckCircle2 className="h-3 w-3" />
        {t('已保存', 'Saved')}
      </span>
    )
  }
  if (state === 'error') return <HeaderChip tone="warn">{t('保存失败', 'Save failed')}</HeaderChip>
  if (state === 'dirty') return <HeaderChip>{t('待保存', 'Unsaved')}</HeaderChip>
  return null
}

function HeaderChip({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'warn'
}) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]"
      style={tone === 'warn'
        ? { borderColor: 'rgba(245, 158, 11, 0.26)', background: 'rgba(245, 158, 11, 0.10)', color: '#f59e0b' }
        : { borderColor: 'var(--document-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--document-muted)' }}
    >
      {children}
    </span>
  )
}

function ToolbarButton({
  children,
  title,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: ReactNode
  title: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-45"
      style={primary
        ? { borderColor: 'rgba(59, 130, 246, 0.28)', background: 'rgba(59, 130, 246, 0.14)', color: '#60a5fa' }
        : { borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)', color: 'var(--document-muted)' }}
    >
      {children}
    </button>
  )
}

function EmptyMessage({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border text-[13px]" style={{ color: 'var(--document-muted)', borderColor: 'var(--document-border)', background: 'var(--document-shell-bg)' }}>
      {label}
    </div>
  )
}

function SelectableBlock({
  level,
  text,
  color,
}: {
  level: number
  text: string
  color?: string
}) {
  const className = level === 1
    ? 'text-[24px] font-semibold leading-[1.4]'
    : level === 2
      ? 'text-[20px] font-semibold leading-[1.45]'
      : level >= 3
        ? 'text-[16px] font-semibold leading-[1.5]'
        : 'text-[14px] leading-7'

  return (
    <div className={cn('allow-text-selection office-document-copy-block whitespace-pre-wrap break-words', className)} style={{ color: color ?? 'var(--document-text)' }}>
      {text || ' '}
    </div>
  )
}

function Warnings({
  warnings,
  t,
  compact = false,
}: {
  warnings: string[]
  t: (zh: string, en: string) => string
  compact?: boolean
}) {
  if (warnings.length === 0) return null
  return (
    <div className={cn('rounded-lg border px-4 py-3', compact ? '' : 'mt-4')} style={{ borderColor: 'rgba(245, 158, 11, 0.22)', background: 'rgba(245, 158, 11, 0.08)' }}>
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold" style={{ color: 'var(--document-heading)' }}>
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <span>{t('编辑提醒', 'Editing notes')}</span>
      </div>
      <div className="space-y-1">
        {warnings.map((warning, index) => (
          <div key={`${warning}-${index}`} className="text-[12px] leading-5" style={{ color: 'var(--document-text)' }}>
            {warning}
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex h-[calc(100vh-240px)] min-h-[480px] items-center justify-center text-sm" style={{ color: 'var(--document-muted)' }}>
      <div className="flex items-center gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  )
}

function CellTextarea({
  className,
  style,
  textareaRef,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  textareaRef?: (node: HTMLTextAreaElement | null) => void
}) {
  return (
    <textarea
      {...props}
      rows={1}
      ref={(node) => {
        textareaRef?.(node)
        if (!node) return
        node.style.height = '0px'
        node.style.height = `${node.scrollHeight}px`
      }}
      className={cn('outline-none focus:ring-0', className)}
      style={style}
      onInput={(event) => {
        const target = event.currentTarget
        target.style.height = '0px'
        target.style.height = `${target.scrollHeight}px`
        props.onInput?.(event)
      }}
    />
  )
}

function buildSpreadsheetColumnLabels(columnCount: number) {
  const labels: string[] = []
  const safeCount = Math.max(0, Math.min(columnCount, 60))
  for (let index = 0; index < safeCount; index += 1) {
    let value = index + 1
    let label = ''
    while (value > 0) {
      const remainder = (value - 1) % 26
      label = String.fromCharCode(65 + remainder) + label
      value = Math.floor((value - 1) / 26)
    }
    labels.push(label)
  }
  return labels
}

function renderOfficeKindLabel(kind: OfficeDocumentData['readerKind'], t: (zh: string, en: string) => string) {
  if (kind === 'docx') return t('文档', 'Document')
  if (kind === 'xlsx') return t('表格', 'Spreadsheet')
  return t('演示稿', 'Presentation')
}

function inferOfficeKindFromExtension(extension: string): OfficeDocumentData['readerKind'] {
  const normalized = extension.replace(/^\./, '').toLowerCase()
  if (normalized.endsWith('xls') || normalized.endsWith('xlsx') || normalized.endsWith('xlsm') || normalized.endsWith('xlsb')) {
    return 'xlsx'
  }
  if (normalized.endsWith('ppt') || normalized.endsWith('pptx') || normalized.endsWith('pptm') || normalized.endsWith('ppsx')) {
    return 'pptx'
  }
  return 'docx'
}

function deriveEditorTitle(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 80 ? `${normalized.slice(0, 79)}...` : normalized || null
}

function normalizeOfficeBackgroundColor(value: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value! : null
}

function isDarkOfficeBackground(value: string) {
  const hex = value.slice(1)
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 < 150
}

function serializeOfficeState(kind: OfficeDocumentData['readerKind'], input: OfficeDocumentSaveInput) {
  return JSON.stringify({ kind, input })
}
