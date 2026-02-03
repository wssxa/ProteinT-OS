# Auto-Context Builder (Zero-input)

## Purpose
The auto-context builder routes a CEO question into the right knowledge space and retrieves evidence from `data/chunks.json` without using an LLM. It returns top matching excerpts, tracks the context package, and supports RBAC scope enforcement.

## Chunk format (MVP)
Each chunk in `data/chunks.json` is expected to include:

```json
{
  "chunkId": "chunk_123",
  "docId": "doc_123",
  "title": "Policy: Travel Reimbursement",
  "path": "/policies/travel.md",
  "spaceType": "policy",
  "spaceName": "policy",
  "text": "Excerpt text...",
  "timestamp": "2026-01-10T12:00:00Z"
}
```

## Routing rules
1. If `projectId` or `projectName` is provided in the request, route to that project space.
2. Else if the question contains a known project name or ID, route to that project.
3. Else if the question contains a known department name, route to that department space.
4. Else if the question matches policy/HR keywords (policy, reimbursement, leave, etc.), route to policy space.
5. Else return a single clarifying question with candidates.

## Retrieval logic (keyword MVP)
1. Tokenize the query into lowercase terms and remove stopwords.
2. Filter chunks by scope (`spaceType` + optional `spaceName`).
3. Score chunks by keyword matches + recency (newer docs receive a small boost).
4. Sort by score, de-duplicate by `docId`, and return top K (default 8).

## Context packages
Selected doc IDs and chunk IDs are persisted to `data/context_packages.json` with the original query and scope. This creates a traceable context package for downstream playbooks and audits.

## RBAC
- Admins can query any scope.
- Reporters are limited to their own scopes (personal scope or owned projects/departments).
