# DevFlow — Stage 3 Development Milestone Plan (M24–M31)

**Project:** DevFlow  
**Document:** Stage 3 Implementation and Learning Plan  
**Version:** 1.0 — Proposed for approval  
**Date:** 2026-11-27  
**Status:** Draft; not yet approved  
**Starting point:** Stage 2 complete  
**Source of truth:** Approved Stage 1/2 designs and `STAGE3_TECHNICAL_DESIGN.md`  
**Development approach:** You write the code; AI is a teacher, reviewer, and hint provider.

---

## 1. Goal

Stage 1 built DevFlow. Stage 2 made it collaborative. **Stage 3 will make it integration-ready and operable in production.** Do not restart the project, replace the stack, or rewrite completed Stage 2 modules without a measured reason.

### 1.1 Milestone map

| Milestone | Goal | Main outputs | Prerequisite |
|---|---|---|---|
| M24 | GitHub integration | Verified GitHub App connection and PR links | Stage 2 baseline |
| M25 | Webhook ingestion | Secure, deduplicated GitHub event updates | M24 |
| M26 | Background processing | Redis, BullMQ, recoverable workers | M25 |
| M27 | Performance | Load-test evidence and targeted improvements | M26 |
| M28 | Advanced analytics | Accurate sprint/task trend reports | M27 |
| M29 | Docker | Reproducible app/worker/Redis environments | M28 |
| M30 | CI/CD | Automated verification and controlled deployment | M29 |
| M31 | Production release | Monitoring, security, backups, documentation, release | M30 |

The order is recommended. Use feature branches and keep each milestone small enough to test independently.

### 1.2 Rules for independent learning

1. Read the relevant section of the technical design and existing implementation first.
2. Find the official documentation for the technology you will use.
3. Write a short plan of your own before coding.
4. Build the smallest working vertical slice, then expand it.
5. Write automated tests, including failure cases.
6. Compare the implementation to the approved API/database/business rules.
7. Record one design decision and one thing you learned.
8. Commit the working change to Git.
9. Ask AI for an explanation, hint, or review—not an entire replacement feature.

**AI-review prompt template:** “Review my implementation against `docs/stage3/STAGE3_TECHNICAL_DESIGN.md`, this milestone, and existing approved rules. Identify correctness, security, and maintainability issues. Do not implement the feature for me. Give hints and references first.”

---

## 2. Preflight checkpoint — Complete before M24

This is a **checkpoint**, not a new feature or numbered milestone.

### Do yourself

- [ ] Pull the latest Stage 2 branch and confirm it builds.
- [ ] Run existing TypeScript, lint, unit, integration, and E2E checks. Record results honestly.
- [ ] Test login, workspace/project authorization, tasks, sprints, comments, notifications, dependencies, and Socket.IO.
- [ ] Read the existing backend module structure and find where new integrations should fit.
- [ ] Review and back up current MongoDB data; use test data for Stage 3 development.
- [ ] Create a release tag such as `stage2-complete` after validating the commit.
- [ ] Save environment/tool versions and current deployment notes.
- [ ] Make a list of already existing infrastructure that can be reused.

**Done when:** Stage 2 works as expected and you have a known-good baseline. Known existing problems are documented instead of being confused with Stage 3 regressions.

---

# M24 — GitHub Integration

## Objective

Allow an authorized workspace Owner or assigned Project Manager to connect a GitHub repository to a DevFlow project, and allow authorized project members to link/view pull requests on tasks.

## Prerequisites

- Stage 2 baseline passed.
- Understand current DevFlow authentication, workspace/project RBAC, and task-detail UI.
- Read GitHub's current GitHub Apps documentation.

## Learn first

- REST APIs and status codes; external API pagination and rate limits.
- GitHub Apps vs. OAuth Apps vs. personal access tokens.
- App installations, permissions, and short-lived installation tokens.
- OAuth/state validation where needed for the user authorization flow.
- Adapter Pattern and the principle of least privilege.

## Coding tasks

