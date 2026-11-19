import { apiRequest, submitApi } from '../../shared/api'
import type { WorkspaceRole } from '../workspaces/api'

export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

export interface ProjectFields {
  name: string
  description: string
  managerId: string
  startDate: string | null
  targetDate: string | null
  status: ProjectStatus
}

export interface Project extends ProjectFields {
  id: string
  workspaceId: string
  createdAt: string
  updatedAt: string
}

export type ProjectFilter = ProjectStatus | ''
export interface ProjectPage {
  data: Project[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface ProjectMember {
  user: { id: string; name: string }
  workspaceRole: WorkspaceRole
  joinedAt: string
}

export const projectKeys = {
  lists: (userId: string, workspaceId: string) => ['projects', userId, 'list', workspaceId] as const,
  details: (userId: string, id: string) => ['projects', userId, 'details', id] as const,
  members: (userId: string, id: string) => ['projects', userId, 'members', id] as const,
}

export async function listProjects(workspaceId: string, page: number, status: ProjectFilter, signal?: AbortSignal): Promise<ProjectPage> {
  const query = new URLSearchParams({ page: String(page) })
  if (status) query.set('status', status)
  const response = await apiRequest(`workspaces/${encodeURIComponent(workspaceId)}/projects?${query}`, { signal })
  return response.json()
}

export async function createProject(workspaceId: string, fields: ProjectFields): Promise<Project> {
  const response = await submitApi(`workspaces/${encodeURIComponent(workspaceId)}/projects`, 'POST', fields)
  return (await response.json()).data
}

export async function getProject(id: string, signal?: AbortSignal): Promise<Project> {
  const response = await apiRequest(`projects/${encodeURIComponent(id)}`, { signal })
  return (await response.json()).data
}

export async function updateProject(id: string, fields: Partial<ProjectFields>): Promise<Project> {
  const response = await submitApi(`projects/${encodeURIComponent(id)}`, 'PATCH', fields)
  return (await response.json()).data
}

export async function listProjectMembers(id: string, signal?: AbortSignal): Promise<ProjectMember[]> {
  const response = await apiRequest(`projects/${encodeURIComponent(id)}/members`, { signal })
  return (await response.json()).data
}

export async function addProjectMember(id: string, userId: string) {
  await submitApi(`projects/${encodeURIComponent(id)}/members`, 'POST', { userId })
}

export async function removeProjectMember(id: string, userId: string) {
  await submitApi(`projects/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, 'DELETE')
}
