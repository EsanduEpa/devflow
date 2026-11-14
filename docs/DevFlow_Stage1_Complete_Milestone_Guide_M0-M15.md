# DevFlow — Stage 1 Complete Development Guide (M0–M15)

**Version:** 1.0 (compiled from approved planning)  
**Status:** Approved milestone plan — execution guide  
**Project:** DevFlow, a MERN software-team project management platform  
**Audience:** One developer learning by writing the code independently  
**Goal:** A secure, tested, locally runnable Stage 1 MVP, ready for Stage 2 later

> **How to use this file:** Work from M0 through M15 in order. For each milestone, study the listed concepts, complete the numbered steps, run the tests, answer the interview questions in your own words, and commit your work. Do not mark a milestone done just because its UI looks right. Use AI for explanations, hints, and reviews—not to write the entire project for you.
>
> **Scope rule:** This guide explains how to execute the five approved technical/planning documents plus the approved milestone plan. If a small implementation detail below needs adjustment, preserve the approved SRS, database rules, API contracts, and Stage 1 scope. A proposed change should be documented before code is changed.

---

## A. What you are building

DevFlow lets a software team register users, organize workspaces, invite members, create projects, assign tasks, track work on a five-column Kanban board, search tasks, and see simple project statistics.

### Stage 1 features — IN SCOPE

- Registration, login, logout, profile updates, password change and basic password recovery.
- Multiple workspaces per user; workspace Owner, Manager and Developer roles.
- Workspace settings, member list, secure invitations, member role updates and removal.
- Projects within workspaces; project manager assignment, membership and lifecycle (Planned, Active, Completed, Archived).
- Tasks with title, description, single assignee or unassigned, priority, status, due date and audit fields.
- Task creation, viewing, editing, assignment, authorized deletion, searching, filtering, and pagination.
- Kanban board: **Backlog, To Do, In Progress, In Review, Done**, with button/dropdown status updates.
- Project dashboard: total, completed, in-progress, overdue tasks and completion percentage.
- Secure REST API, validation, authorization, automated tests, local setup instructions, and architecture/API documentation.

### Stage 2 and 3 — NOT PART OF THIS GUIDE'S IMPLEMENTATION

**Stage 2:** Sprints, comments, activity timeline, Socket.IO real-time collaboration, notifications, task dependency graphs, drag-and-drop, advanced concurrent-editing conflict handling, more advanced dashboards.  
**Stage 3:** GitHub repository/PR integration, webhooks, Redis/BullMQ, advanced analytics, Docker, CI/CD, production monitoring and full production deployment work.

Do not add these to Stage 1 simply because a tutorial mentions them.

### Approved technologies

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Node.js, Express, TypeScript; feature-based layered modular monolith |
| Database | MongoDB, Mongoose, **one database** named `devflow_db` |
| Validation | Zod for API input; Mongoose schema validation; service business rules |
| Authentication | MongoDB-backed server-side sessions, secure HTTP-only cookies, CSRF protection |
| Password hashing | Argon2id (suitable library) |
| Tests | Vitest, Supertest, Playwright |
| Version control | Git, GitHub |
| API | REST, JSON, `/api/v1` |

### Approved architecture

```text
Browser (React + TypeScript)
           |
           | HTTP / REST / JSON; authenticated cookie
           v
Express routes -> middleware -> controllers -> services -> repositories
                                                       |
                                                       v
                                              Mongoose -> MongoDB
```

The backend contains separate feature modules for auth, users, workspaces, projects, tasks and dashboard. It is **one backend application**, not microservices.

---

## B. Rules to follow throughout development

1. **Understand the feature before coding:** Read the relevant SRS rule and API contract. Describe its happy path and failure paths.
2. **Study only what you need now:** Follow the references in the milestone; do not spend weeks pre-learning Stage 3 tools.
3. **Write the code yourself:** Start from documentation and small experiments. Use AI to explain a concept or review what you wrote.
4. **Build a complete slice:** For a feature, implement its model, backend behavior, permission checks, UI, and tests instead of creating many empty files at once.
5. **Backend enforces security:** Hiding a button in React is not authorization. Every protected API checks access.
6. **Test as you go:** M14 is the final quality pass, not the first day you write tests.
7. **Keep secrets out of Git:** Commit `.env.example`, never `.env` with real values.
8. **Make small commits:** Each commit should represent one coherent change you can describe.
9. **Keep engineering notes:** For important choices, record the problem, options, decision, tradeoffs, and evidence.
10. **Do not change approved scope silently:** Write proposed changes down and consciously decide whether they belong in Stage 1.

### Suggested development rhythm for busy days

- **10 min:** Review the current milestone, acceptance criteria and last commit.
- **20–50 min:** Work on one small checkbox.
- **10 min:** Run an appropriate test, make a short note, commit if the change is complete.
- If blocked, reduce the problem to a minimal experiment. Consult docs first, then ask AI **for a hint**, not a full implementation.

### Universal completion gate for *every* milestone

- [ ] I understand the concepts I used and can explain them without reading the code.
- [ ] The required behavior works, including at least one failure case.
- [ ] Backend permissions and input validation exist where needed.
- [ ] Appropriate automated tests pass.
- [ ] I can run the feature from documented instructions.
- [ ] I wrote down at least one important design decision or lesson.
- [ ] My code is committed and pushed to GitHub.

### Practical Git workflow

```text
main               stable, working code
feature/m3-login   optional short-lived feature branch
fix/m10-assignee   optional fix branch
```

Before a milestone: pull latest changes, create a feature branch if useful, and break the work into small commits. At the end: run tests, review the diff, merge cleanly, and keep `main` working. Commit messages can follow `feat(auth): add login`, `test(tasks): cover assignment rules`, or `docs: explain workspace transaction`.

---

## C. Stage 1 milestone map

| Milestone | Focus | Main outcome |
|---|---|---|
| **M0** | Project preparation | GitHub repo, docs, README, `.gitignore` |
| **M1** | React and Express setup | Frontend can call backend health endpoint |
| **M2** | Backend and MongoDB foundation | Layered structure, database, validation, errors, tests |
| **M3** | Registration and authentication | Secure sessions, CSRF, protected pages |
| **M4** | Profile and password management | Profile update, password change/reset |
| **M5** | Workspace foundation | Workspaces, Owner membership, switching |
| **M6** | Invitations | Secure invitation and acceptance workflow |
| **M7** | Project creation | Project records, manager membership, accessible list |
| **M8** | Project management | Project members, statuses, manager reassignment |
| **M9** | Workspace administration | Role changes, removal rules, consistency |
| **M10** | Task management | Task CRUD, assignment, permissions |
| **M11** | Status and Kanban | Five columns and permitted status changes |
| **M12** | Task discovery | Search, filtering, pagination and indexes |
| **M13** | Dashboard | Accurate project task statistics |
| **M14** | Security and complete testing | End-to-end verification and fixes |
| **M15** | Documentation and release | Stage 1 MVP ready for demonstration |

**Dependency note:** M9 member-removal logic depends on tasks existing; complete its membership checks in M9 and complete the task-unassignment part during M10. Verify the combined behavior in M14.

---

# PHASE 1 — FOUNDATION

## M0 — Project preparation and GitHub repository

**Outcome:** A well-organized GitHub repo containing all approved planning documents and the starting directories. **Do not write application features yet.**

