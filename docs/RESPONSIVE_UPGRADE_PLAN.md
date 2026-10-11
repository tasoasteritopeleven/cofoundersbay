# Responsive upgrade plan — per screen class

**Scope.** Every page, component, modal and button in `apps/web`, evaluated at
nine viewports and upgraded per screen class. Companion to
`docs/UPGRADE_PLAN_2026.md`, which covers the accessibility, security and
design-token work this builds on.

**Method.** Nothing here is a code reading. A production build (`next build`,
138 static pages) was served against a stub API, and a Playwright probe loaded
every route at each viewport and recorded, from the live DOM:

| Signal | How it is measured | Why the obvious check misses it |
|---|---|---|
| Horizontal overflow | Every element's rect against the viewport, reporting only the innermost offender and skipping anything inside a scroller, an `overflow:hidden` box or an `<svg>` | `documentElement.scrollWidth` reads clean on every page here — the shell's `overflow-x-clip` absorbs it |
| Unreachable content | `scrollWidth > clientWidth` on any `overflow-x: hidden/clip` box | Content past the fold is silently *gone*, not scrollable, and no overflow metric sees it |
| Target size (WCAG 2.5.8) | Interactive rects under 24×24, **then** a 24px-circle spacing test | Without the spacing exception every inline text link is a false positive |
| Text size | Computed `font-size` on leaf text nodes | — |
| Grid density | Resolved `grid-template-columns` track count | Class strings do not tell you what the browser actually resolved |
| Shell | Live width of `aside[aria-label="Main navigation"]`, presence of the bottom bar, width of `#main-content` | — |

Route rendering was verified separately: all 147 routes (134 static + 13
dynamic) were loaded with a console-error listener against an API that answers
every object endpoint with `{}`, so any unguarded field access surfaces as a
route-error boundary rather than passing unnoticed.

---

## 1. Screen classes

The breakpoints are Tailwind's defaults. The mapping to device classes and to
Material 3's window-size classes:

| Class | Range | Tailwind | Material 3 | Devices | Navigation |
|---|---|---|---|---|---|
| **Phone** | < 640px | base | Compact | iPhone SE 320, iPhone 15 390, 15 Pro Max 430 | Bottom tab bar |
| **Tablet portrait** | 640–1023px | `sm`, `md` | Medium / Expanded | iPad mini 744, iPad Pro 11″ 834 | 68px icon rail |
| **Laptop** | 1024–1279px | `lg` | Expanded | iPad Pro landscape 1024, small laptops | 240px drawer |
| **Desktop** | 1280–1535px | `xl` | Large | 1280, 1440 | 240px drawer |
| **Wide** | ≥ 1536px | `2xl` | Extra-large | 1920 and up | 240px drawer, content capped |

`sm` (640px) is the rail threshold rather than `md` (768px) deliberately: it
covers iPad mini portrait at 744px, and a landscape phone at 640×390 is
height-constrained, where a rail costs nothing vertically and a bottom bar
costs ~60px of 390.

### Measured shell behaviour after the upgrade

| Viewport | Nav width | Bottom bar | `#main-content` |
|---|---|---|---|
| 320 | 0 | yes | 320 |
| 390 | 0 | yes | 390 |
| 430 | 0 | yes | 430 |
| 744 | 68 | no | 676 |
| 834 | 68 | no | 766 |
| 1024 | 240 | no | 784 |
| 1280 | 240 | no | 1040 |
| 1440 | 240 | no | 1200 |
| 1920 | 240 | no | 1536 (capped by `max-w-screen-2xl`) |

---

## 2. What was wrong, per screen class

### Phone (< 640px)

| # | Defect | Evidence | Fix |
|---|---|---|---|
| P1 | Fifth bottom-nav tab off-screen | `justify-around` + `px-4` tabs need ~420px for five labels; the "Profile" tab measured L315–R386 on a 320px screen | Equal `flex-1 min-w-0` tracks, `px-1`, truncating labels |
| P2 | Toast viewport hung off the left edge | `w-full max-w-sm` anchored `right-4` resolves to 320px on a 320px screen → L−16; also collided with the tab bar and chat bubble | Top of screen on phones, inset both sides; bottom-right from `sm` |
| P3 | Cards wider than their grid track | `grid gap-4 sm:grid-cols-2` has no base count, so the implicit column is `auto` (max-content). Marketplace cards measured 326px in a 288px track | `grid-cols-1` base on 251 grids → `minmax(0,1fr)` |
| P4 | Header/action rows could not shrink | Founder dashboard's `shrink-0` badge + button cluster ≈ 236px against 288px of content box | Stack under `sm`, wrap the cluster |
| P5 | Notification rows overflowed | Three channel switches + gaps = 224px of a 288px box, before the label | Label above, switches below, until `sm` |
| P6 | Chat bubble under the tab bar | `bottom-11` = 44px; the bar is ~60px before the safe-area inset | `bottom-24 sm:bottom-11` |
| P7 | Filter/stat rows clipped | Events filter row, groups type chips, jobs stat labels, marketplace and investor card footers — all no-wrap rows | `flex-wrap`, `min-w-0`, `truncate` where a label must yield |

### Tablet portrait (640–1023px)

| # | Defect | Evidence | Fix |
|---|---|---|---|
| T1 | **Treated as a phone** | `SideNav` was `hidden lg:flex`, `MobileBottomNav` was `lg:hidden`. Every tablet in portrait got five bottom tabs and no sidebar — the whole nav tree was unreachable without leaving the page | Rail from `sm`, drawer from `lg` |
| T2 | Wasted horizontal space | 744px with no sidebar gave the content 744px and the same one/two-column layout as a 430px phone | Rail reclaims the chrome; grids step at `sm`/`md` as intended |

