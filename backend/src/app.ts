import express, { type Router } from 'express'
import { handleError, notFound } from './middleware/errors.js'
import { healthRouter } from './modules/health/health.routes.js'

export function createApp(apiRouter?: Router) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use('/api', healthRouter)

  if (apiRouter) {
    app.use('/api/v1', apiRouter)
  }

  app.use(notFound)
  app.use(handleError)
  return app
}

export const app = createApp()
