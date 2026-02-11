# Knowledge Ingestion

This MVP ingests local files from `data/work_artifacts/` into `data/chunks.json` so Copilot retrieval and playbooks can return real evidence.

## Folder taxonomy

Store documents with this structure:

```text
data/work_artifacts/{spaceType}/{spaceName}/{YYYY-WW}/{deliverableType}/file.ext
```

Example:

```text
data/work_artifacts/policy/policy/2026-W06/handbook/leave.md
```

- `spaceType`: retrieval scope type (`policy`, `project`, `department`, etc.)
- `spaceName`: retrieval scope name (used for scope filtering)
- `YYYY-WW`: ISO week bucket
- `deliverableType`: optional category of artifact (`handbook`, `memo`, `report`)

## Supported file types

The scanner only ingests these text-based formats:

- `.txt`
- `.md`
- `.json`
- `.csv`

## Endpoints

Admin-only endpoints:

- `GET /api/admin/ingest/status`: returns last scan status and chunk count
- `POST /api/admin/ingest/scan`: runs an incremental scan and updates chunks

## Incremental behavior

- File metadata is tracked in `data/ingest_state.json` (`mtimeMs` and `size`).
- Only changed files are re-ingested.
- Deleted files are removed from `data/chunks.json` on the next scan.
