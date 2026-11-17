import type { WorkspaceRole } from './api'
import type { InvitationStatus } from './invitation-api'

export const roleLabels: Record<WorkspaceRole, string> = { OWNER: 'Owner', MANAGER: 'Manager', DEVELOPER: 'Developer' }

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function formatDate(date: string) {
  return dateFormat.format(new Date(date))
}
