# DevFlow API reference

The endpoints below use `/api/v1`. The local browser calls them through the Vite proxy on `http://127.0.0.1:5173`. Express also listens on `http://127.0.0.1:3000`. `GET /api/health` returns `200` and `{ "status": "ok" }` as a separate startup check.

## Requests, sessions, and errors

- Request bodies use JSON. IDs in paths and bodies are 24-character MongoDB ObjectId strings. Date-only fields use `YYYY-MM-DD` or `null` as indicated. Timestamps are ISO 8601 UTC strings.
- Session-authenticated routes use the HTTP-only session cookie. Send the allowed browser `Origin`, the CSRF cookie issued by `GET /auth/csrf`, and its matching `X-CSRF-Token` header on every `POST`, `PATCH`, and `DELETE`. Fetch a token again after login changes the session.
- Successful JSON responses use `{ "data": … }`. Paginated endpoints add `pagination` with `page`, `limit`, `total`, and `totalPages`. A `204` response has an empty body. `—` in the input column means the endpoint needs no body or query fields.
- Errors use `{ "error": { "code": "…", "message": "…", "details": […] } }`. `details` is optional. Validation details identify fields such as `body.title` and `query.limit`.
- Common statuses are `400 VALIDATION_ERROR` for invalid inputs on validated routes or malformed JSON, `401 UNAUTHENTICATED` for missing or expired sessions, and `403 CSRF_TOKEN_INVALID` for failed write-origin or token checks. An inaccessible workspace, project, or task can return the same `404 NOT_FOUND` as a missing resource. Oversized and unsupported request encodings return `413` and `415`. Internal failures return `500`, and database connectivity failures can return `503`.

Tables show the successful response and additional route-specific error cases. See the [approved API design](API_DESIGN.md) for examples and policy details.

## Authentication and profile

| Endpoint | Access | Input | Success | Specific errors |
| --- | --- | --- | --- | --- |
| `GET /auth/csrf` | Public | — | `200` `{ csrfToken }` plus an HTTP-only CSRF cookie when a fresh token is needed | Shared errors above |
| `POST /auth/register` | Public, CSRF required | `name`, `email`, `password` | `201` Public user | `409 EMAIL_ALREADY_EXISTS`, `429 RATE_LIMITED` |
| `POST /auth/login` | Public, CSRF required | `email`, `password` | `200` Public user and session cookie | `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED` |
| `POST /auth/logout` | CSRF required, current session removed when present | No body or `{}` | `204`, clears session and CSRF cookies | Shared errors above |
| `GET /auth/me` | Signed in | — | `200` Public user | `401 UNAUTHENTICATED` |
| `POST /auth/forgot-password` | Public, CSRF required | `email` | `202` `{ message }`, same response for any valid email | `429 RATE_LIMITED` |
| `POST /auth/reset-password` | Public, CSRF required, valid single-use link | `token`, `newPassword` | `204`, consumes token and revokes sessions | `400 INVALID_RESET_TOKEN` for unknown token, `410 RESET_TOKEN_UNAVAILABLE` for an expired, consumed, or stale token, `429 RATE_LIMITED` |
| `PATCH /users/me` | Signed in, own account | At least one of `name`, `email`, `profile: { bio }`. Give `currentPassword` for an email change | `200` Updated public user | `400 CURRENT_PASSWORD_REQUIRED`, `401 INVALID_CURRENT_PASSWORD`, `409 EMAIL_ALREADY_EXISTS` or `PROFILE_CHANGED` |
| `PATCH /users/me/password` | Signed in, own account | `currentPassword`, `newPassword` | `204`, revokes sessions and clears cookies | `401 INVALID_CURRENT_PASSWORD`, `429 RATE_LIMITED` |

Public user fields are `id`, `name`, `email`, `createdAt`, `updatedAt`, and optional `profile: { bio }`. Names are 2–100 characters. Emails are trimmed and lowercased. New passwords are 12–128 characters and login/current passwords are 1–128. Profile bios allow up to 500 characters. Password reset links expire after 30 minutes. Sessions expire after seven days. Rate-limited account operations use per-route 15-minute windows.

## Workspaces and invitations

