import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '../../shared/api'
import { getTask } from './api'

export function isTaskConflict(error: unknown) {
  return error instanceof ApiError && error.status === 409 && error.code === 'STALE_VERSION'
}

export function useTaskConflict<Intent>() {
  const [attempt, setAttempt] = useState<{ taskId: string; intent: Intent } | null>(null)
  const latest = useMutation({ mutationFn: (taskId: string) => getTask(taskId) })

  function capture(error: unknown, taskId: string, intent: Intent) {
    if (!isTaskConflict(error)) return
    setAttempt({ taskId, intent })
    latest.mutate(taskId)
  }

  function clear() {
    setAttempt(null)
    latest.reset()
  }

  return {
    attempt, current: latest.data, pending: latest.isPending, error: latest.error, capture, clear,
    reload: () => { if (attempt) latest.mutate(attempt.taskId) },
  }
}
