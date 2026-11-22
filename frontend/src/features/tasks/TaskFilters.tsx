import { useState, type FormEvent } from 'react'
import { ListFilter, Search, X } from 'lucide-react'
import { fieldClass } from '../../shared/form-styles'
import { Badge } from '../../shared/ui'
import type { ProjectMember } from '../projects/api'
import type { TaskPriority, TaskStatus } from './api'
import { taskFilterKeys } from './task-navigation'
import { taskPriorityLabels, taskStatusLabels, taskStatusOrder } from './task-labels'

const pageSizes = ['10', '20', '50', '100']

export function TaskFilters({ filters, members, apply, paginated = false }: {
  filters: URLSearchParams
  members: ProjectMember[]
  apply: (params: URLSearchParams) => void
  paginated?: boolean
}) {
  const [assignee, setAssignee] = useState(filters.get('assigneeId')?.toLowerCase() ?? '')
  const limit = filters.get('limit') ?? '20'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    for (const key of taskFilterKeys) {
      const value = String(form.get(key) ?? '').trim()
      if (value) params.set(key, value)
    }
    const perPage = form.get('limit')
    if (paginated && typeof perPage === 'string' && perPage !== '20') params.set('limit', perPage)
    apply(params)
  }

  const search = filters.get('search')
  const status = filters.get('status') as TaskStatus | null
  const priority = filters.get('priority') as TaskPriority | null
  const assigned = filters.get('assigneeId')?.toLowerCase()
  const active = [search && `Search: ${search}`, status && taskStatusLabels[status], priority && taskPriorityLabels[priority],
    assigned && (assigned === 'unassigned' ? 'Unassigned' : members.find(({ user }) => user.id === assigned)?.user.name ?? 'Selected assignee')]
    .filter(Boolean)

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className={`grid gap-3 sm:grid-cols-2 ${paginated ? 'xl:grid-cols-[minmax(12rem,1.6fr)_repeat(4,minmax(7rem,1fr))]' : 'xl:grid-cols-[minmax(12rem,1.6fr)_repeat(3,minmax(8rem,1fr))]'}`}>
        <label className="block min-w-0 text-sm font-medium">
          Search task titles or ID
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute top-5 left-3 text-secondary" aria-hidden="true" />
            <input type="search" name="search" className={`${fieldClass} pl-9`} maxLength={200}
              placeholder="Title words or full task ID" defaultValue={search ?? ''} />
          </span>
        </label>
        <label className="block min-w-0 text-sm font-medium">
          Status
          <select name="status" className={fieldClass} defaultValue={status ?? ''}>
            <option value="">All statuses</option>
            {taskStatusOrder.map((value) => <option key={value} value={value}>{taskStatusLabels[value]}</option>)}
          </select>
        </label>
        <label className="block min-w-0 text-sm font-medium">
          Priority
          <select name="priority" className={fieldClass} defaultValue={priority ?? ''}>
            <option value="">All priorities</option>
            {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block min-w-0 text-sm font-medium">
          Assignee
          <select name="assigneeId" className={fieldClass} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {assignee && assignee !== 'unassigned' && !members.some(({ user }) => user.id === assignee) && <option value={assignee}>Selected assignee</option>}
            {members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        {paginated && <label className="block min-w-0 text-sm font-medium">
          Tasks per page
          <select name="limit" className={fieldClass} defaultValue={limit}>
            {!pageSizes.includes(limit) && /^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= 100 && <option value={limit}>{limit}</option>}
            {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="ui-button ui-secondary"><ListFilter size={16} aria-hidden="true" />Apply filters</button>
        <button type="button" className="ui-button ui-ghost" onClick={() => apply(new URLSearchParams())}>
          <X size={16} aria-hidden="true" />Clear filters
        </button>
        {!!active.length && <ul aria-label="Applied filters" className="flex min-w-0 flex-wrap gap-1.5">
          {active.map((value, index) => <li className="min-w-0 max-w-full break-words" key={index}><Badge tone="accent">{value}</Badge></li>)}
        </ul>}
      </div>
    </form>
  )
}
