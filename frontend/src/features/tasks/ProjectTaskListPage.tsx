import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { CalendarDays, ClipboardList, Plus, UserRound } from 'lucide-react'
import { Badge, EmptyState, LoadingState, PageHeader } from '../../shared/ui'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass, linkClass } from '../../shared/form-styles'
import { getProject, listProjectMembers, projectKeys, type Project } from '../projects/api'
import { listTaskPage, taskListKey } from './api'
import { taskPriorityLabels, taskPriorityTones, taskStatusLabels, taskStatusTones } from './task-labels'
import { TaskFilters } from './TaskFilters'

const panelClass = 'ui-panel'
const buttonClass = 'ui-button ui-secondary'
function TaskList({ project, userId }: { project: Project; userId: string }) {
  const location = useLocation()
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
  const result = tasks.data

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
        <TaskFilters key={query} filters={params} members={members.data ?? []} apply={setParams} list={{ projectId: project.id, userId }} />
        {members.isError && (
          <div className="mt-3 text-sm">
            <p className={errorClass} role="alert">Could not load project members. {apiErrorMessage(members.error)}</p>
            <button className={`mt-2 ${linkClass}`} onClick={() => void members.refetch()}>Retry loading members</button>
          </div>
        )}
      </section>
      <section className={panelClass} aria-labelledby="task-results">
        <h2 id="task-results" className="text-lg font-semibold text-ink">Results</h2>
        {tasks.isPending && <LoadingState>Loading tasks…</LoadingState>}
        {tasks.isError && (
          <div className="mt-3 text-sm">
            <p className={errorClass} role="alert">{apiErrorMessage(tasks.error)}</p>
            <button className={`mt-2 ${linkClass}`} onClick={() => void tasks.refetch()}>Try again</button>
          </div>
        )}
        {result && (
          <>
            <p className="mt-1 text-sm text-secondary" role="status">
              {result.pagination.total} matching task{result.pagination.total === 1 ? '' : 's'}
            </p>
            {result.data.length ? (
              <ul className="mt-3 divide-y divide-line" aria-label="Matching tasks">
                {result.data.map((task) => (
                  <li key={task.id} className="grid min-w-0 grid-cols-2 items-center gap-2 py-3 text-sm md:grid-cols-[minmax(0,2fr)_1.2fr_0.8fr_minmax(0,1.5fr)_1.1fr]">
                    <Link to={`/tasks/${task.id}`} state={{ taskBackground: location }} className={`col-span-2 break-words md:col-span-1 ${linkClass}`}>{task.title}</Link>
                    <Badge tone={taskStatusTones[task.status]}>{taskStatusLabels[task.status]}</Badge>
                    <Badge tone={taskPriorityTones[task.priority]}>{taskPriorityLabels[task.priority]}</Badge>
                    <span className="flex min-w-0 items-start gap-1.5 text-xs text-secondary"><UserRound className="shrink-0" size={14} aria-label="Assignee" />
                      <span className="min-w-0 break-words">{task.assigneeId ? names.get(task.assigneeId) ?? (members.isPending ? 'Loading…' : 'Unavailable') : 'Unassigned'}</span>
                    </span>
                    <span className="flex items-start gap-1.5 text-xs text-secondary"><CalendarDays className="shrink-0" size={14} aria-label="Due date" />{formatDateOnly(task.dueDate)}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="mt-4"><EmptyState icon={<ClipboardList aria-hidden="true" size={18} />}
              title={outOfRange ? 'This page has no results.' : 'No tasks match your filters.'} /></div>}
          </>
        )}
        {pagination && (pagination.page > 1 || pagination.totalPages > 1) && (
          <nav aria-label="Task result pages" className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
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
  const location = useLocation()
  const projectId = (useParams().projectId ?? '').toLowerCase()
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
    retry: false,
    gcTime: 0,
  })
  if (project.isPending) return <LoadingState>Loading project…</LoadingState>
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
    <div className="w-full min-w-0 space-y-5">
      <PageHeader title="Task list" description={project.data.name} actions={project.data.status !== 'ARCHIVED' && (
        <Link to={`/projects/${projectId}/tasks/new`} state={{ taskBackground: location }} className="ui-button ui-primary">
          <Plus size={17} aria-hidden="true" />Create task
        </Link>
      )} />
      <TaskList key={projectId} project={project.data} userId={userId} />
    </div>
  )
}
