# CoFounderBay — πλάνο αναβάθμισης με κέντρο το AI

**Ημερομηνία διάγνωσης:** 2026-09-05  
**Κλάδος αναφοράς:** `cursor/ui-upgrade-cloudflare-preview-53e0`  
**Μέθοδος:** ανάγνωση κώδικα σε `apps/web` και `apps/api` (σελίδες, nav, contexts, API modules, Prisma, AI agents). Όχι εικασίες marketing.

Το παλαιότερο `docs/AI_CHAT_IMPLEMENTATION_PLAN.md` περιγράφει orchestrator + tools που **δεν έχουν υλοποιηθεί**. Αυτό το έγγραφο αντικαθιστά εκείνο ως πηγή αλήθειας για το *τι υπάρχει* και *τι πρέπει να γίνει*.

> **Σημείωση συγχώνευσης (2026-09-05):** Αυτό το έγγραφο ενσωματώθηκε στο branch `integration/ai-platform-upgrade` — προϊόν merge του `cursor/ui-upgrade-cloudflare-preview-53e0` (102 αρχεία: design-system a11y, Cloudflare offline preview, αυτό το πλάνο) με ανεξάρτητη ταυτόχρονη ανάλυση της ίδιας πλατφόρμας (δημοσιευμένη ως docket "Cognitive Core"). Οι δύο αναλύσεις κατέληξαν ανεξάρτητα στην ίδια διάγνωση (τρία αποσυνδεδεμένα AI stacks, μηδενικό tool-calling, `context` που ποτέ δεν στέλνεται) — σύγκλιση που ενισχύει την εγκυρότητα και των δύο. Το §13 παρακάτω προσθέτει το συμπληρωματικό υλικό από εκείνη την ανάλυση (multi-provider tiering, ενοποιημένη τηλεμετρία) χωρίς να αφαιρεί τίποτα από το πρωτότυπο. Το ζήτημα #7 στο §1.2 (notification badge hardcoded σε `0`) διορθώθηκε στο ίδιο commit — βλ. `apps/web/src/hooks/useUnreadCounts.ts` + `SideNav.tsx`.

---

## 1. Διάγνωση (μετρήσιμη)

### 1.1 Τι είναι σήμερα το AI

Υπάρχουν **τρία αποσυνδεδεμένα stacks**:

| Stack | Πού ζει | Μοντέλο | Μπορεί να αλλάξει δεδομένα; |
|---|---|---|---|
| Global chat (`UnifiedChatPopup` + `/api/ai/chat`) | Όλες οι authenticated σελίδες μέσω `GlobalFloatingUi` | Ollama, 10 prompt-agents | Όχι. Μόνο κείμενο. Δεν στέλνει profile, route, ούτε `conversationId`. |
| Canvas copilot (`/api/research/boards/:id/copilot/*`) | Μόνο `/research/[boardId]` | Ollama + κείμενο κόμβων | Μόνο αν ο χρήστης πατήσει Export / Import / Add to canvas. |
| Builder AI (`/builder/ai/*`) | `/builder` | OpenAI / Anthropic | Γεμίζει document JSON μετά από ρητό κλικ. |
| OpenAI helpers | `/api/ai/profile-suggestions`, meeting-notes | OpenAI | Επιστρέφει προτάσεις· ο χρήστης τις εφαρμόζει χειροκίνητα. |

Οι 15 agents στο `apps/api/src/ai/agents/base-agent.ts` είναι **system prompts**. Δεν υπάρχει tool calling, RAG, ούτε φόρτωση προφίλ από Prisma στο global chat.

Τα πεδία Prisma `AIAssistantMessage.actionType` / `actionMeta` υπάρχουν και **δεν γράφονται**. Το `enqueueAIJob` υπάρχει και **κανένα frontend δεν το καλεί**. Τα `AIMatchExplainer`, `AIQuickAsk`, `useAIInsight`, `AIAnalysisPanel` είναι **νεκρός κώδικας**.

### 1.2 Τι είναι σήμερα τα δεδομένα

