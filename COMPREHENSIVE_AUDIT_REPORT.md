# CoFounderBay — Εξαντλητικό Audit & Πλάνο Αναβάθμισης

**Ημερομηνία:** 2026-06-15  
**Project:** `c:\Users\anast\IdeaProjects\CoFounderBay`  
**Stack:** Next.js 15 + NestJS + PostgreSQL + Redis + Prisma

---

## 📋 Εκτελεστική Περίληψη

| Κατηγορία | Κατάσταση | Ενέργειες |
|-----------|-----------|-----------|
| TypeScript Build | ✅ **exit 0** (web + api) | Διορθώθηκε webpack types |
| Peer Dependencies | ⚠️ Warning | tldraw χρειάζεται React ^19.2.1 |
| Pages | 73 pages (web) | Λειτουργικές |
| API Endpoints | ~150+ | Καλή κάλυψη |
| Test Coverage | ❌ Missing | Χρειάζεται E2E |

---

## 🔴 ΚΡΙΣΙΜΑ BUGS — ΔΙΟΡΘΩΘΗΚΑΝ

### 1. Missing `@types/webpack` (FIXED ✅)
```
next.config.ts(84,34): error TS2307: Cannot find module 'webpack'
```
**Διόρθωση:** `pnpm add -D webpack @types/webpack --filter @cofounderbay/web`

### 2. Health-Probe Storm → `ERR_CONNECTION_REFUSED` flooding (FIXED ✅)
**Σύμπτωμα:** Εκατοντάδες `GET /api/health/liveness net::ERR_CONNECTION_REFUSED` στο console όταν το API είναι κάτω.

**Root cause (3 bugs):**
1. `probeApiHealth()` (`apps/web/src/lib/api.ts`) κατάπινε σιωπηλά τα failures (`// keep circuit state`) και **δεν enable-άρε ποτέ το circuit breaker** — failed probe δεν επέκτεινε το backoff.
2. `useApiAvailability.sync()` συμπέραινε διαθεσιμότητα **μόνο** από `isApiCircuitOpen()`. Όταν το breaker έκλεινε μετά το timeout, δήλωνε το API "available" ενώ ήταν ακόμα κάτω → re-enable όλων των React Query hooks → burst → fail → re-arm. **Ταλάντωση κάθε ~15s.**
3. **Redundant probe loops:** κάθε instance του `useApiAvailability` (TenantContext, useAIChat, useUnreadCounts…) έτρεχε δικό του probe + interval, μαζί με το `ApiHealthProbe`. Με React StrictMode double-mount → εκατοντάδες probes.

**Fixes:**
- `api.ts` — `probeApiHealth()` τώρα καλεί `markApiUnavailable()` on failure (re-arm backoff) + νέα export `isApiReachable()` που ΔΕΝ επιστρέφει true απλώς επειδή πέρασε το backoff window.
- `useApiAvailability.ts` — αμιγώς event-driven (μόνο `cfb:api-online/offline`), **καμία** probe loop ανά instance.
- `ApiHealthProbe.tsx` — η **μοναδική** πηγή recovery probing, gate στο `!isApiReachable()`.

**Αποτέλεσμα:** Ενώ το API είναι κάτω, ένα μόνο probe/15s· τα requests short-circuit-άρουν χωρίς network call· recovery ≤ 15s μετά την επαναφορά του server. Build: `web tsc --noEmit` exit 0 ✅.

> Σημείωση: Αν θέλετε να εξαφανιστεί τελείως το μήνυμα, ξεκινήστε το API με `pnpm dev:api`.

### 3. Orphaned dead-code pollers (NOT removed — documented)
- `apps/web/src/components/messages/MessageThread.tsx` — raw `fetch` με `refetchInterval: 3000` (bypass circuit breaker). **Δεν γίνεται import πουθενά** → δεν τρέχει.
- `apps/web/src/components/activity/ActivityFeed.tsx` — raw `fetch` με `refetchInterval: 30000`. **Δεν γίνεται import πουθενά** → δεν τρέχει.
- Διατηρούνται (no functionality removal). Αν ποτέ χρησιμοποιηθούν, να μεταφερθούν σε `apiRequest` + apiAvailable gating.

---

## ⚠️ WARNINGS & TECH DEBT

### 1. Peer Dependency Warnings — tldraw
```
tldraw 4.5.4
├── ✕ unmet peer react@"^18.2.0 || ^19.2.1": found 19.1.0
└── ✕ unmet peer react-dom@"^18.2.0 || ^19.2.1": found 19.1.0
```
**Λύση:** Αναβάθμιση React σε 19.2.1+ ή downgrade tldraw

