# M19 task activity history

Task details and the task drawer display activity as a newest-first timeline with the actor, action, timestamp and tracked changes. Access follows the same rules as task details, including authorized reads while archived.

## Implementation decisions

- Create records a single entry with the initial status, priority, and assignment when present. Task updates group all changed tracked fields for that task into one entry. A transition into Done is a status change marked as a completion. Reopening remains a status change. Identical values and edits to title, description or due date add no entry.
- Sprint membership changes, sprint rollover and membership-driven unassignment record the affected task’s before-and-after facts. Rollover records moved tasks, and tasks that stay in the sprint retain their existing timeline. Every event write uses the transaction for the change.
- The timeline records history from deployment onward. Former members’ entries remain attached to the task. If a profile is unavailable, the UI shows a fallback. A permanent task deletion removes its history in the same transaction.
- The timeline is task-scoped shared history. A notification inbox is recipient-scoped and tracks what each recipient has read.

[Activity API](../API_REFERENCE.md#task-activity) · [Data model](../DATABASE_DESIGN.md#implemented-in-m19) · [Manual walkthrough](../DEMO.md#m19-activity-walkthrough)

## Verification

Checks used Node.js 24, isolated collections in the configured Atlas test database, and Playwright’s pinned Chromium build.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 58 passed, including 3 activity integration cases |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e` | 6 passed, including the M19 walkthrough |

The database suite compared task state with the saved record, checked that a rejected or no-op mutation produced no entry, and verified paging with tied timestamps. It exercised archived reads, outsider denial, a legacy task, actor departure, and task deletion. A temporary unique index rejected an activity insert during an ordinary update and during sprint rollover. Both operations rolled back. After the index was removed, rollover saved its task changes and activity together.

The browser walkthrough verified actor names, timestamps, priority and status transitions, and one completion entry. It exercised the narrow task page and the board’s task drawer.
