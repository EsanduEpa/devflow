# DevFlow

DevFlow helps software development teams organize workspaces, manage projects, assign tasks, and track progress on a five-column Kanban board. Stage 1 is the MERN MVP.

## Stage 1 scope

- Accounts, profiles, and password recovery
- Workspaces, invitations, membership, and role-based access
- Project management and project membership
- Task assignment, search, filtering, and a five-column Kanban board
- Project dashboards with task counts and completion percentage
- Studio Light and Studio Dark with responsive workspace navigation

The frontend uses React, TypeScript, Vite, Tailwind CSS, React Router, and TanStack Query. The backend is an Express REST API on Node.js with TypeScript, Zod, and MongoDB through Mongoose. Tests use Vitest, Supertest, and Playwright.

## Repository layout

| Directory | Contents |
| --- | --- |
| `frontend/` | React web app |
| `backend/` | Express API |
| `backend/test/` and `backend/e2e/` | Unit, integration, browser, and API timing checks |
| `docs/` | Requirements, designs, milestone guide, and engineering notes |

## Run locally

Use Node.js 24, npm, Git, and a MongoDB deployment with transaction support. Docker is optional for the local password-recovery inbox. Clone the repository, install the locked dependencies, and copy the environment templates.

```sh
git clone https://github.com/EsanduEpa/devflow.git
cd devflow
npm --prefix backend ci
npm --prefix frontend ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

For MongoDB Atlas, create a deployment, add your current IP to its project access list, and create a database user with read and write access to `devflow_db`. In Atlas, choose **Connect → Drivers** and set `MONGODB_URI` in `backend/.env` to the resulting connection string with your database credentials. Keep the URI in the local `.env` file. DevFlow selects `devflow_db` explicitly and initializes its indexes before opening the API port. A self-managed deployment needs a replica set or sharded cluster for the same transaction support. [Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) · [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)

Generate a signing key for CSRF protection and put the output in `CSRF_SECRET` in `backend/.env`.

```sh
openssl rand -hex 32
```

The templates cover every local setting. Keep secrets in the ignored `.env` files and use the `.env.example` files as the shared reference.

| File | Variable | Purpose |
| --- | --- | --- |
| Backend | `PORT` | Express loopback port. Default `3000`. |
| Backend | `MONGODB_URI` | Required connection URI for `devflow_db`. |
| Backend | `MONGODB_TEST_URI` | Optional separate connection URI for `devflow_test`. Tests fall back to `MONGODB_URI`. |
| Backend | `CSRF_SECRET` | Required 64-character hexadecimal signing key. Generate a different key for each environment. |
| Backend | `APP_ORIGINS` | Allowed browser origins for REST writes and live updates, separated by commas. Includes `http://127.0.0.1:5173` and `http://localhost:5173` by default. |
| Backend | `PASSWORD_RESET_ORIGIN` | Browser origin used in reset links. It must be in `APP_ORIGINS`. The first allowed origin is the fallback. |
| Backend | `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | Password-recovery mail server and sender. The template uses loopback port `1025` and a test sender. |
| Backend | `SMTP_USER`, `SMTP_PASSWORD` | Optional authenticated SMTP settings. Set both for providers that require credentials. |
| Frontend | `FRONTEND_PORT`, `API_PROXY_TARGET` | Vite loopback port and backend target for `/api` and `/socket.io`. Defaults are `5173` and `http://127.0.0.1:3000`. |

`NODE_ENV=production` enables secure cookies, requires HTTPS origins, and requires `SMTP_HOST` and `MAIL_FROM`. For the documented local HTTP workflow, leave it unset.

Start the backend and frontend in separate terminals from the repository root.

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Vite forwards REST and WebSocket connections to the same backend. Open the frontend using an origin listed in `APP_ORIGINS` for project live updates.

