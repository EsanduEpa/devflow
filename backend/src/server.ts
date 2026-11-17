import { createApp } from './app.js'
import { authConfig } from './config/auth.js'
import { connectDatabase } from './config/database.js'
import { resetEmailConfig } from './config/reset-email.js'
import { createAuthApi } from './modules/auth/auth.routes.js'

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

const api = await createAuthApi(connection, config.auth, config.resetEmail).catch(() => {
  console.error('Could not initialize authentication. Check database permissions and indexes.')
  process.exit(1)
})
const app = createApp(api)

const port = Number(process.env.PORT ?? '3000')

const server = app.listen(port, '127.0.0.1')
server.once('listening', () => {
  console.log(`DevFlow API listening on http://127.0.0.1:${port}`)
})

server.once('error', () => {
  console.error(`Could not start the DevFlow API on port ${port}.`)
  process.exit(1)
})
