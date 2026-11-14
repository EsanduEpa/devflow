import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import type { AuthConfig } from '../config/auth.js'
import { readSessionCookie, type AuthCookies } from '../modules/auth/auth.cookies.js'
import { randomToken } from '../modules/auth/auth.service.js'
import { ApiError } from '../shared/api-error.js'

const tokenLifetime = 60 * 60 * 1000
const tokenFormat = /^([\w-]{43})\.(\d{13})\.([\w-]{43})$/

function equal(left: string, right: string) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

export function csrfProtection(config: AuthConfig, cookies: AuthCookies) {
  const signingKey = Buffer.from(config.csrfSecret, 'hex')
  const allowedOrigins = new Set(config.allowedOrigins)

  function sign(request: Request, payload: string) {
    const sessionToken = readSessionCookie(request, cookies) ?? ''
    return createHmac('sha256', signingKey).update(`${sessionToken}.${payload}`).digest('base64url')
  }

  function validToken(request: Request, candidate: unknown): candidate is string {
    if (typeof candidate !== 'string') return false
    const match = tokenFormat.exec(candidate)
    return !!match && Number(match[2]) > Date.now() && equal(match[3], sign(request, `${match[1]}.${match[2]}`))
  }

  const issueToken: RequestHandler = (request, response) => {
    const existing: unknown = request.cookies[cookies.csrf]
    if (validToken(request, existing)) {
      response.json({ data: { csrfToken: existing } })
      return
    }

    const payload = `${randomToken()}.${Date.now() + tokenLifetime}`
    const token = `${payload}.${sign(request, payload)}`
    response.cookie(cookies.csrf, token, { ...cookies.options, maxAge: tokenLifetime })
    response.json({ data: { csrfToken: token } })
  }

  const verifyToken: RequestHandler = (request, _response, next) => {
    const origin = request.get('Origin')
    const header = request.get('X-CSRF-Token')
    const cookie: unknown = request.cookies[cookies.csrf]
    if (!origin || !allowedOrigins.has(origin) || !header || !validToken(request, cookie) || !equal(cookie, header)) {
      next(new ApiError(403, 'CSRF_TOKEN_INVALID', 'The security token is invalid or expired.'))
      return
    }
    next()
  }

  return { issueToken, verifyToken }
}
