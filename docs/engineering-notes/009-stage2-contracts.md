# M16 Stage 2 contracts

These contracts specify the behavior to implement in M17–M25. The [Stage 2 guide](../DevFlow_Stage2_Complete_Milestone_Guide_M16-M27.md) assigns the work, the [project scope](../PROJECT_SCOPE.md) defines the features, and the [Stage 1 API reference](../API_REFERENCE.md) defines the existing callers' contract.

## Project access and write permissions

Reuse `projectService.requireAccess` for REST reads and room authorization. A viewer needs current workspace membership plus workspace ownership, assigned management, or explicit project membership. A workspace Manager on the project roster without the manager assignment has member-level permissions for the new workflows. Existing task assignment and status permissions continue to apply.

| Operation | Workspace Owner | Assigned Manager | Developer on project roster | Signed-in outsider |
| --- | --- | --- | --- | --- |
| Read sprints, comments, activity, dependencies and dashboard | Yes | Yes | Yes | 404 |
| Create, start or complete a sprint, or change sprint membership | Yes | Yes | 403 | 404 |
| Post comments and mention eligible users | Yes | Yes | Yes | 404 |
| Edit or delete an existing comment | Own only | Own only | Own only | 404 |
| Add or remove task dependencies | Yes | Yes | 403 | 404 |
| Subscribe to a project room | Yes | Yes | Yes | Denied as `NOT_FOUND` |
| Read or mark personal notifications | Own only | Own only | Own only | Own only |

An outsider includes a workspace member without project access and a member of another workspace. An authorized nonauthor receives `403 FORBIDDEN` on comment changes. Archived projects permit authorized reads and subscriptions. Sprint, comment, dependency and task mutations reject otherwise permitted actors with `409 INVALID_STATE` until the project is restored. The existing authorization for project administration and restore still applies. A recipient may mark their own notifications read even if the linked project is archived or inaccessible.

## Shared REST behavior

Keep the existing `/api/v1` prefix, session cookie, origin and CSRF checks, success and error envelopes, date and ID formats, and pagination defaults. New collections use explicit parent references. Resolve the parent and check access on the server for every request. Use `404 NOT_FOUND` for missing or hidden records, `403 FORBIDDEN` for insufficient action privileges after access is established, and `400 VALIDATION_ERROR` with field details for malformed inputs or an ineligible selection. Return `409 INVALID_STATE` for incompatible lifecycle states. The UI should preserve form input on validation or recoverable conflict, refetch affected views on state conflicts, and clear inaccessible project data after access denial.

