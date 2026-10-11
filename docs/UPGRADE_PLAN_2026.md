# CoFounderBay — Platform Audit & Upgrade Plan

**Branch audited:** `claude/project-audit-upgrade-y2ebnr` (HEAD `91d6ea3`)
**Scope:** every route, component, modal, dialog, button and global primitive in `apps/web`
**Method:** static inventory of all 147 route files + 182 component files, production build,
design-token grep census, WCAG 2.2 AA checklist, Next.js 15 / React 19 best-practice review.

---

## 0. Baseline

| Signal | Value |
|---|---|
| Routes (`page.tsx`) | 147 |
| Components (`.tsx` under `src/components`) | 182 |
| Client-rendered routes | 140 / 147 (95%) |
| Production build | ✅ passes (`next build`, 136 static pages) |
| Shared first-load JS | 104 kB |
| Heaviest routes | `/research/[boardId]` 368 kB · `/admin` 345 kB · `/readiness` 334 kB · `/tenant/dashboard` 327 kB |
| `loading.tsx` coverage | 41 / 147 segments |
| `error.tsx` coverage | **2 / 147 segments** |
| Pages with any `aria-*` attribute | 11 / 147 |

The platform is feature-complete and compiles cleanly. The gaps are **not** missing features —
they are systemic quality gaps in accessibility, resilience, token discipline and delivery hygiene.

---

## 1. Findings

### 1.1 — Blockers (WCAG / correctness)

| # | Finding | Location | Severity |
|---|---|---|---|
| B1 | `viewport` sets `maximumScale: 1, userScalable: false` — pinch-zoom disabled on every page | `app/layout.tsx` | **WCAG 1.4.4 fail** |
| B2 | `.skip-to-content` CSS exists but is rendered nowhere — no bypass-blocks mechanism despite a persistent sidebar + top bar on every authenticated page | `globals.css` / `AppShell` | **WCAG 2.4.1 fail** |
| B3 | Toasts render with no `aria-live` / `role="status"` — screen readers never announce success, error or validation feedback | `components/ui/toast.tsx` | **WCAG 4.1.3 fail** |
| B4 | Toast close button and most icon-only buttons have no accessible name | app-wide (25 `aria-label`s across 329 files) | **WCAG 4.1.2 fail** |
| B5 | No `prefers-reduced-motion` handling; 15 keyframe animations + `scroll-behavior: smooth` always run | `globals.css`, `tailwind.config.ts` | **WCAG 2.3.3 fail** |
| B6 | `app/not-found.tsx` renders its own `<html>`/`<body>` **inside** the root layout's `<body>` → invalid nested document, ignores theme tokens, hardcodes `#0f172a`/`#22D3EE` | `app/not-found.tsx` | Correctness |
| B7 | No `color-scheme` declared → native scrollbars, date pickers and autofill render light-on-dark in every dark theme | `globals.css` | Visual defect |
| B8 | 4 unsanitised `dangerouslySetInnerHTML` sinks, incl. server-supplied search highlight and user rich text | `search/page.tsx`, `RichTextEditor`, `ResearchCanvas`, `MermaidDiagramNode` | **XSS** |

### 1.2 — Resilience

| # | Finding | Evidence |
|---|---|---|
| R1 | 145 of 147 route segments have **no `error.tsx`** — any render/data error unmounts to the global boundary and loses the shell | `find app -name error.tsx` → 2 |
| R2 | 106 route segments have no `loading.tsx` — navigation shows a blank frame instead of a skeleton | 41 present |
| R3 | 19 destructive/validation flows use native `alert()` / `confirm()` — unstyled, unthemed, blocking, untestable, invisible to the toast system | admin ×6, tenant ×3, research ×2, milestones, profile edit ×4, messages |
| R4 | 14 hand-rolled `fixed inset-0` modals bypass Radix — no focus trap, no Escape, no scroll lock, no `role="dialog"`, no restore-focus | `matches`, `milestones`, `recommendations`, `admin/tenants`, `admin/sso`, `admin/automations`, `research/[boardId]`, `QuickActions`, `RoleSwitcher`, `UnifiedChatPopup`, `ResearchCanvas`, `WriteEndorsementModal`, `ExperimentationPanel`, `CollaboratorsBar` |
| R5 | `Dialog` primitive has no close affordance, no `max-height`, no overflow scroll → long dialogs are unclosable-by-mouse and overflow the viewport | `components/ui/dialog.tsx` |
| R6 | `Tooltip` is not portalled → clipped inside every `overflow-hidden` card | `components/ui/tooltip.tsx` |

