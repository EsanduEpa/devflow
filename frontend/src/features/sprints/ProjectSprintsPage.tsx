import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { EmptyState, LoadingState, PageHeader } from '../../shared/ui'
import { getProject, projectKeys, type Project } from '../projects/api'
import { getWorkspace, workspaceKeys } from '../workspaces/api'
import { createSprint, listSprints, sprintKeys, type SprintFields } from './api'
import { Pager, SprintBadge, SprintDates, SprintLoadError } from './sprint-ui'
import { SprintDetails } from './SprintDetails'

function CreateSprint({ projectId, userId, onCancel }: { projectId: string; userId: string; onCancel: () => void }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const creation = useMutation({
    mutationFn: (fields: SprintFields) => createSprint(projectId, fields),
    onSuccess: async (sprint) => {
      await client.invalidateQueries({ queryKey: sprintKeys.project(userId, projectId) })
      void navigate(`/projects/${projectId}/sprints/${sprint.id}`)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    creation.mutate({
      name: String(fields.get('name')), startDate: String(fields.get('startDate')), endDate: String(fields.get('endDate')),
    })
  }

  return <form className="ui-panel max-w-2xl space-y-4" onSubmit={submit}>
    <h2 className="text-lg font-semibold">Plan a sprint</h2>
    {creation.isError && <p role="alert" className={errorClass}>{apiErrorMessage(creation.error)}</p>}
    <fieldset disabled={creation.isPending} className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium sm:col-span-2">Sprint name
        <input name="name" className={fieldClass} required minLength={3} maxLength={150} autoFocus />
      </label>
      <label className="block text-sm font-medium">Start date
        <input name="startDate" type="date" className={fieldClass} required />
      </label>
      <label className="block text-sm font-medium">End date
        <input name="endDate" type="date" className={fieldClass} required />
      </label>
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button className="ui-button ui-primary" disabled={creation.isPending}>{creation.isPending ? 'Creating…' : 'Create sprint'}</button>
      <button className="ui-button ui-secondary" type="button" disabled={creation.isPending} onClick={onCancel}>Cancel</button>
    </div>
  </form>
}

function SprintList({ project, userId, canManage }: { project: Project; userId: string; canManage: boolean }) {
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const list = useQuery({
    queryKey: sprintKeys.list(userId, project.id, page),
    queryFn: ({ signal }) => listSprints(project.id, page, signal), retry: false,
  })

  return <>
    <PageHeader title="Sprints" description={project.name} actions={canManage && !creating &&
      <button className="ui-button ui-primary" onClick={() => setCreating(true)}><Plus size={17} aria-hidden="true" />New sprint</button>} />
    {project.status === 'ARCHIVED' && <p className="text-sm text-secondary">Restore this project to change its sprints.</p>}
    {canManage && creating && <CreateSprint projectId={project.id} userId={userId} onCancel={() => setCreating(false)} />}
    {list.isPending && <LoadingState>Loading sprints…</LoadingState>}
    {list.isError && <SprintLoadError error={list.error} onRetry={() => void list.refetch()} />}
    {list.isSuccess && <>
      {list.data.data.length === 0 && <EmptyState icon={<CalendarRange size={18} />} title="No sprints on this page" />}
      <ul className="grid gap-3 lg:grid-cols-2">
        {list.data.data.map((sprint) => <li key={sprint.id} className="ui-panel min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link className={`${linkClass} min-w-0 break-words font-semibold`} to={sprint.id}>{sprint.name}</Link>
            <SprintBadge sprint={sprint} />
          </div>
          <SprintDates sprint={sprint} />
          <p className="mt-3 text-sm text-secondary">{sprint.progress.completedTasks} of {sprint.progress.totalTasks} tasks done</p>
        </li>)}
      </ul>
      <Pager page={page} total={list.data.pagination.totalPages} onPage={setPage} />
    </>}
  </>
}

function ProjectSprintContent({ project, userId, sprintId }: { project: Project; userId: string; sprintId?: string }) {
  const workspace = useQuery({
    queryKey: workspaceKeys.details(userId, project.workspaceId),
    queryFn: ({ signal }) => getWorkspace(project.workspaceId, signal), retry: false,
  })
  const role = workspace.data?.myRole
  const canManage = workspace.isSuccess && project.status !== 'ARCHIVED'
    && (role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId))

  return <div className="w-full min-w-0 max-w-6xl space-y-5">
    {workspace.isError && <SprintLoadError error={workspace.error} onRetry={() => void workspace.refetch()} />}
    {sprintId
      ? <SprintDetails key={sprintId} project={project} sprintId={sprintId} userId={userId} canManage={canManage} />
      : <SprintList project={project} userId={userId} canManage={canManage} />}
  </div>
}

export function ProjectSprintsPage({ userId }: { userId: string }) {
  const params = useParams()
  const projectId = (params.projectId ?? '').toLowerCase()
  const project = useQuery({
    queryKey: projectKeys.details(userId, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal), retry: false, gcTime: 0,
  })
  if (project.isPending) return <LoadingState>Loading project…</LoadingState>
  if (project.isError) return <section className="ui-panel max-w-xl">
    <SprintLoadError error={project.error} onRetry={() => void project.refetch()} />
    <Link className={`${linkClass} mt-3 inline-block`} to="/workspaces">All workspaces</Link>
  </section>
  return <ProjectSprintContent key={projectId} project={project.data} userId={userId} sprintId={params.sprintId?.toLowerCase()} />
}
