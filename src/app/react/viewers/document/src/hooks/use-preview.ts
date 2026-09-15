import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { pushCoalescedHistoryAction } from '../lib/action-history'
import { useLibraryStore } from '../stores/library-store'
import type {
  OfficeDocumentData,
  OfficeDocumentSaveInput,
} from '../shared/types'

/**
 * Document query/save hooks migrated from OrcaBox `use-preview.ts`.
 * Only the document-source, text and Office slices are kept; thumbnail
 * batching, media playback, waveforms and image-edit hooks are not part of
 * this migration.
 */

export function usePreviewDocumentSource(assetId: string | null, enabled = true) {
  const libraryPath = useLibraryStore((s) => s.library?.path ?? 'no-library')
  return useQuery({
    queryKey: ['preview', 'document-source', libraryPath, assetId],
    queryFn: () => api.preview.getDocumentPreviewSource(assetId!),
    enabled: enabled && assetId !== null && libraryPath !== 'no-library',
    staleTime: 1000 * 60 * 5,
  })
}

export function usePreviewMarkdownDocument(assetId: string | null, enabled = true) {
  return usePreviewTextDocument(assetId, enabled)
}

export function usePreviewTextDocument(assetId: string | null, enabled = true) {
  const libraryPath = useLibraryStore((s) => s.library?.path ?? 'no-library')
  return useQuery({
    queryKey: ['preview', 'text-document', libraryPath, assetId],
    queryFn: () => api.preview.getTextDocument(assetId!),
    enabled: enabled && assetId !== null && libraryPath !== 'no-library',
    staleTime: 1000 * 30,
  })
}

export function usePreviewOfficeDocument(assetId: string | null, enabled = true) {
  const libraryPath = useLibraryStore((s) => s.library?.path ?? 'no-library')
  return useQuery({
    queryKey: ['preview', 'office-document', libraryPath, assetId],
    queryFn: () => api.preview.getOfficeDocument(assetId!),
    enabled: enabled && assetId !== null && libraryPath !== 'no-library',
    staleTime: 1000 * 60 * 5,
  })
}

export function useSavePreviewOfficeDocument(assetId: string | null) {
  const queryClient = useQueryClient()
  const libraryPath = useLibraryStore((s) => s.library?.path ?? 'no-library')
  return useMutation({
    mutationFn: async (input: OfficeDocumentSaveInput) => {
      if (!assetId) throw new Error('Missing office document asset id')
      const previousDocument = queryClient.getQueryData<OfficeDocumentData | null>([
        'preview',
        'office-document',
        libraryPath,
        assetId,
      ]) ?? await api.preview.getOfficeDocument(assetId)
      const result = await api.preview.saveOfficeDocument(assetId, input, previousDocument?.mtimeMs ?? Date.now())
      if (!result) {
        throw new Error('Office document save failed')
      }
      return {
        result,
        input,
        previousInput: previousDocument ? officeDocumentToSaveInput(previousDocument) : null,
      }
    },
    onSuccess: async ({ result, input, previousInput }) => {
      if (!assetId) return
      if (previousInput && !areOfficeDocumentInputsEqual(previousInput, input)) {
        pushCoalescedHistoryAction({
          context: {
            kind: 'preview',
            label: 'Edit office document',
            coalesceKey: `office-document:${libraryPath}:${assetId}`,
          },
          undo: async () => {
            await api.preview.saveOfficeDocument(assetId, previousInput, Date.now())
            await refreshOfficeDocumentQueries(queryClient, libraryPath, assetId)
          },
          redo: async () => {
            await api.preview.saveOfficeDocument(assetId, input, Date.now())
            await refreshOfficeDocumentQueries(queryClient, libraryPath, assetId)
          },
        })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['preview', 'office-document', libraryPath, assetId] }),
        queryClient.invalidateQueries({ queryKey: ['preview', 'document-source', libraryPath, assetId] }),
        queryClient.invalidateQueries({ queryKey: ['preview', 'thumbnail', libraryPath, assetId] }),
        queryClient.invalidateQueries({ queryKey: ['asset'] }),
        queryClient.invalidateQueries({ queryKey: ['assets'] }),
      ])
      queryClient.setQueryData(['preview', 'office-document', libraryPath, assetId], (current: { mtimeMs?: number } | null | undefined) => (
        current ? { ...current, mtimeMs: result.mtimeMs } : current
      ))
    },
  })
}

