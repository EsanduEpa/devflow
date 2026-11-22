# DevFlow — UI/UX Design Specification

**Project:** DevFlow  
**Development stage:** Stage 1 — MERN MVP  
**Document:** `UI_UX_DESIGN.md`  
**Version:** 1.0  
**Status:** Confirmed visual direction; implementation reference  
**Design direction:** Studio Light + Studio Dark, Linear-inspired application layout, Jira-inspired Kanban organization  
**Related approved documents:** `PROJECT_SCOPE.md`, `SRS.md`, `SYSTEM_DESIGN.md`, `DATABASE_DESIGN.md`, `API_DESIGN.md`, `DEVELOPMENT_MILESTONES.md`

> **Purpose:** This document is the UI/UX source of truth while developing DevFlow. Read it before designing a page or component. It defines **how existing approved Stage 1 features should look and behave**. It does not change the approved business scope, API contracts, database design, or milestone plan.

---

## 1. Product experience and goals

DevFlow is a collaborative software development management web app. Its interface should feel like a **professional developer tool** rather than a generic admin template.

The interface should be:

1. **Clean:** show important information first; avoid unnecessary decoration.
2. **Focused:** help the user create projects, manage tasks, and check progress with few steps.
3. **Consistent:** use the same components, spacing, forms, and interaction patterns on every page.
4. **Readable:** support dense task information without making text tiny or crowded.
5. **Predictable:** navigation, saving, loading, and errors should behave the same way everywhere.
6. **Responsive:** work on desktop, tablet, and mobile browsers.
7. **Accessible:** provide visible focus, keyboard navigation, labels, and sufficient contrast.
8. **Permission-aware:** show actions that users are allowed to perform, while the **backend always enforces** permissions.

### What the reference products contribute

- **Linear-inspired:** a compact but readable sidebar, clear page hierarchy, focused content, restrained color, and fast task navigation.
- **Jira-inspired:** clear separation of projects, task details, status groups, and the familiar five-column Kanban board.
- **DevFlow's own identity:** indigo accents, Studio Light/Studio Dark themes, consistent component rules, and the approved DevFlow workflows.

**Do not clone another product's exact UI.** Use these ideas as inspiration, not as assets or pixel-perfect templates.

---

## 2. Confirmed visual style

The **two confirmed themes** are:

- **Studio Light:** bright, spacious, professional.
- **Studio Dark:** deep navy, focused, comfortable for long working sessions.

Both themes must use **the same layout, components, content, navigation, and interactions**. Only theme color values and related visual treatments change.

Other confirmed choices:

| UI property | Rule |
|---|---|
| Overall appearance | Minimal, modern, developer-focused |
| Main accent | Indigo |
| Typography | Inter or a similarly clean sans-serif font |
| Navigation | Persistent left sidebar on desktop |
| Icons | Lucide icon set |
| Surfaces | Mostly flat, with subtle borders and small radii |
| Cards | Light borders; minimal or no shadows |
| Content density | Compact but readable |
| Desktop task details | Right-side panel/drawer from a board or list |
| Mobile task details | Full-screen task view |
| Responsive layout | Desktop, tablet, and mobile web |
| Kanban status change in Stage 1 | Dropdown or action menu, **not drag-and-drop** |

### 2.1 Color tokens

Use **semantic color tokens**, not repeated hard-coded colors inside individual components. The following values form the starting design system and should remain visually consistent.

| Semantic token | Studio Light | Studio Dark | Use |
|---|---|---|---|
| `--bg-app` | `#F8FAFC` | `#0B1220` | Main page background |
| `--bg-surface` | `#FFFFFF` | `#172033` | Cards, sidebar, dialogs, panels |
| `--bg-muted` | `#F1F5F9` | `#1E293B` | Secondary surfaces, hover backgrounds |
| `--text-primary` | `#111827` | `#F8FAFC` | Titles, main content |
| `--text-secondary` | `#64748B` | `#CBD5E1` | Supporting text |
| `--text-muted` | `#94A3B8` | `#94A3B8` | Lower-priority metadata, only where contrast is acceptable |
| `--border` | `#E2E8F0` | `#334155` | Dividers, inputs, card outlines |
| `--accent` | `#4F46E5` | `#6366F1` | Links, selected nav, icons, focus accent |
| `--accent-subtle` | `#EEF2FF` | `#252A51` | Selected and highlighted surfaces |
| `--success` | `#047857` | `#6EE7B7` | Completed states and positive feedback |
| `--success-subtle` | `#ECFDF5` | `#123B37` | Light success backgrounds |
| `--warning` | `#B45309` | `#FBBF24` | Warnings and review signals |
| `--danger` | `#B91C1C` | `#FCA5A5` | Errors and destructive actions |

