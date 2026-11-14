export function authConfig(env: NodeJS.ProcessEnv) {
  const csrfSecret = env.CSRF_SECRET?.trim()
  if (!csrfSecret || !/^[a-f0-9]{64}$/i.test(csrfSecret)) {
    throw new Error('CSRF_SECRET must contain 64 hexadecimal characters.')
  }

  const allowedOrigins = (env.APP_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',').map((origin) => origin.trim())
  const secureCookies = env.NODE_ENV === 'production'

  if (allowedOrigins.some((origin) => {
    const url = URL.parse(origin)
    return !url || url.origin !== origin ||
      !(url.protocol === 'https:' || (!secureCookies && url.protocol === 'http:'))
  })) {
    throw new Error('APP_ORIGINS must list valid origins without paths and use HTTPS in production.')
  }

  return { csrfSecret, allowedOrigins, secureCookies }
}

export type AuthConfig = ReturnType<typeof authConfig>
