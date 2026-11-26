import cookieParser from 'cookie-parser'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Connection } from 'mongoose'
import type { AuthConfig } from '../../config/auth.js'
import type { ResetEmailConfig } from '../../config/reset-email.js'
import { authenticate } from '../../middleware/authenticate.js'
import { csrfProtection } from '../../middleware/csrf.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { ApiError } from '../../shared/api-error.js'
import { userModel } from '../users/user.model.js'
import { userRoutes } from '../users/user.routes.js'
import { authController } from './auth.controller.js'
import { authCookies } from './auth.cookies.js'
import { authRepository } from './auth.repository.js'
import { forgotPasswordSchema, loginSchema, logoutSchema, registerSchema, resetPasswordSchema } from './auth.schemas.js'
import { authService } from './auth.service.js'
import { passwordResetModel } from './password-reset.model.js'
import { passwordResetRepository } from './password-reset.repository.js'
import { passwordResetService } from './password-reset.service.js'
import { sessionModel } from './session.model.js'
import type { Realtime } from '../realtime/realtime.js'

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

export type AuthCollections = { users: string; sessions: string; resetTokens: string }

export async function createAuthModule(
  connection: Connection,
  config: AuthConfig,
  emailConfig: ResetEmailConfig,
  collections?: AuthCollections,
  live?: Realtime,
) {
  const users = userModel(connection, collections?.users)
  const sessions = sessionModel(connection, collections?.sessions)
  const resetTokens = passwordResetModel(connection, collections?.resetTokens)
  await Promise.all([users.createIndexes(), sessions.createIndexes(), resetTokens.createIndexes()])

  const service = await authService(authRepository(users, sessions))
  const cookies = authCookies(config)
  const csrf = csrfProtection(config, cookies)
  const requireUser = authenticate(service, cookies)
  const recovery = passwordResetService(passwordResetRepository(users, sessions, resetTokens), emailConfig)
  const controller = authController(service, recovery, cookies)
  const router = Router()

  router.use(cookieParser())
  router.use('/auth', (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  router.get('/auth/csrf', csrf.issueToken)
  router.post('/auth/register', csrf.verifyToken, authLimiter(5), validateRequest(registerSchema), controller.register)
  router.post('/auth/login', csrf.verifyToken, authLimiter(10), validateRequest(loginSchema), live?.protect(controller.login) ?? controller.login)
  router.post('/auth/logout', csrf.verifyToken, validateRequest(logoutSchema), live?.protect(controller.logout) ?? controller.logout)
  router.get('/auth/me', requireUser, controller.currentUser)
  router.post('/auth/forgot-password', csrf.verifyToken, authLimiter(5), validateRequest(forgotPasswordSchema), controller.forgotPassword)
  router.post('/auth/reset-password', csrf.verifyToken, authLimiter(10), validateRequest(resetPasswordSchema), live?.protect(controller.resetPassword) ?? controller.resetPassword)
  router.use('/users', userRoutes(users, sessions, service, cookies, csrf.verifyToken, authLimiter(10), live))

  return { router, service, requireUser, verifyCsrf: csrf.verifyToken, users }
}
