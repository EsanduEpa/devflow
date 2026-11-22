import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, submitClass, successClass } from '../../shared/form-styles'
import { ConfirmDialog, PageHeader } from '../../shared/ui'
import { useFieldErrors } from '../../shared/useFieldErrors'
import type { WorkspaceMember } from '../workspaces/api'
import { roleLabels } from '../workspaces/workspace-labels'
import { projectKeys, updateProject, type Project, type ProjectFields, type ProjectStatus } from './api'
import { projectStatusLabels } from './project-labels'
import { ProjectMembers } from './ProjectMembers'

function ProjectSettingsForm({ project, eligibleManagers, onSave, pending, error }: {
  project: Project
  eligibleManagers?: WorkspaceMember[]
  onSave: (fields: Partial<ProjectFields>) => void
  pending: boolean
  error?: unknown
}) {
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [status, setStatus] = useState(project.status)
  const errors = useFieldErrors(error)
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
    <form className="mt-4 max-w-2xl" onSubmit={submit}>
      <fieldset className="space-y-4" disabled={pending}>
        <label className="block text-sm font-medium">
          Project name
          <input name="name" className={fieldClass} defaultValue={project.name} minLength={3} maxLength={150} required {...errors.props('name')} />
          {errors.message('name')}
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea name="description" className={fieldClass} defaultValue={project.description} rows={4} maxLength={2000} {...errors.props('description')} />
          {errors.message('description')}
        </label>
        {eligibleManagers && (
          <label className="block text-sm font-medium">
            Project manager
            <select name="managerId" className={fieldClass} defaultValue={project.managerId} required {...errors.props('managerId')}>
              {!eligibleManagers.some(({ user }) => user.id === project.managerId) &&
                <option value={project.managerId} disabled>Current manager unavailable</option>}
              {eligibleManagers.map(({ user, role }) => <option key={user.id} value={user.id}>{user.name} ({roleLabels[role]})</option>)}
            </select>
            {errors.message('managerId')}
          </label>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-medium">
            Start date
            <input type="date" name="startDate" className={fieldClass} value={startDate} onChange={(event) => setStartDate(event.target.value)} {...errors.props('startDate')} />
            {errors.message('startDate')}
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Target date
            <input type="date" name="targetDate" className={fieldClass} defaultValue={project.targetDate ?? ''} min={startDate || undefined} {...errors.props('targetDate')} />
            {errors.message('targetDate')}
          </label>
        </div>
        <section className="border-t border-line pt-4" aria-labelledby="project-status-settings">
          <h3 id="project-status-settings" className="text-base font-semibold">Project status</h3>
          <label className="mt-3 block max-w-xs text-sm font-medium">
            Status
            <select name="status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)} {...errors.props('status')}>
              {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {errors.message('status')}
          </label>
          {status === 'ARCHIVED' && <p className="mt-3 rounded-lg bg-warning-surface p-3 text-sm text-warning">Archived projects are read-only for task changes.</p>}
        </section>
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
  const [archiveFields, setArchiveFields] = useState<Partial<ProjectFields> | null>(null)
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
    if (fields.status === 'ARCHIVED') setArchiveFields(fields)
    else if (Object.keys(fields).length) change.mutate(fields)
    else setNotice('No changes to save.')
  }

  return (
    <div className="w-full min-w-0 max-w-5xl space-y-5">
      <Link to={`/projects/${project.id}`} className="ui-button ui-ghost -ml-3"><ChevronLeft size={16} aria-hidden="true" />Back to project</Link>
      <PageHeader title="Project settings" description={project.name} />
      <section className="ui-panel" aria-labelledby="project-settings-details">
        <h2 id="project-settings-details" className="text-lg font-semibold">Project details</h2>
        {change.error && !archiveFields && <p className={`mt-4 ${errorClass}`} role="alert">{apiErrorMessage(change.error)}</p>}
        {notice && <p className={`mt-4 ${successClass}`} role="status">{notice}</p>}
        <ProjectSettingsForm key={project.updatedAt} project={project}
          eligibleManagers={workspaceMembers?.filter(({ role }) => role === 'OWNER' || role === 'MANAGER')}
          onSave={save} pending={change.isPending} error={change.error} />
      </section>
      <ProjectMembers project={project} userId={userId} workspaceMembers={workspaceMembers} />
      {archiveFields && <ConfirmDialog title="Archive project?" action="Archive project" waiting="Archiving…" pending={change.isPending}
        error={change.error ? apiErrorMessage(change.error) : undefined}
        onClose={() => { change.reset(); setArchiveFields(null) }}
        onConfirm={() => change.mutate(archiveFields, { onSuccess: () => setArchiveFields(null) })}>
        <p><strong>{project.name}</strong> will remain accessible. Restore it to allow task changes again.</p>
      </ConfirmDialog>}
    </div>
  )
}