### Prerequisites

- Approved scope, SRS, system design, database design, API design and milestone plan.
- Git installed; GitHub account; basic terminal navigation.

### Study and understand

- SDLC and why requirements come before code.
- Functional requirements versus non-functional requirements.
- What Git commits, branches, remotes, `.gitignore`, and `README.md` do.
- Difference between Git (version-control tool) and GitHub (hosting/collaboration platform).

### Steps to complete

1. [ ] Choose the local development folder and create a directory named `devflow`.
2. [ ] Initialize Git (`git init`) if you are starting locally, or clone an empty repo you created on GitHub.
3. [ ] Configure Git author name/email as appropriate and confirm `git status` works.
4. [ ] Create a **private or public** GitHub repository named `devflow` (public is helpful for a portfolio, but never publish secrets).
5. [ ] Create top-level directories: `frontend/`, `backend/`, `docs/`.
6. [ ] Within `docs/`, store the six approved documents with clear names: `scope.md`, `srs.md`, `system-design.md`, `database-design.md`, `api-design.md`, `development-milestones.md`. This current file may be used as `development-milestones.md`.
7. [ ] Add a `README.md` with: project purpose, Stage 1 scope, tech stack, intended folder layout, current progress, and instructions that setup steps will be added as development proceeds.
8. [ ] Add `.gitignore` rules for `node_modules/`, `.env`, `.env.*` **except** `.env.example`, build outputs, coverage files, IDE/OS temporary files, and logs.
9. [ ] Optionally place a `.gitkeep` in empty directories so Git tracks them.
10. [ ] Review that no tokens, passwords, personal credentials, or private files are staged.
11. [ ] Make an initial commit and push it to GitHub.
12. [ ] Open the GitHub repository and verify the files and directory structure.
13. [ ] Clone into a separate temporary folder and confirm the expected contents appear.
14. [ ] Create `docs/engineering-notes/` and write the first note: *Why one repository and why separate frontend/backend directories?*

### Suggested tree

```text
devflow/
├── frontend/
├── backend/
├── docs/
│   ├── scope.md
│   ├── srs.md
│   ├── system-design.md
│   ├── database-design.md
│   ├── api-design.md
│   ├── development-milestones.md
│   └── engineering-notes/
├── .gitignore
└── README.md
```

### Verify and test

- [ ] Git shows a clean working tree after commit.
- [ ] GitHub has the latest commit and all six documents.
- [ ] `.env` and `node_modules` are ignored if created temporarily.
- [ ] A new clone reproduces the foundation.

### Interview questions

1. What is the software development life cycle?
2. Why write requirements before code?
3. Git vs. GitHub?
4. What is a commit and what is a branch?
5. Why divide a repository into frontend and backend?

**Done when:** You can share a GitHub link to the organized, secret-free repo and explain its contents.  
**Suggested commit:** `chore: initialize DevFlow repository`

---

## M1 — React + Express working setup

**Outcome:** Both apps start locally; React calls a simple Express endpoint and shows its response.

### Prerequisites

- M0 complete; Node.js LTS/npm installed.
- Comfortable with basic JavaScript functions, imports, `async/await` and terminal commands.

### Study and understand

- Node.js runtime vs. browser JavaScript; `npm` scripts and `package.json`.
- ES modules, TypeScript compilation and type checking.
- Vite dev server, React components, JSX/TSX, props and state.
- Express app, route handler, HTTP GET, JSON, status 200.
- Same-origin requests, development proxy and CORS (know the difference; avoid wide-open production CORS).

### Steps to complete

1. [ ] Confirm `node --version`, `npm --version` and `git --version`.
2. [ ] Initialize `frontend/` as a Vite **React + TypeScript** app.
3. [ ] Start the frontend; identify entry point and root component.
4. [ ] Install/configure Tailwind CSS for the current Vite version; verify one styled element.
5. [ ] Initialize `backend/` as a Node package.
6. [ ] Install Express, TypeScript, type definitions, and a development runner appropriate for TS (e.g. `tsx`).
7. [ ] Add scripts to run backend development and typecheck/build.
8. [ ] Create a minimal Express app and a separate file that starts the server.
9. [ ] Add `GET /api/health` returning a small JSON payload such as `{ "status": "ok" }`.
10. [ ] Confirm the endpoint with a browser, curl or Bruno/Postman.
11. [ ] In React, use `fetch` to request `/api/health`; display loading, success and failure states.
12. [ ] Configure a local Vite proxy for `/api` **or** another controlled dev setup; understand the request path.
13. [ ] Put port/settings in environment files and document variables in `.env.example` files.
14. [ ] Confirm frontend/backend can be started in separate terminals.
15. [ ] Run typechecks, remove default demo code you do not need, and commit.

### Verify and test

- [ ] React renders correctly.
- [ ] Express health returns 200 and JSON.
- [ ] UI shows real backend data, not hard-coded text.
- [ ] Stopping the backend gives an understandable UI error.
- [ ] TypeScript catches an intentional wrong type in a local experiment.

### Interview questions

1. What is Node.js and how is it different from the browser?
2. What does Express do?
3. How does an HTTP request travel from React to Express?
4. What is CORS, and when does it matter?
5. Why use TypeScript? What does it *not* guarantee at runtime?

**Done when:** Frontend and backend independently run and communicate; no database/business features yet.  
**Suggested commit:** `chore: set up React and Express apps`

---

## M2 — Backend structure, MongoDB connection, validation and errors

**Outcome:** A reusable backend foundation ready for feature modules.

### Prerequisites

- M1 complete; MongoDB available in a deployment that supports transactions.

### Study and understand

- MongoDB documents/collections/ObjectIds; MongoDB Compass.
- Mongoose models, schemas, indexes, connection lifecycle.
- Express middleware, controller, service, repository responsibilities.
- Zod input validation; difference between TypeScript types and runtime validation.
- Centralized error handling and consistent HTTP responses.
- Database transactions and why a replica set is required.

### Steps to complete

1. [ ] Choose local MongoDB replica set or a suitable Atlas environment; create `devflow_db`.
2. [ ] Store connection URI and secrets only in backend `.env`; add example variable names to `.env.example`.
3. [ ] Add Mongoose and connect on application startup; fail clearly if connection cannot be established.
4. [ ] Separate `app.ts` (configures Express) from `server.ts` (starts the app) for easier testing.
5. [ ] Add organized `config/`, `middleware/`, `modules/`, and `shared/` directories.
6. [ ] Establish a module convention: routes → controller → service → repository → model.
7. [ ] Create a small example module or test-only use case to practice the layers; avoid building unnecessary abstract classes.
8. [ ] Define standardized success envelopes: `{ "data": ... }` and pagination when needed.
9. [ ] Define errors as `{ "error": { "code", "message", "details"? } }`.
10. [ ] Implement centralized error middleware, a not-found handler, JSON body size limits and safe logging.
11. [ ] Implement Zod validation middleware for body/query/path; reject unsupported fields.
12. [ ] Add ObjectId parameter validation before Mongoose queries.
13. [ ] Handle common failures: malformed JSON, validation errors, unavailable database and unexpected errors.
14. [ ] Set up Vitest and Supertest for backend integration tests.
15. [ ] Verify a **simple multi-document transaction** works in your MongoDB environment.
16. [ ] Document why different rules live in Zod, services, Mongoose and MongoDB indexes.

