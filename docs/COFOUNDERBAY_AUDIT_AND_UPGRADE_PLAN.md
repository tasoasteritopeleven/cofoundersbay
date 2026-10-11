# CoFounderBay — Έλεγχος & Πλάνο Αναβάθμισης

> **Scope:** Μόνο `C:\Users\anast\IdeaProjects\CoFounderBay`  
> **Ημερομηνία:** Ιούνιος 2026  
> **Στόχος:** Διόρθωση bugs χωρίς αφαίρεση λειτουργιών · εμπλουτισμός UI/UX · ταχύτητα dev & production

---

## 1. Κρίσιμα ευρήματα (διορθώθηκαν σε αυτή τη συνεδρία)

| # | Πρόβλημα | Αιτία | Διόρθωση |
|---|----------|-------|----------|
| A | `ERR_CONNECTION_REFUSED :3001` | `.env.local` είχε `NEXT_PUBLIC_API_URL=http://localhost:3001` → bypass proxy · ή web-only dev | Αφαίρεση URL από `.env.local` · proxy priority στο `api-origin.ts` · `dev.js` διαγράφει `NEXT_PUBLIC_API_URL` |
| B | Hydration mismatch `/readiness` | Loading `AppShell` χωρίς `actions`/`showHelp`, loaded με actions | Ίδιο shell structure σε loading & loaded |
| C | `pnpm dev:stack` crash | `npm run build -w` → turbo error | `dev-api.cjs`: direct `tsc` στο shared |
| D | WebSocket storm | `useBuilderSocket`, `NotificationCenter` hardcoded `:3001` | `getSocketOrigin()` / `getNativeWebSocketOrigin()` |
| E | Console flood API down | `NotificationsBell` χωρίς gating | `useApiAvailability()` gate |

---

## 2. Dev workflow (υποχρεωτικό)

```powershell
cd C:\Users\anast\IdeaProjects\CoFounderBay
pnpm dev:stack          # API :3001 + Web :3000 (προτείνεται)
# ΜΟΝΟ web (χωρίς API):
pnpm dev:web            # θα εμφανίζεται offline banner — OK για UI-only
```

- Browser: **http://localhost:3000** μόνο  
- Μην ανοίγεις `:3001` απευθείας  
- Μετά αλλαγή schema: `pnpm dev:api:setup` → `pnpm dev:stack`

---

## 3. Αρχιτεκτονική API routing

```
Browser (dev)  →  GET /api/*  →  Next.js rewrite  →  http://127.0.0.1:3001/api/*
Browser (dev)  →  ws://localhost:3000/socket.io  →  rewrite  →  API Socket.IO
OAuth redirects → getAbsoluteApiOrigin() → http://localhost:3001 (absolute)
SSR serverFetch → getAbsoluteApiOrigin() → direct to API
```

**Υπόλοιπα αρχεία με hardcoded `localhost:3001` (μελλοντική ενοποίηση):**
- `app/t/[slug]/layout.tsx`, `app/org/[slug]/page.tsx`, `app/profiles/[userId]/page.tsx`
- `app/auth/verify-email/page.tsx`, `app/api-status/page.tsx`, `app/test-onboarding/page.tsx`

---

## 4. Πλάνο ταχύτητας (Performance)

### 4.1 Dev (Turbopack) — ήδη ενεργό
| Τεχνική | Κατάσταση | Επόμενο βήμα |
|---------|-----------|--------------|
| Turbopack dev | ✅ `scripts/dev.js --turbopack` | — |
| Webpack hook μόνο production | ✅ `next.config.ts` | — |
| `optimizePackageImports` | ✅ lucide, radix, recharts | Προσθήκη `@mermaid-js/*` αν builder αργεί |
| `staleTimes.dynamic: 120` | ✅ router cache back-nav | Δοκιμή αύξησης σε 300 για heavy routes |

### 4.2 Cold compile (13–25s πρώτη επίσκεψη)
- **Prefetch:** `<Link prefetch={true}>` σε SideNav για top-10 routes (dashboard, matches, builder, messages)
- **Route groups:** `loading.tsx` skeletons ήδη υπάρχουν — verify όλα τα heavy routes
- **Dynamic import:** `next/dynamic` για Mermaid, Recharts, Builder workspace panels (ssr: false)

### 4.3 Runtime / Navigation
| Πρόβλημα | Λύση |
|----------|------|
| N+1 API στο mount | ✅ React Query staleTime 5m · gating `useApiAvailability` |
| Messaging 14 queries | Backend: eager-load conversations + last message σε 1 query |
| Full reload σε `api.ts` change | Αναμενόμενο — split types σε `api-types.ts` |
| StrictMode double effects | Socket hooks: idempotent connect/disconnect (ήδη μερικώς) |

### 4.4 Production build
- Route-level code splitting (webpack cacheGroups ήδη για radix/recharts/motion)
- Image `remotePatterns` configured
- RUM: PostHog page views (mock σε dev)

---

## 5. UI/UX — Semantic colors (theme-aware)

**Ολοκληρωμένα batches:** founder dashboard, readiness, matches, members, investors, builder, expert-reviews, admin security, κ.λπ.

**Εκκρεμή (hardcoded `text-emerald-*`, `text-amber-*`, κ.λπ.):**

