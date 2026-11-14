# DevFlow — Detailed REST API Design Specification

**Project:** DevFlow  
**Stage:** Stage 1 — Minimum Viable Product  
**Document Version:** 1.0  
**Date:** November 13, 2026  
**Status:** Draft — Awaiting Approval  
**Backend:** Node.js, Express.js, TypeScript  
**Database:** MongoDB with Mongoose  
**Validation:** Zod  
**Based On:** Approved Scope, SRS, System Design, and Database Design

---

# 1. Introduction

## 1.1 Purpose

This document defines the REST APIs that the DevFlow frontend will use to communicate with the backend.

It explains:

- What API endpoints are needed.
- Which HTTP methods each endpoint uses.
- What information the frontend sends.
- What information the backend returns.
- Which users can access each endpoint.
- How requests are validated.
- How errors are handled.
- How authentication and authorization work.
- How APIs will be tested.

The purpose is to establish a clear agreement between frontend and backend development before writing implementation code.

## 1.2 API Objectives

DevFlow APIs must:

1. Support all approved Stage 1 functionality.
2. Use consistent URL naming.
3. Use standard HTTP methods.
4. Return predictable JSON responses.
5. Validate requests before processing.
6. Enforce user permissions.
7. Protect workspace and project data.
8. Handle errors consistently.
9. Support searching, filtering, and pagination.
10. Be easy to test and maintain.

## 1.3 API Architecture

DevFlow will use REST APIs.

The frontend will communicate with the backend using HTTP requests.

The backend will use the following structure:

**Route → Middleware → Controller → Service → Repository → Database**

Each layer has a different responsibility.

- **Route:** Connects a URL to the correct controller.
- **Middleware:** Performs common checks such as authentication and validation.
- **Controller:** Handles HTTP requests and responses.
- **Service:** Applies business rules.
- **Repository:** Performs database operations.
- **Database:** Stores the information.

The frontend must never connect directly to MongoDB.

---

# 2. API Standards and Conventions

## 2.1 Base URL

Every business API will use this prefix:

`/api/v1`

Example:

`GET /api/v1/workspaces`

The `/v1` part identifies API version 1.

This allows us to introduce another API version later if breaking changes are needed.

## 2.2 HTTP Methods

| Method | Purpose |
|---|---|
| GET | Retrieve information |
| POST | Create a resource or perform a defined action |
| PATCH | Update selected fields |
| DELETE | Delete a resource or remove a relationship |

GET requests must not change application data.

## 2.3 Content Type

Requests containing JSON must use:

`Content-Type: application/json`

Successful responses containing data will also use JSON.

## 2.4 API Field Naming

JSON fields will use camelCase.

Examples:

- `workspaceId`
- `assigneeId`
- `createdAt`
- `targetDate`

MongoDB stores identifiers using `_id`, but API responses will expose them as `id`.

Example:

MongoDB: `_id`

API response: `id`

## 2.5 Identifier Format

Users, workspaces, projects, memberships, and tasks use MongoDB ObjectIds.

In APIs, they will be represented as 24-character hexadecimal strings.

Example:

`507f1f77bcf86cd799439011`

The backend must validate identifier format before querying MongoDB.

## 2.6 Date Formats

We will use two formats.

**Calendar dates:**

`YYYY-MM-DD`

Example: `2026-11-20`

Used for:

- Task due dates.
- Project start dates.
- Project target dates.

**Exact timestamps:**

ISO 8601 UTC format.

Example:

`2026-11-13T10:30:00.000Z`

Used for:

- Account creation.
- Record updates.
- Session expiration.
- Invitation expiration.

Optional calendar dates can be set to `null`.

The database stores dates using the rules established in the approved database design.

## 2.7 Unknown Fields

The API must reject unknown or unsupported fields in request bodies.

For example, a developer must not be able to change the task creator by submitting a `createdBy` field.

Only explicitly supported fields can be modified.

---

# 3. Standard API Response Format

All endpoints should follow consistent response conventions.

## 3.1 Successful Response

A successful request returning one resource will use:

```json
{
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Example Resource"
  }
}
```

The `data` property contains the requested resource.

## 3.2 List Response

Endpoints returning a list will use:

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Example"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

For a list without pagination, the response may contain only `data`.

## 3.3 Error Response

Errors will follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields contain invalid values.",
    "details": [
      {
        "field": "email",
        "message": "Enter a valid email address."
      }
    ]
  }
}
```

The error code is intended for application logic.

The message is intended for users or developers.

The `details` array is optional and is mainly used for validation errors.

## 3.4 HTTP Status Codes

| Status | Meaning |
|---|---|
| 200 OK | Request completed successfully |
| 201 Created | New resource created |
| 202 Accepted | Request accepted without revealing the outcome |
| 204 No Content | Action completed without a response body |
| 400 Bad Request | Invalid request |
| 401 Unauthorized | Authentication required or expired |
| 403 Forbidden | Authenticated user lacks permission |
| 404 Not Found | Resource missing or intentionally hidden |
| 409 Conflict | Duplicate or conflicting data |
| 410 Gone | A temporary resource is no longer valid |
| 413 Content Too Large | Request exceeds allowed size |
| 429 Too Many Requests | Rate limit exceeded |
| 500 Internal Server Error | Unexpected server error |
| 503 Service Unavailable | Temporary service failure |

A 204 response must not contain a JSON body.

---

# 4. Common API Data Structures

These are the main structures used across multiple endpoints.

## 4.1 Public User

```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "Alex Perera",
  "email": "alex@example.com",
  "profile": {
    "bio": "Backend Developer"
  },
  "createdAt": "2026-11-13T10:30:00.000Z",
  "updatedAt": "2026-11-13T10:30:00.000Z"
}
```

The user's password hash, sessions, and reset tokens must never appear in a public user response.

Other users' public member summaries will contain only information needed for displaying members, such as ID and name.

## 4.2 Workspace

```json
{
  "id": "507f1f77bcf86cd799439012",
  "name": "ABC Software",
  "description": "Software development team",
  "ownerId": "507f1f77bcf86cd799439011",
  "myRole": "OWNER",
  "createdAt": "2026-11-13T10:30:00.000Z",
  "updatedAt": "2026-11-13T10:30:00.000Z"
}
```

`myRole` is derived from the authenticated user's membership. It is not a field stored in the workspace document.

## 4.3 Workspace Member

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Alex Perera",
    "email": "alex@example.com"
  },
  "role": "DEVELOPER",
  "joinedAt": "2026-11-13T10:30:00.000Z"
}
```

