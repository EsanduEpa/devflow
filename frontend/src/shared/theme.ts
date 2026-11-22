export type Theme = 'light' | 'dark'
const storageKey = 'devflow.theme'

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Theme still works for the current visit. */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme, save = false) {
  document.documentElement.dataset.theme = theme
  if (save) {
    try { localStorage.setItem(storageKey, theme) } catch { /* Storage is optional. */ }
  }
}
