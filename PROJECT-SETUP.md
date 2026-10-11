# CoFounderBay — Επιλογές τεχνολογίας & επόμενα βήματα

Αυτό το έγγραφο συνοψίζει τις **βέλτιστες επιλογές** για την πλατφόρμα και τις **προτάσεις υλοποίησης** βήμα-βήμα, με γνώμονα σταθερότητα, ασφάλεια και μακροπρόθεσμη συντήρηση.

---

## 1. Scope που κλειδώσαμε (αρχικά)

- **MVP: Web-only.** Το mobile (React Native/Expo) μπορεί να προστεθεί αφού σταθεροποιηθεί το web και το API, ώστε να μην διπλασιάζονται τα bugs και να επαναχρησιμοποιείται το ίδιο backend.
- **Monorepo:** ένα repo, ξεκάθαρη δομή `apps/` + `packages/`, ώστε types και schemas να μοιράζονται και να μην υπάρχουν ασυμφωνίες API/frontend.

---

## 2. Stack (καθυστερημένα επιλογές)

| Σκοπός | Επιλογή | Σύντομη αιτιολόγηση |
|--------|---------|----------------------|
| **Monorepo** | pnpm + Turborepo | Γρήγορα builds, σαφής dependency graph, workspace packages χωρίς publish. |
| **Frontend** | Next.js 15 (App Router) + TypeScript | SSR/SSG, API routes αν χρειαστεί, Server Components, οικοσύστημα React 19. |
| **Backend** | NestJS + TypeScript | Modularity, DI, guards/pipes, εύκολο auth + RBAC, WebSockets, queues. |
| **Database** | PostgreSQL | ACID, JSONB, full-text αργότερα, mature ecosystem. |
| **ORM** | Prisma | Type-safe, migrations, εύκολο schema evolution. |
| **Cache / Rate limit / Sessions** | Redis | Sessions, rate limiting, BullMQ για jobs. |
| **Search** | Meilisearch | Γρήγορο setup, typo tolerance, filters, αρκετό για MVP/V1. |
| **Jobs** | BullMQ (Redis) | Event-driven indexing, recommendations, emails — consistent με Redis. |
| **Storage (αργότερα)** | S3-compatible (AWS S3 / R2) | Signed URLs, ασφάλεια αρχείων. |
| **Real-time** | WebSockets (NestJS gateway) ή Ably/Pusher | MVP: optional· V1: 1:1 messaging με typing/read. |
| **Auth** | Custom (JWT access + refresh, Redis sessions) | Έλεγχος MFA, device/session management, revocation. |

**Γιατί όχι Supabase/Firebase για backend;**  
Για μέγιστη ευελιξία, RBAC, event-driven jobs και καθαρό separation of concerns, το NestJS + Postgres δίνει πλήρη έλεγχο και ευκολότερη μελλοντική κλιμάκωση (multi-tenant, compliance, custom workflows).

---

## 3. Ασφάλεια (by design)

- **Passwords:** Argon2id (μέσω NestJS/Passport ή dedicated lib).
- **MFA:** TOTP (architect-ready από την αρχή, optional στο MVP).
- **RBAC:** Roles (Admin / Partner / User) + permissions πάνω σε resources.
- **ABAC:** Privacy rules ανά πεδίο (π.χ. email ορατό μόνο μετά mutual accept).
- **Rate limiting:** Login, signup, messaging, search (Redis-based).
- **HTTP:** HTTPS only, HTTP-only cookies, CSP, CSRF protection.
- **Ευαίσθητα πεδία:** Encryption at rest (DB) + optional field-level για τηλέφωνο κ.λπ.
- **Audit logs:** Για admin actions και κρίσιμες αλλαγές.
- **GDPR:** Consent, data export, delete account, retention policy.

Όλα αυτά να μπουν σταδιακά αλλά να προβλέπονται στη δομή (modules, guards, decorators).

---

## 4. Ροή δεδομένων & συγχρονισμός

- **Source of truth:** PostgreSQL (Prisma). Όλα τα “κανονικά” δεδομένα από εκεί.
- **Search:** Meilisearch index = derived· ενημερώνεται με jobs μετά αλλαγές (ProfileUpdated → UpdateSearchIndex).
- **Cache:** Redis = derived (sessions, rate limits, optional response cache).
- **Jobs:** BullMQ· όταν αλλάζει κάτι (profile, report, event), να μπαίνει job για indexing / recommendations / notifications· προτίμηση για **outbox pattern** (ή transactional enqueue) ώστε DB write + event να είναι consistent.