### 2. Type Casts (`as any` / `as unknown`) — 333 instances
- **Backend:** 250 matches σε 42 files
- **Frontend:** 83 matches σε 27 files
- **Κύρια αιτία:** Prisma models χωρίς `prisma generate`

### 3. Console Logs σε Production Code — 34 instances
- `analytics-mock.ts`: 7 matches
- `performance.ts`: 3 matches
- `ErrorBoundary.tsx`: 2 matches

---

## 📊 ΑΝΑΛΥΣΗ PERFORMANCE

### Frontend Bottlenecks (με σειρά προτεραιότητας)

| # | Πρόβλημα | Επίπτωση | Λύση |
|---|----------|----------|------|
| 1 | **BuilderContext waterfall** | 4 sequential API calls | Parallel fetching + Promise.all |
| 2 | **No query staleTime tuning** | Excessive refetches | Per-query staleTime config |
| 3 | **Large bundle imports** | Slow initial load | More dynamic imports |
| 4 | **reactStrictMode: true** | Double mounts σε dev | Normal — dev only |
| 5 | **isLoading patterns** | 374 matches | Μερικά χρησιμοποιούν custom state αντί useQuery |

### Backend Bottlenecks

| # | Πρόβλημα | Επίπτωση | Λύση |
|---|----------|----------|------|
| 1 | **checkWorkspaceAccess** | Extra DB query per op | Cache 30s στο Redis |
| 2 | **getDocument deep includes** | Heavy payload | Selective field loading |
| 3 | **No builder caching** | Every request hits DB | Add Redis TTL 60s |

### DB Indexes — VERIFIED ✅
```prisma
// BuilderReview — @@index([documentId]) ✅ EXISTS
// BuilderSectionComment — @@index([sectionId]) ✅ EXISTS  
// BuilderExport — @@index([userId, documentId, workspaceId, status, createdAt]) ✅ EXISTS
```
**Σημείωση:** Όλα τα κρίσιμα indexes υπάρχουν ήδη στο schema.

---

## 📦 DEPENDENCY AUDIT

### Critical Updates Needed
| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| react | 19.1.0 | 19.2.1+ | Upgrade for tldraw |
| react-dom | 19.1.0 | 19.2.1+ | Upgrade |
| pnpm | 9.14.2 | 11.7.0 | Consider upgrade |

### Deprecated Subdependencies
```
glob@10.4.5, lodash.isequal@4.5.0
```

---

## 🏗️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΝΑΛΥΣΗ

### File Structure (apps/web/src/app)
- **73 page routes** (50 page.tsx files + nested)
- **8 Context providers** (BuilderContext, MessagingContext, etc.)
- **90+ useMemo/useCallback** (καλή memoization)
- **23 lazy-loaded components**

### API Layer
- **5874 lines** σε `api.ts`
- Centralized error handling ✅
- Circuit breaker ✅
- CSRF protection ✅

### Provider Hierarchy (layout.tsx)
```
ErrorBoundary
└── QueryProvider
    └── TenantProvider
        └── SidebarProvider
            └── NetworkProvider
                └── ApiHealthProbe
                └── ToastProvider
                    └── PopupChatProvider
                        └── MessagingProvider
                            └── DemoDataProvider
                                └── RoleTheme
```

---

## 📈 ΠΛΑΝΟ ΑΝΑΒΑΘΜΙΣΗΣ

### ΦΑΣΗ 1: Κρίσιμες Διορθώσεις (0-2 εβδομάδες)

#### 1.1 TypeScript Strictness
- [x] Fix webpack types ✅
- [ ] Run `prisma generate` για type safety
- [ ] Eliminate top 50 `as any` casts

#### 1.2 React Upgrade
```bash
pnpm update react react-dom --filter @cofounderbay/web
```

#### 1.3 Database Schema ✅
```bash
# Indexes already in place — verify schema sync
cd apps/api && npx prisma db push --skip-generate
```

---

### ΦΑΣΗ 2: Performance (2-4 εβδομάδες)

#### 2.1 Frontend Optimizations

**BuilderContext Parallel Loading:**
```typescript
// BEFORE (waterfall)
await loadWorkspaces();
await selectWorkspace(id);
await loadDocuments();

// AFTER (parallel)
const [workspaces, documents] = await Promise.all([
  fetchWorkspaces(),
  fetchDocuments(workspaceId)
]);
```