| Πρόβλημα | Απόδειξη | Επίπτωση |
|---|---|---|
| Τρεις πηγές ρόλου | `cfb_primary_role` (middleware), `RoleContext` μόνο στο `/dashboard/*`, `localStorage.user.role` στο `SideNav` | Λάθος Work nav για org/tenant/multi-role. |
| Διπλά React Query keys | `['me','profile']` vs `['me-profile']`, `['connections']` vs `['connection-requests']` | Stale UI μετά από edit. |
| Feed χωρίς backend | Web καλεί `/api/feed/*`· δεν υπάρχει Nest module | `/feed` είναι κέλυφος. |
| Calendar / fundraising / projects / org members | Σελίδες με `DEMO_*` / `MOCK_*` | Το nav υπόσχεται ροές που δεν υπάρχουν. |
| Τρία realtime κανάλια | messaging Socket.IO, builder Socket.IO, raw WS στο `NotificationCenter` | Badges και presence δεν συγχρονίζονται. |
| Notification badge στο SideNav | hardcoded `0` | Ο χρήστης δεν βλέπει unread. |
| Matching σε 4 επιφάνειες | `/matches`, `/recommendations`, `/discover`, `/search` | Ίδιο API, διαφορετικά empty states. |
| Δύο admin homes | `/admin` vs `/admin/dashboard` | Middleware και nav διαφωνούν. |
| Νεκρό link | Investor UI → `/startups/[id]` χωρίς route | 404. |

### 1.3 Τι δουλεύει ήδη (να μην ξαναγραφτεί)

- JWT + cookie session, CSRF, preview demo session στο Cloudflare.
- Streaming SSE στο `/api/ai/chat/stream`.
- Λίστα agents + health/models.
- Persist AI conversations στο API (το popup απλά δεν τα χρησιμοποιεί).
- Matching ML (`matching.service.ts`) — όχι LLM.
- Canvas → Builder export/import ως χειροκίνητες πράξεις.
- `GET /api/behavior/next-action` (κανόνες, όχι LLM).
- Mobile AppShell: Work / Explore / Account + bottom nav.

---

## 2. Στόχος προϊόντος

**Το AI δεν είναι τρίτο tab. Είναι το λειτουργικό σύστημα της πλατφόρμας.**

Κάθε οθόνη έχει:

1. **Context packet** — ποιος είναι ο χρήστης, ποιος ρόλος είναι ενεργός, σε ποια οντότητα κοιτάει, ποια δεδομένα είναι stale.
2. **Read tools** — το μοντέλο διαβάζει μόνο ό,τι επιτρέπουν τα permissions του ρόλου.
3. **Write tools** — κάθε μετάλλαξη περνάει από τα υπάρχοντα REST/socket endpoints, με επιβεβαίωση UI για μη αναστρέψιμες πράξεις.
4. **Shared cache** — ένα event (`profile.updated`, `connection.accepted`, …) ενημερώνει όλες τις επιφάνειες.

Αποδοχή: ο χρήστης μπορεί, από το ίδιο chat, να πει «βρες μου technical cofounder στην Αθήνα, σώσε τον καλύτερο, στείλε intro, άνοιξε research board από τη συνομιλία» και το σύστημα να εκτελέσει τα βήματα με ορατό audit trail — χωρίς να ανοίξει 6 διαφορετικές σελίδες χειροκίνητα.

---

## 3. Αρχιτεκτονική-στόχος

```
┌─────────────────────────────────────────────────────────────┐
│  UI surfaces (pages, modals, cards)                         │
│  όλα εκπέμπουν PageContext + διαβάζουν τα ίδια Query keys   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Copilot Shell (αντικαθιστά το σημερινό AI tab)             │
│  thread persistence · suggested actions · citations         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  AgentOrchestrator                                          │
│  planner → tool calls → confirmations → result cards        │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
   ┌────────▼────────┐           ┌────────▼────────┐
   │ Graph API       │           │ Command API     │
   │ GET /graph/me   │           │ POST /commands  │
   │ GET /graph/:id  │           │ idempotent      │
   └────────┬────────┘           └────────┬────────┘
            │                             │
            └──────────┬──────────────────┘
                       ▼
              υπάρχοντα domain services
              (profile, matching, messages,
               connections, research, builder,
               milestones, notifications, roles)
```

