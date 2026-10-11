# Browser matrix (resumable, current run)

## Current checkpoint inventory (bookkeeping; no new browser probes here)

Both EN/dark **static-route baselines were attempted, 143/143 requests at each
width**, without implying 143/143 passes or content validation. Latest 390
cells: 99 pass, 29 issue, 10 redirect, 2 loading, 1 navigation timeout,
1 infrastructure failure, 1 preference mismatch. Latest 1440 cells: 52 pass,
80 issue, 11 redirect. Overall 293/3480 cells have a checkpoint (including
seven narrowly sampled cross-theme/dynamic cells); **3187 remain `not_tested`**.
Overall status tally: 157 pass, 109 issue, 21 redirect, 2 loading, 1 timeout,
1 infrastructure failure, 1 preference mismatch, 1 missing-fixture UI
rendering. Redirects, loading, and failures are not route passes. The 17
dynamic templates remain `not_tested` for full template coverage; the known
`/events/ev-demo-day` and missing `/events/__audit_missing__` at 390 EL/light
are just two literal-ID samples. Missing-event UI returned document HTTP 200,
not proof of real backend HTTP 404. Only two `/feed` CSS-viewport/reduced-motion
probes are in the separate `supplemental` list.

**Fixes after checkpoints are annotations, not reclassified passes.**
`matrix.json` attaches `postCheckpointChanges` to 86 1440 EN/dark snapshots
whose axe `target-size` node was the shared SideNav button (78 issue,
8 redirect), after its min-width became 24px. The parent reports a fresh
targeted `/feed` axe result of zero, but the original desktop `/feed` issue
checkpoint and the other 85 affected checkpoints have not been replaced by
same-cell measurements. It similarly flags 22 390 EN/dark issues originally
reported by the weak unnamed-input heuristic after mobile label changes, and the
`/reputation` 390 overflow snapshot (683px) after a layout fix; neither
annotation demonstrates current success. Original measured axe
`svg-img-alt` on `/org/analytics` mobile and `aria-hidden-focus` on desktop
remain independent findings; preview refused connections are separately
recorded. Do not call all 109 issue rows confirmed present-day defects or all
pre-fix rows fixed without route-specific settled retests.

**Five 390 EN/dark cells need priority retry:** `/auth/sso-complete` and
`/matches` (short/loading snapshots), `/notifications` (navigation timeout),
`/profile` (502 chunk infrastructure failure), and `/research` (HTML root
missing the expected `dark` class even though localStorage requested dark;
`preference_mismatch`). Exact read-only validation for the parent when preview
is healthy:

```sh
node scripts/uiux-resumable-audit.mjs --matrix --width=390 --locale=en --theme=dark --limit=5 --retry-incomplete
```

This explicitly revisits only incomplete/infrastructure/preference checkpoints,
preserves prior files under `matrix-history/`, and uses 4.2 seconds of settling
after meaningful content before axe. Confirm `/research` root class/data-theme,
not just localStorage; confirm actual final path and meaningful page content,
not merely HTTP 200. For changed-but-completed cells, **separate targeted**
commands could check only the affected route: `node
scripts/uiux-resumable-audit.mjs --matrix --width=1440 --locale=en
--theme=dark --routes=/feed --retry-failed --limit=1` and the same invocation
at `--width=390 --routes=/reputation`. These would not constitute a full
re-audit; neither was run in this bookkeeping step. Never submit forms or
infer authorization from synthetic demo cookies.

This remains an **incomplete audit**, not WCAG certification, other-role
authorization coverage, real backend CRUD/persistence verification, native
browser zoom, or a complete locale/theme cross-product.

## Historical run notes (counts below are superseded by the current inventory above)

Evidence: `matrix.json` enumerates every static-route × width × locale × palette cell, including `not_tested`; `matrix-evidence/{width}/{locale}/{theme}/{route}.json` holds the individual measured checkpoint. The five named themes are dark, light, alliance, cofounder, minimal; system is enumerated separately. A cell is not covered because another width/theme/locale was tested. `matrix.json` is regenerated after every completed route and is the authoritative live tally; this document describes the method and initial measured findings only.

Run from this repository with the **existing** preview available at `http://localhost:80`:

```sh
node scripts/uiux-resumable-audit.mjs --matrix --width=390 --locale=en --theme=dark --limit=20
node scripts/uiux-resumable-audit.mjs --matrix --width=1440 --locale=en --theme=dark --limit=20
node scripts/uiux-resumable-audit.mjs --matrix --width=390 --locale=el --theme=light --routes=/login,/discover --limit=2
node scripts/uiux-resumable-audit.mjs --matrix --width=320 --locale=el --theme=dark --reflow --motion=reduce --routes=/login,/discover --limit=2
```

