# UI/UX audit — verified first pass

## Continuation — latest status (supersedes first-pass limits below)

The full **static-route navigation sweep is now complete**: 143 source-derived
routes at each of 390px and 1440px, 286 timestamped checkpoints, actual final URLs,
loading/redirect distinctions, console/page errors, overflow and axe observations.
See `audit/REPORT.md`, `audit/results-390.json` and `audit/results-1440.json`.
This is synthetic founder-demo rendering evidence, not all-role authentication,
dynamic-record coverage or create/edit/delete verification.

Baseline classifications: mobile 83 without measured issue, 51 with findings,
9 redirected; desktop 101 without measured issue, 31 with findings, 9 redirected,
2 inconclusive. These are **baseline observations, not current unresolved counts**:
some application fixes occurred during/after the sweep. Latest sweep checkpoints
had no HTTP failures. Redirects were not counted as successful requested pages.

### Corrections and targeted verification

`UIUX_MEASURED_FIXES.md` records the source-backed repairs and targeted rechecks:

- OAuth callback preview-session update loop fixed with regression tests, without
  removing the real-provider callback behavior. Actual provider login remains untested.
- Reputation loading layout no longer overflows at 390px in 12 measured samples.
- Invalid description-list markup corrected in admin overview, reputation and
  shared rail stats; programmatic names added to verified unnamed controls.
- Discovery local contrast corrections; current dark-preview targeted axe checks
  at both widths returned no violations.
- Login/register password toggles measured 50.59×44px on mobile after correction.
- API-key controls resist flex shrinking; code values remain keyboard-scrollable.
- Sidebar section text and Alliance secondary CTA text use readable local colors.
- Targeted axe checks on login/register/API keys at 390px and API keys/profile
  edit/Alliance at 1440px returned no violations in the tested state.
- Matches subsequently settled to four demo matches at both widths; no auth gate
  was bypassed or fixture fabricated to hide earlier transient snapshots.

After the main patch, frontend tests passed: **75 files / 666 tests** and TypeScript.
After the final target/contrast changes, **35 focused navigation tests**, TypeScript
and whitespace checks passed. No second full suite was run after those final changes.
The original backend test result is historical; no new live-backend journey passed.

### Preview reliability

An orphaned old server was stopped. During a subsequent sweep, the cgroup OOM-kill
count increased while the managed server disappeared. The preview now uses the
repository's Turbopack approach and a bounded Node heap. Sequential batches with
managed-workflow restarts completed both widths without another observed OOM.
The heap limit does not cap native compiler memory. This is a development-test
workaround, not proof of production stability or a Core Web Vitals benchmark.

### Still explicitly unverified

- Real auth, CSRF/session expiry, provider callbacks and persistence.
- Six account roles, 22 persona roles and resource membership permissions.
- Dynamic record routes, all mutation states, cross-tenant denials and recovery.
- Every theme, language, screen reader and keyboard journey.
- Backend-dependent WebSocket/resource failures seen in the preview.

`UIUX_BACKEND_COVERAGE_REVIEW.md` maps the required isolated-backend tests and
service boundaries. Do not run bootstrap scripts against an unconfirmed database:
they may push a schema. A confirmed disposable database and test-only integrations
are prerequisites to safely verify real writes. No production data was touched.

The imported source provenance remains the revision below; the hosting workspace
now has its own Git history. Do not infer that its current local branch is the
GitHub target branch. **No push or publish was performed.**

---

Date: 2026-09-26.
Repository: Animus1991/cofoundersbay.
Branch: claude/project-audit-upgrade-y2ebnr.
Source revision: 44f087f98acd171590b111a3e776335c0ab53262.

## Status and scope

This is a completed targeted patch, NOT a completed exhaustive audit or a WCAG
conformance certification. Changes are in the working copy; no GitHub push,
production publish, database migration or production-data write was performed.
The existing Next.js/NestJS application, language conventions, APIs,
authentication and routes are retained. No replacement application was built.

## Basis

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA accordion pattern: https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
- WCAG quick reference: https://www.w3.org/WAI/WCAG22/quickref/

These standards support testable accessibility requirements. They do not prove
conversion, user satisfaction or task efficiency improvements. Those need
representative-user testing and before/after measurements.

## Implemented

- Shared accordion state, trigger/panel association and hidden-panel semantics.
- Composition of existing input descriptions with field hint/error descriptions.
- Visible focus using existing theme tokens and larger toast/rail controls.
- Keyboard focus retention in the desktop page rail.
- Associated labels for billing, password and two-factor inputs.
- Keyboard access to registration password visibility.
- Reset-password validation semantics and accessible admin loading/error feedback.
- Development-origin allowlist support for the Replit preview host only; production
  auth/origin policy is unchanged.

See UIUX_SHARED_REVIEW.md and UIUX_DOMAIN_REVIEW.md for file-specific evidence.
Their statements that checks had not run describe the workers' handoff time;
the subsequent verification below supersedes that status.

## Verification

| Check | Result | Limitation |
| --- | --- | --- |
| Frozen dependency install, scripts disabled | Passed | Does not run every package lifecycle script |
| Shared package build | Passed | Not a production Next.js build |
| Web TypeScript, no incremental output | Passed | Not browser or backend persistence evidence |
| Full frontend Vitest suite | 73 files, 662 tests passed | jsdom/mocks, not live-service E2E |
| Backend tests after Prisma client generation | 17 files, 240 tests passed | Mocked services; no live auth/database proof |
| Targeted changed-component tests | 4 files, 6 tests passed | Included in the full-suite count; not additive |
| Whitespace/conflict check | Passed | Not a semantic code review |
| Representative desktop/mobile browser checks | Nine requested routes at each width observed HTTP 200, with mobile messages requiring retry | Demo/session setup, redirects and actual rendered destinations documented in browser report |
| Full mobile sweep | Incomplete: stopped after 4 of the script's 142 entries | Timeout/502 and server unavailability |
| Screenshots | Desktop login and 390px registration visibly rendered | Not all pages/themes or a contrast audit |

After the sweep failure, the preview workflow was restarted. A fresh 1280×800
login screenshot rendered successfully. This restores the preview, not the
missing route coverage. The exhaustive sweep was not rerun.

Static inventory counted 985 source files, 160 route candidates, 197 boundary
candidates, 3,841 surface candidates and 533 endpoint candidates, with no parse
errors. The inventory itself verifies ZERO interactions. Counts from different
inventories are not interchangeable: page files, route handlers, redirects and
the existing static sweep list have different scopes.

## Dependency/environment changes

The registry rejected pinned Vitest and a protobufjs dependency. Both app test
packages now use Vitest 5.0.2/Vite 7.3.6; PostHog web is updated to 1.434.15.
The manifests and lockfile are synchronized and tests passed. No registry
firewall was bypassed. Existing tldraw/React peer-version warnings remain.

## Remaining acceptance work

1. Stabilize a reproducible full-app test environment and complete the entire
   route/role/state matrix, including actual destinations after redirects.
2. Verify create/edit/delete, errors, retries and persistence against a dedicated
   real backend with appropriate test accounts, not production data.
3. Test keyboard focus order, screen readers, light/dark contrast, zoom/reflow,
   touch targets and reduced-motion preferences throughout the application.
4. Measure performance with a production build; development compilation timings
   must not be presented as Core Web Vitals.
5. Run usability studies for critical founder/mentor/investor/admin journeys.
6. Review dependency upgrade behavior for analytics and test tooling separately
   before deploying.

No claim is made that every feature was runtime-verified, that zero regressions
are possible, or that UI/UX has been maximally optimized.