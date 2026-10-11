## CoFounderBay – Technical & Product Master Plan

> Στόχος αυτού του αρχείου είναι να λειτουργεί ως **κεντρικός, μακροπρόθεσμος οδικός χάρτης** για την τεχνική και προϊόντική εξέλιξη της πλατφόρμας, με έμφαση:
> - στη **μείωση μελλοντικών “πισωγυρισμάτων”**,
> - στη **συμβατότητα με scale‑up** σε Ελλάδα/Ευρώπη,
> - και στη **συνεργασία ανθρώπων + AI εργαλείων** με ελεγχόμενο ρίσκο.

---

## 1. Στόχοι & Αρχές Σχεδιασμού

### 1.1. Στόχοι προϊόντος (υπενθύμιση)

- Να γίνει το CoFounderBay η βασική **υποδομή για team formation, mentoring και community** στο ελληνικό (και σταδιακά ευρωπαϊκό) startup οικοσύστημα.
- Να προσφέρει:
  - **founder & cofounder matching** (όχι απλά “social network”),
  - **δομημένο mentoring & communities**,
  - **εργαλεία για οργανισμούς** (πανεπιστήμια, incubators, accelerators, funds, EDIHs) σε μορφή **multi‑tenant SaaS**.

### 1.2. Αρχές σχεδιασμού

- **Scale‑ready από την αρχή, όχι scale‑heavy**: η αρχιτεκτονική πρέπει να επιτρέπει μελλοντική κλιμάκωση (multi‑tenant, modular), χωρίς να φορτώνεται με άκαιρη πολυπλοκότητα στο MVP.
- **Simplicity first**: όπου υπάρχουν πολλές λύσεις, προτιμάται η πιο απλή που:
  - είναι γνωστή στην ομάδα,
  - πατά σε ευρέως χρησιμοποιημένο οικοσύστημα (React/Next, Postgres, Prisma κ.λπ.),
  - δεν κλειδώνει άκαμπτα το μέλλον (χωρίς υπερ‑εξειδικευμένα frameworks).
- **Data‑driven εξέλιξη**: κάθε σημαντική λειτουργία πρέπει να συνδέεται με μετρήσιμα KPIs (activation, matches, retention, org usage).
- **Security & GDPR by design**: από την αρχή, έστω σε ελάχιστο βιώσιμο επίπεδο (proper auth, role‑based access, data minimization).
- **AI‑assisted, όχι AI‑driven**: τα AI εργαλεία (Cursor κ.λπ.) επιταχύνουν το dev, αλλά:
  - δεν αποφασίζουν αρχιτεκτονική,
  - δεν “αγγίζουν” ευαίσθητες περιοχές χωρίς review (security, data access),
  - ο κώδικας ελέγχεται και απλοποιείται από ανθρώπους.

---

## 2. Τεχνολογική Στοίβα & Αρχιτεκτονική

### 2.1. Frontend

- **Framework**: Next.js (App Router), React 19, TypeScript.
- **UI/Styles**:
  - Tailwind CSS + πιθανή χρήση shadcn/ui για επαναχρησιμοποιήσιμα components.
  - Ενιαίο design system (χρώματα, spacing, typography) με μεταγενέστερη δυνατότητα theming.
- **State & data fetching**:
  - TanStack React Query για server state (API calls).
  - Lightweight client state (π.χ. Zustand) μόνο όπου χρειάζεται (π.χ. UI flags).
- **Routing**:
  - Σαφής πληροφοριακή αρχιτεκτονική (βλ. §4.1).

### 2.2. Backend

#### 2.2.1. Τωρινή πραγματικότητα

- Υπάρχει `apps/api` (NestJS + Prisma + Postgres).
- Υπάρχει `apps/web` (Next.js).
- Υπάρχει `packages/shared` (shared TypeScript code).

#### 2.2.2. Επιλογή για ελαχιστοποίηση ασυμβατοτήτων