### Part A — Plan and configure

- [ ] Create a separate development GitHub App (do not use real production credentials locally).
- [ ] Choose only needed repository metadata and pull-request read permissions.
- [ ] Decide on and document the verified installation/user-linking flow.
- [ ] List the repository and task linking use cases and their permissions.
- [ ] Define safe environment variables and update `.env.example`.

### Part B — Database and backend

- [ ] Define installation metadata and project connection schemas.
- [ ] Define the pull-request linking schema with unique constraints.
- [ ] Implement a GitHub API adapter behind a small interface.
- [ ] Implement server-side installation token creation and expiration handling.
- [ ] Verify callback state and the user's right to connect selected repositories.
- [ ] Add service checks: authorized DevFlow project, verified installation, valid repository.
- [ ] Implement connect, view status, list accessible repositories, and disconnect operations.
- [ ] Implement task-to-pull-request linking/unlinking and PR reading.
- [ ] Handle missing/revoked permissions and GitHub rate limits safely.

### Part C — Frontend

- [ ] Add **Project Settings → GitHub** following `UI_UX_DESIGN.md`.
- [ ] Show connection status, selected repository, and disconnect confirmation.
- [ ] Add a linked pull-requests section to the existing task-details UI.
- [ ] Handle loading, empty, permission-denied, and connection-expired states.
- [ ] Preserve task status approval rules; do not automatically mark Done on merge.

### Part D — Documentation

- [ ] Document GitHub App registration and test installation setup.
- [ ] Record the permission decisions and alternatives in an ADR.
- [ ] Document the new REST contracts and data collections.

## Suggested API coverage

- `GET /integrations/github/setup?projectId=...`
- `GET /integrations/github/callback`
- `GET /integrations/github/repositories?installationId=...`
- `GET/POST/DELETE /projects/:projectId/github/connection`
- `GET/POST /tasks/:taskId/github/pull-requests`
- `DELETE /tasks/:taskId/github/pull-requests/:linkId`

Follow the exact endpoint semantics in the Stage 3 Technical Design; normalize implementation names with existing conventions.

## Tests to write

- [ ] Project Owner/assigned Manager can connect an authorized repository.
- [ ] Developer cannot change a project-level connection without permission.
- [ ] Forged `installationId`, `repositoryId`, or callback state is rejected.
- [ ] GitHub installation revoked/removed produces a safe failure state.
- [ ] Invalid PR number, mismatched repository, and duplicate PR link are rejected.
- [ ] Authorized project member can view linked PR details.
- [ ] Connecting GitHub does not change existing task completion permissions.

## Interview questions

1. Why did you choose a GitHub App instead of asking for a personal access token?
2. What is OAuth state, and what attack does it help prevent?
3. How do installation tokens differ from user tokens?
4. Where did you apply the Adapter Pattern?
5. How do you handle an external API's rate limit or outage?

**Done when:** a genuine test installation connects securely to a DevFlow project, tasks can show verified PR links, authorization tests pass, and the feature works without changing Stage 1/2 workflows.

---

# M25 — GitHub Webhooks and Durable Events

## Objective

Receive GitHub events safely and keep already linked pull requests updated without repeatedly polling GitHub.

## Prerequisites

- M24 GitHub App and project/PR linking complete.
- Understand current webhook event/payload structure.

## Learn first

- Webhooks vs. polling.
- HMAC-SHA256 and timing-safe signature comparison.
- Raw HTTP request bodies.
- Event delivery IDs, at-least-once delivery, idempotency.
- Event ordering, duplicate delivery, and eventual consistency.

## Coding tasks

### Part A — Webhook receiver

- [ ] Register only required `pull_request` and necessary installation lifecycle events.
- [ ] Add a dedicated `POST /api/v1/integrations/github/webhook` route.
- [ ] Preserve raw bytes for HMAC verification **before** JSON parsing.
- [ ] Verify the GitHub HMAC signature using `X-Hub-Signature-256`.
- [ ] Apply body-size limits and supported-event/action validation.
- [ ] Validate installation and repository mappings to a DevFlow project.
- [ ] Exempt this signed endpoint only from browser session/CSRF checks; do not open other routes.

