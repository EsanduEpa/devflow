import { NotificationBell } from '../features/notifications/NotificationBell'
import { useLiveSocket } from '../features/realtime/useLiveSocket'
import { useProjectLive } from '../features/realtime/useProjectLive'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, matchPath, useLocation, useNavigate, type Location } from 'react-router'
import { PanelsTopLeft, Building2, CalendarRange, ChevronDown, ChevronRight, FolderKanban, Folders, LayoutDashboard, ListTodo,
  LogOut, Menu, Settings, UserRound, UsersRound, X, type LucideIcon } from 'lucide-react'
import { authErrorMessage, logout, type PublicUser } from '../features/auth/api'
import { getProject, projectKeys } from '../features/projects/api'
import { getTask, taskKey } from '../features/tasks/api'
import { listWorkspaces, workspaceKeys } from '../features/workspaces/api'
import { roleLabels } from '../features/workspaces/workspace-labels'
import { errorClass, fieldClass } from './form-styles'
import type { Theme } from './theme'
import { ThemeToggle } from './ThemeToggle'
import { Brand, Modal } from './ui'

function SideLink({ to, label, icon: Icon, active, onFollow }: {
  to: string
  label: string
  icon: LucideIcon
  active: boolean
  onFollow: () => void
}) {
  return <Link className="nav-item" to={to} aria-current={active ? 'page' : undefined} onClick={onFollow}>
    <Icon size={17} aria-hidden="true" />{label}
  </Link>
}

function AccountMenu({ user, theme, onToggle }: { user: PublicUser; theme: Theme; onToggle: () => void }) {
  const details = useRef<HTMLDetailsElement>(null)
  const summary = useRef<HTMLElement>(null)
  const queryClient = useQueryClient()
  const action = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ['current-user'] })
      queryClient.setQueryData(['current-user'], null)
    },
  })

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (details.current?.open && event.target instanceof Node && !details.current.contains(event.target)) details.current.open = false
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  return (
    <details ref={details} className="relative shrink-0" onKeyDown={(event) => {
      if (event.key === 'Escape' && details.current?.open) {
        details.current.open = false
        summary.current?.focus()
      }
    }}>
      <summary ref={summary} aria-label="Account menu" className="ui-button ui-ghost list-none px-1.5 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-selected text-xs font-semibold text-accent-ink" aria-hidden="true">
          {user.name.trim().at(0)?.toUpperCase()}
        </span>
        <span className="hidden max-w-38 truncate sm:inline">{user.name}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="absolute top-full right-0 z-20 mt-1.5 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-1.5 shadow-lg">
        <div className="mb-1 border-b border-line px-3 py-2">
          <p className="break-words font-semibold">{user.name}</p>
          <p className="break-all text-xs text-secondary">{user.email}</p>
        </div>
        <Link to="/profile" className="nav-item" onClick={() => { if (details.current) details.current.open = false }}>
          <UserRound size={16} aria-hidden="true" />Profile settings
        </Link>
        <ThemeToggle theme={theme} onToggle={onToggle} />
        <button type="button" className="nav-item disabled:opacity-60" disabled={action.isPending} onClick={() => action.mutate()}>
          <LogOut size={16} aria-hidden="true" />{action.isPending ? 'Logging out…' : 'Log out'}
        </button>
        {action.error && <p className={errorClass} role="alert">{authErrorMessage(action.error)}</p>}
      </div>
    </details>
  )
}

