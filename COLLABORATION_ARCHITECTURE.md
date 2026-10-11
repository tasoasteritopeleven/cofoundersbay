# CoFounderBay — Collaborative Operating System: Technical Architecture

> Proof-based audit + schema design + collaboration-engine plan
> Produced after exhaustive inspection of schema.prisma (6249 lines, 120+ models),
> 3 WebSocket gateways, builder controller (406 lines), and all frontend hooks.

---

## 1. CURRENT STATE AUDIT

### 1A. Existing Relevant Entities (Verified in schema.prisma)

| Domain | Model | Lines | Status |
|--------|-------|-------|--------|
| **Builder Workspace** | `BuilderWorkspace` | 2541-2597 | ✅ Complete — owner, tenant, status, visibility, startup metadata |
| **Builder Document** | `BuilderDocument` | 2602-2647 | ✅ Complete — type enum (11 types), content Json, status lifecycle, version int, parentId chain |
| **Builder Document Section** | `BuilderDocumentSection` | 2652-2683 | ✅ Complete — sectionKey, content Json, AI suggestions, confidence |
| **Builder Document Version** | `BuilderDocumentVersion` | 2688-2710 | ✅ Exists — full document content snapshot per version number |
| **Builder Workspace Version** | `BuilderWorkspaceVersion` | 2715-2735 | ✅ Exists — full workspace state snapshot |
| **Builder Collaborator** | `BuilderCollaborator` | 2740-2767 | ✅ Complete — role enum (owner/editor/commenter/viewer), permissions Json override, notification prefs |
| **Builder Comment** | `BuilderComment` | 2772-2807 | ✅ Complete — inline anchoring (sectionKey, anchorText, anchorStart/End), threading (parentId), status (open/resolved/archived) |
| **Builder Section Comment** | `BuilderSectionComment` | 2812-2840 | ✅ Complete — section-level threaded comments |
| **Builder Review** | `BuilderReview` | 2845-2874 | ✅ Complete — requestedBy, reviewer, status (pending/approved/changes_requested/rejected), feedback, rating, dueDate |
| **Builder AI Generation** | `BuilderAIGeneration` | 2915-2955 | ✅ Complete — per-request tracking with cost, latency, caching |
| **Builder Application** | `BuilderApplication` | 2960-2989 | ✅ Complete — accelerator/grant application from workspace data |
| **Builder Template** | `BuilderTemplate` | 2994-3030 | ✅ Complete — reusable document templates with usage tracking |
| **Builder Activity Log** | `BuilderActivityLog` | 3096-3120 | ✅ Complete — action audit trail with change diffs |
| **Builder Readiness Score** | `BuilderReadinessScore` | 2879-2910 | ✅ Complete — 6 dimensions, criteria breakdown, recommendations |
| **Builder Export** | `BuilderExport` | 3064-3091 | ✅ Complete — PDF/PPTX/DOCX/JSON with status tracking |
| **Research Board** | `ResearchBoard` | 2341-2366 | ✅ Complete — owner, org, visibility, canvas state, tags |
| **Research Node** | `ResearchNode` | 2368-2411 | ✅ Complete — 60+ types, position, size, entity refs, content |
| **Research Connector** | `ResearchConnector` | 2413-2429 | ✅ Complete — from/to nodes, label, color, style |
| **Research Board Collaborator** | `ResearchBoardCollaborator` | 2431-2442 | ✅ Basic — role string (viewer/editor/admin) |
| **Research Comment** | `ResearchComment` | 2444-2459 | ✅ Basic — node-level, resolved flag, anchor position |
| **Workspace Comment** | `WorkspaceComment` | 4876-4908 | ✅ Complete — cross-section, commentType enum (general/suggestion/question/issue/approval), threading |
| **Expert Review** | `ExpertReview` | 4457-4499 | ✅ Complete — domain-specific structured feedback with scoring |
| **Mentor Review** | `MentorReview` | 5971-6004 | ✅ Complete — session-linked, multi-dimension rating |
| **Audit Log** | `AuditLog` | 5098-5119 | ✅ Complete — platform-wide, tenant-scoped |
| **Admin Audit Log** | `AdminAuditLog` | 2319-2335 | ✅ Complete — admin-specific with IP/UA |

### 1B. Existing Permissions (Verified)

| Scope | Model/Mechanism | Roles/Levels |
|-------|----------------|--------------|
| **Platform** | `User.role` enum | founder, mentor, investor, org, admin, super_admin |
| **Multi-Role** | `UserRoleFacet` | 18 role types × 5 scopes (global/tenant/workspace/community/program) |
| **Tenant** | `TenantMembership.role` | owner, admin, manager, member |
| **Organization** | `OrganizationMembership.role` | owner, admin, program_manager, mentor, reviewer, member |
| **Program** | `ProgramParticipant.role` | participant, mentor, judge, organizer, reviewer, observer |
| **Builder Workspace** | `BuilderCollaborator.role` | owner, editor, commenter, viewer + `permissions` Json override |
| **Research Board** | `ResearchBoardCollaborator.role` | viewer, editor, admin (string, not enum) |
| **Group** | `GroupMember.role` | owner, admin, moderator, member |
| **Visibility** | `BuilderWorkspaceVisibility` | private, team, organization, public |
| **Visibility** | `ResearchBoardVisibility` | private, team, organization, public |
| **API Keys** | `ApiKey.scopes` | String array of scoped permissions |
| **Feature Flags** | `FeatureFlag` + `TenantFeatureFlag` | global/tenant/user/role/plan scoping |

