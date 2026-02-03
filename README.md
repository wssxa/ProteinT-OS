# ProteinT-OS (MVP Web Dashboard + WeCom Submission Stubs)

Read in other languages: [简体中文](README.zh-CN.md)

This repository contains a **starter MVP** for the "Electronic CEO Office" described in your architecture document. It is intentionally lightweight and focuses on:

- **Web dashboard** (CEO pages, exceptions inbox, project registry)
- **Submission endpoints** (project updates + meeting memos)
- **Daily digest stub**
- **WeCom integration placeholders** (submission + notifications + admin actions)

## Quick Start

### 1) Install
```bash
node --version
```

### 2) Run the app
```bash
npm run dev
```

Then open: http://localhost:3000

## How to Use (Non-technical)

1. Open the dashboard in your browser.
2. Use **WeCom Login (Stub)** to log in with your name.
3. Admins will see the **Admin interface mode** with Project Registry and Task Ledger panels.
4. Reporters will see the **Reporter interface mode** (admin panels hidden).
5. Use **Try It: Project Update** or **Try It: Meeting Memo** to submit updates.
6. The preview panels show what the backend received.

> Note: This is a placeholder for WeCom OAuth. The next phase will replace it with real WeCom login.

### Admin Access

Set an admin key to protect write endpoints:

```bash
ADMIN_KEY="your-secret" npm run dev
```

Then use the same key in requests (the UI reads `sessionStorage.adminKey` if set):

```bash
sessionStorage.setItem("adminKey", "your-secret")
```

## Frontend / Backend / Ports

- **Frontend**: `public/` (static HTML/CSS/JS)
- **Backend**: `server.js` (Node HTTP server)
- **Port**: `3000` (same process serves both frontend and API)

## API Endpoints (for WeCom integration)

```bash
GET  /api/config
GET  /api/digest/daily (admin)
GET  /api/submissions (admin)
GET  /api/my/submissions
GET  /api/projects (admin)
GET  /api/tasks (admin)
GET  /api/users (admin)
GET  /api/me
GET  /api/exceptions (admin)
GET  /api/decisions (admin)
GET  /api/compliance (admin)
GET  /api/my/tasks
GET  /api/finance (admin)
GET  /api/finance/exceptions (admin)
POST /api/auth/wecom/mock
POST /api/auth/logout
POST /api/submissions/project-update
POST /api/submissions/meeting-memo
POST /api/admin/actions
POST /api/projects (admin)
POST /api/tasks (admin)
POST /api/tasks/update
POST /api/users (admin)
POST /api/decisions (admin)
POST /api/finance
```

### Sample curl (Project Update)
```bash
curl -X POST http://localhost:3000/api/submissions/project-update \
  -H "Content-Type: application/json" \
  -d '{
    "project": "D2C Growth Push",
    "owner": "康弘宇",
    "tier": "T2",
    "currentMilestone": "New ad set live",
    "progress": "60%",
    "evidenceLink": "https://example.com/evidence",
    "nextMilestone": "Scale creative to 3 variants",
    "nextDueDate": "2026-02-01",
    "blockers": "None"
  }'
```

## Project Structure

```
.
├── data/
│   ├── seed.json
│   └── submissions.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server.js
└── package.json
```

## Configuration (edit `data/seed.json`)

- **Departments** (all requested departments are included)
- **Admin user** (Hongyu Kang / 康弘宇)
- **WeCom integration scope** (submissions + notifications + admin actions + daily digest)

## Next Steps (Phase 1 Build)

1. Replace file-based storage with a database (Postgres + Prisma).
2. Implement WeCom OAuth + message callbacks.
3. Add background jobs for daily digests + notifications.
4. Add evidence-first validation and cadence rules.

## Session + RBAC notes

- Sessions expire after 12 hours by default. Override with `SESSION_TTL_HOURS`.
- Admin-only endpoints require an Admin role (from `seed.json`) or the `ADMIN_KEY` header.

## Deployment handoff

See `DEPLOYMENT.md` for IT handoff details and production recommendations.

## Handoff guide (for final polish)

See `HANDOFF.md` for a step-by-step guide on local usage, API surface, and production polish checklist.

简体中文交接指南见：`HANDOFF.zh-CN.md`.

## Docker quick start

```bash
cp .env.example .env
docker compose up --build
```

## Database schema

See `db/schema.sql` for a starter Postgres schema you can apply when migrating off JSON storage.

### JSON → SQL seed export

```bash
npm run seed:sql
```
