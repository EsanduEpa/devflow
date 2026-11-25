import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { CalendarDays, ClipboardList, GripVertical, Plus, UserRound } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass } from '../../shared/form-styles'
import { Badge, EmptyState, LoadingState, PageHeader } from '../../shared/ui'
import { getProject, listProjectMembers, projectKeys, type Project } from '../projects/api'
import { listWorkspaceMembers, workspaceKeys, type WorkspaceRole } from '../workspaces/api'
import { listBoardTasks, taskBoardKey, type Task, type TaskStatus } from './api'
import { TaskFilters } from './TaskFilters'
import { TaskMoveFeedback, TaskStatusSelect } from './TaskStatusControl'
import { allowedTaskStatuses, useTaskStatusMove } from './task-status-move'
import { useBoardDragScroll } from './useBoardDragScroll'
import { taskPriorityLabels, taskPriorityTones, taskStatusLabels, taskStatusOrder } from './task-labels'
import { taskFilterKeys } from './task-navigation'

const columnDot: Record<TaskStatus, string> = {
  BACKLOG: 'bg-field', TODO: 'bg-secondary', IN_PROGRESS: 'bg-accent', IN_REVIEW: 'bg-warning', DONE: 'bg-success',
}

function TaskCard({ task, assignee, destinations, disabled, moving, onMove, onDragStart, onDragEnd }: {
  task: Task
  assignee: string
  destinations: TaskStatus[]
  disabled: boolean
  moving: boolean
  onMove: (status: TaskStatus) => void
  onDragStart: (event: DragEvent<HTMLSpanElement>) => void
  onDragEnd: () => void
}) {
  const location = useLocation()
  return (
    <li className={`min-w-0 rounded-lg border border-line bg-surface p-3 ${moving ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-1.5">
        <Link to={`/tasks/${task.id}`} state={{ taskBackground: location }}
          className="min-w-0 flex-1 break-words font-semibold leading-snug text-ink hover:text-accent-ink hover:underline">
          {task.title}
        </Link>
        {destinations.length > 0 && !disabled && <span draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
          title={`Drag ${task.title}`} aria-hidden="true"
          className="hidden shrink-0 cursor-grab select-none rounded p-1 text-secondary hover:bg-muted active:cursor-grabbing pointer-fine:inline-flex">
          <GripVertical size={18} className="pointer-events-none" />
        </span>}
      </div>
      <div className="mt-2"><Badge tone={taskPriorityTones[task.priority]}>{taskPriorityLabels[task.priority]}</Badge></div>
      <div className="mt-2 space-y-1 text-xs text-secondary">
        <p className="flex items-start gap-1.5"><UserRound size={14} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{assignee}</span></p>
        {task.dueDate && <p className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />
          <time dateTime={task.dueDate}>{formatDateOnly(task.dueDate)}</time></p>}
      </div>
      {destinations.length > 0 && <div className="mt-3 border-t border-line pt-2">
        <TaskStatusSelect task={task} destinations={destinations} disabled={disabled} onMove={onMove} />
      </div>}
    </li>
  )
}

function Board({ project, userId, tasks, filtered, statusFilter, role, assigneeName }: {
  project: Project
  userId: string
  tasks: Task[]
  filtered: boolean
  statusFilter: string | null
  role?: WorkspaceRole
  assigneeName: (id: string | null) => string
}) {
  const mover = useTaskStatusMove(userId, project)
  const [dragged, setDragged] = useState<Task | null>(null)
  const [hovered, setHovered] = useState<TaskStatus | null>(null)
  const { viewport, scrollNearEdge, stopScrolling } = useBoardDragScroll(!!dragged)
  const restoreFocus = useRef<string | null>(null)
  const pending = mover.mutation.isPending ? mover.mutation.variables : undefined
  const disabled = !!pending || !!mover.conflict.attempt
  const allowedDropStatuses = dragged ? allowedTaskStatuses(dragged, project, userId, role) : []
  const latestConflict = mover.conflict.current
  const retryStatuses = latestConflict ? allowedTaskStatuses(latestConflict, project, userId, role) : []

  useEffect(() => {
    const taskId = restoreFocus.current
    const board = viewport.current
    if (!taskId || !board || mover.mutation.isPending) return
    restoreFocus.current = null
    const select = board.querySelector<HTMLSelectElement>(`select[data-task-status-control="${taskId}"]`)
    const focused = document.activeElement
    if (focused !== document.body && focused !== select && focused !== board) return
    if (select && !select.disabled) {
      select.focus({ preventScroll: true })
      select.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } else {
      board.focus({ preventScroll: true })
    }
  }, [mover.mutation.isPending, mover.mutation.submittedAt, viewport])

  function endDrag() {
    setDragged(null)
    setHovered(null)
    stopScrolling()
  }

  function moveFromSelect(task: Task, status: TaskStatus) {
    if (disabled || task.status === status || !allowedTaskStatuses(task, project, userId, role).includes(status)) return
    restoreFocus.current = task.id
    mover.move(task, status)
  }

  function drop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    if (!dragged) return
    event.preventDefault()
    const task = dragged
    endDrag()
    if (disabled || status === task.status || !allowedDropStatuses.includes(status)) return
    if (event.dataTransfer.getData('text/plain') === task.id) mover.move(task, status, true)
  }

  const columns: Record<TaskStatus, Task[]> = { BACKLOG: [], TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] }
  for (const task of tasks) {
    const moving = pending?.preview && pending.task.id === task.id && pending.task.version === task.version
    const displayed = moving ? { ...task, status: pending.status } : task
    if (!statusFilter || statusFilter === displayed.status) columns[displayed.status].push(displayed)
  }

  return (
    <>
      {project.status === 'ARCHIVED' && <p className="rounded-lg bg-warning-surface p-3 text-warning">Restore this project before changing task statuses.</p>}
      {tasks.length === 0 && <EmptyState icon={<ClipboardList size={18} aria-hidden="true" />}
        title={filtered ? 'No tasks match your filters.' : 'This project has no tasks yet.'} />}
      <div ref={viewport} className="max-w-full overflow-x-auto overscroll-x-contain pb-3" tabIndex={0} role="region"
        aria-label="Kanban board" onDragOver={(event) => { if (dragged) scrollNearEdge(event.clientX) }}
        onDragLeave={(event) => {
          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
          stopScrolling()
          setHovered(null)
        }}>
        <div className="sticky left-0 z-10 mb-2 space-y-2 empty:hidden">
          <TaskMoveFeedback mover={mover} destinations={retryStatuses} announceSuccess />
        </div>
        <div className="grid min-w-[60rem] grid-cols-5 items-stretch gap-3">
          {taskStatusOrder.map((status) => {
            const eligible = allowedDropStatuses.includes(status) && dragged?.status !== status
            return (
              <section key={status} aria-label={taskStatusLabels[status]} data-status={status} data-drop-ready={eligible || undefined}
                className={`min-w-0 rounded-lg border p-2.5 ${eligible
                  ? hovered === status ? 'border-accent bg-selected ring-1 ring-accent' : 'border-accent bg-muted/55'
                  : 'border-line bg-muted/55'}`}
                onDragOver={(event) => {
                  if (!dragged) return
                  setHovered(status)
                  if (!allowedDropStatuses.includes(status)) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => drop(event, status)}>
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <span className={`size-2 shrink-0 rounded-full ${columnDot[status]}`} aria-hidden="true" />
                  <h2 className="text-sm font-semibold">{taskStatusLabels[status]}</h2>
                  <span className="ml-auto rounded-md bg-surface px-1.5 text-xs font-medium text-secondary tabular-nums">{columns[status].length}</span>
                </div>
                {columns[status].length ? (
                  <ul className="mt-2 space-y-2">
                    {columns[status].map((task) => (
                      <TaskCard key={task.id} task={task} destinations={allowedTaskStatuses(task, project, userId, role)}
                        disabled={disabled} moving={task.id === pending?.task.id || task.id === dragged?.id}
                        assignee={assigneeName(task.assigneeId)} onMove={(destination) => moveFromSelect(task, destination)}
                        onDragStart={(event) => {
                          if (disabled || !allowedTaskStatuses(task, project, userId, role).length) {
                            event.preventDefault()
                            return
                          }
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', task.id)
                          setDragged(task)
                        }} onDragEnd={endDrag} />
                    ))}
                  </ul>
                ) : <p className="mt-2 rounded-lg border border-dashed border-line py-5 text-center text-xs text-secondary">No tasks</p>}
              </section>
            )
          })}
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
      {tasks.data ? <Board project={project.data} userId={userId} tasks={tasks.data} filtered={!!query} statusFilter={filters.get('status')} role={role}
        assigneeName={(id) => id ? names.get(id) ?? (workspaceMembers.isPending ? 'Loading…' : 'Unavailable') : 'Unassigned'} />
        : !tasks.isError && <LoadingState>Loading task board…</LoadingState>}
    </div>
  )
}
