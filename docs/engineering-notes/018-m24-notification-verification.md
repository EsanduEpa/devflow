# M24 in-app notifications

The Studio header bell shows the unread count and opens the inbox over the current page. Recipients can mark individual items as read. The inbox rechecks task access and invitation availability before returning link details.

## Triggers and deduplication

| Kind | Recipient | Occurrence |
| --- | --- | --- |
| Assignment | The newly assigned eligible user | Task ID and committed task version when the assignee changes, including initial assignment |
| Mention | Each newly mentioned eligible user | Comment ID and revision |
| Review | The current assigned project Manager | Task ID and committed version on entering `IN_REVIEW`, including creation in that status |
| Deadline | The current eligible assignee of an unfinished task in an unarchived project | Task ID, UTC due date and recipient |
| Invitation | An existing account matching the invited email at creation | Workspace invitation ID |

Actor-driven triggers suppress self-notifications. Repeating an unchanged assignment, mention or review status adds no item. Reintroducing a mention in a later revision or reentering review creates a new occurrence. Immediate notifications write in the same transaction as their source. Each successful insertion is idempotent under the recipient, kind and occurrence index.

The API process scans deadlines at startup and every 15 minutes. The window covers today and the next two UTC calendar days. Eligibility is checked again under the workspace write lock before insertion. Duplicate scans and restarts preserve the existing reminder and its read state.

The original invitation flow remains the way to accept a workspace invitation. The inbox stores the invitation reference and displays the workspace name while the invitation is available to the recipient’s current email. Acceptance tokens remain in the existing manual link workflow.

An authenticated account uses one socket across signed-in views. A payload-free recipient signal triggers inbox refresh. Reconnection reloads through REST. Related task links still require current project access. Read timestamps survive logout, reload and loss of project access.

[Notification API](../API_REFERENCE.md#notifications) · [Data model](../DATABASE_DESIGN.md#implemented-in-m24) · [Manual walkthrough](../DEMO.md#m24-notifications-walkthrough)

## Verification

Checks used Node.js 24, isolated collections in the configured Atlas test database, and Playwright’s pinned Chromium build.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 72 passed |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e -- --workers=3` | 12 passed |

The database tests verified all five triggers, duplicate suppression during overlapping deadline scans, rollback with the source transaction, recipient-scoped reads and updates, and invitation token privacy. A final run of the invitation and notification suites passed all nine tests, including the private socket signal check. The browser walkthrough verified badge refresh outside a project room, cross-session read state, reconnect recovery, review delivery and redaction after access removal.

The focused Chromium scenario also verifies that the popover leaves the URL unchanged, fits a 390-pixel viewport, restores focus to the bell after Escape, closes on an outside click, and closes when a task link opens.