**Accessibility rule:** Check contrast in the implemented UI. A color that works for an icon or background may not be suitable for small text. Adjust foreground shades for contrast without changing the confirmed overall theme character. Standard text should aim for at least WCAG AA 4.5:1 contrast, and meaningful UI boundaries/focus indicators at least 3:1 where applicable.

### 2.2 Task priority and status colors

Color should help recognition, **never be the only way to identify a state**. Always show the status/priority text.

**Priorities:**

| Value | Label | Visual guidance |
|---|---|---|
| `LOW` | Low | Neutral gray |
| `MEDIUM` | Medium | Indigo or muted blue |
| `HIGH` | High | Amber/orange |
| `URGENT` | Urgent | Red |

**Statuses:**

| Value | Label | Visual guidance |
|---|---|---|
| `BACKLOG` | Backlog | Neutral gray |
| `TODO` | To Do | Slate/blue-gray |
| `IN_PROGRESS` | In Progress | Blue/indigo |
| `IN_REVIEW` | In Review | Amber |
| `DONE` | Done | Green |

Do not use a bright full-card background for each status. Use subtle dots, labels, badges, or small accent marks so the board stays calm.

### 2.3 Typography

- Preferred font: **Inter**, with system sans-serif fallbacks.
- Main page heading: **24–28 px**, semibold (600–700).
- Section heading: **18–20 px**, semibold.
- Card heading: **14–16 px**, semibold.
- Normal body text: **14–16 px**.
- Form labels: **13–14 px**, medium.
- Helper text and metadata: **12–13 px**, if readable and high contrast.
- Avoid using all-uppercase paragraphs.
- Use consistent line height (approximately **1.4–1.6** for body text).
- Use tabular numerals for task counts and dashboard statistics where available.
- Do not rely on different font families to distinguish feature areas.

### 2.4 Spacing and shapes

Use a **4 px spacing scale**, especially these steps: 4, 8, 12, 16, 20, 24, 32, 40, and 48 px.

Recommended defaults:

- Page padding: **24–32 px desktop**, **16–24 px tablet**, **16 px mobile**.
- Card padding: **16–20 px**.
- Form field vertical gap: **16 px**.
- Space between major page sections: **24–32 px**.
- Button height: approximately **36–40 px**, with larger touch-friendly controls on mobile.
- Input height: approximately **40–44 px**.
- Small radius: **6 px**; standard card/input radius: **8 px**; dialog radius: **10–12 px**.
- Borders: typically **1 px** using `--border`.
- Shadows: minimal; reserve stronger elevation for popovers, menus, and dialogs.

Choose one set of values when implementing the component library, then reuse it everywhere.

---

## 3. Layout and navigation

### 3.1 Desktop application shell

On desktop, use a **left sidebar + top content header + main content area**.

```text
┌─────────────────────┬──────────────────────────────────────────────┐
│ DevFlow             │ Workspace / Project breadcrumb   User menu  │
│ [Workspace switcher]├──────────────────────────────────────────────┤
│                     │ Page title                    Primary action │
│ Overview            │                                              │
│ Projects            │ Main content                                 │
│ Members*            │ (cards, lists, board, forms, details)        │
│ Settings*           │                                              │
│                     │                                              │
└─────────────────────┴──────────────────────────────────────────────┘
```

`*` Show items only where the selected user's role and resource access make them relevant.

**Sidebar rules:**

- Width approximately **232–256 px** expanded.
- Brand and workspace switcher at the top.
- Clear active-page indicator using the subtle indigo selection surface.
- Main links for workspace overview, projects, and allowed workspace administration areas.
- The project context may show **Dashboard**, **Board**, and **Settings** navigation.
- Do not duplicate the entire navigation inside the content header.
- Sidebar may be collapsible, but this is optional UI behavior; it must not block the MVP.