### Verify and test

- [ ] App starts with valid DB URI and fails safely with invalid URI.
- [ ] Malformed JSON returns an appropriate error, not an HTML stack trace.
- [ ] Zod rejects bad input; invalid ObjectIds do not crash the app.
- [ ] Integration tests run against a test configuration/database.
- [ ] A forced transaction error rolls back changes.

### Interview questions

1. What is layered architecture?
2. Controller vs. service vs. repository?
3. What is dependency inversion and when should it be used?
4. Why do TypeScript types not replace Zod validation?
5. What is a transaction? What does atomicity mean?
6. What does Mongoose provide above MongoDB?

**Done when:** Common backend behavior and transaction-capable MongoDB work under tests.  
**Suggested commit:** `feat(core): add backend foundation`

---

## M3 — Registration, login, sessions, logout and CSRF

**Outcome:** Secure authentication from React to MongoDB-backed sessions.

### Prerequisites

- M2; understand HTTP cookies, hashing, async code and middleware.

### Study and understand

- Authentication vs. authorization; server-side sessions vs. JWTs.
- Argon2id password hashing, password verification and salts.
- Cryptographic random tokens and token hashing.
- HTTP-only, Secure, SameSite cookies and the browser credential model.
- CSRF attacks, CSRF tokens and request-origin checking.
- Rate limiting, user-enumeration risks, and safe auth errors.

### APIs

- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Collections introduced

- `users`: `_id`, `name`, normalized unique `email`, `passwordHash`, optional `profile`, `createdAt`, `updatedAt`.
- `sessions`: `_id`, `userId`, unique `tokenHash`, `expiresAt`, `createdAt`.
- Unique email and session-token-hash indexes; session expiration TTL index.

### Steps to complete

1. [ ] Define User and Session Mongoose models; hide password hashes from normal responses.
2. [ ] Validate registration name (2–100 chars), email format/normalization, and password (12–128 chars in approved API).
3. [ ] Hash passwords with Argon2id before saving.
4. [ ] Enforce unique email at the database level; convert duplicate-key errors to HTTP 409.
5. [ ] Build registration route/controller/service/repository, returning public user fields only; registration does **not** auto-login.
6. [ ] Build login: normalize email, look up user safely, verify password, return generic failure for invalid credentials.
7. [ ] Generate a strong random session token; store **only its hash** with user ID and expiry (maximum 7 days).
8. [ ] Set the session token in an HTTP-only cookie; use Secure over HTTPS, suitable SameSite and path settings.
9. [ ] Implement authentication middleware that checks token hash, session expiry and the owning user on every protected request.
10. [ ] Build `/auth/me` and `/auth/logout` (invalidate session and clear cookie).
11. [ ] Implement the approved CSRF endpoint, token binding and `X-CSRF-Token` validation; protect state-changing requests including login.
12. [ ] Check `Origin` for state-changing requests and avoid trusting cross-origin requests merely because cookies exist.
13. [ ] Add login/registration rate limits and safe error messages.
14. [ ] Build React registration, login and protected-page navigation.
15. [ ] Handle `credentials` and CSRF correctly when sending requests; refresh CSRF state appropriately when a session changes.
16. [ ] Confirm a browser refresh retains login, logout ends it, and expired sessions are rejected.
17. [ ] Write unit/integration tests (including cookie handling) and record design decisions.

### Verify and test

- [ ] Valid registration returns 201; duplicate email 409; invalid body 400.
- [ ] Correct login returns 200 and creates a server session/cookie.
- [ ] Wrong login returns 401 without revealing whether an account exists.
- [ ] Protected endpoint returns 401 without valid session.
- [ ] Logout invalidates session; replaying an old token fails.
- [ ] Missing/invalid CSRF token returns 403 for protected state-changing requests.
- [ ] Cookies are HttpOnly; passwordHash is absent in responses.
- [ ] Rate-limited auth attempts are rejected appropriately.

### Interview questions

1. Authentication vs. authorization?
2. Sessions vs. JWTs: what are the tradeoffs?
3. Why hash passwords? Hashing vs. encryption?
4. Why store a session-token hash?
5. What are HttpOnly/Secure/SameSite?
6. What is CSRF and why do cookies create risk?
7. How can login reveal whether an email exists?

**Done when:** You can demonstrate register → login → protected page → refresh → logout, plus failed/expired session and CSRF cases.  
**Suggested commit:** `feat(auth): add secure session authentication`

---

# PHASE 2 — USERS, WORKSPACES AND PROJECTS

## M4 — Profile management and secure password recovery

**Outcome:** Complete Stage 1 user-account flows.

### Prerequisites

- M3; secure sessions and error handling already working.

### Study and understand

- PATCH vs. PUT, partial updates, field allowlists.
- Password-change re-verification, password-reset flows, single-use tokens.
- Secure delivery of a reset link, token expiry, transactions and session revocation.

### APIs

- `PATCH /api/v1/users/me`
- `PATCH /api/v1/users/me/password`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

### Collection introduced

- `password_reset_tokens`: `_id`, `userId`, unique `tokenHash`, `expiresAt`, optional `usedAt`, `createdAt`; indexes on token hash/user/expiry.

### Steps to complete

1. [ ] Add public profile view/edit page and permitted fields: `name`, `email`, `profile.bio`.
2. [ ] Validate name 2–100 chars and bio max 500 chars; refuse unknown fields.
3. [ ] For email changes, verify current password and enforce normalized unique email.
4. [ ] Add change-password route: require current password, validate new one, hash it and invalidate existing sessions.
5. [ ] Create password-reset token schema with secure hash and 30-minute expiry.
6. [ ] Add forgot-password endpoint returning **the same generic 202 response** whether or not the email exists.
7. [ ] Configure a minimal email delivery mechanism for reset links; do not implement the Stage 2 notification system.
8. [ ] Add reset-password form; validate token, expiration and unused state.
9. [ ] Atomically consume the reset token and update the password; reject replay attempts.
10. [ ] Invalidate existing sessions after a successful reset and require login again.
11. [ ] Test failure states: wrong old password, duplicate email, expired/used token and invalid password.

### Interview questions

1. When should you use PATCH instead of PUT?
2. Why must password-reset tokens be single-use?
3. Why return the same response for known and unknown emails?
4. What is an atomic database operation?
5. What happens to active sessions after password reset?

**Done when:** Profile updates, password changes and basic recovery work securely with tests.  
**Suggested commit:** `feat(users): add profile and password management`

---

## M5 — Workspace creation, selection and access control

**Outcome:** Users can create, view, switch and edit authorized workspaces.

### Prerequisites

- M4; authentication and database transaction support.

### Study and understand

- Multi-tenancy in a shared database; logical data isolation.
- One-to-many vs. many-to-many relationships; ObjectId references.
- Compound unique indexes; role-based access control (RBAC).
- Server state in React and selected-workspace navigation.

### APIs

- `POST /api/v1/workspaces`
- `GET /api/v1/workspaces`
- `GET /api/v1/workspaces/:id`
- `PATCH /api/v1/workspaces/:id`

### Collections introduced

- `workspaces`: `_id`, `name`, `description`, `ownerId`, timestamps.
- `workspace_members`: `_id`, `workspaceId`, `userId`, `role` (`OWNER|MANAGER|DEVELOPER`), `joinedAt`.
- Unique (`workspaceId`,`userId`); index to find user workspaces; unique partial OWNER per workspace.

