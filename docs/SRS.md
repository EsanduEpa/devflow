# Software Requirements Specification (SRS)
## DevFlow — Stage 1: Minimum Viable Product (MVP)

**Project Name:** DevFlow  
**Document Type:** Software Requirements Specification  
**Version:** 1.0  
**Date:** November 13, 2026  
**Development Stack:** MongoDB, Express.js, React, Node.js, TypeScript  
**Document Status:** Draft for Review  
**Based On:** Approved DevFlow Project Scope

---

# 1. Introduction

## 1.1 Purpose of This Document

This document explains the requirements for the first version of DevFlow.

It describes what the application must do, who can use it, what rules the system must follow, and how we will check whether the application works correctly.

This document will guide the design, development, and testing of the DevFlow MVP.

## 1.2 Project Overview

DevFlow is a web application that helps software development teams organize their projects and tasks.

It allows users to create workspaces, manage software projects, assign tasks to developers, and monitor development progress.

For example, a software company can create a workspace named "ABC Software", add its employees, create an "E-Commerce Website" project, and organize all development tasks inside that project.

Project managers can assign tasks to developers. Developers can view their work and update task statuses.

The team can use a Kanban board to see which tasks are pending, in progress, under review, or completed.

## 1.3 Main Objectives

The Stage 1 MVP must:

1. Provide secure user accounts.
2. Allow users to create and manage workspaces.
3. Support basic user roles and permissions.
4. Allow teams to create and manage projects.
5. Allow project managers to assign tasks.
6. Allow developers to track and update their work.
7. Display tasks using a Kanban board.
8. Provide a basic project progress dashboard.
9. Store and manage application data reliably.
10. Provide a working foundation for future advanced features.

## 1.4 Scope of Stage 1

The MVP includes:

- User registration, login, and logout.
- Basic user profile management.
- Password changes and basic account recovery.
- Workspace creation and management.
- Workspace membership and invitations.
- Basic role-based permissions.
- Project creation and management.
- Project membership.
- Task creation, editing, assignment, and deletion.
- Task priorities and statuses.
- Task searching and filtering.
- Kanban board.
- Basic project dashboard.
- Secure API access.
- Basic automated testing.

Features such as real-time collaboration, sprint management, notifications, GitHub integration, and advanced analytics are reserved for later development stages.

---

# 2. System Users

## 2.1 Workspace Owner / Admin

The Workspace Owner is responsible for managing the workspace and its members.

The Owner can:

- Create and manage the workspace.
- Edit workspace details.
- Invite new members.
- Manage workspace roles.
- Remove workspace members.
- Create and manage projects.
- View all projects inside the workspace.
- Manage tasks across the workspace.

The user who creates a workspace becomes its Owner.

## 2.2 Project Manager

A Project Manager is responsible for managing development work in projects they are assigned to manage.

The Project Manager can:

- Create new projects.
- Manage assigned projects.
- Add eligible workspace members to projects.
- Create and manage project tasks.
- Assign tasks to project members.
- Set task priorities and deadlines.
- Review task progress.
- View project dashboards.

## 2.3 Developer / Team Member

A Developer is responsible for completing development tasks.

The Developer can:

- View projects they belong to.
- View assigned tasks.
- Create tasks in accessible projects.
- Update the status of their assigned tasks.
- View task details.
- Search and filter accessible tasks.
- View relevant project progress.

Developers cannot manage workspace roles or access projects they do not belong to.

---

# 3. System Structure

DevFlow will use the following structure:

**Workspace → Project → Task**

A workspace can contain multiple projects.

A project belongs to one workspace and can contain multiple tasks.

A task belongs to one project and can be assigned to one developer or remain unassigned.

A user can belong to multiple workspaces.

A user's workspace role may be different in each workspace.

### Example

**Workspace:** ABC Software

**Projects:**

- E-Commerce Website
- Hospital Management System

**Tasks inside E-Commerce Website:**

- Create Login Page
- Develop Authentication API
- Build Product Dashboard
- Implement Shopping Cart

These relationships must be maintained when storing and retrieving application data.

---

# 4. Functional Requirements

Functional requirements explain what actions the system must support.

Each requirement has a unique ID.

## 4.1 User Authentication

### FR-01: User Registration

The system must allow a new user to create an account.

**Required information:**

- Full name.
- Email address.
- Password.

**System behavior:**

- Validate the submitted information.
- Check whether the email is already registered.
- Securely hash the password before storage.
- Create the user account.
- Show a success or error message.

**Acceptance Criteria:**