### 1C. Existing Collaboration Primitives (Verified)

| Primitive | Location | Status |
|-----------|----------|--------|
| **Builder WebSocket Gateway** | `builder.gateway.ts` (606 lines) | ✅ Full — workspace rooms, document rooms, cursor tracking, selection tracking, content ops (insert/delete/replace), section updates, comment/review real-time, typing indicators, activity broadcast |
| **Research WebSocket Gateway** | `research.gateway.ts` (265 lines) | ✅ Moderate — board rooms, presence (online/offline), cursor broadcast, node move/update, comment create/resolve |
| **Frontend Builder Socket** | `useBuilderSocket.ts` (340 lines) | ✅ Full — mirrors all gateway events, collaborator state, workspace member state |
| **Frontend Research Socket** | `useResearchCollaboration.ts` (188 lines) | ✅ Moderate — presence, cursors, node events, comments |
| **Messaging Socket** | `messagingSocket.ts` | ✅ Separate system — hardened reconnection |

### 1D. Existing Version/History Primitives (Verified)

| Mechanism | Where | How it works |
|-----------|-------|-------------|
| `BuilderDocumentVersion` | Schema line 2688 | Full JSON content snapshot per version number. Created on explicit save. |
| `BuilderWorkspaceVersion` | Schema line 2715 | Full workspace state snapshot. |
| `BuilderDocument.version` + `parentId` | Schema line 2627-2629 | Integer version counter + parent chain for lineage tracking |
| `BuilderDocument.isLatest` | Schema line 2628 | Flag to mark current head version |
| `BuilderActivityLog.changes` | Schema line 3109 | JSON `{ field: { old, new } }` per-field change tracking |
| `DataRoomDocument.version` | Schema line 4343 | Simple integer version counter |
| **Research Board** | None | ❌ **No versioning at all** — no snapshot, no history, no undo persistence |

### 1E. Reusable Pieces

1. **`BuilderDocument` + `BuilderDocumentSection` + `BuilderDocumentVersion`** — This is already a solid artifact + section + version system for structured documents. Can be extended to serve as the unified Artifact model.
2. **`BuilderCollaborator`** with role enum + permissions JSON override — Already supports the core access model.
3. **`BuilderReview`** — Already has request/assign/status/feedback/rating. Can be extended for formal review workflows.
4. **`BuilderComment` + `BuilderSectionComment`** — Already has inline anchoring, threading, and resolution. Covers both document-level and section-level commenting.
5. **`BuilderActivityLog`** — Already logs actions with change diffs. Serves as audit trail.
6. **`BuilderGateway`** — Already has document rooms, cursor/selection tracking, content ops, typing indicators. This is the real-time collaboration backbone.
7. **`WorkspaceComment`** with `commentType` enum — Already differentiates general/suggestion/question/issue/approval. Reusable for structured review feedback.
8. **`ExpertReview`** — Already has domain-specific review types, structured scoring, compensation tracking.
9. **`UserRoleFacet`** — Multi-role system with scoped permissions. Reusable for artifact-level role resolution.

### 1F. Duplicated / Parallel Pieces

| Issue | Details |
|-------|---------|
| **3 separate comment systems** | `BuilderComment` (document-level), `BuilderSectionComment` (section-level), `WorkspaceComment` (workspace cross-section), `ResearchComment` (node-level). These should be unified under one polymorphic comment model. |
| **2 separate collaborator models** | `BuilderCollaborator` (enum role + JSON perms) vs `ResearchBoardCollaborator` (string role, no perms). Research should adopt Builder's richer model. |
| **2 separate review systems** | `BuilderReview` (document review) and `ExpertReview` (domain review). Different enough to keep separate, but should share a common review interface. |
| **No shared Artifact abstraction** | `BuilderDocument`, `ResearchNode`, `DataRoomDocument`, `ProductRequirementDoc` are all separate entity types with no unified artifact interface. |

### 1G. Missing Pieces

| Gap | Severity | Description |
|-----|----------|-------------|
| **No CRDT/OT engine** | 🔴 Critical | `content:update` ops in gateway are simple broadcast — no conflict resolution, no operational transform, no CRDT merge. Two users editing the same paragraph will corrupt content. |
| **No branch/draft model** | 🟡 High | No `ArtifactBranch` or `DraftVariant`. Users can't create parallel versions for review without overwriting mainline. |
| **No merge/proposal flow** | 🟡 High | No `ChangeProposal`, `ProposalMerge`, `ProposalConflict`. Reviews exist but cannot approve/merge specific changes. |
| **No diff engine** | 🟡 High | No server-side or client-side diff computation for any artifact type. Versions are stored but never compared. |
| **No publish/share snapshot** | 🟠 Medium | `BuilderExport` tracks file exports but there's no immutable `PublishedVersion` or `ShareSnapshot` for external stakeholders. |
| **No research board versioning** | 🟠 Medium | Canvas has no persistence of undo history, no snapshots, no version lineage. |
| **No artifact-level share tokens** | 🟠 Medium | External reviewer access requires platform account. No time-limited anonymous share links for specific artifacts. |
| **No structured diff for BMC/SWOT** | 🟠 Medium | All diffs would need to be field-aware for structured artifact types. |
| **No CRDT operation log** | 🔴 Critical | No `CRDTOperationLog`, no `SyncCheckpoint`. Real-time edits are ephemeral — if a client disconnects mid-edit, changes can be lost. |
| **No presence persistence** | 🟢 Low | Presence is in-memory only. Acceptable for now. |