Κανόνας: **κανένα νέο write path που παρακάμπτει τα domain services.** Το AI καλεί τα ίδια endpoints που καλεί το UI.

---

## 4. Ενιαίο γράφημα δεδομένων

Ελάχιστοι κόμβοι που πρέπει να εκτίθενται στο `GET /api/graph/me`:

| Κόμβος | SoT σήμερα | Edge που λείπει |
|---|---|---|
| `User` + `Profile` + `UserRoleFacet` + active `Tenant` | Prisma | Ενιαίο «ποιος μιλάει / με ποιο καπέλο» |
| `ConnectionRequest` | `/api/connections` | Σύνδεση με MatchSuggestion |
| `MatchSuggestion` / `MatchProfile` | `/api/recommendations` | Ενιαίο funnel με Discover/Search |
| `Conversation` / `Message` | `/api/messages` + socket | AI thread ≠ human thread (ξεχωριστοί τύποι, κοινό inbox UI) |
| `Notification` | `/api/notifications` | Ένα realtime envelope |
| `ResearchBoard` / nodes | `/api/research` | Link σε Milestone και BuilderDocument |
| `BuilderWorkspace` / documents | `/api/builder` | Link πίσω στο board |
| `Milestone` | `/api/milestones` | Εμφάνιση στο Calendar (σήμερα demo) |
| `Event` / `MentorBooking` | σκόρπια | Ένα timeline API |
| `XPEvent` / badges / readiness | `/api/gamification`, `/api/dashboard/venture-readiness` | Next-action από το ίδιο γράφημα |
| `FeedPost` | **δεν υπάρχει** | Ή υλοποίηση Prisma module ή αφαίρεση από το nav |

**Συγχρονισμός UI (υποχρεωτικό πριν το copilot γράφει):**

1. Ένα canonical React Query key ανά οντότητα: `['profile','me']`, `['connections']`, `['matches']`, `['conversations']`, `['notifications']`, `['xp','me']`.
2. Domain events από τον API client: μετά από κάθε επιτυχημένο write, `queryClient.invalidateQueries` στα σχετικά keys **και** `window`/`Query` event για badges.
3. `RoleContext` στο root layout, όχι μόνο στο `/dashboard`. Το `SideNav` διαβάζει `primaryRole`, όχι `localStorage.user.role`.
4. Ένα realtime bus (Socket.IO namespace `events`) που μεταφέρει `{ type, entityId, payload }` για message, notification, presence. Τα υπόλοιπα sockets γίνονται adapters.

---

## 5. Κατάλογος tools του AI (mapped σε υπάρχον API)

Κάθε tool έχει: όνομα, endpoint, πλευρά (read/write), επιβεβαίωση, ρόλους.

### 5.1 Ανάγνωση (χωρίς confirm)

| Tool | Endpoint | Σκοπός |
|---|---|---|
| `get_me` | `GET /api/auth/me` + `GET /api/me/profile` | Ταυτότητα |
| `get_roles` | `GET /api/roles/dashboard-context` | Ενεργό καπέλο |
| `get_graph` | **νέο** `GET /api/graph/me` | Σύνοψη: unread, pending intros, next action, readiness |
| `search_people` | `GET /api/search/profiles` | Discover/search |
| `get_recommendations` | `GET /api/recommendations` | Matches |
| `get_connections` | `GET /api/connections` | Intros |
| `get_conversations` | `GET /api/messages/conversations` | Inbox |
| `get_messages` | `GET /api/messages/conversations/:id/messages` | Thread |
| `get_notifications` | `GET /api/notifications` | Alerts |
| `get_board` | `GET /api/research/boards/:id` | Canvas |
| `get_milestones` | `GET /api/milestones` | Πρόοδος |
| `get_readiness` | `GET /api/dashboard/venture-readiness` | VRS |
| `get_next_action` | `GET /api/behavior/next-action` | Κανόνας + LLM εξήγηση |
| `get_xp` | `GET /api/gamification/users/me/xp` | Πρόοδος |

