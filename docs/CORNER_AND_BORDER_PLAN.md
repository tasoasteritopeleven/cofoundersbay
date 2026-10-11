# Corners and borders — one radius ladder, one curvature, one border strength

Fifth audit round. `docs/RESPONSIVE_UPGRADE_PLAN.md` covered layout per
breakpoint, `docs/TYPE_AND_SPACING_PLAN.md` covered what the layout is made of.
This one covers the **edges**: every `border-radius`, every `border`, and the
elevation that sits on top of them.

Companion to `docs/UPGRADE_PLAN_2026.md` (accessibility, security, tokens).

---

## Method

A production build served against a stub API. A browser probe visited **all 134
routes** at 1440×900 and read, from the live DOM, for every visible element:

| Signal | Read from | Why the source can't tell you |
|---|---|---|
| Radius | Computed `border-radius`, all four corners | `rounded-xl` resolved to 12px or 9.84px depending on whether the root scale applied — the class name doesn't say |
| Border | Computed width, style and colour per side | `border-border/60` is a token times an alpha times whatever is behind it |
| Border legibility | Contrast of the composited edge against the surface on *each* side | A hairline can be painted and still be invisible |
| Elevation | Computed `box-shadow` alongside the border and fill | Whether three devices are separating the same box |
| Nesting | Child radius vs parent radius, and whether the child is inset | An inner corner only bulges when the child is inset |
| Clamping | Radius vs half the element's short side | A radius past the clamp stops meaning what the class says |

**10,260 elements** carried a radius or a border. That census, not a grep over
class names, is what the rest of this document is based on.

---

## What the census found

### 1. The radius scale was two scales wedged together

`--radius: 8px` drove `rounded-lg/md/sm` through `calc()`, in **px**.
`rounded`, `rounded-xl`, `rounded-2xl` and `rounded-3xl` came from Tailwind's
defaults, in **rem** — so the 82% desktop root from the type round shrank half
the scale and left the other half alone. On desktop the product drew:

| resolved | elements | share | from |
|---|---|---|---|
| 8px | 2,831 | 27.6% | `rounded-lg` (px) |
| pill | 2,588 | 25.2% | `rounded-full` |
| 6px | 2,395 | 23.3% | `rounded-md` (px) |
| 9.84px | 1,180 | 11.5% | `rounded-xl` (rem × 0.82) |
| 0 | 923 | 9.0% | dividers |
| 2px | 262 | 2.6% | heat-map cells |
| 3.28px | 60 | 0.6% | `rounded` (rem × 0.82) |
| 13.12px | 17 | 0.2% | `rounded-2xl` (rem × 0.82) |
| 4px | 4 | — | `rounded-sm` (px) |

Six distinct steps inside a 10px span. Adjacent components differed by 2px —
too little to read as a decision, enough to read as an accident. **291 parent
elements had children that disagreed about their corner**, most often 6-vs-10
and pill-vs-6. And nothing was actually soft: 89% of every rounded element in
the product sat at 9.84px or below, and the largest non-pill corner anywhere
appeared 17 times out of 10,260.

### 2. Borders were painted but not visible

Every theme put its `--border` between **1.27 and 1.41:1** against its own card.
The codebase reaches for `border-border/60`, `/50` and `/40` constantly, which
drops those to **1.10–1.23:1** — below what a 1px line resolves to on a typical
display. **1,407 borders were invisible on both sides.** That is why the product
had taken to stacking a border, a fill *and* a shadow on the same box to make an
edge read at all: **641 cards carried all three**, plus 128 avatars and 128 icon
circles.

Two of those shadows were literally a second border:

- `--shadow-glow: 0 0 0 1px hsl(var(--border))` — on the `outline` button
  variant, which already declares `border border-border`. Two hairlines painted
  at the same coordinates, on every outline button in the product.
- `--shadow-card: …, 0 0 0 1px hsl(var(--border) / 0.7)` — same, for the
  tooltip, the dropdown, `EmptyState` and the landing feature cards.