| Endpoint | Access | Input | Success | Specific errors |
| --- | --- | --- | --- | --- |
| `POST /workspaces` | Signed in | `name`, optional `description` | `201` Workspace with `myRole: OWNER` | Shared errors above |
| `GET /workspaces` | Signed in | — | `200` Workspace array for current memberships, ordered by name and ID | Shared errors above |
| `GET /workspaces/:id` | Workspace member | — | `200` Workspace | `404 NOT_FOUND` |
| `PATCH /workspaces/:id` | Workspace Owner | At least one of `name`, `description` | `200` Updated workspace | `403 FORBIDDEN`, `404 NOT_FOUND` |
| `GET /workspaces/:id/members` | Workspace member | — | `200` Workspace member array | `404 NOT_FOUND` |
| `PATCH /workspaces/:id/members/:userId` | Workspace Owner | `role` is `MANAGER` or `DEVELOPER` | `200` Updated workspace member | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` for the Owner or `MANAGER_REPLACEMENT_REQUIRED` for a downgrade with assigned projects |
| `DELETE /workspaces/:id/members/:userId` | Workspace Owner | — | `204`, removes related project memberships and unassigns tasks | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` or `MANAGER_REPLACEMENT_REQUIRED` |
| `POST /workspaces/:id/invitations` | Workspace Owner | `email`, `role` is `MANAGER` or `DEVELOPER` | `201` `{ id, email, role, status, expiresAt, acceptUrl }` | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVITATION_ALREADY_EXISTS` or `MEMBERSHIP_ALREADY_EXISTS` |
| `GET /workspaces/:id/invitations` | Workspace Owner | Optional `status` | `200` Array of `{ id, email, role, status, createdAt, expiresAt }` | `403 FORBIDDEN`, `404 NOT_FOUND` |
| `GET /invitations/:token` | Public, valid link | — | `200` `{ workspaceName, role, maskedEmail, expiresAt }` | `404 NOT_FOUND` for an unknown or invalid link, `410 INVITATION_UNAVAILABLE` for a closed or expired link |
| `POST /invitations/:token/accept` | Signed in with the invited email, valid link | No body or `{}` | `200` Workspace with the accepted role | `403 FORBIDDEN` for email mismatch, `404 NOT_FOUND`, `409 MEMBERSHIP_ALREADY_EXISTS`, `410 INVITATION_UNAVAILABLE` |

Workspace fields are `id`, `name`, `description`, `ownerId`, `myRole`, `createdAt`, and `updatedAt`. A workspace name is 2–100 characters and its description is at most 500. A workspace member has `user: { id, name, email }`, `role`, and `joinedAt`. Invitations last seven days and their statuses are `PENDING`, `ACCEPTED`, `EXPIRED`, and `REVOKED`. Owners share the `acceptUrl` returned at creation.

## Projects and dashboard

| Endpoint | Access | Input | Success | Specific errors |
| --- | --- | --- | --- | --- |
| `POST /workspaces/:id/projects` | Workspace Owner or Manager. A Manager assigns themself | Required `name`, `managerId`. Optional `description`, `status`, `startDate`, `targetDate` | `201` Project | `400` for an ineligible manager or invalid dates, `403 FORBIDDEN`, `404 NOT_FOUND` |
| `GET /workspaces/:id/projects` | Workspace member, projects scoped to access | Optional `status`, `page`, `limit` | `200` Paginated project array | `404 NOT_FOUND` |
| `GET /projects/:id` | Project access | — | `200` Project | `404 NOT_FOUND` |
| `PATCH /projects/:id` | Workspace Owner or assigned Project Manager | One or more fields accepted by project creation | `200` Updated project | `400` for an ineligible manager or invalid dates, `403 FORBIDDEN`, `404 NOT_FOUND` |
| `GET /projects/:id/members` | Project access | — | `200` Array of `{ user: { id, name }, workspaceRole, joinedAt }` | `404 NOT_FOUND` |
| `POST /projects/:id/members` | Workspace Owner or assigned Project Manager | `userId` of a workspace member | `201` `{ id, projectId, userId, joinedAt }` | `400` for an ineligible member, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 MEMBERSHIP_ALREADY_EXISTS` |
| `DELETE /projects/:id/members/:userId` | Workspace Owner or assigned Project Manager | — | `204`, unassigns this member’s tasks in the project | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 MANAGER_REPLACEMENT_REQUIRED` |
| `GET /projects/:id/dashboard` | Project access | — | `200` `{ projectId, totalTasks, completedTasks, inProgressTasks, overdueTasks, completionPercentage, priorityCounts, sprintProgress }` | `404 NOT_FOUND` |

Project fields are `id`, `workspaceId`, `name`, `description`, `managerId`, `status`, `startDate`, `targetDate`, `createdAt`, and `updatedAt`. Names are 3–150 characters and descriptions are at most 2,000. Dates are optional and nullable. If both are present, `targetDate` must be on or after `startDate`. Statuses are `PLANNED`, `ACTIVE`, `COMPLETED`, and `ARCHIVED`. New projects default to `PLANNED`. Listings default to unarchived projects. Project access requires current workspace membership plus workspace ownership, assigned management, or project membership. Dashboard overdue counts use UTC calendar days and unfinished tasks. Completion is rounded to two decimal places and is zero for an empty project.

`priorityCounts` includes `LOW`, `MEDIUM`, `HIGH` and `URGENT`, counting every current task in the project once, including Done and unscheduled tasks. `sprintProgress` includes up to five sprint summaries in the same shape as sprint detail. The active sprint appears first, followed by the most recent sprints by planned start date and ID. Planned and active progress follows current task membership and status. Completed progress uses the saved snapshot from completion, so subsequent rollovers, reopenings and deletions do not change it.

## Tasks

| Endpoint | Access | Input | Success | Specific errors |
| --- | --- | --- | --- | --- |
| `POST /projects/:id/tasks` | Project access | Required `title`. Optional `description`. Owners and assigned Managers may also set `assigneeId`, `priority`, `status`, `dueDate` | `201` Task | `400` for an ineligible assignee, `403 FORBIDDEN` for management fields without permission, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects |
| `GET /projects/:id/tasks` | Project access | Optional `status`, `priority`, `assigneeId`, `search`, `sprintId`, `blocked`, `unfinished`, `page`, `limit` | `200` Paginated task array | `400 VALIDATION_ERROR`, `404 NOT_FOUND` |
| `GET /tasks/:id` | Project access | — | `200` Task | `404 NOT_FOUND` |
| `PATCH /tasks/:id` | Workspace Owner or assigned Project Manager | At least one of `title`, `description`, `assigneeId`, `priority`, `dueDate`. Optional `expectedVersion` | `200` Updated task | `400` for an ineligible assignee, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects, `409 STALE_VERSION` |
| `PATCH /tasks/:id/status` | Workspace Owner, assigned Project Manager, or assigned Developer within the status rules | `status`, optional `expectedVersion` | `200` Updated task | `403 FORBIDDEN` for disallowed transitions or unassigned Developers, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects, `409 STALE_VERSION` |
| `DELETE /tasks/:id` | Workspace Owner or assigned Project Manager | — | `204`, permanently removes task | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects |

Task fields are `id`, `projectId`, `version`, `sprintId`, `title`, `description`, `assigneeId`, `priority`, `status`, `dueDate`, `createdBy`, `updatedBy`, `createdAt`, and `updatedAt`. Titles are 3–200 characters and descriptions are up to 5,000. `sprintId`, `assigneeId`, `dueDate`, and `updatedBy` can be `null`. Older tasks without a stored sprint ID are returned with `sprintId: null`. Defaults are `BACKLOG`, `MEDIUM`, no assignee, and no due date. Priorities are `LOW`, `MEDIUM`, `HIGH`, `URGENT`. Statuses are `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`. Assigned Developers can update their own unfinished tasks to any of the first four statuses. Owners and assigned Managers can approve or reopen `DONE` tasks.

Project and task lists default to page `1` and limit `20`, with a maximum limit of `100`. Lists sort newest first by `createdAt` and ID. Task filters combine within a single authorized project. `assigneeId` accepts a full user ID or `unassigned`. `search` allows up to 200 characters and matches a full task ID or words in the title.

`sprintId` on the task list accepts a sprint in the project or `none` for unscheduled tasks. A sprint ID outside the current project returns `404 NOT_FOUND`. Set `unfinished=true` with a specific sprint ID to exclude Done tasks before pagination. `unfinished` and `status` are mutually exclusive.

`blocked=true` keeps tasks with at least one direct prerequisite in the project whose status is outside `DONE`. `blocked=false` keeps tasks with no such prerequisite, including tasks with no prerequisites. Omitting `blocked` returns both. All filters apply before pagination to both rows and totals. The task list stores applied filters in the URL and resets to page one when filters are applied or cleared.

### Task write conflicts

Task responses include a non-negative integer `version`. A task with no stored version is read as `0`. A client can send the version it read as `expectedVersion` in an edit or status PATCH body, or as a decimal query parameter on a sprint membership POST or DELETE.

When the version no longer matches, an otherwise permitted write returns `409` with `error.code` set to `STALE_VERSION`. Refetch `GET /tasks/:id` under the current session, show the latest values, and use that version on an intentional retry. A rejected stale write leaves the task and activity unchanged. Authorization, archive and transition checks still apply.

Clients that omit `expectedVersion` retain the existing write behavior. Successful patches increment the version, including patches from those clients. Sprint membership changes, rollover and membership-driven unassignment also increment the affected task versions. Repeating an add to the task’s current sprint at the current version returns the existing task.

## Sprints

Authorized project readers can view sprint list, detail and tasks, including on archived projects. Sprint mutations require the workspace Owner or assigned Manager, CSRF protection, and a project that is open for edits.

| Endpoint | Input | Success | Specific errors |
| --- | --- | --- | --- |
| `GET /projects/:projectId/sprints` | Optional `page`, `limit` | `200` Paginated sprint array, sorted by descending start date and ID | `404 NOT_FOUND` |
| `POST /projects/:projectId/sprints` | `name`, `startDate`, `endDate` | `201` Planned sprint | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |
| `GET /sprints/:sprintId` | — | `200` Sprint with progress | `404 NOT_FOUND` |
| `POST /sprints/:sprintId/start` | Empty body or `{}` | `200` Active sprint | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` or `ACTIVE_SPRINT_EXISTS` |
| `POST /sprints/:sprintId/complete` | `{ rolloverSprintId }` with a sprint ID or `null` | `200` Completed sprint with saved progress | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |
| `POST /sprints/:sprintId/tasks/:taskId` | Empty body or `{}`. Optional `expectedVersion` query parameter | `200` Task with current sprint membership | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE`, `409 STALE_VERSION` |
| `DELETE /sprints/:sprintId/tasks/:taskId` | Empty body or `{}`. Optional `expectedVersion` query parameter | `204` Membership cleared | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE`, `409 STALE_VERSION` |

