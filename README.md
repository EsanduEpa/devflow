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

Start the backend and frontend in separate terminals from the repository root.

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Open [DevFlow](http://127.0.0.1:5173). The page checks the Express API at `/api/health` through Vite. You can also call Express directly.

```sh
curl -i http://127.0.0.1:3000/api/health
```

If you change `PORT` in `backend/.env`, update `API_PROXY_TARGET` in `frontend/.env` to match and restart both apps. `FRONTEND_PORT` controls the port you open in the browser.

## Check the apps

```sh
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix frontend run lint
```

## Progress

M1 sets up the separate React and Express apps and connects them through a health check. See the [Stage 1 milestone guide](docs/DevFlow_Stage1_Complete_Milestone_Guide_M0-M15.md) for the development sequence.
