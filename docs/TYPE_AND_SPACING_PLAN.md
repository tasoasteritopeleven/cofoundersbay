# Type, spacing and occlusion — per screen class

Fourth audit round. Where `docs/RESPONSIVE_UPGRADE_PLAN.md` covered *layout* per
breakpoint — what reflows, what overflows, what is reachable — this one covers
what the layout is made of: **type size, spacing rhythm, and whether anything
covers anything else**.

Companion to `docs/UPGRADE_PLAN_2026.md` (accessibility, security, tokens) and
`docs/RESPONSIVE_UPGRADE_PLAN.md` (breakpoints and shell).

---

## Method

A production build served against a stub API. A browser probe visited 26 routes
at six viewports (320, 390, 744, 1024, 1440, 1920) and read, from the live DOM:

| Signal | How | Why the source can't tell you |
|---|---|---|
| Occlusion | Pairwise box intersection of text leaves and controls, sorted-sweep, excluding layered UI and inline siblings of one paragraph | Two elements can collide only at one width, from a flex row that couldn't shrink |
| Type inventory | Computed `font-size` on every text leaf | A class name doesn't tell you what resolved after the cascade |
| Control size | Computed `font-size` on every `input`/`select`/`textarea` | iOS zoom depends on the resolved value, not the utility |
| Leading | Computed `line-height ÷ font-size` on wrapped text only | Ratio, not the raw value, is what reads |
| Spacing | Computed gap/padding/margin against the 0.125rem grid | — |
| Scale steps | Widest visible `h1`/`h2`/`h3` per viewport | Whether the scale *moves* is only visible by comparing viewports |

Two probe bugs were found and fixed before any conclusion was drawn, and both
had inflated the first numbers:

- The occlusion pass excluded anything inside an `overflow: hidden/clip`
  ancestor. The app shell wraps all content in `overflow-x-clip`, so it was
  comparing ~3 elements per route instead of ~55. Clipped elements are still
  laid out and can still collide; only *scroll* containers make positions
  incomparable.
- Off-scale spacing was tested as "not a multiple of 4px", which flags
  Tailwind's legitimate half-steps (2, 6, 10, 14px). Against the real 0.125rem
  grid, 5112 "violations" became 177, and all 177 were the browser's own
  `<option>` padding.

---

## What the measurement found

### 1. The type scale never moved

| | count |
|---|--:|
| Fixed `text-*` utilities | **5089** |
| Responsive `sm:`/`md:`/`lg:`/`xl:` type utilities | **16** |
| `<h1>` elements | 91 |
| …with any responsive step | **4** |

A page title rendered at the same size on a 320px phone and a 1920px desktop.
51 of them were `text-xl` — 20px — at every width. The shared `PageHeader`,
which draws the title on every page that uses `AppShell`, was `text-lg`: 18px,
fixed, from 320 to 1920.

Size distribution, all routes and viewports:

| px | token | instances | share |
|--:|---|--:|--:|
| 11 | `2xs` | 503 | 10% |
| 12 | `xs` | 1982 | 39% |
| 14 | `sm` | 1835 | 36% |
| 16 | `base` | 190 | 4% |
| 18+ | `lg`…`7xl` | 579 | 11% |

**85% of every string in the product was 14px or smaller, at every screen
size.** No size was off-token — the earlier normalisation pass held — but the
scale had no vertical dimension.

### 2. Form controls sat under the iOS zoom threshold

44 controls across 9 distinct shapes rendered at 12–14px. Mobile Safari zooms
the entire page when a focused control is under 16px, and the user has to pinch
back out. It is a platform rule, not a preference. The `Input`, `Textarea` and
`SelectTrigger` primitives were all `text-sm`, which is where 23 of 26 probed
routes got theirs.

### 3. One real occlusion

`/builder` at 320 and 390px: the tab strip and the header actions were one
`justify-between` row with no `min-w-0` on either side, so the four triggers
could not shrink and ran underneath the buttons.

| viewport | covered | by | occluded |
|---|---|---|--:|
| 320 | "Team" | New Document | **100%** |
| 320 | "Documents" | Invite | 73% |
| 390 | "Readiness" | New Document | 96% |
| 390 | "Team" | Invite | 60% |

A navigation label that is completely invisible is not a styling issue.

### 4. Non-findings, recorded so they are not re-investigated

- **Leading.** 172 elements measured under a 1.35 line-height ratio, but the
  detector counted any box taller than two line-heights — which includes a
  padded single-line button. The genuinely wrapped 12px prose was ~115
  elements, of which the clamped card descriptions were worth relaxing.
