/**
 * Types for rule-based cofounder/founder matching.
 * Used by both API (scoring) and future frontend (display breakdown).
 */

import type { UserRole } from '../types';

export type { UserRole };

/** Flattened profile snapshot used for matching (no Prisma/DB types). */
export interface ProfileSnapshot {
  userId: string;
  profileId: string;
  role: UserRole;
  displayName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  /** Canonical skill names (or slugs) for overlap. */
  skillNames: string[];
  /** rolePayload from Profile – founder: industry, stage, commitment, rolesSought; mentor: expertiseAreas, etc. */
  rolePayload: Record<string, unknown> | null;
  /** Profile.updatedAt as ms for recency bonus. */
  updatedAtMs: number;
}

/** Result of computeMatchScore. */
export interface MatchScoreResult {
  score: number;
  breakdown: MatchScoreBreakdown;
}

export interface MatchScoreBreakdown {
  roleComplementarity: number;
  skillsOverlap: number;
  stageAlignment: number;
  commitmentAlignment: number;
  locationProximity: number;
  recencyBonus: number;
  /** Short human-readable reasons (e.g. for UI). */
  reasons: string[];
}