Sprint fields are `id`, `projectId`, `name`, `startDate`, `endDate`, `status`, `createdAt`, `updatedAt`, `startedAt`, `completedAt`, `completionSnapshot` and `progress`. A sprint name is 3–150 characters after trimming. Dates are required and the end must be on or after the start. Only explicit lifecycle actions change `PLANNED` to `ACTIVE` and `ACTIVE` to `COMPLETED`. The lifecycle timestamps are nullable until their transition. The snapshot is null until completion, then contains `totalTasks` and `completedTasks`. Progress also contains `unfinishedTasks` and `completionPercentage`, rounded to two decimal places and zero when empty.

Membership changes preserve task status. An add can be repeated against the same planned or active sprint, and a task assigned to a different sprint must first be removed from it. Completed membership is closed to direct membership edits. At completion, unfinished tasks move to the backlog by clearing `sprintId` or into the selected same-project planned sprint starting after the current sprint ends. Done tasks remain linked. Later changes to a task do not change a completed sprint’s snapshot.

## Task comments

Authorized project readers can view comments. Project readers can post to editable projects. Only the author may edit or delete their comment. Archived projects retain the discussion for reading.

| Endpoint | Input | Success | Specific errors |
| --- | --- | --- | --- |
| `GET /tasks/:taskId/comments` | Optional `page`, `limit` | `200` Paginated comments, ordered newest first by creation time and ID | `404 NOT_FOUND` |
| `GET /tasks/:taskId/comments/mention-options` | — | `200` Array of `{ id, name }` for users with current project access | `404 NOT_FOUND` |
| `POST /tasks/:taskId/comments` | `body`, optional `mentionUserIds` | `201` Created comment | `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 INVALID_STATE` |
| `PATCH /tasks/:taskId/comments/:commentId` | At least one of `body` or `mentionUserIds` | `200` Updated comment | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |
| `DELETE /tasks/:taskId/comments/:commentId` | — | `204` Comment deleted | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |

