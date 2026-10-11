# Dynamic route browser sample (independent of static matrix)

The resumable, read-only script `scripts/uiux-dynamic-audit.mjs` inventories all 17
dynamic `page.tsx` templates. `dynamic-index.json` enumerates every sampled
known/missing ID × 390/1440 px × EN/EL × dark/light cell, with separate
checkpoints in `dynamic-evidence/`. This is **not** full template or content
coverage and is not included in `matrix.json`.

At the initial checkpoint (before the targeted source fixes and retest):
**35/160** cells measured; 125 not tested. Eleven rendered
known samples, nine known samples have measured issues, one known sample stayed
loading, seven missing samples rendered distinct but not independently verified
error/empty states, and **seven missing IDs rendered the same heading and
first 500 characters as the corresponding known ID**. The first 8 admin
samples were captured before the optional six-Tab observations were added;
they contain no keyboard observations. An initial preview interruption after
those 8 samples was recorded in `dynamic-availability.json`; subsequent
navigations resumed without losing checkpoints. The screenshot tool separately
showed `/events/ev-demo-day` as "Event not found" without the script's synthetic
demo cookies while the API was unavailable: that is a different session, not a
contradiction of the synthetic-demo event sample.

## Source-confirmed fixture inventory

| Template | Actual source-backed ID / reason blocked |
| --- | --- |
| `/admin/user-detail/[id]` | `user-elena` in `preview-api.ts` `PREVIEW_ADMIN_USERS` |
| `/data-room/[id]` | **Blocked:** no verified persisted data-room ID |
| `/events/[id]` | `ev-demo-day` in `preview-api.ts` `PREVIEW_EVENTS`. `event-mixer` is a search suggestion, **not** this fixture |
| `/groups/[groupId]` | `grp-athens-founders` in `PREVIEW_GROUPS` |
| `/matches/[userId]` | **Blocked:** directory person ID alone does not establish a match-vs detail fixture |
| `/org/[slug]` | **Blocked:** SSR fetch needs a backend; client demo org does not establish a working SSR detail fixture |
| `/org/[slug]/admin` | `aegean-lab` in `demo/org-world.ts` and `demo/org-api.ts` |
| `/org/cohorts/[id]` | `cohort-autumn-2026` in `demo/org-world.ts` |
| `/p/[username]` | **Blocked:** no verified public username detail fixture |
| `/pitch/[id]` | **Blocked:** no verified published pitch deck ID |
| `/profiles/[userId]` | **Blocked:** SSR public profile fetch needs real API; directory ID is not proof |
| `/programs/[id]` | `prog-seed-autumn-2026` in `demo/org-world.ts` |
| `/projects/[projectId]` | `1` in `projects-demo.ts` `DEMO_PROJECTS_SEED` |
| `/research/[boardId]` | `board-gtm` in `preview-api.ts` `kitchenSink().boards` |
| `/share/[token]` | **Blocked:** no verified active share token/password |
| `/startups/[id]` | `deal-harbor` in `preview-api.ts` `PREVIEW_DEALS` |
| `/t/[slug]` | `aegean-lab` in `demo/org-world.ts` and `demo/org-api.ts` |

The seven blocked templates have **zero tested cells**, not coverage by an
invented ID. For each of the ten supported templates the script schedules a
known ID and a deliberately absent `__audit_missing__` ID; an ID's literal
presence in source only establishes the input fixture, not output correctness.

## Measured issues (synthetic preview founder only)

- At **390 EN/dark** and **1440 EL/light**, `/groups/__audit_missing__`,
  `/research/__audit_missing__`, `/startups/__audit_missing__`, and
  `/org/cohorts/__audit_missing__` each render HTTP 200 with the **same h1 and
  same first 500 characters** as their corresponding known fixture. These
  checks demonstrate an aliasing/missing-ID problem in the preview. They do
  not establish real backend access or status codes.
- `/org/__audit_missing__/admin` (390 EN/dark) displays a different named
  organisation ("TechStars SF") rather than a distinct missing state.
  `/t/__audit_missing__` (390 EN/dark) synthesizes an organization page
  named `__audit_missing__`; neither should be interpreted as a valid fixture.
  `/events/__audit_missing__` (390 EL/light and 1440 EL/light), by contrast,
  shows event-not-found text distinct from `ev-demo-day`, though the document
  status is HTTP 200. Admin user, project, and program missing IDs likewise
  render distinct text in their measured samples.
- `/org/aegean-lab/admin` at **390 EN/dark** has **98px document overflow**
  (`documentElement.scrollWidth - clientWidth`); the missing-org admin page
  also has 98px overflow in the same cell. These are viewport measurements,
  not native browser zoom.
- Settled axe `color-contrast`: `/groups/grp-athens-founders` has one node
  `.ml-1\\.5` at **390 EN/dark** and **1440 EL/light**; the missing-ID
  fallback shows the same issue. The group's heuristic unnamed-control
  count is 1 and needs manual accessible-name review.
