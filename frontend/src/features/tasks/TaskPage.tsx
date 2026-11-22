import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass, linkClass } from '../../shared/form-styles'
import { getProject, listProjectMembers, projectKeys, type Project } from '../projects/api'
import { listWorkspaceMembers, workspaceKeys } from '../workspaces/api'
import { formatDate } from '../workspaces/workspace-labels'
import { createTask, deleteTask, getTask, taskKey, updateTask, type Task, type TaskChanges, type TaskFields } from './api'
import { TaskForm } from './TaskForm'
import { taskPriorityLabels, taskStatusLabels } from './task-labels'

const panelClass = 'w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9'
const buttonClass = 'rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50'

function TaskPanel({ project, userId, task }: { project: Project; userId: string; task?: Task }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const projectUrl = `/projects/${project.id}`
  const workspaceMembers = useQuery({
    queryKey: workspaceKeys.members(userId, project.workspaceId),
    queryFn: ({ signal }) => listWorkspaceMembers(project.workspaceId, signal),
    retry: false,
    gcTime: 0,
  })
  const myRole = workspaceMembers.data?.find(({ user }) => user.id === userId)?.role
  const canManage = myRole === 'OWNER' || (myRole === 'MANAGER' && project.managerId === userId)
  const editable = project.status !== 'ARCHIVED'
  const projectMembers = useQuery({
    queryKey: projectKeys.members(userId, project.id),
    queryFn: ({ signal }) => listProjectMembers(project.id, signal),
    enabled: canManage && editable && (!task || editing),
    retry: false,
    gcTime: 0,
  })
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
    onSuccess: (updated) => {
      client.setQueryData(taskKey(userId, updated.id), updated)
      if (task) setEditing(false)
      else void navigate(`/tasks/${updated.id}`, { replace: true })
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => navigate(projectUrl, { replace: true }),
  })

  function memberName(id: string) {
    return workspaceMembers.data?.find(({ user }) => user.id === id)?.user.name
      ?? (workspaceMembers.isPending ? 'Loading…' : 'Unavailable')
  }

  return (
    <section className={panelClass}>
      <Link to={projectUrl} className={`text-sm ${linkClass}`}>{project.name}</Link>
      <h1 className="mt-4 break-words text-3xl font-semibold tracking-tight text-slate-950">{task?.title ?? 'Create task'}</h1>
      {!editable && <p className="mt-3 text-sm text-slate-700">Restore this project before changing its tasks.</p>}

      {task && (
        <>
          {task.description && <p className="mt-4 break-words whitespace-pre-wrap text-slate-700">{task.description}</p>}
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-sm">
            <div><dt className="font-medium">Status</dt><dd>{taskStatusLabels[task.status]}</dd></div>
            <div><dt className="font-medium">Priority</dt><dd>{taskPriorityLabels[task.priority]}</dd></div>
            <div className="min-w-0"><dt className="font-medium">Assignee</dt><dd className="break-words">{task.assigneeId ? memberName(task.assigneeId) : 'Unassigned'}</dd></div>
            <div><dt className="font-medium">Due date</dt><dd>{formatDateOnly(task.dueDate)}</dd></div>
            <div className="min-w-0"><dt className="font-medium">Created by</dt><dd className="break-words">{memberName(task.createdBy)}</dd></div>
            <div><dt className="font-medium">Created</dt><dd><time dateTime={task.createdAt}>{formatDate(task.createdAt)}</time></dd></div>
            <div><dt className="font-medium">Last updated</dt><dd><time dateTime={task.updatedAt}>{formatDate(task.updatedAt)}</time></dd></div>
            <div className="min-w-0"><dt className="font-medium">Task ID</dt><dd className="break-all">{task.id}</dd></div>
          </dl>
          {canManage && editable && !editing && !confirmDelete && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button className={`${buttonClass} border-slate-300 hover:bg-slate-50`} onClick={() => {
                save.reset()
                setEditing(true)
              }}>Edit task</button>
              <button className={`${buttonClass} border-red-200 text-red-800 hover:bg-red-50`} onClick={() => setConfirmDelete(true)}>Delete task</button>
            </div>
          )}
          {canManage && editable && confirmDelete && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p>Delete <strong>{task.title}</strong> permanently?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={`${buttonClass} border-red-800 bg-red-800 text-white hover:bg-red-900`} disabled={remove.isPending}
                  onClick={() => remove.mutate(task.id)}>Delete permanently</button>
                <button className={`${buttonClass} border-red-200 bg-white hover:bg-red-100`} disabled={remove.isPending}
                  onClick={() => {
                    remove.reset()
                    setConfirmDelete(false)
                  }}>Cancel</button>
              </div>
              {remove.error && <p className={`mt-3 ${errorClass}`} role="alert">{apiErrorMessage(remove.error)}</p>}
            </div>
          )}
        </>
      )}

      {!task && editable && workspaceMembers.isPending && <p className="mt-4 text-sm" role="status">Loading project permissions…</p>}
      {!task && editable && workspaceMembers.isError && (
        <div className="mt-4">
          <p className={errorClass} role="alert">{apiErrorMessage(workspaceMembers.error)}</p>
          <button className={`mt-2 ${linkClass}`} onClick={() => void workspaceMembers.refetch()}>Try again</button>
        </div>
      )}
      {editable && ((!task && workspaceMembers.isSuccess) || (task && editing && canManage)) && (
        <>
          {canManage && projectMembers.isPending && <p className="mt-4 text-sm" role="status">Loading assignees…</p>}
          {canManage && projectMembers.isError && (
            <div className="mt-4">
              <p className={errorClass} role="alert">{apiErrorMessage(projectMembers.error)}</p>
              <button className={`mt-2 ${linkClass}`} onClick={() => void projectMembers.refetch()}>Retry loading assignees</button>
            </div>
          )}
          <TaskForm key={task?.updatedAt ?? project.id} task={task} canManage={canManage}
            members={projectMembers.isSuccess ? projectMembers.data : undefined}
            pending={save.isPending || (canManage && projectMembers.isPending)} onSave={(fields) => save.mutate(fields)} />
          {save.error && <p className={`mt-3 ${errorClass}`} role="alert">{apiErrorMessage(save.error)}</p>}
          {task && <button className={`mt-3 text-sm ${linkClass}`} disabled={save.isPending} onClick={() => setEditing(false)}>Cancel editing</button>}
        </>
      )}
      {task && !editing && save.isSuccess && <p className="mt-4 text-sm text-emerald-800" role="status">Changes saved.</p>}
    </section>
  )
}

