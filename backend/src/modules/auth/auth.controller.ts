import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import { readSessionCookie, type AuthCookies } from './auth.cookies.js'
import type { Credentials, Registration } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'

export function authController(service: AuthService, cookies: AuthCookies) {
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
    response.clearCookie(cookies.session, cookies.options)
    response.clearCookie(cookies.csrf, cookies.options)
    response.status(204).end()
  }

  return { register, login, currentUser, logout }
}
