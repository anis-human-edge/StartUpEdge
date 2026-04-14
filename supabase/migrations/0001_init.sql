-- Startup Edge v1 initial migration
-- All tables from DATA_MODEL.md with RLS enabled

-- Enable required extensions
create extension if not exists "pgvector" with schema extensions;
create extension if not exists "pg_cron" with schema pg_catalog;

-- ============================================================
-- users (extends Supabase auth.users)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'essential' check (tier in ('essential', 'core', 'edge')),
  timezone text not null default 'UTC',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.users enable row level security;

create policy "users_own_row" on public.users
  for all using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- raw_sources
-- ============================================================
create table public.raw_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('email', 'calendar_event', 'call_transcript', 'doc', 'linkedin_message', 'manual_note')),
  external_id text,
  occurred_at timestamptz not null,
  payload jsonb not null,
  ingested_at timestamptz not null default now(),
  processed_at timestamptz,
  deleted_at timestamptz,
  unique (user_id, external_id)
);

alter table public.raw_sources enable row level security;

create policy "raw_sources_own_rows" on public.raw_sources
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- vault_entries (semantic vault with pgvector)
-- ============================================================
create table public.vault_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_id uuid not null references public.raw_sources(id) on delete cascade,
  chunk_text text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index vault_entries_embedding_idx on public.vault_entries
  using ivfflat (embedding vector_cosine_ops);

alter table public.vault_entries enable row level security;

create policy "vault_entries_own_rows" on public.vault_entries
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- jobs (Postgres-backed queue)
-- ============================================================
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('stream_extract', 'record_import', 'sensing_run', 'feedback_rollup')),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts int not null default 0,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index jobs_poll_idx on public.jobs (status, scheduled_for)
  where status = 'pending' and deleted_at is null;

alter table public.jobs enable row level security;

create policy "jobs_own_rows" on public.jobs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- import_batches
-- ============================================================
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_type text not null check (source_type in ('csv', 'xlsx', 'google_sheet', 'hubspot', 'linkedin')),
  uploaded_at timestamptz not null default now(),
  column_mapping jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.import_batches enable row level security;

create policy "import_batches_own_rows" on public.import_batches
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- review_queue
-- ============================================================
create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  proposed_entity jsonb not null,
  dedupe_candidates jsonb not null default '[]',
  confidence numeric(3, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'merged')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.review_queue enable row level security;

create policy "review_queue_own_rows" on public.review_queue
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- briefings
-- ============================================================
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  status text not null default 'generating' check (status in ('generating', 'ready', 'degraded', 'failed')),
  actions jsonb not null default '[]',
  dropped_candidates jsonb not null default '[]',
  session_id text,
  token_usage jsonb not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.briefings enable row level security;

create policy "briefings_own_rows" on public.briefings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- action_feedback
-- ============================================================
create table public.action_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  action_id text not null,
  decision text not null check (decision in ('approved', 'rejected', 'snoozed')),
  reason_text text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.action_feedback enable row level security;

create policy "action_feedback_own_rows" on public.action_feedback
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- founder_patterns
-- ============================================================
create table public.founder_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  patterns jsonb not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.founder_patterns enable row level security;

create policy "founder_patterns_own_rows" on public.founder_patterns
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- source_connections
-- ============================================================
create table public.source_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'calendar', 'drive', 'granola', 'hubspot', 'linkedin')),
  access_token text not null,
  refresh_token text,
  scopes text not null default '',
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, provider)
);

alter table public.source_connections enable row level security;

create policy "source_connections_own_rows" on public.source_connections
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