- A user can register with valid information.
- Duplicate email addresses are rejected.
- Invalid information displays appropriate errors.
- The password is never stored as plain text.
- The new account can be used to log in.

### FR-02: User Login

The system must allow registered users to log in using their email and password.

**Acceptance Criteria:**

- Correct credentials allow login.
- Incorrect credentials are rejected.
- Successful login creates a secure authenticated session.
- Users can access only resources they are authorized to view.

### FR-03: User Logout

Users must be able to log out of the application.

**Acceptance Criteria:**

- Logging out ends the current authenticated session.
- Protected resources cannot be accessed using the ended session.
- The user can log in again.

### FR-04: User Profile Management

Users must be able to view and update basic profile information.

**Information includes:**

- Full name.
- Email address.
- Profile information.

**Acceptance Criteria:**

- Users can view their own profile.
- Users can update permitted profile fields.
- Changes are saved in the database.
- Invalid updates are rejected.
- Users cannot edit another user's private account information.

### FR-05: Password Management

The system must support basic password management.

**Features:**

- Change password while logged in.
- Recover access using a secure password-reset process.

**Acceptance Criteria:**

- The current password is verified when changing a password.
- A user can securely reset a forgotten password.
- Password-reset links or tokens expire and cannot be reused after success.
- New passwords are securely hashed.
- Other users cannot reset a password without valid authorization.

---

## 4.2 Workspace Management

### FR-06: Create Workspace

An authenticated user must be able to create a workspace.

**Required information:**

- Workspace name.

**Optional information:**

- Workspace description.

**Acceptance Criteria:**

- A user can create a workspace.
- The workspace is saved in the database.
- The creator automatically becomes its Owner.
- The workspace appears in the user's workspace list.

### FR-07: View and Switch Workspaces

A user must be able to view workspaces they belong to and select a workspace.

**Acceptance Criteria:**

- Users see only their own workspaces.
- Users can switch between workspaces.
- Projects and tasks shown belong to the selected workspace.
- Switching workspaces does not expose unauthorized data.

### FR-08: Edit Workspace

The Workspace Owner must be able to update workspace information.

**Acceptance Criteria:**

- The Owner can update the workspace name and description.
- Changes are stored successfully.
- Unauthorized users cannot change workspace settings.

### FR-09: Invite Workspace Members

The Workspace Owner must be able to invite users to a workspace.

The MVP will use a basic invitation process.

**Features:**

- Create an invitation for an email address.
- Assign an intended workspace role.
- Provide an invitation link.
- Allow the invited person to accept the invitation.

**Acceptance Criteria:**

- The Owner can create an invitation.
- An invited user can accept a valid invitation.
- A new user can register before accepting the invitation.
- The invitation cannot be accepted by an unauthorized account.
- An expired, invalid, or already-used invitation is rejected.
- The same user cannot join the workspace twice.

### FR-10: Manage Workspace Members

The Workspace Owner must be able to manage workspace members.

**Features:**

- View members.
- View member roles.
- Change permitted member roles.
- Remove members.

**Acceptance Criteria:**

- The Owner can view workspace members.
- Authorized role changes are saved.
- Removed members lose workspace access.
- Users without permission cannot manage members.
- The workspace must always retain its Owner.

---

## 4.3 Project Management

### FR-11: Create Project

The Workspace Owner and Project Managers must be able to create projects.

**Required information:**

- Project name.
- Workspace.

**Other information:**

- Description.
- Project Manager.
- Start date.
- Target completion date.

**Acceptance Criteria:**

- An authorized user can create a project.
- The project belongs to the selected workspace.
- Required information is validated.
- The project is saved in the database.
- The project appears in the correct workspace.
- Unauthorized users cannot create projects.

### FR-12: View Projects

Users must be able to view projects they are authorized to access.

**Acceptance Criteria:**

- The Owner can view all workspace projects.
- Project Managers can view projects they manage or belong to.
- Developers can view projects they belong to.
- Unauthorized projects cannot be accessed through either the interface or API.

### FR-13: Edit Project

Authorized users must be able to update project information.

**Editable information includes:**

- Project name.
- Description.
- Start date.
- Target completion date.
- Project status.
- Assigned Project Manager.

**Acceptance Criteria:**

- Authorized users can update project details.
- Updated information is stored correctly.
- Invalid information is rejected.
- Unauthorized users cannot update projects.

### FR-14: Manage Project Members

Authorized users must be able to manage the members of their projects.

**Features:**

- View project members.
- Add workspace members to projects.
- Remove project members.
- Assign a Project Manager.

**Acceptance Criteria:**

