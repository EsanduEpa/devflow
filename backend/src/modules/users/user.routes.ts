import { Router, type RequestHandler } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import type { AuthCookies } from '../auth/auth.cookies.js'
import type { AuthService } from '../auth/auth.service.js'
import type { sessionModel } from '../auth/session.model.js'
import { userController } from './user.controller.js'
import type { userModel } from './user.model.js'
import { userRepository } from './user.repository.js'
import { changePasswordSchema, updateProfileSchema } from './user.schema.js'
import { userService } from './user.service.js'
import type { Realtime } from '../realtime/realtime.js'

export function userRoutes(
  users: ReturnType<typeof userModel>,
  sessions: ReturnType<typeof sessionModel>,
  auth: AuthService,
  cookies: AuthCookies,
  verifyCsrf: RequestHandler,
  limitPasswordAttempts: RequestHandler,
  live?: Realtime,
) {
  const controller = userController(userService(userRepository(users, sessions)), cookies)
  const requireUser = authenticate(auth, cookies)
  const router = Router()
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  router.patch('/me', requireUser, verifyCsrf, validateRequest(updateProfileSchema), controller.updateProfile)
  router.patch('/me/password', requireUser, verifyCsrf, limitPasswordAttempts, validateRequest(changePasswordSchema), live?.protect(controller.changePassword) ?? controller.changePassword)
  return router
}
