# ProteinT-OS Handoff Guide (For Final Polish & Deployment)

This guide is the practical, step-by-step handoff for the teammate who will do final polish and production deployment. It assumes no prior context and calls out what works today, what is stubbed, and what must be finished for production.

## 1) What is live today (MVP)

**Working now:**
- Admin + Reporter dashboard in the browser (`public/`).
- Project updates + meeting memo submissions (`/api/submissions/*`).
- Exceptions inbox, decisions queue, compliance metrics, audit log.
- Finance intake (starter) with exceptions list.
- Session login via a WeCom **stub**.

**Not production-ready yet:**
- Real WeCom OAuth.
- Database-backed storage (currently JSON files).
- Background jobs (digests/notifications).

## 2) Quick start (local dev)

```bash
npm install
npm run dev
```

Open: http://localhost:3000

### Optional admin key
```bash
ADMIN_KEY="your-secret" npm run dev
```

Set in the browser console:
```bash
sessionStorage.setItem("adminKey", "your-secret")
```

## 3) How to use the MVP UI

### Reporter
1. Open the dashboard and log in with **WeCom Login (Stub)**.
2. Use **Try It: Project Update** or **Try It: Meeting Memo**.
3. Use **My Tasks** to update a task with evidence.

### Admin
1. Log in as an Admin user (see `data/seed.json`).
2. Review **Exceptions**, **Decisions**, **Compliance**, **Finance Exceptions**, and **Audit Log**.
3. Create projects + tasks in **Project Registry** and **Task Ledger**.

## 4) Data storage (today)

All data is file-backed JSON under `data/`:

```
data/
├── audit.json
├── decisions.json
├── finance.json
├── projects.json
├── sessions.json
├── submissions.json
├── tasks.json
└── users.json
```

### Resetting to a clean slate
Delete the JSON files (or replace with the seed defaults). The server will recreate empty files on start.

## 5) Session + RBAC behavior

- Reporter sessions can access `/api/my/tasks` and `/api/my/submissions`.
- Admin-only endpoints require **Admin role** from `seed.json` or `ADMIN_KEY` header.
- Sessions expire after 12 hours by default (`SESSION_TTL_HOURS` override).

## 6) API endpoint map (current)

**Auth**
- `POST /api/auth/wecom/mock` (stub login)
- `POST /api/auth/logout`
- `GET /api/me`

**Reporter**
- `GET /api/my/tasks`
- `GET /api/my/submissions`

**Admin**
- `GET /api/digest/daily`
- `GET /api/submissions`
- `GET /api/projects`
- `GET /api/tasks`
- `GET /api/users`
- `GET /api/exceptions`
- `GET /api/decisions`
- `GET /api/compliance`
- `GET /api/finance`
- `GET /api/finance/exceptions`
- `GET /api/audit`
- `POST /api/projects`
- `POST /api/tasks`
- `POST /api/users`
- `POST /api/decisions`
- `POST /api/admin/actions`

**Submissions**
- `POST /api/submissions/project-update`
- `POST /api/submissions/meeting-memo`
- `POST /api/finance`
- `POST /api/tasks/update`

## 7) Deployment notes

See `DEPLOYMENT.md` for:
- runtime requirements
- storage recommendations
- WeCom OAuth plan
- security guidance

## 8) Polishing checklist (recommended next work)

1. **Replace JSON storage** with Postgres (use `db/schema.sql`).
2. **Implement WeCom OAuth** and map WeCom users to roles.
3. **Add background jobs** for digests/notifications.
4. **Improve UX**: validation, inline errors, empty states.
5. **Observability**: logs + metrics + trace IDs.

## 9) Helpful files

- `server.js` – API server and core logic.
- `public/index.html` – dashboard layout.
- `public/app.js` – client-side data fetching.
- `db/schema.sql` – starter schema for Postgres migration.
- `scripts/seed_to_sql.js` – export JSON to SQL inserts.
