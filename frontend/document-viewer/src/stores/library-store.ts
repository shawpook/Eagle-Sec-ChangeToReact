import { create } from 'zustand'

interface LibrarySummary {
  path: string
}

interface DocumentViewerLibraryState {
  library: LibrarySummary | null
  setLibraryPath: (path: string | null) => void
}

/**
 * Minimal library context slice. The Eagle AngularJS shell owns the real
 * library; the viewer only needs a stable `path` string so react-query keys
 * (and cache invalidation) behave identically to OrcaBox.
 */
export const useLibraryStore = create<DocumentViewerLibraryState>((set) => ({
  library: null,
  setLibraryPath: (path) => set({ library: path ? { path } : null }),
}))
