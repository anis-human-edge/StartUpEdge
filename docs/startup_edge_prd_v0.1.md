# Startup Edge
## Product Requirements Document, v0.1

**Status:** Draft for founder review
**Date:** April 14, 2026
**Author:** Founding team
**Related:** StepUp.One (done-for-you sibling company)

---

## 1. The thesis

We are moving into a world where AI, the same AI that is going to help us, has completely screwed up our entire world with millions of noise-producing agents. Within this noise hides the most important opportunities any founder has. Startup Edge rejects the thousand things that are noise and surfaces the five that are opportunities, then builds everything for the founder to approve and execute.

This is not a productivity tool. It is a decisions engine.

Every existing tool sold to founders optimises the action loop: write emails faster, take notes faster, schedule faster, summarise faster. Startup Edge takes a different position. Action is the only loop that was already working. The real leverage is in sensing and memory, and the real output is not more action but radically fewer, radically better actions.

**Founding principle:** Human + AI = Outcomes. AI alone produces outputs. Humans plus AI produce outcomes. Startup Edge is the context infrastructure that makes this equation true for one specific kind of human: the founder trying to survive the pre-seed to Series A gap.

---

## 2. The fitness function and the six loops

A startup dies from hallucinated demand. It must find real fit before runway ends.

Every agent in Startup Edge exists to serve this single fitness function. The product is organised around six cognitive loops any entity must run to match its environment. For a founder selling into enterprise or raising capital, the loops in priority order are:

1. **Sensing** — track which specific humans on each account are moving toward yes or away, hour by hour
2. **Modelling** — maintain a live map of each account: economic buyer, champion, blocker, their incentives, and where this deal sits for them
3. **Decision** — pick the three accounts that get most of this week's time, and the ones to deliberately let cool
4. **Memory** — capture every off-hand comment, promise, objection, and surface the right one before each next meeting
5. **Action** — execute the prioritised emails, calls, demos and proposals the other five loops tell you to run
6. **Reflection** — after each win or loss, name the real cause and update the approach

### V1 loop coverage

V1 runs five of the six loops. Reflection is explicitly deferred to v2 because it requires a second user surface (structured weekly review) that we do not want to build yet.

| Loop | V1 coverage | Where it lives |
|------|-------------|----------------|
| Sensing | Heavy | Ingestion pipeline and signal detection agents |
| Memory | Heavy | Knowledge graph and semantic vault |
| Modelling | Light | Implicit inside the daily briefing agent |
| Decision | Light | Implicit inside the daily briefing agent |
| Action | Heavy | Prioritised daily briefing as the only user surface |
| Reflection | Deferred | V2 |

The product has **one visible surface**: the daily briefing. Everything else is substrate.

---

## 3. The product in one sentence

Startup Edge is a daily agent that reads everything a founder interacts with, remembers everything that matters, senses what is changing across every account and relationship, and each morning delivers the fifteen most important actions for today — ranked, with reasoning, ready to approve and execute.

---

## 4. The user

### V1 target: the solo founder

- Pre-seed to Series A
- Selling into enterprise accounts, or actively fundraising, or both
- Managing 20 to 100 target accounts or investors simultaneously
- Has a Gmail or Google Workspace account
- Currently uses a patchwork of Notion, a CRM, ChatGPT and their own memory
- Loses deals and introductions they should have won because they forgot, missed signals, or spent time on the wrong account

### V2 targets (deferred)

- Investors managing portfolios of 5 to 20 startups
- Accelerators running batches of 10 to 50 founders

These share the same underlying product. They differ in onboarding, billing, and multi-tenant graph management. V1 is deliberately scoped to one tenant per account.

---

## 5. Day one: minute by minute

This section is load-bearing. If the first ten minutes do not land, nothing else in the PRD matters.

**Minute 0 to 2.** Founder signs up with email and password. Picks a pricing tier (see section 11). Connects Gmail via OAuth. Optionally connects calendar, Granola, and Google Drive with documents labelled as pitch deck, ICP doc, product spec, or account list.

**Minute 2 to 5.** System shows a progress screen: *"Reading your last 90 days of email. This takes about 5 minutes."* Behind the scenes, a Claude Managed Agents session starts ingesting email. It extracts people, accounts, commitments, signals, and meeting references, and begins building the knowledge graph.

**Minute 5 to 8.** First moment of value arrives. System displays:

