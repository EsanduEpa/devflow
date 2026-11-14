export interface ErrorDetail {
  field: string
  message: string
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