export function TaskPage({ userId, create = false }: { userId: string; create?: boolean }) {
  const params = useParams()
  const taskId = params.taskId ?? ''
  const task = useQuery({
    queryKey: taskKey(userId, taskId),
    queryFn: ({ signal }) => getTask(taskId, signal),
    enabled: !create,
    retry: false,
    gcTime: 0,
  })
  const projectId = create ? (params.projectId ?? '') : task.data?.projectId
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId ?? ''),
    queryFn: ({ signal }) => getProject(projectId ?? '', signal),
    enabled: !!projectId,
    retry: false,
    gcTime: 0,
  })

  const error = task.error ?? project.error
  if (error) {
    const status = error instanceof ApiError ? error.status : undefined
    const resource = create ? 'project' : 'task'
    return (
      <section className={panelClass}>
        <p className={errorClass} role="alert">{status === 404 ? `You don’t have access to this ${resource}.` : apiErrorMessage(error)}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/workspaces" className={linkClass}>All workspaces</Link>
          {(status === undefined || status >= 500) &&
            <button className={linkClass} onClick={() => void (task.isError ? task.refetch() : project.refetch())}>Try again</button>}
        </div>
      </section>
    )
  }
  if (!project.data || (!create && !task.data)) return <p role="status">{create ? 'Loading project…' : 'Loading task…'}</p>
  return <TaskPanel key={task.data?.id ?? project.data.id} project={project.data} userId={userId} task={task.data} />
}