---

## 2. SCHEMA / ENTITY RECOMMENDATION

### 2A. Unified Artifact Layer (Extend, Don't Replace)

The **existing `BuilderDocument`** is 90% of what an Artifact model needs. Rather than creating a parallel `Artifact` table, I recommend:

**Decision: Extend `BuilderDocument` + `BuilderDocumentType` enum**

```
Extend BuilderDocumentType to include:
  // Existing (keep)
  idea_core, business_model_canvas, market_analysis, pitch_deck,
  mvp_plan, financial_plan, technical_architecture, prd,
  branding_kit, application, custom

  // Add (new)
  swot_analysis, lean_canvas, competitive_analysis, customer_personas,
  go_to_market, fundraising_memo, venture_memo, investor_update,
  mentor_feedback, evaluator_scorecard, strategy_doc, meeting_notes,
  board_minutes, term_sheet, cap_table, team_charter,
  partnership_agreement, founder_agreement, vesting_schedule,
  product_roadmap, sprint_plan, retrospective, user_research,
  ab_test_plan, growth_model, unit_economics, cohort_analysis
```

**No new `Artifact` table needed.** `BuilderDocument` already has:
- `type` → artifact type
- `content` Json → flexible structured content
- `contentSchema` → schema version for content structure
- `status` → lifecycle (draft/in_progress/review/approved/archived)
- `version` + `parentId` → version lineage
- `sections` → granular editing
- `comments` + `reviews` → collaboration

### 2B. New Entities Required

#### `ArtifactBranch` (NEW — for draft variants / proposals)

```prisma
model ArtifactBranch {
  id            String          @id @default(uuid())
  documentId    String
  document      BuilderDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  name          String          // "mentor-review-draft", "v2-rewrite", "pitch-overhaul"
  description   String?         @db.Text
  createdById   String

  // Branch state
  baseVersionId String          // BuilderDocumentVersion.id this branched from
  content       Json            // Current branch content
  status        String          @default("open") // "open", "review", "merged", "closed", "abandoned"

  // Merge metadata
  mergedAt      DateTime?
  mergedById    String?
  mergeVersionId String?        // The version created by merge

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  proposals     ChangeProposal[]

  @@index([documentId])
  @@index([createdById])
  @@index([status])
}
```

#### `ChangeProposal` (NEW — for structured review requests)

```prisma
model ChangeProposal {
  id            String         @id @default(uuid())
  branchId      String
  branch        ArtifactBranch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  documentId    String

  title         String
  description   String?        @db.Text
  createdById   String

  // Review state
  status        String         @default("open") // "open", "approved", "changes_requested", "merged", "closed"

  // Diff metadata (computed on creation / update)
  diffSummary   Json?          // { sectionsChanged: [...], fieldsAdded: [...], fieldsRemoved: [...] }
  changedSections String[]     @default([])

  // Reviewer assignments
  reviewerIds   String[]       @default([])

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  mergedAt      DateTime?

  @@index([branchId])
  @@index([documentId])
  @@index([status])
}
```

#### `ArtifactShareLink` (NEW — for external reviewer / stakeholder access)

```prisma
model ArtifactShareLink {
  id            String          @id @default(uuid())
  documentId    String?
  workspaceId   String?
  versionId     String?         // Optional: pin to specific version

  // Access config
  token         String          @unique // URL-safe random token
  permissions   String          @default("view") // "view", "comment", "suggest"
  password      String?         // Optional password protection
  expiresAt     DateTime?
  maxViews      Int?
  viewCount     Int             @default(0)

  // Creator
  createdById   String
  isActive      Boolean         @default(true)

  createdAt     DateTime        @default(now())

  @@index([token])
  @@index([documentId])
  @@index([workspaceId])
  @@index([isActive])
}
```

#### `CRDTSyncState` (NEW — for real-time collaboration persistence)

```prisma
model CRDTSyncState {
  id            String   @id @default(uuid())
  documentId    String   @unique
  sectionKey    String?

  // Yjs document state
  yjsState      Bytes    // Y.Doc encoded state vector
  yjsUpdate     Bytes?   // Latest merged update

  // Checkpoint metadata
  lastClientId  String?
  operationCount Int     @default(0)
  lastSyncAt    DateTime @default(now())

  // Snapshot for cold-start
  snapshotContent Json?  // Full content snapshot for clients that can't replay ops
  snapshotAt      DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([documentId, sectionKey])
  @@index([documentId])
  @@index([lastSyncAt])
}
```

### 2C. Entities to Normalize (Not Create)

