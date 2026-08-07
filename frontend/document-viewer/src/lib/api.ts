import type {
  Asset,
  AssetKind,
  DocumentPreviewSource,
  OfficeDocumentData,
  OfficeDocumentSaveInput,
  OfficeDocumentSaveResult,
  TextDocumentData,
  TextDocumentSaveResult,
} from '../shared/types'

/**
 * Eagle HTTP data-contract adapter. The OrcaBox viewer components consume an
 * `api.preview.*` shape; this module maps those calls to Eagle's Express API
 * (with mechanical contract adaptation only). Eagle's safer file services are
 * reused as-is; no second file read/write layer is introduced.
 *
 * All requests are CORS-enabled on the Eagle backend and originate from the
 * local renderer, so `http://localhost:41695` is the default API base.
 */

declare global {
  interface Window {
    __EAGLE_API_BASE_URL?: string
    __EAGLE_THUMBNAIL_URL?: string
    __EAGLE_EXTENSION_BASE_URL?: string
    eagleDesktop?: {
      item?: {
        reveal?: (id: string) => Promise<unknown>
        copyPath?: (id: string) => Promise<unknown>
        openDefault?: (id: string) => Promise<unknown>
      }
    }
  }
}

const API_BASE = (
  (typeof window !== 'undefined' && window.__EAGLE_API_BASE_URL)
  || 'http://localhost:41695'
).replace(/\/$/, '')

const THUMBNAIL_BASE = (
  (typeof window !== 'undefined' && window.__EAGLE_THUMBNAIL_URL)
  || 'http://localhost:41692'
).replace(/\/$/, '')

const TEXT_DETAIL_PAGE_BYTES = 5 * 1024 * 1024
const TEXT_SAVE_MAX_BYTES = 50 * 1024 * 1024

interface HttpError extends Error {
  code?: string
  status?: number
}

interface Envelope<T> {
  status: string
  message?: string
  code?: string
  data: T
}

async function httpJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  let body: Envelope<T> | null = null
  try {
    body = await response.json() as Envelope<T>
  } catch {
    body = null
  }
  if (!response.ok || !body || body.status !== 'success') {
    const error = new Error((body && body.message) || `Request failed: HTTP ${response.status}`) as HttpError
    error.code = body && body.code
    error.status = response.status
    throw error
  }
  return body.data
}

function thumbnailUrlFromPath(filePath: string | null | undefined): string | null {
  if (!filePath) return null
  return `${THUMBNAIL_BASE}/file/${encodeURIComponent(filePath)}`
}

function kindForExtension(extension: string): AssetKind {
  const normalized = String(extension || '').replace(/^\./, '').toLowerCase()
  const projectLike = new Set([
    'ai', 'ait', 'eps', 'ps', 'sketch', 'xd', 'fig', 'figma',
    'afdesign', 'afphoto', 'afpub', 'indd', 'indl', 'indt', 'idml',
  ])
  return projectLike.has(normalized) ? 'project' : 'document'
}

function mapItemToAsset(item: Record<string, any>): Asset {
  const extension = `.${String(item.ext || '').replace(/^\./, '').toLowerCase()}`
  return {
    id: String(item.id),
    name: String(item.name || item.id || 'Untitled'),
    extension,
    kind: kindForExtension(extension),
    status: item.isDeleted ? 'missing' : 'ready',
    filePath: null,
    fileUrl: '',
    favorite: Number(item.star) > 0,
    thumbnailUrl: thumbnailUrlFromPath(item.thumbnailPath),
  }
}

async function getItem(itemId: string): Promise<Record<string, any>> {
  return httpJson<Record<string, any>>(`/api/v2/item/get?id=${encodeURIComponent(itemId)}`)
}

async function getTextDetailPage(itemId: string, offset: number): Promise<{
  id: string
  ext: string
  mimeType: string
  encoding: string | null
  size: number
  mtimeMs: number
  content: string
  endOffset: number
  totalBytes: number
  hasMore: boolean
}> {
  return httpJson<Record<string, any>>(
    `/api/v2/item/textDetail?id=${encodeURIComponent(itemId)}&offset=${Math.max(0, Math.floor(offset))}&limit=${TEXT_DETAIL_PAGE_BYTES}`,
  ) as Promise<any>
}