- Only eligible workspace members can join a project.
- Authorized users can manage project membership.
- Developers cannot manage project membership.
- Removed project members lose access unless another permission grants access.
- Tasks belonging to a removed member remain in the project and can be reassigned.
- A project's assigned manager must remain an eligible workspace member.

### FR-15: Project Lifecycle Management

Authorized users must be able to manage the status of a project.

The MVP will support simple project states such as:

- Planned.
- Active.
- Completed.
- Archived.

**Acceptance Criteria:**

- Authorized users can update project status.
- Completed projects remain available for viewing.
- Archived projects can be viewed by authorized users but are excluded from active project lists by default.
- Archived projects cannot receive new tasks until they are restored to an editable state.
- Project deletion, where provided, is restricted to the Workspace Owner and requires confirmation.

---

## 4.4 Task Management

### FR-16: Create Task

Authorized project members must be able to create tasks.

**Required information:**

- Task title.
- Project.

**Other information:**

- Description.
- Assigned developer.
- Priority.
- Status.
- Due date.

**Acceptance Criteria:**

- Authorized members can create tasks.
- Each task belongs to one valid project.
- Required information is validated.
- Each task receives a unique identifier.
- The system records the task creator and creation date.
- The task appears in the correct project.

### FR-17: View Task Details

Authorized project members must be able to view task details.

**Displayed information:**

- Task ID.
- Title.
- Description.
- Assigned developer.
- Priority.
- Status.
- Due date.
- Creator.
- Created date.
- Last updated date.

**Acceptance Criteria:**

- Authorized users can open a task.
- Task information is displayed correctly.
- Unauthorized users cannot view the task.
- A missing task displays an appropriate error.

### FR-18: Edit Task

Authorized users must be able to update task information.

**Acceptance Criteria:**

- Owners and authorized Project Managers can edit tasks within their permitted projects.
- Developers can update the status of their assigned tasks.
- Other task changes follow role permissions.
- Updates are validated before saving.
- The system records the last update time.
- Unauthorized changes are rejected.

### FR-19: Assign Task

The Workspace Owner and authorized Project Managers must be able to assign tasks.

**Acceptance Criteria:**

- A task can be assigned to an eligible project member.
- A task can be left unassigned.
- A task can be reassigned.
- The assigned developer can see the task.
- Users cannot assign tasks to people outside the project.

### FR-20: Task Priority Management

Tasks must support the following priorities:

- Low.
- Medium.
- High.
- Urgent.

**Acceptance Criteria:**

- Authorized users can set task priority.
- Priority is stored correctly.
- Task priority appears in task details and task lists.
- Tasks can be filtered by priority.

### FR-21: Task Status Management

Tasks must support these statuses:

- Backlog.
- To Do.
- In Progress.
- In Review.
- Done.

**Acceptance Criteria:**

- Tasks have a valid status.
- Authorized users can change task status.
- Developers can update the status of their own assigned tasks.
- Only authorized managers or owners can approve a task as Done.
- The updated status appears in task lists and the Kanban board.
- Invalid status values are rejected.

### FR-22: Delete Task

Authorized users must be able to delete tasks.

**Acceptance Criteria:**

- Owners and authorized Project Managers can delete tasks.
- The system requests confirmation before deletion.
- Deleted tasks no longer appear in active task lists.
- Unauthorized users cannot delete tasks.
- The system handles attempts to delete nonexistent tasks.

### FR-23: Search and Filter Tasks

Users must be able to find tasks easily.

**Search options:**

- Task title.
- Task ID.

**Filter options:**

- Status.
- Priority.
- Assigned developer.

**Acceptance Criteria:**

- Users can search tasks within an accessible project.
- Users can filter tasks by the supported fields.
- Multiple filters can be combined.
- Results contain only authorized tasks.
- The interface handles empty search results.
- Clearing filters restores the normal task list.

---

## 4.5 Kanban Board

### FR-24: Display Kanban Board

Each project must provide a Kanban board.

The board must contain five columns:

1. Backlog.
2. To Do.
3. In Progress.
4. In Review.
5. Done.

Each task must appear in the column matching its status.

**Acceptance Criteria:**

- Users can open the board of an accessible project.
- Tasks appear under the correct status.
- The board displays useful task information.
- Users can open tasks from the board.
- The board does not show unauthorized data.

### FR-25: Update Tasks from the Board

Authorized users must be able to update task statuses directly from the Kanban board.

**Acceptance Criteria:**

- Users can select a task.
- Permitted status changes can be made through a dropdown or similar control.
- Changes are saved through the backend API.
- The task appears in the correct column after a successful update.
- Failed updates display an error.
- Unauthorized changes are rejected.

