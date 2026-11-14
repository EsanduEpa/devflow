import { randomBytes } from 'node:crypto'
import cookieParser from 'cookie-parser'
import { Router } from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { authConfig } from '../src/config/auth.js'
import { csrfProtection } from '../src/middleware/csrf.js'
import { authCookies } from '../src/modules/auth/auth.cookies.js'

const origin = 'https://devflow.example'
const config = authConfig({ NODE_ENV: 'production', APP_ORIGINS: origin, CSRF_SECRET: randomBytes(32).toString('hex') })
const cookies = authCookies(config)
const csrf = csrfProtection(config, cookies)
const router = Router()
router.use(cookieParser())
router.get('/token', csrf.issueToken)
router.post('/protected', csrf.verifyToken, (_request, response) => { response.status(204).end() })
const app = createApp(router)

describe('signed double-submit CSRF protection', () => {
  it('accepts a matching signed pair and requires the configured origin', async () => {
    const response = await request(app).get('/api/v1/token').expect(200)
    const token: string = response.body.data.csrfToken
    const [signedCookie] = response.headers['set-cookie'] as unknown as string[]
    expect(signedCookie).toContain('__Host-devflow_csrf=')
    expect(signedCookie).toContain('; Secure')
    expect(signedCookie).toContain('; HttpOnly')
    expect(signedCookie).toContain('; Path=/')

    await request(app).post('/api/v1/protected').set('Origin', origin)
      .set('Cookie', `${cookies.csrf}=${token}`).set('X-CSRF-Token', token).expect(204)
    await request(app).post('/api/v1/protected').set('Origin', 'https://attacker.example')
      .set('Cookie', `${cookies.csrf}=${token}`).set('X-CSRF-Token', token).expect(403)
    await request(app).post('/api/v1/protected')
      .set('Cookie', `${cookies.csrf}=${token}`).set('X-CSRF-Token', token).expect(403)
    await request(app).post('/api/v1/protected').set('Origin', origin)
      .set('Cookie', `${cookies.csrf}=${token}`).expect(403)
    await request(app).post('/api/v1/protected').set('Origin', origin)
      .set('X-CSRF-Token', token).expect(403)

    const tampered = `${token[0] === 'A' ? 'B' : 'A'}${token.slice(1)}`
    await request(app).post('/api/v1/protected').set('Origin', origin)
      .set('Cookie', `${cookies.csrf}=${tampered}`).set('X-CSRF-Token', tampered).expect(403)
  })

  it('rejects a token signed for another session', async () => {
    const firstSession = randomBytes(32).toString('base64url')
    const secondSession = randomBytes(32).toString('base64url')
    const response = await request(app).get('/api/v1/token')
      .set('Cookie', `${cookies.session}=${firstSession}`).expect(200)
    const token: string = response.body.data.csrfToken
    await request(app).post('/api/v1/protected').set('Origin', origin)
      .set('Cookie', `${cookies.csrf}=${token}; ${cookies.session}=${secondSession}`)
      .set('X-CSRF-Token', token).expect(403)
  })
})
