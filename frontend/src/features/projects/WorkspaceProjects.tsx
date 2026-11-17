import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import type { Workspace } from '../workspaces/api'
import { listProjects, projectKeys, type ProjectFilter } from './api'
import { projectStatusLabels } from './project-labels'

const pageButtonClass = 'rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50'

export function WorkspaceProjects({ workspace, userId }: { workspace: Workspace; userId: string }) {
  const [status, setStatus] = useState<ProjectFilter>('')
  const [page, setPage] = useState(1)
  const projects = useQuery({
    queryKey: [...projectKeys.lists(userId, workspace.id), status, page],
    queryFn: ({ signal }) => listProjects(workspace.id, page, status, signal),
    retry: false,
    gcTime: 0,
  })

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="workspace-projects">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="workspace-projects" className="text-lg font-semibold">Projects</h2>
        {workspace.myRole !== 'DEVELOPER' && (
          <Link className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800"
            to={`/workspaces/${workspace.id}/projects/new`}>Create project</Link>
        )}
      </div>
      <label className="mt-4 block max-w-52 text-sm font-medium">
        Project status
        <select className={fieldClass} value={status} onChange={(event) => {
          setPage(1)
          setStatus(event.target.value as ProjectFilter)
        }}>
          <option value="">All unarchived</option>
          {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {projects.isPending ? <p className="mt-4 text-sm" role="status">Loading projects…</p> : projects.isError ? (
        <div className="mt-4">
          <p className={errorClass} role="alert">{apiErrorMessage(projects.error)}</p>
          <button className={`mt-2 text-sm ${linkClass}`} onClick={() => void projects.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          {projects.data.data.length ? (
            <ul className="mt-4 divide-y divide-slate-200" aria-label="Workspace projects">
              {projects.data.data.map((project) => (
                <li key={project.id}>
                  <Link to={`/projects/${project.id}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-3 text-sm hover:bg-slate-50">
                    <span className="min-w-0 break-words font-medium text-indigo-800">{project.name}</span>
                    <span className="text-slate-600">{projectStatusLabels[project.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-700">{status ? 'No projects match this status.' : 'No unarchived projects are visible in this workspace yet.'}</p>
          )}
          {(page > 1 || projects.data.pagination.totalPages > 1) && (
            <nav className="mt-4 flex flex-wrap items-center gap-3 text-sm" aria-label="Project pages">
              <button type="button" className={pageButtonClass} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {Math.max(1, projects.data.pagination.totalPages)}</span>
              <button type="button" className={pageButtonClass} disabled={page >= projects.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