Έτσι αποφεύγονται ασυμφωνίες και “ξεχασμένα” updates ανάμεσα σε DB, search και cache.

---

## 5. Επόμενα 3 βήματα (με τη σειρά)

### Βήμα 1 — Auth & core user

- **API:** Auth module (register, login, refresh, logout).
  - Password hashing με Argon2id.
  - JWT access (μικρό TTL) + refresh token (αποθήκευση σε Redis, optional per-device).
  - Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
- **Prisma:** Επεκτείνουμε το `User` (passwordHash, role, emailVerified, κ.λπ.) + πιθανό `RefreshToken` ή session store σε Redis μόνο.
- **Web:** Σελίδες login/register (μόνο UI + κλήσεις API)· δεν απαιτείται ακόμα NextAuth, μπορούμε custom fetch με httpOnly cookies ή Authorization header.

### Βήμα 2 — Profiles & onboarding

- **Prisma:** `Profile` (1-1 με User), role-specific fields (founder/mentor/investor), skills, visibility/privacy.
- **API:** Profile module (CRUD, validation με Zod από `@cofounderbay/shared`).
- **Web:** Onboarding wizard ανά ρόλο + προβολή/επεξεργασία προφίλ.
- **Jobs:** Μετά ενημέρωση προφίλ → job για Meilisearch indexing (έτοιμο pipeline, ακόμα και αν το index προστεθεί αμέσως μετά).

### Βήμα 3 — Search & recommendations (rules-based)

- **Meilisearch:** Index “profiles” με φίλτρα (role, skills, industry, location, κ.λπ.).
- **API:** Search module (proxy ή direct Meilisearch client) με φίλτρα, pagination, ranking.
- **Recommendations:** Rules-based “suggested co-founders/mentors/investors” (π.χ. ίδιο role gap, ίδιο domain)· αργότερα ML.
- **Web:** Σελίδα discovery με φίλτρα και λίστα results.

Μετά από αυτά: **messaging (1:1)**, **notifications**, **events/RSVP**, **admin panel**, κ.λπ., πάντα με event-driven jobs όπου αλλάζουν δεδομένα που επηρεάζουν search/cache/notifications.

---

## 6. Προτάσεις υλοποίησης (συνοπτικά)

1. **Κρατήστε ένα “source of truth” πάντα.** Οποιοδήποτε derived system (search, cache) να τρέχει μέσω jobs/events, όχι direct writes από πολλά σημεία.
2. **Shared types & Zod στο `@cofounderbay/shared`.** Κάθε DTO/validation schema να ορίζεται μία φορά και να χρησιμοποιείται από API και (όπου έχει νόημα) από web.
3. **API versioning από την αρχή.** Π.χ. `/v1/` prefix ώστε μελλοντικές αλλαγές να μην σπάνε clients.
4. **Health checks.** `/health` στο API (DB + Redis connectivity) για Docker/orchestration και monitoring.
5. **Observability νωρίς.** OpenTelemetry + Sentry (ή αντίστοιχα) να μπουν στο skeleton ώστε να μην “κολλούμε” μετά.
6. **Feature flags.** Απλό module (DB ή env) για experiments και gradual rollout χωρίς redeploys.

Αν συμφωνείς με αυτά τα βήματα, το επόμενο concrete step είναι το **Βήμα 1 (Auth & core user)**: Prisma schema για User/sessions, NestJS Auth module, και απλά login/register pages στο Next.js.

---

## 7. Τρέξιμο του project (CoFounderBay — όχι Alliance)

**Σημαντικό:** Αυτό το project είναι **CoFounderBay** (Next.js + NestJS API). Το theme **Alliance** (alliance.themerex.net) είναι άλλο project (WordPress/BuddyPress). Μην συγχέουμε Alias/Alliance με το CoFounderBay stack.

Για να μην εμφανίζονται **`POST .../api/v1/auth/login net::ERR_CONNECTION_REFUSED`** (ή παρόμοια):

- Αυτό **δεν** είναι bug στο login flow ή στον κώδικα που εφαρμόστηκε. Σημαίνει ότι το **NestJS API δεν είναι προσβάσιμο** στη διεύθυνση που χρησιμοποιεί το frontend (`NEXT_PUBLIC_API_URL`).

**Checklist:**

