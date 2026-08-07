import { useEffect, useState } from 'react'
import type { AppTheme } from '@shared/types'

export type SystemTheme = Extract<AppTheme, 'dark' | 'light'>

export const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function getSystemLightDarkTheme(): SystemTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches ? 'dark' : 'light'
}

export function useSystemLightDarkTheme() {
  const [systemTheme, setSystemTheme] = useState<SystemTheme>(() => getSystemLightDarkTheme())

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY)
    const update = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    update()

    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return systemTheme
}
