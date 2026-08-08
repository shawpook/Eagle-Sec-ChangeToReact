import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import MDEditor from '@uiw/react-md-editor'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, CheckCircle2, Eye, LoaderCircle, Moon, PencilLine, SplitSquareVertical, Sun, X } from 'lucide-react'
import type { Asset, DocumentEditorColorMode, DocumentFontPreset } from '../shared/types'
import { isMarkdownDocumentExtension, isTextEditableDocumentExtension } from '../shared/asset-formats'
import { cn } from '../lib/utils'
import { usePreviewTextDocument, useSavePreviewTextDocument } from '../hooks/use-preview'
import { api } from '../lib/api'
import { persistSettingsPatch } from '../lib/settings'
import { useUIStore } from '../stores/ui-store'
import { useSystemLightDarkTheme } from '../lib/system-theme'

import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

type EditorPreviewMode = 'live' | 'edit' | 'preview'
type ResolvedDocumentEditorColorMode = 'light' | 'dark'

const DOCUMENT_EDITOR_COLOR_MODE_STORAGE_KEY = 'eagle.document-editor-color-mode'

const MARKDOWN_PREVIEW_OPTIONS = {
  remarkPlugins: [remarkGfm],
}

const DOCUMENT_FONT_STACKS: Record<DocumentFontPreset, string> = {
  pingfang: "'PingFang SC', 'PingFang TC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', 'Source Han Sans SC', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
  'system-sans': "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  serif: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', Georgia, serif",
  monospace: "'SF Mono', 'JetBrains Mono', 'Cascadia Code', ui-monospace, Menlo, monospace",
}

function readStoredDocumentEditorColorMode(): DocumentEditorColorMode | null {
  try {
    const value = window.localStorage.getItem(DOCUMENT_EDITOR_COLOR_MODE_STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'auto') return value
  } catch {
    // Ignore storage access failures (private mode / locked profile).
  }
  return null
}