| Current | Action |
|---------|--------|
| `ResearchBoardCollaborator.role` (string) | Migrate to enum matching `BuilderCollaboratorRole` |
| `ResearchComment` | Add `parentId` for threading, add `commentType` enum matching `WorkspaceCommentType` |
| `BuilderComment` + `BuilderSectionComment` | Keep both (different anchoring semantics), but ensure consistent status enums |
| `BuilderDocument.version` int | Keep as-is — the `BuilderDocumentVersion` snapshots provide the full history |

### 2D. Startup-Specific Entity Mappings

| Artifact Type | Maps To | Owner Scope |
|---------------|---------|-------------|
| Business Plan | `BuilderDocument` (type: custom) | Workspace |
| BMC | `BuilderDocument` (type: business_model_canvas) | Workspace |
| SWOT | `BuilderDocument` (type: swot_analysis) | Workspace |
| Pitch Deck | `BuilderDocument` (type: pitch_deck) | Workspace |
| PRD | `ProductRequirementDoc` (keep separate — has specialized fields) | Workspace |
| Research Board | `ResearchBoard` + `ResearchNode[]` | Board |
| Application Draft | `BuilderApplication` | Workspace |
| Venture Memo | `BuilderDocument` (type: venture_memo) | Workspace |
| Mentor Feedback | `BuilderDocument` (type: mentor_feedback) OR `ExpertReview` | Workspace/User |
| Data Room Docs | `DataRoomDocument` (keep — has access logging) | Round/Workspace |
| Canvas Nodes | `ResearchNode` (60+ types) | Board |

---

## 3. PERMISSIONS MODEL

### 3A. Actor Types (All Already Exist in Schema)

| Actor | Resolution Path |
|-------|----------------|
| **Founder / Owner** | `BuilderWorkspace.ownerId` OR `ResearchBoard.ownerId` |
| **Team Member** | `BuilderCollaborator` with role = editor/commenter/viewer |
| **Mentor** | `MentorshipRelationship` → workspace link, OR `BuilderCollaborator` with viewer/commenter role |
| **Advisor** | `BuilderCollaborator` with commenter role |
| **Reviewer (internal)** | `BuilderReview.reviewerId` — assigned per document |
| **Evaluator (program)** | `ProgramParticipant` with role = reviewer/judge |
| **Program Manager** | `OrganizationMembership.role = program_manager` |
| **Tenant Admin** | `TenantMembership.role = owner/admin` |
| **External Reviewer** | `ArtifactShareLink` with permissions = comment/suggest |
| **Read-only Stakeholder** | `ArtifactShareLink` with permissions = view |
| **Platform Admin** | `User.role = admin/super_admin` |

### 3B. Action Matrix

| Action | owner | editor | commenter | viewer | reviewer | external (view) | external (comment) | admin |
|--------|-------|--------|-----------|--------|----------|-----------------|-------------------|-------|
| View document | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Suggest (inline) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Edit mainline | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create branch | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Request review | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve/reject review | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Merge branch | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Resolve comments | ✅ | ✅ | own only | ❌ | ✅ | ❌ | ❌ | ✅ |
| Publish/finalize | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Share externally | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Export | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Archive | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Restore from archive | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Admin override | — | — | — | — | — | — | — | ✅ |

*editor can merge only if review is approved

### 3C. Access Resolution Order

```
1. Is user platform admin? → full access
2. Is user workspace owner? → full access
3. Is user a BuilderCollaborator? → use role + permissions JSON override
4. Is user in a linked tenant? → check TenantMembership.role
5. Is user a program participant? → check ProgramParticipant.role
6. Is workspace visibility public? → view access
7. Does an ArtifactShareLink exist with valid token? → use link permissions
8. Default → no access
```

### 3D. Reviewer / External Access Rules

- **Internal reviewer**: Added via `BuilderReview` assignment. Gets `reviewer` permissions on that specific document only (not the whole workspace).
- **External reviewer (no account)**: Gets an `ArtifactShareLink` with permissions = "comment". Can view and annotate but cannot edit mainline. Link has expiry.
- **Program evaluator**: Has `ProgramParticipant.role = reviewer/judge`. Gets view + comment access to all workspace documents linked to that program.
- **Mentor**: If linked via `MentorshipRelationship.workspaceId`, gets commenter access. Can be elevated to reviewer per document.

---

## 4. VERSIONING MODEL

### 4A. What Constitutes a Version

| Trigger | Creates Version? | Type |
|---------|-----------------|------|
| Manual save / "Create checkpoint" button | ✅ | `explicit` |
| Auto-save after significant edit (≥ 500 char diff OR 5-minute idle) | ✅ | `autosave` |
| Before merge from branch | ✅ | `pre_merge` |
| After merge from branch | ✅ | `merge` |
| Before review submission | ✅ | `review_snapshot` |
| Export / publish | ✅ | `published` |
| Every keystroke | ❌ | Handled by CRDT, not versioning |

### 4B. Version Granularity (Hybrid Strategy)

| Artifact Type | Strategy |
|---------------|----------|
| **Rich text docs** (business plans, memos, PRDs) | CRDT operation log for real-time + periodic JSON snapshots for version history |
| **Structured forms** (BMC, SWOT, lean canvas) | Full JSON snapshot per version (small payloads, field-level changes) |
| **Canvas/boards** | Board-level JSON snapshot (nodes + connectors + canvasState) on explicit save |
| **Mixed/hybrid** | Section-level: CRDT for rich text sections, JSON snapshot for structured sections |