- Settled axe `link-name`: `/t/aegean-lab` at **390 EN/dark** has one
  `a[href$="aegeanlab.example"]` node (also one heuristic unnamed control).
  Settled axe `target-size`: one `.right-0` node on three 1440px admin-user
  known pages (EN/dark, EN/light, EL/dark), and on sampled 1440 EL/light
  event, group and startup pages. This may be shared chrome, not six
  independent root causes. Admin-user **1440 EL/light** remained loading
  at measurement, not a pass; its axe snapshot is not a rendered-detail check.
- All these findings are scoped to recorded snapshots. No body overflow was
  recorded for the other measured known pages; a zero axe-violation snapshot
  is not a WCAG certificate. Every per-page violation includes its selector,
  impact, and axe failure summary in the checkpoint.

The newer checkpoints contain six *Tab-only* semantic focus observations
(tag/role/accessible-name heuristic/visibility/computed outline); for example
the 390 EL/light event page focused the skip link then named navigation, search,
more tools, language and theme buttons, each with computed `solid` outline.
No activation, workflow keyboard completion, actual screen reader, permissions,
loading recovery, mutation, login, role-switch, tenant isolation or backend
write was tested. The synthetic preview role remains `existing_founder`;
cookie values cannot prove authorization. Non-GET requests are aborted by the
script rather than sent. Theme settling waits five seconds before axe.

## Targeted post-fix browser checkpoint

The parent confirmed the updated preview was running. Exactly **16 new
read-only navigations** were performed (12 at 390 EN/dark, 4 at 1440 EL/light),
not a full sweep. `--retry-measured` replaced earlier checkpoints while saving
their original JSON in `dynamic-history/` (14 older checkpoints; the two 1440
EL/light org-admin cases had never been measured). Thus the earlier tally
above is *historical*, not additive to the current `dynamic-index.json`.
Current tally: 37/160 sampled cells, 123 not tested; 14 rendered known,
7 known issues, 5 low-word-count `loading` classifications, 9 distinct
missing-result classifications and 2 **old, not retested**
`missing_aliases_known` cells (1440 EL/light research and startup).
Do not present those two historical cells as a post-fix failure or success.

Measured before → after, same width/locale/theme and synthetic founder:

| Case | Previous checkpoint | Fresh checkpoint |
| --- | --- | --- |
| 390 EN/dark group missing | Athens Founders aliased | “Group not found” / back link, HTTP 200, different from known; runner calls it `loading` only because this short valid empty state is under its 20-word threshold |
| 390 EN/dark research missing | Go-to-market canvas aliased | no canvas heading, 32 words, distinct empty/error UI, HTTP 200 |
| 390 EN/dark startup missing | Harbor aliased | “Not on your board,” distinct, HTTP 200 |
| 390 EN/dark cohort missing | Autumn cohort aliased | “This cohort could not be loaded…,” distinct, HTTP 200 |
| 390 EN/dark org-admin missing | TechStars SF fabricated; 98px overflow | “Organization not found,” **0px** overflow; short not-found state misclassified `loading` by word-count heuristic |
| 390 EN/dark tenant missing | fake page named `__audit_missing__` | “Organization not found,” distinct, HTTP 200 |
| 390 EN/dark org-admin known | Aegean Venture Lab; 98px overflow | Aegean Venture Lab; **0px** overflow |
| 390 EN/dark tenant known | axe `link-name`, 1 unnamed control | zero axe violations, zero unnamed controls |
| 390 EN/dark group known | axe `color-contrast` `.ml-1\\.5` | zero axe violations; heuristic still marks an unlabelled-by-heuristic textarea (placeholder present) |
| 1440 EL/light group known and missing | missing aliased known; known axe `color-contrast` and `target-size` | missing renders distinct “Η ομάδα δεν βρέθηκε”; both axe snapshots zero violations; known still has one heuristic unnamed textarea; missing short state classified `loading` |
| 1440 EL/light org-admin known and missing | no prior checkpoint | known Aegean Venture Lab, missing “Ο οργανισμός δεν βρέθηκε”; both 0px overflow and zero axe violations; short missing state classified `loading` |

Other known records sampled at 390 EN/dark (research, startup, cohort) still
rendered their source-backed IDs; no measured document overflow or axe
violations in those new snapshots. This is **preview UI behavior**, not proof
of API HTTP 404 or authorization. Browser checks were stopped immediately
after the priority change. Other widths/locales/themes and all unsupported
fixtures remain unverified; no further source or script code changes were made
after the stop request. The runner's `loading` status for very short verified
not-found UIs is a classification limitation: inspect heading/excerpt and
visible alerts in each checkpoint rather than count it as real loading.

Run additional bounded batches with e.g.
`node scripts/uiux-dynamic-audit.mjs --template='/events/[id]' --width=1440 --locale=en --theme=dark --limit=2`.
`--summary-only` regenerates the index without a browser; `--retry-incomplete`
only retries loading/navigation/availability checkpoints, preserving previous
versions in `dynamic-history/`. The preview is checked with bounded retries
between navigations; an unavailable preview is an interruption, **not** a
failure of every pending route.