export const api = {
  preview: {
    async getTextDocument(assetId: string): Promise<TextDocumentData> {
      const first = await getTextDetailPage(assetId, 0)
      const readonly = first.totalBytes > TEXT_SAVE_MAX_BYTES

      let content = first.content
      if (!readonly) {
        let offset = first.endOffset
        let guard = 0
        while (offset < first.totalBytes) {
          if (guard >= 64) break
          guard += 1
          const page = await getTextDetailPage(assetId, offset)
          content += page.content
          offset = page.endOffset
          if (offset <= 0 || offset >= first.totalBytes) break
          if (!page.hasMore && page.endOffset >= page.totalBytes) break
        }
      }

      return {
        assetId: first.id,
        filePath: null,
        extension: `.${first.ext}`,
        mimeType: first.mimeType,
        encoding: first.encoding,
        content,
        mtimeMs: first.mtimeMs,
        readonly,
      }
    },

    async saveTextDocument(assetId: string, content: string, expectedMtimeMs: number): Promise<TextDocumentSaveResult> {
      const result = await httpJson<Record<string, any>>('/api/v2/item/textSave', {
        method: 'POST',
        body: JSON.stringify({ id: assetId, content, expectedMtimeMs }),
      })
      return { assetId, mtimeMs: Number(result.mtimeMs) || Date.now() }
    },

    async refreshThumbnail(assetId: string): Promise<string | null> {
      try {
        const result = await httpJson<Record<string, any>>('/api/v2/item/refreshThumbnail', {
          method: 'POST',
          body: JSON.stringify({ id: assetId }),
        })
        return thumbnailUrlFromPath(result.path) ?? thumbnailUrlFromPath(result.thumbnailPath)
      } catch {
        return null
      }
    },

    async getOfficeDocument(assetId: string): Promise<OfficeDocumentData | null> {
      return httpJson<OfficeDocumentData | null>(`/api/v2/item/officeDocument?id=${encodeURIComponent(assetId)}`)
    },

    async saveOfficeDocument(assetId: string, input: OfficeDocumentSaveInput, expectedMtimeMs: number): Promise<OfficeDocumentSaveResult> {
      const result = await httpJson<Record<string, any>>('/api/v2/item/officeSave', {
        method: 'POST',
        body: JSON.stringify({ id: assetId, expectedMtimeMs, ...input }),
      })
      return { assetId, mtimeMs: Number(result.mtimeMs) || Date.now() }
    },

    async getDocumentPreviewSource(assetId: string): Promise<DocumentPreviewSource | null> {
      return httpJson<DocumentPreviewSource | null>(`/api/v2/item/documentPreviewSource?id=${encodeURIComponent(assetId)}`)
    },
  },

  asset: {
    async get(id: string): Promise<Asset | null> {
      const item = await getItem(id)
      return mapItemToAsset(item)
    },

    async updateFavorite(id: string, favorite: boolean): Promise<Asset | null> {
      const item = await httpJson<Record<string, any>>('/api/v2/item/update', {
        method: 'POST',
        body: JSON.stringify({ id, star: favorite ? 5 : 0 }),
      })
      return mapItemToAsset(item)
    },

    async reveal(id: string): Promise<boolean> {
      if (window.eagleDesktop?.item?.reveal) {
        return Boolean(await window.eagleDesktop.item.reveal(id))
      }
      return false
    },

    async copyPath(id: string): Promise<boolean> {
      if (window.eagleDesktop?.item?.copyPath) {
        return Boolean(await window.eagleDesktop.item.copyPath(id))
      }
      return false
    },

    async open(id: string): Promise<boolean> {
      if (window.eagleDesktop?.item?.openDefault) {
        return Boolean(await window.eagleDesktop.item.openDefault(id))
      }
      return false
    },
  },

  settings: {
    async update(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
      try {
        const previous = window.localStorage.getItem('eagle.document-viewer.settings')
        const merged = { ...(previous ? JSON.parse(previous) : {}), ...patch }
        window.localStorage.setItem('eagle.document-viewer.settings', JSON.stringify(merged))
      } catch {
        // Ignore storage failures; preferences stay in-memory for the session.
      }
      return patch
    },
  },
}

export type EagleDocumentViewerApi = typeof api
