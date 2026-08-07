import { create } from 'zustand'
import type {
  AppTheme,
  DocumentEditorColorMode,
  DocumentFontPreset,
  Locale,
  PreviewMode,
} from '../shared/types'

/**
 * Preview + document-preference state slice migrated from OrcaBox ui-store.
 * Only the fields the document workspace consumes are kept; the full app UI
 * store is intentionally not copied so Eagle's AngularJS shell stays the
 * single source of truth for its own UI state.
 */
interface DocumentViewerUIState {
  locale: Locale
  theme: AppTheme
  documentFontPreset: DocumentFontPreset
  documentEditorColorMode: DocumentEditorColorMode
  followSystemTheme: boolean

  previewAssetId: string | null
  previewMode: PreviewMode | null
  previewReturnMode: PreviewMode | null
  selectedAssetId: string | null
  visibleAssetIds: string[]

  setTheme: (theme: AppTheme) => void
  setDocumentFontPreset: (preset: DocumentFontPreset) => void
  setDocumentEditorColorMode: (mode: DocumentEditorColorMode) => void
  setFollowSystemTheme: (enabled: boolean) => void
  setLocale: (locale: Locale) => void

  openPreview: (id: string, mode?: PreviewMode, returnMode?: PreviewMode | null) => void
  setPreviewMode: (mode: PreviewMode, returnMode?: PreviewMode | null) => void
  closePreview: () => void
  forceClosePreview: () => void
  selectAsset: (id: string | null) => void
  setVisibleAssetIds: (ids: string[]) => void
}

export const useUIStore = create<DocumentViewerUIState>((set) => ({
  locale: 'zh',
  theme: 'dark',
  documentFontPreset: 'pingfang',
  documentEditorColorMode: 'auto',
  followSystemTheme: false,

  previewAssetId: null,
  previewMode: null,
  previewReturnMode: null,
  selectedAssetId: null,
  visibleAssetIds: [],

  setTheme: (theme) => set({ theme }),
  setDocumentFontPreset: (documentFontPreset) => set({ documentFontPreset }),
  setDocumentEditorColorMode: (documentEditorColorMode) => set({ documentEditorColorMode }),
  setFollowSystemTheme: (followSystemTheme) => set({ followSystemTheme }),
  setLocale: (locale) => set({ locale }),

  openPreview: (id, mode = 'workspace', returnMode = null) => set((state) => ({
    previewAssetId: id,
    previewMode: mode,
    previewReturnMode: returnMode,
    selectedAssetId: id,
  })),
  setPreviewMode: (mode, returnMode = null) => set((state) => (
    state.previewAssetId
      ? { previewMode: mode, previewReturnMode: returnMode }
      : state
  )),
  closePreview: () => set((state) => {
    if (state.previewMode === 'fullscreen' && state.previewReturnMode) {
      return {
        previewMode: state.previewReturnMode,
        previewReturnMode: null,
      }
    }
    return {
      previewAssetId: null,
      previewMode: null,
      previewReturnMode: null,
    }
  }),
  forceClosePreview: () => set({
    previewAssetId: null,
    previewMode: null,
    previewReturnMode: null,
  }),
  selectAsset: (id) => set({ selectedAssetId: id }),
  setVisibleAssetIds: (visibleAssetIds) => set({ visibleAssetIds }),
}))
