import type { FormEvent } from 'react'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, successClass } from '../../shared/form-styles'
import type { WorkspaceFields } from './api'

export function WorkspaceForm({
  initial,
  onSubmit,
  onCancel,
  pending,
  error,
  saved = false,
}: {
  initial?: WorkspaceFields
  onSubmit: (fields: WorkspaceFields) => void
  onCancel?: () => void
  pending: boolean
  error: Error | null
  saved?: boolean
}) {
  const buttonText = initial ? 'Save settings' : 'Create workspace'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    onSubmit({ name: String(form.get('name') ?? ''), description: String(form.get('description') ?? '') })
  }

  return (
    <form className="mt-5" onSubmit={submit}>
      <fieldset className="space-y-4" disabled={pending}>
        <label className="block text-sm font-medium">
          Workspace name
          <input className={fieldClass} name="name" defaultValue={initial?.name} required minLength={2} maxLength={100} />
        </label>
        <label className="block text-sm font-medium">
          Description <span className="font-normal text-slate-500">(optional)</span>
          <textarea className={fieldClass} name="description" defaultValue={initial?.description} rows={4} maxLength={500} />
        </label>
        {error && <p className={errorClass} role="alert">{apiErrorMessage(error)}</p>}
        {saved && <p className={successClass} role="status">Workspace updated.</p>}
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-indigo-700 px-4 py-2.5 font-medium text-white hover:bg-indigo-800 disabled:opacity-65">
            {pending ? (initial ? 'Saving…' : 'Creating…') : buttonText}
          </button>
          {onCancel && (
            <button type="button" className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium hover:bg-slate-50" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  )
}
