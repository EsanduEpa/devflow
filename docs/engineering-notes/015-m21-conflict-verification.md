# M21 task conflict handling

The conflict contract covers task detail edits, status moves, and direct sprint membership changes. The React client sends the version from the state on which its action was based. The API exposes `version` on tasks and returns `409 STALE_VERSION` when a permitted conditional write is stale.

## Implementation decisions

- New tasks start at version zero. A missing field on a legacy task reads as zero and matches the same atomic predicate. Existing clients can omit the precondition. Accepted edit and status PATCH requests increment the version, including accepted patches with identical values. Those identical patches still produce no activity entry.
- The write predicate checks the version and increments it with the field update. Sprint add and remove, rollover, and unassignment during project or workspace member removal use the same version. An idempotent sprint add at the current version returns the existing state. The shared transaction and workspace write lock keep permission and lifecycle checks consistent with the write.
- A conflict response uses the existing error envelope. The UI refetches the task through its authorized detail endpoint. It keeps the editor’s original baseline so a retry sends only fields the user edited. The user can explicitly retry against the reviewed version or replace the draft with the latest values. A second conflict repeats the same recovery flow.
- Status and sprint conflicts preserve the attempted action, show the saved state, and offer retry when the action is still available. A stale failure commits neither task state nor activity.

[Task API](../API_REFERENCE.md#task-write-conflicts) · [Data model](../DATABASE_DESIGN.md#implemented-in-m21) · [Manual walkthrough](../DEMO.md#m21-conflict-walkthrough)

## Verification

Checks used Node.js 24, isolated collections in the configured Atlas test database, and Playwright’s pinned Chromium build.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 65 passed, including 3 conflict integration cases |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e` | All 7 existing browser workflows passed. The new test’s description-field locator timed out on the first run |
| `npm --prefix backend run test:e2e -- task-conflicts.e2e.ts` | Passed after correcting the test locator |

The database tests covered a missing version, an older client, invalid preconditions, stale edit and status requests, simultaneous writes with the same version, existing permissions, sprint membership checks and rollover, and both scopes of membership-driven unassignment. The rejected writes left the task and its activity unchanged.

The two-session browser walkthrough confirmed that a conflicting draft remained editable, an intentional retry applied the draft while retaining the other user’s priority change, and status and sprint membership changes could be retried against the reviewed version.
