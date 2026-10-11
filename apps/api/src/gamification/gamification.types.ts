import { XPEventType } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// MATHEMATICAL DESIGN PRINCIPLES
// ════════════════════════════════════════════════════════════════════════════
//
// 1. BOUNDED SCORES  — all public scores ∈ [0, 100].
// 2. MONOTONIC CUMULATION — XP only rises; readiness can only rise per action.
// 3. LOGARITHMIC DIMINISHING RETURNS — repeated events in a window yield:
//      XP_n = base * 1/(1 + DR_K * ln(overshoot))   overshoot = n - maxPerWindow
//      DR_K = ln(2) ≈ 0.693 → 59% at first repeat, 42% at second, blocked < 5 XP
// 4. RECENCY WEIGHTING — momentum uses exponential half-life decay:
//      w(age_days) = e^{-λ * age_days},  λ = ln(2)/MOMENTUM_HALFLIFE_DAYS
// 5. QUALITY > QUANTITY — quality/collaboration multipliers up to ×2.0.
// 6. VALIDATION MULTIPLIER — externally reviewed/mentored work gets ×1.5.
// 7. ANTI-SPAM CAP — per-entity lifetime guard for unique events; hard caps
//      on window counts prevent farming.
// 8. ROLE FAIRNESS — contribution normalised within workspace, not globally.
// 9. BOTTLENECK GATING — if critical readiness dims < GATE_FLOOR, composite
//      is suppressed via a smooth penalty factor (not a hard zero).
// 10. INTERPRETABILITY — every score update writes a human-readable detail
//      string into dimensionBreakdown / explainBreakdown.

// ── Diminishing-returns constant ──────────────────────────────────────────────
// DR_K = ln(2); gives DR(1)=0.59, DR(2)=0.42, DR(4)=0.28; blocked when XP<5
export const DR_K = Math.LN2;                    // ≈ 0.6931

// ── Momentum half-life (days) ─────────────────────────────────────────────────
// Events lose half their weight every MOMENTUM_HALFLIFE_DAYS days.
export const MOMENTUM_HALFLIFE_DAYS = 7;
export const MOMENTUM_DECAY_LAMBDA = Math.LN2 / MOMENTUM_HALFLIFE_DAYS;

// ── XP per-event configuration ────────────────────────────────────────────────
// baseXp            raw points before any multiplier
// qualityMult       maximum quality multiplier (1.0–2.0); applied when downstream
//                   usage detected (e.g. artifact reviewed / feedback applied)
// collabMult        maximum collaboration multiplier (1.0–1.5); applied when
//                   ≥2 distinct users contributed to the same entity
// cooldownWindowHrs 0 = per-entity lifetime guard; >0 = rolling window (hrs)
// maxPerWindow      qualifying occurrences before DR formula kicks in
// qualifiesForStreak whether event counts as a "meaningful day"

export interface XPConfig {
  baseXp: number;
  qualityMult: number;
  collabMult: number;
  cooldownWindowHrs: number;
  maxPerWindow: number;
  qualifiesForStreak: boolean;
}

