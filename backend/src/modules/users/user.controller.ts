import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import { clearAuthCookies, type AuthCookies } from '../auth/auth.cookies.js'
import type { ChangePasswordInput, UpdateProfileInput } from './user.schema.js'
import type { UserService } from './user.service.js'

type UserRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function userController(service: UserService, cookies: AuthCookies) {
  const updateProfile: UserRequest<UpdateProfileInput> = async (_request, response) => {
    const user = await service.updateProfile(response.locals.user.id, response.locals.input.body)
    response.json({ data: user })
  }

  const changePassword: UserRequest<ChangePasswordInput> = async (_request, response) => {
    await service.changePassword(response.locals.user.id, response.locals.input.body)
    clearAuthCookies(response, cookies)
    response.status(204).end()
  }

  return { updateProfile, changePassword }
}