Member information is returned only to authorized workspace users.

## 4.4 Project

A project response contains:

| Field | Type |
|---|---|
| `id` | String |
| `workspaceId` | String |
| `name` | String |
| `description` | String |
| `managerId` | String |
| `startDate` | Date string or null |
| `targetDate` | Date string or null |
| `status` | Project status |
| `createdAt` | ISO timestamp |
| `updatedAt` | ISO timestamp |

Allowed project statuses:

- `PLANNED`
- `ACTIVE`
- `COMPLETED`
- `ARCHIVED`

## 4.5 Task

```json
{
  "id": "507f1f77bcf86cd799439014",
  "projectId": "507f1f77bcf86cd799439013",
  "title": "Create Login API",
  "description": "Implement backend authentication.",
  "assigneeId": "507f1f77bcf86cd799439011",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "dueDate": "2026-11-20",
  "createdBy": "507f1f77bcf86cd799439011",
  "updatedBy": "507f1f77bcf86cd799439011",
  "createdAt": "2026-11-13T10:30:00.000Z",
  "updatedAt": "2026-11-13T10:30:00.000Z"
}
```

Allowed task priorities:

- `LOW`
- `MEDIUM`
- `HIGH`
- `URGENT`

Allowed task statuses:

- `BACKLOG`
- `TODO`
- `IN_PROGRESS`
- `IN_REVIEW`
- `DONE`

---

# 5. Authentication APIs

Authentication uses secure, server-side sessions stored in MongoDB.

## 5.1 Authentication Endpoints

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| AUTH-01 | GET | `/auth/csrf` | Obtain a CSRF protection token |
| AUTH-02 | POST | `/auth/register` | Create an account |
| AUTH-03 | POST | `/auth/login` | Log in |
| AUTH-04 | POST | `/auth/logout` | Log out |
| AUTH-05 | GET | `/auth/me` | Get current user |
| AUTH-06 | POST | `/auth/forgot-password` | Request password recovery |
| AUTH-07 | POST | `/auth/reset-password` | Reset password |

All paths are relative to `/api/v1`.

## AUTH-01 — Get CSRF Token

**Endpoint:** `GET /auth/csrf`

**Authentication:** Not required.

**Purpose:** Provide a token that the browser must submit when making state-changing requests.

**Response:** 200 OK.

```json
{
  "data": {
    "csrfToken": "secure-token-value"
  }
}
```

The actual token is generated by the backend and bound securely to the browser's anti-CSRF state.

The frontend sends it using the `X-CSRF-Token` header.

The token must not be stored in localStorage.

The frontend obtains a fresh token when needed, including after login when the authenticated session changes.

## AUTH-02 — Register User

**Endpoint:** `POST /auth/register`

**Authentication:** Not required.

**Request:**

```json
{
  "name": "Alex Perera",
  "email": "alex@example.com",
  "password": "ExampleSecurePassword123!"
}
```

**Validation:**

- Name: 2–100 characters.
- Email: valid email format.
- Password: minimum 12 characters, maximum 128 characters for the MVP.
- Email must not already exist.
- Normalize email before saving.

**Success:** 201 Created.

**Response:** `data` contains the newly created Public User.

Registration does not automatically log the user in.

**Possible Errors:**

- 400: Invalid information.
- 409: Email already registered.
- 429: Too many requests.

## AUTH-03 — Login

**Endpoint:** `POST /auth/login`

**Authentication:** Not required.

**Request:**

```json
{
  "email": "alex@example.com",
  "password": "ExampleSecurePassword123!"
}
```

**Success:** 200 OK.

**Response:** `data` contains the Public User.

The backend also sets the secure session cookie.

**Business Rules:**

- Verify the submitted password against its stored hash.
- Generate a secure random session token.
- Store only the token hash in MongoDB.
- Send the session token in an HTTP-only cookie.
- Expire the session after its configured lifetime.

**Errors:**

- 400: Invalid request.
- 401: Incorrect credentials.
- 429: Too many login attempts.

The error must not reveal whether the email exists.

## AUTH-04 — Logout

**Endpoint:** `POST /auth/logout`

**Authentication:** Current session, if present.

**Request Body:** None.

**Success:** 204 No Content.

**Behavior:**

- Invalidate the current session.
- Clear the session cookie.
- Subsequent protected requests must not use that session.

Calling logout when no valid session exists may return 204 after clearing the cookie.

## AUTH-05 — Current User

**Endpoint:** `GET /auth/me`

