import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { CalendarDays, ChevronLeft, Pencil, Trash2, X } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass, successClass } from '../../shared/form-styles'
import { Badge, ConfirmDialog, LoadingState, Modal, PageHeader } from '../../shared/ui'
import { getProject, listProjectMembers, projectKeys, type Project } from '../projects/api'
import { listWorkspaceMembers, workspaceKeys } from '../workspaces/api'
import { formatDate } from '../workspaces/workspace-labels'
import { createTask, deleteTask, getTask, taskBoardKey, taskKey, updateTask, type Task, type TaskChanges, type TaskFields } from './api'
import { TaskForm } from './TaskForm'
import { TaskStatusControl } from './TaskStatusControl'
import { taskPriorityLabels, taskPriorityTones, taskStatusLabels, taskStatusTones } from './task-labels'
import { taskBackground } from './task-navigation'

function TaskPanel({ project, userId, task, drawer }: { project: Project; userId: string; task?: Task; drawer: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const projectUrl = `/projects/${project.id}`
  const workspaceMembers = useQuery({
    queryKey: workspaceKeys.members(userId, project.workspaceId),
    queryFn: ({ signal }) => listWorkspaceMembers(project.workspaceId, signal),
    retry: false, gcTime: 0,
  })
  const role = workspaceMembers.isSuccess ? workspaceMembers.data.find(({ user }) => user.id === userId)?.role : undefined
  const canManage = role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId)
  const editable = project.status !== 'ARCHIVED'
  const projectMembers = useQuery({
    queryKey: projectKeys.members(userId, project.id),
    queryFn: ({ signal }) => listProjectMembers(project.id, signal),
    enabled: canManage && editable && (!task || editing),
    retry: false, gcTime: 0,
  })

  async function refreshProjectTasks() {
    await Promise.all([
      client.invalidateQueries({ queryKey: taskBoardKey(userId, project.id) }),
      client.invalidateQueries({ queryKey: ['tasks', userId, 'list', project.id] }),
      client.invalidateQueries({ queryKey: ['dashboard', userId, project.id] }),
    ])
  }

  const save = useMutation({
    mutationFn: (fields: TaskFields) => {
      if (!task) return createTask(project.id, fields)
      const patch: TaskChanges = {
        ...(fields.title !== task.title && { title: fields.title }),
        ...(fields.description !== task.description && { description: fields.description }),
        ...(fields.assigneeId !== undefined && fields.assigneeId !== task.assigneeId && { assigneeId: fields.assigneeId }),
        ...(fields.priority !== undefined && fields.priority !== task.priority && { priority: fields.priority }),
        ...(fields.dueDate !== undefined && fields.dueDate !== task.dueDate && { dueDate: fields.dueDate }),
      }
      return Object.keys(patch).length ? updateTask(task.id, patch) : Promise.resolve(task)
    },
    onSuccess: async (updated) => {
      client.setQueryData(taskKey(userId, updated.id), updated)
      await refreshProjectTasks()
    },
  })
  const remove = useMutation({ mutationFn: deleteTask, onSuccess: refreshProjectTasks })

  function memberName(id: string) {
    return workspaceMembers.data?.find(({ user }) => user.id === id)?.user.name ?? (workspaceMembers.isPending ? 'Loading…' : 'Unavailable')
  }

  function saveTask(fields: TaskFields) {
    save.mutate(fields, { onSuccess: (updated) => {
      if (task) setEditing(false)
      else void navigate(`/tasks/${updated.id}`, { replace: true, state: drawer ? { taskBackground: taskBackground(location) } : undefined })
    } })
  }

  return (
    <div className={drawer ? 'min-w-0 space-y-5' : 'w-full max-w-4xl space-y-5'}>
      {!drawer && <Link to={`${projectUrl}/board`} className="ui-button ui-ghost -ml-3"><ChevronLeft size={16} aria-hidden="true" />Task board</Link>}
      <PageHeader title={task?.title ?? 'Create task'} description={task ? undefined : project.name}
        meta={task && <Badge tone={taskStatusTones[task.status]}>{taskStatusLabels[task.status]}</Badge>} />
      {!editable && <p className="rounded-lg bg-warning-surface p-3 text-warning">Restore this project before changing its tasks.</p>}

      {task && !editing && (
        <>
          {task.description && <section aria-labelledby="task-description" className="ui-panel">
            <h2 id="task-description" className="text-base font-semibold">Description</h2>
            <p className="mt-2 break-words whitespace-pre-wrap text-secondary">{task.description}</p>
          </section>}
          <section aria-labelledby="task-properties" className="ui-panel">
            <h2 id="task-properties" className="text-base font-semibold">Task properties</h2>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <div><dt className="text-xs font-medium text-secondary">Priority</dt><dd className="mt-1"><Badge tone={taskPriorityTones[task.priority]}>{taskPriorityLabels[task.priority]}</Badge></dd></div>
              <div className="min-w-0"><dt className="text-xs font-medium text-secondary">Assignee</dt><dd className="mt-1 break-words">{task.assigneeId ? memberName(task.assigneeId) : 'Unassigned'}</dd></div>
              <div><dt className="text-xs font-medium text-secondary">Due date</dt><dd className="mt-1 flex items-center gap-1.5"><CalendarDays size={14} className="shrink-0 text-secondary" aria-hidden="true" />{formatDateOnly(task.dueDate)}</dd></div>
              <div className="min-w-0"><dt className="text-xs font-medium text-secondary">Created by</dt><dd className="mt-1 break-words">{memberName(task.createdBy)}</dd></div>
              <div><dt className="text-xs font-medium text-secondary">Created</dt><dd className="mt-1"><time dateTime={task.createdAt}>{formatDate(task.createdAt)}</time></dd></div>
              <div><dt className="text-xs font-medium text-secondary">Last updated</dt><dd className="mt-1"><time dateTime={task.updatedAt}>{formatDate(task.updatedAt)}</time></dd></div>
              <div className="col-span-2 min-w-0"><dt className="text-xs font-medium text-secondary">Task ID</dt><dd className="mt-1 break-all font-mono text-xs">{task.id}</dd></div>
            </dl>
            <TaskStatusControl task={task} project={project} userId={userId} role={role} />
          </section>
          {canManage && editable && <div className="flex flex-wrap gap-2">
            <button className="ui-button ui-secondary" onClick={() => { save.reset(); setEditing(true) }}><Pencil size={15} aria-hidden="true" />Edit task</button>
            <button className="ui-button ui-danger" onClick={() => { remove.reset(); setConfirmDelete(true) }}><Trash2 size={15} aria-hidden="true" />Delete task</button>
          </div>}
          {canManage && editable && confirmDelete && <ConfirmDialog title="Delete task?" pending={remove.isPending}
            error={remove.error ? apiErrorMessage(remove.error) : undefined} action="Delete permanently" waiting="Deleting…" onClose={() => setConfirmDelete(false)}
            onConfirm={() => remove.mutate(task.id, { onSuccess: () => {
              if (drawer) void navigate(-1)
              else void navigate(projectUrl, { replace: true })
            } })}>
            <p><strong>{task.title}</strong> will be permanently removed from this project.</p>
          </ConfirmDialog>}
        </>
      )}

      {workspaceMembers.isPending && <LoadingState>Loading project permissions…</LoadingState>}
      {workspaceMembers.isError && <div className="ui-panel">
        <p className={errorClass} role="alert">{apiErrorMessage(workspaceMembers.error)}</p>
        <button className="ui-button ui-secondary mt-3" onClick={() => void workspaceMembers.refetch()}>Retry loading members</button>
      </div>}
      {editable && ((!task && workspaceMembers.isSuccess) || (task && editing && canManage)) && (
        <section className="ui-panel" aria-label={task ? 'Edit task' : 'Task fields'}>
          {canManage && projectMembers.isPending && <LoadingState>Loading assignees…</LoadingState>}
          {canManage && projectMembers.isError && <div className="mb-3">
            <p className={errorClass} role="alert">{apiErrorMessage(projectMembers.error)}</p>
            <button className="ui-button ui-secondary mt-2" onClick={() => void projectMembers.refetch()}>Retry loading assignees</button>
          </div>}
          <TaskForm key={task?.id ?? project.id} task={task} canManage={canManage}
            members={projectMembers.isSuccess ? projectMembers.data : undefined} error={save.error}
            pending={save.isPending || (canManage && projectMembers.isPending)} onSave={saveTask} />
          {save.error && <p className={`mt-3 ${errorClass}`} role="alert">{apiErrorMessage(save.error)}</p>}
          {task && <button className="ui-button ui-ghost mt-2" disabled={save.isPending} onClick={() => setEditing(false)}>Cancel editing</button>}
          {!task && !drawer && <Link className="ui-button ui-ghost mt-2" to={`${projectUrl}/board`}>Cancel</Link>}
        </section>
      )}
      {task && !editing && save.isSuccess && <p className={successClass} role="status">Changes saved.</p>}
    </div>
  )
}

