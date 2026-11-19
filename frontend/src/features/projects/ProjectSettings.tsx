import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass, submitClass, successClass } from '../../shared/form-styles'
import type { WorkspaceMember } from '../workspaces/api'
import { roleLabels } from '../workspaces/workspace-labels'
import { projectKeys, updateProject, type Project, type ProjectFields, type ProjectStatus } from './api'
import { projectStatusLabels } from './project-labels'
import { ProjectMembers } from './ProjectMembers'

function ProjectSettingsForm({ project, eligibleManagers, onSave, pending }: {
  project: Project
  eligibleManagers?: WorkspaceMember[]
  onSave: (fields: Partial<ProjectFields>) => void
  pending: boolean
}) {
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [status, setStatus] = useState(project.status)
  const action = status === project.status ? 'Save changes'
    : status === 'ARCHIVED' ? 'Archive project'
      : project.status === 'ARCHIVED' ? 'Restore project' : 'Save changes'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const description = String(data.get('description') ?? '').trim()
    const managerId = String(data.get('managerId') ?? project.managerId)
    const start = startDate || null
    const target = String(data.get('targetDate') ?? '') || null
    onSave({
      ...(name !== project.name && { name }),
      ...(description !== project.description && { description }),
      ...(managerId !== project.managerId && { managerId }),
      ...(start !== project.startDate && { startDate: start }),
      ...(target !== project.targetDate && { targetDate: target }),
      ...(status !== project.status && { status }),
    })
  }

  return (
    <form className="mt-5" onSubmit={submit}>
      <fieldset className="space-y-4" disabled={pending}>
        <label className="block text-sm font-medium">
          Project name
          <input name="name" className={fieldClass} defaultValue={project.name} minLength={3} maxLength={150} required />
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea name="description" className={fieldClass} defaultValue={project.description} rows={4} maxLength={2000} />
        </label>
        {eligibleManagers && (
          <label className="block text-sm font-medium">
            Project manager
            <select name="managerId" className={fieldClass} defaultValue={project.managerId} required>
              {!eligibleManagers.some(({ user }) => user.id === project.managerId) &&
                <option value={project.managerId} disabled>Current manager unavailable</option>}
              {eligibleManagers.map(({ user, role }) => <option key={user.id} value={user.id}>{user.name} ({roleLabels[role]})</option>)}
            </select>
          </label>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-medium">
            Start date
            <input type="date" name="startDate" className={fieldClass} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Target date
            <input type="date" name="targetDate" className={fieldClass} defaultValue={project.targetDate ?? ''} min={startDate || undefined} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Status
          <select name="status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
            {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button className={submitClass}>{pending ? 'Saving…' : action}</button>
      </fieldset>
    </form>
  )
}

export function ProjectSettings({ project, userId, isOwner, workspaceMembers }: {
  project: Project
  userId: string
  isOwner: boolean
  workspaceMembers?: WorkspaceMember[]
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const change = useMutation({
    mutationFn: (fields: Partial<ProjectFields>) => updateProject(project.id, fields),
    onSuccess: (updated) => {
      if (!isOwner && updated.managerId !== userId) void navigate(`/projects/${project.id}`, { replace: true })
      queryClient.setQueryData(projectKeys.details(userId, project.id), updated)
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists(userId, project.workspaceId) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.members(userId, project.id) })
      setNotice(updated.status === 'ARCHIVED' && project.status !== 'ARCHIVED' ? 'Project archived.'
        : project.status === 'ARCHIVED' && updated.status !== 'ARCHIVED' ? 'Project restored.' : 'Changes saved.')
    },
  })

  function save(fields: Partial<ProjectFields>) {
    setNotice('')
    change.reset()
    if (Object.keys(fields).length) change.mutate(fields)
    else setNotice('No changes to save.')
  }

  return (
    <div className="w-full max-w-2xl space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <Link to={`/projects/${project.id}`} className={`text-sm ${linkClass}`}>Back to project</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Project settings</h1>
        <p className="mt-2 break-words text-sm text-slate-600">{project.name}</p>
        {change.error && <p className={`mt-4 ${errorClass}`} role="alert">{apiErrorMessage(change.error)}</p>}
        {notice && <p className={`mt-4 ${successClass}`} role="status">{notice}</p>}
        <ProjectSettingsForm key={project.updatedAt} project={project}
          eligibleManagers={workspaceMembers?.filter(({ role }) => role === 'OWNER' || role === 'MANAGER')}
          onSave={save} pending={change.isPending} />
      </section>
      <ProjectMembers project={project} userId={userId} workspaceMembers={workspaceMembers} />
    </div>
  )
}
