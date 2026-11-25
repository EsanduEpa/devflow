# DevFlow MVP demo

Allow about eight minutes. Start both apps using the [local setup guide](../README.md#run-locally). Prepare two fictional accounts such as `owner@example.test` and `developer@example.test` in separate browser sessions. Use locally chosen passwords and an empty workspace named **Release workshop**.

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:50 | Log in as the Owner and open **Release workshop**. | Workspace roles decide which management actions are available. Login uses a server-side session cookie. |
| 0:50–2:00 | Create a Developer invitation in **Workspace settings**. Open its link and accept it in the Developer’s browser session. | The invitation is tied to an email address. Acceptance creates membership and closes the link together. |
| 2:00–3:10 | As Owner, create a project and check its empty **Dashboard**. Add the Developer under **Project settings**. | Workspace and project memberships are separate. The assigned Manager can manage the project. |
| 3:10–4:10 | Create **Review the release checklist**, assign it to the Developer, and set its due date to yesterday in UTC. | An assignee must be in the project. The dashboard derives overdue and completion counts from current task records. |
| 4:10–5:30 | As the Developer, open the board and move the task to **In Progress** and then **In Review**. | Developers can move their own unfinished tasks. The Owner or assigned Manager approves **Done**. |
| 5:30–6:40 | Refresh the Owner’s board, move the task to **Done**, and open **Dashboard**. | One task is complete, the overdue count is zero, and completion is `100%`. Refresh picks up changes between sessions. |
| 6:40–7:30 | Find the task on **Task list**, open its details, and switch Studio themes. | Search and pagination go through the project-scoped API. The drawer keeps the current board or list in context. |
| 7:30–8:30 | Show the architecture diagram and verification results. | Walk through one task status update from React to Express to MongoDB, then back to the board. |

Run the browser workflow with fictional users and isolated test data for a repeatable rehearsal. With full Chromium installed, use this command from the repository root. [Browser setup](../README.md#run-the-stage-1-browser-and-performance-checks)

```sh
npm --prefix backend run test:e2e -- --headed --grep "invited Developer workflow"
```

## Interview rehearsal

- **Architecture, MERN, and TypeScript.** Draw the React browser app, one modular Express backend, and MongoDB. Within Express, explain route middleware, controllers, services, and repositories. TypeScript helps expose mismatched shapes during development. Zod validates requests at runtime.
- **Session and permissions.** Describe password hashing, the stored token digest, revocation, and signed CSRF checks. Use a private task URL as an example of why the backend checks current workspace and project membership on each protected request.
- **Responsibilities and data modeling.** Point to the task service for business rules and the repository for MongoDB queries. Separate membership collections support role lookups from either side and enforce uniqueness with compound indexes.
- **Indexes and transactions.** Explain how the project-prefixed text index scopes title search and how the creation-time and ID sort stabilizes pagination. Use member removal and task unassignment as an atomic operation. Describe how a mid-operation failure rolls back the writes.
- **Testing and tradeoffs.** Give one example each from unit, integration, and Playwright tests. Discuss the cost of exact counts on large projects and the contention tradeoff of a shared workspace revision. Tie future sprint and real-time work to Stage 2 collaboration needs.

Practice explaining the examples in your own words. [Architecture diagram](SYSTEM_DESIGN.md#1-system-architecture) · [Engineering decisions](engineering-notes/007-mvp-decisions.md) · [Verification record](engineering-notes/008-mvp-verification.md)

## M17 sprint walkthrough

Use separate sessions for the assigned Manager and a Developer on the project roster. Prepare a Done task and a task in progress.

1. As Manager, open **Sprints**. Plan the current sprint and a future sprint that starts after it ends.
2. Open the current sprint, add both tasks, and start it. As Developer, open the same sprint and check the progress is one of two tasks done.
3. As Manager, choose **Complete sprint**. Review the unfinished work, select the future sprint, and confirm.
4. As Developer, refresh the current sprint to see its saved 50% progress. Open the future sprint to see the unfinished task with its original In Progress status.

The [browser workflow](../backend/e2e/sprints.e2e.ts) rehearses these steps with isolated test data.

```sh
npm --prefix backend run test:e2e -- sprints.e2e.ts
```

## M18 comments walkthrough

1. Open an editable task as a project member. In **Comments**, enter a review request and select another project member in **Mention someone**. Post the comment and confirm the mention appears under the text.
2. Open the same task in the mentioned member’s session. Confirm they can read and reply. The original comment’s edit and delete controls are available to its author.
3. In the author’s session, edit the text and remove the mention. Refresh the other session to see the edited text and updated mentions. Delete the original comment and verify the reply remains.
4. Open the task link as a signed-in outsider. DevFlow denies access to the task and discussion.

Run the [browser walkthrough](../backend/e2e/comments.e2e.ts) with isolated test data.

```sh
npm --prefix backend run test:e2e -- comments.e2e.ts
```