- **Διατηρούμε** το NestJS API ως βασικό backend για:
  - auth & users,
  - profiles & matching,
  - organizations & groups/communities,
  - notifications, events, analytics.
- **Διατηρούμε** Prisma + PostgreSQL ως data access layer (συνεχής εξέλιξη schema, όχι αντικατάσταση).
- **Αποφεύγουμε** πολλαπλά backend stacks (π.χ. επιπλέον Spring Boot microservices) μέχρι να υπάρξει πραγματική ανάγκη (scaling, domain separation).

### 2.3. Database & multi‑tenancy

- **DB**: PostgreSQL (managed – π.χ. Supabase/Railway/Render/Cloud provider).
- **ORM**: Prisma, με schema modular:
  - `User`, `Profile`, `Skill`, `Preference`,
  - `Match`, `Conversation`, `Message`,
  - `Organization`, `OrgMembership`, `Cohort`,
  - `Group`, `GroupMember`, `GroupPost`, `GroupEvent`,
  - `MentoringSession`,
  - `Notification`, `NotificationPreferences`,
  - `Event`, `EventAttendance`,
  - `ActivityLog`, `AnalyticsSnapshot` (βασική καταγραφή KPIs).
- **Multi‑tenant strategy (αρχικό)**:
  - Logical tenancy:
    - κάθε `Organization` έχει `orgId`,
    - τα records που σχετίζονται με org (π.χ. `Group`, `Cohort`, `MentoringSession`) φέρουν `orgId`,
    - τα queries φιλτράρονται πάντα ανά `orgId` (μέσω service layer).
  - Δυνατότητα, στο μέλλον, για physical partitioning (π.χ. άλλα schemas/DBs) αν απαιτηθεί.

---

## 3. Τρέχον Schema & Modules (Καταγραφή Υφιστάμενης Κατάστασης)

### 3.1. Prisma schema (apps/api/prisma/schema.prisma)

Ήδη ορισμένα entities καλύπτουν μεγάλο μέρος των αναγκών:

- **Enums**:
  - `Role` (`founder`, `mentor`, `investor`, `org`),
  - `ConversationType`, `UploadKind`, `EventType`, `RsvpStatus`,
  - `MeetingType`, `BookingStatus`, `NotificationType`,
  - `ConnectionStatus`, `ReportType`, `ReportStatus`,
  - `SubscriptionStatus`, `UserModerationStatus`, `InviteStatus`,
  - `GroupPrivacy`, `GroupMemberRole`.

- **User & Auth**:
  - `User`: βασική οντότητα χρήστη με `role`, `moderationStatus`, flags για onboarding, `lastSeenAt`.
  - `RefreshToken`: για διαχείριση refresh tokens per device.

- **Profiles & Skills**:
  - `Profile`: συνδεδεμένο 1–1 με `User`, με πεδία `displayName`, `headline`, `bio`, `location`, `timezone`, `languages`, `avatarUrl`, `rolePayload` (JSON για founder/mentor/investor/org), `visibilityRules` (JSON για privacy settings).
  - `Skill` & `ProfileSkill`: canonical skills + επίπεδα δεξιότητας (με χρήση `level` ως string).

- **Messaging**:
  - `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment`, `Upload`:
    - υποστηρίζουν direct/group conversations, attachments, avatars, με index στο `createdAt` για ordering.

- **Social graph & invites**:
  - `ConnectionRequest`: social graph μεταξύ χρηστών με `status` (pending/accepted/declined/blocked) και μοναδικότητα ανά ζεύγος χρηστών.
  - `Invite`: πρόσκληση νέων χρηστών μέσω email με tracking κατάστασης (pending/accepted/expired/cancelled).

- **Events & RSVPs**:
  - `Event`, `EventRsvp`: events με τύπους (`meetup`, `webinar`, `workshop`, `demo_day`, `networking`, `other`), online/offline, χωρητικότητα, RSVP status.