// ── Base XP table ─────────────────────────────────────────────────────────────
// Columns:
//   baseXp     — raw points awarded for the first qualifying occurrence
//   qualityMult — max multiplier when downstream usage is detected
//                 (artifact reviewed, feedback applied, work used by team)
//   collabMult  — max multiplier when ≥2 distinct users touched the entity
//   cooldownWindowHrs — 0 = per-entity lifetime; >0 = rolling window
//   maxPerWindow      — occurrences at full XP before log DR engages
//   qualifiesForStreak — counts as a "meaningful day" for streak
//
// Anti-farming design:
//   Events with cooldownWindowHrs=0 are guarded by a unique cooldownKey
//   (entity-scoped) → impossible to farm the same entity twice.
//   Events with cooldownWindowHrs>0 use log DR with DR_K=ln(2):
//     overshoot 1 → 59%,  overshoot 2 → 42%,  overshoot 4 → 28%
//     blocked when effective XP < 5 (≈ overshoot ≥ 6 for base≤30).
//
export const XP_CONFIG: Record<XPEventType, XPConfig> = {
  //                                                    base  qMult cMult  coolHrs  maxWin  streak
  CREATE_ARTIFACT:           { baseXp: 25,  qualityMult: 1.5, collabMult: 1.3, cooldownWindowHrs: 24, maxPerWindow: 5, qualifiesForStreak: true  },
  COMPLETE_ARTIFACT:         { baseXp: 100, qualityMult: 2.0, collabMult: 1.5, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: true  },
  IMPROVE_ARTIFACT:          { baseXp: 40,  qualityMult: 1.8, collabMult: 1.4, cooldownWindowHrs: 24, maxPerWindow: 3, qualifiesForStreak: true  },
  CREATE_BOARD:              { baseXp: 20,  qualityMult: 1.3, collabMult: 1.2, cooldownWindowHrs: 24, maxPerWindow: 3, qualifiesForStreak: false },
  SYNTHESIZE_BOARD:          { baseXp: 75,  qualityMult: 1.8, collabMult: 1.5, cooldownWindowHrs: 24, maxPerWindow: 2, qualifiesForStreak: true  },
  LINK_ARTIFACTS:            { baseXp: 30,  qualityMult: 1.5, collabMult: 1.2, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: false },
  INVITE_COLLABORATOR:       { baseXp: 50,  qualityMult: 1.0, collabMult: 1.0, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: false },
  TEAM_CONTRIBUTION:         { baseXp: 20,  qualityMult: 1.4, collabMult: 1.5, cooldownWindowHrs: 24, maxPerWindow: 5, qualifiesForStreak: false },
  HIGH_QUALITY_CONTRIBUTION: { baseXp: 50,  qualityMult: 2.0, collabMult: 1.5, cooldownWindowHrs: 24, maxPerWindow: 3, qualifiesForStreak: false },
  RECEIVE_MENTOR_FEEDBACK:   { baseXp: 60,  qualityMult: 1.5, collabMult: 1.0, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: false },
  APPLY_FEEDBACK:            { baseXp: 80,  qualityMult: 2.0, collabMult: 1.3, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: true  },
  COMPLETE_REVIEW:           { baseXp: 70,  qualityMult: 1.8, collabMult: 1.0, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: false },
  PROVIDE_FEEDBACK:          { baseXp: 40,  qualityMult: 1.6, collabMult: 1.0, cooldownWindowHrs: 24, maxPerWindow: 3, qualifiesForStreak: false },
  COMPLETE_MILESTONE:        { baseXp: 100, qualityMult: 2.0, collabMult: 1.5, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: true  },
  VALIDATED_PROGRESS:        { baseXp: 50,  qualityMult: 1.5, collabMult: 1.2, cooldownWindowHrs: 24, maxPerWindow: 3, qualifiesForStreak: false },
  STREAK_BONUS:              { baseXp: 0,   qualityMult: 1.0, collabMult: 1.0, cooldownWindowHrs: 0,  maxPerWindow: 1, qualifiesForStreak: false },
};

// ════════════════════════════════════════════════════════════════════════════
// READINESS SCORE MODEL
// ════════════════════════════════════════════════════════════════════════════
//
// Composite = Σ (weight_i × dim_i) × BOTTLENECK_FACTOR
//
// where BOTTLENECK_FACTOR = Π min(1, dim_j / GATE_FLOOR_j)
//   for all j ∈ GATED_DIMENSIONS where dim_j < GATE_FLOOR_j
//
// This smoothly suppresses the composite when critical dimensions are weak,
// without a hard zero — a startup with great execution but no problem clarity
// can never look "ready".
//
// Weights rationale (sum = 1.0):
//   Artifact completeness is raised to 0.20 — tangible deliverables are the
//   single strongest signal of startup maturity.
//   Problem + Solution together = 0.30 — core thesis clarity.
//   Market = 0.15 — required for investor conversations.
//   Team = 0.10 — important but founders can solo-start.
//   Execution + Validation + Integration each = 0.05-0.10.