### Part B — Durable processing

- [ ] Create `github_webhook_deliveries` with a unique delivery ID.
- [ ] Persist accepted deliveries before replying 2xx.
- [ ] Return 2xx promptly for accepted or duplicate deliveries.
- [ ] Implement a simple processor that updates linked PR state/activity from accepted events.
- [ ] Make updates safe to replay; avoid stale out-of-order state overwrites.
- [ ] Mark processed/failed status and store safe error information.
- [ ] Add a recovery/retry command for durable failed/unprocessed deliveries.
- [ ] Handle installation removal and repository access revocation.

### Part C — Verification

- [ ] Use a dedicated GitHub testing repository and real webhook deliveries.
- [ ] Test open, edit, close, merge, and duplicate deliveries as relevant.
- [ ] Confirm PR state updates correctly in DevFlow.
- [ ] Confirm task completion still requires authorized approval.
- [ ] Document how to test locally using a webhook forwarding setup.

## Tests to write

- [ ] Invalid signature rejected before writes.
- [ ] Missing signature rejected.
- [ ] Duplicate delivery causes one effective update.
- [ ] Old delivery cannot overwrite newer authoritative PR state.
- [ ] Unknown event/action is safely ignored and recorded.
- [ ] Unknown/unlinked installation does not change DevFlow data.
- [ ] Simulated processing failure leaves a recoverable event record.

## Interview questions

1. What is a webhook and how is it different from polling?
2. Why must the raw body be preserved for signature checking?
3. What does idempotency mean in event processing?
4. Why can webhook events arrive twice or out of order?
5. Why should the webhook receiver acknowledge quickly?

**Done when:** verified real GitHub deliveries update linked PR information reliably, duplicates are harmless, and accepted failures can be retried.

---

# M26 — Redis, BullMQ, and Background Workers

## Objective

Move slow or retryable work out of HTTP request handlers into recoverable background jobs.

## Prerequisites

- M25 durable webhook receipts and processor work.
- Understand async programming, Redis, and Node.js processes.

## Learn first

- Message queues, producers, consumers, workers.
- Redis persistence and memory eviction.
- BullMQ jobs, attempts, retries, backoff, job IDs.
- At-least-once processing, idempotent handlers.
- Outbox/reconciliation patterns and graceful shutdown.

## Coding tasks

### Part A — Infrastructure

- [ ] Configure local Redis securely; do not expose it publicly.
- [ ] Add BullMQ as required by the current package version.
- [ ] Create a separate Node.js worker entry point/process.
- [ ] Implement safe queue and worker connections and shutdown handling.
- [ ] Configure queue names and job identifiers.

### Part B — Move actual work

- [ ] Put verified persisted GitHub webhook processing into `github-events` jobs.
- [ ] Add bounded retries and exponential backoff for temporary GitHub/DB failures.
- [ ] Ensure job handlers read valid state from MongoDB and are replay-safe.
- [ ] Add a recovery scan for webhook records accepted but never queued or still unprocessed.
- [ ] Add a suitable notification job only if existing Stage 2 notification delivery benefits from it.
- [ ] Keep regular project/task operations working during a Redis outage.
- [ ] Log job IDs, delivery IDs, errors, and processing times safely.

### Part C — Tests and operational controls

- [ ] Simulate a worker crash during job execution.
- [ ] Restart Redis and verify recovery behavior.
- [ ] Replay the same job and confirm no duplicate effect.
- [ ] Test GitHub API timeouts and rate limits.
- [ ] Document how to inspect failed jobs and retry them safely.

## Interview questions

1. What is a message queue?
2. Why is a worker process different from an Express route handler?
3. What does at-least-once processing mean?
4. Why should jobs be idempotent?
5. What is exponential backoff?
6. How do you prevent accepted events from being lost between MongoDB and Redis?

