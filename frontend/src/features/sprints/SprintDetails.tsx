import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { Badge, LoadingState, PageHeader } from '../../shared/ui'
import { projectKeys, type Project } from '../projects/api'
import { TaskConflictNotice } from '../tasks/TaskConflictNotice'
import { isTaskConflict, useTaskConflict } from '../tasks/useTaskConflict'
import { listTaskPage, type Task } from '../tasks/api'
import { taskStatusLabels, taskStatusTones } from '../tasks/task-labels'
import { workspaceKeys } from '../workspaces/api'
import { changeSprintState, changeSprintTask, getSprint, listSprints, sprintKeys, type Sprint } from './api'
import { Pager, SprintBadge, SprintDates, SprintLoadError } from './sprint-ui'

type MembershipAction = { type: 'add' | 'remove'; taskId: string; version: number }
type SprintAction = { type: 'start' } | { type: 'complete'; target: string | null } | MembershipAction

function SprintTaskList({ sprint, userId, available, unfinished, action, pending }: {
  sprint: Sprint
  userId: string
  available?: boolean
  unfinished?: boolean
  action?: (task: Task) => void
  pending: boolean
}) {
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ sprintId: available ? 'none' : sprint.id, page: String(page) })
  if (unfinished) params.set('unfinished', 'true')
  const list = useQuery({
    queryKey: [...sprintKeys.project(userId, sprint.projectId), 'tasks', params.toString()],
    queryFn: ({ signal }) => listTaskPage(sprint.projectId, params, signal), retry: false,
  })

  if (list.isPending) return <LoadingState>Loading tasks…</LoadingState>
  if (list.isError) return <SprintLoadError error={list.error} onRetry={() => void list.refetch()} />
  const actionLabel = available ? 'Add' : 'Remove'

  return <>
    {list.data.data.length === 0 && <p className="text-sm text-secondary">
      {page > 1 ? 'No tasks on this page.' : available ? 'No unscheduled tasks.' : unfinished ? 'No unfinished tasks.' : 'No tasks in this sprint.'}
    </p>}
    <ul className="divide-y divide-line">
      {list.data.data.map((task) => <li key={task.id} className="flex min-w-0 flex-wrap items-center gap-2 py-2">
        <Link to={`/tasks/${task.id}`} className={`${linkClass} min-w-0 flex-1 basis-40 break-words`}>{task.title}</Link>
        <Badge tone={taskStatusTones[task.status]}>{taskStatusLabels[task.status]}</Badge>
        {action && <button type="button" className="ui-button ui-secondary"
          aria-label={`${actionLabel} ${task.title}`} disabled={pending} onClick={() => action(task)}>{actionLabel}</button>}
      </li>)}
    </ul>
    <Pager page={page} total={list.data.pagination.totalPages} onPage={setPage} />
  </>
}