0. **Πριν την πρώτη εκτέλεση:**
   - `npm install` στο root του project
   - Για το API: PostgreSQL πρέπει να τρέχει στο `localhost:5432`
   - Σωστή εντολή: `npm run dev:api` (χωρίς κενό — όχι `dev: api`)

1. **Τρέξε το API** (πρώτο terminal):
   ```bash
   npm run dev:api
   ```
   Το API τρέχει στο port **3001** (ή τι δίνει το `API_PORT` στο `.env`). Πρέπει να βλέπεις ότι ο server ακούει (π.χ. "Nest application successfully started").

2. **Τρέξε το web** (δεύτερο terminal):
   ```bash
   npm run dev:web
   ```

3. **Environment:** Το `apps/web` καλεί το API μέσω `NEXT_PUBLIC_API_URL`.
   - Αν έχεις `NEXT_PUBLIC_API_URL=http://192.168.1.2:3001`: το API πρέπει να τρέχει στο **ίδιο** μηχάνημα (192.168.1.2) και να δέχεται συνδέσεις (π.χ. listen στο `0.0.0.0`, όχι μόνο `localhost`). Αλλιώς θα πάρεις `ERR_CONNECTION_REFUSED`.
   - Για **ανάπτυξη μόνο στο ίδιο PC** (browser και API στο ίδιο μηχάνημα), βάλε στο `apps/web/.env.local`:
     ```env
     NEXT_PUBLIC_API_URL=http://localhost:3001
     ```
     και κάνε restart το `npm run dev:web`.

4. **CORS:** Αν εμφανίζεται **"blocked by CORS policy: No 'Access-Control-Allow-Origin' header"** στο login (ή σε άλλα API calls):
   - Το NestJS API ρυθμίζει CORS στο `apps/api/src/main.ts`. Αν το `CORS_ORIGIN` δεν είναι ορισμένο (ή η λίστα είναι κενή), χρησιμοποιούνται defaults: `localhost:3000`, `localhost:3002`, `192.168.1.2:3000`, `192.168.1.2:3002` (και 127.0.0.1).
   - Βεβαιώσου ότι το **origin** από το οποίο ανοίγεις το web (π.χ. `http://192.168.1.2:3000`) ανήκει σε αυτά. Αν χρησιμοποιείς άλλο host/port, πρόσθεσέ το στο `CORS_ORIGIN` στο root `.env` (comma-separated) και κάνε **restart του API** (`npm run dev:api`).

5. **Login σελίδα (UI) vs API:**
   - Η **login σελίδα** (φόρμα) είναι στο **web app** (port **3000**): άνοιξε πάντα `http://192.168.1.2:3000/login` ή `http://localhost:3000/login`. Μην ανοίγεις `http://192.168.1.2:3001/login` — το API (3001) δεν σερβίρει HTML σελίδες, μόνο JSON (`POST /api/v1/auth/login` κ.λπ.). Αν βλέπεις fetch προς `...3001/login`, πιθανόν το tab σου να είχε ως base URL το 3001 (π.χ. άνοιξες το API URL και μετά κλικ σε σύνδεσμο «login»).
   - Αν το Next.js δείχνει **`GET /login 404`**: βεβαιώσου ότι τρέχεις το **web** (`npm run dev:web`) και ότι ανοίγεις το site στο **3000**. Αν συνεχίζει, διαγράψτε τον φάκελο `apps/web/.next` και ξανατρέξτε `npm run dev:web`.
   - Αν εμφανίζεται **"Module not found: Can't resolve 'sonner'"** ή **"framer-motion"**: τρέξε `npm install` στο root, διαγράψτε `apps/web/.next` και ξανατρέξτε `npm run dev:web`.
   - **Error P1001: Can't reach database server at localhost:5432**: Το PostgreSQL δεν τρέχει. Ξεκίνησέ το (Windows: Services → PostgreSQL, ή Docker αν χρησιμοποιείς `docker-compose`).

Άλλα μηνύματα που μπορεί να δεις:
- **"Skipping auto-scroll behavior due to position: sticky or position: fixed"** — συμπεριφορά του Next.js layout router, όχι σφάλμα.
- **"A listener indicated an asynchronous response..."** — συνήθως από extension του Chrome (π.χ. Cursor/React DevTools), όχι από τον κώδικά σου.

---

## 8. Alliance-inspired features — τι υλοποιήθηκε vs τι εξαιρείται