**Done when:** slow GitHub event processing runs in a worker; temporary failures retry correctly; duplicate jobs are harmless; and acknowledged webhook events can recover after failures.

---

# M27 — Performance Testing and Optimization

## Objective

Use measurements to identify DevFlow bottlenecks and improve the most important ones.

## Prerequisites

- M26 worker and queue integrated.
- All prior functional/security tests still passing.

## Learn first

- Throughput, latency, percentiles (p50/p95/p99), and error rates.
- Load testing vs. stress testing.
- MongoDB indexes, `explain`, slow queries, aggregation.
- Node.js event-loop delay, memory and CPU usage.
- Caching, cache invalidation, and stale data.

## Coding tasks

### Part A — Baseline

- [ ] Select repeatable scenarios: login, list projects, filter tasks, Kanban, dashboard, task updates, notifications.
- [ ] Prepare safe synthetic test data, not production personal data.
- [ ] Choose a test environment and record machine resources.
- [ ] Configure a load-testing tool such as k6.
- [ ] Record p50/p95, requests/sec, error rate, CPU/memory, query times.
- [ ] Record Socket.IO behavior and queue backlog during realistic activity.

### Part B — Diagnose

- [ ] Identify the slowest high-value workflows.
- [ ] Inspect MongoDB execution plans for those workflows.
- [ ] Check unnecessary requests, N+1 queries, oversized JSON, and excessive frontend refetches.
- [ ] Form a performance hypothesis before making each change.

### Part C — Improve and compare

- [ ] Add or adjust indexes only when justified by query patterns.
- [ ] Improve projections, pagination, and aggregation where necessary.
- [ ] Reduce redundant frontend queries.
- [ ] Consider Redis caching only when there is a measured read-heavy bottleneck.
- [ ] If adding cache, define key scope, TTL, invalidation, and workspace isolation.
- [ ] Re-run the same tests and publish before/after measurements.
- [ ] Keep changes only if they improve real outcomes without correctness regressions.

## Tests to write

- [ ] Existing behavior remains correct after optimization.
- [ ] Cache never leaks workspace data if caching is used.
- [ ] Cache invalidation after task update works if caching is used.
- [ ] Load tests show documented baseline and repeatable post-change results.
- [ ] Error rates and authorization checks remain acceptable under tested load.

## Interview questions

1. What is p95 latency and why is it useful?
2. What is a database index and its trade-off?
3. How did you find your slowest operation?
4. Why isn't adding Redis always an improvement?
5. What is cache invalidation?
6. What evidence proves an optimization helped?

**Done when:** a reproducible performance report exists, significant bottlenecks are addressed or explained, and no reliability/security regressions were introduced.

---

# M28 — Advanced Analytics

## Objective

Add useful project and sprint reports using the existing Stage 2 data.

## Prerequisites

- M27 performance baseline and indexing review complete.
- Existing sprint, task, and activity-history data confirmed.

## Learn first

- MongoDB aggregation pipelines.
- Grouping by date and status.
- Derived metrics vs. stored snapshots.
- Time zones, date boundaries, and historical data accuracy.
- Chart accessibility, misleading comparisons, and empty states.

## Coding tasks

### Part A — Define reports

- [ ] Write precise definitions for completion trend, throughput, work in progress, sprint completion, and carryover.
- [ ] Inspect whether Stage 2 keeps a sprint-start commitment snapshot; if not, document limits rather than inventing history.
- [ ] Decide which date ranges the existing UI needs.
- [ ] Document project access rules for reports.

### Part B — Backend

- [ ] Implement `GET /api/v1/projects/:projectId/analytics` using the existing API conventions.
- [ ] Implement MongoDB aggregations for approved reports.
- [ ] Add necessary indexes based on actual query plans.
- [ ] Handle zero-task/empty-sprint and missing-history cases.
- [ ] Reuse the existing project authorization checks.

### Part C — Frontend