### Steps to complete

1. [ ] Create Workspace and WorkspaceMember models with required fields, role enum and indexes.
2. [ ] Write a service operation that creates a workspace and OWNER membership **in one transaction**.
3. [ ] Ensure the creator becomes `ownerId` and has exactly one OWNER membership.
4. [ ] Add a query that lists workspaces for the authenticated user through membership records.
5. [ ] Add details endpoint that checks membership first.
6. [ ] Add update endpoint restricted to Owner, allowing only name/description.
7. [ ] Verify role and ownership are **not** client-controlled fields.
8. [ ] Build workspace creation, list/selection and settings UI.
9. [ ] Include `myRole` in workspace response derived from membership, not stored in workspace document.
10. [ ] Confirm switching workspaces changes visible project context and does not leak data.
11. [ ] Test duplicate membership and forced workspace-creation rollback.

### Verify and test

- [ ] Any authenticated user can create a new workspace and becomes its Owner.
- [ ] Same user can belong to several workspaces; roles will be workspace-specific.
- [ ] Nonmembers cannot read/edit a workspace by guessing its ID.
- [ ] Owner-only update is enforced by backend.

### Interview questions

1. What is multi-tenancy? What does logical isolation mean?
2. Why store memberships separately instead of embedding all users in a workspace?
3. What is a compound unique index?
4. Why is creating Owner membership transactional?
5. What is a backend authorization check?

**Done when:** Multiple workspaces, proper ownership and isolation work.  
**Suggested commit:** `feat(workspaces): create and select workspaces`

---

## M6 — Workspace invitations and member viewing

**Outcome:** Owner can invite a person; that person accepts securely into the intended workspace.

### Prerequisites

- M5; users, sessions and membership models exist.

### Study and understand

- Invitation tokens, expiry, one-time use, safe URL handling.
- Many-to-many membership, partial unique indexes, transaction conflicts.
- Difference between revealing only necessary invitation preview data and full workspace data.

### APIs

- `POST /api/v1/workspaces/:id/invitations`
- `GET /api/v1/workspaces/:id/invitations`
- `GET /api/v1/invitations/:token`
- `POST /api/v1/invitations/:token/accept`
- `GET /api/v1/workspaces/:id/members`

### Collection introduced

- `workspace_invitations`: `_id`, `workspaceId`, `email`, `role`, `tokenHash`, `status`, `invitedBy`, `expiresAt`, `acceptedAt`, timestamps.
- Statuses: `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`; intended roles only `MANAGER` or `DEVELOPER`.

### Steps to complete

1. [ ] Create invitation model, unique tokenHash index, and unique partial pending-invitation index per workspace+email.
2. [ ] Build Owner-only invitation creation; reject existing members and duplicate active invites.
3. [ ] Normalize invited email and create a secure random token; store only its hash.
4. [ ] Use seven-day expiry and generate a link the Owner can share.
5. [ ] Do **not** expose raw invitation tokens in ordinary list responses or logs; avoid leaking tokens through external resources on the invitation page.
6. [ ] Build a minimal invitation preview showing workspace name, intended role, masked email and expiration.
7. [ ] If invited user is new, allow them to register and then return to the invitation flow.
8. [ ] In accept endpoint, require login and matching account email.
9. [ ] Atomically claim invitation and create membership; reject expired, used, revoked, or duplicate acceptance.
10. [ ] Build Owner invitation list and workspace member list UI.
11. [ ] Test simultaneous acceptance attempts and role/permission boundaries.

### Verify and test

- [ ] Owner can create invitations for MANAGER or DEVELOPER; never OWNER.
- [ ] Invitation is not usable by an account with a different email.
- [ ] No duplicate membership on concurrent acceptance.
- [ ] Expired/reused invitation fails without exposing private data.

### Interview questions

1. Why are invitation tokens random and hashed?
2. What is a race condition?
3. How do a transaction and unique index complement each other?
4. Why should preview responses return minimal information?
5. Why is email normalization important?

**Done when:** Full invite → preview → register/login → accept → member visible workflow works.  
**Suggested commit:** `feat(workspaces): add secure invitations`

---

## M7 — Project creation, project list and project access

**Outcome:** Owner/Manager can create projects, assign an eligible manager and list accessible projects.

### Prerequisites

- M6; workspace roles and member lookup work.

### Study and understand

- Domain modeling, MongoDB references, project ownership/manager permissions.
- Project/membership transaction, scoped list queries and paging.
- Date-only fields, server validation, REST nested resources.

### APIs

- `POST /api/v1/workspaces/:id/projects`
- `GET /api/v1/workspaces/:id/projects`
- `GET /api/v1/projects/:id`

### Collections introduced

- `projects`: `_id`, `workspaceId`, `name`, `description`, `managerId`, `startDate`, `targetDate`, `status`, timestamps.
- `project_members`: `_id`, `projectId`, `userId`, `joinedAt`; unique (`projectId`,`userId`).
- Project statuses: `PLANNED`, `ACTIVE`, `COMPLETED`, `ARCHIVED`.

### Steps to complete

1. [ ] Create Project and ProjectMember schemas and indexes.
2. [ ] Validate name 3–150 chars, description max 2,000, valid date-only values, target not before start.
3. [ ] Create project only within workspace in URL and only if requester is Owner/Manager there.
4. [ ] Validate designated manager belongs to workspace and has OWNER or MANAGER role.
5. [ ] Apply approved restriction: a Manager who creates a project must assign themselves; Owner may select another eligible manager.
6. [ ] In a transaction, create project and its manager's project membership.
7. [ ] Implement project list with workspace filter, status filter and pagination.
8. [ ] Restrict visibility: Owner all workspace projects; Manager/Developer only projects they manage/belong to.
9. [ ] Implement project detail with the same access rules.
10. [ ] Build project create form, project list and project detail page.
11. [ ] Handle project states and empty lists in UI; test invalid/missing workspace and manager.

### Interview questions

1. What is domain modeling?
2. Why reference a workspace instead of embedding projects inside it?
3. Why does project creation require a transaction?
4. What is the difference between a manager's workspace role and assignment to a project?
5. How do you prevent an IDOR (insecure direct object reference) attack?

**Done when:** A user sees only authorized projects and valid project creation always makes manager membership.  
**Suggested commit:** `feat(projects): add project creation and access`

---

## M8 — Project membership, manager changes and lifecycle

**Outcome:** Authorized users can manage members, project details and project status safely.

### Prerequisites

- M7; project models and authorization.

### Study and understand

- Business invariants, multi-record consistency, lifecycle/state rules.
- Authorization vs. UI permissions; owner override and assigned-manager rights.
- Archive vs. permanent deletion.

### APIs

- `PATCH /api/v1/projects/:id`
- `GET /api/v1/projects/:id/members`
- `POST /api/v1/projects/:id/members`
- `DELETE /api/v1/projects/:id/members/:userId`

### Steps to complete

