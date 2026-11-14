# DevFlow — Stage 1 System Design

**SRS Approved**  
**System Design v1.0 — Draft**

We are now moving from **what the system should do (SRS)** to **how the system should work (System Design)**.

This design covers only the approved Stage 1 MVP. We will prepare the architecture so that Stage 2 and Stage 3 features can be added later without rebuilding the application.

## 1. System architecture

I recommend starting DevFlow as a **modular monolith**.

This means we will have one React frontend, one Express backend, and one MongoDB database. The backend will be divided into clearly organized modules.

We will not introduce microservices, Redis, WebSockets, or background job systems during Stage 1.

```text
React + TypeScript Frontend
Pages, forms, Kanban board, dashboards
         ↕ HTTP / REST API / JSON
Node.js + Express + TypeScript
Authentication | Workspaces | Projects | Tasks | Dashboards | Permissions
Controllers → Services → Repositories
         ↕
MongoDB + Mongoose
Users, memberships, projects, tasks and sessions
```

### Why this architecture?

- It is easier to understand, build, and test than microservices.
- React and Express have separate responsibilities.
- The backend business logic can be tested independently.
- We can apply OOP, SOLID principles, and design patterns where they are useful.
- Features can be developed one at a time without introducing unnecessary infrastructure.

We will keep DevFlow in one GitHub repository containing separate `frontend` and `backend` directories.

## 2. Backend design

The backend will use a **layered architecture**.

A request will pass through several layers, each with a specific responsibility.

1. **Route** — Matches the API URL and HTTP method
2. **Middleware** — Checks authentication, permissions and input
3. **Controller** — Receives the request and prepares the response
4. **Service** — Applies business rules and performs operations
5. **Repository** — Reads and writes database information
6. **Mongoose / MongoDB** — Stores and retrieves the data

### Example: Creating a task

Imagine a project manager creates a task.

1. React sends a `POST` request to the task API.
2. Middleware checks whether the user is logged in, is allowed to create the task, and has submitted valid information.
3. `TaskController` receives the validated request.
4. `TaskService` checks business rules, including whether the project is editable and the selected assignee is eligible.
5. `TaskRepository` saves the task using Mongoose.
6. The backend returns the created task to React.

This structure will help you understand separation of concerns, dependency injection, and the repository pattern.

We can use Express 5, which supports passing rejected asynchronous route-handler promises to its error handling system.

## 3. Backend modules and folder structure

The backend will contain these main modules:

| Module | Responsibility |
|---|---|
| Auth | Registration, login, logout, password recovery, sessions |
| Users | Profile and account management |
| Workspaces | Workspace creation, settings, membership and invitations |
| Projects | Project CRUD, membership, manager assignment and lifecycle |
| Tasks | Task CRUD, assignment, statuses, search and filtering |
| Dashboard | Basic project statistics |
| Shared | Middleware, errors, database connection and utilities |

### Proposed folder structure

```text
devflow/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── components/
│   │   ├── lib/
│   │   └── main.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── workspaces/
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   └── dashboard/
│   │   ├── shared/
│   │   ├── app.ts
│   │   └── server.ts
│   └── package.json
│
├── docs/
│   ├── scope.md
│   ├── srs.md
│   ├── system-design.md
│   └── database-design.md
│
└── README.md
```

For example, the task module may eventually contain:

`task.routes.ts`, `task.controller.ts`, `task.service.ts`, `task.repository.ts`, `task.model.ts`, and `task.schema.ts`.

We don't need to create every file immediately. We'll introduce them as the feature is developed.

---

## 4. Database design

We will use one MongoDB database for the MVP, with separate collections for different types of information.

### Database relationships

```text
Users
 ├── Memberships ↔ Workspaces
 ├── Invitations ↔ Workspaces
 └── Project Members ↔ Projects

Workspaces
 └── Projects
      ├── Project Members ↔ Users
      └── Tasks
```

Conceptual relationship overview. Membership records connect users to workspaces and projects. Exact database references are defined below.

### Database collections

| Collection | Important fields |
|---|---|
| `users` | `_id`, name, email, passwordHash, createdAt |
| `sessions` | `_id`, userId, tokenHash, expiresAt |
| `password_reset_tokens` | userId, tokenHash, expiresAt, usedAt |
| `workspaces` | `_id`, name, description, ownerId |
| `workspace_members` | workspaceId, userId, role, joinedAt |
| `workspace_invitations` | workspaceId, email, role, tokenHash, expiresAt, status |
| `projects` | `_id`, workspaceId, name, description, managerId, startDate, targetDate, status |
| `project_members` | projectId, userId, joinedAt |
| `tasks` | `_id`, projectId, title, description, assigneeId, priority, status, dueDate, createdBy, updatedAt |

All main records will also have suitable creation and update timestamps.

### Main database rules

- A user can belong to multiple workspaces.
- A workspace has one designated owner.
- A project belongs to one workspace.
- A project member must belong to that project's workspace.
- A task belongs to one project.
- A task can have one assignee or remain unassigned.
- Removing a member must not remove the project's tasks.

