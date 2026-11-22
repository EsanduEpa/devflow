export class ApiError extends Error {
  readonly status: number
  readonly fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
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
    const details: unknown[] = Array.isArray(error?.details) ? error.details : []
    const fields = Object.fromEntries(details
      .filter((detail): detail is { field: string; message: string } => !!detail && typeof detail === 'object'
        && 'field' in detail && typeof detail.field === 'string' && detail.field.startsWith('body.')
        && 'message' in detail && typeof detail.message === 'string')
      .map(({ field, message }) => [field.slice(5), message]))
    if (response.status === 401 && error?.code === 'UNAUTHENTICATED') {
      window.dispatchEvent(new Event('devflow:session-ended'))
    }
    throw new ApiError(response.status, fieldMessage ?? error?.message ?? 'DevFlow could not complete this request.', fields)
  }
  return response
}

export async function submitApi(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object) {
  const csrfResponse = await apiRequest('auth/csrf')
  const { csrfToken } = (await csrfResponse.json()).data
  const headers = new Headers({ 'X-CSRF-Token': csrfToken })
  if (body) headers.set('Content-Type', 'application/json')

  return apiRequest(path, { method, headers, body: body && JSON.stringify(body) })
}

export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Could not reach DevFlow. Try again.'
}