export const READINESS_WEIGHTS: Record<string, number> = {
  artifactCompleteness: 0.20,
  problemClarity:       0.15,
  solutionClarity:      0.15,
  marketUnderstanding:  0.15,
  teamCompleteness:     0.10,
  executionReadiness:   0.10,
  validationScore:      0.10,
  productDefinition:    0.05,
};

// Dimensions whose score below GATE_FLOOR smoothly penalises the composite.
// Each gated dim applies: penalty_factor = min(1, score / GATE_FLOOR)
// e.g. problemClarity=10 → penalty = 10/30 = 0.333 → composite × 0.333
export const READINESS_GATE_DIMS: Record<string, number> = {
  problemClarity:    30,  // must have ≥30/100 to avoid composite suppression
  teamCompleteness:  20,  // must have ≥20/100 (= at least 1 member)
};

// ════════════════════════════════════════════════════════════════════════════
// CONTRIBUTION SCORE WEIGHTS
// ════════════════════════════════════════════════════════════════════════════
//
// ContributionRaw_u = Σ (factor_weight × factor_count_u × recency_factor)
//
// recency_factor distinguishes events in the last 14 days (weight 1.0) from
// older events (weight CONTRIBUTION_RECENCY_DECAY = 0.4).
//
// Normalisation:
//   ContributionScore_u = 100 × ContributionRaw_u / max(ContributionRaw_v ∀v)
//   This gives 100 to the top contributor; others are relative.
//
// Factor weights reflect downstream impact:
//   feedbackApplied > artifactsImproved > usageByTeam > artifactsCreated
//   > feedbackGiven > collaborationActions

export const CONTRIBUTION_WEIGHTS = {
  artifactsCreated:    10,   // creating is good but not the ceiling
  artifactsImproved:   14,   // improving signals iteration depth
  feedbackGiven:        8,   // giving feedback helps the team
  feedbackApplied:     18,   // applying feedback closes loops — highest value
  collaborationActions: 6,   // structural collaboration scaffolding
  usageByTeam:         16,   // work used by others = high-leverage
} as const;

export const CONTRIBUTION_RECENCY_DECAY = 0.4;  // events >14d old weighted at 40%

// ════════════════════════════════════════════════════════════════════════════
// TEAM MOMENTUM WEIGHTS
// ════════════════════════════════════════════════════════════════════════════
//
// TeamMomentum = round(
//   VELOCITY_W   × velocity_score_0_100  +
//   COLLAB_W     × collab_density_0_100  +
//   ACTIVITY_W   × recent_activity_score_0_100  +
//   FEEDBACK_W   × feedback_loop_score_0_100  +
//   MILESTONE_W  × milestone_rate_0_100
// )
//
// velocity_score  = min(100, (0.6×v7 + 0.4×v14) × VELOCITY_SCALE)
//   v7  = meaningful_events_7d  / 7   (actions/day, recent sensitivity)
//   v14 = meaningful_events_14d / 14  (actions/day, trend)
//   VELOCITY_SCALE = 25 → full score at ≥4 meaningful actions/day
//
// recent_activity_score = min(100, Σ exp(-λ·age_days) × ACTIVITY_SCALE)
//   λ = ln(2)/7 (half-life 7 days); ACTIVITY_SCALE = 20
//   → 5 events today → score ≈ 100
//
// collab_density = (events_by_non_solo_contributors / total_events) × 100
//   clamped to [0, 100]; requires ≥2 distinct users to score > 0
//
// feedback_loop_score = min(100, applied_feedback_events × FEEDBACK_LOOP_SCALE)
//   FEEDBACK_LOOP_SCALE = 25 → full score at 4 completed loops
//
// milestone_rate = (completed_milestones / total_milestones) × 100

export const MOMENTUM_WEIGHTS = {
  velocity:        0.25,
  collabDensity:   0.20,
  recentActivity:  0.25,
  feedbackLoops:   0.15,
  milestoneRate:   0.15,
} as const;

