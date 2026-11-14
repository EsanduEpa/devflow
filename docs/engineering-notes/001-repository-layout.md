# One repository with separate frontend and backend directories

DevFlow keeps its web app, API, and planning documents in one repository. A single change can update an API endpoint, its React caller, and the documentation together. That gives a reviewer the full context in one diff and gives a new contributor one repository to clone.

The frontend and backend have different runtimes and dependencies. Keeping them in separate directories gives each app its own package manifest and development commands. The browser talks to the backend over HTTP, so each app can run and be checked independently. Developers need two local processes when checking the full request path.