### 5.2 Εγγραφή (confirm στο chat ως ActionCard)

| Tool | Endpoint | Confirm |
|---|---|---|
| `update_profile` | `PATCH /api/me/profile` | Ναι (diff headline/bio) |
| `apply_profile_suggestions` | ήδη `/api/ai/profile-suggestions` + PATCH | Ναι ανά πεδίο |
| `send_connection` | `POST /api/connections` | Ναι |
| `respond_connection` | `PATCH /api/connections/:id` | Ναι |
| `shortlist_add` | shortlist API | Όχι (undo) |
| `start_or_send_message` | `POST .../direct` + socket `message:send` | Ναι για πρώτο μήνυμα σε νέο άτομο |
| `create_board` / `add_nodes` | `/api/research/boards` | Ναι για create |
| `create_milestone` | `POST /api/milestones` | Ναι |
| `generate_builder_section` | `/builder/ai/generate-section` | Ναι πριν save |
| `switch_role` | `PATCH /api/roles/:id/set-primary` | Ναι |
| `navigate` | client router | Όχι — προτείνει deep link |

Απαγορεύσεις (σκόπιμες): διαγραφή λογαριασμού, billing charge, ban χρηστών, αποστολή μαζικών DMs, αλλαγή ξένου προφίλ.

### 5.3 Context packet (υποχρεωτικό σε κάθε chat turn)

Το `useAIChat` σήμερα **δεν στέλνει `context`**. Πρέπει να στέλνει:

```ts
{
  route: pathname,
  entity: { type: 'profile'|'match'|'board'|'conversation'|..., id },
  role: primaryRole,
  tenantId,
  locale,
  visibleSummary: { unreadMessages, pendingIntros, readiness, nextActionId }
}
```

Ο server εμπλουτίζει με Prisma (όχι εμπιστοσύνη στο client για PII τρίτων): φορτώνει μόνο IDs που ο caller δικαιούται.

---

> **2026-09-07:** Οπτική ανανέωση και empty-state Ask AI περιγράφονται στο `docs/PLATFORM_DESIGN_AI_PLAN.md` (φάσεις H–K). Ο χρήστης ζήτησε ρητά σύγχρονο UI σε όλες τις σελίδες· το παλιό μη-στόχο «μην ξανασχεδιάσεις το visual language» δεν ισχύει πλέον για chrome/tokens. Η παλέτα και τα themes μένουν.

## 6. UI/UX — συνοχή, όχι νέα «θέματα»

### 6.1 Ένα chrome

- `AppShell` είναι η μόνη κορνίζα για authenticated routes.
- Κατάργηση δεύτερων page heroes που επαναλαμβάνουν τον τίτλο του AppShell (Messages, Feed, Matches).
- Ένα pattern empty state: τίτλος, μία πρόταση, primary CTA, δευτερεύον «Ask AI».
- Ένα pattern modal: Dialog + `safe-bottom` + κλείσιμο με Esc/overlay.
- Copilot: δεξί drawer στο desktop, bottom sheet στο mobile — **όχι δεύτερο floating chat δίπλα στο Messages FAB**. Στο mobile το Messages μένει στο tab bar· το AI ανοίγει από overflow / persistent pill.

### 6.2 Design tokens

Δεν αλλάζουμε παλέτα για χάρη του AI. Το AI χρησιμοποιεί τα υπάρχοντα `--primary`, cards, badges.

Νέα primitives μόνο:

- `ActionCard` (πρόταση εργαλείου + Confirm / Edit / Dismiss)
- `CitationChip` (από ποια οντότητα ήρθε η απάντηση)
- `EntityPeek` (hover/tap preview προφίλ, match, board)

### 6.3 Ροή ανά ρόλο (μία «ημέρα»)