- [ ] Add charts and statistic cards consistent with Studio Light/Studio Dark.
- [ ] Include clear units, date ranges, legends, and accessible alternatives to charts.
- [ ] Display loading/empty/error states.
- [ ] Avoid misleading developer rankings or unsupported conclusions.

## Tests to write

- [ ] Known small dataset produces exactly expected values.
- [ ] Completed/overdue/rollover rules match definitions.
- [ ] Date boundaries and zero-task cases are correct.
- [ ] Unauthorized workspace/project reporting is denied.
- [ ] Performance is acceptable on a large synthetic test dataset.

## Interview questions

1. What is MongoDB aggregation?
2. Why do reporting metrics need precise definitions?
3. What is derived data, and when would you precompute it?
4. How do indexes affect aggregation?
5. Why does missing historical data limit certain metrics?

**Done when:** authorized users can view correct, understandable trend and sprint reports, and every report's calculation is documented and tested.

---

# M29 — Docker and Reproducible Environments

## Objective

Make DevFlow easy to run consistently on different machines and in deployment environments.

## Prerequisites

- M24–M28 features tested.
- Understand how frontend, API, worker, MongoDB, and Redis start today.

## Learn first

- Containers, images, and Dockerfiles.
- Multi-stage builds and `.dockerignore`.
- Docker networks, ports, volumes, and health checks.
- Docker Compose.
- Environment variables and secret management.

## Coding tasks

### Part A — Images

- [ ] Create an API Dockerfile with a production build.
- [ ] Create a worker image/reusable build with a worker start command.
- [ ] Create the frontend build/delivery image or document the static-hosting approach.
- [ ] Use non-root execution and minimal dependencies where practical.
- [ ] Add `.dockerignore` and verify secrets are not included in images.

### Part B — Compose

- [ ] Define local Compose services for frontend/API/worker/Redis and a transaction-capable MongoDB setup or documented managed connection.
- [ ] Use internal networks, volumes, and health checks.
- [ ] Keep MongoDB and Redis off the public network.
- [ ] Supply a safe `.env.example`.
- [ ] Document local commands for build/start/stop/logs/test/cleanup.

### Part C — Verify

- [ ] Start from a fresh checkout following only the README.
- [ ] Run existing user workflows and Stage 2 realtime updates.
- [ ] Test one GitHub webhook to worker processing path in a test environment.
- [ ] Restart API/worker/Redis separately and verify recovery.
- [ ] Check container logs and resource usage.

## Interview questions

1. What is Docker and what problem does it solve?
2. What is the difference between an image and container?
3. What is Docker Compose?
4. Why are volumes useful?
5. Why use multi-stage builds?
6. What is the difference between a container being alive and ready?

**Done when:** a new developer can start a complete development/test environment from the repository documentation, and the API/worker/realtime flows work after container restarts.

---

# M30 — CI/CD With GitHub Actions

## Objective

Automate checks on code changes and support safe, repeatable deployment.

## Prerequisites

- M29 images and environment instructions verified.
- Unit/integration/E2E test commands working locally.

## Learn first

- CI vs. CD vs. continuous deployment.
- GitHub Actions workflows, jobs, runners, artifacts, caching.
- Secrets, environment approvals, and least-privilege tokens.
- Protected branches, pinned action versions, staged rollout and rollback.

## Coding tasks

### Part A — Continuous integration

- [ ] Add a GitHub Actions workflow for pull requests.
- [ ] Use dependency lockfiles and reliable install commands.
- [ ] Run lint, type checks, unit tests, and backend/frontend builds.
- [ ] Run integration tests with isolated test database/Redis services.
- [ ] Add selected Playwright E2E tests where practical.
- [ ] Keep test logs/artifacts useful but free from secrets.
- [ ] Configure branch protection to require passing checks where available.

### Part B — Security

- [ ] Minimize `GITHUB_TOKEN` permissions.
- [ ] Pin third-party actions to reviewed commit SHAs.
- [ ] Protect secrets from workflows triggered by untrusted pull requests.
- [ ] Separate staging and production secrets/environments.
- [ ] Prefer short-lived cloud credentials/OIDC when supported.

