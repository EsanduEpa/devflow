import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router'
import { ArrowRight, Building2, ChevronLeft, Plus } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { errorClass } from '../../shared/form-styles'
import { Badge, EmptyState, LoadingState, PageHeader } from '../../shared/ui'
import { ProjectCreatePage } from '../projects/ProjectCreatePage'
import { WorkspaceProjects } from '../projects/WorkspaceProjects'
import { createWorkspace, getWorkspace, listWorkspaces, updateWorkspace, workspaceKeys, type Workspace } from './api'
import { WorkspaceForm } from './WorkspaceForm'
import { WorkspaceInvitations } from './WorkspaceInvitations'
import { WorkspaceMembers } from './WorkspaceMembers'
import { roleLabels } from './workspace-labels'

function WorkspaceList({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dialog = useRef<HTMLDialogElement>(null)
  const query = useQuery({
    queryKey: workspaceKeys.list(userId), queryFn: ({ signal }) => listWorkspaces(signal), retry: false, gcTime: 0,
  })
  const create = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (workspace) => {
      dialog.current?.close()
      queryClient.setQueryData<Workspace[]>(workspaceKeys.list(userId), (current) =>
        current?.some(({ id }) => id === workspace.id) ? current : [...(current ?? []), workspace])
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list(userId) })
      void navigate(`/workspaces/${workspace.id}`)
    },
  })

  function openDialog() {
    create.reset()
    dialog.current?.querySelector('form')?.reset()
    dialog.current?.showModal()
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader title="Workspaces" description="Open a workspace to manage its projects and team." actions={
        <button onClick={openDialog} className="ui-button ui-primary"><Plus size={17} aria-hidden="true" />New workspace</button>
      } />
      {query.isPending ? <LoadingState>Loading workspaces…</LoadingState> : query.isError ? (
        <section className="ui-panel">
          <p className={errorClass} role="alert">{apiErrorMessage(query.error)}</p>
          <button onClick={() => void query.refetch()} className="ui-button ui-secondary mt-3">Try again</button>
        </section>
      ) : query.data.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Your workspaces">
          {query.data.map((workspace) => (
            <li key={workspace.id} className="min-w-0">
              <Link to={`/workspaces/${workspace.id}`} className="ui-panel group flex h-full min-w-0 flex-col gap-3 hover:border-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="ui-icon-box"><Building2 size={18} aria-hidden="true" /></span>
                  <ArrowRight size={16} className="text-secondary group-hover:text-accent-ink" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">{workspace.name}</h2>
                  {workspace.description && <p className="mt-1 line-clamp-2 break-words text-secondary">{workspace.description}</p>}
                </div>
                <div className="mt-auto"><Badge tone={workspace.myRole === 'OWNER' ? 'accent' : 'neutral'}>{roleLabels[workspace.myRole]}</Badge></div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Building2 size={18} aria-hidden="true" />} title="You don’t belong to any workspaces yet.">
        Create a workspace to get started or open an invitation from your team.
      </EmptyState>}
      <dialog ref={dialog} aria-labelledby="create-workspace-title"
        className="ui-panel fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto text-ink shadow-xl"
        onCancel={(event) => { if (create.isPending) event.preventDefault() }}>
        <h2 id="create-workspace-title" className="text-lg font-semibold">Create a workspace</h2>
        <WorkspaceForm onSubmit={create.mutate} onCancel={() => dialog.current?.close()} pending={create.isPending} error={create.error} />
      </dialog>
    </div>
  )
}

function WorkspaceSettings({ userId, workspace }: { userId: string; workspace: Workspace }) {
  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: (fields: Parameters<typeof updateWorkspace>[1]) => updateWorkspace(workspace.id, fields),
    onSuccess: async (updated) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.details(userId, workspace.id) })
      queryClient.setQueryData(workspaceKeys.details(userId, workspace.id), updated)
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list(userId) })
    },
  })

  return (
    <>
      <section className="ui-panel" aria-labelledby="workspace-details">
        <h2 className="text-lg font-semibold" id="workspace-details">Workspace details</h2>
        {workspace.myRole === 'OWNER' ? (
          <WorkspaceForm key={workspace.updatedAt} initial={workspace} onSubmit={update.mutate}
            pending={update.isPending} error={update.error} saved={update.isSuccess} />
        ) : <p className={`mt-4 ${errorClass}`} role="alert">Only the workspace owner can edit these settings.</p>}
      </section>
      {workspace.myRole === 'OWNER' && <>
        <WorkspaceMembers key={`members:${workspace.id}`} userId={userId} workspaceId={workspace.id} canManage />
        <WorkspaceInvitations key={`invites:${workspace.id}`} userId={userId} workspaceId={workspace.id} />
      </>}
    </>
  )
}