Open [DevFlow](http://127.0.0.1:5173). Create an account, log in, refresh **Workspaces** to check that your session persists, then use the account menu to log out. The account menu also switches Studio themes. You can check Express directly.

```sh
curl -i http://127.0.0.1:3000/api/health
```

If you change `PORT` in `backend/.env`, update `API_PROXY_TARGET` in `frontend/.env` to match. If you change `FRONTEND_PORT`, update the browser URL, add its origin to `APP_ORIGINS`, and set `PASSWORD_RESET_ORIGIN` to that origin. Restart both apps after editing the settings.

## Test password recovery in the browser

With Docker running, start a local Mailpit inbox in a third terminal. The backend defaults to sending recovery mail to this local inbox.

```sh
docker run --rm --name devflow-mailpit -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit
```

1. Register a test account and log in. Open **Profile settings** to update your name or bio, try changing your email with your current password, then change your password. You should be sent back to login.
2. From the login page, select **Forgot password?** and enter the account's current email.
3. Open the [Mailpit inbox](http://127.0.0.1:8025), follow the link in the email, and choose a new password. Sign in with the new password. Opening the same link again and trying another reset should fail.

Set `PASSWORD_RESET_ORIGIN` in `backend/.env` if your browser uses a different frontend address. It must match an entry in `APP_ORIGINS`. To deliver mail to real inboxes, configure your SMTP provider with `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, and, if needed, `SMTP_USER` and `SMTP_PASSWORD`. The backend uses TLS on port 465 and requires STARTTLS for other remote SMTP connections. [Nodemailer SMTP settings](https://nodemailer.com/smtp)

## Test workspaces in the browser

1. Log in, open **Workspaces**, and use **New workspace** to create two workspaces.
2. From a workspace, use the **Workspace** selector in the sidebar to open the other. On narrow screens, open the navigation drawer first. The workspace details and Projects section should show the selected workspace. Refresh to verify that the selection stays on the same workspace.
3. Open **Workspace settings**, edit the name or description, and save. Return to **All workspaces** to see the update.
4. Copy a workspace URL and open it in a private browser window. Log in with a different test account, then open the copied URL again. The workspace should be absent from that account's list, and the direct URL should display **You don’t have access to this workspace.**

## Test invitations in the browser

1. Log in as a workspace Owner. Open your workspace's **Workspace settings**, enter an invitee email under **Invitations**, pick **Developer** or **Manager**, and choose **Create invitation**.
2. Copy the generated link. In a private browser window, open the link, check the workspace name and masked email, and register or log in with the invited address.
3. Choose **Accept invitation**. The invitee opens the workspace and appears under **Members**. Reopen the same link to confirm it can only be used once.
4. Back as the Owner, refresh **Workspace settings** to see the invitation marked **Accepted**. DevFlow creates the link for you to share directly.

## Test projects in the browser

1. Log in as a workspace Owner. Open a workspace and click **Create project**. Enter a name, optionally add dates, choose yourself or an eligible Manager, and save. The project overview should show the selected manager, status, and dates.
2. Return to the workspace and filter **Projects** by status. Archived projects appear when you select **Archived**. Workspaces with more than 20 matching projects have page controls.
3. Use a Manager account to verify that creating a project assigns it to that Manager. As a Developer, verify that the create form is unavailable and opening the URL of a project you do not belong to shows an access message.

## Test project settings in the browser

1. Open a project as the workspace Owner or its assigned Manager and choose **Project settings**. Edit the name, description, or dates and save.
2. Under **Project members**, choose a Developer who belongs to the workspace and add them. In a separate browser window, log in as that Developer. They can open the project and see its members. Remove them from the project and reload their window to confirm access is revoked.
3. Choose another eligible Manager in **Project manager** and save. The new Manager appears in the member list automatically. The previous Manager remains a project member and can now be removed.
4. Select **Archived** as the status, choose **Archive project**, and confirm. Open it again from the workspace’s **Archived** filter. Choose another status in settings and select **Restore project**.

## Test workspace member management in the browser

1. Open **Workspace settings** as the Owner. Under **Members**, choose **Manager** for a Developer and select **Save role**.
2. Assign that Manager to a project. Try changing their role back to **Developer**, then try removing them. Both actions should tell you to reassign their projects first.
3. Assign the project to another eligible manager in **Project settings**. Return to **Workspace settings**, update the former Manager’s role, then select **Remove** and confirm. They should lose access to the workspace and its projects on their next request. Their access to other workspaces stays intact.

## Test task management in the browser

1. Open an active project as its Owner or assigned Manager. Choose **Create task**, select a project member as assignee, and save. Copy the task URL for the rest of the test.
2. Use **Edit task** to change the priority or due date. Open the task URL as a Developer on the project to verify read access. A Developer can create a task by entering a title and description.
3. Remove the assignee in **Project settings → Project members**, then refresh the task as Owner. It should still exist and show **Unassigned**. Try the same check by removing another assignee through **Workspace settings → Members**.
4. Archive the project and reopen the task URL. It should remain readable. Restore the project to use **Delete task**, then **Delete permanently**. The task URL should stop opening while the project remains accessible.

## Test the Kanban board in the browser

1. Open a project and choose **Board**. The five columns show Backlog, To Do, In Progress, In Review, and Done. Select a task title to open its details in the side panel on desktop or full-screen on mobile.
2. Assign a task to a Developer in the project. As that Developer, use the card’s **Move to** dropdown to select **In Review**. The card should move to that column. The Developer can change the status of their own unfinished tasks.
3. As the Owner or assigned Project Manager, reload the board to see the change and move the card to **Done**. Reload as the Developer and confirm the card is visible with its status control hidden.

## Test task search in the browser

1. Open a project and choose **Task list**. Search using a word from a task title, then try pasting its full ID from the task detail page.
2. Combine **Status**, **Priority**, and **Assignee**. Select **Unassigned** to find tasks waiting for an assignee. Use **Apply filters** to search or **Clear filters** to reset.
3. With enough results, use **Next** to open another page. Refresh to check that the URL preserves your filters and page. Open **Board** and clear its filters to see all tasks.

See the [task search query plans](docs/engineering-notes/005-task-search-indexes.md) for the measured index usage.

## Test the project dashboard in the browser

1. Open a project with no tasks. **Project progress** should show zero for each count and `0%` completion.
2. As the Owner or assigned Manager, create an **In Progress** task due yesterday and a **To Do** task due today, using UTC calendar dates. Return to the project page and check for two total tasks, one in progress, and one overdue.
3. On the **Board**, move the overdue task to **Done**. Return to **Dashboard** and check for one completed task, zero overdue, and `50%` completion.
4. Confirm archiving from **Project settings** and verify that authorized members can still read its dashboard. An account without access to the project should see the project access message.

## Check the apps

```sh
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend run lint
```

Run the database integration tests separately.

```sh
npm --prefix backend run test:db
```

The tests use `devflow_test` and require a transaction-capable MongoDB deployment. Give your configured database user read and write access to `devflow_test`, or set `MONGODB_TEST_URI` in `backend/.env` to use separate test credentials. Each run creates and removes its own temporary collections. The password recovery tests use a temporary local inbox, so they run without Mailpit or real email credentials.

## Run the Stage 1 browser and performance checks

Install Playwright’s Chromium headless browser once, then run the browser suite from the repository root. The suite builds the frontend and starts its own local server. To watch it, install full Chromium with `npm --prefix backend exec -- playwright install chromium`, then run `npm --prefix backend run test:e2e -- --headed`. [Playwright browser installation](https://playwright.dev/docs/browsers)

```sh
npm --prefix backend exec -- playwright install --only-shell chromium
npm --prefix backend run test:e2e
```

Run the API timing and MongoDB query plan checks separately.

```sh
npm --prefix backend run test:performance
```

Both commands use temporary collections in `devflow_test`. See the [Stage 1 verification notes](docs/engineering-notes/006-stage1-verification.md) for acceptance coverage and measured results.

## Project documentation

- [Stage 1 milestone guide](docs/DevFlow_Stage1_Complete_Milestone_Guide_M0-M15.md) and [requirements](docs/SRS.md)
- [Architecture](docs/SYSTEM_DESIGN.md), [data model](docs/DATABASE_DESIGN.md), and [Studio design specification](docs/UI_UX_DESIGN.md)
- [Implemented API reference](docs/API_REFERENCE.md) and [engineering decisions](docs/engineering-notes/007-mvp-decisions.md)
- [Release notes](docs/RELEASE_NOTES.md), [demo guide](docs/DEMO.md), and [MVP verification record](docs/engineering-notes/008-mvp-verification.md)