### 3. Sharp corners were almost never the problem

923 elements had a border and no radius, which sounds alarming until you split
them by how many sides are drawn: **912 were single-side divider rules**
(`border-b` on a table row, `border-r` on the sidebar) where a radius would be
meaningless. Only **6** were genuinely sharp boxes.

---

## What changed

### The ladder

One geometric scale, all of it in px so a corner is the same curve at every
viewport, stepping by ~1.35× — the smallest ratio at which two radii read as a
decision rather than a rounding error. Each step names a component family, and
Tailwind's whole `borderRadius` key is replaced rather than patched, so every
existing class moves with it and **no call site had to change to get the
softer corner**:

| token | px | utility | family |
|---|---|---|---|
| `--radius-xs` | 5 | `rounded-sm` | checkbox, tiny indicators |
| `--radius-sm` | 7 | `rounded` | chips, anything under ~24px |
| `--radius-md` | 10 | `rounded-md` | button, input, select, menu item |
| `--radius-lg` | 13 | `rounded-lg` | list row, small panel, tab list |
| `--radius-xl` | 18 | `rounded-xl` | card, dialog, popover, page section |
| `--radius-2xl` | 24 | `rounded-2xl` | sheet, hero block |
| `--radius-3xl` | 32 | `rounded-3xl` | marketing surface |

`--radius` is kept as an alias of `--radius-md`, for the handful of rules that
read it directly.

### The curvature

`border-radius` draws a circular arc, which meets the straight edge at a
**curvature discontinuity** — the corner visibly "starts" at a point. That break
is what makes a rounded rectangle read as stamped rather than moulded, and it is
the reason the corners looked mechanical at any radius. A superellipse has no
such break:

```css
@supports (corner-shape: squircle) {
  *, *::before, *::after { corner-shape: squircle; }
  [class*='rounded-full'], … { corner-shape: round; }
}
```

Three things make this safe:

- **It degrades to today's rendering.** Browsers that do not implement
  `corner-shape` keep the circular arc at the same (now larger) radius.
- **It costs nothing where there is no corner.** The universal selector is a
  no-op on the ~90% of elements with radius 0.
- **Pills are excluded, for a rendering reason rather than a taste one.**
  `rounded-full` is `9999px`, hundreds of times past the clamp, and a
  superellipse that far past the clamp degrades into a rounded *rectangle* — it
  would turn every avatar, badge and switch into a squarish blob. Radii that
  merely graze the clamp (a 13px corner on a 24px chip) render as a clean
  squircle capsule and are left in.

Measured on a live page: 82 elements squircled, 31 pills round, **0 pills
wrongly squircled**.

### Radius keyed to size, not to whichever class someone typed

A single `rounded-md` across eight button sizes made a 28px button look rounder
than a 48px one at the same number. Radius now tracks height, holding every
button in a **0.25–0.33 radius/height band**: `xs` → 7, `sm`/`md`/`icon` → 10,
`lg`/`xl` → 13.

The same rule was applied to square icon tiles by codemod — **193 of them across
101 files** — mapping each `h-N w-N` pair to the step that keeps it in a
0.30–0.39 band. This is what stops a class from lying: before, an `h-8 w-8`
tile at `rounded-lg` and one at `rounded-xl` both clamped, so the two classes
drew the identical shape. A further **18 `AvatarFallback` radii** were matched
to their `Avatar` root, so a full-bleed child follows its parent's corner
instead of bulging past it.

### Borders you can see

Each theme's `--border` now clears **1.45:1** on its card — GitHub Primer's
level, visible as a boundary without reading as an outline. That turns the
opacity variants into a real three-step hierarchy instead of four values crowded
into the invisible band:

| | ratio | means |
|---|---|---|
| `border-border` | 1.45 | a boundary between two things |
| `border-border/60` | 1.24 | a quieter edge (where the plain one used to be) |
| `border-border/40` | 1.15 | an internal rule inside one thing |

