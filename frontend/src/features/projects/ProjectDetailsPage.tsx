import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { errorClass, linkClass } from '../../shared/form-styles'
import { listWorkspaceMembers, workspaceKeys } from '../workspaces/api'
import { getProject, projectKeys, type Project } from './api'
import { formatProjectDate, projectStatusLabels } from './project-labels'
import { ProjectMembers } from './ProjectMembers'
import { ProjectSettings } from './ProjectSettings'

const panelClass = 'w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9'

function ProjectOverview({ project, userId, settings }: { project: Project; userId: string; settings: boolean }) {
  const members = useQuery({
    queryKey: workspaceKeys.members(userId, project.workspaceId),
    queryFn: ({ signal }) => listWorkspaceMembers(project.workspaceId, signal),
    retry: false,
    gcTime: 0,
  })
  const manager = members.isSuccess ? members.data.find(({ user }) => user.id === project.managerId) : undefined
  const role = members.isSuccess ? members.data.find(({ user }) => user.id === userId)?.role : undefined
  const canManage = role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId)

  if (settings) {
    if (members.isPending) return <p role="status">Checking project permissions…</p>
    if (members.isSuccess && canManage) {
      return <ProjectSettings project={project} userId={userId} isOwner={role === 'OWNER'} workspaceMembers={members.data} />
    }
    return (
      <section className={panelClass}>
        <Link to={`/projects/${project.id}`} className={`text-sm ${linkClass}`}>Back to project</Link>
        <p className={`mt-4 ${errorClass}`} role="alert">{members.isError ? apiErrorMessage(members.error)
          : 'Only the workspace owner or assigned project manager can manage this project.'}</p>
        {members.isError && <button className={`mt-3 text-sm ${linkClass}`} onClick={() => void members.refetch()}>Try again</button>}
      </section>
    )
  }

  return (
    <div className="w-full max-w-2xl space-y-5">
      <section className={panelClass}>
        <div className="flex flex-wrap justify-between gap-3">
          <Link to={`/workspaces/${project.workspaceId}`} className={`text-sm ${linkClass}`}>Back to workspace</Link>
          {canManage && <Link to={`/projects/${project.id}/settings`} className={`text-sm ${linkClass}`}>Project settings</Link>}
        </div>
        <h1 className="mt-4 break-words text-3xl font-semibold tracking-tight text-slate-950">{project.name}</h1>
        {project.description && <p className="mt-4 break-words whitespace-pre-wrap text-slate-700">{project.description}</p>}
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-sm">
          <div>
            <dt className="font-medium">Status</dt>
            <dd className="mt-1 text-slate-700">{projectStatusLabels[project.status]}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-medium">Project manager</dt>
            <dd className="mt-1 break-words text-slate-700">{manager?.user.name ?? (members.isPending ? 'Loading…' : 'Unavailable')}</dd>
          </div>
          <div>
            <dt className="font-medium">Start date</dt>
            <dd className="mt-1 text-slate-700">{formatProjectDate(project.startDate)}</dd>
          </div>
          <div>
            <dt className="font-medium">Target date</dt>
            <dd className="mt-1 text-slate-700">{formatProjectDate(project.targetDate)}</dd>
          </div>
        </dl>
      </section>
      <ProjectMembers key={project.id} project={project} userId={userId} />
    </div>
  )
}

export function ProjectDetailsPage({ userId, settings = false }: { userId: string; settings?: boolean }) {
  const { projectId = '' } = useParams()
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
    retry: false,
    gcTime: 0,
  })

  if (project.isPending) return <p role="status">Loading project…</p>
  if (project.isError) {
    const status = project.error instanceof ApiError ? project.error.status : undefined
    const message = status === 404
      ? 'You don’t have access to this project. Check the link or choose a project from your workspace.'
      : apiErrorMessage(project.error)
    return (
      <section className={panelClass}>
        <p className={errorClass} role="alert">{message}</p>
        <div className="mt-4 flex gap-4 text-sm">
          <Link to="/workspaces" className={linkClass}>All workspaces</Link>
          {(status === undefined || status >= 500) && (
            <button className={linkClass} onClick={() => void project.refetch()}>Try again</button>
          )}
        </div>
      </section>
    )
  }
  return <ProjectOverview key={project.data.id} project={project.data} userId={userId} settings={settings} />
}