Drag-and-drop support is not required for Stage 1.

---

## 4.6 Project Dashboard

### FR-26: Display Project Statistics

The system must display basic project statistics.

**Statistics include:**

- Total tasks.
- Completed tasks.
- In-progress tasks.
- Overdue tasks.
- Project completion percentage.

**Acceptance Criteria:**

- Authorized users can view the dashboard.
- Statistics come from the project's stored task data.
- A task is overdue when its due date has passed and it is not completed.
- The completion percentage is calculated using completed tasks and total tasks.
- A project with zero tasks displays 0% completion.
- Statistics are updated when the underlying task data changes and the dashboard is refreshed or refetched.

### FR-27: Basic Dashboard Navigation

The application must provide simple navigation between project management screens.

**Acceptance Criteria:**

- Users can open their accessible workspace.
- Users can navigate to projects.
- Users can open project dashboards.
- Users can navigate to the Kanban board.
- Users can open task details.
- Users receive a clear message when they attempt to access a resource without permission.

---

# 5. Business Rules

Business rules define conditions the application must follow.

| ID | Business Rule |
|---|---|
| BR-01 | Every registered user must have a unique email address. |
| BR-02 | Every workspace must have one designated Owner. |
| BR-03 | The user who creates a workspace becomes its Owner. |
| BR-04 | A user may belong to multiple workspaces. |
| BR-05 | A user's role applies only to the relevant workspace. |
| BR-06 | Only the Workspace Owner can manage workspace member roles in the MVP. |
| BR-07 | A project must belong to one workspace. |
| BR-08 | A task must belong to one project. |
| BR-09 | A project member must also belong to the project's workspace. |
| BR-10 | A task can have only one assigned developer at a time, or no assignee. |
| BR-11 | A task can only be assigned to an eligible project member. |
| BR-12 | A task must have one of the five supported statuses. |
| BR-13 | A task must have one of the four supported priorities. |
| BR-14 | Only authorized users may edit or delete tasks. |
| BR-15 | Developers may update the status of their own assigned tasks, subject to review permissions. |
| BR-16 | Only authorized managers or owners can approve tasks as Done. |
| BR-17 | Users must not access private projects or tasks belonging to unauthorized workspaces. |
| BR-18 | Removed workspace members lose access to that workspace's protected resources. |
| BR-19 | Removing a member must not automatically delete their tasks or projects. |
| BR-20 | Tasks in archived projects cannot be modified until the project is restored to an editable state. |
| BR-21 | Project completion percentage is based on tasks marked Done. |
| BR-22 | Protected actions must be authorized by the backend, not only hidden in the frontend. |
| BR-23 | Passwords and authentication secrets must never be returned in normal API responses. |
| BR-24 | Task and project dates must be validated; a project's target date cannot be earlier than its start date. |

---

# 6. Role-Based Permissions

The application will use basic role-based access control.

| Action | Owner/Admin | Project Manager | Developer |
|---|---|---|---|
| Create workspace | Yes | Yes | Yes |
| Edit owned workspace | Yes | No | No |
| Invite workspace members | Yes | No | No |
| Manage workspace roles | Yes | No | No |
| Create project | Yes | Yes | No |
| Edit project | Yes | Assigned projects | No |
| Add project members | Yes | Assigned projects | No |
| Create task | Yes | Yes | Yes |
| Assign task | Yes | Assigned projects | No |
| Edit task details | Yes | Assigned projects | Limited |
| Update assigned task status | Yes | Yes | Yes |
| Approve task as Done | Yes | Assigned projects | No |
| Delete task | Yes | Assigned projects | No |
| View project dashboard | Yes | Accessible projects | Accessible projects |

**Important:** All actions are limited to workspaces and projects the user is allowed to access.

Creating a new workspace is available to any registered user. The creator becomes the Owner of that new workspace. Being a Project Manager or Developer in one workspace does not give the user administrator permissions in another.

---

# 7. User Stories and Acceptance Criteria

User stories describe the system from the user's point of view.

## US-01: Register an Account

**As a** new user,  
**I want to** create a DevFlow account,  
**So that** I can use the application.

**Acceptance Criteria:**

- Registration requires valid information.
- Duplicate accounts are prevented.
- Successful registration creates an account.
- The user can subsequently log in.

**Related Requirement:** FR-01

## US-02: Log In

**As a** registered user,  
**I want to** log in securely,  
**So that** I can access my workspace and projects.

**Acceptance Criteria:**

- Valid credentials allow login.
- Invalid credentials are rejected.
- Protected pages require authentication.

