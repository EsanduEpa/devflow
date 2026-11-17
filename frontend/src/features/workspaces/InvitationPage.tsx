import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { apiErrorMessage } from '../../shared/api'
import { cardClass, errorClass, linkClass, submitClass } from '../../shared/form-styles'
import { logout, type PublicUser } from '../auth/api'
import { workspaceKeys } from './api'
import { acceptInvitation, previewInvitation } from './invitation-api'
import { formatDate, roleLabels } from './workspace-labels'

export function InvitationPage({ user }: { user: PublicUser | null }) {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: ({ signal }) => previewInvitation(token, signal),
    retry: false,
    gcTime: 0,
  })

  const accept = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: (workspace) => {
      if (user) void queryClient.invalidateQueries({ queryKey: workspaceKeys.list(user.id) })
      void navigate(`/workspaces/${workspace.id}`, { replace: true })
    },
  })

  const switchAccount = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      accept.reset()
      await queryClient.cancelQueries({ queryKey: ['current-user'] })
      queryClient.setQueryData(['current-user'], null)
    },
  })

  return (
    <section className={cardClass}>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Workspace invitation</h1>
      {preview.isPending ? <p role="status" className="mt-4">Checking the invitation…</p> : preview.isError ? (
        <p role="alert" className={`mt-4 ${errorClass}`}>{apiErrorMessage(preview.error)}</p>
      ) : (
        <>
          <h2 className="mt-4 break-words text-xl font-semibold">{preview.data.workspaceName}</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div><dt className="inline font-medium">Role</dt><dd className="ml-2 inline">{roleLabels[preview.data.role]}</dd></div>
            <div><dt className="inline font-medium">Invited email</dt><dd className="ml-2 inline break-all">{preview.data.maskedEmail}</dd></div>
            <div><dt className="inline font-medium">Expires</dt><dd className="ml-2 inline"><time dateTime={preview.data.expiresAt}>{formatDate(preview.data.expiresAt)}</time></dd></div>
          </dl>
          {user ? (
            <div className="mt-6 space-y-3">
              <p className="break-all text-sm text-slate-700">Signed in as {user.email}</p>
              {(accept.error || switchAccount.error) && (
                <p role="alert" className={errorClass}>{apiErrorMessage(accept.error || switchAccount.error)}</p>
              )}
              <button className={submitClass} disabled={accept.isPending || switchAccount.isPending} onClick={() => accept.mutate()}>
                {accept.isPending ? 'Joining…' : 'Accept invitation'}
              </button>
              <button className={`text-sm ${linkClass}`} disabled={accept.isPending || switchAccount.isPending} onClick={() => switchAccount.mutate()}>
                {switchAccount.isPending ? 'Signing out…' : 'Use a different account'}
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
              <Link to="/login" replace state={{ invitationToken: token }} className="rounded-lg bg-indigo-700 px-4 py-2.5 font-medium text-white hover:bg-indigo-800">Log in to accept</Link>
              <Link to="/register" replace state={{ invitationToken: token }} className={linkClass}>Create an account</Link>
            </div>
          )}
        </>
      )}
      <Link to="/" replace className={`mt-6 inline-block text-sm ${linkClass}`}>Back to DevFlow</Link>
    </section>
  )
}
