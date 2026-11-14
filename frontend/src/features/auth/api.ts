export interface PublicUser {
  id: string
  name: string
  email: string
}

export interface Credentials {
  email: string
  password: string
}

class AuthError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function authRequest(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/auth/${path}`, {
    credentials: 'same-origin',
    ...init,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = body?.error
    const fieldMessage = error?.details?.[0]?.message
    throw new AuthError(response.status, fieldMessage ?? error?.message ?? 'DevFlow could not complete this request.')
  }
  return response
}

export async function currentUser(signal?: AbortSignal): Promise<PublicUser | null> {
  try {
    const response = await authRequest('me', { signal })
    return (await response.json()).data
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null
    throw error
  }
}

async function submit(path: string, body?: Credentials & { name?: string }) {
  const csrfResponse = await authRequest('csrf')
  const { csrfToken } = (await csrfResponse.json()).data
  const headers = new Headers({ 'X-CSRF-Token': csrfToken })
  if (body) headers.set('Content-Type', 'application/json')

  return authRequest(path, { method: 'POST', headers, body: body && JSON.stringify(body) })
}

export async function register(user: Credentials & { name: string }) {
  await submit('register', user)
}

export async function login(credentials: Credentials): Promise<PublicUser> {
  const response = await submit('login', credentials)
  return (await response.json()).data
}

export async function logout() {
  await submit('logout')
}

export function authErrorMessage(error: unknown) {
  return error instanceof AuthError ? error.message : 'Could not reach DevFlow. Try again.'
}
