# Stack Overview

## Server framework
- **Runtime:** Node.js (ESM modules).
- **HTTP server:** built on the Node `http` module (no Express/Koa).
- **Static files:** served from `public/` via `server.js`.

## Database / storage
- **Current:** JSON files in `data/` (file-backed storage).
- **Future:** Postgres is planned; a starter schema exists at `db/schema.sql`.

## Auth / session
- **Login:** `/api/auth/wecom/mock` (stub) issues a session token.
- **Session:** stored in `data/sessions.json`, referenced via `x-session-token` header.
- **Session TTL:** defaults to 12 hours (`SESSION_TTL_HOURS`).
- **Admin access:** Admin role from `data/seed.json` or `ADMIN_KEY` header.

## File upload
- **None.** All submissions are JSON payloads (no file upload endpoints).

## AI calls
- **None.** No LLM or external AI APIs are invoked.

## Search / indexing
- **None.** No search engine or vector index in the current MVP.

## Docker run instructions

```bash
cp .env.example .env

docker compose up --build
```

- App: http://localhost:3000
- Postgres (for future use): localhost:5432
