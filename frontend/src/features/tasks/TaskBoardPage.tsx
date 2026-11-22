import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { CalendarDays, ClipboardList, Plus, UserRound } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass } from '../../shared/form-styles'
import { Badge, EmptyState, LoadingState, PageHeader } from '../../shared/ui'
import { getProject, listProjectMembers, projectKeys, type Project } from '../projects/api'
import { listWorkspaceMembers, workspaceKeys, type WorkspaceRole } from '../workspaces/api'
import { listBoardTasks, taskBoardKey, type Task, type TaskStatus } from './api'
import { TaskFilters } from './TaskFilters'
import { TaskStatusControl } from './TaskStatusControl'
import { taskPriorityLabels, taskPriorityTones, taskStatusLabels, taskStatusOrder } from './task-labels'
import { taskFilterKeys } from './task-navigation'

const columnDot: Record<TaskStatus, string> = {
  BACKLOG: 'bg-field', TODO: 'bg-secondary', IN_PROGRESS: 'bg-accent', IN_REVIEW: 'bg-warning', DONE: 'bg-success',
}

function TaskCard({ task, project, userId, assignee, role }: {
  task: Task
  project: Project
  userId: string
  assignee: string
  role?: WorkspaceRole
}) {
  const location = useLocation()
  return (
    <li className="min-w-0 rounded-lg border border-line bg-surface p-3">
      <Link to={`/tasks/${task.id}`} state={{ taskBackground: location }}
        className="block break-words font-semibold leading-snug text-ink hover:text-accent-ink hover:underline">
        {task.title}
      </Link>
      <div className="mt-2"><Badge tone={taskPriorityTones[task.priority]}>{taskPriorityLabels[task.priority]}</Badge></div>
      <div className="mt-2 space-y-1 text-xs text-secondary">
        <p className="flex items-start gap-1.5"><UserRound size={14} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{assignee}</span></p>
        {task.dueDate && <p className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />
          <time dateTime={task.dueDate}>{formatDateOnly(task.dueDate)}</time></p>}
      </div>
      <TaskStatusControl task={task} project={project} userId={userId} role={role} />
    </li>
  )
}