### Part C — Deployment

- [ ] Build a versioned artifact or container image.
- [ ] Deploy it to staging first.
- [ ] Run smoke tests: auth, project/task APIs, Socket.IO, GitHub integration, and worker health.
- [ ] Add explicit production approval/branch restrictions.
- [ ] Deploy only an approved build.
- [ ] Create a documented rollback procedure to a previous version.
- [ ] Practice rollback in staging.

## Tests to write/perform

- [ ] An intentionally failing test causes CI failure.
- [ ] An untrusted pull request cannot read production secrets.
- [ ] Passing code produces a reusable artifact/image.
- [ ] Staging smoke tests detect a broken deployment.
- [ ] Rollback restores the previously working version.

## Interview questions

1. What is CI/CD?
2. Why do we test pull requests before merging?
3. What is an artifact?
4. Why should production require an approval gate?
5. What is a rollback strategy?
6. Why pin GitHub Actions and restrict token permissions?

**Done when:** every pull request runs trusted checks, staging deployment is repeatable, and an approved release can be deployed and rolled back without manual guesswork.

---

# M31 — Monitoring, Security Review, and Production Release

## Objective

Deploy DevFlow for intended real users and be able to detect, diagnose, and recover from common failures.

## Prerequisites

- M30 CI/CD verified in staging.
- A suitable hosting setup for HTTPS, Node API, WebSockets, worker, Redis, and MongoDB.

## Learn first

- Structured logging, metrics, traces, and observability.
- Liveness vs. readiness and service-level objectives.
- Secret management and rotation.
- Backup and restore.
- Incident response and rollback.
- Basic production security hardening.

## Coding tasks

### Part A — Monitoring

- [ ] Add safe structured logs to API and workers.
- [ ] Add request/correlation IDs and webhook delivery/job IDs to diagnostics.
- [ ] Expose liveness and readiness checks as appropriate.
- [ ] Collect API latency/errors, queue backlog/failures, and integration health.
- [ ] Monitor Socket.IO connection behavior and database/Redis availability.
- [ ] Create alerts for sustained error rate, failed workers, webhook backlog, and unavailable services.
- [ ] Ensure logs do not contain session tokens, passwords, secrets, or private raw payloads.

### Part B — Security and recovery

- [ ] Re-run Stage 1/2 permission and CSRF regression tests.
- [ ] Verify GitHub App permission scope and webhook signature handling.
- [ ] Check HTTPS/TLS, secure cookies, CORS/origin rules, and reverse-proxy settings.
- [ ] Verify database/Redis access controls and secret management.
- [ ] Review dependency vulnerabilities and container image updates.
- [ ] Configure database backups and test a restore in a safe environment.
- [ ] Test rollback after a deliberately broken staging deployment.

### Part C — Release

- [ ] Run the full automated test suite.
- [ ] Run production-like smoke tests and selected load tests.
- [ ] Verify all Stage 3 acceptance scenarios and all earlier core workflows.
- [ ] Deploy a tagged release.
- [ ] Confirm monitoring shows expected normal traffic and healthy workers.
- [ ] Write deployment, operations, incident-response, and rollback instructions.
- [ ] Update README, API docs, data diagrams, engineering notes, and release notes.
- [ ] Prepare a portfolio summary with real measurements and design trade-offs.

## Tests to write/perform

- [ ] Intentionally fail a noncritical worker in staging: failure is visible and recoverable.
- [ ] Invalid webhook signature is rejected and logged safely.
- [ ] MongoDB/Redis temporary unavailability is detectable.
- [ ] Backup restore works on test data.
- [ ] A released user can log in, use boards/sprints, receive updates, and view integration/analytics.
- [ ] Production release is reversible using documented steps.

## Interview questions

1. What is observability?
2. What is the difference between logs, metrics, and traces?
3. What is a health check?
4. What happens if MongoDB or Redis goes down?
5. How do you know your deployment is healthy?
6. What is a backup restoration test?
7. How would you investigate a production incident?
8. How does DevFlow's architecture handle increased load?

