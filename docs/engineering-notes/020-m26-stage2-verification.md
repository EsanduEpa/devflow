# M26 Stage 2 verification

Verified on 2026-11-26 from a branch based on merged M25 commit `319aac7`. Tests used Node.js 24.22.0, npm 11.19.1, Vitest 5.1.0 and Playwright 1.65.1 with its pinned Chromium headless shell on macOS arm64. Database, browser and performance runs used isolated collections in the configured Atlas `devflow_test` database.

## Release checks

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed in 3 files |
| `npm --prefix backend run test:db` | 74 passed in 14 files |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend exec -- playwright install --only-shell chromium` | Pinned browser available |
| `npm --prefix backend run test:e2e -- --workers=3` | 13 passed in 10 files in 3.1 minutes |
| `npm --prefix backend run test:performance` | 11 operations and 11 execution plans measured |
| `GET /api/health` | 200 with `{"status":"ok"}` |

The database command registers every database test file. Playwright’s `test --list` discovered all ten browser files, including the new collaboration journey. The final full suite ran after the revocation regression passed with the fix.

## Acceptance coverage

| Area | Evidence |
| --- | --- |
| Stage 1 regression | The unit, database and browser suites cover login, password reset, workspaces, invitations, project access, task search and movement, and the original dashboard counts. |
| Sprint rules | The database sprint suite checks concurrent starts and membership, rollback on failed rollover, permission and archive boundaries, and stable completion snapshots. |
| Comments, mentions and activity | The comment and activity suites check author ownership, eligible mentions and history written in the same transaction as the underlying change. |
| Dependency and write conflicts | The database suites exercise concurrent reverse dependency links, deletion racing a link, and concurrent writes with the same task version. Chromium checks draft recovery. |
| Live updates and notification privacy | Database suites check authentication, project room access, revocation, recipient isolation, idempotent read state and deadline deduplication. Chromium checks reconnect, popover behavior and link redaction. |
| Filters and reporting | The sprint database and browser suites compare task list totals, priority counts, live sprint progress and historical snapshots. |

The [four-session Chromium journey](../../backend/e2e/collaboration.e2e.ts) uses an Owner acting as the assigned Manager, two project Developers and a workspace member outside the project. It starts with a Stage 1 task missing version and sprint fields and a newly created task. The journey checks sprint planning, assignment and mention links, blocked work and cycle rejection, a board move, deliberate recovery of a stale draft, reconnect catch-up for the board, activity and inbox, denied HTTP and room access, review, rollover, final figures and a revoked reader’s inbox.

## Revocation ordering

A user’s REST refetch can observe lost membership before the authorized socket session receives the revocation message. The shell used to leave the subscription when the project query changed to an error, so it could ignore the delayed message and leave an error inside the task drawer. The shell now retains the last authorized subscription scope through refetch errors. The project-level revocation handler then clears the drawer and project cache. The browser regression holds back the live message until REST has returned the denial, then checks that the project-level alert appears and the drawer closes.

## Performance comparison

The benchmark uses two warm-ups and 20 sequential samples per operation. It seeds 24 projects, 10,000 tasks, 2,500 dependency edges and an active sprint. The measured project contains 800 tasks. The legacy operations use the same task population and request patterns as the [M16 baseline](010-m16-baseline.md#api-timings). The collaboration measurements include the mutation, authenticated socket event and a second session’s REST refresh with an assertion on the returned data. They measure end-to-end API and event delivery without browser rendering.

| Operation | M16 median / p95 (ms) | M26 median / p95 (ms) | M26 max (ms) |
| --- | ---: | ---: | ---: |
| List workspace projects | 953 / 1,985 | 596 / 1,509 | 1,792 |
| Open project overview | 682 / 1,204 | 533 / 1,069 | 1,372 |
| Open task details | 921 / 1,312 | 736 / 1,490 | 1,840 |
| Load the first task page | 457 / 701 | 728 / 1,614 | 2,549 |
| Filter tasks by Done | 445 / 576 | 683 / 962 | 1,144 |
| Search title and filter priority | 452 / 531 | 606 / 1,006 | 1,014 |
| Load dashboard | 457 / 537 | 919 / 1,244 | 1,580 |
| Change task status | 699 / 740 | 1,484 / 1,877 | 2,123 |
| Filter by sprint, status and blocked | — | 673 / 1,067 | 1,143 |
| Move task, receive project signal and refresh task list | — | 1,800 / 2,465 | 4,030 |
| Post mention, receive private signal and refresh inbox | — | 2,589 / 4,930 | 5,259 |

Both runs shared Atlas capacity with other isolated tests, and measurements were taken on different days. The comparison is observational and includes network, application and database latency. The collaboration cases measure API latency with one live observer in one project. Mention delivery and inbox refresh had the longest tail in this run.

The eleven execution plans reproduced the M25 index choices. For sprint, status and blocked, the sprint index examined 267 task documents versus 800 with the general project index. The dependency lookup examined 100 further documents through `unique_project_dependency_pair` and `_id_`, with zero collection scans. The dashboard priority breakdown used the same 800-document project scan as the legacy totals. [M25 query-plan details](019-m25-filters-dashboard-verification.md#query-plans)