### 4C. Version Lifecycle

```
                    ┌──────────────┐
                    │   DRAFT      │ ← working copy (mainline or branch)
                    └──────┬───────┘
                           │ user edits (CRDT / autosave)
                           ▼
                    ┌──────────────┐
                    │  CHECKPOINT  │ ← explicit save or autosave threshold
                    └──────┬───────┘
                           │ request review
                           ▼
                    ┌──────────────┐
                    │ IN REVIEW    │ ← linked to BuilderReview
                    └──────┬───────┘
                      ┌────┴────┐
                      ▼         ▼
               ┌──────────┐ ┌──────────────┐
               │ APPROVED │ │ CHANGES REQ. │
               └─────┬────┘ └──────┬───────┘
                     │              │ iterate → new checkpoint
                     ▼              ▼
              ┌──────────────┐
              │  PUBLISHED   │ ← immutable snapshot, can be shared externally
              └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  ARCHIVED    │ ← soft-delete, restorable
              └──────────────┘
```

### 4D. Branch / Draft Variant Flow

```
MAINLINE (BuilderDocument, version N)
    │
    ├── Branch A: "mentor-review-draft"
    │   └── Content = snapshot of mainline @ version N + edits
    │   └── ChangeProposal → assigned to reviewer
    │   └── Status: open → review → approved → merged (creates version N+1)
    │
    ├── Branch B: "investor-pitch-v2"
    │   └── Independent edits
    │   └── Can be merged later (may conflict with N+1)
    │
    └── Branch C: "evaluator-feedback"
        └── Reviewer makes suggested changes on a branch
        └── Owner reviews diff and merges selectively
```

### 4E. Restore / Rollback Logic

- **Restore creates a new version** — never overwrites history
- Restoring version 3 when current is version 7 → creates version 8 with content of version 3
- Audit trail records: `{ action: "document.restored", changes: { fromVersion: 7, restoredVersion: 3, newVersion: 8 } }`
- Requires `editor` or `owner` role
- Restoring a published version requires `owner` role

### 4F. Artifact-Specific Versioning

| Artifact Type | Versioning Behavior |
|---------------|-------------------|
| **Rich text docs** | Full content snapshot + optional CRDT state backup |
| **BMC / SWOT** | JSON snapshot of all fields. Diff shows field-level changes. |
| **Canvas/board** | JSON snapshot of all nodes + connectors. Diff shows added/removed/moved nodes. |
| **Pitch deck** | Per-slide snapshots within the overall document JSON |
| **AI-generated drafts** | Marked with `aiGenerated: true`. First human edit creates a new non-AI version. |
| **External submissions** | Version on submission. Submitted version becomes immutable. |

---

## 5. DIFF / COMPARE MODEL

### 5A. Rich Text Documents

**Recommended strategy: Block-level diff with semantic grouping**

```typescript
interface RichTextDiff {
  type: 'block_diff';
  changes: BlockChange[];
  summary: { added: number; removed: number; modified: number };
}

interface BlockChange {
  blockId: string;         // paragraph/heading/list ID
  changeType: 'added' | 'removed' | 'modified' | 'moved';
  oldContent?: string;     // for modified/removed
  newContent?: string;     // for added/modified
  inlineDiffs?: InlineDiff[]; // character-level within modified blocks
}
```

- Use a library like `diff-match-patch` (Google) for inline diffs within paragraphs
- Group consecutive single-line changes into "change regions" for readability
- Heading-level navigation: "Jump to changed sections"

### 5B. Structured Startup Artifacts (BMC, SWOT, Lean Canvas)

**Recommended strategy: Field-aware JSON diff**

```typescript
interface StructuredDiff {
  type: 'field_diff';
  artifactType: string;    // 'business_model_canvas', 'swot_analysis'
  changes: FieldChange[];
  summary: { fieldsChanged: number; fieldsAdded: number; fieldsRemoved: number };
}

interface FieldChange {
  sectionKey: string;      // 'value_propositions', 'strengths', 'threats'
  sectionLabel: string;    // Human-readable: "Value Propositions"
  fieldPath: string;       // JSON path within section
  changeType: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
}
```

- For BMC: 9 blocks, each compared independently
- For SWOT: 4 quadrants, list-level diff (added/removed items)
- For financial models: numeric field comparison with delta indicators (↑12%, ↓3K)

### 5C. Canvas / Research Board Artifacts

**Recommended strategy: Entity-level structural diff**

```typescript
interface CanvasDiff {
  type: 'canvas_diff';
  nodes: {
    added: NodeSummary[];
    removed: NodeSummary[];
    modified: NodeModification[];
    moved: NodeMovement[];        // position changed but content didn't
  };
  connectors: {
    added: ConnectorSummary[];
    removed: ConnectorSummary[];
    modified: ConnectorModification[];
  };
  metadata: {
    changed: MetadataChange[];    // board title, tags, etc.
  };
}
```