| Ρόλος | Κύρια διαδρομή που πρέπει να κλείσει το AI |
|---|---|
| Founder | Onboarding → profile completeness → matches → intro → research board → milestone → deck section |
| Mentor | Requests → availability → session notes summarize → follow-up message |
| Investor | Scouting → shortlist → data room / pitch → pipeline note |
| Provider | Inquiry → proposal → project |
| Org admin | Applications → cohort → mentor assignment |
| Platform admin | Flags / users / audit — AI μόνο εξηγεί, δεν εκτελεί destructive admin χωρίς 2ο factor |

Κάθε διαδρομή έχει ένα `Playbook` (λίστα βημάτων) που το AI μπορεί να προτείνει και να τσεκάρει. Το founder onboarding checklist στο dashboard είναι το πρώτο playbook που ήδη υπάρχει στη UI.

---

## 7. Αναβάθμιση ανά τομέα (σελίδα → δεδομένα → AI)

Προτεραιότητα: **να σταματήσει το ψεύδος** (nav που οδηγεί σε mock), μετά **συγχρονισμός**, μετά **AI write**.

### P0 — θεμέλια (χωρίς αυτά το AI είναι επικίνδυνο)

1. **Role truth:** `RoleProvider` στο root· SideNav/MobileNav από `primaryRole`· cookie `cfb_primary_role` ενημερώνεται από το ίδιο API.
2. **Query key contract** + invalidation map στο `apps/web/src/lib/query-keys.ts`.
3. **Graph + Commands API** (`/api/graph/me`, `/api/commands`) ως λεπτό facade.
4. **Chat persistence:** `autoCreateConversation` στο popup· reload history· settings/ai γράφει `AIUserPreference` στη βάση, όχι μόνο localStorage.
5. **Context packet** σε κάθε `sendAIChat` / stream.
6. **Orchestrator + 6 πρώτα tools:** `get_graph`, `search_people`, `get_recommendations`, `send_connection`, `start_or_send_message`, `navigate`.
7. **Preview:** τα tools επιστρέφουν τα payloads του `preview-api.ts` ώστε το Cloudflare demo να δείχνει πραγματικές ActionCards.

### P1 — κοινωνικό γράφημα (Explore)

- Ένα funnel: Search ⊂ Discover ⊂ Matches. Ίδια κάρτα προφίλ, ίδιο insight, ίδιο CTA (Connect / Message / Shortlist).
- `AIInsightButton` καλεί τον orchestrator με `entity`· καταργείται το παράλληλο one-shot χωρίς citations.
- Connections: intros από AI («γράψε μήνυμα intro») με προ-συμπληρωμένο draft, αποστολή μόνο με Confirm.
- Messages: το AI συνοψίζει thread και προτείνει απάντηση· δεν στέλνει χωρίς Confirm.
- Notifications badge από `useUnreadCounts` + notifications unread — όχι `0`.
- Wire ή διαγραφή `AIMatchExplainer` / `AIQuickAsk`.

### P2 — εργασία ιδρυτή (Work)

- Research: ενεργοποίηση των νεκρών client calls (`extract`, `connections`, `synthesize`) **ή** διαγραφή τους· το canvas copilot γίνεται tool `canvas_chat` του κεντρικού orchestrator με `boardId`.
- Builder: `generate_section` ως tool με preview diff.
- Milestones: CRUD από chat («πρόσθεσε milestone: talk to 5 mentors»).
- Calendar: αντικατάσταση `DEMO_EVENTS` με ένωση `Event` + `MentorBooking` + milestone due dates. Αλλιώς αφαίρεση από το nav μέχρι να υπάρξει API.
- Fundraising / Projects: είτε API + μοντέλα, είτε μετακίνηση σε «Coming soon» εκτός κύριου nav.
- Readiness: το panel «AI Insight» καλεί LLM πάνω στα VRS dimensions, όχι `recommendations[0]` τοπικά.

### P3 — Feed / Activity / Gamification

