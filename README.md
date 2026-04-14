# Startup Edge

Daily decisions engine for solo founders selling into enterprise or raising capital.

## Setup

```bash
pnpm install
cp .env.example .env.local
# Fill in credentials in .env.local
```

## Development

```bash
pnpm dev          # Start Next.js dev server
pnpm typecheck    # TypeScript check across all packages
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm build        # Production build
```

## Monorepo layout

- `apps/web` — Next.js 15 App Router frontend
- `apps/api` — Shared API route logic
- `packages/schema` — Zod schemas and TypeScript types
- `packages/llm` — Claude SDK wrapper
- `packages/graph` — Neo4j client and query builders
- `packages/db` — Supabase client and typed queries
- `packages/agents` — Agent implementations
- `supabase/functions` — Supabase Edge Functions
- `supabase/migrations` — SQL migrations
