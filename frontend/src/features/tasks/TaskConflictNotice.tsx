import { useId, type ReactNode } from 'react'
import { apiErrorMessage } from '../../shared/api'
import { errorClass } from '../../shared/form-styles'
import { LoadingState } from '../../shared/ui'

export function TaskConflictNotice({ message, pending, error, reload, children }: {
  message: string
  pending: boolean
  error: unknown
  reload: () => void
  children?: ReactNode
}) {
  const heading = useId()
  return <section className="space-y-3 rounded-lg border border-line bg-warning-surface p-3" aria-labelledby={heading}>
    <div role="status">
      <h3 id={heading} className="text-sm font-semibold text-warning">Task changed</h3>
      <p className="text-sm text-ink">{message}</p>
    </div>
    {pending && <LoadingState>Loading the latest task…</LoadingState>}
    {!!error && <div className="space-y-2">
      <p role="alert" className={errorClass}>{apiErrorMessage(error)}</p>
      <button className="ui-button ui-secondary" type="button" onClick={reload}>Reload latest task</button>
    </div>}
    {children}
  </section>
}