- Απόφαση προϊόντος: **Feed v1 στο Prisma** (post, like, comment) **ή** αφαίρεση `/feed` από Account nav.
- Activity = προβολή του `UserActivity` + notifications, όχι δεύτερο feed.
- Achievements/XP: ένα key `['xp','me']`· το AI εξηγεί «γιατί 42% readiness» με citations στα dimensions.

### P4 — ρόλοι εκτός founder

- Mentor/Investor/Provider/Org: κάθε dashboard widget έχει `askAi` που στέλνει το widget id ως context.
- Κατάργηση διπλών dashboards (`/provider/dashboard` vs `/dashboard/provider`, `/admin` vs `/admin/dashboard`).
- Διόρθωση νεκρού `/startups/[id]`.
- Org members: αντικατάσταση `MOCK_MEMBERS`.

### P5 — ποιότητα, ασφάλεια, αξιολόγηση

- Tool allowlist ανά ρόλο + rate limit ανά tool (όχι μόνο ανά `/ai/chat`).
- Prompt injection: τα tool results μπαίνουν ως `role: tool`, ποτέ ως system από τον client.
- Audit log κάθε command (`actor`, `tool`, `input hash`, `entity ids`).
- Eval suite: 50 χρυσές προτροπές (EL/EN) με αναμενόμενα tools — αποτυχία CI αν καλέσει `send_message` χωρίς confirm.
- Accessibility: ActionCards με πληκτρολόγιο· skip-link παραμένει κρυφό μέχρι focus.
- Observability: latency ανά tool, fallback Ollama→κανόνας, ποσοστό confirms vs dismiss.

---

## 8. Modal / button / περιεχόμενο — κανόνες συνοχής

Αυτά ισχύουν για **κάθε** νέα ή παλιά επιφάνεια:

1. Κουμπί που αλλάζει δεδομένα έχει ένα ρήμα («Send intro», όχι «Submit»).
2. Κουμπί που ανοίγει AI έχει εικονίδιο Sparkles + ίδιο label «Ask AI».
3. Modal επιβεβαίωσης AI δείχνει **diff** (πριν/μετά) για profile/milestone/board.
4. Το περιεχόμενο που παράγει το AI φέρει σήμανση «Suggested» μέχρι confirm.
5. Δεδομένα που μοιράζονται (όνομα, avatar, role, match score) προέρχονται από ένα `EntityCard` component — όχι copy-paste ανά σελίδα.
6. Sample data (`DemoDataProvider`) **off** σε production builds· on μόνο στο `/demo` και preview host.
7. Κάθε empty state προσφέρει είτε δημιουργία είτε Ask AI, ποτέ και τα δύο ως ισότιμα primary.

---

## 9. Φάσεις παράδοσης (τεχνικές, όχι ημερολογιακές)

| Φάση | Παραδοτέα | Κριτήριο αποδοχής |
|---|---|---|
| **A — Truth** | RoleProvider root, query-keys, notification badge, νεκρά routes | Ένας χρήστης org-admin βλέπει org Work nav χωρίς χειροκίνητο localStorage. Edit profile ανανεώνει dashboard όνομα χωρίς refresh. |
| **B — Graph** | `GET /graph/me`, command facade, event invalidation | `graph/me` επιστρέφει unread + pending + readiness σε <200ms με ζεστό cache. |
| **C — Copilot read** | Context packet, persisted threads, citations | Στο `/matches` το AI αναφέρει συγκεκριμένα ονόματα από τα visible recommendations, όχι γενικότητες. |
| **D — Copilot write** | 6 tools + ActionCard | E2E: «connect with Elena» → draft → confirm → connection pending → Connections και badge +1. |
| **E — Work artifacts** | Canvas/builder/milestone tools | «Κάνε board από αυτή τη συνομιλία» δημιουργεί board με ≥3 nodes και link στο thread. |
| **F — Surface cleanup** | Feed απόφαση, calendar API ή αφαίρεση, admin/provider ενότητα | Κανένα nav item χωρίς SoT API. |
| **G — Eval & hardening** | 50-prompt suite, audit, rate limits | 0 unconfirmed writes σε eval. |