export const VELOCITY_SCALE    = 25;  // 4 meaningful actions/day → v=100
export const ACTIVITY_SCALE    = 20;  // 5 decayed events → ra_score=100
export const FEEDBACK_LOOP_SCALE = 25; // 4 completed loops → fl=100

// Momentum classification thresholds
export const MOMENTUM_LEVELS = {
  stalled:    { min: 0,   max: 15,  label: 'Stalled'      },
  low:        { min: 15,  max: 35,  label: 'Low'          },
  steady:     { min: 35,  max: 55,  label: 'Steady'       },
  strong:     { min: 55,  max: 75,  label: 'Strong'       },
  highVelocity: { min: 75, max: 100, label: 'High-Velocity' },
} as const;

// ════════════════════════════════════════════════════════════════════════════
// MENTOR FEEDBACK LOOP MODEL
// ════════════════════════════════════════════════════════════════════════════
//
// improvementScore = round(
//   MENTOR_APPLY_W   × apply_rate_0_1  ×100 +
//   MENTOR_SPEED_W   × speed_score_0_1 ×100 +
//   MENTOR_DEPTH_W   × depth_score_0_1 ×100 +
//   MENTOR_BURDEN_W  × (1 - burden_0_1)×100
// )
//
// apply_rate     = applied / max(received, 1)
// speed_score    = max(0, 1 − avg_response_hrs / MENTOR_MAX_RESPONSE_HRS)
//   MENTOR_MAX_RESPONSE_HRS = 168 (1 week) → response within 1 week = score > 0
// depth_score    = min(1, received / MENTOR_DEPTH_SATURATION)
//   MENTOR_DEPTH_SATURATION = 5 → 5+ feedback rounds = full depth score
// burden         = max(0, unresolved) / max(received, 1)
//   unresolved = max(0, received − applied)

export const MENTOR_WEIGHTS = {
  applyRate:  0.40,
  speedScore: 0.30,
  depthScore: 0.20,
  burden:     0.10,
} as const;

export const MENTOR_MAX_RESPONSE_HRS   = 168;  // 1 week
export const MENTOR_DEPTH_SATURATION   = 5;    // 5+ sessions = full depth

// ════════════════════════════════════════════════════════════════════════════
// STREAK MODEL
// ════════════════════════════════════════════════════════════════════════════
//
// A streak day qualifies if at least one XP event with qualifiesForStreak=true
// was recorded in that UTC day.
//
// State machine:
//   gap = UTC_days(today − lastActiveDate)
//   gap === 1          → consecutive → currentStreak++
//   gap === 2 AND
//     graceUsedAt NULL → grace window → currentStreak++, graceUsedAt = today
//   gap > 2 OR (gap===2 AND graceUsed) → reset currentStreak = 1
//
// STREAK_GRACE_DAYS = 2 (one missed day allowed per run)
// STREAK_MEANINGFUL_THRESHOLD: at least 1 qualifying event type required

export const STREAK_GRACE_DAYS        = 2;     // one missed day allowed per streak run
export const STREAK_SOFT_DECAY_FACTOR = 0.5;   // on break: newStreak = floor(currentStreak × 0.5), min 1
//   Rationale: preserve ~50% of progress on first break; prevents total loss while
//   disincentivising long absences vs. a hard reset that discourages recovery.
export const STREAK_SOFT_DECAY_MIN    = 1;     // floor after decay
export const STREAK_QUALIFYING_MIN    = 1;     // ≥1 qualifying event in the UTC day to count
//
// Streak milestone XP bonuses — awarded once per milestone crossing:
//   streak days → bonus XP on top of normal event XP
export const STREAK_MILESTONE_BONUSES: Record<number, number> = {
  7:   25,   // 1 week streak
  14:  50,   // 2 weeks
  30:  100,  // 1 month
  60:  175,  // 2 months
  90:  250,  // 3 months
};
//
// Recovery state: after a streak break the user enters recovery mode for
// STREAK_RECOVERY_WINDOW_DAYS. During recovery, the soft-decayed streak is
// preserved and milestone bonuses can be re-earned from the recovery base.
export const STREAK_RECOVERY_WINDOW_DAYS = 7;