Comment fields are `id`, `taskId`, `author: { id, name }`, `body`, `mentionUserIds`, `mentions: [{ id, name }]`, `revision`, `createdAt`, and `updatedAt`. A missing person’s display name is `null`. The body is plain text and accepts 1–5,000 characters after trimming. Mention IDs are a distinct list of up to 20 eligible users. On edit, the server validates the resulting list. Remove any mention that has lost project access before saving. Use an empty list to clear mentions. Deleting a task permanently removes its comments.

## Task activity

`GET /tasks/:taskId/activity` returns `200` with paginated activity. It accepts `page` and `limit` and sorts newest first by timestamp and ID. A missing or inaccessible task returns `404 NOT_FOUND`. Authorized readers can view activity on tasks in archived projects.

Each entry includes `id`, `taskId`, `actor: { id, name }`, `action`, `changes`, `completed`, and `createdAt`. Action is `TASK_CREATED` or `TASK_UPDATED`. A change has `field`, `from`, and `to`. Tracked fields are `assigneeId`, `priority`, `status` and `sprintId`. Reference changes also include nullable `fromLabel` and `toLabel`. An unavailable actor is represented by their ID and a null name.

A creation entry contains the initial non-null tracked values. Updates record only actual changes, grouped in one entry per task and operation. A transition into `DONE` sets `completed: true` on that status entry. A task created in `DONE` has an initial Done status in its creation entry. Tasks created before M19 start with empty history. Permanent task deletion removes its timeline.

