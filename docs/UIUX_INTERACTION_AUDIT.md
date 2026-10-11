# CoFounderBay interaction audit — live preview

Date: 2026-09-27
Scope: one focused browser journey only, on the original Next preview at `/` → `/feed`.

## Test setup

The preview was opened with the requested demo state:

- Cookies: `cfb_session=preview-demo`, `cfb_primary_role=existing_founder`,
  `cfb_preview_demo=1`, `cfb_demo_data=1`, `cookie_consent=accepted`,
  `cfb_locale=en`, and `theme=light` (changed during the matrix run).
- `localStorage.user`:
  `{"id":"preview-demo-user","email":"demo@cofounderbay.com","role":"founder","displayName":"Alex Demo"}`
- `accessToken=preview-demo`, `cfb_demo_data=1`, `cookie_consent=accepted`,
  `cfb_locale=en`, `theme=light`.
- Browser: real Playwright browser; reduced motion requested; no screen-reader AT
  was used and no authorization/security conclusion is made.
- Viewports: 390×844 and 1440×900.
- Routes actually visited: `/` (redirected to `/dashboard/founder`) and `/feed`.

The root preview loaded as Alex Demo and redirected to `/dashboard/founder`.
`/feed` then loaded the live Feed page. A preview warning was logged for the
missing demo handler `GET /api/tenants/resolve-domain`; it did not block this
journey. The dev HMR WebSocket also returned 502, without a user-visible
failure.

## Source/entry-point distinction

The active composer is:

- `apps/web/src/components/feed/FeedPostComposer.tsx`
- imported and rendered by `apps/web/src/app/feed/page.tsx` (the live `/feed`
  page).

`apps/web/src/components/feed/CreatePost.tsx` is reusable/tested code but has
no active-page import found in the source search. Its tests must not be treated
as proof of the live Feed experience.

The corrected sharing implementation is:

- `apps/web/src/components/ui/share-modal.tsx`, exporting `ShareModal` and its
  convenience `ShareButton`.

No live app import of that `ShareButton`/`ShareModal` was found; references are
limited to its own tests. `apps/web/src/components/social/ShareButton.tsx` is a
separate older implementation and likewise had no live-page import.

The live feed does expose ordinary `Share` buttons. They call
`feed/page.tsx`'s `handleShare`, copy `/feed?post=<id>`, show a success toast,
and call `recordInteractionMutation.mutate`. Because the requested audit
explicitly prohibited other network mutations, these controls were **not
activated**. Consequently Escape/return-focus and copy-status behavior of a
live share dialog were not claimed or tested, and no external social channel
was opened or sent.

## Composer journey — verified

### 390×844, EN, light, reduced motion

1. The textbox was found as
   `Write a post. Σύνταξη δημοσίευσης` and focused successfully. Its measured
   focused box was approximately `x=77, y=303, width=266, height=100`.
   Focus expanded the composer and the screenshot showed a visible focus ring.
2. The post-type group was exposed as
   `Post type. Τύπος δημοσίευσης`; all five choices had bilingual accessible
   names and `aria-pressed`. `Update` started pressed.
3. Keyboard-only checks passed: from the textarea, `Tab` landed on Update,
   the next `Tab` landed on Milestone, `Space` made Milestone
   `aria-pressed=true`, and `Shift+Tab` returned to Update.
4. The draft
   `Preview demo session-only post — 390 mobile wrapping check.`
   wrapped across two lines. Image and link controls were disabled and
   explained with bilingual `aria-label`/`title` text.
5. The exact composer `Post` button was clicked once. The initial generic
   `getByRole('button', {name:'Post'})` selector was correctly rejected by
   Playwright because unrelated “Open post actions”/“Bookmark post” buttons
   also matched; no click occurred on that failed attempt. The retry used the
   exact accessible name and matched one enabled button.
6. Result: exactly one new `You` / `Milestone` post appeared; the body
   contained the draft once, the textarea was empty, and the composer reset.
   The visible bilingual status was:

   > Posted · Δημοσιεύτηκε
   > Kept for this session — the feed has no server to store it yet. ·
   > Κρατείται για αυτή τη συνεδρία — το feed δεν έχει ακόμη διακομιστή να
   > το αποθηκεύσει.

   This verifies the intended session-only behavior and no duplicate publish.

### 1440×900, EN, dark