// ════════════════════════════════════════════════════════════════════════════
// ANTI-GAMING / ANTI-ABUSE CONSTANTS
// ════════════════════════════════════════════════════════════════════════════
//
// Detection signals and suppression rules:
//
// 1. EMPTY-ENTITY SPAM (repeated creation of empty nodes/artifacts)
//    Signal: CREATE_ARTIFACT events with no subsequent IMPROVE or COMPLETE
//    Rule: maxPerWindow=5 per 24h with log DR ensures ≤5 full-value creates/day
//    Suppression: create events without downstream activity award 0 quality mult
//
// 2. MICRO-EDIT FARMING (tiny edits counted as IMPROVE_ARTIFACT)
//    Signal: IMPROVE events faster than MIN_IMPROVE_INTERVAL_MINS apart
//    Rule: cooldownWindowHrs=24, maxPerWindow=3 — at most 3 full-value improvements
//    Suppression: 4th improvement in 24h = 59% of base, 5th = 42%, 6th = blocked
//
// 3. SELF-LINK LOOPS (linking the same artifacts repeatedly)
//    Rule: LINK_ARTIFACTS has cooldownWindowHrs=0 (per-entity lifetime guard)
//    → the same A→B link can never award XP twice
//
// 4. FAKE COLLABORATION (TEAM_CONTRIBUTION spam without real team action)
//    Rule: TEAM_CONTRIBUTION maxPerWindow=5 per 24h, scored only for workspace
//    Contribution score normalisation neutralises solo-inflated raw scores
//
// 5. REVIEW LOOP ABUSE (completing reviews on own documents)
//    Rule: COMPLETE_REVIEW has cooldownWindowHrs=0 + entity-scoped cooldownKey
//    → one review event per review entity, ever
//
// 6. BADGE XP FARMING (farming badge rewards)
//    Rule: badge reward events use BADGE_REWARD:{badgeId}:{userId} cooldownKey
//    → impossible to earn the same badge bonus twice
//
// Minimum effective XP threshold — events yielding < MIN_XP_FLOOR XP are blocked
export const MIN_XP_FLOOR = 5;  // DR blocks when effective XP < this

// ════════════════════════════════════════════════════════════════════════════
// XP LEVEL THRESHOLDS
// ════════════════════════════════════════════════════════════════════════════
//
// Level bands follow an accelerating curve — early levels are fast (identity
// formation), later levels require deep, validated work. Designed so a focused
// founder reaches L5 in ~8-12 weeks of consistent quality work.

export interface XPLevel {
  level: number;
  minXp: number;
  label: string;
}

export const XP_LEVELS: XPLevel[] = [
  { level: 1,  minXp: 0,     label: 'Founder Seedling'   },
  { level: 2,  minXp: 200,   label: 'Idea Explorer'      },
  { level: 3,  minXp: 500,   label: 'Builder'            },
  { level: 4,  minXp: 1_000, label: 'Validated Founder'  },
  { level: 5,  minXp: 2_000, label: 'Market Fit Seeker'  },
  { level: 6,  minXp: 3_500, label: 'Growth Architect'   },
  { level: 7,  minXp: 5_500, label: 'Venture Ready'      },
  { level: 8,  minXp: 8_000, label: 'Series-A Contender' },
  { level: 9,  minXp: 12_000,label: 'Scale-Up Operator'  },
  { level: 10, minXp: 18_000,label: 'Ecosystem Leader'   },
];

export interface LevelInfo {
  level: number;
  label: string;
  xpToNextLevel: number;
  levelProgress: number;
}

export function computeLevel(totalXp: number): LevelInfo {
  let current = XP_LEVELS[0];
  for (const l of XP_LEVELS) {
    if (totalXp >= l.minXp) current = l;
  }
  const nextIdx = XP_LEVELS.findIndex((l) => l.level === current.level + 1);
  const next = nextIdx >= 0 ? XP_LEVELS[nextIdx] : null;
  const xpToNextLevel = next ? Math.max(0, next.minXp - totalXp) : 0;
  const levelProgress = next
    ? Math.round(((totalXp - current.minXp) / (next.minXp - current.minXp)) * 100)
    : 100;
  return { level: current.level, label: current.label, xpToNextLevel, levelProgress };
}

