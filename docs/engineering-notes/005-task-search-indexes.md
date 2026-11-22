# Task search query plans

M12 lists tasks for one authorized project. The API accepts `search`, `status`, `priority`, `assigneeId`, `page`, and `limit`. A full ObjectId matches the task ID. Other search input uses MongoDB title words. A search term and any selected filters must all match. Within a multiword title search, MongoDB can match any of the supplied words. [MongoDB text search in aggregation](https://www.mongodb.com/docs/manual/tutorial/text-search-in-aggregation/)

Every query matches the project first, sorts by descending `createdAt` and `_id`, and uses `$facet` to return the requested page and count all matches in one operation. The `_id` tie-breaker gives tasks with the same creation time a stable order. The existing compound text index starts with `projectId`, which MongoDB requires as an equality match to use the text portion of this index. [MongoDB compound text index restrictions](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/text-index-restrictions/)

## Measurements

Ran `explain('executionStats')` on the API aggregation for page 1 with a 20-task limit on MongoDB Atlas. An isolated collection used the production task indexes and held 10,000 synthetic tasks across 24 projects, with 800 tasks in the selected project. The table shows the winning index and the cursor's execution statistics. The fixture was removed after the run.

| Query | Winning index | Keys examined | Documents examined | Total matches | Explicit sort |
| --- | --- | ---: | ---: | ---: | --- |
| Default list | `projectId_1_createdAt_-1__id_-1` | 800 | 800 | 800 | No |
| Done status | `projectId_1_status_1` | 50 | 50 | 50 | Yes |
| Urgent priority | `projectId_1_priority_1` | 73 | 73 | 73 | Yes |
| Specific assignee | `projectId_1_assigneeId_1` | 115 | 115 | 115 | Yes |
| Unassigned | `projectId_1_createdAt_-1__id_-1` | 800 | 800 | 685 | No |
| Title word `release` | `projectId_1_title_text` | 80 | 80 | 80 | Yes |
| Title word `release`, Done, Urgent | `projectId_1_title_text` | 80 | 160 | 1 | Yes |
| Full task ID | `_id_` | 1 | 1 | 1 | Yes |

- The default list read the selected project's 800 records in index order. The exact total requires processing all matches even when the response contains only the first 20 tasks.
- The status, priority, and specific assignee indexes narrowed the candidate set before sorting. With 685 of 800 tasks unassigned, MongoDB chose the index that already provides creation order and checked the assignee field on that scan.
- The text index scoped title candidates to the selected project. When combined with status and priority, MongoDB applied those filters to the title candidates and reported 160 document examinations for 80 index keys.
- A separate query scoped by project and ordered by due date used `projectId_1_dueDate_1`. The M12 list keeps its newest-first ordering.

The measurements support keeping the existing indexes. Query plans depend on how common each filter value is. Additional indexes would consume storage and need maintenance when tasks are written.