**Header rules:**

- Show where the user is: workspace name, project name, or breadcrumb.
- Show a clear page title.
- Place the main action on the right on desktop (for example **New Project** or **New Task**).
- The account/profile menu should be consistent across screens.

### 3.2 Mobile and tablet navigation

- On narrow widths, replace the permanent sidebar with a **menu/drawer** opened from the top bar.
- Preserve access to workspace switching and the same allowed destinations.
- Do not hide an essential action exclusively on hover.
- Forms and cards stack in one column.
- Secondary actions may move into an overflow menu with accessible labels.
- Kanban should support **horizontal scrolling across its five columns** (or a clear column selector if needed for the screen size). Statuses must remain recognizable.
- Task detail panels should become **full-screen views** on mobile.

### 3.3 Suggested responsive breakpoints

These are implementation guidelines, not extra functional requirements:

| Viewport | Suggested behavior |
|---|---|
| Under 640 px | Mobile navigation; stacked forms/cards; full-screen task details |
| 640–1023 px | Tablet layout; drawer or compact sidebar; adaptive card grid |
| 1024 px and above | Persistent sidebar; multi-column content; right task drawer |

Always test actual content width and long text rather than assuming breakpoints alone solve responsiveness.

---

## 4. Reusable UI components

Develop common components so each screen follows the same design rules. These can be organized under shared frontend components without changing the approved backend structure.

| Component | Required behavior / appearance |
|---|---|
| `AppShell` | Sidebar, header, content area, mobile navigation |
| `WorkspaceSwitcher` | Show selected workspace; choose from workspaces user belongs to |
| `PageHeader` | Title, short context, one primary action when relevant |
| `Button` | Primary, secondary, text, and destructive variants; visible loading/disabled states |
| `TextInput` / `Textarea` | Label, required indicator where applicable, helper text, error text |
| `Select` | Clear selected value; keyboard accessible; default and empty states |
| `DateInput` | Accept calendar date `YYYY-MM-DD`; display without time-zone shift |
| `Card` | Consistent border, padding, and heading layout |
| `StatusBadge` | Status text plus subtle semantic color |
| `PriorityBadge` | Priority text plus subtle semantic color |
| `TaskCard` | Title, assignee, priority, status context, optional due date |
| `TaskDrawer` | Desktop task details with close control and safe focus handling |
| `Dialog` | Used for short creation/confirmation flows, accessible focus and close behavior |
| `DataList` / `DataTable` | Readable rows, empty/loading/error states, pagination where needed |
| `SearchAndFilters` | Search input, supported filters, clear-filter control |
| `StatCard` | Label, numeric value, optional small contextual text |
| `Toast` / `InlineAlert` | Success and error feedback without obscuring task context |
| `LoadingState` | Skeleton or progress indicator appropriate to the layout |
| `EmptyState` | Explains absence of data and offers a valid next action |
| `ErrorState` | Clear message and safe retry/navigation action |

### 4.1 Button hierarchy

- **Primary:** one main action per page/region, such as Create Workspace or Create Task.
- **Secondary:** less-important valid actions, such as Cancel or Edit.
- **Text/ghost:** minor navigation or contextual actions.
- **Destructive:** Remove Member or Delete Task; use danger styling and confirmation.
- Do not use several visually competing primary buttons in the same region.
- During submission, show loading and prevent accidental repeated submissions.

### 4.2 Forms

Every form should:

1. Display persistent labels above fields.
2. Mark required fields clearly; optional fields need not pretend to be required.
3. Use the exact field types, limits, and enums from the approved API design.
4. Show inline validation near the relevant field.
5. Keep entered values when an API request fails.
6. Show a loading state while submitting.
7. Show success only **after** the server confirms it.
8. Provide Cancel/Back behavior when applicable.
9. Never expose secret tokens or passwords in visible logs or error messages.

### 4.3 Feedback states

Design each data-driven screen with the following states:

- **Loading:** use skeletons or a small progress indicator rather than blank space.
- **Empty:** explain what is missing and give an authorized action where relevant.
- **Success:** show a brief success notification or updated result.
- **Validation error:** explain which fields need changes.
- **Permission denied:** show a neutral, understandable message; do not reveal private resource details.
- **Server/network error:** keep the existing valid data visible where possible, show Retry if safe.
- **Session expired:** guide the user to log in again.