export function AppShell({ user, theme, onToggle, current, children }: {
  user: PublicUser
  theme: Theme
  onToggle: () => void
  current: Location
  children: ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [revoked, setRevoked] = useState<{ projectId: string; path: string } | null>(null)
  const actual = useLocation()
  const navigate = useNavigate()
  const path = current.pathname
  const taskId = matchPath('/tasks/:taskId', path)?.params.taskId ?? ''
  const task = useQuery({
    queryKey: taskKey(user.id, taskId),
    queryFn: ({ signal }) => getTask(taskId, signal),
    enabled: !!taskId && revoked?.path !== path, retry: false, gcTime: 0,
  })
  const projectId = (matchPath('/projects/:projectId/*', path)?.params.projectId ?? task.data?.projectId ?? '').toLowerCase()
  const accessLost = revoked?.projectId === projectId || revoked?.path === path
  const projectQuery = useQuery({
    queryKey: projectKeys.details(user.id, projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
    enabled: !!projectId && !accessLost, retry: false, gcTime: 0,
  })
  const project = projectQuery.isSuccess && !accessLost ? projectQuery.data : undefined
  const workspaceId = (matchPath('/workspaces/:workspaceId/*', path)?.params.workspaceId ?? project?.workspaceId ?? '').toLowerCase()
  const workspaces = useQuery({
    queryKey: workspaceKeys.list(user.id), queryFn: ({ signal }) => listWorkspaces(signal), retry: false, gcTime: 0,
  })
  const workspace = workspaces.isSuccess ? workspaces.data.find(({ id }) => id === workspaceId) : undefined
  const workspacePath = workspace ? `/workspaces/${workspace.id}` : undefined
  const projectPath = project ? `/projects/${project.id}` : undefined
  const canManage = workspace?.myRole === 'OWNER' || (workspace?.myRole === 'MANAGER' && project?.managerId === user.id)

  const openTaskId = matchPath('/tasks/:taskId', actual.pathname)?.params.taskId?.toLowerCase()
  const socket = useLiveSocket(user.id)
  // Keep the last authorized subscription long enough to receive revocation after a failed refetch.
  const liveProject = accessLost ? undefined : projectQuery.data
  useProjectLive({
    socket,
    userId: user.id,
    projectId: liveProject?.id,
    workspaceId: liveProject?.workspaceId,
    taskId: openTaskId,
    onRevoked: (id) => setRevoked({ projectId: id, path }),
  })

  useEffect(() => {
    const width = matchMedia('(min-width: 1024px)')
    function closeOnDesktop() { if (width.matches) setMobileOpen(false) }
    width.addEventListener('change', closeOnDesktop)
    return () => width.removeEventListener('change', closeOnDesktop)
  }, [])

  function link(to: string, label: string, icon: LucideIcon, active = path === to) {
    return <SideLink to={to} label={label} icon={icon} active={active} onFollow={() => setMobileOpen(false)} />
  }

  function sidebar(mobile: boolean) {
    return <>
      <div className="mb-5 flex shrink-0 items-center justify-between gap-2">
        <Link to="/workspaces" onClick={() => setMobileOpen(false)}><Brand /></Link>
        {mobile && <button type="button" className="ui-button ui-ghost p-2" aria-label="Close navigation" autoFocus onClick={() => setMobileOpen(false)}>
          <X size={19} aria-hidden="true" />
        </button>}
      </div>
      <nav aria-label="Main navigation" className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-secondary">
            Workspace
            <select className={`${fieldClass} truncate`} value={workspace?.id ?? ''} onChange={(event) => {
              const id = event.target.value
              setMobileOpen(false)
              void navigate(id ? `/workspaces/${id}` : '/workspaces')
            }} disabled={!workspaces.isSuccess || workspaces.data.length === 0}>
              <option value="">{workspaces.isPending ? 'Loading workspaces…' : 'Choose a workspace'}</option>
              {workspaces.data?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          {workspace && <p className="mt-2 truncate px-1 text-xs text-secondary">{roleLabels[workspace.myRole]}</p>}
        </div>
        {link('/workspaces', 'All workspaces', Building2)}
        {workspacePath && <div className="space-y-1 border-t border-line pt-3">
          {link(workspacePath, 'Overview', PanelsTopLeft)}
          {link(`${workspacePath}/projects`, 'Projects', Folders, path.startsWith(`${workspacePath}/projects`))}
          {link(`${workspacePath}/members`, 'Members', UsersRound)}
          {workspace?.myRole === 'OWNER' && link(`${workspacePath}/settings`, 'Workspace settings', Settings)}
        </div>}
        {projectPath && project && <div className="space-y-1 border-t border-line pt-3">
          <p className="truncate px-3 py-1 text-xs font-semibold text-secondary" title={project.name}>{project.name}</p>
          {link(projectPath, 'Dashboard', LayoutDashboard, path === projectPath || path === `${projectPath}/dashboard`)}
          {link(`${projectPath}/board`, 'Board', FolderKanban)}
          {link(`${projectPath}/sprints`, 'Sprints', CalendarRange, path.startsWith(`${projectPath}/sprints`))}
          {link(`${projectPath}/tasks`, 'Task list', ListTodo, path === `${projectPath}/tasks` || Boolean(taskId) || path === `${projectPath}/tasks/new`)}
          {canManage && link(`${projectPath}/settings`, 'Project settings', Settings)}
        </div>}
      </nav>
    </>
  }

  return (
    <div className="flex min-h-dvh bg-app">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:rounded-md focus:bg-surface focus:p-3">Skip to content</a>
      <aside className="app-sidebar">{sidebar(false)}</aside>
      {mobileOpen && <Modal labelledBy="mobile-navigation" className="mobile-nav" onClose={() => setMobileOpen(false)}>
        <h2 className="sr-only" id="mobile-navigation">Navigation</h2>
        {sidebar(true)}
      </Modal>}
      <div className="min-w-0 flex-1">
        <header className="app-topbar">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" className="ui-button ui-ghost shrink-0 p-2 lg:hidden" aria-label="Open navigation"
              aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} aria-hidden="true" /></button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm sm:gap-2">
              {workspacePath && workspace
                ? <Link to={workspacePath} title={workspace.name} className="truncate text-secondary hover:text-ink">{workspace.name}</Link>
                : <Link to="/workspaces" className="truncate font-medium text-ink">DevFlow</Link>}
              {projectPath && project && <>
                <ChevronRight size={14} className="shrink-0 text-secondary" aria-hidden="true" />
                <Link to={projectPath} title={project.name} className="min-w-0 truncate font-medium text-ink hover:text-accent-ink">{project.name}</Link>
              </>}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell key={`notifications-${actual.key}`} userId={user.id} />
            <AccountMenu key={`account-${actual.key}`} user={user} theme={theme} onToggle={onToggle} />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="app-content">
          {accessLost ? <section className="ui-panel max-w-xl">
            <p className={errorClass} role="alert">You no longer have access to this project.</p>
            <Link to="/workspaces" className="ui-button ui-secondary mt-3" onClick={() => setRevoked(null)}>All workspaces</Link>
          </section> : children}
        </main>
      </div>
    </div>
  )
}