We will use MongoDB `ObjectId` values as the unique database identifiers in Stage 1.

### Database indexing

We should create indexes based on the queries we need.

| Collection | Index | Purpose |
|---|---|---|
| Users | `email` unique | Prevent duplicate accounts |
| Workspace Members | `workspaceId + userId` unique | Prevent duplicate membership |
| Project Members | `projectId + userId` unique | Prevent duplicate membership |
| Projects | `workspaceId + status` | Efficient project lists |
| Tasks | `projectId + status` | Kanban board queries |
| Tasks | `projectId + assigneeId` | Assigned task filtering |
| Invitations | `tokenHash` unique | Identify invitation tokens securely |

For title searching, we can design a suitable text-search index when we implement task search.

MongoDB supports unique compound indexes, which are useful for enforcing rules such as one membership per user per workspace.

Some operations will affect several collections. For example, creating a workspace also creates its owner's membership record. We should use a transaction for operations that must succeed together. MongoDB multi-document transactions require a supported replica-set or sharded deployment, not a standalone server.

The detailed field types, required fields, indexes, and validation rules will be finalized in the database design document.

---

## 5. Authentication and security design

The SRS requires secure cookie-based authentication.

For Stage 1, I recommend **server-side sessions stored in MongoDB**.

### Login process

1. **Submit credentials**

   The user enters their email and password in React.

2. **Verify credentials**

   Express checks the user account and verifies the submitted password against its stored hash.

3. **Create a session**

   The backend creates a cryptographically random session token, stores only its hash with the session record, and sends the token in an HTTP-only cookie.

4. **Authenticate later requests**

   The browser sends the cookie automatically. The backend validates the session before allowing protected actions.

5. **End the session**

   Logout invalidates the session record and clears the cookie.

### Security controls

We will implement password hashing, login rate limiting, secure cookies, backend permission checks, input validation, and protection against Cross-Site Request Forgery (CSRF).

For state-changing requests, use a suitable CSRF-token mechanism and validate request origins. SameSite cookies help but should not be treated as the only CSRF defense.

For the MVP, the React application and API should be presented under the same site where practical, with API requests routed under `/api/v1`.

Password recovery will use short-lived, single-use reset links delivered through a basic email service. This is separate from the broader notification system planned for Stage 2.

## 6. Authorization design

Authentication answers: **Who is the user?**

Authorization answers: **What is the user allowed to do?**

DevFlow will use role-based access control (RBAC).

| Action | Owner | Manager | Developer |
|---|---|---|---|
| Manage workspace members | Yes | No | No |
| Create projects | Yes | Yes | No |
| Manage project members | Yes | Managed projects | No |
| Create tasks | Yes | Yes | Accessible projects |
| Assign tasks | Yes | Managed projects | No |
| Edit full task details | Yes | Managed projects | No |
| Update assigned task status | Yes | Yes | Yes |
| Approve task as Done | Yes | Managed projects | No |
| View project dashboard | Yes | Accessible projects | Accessible projects |

A manager must be assigned to a project to manage it. A developer must belong to a project to access its tasks.

These restrictions will be checked in the backend for every protected request, even if the user tries to call the API directly.

---

## 7. REST API design

All main Stage 1 operations will use REST APIs.

Our API prefix will be:

`/api/v1`

### Authentication and users

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Log in |
| POST | `/auth/logout` | Log out |
| GET | `/auth/me` | Get current user |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Complete password reset |
| PATCH | `/users/me` | Update profile |
| PATCH | `/users/me/password` | Change password |

### Workspace APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/workspaces` | Create workspace |
| GET | `/workspaces` | Get user's workspaces |
| GET | `/workspaces/:id` | View workspace |
| PATCH | `/workspaces/:id` | Edit workspace |
| GET | `/workspaces/:id/members` | View members |
| PATCH | `/workspaces/:id/members/:userId` | Change member role |
| DELETE | `/workspaces/:id/members/:userId` | Remove member |
| POST | `/workspaces/:id/invitations` | Create invitation |
| POST | `/invitations/:token/accept` | Accept invitation |

### Project APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/workspaces/:id/projects` | Create project |
| GET | `/workspaces/:id/projects` | List projects |
| GET | `/projects/:id` | View project |
| PATCH | `/projects/:id` | Edit project |
| GET | `/projects/:id/members` | View project members |
| POST | `/projects/:id/members` | Add project member |
| DELETE | `/projects/:id/members/:userId` | Remove member |
| GET | `/projects/:id/dashboard` | Get statistics |

Project status changes will use the project update API.

### Task APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/projects/:id/tasks` | Create task |
| GET | `/projects/:id/tasks` | List/search/filter tasks |
| GET | `/tasks/:id` | View task |
| PATCH | `/tasks/:id` | Edit task information |
| PATCH | `/tasks/:id/status` | Update task status |
| DELETE | `/tasks/:id` | Delete task |

The task list API will accept optional filters such as `status`, `priority`, `assigneeId`, `search`, `page`, and `limit`.

All API endpoints will return consistent JSON responses and appropriate HTTP status codes.

