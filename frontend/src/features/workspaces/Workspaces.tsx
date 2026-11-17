import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router'
import { ApiError, apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { createWorkspace, getWorkspace, listWorkspaces, updateWorkspace, workspaceKeys, type Workspace } from './api'
import { WorkspaceForm } from './WorkspaceForm'
import { WorkspaceInvitations } from './WorkspaceInvitations'
import { WorkspaceMembers } from './WorkspaceMembers'
import { roleLabels } from './workspace-labels'

const panelClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7'

function workspaceUrl(workspaceId: string) {
  return `/workspaces/${workspaceId}`
}

function WorkspaceList({ userId, query }: { userId: string; query: ReturnType<typeof useWorkspaceList> }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dialog = useRef<HTMLDialogElement>(null)
  const create = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (workspace) => {
      dialog.current?.close()
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list(userId) })
      if (dialog.current) void navigate(workspaceUrl(workspace.id))
    },
  })

  function openDialog() {
    create.reset()
    dialog.current?.querySelector('form')?.reset()
    dialog.current?.showModal()
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Workspaces</h1>
        <button onClick={openDialog} className="rounded-lg bg-indigo-700 px-4 py-2.5 font-medium text-white hover:bg-indigo-800">
          New workspace
        </button>
      </div>
      {query.isPending ? <p role="status">Loading workspaces…</p> : query.isError ? (
        <section className={panelClass}>
          <p className={errorClass} role="alert">{apiErrorMessage(query.error)}</p>
          <button onClick={() => void query.refetch()} className={`mt-3 ${linkClass}`}>Try again</button>
        </section>
      ) : query.data.length ? (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Your workspaces">
          {query.data.map((workspace) => (
            <li key={workspace.id}>
              <Link to={workspaceUrl(workspace.id)} className={`block h-full hover:border-indigo-400 focus-visible:outline-indigo-600 ${panelClass}`}>
                <h2 className="break-words text-lg font-semibold text-slate-950">{workspace.name}</h2>
                <p className="mt-1 text-sm font-medium text-indigo-800">{roleLabels[workspace.myRole]}</p>
                {workspace.description && <p className="mt-2 break-words text-sm text-slate-700">{workspace.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className={panelClass}>You don’t belong to any workspaces yet. Create one to get started.</p>}
      <dialog
        ref={dialog}
        aria-labelledby="create-workspace-title"
        className={`m-auto w-11/12 max-w-lg backdrop:bg-slate-950/45 ${panelClass}`}
        onCancel={(event) => { if (create.isPending) event.preventDefault() }}
      >
        <h2 id="create-workspace-title" className="text-xl font-semibold text-slate-950">Create a workspace</h2>
        <WorkspaceForm onSubmit={create.mutate} onCancel={() => dialog.current?.close()} pending={create.isPending} error={create.error} />
      </dialog>
    </>
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
    <section className={panelClass}>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Workspace settings</h1>
      <p className="mt-2 break-words text-slate-700">{workspace.name}</p>
      {workspace.myRole === 'OWNER' ? (
        <WorkspaceForm initial={workspace} onSubmit={update.mutate} pending={update.isPending} error={update.error} saved={update.isSuccess} />
      ) : <p className={`mt-4 ${errorClass}`} role="alert">Only the workspace owner can edit these settings.</p>}
    </section>
  )
}

function WorkspacePage({ userId, workspaces, settings = false }: { userId: string; workspaces?: Workspace[]; settings?: boolean }) {
  const { workspaceId = '' } = useParams()
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: workspaceKeys.details(userId, workspaceId),
    queryFn: ({ signal }) => getWorkspace(workspaceId, signal),
    retry: false,
    gcTime: 0,
  })

  if (query.isPending) return <p role="status">Loading workspace…</p>
  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : undefined
    const message = status === 404
      ? 'You don’t have access to this workspace. Check the link or choose a workspace from your list.'
      : apiErrorMessage(query.error)
    return (
      <section className={panelClass}>
        <p className={errorClass} role="alert">{message}</p>
        {(status === undefined || status >= 500) && (
          <button onClick={() => void query.refetch()} className={`mt-3 ${linkClass}`}>Try again</button>
        )}
      </section>
    )
  }

  const workspace = query.data
  return (
    <>
      {workspaces && workspaces.length > 1 && workspaces.some(({ id }) => id === workspace.id) && (
        <label className="block max-w-xs text-sm font-medium">
          Switch workspace
          <select className={fieldClass} value={workspace.id} onChange={(event) => void navigate(workspaceUrl(event.target.value))}>
            {workspaces.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      )}
      {settings ? (
        <>
          <Link className={`text-sm ${linkClass}`} to={workspaceUrl(workspace.id)}>Back to workspace</Link>
          <WorkspaceSettings key={workspace.id} userId={userId} workspace={workspace} />
          {workspace.myRole === 'OWNER' && <WorkspaceInvitations key={`invites:${workspace.id}`} userId={userId} workspaceId={workspace.id} />}
        </>
      ) : (
        <>
          <section className={panelClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="break-words text-3xl font-semibold tracking-tight text-slate-950">{workspace.name}</h1>
                <p className="mt-2 text-sm font-medium text-indigo-800">{roleLabels[workspace.myRole]}</p>
              </div>
              {workspace.myRole === 'OWNER' && (
                <Link to={`${workspaceUrl(workspace.id)}/settings`} className={`text-sm ${linkClass}`}>Workspace settings</Link>
              )}
            </div>
            {workspace.description && <p className="mt-4 break-words whitespace-pre-wrap text-slate-700">{workspace.description}</p>}
          </section>
          <section className={panelClass} aria-labelledby="workspace-projects">
            <h2 id="workspace-projects" className="text-lg font-semibold">Projects</h2>
            <p className="mt-2 text-sm text-slate-700">Projects added to {workspace.name} will appear here.</p>
          </section>
          <WorkspaceMembers userId={userId} workspaceId={workspace.id} />
        </>
      )}
    </>
  )
}

function useWorkspaceList(userId: string) {
  return useQuery({
    queryKey: workspaceKeys.list(userId),
    queryFn: ({ signal }) => listWorkspaces(signal),
    retry: false,
    gcTime: 0,
  })
}

export function Workspaces({ userId }: { userId: string }) {
  const list = useWorkspaceList(userId)
  const workspaces = list.isError ? undefined : list.data
  return (
    <div className="w-full max-w-4xl space-y-5">
      <nav className="flex gap-4 text-sm" aria-label="Workspace navigation">
        <Link to="/" className={linkClass}>Home</Link>
        <Link to="/workspaces" className={linkClass}>All workspaces</Link>
      </nav>
      <Routes>
        <Route index element={<WorkspaceList userId={userId} query={list} />} />
        <Route path=":workspaceId" element={<WorkspacePage userId={userId} workspaces={workspaces} />} />
        <Route path=":workspaceId/settings" element={<WorkspacePage userId={userId} workspaces={workspaces} settings />} />
        <Route path="*" element={<Navigate to="/workspaces" replace />} />
      </Routes>
    </div>
  )
}
