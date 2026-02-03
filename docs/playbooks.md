# Playbooks

## Overview
Playbooks combine the auto-context builder with structured data from JSON stores to produce evidence-backed responses. Every response includes `sourcesUsed` so stakeholders can trace the evidence.

## AI Provider
The AI provider abstraction lives in `src/ai/provider.js`.

- `generate({ system, user, temperature, jsonSchema? })` returns `{ text, usage? }`.
- If `AI_PROVIDER` is `none` or no API key is configured, the provider returns deterministic fallback responses:
  - **P2 Policy Interpreter**: top excerpts + “human review required”.
  - **P3 Project Health**: deterministic health summary based on computed metrics.

Environment variables:

```
AI_PROVIDER=none|openai
OPENAI_API_KEY=
OPENAI_MODEL_STANDARD=
OPENAI_MODEL_PREMIUM=
```

## Playbook: P2 Policy Interpreter
**Purpose:** Answer HR/policy questions with citations.

**Request:**

```json
{
  "playbookId": "P2_POLICY_INTERPRETER",
  "params": { "question": "..." }
}
```

**Behavior:**
- Forces scope to `policy` space.
- Retrieves top policy excerpts using the auto-context builder.
- Returns a synthesized answer (or deterministic fallback) with citations and next steps.

## Playbook: P3 Project Health & Next Actions
**Purpose:** Summarize project health and propose next actions with evidence.

**Request:**

```json
{
  "playbookId": "P3_PROJECT_HEALTH",
  "params": { "projectId": "proj_123" }
}
```

**Computed metrics:**
- Last update time (from project updates)
- Missed cadence exception
- Blockers (blocked tasks + blocker notes)
- Overdue milestones (next due date in the past)
- Decision needed flags

**Behavior:**
- Forces scope to the project space.
- Retrieves top project excerpts using the auto-context builder.
- Computes health (green/yellow/red) and next actions.
- Returns a synthesized answer (or deterministic fallback) with evidence links.
