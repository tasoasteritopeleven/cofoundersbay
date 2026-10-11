# CoFounderBay

Πλατφόρμα επιχειρηματικής δικτύωσης για το startup ecosystem — σύνδεση founders, mentors, investors, service providers, incubators/accelerators.

## Stack

- **Monorepo:** pnpm + Turborepo
- **Web:** Next.js 15 (App Router) + TypeScript
- **API:** NestJS + TypeScript
- **DB:** PostgreSQL + Prisma
- **Cache / Jobs:** Redis + BullMQ (emails / background jobs)
- **Search:** Meilisearch
- **Shared:** `@cofounderbay/shared` (types, zod), `@cofounderbay/ui` (design system)

## Προαπαιτήσεις

- **Node.js ≥ 20** ([nodejs.org](https://nodejs.org))
- **Docker Desktop** (για Postgres, Redis, Meilisearch) — πρέπει να τρέχει πριν το `docker compose`
- **npm** (έρχεται με Node.js) — δεν χρειάζεται pnpm

## Γρήγορη εκκίνηση (Windows PowerShell)

**1. Άνοιξε Docker Desktop** και περίμενε να ξεκινήσει πλήρως.

**2. Από τη ρίζα του project (φάκελος `CoFounderBay`):**

```powershell
# Αντίγραψε το env
copy .env.example .env

# Εγκατάσταση dependencies (npm)
npm install

# Ξεκίνα Postgres, Redis, Meilisearch
docker compose up -d

# Database: generate client, migrations, seed skills
npm run db:generate
npm run db:migrate
npm run db:seed
```

**3. Τρέξε API και Web σε δύο terminals (πάντα από τη ρίζα `CoFounderBay`):**

- Terminal 1: `npm run dev:api` → API: http://localhost:3001/api  
- Terminal 2: `npm run dev:web` → Web: http://localhost:3000  

Όλες οι εντολές τρέχουν με **npm** από τη ρίζα· τα `nest` και `next` καλούνται μέσω workspace, οπότε δεν χρειάζεται να είναι global εγκατεστημένα.

**Αν δεν έχεις Docker:** Ξεκίνα μόνο το Docker Desktop και ξαναπροσπάθησε `docker compose up -d`. Χωρίς Docker δεν τρέχουν η βάση και το search.

## Προαιρετικές integrations (V1)

### Emails (SMTP)

- **Env**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `WEB_BASE_URL`
- **Τι κάνει**: όταν είναι configured, αποστέλλονται transactional emails για notifications (π.χ. νέα μηνύματα). Η αποστολή μπαίνει σε queue (Redis) και γίνεται best-effort.

### Stripe (Billing)

- **Env**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PREMIUM`, `WEB_BASE_URL`
- **Endpoints**:
  - `POST /api/v1/billing/checkout` (auth) → δημιουργεί checkout session
  - `POST /api/v1/billing/portal` (auth) → billing portal
  - `POST /api/v1/billing/webhook` (no auth) → Stripe webhooks

### Αν βγάζει `@prisma/fetch-engine` / `nest` or `next` not recognized

Τα scripts τρέχουν πλέον με `--prefix apps/api` / `apps/web` και χρησιμοποιούν το τοπικό `prisma`/`nest`/`next` από το project (όχι cached npx). Πρέπει να υπάρχει **σωστό** `node_modules`:

1. Από τη **ρίζα** `CoFounderBay`, διέγραψε `node_modules` και (προαιρετικά) `package-lock.json`.
2. Ξανατρέξε: `npm install`.
3. Μετά: `npm run db:generate` → `npm run db:migrate` → `npm run db:seed`.
4. Σε δύο terminals: `npm run dev:api` και `npm run dev:web`.

Όλες οι εντολές από τη **ρίζα** του project.

## Δομή

```
CoFounderBay/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── shared/       # Types, Zod schemas
│   └── ui/           # Design system
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── PROJECT-SETUP.md  # Επιλογές τεχνολογίας & επόμενα βήματα
```

## Επόμενα βήματα

Δες [PROJECT-SETUP.md](./PROJECT-SETUP.md) για τεχνολογικές επιλογές, προτάσεις και σειρά υλοποίησης (auth, profiles, search, messaging, κ.λπ.).