## Task dependencies

A dependency from A to B means A waits for B. Project readers can view dependencies, including on archived projects. Mutations require an editable project and its workspace Owner or assigned Manager.

| Endpoint | Input | Success | Specific errors |
| --- | --- | --- | --- |
| `GET /tasks/:taskId/dependencies` | — | `200` with `{ prerequisites, dependents, blocked }` in `data` | `404 NOT_FOUND` |
| `POST /tasks/:taskId/dependencies/:prerequisiteId` | Empty body or `{}` | `201` with `{ taskId, prerequisiteId }` in `data` | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE`, `DEPENDENCY_EXISTS` or `DEPENDENCY_CYCLE` |
| `DELETE /tasks/:taskId/dependencies/:prerequisiteId` | Empty body or `{}` | `204` | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |

Both task arrays contain `{ id, title, status }`, ordered by title then ID. `prerequisites` are tasks the current task waits for. `dependents` are tasks waiting for the current task. A task is blocked when at least one direct prerequisite has a status other than `DONE`. Completing or reopening a prerequisite changes the derived result. This indicator is informational and task status transitions follow their existing rules.

Self-links and visible cross-project endpoints return `400`. An inaccessible or missing task returns `404`. A duplicate or cycle returns the corresponding `409` code. Permanently deleting a task removes dependency links in both directions.

## Project live updates

Socket.IO uses WebSocket transport at `/socket.io` on the same server as REST. The handshake requires the current session cookie and an origin in `APP_ORIGINS`. Writes continue through the REST endpoints.

| Event | Direction | Payload or acknowledgement |
| --- | --- | --- |
| `project:subscribe` | Client → server | `{ projectId }`. Acknowledges with `{ data: { projectId } }` or `{ error: { code, message } }`. Invalid IDs return `VALIDATION_ERROR` and missing or inaccessible projects return `NOT_FOUND`. |
| `project:unsubscribe` | Client → server | Same input and envelope. Unsubscribe is idempotent. |
| `project:changed` | Server → client | `{ eventId, projectId, kind, taskId?, version? }`. Kinds are `task.changed`, `task.deleted`, `comment.changed`, `sprint.changed`, and `project.changed`. A changed task includes its committed version. |
| `project:access-revoked` | Server → client | `{ projectId }` sent privately to an affected session when its subscription is removed. |

Project signals are published after the corresponding REST commit. Active sessions and project access are revalidated before delivery. Session revocation disconnects the socket. Clients resubscribe and refetch authorized data after reconnecting. Delivery is a hint to refresh the affected views. [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)

## Notifications

The signed-in session identifies the recipient. Notifications sort newest first by creation time and ID. Opening a linked task uses the existing task access checks.

| Endpoint | Input | Success | Specific errors |
| --- | --- | --- | --- |
| `GET /notifications` | Optional `page`, `limit` | `200` Paginated notifications | `400 VALIDATION_ERROR` |
| `GET /notifications/unread-count` | — | `200` with `{ count }` in `data` | Shared errors |
| `PATCH /notifications/:id` | `{ read: true }` with the usual write CSRF checks | `200` Updated notification. Repeats preserve the first read timestamp | `400 VALIDATION_ERROR`, `404 NOT_FOUND` for missing IDs or another recipient’s item |

Notification fields are `id`, `kind`, `createdAt`, nullable `readAt`, and `unavailable`. Accessible task notifications include `task: { id, title }`. An available invitation for the recipient’s current email includes `workspaceName` and uses the Owner’s manually shared acceptance link. Items that have become unavailable retain read state and omit related task and workspace details.

Kinds are `ASSIGNMENT`, `MENTION`, `REVIEW`, `REOPENED`, `DEADLINE`, and `INVITATION`. `REOPENED` goes to the current assignee when another user moves their task out of `DONE`. The server sends a payload-free `notifications:changed` socket event to the authenticated recipient’s sessions after an insertion or read-state change. The client refetches the inbox and unread count from REST. Project membership removal also signals the affected account so open inboxes can refresh link visibility.