> We found 47 accounts, 214 people, and 11 active conversations across your last 90 days of email.
>
> Here is your account warmth map, built from email tone, reply cadence, and commitment density.
>
> Three accounts are heating up. Two are cooling. One you have not touched in 21 days despite promising to.

The warmth map is the hook. Every founder knows some accounts are hot and some are cold, but no founder has ever seen this view. Email alone is enough to build it, which means the cold-start problem is close to zero: if the founder has Gmail, they get value immediately.

**Minute 8 to 10.** System shows tomorrow's briefing:

> **Tomorrow's priorities — 15 actions**
>
> Respond (next 2 hours):
> - Reply to Sarah at Acme. She asked a specific question about pricing 6 days ago. Suggested reply below.
> - Reply to Tom at Globex. His last email contained an objection you have not addressed.
>
> Follow up (today):
> - Send the case study you promised to Raj at Initech on April 6.
> - Nudge your champion at Massive Dynamic. Silence is 11 days, warmth is cooling.
>
> Prepare (for scheduled meetings):
> - Meeting tomorrow with Weyland. Last 3 emails and 1 call summary attached. Three open questions from last call still unresolved.
>
> Outbound (when you have 30 min):
> - Two investors on your target list published blog posts this week relevant to your pitch. Suggested comments and intros drafted.
> - One grant deadline in 9 days matching your stage and sector.

Each action has a one-line reason. The founder clicks approve on the ones they accept, rejects the ones they don't, and the system logs both as training signal for future briefings. The approved actions are executed (email drafts sent to the founder's drafts folder, reminders scheduled, comment drafts saved).

**This flow is the entire product in v1.** Everything else on the roadmap is a way to make this flow richer, more accurate, or more automated.

---

## 6. Architecture

### 6.1 The cognitive core

Every agentic operation runs on **Claude Managed Agents**, Anthropic's hosted runtime launched April 8, 2026. This is the single most important technology decision in the PRD. Before April 8, a product requiring long-running reliable agent sessions would have needed 3 to 6 months of sandboxing, checkpointing, state management and orchestration infrastructure before writing a single line of agent logic. Now it is an API call.

The daily briefing is a long-running Managed Agents session. It reads the graph, reads recent signals, synthesises, ranks, and outputs the briefing. This session may run for 10 to 45 minutes per founder per day. It is metered at standard Claude token rates plus $0.08 per session-hour.

For founders on higher tiers, we use the **advisor tool pattern** (public beta, announced March 2026): a faster executor model (Sonnet or Haiku) paired with a higher-intelligence advisor (Opus) providing strategic guidance mid-generation. This gives near-Opus quality at fraction-of-Opus cost.

### 6.2 The memory substrate

**Knowledge graph:** Neo4j. Nodes are humans, accounts, deals, interactions, signals, commitments, and lessons. Edges carry provenance (which source introduced this fact) and confidence scores. Every node is timestamped and versioned.

**Semantic vault:** pgvector for embeddings over every email, call transcript, document, and LinkedIn profile the founder has ingested. The vault is queried by the briefing agent when it needs context beyond the graph structure.

**Ownership model:** The graph is org-owned. Each node carries provenance identifying the human who introduced it. On founder departure from a multi-founder company, the departing founder has a defined export right to their own interactions only. This policy is the default; teams can override on a per-node basis during setup.

### 6.3 The ingestion layer

**V1 sources, in order of priority:**
1. Gmail (OAuth, 90-day backfill on signup, continuous sync)
2. Google Calendar
3. Granola (call transcripts)
4. Google Drive (documents tagged by type)

**V1 explicitly defers:** LinkedIn (ingestion), Twitter/X, Slack, WhatsApp, Notion, HubSpot or Salesforce CRMs, Calendly. These are v2 candidates, prioritised by founder request frequency.

Each source has its own extraction pipeline. Email is the foundational pipeline because it alone is sufficient for the warmth map and the first briefing. Other sources enrich but do not gate value.

### 6.4 The user interface

**V1 has three surfaces and no more:**

1. **Today** — the daily briefing. Opens to this by default. Ranked actions, one-click approve, one-click reject.
2. **Graph** — a searchable view of the knowledge graph. Founder can look up any person, account, or deal and see everything the system knows. Read-only in v1.
3. **Settings** — source connections, pricing tier, export, notifications.

That is the entire UI. No dashboards. No analytics pages. No multi-view pivots. Every feature request in v1 gets evaluated against: "does this go into the briefing, or does it go on the roadmap?" Default answer is the roadmap.

---

## 7. Failure modes and design against them

### 7.1 The flood problem

