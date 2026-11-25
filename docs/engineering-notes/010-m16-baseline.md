# M16 Stage 1 baseline

Verified on 2026-11-25 from `codex/m16-stage2-foundation`, based on `main` at `d13fe39`. The local branch was created after updating `main` from `origin` and confirming `git merge-base --is-ancestor v1.0.0-mvp HEAD` succeeded. Backend and frontend tracked files match the MVP tag. [M15 release verification](008-mvp-verification.md)

## Test results

Checks used the existing local dependencies, macOS ARM64, Node.js 24.22.0, npm 11.19.1, Vitest 5.1.0, Playwright 1.65.1, and the configured Atlas `devflow_test` database. The database, browser, walkthrough and benchmark fixtures created isolated collections. The first sandboxed run could not listen on localhost or resolve the Atlas SRV record. Network-enabled runs used the existing configuration.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed across 3 suites |
| `npm --prefix backend run test:db` | 48 passed across 7 suites |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend exec -- playwright install --only-shell chromium` | Installed pinned Chromium headless shell v1255 after the initial browser run reported a missing executable |
| `npm --prefix backend run test:e2e` | 3 passed in 55.4 s |
| `npm --prefix backend run test:performance` | Completed all eight operations and five query plan checks |
| `GET /api/health` | 200 with `{"status":"ok"}` on the Atlas-backed Stage 1 test app |

## Permission review

Compared the [M16 permission matrix](009-stage2-contracts.md#project-access-and-write-permissions) with the existing [project access rules](../API_REFERENCE.md#projects-and-dashboard), [task rules](../API_REFERENCE.md#tasks), and [project service](../../backend/src/modules/projects/project.service.ts). M16 defines the sprint, comment, dependency and room outcomes for future implementation. Their runtime acceptance cases belong to the respective milestones.

A four-session HTTP walkthrough against isolated fixtures passed. The Owner read and managed the project without a project roster entry. The assigned Manager added the Developer, approved the task as Done, and edited it after restore. The Developer could read the task and move their assigned work to review, received 403 on a management edit, and lost access after removal. A signed-in workspace member outside the project received 404. While archived, the Developer could still read the task and the Manager received 409 on edit. The fixture created the workspace memberships directly and used the HTTP API for all actions under review.

## API timings

The benchmark used one client, 10,000 synthetic tasks across 24 projects, and 800 tasks in the measured project. Each operation had two warm-ups and 20 measured requests. The run overlapped the end of the permission walkthrough and the browser suite, which used separate collections on the same Atlas deployment. Use these results with that run condition in mind when comparing M26.

| Operation | Median (ms) | p95 (ms) | Maximum (ms) |
| --- | ---: | ---: | ---: |
| List workspace projects | 953 | 1,985 | 2,473 |
| Open project overview | 682 | 1,204 | 1,494 |
| Open task details | 921 | 1,312 | 1,874 |
| Load the first task page | 457 | 701 | 883 |
| Filter tasks by Done | 445 | 576 | 632 |
| Search title and filter priority | 452 | 531 | 1,260 |
| Load dashboard | 457 | 537 | 544 |
| Change task status | 699 | 740 | 1,039 |

All eight p95 values were below two seconds. One project-list sample reached 2,473 ms. The query plans used the expected project creation-order, status, assignee, title-text and ObjectId indexes. [Benchmark source](../../backend/test/performance.ts)
