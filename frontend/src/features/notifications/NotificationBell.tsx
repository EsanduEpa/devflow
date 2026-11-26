import { useQuery } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { getUnreadCount, notificationKeys } from './api'
import { NotificationInbox } from './NotificationInbox'

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const panelId = useId()
  const titleId = useId()
  const unread = useQuery({
    queryKey: notificationKeys.unread(userId),
    queryFn: ({ signal }) => getUnreadCount(signal),
    retry: false,
  })
  const count = unread.isSuccess ? unread.data : 0

  function closeAndFocus() {
    setOpen(false)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    heading.current?.focus()
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        closeAndFocus()
      }
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [open])

  return <div ref={root} className="shrink-0">
    <button ref={trigger} type="button" className="ui-button ui-ghost px-2 aria-expanded:bg-selected aria-expanded:text-accent-ink"
      title="Notifications" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(!open)}>
      <Bell size={19} aria-hidden="true" />
      {count > 0 && <span className="rounded-full bg-action px-1.5 text-xs tabular-nums text-on-action" aria-hidden="true">
        {count > 99 ? '99+' : count}
      </span>}
    </button>
    {open && <section id={panelId} role="dialog" aria-labelledby={titleId}
      className="absolute top-full right-4 z-20 mt-1.5 flex max-h-[min(32rem,calc(100dvh-5rem))] w-[min(25rem,calc(100%-2rem))] flex-col overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-xl sm:right-6 lg:right-8">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-1 pr-2 pl-4">
        <h2 ref={heading} id={titleId} tabIndex={-1} className="text-lg font-semibold">Notifications</h2>
        <button type="button" className="ui-button ui-ghost px-2" aria-label="Close notifications" onClick={closeAndFocus}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-2">
        <NotificationInbox userId={userId} onFollow={() => setOpen(false)} />
      </div>
    </section>}
  </div>
}
