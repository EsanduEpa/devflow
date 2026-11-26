# M25 task filters and dashboard

Task filters combine sprint, dependency status, status, priority, assignee and search before the results and total are paginated. `sprintId=none` includes legacy tasks with no stored sprint ID. `blocked=true` requires at least one direct prerequisite outside Done. `blocked=false` includes tasks with no prerequisites and tasks whose prerequisites are all Done. Search and result ordering retain their existing behavior. Applying filters starts at page one, and page navigation keeps all applied values in the URL.

The dashboard counts every current project task in its priority, including done and unscheduled work. Priority totals link to the corresponding task list. Sprint progress shows up to five sprints with the active sprint first and remaining sprints ordered by planned start date and ID. Planned and active sprints use current membership and Done status. Unfinished tasks moved during rollover appear in the receiving sprint or under **No sprint**. Completed sprints keep the totals saved before rollover, even if a task is later reopened or deleted. The dashboard labels these figures **at completion**. Current sprint task links open the matching task list.

[API reference](../API_REFERENCE.md#projects-and-dashboard) · [Manual walkthrough](../DEMO.md#m25-task-filters-and-project-dashboard-walkthrough)

## Query plans

`npm --prefix backend run test:performance` used Node.js 24.22.0 on macOS arm64 and isolated Atlas collections. The fixture seeded 24 projects, 10,000 tasks, 2,500 dependencies and an active sprint in the measured project, which contained 800 tasks. The table compares execution stats on the same fixture.

| Query | Task cursor index | Task keys / documents examined | Lookup keys / documents examined |
| --- | --- | --- | --- |
| Sprint and status before the blocked condition | `projectId_1_sprintId_1_createdAt_-1__id_-1` | 267 / 267 | — |
| Sprint, status and blocked | `projectId_1_sprintId_1_createdAt_-1__id_-1` | 267 / 267 | 100 / 100 |
| Same combined query forced to use the general project sort index | `projectId_1_createdAt_-1__id_-1` | 800 / 800 | 100 / 100 |
| Blocked across the project | `projectId_1_createdAt_-1__id_-1` | 800 / 800 | 400 / 400 |
| Project totals before priority counts | `projectId_1_status_1` | 800 / 800 | — |
| Project totals with priority counts | `projectId_1_status_1` | 800 / 800 | — |

The dependency lookup used `unique_project_dependency_pair` and `_id_`, with zero collection scans. The sprint-specific index cut the combined query’s task cursor work by two thirds compared with the general project sort index. Priority counts used the same project scan as the original dashboard totals. The existing indexes support these access patterns. The combined filter took 634 ms median and 862 ms p95 end to end. The dashboard took 533 ms median and 1,080 ms p95. Each endpoint had two warmups and 20 observations while other isolated test suites were running against the same Atlas deployment.

## Verification

| Check | Result |
| --- | --- |
| Backend unit tests | 15 passed |
| Backend database integration tests | 74 passed |
| Chromium sprint and M25 walkthrough | 1 passed |
| Chromium Stage 1 regression scenarios | 3 passed |
| Backend type check and build | Passed |
| Frontend lint and build | Passed |

Database coverage checked combined filters before pagination, both blocked states, a foreign sprint, unauthorized project access, zeros for an empty dashboard, priority totals against their filtered list, live sprint counts after rollover, and historical counts after a completed task was reopened and deleted. Chromium verified filter selection, copied URLs, page reset on apply, dashboard links, and the historical progress label.
