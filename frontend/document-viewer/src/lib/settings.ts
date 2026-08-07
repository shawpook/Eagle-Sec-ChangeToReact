import { api } from './api'
import { useUIStore } from '../stores/ui-store'
import type { DocumentEditorColorMode, DocumentFontPreset } from '../shared/types'

/**
 * Document preference persistence. OrcaBox persisted via the main-process
 * settings service; the Eagle viewer writes to its own localStorage namespace
 * so the two projects never overwrite each other on a shared dev origin.
 */
export async function persistSettingsPatch(patch: Partial<Record<string, unknown>>) {
  const store = useUIStore.getState()
  if ('documentFontPreset' in patch && patch.documentFontPreset) {
    store.setDocumentFontPreset(patch.documentFontPreset as DocumentFontPreset)
  }
  if ('documentEditorColorMode' in patch && patch.documentEditorColorMode) {
    store.setDocumentEditorColorMode(patch.documentEditorColorMode as DocumentEditorColorMode)
  }
  await api.settings.update(patch)
  return patch
}