**Done when:** DevFlow is securely released for intended use, operational failures can be detected and investigated, backups/rollback are tested, and the deployment is documented.

---

## 3. Stage 3 progress tracker

- [ ] Preflight checkpoint — Stage 2 baseline verified
- [ ] M24 — GitHub App integration and PR links
- [ ] M25 — Webhooks and durable event handling
- [ ] M26 — Redis/BullMQ and worker recovery
- [ ] M27 — Performance baseline and improvements
- [ ] M28 — Advanced analytics
- [ ] M29 — Docker environments
- [ ] M30 — CI/CD and deployment gates
- [ ] M31 — Monitoring and production release

## 4. Definition of done for **every** milestone

- [ ] Required features work against the actual approved requirements.
- [ ] No previously working Stage 1/2 feature was broken.
- [ ] Authentication, CSRF, workspace/project RBAC, and data isolation still apply.
- [ ] The UI follows `docs/UI_UX_DESIGN.md` and both approved themes.
- [ ] Validation and failure cases have been handled.
- [ ] Relevant unit/integration/E2E tests pass.
- [ ] Any new external data collection has a clear retention and access policy.
- [ ] Documentation and configuration examples are updated.
- [ ] I can explain the engineering trade-offs in my own words.
- [ ] Changes are committed in understandable Git commits.

## 5. Stage 3 final acceptance checklist

| Area | Must be demonstrated |
|---|---|
| Existing product | Stage 1/2 authentication, projects, boards, sprints, comments, notifications, dependencies, and realtime behavior still work |
| GitHub | Authorized connection and PR linking; revoked access handled |
| Webhooks | Verified signatures, durable receipts, deduplication, retry/reconciliation |
| Jobs | Separate workers, bounded retries, idempotency, restart recovery |
| Performance | Real benchmark reports with methodology and before/after results |
| Analytics | Correct project/sprint trends and permission checks |
| Containers | Fresh environment boots from documented setup |
| CI/CD | PR checks, safe staging deploy, approved production deploy, rollback |
| Operations | Logging, monitoring, alerts, backups, restoration, incident instructions |
| Security | No exposed tokens/secrets; current RBAC/CSRF/tenant isolation verified |
| Documentation | Technical design, new API contracts, architecture decisions, and release notes updated |

**Stage 3 is not complete merely because an application is online.** It is complete when the essential workflows are still correct, new integrations are reliable, and there is evidence the system can be maintained safely.

## 6. Interview preparation method

For every milestone, record a short engineering note with:

1. **Problem:** What was the real technical issue?
2. **Solution:** What did I build?
3. **Theory:** Which computer science/software engineering concept applies?
4. **Trade-offs:** What alternatives did I consider?
5. **Failure:** What happens when this component fails?
6. **Testing:** How did I prove it works?
7. **Evidence:** Measurements, screenshots, relevant PRs, or test results.

Examples of strong project stories include: preventing duplicate GitHub webhook effects, recovering worker jobs after a crash, measuring a slow MongoDB query, and rolling back a failed deployment.

## 7. Suggested documentation files to maintain

```text
docs/
  STAGE3_TECHNICAL_DESIGN.md
  STAGE3_DEVELOPMENT_MILESTONES.md
  stage3/
    GITHUB_INTEGRATION_API.md
    WEBHOOK_EVENT_RULES.md
    PERFORMANCE_REPORT.md
    DEPLOYMENT_GUIDE.md
    RUNBOOK.md
    ADRs/
```

These are development/operations records, not new product features. Keep the existing Stage 1/2 documents unchanged unless a future change is separately approved.

## 8. Recommended starting action

**Begin with the Stage 2 preflight checkpoint, then M24.** Do not start installing Redis, Docker, or a monitoring platform before you understand the current repository and the GitHub integration you are about to add.

**Document status:** Draft awaiting approval. The proposed milestones remain within the existing approved Stage 3 scope.
