import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowRight, CalendarDays, Folder, Plus, UserRound } from 'lucide-react'
import { apiErrorMessage } from '../../shared/api'
import { formatDateOnly } from '../../shared/date-only'
import { errorClass, fieldClass } from '../../shared/form-styles'
import { Badge, EmptyState, LoadingState, PageHeader } from '../../shared/ui'
import { listWorkspaceMembers, workspaceKeys, type Workspace } from '../workspaces/api'
import { listProjects, projectKeys, type ProjectFilter } from './api'
import { projectStatusLabels, projectStatusTones } from './project-labels'

export function WorkspaceProjects({ workspace, userId, heading = false }: { workspace: Workspace; userId: string; heading?: boolean }) {
  const [status, setStatus] = useState<ProjectFilter>('')
  const [page, setPage] = useState(1)
  const projects = useQuery({
    queryKey: [...projectKeys.lists(userId, workspace.id), status, page],
    queryFn: ({ signal }) => listProjects(workspace.id, page, status, signal), retry: false, gcTime: 0,
  })
  const members = useQuery({
    queryKey: workspaceKeys.members(userId, workspace.id), queryFn: ({ signal }) => listWorkspaceMembers(workspace.id, signal),
    enabled: Boolean(projects.data?.data.length), retry: false, gcTime: 0,
  })
  const names = new Map(members.data?.map(({ user }) => [user.id, user.name]))
  const canCreate = workspace.myRole === 'OWNER' || workspace.myRole === 'MANAGER'
  const createLink = canCreate && <Link className="ui-button ui-primary" to={`/workspaces/${workspace.id}/projects/new`}>
    <Plus size={17} aria-hidden="true" />Create project
  </Link>

  return (
    <div className="space-y-4">
      {heading && <PageHeader title="Projects" description={workspace.name} actions={createLink} />}
      <section className="ui-panel" aria-label="Workspace projects">
        {!heading && <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Projects</h2>{createLink}
        </div>}
        <label className={`block max-w-52 text-sm font-medium ${heading ? '' : 'mt-4'}`}>
          Project status
          <select className={fieldClass} value={status} onChange={(event) => {
            setPage(1)
            setStatus(event.target.value as ProjectFilter)
          }}>
            <option value="">All unarchived</option>
            {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {projects.isPending ? <div className="mt-3"><LoadingState>Loading projects…</LoadingState></div> : projects.isError ? (
          <div className="mt-3">
            <p className={errorClass} role="alert">{apiErrorMessage(projects.error)}</p>
            <button className="ui-button ui-secondary mt-3" onClick={() => void projects.refetch()}>Try again</button>
          </div>
        ) : (
          <>
            {projects.data.data.length ? (
              <ul className="mt-4 divide-y divide-line" aria-label="Project results">
                {projects.data.data.map((project) => (
                  <li key={project.id}>
                    <Link to={`/projects/${project.id}`} className="group flex min-w-0 items-start gap-3 rounded-md px-2 py-3 hover:bg-muted">
                      <span className="ui-icon-box hidden sm:inline-flex"><Folder size={17} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="min-w-0 break-words font-semibold text-ink group-hover:text-accent-ink">{project.name}</span>
                          <Badge tone={projectStatusTones[project.status]}>{projectStatusLabels[project.status]}</Badge>
                        </div>
                        {project.description && <p className="mt-1 line-clamp-2 break-words text-secondary">{project.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
                          <span className="flex min-w-0 items-start gap-1.5"><UserRound size={14} className="shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">Manager · {names.get(project.managerId) ?? (members.isPending ? 'Loading…' : 'Unavailable')}</span></span>
                          {(project.startDate || project.targetDate) && <span className="flex items-start gap-1.5"><CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                            <span>{project.startDate && `Start ${formatDateOnly(project.startDate)}`}
                              {project.startDate && project.targetDate && ' · '}{project.targetDate && `Target ${formatDateOnly(project.targetDate)}`}</span></span>}
                        </div>
                      </div>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-secondary" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4"><EmptyState icon={<Folder size={18} aria-hidden="true" />}
                title={status ? 'No projects match this status.' : 'No unarchived projects are visible in this workspace yet.'}>
                {!status && canCreate && 'Create a project to start organizing your team’s tasks.'}
              </EmptyState></div>
            )}
            {(page > 1 || projects.data.pagination.totalPages > 1) && (
              <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="Project pages">
                <button type="button" className="ui-button ui-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="px-1 text-secondary">Page {page} of {Math.max(1, projects.data.pagination.totalPages)}</span>
                <button type="button" className="ui-button ui-secondary" disabled={page >= projects.data.pagination.totalPages}
                  onClick={() => setPage(page + 1)}>Next</button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  )
}