export function useSavePreviewTextDocument(assetId: string | null) {
  const queryClient = useQueryClient()
  const libraryPath = useLibraryStore((s) => s.library?.path ?? 'no-library')
  return useMutation({
    mutationFn: async (content: string) => {
      if (!assetId) throw new Error('Missing text document asset id')
      const previous = await api.preview.getTextDocument(assetId)
      const result = await api.preview.saveTextDocument(assetId, content, previous.mtimeMs)
      if (!result) {
        throw new Error('Text document save failed')
      }
      return { assetId, content, previous, result }
    },
    onSuccess: async ({ assetId: savedAssetId, content, previous, result }) => {
      if (!assetId) return

      if (previous && previous.content !== content) {
        pushCoalescedHistoryAction({
          context: {
            kind: 'preview',
            label: 'Edit text document',
            coalesceKey: `text-document:${libraryPath}:${savedAssetId}`,
          },
          undo: async () => {
            await api.preview.saveTextDocument(savedAssetId, previous.content, Date.now())
            await refreshTextDocumentQueries(queryClient, libraryPath, savedAssetId)
          },
          redo: async () => {
            await api.preview.saveTextDocument(savedAssetId, content, Date.now())
            await refreshTextDocumentQueries(queryClient, libraryPath, savedAssetId)
          },
        })
      }

      queryClient.setQueryData(['preview', 'text-document', libraryPath, savedAssetId], (current: { content?: string } | null | undefined) => {
        if (!current) return current
        return {
          ...current,
          mtimeMs: result.mtimeMs,
        }
      })

      const thumbnailUrl = await api.preview.refreshThumbnail(assetId)
      queryClient.setQueryData(['preview', 'thumbnail', libraryPath, assetId], thumbnailUrl)

      await refreshTextDocumentQueries(queryClient, libraryPath, savedAssetId)
    },
  })
}

export function useSavePreviewMarkdownDocument(assetId: string | null) {
  return useSavePreviewTextDocument(assetId)
}

async function refreshTextDocumentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  libraryPath: string,
  assetId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['preview', 'text-document', libraryPath, assetId] }),
    queryClient.invalidateQueries({ queryKey: ['preview', 'thumbnail', libraryPath, assetId] }),
    queryClient.invalidateQueries({ queryKey: ['asset'] }),
    queryClient.invalidateQueries({ queryKey: ['assets'] }),
  ])
}

function officeDocumentToSaveInput(document: OfficeDocumentData): OfficeDocumentSaveInput {
  if (document.readerKind === 'docx') {
    return { readerKind: 'docx', blocks: document.blocks ?? [] }
  }
  if (document.readerKind === 'xlsx') {
    return { readerKind: 'xlsx', sheets: document.sheets ?? [] }
  }
  return { readerKind: 'pptx', slides: document.slides ?? [] }
}

function areOfficeDocumentInputsEqual(left: OfficeDocumentSaveInput, right: OfficeDocumentSaveInput) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function refreshOfficeDocumentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  libraryPath: string,
  assetId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['preview', 'office-document', libraryPath, assetId] }),
    queryClient.invalidateQueries({ queryKey: ['preview', 'document-source', libraryPath, assetId] }),
    queryClient.invalidateQueries({ queryKey: ['preview', 'thumbnail', libraryPath, assetId] }),
    queryClient.invalidateQueries({ queryKey: ['asset'] }),
    queryClient.invalidateQueries({ queryKey: ['assets'] }),
  ])
}