// ════════════════════════════════════════════════════════════════════════════
// CORE FORMULA: LOGARITHMIC DIMINISHING RETURNS
// ════════════════════════════════════════════════════════════════════════════
//
// Returns the effective XP for event occurrence n (1-indexed, within window).
//
//   overshoot = max(0, n − maxPerWindow)
//   DR_factor = 1 / (1 + DR_K × ln(overshoot + 1))   [overshoot 0 → factor=1.0]
//   effective  = floor(baseXp × DR_factor)
//
// DR_K = ln(2) ≈ 0.693:
//   overshoot 1 → factor ≈ 0.590 (59 %)
//   overshoot 2 → factor ≈ 0.418 (42 %)
//   overshoot 4 → factor ≈ 0.282 (28 %)
//   overshoot 8 → factor ≈ 0.168 (17 %)
//
// blocked = effective < MIN_XP_FLOOR (5 XP)
//
export function applyDiminishingReturns(
  baseXp: number,
  occurrencesInWindow: number,
  maxPerWindow: number,
): { effectiveXp: number; isDiminished: boolean; blocked: boolean } {
  const overshoot = Math.max(0, occurrencesInWindow - maxPerWindow);
  if (overshoot === 0) return { effectiveXp: baseXp, isDiminished: false, blocked: false };
  const factor = 1 / (1 + DR_K * Math.log(overshoot + 1));
  const effectiveXp = Math.floor(baseXp * factor);
  const blocked = effectiveXp < MIN_XP_FLOOR;
  return { effectiveXp: blocked ? 0 : effectiveXp, isDiminished: !blocked, blocked };
}

// ════════════════════════════════════════════════════════════════════════════
// BADGE CRITERIA RULE TREE
// ════════════════════════════════════════════════════════════════════════════

export interface BadgeCriteriaNode {
  type:
    | 'and'
    | 'or'
    | 'total_xp'
    | 'streak_days'
    | 'badge_earned'
    | 'xp_event_count'
    | 'workspace_count'
    | 'collaboration_count'
    | 'readiness_score'
    | 'contribution_score';
  rules?: BadgeCriteriaNode[];
  minXP?: number;
  minDays?: number;
  badgeId?: string;
  eventType?: XPEventType;
  minCount?: number;
  minScore?: number;
}

export interface BadgeEvalContext {
  userId: string;
  xpEvents: Array<{ eventType: XPEventType; xpAmount: number; workspaceId: string | null }>;
  totalXp: number;
  earnedIds: Set<string>;
  longestStreak: number;
  maxReadinessScore?: number;
  maxContributionScore?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE DTOs
// ════════════════════════════════════════════════════════════════════════════

export interface RecordXPOpts {
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  weightMultiplier?: number;
  qualityMultiplier?: number;
  collaborationMultiplier?: number;
  metadata?: Record<string, unknown>;
}

export interface RecordXPResult {
  xpAwarded: number;
  isDiminished: boolean;
  blocked: boolean;
  explain: string;
}

export interface RecentXPEvent {
  id: string;
  eventType: XPEventType;
  xpAmount: number;
  entityType: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}

export interface XPSummary {
  userId: string;
  totalXp: number;
  level: number;
  levelLabel: string;
  xpToNextLevel: number;
  levelProgress: number;
  recentEvents: RecentXPEvent[];
  streak: StreakSummary;
}

export interface BadgeSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  iconName: string | null;
  xpReward: number;
  awardedAt: Date;
}

export interface ReadinessDimensions {
  problemClarity: number;
  solutionClarity: number;
  marketUnderstanding: number;
  productDefinition: number;
  teamCompleteness: number;
  executionReadiness: number;
  validationScore: number;
  artifactCompleteness: number;
}

