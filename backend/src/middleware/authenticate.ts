import type { Request, RequestHandler } from 'express'
import { readSessionCookie, type AuthCookies } from '../modules/auth/auth.cookies.js'
import type { AuthService } from '../modules/auth/auth.service.js'
import type { PublicUser } from '../modules/users/user.model.js'

export type AuthenticatedLocals = { user: PublicUser }

export function authenticate(service: AuthService, cookies: AuthCookies):
  RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals> {
  return async (request, response, next) => {
    response.locals.user = await service.currentUser(readSessionCookie(request, cookies))
    next()
  }
}
