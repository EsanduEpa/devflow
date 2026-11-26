import { randomUUID } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'
import { parse } from 'cookie'
import type { RequestHandler } from 'express'
import { Server, type Socket } from 'socket.io'
import { z } from 'zod'
import type { AuthConfig } from '../../config/auth.js'
import { ApiError } from '../../shared/api-error.js'
import { objectId } from '../../shared/object-id.js'
import { authCookies, readSessionCookie } from '../auth/auth.cookies.js'
import type { AuthService } from '../auth/auth.service.js'
import type { ProjectService } from '../projects/project.service.js'

type ProjectChange = {
  projectId: string
  kind: 'task.changed' | 'task.deleted' | 'comment.changed' | 'sprint.changed' | 'project.changed'
  taskId?: string
  version?: number
}
type SubscriptionReply = { data: { projectId: string } } | { error: { code: string; message: string } }
type ClientEvents = {
  'project:subscribe': (input: unknown, ack?: (reply: SubscriptionReply) => void) => void
  'project:unsubscribe': (input: unknown, ack?: (reply: SubscriptionReply) => void) => void
}
type ServerEvents = {
  'notifications:changed': () => void
  'project:changed': (event: ProjectChange & { eventId: string }) => void
  'project:access-revoked': (event: { projectId: string }) => void
}
type SocketData = { userId: string; token: string; expiresAt: number; projects: Map<string, string> }
type LiveSocket = Socket<ClientEvents, ServerEvents, Record<never, never>, SocketData>

const subscriptionInput = z.strictObject({ projectId: objectId.transform((id) => id.toLowerCase()) })
const room = (projectId: string) => 'project:' + projectId
const unavailable = { code: 'UNAVAILABLE', message: 'Live updates are temporarily unavailable.' }

