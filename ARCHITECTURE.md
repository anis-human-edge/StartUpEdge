# ARCHITECTURE.md

Stack and wiring for Startup Edge v1. One decision per line. No options.

## Overview

Startup Edge is a TypeScript monorepo deployed across three services: Netlify (web + short-running API), Supabase (Postgres, auth, storage, edge functions), and Neo4j Aura (knowledge graph). The daily briefing runs as a Claude Managed Agents session fired by Supabase pg_cron.

No servers to manage. No Redis. No Kubernetes. No queue broker.

## Services

### Netlify
- Hosts `apps/web` (Next.js 15 App Router)
- Hosts `apps/api` — Next.js API routes on the same deployment
- API routes must complete within 10 seconds (Netlify Function limit on Pro)
- Anything longer runs on Supabase Edge Functions or Managed Agents sessions

### Supabase Pro
- **Postgres** — relational data, raw sources, jobs queue, review queue, feedback logs, briefings table
- **Auth** — email + password and Google OAuth (needed for Gmail scope)
- **Storage** — CSV uploads, exported graphs, call transcripts before extraction
- **pgvector** — embeddings over all source content (the semantic vault)
- **Edge Functions** — stream extraction workers, pg_cron triggers for briefings
- **pg_cron** — daily scheduled jobs per user (briefing kick-off, nightly sensing)

### Neo4j Aura
- Hosted Neo4j. Free tier to start, Professional as we scale past ~10 active users.
- Stores the knowledge graph only. Nothing else.
- Accessed via `packages/graph` client from API routes and Managed Agents sessions.

### Claude Managed Agents
- Runtime for the daily briefing orchestrator
- Sessions run 10–45 minutes depending on user tier and graph size
- Fire-and-forget invocation from Supabase Edge Functions via pg_cron
- Abstraction layer in `packages/llm` so fallback to Agent SDK is one day of work

## Data flow

### Ingestion (streaming sources)
1. Gmail/Calendar/Granola/Drive webhook fires → Netlify API route receives it
2. API route writes raw payload to Supabase `raw_sources` table
3. Database webhook triggers a Supabase Edge Function (the stream extractor)
4. Edge Function calls Claude Haiku 4.5 via `packages/llm` to extract entities
5. Extracted entities written to Neo4j with `provenance=machine`
6. Source content is embedded via pgvector and stored in Supabase `vault_entries`

Target latency: 30 seconds from webhook to graph write.

### Ingestion (snapshot sources)
1. User uploads CSV or connects HubSpot/LinkedIn via OAuth
2. API route writes records to `import_batches` table
3. Record importer runs (Haiku 4.5) to infer column mapping and dedupe candidates
4. Staged records land in `review_queue` table
5. User opens Curate UI, approves/edits/rejects
6. Curation writer (no LLM, deterministic) writes to Neo4j with `provenance=confirmed` or `authored`

### Nightly sensing
1. pg_cron fires at 2am local per user
2. Supabase Edge Function calls the sensing agent
3. Agent reads graph state, updates `warmth_score` on deals and investor relationships
4. Creates new `Signal` nodes for warmth changes
5. Writes complete within 5 minutes per user

### Daily briefing
1. pg_cron fires at 5am local per user
2. Supabase Edge Function kicks off a Claude Managed Agents session (fire and forget)
3. Managed Agents session runs four phases: sense, model, decide, cut, write
4. Session queries Neo4j and Postgres directly via HTTPS
5. Session writes final briefing to `briefings` table
6. User opens Today at 7am local, briefing is ready

### User feedback
1. User clicks approve or reject on an action in Today
2. Next.js Server Action writes to `action_feedback` table immediately (under 100ms)
3. Feedback processor (weekly cron, Haiku 4.5) rolls up patterns into `founder_patterns` table
4. Tomorrow's briefing reads the latest `founder_patterns` row as system-prompt context

## The jobs queue (Postgres-backed, no Redis)

A single `jobs` table with row-level locking via `SELECT ... FOR UPDATE SKIP LOCKED`. Supabase Edge Functions poll this table for work. Job types:
- `stream_extract` — one job per raw source row
- `record_import` — one job per uploaded batch
- `sensing_run` — nightly, one per user
- `feedback_rollup` — weekly, one per user

Briefings do not use the jobs table. They are kicked off directly by pg_cron.

## Package dependencies (high level)

- `packages/schema` — pure types, no runtime deps
- `packages/llm` — depends on `@anthropic-ai/sdk`, `packages/schema`
- `packages/graph` — depends on `neo4j-driver`, `packages/schema`
- `packages/db` — depends on `@supabase/supabase-js`, `packages/schema`
- `packages/agents` — depends on all of the above
- `apps/web` — depends on `packages/schema`, `packages/db`, `packages/graph`
- `apps/api` — depends on all packages except `packages/agents`
- `supabase/functions` — imports from `packages/agents`, bundled via esbuild

## Environment variables

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Neo4j Aura
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=

# Anthropic
ANTHROPIC_API_KEY=

# Google OAuth (for Gmail, Calendar, Drive)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# HubSpot
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=

# App
NEXT_PUBLIC_APP_URL=
SENTRY_DSN=
POSTHOG_API_KEY=
```

A `.env.example` at the repo root lists all of these.

## Deployment

- `apps/web` and `apps/api` → Netlify, one deploy per push to `main`
- `supabase/functions/*` → Supabase CLI, deployed via GitHub Action on push
- `supabase/migrations/*` → Supabase CLI, applied via GitHub Action on push
- Neo4j schema constraints → applied via a migration script in `packages/graph/migrations`, run manually or via CI

## CI

One GitHub Actions workflow: `lint → typecheck → test → build → deploy`. Runs on every push. Deploys to Netlify and Supabase on green main.

## Observability

- **Sentry** — error tracking across web, api, agents, edge functions
- **PostHog** — product analytics (briefing completion rate, action approval rate, curation events)
- **Supabase logs** — edge function logs, database logs, auth logs
- **Pino structured logs** in every Node process, shipped to Sentry breadcrumbs

## Security and privacy

- All Gmail, Calendar, Drive, HubSpot OAuth tokens stored encrypted in Supabase (via Supabase Vault)
- All graph data encrypted at rest (Neo4j Aura default)
- All Postgres data encrypted at rest (Supabase default)
- Row-level security (RLS) on every Supabase table — users can only read their own data
- Neo4j graph is logically partitioned by `user_id` property on every node; all queries filter by `user_id` — enforced in `packages/graph` query builders
- User can wipe their entire graph and vault from Settings. Hard delete, cascading.

## What we explicitly do not run

No Redis. No RabbitMQ. No Elasticsearch. No Kafka. No standalone Postgres (Supabase only). No Pinecone (pgvector only). No Kubernetes. No Docker in production (Supabase handles it). No custom auth. No microservices.

One less thing to run is one more day of building the product.