1. [ ] Add update service for permitted project fields (name, description, dates, status, managerId).
2. [ ] Check Owner or the **assigned** Project Manager before management actions.
3. [ ] Implement project-member list with minimal user summaries.
4. [ ] Add project member only if they belong to the same workspace; reject duplicates.
5. [ ] Implement removing a project member; do not delete their tasks.
6. [ ] Prevent removal of current manager unless a valid replacement is assigned.
7. [ ] Make manager reassignment validate OWNER/MANAGER eligibility and ensure new manager membership transactionally.
8. [ ] Add project statuses and archive/restore behavior; omit project-delete API (approved system design).
9. [ ] Reject new task creation/task changes in archived projects (enforce fully when M10 is built).
10. [ ] Build project settings page, members management, manager selector and archive/restore UI.
11. [ ] Cover role-sensitive tests, invalid dates, manager replacement, and archive behavior.

### Interview questions

1. What is a business invariant? Give an example.
2. Why use archive rather than delete for a project?
3. How do you enforce permissions at the service/API layer?
4. How do transactions preserve manager/membership consistency?
5. What is the difference between 401, 403 and 404?

**Done when:** Project lifecycle, member management and manager changes are valid and authorized.  
**Suggested commit:** `feat(projects): manage members and lifecycle`

---

## M9 — Workspace role changes and member removal

**Outcome:** Owner can manage roles and remove members without breaking project ownership/manager rules.

### Prerequisites

- M8; workspace and project memberships exist.

### Study and understand

- Cross-module business rules; transaction boundaries; preserving invariants.
- Safe removal vs. cascading deletion; data retention.

### APIs

- `PATCH /api/v1/workspaces/:id/members/:userId`
- `DELETE /api/v1/workspaces/:id/members/:userId`

### Steps to complete

1. [ ] Add Owner-only role update API; only `MANAGER` and `DEVELOPER` are permitted as target roles.
2. [ ] Prevent changing designated Owner's role or removing Owner.
3. [ ] Detect projects currently managed by a user who is being downgraded/removed.
4. [ ] Return a conflict until every such project has a valid replacement manager.
5. [ ] When permitted, update membership role in a safe operation.
6. [ ] Implement workspace-member removal that also removes project memberships in that workspace.
7. [ ] **Prepare** task-unassignment integration; finish it once Task collection exists in M10.
8. [ ] Ensure membership changes invalidate access on the next protected request (never rely on cached frontend role).
9. [ ] Build Owner role editing, removal confirmation and conflict messages.
10. [ ] Test non-Owner rejection, no-Owner-removal, Manager-downgrade conflict and transaction rollback.
11. [ ] In M10, complete task unassignment in the same controlled removal workflow and retest.

### Interview questions

1. Why can changing a role affect other modules?
2. What does a transaction boundary mean?
3. What is referential integrity in MongoDB if there are no built-in foreign keys?
4. Why keep a removed developer's tasks instead of deleting them?
5. How do you prevent stale permissions after role changes?

**Done when:** Role/removal rules work; final task cleanup is explicitly tracked for M10.  
**Suggested commit:** `feat(workspaces): manage member roles and removal`

---

# PHASE 3 — TASK FEATURES

## M10 — Task model, CRUD, assignment and member-removal cleanup

**Outcome:** Task creation, viewing, editing, assignment and authorized deletion work.

### Prerequisites

- M9; project access and members are available.

### Study and understand

- Mongoose document schema, defaults, enum validation, references and indexes.
- CRUD, repository design, SOLID/SRP, abstraction and encapsulation in a TypeScript backend.
- Business authorization for developers vs. project managers.

### APIs

- `POST /api/v1/projects/:id/tasks`
- `GET /api/v1/tasks/:id`
- `PATCH /api/v1/tasks/:id`
- `DELETE /api/v1/tasks/:id`
- `GET /api/v1/projects/:id/tasks` begins as a **simple paginated list** in M11, then gains full search/filters in M12.

### Collection introduced

- `tasks`: `_id`, `projectId`, `title`, `description`, nullable `assigneeId`, `priority`, `status`, nullable `dueDate`, `createdBy`, nullable `updatedBy`, timestamps.
- Priority: `LOW`, `MEDIUM` (default), `HIGH`, `URGENT`.
- Status: `BACKLOG` (default), `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`.

### Steps to complete

1. [ ] Define Task schema; title 3–200 chars, description max 5,000, optional assignee/dueDate.
2. [ ] Accept dates in `YYYY-MM-DD`; store the chosen date consistently as specified in DB design.
3. [ ] Create TaskRepository methods for create, find, update and delete.
4. [ ] Write TaskService checks: project exists, requester has access, project not archived, valid assignee membership.
5. [ ] Implement task creation by Owner/Manager with permitted fields.
6. [ ] Implement limited Developer creation in accessible projects: title/description; other fields use defaults.
7. [ ] Record authenticated `createdBy` automatically; do not accept this from client.
8. [ ] Implement task detail lookup and access verification through task → project → workspace.
9. [ ] Implement task details update only for Owner/assigned Manager; allow title, description, assigneeId, priority, dueDate (not status in this route).
10. [ ] Automatically record `updatedBy` and `updatedAt`.
11. [ ] Implement authorized permanent deletion, with frontend confirmation and archived-project restriction.
12. [ ] Build task-create form and task-detail/edit UI.
13. [ ] Complete M8/M9 member-removal behavior: unassign tasks that were assigned to a removed project/workspace member, **without deleting tasks**.
14. [ ] Use transactions where member changes touch multiple collections; verify rollback on failure.
15. [ ] Test invalid assignee, forbidden editor, unknown field injection, archived project and deletion permissions.

### Verify and test

- [ ] Owner/Manager can create, assign, edit and delete valid tasks.
- [ ] Developer can create a basic task and view accessible tasks, but cannot use manager-only update/delete APIs.
- [ ] Task cannot be assigned to a person outside the project.
- [ ] Removing a member leaves their tasks but sets `assigneeId = null`.
- [ ] A guessed task ObjectId in another workspace does not provide access.

### Interview questions

1. Where did you use OOP or an abstraction in the backend?
2. How do Controller, Service and Repository differ?
3. Where does SOLID help and where would it be unnecessary?
4. How does Mongoose validation differ from business validation?
5. How do you prevent users changing `createdBy` or `projectId`?
6. Why keep `assigneeId` nullable?

**Done when:** Task management works and membership removal leaves consistent task assignments.  
**Suggested commit:** `feat(tasks): implement task CRUD and assignment`

---

## M11 — Task statuses and five-column Kanban board

**Outcome:** Authorized users move tasks through the approved status workflow using dropdown/buttons.

### Prerequisites

- M10; task model and basic UI.

### Study and understand

- React state, props, hooks, derived UI and server state vs. client state.
- TanStack Query for fetching/refetching/mutations.
- PATCH, loading states, error handling and role-sensitive actions.
- Backend as source of truth; why optimistic UI updates require care.

### APIs

- `PATCH /api/v1/tasks/:id/status`
- `GET /api/v1/projects/:id/tasks` (initial paginated task list; M12 adds full filtering/search).

### Steps to complete

1. [ ] Implement status update API with allowed status enum and archived-project restriction.
2. [ ] Owner/assigned Manager may manage statuses and approve Done.
3. [ ] Assigned Developer may choose BACKLOG, TODO, IN_PROGRESS or IN_REVIEW; **cannot** set DONE.
4. [ ] Only Owner/assigned Manager can reopen an already-DONE task.
5. [ ] Validate task assignment and project access on every status request.
6. [ ] Implement an initial paginated `GET /projects/:id/tasks` list; query only one authorized project.
7. [ ] Build task card component showing title, priority, assignee and due date.
8. [ ] Build board with BACKLOG, TODO, IN_PROGRESS, IN_REVIEW and DONE columns.
9. [ ] Group retrieved tasks by status in frontend; ensure pagination does not hide tasks beyond first page.
10. [ ] Provide a dropdown/button status action only where user has permission.
11. [ ] After successful PATCH, update/refetch server data; after failure, show an error and keep prior confirmed state.
12. [ ] Add loading, no-task, unauthorized and network-failure states.
13. [ ] Test business permission rules and board column positioning.