### 1.3 — Design-system discipline

| # | Finding | Count |
|---|---|---|
| D1 | Arbitrary type sizes `text-[9px]`…`text-[13px]` instead of scale tokens | **548** |
| D2 | `h-3 w-3` / `h-3.5 w-3.5` icons outside the documented `icon-*` scale | **948** |
| D3 | Hardcoded hex colors in TSX (chart palettes, gradients, status dots) | **490** |
| D4 | Raw Tailwind greys (`bg-slate-*`, `bg-gray-*`, `bg-zinc-*`) instead of semantic tokens | 94 |
| D5 | `Button` has no `loading` state → every async action re-clickable, no `aria-busy` | primitive |
| D6 | `Input`/`Textarea`/`Select` have no invalid state and no `aria-invalid` wiring; no `FormField` primitive → label/description/error association is ad-hoc across 62 inputs | primitive |
| D7 | `Skeleton` is not `aria-hidden` → screen readers read placeholder boxes | primitive |
| D8 | `bg-hero-radial` and `shadow-glow` are each defined **twice** (globals.css utility + tailwind theme) with different values | config drift |
| D9 | `--font-inter` / `--font-sora` / `--font-space-grotesk` are declared but **no font is ever loaded** — the entire product renders in `system-ui` | `globals.css` |

### 1.4 — Delivery, SEO, security

| # | Finding |
|---|---|
| S1 | No `Content-Security-Policy`, no `Permissions-Policy`, no `Cross-Origin-Opener-Policy` |
| S2 | `X-XSS-Protection: 1; mode=block` is deprecated and reintroduces XSS vectors in old browsers |
| S3 | `Referrer-Policy: origin-when-cross-origin` leaks origin cross-site; `strict-origin-when-cross-origin` is the standard |
| S4 | No `metadataBase` → all OG/Twitter image URLs resolve relative and break when shared |
| S5 | `openGraph` has no `title`, `description` or image; no `twitter` card at all |
| S6 | No `robots.ts`, no `sitemap.ts` — the public surface (`/`, `/pricing`, `/p/*`, `/t/*`, `/terms`, `/privacy`) is uncrawlable by design |
| S7 | Middleware whitelists `/verify-email` (route is `/auth/verify-email`) and blanket-allows the `/events/` prefix, exposing `/events/create` |
| S8 | 27 `<img>` tags bypass `next/image` (no AVIF/WebP, no sizing, CLS) |

---

## 2. Upgrade plan

Ordered by leverage: every item in Phase 1–3 changes **one file and fixes every page at once**.

### Phase 1 — Global foundation (touches all 147 routes)
1. **Viewport** — remove `maximumScale`/`userScalable`; add `viewportFit: 'cover'`.
2. **Skip link** — render `<a class="skip-to-content" href="#main-content">` as the first focusable node; `AppShell` already exposes `#main-content`.
3. **Reduced motion** — global `@media (prefers-reduced-motion: reduce)` neutralising animations, transitions and smooth scroll.
4. **`color-scheme`** — `light` on `:root`, `dark` on `.dark` / `[data-theme=cofounder]` / `[data-theme=system]`.
5. **Typography** — load Inter + Space Grotesk via `next/font` (self-hosted, `display: swap`, zero layout shift) and bind the existing CSS variables.
6. **Token additions** — `text-2xs` (11px) and `.icon-xs` (12px) so the 1 496 arbitrary values have legitimate targets.
7. **De-duplicate** `bg-hero-radial` / `shadow-glow`.
8. **`not-found.tsx`** — rebuild on design tokens inside the root layout; add a themed, useful 404 with primary navigation.