---

## 5. Screen-by-screen UI specifications

These screens come from the approved Stage 1 SRS and API design. A screen may be implemented as a page, dialog, or panel where indicated. Do not add new business functions to make the screens look fuller.

### UI-01 — Registration

**Purpose:** Create a DevFlow account.

**Layout:** Simple centered form/card with DevFlow logo, minimal background, clear heading. Do not show the workspace sidebar before login.

**Fields:** Full name, email, password.

**Actions:** Register; link to Log In.

**Rules:**

- Show approved API validation errors, including duplicate email.
- Do not reveal password value after submission or log it.
- After successful registration, guide the user to log in (registration does not automatically create a session).
- Keep the page usable on mobile.

### UI-02 — Login

**Purpose:** Authenticate an existing user.

**Layout:** Match Registration visually.

**Fields:** Email, password.

**Actions:** Log In; Forgot Password; link to Register.

**Rules:**

- Show a generic invalid-credentials message.
- Use an accessible password visibility control if implemented.
- Show progress during login and avoid repeated submission.
- After success, navigate to workspace selection or the user's allowed workspace context.

### UI-03 — Password Recovery and Reset

**Purpose:** Support the approved basic account recovery flow.

**Views:** Request reset link; set a new password from a valid link.

**Rules:**

- The request screen always uses the approved generic response so the interface does not reveal whether an email exists.
- The reset screen explains invalid or expired links without showing token values.
- After a successful reset, guide the user to log in again.

### UI-04 — Profile and Password Change

**Purpose:** Manage the current account.

**Sections:** Basic profile, email, biography, password change.

**Rules:**

- Display name/email from the authenticated user API.
- Use the approved current-password requirement when changing email or password.
- Save profile and password changes using their separate approved APIs.
- Show clear success/error messages.
- If changing the password invalidates the session, redirect to login with an explanation.

### UI-05 — Workspace Selection and Creation

**Purpose:** Allow a user to create or choose one of their workspaces.

**Layout:** Simple list or card grid, with workspace name, short description, and an obvious **Create Workspace** action.

**Rules:**

- If the user has no workspaces, display a useful empty state.
- Workspace creation requires name and optionally description.
- After creation, enter the new workspace.
- Never show workspaces the user cannot access.
- Workspace switching must update navigation and visible project context.

### UI-06 — Workspace Overview

**Purpose:** Show workspace context and help users reach their projects and allowed administration areas.

**Layout:** Workspace title and description, simple project navigation, and links to permitted actions.

**Rules:**

- Keep this page lightweight; the approved Stage 1 analytics are at the **project** level.
- Do not add unapproved organization analytics or advanced charts.
- Show a clear next action when the workspace has no projects.

### UI-07 — Workspace Settings and Members

**Purpose:** Edit workspace information and manage workspace membership.

**Layout:** Tab/section arrangement for workspace details, Members, and Invitations.

**For Owners:** Editable name/description, invitation creation, member role controls, and removal actions.

**For Managers/Developers:** Show only views and actions allowed by the approved API/role rules.

**Rules:**

- Member rows show name, email where authorized, and role.
- The designated Owner cannot be removed or downgraded.
- When a role change or removal conflicts with an assigned project manager, show the backend's manager-replacement requirement; do not silently proceed.
- Removing a member requires confirmation and explanation that tasks are retained and may become unassigned.
- Do not add workspace ownership transfer or deletion.

### UI-08 — Workspace Invitations

**Purpose:** Create, view, and accept workspace invitations.

**Owner views:** Invite by email and MANAGER/DEVELOPER role; list invitations with status and expiry.

**Invitee view:** Display workspace name, intended role, masked email, and an **Accept Invitation** button.

**Rules:**

- Invitation creation can show the secure acceptance link for sharing, as defined by the API.
- Do not expose invitation token values in the ordinary invitation list.
- Show expired/used invitation states clearly.
- Require login/register before accepting where necessary.
- A user cannot accept an invitation for another email address.
- Do not include unapproved invitation management actions such as resend/revoke buttons unless the API design is formally extended.

### UI-09 — Project List