- Node content changes use the rich text diff strategy (5A)
- Position-only changes are shown as "Layout changes" — lower visual priority
- Connector changes are shown as relationship additions/removals

### 5D. Compare Modes

| Mode | Use Case | Implementation |
|------|----------|---------------|
| **Current vs. Proposed** | Branch review | Diff branch content against mainline HEAD |
| **Version vs. Version** | History comparison | Diff two `BuilderDocumentVersion` snapshots |
| **Published vs. Current** | Detect drift | Diff last published version against working copy |
| **Draft vs. Base** | Branch freshness | Diff branch content against its base version |
| **Changed sections only** | Quick review | Filter diff to only show modified sections |
| **Unresolved changes only** | Focus review | Show only changes that have open comments |

### 5E. Merge-Time Diff

- Before merge: show side-by-side diff of branch vs current mainline
- **Conflict detection**: If mainline has advanced since branch was created (baseVersion < currentVersion), identify sections that were modified in both
- **Conflict resolution**: For structured artifacts, per-field "keep mine / keep theirs / manual merge". For rich text, show conflict markers with both versions.
- **Auto-merge**: For non-conflicting changes (different sections), merge automatically with user confirmation

---

## 6. CRDT / REAL-TIME COLLABORATION MODEL

### 6A. Recommended Stack: **Yjs**

| Criterion | Yjs | Automerge | OT (custom) |
|-----------|-----|-----------|-------------|
| Rich text support | ✅ Excellent (Y.XmlFragment) | 🟡 Adequate | 🟡 Manual |
| JSON/structured data | ✅ Y.Map, Y.Array | ✅ Native | ❌ Not designed for |
| Editor integrations | ✅ TipTap, ProseMirror, CodeMirror, Quill | 🟡 Fewer | ❌ Custom |
| Binary encoding size | ✅ Small (lib0) | 🟡 Larger | N/A |
| Maturity | ✅ 7+ years, widely deployed | 🟡 Active but newer | ❌ Build from scratch |
| WebSocket integration | ✅ y-websocket, y-socket.io | 🟡 Custom needed | ❌ Custom |
| Persistence | ✅ y-indexeddb, custom providers | 🟡 Custom | ❌ Custom |
| Fits existing NestJS gateways | ✅ y-socket.io drops into existing gateway pattern | 🟡 Custom adapter | ❌ Full rewrite |

**Verdict: Yjs is the clear winner** for CoFounderBay's needs.

### 6B. Suitability by Artifact Type

| Artifact Type | Collaboration Mode | Rationale |
|---------------|-------------------|-----------|
| **Rich text docs** (business plans, memos) | ✅ CRDT (Yjs + TipTap) | Multi-user editing with automatic conflict resolution |
| **Structured forms** (BMC, SWOT, lean canvas) | ✅ CRDT (Y.Map per field) | Each field is a separate Y.Map entry — no cross-field conflicts |
| **Canvas/board** | ✅ CRDT (Y.Map per node) | Each node is independent. Position = Y.Map field. Content = Y.XmlFragment. |
| **Pitch deck slides** | ✅ CRDT per slide | Each slide is a Y.Map. Content within is Y.XmlFragment. |
| **Financial models** | 🟡 Transactional preferred | Numeric consistency matters more than concurrent editing. Use CRDT for metadata, transactional locks for formulas. |
| **Evaluator scorecards** | ❌ Transactional | One evaluator per scorecard. No concurrent editing needed. |
| **Application forms** | ❌ Transactional | One applicant fills in. No concurrent editing. |

### 6C. Persistence Strategy

```
Client (Yjs Y.Doc)
    │
    ├── Local: y-indexeddb (offline support, instant load)
    │
    ├── WebSocket: y-socket.io adapter in BuilderGateway
    │   └── On connect: client sends state vector
    │   └── Server responds with missing updates
    │   └── Bi-directional sync via awareness + updates
    │
    └── Server Persistence:
        ├── CRDTSyncState.yjsState (Bytes) — server-side Y.Doc state
        ├── Periodic snapshot → BuilderDocumentVersion (every 5 min or on explicit save)
        └── On disconnect of last client → flush to DB + create autosave version
```

**Snapshot intervals**: Every 5 minutes of active editing OR when the last client disconnects. This keeps the `BuilderDocumentVersion` table manageable while ensuring no data loss.

### 6D. Awareness / Presence

- **Yjs Awareness protocol**: Built-in, broadcasts cursor position, selection range, user info
- **Scope**: Per-document awareness (not global). Each open document has its own awareness instance.
- **Section-level soft awareness**: Show colored indicators on BMC/SWOT blocks when another user has focus there. Not a hard lock — just visual feedback.
- **Already partially implemented**: `BuilderGateway` already tracks `CollaboratorPresence` with cursor + selection. The Yjs awareness protocol can replace this with a more robust implementation.

### 6E. Conflict Handling

| Scenario | Resolution |
|----------|-----------|
| **Live concurrent rich text edits** | Yjs CRDT handles automatically — character-level merge |
| **Live concurrent structured field edits** | Y.Map per field — last write wins per field, but different fields merge cleanly |
| **Live concurrent canvas node moves** | Y.Map per node — position is a single field, last write wins. Acceptable UX. |
| **Stale branch vs updated mainline** | Server-side diff at merge time. Highlight conflicting sections. User resolves. |
| **Offline edits sync** | y-indexeddb preserves local Y.Doc. On reconnect, Yjs syncs automatically. |

