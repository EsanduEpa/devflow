import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import mongoose from 'mongoose'
import { createApi } from '../../src/api.js'
import { createApp } from '../../src/app.js'
import { authConfig } from '../../src/config/auth.js'
import type { DeadlineScan } from '../../src/modules/notifications/deadline-scan.js'
import { createRealtime, type Realtime } from '../../src/modules/realtime/realtime.js'
import { connectDatabase } from '../../src/config/database.js'

export async function startStage1App(purpose: 'notifications' | 'browser' | 'performance' | 'sprint' | 'comment' | 'activity' | 'dependency' | 'conflict' | 'realtime') {
  const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Set MONGODB_TEST_URI or MONGODB_URI in backend/.env to run Stage 1 checks.')

  const suffix = randomUUID().replaceAll('-', '')
  const name = (resource: string) => `m14_${purpose}_${resource}_${suffix}`
  const collections = {
    auth: { users: name('users'), sessions: name('sessions'), resetTokens: name('resets') },
    workspace: { workspaces: name('workspaces'), members: name('workspace_members'), invitations: name('invitations') },
    project: { projects: name('projects'), members: name('project_members') },
    task: { tasks: name('tasks') },
    sprint: { sprints: name('sprints') },
    comment: { comments: name('comments') },
    activity: { activity: name('activity') },
    dependency: { dependencies: name('dependencies') },
    notification: { notifications: name('notifications') },
  }
  const server = createServer()
  let live: Realtime | undefined

  async function close() {
    try {
      await live?.close()
      if (server.listening) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve())
          server.closeAllConnections()
        })
      }
      const database = mongoose.connection.db
      if (database && mongoose.connection.readyState === 1) {
        const names = Object.values(collections).flatMap((group) => Object.values(group))
        await Promise.all(names.map(async (name) => {
          if (await database.listCollections({ name }, { nameOnly: true }).hasNext()) await database.dropCollection(name)
        }))
      }
    } finally {
      await mongoose.disconnect()
    }
  }

  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected a local TCP port.')
    const origin = `http://127.0.0.1:${address.port}`
    const connection = await connectDatabase(uri, 'devflow_test')
    const config = authConfig({ APP_ORIGINS: origin, CSRF_SECRET: randomBytes(32).toString('hex') })
    const email = { origin, async sendResetEmail() { throw new Error('Stage 1 browser and timing checks do not deliver email.') } }
    if (purpose === 'browser' || purpose === 'notifications' || purpose === 'realtime') {
      live = createRealtime(config, purpose === 'realtime' ? 500 : undefined)
    }
    let deadlineScan: DeadlineScan | undefined
    const api = createApp(await createApi(connection, config, email, collections, live, (scan) => { deadlineScan = scan }))

    if (purpose === 'browser') {
      const frontendDist = fileURLToPath(new URL('../../../frontend/dist/', import.meta.url))
      const site = express()
      site.use((request, response, next) => {
        if (request.path.startsWith('/api/')) return api(request, response, next)
        next()
      })
      site.use(express.static(frontendDist))
      site.use((_request, response) => response.sendFile(join(frontendDist, 'index.html')))
      server.on('request', site)
    } else {
      server.on('request', api)
    }

    const realtimeServer = live?.attach(server)
    return { origin, realtimeServer, scanDeadlines: (now?: Date) => deadlineScan!(now), database: connection.db!, collections, close }
  } catch {
    await close()
    throw new Error('Could not start the Stage 1 test app. Check local server permissions, Atlas access, and devflow_test permissions.')
  }
}