| theme | before | after |
|---|---|---|
| `:root` | `220 13% 90%` | `220 13% 85%` |
| `.dark` | `220 18% 20%` | `220 18% 23%` |
| `system` | `215 20% 30%` | `215 20% 31%` |
| `alliance` | `200 15% 88%` | `200 15% 84%` |
| `cofounder` | `240 6% 18%` | `240 6% 21%` |
| `minimal` | `36 12% 88%` | `36 12% 83%` |

Borders are decorative under WCAG unless they are a control's only boundary, and
that case is carried separately by `--input`, which stays at 3:1 for SC 1.4.11.

### Elevation that stops drawing a second outline

Tailwind's `shadow-sm` is `0 1px 2px rgb(0 0 0 / 0.05)` — on the 641 cards that
carry `border + bg-card + shadow-sm` that draws a second hard line a pixel below
the border, exactly where the corner turns. It is also the one thing that would
have survived the radius change and kept the corners looking stamped.

The ladder is rebuilt as a contact shadow plus an ambient one, tinted with
`--shadow-color` (a neutral black over a tinted ground reads as grey haze; a
shadow carrying the ground's hue reads as depth) and scaled by
`--shadow-strength`, which is how the dark themes get visible elevation without
restating the ladder five times. `--shadow-glow` and `--shadow-card` lost their
coincident 1px rings and keep the lift that was wanted; the dark themes' primary
glow is untouched.

---

## Result

| measure (134 routes, 10,260 elements) | before | after |
|---|---|---|
| Invisible borders (<1.15:1 on both sides) | 1,407 | **181** |
| Parents whose children disagree about the corner | 291 | **169** |
| Inset children with a corner larger than their surface | — | **0** |
| Radii outside the ladder | 6 stray steps | **0** |
| Pills wrongly squircled | — | **0** |
| Largest non-pill corner in the product | 13.12px (17×) | 24px |
| Share of rounded elements at ≤10px | 89% | 54% |

## What was verified, and against what

Every gate was re-run against a build of branch HEAD (`803ddb2`) in a parallel
worktree, on the same machine, at the same time — not against an older
saved report:

| gate | result |
|---|---|
| 147-route crash sweep | 147 clean, 0 problems |
| 9 viewports × 20 routes: overflow, clipped content, target size, grid tracks | **byte-identical to HEAD** — 0 overflow, 0 clipped, 0 bad grids |
| 6 viewports × 26 routes: occlusion, leading, control size, spacing grid | **byte-identical to HEAD** — 0 occlusions |
| Theme contrast, 14 contexts × 13 pairs | 182 pairs, 0 failures |
| axe-core WCAG 2.1 A/AA, desktop + mobile | 71 passed, 1 skipped, 0 failed |
| Control inventory across 134 routes | 5,581 → 5,584; **0 control identities lost** |
| Corner ladder, curvature and nesting (new) | 6 new tests, all passing |

Geometry being byte-identical is the important one: `border-radius`,
`border-color`, `corner-shape` and `box-shadow` are all non-layout properties,
and the measurement confirms the change moved nothing on the page.

Three target-size findings at `tablet-1024` are unchanged from HEAD and belong
to the 82% desktop scale from the previous round, not to this one.

---

## Left deliberately

- **1,680 sidebar nav rows clamp to a pill.** They are 226×23 at `rounded-lg`;
  a full-width pill nav row is a deliberate, common pattern and it is what the
  active state already looked like. The class is the correct family for a row —
  the clamp comes from the row being short, which belongs to the density work.
- **The `border + fill + shadow` count is unchanged at 1,280.** The shadow was
  softened, not removed: the metric counts presence, not weight. Removing the
  border from `Card` outright is a bigger design decision than this round's
  brief and would change every surface in the product.
- **`corner-shape` is Chromium-only today.** Firefox keeps the circular arc at
  the new, larger radius, which is still softer than what it had.