// ── Explainability model ──────────────────────────────────────────────────────
// Every scored dimension carries a human-readable detail string and the
// signal inputs that produced it, for display in dashboards and admin tooling.

export interface DimensionDetail {
  score: number;
  weight: number;
  weightedContribution: number;
  detail: string;
  signals: Record<string, string | number | boolean>;
}

export interface ReadinessSummary {
  workspaceId: string;
  score: number;
  bottleneckFactor: number;
  dimensions: ReadinessDimensions;
  dimensionBreakdown: Record<string, DimensionDetail>;
  updatedAt: Date;
}

export interface ContributionBreakdown {
  artifactsCreated: number;
  artifactsImproved: number;
  feedbackGiven: number;
  feedbackApplied: number;
  collaborationActions: number;
  usageByTeam: number;
  recentArtifactsCreated: number;
  recentArtifactsImproved: number;
  recentFeedbackApplied: number;
}

export interface ContributionSummary {
  userId: string;
  workspaceId: string;
  score: number;
  rawScore: number;
  breakdown: ContributionBreakdown;
  explain: string;
  updatedAt: Date;
}

export interface MomentumBreakdown {
  activeContributors: number;
  recentMeaningfulActions: number;
  meaningful7d: number;
  meaningful14d: number;
  velocityScore: number;
  recentActivityScore: number;
  collaborationDensityScore: number;
  feedbackLoopScore: number;
  milestoneRateScore: number;
  artifactProgressEvents: number;
  feedbackLoopsCompleted: number;
  milestoneCompletionRate: number;
  momentumLevel: string;
}

export interface MomentumSummary {
  workspaceId: string;
  score: number;
  velocity: number;
  recentActivityScore: number;
  collaborationDensity: number;
  breakdown: MomentumBreakdown;
  updatedAt: Date;
}

export interface MentorMetricsSummary {
  workspaceId: string;
  feedbackCount: number;
  appliedFeedbackCount: number;
  unresolvedFeedback: number;
  appliedFeedbackRate: number;
  avgResponseTimeHrs: number;
  speedScore: number;
  depthScore: number;
  burdenScore: number;
  improvementScore: number;
  lastFeedbackAt: Date | null;
  updatedAt: Date;
}

// ════════════════════════════════════════════════════════════════════════════
// PART 8 — NORMALIZATION + ROLE FAIRNESS
// ════════════════════════════════════════════════════════════════════════════
//
// Contribution scores are normalised within role groups, not globally.
// Rationale: a founding CEO produces strategy docs + artifacts; a hired
// engineer produces code specs; a mentor produces reviews. Comparing raw
// contribution counts across roles would be unfair.
//
// Segmentation:
//   GROUP_BUILDER  — founder / ceo / cto / engineer / product
//   GROUP_GROWTH   — marketing / sales / bizdev / operations
//   GROUP_EXPERT   — mentor / advisor / investor / domain_expert
//   GROUP_OTHER    — all other / unset roles
//
// Normalisation formula (per workspace, per role group):
//   sortedScores = sorted raw contribution scores of all GROUP members in WS
//   percentile(user) = count(scores ≤ user.rawScore) / count(scores) × 100
//   normalizedScore  = clamp(percentile, 0, 100)
//
// Percentile anchors (used when there are < PERCENTILE_MIN_COHORT members):
//   Fall back to global workspace percentile (all roles).
//   If workspace has only 1 member, score = clamp(rawScore / SOLO_SCALE, 0, 100).

export type RoleGroup = 'BUILDER' | 'GROWTH' | 'EXPERT' | 'OTHER';

export const ROLE_GROUP_MAP: Record<string, RoleGroup> = {
  founder:      'BUILDER',
  ceo:          'BUILDER',
  cto:          'BUILDER',
  engineer:     'BUILDER',
  product:      'BUILDER',
  marketing:    'GROWTH',
  sales:        'GROWTH',
  bizdev:       'GROWTH',
  operations:   'GROWTH',
  mentor:       'EXPERT',
  advisor:      'EXPERT',
  investor:     'EXPERT',
  domain_expert:'EXPERT',
};

