# Stage 2 release procedure

## Verify a candidate

1. Clone the candidate into a clean directory and follow [local setup](../README.md#run-locally). Use `npm ci` in both apps and copy both `.env.example` files. Use a disposable transaction-capable MongoDB deployment with an empty `devflow_db` and a separate `devflow_test`. The server and tests choose those database names explicitly, so a different database name in the URI does not isolate a live database.
2. Run the [full command table](DevFlow_Stage2_Complete_Milestone_Guide_M16-M27.md#local-setup-and-verification-commands). With the apps running, check `/api/health` directly and through the frontend, then open the app.
3. Rehearse the [Stage 2 demo](DEMO.md#stage-2-collaboration-demo). The automated version provisions four sessions and temporary collections and checks both a Stage 1 shaped task and a new task through the collaboration workflow. For an existing installation, also rehearse the upgrade with an isolated copy of representative Stage 1 data.
4. Review the [REST and Socket.IO contracts](API_REFERENCE.md), [database and index changes](DATABASE_DESIGN.md#24-stage-2-and-stage-3-compatibility), and [release notes](RELEASE_NOTES.md) against the candidate.

## M27 candidate results

The M27 changes are documentation. Verification used a fresh clone of the runtime at `679bf9e` with Node.js 24.22.0, both Stage 2 lockfiles and environment templates, and a new local single-node MongoDB 8.0.12 replica set.

| Check | Result |
| --- | --- |
| Startup and proxy | The built API initialized an empty `devflow_db`. `/api/health` returned `200` directly and through Vite, and the frontend page loaded. |
| Type checks, builds and lint | Backend type check and build, frontend build and lint passed. |
| Full test suites | 15 unit, 74 database, and 13 Chromium tests passed. The four-session demo ran on disposable data as part of the browser suite. |
| Performance and query plans | All 11 timings and 11 plans completed on 10,000 tasks. The combined sprint and blocked filter took 183 ms p95 on this local replica set. The [M26 Atlas report](engineering-notes/020-m26-stage2-verification.md) records the separate shared-cluster measurements. |
| Upgrade from tagged Stage 1 | The backend from `v1.0.0-mvp` created an account, workspace, project, and assigned task. Stage 2 retained the session and task data, returned version `0` and no sprint, and supported both versioned and older edits. Activity and dashboard counts reflected the new writes. The historical backend lockfile needed its root package name aligned with `package.json` in the temporary copy to install under the current npm. Locked dependency versions stayed the same. |

## Upgrade a Stage 1 installation

1. Take a database backup and record the running app revision. Verify you can restore to a separate deployment before using the backup for rollback.
2. Stop Stage 1 writes. Deploy the Stage 2 frontend and backend together. Keep the existing session and CSRF configuration. Ensure the MongoDB user can initialize collections and indexes. Configure the frontend origin in `APP_ORIGINS` and forward `/api` and WebSocket upgrades under `/socket.io` to the same backend.
3. Start the backend. Index initialization occurs before the server listens. Once health is available, sign in, open an existing task and confirm you can edit it. Run a two-session check for live updates and notifications before reopening writes to the team.

Existing tasks require no backfill. The API treats missing `sprintId` as `null` and missing `version` as `0`. Activity starts when Stage 2 writes record it. Older REST clients can omit `expectedVersion`, while the Stage 2 UI supplies it for supported edits.

If rollback is needed, pause writes and preserve the current database. Redeploy the previous frontend and backend together against the pre-upgrade snapshot after verifying the restore separately. This returns the app to the snapshot time, so reconcile any work saved after the backup before reopening writes. Stage 1 clients do not understand Stage 2 sprint or activity rules and can write without advancing task versions. Avoid running Stage 1 and Stage 2 writers against the same data.

## Publish after M27 merges

Fetch `main` and verify the exact merged commit using the steps above. Confirm the tag with the release owner. The proposed tag is `v1.1.0-collaboration`. With that name confirmed, use the verified commit SHA explicitly.

```sh
git fetch origin main
git log -1 --oneline origin/main
git tag -a v1.1.0-collaboration <verified-merge-sha> -m "DevFlow Stage 2 collaboration"
git push origin refs/tags/v1.1.0-collaboration
git ls-remote origin 'refs/tags/v1.1.0-collaboration^{}'
```

Confirm the remote tag resolves to the verified SHA. Publish the GitHub release using that tag and the Stage 2 section of [release notes](RELEASE_NOTES.md). Record the commit and tag in the [milestone checklist](DevFlow_Stage2_Complete_Milestone_Guide_M16-M27.md#final-exit-checklist).
