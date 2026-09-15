import { useUIStore } from '../stores/ui-store'

export type TranslateFn = (zh: string, en: string) => string

/**
 * Minimal i18n for the migrated surfaces. OrcaBox surfaces receive a
 * `t(zh, en)` helper; Eagle's UI language is Chinese by default and follows
 * the viewer store locale, so a tiny locale-driven picker is sufficient.
 */
export function useI18n() {
  const locale = useUIStore((s) => s.locale)
  return {
    t: ((zh: string, en: string) => (locale === 'zh' ? zh : en)) as TranslateFn,
  }
}
