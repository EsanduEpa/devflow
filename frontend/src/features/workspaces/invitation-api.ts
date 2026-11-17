import { apiRequest, submitApi } from '../../shared/api'
import type { Workspace, WorkspaceRole } from './api'

export type InvitationRole = Exclude<WorkspaceRole, 'OWNER'>
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
export type InvitationFields = { email: string; role: InvitationRole }

export interface Invitation extends InvitationFields {
  id: string
  status: InvitationStatus
  createdAt: string
  expiresAt: string
}

export interface InvitationPreview {
  workspaceName: string
  role: InvitationRole
  maskedEmail: string
  expiresAt: string
}

export async function createInvitation(workspaceId: string, fields: InvitationFields): Promise<{ acceptUrl: string }> {
  const response = await submitApi(`workspaces/${encodeURIComponent(workspaceId)}/invitations`, 'POST', fields)
  return (await response.json()).data
}

export async function listInvitations(workspaceId: string, signal?: AbortSignal): Promise<Invitation[]> {
  const response = await apiRequest(`workspaces/${encodeURIComponent(workspaceId)}/invitations`, { signal })
  return (await response.json()).data
}

export async function previewInvitation(token: string, signal?: AbortSignal): Promise<InvitationPreview> {
  const response = await apiRequest(`invitations/${encodeURIComponent(token)}`, { signal })
  return (await response.json()).data
}

export async function acceptInvitation(token: string): Promise<Workspace> {
  const response = await submitApi(`invitations/${encodeURIComponent(token)}/accept`, 'POST')
  return (await response.json()).data
}