**Related Requirements:** FR-02, FR-03

## US-03: Create a Workspace

**As a** registered user,  
**I want to** create a workspace,  
**So that** I can organize my development team.

**Acceptance Criteria:**

- The user can enter a workspace name.
- A workspace is created successfully.
- The creator becomes the Owner.
- The workspace appears in the workspace list.

**Related Requirement:** FR-06

## US-04: Invite Team Members

**As a** Workspace Owner,  
**I want to** invite members,  
**So that** they can work together on projects.

**Acceptance Criteria:**

- The Owner can create invitations.
- Invited users can accept valid invitations.
- Accepted members appear in the member list.
- Invalid invitations are rejected.

**Related Requirements:** FR-09, FR-10

## US-05: Create a Project

**As a** Project Manager,  
**I want to** create a software project,  
**So that** development work can be organized.

**Acceptance Criteria:**

- The manager can enter project information.
- The system saves the project.
- The project appears in the correct workspace.
- Unauthorized creation is rejected.

**Related Requirement:** FR-11

## US-06: Manage Project Members

**As a** Project Manager,  
**I want to** add team members to my project,  
**So that** they can participate in development.

**Acceptance Criteria:**

- Only eligible workspace members can be added.
- Project membership is stored correctly.
- Members can access the project according to their role.
- Unauthorized users cannot change membership.

**Related Requirement:** FR-14

## US-07: Create and Assign Tasks

**As a** Project Manager,  
**I want to** create and assign tasks,  
**So that** developers know what work they need to complete.

**Acceptance Criteria:**

- The manager can create a task.
- The manager can select an eligible developer.
- The manager can set priority and due date.
- The assigned task appears in the project.

**Related Requirements:** FR-16, FR-19, FR-20

## US-08: View My Tasks

**As a** Developer,  
**I want to** view tasks assigned to me,  
**So that** I can organize my work.

**Acceptance Criteria:**

- Assigned tasks can be identified through task filters.
- The developer can view permitted task details.
- Tasks from unauthorized projects do not appear.

**Related Requirements:** FR-17, FR-23

## US-09: Update Task Progress

**As a** Developer,  
**I want to** update the status of my assigned task,  
**So that** my team can understand its progress.

**Acceptance Criteria:**

- The developer can update permitted statuses.
- Changes are stored in the database.
- The board reflects the saved status.
- The developer cannot approve their own task as Done.

**Related Requirements:** FR-18, FR-21, FR-25

## US-10: View the Kanban Board

**As a** team member,  
**I want to** see tasks organized by status,  
**So that** I can understand current development progress.

**Acceptance Criteria:**

- Tasks are grouped into the correct columns.
- Relevant task information is displayed.
- Users can open task details.
- Only authorized tasks are displayed.

**Related Requirement:** FR-24

## US-11: Search Tasks

**As a** team member,  
**I want to** search and filter tasks,  
**So that** I can find the work I need.

**Acceptance Criteria:**

- Task title and ID searches work.
- Supported filters work.
- Filters can be combined.
- Users see only authorized results.

**Related Requirement:** FR-23

## US-12: Monitor Project Progress

**As a** Project Manager,  
**I want to** view project statistics,  
**So that** I can understand development progress.

**Acceptance Criteria:**

- The dashboard displays total tasks.
- Completed, active, and overdue task counts are accurate.
- Completion percentage is calculated correctly.
- The dashboard shows updated data after task changes.

**Related Requirement:** FR-26

## US-13: Manage My Profile

**As a** registered user,  
**I want to** update my account information,  
**So that** my profile stays accurate.

**Acceptance Criteria:**

- The user can view their profile.
- Permitted fields can be updated.
- Changes are saved.
- Other users cannot modify the account without permission.

**Related Requirements:** FR-04, FR-05

## US-14: Manage Project Lifecycle

**As a** Project Manager,  
**I want to** update a project's details and status,  
**So that** the team can track whether the project is planned, active, completed, or archived.

**Acceptance Criteria:**

- Authorized users can update project details.
- Project status is saved correctly.
- Archived projects are separated from active projects.
- Unauthorized edits are rejected.

**Related Requirements:** FR-13, FR-15

---

# 8. Non-Functional Requirements

Non-functional requirements describe how well the system should work.

## 8.1 Security

### NFR-01: Password Security

Passwords must be stored using a suitable password hashing algorithm.

Plain-text passwords must never be stored.

### NFR-02: Secure Authentication

Authentication must use secure session handling.

Session cookies should be HTTP-only, use suitable SameSite settings, and use Secure when served over HTTPS. The application must protect against relevant session and cross-site request attacks.