**Authentication:** Required.

**Success:** 200 OK.

**Response:** `data` contains the authenticated Public User.

**Errors:**

- 401: Missing, invalid, or expired session.

## AUTH-06 — Forgot Password

**Endpoint:** `POST /auth/forgot-password`

**Authentication:** Not required.

**Request:**

```json
{
  "email": "alex@example.com"
}
```

**Success:** 202 Accepted.

**Response:**

```json
{
  "data": {
    "message": "If an account exists, password reset instructions will be sent."
  }
}
```

**Business Rules:**

- Do not reveal whether the email is registered.
- Generate a secure reset token for an existing account.
- Store only its hash.
- Set a 30-minute expiration.
- Deliver the reset link through the configured email service.
- Apply rate limiting.

The full Stage 2 notification system is not required.

## AUTH-07 — Reset Password

**Endpoint:** `POST /auth/reset-password`

**Authentication:** Valid reset token.

**Request:**

```json
{
  "token": "received-reset-token",
  "newPassword": "MyNewSecurePassword123!"
}
```

**Success:** 204 No Content.

**Business Rules:**

- Validate the token.
- Reject expired or used tokens.
- Hash the new password.
- Update the user's password.
- Mark the token as used.
- Invalidate existing sessions.

Password update and token consumption must be atomic.

**Errors:**

- 400: Invalid password or token.
- 410: Expired or already-used token.
- 429: Too many attempts.

---

# 6. User Profile APIs

## 6.1 Endpoints

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| USER-01 | PATCH | `/users/me` | Update current profile |
| USER-02 | PATCH | `/users/me/password` | Change password |

## USER-01 — Update Profile

**Endpoint:** `PATCH /users/me`

**Authentication:** Required.

**Editable fields:**

- `name`
- `email`
- `profile.bio`

**Example Request:**

```json
{
  "name": "Alex R. Perera",
  "profile": {
    "bio": "Full-Stack Developer"
  }
}
```

**Validation:**

- Name: 2–100 characters.
- Biography: maximum 500 characters.
- Email: valid and unique.

If the email address changes, the request must also include the current password for verification.

**Success:** 200 OK.

**Response:** Updated Public User.

**Errors:** 400, 401, 409.

## USER-02 — Change Password

**Endpoint:** `PATCH /users/me/password`

**Authentication:** Required.

**Request:**

