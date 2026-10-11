# Functionality-preservation audit

**Question.** Across 27 commits of upgrade work, was any pre-existing
functionality removed rather than improved?

**Answer.** No capability was removed. One visual regression was found and
fixed. The evidence is below, including the checks that initially *looked* like
removals and what they actually were.

Span audited: `91d6ea3` (the branch point from `main`) through `f1fc7fc`.

---

## Method

Two kinds of evidence, because static and runtime checks miss different things.

**Static** — diff the whole span for deleted files, renamed files, removed
routes, and removed exported symbols.

**Runtime** — build the pre-upgrade commit in a clean git worktree, serve it,
and crawl 134 routes in a real browser recording every interactive control the
user can reach; then do the same on `HEAD` and diff the two inventories. A
control is recorded as `role | accessible name | href`, so a link that moved,
lost its label, or stopped pointing anywhere shows up.

---

## Static results

| Check | Before | After | Removed |
|---|--:|--:|--:|
| Source files deleted | — | — | **0** |
| Files renamed | — | — | 0 |
| Route `page.tsx` | 147 | 147 | **0** |
| Exported symbols (components, hooks, types, functions) | 1416 | 1591 | **0** |

The only deletion in the entire span is `apps/web/tsconfig.tsbuildinfo`, a
TypeScript build cache that had been committed by mistake despite matching
`.gitignore`.

### Interactive affordances in source

| Pattern | Before | After | Δ |
|---|--:|--:|--:|
| `onSubmit=` | 18 | 18 | 0 |
| `onChange=` | 536 | 537 | +1 |
| `onValueChange=` | 120 | 120 | 0 |
| `onKeyDown=` | 38 | 38 | 0 |
| `useQuery` | 417 | 417 | 0 |
| `useMutation` | 201 | 201 | 0 |
| `router.push` | 63 | 63 | 0 |
| `href=` | 496 | 500 | +4 |
| `<Dialog` | 256 | 281 | +25 |
| `<Button` | 1221 | 1229 | +8 |
| **`onClick=`** | **1336** | **1330** | **−6** |

`onClick` is the one line that moved down, so it was traced to the individual
handler.

---

## The nine removed `onClick` handlers

Four files account for them. Every one is a replacement, not a removal.

| File | Before → after | What happened |
|---|--:|---|
| `admin/automations/page.tsx` | 16 → 12 | Two hand-rolled modals: a `<div onClick={onClose}>` backdrop and a custom `<button onClick={onClose}><X/></button>` per modal, replaced by Radix `<Dialog onOpenChange>` |
| `endorsements/WriteEndorsementModal.tsx` | 5 → 3 | Same conversion |
| `milestones/MilestoneFormModal.tsx` | 3 → 1 | Same conversion |
| `common/OfflineIndicator.tsx` | 2 → 1 | Three duplicate branches (offline / API down / reconnected) collapsed into one wrapper; both `window.location.reload()` handlers became one |

The dismissal behaviour those handlers provided is now supplied by
`DialogContent`, verified in `ui/dialog.tsx:79`: a `DialogPrimitive.Close`
button labelled "Close dialog", plus Radix's backdrop-click and Escape
dismissal. The conversion also adds a focus trap and dialog semantics that the
hand-rolled versions did not have.

---

## Runtime results

134 routes crawled on both builds, no errors on either side.

| | Before | After |
|---|--:|--:|
| Interactive controls reachable | 4869 | **5581** (+712) |
| Distinct link destinations | 141 | **152** |
| **Destinations reachable before but not after** | — | **0** |

### The two figures that looked like losses

**329 "lost" controls** under a strict `role|name|href` key. Almost all are
*renames*, because giving a control an accessible name changes that key.
`/settings/notifications` is the clearest case:

| | switches | unnamed |
|---|--:|--:|
| Before | 55 | **55** |
| After | 55 | **0** |

Not one switch was removed; all 55 gained a name.

**45 "lost" buttons** by role count, spread over 24 routes. These are the
`<Link><Button>` pairs that the un-nesting pass corrected. An anchor containing
a button is invalid HTML — interactive content may not nest — and it rendered
**two** focusable controls for one action. `/privacy` shows it exactly:

```
before:  link|Terms of Service|/terms   AND   button|Terms of Service|
after:   link|Terms of Service|/terms
```

Same label, same destination, one tab stop instead of two. Link counts rose on
every one of those 24 routes while button counts fell — the action did not
disappear, its duplicate did.

---

## Deliberate behaviour changes, stated plainly

Seven guards were added that make a component render *less* in one specific
situation. In every case the previous behaviour was not "working functionality"
— it was an uncaught exception that replaced the whole page with an error
boundary.

| Component | Before, on a partial API payload | After |
|---|---|---|
| `discover` | `hits.length` threw; page blanked | Empty result list |
| `dashboard/founder` | `xpData.streak.currentStreak` threw; page blanked | XP card hidden |
| `analytics` | `m.profileViews` threw; page blanked | Missing counters render 0 |
| `RoleBadge` | `role.toLowerCase()` threw; four pages blanked | Badge omitted |
| `matches/[userId]` | `sourceProfile.avatarUrl` threw; page blanked | Existing "Could not load" fallback |
| `VentureReadinessCard` | `<Link href={undefined}>` threw; page blanked | Card hidden |
| `BehavioralNudge`, `search` | Same throw | Item omitted |

`admin/billing` is the one behaviour change that is not a crash fix: the "All
statuses" option carried `value=""`, which violates Radix's Select contract and
threw on every render. It now carries a sentinel mapped back to `undefined` at
the query boundary — the same filter, and the control now shows its own state
instead of a placeholder.

---

## The one real regression, found and fixed

Collapsing `OfflineIndicator`'s three branches moved the "Back online!" state
from `justify-center` to `justify-between`. With no action button beside it,
that left the message hanging on the left instead of centred. Fixed: the row
centres when there is nothing to act on.

This is the only case in the whole span where the audit found something worse
after than before.

---

## What was added

For completeness, the same span added: 175 exported symbols, 25 dialogs, 712
reachable controls, 11 link destinations, 45 segment layouts, route-level error
and loading boundaries for every segment, a CSP and full security header set,
an axe suite that now runs 70 tests, and the responsive, type and spacing work
documented in `RESPONSIVE_UPGRADE_PLAN.md` and `TYPE_AND_SPACING_PLAN.md`.

---

## Limits of this audit

- The runtime crawl covers the 134 static routes at one viewport, signed in as
  a user holding every role. Controls that appear only after an interaction —
  inside an opened dialog, a hover menu, a later wizard step — are not in the
  inventory. The static export and handler diffs cover those paths instead.
- It compares what is *present*, not what each control *does* when clicked.
  Behavioural equivalence rests on the diffs read per file, not on the crawl.
- 13 dynamic routes were crawled with sample parameters, so their content
  depends on what the stub API returns for those ids.
