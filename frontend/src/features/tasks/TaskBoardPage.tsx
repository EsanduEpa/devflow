import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass, linkClass } from '../../shared/form-styles'
import { getProject, projectKeys, type Project } from '../projects/api'
import { listWorkspaceMembers, workspaceKeys } from '../workspaces/api'
import { listBoardTasks, taskBoardKey, taskKey, updateTaskStatus, type Task, type TaskStatus } from './api'
import { taskPriorityLabels, taskStatusLabels, taskStatusOrder } from './task-labels'

const columnAccent: Record<TaskStatus, string> = {
  BACKLOG: 'border-t-slate-400',
  TODO: 'border-t-indigo-400',
  IN_PROGRESS: 'border-t-blue-500',
  IN_REVIEW: 'border-t-amber-500',
  DONE: 'border-t-emerald-500',
}
const priorityStyles = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-indigo-50 text-indigo-800',
  HIGH: 'bg-amber-100 text-amber-900',
  URGENT: 'bg-red-100 text-red-800',
}
const createButton = 'rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800'

function TaskCard({ task, userId, assignee, destinations }: {
  task: Task
  userId: string
  assignee: string
  destinations: TaskStatus[]
}) {
  const client = useQueryClient()
  const key = taskBoardKey(userId, task.projectId)
  const change = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(task.id, status),
    onSuccess: async (updated) => {
      await client.cancelQueries({ queryKey: key })
      client.setQueryData<Task[]>(key, (current) => current?.map((item) => item.id === updated.id ? updated : item))
      client.setQueryData(taskKey(userId, task.id), updated)
    },
  })

  return (
    <li className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Link to={`/tasks/${task.id}`} className="block break-words text-sm font-semibold leading-snug text-slate-950 hover:text-indigo-800 hover:underline">
        {task.title}
      </Link>
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>
        {taskPriorityLabels[task.priority]}
      </span>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <dt className="text-slate-600">Assignee</dt><dd className="break-words text-slate-900">{assignee}</dd>
        <dt className="text-slate-600">Due date</dt><dd className="text-slate-900">{formatDateOnly(task.dueDate)}</dd>
      </dl>
      {!!destinations.length && (
        <label className="block border-t border-slate-100 pt-2 text-xs font-medium text-slate-700">
          <span className="mb-1 block">Move to</span>
          <select className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-950 outline-indigo-600 disabled:opacity-60"
            aria-label={`Change status for ${task.title}`} value={task.status} disabled={change.isPending}
            onChange={(event) => change.mutate(event.target.value as TaskStatus)}>
            {destinations.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
          </select>
        </label>
      )}
      {change.isPending && <p className="text-xs text-slate-600" role="status">Saving status…</p>}
      {change.error && <p className={errorClass} role="alert">{apiErrorMessage(change.error)}</p>}
    </li>
  )
}

function Board({ project, userId, tasks }: { project: Project; userId: string; tasks: Task[] }) {
  const members = useQuery({
    queryKey: workspaceKeys.members(userId, project.workspaceId),
    queryFn: ({ signal }) => listWorkspaceMembers(project.workspaceId, signal),
    retry: false,
    gcTime: 0,
  })
  const role = members.isSuccess ? members.data.find(({ user }) => user.id === userId)?.role : undefined
  const canManage = role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId)
  const archived = project.status === 'ARCHIVED'
  const names = new Map(members.isSuccess ? members.data.map(({ user }) => [user.id, user.name]) : [])
  const inColumn: Record<TaskStatus, Task[]> = { BACKLOG: [], TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] }
  for (const task of tasks) inColumn[task.status].push(task)

  function destinations(task: Task) {
    if (archived) return []
    if (canManage) return taskStatusOrder
    if (role === 'DEVELOPER' && task.assigneeId === userId && task.status !== 'DONE') {
      return taskStatusOrder.filter((status) => status !== 'DONE')
    }
    return []
  }

  return (
    <>
      {archived && <p className="text-sm text-slate-700">Restore this project before changing task statuses.</p>}
      {members.isError && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className={errorClass} role="alert">Could not load member names and permissions. {apiErrorMessage(members.error)}</p>
          <button className={linkClass} onClick={() => void members.refetch()}>Retry loading members</button>
        </div>
      )}
      {tasks.length === 0 && <p className="text-sm text-slate-700">This project has no tasks yet.</p>}
      <div className="overflow-x-auto pb-3 outline-indigo-600" tabIndex={0} role="region" aria-label="Kanban board">
        <div className="grid min-w-[72rem] grid-cols-5 items-start gap-4">
          {taskStatusOrder.map((status) => (
            <section key={status} aria-label={taskStatusLabels[status]} data-status={status}
              className={`rounded-xl border border-t-4 border-slate-200 bg-slate-100/80 p-3 ${columnAccent[status]}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{taskStatusLabels[status]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700">{inColumn[status].length}</span>
              </div>
              {inColumn[status].length ? (
                <ul className="mt-3 space-y-3">
                  {inColumn[status].map((task) => (
                    <TaskCard key={task.id} task={task} userId={userId} destinations={destinations(task)}
                      assignee={task.assigneeId ? names.get(task.assigneeId) ?? (members.isPending ? 'Loading…' : 'Unavailable') : 'Unassigned'} />
                  ))}
                </ul>
              ) : <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-600">No tasks</p>}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

export function TaskBoardPage({ userId }: { userId: string }) {
  const projectId = (useParams().projectId ?? '').toLowerCase()
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
    retry: false,
    gcTime: 0,
  })
  const tasks = useQuery({
    queryKey: taskBoardKey(userId, projectId),
    queryFn: ({ signal }) => listBoardTasks(projectId, signal),
    retry: false,
    gcTime: 0,
  })
  const failure = project.error ?? tasks.error
  const denied = failure instanceof ApiError && (failure.status === 403 || failure.status === 404)
  if (failure) {
    return (
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
        <p className={errorClass} role="alert">{denied ? 'You don’t have access to this project’s board.' : apiErrorMessage(failure)}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/workspaces" className={linkClass}>All workspaces</Link>
          {!denied && <button className={linkClass} onClick={() => {
            if (project.isError) void project.refetch()
            if (tasks.isError) void tasks.refetch()
          }}>Try again</button>}
        </div>
      </section>
    )
  }
  if (!project.data || !tasks.data) return <p role="status">Loading task board…</p>

  return (
    <div className="w-full min-w-0 max-w-[92rem] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link to={`/projects/${project.data.id}`} className={`break-words text-sm ${linkClass}`}>{project.data.name}</Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Task board</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to={`/projects/${project.data.id}/tasks`} className={`text-sm ${linkClass}`}>Task list</Link>
          {project.data.status !== 'ARCHIVED' && (
            <Link to={`/projects/${project.data.id}/tasks/new`} className={createButton}>Create task</Link>
          )}
        </div>
      </div>
      <Board project={project.data} tasks={tasks.data} userId={userId} />
    </div>
  )
}
