# DevFlow release notes

## Stage 2 collaboration · `v1.1.0-collaboration` (proposed)

- Plan sprints, track progress, and roll unfinished tasks into a later sprint or the backlog. Completed sprints keep their progress at completion.
- Add task comments and mentions, see task history in Activity, and track dependencies with cycle prevention.
- Move cards by drag and drop or the keyboard. Recover a task draft if someone else saved a change first.
- See authorized project changes live and catch up after reconnecting. The bell opens over the current page and shows assignment, mention, review, reopened task, deadline, and invitation notifications.
- Combine sprint, dependency, and existing task filters. Open filtered lists from the dashboard.

Existing tasks open with no sprint and version zero when those fields are absent. Activity starts with changes recorded in Stage 2. Live updates use a single backend process and refetch from REST after reconnect. [Setup and upgrade procedure](STAGE2_RELEASE.md) · [Stage 2 demo](DEMO.md#stage-2-collaboration-demo) · [Verification](engineering-notes/020-m26-stage2-verification.md)

## Stage 1 MVP · `v1.0.0-mvp`

### Included

- Registration, session login and logout, profiles, password changes, and email-based password recovery.
- Private workspaces, shareable invitations, workspace roles, and project membership.
- Project creation, manager reassignment, archive and restore, and a dashboard calculated from saved tasks.
- Task creation, assignment, editing, deletion, search, filters, and pagination. The five-column board uses role-aware status controls.
- Studio Light and Studio Dark, workspace switching, and responsive task details.
- Repeatable local setup, documented REST contracts, and backend and browser verification.

### Stage 1 limits

Board changes appear for other users after a refresh or refetch. On the board, status changes use the **Move to** control. Owners share invitation links directly. Task search supports title words and exact task IDs. Real password-reset delivery requires a configured SMTP provider. The release supports the documented local setup and requires a transaction-capable MongoDB deployment.

[Stage 1 verification record](engineering-notes/008-mvp-verification.md)
