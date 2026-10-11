import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useHasSession } from '@/hooks/useSession';
import { qk } from '@/lib/query-keys';

// ══════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════

export interface XPSummary {
  userId: string;
  totalXp: number;
  level: number;
  levelLabel: string;
  xpToNextLevel: number;
  levelProgress: number;
  recentEvents: XPEvent[];
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: Date | null;
  };
}

export interface XPEvent {
  id: string;
  eventType: string;
  xpAmount: number;
  entityType: string | null;
  metadata: any;
  createdAt: Date;
}

export interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  iconName: string | null;
  awardedAt: Date;
  seenAt: Date | null;
}

export interface ReadinessScore {
  workspaceId: string;
  score: number;
  problemClarity: number;
  solutionClarity: number;
  marketUnderstanding: number;
  productDefinition: number;
  teamCompleteness: number;
  executionReadiness: number;
  validationScore: number;
  artifactCompleteness: number;
  dimensionBreakdown: Record<string, any>;
  updatedAt: Date;
}

export interface ContributionScore {
  userId: string;
  workspaceId: string;
  score: number;
  breakdown: {
    artifactsCreated: number;
    artifactsImproved: number;
    feedbackGiven: number;
    feedbackApplied: number;
    collaborationActions: number;
    usageByTeam: number;
  };
  updatedAt: Date;
}

export interface MomentumScore {
  workspaceId: string;
  score: number;
  velocity: number;
  recentActivityScore: number;
  collaborationDensity: number;
  breakdown: {
    activeContributors: number;
    recentMeaningfulActions: number;
    artifactProgressEvents: number;
    feedbackLoopsCompleted: number;
    milestoneCompletionRate: number;
  };
  classification: string;
  updatedAt: Date;
}

export interface MentorMetrics {
  workspaceId: string;
  feedbackCount: number;
  appliedFeedbackCount: number;
  appliedFeedbackRate: number;
  avgResponseTimeHrs: number;
  improvementScore: number;
  unresolvedFeedback: number;
  lastFeedbackAt: Date | null;
  updatedAt: Date;
}

// ══════════════════════════════════════════════════════════════════════════
// HOOKS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Fetch current user's XP summary (total XP, level, recent events, streak)
 */
