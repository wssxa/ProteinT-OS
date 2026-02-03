# Current Features

## Pages (static UI)
- **`/`** — Single-page dashboard (admin + reporter views). Shows
  - CEO-level overview cards
  - exceptions, decisions, compliance, finance exceptions (admin)
  - audit log (admin)
  - project registry and task ledger forms (admin)
  - reporter due items and task updates
  - project update + meeting memo + finance submission forms

## API endpoints

### Health & config
- **`GET /api/health`** — Liveness check with server time.
- **`GET /api/config`** — Returns org config from `data/seed.json`.

### Auth & session
- **`POST /api/auth/wecom/mock`** — Stub login; returns `{ token, user }`.
- **`POST /api/auth/logout`** — Deletes the current session.
- **`GET /api/me`** — Returns current user + session expiry.

### Reporter scope
- **`GET /api/my/tasks`** — Tasks filtered by logged-in user.
- **`GET /api/my/submissions`** — Submissions filtered by logged-in user.

### Admin scope (RBAC enforced)
- **`GET /api/digest/daily`** — Daily summary of submissions.
- **`GET /api/submissions`** — All submissions.
- **`GET /api/projects`** — Project registry.
- **`GET /api/tasks`** — Task ledger.
- **`GET /api/users`** — Users list.
- **`GET /api/exceptions`** — Cadence exceptions (missed updates).
- **`GET /api/decisions`** — Decisions queue.
- **`GET /api/compliance`** — Compliance metrics by department.
- **`GET /api/finance`** — Finance items list.
- **`GET /api/finance/exceptions`** — Finance items with exception reasons.
- **`GET /api/audit`** — Audit log events.

### Submission endpoints
- **`POST /api/submissions/project-update`** — Create project update. Adds decision item when `decisionNeeded=Y`.
- **`POST /api/submissions/meeting-memo`** — Create meeting memo; optional action items create tasks.
- **`POST /api/finance`** — Create finance intake item (starter).
- **`POST /api/tasks/update`** — Update task status + evidence link.

### Admin write actions
- **`POST /api/projects`** — Create a project.
- **`POST /api/tasks`** — Create a task.
- **`POST /api/users`** — Create a user.
- **`POST /api/decisions`** — Add a decision item.
- **`POST /api/admin/actions`** — Queue a generic admin action (stub).
