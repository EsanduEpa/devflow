# M20 task dependencies

Task details and the task drawer display prerequisites, dependents, and a Blocked badge. Workspace Owners and assigned Managers can manage prerequisites in editable projects. Current project readers can inspect related tasks, including in archived projects.

## Implementation decisions

- A → B means A waits for B. Both endpoints must belong to the same project. A unique index protects the directed pair. An iterative traversal checks whether B can already reach A, including through intermediate tasks. Building the adjacency map and searching the graph take linear time in the project’s vertices and edges.
- Graph changes reuse the workspace write lock shared by task deletion, project archive and access changes. Even reverse writes that change different edge documents conflict on that common record. The retried transaction checks the graph again before committing. Task deletion clears both directions in the same transaction.
- A task is blocked when any direct prerequisite is outside Done. Reopening a prerequisite can block its dependents again. This calculation uses current task statuses and the shared `resolvedPrerequisiteStatus` constant for M25 filtering and counts. The badge describes dependency state. Task status transitions continue through the existing workflow.

[Dependencies API](../API_REFERENCE.md#task-dependencies) · [Data model](../DATABASE_DESIGN.md#implemented-in-m20) · [Manual walkthrough](../DEMO.md#m20-dependency-walkthrough)

## Verification

Checks used Node.js 24, isolated collections in the configured Atlas test database, and Playwright’s pinned Chromium build.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 62 passed, including 4 dependency integration cases |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e` | 7 passed, including the M20 dependency walkthrough |

The database suite covered project and role boundaries, archive rules, invalid endpoints, uniqueness, a three-task cycle, concurrent reverse links, and blocked state after completing and reopening a prerequisite. It also forced edge cleanup to fail and verified the task was restored by rollback. A concurrent add and delete left no orphaned edge.

The browser walkthrough exercised searching for a prerequisite, both relationship views, cycle feedback, badge changes after completion and reopening, and link removal. A Developer verified the read-only view at a narrow viewport.