### Interview questions

1. What is the difference between props and state?
2. What is server state? Why use TanStack Query?
3. Why should backend authorization still run if a button is hidden?
4. What is a controlled component?
5. What happens if the network request fails after a user clicks Update?
6. Why not implement WebSockets yet?

**Done when:** Board accurately displays all accessible tasks and status changes obey review rules.  
**Suggested commit:** `feat(board): add Kanban task statuses`

---

## M12 — Search, filtering, pagination and indexing

**Outcome:** Users can find tasks accurately and efficiently without loading unlimited records.

### Prerequisites

- M11; project task listing is available.

### Study and understand

- MongoDB `find`, filters, compound/text indexes and `explain` plans.
- Pagination (page/limit), stable sorting, total counts.
- URL query parameters and React search controls.
- Complexity of searches and tradeoffs of indexes.

### API

- `GET /api/v1/projects/:id/tasks` with `status`, `priority`, `assigneeId`, `search`, `page`, `limit`.

### Steps to complete

1. [ ] Formalize query validation with Zod: `page >= 1`, default 1; `limit` default 20, maximum 100.
2. [ ] Implement status filter.
3. [ ] Implement priority filter.
4. [ ] Implement `assigneeId` filter, including the special `unassigned` value.
5. [ ] Implement exact full ObjectId search for task ID.
6. [ ] Implement word-based title search (not arbitrary substring regex); understand text-index behavior.
7. [ ] Combine multiple filters safely, always restricted to the authorized project.
8. [ ] Implement stable newest-first sorting using `createdAt` plus `_id` as tie-breaker.
9. [ ] Return consistent `{ data: [...], pagination: { page, limit, total, totalPages } }`.
10. [ ] Add/verify task indexes on project+status, project+assignee, project+priority, project+dueDate and suitable scoped title search.
11. [ ] Use MongoDB `explain` to inspect representative queries; document whether indexes actually help.
12. [ ] Build UI search field, status/priority/assignee filters, clear filters and pagination controls.
13. [ ] Ensure Kanban board correctly loads all relevant pages or queries individual statuses, not just page 1.
14. [ ] Test invalid query strings, empty results, last page, combined filters, multi-workspace isolation and large seed dataset.

### Interview questions

1. How does a database index work?
2. When are compound indexes useful?
3. What tradeoffs do indexes have for writes and storage?
4. What is pagination and why use it?
5. Why use stable sorting when paginating?
6. What does a query execution plan show?
7. How does Big O relate to the operation you implemented?

**Done when:** Search/filter/pagination are accurate, access-controlled and measured against meaningful test data.  
**Suggested commit:** `feat(tasks): add search filters and pagination`

---

## M13 — Project dashboard calculations

**Outcome:** Dashboard shows accurate progress derived from tasks, without storing duplicate counters.

### Prerequisites

- M12; tasks and task indexes available.

### Study and understand

- MongoDB aggregation pipeline (`$match`, `$group`, conditional counts).
- Derived data vs. stored counters; consistency tradeoffs.
- UTC timestamps vs. date-only fields, percentage calculations and rounding.

### API

- `GET /api/v1/projects/:id/dashboard`

### Steps to complete

1. [ ] Define output: `projectId`, `totalTasks`, `completedTasks`, `inProgressTasks`, `overdueTasks`, `completionPercentage`.
2. [ ] Validate requester can access project before aggregating.
3. [ ] Aggregate **only that project's tasks**.
4. [ ] Count DONE as completed; IN_PROGRESS as in progress.
5. [ ] Count overdue if due date is before today's **UTC calendar date** and task is not DONE.
6. [ ] Calculate `(completed / total) * 100`, rounded to two decimals; return `0` for empty project.
7. [ ] Do not store duplicate dashboard counters in Project records in Stage 1.
8. [ ] Build UI statistic cards and simple progress display.
9. [ ] Refetch statistics on page load or after task changes as appropriate; no realtime requirement.
10. [ ] Test empty projects, mixed statuses, past/today/future due dates, archiving and authorization.

### Interview questions

1. What is MongoDB aggregation?
2. Why derive dashboard values instead of storing counters?
3. What is a consistency tradeoff?
4. Why are UTC date rules important?
5. How would you optimize a dashboard if a project had many tasks?

**Done when:** Dashboard values match underlying task data and reflect saved changes.  
**Suggested commit:** `feat(dashboard): add project statistics`

---

# PHASE 4 — QUALITY AND RELEASE

## M14 — Full security review, regression tests and reliability

**Outcome:** Verify all Stage 1 features work together, including important failure/security cases. Tests should already exist from M2 onward.

### Prerequisites

- M0–M13 complete; integrated app available.

### Study and understand

- Unit vs. integration vs. end-to-end tests; test doubles and test isolation.
- Authorization testing and defense in depth.
- Regression testing, structured errors and logs.
- Performance measurement and browser accessibility basics.

### Steps to complete

1. [ ] Run all unit and integration tests; identify gaps by comparing to SRS/API acceptance tests.
2. [ ] Verify registration, login, logout, profile, change password and reset password paths.
3. [ ] Verify CSRF token handling for every state-changing endpoint, including login.
4. [ ] Test missing, expired and replayed session tokens; ensure revoked sessions fail.
5. [ ] Test permissions for Owner, assigned Manager, nonassigned Manager, Developer and nonmember.
6. [ ] Test cross-workspace and cross-project access attempts with known valid ObjectIds.
7. [ ] Test duplicate email, membership, pending invitation and invitation double acceptance.
8. [ ] Test manager reassignment and role-downgrade restrictions.
9. [ ] Test member removal unassigns tasks while preserving them.
10. [ ] Test archived project restrictions on creating/editing/deleting tasks.
11. [ ] Test developer cannot approve task as Done.
12. [ ] Test bad ObjectIds, unsupported fields, malformed JSON, validation errors and consistent HTTP status codes.
13. [ ] Test transaction rollback for workspace creation, invitation acceptance, manager changes and member removal.
14. [ ] Verify no password hash, token, connection URI or stack trace appears in ordinary API responses/logs.
15. [ ] Add Playwright browser tests for register → create workspace → invite → create project → assign task → review → Done → dashboard.
16. [ ] Test navigation, form validation, loading/error/empty states and keyboard accessibility.
17. [ ] Test responsive pages at mobile/tablet/desktop widths; board may scroll horizontally.
18. [ ] Seed a meaningful task dataset; measure normal API request times and note environment/size (approved target: common operations within ~2 seconds under normal test conditions).
19. [ ] Review query plans for important task queries and optimize only evidenced bottlenecks.
20. [ ] Fix critical issues and rerun the full test suite.

### Test categories to keep

- **Unit:** pure services, status rules, calculations.
- **Integration:** Express + middleware + test MongoDB.
- **E2E:** browser-level approved workflows.
- **Security:** unauthorized access, CSRF, sessions, validation and sensitive-data exposure.

