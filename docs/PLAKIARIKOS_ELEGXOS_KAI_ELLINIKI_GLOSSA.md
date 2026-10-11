# Πλακιάρικος Έλεγχος & Ελληνική Γλώσσα — CoFounderBay Web

> **Αποθετήριο:** `C:\Users\anast\IdeaProjects\CoFounderBay`  
> **Εφαρμογή:** `apps/web` (Next.js 15, App Router)  
> **Ημερομηνία έκδοσης:** Ιούνιος 2026  
> **Γλώσσα εγγράφου:** Ελληνικά (τυπική, επιστημονική ορολογία)  
> **Πολιτική γλώσσας UI:** Δίγλωσση EN+EL — το Αγγλικό **δεν αντικαθίσταται**, η Ελληνική **προστίθεται**

---

## Πίνακας περιεχομένων

1. [Εισαγωγή & Μεθοδολογία](#1-εισαγωγή--μεθοδολογία)
2. [Αρχιτεκτονική ευρημάτων](#2-αρχιτεκτονική-ευρημάτων)
3. [Κατάλογος διαδρομών (Routes)](#3-κατάλογος-διαδρομών-routes)
4. [Κατάλογος components](#4-κατάλογος-components)
5. [Γνωστά σφάλματα & ασυμβατότητες](#5-γνωστά-σφάλματα--ασυμβατότητες)
6. [Κάλυψη μετάφρασης](#6-κάλυψη-μετάφρασης)
7. [Γλωσσάριο όρων EN→EL](#7-γλωσσάριο-όρων-enel)
8. [Σχέδιο φάσεων (Sprint 0–4)](#8-σχέδιο-φάσεων-sprint-04)
9. [Οδηγίες για developers](#9-οδηγίες-για-developers)
10. [Συναφή έγγραφα](#10-συναφή-έγγραφα)

---

## 1. Εισαγωγή & Μεθοδολογία

### 1.1 Σκοπός

Το παρόν έγγραφο αποτελεί **πλακιάρικο έλεγχο** (horizontal audit) της εφαρμογής CoFounderBay Web με ειδική εστίαση στην **εισαγωγή ελληνικής γλώσσας** ως δεύτερη, παράλληλη γλωσσική στρώση. Ο έλεγχος καλύπτει λειτουργικότητα, προσβασιμότητα, διεθνισμό (i18n), ασφάλεια και απόδοση, χωρίς αφαίρεση υπάρχοντων λειτουργιών.

### 1.2 Εύρος (scope)

| Κατηγορία | Αριθμός | Πηγή μέτρησης |
|-----------|---------|---------------|
| Διαδρομές (`page.tsx`) | **154** | `apps/web/src/app/**/page.tsx` |
| React components (`.tsx`) | **189** | `apps/web/src/components/**/*.tsx` |
| Στατικές συμβολοσειρές UI (εκτίμηση) | **~4.000** | Inline literals σε pages + components (αποκλεισμός types/tests) |
| Καταχωρημένες διαδρομές στο `PAGE_REGISTRY` | **79** | `page-registry.ts` |
| Δυναμικά μοτίβα metadata | **5** | `DYNAMIC_PATTERNS` + `PAGE_META_EL_PATTERNS` |
| Συνδέσμοι πλοήγησης με EL labels | **105** | `NAV_LABEL_EL` στο `strings-nav.ts` |
| Κοινές shell συμβολοσειρές | **24** | `COMMON_STRINGS` στο `strings-common.ts` |

### 1.3 Μεθοδολογία ελέγχου

Ο έλεγχος βασίστηκε σε:

1. **Στατική ανάλυση κώδικα** — ανάγνωση registry, i18n modules, shell components.
2. **Συμβατότητα με υπάρχον audit** — `docs/COFOUNDERBAY_AUDIT_AND_UPGRADE_PLAN.md`.
3. **Χαρτογράφηση διαδρομών** — εξαγωγή όλων των `page.tsx` paths.
4. **Κριτήρια αξιολόγησης** (βαθμολογία ποιότητας ανά route/component):

| Κριτήριο | Περιγραφή | Σημείωση για i18n |
|----------|-----------|-------------------|
| **Λειτουργικότητα** | Route φορτώνει, API calls επιτυχούν, φόρμες υποβάλλονται | Ανεξάρτητο από γλώσσα |
| **Προσβασιμότητα (a11y)** | WCAG 2.1 AA — skip links, `lang`, aria-labels | `BilingualText` με `lang="en"` / `lang="el"` |
| **i18n** | Δίγλωσση παρουσίαση EN+EL | Κανόνας: EN πρώτο, EL δεύτερο |
| **Ασφάλεια** | Auth gates, CSRF, XSS σε user content | Μη μετάφραση secrets |
| **Απόδοση** | Cold compile, N+1 queries, WebSocket storms | Prefetch, gating |

### 1.4 Ορισμοί κατάστασης (status)

| Status | Ορισμός |
|--------|---------|
| `complete` | Πλήρης UI, API integration, metadata EL διαθέσιμο (όπου applicable) |
| `partial` | Λειτουργικό αλλά ελλιπές enrichment ή ελλιπή μετάφραση inline strings |
| `scaffold` | Placeholder, dev-only, ή χωρίς EL metadata |

---

## 2. Αρχιτεκτονική ευρημάτων

### 2.1 Προϋφισταμένη κατάσταση — χωρίς i18n

Πριν την τρέχουσα πρωτοβουλία, η εφαρμογή ήταν **μονόγλωσση (Αγγλικά)** με hardcoded strings σε JSX. Δεν υπήρχε:

- Locale switcher ή language preference
- Κεντρικό translation store (i18next, next-intl)
- Συστηματική χαρτογράφηση routes → titles

### 2.2 Νέο δίγλωσσο σύστημα (additive bilingual)

Η αρχιτεκτονική επιλέχθηκε ως **additive bilingual** — όχι replacement i18n:

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer                                                   │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │ BilingualText│  │ AppShell    │  │ SideNav          │  │
│  │ (EN · EL)    │  │ resolvePage │  │ getNavLabelEl()  │  │
│  └──────┬───────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                 │                   │             │
│  ┌──────▼─────────────────▼───────────────────▼─────────┐ │
│  │ lib/i18n/                                              │ │
│  │  strings-common.ts  strings-pages.ts  strings-nav.ts   │ │
│  │  format.ts (bilingualAria, bilingualInline)            │ │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │                               │
│  ┌──────────────────────────▼─────────────────────────────┐ │
│  │ page-registry.ts → getPageMeta() + getPageMetaEl()     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Βασικοί αρχές:**

- Το `title` (EN) στο `PAGE_REGISTRY` παραμένει **κανονικό (canonical)**.
- Το `titleEl` προέρχεται από `getPageMetaEl()` στο `strings-pages.ts`.
- Το `BilingualText` εμφανίζει EN και EL **παράλληλα** (inline `·` ή stacked στο sidebar).
- Χρήση `lang` attributes για WCAG 3.1.2 (Language of Parts).

### 2.3 Αρχεία i18n

| Αρχείο | Ρόλος |
|--------|-------|
| `lib/i18n/types.ts` | `BilingualPair`, `PageMetaEl` types |
| `lib/i18n/strings-common.ts` | Shell, auth chrome, κοινές ενέργειες (`commonEn`/`commonEl`) |
| `lib/i18n/strings-pages.ts` | `PAGE_META_EL`, `getPageMetaEl()` — 78 static paths + 5 patterns |
| `lib/i18n/strings-nav.ts` | `NAV_LABEL_EL` (105), sections, tooltips |
| `lib/i18n/format.ts` | `bilingualAria()`, `bilingualInline()`, `fromPair()` |
| `lib/i18n/index.ts` | Re-exports |

### 2.4 Απαιτήσεις dev-stack (PostgreSQL & API)

Για πλήρη λειτουργικό έλεγχο **απαιτείται** εκτέλεση full stack:

```powershell
cd C:\Users\anast\IdeaProjects\CoFounderBay
pnpm dev:stack          # API :3001 + Web :3000 (προτείνεται)
```

| Σενάριο | Αποτέλεσμα |
|---------|------------|
| `pnpm dev:stack` | PostgreSQL + NestJS API + Next.js — πλήρης λειτουργικότητα |
| `pnpm dev:web` μόνο | Offline banner, `ECONNREFUSED` σε API — OK για UI-only |
| Browser | **Μόνο** `http://localhost:3000` — όχι απευθείας `:3001` |
| Μετά schema αλλαγή | `pnpm dev:api:setup` → `pnpm dev:stack` |

**Routing (dev):**

```
Browser → GET /api/*     → Next.js rewrite → http://127.0.0.1:3001/api/*
Browser → ws://localhost:3000/socket.io → rewrite → API Socket.IO
OAuth   → getAbsoluteApiOrigin() → http://localhost:3001 (absolute)
```

---

## 3. Κατάλογος διαδρομών (Routes)

Οι διαδρομές ομαδοποιούνται κατά λειτουργική περιοχή. Για κάθε route: **Title EN** από `page-registry.ts` (ή λογική εξαγωγή), **Title EL** από `strings-pages.ts` / `strings-nav.ts` όπου διαθέσιμο.

**Σύμβολα:** ✅ EL διαθέσιμο · ⚠️ EL μόνο στο nav · ❌ EL εκκρεμεί

### 3.1 Δημόσιο & Αυθεντικοποίηση

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/` | Home | Αρχική | complete | Landing — EL metadata ✅ |
| `/pricing` | Pricing | Τιμολόγηση | complete | EL metadata ✅ |
| `/login` | Sign in | Σύνδεση | complete | Route group `(auth)/login` — ίδιο URL |
| `/register` | Create account | Δημιουργία λογαριασμού | complete | OAuth buttons — inline EN only |
| `/onboarding` | Welcome to CoFounderBay | Καλώς ήρθατε στο CoFounderBay | complete | 3-min setup flow |
| `/forgot-password` | Forgot password | — | scaffold | ❌ EL εκκρεμεί |
| `/reset-password` | Reset password | — | scaffold | ❌ EL εκκρεμεί |
| `/privacy` | Privacy policy | — | scaffold | Legal text — μετάφραση Phase 3 |
| `/terms` | Terms of service | — | scaffold | Legal text — μετάφραση Phase 3 |
| `/auth/oauth-callback` | OAuth callback | — | scaffold | Dev redirect handler |
| `/auth/sso-complete` | SSO complete | — | scaffold | Enterprise SSO flow |
| `/auth/verify-email` | Verify email | — | scaffold | Hardcoded `:3001` ref (μελλοντική ενοποίηση) |

### 3.2 Πίνακας ελέγχου Founder & Build

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/dashboard/founder` | Founder dashboard | Πίνακας ελέγχου founder | complete | Gamification widgets — inline EN |
| `/dashboard` | Dashboard overview | Επισκόπηση | partial | ⚠️ nav EL only |
| `/readiness` | Readiness Score | Readiness Score | complete | Hydration fix εφαρμοσμένο · semantic colors ✅ |
| `/builder` | Startup Builder | Startup Builder | complete | WebSocket via `getSocketOrigin()` |
| `/builder/pitch-deck` | Pitch deck | Pitch deck | complete | Mermaid heavy — cold compile αργό |
| `/builder/applications` | Program applications | Αιτήσεις προγράμματος | complete | EL metadata ✅ |
| `/research` | Research boards | Πίνακες έρευνας | complete | Canvas components — inline EN |
| `/research/[boardId]` | Research canvas | Επιφάνεια έρευνας | complete | Dynamic pattern EL ✅ |
| `/research/canvas` | Research canvas | Επιφάνεια έρευνας | partial | Scaffold variant |
| `/milestones` | Milestones | Ορόσημα | complete | Timeline UI |
| `/milestones/new` | New milestone | — | partial | ❌ EL εκκρεμεί |
| `/projects` | Projects | Έργα | complete | EL metadata ✅ |
| `/projects/[projectId]` | Project detail | — | partial | ❌ EL εκκρεμεί |
| `/projects/create` | Create project | — | partial | ❌ EL εκκρεμεί |
| `/fundraising` | Fundraising | Fundraising | complete | Pipeline view — inline EN |
| `/analytics` | Analytics | Αναλυτικά | partial | ⚠️ nav EL only |

### 3.3 Εξερεύνηση, Δίκτυο & Αναζήτηση

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/matches` | Matches | Αντιστοιχίσεις | complete | Match cards — semantic colors ✅ |
| `/matches/[userId]` | Match detail | Λεπτομέρεια αντιστοίχισης | complete | Dynamic EL ✅ |
| `/matches/compare` | Compare profiles | Σύγκριση προφίλ | partial | EL metadata ✅ · UI partial |
| `/compare` | Compare profiles | Σύγκριση προφίλ | partial | ⚠️ nav EL · duplicate route |
| `/discover` | Explore | Εξερεύνηση | complete | Filter bar — inline EN |
| `/recommendations` | For you | Για εσάς | complete | EL metadata ✅ |
| `/search` | Search | Αναζήτηση | complete | Meilisearch optional fallback |
| `/connections` | Connections | Συνδέσεις | complete | EL metadata ✅ |
| `/shortlist` | Saved profiles | Αποθηκευμένα προφίλ | complete | EL metadata ✅ |
| `/messages` | Messages | Μηνύματα | complete | 14 queries on mount — N+1 risk |
| `/calendar` | Calendar | Ημερολόγιο | complete | EL metadata ✅ |
| `/members` | Members | Μέλη | partial | ⚠️ nav EL only |
| `/profiles/[userId]` | Member profile | Προφίλ μέλους | complete | Dynamic EL ✅ |
| `/p/[username]` | Public profile | — | partial | Vanity URL — ❌ EL |
| `/saved-searches` | Saved searches | Αποθηκευμένες αναζητήσεις | partial | ⚠️ nav EL only |
| `/endorsements` | Endorsements | Συστατικές | partial | ⚠️ nav EL only |
| `/invite` | Invite friends | Πρόσκληση φίλων | partial | ⚠️ nav EL only |
| `/referrals` | Referrals | Παραπομπές | partial | ⚠️ nav EL only |
| `/reputation` | Reputation | Φήμη | partial | ⚠️ nav EL only |

### 3.4 Mentor

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/dashboard/mentor` | Mentor dashboard | Πίνακας ελέγχου mentor | complete | EL metadata ✅ |
| `/mentor/dashboard` | Mentor dashboard | Επισκόπηση | partial | Duplicate path — ⚠️ nav |
| `/mentor/sessions` | My sessions | Οι συνεδρίες μου | complete | EL metadata ✅ |
| `/mentor/requests` | Mentee requests | Αιτήματα mentees | complete | EL metadata ✅ |
| `/mentor/profile-setup` | Mentor setup | Ρύθμιση mentor | complete | Registry path |
| `/mentor/profile` | Mentor profile | Προφίλ mentor | partial | ⚠️ nav EL only |
| `/mentor/availability` | Availability | Διαθεσιμότητα | partial | ⚠️ nav EL only |
| `/mentor/earnings` | Earnings | Αποδοχές | partial | ⚠️ nav EL only |
| `/mentor/mentees` | Mentees | Mentees | partial | ⚠️ nav EL only |
| `/mentor/reviews` | Reviews | Αξιολογήσεις | partial | ⚠️ nav EL only |
| `/mentoring` | Find mentors | Εύρεση mentors | complete | EL metadata ✅ |
| `/coaching` | Coaching | Coaching | partial | ⚠️ nav EL only |

### 3.5 Investor

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/dashboard/investor` | Investor dashboard | Πίνακας ελέγχου επενδυτή | complete | EL metadata ✅ |
| `/investor/dashboard` | Investor dashboard | Επισκόπηση | partial | Duplicate — ⚠️ nav |
| `/investor/scouting` | Scout startups | Αναζήτηση startups | partial | Status partial στο registry |
| `/investor/pipeline` | Pipeline | Pipeline | complete | Kanban deals |
| `/investor/watchlist` | Watchlist | Λίστα παρακολούθησης | partial | ⚠️ nav EL only |
| `/investor/portfolio` | Portfolio | Χαρτοφυλάκιο | partial | ⚠️ nav EL only |
| `/investor/analytics` | Deal analytics | Αναλυτικά deals | partial | ⚠️ nav EL only |
| `/investor/profile-setup` | Investor setup | Ρύθμιση επενδυτή | complete | EL metadata ✅ |
| `/investors` | Investor directory | Κατάλογος επενδυτών | complete | EL metadata ✅ |
| `/data-room/[id]` | Data room | — | partial | ❌ EL εκκρεμεί |
| `/pitch/[id]` | Pitch deck view | — | partial | Public share — ❌ EL |

### 3.6 Provider & Marketplace

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/dashboard/provider` | Provider dashboard | Πίνακας ελέγχου παρόχου | complete | EL metadata ✅ |
| `/provider/dashboard` | Provider dashboard | Επισκόπηση | partial | Duplicate — ⚠️ nav |
| `/provider/listings` | My listings | Οι καταχωρίσεις μου | complete | Registry path |
| `/provider/services` | My services | Οι υπηρεσίες μου | partial | ⚠️ nav EL only |
| `/provider/inquiries` | Inquiries | Αιτήματα | partial | ⚠️ nav EL only |
| `/provider/projects` | Client projects | Έργα πελατών | partial | ⚠️ nav EL only |
| `/provider/reviews` | Reviews | Αξιολογήσεις | partial | ⚠️ nav EL only |
| `/provider/profile` | Provider profile | Προφίλ παρόχου | partial | ⚠️ nav EL only |
| `/provider/analytics` | Provider analytics | Αναλυτικά παρόχου | partial | ⚠️ nav EL only |
| `/marketplace` | Services marketplace | Marketplace υπηρεσιών | complete | EL metadata ✅ |

### 3.7 Οργανισμός (Organization)

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/org/dashboard` | Organization dashboard | Πίνακας ελέγχου οργανισμού | complete | EL metadata ✅ |
| `/org/programs` | Programs | Προγράμματα | complete | EL metadata ✅ |
| `/org/applications` | Applications | Αιτήσεις | complete | EL metadata ✅ |
| `/org/cohorts` | Cohorts | Cohorts | complete | EL metadata ✅ |
| `/org/cohorts/[id]` | Cohort detail | — | partial | ❌ EL εκκρεμεί |
| `/org/startups` | Portfolio Startups | Startups χαρτοφυλακίου | complete | EL metadata ✅ |
| `/org/members` | Team Members | Μέλη ομάδας | complete | EL metadata ✅ |
| `/org/mentors` | Mentor Pool | Δεξαμενή mentors | complete | EL metadata ✅ |
| `/org/events` | Organization Events | Εκδηλώσεις οργανισμού | complete | EL metadata ✅ |
| `/org/analytics` | Org Analytics | Αναλυτικά οργανισμού | complete | EL metadata ✅ |
| `/org/settings` | Organization Settings | Ρυθμίσεις οργανισμού | complete | EL metadata ✅ |
| `/org/[slug]` | Organization public | — | partial | Breadcrumb εκκρεμεί |
| `/org/[slug]/admin` | Org admin | — | scaffold | Role-based visibility |
| `/programs` | Programs | Προγράμματα | partial | ⚠️ nav EL only |

### 3.8 Tenant (White-label)

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/tenant/dashboard` | Tenant dashboard | Πίνακας ελέγχου tenant | complete | EL metadata ✅ |
| `/tenant/branding` | Branding | Branding | complete | EL metadata ✅ |
| `/tenant/sso` | SSO / Authentication | SSO / Αυθεντικοποίηση | complete | EL metadata ✅ |
| `/tenant/domains` | Domain Management | Διαχείριση domain | complete | EL metadata ✅ |
| `/tenant/members` | Tenant Members | Μέλη tenant | complete | EL metadata ✅ |
| `/tenant/programs` | Tenant Programs | Προγράμματα tenant | complete | EL metadata ✅ |
| `/tenant/automation` | Automation | Αυτοματισμός | complete | EL metadata ✅ |
| `/tenant/webhooks` | Webhooks | Webhooks | complete | EL metadata ✅ |
| `/tenant/api-keys` | API Keys | API Keys | complete | EL metadata ✅ |
| `/tenant/billing` | Organization Billing | Τιμολόγηση οργανισμού | complete | EL metadata ✅ |
| `/tenant/analytics` | Tenant Analytics | Αναλυτικά tenant | complete | EL metadata ✅ |
| `/tenant/settings` | Tenant Settings | Ρυθμίσεις tenant | complete | EL metadata ✅ |
| `/t/[slug]` | Tenant landing | — | partial | White-label — ❌ EL |
| `/dashboard/incubator` | Incubator dashboard | — | partial | Tenant programs overview |

### 3.9 Platform Admin

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/admin` | Admin dashboard | Πίνακας ελέγχου διαχειριστή | complete | EL metadata ✅ |
| `/admin/dashboard` | Admin dashboard | Πίνακας ελέγχου διαχειριστή | complete | Duplicate entry point |
| `/admin/users` | Users | Χρήστες | complete | EL metadata ✅ |
| `/admin/user-management` | User management | Διαχείριση χρηστών | complete | EL metadata ✅ |
| `/admin/user-detail/[id]` | User detail | Λεπτομέρεια χρήστη | complete | Dynamic EL ✅ |
| `/admin/analytics` | Global analytics | Παγκόσμια αναλυτικά | complete | EL metadata ✅ |
| `/admin/content-moderation` | Content moderation | Μέτρηση περιεχομένου | complete | EL metadata ✅ |
| `/admin/security-monitoring` | Security monitoring | Παρακολούθηση ασφάλειας | complete | EL metadata ✅ |
| `/admin/community-management` | Community management | Διαχείριση κοινότητας | complete | EL metadata ✅ |
| `/admin/mentorship-management` | Mentorship management | Διαχείριση mentoring | complete | EL metadata ✅ |
| `/admin/system-settings` | System settings | Ρυθμίσεις συστήματος | complete | EL metadata ✅ |
| `/admin/audit-log` | Audit log | Αρχείο ελέγχου | partial | ⚠️ nav EL only |
| `/admin/automations` | Automations | Αυτοματισμοί | partial | ⚠️ nav EL only |
| `/admin/billing` | Billing | Τιμολόγηση | partial | ⚠️ nav EL only |
| `/admin/communities` | Communities | Κοινότητες | partial | ⚠️ nav EL only |
| `/admin/domains` | Domains | Domains | partial | ⚠️ nav EL only |
| `/admin/feature-flags` | Feature flags | Feature flags | partial | ⚠️ nav EL only |
| `/admin/programs` | Programs | Προγράμματα | partial | ⚠️ nav EL only |
| `/admin/reports` | Reports | Αναφορές | partial | ⚠️ nav EL only |
| `/admin/sso` | SSO | SSO | partial | ⚠️ nav EL only |
| `/admin/taxonomy` | Taxonomy | Ταξινομία | partial | ⚠️ nav EL only |
| `/admin/tenants` | Tenants | Tenants | partial | ⚠️ nav EL only |

### 3.10 Λογαριασμός, Ρυθμίσεις & Πόροι

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/profile` | My Profile | Το προφίλ μου | complete | EL metadata ✅ |
| `/profile/edit` | Edit profile | Επεξεργασία προφίλ | partial | Status partial · inline EN |
| `/settings` | Settings | Ρυθμίσεις | complete | EL metadata ✅ |
| `/settings/billing` | Billing | Τιμολόγηση | partial | ⚠️ nav EL only |
| `/settings/notifications` | Notification preferences | Προτιμήσεις ειδοποιήσεων | partial | ⚠️ nav EL only |
| `/settings/data-export` | Data export | Εξαγωγή δεδομένων | partial | ⚠️ nav EL only |
| `/settings/ai` | AI settings | — | partial | ❌ EL εκκρεμεί |
| `/notifications` | Notifications | Ειδοποιήσεις | complete | EL metadata ✅ |
| `/achievements` | Achievements | Επιτεύγματα | complete | EL metadata ✅ |
| `/help` | Help & support | Βοήθεια και υποστήριξη | complete | EL metadata ✅ |
| `/activity` | Activity | Δραστηριότητα | partial | ⚠️ nav EL only |
| `/jobs` | Jobs & roles | Θέσεις εργασίας | complete | EL metadata ✅ |
| `/opportunities` | Opportunities | Ευκαιρίες | complete | EL metadata ✅ |
| `/events` | Events | Εκδηλώσεις | complete | EL metadata ✅ |
| `/events/create` | Create event | — | partial | ❌ EL εκκρεμεί |
| `/learning` | Learning hub | Κέντρο μάθησης | complete | EL metadata ✅ |
| `/expert-reviews` | Expert reviews | Αξιολογήσεις ειδικών | partial | Semantic colors ✅ |
| `/feed` | Feed | Ροή | partial | ⚠️ nav EL only |
| `/posts` | Feed | Feed | complete | Registry · EL metadata ✅ |

### 3.11 Κοινότητα & Ομάδες

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/groups` | Communities | Κοινότητες | complete | EL metadata ✅ |
| `/groups/[groupId]` | Community | Κοινότητα | complete | Dynamic EL ✅ |
| `/groups/manage` | Manage groups | — | partial | ❌ EL εκκρεμεί |
| `/groups/moderation` | Group moderation | — | partial | Moderation queue |

### 3.12 Utility, Dev & Share

| Path | Title EN | Title EL | Status | Κρίσιμα ευρήματα |
|------|----------|----------|--------|------------------|
| `/demo` | Demo mode | — | scaffold | Dev/demo only |
| `/api-status` | API status | — | scaffold | Hardcoded `:3001` ref |
| `/test-onboarding` | Test onboarding | — | scaffold | Dev only |
| `/share/[token]` | Shared content | — | scaffold | Public share links |
| `/themes/alliance` | Alliance theme | — | scaffold | Theme preview |

### 3.13 Σύνοψη κατάστασης routes

| Status | Αριθμός (εκτίμηση) | Ποσοστό |
|--------|-------------------|---------|
| `complete` (EL page metadata) | ~79 | ~51% |
| `partial` (nav EL ή ελλιπές inline) | ~65 | ~42% |
| `scaffold` (dev/legal χωρίς EL) | ~10 | ~7% |

---

## 4. Κατάλογος components

Σύνολο: **189** `.tsx` αρχεία σε **37** φακέλους. Audit notes ανά κατηγορία.

### 4.1 `layout/` (13 components)

| Component | Audit notes |
|-----------|-------------|
| `AppShell` | ✅ `BilingualText` για skip link, demo banner, page title/description · `resolvePageHeader()` |
| `SideNav` | ✅ `getNavLabelEl()`, `getNavSectionEl()`, stacked `BilingualText` |
| `ModeSwitcher` | ✅ Bilingual mode labels |
| `TopBar` | ⚠️ Μερικά inline EN labels |
| `NotificationsBell` | ✅ `useApiAvailability()` gating · EL εκκρεμεί στα toast |
| `MobileBottomNav` | ⚠️ Inline EN — χρειάζεται nav EL integration |
| `GlobalFloatingUi` | ⚠️ Chat popup — inline EN |
| `SidebarContext` | — Logic only |
| `RoleSwitcher` | ⚠️ Hardcoded semantic colors |
| `OfflineIndicator` | ⚠️ Hardcoded colors · EL εκκρεμεί |

### 4.2 `ui/` (28 components)

| Κατηγορία | Audit notes |
|-----------|-------------|
| Primitives (button, card, badge, avatar) | shadcn/ui — χωρίς text |
| `toast`, `skeleton`, `progress` | Generic — OK |
| `enhanced-card`, `share-modal`, `export-dialog` | ⚠️ Inline EN strings |
| Form controls | ⚠️ Placeholders EN only |

**Συνολική αξιολόγηση:** Design system σταθερό · i18n δεν απαιτείται σε primitives · dialogs χρειάζονται `BilingualText`.

### 4.3 `common/` (33 components)

| Component | Audit notes |
|-----------|-------------|
| `BilingualText` | ✅ Core i18n component — `lang` attributes, stacked mode |
| `EmptyStates` | ⚠️ CTA labels inline EN |
| `HelpCallout` | ⚠️ Help content EN only |
| `PageContextualHelp` | ⚠️ Registry helpId — content EN |
| `MatchCard`, `StatCard` | Semantic colors ✅ · labels EN |
| `CommandPalette` | ⚠️ Search suggestions EN |
| `ConnectionRequest` | ⚠️ Inline EN |
| `ProfileCompletion` | ⚠️ Inline EN |

### 4.4 `builder/` (15 components)

| Component | Audit notes |
|-----------|-------------|
| `BuilderWorkspace` | WebSocket via unified origin · heavy cold compile |
| `PitchDeckBuilder` | Mermaid — dynamic import recommended |
| `CollabToolbar`, `ReviewPanel` | ⚠️ Hardcoded `text-emerald-*` colors |
| `ArtifactDiffView` | ⚠️ Semantic colors pending |
| `ReadinessScoring`, `FinancialPlanning` | ⚠️ Inline EN + colors |
| `ActivityTimeline`, `VersionHistoryDrawer` | Inline EN |
| `BranchPanel` | Inline EN |

### 4.5 `research/` (28 components)

| Component | Audit notes |
|-----------|-------------|
| `ResearchCanvas`, `WhiteboardNode` | Canvas performance — heavy mount |
| `MermaidDiagramNode` | Cold compile impact |
| `CanvasCopilotPanel`, `AIAnalysisPanel` | AI strings EN only |
| `CommentsPanel`, `BoardHistoryDrawer` | Inline EN |
| `PdfAnnotationViewer` | Complex — a11y review needed |
| `RichTextEditor` | User content — no translation |

### 4.6 `admin/` (4 components)

| Component | Audit notes |
|-----------|-------------|
| `AdminAnalyticsDashboard` | Charts — inline EN labels |
| `AbuseMonitorPanel`, `ScoreInspector` | Admin-only · EN |
| `ExperimentationPanel` | Feature flags — EN |

### 4.7 `gamification/` (9 components)

| Component | Audit notes |
|-----------|-------------|
| `VentureReadinessCard` | Semantic colors ✅ |
| `XPProgressWidget`, `BadgesWidget` | Inline EN |
| `OnboardingChecklist` | Inline EN — high priority για EL |
| `NextActionBanner` | Inline EN |
| `ReputationSystem` | Inline EN |

### 4.8 `providers/` (4 components)

| Component | Audit notes |
|-----------|-------------|
| `QueryProvider` | React Query staleTime 5m ✅ |
| `ApiHealthProbe` | Circuit breaker integration |
| `TenantContext` | Tenant branding — dynamic content |
| `PostHogProvider` | Analytics — no i18n impact |

### 4.9 Άλλοι φάκελοι

| Φάκελος | Αριθμός | Audit notes |
|---------|---------|-------------|
| `ai/` (3) | AI insight buttons — EN prompts |
| `auth/` (4) | OAuth labels — EL εκκρεμεί |
| `chat/` (1) | UnifiedChatPopup — inline EN |
| `discover/` (2) | ProfileCard — inline EN |
| `messages/` (2) | Messaging UI — inline EN |
| `messaging/` (3) | Thread components — inline EN |
| `notifications/` (1) | NotificationCenter — socket origin fixed |
| `video/` (3) | VideoCall — WebRTC labels EN |
| `behavioral/` (2) | Nudge system — EN |
| `canvas/` (1) | ResearchCanvas wrapper |
| `dashboard/` (8) | Role-specific widgets — inline EN |
| `members/` (2) | Member list — semantic colors ✅ |
| `settings/` (1) | LinkedAccounts — inline EN |
| `theme/` (1) | ThemeSwitcher — OK |
| `workspace/` (3) | Workspace panels — inline EN |
| `activity/` (1) | Activity feed — inline EN |
| `analytics/` (1) | Charts — inline EN |
| `billing/` (1) | Billing UI — inline EN |
| `brand/` (1) | Brand assets |
| `charts/` (1) | Recharts wrapper |
| `collaboration/` (1) | Collab features |
| `endorsements/` (1) | Endorsement UI |
| `events/` (1) | Event cards |
| `feed/` (2) | Feed components |
| `mentoring/` (1) | Mentor directory |
| `optimization/` (1) | Performance hints |
| `profile/` (1) | Profile sections |
| `recommendations/` (1) | Recommendation cards |
| `search/` (1) | Search UI |
| `shared/` (1) | Shared utilities |
| `social/` (2) | Social features |

---

## 5. Γνωστά σφάλματα & ασυμβατότητες

### 5.1 401 Stale Session

| Περιγραφή | Λεπτομέρειες |
|-----------|-------------|
| **Συμπτώματα** | Αιτήματα API επιστρέφουν 401 μετά από idle · redirect loops σε edge cases |
| **Αιτία** | Expired access token · refresh cookie flow |
| **Τρέχουσα λύση** | `refreshAccessToken` στο `api.ts` — envelope unwrap ✅ |
| **Εκκρεμότητα** | Stale session UX — bilingual error message εκκρεμεί |
| **Αντιμετώπιση dev** | Re-login · clear cookies · `pnpm dev:stack` |

### 5.2 ECONNREFUSED χωρίς PostgreSQL/API

| Περιγραφή | Λεπτομέρειες |
|-----------|-------------|
| **Συμπτώματα** | `ERR_CONNECTION_REFUSED :3001` · offline banner |
| **Αιτία** | `pnpm dev:web` χωρίς API · ή `.env.local` με `NEXT_PUBLIC_API_URL=http://localhost:3001` |
| **Διόρθωση** | Αφαίρεση URL από `.env.local` · proxy priority στο `api-origin.ts` |
| **Αναμενόμενο** | Offline banner OK για UI-only dev |

### 5.3 useEffect Dependencies

| Περιγραφή | Λεπτομέρειες |
|-----------|-------------|
| **Συμπτώματα** | Double fetch on mount · StrictMode warnings |
| **Αιτία** | Missing/unstable deps σε hooks |
| **Περιοχές** | Socket hooks, notification polling, builder state |
| **Μετριασμός** | Idempotent connect/disconnect · React Query caching |

### 5.4 WebSocket Storms

| Περιγραφή | Λεπτομέρειες |
|-----------|-------------|
| **Συμπτώματα** | Πολλαπλές socket connections · console flood |
| **Αιτία (παλαιό)** | Hardcoded `:3001` σε `useBuilderSocket`, `NotificationCenter` |
| **Διόρθωση** | `getSocketOrigin()` / `getNativeWebSocketOrigin()` |
| **Εκκρεμότητα** | StrictMode double mount — partial mitigation |

### 5.5 N+1 Queries

| Περιγραφή | Λεπτομέρειες |
|-----------|-------------|
| **Συμπτώματα** | Αργό mount σε `/messages` (14 queries) |
| **Αιτία** | Separate fetches per conversation |
| **Μετριασμός** | React Query `staleTime: 5m` · `useApiAvailability()` gating |
| **Backend fix** | Eager-load conversations + last message σε 1 query (Sprint 1) |

### 5.6 Hydration Mismatch

| Route | Διόρθωση |
|-------|---------|
| `/readiness` | Ίδιο `AppShell` structure σε loading & loaded states ✅ |

### 5.7 Hardcoded `localhost:3001` (μελλοντική ενοποίηση)

Αρχεία: `app/t/[slug]/layout.tsx`, `app/org/[slug]/page.tsx`, `app/profiles/[userId]/page.tsx`, `app/auth/verify-email/page.tsx`, `app/api-status/page.tsx`, `app/test-onboarding/page.tsx`

---

## 6. Κάλυψη μετάφρασης

### 6.1 Ολοκληρωμένα (Done)

| Στρώμα | Κάλυψη | Αρχείο |
|--------|--------|--------|
| Page metadata (titles/descriptions) | **79 routes** + 5 dynamic patterns | `strings-pages.ts` |
| Navigation labels | **105 links** | `NAV_LABEL_EL` |
| Navigation sections | **26 sections** | `NAV_SECTION_EL` |
| Navigation tooltips | **~50 descriptions** | `NAV_DESCRIPTION_EL` |
| Sidebar modes | 3 modes | `SIDEBAR_MODE_EL` |
| Shell common strings | **24 keys** | `COMMON_STRINGS` |
| Shell integration | AppShell, SideNav, ModeSwitcher | `BilingualText` |

### 6.2 Εκκρεμή (Pending)

| Στρώμα | Εκτίμηση | Προτεραιότητα |
|--------|----------|---------------|
| Inline page content | ~2.500 strings | High |
| Component labels (buttons, empty states) | ~800 strings | High |
| Form placeholders & validation | ~400 strings | Medium |
| Help content & contextual help | ~200 strings | Medium |
| Admin/tooling labels | ~300 strings | Low |
| Legal (privacy, terms) | ~100 strings | Phase 3 |
| Email templates (backend) | Out of web scope | Phase 4 |

**Συνολική εκτίμηση εκκρεμών:** ~3.800 inline strings (~95% του UI text).

### 6.3 Μετρήσεις κάλυψης

```
Κεντρικά i18n strings:     ~210 entries (pages + nav + common)
Inline UI strings:         ~4.000 (εκτίμηση)
Κάλυψη metadata layer:     ~100% των PAGE_REGISTRY routes
Κάλυψη nav layer:          ~100% των nav-modes links
Κάλυψη inline UI:          ~5% (shell μόνο)
```

### 6.4 Στρατηγική μετάφρασης

1. **Domain terms** — διατήρηση EN όπου διεθνής (founder, pipeline, milestone).
2. **Περιγραφικό κείμενο** — πλήρης ελληνική απόδοση.
3. **Bilingual display** — πάντα EN πρώτο, EL δεύτερο.
4. **Όχι locale switch** — simultaneous display, όχι toggle.

---

## 7. Γλωσσάριο όρων EN→EL

Κατάλογος **50+ όρων** για συνέπεια μεταφράσεων. Όπου ο όρος είναι διεθνής στο startup οικοσύστημα, η ελληνική απόδοση **συμπληρώνει** και δεν αντικαθιστά.

| English (EN) | Ελληνικά (EL) | Σημείωση |
|--------------|---------------|----------|
| founder | συνιδρυτής / founder | Διατήρηση «founder» σε nav |
| co-founder | συνιδρυτής | |
| startup | startup | Διεθνής όρος |
| mentor | mentor | Διεθνής όρος |
| mentee | mentee | |
| investor | επενδυτής | |
| angel | angel investor | |
| VC | VC (venture capital) | |
| readiness | ετοιμότητα | Readiness Score — hybrid |
| readiness score | βαθμολογία ετοιμότητας | |
| pipeline | pipeline | Deal/investor pipeline |
| milestone | ορόσημο | |
| traction | traction | |
| pitch | pitch | |
| pitch deck | pitch deck | |
| term sheet | term sheet | |
| data room | data room | |
| deal flow | ροή deals / ροή συμφωνιών | |
| scouting | αναζήτηση (startups) | |
| watchlist | λίστα παρακολούθησης | |
| portfolio | χαρτοφυλάκιο | |
| cohort | cohort | |
| accelerator | accelerator | |
| incubator | incubator | |
| bootcamp | bootcamp | |
| demo day | demo day | |
| office hours | office hours | |
| application | αίτηση | |
| grant | επιχορήγηση | |
| fundraising | fundraising / χρηματοδότηση | |
| round | γύρος (χρηματοδότησης) | |
| equity | equity / μετοχικό κεφάλαιο | |
| cap table | cap table | |
| valuation | αποτίμηση | |
| match | αντιστοίχιση | |
| compatibility | συμβατότητα | |
| connection | σύνδεση | |
| shortlist | shortlist / αποθηκευμένα | |
| endorsement | συστατική / έγκριση δεξιότητας | |
| reputation | φήμη | |
| achievement | επίτευγμα | |
| badge | σήμα (badge) | |
| workspace | χώρος εργασίας | |
| tenant | tenant | White-label |
| white-label | white-label | |
| SSO | SSO (ενιαία σύνδεση) | |
| SAML | SAML | |
| OIDC | OIDC | |
| webhook | webhook | |
| API key | API key | |
| automation | αυτοματισμός | |
| moderation | μέτρηση περιεχομένου | |
| audit log | αρχείο ελέγχου | |
| feature flag | feature flag | |
| taxonomy | ταξινομία | |
| marketplace | marketplace | |
| service provider | πάροχος υπηρεσιών | |
| inquiry | αίτημα / ερώτημα | |
| session | συνεδρία | Mentoring session |
| availability | διαθεσιμότητα | |
| calendar | ημερολόγιο | |
| notification | ειδοποίηση | |
| feed | feed / ροή | |
| community | κοινότητα | |
| group | ομάδα | |
| onboarding | onboarding / εισαγωγή | |
| dashboard | πίνακας ελέγχου | |
| analytics | αναλυτικά | |
| engagement | engagement / δέσμευση | |
| KPI | KPI | |
| empty state | κενή κατάσταση | UX term |
| scaffold | scaffold / δομή | Dev term |

---

## 8. Σχέδιο φάσεων (Sprint 0–4)

Στόχος: **πλήρης δίγλωσση κάλυψη** χωρίς αφαίρεση Αγγλικών.

### Sprint 0 — Σταθερότητα & Βάση i18n (✅ Ολοκληρωμένο)

- [x] `dev:stack` / `dev-api` fix
- [x] API proxy + `.env.local` cleanup
- [x] Hydration readiness fix
- [x] Socket/API origin unification (μερικό)
- [x] `BilingualText` component
- [x] `strings-pages.ts` — 79 routes
- [x] `strings-nav.ts` — 105 links
- [x] `strings-common.ts` — shell strings
- [x] AppShell + SideNav integration

### Sprint 1 — Navigation & Metadata Extension (1–2 εβδομάδες)

- [ ] Επέκταση `PAGE_REGISTRY` για 75 routes εκτός registry
- [ ] `PAGE_META_EL` για routes με nav-only EL
- [ ] MobileBottomNav bilingual labels
- [ ] TopBar + RoleSwitcher EL
- [ ] SideNav link prefetch top-10 routes
- [ ] Backend: optimize `listConversations` (N+1)
- [ ] Migrate `localhost:3001` refs → `api-origin.ts`

### Sprint 2 — High-traffic Pages (2–3 εβδομάδες)

- [ ] `strings-dashboard.ts` — founder/mentor/investor widgets
- [ ] `strings-matches.ts` — match cards, filters, empty states
- [ ] `strings-messages.ts` — messaging UI
- [ ] `strings-builder.ts` — builder panels (incremental)
- [ ] EmptyStates + HelpCallout bilingual
- [ ] Semantic colors batch 6 (builder sub-components)

### Sprint 3 — Forms, Auth & Community (2–3 εβδομάδες)

- [ ] `strings-auth.ts` — login, register, OAuth, forgot password
- [ ] `strings-profile.ts` — profile edit, settings
- [ ] `strings-community.ts` — groups, posts, events
- [ ] Form validation messages bilingual
- [ ] Legal pages (privacy, terms) — professional translation
- [ ] Onboarding flow full bilingual

### Sprint 4 — Admin, Polish & Quality Gates (ongoing)

- [ ] `strings-admin.ts` — admin panels
- [ ] `strings-tenant.ts` — tenant admin
- [ ] Error messages bilingual (401, 403, 500)
- [ ] E2E smoke Playwright — bilingual assertions
- [ ] Lighthouse CI on key routes
- [ ] Documentation + glossary maintenance
- [ ] CI check: missing EL warning for new `PAGE_REGISTRY` entries

---

## 9. Οδηγίες για developers

### 9.1 Χρήση `BilingualText`

```tsx
import { BilingualText } from '@/components/common/BilingualText';

// Inline mode (default): "Matches · Αντιστοιχίσεις"
<BilingualText en="Matches" el="Αντιστοιχίσεις" />

// Stacked mode (sidebar): EN on top, EL below
<BilingualText
  en="Startup Builder"
  el="Startup Builder"
  stacked
  primaryClassName="text-sm font-medium"
/>

// Χωρίς EL — εμφανίζει μόνο EN
<BilingualText en="Save" />
```

**Κανόνες:**

- Ποτέ αντικατάσταση EN με EL.
- Χρήση `stacked` σε περιορισμένο χώρο (sidebar, mobile nav).
- `lang="en"` / `lang="el"` — automatic από component.

### 9.2 `commonEn` / `commonEl`

```tsx
import { commonEn, commonEl } from '@/lib/i18n/strings-common';

<button>
  <BilingualText
    en={commonEn('save')}
    el={commonEl('save')}
  />
</button>
```

Για νέα κοινή string: πρόσθεσε entry στο `COMMON_STRINGS` με `{ en, el }`.

### 9.3 `getPageMetaEl` και page registry

```tsx
import { getPageMeta } from '@/lib/page-registry';

// Σε AppShell — automatic via resolvePageHeader()
const meta = getPageMeta('/matches');
// meta.title = "Matches" (EN)
// meta.titleEl = "Αντιστοιχίσεις" (EL από strings-pages)
```

Για νέα route:

1. Πρόσθεσε entry στο `PAGE_REGISTRY` (`page-registry.ts`) με `title`, `description` (EN).
2. Πρόσθεσε αντίστοιχο entry στο `PAGE_META_EL` (`strings-pages.ts`).
3. Αν dynamic route: πρόσθεσε pattern στο `PAGE_META_EL_PATTERNS`.

### 9.4 Navigation labels

```tsx
import { getNavLabelEl, getNavSectionEl } from '@/lib/i18n/strings-nav';

const labelEl = getNavLabelEl('/matches'); // "Αντιστοιχίσεις"
const sectionEl = getNavSectionEl('Explore'); // "Εξερεύνηση"
```

### 9.5 `bilingualAria` για accessibility

```tsx
import { bilingualAria } from '@/lib/i18n/format';

<button aria-label={bilingualAria('Close', 'Κλείσιμο')}>
  <X />
</button>
// Screen reader: "Close. Κλείσιμο"
```

### 9.6 Checklist για νέο component

- [ ] User-visible text → `BilingualText` ή centralized strings
- [ ] Νέα route → `PAGE_REGISTRY` + `PAGE_META_EL`
- [ ] Nav link → `NAV_LABEL_EL` + optional `NAV_DESCRIPTION_EL`
- [ ] aria-labels → `bilingualAria()`
- [ ] Μη μετάφραση: user-generated content, API data, code identifiers

---

## 10. Συναφή έγγραφα

| Έγγραφο | Περιγραφή |
|---------|-----------|
| `docs/COFOUNDERBAY_AUDIT_AND_UPGRADE_PLAN.md` | Γενικό audit — performance, UX, backend |
| `apps/web/src/lib/page-registry.ts` | Canonical EN page metadata |
| `apps/web/src/lib/i18n/strings-pages.ts` | Greek page metadata |
| `apps/web/src/lib/i18n/strings-nav.ts` | Greek navigation |
| `apps/web/src/lib/i18n/strings-common.ts` | Shell common strings |
| `apps/web/src/components/common/BilingualText.tsx` | Core bilingual component |

---

## Μεταδεδομένα εγγράφου

| Πεδίο | Τιμή |
|-------|------|
| Έκδοση | 1.0.0 |
| Συγγραφέας | CoFounderBay Engineering |
| Τελευταία ενημέρωση | Ιούνιος 2026 |
| Επόμενη αναθεώρηση | Μετά Sprint 1 completion |

---

*Τέλος εγγράφου — Πλακιάρικος Έλεγχος & Ελληνική Γλώσσα v1.0.0*
