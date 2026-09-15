// Eagle document-viewer local types.
// These are converged from the OrcaBox component consumption points and the
// migrated backend service return values. They intentionally stay local to the
// isolated viewer instead of propagating the source project's global `any`.

export type PreviewMode = 'workspace' | 'fullscreen'

export type Locale = 'zh' | 'en'

export type AppTheme = 'dark' | 'light' | 'system'

export type DocumentFontPreset = 'pingfang' | 'system-sans' | 'serif' | 'monospace'

export type DocumentEditorColorMode = 'light' | 'dark' | 'auto'

export type AssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'font'
  | 'archive'
  | 'document'
  | 'project'
  | '3d-model'
  | 'lottie'

export type AssetStatus = 'ready' | 'missing'

export interface Asset {
  id: string
  name: string
  extension: string
  kind: AssetKind
  status: AssetStatus
  filePath: string | null
  fileUrl: string
  favorite: boolean
  thumbnailUrl: string | null
  [key: string]: unknown
}

export interface TextDocumentData {
  assetId: string
  filePath: string | null
  extension: string
  mimeType: string
  encoding: string | null
  content: string
  mtimeMs: number
  /** True when the file exceeds Eagle's save ceiling and must stay read-only. */
  readonly?: boolean
  /** True when aggregation was capped and `content` is a partial preview. */
  truncated?: boolean
}

export interface TextDocumentSaveResult {
  assetId: string
  mtimeMs: number
}

export type OfficeDocumentReaderKind = 'docx' | 'xlsx' | 'pptx'

export interface OfficeDocumentBlockData {
  id: string
  level: number
  text: string
}

export interface OfficeDocumentSheetData {
  name: string
  rowCount: number
  columnCount: number
  previewRows: string[][]
}

export interface OfficeDocumentSlideData {
  index: number
  title: string | null
  texts: string[]
  backgroundColor: string | null
}

export interface OfficeDocumentEmbeddedImage {
  id: string
  dataUrl: string
  mimeType: string
  width: number | null
  height: number | null
  title: string | null
  altText: string | null
  group: string | null
}

export interface OfficeDocumentData {
  assetId: string
  filePath: string | null
  extension: string
  readerKind: OfficeDocumentReaderKind
  title: string | null
  backgroundColor: string | null
  html?: string | null
  blocks?: OfficeDocumentBlockData[]
  sheets?: OfficeDocumentSheetData[]
  slides?: OfficeDocumentSlideData[]
  images?: OfficeDocumentEmbeddedImage[]
  warnings: string[]
  mtimeMs: number
  [key: string]: unknown
}

export interface OfficeDocumentSaveInput {
  readerKind: OfficeDocumentReaderKind
  blocks?: OfficeDocumentBlockData[]
  sheets?: OfficeDocumentSheetData[]
  slides?: OfficeDocumentSlideData[]
}

export interface OfficeDocumentSaveResult {
  assetId: string
  mtimeMs: number
}

export interface DocumentPreviewSource {
  assetId: string
  kind: 'pdf'
  url: string
  mimeType: string
  derived: boolean
}
