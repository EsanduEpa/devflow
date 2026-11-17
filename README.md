# DevFlow

DevFlow helps software development teams organize workspaces, manage projects, assign tasks, and track progress on a Kanban board. The project is also a practical exercise in full-stack software engineering.

## Stage 1 scope

- Accounts, profiles, and password recovery
- Workspaces, invitations, membership, and role-based access
- Project management and project membership
- Task assignment, search, filtering, and a five-column Kanban board
- A basic project dashboard and automated tests

The planned stack is React, TypeScript, Vite, and Tailwind CSS for the frontend, with a Node.js and Express REST API and MongoDB through Mongoose.

## Repository layout

| Directory | Contents |
| --- | --- |
| `frontend/` | React web app |
| `backend/` | Express API |
| `docs/` | Requirements, designs, milestone guide, and engineering notes |

## Run locally

Use Node.js 24 and npm. From the repository root, install both apps and copy the local settings after cloning.

```sh
npm --prefix backend ci
npm --prefix frontend ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `MONGODB_URI` in `backend/.env` to your Atlas connection string. The backend selects `devflow_db` and connects before opening the API port. Your current IP must be on the project's Atlas access list and your database user needs read and write access to `devflow_db`. [Atlas connection setup](https://www.mongodb.com/docs/atlas/driver-connection/)

Generate a signing key for CSRF protection and put the output in `CSRF_SECRET` in `backend/.env`.

```sh
openssl rand -hex 32
```

`APP_ORIGINS` lists the browser origins allowed to submit forms, separated by commas. The defaults accept `http://127.0.0.1:5173` and `http://localhost:5173`. Update the list if you use a different frontend port. For an HTTPS deployment, set `NODE_ENV=production` and list the HTTPS frontend origins.

Start the backend and frontend in separate terminals from the repository root.

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Open [DevFlow](http://127.0.0.1:5173). Create an account, log in, refresh to check that your session persists, then log out. You can also check Express directly.

```sh
curl -i http://127.0.0.1:3000/api/health
```

If you change `PORT` in `backend/.env`, update `API_PROXY_TARGET` in `frontend/.env` to match and restart both apps. `FRONTEND_PORT` controls the port you open in the browser.

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
2. From a workspace, use **Switch workspace** to open the other. The workspace details and Projects section should show the selected workspace. Refresh to verify that the selection stays on the same workspace.
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

## Progress

M7 adds project creation, project listing, and project access rules. See the [Stage 1 milestone guide](docs/DevFlow_Stage1_Complete_Milestone_Guide_M0-M15.md) for the development sequence.