Το Alliance είναι **WordPress/BuddyPress theme**. Οι τεχνολογίες και τα plugins του (Elementor, LearnDash, WooCommerce, κ.λπ.) **δεν αξιοποιούνται** στο CoFounderBay· η αντιστοίχιση γίνεται μόνο ως **έννοιες/λειτουργίες** που ταιριάζουν στους σκοπούς της πλατφόρμας (co-founder matching, community, events) και στις ανάγκες των χρηστών, με το **δικό μας stack** (Next.js, NestJS, Prisma, Tailwind, shadcn).

### Υλοποιημένα (αντιστοιχία με έννοιες Alliance)

| Έννοια Alliance | Στο CoFounderBay |
|-----------------|------------------|
| **Dashboard:** events, notifications, calendars, graphs, posts/news | Κεντρικό intranet-style dashboard (logged-in): widgets για στατιστικά (κάρτες + μικρό chart), activity/discussions, job offers, who’s online, poll, calendar/upcoming events, hero “Momentum”, “From the blog”. Notifications στο TopNav. |
| **Community:** groups, departments, communication | SideNav sections (Community: Discover, Events, Messages). Discover = προφίλ/ανθρώπους, Events σελίδα, Messages. Δεν υπάρχουν “groups/departments” ως ξεχωριστές οντότητες — ευθυγραμμία με σκοπό matching/community. |
| **Polls:** εσωτερικά polls, αποτελέσματα, γραφήματα | Widget `DashboardPoll` (ενεργό poll, ψήφος, ποσοστά). Δέσιμο με backend όταν υπάρξει endpoint. |
| **File sharing / Knowledge Base / FAQs** | Δεν υλοποιήθηκε· εκτός scope για τρέχον MVP. Μπορεί να προστεθεί αργότερα ως Documents/Knowledge Base αν χρειαστεί. |
| **Professional design, modern, flexible** | Tailwind + shadcn/ui, προσαρμοσμένα components, RoleTheme, responsive layout. |
| **User menu & main menu** | TopNav: UserMenu (dropdown), logo, search, Discover, Messages, notifications, command palette, theme toggle. SideNav: ομαδοποιημένα sections (Main, Community, Jobs, Learning, Settings). |
| **Interactive search** | SearchBar (discover) + Command Palette (Ctrl+K) για πλοήγηση και ενέργειες. |
| **Responsive & mobile-friendly** | Responsive grid, MobileNav (sheet) για μικρές οθόνες, layout που δουλεύει σε διάφορες συσκευές. |
| **Blog / news / posts** | “From the blog” κάρτες στο dashboard (mock). Όχι πλήρες CMS blog· ευθυγραμμία με “announcements/news” στο dashboard. |
| **Calendar / events** | Σελίδα Events + widget `DashboardCalendar` (upcoming events). Δέσιμο με `listEvents` API. |
| **Notifications** | `NotificationsBell` στο TopNav, API `listNotifications`. |

### Εξαιρούμενα — WordPress/plugins ή μη συμβατά

- **Slider Revolution, Swiper, WPBakery, Elementor, Customizer 750+ options, Custom Post Types, Shortcodes, Theme Options Panel:** WordPress/theme-specific· δεν μεταφέρονται. Αντικαθίστανται από Next.js components και Tailwind/shadcn.
- **LearnDash, WP Job Manager, Resume Manager, WooCommerce, Paid Memberships Pro, rtMedia, Better Messages (plugin), Democracy Poll (plugin), The Events Calendar (plugin), Contact Form 7, M Chart, Knowledge Base (plugin), κ.λπ.:** Plugins WordPress. Στο CoFounderBay: ισοδύναμα ή πλήρως custom (NestJS API, Prisma, Next.js)· κανένα plugin WordPress δεν αξιοποιείται.
- **Education / LMS:** Online courses, quizzes, tests — εκτός σκοπού πλατφόρμας (co-founder matching & community, όχι εκπαίδευση). Onboarding wizard υπάρχει για ρόλους/προφίλ, όχι για courses.
- **elegro Crypto Payment:** Εκτός scope· πληρωμές μέσω Stripe (ήδη planned).
- **WPML:** Πολυγλωσσία μπορεί να προστεθεί αργότερα με δικό μας τρόπο (i18n), όχι με WordPress plugin.
- **One-Click demo installation, Dummy Data Installer:** WordPress demo content· στο δικό μας repo δεν υπάρχει αντίστοιχο “demo install”· υπάρχει seed/onboarding.
- **Changelog/ενημερώσεις theme 3.xx:** Αφορούν το theme Alliance· δεν σχετίζονται με CoFounderBay. Συμβατότητα και ενημερώσεις γίνονται στο δικό μας stack (Next, Nest, dependencies).