function SprintCompletion({ sprint, userId, pending, onComplete, onCancel }: {
  sprint: Sprint; userId: string; pending: boolean; onComplete: (target: string | null) => void; onCancel: () => void
}) {
  const [target, setTarget] = useState('')
  const targets = useQuery({
    queryKey: [...sprintKeys.project(userId, sprint.projectId), 'rollover', sprint.id],
    queryFn: async ({ signal }) => {
      const first = await listSprints(sprint.projectId, 1, signal)
      const sprints = [...first.data]
      for (let page = 2; page <= first.pagination.totalPages; page++) {
        sprints.push(...(await listSprints(sprint.projectId, page, signal)).data)
      }
      return sprints.filter((candidate) => candidate.status === 'PLANNED' && candidate.startDate > sprint.endDate)
    },
    enabled: sprint.progress.unfinishedTasks > 0,
    retry: false,
  })
  const hasUnfinished = sprint.progress.unfinishedTasks > 0
  const canSubmit = !target || targets.data?.some(({ id }) => id === target)
  return <form className="ui-panel space-y-3" onSubmit={(event) => {
    event.preventDefault()
    if (canSubmit) onComplete(target || null)
  }}>
    <h2 className="text-lg font-semibold">Complete sprint</h2>
    <p className="text-sm text-secondary">
      {hasUnfinished ? 'Choose where unfinished tasks go. Their workflow status will stay the same.' : 'All current work is done. Completion saves a snapshot of the sprint’s progress.'}
    </p>
    {hasUnfinished && <>
      <label className="block max-w-md text-sm font-medium">Move unfinished tasks to
        <select value={target} onChange={(event) => setTarget(event.target.value)} className={fieldClass} disabled={pending}>
          <option value="">Project backlog</option>
          {targets.data?.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.startDate})</option>)}
        </select>
      </label>
      {targets.isPending && <LoadingState>Finding future sprints…</LoadingState>}
      {targets.isError && <SprintLoadError error={targets.error} onRetry={() => void targets.refetch()} />}
      {targets.isSuccess && !targets.data.length && <p className="text-sm text-secondary">No planned sprint starts after this one ends.</p>}
      {target && !canSubmit && <p role="status" className="text-sm text-secondary">Choose an available rollover destination.</p>}
    </>}
    <div className="flex flex-wrap gap-2">
      <button className="ui-button ui-primary" disabled={pending || !canSubmit}>{pending ? 'Completing…' : 'Confirm completion'}</button>
      <button type="button" className="ui-button ui-secondary" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </form>
}

