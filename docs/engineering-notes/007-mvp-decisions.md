# MVP engineering decisions

## Authentication and recovery

Passwords are hashed with Argon2id. The browser keeps an opaque session token in an HTTP-only, SameSite=Lax cookie. MongoDB stores a SHA-256 digest of the token, its user, expiration, and password version. Login rotates the previous session when present. Logout deletes that session. Password changes and resets change the password version and revoke sessions together. Email changes invalidate prior recovery links through the recovery version.

Every write uses an allowed origin and a signed CSRF token that matches the cookie and header. The token is bound to the session once a user signs in. Recovery links are explicitly time-limited and single-use, with generic forgot-password responses and local SMTP test coverage. This approach gives the API a revocable session at the cost of a database lookup for protected requests. [Session and CSRF decision](004-session-and-csrf.md) · [Runtime authentication code](../../backend/src/modules/auth)

## Data model and validation

Workspaces and projects reference users through independent membership collections. Workspace roles are scoped to a workspace. Project membership records carry the relationship between users and projects, while `managerId` identifies the assigned Manager. Tasks belong to one project. An assignee, when present, must belong to that project and its workspace. Dashboard counts are derived from tasks at read time.

| Collection | Relationship and key indexes |
| --- | --- |
| `users` | Account and profile. Unique normalized email. |
| `sessions` | References a user. Unique token hash, user index, and expiration TTL. |
| `password_reset_tokens` | References a user. Unique token hash, user index, and TTL 24 hours after expiration so recent expired links can return a clear error. |
| `workspaces` | References its Owner. Indexed by `ownerId`. |
| `workspace_members` | Joins users and workspaces. Unique `(workspaceId, userId)`, reverse lookup, and a partial unique Owner index per workspace. |
| `workspace_invitations` | References a workspace and inviter. Unique token hash, partial unique pending `(workspaceId, email)`, and `(workspaceId, status, expiresAt)` for invitation lookups. |
| `projects` | References a workspace and manager. Indexes on `(workspaceId, status)` and `(managerId, status)`. |
| `project_members` | Joins users and projects. Unique `(projectId, userId)` and a reverse lookup. |
| `tasks` | References a project, creator, optional updater, and optional assignee. Project-prefixed status, assignee, priority, due date, creation order, and title-text indexes. |

Zod validates the public request shape, field limits, supported statuses, and ID formats. Services check resource ownership, membership, assignee eligibility, and date relationships. Mongoose schemas and MongoDB indexes protect persisted fields and uniqueness. Date-only values are stored at UTC midnight and returned as `YYYY-MM-DD`. [Data model](../DATABASE_DESIGN.md) · [Request validation decision](003-backend-validation.md)

## Authorization

Routes verify sessions and CSRF. Services derive permissions from the requested workspace, project, and current membership. Workspace Owners can manage their workspace’s projects. Managers can manage assigned projects, and a current project membership grants read access within the user’s workspace. Developers can move their assigned unfinished tasks through review. Approval or reopening Done requires an Owner or assigned Manager. Services check project access before listing, searching, or aggregating tasks. Missing and inaccessible resources share the same public response so IDs alone disclose no private records. The UI uses the same role boundaries when displaying actions. [Runtime project rules](../../backend/src/modules/projects/project.service.ts) · [Runtime task rules](../../backend/src/modules/tasks/task.service.ts)

## Transactions and concurrent writes

- Creating a workspace also creates its Owner membership. Creating a project or changing its manager ensures the assigned manager’s project membership.
- Accepting an invitation claims the invitation and creates workspace membership together. Issuing a replacement invitation updates an expired pending invitation and inserts the new one together.
- Workspace removal deletes project memberships and unassigns affected tasks while retaining the tasks. Project removal of a member similarly unassigns their tasks within that project.
- Project, workspace membership, and task mutations update the same workspace revision inside their transactions. This coordinates concurrent membership and assignment changes. Removal and role downgrade also check for assigned projects, including archived projects.
- Rotating an existing session, changing a password, and consuming a password reset token each group their related writes. Rollback tests verify that a failed operation leaves the related records consistent.

Transactions keep the MVP rules atomic and require a transaction-capable MongoDB deployment. A shared workspace revision can increase contention in a very busy workspace. [Workspace revision write](../../backend/src/modules/workspaces/workspace.repository.ts) · [Integration coverage and timing](006-stage1-verification.md)

## Indexing and queries

Search and filtering use the authorized project as the first match. Exact IDs use the built-in ObjectId index. Word search uses the project-prefixed MongoDB text index. The list sorts by `createdAt` and `_id` so equal timestamps have stable pagination, and `$facet` returns the page and exact filtered count. The exact count still processes all matches. The dashboard aggregates only that project’s tasks using the same project scope. The measured fixture has 10,000 tasks across 24 projects, with 800 in the target project. [M12 query plans](005-task-search-indexes.md) · [M14 timing and index check](006-stage1-verification.md)

## Frontend fetching and updates

The browser makes same-origin `/api/v1` requests. React Router keeps resource IDs and applied task filters in the URL. TanStack Query keys include the user, resource, and filters where applicable. The Kanban board follows all API pages for the active filter. Mutations update or invalidate task, board, list, and dashboard data after a confirmed response. The client can keep prior usable data visible during a refetch and show an error when a write fails. Task details use a route-backed drawer over the current board or list, with a dedicated view for direct links. This design keeps the backend authoritative, with refetching to pick up changes made in other sessions. [Vite proxy decision](002-local-api-proxy.md) · [Studio UI specification](../UI_UX_DESIGN.md)
