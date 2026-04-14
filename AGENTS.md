# AGENTS.md

Six agents. Each has: loop served, trigger, inputs, outputs, tempo, model tier, failure mode.

All agents go through `packages/llm` wrapper. None call the Anthropic SDK directly. All writes to Neo4j go through `packages/graph/writer.ts` and enforce the provenance rules in DATA_MODEL.md.

---

## 1. Stream extractor

**File:** `packages/agents/stream-extractor.ts`
**Runs on:** Supabase Edge Function
**Loop served:** sensing, memory (ingestion)

**Trigger.** New row in Postgres `raw_sources` table. Supabase database webhook fires a Supabase Edge Function.

**Inputs.** One raw source row: sender, recipients, timestamp, body or transcript, external id, kind.

**Outputs.** Writes to Neo4j with `provenance=machine`:
- `Person`, `Organization`, `Interaction` nodes (create or update)
- `Signal`, `Commitment` nodes where detected
- `PARTICIPATES_IN`, `MENTIONS`, `EMITS`, `PROMISED` edges
- `source_ids` back-reference on every node touched

Also embeds chunks of the source and writes to Supabase `vault_entries`.

**Tempo.** Event-driven. Target latency: 30 seconds from `raw_sources` insert to graph write.

**Model tier.** Haiku 4.5. Cheap, fast, sufficient for structured extraction.

**Failure mode.** Idempotent by `source_id`. Re-running the same source overwrites prior machine extractions for that source only. On crash, the job stays `pending` and is retried up to 3 times, then moved to `failed` with error logged.

**Never touches:** any node with `provenance=confirmed` or `authored`. The writer blocks it.

---

## 2. Record importer

**File:** `packages/agents/record-importer.ts`
**Runs on:** Supabase Edge Function (CSV/Sheets upload) or scheduled Edge Function (HubSpot/LinkedIn sync)
**Loop served:** memory (ingestion)

**Trigger.** User uploads CSV, Excel, or Google Sheet via the UI, or a HubSpot/LinkedIn sync job runs.

**Inputs.** Structured records. Raw column headers. User-confirmed column mapping (if already provided) or inferred mapping.

**Outputs.** Staged rows in `review_queue` table. **Nothing hits Neo4j until the human approves from the Curate UI.**

Each staged row includes:
- The proposed entity (Person, Organization, Deal, etc.)
- Dedupe candidates from the graph (existing nodes that might match)
- A confidence score (0–1) for each candidate

**Tempo.** On demand. Runs once per upload. Target: under 10 minutes for a 500-row CSV.

**Model tier.** Haiku 4.5 for column inference and dedupe matching. Sonnet 4.6 as fallback when Haiku confidence is below 0.6.

**Failure mode.** Low-confidence rows still go to the review queue — they are never auto-merged. If extraction fails entirely, the row goes to the queue as raw data with a flag for human attention.

---

## 3. Curation writer

**File:** `packages/agents/curation-writer.ts`
**Runs on:** Next.js API route
**Loop served:** memory (human curation)

**Trigger.** User action in Curate UI: approve a proposed entity, edit a field, merge two nodes, split a node, delete, or add a new node.

**Inputs.** The mutation the user performed plus their `user_id`.

**Outputs.** Writes to Neo4j with `provenance=confirmed` (for approved machine extractions) or `provenance=authored` (for typed or uploaded content).

Soft deletes move nodes to a `trash` label with a 7-day TTL before hard delete.

**Tempo.** Synchronous. Must return under 500ms for UI responsiveness.

**Model tier.** **No LLM.** This is deterministic code. The human already decided.

**Failure mode.** If the Neo4j write fails, Postgres logs the attempted mutation to a `curation_log` table so it can be replayed. The UI shows a clear error.

**Why no LLM here.** Adding a model would introduce drift on an intentional mutation. This agent is deterministic by design.

---

## 4. Sensing agent (warmth and signals)

**File:** `packages/agents/sensing.ts`
**Runs on:** Supabase Edge Function, triggered by pg_cron
**Loop served:** sensing

**Trigger.** Nightly cron at 2am local time per user. Also on-demand when curation writer mutations change stakeholder status.

**Inputs.**
- All open `Deal` and `InvestorRelationship` nodes for the user
- Their `Interaction` and `Signal` nodes from the last 60 days
- Silence durations, sentiment trends, commitment states

**Outputs.**
- Updates `warmth_score` and `days_since_touch` on Deal / InvestorRelationship (machine provenance)
- Creates new `Signal` nodes for `warmth_change` events
- All updates respect provenance rules (authored/confirmed fields not touched)

**Tempo.** Nightly per user, plus event-driven on curation mutations. Runs in under 5 minutes per user.

**Model tier.** Haiku 4.5 for per-deal scoring. Sonnet 4.6 only when a signal crosses a threshold and needs a written narrative summary.

**Failure mode.** If scoring fails for a single deal, it skips that deal and logs. Does not block the rest of the batch. Warmth scores may go stale for up to 48 hours before a user sees a warning in Today.

---

## 5. Briefing orchestrator

**File:** `packages/agents/briefing-orchestrator.ts`
**Runs on:** Claude Managed Agents session
**Loop served:** decision, action (plus light modelling, memory retrieval)

**Trigger.** Supabase pg_cron fires at 5am local time per user. An Edge Function starts a Managed Agents session with the user's id and tier.

**Inputs (composed inside the session).**
- Graph snapshot via 4 Cypher queries (open deals, investor relationships, open commitments, recent signals)
- Source rows from Postgres `raw_sources` for evidence text
- Vault matches from pgvector `vault_entries` for historical context
- User's approve/reject history from last 30 days (`action_feedback` table)
- User's latest `founder_patterns` row (weekly rollup)
- User's tier (determines internal model routing)