function SprintContent({ sprint, project, userId, canManage }: { sprint: Sprint; project: Project; userId: string; canManage: boolean }) {
  const client = useQueryClient()
  const [completing, setCompleting] = useState(false)
  const [showAvailable, setShowAvailable] = useState(false)
  const [unfinished, setUnfinished] = useState(false)
  const conflict = useTaskConflict<MembershipAction>()
  const change = useMutation({
    mutationFn: (action: SprintAction) => {
      if (action.type === 'start') return changeSprintState(sprint.id, 'start')
      if (action.type === 'complete') return changeSprintState(sprint.id, 'complete', action.target)
      return changeSprintTask(sprint.id, action.taskId, action.type === 'add', action.version)
    },
    onSuccess: (_data, action) => {
      conflict.clear()
      if (action.type === 'complete') {
        setCompleting(false)
        setUnfinished(false)
      }
    },
    onError: (error, action) => { if ('taskId' in action) conflict.capture(error, action.taskId, action) },
    onSettled: async (_data, error) => {
      const refresh = [client.invalidateQueries({ queryKey: sprintKeys.project(userId, project.id) })]
      if (!error || isTaskConflict(error)) refresh.push(client.invalidateQueries({ queryKey: ['tasks', userId] }))
      if (error instanceof ApiError && [403, 404, 409].includes(error.status)) {
        refresh.push(
          client.invalidateQueries({ queryKey: projectKeys.details(userId, project.id) }),
          client.invalidateQueries({ queryKey: workspaceKeys.details(userId, project.workspaceId) }),
        )
      }
      await Promise.all(refresh)
    },
  })
  const editMembership = canManage && sprint.status !== 'COMPLETED'
  const attempt = conflict.attempt?.intent
  const latest = conflict.current
  const canRetryMembership = editMembership && latest && attempt
    && (attempt.type === 'add' ? latest.sprintId === null : latest.sprintId === sprint.id)
  const { completedTasks, totalTasks, unfinishedTasks, completionPercentage } = sprint.progress

  return <>
    <PageHeader title={sprint.name} meta={<SprintBadge sprint={sprint} />} actions={canManage && <>
      {sprint.status === 'PLANNED' && <button className="ui-button ui-primary" disabled={change.isPending}
        onClick={() => change.mutate({ type: 'start' })}>{change.isPending ? 'Starting…' : 'Start sprint'}</button>}
      {sprint.status === 'ACTIVE' && !completing && <button className="ui-button ui-primary" disabled={change.isPending}
        onClick={() => { setCompleting(true); setUnfinished(true); change.reset() }}>Complete sprint</button>}
    </>} />
    <SprintDates sprint={sprint} />
    {change.isError && !isTaskConflict(change.error) && <p role="alert" className={errorClass}>{apiErrorMessage(change.error)}</p>}
    {attempt && <TaskConflictNotice message="Review the latest task before retrying the sprint change."
      pending={conflict.pending} error={conflict.error} reload={conflict.reload}>
      {latest && <p className="text-sm text-ink">
        <strong>{latest.title}</strong> is {taskStatusLabels[latest.status]} and currently in {latest.sprintId === sprint.id
          ? sprint.name : latest.sprintId ? 'another sprint' : 'the project backlog'}.
      </p>}
      <div className="flex flex-wrap gap-2">
        {canRetryMembership && <button type="button" className="ui-button ui-primary" disabled={change.isPending}
          onClick={() => change.mutate({ ...attempt, version: latest.version })}>
          {attempt.type === 'add' ? 'Retry adding task' : 'Retry removing task'}
        </button>}
        <button type="button" className="ui-button ui-secondary" disabled={change.isPending} onClick={() => {
          conflict.clear()
          change.reset()
        }}>Dismiss sprint change</button>
      </div>
    </TaskConflictNotice>}
    {project.status === 'ARCHIVED' && <p className="text-sm text-secondary">Restore this project to change its sprints.</p>}
    <section className="ui-panel space-y-2" aria-label="Sprint progress">
      <h2 className="text-lg font-semibold">{sprint.status === 'COMPLETED' ? 'Progress at completion' : 'Sprint progress'}</h2>
      <p>{completedTasks} of {totalTasks} tasks done · {completionPercentage}%</p>
      <progress className="h-2 w-full max-w-lg accent-action" max={100} value={completionPercentage} aria-label="Sprint completion" />
      <p className="text-sm text-secondary">{unfinishedTasks} unfinished {unfinishedTasks === 1 ? 'task' : 'tasks'}</p>
    </section>
    {canManage && sprint.status === 'ACTIVE' && completing && <SprintCompletion sprint={sprint} userId={userId} pending={change.isPending}
      onComplete={(target) => change.mutate({ type: 'complete', target })} onCancel={() => { setCompleting(false); change.reset() }} />}
    <section className="ui-panel space-y-3" aria-labelledby="sprint-tasks">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sprint-tasks" className="text-lg font-semibold">Sprint tasks</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unfinished} onChange={(event) => setUnfinished(event.target.checked)} />Unfinished only
        </label>
      </div>
      <SprintTaskList key={String(unfinished)} sprint={sprint} userId={userId} pending={change.isPending || !!attempt} unfinished={unfinished}
        action={editMembership ? (task) => change.mutate({ type: 'remove', taskId: task.id, version: task.version }) : undefined} />
    </section>
    {editMembership && <section className="ui-panel space-y-3">
      <button className="ui-button ui-secondary" type="button" aria-expanded={showAvailable}
        onClick={() => setShowAvailable(!showAvailable)}>{showAvailable ? 'Hide unscheduled tasks' : 'Add tasks'}</button>
      {showAvailable && <SprintTaskList sprint={sprint} userId={userId} available pending={change.isPending || !!attempt}
        action={(task) => change.mutate({ type: 'add', taskId: task.id, version: task.version })} />}
    </section>}
  </>
}

export function SprintDetails({ project, sprintId, userId, canManage }: { project: Project; sprintId: string; userId: string; canManage: boolean }) {
  const detail = useQuery({
    queryKey: sprintKeys.detail(userId, project.id, sprintId),
    queryFn: async ({ signal }) => {
      const sprint = await getSprint(sprintId, signal)
      if (sprint.projectId !== project.id) throw new ApiError(404, 'This sprint is not in the current project.')
      return sprint
    },
    retry: false,
  })

  return <>
    <Link className={linkClass} to={`/projects/${project.id}/sprints`}>All sprints</Link>
    {detail.isPending && <LoadingState>Loading sprint…</LoadingState>}
    {detail.isError && <SprintLoadError error={detail.error} onRetry={() => void detail.refetch()} />}
    {detail.isSuccess && <SprintContent sprint={detail.data} project={project} userId={userId} canManage={canManage} />}
  </>
}
