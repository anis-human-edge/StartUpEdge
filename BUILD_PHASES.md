# BUILD_PHASES.md

Ten phases to v1. Each phase has scope, exit criteria, and a demo moment you can point at. Claude Code should work one phase at a time and mark a phase complete only when the exit criteria are met.

**Current phase: 0 (not started).**

---

## Phase 0: Repo and scaffolding

**Scope.**
- Initialise pnpm monorepo with workspaces: `apps/web`, `apps/api`, `packages/schema`, `packages/llm`, `packages/graph`, `packages/db`, `packages/agents`, `supabase/functions`, `supabase/migrations`
- Install core dependencies: Next.js 15, TypeScript strict, Tailwind, shadcn/ui, Vitest, Pino, Zod, neverthrow
- Set up GitHub Actions CI (lint, typecheck, test, build)
- Set up Netlify project connected to main branch
- Set up Supabase Pro project, enable pgvector, pg_cron
- Set up Neo4j Aura free tier instance
- Create `.env.example` at repo root
- Apply Neo4j constraints from DATA_MODEL.md
- Apply Supabase initial migration creating all tables from DATA_MODEL.md
- Enable RLS on every Supabase table

**Exit criteria.**
- `pnpm install` succeeds cleanly
- `pnpm typecheck` passes with zero errors
- `pnpm test` runs (no tests yet, but the runner works)
- Deployment to Netlify on green main works
- Supabase migration applied in dev project
- Neo4j constraints applied in Aura free instance
- A blank "Hello Startup Edge" page renders at the Netlify URL

**Demo moment.** A deployed URL that shows "Hello Startup Edge" and a deployed Supabase project you can connect to.

---

## Phase 1: Auth and user setup

**Scope.**
- Supabase Auth with email+password and Google OAuth
- Sign-up, sign-in, sign-out flows in `apps/web`
- User profile page
- Extended `users` table with `tier`, `timezone`, `onboarded_at`
- Tier selection during sign-up (Essential/Core/Edge — UI only, no billing yet)
- `packages/db` client with typed queries for the `users` table

**Exit criteria.**
- A new user can sign up with email or Google
- User lands on an empty `/today` page after onboarding
- Tier is stored and can be changed in settings
- RLS blocks one user from reading another user's row

**Demo moment.** Sign up two users, confirm they see only their own profile.

---

## Phase 2: Gmail ingestion