After reload/navigation to `/feed`, the session-only post was still present
exactly once and the composer was empty and reachable. The desktop screenshot
showed the full left navigation, central feed, and right tools rail with no
visible clipping or overlap at normal scale.

### Locale/theme matrix

The following additional states were loaded and checked:

| Viewport | Locale | Theme | Result |
|---|---|---|---|
| 1440×900 | EL | light | Feed loaded; Greek composer accessible name present; no normal-scale overflow |
| 390×844 | EL | dark | Greek navigation/feed rendered; composer present; session post once; no normal-scale overflow |

At normal scale, measured `documentElement.scrollWidth - innerWidth` was `-6px`
and body overflow was `-6px` in both sampled states (there was no positive
horizontal overflow).

The Greek view is not completely Greek: the feed description and some action
labels remained English alongside Greek text. This is a localization
consistency issue, not a composer blocker.

## 200% zoom/reflow — simulation finding, not a native browser-zoom result

Important method qualification: this was **not** native browser zoom. The
Playwright action used the following page script:

```js
await page.evaluate(() => {
  document.documentElement.style.zoom = '200%';
});
```

It did not set `deviceScaleFactor`, use CDP `Emulation.setPageScaleFactor`, or
change the browser's UI zoom setting. Therefore this is a CSS `zoom`/visual
scaling simulation. CSS zoom does not necessarily reproduce the viewport
reduction and breakpoint behavior of real 200% browser zoom, and can itself
create overflow artifacts. The result below is a **follow-up candidate for
native browser-zoom verification**, not a definitive WCAG 1.4.10 claim.

Under that CSS-zoom simulation, the composer remained focusable:

- 390×844: `innerWidth=390`, `scrollWidth=584` — **194px positive horizontal
  overflow**. The tab strip extended beyond the viewport; the composer became
  severely constrained, its placeholder wrapped at roughly one or two words
  per line, and the fixed bottom navigation/floating page-tools control
  overlapped nearby content in the screenshot.
- 1440×900: `innerWidth=1440`, `scrollWidth=1863` — **423px positive horizontal
  overflow**. The composer remained present, but the desktop content exceeded
  the viewport at 200% zoom.

This is a reproducible CSS-zoom overflow/reflow issue at the tested route. It
may indicate a genuine 200% reflow problem, but native browser zoom must be
tested before attributing it to WCAG 1.4.10. The normal 390px/1440px layouts
did not show positive overflow, so the finding is specific to this simulation.

### Overflow measurement limits

The only overflow values captured were aggregate document/body measurements:

```js
({
  inner: [innerWidth, innerHeight],
  scroll: [document.documentElement.scrollWidth,
           document.documentElement.scrollHeight],
  overflow: document.documentElement.scrollWidth - innerWidth,
  bodyOverflow: document.body.scrollWidth - innerWidth
})
```

No element-level overflow selector or offending DOM node was captured in this
pass. The screenshots visually implicated the tab strip, composer region, and
fixed mobile navigation/tools at 390px, but those are visual observations, not
an element-level overflow attribution.

## Accessibility and verification boundaries

Verified in the browser:

- semantic textbox and bilingual accessible name;
- visible focus and focus retention;
- keyboard Tab/Shift+Tab and Space selection;
- `aria-pressed` type state;
- disabled attachment controls with explanatory labels;
- single publish result, draft clearing, status text, and duplicate count;
- mobile wrapping at normal scale and 200% reflow measurements;
- reduced-motion browser preference was requested.

Not claimed:

- no screen-reader AT was run;
- no formal axe or measured color-contrast result was available in this
  focused run;
- no authorization, tenant-isolation, or backend persistence guarantee was
  tested;
- no social/external share was opened or sent;
- no extra network mutation was made beyond the explicitly requested
  session-only publish.

## Evidence

Useful browser observations/screenshots from the run:

- `bfrpqz`: focused expanded mobile composer and visible focus ring.
- `9u31fm`: keyboard-selected Milestone and wrapped draft before publish.
- `2dzs0g`: single published session-only post, cleared composer, bilingual
  status notification.
- `nfgs13`: 1440px EN/dark desktop feed with one session-only post.
- `b1k6pg`: 390px EL/dark normal-scale feed.
- `3pjvj1`: 390px 200% zoom clipping/overlap.
- `1ct1wg`: 1440px 200% zoom overflow state.
