import { ChevronLeft, ChevronRight } from 'lucide-react'
import { apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass } from '../../shared/form-styles'
import { Badge } from '../../shared/ui'
import type { Sprint } from './api'

const sprintLabels = { PLANNED: 'Planned', ACTIVE: 'Active', COMPLETED: 'Completed' } as const
const sprintTones = { PLANNED: 'neutral', ACTIVE: 'accent', COMPLETED: 'success' } as const

export function SprintBadge({ sprint }: { sprint: Sprint }) {
  return <Badge tone={sprintTones[sprint.status]}>{sprintLabels[sprint.status]}</Badge>
}

export function SprintDates({ sprint }: { sprint: Sprint }) {
  return <p className="text-sm text-secondary">{formatDateOnly(sprint.startDate)} – {formatDateOnly(sprint.endDate)}</p>
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  if (total <= 1 && page === 1) return null
  return <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-secondary">
    <button className="ui-button ui-secondary" type="button" disabled={page === 1} onClick={() => onPage(page - 1)}>
      <ChevronLeft size={16} aria-hidden="true" />Previous
    </button>
    <span>Page {page} of {Math.max(total, 1)}</span>
    <button className="ui-button ui-secondary" type="button" disabled={page >= total} onClick={() => onPage(page + 1)}>
      Next<ChevronRight size={16} aria-hidden="true" />
    </button>
  </div>
}

export function SprintLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <div className="space-y-3">
    <p role="alert" className={errorClass}>{apiErrorMessage(error)}</p>
    <button className="ui-button ui-secondary" type="button" onClick={onRetry}>Try again</button>
  </div>
}
