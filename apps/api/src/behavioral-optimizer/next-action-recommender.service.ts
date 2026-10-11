import { Injectable } from '@nestjs/common';
import { BehavioralStateKey, UserSignals } from './behavioral-state.service';

export interface NextAction {
  key: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  surface: string;
  score: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  icon: string;
}

interface ActionRule {
  key: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  surface: string;
  icon: string;
  score: (s: UserSignals, state: BehavioralStateKey) => number;
}

const ACTION_RULES: ActionRule[] = [
  {
    key: 'complete_profile',
    title: 'Complete your profile',
    description: 'A complete profile gets 3× more connection requests and unlocks matching.',
    ctaLabel: 'Go to Profile',
    ctaHref: '/profile/edit',
    surface: 'dashboard',
    icon: 'User',
    score: (s) => s.profileCompletionPct < 100 ? 90 - s.profileCompletionPct * 0.5 : 0,
  },
  {
    key: 'create_first_board',
    title: 'Create your first research board',
    description: 'Research boards help you validate ideas and attract the right co-founder.',
    ctaLabel: 'Open Research',
    ctaHref: '/research',
    surface: 'dashboard',
    icon: 'Layout',
    score: (s) => s.boardCount === 0 ? 85 : 0,
  },
  {
    key: 'build_startup_canvas',
    title: 'Build your startup canvas',
    description: 'Document your problem, solution and market to boost your Readiness Score.',
    ctaLabel: 'Open Builder',
    ctaHref: '/builder',
    surface: 'dashboard',
    icon: 'FileText',
    score: (s) => s.docCount === 0 ? 82 : s.docCount < 3 ? 60 : 0,
  },
  {
    key: 'connect_with_cofounder',
    title: 'Find your co-founder',
    description: `You've built strong foundations — now find the right partner.`,
    ctaLabel: 'Browse Matches',
    ctaHref: '/discover',
    surface: 'dashboard',
    icon: 'Users',
    score: (s, state) =>
      state === 'matching_focused' || (s.connectionCount < 3 && s.totalXp > 100) ? 78 : 0,
  },
  {
    key: 'review_pending_feedback',
    title: 'You have pending reviews',
    description: 'Expert feedback is waiting — apply it to raise your Readiness Score.',
    ctaLabel: 'Review Feedback',
    ctaHref: '/builder',
    surface: 'builder',
    icon: 'MessageSquare',
    score: (s) => s.pendingReviewCount > 0 ? 88 + s.pendingReviewCount * 2 : 0,
  },
  {
    key: 'continue_building',
    title: 'Keep your momentum going',
    description: `You're on a ${0}-day streak — don't break it! Complete another artifact today.`,
    ctaLabel: 'Continue Building',
    ctaHref: '/builder',
    surface: 'builder',
    icon: 'Zap',
    score: (s, state) => state === 'high_momentum' && s.currentStreak > 0 ? 75 : 0,
  },
  {
    key: 'book_mentor_session',
    title: 'Book a mentor session',
    description: 'Get expert guidance to break through your current plateau.',
    ctaLabel: 'Find a Mentor',
    ctaHref: '/mentoring',
    surface: 'dashboard',
    icon: 'BookOpen',
    score: (s, state) =>
      (state === 'stuck' || state === 'readiness_plateaued') && s.mentorSessionCount < 3 ? 80 : 0,
  },
  {
    key: 're_engage',
    title: 'Welcome back! Pick up where you left off',
    description: `You've been away for ${0} days. Your startup journey is waiting.`,
    ctaLabel: 'Resume Building',
    ctaHref: '/builder',
    surface: 'dashboard',
    icon: 'RefreshCw',
    score: (s, state) => state === 'stuck' && s.daysSinceLastActivity >= 7 ? 92 : 0,
  },
  {
    key: 'invite_collaborator',
    title: 'Invite a team member',
    description: 'Collaborating on your workspace earns XP and boosts Team Momentum score.',
    ctaLabel: 'Invite to Workspace',
    ctaHref: '/builder',
    surface: 'builder',
    icon: 'UserPlus',
    score: (s) => s.workspaceCount > 0 && s.collaboratorCount === 0 ? 70 : 0,
  },
  {
    key: 'get_expert_review',
    title: 'Request an expert review',
    description: 'Your canvas is taking shape — get external validation to unlock quality XP bonuses.',
    ctaLabel: 'Get Reviewed',
    ctaHref: '/expert-reviews',
    surface: 'dashboard',
    icon: 'Award',
    score: (s) => s.docCount >= 2 && s.pendingReviewCount === 0 ? 68 : 0,
  },
];

function priorityFromScore(score: number): NextAction['priority'] {
  if (score >= 88) return 'critical';
  if (score >= 75) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

@Injectable()
export class NextActionRecommenderService {
  recommend(signals: UserSignals, state: BehavioralStateKey, topN = 3): NextAction[] {
    const scored = ACTION_RULES
      .map((rule) => {
        const rawScore = rule.score(signals, state);
        if (rawScore <= 0) return null;

        const description = rule.description
          .replace('${0}', String(signals.currentStreak > 0 ? signals.currentStreak : signals.daysSinceLastActivity));

        return {
          key: rule.key,
          title: rule.title,
          description,
          ctaLabel: rule.ctaLabel,
          ctaHref: rule.ctaHref,
          surface: rule.surface,
          icon: rule.icon,
          score: rawScore,
          priority: priorityFromScore(rawScore),
        } satisfies NextAction;
      })
      .filter((a): a is NextAction => a !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    return scored;
  }

  topAction(signals: UserSignals, state: BehavioralStateKey): NextAction | null {
    const actions = this.recommend(signals, state, 1);
    return actions[0] ?? null;
  }
}