**Purpose:** Find and open projects available to the user.

**Layout:** Title, project status filter, **New Project** action for authorized users, project cards or compact rows.

**Project item:** Name, description excerpt, status, manager, dates if available.

**Rules:**

- Owners see all workspace projects; Managers/Developers see projects they can access.
- Archived projects are excluded by default and can be included by the approved status filter.
- Empty state prompts authorized users to create a project; otherwise explains that no accessible projects exist.
- Project creation uses approved required fields and manager eligibility rules.

### UI-10 — Project Dashboard

**Purpose:** Show progress of a single project.

**Layout:** Project title, status, contextual tabs (Dashboard, Board, Settings if allowed), and a compact grid of statistics.

**Required statistics:**

- Total Tasks
- Completed Tasks
- In Progress Tasks
- Overdue Tasks
- Completion Percentage

**Rules:**

- Use plain stat cards and a simple progress bar; no complex analytics are required.
- A project with zero tasks shows **0% completion**.
- Overdue counts use the approved UTC calendar-date rule.
- Read values from the dashboard API; do not calculate inconsistent totals from a single page of tasks.
- Show loading, empty, and error states.

### UI-11 — Project Settings and Membership

**Purpose:** Update project details, its manager, membership, and status.

**Sections:** Details, Members, Project Status.

**Rules:**

- Only Owners and the assigned Project Manager can modify project settings.
- Show eligibility of workspace members when choosing the project manager or adding project members.
- When replacing a project manager, use the approved API and display errors clearly.
- Archived projects remain viewable but cannot accept task changes until restored.
- Archiving is available; project deletion is not a Stage 1 UI action.

### UI-12 — Kanban Board

**Purpose:** Main task-management interface. This is the most polished Stage 1 work area.

**Desktop layout:** Five horizontal columns with compact task cards:

1. **Backlog** (`BACKLOG`)
2. **To Do** (`TODO`)
3. **In Progress** (`IN_PROGRESS`)
4. **In Review** (`IN_REVIEW`)
5. **Done** (`DONE`)

