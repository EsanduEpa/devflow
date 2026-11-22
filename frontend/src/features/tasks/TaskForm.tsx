import type { FormEvent } from 'react'
import { fieldClass, submitClass } from '../../shared/form-styles'
import { useFieldErrors } from '../../shared/useFieldErrors'
import type { ProjectMember } from '../projects/api'
import type { Task, TaskFields, TaskPriority, TaskStatus } from './api'
import { taskPriorityLabels, taskStatusLabels } from './task-labels'

export function TaskForm({ task, canManage, members, pending, error, onSave }: {
  task?: Task
  canManage: boolean
  members?: ProjectMember[]
  pending: boolean
  error?: unknown
  onSave: (fields: TaskFields) => void
}) {
  const fields = useFieldErrors(error)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const fields: TaskFields = {
      title: String(data.get('title') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
    }
    if (canManage) {
      fields.priority = String(data.get('priority')) as TaskPriority
      fields.dueDate = String(data.get('dueDate') ?? '') || null
      if (data.has('assigneeId')) fields.assigneeId = String(data.get('assigneeId') ?? '') || null
      if (!task) fields.status = String(data.get('status')) as TaskStatus
    }
    onSave(fields)
  }

  return (
    <form onSubmit={submit}>
      <fieldset className="space-y-4" disabled={pending}>
        <label className="block text-sm font-medium">
          Task title
          <input name="title" className={fieldClass} defaultValue={task?.title} required minLength={3} maxLength={200} {...fields.props('title')} />
          {fields.message('title')}
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea name="description" className={fieldClass} defaultValue={task?.description} rows={4} maxLength={5000} {...fields.props('description')} />
          {fields.message('description')}
        </label>
        {canManage && (
          <>
            {members && (
              <label className="block text-sm font-medium">
                Assignee
                <select name="assigneeId" className={fieldClass} defaultValue={task?.assigneeId ?? ''} {...fields.props('assigneeId')}>
                  <option value="">Unassigned</option>
                  {task?.assigneeId && !members.some(({ user }) => user.id === task.assigneeId) && (
                    <option value={task.assigneeId} disabled>Current assignee unavailable</option>
                  )}
                  {members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
                {fields.message('assigneeId')}
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Priority
                <select name="priority" className={fieldClass} defaultValue={task?.priority ?? 'MEDIUM'} {...fields.props('priority')}>
                  {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {fields.message('priority')}
              </label>
              <label className="block min-w-0 text-sm font-medium">
                Due date
                <input type="date" name="dueDate" className={fieldClass} defaultValue={task?.dueDate ?? ''} {...fields.props('dueDate')} />
                {fields.message('dueDate')}
              </label>
            </div>
            {!task && (
              <label className="block text-sm font-medium">
                Status
                <select name="status" className={fieldClass} defaultValue="BACKLOG" {...fields.props('status')}>
                  {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {fields.message('status')}
              </label>
            )}
          </>
        )}
        <button className={submitClass}>{pending ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button>
      </fieldset>
    </form>
  )
}