### Σύνοψη

- **Όλα όσα ταιριάζουν** στους σκοπούς της πλατφόρμας και είναι εφικτά με Next.js/NestJS/Prisma **έχουν αντιστοιχηθεί** (dashboard, community-style nav, polls, calendar, notifications, search, command palette, responsive layout, user menu).
- **Τι εξαιρείται** είναι ρητά: WordPress themes/plugins, LMS/education, plugin-specific λειτουργίες· χωρίς παράλειψη σε ότι αφορά τη δική μας τεχνολογία και τους στόχους της πλατφόρμας.

**Νέες προσθήκες (σχετικά με cofound-connect-nexus & πλήρης υλοποίηση):**

| Πρόσθετο | Περιγραφή |
|----------|-----------|
| **Dashboard API** | `GET /api/v1/dashboard/stats` (activeProfiles, matchesThisWeek, trendPercent, chartData), `GET /api/v1/dashboard/activity` (connections + events) |
| **React Query** | `@tanstack/react-query` για caching, loading states, καλύτερο UX |
| **Recharts** | Πραγματικό BarChart στα stats αντί για placeholder |
| **DashboardNewsletter** | Widget "Announcements & newsletter" στο dashboard |
| **Personalized welcome** | "Welcome back, {displayName}" με δεδομένα από `getMeProfile` |
| **Auth storage sync** | `storage` event για cross-tab συγχρονισμό κατά login/logout |
| **Space Grotesk** | Font display (nexus-style) + gradient tokens (--gradient-hero, --shadow-glow) |

---

## 9. Βέλτιστο πλάνο βελτιστοποίησης (βασισμένο σε cofound-connect-nexus)

Το [cofound-connect-nexus](https://github.com/Animus1991/cofound-connect-nexus) είναι Vite + React + shadcn + Tailwind. Οι ιδέες που εφαρμόστηκαν και οι επόμενες προτάσεις:

### Ήδη εφαρμοσμένα από nexus

1. **React Query** — data fetching, caching, loading states
2. **Recharts** — πραγματικά charts (BarChart στα stats)
3. **Space Grotesk** — typography για headings
4. **Gradient tokens** — `--gradient-hero`, `--shadow-glow`, `--gradient-card`
5. **Stats με trend** — activeProfiles, matchesThisWeek, trendPercent
6. **Personalized welcome** — "Welcome back, {displayName}"
7. **Activity feed** — connections + events από backend

### Επόμενα βήματα (προτεραιότητα)

| Βήμα | Περιγραφή | Συν effort |
|------|-----------|------------|
| 1 | **Polls backend** — Prisma model Poll + PollOption + PollVote, NestJS module, API CRUD | Μέτριο |
| 2 | **Jobs/Opportunities** — Model JobPosting ή derive από profiles με role=founder + "seeking" flag, API listing | Μέτριο |
| 3 | **Framer Motion** — Subtle animations (fade-in, stagger) όπως nexus | Χαμηλό |
| 4 | **Sonner** — Toast notifications (αντικαθιστά ή συμπληρώνει υπάρχον toast) | Χαμηλό |
| 5 | **Mobile bottom nav** — Σαν nexus `MobileBottomNav` για συνεπή mobile UX | Χαμηλό |
| 6 | **Newsletter API** — Endpoint για announcements (ή CMS integration) | Μέτριο |

### Ήδη υλοποιημένα (φάση 2)

| Πρόσθετο | Περιγραφή |
|----------|-----------|
| **Polls backend** | Prisma models Poll, PollOption, PollVote · API `GET /api/v1/polls/active`, `POST /api/v1/polls/:pollId/vote` |
| **Jobs API** | Model JobPosting · API `GET /api/v1/jobs` · DashboardJobs δεμένο με API |
| **Framer Motion** | AnimatedCard με stagger animations στο dashboard |
| **Sonner** | Toast component στο layout · `toast.success/error()` για notifications |
| **Mobile bottom nav** | MobileBottomNav (nexus-style) fixed στο κάτω μέρος · Home, Discover, Messages, Jobs, Profile |

### Τι δεν μεταφέρουμε από nexus

- **Vite** — Μένουμε Next.js App Router (SSR, routing, API routes)
- **React Router** — Next.js έχει built-in routing
- **Lovable.dev** — Εξωτερική πλατφόρμα· δεν αντικαθιστά το δικό μας CI/CD
