# M23 authorized live updates

The Express HTTP server also serves Socket.IO over WebSocket. Vite forwards the Socket.IO path to the API target. The handshake uses the same cookie and session validation as REST, plus the configured browser origin allowlist. Room names derive from project IDs checked against current access.

## Implementation decisions

- REST remains the entry point for changes. After commit, task edits and moves, comments, sprint and dependency changes, task deletion, and project or membership changes enqueue routing-only signals. Event payloads carry project and task identifiers, the kind, and a task version where applicable.
- The single-server queue orders access-changing commits with subscription checks, per-recipient validation and emission. The server rechecks session expiry and access before delivery. Login rotation, logout, password revocation, and project or workspace access changes trigger a post-commit sweep. A periodic sweep also checks idle sessions. The queue and rooms apply to the single-server Stage 2 deployment.
- The client batches invalidations for the current project, ignores repeated event IDs, and fetches saved state through the authorized REST API. Project navigation unsubscribes and disconnects the old socket. Reconnect authenticates again and resubscribes before refreshing. Access revocation clears scoped data and hides the project view. Socket.IO signals use the default delivery semantics, so refreshing after reconnect covers missed messages. [Socket.IO rooms](https://socket.io/docs/v4/rooms/) · [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)

[Event contract](../API_REFERENCE.md#project-live-updates) · [Manual walkthrough](../DEMO.md#m23-live-update-walkthrough)

## Verification

Checks used Node.js 24, isolated collections in the configured Atlas test database, and Playwright’s pinned Chromium build.

| Command | Result |
| --- | --- |
| `npm --prefix backend run typecheck` | Passed |
| `npm --prefix backend run build` | Passed |
| `npm --prefix backend test` | 15 passed |
| `npm --prefix backend run test:db` | 68 passed, including 3 live integration cases |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix backend run test:e2e -- --workers=3` | All 11 passed, including the M23 two-session workflow |

Socket integration verified the origin and cookie checks, denied an outsider, and matched committed event payloads across two authorized sockets. A rejected stale write produced no signal. The suite exercised unsubscribe, connected access removal, logout, and expiry of an idle socket.

The first browser reconnect check simulated closure through a WebSocket route and observed no new subscription. The revised check interrupts the real transport while the viewer is offline, then observes a fresh subscription and verifies the missed status and comment changes in the UI. It also confirms that revocation clears the open drawer and board. A separate Vite smoke test forwarded both the REST health endpoint and an authenticated WebSocket subscription to the same isolated backend.