function WorkspacePage({ userId, view = 'overview' }: { userId: string; view?: 'overview' | 'projects' | 'members' | 'settings' }) {
  const workspaceId = (useParams().workspaceId ?? '').toLowerCase()
  const query = useQuery({
    queryKey: workspaceKeys.details(userId, workspaceId),
    queryFn: ({ signal }) => getWorkspace(workspaceId, signal), retry: false, gcTime: 0,
  })

  if (query.isPending) return <LoadingState>Loading workspace…</LoadingState>
  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : undefined
    return (
      <section className="ui-panel max-w-xl">
        <p className={errorClass} role="alert">{status === 404
          ? 'You don’t have access to this workspace. Check the link or choose a workspace from your list.' : apiErrorMessage(query.error)}</p>
        {(status === undefined || status >= 500) && (
          <button onClick={() => void query.refetch()} className="ui-button ui-secondary mt-3">Try again</button>
        )}
      </section>
    )
  }

  const workspace = query.data
  return (
    <div className="w-full min-w-0 max-w-6xl space-y-5">
      {view === 'settings' ? <>
        <Link className="ui-button ui-ghost -ml-3" to={`/workspaces/${workspace.id}`}><ChevronLeft size={16} aria-hidden="true" />Back to workspace</Link>
        <PageHeader title="Workspace settings" description={workspace.name} />
        {workspace.myRole === 'OWNER' && <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
          <a className="ui-button ui-secondary" href="#workspace-details">Details</a>
          <a className="ui-button ui-secondary" href="#workspace-members">Members</a>
          <a className="ui-button ui-secondary" href="#workspace-invitations">Invitations</a>
        </nav>}
        <WorkspaceSettings key={workspace.id} userId={userId} workspace={workspace} />
      </> : view === 'members' ? <>
        <PageHeader title="Workspace members" description={workspace.name} />
        <WorkspaceMembers key={workspace.id} userId={userId} workspaceId={workspace.id} canManage={workspace.myRole === 'OWNER'} />
      </> : <>
        {view === 'overview' && <PageHeader title={workspace.name} description={workspace.description}
          meta={<Badge tone="accent">{roleLabels[workspace.myRole]}</Badge>} />}
        <WorkspaceProjects key={workspace.id} workspace={workspace} userId={userId} heading={view === 'projects'} />
      </>}
    </div>
  )
}

export function Workspaces({ userId }: { userId: string }) {
  return (
    <Routes>
      <Route index element={<WorkspaceList userId={userId} />} />
      <Route path=":workspaceId" element={<WorkspacePage userId={userId} />} />
      <Route path=":workspaceId/projects" element={<WorkspacePage userId={userId} view="projects" />} />
      <Route path=":workspaceId/settings" element={<WorkspacePage userId={userId} view="settings" />} />
      <Route path=":workspaceId/members" element={<WorkspacePage userId={userId} view="members" />} />
      <Route path=":workspaceId/projects/new" element={<ProjectCreatePage userId={userId} />} />
      <Route path="*" element={<Navigate to="/workspaces" replace />} />
    </Routes>
  )
}