```json
{
  "currentPassword": "ExistingSecurePassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

**Success:** 204 No Content.

**Rules:**

- Verify the current password.
- Validate the new password.
- Hash and store the new password.
- Invalidate existing sessions after the change.
- Require login again.

**Errors:** 400, 401, 429.

---

# 7. Workspace APIs

## 7.1 Endpoint Summary

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| WS-01 | POST | `/workspaces` | Create workspace |
| WS-02 | GET | `/workspaces` | List my workspaces |
| WS-03 | GET | `/workspaces/:id` | View workspace |
| WS-04 | PATCH | `/workspaces/:id` | Edit workspace |
| WS-05 | GET | `/workspaces/:id/members` | List members |
| WS-06 | PATCH | `/workspaces/:id/members/:userId` | Change member role |
| WS-07 | DELETE | `/workspaces/:id/members/:userId` | Remove member |
| WS-08 | POST | `/workspaces/:id/invitations` | Create invitation |
| WS-09 | GET | `/workspaces/:id/invitations` | View invitations |

## WS-01 — Create Workspace

**Endpoint:** `POST /workspaces`

**Authentication:** Required.

**Request:**

```json
{
  "name": "ABC Software",
  "description": "Our development workspace"
}
```

**Validation:**

- Name: 2–100 characters.
- Description: maximum 500 characters.

**Success:** 201 Created.

**Response:** Workspace object with `myRole: "OWNER"`.

**Business Rules:**

- The creator becomes the Owner.
- Create workspace and Owner membership in a transaction.
- Workspace names do not need to be globally unique.

## WS-02 — List Workspaces

**Endpoint:** `GET /workspaces`

**Authentication:** Required.

**Success:** 200 OK.

**Response:** Array of accessible Workspace objects.

Only workspaces belonging to the authenticated user are returned.

## WS-03 — View Workspace

**Endpoint:** `GET /workspaces/:id`

**Authentication:** Required.

**Permission:** Workspace membership.

**Success:** 200 OK.

**Response:** Workspace object.

**Errors:**

- 400: Invalid ObjectId.
- 404: Workspace missing or inaccessible.

## WS-04 — Update Workspace

**Endpoint:** `PATCH /workspaces/:id`

**Permission:** Workspace Owner only.

**Request:**

```json
{
  "name": "ABC Software Solutions",
  "description": "Updated workspace information"
}
```

**Success:** 200 OK.

**Response:** Updated Workspace.

**Rules:**

- Only editable fields are accepted.
- `ownerId` cannot be changed.
- Workspace ownership transfer is outside Stage 1.

## WS-05 — List Workspace Members

**Endpoint:** `GET /workspaces/:id/members`

**Permission:** Workspace membership.

**Success:** 200 OK.

**Response:** Array of Workspace Member objects.

The list may be paginated when necessary.

## WS-06 — Change Member Role

**Endpoint:** `PATCH /workspaces/:id/members/:userId`

**Permission:** Workspace Owner only.

**Request:**

```json
{
  "role": "MANAGER"
}
```

**Allowed new roles:**

- `MANAGER`
- `DEVELOPER`

**Success:** 200 OK.

**Response:** Updated Workspace Member.

**Business Rules:**

- The Owner's role cannot be changed.
- Only workspace members can have their roles changed.
- Downgrading a Manager cannot leave projects without a valid manager.
- If replacement managers are required, reassignment must occur first.

**Errors:**

- 400: Invalid role.
- 403: Not permitted.
- 404: Member missing.
- 409: Role change conflicts with project responsibilities.

## WS-07 — Remove Workspace Member

**Endpoint:** `DELETE /workspaces/:id/members/:userId`

**Permission:** Workspace Owner only.

**Success:** 204 No Content.

**Rules:**

- The Owner cannot remove themselves.
- A current Project Manager cannot be removed if their projects have not been reassigned.
- Remove the user's project memberships in this workspace.
- Unassign their tasks in this workspace.
- Preserve existing projects and tasks.
- Remove workspace access.

Related changes must be handled consistently using a transaction.

## WS-08 — Create Invitation

**Endpoint:** `POST /workspaces/:id/invitations`

**Permission:** Workspace Owner only.

**Request:**

```json
{
  "email": "developer@example.com",
  "role": "DEVELOPER"
}
```

**Allowed Roles:** `MANAGER`, `DEVELOPER`.

**Success:** 201 Created.

**Response:**

```json
{
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "email": "developer@example.com",
    "role": "DEVELOPER",
    "status": "PENDING",
    "expiresAt": "2026-11-20T10:30:00.000Z",
    "acceptUrl": "https://app.example.com/invitations/example-secret"
  }
}
```

The response contains a secure invitation link that the Owner can share.

The actual invitation token must not be returned by ordinary invitation-list APIs.

**Business Rules:**

- Only invite users who are not already workspace members.
- An invitation cannot assign the OWNER role.
- Prevent duplicate pending invitations.
- Expire invitations after seven days.
- Invitation links must be difficult to guess.

**Errors:** 400, 403, 409.

## WS-09 — List Invitations

**Endpoint:** `GET /workspaces/:id/invitations`

**Permission:** Workspace Owner only.

**Optional Query:**

`?status=PENDING`

**Success:** 200 OK.

**Response:** Invitation summaries including ID, invited email, role, status, creation date, and expiration date.

Secret invitation tokens are never included.

---

# 8. Invitation Acceptance APIs

## 8.1 Endpoints

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| INV-01 | GET | `/invitations/:token` | View invitation information |
| INV-02 | POST | `/invitations/:token/accept` | Accept invitation |

The invitation preview endpoint is a supporting endpoint for the approved invitation-link process, not an additional product feature.

## INV-01 — Preview Invitation

**Authentication:** Not required.

**Purpose:** Allow a user opening an invitation link to see basic invitation information.

**Success:** 200 OK.

**Response:**

```json
{
  "data": {
    "workspaceName": "ABC Software",
    "role": "DEVELOPER",
    "maskedEmail": "d***@example.com",
    "expiresAt": "2026-11-20T10:30:00.000Z"
  }
}
```

The response must not expose unrelated workspace data.

The token must be validated.

Expired or already-used invitations must not be presented as valid.

## INV-02 — Accept Invitation

**Endpoint:** `POST /invitations/:token/accept`

**Authentication:** Required.

**Request Body:** None.

**Success:** 200 OK.

**Response:** Workspace object representing the workspace the user joined.

**Business Rules:**

1. The invitation must exist.
2. The invitation must be pending.
3. The invitation must not be expired.
4. The authenticated user's email must match the invited email.
5. The user must not already belong to the workspace.
6. Create membership and mark invitation accepted atomically.

**Errors:**

- 401: Login required.
- 403: Invited email does not match.
- 404: Invitation not found.
- 409: Already a member.
- 410: Invitation expired or already used.

---

# 9. Project APIs

## 9.1 Endpoint Summary

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| PRJ-01 | POST | `/workspaces/:id/projects` | Create project |
| PRJ-02 | GET | `/workspaces/:id/projects` | List projects |
| PRJ-03 | GET | `/projects/:id` | View project |
| PRJ-04 | PATCH | `/projects/:id` | Update project |
| PRJ-05 | GET | `/projects/:id/members` | View project members |
| PRJ-06 | POST | `/projects/:id/members` | Add project member |
| PRJ-07 | DELETE | `/projects/:id/members/:userId` | Remove member |
| PRJ-08 | GET | `/projects/:id/dashboard` | View project statistics |

## PRJ-01 — Create Project

**Endpoint:** `POST /workspaces/:id/projects`

**Permission:**

- Workspace Owner.
- Workspace Manager.

**Request:**

```json
{
  "name": "E-Commerce Platform",
  "description": "Online shopping application",
  "managerId": "507f1f77bcf86cd799439011",
  "startDate": "2026-11-20",
  "targetDate": "2027-01-20",
  "status": "PLANNED"
}
```

**Validation:**

- Name: 3–150 characters.
- Description: maximum 2,000 characters.
- `managerId`: required ObjectId.
- Dates: valid calendar dates or null.
- Target date cannot be earlier than start date.
- Status must be valid.

**Success:** 201 Created.

**Response:** Project object.

**Business Rules:**

- Project belongs to the workspace from the URL.
- The selected manager must be an eligible OWNER or MANAGER in that workspace.
- A Manager creating a project must assign themselves as its manager.
- An Owner may select an eligible manager.
- Create project and manager membership atomically.

## PRJ-02 — List Projects

**Endpoint:** `GET /workspaces/:id/projects`

**Permission:** Workspace membership.

**Optional Query Parameters:**

| Parameter | Description |
|---|---|
| `status` | Filter by project status |
| `page` | Page number |
| `limit` | Items per page |

Example:

`GET /workspaces/:id/projects?status=ACTIVE&page=1&limit=20`

**Success:** 200 OK.

**Response:** Paginated Project objects.

**Visibility Rules:**

- Owner: all workspace projects.
- Manager: projects they manage or belong to.
- Developer: projects they belong to.

Archived projects are excluded from the default active project list unless explicitly requested.

## PRJ-03 — View Project

**Endpoint:** `GET /projects/:id`

**Permission:** Authorized project access.

**Success:** 200 OK.

**Response:** Project object.

## PRJ-04 — Update Project

**Endpoint:** `PATCH /projects/:id`

**Permission:**

- Workspace Owner.
- Assigned Project Manager.

**Editable Fields:**

- `name`
- `description`
- `managerId`
- `startDate`
- `targetDate`
- `status`

**Example Request:**

```json
{
  "name": "E-Commerce Web Platform",
  "status": "ACTIVE"
}
```

**Success:** 200 OK.

**Response:** Updated Project.

**Business Rules:**

- Validate dates.
- Only eligible users can become Project Managers.
- Ensure a new manager has a project membership.
- Manager changes requiring multiple records must be transactional.
- Archived projects can be restored by an authorized manager or owner.
- Project deletion is not exposed in Stage 1.

## PRJ-05 — View Project Members

**Endpoint:** `GET /projects/:id/members`

**Permission:** Authorized project access.

**Success:** 200 OK.

**Response:** Array of project member summaries.

Each summary includes the user's ID, name, workspace role, and project join date.

## PRJ-06 — Add Project Member

**Endpoint:** `POST /projects/:id/members`

**Permission:** Owner or assigned Project Manager.

**Request:**

```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

