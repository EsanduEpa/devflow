# Stage 1 verification

M14 compared the existing backend suites with the SRS and API acceptance criteria, then added coverage for the gaps below. [SRS acceptance tests](../SRS.md#15-mvp-acceptance-tests) · [API acceptance matrix](../API_DESIGN.md#175-api-acceptance-test-matrix)

| Area | Acceptance coverage | Verification |
| --- | --- | --- |
| Accounts and sessions | AT-01–07, API-01–10 | Registration, duplicate email, login, logout, session expiry and rotation, replay after logout, profile changes, password changes, and single-use password reset. |
| Workspace and project access | AT-08–15, AT-28, API-11–22 | Owner, assigned Manager, unassigned Manager, Developer, and nonmember access. Known workspace and project IDs remain subject to membership checks. Includes manager reassignment and downgrade, duplicate membership and invitations, and double acceptance. |
| Task rules and progress | AT-16–25, API-23–33 | Assignment eligibility, search and paging, removal cleanup that preserves tasks, archived project restrictions, Developer review and manager approval, and current dashboard counts. |
| Request and transaction safety | AT-26–27, API-34–35 | Missing and mismatched CSRF tokens on all 21 write routes, invalid IDs and request fields, malformed JSON, safe error payloads and logs, and rollback for workspace creation, invitation acceptance, manager changes, and member removal. |

The Playwright suite follows an Owner and an invited Developer in separate browser sessions. It covers registration through dashboard completion, project access before and after membership, keyboard focus and required fields, modal keyboard behavior, and loading, error, retry, and empty states on the board. At 390, 768, and 1440 pixels, the board and dashboard fit the page width. The board can scroll within its own region when the columns need more space.

The dashboard unit tests fix the clock at the UTC day boundary and verify rounding and the access check. `npm audit` reported zero advisories for both lockfiles during this review.

## API timings and query plans

Run `npm --prefix backend run test:performance` from the repository root. The fixture uses the production routes and indexes with 10,000 synthetic tasks across 24 projects in `devflow_test`, including 800 tasks in the measured project. It uses one signed-in HTTP client against a loopback Express server with MongoDB Atlas. Each operation gets two warmup requests and 20 sequential timed requests. The reported p95 is the 19th observation after sorting each operation’s sample.

Measured on macOS 26.6.2 on ARM64 with Node.js 24.22.0. All requests in this run finished within the milestone’s approximately two-second target. The slowest single response was 1,173 ms for the dashboard.

| Request | Median (ms) | p95 (ms) | Max (ms) |
| --- | ---: | ---: | ---: |
| List workspace projects | 518 | 549 | 823 |
| Open project overview | 517 | 542 | 810 |
| Open task details | 621 | 641 | 957 |
| Load the first task page | 626 | 638 | 639 |
| Filter tasks by Done | 634 | 702 | 925 |
| Search title and filter priority | 606 | 630 | 659 |
| Load dashboard | 591 | 625 | 1,173 |
| Change task status | 882 | 918 | 923 |

MongoDB `explain('executionStats')` on the actual task list aggregation showed the following winning plans.

| Query | Winning index | Keys examined | Documents examined |
| --- | --- | ---: | ---: |
| Default task page | `projectId_1_createdAt_-1__id_-1` | 800 | 800 |
| Done filter | `projectId_1_status_1` | 50 | 50 |
| Specific assignee | `projectId_1_assigneeId_1` | 115 | 115 |
| Title word and Urgent priority | `projectId_1_title_text` | 80 | 160 |
| Exact task ID | `_id_` | 1 | 1 |

The default page reads the project's 800 records to compute the exact total. The status and assignee indexes narrow the records examined, and the text index narrows candidates to matches within the project before the priority check. The measurements support keeping the existing indexes. [M12 query plan notes](005-task-search-indexes.md)
