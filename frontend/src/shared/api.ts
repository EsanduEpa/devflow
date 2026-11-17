export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/${path}`, {
    credentials: 'same-origin',
    ...init,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = body?.error
    const fieldMessage = error?.details?.[0]?.message
    throw new ApiError(response.status, fieldMessage ?? error?.message ?? 'DevFlow could not complete this request.')
  }
  return response
}

export async function submitApi(path: string, method: 'POST' | 'PATCH', body?: object) {
  const csrfResponse = await apiRequest('auth/csrf')
  const { csrfToken } = (await csrfResponse.json()).data
  const headers = new Headers({ 'X-CSRF-Token': csrfToken })
  if (body) headers.set('Content-Type', 'application/json')

  return apiRequest(path, { method, headers, body: body && JSON.stringify(body) })
}

export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Could not reach DevFlow. Try again.'
}
