# ProteinT-OS Deployment Handoff (IT)

This document describes how to deploy the MVP server and what is required to move it into a production environment.

## 1) What this system is

The current MVP provides:

- Web dashboard (admin vs reporter UI)
- Project registry + task ledger
- Project updates + meeting memo submissions
- Exceptions inbox (missed cadence)
- Decisions queue
- Compliance metrics
- Audit log
- WeCom OAuth **stub** (placeholder)

It is **not** yet a production-ready service. The next phase is to replace file-based storage and mock auth.

## 2) Runtime requirements

- Node.js 18+ (ESM)
- Port: `3000` (configurable via `PORT`)

## 3) Start command

```bash
PORT=3000 ADMIN_KEY="your-secret" node server.js
```

> `ADMIN_KEY` protects admin-only actions. If unset, admin endpoints are open.

## 4) Storage

Current storage uses JSON files under `data/`:

```
data/
├── audit.json
├── decisions.json
├── projects.json
├── sessions.json
├── submissions.json
├── tasks.json
└── users.json
```

### Production recommendation

Replace JSON storage with Postgres. Suggested tables:

- users
- sessions
- projects
- project_updates
- tasks
- meeting_memos
- decisions
- audit_events

### Starter schema

Use `db/schema.sql` as a starting point for Postgres schema creation.

### JSON → SQL seed export

You can export existing JSON data into SQL inserts:

```bash
npm run seed:sql
```

This writes `db/seed.sql`, which can be applied after `db/schema.sql`.

## 5) Authentication & RBAC

Current login uses `/api/auth/wecom/mock` (stub).

Production plan:

- Implement WeCom OAuth and map WeCom user to `users`.
- Enforce RBAC (Reporter vs Admin) at API level.
- Remove admin-key reliance (keep for emergency use only).

## 6) Network / Security

- Serve over HTTPS behind a reverse proxy (Nginx/Traefik).
- Lock down admin-only endpoints.
- Set file permissions or use managed database.

## 7) API Surface

Key endpoints:

```
GET  /api/config
GET  /api/exceptions
GET  /api/decisions
GET  /api/compliance
GET  /api/audit
POST /api/submissions/project-update
POST /api/submissions/meeting-memo
```

## 8) Next milestones (for IT planning)

- Replace file storage with DB + migrations
- Real WeCom OAuth callback + token validation
- Background jobs for scheduled digests/notifications
- Observability (logs, metrics, tracing)