- **Mentoring / Bookings**:
  - `MentorAvailability`: διαθέσιμες ώρες ανά μέντορα (weekday, time range).
  - `MentorBooking`: bookings μεταξύ mentor–mentee με `MeetingType`, `BookingStatus`, υποστήριξη τιμολόγησης/Stripe.

- **Notifications & Moderation**:
  - `Notification`: με `NotificationType`, `meta` JSON, indexes σε `userId/createdAt/readAt`.
  - `Report`: για αναφορές (spam, harassment, κ.λπ.) με status & resolvedBy.

- **Billing & Subscription**:
  - `Subscription`: Stripe‑oriented, με `SubscriptionStatus`, `priceId`, κ.λπ.

- **Engagement tools**:
  - `Poll`, `PollOption`, `PollVote`: για δημοσκοπήσεις.
  - `JobPosting`: αγγελίες για ρόλους (π.χ. “Technical Co‑Founder”).

- **Groups/Communities**:
  - `Group`, `GroupMember`, `GroupPost`, `GroupPostComment`, `GroupPostReaction`, `GroupEvent`:
    - πλήρες μοντέλο για groups με privacy, roles, posts, comments, reactions, events.

### 3.2. Shared validation schemas (packages/shared/src/schemas)

- `profile.ts`:
  - Zod schemas για:
    - `profileVisibilitySchema` (κανόνες ορατότητας),
    - role‑specific payloads: `founderPayloadSchema`, `mentorPayloadSchema`, `investorPayloadSchema`, `orgPayloadSchema`,
    - `createProfileSchema` / `updateProfileSchema` (με `skillIds` + `skillLevels` ως record).
  - Αυτά τα schemas είναι ήδη ευθυγραμμισμένα με το Prisma `Profile.rolePayload` & `Profile.skills`.

**Συμπέρασμα:**  
Το υπάρχον schema καλύπτει ήδη:
- Users, profiles, skills,
- messaging, events, mentoring bookings,
- notifications, reports, billing,
- groups/communities.

Δεν υπάρχει ακόμη dedicated `MatchingPreferences`/`Match` model, αλλά τα `Profile.rolePayload` + `ProfileSkill` + `JobPosting` παρέχουν ήδη αρκετή πληροφορία για rule‑based matching στην πρώτη φάση (με μελλοντική πιθανή προσθήκη explicit match tables).

---

## 3. Κύρια Modules & Data Models

### 3.1. User & Profile

**Στόχος**: ενιαία, επεκτάσιμη αναπαράσταση χρηστών (founders, cofounders, mentors, org admins).

- `User`:
  - `id`, `email`, `hashedPassword`, `role` (π.χ. `founder`, `mentor`, `org_admin`, `admin`),
  - `createdAt`, `updatedAt`, `lastLoginAt`, `status`.
- `Profile`:
  - `userId`, `fullName`, `headline`, `bio`, `location`, `avatarUrl`,
  - `currentStatus` (π.χ. `searching_cofounder`, `open_to_mentoring`, `building_startup`),
  - `profilesSkills` (relation σε `Skill`/`ProfileSkill`),
  - `experienceSummary`, `portfolioLinks`.
- `Skill` / `ProfileSkill`:
  - `Skill`: canonical λίστα (π.χ. `backend`, `frontend`, `product`, `marketing`, `fintech`, `healthtech`).
  - `ProfileSkill`: join table με proficiency level (1–5), years of experience.

### 3.2. Preferences & Matching

- `MatchingPreferences` (per user):
  - `lookingForRoles`: string enum[] (π.χ. `cto`, `coo`, `business_partner`),
  - `commitment`: scale (ώρες/εβδομάδα, full‑time vs part‑time),
  - `preferredStages`: enum[] (`idea`, `pre_seed`, `seed`, `growth`),
  - `preferredIndustries`: string[],
  - `locationPreference`: `remote_only` / `hybrid` / `onsite`,
  - `workStyle` (π.χ. `structured`, `experimental` – απλά, όχι κλινικά),
  - flags για mentoring (αν προσφέρει/ζητά).