**Success:** 201 Created.

**Response:** Created project membership.

**Business Rules:**

- User must belong to the workspace.
- User must not already be a member of the project.
- Only authorized project managers can add members.
- Project memberships do not contain separate project roles.

## PRJ-07 — Remove Project Member

**Endpoint:** `DELETE /projects/:id/members/:userId`

**Permission:** Owner or assigned Project Manager.

**Success:** 204 No Content.

**Business Rules:**

- The designated manager cannot be removed without valid reassignment.
- Assigned tasks remain stored.
- Tasks assigned to the removed member become unassigned.
- Changes must be consistent.

## PRJ-08 — Project Dashboard

**Endpoint:** `GET /projects/:id/dashboard`

**Permission:** Authorized project access.

**Success:** 200 OK.

**Response:**

```json
{
  "data": {
    "projectId": "507f1f77bcf86cd799439013",
    "totalTasks": 20,
    "completedTasks": 8,
    "inProgressTasks": 5,
    "overdueTasks": 3,
    "completionPercentage": 40
  }
}
```

**Calculation Rules:**

- Total: all existing project tasks.
- Completed: status DONE.
- In Progress: status IN_PROGRESS.
- Overdue: due date before today's UTC calendar date and not DONE.
- Completion percentage: completed / total × 100.
- Zero tasks: 0% completion.
- Round completion percentage to two decimal places.

The backend will calculate statistics from the database instead of maintaining duplicate counters.

---

# 10. Task Management APIs

## 10.1 Endpoint Summary

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| TASK-01 | POST | `/projects/:id/tasks` | Create task |
| TASK-02 | GET | `/projects/:id/tasks` | List, search, and filter tasks |
| TASK-03 | GET | `/tasks/:id` | View task |
| TASK-04 | PATCH | `/tasks/:id` | Update task details |
| TASK-05 | PATCH | `/tasks/:id/status` | Update task status |
| TASK-06 | DELETE | `/tasks/:id` | Delete task |

## TASK-01 — Create Task

**Endpoint:** `POST /projects/:id/tasks`

**Permission:** Authorized project member or Workspace Owner.

**Manager/Owner Request:**

```json
{
  "title": "Create Login API",
  "description": "Develop user authentication endpoints.",
  "assigneeId": "507f1f77bcf86cd799439011",
  "priority": "HIGH",
  "status": "TODO",
  "dueDate": "2026-11-25"
}
```

**Validation:**

- Title: 3–200 characters.
- Description: maximum 5,000 characters.
- Assignee: eligible project member or null.
- Priority: supported enum.
- Status: supported enum.
- Due date: valid date or null.

**Defaults:**

- Status: `BACKLOG`.
- Priority: `MEDIUM`.
- Assignee: `null`.
- Due date: `null`.

**Developer Creation Rule:**

Developers can create tasks in their accessible projects using the title and description.

Other task-management fields use their defaults and can be changed by an authorized manager.

This keeps developer task creation within the permissions approved for Stage 1.

**Success:** 201 Created.

**Response:** Task object.

**Business Rules:**

- The project must exist.
- The project must not be archived.
- Task creator must have access.
- The assignee must be an eligible project member.
- The authenticated user becomes `createdBy`.

## TASK-02 — List, Search, and Filter Tasks

**Endpoint:** `GET /projects/:id/tasks`

**Permission:** Authorized project access.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | Enum | Filter by task status |
| `priority` | Enum | Filter by task priority |
| `assigneeId` | ObjectId or `unassigned` | Filter by assignee |
| `search` | String | Search title or exact task ID |
| `page` | Integer | Page number |
| `limit` | Integer | Results per page |

Example:

`GET /projects/:id/tasks?status=TODO&priority=HIGH&page=1&limit=20`

**Pagination Rules:**

- Default page: 1.
- Default limit: 20.
- Maximum limit: 100.
- Default ordering: newest task first, using creation time and ID as stable ordering fields.

**Search Rules:**

- A valid full ObjectId may be searched as an exact task ID.
- Other search text is used for word-based task title search.
- Search is restricted to the selected project.
- Results must be limited to authorized projects.

**Success:** 200 OK.

**Response:** Paginated array of Task objects.

## TASK-03 — View Task

**Endpoint:** `GET /tasks/:id`

**Permission:** Authorized project access.

**Success:** 200 OK.

**Response:** Task object.

**Business Rules:**

- Verify the task exists.
- Retrieve its project.
- Verify workspace and project permissions.
- Do not expose tasks from unauthorized projects.

## TASK-04 — Update Task Details

**Endpoint:** `PATCH /tasks/:id`

**Permission:**

- Workspace Owner.
- Assigned Project Manager.

**Editable Fields:**

- `title`
- `description`
- `assigneeId`
- `priority`
- `dueDate`

**Example Request:**

```json
{
  "assigneeId": "507f1f77bcf86cd799439011",
  "priority": "URGENT",
  "dueDate": "2026-11-22"
}
```

**Success:** 200 OK.

**Response:** Updated Task object.

**Business Rules:**

- Project must not be archived.
- New assignee must be eligible.
- `createdBy`, `projectId`, and timestamps cannot be set directly by the client.
- `updatedBy` is set by the backend.
- Task status changes must use the separate status endpoint.

Developers cannot use this endpoint to edit task-management fields.

## TASK-05 — Update Task Status

**Endpoint:** `PATCH /tasks/:id/status`

**Permission:**

- Workspace Owner.
- Assigned Project Manager.
- Developer assigned to the task.

**Request:**

```json
{
  "status": "IN_REVIEW"
}
```

**Success:** 200 OK.

**Response:** Updated Task object.

**Business Rules:**

- Task must belong to an editable project.
- Developers may update their assigned tasks to BACKLOG, TODO, IN_PROGRESS, or IN_REVIEW.
- Developers cannot mark a task DONE.
- A task already marked DONE can only be reopened by an authorized Manager or Owner.
- Managers and Owners can approve tasks as DONE.
- Invalid status values are rejected.

**Errors:**

- 400: Invalid status.
- 403: Not permitted.
- 404: Task missing or inaccessible.
- 409: Project state prevents the update.

## TASK-06 — Delete Task

**Endpoint:** `DELETE /tasks/:id`

**Permission:**

- Workspace Owner.
- Assigned Project Manager.

**Success:** 204 No Content.

**Business Rules:**

- The frontend must request confirmation before deletion.
- Backend authorization is required.
- Tasks in archived projects cannot be deleted until the project is restored.
- Task deletion permanently removes the task document.
- Deletion must not remove its project or other unrelated records.

---

# 11. Kanban Board API Design

The Kanban board will not require a separate dedicated backend resource during Stage 1.

It will use the existing Task APIs.

## 11.1 Loading the Board

The frontend calls:

`GET /projects/:id/tasks`

It then groups the returned tasks by status.

The five columns are:

- BACKLOG.
- TODO.
- IN_PROGRESS.
- IN_REVIEW.
- DONE.

For projects with more tasks than one page, the frontend must load the remaining relevant pages or request tasks separately by status.

The board must not treat the first returned page as the complete project.

## 11.2 Changing Task Status

The frontend calls:

`PATCH /tasks/:id/status`

The backend verifies permissions and saves the change.

The frontend updates or refetches task data after the request succeeds.

If the request fails, the frontend must not incorrectly display the task as successfully updated.

## 11.3 Stage 1 Limitation

The board will not require:

- WebSocket updates.
- Drag-and-drop behavior.
- Live multi-user synchronization.

These belong to Stage 2.

---

# 12. Authentication and Authorization Rules

## 12.1 Session Authentication

DevFlow uses MongoDB-backed sessions.

The session cookie should have:

- HttpOnly enabled.
- Secure enabled over HTTPS.
- Suitable SameSite protection.
- Root path `/`.
- An appropriate expiration time.

**Session Lifetime:** Maximum seven days.

The backend must verify the session for every protected operation.

## 12.2 CSRF Protection

Because the browser automatically sends cookies, state-changing requests require CSRF protection.

The proposed design uses a signed double-submit CSRF token bound to browser state and, when authenticated, the current session.

The token is returned through the CSRF endpoint and submitted through the `X-CSRF-Token` header.

The backend must also validate the request origin.

Requests that create, update, delete, log in, or otherwise change authentication state must pass the relevant protection checks.

GET endpoints must not perform state-changing actions.

## 12.3 Permission Levels

There are three workspace roles:

- OWNER.
- MANAGER.
- DEVELOPER.

The OWNER has full management permission within their workspace.

A MANAGER may create projects and manage projects assigned to them.

A DEVELOPER can access their assigned projects and perform permitted task operations.

A Manager who is a member of a project but is not its assigned manager has member-level access to that project, not full management rights.

## 12.4 Authorization Process

For protected project or task requests:

1. Authenticate the user.
2. Find the requested resource.
3. Identify its workspace.
4. Check the user's workspace membership.
5. Check the user's role.
6. Check the user's project membership or manager assignment.
7. Check the permission required by the action.
8. Reject the operation if permission is missing.