- **Control spacing.** Eight pairs of controls sit 2–5px apart. All are
  segmented controls and filter chips, where a hairline gap is the design and
  the pair reads as one control.
- **Line length.** No line ran past 95 characters. A handful measure under
  30 characters, all short labels in narrow columns.
- **Off-scale spacing.** None. The 177 flagged values are the UA stylesheet's
  1px `<option>` padding.

---

## The scale, after

### Type

| Role | < 640 | ≥ 640 | ≥ 1024 | ≥ 1280 | Reference |
|---|--:|--:|--:|--:|---|
| Page title (`h1`) | 20 | 24 | 24 | **30** | iOS Title3 20pt → Title1 28pt |
| Card title (`h3`) | 16 | 18 | 18 | 18 | Material titleMedium 16sp |
| Page description | **16** | 14 | 14 | 14 | iOS Body 17pt on phones |
| Form controls | **16** | 14 | 14 | 14 | Platform requirement below `sm` |
| Secondary / meta | 12 | 12 | 12 | 12 | Material bodySmall 12sp |
| Badge / counter | 11 | 11 | 11 | 11 | Material labelSmall 11sp |

Body text and controls going *down* from 16px to 14px as the screen grows is
deliberate and is how both mobile platforms and desktop web apps are set: a
phone is read at arm's length on a small panel and needs the larger size, while
a desktop can carry more density at a greater viewing distance.

`sm` (640px) is the control threshold because the zoom behaviour is an iPhone
one — the widest iPhone viewport is 430px, and phone landscape tops out under
640px. iPad Safari renders at a desktop-class viewport and does not auto-zoom,
so tablets keep the design's density.

### Spacing rhythm — `PageHeader`

| | < 640 | ≥ 640 | ≥ 1024 |
|---|---|---|---|
| Padding | `px-4 py-3` | `px-5 py-4` | `px-6 py-5` |
| Title ↔ description | 4px | 2px | 2px |
| Title block ↔ actions | 12px, stacked | 16px, inline | 16px, inline |

The header also goes inline at `sm` rather than `lg`: a tablet in portrait was
stacking a title and two buttons it had 676px of room to sit side by side.

---

## Changes

| Where | Change | Reach |
|---|---|--:|
| `layout/AppShell.tsx` `PageHeader` | Title `text-xl sm:text-2xl xl:text-3xl`; description `text-base sm:text-sm`; stepped padding; inline from `sm`; `min-w-0` | every page using `AppShell` |
| 86 page-level `<h1>` | Current size kept as the mobile step, larger steps added above | 86 |
| `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx` | `text-base sm:text-sm` | 3 primitives |
| `app/globals.css` | Base rule: form controls 16px below `sm` | ~38 raw controls that bypass the primitives |
| `ui/card.tsx` `CardTitle` | `text-base sm:text-lg` | every card |
| `builder/BuilderWorkspace.tsx` | Tabs and actions on separate rows below `sm`; `min-w-0` / `shrink-0` | 1 |
| `pitch/[id]/page.tsx` | Slide title `text-3xl sm:text-4xl lg:text-5xl` | 1 |
| 19 clamped 12px descriptions | `leading-relaxed` | 17 files |

The base CSS rule carries `!important` deliberately: a Tailwind text utility on
the element outranks an element selector, and that utility is exactly what is
being corrected. It is scoped to one media query and one element set.

---

## Result

| Signal | Before | After |
|---|--:|--:|
| Occluded content, 320 + 390px | 8 pairs | **0** |
| Occluded content, 744 – 1920px | 0 | **0** |
| Form controls under 16px on phones | 44 | **0** |
| Page titles with a responsive step | 4 / 91 | **91 / 91** |
| Responsive type utilities in the codebase | 16 | **160** |
| Page title at 1920px | 18–20px | **30px** |
| Page description on a phone | 14px | **16px** |
| Horizontal overflow, all 9 viewports | 0 | **0** |
| Unreachable clipped content | 0 | **0** |
| WCAG 2.5.8 target-size failures | 0 | **0** |
| Routes rendering under a partial-payload API | 147 / 147 | **147 / 147** |
| axe WCAG 2 A/AA suite | 66 tests | **70 tests, 0 failing** |

