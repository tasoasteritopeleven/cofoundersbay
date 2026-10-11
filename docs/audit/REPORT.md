# CoFounderBay static-route browser audit

## Scope and provenance

Audit of the **already running local preview** at `http://localhost:80`, completed
2026-09-26. Route manifest `static-routes.json` was generated from current
`apps/web/src/app/**/page.[jt]sx?` files: **143 unique static routes** after
excluding dynamic segments, parallel slots and route groups. This is not the
older 142-entry sweep list and not the 160-candidate static inventory (which
also includes dynamic pages). Both 390×900 and 1440×900 were navigated for
**143/143 requested static routes each**. No mutation controls were clicked,
form submissions made, or credentialed sign-ins performed. This probe did
not inspect every background network call or establish backend isolation.

The test injects the documented *synthetic preview-demo* session. Requested
role is `existing_founder`; the app's `RoleContext` explicitly fixes preview
demo to `existing_founder` (`src/contexts/RoleContext.tsx`), and the recorded
`cfb_primary_role` cookie was `existing_founder`. The report does **not** claim
that a cookie proves an authorized role. In particular, loading an admin URL
does not test admin authorization or an admin-rendered experience. The
`requestedRole`, `renderedRole`, `renderedRoleCookie`, actual final URL and
source page are in each route's checkpoint. The two earliest mobile records
predate the descriptive rendered-role string and contain only the cookie value.

The sweep uses a separate browser context per route, a fixed synthetic demo
user, HTTP/redirect recording, uncaught `pageerror` and error-console
capture, document horizontal-scroll measurements, a visible-control naming
heuristic, loading detection, and axe WCAG A/AA tags when content settled.
One route's HTTP 200 is **not** proof of its content, operation, authorization,
localization, or accessibility. The naming heuristic does not calculate the
accessible name correctly in all cases; axe findings are stronger evidence.
Automated axe coverage does not establish WCAG conformance, keyboard
operability or screen-reader experience.

| Width | Requests attempted | Same-path rendered without measured issue | Measured issue | Different final URL | Still loading/transient |
| --- | ---: | ---: | ---: | ---: | ---: |
| 390 | 143 | 83 | 51 | 9 | 0 |
| 1440 | 143 | 101 | 31 | 9 | 2 |

All latest navigations had HTTP 200, **but 200 redirects are counted as
redirects, never route passes**. At 390 and 1440, `/`, `/dashboard` and `/demo`
ended at `/dashboard/founder`; `/auth/oauth-callback` ended at `/`, with a
captured React *Maximum update depth exceeded* page/console error. Four
role-specific dashboards (`/investor/dashboard`, `/mentor/dashboard`,
`/org/dashboard`, `/provider/dashboard`) redirected to their respective
`/dashboard/{investor,mentor,incubator,provider}` on the stabilized retest.
`/research/canvas` ended at `/research`. Inspect `results-390.json` and
`results-1440.json` for every requested/actual path. **Do not count those
specialized dashboard requests as verification of their requested pages.**

Axe completed on 143/143 mobile and 140/143 desktop latest snapshots. It
was not run on desktop `/` (loading at the redirect snapshot),
`/auth/sso-complete` (transient confirmation, 17 words), or `/matches`
(persistent visible skeleton). Desktop `/matches` and
`/auth/sso-complete` remained inconclusive after another bounded revisit;
mobile `/matches` instead showed a signed-out prompt in the demo context,
which is a **content/session-state mismatch requiring investigation**, not
proof that matching works. Loading snapshots from earlier attempts were
retested; original copies are under `history/{390,1440}`.

## Actionable baseline findings

These are timestamped **baseline** observations. Other workers may already
have modified app files during/after this sweep; verify current behavior
before claiming an issue remains.

1. **OAuth callback render loop (high):** both widths captured an uncaught
   `Maximum update depth exceeded` and console error on
   `/auth/oauth-callback`, followed by `/`. The effect in
   `src/app/auth/oauth-callback/page.tsx` dispatches `cfb:login` and schedules
   a push to `/` after `getMe()`; inspect the interaction with session,
   preview-demo restoration and redirect effects. A returned 200/redirect
   must not conceal this runtime error.
2. **Mobile horizontal overflow (high):** `/reputation` had **95 px**
   document overflow at 390, versus zero at 1440. Its description-list grid
   and card layout are in `src/app/reputation/page.tsx` around the streak
   section; use element-box instrumentation to locate the exact overflowing
   descendant before changing layout. `/admin/reports` measured **2 px**
   mobile overflow; this small difference should be rechecked across
   scrollbar/rounding conditions before attributing a source cause.