### Interview questions

1. Unit vs. integration vs. E2E testing?
2. What is mocking? When should you avoid over-mocking?
3. What is regression testing?
4. How would you test a protected API?
5. What is IDOR? What is CSRF?
6. What is a race condition? How did you handle duplicate membership?
7. How do you investigate a slow API?

**Done when:** Approved critical workflows pass in automation/manual checks, no known critical bugs remain, and the full test suite passes.  
**Suggested commit:** `test: complete Stage 1 security and regression suite`

---

## M15 — Documentation, fresh-clone verification and MVP release

**Outcome:** Another developer can run your MVP; you can demonstrate it and defend its engineering decisions in an interview.

### Prerequisites

- M14 complete and tests passing.

### Study and understand

- Technical documentation and maintainability.
- OpenAPI basics (documentation only).
- Git release tags and reproducible setup.
- How to present requirements, architectural decisions and technical tradeoffs clearly.

### Steps to complete

1. [ ] Clean unnecessary code, unused packages and stale files; keep the architecture understandable.
2. [ ] Update top-level README with purpose, screenshots (optional), Stage 1 capabilities, stack, requirements, setup, tests and project layout.
3. [ ] Document how to install dependencies and start frontend/backend from a fresh clone.
4. [ ] Document `.env.example` variables without publishing actual secrets.
5. [ ] Explain how to configure a MongoDB deployment with transaction support.
6. [ ] Document database collection relationships, indexes, validation and transaction-required operations.
7. [ ] Verify every approved `/api/v1` endpoint and document its request, response, permissions, status codes and errors (OpenAPI encouraged).
8. [ ] Update architecture diagram if implementation details changed, without silently changing approved behavior.
9. [ ] Write at least one engineering decision note for authentication, data modeling, authorization, transactions, indexes and frontend fetching.
10. [ ] Explain how to run unit, integration and E2E tests and how to prepare/clean test data.
11. [ ] Provide optional demo seed data **without** real people, real credentials or secrets.
12. [ ] Perform a fresh-clone test on a separate folder or environment; follow README exactly.
13. [ ] Confirm all 34 approved API endpoints behave according to contract.
14. [ ] Walk through every Stage 1 functional requirement and acceptance scenario.
15. [ ] Run the final full test suite; record test environment and relevant results.
16. [ ] Confirm no Stage 2/3 features slipped into MVP as dependencies.
17. [ ] Tag the working code (for example `v1.0.0-mvp`) and push tag to GitHub.
18. [ ] Add a short MVP release note: completed features, known limitations, and what is planned for Stage 2.
19. [ ] Prepare a 5–10 minute demonstration and architecture explanation.
20. [ ] Answer the interview questions below without reading from a script; fill any knowledge gaps.

### Interview questions

1. Walk me through your full system architecture.
2. Why choose a modular monolith and MERN?
3. Why use TypeScript in both layers?
4. How does a user log in and how is the session secured?
5. Where did you apply OOP/SOLID and where did you deliberately avoid abstraction?
6. Why use membership collections rather than arrays inside workspace/project records?
7. What are the key indexes and how did you verify them?
8. Where are transactions required? What happens if one operation fails?
9. How do you stop users from accessing another workspace's project/task IDs?
10. What tests give you confidence in the system?
11. What is one engineering tradeoff you would change at larger scale?
12. What would you add in Stage 2 and why did you exclude it now?

### Final exit checklist

- [ ] Registration, login, logout, profiles and password recovery work.
- [ ] Users can create workspaces, invite members and manage basic roles.
- [ ] Eligible users create projects, manage memberships and archive/restore them.
- [ ] Tasks can be created, assigned, edited, searched, filtered, status-updated and deleted according to permissions.
- [ ] Five-column Kanban board works correctly across pages of tasks.
- [ ] Project dashboard counts/percentages are correct.
- [ ] Important errors and unauthorized requests are handled safely.
- [ ] Automated tests pass and README setup works from a fresh clone.
- [ ] Source code and six planning documents are in GitHub with no secrets.
- [ ] The MVP release is tagged and you can explain every key decision.

**Done when:** Stage 1 is independently runnable, tested, documented and ready for review.  
**Suggested commit:** `docs: finalize DevFlow MVP release`

---

# APPENDIX A — Complete Stage 1 REST API checklist (34 endpoints)

**All paths below start with `/api/v1`.** Check them off as you implement, test and document them.

### Authentication (7)

- [ ] `GET /auth/csrf` — obtain CSRF token (M3).
- [ ] `POST /auth/register` — register with name/email/password; returns Public User, 201 (M3).
- [ ] `POST /auth/login` — verify credentials, set session cookie, 200 (M3).
- [ ] `POST /auth/logout` — invalidate session and clear cookie, 204 (M3).
- [ ] `GET /auth/me` — return current Public User, 200 or 401 (M3).
- [ ] `POST /auth/forgot-password` — generic 202 and reset link delivery if account exists (M4).
- [ ] `POST /auth/reset-password` — secure single-use token, update password, 204 (M4).

### User profile (2)

- [ ] `PATCH /users/me` — permitted profile fields; current password for email changes (M4).
- [ ] `PATCH /users/me/password` — verify old password, set new hash, revoke sessions (M4).

### Workspaces (9)

- [ ] `POST /workspaces` — create workspace + Owner membership atomically (M5).
- [ ] `GET /workspaces` — list current user's workspaces (M5).
- [ ] `GET /workspaces/:id` — accessible workspace details (M5).
- [ ] `PATCH /workspaces/:id` — Owner-only name/description (M5).
- [ ] `GET /workspaces/:id/members` — workspace member summaries (M6).
- [ ] `PATCH /workspaces/:id/members/:userId` — Owner changes Manager/Developer role (M9).
- [ ] `DELETE /workspaces/:id/members/:userId` — Owner removes member safely (M9/M10).
- [ ] `POST /workspaces/:id/invitations` — Owner creates invite (M6).
- [ ] `GET /workspaces/:id/invitations` — Owner lists invite summaries (M6).

### Invitation acceptance (2)

- [ ] `GET /invitations/:token` — preview a valid invite (M6).
- [ ] `POST /invitations/:token/accept` — authenticated invited email joins atomically (M6).

### Projects + dashboard (8)

- [ ] `POST /workspaces/:id/projects` — create project + manager membership atomically (M7).
- [ ] `GET /workspaces/:id/projects` — list authorized projects, optionally filter/paginate (M7).
- [ ] `GET /projects/:id` — view accessible project (M7).
- [ ] `PATCH /projects/:id` — update project / status / manager (M8).
- [ ] `GET /projects/:id/members` — view project members (M8).
- [ ] `POST /projects/:id/members` — add eligible workspace member (M8).
- [ ] `DELETE /projects/:id/members/:userId` — remove member and unassign tasks (M8/M10).
- [ ] `GET /projects/:id/dashboard` — calculate statistics (M13).

### Tasks (6)

- [ ] `POST /projects/:id/tasks` — create task (M10).
- [ ] `GET /projects/:id/tasks` — paginated list, title/ID search and filters (M11/M12).
- [ ] `GET /tasks/:id` — view accessible task (M10).
- [ ] `PATCH /tasks/:id` — edit manager-only task fields (M10).
- [ ] `PATCH /tasks/:id/status` — role-appropriate status change (M11).
- [ ] `DELETE /tasks/:id` — authorized deletion (M10).