This is the initial API contract. Exact request and response fields will be specified during API design.

---

## 8. Frontend design

The frontend will use React, TypeScript, React Router, and Tailwind CSS.

For server data such as projects and tasks, I suggest TanStack Query to manage fetching, caching, loading states, and refetching. This is a design choice rather than an additional business feature.

### Main pages

| Page | Main components |
|---|---|
| Registration | Registration form |
| Login | Login form |
| Workspace Selection | Workspace list and create dialog |
| Workspace Settings | Workspace details, members, invitations |
| Project List | Project cards and create form |
| Project Settings | Project details and members |
| Project Dashboard | Task counts and progress |
| Kanban Board | Five status columns with task cards |
| Task Details | Task fields and edit actions |
| User Profile | Profile and password forms |

### Frontend architecture

We will organize frontend code by features.

For example, the `tasks` feature may contain task components, API functions, TypeScript types, hooks, and form validation.

Shared components such as buttons, input fields, dialogs, navigation, and error messages will be kept separately.

This will help us learn component reuse and separation of concerns.

## 9. Important business processes

The backend must preserve several important rules when data changes.

**Creating a workspace**

Create the workspace and its Owner membership together. If either operation fails, the system should not leave an incomplete workspace.

**Removing a workspace member**

Revoke workspace access, remove dependent project memberships, and make previously assigned tasks available for reassignment. Existing tasks must remain.

**Removing a project manager**

Require a valid replacement manager before removing a manager whose project would otherwise have an invalid assignment.

**Archiving a project**

Keep the project's information available to authorized users, but reject task changes while the project is archived.

**Completing a task**

Developers submit their work for review. An authorized manager or owner approves the move to Done.

For the first version, we will keep task updates simple. Advanced conflict resolution for simultaneous editing belongs to Stage 2.

---

## 10. Error handling and testing design

The application must return clear, consistent errors.

Typical HTTP responses include:

| Status | Meaning |
|---|---|
| 200 | Request successful |
| 201 | Resource created |
| 204 | Request successful, no response body |
| 400 | Invalid request |
| 401 | Not authenticated |
| 403 | Not permitted |
| 404 | Resource not found |
| 409 | Conflict, such as duplicate membership |
| 500 | Unexpected server error |

Errors must not expose passwords, session tokens, database credentials, or internal implementation details.

### Testing levels

**Unit tests**

Test business rules such as task status permissions and dashboard calculations, without requiring the entire application.

**Integration tests**

Test APIs with authentication, middleware, services, and a test database.

**End-to-end tests**

Test complete browser workflows such as registration, creating a project, and completing a task.

We will use Vitest, Supertest, and Playwright for the relevant testing levels.

---

## 11. Development order

Now that we have a proposed architecture, we can develop Stage 1 in the following order.

1. **Project setup** — Set up React, Express, TypeScript, Git and the local development environment.
2. **Backend foundation** — Build the Express application structure, database connection, validation and error handling.
3. **Authentication** — Implement registration, login, sessions, logout, profile and password management.
4. **Workspaces** — Implement workspace creation, membership, roles and invitations.
5. **Projects** — Implement project management, project members and project status.
6. **Tasks** — Implement task CRUD, assignment, priorities, statuses and filtering.
7. **Kanban and dashboard** — Build the project board and basic progress statistics.
8. **Testing and MVP review** — Complete core automated tests, review permissions, fix issues and verify the SRS acceptance tests.

Each milestone should include a small amount of design, implementation, testing, and code review—not just writing features.

## 12. Design decisions to confirm

I have kept these decisions simple to reduce unnecessary complexity.

| Decision | Proposed choice |
|---|---|
| Overall architecture | Modular monolith |
| Repository structure | One repository, separate frontend/backend |
| Backend pattern | Layered, feature-based modules |
| Database | One MongoDB database |
| Authentication | MongoDB-backed secure sessions |
| Frontend navigation | React Router |
| API design | REST, versioned under `/api/v1` |
| User IDs and task IDs | MongoDB ObjectIds |
| Workspace invitations | Secure invitation links |
| Workspace ownership | One Owner, no ownership transfer in MVP |
| Project deletion | Archive instead; project deletion not exposed in Stage 1 |
| Kanban updates | Dropdown or buttons |
| Real-time communication | Not in Stage 1 |
| Advanced concurrency handling | Stage 2 |

These are technical design proposals that support the approved SRS; they do not add new product modules.

---

## 13. What we do after approving this system design

I recommend preparing three more focused design documents before implementation:

1. **Detailed Database Design** — MongoDB schemas, field types, required fields, references, indexes, and relationships.
2. **Detailed API Design** — Request/response structures, validation, permissions, and error cases for each endpoint.
3. **Development Milestone Plan** — Small coding tasks, learning objectives, and completion checks.

This separates the planning work from actual implementation and makes it easier for you to code with minimal AI assistance.

**Please review this Stage 1 system design.** If you approve the proposed architecture and decisions, we can use them as the baseline and move into the detailed database design, where you'll learn how to make the actual MongoDB modeling decisions.