Κάθε φάση κλείνει με: unit tests στα tools, ένα browser walkthrough στα κρίσιμα routes, και ενημέρωση του preview (`preview-api.ts`) ώστε το `/demo` να δείχνει τη νέα ικανότητα χωρίς backend.

---

## 10. Μη-στόχοι (για να μείνει αντικειμενικό)

- Δεν αντικαθιστούμε το matching ML με LLM ranking.
- Δεν βάζουμε αυτόνομο agent να στέλνει μηνύματα τη νύχτα.
- Δεν ενώνουμε Ollama + OpenAI + Anthropic σε έναν «super model» χωρίς router· κρατάμε: chat/tools → Ollama (ή hosted compatible), long document → υπάρχον builder provider.
- Δεν αλλάζουμε παλέτα/themes· chrome, ακτίνες και empty states ανανεώνονται στο `PLATFORM_DESIGN_AI_PLAN.md`.
- Δεν κρατάμε νεκρά components «για αργότερα»· είτε δένονται είτε διαγράφονται στη φάση που τα αγγίζουμε.

---

## 11. Μετρικές επιτυχίας

| Μετρική | Ορισμός | Στόχος μετά τη φάση D |
|---|---|---|
| Task completion | % playbook βημάτων που κλείνουν χωρίς αλλαγή σελίδας >2 φορές | ≥ 60% στα 5 founder tasks |
| Tool precision | σωστό tool / προτροπή στα eval | ≥ 90% |
| Unconfirmed write rate | writes χωρίς ActionCard confirm | 0 |
| Context hit | απαντήσεις με τουλάχιστον 1 citation σε entity | ≥ 70% |
| UI consistency | σελίδες με διπλό header ή mock-only nav | 0 στις authenticated κύριες |
| Cache coherence | μετά από PATCH profile, όλες οι επιφάνειες δείχνουν νέο displayName σε <1s | 100% στα E2E |

---

## 12. Πρώτη υλοποιήσιμη τομή

Αν γίνει μόνο ένα πράγμα μετά από αυτό το πλάνο:

**Φάσεις A→D με τα 6 tools.**  
Αυτό μετατρέπει το σημερινό άδειο AI tab σε copilot που βλέπει τον χρήστη και μπορεί να συνδέσει / να γράψει μήνυμα / να πλοηγηθεί — πάνω στα API που ήδη υπάρχουν — χωρίς να ξαναχτιστεί η πλατφόρμα.

Ό,τι ακολουθεί (canvas, feed, calendar, extra ρόλοι) είναι επέκταση του ίδιου καταλόγου tools, όχι νέα «AI προϊόντα».

---

## 13. Υλοποίηση (2026-09-07)

Κλεισμένα σε αυτόν τον κλάδο (όχι ημερολογιακή υπόσχεση — μετρήσιμο στον κώδικα):

| Φάση | Κατάσταση | Πού |
|---|---|---|
| A — Truth | Μερικό | `RoleProvider` στο root layout. `query-keys.ts`. Notification badge από `GET /notifications/unread-count`. SideNav/MobileNav διαβάζουν `primaryRole`. |
| B — Graph | Ναι | `GET /api/graph/me` + preview mock. |
| C — Copilot read | Ναι | Context packet (`usePageContext`). Citations. Persisted threads + `/ai` full page. |
| D — Copilot write | Ναι | 6 tools + `ActionCard` confirm. Writes περνάνε από τα υπάρχοντα Connections/Messages APIs. |
| Full-page chat | Ναι | `/ai` (desktop drawer + mobile sheet-style column). Popup maximize → `/ai`. Ask AI buttons ανοίγουν την ίδια σελίδα. |
| Settings prefs | Ναι | `GET/PATCH /api/ai/preferences` (Prisma `AIUserPreference`) με localStorage fallback. |

Ανοιχτά (E–G και P2–P5): canvas/builder tools, feed Prisma, calendar SoT, eval suite 50 προτροπών, ενοποίηση realtime bus.

---

## 14. Παράρτημα — Multi-provider AI & ενοποιημένη τηλεμετρία

