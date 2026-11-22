import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { getProject, listProjectMembers, projectKeys, type Project, type ProjectMember } from '../projects/api'
import { listTaskPage, taskListKey } from './api'
import { taskPriorityLabels, taskStatusLabels, taskStatusOrder } from './task-labels'

const panelClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7'
const buttonClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50'
const primaryButtonClass = 'rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800'
const filterKeys = ['search', 'status', 'priority', 'assigneeId', 'limit']
const pageSizes = ['10', '20', '50', '100']

function TaskFilters({ filters, members, apply }: {
  filters: URLSearchParams
  members: ProjectMember[]
  apply: (params: URLSearchParams) => void
}) {
  const [assignee, setAssignee] = useState(filters.get('assigneeId')?.toLowerCase() ?? '')
  const limit = filters.get('limit') ?? '20'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    for (const key of filterKeys) {
      const value = String(form.get(key) ?? '').trim()
      if (value && (key !== 'limit' || value !== '20')) params.set(key, value)
    }
    apply(params)
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">
        Search task titles or ID
        <input type="search" name="search" className={fieldClass} maxLength={200}
          placeholder="Enter title words or a full task ID" defaultValue={filters.get('search') ?? ''} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm font-medium">
          Status
          <select name="status" className={fieldClass} defaultValue={filters.get('status') ?? ''}>
            <option value="">All statuses</option>
            {taskStatusOrder.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Priority
          <select name="priority" className={fieldClass} defaultValue={filters.get('priority') ?? ''}>
            <option value="">All priorities</option>
            {Object.entries(taskPriorityLabels).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}
          </select>
        </label>
        <label className="block min-w-0 text-sm font-medium">
          Assignee
          <select name="assigneeId" className={fieldClass} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {assignee && assignee !== 'unassigned' && !members.some(({ user }) => user.id === assignee) &&
              <option value={assignee}>Selected assignee</option>}
            {members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Tasks per page
          <select name="limit" className={fieldClass} defaultValue={limit}>
            {!pageSizes.includes(limit) && /^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= 100 &&
              <option value={limit}>{limit}</option>}
            {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className={primaryButtonClass}>Apply filters</button>
        <button type="button" className={buttonClass} onClick={() => apply(new URLSearchParams())}>Clear filters</button>
      </div>
    </form>
  )
}

function TaskList({ project, userId }: { project: Project; userId: string }) {
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const tasks = useQuery({
    queryKey: taskListKey(userId, project.id, query),
    queryFn: ({ signal }) => listTaskPage(project.id, new URLSearchParams(query), signal),
    retry: false,
    gcTime: 0,
  })
  const members = useQuery({
    queryKey: projectKeys.members(userId, project.id),
    queryFn: ({ signal }) => listProjectMembers(project.id, signal),
    retry: false,
    gcTime: 0,
  })
  const names = new Map(members.data?.map(({ user }) => [user.id, user.name]))

  function goToPage(page: number) {
    const next = new URLSearchParams(params)
    if (page === 1) next.delete('page')
    else next.set('page', String(page))
    setParams(next)
  }

  const pagination = tasks.data?.pagination
  const lastPage = Math.max(1, pagination?.totalPages ?? 1)
  const outOfRange = pagination && pagination.page > lastPage

  return (
    <>
      <section className={panelClass} aria-label="Task filters">
        <TaskFilters key={query} filters={params} members={members.data ?? []} apply={setParams} />
        {members.isError && (
          <div className="mt-3 text-sm">
            <p className={errorClass} role="alert">Could not load project members. {apiErrorMessage(members.error)}</p>
            <button className={`mt-2 ${linkClass}`} onClick={() => void members.refetch()}>Retry loading members</button>
          </div>
        )}
      </section>
      <section className={panelClass} aria-labelledby="task-results">
        <h2 id="task-results" className="text-lg font-semibold text-slate-900">Results</h2>
        {tasks.isPending && <p className="mt-3 text-sm" role="status">Loading tasks…</p>}
        {tasks.isError && (
          <div className="mt-3 text-sm">
            <p className={errorClass} role="alert">{apiErrorMessage(tasks.error)}</p>
            <button className={`mt-2 ${linkClass}`} onClick={() => void tasks.refetch()}>Try again</button>
          </div>
        )}
        {tasks.isSuccess && (
          <>
            <p className="mt-1 text-sm text-slate-600" role="status">
              {tasks.data.pagination.total} matching task{tasks.data.pagination.total === 1 ? '' : 's'}
            </p>
            {tasks.data.data.length ? (
              <ul className="mt-3 divide-y divide-slate-200" aria-label="Matching tasks">
                {tasks.data.data.map((task) => (
                  <li key={task.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_1fr_1fr_minmax(0,1fr)_1fr]">
                    <Link to={`/tasks/${task.id}`} className={`break-words ${linkClass}`}>{task.title}</Link>
                    <span>{taskStatusLabels[task.status]}</span>
                    <span>{taskPriorityLabels[task.priority]}</span>
                    <span className="break-words">{task.assigneeId ? names.get(task.assigneeId) ?? 'Unavailable' : 'Unassigned'}</span>
                    <span>{formatDateOnly(task.dueDate)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-slate-700">{outOfRange ? 'This page has no results.' : 'No tasks match your filters.'}</p>}
          </>
        )}
        {pagination && (pagination.page > 1 || pagination.totalPages > 1) && (
          <nav aria-label="Task result pages" className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 text-sm">
            <button className={buttonClass} disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>Previous</button>
            <span>Page {pagination.page} of {lastPage}</span>
            <button className={buttonClass} disabled={pagination.page >= lastPage} onClick={() => goToPage(pagination.page + 1)}>Next</button>
            {outOfRange && <button className={linkClass} onClick={() => goToPage(lastPage)}>Last page</button>}
          </nav>
        )}
      </section>
    </>
  )
}

export function ProjectTaskListPage({ userId }: { userId: string }) {
  const projectId = (useParams().projectId ?? '').toLowerCase()
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
    retry: false,
    gcTime: 0,
  })
  if (project.isPending) return <p role="status">Loading project…</p>
  if (project.isError) {
    const denied = project.error instanceof ApiError && (project.error.status === 403 || project.error.status === 404)
    return (
      <section className={`w-full max-w-xl ${panelClass}`}>
        <p className={errorClass} role="alert">{denied ? 'You don’t have access to this project’s tasks.' : apiErrorMessage(project.error)}</p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link to="/workspaces" className={linkClass}>All workspaces</Link>
          {!denied && <button className={linkClass} onClick={() => void project.refetch()}>Try again</button>}
        </div>
      </section>
    )
  }
  return (
    <div className="w-full min-w-0 max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link to={`/projects/${projectId}`} className={`break-words text-sm ${linkClass}`}>{project.data.name}</Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Task list</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to={`/projects/${projectId}/board`} className={`text-sm ${linkClass}`}>Task board</Link>
          {project.data.status !== 'ARCHIVED' && <Link to={`/projects/${projectId}/tasks/new`} className={primaryButtonClass}>Create task</Link>}
        </div>
      </div>
      <TaskList key={projectId} project={project.data} userId={userId} />
    </div>
  )
}
