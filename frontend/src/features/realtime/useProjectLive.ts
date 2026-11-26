import { useEffect, useEffectEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import type { PublicUser } from '../auth/api'
import { commentKeys } from '../comments/api'
import { projectKeys } from '../projects/api'
import { workspaceKeys } from '../workspaces/api'
import { projectQueries } from './project-cache'

type ProjectEvent = {
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
}
type ClientEvents = {
  'project:subscribe': (input: { projectId: string }, ack: (reply: Ack) => void) => void
  'project:unsubscribe': (input: { projectId: string }) => void
}

export function useProjectLive({
  userId, projectId, workspaceId, taskId, onRevoked,
}: { userId: string; projectId?: string; workspaceId?: string; taskId?: string; onRevoked: (projectId: string) => void }) {
  const client = useQueryClient()
  const currentScope = useEffectEvent(() => ({ projectId, workspaceId, taskId }))
  const reportRevoked = useEffectEvent((id: string) => onRevoked(id))

  useEffect(() => {
    if (!projectId) return
    const subscribedProjectId = projectId
    const socket: Socket<ServerEvents, ClientEvents> = io({ autoConnect: false, transports: ['websocket'] })
    const seen = new Set<string>()
    const changedTasks = new Set<string>()
    const changedComments = new Set<string>()
    let active = true
    let broad = false
    let membersChanged = false
    let flushTimer: ReturnType<typeof setTimeout> | undefined

    function flush() {
      flushTimer = undefined
      if (!active || currentScope().projectId !== subscribedProjectId) return
      const { taskId, workspaceId } = currentScope()
      if (broad) {
        const ids = [...changedTasks, ...changedComments]
        if (taskId) ids.push(taskId)
        void client.invalidateQueries(projectQueries(client, userId, subscribedProjectId, ids))
      } else {
        for (const id of changedComments) void client.invalidateQueries({ queryKey: commentKeys.history(userId, id) })
      }
      if (membersChanged && workspaceId) {
        void client.invalidateQueries({ queryKey: workspaceKeys.details(userId, workspaceId) })
        void client.invalidateQueries({ queryKey: workspaceKeys.members(userId, workspaceId) })
        void client.invalidateQueries({ queryKey: workspaceKeys.list(userId) })
        void client.invalidateQueries({ queryKey: projectKeys.lists(userId, workspaceId) })
      }
      broad = membersChanged = false
      changedTasks.clear()
      changedComments.clear()
    }

    function schedule() {
      if (!flushTimer) flushTimer = setTimeout(flush, 40)
    }

    function revoke({ projectId: revoked }: { projectId: string }) {
      if (!active || revoked !== subscribedProjectId || currentScope().projectId !== subscribedProjectId) return
      const { taskId, workspaceId } = currentScope()
      const queries = projectQueries(client, userId, revoked, taskId ? [taskId] : [])
      reportRevoked(revoked)
      client.removeQueries(queries)
      void client.invalidateQueries({ queryKey: workspaceKeys.list(userId) })
      if (workspaceId) void client.invalidateQueries({ queryKey: projectKeys.lists(userId, workspaceId) })
      active = false
      socket.disconnect()
    }

    function receive(event: ProjectEvent) {
      if (!active || event.projectId !== subscribedProjectId || currentScope().projectId !== subscribedProjectId || seen.has(event.eventId)) return
      seen.add(event.eventId)
      if (seen.size > 128) {
        const oldest = seen.values().next().value
        if (oldest) seen.delete(oldest)
      }
      if (event.kind === 'comment.changed' && event.taskId) changedComments.add(event.taskId)
      else {
        broad = true
        if (event.taskId) changedTasks.add(event.taskId)
      }
      if (event.kind === 'project.changed') membersChanged = true
      schedule()
    }

    async function checkSession() {
      await client.invalidateQueries({ queryKey: ['current-user'] })
      if (active && client.getQueryData<PublicUser | null>(['current-user'])?.id === userId) socket.connect()
    }

    let subscribeTimer: ReturnType<typeof setTimeout> | undefined
    function subscribe() {
      if (!active || currentScope().projectId !== subscribedProjectId || !socket.connected) return
      socket.timeout(5_000).emit('project:subscribe', { projectId: subscribedProjectId }, (error, reply) => {
        if (!active || !socket.connected) return
        if (error || ('error' in reply && reply.error.code === 'UNAVAILABLE')) {
          subscribeTimer = setTimeout(subscribe, 2_000)
          return
        }
        if ('error' in reply) {
          if (reply.error.code === 'NOT_FOUND') revoke({ projectId: subscribedProjectId })
          return
        }
        if (reply.data.projectId !== subscribedProjectId) return
        broad = membersChanged = true
        schedule()
      })
    }

    socket.on('project:changed', receive)
    socket.on('project:access-revoked', revoke)
    socket.on('connect', () => {
      seen.clear()
      clearTimeout(subscribeTimer)
      subscribe()
    })
    socket.on('disconnect', (reason) => {
      clearTimeout(subscribeTimer)
      if (active && reason === 'io server disconnect') void checkSession()
    })
    socket.on('connect_error', (error) => {
      if (active && error.data?.code === 'UNAUTHENTICATED') void client.invalidateQueries({ queryKey: ['current-user'] })
      else if (active && error.data?.code === 'UNAVAILABLE') subscribeTimer = setTimeout(() => socket.connect(), 2_000)
    })

    const start = setTimeout(() => { if (active) socket.connect() }, 0)
    return () => {
      active = false
      clearTimeout(start)
      clearTimeout(subscribeTimer)
      clearTimeout(flushTimer)
      if (socket.connected) socket.emit('project:unsubscribe', { projectId })
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [client, projectId, userId])
}
