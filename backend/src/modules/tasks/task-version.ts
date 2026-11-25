import { ApiError } from '../../shared/api-error.js'

export function staleTaskVersion() {
  return new ApiError(409, 'STALE_VERSION', 'This task changed since you opened it. Review the latest task before retrying.')
}
