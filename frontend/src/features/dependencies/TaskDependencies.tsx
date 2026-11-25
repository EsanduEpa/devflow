import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { Badge, LoadingState } from '../../shared/ui'
import { projectKeys } from '../projects/api'
import { listTaskPage, taskKey, taskListKey } from '../tasks/api'
import { taskStatusLabels, taskStatusTones } from '../tasks/task-labels'
import { changeTaskDependency, dependencyKeys, getTaskDependencies, type RelatedTask } from './api'

function RelatedTasks({ title, tasks, pending, onRemove }: {
  title: string
  tasks: RelatedTask[]
  pending: boolean
  onRemove?: (id: string) => void
}) {
  const heading = useId()
  return <section className="space-y-2" aria-labelledby={heading}>
    <h3 id={heading} className="text-sm font-semibold">{title}</h3>
    {tasks.length === 0 ? <p className="text-sm text-secondary">None</p> : <ul className="divide-y divide-line">
      {tasks.map(({ id, title, status }) => <li key={id} className="flex min-w-0 flex-wrap items-center gap-2 py-2">
        <Link className={`${linkClass} min-w-0 flex-1 basis-32 break-words`} to={`/tasks/${id}`}>{title}</Link>
        <Badge tone={taskStatusTones[status]}>{taskStatusLabels[status]}</Badge>
        {onRemove && <button type="button" className="ui-button ui-secondary" aria-label={`Remove prerequisite ${title}`}
          onClick={() => onRemove(id)} disabled={pending}>Remove</button>}
      </li>)}
    </ul>}
  </section>
}

function PrerequisitePicker({ taskId, projectId, userId, prerequisites, onAdd, pending }: {
  taskId: string
  projectId: string
  userId: string
  prerequisites: RelatedTask[]
  onAdd: (id: string) => void
  pending: boolean
}) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  const candidates = useQuery({
    queryKey: taskListKey(userId, projectId, params.toString()),
    queryFn: ({ signal }) => listTaskPage(projectId, params, signal), retry: false,
  })
  const linked = new Set(prerequisites.map(({ id }) => id))
  const rows = candidates.data?.data.filter(({ id }) => id !== taskId && !linked.has(id)) ?? []

  return <div className="space-y-3 border-t border-line pt-3">
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
      event.preventDefault()
      const value = new FormData(event.currentTarget).get('search')
      setSearch(typeof value === 'string' ? value.trim() : '')
      setPage(1)
    }}>
      <label className="min-w-0 flex-1 basis-48 text-sm font-medium">Find a prerequisite
        <input type="search" name="search" className={fieldClass} maxLength={200} autoFocus />
      </label>
      <button type="submit" className="ui-button ui-secondary">Search tasks</button>
    </form>
    {candidates.isPending && <LoadingState>Loading tasks…</LoadingState>}
    {candidates.isError && <div className="space-y-2">
      <p role="alert" className={errorClass}>{apiErrorMessage(candidates.error)}</p>
      <button type="button" className="ui-button ui-secondary" onClick={() => void candidates.refetch()}>Retry loading tasks</button>
    </div>}
    {candidates.isSuccess && <>
      {rows.length === 0 && <p className="text-sm text-secondary">No available tasks on this page.</p>}
      <ul className="divide-y divide-line" aria-label="Available prerequisites">
        {rows.map(({ id, title, status }) => <li key={id} className="flex min-w-0 flex-wrap items-center gap-2 py-2">
          <span className="min-w-0 flex-1 basis-32 break-words text-sm">{title}</span>
          <Badge tone={taskStatusTones[status]}>{taskStatusLabels[status]}</Badge>
          <button type="button" className="ui-button ui-secondary" aria-label={`Add prerequisite ${title}`}
            disabled={pending} onClick={() => onAdd(id)}>Add</button>
        </li>)}
      </ul>
      {(page > 1 || candidates.data.pagination.totalPages > 1) && <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
        <button type="button" className="ui-button ui-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous tasks</button>
        <span>Page {page} of {Math.max(candidates.data.pagination.totalPages, 1)}</span>
        <button type="button" className="ui-button ui-secondary" disabled={page >= candidates.data.pagination.totalPages}
          onClick={() => setPage(page + 1)}>Next tasks</button>
      </div>}
    </>}
  </div>
}

export function TaskDependencies({ taskId, projectId, userId, editable }: {
  taskId: string; projectId: string; userId: string; editable: boolean
}) {
  const heading = useId()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const links = useQuery({
    queryKey: dependencyKeys.task(userId, projectId, taskId),
    queryFn: ({ signal }) => getTaskDependencies(taskId, signal), retry: false, gcTime: 0,
  })
  const change = useMutation({
    mutationFn: ({ prerequisiteId, add }: { prerequisiteId: string; add: boolean }) => changeTaskDependency(taskId, prerequisiteId, add),
    onSuccess: () => client.invalidateQueries({ queryKey: dependencyKeys.project(userId, projectId) }),
    onError: async (error) => {
      if (!(error instanceof ApiError)) return
      if (error.status === 404) {
        await Promise.all([
          client.invalidateQueries({ queryKey: taskKey(userId, taskId) }),
          client.invalidateQueries({ queryKey: dependencyKeys.project(userId, projectId) }),
          client.invalidateQueries({ queryKey: ['tasks', userId, 'list', projectId] }),
        ])
      }
      if (error.status === 409) {
        await Promise.all([
          client.invalidateQueries({ queryKey: dependencyKeys.project(userId, projectId) }),
          client.invalidateQueries({ queryKey: projectKeys.details(userId, projectId) }),
        ])
      }
    },
  })

  return <section className="ui-panel min-w-0 space-y-4" aria-labelledby={heading}>
    <div className="flex flex-wrap items-center gap-2">
      <h2 id={heading} className="text-base font-semibold">Dependencies</h2>
      {links.isSuccess && links.data.blocked && <Badge tone="warning">Blocked</Badge>}
    </div>
    {links.isPending && <LoadingState>Loading dependencies…</LoadingState>}
    {links.isError && <div className="space-y-2">
      <p role="alert" className={errorClass}>{apiErrorMessage(links.error)}</p>
      <button type="button" className="ui-button ui-secondary" onClick={() => void links.refetch()}>Retry loading dependencies</button>
    </div>}
    {change.isError && <p role="alert" className={errorClass}>{apiErrorMessage(change.error)}</p>}
    {links.isSuccess && <>
      <RelatedTasks title="Prerequisites" tasks={links.data.prerequisites} pending={change.isPending}
        onRemove={editable ? (prerequisiteId) => change.mutate({ prerequisiteId, add: false }) : undefined} />
      <RelatedTasks title="Dependent tasks" tasks={links.data.dependents} pending={change.isPending} />
      {editable && <button type="button" className="ui-button ui-secondary" aria-expanded={open}
        onClick={() => { change.reset(); setOpen(!open) }} disabled={change.isPending}>
        {open ? 'Close task picker' : 'Add prerequisite'}
      </button>}
      {editable && open && <PrerequisitePicker taskId={taskId} projectId={projectId} userId={userId}
        prerequisites={links.data.prerequisites} pending={change.isPending}
        onAdd={(prerequisiteId) => change.mutate({ prerequisiteId, add: true })} />}
    </>}
  </section>
}
