import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { LoaderCircle, Workflow } from 'lucide-react'

export function Brand() {
  return <span className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-ink">
    <span className="flex size-8 items-center justify-center rounded-lg bg-action text-on-action">
      <Workflow size={18} aria-hidden="true" />
    </span>
    DevFlow
  </span>
}

export function PageHeader({ title, description, meta, actions }: {
  title: string
  description?: string
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-60">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="ui-heading break-words">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-2 max-w-3xl break-words whitespace-pre-wrap text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

const badgeTones = {
  neutral: 'bg-muted text-secondary',
  accent: 'bg-selected text-accent-ink',
  success: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-warning',
  danger: 'bg-danger-surface text-danger',
}

export function Badge({ children, tone = 'neutral' }: {
  children: ReactNode
  tone?: keyof typeof badgeTones
}) {
  return <span className={`ui-badge ${badgeTones[tone]}`}>{children}</span>
}

export function LoadingState({ children }: { children: ReactNode }) {
  return <p role="status" className="flex items-center gap-2 py-2 text-sm text-secondary">
    <LoaderCircle size={16} className="animate-spin text-accent-ink" aria-hidden="true" />{children}
  </p>
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-field bg-surface p-5 text-sm text-secondary sm:p-6">
    <div className="flex items-center gap-3 text-ink">
      <span className="ui-icon-box">{icon}</span>
      <p className="font-semibold">{title}</p>
    </div>
    {children && <div className="mt-2 max-w-xl">{children}</div>}
  </div>
}

export function Modal({ labelledBy, className, onClose, children }: {
  labelledBy: string
  className: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      dialog.close()
      requestAnimationFrame(() => {
        if (document.activeElement !== document.body) return
        const next = document.querySelector('dialog[open]')?.querySelector<HTMLElement>('button:not(:disabled)')
          ?? document.getElementById('main-content')
        next?.focus({ preventScroll: true })
      })
    }
  }, [])

  return (
    <dialog ref={ref} aria-labelledby={labelledBy} className={className} onCancel={(event) => {
      event.preventDefault()
      onClose()
    }}>
      {children}
    </dialog>
  )
}

export function ConfirmDialog({ title, children, action, waiting, error, pending, onConfirm, onClose }: {
  title: string
  children: ReactNode
  action: string
  waiting: string
  error?: string
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const id = useId()
  return (
    <Modal labelledBy={id} className="ui-panel fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto text-ink shadow-xl" onClose={() => { if (!pending) onClose() }}>
      <h2 id={id} className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 break-words text-secondary">{children}</div>
      {error && <p className="mt-3 rounded-lg bg-danger-surface p-3 text-danger" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="ui-button ui-secondary" autoFocus disabled={pending} onClick={onClose}>Cancel</button>
        <button type="button" className="ui-button ui-danger-solid" disabled={pending} onClick={onConfirm}>{pending ? waiting : action}</button>
      </div>
    </Modal>
  )
}
