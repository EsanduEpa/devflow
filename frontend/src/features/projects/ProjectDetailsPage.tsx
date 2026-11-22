import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { Plus } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass } from '../../shared/form-styles'
import { Badge, LoadingState, PageHeader } from '../../shared/ui'
import { ProjectDashboard } from '../dashboard/ProjectDashboard'
import { listWorkspaceMembers, workspaceKeys } from '../workspaces/api'
import { getProject, projectKeys, type Project } from './api'
import { projectStatusLabels, projectStatusTones } from './project-labels'
import { ProjectMembers } from './ProjectMembers'
import { ProjectSettings } from './ProjectSettings'

function ProjectOverview({ project, userId, settings }: { project: Project; userId: string; settings: boolean }) {
  const location = useLocation()
  const members = useQuery({
    queryKey: workspaceKeys.members(userId, project.workspaceId),
    queryFn: ({ signal }) => listWorkspaceMembers(project.workspaceId, signal), retry: false, gcTime: 0,
  })
  const manager = members.isSuccess ? members.data.find(({ user }) => user.id === project.managerId) : undefined
  const role = members.isSuccess ? members.data.find(({ user }) => user.id === userId)?.role : undefined
  const canManage = role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId)

  if (settings) {
    if (members.isPending) return <LoadingState>Checking project permissions…</LoadingState>
    if (members.isSuccess && canManage) {
      return <ProjectSettings project={project} userId={userId} isOwner={role === 'OWNER'} workspaceMembers={members.data} />
    }
    return (
      <section className="ui-panel max-w-xl">
        <p className={errorClass} role="alert">{members.isError ? apiErrorMessage(members.error)
          : 'Only the workspace owner or assigned project manager can manage this project.'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/projects/${project.id}`} className="ui-button ui-secondary">Back to project</Link>
          {members.isError && <button className="ui-button ui-secondary" onClick={() => void members.refetch()}>Try again</button>}
        </div>
      </section>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-5">
      <PageHeader title={project.name} description={project.description}
        meta={<Badge tone={projectStatusTones[project.status]}>{projectStatusLabels[project.status]}</Badge>}
        actions={project.status !== 'ARCHIVED' && <Link to={`/projects/${project.id}/tasks/new`} state={{ taskBackground: location }}
          className="ui-button ui-primary"><Plus size={17} aria-hidden="true" />Create task</Link>} />
      <ProjectDashboard projectId={project.id} userId={userId} />
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <section className="ui-panel" aria-labelledby="project-details">
          <h2 id="project-details" className="text-lg font-semibold">Project details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div className="col-span-2 min-w-0">
              <dt className="text-xs font-medium text-secondary">Project manager</dt>
              <dd className="mt-1 break-words">{manager?.user.name ?? (members.isPending ? 'Loading…' : 'Unavailable')}</dd>
            </div>
            <div><dt className="text-xs font-medium text-secondary">Start date</dt><dd className="mt-1">{formatDateOnly(project.startDate)}</dd></div>
            <div><dt className="text-xs font-medium text-secondary">Target date</dt><dd className="mt-1">{formatDateOnly(project.targetDate)}</dd></div>
          </dl>
        </section>
        <ProjectMembers key={project.id} project={project} userId={userId} />
      </div>
    </div>
  )
}

export function ProjectDetailsPage({ userId, settings = false }: { userId: string; settings?: boolean }) {
  const projectId = (useParams().projectId ?? '').toLowerCase()
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal), retry: false, gcTime: 0,
  })

  if (project.isPending) return <LoadingState>Loading project…</LoadingState>
  if (project.isError) {
    const status = project.error instanceof ApiError ? project.error.status : undefined
    return (
      <section className="ui-panel max-w-xl">
        <p className={errorClass} role="alert">{status === 404
          ? 'You don’t have access to this project. Check the link or choose a project from your workspace.' : apiErrorMessage(project.error)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/workspaces" className="ui-button ui-secondary">All workspaces</Link>
          {(status === undefined || status >= 500) && (
            <button className="ui-button ui-secondary" onClick={() => void project.refetch()}>Try again</button>
          )}
        </div>
      </section>
    )
  }
  return <ProjectOverview key={project.data.id} project={project.data} userId={userId} settings={settings} />
}