- `Match`:
  - `id`, `userAId`, `userBId`, `score`, `status` (`suggested`, `pending`, `accepted`, `rejected`, `archived`),
  - timestamps, optional `origin` (π.χ. `algorithm`, `manual_search`, `org_cohort`).

### 3.3. Organizations, Cohorts, Groups

- `Organization`:
  - `id`, `name`, `slug`, `type` (π.χ. `university`, `accelerator`, `hub`, `fund`),
  - `logoUrl`, `description`, `website`, `contactEmail`,
  - `settings` (JSON – π.χ. visibility, email domains που επιτρέπονται).
- `OrgMembership`: `userId`, `orgId`, `role` (`member`, `mentor`, `admin`).
- `Cohort`: `id`, `orgId`, `name`, `description`, `startDate`, `endDate`, `status`, `tags`.
- `Group`, `GroupMember`, `GroupPost`, `GroupEvent`: σύμφωνα με το υπάρχον `IMPLEMENTATION_ROADMAP.md`, με προσαρμογή ώστε:
  - τα groups να μπορούν να ανήκουν είτε σε org/cohort, είτε να είναι “global”.

### 3.4. Mentoring, Messaging, Notifications

- `MentoringSession`: `mentorId`, `menteeId`, `orgId?`, `cohortId?`, `scheduledAt`, `duration`, `status`, `notes`.
- Messaging (μπορεί να χρησιμοποιεί υπάρχον schema) για 1–1 συζητήσεις μεταξύ matched users.
- `Notification` & `NotificationPreferences`: όπως στο roadmap (τύποι, κανάλια – email/push, digest).

---

## 4. Πληροφοριακή Αρχιτεκτονική & UX Flows

### 4.1. Κύριες σελίδες & flows

1. **Public landing**: `/`
   - Περιγραφή αξίας, CTA για founders/mentors/orgs.
2. **Auth**: `/login`, `/register`, `/onboarding`
   - social login (μελλοντικά), email/password στο MVP.
3. **Dashboard** (για απλό χρήστη):
   - Overview: matches, requests, suggested groups, upcoming events.
4. **Profile & Preferences**:
   - `/profile`, `/settings/preferences`, `/settings/account`.
5. **Matches**:
   - `/matches` – λίστα προτεινόμενων, φίλτρα, scoring.
6. **Messaging**:
   - `/messages` – conversations, unread counts (υπάρχον UI να βελτιωθεί).
7. **Organizations / Cohorts** (μόλις είσαι org admin ή μέλος):
   - `/orgs/[slug]`: overview, members, groups, events.
   - `/orgs/[slug]/cohorts/[id]`: participants, matches, mentoring stats.
8. **Groups & Communities**:
   - `/groups`, `/groups/[id]` – κατά τα πρότυπα του roadmap.

### 4.2. Κρίσιμα UX flows

- Onboarding (create profile + set preferences) → metrics για completion.
- Request/accept connection → άνοιγμα chat/mentoring.
- Org admin δημιουργεί cohort → προσκαλεί συμμετέχοντες → παρακολουθεί metrics.

---

## 5. Roadmap Υλοποίησης (LLM + Ανθρώπινη Ομάδα)

### 5.1. Φάση 1 – Σταθεροποίηση & Αποτύπωση Υφιστάμενης Κατάστασης

**Στόχος:** να υπάρξει καθαρή εικόνα του τι ήδη υπάρχει (schema, APIs, components) και να μειωθεί το “χάος” πριν την προσθήκη μεγάλων features.

#### Βήματα

1. **Codebase survey**:
   - Αναλυτική ανάγνωση:
     - Prisma schema,
     - βασικά NestJS modules (auth, users, profiles, messages),
     - Next.js routes & κύρια components.
   - Καταγραφή σε αυτό το αρχείο:
     - τρέχουσα δομή φακέλων,
     - τρέχοντα entities & APIs,
     - βασικά UX flows που ήδη υπάρχουν.