### 6F. Performance Implications

| Concern | Mitigation |
|---------|-----------|
| **Y.Doc size growth** | Yjs garbage collection (`gc: true`). Periodic state compaction on server. |
| **Editor hydration cost** | Load from y-indexeddb first (instant), then sync with server. |
| **Client memory** | Y.Doc for a typical startup document: 50-500KB. Acceptable. |
| **Server sync load** | One NestJS gateway process handles rooms. For >50 concurrent editors per doc, consider extracting to a dedicated Yjs server. |
| **Snapshot intervals** | 5-minute snapshots prevent excessive DB writes while ensuring durability. |
| **Lazy loading** | Load Y.Doc only for the document being edited. Don't preload all workspace docs. |
| **Binary encoding** | Yjs lib0 encoding is ~10x smaller than JSON. Network overhead is minimal. |

### 6G. Integration Plan with Current Architecture

```
Current:                          Target:
┌─────────────────┐              ┌─────────────────┐
│ BuilderGateway   │              │ BuilderGateway   │
│ (socket.io)      │              │ (socket.io)      │
│                  │              │                  │
│ content:update   │ ──replace──▶ │ yjs:sync         │ ← y-socket.io provider
│ section:update   │              │ yjs:awareness    │
│ cursor:move      │ ──keep──────▶│ cursor:move      │ ← for non-CRDT views
│ comment:add      │ ──keep──────▶│ comment:add      │
│ review:submit    │ ──keep──────▶│ review:submit    │
│ typing:start/stop│ ──replace──▶ │ (Yjs awareness)  │
└─────────────────┘              └─────────────────┘
```

The `content:update` and `section:update` events get replaced by the Yjs sync protocol. All other events (comments, reviews, activity) stay as-is.

---

## 7. ARCHITECTURE RISKS / TRADEOFFS

### 7A. Complexity Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Yjs integration requires editor migration to TipTap/ProseMirror | 🟡 Medium | If current editors are simple `<textarea>` or basic RTE, migration to TipTap is moderate effort. TipTap has excellent Yjs binding. |
| Branch/merge model adds UI complexity | 🟡 Medium | Start with simple "create draft copy" → "request review" → "apply changes" flow. Don't build full Git-like branching UI on day 1. |
| Multi-type diff engine is significant work | 🟡 Medium | Implement rich text diff first (covers 70% of use cases). Add structured diff for BMC/SWOT in phase 2. Canvas diff in phase 3. |
| Permission resolution across 7+ layers | 🟡 Medium | Implement as a single `resolvePermissions(userId, artifactId)` service that checks all layers in order. Cache result per request. |

### 7B. Overengineering Risks

| Risk | Decision |
|------|----------|
| Full CRDT for everything | ❌ Don't. Use transactional editing for financial models, scorecards, application forms. |
| Graph-based version DAG | ❌ Don't. Linear version history + branches is sufficient. No need for Git-like DAG. |
| Custom OT implementation | ❌ Don't. Yjs is proven and maintained. |
| Separate "Artifact" table | ❌ Don't. Extend existing `BuilderDocument`. Avoid migration nightmare. |
| Cross-document CRDT sync | ❌ Don't. Each document gets its own Y.Doc. No need for workspace-level CRDT. |

### 7C. Performance Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Large Y.Doc for very long documents | 🟢 Low | GC + periodic compaction. Typical startup docs are 5-50 pages. |
| Many concurrent editors on one doc | 🟢 Low | Startup teams are 2-8 people. Even accelerator reviews have <20 concurrent viewers. |
| Version table growth | 🟡 Medium | Auto-prune autosave versions older than 30 days, keep explicit/published/merge versions forever. |
| Snapshot storage cost | 🟢 Low | JSON snapshots compress well. ~1KB per BMC version, ~10KB per business plan version. |

### 7D. Schema Migration Risk

| Change | Risk | Notes |
|--------|------|-------|
| Extending `BuilderDocumentType` enum | 🟢 None | Additive enum change, no data migration |
| Adding `ArtifactBranch` table | 🟢 None | New table, no existing data affected |
| Adding `ChangeProposal` table | 🟢 None | New table |
| Adding `ArtifactShareLink` table | 🟢 None | New table |
| Adding `CRDTSyncState` table | 🟢 None | New table |
| Normalizing `ResearchBoardCollaborator.role` to enum | 🟡 Low | Data migration needed (string → enum), but table is small |

---

## 8. SAFEST IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-3) — LOW RISK

**Goal: Establish the versioning and branching infrastructure without touching real-time editing.**

1. **Extend `BuilderDocumentType` enum** with all new artifact types
2. **Create `ArtifactBranch` + `ChangeProposal` tables** (Prisma migration)
3. **Create `ArtifactShareLink` table** (Prisma migration)
4. **Add REST endpoints** for branch CRUD, proposal CRUD, share link CRUD
5. **Add version comparison endpoint** — `GET /builder/documents/:id/versions/:v1/compare/:v2`
6. **Implement rich text diff service** — `diff-match-patch` for paragraph-level diff
7. **Implement structured diff service** — field-aware JSON comparison for BMC/SWOT
8. **Normalize `ResearchBoardCollaborator.role`** to enum

