import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type RuleSeed = {
  name: string;
  description: string;
  triggerType: string;
  conditionDef?: unknown;
  actionDef: { type: string; params: Record<string, unknown> };
  delaySeconds?: number;
  priority?: number;
};

/**
 * Seeds built-in platform automation rules on app startup.
 * Idempotent — skips rules that already exist by name.
 */
@Injectable()
export class AutomationSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutomationSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.seedBuiltInRules();
  }

  private async seedBuiltInRules() {
    const rules: RuleSeed[] = [
      // ── A. Onboarding ──────────────────────────────────────────────────────
      {
        name: 'Welcome New User',
        description: 'Send in-app welcome notification when a user signs up',
        triggerType: 'user_signup',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'system',
            title: 'Welcome to CoFounderBay! 🎉',
            body: 'Complete your profile to get matched with co-founders, mentors, and investors.',
          },
        },
        priority: 10,
      },
      {
        name: 'Onboarding Incomplete Reminder (24h)',
        description: 'Remind users who have not completed onboarding after 1 day',
        triggerType: 'onboarding_incomplete',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'system',
            title: 'Finish setting up your profile',
            body: 'You are one step away from getting discovered by co-founders and investors.',
          },
        },
        delaySeconds: 0,
        priority: 20,
      },
      {
        name: 'Onboarding Incomplete Email (48h)',
        description: 'Send follow-up email when onboarding is still incomplete after 2 days',
        triggerType: 'onboarding_incomplete',
        conditionDef: [{ field: 'reminder', operator: 'eq', value: true }],
        actionDef: {
          type: 'send_email',
          params: {
            subject: 'Your CoFounderBay profile is waiting for you',
            bodyHtml: '<p>Hi,</p><p>You joined CoFounderBay but haven\'t completed your profile yet.</p><p>Complete it now to start getting match recommendations.</p><p><a href="https://app.cofounderbay.com/onboarding">Complete Profile →</a></p>',
            bodyText: 'Complete your CoFounderBay profile to get match recommendations: https://app.cofounderbay.com/onboarding',
          },
        },
        delaySeconds: 86400,
        priority: 25,
      },

      // ── B. Profile ─────────────────────────────────────────────────────────
      {
        name: 'Profile Incomplete Nudge',
        description: 'Nudge users with incomplete profiles to add missing sections',
        triggerType: 'profile_incomplete',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'system',
            title: 'Boost your match score',
            body: 'Add skills, your pitch, and a photo to appear in more search results.',
          },
        },
        priority: 30,
      },

      // ── C. Matching ────────────────────────────────────────────────────────
      {
        name: 'Generate Matches After Profile Completion',
        description: 'Auto-generate initial match recommendations when user completes onboarding',
        triggerType: 'user_signup',
        actionDef: {
          type: 'generate_matches',
          params: { limit: 10 },
        },
        delaySeconds: 300,
        priority: 40,
      },
      {
        name: 'Match Not Viewed Nudge',
        description: 'Remind users who have not reviewed their match recommendations',
        triggerType: 'match_not_viewed',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'match',
            title: 'You have new match recommendations',
            body: 'Check out your latest co-founder and mentor matches.',
          },
        },
        priority: 50,
      },
      {
        name: 'Connection Accepted — Next Steps Prompt',
        description: 'After a connection is accepted, prompt users to start collaborating',
        triggerType: 'connection_accepted',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'connection',
            title: 'Connection accepted! 🤝',
            body: 'You are now connected. Send a message, propose a project, or schedule a call.',
          },
        },
        priority: 55,
      },
      {
        name: 'Unanswered Connection Request Reminder',
        description: 'Remind users to respond to unanswered connection requests after 3 days',
        triggerType: 'connection_not_answered',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'connection',
            title: 'You have a pending connection request',
            body: 'Someone wants to connect — review their profile and decide.',
          },
        },
        priority: 60,
      },

      // ── D. Mentorship ──────────────────────────────────────────────────────
      {
        name: 'Mentor Request Received Notification',
        description: 'Notify mentor when a new mentorship request is submitted',
        triggerType: 'mentor_request_submitted',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'mentor',
            title: 'New mentorship request',
            body: 'Someone has requested mentorship. Review and respond in your mentorship dashboard.',
          },
        },
        priority: 70,
      },
      {
        name: 'Mentor Request Accepted — Onboarding Tips',
        description: 'Send onboarding tips to mentee when their mentor request is accepted',
        triggerType: 'mentor_request_accepted',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'mentor',
            title: 'Mentorship accepted! 🎓',
            body: 'Your mentor accepted your request. Schedule your first session and set initial goals.',
          },
        },
        priority: 75,
      },
      {
        name: 'Idle Mentor Session Follow-up',
        description: 'Follow up on mentor booking requests that have been idle for 7 days',
        triggerType: 'mentor_session_idle',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'mentor',
            title: 'Pending mentorship request',
            body: 'You have a mentorship request waiting for your response.',
          },
        },
        priority: 80,
      },

      // ── E. Community ───────────────────────────────────────────────────────
      {
        name: 'Welcome to Community',
        description: 'Welcome new members when they join a group or community',
        triggerType: 'community_join',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'community',
            title: 'Welcome to the community! 🏘️',
            body: 'Introduce yourself, explore discussions, and connect with other members.',
          },
        },
        priority: 90,
      },
      {
        name: 'Inactive Community Alert',
        description: 'Flag inactive communities to admins for review',
        triggerType: 'community_inactive',
        actionDef: {
          type: 'send_admin_alert',
          params: {
            message: 'Community has been inactive for 30 days. Consider archiving or re-engagement.',
          },
        },
        priority: 95,
      },

      // ── F. Admin / Moderation ──────────────────────────────────────────────
      {
        name: 'Content Report Threshold Alert',
        description: 'Alert admins when content receives multiple reports',
        triggerType: 'content_reported_threshold',
        actionDef: {
          type: 'send_admin_alert',
          params: {
            message: 'Content has been reported multiple times. Review in moderation queue.',
          },
        },
        priority: 100,
      },
      {
        name: 'Content Report Flag for Review',
        description: 'Flag reported content entity for admin review',
        triggerType: 'content_reported_threshold',
        actionDef: {
          type: 'flag_for_admin_review',
          params: {},
        },
        priority: 101,
      },

      // ── G. Tenant Onboarding ───────────────────────────────────────────────
      {
        name: 'Tenant Setup Incomplete Notification',
        description: 'Notify tenant admins when their organization setup is incomplete',
        triggerType: 'tenant_setup_incomplete',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'system',
            title: 'Complete your organization setup',
            body: 'Configure branding, domains, and SSO to launch your branded experience.',
          },
        },
        priority: 110,
      },

      // ── H. Billing ─────────────────────────────────────────────────────────
      {
        name: 'Trial Ending Reminder (3 days)',
        description: 'Send reminder when trial ends in 3 days',
        triggerType: 'subscription_trial_ending',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'billing',
            title: 'Your trial ends in 3 days',
            body: 'Upgrade now to keep access to all features without interruption.',
          },
        },
        priority: 120,
      },
      {
        name: 'Trial Ending Email',
        description: 'Send email reminder when trial is ending',
        triggerType: 'subscription_trial_ending',
        conditionDef: [{ field: 'daysRemaining', operator: 'lte', value: 3 }],
        actionDef: {
          type: 'send_email',
          params: {
            subject: 'Your CoFounderBay trial ends in 3 days',
            bodyHtml: '<p>Your free trial is ending soon. Upgrade to continue building your network without interruption.</p><p><a href="https://app.cofounderbay.com/pricing">View Plans →</a></p>',
            bodyText: 'Your trial ends in 3 days. Upgrade at: https://app.cofounderbay.com/pricing',
          },
        },
        delaySeconds: 3600,
        priority: 125,
      },
      {
        name: 'Failed Payment Notification',
        description: 'Notify user when their subscription payment fails',
        triggerType: 'subscription_failed_payment',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'billing',
            title: 'Payment failed',
            body: 'We could not process your payment. Update your billing details to avoid service interruption.',
          },
        },
        priority: 130,
      },
      {
        name: 'Subscription Canceled Notification',
        description: 'Notify user when their subscription is canceled',
        triggerType: 'subscription_canceled',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'billing',
            title: 'Subscription canceled',
            body: 'Your subscription has been canceled. Your access continues until the end of the billing period.',
          },
        },
        priority: 135,
      },

      // ── I. Re-engagement ───────────────────────────────────────────────────
      {
        name: 'Inactive User Re-engagement',
        description: 'Send re-engagement nudge to users inactive for 14+ days',
        triggerType: 'user_inactive',
        actionDef: {
          type: 'send_in_app_notification',
          params: {
            notificationType: 'system',
            title: 'We miss you! 👋',
            body: 'New co-founders and mentors have joined. Check your match recommendations.',
          },
        },
        priority: 140,
      },
      {
        name: 'Inactive User Re-engagement Email',
        description: 'Send re-engagement email to users inactive for 14+ days',
        triggerType: 'user_inactive',
        conditionDef: [{ field: 'daysInactive', operator: 'gte', value: 14 }],
        actionDef: {
          type: 'send_email',
          params: {
            subject: 'New opportunities are waiting for you on CoFounderBay',
            bodyHtml: '<p>Hi,</p><p>It\'s been a while! New co-founders and investors have joined your network since your last visit.</p><p><a href="https://app.cofounderbay.com/discover">Explore Now →</a></p>',
            bodyText: 'New co-founders have joined. Explore: https://app.cofounderbay.com/discover',
          },
        },
        delaySeconds: 7200,
        priority: 145,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const rule of rules) {
      try {
        const existing = await this.prisma.automationRule.findFirst({
          where: { name: rule.name, tenantId: null },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await this.prisma.automationRule.create({
          data: {
            name: rule.name,
            description: rule.description,
            triggerType: rule.triggerType as any,
            conditionDef: (rule.conditionDef ?? null) as any,
            actionDef: rule.actionDef as any,
            delaySeconds: rule.delaySeconds ?? 0,
            priority: rule.priority ?? 100,
            tenantId: null,
            status: 'active',
          },
        });
        created++;
      } catch (err: any) {
        this.logger.warn(`Skipping seed rule "${rule.name}": ${err?.message}`);
      }
    }

    if (created > 0) {
      this.logger.log(`AutomationSeeder: created ${created} built-in rules (${skipped} already existed)`);
    }
  }
}