2. **Καθαρισμός scripts & dev experience**:
   - Επιβεβαίωση ότι `pnpm dev:web` + `pnpm dev:api` λειτουργούν χωρίς σφάλματα (διορθώσεις αν χρειαστεί).
   - Προσθήκη/βελτίωση lint scripts, TypeScript strict, basic test command.

3. **Βασική τεκμηρίωση**:
   - Μικρά sections σε αυτό το αρχείο:
     - “Current Architecture Overview”,
     - “Known Issues / Tech Debt Backlog”.

### 5.2. Φάση 2 – Core Matching & Profiles (MVP‑έτοιμο)

**Στόχος:** να σταθεροποιηθεί το data model & APIs γύρω από προφίλ/προτιμήσεις/matching και να υπάρχει λειτουργικό MVP για founders/cofounders.

#### Υλοποιημένα (τρέχουσα κατάσταση)

- **Shared package – matching module**  
  - `packages/shared/src/matching/types.ts`: `ProfileSnapshot`, `MatchScoreResult`, `MatchScoreBreakdown`.  
  - `packages/shared/src/matching/score.ts`: pure function `computeMatchScore(viewer, candidate)` (0–100) με βάρη: role complementarity, skills overlap (Jaccard), stage/commitment alignment, location, recency. Εξαγωγή από `packages/shared/src/index.ts`.  
- **API**  
  - `GET /api/v1/recommendations`: επιστρέφει `{ suggestions: [...] }` με `matchScore` και `matchReasons`.  
  - Εξαίρεση χρηστών με υπάρχουσα σχέση (pending/accepted) στο `ConnectionRequest`.  
  - Χρήση `computeMatchScore` από shared· προτάσεις για founders περιλαμβάνουν και άλλους founders (cofounder matching).  
- **Web**  
  - Σελίδα `/matches`: λίστα προτεινόμενων (από `getRecommendations`), κάρτες με score & λόγους, CTA Connect (ConnectionRequestDialog).  
  - Discover – tab «Top Matches» και suggestions χρησιμοποιούν πλέον `matchReasons` από API όταν υπάρχουν.  
  - Nav: «Matches» στο Community (nav-links), prefetch στο RoutePrefetcher, CommandPalette.  
- **Τύποι**  
  - `SearchHit` στο `apps/web/src/lib/api.ts`: προστέθηκε `matchReasons?: string[]`.

#### Υπόλοιπα βήματα (προαιρετικά)

1. Οριστικοποίηση Prisma models για `MatchingPreferences` / `Match` (αν απαιτηθεί persisted matching history).  
2. Onboarding wizard για συμπλήρωση rolePayload (stage, commitment, rolesSought) για καλύτερο matching.  
3. Unit tests για `computeMatchScore` στο shared package.

### 5.3. Φάση 3 – Organizations, Cohorts & Groups

**Στόχος:** να υποστηρίζονται pilots με οργανισμούς (πανεπιστήμια, incubators κ.λπ.) και θεματικές κοινότητες.

#### Βήματα

1. Επέκταση Prisma schemas για `Organization`, `OrgMembership`, `Cohort`, `Group`, `GroupMember`, `GroupPost`, `GroupEvent`.  
2. NestJS modules:
   - `OrganizationsModule` (create org, manage members, cohorts).  
   - `GroupsModule` (σύμφωνα με `IMPLEMENTATION_ROADMAP.md`, προσαρμοσμένο για org use‑cases).  
3. Next.js pages:
   - `/orgs/[slug]`, `/orgs/[slug]/cohorts/[id]`.  
   - `/groups`, `/groups/[id]`.  
4. Basic permissions (μόνο org admins δημιουργούν cohorts, group admins διαχειρίζονται groups).

### 5.4. Φάση 4 – Mentoring, Notifications & Events