| Owner | Proposed route or integration | Data and behavior |
| --- | --- | --- |
| M17 | `GET/POST /projects/:projectId/sprints`, `GET /sprints/:sprintId`, `POST /sprints/:sprintId/start`, `POST /sprints/:sprintId/complete`, `POST/DELETE /sprints/:sprintId/tasks/:taskId` | Project-owned sprint, optional task membership, frozen completion counts. Details below. |
| M18 | `GET/POST /tasks/:taskId/comments`, `PATCH/DELETE /tasks/:taskId/comments/:commentId` | Store task ID, author ID, plain-text body (1–5,000 characters after trimming), distinct `mentionUserIds` (up to 20), and timestamps. Mention targets must have current project access. Return `201` on create, `200` on edit and `204` on delete. List newest first by `createdAt` and ID using the standard paginated envelope. Track newly introduced mentions relative to the previous committed list. Delete comments with their task. |
| M19 | `GET /tasks/:taskId/activity` | Append task ID, actor ID, action, changed fields, and timestamp in the same transaction as the change. Record creation, assignment, priority, status and sprint membership. A transition to `DONE` is one status event with the completion fact. One update can record multiple changed fields. Order newest first by timestamp and ID. Keep history when an actor leaves and display a fallback if their profile cannot be resolved. Delete the timeline with its task under the existing permanent-delete contract. |
| M20 | `GET /tasks/:taskId/dependencies`, `POST/DELETE /tasks/:taskId/dependencies/:prerequisiteId` | Store `projectId`, dependent task ID and prerequisite task ID. Unique directed pair per project. Return prerequisite and dependent summaries and `blocked`. A task is blocked if any direct prerequisite is outside `DONE`. Return `409 DEPENDENCY_CYCLE` for a cycle and `409 DEPENDENCY_EXISTS` for a duplicate. Reject self-links and visible foreign-project endpoints with `400 VALIDATION_ERROR`. Return `404` for inaccessible or missing references. Serialize graph checks, graph writes and incident-edge cleanup on task deletion with a shared project write guard in the same transaction. |
| M21 | Existing `PATCH /tasks/:id` and `PATCH /tasks/:id/status` | Task representation adds `version`, with absent versions read as 0. Accept optional `expectedVersion` and enforce it in the atomic write predicate. Increment the same version for all writers changing versioned task fields, including sprint moves and membership-driven unassignment. Keep Stage 1 writes without a precondition working under the existing rules. M21 adds optional `expectedVersion` as a query parameter on sprint membership routes and applies the same precondition before changing the task. Return `409 STALE_VERSION` on mismatch, then refetch the authorized task and offer intentional retry with the user's draft. A rejected write has no activity, event or notification. |
| M22 | Existing status PATCH | Supply the version from the loaded task. Same-column drops skip the write. Restore confirmed state after a failed move and refresh affected task, list and board queries. Keep the accessible status control. |
| M23 | Socket.IO on the existing HTTP server | Authenticated project subscriptions and post-commit invalidation signals, specified below. |
| M24 | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:notificationId` with `{ read: true }` | Recipient-owned, paginated newest-first inbox. Count returns `{ count }` in `data`. Mark-read is idempotent and returns the updated record, with `404` for another recipient's ID. Store kind, source and occurrence IDs, safe link identifiers, creation timestamp and nullable `readAt`. Uniquely index recipient, kind and occurrence. |
| M25 | Existing `GET /projects/:id/tasks` and `GET /projects/:id/dashboard` | Add optional `sprintId` (same-project ID or `none`) and `blocked` filters combined with existing filters before pagination. Add counts for all four priorities and a sprint progress summary. Priority counts cover current project tasks and sprint progress uses the same definitions as sprint detail. Existing requests without those filters keep their semantics. |

M26 owns cross-milestone regression and performance verification. M27 owns the published Stage 2 API reference, setup and demo. New fields are additive and Stage 1 request bodies remain valid. Missing `sprintId` means no sprint membership and is serialized as `null` when that field ships. Old tasks begin with empty comment, activity and dependency collections. Activity starts with writes after M19 ships. Preserve existing task routes, status transitions, sort order, and defaults. Match sprint, comment and history list indexes to their parent filter and ordering. Create new indexes before enabling writes that rely on them.

## M17 sprint contract

- A sprint belongs to exactly one project. Store `id`, `projectId`, `name`, `startDate`, `endDate`, `status`, `createdAt`, `updatedAt`, nullable `startedAt` and `completedAt`, and nullable `completionSnapshot`. Start and end dates are valid UTC date-only values and the end is on or after the start. Dates describe the plan. Explicit user actions drive lifecycle transitions.
- Create with `{ name, startDate, endDate }`, where the trimmed name is 3–150 characters. Return `201` and a `PLANNED` sprint. Start with no fields and return `200` and the updated `ACTIVE` sprint. Complete an `ACTIVE` sprint with `{ rolloverSprintId: null | ObjectId }` and return `200` and the updated `COMPLETED` sprint. Repeated or out-of-order transitions return `409 INVALID_STATE`.
- Paginate project sprints in descending planned start-date and ID order. Include `progress: { totalTasks, completedTasks, unfinishedTasks, completionPercentage }` on list and detail. For planned and active sprints, calculate from current membership. `DONE` is complete. Round percentages to two decimals and use zero for an empty sprint. Reuse the task list with a sprint-scoped read in M17, with combined filtering taking ownership in M25. Sprint detail uses this read to show unfinished tasks before completion.
- A task has at most one sprint. The M17 membership routes accept empty bodies. Add a same-project task with no sprint to a planned or active sprint and return `200` with the updated task. Repeating an add to its current sprint returns that same state. A task in another sprint returns `409 INVALID_STATE`. Removing from its current planned or active sprint clears `sprintId` and returns `204`. Removing an absent membership returns `404`. A visible foreign-project task is an invalid selection. A hidden or missing task returns `404`. Membership changes preserve task status.
- A partial unique index on `{ projectId: 1 }` for `status: 'ACTIVE'` guarantees one active sprint per project. Map a duplicate caused by this index to `409 ACTIVE_SPRINT_EXISTS`. Use conditional writes for legal transitions. Use the existing workspace membership write lock for authorization consistency and a shared project write guard for project state, sprint state and related task writes. Any competing archive, sprint membership, task status or deletion path that can change the outcome must participate in the same write boundary. Acquire shared guards in a fixed order and retry transient transaction failures against current state.
- At completion, capture counts before moving unfinished tasks. A null target returns unfinished work to the project backlog by clearing `sprintId` and preserving status. Backlog membership here means work outside a sprint. An explicit target must be a different, same-project `PLANNED` sprint with a start date after the source sprint's end date. Move unfinished tasks to that sprint and preserve their statuses. Leave done tasks linked to the completed sprint. Reject direct edits to completed sprint membership. Subsequent Stage 1 task approval, reopening or deletion still follows existing rules and the completed sprint always displays its frozen counts. If a done task is reopened, the existing status workflow remains valid and a change of sprint membership from the completed sprint is deferred for a later scope decision.
- Validate and write the snapshot, all rollover changes and the completed state in one transaction. An invalid selection returns `400 VALIDATION_ERROR`, a target with a conflicting lifecycle state returns `409 INVALID_STATE`, and an inaccessible or missing target returns `404`. A failed completion preserves the source, target and task records.

### M17 acceptance cases

| Scenario | Expected result |
| --- | --- |
| Owner creates and assigned Manager starts and completes while the Developer can view progress | Correct lifecycle, task counts and progress in API and UI |
| Developer, rostered nonassigned Manager and outsider try to write | Developer and rostered Manager receive 403. The outsider receives 404 for reads and writes |
| Archive and restore with an active sprint | Authorized reads work while archived, writes receive 409, and restore allows sprint work to resume |
| Invalid name, calendar date, date order, lifecycle transition, or foreign task | Documented 400, 404 or 409 with original records preserved |
| Start two sprints concurrently for one project, and a third in another project | One start wins in the first project, the loser receives 409, and the other project starts independently |
| Concurrent adds of one unscheduled task to two planned sprints | Exactly one membership is committed |
| Complete to backlog and to an eligible future sprint | Only unfinished work moves, statuses are preserved, and done tasks stay linked |
| Force a failure after rollover writes begin, then retry a valid request | Entire first transaction rolls back. The retry saves one completion and the proper memberships |
| Race completion with a task status or membership write | Snapshot and rollover reflect a valid commit order |
| Load a legacy task with no membership, complete an empty sprint, and reopen or delete a task from a completed sprint | Legacy task remains available, empty progress is zero, and historical counts stay fixed |

Add the M17 database suite to `test:db` and cover role, concurrency and rollback cases against transaction-capable MongoDB. Exercise create through complete in the project UI using separate Manager and Developer sessions.

## M23 live update contract

- Authenticate the handshake with the current HTTP session cookie and validate the configured browser origin. Reject expired or revoked sessions. Keep all business mutations on REST.
- Client events `project:subscribe` and `project:unsubscribe` take `{ projectId }` and acknowledge with `{ data: { projectId } }` or the standard `{ error: { code, message } }` payload. Check project access before joining. Unsubscribe is idempotent for a valid ID and only affects the caller's socket. The server derives room names. A client cannot choose an arbitrary room.
- After commit, emit `project:changed` with `{ eventId, projectId, kind, taskId?, version? }`. Kinds are `task.changed`, `task.deleted`, `comment.changed`, `sprint.changed` and `project.changed`. Assignment and movement use `task.changed`. Include a version when an event refers to an updated versioned task. Keep comment text, user email, and session data out of events.
- Treat a room as a routing aid. Revalidate live sessions and project access before dispatch, evict affected sockets on committed session or access changes, and check expiry even when the socket is idle. Order dispatch authorization and enqueueing against session and project revocations so new events are withheld once access is revoked. A revoked session disconnects. A still-valid socket removed from the project receives a private `project:access-revoked` signal with only `projectId` so the UI can clear state.
- On reconnect, authenticate again, resubscribe to the current project and refetch authorized state. Discard signals for another view, coalesce duplicate invalidations, and avoid replacing newer cached data with older data. An event missed during disconnect is recovered through REST. Unsubscribe when leaving the project.

## Scope decisions for downstream milestones

**Sprint rollover.** Use the M17 policy above for the initial release. Project backlog means no sprint membership and rollover preserves the workflow status. Completed progress is a historical snapshot. Moving a reopened task out of a completed sprint should be revisited if teams need it.

**Notification recipients and timing.** M24 should use the following defaults and confirm the deadline window and review audience during its acceptance review.

| Trigger | Recipient and occurrence |
| --- | --- |
| Assignment | Newly assigned eligible user when the assignee changes. Key by the committed assignment occurrence. Clearing the assignee has no recipient. |
| Mention | Each eligible user newly present in a committed comment revision. Deduplicate by revision and recipient. Unchanged mentions on edit create no new entry. |
| Enter review | Current project manager on each transition into `IN_REVIEW`. Key by the committed transition. An unchanged status creates no entry. |
| Approaching deadline | Current eligible assignee of unfinished work in an unarchived project due from today through the next two UTC calendar days, inclusive. Key by task, due date and recipient. M24 should scan at startup and periodically in the running app, using the unique key across restarts or overlapping scans. Recheck eligibility and due date when persisting. |
| Invitation | Existing account whose normalized email matches the workspace invitation, while the workspace invitation is pending and available. Key by invitation ID. |

Suppress self-notifications on actor-driven events. Persist notifications from committed changes with a durable occurrence identity. For immediate triggers, write the inbox entry with the triggering transaction before publishing any live signal. For deadlines, use an idempotent database insert from the scan. Recheck authorization when listing actionable link data and when the destination loads. If access was removed, keep the recipient's read state and show generic unavailable copy. The optional `notifications:changed` socket signal belongs to the authenticated recipient and prompts the inbox to refetch after commit.

**Workspace invitations and the project invitation example.** Keep the Stage 1 Owner-created workspace invitation and manually shared acceptance URL. Add an informational inbox item only for an account already identified by the invited email at creation. Show generic unavailable copy if the current email no longer matches or the invitation has closed. Continue to share the acceptance URL through the existing workflow and keep its token out of notification storage and socket events. An invitation to an email with no account continues through manual sharing and signup. Once the recipient joins the workspace, the Owner or assigned Manager can add them to the project. The project-specific invitation example would require a separate grant flow and remains a scope decision.

## Permission walkthrough

Use a workspace Owner, an assigned Manager, a rostered Developer, and a signed-in outsider. The Owner can plan and start a sprint even without a project roster entry. The assigned Manager can complete it and update dependencies. The Developer can read progress, subscribe, post a comment, and edit their own comment. Sprint and dependency writes and edits to someone else's comment return `403` for the Developer. The outsider receives `404` for project data and `NOT_FOUND` on subscription, including after joining the workspace without gaining project access. Repeat against an archived project. Authorized reads and subscriptions remain available and collaboration writes return `409` for otherwise permitted actors. Remove the Developer from the project and verify that access is denied even with an existing session. This is a contract walkthrough. The new routes and UI cases are assigned to their implementation milestones.

## Interview notes

Add fields and optional parameters to existing endpoints, preserve defaults and response envelopes, and define how legacy records are read before compatible changes ship. Existing clients can keep sending their current payloads. A new client can opt into conflict detection by supplying the version it read.

Use indexes for invariants MongoDB can enforce across all writers, such as one active sprint per project and unique directed dependency edges. The service handles authorization, date rules, graph traversal, rollover and error translation. Conditional writes and transactions enforce those decisions against concurrent changes and commit related state together.