**Risk:** The system surfaces too many signals and the founder stops reading the briefing after week two.

**Design:** The briefing is hard-capped at 15 actions per day. Never more. The ranking agent must cut, not expand. If more than 15 items are candidates, the lower-ranked items are held for tomorrow or dropped entirely. We will measure briefing completion rate (% of actions reviewed) as a primary health metric.

### 7.2 The trust problem

**Risk:** The agent is wrong about something important, the founder loses trust, and abandons the product.

**Design:** Every action in the briefing shows its source evidence. "Reply to Sarah because of this sentence in this email from 6 days ago." The founder can always see *why*. Second, the briefing agent runs on a conservative confidence threshold in v1: it is allowed to miss signals, but it is not allowed to hallucinate them. We would rather the briefing surface 10 correct actions than 15 with 3 hallucinations.

### 7.3 The cold-start problem

**Risk:** Founder signs up with an empty Gmail history or no history at all and the first briefing is useless.

**Design:** Pre-launch intake questionnaire captures the basics (target accounts, current deals, investor target list) so that even a founder with 7 days of email history gets a usable first briefing. For founders with less than 30 days of history, the system shows an explicit "your briefing will sharpen as I read more of your work" message for the first two weeks.

### 7.4 The privacy problem

**Risk:** Founder feels uncomfortable with an agent reading all their email and backs out.

**Design:** Clear disclosure at signup that the system reads email contents and stores derived state in a graph the founder owns. All raw email stays in Gmail. All graph data is encrypted at rest. Founder can wipe the graph at any time from settings. Managed Agents runs on Anthropic infrastructure, which is disclosed up front as a constraint for founders with data residency requirements.

### 7.5 The compounding noise problem

**Risk:** The world around the founder gets noisier every month as more AI agents produce more content. The system must get sharper faster than the environment gets noisier, or it eventually becomes part of the noise it was built to filter.

**Design:** The ranking model is retrained monthly on aggregate approve/reject signal across all users. Founders who approve a type of action train the system to surface more of it; founders who reject train it to surface less. This is the compounding advantage: the product gets sharper as the environment gets noisier, because every rejection is signal about what is now noise.

---

## 8. The moat

Every adjacent product is built on the wrong side of the six loops. Clay, Apollo, Attio, Salesloft, Outreach, Gong — all optimise the action loop. Granola, Fathom, Day.ai — optimise the memory loop in isolation, as note-taking. Cursor, Lovable, v0 — optimise code action.

**Startup Edge is the only product whose thesis is that action is the loop that does not need fixing.** The moat is not technology. Others can copy the stack. The moat is the framing: we are the only product that explicitly refuses to sell more output and instead sells fewer, better outcomes.

Secondary moat: **tight feedback loop with StepUp.One.** Our own services team uses Startup Edge to deliver done-for-you engagements. Every bug is found by our own team before any customer sees it. Every feature request comes from real delivery pain. No adjacent product has this feedback loop because no adjacent product has a sibling services company running on top of its own platform.

Tertiary moat: **the graph compounds per founder.** Every day of use makes the graph richer, which makes the next briefing sharper, which makes the founder more dependent on the product. Switching cost after six months is enormous because the founder would lose six months of context that cannot be replicated elsewhere.

---

## 9. Pricing

### 9.1 Philosophy

Pricing is tiered by **intelligence level**. The founder picks which Claude model their daily briefing runs on, and the price follows. This is novel in SaaS and directly honest about the cost structure.

### 9.2 V1 tiers (indicative, final numbers TBD)

| Tier | Model | Monthly base | Included tokens | Target founder |
|------|-------|--------------|-----------------|----------------|
| Essential | Haiku 4.5 | £150 | 2M input / 500k output | Early pre-seed, light pipeline |
| Core | Sonnet 4.6 | £500 | 2M input / 500k output | Active fundraising or enterprise sales |
| Edge | Opus 4.6 + advisor | £1,800 | 2M input / 500k output | Large enterprise deals, high-stakes fundraising |

Beyond included tokens, metered at standard Claude API rates plus 30% margin plus Managed Agents session runtime at cost. Founders can see their token consumption in real time in settings.

### 9.3 StepUp.One relationship

StepUp.One is the done-for-you sibling company. StepUp delivery engagements run on Startup Edge Edge tier by default; the cost is bundled into the StepUp service price (no separate Startup Edge invoice). This means:

- StepUp clients never see a Startup Edge bill
- The StepUp delivery team is the product's most demanding daily user
- StepUp is the product's first distribution channel: every StepUp engagement is a Startup Edge reference