**Στόχος:** ολοκληρωμένο “κύκλωμα” mentoring + notifications + events για ενεργοποίηση πλατφόρμας.

#### Βήματα

1. Prisma model `MentoringSession`, `Notification`, `NotificationPreferences`, `Event`, `EventAttendance`.  
2. NestJS services:
   - Endpoint για δημιουργία mentoring requests/sessions.  
   - Notification service (DB + πιθανό WebSocket + email digests αργότερα).  
3. UI:
   - Mentoring tab (χρήστες βλέπουν διαθέσιμους mentors & αιτήματα).  
   - Notifications dropdown + σελίδα ιστορικού.  
   - Events listing & RSVP.

### 5.5. Φάση 5 – Analytics, Experimentation & Optimization

**Στόχος:** η πλατφόρμα να μπορεί να βελτιώνεται βάσει δεδομένων, όχι ενστίκτου.

#### Βήματα

1. Ενοποίηση product analytics (π.χ. PostHog, Amplitude).  
2. Καθορισμός γεγονότων (events) που καταγράφονται (onboarding completion, match actions, mentoring sessions κ.λπ.).  
3. Dashboards (για εσωτερική χρήση & για orgs) με βασικά KPIs.  
4. A/B δοκιμές σε επιλεγμένα UX flows (π.χ. onboarding sequence).

---

## 6. Κατευθυντήριες Οδηγίες για Χρήση LLM/AI στην Ανάπτυξη

1. **LLM ως βοηθός, όχι ως architect**:
   - Η τελική ευθύνη για αρχιτεκτονικές αποφάσεις, schema και security είναι της ομάδας.
2. **Scope‑limited generations**:
   - Ζητάμε από LLM να βοηθήσει σε **μικρά, σαφή tasks** (π.χ. συγκεκριμένο component, συγκεκριμένο service), όχι “γράψε όλο το σύστημα”.
3. **Code review υποχρεωτικά**:
   - Κάθε αλλαγή που παράγεται με AI περνάει από ανθρώπινο έλεγχο, με έμφαση σε:
     - αναγνωσιμότητα,
     - ασφάλεια (SQL injection, auth bypass),
     - περιττή πολυπλοκότητα.
4. **Αποφυγή υπερβολικά μαγικών abstractions**:
   - Όπου το AI προτείνει πολύπλοκα patterns (over‑engineered factories, generics, meta‑programming) → απλοποιούμε.
5. **Συνεχής ενημέρωση αυτού του αρχείου**:
   - Όταν λαμβάνονται σημαντικές αποφάσεις (νέα modules, αλλαγές schema, αρχιτεκτονικές μεταβολές), ενημερώνεται η αντίστοιχη ενότητα.

---

## 7. Άμεσες Ενέργειες (Next Actions)

1. **Επιβεβαίωση Dev Environment**:
   - Να διασφαλιστεί ότι `pnpm install`, `pnpm dev:web` και `pnpm dev:api` λειτουργούν σταθερά (διορθώσεις σε scripts αν χρειαστεί).
2. **Φάση 2 – ολοκλήρωση (προαιρετικά)**:
   - Unit tests για `computeMatchScore` στο shared package.
   - Onboarding wizard για συμπλήρωση rolePayload (stage, commitment, rolesSought).
   - Αν απαιτηθεί: Prisma models για `MatchingPreferences` / `Match` (persisted matching history).
3. **Φάση 3 – Organizations, Cohorts & Groups**:
   - Επέκταση schemas & NestJS modules για orgs/cohorts/groups σύμφωνα με §5.3.
4. **Φάση 4 & 5**:
   - Mentoring, notifications, events (§5.4)· analytics & experimentation (§5.5).

Το “κύμα” Φάσης 2 (matching engine, recommendations API, σελίδα `/matches`) έχει υλοποιηθεί· το επόμενο βήμα είναι σταθεροποίηση και στη συνέχεια Φάση 3.

