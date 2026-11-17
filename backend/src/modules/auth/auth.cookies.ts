import type { CookieOptions, Request, Response } from 'express'
import type { AuthConfig } from '../../config/auth.js'

export function authCookies(config: AuthConfig) {
  const prefix = config.secureCookies ? '__Host-' : ''
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
  }

  return { session: `${prefix}devflow_session`, csrf: `${prefix}devflow_csrf`, options }
}

export type AuthCookies = ReturnType<typeof authCookies>

export function clearAuthCookies(response: Response, cookies: AuthCookies) {
  response.clearCookie(cookies.session, cookies.options)
  response.clearCookie(cookies.csrf, cookies.options)
}

export function readSessionCookie(request: Pick<Request, 'cookies'>, cookies: AuthCookies): string | undefined {
  const value: unknown = request.cookies?.[cookies.session]
  return typeof value === 'string' && /^[\w-]{43}$/.test(value) ? value : undefined
}
