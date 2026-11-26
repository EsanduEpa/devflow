import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import type { PublicUser } from '../auth/api'
import { notificationKeys } from '../notifications/api'

export type ProjectEvent = {
  eventId: string
  projectId: string
  kind: 'task.changed' | 'task.deleted' | 'comment.changed' | 'sprint.changed' | 'project.changed'
  taskId?: string
  version?: number
}
type Ack = { data: { projectId: string } } | { error: { code: string; message: string } }
type ServerEvents = {
  'project:changed': (event: ProjectEvent) => void
  'project:access-revoked': (event: { projectId: string }) => void
  'notifications:changed': () => void
}
type ClientEvents = {
  'project:subscribe': (input: { projectId: string }, ack: (reply: Ack) => void) => void
  'project:unsubscribe': (input: { projectId: string }) => void
}

export type LiveSocket = Socket<ServerEvents, ClientEvents>

export function useLiveSocket(userId: string): LiveSocket {
  const client = useQueryClient()
  const socket = useMemo<LiveSocket>(() => io({ autoConnect: false, transports: ['websocket'], forceNew: true }), [])

  useEffect(() => {
    let active = true
    let retry: ReturnType<typeof setTimeout> | undefined
    function refreshInbox() {
      void client.invalidateQueries({ queryKey: notificationKeys.all(userId) })
    }
    async function checkSession() {
      await client.invalidateQueries({ queryKey: ['current-user'] })
      if (active && client.getQueryData<PublicUser | null>(['current-user'])?.id === userId) socket.connect()
    }

    const connected = () => { clearTimeout(retry); refreshInbox() }
    const disconnected = (reason: string) => {
      clearTimeout(retry)
      if (active && reason === 'io server disconnect') void checkSession()
    }
    const failed = (error: Error & { data?: { code?: string } }) => {
      if (active && error.data?.code === 'UNAUTHENTICATED') void client.invalidateQueries({ queryKey: ['current-user'] })
      else if (active && error.data?.code === 'UNAVAILABLE') retry = setTimeout(() => socket.connect(), 2_000)
    }
    socket.on('notifications:changed', refreshInbox)
    socket.on('connect', connected)
    socket.on('disconnect', disconnected)
    socket.on('connect_error', failed)
    const start = setTimeout(() => { if (active) socket.connect() }, 0)
    return () => {
      active = false
      clearTimeout(start)
      clearTimeout(retry)
      socket.off('notifications:changed', refreshInbox)
      socket.off('connect', connected)
      socket.off('disconnect', disconnected)
      socket.off('connect_error', failed)
      socket.disconnect()
    }
  }, [client, socket, userId])
  return socket
}
