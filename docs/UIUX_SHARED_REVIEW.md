# Shared UI/UX review — CoFounderBay

Scope: `apps/web/src/components/ui`, `apps/web/src/components/layout`, and `apps/web/src/app/globals.css`. This is a targeted accessibility/interaction patch, not a new visual system. Existing route files, request clients, auth, language preferences, semantic colors and type/radius tokens remain untouched.

## Evidence and changes

| Finding in shared code | Change |
| --- | --- |
| `AccordionTrigger` exposed neither expanded state nor a connection to `AccordionContent`; closed content relied only on CSS. | Stable React-generated trigger/panel IDs, `aria-expanded`, `aria-controls`, named region, native `hidden`, and a visible focus class. Single/multiple controlled and uncontrolled selection logic unchanged. |
| `FormField` replaced a child control's own `aria-describedby` whenever a hint/error existed. | Compose the existing description with the hint or error ID; keep existing validation behavior. |
| Each `Skeleton` announces its own live “Loading”, multiplying speech in tables and lists. | Kept the standalone loading announcement to avoid silently breaking callers without a loading region. Documented the group-level follow-up; no unsafe blanket change. |
| Toast action and dismiss buttons suppressed focus outlines; dismiss control was only 32px; notification region label was English-only. | Shared focus class, 44px dismiss target, bilingual region label. Toast timing, pause-on-hover/focus, severity announcements, actions and catalog translations remain. |
| Desktop `PageRail` peek closed on pointer exit even when focus remained in it; icon buttons had small hit areas. | Keep peek while focus is within the rail, open it on keyboard focus, close on blur outside, and make desktop rail buttons 44px. Pin/sheet/section behaviors remain. |
| `globals.css` set focus to a 1px translucent stroke and explicitly removed outlines from fields/comboboxes. | Final shared `:focus-visible` rule uses existing `--ring` token at 2px on interactive controls; no palette/branding changes. Existing reduced-motion overrides and responsive layouts remain intact. |

## Modified files

- `src/components/ui/accordion.tsx`, `accordion.test.tsx`
- `src/components/ui/form-field.tsx`, `form-field.test.tsx`
- `src/components/ui/toast.tsx`
- `src/components/layout/PageRail.tsx`
- `src/app/globals.css`
- `docs/UIUX_SHARED_REVIEW.md`

## Preserved and unverified

No page/route declarations, endpoint calls, mutations, authentication or translation catalog entries were changed. Existing EN/EL copy and `BilingualText` conventions remain. No workflow, package install, test, typecheck, browser sweep, contrast measurement or live backend verification was run, per request; therefore all 139 routes and behavior preservation are **scope-based expectations, not verified runtime claims**. The adjacent tests target disclosure semantics and combined field descriptions but have not been executed. Real-browser checks should cover keyboard focus in the peek rail (including pointer/keyboard alternation), responsive overflow and focus appearance in both themes; screen-reader announcement and native button keyboard activation need manual validation. Skeleton-heavy loading screens should eventually wrap grouped bars in one named loading status without suppressing standalone loading announcements. Error/retry presentation is route-owned rather than shared here; no shared error API was invented.