**API response contract:** success `{ "data": ... }`; list may add `pagination`; errors `{ "error": { "code": "...", "message": "...", "details": [...] } }`; 204 has no body. Use 200/201/202/204/400/401/403/404/409/410/429/500 appropriately. A business `/api/health` endpoint from M1 is only a development utility, not one of the 34 specified business APIs.

---

# APPENDIX B — Nine-collection data-model quick reference

| Collection | Important fields and rules | Key indexes |
|---|---|---|
| `users` | name, normalized email, passwordHash, profile, timestamps; no global role | email unique |
| `sessions` | userId, tokenHash, expiresAt, createdAt; max 7-day session; check expiry in code | tokenHash unique, userId, expiresAt TTL |
| `password_reset_tokens` | userId, tokenHash, expiresAt, usedAt, createdAt; 30 minutes and single-use | tokenHash unique, userId, expiresAt TTL |
| `workspaces` | name, description, ownerId, timestamps; exactly one designated Owner | ownerId |
| `workspace_members` | workspaceId, userId, role (OWNER/MANAGER/DEVELOPER), joinedAt | workspaceId+userId unique; userId+workspaceId; unique partial OWNER per workspace |
| `workspace_invitations` | workspaceId, email, role, tokenHash, status, invitedBy, expiresAt, acceptedAt | tokenHash unique; workspaceId+status; unique partial PENDING per workspace+email |
| `projects` | workspaceId, name, description, managerId, startDate, targetDate, status, timestamps | workspaceId+status; managerId+status |
| `project_members` | projectId, userId, joinedAt; must also belong to workspace | projectId+userId unique; userId+projectId |
| `tasks` | projectId, title, description, assigneeId/null, priority, status, dueDate/null, createdBy, updatedBy, timestamps | projectId+status; projectId+assigneeId; projectId+priority; projectId+dueDate; title text search scoped to project |

**Reminder:** ObjectId references are **not** automatic foreign keys. Validate related documents in services and use transactions where required. A Mongoose `unique` option creates an index; it is not the same as a validator. TTL cleanup is asynchronous, so explicitly check expiration in code.

### Selected business rules that must remain true

1. User email unique; role belongs to a workspace membership, not User.
2. One designated Owner per workspace; owner cannot be downgraded/removed in MVP.
3. Project belongs to one workspace; assigned manager must be eligible and have project membership.
4. Every project member must belong to its workspace; each membership is unique.
5. Task belongs to exactly one project; task assignee is a member of that project or null.
6. Developers may create basic tasks and update the status of tasks assigned to them, but cannot approve Done.
7. Only Owner/assigned Manager can fully edit, assign, approve Done and delete tasks.
8. Archived projects remain viewable but reject new task creation and task updates/deletion.
9. Removing a member does not delete tasks; assigned tasks become unassigned.
10. All protected operations verify backend access to the correct workspace/project.

---

# APPENDIX C — Permission reference

| Operation | Workspace Owner | Workspace Manager | Developer |
|---|---|---|---|
| Create a **new** workspace | Any authenticated user | Any authenticated user | Any authenticated user |
| Edit a workspace / manage its roles/invites | Yes, own workspace | No | No |
| Create a project | Yes | Yes, self as assigned manager | No |
| Manage project details/members | Yes, workspace-wide | Only assigned projects | No |
| View project | All workspace projects | Managed/member projects | Member projects |
| Create task | Yes | In accessible projects | In member projects, title/description only |
| Edit task details / assign / delete | Yes | Assigned managed projects | No |
| Update own assigned task status | Yes | Yes within authorized projects | Yes, except Done |
| Approve Done or reopen Done | Yes | Assigned managed projects | No |
| View project dashboard | All workspace projects | Accessible projects | Accessible projects |

**Important subtlety:** A workspace Manager who is merely a member of another Manager's project can view/member-participate there; this does not give them full management rights for that project. Backend checks must use both role **and** assigned manager/project membership.

---

# APPENDIX D — Core acceptance journey for final demonstration

Prepare three test accounts in a non-production test environment: **Owner**, **Manager**, and **Developer**. Avoid hardcoding real passwords into public docs.

1. Register Owner, Manager, Developer; log in as Owner.
2. Owner creates `ABC Software` workspace.
3. Owner creates invitations for Manager and Developer.
4. Manager and Developer log in and accept their own invitations.
5. Owner creates `E-Commerce Platform`, assigns Manager; Manager has project membership.
6. Manager adds Developer to project.
7. Manager creates task `Create Login API`, sets HIGH priority and assigns Developer.
8. Developer sees task and moves TODO → IN_PROGRESS → IN_REVIEW.
9. Developer attempts to mark DONE and receives permission error.
10. Manager marks task DONE; board moves it to Done.
11. Search by title; filter by status, priority and assignee; verify pagination with more sample tasks.
12. View dashboard; check completed/total percentage.
13. Archive project; try to modify task and verify rejection.
14. Create a second workspace with a different user; verify cross-workspace access fails.
15. Remove a project member; verify their assigned tasks remain but become unassigned.
16. Verify logout ends authenticated access and password reset revokes sessions.

If all these work, together with the agreed automated tests and the 34-endpoint API contract, you have a strong Stage 1 demonstration.

---

# APPENDIX E — Milestone progress log template

Copy the template below into `docs/engineering-notes/milestone-progress.md` and repeat it after each milestone.

```markdown
## Milestone M__ — <name>
- Started:
- Completed:
- Status: Not started / In progress / Blocked / Done
- Git branch / commit:
- Requirements and APIs covered:

### What I studied
- 

### What I built myself
- 

### Tests I ran and results
- 

### Difficulties and how I solved them
- 

### Engineering decisions and tradeoffs
- 

### Questions I can now answer
- 

### Known limitations / next milestone
- 
```

### When to ask AI

Good example: **“I am on DevFlow M5. My transaction creates a workspace but sometimes not the Owner membership. Explain what I should investigate and give hints, not the final code.”**  
Good example: **“Review my TaskService for authorization and SOLID issues. Explain each concern and let me implement fixes.”**  
Avoid: **“Generate the whole DevFlow backend/frontend for me.”**

### Learning sources

Use current official documentation as your primary reference:

- React: https://react.dev/learn
- TypeScript: https://www.typescriptlang.org/docs/
- Node.js: https://nodejs.org/en/learn
- Express: https://expressjs.com/
- MongoDB: https://www.mongodb.com/docs/
- Mongoose: https://mongoosejs.com/docs/
- Zod: https://zod.dev/
- React Router: https://reactrouter.com/
- TanStack Query: https://tanstack.com/query/latest
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- Git: https://git-scm.com/doc

---

## Final checklist — ready to leave this chat

- [ ] Save this file as `docs/development-milestones.md` in DevFlow.
- [ ] Save the five other approved planning documents in `docs/`.
- [ ] Start at **M0**, not M3 or M10.
- [ ] Write code yourself; use AI for mentoring/review when you genuinely need it.
- [ ] Complete the universal completion gate after **every** milestone.
- [ ] Use Appendices A–D as your API, database, permission and demo checklists.
- [ ] Finish Stage 1 before taking on Stage 2/3 features.

**End of guide — DevFlow Stage 1, Milestones M0–M15.**
