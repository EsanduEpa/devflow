import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Link } from 'react-router'
import { getUnreadCount, notificationKeys } from './api'

export function NotificationBell({ userId }: { userId: string }) {
  const unread = useQuery({
    queryKey: notificationKeys.unread(userId),
    queryFn: ({ signal }) => getUnreadCount(signal),
    retry: false,
  })
  const count = unread.isSuccess ? unread.data : 0
  return <Link to="/notifications" className="ui-button ui-ghost relative shrink-0 px-2" title="Notifications"
    aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
    <Bell size={19} aria-hidden="true" />
    {count > 0 && <span className="rounded-full bg-action px-1.5 text-xs tabular-nums text-on-action" aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>}
  </Link>
}
