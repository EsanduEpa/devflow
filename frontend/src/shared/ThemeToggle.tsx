import { Moon, Sun } from 'lucide-react'
import type { Theme } from './theme'

export function ThemeToggle({ theme, onToggle, compact = false }: { theme: Theme; onToggle: () => void; compact?: boolean }) {
  const dark = theme === 'dark'
  const Icon = dark ? Moon : Sun
  return (
    <button type="button" className={compact ? 'ui-button ui-secondary px-2 sm:px-3' : 'nav-item'}
      aria-label={`Switch to Studio ${dark ? 'Light' : 'Dark'}`} title={`Studio ${dark ? 'Dark' : 'Light'}`} onClick={onToggle}>
      <Icon size={16} aria-hidden="true" />
      <span className={compact ? 'hidden sm:inline' : undefined}>Studio {dark ? 'Dark' : 'Light'}</span>
    </button>
  )
}