The rail's *width* comes from CSS (`w-[68px] lg:w-[240px]`), so it is correct
on the first paint. A `matchMedia` query in `SidebarContext` decides only the
nav's **contents** — labels versus icons — and starts `false`, so the server
render and the first client render are identical and the fix introduces no
hydration mismatch and no layout shift.

### Laptop / desktop / wide (≥ 1024px)

| # | Defect | Evidence | Fix |
|---|---|---|---|
| D1 | **Layout stopped adapting above 1024px** | `xl:` appeared 10 times and `2xl:` 5 times across the codebase, against `sm:` 421 and `lg:` 345. A 1920px desktop rendered the same three columns as a 1024px tablet, at +88% width | `xl:grid-cols-4` on the 55 card grids that already ladder 1 → 2 → 3 |
| D2 | Admin tabs unreachable at every width | `TabsList` was a plain `inline-flex`; `/admin`'s 12 triggers measured 1522px, clipped to 320 on a phone and still to 1200 at 1440px. The last four tabs could not be reached by pointer at any viewport | Scrollable list, `shrink-0` triggers; Radix's roving tabindex scrolls the focused trigger into view for keyboard users |

Two categories were deliberately **not** widened:

- **Page layouts** — a bare `lg:grid-cols-3` with a `col-span-2` child is a
  main-plus-rail layout, not a card grid. Discriminated by the presence of a
  `sm:`/`md:` two-column step, which every real card grid has and no layout
  grid does.
- **Fixed six-item sets** — analytics metrics, investor KPIs. Six cards sit
  3+3 evenly at three columns and 4+2 ragged at four.

---

## 3. Component and primitive changes

| Primitive | Was | Now | Reason |
|---|---|---|---|
| `Switch` | 20×36 track, 16px thumb | 24×44 track, 20px thumb | WCAG 2.5.8 AA floor is 24×24; 29 instances on `/settings/notifications` alone failed |
| `TabsList` | `inline-flex`, no wrap or scroll | `max-w-full overflow-x-auto scrollbar-hide`, `shrink-0` triggers | Silently clipped any tab set wider than its container |
| Toast viewport | `fixed bottom-4 right-4 w-full max-w-sm` | Top-inset on phones, bottom-right from `sm` | Hung off-screen and collided with two other fixed elements |
| `SideNav` | `hidden lg:flex`, JS-driven width | `hidden sm:flex`, `w-[68px] lg:w-[240px]` | Tablet portrait had no sidebar |
| `MobileBottomNav` | `lg:hidden`, `justify-around`, `px-4` tabs | `sm:hidden`, `justify-between`, `flex-1` tabs | Fifth tab off-screen at 320px |
| `AppShell` | `lg:ml-[240px]` / `lg:ml-[68px]` | `sm:ml-[68px] lg:ml-[240px]` | Must match the new rail threshold |
| `<Link><Button>` (131 sites) | Anchor wrapping a button | `<Button asChild><Link>` | Interactive content may not nest; it also made every such target measure as a 17px line box |

---

## 4. Result

Before and after are the **same probe against the same 20 routes at the same
nine viewports** — the baseline was re-measured by building commit `b2b9fdb`
and running the finished probe against it, so the two columns are comparable.

| Metric | Before | After |
|---|---|---|
| Overflowing elements (sum over 9 viewports) | 40 — 20 at 320px, 20 at 390px | **0** |
| Routes with any overflow | 20 of 20 | **0** |
| Route × viewport pairs with unreachable clipped content | 26 | **0** |
| Distinct routes with unreachable content | 10 | **0** |
| WCAG 2.5.8 failures (spacing exception applied) | 5 | **0** |
| Tablet portrait (744, 834) navigation | bottom bar, no sidebar | 68px rail |
| `grid-cols` steps above `lg` | 9 (`xl:` 4, `2xl:` 5) | 63 (`xl:` 58, `2xl:` 5) |
| Grids with no base column count | 251 | **0** |
| Routes rendering under a partial-payload API | 133 / 147 | **147 / 147** |
| axe WCAG 2 A/AA suite | 66 tests | **66 passing, 0 failing** |

Verified on a production build. Numbers are reproducible from `apps/web/e2e/`
plus the probe described in §Method.

A note on an earlier figure: a first pass of the probe counted 208 "overflowing"
elements at 320px. Most were false positives — SVG internals whose bounding box
exceeds the `<svg>` that clips them, Radix's `Progress` indicator parked at a
negative `translateX` inside an `overflow-hidden` track, and content inside
horizontal scrollers, which is reachable by design. The 40 above is the count
after those three classes were excluded, and is the number the "after" column
should be read against.

---

## 5. Text size — measured, deliberately unchanged

145 elements render below 12px. All are the design system's documented 11px
`text-2xs` step, and all are badges, chips, counters and metadata sublabels —
Material's `labelSmall` is 11sp and iOS's `caption2` is 11pt, so the step is
within platform norms. WCAG sets no minimum font size; SC 1.4.4 requires text
to survive 200% zoom, which is covered by an existing test.

The one place the step was wrong has been changed: the sidebar's section
headings ("Overview", "Platform", …) were structural labels, not metadata, and
moved to 12px.

---

## 6. Known limitations

- The nine viewports are CSS-pixel widths with touch emulated below 1024px.
  They do not cover foldables, split-screen multitasking, or browser zoom
  combined with a narrow viewport.
- Grid density figures come from the largest grid on each page, which on some
  routes is a KPI strip rather than the card grid.
- The 11px audit is a measurement, not a judgement about any particular label's
  legibility in context.
- One React hydration mismatch (#418, relative timestamps) remains open and is
  tracked in `docs/UPGRADE_PLAN_2026.md`; it is recoverable and excluded from
  the axe suite by a test that asserts the exclusion is still needed.
