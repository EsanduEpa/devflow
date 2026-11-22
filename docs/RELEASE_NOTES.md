# DevFlow Stage 1 MVP release notes

Planned release tag `v1.0.0-mvp`.

## Included

- Registration, session login and logout, profiles, password changes, and email-based password recovery.
- Private workspaces, shareable invitations, workspace roles, and project membership.
- Project creation, manager reassignment, archive and restore, and a dashboard calculated from saved tasks.
- Task creation, assignment, editing, deletion, search, filters, and pagination. The five-column board uses role-aware status controls.
- Studio Light and Studio Dark, workspace switching, and responsive task details.
- Repeatable local setup, documented REST contracts, and backend and browser verification.

## Current limits

Board changes appear for other users after a refresh or refetch. On the board, status changes use the **Move to** control. Owners share invitation links directly. Task search supports title words and exact task IDs. Real password-reset delivery requires a configured SMTP provider. The release supports the documented local setup and requires a transaction-capable MongoDB deployment.

## Planned Stage 2

The project scope puts sprints, comments, activity history, notifications, and real-time collaboration in later work. [Approved project scope](PROJECT_SCOPE.md#stage-2--advanced-team-collaboration)

## Publish after the M15 pull request is merged

Update local `main` and confirm its tip contains the verified M15 release changes. Then create and push the annotated tag.

```sh
git switch main
git pull --ff-only origin main
git log -1 --oneline
```

```sh
git tag -a v1.0.0-mvp -m "DevFlow Stage 1 MVP"
git push origin refs/tags/v1.0.0-mvp
```

Use this file for the GitHub release description. [Verification record](engineering-notes/008-mvp-verification.md)