export const PERCENTILE_MIN_COHORT = 3;   // min group size for role-aware normalisation
export const SOLO_SCALE            = 200; // rawScore / SOLO_SCALE → solo-member %

// ════════════════════════════════════════════════════════════════════════════
// PART 9 — ANTI-GAMING / BURST DETECTION
// ════════════════════════════════════════════════════════════════════════════
//
// Burst signals are checked on every recordXP call:
//   If a user fires > ABUSE_BURST_MAX_EVENTS events within ABUSE_BURST_WINDOW_MINS,
//   all events in that burst after the threshold are suppressed (0 XP, blocked=true)
//   and a suppression record is stored for ABUSE_SUPPRESS_HOURS.
//
// Suppression is stored via a synthetic XPEvent with metadata.suppressedUntil set.
// The recordXP method checks for an active suppression before awarding any XP.
//
// Additional signals:
//   EMPTY_ENTITY_RATIO: if a user's CREATE_ARTIFACT events have no downstream
//     IMPROVE/APPLY/COMPLETE within 48h, the quality multiplier is set to 1.0
//     (no bonus) for future creates until the ratio drops below the threshold.
//   MICRO_EDIT_SIGNAL: IMPROVE events fired < MIN_IMPROVE_INTERVAL_MINS apart
//     (already handled by DR + cooldown, documented here for completeness).

export const ABUSE_BURST_WINDOW_MINS = 5;    // rolling window for burst detection
export const ABUSE_BURST_MAX_EVENTS  = 10;   // >10 events in 5 min = burst
export const ABUSE_SUPPRESS_HOURS    = 24;   // XP suppression duration after burst
export const EMPTY_ENTITY_RATIO_MAX  = 0.8;  // >80% orphan creates → no quality bonus
export const MIN_IMPROVE_INTERVAL_MINS = 30; // IMPROVE events closer than this = micro-edit

// ════════════════════════════════════════════════════════════════════════════
// PART 10 — EXPLAINABILITY DTOs
// ════════════════════════════════════════════════════════════════════════════
//
// ScoreExplainDTO is the top-level response for GET /gamification/explain.
// It bundles all four scoring dimensions with their full breakdowns so a
// dashboard or admin panel can surface a transparent, auditable view of
// exactly why a user / workspace scored the way they did.

export interface XPEventExplain {
  id: string;
  eventType: string;
  baseXp: number;
  effectiveXp: number;
  qualityMultiplier: number;
  collaborationMultiplier: number;
  diminished: boolean;
  blocked: boolean;
  cooldownKey: string | null;
  explain: string;
  createdAt: Date;
}

export interface StreakExplain {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  graceUsedAt: Date | null;
  inRecovery: boolean;
  nextMilestone: number | null;
  xpToNextMilestone: number | null;
}

export interface ScoreExplainDTO {
  userId: string;
  workspaceId?: string;
  generatedAt: Date;
  xp: {
    total: number;
    level: number;
    levelLabel: string;
    xpToNextLevel: number;
    levelProgress: number;
    recentEvents: XPEventExplain[];
  };
  streak: StreakExplain;
  readiness: ReadinessSummary | null;
  contribution: ContributionSummary | null;
  momentum: MomentumSummary | null;
  mentorMetrics: MentorMetricsSummary | null;
  humanSummary: string;
}

// ════════════════════════════════════════════════════════════════════════════
// UTC DAY HELPERS
// ════════════════════════════════════════════════════════════════════════════

export function utcDayStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function daysDiff(a: Date, b: Date): number {
  return Math.round(
    (utcDayStart(a).getTime() - utcDayStart(b).getTime()) / 86_400_000,
  );
}

// ── Momentum level classification ─────────────────────────────────────────────
export function classifyMomentum(score: number): string {
  for (const [, v] of Object.entries(MOMENTUM_LEVELS)) {
    if (score >= v.min && score < v.max) return v.label;
  }
  return MOMENTUM_LEVELS.highVelocity.label;
}