export function useMyXP() {
  const hasSession = useHasSession();
  return useQuery<XPSummary>({
    queryKey: qk('gamification', 'xp', 'me'),
    queryFn: async () => {
      const res = await apiRequest('/api/gamification/users/me/xp');
      return res as XPSummary;
    },
    enabled: hasSession,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch XP summary for any user (for public profiles, mentor views, etc.)
 */
export function useUserXP(userId: string | undefined) {
  return useQuery<XPSummary>({
    queryKey: qk('gamification', 'xp', userId),
    queryFn: async () => {
      const res = await apiRequest(`/api/gamification/users/${userId}/xp`);
      return res as XPSummary;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch current user's earned badges
 */
export function useMyBadges() {
  const hasSession = useHasSession();
  return useQuery<Badge[]>({
    queryKey: qk('gamification', 'badges', 'me'),
    queryFn: async () => {
      const res = await apiRequest('/api/gamification/users/me/badges');
      return res as Badge[];
    },
    enabled: hasSession,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Fetch badges for any user
 */
export function useUserBadges(userId: string | undefined) {
  return useQuery<Badge[]>({
    queryKey: qk('gamification', 'badges', userId),
    queryFn: async () => {
      const res = await apiRequest(`/api/gamification/users/${userId}/badges`);
      return res as Badge[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Mark all unseen badges as seen
 */
export function useMarkBadgesSeen() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      await apiRequest('/api/gamification/users/me/badges/seen', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('gamification', 'badges', 'me') });
    },
  });
}

/**
 * Fetch current user's streak
 */
export function useMyStreak() {
  const hasSession = useHasSession();
  return useQuery<{ currentStreak: number; longestStreak: number; lastActiveDate: Date | null }>({
    queryKey: qk('gamification', 'streak', 'me'),
    queryFn: async () => {
      const res = await apiRequest('/api/gamification/users/me/streak');
      return res as { currentStreak: number; longestStreak: number; lastActiveDate: Date | null };
    },
    enabled: hasSession,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch workspace readiness score
 */
export function useReadinessScore(workspaceId: string | undefined) {
  return useQuery<ReadinessScore>({
    queryKey: qk('gamification', 'readiness', workspaceId),
    queryFn: async () => {
      const res = await apiRequest(`/api/gamification/workspaces/${workspaceId}/readiness`);
      return res as ReadinessScore;
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Force-refresh workspace readiness score
 */
export function useRefreshReadiness() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await apiRequest(`/api/gamification/workspaces/${workspaceId}/readiness/refresh`, {
        method: 'POST',
      });
      return res as ReadinessScore;
    },
    onSuccess: (_, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: qk('gamification', 'readiness', workspaceId) });
    },
  });
}

/**
 * Fetch workspace team momentum score
 */
export function useMomentumScore(workspaceId: string | undefined) {
  return useQuery<MomentumScore>({
    queryKey: qk('gamification', 'momentum', workspaceId),
    queryFn: async () => {
      const res = await apiRequest(`/api/gamification/workspaces/${workspaceId}/momentum`);
      return res as MomentumScore;
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch all contribution scores for a workspace
 */
export function useWorkspaceContributions(workspaceId: string | undefined) {
  return useQuery<ContributionScore[]>({
    queryKey: qk('gamification', 'contributions', workspaceId),
    queryFn: async () => {
      const res = await apiRequest(`/api/gamification/workspaces/${workspaceId}/contributions`);
      return res as ContributionScore[];
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch current user's contribution score in a workspace
 */
export function useMyContribution(workspaceId: string | undefined) {
  return useQuery<ContributionScore>({
    queryKey: qk('gamification', 'contributions', workspaceId, 'me'),
    queryFn: async () => {
      const res = await apiRequest(`/api/gamification/workspaces/${workspaceId}/contributions/me`);
      return res as ContributionScore;
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch workspace mentor feedback metrics
 */
export function useMentorMetrics(workspaceId: string | undefined) {
  return useQuery<MentorMetrics>({
    queryKey: qk('gamification', 'mentor-metrics', workspaceId),
    queryFn: async () => {
      const res = await apiRequest(`/api/gamification/workspaces/${workspaceId}/mentor-metrics`);
      return res as MentorMetrics;
    },
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Combined hook for dashboard - fetches XP, badges, and streak in parallel
 */
export function useGamificationDashboard() {
  const xp = useMyXP();
  const badges = useMyBadges();
  const streak = useMyStreak();

  return {
    xp: xp.data,
    badges: badges.data,
    streak: streak.data,
    isLoading: xp.isLoading || badges.isLoading || streak.isLoading,
    isError: xp.isError || badges.isError || streak.isError,
    refetch: () => {
      xp.refetch();
      badges.refetch();
      streak.refetch();
    },
  };
}

/**
 * Combined hook for workspace scoring - fetches readiness, momentum, and contributions
 */
export function useWorkspaceScoring(workspaceId: string | undefined) {
  const readiness = useReadinessScore(workspaceId);
  const momentum = useMomentumScore(workspaceId);
  const myContribution = useMyContribution(workspaceId);
  const mentorMetrics = useMentorMetrics(workspaceId);

  return {
    readiness: readiness.data,
    momentum: momentum.data,
    myContribution: myContribution.data,
    mentorMetrics: mentorMetrics.data,
    isLoading: readiness.isLoading || momentum.isLoading || myContribution.isLoading || mentorMetrics.isLoading,
    isError: readiness.isError || momentum.isError || myContribution.isError || mentorMetrics.isError,
    refetch: () => {
      readiness.refetch();
      momentum.refetch();
      myContribution.refetch();
      mentorMetrics.refetch();
    },
  };
}