function Board({ project, userId, tasks, filtered, role, assigneeName }: {
  project: Project
  userId: string
  tasks: Task[]
  filtered: boolean
  role?: WorkspaceRole
  assigneeName: (id: string | null) => string
}) {
  const columns: Record<TaskStatus, Task[]> = { BACKLOG: [], TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] }
  for (const task of tasks) columns[task.status].push(task)

  return (
    <>
      {project.status === 'ARCHIVED' && <p className="rounded-lg bg-warning-surface p-3 text-warning">Restore this project before changing task statuses.</p>}
      {tasks.length === 0 && <EmptyState icon={<ClipboardList size={18} aria-hidden="true" />}
        title={filtered ? 'No tasks match your filters.' : 'This project has no tasks yet.'} />}
      <div className="max-w-full overflow-x-auto overscroll-x-contain pb-3" tabIndex={0} role="region" aria-label="Kanban board">
        <div className="grid min-w-[60rem] grid-cols-5 items-stretch gap-3">
          {taskStatusOrder.map((status) => (
            <section key={status} aria-label={taskStatusLabels[status]} data-status={status} className="min-w-0 rounded-lg border border-line bg-muted/55 p-2.5">
              <div className="flex items-center gap-2 px-1 py-1.5">
                <span className={`size-2 shrink-0 rounded-full ${columnDot[status]}`} aria-hidden="true" />
                <h2 className="text-sm font-semibold">{taskStatusLabels[status]}</h2>
                <span className="ml-auto rounded-md bg-surface px-1.5 text-xs font-medium text-secondary tabular-nums">{columns[status].length}</span>
              </div>
              {columns[status].length ? (
                <ul className="mt-2 space-y-2">
                  {columns[status].map((task) => (
                    <TaskCard key={task.id} task={task} project={project} userId={userId} role={role}
                      assignee={assigneeName(task.assigneeId)} />
                  ))}
                </ul>
              ) : <p className="mt-2 rounded-lg border border-dashed border-line py-5 text-center text-xs text-secondary">No tasks</p>}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

export function TaskBoardPage({ userId }: { userId: string }) {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = new URLSearchParams()
  for (const key of taskFilterKeys) {
    const value = params.get(key)
    if (value) filters.set(key, value)
  }
  const query = filters.toString()
  const projectId = (useParams().projectId ?? '').toLowerCase()
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal), retry: false, gcTime: 0,
  })
  const tasks = useQuery({
    queryKey: [...taskBoardKey(userId, projectId), query],
    queryFn: ({ signal }) => listBoardTasks(projectId, signal, new URLSearchParams(query)), retry: false, gcTime: 0,
  })
  const members = useQuery({
    queryKey: projectKeys.members(userId, projectId),
    queryFn: ({ signal }) => listProjectMembers(projectId, signal), enabled: project.isSuccess, retry: false, gcTime: 0,
  })
  const workspaceId = project.isSuccess ? project.data.workspaceId : ''
  const workspaceMembers = useQuery({
    queryKey: workspaceKeys.members(userId, workspaceId),
    queryFn: ({ signal }) => listWorkspaceMembers(workspaceId, signal), enabled: !!workspaceId, retry: false, gcTime: 0,
  })
  const failure = project.error ?? tasks.error
  const denied = failure instanceof ApiError && (failure.status === 403 || failure.status === 404)
  if (denied) return <section className="ui-panel max-w-xl">
    <p className={errorClass} role="alert">You don’t have access to this project’s board.</p>
    <Link to="/workspaces" className="ui-button ui-secondary mt-3">All workspaces</Link>
  </section>

  if (project.isError) return <section className="ui-panel max-w-xl">
    <p className={errorClass} role="alert">{apiErrorMessage(project.error)}</p>
    <button className="ui-button ui-secondary mt-3" onClick={() => void project.refetch()}>Try again</button>
  </section>
  if (!project.data) return <LoadingState>Loading task board…</LoadingState>
  const role = workspaceMembers.isSuccess ? workspaceMembers.data.find(({ user }) => user.id === userId)?.role : undefined
  const names = new Map(workspaceMembers.data?.map(({ user }) => [user.id, user.name]))

  return (
    <div className="w-full min-w-0 space-y-4">
      <PageHeader title="Task board" actions={project.data.status !== 'ARCHIVED' && (
        <Link to={`/projects/${projectId}/tasks/new`} state={{ taskBackground: location }} className="ui-button ui-primary">
          <Plus size={17} aria-hidden="true" />Create task
        </Link>
      )} />
      <section className="ui-panel" aria-label="Task filters">
        <TaskFilters key={query} filters={filters} members={members.data ?? []} apply={setParams} />
        {members.isError && <div className="mt-3 flex flex-wrap gap-2">
          <p className={errorClass} role="alert">Could not load assignees. {apiErrorMessage(members.error)}</p>
          <button className="ui-button ui-secondary" onClick={() => void members.refetch()}>Retry loading assignees</button>
        </div>}
      </section>
      {workspaceMembers.isError && <div className="flex flex-wrap items-center gap-2">
        <p className={errorClass} role="alert">Could not load member names and permissions. {apiErrorMessage(workspaceMembers.error)}</p>
        <button className="ui-button ui-secondary" onClick={() => void workspaceMembers.refetch()}>Retry loading members</button>
      </div>}
      {tasks.isError && <section className="ui-panel">
        <p className={errorClass} role="alert">{apiErrorMessage(tasks.error)}</p>
        <button className="ui-button ui-secondary mt-3" onClick={() => void tasks.refetch()}>Try again</button>
      </section>}
      {tasks.data ? <Board project={project.data} userId={userId} tasks={tasks.data} filtered={!!query} role={role}
        assigneeName={(id) => id ? names.get(id) ?? (workspaceMembers.isPending ? 'Loading…' : 'Unavailable') : 'Unassigned'} />
        : !tasks.isError && <LoadingState>Loading task board…</LoadingState>}
    </div>
  )
}
