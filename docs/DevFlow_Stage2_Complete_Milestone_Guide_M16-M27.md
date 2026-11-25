# DevFlow — Stage 2 Complete Development Guide (M16–M27)

- **Stage** Advanced Team Collaboration
- **Starting point** Stage 1 MVP release, `v1.0.0-mvp`
- **Status** Proposed milestone roadmap based on the approved project scope

## A. What you are building

Stage 2 takes DevFlow from managing tasks to coordinating work across a team. A team can plan a sprint, discuss a task, see what changed, identify blocked work, and keep separate browser sessions in sync. The existing project dashboard gains more detail so a manager can check sprint progress and find work that needs attention.

The [project scope](PROJECT_SCOPE.md) and [SRS](SRS.md) define the features. This guide proposes the build order and implementation approaches where those documents leave a choice open. The [Stage 1 guide](DevFlow_Stage1_Complete_Milestone_Guide_M0-M15.md) and [MVP verification record](engineering-notes/008-mvp-verification.md) establish the starting point.

### Architecture and scope

- **Frontend** Keep the React and TypeScript application, Studio UI, React Router, and TanStack Query. Add sprint and collaboration views to the existing project and task screens.
- **Backend** Extend the Express modular monolith. REST remains the entry point for writes. The server validates permissions and business rules before committing changes.
- **Data** Keep MongoDB and Mongoose. Use indexes, conditional writes, and transactions where needed to enforce rules under concurrent requests. Verify behavior with tasks created in Stage 1.
- **Real-time updates** Add Socket.IO to the existing HTTP server. Publish changes after commit and refetch authorized data after reconnecting. Persist in-app notifications so they can also be opened later.
- **Stage 3** GitHub integration, Redis, background job infrastructure, production monitoring, Docker packaging, CI/CD, and production deployment follow the existing Stage 3 plan.

See the [system design](SYSTEM_DESIGN.md), [database design](DATABASE_DESIGN.md), and [UI design](UI_UX_DESIGN.md) for the existing boundaries and conventions.

## B. How to work through each milestone

Trace each change to an approved requirement. Build one complete workflow at a time from the database and rules through to the UI. For every new write, identify who can perform it, what must happen if it fails, and what happens when two people do it together. Record any implementation decisions and the reasoning in the milestone PR or engineering notes.

### Universal completion gate

- [ ] The workflow works through its normal UI and API entry points.
- [ ] Tests cover success, relevant permission failures, and the milestone's key edge cases.
- [ ] Existing behavior still works for Stage 1 users, documents, and API callers.
- [ ] The milestone's automated checks and manual walkthrough pass. Record the commands and results.
- [ ] The API, data model, setup, or demo docs reflect the feature when it changes them.
- [ ] You can demonstrate the feature and answer the milestone's interview questions.

### Git workflow

Start M16 from the merged MVP. Run these commands from the repository root with a clean working tree. Repeat the same flow from updated `main` for each later milestone.

```bash
git status --short --branch
git switch main
git pull --ff-only origin main
git merge-base --is-ancestor v1.0.0-mvp HEAD
git switch -c codex/m16-stage2-foundation
```

`git pull --ff-only` updates your local `main` when it can move forward without a merge commit. `git merge-base --is-ancestor` exits silently with status zero when the MVP release is included. After verifying a milestone, stage its files, review the staged diff, commit with the suggested message, and push the branch for a pull request.

### Local setup and verification commands

Use Node.js 24 and a MongoDB deployment with transaction support, such as your Atlas setup. For a fresh checkout, install the locked dependencies and create local environment files from the templates. Use your existing settings if the local environment is already configured.

```bash
npm --prefix backend ci
npm --prefix frontend ci
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

Configure the ignored environment files as described in the [README](../README.md). Use the configured test database, `devflow_test` by default, for integration, browser, and benchmark fixtures.

```bash
# Terminal 1
npm --prefix backend run dev

# Terminal 2
npm --prefix frontend run dev

