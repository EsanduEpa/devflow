import { apiRequest, submitApi } from '../../shared/api'

export type NotificationItem = {
  id: string
  kind: 'ASSIGNMENT' | 'MENTION' | 'REVIEW' | 'DEADLINE' | 'INVITATION'
  createdAt: string
  readAt: string | null
  unavailable: boolean
  task?: { id: string; title: string }
  workspaceName?: string
}

type NotificationPage = {
  data: NotificationItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const notificationKeys = {
  all: (userId: string) => ['notifications', userId] as const,
  unread: (userId: string) => [...notificationKeys.all(userId), 'unread'] as const,
  page: (userId: string, page: number) => [...notificationKeys.all(userId), 'page', page] as const,
}

export async function getUnreadCount(signal: AbortSignal): Promise<number> {
  const response = await apiRequest('notifications/unread-count', { signal })
  return (await response.json()).data.count
}

export async function listNotifications(page: number, signal: AbortSignal): Promise<NotificationPage> {
  const response = await apiRequest(`notifications?page=${page}`, { signal })
  return response.json()
}

export async function markNotificationRead(id: string) {
  await submitApi(`notifications/${encodeURIComponent(id)}`, 'PATCH', { read: true })
}
