# The AI as the platform's control surface — an evidence-based plan

Sixth audit round, and the first written against the **merged** tree: the
design line (`claude/project-audit-upgrade-y2ebnr`) and the AI platform line
(`integration/ai-platform-upgrade`) are now one branch.

The product's stated competitive claim is that its AI runs the platform. This
document measures how far that is true today, names every gap, and sets out
what closing each gap costs and buys. Nothing here is asserted from reading —
every number was counted from the tree or measured in a browser.

---

## 1. What exists, and it is good

The assistant is not a chat widget bolted on the side. It has a real contract,
and the contract is better than most:

**`packages/shared/src/actions/declarations.ts`** — capabilities are declared
once, in a package neither app owns, precisely so the server enforces the same
catalogue it offers a model. The file's own comment says why: *"A tool
catalogue built in the browser and trusted by the API would let a caller name
any function it liked; a second registry written on the server would drift from
the first."* That is the correct architecture.

Each declaration carries:

| field | why it matters |
|---|---|
| `label`, `description` | bilingual, so the assistant can name what it is about to do in the reader's language |
| `params[].description` | the `en` half is what the model sees; both halves are shown to the user |
| `kind`, `writes` | separates "answers a question" from "changes something you own" |
| `reversal` | **verified against the controller, not assumed** |
| `confirmLabel` | the button text for the confirmation step |

The `reversal` field is the standout. `send_connection` declares
`kind: 'none'` with the reason spelled out — the Connections controller
notifies the recipient before the call returns and exposes no withdraw route
for the sender. The assistant therefore tells the user *before* they commit
that this cannot be taken back. Very few products do this.

Around it: an action audit table (`ai-action-audit.service.ts`), a rate-limit
guard, a job queue, a provider registry, a streaming tool-call loop that never
replays a POST, and 46 test files.

**Nothing in this plan replaces any of that.** Every item below extends it.

---

## 2. What the assistant can actually reach — measured

### 2.1 It can name two thirds of the product

| | count |
|---|---|
| Routes with a `page.tsx` | **155** |
| Routes in `PAGE_REGISTRY` | **106** |
| **Routes the assistant cannot name or describe** | **49** |

Among the 49 are `/mentor/*` (6 routes), `/provider/*` (6), `/investor/*` (4),
`/endorsements`, `/coaching`, `/groups/[groupId]`, `/pitch/[id]`,
`/data-room/[id]`, `/research/[boardId]`, `/p/[username]`, `/org/[slug]`.

That is not a cosmetic gap. `navigate` is a declared capability; a route the
registry does not know is a route the assistant cannot offer to take you to,
cannot describe when you ask "what is this page", and cannot reason about when
deciding what to suggest next.

### 2.2 It can see what is on screen on three pages

`PageSnapshotContext` exists exactly to fix the problem its own header
describes: *"handed it `{ route, entity, role, locale }` — a path string… every
suggestion it made was generic to the route rather than to your data."*

| | count |
|---|---|
| Routes that publish a snapshot | **3** (`/readiness`, `/dashboard/founder`, `/analytics`) |
| Routes that do not | **152** |

So on 152 routes the assistant is back to the path string. Ask it "why is this
match ranked first" on `/matches` and it cannot see the list you are looking
at.

### 2.3 It can perform 5% of what the UI can

| | count |
|---|---|
| `useMutation(` call sites in the web app | **140** |
| Declared mutation capabilities | **7** |
| …of which actually write | **5** |

The five writes are: add to shortlist, send a connection request, start or send
a message, tick a readiness criterion, create a workspace. The other two
mutations move the user (`navigate`) or change a view (`analytics_set_period`).

Everything else the product can do — edit a profile, create an event, post to a
group, respond to an intro, publish a pitch deck, book a coaching slot, write
an endorsement, manage a cohort, moderate a report, change a setting — is
outside the assistant's reach.

### 2.4 It can answer four kinds of question

