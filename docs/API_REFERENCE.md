# DevFlow API reference

The Stage 1 and sprint endpoints below use `/api/v1`. The local browser calls them through the Vite proxy on `http://127.0.0.1:5173`. Express also listens on `http://127.0.0.1:3000`. `GET /api/health` returns `200` and `{ "status": "ok" }` as a separate startup check.

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
| `GET /projects/:id/dashboard` | Project access | — | `200` `{ projectId, totalTasks, completedTasks, inProgressTasks, overdueTasks, completionPercentage }` | `404 NOT_FOUND` |

Project fields are `id`, `workspaceId`, `name`, `description`, `managerId`, `status`, `startDate`, `targetDate`, `createdAt`, and `updatedAt`. Names are 3–150 characters and descriptions are at most 2,000. Dates are optional and nullable. If both are present, `targetDate` must be on or after `startDate`. Statuses are `PLANNED`, `ACTIVE`, `COMPLETED`, and `ARCHIVED`. New projects default to `PLANNED`. Listings default to unarchived projects. Project access requires current workspace membership plus workspace ownership, assigned management, or project membership. Dashboard overdue counts use UTC calendar days and unfinished tasks. Completion is rounded to two decimal places and is zero for an empty project.

## Tasks

| Endpoint | Access | Input | Success | Specific errors |
| --- | --- | --- | --- | --- |
| `POST /projects/:id/tasks` | Project access | Required `title`. Optional `description`. Owners and assigned Managers may also set `assigneeId`, `priority`, `status`, `dueDate` | `201` Task | `400` for an ineligible assignee, `403 FORBIDDEN` for management fields without permission, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects |
| `GET /projects/:id/tasks` | Project access | Optional `status`, `priority`, `assigneeId`, `search`, `sprintId`, `unfinished`, `page`, `limit` | `200` Paginated task array | `404 NOT_FOUND` |
| `GET /tasks/:id` | Project access | — | `200` Task | `404 NOT_FOUND` |
| `PATCH /tasks/:id` | Workspace Owner or assigned Project Manager | At least one of `title`, `description`, `assigneeId`, `priority`, `dueDate` | `200` Updated task | `400` for an ineligible assignee, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects |
| `PATCH /tasks/:id/status` | Workspace Owner, assigned Project Manager, or assigned Developer within the status rules | `status` | `200` Updated task | `403 FORBIDDEN` for disallowed transitions or unassigned Developers, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects |
| `DELETE /tasks/:id` | Workspace Owner or assigned Project Manager | — | `204`, permanently removes task | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` on archived projects |

Task fields are `id`, `projectId`, `sprintId`, `title`, `description`, `assigneeId`, `priority`, `status`, `dueDate`, `createdBy`, `updatedBy`, `createdAt`, and `updatedAt`. Titles are 3–200 characters and descriptions are up to 5,000. `sprintId`, `assigneeId`, `dueDate`, and `updatedBy` can be `null`. Older tasks without a stored sprint ID are returned with `sprintId: null`. Defaults are `BACKLOG`, `MEDIUM`, no assignee, and no due date. Priorities are `LOW`, `MEDIUM`, `HIGH`, `URGENT`. Statuses are `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`. Assigned Developers can update their own unfinished tasks to any of the first four statuses. Owners and assigned Managers can approve or reopen `DONE` tasks.

Project and task lists default to page `1` and limit `20`, with a maximum limit of `100`. Lists sort newest first by `createdAt` and ID. Task filters combine within a single authorized project. `assigneeId` accepts a full user ID or `unassigned`. `search` allows up to 200 characters and matches a full task ID or words in the title.

`sprintId` on the task list accepts a sprint in the project or `none` for unscheduled tasks. A sprint ID outside the current project returns `404 NOT_FOUND`. Set `unfinished=true` with a specific sprint ID to exclude Done tasks before pagination. `unfinished` and `status` are mutually exclusive.

## Sprints

Authorized project readers can view sprint list, detail and tasks, including on archived projects. Sprint mutations require the workspace Owner or assigned Manager, CSRF protection, and a project that is open for edits.

| Endpoint | Input | Success | Specific errors |
| --- | --- | --- | --- |
| `GET /projects/:projectId/sprints` | Optional `page`, `limit` | `200` Paginated sprint array, sorted by descending start date and ID | `404 NOT_FOUND` |
| `POST /projects/:projectId/sprints` | `name`, `startDate`, `endDate` | `201` Planned sprint | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |
| `GET /sprints/:sprintId` | — | `200` Sprint with progress | `404 NOT_FOUND` |
| `POST /sprints/:sprintId/start` | Empty body or `{}` | `200` Active sprint | `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` or `ACTIVE_SPRINT_EXISTS` |
| `POST /sprints/:sprintId/complete` | `{ rolloverSprintId }` with a sprint ID or `null` | `200` Completed sprint with saved progress | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |
| `POST /sprints/:sprintId/tasks/:taskId` | Empty body or `{}` | `200` Task with current sprint membership | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |
| `DELETE /sprints/:sprintId/tasks/:taskId` | Empty body or `{}` | `204` Membership cleared | `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE` |

Sprint fields are `id`, `projectId`, `name`, `startDate`, `endDate`, `status`, `createdAt`, `updatedAt`, `startedAt`, `completedAt`, `completionSnapshot` and `progress`. A sprint name is 3–150 characters after trimming. Dates are required and the end must be on or after the start. Only explicit lifecycle actions change `PLANNED` to `ACTIVE` and `ACTIVE` to `COMPLETED`. The lifecycle timestamps are nullable until their transition. The snapshot is null until completion, then contains `totalTasks` and `completedTasks`. Progress also contains `unfinishedTasks` and `completionPercentage`, rounded to two decimal places and zero when empty.

Membership changes preserve task status. An add can be repeated against the same planned or active sprint, and a task assigned to a different sprint must first be removed from it. Completed membership is closed to direct membership edits. At completion, unfinished tasks move to the backlog by clearing `sprintId` or into the selected same-project planned sprint starting after the current sprint ends. Done tasks remain linked. Later changes to a task do not change a completed sprint’s snapshot.