**Outputs.** One row in Postgres `briefings` table:
- `actions` (jsonb): up to 15 ranked actions, each with:
  - `id`, `category` (`respond`/`follow_up`/`prepare`/`outbound`), `title`, `reason`, `evidence_refs` (pointers to graph nodes and source rows), `suggested_draft` (if applicable), `confidence`
- `dropped_candidates` (jsonb): items that didn't make the 15-action cut, with reasons. Logged for transparency.
- `status` (`ready`, `degraded`, `failed`)
- `token_usage` (for billing and observability)

**Side effects on approval (triggered by user clicks in Today, not by the orchestrator directly):**
- Drafts written to Gmail drafts folder
- Reminders scheduled
- `Commitment` nodes created

**Tempo.** Daily. Target completion by 6am local time. Session runs 10–45 minutes depending on graph size and tier.

**Model tier routing.**
- **Essential tier (£150/mo):** Haiku 4.5 end-to-end
- **Core tier (£500/mo):** Sonnet 4.6 end-to-end
- **Edge tier (£1800/mo):** Sonnet 4.6 executor + Opus 4.6 advisor pattern

**Internal phases (one Managed Agents session runs all five).**

1. **Sense phase** — pull graph state, identify candidate actions. Typically ~100 raw candidates.
2. **Model phase** — group candidates by account/deal/investor, attach context, resolve conflicts.
3. **Decide phase** — rank by expected value × urgency × confidence × founder pattern match.
4. **Cut phase** — hard cap at 15. Dropped items logged to `dropped_candidates`.
5. **Write phase** — generate reasoning and drafts for the final 15.

Each phase checkpoints to a Postgres `briefing_scratch` table so a session crash doesn't lose earlier work.

**Failure modes.**
- **Session crashes mid-run:** last checkpoint is used to produce a partial briefing flagged as `degraded`. User sees a banner: "Partial briefing — full run failed, retry at 6am tomorrow."
- **No checkpoint exists:** user sees "Your briefing is being rebuilt. Back in 10 minutes." Never a blank Today page.
- **Confidence below threshold on a candidate action:** action is dropped rather than included. Better 10 real than 15 with hallucinations.

**Critical constraint.** The orchestrator is allowed to miss real signals. It is **not** allowed to hallucinate them. Every action must reference specific source evidence the user can click to verify.

---

## 6. Feedback processor

**File:** `packages/agents/feedback-processor.ts`
**Runs on:** Next.js Server Action (click path) and Supabase Edge Function (weekly rollup)
**Loop served:** reflection (minimal v1 coverage)

**Trigger.**
- Every approve/reject click in Today → immediate write to `action_feedback`
- Weekly cron Sunday 11pm local → rollup into `founder_patterns`

**Inputs.**
- Click path: action id, decision (`approved`/`rejected`/`snoozed`), optional reason text, full action payload
- Weekly rollup: last 7 days of `action_feedback` plus the actions they referenced

**Outputs.**
- Click path: row in `action_feedback` table
- Weekly rollup: new row in `founder_patterns` table with a structured preference profile (`approves` / `rejects` patterns with confidence scores)

**Tempo.**
- Click path: under 100ms (must feel instant)
- Weekly rollup: Sunday 11pm local, runs under 2 minutes per user

**Model tier.**
- Click path: **no LLM** — deterministic write
- Weekly rollup: Haiku 4.5 for pattern detection

**Failure mode.** Click writes are optimistic — the UI updates immediately and a retry queue catches failed writes within 5 minutes. Rollup failures just mean tomorrow's briefing uses last week's patterns; never blocking.

**Why this is the v1 reflection loop.** Real reflection is a v2 surface (structured weekly review). For v1, we infer reflection passively from the feedback signal: which actions did the founder actually take, which did they ignore, which did they explicitly reject. That becomes the training signal for tomorrow.

---

## Tempo summary

| Agent | Tempo | Latency budget |
|---|---|---|
| Stream extractor | Event-driven | 30s per source |
| Record importer | On demand | Under 10 min per batch |
| Curation writer | Synchronous | Under 500ms |
| Sensing agent | Nightly + event | Under 5 min per user |
| Briefing orchestrator | Daily | 10–45 min per user |
| Feedback processor (click) | Immediate | Under 100ms |
| Feedback processor (rollup) | Weekly | Under 2 min per user |

## Coupling map

- Stream extractor → graph → sensing agent (next night) → briefing (next morning)
- Record importer → review queue → curation writer → graph
- Curation writer → graph (immediate) → next briefing sees it
- Briefing orchestrator → `briefings` row → Today UI → feedback processor → next briefing's context

Every agent is loosely coupled via Neo4j and Postgres. No agent directly calls another. Any agent can be swapped, retried, or rerun without touching the others.

## Model tier cost notes

- **Stream extractor** is the highest-volume agent. Haiku 4.5 only. Never upgrade it to Sonnet without a cost review.
- **Briefing orchestrator** is the highest-cost agent per run but only runs once per user per day. Tier gating means we charge users in proportion to the tier they picked.
- **Curation writer** and **feedback click path** use zero LLM tokens. They are deterministic.
- **Sensing agent** is mostly Haiku with occasional Sonnet escalation. Expected: 90% Haiku, 10% Sonnet.

## What the agents explicitly do NOT do

- No agent writes to another user's graph partition. `user_id` filter enforced at the `packages/graph` layer.
- No agent overwrites `authored` provenance. Ever.
- No agent silently drops candidate actions from the briefing without logging them to `dropped_candidates`.
- No agent bypasses the `packages/llm` wrapper. Direct Anthropic SDK calls are a lint failure.
- No agent decides to "expand scope" — the briefing is capped at 15 actions and no code path exists to exceed it.
