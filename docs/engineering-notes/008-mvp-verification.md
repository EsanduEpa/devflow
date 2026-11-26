# M15 MVP verification

Verified on 2026-11-22 from a separate GitHub clone of `main` at `9b61900`, the merged Studio UI and Stage 1 application base. The checkout used the M15 setup instructions and API reference with the application source and lockfiles from that commit.

## Environment and fresh setup

macOS 26.6.2 on ARM64, Node.js 24.22.0, npm 11.19.1, Vitest 5.1.0, Playwright 1.65.1 with its pinned Chromium headless build, and MongoDB Atlas. Both `npm ci` commands completed from the committed lockfiles. The npm audit checks during install reported zero advisories. The two environment templates were copied into ignored local files, and a new CSRF signing key was generated for the clone.

The normal API port was occupied, so startup used the README’s alternate-port settings with Express on `3300` and Vite on `55173`. Direct Express health, Vite-proxied health, and the `/login` HTML and frontend module response passed. The authenticated, write, and browser workflows used temporary collections in `devflow_test`. The recovery integration test used a local SMTP fixture.

## Test results

| Check | Result |
| --- | --- |
| Backend type checking and build | Passed |
| Frontend production build and lint | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 48 passed |
| `npm --prefix backend run test:e2e` | 3 passed |
| Supplemental Chromium board check | All 23 tasks displayed across two API pages |
| Route declarations, API reference, and successful HTTP calls | 34 of 34 agree |

For the route check, a temporary observer on the local test HTTP server recorded the method, normalized path, and response status only. The database suite exercised all 34 documented routes with their respective success statuses, including 21 `200`, six `201`, one `202`, and six `204` responses. The test suites independently assert response shapes, permissions, error cases, and rollback behavior. [Implemented API reference](../API_REFERENCE.md) · [Stage 1 regression coverage](006-stage1-verification.md)

## Acceptance walkthrough

| SRS acceptance cases | Verified behavior |
| --- | --- |
| AT-01–07 | Registration and duplicate rejection, valid and invalid login, logout and revocation, profile changes, password changes, and single-use recovery. |
| AT-08–15 | Workspace creation and Owner role, invitation acceptance, private workspace denial, project creation and membership, project access denial, updates, and archive and restore. |
| AT-16–22 | Task creation and eligible assignment, ineligible assignment rejection, status changes, Developer approval restrictions, delete permissions, and project-scoped search and filtering. |
| AT-23–25 | Five board columns, confirmed status updates and failed-write recovery, paginated task loading, and correct dashboard counts and percentages. |
| AT-26–28 | Authentication and CSRF checks, invalid request responses, and cross-workspace access restrictions. |

Playwright also exercised Studio theme persistence, keyboard focus, workspace switching, direct task links, and desktop and mobile task panels. The supplemental check used a 23-task fixture at a mobile width. It verified all five columns, found a task beyond the first API page, and restored all 23 cards after clearing the filter. The suites used synthetic users, workspaces, and tasks. [SRS cases](../SRS.md#15-mvp-acceptance-tests) · [Browser workflow](../../backend/e2e/stage1.e2e.ts)

## API timings

`npm --prefix backend run test:performance` passed with 10,000 synthetic tasks across 24 projects. After two warmups per operation, each of eight operations was timed for 20 single-client requests. The eight p95 values ranged from 519 to 992 ms. The slowest observed request was a task status update at 1,152 ms. All observations met the approximate two-second Stage 1 target in this environment. The query plans used the expected project creation-order, status, assignee, title-text, and ObjectId indexes. [Benchmark and query plan details](006-stage1-verification.md#api-timings-and-query-plans)

## Release review

Reviewed the direct dependencies and entry points for Stage 1 usage. The release base contains the six planning documents and the Studio specification. The tracked environment files are the example templates. A scan for common credential patterns matched a synthetic MongoDB URI in the error-sanitization test.

The Stage 1 release uses the annotated `v1.0.0-mvp` tag. [Stage 1 release notes](../RELEASE_NOTES.md#stage-1-mvp--v100-mvp)