Two of the new tests are regressions for this round: form controls must be at
least 16px on phone viewports, and no laid-out element may occlude another. The
occlusion test excludes layered UI and inline fragments sharing one paragraph —
without that second exclusion it fires on the landing hero, where 72px display
type on `leading-none` gives adjacent line boxes a 20px overlap that no reader
ever sees.

---

## Limits

- Six viewports, 26 routes for the type probe; the crash and layout gates cover
  all 147.
- "Occlusion" is box intersection. Two elements that overlap without either
  hiding anything legible — a decorative rule behind a label — are excluded by
  the layering rule rather than judged.
- The 11px and 12px steps are kept. They are metadata, badges and counters,
  inside Material's 11sp `labelSmall` and iOS's 11pt `caption2`, and WCAG sets
  no minimum font size.
- Reading comfort is asserted through measurable proxies — size, leading,
  measure, target size, occlusion. Whether a screen *feels* right at a glance
  is not something this method claims to have tested.

---

# Addendum — theme contrast and the top of the scale

Fifth round. Two things the earlier rounds did not reach: contrast across
*every* theme rather than the one a page happens to render, and the proportion
between the largest type steps and the small ones that carry the product.

## Thirteen theme contexts, not two

The app ships nine theme blocks — `:root`, `.dark`, `system`, `alliance`,
`cofounder`, and four role palettes. The role palettes are the ones that make
this hard: `RoleTheme` reads `localStorage.user.role` and adds `role-founder`
(or mentor / investor / org) **alongside** `light` or `dark`, so each one has to
work on two grounds. That is 13 real combinations.

axe can only judge the theme in front of it, so a pair that fails under
`[data-theme="alliance"]`, or under `role-mentor` on a light ground, never
appears in the browser suite. `scripts/check-theme-contrast.py` reads
`globals.css` directly, composes each role against both grounds, and checks
every semantic pair. It runs in the e2e suite.

### What it found

| Context | Pair | Ratio | |
|---|---|--:|---|
| `.role-mentor` + light | primary link on card | **1.68** | white-ish cyan on white |
| `.role-investor` + light | primary link on card | 1.68 | |
| `alliance` | label on accent fill | **2.20** | white on `#ff950a` |
| `.role-founder` + light | primary link on card | 2.46 | |
| `.role-org` + light | primary link on card | 2.50 | |
| `system` | label on accent fill | 2.85 | white on `#0da2e7` |
| `.dark` | label on accent fill | 2.99 | white on `#de5ff1` |
| `cofounder` | label on accent fill | 3.04 | white on `#cc66ff` |
| `.role-mentor` | label on accent fill | 1.68 | white on `#2cdddd` |
| `:root`, `alliance` | label on destructive button | 3.78 | white on `#ef4343` |
| `alliance` | muted text on muted fill | 4.14 | |
| `system` | error text on card | 4.33 | |

Two distinct causes:

**`--accent-foreground` was white in every theme** while `--accent` is a
saturated mid-tone in all but the light one. `SelectItem` uses
`focus:bg-accent focus:text-accent-foreground`, so this is reachable on every
select in the product — and on the rich-text toolbar's active state. Each theme
now carries an ink in its own accent hue at 60% saturation, solved for ≥4.6:1.

**The role palettes were tuned for a dark ground only.** `--primary-emphasis`
is a light tint in all four, which is right on `.dark` and unreadable on white.
The role block now carries the light value and `.dark.role-*` restores the dark
one, winning on specificity.

`--destructive` was inherited from shadcn's default `0 84% 60%`, which gives
its own white label 3.78:1. Hue and saturation are untouched; only lightness
moves to 49%, the smallest change that clears the threshold.

**13 contexts × 13 pairs, 0 failures.**

## The top of the type scale, in by 2.5%

Tailwind's defaults run 30 / 36 / 48 / 60 / 72px against a 14px body — 2.14×
up to 5.14× — while 96% of the product's text sits between 11 and 16px. The top
steps read as a jump rather than a progression.

| step | was | now | ratio to body |
|---|--:|--:|--:|
| `3xl` | 30px | **29.25px** | 2.14× → 2.09× |
| `4xl` | 36px | **35.1px** | 2.57× → 2.51× |
| `5xl` | 48px | **46.8px** | 3.43× → 3.34× |
| `6xl` | 60px | **58.5px** | 4.29× → 4.18× |
| `7xl` | 72px | **70.2px** | 5.14× → 5.01× |

Line heights move by the same factor so the leading ratio is unchanged; `5xl`
and up already use a unitless `1`. Nothing below 30px is touched.

### Why the component scale was left alone

