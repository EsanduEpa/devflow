import { createServer } from 'node:http'
import { createApi } from './api.js'
import { createApp } from './app.js'
import { authConfig } from './config/auth.js'
import { connectDatabase } from './config/database.js'
import { createRealtime } from './modules/realtime/realtime.js'
import { resetEmailConfig } from './config/reset-email.js'

const uri = process.env.MONGODB_URI?.trim()
if (!uri) {
  console.error('MONGODB_URI is required to start the DevFlow API.')
  process.exit(1)
}

const config = (() => {
  try {
    const auth = authConfig(process.env)
    return { auth, resetEmail: resetEmailConfig(process.env, auth) }
  } catch (error) {
    if (error instanceof Error) console.error(error.message)
    process.exit(1)
  }
})()

const connection = await connectDatabase(uri, 'devflow_db')
  .catch(() => {
    console.error('Could not connect to MongoDB. Check MONGODB_URI and your Atlas access settings.')
    process.exit(1)
  })
console.log('Connected to MongoDB (devflow_db).')

const live = createRealtime(config.auth)
const api = await createApi(connection, config.auth, config.resetEmail, undefined, live).catch(() => {
  console.error('Could not initialize the DevFlow API. Check database permissions and indexes.')
  process.exit(1)
})
const app = createApp(api)

const port = Number(process.env.PORT ?? '3000')

const server = createServer(app)
live.attach(server)
server.once('listening', () => {
  console.log(`DevFlow API listening on http://127.0.0.1:${port}`)
})

server.once('error', () => {
  console.error(`Could not start the DevFlow API on port ${port}.`)
  process.exit(1)
})

server.listen(port, '127.0.0.1')
