import { apiRequest, submitApi } from '../../shared/api'

export type CommentPerson = { id: string; name: string | null }
export type CommentFields = { body: string; mentionUserIds: string[] }
export type TaskComment = CommentFields & {
  id: string
  taskId: string
  author: CommentPerson
  mentions: CommentPerson[]
  createdAt: string
  updatedAt: string
  revision: number
}
type CommentPage = {
  data: TaskComment[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const path = (taskId: string) => `tasks/${taskId}/comments`
export const commentKeys = {
  history: (userId: string, taskId: string) => ['comments', userId, taskId, 'history'] as const,
  mentions: (userId: string, taskId: string) => ['comments', userId, taskId, 'mention-options'] as const,
}

export async function listComments(taskId: string, page: number, signal: AbortSignal): Promise<CommentPage> {
  const response = await apiRequest(`${path(taskId)}?page=${page}`, { signal })
  return response.json()
}

export async function listMentionOptions(taskId: string, signal: AbortSignal): Promise<CommentPerson[]> {
  const response = await apiRequest(`${path(taskId)}/mention-options`, { signal })
  return (await response.json()).data
}

export async function saveComment(taskId: string, fields: CommentFields, commentId?: string) {
  await submitApi(commentId ? `${path(taskId)}/${commentId}` : path(taskId), commentId ? 'PATCH' : 'POST', fields)
}

export async function deleteComment(taskId: string, commentId: string) {
  await submitApi(`${path(taskId)}/${commentId}`, 'DELETE')
}
