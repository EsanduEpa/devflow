export interface PublicUser {
  id: string
  name: string
  email: string
  profile?: { bio: string }
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

async function apiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/${path}`, {
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
    const response = await apiRequest('auth/me', { signal })
    return (await response.json()).data
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null
    throw error
  }
}

async function submit(path: string, method: 'POST' | 'PATCH', body?: object) {
  const csrfResponse = await apiRequest('auth/csrf')
  const { csrfToken } = (await csrfResponse.json()).data
  const headers = new Headers({ 'X-CSRF-Token': csrfToken })
  if (body) headers.set('Content-Type', 'application/json')

  return apiRequest(path, { method, headers, body: body && JSON.stringify(body) })
}

export async function register(user: Credentials & { name: string }) {
  await submit('auth/register', 'POST', user)
}

export async function login(credentials: Credentials): Promise<PublicUser> {
  const response = await submit('auth/login', 'POST', credentials)
  return (await response.json()).data
}

export async function logout() {
  await submit('auth/logout', 'POST')
}

export async function updateProfile(fields: Partial<Pick<PublicUser, 'name' | 'email' | 'profile'>> & { currentPassword?: string }): Promise<PublicUser> {
  const response = await submit('users/me', 'PATCH', fields)
  return (await response.json()).data
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await submit('users/me/password', 'PATCH', { currentPassword, newPassword })
}

export async function forgotPassword(email: string): Promise<string> {
  const response = await submit('auth/forgot-password', 'POST', { email })
  return (await response.json()).data.message
}

export async function resetPassword(token: string, newPassword: string) {
  await submit('auth/reset-password', 'POST', { token, newPassword })
}

export function authErrorMessage(error: unknown) {
  return error instanceof AuthError ? error.message : 'Could not reach DevFlow. Try again.'
}