### NFR-03: Authorization

Every protected backend operation must check the user's permissions.

The system must not depend only on frontend restrictions.

### NFR-04: Workspace Data Isolation

Users must not access information from workspaces they are not authorized to use.

This must be enforced in database access and API operations.

### NFR-05: Input Validation

All important inputs must be validated before processing.

The system must reject invalid or unsafe values.

### NFR-06: Secret Protection

Database credentials, session secrets, and other private configuration values must not be committed to the public Git repository.

---

## 8.2 Performance

### NFR-07: API Performance

Common operations such as retrieving project lists and tasks should respond within 2 seconds under normal testing conditions.

Performance tests must record the environment and dataset used.

### NFR-08: Task List Performance

Task lists must support efficient searching, filtering, and pagination when necessary.

The system should avoid loading an unlimited number of tasks in a single request.

### NFR-09: Database Efficiency

Frequently used database queries should use suitable indexes where testing shows they are needed.

Unnecessary database requests should be avoided.

---

## 8.3 Usability

### NFR-10: Responsive Design

The application must be usable on desktop, tablet, and mobile browser screen sizes.

The Kanban board may use horizontal scrolling on smaller screens.

### NFR-11: Clear User Interface

Navigation, forms, buttons, and messages must be understandable.

Users should be able to identify how to complete common actions without extensive instructions.

### NFR-12: User Feedback

The application must show appropriate feedback for successful operations, loading states, and errors.

### NFR-13: Basic Accessibility

Forms must have labels, important controls must support keyboard navigation, and text must remain readable.

---

## 8.4 Reliability

### NFR-14: Error Handling

Invalid requests and unexpected failures must be handled without crashing the application.

The API must return appropriate HTTP status codes and useful error responses.

### NFR-15: Data Consistency

Operations must preserve valid relationships between users, workspaces, projects, and tasks.

For example, a task cannot reference a nonexistent project.

### NFR-16: Session Reliability

The application must handle expired sessions correctly.

When a session expires, protected operations must be rejected and the user must be able to log in again.

---

## 8.5 Maintainability

### NFR-17: Code Organization

The application must separate frontend, backend, and data access responsibilities.

The project should follow consistent naming and coding conventions.

### NFR-18: Type Safety

TypeScript must be used for application development.

Important data structures and API contracts should have defined types.

### NFR-19: Documentation

The project must include:

- Setup instructions.
- Environment configuration instructions.
- API documentation.
- Basic architecture documentation.
- Database model documentation.

### NFR-20: Automated Testing

Core business logic, authentication, permissions, and important API operations must have automated tests.

Tests must cover successful operations and important failure cases.

### NFR-21: Version Control

The project must use Git and GitHub for version control.

Development work should be saved using meaningful commits.

---

# 9. Data Requirements

The MVP will use MongoDB as its main database.

The following collections are expected.

## 9.1 Users

Stores registered user information.

**Main fields:**

- User ID.
- Name.
- Email.
- Password hash.
- Profile information.
- Created date.
- Updated date.

## 9.2 Workspaces

Stores workspace information.

**Main fields:**

- Workspace ID.
- Workspace name.
- Description.
- Owner ID.
- Created date.
- Updated date.

## 9.3 Workspace Members

Stores relationships between users and workspaces.

**Main fields:**

- Membership ID.
- Workspace ID.
- User ID.
- Workspace role.
- Joined date.

## 9.4 Workspace Invitations

Stores invitations that have been created.

**Main fields:**

- Invitation ID.
- Workspace ID.
- Invited email.
- Intended role.
- Secure invitation token or token hash.
- Expiration date.
- Invitation status.
- Created date.

## 9.5 Projects

Stores software project information.

**Main fields:**

- Project ID.
- Workspace ID.
- Project name.
- Description.
- Project Manager ID.
- Start date.
- Target date.
- Project status.
- Created date.
- Updated date.

## 9.6 Project Members

Stores project membership information.

**Main fields:**

- Project membership ID.
- Project ID.
- User ID.
- Joined date.

## 9.7 Tasks

Stores development task information.

**Main fields:**

- Task ID.
- Project ID.
- Title.
- Description.
- Assigned user ID.
- Priority.
- Status.
- Due date.
- Created by.
- Last updated by.
- Created date.
- Updated date.

## 9.8 Authentication and Recovery Data

The system must store the information required to manage authenticated sessions and basic account recovery securely.

The exact storage structure will be selected during technical design.

**Note:** These are logical data requirements. The final MongoDB schema, indexes, relationships, and any supporting collections will be decided during database design.

---

