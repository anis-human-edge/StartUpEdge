# DATA_MODEL.md

Schema for Startup Edge v1. Neo4j holds the graph. Supabase Postgres holds everything else.

## What lives where

**Neo4j Aura holds:** nodes and relationships. Entities and their links. Small, structured, queried by traversal.

**Supabase Postgres holds:** raw source content, jobs queue, review queue, user auth, billing, approve/reject logs, briefings, pgvector embeddings. Large, append-heavy, queried by key or similarity.

**The link:** every Neo4j node that derives from a source carries a `source_ids` array pointing to Postgres rows. The briefing agent queries Neo4j for structure, then pulls source rows and vault matches from Postgres for evidence.

Every Neo4j node also carries a `user_id` property. Every query filters by it. This is enforced in `packages/graph` query builders — direct Cypher that bypasses the builder is a lint failure.

---

## Neo4j: node types

All nodes carry these properties unless noted:
- `id` (uuid, primary key)
- `user_id` (uuid, partition key)
- `provenance` (enum: `machine`, `confirmed`, `authored`)
- `created_at`, `updated_at` (ISO timestamps)
- `updated_by` (either `agent:<agent_name>` or `user:<user_id>`)
- `source_ids` (array of Postgres row ids where this node's facts came from)

### Person
- `name` (string)
- `email` (string, nullable, indexed)
- `linkedin_url` (string, nullable)
- `title` (string, nullable)
- `roles` (string array): any of `founder`, `investor`, `advisor`, `buyer`, `champion`, `blocker`, `evaluator`, `gatekeeper`, `influencer`
- `notes` (string, nullable)

### Organization
- `name` (string)
- `domain` (string, nullable, indexed)
- `type` (enum: `target_account`, `investor_firm`, `advisor_firm`, `partner`, `our_company`, `other`)
- `sector` (string, nullable)
- `size_bucket` (enum: `startup`, `smb`, `midmarket`, `enterprise`, nullable)
- `notes` (string, nullable)

### Deal
- `name` (string)
- `stage` (enum: `discovery`, `qualified`, `proposal`, `negotiation`, `closed_won`, `closed_lost`, `dormant`)
- `value_estimate` (number, nullable, in USD cents)
- `probability` (number 0–1, nullable)
- `expected_close_date` (date, nullable)
- `warmth_score` (number 0–100, computed by sensing agent)
- `last_interaction_at` (timestamp, nullable)
- `days_since_touch` (number, computed)

### InvestorRelationship
- `stage` (enum: `researching`, `intro_requested`, `first_meeting`, `follow_up`, `due_diligence`, `committed`, `passed`, `ghosted`)
- `check_size_estimate` (number, nullable, in USD cents)
- `warmth_score` (number 0–100)
- `last_interaction_at` (timestamp, nullable)
- `days_since_touch` (number, computed)

### Interaction
- `type` (enum: `email`, `call`, `meeting`, `linkedin_message`, `note`)
- `direction` (enum: `inbound`, `outbound`, `mutual`)
- `occurred_at` (timestamp, indexed)
- `summary` (string, max 500 chars)
- `sentiment` (number -1 to 1, computed, nullable)
- `source_id` (uuid, points to Postgres `raw_sources.id`)

### Signal
- `type` (enum: `promise_made`, `objection_raised`, `question_asked`, `silence`, `warmth_change`, `external_event`)
- `strength` (number 1–5)
- `direction` (enum: `positive`, `negative`, `neutral`)
- `detected_at` (timestamp)
- `summary` (string, max 300 chars)
- `resolved` (boolean, default false)
- `resolved_at` (timestamp, nullable)
- `source_id` (uuid, nullable)

### Commitment
- `description` (string, max 500 chars)
- `owner` (string: `me` or a Person uuid)
- `due_date` (date, nullable)
- `status` (enum: `open`, `done`, `overdue`, `cancelled`)
- `completed_at` (timestamp, nullable)
- `source_id` (uuid, nullable)

### Document
- `title` (string)
- `type` (enum: `pitch_deck`, `icp_doc`, `product_spec`, `account_list`, `investor_list`, `proposal`, `other`)
- `content_id` (uuid, points to Postgres `vault_entries.id` where raw + embedding live)

---

## Neo4j: edge types

All edges carry:
- `provenance` (enum: `machine`, `confirmed`, `authored`)
- `created_at` (timestamp)
- `confidence` (number 0–1, for machine-generated edges)

| Edge | From → To | Extra properties |
|---|---|---|
| `WORKS_AT` | Person → Organization | `title`, `since`, `until`, `current` (bool) |
| `PARTICIPATES_IN` | Person → Interaction | `role` (sender/recipient/cc/attendee) |
| `INVOLVES` | Interaction → Deal or InvestorRelationship | — |
| `STAKEHOLDER_OF` | Person → Deal | `role` (champion/blocker/buyer/evaluator/etc.) |
| `REPRESENTS` | Person → InvestorRelationship | `is_lead` (bool) |
| `AT_ACCOUNT` | Deal → Organization | — |
| `AT_FIRM` | InvestorRelationship → Organization | — |
| `MENTIONS` | Interaction → Person/Organization/Deal | — |
| `EMITS` | Interaction → Signal | — |
| `PROMISED` | Interaction → Commitment | — |
| `REFERENCES` | Interaction → Document | — |
| `CONNECTED_TO` | Person → Person | `strength` (1–5), `source` |

---

## Neo4j constraints (Cypher)

```cypher
// Uniqueness
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT deal_id IF NOT EXISTS FOR (d:Deal) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT investor_rel_id IF NOT EXISTS FOR (i:InvestorRelationship) REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT interaction_id IF NOT EXISTS FOR (i:Interaction) REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT signal_id IF NOT EXISTS FOR (s:Signal) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT commitment_id IF NOT EXISTS FOR (c:Commitment) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;

// Indexes for common lookups
CREATE INDEX person_email IF NOT EXISTS FOR (p:Person) ON (p.user_id, p.email);
CREATE INDEX org_domain IF NOT EXISTS FOR (o:Organization) ON (o.user_id, o.domain);
CREATE INDEX interaction_occurred IF NOT EXISTS FOR (i:Interaction) ON (i.user_id, i.occurred_at);
CREATE INDEX deal_stage IF NOT EXISTS FOR (d:Deal) ON (d.user_id, d.stage);
CREATE INDEX investor_stage IF NOT EXISTS FOR (i:InvestorRelationship) ON (i.user_id, i.stage);
```

---

## Provenance enforcement rule

Every write to Neo4j goes through `packages/graph/writer.ts`. The writer enforces:

1. If existing node/edge has `provenance=authored`, machine writes are **blocked entirely**. The human owns this fact.
2. If existing has `provenance=confirmed`, machine writes are **blocked on fields the human touched**, allowed on new fields.
3. If existing has `provenance=machine`, machine writes are allowed if the new write is newer by source timestamp OR has higher confidence.
4. Human writes via the curation writer always succeed. They set `provenance=confirmed` (approval of machine extraction) or `provenance=authored` (direct entry).

This rule has zero exceptions. Direct Cypher that bypasses the writer is a lint failure.

---

## Supabase Postgres: tables

### `users`
Standard Supabase auth users table, extended with:
- `tier` (enum: `essential`, `core`, `edge`)
- `timezone` (string)
- `onboarded_at` (timestamp)

### `raw_sources`
Append-only. Every email, transcript, doc, note lands here.
- `id` (uuid, primary key)
- `user_id` (uuid, FK to users)
- `kind` (enum: `email`, `calendar_event`, `call_transcript`, `doc`, `linkedin_message`, `manual_note`)
- `external_id` (string, nullable — e.g. Gmail message id)
- `occurred_at` (timestamp)
- `payload` (jsonb — raw source data)
- `ingested_at` (timestamp, default now)
- `processed_at` (timestamp, nullable — set when stream extractor finishes)

### `vault_entries`
The semantic vault.
- `id` (uuid, primary key)
- `user_id` (uuid)
- `source_id` (uuid, FK to raw_sources)
- `chunk_text` (text)
- `embedding` (vector(1536) — using OpenAI text-embedding-3-small or equivalent)
- `metadata` (jsonb)
- `created_at` (timestamp)

Index: `CREATE INDEX ON vault_entries USING ivfflat (embedding vector_cosine_ops);`

### `jobs`
The Postgres-backed queue.
- `id` (uuid, primary key)
- `user_id` (uuid)
- `type` (enum: `stream_extract`, `record_import`, `sensing_run`, `feedback_rollup`)
- `payload` (jsonb)
- `status` (enum: `pending`, `running`, `done`, `failed`)
- `attempts` (int, default 0)
- `scheduled_for` (timestamp)
- `started_at`, `completed_at` (timestamps, nullable)
- `error` (text, nullable)

Workers poll with `SELECT ... FOR UPDATE SKIP LOCKED`.

### `import_batches`
One row per CSV upload or CRM sync.
- `id`, `user_id`, `source_type` (enum: `csv`, `xlsx`, `google_sheet`, `hubspot`, `linkedin`), `uploaded_at`, `column_mapping` (jsonb), `status`

### `review_queue`
Staged records waiting for human approval.
- `id`, `user_id`, `batch_id` (FK), `proposed_entity` (jsonb — the Person/Org/Deal we want to create), `dedupe_candidates` (jsonb — existing graph nodes we might merge with), `confidence` (number 0–1), `status` (enum: `pending`, `approved`, `rejected`, `merged`)

### `briefings`
One row per daily briefing.
- `id`, `user_id`, `generated_at`, `status` (enum: `generating`, `ready`, `degraded`, `failed`), `actions` (jsonb — the 15 ranked actions), `dropped_candidates` (jsonb — the items that didn't make the cut, with reasons), `session_id` (Managed Agents session ID), `token_usage` (jsonb)

### `action_feedback`
Every approve/reject click.
- `id`, `user_id`, `briefing_id` (FK), `action_id`, `decision` (enum: `approved`, `rejected`, `snoozed`), `reason_text` (text, nullable), `created_at`

### `founder_patterns`
Weekly rollup, used as system-prompt context for tomorrow's briefing.
- `id`, `user_id`, `generated_at`, `patterns` (jsonb — structured blob of "this founder approves X-type actions, rejects Y-type")

### `source_connections`
OAuth tokens and connection state.
- `id`, `user_id`, `provider` (enum: `gmail`, `calendar`, `drive`, `granola`, `hubspot`, `linkedin`), `access_token` (encrypted), `refresh_token` (encrypted), `scopes`, `connected_at`, `last_sync_at`, `status`

---

## Row-level security (RLS)

Enabled on every table. Default policy: a user can read and write only rows where `user_id = auth.uid()`. Service role (used by Edge Functions and the briefing orchestrator) bypasses RLS via the service role key.

---

## What a typical briefing query looks like

```cypher
// From the briefing orchestrator, pseudocode
MATCH (u:User {id: $userId})
MATCH (d:Deal {user_id: $userId})
WHERE d.stage IN ['discovery', 'qualified', 'proposal', 'negotiation']
OPTIONAL MATCH (d)<-[:STAKEHOLDER_OF]-(p:Person)
OPTIONAL MATCH (d)<-[:INVOLVES]-(i:Interaction)
  WHERE i.occurred_at > datetime() - duration('P30D')
OPTIONAL MATCH (i)-[:EMITS]->(s:Signal {resolved: false})
OPTIONAL MATCH (c:Commitment {user_id: $userId, owner: 'me', status: 'open'})
RETURN d, collect(DISTINCT p) as stakeholders,
       collect(DISTINCT i) as recent_interactions,
       collect(DISTINCT s) as open_signals,
       collect(DISTINCT c) as open_commitments
```

Plus a parallel query for `InvestorRelationship`. Plus a Postgres fetch of `raw_sources` by `source_id` for evidence text. Plus a pgvector similarity search against `vault_entries` for any historical context the ranker wants.

Four queries total per briefing. Fast even at 500 deals.

---

## What v1 explicitly leaves out

- No `Lesson` node (reflection loop, v2)
- No `Hypothesis` node (modelling stays implicit inside the briefing agent in v1)
- No `Meeting` node distinct from `Interaction`
- No time-versioned edges — if a Person changes title, we update the `title` field and rely on source history for audit
- No multi-tenant graph — one user per graph partition, enforced by `user_id` on every node
