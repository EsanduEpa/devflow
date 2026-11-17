import { apiRequest, submitApi } from '../../shared/api'

export interface Workspace {
  id: string
  name: string
  description: string
  ownerId: string
  myRole: 'OWNER' | 'MANAGER' | 'DEVELOPER'
  createdAt: string
  updatedAt: string
}

export type WorkspaceFields = Pick<Workspace, 'name' | 'description'>

export const workspaceKeys = {
  list: (userId: string) => ['workspaces', userId, 'list'] as const,
  details: (userId: string, workspaceId: string) => ['workspaces', userId, 'details', workspaceId] as const,
}

export async function listWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  const response = await apiRequest('workspaces', { signal })
  return (await response.json()).data
}

export async function getWorkspace(id: string, signal?: AbortSignal): Promise<Workspace> {
  const response = await apiRequest(`workspaces/${encodeURIComponent(id)}`, { signal })
  return (await response.json()).data
}

export async function createWorkspace(fields: WorkspaceFields): Promise<Workspace> {
  const response = await submitApi('workspaces', 'POST', fields)
  return (await response.json()).data
}

export async function updateWorkspace(id: string, fields: WorkspaceFields): Promise<Workspace> {
  const response = await submitApi(`workspaces/${encodeURIComponent(id)}`, 'PATCH', fields)
  return (await response.json()).data
}
