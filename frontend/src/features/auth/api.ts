import { ApiError, apiRequest, submitApi } from '../../shared/api'

export { apiErrorMessage as authErrorMessage } from '../../shared/api'

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

export async function currentUser(signal?: AbortSignal): Promise<PublicUser | null> {
  try {
    const response = await apiRequest('auth/me', { signal })
    return (await response.json()).data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function register(user: Credentials & { name: string }) {
  await submitApi('auth/register', 'POST', user)
}

export async function login(credentials: Credentials): Promise<PublicUser> {
  const response = await submitApi('auth/login', 'POST', credentials)
  return (await response.json()).data
}

export async function logout() {
  await submitApi('auth/logout', 'POST')
}

export async function updateProfile(fields: Partial<Pick<PublicUser, 'name' | 'email' | 'profile'>> & { currentPassword?: string }): Promise<PublicUser> {
  const response = await submitApi('users/me', 'PATCH', fields)
  return (await response.json()).data
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await submitApi('users/me/password', 'PATCH', { currentPassword, newPassword })
}

export async function forgotPassword(email: string): Promise<string> {
  const response = await submitApi('auth/forgot-password', 'POST', { email })
  return (await response.json()).data.message
}

export async function resetPassword(token: string, newPassword: string) {
  await submitApi('auth/reset-password', 'POST', { token, newPassword })
}