```text
Project: E-Commerce Platform                    [New Task]
[Search tasks] [Status] [Priority] [Assignee] [Clear]

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Backlog     │ │ To Do       │ │ In Progress │ │ In Review   │ │ Done        │
│ task card   │ │ task card   │ │ task card   │ │ task card   │ │ task card   │
│ task card   │ │ task card   │ │ task card   │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Task card information:**

- Task title (most prominent)
- Assignee or **Unassigned**
- Priority
- Due date, if set
- Status context comes from the containing column; no need for redundant large labels

**Interaction rules:**

- Clicking a task opens its details.
- Authorized status changes use a **dropdown or action menu**.
- No drag-and-drop in Stage 1; that remains Stage 2.
- For desktop, allow horizontal scrolling when all five columns do not fit comfortably.
- For mobile, allow horizontal scrolling or a clear column selector.
- Do not silently hide tasks because only the first paginated API result was loaded. Retrieve all relevant pages/column results as needed.
- Keep cards readable at narrow column widths.
- Show a clear column empty state when no tasks exist.
- If a save fails, show the error and retain the last confirmed task state.
- Task updates are **not live** across users in Stage 1; refetch when appropriate.

### UI-13 — Task Details

**Purpose:** View and manage one task.

**Layout:** Right-side drawer/panel from board/list on desktop; full-screen task detail view on mobile.

**Fields and display:**

- Task title and description
- Assignee (or Unassigned)
- Priority
- Status
- Due date
- Task ID (MongoDB ObjectId format in Stage 1)
- Creator and created/updated timestamps where returned by API

**Rules:**

- Only show editable controls allowed for the user's role and task context.
- Owners and assigned Project Managers can update approved task details and assignments.
- Developers can change only the permitted status of their own assigned tasks.
- Developers cannot approve a task as Done.
- Task status uses the dedicated status API; other edits use the task edit API.
- Destructive Delete Task is available only to authorized users and requires confirmation.
- If the project is archived, show task content read-only and explain why edits are unavailable.
- Provide a clear Close/Back action and preserve board position when possible.
- Do not show comment or activity-history panels yet; those are Stage 2.

### UI-14 — Task Creation

**Purpose:** Create a task inside an accessible project.

**Layout:** Short modal/drawer for typical desktop creation; full-screen form if necessary on mobile.

**Manager/Owner inputs:** Title, description, assignee, priority, status, due date.

**Developer inputs:** Title and description. Defaults are applied to other fields by the backend, according to the approved API contract.

**Rules:**

- Required title should be obvious.
- Assignee dropdown includes only eligible project members.
- Show supported priority and status values exactly.
- On success, update/refetch the board or task list.
- On failure, retain entered form data.

### UI-15 — Task Search and Filters

**Purpose:** Find tasks in an accessible project.

**Controls:** Search title or exact task ID; Status, Priority, and Assignee filters; Clear Filters.

**Rules:**

- Multiple filters must be combinable.
- Show active filters clearly.
- Show a friendly empty-results state.
- Use the approved paginated task-list API.
- Do not add filters not supported by Stage 1 APIs.
- Avoid firing excessive requests on each keystroke; use a small debounce or an explicit search submit.

---

## 6. Permission-aware UI rules

The backend API is the final authority. The UI should avoid showing controls the user cannot use, but hiding controls is **not** a substitute for backend authorization.

| Action | Owner | Assigned Project Manager | Developer |
|---|---|---|---|
| Create workspace | Yes (any authenticated user may create their own) | Yes (as a logged-in user) | Yes (as a logged-in user) |
| Edit workspace details | Yes | No | No |
| Invite or manage workspace members | Yes | No | No |
| Create project | Yes | Yes, within workspace rules | No |
| Edit project / manage project members | Yes | Their managed projects | No |
| Create task | Yes | Yes | Yes, in accessible project (limited fields) |
| Assign task and edit management fields | Yes | Their managed projects | No |
| Update assigned task status | Yes | Yes | Yes, for own task and permitted statuses |
| Approve task as Done | Yes | Their managed projects | No |
| Delete task | Yes | Their managed projects | No |
| View dashboard/board | Authorized projects | Authorized projects | Authorized projects |

**UI behavior for denied actions:** either omit the control entirely or display it disabled with a short, helpful explanation. Do not show a clickable control that repeatedly sends a knowingly unauthorized request.

**Important:** A user's role is workspace-specific. Do not display one global role across all workspaces.

---

## 7. Navigation flow

```text
Unauthenticated
  ├── Register → Login
  ├── Login → Workspace Selection / selected workspace
  └── Forgot Password → Reset Password → Login

Authenticated
  ├── Profile
  └── Workspace Selection
        ├── Create Workspace
        └── Open Workspace
              ├── Overview
              ├── Projects
              │     ├── Create Project (authorized)
              │     └── Open Project
              │           ├── Dashboard
              │           ├── Board → Task Details / Create Task
              │           └── Settings / Members (authorized)
              └── Workspace Settings / Members / Invitations (role-based)