**What NOT to touch**: Real-time editing, WebSocket gateways, frontend editors.

### Phase 2: Diff & Review UX (Weeks 4-6) — LOW-MEDIUM RISK

**Goal: Make branching and review usable in the UI.**

1. **Version history panel** in builder document view — list versions, view diffs
2. **Branch creation UI** — "Create Draft Copy" button on documents
3. **Side-by-side diff viewer** component — rich text + structured artifact support
4. **Review request flow** — link `ChangeProposal` to `BuilderReview`
5. **Merge UI** — simple "Apply Changes" with conflict highlighting
6. **External share link generation** — UI for creating/managing share links
7. **External viewer page** — read-only (or comment-enabled) view via share token

**What NOT to touch**: Real-time CRDT. Reviews and branches work with HTTP save, not live editing.

### Phase 3: CRDT Integration (Weeks 7-10) — MEDIUM RISK

**Goal: Add real-time collaborative editing for rich text documents.**

1. **Install Yjs + y-socket.io + y-indexeddb** in both API and web
2. **Create `CRDTSyncState` table** (Prisma migration)
3. **Add Yjs provider to `BuilderGateway`** — new `yjs:sync` and `yjs:awareness` events
4. **Migrate rich text editor to TipTap** with `@tiptap/extension-collaboration` (Yjs binding)
5. **Server-side Yjs persistence** — flush Y.Doc to `CRDTSyncState` on disconnect + periodic snapshots
6. **Snapshot-to-version bridge** — periodic Y.Doc → JSON → `BuilderDocumentVersion`
7. **Test with 2-3 concurrent editors** on same document

**What NOT to touch**: Structured forms (BMC/SWOT), canvas. Those stay transactional for now.

### Phase 4: Structured Artifact CRDT + Canvas Versioning (Weeks 11-14) — MEDIUM RISK

**Goal: Extend CRDT to structured forms and add canvas versioning.**

1. **Y.Map-based CRDT for BMC/SWOT** — each field is a Y.Map entry
2. **Canvas board snapshots** — "Save Board" creates a `ResearchBoardVersion` (new model)
3. **Canvas diff engine** — node-level structural comparison
4. **Board version history UI** — restore previous board states
5. **Permission enforcement** on CRDT sync — reject updates from users without edit permission

### Phase 5: Polish & External Collaboration (Weeks 15-18) — LOW RISK

**Goal: External reviewer workflows and enterprise features.**

1. **External reviewer comment flow** — via share link with "comment" permission
2. **Suggestion mode** — inline suggestions that create `WorkspaceComment` with type = "suggestion"
3. **Notification integration** — review requested, review completed, comment mentions
4. **Permission audit log** — log all access to shared artifacts
5. **Auto-prune old autosave versions** (>30 days, non-explicit)
6. **Performance optimization** — lazy Y.Doc loading, connection pooling

### What to AVOID Touching Early

- **Messaging system** — completely separate, already hardened
- **AI generation pipeline** — already has BullMQ jobs, rate limits, provider abstraction
- **Matching/recommendation engine** — unrelated to collaboration
- **Billing/subscription** — stable, don't regress
- **Authentication/SSO** — stable, don't regress

### Lowest-Regression Path

The entire Phase 1 and Phase 2 are **purely additive** — new tables, new endpoints, new UI components. Zero changes to existing functionality. Phase 3 is the highest-risk phase because it replaces the `content:update` socket event with Yjs sync, but this can be feature-flagged per workspace.

---

## MANDATORY AUDIT ANSWERS

1. **Existing entities that resemble workspace/board/node/document/comment/collaborator/review/version/artifact/export/share/publish**:
   All exist. See Section 1A for complete inventory with schema line numbers.

2. **Permissions logic scope**:
   7-layer scoped system. See Section 3 for full matrix.

3. **Partial versioning/audit logs**:
   `BuilderDocumentVersion` provides full JSON snapshots. `BuilderActivityLog` provides per-action audit with change diffs. Research board has NO versioning.

4. **Comments/discussions extensible to review logic**:
   Yes. `BuilderComment` already has inline anchoring + threading + resolution. `BuilderReview` already has request/assign/feedback/rating. These just need to be connected to the new branch/proposal flow.

5. **Reusable data model parts**:
   `BuilderDocument` + `BuilderDocumentSection` + `BuilderDocumentVersion` + `BuilderCollaborator` + `BuilderComment` + `BuilderReview` + `BuilderActivityLog`. See Section 1E.

6. **Dangerously duplicated parts**:
   4 separate comment systems, 2 separate collaborator models. See Section 1F.

7. **Schema gaps preventing proper collaboration**:
   No CRDT persistence, no branch/draft model, no merge flow, no diff engine, no share tokens, no research board versioning. See Section 1G.

8. **Artifact types that should NOT share diff/CRDT strategy**:
   Financial models (transactional), evaluator scorecards (single-user), application forms (single-user). See Section 6B.

9. **What to implement first**:
   Phase 1 (versioning + branching infrastructure) — purely additive, zero regression risk. See Section 8.