**Scope.**
- Google OAuth flow for Gmail (plus calendar and drive scopes — we'll use them later)
- `source_connections` table populated with encrypted tokens
- Gmail History API sync: 90-day backfill on connect, then continuous sync via push notifications or polling (start with polling every 5 min, push later)
- Write raw messages to `raw_sources` table with `kind=email`
- Database webhook fires when a row is inserted

**Exit criteria.**
- User connects Gmail from Settings
- Last 90 days of email land in `raw_sources` within 10 minutes
- New incoming email appears in `raw_sources` within 10 minutes of arrival
- No emails are duplicated (external_id uniqueness enforced)

**Demo moment.** Connect your own Gmail, see the row count in `raw_sources` climb to match your inbox.

---

## Phase 3: Stream extractor and graph writes

**Scope.**
- `packages/llm` wrapper with tier routing and retries
- `packages/graph` with Neo4j client and the provenance-enforcing writer
- `packages/agents/stream-extractor.ts` deployed as a Supabase Edge Function
- Database webhook from `raw_sources` triggers the edge function
- Edge function calls Haiku 4.5, extracts entities, writes to Neo4j
- `vault_entries` embeddings written via pgvector

**Exit criteria.**
- Every row in `raw_sources` gets processed within 30 seconds
- Neo4j contains `Person`, `Organization`, `Interaction` nodes for every email
- `PARTICIPATES_IN`, `MENTIONS` edges exist
- No duplicate Person nodes for the same email address
- Provenance is set to `machine` on every node created
- Re-running extraction on the same source is idempotent
- Token usage logged per extraction

**Demo moment.** Run a Cypher query in Neo4j Aura: `MATCH (p:Person) RETURN count(p)` — should show dozens of real people from your inbox. `MATCH (p:Person)-[:PARTICIPATES_IN]->(i:Interaction) RETURN p.name, count(i)` — should show your top email contacts ranked.

---

## Phase 4: Graph UI and the warmth map

**Scope.**
- `/graph` page in `apps/web`
- Searchable list of Persons, Organizations, Deals
- Click a Person to see their card: profile, linked organizations, recent interactions
- Warmth map view: a sortable table of all target accounts with a computed warmth score (simple version: days since touch + interaction count in last 60 days + sentiment average)
- This is the "minute 5 of day one" hook from the PRD

**Exit criteria.**
- User can search for any person by name or email and see their card
- User can see a list of all detected accounts sorted by warmth
- Clicking an account shows all people, interactions, and signals linked to it
- The view is read-only — no editing yet
- Page loads in under 2 seconds with 500 people in the graph

**Demo moment.** Open `/graph`, see 200+ people and 40+ accounts from your inbox without having entered any of them manually. This is the "oh wow" moment.

---

## Phase 5: Curate UI (the human layer)

**Scope.**
- `/curate` page in `apps/web`
- Review queue interface: list of machine-extracted entities with "Approve / Edit / Reject / Merge" actions
- Add Person, Add Organization, Add Deal forms
- Edit existing nodes (changes `provenance` to `confirmed` or `authored`)
- Merge duplicate persons/orgs (with provenance preservation)
- Soft delete with 7-day trash
- `packages/agents/curation-writer.ts` handles all writes deterministically

**Exit criteria.**
- User can approve, edit, reject, or merge any machine-extracted node
- Human edits never get overwritten by the next stream extractor run (provenance rule enforced)
- User can manually add people/orgs/deals not in any email
- Deleted items go to trash and can be restored within 7 days
- Curation writes return under 500ms

**Demo moment.** Merge two duplicate "Sarah" entries in the graph. Run stream extractor again. Verify the merge is preserved.

---

## Phase 6: Snapshot source importers

**Scope.**
- CSV upload flow: drag and drop, preview, column mapping wizard
- Excel and Google Sheets support (read-only, one-time import)
- HubSpot OAuth and contact/deal sync → review queue
- LinkedIn contact export CSV support (LinkedIn doesn't have a contact API; users export CSV and upload)
- `packages/agents/record-importer.ts` — Haiku 4.5 for column inference, dedupe candidate detection
- Every imported row lands in `review_queue` for human approval
- Select-all + approve flow for power users

**Exit criteria.**
- User can upload a 500-row CSV and see it in the review queue within 10 minutes
- Each row shows dedupe candidates with confidence scores
- User can approve all or approve row-by-row
- HubSpot sync works for contacts and deals
- Nothing auto-writes to the graph — every import goes through review

**Demo moment.** Upload your entire LinkedIn contacts CSV. See 800 entries in the review queue with dedupe matches against your Gmail-extracted people.

---

## Phase 7: Sensing agent and the warmth score upgrade

**Scope.**
- `packages/agents/sensing.ts` deployed as a Supabase Edge Function
- pg_cron schedule: nightly per user at 2am local
- Upgraded warmth score: LLM-scored sentiment, silence detection, commitment status, signal strength
- New `Signal` nodes created for `warmth_change` events
- Signal resolution flow: users can mark signals as resolved from Curate

**Exit criteria.**
- Every user's warmth scores refresh nightly
- Warmth scores reflect real signal (e.g. 21 days of silence drops warmth materially)
- New signals appear on the graph UI within 24 hours of the triggering event
- Sensing agent respects provenance — doesn't overwrite authored notes on Deal nodes

**Demo moment.** Let it run for a few days. Compare yesterday's warmth scores to today's. The accounts you engaged should climb, the ones you ignored should drop.

---

## Phase 8: Briefing orchestrator (the main event)

**Scope.**
- `packages/agents/briefing-orchestrator.ts` as a Claude Managed Agents session
- pg_cron schedule: daily per user at 5am local
- Five-phase session (sense → model → decide → cut → write)
- Checkpoints to `briefing_scratch` table between phases
- Writes final briefing to `briefings` table
- `/today` page renders the 15 actions with evidence, reasons, and drafts
- Approve/reject UI with one-click actions
- Actions that involve sending a Gmail draft write to the user's Gmail drafts folder on approval

**Exit criteria.**
- A briefing is generated every morning for every user
- Briefing completes in under 45 minutes even at Edge tier
- Every action shows its source evidence (click to see the email that triggered it)
- Dropped candidates are logged to `dropped_candidates` for inspection
- Approving an action creates the Gmail draft
- No action without evidence
- No more than 15 actions ever shown
- If generation fails, degraded banner shown; never a blank Today page

**Demo moment.** Wake up at 7am. Open Today. See 15 actions for the day, ranked, with evidence, with drafts ready to send. This is the product.

---

## Phase 9: Feedback loop and preference learning

**Scope.**
- `action_feedback` writes on every approve/reject click (under 100ms)
- Weekly rollup job (Sunday 11pm local) generates `founder_patterns` row
- `founder_patterns` is injected into the briefing orchestrator's system prompt as context
- Snooze option on actions (defer to tomorrow)
- Pattern display in Settings so the user can see what the system has learned about them

**Exit criteria.**
- Every click writes feedback within 100ms
- Weekly rollup runs and produces a `founder_patterns` row
- Tomorrow's briefing demonstrably adapts based on rejected patterns (tested via a simulation)
- User can view their pattern profile in Settings

**Demo moment.** Reject all outbound actions for a week. Open Settings → Patterns. Confirm the system has learned "this founder rejects outbound." Next briefing contains fewer outbound suggestions.

---

## Phase 10: Polish, pricing, and launch

**Scope.**
- Pricing tier enforcement: model routing based on user tier, token metering, overage calculation
- Real-time token consumption display in Settings
- Billing integration (Stripe — a new dependency, flagged here)
- Data export: user can export their entire graph as JSON
- Data wipe: one-click hard delete of graph + vault + sources
- Privacy and terms pages
- Onboarding flow: sign-up → connect Gmail → wait for first extraction → see warmth map → see first briefing → done
- Sentry + PostHog wired up
- Landing page at `/` for non-authenticated visitors

**Exit criteria.**
- Three tiers work end-to-end with correct model routing
- Stripe subscriptions live for all three tiers
- User can export and wipe their data
- New user can go from sign-up to first warmth map in under 10 minutes
- New user can go from sign-up to first real briefing in under 24 hours
- Error rate under 1% on any critical path
- Sentry is catching and reporting errors
- PostHog is tracking the primary health metric: briefing completion rate

**Demo moment.** A real founder signs up, connects Gmail, and the next morning wakes up to their first briefing. They approve some actions. The system starts working for them.

---

## Global rules across all phases

1. **Each phase ends with a working, deployable build.** No "phase 5 is almost done, let's start phase 6." Finish before moving on.
2. **No feature added without explicit scope.** If Claude Code wants to add something not in the phase scope, stop and ask.
3. **Exit criteria are not negotiable.** If a phase is 90% done, it is not done. Finish it.
4. **Every phase must update the CLAUDE.md "current phase" line at the top of this file when it starts and finishes.**
5. **Breaking the provenance rules is a ship-blocker.** Any change to `packages/graph/writer.ts` needs a review.
6. **The 15-action cap is a ship-blocker.** Any code path that could emit more than 15 is a bug.
7. **No scope creep into v2.** If a request looks like it belongs in the v2 roadmap (reflection UI, team mode, portfolio tier, mobile native, multilingual), push back and link to the PRD.

## What's not in the ten phases

These are intentionally out of scope for v1:
- Slack, Twitter, WhatsApp, Notion, Salesforce, Calendly ingestion
- Team mode (two humans sharing one graph)
- Mobile native app
- Reflection loop as a visible surface
- Portfolio and accelerator tiers
- Multilingual
- On-premise deployment

Phases 11+ live in the roadmap, not in this file.