Client-provided role information must never be trusted.

## 12.5 Cross-Workspace Access

A valid MongoDB ObjectId does not give a user permission to access that record.

Unauthorized cross-workspace resource requests should return a generic 404 response to avoid revealing whether private resources exist.

The backend must never rely only on frontend page restrictions.

---

# 13. API Validation Design

All request bodies, route parameters, and query parameters must be validated.

We will use Zod schemas for API input validation.

## 13.1 Examples

**Registration validation:**

- Required name, email, password.
- Valid email.
- Password length.
- Supported string lengths.

**Project validation:**

- Valid workspace ID.
- Required name.
- Valid manager ID.
- Correct date ordering.
- Allowed project status.

**Task validation:**

- Required title.
- Valid assignee ID.
- Allowed priority.
- Allowed status.
- Valid due date.

## 13.2 Validation Responsibilities

| Layer | Responsibility |
|---|---|
| Zod | Validate request shape and values |
| Authentication middleware | Identify user |
| Authorization logic | Confirm user permission |
| Service | Validate business rules and relationships |
| Mongoose | Validate document fields |
| MongoDB indexes | Enforce uniqueness constraints |

Business validation must not be placed entirely inside frontend components.

---

# 14. Error Handling Design

## 14.1 Standard Error Codes

| Error Code | Typical HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input is invalid |
| `INVALID_CREDENTIALS` | 401 | Login failed |
| `UNAUTHENTICATED` | 401 | Login required |
| `FORBIDDEN` | 403 | Permission denied |
| `CSRF_TOKEN_INVALID` | 403 | CSRF protection failed |
| `NOT_FOUND` | 404 | Resource missing or inaccessible |
| `EMAIL_ALREADY_EXISTS` | 409 | Duplicate email |
| `MEMBERSHIP_ALREADY_EXISTS` | 409 | Duplicate membership |
| `INVITATION_ALREADY_EXISTS` | 409 | Pending invitation exists |
| `INVALID_STATE` | 409 | Business-state conflict |
| `MANAGER_REPLACEMENT_REQUIRED` | 409 | Manager must be reassigned |
| `TOKEN_EXPIRED` | 410 | Temporary token expired |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## 14.2 Backend Error Processing

The backend must use centralized error-handling middleware.

Expected errors should be converted into consistent API responses.

Unexpected errors should be logged securely and return a generic message.

Detailed stack traces must not be exposed to users.

## 14.3 Security Rules

Never include the following in error responses:

- Passwords.
- Password hashes.
- Session tokens.
- Invitation tokens.
- Reset tokens.
- Database credentials.
- Private environment variables.
- Internal stack traces.

---

# 15. Important Multi-Step API Operations

Some API calls must update multiple database records.

These operations require careful business logic and transactions.

| API Operation | Database Operations |
|---|---|
| Create workspace | Create workspace and Owner membership |
| Accept invitation | Create membership and consume invitation |
| Create project | Create project and manager membership |
| Change project manager | Update manager and required project membership |
| Remove project member | Remove membership and unassign tasks |
| Remove workspace member | Remove memberships and unassign relevant tasks |
| Change Manager role | Validate or complete required project reassignment |
| Reset password | Update password, consume token, invalidate sessions |

## 15.1 Transaction Failures

If an operation cannot complete all required database updates, it must not leave invalid partial changes.

The backend should use MongoDB transactions for these operations.

Transient transaction errors should be handled through the driver's appropriate transaction retry behavior.

## 15.2 Duplicate Requests

Database uniqueness constraints must protect against requests that arrive at nearly the same time.

For example, two invitation-acceptance requests must not create two workspace memberships.

Stage 1 will enforce database consistency through transactions, unique indexes, and conditional updates.

Advanced collaborative editing conflict resolution is reserved for Stage 2.

---

# 16. Search, Filtering, and Pagination

## 16.1 Pagination Rules

For paginated endpoints:

- `page` starts at 1.
- Default `page` is 1.
- Default `limit` is 20.
- Maximum `limit` is 100.
- Invalid pagination values return 400.

Paginated responses include:

- `page`
- `limit`
- `total`
- `totalPages`

## 16.2 Project Filtering

Supported project filter:

`status`

## 16.3 Task Filtering

Supported task filters:

- `status`
- `priority`
- `assigneeId`

Supported search:

- Exact task ID.
- Word-based task title.

Multiple filters can be combined.

## 16.4 Performance

The backend must use appropriate MongoDB queries and indexes.

Tasks and projects should not be loaded without limits when pagination is required.

All searches must include authorization restrictions.

The API must not return data from unrelated workspaces.

---

# 17. API Testing Strategy

We will use automated testing to verify the API contract.

## 17.1 Unit Tests

Test individual business rules.

Examples:

- Task status permissions.
- Project date validation.
- Dashboard percentage calculation.
- Role permission decisions.

## 17.2 Integration Tests

Test Express endpoints with a test database.

Examples:

- Registration creates a user.
- Login creates a session.
- Invalid credentials are rejected.
- Workspace creation creates Owner membership.
- Duplicate memberships are rejected.
- Invalid task assignments fail.
- Archived projects reject task updates.

## 17.3 End-to-End Tests

Test complete browser workflows.

Examples:

- Register and log in.
- Create workspace.
- Create project.
- Add member.
- Create and assign task.
- Change task status.
- View project dashboard.

## 17.4 Security Tests

The API must be tested for:

- Requests without authentication.
- Expired sessions.
- Invalid CSRF tokens.
- Unauthorized workspace access.
- Unauthorized project access.
- Unauthorized task updates.
- Invalid ObjectIds.
- Duplicate records.
- Invalid input fields.
- Permission changes after membership removal.

## 17.5 API Acceptance Test Matrix

| ID | Test | Expected Result |
|---|---|---|
| API-01 | Register valid user | 201 |
| API-02 | Register duplicate email | 409 |
| API-03 | Login successfully | 200 and session cookie |
| API-04 | Login incorrectly | 401 |
| API-05 | Logout | 204 |
| API-06 | Access protected endpoint without session | 401 |
| API-07 | Submit invalid CSRF token | 403 |
| API-08 | Update profile | 200 |
| API-09 | Request password reset | 202 |
| API-10 | Reuse reset token | Rejected |
| API-11 | Create workspace | 201 |
| API-12 | View own workspaces | 200 |
| API-13 | Access unrelated workspace | Rejected |
| API-14 | Create invitation | 201 |
| API-15 | Accept valid invitation | 200 |
| API-16 | Accept expired invitation | Rejected |
| API-17 | Add duplicate workspace membership | Rejected |
| API-18 | Remove current workspace Owner | Rejected |
| API-19 | Create project | 201 |
| API-20 | Add eligible project member | 201 |
| API-21 | Add ineligible project member | Rejected |
| API-22 | Change manager without valid replacement | Rejected |
| API-23 | Create task | 201 |
| API-24 | Assign task to non-member | Rejected |
| API-25 | Update task priority | 200 |
| API-26 | Developer marks task Done | 403 |
| API-27 | Authorized manager approves task | 200 |
| API-28 | Search and filter tasks | 200 |
| API-29 | Update archived project's task | Rejected |
| API-30 | Delete task without permission | Rejected |
| API-31 | View dashboard | Accurate statistics |
| API-32 | Remove project member | Assigned tasks unassigned |
| API-33 | Cross-workspace task access | Rejected |
| API-34 | Transaction fails midway | Changes rolled back |
| API-35 | Invalid field or unsupported property | 400 |

The test suite must also verify that no sensitive information is returned unintentionally.

---

# 18. API Documentation Standards

The project must maintain API documentation.

The documentation should include:

- HTTP method.
- Endpoint.
- Purpose.
- Authentication requirements.
- Permission requirements.
- Request parameters.
- Request body.
- Response body.
- Success status.
- Possible error responses.
- Example requests and responses.

The documentation can be maintained using an OpenAPI specification.

OpenAPI is a documentation format, not an additional backend service.

The documentation should be updated whenever an API contract changes.

---

# 19. Backend Implementation Order

The APIs will be developed in small modules.

## Phase 1 — API Foundation

- Express setup.
- `/api/v1` routing.
- JSON request handling.
- Validation middleware.
- Error handling.
- MongoDB connection.
- Authentication and CSRF middleware foundation.

## Phase 2 — Authentication APIs

Implement AUTH-01 to AUTH-07 and USER-01 to USER-02.

Test authentication, sessions, and password recovery.

## Phase 3 — Workspace APIs

Implement WS-01 to WS-09 and INV-01 to INV-02.

Test membership, invitations, and workspace permissions.

## Phase 4 — Project APIs

Implement PRJ-01 to PRJ-07.

Test project creation, membership, managers, and lifecycle rules.

## Phase 5 — Task APIs

Implement TASK-01 to TASK-06.

Test CRUD, assignments, statuses, search, filtering, and permissions.

## Phase 6 — Project Dashboard

Implement PRJ-08.

Test calculations and query performance.

## Phase 7 — Complete API Review

- Confirm request and response contracts.
- Review access permissions.
- Verify input validation.
- Verify error handling.
- Run integration tests.
- Verify transactional operations.
- Compare all endpoints against the approved SRS.

---

# 20. Future API Compatibility

Stage 1 will not include the APIs for future features.

**Stage 2 may add:**

- Sprint APIs.
- Comment APIs.
- Notification APIs.
- Task dependency APIs.
- Real-time communication.

**Stage 3 may add:**

- GitHub connection APIs.
- Webhook endpoints.
- Advanced analytics APIs.

These features remain outside this API specification.

The `/api/v1` structure and modular backend architecture are intended to support gradual expansion.

---

# 21. API Design Completion Criteria

The API design is ready for implementation when:

1. All Stage 1 endpoints are defined.
2. HTTP methods and URLs are consistent.
3. Request and response structures are agreed.
4. User permission rules are clear.
5. Validation rules are defined.
6. Error handling is consistent.
7. Authentication is specified.
8. CSRF protection is designed.
9. Database operations are identified.
10. Transactions are assigned where needed.
11. Search and pagination rules are defined.
12. Testing requirements are documented.
13. Stage 2 and Stage 3 functionality remains outside the MVP.

---

# 22. Final API Summary

DevFlow Stage 1 defines **34 API endpoints** across the following groups:

| API Group | Endpoint Count |
|---|---:|
| Authentication | 7 |
| User Profiles | 2 |
| Workspaces | 9 |
| Invitation Acceptance | 2 |
| Projects and Dashboard | 8 |
| Tasks | 6 |
| **Total** | **34** |

These endpoints support all main Stage 1 requirements, including account management, workspace management, project management, task management, Kanban boards, and project dashboards.

The APIs follow REST principles, use TypeScript and Zod validation, enforce backend permissions, and return consistent JSON responses.

**Document Status:** Draft — Awaiting Approval.

**End of Document**