*Συμπληρωματικό υλικό από την ανεξάρτητη ανάλυση "Cognitive Core" (2026-09-05), δεν αντικαθιστά τίποτα από τα §1–13.*

### 14.1 Γιατί το `IAIProvider` παραμένει μονο-provider (Ollama) ενώ σχεδιάστηκε για πολλούς

`apps/api/src/ai/providers/ai-provider.interface.ts` δηλώνει ρητά στην τεκμηρίωσή του: *"Adding a new provider (OpenAI, Anthropic, Groq, etc.) requires: 1. Create a service that implements this interface 2. Register it with AIProviderRegistry..."* — και το Prisma σχόλιο του `BuilderAIGeneration.model` ήδη ανέμενε τιμές όπως `"claude-3-opus"`. Η πρόθεση για πολλαπλούς παρόχους υπήρχε από την αρχή· απλά δεν υλοποιήθηκε ποτέ δεύτερος. Το §5 του παρόντος πλάνου σωστά αποφεύγει να «ενώσει Ollama+OpenAI+Anthropic σε ένα super model χωρίς router» (§10) — αυτό το παράρτημα προτείνει *πώς* να προστεθεί ένας δεύτερος provider με σαφή ρόλο, όχι σε αντίθεση με εκείνη την αρχή αλλά ως η συγκεκριμένη υλοποίησή της.

### 14.2 Προτεινόμενο tiering (τιμές Ιανουαρίου 2026, ανά 1M tokens)

| Χρήση | Μοντέλο | Input / Output | Γιατί |
|---|---|---|---|
| Καθημερινό chat, όλα τα agent personas | `claude-sonnet-5` | $3 / $15 | Ισορροπία ποιότητας-κόστους για high-volume interactive chat με αξιόπιστο tool-calling |
| Βαριά σύνθεση (canvas-pitch, market-analyst deep dive, Phase E artifacts) | `claude-opus-5` | $5 / $25 | Μεγαλύτερη ικανότητα agentic reasoning όταν η σύνθεση αξίζει το κόστος |
| Φθηνό/γρήγορο triage, background jobs (`AIJobQueueService`) | `claude-haiku-4-5` | $1 / $5 | Εργασίες χαμηλής πολυπλοκότητας, μαζικές |
| Offline / fallback / cost-sensitive tenants | Ollama (τοπικό) | $0 | Διατηρείται όπως προδιαγράφει το §7 «graceful degradation» |

Το επιλεγμένο μοντέλο/provider ανά χρήστη προκύπτει από το ήδη υπάρχον `AIUserPreference.preferredProvider`/`preferredModel` (Prisma) — υλοποίηση ενός ήδη μοντελοποιημένου πεδίου, όχι νέο schema. Prompt caching στο σταθερό τμήμα κάθε system prompt (15 agent personas × μεγάλα, στατικά prompts) μετριάζει σημαντικά το κόστος tier 1.

### 14.3 Ενοποιημένη τηλεμετρία πέρα από το AI chat

Το §1.1 σωστά εντοπίζει ότι τα agents δεν βλέπουν `MatchInferenceLog`/`UserBehaviorSignal`. Πέρα από το `get_graph` tool του §5, υπάρχει ευκαιρία για μια read-only SQL view που ενώνει `AIUsageLog` + `MatchInferenceLog` + `NudgeLog` + `UserBehaviorSignal` ανά `userId` — ώστε ο `matching` agent να μπορεί να εξηγήσει ένα score παραθέτοντας το πραγματικό `MatchInferenceLog` αντί για γενική θεωρία, χωρίς να αλλάξει το ML pipeline του matching (§10 μη-στόχος παραμένει ακέραιος).

### 14.4 Πλήρης αφήγηση

Η αναλυτική, εικονογραφημένη εκδοχή αυτού του παραρτήματος (με πλήρη απογραφή πλατφόρμας, τεκμηρίωση κενών, και οπτικό υλικό) είναι δημοσιευμένη ως docket: "Cognitive Core" — βλ. σημείωση commit `feat: wire notification badge`.