### 9.4 V2 portfolio and accelerator pricing

Portfolio tier for investors managing 5 to 20 startups: £2,500 to £8,000 per month with a shared cross-portfolio graph. Accelerator tier for batches of 10 to 50 founders: £15,000 to £50,000 per batch with cohort analytics. Both deferred to v2.

---

## 10. Roadmap

### Six months: ship v1

- Core loop: Gmail ingestion, graph, daily briefing, three UI surfaces
- Pricing tiers live
- First 50 paying solo founders
- StepUp.One delivery team using Startup Edge in production for every engagement
- One hardened failure mode measured: briefing completion rate above 70%

### Twelve months: enrich v1

- Additional ingestion sources: LinkedIn, Slack, HubSpot, Calendly
- Reflection loop added as a second UI surface (weekly review)
- 200 paying founders
- First investor pilot (not a formal tier yet, one friendly customer)
- Approve/reject training loop live and improving week over week

### Twenty-four months: v2

- Portfolio and accelerator tiers shipping
- Multi-tenant graph with shared intelligence
- Modelling and decision exposed as optional second and third surfaces for founders who want the detail
- Full six-loop coverage with reflection mature
- 1,000 paying founders across all tiers

---

## 11. Risks

**1. Managed Agents beta stability.** The entire architecture rests on Claude Managed Agents, which is in public beta as of April 8, 2026, six days before this PRD. Pricing may change. APIs may change. SLAs are informal. Mitigation: build an abstraction layer so we can fall back to self-hosted Agent SDK if the economics shift.

**2. Vendor lock-in.** Managed Agents runs exclusively on Anthropic infrastructure. No on-premise option, no multi-cloud. Founders with strict data residency will be excluded from v1. Mitigation: disclose clearly, target non-regulated sectors in v1, revisit in v2 if demand justifies the complexity.

**3. Token cost volatility.** Our margins are exposed to Anthropic's pricing decisions. If Opus pricing jumps or Haiku capabilities plateau, our tier economics get squeezed. Mitigation: the tier structure lets us shift model assignments without repricing the product.

**4. Competitive response.** An incumbent with existing founder distribution (HubSpot, Attio, or a well-funded startup like Clay) could copy the framing in 6 months. Mitigation: speed, the StepUp feedback loop, and owning the "outcomes not outputs" positioning publicly before anyone else claims it.

**5. Founder attention economy.** Founders are saturated with new tools and promises. Even a great product can be ignored because the founder has not yet felt the specific pain we solve. Mitigation: StepUp.One as the entry wedge. Founders experience the value through the done-for-you service first, then graduate to self-serve when they want control and cost savings.

**6. Reflection deferral regret.** Deferring reflection might turn out to be wrong. Founders who use the product for three months may specifically ask for a structured review surface, and v2 might arrive too late. Mitigation: instrument the daily briefing to capture reflection signals passively (which approved actions later paid off, which were ignored), so v2 reflection arrives with pre-loaded intelligence.

---

## 12. Open questions

These are deliberately left open for the founding team to resolve during v1 build.

1. **Briefing delivery time.** Is the briefing generated overnight (ready at 6am local time) or on-demand when the founder opens the app? Overnight is simpler to cost and schedule. On-demand is more flexible but creates a cold-start latency the founder might dislike.
2. **Mobile or web-first in v1.** A founder's morning briefing ritual is probably on phone, but building mobile-first doubles the engineering scope. V1 default is responsive web, mobile-native in v2.
3. **Team mode inside a single startup.** When a founder has a co-founder or early salesperson, do they share one graph or each have their own? Default in v1 is single-user. Team mode is v1.5 if demand is strong.
4. **Language support beyond English.** V1 is English only. Multilingual is v2 or later.

---

## 13. Appendix: related thinking

The six-loops frame, the fitness function, the requisite variety principle, and the tempo-and-coupling layer are drawn from:

- Ronald Fisher, *The Genetical Theory of Natural Selection* (1930)
- Ross Ashby, *Law of Requisite Variety* (1956)
- Stuart Kauffman, *At Home in the Universe* (1995)
- Eric Beinhocker, *The Origin of Wealth* (2006)

These are not decorative citations. The theory behind the product has a hundred-year intellectual lineage in population genetics, cybernetics, and complexity economics. The bet is that this is the first serious attempt to build requisite variety for a solo founder using agentic AI.

---

*End of PRD v0.1*