export function TaskDrawer({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const create = useLocation().pathname.endsWith('/new')
  const close = () => void navigate(-1)
  return (
    <Modal className="task-drawer" labelledBy="task-drawer-title" onClose={close}>
      <div className="task-drawer-header">
        <p id="task-drawer-title" className="font-semibold">{create ? 'New task' : 'Task details'}</p>
        <button type="button" className="ui-button ui-ghost p-2" aria-label="Close task panel" autoFocus onClick={close}><X size={20} aria-hidden="true" /></button>
      </div>
      <div className="p-4 sm:p-6">
        <Routes>
          <Route path="/tasks/:taskId" element={<TaskPage userId={userId} drawer />} />
          <Route path="/projects/:projectId/tasks/new" element={<TaskPage userId={userId} create drawer />} />
        </Routes>
      </div>
    </Modal>
  )
}

export function TaskPage({ userId, create = false, drawer = false }: { userId: string; create?: boolean; drawer?: boolean }) {
  const params = useParams()
  const taskId = (params.taskId ?? '').toLowerCase()
  const task = useQuery({
    queryKey: taskKey(userId, taskId), queryFn: ({ signal }) => getTask(taskId, signal),
    enabled: !create, retry: false, gcTime: 0,
  })
  const projectId = create ? (params.projectId ?? '').toLowerCase() : task.data?.projectId ?? ''
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId), queryFn: ({ signal }) => getProject(projectId, signal),
    enabled: !!projectId, retry: false, gcTime: 0,
  })

  const error = task.error ?? project.error
  if (error) {
    const status = error instanceof ApiError ? error.status : undefined
    const resource = create ? 'project' : 'task'
    return (
      <section className="ui-panel max-w-xl">
        <p className={errorClass} role="alert">{status === 404 ? `You don’t have access to this ${resource}.` : apiErrorMessage(error)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!drawer && <Link to="/workspaces" className="ui-button ui-secondary">All workspaces</Link>}
          {(status === undefined || status >= 500) &&
            <button className="ui-button ui-secondary" onClick={() => void (task.isError ? task.refetch() : project.refetch())}>Try again</button>}
        </div>
      </section>
    )
  }
  if (!project.data || (!create && !task.data)) return <LoadingState>{create ? 'Loading project…' : 'Loading task…'}</LoadingState>
  return <TaskPanel key={task.data?.id ?? project.data.id} project={project.data} userId={userId} task={task.data} drawer={drawer} />
}
