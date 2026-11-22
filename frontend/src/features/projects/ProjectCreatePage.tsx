import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass, submitClass } from '../../shared/form-styles'
import { LoadingState, PageHeader } from '../../shared/ui'
import { useFieldErrors } from '../../shared/useFieldErrors'
import { getWorkspace, listWorkspaceMembers, workspaceKeys, type Workspace } from '../workspaces/api'
import { createProject, projectKeys, type ProjectFields, type ProjectStatus } from './api'
import { projectStatusLabels } from './project-labels'

function ProjectForm({ workspace, userId }: { workspace: Workspace; userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const isOwner = workspace.myRole === 'OWNER'
  const members = useQuery({
    queryKey: workspaceKeys.members(userId, workspace.id),
    queryFn: ({ signal }) => listWorkspaceMembers(workspace.id, signal),
    enabled: isOwner,
    retry: false,
    gcTime: 0,
  })
  const eligible = members.data?.filter(({ role }) => role === 'OWNER' || role === 'MANAGER')
  const canChooseManager = !isOwner || (members.isSuccess && !!eligible?.length)
  const create = useMutation({
    mutationFn: (fields: ProjectFields) => createProject(workspace.id, fields),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists(userId, workspace.id) })
      void navigate(`/projects/${project.id}`, { replace: true })
    },
  })
  const errors = useFieldErrors(create.error)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (create.isPending || !canChooseManager) return
    const fields = new FormData(event.currentTarget)
    create.mutate({
      name: String(fields.get('name') ?? ''),
      description: String(fields.get('description') ?? ''),
      managerId: isOwner ? String(fields.get('managerId') ?? '') : userId,
      startDate: String(fields.get('startDate') ?? '') || null,
      targetDate: String(fields.get('targetDate') ?? '') || null,
      status: String(fields.get('status')) as ProjectStatus,
    })
  }

  return (
    <form className="ui-panel" onSubmit={submit}>
      <fieldset className="space-y-4" disabled={create.isPending}>
        <label className="block text-sm font-medium">
          Project name
          <input name="name" className={fieldClass} minLength={3} maxLength={150} required {...errors.props('name')} />
          {errors.message('name')}
        </label>
        <label className="block text-sm font-medium">
          Description <span className="font-normal text-secondary">(optional)</span>
          <textarea rows={4} maxLength={2000} name="description" className={fieldClass} {...errors.props('description')} />
          {errors.message('description')}
        </label>
        {isOwner ? (
          members.isPending ? <LoadingState>Loading eligible managers…</LoadingState> : members.isError ? (
            <div>
              <p role="alert" className={errorClass}>{apiErrorMessage(members.error)}</p>
              <button type="button" className={`mt-2 text-sm ${linkClass}`} onClick={() => void members.refetch()}>Try again</button>
            </div>
          ) : (
            <label className="block text-sm font-medium">
              Project manager
              <select name="managerId" className={fieldClass} defaultValue={userId} required {...errors.props('managerId')}>
                {eligible?.map(({ user, role }) => <option key={user.id} value={user.id}>{user.name} ({role === 'OWNER' ? 'Owner' : 'Manager'})</option>)}
              </select>
              {errors.message('managerId')}
            </label>
          )
        ) : <p className="text-sm text-secondary">You’ll be assigned as this project’s manager.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-medium">
            Start date <span className="font-normal text-secondary">(optional)</span>
            <input name="startDate" type="date" className={fieldClass} value={startDate} onChange={(event) => setStartDate(event.target.value)} {...errors.props('startDate')} />
            {errors.message('startDate')}
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Target date <span className="font-normal text-secondary">(optional)</span>
            <input name="targetDate" type="date" className={fieldClass} min={startDate || undefined} {...errors.props('targetDate')} />
            {errors.message('targetDate')}
          </label>
        </div>
        <label className="block text-sm font-medium">
          Status
          <select name="status" className={fieldClass} defaultValue="PLANNED" {...errors.props('status')}>
            {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {errors.message('status')}
        </label>
        {create.error && <p role="alert" className={errorClass}>{apiErrorMessage(create.error)}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={submitClass} disabled={!canChooseManager || create.isPending}>{create.isPending ? 'Creating…' : 'Create project'}</button>
          <Link to={`/workspaces/${workspace.id}/projects`} className="ui-button ui-secondary mt-2">Cancel</Link>
        </div>
      </fieldset>
    </form>
  )
}

export function ProjectCreatePage({ userId }: { userId: string }) {
  const { workspaceId = '' } = useParams()
  const workspace = useQuery({
    queryKey: workspaceKeys.details(userId, workspaceId),
    queryFn: ({ signal }) => getWorkspace(workspaceId, signal),
    retry: false,
    gcTime: 0,
  })

  if (workspace.isPending) return <LoadingState>Loading workspace…</LoadingState>
  if (workspace.isError) {
    const denied = workspace.error instanceof ApiError && workspace.error.status === 404
    return <p role="alert" className={errorClass}>{denied ? 'You don’t have access to this workspace.' : apiErrorMessage(workspace.error)}</p>
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      <Link to={`/workspaces/${workspace.data.id}`} className="ui-button ui-ghost -ml-3"><ChevronLeft size={16} aria-hidden="true" />Back to workspace</Link>
      <PageHeader title="Create project" description={workspace.data.name} />
      {workspace.data.myRole === 'DEVELOPER' ? (
        <p role="alert" className={`mt-4 ${errorClass}`}>Only workspace owners and managers can create projects.</p>
      ) : <ProjectForm key={workspace.data.id} workspace={workspace.data} userId={userId} />}
    </div>
  )
}
