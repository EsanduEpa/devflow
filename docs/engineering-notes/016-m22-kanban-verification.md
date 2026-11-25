# M22 Kanban drag-and-drop

Fine-pointer users can move eligible cards by their drag grip. Writable columns highlight during a drag, and the horizontal board scrolls at its edges. Keyboard and touch users can move cards with the **Move to** dropdown. After a keyboard move, focus follows the task’s control or returns to the board if the current filter hides the task.

## Implementation decisions

- Both controls use the same role and destination rules and the existing versioned task status PATCH. Owners and assigned Managers can approve Done and reopen Done tasks. Assigned Developers can move their unfinished tasks through review. Same-column drops skip the write and preserve the card order.
- A pending drop uses a board-local preview. Dropdown moves change columns when the save is confirmed. A successful response updates the task detail cache and visible board rows, then refreshes board, list, dashboard and related task views. A status filter can hide a moved card until that filter matches its status again.
- When a move fails, the preview is discarded and the board refreshes from the server. A stale move can be retried explicitly against the latest task when its destination is still available. Access failures refresh permissions, and network failures show an error while the confirmed board remains available.

[Manual walkthrough](../DEMO.md#m22-kanban-walkthrough) · [Status API](../API_REFERENCE.md#tasks)

## Verification

Checks used Node.js 24, the configured Atlas test database with isolated collections, and Playwright’s pinned Chromium build.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 65 passed |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e` | All 10 passed on the final implementation, including 2 Kanban cases |

The focused Chromium cases verified native pointer drops, same-column and forbidden drop behavior, the expected version on requests, keyboard focus transfer, the narrow touch layout, and recovery from network failure, stale state and permission changes. The first keyboard assertion used Arrow Down alone. The revised walkthrough uses Chromium’s native type-ahead and Enter sequence. The first full suite found that a dropdown preview could appear before another session could read the saved state. The dropdown now moves the card on confirmation, and the original invited Developer workflow passed on rerun.

Supplemental Chromium checks used a 1024px viewport to verify horizontal scrolling during a native drag and confirmed that Escape kept the task in Backlog. A separate status-filtered board check moved a task out of the visible result set, confirmed focus returned to the board, and verified the saved status in Task list.