**Query StaleTime Tuning:**
```typescript
// Per-resource stale times
const STALE_TIMES = {
  profile: 5 * 60_000,      // 5 min
  connections: 2 * 60_000,   // 2 min
  notifications: 30_000,     // 30 sec
  realtime: 0                // always fresh
};
```

#### 2.2 Backend Caching

**checkWorkspaceAccess:**
```typescript
async checkWorkspaceAccess(userId: string, workspaceId: string) {
  const cacheKey = `ws:access:${userId}:${workspaceId}`;
  const cached = await this.cache.get(cacheKey);
  if (cached) return cached;
  
  const result = await this.prisma.workspace.findFirst({...});
  await this.cache.set(cacheKey, result, 30); // 30s TTL
  return result;
}
```

---

### ΦΑΣΗ 3: UX/UI Refinements (4-6 εβδομάδες)

#### Σελίδα-σελίδα Improvements

| Page | Current State | Upgrade |
|------|---------------|---------|
| `/dashboard/*` | ✅ Good | Add skeleton loaders |
| `/discover` | ✅ Good | Infinite scroll |
| `/connections` | ✅ Good | Batch accept/decline |
| `/messages` | ✅ Good | Message search |
| `/builder` | ✅ Good | Autosave indicator |
| `/research` | ✅ Good | Undo/redo history |
| `/admin/*` | ⚠️ Many pages | Consolidate tabs |
| `/settings/*` | ⚠️ Basic | Add sidebar nav |

#### Component Enhancements

| Component | Enhancement |
|-----------|-------------|
| `ProfileCard` | Hover preview modal |
| `ConnectionCard` | Quick actions dropdown |
| `NotificationCenter` | Mark all read |
| `ChatWindow` | Typing indicators |
| `ResearchCanvas` | Keyboard shortcuts help |

---

### ΦΑΣΗ 4: Testing & Quality (6-8 εβδομάδες)

#### 4.1 E2E Tests (Playwright)
```typescript
// Critical user flows
test('founder can create pitch deck', async ({ page }) => {...});
test('mentor can accept booking', async ({ page }) => {...});
test('investor can save to shortlist', async ({ page }) => {...});
```

#### 4.2 Unit Tests (Vitest)
- API layer functions
- React hooks (useApiAvailability, useBuilderSocket)
- Utility functions

#### 4.3 Integration Tests
- Auth flow complete
- Messaging real-time
- Canvas collaboration

---

### ΦΑΣΗ 5: Advanced Features (8-12 εβδομάδες)

#### 5.1 Missing Backend Endpoints
- [ ] `/api/messages/conversations/:id/transcript` — export
- [ ] `/api/messages/conversations/:id/validation/*` — blockchain
- [ ] `/milestones/new` route

#### 5.2 SSR Prefetching
```typescript
// pages that would benefit from SSR
// - /profiles/[userId]
// - /org/[slug]
// - /pitch/[id]
```

#### 5.3 Offline Support
- Service Worker caching strategies
- IndexedDB for draft documents
- Background sync for messages

---

## 📝 TODO ITEMS FOUND (63 total)

### High Priority
- `ResearchNodeCard.tsx`: 8 TODO/FIXME
- `ResearchNodeViewer.tsx`: 8 TODO/FIXME
- `[boardId]/page.tsx`: 6 TODO

### Medium Priority
- `MilestoneFormModal.tsx`: 3 TODO
- `marketplace/page.tsx`: 2 TODO
- `milestones/page.tsx`: 2 TODO

### Low Priority (40+ scattered)
- Various implementation details
- Future feature flags

---

## 🔧 IMMEDIATE ACTION ITEMS

```bash
# 1. Regenerate Prisma client
cd apps/api && npx prisma generate

# 2. Add missing indexes
npx prisma db push

# 3. Verify build
pnpm typecheck && pnpm build

# 4. Start full stack
pnpm dev
```

---

## 📚 ΑΡΧΕΙΑ ΑΝΑΦΟΡΑΣ

- `UIUX_REFINEMENT_PROGRESS.md` — UI normalization tracker
- `PRODUCTION_ROADMAP.md` — deployment checklist
- `apps/api/prisma/schema.prisma` — DB schema (7205 lines)
- `apps/web/src/lib/api.ts` — API client (5874 lines)

---

**Τελευταία Ενημέρωση:** 2026-06-15 18:30 UTC+3