### Phase 2 — Primitive upgrades (touches every button, modal and form)
9. **`Button`** — `loading` prop (spinner + `aria-busy` + `disabled`), `fullWidth`, `iconOnly` variant that requires `aria-label` at the type level.
10. **`Dialog`** — built-in close button with `sr-only` label, `size` variants (`sm|md|lg|xl|full`), `max-h-[85dvh]` + internal scroll, enter/exit animation, sticky header/footer.
11. **`ConfirmDialog` + `useConfirm()`** — promise-based replacement for all 19 `alert()`/`confirm()` sites, with `destructive` intent styling.
12. **`Toast`** — portal region gets `role="region" aria-live="polite" aria-label="Notifications"`, errors get `aria-live="assertive"`; labelled close button; pause-on-hover; max-stack of 4; memoised context value; monotonic ids.
13. **`Input` / `Textarea` / `Select`** — `invalid` prop → `aria-invalid` + destructive ring.
14. **`FormField`** — one primitive that wires `label ↔ control ↔ description ↔ error` with generated ids and `aria-describedby`.
15. **`Tooltip`** — `TooltipPortal` + fade/zoom animation + `TooltipProvider` defaults.
16. **`Skeleton`** — `aria-hidden` + `role="presentation"`.
17. **`Progress`** — `aria-label` passthrough and indeterminate variant.

### Phase 3 — Resilience across all segments
18. **`RouteError`** shared component + `error.tsx` in every top-level segment group (admin, tenant, org, investor, mentor, provider, dashboard, research, settings, matches, profile, groups, projects, milestones, builder, data-room, pitch, feed, messages, …).
19. **`loading.tsx`** for the remaining high-traffic segments using the existing `PageSkeletons`.
20. **Modal migration** — replace the 14 hand-rolled overlays with `Dialog`/`Sheet`.

