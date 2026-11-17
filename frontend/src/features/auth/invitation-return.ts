export function readInvitationToken(state: unknown) {
  if (typeof state !== 'object' || !state || !('invitationToken' in state)) return undefined
  const { invitationToken } = state
  return typeof invitationToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(invitationToken) ? invitationToken : undefined
}

export function afterAuthentication(invitationToken?: string) {
  return invitationToken ? `/invitations/${invitationToken}` : '/'
}
