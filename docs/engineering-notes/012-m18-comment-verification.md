# M18 task comments and mentions

Project members can read and post comments from task details or the task drawer. The composer stores a text body and explicit mention selections. The selector and write validation use the same project access query, which includes the workspace Owner and assigned Manager even if they lack a roster row. The server also checks the task’s project on every request. Edit and delete require the current author, and archived discussions are read-only. Names and bodies render as text.

## Mention occurrences for M24

- A successful create starts at revision 1. Each subsequent successful edit increments the revision in the same transaction that changes the body and mention set.
- A revision’s introduced recipients are the new mention IDs minus the immediately preceding committed set. All selected IDs count as introduced on create. Editing only the body, reordering IDs, retaining a mention, or dropping one introduces no recipient. Removing a mention and adding it in a later revision creates a new occurrence.
- Use the tuple `(commentId, revision, recipientId)` as the occurrence identity. M24 can persist notifications from `introducedMentionUserIds` for that specific revision inside the comment write transaction, with self-notification suppression and a unique recipient/occurrence key. Publish any inbox refresh after commit. A failed edit or rolled-back transaction produces no occurrence.
- Each comment stores the current revision’s delta. Earlier deltas are represented by the notification records when M24 adds them. Use this internal delta only during the write that produces it.
- A mention recipient must have project access at the time of the write. The author can remove a revoked recipient on a subsequent edit. Historical comments keep their references, and M24 should recheck access before showing actionable destinations. Task deletion removes its comments atomically.

[API reference](../API_REFERENCE.md#task-comments) · [Data model](../DATABASE_DESIGN.md#implemented-in-m18) · [Demo](../DEMO.md#m18-comments-walkthrough)

## Verification

The suites used Node.js 24, the pinned Chromium build and isolated Atlas test collections.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 55 passed, including the 3 comment integration cases |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e` | 5 passed, including the M18 walkthrough |

The comment integration tests covered membership and author checks, malformed input, archive rules, invalid and revoked recipients, revision deltas, deterministic pagination with tied timestamps, and concurrent commenting during task deletion. The browser walkthrough used two project members and a signed-in outsider. It exercised the drawer and a narrow task-detail view, literal markup rendering, mention selection, a reply, and author edits and deletion.