### Phase 4 — Security, SEO, delivery
21. **Headers** — CSP, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Permitted-Cross-Domain-Policies`; drop `X-XSS-Protection`; tighten `Referrer-Policy`.
22. **Sanitisation** — escape/sanitise all four `dangerouslySetInnerHTML` sinks.
23. **Metadata** — `metadataBase`, full OG + Twitter cards, `robots`, per-route metadata for the public surface.
24. **`robots.ts` + `sitemap.ts`.**
25. **Middleware** — fix `/auth/verify-email`, stop leaking `/events/create`, add `/demo`, `/help`, `/api-status`, `/themes/*` to the public set.

### Phase 5 — Token normalisation (mechanical, verified by build)
26. `h-3 w-3` → `icon-xs`, `h-3.5 w-3.5` → `icon-xs`, `h-4 w-4` → `icon-sm` in page/component markup.
27. `text-[9px]/[10px]/[11px]` → `text-2xs`, `text-[12px]` → `text-xs`, `text-[13px]` → `text-sm`.
28. Chart hex palettes → a single exported `chartPalette` bound to CSS variables so every chart re-themes with the product.

### Phase 6 — Deployment
29. `@opennextjs/cloudflare` adapter + `wrangler.jsonc` + `open-next.config.ts`, a `deploy:cf` script and a GitHub Actions workflow, so the app ships to Cloudflare Workers with one command.

---

## 3. Status — all six phases landed

| Phase | State | Commit |
|---|---|---|
| 1 — Global foundation | ✅ | `819b4a1` |
| 2 — Primitive upgrades | ✅ | `7721bc0` |
| 3a — alert/confirm removal | ✅ | `9f91a79` |
| 4 — Security, SEO, delivery | ✅ | `6a9e740` |
| 3b — Error/loading boundaries | ✅ | `5e31c12` |
| 5a — Token normalisation | ✅ | `d68caf5` |
| 5b — Chart palette | ✅ | `b906dc0` |
| 3c — Modal & overlay a11y | ✅ | `5d6d50f` |
| 6 — Cloudflare deployment | ✅ | `440c2eb` |

### Before / after

| Metric | Before | After |
|---|---|---|
| WCAG blockers (zoom lock, no skip link, silent toasts, unnamed icon buttons, no reduced motion) | 5 | 0 |
| Icon-only buttons with an accessible name | 0 / 175 | **175 / 175** (enforced by the type system) |
| Decorative icons hidden from assistive tech | 0 | 3 126 |
| Route segments with an error boundary | 2 / 147 | **64 / 64 segments**, covering all 147 routes |
| Route segments with a loading skeleton | 41 | **64 / 64** |
| Overlays with focus trap + Escape + scroll lock | Radix only (47) | **all 61** |
| Native `alert()` / `confirm()` | 19 | 0 |
| Arbitrary `text-[Npx]` sizes | 548 | 0 |
| Off-scale icon dimensions | 1 496 | 1 769 rewritten to tokens |
| Unsanitised HTML sinks | 4 | 0 |
| Security headers | 6 (one deprecated) | 10, incl. CSP + Permissions-Policy |
| Pages with metadata | 1 | 9 segments + a complete root (OG, Twitter, robots, canonical) |
| `robots.txt` / `sitemap.xml` | none | both generated |
| Web fonts actually loaded | 0 (declared but never fetched) | 2, self-hosted with fallback metrics |
| Distinct chart palettes | 4 unvalidated | 1, CVD- and contrast-validated in both modes |
| Production build | ✅ | ✅ (138 static pages, typecheck clean) |

### Deliberately not changed, and why

- **Research-canvas node and shape colours** (~200 hex values) are a
  user-selectable sticky-note palette, not theme drift. Re-theming them would
  remove a feature.
- **Badge rarity tiers** are an ordinal domain ramp with fixed meaning across
  the gamification surface, not a chart series.
- **The 28 `<img>` tags** render user- and tenant-supplied URLs from arbitrary
  hosts, which `next/image` rejects unless every host is enumerated in
  `remotePatterns`. They instead gained lazy loading, async decoding, a
  no-referrer policy and explicit dimensions — which is what actually removes
  their layout shift. Moving to `next/image` needs an image proxy first.

---

## 4. Follow-up round (also landed)

| Item | State | Commit |
|---|---|---|
| axe-core suite in CI + the 9 violations it found | ✅ | `f02f81d` |
| AppShell hoisted into segment layouts | ✅ | `029642e`, `7c9c97d` |
| `any` annotations replaced with real types | ✅ | `fea0b5b` |
| CSP could silently block all API calls | ✅ | `87d78b7` |

### What the test suite caught that review had not

Adding `apps/web/e2e/a11y.spec.ts` was worth more than the fixes in it. On its
first run it failed with nine real defects, including two the whole audit had
missed:

- **`--primary` could not do both jobs.** White on it was 4.38:1 and the same
  token used as link text was 3.93:1 on a card — tuning it for one broke the
  other. Split into `--primary` (interactive surface) and `--primary-emphasis`
  (text on a surface), computed and verified per theme. **The `system` theme's
  primary was failing at 2.86:1**, which nobody had noticed.
- **The `alliance` brand orange cannot carry white text at any usable
  lightness** (2.20:1). Its `--primary-foreground` is now dark rather than the
  hue being shifted off-brand.
- The four footer social links had no accessible text at all.
- The plan comparison table was a scroll container with no keyboard access —
  on a phone it is the only way to read the comparison.

Loading the built Worker in a browser likewise caught a defect in this branch's
own CSP: an unset `NEXT_PUBLIC_API_URL` collapsed `connect-src` to `'self'`, so
a deploy that forgot the variable would have shipped an app that renders
perfectly and does nothing. It now warns at build time.

### Shell persistence, verified

Tagging the live `<aside>` and `<main>` nodes and then navigating
`/investor/pipeline → /investor/scouting` client-side finds both tags still on
the same DOM nodes. The chrome genuinely stops remounting; 44 segments were
converted, three (`admin` handled separately, `dashboard`, `research`) were
excluded because a page in them is full-bleed by design.

---

## 5. Third round — closing the caveats

The three items left open above are now done, and closing them surfaced two
crash-class bugs that no amount of code reading had found.

| Item | State | Commit |
|---|---|---|
| Mock API fixture + the app-wide crash it exposed | ✅ | `1a309c6` |
| Admin section visually verified | ✅ | `1a309c6` |
| axe suite extended to the authenticated app | ✅ | `b7eb266` |
| Responsive (mobile) naming defects | ✅ | `5c1fa95` |
| Second `any` pass | ✅ | `f94ec30` |

### The two bugs that only a running app could reveal

**Every authenticated page could be blanked by one malformed response.**
`useAIChat` did `setAgents(agentsData.agents)`. Its `.catch(() => ({ agents: [] }))`
covers a *rejection*, not a 200 whose body lacks `agents` — that put `undefined`
into state, and `UnifiedChatPopup` calls `agents.find(...)` unguarded. Because
that popup is mounted globally from the root layout, the throw escaped every
route boundary and hit the global error boundary. An older API build, a partial
rollout or a proxy interstitial would have taken down the whole product. Found
by pointing the new fixture at the app and watching `/admin`, `/discover` and
`/settings` all go white.

**`/milestones` crashed on a partial summary.** `SummaryBar` guarded `!summary`
but not a summary without `counts`, then read `summary.counts.in_progress`.

### Defect classes the tests found that review had not

- **Responsive naming.** A control whose only label is `hidden sm:inline` has no
  accessible name below that breakpoint — the icon beside it is `aria-hidden`.
  Twelve of these, plus four "back" links that wrapped a button which was itself
  `hidden sm:flex`, leaving a focusable `<a>` with no content at all on a phone.
  A desktop-only scan passes every one of them.
- **Surface-vs-text token conflicts**, twice. `--primary` cleared the card and
  page backgrounds but not a `bg-primary/20` tint (4.20:1) — which is what the
  active nav item and 69 chips use. `--destructive` had the same problem as
  text (2.95:1). Both now have an `-emphasis` counterpart.
- **671 raw Tailwind `-600/-700/-800` steps used as text.** Chosen against a
  light surface; the product renders dark by default. The corrective pass then
  reverted 103 of them, because on a *fixed* light background (`bg-X-50/100`)
  the dark-mode text drops to 1.66:1 — the codemod had to learn that
  distinction.
- **50 `toLocaleDateString()` calls with no locale**, resolving against Node's
  default on the server and the browser's on the client.

### Known, tracked, not fixed

React **#418** (a text-content hydration mismatch) still occurs intermittently
on pages that render relative timestamps: the server formats "2 minutes ago" at
render time and the client re-formats at hydration time, and when the clock
crosses a boundary between those instants the text differs. It is recoverable —
the page is correct after the client re-render — so it costs a re-render and a
flash, not correctness. Locale, timezone, `localStorage` and theme were each
ruled out by bisecting the browser context.

Fixing it properly means routing all ~50 relative-time renders through one
component that emits a stable value on the server and upgrades after mount.
`e2e/authenticated-a11y.spec.ts` excludes hydration from its "no uncaught
errors" gate with that explanation, and a dedicated test **asserts the bug still
exists** — so the day it is fixed, that test fails and forces the exclusion to
be deleted with it.

### Still open

1. The relative-time hydration fix described above.
2. An image proxy, so avatars and tenant logos can go through `next/image`.
   They come from arbitrary tenant-supplied hosts, which `remotePatterns`
   cannot enumerate.
3. The remaining 56 `any` occurrences — mostly enum-narrowing casts on values
   that arrive as plain strings, third-party SDK refs (tldraw, Daily) and JSON
   metadata bags with no schema to narrow to.
4. `AdminGuard` gates the admin UI on `localStorage.user.role` alone. The API
   is the real boundary, but any signed-in user can currently render the admin
   shell. The middleware already reads a `cfb_primary_role` cookie for
   dashboard routing and could gate `/admin` on it — not done here because the
   cookie is not guaranteed present and getting it wrong locks admins out.