`get_graph`, `search_people`, `get_recommendations`, `get_notifications`. No
read capability covers events, jobs, groups, milestones, the research canvas,
the builder, fundraising, endorsements, the marketplace or anything under
`/admin`.

### Summary

| dimension | covered | total | share |
|---|---|---|---|
| Pages the assistant can name | 106 | 155 | 68% |
| Pages whose content it can see | 3 | 155 | **2%** |
| Writes it can perform | 7 | 140 | **5%** |
| Product areas it can read | 4 | ~20 | 20% |

The architecture is ready for an AI-run platform. The coverage is not.

---

## 3. The plan

Four phases. Each is independently shippable and each ends with something
measurable.

### Phase 1 — Let it see the whole product (cheapest, highest leverage)

**1.1 Close the registry gap.** Add the 49 missing routes to `PAGE_REGISTRY`
with title, description, section, audience and status. Pure data; no runtime
risk. Turns `navigate` from a two-thirds capability into a whole one.

*Gate:* a test that fails when a `page.tsx` exists with no registry entry, so
the gap cannot reopen. This is the same shape as the corner-ladder test: the
registry is data that drifts, and drift should be a failing test rather than a
silent hole.

**1.2 Make the page snapshot the default, not the exception.** Three routes
publish one because publishing is opt-in per page. Invert it: have
`AppShellFrame` publish `{ route, title, section, audience }` from the registry
for every page automatically, and let a page *enrich* that with its own data
(counts, the current list, the selected entity) where it has some.

Every page then has a floor of context; the 3 hand-written snapshots become
enrichment rather than the only source.

*Gate:* assert a non-null snapshot on a sample of routes across sections.

**1.3 Read capabilities for the areas that have none.** One read per area,
following the existing declaration shape: `get_events`, `get_jobs`,
`get_groups`, `get_milestones`, `get_builder_state`, `get_endorsements`. Each
is a thin facade over an API the web app already calls — the work is the
declaration and the executor, not new backend surface.

### Phase 2 — Let it act where acting is safe

The 140 write sites are not all equal. Classify them by the `reversal` field
the contract already has, and ship in that order:

1. **`reversal: 'full'`** — anything the user can undo in one click: save/unsave,
   tick/untick, add/remove from a list, set a preference, change a filter.
   These need a confirmation step but no warning. Roughly 40 of the 140.
2. **`reversal: 'partial'`** — create-then-edit: a draft event, a milestone, a
   canvas node, a builder artifact. Confirm, then offer the edit link in the
   outcome.
3. **`reversal: 'none'`** — sends a notification to another person, spends
   money, or deletes. These stay behind the existing explicit warning, and
   some should stay out of the assistant's reach entirely.

*Rule to hold:* the assistant never acquires a capability the UI does not
already expose to that user, and the executor always goes through the same API
client the UI uses — never a parallel path. The `send_connection` declaration
is the reference implementation.

*Gate:* extend `actionRegistry.test.ts` so every declared mutation has an
executor, a `reversal`, and a `confirmLabel`, and every `reversal: 'none'`
carries a non-empty explanation in both languages.

### Phase 3 — Make the capability surface visible to the user

Today the assistant's reach is discoverable only by asking it. Nothing in the
product tells a user what it can do, and a capability nobody knows about is a
capability nobody uses.

- **A capability index**, generated from `declarations.ts` — one page listing
  what the assistant can read, what it can change, and what cannot be undone.
  It costs nothing to maintain because it is generated from the contract.
- **Per-page affordances driven by the registry.** "Ask AI" is already in the
  header on every page. Make its suggestions come from the page's own snapshot
  and the capabilities that apply to it, rather than from a fixed list.
- **Say what it did.** The audit table exists (`ai-action-audit.service.ts`);
  surface it as a reviewable activity list, so a user can see and verify every
  change the assistant made on their behalf.

### Phase 4 — Coherence between what the two models built

The merge left two idioms in places. None is broken; each is a seam a
contributor has to reconcile:

| seam | today | target |
|---|---|---|
| Modals | Radix `Dialog`/`Sheet` in the primitives, hand-rolled `<div role="dialog">` + `useModalA11y` in ~12 pages | one idiom — the primitive, with `useModalA11y` retired into it |
| Dead chrome | `TopNav.tsx` is referenced by nothing and carries a second `MobileNav` | delete, or wire it |
| Native controls | the AI model picker on `/ai` is the only raw `<select>` in the chrome | the `Select` primitive |
| **Icon-button names** | `Button`'s compile-time guard is gone | restore it — see below |

### The guard worth restoring first

`Button` used to make `aria-label` a **compile error** on the icon-only sizes:
a union type over `IconOnlySize` meant `<Button size="icon">` without a name
did not typecheck. That enforcement is not in the merged `Button`, and the
consequence showed up immediately in this round's axe run — `button-name
(critical) x11` on `/settings`, `x3` on `/mentor/dashboard`, each one an
icon-only button rendered with nothing to announce.

Those specific instances are fixed. The guard is not, and without it the class
comes back: there is no way to notice a nameless icon button except by running
axe on the page that has one. Restoring it is a contained change to one file,
followed by naming whatever call sites it then rejects — which is exactly the
work that should happen, done once, at compile time, rather than route by route
through a browser.

---

## 4. UI/UX findings from the visual audit of the merged tree

Measured and screenshotted at 1440 and 390, light and dark.

**`/ai` — the flagship page, and the weakest layout in the product.**
- Roughly **700px of empty space** between the suggestion chips and the
  composer. The conversation column does not fill its height, so the page reads
  as broken rather than as ready for input.
- Six suggestion chips in a ragged 1/1/2/2 arrangement, with no grouping and no
  signal of which merely answer and which would change something.
- The thread list is empty with a two-line bilingual sentence and a single
  `+ New` affordance.
- The assistant's avatar is a robot emoji, next to a product that has its own
  glyph system (`CfbGlyph`).

**Chrome.**
- `Ask AI…` is truncated at both 1440 and 390, and sits beside a second `Ask`
  button — two controls, one of them clipped.
- The sidebar account row truncates twice: `Acc…` over `·Λογαρια…`.
- `AI preferen…` truncates in the sidebar footer.

**Bilingual density.** Every label renders in both languages on desktop, which
roughly doubles vertical text and is the dominant reason the dashboard reads as
dense. The phone follows "one language per screen" (integration's `d5d332b`)
for page content. The bottom bar is a deliberate, documented exception —
`keepSecondaryOnMobile`, with the reasoning in the source: dropping the
secondary line would make one tab a different height from the others and leave
the bar visibly uneven, and the full label still reaches assistive tech through
`aria-label`. Left alone. The density question on **desktop** is a product
decision for the owner, not a defect: it is a deliberate bilingual product, and
the cost is real and measurable (roughly double the vertical text) but so is
the benefit.

**Card anatomy.** On the founder dashboard, two of four stat cards carry a
trend line and two do not, with no empty state in their place — the row reads
as half-loaded.

---

## 5. Order of work

| # | item | effort | unlocks |
|---|---|---|---|
| 1 | 49 routes into the registry + drift test | S | `navigate` everywhere; page-aware answers |
| 2 | Truncated chrome: `Ask AI…`, `Acc…`, `AI preferen…` | S | three clipped labels in the persistent chrome |
| 3 | `/ai` layout: fill the column, group the chips | S | the flagship page stops looking broken |
| 4 | Snapshot by default from `AppShellFrame` | M | 2% → 100% page context |
| 5 | Six read capabilities for the uncovered areas | M | 20% → ~80% of the product readable |
| 6 | Reversible writes, in `reversal` order | L | 5% → ~35% of the write surface |
| 7 | Capability index + assistant activity log | M | discoverability and trust |
| 8 | One modal idiom; retire dead chrome | M | one codebase, not two |

Items 1–3 are a day's work and move the two most visible numbers.

---

## 6. Progress, measured — item 5 and the half of item 6's loop that was missing

Seventh round, on `integration/ai-platform-upgrade` after the merge. Items 1–4
had already landed (`fbb9d43`, `69a6fc9`); this round took item 5 and found,
while doing it, that the model could never have used a read even if it had
more of them.

### 6.1 A read the model asked for went nowhere

The catalogue is offered, the server validates every call, and a proposed
*write* becomes a card. A proposed *read* was dropped: `actionsFromToolCalls`
correctly makes no card for a question, and nothing else ran it.
`continueAfterToolCall` — written and tested for exactly this — had no caller.
A model that decided it needed the user's milestones got an empty turn.

Now (`copilot-loop.ts`, wired in `useAIChat`): after the stream, the reads the
model asked for — declared reads only, never a write, at most three, skipping
any the keyword planner already ran — go through `runCopilotTurn` with the calls
passed in, so a read answers identically whichever side chose it. Their result
goes back to the model in one follow-up round with **tools off** (no loops) and
**no `conversationId`** (the server would otherwise save the instruction to the
model as something the user said). If the model cannot continue, the read
result itself is shown.

The non-streaming route had the same hole one layer down: `ChatResponse` did
not declare `toolCalls`, so a client that fell back to it discarded every
proposal, writes included.

### 6.2 Eight areas it can now read

`get_events`, `get_milestones`, `get_jobs`, `get_groups`, `get_endorsements`,
`get_opportunities`, `get_mentorship_sessions`, `get_shortlist` — declared in
`packages/shared`, executed in `apps/web/src/lib/copilot-reads.ts`, each a
facade over the client function its own page calls. The web app keys readers by
the new `ReadActionId`, so a read declared and not implemented fails to compile.

| | before | now |
|---|---|---|
| Declared reads | 4 | **12** |
| Product areas the assistant can read | 4 | **12** |
| Model-proposed reads that execute | 0 | **all declared** |

Planner arms exist for all eight, in English and Greek, and the planner tests
pin three collisions found while writing them: "prevent" is not an event,
"mentoring session" is not a people search, "who is on my shortlist" is neither
a save nor a search. Greek stems are compared with accents folded, because
Greek moves the accent — «εκδήλωση» but «εκδηλώσεις» — and an accented key
matched only one of the two.

### 6.3 Replies in the language of the question, in every locale

Verified in the running app: «ποια ορόσημα έχω;» asked with an English
interface was answered in English. A message written in Greek now gets a Greek
reply when the interface is English; any other chosen locale is kept.

The locale audit behind it found that 48 of the engine's 49 older replies
existed only in Greek — a Spanish, French, German, Italian, Portuguese, Chinese
or Japanese reader got the greeting, the workspace summary, every search header
and every intro card in English. `copilotStrings.test.ts` enforced Greek alone,
which is how that stayed invisible. All 98 reply strings (49 older, 49 new)
plus the ten single-word labels the reads pass through `t` are now in all eight
catalogue locales, and the test holds every locale to the same bar, placeholders
included.

### 6.4 What is still open, in order

1. **Reversible writes (item 6).** `shortlist_remove` now pairs with `shortlist_add`
   — same API, same confirmation, undo puts the profile back. Still ~6 of ~140
   mutations; next are other full-reversal list add/remove writes.
2. **Capability index (item 7).** Shipped at `/ai/capabilities`, generated from
   `ACTION_DECLARATIONS`. Linked from the assistant rail, the empty-state, and
   AI settings. The activity log half of item 7 is still open.
3. **Demo data for the showcase areas.** In preview mode `/events`, `/jobs`,
   `/groups` and `/opportunities` fall through to the shim's generic fallback,
   so both the pages and the assistant truthfully report them empty. The
   assistant is consistent with the page; the showcase is thinner than it
   should be.
4. **One modal idiom (item 8).** Still two patterns in the tree.
