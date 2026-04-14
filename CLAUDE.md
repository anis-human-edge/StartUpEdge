# CLAUDE.md

Read this file at the start of every session. It is the standing brief for the Startup Edge codebase.

## What we're building

Startup Edge is a daily agent for solo founders selling into enterprise or raising capital. It reads everything the founder interacts with, remembers everything that matters, senses what's changing across every account and relationship, and each morning delivers the 15 most important actions for the day — ranked, with reasoning, ready to approve and execute.

It is not a productivity tool. It is a decisions engine. We sell outcomes, not outputs.

## The thesis in one paragraph

Every viable entity runs six cognitive loops: sensing, modelling, decision, action, memory, reflection. Current AI tools optimise the action loop, which is the one loop that was already working. Startup Edge is built on the opposite bet: action is cheap, attention is scarce, and the founder's real bottleneck is that their internal variety cannot match their environment's. We close that gap by putting agents on the five loops nobody else is serving.

## Hard rules — never violate

1. **One visible surface for actions.** The Today page. No dashboards. No analytics views. No multi-pivot data tables. Every feature request gets evaluated against "does this go into the daily briefing, or does it go on the roadmap?" Default answer: roadmap.
2. **15 actions per day, hard cap.** Never 16. Never "and here are 8 more optional ones". If more than 15 are candidates, the ranker cuts. Dropped items are logged for transparency, never silently deferred.
3. **Confidence over recall.** The briefing agent is allowed to miss a real signal. It is not allowed to hallucinate one. Better 10 real actions than 15 with 3 invented.
4. **Provenance is sacred.** Every node and edge in the graph carries one of three tags: `machine`, `confirmed`, `authored`. Human edits are never overwritten by machine runs. This rule has no exceptions.
5. **Every action shows its evidence.** If the briefing says "reply to Sarah", it must show the sentence in the email that triggered the recommendation. No action without a visible source.
6. **No LLM in the curation write path.** When the human edits, the system writes deterministically. The only models that run on human input are the ones helping with column mapping during import, and those write to a review queue, never directly to the graph.
7. **Soft deletes only in v1.** 7-day trash before anything is gone forever.

## What v1 is, what v1 is not

**V1 is:** Gmail ingestion, Calendar, Granola transcripts, Drive docs, CSV/HubSpot/LinkedIn import via review queue, a Neo4j knowledge graph, a Supabase semantic vault, six agents (stream extractor, record importer, curation writer, sensing, briefing orchestrator, feedback processor), and four UI surfaces (Today, Graph, Curate, Settings).

**V1 is not:** Reflection loop as a visible surface. Portfolio tier for investors. Accelerator tier. Team mode inside a single startup. Mobile native app. Multilingual support. On-premise deployment.

All of these are v2 or later. Do not add them. If a request looks like scope creep, say so.

## Voice and style for anything user-facing

Short sentences. Direct. No fluff. No em dashes. No buzzwords. Conversational, grounded, builder tone. Sentence case, always. Never title case, never all caps. Strip any phrase that sounds like a LinkedIn post. If it sounds like AI wrote it, rewrite it.

For UI copy: describe what the system is doing in boring, precise terms. "Reading your email" not "Diving deep into your communication patterns". "3 actions need your attention" not "Your curated daily intelligence briefing".

## Code conventions

- **Language:** TypeScript everywhere. Strict mode on. No `any` without a comment explaining why.
- **Runtime:** Node 22. ESM only.
- **Package manager:** pnpm. Workspaces configured in `pnpm-workspace.yaml`.
- **Monorepo layout:**
  - `apps/web` — Next.js 15 App Router frontend, Tailwind, shadcn/ui
  - `apps/api` — Next.js API routes on the same deployment (short requests only, under 10s)
  - `packages/agents` — agent implementations (stream extractor, record importer, curation writer, sensing, briefing orchestrator, feedback processor)
  - `packages/schema` — shared Zod schemas, Cypher constraints, TypeScript types for all graph and Postgres models
  - `packages/llm` — the Claude SDK wrapper that routes by tier, handles retries, and logs token usage
  - `packages/graph` — Neo4j client, query builders, provenance enforcement
  - `packages/db` — Supabase client, migrations, typed queries
  - `supabase/functions` — Supabase Edge Functions for stream extraction
  - `supabase/migrations` — SQL migrations
- **Validation:** Zod schemas in `packages/schema` are the source of truth. API routes, agent inputs, and database types all derive from them.
- **Error handling:** all async boundaries use `Result<T, E>` types from `neverthrow`. No throwing across module boundaries.
- **Testing:** Vitest. Every agent has a golden-input test. Every Cypher query has a schema test. Snapshot tests for briefing output.
- **Logging:** structured JSON via pino. No `console.log` in production paths.
- **Secrets:** never hardcoded. `.env.local` for dev, Netlify/Supabase env vars for prod. A `.env.example` lives at the repo root.

## Do not reach for these tools

No Redis. No BullMQ. No Kafka. No microservices. No GraphQL. No LangChain. No AutoGen. No CrewAI. No Kubernetes. No Terraform. No Pinecone. No custom auth. No ORM heavier than Drizzle. No Prisma. No state management libraries — Next.js server components and React Server Actions handle state.

If a task seems to need one of these, stop and ask. There is almost always a simpler answer.

## What to do when you're uncertain

Ask. Do not guess at architectural decisions. Do not invent a new abstraction because the existing one feels slightly wrong. Do not refactor code outside the scope of the task you were given. When in doubt, prefer the smaller change.

## Files Claude Code should read on every new session

1. This file (CLAUDE.md)
2. ARCHITECTURE.md — stack and wiring
3. DATA_MODEL.md — graph and Postgres schema
4. AGENTS.md — the six agent contracts
5. BUILD_PHASES.md — current phase and exit criteria

All five files live at the repo root.

## The fitness function

The founder is trying to find validated demand before cash runs out, or close a fundraising round before cash runs out. Every line of code in this repo serves that question. If a feature does not help a founder see reality more clearly, remember more faithfully, decide more sharply, or act more effectively on the things that matter most, it does not belong in v1.