# 10. Main User Workflows

## Workflow 1: User Registration and Login

1. A new user opens DevFlow.
2. The user selects Register.
3. The user enters the required information.
4. The system validates the information.
5. The system creates the account.
6. The user logs in.
7. The system authenticates the user.
8. The user enters the application.

## Workflow 2: Workspace Setup

1. An authenticated user creates a workspace.
2. The system makes the creator the Workspace Owner.
3. The Owner opens workspace settings.
4. The Owner creates invitations for team members.
5. Invited users accept their invitations.
6. The members become part of the workspace.

## Workflow 3: Project Setup

1. An authorized user opens a workspace.
2. The user creates a project.
3. The user enters project information.
4. The system saves the project.
5. The Project Manager adds eligible workspace members.
6. Members can access the project according to their permissions.

## Workflow 4: Task Assignment and Completion

1. A Project Manager opens a project.
2. The manager creates a task.
3. The manager selects a developer.
4. The manager sets a priority and due date.
5. The system saves the task.
6. The developer opens the project.
7. The developer views the assigned task.
8. The developer moves the task to In Progress.
9. After completing the development work, the developer moves the task to In Review.
10. The manager reviews the work.
11. The manager moves the task to Done.
12. The project dashboard reflects the completed task.

## Workflow 5: Kanban Board

1. A user opens an accessible project.
2. The user opens the Kanban board.
3. The system retrieves project tasks.
4. The system organizes tasks by status.
5. The user opens a task.
6. If authorized, the user changes the task status.
7. The backend saves the change.
8. The interface updates the task's displayed status.

---

# 11. Error and Exception Handling

The system must handle common error situations.

| Situation | Expected Behavior |
|---|---|
| Email already registered | Display an appropriate registration error |
| Incorrect login credentials | Reject login without exposing sensitive account details |
| Session expired | Reject protected actions and request login |
| Missing required fields | Show field validation errors |
| Invalid invitation | Reject invitation acceptance |
| User outside workspace | Deny access |
| Unauthorized project access | Deny access |
| Task not found | Display an appropriate not-found message |
| Unauthorized task update | Reject the update |
| Invalid task status | Reject the update |
| Invalid project dates | Display validation errors |
| Database operation fails | Return a safe error and preserve valid stored data |
| Network request fails | Display an error and allow the user to retry where appropriate |
| No tasks match filters | Display an empty-results message |

The frontend must not show a successful operation until the backend confirms that it succeeded.

---

# 12. User Interface Requirements

The Stage 1 MVP must provide the following main screens.

| Screen | Main Purpose |
|---|---|
| Registration | Create an account |
| Login | Authenticate an existing user |
| Profile | View and update account information |
| Workspace List / Setup | Create, select, and switch workspaces |
| Workspace Settings | Edit workspace and manage members |
| Workspace Invitations | Invite and accept team membership |
| Project List | View and create projects |
| Project Settings | Edit project details and membership |
| Project Dashboard | Display project progress |
| Kanban Board | View and manage tasks by status |
| Task Details | View and update task information |

The user interface should be responsive and easy to navigate.

No specific visual theme is required by this SRS. Interface styling will be decided during UI/UX design.

---

# 13. Technical Constraints

The MVP must follow these technical constraints.

### TC-01: MERN Stack

The application must use:

- MongoDB for database storage.
- Express.js for backend APIs.
- React for the frontend.
- Node.js for backend execution.

### TC-02: TypeScript

TypeScript must be used in both frontend and backend development.

### TC-03: REST API

The frontend and backend will communicate mainly through REST APIs using HTTP and JSON.

### TC-04: Separate Responsibilities

The application must separate:

- User interface logic.
- API request handling.
- Business logic.
- Database access.

### TC-05: Git Version Control

All project source code must be maintained using Git.

### TC-06: Testing

The application must include automated tests for important functionality.

### TC-07: Future Expansion

The architecture should allow later additions such as real-time updates, notifications, sprints, and GitHub integration without unnecessarily rewriting the entire application.

---

# 14. Stage 1 Exclusions

The following features belong to later development stages and are not required to complete the MVP.

## Stage 2 Features

- Sprint planning and management.
- Task comments.
- Task activity history.
- Real-time collaboration through Socket.IO.
- In-app notifications.
- Task dependencies.
- Graph-based dependency checking.
- Drag-and-drop Kanban interactions.
- Advanced concurrent-editing conflict handling.
- More detailed project dashboards.

## Stage 3 Features