# Terminal 3
curl -fsS http://127.0.0.1:3000/api/health
```

Open [DevFlow on port 5173](http://127.0.0.1:5173/) with the default settings. Browser tests start their own server. Use separate browser profiles or contexts for multi-user tests.

| Check | Command | What it verifies |
| --- | --- | --- |
| Backend types | `npm --prefix backend run typecheck` | Server and test code compile against their types |
| Backend build | `npm --prefix backend run build` | Server builds using the production compiler configuration |
| Backend tests | `npm --prefix backend test` | Logic and HTTP behavior that can run without a database |
| Database tests | `npm --prefix backend run test:db` | Actual MongoDB writes, indexes, transactions, and concurrent operations |
| Frontend lint | `npm --prefix frontend run lint` | Frontend static checks |
| Frontend build | `npm --prefix frontend run build` | Type checks and builds the browser application |
| Browser setup | `npm --prefix backend exec -- playwright install --only-shell chromium` | Installs the browser for Playwright once per required browser version |
| Browser tests | `npm --prefix backend run test:e2e` | Builds the frontend and exercises complete user workflows |
| Performance baseline | `npm --prefix backend run test:performance` | Measures the existing API baseline in the configured test database |

The current `test:db` script lists its test files explicitly. Add each new database suite to that script or update discovery so the release command actually runs it. Use the commands relevant to each milestone and the full set at M26 and M27.

## C. Stage 2 milestone map

| Phase | Milestone | Deliverable | Build on |
| --- | --- | --- | --- |
| Foundation and planning | [M16](#m16--stage-2-foundation-and-contracts) | Verified baseline and Stage 2 contracts | Stage 1 release |
| Foundation and planning | [M17](#m17--sprint-management-and-progress) | Sprint lifecycle, membership, and progress | M16 |
| Task collaboration | [M18](#m18--task-comments-and-mentions) | Commenting and project-member mentions | M16 |
| Task collaboration | [M19](#m19--task-activity-history) | Persisted activity timeline | M17–M18 |
| Task collaboration | [M20](#m20--task-dependencies-and-cycle-detection) | Dependency graph and blocked-work indicators | M16, M19 |
| Concurrent and live workflows | [M21](#m21--concurrent-updates-and-conflict-handling) | Stale-write protection and conflict recovery | M17–M20 |
| Concurrent and live workflows | [M22](#m22--drag-and-drop-kanban) | Accessible Kanban movement | M21 |
| Concurrent and live workflows | [M23](#m23--real-time-task-updates-with-socketio) | Authorized live updates and reconnect recovery | M19, M21–M22 |
| Notifications and reporting | [M24](#m24--in-app-notifications) | Notification inbox, unread counts, and links | M18–M19, M23 |
| Notifications and reporting | [M25](#m25--better-task-filtering-and-project-dashboards) | Additional filters and project metrics | M17, M20 |
| Verification and release | [M26](#m26--integration-regression-and-performance-verification) | Stage 1 and Stage 2 release verification | M17–M25 |
| Verification and release | [M27](#m27--documentation-demo-and-stage-2-release) | Fresh-clone check, demo, and release | M26 |

## Phase 1 — Foundation and planning

### M16 — Stage 2 foundation and contracts

**Outcome** A reproducible MVP baseline and enough detail to start sprint management without revisiting approved Stage 1 decisions.

**Evidence** [Stage 1 baseline](engineering-notes/010-m16-baseline.md) · [Stage 2 contracts and M17 acceptance cases](engineering-notes/009-stage2-contracts.md)

**Prerequisites** Stage 1 merged to `main` and tagged `v1.0.0-mvp`.

**Study and understand** API compatibility, project-level permissions, and how database constraints protect business rules when requests overlap.

**Steps to complete**

1. [x] Start the M16 branch. Run the Stage 1 checks and record the results alongside the existing MVP verification record.
2. [x] Map Stage 2 operations to the existing workspace and project roles. Specify permissions for sprint changes, comments, dependencies, archived projects, and socket subscriptions.
3. [x] Outline the REST and Socket.IO contracts, data relationships, and compatibility for existing records and callers. Record which contracts each milestone owns and the failure responses the UI needs.
4. [x] Record scope questions where behavior affects later milestones. Include the sprint rollover policy, notification recipients and timing, and how the project invitation example relates to the implemented workspace invitation flow.

**Verify and test** Confirm the health endpoint and the baseline tests. Walk through the proposed permission matrix with an Owner, a Manager assigned to the project, a Developer, and an authenticated user outside the project.

**Interview questions** How do you evolve an API without breaking existing callers? Which business rules belong in the database, and which belong in the service?

**Done when** The MVP baseline is recorded and M17 has defined rules, data ownership, and test cases.

**Suggested commit** `docs: define stage 2 contracts and acceptance criteria`

### M17 — Sprint management and progress

**Outcome** Authorized team members can plan, start, and complete sprints. They can view progress and move unfinished work to the backlog or a future sprint.

**Evidence** [M17 verification](engineering-notes/011-m17-sprint-verification.md) · [Sprint API](API_REFERENCE.md#sprints) · [Demo](DEMO.md#m17-sprint-walkthrough)

**Prerequisites** M16 and the existing project and task APIs.

**Study and understand** State transitions, partial unique indexes, and transaction boundaries.

**Steps to complete**

1. [x] Define the sprint lifecycle and validate dates and allowed transitions. A sprint record with a project reference and an optional sprint reference on each task is the proposed starting model.
2. [x] Add management operations for creating, starting, and completing sprints, plus adding and removing project tasks. Add sprint list, detail, and progress views for readers.
3. [x] Enforce one active sprint per project. Use a MongoDB constraint that also holds when two managers start different sprints at the same time.
4. [x] Complete a sprint and handle unfinished tasks in one transaction. Define whether a return to backlog changes sprint membership, task status, or both, and how completed sprint progress is preserved after tasks move.
5. [x] Add the sprint UI so users can view unfinished work and choose a rollover target during completion.

**Verify and test** Start two sprints concurrently in one project. Complete a sprint with unfinished tasks and a valid future target, then test a failed rollover and confirm the original sprint and tasks are intact. Check invalid dates, foreign-project tasks, archived-project rules, and tasks created before sprints existed.

**Interview questions** How does the database guarantee a single active sprint? What must be atomic when completing a sprint?

**Done when** A manager can plan, run, and complete a sprint, and a project member can verify its progress.

**Suggested commit** `feat: add sprint lifecycle and progress tracking`

## Phase 2 — Task collaboration

### M18 — Task comments and mentions

**Outcome** Project members can discuss a task, mention eligible project members, and edit or delete their own comments.

**Prerequisites** M16 and the existing task details and project membership checks.

**Study and understand** Resource ownership, safe rendering of user text, and stable pagination.

**Steps to complete**

1. [ ] Define a task-scoped comment, author, body limits, timestamps, and mention references. Validate mention targets against the task's project on the server.
2. [ ] Add comment list, create, edit, and delete operations. Check project access before reading and author ownership before editing or deleting.
3. [ ] Add comment history, composer, and mention selection to the task detail view. Render the comment as text and handle pending, error, and empty states.
4. [ ] Document how a committed mention is identified for M24, including how edited comments affect mentions that were already recorded.

**Verify and test** Use two project members and one outsider. Test creating and editing a comment, rejection of changes by another author, an ineligible mention, and predictable list order across pages.

**Interview questions** Why should the server validate mentions even if the UI filters the picker? How do you protect comment ownership?

**Done when** Authorized users can discuss a task and persisted comments and mentions obey project and author permissions.

**Suggested commit** `feat: add task comments and project member mentions`

### M19 — Task activity history

**Outcome** An authorized reader can see a chronological record of meaningful task changes and who made them.

**Prerequisites** M17–M18 and the existing task write paths.

**Study and understand** Activity records, stable sort order, and atomic persistence of a change and its history.

**Steps to complete**

1. [ ] Define activity records for task creation, assignment, status, priority, sprint movement, and completion. Specify which transitions produce a single record and which record multiple facts.
2. [ ] Write activity from the successful task and sprint operations. Keep a task change and its required history consistent when a write fails, including during sprint rollover.
3. [ ] Define how history references behave when a task is deleted or an actor leaves. Limit the payload to fields the viewer may see.
4. [ ] Add a scoped, paginated activity endpoint and a task timeline that shows the actor, action, and timestamp.

**Verify and test** Perform each documented action. Compare history with the actual result, confirm a failed operation leaves no misleading entry, and check that an outsider cannot load the timeline.

**Interview questions** What fails if the business update and timeline are written independently? How is an activity timeline different from a notification inbox?

**Done when** The timeline reflects committed changes accurately and follows the same access boundary as its task.

**Suggested commit** `feat: record and display task activity history`

### M20 — Task dependencies and cycle detection

**Outcome** Project members can see which tasks are blocked and which tasks they are waiting for. Invalid dependency links are rejected.

**Prerequisites** M16 and the task and activity foundations through M19.

**Study and understand** Directed graphs, graph traversal, and consistency checks under overlapping writes.

**Steps to complete**

1. [ ] Define edge direction consistently. In this guide, `A → B` means A waits for B. Define who may modify links, same-project eligibility, and what counts as a resolved prerequisite.
2. [ ] Implement add, remove, and list operations. Reject invalid endpoints, duplicates, self-links, and edges that close a direct or indirect cycle. To validate `A → B`, search from B for a path back to A.
3. [ ] Protect cycle checks against two simultaneous writes by enforcing the graph check and write under a shared project consistency boundary. Handle dependency cleanup when tasks are deleted.
4. [ ] Show prerequisites, dependent tasks, and blocked status in task details. Use the same definition of blocked in M25 filters and dashboard counts.

**Verify and test** Add `A → B` and `B → C`, then attempt `C → A`. Attempt concurrent reverse links, foreign-project links, and duplicates. Verify what happens when a prerequisite is completed, reopened, or deleted.

**Interview questions** Why is checking just the immediate neighbors insufficient? How could two requests create a cycle if each checked a separate snapshot?

**Done when** The dependency graph remains acyclic under tested concurrent writes and the UI consistently identifies blocked tasks.

**Suggested commit** `feat: add task dependencies and prevent cycles`

## Phase 3 — Concurrent and live workflows

### M21 — Concurrent updates and conflict handling

**Outcome** Stage 2 edits detect stale data and help the user recover without silently overwriting another person's change.

**Prerequisites** M17–M20 and the write contracts mapped in M16.

**Study and understand** Optimistic concurrency, conditional database updates, and conflict recovery.

**Steps to complete**

1. [ ] Define a version for each editable resource covered by the conflict contract. A task version and expected version on task edits and moves are the proposed starting point. Document how a request from a Stage 1 client and a record with no version are handled.
2. [ ] Compare the expected version and save the update atomically. Ensure writers that affect the same versioned resource increment the same version.
3. [ ] Return a documented conflict response. Update the frontend to present the current server state, preserve the user's draft where possible, and let them retry intentionally.
4. [ ] Verify that failed conflicts leave no activity or other side effects. Keep existing ownership and transition checks in the write path.

**Verify and test** Open the same task in two sessions, make a change in one, then save a stale edit in the other. Send two writes with the same version concurrently and confirm that only one succeeds.

**Interview questions** Where must the version check happen to prevent lost updates? What data should be shown to a user whose edit conflicts?

**Done when** The affected workflows have a predictable conflict contract that is verified with both old records and simultaneous updates.

**Suggested commit** `feat: detect stale task updates and recover from conflicts`

### M22 — Drag-and-drop Kanban

**Outcome** Team members can move tasks between writable status columns and recover when the server rejects a move.

**Prerequisites** M21 and the existing Kanban board and task status endpoint.

**Study and understand** Accessible drag-and-drop, optimistic UI, and cache reconciliation.

**Steps to complete**

1. [ ] Add drag-and-drop between status columns. Keep the accessible status control available for keyboard and touch users.
2. [ ] Send the move through the existing status update and permission rules with the expected task version. Document how drops within a single column behave.
3. [ ] Reconcile the board, task details, and lists after a successful move. Restore or refresh confirmed state on network errors, authorization failures, and stale versions.
4. [ ] Verify responsive scrolling, focus, and feedback on mobile and desktop.

**Verify and test** Move an assigned task as a Developer, exercise review and Done with the roles allowed by Stage 1, and try a rejected move and a stale drop. Refresh and compare the board with the task detail. Test the keyboard status control and a narrow screen.

**Interview questions** How do you recover from an optimistic move that the server rejects? Why should drag-and-drop use the same business rules as the status dropdown?

**Done when** Supported moves are usable with a pointer or keyboard and the board matches the saved status after every result.

**Suggested commit** `feat: support accessible Kanban drag and drop`

### M23 — Real-time task updates with Socket.IO

**Outcome** Authorized teammates receive updates for committed task assignments, status changes, Kanban movement, and comments. Reconnecting clients recover current data.

**Prerequisites** M19, M21, and M22, with the underlying REST workflows verified.

**Study and understand** Socket handshakes, membership-scoped rooms, event delivery, and reconnect synchronization. [Socket.IO rooms](https://socket.io/docs/v4/rooms/) · [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)

**Steps to complete**

1. [ ] Attach Socket.IO to the Express HTTP server and wire the frontend through the approved local origin and proxy setup. If these packages are absent, install them from the repository root.

   ```bash
   npm --prefix backend install socket.io
   npm --prefix frontend install socket.io-client
   ```

2. [ ] Reuse authentication for the connection and authorize each project room subscription. Define how a room subscription stops when a user's session or project access is revoked.
3. [ ] Emit a small, documented event after each successful commit. Include only the routing and freshness information needed to update authorized clients.
4. [ ] Invalidate scoped TanStack Query data or apply a newer version where appropriate. Refetch current data after reconnect, and handle duplicate or late events and project navigation.

**Verify and test** Open the same project in two authorized sessions and try assignment, movement, and a comment. Confirm a third session outside the project receives nothing. Disconnect one browser, make changes, and reconnect. Test access removal from a connected browser.

**Interview questions** Why do clients refetch after reconnect even if the server sends events? Where do you verify room access and how do you keep it current?

**Done when** Two authorized sessions converge on the saved state and unauthorized sessions receive no project events.

**Suggested commit** `feat: sync authorized task updates with Socket.IO`

## Phase 4 — Notifications and reporting

### M24 — In-app notifications

**Outcome** Recipients can open an inbox, view unread counts, mark notifications as read, and follow links to related work.

**Prerequisites** M18–M19 for committed activity and M23 for live refresh.

**Study and understand** Recipient scoping, durable notification records, idempotency, and time-based triggers.

**Steps to complete**

1. [ ] Define recipients and deduplication for assignment, mention, approaching deadline, and review. Use the documented M16 mapping for invitations. Stage 1 invitations are workspace-scoped and manually shared, so an inbox entry needs an eligible, identified recipient.
2. [ ] Persist recipient-scoped notifications and read state. Define the deadline window, time handling, and duplicate suppression within the Stage 2 application.
3. [ ] Add inbox list, unread-count, and mark-as-read operations. Validate access to linked tasks and projects when followed and handle inaccessible items safely.
4. [ ] Add the notification indicator and inbox in the Studio UI. Refresh the inbox after reconnect and when a recipient-scoped notification signal arrives.

**Verify and test** Assign a task, mention another member, move a task to review, and exercise the documented deadline and invitation cases. Check the unread count, repeat a triggering operation where safe, and verify read state across sessions. Confirm another user cannot read or modify the item.

**Interview questions** How does an idempotent trigger help when a request is retried? Why does following a notification link require a fresh authorization check?

**Done when** The documented triggers reach eligible recipients and read state survives reloads and disconnects without duplicate entries for the same occurrence.

**Suggested commit** `feat: add durable in-app notifications and unread counts`

### M25 — Better task filtering and project dashboards

**Outcome** Team members can find specific work and see more detailed progress on the project dashboard.

**Prerequisites** M17 for sprint data and M20 for dependency status.

**Study and understand** Compound filters, index selection, aggregation, and consistent definitions of metrics.

**Steps to complete**

1. [ ] Identify supported filter combinations and the expected URL and pagination behavior. Extend the existing task list with sprint and blocked filters as the proposed additions, keeping status, priority, assignee, and search behavior.
2. [ ] Add project dashboard breakdowns for priority and sprint progress. Define how moved, completed, and historical tasks contribute to each figure.
3. [ ] Connect filters and project metrics in the UI using the existing project permissions, loading states, and visual conventions.
4. [ ] Verify query plans with representative fixtures. Add indexes justified by the new queries and record the before and after observations.

**Verify and test** Combine filters, change pages, and reopen a copied URL. Match priority and sprint figures to a seeded project and compare each relevant count with its filtered task list. Check empty projects and an unauthorized user.

**Interview questions** How do compound filters affect which index is useful? How would you prevent the dashboard and filtered task list from disagreeing?

**Done when** The new filters work together and the dashboard figures match the documented definitions and project data.

**Suggested commit** `feat: expand task filters and project dashboard metrics`

## Phase 5 — Verification and release

### M26 — Integration, regression, and performance verification

**Outcome** Evidence that the full collaboration workflow works across users and the existing MVP still passes.

**Prerequisites** M17–M25.

**Study and understand** Integration versus end-to-end testing, race-condition tests, and reproducible measurements.

**Steps to complete**

1. [ ] Check Stage 1 login, password recovery, workspaces, invitations, projects, search, task movement, and existing dashboard behavior.
2. [ ] Add or finish automated coverage for sprint uniqueness and rollback, role and project boundaries, comment ownership, activity consistency, dependency cycles, stale writes, room access, and notification privacy and deduplication.
3. [ ] Run the collaboration journey below with separate user sessions. Cover reconnect, access revocation, and both existing and newly created task records.
4. [ ] Run the full verification commands. Record test counts and measure representative Stage 2 list, dashboard, and collaboration workflows against the baseline with dataset and run conditions documented.
5. [ ] Fix defects found during verification and rerun the affected suites, followed by the full release checks.

**Verify and test** Use the full command table in section B and the collaboration journey below. Verify the test runner discovers every added suite.

**Interview questions** What can a concurrent database test show that a unit test misses? How would you design a reproducible benchmark for a filtered task list?

**Done when** The Stage 1 regression suite and Stage 2 acceptance suite pass, and the verification record includes measurements and any known limitations.

**Suggested commit** `test: verify stage 2 collaboration and regressions`

### M27 — Documentation, demo, and Stage 2 release

**Outcome** A fresh checkout can run and demonstrate the verified Stage 2 release.

**Prerequisites** M26 and the recorded verification results.

**Study and understand** Release reproducibility, backwards-compatible rollout, and how to explain an engineering trade-off in a demo.

**Steps to complete**

1. [ ] Update setup, API and Socket.IO contracts, database and index changes, compatibility notes, and release notes. Explain configuration, test data requirements, and rollout or rollback steps where needed.
2. [ ] Update the demo guide with the collaboration journey and test actors. Rehearse the demo with disposable data and practice explaining the decisions behind it.
3. [ ] Run the final checklist from a fresh checkout using the lockfiles and environment templates. Verify the application works with a fresh database and representative Stage 1 data in an isolated database.
4. [ ] After review and merge, verify the release commit on `main`. Use the agreed Stage 2 tag, with `v1.1.0-collaboration` as a proposed name, and publish release notes for the verified commit.

**Verify and test** Repeat the full command table and the demo using the written instructions. Check the changelog, API references, and release tag against the merged commit.

**Interview questions** How did you verify that a fresh clone and Stage 1 records both work? How would you explain the trade-off between real-time events and the database as the source of truth?

**Done when** A fresh checkout passes, the demo and documentation match the release, and the verified commit is tagged.

**Suggested commit** `docs: prepare stage 2 collaboration release`

## D. Stage 2 acceptance journey

Use an Owner or assigned Manager, two Developers who are project members, and an authenticated user outside the project. Use separate browser contexts so each user has an independent session.

1. A manager creates a sprint, adds two tasks, starts the sprint, and assigns a task to a Developer. The assignee can open the notification from their inbox.
2. The assignee comments and mentions the second Developer. The second Developer sees the comment update and can open the mention from their inbox.
3. The manager adds a dependency between the two tasks. The project shows which task is blocked and rejects a dependency that would create a cycle.
4. The assignee moves a task on the board. Another authorized browser sees the saved result. A stale editor gets a conflict and can recover their draft.
5. Disconnect one authorized browser while work continues. Reconnect and verify that the board, task activity, and notification count reflect current data. Confirm the outsider cannot open the project or subscribe to its updates.
6. Move work through review under the existing permissions. Verify the review notification for its documented recipient, then complete the sprint and carry unfinished work to its chosen destination.
7. Compare the timeline, task filters, and project dashboard with the final sprint and task data.

### Final exit checklist

- [ ] Sprint planning, progress, completion, and rollover passed.
- [ ] Comments, mentions, activity, and notification triggers passed.
- [ ] Dependency cycle prevention and stale-write protection passed under concurrent requests.
- [ ] Keyboard status changes, drag-and-drop, live updates, and reconnect recovery passed.
- [ ] Filters and dashboard metrics matched the documented data and access rules.
- [ ] Stage 1 regressions, Stage 2 suites, fresh-clone instructions, and the demo passed.
- [ ] Release notes and tag identify the verified merged commit.

### Milestone progress log

Use the [Stage 1 progress log template](DevFlow_Stage1_Complete_Milestone_Guide_M0-M15.md#appendix-e--milestone-progress-log-template) for each Stage 2 milestone. Record what you built and studied, commands and results, decisions, limitations, and interview questions you can answer.