| Περιοχή | Αρχεία |
|--------|--------|
| Builder sub-components | `ReadinessScoring`, `FinancialPlanning`, `MVPPlanner`, `BusinessModelCanvas`, `MarketAnalysis`, `ArtifactDiffView`, `ReviewPanel`, `CollabToolbar` |
| Admin | `automations`, `domains`, `sso`, `dashboard`, `communities` |
| Shell widgets | `RoleSwitcher`, `OfflineIndicator`, `NotificationCenter` icons |
| Automations logs | `text-amber-500`, `text-emerald-500` inline |

**Pattern:** `@/lib/semantic-colors` → `STATUS.success.chip`, `TREND.up`, `scoreTenPointClass()`

---

## 6. Σελίδα-προς-σελίδα — εμπλουτισμός

### 6.1 Founder journey
| Σελίδα | Τρέχουσα κατάσταση | Προτεινόμενη αναβάθμιση |
|--------|-------------------|------------------------|
| `/dashboard/founder` | Stats + gamification widgets | Drill-down links · empty states per widget · skeleton consistency |
| `/readiness` | 6 dimensions + score ring | Export PDF · historical trend chart · compare to benchmark |
| `/builder` | Full workspace + sockets | Offline queue για saves · conflict resolution UI |
| `/matches` | Match cards + filters | Batch actions · saved filter presets |
| `/fundraising` | Pipeline view | Stage automation hints · investor link from matches |
| `/milestones` | Timeline | Dependencies visualization · calendar sync |

### 6.2 Community & network
| Σελίδα | Αναβάθμιση |
|--------|------------|
| `/members`, `/search`, `/discover` | Unified filter bar component · recent searches |
| `/connections` | Inline accept/decline · mutual connections preview |
| `/groups/*` | Moderation queue badges · empty states (✅ filter-aware) |
| `/messages` | Typing indicators · read receipts · attachment preview |

### 6.3 Org / Tenant / Admin
| Σελίδα | Αναβάθμιση |
|--------|------------|
| `/org/[slug]/*` | Breadcrumb · role-based action visibility |
| `/admin/*` | Bulk actions · export CSV · audit trail links |
| `/tenant/*` | SSO test connection · webhook delivery log |

### 6.4 Modals & buttons (cross-cutting)
- **Confirm dialogs:** Χρήση `ConfirmDialog` παντού αντί `window.confirm`
- **Destructive actions:** Consistent `variant="destructive"` + aria-labels
- **Loading buttons:** `disabled` + spinner σε όλα τα submit (audit: forms without disabled state)
- **Empty states:** `EmptyState` component με CTA — extend to research, coaching, calendar

---

## 7. Backend / API συμβατότητα

| Θέμα | Σημείωση |
|------|----------|
| NestJS envelope `{ success, data }` | ✅ unwrapped στο `api.ts` |
| 401 → refresh cookie | ✅ `refreshAccessToken` |
| Circuit breaker | ✅ 5s→15s→60s→5min backoff |
| Meilisearch `:7700` | Optional — search fallback αν down |
| Ollama AI | WARN αν down — graceful degradation |
| Prisma 6 → 7 | Μελλοντική migration (major) |

---

## 8. Προτεραιότητες υλοποίησης (sprints)

### Sprint 0 — Stability (✅ αυτή η συνεδρία)
- [x] dev:stack / dev-api fix
- [x] API proxy + .env.local
- [x] Hydration readiness
- [x] Socket/API origin unification (partial)

### Sprint 1 — Performance (1–2 εβδομάδες)
- [ ] SideNav link prefetch top routes
- [ ] Dynamic import Mermaid + heavy builder panels
- [ ] Backend: optimize `listConversations` query count
- [ ] Migrate remaining `localhost:3001` refs → `api-origin.ts`

### Sprint 2 — Design system (1 εβδομάδα)
- [ ] Semantic colors batch 6 (builder sub-components)
- [ ] Semantic colors batch 7 (admin + shell widgets)
- [ ] Inner `max-w-*` audit on tenant/settings (keep forms narrow)

### Sprint 3 — Feature enrichment (ongoing)
- [ ] Readiness export + history
- [ ] Builder offline queue
- [ ] Admin bulk operations
- [ ] Unified search/filter bar

### Sprint 4 — Quality gates
- [ ] E2E smoke (Playwright): login → dashboard → matches → messages
- [ ] Lighthouse CI on `/dashboard/founder`, `/builder`
- [ ] API contract tests (shared DTOs)

---

## 9. Έλεγχοι ποιότητας

```powershell
# TypeScript
cd apps/web; pnpm exec tsc --noEmit

# Full monorepo
pnpm typecheck

# Lint
pnpm lint
```

---

## 10. Γνωστά warnings (μη-κρίσιμα)

| Warning | Ερμηνεία |
|---------|----------|
| `Fast Refresh full reload` on `api.ts` | Root module — αναμενόμενο |
| `npm warn auto-install-peers` | Root `.npmrc` — cosmetic |
| Turbo update 2.8→2.9 | Optional upgrade |
| Prisma 6→7 | Plan separately |

---

*Τελευταία ενημέρωση: μετά fixes hydration, API proxy, dev-api.cjs, socket origins.*