The same 2–3% was considered for components and declined on measurement. The
icon scale is 12 / 14 / 16 / 20 / 24 / 32px and the box sizes are Tailwind's
4px grid — `w-32` is 128px, used 126 times. Taking 2.5% off gives 31.2px icons
and 124.8px boxes: off-grid, sub-pixel, and imperceptible. Text renders at
sub-pixel precision and takes fractional rem cleanly; a 4px layout grid does
not. The proportion complaint is real for type, where the range is 6.5×, and
not for icons, where it is 2.7×.

## Functionality

Nothing in this round touches component logic. `onClick`, `onSubmit`, `href`,
`<Button>`, `<Dialog>` and `export` counts are all identical before and after;
the only source file changed is `globals.css`, and only token values within it.
The standing evidence is in `FUNCTIONALITY_PRESERVATION_AUDIT.md`.

## Gates

147/147 routes render under a partial-payload API · 0 overflow · 0 unreachable
clipped content · 0 WCAG 2.5.8 failures · 0 occlusions · 0 phone controls under
16px · **0 theme contrast failures across 13 contexts** · axe 72/72.

---

# Addendum — the `minimal` theme

A sixth theme, reachable from the header's theme menu and from `ThemeSwitcher`.
Every rule is scoped to `[data-theme="minimal"]`, so the other twelve theme
contexts see none of it and no functionality is touched — every control, route
and affordance is still present. What changes is how much visual weight each
one is allowed to spend.

## Palette

Light-first on warm paper, near-monochrome, one calm accent. Solved before it
was written, then re-checked by `scripts/check-theme-contrast.py`:

| pair | ratio |
|---|--:|
| body on page | 15.84 |
| text on card | 16.49 |
| label on primary | 8.00 |
| label on accent | 14.24 |
| muted on muted | 5.51 |
| link on card | 8.82 |
| error on card | 7.83 |
| label on destructive | 6.30 |

`--accent` is deliberately a warm tint rather than a brand colour. That single
choice removes the failure mode that produced eight of the thirteen contrast
bugs in the other themes: a saturated accent fill with a white label.

`--input` is `36 10% 55%` — darker than the decorative `--border` — so a field
edge clears the 3:1 that WCAG 1.4.11 asks of a control boundary. A hairline you
cannot see is not minimal, it is missing.

## The seven decisions

1. **One elevation.** The product stacks border + shadow + fill on nearly every
   block; when everything is a card, nothing is. A card here is white on warm
   paper with a hairline, and shadow is kept for things that genuinely float —
   dialogs, popovers, dropdowns.
2. **The page title is not a box.** `PageHeader` renders as a bordered, shadowed
   card on every page, so each page opens with a container around its own name.
   It becomes a plain heading block with a rule under it.
3. **One filled button per view.** A filled control means "this is the thing to
   do". Secondary and outline variants go quiet so the primary reads first.
4. **Badges outline, not filled.** Dozens of saturated pills is the loudest
   thing in the current UI. They keep their colour as a thin border and coloured
   text, which still encodes state at a glance.
5. **Focus you cannot miss.** 2px ring in the accent at 2px offset, on
   everything focusable. The one place this theme spends contrast freely.
6. **Fewer weights.** 700 and 800 collapse to 600. Hierarchy comes from size,
   space and colour rather than heaviness.
7. **Calm by default.** Decorative gradients, lift-on-hover and bounce/pulse
   animations stand down; transitions that communicate state are kept.

Chrome recedes — sidebar and top bar drop their fills and blur for a flat
ground with hairline separators — and `card-comfortable` grows to 1.75rem
because minimal means uncrowded, not cramped.

## What this theme does not do

It is a CSS layer. It cannot rewrite copy, reorder a page's sections, or split
a dense form into steps — the three things that would do most for
self-explanatoriness. Those are component changes, and they would land in every
theme, which is exactly what was asked not to happen. If the direction here is
right, the next step is to promote individual decisions out of the theme and
into the components, one at a time, with the other themes re-checked each time.

## Page width

`/settings/data-export` capped its own content at `max-w-2xl` (672px) and
`/invite` at `max-w-4xl` (896px), while `#main-content` already centres and
caps at `max-w-screen-2xl` inside the sidebar offset. Both now use the full
content column — measured 1148px at 1440px wide, with no overlap of the nav.

The prose pages (`/terms`, `/privacy`, `/pricing`) keep their caps: a measure
limit is correct typography there, and no line in the product exceeds 95
characters.
