import { useId } from 'react'
import { ApiError } from './api'

export function useFieldErrors(error: unknown) {
  const id = useId()
  const messages = error instanceof ApiError ? error.fields : {}
  return {
    props(name: string, helpId?: string) {
      const errorId = messages[name] && `${id}-${name}`
      return { 'aria-invalid': errorId ? true as const : undefined, 'aria-describedby': [helpId, errorId].filter(Boolean).join(' ') || undefined }
    },
    message(name: string) {
      return messages[name] && <span id={`${id}-${name}`} className="mt-1 block text-xs text-danger">{messages[name]}</span>
    },
  }
}