3. **Accessible semantics/names (high):** axe found `definition-list` /
   `dlitem` violations on mobile `/admin/dashboard`; source
   `src/app/admin/dashboard/page.tsx` contains nested status description-list
   structures. Both widths found `definition-list` on `/reputation`: its
   `dl` has a direct `div` containing text and `<time>` with no `dt`/`dd`
   (around line 419). Mobile `/admin/taxonomy` had an unnamed select
   (`select-name`); both widths `/tenant/branding` had **three** color inputs
   without associated accessible labels (`label`). Relevant source:
   `src/app/admin/taxonomy/page.tsx` and the `ColorField` component in
   `src/app/tenant/branding/page.tsx`. Recheck after concurrent fixes.
4. **Contrast (high):** axe found **27 mobile / 31 desktop** contrast nodes
   on `/discover`, including small blue-on-dark badge text at ratios
   **3.71:1** and **3.99:1** (expected 4.5:1). Source surfaces include
   `src/components/discover/ProfileCard.tsx`. Desktop shared sidebar section
   labels measured **3.42:1** on `/profile/edit` and `/tenant/api-keys`;
   desktop `/themes/alliance` Greek secondary title measured **2.56:1**
   on white. These are axe-reported calculated ratios, not a claim that
   every other component meets contrast.
5. **Control targets/labels (medium):** axe reported the login and register
   password-visibility target on mobile as approximately **34.6×20 px** with
   insufficient spacing (`target-size`); `/tenant/api-keys` had two mobile
   target-size violations. The visibility buttons *were* reachable by Tab,
   showed a visible outline and changed the password input to `type=text`
   on Enter in `keyboard.json`; reachable does not imply target-size compliance.
   The naming heuristic also flagged inputs on `/profile/edit` (8 mobile)
   and `/provider/profile` (5 each width); inspect actual label associations
   instead of assuming the heuristic is an axe failure.
6. **Preview-dependent errors (medium):** `/api-status` produced a refused
   resource connection; `/builder`, `/builder/applications` and
   `/builder/pitch-deck` tried a WebSocket on local port 3001 and logged
   failures; `/themes/alliance` logged a 404 resource. These may reflect
   preview services rather than a production regression, but must not be
   reported as clean console passes. No backend functionality or persistence
   was tested.

## Resilience, reproducing and limits

The previous 142-list sweep stopped after 4 attempts, and its managed workflow
log ended at `Compiling /achievements`; then the proxy returned 502.
Historical `memory.events oom_kill=2` alone did not prove the prior cause.
During this audit's first webpack-managed batch, the server vanished,
`/login` returned 502, and the same cgroup's `oom_kill` changed **2→3**;
that is direct evidence of an OOM during this run, not proof of which process
triggered the historical event. The parent restarted the *existing* managed
preview with Turbopack and a 2048 MB Node heap limit. On authorization from
the parent, the audit then restarted only
`artifacts/cofoundersbay-preview: web` between bounded batches of 8–10
new routes. No duplicate Next server was started; oom_kill remained 3
through the subsequent sweep. Dev compilation time is not a performance
benchmark.

From the repository root, with the managed preview **already running**:

```sh
cd cofoundersbay
node scripts/uiux-resumable-audit.mjs --width=390 --limit=8
node scripts/uiux-resumable-audit.mjs --width=1440 --limit=8
# To recheck only loading/navigation-failed checkpoints:
node scripts/uiux-resumable-audit.mjs --width=390 --limit=8 --retry-incomplete
# To recheck one failed route while preserving the old checkpoint in history:
node scripts/uiux-resumable-audit.mjs --width=390 --limit=1 --route=/reputation --retry-failed
node scripts/uiux-keyboard-probe.mjs
```

Browser defaults to the installed `/repl/tools/bin/chromium` wrapper; override
with `--browser=/path/to/browser` if needed. Every invocation regenerates the
route manifest from source and atomically writes individual
`evidence/{width}/{route}.json` checkpoints plus `results-{width}.json`.
Restart batches only through the existing managed workflow. If preflight
fails, the browser is not started and `availability-{width}.json` records
the cause; a stopped/failed route is never silently counted as a pass.
Historical mobile 502 and stalled-preflight evidence are preserved in those
availability files and the earlier UIUX_BROWSER_REVIEW.md.

Static routes only; dynamic IDs/slugs, other roles, realistic auth,
create/edit/delete, API persistence, Greek-language preference, color themes,
zoom/reflow, touch, assistive technology, and all user journeys require
separate testing. A screenshot of the current 390px login rendered a complete
form with no visible layout break; this is a visual spot check, not full-page
coverage.