export function createRealtime(config: AuthConfig, checkIntervalMs = 15_000) {
  let io: Server<ClientEvents, ServerEvents, Record<never, never>, SocketData> | undefined
  let timer: NodeJS.Timeout | undefined
  let auth: Pick<AuthService, 'currentSession'>
  let projects: Pick<ProjectService, 'requireAccess'>
  let queue = Promise.resolve()
  let checking = false

  // A single server orders access-changing commits against authorization and emission.
  function ordered<T>(operation: () => Promise<T>) {
    const result = queue.then(operation)
    queue = result.then(() => undefined, () => undefined)
    return result
  }

  async function sessionIsCurrent(socket: LiveSocket) {
    if (!socket.connected) return false
    try {
      const { user, expiresAt } = await auth.currentSession(socket.data.token)
      socket.data.expiresAt = expiresAt.getTime()
      if (user.id === socket.data.userId && socket.data.expiresAt > Date.now()) return socket.connected
      socket.disconnect(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) socket.disconnect(true)
    }
    return false
  }

  async function projectIsCurrent(socket: LiveSocket, projectId: string) {
    try {
      await projects.requireAccess(socket.data.userId, projectId)
      return socket.connected
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        socket.data.projects.delete(projectId)
        await socket.leave(room(projectId))
        socket.emit('project:access-revoked', { projectId })
      }
      return false
    }
  }

  async function revalidate() {
    if (!io) return
    await Promise.all([...io.sockets.sockets.values()].map(async (socket) => {
      if (!await sessionIsCurrent(socket)) return
      await Promise.all([...socket.data.projects.keys()].map((projectId) => projectIsCurrent(socket, projectId)))
    }))
  }

  async function send(change: ProjectChange) {
    if (!io) return
    const recipients = io.sockets.adapter.rooms.get(room(change.projectId))
    if (!recipients?.size) return
    const event = { eventId: randomUUID(), ...change }
    await Promise.all([...recipients].map(async (socketId) => {
      const socket = io?.sockets.sockets.get(socketId)
      if (socket && await sessionIsCurrent(socket) && await projectIsCurrent(socket, change.projectId)) {
        if (socket.data.expiresAt <= Date.now()) socket.disconnect(true)
        else socket.emit('project:changed', event)
      }
    }))
  }

  function enqueue(operation: () => Promise<void>) {
    if (io) void ordered(operation).catch(() => console.error('DevFlow could not process a live update.'))
  }

  return {
    bind(sessionAuth: typeof auth, projectAccess: typeof projects) {
      auth = sessionAuth
      projects = projectAccess
    },

    attach(server: HttpServer) {
      const origins = new Set(config.allowedOrigins)
      const cookies = authCookies(config)
      io = new Server(server, {
        transports: ['websocket'],
        allowRequest(request, callback) {
          callback(null, origins.has(request.headers.origin ?? ''))
        },
      })
      io.use((socket, next) => {
        const token = readSessionCookie({ cookies: parse(socket.handshake.headers.cookie ?? '') }, cookies)
        void ordered(async () => {
          if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Log in to continue.')
          const { user, expiresAt } = await auth.currentSession(token)
          socket.data = { userId: user.id, token, expiresAt: expiresAt.getTime(), projects: new Map() }
        }).then(() => next(), (cause: unknown) => {
          const details = cause instanceof ApiError && cause.status === 401
            ? { code: cause.code, message: cause.message } : unavailable
          next(Object.assign(new Error(details.message), { data: details }))
        })
      })
      io.on('connection', (socket) => {
        async function changeSubscription(input: unknown, join: boolean): Promise<SubscriptionReply> {
          const parsed = subscriptionInput.safeParse(input)
          if (!parsed.success) return { error: { code: 'VALIDATION_ERROR', message: 'Supply a valid project ID.' } }
          const { projectId } = parsed.data
          if (!join) {
            socket.data.projects.delete(projectId)
            await socket.leave(room(projectId))
            return { data: { projectId } }
          }
          if (!await sessionIsCurrent(socket)) return { error: unavailable }
          try {
            const { project } = await projects.requireAccess(socket.data.userId, projectId)
            if (socket.connected) {
              await socket.join(room(projectId))
              socket.data.projects.set(projectId, project.workspaceId.toString())
            }
            return { data: { projectId } }
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
              return { error: { code: 'NOT_FOUND', message: 'The project was not found.' } }
            }
            return { error: unavailable }
          }
        }
        function request(input: unknown, join: boolean, ack: unknown) {
          void ordered(() => changeSubscription(input, join)).then(
            (reply) => { if (typeof ack === 'function') ack(reply) },
            () => { if (typeof ack === 'function') ack({ error: unavailable }) },
          )
        }
        socket.on('project:subscribe', (input, ack) => request(input, true, ack))
        socket.on('project:unsubscribe', (input, ack) => request(input, false, ack))
      })
      timer = setInterval(() => {
        if (checking) return
        checking = true
        enqueue(async () => {
          try { await revalidate() } finally { checking = false }
        })
      }, checkIntervalMs)
      timer.unref()
      return io
    },

    async close() {
      clearInterval(timer)
      const transport = io
      io = undefined
      transport?.disconnectSockets(true)
      transport?.engine.close()
      await queue
    },

    protect<Params, Res, Body, Query, Locals extends Record<string, unknown>>(
      handler: RequestHandler<Params, Res, Body, Query, Locals>,
    ): RequestHandler<Params, Res, Body, Query, Locals> {
      return async (request, response, next) => {
        if (!io) return handler(request, response, next)
        await ordered(async () => {
          await handler(request, response, next)
          if (response.statusCode < 400) await revalidate()
        })
      }
    },

    publish(change: ProjectChange) {
      enqueue(() => send(change))
    },

    notifyRecipients(recipientIds: string[]) {
      if (!recipientIds.length) return
      const recipients = new Set(recipientIds)
      enqueue(async () => {
        const sockets = [...(io?.sockets.sockets.values() ?? [])].filter((socket) => recipients.has(socket.data.userId))
        await Promise.all(sockets.map(async (socket) => {
          if (await sessionIsCurrent(socket) && socket.data.expiresAt > Date.now()) socket.emit('notifications:changed')
        }))
      })
    },

    workspaceChanged(workspaceId: string) {
      enqueue(async () => {
        const affected = new Set<string>()
        for (const socket of io?.sockets.sockets.values() ?? []) {
          for (const [projectId, workspace] of socket.data.projects) {
            if (workspace === workspaceId) affected.add(projectId)
          }
        }
        for (const projectId of affected) await send({ projectId, kind: 'project.changed' })
      })
    },
  }
}

export type Realtime = ReturnType<typeof createRealtime>