- GitHub repository integration.
- Pull request linking.
- GitHub webhook processing.
- Redis caching where justified.
- Background job processing.
- Advanced analytics.
- Docker containerization.
- CI/CD pipeline.
- Advanced performance testing.
- Production monitoring.
- Full production deployment work.

These features remain part of the approved DevFlow project scope, but they will be developed after Stage 1.

---

# 15. MVP Acceptance Tests

Before declaring Stage 1 complete, the following scenarios must work.

| Test ID | Scenario | Expected Result |
|---|---|---|
| AT-01 | Register a new user | Account created |
| AT-02 | Register with an existing email | Registration rejected |
| AT-03 | Log in with valid credentials | Login successful |
| AT-04 | Log in with invalid credentials | Login rejected |
| AT-05 | Log out | Session ended |
| AT-06 | Update own profile | Changes saved |
| AT-07 | Change or recover password | Valid password update succeeds securely |
| AT-08 | Create a workspace | Workspace created with correct Owner |
| AT-09 | Invite and accept a member | Membership created |
| AT-10 | Access another user's private workspace | Access denied |
| AT-11 | Create a project | Project created in correct workspace |
| AT-12 | Add a project member | Membership created correctly |
| AT-13 | Access an unauthorized project | Access denied |
| AT-14 | Update project information | Changes saved |
| AT-15 | Archive a project | Project archived correctly |
| AT-16 | Create a task | Task created |
| AT-17 | Assign a task | Eligible developer assigned |
| AT-18 | Assign a non-member | Assignment rejected |
| AT-19 | Update task status | Status saved |
| AT-20 | Developer attempts unauthorized task approval | Update rejected |
| AT-21 | Delete a task without permission | Request rejected |
| AT-22 | Search and filter tasks | Correct authorized results shown |
| AT-23 | Open Kanban board | Tasks shown in correct columns |
| AT-24 | Change status from board | Board reflects saved change |
| AT-25 | View project dashboard | Statistics are correct |
| AT-26 | Access protected API without authentication | Request rejected |
| AT-27 | Submit invalid task information | Validation error returned |
| AT-28 | Attempt to modify another workspace's data | Request rejected |

---

# 16. Definition of Done

A feature is considered complete when:

1. The feature works according to its functional requirements.
2. The required backend API is implemented.
3. Necessary database operations work correctly.
4. The user interface is functional.
5. Input validation is implemented.
6. Authentication and permission checks are applied where needed.
7. Success and error cases are handled.
8. Important functionality is covered by suitable automated tests.
9. The code is understandable and follows the agreed project structure.
10. The implementation is committed to Git.

The Stage 1 MVP is considered complete when all required features meet their acceptance criteria and the core acceptance tests pass.

---

# 17. Assumptions and Clarifications

The following assumptions will guide Stage 1 implementation without extending the approved project scope.

1. DevFlow will initially be a web application, not a native mobile app.
2. Users can create more than one workspace.
3. Each workspace has one designated Owner.
4. Owners can manage all projects in their own workspaces.
5. Project Managers manage projects assigned to them.
6. Developers access projects they belong to.
7. Each project has one assigned Project Manager in the basic design.
8. Each task belongs to one project.
9. Each task can have one assignee or remain unassigned.
10. Task status changes are saved through the REST API.
11. Kanban drag-and-drop is not required in Stage 1.
12. Invitations will use a basic secure invitation-link process.
13. Basic account recovery is part of account management; it does not require the full notification system planned for Stage 2.
14. Project statistics will be calculated from stored project and task data.
15. The system will initially be developed for small teams, with performance and scalability improved based on actual testing.

Any major change to these assumptions must be reviewed before implementation.

---

# 18. Final MVP Completion Criteria

Stage 1 is complete when a small software development team can perform the following complete workflow:

1. Register and log in to DevFlow.
2. Create a workspace.
3. Invite team members.
4. Manage basic workspace roles.
5. Create a software project.
6. Add project members.
7. Create development tasks.
8. Assign tasks to developers.
9. Set task priorities and deadlines.
10. View tasks through the Kanban board.
11. Update task progress.
12. Search and filter tasks.
13. Review and complete tasks.
14. View accurate project progress statistics.
15. Access only authorized workspaces, projects, and tasks.

The application must also demonstrate suitable code organization, secure authentication, proper error handling, database consistency, and basic automated testing.

---

# 19. Document Approval

**Document:** DevFlow Stage 1 MVP — Software Requirements Specification

**Version:** 1.0

**Status:** Awaiting Review and Approval

**Scope:** Stage 1 MVP only

Once approved, this document will serve as the baseline for system architecture, database design, API design, UI/UX design, and the Stage 1 development milestones.

**End of Document**