`--routes` accepts comma-separated exact static paths or the two explicit dynamic event cases (`/events/ev-demo-day`: literal `PREVIEW_EVENTS` fixture; `/events/__audit_missing__`: deliberately absent). Without it, the runner covers all discovered static routes, **not** dynamic routes. Checkpoints are keyed independently by width, locale, theme and requested route; supplemental reduced-motion checkpoints add `/reduce/`. `--retry-incomplete` revisits loading/navigation failures; `--retry-failed` revisits all non-passes, preserving earlier checkpoint under `matrix-history/`. `--summary-only` regenerates the matrix index from files without preflight or browser navigation. Reflow widths 320/720 CSS pixels simulate viewport reflow, **not native zoom**. `motion=reduce` only verifies that the browser requested reduced motion and records that fact; it does not prove animation conformance. No mutations or forms are submitted.

The browser injects synthetic preview-demo cookies/localStorage and a demo founder object. A cookie and visible admin route are **not** proof of authorization, and admin pages here are only what the demo founder saw. Other roles (admin, investor, mentor, incubator/org, provider, cofounder), credentialed sessions, permissions, reads/writes against live API, creation, editing, deletion, email, persistence, and operations remain **not tested**. Requested routes and final paths are separate; redirects and loading states are not passes. Axe WCAG tags and heuristic control names are reported separately; neither certifies WCAG or real keyboard assistive-tech usability. Console errors are not automatically application defects (preview backend refusals are possible).

Current-run first mobile EN/dark batch (85/143 static checkpoints at the first interruption, **not full coverage**): **initial, unsettled snapshots only** reported `/discover` 31 axe contrast nodes, `/groups` and `/mentor/reviews` `.bg-primary\\/20` 4.43:1, `/help` `.ml-0\\.5` 2.45:1, and `/admin/reports` 2px document overflow. These were not durable confirmations: a separate worker measured `/discover` and `/groups` contrast disappearing after palette transitions settled at 3.5–4.2 seconds; the same worker changed `/help` badge text color and measured 5.33:1, and changed `/admin/reports` wrapping and measured 0 overflow. **Bounded current-run retest:** the runner now waits 4.2 seconds after content readiness before axe; one fresh 390 EN/dark navigation each of `/discover`, `/groups`, `/help`, and `/admin/reports` returned HTTP 200, same path, 0 overflow, 0 axe violations, 0 console errors, 0 heuristic unnamed controls. Old checkpoints remain under `matrix-history/`. `/mentor/reviews` **was not retested**: its earlier contrast remains unconfirmed, potentially transition-related. Do not report the four original issues as currently reproducible. `/admin/audit-log`, `/admin/billing`, `/ai`, `/jobs`, `/learning`, `/members`, `/mentor/profile` had heuristic unnamed controls without axe violations in the initial batch; verify accessible name manually before fixing. `/api-status` logged refused resources; `/builder`, `/builder/applications`, `/builder/pitch-deck` logged refused local-port-3001 WebSockets. `/matches` and `/auth/sso-complete` were inconclusive loading snapshots. `/notifications` navigation timed out; subsequent `/login` preflight returned HTTP 502; no route after that point was measured in the broad batch. Resume only if separately authorized; do not equate `not_tested` with passing.

After preview was restored, the requested **bounded supplemental sample only** was run (10 browser navigations including one retest; no broad sweep repeated):

| Requested case | Observed result |
| --- | --- |
| `/feed`, EN/dark, 320 and 720 CSS px, reduced-motion preference | HTTP 200, same final path, `html.lang=en`, `dark` class, no `data-theme`, `matchMedia('(prefers-reduced-motion: reduce)')=true`; 0 document overflow, 0 axe violations in each snapshot. This is viewport reflow simulation, not native browser zoom; animations were not exercised. |
| `/events/event-mixer`, 390 EL/light — **historical fixture mistake** | HTTP 200, same path, `html.lang=el`, `light` class, no `data-theme`, 93 Greek characters, 0 overflow and 0 axe violations **on the old preview fallback**. This ID appears in search suggestions, **not** the `PREVIEW_EVENTS` event fixtures. Its “Athens Founders Pitch Night” page was a false fallback, not evidence a known-ID lookup works. Legacy checkpoint retained at `matrix-evidence/390/el/light/events__event-mixer.json`, excluded from current matrix cells. |
| `/events/ev-demo-day`, 390 EL/light | **Not tested.** This is the actual known event fixture (`apps/web/src/lib/preview-api.ts`, `PREVIEW_EVENTS`, id `ev-demo-day`); it replaces `event-mixer` in the runner. |
| `/events/__audit_missing__`, 390 EL/light — **historical pre-fix** | Prior HTTP **200**, same path, same heading and text excerpt as the falsely classified `event-mixer` request: **both were missing IDs**, each aliased the first event due to the old `PREVIEW_EVENTS[0]` fallback. A different worker has since changed preview API behavior to `event: null` and added a regression test. This old browser checkpoint is retained as `historical_pre_fix` in `matrix.json`, **not current evidence** of the changed behavior; no new missing-ID browser navigation has occurred after the fix, and no real backend 404 was tested. |
| `/login`, 1440 EL, dark/light/alliance/cofounder/minimal | Five distinct HTTP 200 same-path passes; each `html.lang=el`, 166 Greek characters, no document overflow, 0 axe violations. Root classes / `data-theme`: dark `dark`/none; light `light`/none; alliance `light`/`alliance`; cofounder `dark`/`cofounder`; minimal `light`/`minimal`. This is **one route per palette**, not palette coverage for other routes. |

