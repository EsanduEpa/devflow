import { useEffect, useEffectEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { commentKeys } from '../comments/api'
import { projectKeys } from '../projects/api'
import { workspaceKeys } from '../workspaces/api'
import { projectQueries } from './project-cache'

import type { LiveSocket, ProjectEvent } from './useLiveSocket'

export function useProjectLive({
  socket, userId, projectId, workspaceId, taskId, onRevoked,
}: { socket: LiveSocket; userId: string; projectId?: string; workspaceId?: string; taskId?: string; onRevoked: (projectId: string) => void }) {
  const client = useQueryClient()
  const currentScope = useEffectEvent(() => ({ projectId, workspaceId, taskId }))
  const reportRevoked = useEffectEvent((id: string) => onRevoked(id))

  useEffect(() => {
    if (!projectId) return
    const subscribedProjectId = projectId
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

    const connected = () => {
      seen.clear()
      clearTimeout(subscribeTimer)
      subscribe()
    }
    const disconnected = () => clearTimeout(subscribeTimer)
    socket.on('project:changed', receive)
    socket.on('project:access-revoked', revoke)
    socket.on('connect', connected)
    socket.on('disconnect', disconnected)
    if (socket.connected) subscribe()
    return () => {
      active = false
      clearTimeout(subscribeTimer)
      clearTimeout(flushTimer)
      if (socket.connected) socket.emit('project:unsubscribe', { projectId })
      socket.off('project:changed', receive)
      socket.off('project:access-revoked', revoke)
      socket.off('connect', connected)
      socket.off('disconnect', disconnected)
    }
  }, [client, projectId, socket, userId])
}
