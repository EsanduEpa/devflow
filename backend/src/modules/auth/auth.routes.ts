import cookieParser from 'cookie-parser'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Connection } from 'mongoose'
import type { AuthConfig } from '../../config/auth.js'
import { authenticate } from '../../middleware/authenticate.js'
import { csrfProtection } from '../../middleware/csrf.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { ApiError } from '../../shared/api-error.js'
import { userModel } from '../users/user.model.js'
import { authController } from './auth.controller.js'
import { authCookies } from './auth.cookies.js'
import { authRepository } from './auth.repository.js'
import { loginSchema, logoutSchema, registerSchema } from './auth.schemas.js'
import { authService } from './auth.service.js'
import { sessionModel } from './session.model.js'

function authLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.'))
    },
  })
}

export async function createAuthApi(
  connection: Connection,
  config: AuthConfig,
  collections?: { users: string; sessions: string },
) {
  const users = userModel(connection, collections?.users)
  const sessions = sessionModel(connection, collections?.sessions)
  await Promise.all([users.createIndexes(), sessions.createIndexes()])

  const service = await authService(authRepository(users, sessions))
  const cookies = authCookies(config)
  const csrf = csrfProtection(config, cookies)
  const controller = authController(service, cookies)
  const router = Router()

  router.use(cookieParser())
  router.use('/auth', (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  router.get('/auth/csrf', csrf.issueToken)
  router.post('/auth/register', csrf.verifyToken, authLimiter(5), validateRequest(registerSchema), controller.register)
  router.post('/auth/login', csrf.verifyToken, authLimiter(10), validateRequest(loginSchema), controller.login)
  router.post('/auth/logout', csrf.verifyToken, validateRequest(logoutSchema), controller.logout)
  router.get('/auth/me', authenticate(service, cookies), controller.currentUser)

  return router
}
