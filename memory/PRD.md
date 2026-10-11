# CoFounderBay — PRD & Session Log

## Original request (2026-06)
Audit the most-developed branch on GitHub (`Animus1991/cofoundersbay`), pull those
changes into `claude/project-audit-upgrade-y2ebnr`, and optimise the platform's
UI/UX (aesthetics + usability + self-explanatoriness) with **no loss of functionality**.

## Stack
- Monorepo: pnpm + Turborepo
- Web: Next.js 15 (App Router) + TypeScript + Tailwind
- API: NestJS + Prisma + PostgreSQL, Redis/BullMQ, Meilisearch
- Shared: `@cofounderbay/shared`, `@cofounderbay/ui`

## Branch audit (2026-06)
| Branch | Commits | Files | Last commit |
|--------|---------|-------|-------------|
| main | 92 | 1274 | 2026-04-01 |
| cursor/ai-os-fullpage-chat | 225 | 1525 | 2026-09-13 |
| cursor/ui-upgrade-cloudflare | 353 | 1319 | 2026-09-24 |
| claude/project-audit-upgrade-y2ebnr | 417 | 2083 | 2026-09-27 |
| **integration/ai-platform-upgrade** | **418** | **2084** | **2026-09-27** |

**Most developed = `integration/ai-platform-upgrade`** — a strict superset of the
claude branch (+1 commit: typography tightening in globals.css; 0 commits behind).
Merged into `claude/project-audit-upgrade-y2ebnr` via **fast-forward** (clean).

## Health verification
- `tsc -p apps/web --noEmit` → **exit 0**
- Next.js dev server boots on :3000; landing, /login, /demo, /dashboard/founder all render (verified via screenshots). No Docker in this env, so the NestJS API/DB/Meilisearch stack is not runnable here — UI verified via the built-in client-side **demo mode** (`/demo`).

## UI/UX status
The prior audit (Phases 4A–4E documented in `UIUX_REFINEMENT_PROGRESS.md`) already
delivered a mature design system: single-source radius scale, tinted elevation
ladder, WCAG-2.2-AA-audited themes (5 themes + 4 role overrides), semantic status
tokens, reduced-motion support, bilingual EN/EL layer, page-registry titles/help,
contextual help, unified empty states, Turbopack dev. The product is ~95% polished.

### Change made this session (additive, zero functional risk)
- **/expert-reviews** was the one page flagged incomplete (Phase 4C.8) that had no
  contextual help at all. Added: `helpId` + bilingual `helpTitle` in page-registry,
  curated EN/EL help copy in `PageContextualHelp`, and `showHelp` + Ask AI prompt on
  the page — matching the exact pattern used by 20+ other pages.

## Backlog (remaining Phase 4C.8 / Phase 5 — low risk, incremental)
- P2: contextual `showHelp` for `/org/cohorts/[id]` (needs a helpId + copy)
- P2: register/curate help for `/analytics` sub-tabs already covered; verify `/programs`, `/marketplace` copy on mobile
- P2: Phase 5 validation — full responsive + axe-core a11y sweep on top 20 pages, cross-role regression (requires the Docker stack running with seed data)

## Delivery
Work committed on branch `claude/project-audit-upgrade-y2ebnr`. Push via **Save to
GitHub**.