function writeStoredDocumentEditorColorMode(mode: DocumentEditorColorMode) {
  try {
    window.localStorage.setItem(DOCUMENT_EDITOR_COLOR_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore storage access failures.
  }
}

function resolveDocumentEditorColorMode(
  preference: DocumentEditorColorMode,
  appResolvedColorMode: ResolvedDocumentEditorColorMode,
): ResolvedDocumentEditorColorMode {
  return preference === 'auto' ? appResolvedColorMode : preference
}

interface TextDocumentSurfaceProps {
  asset: Asset
  className?: string
  editable?: boolean
  pageIndicator?: React.ReactNode
  stageActions?: React.ReactNode
}

export default function TextDocumentSurface({
  asset,
  className,
  editable = false,
  pageIndicator = null,
  stageActions = null,
}: TextDocumentSurfaceProps) {
  const appTheme = useUIStore((state) => state.theme)
  const locale = useUIStore((state) => state.locale)
  const documentFontPreset = useUIStore((state) => state.documentFontPreset)
  const setDocumentFontPreset = useUIStore((state) => state.setDocumentFontPreset)
  const documentEditorColorMode = useUIStore((state) => state.documentEditorColorMode)
  const setDocumentEditorColorMode = useUIStore((state) => state.setDocumentEditorColorMode)
  const followSystemTheme = useUIStore((state) => state.followSystemTheme)
  const forceClosePreview = useUIStore((state) => state.forceClosePreview)
  const systemTheme = useSystemLightDarkTheme()
  const appResolvedColorMode: ResolvedDocumentEditorColorMode =
    (followSystemTheme ? systemTheme : appTheme) === 'light' ? 'light' : 'dark'
  // Prefer an explicit local preference so a stale main-process settings schema
  // (or hydrate race) cannot snap the editor back to the app theme.
  const [colorModePreference, setColorModePreference] = useState<DocumentEditorColorMode>(() => {
    return readStoredDocumentEditorColorMode()
      ?? (documentEditorColorMode === 'auto' ? 'auto' : documentEditorColorMode)
  })
  const editorColorMode = resolveDocumentEditorColorMode(colorModePreference, appResolvedColorMode)

  useEffect(() => {
    // Keep store → local preference in sync when settings hydrate an explicit value.
    if (documentEditorColorMode === 'light' || documentEditorColorMode === 'dark') {
      setColorModePreference((current: any) => {
        if (current === documentEditorColorMode) return current
        writeStoredDocumentEditorColorMode(documentEditorColorMode)
        return documentEditorColorMode
      })
    }
  }, [documentEditorColorMode])
  const normalizedExtension = normalizeExtension(asset.extension)
  const isMarkdown = isMarkdownDocumentExtension(normalizedExtension)
  const canEditTextDocument = isTextEditableDocumentExtension(normalizedExtension)
  const hasTextReadApi = typeof (api.preview as { getTextDocument?: unknown }).getTextDocument === 'function'
  const hasTextSaveApi = typeof (api.preview as { saveTextDocument?: unknown }).saveTextDocument === 'function'
  const documentQuery = usePreviewTextDocument(asset.id)
  const saveMutation = useSavePreviewTextDocument(editable ? asset.id : null)
  const { mutate: saveTextDocument, isPending: isSavePending, isError: hasSaveError } = saveMutation
  const [value, setValue] = useState('')
  const [previewMode, setPreviewMode] = useState<EditorPreviewMode>(editable ? 'live' : 'preview')
  const [fallbackContent, setFallbackContent] = useState<string | null>(null)
  const [fallbackError, setFallbackError] = useState<string | null>(null)
  const [isFallbackLoading, setIsFallbackLoading] = useState(false)
  const hydratedRef = useRef(false)
  const latestValueRef = useRef('')
  const lastSavedValueRef = useRef('')
  const lastAttemptedSaveRef = useRef<string | null>(null)
  const resolvedContent = documentQuery.data?.content ?? fallbackContent
  const effectiveEditable = editable && canEditTextDocument && hasTextSaveApi && !documentQuery.data?.readonly
  const queryErrorMessage = documentQuery.error instanceof Error ? documentQuery.error.message : null
  const documentFontOptions = useMemo<Array<{ value: DocumentFontPreset; label: string }>>(() => (
    locale === 'zh'
      ? [
          { value: 'pingfang', label: '苹方' },
          { value: 'system-sans', label: '系统无衬线' },
          { value: 'serif', label: '衬线' },
          { value: 'monospace', label: '等宽' },
        ]
      : [
          { value: 'pingfang', label: 'PingFang' },
          { value: 'system-sans', label: 'System Sans' },
          { value: 'serif', label: 'Serif' },
          { value: 'monospace', label: 'Monospace' },
        ]
  ), [locale])
  const documentFontStyle = useMemo<CSSProperties>(() => {
    const fontStack = DOCUMENT_FONT_STACKS[documentFontPreset] ?? DOCUMENT_FONT_STACKS.pingfang
    return {
      '--document-editor-font-family': fontStack,
      '--document-preview-font-family': fontStack,
      '--document-heading-font-family': fontStack,
    } as CSSProperties
  }, [documentFontPreset])

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    const incoming = resolvedContent
    if (typeof incoming !== 'string') return

    if (!hydratedRef.current) {
      hydratedRef.current = true
      lastSavedValueRef.current = incoming
      latestValueRef.current = incoming
      setValue(incoming)
      return
    }

    const previousSavedValue = lastSavedValueRef.current
    lastSavedValueRef.current = incoming
    if (latestValueRef.current === previousSavedValue) {
      latestValueRef.current = incoming
      setValue(incoming)
    }
  }, [resolvedContent])

  useEffect(() => {
    if (documentQuery.data?.content) {
      setFallbackContent(null)
      setFallbackError(null)
    }
  }, [documentQuery.data?.content])

  const isDirty = hydratedRef.current && value !== lastSavedValueRef.current

  useEffect(() => {
    if (!effectiveEditable || !hydratedRef.current || !isDirty || isSavePending) return
    if (hasSaveError && lastAttemptedSaveRef.current === latestValueRef.current) return

    const timer = window.setTimeout(() => {
      const nextValue = latestValueRef.current
      lastAttemptedSaveRef.current = nextValue
      saveTextDocument(nextValue, {
        onSuccess: (result) => {
          if (!result) return
          lastSavedValueRef.current = nextValue
          lastAttemptedSaveRef.current = null
        },
      })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [effectiveEditable, hasSaveError, isDirty, isSavePending, saveTextDocument, value])

  useEffect(() => {
    if (typeof resolvedContent === 'string') return
    if (documentQuery.isLoading) return

    let disposed = false

    const readFallbackContent = async () => {
      setIsFallbackLoading(true)
      try {
        const response = await fetch(asset.fileUrl)
        if (!response.ok) {
          throw new Error(`Asset fetch failed: ${response.status}`)
        }
        const text = await response.text()
        if (disposed) return
        setFallbackContent(text.replace(/\r\n?/g, '\n'))
        setFallbackError(null)
      } catch (error) {
        if (disposed) return
        setFallbackError(error instanceof Error ? error.message : 'Asset fallback read failed')
      } finally {
        if (!disposed) {
          setIsFallbackLoading(false)
        }
      }
    }

    void readFallbackContent()
    return () => {
      disposed = true
    }
  }, [asset.fileUrl, documentQuery.isLoading, resolvedContent])

  const encodingLabel = documentQuery.data?.encoding ?? null

  const handleDocumentFontChange = (nextPreset: DocumentFontPreset) => {
    const previousPreset = documentFontPreset
    setDocumentFontPreset(nextPreset)
    void persistSettingsPatch({ documentFontPreset: nextPreset }).catch((error) => {
      console.error('[text-document] Failed to persist document font preset.', error)
      setDocumentFontPreset(previousPreset)
    })
  }

  const handleDocumentEditorColorModeToggle = () => {
    const nextMode: DocumentEditorColorMode = editorColorMode === 'dark' ? 'light' : 'dark'
    const previousPreference = colorModePreference
    // Optimistic local update first — survives hydrate races / stale main process.
    setColorModePreference(nextMode)
    writeStoredDocumentEditorColorMode(nextMode)
    setDocumentEditorColorMode(nextMode)
    void api.settings.update({ documentEditorColorMode: nextMode }).then((settings: any) => {
      if (settings.documentEditorColorMode === nextMode) {
        setDocumentEditorColorMode(nextMode)
        return
      }
      // Main process ignored the key (stale build) — keep local preference.
    }).catch((error: any) => {
      console.error('[text-document] Failed to persist document editor color mode.', error)
      setColorModePreference(previousPreference)
      writeStoredDocumentEditorColorMode(previousPreference)
      setDocumentEditorColorMode(previousPreference)
    })
  }

  if ((documentQuery.isLoading || isFallbackLoading) && !hydratedRef.current) {
    return (
      <div className={cn('flex h-full min-h-0 items-center justify-center bg-[color:var(--document-surface-bg)] text-sm text-muted-foreground', className)}>
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>Loading document…</span>
        </div>
      </div>
    )
  }

  if (typeof resolvedContent !== 'string' && !documentQuery.isLoading) {
    const detail = fallbackError ?? queryErrorMessage
    return (
      <div className={cn('flex h-full min-h-0 items-center justify-center bg-[color:var(--document-surface-bg)] text-sm text-destructive', className)}>
        <div className="flex max-w-[560px] flex-col items-center gap-2 px-6 text-center">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Document content is unavailable.</span>
          </div>
          {detail ? <div className="text-[12px] leading-5 text-destructive/80">{detail}</div> : null}
          {!hasTextReadApi ? (
            <div className="text-[12px] leading-5 text-muted-foreground">
              Restart the Electron app to reload the new text document IPC bridge.
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const colorModeToggleTitle = locale === 'zh'
    ? (editorColorMode === 'dark' ? '切换为浅色编辑器' : '切换为深色编辑器')
    : (editorColorMode === 'dark' ? 'Switch to light editor' : 'Switch to dark editor')

  return (
    <div
      data-color-mode={editorColorMode}
      data-document-color-mode={editorColorMode}
      style={documentFontStyle}
      className={cn('text-document-surface flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--document-surface-bg)]', className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--document-border)] bg-[color:var(--document-header-bg)] px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--document-heading)]">{asset.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--document-muted)]">
            {pageIndicator ? (
              <>
                <span className="font-medium text-[color:var(--document-heading)]">{pageIndicator}</span>
                <span>•</span>
              </>
            ) : null}
            <span>{asset.extension.replace(/^\./, '').toUpperCase()}</span>
            {encodingLabel ? (
              <>
                <span>•</span>
                <span>{encodingLabel.toUpperCase()}</span>
              </>
            ) : null}
            <span>•</span>
            <StatusLabel
              dirty={isDirty}
              isEditable={effectiveEditable}
              hasEditableSource={canEditTextDocument}
              isPending={isSavePending}
              hasError={hasSaveError}
            />
            {fallbackContent ? (
              <>
                <span>•</span>
                <span className="text-sky-500/90">Asset stream fallback</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor={`document-font-${asset.id}`}>
            {locale === 'zh' ? '文档字体' : 'Document font'}
          </label>
          <select
            id={`document-font-${asset.id}`}
            value={documentFontPreset}
            onChange={(event) => handleDocumentFontChange(event.currentTarget.value as DocumentFontPreset)}
            title={locale === 'zh' ? '文档字体' : 'Document font'}
            className="h-8 rounded-full border border-[color:var(--document-border)] bg-[color:var(--document-shell-bg)] px-3 text-[11px] text-[color:var(--document-text)] outline-none transition hover:border-primary/30 focus:border-primary/40"
          >
            {documentFontOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ModeButton
            active={false}
            title={colorModeToggleTitle}
            onClick={handleDocumentEditorColorModeToggle}
          >
            {editorColorMode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </ModeButton>
          {effectiveEditable ? (
            <>
              <ModeButton active={previewMode === 'edit'} title="Editor" onClick={() => setPreviewMode('edit')}>
                <PencilLine className="h-3.5 w-3.5" />
              </ModeButton>
              <ModeButton active={previewMode === 'live'} title="Split" onClick={() => setPreviewMode('live')}>
                <SplitSquareVertical className="h-3.5 w-3.5" />
              </ModeButton>
              <ModeButton active={previewMode === 'preview'} title="Preview" onClick={() => setPreviewMode('preview')}>
                <Eye className="h-3.5 w-3.5" />
              </ModeButton>
            </>
          ) : null}
          <ModeButton title="退出 (ESC)" onClick={forceClosePreview}>
            <X className="h-3.5 w-3.5" />
          </ModeButton>
          {stageActions ? (
            <>
              <span className="h-5 w-px shrink-0 bg-[color:var(--document-border)]" />
              {stageActions}
            </>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {isMarkdown ? (
          <MarkdownBody
            content={resolvedContent ?? value}
            value={value}
            editable={effectiveEditable}
            previewMode={previewMode}
            editorColorMode={editorColorMode}
            onChange={setValue}
          />
        ) : (
          <PlainTextBody
            extension={normalizedExtension}
            content={resolvedContent ?? value}
            value={value}
            editable={effectiveEditable}
            previewMode={previewMode}
            onChange={setValue}
          />
        )}
      </div>
    </div>
  )
}

function MarkdownBody({
  content,
  value,
  editable,
  previewMode,
  editorColorMode,
  onChange,
}: {
  content: string
  value: string
  editable: boolean
  previewMode: EditorPreviewMode
  editorColorMode: 'light' | 'dark'
  onChange: (nextValue: string) => void
}) {
  if (editable) {
    return (
      <MDEditor
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        preview={previewMode}
        previewOptions={MARKDOWN_PREVIEW_OPTIONS}
        visibleDragbar={false}
        height="100%"
        className="markdown-editor-shell h-full"
        textareaProps={{ placeholder: 'Write Markdown here…' }}
        data-color-mode={editorColorMode}
      />
    )
  }

  return (
    <div className="markdown-preview-shell allow-text-selection h-full overflow-auto bg-[color:var(--document-shell-bg)] px-5 py-4">
      <MDEditor.Markdown
        source={content}
        style={{ whiteSpace: 'pre-wrap', backgroundColor: 'transparent', color: 'var(--document-text)' }}
        remarkPlugins={[remarkGfm]}
      />
    </div>
  )
}

function PlainTextBody({
  extension,
  content,
  value,
  editable,
  previewMode,
  onChange,
}: {
  extension: string
  content: string
  value: string
  editable: boolean
  previewMode: EditorPreviewMode
  onChange: (nextValue: string) => void
}) {
  const preview = useMemo(() => renderPlainTextPreview(content, extension), [content, extension])

  if (!editable) {
    return <div className="text-document-preview-shell allow-text-selection h-full overflow-auto bg-[color:var(--document-shell-bg)] p-5">{preview}</div>
  }

  if (previewMode === 'preview') {
    return <div className="text-document-preview-shell allow-text-selection h-full overflow-auto bg-[color:var(--document-shell-bg)] p-5">{preview}</div>
  }

  if (previewMode === 'edit') {
    return (
      <div className="h-full bg-[color:var(--document-shell-bg)]">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="text-doc-textarea h-full w-full resize-none border-0 bg-transparent px-5 py-4 text-[13px] leading-[1.7] text-[color:var(--document-text)] outline-none"
        />
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-[color:var(--document-shell-bg)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="text-doc-textarea h-full min-h-0 w-full resize-none border-0 bg-transparent px-5 py-4 text-[13px] leading-[1.7] text-[color:var(--document-text)] outline-none lg:border-r lg:border-[color:var(--document-border)]"
      />
      <div className="text-document-preview-shell allow-text-selection min-h-0 overflow-auto p-5">
        {preview}
      </div>
    </div>
  )
}

function renderPlainTextPreview(content: string, extension: string) {
  if (extension === '.csv' || extension === '.tsv') {
    const delimiter = extension === '.csv' ? ',' : '\t'
    const rows = parseDelimitedText(content, delimiter)
    if (rows.length > 0) {
      return (
      <div className="allow-text-selection overflow-auto">
          <table className="text-doc-table min-w-full text-left text-[13px]">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row.join('|')}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
  }

  return (
    <pre className="text-doc-pre allow-text-selection whitespace-pre-wrap break-words text-[13px] leading-[1.75] text-[color:var(--document-text)]">
      {content}
    </pre>
  )
}

function parseDelimitedText(content: string, delimiter: ',' | '\t') {
  const lines = content.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.length > 0).slice(0, 120)
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim())).filter((row) => row.length > 0)
}

function ModeButton({
  active,
  children,
  onClick,
  title,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full border text-[color:var(--document-muted)] transition',
        active
          ? 'border-primary/40 bg-primary/12 text-primary'
          : 'border-[color:var(--document-border)] bg-[color:var(--document-shell-bg)] hover:border-primary/30 hover:bg-primary/10 hover:text-[color:var(--document-heading)]',
      )}
    >
      {children}
    </button>
  )
}

function StatusLabel({
  dirty,
  isEditable,
  hasEditableSource,
  isPending,
  hasError,
}: {
  dirty: boolean
  isEditable: boolean
  hasEditableSource: boolean
  isPending: boolean
  hasError: boolean
}) {
  if (!hasEditableSource) return <span>Preview only</span>
  if (!isEditable) return <span>Read-only preview</span>
  if (hasError) return <span className="text-rose-300">Save failed</span>
  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-200">
        <LoaderCircle className="h-3 w-3 animate-spin" />
        <span>Saving…</span>
      </span>
    )
  }
  if (dirty) return <span className="text-amber-200">Unsaved changes</span>
  return (
    <span className="inline-flex items-center gap-1 text-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      <span>Saved</span>
    </span>
  )
}

function normalizeExtension(extension: string) {
  return `.${extension.replace(/^\./, '').toLowerCase()}`
}