`matrix.json` now has 17 dynamic route templates in `dynamicTemplates`, each explicitly `not_tested` for complete template/content coverage. Two *missing* individual `/events/[id]` IDs were sampled before the preview fallback fix; **no known dynamic event ID has been browser-tested**. The remaining 16 templates have no sampled fixtures. Founder-only synthetic preview does not test other roles or permissions; `notTestedScopes` explicitly records six other roles and ten operation/authorization/assistive-tech exclusions. The enumerated matrix has **90/3480 non-historical baseline-width cells with earlier browser checkpoints**: 69 passes, 12 issues, 6 redirects, 2 loading, 1 navigation timeout. Another 1 cell is `historical_pre_fix` (old missing fixture result), and **3389** are `not_tested`, including `/events/ev-demo-day`. None of those earlier route snapshots is a blanket validation of later source changes. Four historical first-pass issues were replaced by settled/retest checkpoints, not counted twice. The two reduced-motion/reflow samples are separate `supplemental` rows, not counted among the baseline-width cells. The prior 502 is recorded in `matrix-availability.json`; it was an interruption, not evidence of all remaining pages failing. No desktop EN baseline sweep, system-theme sample, other full-route locale/theme sweep, native zoom, animation behavior, or dynamic template inventory coverage was completed in this bounded continuation. **The requested exhaustive accessibility/appearance audit remains incomplete**: one static width only partially measured in one locale/theme, and over 3000 matrix cells remain unrun.

## Baseline continuation (after known-fixture correction)

The parent subsequently checked `/events/ev-demo-day` and the missing event in the browser at 390 EL/light against its preview fallback fix; the latest `matrix.json` records one known pass and one missing-fixture UI rendering checkpoint. Do not confuse the old `/events/event-mixer` alias with the genuine event fixture. The founder EN/dark 390 static sweep resumed from checkpoints; 15 additional routes (`/onboarding` through `/profile`) were requested in two bounded batches. `/onboarding` redirected to `/profile`; `/org/dashboard` redirected to `/dashboard/incubator` (not requested-route passes). `/org/analytics` has three **serious** axe `svg-img-alt` nodes targeting `path[name="Founders"]`, `path[name="Mentors"]`, `path[name="Investors"]` in the role pie chart at `apps/web/src/app/org/analytics/OrgAnalyticsCharts.tsx:51–61`, mounted at `page.tsx:382`. `/org/applications`, `/org/programs`, `/org/startups` only triggered the weaker unnamed-input heuristic (no axe violations). All these findings are founder-preview render observations, not proof of org authorization.

During `/profile`, dependent chunk requests returned 502 and the browser logged failed dynamic chunks; the raw checkpoint preserves this, but `matrix.json` classifies it `infrastructure_failure`, **not** a page-level UI issue. `/login` preflight then returned 502, so the runner did not touch `/profile/edit` or any later static route. `--retry-incomplete` includes this infrastructure interruption, loading and navigation failures; already completed passes are not rerun. At this pause the matrix tally is 78 passes, 16 issues, 8 redirects, 2 loading, 1 navigation timeout, 1 infrastructure failure, 1 missing-fixture-rendered checkpoint, and **3373 not tested** of 3480 enumerated cells. The post-fix dynamic results supersede the pre-fix explanation above; the older historical paragraph remains provenance for why `event-mixer` was removed. **The two-width baseline remains incomplete**, including all 1440 EN/dark static cells.

Prior `REPORT.md` describes a different 2026-09-26 static-only run (both widths, no requested locale/theme matrix); its 143/143 counts must **not** be added to the current-run measured counts.