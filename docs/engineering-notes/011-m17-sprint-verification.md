# M17 sprint management verification

M17 adds project sprint planning, membership, start, completion and progress. The project navigation opens the sprint list and detail. Owners and assigned Managers can change sprints. Project members can read sprint progress and task lists, including in archived projects.

## Implementation decisions

- Sprint writes reuse the workspace revision lock that already protects project archive, task writes and membership changes. This provides the consistency boundary required by M16 without a second lock. Writes in different projects in the same workspace still contend on the workspace record. The partial unique index applies independently to each project.
- Completion saves progress from current membership and moves unfinished tasks in the same transaction. A backlog rollover clears the sprint reference, and a future rollover assigns the destination sprint. Both preserve task status. Completed progress remains fixed when a task is later reopened or deleted.
- The existing paginated task API exposes `sprintId` and a sprint-scoped `unfinished=true` read. This lets the detail view find unfinished tasks before pagination. Tasks created before M17 keep their original assignments and statuses and are treated as unscheduled when the sprint reference is absent.

[API reference](../API_REFERENCE.md#sprints) · [Data model](../DATABASE_DESIGN.md#implemented-in-m17) · [M16 acceptance cases](009-stage2-contracts.md#m17-acceptance-cases)

## Verification

Tested on Node.js 24 with the pinned Chromium build and isolated collections in the configured Atlas test database.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed, including the Stage 1 health contract |
| `npm --prefix backend run test:db` | 52 passed, including 4 new sprint cases |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e` | 4 passed, including the Manager and Developer sprint walkthrough |

The database suite raced two starts in one project and confirmed an independent project could start a sprint. It also raced membership writes and completion against a task status change. A temporary unique index forced the rollover to fail after writes began. The transaction preserved the active sprint and all original memberships, and the retry succeeded after removing the test index. Additional checks exercised invalid dates, archived reads and write rejection, role boundaries, a legacy task, empty progress and a saved snapshot after task changes.

The browser walkthrough exercised sprint creation, task add and remove, start, the unfinished filter, future-sprint rollover and a second-session progress check on a narrow viewport. [Rehearsal steps](../DEMO.md#m17-sprint-walkthrough)
