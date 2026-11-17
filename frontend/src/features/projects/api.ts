import { apiRequest, submitApi } from '../../shared/api'

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

export const projectKeys = {
  lists: (userId: string, workspaceId: string) => ['projects', userId, 'list', workspaceId] as const,
  details: (userId: string, id: string) => ['projects', userId, 'details', id] as const,
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
