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

## M19 activity walkthrough

1. As Owner or assigned Manager, create a task with the default fields. Then edit it to assign a Developer and set priority to High in the same save. Open **Activity** on task details. The creation and update entries show the actor and time, and the update groups assignment and priority changes.
2. As the assigned Developer, move the task to **In Review**. The timeline shows the status change. A manager can then move it to **Done** and verify that one entry shows completion and the transition.
3. Create a second task, add it to an active sprint, then complete the sprint and choose a rollover destination. Open that task’s **Activity** and check that it shows the original sprint and destination.
4. Open the task link as a signed-in outsider. DevFlow denies access to the task and its timeline.

Run the [browser walkthrough](../backend/e2e/activity.e2e.ts) with isolated test data.

```sh
npm --prefix backend run test:e2e -- activity.e2e.ts
```

## M20 dependency walkthrough

1. As an Owner or assigned Manager, create **Publish release**, **Review release**, and **Prepare release** in one project.
2. Open **Publish release**. Under **Dependencies**, choose **Add prerequisite**. Add **Review release**. Publish shows **Blocked**. Review lists Publish under **Dependent tasks**.
3. Add **Prepare release** as a prerequisite of Review. Then open Prepare and try to add Publish as its prerequisite. The app rejects the cycle.
4. Mark Review **Done**, then refresh Publish in a project Developer’s session. Its Blocked badge disappears. Reopen Review and refresh Publish again to see the badge return.
5. Permanently delete Review. Publish loses that prerequisite and its Blocked badge. Prepare no longer lists Review as a dependent.

The Developer can read the graph. In their session the management controls are hidden.

```sh
npm --prefix backend run test:e2e -- dependencies.e2e.ts
```

## M21 conflict walkthrough

1. Open the same task as the workspace Owner and the assigned Manager in separate browser sessions. In the Manager session, choose **Edit task** and type a new description.
2. In the Owner session, raise the priority to **High** and save.
3. In the Manager session, click **Save changes**. The **Task changed** panel shows the latest saved values, and the draft description stays in the form.
4. Click **Retry my changes**. The description saves and the priority stays High. Repeat the conflict and choose **Replace draft with latest values** to load the saved fields into the form instead.
5. To check status or sprint membership recovery, have another session update the task after it loads and before your write. The conflict panel shows the latest task and offers a retry when the original action is still available.

```sh
npm --prefix backend run test:e2e -- task-conflicts.e2e.ts
```

## M22 Kanban walkthrough

1. Open an editable project’s **Board** as a Developer. On a task assigned to you, drag the grip from **Backlog** to **In Progress**, then to **In Review**. Each move appears immediately and shows a confirmation after saving.
2. Try dropping the card back into its current column, then try dragging it to **Done** as the Developer. Both attempts leave the card in its current column.
3. Open the board as the assigned Manager or Owner. Drag the task to **Done**. Refresh the board and open the task to verify that both views show Done.
4. On a separate task, use the **Move to** dropdown with the keyboard or on a narrow touch screen. Check that the board scrolls horizontally and the control remains usable.
5. To test rejection, have the Owner unassign a task in another browser after the Developer opens the board. Drop it into a writable column from the stale board. The app restores the confirmed status and refreshes permissions.

```sh
npm --prefix backend run test:e2e -- kanban-drag-drop.e2e.ts
```

## M23 live update walkthrough

1. Open the same project board as the Owner or assigned Manager and a Developer, using separate browser profiles.
2. Assign a task to the Developer. Drag it to a different status column and post a comment. The Developer’s board and open task details catch up without reloading.
3. Put the Developer’s browser offline. As the Manager, update the task and post another comment. Bring the Developer’s browser back online. The board and discussion reload with the saved values.
4. Remove the Developer from the project while their browser is connected. Their project view clears and displays an access denial. A signed-in outsider opening the project link also receives an access denial.

```sh
npm --prefix backend run test:e2e -- realtime.e2e.ts
```
