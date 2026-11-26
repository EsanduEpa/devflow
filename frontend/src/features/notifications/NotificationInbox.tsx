import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Link } from 'react-router'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, linkClass } from '../../shared/form-styles'
import { Badge, EmptyState, LoadingState } from '../../shared/ui'
import { listNotifications, markNotificationRead, notificationKeys, type NotificationItem } from './api'

const headlines: Record<NotificationItem['kind'], string> = {
  ASSIGNMENT: 'Task assigned to you',
  MENTION: 'You were mentioned',
  REVIEW: 'Task ready for review',
  REOPENED: 'Task reopened',
  DEADLINE: 'Task deadline approaching',
  INVITATION: 'Workspace invitation',
}
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function NotificationInbox({ userId, onFollow }: { userId: string; onFollow: () => void }) {
  const [page, setPage] = useState(1)
  const client = useQueryClient()
  const inbox = useQuery({
    queryKey: notificationKeys.page(userId, page),
    queryFn: ({ signal }) => listNotifications(page, signal),
    retry: false,
    gcTime: 0,
  })
  const mark = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all(userId) }),
  })

  return <div className="space-y-3">
    {inbox.isPending && <LoadingState>Loading notifications…</LoadingState>}
    {inbox.isError && <div className="space-y-2">
      <p className={errorClass} role="alert">{apiErrorMessage(inbox.error)}</p>
      <button type="button" className="ui-button ui-secondary" onClick={() => void inbox.refetch()}>Retry loading notifications</button>
    </div>}
    {mark.error && <p className={errorClass} role="alert">{apiErrorMessage(mark.error)}</p>}
    {inbox.isSuccess && <>
      {inbox.data.data.length === 0 && <EmptyState icon={<Bell size={18} aria-hidden="true" />} title="No notifications yet." />}
      <ul className="divide-y divide-line" aria-label="Notifications">
        {inbox.data.data.map((item) => <li key={item.id} className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-3">
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{item.unavailable ? 'Item unavailable' : headlines[item.kind]}</h3>
              {!item.readAt && <Badge tone="accent">Unread</Badge>}
            </div>
            {item.task && <Link className={`${linkClass} break-words text-sm`} to={`/tasks/${item.task.id}`} onClick={(event) => {
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onFollow()
            }}>{item.task.title}</Link>}
            {item.workspaceName && <p className="break-words text-sm text-secondary">
              {item.workspaceName}. Ask the workspace Owner for the invitation link if you need it.
            </p>}
            {item.unavailable && <p className="text-sm text-secondary">The related item is no longer available to you.</p>}
            <time className="mt-1 block text-xs text-secondary" dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
          </div>
          {!item.readAt && <button type="button" className="ui-button ui-secondary" disabled={mark.isPending}
            onClick={() => mark.mutate(item.id)}>Mark as read</button>}
        </li>)}
      </ul>
      {inbox.data.pagination.totalPages > 1 && <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
        <button type="button" className="ui-button ui-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Newer</button>
        <span>Page {page} of {inbox.data.pagination.totalPages}</span>
        <button type="button" className="ui-button ui-secondary" disabled={page >= inbox.data.pagination.totalPages} onClick={() => setPage(page + 1)}>Older</button>
      </div>}
    </>}
  </div>
}
