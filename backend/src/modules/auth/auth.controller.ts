import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import { clearAuthCookies, readSessionCookie, type AuthCookies } from './auth.cookies.js'
import type { Credentials, ForgotPassword, Registration, ResetPassword } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'
import type { PasswordResetService } from './password-reset.service.js'

export function authController(service: AuthService, recovery: PasswordResetService, cookies: AuthCookies) {
  const register: RequestHandler<Request['params'], unknown, unknown, unknown, { input: { body: Registration } }> =
    async (_request, response) => {
      const user = await service.register(response.locals.input.body)
      response.status(201).json({ data: user })
    }

  const login: RequestHandler<Request['params'], unknown, unknown, unknown, { input: { body: Credentials } }> =
    async (request, response) => {
      const result = await service.login(response.locals.input.body, readSessionCookie(request, cookies))
      response.cookie(cookies.session, result.token, { ...cookies.options, expires: result.expiresAt })
      response.clearCookie(cookies.csrf, cookies.options)
      response.json({ data: result.user })
    }

  const currentUser: RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals> =
    (_request, response) => { response.json({ data: response.locals.user }) }

  const logout: RequestHandler = async (request, response) => {
    await service.logout(readSessionCookie(request, cookies))
    clearAuthCookies(response, cookies)
    response.status(204).end()
  }

  const forgotPassword: RequestHandler<Request['params'], unknown, unknown, unknown, { input: { body: ForgotPassword } }> =
    (_request, response) => {
      const { email } = response.locals.input.body
      response.status(202).json({
        data: { message: 'If an account exists, password reset instructions will be sent.' },
      })
      void recovery.requestReset(email).catch(() => {
        console.error('DevFlow password recovery could not process the email request.')
      })
    }

  const resetPassword: RequestHandler<Request['params'], unknown, unknown, unknown, { input: { body: ResetPassword } }> =
    async (_request, response) => {
      await recovery.resetPassword(response.locals.input.body)
      response.status(204).end()
    }

  return { register, login, currentUser, logout, forgotPassword, resetPassword }
}
