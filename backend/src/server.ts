import { app } from './app.js'
import { connectDatabase } from './config/database.js'

const uri = process.env.MONGODB_URI?.trim()
if (!uri) {
  console.error('MONGODB_URI is required to start the DevFlow API.')
  process.exit(1)
}

try {
  await connectDatabase(uri, 'devflow_db')
  console.log('Connected to MongoDB (devflow_db).')
} catch {
  console.error('Could not connect to MongoDB. Check MONGODB_URI and your Atlas access settings.')
  process.exit(1)
}

const port = Number(process.env.PORT ?? '3000')

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`DevFlow API listening on http://127.0.0.1:${port}`)
})

server.on('error', () => {
  console.error(`Could not start the DevFlow API on port ${port}.`)
  process.exit(1)
})