```

### Suggested frontend routes

These are **frontend navigation suggestions**, not changes to the approved REST API.

| UI route pattern | Screen |
|---|---|
| `/register` | Register |
| `/login` | Login |
| `/forgot-password` | Request password reset |
| `/reset-password` | Complete password reset |
| `/workspaces` | Workspace selection |
| `/workspaces/:workspaceId` | Workspace overview |
| `/workspaces/:workspaceId/projects` | Project list |
| `/workspaces/:workspaceId/settings` | Workspace settings/members/invitations |
| `/projects/:projectId/dashboard` | Project dashboard |
| `/projects/:projectId/board` | Kanban board |
| `/projects/:projectId/settings` | Project settings/members |
| `/profile` | Profile/password change |
| `/invitations/:token` | Invitation preview/acceptance |

Task details may appear as a drawer on desktop and a full-screen view on mobile. A route for direct task linking may be added as a **frontend routing detail** without changing task functionality or its API.

---

## 8. UX behavior rules for important workflows

### 8.1 Creating a project

1. User selects **New Project**.
2. Form shows only allowed fields from the approved API.
3. Manager selection includes eligible users only.
4. Client validation displays inline errors.
5. Submit shows loading.
6. On success, close the form and open or update the project list.
7. On failure, keep data in the form and show the error.

### 8.2 Creating and assigning a task

1. User opens a project and selects **New Task**.
2. Form adjusts to their approved role permissions.
3. Eligible assignees are loaded from project members.
4. Backend validates permissions and assignment.
5. Successful save returns the created task.
6. Board/list refetches or updates using the server-confirmed result.

### 8.3 Updating task status

1. User opens task details or its status action menu.
2. UI shows only permitted target statuses.
3. User chooses a status.
4. Backend confirms or rejects the change.
5. On success, the task appears under the new column.
6. On failure, return to the confirmed status and explain the problem.

### 8.4 Removing a member

1. Authorized Owner/Manager selects Remove where allowed.
2. Show a confirmation dialog with the member's name and impact on assignments.
3. Send the approved API request.
4. If manager replacement is required, show that reason and do not remove the user.
5. If successful, refresh membership and relevant task data.

### 8.5 Switching workspaces

1. User opens Workspace Switcher.
2. UI shows only their available workspaces.
3. User selects another workspace.
4. App navigates to that workspace's context.
5. Previously visible project/task information must not remain displayed as though it belongs to the new workspace.

---

## 9. Accessibility and usability standards

- All interactive elements must be reachable by keyboard.
- Show a clearly visible focus indicator.
- Use semantic headings, buttons, form labels, and appropriate accessible names.
- Dialogs and drawers should manage focus: move focus in when opened and return it sensibly when closed.
- Use `aria-live` or an appropriate announcement mechanism for important asynchronous feedback.
- Don't rely only on color to convey task status or priority.
- Use contrast-checked colors in **both** themes.
- Keep mobile tap targets comfortably usable, aiming near **44 × 44 px** for important touch controls where practical.
- Long task titles should wrap or truncate with access to the full title.
- Show errors next to their fields, not only in a toast.
- Avoid hover-only essential actions, excessive animation, and unnecessarily moving elements.
- Respect reduced-motion preferences for optional transitions.

---

## 10. Theme implementation rules

1. Implement design tokens centrally (CSS variables or Tailwind theme tokens).
2. Define both Studio Light and Studio Dark at the same time.
3. Components use semantic tokens such as `--bg-surface`, not raw page-specific hex values.
4. Theme switching must not affect application permissions or business state.
5. Existing forms, layouts, charts/stat cards, task cards, and dialogs must work in both themes.
6. Test text contrast, focus outlines, and disabled states in both themes.
7. Do not create different information architectures for light and dark modes.
8. A visible theme toggle can be provided in the user menu/settings as a presentation control; theme preference storage is an implementation detail, not a new business module.
9. Prefer no large gradients, oversized glows, or glassmorphism effects. Keep the interface focused on tasks.

---

## 11. Stage 1 exclusions — do not add these to the UI

The following are part of later approved stages and must **not** appear as working Stage 1 features:

**Stage 2:**

- Sprint management.
- Task comments or mention threads.
- Task activity history/timeline.
- Real-time updates, online presence, or live collaboration indicators.
- In-app notifications or notification center.
- Task dependencies or dependency graphs.
- Drag-and-drop Kanban movement.
- Advanced collaborative editing conflict-resolution screens.
- Advanced dashboards.

**Stage 3:**

- GitHub repository connections or pull-request linking.
- Redis/cache control panels.
- Background job dashboards.
- Advanced analytics.
- Deployment/monitoring dashboards.

Other previously excluded features, such as built-in code editor, live chat, video meetings, payroll, billing, and native mobile applications, remain outside scope.

**Do not put fake inactive navigation items for future features into the MVP** unless explicitly agreed later. The Stage 1 experience should feel complete using its actual available functionality.

---

## 12. Design-to-development order

Build the **shared foundation first**, then apply it to feature screens as the milestones reach them. This does not change the approved M0–M15 development order.

1. **Design tokens:** light/dark colors, typography, spacing, radii, focus treatment.
2. **Shared primitives:** Button, Input, Select, Badge, Card, Dialog, Alert, loading and empty states.
3. **App shell:** desktop sidebar, mobile drawer, workspace switcher, page header.
4. **Auth screens:** register, login, password recovery, profile.
5. **Workspace screens:** selection/creation, overview, settings, membership, invitations.
6. **Project screens:** list, create/edit, project settings and members.
7. **Task screens:** task create/edit form, task details drawer/page, Kanban board, search/filter controls.
8. **Project dashboard:** the five approved statistics and progress display.
9. **Final UI review:** responsive layouts, both themes, accessibility, loading/errors, permissions, and consistency.

**Practical tip:** Before implementing a new page, sketch its layout on paper or in Figma, then build it using the reusable components. Design work should guide development, not replace independent coding.

---

## 13. UI acceptance checklist

Use this checklist for every completed Stage 1 page and at the end of the MVP.

### Visual consistency

- [ ] Follows Studio Light and Studio Dark tokens.
- [ ] Uses consistent typography, spacing, radii, and icon style.
- [ ] Uses the shared application shell when authenticated.
- [ ] Has one obvious primary action when relevant.
- [ ] Uses subtle status and priority indicators rather than loud cards.

### Usability

- [ ] Navigation clearly indicates the current workspace and page.
- [ ] Important actions are discoverable without hover.
- [ ] Forms have labels, validation, loading, and useful error feedback.
- [ ] Empty, loading, error, and success states are handled.
- [ ] Data changes appear only after backend confirmation.

### Permissions and correctness

- [ ] Buttons/fields reflect the current user's approved permissions.
- [ ] Workspace and project data are never mixed after navigation.
- [ ] Role-sensitive controls match the approved API contract.
- [ ] Stage 2 and Stage 3 features have not been introduced.
- [ ] No page invents fields unsupported by the approved API/database design.

### Responsiveness and accessibility

- [ ] Works on desktop, tablet, and mobile widths.
- [ ] Kanban is usable with five statuses on small screens.
- [ ] Task details are a desktop drawer and mobile full-screen view.
- [ ] Keyboard interaction and visible focus work.
- [ ] Colors and text remain legible in both themes.
- [ ] Destructive actions have clear confirmation.

### Stage 1 feature checks

- [ ] Authentication and password recovery screens.
- [ ] Profile and password change screens.
- [ ] Workspace list/create/switch screens.
- [ ] Workspace settings/members/invitations screens.
- [ ] Project list/create/settings/members screens.
- [ ] Project dashboard with approved statistics.
- [ ] Five-column Kanban board with status dropdown/actions.
- [ ] Task create/details/edit/assignment screens.
- [ ] Task search, filtering, and pagination handling.

---

## 14. UI decision summary

| Decision | Confirmed rule |
|---|---|
| Product UI identity | Clean, compact developer-focused interface |
| Light theme | **Studio Light** |
| Dark theme | **Studio Dark** |
| Accent | Indigo |
| Type | Inter or clean system sans-serif |
| Iconography | Lucide |
| Desktop shell | Left sidebar with content header |
| Workspace navigation | Sidebar workspace switcher |
| Project navigation | Dashboard / Board / allowed Settings |
| Cards and panels | Subtle 1 px borders, small rounded corners, minimal shadows |
| Kanban | Five approved status columns |
| Stage 1 status change | Menu/dropdown, no drag-and-drop |
| Desktop task details | Right-side drawer/panel |
| Mobile task details | Full-screen view |
| Server-state behavior | Loading, error, and refetch/confirmed updates |
| Responsive support | Desktop, tablet, mobile browsers |
| Permission enforcement | UI adapts; Express backend remains authoritative |
| Change control | Changes to business features/APIs require separate approval; this file governs presentation |

---

## 15. How to use this document while coding

Before implementing any DevFlow screen:

1. Read the corresponding **UI-XX screen section** here.
2. Check related requirements in `SRS.md`.
3. Check the permitted actions and fields in `API_DESIGN.md`.
4. Use existing design tokens and reusable components.
5. Implement it yourself in React and TypeScript.
6. Test Studio Light and Studio Dark, desktop and mobile, and all screen states.
7. Complete the relevant UI checklist items and commit the working change.

If a design idea requires a new feature, field, role, or endpoint, **do not silently implement it**. Record it as a proposed change for separate approval. If it only changes presentation and follows this document, it can be implemented as normal UI work.

**Final design intent:** DevFlow should look like a dependable software team workspace—clear navigation, fast task workflows, a polished Kanban board, consistent light/dark themes, and minimal visual noise—while staying faithful to the approved Stage 1 MVP.

**End of `UI_UX_DESIGN.md`.**
