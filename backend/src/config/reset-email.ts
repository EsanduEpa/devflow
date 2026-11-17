import nodemailer from 'nodemailer'
import type { AuthConfig } from './auth.js'

export type SendResetEmail = (email: string, link: URL) => Promise<void>

export function resetEmailConfig(env: NodeJS.ProcessEnv, auth: AuthConfig) {
  const origin = env.PASSWORD_RESET_ORIGIN?.trim() || auth.allowedOrigins[0]
  if (!auth.allowedOrigins.includes(origin)) {
    throw new Error('PASSWORD_RESET_ORIGIN must match one of the APP_ORIGINS.')
  }

  const host = env.SMTP_HOST?.trim()
  const from = env.MAIL_FROM?.trim()
  if (auth.secureCookies && (!host || !from)) {
    throw new Error('SMTP_HOST and MAIL_FROM are required in production.')
  }

  const port = Number(env.SMTP_PORT?.trim() || (host ? 587 : 1025))
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number.')
  }

  const user = env.SMTP_USER?.trim()
  const pass = env.SMTP_PASSWORD
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error('Set both SMTP_USER and SMTP_PASSWORD for authenticated SMTP.')
  }

  const smtpHost = host || '127.0.0.1'
  const local = smtpHost === '127.0.0.1' || smtpHost === 'localhost' || smtpHost === '::1'
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure: port === 465,
    requireTLS: port !== 465 && (auth.secureCookies || !local || Boolean(user)),
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  const sendResetEmail: SendResetEmail = async (email, link) => {
    await transport.sendMail({
      from: from || 'DevFlow <no-reply@devflow.test>',
      to: email,
      subject: 'Reset your DevFlow password',
      text: `Open this link to reset your DevFlow password. It expires in 30 minutes.\n\n${link.href}\n\nIf you did not request a reset, you can ignore this email.`,
    })
  }

  return { origin, sendResetEmail }
}

export type ResetEmailConfig = ReturnType<typeof resetEmailConfig>
