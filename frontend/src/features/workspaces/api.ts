import { apiRequest, submitApi } from '../../shared/api'

export type WorkspaceRole = 'OWNER' | 'MANAGER' | 'DEVELOPER'
export type EditableWorkspaceRole = Exclude<WorkspaceRole, 'OWNER'>

export interface Workspace {
  id: string
  name: string
  description: string
  ownerId: string
  myRole: WorkspaceRole
  createdAt: string
  updatedAt: string
}

export type WorkspaceFields = Pick<Workspace, 'name' | 'description'>

export interface WorkspaceMember {
  user: { id: string; name: string; email: string }
  role: WorkspaceRole
  joinedAt: string
}

export const workspaceKeys = {
  list: (userId: string) => ['workspaces', userId, 'list'] as const,
  details: (userId: string, workspaceId: string) => ['workspaces', userId, 'details', workspaceId] as const,
  members: (userId: string, workspaceId: string) => ['workspaces', userId, 'members', workspaceId] as const,
  invitations: (userId: string, workspaceId: string) => ['workspaces', userId, 'invitations', workspaceId] as const,
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

export async function listWorkspaceMembers(id: string, signal?: AbortSignal): Promise<WorkspaceMember[]> {
  const response = await apiRequest(`workspaces/${encodeURIComponent(id)}/members`, { signal })
  return (await response.json()).data
}

export async function updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: EditableWorkspaceRole): Promise<WorkspaceMember> {
  const response = await submitApi(`workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`, 'PATCH', { role })
  return (await response.json()).data
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string) {
  await submitApi(`workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`, 'DELETE')
}
